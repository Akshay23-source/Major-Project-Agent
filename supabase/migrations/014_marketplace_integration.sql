-- 014_marketplace_integration.sql
-- Farm Marketplace (MongoDB) <-> Agri Agent (Supabase) integration.
--
-- DATA OWNERSHIP
--   Farm Marketplace (MongoDB Atlas) is the system of record for customers,
--   farmers, products, payments, escrow, reviews, analytics and all marketplace
--   business logic. NONE of that is replicated here.
--   Agri Agent (Supabase) keeps only the logistics copy it needs to run a
--   delivery, keyed by external_order_id:
--     - delivery information: pickup/drop address, handover contact name+phone,
--       package summary (what to carry), priority/perishable, ETA
--     - driver assignment, vehicle, GPS, delivery events, logistics status
--   A marketplace order becomes ONE row in public.orders (source='MARKETPLACE')
--   with no buyers/farmers/products rows and no money fields. Every change is
--   reported back through the API callback (never by sharing a database).
--
-- This migration is IDEMPOTENT (safe to run more than once):
--   1. Logistics-only columns on orders (+ farmer_id optional for marketplace jobs)
--   2. marketplace_sync_queue      – outbox + retry queue for status callbacks
--   3. marketplace_callback_logs   – every callback attempt (failed ones included)
--   4. Triggers that enqueue a callback on every delivery event, order status
--      change and (throttled) GPS ping – so it works no matter which app
--      (agent, driver) made the change, and no API key ever ships in the app.
--   5. ingest_marketplace_order()  – atomic, idempotent order intake (called by
--      the ingest-marketplace-order Edge Function with the service role only)
--   6. Queue helpers for the marketplace-callback-worker Edge Function
--
-- Existing tables, columns, policies and the driver state machine are untouched.

-- ─────────────────────────────────────────────────────────────
-- 1. Columns (IF NOT EXISTS – some may already exist in your project)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.orders
  -- link to the marketplace (the only marketplace identifier kept)
  ADD COLUMN IF NOT EXISTS external_order_id TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'AGENT',                -- AGENT | MARKETPLACE
  ADD COLUMN IF NOT EXISTS tracking_id TEXT,
  -- logistics status + handling
  ADD COLUMN IF NOT EXISTS logistics_status TEXT DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS marketplace_intake_status TEXT,             -- NEW | ACCEPTED | REJECTED (agent's decision)
  ADD COLUMN IF NOT EXISTS is_perishable BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_fragile BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS estimated_delivery TIMESTAMPTZ,
  -- delivery information (what a driver needs at pickup and drop-off)
  ADD COLUMN IF NOT EXISTS pickup_address TEXT,
  ADD COLUMN IF NOT EXISTS pickup_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS pickup_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS drop_address JSONB,                         -- {address, city, state, pincode, country}
  ADD COLUMN IF NOT EXISTS drop_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS drop_contact_phone TEXT,
  -- callback sync state
  ADD COLUMN IF NOT EXISTS marketplace_sync_status TEXT,               -- PENDING | SYNCED | FAILED
  ADD COLUMN IF NOT EXISTS marketplace_last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS marketplace_last_error TEXT;

-- A marketplace job has no row in the agent's own farmers registry (farmer
-- accounts live in MongoDB). Validation is NOT weakened for agent orders: a
-- farmer is still required unless the row is a marketplace logistics job.
ALTER TABLE public.orders ALTER COLUMN farmer_id DROP NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_farmer_required_unless_marketplace') THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_farmer_required_unless_marketplace
      CHECK (farmer_id IS NOT NULL OR (source = 'MARKETPLACE' AND external_order_id IS NOT NULL));
  END IF;
END $$;

