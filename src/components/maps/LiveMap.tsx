import React from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Colors } from '../../theme/colors';
import { DriverLocation } from '../../services/tracking';

export interface LiveMapProps {
  drivers: DriverLocation[];
  onDriverPress?: (driver: DriverLocation) => void;
  routeGeometry?: { lat: number; lng: number }[];
  pickupLocation?: { lat: number; lng: number; label?: string };
  dropLocation?: { lat: number; lng: number; label?: string };
}

/**
 * Native LiveMap component.
 * Uses react-native-maps when native maps are configured,
 * with a live status list fallback for Expo environments without native map keys.
 */
export const LiveMap: React.FC<LiveMapProps> = ({
  drivers,
  onDriverPress,
  routeGeometry,
  pickupLocation,
  dropLocation,
}) => {
  let MapViewComponent: any = null;
  let MarkerComponent: any = null;
  let PolylineComponent: any = null;

  try {
    const Maps = require('react-native-maps');
    MapViewComponent = Maps.default || Maps;
    MarkerComponent = Maps.Marker;
    PolylineComponent = Maps.Polyline;
  } catch {
    // react-native-maps not natively linked or running in standard web/fallback
  }

  const initialRegion = {
    latitude: drivers.length > 0 ? drivers[0].latitude : (pickupLocation?.lat || 20.5937),
    longitude: drivers.length > 0 ? drivers[0].longitude : (pickupLocation?.lng || 78.9629),
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };

  if (MapViewComponent && MarkerComponent) {
    return (
      <View style={styles.container}>
        <MapViewComponent style={StyleSheet.absoluteFill} initialRegion={initialRegion}>
          {pickupLocation && (
            <MarkerComponent
              coordinate={{ latitude: pickupLocation.lat, longitude: pickupLocation.lng }}
              title="📍 Pickup Location"
              description={pickupLocation.label || 'Farm / Warehouse'}
              pinColor="#EAB308"
            />
          )}

          {dropLocation && (
            <MarkerComponent
              coordinate={{ latitude: dropLocation.lat, longitude: dropLocation.lng }}
              title="🏁 Destination"
              description={dropLocation.label || 'Customer Delivery Address'}
              pinColor="#2563EB"
            />
          )}

          {drivers.map((driver) => {
            const name = driver.driver?.name || `Driver ${driver.delivery_partner_id.slice(-6)}`;
            const isAssigned = !!driver.delivery_id;
            return (
              <MarkerComponent
                key={driver.id || driver.delivery_partner_id}
                coordinate={{ latitude: driver.latitude, longitude: driver.longitude }}
                title={`🚚 ${name}`}
                description={`Speed: ${Math.round(driver.speed || 0)} km/h | Status: ${driver.delivery?.logistics_tracking_status || (isAssigned ? 'Delivering' : 'Available')}`}
                pinColor={isAssigned ? '#16A34A' : '#DC2626'}
                onPress={() => onDriverPress && onDriverPress(driver)}
              />
            );
          })}

          {routeGeometry && routeGeometry.length > 0 && PolylineComponent && (
            <PolylineComponent
              coordinates={routeGeometry.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
              strokeColor="#2563EB"
              strokeWidth={4}
            />
          )}
        </MapViewComponent>

        {/* Legend */}
        <View style={styles.legendOverlay}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#16A34A' }]} />
            <Text style={styles.legendText}>Active Delivering Driver</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#DC2626' }]} />
            <Text style={styles.legendText}>Available / Free Driver</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#EAB308' }]} />
            <Text style={styles.legendText}>Pickup (Farm)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#2563EB' }]} />
            <Text style={styles.legendText}>Destination (Buyer)</Text>
          </View>
        </View>
      </View>
    );
  }

  // Fallback if native maps is not available
  return (
    <View style={styles.container}>
      <View style={styles.fallbackHeader}>
        <Text style={styles.fallbackTitle}>📍 Active Driver Tracking</Text>
        <Text style={styles.fallbackSubtitle}>
          Full interactive map view is active on Web. Live coordinates shown below:
        </Text>
      </View>

      <ScrollView style={styles.driverList}>
        {drivers.map((driver) => {
          const name = driver.driver?.name || `Driver ${driver.delivery_partner_id.slice(-6)}`;
          return (
            <TouchableOpacity
              key={driver.id || driver.delivery_partner_id}
              style={styles.driverCard}
              onPress={() => onDriverPress && onDriverPress(driver)}
            >
              <View style={styles.driverRow}>
                <Text style={styles.driverCardName}>🚚 {name}</Text>
                <Text style={styles.driverCoord}>
                  {driver.latitude.toFixed(4)}, {driver.longitude.toFixed(4)}
                </Text>
              </View>
              <Text style={styles.driverDetails}>
                Speed: {Math.round(driver.speed || 0)} km/h • Status:{' '}
                {driver.delivery?.logistics_tracking_status || 'Online'}
              </Text>
              {driver.delivery?.order?.order_number && (
                <Text style={styles.orderNumber}>
                  Order: #{driver.delivery.order.order_number}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  legendOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 8,
    padding: 8,
    gap: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '500',
  },
  fallbackHeader: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  fallbackSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  driverList: {
    flex: 1,
    padding: 12,
  },
  driverCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  driverRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverCardName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  driverCoord: {
    fontSize: 12,
    color: '#6b7280',
  },
  driverDetails: {
    fontSize: 13,
    color: '#4b5563',
    marginTop: 4,
  },
  orderNumber: {
    fontSize: 12,
    color: Colors.primary,
    marginTop: 2,
    fontWeight: '500',
  },
});

export default LiveMap;
