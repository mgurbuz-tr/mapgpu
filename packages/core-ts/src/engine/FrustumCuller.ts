/**
 * FrustumCuller — View frustum gorunurluk testi
 *
 * 6 frustum duzlemini view-projection matrisinden cikarir.
 * AABB (Axis-Aligned Bounding Box) ve sphere intersection testleri.
 * 3D tile/terrain culling icin kullanilir.
 */

// ─── Types ───

/**
 * A plane in Hessian normal form: ax + by + cz + d = 0
 * where (a, b, c) is the inward-pointing normal.
 */
export interface FrustumPlane {
  a: number;
  b: number;
  c: number;
  d: number;
}

/** The six frustum planes */
export interface FrustumPlanes {
  left: FrustumPlane;
  right: FrustumPlane;
  bottom: FrustumPlane;
  top: FrustumPlane;
  near: FrustumPlane;
  far: FrustumPlane;
}

/**
 * Axis-Aligned Bounding Box (AABB)
 */
export interface AABB {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

/** Intersection result */
export type IntersectResult = 'inside' | 'outside' | 'intersecting';

// ─── Helper: read mat4 elements into local vars ───

interface Mat4Elements {
  m0: number; m1: number; m2: number; m3: number;
  m4: number; m5: number; m6: number; m7: number;
  m8: number; m9: number; m10: number; m11: number;
  m12: number; m13: number; m14: number; m15: number;
}

function readMat4(m: Float32Array): Mat4Elements {
  return {
    m0: m[0] ?? 0, m1: m[1] ?? 0, m2: m[2] ?? 0, m3: m[3] ?? 0,
    m4: m[4] ?? 0, m5: m[5] ?? 0, m6: m[6] ?? 0, m7: m[7] ?? 0,
    m8: m[8] ?? 0, m9: m[9] ?? 0, m10: m[10] ?? 0, m11: m[11] ?? 0,
    m12: m[12] ?? 0, m13: m[13] ?? 0, m14: m[14] ?? 0, m15: m[15] ?? 0,
  };
}

// ─── FrustumCuller ───

export class FrustumCuller {
  private _planes: FrustumPlane[] = [];

  /**
   * Extract the 6 frustum planes from a combined view-projection matrix.
   * Matrix must be column-major (WebGPU/OpenGL convention).
   *
   * The planes point inward (a point is visible if it is on the positive side
   * of all six planes).
   */
  extractPlanes(viewProjectionMatrix: Float32Array): FrustumPlanes {
    const { m0, m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12, m13, m14, m15 } =
      readMat4(viewProjectionMatrix);

    // Row extraction from column-major matrix:
    // Row 0: m0,  m4,  m8,  m12
    // Row 1: m1,  m5,  m9,  m13
    // Row 2: m2,  m6,  m10, m14
    // Row 3: m3,  m7,  m11, m15

    // Left:   row3 + row0  (x ≥ -w)
    const left = normalizePlane({
      a: m3 + m0, b: m7 + m4, c: m11 + m8, d: m15 + m12,
    });

    // Right:  row3 - row0  (x ≤ w)
    const right = normalizePlane({
      a: m3 - m0, b: m7 - m4, c: m11 - m8, d: m15 - m12,
    });

    // Bottom: row3 + row1  (y ≥ -w)
    const bottom = normalizePlane({
      a: m3 + m1, b: m7 + m5, c: m11 + m9, d: m15 + m13,
    });

    // Top:    row3 - row1  (y ≤ w)
    const top = normalizePlane({
      a: m3 - m1, b: m7 - m5, c: m11 - m9, d: m15 - m13,
    });

    // Near:   row2 alone   (z ≥ 0) — WebGPU clip: 0 ≤ z, NOT -w ≤ z
    const near = normalizePlane({
      a: m2, b: m6, c: m10, d: m14,
    });

    // Far:    row3 - row2  (z ≤ w)
    const far = normalizePlane({
      a: m3 - m2, b: m7 - m6, c: m11 - m10, d: m15 - m14,
    });

    this._planes = [left, right, bottom, top, near, far];

    return { left, right, bottom, top, near, far };
  }

  /**
   * Test whether an AABB is visible within the frustum.
   * Returns 'inside', 'outside', or 'intersecting'.
   */
  isBoxVisible(bbox: AABB): IntersectResult {
    return testAABBFrustum(bbox, this._planes);
  }

  /**
   * Test whether a bounding sphere is visible within the frustum.
   * Returns 'inside', 'outside', or 'intersecting'.
   */
  isSphereVisible(
    center: [number, number, number],
    radius: number,
  ): IntersectResult {
    return testSphereFrustum(center, radius, this._planes);
  }

