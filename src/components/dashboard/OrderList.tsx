import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../theme/colors';
import { StatusBadge } from '../ui/StatusBadge';
import { Role } from '../../lib/api';
import DashboardActions from './DashboardActions';
import { getMyDeliveries, getAvailableDeliveries } from '../../services/driver/deliveries';
import { getOrders } from '../../services/orders';

interface OrderItem {
  id: string;
  order_number: string;
  product: string;
  quantity: number;
  unit: string;
  logistics_status?: string;
  logistics_tracking_status?: string;
  pickup_address?: string;
  drop_address?: string;
  priority?: string;
  is_perishable?: boolean;
}

interface OrderListProps {
  role: Role;
}

export default function OrderList({ role }: OrderListProps) {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      if (role === 'agent') {
        const rawOrders = await getOrders();
        const list = Array.isArray(rawOrders) ? rawOrders : [];
        setOrders(
          list.map((o: any) => ({
            id: o.id || o._id,
            order_number: o.order_number || 'N/A',
            product: o.product || 'Agricultural Goods',
            quantity: o.quantity || 1,
            unit: o.unit || 'unit',
            logistics_status: o.logistics_status || o.status || 'PENDING',
            logistics_tracking_status: o.logistics_status || o.status || 'PENDING',
            pickup_address: o.pickup_address || o.farmers?.address || 'Pickup Location',
            drop_address:
              typeof o.drop_address === 'string'
                ? o.drop_address
                : o.drop_address?.address || o.delivery_location || o.buyers?.address || 'Delivery Location',
            priority: o.priority,
            is_perishable: o.is_perishable,
          }))
        );
      } else {
        // Driver Role: fetch assigned deliveries via authenticated client
        let deliveries = await getMyDeliveries('ALL');
        let list = Array.isArray(deliveries) ? deliveries : [];

        // If no direct assignments yet, check available delivery queue
        if (list.length === 0) {
          try {
            const avail = await getAvailableDeliveries();
            if (Array.isArray(avail) && avail.length > 0) {
              list = avail;
            }
          } catch {
            // Non-critical fallback
          }
        }

        setOrders(
          list.map((d: any) => {
            const orderInfo = d.orders || {};
            const pickupAddr =
              orderInfo.farmers?.address ||
              orderInfo.pickup_address ||
              d.pickup_location ||
              'Pickup Location';
            const dropAddr =
              typeof orderInfo.drop_address === 'string'
                ? orderInfo.drop_address
                : orderInfo.drop_address?.address ||
                  orderInfo.delivery_location ||
                  orderInfo.buyers?.address ||
                  d.drop_location ||
                  'Delivery Location';

            return {
              id: d.id || d._id,
              order_number: orderInfo.order_number || d.order_number || d.delivery_number || 'DELIVERY',
              product: orderInfo.product || d.product || 'Agricultural Produce',
              quantity: orderInfo.quantity || d.quantity || 1,
              unit: orderInfo.unit || d.unit || 'unit',
              logistics_status: orderInfo.logistics_status || d.logistics_tracking_status || d.status || 'ASSIGNED',
              logistics_tracking_status: d.logistics_tracking_status || d.status || 'ASSIGNED',
              pickup_address: pickupAddr,
              drop_address: dropAddr,
              priority: orderInfo.priority,
              is_perishable: orderInfo.is_perishable,
            };
          })
        );
      }
    } catch (e) {
      console.error('Failed to load orders:', e);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleCardPress = (orderId: string) => {
    if (role === 'driver') {
      router.push(`/(driver)/deliveries/${orderId}` as any);
    } else {
      router.push(`/(agent)/orders/${orderId}` as any);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading orders...</Text>
      </View>
    );
  }

  if (orders.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cube-outline" size={48} color={Colors.textLight} />
        <Text style={styles.emptyTitle}>
          {role === 'driver' ? 'No Assigned Deliveries' : 'No Orders Available'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {role === 'driver'
            ? 'New delivery assignments will appear here once dispatched.'
            : 'Incoming orders will be shown here.'}
        </Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadOrders}>
          <Ionicons name="refresh" size={16} color={Colors.primary} />
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>
          {role === 'driver' ? 'My Deliveries' : 'Goods to Transfer'}
        </Text>
        <TouchableOpacity onPress={loadOrders} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="refresh" size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {orders.map((o) => (
        <TouchableOpacity
          key={o.id}
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => handleCardPress(o.id)}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.orderId}>#{o.order_number}</Text>
            <StatusBadge status={o.logistics_tracking_status || o.logistics_status || 'ASSIGNED'} />
          </View>

          <Text style={styles.productName}>
            {o.quantity} {o.unit} • {o.product}
          </Text>

          <View style={styles.row}>
            <Ionicons name="location" size={14} color={Colors.primary} />
            <Text style={styles.rowText} numberOfLines={1}>
              Pickup: {o.pickup_address}
            </Text>
          </View>
          <View style={styles.row}>
            <Ionicons name="flag" size={14} color={Colors.error} />
            <Text style={styles.rowText} numberOfLines={1}>
              Drop: {o.drop_address}
            </Text>
          </View>

          <DashboardActions
            role={role}
            orderId={o.id}
            status={o.logistics_tracking_status || o.logistics_status || 'ASSIGNED'}
            onRefresh={loadOrders}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  center: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: Colors.textSecondary },
  emptyContainer: { padding: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, marginVertical: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#E8F5E9' },
  refreshText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  orderId: { fontWeight: 'bold', color: Colors.text },
  productName: { fontSize: 15, color: Colors.primaryDark, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  rowText: { fontSize: 13, color: Colors.textSecondary },
});
