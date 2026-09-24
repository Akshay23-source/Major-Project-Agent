import { api } from "../lib/api";
import { safe } from "./_safe";

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

export const getProducts = (): Promise<any[]> => safe(api.get<any[]>("/products"), [], "fetching products");

export const getProductById = (id: string): Promise<any | null> => safe(api.get<any>(`/products/${id}`), null, "fetching product");

export const getInventoryHistory = (productId: string): Promise<InventoryHistory[]> =>
  safe(api.get<InventoryHistory[]>(`/products/${productId}/inventory`), [], "fetching inventory history");

/** Initial stock is recorded in the inventory history by the server. */
export const createProduct = (productData: Omit<Product, "id" | "created_at" | "agent_id">): Promise<Product | null> =>
  safe(api.post<Product>("/products", productData), null, "creating product");

/** Product details only — use updateProductStock for quantity changes. */
export const updateProduct = (id: string, updates: Partial<Product>): Promise<Product | null> =>
  safe(api.patch<Product>(`/products/${id}`, updates), null, "updating product");

/**
 * Atomic stock change on the server (no read-then-write race). Refuses to go
 * below zero, records inventory history and raises low / out-of-stock alerts.
 */
export const updateProductStock = (
  id: string,
  quantityChange: number,
  action: "Add" | "Remove" | "Set",
  reason: string
): Promise<Product | null> =>
  safe(api.post<Product>(`/products/${id}/stock`, { quantity_change: quantityChange, action, reason }), null, "updating stock");

export const getStockStatus = (quantity: number, minOrderQuantity: number = 0): { label: string, color: string } => {
  const LOW_STOCK_THRESHOLD = 20;
  if (quantity === 0) return { label: "Out of Stock", color: "error" };
  if (quantity <= LOW_STOCK_THRESHOLD || (minOrderQuantity > 0 && quantity <= minOrderQuantity * 2)) return { label: "Low Stock", color: "warning" };
  return { label: "In Stock", color: "success" };
};
