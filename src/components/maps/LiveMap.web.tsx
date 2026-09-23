import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { DriverLocation } from '../../services/tracking';
import L from 'leaflet';

// Use external URLs for Leaflet markers to avoid bundler image loader issues in Expo Web
const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export interface LiveMapProps {
  drivers: DriverLocation[];
  onDriverPress?: (driver: DriverLocation) => void;
  routeGeometry?: { lat: number, lng: number }[];
}

export const LiveMap: React.FC<LiveMapProps> = ({ drivers, onDriverPress, routeGeometry }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <View style={styles.fallbackContainer}><Text>Loading map...</Text></View>;
  }

  const initialRegion = {
    lat: drivers.length > 0 ? drivers[0].latitude : 20.5937,
    lng: drivers.length > 0 ? drivers[0].longitude : 78.9629,
  };

  return (
    <View style={styles.container}>
      <MapContainer 
        center={[initialRegion.lat, initialRegion.lng]} 
        zoom={12} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {drivers.map((driver) => (
          <Marker 
            key={driver.id || driver.delivery_partner_id} 
            position={[driver.latitude, driver.longitude]}
            icon={customIcon}
            eventHandlers={{
              click: () => onDriverPress && onDriverPress(driver)
            }}
          >
            <Popup>
              Driver {driver.delivery_partner_id} <br/>
              {driver.speed ? `${driver.speed} km/h` : 'Active'}
            </Popup>
          </Marker>
        ))}
        {routeGeometry && routeGeometry.length > 0 && (
          <Polyline 
            positions={routeGeometry.map(coord => [coord.lat, coord.lng])} 
            color="#059669" 
            weight={4} 
          />
        )}
      </MapContainer>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
  },
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  }
});

export default LiveMap;
