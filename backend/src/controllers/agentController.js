const { z } = require('zod');
const { Agent } = require('../models');
const { parse, notFound } = require('../utils/http');
const { serialize } = require('../utils/serialize');

const opt = z.string().trim().max(200).optional().nullable();
const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: opt,
  business_name: opt,
  address: opt,
  city: opt,
  state: opt,
  pincode: opt,
  assigned_area: opt,
  notifications_enabled: z.boolean().optional(),
  theme: z.enum(['System', 'Light', 'Dark']).optional(),
  language: z.string().max(40).optional(),
  voice_enabled: z.boolean().optional(),
  voice_auto_detect: z.boolean().optional(),
});

const getMe = async (req, res) => {
  const agent = await Agent.findById(req.user.id).lean();
  if (!agent) throw notFound('Agent not found');
  res.json(serialize(agent));
};

const updateMe = async (req, res) => {
  const res0 = await Agent.updateOne({ _id: req.user.id }, { $set: parse(updateSchema, req.body) }, { runValidators: true });
  if (!res0.matchedCount) throw notFound('Agent not found');
  const agent = await Agent.findById(req.user.id).lean();
  res.json(serialize(agent));
};

module.exports = { getMe, updateMe };
