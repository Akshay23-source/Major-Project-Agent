/** Auth, agent isolation and the agent-owned business endpoints. */
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { connect, disconnect, signupAgent } = require('./helpers');
const { createApp } = require('../src/app');
const { Product, InventoryHistory, Payment, Commission, FarmerSettlement, Notification, Agent } = require('../src/models');

const app = createApp();
let a1;
let a2;
const auth = (s) => ({ Authorization: `Bearer ${s.token}` });

beforeAll(async () => {
  await connect('api');
  a1 = await signupAgent(app, 'one@test.local', 'Agent One');
  a2 = await signupAgent(app, 'two@test.local', 'Agent Two');
});
afterAll(disconnect);

describe('auth', () => {
  test('signup validation + duplicate email', async () => {
    expect((await request(app).post('/api/auth/agent/signup').send({ name: 'X', email: 'bad', password: 'password123' })).status).toBe(400);
    expect((await request(app).post('/api/auth/agent/signup').send({ name: 'X', email: 'x@test.local', password: 'short' })).status).toBe(400);
    expect((await request(app).post('/api/auth/agent/signup').send({ name: 'X', email: 'ONE@test.local', password: 'password123' })).status).toBe(409);
  });

  test('passwords are hashed, never returned', async () => {
    const stored = await Agent.findOne({ email: 'one@test.local' }).select('+password_hash').lean();
    expect(stored.password_hash).toMatch(/^\$2[aby]\$12\$/);
    const me = await request(app).get('/api/auth/me').set(auth(a1));
    expect(me.body.role).toBe('agent');
    expect(me.body.profile.email).toBe('one@test.local');
    expect(me.body.profile.password_hash).toBeUndefined();
    expect(me.body.profile.agent_code).toMatch(/^AG-\d{3}$/);
  });

  test('login: wrong password / unknown email / success', async () => {
    expect((await request(app).post('/api/auth/agent/login').send({ email: 'one@test.local', password: 'nope-nope' })).status).toBe(401);
    expect((await request(app).post('/api/auth/agent/login').send({ email: 'ghost@test.local', password: 'password123' })).status).toBe(401);
    const ok = await request(app).post('/api/auth/agent/login').send({ email: 'One@Test.local', password: 'password123' });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();
  });

  test('tokens: missing, forged, expired', async () => {
    expect((await request(app).get('/api/orders')).status).toBe(401);
    const forged = jwt.sign({ role: 'agent', agent_id: a1.user.id }, 'wrong-secret', { subject: a1.user.id });
    expect((await request(app).get('/api/orders').set('Authorization', `Bearer ${forged}`)).status).toBe(401);
    const expired = jwt.sign({ role: 'agent', agent_id: a1.user.id }, process.env.JWT_SECRET, { subject: a1.user.id, expiresIn: -10 });
    expect((await request(app).get('/api/orders').set('Authorization', `Bearer ${expired}`)).status).toBe(401);
  });

  test('change password', async () => {
    const s = await signupAgent(app, 'pw@test.local', 'Pw');
    expect((await request(app).post('/api/auth/password').set(auth(s)).send({ current_password: 'wrong-one', new_password: 'newpassword1' })).status).toBe(400);
    expect((await request(app).post('/api/auth/password').set(auth(s)).send({ current_password: 'password123', new_password: 'newpassword1' })).status).toBe(200);
    expect((await request(app).post('/api/auth/agent/login').send({ email: 'pw@test.local', password: 'newpassword1' })).status).toBe(200);
  });

  test('driver: must be registered by an agent before activating', async () => {
    expect((await request(app).post('/api/auth/driver/activate').send({ phone: '9111111111', password: 'driverpass1' })).status).toBe(404);
    await request(app).post('/api/drivers').set(auth(a1)).send({ name: 'D1', phone: '9111111111' });
    expect((await request(app).post('/api/auth/driver/login').send({ phone: '9111111111', password: 'driverpass1' })).status).toBe(401);
    const act = await request(app).post('/api/auth/driver/activate').send({ phone: '9111111111', password: 'driverpass1' });
    expect(act.status).toBe(201);
    const me = await request(app).get('/api/driver/me').set(auth(act.body));
    expect(me.body).toMatchObject({ name: 'D1', status: 'ONLINE' });
    const st = await request(app).patch('/api/driver/me/status').set(auth(act.body)).send({ status: 'OFFLINE' });
    expect(st.body.status).toBe('OFFLINE');
    expect((await request(app).patch('/api/driver/me/status').set(auth(act.body)).send({ status: 'FLYING' })).status).toBe(400);
  });

  test('profile update is whitelisted', async () => {
    const res = await request(app).patch('/api/agent/me').set(auth(a1)).send({ business_name: 'Mysuru Agri', email: 'hijack@test.local', role: 'SUPER' });
    expect(res.status).toBe(200);
    expect(res.body.business_name).toBe('Mysuru Agri');
    expect(res.body.email).toBe('one@test.local');
  });
});

