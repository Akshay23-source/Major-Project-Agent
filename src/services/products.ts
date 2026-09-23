import { supabase } from "../lib/supabase";
import { createNotification } from "./notifications";

export interface Product {
  id: string;
  agent_id: string;
  farmer_id: string;
  name: string;
  category: string;
  description?: string;
  quantity: number;
  unit: string;
  price: number;
  min_order_quantity?: number;
  harvest_date?: string;
  best_before_date?: string;
  status: "Active" | "Inactive" | "Seasonal" | "Out of Stock";
  notes?: string;
  created_at: string;
}

export interface InventoryHistory {
  id: string;
  product_id: string;
  action: string;
  quantity_change: number;
  previous_stock: number;
  new_stock: number;
  reason?: string;
  created_at: string;
}

export const getProducts = async (): Promise<any[]> => {
  const { data, error } = await supabase
    .from("products")
    .select("*, farmers(name, village, district, state, phone)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching products:", error);
    return [];
  }
  return data || [];
};

export const getProductById = async (id: string): Promise<any | null> => {
  const { data, error } = await supabase
    .from("products")
    .select("*, farmers(name, phone, village, district, state)")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching product:", error);
    return null;
  }
  return data;
};

export const getInventoryHistory = async (productId: string): Promise<InventoryHistory[]> => {
  const { data, error } = await supabase
    .from("inventory_history")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching inventory history:", error);
    return [];
  }
  return data || [];
};

export const createProduct = async (productData: Omit<Product, "id" | "created_at" | "agent_id">): Promise<Product | null> => {
  const { data: userAuth } = await supabase.auth.getUser();
  if (!userAuth.user) return null;

  const { data: agentData } = await supabase
    .from("agents")
    .select("id")
    .eq("auth_user_id", userAuth.user.id)
    .single();

  if (!agentData) return null;

  const { data, error } = await supabase
    .from("products")
    .insert({
      ...productData,
      agent_id: agentData.id
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating product:", error);
    return null;
  }

  // Create initial inventory history if quantity > 0
  if (data && data.quantity > 0) {
    await supabase.from("inventory_history").insert({
      product_id: data.id,
      action: "Initial Stock",
      quantity_change: data.quantity,
      previous_stock: 0,
      new_stock: data.quantity,
      reason: "Product created"
    });
  }

  return data;
};

export const updateProduct = async (id: string, updates: Partial<Product>): Promise<Product | null> => {
  const { data, error } = await supabase
    .from("products")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating product:", error);
    return null;
  }
  return data;
};

export const updateProductStock = async (
  id: string, 
  quantityChange: number, 
  action: "Add" | "Remove" | "Set",
  reason: string
): Promise<Product | null> => {
  
  // This is a naive fallback if RPC doesn't exist. It has potential race conditions.
  // We first fetch the current stock
  const { data: currentProduct, error: fetchError } = await supabase
    .from("products")
    .select("quantity")
    .eq("id", id)
    .single();
    
  if (fetchError || !currentProduct) {
    console.error("Failed to fetch current stock");
    return null;
  }

  let newQuantity = currentProduct.quantity;
  if (action === "Add") newQuantity += quantityChange;
  else if (action === "Remove") newQuantity -= quantityChange;
  else if (action === "Set") newQuantity = quantityChange;

  if (newQuantity < 0) {
    console.error("Stock cannot be negative.");
    return null;
  }

  let newStatus = "Active";
  if (newQuantity === 0) newStatus = "Out of Stock";

  // Update stock
  const { data: updatedProduct, error: updateError } = await supabase
    .from("products")
    .update({ quantity: newQuantity, status: newStatus })
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    console.error("Error updating stock:", updateError);
    return null;
  }

  // Record history
  await supabase.from("inventory_history").insert({
    product_id: id,
    action: `Stock ${action}`,
    quantity_change: action === "Set" ? (newQuantity - currentProduct.quantity) : (action === "Remove" ? -quantityChange : quantityChange),
    previous_stock: currentProduct.quantity,
    new_stock: newQuantity,
    reason: reason
  });

  // Check for stock alerts
  if (action !== "Add") {
    const minQty = updatedProduct?.min_order_quantity || 0;
    const LOW_STOCK_THRESHOLD = 20;
    
    if (newQuantity === 0) {
      await createNotification(
        "Out of Stock",
        "Product Out of Stock",
        `${updatedProduct?.name || 'Product'} has reached zero inventory.`,
        id,
        "product"
      );
    } else if (newQuantity <= LOW_STOCK_THRESHOLD || (minQty > 0 && newQuantity <= minQty * 2)) {
      await createNotification(
        "Low Stock",
        "Product Low Stock",
        `${updatedProduct?.name || 'Product'} is running low (${newQuantity} remaining).`,
        id,
        "product"
      );
    }
  }

  return updatedProduct;
};

export const getStockStatus = (quantity: number, minOrderQuantity: number = 0): { label: string, color: string } => {
  const LOW_STOCK_THRESHOLD = 20; 
  if (quantity === 0) return { label: "Out of Stock", color: "error" };
  if (quantity <= LOW_STOCK_THRESHOLD || (minOrderQuantity > 0 && quantity <= minOrderQuantity * 2)) return { label: "Low Stock", color: "warning" };
  return { label: "In Stock", color: "success" };
};
