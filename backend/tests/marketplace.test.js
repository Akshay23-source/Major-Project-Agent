/**
 * Behaviour tests for the Marketplace integration (numbered scenarios 1–15).
 */
const request = require('supertest');
const { connect, disconnect, fakeMarketplace, signupAgent, samplePayload } = require('./helpers');
const env = require('../src/config/env');
const { createApp } = require('../src/app');
const sync = require('../src/services/syncService');
const deliveryService = require('../src/services/deliveryService');
const { Order, SyncJob, SyncLog, DeliveryJob, DeliveryEvent, Driver, Vehicle, Pickup, Farmer, Buyer, Product, Payment, Notification } = require('../src/models');

const app = createApp();
const KEY = { 'x-api-key': 'test-marketplace-key' };
let market;
let agent;
let otherAgent;
let driverToken;
let orderId;
let deliveryId;
let driverId;
let vehicleId;

const auth = (s) => ({ Authorization: `Bearer ${s.token}` });
const queue = () => SyncJob.find().sort({ seq: 1 }).lean();

beforeAll(async () => {
  await connect('marketplace');
  market = await fakeMarketplace();
  env.marketplace.apiUrl = market.url;
  sync.setAutoKick(false);
  agent = await signupAgent(app, 'agent@test.local', 'Agent One');
  otherAgent = await signupAgent(app, 'other@test.local', 'Agent Two');
});

afterAll(async () => {
  await market.close();
  await disconnect();
});

describe('1. intake security', () => {
  test('rejects missing / wrong API key, and app users cannot call intake', async () => {
    expect((await request(app).post('/api/integrations/marketplace/orders').send(samplePayload())).status).toBe(401);
    expect((await request(app).post('/api/integrations/marketplace/orders').set('x-api-key', 'wrong').send(samplePayload())).status).toBe(401);
    expect((await request(app).post('/api/integrations/marketplace/orders').set(auth(agent)).send(samplePayload())).status).toBe(401);
    expect(await Order.countDocuments()).toBe(0);
  });

  test('accepts Authorization: Bearer <key> as well', async () => {
    const res = await request(app).post('/api/integrations/marketplace/orders').set('Authorization', 'Bearer test-marketplace-key').send({});
    expect(res.status).toBe(400); // authenticated, then validated
  });
});

describe('2. intake stores ONLY the logistics copy, no callback loop', () => {
  test('creates a logistics-only job', async () => {
    const res = await request(app).post('/api/integrations/marketplace/orders').set(KEY).send(samplePayload({ notes: 'Call before arriving' }));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, action: 'created', orderNumber: 'ORD-LX2K9P-7QF3', logisticsStatus: 'PENDING', deliveryProvider: 'agri-agent' });
    expect(res.body.trackingId).toMatch(/^AGRI-/);
    orderId = res.body.logisticsOrderId;

    const o = await Order.findById(orderId).lean();
    expect(o).toMatchObject({
      source: 'MARKETPLACE',
      logistics_status: 'PENDING',
      marketplace_intake_status: 'NEW',
      external_order_id: '665f1c2b9a1e4b0012345678',
      priority: 'HIGH',
      is_perishable: true,
      quantity: 7,
      unit: 'kg',
      pickup_address: 'Survey No. 42, Hunsur Road, Mysuru',
      pickup_contact_name: 'Ramesh Gowda',
      pickup_contact_phone: '9123456780',
      drop_contact_name: 'Asha Rao',
      drop_contact_phone: '9876543210',
      delivery_location: '12 MG Road, Mysuru, Karnataka, 570001',
      notes: 'Call before arriving',
    });
    expect(o.product).toMatch(/^Tomato \(5 kg\), Onion \(2 kg\)/);
    expect(o.drop_address.pincode).toBe('570001');
    expect(o.estimated_delivery.toISOString()).toBe('2026-09-28T10:00:00.000Z');
    expect(String(o.agent_id)).toBe(agent.user.id);
  });

  test('data boundary: nothing marketplace-owned is replicated', async () => {
    const o = await Order.findById(orderId).lean();
    for (const f of ['price', 'total_amount', 'subtotal', 'commission', 'farmer_id', 'buyer_id', 'product_id', 'payment_status', 'paymentStatus', 'escrow']) {
      expect(o[f]).toBeUndefined();
    }
    expect(await Buyer.countDocuments()).toBe(0);
    expect(await Farmer.countDocuments()).toBe(0);
    expect(await Product.countDocuments()).toBe(0);
    expect(await Payment.countDocuments()).toBe(0);
    expect(await Notification.countDocuments({ related_id: orderId })).toBe(1);
    expect(await SyncJob.countDocuments()).toBe(0); // intake never calls the marketplace back
  });
});

