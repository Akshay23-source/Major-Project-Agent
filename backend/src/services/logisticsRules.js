/**
 * Pure logistics rules (ported from migrations 013 + 014). No I/O.
 */

// Marketplace-visible logistics statuses and their order (null = not one of them).
const RANK = {
  PENDING: 0,
  PICKUP_ASSIGNED: 1,
  ACCEPTED: 2,
  PICKED_UP: 3,
  IN_TRANSIT: 4,
  OUT_FOR_DELIVERY: 5,
  DELIVERED: 6,
  CANCELLED: 6,
  FAILED_DELIVERY: 6,
  RETURNED: 7,
};

const TERMINAL = new Set(['DELIVERED', 'CANCELLED', 'FAILED_DELIVERY', 'RETURNED']);

const up = (s) => (s || '').toString().toUpperCase();
const statusRank = (s) => (up(s) in RANK ? RANK[up(s)] : null);
const isTerminal = (s) => TERMINAL.has(up(s));

/** Delivery event type → marketplace logistics status (null = informational only). */
const EVENT_STATUS = {
  ASSIGNED: 'PICKUP_ASSIGNED',
  PICKUP_ASSIGNED: 'PICKUP_ASSIGNED',
  ACCEPTED: 'ACCEPTED',
  PICKED_UP: 'PICKED_UP',
  IN_TRANSIT: 'IN_TRANSIT',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
  FAILED_DELIVERY: 'FAILED_DELIVERY',
  RETURNED: 'RETURNED',
};
const mapEventStatus = (eventType) => EVENT_STATUS[up(eventType)] || null;

/** Forward-only: never move backwards, never leave a terminal state for a non-terminal one. */
const shouldAdvance = (current, next) => {
  if (statusRank(next) === null) return false;
  if (statusRank(current) === null) return true;
  if (up(current) === up(next)) return false;
  if (isTerminal(current) && !isTerminal(next)) return false;
  return statusRank(next) > statusRank(current);
};

/** Driver state machine (013): drivers cannot skip steps. */
const DRIVER_TRANSITIONS = {
  ASSIGNED: ['ACCEPTED'],
  ACCEPTED: ['DRIVER_EN_ROUTE'],
  DRIVER_EN_ROUTE: ['ARRIVED_AT_FARM'],
  ARRIVED_AT_FARM: ['PICKED_UP'],
  PICKED_UP: ['IN_TRANSIT'],
  IN_TRANSIT: ['ARRIVED_AT_DESTINATION'],
  ARRIVED_AT_DESTINATION: ['OUT_FOR_DELIVERY', 'DELIVERED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
};
const DRIVER_STATUSES = Object.keys(DRIVER_TRANSITIONS);

const canDriverTransition = (current, next) => (DRIVER_TRANSITIONS[current || 'ASSIGNED'] || []).includes(next);

/** Driver step → dispatch status on the delivery job. */
const DRIVER_TO_DELIVERY_STATUS = {
  ACCEPTED: 'PICKUP_ASSIGNED',
  PICKED_UP: 'PICKED_UP',
  IN_TRANSIT: 'IN_TRANSIT',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
};

const PRIORITIES = ['NORMAL', 'HIGH', 'URGENT'];
const PERISHABLE_CATEGORIES = ['vegetables', 'fruits', 'dairy', 'meat', 'poultry'];

module.exports = {
  statusRank,
  isTerminal,
  mapEventStatus,
  shouldAdvance,
  DRIVER_TRANSITIONS,
  DRIVER_STATUSES,
  canDriverTransition,
  DRIVER_TO_DELIVERY_STATUS,
  PRIORITIES,
  PERISHABLE_CATEGORIES,
};
