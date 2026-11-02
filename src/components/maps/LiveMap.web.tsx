import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { DriverLocation } from '../../services/tracking';
import L from 'leaflet';

// Icons using reliable Leaflet standard CDN assets with distinct colors
// Green: Active delivering driver
const activeDriverIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Red: Available / Free driver (not currently delivering)
const freeDriverIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Gold/Yellow: Farm Pickup
const pickupIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Blue: Buyer Delivery Destination
const dropIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export interface LiveMapProps {
  drivers: DriverLocation[];
  onDriverPress?: (driver: DriverLocation) => void;
  routeGeometry?: { lat: number; lng: number }[];
  pickupLocation?: { lat: number; lng: number; label?: string };
  dropLocation?: { lat: number; lng: number; label?: string };
}

const formatRelativeTime = (isoString?: string) => {
  if (!isoString) return 'Unknown';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now (live)';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m ago`;
};

const isLocationStale = (isoString?: string) => {
  if (!isoString) return true;
  return Date.now() - new Date(isoString).getTime() > 180000; // > 3 minutes is stale
};

export const LiveMap: React.FC<LiveMapProps> = ({
  drivers,
  onDriverPress,
  routeGeometry,
  pickupLocation,
  dropLocation,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <View style={styles.fallbackContainer}>
        <Text>Loading Leaflet Map...</Text>
      </View>
    );
  }

  const initialRegion = {
    lat: drivers.length > 0 ? drivers[0].latitude : (pickupLocation?.lat || 20.5937),
    lng: drivers.length > 0 ? drivers[0].longitude : (pickupLocation?.lng || 78.9629),
  };

  return (
    <View style={styles.container}>
      <MapContainer
        center={[initialRegion.lat, initialRegion.lng]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Pickup Marker if available */}
        {pickupLocation && (
          <Marker position={[pickupLocation.lat, pickupLocation.lng]} icon={pickupIcon}>
            <Popup>
              <strong>📍 Pickup Location</strong>
              <br />
              {pickupLocation.label || 'Farm / Warehouse'}
            </Popup>
          </Marker>
        )}

        {/* Drop-off / Destination Marker if available */}
        {dropLocation && (
          <Marker position={[dropLocation.lat, dropLocation.lng]} icon={dropIcon}>
            <Popup>
              <strong>🏁 Destination</strong>
              <br />
              {dropLocation.label || 'Customer Delivery Address'}
            </Popup>
          </Marker>
        )}

        {/* Live Driver Markers */}
        {drivers.map((driver) => {
          const stale = isLocationStale(driver.recorded_at);
          const driverName = driver.driver?.name || `Driver ${driver.delivery_partner_id.slice(-6)}`;
          const orderNum = driver.delivery?.order?.order_number;
          const status = driver.delivery?.logistics_tracking_status || driver.driver?.status || 'Active';
          const isActive = !!driver.delivery_id;

          return (
            <Marker
              key={driver.id || driver.delivery_partner_id}
              position={[driver.latitude, driver.longitude]}
              icon={isActive ? activeDriverIcon : freeDriverIcon}
              eventHandlers={{
                click: () => onDriverPress && onDriverPress(driver),
              }}
            >
              <Popup>
                <div style={{ minWidth: 180, fontSize: 13, lineHeight: 1.4 }}>
                  <div style={{ fontWeight: 'bold', fontSize: 14, color: '#1E293B', marginBottom: 4 }}>
                    🚚 {driverName}
                  </div>
                  {driver.driver?.phone && (
                    <div style={{ color: '#64748B', fontSize: 12 }}>📞 {driver.driver.phone}</div>
                  )}
                  {driver.driver?.vehicle_number && (
                    <div style={{ color: '#64748B', fontSize: 12 }}>
                      🚗 {driver.driver.vehicle_number} ({driver.driver.vehicle_type || 'Vehicle'})
                    </div>
                  )}
                  <hr style={{ margin: '6px 0', border: 'none', borderTop: '1px solid #E2E8F0' }} />
                  {orderNum && (
                    <div style={{ marginBottom: 2 }}>
                      <strong>Order:</strong> #{orderNum}
                    </div>
                  )}
                  {driver.delivery?.order?.product && (
                    <div style={{ color: '#475569', fontSize: 12 }}>
                      📦 {driver.delivery.order.product}
                    </div>
                  )}
                  <div style={{ marginTop: 4 }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 10,
                        fontSize: 11,
                        fontWeight: 'bold',
                        backgroundColor: isActive ? '#DCFCE7' : '#FEE2E2',
                        color: isActive ? '#15803D' : '#B91C1C',
                      }}
                    >
                      {isActive ? `Delivering • ${status}` : 'Available'}
                    </span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: stale ? '#DC2626' : '#16A34A' }}>
                    {stale ? '⚠️ ' : '● '}
                    {formatRelativeTime(driver.recorded_at)}
                    {driver.speed ? ` • ${Math.round(driver.speed)} km/h` : ''}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Blue Route / Progress Line (Google Maps style) */}
        {routeGeometry && routeGeometry.length > 0 && (
          <Polyline
            positions={routeGeometry.map((coord) => [coord.lat, coord.lng])}
            color="#2563EB"
            weight={5}
            opacity={0.85}
          />
        )}
      </MapContainer>

      {/* Map Marker Legend */}
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
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
    position: 'relative',
  },
  legendOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 8,
    padding: 10,
    gap: 6,
    zIndex: 1000,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
  },
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
});

export default LiveMap;