describe('3. re-ingest is idempotent', () => {
  test('update, not duplicate; payment status ignored; delivery contact refreshed', async () => {
    const res = await request(app)
      .post('/api/integrations/marketplace/orders')
      .set(KEY)
      .send(samplePayload({ paymentStatus: 'paid', buyerPhone: '9000000001' }));
    expect(res.status).toBe(200);
    expect(res.body.action).toBe('updated');
    expect(await Order.countDocuments({ external_order_id: '665f1c2b9a1e4b0012345678' })).toBe(1);
    expect((await Order.findById(orderId).lean()).drop_contact_phone).toBe('9000000001');
    expect(await Buyer.countDocuments()).toBe(0);
  });

  test('concurrent duplicate deliveries create one order', async () => {
    const p = samplePayload({ externalOrderId: 'RACE-1', orderNumber: 'ORD-RACE' });
    const results = await Promise.all([1, 2, 3, 4].map(() => request(app).post('/api/integrations/marketplace/orders').set(KEY).send(p)));
    expect(results.map((r) => r.status).sort()).toEqual([200, 200, 200, 201]);
    expect(await Order.countDocuments({ external_order_id: 'RACE-1' })).toBe(1);
  });

  test('3b. validation', async () => {
    const res = await request(app).post('/api/integrations/marketplace/orders').set(KEY).send({ orderNumber: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(expect.arrayContaining(['externalOrderId is required', 'products must be a non-empty array', 'shippingAddress is required']));
    expect((await request(app).post('/api/integrations/marketplace/orders').set(KEY).send(samplePayload({ externalOrderId: 'bad id!' }))).status).toBe(400);
    expect((await request(app).post('/api/integrations/marketplace/orders').set(KEY).send(samplePayload({ externalOrderId: 'P1', priority: 'ASAP' }))).status).toBe(400);
  });
});

describe('4. agent accepts → event-only callback', () => {
  test('ORDER_ACCEPTED event, no ACCEPTED status', async () => {
    const res = await request(app).post(`/api/marketplace/orders/${orderId}/accept`).set(auth(agent));
    expect(res.status).toBe(200);
    expect(res.body.marketplace_intake_status).toBe('ACCEPTED');
    const q = await queue();
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ kind: 'EVENT', event_type: 'ORDER_ACCEPTED' });
    expect(q[0].logistics_status).toBeUndefined();
    expect((await Order.findById(orderId).lean()).marketplace_sync_status).toBe('PENDING');
  });

  test('other agent cannot see or act on the order', async () => {
    expect((await request(app).post(`/api/marketplace/orders/${orderId}/accept`).set(auth(otherAgent))).status).toBe(404);
    expect((await request(app).get('/api/marketplace/orders').set(auth(otherAgent))).body).toEqual([]);
    expect((await request(app).get(`/api/orders/${orderId}`).set(auth(otherAgent))).status).toBe(404);
  });
});

