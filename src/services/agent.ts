import { api, authApi } from "../lib/api";

export interface Agent {
  id: string;
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
  voice_enabled?: boolean;
  voice_auto_detect?: boolean;
  created_at: string;
}

export const getCurrentAgent = async (): Promise<Agent | null> => {
  try {
    return await api.get<Agent>("/agent/me");
  } catch (error) {
    console.error("Error fetching current agent:", error);
    return null;
  }
};

export const updateCurrentAgent = async (updates: Partial<Agent>): Promise<Agent | null> => {
  try {
    const { id, email, created_at, agent_code, ...allowed } = updates as any;
    return await api.patch<Agent>("/agent/me", allowed);
  } catch (error) {
    console.error("Error updating agent:", error);
    return null;
  }
};

/** Needs the current password (the backend verifies it before changing). */
export const changePassword = async (newPassword: string, currentPassword: string): Promise<boolean> => {
  try {
    await authApi.changePassword(currentPassword, newPassword);
    return true;
  } catch (error) {
    console.error("Error changing password:", error);
    return false;
  }
};
