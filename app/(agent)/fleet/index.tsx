import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../../src/components/ui/AppHeader';
import { Colors } from '../../../src/theme/colors';
import { createVehicle, getVehicles, Vehicle } from '../../../src/services/logistics';
import { errorMessage } from '../../../src/lib/api';

const EMPTY_FORM = { vehicle_number: '', vehicle_type: '', capacity: '' };

export default function FleetDashboardScreen() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [stats, setStats] = useState({
    total: 0,
    available: 0,
    assigned: 0
  });

  useFocusEffect(
    useCallback(() => {
      loadFleet();
    }, [])
  );

  const loadFleet = async () => {
    setLoading(true);
    try {
      const v = await getVehicles();
      setVehicles(v);
      setStats({
        total: v.length,
        available: v.filter((x) => x.availability_status === 'AVAILABLE').length,
        assigned: v.filter((x) => x.availability_status === 'ASSIGNED').length
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!form.vehicle_number.trim() || !form.vehicle_type.trim()) {
      Alert.alert('Missing details', 'Enter the vehicle number and type.');
      return;
    }
    const capacity = form.capacity.trim() ? Number(form.capacity) : undefined;
    if (capacity !== undefined && (!Number.isFinite(capacity) || capacity < 0)) {
      Alert.alert('Invalid capacity', 'Capacity must be a number in kg.');
      return;
    }
    setSaving(true);
    try {
      await createVehicle({ vehicle_number: form.vehicle_number.trim(), vehicle_type: form.vehicle_type.trim(), capacity, capacity_unit: 'kg' });
      setForm(EMPTY_FORM);
      setShowForm(false);
      loadFleet();
    } catch (e) {
      Alert.alert('Could not add vehicle', errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Fleet Management" />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statTitle}>Total</Text>
              <Text style={styles.statValue}>{stats.total}</Text>
            </View>
            <View style={[styles.statBox, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.border }]}>
              <Text style={styles.statTitle}>Available</Text>
              <Text style={[styles.statValue, { color: Colors.success }]}>{stats.available}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statTitle}>Assigned</Text>
              <Text style={[styles.statValue, { color: Colors.warning }]}>{stats.assigned}</Text>
            </View>
          </View>

          {showForm ? (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>New vehicle</Text>
              <TextInput style={styles.input} placeholder="Vehicle number * (e.g. KA-09-AB-1234)" placeholderTextColor={Colors.textSecondary}
                autoCapitalize="characters" value={form.vehicle_number} onChangeText={(v) => setForm((f) => ({ ...f, vehicle_number: v }))} />
              <TextInput style={styles.input} placeholder="Vehicle type * (e.g. Tata Ace)" placeholderTextColor={Colors.textSecondary}
                value={form.vehicle_type} onChangeText={(v) => setForm((f) => ({ ...f, vehicle_type: v }))} />
              <TextInput style={styles.input} placeholder="Capacity in kg (optional)" placeholderTextColor={Colors.textSecondary}
                keyboardType="numeric" value={form.capacity} onChangeText={(v) => setForm((f) => ({ ...f, capacity: v }))} />
              <View style={styles.formActions}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setShowForm(false); setForm(EMPTY_FORM); }}>
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryBtn} onPress={handleAdd} disabled={saving}>
                  {saving ? <ActivityIndicator color={Colors.surface} /> : <Text style={styles.primaryBtnText}>Add vehicle</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
              <Ionicons name="car-outline" size={18} color={Colors.surface} />
              <Text style={styles.addBtnText}>Add vehicle</Text>
            </TouchableOpacity>
          )}

          {vehicles.length === 0 ? (
            <Text style={styles.emptyText}>No vehicles in fleet.</Text>
          ) : (
            vehicles.map(v => (
              <View key={v.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.vNum}>{v.vehicle_number}</Text>
                  <Text style={[styles.status, v.availability_status === 'AVAILABLE' ? styles.statusAvail : styles.statusAssig]}>
                    {v.availability_status}
                  </Text>
                </View>
                <Text style={styles.vType}>{v.vehicle_type} {v.capacity ? `• Cap: ${v.capacity}${v.capacity_unit || ''}` : ''}</Text>
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

  statsRow: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 12, paddingVertical: 16, marginBottom: 20, borderWidth: 1, borderColor: Colors.border },
  statBox: { flex: 1, alignItems: 'center' },
  statTitle: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4, fontWeight: 'bold', textTransform: 'uppercase' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: Colors.text },

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

  emptyText: { textAlign: 'center', color: Colors.textSecondary, marginTop: 20 },

  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  vNum: { fontSize: 18, fontWeight: 'bold', color: Colors.primaryDark },
  status: { fontSize: 12, fontWeight: 'bold', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusAvail: { backgroundColor: Colors.success + '20', color: Colors.success },
  statusAssig: { backgroundColor: Colors.warning + '20', color: Colors.warning },
  vType: { fontSize: 14, color: Colors.textSecondary }
});
