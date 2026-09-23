import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppHeader } from '../../../src/components/ui/AppHeader';
import { Colors } from '../../../src/theme/colors';
import { supabase } from '../../../src/lib/supabase';
import { getCurrentAgent } from '../../../src/services/agent';

export default function FleetDashboardScreen() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
      const agent = await getCurrentAgent();
      if (!agent) return;

      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('agent_id', agent.id)
        .order('vehicle_number');

      if (error) throw error;
      
      const v = data || [];
      setVehicles(v);
      setStats({
        total: v.length,
        available: v.filter(x => x.availability_status === 'AVAILABLE').length,
        assigned: v.filter(x => x.availability_status === 'ASSIGNED').length
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Fleet Management" />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
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
                <Text style={styles.vType}>{v.vehicle_type} {v.capacity ? `• Cap: ${v.capacity}${v.capacity_unit}` : ''}</Text>
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

  emptyText: { textAlign: 'center', color: Colors.textSecondary, marginTop: 20 },

  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  vNum: { fontSize: 18, fontWeight: 'bold', color: Colors.primaryDark },
  status: { fontSize: 12, fontWeight: 'bold', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusAvail: { backgroundColor: Colors.success + '20', color: Colors.success },
  statusAssig: { backgroundColor: Colors.warning + '20', color: Colors.warning },
  vType: { fontSize: 14, color: Colors.textSecondary }
});
