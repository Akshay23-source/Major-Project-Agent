const http = require('http');
const mongoose = require('mongoose');
const request = require('supertest');

const BASE_URI = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017';

/** Connect to a throw-away database for one test file. */
const connect = async (name) => {
  require('../src/models');
  await mongoose.connect(`${BASE_URI}/agri_test_${name}`, { serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.dropDatabase();
  for (const model of Object.values(mongoose.models)) {
    try {
      await model.syncIndexes();
    } catch {
      /* unsupported index options on the test server */
    }
  }
};

const disconnect = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
};

/** A fake Farm Marketplace that records callbacks and answers with the next queued status. */
const fakeMarketplace = async () => {
  const received = [];
  const statuses = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      received.push({ path: req.url, headers: req.headers, body: body ? JSON.parse(body) : null });
      const status = statuses.length ? statuses.shift() : 200;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: status < 300 }));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    received,
    respondWith: (...codes) => statuses.push(...codes),
    close: () => new Promise((r) => server.close(r)),
  };
};

const signupAgent = async (app, email = 'agent@test.local', name = 'Agent One') => {
  const res = await request(app).post('/api/auth/agent/signup').send({ name, email, password: 'password123', phone: '9845000000' });
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
};

const samplePayload = (overrides = {}) => ({
  externalOrderId: '665f1c2b9a1e4b0012345678',
  orderNumber: 'ORD-LX2K9P-7QF3',
  buyerId: '665f1a009a1e4b0011111111',
  buyerName: 'Asha Rao',
  buyerPhone: '9876543210',
  farmerId: '665f1a009a1e4b0022222222',
  farmerName: 'Ramesh Gowda',
  farmerPhone: '9123456780',
  pickupAddress: 'Survey No. 42, Hunsur Road, Mysuru',
  products: [
    { productId: 'p1', name: 'Tomato', category: 'vegetables', quantity: 5, unit: 'kg', price: 30 },
    { productId: 'p2', name: 'Onion', category: 'vegetables', quantity: 2, unit: 'kg', price: 40 },
  ],
  totalAmount: 230,
  paymentStatus: 'pending',
  paymentMethod: 'escrow',
  shippingAddress: { address: '12 MG Road', city: 'Mysuru', state: 'Karnataka', pincode: '570001', country: 'India' },
  priority: 'HIGH',
  estimatedDelivery: '2026-09-28T10:00:00Z',
  ...overrides,
});

module.exports = { connect, disconnect, fakeMarketplace, signupAgent, samplePayload };
