/**
 * 3D Tiles bounding volumes: box, sphere, and region.
 *
 * Used for frustum culling and SSE (Screen-Space Error) calculation.
 */

/** Oriented bounding box: center (3) + half-axes (9) = 12 floats */
export interface BoundingBox {
  type: 'box';
  center: [number, number, number];
  halfAxes: [
    number, number, number, // X axis
    number, number, number, // Y axis
    number, number, number, // Z axis
  ];
}

/** Bounding sphere: center (3) + radius (1) = 4 floats */
export interface BoundingSphere {
  type: 'sphere';
  center: [number, number, number];
  radius: number;
}

/** Geographic region: west, south, east, north (radians) + min/max height (meters) */
export interface BoundingRegion {
  type: 'region';
  west: number;
  south: number;
  east: number;
  north: number;
  minHeight: number;
  maxHeight: number;
}

export type TileBoundingVolume = BoundingBox | BoundingSphere | BoundingRegion;

/** Parse a bounding volume from tileset.json */
export function parseBoundingVolume(raw: Record<string, unknown>): TileBoundingVolume | null {
  if (raw.box && Array.isArray(raw.box) && (raw.box as number[]).length === 12) {
    const b = raw.box as number[];
    return {
      type: 'box',
      center: [b[0]!, b[1]!, b[2]!],
      halfAxes: [b[3]!, b[4]!, b[5]!, b[6]!, b[7]!, b[8]!, b[9]!, b[10]!, b[11]!],
    };
  }
  if (raw.sphere && Array.isArray(raw.sphere) && (raw.sphere as number[]).length === 4) {
    const s = raw.sphere as number[];
    return {
      type: 'sphere',
      center: [s[0]!, s[1]!, s[2]!],
      radius: s[3]!,
    };
  }
  if (raw.region && Array.isArray(raw.region) && (raw.region as number[]).length === 6) {
    const r = raw.region as number[];
    return {
      type: 'region',
      west: r[0]!,
      south: r[1]!,
      east: r[2]!,
      north: r[3]!,
      minHeight: r[4]!,
      maxHeight: r[5]!,
    };
  }
  return null;
}

/** Compute the distance from a camera position to a bounding volume center. */
export function distanceToBoundingVolume(
  bv: TileBoundingVolume,
  cameraPos: [number, number, number],
): number {
  let cx: number, cy: number, cz: number;

  if (bv.type === 'box' || bv.type === 'sphere') {
    [cx, cy, cz] = bv.center;
  } else {
    // Region: approximate center in cartesian
    const lonMid = (bv.west + bv.east) / 2;
    const latMid = (bv.south + bv.north) / 2;
    const hMid = (bv.minHeight + bv.maxHeight) / 2;
    const R = 6378137;
    const cosLat = Math.cos(latMid);
    cx = (R + hMid) * cosLat * Math.cos(lonMid);
    cy = (R + hMid) * cosLat * Math.sin(lonMid);
    cz = (R + hMid) * Math.sin(latMid);
  }

  const dx = cameraPos[0] - cx;
  const dy = cameraPos[1] - cy;
  const dz = cameraPos[2] - cz;
  return Math.hypot(dx, dy, dz);
}
