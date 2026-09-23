-- Behaviour tests for 014_marketplace_integration.sql
-- Run against a THROWAWAY database (local Postgres or a Supabase branch), never production.
-- Each check raises an exception on failure; the whole script runs in one transaction and rolls back.
\set ON_ERROR_STOP 1
BEGIN;

-- ── Fixtures ────────────────────────────────────────────────
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000a001', 'agent@test'),
  ('00000000-0000-0000-0000-00000000a002', 'other-agent@test'),
  ('00000000-0000-0000-0000-00000000d001', 'driver@test');
INSERT INTO public.agents (id, auth_user_id, name) VALUES
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000a001', 'Agent One'),
  ('11111111-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000a002', 'Agent Two');
INSERT INTO public.delivery_partners (id, agent_id, name, phone, status, auth_user_id, vehicle_number, vehicle_type) VALUES
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Manjunath K', '9845012345', 'AVAILABLE',
   '00000000-0000-0000-0000-00000000d001', 'KA-09-AB-1234', 'Tata Ace');
INSERT INTO public.vehicles (id, agent_id, vehicle_number, vehicle_type) VALUES
  ('33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'KA-09-AB-1234', 'Tata Ace');

CREATE TEMP TABLE t_payload AS SELECT jsonb_build_object(
  'externalOrderId', '665f1c2b9a1e4b0012345678',
  'orderNumber', 'ORD-LX2K9P-7QF3',
  'buyerId', '665f1a009a1e4b0011111111', 'buyerName', 'Asha Rao', 'buyerPhone', '9876543210',
  'farmerId', '665f1a009a1e4b0022222222', 'farmerName', 'Ramesh Gowda', 'farmerPhone', '9123456780',
  'pickupAddress', 'Survey No. 42, Hunsur Road, Mysuru',
  'products', jsonb_build_array(
     jsonb_build_object('productId','p1','name','Tomato','category','vegetables','quantity',5,'unit','kg','price',30),
     jsonb_build_object('productId','p2','name','Onion','category','vegetables','quantity',2,'unit','kg','price',40)),
  'totalAmount', 230,
  'shippingAddress', jsonb_build_object('address','12 MG Road','city','Mysuru','state','Karnataka','pincode','570001','country','India'),
  'estimatedDelivery', '2026-09-28T10:00:00.000Z',
  'priority', 'HIGH', 'paymentStatus', 'pending', 'paymentMethod', 'cash', 'orderStatus', 'pending'
) AS p;
GRANT SELECT ON t_payload TO service_role, authenticated;

CREATE TEMP TABLE t_ctx (k text primary key, v text);
GRANT ALL ON t_ctx TO service_role, authenticated;

-- ── 1. Intake is service-role only ──────────────────────────
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-00000000a001';
DO $$ BEGIN
  PERFORM public.ingest_marketplace_order((SELECT p FROM t_payload), '11111111-0000-0000-0000-000000000001');
  RAISE EXCEPTION 'FAIL: authenticated user could call ingest_marketplace_order';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 1: intake blocked for app users';
END $$;
RESET ROLE;

-- ── 2. Intake stores ONLY the logistics copy, no callback loop ──
SET LOCAL ROLE service_role;
DO $$ DECLARE r jsonb; o record; BEGIN
  r := public.ingest_marketplace_order((SELECT p FROM t_payload), '11111111-0000-0000-0000-000000000001');
  ASSERT r->>'action' = 'created', 'expected created, got ' || r::text;
  ASSERT r->>'trackingId' LIKE 'AGRI-%', 'trackingId';
  INSERT INTO t_ctx VALUES ('order', r->>'logisticsOrderId');
  SELECT * INTO o FROM public.orders WHERE id = (r->>'logisticsOrderId')::uuid;
  ASSERT o.logistics_status = 'PENDING' AND o.marketplace_intake_status = 'NEW' AND o.source = 'MARKETPLACE', 'order state';
  ASSERT o.external_order_id = '665f1c2b9a1e4b0012345678', 'externalOrderId kept';
  ASSERT o.priority = 'HIGH' AND o.is_perishable, 'priority/perishable';
  ASSERT o.product LIKE 'Tomato (5 kg), Onion (2 kg)%' AND o.quantity = 7 AND o.unit = 'kg', 'package summary: ' || o.product;
  ASSERT o.pickup_address = 'Survey No. 42, Hunsur Road, Mysuru' AND o.pickup_contact_name = 'Ramesh Gowda' AND o.pickup_contact_phone = '9123456780', 'pickup info';
  ASSERT o.drop_contact_name = 'Asha Rao' AND o.drop_contact_phone = '9876543210' AND o.drop_address->>'pincode' = '570001', 'drop info';
  ASSERT o.delivery_location = '12 MG Road, Mysuru, Karnataka, 570001', 'drop: ' || o.delivery_location;
  ASSERT o.estimated_delivery = '2026-09-28T10:00:00Z', 'eta';
  -- data boundary: nothing marketplace-owned is replicated
  ASSERT o.farmer_id IS NULL AND o.buyer_id IS NULL, 'no farmer/buyer link';
  ASSERT (SELECT count(*) FROM public.buyers) = 0, 'no buyer accounts copied';
  ASSERT (SELECT count(*) FROM public.farmers) = 0, 'no farmer accounts copied';
  ASSERT (SELECT count(*) FROM public.products) = 0, 'no products copied';
  ASSERT o.price = 0 AND o.total_amount = 0, 'no money stored';
  ASSERT o.external_customer_id IS NULL AND o.external_farmer_id IS NULL AND o.external_product_id IS NULL, 'no marketplace account ids';
  ASSERT NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders'
                     AND column_name IN ('payment_status', 'marketplace_payload', 'marketplace_items', 'shipping_address')), 'no payment/payload columns';
  ASSERT (SELECT count(*) FROM public.notifications WHERE related_id = o.id) = 1, 'agent notified';
  ASSERT (SELECT count(*) FROM public.marketplace_sync_queue) = 0, 'intake must not call marketplace back';
  RAISE NOTICE 'PASS 2: intake stored a logistics-only job for %', o.order_number;
