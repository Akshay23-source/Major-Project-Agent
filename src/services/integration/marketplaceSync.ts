import { api } from "../../lib/api";

/**
 * Hooks into the Marketplace callback pipeline.
 *
 * The app never talks to the Farm Marketplace directly and never holds its API
 * key. The Agri Agent backend queues a callback for every status change and
 * sends it immediately (with retries in the background), so the app only needs
 * these helpers for the manual retry / troubleshooting screens.
 */

/** Ask the backend to send queued callbacks now. Fire-and-forget, never throws. */
export const kickMarketplaceSync = (): void => {
  api.post("/marketplace/sync/run").catch((e: any) => console.warn("[marketplaceSync] nudge failed:", e?.message));
};

/** Re-queue failed / dead-lettered callbacks for one order; returns how many were re-queued. */
export const retryMarketplaceSync = async (orderId: string): Promise<number> => {
  const { requeued } = await api.post<{ requeued: number }>(`/marketplace/orders/${orderId}/sync/retry`);
  return requeued || 0;
};

/** Recent callback attempts for an order (for troubleshooting). */
export const getMarketplaceCallbackLog = (orderId: string, limit = 20) =>
  api.get<Array<{ id: string; attempt: number; success: boolean; http_status?: number; error?: string; created_at: string }>>(
    `/marketplace/orders/${orderId}/sync/logs`,
    { limit }
  );
