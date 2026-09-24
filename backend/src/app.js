const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const env = require('./config/env');
const { isConnected } = require('./config/db');
const { errorHandler, notFoundRoute } = require('./middleware/errorHandler');

const createApp = () => {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  const origins = env.corsOrigins === '*' ? '*' : env.corsOrigins.split(',').map((o) => o.trim());
  app.use(cors({ origin: origins, allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'] }));
  // 12 MB so a short voice clip (base64) fits; everything else is tiny.
  app.use(express.json({ limit: '12mb' }));
  if (!env.isTest) app.use(morgan(env.isProduction ? 'combined' : 'dev'));

  app.get('/api/health', (_req, res) => {
    const db = isConnected();
    res.status(db ? 200 : 503).json({ status: db ? 'ok' : 'degraded', database: db ? 'connected' : 'disconnected', time: new Date().toISOString() });
  });

  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/api/integrations', require('./routes/integrationRoutes'));
  app.use('/api/driver', require('./routes/driverRoutes'));
  app.use('/api', require('./routes/agentRoutes'));

  app.use(notFoundRoute);
  app.use(errorHandler);
  return app;
};

module.exports = { createApp };
