import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../../src/theme/colors';
import { StatusBadge } from '../../../src/components/ui/StatusBadge';
import {
  ACTIVE_STATUSES,
  acceptMarketplaceOrder,
  getMarketplaceOrders,
  markDeliveryFailed,
  markDeliveryReturned,
  MarketplaceFilter,
  MarketplaceOrder,
  rejectMarketplaceOrder,
} from '../../../src/services/integration/marketplaceOrders';
import { retryMarketplaceSync } from '../../../src/services/integration/marketplaceSync';

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

export default function MarketplaceOrdersScreen() {
  const params = useLocalSearchParams<{ filter?: string }>();
  const initial = FILTERS.some((f) => f.key === params.filter) ? (params.filter as MarketplaceFilter) : 'ALL';

  const [filter, setFilter] = useState<MarketplaceFilter>(initial);
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async (f: MarketplaceFilter) => {
    setError('');
    try {
      setOrders(await getMarketplaceOrders(f));
    } catch (e: any) {
      console.error('Marketplace orders load failed:', e);
      setError(e?.message || 'Failed to load marketplace orders.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(filter);
    }, [filter, load])
  );

  const changeFilter = (f: MarketplaceFilter) => {
    setLoading(true);
    setFilter(f);
  };

  const run = async (orderId: string, fn: () => Promise<unknown>, success: string) => {
    setBusyId(orderId);
    try {
      await fn();
      Alert.alert('Done', success);
      await load(filter);
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
      await run(order.id, () => rejectMarketplaceOrder(order.id, text), 'Order rejected. The marketplace has been notified.');
    } else {
      await run(order.id, () => markDeliveryFailed(order.id, text), 'Delivery marked as failed. The marketplace has been notified.');
    }
  };

  const renderActions = (o: MarketplaceOrder) => {
    const busy = busyId === o.id;
    const status = o.logistics_status || 'PENDING';
    const buttons: React.ReactNode[] = [];

    if (status === 'PENDING' && o.marketplace_intake_status === 'NEW') {
      buttons.push(
        <ActionButton key="accept" label="Accept" icon="checkmark" disabled={busy}
          onPress={() => run(o.id, () => acceptMarketplaceOrder(o.id), 'Order accepted. Assign a driver next.')} />
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
          onPress={() => run(o.id, () => markDeliveryReturned(o.id), 'Marked as returned.')} />
      );
    }
    if (o.marketplace_sync_status === 'FAILED') {
      buttons.push(
        <ActionButton key="retry" label="Retry Sync" icon="sync" tone="warning" disabled={busy}
          onPress={() => run(o.id, () => retryMarketplaceSync(o.id), 'Sync re-queued.')} />
      );
    }

    if (!buttons.length) return null;
    return (
      <View style={styles.actions}>
        {busy ? <ActivityIndicator color={Colors.primary} /> : buttons}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.primaryDark} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Marketplace Orders</Text>
            <Text style={styles.headerSubtitle}>From Farm Marketplace</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => { setRefreshing(true); load(filter); }}>
          <Ionicons name="refresh" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.controls}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load(filter)}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(filter); }} />}
        >
          {orders.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="storefront-outline" size={48} color={Colors.textLight} />
              <Text style={styles.emptyText}>No marketplace orders here yet.</Text>
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
                    Pickup (farmer): {o.pickup_contact_name || '—'}{o.pickup_contact_phone ? ` · ${o.pickup_contact_phone}` : ''}
                    {o.pickup_address ? `\n${o.pickup_address}` : ''}
                  </Text>
                </View>
                <View style={styles.row}>
                  <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.rowText} numberOfLines={2}>
                    Drop (buyer): {o.drop_contact_name || '—'}{o.drop_contact_phone ? ` · ${o.drop_contact_phone}` : ''}
                    {o.delivery_location ? `\n${o.delivery_location}` : ''}
                  </Text>
                </View>
                {o.notes ? (
                  <View style={styles.row}>
                    <Ionicons name="information-circle-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.rowText} numberOfLines={2}>Instructions: {o.notes}</Text>
                  </View>
                ) : null}

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

                <View style={styles.syncRow}>
                  <Ionicons
                    name={o.marketplace_sync_status === 'FAILED' ? 'cloud-offline-outline' : o.marketplace_sync_status === 'PENDING' ? 'cloud-upload-outline' : 'cloud-done-outline'}
                    size={14}
                    color={o.marketplace_sync_status === 'FAILED' ? Colors.error : Colors.textLight}
                  />
                  <Text style={[styles.syncText, o.marketplace_sync_status === 'FAILED' && { color: Colors.error }]} numberOfLines={2}>
                    {o.marketplace_sync_status === 'FAILED'
                      ? `Sync failed: ${o.marketplace_last_error || 'unknown error'}`
                      : o.marketplace_sync_status === 'PENDING'
                        ? 'Sending update to marketplace…'
                        : o.marketplace_last_synced_at
                          ? `Synced ${new Date(o.marketplace_last_synced_at).toLocaleString()}`
                          : 'Synced'}
                  </Text>
                </View>

                {renderActions(o)}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.primaryDark },
  headerSubtitle: { fontSize: 12, color: Colors.textSecondary },

  controls: { backgroundColor: Colors.surface, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  filterChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background, marginRight: 8 },
  filterChipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { color: Colors.textSecondary, fontWeight: '500' },
  filterChipTextSelected: { color: Colors.surface, fontWeight: 'bold' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { color: Colors.textSecondary, marginTop: 12, marginBottom: 20, fontSize: 16, textAlign: 'center' },
  retryBtn: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryBtnText: { color: Colors.surface, fontWeight: 'bold' },

  list: { padding: 16, flexGrow: 1 },
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

  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  syncText: { flex: 1, fontSize: 11, color: Colors.textLight },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  actionText: { fontSize: 12, fontWeight: '600' },

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
