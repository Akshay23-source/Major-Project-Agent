import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../../src/components/ui/AppHeader';
import { Colors } from '../../../src/theme/colors';
import { createDeliveryPartner, DeliveryPartner, getDeliveryPartners } from '../../../src/services/logistics';
import { errorMessage } from '../../../src/lib/api';

const EMPTY_FORM = { name: '', phone: '', vehicle_number: '', vehicle_type: '' };

export default function DeliveryPartnersScreen() {
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadPartners();
    }, [])
  );

  const loadPartners = async () => {
    setLoading(true);
    try {
      setPartners(await getDeliveryPartners());
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!form.name.trim() || form.phone.replace(/\D/g, '').length < 10) {
      Alert.alert('Missing details', 'Enter the partner name and a 10-digit mobile number.');
      return;
    }
    setSaving(true);
    try {
      await createDeliveryPartner({
        name: form.name.trim(),
        phone: form.phone.trim(),
        vehicle_number: form.vehicle_number.trim() || undefined,
        vehicle_type: form.vehicle_type.trim() || undefined,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      Alert.alert(
        'Partner added',
        'The partner can now sign in as the Driver with driver@gmail.com / 789969.'
      );
      loadPartners();
    } catch (e) {
      Alert.alert('Could not add partner', errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof typeof EMPTY_FORM, placeholder: string, keyboardType: 'default' | 'phone-pad' = 'default') => (
    <TextInput
      style={styles.input}
      placeholder={placeholder}
      placeholderTextColor={Colors.textSecondary}
      value={form[key]}
      keyboardType={keyboardType}
      autoCapitalize={key === 'vehicle_number' ? 'characters' : 'words'}
      onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
    />
  );

  return (
    <View style={styles.container}>
      <AppHeader title="Delivery Partners" />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {showForm ? (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>New delivery partner</Text>
              {field('name', 'Full name *')}
              {field('phone', 'Mobile number *', 'phone-pad')}
              {field('vehicle_number', 'Vehicle number (optional)')}
              {field('vehicle_type', 'Vehicle type, e.g. Tata Ace (optional)')}
              <View style={styles.formActions}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setShowForm(false); setForm(EMPTY_FORM); }}>
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryBtn} onPress={handleAdd} disabled={saving}>
                  {saving ? <ActivityIndicator color={Colors.surface} /> : <Text style={styles.primaryBtnText}>Add partner</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
              <Ionicons name="person-add-outline" size={18} color={Colors.surface} />
              <Text style={styles.addBtnText}>Add delivery partner</Text>
            </TouchableOpacity>
          )}

          {partners.length === 0 ? (
            <Text style={styles.emptyText}>No delivery partners found.</Text>
          ) : (
            partners.map(p => (
              <View key={p.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.pName}>{p.name}</Text>
                  <Text style={[
                    styles.status,
                    p.status === 'AVAILABLE' || p.status === 'ONLINE' ? styles.statusAvail :
                    p.status === 'BUSY' ? styles.statusBusy : styles.statusOffline
                  ]}>
                    {p.status}
                  </Text>
                </View>
                <Text style={styles.pPhone}>{p.phone}{p.vehicle_number ? `  ·  ${p.vehicle_number}` : ''}</Text>

                <View style={styles.statsRow}>
                  <Text style={styles.pStat}>⭐ {p.rating}</Text>
                  <Text style={styles.pStat}>✅ {p.completed_deliveries}</Text>
                  <Text style={styles.pStat}>❌ {p.failed_deliveries}</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16 },

  emptyText: { textAlign: 'center', color: Colors.textSecondary, marginTop: 20 },

  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 12, marginBottom: 16 },
  addBtnText: { color: Colors.surface, fontWeight: 'bold', marginLeft: 8 },

  formCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  formTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.primaryDark, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, color: Colors.text },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  secondaryBtn: { paddingVertical: 10, paddingHorizontal: 16, marginRight: 8 },
  secondaryBtnText: { color: Colors.textSecondary, fontWeight: '600' },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18, minWidth: 110, alignItems: 'center' },
  primaryBtnText: { color: Colors.surface, fontWeight: 'bold' },

  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  pName: { fontSize: 18, fontWeight: 'bold', color: Colors.primaryDark },
  status: { fontSize: 12, fontWeight: 'bold', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusAvail: { backgroundColor: Colors.success + '20', color: Colors.success },
  statusBusy: { backgroundColor: Colors.warning + '20', color: Colors.warning },
  statusOffline: { backgroundColor: Colors.textLight + '20', color: Colors.textSecondary },

  pPhone: { fontSize: 14, color: Colors.textSecondary, marginBottom: 12 },

  statsRow: { flexDirection: 'row', paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  pStat: { fontSize: 14, fontWeight: '600', color: Colors.text, marginRight: 16 }
});
