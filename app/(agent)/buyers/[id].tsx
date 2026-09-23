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
import { getBuyerById, Buyer, getBuyerStats } from '../../../src/services/buyers';
import { getOrders } from '../../../src/services/orders';
import { Colors } from '../../../src/theme/colors';
import { StatusBadge } from '../../../src/components/ui/StatusBadge';

export default function BuyerDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalOrders: 0, completedOrders: 0, pendingOrders: 0, totalPurchaseValue: 0 });
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [id])
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const bData = await getBuyerById(id as string);
      setBuyer(bData);
      
      const allOrders = await getOrders();
      const bOrders = allOrders.filter((o: any) => o.buyer_id === id);
      setOrders(bOrders);

      const bStats = await getBuyerStats(id as string);
      setStats(bStats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (!buyer) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
        <Text style={styles.errorText}>Buyer not found</Text>
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
        <Text style={styles.headerTitle}>Buyer Details</Text>
        <TouchableOpacity onPress={() => router.push(`/buyers/edit?id=${buyer.id}`)} style={styles.headerButton}>
          <Ionicons name="create-outline" size={24} color={Colors.surface} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{buyer.name.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.buyerName}>{buyer.name}</Text>
          {buyer.company_name && <Text style={{color: Colors.textSecondary, marginBottom: 8}}>{buyer.company_name}</Text>}
          <View style={[styles.statusBadge, buyer.status?.toLowerCase() === 'active' || buyer.status === 'Active' ? styles.statusActive : styles.statusInactive]}>
            <Text style={[styles.statusText, buyer.status?.toLowerCase() === 'active' || buyer.status === 'Active' ? styles.statusTextActive : styles.statusTextInactive]}>
              {buyer.status || 'Active'}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Total Orders</Text>
            <Text style={styles.statValue}>{stats.totalOrders}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Total Value</Text>
            <Text style={styles.statValue}>₹{stats.totalPurchaseValue.toFixed(2)}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Pending</Text>
            <Text style={[styles.statValue, { color: Colors.warning }]}>{stats.pendingOrders}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <InfoRow icon="call-outline" label="Phone" value={buyer.phone} />
          {buyer.email && <InfoRow icon="mail-outline" label="Email" value={buyer.email} />}
          <InfoRow icon="location-outline" label="Location" value={buyer.city ? `${buyer.city}${buyer.state ? `, ${buyer.state}` : ''}${buyer.pincode ? ` - ${buyer.pincode}` : ''}` : buyer.location || 'N/A'} />
          {buyer.address && <InfoRow icon="home-outline" label="Address" value={buyer.address} />}
          <InfoRow icon="briefcase-outline" label="Buyer Type" value={buyer.buyer_type || buyer.type || 'N/A'} />
        </View>
        
        {buyer.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={{color: Colors.text}}>{buyer.notes}</Text>
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
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: Colors.surface },
  buyerName: { fontSize: 24, fontWeight: 'bold', color: Colors.text, marginBottom: 8 },
  
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusActive: { backgroundColor: `${Colors.success}20` },
  statusInactive: { backgroundColor: `${Colors.textSecondary}20` },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  statusTextActive: { color: Colors.success },
  statusTextInactive: { color: Colors.textSecondary },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 20 },
  statBox: { flex: 1, backgroundColor: Colors.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  statLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4, fontWeight: '500' },
  statValue: { fontSize: 20, fontWeight: 'bold', color: Colors.primaryDark },

  section: { backgroundColor: Colors.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.text, marginBottom: 16 },
  
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.background },
  infoRowLeft: { flexDirection: 'row', alignItems: 'center' },
  infoIcon: { marginRight: 12 },
  infoLabel: { fontSize: 14, color: Colors.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '600', color: Colors.text, flex: 1, textAlign: 'right', marginLeft: 16 },

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
