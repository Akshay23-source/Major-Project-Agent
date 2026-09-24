/**
 * Pure callback helpers for Marketplace status callbacks (no I/O).
 *
 *   POST {MARKETPLACE_API_URL}{MARKETPLACE_CALLBACK_PATH}
 *   x-api-key: {MARKETPLACE_API_KEY}
 *   { externalOrderId, logisticsStatus?, driver, vehicle, trackingEvents,
 *     currentLocation, timestamp, trackingId, eta?, reason?, source: 'agri-agent' }
 */
const TERMINAL_FAILURES = ['CANCELLED', 'FAILED_DELIVERY', 'RETURNED'];

const toNumber = (v) => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
};

const toIso = (v) => {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? undefined : v.toISOString();
  if (typeof v !== 'string' || !v.trim()) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

/** Internal / technical descriptions that should not reach buyers. */
const GENERIC_DESCRIPTION =
  /^(driver transitioned to|status (changed|updated) to|assigned to partner|assigned vehicle|driver assigned for pickup)/i;

const friendlyMessage = (eventType, description, ctx) => {
  const cleaned = (description || '').replace(/\n?\[Photo Proof attached\]/gi, '').trim();
  if (cleaned && !GENERIC_DESCRIPTION.test(cleaned)) return cleaned.slice(0, 300);

  const driver = ctx.partner?.name?.trim();
  const vehicleNumber = ctx.vehicle?.vehicle_number || ctx.partner?.vehicle_number;
  const vehicleType = ctx.vehicle?.vehicle_type || ctx.partner?.vehicle_type;

  switch ((eventType || '').toUpperCase()) {
    case 'ASSIGNED':
    case 'PICKUP_ASSIGNED':
      return driver ? `${driver} has been assigned to pick up your order.` : 'A delivery partner has been assigned.';
    case 'VEHICLE_ASSIGNED':
      return vehicleNumber
        ? `Vehicle ${vehicleNumber}${vehicleType ? ` (${vehicleType})` : ''} assigned for your delivery.`
        : 'A vehicle has been assigned for your delivery.';
    case 'ACCEPTED':
      return 'The delivery partner accepted the pickup.';
    case 'DRIVER_EN_ROUTE':
      return 'The driver is on the way to the farm.';
    case 'ARRIVED_AT_FARM':
      return 'The driver has arrived at the farm for pickup.';
    case 'PICKED_UP':
      return 'Your order has been picked up from the farm.';
    case 'IN_TRANSIT':
      return 'Your order is in transit.';
    case 'ARRIVED_AT_DESTINATION':
    case 'NEAR_DESTINATION':
      return 'The driver has reached your area.';
    case 'OUT_FOR_DELIVERY':
      return 'Your order is out for delivery.';
    case 'DELIVERED':
      return 'Your order has been delivered.';
    case 'CANCELLED':
      return 'The delivery was cancelled by the logistics partner.';
    case 'FAILED_DELIVERY':
      return 'Delivery attempt failed.';
    case 'RETURNED':
      return 'The order is being returned.';
    default:
      return `Delivery update: ${(eventType || 'UPDATE').replace(/_/g, ' ').toLowerCase()}`;
  }
};

/**
 * @param item  SyncJob (plain object)
 * @param ctx   { order, delivery, partner, vehicle, location }
 */
const buildCallbackPayload = (item, ctx) => {
  const timestamp = toIso(item.occurred_at) || new Date().toISOString();
  const payload = {
    externalOrderId: item.external_order_id,
    trackingEvents: [],
    timestamp,
    source: 'agri-agent',
  };

  if (item.kind === 'STATUS' && item.logistics_status) payload.logisticsStatus = item.logistics_status.toUpperCase();
  if (ctx.order?.tracking_id) payload.trackingId = ctx.order.tracking_id;

  if (ctx.partner) {
    payload.driver = { id: String(ctx.partner._id || ctx.partner.id), name: ctx.partner.name || '', phone: ctx.partner.phone || '' };
  }
  if (ctx.vehicle?.vehicle_number) {
    payload.vehicle = { id: String(ctx.vehicle._id || ctx.vehicle.id), number: ctx.vehicle.vehicle_number, type: ctx.vehicle.vehicle_type || '' };
  } else if (ctx.partner?.vehicle_number) {
    payload.vehicle = { number: ctx.partner.vehicle_number, type: ctx.partner.vehicle_type || '' };
  }

  // Latest GPS, else the event's own point
  const locLat = toNumber(ctx.location?.latitude) ?? toNumber(item.latitude);
  const locLng = toNumber(ctx.location?.longitude) ?? toNumber(item.longitude);
  if (locLat !== undefined && locLng !== undefined) {
    payload.currentLocation = {
      latitude: locLat,
      longitude: locLng,
      updatedAt: toIso(ctx.location?.recorded_at) || timestamp,
    };
  }

  // Audit event — location pings carry no event
  if (item.kind !== 'LOCATION') {
    const status = (item.event_type || item.logistics_status || 'UPDATE').toUpperCase();
    const evLat = toNumber(item.latitude);
    const evLng = toNumber(item.longitude);
    payload.trackingEvents.push({
      status,
      message: friendlyMessage(item.event_type || item.logistics_status, item.message, ctx),
      timestamp,
      ...(evLat !== undefined && evLng !== undefined ? { latitude: evLat, longitude: evLng } : {}),
    });
  }

  const eta = toIso(ctx.delivery?.eta ?? undefined) || toIso(ctx.order?.estimated_delivery);
  if (eta) payload.eta = eta;

  if (payload.logisticsStatus && TERMINAL_FAILURES.includes(payload.logisticsStatus)) {
    const reason = (item.message || ctx.order?.cancellation_reason || '').trim();
    if (reason) payload.reason = reason.slice(0, 300);
  }

  return payload;
};

/** 2xx → done; 400/404/410/422 → the marketplace will never accept it; else retry. */
const classifyResponse = (status) => {
  if (status !== null && status >= 200 && status < 300) return 'success';
  if (status !== null && [400, 404, 410, 422].includes(status)) return 'dead';
  return 'retry';
};

/** 30s, 60s, 2m, … capped at 1h (same as finish_marketplace_callback). */
const backoffSeconds = (attemptsSoFar) => Math.min(3600, 30 * 2 ** attemptsSoFar);

module.exports = { friendlyMessage, buildCallbackPayload, classifyResponse, backoffSeconds, toIso, toNumber };
