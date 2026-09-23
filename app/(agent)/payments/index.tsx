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
import { getPayments } from '../../../src/services/finance';
import { Colors } from '../../../src/theme/colors';

export default function PaymentsScreen() {
  const router = useRouter();
  const [payments, setPayments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("All"); // All, Pending, Processing, Completed, Failed, Refunded
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const filters = ["All", "Pending", "Processing", "Completed", "Failed", "Refunded"];

  useFocusEffect(
    useCallback(() => {
      loadPayments();
    }, [])
  );

  const loadPayments = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getPayments();
      setPayments(data);
    } catch (err) {
      setError("Failed to load payments.");
    } finally {
      setLoading(false);
    }
  };

  const { filteredPayments, stats } = useMemo(() => {
    let totalCollected = 0;
    let totalPending = 0;
    let completedCount = 0;

    const filtered = payments.filter(p => {
      const amt = parseFloat(p.amount) || 0;
      if (p.status === 'Completed') {
        totalCollected += amt;
        completedCount++;
      } else if (p.status === 'Pending' || p.status === 'Processing') {
        totalPending += amt;
      }

      // Filter Logic
      if (filterType !== "All" && p.status !== filterType) return false;

      // Search Logic
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchId = p.id.toLowerCase().includes(query);
        const matchOrder = p.orders?.order_number?.toLowerCase().includes(query);
        const matchBuyer = p.orders?.buyers?.name?.toLowerCase().includes(query);
        const matchRef = p.transaction_reference?.toLowerCase().includes(query);
        return matchId || matchOrder || matchBuyer || matchRef;
      }
      return true;
    });

    return { 
      filteredPayments: filtered, 
      stats: { totalCollected, totalPending, completedCount } 
    };
  }, [payments, searchQuery, filterType]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.title}>Payments</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/payments/settlements')} style={styles.settlementBtn}>
          <Text style={styles.settlementBtnText}>Farmer Settlements</Text>
          <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.summaryContainer}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Total Collected</Text>
            <Text style={styles.summaryValue}>₹{stats.totalCollected.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Pending</Text>
            <Text style={[styles.summaryValue, { color: Colors.warning }]}>₹{stats.totalPending.toFixed(2)}</Text>
          </View>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Completed Txns</Text>
            <Text style={[styles.summaryValue, { color: Colors.success }]}>{stats.completedCount}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Failed</Text>
            <Text style={[styles.summaryValue, { color: Colors.error }]}>0</Text>
          </View>
        </View>
      </View>

      <View style={styles.controlsContainer}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={Colors.textLight} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search ID, Order, Buyer..."
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
          <TouchableOpacity style={styles.retryButton} onPress={loadPayments}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredPayments.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cash-outline" size={48} color={Colors.textLight} />
          <Text style={styles.emptyText}>No payments found.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer}>
          {filteredPayments.map((p) => {
            const isCompleted = p.status === 'Completed';
            const isFailed = p.status === 'Failed' || p.status === 'Cancelled';
            const statusColor = isCompleted ? Colors.success : isFailed ? Colors.error : Colors.warning;
            
            return (
              <TouchableOpacity 
                key={p.id} 
                style={styles.card}
                onPress={() => router.push(`/payments/${p.id}`)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>₹{p.amount}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>{p.status}</Text>
                  </View>
                </View>
                
                <View style={styles.cardBody}>
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>Order ID</Text>
                    <Text style={styles.infoValue}>{p.orders?.order_number || 'N/A'}</Text>
                  </View>
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>Buyer</Text>
                    <Text style={styles.infoValue}>{p.orders?.buyers?.name || 'Unknown'}</Text>
                  </View>
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>Method</Text>
                    <Text style={styles.infoValue}>{p.payment_method || 'Cash'}</Text>
                  </View>
                </View>
                <View style={styles.cardFooter}>
                  <Text style={styles.footerText}>Date: {new Date(p.created_at).toLocaleDateString()}</Text>
                  <Text style={styles.footerText}>ID: {p.id.substring(0,8).toUpperCase()}</Text>
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
  headerTitleContainer: { flex: 1 },
  title: { fontSize: 20, fontWeight: "bold", color: Colors.text },
  settlementBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: `${Colors.primary}15`, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  settlementBtnText: { color: Colors.primary, fontWeight: 'bold', marginRight: 4, fontSize: 12 },
  
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
  cardTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.primaryDark },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  infoCol: { flex: 1 },
  infoLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  infoValue: { fontSize: 14, fontWeight: '600', color: Colors.text },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: Colors.background, paddingTop: 12 },
  footerText: { fontSize: 12, color: Colors.textLight }
});