describe('5. dispatch → PICKUP_ASSIGNED callback + vehicle event', () => {
  test('agent registers a driver + vehicle, driver activates their account', async () => {
    const d = await request(app).post('/api/drivers').set(auth(agent)).send({ name: 'Manjunath K', phone: '98450 12345', vehicle_number: 'KA-09-AB-1234', vehicle_type: 'Tata Ace' });
    expect(d.status).toBe(201);
    driverId = d.body.id;
    expect(d.body.phone).toBe('9845012345');
    expect(d.body.password_hash).toBeUndefined();

    const v = await request(app).post('/api/vehicles').set(auth(agent)).send({ vehicle_number: 'ka-09-ab-1234', vehicle_type: 'Tata Ace', capacity: 750 });
    expect(v.status).toBe(201);
    vehicleId = v.body.id;
    expect(v.body.vehicle_number).toBe('KA-09-AB-1234');

    const act = await request(app).post('/api/auth/driver/activate').send({ phone: '+91 98450 12345', password: 'driverpass1' });
    expect(act.status).toBe(201);
    driverToken = act.body;
    expect((await request(app).post('/api/auth/driver/activate').send({ phone: '9845012345', password: 'another-pass' })).status).toBe(409);
    expect((await request(app).post('/api/auth/driver/login').send({ phone: '9845012345', password: 'driverpass1' })).status).toBe(200);
  });

  test('dispatch creates the delivery, assigns driver + vehicle, one STATUS + one EVENT callback', async () => {
    const res = await request(app).post(`/api/logistics/orders/${orderId}/dispatch`).set(auth(agent)).send({ delivery_partner_id: driverId, vehicle_id: vehicleId });
    expect(res.status).toBe(201);
    deliveryId = res.body.id;
    expect(res.body).toMatchObject({ status: 'PICKUP_ASSIGNED', logistics_tracking_status: 'ASSIGNED', delivery_partner_id: driverId, vehicle_id: vehicleId });

    expect((await Order.findById(orderId).lean()).logistics_status).toBe('PICKUP_ASSIGNED');
    expect((await Driver.findById(driverId).lean()).status).toBe('BUSY');
    expect((await Vehicle.findById(vehicleId).lean()).availability_status).toBe('ASSIGNED');
    expect(await Pickup.countDocuments({ order_id: orderId })).toBe(1);

    const q = await queue();
    expect(q.filter((j) => j.kind === 'STATUS' && j.logistics_status === 'PICKUP_ASSIGNED')).toHaveLength(1);
    expect(q.filter((j) => j.kind === 'EVENT' && j.event_type === 'VEHICLE_ASSIGNED')).toHaveLength(1);
  });

  test('cannot double-assign; a busy driver cannot be dispatched', async () => {
    expect((await request(app).post(`/api/logistics/orders/${orderId}/dispatch`).set(auth(agent)).send({ delivery_partner_id: driverId })).status).toBe(409);
  });

  test('dispatch view returns order + delivery + timeline', async () => {
    const res = await request(app).get(`/api/logistics/orders/${orderId}`).set(auth(agent));
    expect(res.status).toBe(200);
    expect(res.body.order.id).toBe(orderId);
    expect(res.body.delivery.id).toBe(deliveryId);
    expect(res.body.events.map((e) => e.event_type)).toEqual(['ASSIGNED', 'VEHICLE_ASSIGNED']);
  });
});

