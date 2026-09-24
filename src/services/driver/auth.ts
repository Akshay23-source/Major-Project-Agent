import { api, getSession } from "../../lib/api";

export interface DeliveryPartner {
  id: string;
  agent_id: string;
  name: string;
  phone: string;
  vehicle_type: string | null;
  vehicle_number: string | null;
  license_number: string | null;
  status: "ONLINE" | "OFFLINE" | "BUSY" | "AVAILABLE" | "ON_DELIVERY" | "INACTIVE";
  rating: number;
  completed_deliveries: number;
  failed_deliveries: number;
  city: string | null;
  state: string | null;
  pincode: string | null;
  created_at: string;
}

export const getCurrentDriver = async (): Promise<DeliveryPartner | null> => {
  if (getSession()?.role !== "driver") return null;
  try {
    return await api.get<DeliveryPartner>("/driver/me");
  } catch (error) {
    console.error("Error fetching current driver:", error);
    return null;
  }
};

export const updateDriverStatus = async (status: "ONLINE" | "OFFLINE" | "BUSY"): Promise<boolean> => {
  try {
    await api.patch("/driver/me/status", { status });
    return true;
  } catch (error) {
    console.error("Error updating driver status:", error);
    return false;
  }
};
