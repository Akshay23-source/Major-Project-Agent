/**
 * Agent-owned business data: farmers, buyers, employees, products, agent orders,
 * payments, settlements, commissions.
 */
const { z } = require('zod');
const { Farmer, Buyer, Employee, Counter } = require('../models');
const { makeCrud } = require('../services/crudService');
const products = require('../services/productService');
const orders = require('../services/orderService');
const finance = require('../services/financeService');
const { parse, requireId, isObjectId } = require('../utils/http');
const { serialize } = require('../utils/serialize');

const s = (max = 500) => z.string().trim().max(max);
const opt = (max) => s(max).optional().nullable();
const idStr = z.string().refine(isObjectId, 'Invalid id');
const num = z.coerce.number();

// ── Schemas (unknown fields are stripped) ─────
const farmerSchema = z.object({
  name: s(120).min(1),
  phone: s(20).min(1),
  email: opt(200),
  address: opt(),
  village: s(120).min(1),
  district: s(120).min(1),
  state: opt(80),
  pincode: opt(10),
  farm_name: opt(200),
  main_crops: opt(),
  land_size: opt(40),
  farm_size_unit: opt(20),
  verification_status: z.enum(['Verified', 'Pending', 'Rejected']).optional(),
  notes: opt(2000),
});

const buyerSchema = z.object({
  name: s(120).min(1),
  phone: s(20).min(1),
  email: opt(200),
  location: opt(),
  type: opt(60),
  address: opt(),
  city: opt(80),
  state: opt(80),
  pincode: opt(10),
  buyer_type: opt(60),
  company_name: opt(200),
  notes: opt(2000),
  status: opt(40),
});

const employeeSchema = z.object({
  name: s(120).min(1),
  phone: s(20).min(1),
  email: opt(200),
  role: opt(60),
  address: opt(),
  city: opt(80),
  state: opt(80),
  pincode: opt(10),
  assigned_area: opt(120),
  joining_date: opt(40),
  emergency_contact: opt(60),
  notes: opt(2000),
  status: z.enum(['Active', 'On Leave', 'Inactive']).optional(),
  rating: num.min(0).max(5).optional(),
});

const productSchema = z.object({
  farmer_id: idStr,
  name: s(200).min(1),
  category: s(80).min(1),
  description: opt(2000),
  quantity: num.min(0).default(0),
  unit: s(20).min(1).default('kg'),
  price: num.min(0).default(0),
  min_order_quantity: num.min(0).optional(),
  harvest_date: opt(40),
  best_before_date: opt(40),
  status: opt(40),
  notes: opt(2000),
});
const stockSchema = z.object({ quantity_change: num.min(0), action: z.enum(['Add', 'Remove', 'Set']), reason: s(500).min(1) });

const orderSchema = z.object({
  farmer_id: idStr,
  buyer_id: idStr.optional().nullable(),
  product_id: idStr.optional().nullable(),
  product: s(500).min(1),
  quantity: num.min(0),
  unit: s(20).min(1),
  price: num.min(0),
  subtotal: num.min(0).optional(),
  commission: num.min(0).optional(),
  delivery_charge: num.min(0).optional(),
  total_amount: num.min(0),
  delivery_location: opt(),
  notes: opt(2000),
  status: opt(40),
  is_perishable: z.boolean().optional(),
  is_fragile: z.boolean().optional(),
  priority: z.enum(['NORMAL', 'HIGH', 'URGENT']).optional(),
});
const orderStatusSchema = z.object({
  status: z.enum(['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled']),
  cancellation_reason: opt(),
});

const paymentSchema = z.object({
  status: z.enum(['Pending', 'Processing', 'Completed', 'Failed', 'Refunded', 'Cancelled']),
  payment_method: opt(60),
  transaction_reference: opt(120),
  notes: opt(2000),
});
const settlementPaySchema = z.object({ payment_method: s(60).min(1), transaction_reference: s(120).min(1), notes: opt(2000) });
const commissionSchema = z.object({ status: z.enum(['Pending', 'Earned', 'Paid', 'Cancelled']) });