describe('6. driver app transitions', () => {
  test('driver cannot see agent endpoints; agent cannot use driver endpoints', async () => {
    expect((await request(app).get('/api/orders').set(auth(driverToken))).status).toBe(403);
    expect((await request(app).get('/api/driver/deliveries').set(auth(agent))).status).toBe(403);
  });

  test('driver sees their delivery with pickup/drop contacts but no money', async () => {
    const res = await request(app).get('/api/driver/deliveries?filter=PENDING').set(auth(driverToken));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    const o = res.body[0].orders;
    expect(o.order_number).toBe('ORD-LX2K9P-7QF3');
    expect(o.farmers).toMatchObject({ name: 'Ramesh Gowda', phone: '9123456780', address: 'Survey No. 42, Hunsur Road, Mysuru' });
    expect(o.buyers).toMatchObject({ name: 'Asha Rao', pincode: '570001' });
    expect(o.total_amount).toBeUndefined();
    expect(res.body[0].vehicles.vehicle_number).toBe('KA-09-AB-1234');
  });

  test('state machine is enforced', async () => {
    const res = await request(app).post(`/api/driver/deliveries/${deliveryId}/transition`).set(auth(driverToken)).send({ status: 'PICKED_UP' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Invalid transition from ASSIGNED to PICKED_UP/);
  });

  test('walk the steps → forward-only order status + expected callback sequence', async () => {
    for (const [status, lat, lng] of [['ACCEPTED', 12.3, 76.65], ['DRIVER_EN_ROUTE', 12.3, 76.65], ['ARRIVED_AT_FARM', 12.29, 76.63], ['PICKED_UP', 12.29, 76.63], ['IN_TRANSIT', 12.31, 76.65]]) {
      const res = await request(app).post(`/api/driver/deliveries/${deliveryId}/transition`).set(auth(driverToken)).send({ status, latitude: lat, longitude: lng });
      expect(res.status).toBe(200);
    }
    // a late duplicate event must not move the order backwards
    const delivery = await DeliveryJob.findById(deliveryId);
    await deliveryService.recordEvent(delivery, { eventType: 'PICKED_UP', description: 'late duplicate', latitude: 12.31, longitude: 76.65 });

    expect((await Order.findById(orderId).lean()).logistics_status).toBe('IN_TRANSIT');
    const seq = (await queue())
      .filter((j) => j.source_event_id && !['ASSIGNED', 'VEHICLE_ASSIGNED'].includes(j.event_type))
      .map((j) => `${j.kind}:${j.logistics_status || j.event_type}`)
      .join(',');
    expect(seq).toBe('STATUS:ACCEPTED,EVENT:DRIVER_EN_ROUTE,EVENT:ARRIVED_AT_FARM,STATUS:PICKED_UP,STATUS:IN_TRANSIT,EVENT:PICKED_UP');
    expect((await DeliveryJob.findById(deliveryId).lean()).pickup_time).toBeTruthy();
  });
});

describe('7. GPS throttled to one callback / minute / order', () => {
  test('3 pings → 1 LOCATION callback; points stored; map sees them', async () => {
    // created_at is immutable through Mongoose; age the queue with the raw driver
    await SyncJob.collection.updateMany({}, { $set: { created_at: new Date(Date.now() - 2 * 60 * 1000) } });
    for (const [lat, lng, withDelivery] of [[12.311, 76.651, true], [12.312, 76.652, true], [12.313, 76.653, false]]) {
      const res = await request(app)
        .post('/api/driver/location')
        .set(auth(driverToken))
        .send({ delivery_id: withDelivery ? deliveryId : null, latitude: lat, longitude: lng, accuracy: 10, speed: 8 });
      expect(res.status).toBe(201);
    }
    expect(await SyncJob.countDocuments({ kind: 'LOCATION' })).toBe(1);

    const inaccurate = await request(app).post('/api/driver/location').set(auth(driverToken)).send({ latitude: 12.4, longitude: 76.7, accuracy: 400 });
    expect(inaccurate.body.stored).toBe(false);

    const all = await request(app).get('/api/tracking/locations').set(auth(agent));
    expect(all.body).toHaveLength(1);
    expect(all.body[0].latitude).toBe(12.313);
    const latest = await request(app).get(`/api/tracking/deliveries/${deliveryId}/latest`).set(auth(agent));
    expect(latest.body.latitude).toBe(12.312);
    expect((await request(app).get('/api/tracking/locations').set(auth(otherAgent))).body).toEqual([]);

    const since = await request(app).get(`/api/tracking/locations?since=${new Date(Date.now() - 60000).toISOString()}`).set(auth(agent));
    expect(since.body).toHaveLength(3);
  });

  test('a driver cannot report against someone else\'s delivery', async () => {
    const res = await request(app).post('/api/driver/location').set(auth(driverToken)).send({ delivery_id: orderId, latitude: 1, longitude: 1 });
    expect(res.status).toBe(400);
  });
});

describe('8. dispatch-screen status update → single callback', () => {
  test('OUT_FOR_DELIVERY from the agent produces exactly one callback', async () => {
    const res = await request(app).post(`/api/logistics/orders/${orderId}/status`).set(auth(agent)).send({ status: 'OUT_FOR_DELIVERY' });
    expect(res.status).toBe(200);
    const q = await queue();
    expect(q.filter((j) => j.event_type === 'OUT_FOR_DELIVERY' || j.logistics_status === 'OUT_FOR_DELIVERY')).toHaveLength(1);
    expect(await DeliveryEvent.countDocuments({ delivery_id: deliveryId, event_type: 'OUT_FOR_DELIVERY' })).toBe(1);
    expect((await DeliveryJob.findById(deliveryId).lean()).status).toBe('OUT_FOR_DELIVERY');
  });
});

describe('9. worker: send, per-order ordering, back-off, dead-letter, logging', () => {
  test('first send fails with 503 → FAILED + back-off; later items for that order wait', async () => {
    const total = await SyncJob.countDocuments();
    market.respondWith(503);
    const summary = await sync.processQueue({ limit: 100 });
    expect(summary.claimed).toBe(total);
    expect(summary.failed).toBe(1);
    expect(summary.sent).toBe(0);
    expect(summary.deferred).toBe(total - 1);

    const [first] = await queue();
    expect(first.status).toBe('FAILED');
    expect(first.attempts).toBe(1);
    expect(first.next_attempt_at.getTime()).toBeGreaterThan(Date.now() + 25000);
    expect(await SyncJob.countDocuments({ status: 'PENDING' })).toBe(total - 1);
    expect((await Order.findById(orderId).lean()).marketplace_sync_status).toBe('FAILED');
    expect(await SyncLog.countDocuments({ success: false })).toBe(1);
  });

  test('payload sent to the marketplace has the agreed shape and the shared key', async () => {
    const call = market.received[0];
    expect(call.path).toBe('/api/integration/order-status');
    expect(call.headers['x-api-key']).toBe('test-marketplace-key');
    expect(call.body).toMatchObject({ externalOrderId: '665f1c2b9a1e4b0012345678', source: 'agri-agent' });
    expect(call.body.trackingEvents[0]).toMatchObject({ status: 'ORDER_ACCEPTED' });
    expect(call.body.trackingId).toMatch(/^AGRI-/);
  });

  test('retry (owner only) → everything is delivered in order', async () => {
    expect((await request(app).post(`/api/marketplace/orders/${orderId}/sync/retry`).set(auth(otherAgent))).status).toBe(404);
    const retry = await request(app).post(`/api/marketplace/orders/${orderId}/sync/retry`).set(auth(agent));
    expect(retry.body.requeued).toBe(1);

    market.received.length = 0;
    const summary = await sync.processQueue({ limit: 100 });
    expect(summary.failed).toBe(0);
    expect(summary.sent).toBe(await SyncJob.countDocuments());
    const order = await Order.findById(orderId).lean();
    expect(order.marketplace_sync_status).toBe('SYNCED');

    const statuses = market.received.map((c) => c.body.logisticsStatus).filter(Boolean);
    expect(statuses).toEqual(['PICKUP_ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY']);
    const withDriver = market.received.find((c) => c.body.logisticsStatus === 'PICKUP_ASSIGNED');
    expect(withDriver.body.driver).toMatchObject({ name: 'Manjunath K', phone: '9845012345' });
    expect(withDriver.body.vehicle).toMatchObject({ number: 'KA-09-AB-1234', type: 'Tata Ace' });
    const loc = market.received.find((c) => c.body.trackingEvents.length === 0);
    expect(loc.body.currentLocation).toMatchObject({ latitude: expect.any(Number), longitude: expect.any(Number) });

    const logs = await request(app).get(`/api/marketplace/orders/${orderId}/sync/logs`).set(auth(agent));
    expect(logs.body.length).toBeGreaterThan(5);
    expect((await request(app).get(`/api/marketplace/orders/${orderId}/sync/logs`).set(auth(otherAgent))).body).toEqual([]);
  });

  test('non-retryable response → DEAD immediately; 10 failures → DEAD', async () => {
    const order = await Order.findById(orderId);
    await sync.enqueue(order, { kind: 'EVENT', event_type: 'NOTE', message: 'x' });
    market.respondWith(422);
    await sync.processQueue();
    expect((await SyncJob.findOne({ event_type: 'NOTE' }).lean()).status).toBe('DEAD');

    await sync.enqueue(order, { kind: 'EVENT', event_type: 'NOTE2', message: 'y' });
    const job = await SyncJob.findOne({ event_type: 'NOTE2' });
    job.attempts = 9;
    await job.save();
    market.respondWith(500);
    await sync.processQueue();
    expect((await SyncJob.findOne({ event_type: 'NOTE2' }).lean()).status).toBe('DEAD');
    await request(app).post(`/api/marketplace/orders/${orderId}/sync/retry`).set(auth(agent));
    expect(await SyncJob.countDocuments({ status: 'PENDING' })).toBe(2);
    await sync.processQueue();
    expect(await SyncJob.countDocuments({ status: { $ne: 'SENT' } })).toBe(0);
  });
});

describe('11. delivery completes', () => {
  test('DELIVERED frees driver + vehicle and queues DELIVERED', async () => {
    for (const status of ['ARRIVED_AT_DESTINATION', 'DELIVERED']) {
      expect((await request(app).post(`/api/driver/deliveries/${deliveryId}/transition`).set(auth(driverToken)).send({ status })).status).toBe(200);
    }
    // order was already OUT_FOR_DELIVERY (agent); DELIVERED advances it
    expect((await Order.findById(orderId).lean()).logistics_status).toBe('DELIVERED');
    expect(await SyncJob.exists({ kind: 'STATUS', logistics_status: 'DELIVERED' })).toBeTruthy();
    const driver = await Driver.findById(driverId).lean();
    expect(driver.status).toBe('ONLINE');
    expect(driver.completed_deliveries).toBe(1);
    expect((await Vehicle.findById(vehicleId).lean()).availability_status).toBe('AVAILABLE');
    expect((await request(app).get('/api/driver/deliveries?filter=COMPLETED').set(auth(driverToken))).body).toHaveLength(1);
  });
});

describe('12. agent reject → CANCELLED with reason', () => {
  test('reject needs a reason and queues CANCELLED + reason', async () => {
    const r = await request(app).post('/api/integrations/marketplace/orders').set(KEY).send(samplePayload({ externalOrderId: 'ORDER-REJECT-1', orderNumber: 'ORD-REJ' }));
    const id = r.body.logisticsOrderId;
    expect((await request(app).post(`/api/marketplace/orders/${id}/reject`).set(auth(agent)).send({ reason: ' ' })).status).toBe(400);
    const res = await request(app).post(`/api/marketplace/orders/${id}/reject`).set(auth(agent)).send({ reason: 'No vehicle available for this route' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ logistics_status: 'CANCELLED', marketplace_intake_status: 'REJECTED', status: 'Cancelled' });
    const job = await SyncJob.findOne({ order_id: id, logistics_status: 'CANCELLED' }).lean();
    expect(job.message).toBe('No vehicle available for this route');

    market.received.length = 0;
    await sync.processQueue();
    const sent = market.received.find((c) => c.body.externalOrderId === 'ORDER-REJECT-1');
    expect(sent.body).toMatchObject({ logisticsStatus: 'CANCELLED', reason: 'No vehicle available for this route' });
  });
});

describe('13. marketplace cancels an order that has a driver', () => {
  test('frees driver/vehicle, cancels pickup + delivery, audited, no echo', async () => {
    const r = await request(app).post('/api/integrations/marketplace/orders').set(KEY).send(samplePayload({ externalOrderId: 'ORDER-CANCEL-1', orderNumber: 'ORD-CXL' }));
    const id = r.body.logisticsOrderId;
    const dispatch = await request(app).post(`/api/logistics/orders/${id}/dispatch`).set(auth(agent)).send({ delivery_partner_id: driverId, vehicle_id: vehicleId });
    expect(dispatch.status).toBe(201);
    const before = await SyncJob.countDocuments();

    const res = await request(app).post('/api/integrations/marketplace/orders').set(KEY).send(samplePayload({ externalOrderId: 'ORDER-CANCEL-1', orderStatus: 'cancelled' }));
    expect(res.body.action).toBe('cancelled');
    expect((await Order.findById(id).lean()).logistics_status).toBe('CANCELLED');
    expect((await DeliveryJob.findById(dispatch.body.id).lean()).status).toBe('CANCELLED');
    expect((await Driver.findById(driverId).lean()).status).toBe('ONLINE');
    expect((await Vehicle.findById(vehicleId).lean()).availability_status).toBe('AVAILABLE');
    expect((await Pickup.findOne({ order_id: id }).lean()).status).toBe('CANCELLED');
    expect(await DeliveryEvent.exists({ delivery_id: dispatch.body.id, event_type: 'CANCELLED', actor_type: 'MARKETPLACE' })).toBeTruthy();
    expect(await SyncJob.countDocuments()).toBe(before);
  });
});

describe('14/15. agent-created orders', () => {
  test('are tracked but never sent to the marketplace, and still require a farmer', async () => {
    const before = await SyncJob.countDocuments();
    const farmer = await request(app).post('/api/farmers').set(auth(agent)).send({ name: 'Local Farmer', phone: '9000000009', village: 'V', district: 'D' });
    expect(farmer.status).toBe(201);

    const noFarmer = await request(app).post('/api/orders').set(auth(agent)).send({ product: 'Rice', quantity: 1, unit: 'kg', price: 1, total_amount: 1 });
    expect(noFarmer.status).toBe(400);

    const order = await request(app).post('/api/orders').set(auth(agent)).send({ farmer_id: farmer.body.id, product: 'Rice', quantity: 10, unit: 'kg', price: 50, total_amount: 500 });
    expect(order.status).toBe(201);
    expect(order.body.order_number).toBe('ORD-001');
    expect(order.body.source).toBe('AGENT');

    const dispatch = await request(app).post(`/api/logistics/orders/${order.body.id}/dispatch`).set(auth(agent)).send({ delivery_partner_id: driverId });
    expect(dispatch.status).toBe(201);
    expect((await Order.findById(order.body.id).lean()).logistics_status).toBe('PICKUP_ASSIGNED');
    expect(await SyncJob.countDocuments()).toBe(before);

    // a raw order without farmer is rejected by the model, too
    await expect(Order.create({ order_number: 'X', agent_id: agent.user.id, product: 'Rice', quantity: 1, unit: 'kg', total_amount: 1 })).rejects.toThrow(/farmer_id is required/);
  });
});

describe('dashboard + marketplace metrics', () => {
  test('counts reflect the scenarios above', async () => {
    const m = await request(app).get('/api/marketplace/metrics').set(auth(agent));
    expect(m.status).toBe(200);
    expect(m.body).toMatchObject({ delivered: 1, syncFailed: 0 });

    const list = await request(app).get('/api/marketplace/orders?filter=DELIVERED').set(auth(agent));
    expect(list.body).toHaveLength(1);
    expect(list.body[0].pickup_address).toBe('Survey No. 42, Hunsur Road, Mysuru');

    const d = await request(app).get('/api/logistics/dashboard').set(auth(agent));
    expect(d.status).toBe(200);
    expect(d.body.kpis).toHaveProperty('availablePartners');
    expect(Array.isArray(d.body.activeOrders)).toBe(true);
  });
});
