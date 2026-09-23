import { supabase } from "../../lib/supabase";

/**
 * Client-side hooks into the marketplace callback pipeline.
 *
 * The app NEVER talks to the Farm Marketplace directly and never holds its API
 * key. Status changes are captured by Postgres triggers into
 * marketplace_sync_queue; the `marketplace-callback-worker` Edge Function sends
 * them. These helpers only nudge that worker so callbacks leave immediately
 * instead of waiting for the once-a-minute cron sweep.
 */

let inFlight: Promise<void> | null = null;

/** Fire-and-forget: ask the worker to drain the queue now. Never throws. */
export const kickMarketplaceSync = (): void => {
  if (inFlight) return; // one nudge at a time is enough
  inFlight = supabase.functions
    .invoke("marketplace-callback-worker", { body: { source: "app" } })
    .then(({ error }) => {
      if (error) console.warn("[marketplaceSync] worker nudge failed:", error.message);
    })
    .catch((e: any) => console.warn("[marketplaceSync] worker nudge failed:", e?.message))
    .finally(() => {
      inFlight = null;
    });
};

/** Re-queue failed / dead-lettered callbacks for one order, then send them. */
export const retryMarketplaceSync = async (orderId: string): Promise<number> => {
  const { data, error } = await supabase.rpc("retry_marketplace_sync", { p_order_id: orderId });
  if (error) throw error;
  kickMarketplaceSync();
  return (data as number) || 0;
};

/** Recent callback attempts for an order (for troubleshooting). */
export const getMarketplaceCallbackLog = async (orderId: string, limit = 20) => {
  const { data, error } = await supabase
    .from("marketplace_callback_logs")
    .select("id, attempt, success, http_status, error, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
};
