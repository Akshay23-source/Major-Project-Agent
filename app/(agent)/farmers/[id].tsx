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
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { getFarmerById, Farmer } from '../../../src/services/farmers';
import { getOrders } from '../../../src/services/orders';
import { getFarmerFinancialStats } from '../../../src/services/finance';
import { getProducts, getStockStatus } from '../../../src/services/products';
import { Colors } from '../../../src/theme/colors';
import { StatusBadge } from '../../../src/components/ui/StatusBadge';

export default function FarmerDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [financialStats, setFinancialStats] = useState<any>({ totalSales: 0, totalPaid: 0, outstanding: 0 });
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [id])
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const fData = await getFarmerById(id as string);
      setFarmer(fData);
      
      const allOrders = await getOrders();
      const fOrders = allOrders.filter((o: any) => o.farmer_id === id);
      setOrders(fOrders);

      const allProducts = await getProducts();
      const fProducts = allProducts.filter((p: any) => p.farmer_id === id);
      setProducts(fProducts);
      
      const stats = await getFarmerFinancialStats(id as string);
      setFinancialStats(stats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const { totalOrders, totalSales, pendingOrders } = useMemo(() => {
    let sales = 0;
    let pending = 0;
    orders.forEach(o => {
      sales += parseFloat(o.total_amount) || 0;
      if (o.status === 'Pending' || o.status === 'Processing') pending++;
    });
    return {
      totalOrders: orders.length,
      totalSales: sales,
      pendingOrders: pending
    };
  }, [orders]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (!farmer) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
        <Text style={styles.errorText}>Farmer not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.surface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Farmer Details</Text>
        <TouchableOpacity onPress={() => router.push(`/farmers/edit?id=${farmer.id}`)} style={styles.headerButton}>
          <Ionicons name="create-outline" size={24} color={Colors.surface} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{farmer.name.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.farmerName}>{farmer.name}</Text>
          <View style={[
            styles.statusBadge,
            { backgroundColor: farmer.verification_status === 'Verified' ? `${Colors.success}20` : farmer.verification_status === 'Rejected' ? `${Colors.error}20` : `${Colors.warning}20` }
          ]}>
            <Text style={[
              styles.statusTextActive,
              { color: farmer.verification_status === 'Verified' ? Colors.success : farmer.verification_status === 'Rejected' ? Colors.error : Colors.warning }
            ]}>{farmer.verification_status || 'Pending'}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Total Orders</Text>
            <Text style={styles.statValue}>{totalOrders}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Total Sales</Text>
            <Text style={styles.statValue}>₹{totalSales.toFixed(2)}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Pending Orders</Text>
            <Text style={[styles.statValue, { color: Colors.warning }]}>{pendingOrders}</Text>
          </View>
        </View>
        
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Financial Overview</Text>
            <TouchableOpacity onPress={() => router.push('/payments/settlements')} style={styles.createBtn}>
              <Text style={styles.createBtnText}>View All</Text>
            </TouchableOpacity>
          </View>
          <InfoRow icon="wallet-outline" label="Total Sales Value" value={`₹${financialStats.totalSales.toFixed(2)}`} />
          <InfoRow icon="cash-outline" label="Total Paid" value={`₹${financialStats.totalPaid.toFixed(2)}`} />
          <InfoRow icon="alert-circle-outline" label="Outstanding Payable" value={`₹${financialStats.outstanding.toFixed(2)}`} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <InfoRow icon="call-outline" label="Phone" value={farmer.phone} />
          {farmer.email && <InfoRow icon="mail-outline" label="Email" value={farmer.email} />}
          <InfoRow icon="location-outline" label="Location" value={`${farmer.village}, ${farmer.district}${farmer.state ? `, ${farmer.state}` : ''}${farmer.pincode ? ` - ${farmer.pincode}` : ''}`} />
          {farmer.address && <InfoRow icon="home-outline" label="Address" value={farmer.address} />}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Farming Details</Text>
          {farmer.farm_name && <InfoRow icon="home-outline" label="Farm Name" value={farmer.farm_name} />}
          <InfoRow icon="map-outline" label="Farm Size" value={farmer.land_size ? `${farmer.land_size} ${farmer.farm_size_unit || 'Acres'}` : 'N/A'} />
          <InfoRow icon="leaf-outline" label="Main Crops" value={farmer.main_crops || 'N/A'} />
        </View>

        {/* Products Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Products Supplied</Text>
            <TouchableOpacity onPress={() => router.push('/products/add')} style={styles.createBtn}>
              <Text style={styles.createBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>
          
          {products.length === 0 ? (
            <View style={styles.emptyOrders}>
              <Text style={styles.emptyText}>No products found.</Text>
            </View>
          ) : (
            products.map(p => {
              const statusInfo = getStockStatus(p.quantity, p.min_order_quantity);
              const statusColor = statusInfo.color === 'success' ? Colors.success : statusInfo.color === 'warning' ? Colors.warning : Colors.error;
              return (
                <TouchableOpacity key={p.id} style={styles.orderCard} onPress={() => router.push(`/products/${p.id}`)}>
                  <View style={styles.orderHeader}>
                    <Text style={styles.orderProduct}>{p.name}</Text>
                    <Text style={[styles.orderId, { color: statusColor, fontWeight: 'bold' }]}>{statusInfo.label}</Text>
                  </View>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                    <Text style={styles.orderAmount}>Stock: {p.quantity} {p.unit}</Text>
                    <Text style={styles.orderAmount}>₹{p.price}/{p.unit}</Text>
                  </View>
                </TouchableOpacity>
              )
            })
          )}
        </View>

        {farmer.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{farmer.notes}</Text>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Orders</Text>
            <TouchableOpacity onPress={() => router.push('/orders/create')} style={styles.createBtn}>
              <Text style={styles.createBtnText}>+ New Order</Text>
            </TouchableOpacity>
          </View>
          
          {orders.length === 0 ? (
            <View style={styles.emptyOrders}>
              <Text style={styles.emptyText}>No orders yet</Text>
            </View>
          ) : (
            orders.slice(0, 5).map(order => (
              <TouchableOpacity key={order.id} style={styles.orderCard} onPress={() => router.push(`/orders/${order.id}`)}>
                <View style={styles.orderHeader}>
                  <Text style={styles.orderId}>{order.order_number || order.id}</Text>
                  <StatusBadge status={order.status} />
                </View>
                <Text style={styles.orderProduct}>{order.product} • {order.quantity} {order.unit}</Text>
                <Text style={styles.orderAmount}>₹{order.total_amount}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap, label: string, value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoRowLeft}>
        <Ionicons name={icon} size={20} color={Colors.textSecondary} style={styles.infoIcon} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.primaryDark, padding: 16 },
  headerButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.surface },
  errorText: { fontSize: 18, color: Colors.text, marginTop: 16 },
  backBtn: { marginTop: 24, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.primary, borderRadius: 8 },
  backBtnText: { color: Colors.surface, fontWeight: 'bold' },
  
  content: { padding: 16, paddingBottom: 40 },
  profileCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 16, elevation: 2, borderWidth: 1, borderColor: Colors.border },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: Colors.surface },
  farmerName: { fontSize: 24, fontWeight: 'bold', color: Colors.text, marginBottom: 8 },
  
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: `${Colors.success}20` },
  statusTextActive: { color: Colors.success, fontSize: 12, fontWeight: 'bold' },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 20 },
  statBox: { flex: 1, backgroundColor: Colors.surface, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginBottom: 4, fontWeight: '500', textAlign: 'center' },
  statValue: { fontSize: 16, fontWeight: 'bold', color: Colors.primaryDark },

  section: { backgroundColor: Colors.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.text, marginBottom: 16 },
  
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.background },
  infoRowLeft: { flexDirection: 'row', alignItems: 'center' },
  infoIcon: { marginRight: 12 },
  infoLabel: { fontSize: 14, color: Colors.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '600', color: Colors.text, flex: 1, textAlign: 'right', marginLeft: 16 },

  notesText: { fontSize: 14, color: Colors.text, lineHeight: 22 },

  createBtn: { backgroundColor: `${Colors.primary}15`, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  createBtnText: { color: Colors.primary, fontWeight: 'bold', fontSize: 12 },
  
  emptyOrders: { alignItems: 'center', padding: 24 },
  emptyText: { color: Colors.textSecondary },

  orderCard: { backgroundColor: Colors.background, padding: 12, borderRadius: 8, marginBottom: 8 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  orderId: { fontSize: 12, fontWeight: 'bold', color: Colors.text },
  orderProduct: { fontSize: 14, fontWeight: '600', color: Colors.primaryDark, marginBottom: 4 },
  orderAmount: { fontSize: 14, fontWeight: 'bold', color: Colors.text }
});
