/**
 * Route calculation service for logistics tracking map.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteResult {
  geometry?: {
    coordinates: [number, number][]; // [lon, lat] pairs (GeoJSON standard)
  };
  distance?: number;
  duration?: number;
}

/**
 * Calculates a driving route between two points using OSRM,
 * with graceful fallback to straight-line geometry.
 */
export async function calculateRoute(
  start: LatLng,
  end: LatLng | { lat?: number; lng?: number }
): Promise<RouteResult> {
  const endLat = end.lat ?? (start.lat + 0.05);
  const endLng = end.lng ?? (start.lng + 0.05);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    // OSRM expects lon,lat;lon,lat
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${endLng},${endLat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const json = await res.json();
      if (json.code === 'Ok' && json.routes?.[0]?.geometry?.coordinates) {
        return {
          geometry: {
            coordinates: json.routes[0].geometry.coordinates,
          },
          distance: json.routes[0].distance,
          duration: json.routes[0].duration,
        };
      }
    }
  } catch {
    // Offline or network error: fallback to straight line
  }

  // Fallback: 2-point straight line in [lon, lat] GeoJSON format
  return {
    geometry: {
      coordinates: [
        [start.lng, start.lat],
        [endLng, endLat],
      ],
    },
  };
}