END $$;

-- ── 3. Re-ingest is idempotent ──────────────────────────────
DO $$ DECLARE r jsonb; BEGIN
  r := public.ingest_marketplace_order((SELECT p || '{"paymentStatus":"paid","buyerPhone":"9000000001"}' FROM t_payload), '11111111-0000-0000-0000-000000000001');
  ASSERT r->>'action' = 'updated', 'expected updated';
  ASSERT (SELECT count(*) FROM public.orders WHERE external_order_id = '665f1c2b9a1e4b0012345678') = 1, 'one order';
  ASSERT (SELECT drop_contact_phone FROM public.orders WHERE external_order_id = '665f1c2b9a1e4b0012345678') = '9000000001', 'delivery contact refreshed';
  ASSERT (SELECT count(*) FROM public.buyers) + (SELECT count(*) FROM public.farmers) = 0, 'still no accounts copied';
  RAISE NOTICE 'PASS 3: re-ingest idempotent (payment status ignored, delivery info refreshed)';
END $$;

DO $$ BEGIN
  PERFORM public.ingest_marketplace_order('{"orderNumber":"x"}'::jsonb, '11111111-0000-0000-0000-000000000001');
  RAISE EXCEPTION 'FAIL: missing externalOrderId accepted';
EXCEPTION WHEN invalid_parameter_value THEN RAISE NOTICE 'PASS 3b: validation';
END $$;
RESET ROLE;

-- ── 4. Agent accepts (RLS as agent) → event-only callback ───
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-00000000a001';
UPDATE public.orders SET marketplace_intake_status = 'ACCEPTED' WHERE id = (SELECT v::uuid FROM t_ctx WHERE k = 'order');
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.marketplace_sync_queue WHERE kind = 'EVENT' AND event_type = 'ORDER_ACCEPTED' AND logistics_status IS NULL) = 1, 'accept event';
  RAISE NOTICE 'PASS 4: accept → event-only callback (no ACCEPTED status)';
END $$;

