/**
 * FootprintMeshGenerator — Generate 3D meshes directly from footprint polygon rings.
 *
 * The key insight: footprint preview polygon and 3D mesh use the SAME ring coordinates.
 * No unit mesh + transform — the mesh IS the footprint extruded into 3D.
 *
 * Outputs vertices in Mercator [0..1] XY + height(m) Z — same as extrusion pipeline.
 */

import { lonLatToMercator, EARTH_RADIUS } from './coordinates.js';
import type { Mesh3DVertexData } from './Mesh3DConverter.js';

const HALF_CIRC = EARTH_RADIUS * Math.PI;

/** Shared vertex writer — avoids duplicating pushVert in cone/hemisphere generators. */
function writeVertex( // NOSONAR — low-level vertex writer, splitting params would harm readability
  verts: Float32Array,
  vi: number,
  x: number, y: number, z: number,
  nx: number, ny: number, nz: number,
): void {
  verts[vi * 6 + 0] = x;
  verts[vi * 6 + 1] = y;
  verts[vi * 6 + 2] = z;
  verts[vi * 6 + 3] = nx;
  verts[vi * 6 + 4] = ny;
  verts[vi * 6 + 5] = nz;
}

/** Convert [lon,lat] → Mercator [0..1]. */
function toMerc01(lon: number, lat: number): [number, number] {
  const [mx, my] = lonLatToMercator(lon, lat);
  return [
    (mx + HALF_CIRC) / (2 * HALF_CIRC),
    1 - (my + HALF_CIRC) / (2 * HALF_CIRC),
  ];
}

/* ------------------------------------------------------------------ */
/*  Cone                                                               */
/* ------------------------------------------------------------------ */

/**
 * Generate a cone mesh from a footprint polygon ring.
 *
 * - Base ring at Z=0 (the footprint)
 * - Apex at center + Z=height
 * - Side triangles connecting ring edges to apex
 * - Base disk cap
 *
 * @param ring - Closed footprint ring [[lon,lat], ...] (last = first)
 * @param centerLonLat - Center point [lon, lat]
 * @param heightM - Cone height in metres
 */
export function createConeFromFootprint(
  ring: number[][],
  centerLonLat: [number, number],
  heightM: number,
): Mesh3DVertexData {
  // Remove closing vertex if ring is closed
  const n = (ring.length > 1 && ring[0]![0] === ring.at(-1)![0] && ring[0]![1] === ring.at(-1)![1])
    ? ring.length - 1
    : ring.length;

  const [cx, cy] = toMerc01(centerLonLat[0], centerLonLat[1]);

  // Convert ring to Merc01
  const ringM: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    ringM.push(toMerc01(ring[i]![0]!, ring[i]![1]!));
  }

  // Vertices: ring (n) + apex (1) + base center (1) + base ring (n)
  // Side faces: n triangles, Base faces: n triangles
  const vertCount = n + 1 + 1 + n; // side ring + apex + base center + base ring
  const triCount = n + n;
  const verts = new Float32Array(vertCount * 6);
  const indices = new Uint32Array(triCount * 3);
  let vi = 0, ii = 0;

  function pushVert(x: number, y: number, z: number, nx: number, ny: number, nz: number) {
    const idx = vi;
    writeVertex(verts, vi, x, y, z, nx, ny, nz);
    vi++;
    return idx;
  }

  // ─── Side surface ───
  // Ring vertices at Z=0 with outward-sloping normals
  const sideStart = vi;
  for (let i = 0; i < n; i++) {
    const [rx, ry] = ringM[i]!;
    // Normal: direction from center outward + upward component
    const dx = rx - cx;
    const dy = ry - cy;
    const dLen = Math.hypot(dx, dy) || 1;
    // Cone slope normal: outward + height component
    const slopeAngle = Math.atan2(heightM, dLen * 2 * HALF_CIRC); // approximate
    const cosS = Math.cos(slopeAngle);
    const sinS = Math.sin(slopeAngle);
    pushVert(rx, ry, 0, (dx / dLen) * cosS, (dy / dLen) * cosS, sinS);
  }

  // Apex vertex
  const apexIdx = pushVert(cx, cy, heightM, 0, 0, 1);

  // Side triangles: ring[i] → ring[i+1] → apex
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    indices[ii++] = sideStart + i;
    indices[ii++] = sideStart + next;
    indices[ii++] = apexIdx;
  }

  // ─── Base cap ───
  const baseCenterIdx = pushVert(cx, cy, 0, 0, 0, -1);
  const baseRingStart = vi;
  for (let i = 0; i < n; i++) {
    const [rx, ry] = ringM[i]!;
    pushVert(rx, ry, 0, 0, 0, -1);
  }

  // Base triangles (reversed winding — faces down)
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    indices[ii++] = baseCenterIdx;
    indices[ii++] = baseRingStart + next;
    indices[ii++] = baseRingStart + i;
  }

  return { vertices: verts, indices, indexCount: ii };
}

