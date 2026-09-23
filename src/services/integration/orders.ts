
export interface ExternalMarketplaceOrder {
  order_id: string;
  customer_id: string;
  farmer_id: string;
  product_id: string;
  quantity: number;
  amount: number;
  payment_status: string;
  order_status: string;
  created_at: string;
  is_perishable?: boolean;
  is_fragile?: boolean;
  priority?: "NORMAL" | "HIGH" | "URGENT";
  customer: {
    name: string;
    phone: string;
    delivery_address: string;
    city: string;
    district: string;
    state: string;
    pincode: string;
    latitude?: number;
    longitude?: number;
  };
  farmer: {
    name: string;
    phone: string;
    farm_name: string;
    pickup_address: string;
    village: string;
    district: string;
    state: string;
    pincode: string;
    latitude?: number;
    longitude?: number;
  };
  product: {
    name: string;
    category: string;
    unit: string;
    handling_requirements?: string;
    weight?: number;
  };
}

/**
 * @deprecated DISABLED — this used to copy marketplace buyers, farmers and
 * products into Agri Agent's own tables, which violates the data-ownership
 * rule: Farm Marketplace (MongoDB) is the system of record for accounts,
 * products and payments; Agri Agent keeps only the logistics copy.
 *
 * Orders now arrive through the `ingest-marketplace-order` Edge Function,
 * which stores a logistics-only job (see migration 014). Nothing calls this
 * function; it is kept only so old imports still compile.
 */
export const ingestMarketplaceOrder = async (
  _payload: ExternalMarketplaceOrder,
  _agentId: string
): Promise<{ success: false; error: string }> => {
  return {
    success: false,
    error: "Disabled: marketplace orders are ingested server-side by the ingest-marketplace-order Edge Function.",
  };
};
