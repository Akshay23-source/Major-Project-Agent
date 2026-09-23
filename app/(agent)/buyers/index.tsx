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
import { getBuyers, Buyer } from '../../../src/services/buyers';
import { getOrders } from '../../../src/services/orders';
import { Colors } from '../../../src/theme/colors';

export default function BuyersScreen() {
  const router = useRouter();
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const filters = ["All", "Active", "Inactive", "Retail", "Wholesale"];

  useFocusEffect(
    useCallback(() => {
      loadBuyers();
    }, [])
  );

  const loadBuyers = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getBuyers();
      setBuyers(data);
      const ordersData = await getOrders();
      setOrders(ordersData);
    } catch (err) {
      setError("Failed to load buyers.");
    } finally {
      setLoading(false);
    }
  };

  const filteredBuyers = useMemo(() => {
    return buyers.filter(buyer => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        buyer.name?.toLowerCase().includes(searchLower) ||
        buyer.phone?.toLowerCase().includes(searchLower) ||
        buyer.location?.toLowerCase().includes(searchLower);
      
      let matchesFilter = true;
      if (filterType === "Active") matchesFilter = buyer.status === 'active' || buyer.status === 'Active';
      if (filterType === "Inactive") matchesFilter = buyer.status !== 'active' && buyer.status !== 'Active';
      if (filterType === "Retail") matchesFilter = (buyer.buyer_type || buyer.type)?.toLowerCase() === 'retail' || (buyer.buyer_type || buyer.type)?.toLowerCase() === 'retailer';
      if (filterType === "Wholesale") matchesFilter = (buyer.buyer_type || buyer.type)?.toLowerCase() === 'wholesale' || (buyer.buyer_type || buyer.type)?.toLowerCase() === 'wholesaler';
      
      return matchesSearch && matchesFilter;
    });
  }, [buyers, searchQuery, filterType]);

  const getBuyerOrderStats = (buyerId: string) => {
    const buyerOrders = orders.filter(o => o.buyer_id === buyerId);
    const totalAmount = buyerOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
    return {
      count: buyerOrders.length,
      amount: totalAmount
    };
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.primaryDark} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.title}>Buyers</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/buyers/add")} style={styles.addButton}>
          <Ionicons name="add" size={24} color={Colors.surface} />
        </TouchableOpacity>
      </View>

      <View style={styles.controlsContainer}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={Colors.textLight} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, phone, location..."
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
          <TouchableOpacity style={styles.retryButton} onPress={loadBuyers}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredBuyers.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={48} color={Colors.textLight} />
          <Text style={styles.emptyText}>No buyers found</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => router.push("/buyers/add")}>
            <Text style={styles.retryButtonText}>Add Buyer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer}>
          {filteredBuyers.map((buyer) => {
            const stats = getBuyerOrderStats(buyer.id);
            const isActive = buyer.status?.toLowerCase() === 'active';
            
            return (
              <TouchableOpacity 
                key={buyer.id} 
                style={styles.card}
                onPress={() => router.push(`/buyers/${buyer.id}`)}
              >
                <View style={styles.cardContent}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{buyer.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>{buyer.name}</Text>
                    
                    <View style={styles.detailRow}>
                      <Ionicons name="call-outline" size={14} color={Colors.textSecondary} />
                      <Text style={styles.detailText}>{buyer.phone}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
                      <Text style={styles.detailText}>{buyer.city ? `${buyer.city}${buyer.state ? `, ${buyer.state}` : ''}` : buyer.location || 'N/A'}</Text>
                    </View>
                  </View>
                  <View style={styles.cardRight}>
                    <View style={[styles.statusBadge, isActive ? styles.statusActive : styles.statusInactive]}>
                      <Text style={[styles.statusText, isActive ? styles.statusTextActive : styles.statusTextInactive]}>
                        {isActive ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={Colors.textLight} />
                  </View>
                </View>
                
                <View style={styles.cardFooter}>
                  <View style={styles.footerStat}>
                    <Ionicons name="cart-outline" size={14} color={Colors.textSecondary} style={{marginRight: 4}} />
                    <Text style={styles.footerText}>{stats.count} Orders</Text>
                  </View>
                  <View style={styles.footerStat}>
                    <Ionicons name="wallet-outline" size={14} color={Colors.textSecondary} style={{marginRight: 4}} />
                    <Text style={[styles.footerText, { color: Colors.primaryDark, fontWeight: 'bold' }]}>₹{stats.amount.toFixed(2)}</Text>
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backButton: { padding: 4 },
  headerTitleContainer: { flex: 1, marginLeft: 16 },
  title: { fontSize: 20, fontWeight: "bold", color: Colors.text },
  addButton: { backgroundColor: Colors.primary, width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
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
  cardContent: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 20, fontWeight: 'bold', color: Colors.surface },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: "bold", color: Colors.primaryDark, marginBottom: 4 },
  detailRow: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  detailText: { fontSize: 12, color: Colors.textSecondary, marginLeft: 4 },
  cardRight: { alignItems: 'flex-end', justifyContent: 'space-between', height: 48 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusActive: { backgroundColor: `${Colors.success}20` },
  statusInactive: { backgroundColor: `${Colors.textSecondary}20` },
  statusText: { fontSize: 10, fontWeight: "bold" },
  statusTextActive: { color: Colors.success },
  statusTextInactive: { color: Colors.textSecondary },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12 },
  footerStat: { flexDirection: 'row', alignItems: 'center' },
  footerText: { fontSize: 14, color: Colors.text, fontWeight: "500" }
});
