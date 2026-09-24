import { api } from "../lib/api";

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
  try {
    return await api.get<any[]>("/orders");
  } catch (error) {
    console.error("Error fetching orders:", error);
    return [];
  }
};

export const getOrderById = async (id: string): Promise<any | null> => {
  try {
    return await api.get<any>(`/orders/${id}`);
  } catch (error) {
    console.error("Error fetching order:", error);
    return null;
  }
};

/** Orders that have no delivery yet (Deliveries → Add). */
export const getOrdersWithoutDelivery = async (): Promise<any[]> => {
  try {
    return await api.get<any[]>("/orders/without-delivery");
  } catch (error) {
    console.error("Error fetching orders without delivery:", error);
    return [];
  }
};

/**
 * The server assigns the order number, deducts stock for a linked product,
 * creates the payment / commission / settlement records and a notification.
 */
export const createOrder = async (orderData: Omit<Order, "id" | "created_at" | "agent_id" | "order_number">): Promise<Order | null> => {
  try {
    return await api.post<Order>("/orders", orderData);
  } catch (error) {
    console.error("Error creating order:", error);
    return null;
  }
};

/** Cancelling restores stock for a linked product (server-side). */
export const updateOrderStatus = async (id: string, status: Order["status"], cancellationReason?: string): Promise<Order | null> => {
  try {
    return await api.post<Order>(`/orders/${id}/status`, { status, cancellation_reason: cancellationReason });
  } catch (error) {
    console.error("Error updating order status:", error);
    return null;
  }
};