-- ── 5. Dispatch: delivery + ASSIGNED event → PICKUP_ASSIGNED ──
INSERT INTO public.deliveries (id, delivery_number, order_id, delivery_partner_id, vehicle_id, status)
VALUES ('44444444-0000-0000-0000-000000000001', 'DLV-T1', (SELECT v::uuid FROM t_ctx WHERE k = 'order'),
        '22222222-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'AWAITING_PICKUP');
INSERT INTO public.delivery_events (delivery_id, agent_id, event_type, description)
VALUES ('44444444-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'ASSIGNED', 'Assigned to partner 22222222');
INSERT INTO public.delivery_events (delivery_id, agent_id, event_type, description)
VALUES ('44444444-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'VEHICLE_ASSIGNED', 'Assigned vehicle 3333');
DO $$ BEGIN
  ASSERT (SELECT logistics_status FROM public.orders WHERE id = (SELECT v::uuid FROM t_ctx WHERE k = 'order')) = 'PICKUP_ASSIGNED', 'order advanced';
  ASSERT (SELECT count(*) FROM public.marketplace_sync_queue WHERE kind = 'STATUS' AND logistics_status = 'PICKUP_ASSIGNED') = 1, 'one PICKUP_ASSIGNED';
  ASSERT (SELECT count(*) FROM public.marketplace_sync_queue WHERE kind = 'EVENT' AND event_type = 'VEHICLE_ASSIGNED') = 1, 'vehicle event';
  RAISE NOTICE 'PASS 5: dispatch → PICKUP_ASSIGNED callback + vehicle event';
END $$;
RESET ROLE;

-- ── 6. Driver app (RLS as driver, cannot touch orders) ──────
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-00000000d001';
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.orders) = 0, 'driver must not see orders (existing RLS)';
END $$;
INSERT INTO public.delivery_events (delivery_id, event_type, description, latitude, longitude) VALUES
  ('44444444-0000-0000-0000-000000000001', 'ACCEPTED', 'Driver transitioned to ACCEPTED', 12.30, 76.65),
  ('44444444-0000-0000-0000-000000000001', 'DRIVER_EN_ROUTE', 'Driver transitioned to DRIVER_EN_ROUTE', 12.30, 76.65),
  ('44444444-0000-0000-0000-000000000001', 'ARRIVED_AT_FARM', 'Driver transitioned to ARRIVED_AT_FARM', 12.29, 76.63),
  ('44444444-0000-0000-0000-000000000001', 'PICKED_UP', 'Driver transitioned to PICKED_UP', 12.29, 76.63),
  ('44444444-0000-0000-0000-000000000001', 'IN_TRANSIT', 'Driver transitioned to IN_TRANSIT', 12.31, 76.65),
  ('44444444-0000-0000-0000-000000000001', 'PICKED_UP', 'late duplicate', 12.31, 76.65);
RESET ROLE;
DO $$ DECLARE s text; BEGIN
  ASSERT (SELECT logistics_status FROM public.orders WHERE id = (SELECT v::uuid FROM t_ctx WHERE k = 'order')) = 'IN_TRANSIT', 'driver events moved order';
  SELECT string_agg(kind || ':' || coalesce(logistics_status, event_type), ',' ORDER BY id) INTO s
    FROM public.marketplace_sync_queue WHERE source_event_id IS NOT NULL AND event_type NOT IN ('ASSIGNED', 'VEHICLE_ASSIGNED');
  ASSERT s = 'STATUS:ACCEPTED,EVENT:DRIVER_EN_ROUTE,EVENT:ARRIVED_AT_FARM,STATUS:PICKED_UP,STATUS:IN_TRANSIT,EVENT:PICKED_UP', 'queue sequence: ' || s;
  RAISE NOTICE 'PASS 6: driver transitions → % ', s;
END $$;

-- ── 7. GPS throttled to one callback / minute / order ───────
UPDATE public.marketplace_sync_queue SET created_at = now() - interval '2 minutes';
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-00000000d001';
INSERT INTO public.driver_locations (delivery_partner_id, delivery_id, latitude, longitude) VALUES
  ('22222222-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001', 12.311, 76.651),
  ('22222222-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001', 12.312, 76.652),
  ('22222222-0000-0000-0000-000000000001', NULL, 12.313, 76.653);
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.marketplace_sync_queue WHERE kind = 'LOCATION') = 1, 'throttled location';
  RAISE NOTICE 'PASS 7: 3 GPS pings → 1 location callback';
END $$;

-- ── 8. Dispatch-screen flow (order update, then event) is merged ──
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-00000000a001';
UPDATE public.orders SET logistics_status = 'OUT_FOR_DELIVERY' WHERE id = (SELECT v::uuid FROM t_ctx WHERE k = 'order');
UPDATE public.deliveries SET status = 'OUT_FOR_DELIVERY' WHERE id = '44444444-0000-0000-0000-000000000001';
INSERT INTO public.delivery_events (delivery_id, agent_id, event_type, description)
VALUES ('44444444-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'OUT_FOR_DELIVERY', 'Status updated to OUT_FOR_DELIVERY by Agent');
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.marketplace_sync_queue WHERE event_type = 'OUT_FOR_DELIVERY' OR logistics_status = 'OUT_FOR_DELIVERY') = 1, 'merged';
  ASSERT (SELECT source_event_id IS NOT NULL FROM public.marketplace_sync_queue WHERE logistics_status = 'OUT_FOR_DELIVERY'), 'event linked';
  RAISE NOTICE 'PASS 8: order update + event → single callback';
END $$;

-- ── 9. Worker queue: claim / fail / backoff / success ───────
SET LOCAL ROLE service_role;
DO $$ DECLARE c int; first_id bigint; st text; q record; BEGIN
  SELECT count(*), min(id) INTO c, first_id FROM public.claim_marketplace_callbacks(100);
  ASSERT c = (SELECT count(*) FROM public.marketplace_sync_queue), 'claimed all';
  ASSERT (SELECT count(*) FROM public.claim_marketplace_callbacks(100)) = 0, 'no double claim';
  st := public.finish_marketplace_callback(first_id, false, 503, 'Service Unavailable');
  SELECT * INTO q FROM public.marketplace_sync_queue WHERE id = first_id;
  ASSERT st = 'FAILED' AND q.attempts = 1 AND q.next_attempt_at > now() + interval '25 seconds', 'backoff';
  ASSERT (SELECT marketplace_sync_status FROM public.orders WHERE id = q.order_id) = 'FAILED', 'order FAILED';
  ASSERT (SELECT count(*) FROM public.marketplace_callback_logs WHERE queue_id = first_id AND NOT success) = 1, 'failure logged';
  st := public.finish_marketplace_callback(first_id + 1, true, 200, NULL);
  ASSERT st = 'SENT', 'sent';
  ASSERT (SELECT marketplace_sync_status FROM public.orders WHERE id = q.order_id) = 'FAILED', 'still FAILED while another item failed';
  st := public.finish_marketplace_callback(first_id + 2, false, 400, 'Bad payload', true);
  ASSERT st = 'DEAD', 'non-retryable → DEAD';
  PERFORM public.release_marketplace_callback(first_id + 3);
  ASSERT (SELECT status FROM public.marketplace_sync_queue WHERE id = first_id + 3) = 'PENDING', 'released';
  RAISE NOTICE 'PASS 9: claim/backoff/dead-letter/logging';
END $$;
RESET ROLE;

-- ── 10. retry_marketplace_sync is scoped to the owning agent ──
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-00000000a002';
DO $$ BEGIN
  PERFORM public.retry_marketplace_sync((SELECT v::uuid FROM t_ctx WHERE k = 'order'));
  RAISE EXCEPTION 'FAIL: other agent could retry';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 10a: other agent blocked';
END $$;
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.marketplace_sync_queue) = 0, 'other agent sees no queue rows';
  RAISE NOTICE 'PASS 10b: queue RLS isolates agents';
