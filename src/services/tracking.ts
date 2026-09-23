import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface DriverLocation {
  id: string;
  delivery_partner_id: string;
  delivery_id?: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  recorded_at: string;
}

type LocationCallback = (location: DriverLocation) => void;

export class TrackingService {
  private channel: RealtimeChannel | null = null;
  private callbacks: LocationCallback[] = [];

  /**
   * Subscribe to live driver location updates
   */
  subscribeToLocations(onLocationUpdate: LocationCallback): () => void {
    this.callbacks.push(onLocationUpdate);

    if (!this.channel) {
      const channelName = 'driver_locations_changes';
      
      const existingChannel = supabase.getChannels().find(c => c.topic === `realtime:${channelName}`);
      if (existingChannel) {
        supabase.removeChannel(existingChannel);
      }

      this.channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'driver_locations' },
          (payload) => {
            const newLocation = payload.new as DriverLocation;
            this.callbacks.forEach(cb => cb(newLocation));
          }
        )
        .subscribe();
    }

    // Return unsubscribe function
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== onLocationUpdate);
      if (this.callbacks.length === 0 && this.channel) {
        supabase.removeChannel(this.channel);
        this.channel = null;
      }
    };
  }

  /**
   * Simulates a driver location update for development/testing
   */
  async simulateLocationUpdate(partnerId: string, deliveryId: string, lat: number, lng: number) {
    const { error } = await supabase
      .from('driver_locations')
      .insert({
        delivery_partner_id: partnerId,
        delivery_id: deliveryId,
        latitude: lat,
        longitude: lng,
        speed: 45, // km/h simulation
        recorded_at: new Date().toISOString()
      });

    if (error) console.error("Simulated update failed:", error);
  }
}

export const trackingService = new TrackingService();
