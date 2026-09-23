import { supabase } from "../lib/supabase";

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

export const getBuyers = async (): Promise<Buyer[]> => {
  const { data, error } = await supabase
    .from("buyers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Error fetching buyers:", error);
    return [];
  }
  return data || [];
};

export const getBuyerById = async (id: string): Promise<Buyer | null> => {
  const { data, error } = await supabase
    .from("buyers")
    .select("*")
    .eq("id", id)
    .single();
  if (error) {
    console.error("Error fetching buyer:", error);
    return null;
  }
  return data;
};

export const createBuyer = async (buyerData: Omit<Buyer, "id" | "created_at" | "agent_id">): Promise<Buyer | null> => {
  const { data: userAuth } = await supabase.auth.getUser();
  if (!userAuth.user) return null;

  const { data: agentData } = await supabase
    .from("agents")
    .select("id")
    .eq("auth_user_id", userAuth.user.id)
    .single();
  if (!agentData) return null;

  const { data, error } = await supabase
    .from("buyers")
    .insert({
      ...buyerData,
      agent_id: agentData.id
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating buyer:", error);
    return null;
  }
  return data;
};

export const updateBuyer = async (id: string, updates: Partial<Buyer>): Promise<Buyer | null> => {
  const { data, error } = await supabase
    .from("buyers")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("Error updating buyer:", error);
    return null;
  }
  return data;
};

export const deleteBuyer = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from("buyers")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("Error deleting buyer:", error);
    return false;
  }
  return true;
};

export const getBuyerOrders = async (buyerId: string): Promise<any[]> => {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching buyer orders:", error);
    return [];
  }
  return data || [];
};

export const getBuyerStats = async (buyerId: string) => {
  const orders = await getBuyerOrders(buyerId);
  
  let totalOrders = orders.length;
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

  return {
    totalOrders,
    completedOrders,
    pendingOrders,
    totalPurchaseValue
  };
};
