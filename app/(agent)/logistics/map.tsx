import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../../src/components/ui/AppHeader';
import { Colors } from '../../../src/theme/colors';
import { getAllDriverLocations, subscribeToAllDriverLocations } from '../../../src/services/logistics/location';
import { DriverLocation } from '../../../src/services/tracking';
import { getDeliveryPartners, DeliveryPartner } from '../../../src/services/logistics';
import { calculateRoute } from '../../../src/services/logistics/routes';
import { useRouter } from 'expo-router';
// Import the universal LiveMap
import LiveMap from '../../../src/components/maps/LiveMap';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_MOBILE = SCREEN_WIDTH < 768;

export default function LogisticsMapScreen() {
  const router = useRouter();
  const [drivers, setDrivers] = useState<DriverLocation[]>([]);
  const [partners, setPartners] = useState<Record<string, DeliveryPartner>>({});
  const [selectedDriver, setSelectedDriver] = useState<DriverLocation | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<{ lat: number, lng: number }[]>([]);
  const [pickupLocation, setPickupLocation] = useState<{ lat: number; lng: number; label?: string } | undefined>();
  const [dropLocation, setDropLocation] = useState<{ lat: number; lng: number; label?: string } | undefined>();

  useEffect(() => {
    loadInitialData();

    // Live location updates (polls the backend every few seconds)
    const unsubscribe = subscribeToAllDriverLocations((newLocation) => {
      setDrivers((prev) => {
        const existingIdx = prev.findIndex(d => d.delivery_partner_id === newLocation.delivery_partner_id);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = newLocation;
          return updated;
        }
        return [...prev, newLocation];
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const loadInitialData = async () => {
    try {
      const p = await getDeliveryPartners();
      const pMap: Record<string, DeliveryPartner> = {};

      if (p && Array.isArray(p)) {
        p.forEach(partner => pMap[partner.id] = partner);
      }
      setPartners(pMap);

      // Latest known position of each of this agent's drivers
      setDrivers(await getAllDriverLocations());
    } catch (error) {
      console.error("Failed to load map data", error);
      // Don't swallow entirely, but don't crash. We can keep an empty state.
      setPartners({});
    }
  };

  const handleDriverPress = async (driver: DriverLocation) => {
    setSelectedDriver(driver);

    // Fetch actual GPS trail recorded for this delivery if available
    if (driver.delivery_id) {
      try {
        const { api } = require('../../../src/lib/api');
        const points = await api.get(`/tracking/deliveries/${driver.delivery_id}/points`) as any[];
        if (points && points.length > 0) {
          const trail = points.map((p: any) => ({ lat: p.latitude, lng: p.longitude }));
          setRouteGeometry(trail);
        }
      } catch (err) {
        console.warn('Could not fetch delivery trail points:', err);
      }

      // Fetch delivery details for pickup and drop coordinates
      try {
        const { api } = require('../../../src/lib/api');
        const delivery = await api.get(`/deliveries/${driver.delivery_id}`) as any;

        if (delivery) {
          const ord = delivery.orders;
          const dropAddr = ord?.drop_address || ord?.delivery_location || delivery.drop_location;
          const pickupAddr = ord?.pickup_address || ord?.farmers?.address || delivery.pickup_location;

          const destination = {
            lat: typeof dropAddr === 'object' && dropAddr?.lat ? dropAddr.lat : (driver.latitude + 0.04),
            lng: typeof dropAddr === 'object' && dropAddr?.lng ? dropAddr.lng : (driver.longitude + 0.04),
            label: typeof dropAddr === 'object' ? dropAddr?.address : dropAddr || 'Customer Address'
          };
          const pickup = {
            lat: typeof pickupAddr === 'object' && pickupAddr?.lat ? pickupAddr.lat : (driver.latitude - 0.03),
            lng: typeof pickupAddr === 'object' && pickupAddr?.lng ? pickupAddr.lng : (driver.longitude - 0.03),
            label: typeof pickupAddr === 'object' ? pickupAddr?.address : pickupAddr || 'Farm Location'
          };
          setDropLocation(destination);
          setPickupLocation(pickup);

          const route = await calculateRoute(
            { lat: driver.latitude, lng: driver.longitude },
            destination
          );

          const geometry = route?.geometry as any;
          if (geometry && typeof geometry === 'object' && geometry.coordinates) {
            const coords = geometry.coordinates.map((c: any) => ({ lat: c[1], lng: c[0] }));
            setRouteGeometry(coords);
          } else {
            setRouteGeometry([
              { lat: driver.latitude, lng: driver.longitude },
              destination
            ]);
          }
        }
      } catch (error) {
        console.warn("Delivery details fetch for map fallback:", error);
      }
    } else {
      setDropLocation(undefined);
      setPickupLocation(undefined);
      setRouteGeometry([]);
    }
  };

  const renderSidePanel = () => (
    <View style={styles.sidePanel}>
      <Text style={styles.panelTitle}>Active Deliveries</Text>
      {drivers.length === 0 ? (
        <Text style={{ color: Colors.textSecondary, marginTop: 10 }}>No active deliveries.</Text>
      ) : (
        <FlatList
          data={drivers}
          keyExtractor={(item) => item.delivery_partner_id}
          renderItem={({ item }) => {
            const p = partners[item.delivery_partner_id];
            const isSelected = selectedDriver?.delivery_partner_id === item.delivery_partner_id;
            const name = p?.name || item.driver?.name || 'Driver';
            const status = item.delivery?.logistics_tracking_status || item.driver?.status || 'Online';
            const orderNum = item.delivery?.order?.order_number;
            return (
              <TouchableOpacity
                style={[styles.driverCard, isSelected && styles.driverCardSelected]}
                onPress={() => handleDriverPress(item)}
              >
                <Text style={styles.driverName}>🚚 {name}</Text>
                <Text style={styles.driverStatus}>Status: {status}</Text>
                {orderNum && <Text style={{ fontSize: 12, color: Colors.primaryDark, marginTop: 2 }}>Order: #{orderNum}</Text>}
                <Text style={styles.driverSpeed}>Speed: {item.speed || 0} km/h</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <AppHeader title="Logistics & Tracking" />
      <View style={styles.content}>
        {!IS_MOBILE && renderSidePanel()}
        <View style={styles.mapContainer}>
          <LiveMap
            drivers={drivers}
            onDriverPress={handleDriverPress}
            routeGeometry={routeGeometry}
            pickupLocation={pickupLocation}
            dropLocation={dropLocation}
          />
          {drivers.length === 0 && (
            <View style={styles.floatingNotice}>
              <Ionicons name="information-circle" size={16} color="#0369A1" />
              <Text style={styles.floatingNoticeText}>No drivers currently online. Map is active in standby mode.</Text>
            </View>
          )}
        </View>
        {IS_MOBILE && selectedDriver && (
          <View style={styles.mobileBottomPanel}>
            <Text style={styles.driverName}>🚚 {partners[selectedDriver.delivery_partner_id]?.name}</Text>
            <Text>Speed: {selectedDriver.speed} km/h</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedDriver(null)}>
              <Text style={{ color: 'white' }}>Close</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    flexDirection: IS_MOBILE ? 'column' : 'row',
  },
  mapContainer: {
    flex: 1,
  },
  sidePanel: {
    width: 320,
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    padding: 16,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: Colors.text,
  },
  driverCard: {
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  driverCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  driverName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  driverStatus: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  driverSpeed: {
    fontSize: 14,
    color: Colors.primary,
    marginTop: 4,
  },
  mobileBottomPanel: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  closeBtn: {
    marginTop: 10,
    padding: 10,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    alignItems: 'center',
  },
  floatingNotice: {
    position: 'absolute',
    bottom: 20,
    left: '50%',
    transform: [{ translateX: -150 }],
    width: 300,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    zIndex: 1000,
  },
  floatingNoticeText: {
    fontSize: 12,
    color: '#0369A1',
    fontWeight: '500',
  },
});
