/** Agent-side logistics: dispatch, status, deliveries, timeline, tracking, dashboard. */
const { z } = require('zod');
const deliveryService = require('../services/deliveryService');
const records = require('../services/deliveryRecordService');
const orders = require('../services/orderService');
const tracking = require('../services/trackingService');
const dashboardService = require('../services/dashboardService');
const { Order } = require('../models');
const { parse, requireId, isObjectId, badRequest } = require('../utils/http');
const { serialize } = require('../utils/serialize');

const idStr = z.string().refine(isObjectId, 'Invalid id');

const dispatchSchema = z.object({
  delivery_partner_id: idStr,
  vehicle_id: idStr.optional().nullable(),
  pickup_location: z.string().max(500).optional(),
  drop_location: z.string().max(500).optional(),
  eta: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});
const statusSchema = z.object({ status: z.enum(Order.LOGISTICS_STATUSES), reason: z.string().max(500).optional() });
const createDeliverySchema = z.object({
  order_id: idStr,
  employee_id: idStr.optional().nullable(),
  status: z.string().max(40).optional(),
  eta: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
  pickup_location: z.string().max(500).optional(),
  drop_location: z.string().max(500).optional(),
});
const updateDeliverySchema = z.object({
  eta: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  pickup_location: z.string().max(500).optional(),
  drop_location: z.string().max(500).optional(),
  distance: z.number().nonnegative().optional(),
  estimated_time: z.number().nonnegative().optional(),
});
const employeeStatus = z.object({ status: z.enum(['Pending', 'Assigned', 'Picked Up', 'In Transit', 'Delivered', 'Cancelled']) });
const eventSchema = z.object({
  event_type: z.string().min(1).max(60),
  description: z.string().max(1000).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});
const pickupSchema = z.object({
  order_id: idStr,
  farmer_id: idStr.optional().nullable(),
  delivery_partner_id: idStr.optional().nullable(),
  vehicle_id: idStr.optional().nullable(),
  expected_time: z.string().optional(),
});

const agent = (req) => req.user.agentId;

module.exports = {
  dashboard: async (req, res) => res.json(await dashboardService.dashboard(agent(req))),

  // Orders → dispatch
  orderDispatchView: async (req, res) => res.json(await orders.dispatchView(agent(req), requireId(req.params.id))),
  dispatch: async (req, res) => {
    const d = await deliveryService.dispatchOrder(agent(req), requireId(req.params.id), parse(dispatchSchema, req.body));
    res.status(201).json(serialize(d.toObject()));
  },
  setOrderStatus: async (req, res) => {
    const { status, reason } = parse(statusSchema, req.body);
    res.json(serialize((await deliveryService.setOrderLogisticsStatus(agent(req), requireId(req.params.id), status, { reason })).toObject()));
  },

  // Deliveries
  listDeliveries: async (req, res) => res.json(await records.list(agent(req))),
  getDelivery: async (req, res) => res.json(await records.get(agent(req), requireId(req.params.id))),
  deliveryByOrder: async (req, res) => res.json(serialize(await records.byOrder(agent(req), requireId(req.params.orderId)))),
  employeeDeliveries: async (req, res) => res.json(await records.byEmployee(agent(req), requireId(req.params.employeeId))),
  createDelivery: async (req, res) => res.status(201).json(serialize(await records.create(agent(req), parse(createDeliverySchema, req.body)))),
  updateDelivery: async (req, res) => res.json(serialize(await records.update(agent(req), requireId(req.params.id), parse(updateDeliverySchema, req.body)))),
  setEmployeeStatus: async (req, res) =>
    res.json(serialize(await records.setEmployeeStatus(agent(req), requireId(req.params.id), parse(employeeStatus, req.body).status))),
  assignEmployee: async (req, res) => {
    const { employee_id } = parse(z.object({ employee_id: idStr }), req.body);
    res.json(serialize(await records.assignEmployee(agent(req), requireId(req.params.id), employee_id)));
  },
  assignPartner: async (req, res) => {
    const { delivery_partner_id } = parse(z.object({ delivery_partner_id: idStr }), req.body);
    res.json(serialize(await records.assignPartner(agent(req), requireId(req.params.id), delivery_partner_id)));
  },
  assignVehicle: async (req, res) => {
    const { vehicle_id } = parse(z.object({ vehicle_id: idStr }), req.body);
    res.json(serialize(await records.assignVehicle(agent(req), requireId(req.params.id), vehicle_id)));
  },
  setDeliveryLogisticsStatus: async (req, res) => {
    const { status } = parse(z.object({ status: z.enum(Order.LOGISTICS_STATUSES) }), req.body);
    res.json(serialize(await records.setLogisticsStatus(agent(req), requireId(req.params.id), status)));
  },
  addEvent: async (req, res) => res.status(201).json(serialize((await records.addEvent(agent(req), requireId(req.params.id), parse(eventSchema, req.body))).toObject())),
  timeline: async (req, res) => res.json(serialize(await records.timeline(agent(req), requireId(req.params.id)))),
  createPickup: async (req, res) => res.status(201).json(serialize(await records.createPickup(agent(req), parse(pickupSchema, req.body)))),

  // Tracking (the app polls these for live positions)
  locations: async (req, res) => res.json(serialize(await tracking.agentLocations(agent(req), { since: req.query.since }))),
  driverLatest: async (req, res) => res.json(serialize(await tracking.latestForDriver(agent(req), requireId(req.params.driverId)))),
  deliveryLatest: async (req, res) => res.json(serialize(await tracking.latestForDelivery(agent(req), requireId(req.params.deliveryId)))),
  deliveryTrack: async (req, res) => {
    if (req.query.since && Number.isNaN(new Date(req.query.since).getTime())) throw badRequest('since must be an ISO date');
    res.json(serialize(await tracking.deliveryPointsSince(agent(req), requireId(req.params.deliveryId), req.query.since)));
  },
};
