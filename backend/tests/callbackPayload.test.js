/** Pure payload / rules tests. */
const { buildCallbackPayload, classifyResponse, friendlyMessage, backoffSeconds } = require('../src/services/callbackPayload');
const rules = require('../src/services/logisticsRules');

const item = (o = {}) => ({
  external_order_id: 'EXT-1',
  kind: 'STATUS',
  logistics_status: 'PICKUP_ASSIGNED',
  event_type: 'ASSIGNED',
  message: 'Assigned to partner abc',
  occurred_at: new Date('2026-09-24T10:00:00Z'),
  ...o,
});
const ctx = {
  order: { tracking_id: 'AGRI-1', cancellation_reason: null },
  partner: { _id: 'd1', name: 'Manjunath', phone: '9845012345', vehicle_number: 'KA-01', vehicle_type: 'Ace' },
  vehicle: null,
  location: { latitude: 12.3, longitude: 76.6, recorded_at: new Date('2026-09-24T09:59:00Z') },
  delivery: { eta: null },
};

test('status payload with driver, vehicle fallback, location and friendly message', () => {
  const p = buildCallbackPayload(item(), ctx);
  expect(p).toMatchObject({
    externalOrderId: 'EXT-1',
    logisticsStatus: 'PICKUP_ASSIGNED',
    trackingId: 'AGRI-1',
    driver: { id: 'd1', name: 'Manjunath', phone: '9845012345' },
    vehicle: { number: 'KA-01', type: 'Ace' },
    currentLocation: { latitude: 12.3, longitude: 76.6, updatedAt: '2026-09-24T09:59:00.000Z' },
    timestamp: '2026-09-24T10:00:00.000Z',
    source: 'agri-agent',
  });
  expect(p.trackingEvents).toEqual([{ status: 'ASSIGNED', message: 'Manjunath has been assigned to pick up your order.', timestamp: '2026-09-24T10:00:00.000Z' }]);
});

test('location pings carry no event; terminal failures carry a reason', () => {
  expect(buildCallbackPayload(item({ kind: 'LOCATION', logistics_status: undefined }), ctx).trackingEvents).toEqual([]);
  const p = buildCallbackPayload(item({ logistics_status: 'CANCELLED', event_type: 'CANCELLED', message: 'No vehicle' }), ctx);
  expect(p.reason).toBe('No vehicle');
});

test('photo marker is stripped, custom notes pass through', () => {
  expect(friendlyMessage('DELIVERED', 'Left with neighbour\n[Photo Proof attached]', ctx)).toBe('Left with neighbour');
  expect(friendlyMessage('PICKED_UP', 'Driver transitioned to PICKED_UP', ctx)).toBe('Your order has been picked up from the farm.');
});

test('response classification + back-off', () => {
  expect(classifyResponse(200)).toBe('success');
  expect(classifyResponse(422)).toBe('dead');
  expect(classifyResponse(503)).toBe('retry');
  expect(classifyResponse(null)).toBe('retry');
  expect([0, 1, 2, 10].map(backoffSeconds)).toEqual([30, 60, 120, 3600]);
});

test('forward-only rules', () => {
  expect(rules.shouldAdvance('PENDING', 'PICKUP_ASSIGNED')).toBe(true);
  expect(rules.shouldAdvance('IN_TRANSIT', 'PICKED_UP')).toBe(false);
  expect(rules.shouldAdvance('DELIVERED', 'IN_TRANSIT')).toBe(false);
  expect(rules.shouldAdvance('DELIVERED', 'RETURNED')).toBe(true);
  expect(rules.shouldAdvance('IN_TRANSIT', 'DRIVER_EN_ROUTE')).toBe(false);
  expect(rules.canDriverTransition('ASSIGNED', 'ACCEPTED')).toBe(true);
  expect(rules.canDriverTransition('ASSIGNED', 'DELIVERED')).toBe(false);
  expect(rules.canDriverTransition('ARRIVED_AT_DESTINATION', 'DELIVERED')).toBe(true);
});
