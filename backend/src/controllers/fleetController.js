const { z } = require('zod');
const fleet = require('../services/fleetService');
const { Driver } = require('../models');
const { parse, requireId } = require('../utils/http');
const { serialize } = require('../utils/serialize');

const statusList = (v) => (v ? String(v).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : undefined);

const driverCreate = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().regex(/^\+?[\d\s-]{10,15}$/, 'Enter a valid 10-digit mobile number'),
  vehicle_type: z.string().max(60).optional(),
  vehicle_number: z.string().max(20).optional(),
  license_number: z.string().max(40).optional(),
  city: z.string().max(80).optional(),
  state: z.string().max(80).optional(),
  pincode: z.string().max(10).optional(),
});
const driverUpdate = driverCreate.partial().extend({ status: z.enum(Driver.STATUSES).optional() });

const vehicleCreate = z.object({
  vehicle_number: z.string().trim().min(1).max(20),
  vehicle_type: z.string().trim().min(1).max(60),
  capacity: z.number().nonnegative().optional(),
  capacity_unit: z.string().max(10).optional(),
});
const vehicleUpdate = vehicleCreate.partial().extend({ availability_status: z.enum(['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'INACTIVE']).optional() });

module.exports = {
  listDrivers: async (req, res) => res.json(serialize(await fleet.listDrivers(req.user.agentId, { status: statusList(req.query.status) }))),
  createDriver: async (req, res) => res.status(201).json(serialize(await fleet.createDriver(req.user.agentId, parse(driverCreate, req.body)))),
  updateDriver: async (req, res) => res.json(serialize(await fleet.updateDriver(req.user.agentId, requireId(req.params.id), parse(driverUpdate, req.body)))),

  listVehicles: async (req, res) =>
    res.json(serialize(await fleet.listVehicles(req.user.agentId, { availability_status: req.query.availability_status ? String(req.query.availability_status).toUpperCase() : undefined }))),
  createVehicle: async (req, res) => res.status(201).json(serialize(await fleet.createVehicle(req.user.agentId, parse(vehicleCreate, req.body)))),
  updateVehicle: async (req, res) => res.json(serialize(await fleet.updateVehicle(req.user.agentId, requireId(req.params.id), parse(vehicleUpdate, req.body)))),
};
