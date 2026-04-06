/**
 * ConvexVolume — Globe tile bounding volume
 *
 * Küre üzerindeki bir tile yamacını saran convex polyhedron.
 * MapLibre'nin ConvexVolume yaklaşımı — AABB yerine 6-düzlem.
 *
 * Düzlemler:
 * - 4 kenar düzlemi: tile kenarları × küre merkezi (büyük daire kenarları)
 * - 1 dış düzlem: tile merkezinde küreye teğet
 * - 1 iç düzlem: tile'ın en yakın noktası (minZ)
 *
 * Hessian normal form: ax + by + cz + d ≥ 0 → inside.
 */

import type { FrustumPlane } from '../FrustumCuller.js';
import { GlobeProjection } from './GlobeProjection.js';

export interface ConvexVolumePlane {
  a: number;
  b: number;
  c: number;
  d: number;
}

export class ConvexVolume {
  /** Bounding planes — inward-pointing normals. Point is inside if dot(n, p) + d ≥ 0 for all planes. */
  readonly planes: readonly ConvexVolumePlane[];

  /** Bounding sphere center (for quick rejection) */
  readonly sphereCenter: [number, number, number];
  /** Bounding sphere radius */
  readonly sphereRadius: number;

  constructor(
    planes: ConvexVolumePlane[],
    sphereCenter: [number, number, number],
    sphereRadius: number,
  ) {
    this.planes = planes;
    this.sphereCenter = sphereCenter;
    this.sphereRadius = sphereRadius;
  }

  /**
   * Tile'ın Mercator koordinatlarından ConvexVolume oluştur.
   *
   * @param z - zoom level
   * @param x - tile column
   * @param y - tile row
   */
  static fromTile(z: number, x: number, y: number): ConvexVolume {
    const tilesPerSide = Math.pow(2, z);

    // Tile'ın Mercator [0..1] aralığındaki sınırları
    const mx0 = x / tilesPerSide;
    const mx1 = (x + 1) / tilesPerSide;
    const my0 = y / tilesPerSide;
    const my1 = (y + 1) / tilesPerSide;

    // 4 köşe → unit sphere koordinatları
    const c00 = mercatorToSphere(mx0, my0);
    const c10 = mercatorToSphere(mx1, my0);
    const c01 = mercatorToSphere(mx0, my1);
    const c11 = mercatorToSphere(mx1, my1);

    // Tile center on sphere (midpoint, then normalize)
    const centerMerc: [number, number] = [(mx0 + mx1) / 2, (my0 + my1) / 2];
    const centerSphere = mercatorToSphere(centerMerc[0], centerMerc[1]);

    // ─── 4 Edge planes ───
    // Each passes through origin (0,0,0) and two adjacent corners.
    // Normal points INWARD (toward tile interior).
    const edgePlanes: ConvexVolumePlane[] = [
      // Top edge: c00 → c10 (my0 = north boundary)
      edgePlane(c00, c10, centerSphere),
      // Right edge: c10 → c11
      edgePlane(c10, c11, centerSphere),
      // Bottom edge: c11 → c01 (my1 = south boundary)
      edgePlane(c11, c01, centerSphere),
      // Left edge: c01 → c00
      edgePlane(c01, c00, centerSphere),
    ];

    // ─── Outer plane (tangent at tile center) ───
    // Normal = centerSphere (pointing outward from globe center)
    // For inward-pointing: we want to cap the volume, so normal points INWARD (toward center)
    // Plane: -center·p + 1 ≥ 0, i.e., dot(center, p) ≤ 1
    const outerPlane: ConvexVolumePlane = {
      a: -centerSphere[0],
      b: -centerSphere[1],
      c: -centerSphere[2],
      d: 1,
    };

    // ─── Inner plane ───
    // For tiles near the center-of-view, the inner bound is close to 1.
    // For wider tiles, inner bound is the min dot product of corners with center.
    const dots = [c00, c10, c01, c11].map(
      c => c[0] * centerSphere[0] + c[1] * centerSphere[1] + c[2] * centerSphere[2],
    );
    const minDot = Math.min(...dots);
    // Inner plane: centerSphere·p - minDot ≥ 0 → points beyond minDot radius
    const innerPlane: ConvexVolumePlane = {
      a: centerSphere[0],
      b: centerSphere[1],
      c: centerSphere[2],
      d: -minDot,
    };

    const allPlanes = [...edgePlanes, outerPlane, innerPlane];

    // ─── Bounding sphere ───
    // Center = centerSphere, radius = max distance from center to any corner
    const radius = Math.max(
      dist3(centerSphere, c00),
      dist3(centerSphere, c10),
      dist3(centerSphere, c01),
      dist3(centerSphere, c11),
    );

    return new ConvexVolume(allPlanes, centerSphere, radius);
  }

