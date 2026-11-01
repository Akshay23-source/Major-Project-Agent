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

const loginAgent = async ({ email, phone, identifier, password }) => {
  const query = (identifier || email || phone || '').trim();
  const isEmail = query.includes('@');
  const agent = isEmail
    ? await Agent.findOne({ email: query.toLowerCase() }).select('+password_hash')
    : await Agent.findOne({ phone: normalizePhone(query) }).select('+password_hash');
  const ok = await bcrypt.compare(password, agent?.password_hash || DUMMY_HASH);
  if (!agent || !ok) throw unauthorized('Invalid email, mobile number or password');
  agent.last_login_at = new Date();
  await agent.save();
  return agentSession(agent);
};

/** Driver self-registration workflow */
const registerDriver = async ({ name, phone, password, vehicle_type, vehicle_number, license_number, city }) => {
  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone || cleanPhone.length < 10) throw badRequest('Valid 10-digit mobile number required');

  let driver = await Driver.findOne({ phone: cleanPhone }).select('+password_hash');
  if (driver) {
    if (driver.password_hash) {
      throw conflict('An account with this phone number is already registered and activated. Please log in.');
    }
    if (name) driver.name = name.trim();
    if (vehicle_type) driver.vehicle_type = vehicle_type.trim();
    if (vehicle_number) driver.vehicle_number = vehicle_number.trim();
    if (license_number) driver.license_number = license_number.trim();
    if (city) driver.city = city.trim();
    driver.password_hash = await hash(password);
    driver.status = 'ONLINE';
    driver.last_active_at = new Date();
    await driver.save();
    return driverSession(driver);
  }

  let agentId = null;
  const env = require('../config/env');
  if (env.marketplace?.defaultAgentEmail) {
    const ag = await Agent.findOne({ email: env.marketplace.defaultAgentEmail.toLowerCase() });
    if (ag) agentId = ag._id;
  }
  if (!agentId) {
    const firstAgent = await Agent.findOne().sort({ created_at: 1 });
    if (firstAgent) agentId = firstAgent._id;
  }
  if (!agentId) {
    throw badRequest('No administrator/agent account exists to register driver under');
  }

  driver = await Driver.create({
    agent_id: agentId,
    name: name ? name.trim() : `Driver ${cleanPhone.slice(-4)}`,
    phone: cleanPhone,
    password_hash: await hash(password),
    vehicle_type: vehicle_type ? vehicle_type.trim() : undefined,
    vehicle_number: vehicle_number ? vehicle_number.trim() : undefined,
    license_number: license_number ? license_number.trim() : undefined,
    city: city ? city.trim() : undefined,
    status: 'ONLINE',
    last_active_at: new Date(),
  });

  return driverSession(driver);
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

module.exports = { signupAgent, loginAgent, registerDriver, activateDriver, loginDriver, changePassword, normalizePhone };
