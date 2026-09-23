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
import { getFarmerSettlements } from '../../../../src/services/finance';
import { Colors } from '../../../../src/theme/colors';

export default function SettlementsScreen() {
  const router = useRouter();
  const [settlements, setSettlements] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("All"); // All, Pending, Paid, Cancelled
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const filters = ["All", "Pending", "Paid", "Cancelled"];

  useFocusEffect(
    useCallback(() => {
      loadSettlements();
    }, [])
  );

  const loadSettlements = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getFarmerSettlements();
      setSettlements(data);
    } catch (err) {
      setError("Failed to load settlements.");
    } finally {
      setLoading(false);
    }
  };

  const { filteredSettlements, stats } = useMemo(() => {
    let totalDue = 0;
    let totalPaid = 0;
    let pendingCount = 0;

    const filtered = settlements.filter(s => {
      const amt = parseFloat(s.net_amount) || 0;
      if (s.status === 'Paid') {
        totalPaid += amt;
      } else if (s.status === 'Pending') {
        totalDue += amt;
        pendingCount++;
      }

      // Filter Logic
      if (filterType !== "All" && s.status !== filterType) return false;

      // Search Logic
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchId = s.id.toLowerCase().includes(query);
        const matchOrder = s.orders?.order_number?.toLowerCase().includes(query);
        const matchFarmer = s.farmers?.name?.toLowerCase().includes(query);
        return matchId || matchOrder || matchFarmer;
      }
      return true;
    });

    return { 
      filteredSettlements: filtered, 
      stats: { totalDue, totalPaid, pendingCount } 
    };
  }, [settlements, searchQuery, filterType]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.title}>Farmer Settlements</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.summaryContainer}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Total Due</Text>
            <Text style={[styles.summaryValue, { color: Colors.warning }]}>₹{stats.totalDue.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Total Paid</Text>
            <Text style={[styles.summaryValue, { color: Colors.success }]}>₹{stats.totalPaid.toFixed(2)}</Text>
          </View>
        </View>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryBox, { backgroundColor: `${Colors.warning}10` }]}>
            <Text style={styles.summaryLabel}>Pending Settlements</Text>
            <Text style={[styles.summaryValue, { color: Colors.warning }]}>{stats.pendingCount}</Text>
          </View>
        </View>
      </View>

      <View style={styles.controlsContainer}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={Colors.textLight} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search ID, Order, Farmer..."
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
          <TouchableOpacity style={styles.retryButton} onPress={loadSettlements}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredSettlements.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="wallet-outline" size={48} color={Colors.textLight} />
          <Text style={styles.emptyText}>No farmer settlements found.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer}>
          {filteredSettlements.map((s) => {
            const isPaid = s.status === 'Paid';
            const statusColor = isPaid ? Colors.success : s.status === 'Cancelled' ? Colors.error : Colors.warning;
            
            return (
              <TouchableOpacity 
                key={s.id} 
                style={styles.card}
                onPress={() => router.push(`/payments/settlements/${s.id}`)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{s.id.substring(0,8).toUpperCase()}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>{s.status}</Text>
                  </View>
                </View>
                
                <View style={styles.cardBody}>
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>Farmer</Text>
                    <Text style={styles.infoValue}>{s.farmers?.name || 'Unknown'}</Text>
                  </View>
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>Order</Text>
                    <Text style={styles.infoValue}>{s.orders?.order_number || 'N/A'}</Text>
                  </View>
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>Net Amount</Text>
                    <Text style={[styles.infoValue, { color: Colors.primaryDark, fontWeight: 'bold' }]}>₹{s.net_amount}</Text>
                  </View>
                </View>
                <View style={styles.cardFooter}>
                  <Text style={styles.footerText}>Date: {new Date(s.created_at).toLocaleDateString()}</Text>
                  <Text style={styles.footerText}>Gross: ₹{s.gross_amount} | Comm: ₹{s.commission_deducted}</Text>
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerButton: { padding: 4 },
  title: { fontSize: 20, fontWeight: "bold", color: Colors.text },
  
  summaryContainer: { padding: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  summaryBox: { flex: 1, backgroundColor: Colors.background, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  summaryLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4, fontWeight: '500' },
  summaryValue: { fontSize: 18, fontWeight: 'bold', color: Colors.primaryDark },

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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.text },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  infoCol: { flex: 1 },
  infoLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  infoValue: { fontSize: 14, fontWeight: '600', color: Colors.text },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: Colors.background, paddingTop: 12 },
  footerText: { fontSize: 12, color: Colors.textLight }
});
