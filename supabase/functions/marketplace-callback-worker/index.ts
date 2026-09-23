/**
 * marketplace-callback-worker — drains public.marketplace_sync_queue and sends
 * each status/event/location update to the Farm Marketplace.
 *
 * Triggered by:
 *   - the agent and driver apps right after a status change (supabase.functions.invoke)
 *   - pg_cron every minute (supabase/sql/marketplace_callback_cron.sql) for retries
 *
 * Deploy with default JWT verification (any signed-in user or the anon key may
 * nudge it; it only ever sends what the database already queued):
 *   supabase functions deploy marketplace-callback-worker
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  configFromEnv,
  createSupabaseStore,
  MarketplaceCallbackService,
} from '../_shared/marketplaceCallbackService.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const config = configFromEnv((k) => Deno.env.get(k));
  if (!config) {
    // Items stay queued (PENDING) until the secrets are set — nothing is lost.
    return reply(200, { configured: false, message: 'MARKETPLACE_API_URL / MARKETPLACE_API_KEY not set' });
  }

  let limit = 25;
  try {
    const body = await req.json();
    if (Number.isInteger(body?.limit)) limit = Math.min(100, Math.max(1, body.limit));
  } catch {
    // empty body is fine
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const service = new MarketplaceCallbackService(config, createSupabaseStore(db));
    const summary = await service.processQueue(limit);
    if (summary.claimed) console.log('[marketplace-callback-worker]', JSON.stringify(summary));
    return reply(200, summary);
  } catch (err) {
    console.error('[marketplace-callback-worker] error:', (err as Error).message);
    return reply(500, { configured: true, error: (err as Error).message });
  }
});
