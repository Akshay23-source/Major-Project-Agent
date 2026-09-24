import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput
} from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { getOrdersWithoutDelivery } from '../../../src/services/orders';
import { createDelivery } from '../../../src/services/deliveries';
import { Colors } from '../../../src/theme/colors';

export default function AddDeliveryScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [eta, setEta] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [])
  );

  const loadOrders = async () => {
    setLoading(true);
    try {
      // Orders (not cancelled) that don't have a delivery yet
      setOrders(await getOrdersWithoutDelivery());
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  const selectedOrder = useMemo(() => {
    return orders.find(o => o.id === selectedOrderId);
  }, [orders, selectedOrderId]);

  const handleCreate = async () => {
    if (!selectedOrderId) {
      Alert.alert("Validation Error", "Please select an order to deliver.");
      return;
    }
    
    setSaving(true);
    try {
      const result = await createDelivery({
        order_id: selectedOrderId,
        employee_id: null,
        status: 'Pending',
        notes: notes || undefined,
        eta: eta || undefined
      });
      
      if (result) {
        Alert.alert("Success", "Delivery created successfully.", [
          { text: "OK", onPress: () => router.push(`/deliveries/${result.id}`) }
        ]);
      } else {
        Alert.alert("Error", "Failed to create delivery.");
      }
    } catch (e) {
      Alert.alert("Error", "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Delivery</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Order</Text>
              {orders.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>No pending orders require delivery.</Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.orderScroll}>
                  {orders.map(order => (
                    <TouchableOpacity
                      key={order.id}
                      style={[styles.orderCard, selectedOrderId === order.id && styles.orderCardSelected]}
                      onPress={() => setSelectedOrderId(order.id)}
                    >
                      <Text style={[styles.orderNumber, selectedOrderId === order.id && styles.textSurface]}>
                        {order.order_number || order.id.substring(0,8)}
                      </Text>
                      <Text style={[styles.orderProduct, selectedOrderId === order.id && styles.textSurface]}>
                        {order.product} ({order.quantity} {order.unit})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {selectedOrder && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Delivery Details Derived</Text>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>From (Farmer)</Text>
                  <Text style={styles.infoValue}>{selectedOrder.farmers?.name}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Pickup Location</Text>
                  <Text style={styles.infoValue}>{selectedOrder.farmers?.village || 'Unknown'}</Text>
                </View>
                
                <View style={styles.divider} />
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>To (Buyer)</Text>
                  <Text style={styles.infoValue}>{selectedOrder.buyers?.name}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Delivery Location</Text>
                  <Text style={styles.infoValue}>{selectedOrder.buyers?.location || 'Unknown'}</Text>
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Additional Information (Optional)</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Estimated Time of Arrival (ETA)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Today 5 PM, Tomorrow Morning"
                  value={eta}
                  onChangeText={setEta}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Delivery Notes</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Special instructions for the delivery executive..."
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.saveBtn, (!selectedOrderId || saving) && styles.saveBtnDisabled]} 
              onPress={handleCreate}
              disabled={!selectedOrderId || saving}
            >
              {saving ? (
                <ActivityIndicator color={Colors.surface} />
              ) : (
                <Text style={styles.saveBtnText}>Create Delivery</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surface, padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  
  content: { padding: 16, paddingBottom: 40 },
  
  section: { backgroundColor: Colors.surface, padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.text, marginBottom: 16 },
  
  emptyBox: { padding: 16, alignItems: 'center', backgroundColor: Colors.background, borderRadius: 8 },
  emptyText: { color: Colors.textSecondary },
  
  orderScroll: { marginBottom: 4 },
  orderCard: { padding: 12, borderRadius: 8, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, marginRight: 12, minWidth: 150 },
  orderCardSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  orderNumber: { fontSize: 14, fontWeight: 'bold', color: Colors.text, marginBottom: 4 },
  orderProduct: { fontSize: 12, color: Colors.textSecondary },
  textSurface: { color: Colors.surface },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  infoLabel: { fontSize: 14, color: Colors.textSecondary, flex: 1 },
  infoValue: { fontSize: 14, color: Colors.text, fontWeight: '500', flex: 1, textAlign: 'right' },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },

  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, color: Colors.textSecondary, marginBottom: 8, fontWeight: '500' },
  input: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: Colors.text },
  textArea: { minHeight: 100 },

  saveBtn: { backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: Colors.surface, fontWeight: 'bold', fontSize: 16 }
});
