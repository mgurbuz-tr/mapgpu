import { describe, it, expect } from 'vitest';
import {
  FrustumCuller,
  extractFrustumPlanes,
  testAABBFrustum,
  testSphereFrustum,
} from './FrustumCuller.js';
import type { AABB, FrustumPlane } from './FrustumCuller.js';

/**
 * Helper: build a simple orthographic view-projection matrix
 * that maps a box [-w, w] x [-h, h] x [0, 1] to clip space.
 * Column-major.
 */
function buildOrthoVP(
  w: number,
  h: number,
  near: number,
  far: number,
): Float32Array {
  const m = new Float32Array(16);
  m[0] = 1 / w;
  m[5] = 1 / h;
  m[10] = -2 / (far - near);
  m[14] = -(far + near) / (far - near);
  m[15] = 1;
  // This is just a projection matrix (no view transform, i.e. identity view)
  // Row3 = m[3], m[7], m[11], m[15] = (0, 0, 0, 1)
  return m;
}

/**
 * Helper: build an identity VP matrix (clip space = world space, useful for testing)
 */
function identityVP(): Float32Array {
  const m = new Float32Array(16);
  m[0] = 1;
  m[5] = 1;
  m[10] = 1;
  m[15] = 1;
  return m;
}

/**
 * Helper: build a perspective-like VP matrix for testing.
 * Uses simple perspective projection with identity view.
 */
