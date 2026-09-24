/** Everything the agent (operator) app calls. All routes require an agent JWT. */
const { Router } = require('express');
const { requireAgent } = require('../middleware/auth');
const agent = require('../controllers/agentController');
const fleet = require('../controllers/fleetController');
const logistics = require('../controllers/logisticsController');
const marketplace = require('../controllers/marketplaceController');
const biz = require('../controllers/businessController');
const misc = require('../controllers/miscController');

const r = Router();
r.use(requireAgent);

// Profile
r.get('/agent/me', agent.getMe);
r.patch('/agent/me', agent.updateMe);

// Fleet
r.get('/drivers', fleet.listDrivers);
r.post('/drivers', fleet.createDriver);
r.patch('/drivers/:id', fleet.updateDriver);
r.get('/vehicles', fleet.listVehicles);
r.post('/vehicles', fleet.createVehicle);
r.patch('/vehicles/:id', fleet.updateVehicle);

// Logistics
r.get('/logistics/dashboard', logistics.dashboard);
r.get('/logistics/orders/:id', logistics.orderDispatchView);
r.post('/logistics/orders/:id/dispatch', logistics.dispatch);
r.post('/logistics/orders/:id/status', logistics.setOrderStatus);
r.get('/deliveries', logistics.listDeliveries);
r.post('/deliveries', logistics.createDelivery);
r.get('/deliveries/by-order/:orderId', logistics.deliveryByOrder);
r.get('/deliveries/:id', logistics.getDelivery);
r.patch('/deliveries/:id', logistics.updateDelivery);
r.post('/deliveries/:id/employee-status', logistics.setEmployeeStatus);
r.post('/deliveries/:id/employee', logistics.assignEmployee);
r.post('/deliveries/:id/partner', logistics.assignPartner);
r.post('/deliveries/:id/vehicle', logistics.assignVehicle);
r.post('/deliveries/:id/status', logistics.setDeliveryLogisticsStatus);
r.get('/deliveries/:id/events', logistics.timeline);
r.post('/deliveries/:id/events', logistics.addEvent);
r.get('/employees/:employeeId/deliveries', logistics.employeeDeliveries);
r.post('/pickups', logistics.createPickup);

// Tracking (polled by the live map)
r.get('/tracking/locations', logistics.locations);
r.get('/tracking/drivers/:driverId/latest', logistics.driverLatest);
r.get('/tracking/deliveries/:deliveryId/latest', logistics.deliveryLatest);
r.get('/tracking/deliveries/:deliveryId/points', logistics.deliveryTrack);

// Marketplace delivery jobs
r.get('/marketplace/orders', marketplace.list);
r.get('/marketplace/metrics', marketplace.metrics);
r.post('/marketplace/orders/:id/accept', marketplace.accept);
r.post('/marketplace/orders/:id/reject', marketplace.reject);
r.post('/marketplace/orders/:id/fail', marketplace.fail);
r.post('/marketplace/orders/:id/return', marketplace.returned);
r.post('/marketplace/orders/:id/sync/retry', marketplace.retrySync);
r.get('/marketplace/orders/:id/sync/logs', marketplace.syncLogs);
r.post('/marketplace/sync/run', marketplace.runSync);

// Agent-owned business data
const crud = (path, h) => {
  r.get(path, h.list);
  r.post(path, h.create);
  r.get(`${path}/:id`, h.get);
  r.patch(`${path}/:id`, h.update);
  r.delete(`${path}/:id`, h.remove);
};
crud('/farmers', biz.farmers);
r.get('/farmers/:id/financial-stats', biz.farmers.financialStats);
crud('/buyers', biz.buyers);
r.get('/buyers/:id/orders', biz.buyers.orders);
crud('/employees', biz.employees);

r.get('/products', biz.products.list);
r.post('/products', biz.products.create);
r.get('/products/:id', biz.products.get);
r.patch('/products/:id', biz.products.update);
r.get('/products/:id/inventory', biz.products.history);
r.post('/products/:id/stock', biz.products.stock);

r.get('/orders', biz.orders.list);
r.post('/orders', biz.orders.create);
r.get('/orders/without-delivery', biz.orders.withoutDelivery);
r.get('/orders/:id', biz.orders.get);
r.post('/orders/:id/status', biz.orders.setStatus);

r.get('/payments', biz.finance.payments);
r.get('/payments/by-order/:orderId', biz.finance.paymentByOrder);
r.get('/payments/:id', biz.finance.payment);
r.patch('/payments/:id', biz.finance.updatePayment);
r.get('/settlements', biz.finance.settlements);
r.get('/settlements/by-order/:orderId', biz.finance.settlementByOrder);
r.get('/settlements/:id', biz.finance.settlement);
r.post('/settlements/:id/pay', biz.finance.paySettlement);
r.get('/commissions', biz.finance.commissions);
r.patch('/commissions/:id', biz.finance.updateCommission);

// Notifications
r.get('/notifications', misc.notifications.list);
r.get('/notifications/unread-count', misc.notifications.unreadCount);
r.post('/notifications', misc.notifications.create);
r.post('/notifications/read-all', misc.notifications.markAllRead);
r.post('/notifications/:id/read', misc.notifications.markRead);
r.delete('/notifications/:id', misc.notifications.remove);
r.delete('/notifications', misc.notifications.clear);

// Analytics
r.get('/analytics/kpis', misc.analytics.kpis);
r.get('/analytics/order-trend', misc.analytics.orderTrend);
r.get('/analytics/top-products', misc.analytics.topProducts);
r.get('/analytics/top-farmers', misc.analytics.topFarmers);
r.get('/analytics/top-buyers', misc.analytics.topBuyers);
r.get('/analytics/employee-performance', misc.analytics.employeePerformance);
r.get('/analytics/inventory', misc.analytics.inventory);
r.get('/analytics/order-status-summary', misc.analytics.orderStatusSummary);

// AI assistant
r.post('/ai/chat', misc.ai.chat);
r.post('/ai/transcribe', misc.ai.transcribe);

module.exports = r;
