import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { getOrders } from "../../../src/services/orders";
import { Colors } from "../../../src/theme/colors";
import { StatusBadge } from "../../../src/components/ui/StatusBadge";

export default function OrdersScreen() {
  const { farmerId, buyerId } = useLocalSearchParams();
  const [orders, setOrders] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const statuses = ["All", "PENDING", "PICKUP_ASSIGNED", "IN_TRANSIT", "DELIVERED", "CANCELLED"];

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [farmerId, buyerId])
  );

  const loadOrders = async () => {
    setLoading(true);
    setError("");
    try {
      let fetchedOrders = await getOrders();
      
      if (farmerId) {
        fetchedOrders = fetchedOrders.filter((o: any) => o.farmer_id === String(farmerId));
      }
      if (buyerId) {
        fetchedOrders = fetchedOrders.filter((o: any) => o.buyer_id === String(buyerId));
      }
      setOrders(fetchedOrders);
    } catch (error) {
      setError("Failed to load orders.");
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Prioritize showing logistics context
      const isLogisticsRelevant = order.payment_status === 'PAID' || order.logistics_status;
      const matchesStatus = statusFilter === "All" || order.logistics_status === statusFilter;
      const searchLower = searchQuery.toLowerCase();
      
      const orderId = order.order_number || order.id || "";
      const fName = order.farmers?.name || "";
      const bName = order.buyers?.name || "";
      const prod = order.product || "";
      
      const matchesSearch = !searchQuery ||
        orderId.toLowerCase().includes(searchLower) ||
        fName.toLowerCase().includes(searchLower) ||
        bName.toLowerCase().includes(searchLower) ||
        prod.toLowerCase().includes(searchLower);
      
      return matchesStatus && matchesSearch;
    });
  }, [orders, searchQuery, statusFilter]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.primaryDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Incoming Logistics</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/orders/create")}>
          <Ionicons name="add" size={24} color={Colors.surface} />
        </TouchableOpacity>
      </View>

      <View style={styles.controls}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search orders..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={Colors.textSecondary}
          />
          <TouchableOpacity>
            <Ionicons name="filter-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {statuses.map(status => (
            <TouchableOpacity
              key={status}
              style={[styles.filterChip, statusFilter === status && styles.filterChipSelected]}
              onPress={() => setStatusFilter(status)}
            >
              <Text style={[styles.filterChipText, statusFilter === status && styles.filterChipTextSelected]}>
                {status}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadOrders}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredOrders.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="receipt-outline" size={48} color={Colors.textLight} />
          <Text style={styles.emptyText}>No orders found</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => router.push("/orders/create")}>
            <Text style={styles.retryBtnText}>Create Order</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filteredOrders.map(order => (
            <TouchableOpacity 
              key={order.id} 
              style={styles.card}
              onPress={() => router.push(`/logistics/workspace/${order.id}`)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.orderId}>{order.order_number || order.id.substring(0,8)}</Text>
                <StatusBadge status={order.logistics_status || 'PENDING'} />
              </View>
              
              <Text style={styles.productName}>{order.product} • {order.quantity} {order.unit}</Text>
              
              <View style={styles.parties}>
                <View style={styles.partyRow}>
                  <Ionicons name="leaf-outline" size={14} color={Colors.textSecondary} style={styles.partyIcon} />
                  <Text style={styles.partyText} numberOfLines={1}>Pickup: {order.farmers?.name || 'Unknown'} - {order.farmers?.location || 'No address'}</Text>
                </View>
                <View style={styles.partyRow}>
                  <Ionicons name="location-outline" size={14} color={Colors.textSecondary} style={styles.partyIcon} />
                  <Text style={styles.partyText} numberOfLines={1}>Drop: {order.buyers?.name || 'Unknown'} - {order.delivery_location || 'No address'}</Text>
                </View>
              </View>

              <View style={styles.tagsContainer}>
                {order.is_perishable && <View style={[styles.tag, { backgroundColor: '#FFEDD5' }]}><Text style={[styles.tagText, { color: '#C2410C' }]}>Perishable</Text></View>}
                {order.is_fragile && <View style={[styles.tag, { backgroundColor: '#FCE7F3' }]}><Text style={[styles.tagText, { color: '#BE185D' }]}>Fragile</Text></View>}
                {order.priority === 'HIGH' && <View style={[styles.tag, { backgroundColor: '#FEE2E2' }]}><Text style={[styles.tagText, { color: '#B91C1C' }]}>High Priority</Text></View>}
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.dateText}>
                  {new Date(order.created_at).toLocaleDateString()}
                </Text>
                <View style={styles.paymentContainer}>
                  <Text style={[styles.paymentStatus, order.payment_status === 'PAID' ? styles.paidText : styles.unpaidText]}>
                    {order.payment_status || 'PENDING'}
                  </Text>
                  <Text style={styles.amountText}>₹{order.total_amount}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.primaryDark },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  
  controls: { backgroundColor: Colors.surface, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: 8, paddingHorizontal: 12, height: 44, marginTop: 12 },
  searchInput: { flex: 1, height: '100%', color: Colors.text, marginHorizontal: 8 },
  filterScroll: { marginTop: 12 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background, marginRight: 8 },
  filterChipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { color: Colors.textSecondary, fontWeight: '500' },
  filterChipTextSelected: { color: Colors.surface, fontWeight: 'bold' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: Colors.textSecondary, marginTop: 12, marginBottom: 20, fontSize: 16 },
  retryBtn: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryBtnText: { color: Colors.surface, fontWeight: 'bold' },
  emptyText: { color: Colors.textSecondary, marginTop: 12, marginBottom: 20, fontSize: 16 },

  list: { padding: 16 },
  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border, shadowColor: Colors.text, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderId: { fontSize: 14, fontWeight: 'bold', color: Colors.text },
  productName: { fontSize: 16, fontWeight: 'bold', color: Colors.primaryDark, marginBottom: 12 },
  
  parties: { marginBottom: 12 },
  partyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  partyIcon: { marginRight: 8 },
  partyText: { fontSize: 14, color: Colors.textSecondary },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12 },
  dateText: { fontSize: 12, color: Colors.textLight },
  amountText: { fontSize: 16, fontWeight: 'bold', color: Colors.text },
  paymentContainer: { flexDirection: 'row', alignItems: 'center' },
  paymentStatus: { fontSize: 12, fontWeight: 'bold', marginRight: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  paidText: { color: Colors.success, backgroundColor: Colors.success + '20' },
  unpaidText: { color: Colors.error, backgroundColor: Colors.error + '20' },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginRight: 8, marginBottom: 4 },
  tagText: { fontSize: 10, fontWeight: 'bold' }
});
