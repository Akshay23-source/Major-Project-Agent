import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator
} from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { getProducts, getStockStatus, Product } from '../../../src/services/products';
import { Colors } from '../../../src/theme/colors';

export const PRODUCT_CATEGORIES = ['Vegetables', 'Fruits', 'Grains', 'Pulses', 'Coconut', 'Spices', 'Flowers', 'Other'];

export default function ProductsScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("All"); // All, In Stock, Low Stock, Out of Stock
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<'Products' | 'Inventory'>('Products');

  const filters = ["All", "In Stock", "Low Stock", "Out of Stock"];
  const categories = ["All", ...PRODUCT_CATEGORIES];

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [])
  );

  const loadProducts = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getProducts();
      setProducts(data);
    } catch (err) {
      setError("Failed to load products.");
    } finally {
      setLoading(false);
    }
  };

  const { filteredProducts, inventoryStats } = useMemo(() => {
    let totalStock = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    const filtered = products.filter(p => {
      const status = getStockStatus(p.quantity, p.min_order_quantity);
      
      // Calculate stats for all products
      totalStock += p.quantity;
      if (status.label === 'Low Stock') lowStockCount++;
      if (status.label === 'Out of Stock') outOfStockCount++;

      // Filtering logic
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        p.name?.toLowerCase().includes(searchLower) ||
        p.category?.toLowerCase().includes(searchLower) ||
        p.farmers?.name?.toLowerCase().includes(searchLower);
      
      let matchesFilter = true;
      if (filterType !== "All") {
        matchesFilter = status.label === filterType;
      }

      let matchesCategory = true;
      if (categoryFilter !== "All") {
        matchesCategory = p.category === categoryFilter;
      }
      
      return matchesSearch && matchesFilter && matchesCategory;
    });

    return { 
      filteredProducts: filtered, 
      inventoryStats: { totalProducts: products.length, totalStock, lowStockCount, outOfStockCount }
    };
  }, [products, searchQuery, filterType, categoryFilter]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.title}>Products & Inventory</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/products/add")} style={styles.addButton}>
          <Ionicons name="add" size={24} color={Colors.surface} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, activeTab === 'Products' && styles.activeTab]} onPress={() => setActiveTab('Products')}>
          <Text style={[styles.tabText, activeTab === 'Products' && styles.activeTabText]}>Products</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'Inventory' && styles.activeTab]} onPress={() => setActiveTab('Inventory')}>
          <Text style={[styles.tabText, activeTab === 'Inventory' && styles.activeTabText]}>Inventory</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'Products' ? (
        <View style={styles.controlsContainer}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={Colors.textLight} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products, farmers..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={Colors.textLight}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={20} color={Colors.textLight} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
            {filters.map(filter => (
              <TouchableOpacity
                key={filter}
                style={[styles.filterChip, filterType === filter && styles.filterChipSelected]}
                onPress={() => setFilterType(filter)}
              >
                <Text style={[styles.filterChipText, filterType === filter && styles.filterChipTextSelected]}>
                  {filter}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.filterChip, categoryFilter === cat && styles.filterChipSelected]}
                onPress={() => setCategoryFilter(cat)}
              >
                <Text style={[styles.filterChipText, categoryFilter === cat && styles.filterChipTextSelected]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.inventoryOverview}>
          <View style={styles.inventoryRow}>
            <View style={styles.inventoryStatBox}>
              <Text style={styles.invStatLabel}>Total Products</Text>
              <Text style={styles.invStatValue}>{inventoryStats.totalProducts}</Text>
            </View>
            <View style={styles.inventoryStatBox}>
              <Text style={styles.invStatLabel}>Total Stock</Text>
              <Text style={styles.invStatValue}>{inventoryStats.totalStock}</Text>
            </View>
          </View>
          <View style={styles.inventoryRow}>
            <View style={styles.inventoryStatBox}>
              <Text style={styles.invStatLabel}>Low Stock</Text>
              <Text style={[styles.invStatValue, { color: Colors.warning }]}>{inventoryStats.lowStockCount}</Text>
            </View>
            <View style={styles.inventoryStatBox}>
              <Text style={styles.invStatLabel}>Out of Stock</Text>
              <Text style={[styles.invStatValue, { color: Colors.error }]}>{inventoryStats.outOfStockCount}</Text>
            </View>
          </View>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
      ) : error ? (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadProducts}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredProducts.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="leaf-outline" size={48} color={Colors.textLight} />
          <Text style={styles.emptyText}>No products found.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => router.push("/products/add")}>
            <Text style={styles.retryButtonText}>Add Product</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer}>
          {filteredProducts.map((p) => {
            const statusInfo = getStockStatus(p.quantity, p.min_order_quantity);
            const statusColor = statusInfo.color === 'success' ? Colors.success : statusInfo.color === 'warning' ? Colors.warning : Colors.error;
            
            return (
              <TouchableOpacity 
                key={p.id} 
                style={styles.card}
                onPress={() => router.push(`/products/${p.id}`)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{p.name}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>{statusInfo.label}</Text>
                  </View>
                </View>
                
                <Text style={styles.categoryText}>{p.category}</Text>
                
                <View style={styles.cardBody}>
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>Farmer</Text>
                    <Text style={styles.infoValue}>{p.farmers?.name || 'Unknown'}</Text>
                  </View>
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>Available</Text>
                    <Text style={styles.infoValue}>{p.quantity} {p.unit}</Text>
                  </View>
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>Price</Text>
                    <Text style={styles.infoValue}>₹{p.price}/{p.unit}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: Colors.surface },
  headerTitleContainer: { flex: 1 },
  title: { fontSize: 20, fontWeight: "bold", color: Colors.text },
  addButton: { backgroundColor: Colors.primary, width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  
  tabContainer: { flexDirection: 'row', backgroundColor: Colors.surface, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: Colors.primary },
  tabText: { fontSize: 16, color: Colors.textSecondary, fontWeight: '500' },
  activeTabText: { color: Colors.primary, fontWeight: 'bold' },

  controlsContainer: { backgroundColor: Colors.surface, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.background, borderRadius: 8, paddingHorizontal: 12, height: 44, marginTop: 12 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: "100%", color: Colors.text },
  filtersScroll: { marginTop: 12 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.background, marginRight: 8, borderWidth: 1, borderColor: Colors.border },
  filterChipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { color: Colors.textSecondary, fontWeight: "500" },
  filterChipTextSelected: { color: Colors.surface, fontWeight: "600" },
  
  inventoryOverview: { padding: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  inventoryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  inventoryStatBox: { flex: 1, backgroundColor: Colors.background, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  invStatLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 8, fontWeight: '600' },
  invStatValue: { fontSize: 24, fontWeight: 'bold', color: Colors.primaryDark },

  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  emptyText: { fontSize: 18, color: Colors.textSecondary, marginTop: 16, marginBottom: 24, fontWeight: "500" },
  retryButton: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  retryButtonText: { color: Colors.surface, fontWeight: "bold", fontSize: 16 },
  listContainer: { padding: 16 },
  
  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  categoryText: { fontSize: 14, color: Colors.textSecondary, marginBottom: 12 },
  
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: Colors.background, paddingTop: 12 },
  infoCol: { flex: 1 },
  infoLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  infoValue: { fontSize: 14, fontWeight: '600', color: Colors.text }
});
