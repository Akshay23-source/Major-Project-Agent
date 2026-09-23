/**
 * marketplaceCallbackService — Agri Agent → Farm Marketplace status callbacks.
 *
 * Drains public.marketplace_sync_queue (filled by Postgres triggers on every
 * delivery event, order status change and throttled GPS ping) and POSTs each
 * item to:
 *
 *   POST {MARKETPLACE_API_URL}/api/integration/order-status
 *   x-api-key: {MARKETPLACE_API_KEY}
 *
 * Payload: { externalOrderId, logisticsStatus?, driver, vehicle, trackingEvents,
 *            currentLocation, timestamp, trackingId, eta?, reason? }
 *
 * Delivery guarantees:
 *   - at-least-once (the marketplace de-duplicates events and is forward-only)
 *   - per-order ordering: after a failure, later items for that order wait
 *   - exponential backoff + dead-lettering handled in SQL (finish_marketplace_callback)
 *   - every attempt is written to marketplace_callback_logs
 *
 * Pure logic (payload building, classification) is separated from I/O so it
 * can be unit-tested without Supabase: see supabase/functions/tests/.
 */

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type QueueKind = 'STATUS' | 'EVENT' | 'LOCATION';

export interface QueueItem {
  id: number;
  order_id: string;
  agent_id: string | null;
  external_order_id: string;
  kind: QueueKind;
  logistics_status: string | null;
  event_type: string | null;
  message: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  delivery_id: string | null;
  occurred_at: string;
  attempts: number;
}

export interface CallbackContext {
  order: {
    id: string;
    external_order_id: string | null;
    logistics_status: string | null;
    tracking_id: string | null;
    cancellation_reason: string | null;
  };
  delivery?: { id: string; eta: string | null; created_at?: string | null } | null;
  partner?: {
    id: string;
    name: string | null;
    phone: string | null;
    vehicle_number?: string | null;
    vehicle_type?: string | null;
  } | null;
  vehicle?: { id: string; vehicle_number: string | null; vehicle_type: string | null } | null;
  location?: { latitude: number | string; longitude: number | string; recorded_at: string } | null;
}

export interface CallbackPayload {
  externalOrderId: string;
  logisticsStatus?: string;
  trackingId?: string;
  driver?: { id: string; name: string; phone: string };
  vehicle?: { id?: string; number: string; type: string };
  trackingEvents: Array<{
    status: string;
    message: string;
    timestamp: string;
    latitude?: number;
    longitude?: number;
  }>;
  currentLocation?: { latitude: number; longitude: number; updatedAt: string };
  eta?: string;
  reason?: string;
  timestamp: string;
  source: 'agri-agent';
}

export interface FinishOutcome {
  success: boolean;
  httpStatus: number | null;
  error: string | null;
  dead: boolean;
  request: CallbackPayload | null;
  response: string | null;
  durationMs: number | null;
}

/** Storage port — implemented with Supabase below, faked in tests. */
export interface MarketplaceStore {
  claim(limit: number): Promise<QueueItem[]>;
  loadContext(item: QueueItem): Promise<CallbackContext | null>;
  finish(id: number, outcome: FinishOutcome): Promise<string | null>;
  release(id: number): Promise<void>;
}

export interface MarketplaceConfig {
  apiUrl: string;
  apiKey: string;
  callbackPath: string;
  timeoutMs: number;
}

export type Outcome = 'success' | 'retry' | 'dead';

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────

export const DEFAULT_CALLBACK_PATH = '/api/integration/order-status';

export const configFromEnv = (get: (key: string) => string | undefined): MarketplaceConfig | null => {
  const apiUrl = (get('MARKETPLACE_API_URL') || '').trim().replace(/\/+$/, '');
  const apiKey = (get('MARKETPLACE_API_KEY') || '').trim();
  if (!apiUrl || !apiKey) return null;
  return {
    apiUrl,
    apiKey,
    callbackPath: get('MARKETPLACE_CALLBACK_PATH') || DEFAULT_CALLBACK_PATH,
    timeoutMs: Number(get('MARKETPLACE_TIMEOUT_MS')) || 10000,
  };
};

