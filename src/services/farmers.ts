import { api } from "../lib/api";
import { safe } from "./_safe";

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

export const getFarmers = (): Promise<Farmer[]> => safe(api.get<Farmer[]>("/farmers"), [], "fetching farmers");

export const getFarmerById = (id: string): Promise<Farmer | null> => safe(api.get<Farmer>(`/farmers/${id}`), null, "fetching farmer");

export const createFarmer = (farmerData: Omit<Farmer, "id" | "created_at" | "agent_id">): Promise<Farmer | null> =>
  safe(api.post<Farmer>("/farmers", farmerData), null, "creating farmer");

export const updateFarmer = (id: string, updates: Partial<Farmer>): Promise<Farmer | null> =>
  safe(api.patch<Farmer>(`/farmers/${id}`, updates), null, "updating farmer");

export const deleteFarmer = async (id: string): Promise<boolean> =>
  safe(api.delete(`/farmers/${id}`).then(() => true), false, "deleting farmer");
