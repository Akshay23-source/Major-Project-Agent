/** Driver app. All routes require a driver JWT. */
const { Router } = require('express');
const { requireDriver } = require('../middleware/auth');
const c = require('../controllers/driverController');

const r = Router();
r.use(requireDriver);
r.get('/me', c.me);
r.patch('/me/status', c.setStatus);
r.get('/deliveries', c.deliveries);
r.get('/available', c.available);
r.post('/deliveries/:id/accept', c.accept);
r.post('/deliveries/:id/reject', c.reject);
r.post('/orders/:id/accept', c.accept);
r.post('/orders/:id/reject', c.reject);
r.get('/deliveries/:id', c.delivery);
r.post('/deliveries/:id/transition', c.transition);
r.post('/location', c.location);
module.exports = r;
