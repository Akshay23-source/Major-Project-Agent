import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppHeader } from '../../../src/components/ui/AppHeader';
import { Colors } from '../../../src/theme/colors';
import { supabase } from '../../../src/lib/supabase';
import { getCurrentAgent } from '../../../src/services/agent';

export default function DeliveryPartnersScreen() {
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadPartners();
    }, [])
  );

  const loadPartners = async () => {
    setLoading(true);
    try {
      const agent = await getCurrentAgent();
      if (!agent) return;

      const { data, error } = await supabase
        .from('delivery_partners')
        .select('*')
        .eq('agent_id', agent.id)
        .order('name');

      if (error) throw error;
      setPartners(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Delivery Partners" />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
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
                <Text style={styles.pPhone}>{p.phone}</Text>
                
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