END $$;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-00000000a001';
DO $$ DECLARE n int; BEGIN
  n := public.retry_marketplace_sync((SELECT v::uuid FROM t_ctx WHERE k = 'order'));
  ASSERT n = 2, 'requeued failed+dead: ' || n;
  ASSERT (SELECT count(*) FROM public.marketplace_sync_queue) > 0, 'owner sees queue';
  RAISE NOTICE 'PASS 10c: owner retry re-queued % callbacks', n;
END $$;
DO $$ BEGIN
  INSERT INTO public.marketplace_sync_queue (order_id, external_order_id, kind) VALUES ((SELECT v::uuid FROM t_ctx WHERE k = 'order'), 'x', 'EVENT');
  RAISE EXCEPTION 'FAIL: app user wrote to queue';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 10d: app cannot write queue';
END $$;

-- ── 11. Delivery completes ──────────────────────────────────
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-00000000d001';
INSERT INTO public.delivery_events (delivery_id, event_type, description)
VALUES ('44444444-0000-0000-0000-000000000001', 'DELIVERED', 'Delivered to Asha Rao');
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT logistics_status FROM public.orders WHERE id = (SELECT v::uuid FROM t_ctx WHERE k = 'order')) = 'DELIVERED', 'delivered';
  ASSERT EXISTS (SELECT 1 FROM public.marketplace_sync_queue WHERE kind = 'STATUS' AND logistics_status = 'DELIVERED'), 'DELIVERED queued';
  RAISE NOTICE 'PASS 11: DELIVERED callback queued';
