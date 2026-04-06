/**
 * Mesh3DConverter — Converts Point features + Mesh3DSymbol into GPU vertex/index data.
 *
 * Flow:
 * 1. Generate unit mesh for the symbol's meshType (box, cylinder, sphere, cone)
 * 2. Apply scale + rotation transforms
 * 3. Position in Mercator [0..1] + height (metres) space
 * 4. Pack into interleaved vertex buffer [pos3 + norm3] = 24 bytes/vertex
 */

import type { Feature, Mesh3DSymbol } from '../interfaces/index.js';
import { lonLatToMercator, EARTH_RADIUS } from './coordinates.js';
import {
  createBoxGeometry,
  createCylinderGeometry,
  createHemisphereGeometry,
} from '../geometry/Geometry3D.js';

/** World half-circumference for Mercator normalization. */
const HALF_CIRC = EARTH_RADIUS * Math.PI;
const DEG2RAD = Math.PI / 180;

/** Output from the converter — ready for GPU buffer creation. */
export interface Mesh3DVertexData {
  /** Interleaved [posX, posY, posZ, normX, normY, normZ] per vertex */
  vertices: Float32Array;
  /** Triangle indices (uint32) */
  indices: Uint32Array;
  /** Number of indices */
  indexCount: number;
}

/**
 * Convert Point features + Mesh3DSymbol into GPU-ready vertex data.
 *
 * Supports multiple features — each gets its own copy of the mesh
 * at its geographic position.
 */
export function convertMesh3DFeatures(
  features: readonly Feature[],
  symbol: Mesh3DSymbol,
): Mesh3DVertexData | null {
  const meshType = symbol.meshType;
  const radius = symbol.scale?.[0] ?? 50;
  const height = symbol.scale?.[1] ?? 100;

  // Cone and Sphere: footprint-based mesh generation (exact alignment with preview)
  if (meshType === 'cone' || meshType === 'sphere') {
    return _convertFootprintBased(features, symbol, radius, height);
  }

  // Box and Cylinder: unit mesh + transform path
  const unitMesh = _getUnitMesh(meshType);
  if (!unitMesh) return null;

  const scaleX = symbol.scale?.[0] ?? 1;
  const scaleY = symbol.scale?.[1] ?? 1;
  const scaleZ = symbol.scale?.[2] ?? 1;
  const heading = (symbol.heading ?? 0) * DEG2RAD;
  const pitch = (symbol.pitch ?? 0) * DEG2RAD;
  const roll = (symbol.roll ?? 0) * DEG2RAD;

  // Pre-compute rotation matrix (Y-up, heading=yaw around Y, pitch around X, roll around Z)
  const cosH = Math.cos(heading), sinH = Math.sin(heading);
  const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
  const cosR = Math.cos(roll), sinR = Math.sin(roll);

  // Combined rotation matrix R = Ry(heading) * Rx(pitch) * Rz(roll)
  const r00 = cosH * cosR + sinH * sinP * sinR;
  const r01 = -cosH * sinR + sinH * sinP * cosR;
  const r02 = sinH * cosP;
  const r10 = cosP * sinR;
  const r11 = cosP * cosR;
  const r12 = -sinP;
  const r20 = -sinH * cosR + cosH * sinP * sinR;
  const r21 = sinH * sinR + cosH * sinP * cosR;
  const r22 = cosH * cosP;

  const unitPositions = unitMesh.positions;
  const unitNormals = unitMesh.normals;
  const unitIndices = unitMesh.indices;
  const vertexCount = unitMesh.vertexCount;
  const indexCount = unitIndices.length;

  const totalVerts = vertexCount * features.length;
  const totalIndices = indexCount * features.length;

  const vertices = new Float32Array(totalVerts * 6); // pos3 + norm3
  const indices = new Uint32Array(totalIndices);

  let vertOffset = 0;
  let idxOffset = 0;

  for (const feature of features) {
    const geom = feature.geometry;
    if (!geom || geom.type !== 'Point') continue;

    const coords = geom.coordinates as number[];
    const lon = coords[0]!;
    const lat = coords[1]!;

    // Convert feature position to Mercator [0..1]
    const [mx, my] = lonLatToMercator(lon, lat);
    const merc01X = (mx + HALF_CIRC) / (2 * HALF_CIRC);
    const merc01Y = 1 - (my + HALF_CIRC) / (2 * HALF_CIRC);

    // Transform each vertex: scale → rotate → position
    for (let i = 0; i < vertexCount; i++) {
      const px = unitPositions[i * 3]! * scaleX;
      const py = unitPositions[i * 3 + 1]! * scaleY;
      const pz = unitPositions[i * 3 + 2]! * scaleZ;

      // Apply rotation
      const rpx = r00 * px + r01 * py + r02 * pz;
      const rpy = r10 * px + r11 * py + r12 * pz;
      const rpz = r20 * px + r21 * py + r22 * pz;

      // Convert to Mercator [0..1] offset
      // rpx, rpz are horizontal (meters), rpy is vertical (height in meters)
      // Mercator offset: meters / world_circumference
      const dMercX = rpx / (2 * HALF_CIRC);
      const dMercY = -rpz / (2 * HALF_CIRC); // negative because Mercator Y is inverted

      const vi = (vertOffset + i) * 6;
      vertices[vi + 0] = merc01X + dMercX;
      vertices[vi + 1] = merc01Y + dMercY;
      vertices[vi + 2] = rpy; // height in metres (Y becomes Z in render space)

      // Rotate normals (no translation/scale)
      const nx = unitNormals[i * 3]!;
      const ny = unitNormals[i * 3 + 1]!;
      const nz = unitNormals[i * 3 + 2]!;
      vertices[vi + 3] = r00 * nx + r01 * ny + r02 * nz;
      vertices[vi + 4] = r10 * nx + r11 * ny + r12 * nz;
      vertices[vi + 5] = r20 * nx + r21 * ny + r22 * nz;
    }

    // Copy indices with vertex offset
    const baseVertex = vertOffset;
    for (let i = 0; i < indexCount; i++) {
      indices[idxOffset + i] = baseVertex + unitIndices[i]!;
    }

    vertOffset += vertexCount;
    idxOffset += indexCount;
  }

  if (idxOffset === 0) return null;

  return { vertices, indices, indexCount: idxOffset };
}

