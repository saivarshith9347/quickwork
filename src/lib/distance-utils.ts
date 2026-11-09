/**
 * Distance & Location Utility for QuickWork.
 * Provides coordinate mapping for Hyderabad areas, distance calculation using Haversine formula,
 * and location formatting for job listings.
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

// Known coordinates for Hyderabad business and event hubs
export const HYDERABAD_AREA_COORDINATES: Record<string, Coordinates> = {
  gachibowli: { lat: 17.4401, lng: 78.3489 },
  madhapur: { lat: 17.4483, lng: 78.3915 },
  hitec_city: { lat: 17.4435, lng: 78.3772 },
  kondapur: { lat: 17.4705, lng: 78.3752 },
  manikonda: { lat: 17.4042, lng: 78.3776 },
  nanakramguda: { lat: 17.4168, lng: 78.3428 },
  financial_district: { lat: 17.418, lng: 78.345 },
  shamshabad: { lat: 17.2543, lng: 78.4312 },
  uppal: { lat: 17.4057, lng: 78.563 },
  kukatpally: { lat: 17.4933, lng: 78.3995 },
  banjara_hills: { lat: 17.4156, lng: 78.4352 },
  jubilee_hills: { lat: 17.4319, lng: 78.4073 },
  begumpet: { lat: 17.4447, lng: 78.4664 },
  secunderabad: { lat: 17.4399, lng: 78.4983 },
  ameerpet: { lat: 17.4375, lng: 78.4482 },
  somajiguda: { lat: 17.4265, lng: 78.4583 },
};

// Default reference location for workers in Hyderabad (central tech & event district)
export const DEFAULT_WORKER_LOCATION: Coordinates = {
  lat: 17.4445,
  lng: 78.3685, // Near Hitec City / Gachibowli border
};

/**
 * Calculate distance between two coordinates using the Haversine formula (km)
 */
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10; // 1 decimal place
}

/**
 * Find coordinates for an area or address string
 */
export function getCoordinatesForArea(areaOrLocation: string): Coordinates | null {
  if (!areaOrLocation) return null;
  const clean = areaOrLocation
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_");

  for (const [key, coords] of Object.entries(HYDERABAD_AREA_COORDINATES)) {
    if (clean.includes(key) || key.includes(clean)) {
      return coords;
    }
  }

  // Common aliases
  if (clean.includes("gachi")) return HYDERABAD_AREA_COORDINATES["gachibowli"] ?? null;
  if (clean.includes("hicc") || clean.includes("konda"))
    return HYDERABAD_AREA_COORDINATES["kondapur"] ?? null;
  if (clean.includes("airport") || clean.includes("novotel"))
    return HYDERABAD_AREA_COORDINATES["shamshabad"] ?? null;
  if (clean.includes("phoenix") || clean.includes("mani"))
    return HYDERABAD_AREA_COORDINATES["manikonda"] ?? null;

  return null;
}

/**
 * Format distance number for display (e.g. "2.4 km away" or "800 m away")
 */
export function formatDistance(km: number | null | undefined): string | null {
  if (km == null || isNaN(km)) return null;
  if (km < 1) {
    const meters = Math.round(km * 1000);
    return `${meters} m away`;
  }
  return `${km.toFixed(1)} km away`;
}

/**
 * Get distance string between worker and a job area/coordinates
 */
export function getDistanceToJob(
  area: string,
  mapCoordinates?: { latitude: number; longitude: number } | null,
  workerLocation: Coordinates = DEFAULT_WORKER_LOCATION,
): { distanceKm: number | null; distanceDisplay: string | null } {
  let targetCoords: Coordinates | null = null;

  if (mapCoordinates && mapCoordinates.latitude && mapCoordinates.longitude) {
    targetCoords = { lat: mapCoordinates.latitude, lng: mapCoordinates.longitude };
  } else {
    targetCoords = getCoordinatesForArea(area);
  }

  if (!targetCoords) {
    return { distanceKm: null, distanceDisplay: null };
  }

  const distanceKm = calculateDistance(
    workerLocation.lat,
    workerLocation.lng,
    targetCoords.lat,
    targetCoords.lng,
  );

  return {
    distanceKm,
    distanceDisplay: formatDistance(distanceKm),
  };
}
