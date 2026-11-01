/**
 * Public/customer endpoints for order delivery verification.
 */
const { Router } = require('express');
const verification = require('../controllers/verificationController');

const r = Router();

r.post('/:id/verify', verification.submitVerification);
r.get('/:id/verification', verification.getVerificationStatus);

module.exports = r;

