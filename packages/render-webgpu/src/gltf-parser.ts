/**
 * GLB / glTF 2.0 parser.
 *
 * Extracts ALL mesh primitives with per-primitive materials and
 * embedded base-color textures from a GLB ArrayBuffer.
 * Designed for loading 3-D models (buildings, vehicles, markers)
 * into the WebGPU pipeline.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ParsedGltfMesh {
  positions: Float32Array;              // vec3 flat
  normals: Float32Array;                // vec3 flat
  texcoords: Float32Array;             // vec2 flat
  indices: Uint16Array | Uint32Array;
  vertexCount: number;
  indexCount: number;
}

export interface ParsedGltfMaterial {
  baseColorFactor: [number, number, number, number];
  metallicFactor: number;
  roughnessFactor: number;
  baseColorTextureIndex?: number;
  normalTextureIndex?: number;
  metallicRoughnessTextureIndex?: number;
  occlusionTextureIndex?: number;
  emissiveFactor: [number, number, number];
  emissiveTextureIndex?: number;
  alphaMode: 'OPAQUE' | 'MASK' | 'BLEND';
  alphaCutoff: number;
  doubleSided: boolean;
  /** KHR_materials_unlit: skip all lighting, output base color directly */
  unlit: boolean;
}

/** Embedded image data extracted from GLB binary chunk. */
export interface EmbeddedImageData {
  data: Uint8Array;
  mimeType: string;
}

/** A single draw-call unit: one mesh primitive + its material + optional texture data. */
export interface ParsedPrimitive {
  mesh: ParsedGltfMesh;
  material: ParsedGltfMaterial;
  /** Embedded texture images, keyed by texture index. */
  imageData: Map<number, EmbeddedImageData>;
  name?: string;
}

