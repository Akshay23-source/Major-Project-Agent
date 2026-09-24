const mongoose = require('mongoose');

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    if (details) this.details = details;
  }
}

const badRequest = (msg, details) => new HttpError(400, msg, details);
const unauthorized = (msg = 'Unauthorized') => new HttpError(401, msg);
const forbidden = (msg = 'Forbidden') => new HttpError(403, msg);
const notFound = (msg = 'Not found') => new HttpError(404, msg);
const conflict = (msg) => new HttpError(409, msg);

const isObjectId = (v) => typeof v === 'string' && mongoose.isValidObjectId(v) && /^[a-f0-9]{24}$/i.test(v);

/** Throws 400/404 unless `id` is a valid ObjectId string. */
const requireId = (id, what = 'id') => {
  if (!isObjectId(id)) throw notFound(`${what} not found`);
  return id;
};

/**
 * Validate `data` against a zod schema, throwing a 400 with field errors.
 */
const parse = (schema, data) => {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    const details = result.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`);
    throw badRequest('Invalid request', details);
  }
  return result.data;
};

module.exports = { HttpError, badRequest, unauthorized, forbidden, notFound, conflict, isObjectId, requireId, parse };
