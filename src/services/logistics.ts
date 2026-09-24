import { api } from '../lib/api';

export type DeliveryStatus =
  | 'ORDER_RECEIVED'
  | 'ORDER_CONFIRMED'
  | 'AWAITING_PICKUP'
  | 'PICKUP_ASSIGNED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'NEAR_DESTINATION'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'FAILED_DELIVERY'
  | 'RETURNED';

export type PartnerStatus = 'ONLINE' | 'OFFLINE' | 'AVAILABLE' | 'BUSY' | 'ON_DELIVERY' | 'INACTIVE';

export interface DeliveryPartner {
  id: string;
  name: string;
  phone: string;
  vehicle_type?: string;
  vehicle_number?: string;
  license_number?: string;
  status: PartnerStatus;
  rating: number;
  completed_deliveries: number;
  failed_deliveries: number;
  last_active_at?: string;
}

export interface Vehicle {
  id: string;
  vehicle_number: string;
  vehicle_type: string;
  capacity?: number;
  capacity_unit?: string;
  availability_status: string;
}

export interface Pickup {
  id: string;
  order_id: string;
  farmer_id?: string;
  delivery_partner_id?: string;
  vehicle_id?: string;
  status: string;
  expected_time?: string;
  actual_time?: string;
}

export interface Delivery {
  id: string;
  delivery_number?: string;
  order_id: string;
  delivery_partner_id?: string;
  vehicle_id?: string;
  pickup_location?: string;
  drop_location?: string;
  distance?: number;
  estimated_time?: number;
  status: DeliveryStatus;
  logistics_tracking_status: string;
}

// ── Delivery partners (drivers) ──────────────
export const getDeliveryPartners = () => api.get<DeliveryPartner[]>('/drivers');

export const getAvailablePartners = () => api.get<DeliveryPartner[]>('/drivers', { status: 'ONLINE,AVAILABLE' });

export const createDeliveryPartner = (data: {
  name: string;
  phone: string;
  vehicle_type?: string;
  vehicle_number?: string;
  license_number?: string;
}) => api.post<DeliveryPartner>('/drivers', data);

export const updateDeliveryPartner = (id: string, data: Partial<DeliveryPartner>) => api.patch<DeliveryPartner>(`/drivers/${id}`, data);

// ── Vehicles ─────────────────────────────────
export const getVehicles = () => api.get<Vehicle[]>('/vehicles');

export const getAvailableVehicles = () => api.get<Vehicle[]>('/vehicles', { availability_status: 'AVAILABLE' });

export const createVehicle = (data: { vehicle_number: string; vehicle_type: string; capacity?: number; capacity_unit?: string }) =>
  api.post<Vehicle>('/vehicles', data);

export const updateVehicle = (id: string, data: Partial<Vehicle>) => api.patch<Vehicle>(`/vehicles/${id}`, data);

// ── Dispatch ─────────────────────────────────
/**
 * One call: creates the delivery, assigns the driver (+ vehicle), records the
 * timeline and — for marketplace orders — notifies the Farm Marketplace.
 */
export const dispatchOrder = (
  orderId: string,
  data: { delivery_partner_id: string; vehicle_id?: string | null; pickup_location?: string; drop_location?: string; eta?: string; notes?: string }
) => api.post<Delivery>(`/logistics/orders/${orderId}/dispatch`, data);

/** Order + latest delivery + its timeline (dispatch screen). */
export const getDispatchView = (orderId: string) => api.get<{ order: any; delivery: any | null; events: any[] }>(`/logistics/orders/${orderId}`);

/** Agent sets the logistics status of an order (dispatch screen buttons). */
export const setOrderLogisticsStatus = (orderId: string, status: DeliveryStatus | string, reason?: string) =>
  api.post(`/logistics/orders/${orderId}/status`, { status, reason });

export const getLogisticsDashboard = () =>
  api.get<{ kpis: Record<string, number>; activeOrders: any[]; urgentOrders: any[] }>('/logistics/dashboard');

// ── Single-step helpers ──────────────────────
export const assignDelivery = async (deliveryId: string, partnerId: string): Promise<void> => {
  await api.post(`/deliveries/${deliveryId}/partner`, { delivery_partner_id: partnerId });
};

export const recordDeliveryEvent = async (deliveryId: string, eventType: string, description?: string, lat?: number, lon?: number): Promise<void> => {
  try {
    await api.post(`/deliveries/${deliveryId}/events`, { event_type: eventType, description, latitude: lat, longitude: lon });
  } catch (error) {
    console.error('Failed to record delivery event:', error);
  }
};

export const updateDeliveryStatus = async (deliveryId: string, status: DeliveryStatus): Promise<void> => {
  await api.post(`/deliveries/${deliveryId}/status`, { status });
};

export const assignVehicle = async (deliveryId: string, vehicleId: string): Promise<void> => {
  await api.post(`/deliveries/${deliveryId}/vehicle`, { vehicle_id: vehicleId });
};

export const createPickup = (pickupData: Partial<Pickup>) => api.post<Pickup>('/pickups', pickupData);

export const createDelivery = (deliveryData: Partial<Delivery>) => api.post<Delivery>('/deliveries', deliveryData);

export const getDeliveryTimeline = (deliveryId: string) => api.get<any[]>(`/deliveries/${deliveryId}/events`);
