import { api } from "../lib/api";
import { safe } from "./_safe";

/**
 * The agent's own finances for orders they book themselves.
 * (Farm Marketplace payments and escrow are never stored in Agri Agent.)
 */

export interface Payment {
  id: string;
  order_id: string;
  buyer_id?: string;
  amount: number;
  payment_method: string;
  status: "Pending" | "Processing" | "Completed" | "Failed" | "Refunded" | "Cancelled";
  transaction_reference?: string;
  notes?: string;
  paid_at?: string;
  created_at: string;
}

export interface Commission {
  id: string;
  order_id: string;
  agent_id: string;
  rate: number;
  amount: number;
  status: "Pending" | "Earned" | "Paid" | "Cancelled";
  created_at: string;
}

export interface FarmerSettlement {
  id: string;
  farmer_id: string;
  order_id: string;
  gross_amount: number;
  commission_deducted: number;
  other_deductions: number;
  net_amount: number;
  status: "Pending" | "Paid" | "Cancelled";
  paid_at?: string;
  payment_method?: string;
  transaction_reference?: string;
  notes?: string;
  created_at: string;
}

// Payment, commission and settlement records are created by the server when an order is booked.

export const getPayments = (): Promise<any[]> => safe(api.get<any[]>("/payments"), [], "fetching payments");

export const getPaymentById = (id: string): Promise<any | null> => safe(api.get<any>(`/payments/${id}`), null, "fetching payment");

export const getPaymentByOrderId = (orderId: string): Promise<any | null> =>
  safe(api.get<any>(`/payments/by-order/${orderId}`), null, "fetching payment for order");

export const updatePaymentStatus = (
  id: string,
  status: Payment["status"],
  method?: string,
  reference?: string,
  notes?: string
): Promise<boolean> =>
  safe(
    api.patch(`/payments/${id}`, { status, payment_method: method, transaction_reference: reference, notes }).then(() => true),
    false,
    "updating payment"
  );

export const getFarmerSettlements = (): Promise<any[]> => safe(api.get<any[]>("/settlements"), [], "fetching settlements");

export const getSettlementById = (id: string): Promise<any | null> => safe(api.get<any>(`/settlements/${id}`), null, "fetching settlement");

export const getSettlementByOrderId = (orderId: string): Promise<any | null> =>
  safe(api.get<any>(`/settlements/by-order/${orderId}`), null, "fetching settlement by order id");

export const markSettlementAsPaid = (id: string, method: string, reference: string, notes?: string): Promise<boolean> =>
  safe(
    api.post(`/settlements/${id}/pay`, { payment_method: method, transaction_reference: reference, notes }).then(() => true),
    false,
    "paying settlement"
  );

export const getCommissions = (): Promise<any[]> => safe(api.get<any[]>("/commissions"), [], "fetching commissions");

export const updateCommissionStatus = (id: string, status: Commission["status"]): Promise<boolean> =>
  safe(api.patch(`/commissions/${id}`, { status }).then(() => true), false, "updating commission");

export const getFarmerFinancialStats = (farmerId: string): Promise<any> =>
  safe(api.get<any>(`/farmers/${farmerId}/financial-stats`), { totalSales: 0, totalPaid: 0, outstanding: 0 }, "fetching farmer stats");