END $$;

-- ── 12. Agent reject → CANCELLED with reason ────────────────
SET LOCAL ROLE service_role;
DO $$ DECLARE r jsonb; BEGIN
  r := public.ingest_marketplace_order((SELECT p || '{"externalOrderId":"ORDER-REJECT-1","orderNumber":"ORD-REJ"}' FROM t_payload), '11111111-0000-0000-0000-000000000001');
  INSERT INTO t_ctx VALUES ('reject', r->>'logisticsOrderId');
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-00000000a001';
UPDATE public.orders SET logistics_status = 'CANCELLED', status = 'Cancelled', marketplace_intake_status = 'REJECTED',
       cancellation_reason = 'No vehicle available for this route'
 WHERE id = (SELECT v::uuid FROM t_ctx WHERE k = 'reject');
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT message FROM public.marketplace_sync_queue WHERE order_id = (SELECT v::uuid FROM t_ctx WHERE k = 'reject') AND logistics_status = 'CANCELLED') = 'No vehicle available for this route', 'reject reason';
  RAISE NOTICE 'PASS 12: reject → CANCELLED + reason';
END $$;

-- ── 13. Marketplace cancels an order that has a driver ──────
SET LOCAL ROLE service_role;
DO $$ DECLARE r jsonb; oid uuid; BEGIN
  r := public.ingest_marketplace_order((SELECT p || '{"externalOrderId":"ORDER-CANCEL-1","orderNumber":"ORD-CXL"}' FROM t_payload), '11111111-0000-0000-0000-000000000001');
  oid := (r->>'logisticsOrderId')::uuid;
  INSERT INTO t_ctx VALUES ('cancel', oid);
  INSERT INTO public.deliveries (id, delivery_number, order_id, delivery_partner_id, vehicle_id, status)
  VALUES ('44444444-0000-0000-0000-000000000002', 'DLV-T2', oid, '22222222-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'PICKUP_ASSIGNED');
  UPDATE public.delivery_partners SET status = 'BUSY' WHERE id = '22222222-0000-0000-0000-000000000001';
  UPDATE public.vehicles SET availability_status = 'ASSIGNED' WHERE id = '33333333-0000-0000-0000-000000000001';
  INSERT INTO public.pickups (order_id, farmer_id, delivery_partner_id, status) SELECT oid, farmer_id, '22222222-0000-0000-0000-000000000001', 'ASSIGNED' FROM public.orders WHERE id = oid;
END $$;
RESET ROLE;
DO $$ DECLARE before_count int; BEGIN
  before_count := (SELECT count(*) FROM public.marketplace_sync_queue);
  SET LOCAL ROLE service_role;
  PERFORM public.ingest_marketplace_order((SELECT p || '{"externalOrderId":"ORDER-CANCEL-1","orderStatus":"cancelled"}' FROM t_payload), '11111111-0000-0000-0000-000000000001');
  RESET ROLE;
  ASSERT (SELECT logistics_status FROM public.orders WHERE id = (SELECT v::uuid FROM t_ctx WHERE k = 'cancel')) = 'CANCELLED', 'order cancelled';
  ASSERT (SELECT status FROM public.deliveries WHERE id = '44444444-0000-0000-0000-000000000002') = 'CANCELLED', 'delivery cancelled';
  ASSERT (SELECT status FROM public.delivery_partners WHERE id = '22222222-0000-0000-0000-000000000001') = 'ONLINE', 'driver freed';
  ASSERT (SELECT availability_status FROM public.vehicles WHERE id = '33333333-0000-0000-0000-000000000001') = 'AVAILABLE', 'vehicle freed';
  ASSERT (SELECT status FROM public.pickups WHERE order_id = (SELECT v::uuid FROM t_ctx WHERE k = 'cancel')) = 'CANCELLED', 'pickup cancelled';
  ASSERT EXISTS (SELECT 1 FROM public.delivery_events WHERE delivery_id = '44444444-0000-0000-0000-000000000002' AND event_type = 'CANCELLED'), 'audit event';
  ASSERT (SELECT count(*) FROM public.marketplace_sync_queue) = before_count, 'no callback back to marketplace';
  RAISE NOTICE 'PASS 13: marketplace cancel frees driver/vehicle, audited, no echo';
END $$;

-- ── 14. Agent-created (non-marketplace) orders never sync ───
DO $$ DECLARE fid uuid; oid uuid; before_count int; BEGIN
  before_count := (SELECT count(*) FROM public.marketplace_sync_queue);
  INSERT INTO public.farmers (agent_id, name, phone, village, district)
  VALUES ('11111111-0000-0000-0000-000000000001', 'Local Farmer', '9', 'V', 'D') RETURNING id INTO fid;
  INSERT INTO public.orders (order_number, agent_id, farmer_id, product, quantity, unit, price, total_amount)
  VALUES ('ORD-LOCAL', '11111111-0000-0000-0000-000000000001', fid, 'Rice', 10, 'kg', 50, 500) RETURNING id INTO oid;
  INSERT INTO public.deliveries (id, delivery_number, order_id) VALUES ('44444444-0000-0000-0000-000000000003', 'DLV-T3', oid);
  INSERT INTO public.delivery_events (delivery_id, event_type) VALUES ('44444444-0000-0000-0000-000000000003', 'ASSIGNED');
  ASSERT (SELECT logistics_status FROM public.orders WHERE id = oid) = 'PICKUP_ASSIGNED', 'local order status still tracked';
  ASSERT (SELECT count(*) FROM public.marketplace_sync_queue) = before_count, 'no sync for local orders';
  RAISE NOTICE 'PASS 14: local orders tracked, never sent to marketplace';
END $$;

-- ── 15. Validation not weakened for agent-created orders ────
DO $$ BEGIN
  INSERT INTO public.orders (order_number, agent_id, product, quantity, unit, price, total_amount)
  VALUES ('ORD-NOFARMER', '11111111-0000-0000-0000-000000000001', 'Rice', 1, 'kg', 1, 1);
  RAISE EXCEPTION 'FAIL: agent order without farmer accepted';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS 15a: agent orders still require a farmer';
END $$;
DO $$ DECLARE oid uuid; BEGIN
  SELECT id INTO oid FROM public.orders WHERE order_number = 'ORD-LOCAL';
  INSERT INTO public.pickups (order_id, farmer_id) VALUES (oid, NULL);
  RAISE EXCEPTION 'FAIL: pickup without farmer accepted for agent order';
EXCEPTION WHEN not_null_violation THEN RAISE NOTICE 'PASS 15b: agent pickups still require a farmer';
END $$;
DO $$ BEGIN
  INSERT INTO public.pickups (order_id, farmer_id) VALUES ((SELECT v::uuid FROM t_ctx WHERE k = 'order'), NULL);
  RAISE NOTICE 'PASS 15c: marketplace pickup needs no farmer account';
END $$;

\echo 'ALL MARKETPLACE INTEGRATION SQL TESTS PASSED'
ROLLBACK;
