import { supabase } from "../../lib/supabase";

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
 * Ingests an order from the external marketplace into AgriAgent's Logistics system.
 * It intelligently maps or creates Buyer, Farmer, and Product records before creating the Order.
 */
export const ingestMarketplaceOrder = async (payload: ExternalMarketplaceOrder, agentId: string) => {
  try {
    // 1. Resolve or Create Buyer
    let { data: buyer } = await supabase
      .from("buyers")
      .select("id")
      .eq("external_customer_id", payload.customer_id)
      .eq("agent_id", agentId)
      .maybeSingle();

    if (!buyer) {
      const { data: newBuyer, error: buyerErr } = await supabase.from("buyers").insert({
        agent_id: agentId,
        external_customer_id: payload.customer_id,
        name: payload.customer.name,
        phone: payload.customer.phone,
        address: payload.customer.delivery_address,
        city: payload.customer.city,
        state: payload.customer.state,
        pincode: payload.customer.pincode
      }).select("id").single();
      
      if (buyerErr) throw new Error(`Buyer ingestion failed: ${buyerErr.message}`);
      buyer = newBuyer;
    }

    // 2. Resolve or Create Farmer
    let { data: farmer } = await supabase
      .from("farmers")
      .select("id")
      .eq("external_farmer_id", payload.farmer_id)
      .eq("agent_id", agentId)
      .maybeSingle();

    if (!farmer) {
      const { data: newFarmer, error: farmerErr } = await supabase.from("farmers").insert({
        agent_id: agentId,
        external_farmer_id: payload.farmer_id,
        name: payload.farmer.name,
        phone: payload.farmer.phone,
        farm_name: payload.farmer.farm_name,
        village: payload.farmer.village,
        district: payload.farmer.district,
        state: payload.farmer.state,
        pincode: payload.farmer.pincode
      }).select("id").single();
      
      if (farmerErr) throw new Error(`Farmer ingestion failed: ${farmerErr.message}`);
      farmer = newFarmer;
    }

    // 3. Resolve or Create Product (Operational Proxy)
    let { data: product } = await supabase
      .from("products")
      .select("id")
      .eq("external_product_id", payload.product_id)
      .eq("agent_id", agentId)
      .maybeSingle();

    if (!product) {
      const { data: newProduct, error: prodErr } = await supabase.from("products").insert({
        agent_id: agentId,
        farmer_id: farmer.id,
        external_product_id: payload.product_id,
        name: payload.product.name,
        category: payload.product.category,
        unit: payload.product.unit,
        price: 0, // Logistics doesn't need to track actual product price per se
        quantity: 0, 
        status: "Active"
      }).select("id").single();
      
      if (prodErr) throw new Error(`Product ingestion failed: ${prodErr.message}`);
      product = newProduct;
    }

    // 4. Create Logistics Order
    const { data: order, error: orderErr } = await supabase.from("orders").insert({
      agent_id: agentId,
      farmer_id: farmer.id,
      buyer_id: buyer.id,
      external_order_id: payload.order_id,
      external_customer_id: payload.customer_id,
      external_farmer_id: payload.farmer_id,
      external_product_id: payload.product_id,
      product: payload.product.name,
      quantity: payload.quantity,
      unit: payload.product.unit,
      total_amount: payload.amount,
      status: payload.order_status,
      logistics_status: "PENDING",
      is_perishable: payload.is_perishable || false,
      is_fragile: payload.is_fragile || false,
      priority: payload.priority || "NORMAL",
      payment_status: payload.payment_status
    }).select("id").single();

    if (orderErr) throw new Error(`Order ingestion failed: ${orderErr.message}`);

    return { success: true, orderId: order.id };

  } catch (error: any) {
    console.error("Ingestion Error:", error.message);
    return { success: false, error: error.message };
  }
};
