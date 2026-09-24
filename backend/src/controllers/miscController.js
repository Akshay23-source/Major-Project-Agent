/** Notifications, analytics, AI assistant. */
const { z } = require('zod');
const notifications = require('../services/notificationService');
const analytics = require('../services/analyticsService');
const ai = require('../services/aiService');
const { Notification } = require('../models');
const { parse, requireId } = require('../utils/http');
const { serialize } = require('../utils/serialize');

const createSchema = z.object({
  type: z.string().min(1).max(255),
  title: z.string().min(1).max(255),
  message: z.string().min(1).max(2000),
  related_id: z.string().max(64).optional(),
  related_type: z.enum(Notification.RELATED_TYPES).optional(),
});

const period = (req) => (analytics.PERIODS.includes(String(req.query.period)) ? String(req.query.period) : '30');
const a = (req) => req.user.agentId;

module.exports = {
  notifications: {
    list: async (req, res) => res.json(serialize(await notifications.list(a(req)))),
    unreadCount: async (req, res) => res.json({ count: await notifications.unreadCount(a(req)) }),
    create: async (req, res) => {
      const doc = await notifications.notify(a(req), parse(createSchema, req.body));
      res.status(doc ? 201 : 200).json(doc ? serialize(doc.toObject()) : { skipped: true });
    },
    markRead: async (req, res) => {
      await notifications.markRead(a(req), requireId(req.params.id));
      res.status(204).end();
    },
    markAllRead: async (req, res) => {
      await notifications.markAllRead(a(req));
      res.status(204).end();
    },
    remove: async (req, res) => {
      await notifications.remove(a(req), requireId(req.params.id));
      res.status(204).end();
    },
    clear: async (req, res) => {
      await notifications.clear(a(req));
      res.status(204).end();
    },
  },

  analytics: {
    kpis: async (req, res) => res.json(await analytics.kpis(a(req), period(req))),
    orderTrend: async (req, res) => res.json(await analytics.orderTrend(a(req), period(req))),
    topProducts: async (req, res) => res.json(await analytics.topProducts(a(req), period(req))),
    topFarmers: async (req, res) => res.json(await analytics.topFarmers(a(req), period(req))),
    topBuyers: async (req, res) => res.json(await analytics.topBuyers(a(req), period(req))),
    employeePerformance: async (req, res) => res.json(await analytics.employeePerformance(a(req), period(req))),
    inventory: async (req, res) => res.json(await analytics.inventory(a(req))),
    orderStatusSummary: async (req, res) => res.json(await analytics.orderStatusSummary(a(req))),
  },

  ai: {
    chat: async (req, res) => res.json(await ai.chat(a(req), req.body?.messages)),
    transcribe: async (req, res) => res.json(await ai.transcribe(req.body?.audioData)),
  },
};
