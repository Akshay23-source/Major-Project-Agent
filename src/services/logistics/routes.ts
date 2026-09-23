/**
 * Service to handle route calculations and ETAs.
 * Future integration point for Mapbox/OSRM/Google Maps.
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface RouteResult {
  geometry?: any;
  distance: number; // in km
  eta: number; // in minutes
  status: 'SUCCESS' | 'UNAVAILABLE';
}

export const calculateRoute = async (origin: Coordinates, destination: Coordinates): Promise<RouteResult> => {
  try {
    // Note: To prevent fake data, we do not mock arbitrary coordinates.
    // In a real implementation, you would call an external API here (e.g. Mapbox Directions).
    // For now, we return 'UNAVAILABLE' to trigger graceful degradation in the UI.
    
    // Example future call:
    // const response = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?geometries=geojson&access_token=ENV.KEY`);
    // const data = await response.json();
    
    return {
      distance: 0,
      eta: 0,
      status: 'UNAVAILABLE',
    };
  } catch (error) {
    console.error("Route calculation error:", error);
    return { distance: 0, eta: 0, status: 'UNAVAILABLE' };
  }
};

export const calculateDistance = (origin: Coordinates, destination: Coordinates): number | null => {
  // Haversine formula for straight-line distance if routing is unavailable
  const toRad = (value: number) => (value * Math.PI) / 180;
  
  const R = 6371; // km
  const dLat = toRad(destination.lat - origin.lat);
  const dLng = toRad(destination.lng - origin.lng);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(origin.lat)) * Math.cos(toRad(destination.lat)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
            
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  
  return parseFloat(d.toFixed(2));
};

export const calculateETA = (distanceKm: number, speedKmH: number = 30): number => {
  if (distanceKm <= 0) return 0;
  const hours = distanceKm / speedKmH;
  return Math.round(hours * 60); // ETA in minutes
};
