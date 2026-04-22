/**
 * generateGLB — Create a minimal binary glTF 2.0 (GLB) from raw mesh data.
 *
 * Takes positions + normals + indices and produces a valid GLB ArrayBuffer
 * that can be loaded via `renderEngine.loadModel()`.
 *
 * GLB format:
 *   Header (12 bytes): magic(4) + version(4) + totalLength(4)
 *   JSON chunk: { asset, meshes, accessors, bufferViews, buffers }
 *   BIN chunk: interleaved vertices [pos3+norm3+uv2] + indices (uint32)
 */

import type { GeneratedMesh } from './Geometry3D.js';

/**
 * Generate a GLB ArrayBuffer from raw mesh data.
 *
 * @param mesh - GeneratedMesh with positions, normals, and indices.
 * @param baseColor - Optional base color [r, g, b, a] 0-1. Default: white.
 * @returns GLB ArrayBuffer ready for `renderEngine.loadModel()`.
 */
export function generateGLB(
  mesh: GeneratedMesh,
  baseColor: [number, number, number, number] = [1, 1, 1, 1],
): ArrayBuffer {
  const { positions, normals, indices, vertexCount } = mesh;
  const indexCount = indices.length;

  // ─── Interleave vertices: [pos3 + norm3 + uv2] = 8 floats × 4 bytes = 32 bytes/vertex ───
  const vertexStride = 8; // floats per vertex
  const interleavedData = new Float32Array(vertexCount * vertexStride);
  for (let i = 0; i < vertexCount; i++) {
    const vi = i * vertexStride;
    const pi = i * 3;
    const ni = i * 3;
    interleavedData[vi + 0] = positions[pi]!;     // pos.x
    interleavedData[vi + 1] = positions[pi + 1]!; // pos.y
    interleavedData[vi + 2] = positions[pi + 2]!; // pos.z
    interleavedData[vi + 3] = normals[ni]!;       // norm.x
    interleavedData[vi + 4] = normals[ni + 1]!;   // norm.y
    interleavedData[vi + 5] = normals[ni + 2]!;   // norm.z
    interleavedData[vi + 6] = 0;                   // uv.u
    interleavedData[vi + 7] = 0;                   // uv.v
  }

  // ─── Compute bounding box (required by glTF) ───
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]!, y = positions[i + 1]!, z = positions[i + 2]!;
    if (x < minX) { minX = x; } if (x > maxX) { maxX = x; }
    if (y < minY) { minY = y; } if (y > maxY) { maxY = y; }
    if (z < minZ) { minZ = z; } if (z > maxZ) { maxZ = z; }
  }

  // ─── Binary data: interleaved vertices + uint32 indices ───
  const vertexBytes = interleavedData.byteLength;
  const indexBytes = indexCount * 4; // uint32
  // Pad to 4-byte alignment
  const binPadding = (4 - ((vertexBytes + indexBytes) % 4)) % 4;
  const binLength = vertexBytes + indexBytes + binPadding;

  // ─── Build JSON ───
  const json = {
    asset: { version: '2.0', generator: 'mapgpu-generateGLB' },
    meshes: [{
      primitives: [{
        attributes: {
          POSITION: 0,
          NORMAL: 1,
          TEXCOORD_0: 2,
        },
        indices: 3,
        material: 0,
      }],
    }],
    accessors: [
      // 0: POSITION (vec3)
      { bufferView: 0, byteOffset: 0, componentType: 5126, count: vertexCount, type: 'VEC3', min: [minX, minY, minZ], max: [maxX, maxY, maxZ] },
      // 1: NORMAL (vec3)
      { bufferView: 0, byteOffset: 12, componentType: 5126, count: vertexCount, type: 'VEC3' },
      // 2: TEXCOORD_0 (vec2)
      { bufferView: 0, byteOffset: 24, componentType: 5126, count: vertexCount, type: 'VEC2' },
      // 3: indices (uint32)
      { bufferView: 1, byteOffset: 0, componentType: 5125, count: indexCount, type: 'SCALAR' },
    ],
    bufferViews: [
      // 0: interleaved vertex buffer
      { buffer: 0, byteOffset: 0, byteLength: vertexBytes, byteStride: 32, target: 34962 },
      // 1: index buffer
      { buffer: 0, byteOffset: vertexBytes, byteLength: indexBytes, target: 34963 },
    ],
    buffers: [{ byteLength: binLength }],
    materials: [{
      pbrMetallicRoughness: {
        baseColorFactor: baseColor,
        metallicFactor: 0,
        roughnessFactor: 0.8,
      },
    }],
  };

  const jsonString = JSON.stringify(json);
  const jsonBytes = new TextEncoder().encode(jsonString);
  // Pad JSON to 4-byte alignment with spaces
  const jsonPadding = (4 - (jsonBytes.length % 4)) % 4;
  const jsonChunkLength = jsonBytes.length + jsonPadding;

  // ─── Assemble GLB ───
  const totalLength = 12 + 8 + jsonChunkLength + 8 + binLength;
  const glb = new ArrayBuffer(totalLength);
  const view = new DataView(glb);
  const u8 = new Uint8Array(glb);
  let offset = 0;

  // Header
  view.setUint32(offset, 0x46546C67, true); offset += 4; // magic: "glTF"
  view.setUint32(offset, 2, true); offset += 4;           // version: 2
  view.setUint32(offset, totalLength, true); offset += 4;  // total length

  // JSON chunk
  view.setUint32(offset, jsonChunkLength, true); offset += 4;   // chunk length
  view.setUint32(offset, 0x4E4F534A, true); offset += 4;        // chunk type: "JSON"
  u8.set(jsonBytes, offset); offset += jsonBytes.length;
  for (let i = 0; i < jsonPadding; i++) u8[offset++] = 0x20;   // pad with spaces

  // BIN chunk
  view.setUint32(offset, binLength, true); offset += 4;          // chunk length
  view.setUint32(offset, 0x004E4942, true); offset += 4;        // chunk type: "BIN\0"
  u8.set(new Uint8Array(interleavedData.buffer), offset); offset += vertexBytes;
  // Copy indices as uint32
  const idxView = new Uint32Array(glb, offset, indexCount);
  idxView.set(indices);
  // Padding zeros (already zeroed by ArrayBuffer)

  return glb;
}
