import { supabase } from "../lib/supabase";
import { createNotification } from "./notifications";

export interface Delivery {
  id: string;
  delivery_number: string;
  order_id: string;
  employee_id: string | null;
  status: "Pending" | "Assigned" | "Picked Up" | "In Transit" | "Delivered" | "Cancelled";
  eta?: string;
  pickup_time?: string;
  delivery_time?: string;
  cancellation_reason?: string;
  notes?: string;
  created_at: string;
}

export const getDeliveries = async (): Promise<any[]> => {
  const { data, error } = await supabase
    .from("deliveries")
    .select("*, orders(product, quantity, unit, farmers(name), buyers(name)), employees(name, phone)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching deliveries:", error);
    return [];
  }
  return data || [];
};

export const getDeliveryById = async (id: string): Promise<any | null> => {
  const { data, error } = await supabase
    .from("deliveries")
    .select("*, orders(product, quantity, unit, farmers(name, phone, village), buyers(name, phone, location)), employees(name, phone)")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching delivery:", error);
    return null;
  }
  return data;
};

export const getDeliveryByOrderId = async (orderId: string): Promise<any | null> => {
  const { data, error } = await supabase
    .from("deliveries")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching delivery for order:", error);
    return null;
  }
  return data;
};

export const createDelivery = async (deliveryData: Omit<Delivery, "id" | "created_at" | "delivery_number">): Promise<Delivery | null> => {
  // DUPLICATE PROTECTION
  if (deliveryData.order_id) {
    const existing = await getDeliveryByOrderId(deliveryData.order_id);
    if (existing) {
      console.warn("Delivery already exists for this order. Returning existing delivery.");
      return existing;
    }
  }

  const { count } = await supabase.from("deliveries").select("*", { count: "exact", head: true });
  const countNum = count || 0;
  const deliveryNumber = `DLV-${String(countNum + 1).padStart(4, '0')}`;

  const { data, error } = await supabase
    .from("deliveries")
    .insert({
      ...deliveryData,
      delivery_number: deliveryNumber,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating delivery:", error);
    return null;
  }
  
  if (data) {
    await createNotification(
      "Delivery Created",
      "New Delivery",
      `Delivery ${data.delivery_number} has been created for order.`,
      data.id,
      "delivery"
    );
  }
  
  return data;
};

export const updateDeliveryStatus = async (id: string, status: Delivery["status"]): Promise<Delivery | null> => {
  const updates: any = { status };
  
  if (status === 'Picked Up') updates.pickup_time = new Date().toISOString();
  if (status === 'Delivered') updates.delivery_time = new Date().toISOString();

  const { data, error } = await supabase
    .from("deliveries")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating delivery status:", error);
    return null;
  }
  
  if (data) {
    await createNotification(
      "Delivery Update",
      `Delivery ${status}`,
      `Delivery ${data.delivery_number || data.id.substring(0,8)} is now ${status}.`,
      data.id,
      "delivery"
    );
  }
  
  return data;
};

export const assignDeliveryEmployee = async (id: string, employee_id: string): Promise<Delivery | null> => {
  const { data, error } = await supabase
    .from("deliveries")
    .update({ employee_id, status: 'Assigned' })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error assigning employee to delivery:", error);
    return null;
  }
  
  if (data) {
    await createNotification(
      "Delivery Assigned",
      "Employee Assigned",
      `Delivery ${data.delivery_number || data.id.substring(0,8)} has been assigned to an employee.`,
      data.id,
      "delivery"
    );
  }
  
  return data;
};

export const updateDelivery = async (id: string, updates: Partial<Delivery>): Promise<Delivery | null> => {
  const { data, error } = await supabase
    .from("deliveries")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating delivery:", error);
    return null;
  }
  return data;
};

export const getEmployeeDeliveries = async (employeeId: string): Promise<any[]> => {
  const { data, error } = await supabase
    .from("deliveries")
    .select("*, orders(product, quantity, unit, farmers(name), buyers(name))")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching employee deliveries:", error);
    return [];
  }
  return data || [];
};