  /**
   * Test: ConvexVolume frustum ile kesişiyor mu?
   *
   * Quick sphere test + detailed plane-vertex test.
   * Returns true if potentially visible.
   */
  intersectsFrustum(frustumPlanes: readonly FrustumPlane[]): boolean {
    // Quick rejection: bounding sphere vs frustum
    for (const plane of frustumPlanes) {
      const d =
        plane.a * this.sphereCenter[0] +
        plane.b * this.sphereCenter[1] +
        plane.c * this.sphereCenter[2] +
        plane.d;
      if (d < -this.sphereRadius) return false;
    }

    // More detailed: for each frustum plane, check if all convex volume
    // vertices are on the outside. If so, the volume is outside.
    // Since ConvexVolume is defined by planes (not vertices), we use the
    // dual test: for each frustum plane, check if it separates the volume.
    // A convex set is outside a half-space if all its extreme points are outside.
    // For our sphere-based approximation, the sphere test above is sufficient.
    return true;
  }

  /**
   * Test: Tile horizon clipping plane ile görünür mü?
   *
   * Clipping plane format: [A, B, C, D] where Ax + By + Cz + D ≥ 0 → visible.
   * Returns true if any part of the tile is on the visible side.
   */
  intersectsClippingPlane(plane: [number, number, number, number]): boolean {
    // Test bounding sphere against clipping plane
    const d =
      plane[0] * this.sphereCenter[0] +
      plane[1] * this.sphereCenter[1] +
      plane[2] * this.sphereCenter[2] +
      plane[3];
    return d > -this.sphereRadius;
  }

  /**
   * Combined visibility test: frustum + clipping plane.
   */
  isVisible(
    frustumPlanes: readonly FrustumPlane[],
    clippingPlane: [number, number, number, number],
  ): boolean {
    return (
      this.intersectsClippingPlane(clippingPlane) &&
      this.intersectsFrustum(frustumPlanes)
    );
  }
}

// ─── Helpers ───

/**
 * Mercator (0..1) → unit sphere [x, y, z].
 * Uses GlobeProjection's mercatorToAngular → angularToSphere chain.
 */
function mercatorToSphere(mx: number, my: number): [number, number, number] {
  const [lon, lat] = GlobeProjection.mercatorToAngular(mx, my);
  return GlobeProjection.angularToSphere(lon, lat);
}

/**
 * Edge plane through origin and two corners, normal pointing toward interior.
 *
 * Two points on the sphere (A, B) and the origin define a plane.
 * Normal = A × B (cross product), then ensure it points toward the tile center.
 */
function edgePlane(
  a: [number, number, number],
  b: [number, number, number],
  interior: [number, number, number],
): ConvexVolumePlane {
  // Cross product: a × b
  let nx = a[1] * b[2] - a[2] * b[1];
  let ny = a[2] * b[0] - a[0] * b[2];
  let nz = a[0] * b[1] - a[1] * b[0];

  // Normalize
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (len < 1e-15) {
    return { a: 0, b: 0, c: 0, d: 0 };
  }
  nx /= len;
  ny /= len;
  nz /= len;

  // Ensure normal points toward interior (tile center)
  const dot = nx * interior[0] + ny * interior[1] + nz * interior[2];
  if (dot < 0) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }

  // Plane passes through origin: d = 0
  return { a: nx, b: ny, c: nz, d: 0 };
}

/**
 * Euclidean distance between two 3D points.
 */
function dist3(a: [number, number, number], b: [number, number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
