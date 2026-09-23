import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback } from 'react';
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
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { getPaymentById, updatePaymentStatus } from '../../../src/services/finance';
import { Colors } from '../../../src/theme/colors';

export default function PaymentDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [payment, setPayment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const [method, setMethod] = useState("Cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const pData = await getPaymentById(id as string);
      setPayment(pData);
      if (pData) {
        setMethod(pData.payment_method || "Cash");
        setReference(pData.transaction_reference || "");
        if (pData.notes) setNotes(pData.notes);
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

  const handleUpdateStatus = async (newStatus: "Completed" | "Failed") => {
    setUpdating(true);
    try {
      const result = await updatePaymentStatus(id as string, newStatus, method, reference, notes || undefined);
      if (result) {
        Alert.alert("Success", `Payment marked as ${newStatus}.`);
        loadData();
      } else {
        Alert.alert("Error", "Failed to update payment status.");
      }
    } catch (e) {
      Alert.alert("Error", "An unexpected error occurred.");
    } finally {
      setUpdating(false);
    }
  };

  if (loading && !payment) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (!payment) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
        <Text style={styles.errorText}>Payment not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isCompleted = payment.status === 'Completed';
  const isFailed = payment.status === 'Failed' || payment.status === 'Cancelled';
  const statusColor = isCompleted ? Colors.success : isFailed ? Colors.error : Colors.warning;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* Status Header */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeaderRow}>
            <Text style={styles.paymentAmount}>₹{payment.amount}</Text>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{payment.status}</Text>
            </View>
          </View>
          <Text style={styles.paymentId}>ID: {payment.id}</Text>
          <Text style={styles.paymentDate}>Created: {new Date(payment.created_at).toLocaleString()}</Text>
          {payment.paid_at && (
            <Text style={styles.paymentDate}>Paid: {new Date(payment.paid_at).toLocaleString()}</Text>
          )}
        </View>

        {/* Order Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Order ID</Text>
            <Text style={styles.infoValue}>{payment.orders?.order_number || 'Unknown'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Product</Text>
            <Text style={styles.infoValue}>{payment.orders?.product} ({payment.orders?.quantity})</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Buyer</Text>
            <Text style={styles.infoValue}>{payment.orders?.buyers?.name} ({payment.orders?.buyers?.phone})</Text>
          </View>
          
          <TouchableOpacity style={styles.linkBtn} onPress={() => router.push(`/orders/${payment.order_id}`)}>
            <Text style={styles.linkBtnText}>View Full Order</Text>
            <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Financial Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Financial Breakdown</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Subtotal</Text>
            <Text style={styles.infoValue}>₹{payment.orders?.subtotal}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Delivery Charge</Text>
            <Text style={styles.infoValue}>₹{payment.orders?.delivery_charge}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Commission</Text>
            <Text style={styles.infoValue}>₹{payment.orders?.commission}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabelTotal}>Total Amount Due</Text>
            <Text style={styles.infoValueTotal}>₹{payment.orders?.total_amount}</Text>
          </View>
        </View>

        {/* Action Area */}
        {payment.status === 'Pending' || payment.status === 'Processing' ? (
          <View style={styles.actionCard}>
            <Text style={styles.sectionTitle}>Process Payment</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Payment Method</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalSelect}>
                {['Cash', 'UPI', 'Bank Transfer', 'Card'].map(m => (
                  <TouchableOpacity 
                    key={m} 
                    style={[styles.chip, method === m && styles.chipSelected]}
                    onPress={() => setMethod(m)}
                  >
                    <Text style={[styles.chipText, method === m && styles.chipTextSelected]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {method !== 'Cash' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Transaction Reference / UTR</Text>
                <TextInput style={styles.input} value={reference} onChangeText={setReference} placeholder="Enter Ref ID" />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notes</Text>
              <TextInput style={styles.input} value={notes} onChangeText={setNotes} placeholder="Payment notes..." />
            </View>

            {updating ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 12 }} />
            ) : (
              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.primaryActionBtn} onPress={() => handleUpdateStatus('Completed')}>
                  <Text style={styles.primaryActionText}>Mark as Completed</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dangerActionBtn} onPress={() => handleUpdateStatus('Failed')}>
                  <Text style={styles.dangerActionText}>Mark as Failed</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Transaction Details</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Payment Method</Text>
              <Text style={styles.infoValue}>{payment.payment_method || 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Reference</Text>
              <Text style={styles.infoValue}>{payment.transaction_reference || 'N/A'}</Text>
            </View>
            {payment.notes && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Notes</Text>
                <Text style={styles.infoValue}>{payment.notes}</Text>
              </View>
            )}
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
  
  statusCard: { backgroundColor: Colors.surface, padding: 24, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  statusHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, width: '100%' },
  paymentAmount: { fontSize: 32, fontWeight: 'bold', color: Colors.primaryDark },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  statusText: { fontSize: 14, fontWeight: 'bold' },
  paymentId: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  paymentDate: { fontSize: 12, color: Colors.textSecondary },

  section: { backgroundColor: Colors.surface, padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.text, marginBottom: 16 },
  
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  infoLabel: { fontSize: 14, color: Colors.textSecondary },
  infoValue: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  infoLabelTotal: { fontSize: 16, color: Colors.text, fontWeight: 'bold' },
  infoValueTotal: { fontSize: 18, color: Colors.primaryDark, fontWeight: 'bold' },

  linkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingVertical: 12, backgroundColor: `${Colors.primary}15`, borderRadius: 8 },
  linkBtnText: { color: Colors.primary, fontWeight: 'bold', marginRight: 8 },

  actionCard: { backgroundColor: Colors.surface, padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: Colors.primary },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, color: Colors.textSecondary, marginBottom: 8, fontWeight: "500" },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: Colors.text, backgroundColor: Colors.background },
  
  horizontalSelect: { flexDirection: 'row' },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background, marginRight: 8, height: 36, justifyContent: 'center' },
  chipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontWeight: "500" },
  chipTextSelected: { color: Colors.surface, fontWeight: "600" },

  actionButtons: { gap: 12, marginTop: 8 },
  primaryActionBtn: { backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  primaryActionText: { color: Colors.surface, fontWeight: 'bold', fontSize: 16 },
  dangerActionBtn: { backgroundColor: Colors.background, paddingVertical: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: Colors.error },
  dangerActionText: { color: Colors.error, fontWeight: 'bold', fontSize: 16 },
});
