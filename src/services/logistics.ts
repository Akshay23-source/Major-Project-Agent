import { supabase } from '../lib/supabase';
import { getCurrentAgent } from './agent';

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
  farmer_id: string;
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

export const getDeliveryPartners = async (): Promise<DeliveryPartner[]> => {
  const agent = await getCurrentAgent();
  if (!agent) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from('delivery_partners')
    .select('*')
    .eq('agent_id', agent.id)
    .order('name');

  if (error) throw error;
  return data || [];
};

export const getAvailablePartners = async (): Promise<DeliveryPartner[]> => {
  const agent = await getCurrentAgent();
  if (!agent) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from('delivery_partners')
    .select('*')
    .eq('agent_id', agent.id)
    .in('status', ['ONLINE', 'AVAILABLE'])
    .order('rating', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const assignDelivery = async (deliveryId: string, partnerId: string): Promise<void> => {
  const agent = await getCurrentAgent();
  if (!agent) throw new Error("Not authenticated");

  const { error } = await supabase
    .from('deliveries')
    .update({ 
      delivery_partner_id: partnerId,
      status: 'PICKUP_ASSIGNED' 
    })
    .eq('id', deliveryId);

  if (error) throw error;

  // Record audit event
  await recordDeliveryEvent(deliveryId, 'ASSIGNED', `Assigned to partner ${partnerId}`);
};

export const recordDeliveryEvent = async (deliveryId: string, eventType: string, description?: string, lat?: number, lon?: number): Promise<void> => {
  const agent = await getCurrentAgent();
  if (!agent) return; // Silent return for now if no agent context

  const { error } = await supabase
    .from('delivery_events')
    .insert({
      delivery_id: deliveryId,
      agent_id: agent.id,
      event_type: eventType,
      description: description || '',
      latitude: lat,
      longitude: lon
    });

  if (error) console.error('Failed to record delivery event:', error);
};

export const updateDeliveryStatus = async (deliveryId: string, status: DeliveryStatus): Promise<void> => {
  const { error } = await supabase
    .from('deliveries')
    .update({ status })
    .eq('id', deliveryId);

  if (error) throw error;

  await recordDeliveryEvent(deliveryId, status, `Status changed to ${status}`);
};

export const getAvailableVehicles = async (): Promise<Vehicle[]> => {
  const agent = await getCurrentAgent();
  if (!agent) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('agent_id', agent.id)
    .eq('availability_status', 'AVAILABLE')
    .order('vehicle_number');

  if (error) throw error;
  return data || [];
};

export const assignVehicle = async (deliveryId: string, vehicleId: string): Promise<void> => {
  const agent = await getCurrentAgent();
  if (!agent) throw new Error("Not authenticated");

  const { error } = await supabase
    .from('deliveries')
    .update({ 
      vehicle_id: vehicleId 
    })
    .eq('id', deliveryId);

  if (error) throw error;

  // Also update vehicle status
  await supabase.from('vehicles').update({ availability_status: 'ASSIGNED' }).eq('id', vehicleId);

  await recordDeliveryEvent(deliveryId, 'VEHICLE_ASSIGNED', `Assigned vehicle ${vehicleId}`);
};

export const createPickup = async (pickupData: Partial<Pickup>): Promise<Pickup> => {
  const { data, error } = await supabase
    .from('pickups')
    .insert({
      ...pickupData,
      status: 'ASSIGNED'
    })
    .select()
    .single();

  if (error) throw error;
  
  if (data.delivery_partner_id) {
    await supabase.from('delivery_partners').update({ status: 'BUSY' }).eq('id', data.delivery_partner_id);
  }

  return data;
};

export const createDelivery = async (deliveryData: Partial<Delivery>): Promise<Delivery> => {
  const { data, error } = await supabase
    .from('deliveries')
    .insert({
      ...deliveryData,
      // deliveries.delivery_number is NOT NULL; without it this insert always failed
      delivery_number: deliveryData.delivery_number || `DLV-${Date.now().toString(36).toUpperCase()}`,
      status: 'AWAITING_PICKUP',
      logistics_tracking_status: 'ASSIGNED'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getDeliveryTimeline = async (deliveryId: string): Promise<any[]> => {
  const { data, error } = await supabase
    .from('delivery_events')
    .select('*')
    .eq('delivery_id', deliveryId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
};