describe('agent-owned registries are isolated per agent', () => {
  let farmerId;
  test('farmers CRUD', async () => {
    const f = await request(app).post('/api/farmers').set(auth(a1)).send({ name: 'Ramu', phone: '9000000001', village: 'Hunsur', district: 'Mysuru', agent_id: a2.user.id });
    expect(f.status).toBe(201);
    farmerId = f.body.id;
    expect(f.body.agent_id).toBe(a1.user.id); // agent_id can't be spoofed
    expect((await request(app).get('/api/farmers').set(auth(a1))).body).toHaveLength(1);
    expect((await request(app).get('/api/farmers').set(auth(a2))).body).toHaveLength(0);
    expect((await request(app).get(`/api/farmers/${farmerId}`).set(auth(a2))).status).toBe(404);
    expect((await request(app).patch(`/api/farmers/${farmerId}`).set(auth(a2)).send({ name: 'X' })).status).toBe(404);
    expect((await request(app).delete(`/api/farmers/${farmerId}`).set(auth(a2))).status).toBe(404);
    const up = await request(app).patch(`/api/farmers/${farmerId}`).set(auth(a1)).send({ verification_status: 'Verified' });
    expect(up.body.verification_status).toBe('Verified');
    expect((await request(app).post('/api/farmers').set(auth(a1)).send({ name: 'No village' })).status).toBe(400);
    expect((await request(app).get('/api/farmers/not-an-id').set(auth(a1))).status).toBe(404);
  });

  test('employees get sequential ids per agent', async () => {
    const e1 = await request(app).post('/api/employees').set(auth(a1)).send({ name: 'E1', phone: '9000000011' });
    const e2 = await request(app).post('/api/employees').set(auth(a1)).send({ name: 'E2', phone: '9000000012' });
    expect([e1.body.employee_id, e2.body.employee_id]).toEqual(['EMP-001', 'EMP-002']);
  });

  test('products, stock, orders, finance', async () => {
    const buyer = await request(app).post('/api/buyers').set(auth(a1)).send({ name: 'Hotel Sagar', phone: '9000000021', city: 'Mysuru' });
    expect(buyer.status).toBe(201);

    // a2 cannot create a product for a1's farmer
    expect((await request(app).post('/api/products').set(auth(a2)).send({ farmer_id: farmerId, name: 'Rice', category: 'Grains', quantity: 10, price: 40 })).status).toBe(400);

    const p = await request(app).post('/api/products').set(auth(a1)).send({ farmer_id: farmerId, name: 'Rice', category: 'Grains', quantity: 100, unit: 'kg', price: 40 });
    expect(p.status).toBe(201);
    expect(await InventoryHistory.countDocuments({ product_id: p.body.id })).toBe(1);

    const list = await request(app).get('/api/products').set(auth(a1));
    expect(list.body[0].farmers).toMatchObject({ name: 'Ramu', village: 'Hunsur' });

    const order = await request(app)
      .post('/api/orders')
      .set(auth(a1))
      .send({ farmer_id: farmerId, buyer_id: buyer.body.id, product_id: p.body.id, product: 'Rice', quantity: 90, unit: 'kg', price: 40, subtotal: 3600, commission: 180, delivery_charge: 100, total_amount: 3700 });
    expect(order.status).toBe(201);
    expect((await Product.findById(p.body.id).lean()).quantity).toBe(10);
    expect(await Notification.exists({ related_id: p.body.id, type: 'Low Stock' })).toBeTruthy();
    expect(await Payment.countDocuments({ order_id: order.body.id })).toBe(1);
    expect((await Commission.findOne({ order_id: order.body.id }).lean()).rate).toBe(5);
    expect((await FarmerSettlement.findOne({ order_id: order.body.id }).lean()).net_amount).toBe(3600 - 180);

    const orders = await request(app).get('/api/orders').set(auth(a1));
    expect(orders.body[0]).toMatchObject({ order_number: 'ORD-001', farmers: { name: 'Ramu' }, buyers: { name: 'Hotel Sagar' } });
    expect((await request(app).get('/api/orders').set(auth(a2))).body).toHaveLength(0);

    // Remove more than in stock → rejected, no negative stock
    expect((await request(app).post(`/api/products/${p.body.id}/stock`).set(auth(a1)).send({ quantity_change: 11, action: 'Remove', reason: 'x' })).status).toBe(400);
    const set = await request(app).post(`/api/products/${p.body.id}/stock`).set(auth(a1)).send({ quantity_change: 0, action: 'Set', reason: 'count' });
    expect(set.body).toMatchObject({ quantity: 0, status: 'Out of Stock' });

    // Cancelling restores stock
    const cancel = await request(app).post(`/api/orders/${order.body.id}/status`).set(auth(a1)).send({ status: 'Cancelled', cancellation_reason: 'Buyer cancelled' });
    expect(cancel.body.status).toBe('Cancelled');
    const restored = await Product.findById(p.body.id).lean();
    expect(restored.quantity).toBe(90);
    expect(restored.status).toBe('Active');
    expect((await request(app).get(`/api/products/${p.body.id}/inventory`).set(auth(a1))).body.length).toBe(4);

    // Finance screens
    const payments = await request(app).get('/api/payments').set(auth(a1));
    expect(payments.body[0].orders).toMatchObject({ order_number: 'ORD-001', buyers: { name: 'Hotel Sagar' } });
    const pay = await request(app).patch(`/api/payments/${payments.body[0].id}`).set(auth(a1)).send({ status: 'Completed', payment_method: 'UPI', transaction_reference: 'UTR1' });
    expect(pay.body.paid_at).toBeTruthy();
    expect((await request(app).get(`/api/payments/${payments.body[0].id}`).set(auth(a2))).status).toBe(404);

    const settlements = await request(app).get('/api/settlements').set(auth(a1));
    expect(settlements.body[0].farmers.name).toBe('Ramu');
    const paid = await request(app).post(`/api/settlements/${settlements.body[0].id}/pay`).set(auth(a1)).send({ payment_method: 'Bank', transaction_reference: 'NEFT1' });
    expect(paid.body.status).toBe('Paid');
    const stats = await request(app).get(`/api/farmers/${farmerId}/financial-stats`).set(auth(a1));
    expect(stats.body).toEqual({ totalSales: 3420, totalPaid: 3420, outstanding: 0 });

    const comm = await request(app).get('/api/commissions').set(auth(a1));
    expect(comm.body[0].orders.order_number).toBe('ORD-001');
    expect((await request(app).patch(`/api/commissions/${comm.body[0].id}`).set(auth(a1)).send({ status: 'Earned' })).body.status).toBe('Earned');

    // Employee-run delivery flow
    const d = await request(app).post('/api/deliveries').set(auth(a1)).send({ order_id: order.body.id, status: 'Pending', eta: 'Tomorrow' });
    expect(d.status).toBe(201);
    expect(d.body.delivery_number).toMatch(/^DLV-\d{4}$/);
    const again = await request(app).post('/api/deliveries').set(auth(a1)).send({ order_id: order.body.id });
    expect(again.body.id).toBe(d.body.id); // duplicate-protected
    const st = await request(app).post(`/api/deliveries/${d.body.id}/employee-status`).set(auth(a1)).send({ status: 'Delivered' });
    expect(st.body.delivery_time).toBeTruthy();
    const dl = await request(app).get('/api/deliveries').set(auth(a1));
    expect(dl.body[0].orders).toMatchObject({ product: 'Rice', farmers: { name: 'Ramu' }, buyers: { name: 'Hotel Sagar' } });
    expect((await request(app).get(`/api/deliveries/by-order/${order.body.id}`).set(auth(a1))).body.id).toBe(d.body.id);
    expect((await request(app).get('/api/orders/without-delivery').set(auth(a1))).body).toHaveLength(0);
  });
});

