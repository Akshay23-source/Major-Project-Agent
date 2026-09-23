import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator
} from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { getCommissions, updateCommissionStatus } from '../../../src/services/finance';
import { Colors } from '../../../src/theme/colors';

export default function EarningsScreen() {
  const router = useRouter();
  const [commissions, setCommissions] = useState<any[]>([]);
  const [filterType, setFilterType] = useState("All"); // All, Pending, Earned, Paid, Cancelled
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const filters = ["All", "Pending", "Earned", "Paid", "Cancelled"];

  useFocusEffect(
    useCallback(() => {
      loadEarnings();
    }, [])
  );

  const loadEarnings = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getCommissions();
      setCommissions(data);
    } catch (err) {
      setError("Failed to load earnings.");
    } finally {
      setLoading(false);
    }
  };

  const { filteredCommissions, stats } = useMemo(() => {
    let totalEarnings = 0;
    let thisMonth = 0;
    let totalPending = 0;
    let withdrawable = 0;

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const filtered = commissions.filter(c => {
      const amt = parseFloat(c.amount) || 0;
      const date = new Date(c.created_at);
      
      if (c.status === 'Earned' || c.status === 'Paid') {
        totalEarnings += amt;
        if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
          thisMonth += amt;
        }
      }

      if (c.status === 'Earned') {
        withdrawable += amt;
      } else if (c.status === 'Pending') {
        totalPending += amt;
      }

      if (filterType !== "All" && c.status !== filterType) return false;
      return true;
    });

    return { 
      filteredCommissions: filtered, 
      stats: { totalEarnings, thisMonth, totalPending, withdrawable } 
    };
  }, [commissions, filterType]);

  const handleMarkAsPaid = async (id: string) => {
    try {
      await updateCommissionStatus(id, "Paid");
      loadEarnings();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.title}>My Earnings</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.summaryContainer}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Total Earnings</Text>
            <Text style={styles.summaryValue}>₹{stats.totalEarnings.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>This Month</Text>
            <Text style={styles.summaryValue}>₹{stats.thisMonth.toFixed(2)}</Text>
          </View>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Pending</Text>
            <Text style={[styles.summaryValue, { color: Colors.warning }]}>₹{stats.totalPending.toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryBox, { backgroundColor: `${Colors.success}10`, borderColor: Colors.success }]}>
            <Text style={styles.summaryLabel}>Withdrawable</Text>
            <Text style={[styles.summaryValue, { color: Colors.success }]}>₹{stats.withdrawable.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.controlsContainer}>
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
          <TouchableOpacity style={styles.retryButton} onPress={loadEarnings}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredCommissions.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="wallet-outline" size={48} color={Colors.textLight} />
          <Text style={styles.emptyText}>No earnings recorded yet.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer}>
          <Text style={styles.listTitle}>Earnings History</Text>
          {filteredCommissions.map((c) => {
            const isEarned = c.status === 'Earned';
            const isPaid = c.status === 'Paid';
            const statusColor = (isEarned || isPaid) ? Colors.success : c.status === 'Cancelled' ? Colors.error : Colors.warning;
            
            return (
              <View key={c.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleRow}>
                    <Ionicons name="cash-outline" size={20} color={Colors.primary} style={{marginRight: 8}} />
                    <Text style={styles.cardTitle}>Commission</Text>
                  </View>
                  <Text style={[styles.cardAmount, { color: statusColor }]}>+₹{c.amount}</Text>
                </View>
                
                <View style={styles.cardBody}>
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>Order ID</Text>
                    <Text style={styles.infoValue}>{c.orders?.order_number || 'N/A'}</Text>
                  </View>
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>Order Value</Text>
                    <Text style={styles.infoValue}>₹{c.orders?.total_amount || 0}</Text>
                  </View>
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>Rate</Text>
                    <Text style={styles.infoValue}>{c.rate}%</Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.footerText}>{new Date(c.created_at).toLocaleDateString()}</Text>
                  
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20`, marginRight: 12 }]}>
                      <Text style={[styles.statusText, { color: statusColor }]}>{c.status}</Text>
                    </View>
                    
                    {c.status === 'Earned' && (
                      <TouchableOpacity onPress={() => handleMarkAsPaid(c.id)}>
                        <Text style={styles.withdrawText}>Withdraw</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
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

  controlsContainer: { backgroundColor: Colors.surface, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  filtersScroll: { },
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
  listTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.textSecondary, marginBottom: 16 },
  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.text },
  cardAmount: { fontSize: 18, fontWeight: 'bold' },
  
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  infoCol: { flex: 1 },
  infoLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  infoValue: { fontSize: 14, fontWeight: '600', color: Colors.text },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.background, paddingTop: 12 },
  footerText: { fontSize: 12, color: Colors.textLight },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  withdrawText: { fontSize: 14, fontWeight: 'bold', color: Colors.primary }
});
