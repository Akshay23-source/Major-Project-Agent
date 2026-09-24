import * as Location from 'expo-location';
import { api } from '../../lib/api';

export type DriverDeliveryStatus =
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'DRIVER_EN_ROUTE'
  | 'ARRIVED_AT_FARM'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'ARRIVED_AT_DESTINATION'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED';

// Same state machine the backend enforces — used to show only valid next steps.
export const VALID_TRANSITIONS: Record<string, string[]> = {
  ASSIGNED: ['ACCEPTED'],
  ACCEPTED: ['DRIVER_EN_ROUTE'],
  DRIVER_EN_ROUTE: ['ARRIVED_AT_FARM'],
  ARRIVED_AT_FARM: ['PICKED_UP'],
  PICKED_UP: ['IN_TRANSIT'],
  IN_TRANSIT: ['ARRIVED_AT_DESTINATION'],
  ARRIVED_AT_DESTINATION: ['OUT_FOR_DELIVERY', 'DELIVERED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
};

export const getMyDeliveries = async (statusFilter: 'PENDING' | 'COMPLETED' | 'ALL' = 'ALL') =>
  api.get<any[]>('/driver/deliveries', { filter: statusFilter });

export const getDeliveryDetails = async (deliveryId: string) => api.get<any>(`/driver/deliveries/${deliveryId}`);

export const transitionDriverStatus = async (
  deliveryId: string,
  currentStatus: string,
  newStatus: DriverDeliveryStatus,
  notes?: string,
  photoUrl?: string
) => {
  const allowedNext = VALID_TRANSITIONS[currentStatus || 'ASSIGNED'] || [];
  if (!allowedNext.includes(newStatus)) {
    throw new Error(`Invalid transition from ${currentStatus || 'ASSIGNED'} to ${newStatus}`);
  }

  let location: Location.LocationObject | null = null;
  try {
    location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  } catch {
    // location is optional (permission may be missing)
  }

  // The backend records the timeline event, advances the order and notifies the Farm Marketplace.
  await api.post(`/driver/deliveries/${deliveryId}/transition`, {
    status: newStatus,
    notes,
    photo_url: photoUrl,
    latitude: location?.coords.latitude,
    longitude: location?.coords.longitude,
  });
  return true;
};
