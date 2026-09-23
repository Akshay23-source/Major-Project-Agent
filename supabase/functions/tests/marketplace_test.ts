/**
 * Unit tests for the marketplace integration Edge Function logic.
 *   deno test --allow-net supabase/functions/tests/
 * No Supabase project or network access to the marketplace needed.
 */
import {
  buildCallbackPayload,
  CallbackContext,
  classifyResponse,
  configFromEnv,
  FinishOutcome,
  friendlyMessage,
  MarketplaceCallbackService,
  MarketplaceStore,
  QueueItem,
} from '../_shared/marketplaceCallbackService.ts';
import { isUuid, validateIntakePayload, verifyApiKey } from '../_shared/marketplaceIntake.ts';

// deno-lint-ignore no-explicit-any
const eq = (actual: any, expected: any, msg = '') => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg}\n  expected: ${e}\n  actual:   ${a}`);
};
const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(msg);
};

// Exactly what Farm Marketplace's buildAgriAgentPayload() sends (logistics fields only)
const marketplaceOrder = {
  externalOrderId: '665f1c2b9a1e4b0012345678',
  orderNumber: 'ORD-LX2K9P-7QF3',
  orderStatus: 'pending',
  farmerName: 'Ramesh Gowda',
  farmerPhone: '9123456780',
  pickupAddress: 'Survey No. 42, Hunsur Road, Mysuru',
  buyerName: 'Asha Rao',
  buyerPhone: '9876543210',
  shippingAddress: { address: '12 MG Road', city: 'Mysuru', state: 'Karnataka', pincode: '570001', country: 'India' },
  products: [{ name: 'Tomato', category: 'vegetables', quantity: 5, unit: 'kg' }],
  estimatedDelivery: '2026-09-28T10:00:00.000Z',
  priority: 'HIGH',
  notes: 'Call before arriving',
};

// ── Intake validation ──────────────────────────────────────────
Deno.test('intake: accepts the Farm Marketplace payload as-is', () => {
  eq(validateIntakePayload(marketplaceOrder), { ok: true, errors: [] });
});

Deno.test('intake: accepts nested buyer/farmer objects', () => {
  const { buyerName: _b, farmerName: _f, pickupAddress: _p, ...rest } = marketplaceOrder;
  const nested = { ...rest, buyer: { name: 'A', phone: '1' }, farmer: { name: 'R', address: 'Hunsur Road, Mysuru' } };
  eq(validateIntakePayload(nested).ok, true);
});

Deno.test('intake: older senders with extra business fields are tolerated (ignored), pickup address required', () => {
  const legacy = { ...marketplaceOrder, buyerId: 'b1', farmerId: 'f1', totalAmount: 150, paymentStatus: 'paid' };
  eq(validateIntakePayload(legacy).ok, true, 'extra fields do not break intake');
  const { pickupAddress: _p, ...noPickup } = marketplaceOrder;
  ok(validateIntakePayload(noPickup).errors.some((e) => e.startsWith('pickup address')), 'pickup required');
});

Deno.test('intake: rejects bad payloads with clear errors', () => {
  eq(validateIntakePayload(null).ok, false);
  eq(validateIntakePayload([]).ok, false);
  const r = validateIntakePayload({ ...marketplaceOrder, externalOrderId: '', products: [], shippingAddress: {} });
  ok(r.errors.includes('externalOrderId is required'), 'missing id');
  ok(r.errors.includes('products must be a non-empty array'), 'empty products');
  ok(r.errors.some((e) => e.startsWith('shippingAddress')), 'address');
  ok(!validateIntakePayload({ ...marketplaceOrder, externalOrderId: "x'; drop table orders;--" }).ok, 'bad chars');
  ok(!validateIntakePayload({ ...marketplaceOrder, priority: 'ASAP' }).ok, 'priority');
  ok(!validateIntakePayload({ ...marketplaceOrder, estimatedDelivery: 'tomorrow' }).ok, 'date');
});

Deno.test('intake: uuid check for MARKETPLACE_DEFAULT_AGENT_ID', () => {
  ok(isUuid('11111111-0000-0000-0000-000000000001'), 'uuid');
  ok(!isUuid('agent-1'), 'not uuid');
});

// ── API key (Phase 13) ─────────────────────────────────────────
Deno.test('security: API key via x-api-key or Bearer, constant-time', async () => {
  const key = 'k'.repeat(64);
  ok(await verifyApiKey(new Headers({ 'x-api-key': key }), key), 'x-api-key');
  ok(await verifyApiKey(new Headers({ Authorization: `Bearer ${key}` }), key), 'bearer');
  ok(!(await verifyApiKey(new Headers({ 'x-api-key': 'wrong' }), key)), 'wrong key');
  ok(!(await verifyApiKey(new Headers(), key)), 'missing key');
  ok(!(await verifyApiKey(new Headers({ 'x-api-key': '' }), '')), 'unset expected key never matches');
});

// ── Payload building (Phases 7–10) ─────────────────────────────
const ctx: CallbackContext = {
  order: { id: 'o1', external_order_id: '665f1c2b9a1e4b0012345678', logistics_status: 'PICKUP_ASSIGNED', tracking_id: 'AGRI-ABC', cancellation_reason: null },
  delivery: { id: 'd1', eta: '2026-09-24T12:30:00Z' },
  partner: { id: 'p1', name: 'Manjunath K', phone: '9845012345', vehicle_number: 'KA-01-XX-0000', vehicle_type: 'Bike' },
  vehicle: { id: 'v1', vehicle_number: 'KA-09-AB-1234', vehicle_type: 'Tata Ace' },
  location: { latitude: '12.3106', longitude: '76.6512', recorded_at: '2026-09-24T10:15:00Z' },
};

const item = (over: Partial<QueueItem>): QueueItem => ({
  id: 1,
  order_id: 'o1',
  agent_id: 'a1',
  external_order_id: '665f1c2b9a1e4b0012345678',
  kind: 'STATUS',
  logistics_status: 'PICKUP_ASSIGNED',
  event_type: 'ASSIGNED',
  message: 'Assigned to partner 22222222-0000',
  latitude: null,
  longitude: null,
  delivery_id: 'd1',
  occurred_at: '2026-09-24T09:00:00Z',
  attempts: 0,
  ...over,
});

Deno.test('payload: STATUS carries driver, vehicle, GPS, event, ETA (spec shape)', () => {
  const p = buildCallbackPayload(item({}), ctx);
  eq(p.externalOrderId, '665f1c2b9a1e4b0012345678');
  eq(p.logisticsStatus, 'PICKUP_ASSIGNED');
  eq(p.driver, { id: 'p1', name: 'Manjunath K', phone: '9845012345' });
  eq(p.vehicle, { id: 'v1', number: 'KA-09-AB-1234', type: 'Tata Ace' }, 'assigned vehicle wins over partner default');
  eq(p.currentLocation, { latitude: 12.3106, longitude: 76.6512, updatedAt: '2026-09-24T10:15:00.000Z' });
  eq(p.trackingEvents.length, 1);
  eq(p.trackingEvents[0].message, 'Manjunath K has been assigned to pick up your order.', 'internal uuid text hidden');
  eq(p.eta, '2026-09-24T12:30:00.000Z');
  eq(p.timestamp, '2026-09-24T09:00:00.000Z');
  eq(p.trackingId, 'AGRI-ABC');
  ok(!('reason' in p), 'no reason on non-failure');
});

Deno.test('payload: EVENT has no logisticsStatus, keeps event type', () => {
  const p = buildCallbackPayload(item({ kind: 'EVENT', logistics_status: null, event_type: 'ARRIVED_AT_FARM', message: 'Driver transitioned to ARRIVED_AT_FARM', latitude: '12.29', longitude: 76.63 }), ctx);
  ok(!('logisticsStatus' in p), 'no status');
  eq(p.trackingEvents[0], { status: 'ARRIVED_AT_FARM', message: 'The driver has arrived at the farm for pickup.', timestamp: '2026-09-24T09:00:00.000Z', latitude: 12.29, longitude: 76.63 });
});

Deno.test('payload: LOCATION sends only coordinates', () => {
  const p = buildCallbackPayload(item({ kind: 'LOCATION', logistics_status: null, event_type: 'LOCATION_UPDATE', latitude: 1, longitude: 2 }), { ...ctx, location: null });
  eq(p.trackingEvents, []);
  eq(p.currentLocation?.latitude, 1);
});

Deno.test('payload: failure statuses include the reason; human descriptions pass through', () => {
  const p = buildCallbackPayload(item({ logistics_status: 'FAILED_DELIVERY', event_type: 'FAILED_DELIVERY', message: 'Buyer not reachable after 3 attempts' }), ctx);
  eq(p.reason, 'Buyer not reachable after 3 attempts');
  eq(p.trackingEvents[0].message, 'Buyer not reachable after 3 attempts');
  eq(friendlyMessage('PICKED_UP', 'Crates loaded\n[Photo Proof attached]', {}), 'Crates loaded');
  eq(friendlyMessage('SOMETHING_NEW', null, {}), 'Delivery update: something new');
});

Deno.test('payload: no driver/vehicle before assignment', () => {
  const p = buildCallbackPayload(item({ kind: 'EVENT', logistics_status: null, event_type: 'ORDER_ACCEPTED', message: 'Order accepted by the logistics partner.' }), { order: ctx.order });
  ok(!p.driver && !p.vehicle && !p.currentLocation, 'nothing invented');
});

Deno.test('classifyResponse', () => {
  eq([200, 201, 400, 401, 404, 422, 429, 500, 503, null].map(classifyResponse),
    ['success', 'success', 'dead', 'retry', 'dead', 'dead', 'retry', 'retry', 'retry', 'retry']);
});

Deno.test('config: requires URL + key, strips trailing slash', () => {
  eq(configFromEnv(() => undefined), null);
  const env: Record<string, string> = { MARKETPLACE_API_URL: 'https://api.farm.example/', MARKETPLACE_API_KEY: 'k' };
  eq(configFromEnv((k) => env[k]), { apiUrl: 'https://api.farm.example', apiKey: 'k', callbackPath: '/api/integration/order-status', timeoutMs: 10000 });
});

// ── Worker against a fake marketplace HTTP server ──────────────
Deno.test('worker: sends in order, retries, dead-letters, keeps per-order ordering', async () => {
  const received: Array<{ key: string | null; body: Record<string, unknown> }> = [];
  const server = Deno.serve({ port: 0, onListen: () => {} }, async (req) => {
    const body = await req.json();
    received.push({ key: req.headers.get('x-api-key'), body });
    if (body.externalOrderId === 'ORDER-DOWN') return new Response('{"message":"db down"}', { status: 503 });
    if (body.externalOrderId === 'ORDER-GONE') return new Response('{"message":"Order not found"}', { status: 404 });
    return Response.json({ success: true });
  });
  const port = (server.addr as Deno.NetAddr).port;

  const queue: QueueItem[] = [
    item({ id: 1, order_id: 'A', external_order_id: 'ORDER-A' }),
    item({ id: 2, order_id: 'B', external_order_id: 'ORDER-DOWN' }),
    item({ id: 3, order_id: 'A', external_order_id: 'ORDER-A', logistics_status: 'PICKED_UP', event_type: 'PICKED_UP' }),
    item({ id: 4, order_id: 'B', external_order_id: 'ORDER-DOWN', logistics_status: 'PICKED_UP' }),
    item({ id: 5, order_id: 'C', external_order_id: 'ORDER-GONE' }),
    item({ id: 6, order_id: 'MISSING', external_order_id: 'ORDER-X' }),
  ];
  const finished: Record<number, FinishOutcome> = {};
  const released: number[] = [];

  const store: MarketplaceStore = {
    claim: () => Promise.resolve(queue),
    loadContext: (it) => Promise.resolve(it.order_id === 'MISSING' ? null : { ...ctx, order: { ...ctx.order, external_order_id: it.external_order_id } }),
    finish: (id, o) => {
      finished[id] = o;
      return Promise.resolve(o.success ? 'SENT' : o.dead ? 'DEAD' : 'FAILED');
    },
    release: (id) => {
      released.push(id);
      return Promise.resolve();
    },
  };

  const svc = new MarketplaceCallbackService(
    { apiUrl: `http://127.0.0.1:${port}`, apiKey: 'secret', callbackPath: '/api/integration/order-status', timeoutMs: 2000 },
    store,
  );
  const summary = await svc.processQueue(25);
  await server.shutdown();

  eq(summary, { configured: true, claimed: 6, sent: 2, failed: 1, dead: 2, deferred: 1 });
  eq(received.map((r) => r.body.externalOrderId), ['ORDER-A', 'ORDER-DOWN', 'ORDER-A', 'ORDER-GONE'], 'item 4 never sent');
  ok(received.every((r) => r.key === 'secret'), 'API key sent');
  eq(released, [4], 'order B later item deferred, not failed');
  eq(finished[2].httpStatus, 503);
  ok(finished[2].error?.includes('db down'), 'error body logged');
  eq(finished[5].dead, true, '404 → dead');
  eq(finished[6].error, 'Order no longer exists');
  eq((finished[1].request as { logisticsStatus?: string }).logisticsStatus, 'PICKUP_ASSIGNED', 'request logged');
});

Deno.test('worker: network failure / timeout → retry', async () => {
  const store: MarketplaceStore = {
    claim: () => Promise.resolve([item({})]),
    loadContext: () => Promise.resolve(ctx),
    finish: (_id, o) => {
      eq(o.success, false);
      eq(o.dead, false);
      eq(o.httpStatus, null);
      return Promise.resolve('FAILED');
    },
    release: () => Promise.resolve(),
  };
  const svc = new MarketplaceCallbackService(
    { apiUrl: 'http://127.0.0.1:9', apiKey: 'k', callbackPath: '/x', timeoutMs: 1000 },
    store,
  );
  eq((await svc.processQueue()).failed, 1);
});