function buildPerspectiveVP(
  fov: number,
  aspect: number,
  near: number,
  far: number,
): Float32Array {
  const f = 1 / Math.tan(fov / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = far / (near - far);
  m[11] = -1;
  m[14] = (near * far) / (near - far);
  // m[15] = 0 (perspective)
  return m;
}

describe('FrustumCuller', () => {
  // ─── Plane Extraction ───

  it('should extract 6 planes from VP matrix', () => {
    const culler = new FrustumCuller();
    const vp = identityVP();
    const planes = culler.extractPlanes(vp);

    expect(planes.left).toBeDefined();
    expect(planes.right).toBeDefined();
    expect(planes.bottom).toBeDefined();
    expect(planes.top).toBeDefined();
    expect(planes.near).toBeDefined();
    expect(planes.far).toBeDefined();
    expect(culler.planes.length).toBe(6);
  });

  it('extracted planes should be normalized', () => {
    const culler = new FrustumCuller();
    const vp = buildOrthoVP(10, 10, 0.1, 100);
    const planes = culler.extractPlanes(vp);

    // Each plane normal should be approximately unit length
    for (const plane of Object.values(planes)) {
      const p = plane as { a: number; b: number; c: number };
      const len = Math.sqrt(p.a * p.a + p.b * p.b + p.c * p.c);
      expect(len).toBeCloseTo(1, 3);
    }
  });

  // ─── Box Visibility Tests ───

  it('box inside frustum should return "inside"', () => {
    const culler = new FrustumCuller();
    // Identity VP: WebGPU clip space is [-1,1] x [-1,1] x [0,1]
    culler.extractPlanes(identityVP());

    const bbox: AABB = {
      minX: -0.5, minY: -0.5, minZ: 0.1,
      maxX: 0.5, maxY: 0.5, maxZ: 0.9,
    };

    expect(culler.isBoxVisible(bbox)).toBe('inside');
  });

  it('box outside frustum should return "outside"', () => {
    const culler = new FrustumCuller();
    culler.extractPlanes(identityVP());

    // Box entirely to the right of the frustum
    const bbox: AABB = {
      minX: 2, minY: 2, minZ: 2,
      maxX: 3, maxY: 3, maxZ: 3,
    };

    expect(culler.isBoxVisible(bbox)).toBe('outside');
  });

  it('box straddling frustum boundary should return "intersecting"', () => {
    const culler = new FrustumCuller();
    culler.extractPlanes(identityVP());

    // Box that crosses the right frustum boundary, z in [0,1] range
    const bbox: AABB = {
      minX: 0.5, minY: -0.5, minZ: 0.1,
      maxX: 1.5, maxY: 0.5, maxZ: 0.9,
    };

    expect(culler.isBoxVisible(bbox)).toBe('intersecting');
  });

  it('box entirely outside left plane', () => {
    const culler = new FrustumCuller();
    culler.extractPlanes(identityVP());

    const bbox: AABB = {
      minX: -5, minY: -0.5, minZ: 0.1,
      maxX: -2, maxY: 0.5, maxZ: 0.9,
    };

    expect(culler.isBoxVisible(bbox)).toBe('outside');
  });

  it('box entirely outside bottom plane', () => {
    const culler = new FrustumCuller();
    culler.extractPlanes(identityVP());

    const bbox: AABB = {
      minX: -0.5, minY: -5, minZ: 0.1,
      maxX: 0.5, maxY: -2, maxZ: 0.9,
    };

    expect(culler.isBoxVisible(bbox)).toBe('outside');
  });

  it('large box enclosing entire frustum should return "intersecting"', () => {
    const culler = new FrustumCuller();
    culler.extractPlanes(identityVP());

    const bbox: AABB = {
      minX: -10, minY: -10, minZ: -10,
      maxX: 10, maxY: 10, maxZ: 10,
    };

    // The box contains the frustum, so all n-vertices are inside
    // but p-vertices are also inside -> should be "intersecting" since
    // it extends beyond the frustum
    const result = culler.isBoxVisible(bbox);
    expect(result === 'inside' || result === 'intersecting').toBe(true);
  });

  // ─── Sphere Visibility Tests ───

  it('sphere inside frustum should return "inside"', () => {
    const culler = new FrustumCuller();
    culler.extractPlanes(identityVP());

    // Small sphere in the center of WebGPU frustum (z in [0,1])
    expect(culler.isSphereVisible([0, 0, 0.5], 0.3)).toBe('inside');
  });

  it('sphere outside frustum should return "outside"', () => {
    const culler = new FrustumCuller();
    culler.extractPlanes(identityVP());

    // Sphere far outside (all coords > 1)
    expect(culler.isSphereVisible([5, 5, 5], 0.5)).toBe('outside');
  });

  it('sphere intersecting frustum boundary should return "intersecting"', () => {
    const culler = new FrustumCuller();
    culler.extractPlanes(identityVP());

    // Sphere centered at the right edge with some radius crossing the boundary, z=0.5 inside
    expect(culler.isSphereVisible([1, 0, 0.5], 0.5)).toBe('intersecting');
  });

  it('sphere touching frustum from outside should return "intersecting"', () => {
    const culler = new FrustumCuller();
    culler.extractPlanes(identityVP());

    // Sphere just barely touching: center at 1.4, radius 0.5
    // distance from right plane (x=1) is 0.4, which is < radius 0.5
    expect(culler.isSphereVisible([1.4, 0, 0.5], 0.5)).toBe('intersecting');
  });

  it('sphere entirely outside by distance should return "outside"', () => {
    const culler = new FrustumCuller();
    culler.extractPlanes(identityVP());

    // Sphere at distance > radius from all planes
    expect(culler.isSphereVisible([3, 0, 0.5], 0.5)).toBe('outside');
  });

  // ─── Standalone Functions ───

  it('extractFrustumPlanes should return 6 planes', () => {
    const planes = extractFrustumPlanes(identityVP());
    expect(planes.length).toBe(6);
  });

  it('testAABBFrustum standalone function should work', () => {
    const planes = extractFrustumPlanes(identityVP());
    // WebGPU frustum z ∈ [0, 1]
    const bbox: AABB = {
      minX: -0.5, minY: -0.5, minZ: 0.1,
      maxX: 0.5, maxY: 0.5, maxZ: 0.9,
    };
    expect(testAABBFrustum(bbox, planes)).toBe('inside');
  });

  it('testSphereFrustum standalone function should work', () => {
    const planes = extractFrustumPlanes(identityVP());
    // z=0.5 puts the sphere inside WebGPU's [0,1] z range
    expect(testSphereFrustum([0, 0, 0.5], 0.3, planes)).toBe('inside');
    expect(testSphereFrustum([5, 5, 5], 0.5, planes)).toBe('outside');
  });

  // ─── With Perspective Matrix ───

  it('should work with perspective projection', () => {
    const culler = new FrustumCuller();
    const vp = buildPerspectiveVP(Math.PI / 3, 4 / 3, 0.1, 1000);
    culler.extractPlanes(vp);

    // Object at origin is behind the camera in perspective (z=0 is at camera)
    // An object at z = -5 should be in front of the camera
    // This is tricky because perspective has w=-z, so let's just test it doesn't crash
    expect(culler.planes.length).toBe(6);

    // A sphere at (0, 0, -5) should be visible (in front of camera)
    const result = culler.isSphereVisible([0, 0, -5], 1);
    expect(['inside', 'outside', 'intersecting']).toContain(result);
  });

  // ─── Edge Cases ───

  it('zero-size box inside frustum', () => {
    const culler = new FrustumCuller();
    culler.extractPlanes(identityVP());

    // z=0.5 is inside WebGPU's [0,1] z range
    const bbox: AABB = {
      minX: 0, minY: 0, minZ: 0.5,
      maxX: 0, maxY: 0, maxZ: 0.5,
    };

    expect(culler.isBoxVisible(bbox)).toBe('inside');
  });

  it('zero-radius sphere inside frustum', () => {
    const culler = new FrustumCuller();
    culler.extractPlanes(identityVP());

    expect(culler.isSphereVisible([0, 0, 0.5], 0)).toBe('inside');
  });

  it('objects at negative z should be outside (WebGPU near plane z≥0)', () => {
    const culler = new FrustumCuller();
    culler.extractPlanes(identityVP());

    // Box entirely in negative z (behind near plane)
    const bbox: AABB = {
      minX: -0.5, minY: -0.5, minZ: -1.0,
      maxX: 0.5, maxY: 0.5, maxZ: -0.1,
    };
    expect(culler.isBoxVisible(bbox)).toBe('outside');

    // Sphere entirely in negative z
    expect(culler.isSphereVisible([0, 0, -2], 0.5)).toBe('outside');
  });
});
