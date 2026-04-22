/**
 * Footprint Generators — Create geographic polygon rings from metric dimensions.
 *
 * Used by PlaceGeometryTool to generate footprint polygons for 3D geometry extrusion.
 * All functions return closed rings as [[lon, lat], ...] arrays.
 */

const DEG2RAD = Math.PI / 180;

/** Meters to degrees longitude at a given latitude. */
function m2lon(meters: number, lat: number): number {
  return meters / (111320 * Math.cos(lat * DEG2RAD));
}

/** Meters to degrees latitude (roughly constant). */
function m2lat(meters: number): number {
  return meters / 110540;
}

/**
 * Rectangular footprint (Box-like shapes).
 * @param centerLon - Center longitude.
 * @param centerLat - Center latitude.
 * @param halfWidthM - Half-width in meters (east-west).
 * @param halfDepthM - Half-depth in meters (north-south).
 * @returns Closed polygon ring [[lon, lat], ...].
 */
export function makeRectFootprint(
  centerLon: number,
  centerLat: number,
  halfWidthM: number,
  halfDepthM: number,
): number[][] {
  const dLon = m2lon(halfWidthM, centerLat);
  const dLat = m2lat(halfDepthM);
  return [
    [centerLon - dLon, centerLat - dLat],
    [centerLon + dLon, centerLat - dLat],
    [centerLon + dLon, centerLat + dLat],
    [centerLon - dLon, centerLat + dLat],
    [centerLon - dLon, centerLat - dLat], // close
  ];
}

/**
 * Circular footprint (Cylinder, Sphere, Cone shapes).
 * @param centerLon - Center longitude.
 * @param centerLat - Center latitude.
 * @param radiusM - Radius in meters.
 * @param segments - Number of polygon segments (default 32).
 * @returns Closed polygon ring [[lon, lat], ...].
 */
export function makeCircleFootprint(
  centerLon: number,
  centerLat: number,
  radiusM: number,
  segments: number = 32,
): number[][] {
  const ring: number[][] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    ring.push([
      centerLon + m2lon(Math.cos(angle) * radiusM, centerLat),
      centerLat + m2lat(Math.sin(angle) * radiusM),
    ]);
  }
  return ring;
}

/**
 * Compute distance in meters between two lon/lat points (Haversine, simplified).
 */
export function distanceMeters(
  lon1: number, lat1: number,
  lon2: number, lat2: number,
): number {
  const dLon = (lon2 - lon1) * DEG2RAD;
  const dLat = (lat2 - lat1) * DEG2RAD;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * DEG2RAD) * Math.cos(lat2 * DEG2RAD) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
