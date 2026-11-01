import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AppHeader } from '../ui/AppHeader';
import { getSession, Role, signOut } from '../../lib/api';
import { Colors } from '../../theme/colors';
import DashboardKPIs from './DashboardKPIs';
import OrderList from './OrderList';

interface SharedDashboardProps {
  role: Role;
}

export default function SharedDashboard({ role }: SharedDashboardProps) {
  const session = getSession();
  const activeRole = role || session?.role;
  const router = useRouter();

  if (!activeRole) return null;

  const handleSwitchToAgent = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
      <AppHeader
        title={activeRole === 'agent' ? "AgriAgent Logistics" : "Driver Portal"}
        subtitle="Dashboard"
      />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {activeRole === 'driver' && (
          <View style={styles.driverBanner}>
            <View style={styles.driverBannerLeft}>
              <View style={styles.driverIconBg}>
                <Ionicons name="bicycle" size={18} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.driverBannerTitle}>Driver Mode</Text>
                <Text style={styles.driverBannerSubtitle}>
                  Logged in as {session?.user?.name || session?.user?.phone || 'Driver'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.switchButton}
              onPress={handleSwitchToAgent}
              activeOpacity={0.8}
            >
              <Ionicons name="swap-horizontal" size={16} color="#FFFFFF" />
              <Text style={styles.switchButtonText}>Switch to Agent</Text>
            </TouchableOpacity>
          </View>
        )}
        <DashboardKPIs role={activeRole} />
        <OrderList role={activeRole} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  driverBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(11, 143, 60, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    flexWrap: 'wrap',
    gap: 10,
  },
  driverBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  driverIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  driverBannerSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryDark,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 6,
  },
  switchButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});

