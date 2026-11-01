/**
 * Driver — Delivered Today screen.
 * Shows all orders the driver has delivered today (sorted by delivery_time DESC).
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
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { AppHeader } from '../../src/components/ui/AppHeader';
import { getMyDeliveries } from '../../src/services/driver/deliveries';

export default function DeliveredTodayScreen() {
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
      const all = await getMyDeliveries('COMPLETED');
      const list = Array.isArray(all) ? all : [];

      // Filter to today (UTC midnight)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const today = list.filter((d: any) => {
        // Use delivery_time if available, fallback to created_at
        const ts = d.delivery_time || d.updated_at || d.created_at;
        if (!ts) return false;
        return new Date(ts) >= todayStart;
      });

      setOrders(today);
    } catch (err) {
      console.error('Failed to load delivered orders:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
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
    const deliveredAt = item.delivery_time || item.updated_at;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.orderBadge}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
            <Text style={styles.orderNum}>#{order.order_number || item.delivery_number || item.id.slice(-6).toUpperCase()}</Text>
          </View>
          <Text style={styles.deliveredTime}>{formatTime(deliveredAt)}</Text>
        </View>

        <Text style={styles.productName} numberOfLines={1}>
          {order.product || 'Delivered Package'}
        </Text>
        {order.quantity && (
          <Text style={styles.quantity}>{order.quantity} {order.unit || 'units'}</Text>
        )}

        {/* Customer */}
        {(order.buyers?.name || order.customer_name || order.drop_contact_name) && (
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={13} color={Colors.textSecondary} />
            <Text style={styles.infoText}>
              {order.buyers?.name || order.customer_name || order.drop_contact_name}
            </Text>
          </View>
        )}

        {/* Drop address */}
        {(order.buyers?.address || order.delivery_location) && (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={13} color={Colors.error} />
            <Text style={styles.infoText} numberOfLines={1}>
              {order.buyers?.address || order.delivery_location}
            </Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.deliveredLabel}>
            Delivered: {formatDate(deliveredAt)}
          </Text>
          <View style={styles.deliveredBadge}>
            <Text style={styles.deliveredBadgeText}>DELIVERED</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title="Delivered Today" subtitle={`${orders.length} deliveries completed`} />

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
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
              <Text style={styles.emptyTitle}>No Deliveries Today</Text>
              <Text style={styles.emptySubtitle}>
                Orders you complete today will appear here with their delivery timestamp.
              </Text>
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
  list: { padding: 16, paddingBottom: 32 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
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
    marginBottom: 8,
  },
  orderBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  orderNum: { fontSize: 15, fontWeight: 'bold', color: Colors.text },
  deliveredTime: { fontSize: 14, fontWeight: '700', color: Colors.success },

  productName: { fontSize: 16, fontWeight: '700', color: Colors.primaryDark, marginBottom: 3 },
  quantity: { fontSize: 13, color: Colors.textSecondary, marginBottom: 10 },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  infoText: { flex: 1, fontSize: 13, color: Colors.textSecondary },

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  deliveredLabel: { fontSize: 12, color: Colors.textSecondary },
  deliveredBadge: {
    backgroundColor: Colors.success + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  deliveredBadgeText: { fontSize: 11, fontWeight: 'bold', color: Colors.success },

  emptyContainer: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text, marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});

