/**
 * Agent + driver accounts (JWT, bcrypt).
 *   agents:  email + password
 *   drivers: phone + password; the agent registers the driver first, then the
 *            driver activates the account by setting a password (replaces
 *            the link_driver_account RPC).
 */
const bcrypt = require('bcryptjs');
const { Agent, Driver, Counter } = require('../models');
const { signToken } = require('../middleware/auth');
const { badRequest, unauthorized, conflict, notFound } = require('../utils/http');

const BCRYPT_ROUNDS = 12;
const hash = (pw) => bcrypt.hash(pw, BCRYPT_ROUNDS);

// Timing-equalizer for unknown accounts
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 4);

/** Indian mobile numbers are stored as their last 10 digits. */
const normalizePhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
};

const agentSession = (agent) => ({
  token: signToken({ id: agent._id, role: 'agent', agentId: agent._id }),
  role: 'agent',
  user: { id: String(agent._id), email: agent.email, name: agent.name, role: 'agent' },
});

const driverSession = (driver) => ({
  token: signToken({ id: driver._id, role: 'driver', agentId: driver.agent_id }),
  role: 'driver',
  user: { id: String(driver._id), phone: driver.phone, name: driver.name, role: 'driver' },
});

const signupAgent = async ({ name, email, password, phone }) => {
  const normalized = email.trim().toLowerCase();
  if (await Agent.exists({ email: normalized })) throw conflict('An account with this email already exists');
  const code = await Counter.next('agent_code');
  const agent = await Agent.create({
    name: name.trim(),
    email: normalized,
    password_hash: await hash(password),
    phone: phone ? normalizePhone(phone) : undefined,
    agent_code: `AG-${String(code).padStart(3, '0')}`,
    assigned_area: 'Not set',
  });
  return agentSession(agent);
};

const loginAgent = async ({ email, password }) => {
  const agent = await Agent.findOne({ email: email.trim().toLowerCase() }).select('+password_hash');
  const ok = await bcrypt.compare(password, agent?.password_hash || DUMMY_HASH);
  if (!agent || !ok) throw unauthorized('Invalid email or password');
  agent.last_login_at = new Date();
  await agent.save();
  return agentSession(agent);
};

/** First-time driver sign-in: the phone must already be registered by an agent. */
const activateDriver = async ({ phone, password }) => {
  const driver = await Driver.findOne({ phone: normalizePhone(phone) }).select('+password_hash');
  if (!driver) throw notFound('No delivery partner is registered with this number. Ask your agent to add you.');
  if (driver.password_hash) throw conflict('This account is already activated. Sign in with your password.');
  driver.password_hash = await hash(password);
  driver.status = 'ONLINE';
  driver.last_active_at = new Date();
  await driver.save();
  return driverSession(driver);
};

const loginDriver = async ({ phone, password }) => {
  const driver = await Driver.findOne({ phone: normalizePhone(phone) }).select('+password_hash');
  if (driver && !driver.password_hash) throw unauthorized('Account not activated yet. Use "First time? Activate" to set your password.');
  const ok = await bcrypt.compare(password, driver?.password_hash || DUMMY_HASH);
  if (!driver || !ok) throw unauthorized('Invalid phone number or password');
  driver.last_active_at = new Date();
  await driver.save();
  return driverSession(driver);
};

const changePassword = async (user, { current_password, new_password }) => {
  const Model = user.role === 'driver' ? Driver : Agent;
  const account = await Model.findById(user.id).select('+password_hash');
  if (!account) throw unauthorized();
  if (!(await bcrypt.compare(current_password, account.password_hash || DUMMY_HASH))) throw badRequest('Current password is incorrect');
  account.password_hash = await hash(new_password);
  await account.save();
};

module.exports = { signupAgent, loginAgent, activateDriver, loginDriver, changePassword, normalizePhone };
