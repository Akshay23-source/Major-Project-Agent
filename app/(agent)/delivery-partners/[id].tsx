import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import * as Linking from 'expo-linking';
import { Colors } from '../../../src/theme/colors';
import { StatusBadge } from '../../../src/components/ui/StatusBadge';
import { getDeliveryPartnerDetails } from '../../../src/services/logistics';
import { errorMessage } from '../../../src/lib/api';

export default function DeliveryPartnerDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [partner, setPartner] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getDeliveryPartnerDetails(id as string);
      setPartner(data);
    } catch (err) {
      console.error('Failed to load partner details:', err);
      Alert.alert('Error', errorMessage(err, 'Could not load delivery partner details.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const callPartner = (phone?: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (!partner) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
        <Text style={styles.errorText}>Delivery Partner not found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isAvailable = partner.status === 'AVAILABLE' || partner.status === 'ONLINE';
  const isBusy = partner.status === 'BUSY' || partner.status === 'ON_DELIVERY';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Partner Profile</Text>
        <TouchableOpacity onPress={() => callPartner(partner.phone)} style={styles.headerBtn}>
          <Ionicons name="call" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Header Card */}
        <View style={styles.card}>
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={32} color={Colors.surface} />
            </View>
            <View style={styles.avatarInfo}>
              <Text style={styles.partnerName}>{partner.name}</Text>
              <Text style={styles.partnerPhone}>📞 {partner.phone}</Text>
              {partner.email ? <Text style={styles.partnerEmail}>✉️ {partner.email}</Text> : null}
            </View>
            <View style={[
              styles.statusPill,
              isAvailable ? styles.statusAvail : isBusy ? styles.statusBusy : styles.statusOffline
            ]}>
              <Text style={[
                styles.statusPillText,
                isAvailable ? styles.statusTextAvail : isBusy ? styles.statusTextBusy : styles.statusTextOffline
              ]}>
                {partner.status}
              </Text>
            </View>
          </View>

          {/* Registration & Vehicle Info */}
          <View style={styles.infoGrid}>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Vehicle</Text>
              <Text style={styles.infoValue}>
                {partner.vehicle_number || 'Not registered'}
              </Text>
              {partner.vehicle_type ? (
                <Text style={styles.infoSub}>{partner.vehicle_type}</Text>
              ) : null}
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Joined Date</Text>
              <Text style={styles.infoValue}>
                {partner.created_at ? new Date(partner.created_at).toLocaleDateString() : '—'}
              </Text>
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Rating</Text>
              <Text style={styles.infoValue}>⭐ {partner.rating || 5.0}</Text>
            </View>
          </View>
        </View>

        {/* Performance Statistics */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{partner.completed_deliveries || 0}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{partner.failed_deliveries || 0}</Text>
            <Text style={styles.statLabel}>Failed</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>
              {partner.current_assignment ? '1 Active' : 'Idle'}
            </Text>
            <Text style={styles.statLabel}>Current State</Text>
          </View>
        </View>

        {/* Current Active Assignment */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cube" size={18} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Active Assignment</Text>
          </View>

          {partner.current_assignment ? (
            <View style={styles.activeAssignmentBox}>
              <View style={styles.assignRow}>
                <Text style={styles.assignOrderNum}>
                  Order #{partner.current_assignment.order_number || partner.current_assignment.delivery_number}
                </Text>
                <StatusBadge status={partner.current_assignment.logistics_tracking_status || partner.current_assignment.status} />
              </View>
              {partner.current_assignment.product ? (
                <Text style={styles.assignProduct}>
                  📦 {partner.current_assignment.product}
                  {partner.current_assignment.quantity ? ` • ${partner.current_assignment.quantity} ${partner.current_assignment.unit || ''}` : ''}
                </Text>
              ) : null}
              {partner.current_assignment.pickup_address ? (
                <Text style={styles.assignLocation}>
                  📍 Pickup: {partner.current_assignment.pickup_address}
                </Text>
              ) : null}
              {partner.current_assignment.delivery_address ? (
                <Text style={styles.assignLocation}>
                  🏁 Drop: {partner.current_assignment.delivery_address}
                </Text>
              ) : null}
              {partner.current_assignment.accepted_at ? (
                <Text style={styles.assignTime}>
                  Accepted: {new Date(partner.current_assignment.accepted_at).toLocaleString()}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.noActiveText}>Driver is currently free with no active delivery assignment.</Text>
          )}
        </View>

        {/* Delivery History */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time" size={18} color={Colors.primary} />
            <Text style={styles.sectionTitle}>
              Delivery History ({partner.delivery_history?.length || 0})
            </Text>
          </View>

          {!partner.delivery_history || partner.delivery_history.length === 0 ? (
            <Text style={styles.noActiveText}>No past deliveries recorded yet.</Text>
          ) : (
            partner.delivery_history.map((job: any) => (
              <View key={job._id || job.id} style={styles.historyItem}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyOrder}>
                    {job.order?.order_number || job.delivery_number || 'DELIVERY'}
                  </Text>
                  <StatusBadge status={job.logistics_tracking_status || job.status} />
                </View>
                {job.order?.product ? (
                  <Text style={styles.historyProduct}>
                    {job.order.product} ({job.order.quantity} {job.order.unit})
                  </Text>
                ) : null}
                <View style={styles.historyFooter}>
                  <Text style={styles.historyDate}>
                    {job.delivery_time
                      ? `Delivered: ${new Date(job.delivery_time).toLocaleDateString()}`
                      : new Date(job.created_at).toLocaleDateString()}
                  </Text>
                  {job.order?.total_amount ? (
                    <Text style={styles.historyAmount}>₹{job.order.total_amount}</Text>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center', flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.primaryDark },
  errorText: { fontSize: 16, color: Colors.textSecondary, marginTop: 12 },
  backBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  backBtnText: { color: Colors.surface, fontWeight: 'bold' },
  content: { padding: 16, paddingBottom: 40 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInfo: { flex: 1, marginLeft: 12 },
  partnerName: { fontSize: 18, fontWeight: 'bold', color: Colors.primaryDark },
  partnerPhone: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  partnerEmail: { fontSize: 12, color: Colors.textLight, marginTop: 1 },

  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusAvail: { backgroundColor: Colors.success + '20' },
  statusBusy: { backgroundColor: Colors.warning + '20' },
  statusOffline: { backgroundColor: Colors.textLight + '20' },
  statusPillText: { fontSize: 11, fontWeight: 'bold' },
  statusTextAvail: { color: Colors.success },
  statusTextBusy: { color: Colors.warning },
  statusTextOffline: { color: Colors.textSecondary },

  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 14,
    paddingTop: 12,
  },
  infoCol: { flex: 1 },
  infoLabel: { fontSize: 11, color: Colors.textLight },
  infoValue: { fontSize: 13, fontWeight: '600', color: Colors.text, marginTop: 2 },
  infoSub: { fontSize: 11, color: Colors.textSecondary },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statBox: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statNumber: { fontSize: 18, fontWeight: 'bold', color: Colors.primaryDark },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },

  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: Colors.text },

  activeAssignmentBox: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  assignRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  assignOrderNum: { fontSize: 15, fontWeight: 'bold', color: '#0369A1' },
  assignProduct: { fontSize: 13, color: '#334155', fontWeight: '500', marginBottom: 4 },
  assignLocation: { fontSize: 12, color: '#64748B', marginBottom: 2 },
  assignTime: { fontSize: 11, color: '#0284C7', marginTop: 4, fontStyle: 'italic' },
  noActiveText: { fontSize: 13, color: Colors.textSecondary, fontStyle: 'italic' },

  historyItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  historyOrder: { fontSize: 14, fontWeight: '600', color: Colors.text },
  historyProduct: { fontSize: 13, color: Colors.textSecondary },
  historyFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  historyDate: { fontSize: 11, color: Colors.textLight },
  historyAmount: { fontSize: 13, fontWeight: '600', color: Colors.primaryDark },
});

