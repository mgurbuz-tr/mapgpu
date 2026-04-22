import { describe, it, expect } from 'vitest';
import { parseGlb } from './gltf-parser';
import type { ParsedGltf } from './gltf-parser';

// ---------------------------------------------------------------------------
// Helper: hand-craft a minimal GLB binary from parts
// ---------------------------------------------------------------------------

function buildMinimalGlb(options?: {
  componentType?: number;
  includeNormals?: boolean;
  includeTexcoords?: boolean;
  material?: {
    baseColorFactor?: number[];
    metallicFactor?: number;
    roughnessFactor?: number;
    baseColorTexture?: { index: number };
  };
  /** Override the GLB header magic (for error-path tests). */
  overrideMagic?: number;
  /** Override the GLB header version (for error-path tests). */
  overrideVersion?: number;
  /** If true, omit indices from the primitive. */
  omitIndices?: boolean;
  /** Extra meshes to include (each with a single triangle). */
  extraMeshCount?: number;
  /** Embedded images + textures for texture tests. */
  embeddedImages?: { data: Uint8Array; mimeType: string }[];
}): ArrayBuffer {
  // Positions: 3 vertices of a triangle
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);

  // Build binary buffer parts
  const parts: ArrayBuffer[] = [];
  let offset = 0;

  const accessors: Record<string, unknown>[] = [];
  const bufferViews: Record<string, unknown>[] = [];
  const attributes: Record<string, number> = {};

  // POSITION
  bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: positions.byteLength });
  accessors.push({
    bufferView: bufferViews.length - 1,
    componentType: 5126,
    count: 3,
    type: 'VEC3',
    max: [1, 1, 0],
    min: [0, 0, 0],
  });
  attributes.POSITION = accessors.length - 1;
  parts.push(positions.buffer.slice(positions.byteOffset, positions.byteOffset + positions.byteLength));
  offset += positions.byteLength;

  // NORMAL (optional)
  if (options?.includeNormals !== false) {
    const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: normals.byteLength });
    accessors.push({
      bufferView: bufferViews.length - 1,
      componentType: 5126,
      count: 3,
      type: 'VEC3',
    });
    attributes.NORMAL = accessors.length - 1;
    parts.push(normals.buffer.slice(normals.byteOffset, normals.byteOffset + normals.byteLength));
    offset += normals.byteLength;
  }

  // TEXCOORD_0 (optional)
  if (options?.includeTexcoords !== false) {
    const texcoords = new Float32Array([0, 0, 1, 0, 0, 1]);
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: texcoords.byteLength });
    accessors.push({
      bufferView: bufferViews.length - 1,
      componentType: 5126,
      count: 3,
      type: 'VEC2',
    });
    attributes.TEXCOORD_0 = accessors.length - 1;
    parts.push(texcoords.buffer.slice(texcoords.byteOffset, texcoords.byteOffset + texcoords.byteLength));
    offset += texcoords.byteLength;
  }

  // Indices (unless omitted)
  let indicesAccessorIdx: number | undefined;
  if (!options?.omitIndices) {
    const useUint32 = options?.componentType === 5125;
    const indices = useUint32 ? new Uint32Array([0, 1, 2]) : new Uint16Array([0, 1, 2]);
    const indicesPadded = !useUint32 && indices.byteLength % 4 !== 0;

    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: indices.byteLength });
    indicesAccessorIdx = accessors.length;
    accessors.push({
      bufferView: bufferViews.length - 1,
      componentType: useUint32 ? 5125 : 5123,
      count: 3,
      type: 'SCALAR',
    });
    parts.push(indices.buffer.slice(indices.byteOffset, indices.byteOffset + indices.byteLength));
    offset += indices.byteLength;

    if (indicesPadded) {
      const padLen = 4 - (indices.byteLength % 4);
      parts.push(new Uint8Array(padLen).buffer);
      offset += padLen;
    }
  }

  // Build primary primitive
  const primitive: Record<string, unknown> = { attributes };
  if (indicesAccessorIdx !== undefined) {
    primitive.indices = indicesAccessorIdx;
  }

  const meshes: Record<string, unknown>[] = [{ primitives: [primitive] }];

  // Extra meshes (for multi-mesh tests)
  const extraCount = options?.extraMeshCount ?? 0;
  for (let m = 0; m < extraCount; m++) {
    // Each extra mesh reuses the same accessors (same geometry)
    const extraPrim: Record<string, unknown> = { attributes: { ...attributes } };
    if (indicesAccessorIdx !== undefined) {
      extraPrim.indices = indicesAccessorIdx;
    }
    if (options?.material) {
      extraPrim.material = 0; // share material
    }
    meshes.push({ primitives: [extraPrim], name: `extra-${m}` });
  }

  // Build JSON
  const json: Record<string, unknown> = {
    asset: { version: '2.0' },
    meshes,
    accessors,
    bufferViews,
    buffers: [{ byteLength: offset }],
  };

  if (options?.material) {
    json.materials = [{ pbrMetallicRoughness: options.material }];
    (primitive as Record<string, unknown>).material = 0;
  }

  // Embedded images
  if (options?.embeddedImages && options.embeddedImages.length > 0) {
    const images: Record<string, unknown>[] = [];
    const textures: Record<string, unknown>[] = [];

    for (const img of options.embeddedImages) {
      // Add image data to bin chunk
      bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: img.data.byteLength });
      images.push({ bufferView: bufferViews.length - 1, mimeType: img.mimeType });
      textures.push({ source: images.length - 1 });
      parts.push(img.data.buffer.slice(img.data.byteOffset, img.data.byteOffset + img.data.byteLength));
      const padLen = (4 - (img.data.byteLength % 4)) % 4;
      if (padLen > 0) {
        parts.push(new Uint8Array(padLen).buffer);
        offset += img.data.byteLength + padLen;
      } else {
        offset += img.data.byteLength;
      }
    }

    json.images = images;
    json.textures = textures;
    // Update buffer total
    (json.buffers as { byteLength: number }[])[0]!.byteLength = offset;
  }

  // Encode JSON chunk
  const jsonStr = JSON.stringify(json);
  const jsonBytes = new TextEncoder().encode(jsonStr);
  const jsonPadLen = (4 - (jsonBytes.length % 4)) % 4;
  const jsonChunkData = new Uint8Array(jsonBytes.length + jsonPadLen);
  jsonChunkData.set(jsonBytes);
  for (let i = 0; i < jsonPadLen; i++) jsonChunkData[jsonBytes.length + i] = 0x20;

  // Compose binary chunk
  const binData = new Uint8Array(offset);
  let binOffset = 0;
  for (const part of parts) {
    binData.set(new Uint8Array(part), binOffset);
    binOffset += part.byteLength;
  }
  const binPadLen = (4 - (binData.length % 4)) % 4;
  const binChunkData = new Uint8Array(binData.length + binPadLen);
  binChunkData.set(binData);

  // Assemble GLB
  const totalLength = 12 + 8 + jsonChunkData.length + 8 + binChunkData.length;
  const glb = new ArrayBuffer(totalLength);
  const view = new DataView(glb);
  let pos = 0;

  // Header
  view.setUint32(pos, options?.overrideMagic ?? 0x46546C67, true);
  pos += 4;
  view.setUint32(pos, options?.overrideVersion ?? 2, true);
  pos += 4;
  view.setUint32(pos, totalLength, true);
  pos += 4;

  // JSON chunk
  view.setUint32(pos, jsonChunkData.length, true);
  pos += 4;
  view.setUint32(pos, 0x4E4F534A, true);
  pos += 4;
  new Uint8Array(glb, pos, jsonChunkData.length).set(jsonChunkData);
  pos += jsonChunkData.length;

  // Binary chunk
  view.setUint32(pos, binChunkData.length, true);
  pos += 4;
  view.setUint32(pos, 0x004E4942, true);
  pos += 4;
  new Uint8Array(glb, pos, binChunkData.length).set(binChunkData);

  return glb;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('gltf-parser', () => {
  // ---- Error cases --------------------------------------------------------

  it('throws on invalid magic', () => {
    const glb = buildMinimalGlb({ overrideMagic: 0xDEADBEEF });
    expect(() => parseGlb(glb)).toThrowError(/invalid magic/i);
  });

  it('throws on unsupported version', () => {
    const glb = buildMinimalGlb({ overrideVersion: 1 });
    expect(() => parseGlb(glb)).toThrowError(/unsupported version/i);
  });

  it('throws on data too small', () => {
    const tiny = new ArrayBuffer(4);
    expect(() => parseGlb(tiny)).toThrowError(/too small/i);
  });

  it('throws when file is truncated before JSON chunk header', () => {
    const buf = new ArrayBuffer(12);
    const v = new DataView(buf);
    v.setUint32(0, 0x46546C67, true);
    v.setUint32(4, 2, true);
    v.setUint32(8, 12, true);
    expect(() => parseGlb(buf)).toThrowError(/missing JSON chunk/i);
  });

  // ---- Minimal triangle (single primitive) --------------------------------

  it('parses minimal triangle GLB with all attributes', () => {
    const glb = buildMinimalGlb();
    const result: ParsedGltf = parseGlb(glb);

    expect(result.primitives).toHaveLength(1);
    const prim = result.primitives[0]!;

    // Mesh shape
    expect(prim.mesh.vertexCount).toBe(3);
    expect(prim.mesh.indexCount).toBe(3);

    // Positions: [0,0,0, 1,0,0, 0,1,0]
    expect(prim.mesh.positions).toBeInstanceOf(Float32Array);
    expect(prim.mesh.positions.length).toBe(9);
    expect(prim.mesh.positions[0]).toBe(0);
    expect(prim.mesh.positions[3]).toBe(1);
    expect(prim.mesh.positions[7]).toBe(1);

    // Normals
    expect(prim.mesh.normals).toBeInstanceOf(Float32Array);
    expect(prim.mesh.normals.length).toBe(9);
    expect(prim.mesh.normals[2]).toBe(1);

    // Texcoords
    expect(prim.mesh.texcoords).toBeInstanceOf(Float32Array);
    expect(prim.mesh.texcoords.length).toBe(6);
    expect(prim.mesh.texcoords[2]).toBe(1);

    // Indices: [0, 1, 2] as Uint16
    expect(prim.mesh.indices).toBeInstanceOf(Uint16Array);
    expect(prim.mesh.indices.length).toBe(3);
  });

  // ---- Missing optional attributes ----------------------------------------

  it('generates default normals when NORMAL attribute is absent', () => {
    const glb = buildMinimalGlb({ includeNormals: false });
    const result = parseGlb(glb);
    const prim = result.primitives[0]!;

    expect(prim.mesh.normals).toBeInstanceOf(Float32Array);
    expect(prim.mesh.normals.length).toBe(9);
    for (let i = 0; i < 3; i++) {
      expect(prim.mesh.normals[i * 3 + 0]).toBe(0);
      expect(prim.mesh.normals[i * 3 + 1]).toBe(0);
      expect(prim.mesh.normals[i * 3 + 2]).toBe(1);
    }
  });

  it('generates default texcoords when TEXCOORD_0 attribute is absent', () => {
    const glb = buildMinimalGlb({ includeTexcoords: false });
    const result = parseGlb(glb);
    const prim = result.primitives[0]!;

    expect(prim.mesh.texcoords).toBeInstanceOf(Float32Array);
    expect(prim.mesh.texcoords.length).toBe(6);
    for (let i = 0; i < 6; i++) {
      expect(prim.mesh.texcoords[i]).toBe(0);
    }
  });

  it('generates defaults when both normals and texcoords are absent', () => {
    const glb = buildMinimalGlb({ includeNormals: false, includeTexcoords: false });
    const result = parseGlb(glb);
    const prim = result.primitives[0]!;

    expect(prim.mesh.vertexCount).toBe(3);
    expect(prim.mesh.normals.length).toBe(9);
    expect(prim.mesh.texcoords.length).toBe(6);
    expect(prim.mesh.normals[2]).toBe(1);
    expect(prim.mesh.texcoords[0]).toBe(0);
  });

  // ---- Uint32 indices -----------------------------------------------------

  it('handles Uint32 indices (componentType 5125)', () => {
    const glb = buildMinimalGlb({ componentType: 5125 });
    const result = parseGlb(glb);
    const prim = result.primitives[0]!;

    expect(prim.mesh.indices).toBeInstanceOf(Uint32Array);
    expect(prim.mesh.indices.length).toBe(3);
    expect(prim.mesh.indexCount).toBe(3);
  });

  // ---- No indices ---------------------------------------------------------

  it('generates sequential indices when primitive has no indices accessor', () => {
    const glb = buildMinimalGlb({ omitIndices: true });
    const result = parseGlb(glb);
    const prim = result.primitives[0]!;

    expect(prim.mesh.indices).toBeInstanceOf(Uint32Array);
    expect(prim.mesh.indexCount).toBe(3);
    expect(prim.mesh.indices[0]).toBe(0);
    expect(prim.mesh.indices[1]).toBe(1);
    expect(prim.mesh.indices[2]).toBe(2);
  });

  // ---- Material parsing ---------------------------------------------------

  it('parses material with baseColorFactor, metallicFactor, roughnessFactor', () => {
    const glb = buildMinimalGlb({
      material: {
        baseColorFactor: [0.8, 0.2, 0.1, 1.0],
        metallicFactor: 0.5,
        roughnessFactor: 0.3,
      },
    });
    const result = parseGlb(glb);
    const prim = result.primitives[0]!;

    expect(prim.material.baseColorFactor).toEqual([0.8, 0.2, 0.1, 1.0]);
    expect(prim.material.metallicFactor).toBeCloseTo(0.5);
    expect(prim.material.roughnessFactor).toBeCloseTo(0.3);
    expect(prim.material.emissiveFactor).toEqual([0, 0, 0]);
    expect(prim.material.alphaMode).toBe('OPAQUE');
    expect(prim.material.alphaCutoff).toBe(0.5);
    expect(prim.material.doubleSided).toBe(false);
  });

  it('returns default material when no material is referenced', () => {
    const glb = buildMinimalGlb();
    const result = parseGlb(glb);
    const prim = result.primitives[0]!;

    expect(prim.material.baseColorFactor).toEqual([1, 1, 1, 1]);
    expect(prim.material.metallicFactor).toBe(1);
    expect(prim.material.roughnessFactor).toBe(1);
    expect(prim.material.emissiveFactor).toEqual([0, 0, 0]);
  });

  it('returns default material values for partial PBR definition', () => {
    const glb = buildMinimalGlb({
      material: { metallicFactor: 0.0 },
    });
    const result = parseGlb(glb);
    const prim = result.primitives[0]!;

    expect(prim.material.baseColorFactor).toEqual([1, 1, 1, 1]);
    expect(prim.material.metallicFactor).toBe(0.0);
    expect(prim.material.roughnessFactor).toBe(1);
  });

  // ---- Combined scenarios -------------------------------------------------

  it('parses GLB with Uint32 indices, no normals, no texcoords, and custom material', () => {
    const glb = buildMinimalGlb({
      componentType: 5125,
      includeNormals: false,
      includeTexcoords: false,
      material: {
        baseColorFactor: [0.0, 1.0, 0.0, 0.5],
        metallicFactor: 0.0,
        roughnessFactor: 1.0,
      },
    });
    const result = parseGlb(glb);
    const prim = result.primitives[0]!;

    expect(prim.mesh.vertexCount).toBe(3);
    expect(prim.mesh.indexCount).toBe(3);
    expect(prim.mesh.indices).toBeInstanceOf(Uint32Array);
    expect(prim.mesh.normals[2]).toBe(1);
    expect(prim.mesh.texcoords[0]).toBe(0);
    expect(prim.material.baseColorFactor).toEqual([0.0, 1.0, 0.0, 0.5]);
  });

  // ---- Vertex data integrity ----------------------------------------------

  it('preserves vertex positions exactly', () => {
    const glb = buildMinimalGlb();
    const result = parseGlb(glb);
    const prim = result.primitives[0]!;

    expect(prim.mesh.positions[0]).toBe(0);
    expect(prim.mesh.positions[1]).toBe(0);
    expect(prim.mesh.positions[2]).toBe(0);
    expect(prim.mesh.positions[3]).toBe(1);
    expect(prim.mesh.positions[4]).toBe(0);
    expect(prim.mesh.positions[5]).toBe(0);
    expect(prim.mesh.positions[6]).toBe(0);
    expect(prim.mesh.positions[7]).toBe(1);
    expect(prim.mesh.positions[8]).toBe(0);
  });

  // ---- Multi-mesh ---------------------------------------------------------

  it('parses GLB with multiple meshes into multiple primitives', () => {
    const glb = buildMinimalGlb({ extraMeshCount: 2 });
    const result = parseGlb(glb);

    // 1 primary mesh + 2 extra = 3 primitives
    expect(result.primitives).toHaveLength(3);

    // All have the same geometry (shared accessors)
    for (const prim of result.primitives) {
      expect(prim.mesh.vertexCount).toBe(3);
      expect(prim.mesh.indexCount).toBe(3);
    }

    // Extra meshes have names
    expect(result.primitives[1]!.name).toBe('extra-0');
    expect(result.primitives[2]!.name).toBe('extra-1');
  });

  // ---- Texture reference in material (Faz 2) -----------------------------

  it('records baseColorTextureIndex from material', () => {
    const glb = buildMinimalGlb({
      material: {
        baseColorFactor: [1, 1, 1, 1],
        baseColorTexture: { index: 0 },
      },
      embeddedImages: [
        { data: new Uint8Array([0x89, 0x50, 0x4E, 0x47]), mimeType: 'image/png' },
      ],
    });
    const result = parseGlb(glb);
    const prim = result.primitives[0]!;

    expect(prim.material.baseColorTextureIndex).toBe(0);
    expect(prim.imageData.has(0)).toBe(true);
    expect(prim.imageData.get(0)!.mimeType).toBe('image/png');
    expect(prim.imageData.get(0)!.data.length).toBe(4);
  });

  it('has empty imageData map when no texture', () => {
    const glb = buildMinimalGlb();
    const result = parseGlb(glb);
    const prim = result.primitives[0]!;

    expect(prim.material.baseColorTextureIndex).toBeUndefined();
    expect(prim.imageData.size).toBe(0);
  });
});
