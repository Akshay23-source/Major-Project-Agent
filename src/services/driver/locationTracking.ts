import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import { getCurrentDriver } from './auth';

let locationSubscription: Location.LocationSubscription | null = null;
let currentDeliveryId: string | null = null;

export const startLocationTracking = async (deliveryId?: string): Promise<boolean> => {
  try {
    const driver = await getCurrentDriver();
    if (!driver) return false;

    if (deliveryId) {
      currentDeliveryId = deliveryId;
    }

    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      console.warn('Foreground location permission denied');
      return false;
    }

    // Stop existing subscription if any
    await stopLocationTracking();

    locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 10000, // Update every 10 seconds
        distanceInterval: 20, // Or every 20 meters
      },
      async (location) => {
        // Drop inaccurate points
        if (location.coords.accuracy && location.coords.accuracy > 50) return;

        await pushLocationToSupabase(driver.id, location, currentDeliveryId);
      }
    );

    return true;
  } catch (error) {
    console.error('Error starting location tracking:', error);
    return false;
  }
};

export const stopLocationTracking = async () => {
  if (locationSubscription) {
    locationSubscription.remove();
    locationSubscription = null;
  }
  currentDeliveryId = null;
};

const pushLocationToSupabase = async (
  driverId: string, 
  location: Location.LocationObject,
  deliveryId: string | null
) => {
  try {
    const { error } = await supabase.from('driver_locations').insert({
      delivery_partner_id: driverId,
      delivery_id: deliveryId,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      speed: location.coords.speed,
      heading: location.coords.heading,
      recorded_at: new Date(location.timestamp).toISOString()
    });

    if (error) {
      console.error('Supabase location insert error:', error.message);
    }
  } catch (err) {
    console.error('Failed to push location:', err);
  }
};
