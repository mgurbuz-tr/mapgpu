/**
 * geo-utils — Geographic geometry generators.
 */
import { EARTH_RADIUS, lonLatToMercator, mercatorToLonLat } from './coordinates.js';
import type { Geometry, Feature } from '../interfaces/index.js';

/**
 * Generate a circle polygon geometry via Haversine destination point calculation.
 * @param center - [longitude, latitude] in degrees
 * @param radiusMeters - radius in meters
 * @param segments - number of polygon segments (default 64)
 */
export function createCircleGeometry(
  center: [number, number],
  radiusMeters: number,
  segments = 64,
): Geometry {
  const [lon, lat] = center;
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;
  const angularDist = radiusMeters / EARTH_RADIUS;

  const coords: number[][] = [];
  for (let i = 0; i <= segments; i++) {
    const bearing = (2 * Math.PI * i) / segments;
    const destLat = Math.asin(
      Math.sin(latRad) * Math.cos(angularDist) +
      Math.cos(latRad) * Math.sin(angularDist) * Math.cos(bearing),
    );
    const destLon = lonRad + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDist) * Math.cos(latRad),
      Math.cos(angularDist) - Math.sin(latRad) * Math.sin(destLat),
    );
    coords.push([(destLon * 180) / Math.PI, (destLat * 180) / Math.PI]);
  }
  // Close the ring
  if (coords.length > 0) coords[coords.length - 1] = coords[0]!.slice();

  return { type: 'Polygon', coordinates: [coords] };
}

/**
 * Create range ring features for multiple radii around a center point.
 * @param center - [longitude, latitude] in degrees
 * @param radii - array of radius values in meters
 * @param segments - number of polygon segments per ring (default 64)
 */
export function createRangeRings(
  center: [number, number],
  radii: number[],
  segments = 64,
): Feature[] {
  return radii.map((r, i) => ({
    id: `range-ring-${i}`,
    geometry: createCircleGeometry(center, r, segments),
    attributes: { radius: r },
  }));
}

/* ------------------------------------------------------------------ */
/*  3D Rotation                                                        */
/* ------------------------------------------------------------------ */

const DEG2RAD = Math.PI / 180;

/**
 * Rotate a local ENU (east-north-up) offset by heading/pitch/roll using ZYX Euler order.
 *
 * @param x - East offset (metres).
 * @param y - North offset (metres).
 * @param z - Up offset (metres).
 * @param headingDeg - Yaw around Z axis (degrees, clockwise from north).
 * @param pitchDeg - Pitch around Y axis (degrees).
 * @param rollDeg - Roll around X axis (degrees).
 * @returns Rotated [east, north, up] offset in metres.
 */
export function rotateLocalOffset(
  x: number,
  y: number,
  z: number,
  headingDeg: number,
  pitchDeg: number,
  rollDeg: number,
): [number, number, number] {
  const h = headingDeg * DEG2RAD;
  const p = pitchDeg * DEG2RAD;
  const r = rollDeg * DEG2RAD;
  const ch = Math.cos(h), sh = Math.sin(h);
  const cp = Math.cos(p), sp = Math.sin(p);
  const cr = Math.cos(r), sr = Math.sin(r);
  return [
    ch * cp * x + (ch * sp * sr - sh * cr) * y + (ch * sp * cr + sh * sr) * z,
    sh * cp * x + (sh * sp * sr + ch * cr) * y + (sh * sp * cr - ch * sr) * z,
    -sp * x + cp * sr * y + cp * cr * z,
  ];
}

/* ------------------------------------------------------------------ */
/*  Frustum                                                            */
/* ------------------------------------------------------------------ */

/** A plane defined by inward-pointing normal and signed distance from origin. */
export interface GeoFrustumPlane {
  normal: [number, number, number];
  d: number;
}

/** Result of createFrustumGeo: corners, edges, and clipping planes. */
export interface FrustumGeoResult {
  /** 8 corner points [lon, lat, alt]. Near: 0-3, Far: 4-7. */
  corners: [number, number, number][];
  /** 12 edge pairs [cornerA, cornerB] for wireframe rendering. */
  edges: [number, number][];
  /** 6 frustum clipping planes in Mercator+alt space (inward normals). */
  planes: GeoFrustumPlane[];
  /** Frustum origin in Mercator+alt space [mx, my, alt] — used by pointInFrustum. */
  originMerc: [number, number, number];
}