/**
 * Get unit mesh for the given type.
 *
 * Convention:
 * - XZ (horizontal): [-1, +1] → scale[0]/scale[2] = radius in metres
 * - Y (vertical):    [0, 1]   → scale[1] = height in metres (ground to top)
 *
 * This means:
 * - scale=[50, 100, 50] → 50m radius footprint, 100m tall, centered at feature point
 */
function _getUnitMesh(meshType: string) {
  switch (meshType) {
    case 'box': return _shiftMeshYToGround(createBoxGeometry(2, 1, 2));       // XZ [-1,+1], Y [0,1]
    case 'cylinder': return _shiftMeshYToGround(createCylinderGeometry(1, 1, 1, 32)); // r=1, Y [0,1]
    case 'sphere': return createHemisphereGeometry(1, 32, 12);  // hemisphere: r=1, Y [0,1] (already ground-based)
    case 'cone': return _shiftMeshYToGround(createCylinderGeometry(0, 1, 1, 32));     // r=1, Y [0,1]
    default: return null;
  }
}

/** Shift mesh so Y minimum = 0 (ground level). */
function _shiftMeshYToGround(mesh: { positions: Float32Array; normals: Float32Array; indices: Uint32Array; vertexCount: number }) {
  let minY = Infinity;
  for (let i = 1; i < mesh.positions.length; i += 3) {
    if (mesh.positions[i]! < minY) minY = mesh.positions[i]!;
  }
  if (minY !== 0) {
    for (let i = 1; i < mesh.positions.length; i += 3) {
      mesh.positions[i] = mesh.positions[i]! - minY;
    }
  }
  return mesh;
}

// ─── Footprint-based generation (cone, hemisphere) ───

import { createConeFromFootprint, createHemisphereFromFootprint } from './FootprintMeshGenerator.js';

/** Generate circle footprint ring — same math as tools/footprintGenerators.ts */
function _makeCircleRing(centerLon: number, centerLat: number, radiusM: number, segments: number = 32): number[][] {
  const DEG = Math.PI / 180;
  const m2lon = (m: number) => m / (111320 * Math.cos(centerLat * DEG));
  const m2lat = (m: number) => m / 110540;
  const ring: number[][] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    ring.push([
      centerLon + m2lon(Math.cos(angle) * radiusM),
      centerLat + m2lat(Math.sin(angle) * radiusM),
    ]);
  }
  return ring;
}

/**
 * Generate cone/hemisphere mesh directly from footprint polygon.
 * Uses the SAME makeCircleFootprint() as the tool's preview → exact alignment.
 */
function _convertFootprintBased(
  features: readonly Feature[],
  symbol: Mesh3DSymbol,
  radius: number,
  height: number,
): Mesh3DVertexData | null {
  // Collect all feature results
  const allVerts: number[] = [];
  const allIndices: number[] = [];
  let vertOffset = 0;

  for (const feature of features) {
    const geom = feature.geometry;
    if (!geom || geom.type !== 'Point') continue;

    const coords = geom.coordinates as number[];
    const lon = coords[0]!;
    const lat = coords[1]!;

    // Generate footprint ring — SAME function as tool preview
    const ring = _makeCircleRing(lon, lat, radius, 32);

    let data: Mesh3DVertexData | null;
    if (symbol.meshType === 'cone') {
      data = createConeFromFootprint(ring, [lon, lat], height);
    } else {
      data = createHemisphereFromFootprint(ring, [lon, lat], height, 12);
    }

    if (!data || data.indexCount === 0) continue;

    // Append vertices
    for (let i = 0; i < data.vertices.length; i++) {
      allVerts.push(data.vertices[i]!);
    }

    // Append indices with offset
    for (let i = 0; i < data.indexCount; i++) {
      allIndices.push(data.indices[i]! + vertOffset);
    }

    vertOffset += data.vertices.length / 6;
  }

  if (allIndices.length === 0) return null;

  return {
    vertices: new Float32Array(allVerts),
    indices: new Uint32Array(allIndices),
    indexCount: allIndices.length,
  };
}
