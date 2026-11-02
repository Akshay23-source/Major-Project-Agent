import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';
import { SummaryCard } from '../ui/SummaryCard';
import { Role } from '../../lib/api';
import { getLogisticsDashboard } from '../../services/logistics';
import { getMyDeliveries, getAvailableDeliveries } from '../../services/driver/deliveries';
import { useLocalization } from '../../hooks/useLocalization';
import { useRouter } from 'expo-router';

interface DashboardKPIsProps {
  role: Role;
}

export default function DashboardKPIs({ role }: DashboardKPIsProps) {
  const { t } = useLocalization();
  const router = useRouter();
  const [data, setData] = React.useState<{ [key: string]: number }>({});
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        if (role === 'agent') {
          const dash = await getLogisticsDashboard();
          setData({
            incoming: dash.kpis.incomingOrders || 0,
            awaitingPickup: dash.kpis.awaitingPickup || 0,
            outForDelivery: dash.kpis.outForDelivery || 0,
            deliveredToday: dash.kpis.deliveredToday || 0,
            totalDrivers: (dash as any).kpis?.totalDrivers || 0,
            awaitingVerification: (dash as any).kpis?.awaitingVerification || 0,
          });
        } else {
          // Driver role
          const [allDeliveries, available] = await Promise.all([
            getMyDeliveries('ALL').catch(() => []),
            getAvailableDeliveries().catch(() => []),
          ]);
          const list = Array.isArray(allDeliveries) ? allDeliveries : [];
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const incoming = Array.isArray(available) ? available.length : 0;

          // Awaiting = ACCEPTED, DRIVER_EN_ROUTE, ARRIVED_AT_FARM
          const awaiting = list.filter((d: any) =>
            ['ACCEPTED', 'DRIVER_EN_ROUTE', 'ARRIVED_AT_FARM'].includes(d.logistics_tracking_status)
          ).length;

          // Out for delivery = PICKED_UP through OUT_FOR_DELIVERY
          const outForDelivery = list.filter((d: any) =>
            ['PICKED_UP', 'IN_TRANSIT', 'ARRIVED_AT_DESTINATION', 'OUT_FOR_DELIVERY'].includes(d.logistics_tracking_status)
          ).length;

          // Delivered today — use delivery_time if available, fallback created_at
          const deliveredToday = list.filter((d: any) => {
            if (d.logistics_tracking_status !== 'DELIVERED') return false;
            const ts = d.delivery_time || d.updated_at || d.created_at;
            return ts && new Date(ts) >= today;
          }).length;

          setData({ incoming, awaiting, outForDelivery, deliveredToday });
        }
      } catch (e) {
        console.error('Failed to load KPIs:', e);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [role]);

  if (loading) return <View style={styles.center}><Text>Loading stats...</Text></View>;

  if (role === 'agent') {
    return (
      <View style={styles.kpiGrid}>
        <View style={styles.row}>
          <SummaryCard
            title="Incoming"
            value={data.incoming}
            icon="cube"
            color={Colors.primary}
            onPress={() => router.push('/orders' as any)}
          />
          <SummaryCard
            title="Awaiting Pickup"
            value={data.awaitingPickup}
            icon="time"
            color={Colors.warning}
            onPress={() => router.push('/deliveries?filter=Awaiting' as any)}
          />
        </View>
        <View style={styles.row}>
          <SummaryCard
            title="Out for Delivery"
            value={data.outForDelivery}
            icon="bicycle"
            color={Colors.primaryDark}
            onPress={() => router.push('/deliveries?filter=In%20Transit' as any)}
          />
          <SummaryCard
            title="Delivered Today"
            value={data.deliveredToday}
            icon="checkmark-circle"
            color={Colors.success}
            onPress={() => router.push('/deliveries?filter=Delivered' as any)}
          />
        </View>
        {(data.totalDrivers > 0 || data.awaitingVerification > 0) && (
          <View style={styles.row}>
            <SummaryCard
              title="Drivers"
              value={data.totalDrivers}
              icon="people"
              color={Colors.info || '#6366F1'}
              onPress={() => router.push('/delivery-partners' as any)}
            />
            <SummaryCard
              title="Awaiting Verification"
              value={data.awaitingVerification}
              icon="shield-checkmark"
              color={Colors.warning}
              onPress={() => router.push('/deliveries' as any)}
            />
          </View>
        )}
      </View>
    );
  }

  // Driver role
  return (
    <View style={styles.kpiGrid}>
      <View style={styles.row}>
        <SummaryCard
          title="Incoming"
          value={data.incoming}
          icon="cube"
          color={Colors.primary}
          onPress={() => router.push('/(driver)/incoming' as any)}
        />
        <SummaryCard
          title="Awaiting Pickup"
          value={data.awaiting}
          icon="time"
          color={Colors.warning}
          onPress={() => router.push('/(driver)/awaiting' as any)}
        />
      </View>
      <View style={styles.row}>
        <SummaryCard
          title="Out for Delivery"
          value={data.outForDelivery}
          icon="bicycle"
          color={Colors.primaryDark}
          onPress={() => router.push('/(driver)/deliveries' as any)}
        />
        <SummaryCard
          title="Delivered Today"
          value={data.deliveredToday}
          icon="checkmark-circle"
          color={Colors.success}
          onPress={() => router.push('/(driver)/delivered-today' as any)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  kpiGrid: {
    gap: 8,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  center: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
