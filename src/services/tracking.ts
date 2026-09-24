import { api } from '../lib/api';

export interface DriverLocation {
  id: string;
  delivery_partner_id: string;
  delivery_id?: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  recorded_at: string;
  created_at?: string;
}

type LocationCallback = (location: DriverLocation) => void;

export const POLL_INTERVAL_MS = 5000;

/**
 * Polls the backend for new GPS points (near-real-time, every few seconds).
 * `fetchSince(since)` returns points newer than the given ISO time, oldest first.
 */
export const pollLocations = (
  fetchSince: (since: string) => Promise<DriverLocation[]>,
  callback: LocationCallback,
  intervalMs = POLL_INTERVAL_MS
) => {
  // Start a little in the past so device/server clock skew can't hide the first points.
  let since = new Date(Date.now() - 30000).toISOString();
  let stopped = false;
  let busy = false;

  const tick = async () => {
    if (stopped || busy) return;
    busy = true;
    try {
      const points = await fetchSince(since);
      for (const p of points) {
        if (stopped) break;
        callback(p);
        const t = p.created_at || p.recorded_at;
        if (t && t > since) since = t;
      }
    } catch (e) {
      console.warn('[tracking] poll failed:', (e as Error)?.message);
    } finally {
      busy = false;
    }
  };

  const timer = setInterval(tick, intervalMs);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
};

export class TrackingService {
  private unsubscribe: (() => void) | null = null;
  private callbacks: LocationCallback[] = [];

  /** Live driver location updates for this agent's drivers. */
  subscribeToLocations(onLocationUpdate: LocationCallback): () => void {
    this.callbacks.push(onLocationUpdate);
    if (!this.unsubscribe) {
      this.unsubscribe = pollLocations(
        (since) => api.get<DriverLocation[]>('/tracking/locations', { since }),
        (loc) => this.callbacks.forEach((cb) => cb(loc))
      );
    }
    return () => {
      this.callbacks = this.callbacks.filter((cb) => cb !== onLocationUpdate);
      if (this.callbacks.length === 0 && this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }
    };
  }
}

export const trackingService = new TrackingService();