// ── Registries ────────────────────────────────
const farmers = makeCrud(Farmer, { label: 'Farmer' });
const buyers = makeCrud(Buyer, { label: 'Buyer' });
const employees = makeCrud(Employee, {
  label: 'Employee',
  beforeCreate: async (agentId) => ({ employee_id: `EMP-${String(await Counter.next(`employee_id:${agentId}`)).padStart(3, '0')}` }),
});

const crudHandlers = (crud, schema) => ({
  list: async (req, res) => res.json(serialize(await crud.list(req.user.agentId))),
  get: async (req, res) => res.json(serialize(await crud.get(req.user.agentId, requireId(req.params.id)))),
  create: async (req, res) => res.status(201).json(serialize(await crud.create(req.user.agentId, parse(schema, req.body)))),
  update: async (req, res) => res.json(serialize(await crud.update(req.user.agentId, requireId(req.params.id), parse(schema.partial(), req.body)))),
  remove: async (req, res) => {
    await crud.remove(req.user.agentId, requireId(req.params.id));
    res.status(204).end();
  },
});

const a = (req) => req.user.agentId;

module.exports = {
  farmers: {
    ...crudHandlers(farmers, farmerSchema),
    financialStats: async (req, res) => res.json(await finance.farmerStats(a(req), requireId(req.params.id))),
  },
  buyers: {
    ...crudHandlers(buyers, buyerSchema),
    orders: async (req, res) => res.json(serialize(await orders.buyerOrders(a(req), requireId(req.params.id)))),
  },
  employees: crudHandlers(employees, employeeSchema),

  products: {
    list: async (req, res) => res.json(await products.list(a(req))),
    get: async (req, res) => res.json(await products.get(a(req), requireId(req.params.id))),
    history: async (req, res) => res.json(serialize(await products.history(a(req), requireId(req.params.id)))),
    create: async (req, res) => res.status(201).json(serialize(await products.create(a(req), parse(productSchema, req.body)))),
    update: async (req, res) => res.json(serialize(await products.update(a(req), requireId(req.params.id), parse(productSchema.partial(), req.body)))),
    stock: async (req, res) => {
      const { quantity_change, action, reason } = parse(stockSchema, req.body);
      res.json(serialize(await products.updateStock(a(req), requireId(req.params.id), quantity_change, action, reason)));
    },
  },

  orders: {
    list: async (req, res) => res.json(await orders.list(a(req))),
    get: async (req, res) => res.json(await orders.get(a(req), requireId(req.params.id))),
    withoutDelivery: async (req, res) => res.json(await orders.withoutDelivery(a(req))),
    create: async (req, res) => res.status(201).json(serialize(await orders.create(a(req), parse(orderSchema, req.body)))),
    setStatus: async (req, res) => {
      const { status, cancellation_reason } = parse(orderStatusSchema, req.body);
      res.json(serialize(await orders.updateStatus(a(req), requireId(req.params.id), status, cancellation_reason ?? undefined)));
    },
  },

  finance: {
    payments: async (req, res) => res.json(await finance.listPayments(a(req))),
    payment: async (req, res) => res.json(await finance.getPayment(a(req), requireId(req.params.id))),
    paymentByOrder: async (req, res) => res.json(serialize(await finance.paymentByOrder(a(req), requireId(req.params.orderId)))),
    updatePayment: async (req, res) => res.json(serialize(await finance.updatePayment(a(req), requireId(req.params.id), parse(paymentSchema, req.body)))),
    settlements: async (req, res) => res.json(await finance.listSettlements(a(req))),
    settlement: async (req, res) => res.json(await finance.getSettlement(a(req), requireId(req.params.id))),
    settlementByOrder: async (req, res) => res.json(serialize(await finance.settlementByOrder(a(req), requireId(req.params.orderId)))),
    paySettlement: async (req, res) => res.json(serialize(await finance.paySettlement(a(req), requireId(req.params.id), parse(settlementPaySchema, req.body)))),
    commissions: async (req, res) => res.json(await finance.listCommissions(a(req))),
    updateCommission: async (req, res) =>
      res.json(serialize(await finance.updateCommission(a(req), requireId(req.params.id), parse(commissionSchema, req.body).status))),
  },
};
