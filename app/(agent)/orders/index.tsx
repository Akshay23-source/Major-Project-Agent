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

const TIMELINE_STAGES = [
  { key: 'placed', label: 'Placed' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'picked_up', label: 'Picked Up' },
  { key: 'out_for_delivery', label: 'Out for Delivery' },
  { key: 'reached', label: 'Reached' },
  { key: 'delivered', label: 'Delivered' },
];

function getStageIndex(status?: string): number {
  const s = (status || '').toUpperCase();
  switch (s) {
    case 'DELIVERED': return 5;
    case 'ARRIVED_AT_DESTINATION':
    case 'NEAR_DESTINATION': return 4;
    case 'OUT_FOR_DELIVERY':
    case 'IN_TRANSIT': return 3;
    case 'PICKED_UP':
    case 'ARRIVED_AT_FARM': return 2;
    case 'ACCEPTED':
    case 'DRIVER_EN_ROUTE':
    case 'PICKUP_ASSIGNED': return 1;
    case 'PENDING':
    case 'ORDER_RECEIVED':
    case 'ORDER_CONFIRMED':
    default:
      return 0;
  }
}

export default function OrdersScreen() {
  const { farmerId, buyerId } = useLocalSearchParams();
  const [orders, setOrders] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const statuses = ["All", "PENDING", "AWAITING_PICKUP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];

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
      let matchesStatus = statusFilter === "All";
      if (!matchesStatus) {
        if (statusFilter === "AWAITING_PICKUP") {
          matchesStatus = ['AWAITING_PICKUP', 'PICKUP_ASSIGNED', 'ACCEPTED', 'DRIVER_EN_ROUTE', 'ARRIVED_AT_FARM'].includes(order.logistics_status);
        } else if (statusFilter === "IN_TRANSIT") {
          matchesStatus = ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'ARRIVED_AT_DESTINATION', 'PICKED_UP'].includes(order.logistics_status);
        } else if (statusFilter === "OUT_FOR_DELIVERY") {
          matchesStatus = ['OUT_FOR_DELIVERY', 'ARRIVED_AT_DESTINATION'].includes(order.logistics_status);
        } else if (statusFilter === "PENDING") {
          matchesStatus = ['PENDING', 'ORDER_RECEIVED', 'ORDER_CONFIRMED'].includes(order.logistics_status || order.status?.toUpperCase());
        } else if (statusFilter === "DELIVERED") {
          matchesStatus = order.logistics_status === 'DELIVERED' || order.status === 'Delivered';
        } else if (statusFilter === "CANCELLED") {
          matchesStatus = order.logistics_status === 'CANCELLED' || order.status === 'Cancelled';
        } else {
          matchesStatus = order.logistics_status === statusFilter;
        }
      }

      const searchLower = searchQuery.toLowerCase();
      const orderId = order.order_number || order.id || "";
      const trackingId = order.tracking_id || "";
      const fName = order.farmers?.name || order.pickup_contact_name || "";
      const bName = order.buyers?.name || order.customer_name || "";
      const prod = order.product || "";
      const driver = order.accepted_by_driver_name || "";
      
      const matchesSearch = !searchQuery ||
        orderId.toLowerCase().includes(searchLower) ||
        trackingId.toLowerCase().includes(searchLower) ||
        fName.toLowerCase().includes(searchLower) ||
        bName.toLowerCase().includes(searchLower) ||
        prod.toLowerCase().includes(searchLower) ||
        driver.toLowerCase().includes(searchLower);
      
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
          {filteredOrders.map(order => {
            const currentStage = getStageIndex(order.logistics_status);
            const trackingId = order.tracking_id || `AGRI-${(order.external_order_id || order.id).slice(-8).toUpperCase()}`;

            return (
              <TouchableOpacity 
                key={order.id} 
                style={styles.card}
                onPress={() => router.push(`/orders/${order.id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderId}>{order.order_number || order.id.substring(0,8)}</Text>
                    <Text style={styles.trackingIdText}>Tracking ID: {trackingId}</Text>
                  </View>
                  <StatusBadge status={order.logistics_status || order.status || 'PENDING'} />
                </View>
                
                <Text style={styles.productName}>{order.product} • {order.quantity} {order.unit}</Text>
                
                {order.accepted_by_driver_name ? (
                  <View style={styles.driverBanner}>
                    <Ionicons name="bicycle" size={16} color={Colors.primary} />
                    <Text style={styles.driverBannerText}>
                      Assigned Driver: <Text style={{ fontWeight: 'bold' }}>{order.accepted_by_driver_name}</Text>
                      {order.vehicle_number ? ` • ${order.vehicle_number}` : ''}
                    </Text>
                  </View>
                ) : null}

                {/* Tracking Timeline */}
                <View style={styles.timelineContainer}>
                  <View style={styles.timelineHeader}>
                    <Text style={styles.timelineTitle}>Tracking Progress</Text>
                    <Text style={styles.timelineStatusHighlight}>
                      Stage: {TIMELINE_STAGES[currentStage]?.label || 'Pending'}
                    </Text>
                  </View>
                  <View style={styles.timelineStagesRow}>
                    {TIMELINE_STAGES.map((stage, idx) => {
                      const isCompleted = idx <= currentStage;
                      const isCurrent = idx === currentStage;
                      return (
                        <View key={stage.key} style={styles.stageCol}>
                          <View style={[
                            styles.stageNode,
                            isCompleted ? styles.stageNodeDone : styles.stageNodePending,
                            isCurrent && styles.stageNodeActive
                          ]}>
                            {isCompleted ? (
                              <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                            ) : (
                              <View style={styles.stageNodeDot} />
                            )}
                          </View>
                          <Text 
                            style={[
                              styles.stageText,
                              isCurrent && styles.stageTextActive,
                              isCompleted && styles.stageTextDone
                            ]} 
                            numberOfLines={2}
                          >
                            {stage.label}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.parties}>
                  <View style={styles.partyRow}>
                    <Ionicons name="leaf-outline" size={14} color={Colors.textSecondary} style={styles.partyIcon} />
                    <Text style={styles.partyText} numberOfLines={1}>
                      Pickup: {order.farmers?.name || order.pickup_contact_name || 'Farmer'} - {order.farmers?.location || order.pickup_address || 'Farm location'}
                    </Text>
                  </View>
                  <View style={styles.partyRow}>
                    <Ionicons name="location-outline" size={14} color={Colors.textSecondary} style={styles.partyIcon} />
                    <Text style={styles.partyText} numberOfLines={1}>
                      Drop: {order.buyers?.name || order.customer_name || 'Customer'} - {order.delivery_location || (typeof order.drop_address === 'object' ? order.drop_address?.address : order.drop_address) || 'Delivery address'}
                    </Text>
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
            );
          })}
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
  orderId: { fontSize: 15, fontWeight: 'bold', color: Colors.text },
  trackingIdText: { fontSize: 11, color: Colors.textLight, marginTop: 2 },
  productName: { fontSize: 16, fontWeight: 'bold', color: Colors.primaryDark, marginBottom: 8 },
  
  driverBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10, gap: 6 },
  driverBannerText: { fontSize: 12, color: '#1E40AF' },

  timelineContainer: { backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  timelineTitle: { fontSize: 12, fontWeight: '700', color: '#475569' },
  timelineStatusHighlight: { fontSize: 11, fontWeight: '700', color: Colors.primary, backgroundColor: '#E0F2FE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  timelineStagesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  stageCol: { flex: 1, alignItems: 'center' },
  stageNode: { width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  stageNodeDone: { backgroundColor: '#16A34A' },
  stageNodePending: { backgroundColor: '#CBD5E1' },
  stageNodeActive: { backgroundColor: '#2563EB', borderWidth: 2, borderColor: '#BFDBFE' },
  stageNodeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  stageText: { fontSize: 9, color: '#94A3B8', textAlign: 'center', lineHeight: 11 },
  stageTextActive: { color: '#1E40AF', fontWeight: 'bold' },
  stageTextDone: { color: '#166534', fontWeight: '600' },
  
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
