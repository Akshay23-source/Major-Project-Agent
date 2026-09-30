import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert
} from "react-native";
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/theme/colors';
import { AppHeader } from '../../src/components/ui/AppHeader';
import { SummaryCard } from '../../src/components/ui/SummaryCard';
import { StatusBadge } from '../../src/components/ui/StatusBadge';
import { getUnreadCount } from '../../src/services/notifications';
import { useLocalization } from '../../src/hooks/useLocalization';
import { getLogisticsDashboard } from '../../src/services/logistics';
import { errorMessage } from '../../src/lib/api';

import {
  ACTIVE_STATUSES,
  acceptMarketplaceOrder,
  getMarketplaceOrders,
  markDeliveryFailed,
  markDeliveryReturned,
  MarketplaceFilter,
  MarketplaceOrder,
  rejectMarketplaceOrder,
  getMarketplaceMetrics
} from '../../src/services/integration/marketplaceOrders';
import { retryMarketplaceSync } from '../../src/services/integration/marketplaceSync';

const FILTERS: { key: MarketplaceFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'PICKUP_ASSIGNED', label: 'Pickup Assigned' },
  { key: 'IN_TRANSIT', label: 'In Transit' },
  { key: 'DELIVERED', label: 'Delivered' },
];

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: Colors.error,
  HIGH: Colors.warning,
  NORMAL: Colors.success,
};

type ReasonAction = { kind: 'reject' | 'fail'; order: MarketplaceOrder };

const humanize = (s?: string | null) => (s || 'PENDING').replace(/_/g, ' ');

