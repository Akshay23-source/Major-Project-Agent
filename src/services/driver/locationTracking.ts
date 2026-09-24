import * as Location from 'expo-location';
import { api } from '../../lib/api';
import { getCurrentDriver } from './auth';

let locationSubscription: Location.LocationSubscription | null = null;
let currentDeliveryId: string | null = null;

export const startLocationTracking = async (deliveryId?: string): Promise<boolean> => {
  try {
    const driver = await getCurrentDriver();
    if (!driver) return false;

    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      console.warn('Foreground location permission denied');
      return false;
    }

    await stopLocationTracking();
    if (deliveryId) currentDeliveryId = deliveryId;

    locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 10000, // every 10 seconds
        distanceInterval: 20, // or every 20 meters
      },
      async (location) => {
        // Drop inaccurate points (the server applies the same rule)
        if (location.coords.accuracy && location.coords.accuracy > 50) return;
        await pushLocation(location, currentDeliveryId);
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

const pushLocation = async (location: Location.LocationObject, deliveryId: string | null) => {
  try {
    await api.post('/driver/location', {
      delivery_id: deliveryId,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      speed: location.coords.speed,
      heading: location.coords.heading,
      recorded_at: new Date(location.timestamp).toISOString(),
    });
  } catch (err) {
    console.error('Failed to push location:', err);
  }
};