-- Same for pickups: farmer_id stays mandatory except for marketplace jobs.
ALTER TABLE public.pickups ALTER COLUMN farmer_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.trg_pickups_require_farmer()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.farmer_id IS NULL AND NOT EXISTS (
    SELECT 1 FROM public.orders WHERE id = NEW.order_id AND source = 'MARKETPLACE' AND external_order_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'pickups.farmer_id is required for non-marketplace orders' USING ERRCODE = '23502';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pickups_require_farmer ON public.pickups;
CREATE TRIGGER pickups_require_farmer
  BEFORE INSERT OR UPDATE OF farmer_id, order_id ON public.pickups
  FOR EACH ROW EXECUTE FUNCTION public.trg_pickups_require_farmer();

CREATE INDEX IF NOT EXISTS idx_orders_external_order_id ON public.orders (external_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_marketplace ON public.orders (agent_id, marketplace_intake_status, logistics_status)
  WHERE external_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deliveries_order_id ON public.deliveries (order_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_delivery ON public.driver_locations (delivery_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_locations_partner ON public.driver_locations (delivery_partner_id, recorded_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 2. Outbox / retry queue
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketplace_sync_queue (
  id BIGSERIAL PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  external_order_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('STATUS', 'EVENT', 'LOCATION')),
  logistics_status TEXT,                 -- set for kind = STATUS
  event_type TEXT,
  message TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  delivery_id UUID,
  source_event_id UUID,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'DEAD')),
  attempts INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  last_error TEXT,
  last_http_status INT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mkt_queue_due ON public.marketplace_sync_queue (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_mkt_queue_order ON public.marketplace_sync_queue (order_id, created_at);

-- ─────────────────────────────────────────────────────────────
-- 3. Callback attempt log (audit + failed callback logging)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketplace_callback_logs (
  id BIGSERIAL PRIMARY KEY,
  queue_id BIGINT REFERENCES public.marketplace_sync_queue(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  attempt INT NOT NULL DEFAULT 1,
  success BOOLEAN NOT NULL,
  http_status INT,
  error TEXT,
  request_body JSONB,
  response_body TEXT,
  duration_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mkt_logs_order ON public.marketplace_callback_logs (order_id, created_at DESC);

-- RLS: agents can READ their own queue/log rows. Nobody writes from the app –
-- only SECURITY DEFINER triggers/functions and the service role (Edge Functions).
ALTER TABLE public.marketplace_sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_callback_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agents can view their marketplace sync queue" ON public.marketplace_sync_queue;
CREATE POLICY "Agents can view their marketplace sync queue" ON public.marketplace_sync_queue FOR SELECT
  USING (agent_id IN (SELECT id FROM public.agents WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "Agents can view their marketplace callback logs" ON public.marketplace_callback_logs;
CREATE POLICY "Agents can view their marketplace callback logs" ON public.marketplace_callback_logs FOR SELECT
  USING (agent_id IN (SELECT id FROM public.agents WHERE auth_user_id = auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- 4. Status helpers
-- ─────────────────────────────────────────────────────────────

-- Rank of the logistics statuses the marketplace understands (NULL = not one of them).
CREATE OR REPLACE FUNCTION public.marketplace_status_rank(p_status TEXT)
RETURNS INT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE upper(coalesce(p_status, ''))
    WHEN 'PENDING' THEN 0
    WHEN 'PICKUP_ASSIGNED' THEN 1
    WHEN 'ACCEPTED' THEN 2
    WHEN 'PICKED_UP' THEN 3
    WHEN 'IN_TRANSIT' THEN 4
    WHEN 'OUT_FOR_DELIVERY' THEN 5
    WHEN 'DELIVERED' THEN 6
    WHEN 'CANCELLED' THEN 6
    WHEN 'FAILED_DELIVERY' THEN 6
    WHEN 'RETURNED' THEN 7
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.marketplace_is_terminal(p_status TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  SELECT upper(coalesce(p_status, '')) IN ('DELIVERED', 'CANCELLED', 'FAILED_DELIVERY', 'RETURNED')
$$;

-- Delivery event type -> marketplace logistics status (NULL = informational event only).
-- Covers the driver state machine (ASSIGNED, ACCEPTED, ARRIVED_AT_FARM, PICKED_UP,
-- IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED) and the agent/dispatch event names.
CREATE OR REPLACE FUNCTION public.marketplace_map_event_status(p_event_type TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE upper(coalesce(p_event_type, ''))
    WHEN 'ASSIGNED' THEN 'PICKUP_ASSIGNED'
    WHEN 'PICKUP_ASSIGNED' THEN 'PICKUP_ASSIGNED'
    WHEN 'ACCEPTED' THEN 'ACCEPTED'
    WHEN 'PICKED_UP' THEN 'PICKED_UP'
    WHEN 'IN_TRANSIT' THEN 'IN_TRANSIT'
    WHEN 'OUT_FOR_DELIVERY' THEN 'OUT_FOR_DELIVERY'
    WHEN 'DELIVERED' THEN 'DELIVERED'
    WHEN 'CANCELLED' THEN 'CANCELLED'
    WHEN 'FAILED_DELIVERY' THEN 'FAILED_DELIVERY'
    WHEN 'RETURNED' THEN 'RETURNED'
    ELSE NULL
  END
$$;

-- Forward-only rule (same as the marketplace side): never move backwards,
-- never leave a terminal state for a non-terminal one.
CREATE OR REPLACE FUNCTION public.marketplace_should_advance(p_current TEXT, p_next TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN public.marketplace_status_rank(p_next) IS NULL THEN false
    WHEN public.marketplace_status_rank(p_current) IS NULL THEN true
    WHEN upper(p_current) = upper(p_next) THEN false
    WHEN public.marketplace_is_terminal(p_current) AND NOT public.marketplace_is_terminal(p_next) THEN false
    ELSE public.marketplace_status_rank(p_next) > public.marketplace_status_rank(p_current)
  END
$$;

CREATE OR REPLACE FUNCTION public.marketplace_try_timestamptz(p_value TEXT)
RETURNS TIMESTAMPTZ LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p_value IS NULL OR btrim(p_value) = '' THEN RETURN NULL; END IF;
  RETURN p_value::timestamptz;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

-- Single place that writes to the queue.
CREATE OR REPLACE FUNCTION public.marketplace_enqueue(
  p_order_id UUID,
  p_kind TEXT,
  p_logistics_status TEXT,
  p_event_type TEXT,
  p_message TEXT,
  p_latitude NUMERIC,
  p_longitude NUMERIC,
  p_delivery_id UUID,
  p_source_event_id UUID,
  p_occurred_at TIMESTAMPTZ
) RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order RECORD;
  v_id BIGINT;
BEGIN
  SELECT id, agent_id, external_order_id INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND OR v_order.external_order_id IS NULL THEN
    RETURN NULL;  -- not a marketplace order: nothing to sync
  END IF;

  INSERT INTO public.marketplace_sync_queue (
    order_id, agent_id, external_order_id, kind, logistics_status, event_type,
    message, latitude, longitude, delivery_id, source_event_id, occurred_at
  ) VALUES (
    v_order.id, v_order.agent_id, v_order.external_order_id, p_kind, p_logistics_status, p_event_type,
    p_message, p_latitude, p_longitude, p_delivery_id, p_source_event_id, coalesce(p_occurred_at, now())
  ) RETURNING id INTO v_id;

  UPDATE public.orders
     SET marketplace_sync_status = 'PENDING'
   WHERE id = v_order.id
     AND marketplace_sync_status IS DISTINCT FROM 'PENDING';

  RETURN v_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5. Triggers
-- ─────────────────────────────────────────────────────────────
-- Session flags (transaction-local):
--   agri.marketplace_origin = 'on'   change came FROM the marketplace -> never call it back
--   agri.suppress_order_trigger = 'on'  the events trigger already enqueued this change

-- 5a. Every delivery event = audit trail + callback (Phase 10)
CREATE OR REPLACE FUNCTION public.trg_delivery_event_marketplace_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order RECORD;
  v_mapped TEXT;
  v_advanced BOOLEAN := false;
  v_merged BIGINT;
BEGIN
  IF current_setting('agri.marketplace_origin', true) = 'on' THEN
    RETURN NEW;
  END IF;

  SELECT o.id, o.external_order_id, o.logistics_status
    INTO v_order
    FROM public.deliveries d
    JOIN public.orders o ON o.id = d.order_id
   WHERE d.id = NEW.delivery_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_mapped := public.marketplace_map_event_status(NEW.event_type);

  -- Keep orders.logistics_status in step with the delivery (forward-only).
  -- Runs as definer, so a driver's event can move the order too.
  IF v_mapped IS NOT NULL AND public.marketplace_should_advance(v_order.logistics_status, v_mapped) THEN
    PERFORM set_config('agri.suppress_order_trigger', 'on', true);
    UPDATE public.orders SET logistics_status = v_mapped WHERE id = v_order.id;
    PERFORM set_config('agri.suppress_order_trigger', 'off', true);
    v_advanced := true;
  END IF;

  IF v_order.external_order_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- The dispatch screen updates orders.logistics_status first and inserts the
  -- event second. Fold this event into that pending STATUS callback instead of
  -- sending the same transition twice.
  IF v_mapped IS NOT NULL AND NOT v_advanced THEN
    UPDATE public.marketplace_sync_queue q
       SET event_type = NEW.event_type,
           message = coalesce(nullif(NEW.description, ''), q.message),
           latitude = coalesce(NEW.latitude, q.latitude),
           longitude = coalesce(NEW.longitude, q.longitude),
           delivery_id = NEW.delivery_id,
           source_event_id = NEW.id
     WHERE q.id = (
       SELECT id FROM public.marketplace_sync_queue
        WHERE order_id = v_order.id
          AND kind = 'STATUS'
          AND logistics_status = v_mapped
          AND status = 'PENDING'
          AND source_event_id IS NULL
          AND created_at > now() - interval '5 minutes'
        ORDER BY id DESC
        LIMIT 1
     )
    RETURNING q.id INTO v_merged;

    IF v_merged IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  PERFORM public.marketplace_enqueue(
    v_order.id,
    CASE WHEN v_advanced THEN 'STATUS' ELSE 'EVENT' END,
    CASE WHEN v_advanced THEN v_mapped END,
    NEW.event_type,
    NEW.description,
    NEW.latitude,
    NEW.longitude,
    NEW.delivery_id,
    NEW.id,
    NEW.created_at
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS delivery_events_marketplace_sync ON public.delivery_events;
CREATE TRIGGER delivery_events_marketplace_sync
  AFTER INSERT ON public.delivery_events
  FOR EACH ROW EXECUTE FUNCTION public.trg_delivery_event_marketplace_sync();

-- 5b. Order-level changes that have no delivery yet (accept / reject) or that
--     are written straight to orders.logistics_status by the dispatch screen.
CREATE OR REPLACE FUNCTION public.trg_order_marketplace_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.external_order_id IS NULL
     OR current_setting('agri.marketplace_origin', true) = 'on'
     OR current_setting('agri.suppress_order_trigger', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.logistics_status IS DISTINCT FROM OLD.logistics_status
     AND public.marketplace_status_rank(NEW.logistics_status) IS NOT NULL THEN
    PERFORM public.marketplace_enqueue(
      NEW.id, 'STATUS', upper(NEW.logistics_status), upper(NEW.logistics_status),
      CASE WHEN public.marketplace_is_terminal(NEW.logistics_status)
                AND upper(NEW.logistics_status) <> 'DELIVERED'
           THEN NEW.cancellation_reason END,
      NULL, NULL, NULL, NULL, now()
    );
  END IF;

  IF NEW.marketplace_intake_status IS DISTINCT FROM OLD.marketplace_intake_status
     AND NEW.marketplace_intake_status = 'ACCEPTED' THEN
    PERFORM public.marketplace_enqueue(
      NEW.id, 'EVENT', NULL, 'ORDER_ACCEPTED',
      'Order accepted by the logistics partner. A driver will be assigned shortly.',
      NULL, NULL, NULL, NULL, now()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_marketplace_sync ON public.orders;
CREATE TRIGGER orders_marketplace_sync
  AFTER UPDATE OF logistics_status, marketplace_intake_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_order_marketplace_sync();

-- 5c. GPS: forward the driver's position at most once a minute per order (Phase 9).
--     Every other callback already carries the latest driver_locations row.
CREATE OR REPLACE FUNCTION public.trg_driver_location_marketplace_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_delivery_id UUID := NEW.delivery_id;
  v_order RECORD;
BEGIN
  IF v_delivery_id IS NULL THEN
    SELECT d.id INTO v_delivery_id
      FROM public.deliveries d
     WHERE d.delivery_partner_id = NEW.delivery_partner_id
       AND NOT public.marketplace_is_terminal(d.status)
     ORDER BY d.created_at DESC
     LIMIT 1;
  END IF;

  IF v_delivery_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT o.id, o.external_order_id, o.logistics_status INTO v_order
    FROM public.deliveries d JOIN public.orders o ON o.id = d.order_id
   WHERE d.id = v_delivery_id;

  IF NOT FOUND OR v_order.external_order_id IS NULL OR public.marketplace_is_terminal(v_order.logistics_status) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.marketplace_sync_queue
     WHERE order_id = v_order.id
       AND created_at > now() - interval '60 seconds'
  ) THEN
    RETURN NEW;  -- throttled; the next callback will pick up the latest point anyway
  END IF;

  PERFORM public.marketplace_enqueue(
    v_order.id, 'LOCATION', NULL, 'LOCATION_UPDATE', NULL,
    NEW.latitude, NEW.longitude, v_delivery_id, NULL, NEW.recorded_at
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS driver_locations_marketplace_sync ON public.driver_locations;
CREATE TRIGGER driver_locations_marketplace_sync
  AFTER INSERT ON public.driver_locations
  FOR EACH ROW EXECUTE FUNCTION public.trg_driver_location_marketplace_sync();

-- ─────────────────────────────────────────────────────────────
-- 6. Marketplace-initiated cancellation (no callback back to the marketplace)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.marketplace_cancel_order(p_order_id UUID, p_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order RECORD;
  d RECORD;
  v_prev_origin TEXT := coalesce(current_setting('agri.marketplace_origin', true), 'off');
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR public.marketplace_is_terminal(v_order.logistics_status) THEN
    RETURN;
  END IF;

  PERFORM set_config('agri.marketplace_origin', 'on', true);

  UPDATE public.orders
     SET logistics_status = 'CANCELLED',
         status = 'Cancelled',
         cancellation_reason = p_reason
   WHERE id = p_order_id;

  FOR d IN
    SELECT * FROM public.deliveries
     WHERE order_id = p_order_id
       AND NOT public.marketplace_is_terminal(status)
  LOOP
    UPDATE public.deliveries
       SET status = 'CANCELLED', cancellation_reason = p_reason
     WHERE id = d.id;

    INSERT INTO public.delivery_events (delivery_id, agent_id, event_type, description)
    VALUES (d.id, v_order.agent_id, 'CANCELLED', p_reason);

    IF d.delivery_partner_id IS NOT NULL THEN
      UPDATE public.delivery_partners SET status = 'ONLINE'
       WHERE id = d.delivery_partner_id AND status IN ('BUSY', 'ON_DELIVERY');
    END IF;
    IF d.vehicle_id IS NOT NULL THEN
      UPDATE public.vehicles SET availability_status = 'AVAILABLE'
       WHERE id = d.vehicle_id AND availability_status = 'ASSIGNED';
    END IF;
  END LOOP;

  UPDATE public.pickups SET status = 'CANCELLED'
   WHERE order_id = p_order_id AND coalesce(status, '') NOT IN ('PICKED_UP', 'FAILED', 'CANCELLED');

  INSERT INTO public.notifications (agent_id, type, title, message, related_id, related_type)
  VALUES (v_order.agent_id, 'Order Update', 'Marketplace Order Cancelled',
          format('Order %s was cancelled on the marketplace. Stop any pickup in progress.', v_order.order_number),
          v_order.id, 'order');

  PERFORM set_config('agri.marketplace_origin', v_prev_origin, true);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 7. Order intake (Phase 2) – atomic + idempotent on externalOrderId
--
-- Stores ONLY the logistics copy. Deliberately IGNORED (stay in MongoDB):
--   buyerId / farmerId / productId, prices, totalAmount, paymentStatus,
--   paymentMethod, escrow, reviews, the raw payload.
-- No rows are created in buyers / farmers / products.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ingest_marketplace_order(p_payload JSONB, p_agent_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ext TEXT := nullif(btrim(p_payload->>'externalOrderId'), '');
  v_drop JSONB;
  v_items JSONB := CASE WHEN jsonb_typeof(p_payload->'products') = 'array' THEN p_payload->'products' ELSE '[]'::jsonb END;
  v_pickup_addr TEXT := coalesce(nullif(p_payload#>>'{farmer,address}', ''), nullif(p_payload->>'pickupAddress', ''));
  v_pickup_name TEXT := coalesce(nullif(p_payload#>>'{farmer,name}', ''), nullif(p_payload->>'farmerName', ''));
  v_pickup_phone TEXT := coalesce(nullif(p_payload#>>'{farmer,phone}', ''), nullif(p_payload->>'farmerPhone', ''));
  v_drop_name TEXT := coalesce(nullif(p_payload#>>'{buyer,name}', ''), nullif(p_payload->>'buyerName', ''));
  v_drop_phone TEXT := coalesce(nullif(p_payload#>>'{buyer,phone}', ''), nullif(p_payload->>'buyerPhone', ''));
  v_priority TEXT := upper(coalesce(p_payload->>'priority', 'NORMAL'));
  v_cancelled BOOLEAN := lower(coalesce(p_payload->>'orderStatus', '')) = 'cancelled';
  v_eta TIMESTAMPTZ := public.marketplace_try_timestamptz(p_payload->>'estimatedDelivery');
  v_instructions TEXT := left(nullif(btrim(p_payload->>'notes'), ''), 500);
  v_package TEXT;
  v_qty NUMERIC;
  v_unit TEXT;
  v_perishable BOOLEAN;
  v_drop_text TEXT;
  v_order RECORD;
  v_order_id UUID;
  v_action TEXT;
  v_prev_origin TEXT := coalesce(current_setting('agri.marketplace_origin', true), 'off');
BEGIN
  IF v_ext IS NULL THEN
    RAISE EXCEPTION 'externalOrderId is required' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.agents WHERE id = p_agent_id) THEN
    RAISE EXCEPTION 'Configured agent % does not exist', p_agent_id USING ERRCODE = '22023';
  END IF;

  -- Serialise concurrent deliveries of the same order; never call the marketplace back.
  PERFORM pg_advisory_xact_lock(hashtext('marketplace-order:' || v_ext));
  PERFORM set_config('agri.marketplace_origin', 'on', true);

  IF v_priority NOT IN ('NORMAL', 'HIGH', 'URGENT') THEN v_priority := 'NORMAL'; END IF;

  -- Drop-off address: keep only address fields
  v_drop := jsonb_strip_nulls(jsonb_build_object(
    'address', p_payload#>>'{shippingAddress,address}',
    'city', p_payload#>>'{shippingAddress,city}',
    'state', p_payload#>>'{shippingAddress,state}',
    'pincode', p_payload#>>'{shippingAddress,pincode}',
    'country', p_payload#>>'{shippingAddress,country}'
  ));
  v_drop_text := nullif(concat_ws(', ', nullif(v_drop->>'address', ''), nullif(v_drop->>'city', ''),
                                  nullif(v_drop->>'state', ''), nullif(v_drop->>'pincode', '')), '');

  -- Package summary for the driver: names + quantities only (no product ids, no prices)
  SELECT
    coalesce(string_agg(format('%s (%s %s)', coalesce(i->>'name', 'Item'), coalesce(i->>'quantity', '?'), coalesce(i->>'unit', '')), ', '), 'Marketplace delivery'),
    coalesce(sum(CASE WHEN (i->>'quantity') ~ '^[0-9]+(\.[0-9]+)?$' THEN (i->>'quantity')::numeric ELSE 0 END), 0),
    CASE WHEN count(DISTINCT i->>'unit') = 1 THEN max(i->>'unit') ELSE 'units' END,
    coalesce(bool_or(lower(coalesce(i->>'category', '')) IN ('vegetables', 'fruits', 'dairy', 'meat', 'poultry')), false)
  INTO v_package, v_qty, v_unit, v_perishable
  FROM jsonb_array_elements(v_items) AS i;

  v_unit := coalesce(v_unit, 'units');
  v_perishable := v_perishable OR v_priority IN ('HIGH', 'URGENT');

  SELECT * INTO v_order FROM public.orders WHERE external_order_id = v_ext ORDER BY created_at LIMIT 1 FOR UPDATE;

  IF FOUND THEN
    -- Re-sync of a known order (details changed, or cancelled on the marketplace)
    v_order_id := v_order.id;
    v_action := 'updated';

    UPDATE public.orders
       SET priority = v_priority,
           is_perishable = v_perishable,
           estimated_delivery = coalesce(v_eta, estimated_delivery)
     WHERE id = v_order_id;

    -- Delivery details can only change before a driver is on the way
    IF coalesce(v_order.logistics_status, 'PENDING') = 'PENDING' THEN
      UPDATE public.orders
         SET product = left(v_package, 500),
             quantity = v_qty,
             unit = v_unit,
             notes = coalesce(v_instructions, notes),
             delivery_location = coalesce(v_drop_text, delivery_location),
             drop_address = CASE WHEN v_drop = '{}'::jsonb THEN drop_address ELSE v_drop END,
             drop_contact_name = coalesce(v_drop_name, drop_contact_name),
             drop_contact_phone = coalesce(v_drop_phone, drop_contact_phone),
             pickup_address = coalesce(v_pickup_addr, pickup_address),
             pickup_contact_name = coalesce(v_pickup_name, pickup_contact_name),
             pickup_contact_phone = coalesce(v_pickup_phone, pickup_contact_phone)
       WHERE id = v_order_id;
    END IF;

    IF v_cancelled AND NOT public.marketplace_is_terminal(v_order.logistics_status) THEN
      PERFORM public.marketplace_cancel_order(v_order_id, 'Cancelled on Farm Marketplace');
      v_action := 'cancelled';
    END IF;
  ELSE
    v_order_id := gen_random_uuid();
    v_action := 'created';

    -- price / total_amount are NOT NULL in the legacy schema: store 0 – money
    -- belongs to the marketplace and must never be read from here.
    INSERT INTO public.orders (
      id, order_number, agent_id, farmer_id, buyer_id, product, quantity, unit, price, total_amount,
      delivery_location, notes, status, logistics_status, source, marketplace_intake_status,
      external_order_id, priority, is_perishable, estimated_delivery,
      pickup_address, pickup_contact_name, pickup_contact_phone,
      drop_address, drop_contact_name, drop_contact_phone,
      tracking_id, marketplace_sync_status, marketplace_last_synced_at
    ) VALUES (
      v_order_id,
      coalesce(nullif(p_payload->>'orderNumber', ''), v_ext),
      p_agent_id, NULL, NULL, left(v_package, 500), v_qty, v_unit, 0, 0,
      v_drop_text, v_instructions,
      CASE WHEN v_cancelled THEN 'Cancelled' ELSE 'Pending' END,
      CASE WHEN v_cancelled THEN 'CANCELLED' ELSE 'PENDING' END,
      'MARKETPLACE', 'NEW',
      v_ext, v_priority, v_perishable, v_eta,
      v_pickup_addr, v_pickup_name, v_pickup_phone,
      nullif(v_drop, '{}'::jsonb), v_drop_name, v_drop_phone,
      'AGRI-' || upper(substr(replace(v_order_id::text, '-', ''), 1, 10)),
      'SYNCED', now()
    );

    INSERT INTO public.notifications (agent_id, type, title, message, related_id, related_type)
    VALUES (p_agent_id, 'New Order', 'New Marketplace Delivery',
            format('Delivery %s: %s → %s is waiting for a driver.',
                   coalesce(nullif(p_payload->>'orderNumber', ''), v_ext),
                   coalesce(v_pickup_addr, 'pickup'), coalesce(v_drop_text, 'drop-off')),
            v_order_id, 'order');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_order_id;

  -- restore, so later statements in the same transaction behave normally
  PERFORM set_config('agri.marketplace_origin', v_prev_origin, true);

  RETURN jsonb_build_object(
    'success', true,
    'action', v_action,
    'logisticsOrderId', v_order.id,
    'trackingId', v_order.tracking_id,
    'orderNumber', v_order.order_number,
    'logisticsStatus', v_order.logistics_status,
    'deliveryProvider', 'agri-agent'
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 8. Queue helpers for the marketplace-callback-worker Edge Function
-- ─────────────────────────────────────────────────────────────

-- Claim a batch (PENDING / due FAILED / stuck PROCESSING) without double-sending.
CREATE OR REPLACE FUNCTION public.claim_marketplace_callbacks(p_limit INT DEFAULT 25)
RETURNS SETOF public.marketplace_sync_queue
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE public.marketplace_sync_queue q
     SET status = 'PROCESSING', locked_at = now()
   WHERE q.id IN (
     SELECT id FROM public.marketplace_sync_queue
      WHERE (status IN ('PENDING', 'FAILED') AND next_attempt_at <= now())
         OR (status = 'PROCESSING' AND locked_at < now() - interval '5 minutes')
      ORDER BY created_at, id
      LIMIT greatest(1, least(p_limit, 100))
      FOR UPDATE SKIP LOCKED
   )
  RETURNING q.*;
END;
$$;

-- Record the outcome of one attempt. Exponential backoff: 30s, 60s, 2m … capped at 1h;
-- dead-lettered after 10 attempts or on a non-retryable response.
CREATE OR REPLACE FUNCTION public.finish_marketplace_callback(
  p_id BIGINT,
  p_success BOOLEAN,
  p_http_status INT,
  p_error TEXT,
  p_dead BOOLEAN DEFAULT false,
  p_request JSONB DEFAULT NULL,
  p_response TEXT DEFAULT NULL,
  p_duration_ms INT DEFAULT NULL
) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item public.marketplace_sync_queue;
  v_status TEXT;
  v_max_attempts CONSTANT INT := 10;
BEGIN
  SELECT * INTO v_item FROM public.marketplace_sync_queue WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_status := CASE
    WHEN p_success THEN 'SENT'
    WHEN p_dead OR v_item.attempts + 1 >= v_max_attempts THEN 'DEAD'
    ELSE 'FAILED'
  END;

  UPDATE public.marketplace_sync_queue
     SET status = v_status,
         attempts = attempts + 1,
         last_http_status = p_http_status,
         last_error = CASE WHEN p_success THEN NULL ELSE left(p_error, 1000) END,
         sent_at = CASE WHEN p_success THEN now() ELSE sent_at END,
         locked_at = NULL,
         next_attempt_at = CASE WHEN p_success THEN next_attempt_at
                                ELSE now() + make_interval(secs => least(3600, 30 * power(2, v_item.attempts)::int)) END
   WHERE id = p_id;

  INSERT INTO public.marketplace_callback_logs
    (queue_id, order_id, agent_id, attempt, success, http_status, error, request_body, response_body, duration_ms)
  VALUES
    (p_id, v_item.order_id, v_item.agent_id, v_item.attempts + 1, p_success, p_http_status,
     left(p_error, 1000), p_request, left(p_response, 2000), p_duration_ms);

  IF p_success THEN
    UPDATE public.orders
       SET marketplace_sync_status = CASE
             WHEN EXISTS (SELECT 1 FROM public.marketplace_sync_queue
                           WHERE order_id = v_item.order_id AND id <> p_id
                             AND status IN ('FAILED', 'DEAD')) THEN 'FAILED'
             ELSE 'SYNCED' END,
           marketplace_last_synced_at = now(),
           marketplace_last_error = NULL
     WHERE id = v_item.order_id;
  ELSE
    UPDATE public.orders
       SET marketplace_sync_status = 'FAILED',
           marketplace_last_error = left(p_error, 500)
     WHERE id = v_item.order_id;
  END IF;

  RETURN v_status;
END;
$$;

-- Hand an item back untouched (used to keep per-order ordering after a failure).
CREATE OR REPLACE FUNCTION public.release_marketplace_callback(p_id BIGINT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.marketplace_sync_queue
     SET status = CASE WHEN attempts > 0 THEN 'FAILED' ELSE 'PENDING' END,
         locked_at = NULL
   WHERE id = p_id AND status = 'PROCESSING';
$$;

-- Agent-callable: re-queue failed / dead callbacks for one of THEIR orders.
CREATE OR REPLACE FUNCTION public.retry_marketplace_sync(p_order_id UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INT;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM public.orders o JOIN public.agents a ON a.id = o.agent_id
     WHERE o.id = p_order_id AND a.auth_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  UPDATE public.marketplace_sync_queue
     SET status = 'PENDING', attempts = 0, next_attempt_at = now(), locked_at = NULL
   WHERE order_id = p_order_id AND status IN ('FAILED', 'DEAD');
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    UPDATE public.orders SET marketplace_sync_status = 'PENDING' WHERE id = p_order_id;
  END IF;
  RETURN v_count;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 9. Privileges – intake + queue internals are service-role only
-- ─────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.ingest_marketplace_order(JSONB, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marketplace_cancel_order(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marketplace_enqueue(UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, UUID, UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_marketplace_callbacks(INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_marketplace_callback(BIGINT, BOOLEAN, INT, TEXT, BOOLEAN, JSONB, TEXT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_marketplace_callback(BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.retry_marketplace_sync(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.ingest_marketplace_order(JSONB, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.marketplace_cancel_order(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_marketplace_callbacks(INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_marketplace_callback(BIGINT, BOOLEAN, INT, TEXT, BOOLEAN, JSONB, TEXT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_marketplace_callback(BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.retry_marketplace_sync(UUID) TO authenticated, service_role;
GRANT SELECT ON public.marketplace_sync_queue, public.marketplace_callback_logs TO authenticated;
GRANT ALL ON public.marketplace_sync_queue, public.marketplace_callback_logs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.marketplace_sync_queue_id_seq, public.marketplace_callback_logs_id_seq TO service_role;
