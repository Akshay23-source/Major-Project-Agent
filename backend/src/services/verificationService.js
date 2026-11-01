/**
 * Customer Delivery Verification Service.
 * Validates, records, and retrieves customer delivery verification.
 */
const { Order, DeliveryJob, DeliveryEvent } = require('../models');
const { notify } = require('./notificationService');
const { notFound, conflict, badRequest } = require('../utils/http');
const { serialize } = require('../utils/serialize');

const findOrder = async (idOrKey) => {
  const query = {
    $or: [
      { tracking_id: idOrKey },
      { external_order_id: idOrKey },
      { order_number: idOrKey },
    ],
  };
  if (/^[0-9a-fA-F]{24}$/.test(idOrKey)) {
    query.$or.unshift({ _id: idOrKey });
  }
  return Order.findOne(query);
};

const verifyOrder = async (orderIdentifier, { customerId, delivered, quality, security, rating, comments }) => {
  const order = await findOrder(orderIdentifier);
  if (!order) throw notFound('Order not found');

  if (order.logistics_status !== 'DELIVERED') {
    throw conflict(`Cannot verify order in ${order.logistics_status} status. Order must be DELIVERED first.`);
  }

  if (order.verification_status === 'VERIFIED') {
    throw conflict('Delivery has already been verified for this order');
  }

  const numRating = Number(rating);
  if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
    throw badRequest('Rating must be an integer between 1 and 5');
  }

  const isIssue = !delivered || !quality || !security || numRating <= 2;
  const newStatus = isIssue ? 'ISSUE_REPORTED' : 'VERIFIED';

  order.verification_status = newStatus;
  order.customer_verification = {
    customer_id: customerId ? String(customerId).trim() : 'CUSTOMER',
    delivered_confirmed: Boolean(delivered),
    quality_confirmed: Boolean(quality),
    security_confirmed: Boolean(security),
    rating: numRating,
    comments: comments ? String(comments).trim().slice(0, 1000) : '',
    verified_at: new Date(),
  };

  await order.save();

  const delivery = await DeliveryJob.findOne({ order_id: order._id }).sort({ created_at: -1 });
  if (delivery) {
    await DeliveryEvent.create({
      delivery_id: delivery._id,
      order_id: order._id,
      agent_id: order.agent_id,
      event_type: newStatus,
      description: `Customer verification: ${newStatus === 'VERIFIED' ? 'Verified' : 'Issue Reported'} (Rating: ${numRating}/5, Delivered: ${delivered ? 'Yes' : 'No'}, Quality: ${quality ? 'Yes' : 'No'}, Security: ${security ? 'Yes' : 'No'})${comments ? ` - "${comments}"` : ''}`,
      actor_type: 'MARKETPLACE',
      actor_id: customerId ? String(customerId) : 'CUSTOMER',
    });
  }

  await notify(order.agent_id, {
    type: 'Order Verification',
    title: newStatus === 'VERIFIED' ? 'Delivery Verified by Customer' : 'Delivery Issue Reported by Customer',
    message: `Order ${order.order_number}: ${newStatus === 'VERIFIED' ? `Verified (${numRating}★)` : `Issue reported (${numRating}★)`}`,
    related_id: order._id,
    related_type: 'order',
  });

  return {
    success: true,
    order_id: String(order._id),
    order_number: order.order_number,
    verification_status: newStatus,
    customer_verification: serialize(order.customer_verification),
  };
};

const getVerification = async (orderIdentifier) => {
  const order = await findOrder(orderIdentifier);
  if (!order) throw notFound('Order not found');

  return {
    order_id: String(order._id),
    order_number: order.order_number,
    tracking_id: order.tracking_id,
    logistics_status: order.logistics_status,
    verification_status: order.verification_status || 'NOT_APPLICABLE',
    customer_verification: order.customer_verification ? serialize(order.customer_verification) : null,
    delivered: order.logistics_status === 'DELIVERED',
  };
};

module.exports = { verifyOrder, getVerification, findOrder };

