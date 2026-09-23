import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { DriverLocation } from '../../services/tracking';

export interface LiveMapProps {
  drivers: DriverLocation[];
  onDriverPress?: (driver: DriverLocation) => void;
  routeGeometry?: { lat: number, lng: number }[];
}

export const LiveMap: React.FC<LiveMapProps> = ({ drivers, onDriverPress, routeGeometry }) => {
  const [MapComponent, setMapComponent] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    try {
      // Dynamically require react-native-maps so that if the native module is missing
      // (e.g. in standard Expo Go), we catch the Invariant Violation error and show a fallback.
      const RNMaps = require('react-native-maps');
      if (isMounted) {
        setMapComponent({
          MapView: RNMaps.default,
          Marker: RNMaps.Marker,
          Polyline: RNMaps.Polyline,
        });
      }
    } catch (e: any) {
      if (isMounted) {
        setError(e.message || "Native map module unavailable");
      }
    }
    return () => { isMounted = false; };
  }, []);

  if (error) {
    return (
      <View style={styles.fallbackContainer}>
        <Text style={styles.fallbackTitle}>Live Map Unavailable</Text>
        <Text style={styles.fallbackText}>
          The native map module is not included in this build (Expo Go). 
        </Text>
        <Text style={styles.fallbackText}>
          Please use a custom development build to view the interactive map natively.
        </Text>
      </View>
    );
  }

  if (!MapComponent) {
    return (
      <View style={styles.fallbackContainer}>
        <Text style={styles.fallbackText}>Loading map...</Text>
      </View>
    );
  }

  const { MapView, Marker, Polyline } = MapComponent;

  const initialRegion = {
    latitude: drivers.length > 0 ? drivers[0].latitude : 20.5937,
    longitude: drivers.length > 0 ? drivers[0].longitude : 78.9629,
    latitudeDelta: 0.5,
    longitudeDelta: 0.5,
  };

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={initialRegion}>
        {drivers.map((driver) => (
          <Marker
            key={driver.id || driver.delivery_partner_id}
            coordinate={{ latitude: driver.latitude, longitude: driver.longitude }}
            title={`Driver ${driver.delivery_partner_id}`}
            description={driver.speed ? `${driver.speed} km/h` : 'Active'}
            onPress={() => onDriverPress && onDriverPress(driver)}
          />
        ))}
        {routeGeometry && routeGeometry.length > 0 && (
          <Polyline
            coordinates={routeGeometry.map(coord => ({ latitude: coord.lat, longitude: coord.lng }))}
            strokeColor="#059669"
            strokeWidth={4}
          />
        )}
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    margin: 10,
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  fallbackText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 4,
  }
});

export default LiveMap;
