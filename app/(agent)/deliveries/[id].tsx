import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert
} from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Colors } from '../../../src/theme/colors';
import { StatusBadge } from '../../../src/components/ui/StatusBadge';
import { dispatchOrder, getDeliveryPartners, getDispatchView, setOrderLogisticsStatus } from '../../../src/services/logistics';
import { errorMessage } from '../../../src/lib/api';

export default function DispatchScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [order, setOrder] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Order (with farmer/buyer), its latest delivery and that delivery's timeline
      const { order: orderData, events: eventData } = await getDispatchView(id as string);
      setOrder(orderData);
      setEvents(eventData || []);

      // 3. Fetch partners for assignment if status is PENDING
      if (orderData.logistics_status === 'PENDING') {
        const p = await getDeliveryPartners();
        setPartners(p.filter(x => x.status === 'AVAILABLE' || x.status === 'ONLINE'));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleUpdateStatus = async (newStatus: string) => {
    setUpdating(true);
    try {
      // Server updates the order + delivery, records the timeline event and
      // notifies the Farm Marketplace for marketplace orders.
      await setOrderLogisticsStatus(id as string, newStatus);

      Alert.alert("Success", `Status updated to ${newStatus}.`);
      loadData();
    } catch (e) {
      Alert.alert("Error", errorMessage(e, "Failed to update status."));
    } finally {
      setUpdating(false);
    }
  };

  const handleAssignPartner = async () => {
    if (!selectedPartnerId) {
      Alert.alert("Validation Error", "Please select a partner.");
      return;
    }
    setUpdating(true);
    try {
      // One call: creates the delivery, assigns the driver, records the timeline
      // and notifies the Farm Marketplace for marketplace orders.
      await dispatchOrder(id as string, {
        delivery_partner_id: selectedPartnerId,
        pickup_location: order.pickup_address || order.farmers?.village || 'Farm',
        drop_location: order.delivery_location || order.buyers?.city || 'City',
      });

      Alert.alert("Success", "Driver assigned successfully.");
      loadData();
    } catch (e) {
      console.error(e);
      Alert.alert("Error", errorMessage(e, "Failed to assign partner."));
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
        <Text style={styles.errorText}>Order not found</Text>
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
          <Ionicons name="arrow-back" size={24} color={Colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dispatch Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* Status Header */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeaderRow}>
            <Text style={styles.deliveryNumber}>Order {order.external_order_id || order.id.substring(0,8)}</Text>
            <StatusBadge status={order.logistics_status} />
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionCard}>
          <Text style={styles.sectionTitle}>Dispatch Actions</Text>
          {updating ? (
            <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 12 }} />
          ) : (
            <View style={styles.actionButtons}>
              {order.logistics_status === 'PENDING' && (
                <View style={styles.assignContainer}>
                  <Text style={styles.assignLabel}>Assign Delivery Partner:</Text>
                  {partners.length === 0 ? (
                    <View style={styles.noEmpsBox}>
                      <Text style={styles.noEmpsText}>No active partners available.</Text>
                      <TouchableOpacity onPress={() => router.push('/delivery-partners')} style={styles.addEmpBtn}>
                        <Text style={styles.addEmpBtnText}>Manage Partners</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                        {partners.map(p => (
                          <TouchableOpacity
                            key={p.id}
                            style={[styles.empChip, selectedPartnerId === p.id && styles.empChipSelected]}
                            onPress={() => setSelectedPartnerId(p.id)}
                          >
                            <Text style={[styles.empChipText, selectedPartnerId === p.id && styles.empChipTextSelected]}>
                              {p.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      <TouchableOpacity style={styles.primaryActionBtn} onPress={handleAssignPartner}>
                        <Text style={styles.primaryActionText}>Assign Partner</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
              {order.logistics_status === 'PICKUP_ASSIGNED' && (
                <TouchableOpacity style={styles.primaryActionBtn} onPress={() => handleUpdateStatus('IN_TRANSIT')}>
                  <Text style={styles.primaryActionText}>Driver Picked Up - Start Transit</Text>
                </TouchableOpacity>
              )}
              {order.logistics_status === 'IN_TRANSIT' && (
                <TouchableOpacity style={styles.primaryActionBtn} onPress={() => handleUpdateStatus('DELIVERED')}>
                  <Text style={styles.primaryActionText}>Mark Delivered</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Event Timeline</Text>
          {events.length === 0 ? (
            <Text style={{color: Colors.textSecondary, fontStyle: 'italic'}}>No logistics events yet.</Text>
          ) : (
            <View style={styles.timeline}>
              {events.map((evt, idx) => (
                <TimelineStep 
                  key={evt.id} 
                  label={evt.event_type} 
                  desc={evt.description} 
                  time={new Date(evt.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  isLast={idx === events.length - 1} 
                />
              ))}
            </View>
          )}
        </View>

        {/* Product & Locations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Product</Text>
            <Text style={styles.infoValue}>{order.product} ({order.quantity} {order.unit})</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Priority</Text>
            <Text style={styles.infoValue}>{order.priority}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.locationBlock}>
            <View style={styles.locIconWrap}>
              <Ionicons name="location" size={16} color={Colors.primary} />
            </View>
            <View style={styles.locInfo}>
              <Text style={styles.locLabel}>Pickup from Farmer</Text>
              <Text style={styles.locName}>{order.farmers?.name || order.pickup_contact_name}</Text>
              <Text style={styles.locAddress}>
                {order.farmers ? `${order.farmers.village}, ${order.farmers.district}` : order.pickup_address}
              </Text>
            </View>
          </View>
          <View style={styles.locLine} />
          <View style={styles.locationBlock}>
            <View style={[styles.locIconWrap, { backgroundColor: Colors.info }]}>
              <Ionicons name="flag" size={16} color={Colors.surface} />
            </View>
            <View style={styles.locInfo}>
              <Text style={styles.locLabel}>Deliver to Buyer</Text>
              <Text style={styles.locName}>{order.buyers?.name || order.drop_contact_name}</Text>
              <Text style={styles.locAddress}>
                {order.buyers ? `${order.buyers.city}, ${order.buyers.state}` : order.delivery_location}
              </Text>
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function TimelineStep({ label, desc, time, isLast = false }: { label: string, desc: string, time: string, isLast?: boolean }) {
  return (
    <View style={styles.timelineStep}>
      <View style={styles.timelineLeft}>
        <View style={styles.timelineDot} />
        {!isLast && <View style={styles.timelineLine} />}
      </View>
      <View style={styles.timelineContent}>
        <View style={{flexDirection: 'row', justifyContent: 'space-between', width: '100%'}}>
           <Text style={styles.timelineLabelActive}>{label}</Text>
           <Text style={{fontSize: 12, color: Colors.textSecondary}}>{time}</Text>
        </View>
        <Text style={{fontSize: 13, color: Colors.textSecondary, marginTop: 2}}>{desc}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surface, padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  errorText: { fontSize: 18, color: Colors.text, marginTop: 16 },
  backBtn: { marginTop: 24, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.primary, borderRadius: 8 },
  backBtnText: { color: Colors.surface, fontWeight: 'bold' },
  
  content: { padding: 16, paddingBottom: 40 },
  
  statusCard: { backgroundColor: Colors.surface, padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  statusHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deliveryNumber: { fontSize: 18, fontWeight: 'bold', color: Colors.primaryDark },

  actionCard: { backgroundColor: Colors.surface, padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  actionButtons: { gap: 12 },
  primaryActionBtn: { backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  primaryActionText: { color: Colors.surface, fontWeight: 'bold', fontSize: 16 },
  
  assignContainer: { width: '100%' },
  assignLabel: { fontSize: 14, color: Colors.textSecondary, marginBottom: 8 },
  noEmpsBox: { padding: 16, backgroundColor: Colors.background, borderRadius: 8, alignItems: 'center' },
  noEmpsText: { color: Colors.textSecondary, marginBottom: 12 },
  addEmpBtn: { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  addEmpBtnText: { color: Colors.surface, fontWeight: 'bold' },
  empChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, marginRight: 8 },
  empChipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  empChipText: { color: Colors.textSecondary },
  empChipTextSelected: { color: Colors.surface, fontWeight: 'bold' },

  section: { backgroundColor: Colors.surface, padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.text, marginBottom: 16 },
  
  timeline: { paddingLeft: 4 },
  timelineStep: { flexDirection: 'row', minHeight: 60 },
  timelineLeft: { width: 24, alignItems: 'center' },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primary, zIndex: 2, marginTop: 4 },
  timelineLine: { width: 2, flex: 1, backgroundColor: Colors.border, marginTop: -4, marginBottom: -4, zIndex: 1 },
  timelineContent: { flex: 1, marginLeft: 12, paddingBottom: 16 },
  timelineLabelActive: { color: Colors.text, fontWeight: 'bold', fontSize: 15 },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  infoLabel: { fontSize: 14, color: Colors.textSecondary },
  infoValue: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },

  locationBlock: { flexDirection: 'row', alignItems: 'flex-start' },
  locIconWrap: { width: 24, height: 24, borderRadius: 12, backgroundColor: `${Colors.primary}20`, justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2 },
  locInfo: { flex: 1 },
  locLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 2 },
  locName: { fontSize: 16, fontWeight: 'bold', color: Colors.text, marginBottom: 2 },
  locAddress: { fontSize: 14, color: Colors.textSecondary },
  locLine: { width: 2, height: 24, backgroundColor: Colors.border, marginLeft: 11, marginVertical: 4 },
});
