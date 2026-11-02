/**
 * Driver — Awaiting Orders screen.
 * Shows all orders the driver has accepted and is awaiting pickup.
 * Maps to logistics_tracking_status: ACCEPTED, DRIVER_EN_ROUTE, ARRIVED_AT_FARM
 */
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { AppHeader } from '../../src/components/ui/AppHeader';
import { getMyDeliveries } from '../../src/services/driver/deliveries';

const AWAITING_STATUSES = ['ACCEPTED', 'DRIVER_EN_ROUTE', 'ARRIVED_AT_FARM'];

const STATUS_LABELS: Record<string, string> = {
  ACCEPTED: 'Accepted',
  DRIVER_EN_ROUTE: 'En Route to Farm',
  ARRIVED_AT_FARM: 'Arrived at Farm',
};

export default function AwaitingOrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [])
  );

  const loadOrders = async () => {
    setLoading(true);
    try {
      const all = await getMyDeliveries('ALL');
      const list = Array.isArray(all) ? all : [];
      const awaiting = list.filter((d: any) =>
        AWAITING_STATUSES.includes(d.logistics_tracking_status)
      );
      setOrders(awaiting);
    } catch (err) {
      console.error('Failed to load awaiting orders:', err);
      Alert.alert('Error', 'Could not load awaiting orders.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const order = item.orders || {};
    const pickupAddr =
      order.farmers?.address || order.pickup_address || item.pickup_location || 'Pickup Location';
    const dropAddr =
      order.buyers?.address ||
      (typeof order.drop_address === 'string' ? order.drop_address : order.drop_address?.address) ||
      order.delivery_location || item.drop_location || 'Delivery Location';
    const statusLabel = STATUS_LABELS[item.logistics_tracking_status] || item.logistics_tracking_status;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => router.push(`/(driver)/deliveries/${item.id}` as any)}
      >
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.orderBadge}>
            <Ionicons name="time-outline" size={14} color={Colors.warning} />
            <Text style={styles.orderNum}>#{order.order_number || String(item.id || '').slice(-6).toUpperCase()}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: Colors.warning + '20' }]}>
            <Text style={[styles.statusText, { color: Colors.warning }]}>{statusLabel}</Text>
          </View>
        </View>

        <Text style={styles.productName} numberOfLines={1}>
          {order.product || 'Delivery Assignment'}
        </Text>
        {order.quantity && (
          <Text style={styles.quantity}>{order.quantity} {order.unit || 'units'}</Text>
        )}

        {/* Route */}
        <View style={styles.route}>
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: Colors.success }]} />
            <Text style={styles.routeText} numberOfLines={1}>Pickup: {pickupAddr}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: Colors.error }]} />
            <Text style={styles.routeText} numberOfLines={1}>Drop: {dropAddr}</Text>
          </View>
        </View>

        {/* Acceptance time */}
        {item.accepted_at && (
          <Text style={styles.timestamp}>
            <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
            {' '}Accepted: {formatDate(item.accepted_at)}
          </Text>
        )}

        <View style={styles.viewRow}>
          <Text style={styles.viewText}>Tap to view details & update status</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title="Awaiting Pickup" subtitle="Accepted orders awaiting dispatch" />

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading awaiting orders...</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadOrders(); }}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="time-outline" size={56} color={Colors.textLight} />
              <Text style={styles.emptyTitle}>No Awaiting Orders</Text>
              <Text style={styles.emptySubtitle}>
                Orders you accept from Incoming will appear here while awaiting pickup.
              </Text>
              <TouchableOpacity
                style={styles.incomingBtn}
                onPress={() => router.push('/(driver)/incoming' as any)}
              >
                <Ionicons name="cube-outline" size={16} color="#fff" />
                <Text style={styles.incomingBtnText}>View Incoming Orders</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: Colors.textSecondary, fontSize: 14 },
  list: { padding: 16, paddingBottom: 32 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  orderBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  orderNum: { fontSize: 15, fontWeight: 'bold', color: Colors.text },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusText: { fontSize: 11, fontWeight: 'bold' },
  productName: { fontSize: 16, fontWeight: '700', color: Colors.primaryDark, marginBottom: 4 },
  quantity: { fontSize: 13, color: Colors.textSecondary, marginBottom: 10 },
  route: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeLine: { width: 2, height: 10, backgroundColor: Colors.border, marginLeft: 5, marginVertical: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  routeText: { flex: 1, fontSize: 13, color: Colors.text },
  timestamp: { fontSize: 12, color: Colors.textSecondary, marginBottom: 10 },
  viewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  viewText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },

  emptyContainer: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text, marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  incomingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  incomingBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});