/* ------------------------------------------------------------------ */
/*  Hemisphere                                                         */
/* ------------------------------------------------------------------ */

/**
 * Generate a hemisphere dome mesh from a footprint polygon ring.
 *
 * - Equator ring at Z=0 (the footprint)
 * - Dome layers rising from equator to pole
 * - Each layer = footprint ring scaled inward toward center
 * - Smooth normals via per-vertex averaging
 * - Base disk cap
 *
 * @param ring - Closed footprint ring [[lon,lat], ...] (last = first)
 * @param centerLonLat - Center point [lon, lat]
 * @param heightM - Dome height (= radius for true hemisphere)
 * @param layers - Number of dome layers (default 12)
 */
export function createHemisphereFromFootprint(
  ring: number[][],
  centerLonLat: [number, number],
  heightM: number,
  layers: number = 12,
): Mesh3DVertexData {
  const n = (ring.length > 1 && ring[0]![0] === ring.at(-1)![0] && ring[0]![1] === ring.at(-1)![1])
    ? ring.length - 1
    : ring.length;

  const [cx, cy] = toMerc01(centerLonLat[0], centerLonLat[1]);

  const ringM: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    ringM.push(toMerc01(ring[i]![0]!, ring[i]![1]!));
  }

  // Direction vectors from center to each ring point
  const dirs: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const dx = ringM[i]![0] - cx;
    const dy = ringM[i]![1] - cy;
    const len = Math.hypot(dx, dy) || 1;
    dirs.push([dx / len, dy / len, len]); // [unitX, unitY, distance]
  }

  // Total vertices: (layers+1) * n (dome) + 1 + n (base cap)
  const domeVerts = (layers + 1) * n;
  const baseVerts = 1 + n;
  const totalVerts = domeVerts + baseVerts;
  const domeQuads = layers * n;
  const baseTris = n;
  const totalTris = domeQuads * 2 + baseTris;

  const verts = new Float32Array(totalVerts * 6);
  const indices = new Uint32Array(totalTris * 3);
  let vi = 0, ii = 0;

  function pushVert(x: number, y: number, z: number, nx: number, ny: number, nz: number): number { // NOSONAR — same shape as cone pushVert; both delegate to shared writeVertex
    const idx = vi;
    writeVertex(verts, vi, x, y, z, nx, ny, nz);
    vi++;
    return idx;
  }

  // ─── Dome layers ───
  // Layer 0 = equator (full radius at Z=0)
  // Layer N = pole (radius=0 at Z=height)
  for (let h = 0; h <= layers; h++) {
    const t = h / layers;
    const phi = t * (Math.PI / 2); // 0 → π/2
    const layerScale = Math.cos(phi); // 1 → 0 (radius shrinks)
    const layerZ = Math.sin(phi) * heightM; // 0 → height

    for (let i = 0; i < n; i++) {
      const [ux, uy, dist] = dirs[i]!;
      const px = cx + ux * dist * layerScale;
      const py = cy + uy * dist * layerScale;

      // Normal: outward from center + upward component (sphere normal)
      const nx = ux * Math.cos(phi);
      const ny = uy * Math.cos(phi);
      const nz = Math.sin(phi);
      const nLen = Math.hypot(nx, ny, nz) || 1;

      pushVert(px, py, layerZ, nx / nLen, ny / nLen, nz / nLen);
    }
  }

  // Quad strips between layers
  for (let h = 0; h < layers; h++) {
    const row0 = h * n;
    const row1 = (h + 1) * n;
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      // Two triangles per quad
      indices[ii++] = row0 + i;
      indices[ii++] = row0 + next;
      indices[ii++] = row1 + i;

      indices[ii++] = row0 + next;
      indices[ii++] = row1 + next;
      indices[ii++] = row1 + i;
    }
  }

  // ─── Base cap ───
  const baseCenterIdx = pushVert(cx, cy, 0, 0, 0, -1);
  const baseRingStart = vi;
  for (let i = 0; i < n; i++) {
    pushVert(ringM[i]![0], ringM[i]![1], 0, 0, 0, -1);
  }

  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    indices[ii++] = baseCenterIdx;
    indices[ii++] = baseRingStart + next;
    indices[ii++] = baseRingStart + i;
  }

  return { vertices: verts, indices, indexCount: ii };
}