export default function AgentDashboard() {
  const router = useRouter();
  const agentName = "AgriAgent Logistics";
  const { t } = useLocalization();
  
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const [kpis, setKpis] = useState({
    incomingOrders: 0,
    awaitingPickup: 0,
    outForDelivery: 0,
    deliveredToday: 0,
  });

  const [marketplaceMetrics, setMarketplaceMetrics] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Marketplace Orders State
  const [filter, setFilter] = useState<MarketplaceFilter>('ALL');
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [reason, setReason] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [filter])
  );

  const loadDashboardData = async () => {
    setLoading(true);
    setOrdersLoading(true);
    setLoadError(null);
    try {
      const [count, dashboard, mOrders] = await Promise.all([
        getUnreadCount(), 
        getLogisticsDashboard(),
        getMarketplaceOrders(filter).catch(() => [])
      ]);

      setKpis({
        incomingOrders: dashboard.kpis.incomingOrders || 0,
        awaitingPickup: dashboard.kpis.awaitingPickup || 0,
        outForDelivery: dashboard.kpis.outForDelivery || 0,
        deliveredToday: dashboard.kpis.deliveredToday || 0,
      });
      setUnreadCount(count);
      setOrders(mOrders as MarketplaceOrder[]);

      try {
        const metrics = await getMarketplaceMetrics();
        setMarketplaceMetrics(metrics);
      } catch (mErr) {
        setMarketplaceMetrics(null);
      }
    } catch (e) {
      setLoadError(errorMessage(e));
    } finally {
      setLoading(false);
      setOrdersLoading(false);
    }
  };

  const changeFilter = (f: MarketplaceFilter) => {
    setFilter(f);
  };

  const runOrderAction = async (orderId: string, fn: () => Promise<unknown>, success: string) => {
    setBusyId(orderId);
    try {
      await fn();
      Alert.alert('Done', success);
      await loadDashboardData();
    } catch (e: any) {
      Alert.alert('Action failed', e?.message || 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const submitReason = async () => {
    if (!reasonAction) return;
    const { kind, order } = reasonAction;
    const text = reason.trim();
    if (!text) {
      Alert.alert('Reason required', 'Please tell the marketplace why.');
      return;
    }
    setReasonAction(null);
    setReason('');
    if (kind === 'reject') {
      await runOrderAction(order.id, () => rejectMarketplaceOrder(order.id, text), 'Order rejected. The marketplace has been notified.');
    } else {
      await runOrderAction(order.id, () => markDeliveryFailed(order.id, text), 'Delivery marked as failed. The marketplace has been notified.');
    }
  };

  const renderActions = (o: MarketplaceOrder) => {
    const busy = busyId === o.id;
    const status = o.logistics_status || 'PENDING';
    const buttons: React.ReactNode[] = [];

    if (status === 'PENDING' && o.marketplace_intake_status === 'NEW') {
      buttons.push(
        <ActionButton key="accept" label="Accept" icon="checkmark" disabled={busy}
          onPress={() => runOrderAction(o.id, () => acceptMarketplaceOrder(o.id), 'Order accepted. Assign a driver next.')} />
      );
    }
    if (status === 'PENDING' && o.marketplace_intake_status !== 'REJECTED') {
      buttons.push(
        <ActionButton key="assign" label="Assign Driver & Vehicle" icon="car" disabled={busy}
          onPress={() => router.push(`/logistics/workspace/${o.id}` as any)} />,
        <ActionButton key="reject" label="Reject" icon="close" tone="danger" disabled={busy}
          onPress={() => setReasonAction({ kind: 'reject', order: o })} />
      );
    }
    if (ACTIVE_STATUSES.includes(status)) {
      buttons.push(
        <ActionButton key="track" label="Timeline" icon="list" disabled={busy}
          onPress={() => router.push(`/deliveries/${o.id}` as any)} />,
        <ActionButton key="fail" label="Mark Failed" icon="alert-circle" tone="danger" disabled={busy}
          onPress={() => setReasonAction({ kind: 'fail', order: o })} />
      );
    }
    if (status === 'FAILED_DELIVERY') {
      buttons.push(
        <ActionButton key="return" label="Mark Returned" icon="return-down-back" disabled={busy}
          onPress={() => runOrderAction(o.id, () => markDeliveryReturned(o.id), 'Marked as returned.')} />
      );
    }
    if (o.marketplace_sync_status === 'FAILED') {
      buttons.push(
        <ActionButton key="retry" label="Retry Sync" icon="sync" tone="warning" disabled={busy}
          onPress={() => runOrderAction(o.id, () => retryMarketplaceSync(o.id), 'Sync re-queued.')} />
      );
    }

    if (!buttons.length) return null;
    return (
      <View style={styles.actions}>
        {busy ? <ActivityIndicator color={Colors.primary} /> : buttons}
      </View>
    );
  };

  const newOrdersCount = marketplaceMetrics?.newOrders || 0;
  const awaitingPickupCount = kpis.awaitingPickup + (marketplaceMetrics?.awaitingPickup || 0);

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader 
        title={agentName}
        subtitle="Logistics Control Center"
        unreadCount={unreadCount}
        onNotificationPress={() => router.push('/notifications')}
        onProfilePress={() => router.push('/profile')}
      />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {loading && !orders.length ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 40 }} />
        ) : (
          <>
            {loadError && (
              <TouchableOpacity style={styles.errorBox} onPress={loadDashboardData}>
                <Text style={styles.errorText}>{loadError}</Text>
                <Text style={styles.errorRetry}>Tap to retry</Text>
              </TouchableOpacity>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Operations & Orders</Text>
              
              <View style={styles.kpiGrid}>
                <SummaryCard title="Incoming" value={kpis.incomingOrders} icon="cube" color={Colors.primary} onPress={() => router.push('/orders')} />
                <SummaryCard title="New Orders" value={newOrdersCount} icon="storefront" color={Colors.info} onPress={() => changeFilter('PENDING')} />
              </View>
              <View style={styles.kpiGrid}>
                <SummaryCard title="Awaiting Pickup" value={awaitingPickupCount} icon="time" color={Colors.warning} onPress={() => changeFilter('PICKUP_ASSIGNED')} />
                <SummaryCard title="Out for Delivery" value={kpis.outForDelivery} icon="bicycle" color={Colors.primaryDark} onPress={() => changeFilter('IN_TRANSIT')} />
              </View>
              <View style={styles.kpiGrid}>
                <SummaryCard title="Delivered Today" value={kpis.deliveredToday} icon="checkmark-circle" color={Colors.success} onPress={() => changeFilter('DELIVERED')} />
                <View style={{ flex: 1, marginHorizontal: 4 }} />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Marketplace Orders</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {FILTERS.map((f) => (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.filterChip, filter === f.key && styles.filterChipSelected]}
                    onPress={() => changeFilter(f.key)}
                  >
                    <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextSelected]}>{f.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {ordersLoading ? (
                 <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 20 }} />
              ) : orders.length === 0 ? (
                <View style={styles.center}>
                  <Ionicons name="storefront-outline" size={48} color={Colors.textLight} />
                  <Text style={styles.emptyText}>No marketplace orders found.</Text>
                </View>
              ) : (
                orders.map((o) => (
                  <TouchableOpacity key={o.id} style={styles.card} onPress={() => router.push(`/deliveries/${o.id}` as any)}>
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.orderId}>{o.order_number}</Text>
                        {o.marketplace_intake_status === 'NEW' && o.logistics_status === 'PENDING' ? (
                          <Text style={styles.newTag}>NEW</Text>
                        ) : null}
                      </View>
                      <StatusBadge status={humanize(o.logistics_status)} />
                    </View>

                    <Text style={styles.productName} numberOfLines={2}>{o.product}</Text>

                    <View style={styles.row}>
                      <Ionicons name="leaf-outline" size={14} color={Colors.textSecondary} />
                      <Text style={styles.rowText} numberOfLines={2}>
                        Pickup: {o.pickup_contact_name || '—'}{o.pickup_contact_phone ? ` · ${o.pickup_contact_phone}` : ''}
                        {o.pickup_address ? `\n${o.pickup_address}` : ''}
                      </Text>
                    </View>
                    <View style={styles.row}>
                      <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
                      <Text style={styles.rowText} numberOfLines={2}>
                        Drop: {o.drop_contact_name || '—'}{o.drop_contact_phone ? ` · ${o.drop_contact_phone}` : ''}
                        {o.delivery_location ? `\n${o.delivery_location}` : ''}
                      </Text>
                    </View>

                    <View style={styles.tags}>
                      <View style={[styles.tag, { backgroundColor: (PRIORITY_COLORS[o.priority || 'NORMAL'] || Colors.success) + '20' }]}>
                        <Text style={[styles.tagText, { color: PRIORITY_COLORS[o.priority || 'NORMAL'] || Colors.success }]}>
                          {o.priority || 'NORMAL'} PRIORITY
                        </Text>
                      </View>
                      {o.is_perishable ? (
                        <View style={[styles.tag, { backgroundColor: '#FFEDD5' }]}><Text style={[styles.tagText, { color: '#C2410C' }]}>Perishable</Text></View>
                      ) : null}
                    </View>

                    {renderActions(o)}
                  </TouchableOpacity>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={!!reasonAction} transparent animationType="fade" onRequestClose={() => setReasonAction(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {reasonAction?.kind === 'reject' ? 'Reject order' : 'Mark delivery failed'}
            </Text>
            <Text style={styles.modalSubtitle}>
              {reasonAction?.order.order_number} — the buyer and farmer will see this reason.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder={reasonAction?.kind === 'reject' ? 'e.g. No vehicle available for this route' : 'e.g. Buyer not reachable after 3 attempts'}
              placeholderTextColor={Colors.textLight}
              value={reason}
              onChangeText={setReason}
              multiline
              maxLength={300}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setReasonAction(null); setReason(''); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={submitReason}>
                <Text style={styles.modalConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ActionButton({
  label,
  icon,
  onPress,
  disabled,
  tone = 'primary',
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'danger' | 'warning';
}) {
  const color = tone === 'danger' ? Colors.error : tone === 'warning' ? Colors.warning : Colors.primary;
  return (
    <TouchableOpacity
      style={[styles.actionBtn, { borderColor: color }, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons name={icon} size={14} color={color} />
      <Text style={[styles.actionText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text, marginBottom: 12, paddingHorizontal: 4 },
  
  kpiGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  
  filterChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background, marginRight: 8 },
  filterChipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { color: Colors.textSecondary, fontWeight: '500' },
  filterChipTextSelected: { color: Colors.surface, fontWeight: 'bold' },

  center: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { color: Colors.textSecondary, marginTop: 12, marginBottom: 20, fontSize: 16, textAlign: 'center' },
  
  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  orderId: { fontSize: 14, fontWeight: 'bold', color: Colors.text },
  newTag: { alignSelf: 'flex-start', marginTop: 4, fontSize: 10, fontWeight: 'bold', color: Colors.surface, backgroundColor: Colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  productName: { fontSize: 15, fontWeight: '600', color: Colors.primaryDark, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 },
  rowText: { flex: 1, fontSize: 13, color: Colors.textSecondary },

  tags: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, marginRight: 6, marginBottom: 4 },
  tagText: { fontSize: 10, fontWeight: 'bold' },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  actionText: { fontSize: 12, fontWeight: '600' },

  errorBox: { backgroundColor: Colors.error + '15', borderColor: Colors.error, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 16 },
  errorText: { color: Colors.error, fontSize: 14, fontWeight: '600' },
  errorRetry: { color: Colors.error, fontSize: 12, marginTop: 4 },

  modalBackdrop: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  modalSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, marginBottom: 12 },
  modalInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 12, minHeight: 80, textAlignVertical: 'top', color: Colors.text },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  modalCancel: { paddingHorizontal: 16, paddingVertical: 10 },
  modalCancelText: { color: Colors.textSecondary, fontWeight: '600' },
  modalConfirm: { backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  modalConfirmText: { color: Colors.surface, fontWeight: 'bold' },
});
