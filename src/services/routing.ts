export interface Coordinates {
  lat: number;
  lng: number;
}

export interface RouteResult {
  distance: number; // in meters
  duration: number; // in seconds
  geometry: string; // Polyline string or coordinates array
}

/**
 * Calculates a route between pickup and drop using the public OSRM API.
 * In a production environment, you should self-host OSRM, use Mapbox, or Google Routes API.
 */
export const calculateRoute = async (pickup: Coordinates, drop: Coordinates): Promise<RouteResult> => {
  try {
    // OSRM expects longitude,latitude format
    const url = `https://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${drop.lng},${drop.lat}?overview=full&geometries=geojson`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OSRM API error: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error('No route found');
    }

    const route = data.routes[0];

    return {
      distance: route.distance,
      duration: route.duration,
      geometry: route.geometry, // This will be a GeoJSON object with { type: 'LineString', coordinates: [[lng, lat], ...] }
    };
  } catch (error) {
    console.error("Error calculating route:", error);
    throw error;
  }
};
