import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator
} from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { getEmployeeById, Employee } from '../../../src/services/employees';
import { getDeliveries } from '../../../src/services/deliveries';
import { Colors } from '../../../src/theme/colors';
import { StatusBadge } from '../../../src/components/ui/StatusBadge';

export default function EmployeeDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [id])
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const eData = await getEmployeeById(id as string);
      setEmployee(eData);
      
      const allDeliveries = await getDeliveries();
      const eDeliveries = allDeliveries.filter((d: any) => d.employee_id === id);
      setDeliveries(eDeliveries);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    let completed = 0;
    let pending = 0;
    let cancelled = 0;
    
    deliveries.forEach(d => {
      if (d.status === 'Delivered') completed++;
      else if (d.status === 'Cancelled') cancelled++;
      else pending++;
    });
    
    return {
      total: deliveries.length,
      completed,
      pending,
      cancelled
    };
  }, [deliveries]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (!employee) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
        <Text style={styles.errorText}>Employee not found</Text>
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
          <Ionicons name="arrow-back" size={24} color={Colors.surface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Employee Details</Text>
        <TouchableOpacity onPress={() => router.push(`/employees/edit?id=${employee.id}`)} style={styles.headerButton}>
          <Ionicons name="create-outline" size={24} color={Colors.surface} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{employee.name.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.employeeName}>{employee.name}</Text>
          <Text style={styles.employeeRole}>{employee.role} • {employee.employee_id}</Text>
          
          <View style={[
            styles.statusBadge, 
            employee.status === 'Active' ? styles.statusActive : 
            employee.status === 'On Leave' ? styles.statusWarning : styles.statusInactive
          ]}>
            <Text style={[
              styles.statusText, 
              employee.status === 'Active' ? styles.statusTextActive : 
              employee.status === 'On Leave' ? styles.statusTextWarning : styles.statusTextInactive
            ]}>
              {employee.status}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Total</Text>
            <Text style={styles.statValue}>{stats.total}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Completed</Text>
            <Text style={[styles.statValue, { color: Colors.success }]}>{stats.completed}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Pending</Text>
            <Text style={[styles.statValue, { color: Colors.warning }]}>{stats.pending}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Cancelled</Text>
            <Text style={[styles.statValue, { color: Colors.error }]}>{stats.cancelled}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <InfoRow icon="call-outline" label="Phone" value={employee.phone} />
          {employee.email && <InfoRow icon="mail-outline" label="Email" value={employee.email} />}
          <InfoRow icon="location-outline" label="Assigned Area" value={employee.assigned_area || 'N/A'} />
          {employee.joining_date && <InfoRow icon="calendar-outline" label="Joining Date" value={employee.joining_date} />}
          {employee.emergency_contact && <InfoRow icon="medkit-outline" label="Emergency Contact" value={employee.emergency_contact} />}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Assigned Deliveries</Text>
          </View>
          
          {deliveries.length === 0 ? (
            <View style={styles.emptyDeliveries}>
              <Text style={styles.emptyText}>No deliveries assigned yet</Text>
            </View>
          ) : (
            deliveries.map(delivery => (
              <TouchableOpacity key={delivery.id} style={styles.deliveryCard} onPress={() => router.push(`/deliveries/${delivery.id}`)}>
                <View style={styles.deliveryHeader}>
                  <Text style={styles.deliveryId}>{delivery.delivery_number || delivery.id.substring(0,8)}</Text>
                  <StatusBadge status={delivery.status} />
                </View>
                <Text style={styles.deliveryProduct}>{delivery.orders?.product || 'Unknown Product'}</Text>
                <Text style={styles.deliveryAddress}>To: {delivery.orders?.buyers?.name || 'Unknown Buyer'}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap, label: string, value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoRowLeft}>
        <Ionicons name={icon} size={20} color={Colors.textSecondary} style={styles.infoIcon} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.primaryDark, padding: 16 },
  headerButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.surface },
  errorText: { fontSize: 18, color: Colors.text, marginTop: 16 },
  backBtn: { marginTop: 24, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.primary, borderRadius: 8 },
  backBtnText: { color: Colors.surface, fontWeight: 'bold' },
  
  content: { padding: 16, paddingBottom: 40 },
  profileCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 16, elevation: 2, borderWidth: 1, borderColor: Colors.border },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: Colors.surface },
  employeeName: { fontSize: 24, fontWeight: 'bold', color: Colors.text, marginBottom: 4 },
  employeeRole: { fontSize: 14, color: Colors.textSecondary, marginBottom: 12 },
  
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusActive: { backgroundColor: `${Colors.success}20` },
  statusWarning: { backgroundColor: `${Colors.warning}20` },
  statusInactive: { backgroundColor: `${Colors.textSecondary}20` },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  statusTextActive: { color: Colors.success },
  statusTextWarning: { color: Colors.warning },
  statusTextInactive: { color: Colors.textSecondary },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 20 },
  statBox: { flex: 1, backgroundColor: Colors.surface, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginBottom: 4, fontWeight: '500', textAlign: 'center' },
  statValue: { fontSize: 18, fontWeight: 'bold', color: Colors.primaryDark },

  section: { backgroundColor: Colors.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.text, marginBottom: 16 },
  
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.background },
  infoRowLeft: { flexDirection: 'row', alignItems: 'center' },
  infoIcon: { marginRight: 12 },
  infoLabel: { fontSize: 14, color: Colors.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '600', color: Colors.text, flex: 1, textAlign: 'right', marginLeft: 16 },

  emptyDeliveries: { alignItems: 'center', padding: 24 },
  emptyText: { color: Colors.textSecondary },

  deliveryCard: { backgroundColor: Colors.background, padding: 12, borderRadius: 8, marginBottom: 8 },
  deliveryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  deliveryId: { fontSize: 12, fontWeight: 'bold', color: Colors.text },
  deliveryProduct: { fontSize: 14, fontWeight: '600', color: Colors.primaryDark, marginBottom: 4 },
  deliveryAddress: { fontSize: 14, color: Colors.textSecondary }
});
