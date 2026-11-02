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
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { getDeliveries } from '../../../src/services/deliveries';
import { Colors } from '../../../src/theme/colors';
import { StatusBadge } from '../../../src/components/ui/StatusBadge';

export default function DeliveriesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string }>();

  const getMappedFilter = (raw?: string) => {
    const f = (raw || '').toLowerCase();
    if (f.includes('await')) return 'Awaiting';
    if (f.includes('transit') || f.includes('ongoing') || f.includes('out')) return 'In Transit';
    if (f.includes('deliver') || f.includes('complete')) return 'Delivered';
    if (f.includes('cancel')) return 'Cancelled';
    return 'All';
  };

  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState(getMappedFilter(params.filter));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const filters = ["All", "Awaiting", "In Transit", "Delivered", "Cancelled"];

  React.useEffect(() => {
    if (params.filter) {
      setFilterType(getMappedFilter(params.filter));
    }
  }, [params.filter]);

  useFocusEffect(
    useCallback(() => {
      loadDeliveries();
    }, [])
  );

  const loadDeliveries = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getDeliveries();
      setDeliveries(data);
    } catch (err) {
      setError("Failed to load deliveries.");
    } finally {
      setLoading(false);
    }
  };

  const filteredDeliveries = useMemo(() => {
    return deliveries.filter(del => {
      const searchLower = searchQuery.toLowerCase();
      
      const delId = del.delivery_number || del.id || "";
      const trackingId = del.tracking_id || del.orders?.tracking_id || "";
      const driverName = del.delivery_partners?.name || del.driver_name || del.orders?.accepted_by_driver_name || del.employees?.name || "";
      const farmerName = del.orders?.farmers?.name || del.orders?.pickup_contact_name || "";
      const buyerName = del.orders?.buyers?.name || del.orders?.customer_name || "";
      const product = del.orders?.product || "";
      
      const matchesSearch = !searchQuery || 
        delId.toLowerCase().includes(searchLower) ||
        trackingId.toLowerCase().includes(searchLower) ||
        driverName.toLowerCase().includes(searchLower) ||
        farmerName.toLowerCase().includes(searchLower) ||
        buyerName.toLowerCase().includes(searchLower) ||
        product.toLowerCase().includes(searchLower);
      
      const trackingStatus = (del.logistics_tracking_status || '').toUpperCase();
      const status = del.status || '';

      let matchesFilter = true;
      if (filterType === "Awaiting") {
        matchesFilter = ['ACCEPTED', 'DRIVER_EN_ROUTE', 'ARRIVED_AT_FARM', 'AWAITING_PICKUP', 'PICKUP_ASSIGNED'].includes(trackingStatus) ||
          ['Pending', 'Assigned', 'Awaiting Pickup', 'Awaiting'].includes(status);
      } else if (filterType === "In Transit") {
        matchesFilter = ['PICKED_UP', 'IN_TRANSIT', 'ARRIVED_AT_DESTINATION', 'OUT_FOR_DELIVERY'].includes(trackingStatus) ||
          ['Picked Up', 'In Transit', 'Out for Delivery'].includes(status);
      } else if (filterType === "Delivered") {
        matchesFilter = trackingStatus === 'DELIVERED' || status === 'Delivered' || status === 'Completed';
      } else if (filterType === "Cancelled") {
        matchesFilter = trackingStatus === 'CANCELLED' || status === 'Cancelled';
      }
      
      return matchesSearch && matchesFilter;
    });
  }, [deliveries, searchQuery, filterType]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.primaryDark} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.title}>Deliveries</Text>
        </View>
      </View>

      <View style={styles.controlsContainer}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={Colors.textLight} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search deliveries..."
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
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
      ) : error ? (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadDeliveries}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredDeliveries.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="bicycle-outline" size={48} color={Colors.textLight} />
          <Text style={styles.emptyText}>No deliveries found</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer}>
          {filteredDeliveries.map((del) => {
            const driverName = del.delivery_partners?.name || del.driver_name || del.orders?.accepted_by_driver_name || del.employees?.name || 'Unassigned';
            const vehicle = del.delivery_partners?.vehicle_number || del.delivery_partners?.vehicle_type || del.vehicles?.vehicle_number;
            const fromLocation = del.orders?.farmers?.name || del.orders?.pickup_contact_name || del.pickup_location || 'Farm';
            const toLocation = del.orders?.buyers?.name || del.orders?.customer_name || del.drop_location || 'Customer';
            const trackingId = del.tracking_id || del.orders?.tracking_id;
            const completionDate = del.delivery_time || del.completed_at;

            return (
              <TouchableOpacity 
                key={del.id} 
                style={styles.card}
                onPress={() => router.push(`/deliveries/${del.order_id || del.id}`)}
              >
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.deliveryId}>{del.delivery_number || del.id.substring(0,8)}</Text>
                    {trackingId ? (
                      <Text style={{ fontSize: 11, color: Colors.primaryDark, fontWeight: '600' }}>TRK: {trackingId}</Text>
                    ) : null}
                  </View>
                  <StatusBadge status={del.logistics_tracking_status || del.status} />
                </View>
                
                <Text style={styles.productName}>{del.orders?.product || 'Agricultural Goods'} • {del.orders?.quantity || 1} {del.orders?.unit || 'units'}</Text>
                
                <View style={styles.parties}>
                  <View style={styles.partyRow}>
                    <Ionicons name="leaf-outline" size={14} color={Colors.textSecondary} style={styles.partyIcon} />
                    <Text style={styles.partyText} numberOfLines={1}>From: {fromLocation}</Text>
                  </View>
                  <View style={styles.partyRow}>
                    <Ionicons name="storefront-outline" size={14} color={Colors.textSecondary} style={styles.partyIcon} />
                    <Text style={styles.partyText} numberOfLines={1}>To: {toLocation}</Text>
                  </View>
                </View>

                <View style={styles.assignmentBox}>
                  <Text style={styles.assignLabel}>Assigned Driver:</Text>
                  <Text style={styles.assignValue}>{driverName}{vehicle ? ` (${vehicle})` : ''}</Text>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.dateText}>
                    {completionDate 
                      ? `Delivered: ${new Date(completionDate).toLocaleDateString()} ${new Date(completionDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : `Created: ${new Date(del.created_at).toLocaleDateString()}`
                    }
                  </Text>
                  {del.eta && !completionDate && (
                    <Text style={styles.etaText}>ETA: {del.eta}</Text>
                  )}
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
  header: { flexDirection: "row", alignItems: "center", padding: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backButton: { padding: 4 },
  headerTitleContainer: { flex: 1, marginLeft: 16 },
  title: { fontSize: 20, fontWeight: "bold", color: Colors.text },
  controlsContainer: { backgroundColor: Colors.surface, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.background, borderRadius: 8, paddingHorizontal: 12, height: 44, marginTop: 12 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: "100%", color: Colors.text },
  filtersScroll: { marginTop: 12 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.background, marginRight: 8, borderWidth: 1, borderColor: Colors.border },
  filterChipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { color: Colors.textSecondary, fontWeight: "500" },
  filterChipTextSelected: { color: Colors.surface, fontWeight: "600" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  emptyText: { fontSize: 18, color: Colors.textSecondary, marginTop: 16, marginBottom: 24, fontWeight: "500" },
  retryButton: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  retryButtonText: { color: Colors.surface, fontWeight: "bold", fontSize: 16 },
  listContainer: { padding: 16 },
  
  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  deliveryId: { fontSize: 14, fontWeight: 'bold', color: Colors.text },
  productName: { fontSize: 16, fontWeight: 'bold', color: Colors.primaryDark, marginBottom: 12 },
  
  parties: { marginBottom: 12 },
  partyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  partyIcon: { marginRight: 8 },
  partyText: { fontSize: 14, color: Colors.textSecondary },

  assignmentBox: { backgroundColor: Colors.background, padding: 8, borderRadius: 8, marginBottom: 12 },
  assignLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 2 },
  assignValue: { fontSize: 14, fontWeight: '600', color: Colors.text },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12 },
  dateText: { fontSize: 12, color: Colors.textLight },
  etaText: { fontSize: 12, fontWeight: 'bold', color: Colors.primary }
});
