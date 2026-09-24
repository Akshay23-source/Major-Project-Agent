import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { Colors } from "../../src/theme/colors";
import { getCurrentDriver, updateDriverStatus, DeliveryPartner } from "../../src/services/driver/auth";
import { getMyDeliveries } from "../../src/services/driver/deliveries";
import { startLocationTracking, stopLocationTracking } from "../../src/services/driver/locationTracking";
import { useLocalization } from "../../src/hooks/useLocalization";
import { signOut } from "../../src/lib/api";

export default function DriverDashboard() {
  const router = useRouter();
  const { t } = useLocalization();
  const [driver, setDriver] = useState<DeliveryPartner | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeDelivery, setActiveDelivery] = useState<any>(null);
  const [stats, setStats] = useState({ today: 0, pending: 0 });

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const current = await getCurrentDriver();
      if (!current) {
        router.replace('/login');
        return;
      }
      setDriver(current);

      const allDeliveries = await getMyDeliveries('ALL');
      const active = allDeliveries.find(d => 
        d.logistics_tracking_status !== 'DELIVERED' && 
        d.logistics_tracking_status !== 'ASSIGNED'
      );
      
      const pendingCount = allDeliveries.filter(d => d.logistics_tracking_status !== 'DELIVERED').length;
      
      const todayStart = new Date();
      todayStart.setHours(0,0,0,0);
      const todayCount = allDeliveries.filter(d => 
        d.logistics_tracking_status === 'DELIVERED' && 
        new Date(d.created_at) >= todayStart
      ).length;

      setActiveDelivery(active || null);
      setStats({ today: todayCount, pending: pendingCount });
      
      // Manage GPS based on active delivery
      if (active) {
        await startLocationTracking(active.id);
      } else {
        await stopLocationTracking();
      }

    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Could not load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Log out", "Stop sharing your location and sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await stopLocationTracking();
          await updateDriverStatus("OFFLINE");
          await signOut(); // AuthProvider returns to the login screen
        },
      },
    ]);
  };

  const toggleStatus = async () => {
    if (!driver) return;
    const newStatus = driver.status === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
    setLoading(true);
    const success = await updateDriverStatus(newStatus);
    if (success) {
      setDriver({ ...driver, status: newStatus });
    } else {
      Alert.alert("Error", "Failed to update status");
    }
    setLoading(false);
  };

  if (loading && !driver) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{t('dashboard.welcome')},</Text>
          <Text style={styles.name}>{driver?.name}</Text>
          <TouchableOpacity onPress={handleLogout} accessibilityLabel="Log out" style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Ionicons name="log-out-outline" size={16} color={Colors.textSecondary} />
            <Text style={{ color: Colors.textSecondary, marginLeft: 4, fontSize: 13 }}>Log out</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity 
          style={[styles.statusToggle, driver?.status === 'ONLINE' ? styles.statusOnline : styles.statusOffline]}
          onPress={toggleStatus}
          disabled={driver?.status === 'BUSY'}
        >
          <View style={[styles.statusDot, driver?.status === 'ONLINE' ? styles.dotOnline : styles.dotOffline]} />
          <Text style={[styles.statusText, driver?.status === 'ONLINE' ? styles.textOnline : styles.textOffline]}>
            {driver?.status === 'BUSY' ? 'BUSY' : (driver?.status === 'ONLINE' ? t('driver.goOffline') : t('driver.goOnline'))}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>{t('driver.currentDelivery')}</Text>
        
        {activeDelivery ? (
          <TouchableOpacity 
            style={styles.activeCard} 
            onPress={() => router.push(`/(driver)/deliveries/${activeDelivery.id}`)}
          >
            <View style={styles.activeCardHeader}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{activeDelivery.logistics_tracking_status}</Text>
              </View>
              <Text style={styles.orderId}>#{activeDelivery.orders?.order_number}</Text>
            </View>

            <View style={styles.routeContainer}>
              <View style={styles.routePoint}>
                <Ionicons name="location" size={20} color={Colors.primary} />
                <View style={styles.routeTextContainer}>
                  <Text style={styles.routeLabel}>{t('logistics.pickup')}</Text>
                  <Text style={styles.routeValue}>{activeDelivery.orders?.farmers?.address}</Text>
                </View>
              </View>
              <View style={styles.routeLine} />
              <View style={styles.routePoint}>
                <Ionicons name="flag" size={20} color={Colors.error} />
                <View style={styles.routeTextContainer}>
                  <Text style={styles.routeLabel}>{t('logistics.dropOff')}</Text>
                  <Text style={styles.routeValue}>{activeDelivery.orders?.buyers?.address}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.viewDetailsText}>View Details &rarr;</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="bicycle" size={48} color={Colors.textLight} />
            <Text style={styles.emptyText}>{t('driver.noAssignedDeliveries')}</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.today}</Text>
            <Text style={styles.statLabel}>{t('driver.todayDeliveries')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 24, 
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border
  },
  greeting: { fontSize: 14, color: Colors.textSecondary },
  name: { fontSize: 24, fontWeight: 'bold', color: Colors.primaryDark },
  statusToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusOnline: { backgroundColor: '#E6F4EA', borderColor: '#C3E8CC' },
  statusOffline: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  dotOnline: { backgroundColor: Colors.success },
  dotOffline: { backgroundColor: Colors.textLight },
  statusText: { fontSize: 14, fontWeight: '600' },
  textOnline: { color: Colors.success },
  textOffline: { color: Colors.textSecondary },
  
  content: { padding: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text, marginBottom: 16 },
  
  activeCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  activeCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  badge: { backgroundColor: '#E6F4EA', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: Colors.success, fontSize: 12, fontWeight: 'bold' },
  orderId: { fontSize: 16, fontWeight: 'bold', color: Colors.textSecondary },
  
  routeContainer: { marginBottom: 16 },
  routePoint: { flexDirection: 'row', alignItems: 'flex-start' },
  routeLine: { width: 2, height: 24, backgroundColor: Colors.border, marginLeft: 9, marginVertical: 4 },
  routeTextContainer: { marginLeft: 12, flex: 1 },
  routeLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 2 },
  routeValue: { fontSize: 15, color: Colors.text, fontWeight: '500' },
  
  viewDetailsText: { color: Colors.primary, fontWeight: 'bold', textAlign: 'center', marginTop: 8 },

  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  emptyText: { color: Colors.textSecondary, marginTop: 16, fontSize: 16, fontWeight: '500' },

  statsGrid: { flexDirection: 'row', gap: 16 },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: { fontSize: 32, fontWeight: 'bold', color: Colors.primaryDark, marginBottom: 8 },
  statLabel: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' }
});
