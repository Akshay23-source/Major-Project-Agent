import { api } from "../lib/api";
import { safe } from "./_safe";

export interface Buyer {
  id: string;
  agent_id: string;
  name: string;
  phone: string;
  email: string;
  location: string;
  type: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  buyer_type?: string;
  company_name?: string;
  notes?: string;
  status: string;
  created_at: string;
}

export const getBuyers = (): Promise<Buyer[]> => safe(api.get<Buyer[]>("/buyers"), [], "fetching buyers");

export const getBuyerById = (id: string): Promise<Buyer | null> => safe(api.get<Buyer>(`/buyers/${id}`), null, "fetching buyer");

export const createBuyer = (buyerData: Omit<Buyer, "id" | "created_at" | "agent_id">): Promise<Buyer | null> =>
  safe(api.post<Buyer>("/buyers", buyerData), null, "creating buyer");

export const updateBuyer = (id: string, updates: Partial<Buyer>): Promise<Buyer | null> =>
  safe(api.patch<Buyer>(`/buyers/${id}`, updates), null, "updating buyer");

export const deleteBuyer = (id: string): Promise<boolean> => safe(api.delete(`/buyers/${id}`).then(() => true), false, "deleting buyer");

export const getBuyerOrders = (buyerId: string): Promise<any[]> => safe(api.get<any[]>(`/buyers/${buyerId}/orders`), [], "fetching buyer orders");

export const getBuyerStats = async (buyerId: string) => {
  const orders = await getBuyerOrders(buyerId);

  let completedOrders = 0;
  let pendingOrders = 0;
  let totalPurchaseValue = 0;

  orders.forEach((order) => {
    totalPurchaseValue += parseFloat(order.total_amount) || 0;
    if (order.status === 'Completed' || order.status === 'Delivered') {
      completedOrders++;
    } else if (order.status === 'Pending' || order.status === 'Processing') {
      pendingOrders++;
    }
  });

  return { totalOrders: orders.length, completedOrders, pendingOrders, totalPurchaseValue };
};
