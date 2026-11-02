/**
 * Driver — Incoming Orders screen.
 * Shows all marketplace orders that have not yet been accepted by any driver.
 * Driver can Accept or Reject each order.
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
import { getAvailableDeliveries, acceptDelivery } from '../../src/services/driver/deliveries';
import { api } from '../../src/lib/api';

export default function IncomingOrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [])
  );

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await getAvailableDeliveries();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load incoming orders:', err);
      Alert.alert('Error', 'Could not load incoming orders. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAccept = async (item: any) => {
    setBusyId(item.id);
    try {
      await acceptDelivery(item.id);
      Alert.alert(
        '✅ Order Accepted',
        `You have accepted order #${item.orders?.order_number || String(item.id || '').slice(-6)}. Proceed to pickup.`,
        [
          {
            text: 'View Delivery',
            onPress: () => router.push(`/(driver)/deliveries/${item.id}` as any),
          },
          { text: 'OK', onPress: loadOrders },
        ]
      );
    } catch (err: any) {
      const msg = err?.message || 'Could not accept this order. It may have been taken by another driver.';
      Alert.alert('Accept Failed', msg);
      loadOrders(); // Refresh to remove already-accepted orders
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (item: any) => {
    Alert.alert(
      'Reject Order',
      `Are you sure you want to reject order #${item.orders?.order_number || String(item.id || '').slice(-6)}? It will be made available to other drivers.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setBusyId(item.id + '_reject');
            try {
              await api.post(`/driver/deliveries/${item.id}/reject`, { reason: 'Declined by driver' });
              Alert.alert('Rejected', 'Order has been returned to the queue.');
              loadOrders();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Could not reject this order.');
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-IN', {
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
    const isAcceptBusy = busyId === item.id;
    const isRejectBusy = busyId === item.id + '_reject';
    const isBusy = isAcceptBusy || isRejectBusy;

    const pickupAddr =
      order.farmers?.address ||
      order.pickup_address ||
      item.pickup_location ||
      'Pickup Location';
    const dropAddr =
      order.buyers?.address ||
      (typeof order.drop_address === 'string' ? order.drop_address : order.drop_address?.address) ||
      order.delivery_location ||
      item.drop_location ||
      'Delivery Location';

    return (
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.orderBadge}>
            <Ionicons name="cube-outline" size={14} color={Colors.primary} />
            <Text style={styles.orderNum}>#{order.order_number || String(item.id || '').slice(-6).toUpperCase()}</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>NEW</Text>
          </View>
        </View>

        {/* Product */}
        <Text style={styles.productName} numberOfLines={2}>
          {order.product || 'Marketplace Delivery'}
        </Text>
        <Text style={styles.quantity}>
          {order.quantity ? `${order.quantity} ${order.unit || 'units'}` : ''}
          {order.total_amount ? `  ·  ₹${order.total_amount}` : ''}
          {order.payment_status ? `  ·  ${order.payment_status}` : ''}
        </Text>

        {/* Route */}
        <View style={styles.route}>
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: Colors.success }]} />
            <Text style={styles.routeText} numberOfLines={1}>
              Pickup: {pickupAddr}
            </Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: Colors.error }]} />
            <Text style={styles.routeText} numberOfLines={1}>
              Drop: {dropAddr}
            </Text>
          </View>
        </View>

        {/* Customer info (if available) */}
        {(order.customer_name || order.drop_contact_name) && (
          <View style={styles.customerRow}>
            <Ionicons name="person-outline" size={13} color={Colors.textSecondary} />
            <Text style={styles.customerText}>
              {order.customer_name || order.drop_contact_name}
            </Text>
          </View>
        )}

        {/* Timestamp */}
        <Text style={styles.timestamp}>Received: {formatDate(order.created_at || item.created_at)}</Text>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.rejectBtn, isBusy && styles.disabledBtn]}
            onPress={() => handleReject(item)}
            disabled={isBusy}
          >
            {isRejectBusy ? (
              <ActivityIndicator color={Colors.error} size="small" />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={16} color={Colors.error} />
                <Text style={styles.rejectBtnText}>Reject</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.acceptBtn, isBusy && styles.disabledBtn]}
            onPress={() => handleAccept(item)}
            disabled={isBusy}
          >
            {isAcceptBusy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                <Text style={styles.acceptBtnText}>Accept Delivery</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title="Incoming Orders" subtitle="New marketplace deliveries" />

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading incoming orders...</Text>
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
              <Ionicons name="checkmark-circle-outline" size={56} color={Colors.textLight} />
              <Text style={styles.emptyTitle}>No Incoming Orders</Text>
              <Text style={styles.emptySubtitle}>
                New delivery orders from the marketplace will appear here.
              </Text>
              <TouchableOpacity style={styles.refreshBtn} onPress={loadOrders}>
                <Ionicons name="refresh" size={16} color={Colors.primary} />
                <Text style={styles.refreshText}>Refresh</Text>
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
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  orderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderNum: { fontSize: 15, fontWeight: 'bold', color: Colors.text },
  statusBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusText: { fontSize: 11, fontWeight: 'bold', color: '#1D4ED8' },

  productName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primaryDark,
    marginBottom: 4,
  },
  quantity: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 12,
  },

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

  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  customerText: { fontSize: 13, color: Colors.textSecondary },

  timestamp: {
    fontSize: 12,
    color: Colors.textLight,
    marginBottom: 12,
  },

  actions: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  acceptBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  acceptBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.error,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  rejectBtnText: { color: Colors.error, fontWeight: '600', fontSize: 14 },
  disabledBtn: { opacity: 0.5 },

  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  refreshText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
});

