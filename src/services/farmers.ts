import { supabase } from "../lib/supabase";

export interface Farmer {
  id: string;
  agent_id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  village: string;
  district: string;
  state?: string;
  pincode?: string;
  farm_name?: string;
  main_crops: string;
  land_size: string;
  farm_size_unit?: string;
  verification_status?: 'Verified' | 'Pending' | 'Rejected';
  notes?: string;
  created_at: string;
}

export const getFarmers = async (): Promise<Farmer[]> => {
  const { data, error } = await supabase
    .from("farmers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching farmers:", error);
    return [];
  }
  return data || [];
};

export const getFarmerById = async (id: string): Promise<Farmer | null> => {
  const { data, error } = await supabase
    .from("farmers")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching farmer:", error);
    return null;
  }
  return data;
};

export const createFarmer = async (farmerData: Omit<Farmer, "id" | "created_at" | "agent_id">): Promise<Farmer | null> => {
  const { data: userAuth } = await supabase.auth.getUser();
  if (!userAuth.user) return null;

  // We need to fetch the agent profile ID using the auth ID.
  const { data: agentData } = await supabase
    .from("agents")
    .select("id")
    .eq("auth_user_id", userAuth.user.id)
    .single();

  if (!agentData) return null;

  const { data, error } = await supabase
    .from("farmers")
    .insert({
      ...farmerData,
      agent_id: agentData.id
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating farmer:", error);
    return null;
  }
  return data;
};

export const updateFarmer = async (id: string, updates: Partial<Farmer>): Promise<Farmer | null> => {
  const { data, error } = await supabase
    .from("farmers")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating farmer:", error);
    return null;
  }
  return data;
};

export const deleteFarmer = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from("farmers")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting farmer:", error);
    return false;
  }
  return true;
};