/** Options for createFrustumGeo. */
export interface FrustumGeoOptions {
  /** Frustum origin [lon, lat, alt]. */
  center: [number, number, number];
  /** Heading in degrees (clockwise from north). */
  heading: number;
  /** Pitch in degrees. */
  pitch: number;
  /** Roll in degrees. */
  roll: number;
  /** Horizontal field-of-view in degrees. */
  fovH: number;
  /** Vertical field-of-view in degrees. */
  fovV: number;
  /** Near plane distance in metres. */
  near: number;
  /** Far plane distance in metres. */
  far: number;
}

/**
 * Generate a geographic frustum (truncated pyramid) for visualization and containment testing.
 *
 * The frustum extends forward (+Y in local ENU space) from the given center point,
 * rotated by heading/pitch/roll. Returns 8 geographic corner coordinates, 12 wireframe
 * edge pairs, and 6 clipping planes for `pointInFrustum()` testing.
 */
export function createFrustumGeo(options: FrustumGeoOptions): FrustumGeoResult {
  const { center, heading, pitch, roll, fovH, fovV, near, far } = options;
  const [originLon, originLat, originAlt] = center;

  // Half-dimensions of near/far planes
  const nearHalfW = near * Math.tan((fovH / 2) * DEG2RAD);
  const nearHalfH = near * Math.tan((fovV / 2) * DEG2RAD);
  const farHalfW = far * Math.tan((fovH / 2) * DEG2RAD);
  const farHalfH = far * Math.tan((fovV / 2) * DEG2RAD);

  // 8 corners in local ENU space (x=east, y=north, z=up).
  // rotateLocalOffset heading convention: positive heading rotates +Y toward -X (CCW in ENU).
  // computeBearing returns CW-from-north heading, so forward in rotated space = -Y local.
  // Near plane: indices 0-3, Far plane: indices 4-7
  const localCorners: [number, number, number][] = [
    [-nearHalfW, -near, -nearHalfH], // 0: near bottom-left
    [ nearHalfW, -near, -nearHalfH], // 1: near bottom-right
    [ nearHalfW, -near,  nearHalfH], // 2: near top-right
    [-nearHalfW, -near,  nearHalfH], // 3: near top-left
    [-farHalfW,  -far,  -farHalfH],  // 4: far bottom-left
    [ farHalfW,  -far,  -farHalfH],  // 5: far bottom-right
    [ farHalfW,  -far,   farHalfH],  // 6: far top-right
    [-farHalfW,  -far,   farHalfH],  // 7: far top-left
  ];

  // Rotate and project to geographic coordinates
  const [originMx, originMy] = lonLatToMercator(originLon, originLat);
  const corners: [number, number, number][] = [];
  const mercCorners: [number, number, number][] = [];

  for (const lc of localCorners) {
    const [east, north, up] = rotateLocalOffset(lc[0], lc[1], lc[2], heading, pitch, roll);
    const mx = originMx + east;
    const my = originMy + north;
    const alt = originAlt + up;
    mercCorners.push([mx, my, alt]);
    const [lon, lat] = mercatorToLonLat(mx, my);
    corners.push([lon, lat, alt]);
  }

  // 12 wireframe edges
  const edges: [number, number][] = [
    // Near plane
    [0, 1], [1, 2], [2, 3], [3, 0],
    // Far plane
    [4, 5], [5, 6], [6, 7], [7, 4],
    // Connectors
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];

  // 6 clipping planes in Mercator+alt space (inward-pointing normals)
  const planes = computeGeoFrustumPlanes(mercCorners);

  return { corners, edges, planes, originMerc: [originMx, originMy, originAlt] };
}

/** Compute a plane from 3 points (right-hand rule: inward normal). */
function planeFrom3Points(
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
): GeoFrustumPlane {
  const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
  const acx = c[0] - a[0], acy = c[1] - a[1], acz = c[2] - a[2];
  let nx = aby * acz - abz * acy;
  let ny = abz * acx - abx * acz;
  let nz = abx * acy - aby * acx;
  const len = Math.hypot(nx, ny, nz) || 1;
  nx /= len; ny /= len; nz /= len;
  const d = -(nx * a[0] + ny * a[1] + nz * a[2]);
  return { normal: [nx, ny, nz], d };
}

