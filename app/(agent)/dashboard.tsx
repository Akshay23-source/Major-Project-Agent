import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  FlatList
} from "react-native";
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { AppHeader } from '../../src/components/ui/AppHeader';
import { SummaryCard } from '../../src/components/ui/SummaryCard';
import { StatusBadge } from '../../src/components/ui/StatusBadge';
import { getOrders } from '../../src/services/orders';
import { getUnreadCount } from '../../src/services/notifications';
import { useLocalization } from '../../src/hooks/useLocalization';
import { supabase } from '../../src/lib/supabase';

const screenWidth = Dimensions.get('window').width;

export default function AgentDashboard() {
  const router = useRouter();
  const agentName = "AgriAgent Logistics";
  const { t } = useLocalization();
  
  const [loading, setLoading] = useState(true);
  
  const [kpis, setKpis] = useState({
    incomingOrders: 0,
    awaitingPickup: 0,
    pickupsToday: 0,
    inTransit: 0,
    outForDelivery: 0,
    deliveredToday: 0,
    delayed: 0,
    availablePartners: 0,
  });

  const [activeLogistics, setActiveLogistics] = useState<any[]>([]);
  const [urgentOperations, setUrgentOperations] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [])
  );

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [count] = await Promise.all([
        getUnreadCount()
      ]);

      // Fetch real KPI counts
      const [
        { count: incomingOrdersCount },
        { count: awaitingPickupCount },
        { count: inTransitCount },
        { count: outForDeliveryCount },
        { count: availablePartnersCount }
      ] = await Promise.all([
        supabase.from("orders").select("*", { count: "exact", head: true }).in("logistics_status", ["PENDING", "PICKUP_ASSIGNED"]),
        supabase.from("deliveries").select("*", { count: "exact", head: true }).eq("status", "AWAITING_PICKUP"),
        supabase.from("deliveries").select("*", { count: "exact", head: true }).eq("status", "IN_TRANSIT"),
        supabase.from("deliveries").select("*", { count: "exact", head: true }).eq("status", "OUT_FOR_DELIVERY"),
        supabase.from("delivery_partners").select("*", { count: "exact", head: true }).in("status", ["AVAILABLE", "ONLINE"])
      ]);

      setKpis({
        incomingOrders: incomingOrdersCount || 0,
        awaitingPickup: awaitingPickupCount || 0,
        pickupsToday: 0, // Requires date filtering, keeping 0 for simplicity if 0.
        inTransit: inTransitCount || 0,
        outForDelivery: outForDeliveryCount || 0,
        deliveredToday: 0,
        delayed: 0,
        availablePartners: availablePartnersCount || 0
      });

      // Fetch active logistics orders (PENDING, ASSIGNED, IN_TRANSIT)
      const { data: activeOrders } = await supabase
        .from("orders")
        .select("id, external_order_id, product, quantity, unit, logistics_status, priority, is_perishable, buyers(name, city), farmers(name, village)")
        .in("logistics_status", ["PENDING", "PICKUP_ASSIGNED", "IN_TRANSIT", "OUT_FOR_DELIVERY"])
        .order("created_at", { ascending: false })
        .limit(10);

      if (activeOrders) setActiveLogistics(activeOrders);

      // Fetch Urgent Operations (Delayed, Failed, High Priority)
      const { data: urgentOrders } = await supabase
        .from("orders")
        .select("id, external_order_id, product, logistics_status, priority")
        .or("priority.eq.URGENT,logistics_status.eq.DELAYED,logistics_status.eq.FAILED")
        .order("created_at", { ascending: false })
        .limit(5);

      if (urgentOrders) setUrgentOperations(urgentOrders);

      setUnreadCount(count);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    if (priority === 'URGENT') return Colors.error;
    if (priority === 'HIGH') return Colors.warning;
    return Colors.success;
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader 
        title={agentName}
        subtitle="Logistics Control Center"
        unreadCount={unreadCount}
        onNotificationPress={() => router.push('/notifications')}
        onProfilePress={() => router.push('/profile')}
      />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 40 }} />
        ) : (
          <>
            {/* KPI Cards Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Operations Overview</Text>
              <View style={styles.kpiGrid}>
                <SummaryCard title="Incoming" value={kpis.incomingOrders} icon="cube" color={Colors.primary} onPress={() => router.push('/orders')} />
                <SummaryCard title="Awaiting Pickup" value={kpis.awaitingPickup} icon="time" color={Colors.warning} onPress={() => router.push('/deliveries')} />
              </View>
              <View style={styles.kpiGrid}>
                <SummaryCard title="In Transit" value={kpis.inTransit} icon="map" color={Colors.info} onPress={() => router.push('/logistics/map')} />
                <SummaryCard title="Out for Delivery" value={kpis.outForDelivery} icon="bicycle" color={Colors.primaryDark} onPress={() => router.push('/deliveries')} />
              </View>
              <View style={styles.kpiGrid}>
                <SummaryCard title="Delivered Today" value={kpis.deliveredToday} icon="checkmark-circle" color={Colors.success} onPress={() => {}} />
                <SummaryCard title="Available Partners" value={kpis.availablePartners} icon="people" color={Colors.success} onPress={() => router.push('/delivery-partners')} />
              </View>
            </View>

            {/* Live Operations Map Teaser */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Live Operations Map</Text>
                <TouchableOpacity onPress={() => router.push('/logistics/map')}>
                  <Text style={styles.seeAll}>Open Live Tracking</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.mapTeaser} onPress={() => router.push('/logistics/map')}>
                <Text style={{color: 'white', fontWeight: 'bold', fontSize: 16}}>View Live Tracking & Routes</Text>
                <Text style={{color: 'rgba(255,255,255,0.7)', marginTop: 4}}>Monitor driver locations in real-time</Text>
              </TouchableOpacity>
            </View>

            {/* Urgent Operations */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Urgent Operations</Text>
              {urgentOperations.length === 0 ? (
                <Text style={styles.emptyText}>No urgent issues at the moment.</Text>
              ) : (
                urgentOperations.map(op => (
                  <TouchableOpacity key={op.id} style={[styles.orderCard, { borderLeftWidth: 4, borderLeftColor: Colors.error }]} onPress={() => router.push(`/orders/${op.id}`)}>
                    <View style={styles.orderHeader}>
                      <Text style={styles.orderId}>{op.external_order_id || op.id.substring(0,8)}</Text>
                      <Text style={{color: Colors.error, fontWeight: 'bold', fontSize: 12}}>{op.priority}</Text>
                    </View>
                    <Text style={styles.orderProduct}>{op.product}</Text>
                    <Text style={styles.orderStatusText}>Status: {op.logistics_status}</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>

            {/* Active Logistics */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Active Logistics</Text>
                <TouchableOpacity onPress={() => router.push('/deliveries')}>
                  <Text style={styles.seeAll}>See All</Text>
                </TouchableOpacity>
              </View>
              
              {activeLogistics.length === 0 ? (
                <Text style={styles.emptyText}>No active logistics operations.</Text>
              ) : (
                activeLogistics.map(order => (
                  <TouchableOpacity 
                    key={order.id} 
                    style={styles.orderCard}
                    onPress={() => router.push(`/deliveries/${order.id}`)}
                  >
                    <View style={styles.orderHeader}>
                      <Text style={styles.orderId}>{order.external_order_id || order.id.substring(0,8)}</Text>
                      <StatusBadge status={order.logistics_status} />
                    </View>
                    <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
                       <Text style={styles.orderProduct}>{order.product} • {order.quantity} {order.unit}</Text>
                       {order.is_perishable && <Text style={styles.perishableBadge}>Perishable</Text>}
                    </View>
                    
                    <View style={styles.routeInfo}>
                      <View style={styles.routePoint}>
                        <Text style={styles.routeLabel}>Pickup</Text>
                        <Text style={styles.routeValue}>{order.farmers?.village || 'Unknown'}</Text>
                      </View>
                      <View style={styles.routeArrow}><Text>→</Text></View>
                      <View style={styles.routePoint}>
                        <Text style={styles.routeLabel}>Destination</Text>
                        <Text style={styles.routeValue}>{order.buyers?.city || 'Unknown'}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>

          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text, marginBottom: 12, paddingHorizontal: 4 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 },
  seeAll: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  
  kpiGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  
  mapTeaser: { 
    height: 120, 
    backgroundColor: Colors.primaryDark, 
    borderRadius: 16, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: Colors.text, 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 8, 
    elevation: 3 
  },
  
  orderCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border, shadowColor: Colors.text, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderId: { fontSize: 14, fontWeight: 'bold', color: Colors.text },
  orderProduct: { fontSize: 16, fontWeight: '600', color: Colors.primaryDark },
  perishableBadge: { marginLeft: 8, backgroundColor: Colors.error + '20', color: Colors.error, fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontWeight: 'bold' },
  orderStatusText: { fontSize: 14, color: Colors.textSecondary },
  
  routeInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, padding: 10, borderRadius: 8, marginTop: 8 },
  routePoint: { flex: 1 },
  routeLabel: { fontSize: 11, color: Colors.textSecondary, marginBottom: 2, textTransform: 'uppercase', fontWeight: 'bold' },
  routeValue: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  routeArrow: { paddingHorizontal: 12 },
  
  emptyText: { textAlign: 'center', color: Colors.textSecondary, marginVertical: 12 }
});
