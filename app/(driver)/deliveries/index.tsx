import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { Colors } from "../../../src/theme/colors";
import { getMyDeliveries } from "../../../src/services/driver/deliveries";
import { useLocalization } from "../../../src/hooks/useLocalization";

export default function MyDeliveriesScreen() {
  const router = useRouter();
  const { t } = useLocalization();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'PENDING' | 'COMPLETED'>('PENDING');

  useFocusEffect(
    useCallback(() => {
      loadDeliveries();
    }, [filter])
  );

  const loadDeliveries = async () => {
    setLoading(true);
    try {
      const data = await getMyDeliveries(filter);
      setDeliveries(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => router.push(`/(driver)/deliveries/${item.id}`)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.orderId}>#{item.orders?.order_number}</Text>
        <View style={[styles.badge, item.logistics_tracking_status === 'DELIVERED' ? styles.badgeSuccess : styles.badgePending]}>
          <Text style={[styles.badgeText, item.logistics_tracking_status === 'DELIVERED' ? styles.textSuccess : styles.textPending]}>
            {item.logistics_tracking_status}
          </Text>
        </View>
      </View>

      <Text style={styles.productInfo}>{item.orders?.quantity} {item.orders?.unit} • {item.orders?.product}</Text>

      <View style={styles.locations}>
        <View style={styles.locationRow}>
          <Ionicons name="location" size={16} color={Colors.primary} />
          <Text style={styles.locationText} numberOfLines={1}>{item.orders?.farmers?.address}</Text>
        </View>
        <View style={styles.locationLine} />
        <View style={styles.locationRow}>
          <Ionicons name="flag" size={16} color={Colors.error} />
          <Text style={styles.locationText} numberOfLines={1}>{item.orders?.buyers?.address}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('driver.myDeliveries')}</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, filter === 'PENDING' && styles.activeTab]}
          onPress={() => setFilter('PENDING')}
        >
          <Text style={[styles.tabText, filter === 'PENDING' && styles.activeTabText]}>Pending</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, filter === 'COMPLETED' && styles.activeTab]}
          onPress={() => setFilter('COMPLETED')}
        >
          <Text style={[styles.tabText, filter === 'COMPLETED' && styles.activeTabText]}>Completed</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={deliveries}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={48} color={Colors.textLight} />
              <Text style={styles.emptyText}>{t('driver.noAssignedDeliveries')}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { padding: 24, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 24, fontWeight: 'bold', color: Colors.primaryDark },
  
  tabs: { flexDirection: 'row', padding: 16, gap: 12 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  activeTab: { backgroundColor: '#E6F4EA', borderColor: '#C3E8CC' },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  activeTabText: { color: Colors.success },

  list: { padding: 16, gap: 16 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderId: { fontSize: 16, fontWeight: 'bold', color: Colors.text },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgePending: { backgroundColor: '#FFF4E5' },
  badgeSuccess: { backgroundColor: '#E6F4EA' },
  badgeText: { fontSize: 11, fontWeight: 'bold' },
  textPending: { color: Colors.warning },
  textSuccess: { color: Colors.success },

  productInfo: { fontSize: 15, color: Colors.textSecondary, marginBottom: 16, fontWeight: '500' },

  locations: { backgroundColor: '#F9FAFB', padding: 12, borderRadius: 12 },
  locationRow: { flexDirection: 'row', alignItems: 'center' },
  locationLine: { width: 2, height: 12, backgroundColor: Colors.border, marginLeft: 7, marginVertical: 2 },
  locationText: { marginLeft: 12, fontSize: 13, color: Colors.text, flex: 1 },

  emptyContainer: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { color: Colors.textSecondary, marginTop: 16, fontSize: 15 }
});
