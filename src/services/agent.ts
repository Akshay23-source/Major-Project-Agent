import { supabase } from "../lib/supabase";

export interface Agent {
  id: string;
  auth_user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  agent_code: string | null;
  assigned_area: string | null;
  business_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  notifications_enabled: boolean;
  theme: "System" | "Light" | "Dark";
  language: string;
  created_at: string;
}

export const getCurrentAgent = async (): Promise<Agent | null> => {
  const { data: userAuth } = await supabase.auth.getUser();
  if (!userAuth.user) return null;

  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("auth_user_id", userAuth.user.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return createDefaultAgentProfile(userAuth.user);
    }
    console.error("Error fetching current agent:", error);
    return null;
  }
  
  return data;
};

const createDefaultAgentProfile = async (user: any): Promise<Agent | null> => {
  const { data, error } = await supabase
    .from("agents")
    .insert({
      auth_user_id: user.id,
      name: user.user_metadata?.name || "Agri Agent",
      email: user.email || "",
      phone: user.user_metadata?.phone || "9876543210",
      agent_code: "AG-001",
      assigned_area: "Not set"
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating default agent:", error);
    return null;
  }

  return data;
};

export const updateCurrentAgent = async (updates: Partial<Agent>): Promise<Agent | null> => {
  const { data: userAuth } = await supabase.auth.getUser();
  if (!userAuth.user) return null;

  const { data, error } = await supabase
    .from("agents")
    .update(updates)
    .eq("auth_user_id", userAuth.user.id)
    .select()
    .single();

  if (error) {
    console.error("Error updating agent:", error);
    return null;
  }
  
  return data;
};

export const changePassword = async (newPassword: string): Promise<boolean> => {
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) {
    console.error("Error changing password:", error);
    return false;
  }

  return true;
};