export interface ParsedGltf {
  primitives: ParsedPrimitive[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GLB_MAGIC = 0x46546C67;
const GLB_VERSION = 2;
const CHUNK_TYPE_JSON = 0x4E4F534A;
const CHUNK_TYPE_BIN = 0x004E4942;

/** glTF component-type enum → byte size */
const COMPONENT_BYTE_SIZE: Record<number, number> = {
  5120: 1,  // BYTE
  5121: 1,  // UNSIGNED_BYTE
  5122: 2,  // SHORT
  5123: 2,  // UNSIGNED_SHORT
  5125: 4,  // UNSIGNED_INT
  5126: 4,  // FLOAT
};

/** glTF accessor-type string → number of components */
const TYPE_COMPONENT_COUNT: Record<string, number> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
};

// ---------------------------------------------------------------------------
// Internal glTF JSON shapes
// ---------------------------------------------------------------------------

interface GltfAccessor {
  bufferView?: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: string;
  max?: number[];
  min?: number[];
}

interface GltfBufferView {
  buffer: number;
  byteOffset?: number;
  byteLength: number;
  byteStride?: number;
}

interface GltfPrimitive {
  attributes: Record<string, number>;
  indices?: number;
  material?: number;
}

interface GltfMesh {
  primitives: GltfPrimitive[];
  name?: string;
}

interface GltfPbrMetallicRoughness {
  baseColorFactor?: number[];
  metallicFactor?: number;
  roughnessFactor?: number;
  baseColorTexture?: { index: number; texCoord?: number };
  metallicRoughnessTexture?: { index: number };
}

interface GltfMaterial {
  pbrMetallicRoughness?: GltfPbrMetallicRoughness;
  normalTexture?: { index: number; scale?: number };
  occlusionTexture?: { index: number; strength?: number };
  emissiveFactor?: number[];
  emissiveTexture?: { index: number };
  alphaMode?: string;
  alphaCutoff?: number;
  doubleSided?: boolean;
  extensions?: {
    KHR_materials_unlit?: Record<string, never>;
    [key: string]: unknown;
  };
  name?: string;
}

interface GltfImage {
  bufferView?: number;
  mimeType?: string;
  uri?: string;
}

interface GltfTexture {
  source?: number;
  sampler?: number;
}

interface GltfJson {
  asset: { version: string };
  meshes?: GltfMesh[];
  accessors?: GltfAccessor[];
  bufferViews?: GltfBufferView[];
  buffers?: { byteLength: number }[];
  materials?: GltfMaterial[];
  images?: GltfImage[];
  textures?: GltfTexture[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readAccessorData(
  accessor: GltfAccessor,
  bufferViews: GltfBufferView[],
  binChunk: Uint8Array,
): ArrayBufferView {
  const componentCount = TYPE_COMPONENT_COUNT[accessor.type];
  if (componentCount === undefined) {
    throw new Error(`GLB: unknown accessor type "${accessor.type}"`);
  }

  const byteSize = COMPONENT_BYTE_SIZE[accessor.componentType];
  if (byteSize === undefined) {
    throw new Error(`GLB: unknown componentType ${accessor.componentType}`);
  }

  const totalElements = accessor.count * componentCount;

  if (accessor.bufferView === undefined) {
    // Sparse / no bufferView — return zeroed data of the right typed array
    return makeTypedArray(accessor.componentType, new ArrayBuffer(totalElements * byteSize), 0, totalElements);
  }

  const bv = bufferViews[accessor.bufferView];
  if (!bv) {
    throw new Error(`GLB: bufferView index ${accessor.bufferView} out of range`);
  }

  const bvOffset = bv.byteOffset ?? 0;
  const accOffset = accessor.byteOffset ?? 0;
  const start = bvOffset + accOffset;

  // Copy into an aligned buffer so typed-array constructors never hit
  // alignment issues regardless of the source offset.
  const sliceLen = totalElements * byteSize;
  const aligned = new ArrayBuffer(sliceLen);
  new Uint8Array(aligned).set(binChunk.subarray(start, start + sliceLen));

  return makeTypedArray(accessor.componentType, aligned, 0, totalElements);
}

function makeTypedArray(
  componentType: number,
  buffer: ArrayBuffer,
  byteOffset: number,
  length: number,
): ArrayBufferView {
  switch (componentType) {
    case 5120: return new Int8Array(buffer, byteOffset, length);
    case 5121: return new Uint8Array(buffer, byteOffset, length);
    case 5122: return new Int16Array(buffer, byteOffset, length);
    case 5123: return new Uint16Array(buffer, byteOffset, length);
    case 5125: return new Uint32Array(buffer, byteOffset, length);
    case 5126: return new Float32Array(buffer, byteOffset, length);
    default:
      throw new Error(`GLB: unsupported componentType ${componentType}`);
  }
}

function toFloat32Array(view: ArrayBufferView): Float32Array {
  if (view instanceof Float32Array) return view;
  // Convert integer attribute data to float (unusual but valid in glTF)
  const src = view as unknown as ArrayLike<number>;
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = src[i]!;
  return out;
}

function generateFlatNormals(vertexCount: number): Float32Array {
  const normals = new Float32Array(vertexCount * 3);
  for (let i = 0; i < vertexCount; i++) {
    normals[i * 3 + 2] = 1; // (0, 0, 1)
  }
  return normals;
}

function generateZeroTexcoords(vertexCount: number): Float32Array {
  return new Float32Array(vertexCount * 2); // all zeros
}

function generateSequentialIndices(vertexCount: number): Uint32Array {
  const indices = new Uint32Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) indices[i] = i;
  return indices;
}

// ---------------------------------------------------------------------------
// Default material
// ---------------------------------------------------------------------------

const DEFAULT_MATERIAL: ParsedGltfMaterial = {
  baseColorFactor: [1, 1, 1, 1],
  metallicFactor: 1,
  roughnessFactor: 1,
  emissiveFactor: [0, 0, 0],
  alphaMode: 'OPAQUE',
  alphaCutoff: 0.5,
  doubleSided: false,
  unlit: false,
};

// ---------------------------------------------------------------------------
// Per-primitive parsing (shared between GLB and future glTF text format)
// ---------------------------------------------------------------------------

function parsePrimitiveMesh(
  prim: GltfPrimitive,
  accessors: GltfAccessor[],
  bufferViews: GltfBufferView[],
  binChunk: Uint8Array,
): ParsedGltfMesh {
  const posAccessorIdx = prim.attributes.POSITION;
  if (posAccessorIdx === undefined) {
    throw new Error('GLB: primitive has no POSITION attribute');
  }

  const posAccessor = accessors[posAccessorIdx];
  if (!posAccessor) {
    throw new Error(`GLB: POSITION accessor index ${posAccessorIdx} out of range`);
  }
  const positions = toFloat32Array(readAccessorData(posAccessor, bufferViews, binChunk));
  const vertexCount = posAccessor.count;

  // Normals (optional — default flat [0,0,1])
  let normals: Float32Array;
  const normalIdx = prim.attributes.NORMAL;
  if (normalIdx !== undefined) {
    const normalAccessor = accessors[normalIdx];
    if (!normalAccessor) {
      throw new Error(`GLB: NORMAL accessor index ${normalIdx} out of range`);
    }
    normals = toFloat32Array(readAccessorData(normalAccessor, bufferViews, binChunk));
  } else {
    normals = generateFlatNormals(vertexCount);
  }

  // Texcoords (optional — default zeros)
  let texcoords: Float32Array;
  const texIdx = prim.attributes.TEXCOORD_0;
  if (texIdx !== undefined) {
    const texAccessor = accessors[texIdx];
    if (!texAccessor) {
      throw new Error(`GLB: TEXCOORD_0 accessor index ${texIdx} out of range`);
    }
    texcoords = toFloat32Array(readAccessorData(texAccessor, bufferViews, binChunk));
  } else {
    texcoords = generateZeroTexcoords(vertexCount);
  }

  // Indices (optional — default sequential)
  let indices: Uint16Array | Uint32Array;
  let indexCount: number;
  if (prim.indices !== undefined) {
    const idxAccessor = accessors[prim.indices];
    if (!idxAccessor) {
      throw new Error(`GLB: indices accessor index ${prim.indices} out of range`);
    }
    const rawIndices = readAccessorData(idxAccessor, bufferViews, binChunk);
    if (rawIndices instanceof Uint16Array) {
      indices = rawIndices;
    } else if (rawIndices instanceof Uint32Array) {
      indices = rawIndices;
    } else {
      const src = rawIndices as unknown as ArrayLike<number>;
      const converted = new Uint32Array(src.length);
      for (let i = 0; i < src.length; i++) converted[i] = src[i]!;
      indices = converted;
    }
    indexCount = idxAccessor.count;
  } else {
    indices = generateSequentialIndices(vertexCount);
    indexCount = vertexCount;
  }

  return { positions, normals, texcoords, indices, vertexCount, indexCount };
}

function parseMaterial(
  materialIndex: number | undefined,
  materials: GltfMaterial[] | undefined,
): ParsedGltfMaterial {
  if (
    materialIndex === undefined ||
    !materials ||
    !materials[materialIndex]
  ) {
    return { ...DEFAULT_MATERIAL };
  }

  const gltfMat = materials[materialIndex]!;
  const pbr = gltfMat.pbrMetallicRoughness;

  const bcf = pbr?.baseColorFactor;
  const result: ParsedGltfMaterial = {
    baseColorFactor: bcf && bcf.length >= 4
      ? [bcf[0], bcf[1], bcf[2], bcf[3]] as [number, number, number, number]
      : DEFAULT_MATERIAL.baseColorFactor,
    metallicFactor: pbr?.metallicFactor ?? DEFAULT_MATERIAL.metallicFactor,
    roughnessFactor: pbr?.roughnessFactor ?? DEFAULT_MATERIAL.roughnessFactor,
    emissiveFactor: gltfMat.emissiveFactor && gltfMat.emissiveFactor.length >= 3
      ? [gltfMat.emissiveFactor[0]!, gltfMat.emissiveFactor[1]!, gltfMat.emissiveFactor[2]!]
      : DEFAULT_MATERIAL.emissiveFactor,
    alphaMode: (gltfMat.alphaMode as ParsedGltfMaterial['alphaMode']) ?? DEFAULT_MATERIAL.alphaMode,
    alphaCutoff: gltfMat.alphaCutoff ?? DEFAULT_MATERIAL.alphaCutoff,
    doubleSided: gltfMat.doubleSided ?? DEFAULT_MATERIAL.doubleSided,
    unlit: gltfMat.extensions?.KHR_materials_unlit !== undefined,
  };

  // PBR texture references
  if (pbr?.baseColorTexture !== undefined) {
    result.baseColorTextureIndex = pbr.baseColorTexture.index;
  }
  if (pbr?.metallicRoughnessTexture !== undefined) {
    result.metallicRoughnessTextureIndex = pbr.metallicRoughnessTexture.index;
  }
  if (gltfMat.normalTexture !== undefined) {
    result.normalTextureIndex = gltfMat.normalTexture.index;
  }
  if (gltfMat.occlusionTexture !== undefined) {
    result.occlusionTextureIndex = gltfMat.occlusionTexture.index;
  }
  if (gltfMat.emissiveTexture !== undefined) {
    result.emissiveTextureIndex = gltfMat.emissiveTexture.index;
  }

  return result;
}

/**
 * Extract embedded image data from the GLB binary chunk.
 * Returns the raw bytes + MIME type for later GPU upload via createImageBitmap.
 */
function extractImageData(
  textureIndex: number,
  json: GltfJson,
  bufferViews: GltfBufferView[],
  binChunk: Uint8Array,
): { data: Uint8Array; mimeType: string } | undefined {
  const textures = json.textures;
  if (!textures || !textures[textureIndex]) return undefined;

  const tex = textures[textureIndex]!;
  if (tex.source === undefined) return undefined;

  const images = json.images;
  if (!images || !images[tex.source]) return undefined;

  const img = images[tex.source]!;

  // Only handle embedded (bufferView-based) images.
  // URI-based images are for glTF text format (Faz 3).
  if (img.bufferView === undefined) return undefined;

  const bv = bufferViews[img.bufferView];
  if (!bv) return undefined;

  const offset = bv.byteOffset ?? 0;
  const data = new Uint8Array(bv.byteLength);
  data.set(binChunk.subarray(offset, offset + bv.byteLength));

  return { data, mimeType: img.mimeType ?? 'image/png' };
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export function parseGlb(data: ArrayBuffer): ParsedGltf {
  if (data.byteLength < 12) {
    throw new Error('GLB: data too small to contain a valid header');
  }

  const headerView = new DataView(data);

  // --- Header ---
  const magic = headerView.getUint32(0, true);
  if (magic !== GLB_MAGIC) {
    throw new Error(
      `GLB: invalid magic 0x${magic.toString(16).padStart(8, '0')}, expected 0x${GLB_MAGIC.toString(16).padStart(8, '0')}`,
    );
  }

  const version = headerView.getUint32(4, true);
  if (version !== GLB_VERSION) {
    throw new Error(`GLB: unsupported version ${version}, only version 2 is supported`);
  }

  const totalLength = headerView.getUint32(8, true);
  if (totalLength > data.byteLength) {
    throw new Error(`GLB: declared length ${totalLength} exceeds buffer size ${data.byteLength}`);
  }

  // --- Chunks ---
  let pos = 12;

  // Chunk 0 — JSON
  if (pos + 8 > totalLength) {
    throw new Error('GLB: missing JSON chunk header');
  }
  const jsonChunkLength = headerView.getUint32(pos, true);
  const jsonChunkType = headerView.getUint32(pos + 4, true);
  if (jsonChunkType !== CHUNK_TYPE_JSON) {
    throw new Error(
      `GLB: first chunk type 0x${jsonChunkType.toString(16)} is not JSON (0x${CHUNK_TYPE_JSON.toString(16)})`,
    );
  }
  pos += 8;
  if (pos + jsonChunkLength > totalLength) {
    throw new Error('GLB: JSON chunk extends beyond file');
  }
  const jsonBytes = new Uint8Array(data, pos, jsonChunkLength);
  const jsonStr = new TextDecoder().decode(jsonBytes);
  const json: GltfJson = JSON.parse(jsonStr) as GltfJson;
  pos += jsonChunkLength;

  // Chunk 1 — Binary (optional but expected for mesh data)
  let binChunk = new Uint8Array(0);
  if (pos + 8 <= totalLength) {
    const binChunkLength = headerView.getUint32(pos, true);
    const binChunkType = headerView.getUint32(pos + 4, true);
    if (binChunkType !== CHUNK_TYPE_BIN) {
      throw new Error(
        `GLB: second chunk type 0x${binChunkType.toString(16)} is not BIN (0x${CHUNK_TYPE_BIN.toString(16)})`,
      );
    }
    pos += 8;
    if (pos + binChunkLength > totalLength) {
      throw new Error('GLB: BIN chunk extends beyond file');
    }
    binChunk = new Uint8Array(data, pos, binChunkLength);
  }

  return buildPrimitivesFromJson(json, binChunk);
}

// ---------------------------------------------------------------------------
// glTF Text Format parser (.gltf + external .bin buffers)
// ---------------------------------------------------------------------------

/**
 * Parse a glTF text-format model from pre-fetched JSON and buffers.
 *
 * @param jsonObj  - The parsed JSON descriptor (from .gltf file).
 * @param buffers  - External .bin buffers referenced by the JSON (in order).
 */
export function parseGltfJson(jsonObj: unknown, buffers: ArrayBuffer[]): ParsedGltf {
  const json = jsonObj as GltfJson;

  // Concatenate all buffers into a single binary chunk for accessor reading.
  // glTF bufferViews reference specific buffers by index — we flatten
  // by adjusting byteOffsets to a single merged buffer.
  let totalSize = 0;
  for (const buf of buffers) totalSize += buf.byteLength;

  const merged = new Uint8Array(totalSize);
  const bufferOffsets: number[] = [];
  let writePos = 0;

  for (const buf of buffers) {
    bufferOffsets.push(writePos);
    merged.set(new Uint8Array(buf), writePos);
    writePos += buf.byteLength;
  }

  // Adjust bufferView offsets so all point into the merged buffer
  if (json.bufferViews) {
    for (const bv of json.bufferViews) {
      const baseOffset = bufferOffsets[bv.buffer] ?? 0;
      bv.byteOffset = (bv.byteOffset ?? 0) + baseOffset;
      bv.buffer = 0; // all point to merged buffer now
    }
  }

  return buildPrimitivesFromJson(json, merged);
}

// ---------------------------------------------------------------------------
// Shared primitive builder (used by both parseGlb and parseGltfJson)
// ---------------------------------------------------------------------------

function buildPrimitivesFromJson(json: GltfJson, binChunk: Uint8Array): ParsedGltf {
  if (!json.meshes || json.meshes.length === 0) {
    throw new Error('GLB: no meshes found in JSON');
  }
  const accessors = json.accessors ?? [];
  const bufferViews = json.bufferViews ?? [];

  const primitives: ParsedPrimitive[] = [];

  for (const gltfMesh of json.meshes) {
    for (const gltfPrim of gltfMesh.primitives) {
      const mesh = parsePrimitiveMesh(gltfPrim, accessors, bufferViews, binChunk);
      const material = parseMaterial(gltfPrim.material, json.materials);

      // Extract ALL referenced texture images
      const imageData = new Map<number, EmbeddedImageData>();
      const texIndices = [
        material.baseColorTextureIndex,
        material.normalTextureIndex,
        material.metallicRoughnessTextureIndex,
        material.occlusionTextureIndex,
        material.emissiveTextureIndex,
      ];
      for (const texIdx of texIndices) {
        if (texIdx !== undefined && !imageData.has(texIdx)) {
          const data = extractImageData(texIdx, json, bufferViews, binChunk);
          if (data) imageData.set(texIdx, data);
        }
      }

      primitives.push({ mesh, material, imageData, name: gltfMesh.name });
    }
  }

  if (primitives.length === 0) {
    throw new Error('GLB: no primitives found');
  }

  return { primitives };
}
