const { z } = require('zod');
const { Agent, Driver } = require('../models');
const authService = require('../services/authService');
const { parse, notFound } = require('../utils/http');
const { serialize } = require('../utils/serialize');

const password = z.string().min(8, 'Password must be at least 8 characters').max(128);
const phone = z.string().regex(/^\+?[\d\s-]{10,15}$/, 'Enter a valid 10-digit mobile number');

const signupSchema = z.object({ name: z.string().trim().min(1).max(120), email: z.email(), password, phone: phone.optional() });
const loginSchema = z.object({ email: z.email(), password: z.string().min(1) });
const driverSchema = z.object({ phone, password: z.string().min(1) });
const activateSchema = z.object({ phone, password });
const changeSchema = z.object({ current_password: z.string().min(1), new_password: password });

const signup = async (req, res) => res.status(201).json(await authService.signupAgent(parse(signupSchema, req.body)));
const login = async (req, res) => res.json(await authService.loginAgent(parse(loginSchema, req.body)));
const driverLogin = async (req, res) => res.json(await authService.loginDriver(parse(driverSchema, req.body)));
const driverActivate = async (req, res) => res.status(201).json(await authService.activateDriver(parse(activateSchema, req.body)));

const me = async (req, res) => {
  const doc = req.user.role === 'driver' ? await Driver.findById(req.user.id).lean() : await Agent.findById(req.user.id).lean();
  if (!doc) throw notFound('Account not found');
  res.json({ role: req.user.role, profile: serialize(doc) });
};

const changePassword = async (req, res) => {
  await authService.changePassword(req.user, parse(changeSchema, req.body));
  res.json({ success: true });
};

module.exports = { signup, login, driverLogin, driverActivate, me, changePassword };
