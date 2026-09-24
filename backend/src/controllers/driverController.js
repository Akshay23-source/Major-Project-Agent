/** Endpoints for the signed-in driver (driver app). */
const { z } = require('zod');
const fleet = require('../services/fleetService');
const driverDeliveries = require('../services/driverDeliveryService');
const deliveryService = require('../services/deliveryService');
const tracking = require('../services/trackingService');
const { Driver } = require('../models');
const { parse, requireId, notFound } = require('../utils/http');
const { serialize } = require('../utils/serialize');
const { DRIVER_STATUSES } = require('../services/logisticsRules');

const statusSchema = z.object({ status: z.enum(['ONLINE', 'OFFLINE', 'BUSY']) });
const transitionSchema = z.object({
  status: z.enum(DRIVER_STATUSES),
  notes: z.string().max(1000).optional(),
  photo_url: z.string().max(2000).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});
const locationSchema = z.object({
  delivery_id: z.string().optional().nullable(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().optional().nullable(),
  speed: z.number().optional().nullable(),
  heading: z.number().optional().nullable(),
  recorded_at: z.string().optional(),
});

const me = async (req, res) => {
  const driver = await fleet.getDriverSelf(req.user.id);
  if (!driver) throw notFound('Driver not found');
  res.json(serialize(driver));
};

const setStatus = async (req, res) => res.json(serialize(await fleet.setDriverStatus(req.user.id, parse(statusSchema, req.body).status)));

const deliveries = async (req, res) => {
  const filter = ['PENDING', 'COMPLETED', 'ALL'].includes(req.query.filter) ? req.query.filter : 'ALL';
  res.json(await driverDeliveries.list(req.user.id, filter));
};

const delivery = async (req, res) => res.json(await driverDeliveries.get(req.user.id, requireId(req.params.id)));

const transition = async (req, res) => {
  const d = await deliveryService.driverTransition(req.user.id, requireId(req.params.id), parse(transitionSchema, req.body));
  res.json(serialize(d.toObject()));
};

const location = async (req, res) => {
  const body = parse(locationSchema, req.body);
  if (body.delivery_id) requireId(body.delivery_id, 'delivery');
  const driver = await Driver.findById(req.user.id).lean();
  if (!driver) throw notFound('Driver not found');
  res.status(201).json(await tracking.recordLocation(driver, body));
};

module.exports = { me, setStatus, deliveries, delivery, transition, location };
