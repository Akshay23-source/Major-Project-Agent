import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput
} from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { getProductById, getInventoryHistory, updateProductStock, getStockStatus, Product, InventoryHistory } from '../../../src/services/products';
import { Colors } from '../../../src/theme/colors';

export default function ProductDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [product, setProduct] = useState<any>(null);
  const [history, setHistory] = useState<InventoryHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStock, setUpdatingStock] = useState(false);

  // Stock Update State
  const [showStockUpdate, setShowStockUpdate] = useState(false);
  const [stockAction, setStockAction] = useState<"Add" | "Remove" | "Set">("Add");
  const [stockQty, setStockQty] = useState("");
  const [stockReason, setStockReason] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pData, hData] = await Promise.all([
        getProductById(id as string),
        getInventoryHistory(id as string)
      ]);
      setProduct(pData);
      setHistory(hData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleUpdateStock = async () => {
    const qty = parseFloat(stockQty);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert("Validation Error", "Please enter a valid quantity greater than 0.");
      return;
    }
    if (!stockReason.trim()) {
      Alert.alert("Validation Error", "Please provide a reason for the stock update.");
      return;
    }

    if (stockAction === 'Remove' && qty > product.quantity) {
      Alert.alert("Error", "Insufficient stock.");
      return;
    }

    setUpdatingStock(true);
    try {
      const result = await updateProductStock(id as string, qty, stockAction, stockReason);
      if (result) {
        Alert.alert("Success", "Stock updated successfully.");
        setStockQty("");
        setStockReason("");
        setShowStockUpdate(false);
        loadData();
      } else {
        Alert.alert("Error", "Failed to update stock.");
      }
    } catch (e) {
      Alert.alert("Error", "An unexpected error occurred.");
    } finally {
      setUpdatingStock(false);
    }
  };

  if (loading && !product) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
        <Text style={styles.errorText}>Product not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const statusInfo = getStockStatus(product.quantity, product.min_order_quantity);
  const statusColor = statusInfo.color === 'success' ? Colors.success : statusInfo.color === 'warning' ? Colors.warning : Colors.error;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Product Details</Text>
        <TouchableOpacity onPress={() => router.push(`/products/edit?id=${product.id}`)} style={styles.headerButton}>
          <Ionicons name="create-outline" size={24} color={Colors.primaryDark} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* Main Product Info */}
        <View style={styles.section}>
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productCategory}>{product.category}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{statusInfo.label}</Text>
            </View>
          </View>

          {product.description && (
            <Text style={styles.description}>{product.description}</Text>
          )}

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Available Stock</Text>
            <Text style={styles.stockValue}>{product.quantity} {product.unit}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Price</Text>
            <Text style={styles.infoValue}>₹{product.price} / {product.unit}</Text>
          </View>
          {product.min_order_quantity > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Min Order Qty</Text>
              <Text style={styles.infoValue}>{product.min_order_quantity} {product.unit}</Text>
            </View>
          )}
          
          <TouchableOpacity 
            style={styles.updateStockBtn} 
            onPress={() => setShowStockUpdate(!showStockUpdate)}
          >
            <Ionicons name={showStockUpdate ? "chevron-up" : "refresh-circle-outline"} size={20} color={Colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.updateStockBtnText}>{showStockUpdate ? "Cancel Update" : "Update Stock"}</Text>
          </TouchableOpacity>
        </View>

        {/* Inline Stock Update Form */}
        {showStockUpdate && (
          <View style={styles.stockUpdateSection}>
            <Text style={styles.sectionTitle}>Manage Inventory</Text>
            
            <View style={styles.actionTabs}>
              {(['Add', 'Remove', 'Set'] as const).map(action => (
                <TouchableOpacity 
                  key={action}
                  style={[styles.actionTab, stockAction === action && styles.actionTabActive]}
                  onPress={() => setStockAction(action)}
                >
                  <Text style={[styles.actionTabText, stockAction === action && styles.actionTabTextActive]}>{action}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Quantity ({product.unit})</Text>
              <TextInput style={styles.input} value={stockQty} onChangeText={setStockQty} keyboardType="numeric" placeholder="0" />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Reason</Text>
              <TextInput style={styles.input} value={stockReason} onChangeText={setStockReason} placeholder="e.g. New harvest, Spoilage, Manual Count" />
            </View>

            <TouchableOpacity style={styles.confirmBtn} onPress={handleUpdateStock} disabled={updatingStock}>
              {updatingStock ? <ActivityIndicator size="small" color={Colors.surface} /> : <Text style={styles.confirmBtnText}>Confirm {stockAction}</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Farmer Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Farmer Details</Text>
          <TouchableOpacity style={styles.farmerRow} onPress={() => router.push(`/farmers/${product.farmer_id}`)}>
            <View style={styles.farmerIconWrap}>
              <Ionicons name="person" size={20} color={Colors.primary} />
            </View>
            <View style={styles.farmerInfo}>
              <Text style={styles.farmerName}>{product.farmers?.name}</Text>
              <Text style={styles.farmerLocation}>{product.farmers?.village}, {product.farmers?.district}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textLight} />
          </TouchableOpacity>
        </View>

        {/* Additional Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Details</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>System Status</Text>
            <Text style={styles.infoValue}>{product.status}</Text>
          </View>

          {product.harvest_date && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Harvest Date</Text>
              <Text style={styles.infoValue}>{product.harvest_date}</Text>
            </View>
          )}

          {product.best_before_date && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Best Before</Text>
              <Text style={styles.infoValue}>{product.best_before_date}</Text>
            </View>
          )}

          {product.notes && (
            <>
              <View style={styles.divider} />
              <Text style={styles.infoLabel}>Notes</Text>
              <Text style={styles.description}>{product.notes}</Text>
            </>
          )}
        </View>

        {/* Inventory History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inventory History</Text>
          {history.length === 0 ? (
            <Text style={styles.noHistoryText}>No inventory history available.</Text>
          ) : (
            history.map(item => (
              <View key={item.id} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyAction}>{item.action}</Text>
                  <Text style={styles.historyDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
                </View>
                <View style={styles.historyBody}>
                  <View>
                    <Text style={styles.historyReason}>{item.reason}</Text>
                    <Text style={styles.historyFlow}>{item.previous_stock} → {item.new_stock} {product.unit}</Text>
                  </View>
                  <Text style={[
                    styles.historyQty, 
                    item.quantity_change > 0 ? {color: Colors.success} : item.quantity_change < 0 ? {color: Colors.error} : {color: Colors.text}
                  ]}>
                    {item.quantity_change > 0 ? '+' : ''}{item.quantity_change}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surface, padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  errorText: { fontSize: 18, color: Colors.text, marginTop: 16 },
  backBtn: { marginTop: 24, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.primary, borderRadius: 8 },
  backBtnText: { color: Colors.surface, fontWeight: 'bold' },
  
  content: { padding: 16, paddingBottom: 40 },
  
  section: { backgroundColor: Colors.surface, padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.text, marginBottom: 16 },
  
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  productName: { fontSize: 22, fontWeight: 'bold', color: Colors.text, marginBottom: 4 },
  productCategory: { fontSize: 14, color: Colors.textSecondary },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  description: { fontSize: 14, color: Colors.text, marginTop: 12, lineHeight: 20 },
  
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  infoLabel: { fontSize: 14, color: Colors.textSecondary },
  infoValue: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  stockValue: { fontSize: 16, color: Colors.primaryDark, fontWeight: 'bold' },

  updateStockBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, backgroundColor: `${Colors.primary}15`, borderRadius: 8, marginTop: 12 },
  updateStockBtnText: { color: Colors.primary, fontWeight: 'bold', fontSize: 14 },

  stockUpdateSection: { backgroundColor: Colors.surface, padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: Colors.primary },
  actionTabs: { flexDirection: 'row', marginBottom: 16, backgroundColor: Colors.background, borderRadius: 8, padding: 4 },
  actionTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  actionTabActive: { backgroundColor: Colors.surface, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1 },
  actionTabText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
  actionTabTextActive: { color: Colors.primary, fontWeight: 'bold' },
  
  inputGroup: { marginBottom: 12 },
  label: { fontSize: 12, color: Colors.textSecondary, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.text, backgroundColor: Colors.background },
  
  confirmBtn: { backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  confirmBtnText: { color: Colors.surface, fontWeight: 'bold', fontSize: 16 },

  farmerRow: { flexDirection: 'row', alignItems: 'center' },
  farmerIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  farmerInfo: { flex: 1 },
  farmerName: { fontSize: 16, fontWeight: 'bold', color: Colors.text },
  farmerLocation: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  noHistoryText: { color: Colors.textLight, fontStyle: 'italic', textAlign: 'center', paddingVertical: 16 },
  historyCard: { backgroundColor: Colors.background, padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  historyAction: { fontSize: 14, fontWeight: 'bold', color: Colors.text },
  historyDate: { fontSize: 12, color: Colors.textLight },
  historyBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  historyReason: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  historyFlow: { fontSize: 12, color: Colors.text, fontFamily: 'monospace' },
  historyQty: { fontSize: 16, fontWeight: 'bold' }
});
