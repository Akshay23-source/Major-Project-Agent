/** Server-to-server endpoints called by the Farm Marketplace backend. */
const { Router } = require('express');
const { requireMarketplaceKey } = require('../middleware/auth');
const marketplace = require('../controllers/marketplaceController');
const verification = require('../controllers/verificationController');

const r = Router();
// Contract: docs/MARKETPLACE_INTEGRATION.md (unchanged from the previous intake endpoint).
r.post('/marketplace/orders', requireMarketplaceKey, marketplace.ingest);
r.post('/orders', requireMarketplaceKey, marketplace.ingest);
r.get('/marketplace/orders', requireMarketplaceKey, marketplace.list);
r.get('/orders', requireMarketplaceKey, marketplace.list);
r.post('/marketplace/orders/:id/verify', requireMarketplaceKey, verification.submitVerification);
r.get('/marketplace/orders/:id/verification', requireMarketplaceKey, verification.getVerificationStatus);
module.exports = r;
