import { api } from '../../lib/api';
import { DriverLocation, trackingService } from '../tracking';

export async function getAllDriverLocations(): Promise<DriverLocation[]> {
  try {
    const list = await api.get<DriverLocation[]>('/tracking/locations');
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.warn('[location] Failed to get driver locations:', err);
    return [];
  }
}

export function subscribeToAllDriverLocations(
  callback: (newLocation: DriverLocation) => void
): () => void {
  return trackingService.subscribeToLocations(callback);
}
