const { z } = require('zod');
const verificationService = require('../services/verificationService');
const { parse } = require('../utils/http');

const verificationSchema = z.object({
  customerId: z.string().max(100).optional(),
  delivered: z.boolean({ required_error: 'Delivered confirmation is required' }),
  quality: z.boolean({ required_error: 'Quality confirmation is required' }),
  security: z.boolean({ required_error: 'Security confirmation is required' }),
  rating: z.number().int().min(1).max(5, 'Rating must be between 1 and 5'),
  comments: z.string().max(1000).optional(),
});

const submitVerification = async (req, res) => {
  const data = parse(verificationSchema, req.body);
  const result = await verificationService.verifyOrder(req.params.id, data);
  res.status(200).json(result);
};

const getVerificationStatus = async (req, res) => {
  const result = await verificationService.getVerification(req.params.id);
  res.status(200).json(result);
};

module.exports = { submitVerification, getVerificationStatus };

