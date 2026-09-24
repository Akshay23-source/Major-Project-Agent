import { api } from '../../lib/api';
import { DriverLocation, pollLocations } from '../tracking';

/**
 * Real-time and historical driver locations. "Real-time" is polling every few
 * seconds against the Agri Agent backend.
 */

export const getLatestDriverLocation = async (driverId: string): Promise<DriverLocation | null> => {
  try {
    return await api.get<DriverLocation | null>(`/tracking/drivers/${driverId}/latest`);
  } catch (error) {
    console.error('Failed to get driver location:', error);
    return null;
  }
};

export const getDeliveryDriverLocation = async (deliveryId: string): Promise<DriverLocation | null> => {
  try {
    return await api.get<DriverLocation | null>(`/tracking/deliveries/${deliveryId}/latest`);
  } catch (error) {
    console.error('Failed to get delivery driver location:', error);
    return null;
  }
};

/** Latest known point of every driver (initial map load). */
export const getAllDriverLocations = async (): Promise<DriverLocation[]> => {
  try {
    return await api.get<DriverLocation[]>('/tracking/locations');
  } catch (error) {
    console.error('Failed to get driver locations:', error);
    return [];
  }
};

export const subscribeToDriverLocation = (deliveryId: string, callback: (location: DriverLocation) => void) =>
  pollLocations((since) => api.get<DriverLocation[]>(`/tracking/deliveries/${deliveryId}/points`, { since }), callback);

export const subscribeToAllDriverLocations = (callback: (location: DriverLocation) => void) =>
  pollLocations((since) => api.get<DriverLocation[]>('/tracking/locations', { since }), callback);