  /**
   * Get the currently cached planes (call extractPlanes first).
   */
  get planes(): readonly FrustumPlane[] {
    return this._planes;
  }
}

// ─── Standalone Functions ───

/**
 * Extract frustum planes from a view-projection matrix.
 * Can be used without constructing a FrustumCuller instance.
 *
 * Uses WebGPU clip space conventions:
 *   -w ≤ x ≤ w   (left/right)
 *   -w ≤ y ≤ w   (bottom/top)
 *    0 ≤ z ≤ w   (near/far — NOT [-w,w] like OpenGL)
 *
 * Near plane: z ≥ 0  →  row2  (NOT row3+row2 which is OpenGL's z ≥ -w)
 * Far plane:  z ≤ w  →  row3 - row2
 */
export function extractFrustumPlanes(
  viewProjectionMatrix: Float32Array,
): FrustumPlane[] {
  const { m0, m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12, m13, m14, m15 } =
    readMat4(viewProjectionMatrix);
  return [
    // Left:   row3 + row0  (x ≥ -w)
    normalizePlane({ a: m3 + m0, b: m7 + m4, c: m11 + m8, d: m15 + m12 }),
    // Right:  row3 - row0  (x ≤ w)
    normalizePlane({ a: m3 - m0, b: m7 - m4, c: m11 - m8, d: m15 - m12 }),
    // Bottom: row3 + row1  (y ≥ -w)
    normalizePlane({ a: m3 + m1, b: m7 + m5, c: m11 + m9, d: m15 + m13 }),
    // Top:    row3 - row1  (y ≤ w)
    normalizePlane({ a: m3 - m1, b: m7 - m5, c: m11 - m9, d: m15 - m13 }),
    // Near:   row2 alone   (z ≥ 0) — WebGPU clip: 0 ≤ z, NOT -w ≤ z
    normalizePlane({ a: m2, b: m6, c: m10, d: m14 }),
    // Far:    row3 - row2  (z ≤ w)
    normalizePlane({ a: m3 - m2, b: m7 - m6, c: m11 - m10, d: m15 - m14 }),
  ];
}

/**
 * Test an AABB against a set of frustum planes.
 */
export function testAABBFrustum(
  bbox: AABB,
  planes: readonly FrustumPlane[],
): IntersectResult {
  let allInside = true;

  for (const plane of planes) {
    // Find the positive vertex (p-vertex): the corner most in the direction of the plane normal
    const px = plane.a >= 0 ? bbox.maxX : bbox.minX;
    const py = plane.b >= 0 ? bbox.maxY : bbox.minY;
    const pz = plane.c >= 0 ? bbox.maxZ : bbox.minZ;

    // Find the negative vertex (n-vertex): the corner most against the plane normal
    const nx = plane.a >= 0 ? bbox.minX : bbox.maxX;
    const ny = plane.b >= 0 ? bbox.minY : bbox.maxY;
    const nz = plane.c >= 0 ? bbox.minZ : bbox.maxZ;

    // If the p-vertex is outside, the whole box is outside
    const pDist = plane.a * px + plane.b * py + plane.c * pz + plane.d;
    if (pDist < 0) return 'outside';

    // If the n-vertex is outside, the box intersects
    const nDist = plane.a * nx + plane.b * ny + plane.c * nz + plane.d;
    if (nDist < 0) allInside = false;
  }

  return allInside ? 'inside' : 'intersecting';
}

/**
 * Test a bounding sphere against a set of frustum planes.
 */
export function testSphereFrustum(
  center: [number, number, number],
  radius: number,
  planes: readonly FrustumPlane[],
): IntersectResult {
  let allInside = true;

  for (const plane of planes) {
    const dist = plane.a * center[0] + plane.b * center[1] + plane.c * center[2] + plane.d;

    if (dist < -radius) return 'outside';
    if (dist < radius) allInside = false;
  }

  return allInside ? 'inside' : 'intersecting';
}

// ─── Private Helpers ───

/**
 * Normalize a plane so that (a,b,c) is a unit vector.
 */
function normalizePlane(plane: FrustumPlane): FrustumPlane {
  const len = Math.sqrt(plane.a * plane.a + plane.b * plane.b + plane.c * plane.c);
  if (len < 1e-15) return plane;
  return {
    a: plane.a / len,
    b: plane.b / len,
    c: plane.c / len,
    d: plane.d / len,
  };
}
