const { z } = require('zod');
const intake = require('../services/intakeService');
const mkt = require('../services/marketplaceOrderService');
const sync = require('../services/syncService');
const { parse, requireId } = require('../utils/http');
const { serialize } = require('../utils/serialize');

const reasonSchema = z.object({ reason: z.string().max(500).optional() });
const noteSchema = z.object({ note: z.string().max(500).optional() });

module.exports = {
  // Called by the Farm Marketplace backend (x-api-key)
  ingest: async (req, res) => {
    const b = req.body || {};
    console.log(`[intake] received externalOrderId=${b.externalOrderId} orderNumber=${b.orderNumber} status=${b.orderStatus} products=${Array.isArray(b.products) ? b.products.length : 'none'}`);
    const { status, body } = await intake.ingest(req.body);
    console.log(`[intake] ${body.action} ${body.orderNumber} → ${status} (agri_orders _id=${body.logisticsOrderId}, tracking ${body.trackingId})`);
    res.status(status).json(body);
  },

  // Agent app
  list: async (req, res) => {
    const filter = String(req.query.filter || 'ALL').toUpperCase();
    res.json(serialize(await mkt.list(req.user.agentId, filter)));
  },
  metrics: async (req, res) => {
    const m = await mkt.metrics(req.user.agentId);
    console.log(`[marketplace] metrics agent_id=${req.user.agentId}`, m);
    res.json(m);
  },
  accept: async (req, res) => res.json(serialize((await mkt.accept(req.user.agentId, requireId(req.params.id))).toObject())),
  reject: async (req, res) =>
    res.json(serialize((await mkt.reject(req.user.agentId, requireId(req.params.id), parse(reasonSchema, req.body).reason)).toObject())),
  fail: async (req, res) =>
    res.json(serialize((await mkt.markFailed(req.user.agentId, requireId(req.params.id), parse(reasonSchema, req.body).reason)).toObject())),
  returned: async (req, res) =>
    res.json(serialize((await mkt.markReturned(req.user.agentId, requireId(req.params.id), parse(noteSchema, req.body).note)).toObject())),
  retrySync: async (req, res) => {
    const requeued = await sync.retryOrder(req.user.agentId, requireId(req.params.id));
    if (requeued === null) return res.status(404).json({ success: false, message: 'Order not found' });
    return res.json({ requeued });
  },
  syncLogs: async (req, res) => res.json(serialize(await sync.getLogs(req.user.agentId, requireId(req.params.id), Number(req.query.limit) || 20))),
  runSync: async (_req, res) => {
    sync.kick();
    res.status(202).json({ queued: true });
  },
};
