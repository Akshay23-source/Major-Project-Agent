import { supabase } from "../lib/supabase";
import { updateProductStock } from "./products";
import { initializeFinancialsForOrder } from "./finance";
import { createNotification } from "./notifications";

export interface Order {
  id: string;
  order_number: string;
  agent_id: string;
  farmer_id: string;
  buyer_id?: string;
  product_id?: string;
  product: string;
  quantity: number;
  unit: string;
  price: number;
  subtotal?: number;
  commission?: number;
  delivery_charge?: number;
  total_amount: number;
  delivery_location: string;
  notes: string;
  status: "Pending" | "Confirmed" | "Processing" | "Shipped" | "Delivered" | "Cancelled";
  cancellation_reason?: string;
  created_at: string;
}

export const getOrders = async (): Promise<any[]> => {
  const { data, error } = await supabase
    .from("orders")
    // If buyers table exists, it will join. Otherwise, it might fail. 
    // It's expected that user ran the SQL to create buyers and add buyer_id to orders.
    .select("*, farmers(name, phone), buyers(name)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching orders:", error);
    return [];
  }
  return data || [];
};

export const getOrderById = async (id: string): Promise<any | null> => {
  const { data, error } = await supabase
    .from("orders")
    .select("*, farmers(name, phone), buyers(name, phone, location)")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching order:", error);
    return null;
  }
  return data;
};

export const createOrder = async (orderData: Omit<Order, "id" | "created_at" | "agent_id" | "order_number">): Promise<Order | null> => {
  const { data: userAuth } = await supabase.auth.getUser();
  if (!userAuth.user) return null;

  const { data: agentData } = await supabase
    .from("agents")
    .select("id")
    .eq("auth_user_id", userAuth.user.id)
    .single();

  if (!agentData) return null;

  // Generate an order number like ORD-XXX based on count
  const { count } = await supabase.from("orders").select("*", { count: "exact", head: true });
  const orderCount = count || 0;
  const orderNumber = `ORD-${String(orderCount + 1).padStart(3, '0')}`;

  const { data, error } = await supabase
    .from("orders")
    .insert({
      ...orderData,
      order_number: orderNumber,
      agent_id: agentData.id
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating order:", error);
    return null;
  }

  // Deduct stock if linked to a product
  if (data && data.product_id) {
    await updateProductStock(
      data.product_id, 
      data.quantity, 
      "Remove", 
      `Order Placed: ${data.order_number}`
    );
  }

  // Initialize Financial records
  if (data) {
    await initializeFinancialsForOrder(data);
    await createNotification(
      "New Order",
      "New Order Created",
      `Order ${data.order_number} for ${data.product} has been placed.`,
      data.id,
      "order"
    );
  }

  return data;
};

export const updateOrderStatus = async (id: string, status: Order["status"], cancellationReason?: string): Promise<Order | null> => {
  // Check if we need to restore stock on cancellation
  if (status === 'Cancelled') {
    const order = await getOrderById(id);
    if (order && order.product_id && order.status !== 'Cancelled') {
      await updateProductStock(
        order.product_id,
        order.quantity,
        "Add",
        `Order Cancelled: ${order.order_number || order.id.substring(0,8)}`
      );
    }
  }

  const { data, error } = await supabase
    .from("orders")
    .update({ status, cancellation_reason: cancellationReason })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating order status:", error);
    return null;
  }
  
  if (data) {
    await createNotification(
      "Order Update",
      `Order ${status}`,
      `Order ${data.order_number || data.id.substring(0,8)} status changed to ${status}.`,
      data.id,
      "order"
    );
  }
  
  return data;
};
