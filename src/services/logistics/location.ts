import { supabase } from '../../lib/supabase';
import { getCurrentAgent } from '../agent';
import { DriverLocation } from '../tracking';

/**
 * Service to manage real-time and historical driver locations.
 */

export const getLatestDriverLocation = async (driverId: string): Promise<DriverLocation | null> => {
  const { data, error } = await supabase
    .from('driver_locations')
    .select('*')
    .eq('delivery_partner_id', driverId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Failed to get driver location:', error);
    return null;
  }
  return data;
};

export const getDeliveryDriverLocation = async (deliveryId: string): Promise<DriverLocation | null> => {
  const { data, error } = await supabase
    .from('driver_locations')
    .select('*')
    .eq('delivery_id', deliveryId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Failed to get delivery driver location:', error);
    return null;
  }
  return data;
};

export const subscribeToDriverLocation = (
  deliveryId: string,
  callback: (location: DriverLocation) => void
) => {
  const channelName = `driver_locations_${deliveryId}`;
  
  // Cleanup any existing channel to prevent "callback after subscribe" error
  const existingChannel = supabase.getChannels().find(c => c.topic === `realtime:${channelName}`);
  if (existingChannel) {
    supabase.removeChannel(existingChannel);
  }

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'driver_locations',
        filter: `delivery_id=eq.${deliveryId}`,
      },
      (payload) => {
        callback(payload.new as DriverLocation);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const subscribeToAllDriverLocations = (
  callback: (location: DriverLocation) => void
) => {
  const channelName = 'public_driver_locations_all';
  
  // Cleanup any existing channel to prevent "callback after subscribe" error
  const existingChannel = supabase.getChannels().find(c => c.topic === `realtime:${channelName}`);
  if (existingChannel) {
    supabase.removeChannel(existingChannel);
  }

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'driver_locations',
      },
      (payload) => {
        callback(payload.new as DriverLocation);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
