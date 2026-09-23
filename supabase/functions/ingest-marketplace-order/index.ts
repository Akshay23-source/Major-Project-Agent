/**
 * ingest-marketplace-order — Farm Marketplace → Agri Agent order intake.
 *
 *   POST /functions/v1/ingest-marketplace-order
 *   x-api-key: <MARKETPLACE_API_KEY>        (or Authorization: Bearer <key>)
 *
 * Deploy WITHOUT gateway JWT verification (the marketplace server has no
 * Supabase JWT; this function checks the shared API key itself):
 *   supabase functions deploy ingest-marketplace-order --no-verify-jwt
 *
 * Idempotent on externalOrderId: the marketplace re-sends the same order after
 * payment and on cancellation; those update the existing logistics order.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { isUuid, json, validateIntakePayload, verifyApiKey } from '../_shared/marketplaceIntake.ts';

const MAX_BODY_BYTES = 256 * 1024;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return json(405, { success: false, message: 'Method not allowed' }, { Allow: 'POST' });
  }

  // Security (Phase 13): closed unless configured, constant-time key check
  const expectedKey = Deno.env.get('MARKETPLACE_API_KEY') || '';
  if (!expectedKey) {
    return json(503, { success: false, message: 'Marketplace integration is not configured' });
  }
  if (!(await verifyApiKey(req.headers, expectedKey))) {
    console.warn('[ingest-marketplace-order] rejected: invalid or missing API key');
    return json(401, { success: false, message: 'Unauthorized' });
  }

  const agentId = Deno.env.get('MARKETPLACE_DEFAULT_AGENT_ID') || '';
  if (!isUuid(agentId)) {
    console.error('[ingest-marketplace-order] MARKETPLACE_DEFAULT_AGENT_ID is missing or not a UUID');
    return json(503, { success: false, message: 'Marketplace integration is not configured' });
  }

  const length = Number(req.headers.get('content-length') || 0);
  if (length > MAX_BODY_BYTES) {
    return json(413, { success: false, message: 'Payload too large' });
  }

  let body: unknown;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return json(413, { success: false, message: 'Payload too large' });
    body = JSON.parse(raw);
  } catch {
    return json(400, { success: false, message: 'Body must be valid JSON' });
  }

  const validation = validateIntakePayload(body);
  if (!validation.ok) {
    return json(400, { success: false, message: 'Invalid order payload', errors: validation.errors });
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await db.rpc('ingest_marketplace_order', {
    p_payload: body,
    p_agent_id: agentId,
  });

  if (error) {
    if (error.code === '22023') {
      return json(400, { success: false, message: error.message });
    }
    console.error('[ingest-marketplace-order] ingest failed:', error.message);
    return json(500, { success: false, message: 'Could not ingest order' });
  }

  const result = data as { action?: string; orderNumber?: string };
  console.log(`[ingest-marketplace-order] ${result.action} ${result.orderNumber}`);
  return json(result.action === 'created' ? 201 : 200, data);
});
