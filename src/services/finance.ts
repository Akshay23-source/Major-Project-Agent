import { supabase } from "../lib/supabase";
import { Order } from "./orders";
import { createNotification } from "./notifications";

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

export const initializeFinancialsForOrder = async (order: Order): Promise<boolean> => {
  try {
    // Create Payment (Buyer -> Agent)
    const { error: paymentError } = await supabase.from("payments").insert({
      order_id: order.id,
      buyer_id: order.buyer_id,
      amount: order.total_amount,
      payment_method: "Cash", // Default, can be changed later
      status: "Pending"
    });
    if (paymentError) throw paymentError;

    // Create Commission (Agent earnings)
    const commAmount = order.commission || 0;
    const rate = (commAmount / (order.subtotal || 1)) * 100;
    const { error: commError } = await supabase.from("commissions").insert({
      order_id: order.id,
      agent_id: order.agent_id,
      rate: rate,
      amount: commAmount,
      status: "Pending"
    });
    if (commError) throw commError;

    // Create Farmer Settlement (Agent -> Farmer)
    const gross = (order.quantity * order.price);
    const deductions = 0; // Configurable if needed
    const net = gross - commAmount - deductions;
    const { error: settleError } = await supabase.from("farmer_settlements").insert({
      farmer_id: order.farmer_id,
      order_id: order.id,
      gross_amount: gross,
      commission_deducted: commAmount,
      other_deductions: deductions,
      net_amount: net,
      status: "Pending"
    });
    if (settleError) throw settleError;

    return true;
  } catch (error) {
    console.error("Error initializing financials:", error);
    return false;
  }
};

export const getPayments = async (): Promise<any[]> => {
  const { data, error } = await supabase
    .from("payments")
    .select("*, orders(order_number, product, buyers(name, phone))")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching payments:", error);
    return [];
  }
  return data || [];
};

export const getPaymentById = async (id: string): Promise<any | null> => {
  const { data, error } = await supabase
    .from("payments")
    .select("*, orders(order_number, product, quantity, subtotal, delivery_charge, commission, total_amount, buyers(name, phone))")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching payment:", error);
    return null;
  }
  return data;
};

export const getPaymentByOrderId = async (orderId: string): Promise<any | null> => {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();
  
  if (error) {
    console.error("Error fetching payment for order:", error);
    return null;
  }
  return data;
};

export const updatePaymentStatus = async (
  id: string, 
  status: Payment["status"], 
  method?: string, 
  reference?: string,
  notes?: string
): Promise<boolean> => {
  const updateData: any = { status };
  if (status === 'Completed') {
    updateData.paid_at = new Date().toISOString();
  }
  if (method) updateData.payment_method = method;
  if (reference) updateData.transaction_reference = reference;
  if (notes !== undefined) updateData.notes = notes;

  const { error } = await supabase.from("payments").update(updateData).eq("id", id);
  
  if (error) {
    console.error("Error updating payment:", error);
    return false;
  }
  
  await createNotification(
    "Payment Update",
    `Payment ${status}`,
    `A payment for order is now ${status}.`,
    id,
    "payment"
  );
  
  return true;
};

export const getFarmerSettlements = async (): Promise<any[]> => {
  const { data, error } = await supabase
    .from("farmer_settlements")
    .select("*, farmers(name, phone), orders(order_number, product)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching settlements:", error);
    return [];
  }
  return data || [];
};

export const getSettlementById = async (id: string): Promise<any | null> => {
  const { data, error } = await supabase
    .from("farmer_settlements")
    .select(`
      *,
      orders ( order_number, total_amount, product, quantity, unit, price ),
      farmers ( name, phone, village )
    `)
    .eq("id", id)
    .single();
    
  if (error) {
    console.error("Error fetching settlement:", error);
    return null;
  }
  return data;
};

export const getSettlementByOrderId = async (orderId: string): Promise<any | null> => {
  const { data, error } = await supabase
    .from("farmer_settlements")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();
    
  if (error) {
    console.error("Error fetching settlement by order id:", error);
    return null;
  }
  return data;
};

export const markSettlementAsPaid = async (
  id: string,
  method: string,
  reference: string,
  notes?: string
): Promise<boolean> => {
  const updateData: any = {
    status: "Paid",
    payment_method: method,
    transaction_reference: reference,
    paid_at: new Date().toISOString()
  };
  if (notes !== undefined) updateData.notes = notes;

  const { error } = await supabase
    .from("farmer_settlements")
    .update(updateData)
    .eq("id", id);
    
  if (error) {
    console.error("Error paying settlement:", error);
    return false;
  }
  
  await createNotification(
    "Settlement Paid",
    "Settlement Completed",
    `Farmer settlement has been marked as paid via ${method}.`,
    id,
    "settlement"
  );
  
  return true;
};

export const getCommissions = async (): Promise<any[]> => {
  const { data, error } = await supabase
    .from("commissions")
    .select("*, orders(order_number, product, total_amount)")
    .order("created_at", { ascending: false });
    
  if (error) {
    console.error("Error fetching commissions:", error);
    return [];
  }
  return data || [];
};

export const updateCommissionStatus = async (id: string, status: Commission["status"]): Promise<boolean> => {
  const { error } = await supabase
    .from("commissions")
    .update({ status })
    .eq("id", id);
    
  if (error) {
    console.error("Error updating commission:", error);
    return false;
  }
  return true;
};

export const getFarmerFinancialStats = async (farmerId: string): Promise<any> => {
  const { data, error } = await supabase
    .from("farmer_settlements")
    .select("net_amount, status")
    .eq("farmer_id", farmerId);
    
  if (error) {
    console.error("Error fetching farmer stats:", error);
    return { totalSales: 0, totalPaid: 0, outstanding: 0 };
  }
  
  let totalSales = 0;
  let totalPaid = 0;
  let outstanding = 0;
  
  (data || []).forEach((s: any) => {
    const amt = parseFloat(s.net_amount) || 0;
    totalSales += amt;
    if (s.status === 'Paid') {
      totalPaid += amt;
    } else if (s.status === 'Pending') {
      outstanding += amt;
    }
  });
  
  return { totalSales, totalPaid, outstanding };
};