// ─────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────

const TERMINAL_FAILURES = ['CANCELLED', 'FAILED_DELIVERY', 'RETURNED'];

const toNumber = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
};

const toIso = (v: unknown): string | undefined => {
  if (typeof v !== 'string' || !v.trim()) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

/** Internal / technical descriptions that should not reach buyers. */
const GENERIC_DESCRIPTION =
  /^(driver transitioned to|status (changed|updated) to|assigned to partner|assigned vehicle|driver assigned for pickup)/i;

export const friendlyMessage = (
  eventType: string | null,
  description: string | null,
  ctx: Pick<CallbackContext, 'partner' | 'vehicle'>,
): string => {
  const cleaned = (description || '').replace(/\n?\[Photo Proof attached\]/gi, '').trim();
  if (cleaned && !GENERIC_DESCRIPTION.test(cleaned)) return cleaned.slice(0, 300);

  const driver = ctx.partner?.name?.trim();
  const vehicleNumber = ctx.vehicle?.vehicle_number || ctx.partner?.vehicle_number;
  const vehicleType = ctx.vehicle?.vehicle_type || ctx.partner?.vehicle_type;

  switch ((eventType || '').toUpperCase()) {
    case 'ASSIGNED':
    case 'PICKUP_ASSIGNED':
      return driver ? `${driver} has been assigned to pick up your order.` : 'A delivery partner has been assigned.';
    case 'VEHICLE_ASSIGNED':
      return vehicleNumber
        ? `Vehicle ${vehicleNumber}${vehicleType ? ` (${vehicleType})` : ''} assigned for your delivery.`
        : 'A vehicle has been assigned for your delivery.';
    case 'ACCEPTED':
      return 'The delivery partner accepted the pickup.';
    case 'DRIVER_EN_ROUTE':
      return 'The driver is on the way to the farm.';
    case 'ARRIVED_AT_FARM':
      return 'The driver has arrived at the farm for pickup.';
    case 'PICKED_UP':
      return 'Your order has been picked up from the farm.';
    case 'IN_TRANSIT':
      return 'Your order is in transit.';
    case 'ARRIVED_AT_DESTINATION':
    case 'NEAR_DESTINATION':
      return 'The driver has reached your area.';
    case 'OUT_FOR_DELIVERY':
      return 'Your order is out for delivery.';
    case 'DELIVERED':
      return 'Your order has been delivered.';
    case 'CANCELLED':
      return 'The delivery was cancelled by the logistics partner.';
    case 'FAILED_DELIVERY':
      return 'Delivery attempt failed.';
    case 'RETURNED':
      return 'The order is being returned.';
    default:
      return `Delivery update: ${(eventType || 'UPDATE').replace(/_/g, ' ').toLowerCase()}`;
  }
};

export const buildCallbackPayload = (item: QueueItem, ctx: CallbackContext): CallbackPayload => {
  const timestamp = toIso(item.occurred_at) || new Date().toISOString();
  const payload: CallbackPayload = {
    externalOrderId: item.external_order_id,
    trackingEvents: [],
    timestamp,
    source: 'agri-agent',
  };

  if (item.kind === 'STATUS' && item.logistics_status) {
    payload.logisticsStatus = item.logistics_status.toUpperCase();
  }
  if (ctx.order.tracking_id) payload.trackingId = ctx.order.tracking_id;

  // Driver + vehicle (Phase 8)
  if (ctx.partner) {
    payload.driver = {
      id: ctx.partner.id,
      name: ctx.partner.name || '',
      phone: ctx.partner.phone || '',
    };
  }
  if (ctx.vehicle?.vehicle_number) {
    payload.vehicle = {
      id: ctx.vehicle.id,
      number: ctx.vehicle.vehicle_number,
      type: ctx.vehicle.vehicle_type || '',
    };
  } else if (ctx.partner?.vehicle_number) {
    payload.vehicle = { number: ctx.partner.vehicle_number, type: ctx.partner.vehicle_type || '' };
  }

  // Latest GPS (Phase 9): newest driver_locations row, else the event's own point
  const locLat = toNumber(ctx.location?.latitude) ?? toNumber(item.latitude);
  const locLng = toNumber(ctx.location?.longitude) ?? toNumber(item.longitude);
  if (locLat !== undefined && locLng !== undefined) {
    payload.currentLocation = {
      latitude: locLat,
      longitude: locLng,
      updatedAt: toIso(ctx.location?.recorded_at) || timestamp,
    };
  }

  // Audit event (Phase 10) — location pings carry no event
  if (item.kind !== 'LOCATION') {
    const status = (item.event_type || item.logistics_status || 'UPDATE').toUpperCase();
    const evLat = toNumber(item.latitude);
    const evLng = toNumber(item.longitude);
    payload.trackingEvents.push({
      status,
      message: friendlyMessage(item.event_type || item.logistics_status, item.message, ctx),
      timestamp,
      ...(evLat !== undefined && evLng !== undefined ? { latitude: evLat, longitude: evLng } : {}),
    });
  }

  const eta = toIso(ctx.delivery?.eta ?? undefined);
  if (eta) payload.eta = eta;

  if (payload.logisticsStatus && TERMINAL_FAILURES.includes(payload.logisticsStatus)) {
    const reason = (item.message || ctx.order.cancellation_reason || '').trim();
    if (reason) payload.reason = reason.slice(0, 300);
  }

  return payload;
};

/** 2xx → done; 400/404/410/422 → the marketplace will never accept it; else retry. */
export const classifyResponse = (status: number | null): Outcome => {
  if (status !== null && status >= 200 && status < 300) return 'success';
  if (status !== null && [400, 404, 410, 422].includes(status)) return 'dead';
  return 'retry';
};

// ─────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────

export interface ProcessSummary {
  configured: boolean;
  claimed: number;
  sent: number;
  failed: number;
  dead: number;
  deferred: number;
}

export class MarketplaceCallbackService {
  constructor(
    private readonly config: MarketplaceConfig,
    private readonly store: MarketplaceStore,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(payload: CallbackPayload): Promise<{ status: number | null; body: string | null; error: string | null; durationMs: number }> {
    const started = Date.now();
    try {
      const res = await this.fetchImpl(`${this.config.apiUrl}${this.config.callbackPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-api-key': this.config.apiKey,
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
      const body = await res.text().catch(() => '');
      return {
        status: res.status,
        body,
        error: res.ok ? null : `HTTP ${res.status}: ${body.slice(0, 300) || res.statusText}`,
        durationMs: Date.now() - started,
      };
    } catch (err) {
      const e = err as Error;
      return {
        status: null,
        body: null,
        error: e?.name === 'TimeoutError' ? 'Marketplace request timed out' : e?.message || 'Network error',
        durationMs: Date.now() - started,
      };
    }
  }

  async processQueue(limit = 25): Promise<ProcessSummary> {
    const summary: ProcessSummary = { configured: true, claimed: 0, sent: 0, failed: 0, dead: 0, deferred: 0 };
    const items = await this.store.claim(limit);
    summary.claimed = items.length;

    const blockedOrders = new Set<string>();

    for (const item of items) {
      // Keep per-order ordering: once one callback for an order fails,
      // the rest of that order's callbacks wait for the next run.
      if (blockedOrders.has(item.order_id)) {
        await this.store.release(item.id);
        summary.deferred++;
        continue;
      }

      let ctx: CallbackContext | null = null;
      try {
        ctx = await this.store.loadContext(item);
      } catch (err) {
        const message = (err as Error)?.message || 'Failed to load delivery context';
        await this.store.finish(item.id, { success: false, httpStatus: null, error: message, dead: false, request: null, response: null, durationMs: null });
        blockedOrders.add(item.order_id);
        summary.failed++;
        continue;
      }

      if (!ctx) {
        await this.store.finish(item.id, { success: false, httpStatus: null, error: 'Order no longer exists', dead: true, request: null, response: null, durationMs: null });
        summary.dead++;
        continue;
      }

      const payload = buildCallbackPayload(item, ctx);
      const res = await this.send(payload);
      const outcome = classifyResponse(res.status);

      const finalStatus = await this.store.finish(item.id, {
        success: outcome === 'success',
        httpStatus: res.status,
        error: res.error,
        dead: outcome === 'dead',
        request: payload,
        response: res.body,
        durationMs: res.durationMs,
      });

      if (outcome === 'success') {
        summary.sent++;
      } else {
        blockedOrders.add(item.order_id);
        if (finalStatus === 'DEAD') summary.dead++;
        else summary.failed++;
      }
    }

    return summary;
  }
}

// ─────────────────────────────────────────────
// Supabase-backed store (service role)
// ─────────────────────────────────────────────

// Minimal structural type so this file doesn't depend on a supabase-js version.
// deno-lint-ignore no-explicit-any
type SupabaseLike = { rpc: (fn: string, args?: any) => any; from: (table: string) => any };

export const createSupabaseStore = (db: SupabaseLike): MarketplaceStore => ({
  async claim(limit) {
    const { data, error } = await db.rpc('claim_marketplace_callbacks', { p_limit: limit });
    if (error) throw new Error(`claim_marketplace_callbacks: ${error.message}`);
    return (data || []) as QueueItem[];
  },

  async loadContext(item) {
    const { data: order, error: orderErr } = await db
      .from('orders')
      .select('id, external_order_id, logistics_status, tracking_id, cancellation_reason')
      .eq('id', item.order_id)
      .maybeSingle();
    if (orderErr) throw new Error(`orders: ${orderErr.message}`);
    if (!order) return null;

    const deliverySelect =
      'id, eta, created_at, delivery_partner_id, vehicle_id, ' +
      'delivery_partners ( id, name, phone, vehicle_number, vehicle_type ), ' +
      'vehicles ( id, vehicle_number, vehicle_type )';

    let deliveryQuery = db.from('deliveries').select(deliverySelect);
    deliveryQuery = item.delivery_id
      ? deliveryQuery.eq('id', item.delivery_id)
      : deliveryQuery.eq('order_id', item.order_id).order('created_at', { ascending: false }).limit(1);
    const { data: delivery, error: delErr } = await deliveryQuery.maybeSingle();
    if (delErr) throw new Error(`deliveries: ${delErr.message}`);

    let location = null;
    if (delivery) {
      const { data: byDelivery } = await db
        .from('driver_locations')
        .select('latitude, longitude, recorded_at')
        .eq('delivery_id', delivery.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      location = byDelivery;

      if (!location && delivery.delivery_partner_id) {
        let q = db
          .from('driver_locations')
          .select('latitude, longitude, recorded_at')
          .eq('delivery_partner_id', delivery.delivery_partner_id);
        if (delivery.created_at) q = q.gte('recorded_at', delivery.created_at);
        const { data: byPartner } = await q.order('recorded_at', { ascending: false }).limit(1).maybeSingle();
        location = byPartner;
      }
    }

    return {
      order,
      delivery: delivery ? { id: delivery.id, eta: delivery.eta, created_at: delivery.created_at } : null,
      partner: delivery?.delivery_partners ?? null,
      vehicle: delivery?.vehicles ?? null,
      location,
    };
  },

  async finish(id, o) {
    const { data, error } = await db.rpc('finish_marketplace_callback', {
      p_id: id,
      p_success: o.success,
      p_http_status: o.httpStatus,
      p_error: o.error,
      p_dead: o.dead,
      p_request: o.request,
      p_response: o.response,
      p_duration_ms: o.durationMs,
    });
    if (error) throw new Error(`finish_marketplace_callback: ${error.message}`);
    return (data as string) ?? null;
  },

  async release(id) {
    const { error } = await db.rpc('release_marketplace_callback', { p_id: id });
    if (error) throw new Error(`release_marketplace_callback: ${error.message}`);
  },
});
