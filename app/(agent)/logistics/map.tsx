import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity } from 'react-native';
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
  const [routeGeometry, setRouteGeometry] = useState<{lat: number, lng: number}[]>([]);

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
    
    // Simulate fetching destination and drawing a route
    try {
      const destination = { lat: driver.latitude + 0.05, lng: driver.longitude + 0.05 };
      const route = await calculateRoute(
        { lat: driver.latitude, lng: driver.longitude },
        destination
      );
      
      // Decode OSRM geometry or parse GeoJSON
      // For simplicity, we just use a straight line if we can't parse polyline easily in this basic setup
      // A full app would use a polyline decoding library like @mapbox/polyline
      const geometry = route.geometry as any;
      if (geometry && typeof geometry === 'object' && geometry.coordinates) {
        const coords = geometry.coordinates.map((c: any) => ({ lat: c[1], lng: c[0] }));
        setRouteGeometry(coords);
      } else {
        setRouteGeometry([
          { lat: driver.latitude, lng: driver.longitude },
          destination
        ]);
      }
    } catch (error) {
      console.error("Route calc failed", error);
    }
  };

  const renderSidePanel = () => (
    <View style={styles.sidePanel}>
      <Text style={styles.panelTitle}>Active Deliveries</Text>
      {drivers.length === 0 ? (
        <Text style={{color: Colors.textSecondary, marginTop: 10}}>No active deliveries.</Text>
      ) : (
        <FlatList
          data={drivers}
          keyExtractor={(item) => item.delivery_partner_id}
          renderItem={({ item }) => {
            const p = partners[item.delivery_partner_id];
            const isSelected = selectedDriver?.delivery_partner_id === item.delivery_partner_id;
            return (
              <TouchableOpacity 
                style={[styles.driverCard, isSelected && styles.driverCardSelected]}
                onPress={() => handleDriverPress(item)}
              >
                <Text style={styles.driverName}>🚚 {p?.name || 'Unknown Driver'}</Text>
                <Text style={styles.driverStatus}>Status: In Transit</Text>
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
          {drivers.length === 0 ? (
            <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
              <Text style={{fontSize: 18, color: Colors.textSecondary, fontWeight: 'bold'}}>No live driver locations</Text>
              <Text style={{fontSize: 14, color: Colors.textSecondary, marginTop: 8}}>No active deliveries or drivers currently online.</Text>
            </View>
          ) : (
            <LiveMap 
              drivers={drivers} 
              onDriverPress={handleDriverPress}
              routeGeometry={routeGeometry}
            />
          )}
        </View>
        {IS_MOBILE && selectedDriver && (
          <View style={styles.mobileBottomPanel}>
            <Text style={styles.driverName}>🚚 {partners[selectedDriver.delivery_partner_id]?.name}</Text>
            <Text>Speed: {selectedDriver.speed} km/h</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedDriver(null)}>
              <Text style={{color: 'white'}}>Close</Text>
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
  }
});
