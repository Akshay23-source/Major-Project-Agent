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
import { getSettlementById, markSettlementAsPaid } from '../../../../src/services/finance';
import { Colors } from '../../../../src/theme/colors';

export default function SettlementDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [settlement, setSettlement] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const [method, setMethod] = useState("Bank Transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const sData = await getSettlementById(id as string);
      setSettlement(sData);
      if (sData) {
        if (sData.payment_method) setMethod(sData.payment_method);
        if (sData.transaction_reference) setReference(sData.transaction_reference);
        if (sData.notes) setNotes(sData.notes);
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

  const handlePay = async () => {
    if (method !== 'Cash' && !reference) {
      Alert.alert("Validation Error", "Please provide a transaction reference for this payment method.");
      return;
    }
    setUpdating(true);
    try {
      const result = await markSettlementAsPaid(id as string, method, reference, notes || undefined);
      if (result) {
        Alert.alert("Success", "Settlement marked as Paid.");
        loadData();
      } else {
        Alert.alert("Error", "Failed to update settlement status.");
      }
    } catch (e) {
      Alert.alert("Error", "An unexpected error occurred.");
    } finally {
      setUpdating(false);
    }
  };

  if (loading && !settlement) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (!settlement) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
        <Text style={styles.errorText}>Settlement not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isPaid = settlement.status === 'Paid';
  const statusColor = isPaid ? Colors.success : settlement.status === 'Cancelled' ? Colors.error : Colors.warning;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settlement Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* Status Header */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeaderRow}>
            <Text style={styles.settlementAmount}>₹{settlement.net_amount}</Text>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{settlement.status}</Text>
            </View>
          </View>
          <Text style={styles.settlementId}>ID: {settlement.id}</Text>
          <Text style={styles.settlementDate}>Created: {new Date(settlement.created_at).toLocaleString()}</Text>
          {settlement.paid_at && (
            <Text style={styles.settlementDate}>Paid: {new Date(settlement.paid_at).toLocaleString()}</Text>
          )}
        </View>

        {/* Farmer Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Farmer Details</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Farmer</Text>
            <Text style={styles.infoValue}>{settlement.farmers?.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{settlement.farmers?.phone}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Location</Text>
            <Text style={styles.infoValue}>{settlement.farmers?.village || 'Unknown'}</Text>
          </View>
          
          <TouchableOpacity style={styles.linkBtn} onPress={() => router.push(`/farmers/${settlement.farmer_id}`)}>
            <Text style={styles.linkBtnText}>View Farmer Profile</Text>
            <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Calculation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Calculation Breakdown</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Order ID</Text>
            <Text style={styles.infoValue}>{settlement.orders?.order_number}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Gross Order Value</Text>
            <Text style={styles.infoValue}>₹{settlement.gross_amount}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Agent Commission (-)</Text>
            <Text style={[styles.infoValue, { color: Colors.error }]}>₹{settlement.commission_deducted}</Text>
          </View>
          {settlement.other_deductions > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Other Deductions (-)</Text>
              <Text style={[styles.infoValue, { color: Colors.error }]}>₹{settlement.other_deductions}</Text>
            </View>
          )}
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabelTotal}>Net Farmer Settlement</Text>
            <Text style={styles.infoValueTotal}>₹{settlement.net_amount}</Text>
          </View>

          <TouchableOpacity style={styles.linkBtnSecondary} onPress={() => router.push(`/orders/${settlement.order_id}`)}>
            <Text style={styles.linkBtnSecondaryText}>View Order Details</Text>
          </TouchableOpacity>
        </View>

        {/* Action Area */}
        {settlement.status === 'Pending' ? (
          <View style={styles.actionCard}>
            <Text style={styles.sectionTitle}>Mark as Paid</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Payment Method</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalSelect}>
                {['Bank Transfer', 'UPI', 'Cash', 'Other'].map(m => (
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
              <TextInput style={styles.input} value={notes} onChangeText={setNotes} placeholder="Any payment notes..." />
            </View>

            {updating ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 12 }} />
            ) : (
              <TouchableOpacity style={styles.primaryActionBtn} onPress={handlePay}>
                <Text style={styles.primaryActionText}>Confirm Payment to Farmer</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Transaction Details</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Payment Method</Text>
              <Text style={styles.infoValue}>{settlement.payment_method || 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Reference</Text>
              <Text style={styles.infoValue}>{settlement.transaction_reference || 'N/A'}</Text>
            </View>
            {settlement.notes && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Notes</Text>
                <Text style={styles.infoValue}>{settlement.notes}</Text>
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
  settlementAmount: { fontSize: 32, fontWeight: 'bold', color: Colors.primaryDark },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  statusText: { fontSize: 14, fontWeight: 'bold' },
  settlementId: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  settlementDate: { fontSize: 12, color: Colors.textSecondary },

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
  linkBtnSecondary: { alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingVertical: 12, borderWidth: 1, borderColor: Colors.border, borderRadius: 8 },
  linkBtnSecondaryText: { color: Colors.text, fontWeight: '600' },

  actionCard: { backgroundColor: Colors.surface, padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: Colors.primary },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, color: Colors.textSecondary, marginBottom: 8, fontWeight: "500" },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: Colors.text, backgroundColor: Colors.background },
  
  horizontalSelect: { flexDirection: 'row' },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background, marginRight: 8, height: 36, justifyContent: 'center' },
  chipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontWeight: "500" },
  chipTextSelected: { color: Colors.surface, fontWeight: "600" },

  primaryActionBtn: { backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  primaryActionText: { color: Colors.surface, fontWeight: 'bold', fontSize: 16 },
});
