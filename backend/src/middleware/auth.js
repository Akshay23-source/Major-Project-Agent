const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { unauthorized, forbidden } = require('../utils/http');

/**
 * JWT auth. Token payload: { sub, role: 'agent' | 'driver', agent_id }.
 * Sets req.user = { id, role, agentId } — every service query is scoped by agentId.
 */
const signToken = ({ id, role, agentId }) =>
  jwt.sign({ role, agent_id: String(agentId) }, env.jwtSecret, {
    subject: String(id),
    expiresIn: env.jwtExpiresIn,
    algorithm: 'HS256',
  });

const readToken = (req) => {
  const header = req.headers.authorization || '';
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : null;
};

const requireAuth = (...roles) => (req, _res, next) => {
  const token = readToken(req);
  if (!token) return next(unauthorized('Sign in required'));
  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
    req.user = { id: payload.sub, role: payload.role, agentId: payload.agent_id };
  } catch {
    return next(unauthorized('Session expired. Please sign in again.'));
  }
  if (roles.length && !roles.includes(req.user.role)) return next(forbidden());
  return next();
};

const requireAgent = requireAuth('agent');
const requireDriver = requireAuth('driver');
const requireAnyUser = requireAuth('agent', 'driver');

/** Constant-time comparison of the Marketplace's shared API key (x-api-key or Bearer). */
const requireMarketplaceKey = (req, _res, next) => {
  const expected = env.marketplace.apiKey;
  if (!expected) {
    const err = new Error('Marketplace integration is not configured');
    err.status = 503;
    return next(err);
  }
  const auth = req.headers.authorization || '';
  const provided = req.headers['x-api-key'] || (auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '');
  const a = crypto.createHash('sha256').update(String(provided)).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  if (!provided || !crypto.timingSafeEqual(a, b)) {
    console.warn('[integration] rejected marketplace request: invalid or missing API key');
    return next(unauthorized());
  }
  return next();
};

module.exports = { signToken, requireAuth, requireAgent, requireDriver, requireAnyUser, requireMarketplaceKey };
