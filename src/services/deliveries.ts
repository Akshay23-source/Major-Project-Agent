import { api } from "../lib/api";

export interface Delivery {
  id: string;
  delivery_number: string;
  order_id: string;
  employee_id: string | null;
  status: "Pending" | "Assigned" | "Picked Up" | "In Transit" | "Delivered" | "Cancelled";
  eta?: string;
  pickup_time?: string;
  delivery_time?: string;
  cancellation_reason?: string;
  notes?: string;
  created_at: string;
}

const safe = async <T>(p: Promise<T>, fallback: T, what: string): Promise<T> => {
  try {
    return await p;
  } catch (error) {
    console.error(`Error ${what}:`, error);
    return fallback;
  }
};

export const getDeliveries = (): Promise<any[]> => safe(api.get<any[]>("/deliveries"), [], "fetching deliveries");

export const getDeliveryById = (id: string): Promise<any | null> => safe(api.get<any>(`/deliveries/${id}`), null, "fetching delivery");

export const getDeliveryByOrderId = (orderId: string): Promise<any | null> =>
  safe(api.get<any>(`/deliveries/by-order/${orderId}`), null, "fetching delivery for order");

/** Duplicate-protected on the server: returns the existing delivery if the order already has one. */
export const createDelivery = (deliveryData: Omit<Delivery, "id" | "created_at" | "delivery_number">): Promise<Delivery | null> =>
  safe(api.post<Delivery>("/deliveries", deliveryData), null, "creating delivery");

export const updateDeliveryStatus = (id: string, status: Delivery["status"]): Promise<Delivery | null> =>
  safe(api.post<Delivery>(`/deliveries/${id}/employee-status`, { status }), null, "updating delivery status");

export const assignDeliveryEmployee = (id: string, employee_id: string): Promise<Delivery | null> =>
  safe(api.post<Delivery>(`/deliveries/${id}/employee`, { employee_id }), null, "assigning employee to delivery");

export const updateDelivery = (id: string, updates: Partial<Delivery>): Promise<Delivery | null> =>
  safe(api.patch<Delivery>(`/deliveries/${id}`, updates), null, "updating delivery");

export const getEmployeeDeliveries = (employeeId: string): Promise<any[]> =>
  safe(api.get<any[]>(`/employees/${employeeId}/deliveries`), [], "fetching employee deliveries");