/**
 * Build 6 frustum planes from 8 Mercator+alt corners.
 * Winding order chosen so normals point inward.
 * Corners: near=[0,1,2,3], far=[4,5,6,7].
 */
function computeGeoFrustumPlanes(c: [number, number, number][]): GeoFrustumPlane[] {
  return [
    planeFrom3Points(c[0]!, c[1]!, c[2]!), // near   (0,1,2)
    planeFrom3Points(c[5]!, c[4]!, c[7]!), // far    (5,4,7)
    planeFrom3Points(c[4]!, c[0]!, c[3]!), // left   (4,0,3)
    planeFrom3Points(c[1]!, c[5]!, c[6]!), // right  (1,5,6)
    planeFrom3Points(c[3]!, c[2]!, c[6]!), // top    (3,2,6)
    planeFrom3Points(c[0]!, c[4]!, c[5]!), // bottom (0,4,5)
  ];
}

/**
 * Test whether a geographic point lies inside a frustum volume.
 *
 * The point is converted to the same Mercator+alt coordinate space as the frustum planes.
 * Returns true if the point is on the inward side of all 6 planes.
 *
 * @param point - [lon, lat, alt] to test.
 * @param planes - 6 frustum clipping planes from createFrustumGeo().
 */
export function pointInFrustum(
  point: [number, number, number],
  planes: GeoFrustumPlane[],
): boolean {
  const [mx, my] = lonLatToMercator(point[0], point[1]);
  const alt = point[2];
  for (const plane of planes) {
    const dist = plane.normal[0] * mx + plane.normal[1] * my + plane.normal[2] * alt + plane.d;
    if (dist < 0) return false;
  }
  return true;
}

/**
 * Test whether a geographic AABB intersects a frustum volume.
 *
 * Uses the p-vertex / n-vertex technique: for each frustum plane, find the
 * AABB corner most aligned with the plane normal (p-vertex). If the p-vertex
 * is on the negative side, the entire box is outside.
 *
 * @param center - [lon, lat] center of the AABB in degrees.
 * @param halfWidthMeters - half-width of the box in metres (east-west extent).
 * @param minAlt - minimum altitude in metres.
 * @param maxAlt - maximum altitude in metres.
 * @param planes - 6 frustum clipping planes from createFrustumGeo().
 * @returns 'inside' | 'outside' | 'intersecting'
 */
export function aabbInFrustum( // NOSONAR
  center: [number, number],
  halfWidthMeters: number,
  minAlt: number,
  maxAlt: number,
  planes: GeoFrustumPlane[],
): 'inside' | 'outside' | 'intersecting' {
  // Convert center to Mercator and compute AABB bounds in Mercator+alt space
  const [cx, cy] = lonLatToMercator(center[0], center[1]);
  // halfWidthMeters ≈ Mercator units at this latitude (for small extents this is close enough)
  const hw = halfWidthMeters;
  const minX = cx - hw, maxX = cx + hw;
  const minY = cy - hw, maxY = cy + hw;

  let allInside = true;
  for (const plane of planes) {
    const { normal, d } = plane;
    const [nx, ny, nz] = normal;

    // p-vertex: corner most in the direction of the normal
    const px = nx >= 0 ? maxX : minX;
    const py = ny >= 0 ? maxY : minY;
    const pz = nz >= 0 ? maxAlt : minAlt;

    // n-vertex: corner most against the normal
    const nvx = nx >= 0 ? minX : maxX;
    const nvy = ny >= 0 ? minY : maxY;
    const nvz = nz >= 0 ? minAlt : maxAlt;

    // If p-vertex is outside → entire box is outside this plane
    if (nx * px + ny * py + nz * pz + d < 0) return 'outside';

    // If n-vertex is outside → box is partially inside (intersecting)
    if (nx * nvx + ny * nvy + nz * nvz + d < 0) allInside = false;
  }

  return allInside ? 'inside' : 'intersecting';
}
