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
import { getOrderById, updateOrderStatus, Order } from '../../../src/services/orders';
import { getDeliveryByOrderId, createDelivery } from '../../../src/services/deliveries';
import { getPaymentByOrderId, getSettlementByOrderId } from '../../../src/services/finance';
import { Colors } from '../../../src/theme/colors';
import { StatusBadge } from '../../../src/components/ui/StatusBadge';

export default function OrderDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [order, setOrder] = useState<any>(null);
  const [delivery, setDelivery] = useState<any>(null);
  const [payment, setPayment] = useState<any>(null);
  const [settlement, setSettlement] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getOrderById(id as string);
      setOrder(data);
      if (data) {
        const [delData, payData, settleData] = await Promise.all([
          getDeliveryByOrderId(data.id),
          getPaymentByOrderId(data.id),
          getSettlementByOrderId(data.id)
        ]);
        setDelivery(delData);
        setPayment(payData);
        setSettlement(settleData);
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

  const handleUpdateStatus = async (newStatus: Order['status']) => {
    setUpdating(true);
    try {
      const result = await updateOrderStatus(id as string, newStatus);
      if (result) {
        Alert.alert("Success", `Order marked as ${newStatus}.`);
        loadData();
      } else {
        Alert.alert("Error", "Failed to update order status.");
      }
    } catch (e) {
      Alert.alert("Error", "An unexpected error occurred.");
    } finally {
      setUpdating(false);
    }
  };

  const handleCreateDelivery = async () => {
    setUpdating(true);
    try {
      const result = await createDelivery({
        order_id: order.id,
        employee_id: null,
        status: 'Pending'
      });
      if (result) {
        Alert.alert("Success", "Delivery created successfully.");
        loadData();
      } else {
        Alert.alert("Error", "Failed to create delivery.");
      }
    } catch (e) {
      Alert.alert("Error", "An unexpected error occurred.");
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
        <Text style={styles.headerTitle}>Order Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* Status Header */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeaderRow}>
            <Text style={styles.orderNumber}>{order.order_number || order.id.substring(0,8)}</Text>
            <StatusBadge status={order.status} />
          </View>
          <Text style={styles.orderDate}>{new Date(order.created_at).toLocaleString()}</Text>
        </View>

        {/* Actions */}
        <View style={styles.actionCard}>
          <Text style={styles.sectionTitle}>Actions</Text>
          {updating ? (
            <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 12 }} />
          ) : (
            <View style={styles.actionButtons}>
              {order.status === 'Pending' && (
                <>
                  <TouchableOpacity style={styles.primaryActionBtn} onPress={() => handleUpdateStatus('Processing')}>
                    <Text style={styles.primaryActionText}>Process Order</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.dangerActionBtn} onPress={() => handleUpdateStatus('Cancelled')}>
                    <Text style={styles.dangerActionText}>Cancel Order</Text>
                  </TouchableOpacity>
                </>
              )}
              {order.status === 'Processing' && (
                <TouchableOpacity style={styles.primaryActionBtn} onPress={() => handleUpdateStatus('Shipped')}>
                  <Text style={styles.primaryActionText}>Mark as Shipped</Text>
                </TouchableOpacity>
              )}
              {order.status === 'Shipped' && (
                <TouchableOpacity style={styles.primaryActionBtn} onPress={() => handleUpdateStatus('Delivered')}>
                  <Text style={styles.primaryActionText}>Mark as Delivered</Text>
                </TouchableOpacity>
              )}
              {order.status === 'Delivered' && (
                <TouchableOpacity style={styles.secondaryActionBtn} onPress={() => router.push('/payments')}>
                  <Text style={styles.secondaryActionText}>View Payment Details</Text>
                </TouchableOpacity>
              )}
              {order.status === 'Cancelled' && (
                <Text style={styles.cancelledNote}>This order was cancelled.</Text>
              )}
            </View>
          )}
        </View>

        {/* Delivery Integration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Logistics</Text>
          {delivery ? (
            <View>
              <Text style={styles.deliveryStatusText}>Delivery is currently: <Text style={{fontWeight: 'bold', color: Colors.primaryDark}}>{delivery.status}</Text></Text>
              <TouchableOpacity style={styles.deliveryBtn} onPress={() => router.push(`/deliveries/${delivery.id}`)}>
                <Ionicons name="bicycle-outline" size={20} color={Colors.surface} style={{marginRight: 8}} />
                <Text style={styles.deliveryBtnText}>View Delivery Details</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={styles.deliveryStatusText}>No delivery arranged for this order.</Text>
              {order.status !== 'Cancelled' && (
                <TouchableOpacity style={[styles.deliveryBtn, { backgroundColor: Colors.info }]} onPress={handleCreateDelivery}>
                  <Ionicons name="add-circle-outline" size={20} color={Colors.surface} style={{marginRight: 8}} />
                  <Text style={styles.deliveryBtnText}>Create Delivery</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Parties */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Parties Involved</Text>
          
          <TouchableOpacity style={styles.partyRow} onPress={() => router.push(`/farmers/${order.farmer_id}`)}>
            <View style={styles.partyIconWrap}>
              <Ionicons name="person" size={20} color={Colors.primary} />
            </View>
            <View style={styles.partyInfo}>
              <Text style={styles.partyLabel}>Farmer</Text>
              <Text style={styles.partyName}>{order.farmers?.name || 'Unknown'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textLight} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.partyRow} onPress={() => router.push(`/buyers/${order.buyer_id}`)}>
            <View style={styles.partyIconWrap}>
              <Ionicons name="storefront" size={20} color={Colors.info} />
            </View>
            <View style={styles.partyInfo}>
              <Text style={styles.partyLabel}>Buyer</Text>
              <Text style={styles.partyName}>{order.buyers?.name || 'Unknown'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textLight} />
          </TouchableOpacity>
        </View>

        {/* Product & Financials */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          
          <View style={styles.productRow}>
            <Text style={styles.productName}>{order.product}</Text>
            <Text style={styles.productQty}>{order.quantity} {order.unit} @ ₹{order.price}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.financialRow}>
            <Text style={styles.finLabel}>Subtotal</Text>
            <Text style={styles.finValue}>₹{(order.subtotal || (order.quantity * order.price)).toFixed(2)}</Text>
          </View>
          <View style={styles.financialRow}>
            <Text style={styles.finLabel}>Commission</Text>
            <Text style={styles.finValue}>₹{(order.commission || 0).toFixed(2)}</Text>
          </View>
          <View style={styles.financialRow}>
            <Text style={styles.finLabel}>Delivery Charge</Text>
            <Text style={styles.finValue}>₹{(order.delivery_charge || 0).toFixed(2)}</Text>
          </View>

          <View style={[styles.financialRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>Total Amount</Text>
            <Text style={styles.grandTotalValue}>₹{order.total_amount}</Text>
          </View>
        </View>

        {/* Payments Section */}
        {payment && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Buyer Payment</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <View style={[styles.statusBadge, { backgroundColor: payment.status === 'Completed' ? `${Colors.success}20` : `${Colors.warning}20`, paddingHorizontal: 8, paddingVertical: 2 }]}>
                <Text style={{ color: payment.status === 'Completed' ? Colors.success : Colors.warning, fontSize: 12, fontWeight: 'bold' }}>{payment.status}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Amount Due</Text>
              <Text style={styles.infoValue}>₹{payment.amount}</Text>
            </View>
            <TouchableOpacity style={styles.secondaryActionBtn} onPress={() => router.push(`/payments/${payment.id}`)}>
              <Text style={styles.secondaryActionText}>View Payment Record</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Settlement Section */}
        {settlement && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Farmer Settlement</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <View style={[styles.statusBadge, { backgroundColor: settlement.status === 'Paid' ? `${Colors.success}20` : `${Colors.warning}20`, paddingHorizontal: 8, paddingVertical: 2 }]}>
                <Text style={{ color: settlement.status === 'Paid' ? Colors.success : Colors.warning, fontSize: 12, fontWeight: 'bold' }}>{settlement.status}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Net Payable</Text>
              <Text style={styles.infoValue}>₹{settlement.net_amount}</Text>
            </View>
            <TouchableOpacity style={styles.secondaryActionBtn} onPress={() => router.push(`/payments/settlements/${settlement.id}`)}>
              <Text style={styles.secondaryActionText}>View Settlement Record</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Notes */}
        {order.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{order.notes}</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
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
  statusHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderNumber: { fontSize: 18, fontWeight: 'bold', color: Colors.primaryDark },
  orderDate: { fontSize: 14, color: Colors.textSecondary },

  actionCard: { backgroundColor: Colors.surface, padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  actionButtons: { gap: 12 },
  primaryActionBtn: { backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  primaryActionText: { color: Colors.surface, fontWeight: 'bold', fontSize: 16 },
  dangerActionBtn: { backgroundColor: `${Colors.error}15`, paddingVertical: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: `${Colors.error}30` },
  dangerActionText: { color: Colors.error, fontWeight: 'bold', fontSize: 16 },
  secondaryActionBtn: { backgroundColor: Colors.background, paddingVertical: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  secondaryActionText: { color: Colors.text, fontWeight: 'bold', fontSize: 16 },
  cancelledNote: { color: Colors.error, fontStyle: 'italic', textAlign: 'center' },

  section: { backgroundColor: Colors.surface, padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.text, marginBottom: 16 },
  
  deliveryStatusText: { fontSize: 14, color: Colors.textSecondary, marginBottom: 12 },
  deliveryBtn: { flexDirection: 'row', backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  deliveryBtnText: { color: Colors.surface, fontWeight: 'bold', fontSize: 16 },

  partyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  partyIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  partyInfo: { flex: 1 },
  partyLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 2 },
  partyName: { fontSize: 16, fontWeight: 'bold', color: Colors.text },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 8 },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  infoLabel: { fontSize: 14, color: Colors.textSecondary },
  infoValue: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  statusBadge: { borderRadius: 12 },

  productRow: { marginBottom: 16 },
  productName: { fontSize: 18, fontWeight: 'bold', color: Colors.primaryDark, marginBottom: 4 },
  productQty: { fontSize: 14, color: Colors.textSecondary },

  financialRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  finLabel: { fontSize: 14, color: Colors.textSecondary },
  finValue: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  grandTotalRow: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12, marginTop: 4 },
  grandTotalLabel: { fontSize: 16, fontWeight: 'bold', color: Colors.text },
  grandTotalValue: { fontSize: 20, fontWeight: 'bold', color: Colors.primaryDark },

  notesText: { fontSize: 14, color: Colors.text, lineHeight: 20 }
});
