import { supabase } from '../../lib/supabase';
import { getCurrentDriver } from './auth';
import { DeliveryStatus } from '../logistics';
import * as Location from 'expo-location';
import { kickMarketplaceSync } from '../integration/marketplaceSync';

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

// Validation map to ensure driver doesn't skip steps
const VALID_TRANSITIONS: Record<string, string[]> = {
  'ASSIGNED': ['ACCEPTED'],
  'ACCEPTED': ['DRIVER_EN_ROUTE'],
  'DRIVER_EN_ROUTE': ['ARRIVED_AT_FARM'],
  'ARRIVED_AT_FARM': ['PICKED_UP'],
  'PICKED_UP': ['IN_TRANSIT'],
  'IN_TRANSIT': ['ARRIVED_AT_DESTINATION'],
  'ARRIVED_AT_DESTINATION': ['OUT_FOR_DELIVERY', 'DELIVERED'],
  'OUT_FOR_DELIVERY': ['DELIVERED'],
  'DELIVERED': []
};

export const getMyDeliveries = async (statusFilter?: 'PENDING' | 'COMPLETED' | 'ALL') => {
  const driver = await getCurrentDriver();
  if (!driver) throw new Error("Not authenticated as driver");

  let query = supabase
    .from('deliveries')
    .select(`
      *,
      orders (
        id, order_number, product, quantity, unit, total_amount, payment_status,
        farmers ( id, name, phone, address, village ),
        buyers ( id, name, phone, address, pincode )
      ),
      vehicles ( id, vehicle_number, vehicle_type )
    `)
    .eq('delivery_partner_id', driver.id);

  if (statusFilter === 'PENDING') {
    query = query.neq('logistics_tracking_status', 'DELIVERED');
  } else if (statusFilter === 'COMPLETED') {
    query = query.eq('logistics_tracking_status', 'DELIVERED');
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getDeliveryDetails = async (deliveryId: string) => {
  const driver = await getCurrentDriver();
  if (!driver) throw new Error("Not authenticated as driver");

  const { data, error } = await supabase
    .from('deliveries')
    .select(`
      *,
      orders (
        id, order_number, product, quantity, unit, total_amount, priority, is_perishable, is_fragile,
        farmers ( id, name, phone, address, village ),
        buyers ( id, name, phone, address, pincode )
      ),
      vehicles ( id, vehicle_number, vehicle_type )
    `)
    .eq('id', deliveryId)
    .eq('delivery_partner_id', driver.id)
    .single();

  if (error) throw error;
  return data;
};

export const transitionDriverStatus = async (
  deliveryId: string, 
  currentStatus: string,
  newStatus: DriverDeliveryStatus,
  notes?: string,
  photoUrl?: string
) => {
  const driver = await getCurrentDriver();
  if (!driver) throw new Error("Not authenticated as driver");

  // Enforce valid state machine
  const current = currentStatus || 'ASSIGNED';
  const allowedNext = VALID_TRANSITIONS[current] || [];
  
  if (!allowedNext.includes(newStatus)) {
    throw new Error(`Invalid transition from ${current} to ${newStatus}`);
  }

  // Update delivery
  const { error: updateError } = await supabase
    .from('deliveries')
    .update({ logistics_tracking_status: newStatus })
    .eq('id', deliveryId)
    .eq('delivery_partner_id', driver.id);

  if (updateError) throw updateError;

  // Sync main logistics status based on driver status
  let orderStatusSync: DeliveryStatus | null = null;
  if (newStatus === 'ACCEPTED') orderStatusSync = 'PICKUP_ASSIGNED';
  if (newStatus === 'PICKED_UP') orderStatusSync = 'PICKED_UP';
  if (newStatus === 'IN_TRANSIT') orderStatusSync = 'IN_TRANSIT';
  if (newStatus === 'OUT_FOR_DELIVERY') orderStatusSync = 'OUT_FOR_DELIVERY';
  if (newStatus === 'DELIVERED') orderStatusSync = 'DELIVERED';

  if (orderStatusSync) {
    await supabase.from('deliveries').update({ status: orderStatusSync }).eq('id', deliveryId);
  }

  // Record Event
  let location: Location.LocationObject | null = null;
  try {
    location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  } catch (e) {
    // Ignore location fetch error if permissions missing
  }

  let description = notes || `Driver transitioned to ${newStatus}`;
  if (photoUrl) {
    description += `\n[Photo Proof attached]`;
  }

  const { error: eventError } = await supabase
    .from('delivery_events')
    .insert({
      delivery_id: deliveryId,
      event_type: newStatus,
      description,
      latitude: location?.coords.latitude,
      longitude: location?.coords.longitude
    });

  if (eventError) console.error('Failed to log driver event:', eventError);

  // If delivered, mark driver as available/online
  if (newStatus === 'DELIVERED') {
    await supabase.from('delivery_partners').update({ status: 'ONLINE' }).eq('id', driver.id);
  }

  // The event above is queued for the Farm Marketplace by a DB trigger;
  // nudge the callback worker so the buyer sees it right away.
  kickMarketplaceSync();

  return true;
};
