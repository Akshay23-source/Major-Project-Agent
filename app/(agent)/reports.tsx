import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { LineChart } from "react-native-chart-kit";

import { 
  getComprehensiveKPIs, 
  getOrderTrend, 
  getTopProducts, 
  getTopFarmers, 
  getTopBuyers, 
  getEmployeePerformance, 
  getInventoryAnalytics,
  ComprehensiveKPIs,
  Period 
} from "../../src/services/analytics";
import { getOrders } from "../../src/services/orders";
import { Colors } from "../../src/theme/colors";
import { SummaryCard } from "../../src/components/ui/SummaryCard";

const screenWidth = Dimensions.get("window").width;

export default function ReportsScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("30");
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);

  const [kpis, setKpis] = useState<ComprehensiveKPIs | null>(null);
  const [trendData, setTrendData] = useState<any>(null);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [topFarmers, setTopFarmers] = useState<any[]>([]);
  const [topBuyers, setTopBuyers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [period])
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const [k, t, p, f, b, e, i] = await Promise.all([
        getComprehensiveKPIs(period),
        getOrderTrend(period),
        getTopProducts(period),
        getTopFarmers(period),
        getTopBuyers(period),
        getEmployeePerformance(period),
        getInventoryAnalytics() // Inventory is current state, independent of period
      ]);
      setKpis(k);
      setTrendData(t);
      setTopProducts(p);
      setTopFarmers(f);
      setTopBuyers(b);
      setEmployees(e);
      setInventory(i);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to load analytics data.");
    } finally {
      setLoading(false);
    }
  };

  const generateCSV = async () => {
    setExportLoading(true);
    try {
      const allOrders = await getOrders();
      let filteredOrders = allOrders;

      if (period !== "all") {
        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() - parseInt(period));
        filteredOrders = allOrders.filter((o: any) => new Date(o.created_at) >= dateLimit);
      }

      if (filteredOrders.length === 0) {
        Alert.alert("No Data", "There are no orders in the selected period to export.");
        setExportLoading(false);
        return;
      }

      let csvString = "Order Number,Farmer,Product,Quantity,Unit,Price,Total Amount,Status,Created Date\n";
      
      filteredOrders.forEach((o: any) => {
        const farmerName = o.farmers?.name || "Unknown";
        const escapedFarmer = `"${farmerName.replace(/"/g, '""')}"`;
        const escapedProduct = `"${o.product.replace(/"/g, '""')}"`;
        const dateStr = new Date(o.created_at).toLocaleDateString();

        csvString += `${o.order_number},${escapedFarmer},${escapedProduct},${o.quantity},${o.unit},${o.price},${o.total_amount},${o.status},${dateStr}\n`;
      });

      const filename = `AgriAgent_Report_${period}Days_${new Date().getTime()}.csv`;
      // @ts-ignore
      const docDir = FileSystem.documentDirectory;
      if (!docDir) {
        Alert.alert("Export Error", "File system not available on this device.");
        setExportLoading(false);
        return;
      }
      const fileUri = `${docDir}${filename}`;
      
      await FileSystem.writeAsStringAsync(fileUri, csvString, {
        encoding: 'utf8'
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/csv",
          dialogTitle: "Export Orders Report"
        });
      } else {
        Alert.alert("Sharing Unavailable", "Cannot share the file on this device.");
      }

    } catch (error) {
      console.error("Export Error:", error);
      Alert.alert("Export Failed", "There was an error generating the report.");
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.title}>Reports & Analytics</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Global Period Filter */}
      <View style={styles.periodSelectorWrapper}>
        <View style={styles.periodSelector}>
          {(["7", "30", "90", "all"] as Period[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodPill, period === p && styles.periodPillActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                {p === "all" ? "All Time" : `${p} Days`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          
          {/* KPI Section */}
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.kpiGrid}>
            <SummaryCard title="Gross Sales" value={`₹${kpis?.totalSales.toFixed(2)}`} icon="bar-chart" color={Colors.primary} />
            <SummaryCard title="Orders" value={kpis?.totalOrders || 0} icon="cart" color={Colors.info} />
          </View>
          <View style={styles.kpiGrid}>
            <SummaryCard title="Completed" value={kpis?.completedOrders || 0} icon="checkmark-circle" color={Colors.success} />
            <SummaryCard title="Pending" value={kpis?.pendingOrders || 0} icon="time" color={Colors.warning} />
          </View>

          {/* Sales Trend Chart */}
          {trendData && trendData.labels.length > 0 && trendData.labels[0] !== "No Data" && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionSubtitle}>Sales Trend (Value)</Text>
              <LineChart
                data={{
                  labels: trendData.labels,
                  datasets: [{ data: trendData.data }]
                }}
                width={screenWidth - 48}
                height={220}
                chartConfig={{
                  backgroundColor: Colors.surface,
                  backgroundGradientFrom: Colors.surface,
                  backgroundGradientTo: Colors.surface,
                  color: (opacity = 1) => `rgba(46, 125, 50, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(102, 112, 133, ${opacity})`,
                  strokeWidth: 2,
                  propsForDots: { r: "4", strokeWidth: "2", stroke: Colors.primary }
                }}
                bezier
                style={styles.chart}
              />
            </View>
          )}

          {/* Financial Analytics */}
          <Text style={styles.sectionTitle}>Financial Summary</Text>
          <View style={styles.sectionCard}>
            <View style={styles.financeRow}>
              <Text style={styles.financeLabel}>Amount Collected</Text>
              <Text style={[styles.financeValue, { color: Colors.success }]}>₹{kpis?.amountCollected.toFixed(2)}</Text>
            </View>
            <View style={styles.financeRow}>
              <Text style={styles.financeLabel}>Pending Collection</Text>
              <Text style={[styles.financeValue, { color: Colors.warning }]}>₹{kpis?.amountPending.toFixed(2)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.financeRow}>
              <Text style={styles.financeLabel}>Settlements Paid</Text>
              <Text style={[styles.financeValue, { color: Colors.success }]}>₹{kpis?.farmerSettlements.toFixed(2)}</Text>
            </View>
            <View style={styles.financeRow}>
              <Text style={styles.financeLabel}>Pending Payable</Text>
              <Text style={[styles.financeValue, { color: Colors.error }]}>₹{kpis?.pendingFarmerSettlements.toFixed(2)}</Text>
            </View>
          </View>

          {/* Top Products */}
          <Text style={styles.sectionTitle}>Top Performing Products</Text>
          <View style={styles.sectionCard}>
            {topProducts.length === 0 ? (
              <Text style={styles.emptyText}>No product sales in this period.</Text>
            ) : (
              topProducts.map((p, idx) => (
                <View key={p.name} style={[styles.listItem, idx < topProducts.length - 1 && styles.borderBottom]}>
                  <View>
                    <Text style={styles.itemTitle}>{p.name}</Text>
                    <Text style={styles.itemSubtitle}>{p.quantity} units sold</Text>
                  </View>
                  <Text style={styles.itemRevenue}>₹{p.revenue.toFixed(2)}</Text>
                </View>
              ))
            )}
          </View>

          {/* Top Farmers */}
          <Text style={styles.sectionTitle}>Top Farmers</Text>
          <View style={styles.sectionCard}>
            {topFarmers.length === 0 ? (
              <Text style={styles.emptyText}>No farmer activity in this period.</Text>
            ) : (
              topFarmers.map((f, idx) => (
                <TouchableOpacity key={f.id} style={[styles.listItem, idx < topFarmers.length - 1 && styles.borderBottom]} onPress={() => router.push(`/farmers/${f.id}`)}>
                  <View>
                    <Text style={styles.itemTitle}>{f.name}</Text>
                    <Text style={styles.itemSubtitle}>{f.orderCount} Orders • {f.totalQty} Units</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.itemRevenue}>₹{f.totalValue.toFixed(2)}</Text>
                    <Ionicons name="chevron-forward" size={14} color={Colors.textLight} />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Top Buyers */}
          <Text style={styles.sectionTitle}>Top Buyers</Text>
          <View style={styles.sectionCard}>
            {topBuyers.length === 0 ? (
              <Text style={styles.emptyText}>No buyer activity in this period.</Text>
            ) : (
              topBuyers.map((b, idx) => (
                <TouchableOpacity key={b.id} style={[styles.listItem, idx < topBuyers.length - 1 && styles.borderBottom]} onPress={() => router.push(`/buyers/${b.id}`)}>
                  <View>
                    <Text style={styles.itemTitle}>{b.name}</Text>
                    <Text style={styles.itemSubtitle}>{b.orderCount} Orders</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.itemRevenue}>₹{b.totalValue.toFixed(2)}</Text>
                    <Ionicons name="chevron-forward" size={14} color={Colors.textLight} />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Delivery & Logistics */}
          <Text style={styles.sectionTitle}>Logistics & Employees</Text>
          <View style={styles.kpiGrid}>
            <SummaryCard title="Completed Dels" value={kpis?.completedDeliveries || 0} icon="bicycle" color={Colors.success} onPress={() => router.push('/deliveries')} />
            <SummaryCard title="Pending Dels" value={kpis?.pendingDeliveries || 0} icon="time" color={Colors.warning} onPress={() => router.push('/deliveries')} />
          </View>
          <View style={styles.sectionCard}>
            <Text style={[styles.sectionSubtitle, { marginBottom: 12 }]}>Employee Performance</Text>
            {employees.length === 0 ? (
              <Text style={styles.emptyText}>No employee deliveries in this period.</Text>
            ) : (
              employees.map((e, idx) => (
                <TouchableOpacity key={e.id} style={[styles.listItem, idx < employees.length - 1 && styles.borderBottom]} onPress={() => router.push(`/employees/${e.id}`)}>
                  <View>
                    <Text style={styles.itemTitle}>{e.name}</Text>
                    <Text style={styles.itemSubtitle}>{e.completed} / {e.totalAssigned} Delivered ({e.completionRate}%)</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Inventory Overview */}
          {inventory && (
            <>
              <Text style={styles.sectionTitle}>Current Inventory</Text>
              <View style={styles.sectionCard}>
                <View style={styles.financeRow}>
                  <Text style={styles.financeLabel}>Active Products</Text>
                  <Text style={styles.financeValue}>{inventory.totalActive}</Text>
                </View>
                <View style={styles.financeRow}>
                  <Text style={styles.financeLabel}>Low Stock Alerts</Text>
                  <Text style={[styles.financeValue, { color: Colors.warning }]}>{inventory.lowStock}</Text>
                </View>
                <View style={styles.financeRow}>
                  <Text style={styles.financeLabel}>Out of Stock</Text>
                  <Text style={[styles.financeValue, { color: Colors.error }]}>{inventory.outOfStock}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.financeRow}>
                  <Text style={[styles.financeLabel, { fontWeight: 'bold' }]}>Est. Inventory Value</Text>
                  <Text style={[styles.financeValue, { color: Colors.primaryDark }]}>₹{inventory.inventoryValue.toFixed(2)}</Text>
                </View>
              </View>
            </>
          )}

          {/* Export Section */}
          <Text style={styles.sectionTitle}>Data Export</Text>
          <View style={styles.sectionCard}>
            <Text style={styles.description}>
              Generate a CSV report of all orders within the currently selected period ({period === "all" ? "All Time" : `${period} Days`}).
            </Text>
            <TouchableOpacity 
              style={[styles.exportButton, exportLoading && { opacity: 0.7 }]} 
              onPress={generateCSV}
              disabled={exportLoading}
            >
              {exportLoading ? (
                <ActivityIndicator color={Colors.surface} />
              ) : (
                <>
                  <Ionicons name="download-outline" size={20} color={Colors.surface} style={{ marginRight: 8 }} />
                  <Text style={styles.exportButtonText}>Export to CSV</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backButton: { padding: 4 },
  title: { fontSize: 20, fontWeight: "bold", color: Colors.primaryDark },
  
  periodSelectorWrapper: { padding: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  periodSelector: { flexDirection: "row", backgroundColor: Colors.background, borderRadius: 20, padding: 4 },
  periodPill: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 16 },
  periodPillActive: { backgroundColor: Colors.primary, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
  periodText: { fontSize: 13, color: Colors.textSecondary, fontWeight: "600" },
  periodTextActive: { color: Colors.surface },

  content: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: Colors.text, marginTop: 12, marginBottom: 12, paddingHorizontal: 4 },
  sectionSubtitle: { fontSize: 16, fontWeight: "bold", color: Colors.text, marginBottom: 8 },
  
  kpiGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  
  sectionCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: Colors.border, shadowColor: Colors.text, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
  
  chart: { marginVertical: 8, borderRadius: 16, alignSelf: 'center', marginLeft: -16 },

  financeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  financeLabel: { fontSize: 15, color: Colors.textSecondary },
  financeValue: { fontSize: 16, fontWeight: 'bold', color: Colors.text },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 8 },

  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  borderBottom: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.text, marginBottom: 4 },
  itemSubtitle: { fontSize: 14, color: Colors.textSecondary },
  itemRevenue: { fontSize: 16, fontWeight: 'bold', color: Colors.primaryDark },
  
  emptyText: { color: Colors.textSecondary, fontStyle: 'italic', textAlign: 'center', paddingVertical: 12 },

  description: { fontSize: 14, color: Colors.textSecondary, marginBottom: 16, lineHeight: 20 },
  exportButton: { flexDirection: "row", backgroundColor: Colors.primary, padding: 14, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  exportButtonText: { color: Colors.surface, fontSize: 16, fontWeight: "bold" }
});
