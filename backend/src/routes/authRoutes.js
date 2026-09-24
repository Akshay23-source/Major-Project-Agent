const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const c = require('../controllers/authController');
const { requireAnyUser } = require('../middleware/auth');

// Brute-force protection on credential endpoints
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, skip: () => process.env.NODE_ENV === 'test' });

const r = Router();
r.post('/agent/signup', limiter, c.signup);
r.post('/agent/login', limiter, c.login);
r.post('/driver/login', limiter, c.driverLogin);
r.post('/driver/activate', limiter, c.driverActivate);
r.get('/me', requireAnyUser, c.me);
r.post('/password', requireAnyUser, c.changePassword);
module.exports = r;
