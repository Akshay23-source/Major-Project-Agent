import { supabase } from "../../lib/supabase";

export interface DeliveryPartner {
  id: string;
  auth_user_id: string | null;
  agent_id: string;
  name: string;
  phone: string;
  vehicle_type: string | null;
  vehicle_number: string | null;
  license_number: string | null;
  status: "ONLINE" | "OFFLINE" | "BUSY";
  rating: number;
  completed_deliveries: number;
  failed_deliveries: number;
  city: string | null;
  state: string | null;
  pincode: string | null;
  created_at: string;
}

export const getCurrentDriver = async (): Promise<DeliveryPartner | null> => {
  const { data: userAuth } = await supabase.auth.getUser();
  if (!userAuth.user) return null;

  const { data, error } = await supabase
    .from("delivery_partners")
    .select("*")
    .eq("auth_user_id", userAuth.user.id)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error("Error fetching current driver:", error);
    }
    return null;
  }
  
  return data;
};

export const linkDriverAccount = async (phoneNumber: string): Promise<boolean> => {
  const { data: userAuth } = await supabase.auth.getUser();
  if (!userAuth.user) return false;

  // Call the SECURITY DEFINER RPC to link the account
  const { data, error } = await supabase.rpc("link_driver_account", {
    phone_number: phoneNumber
  });

  if (error) {
    console.error("Error linking driver account:", error);
    return false;
  }

  return !!data;
};

export const updateDriverStatus = async (status: "ONLINE" | "OFFLINE" | "BUSY"): Promise<boolean> => {
  const { data: userAuth } = await supabase.auth.getUser();
  if (!userAuth.user) return false;

  const { error } = await supabase
    .from("delivery_partners")
    .update({ status })
    .eq("auth_user_id", userAuth.user.id);

  if (error) {
    console.error("Error updating driver status:", error);
    return false;
  }

  return true;
};