describe('notifications, analytics, misc', () => {
  test('notifications', async () => {
    const list = await request(app).get('/api/notifications').set(auth(a1));
    expect(list.body.length).toBeGreaterThan(0);
    const unread = await request(app).get('/api/notifications/unread-count').set(auth(a1));
    expect(unread.body.count).toBe(list.body.length);
    expect((await request(app).post(`/api/notifications/${list.body[0].id}/read`).set(auth(a1))).status).toBe(204);
    expect((await request(app).get('/api/notifications/unread-count').set(auth(a1))).body.count).toBe(list.body.length - 1);
    await request(app).post('/api/notifications/read-all').set(auth(a1));
    expect((await request(app).get('/api/notifications/unread-count').set(auth(a1))).body.count).toBe(0);
    expect((await request(app).get('/api/notifications').set(auth(a2))).body).toHaveLength(0);
    await request(app).delete('/api/notifications').set(auth(a1));
    expect((await request(app).get('/api/notifications').set(auth(a1))).body).toHaveLength(0);
  });

  test('analytics', async () => {
    const k = await request(app).get('/api/analytics/kpis?period=30').set(auth(a1));
    expect(k.body).toMatchObject({ totalOrders: 1, activeFarmers: 1, activeBuyers: 1, amountCollected: 3700, farmerSettlements: 3420 });
    expect((await request(app).get('/api/analytics/kpis?period=30').set(auth(a2))).body.totalOrders).toBe(0);
    for (const path of ['order-trend', 'top-products', 'top-farmers', 'top-buyers', 'employee-performance', 'inventory', 'order-status-summary']) {
      expect((await request(app).get(`/api/analytics/${path}?period=all`).set(auth(a1))).status).toBe(200);
    }
    const tf = await request(app).get('/api/analytics/top-farmers?period=all').set(auth(a1));
    expect(tf.body[0]).toMatchObject({ name: 'Ramu', orderCount: 1 });
  });

  test('AI endpoints report missing configuration instead of crashing', async () => {
    expect((await request(app).post('/api/ai/chat').set(auth(a1)).send({ messages: [{ role: 'user', content: 'hi' }] })).status).toBe(503);
  });

  test('unknown route → 404 JSON; health reports the DB', async () => {
    const h = await request(app).get('/api/health');
    expect(h.body.database).toBe('connected');
    expect((await request(app).get('/api/nope').set(auth(a1))).status).toBe(404);
  });
});
