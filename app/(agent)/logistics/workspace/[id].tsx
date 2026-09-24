import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../../src/theme/colors';
import { getOrderById } from '../../../../src/services/orders';
import { getAvailablePartners, getAvailableVehicles, dispatchOrder, Vehicle, DeliveryPartner } from '../../../../src/services/logistics';
import { AppHeader } from '../../../../src/components/ui/AppHeader';
import { StatusBadge } from '../../../../src/components/ui/StatusBadge';
import { errorMessage } from '../../../../src/lib/api';

export default function LogisticsWorkspaceScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const [order, setOrder] = useState<any>(null);
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const orderData = await getOrderById(id as string);
      setOrder(orderData);
      
      const p = await getAvailablePartners();
      setPartners(p);
      
      const v = await getAvailableVehicles();
      setVehicles(v);
    } catch (error) {
      console.error("Failed to load workspace data:", error);
      Alert.alert("Error", "Could not load logistics data.");
    } finally {
      setLoading(false);
    }
  };

  const handleDispatch = async () => {
    if (!selectedPartner) {
      Alert.alert("Assignment Required", "Please select a delivery partner.");
      return;
    }
    if (!selectedVehicle) {
      Alert.alert("Assignment Required", "Please select a vehicle.");
      return;
    }

    setSubmitting(true);
    try {
      // One server call: creates the delivery, assigns driver + vehicle, records the
      // pickup and timeline, and notifies the Farm Marketplace for marketplace orders.
      await dispatchOrder(order.id, {
        delivery_partner_id: selectedPartner,
        vehicle_id: selectedVehicle,
        pickup_location: order.pickup_address || order.farmers?.location || order.farmers?.village || 'Unknown',
        drop_location: order.delivery_location || 'Unknown',
      });

      Alert.alert("Success", "Dispatch complete! Driver and vehicle assigned.");
      router.back();
    } catch (error: any) {
      Alert.alert("Dispatch Error", errorMessage(error, "Failed to dispatch."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !order) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title="Logistics Workspace" />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* ORDER INFORMATION */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cube-outline" size={20} color={Colors.primaryDark} />
            <Text style={styles.sectionTitle}>Order Information</Text>
            <StatusBadge status={order.logistics_status || 'PENDING'} />
          </View>
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Order ID</Text>
              <Text style={styles.detailValue}>{order.order_number}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Product</Text>
              <Text style={styles.detailValue}>{order.product} ({order.quantity} {order.unit})</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Payment</Text>
              {order.source === 'MARKETPLACE' ? (
                <Text style={styles.detailValue}>Handled by marketplace</Text>
              ) : (
                <Text style={[styles.detailValue, { color: order.payment_status === 'PAID' ? Colors.success : Colors.error }]}>
                  {order.payment_status}
                </Text>
              )}
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Priority</Text>
              <Text style={[styles.detailValue, { color: order.priority === 'HIGH' ? Colors.error : Colors.text }]}>
                {order.priority || 'NORMAL'}
              </Text>
            </View>
          </View>
        </View>

        {/* FARMER PICKUP */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="leaf-outline" size={20} color={Colors.primaryDark} />
            <Text style={styles.sectionTitle}>Farmer Pickup</Text>
          </View>
          <Text style={styles.primaryText}>{order.farmers?.name || order.pickup_contact_name}</Text>
          <Text style={styles.secondaryText}>{order.farmers?.phone || order.pickup_contact_phone}</Text>
          <Text style={styles.secondaryText}>{order.pickup_address || order.farmers?.location}</Text>
        </View>

        {/* CUSTOMER DELIVERY */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location-outline" size={20} color={Colors.primaryDark} />
            <Text style={styles.sectionTitle}>Customer Delivery</Text>
          </View>
          <Text style={styles.primaryText}>{order.buyers?.name || order.drop_contact_name}</Text>
          <Text style={styles.secondaryText}>{order.buyers?.phone || order.drop_contact_phone}</Text>
          <Text style={styles.secondaryText}>{order.delivery_location}</Text>
        </View>

        {/* LOGISTICS ASSIGNMENT */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="swap-horizontal-outline" size={20} color={Colors.primaryDark} />
            <Text style={styles.sectionTitle}>Logistics Assignment</Text>
          </View>

          <Text style={styles.inputLabel}>Delivery Partner</Text>
          {partners.length === 0 ? (
            <Text style={styles.errorText}>No available drivers online.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalSelect}>
              {partners.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.selectCard, selectedPartner === p.id && styles.selectCardActive]}
                  onPress={() => setSelectedPartner(p.id)}
                >
                  <Text style={[styles.selectTitle, selectedPartner === p.id && styles.selectTextActive]}>{p.name}</Text>
                  <Text style={[styles.selectSub, selectedPartner === p.id && styles.selectTextActive]}>⭐ {p.rating} | 🚚 {p.completed_deliveries}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <Text style={[styles.inputLabel, { marginTop: 16 }]}>Vehicle</Text>
          {vehicles.length === 0 ? (
            <Text style={styles.errorText}>No available vehicles.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalSelect}>
              {vehicles.map(v => {
                const isCapacitySufficient = !v.capacity || v.capacity >= order.quantity;
                return (
                  <TouchableOpacity
                    key={v.id}
                    style={[
                      styles.selectCard, 
                      selectedVehicle === v.id && styles.selectCardActive,
                      !isCapacitySufficient && { opacity: 0.5 }
                    ]}
                    onPress={() => isCapacitySufficient && setSelectedVehicle(v.id)}
                    disabled={!isCapacitySufficient}
                  >
                    <Text style={[styles.selectTitle, selectedVehicle === v.id && styles.selectTextActive]}>{v.vehicle_number}</Text>
                    <Text style={[styles.selectSub, selectedVehicle === v.id && styles.selectTextActive]}>{v.vehicle_type}</Text>
                    {v.capacity && (
                      <Text style={[styles.selectSub, { color: isCapacitySufficient ? Colors.textSecondary : Colors.error }]}>
                        Cap: {v.capacity} {v.capacity_unit}
                      </Text>
                    )}
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          )}

        </View>
        
        <TouchableOpacity 
          style={[styles.dispatchBtn, submitting && { opacity: 0.7 }]} 
          onPress={handleDispatch}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.surface} />
          ) : (
            <Text style={styles.dispatchBtnText}>Confirm Dispatch</Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  section: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.primaryDark, marginLeft: 8, flex: 1 },
  
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  detailItem: { width: '50%', marginBottom: 12 },
  detailLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 2 },
  detailValue: { fontSize: 14, fontWeight: '600', color: Colors.text },

  primaryText: { fontSize: 16, fontWeight: 'bold', color: Colors.text, marginBottom: 4 },
  secondaryText: { fontSize: 14, color: Colors.textSecondary, marginBottom: 2 },

  inputLabel: { fontSize: 14, fontWeight: 'bold', color: Colors.text, marginBottom: 8 },
  errorText: { color: Colors.error, fontSize: 14, fontStyle: 'italic' },
  
  horizontalSelect: { flexDirection: 'row' },
  selectCard: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 12, marginRight: 12, minWidth: 140 },
  selectCardActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  selectTitle: { fontSize: 15, fontWeight: 'bold', color: Colors.text, marginBottom: 4 },
  selectSub: { fontSize: 12, color: Colors.textSecondary },
  selectTextActive: { color: Colors.surface },

  dispatchBtn: { backgroundColor: Colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  dispatchBtnText: { color: Colors.surface, fontSize: 16, fontWeight: 'bold' }
});
