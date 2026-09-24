const mongoose = require('mongoose');

const notFoundRoute = (req, res) => res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}` });

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details;

  if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = 'Invalid data';
    details = Object.values(err.errors).map((e) => `${e.path}: ${e.message}`);
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid ${err.path}`;
  } else if (err && err.code === 11000) {
    status = 409;
    message = `Duplicate value for ${Object.keys(err.keyValue || err.keyPattern || {}).join(', ') || 'a unique field'}`;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Body must be valid JSON';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Payload too large';
  }

  if (status >= 500 && status !== 503) {
    console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
    if (process.env.NODE_ENV === 'production') message = 'Internal server error';
  }

  res.status(status).json({ success: false, message, ...(details ? { errors: details } : {}) });
};

module.exports = { errorHandler, notFoundRoute };
