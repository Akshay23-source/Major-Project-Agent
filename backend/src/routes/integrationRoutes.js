/** Server-to-server endpoints called by the Farm Marketplace backend. */
const { Router } = require('express');
const { requireMarketplaceKey } = require('../middleware/auth');
const marketplace = require('../controllers/marketplaceController');

const r = Router();
// Contract: docs/MARKETPLACE_INTEGRATION.md (unchanged from the previous intake endpoint).
r.post('/marketplace/orders', requireMarketplaceKey, marketplace.ingest);
module.exports = r;
