/**
 * Shared helpers for the ingest-marketplace-order Edge Function.
 * Pure (no Supabase import) so they can be unit-tested.
 */

const encoder = new TextEncoder();

const sha256 = async (value: string): Promise<Uint8Array> =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));

/**
 * Constant-time API key check. Accepts `x-api-key: <key>` or
 * `Authorization: Bearer <key>` (the Farm Marketplace sends both).
 */
export const verifyApiKey = async (headers: Headers, expected: string): Promise<boolean> => {
  if (!expected) return false;
  const auth = headers.get('authorization') || '';
  const provided = headers.get('x-api-key') || (auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '');
  if (!provided) return false;

  const [a, b] = await Promise.all([sha256(provided), sha256(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

const ID_RE = /^[A-Za-z0-9_.:-]{1,64}$/;
const PRIORITIES = ['NORMAL', 'HIGH', 'URGENT'];
const MAX_PRODUCTS = 100;

// deno-lint-ignore no-explicit-any
type Json = any;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

/**
 * Validates the marketplace order payload. Accepts both shapes:
 *   flat:   buyerName / buyerPhone, farmerName / farmerPhone / pickupAddress
 *   nested: buyer { name, phone }, farmer { name, phone, address }
 * Only logistics fields are used; everything else is ignored by the intake.
 */
export const validateIntakePayload = (body: Json): { ok: boolean; errors: string[] } => {
  const errors: string[] = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, errors: ['Body must be a JSON object'] };
  }

  const externalOrderId = str(body.externalOrderId);
  if (!externalOrderId) errors.push('externalOrderId is required');
  else if (!ID_RE.test(externalOrderId)) errors.push('externalOrderId has invalid characters or is longer than 64');

  if (body.orderNumber !== undefined && str(body.orderNumber).length > 64) errors.push('orderNumber is too long');

  // Only delivery information is needed. Marketplace ids for buyers, farmers and
  // products, and payment fields, are accepted but never stored (see migration 014).
  if (!str(body.farmer?.address ?? body.pickupAddress)) {
    errors.push('pickup address is required (pickupAddress or farmer.address)');
  }

  if (!Array.isArray(body.products) || body.products.length === 0) {
    errors.push('products must be a non-empty array');
  } else if (body.products.length > MAX_PRODUCTS) {
    errors.push(`products cannot exceed ${MAX_PRODUCTS} items`);
  } else {
    body.products.forEach((p: Json, i: number) => {
      if (!p || typeof p !== 'object') errors.push(`products[${i}] must be an object`);
      else if (!str(p.name)) errors.push(`products[${i}].name is required`);
    });
  }

  const ship = body.shippingAddress;
  if (!ship || typeof ship !== 'object') errors.push('shippingAddress is required');
  else if (!str(ship.address) || !str(ship.city)) errors.push('shippingAddress.address and shippingAddress.city are required');

  if (body.estimatedDelivery != null && Number.isNaN(new Date(body.estimatedDelivery).getTime())) {
    errors.push('estimatedDelivery must be an ISO date');
  }
  if (body.priority != null && !PRIORITIES.includes(str(body.priority).toUpperCase())) {
    errors.push(`priority must be one of ${PRIORITIES.join(', ')}`);
  }

  return { ok: errors.length === 0, errors };
};

export const json = (status: number, body: unknown, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
