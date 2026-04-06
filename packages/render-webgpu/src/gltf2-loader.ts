/**
 * GLTF 2.0 Loader — Clean reimplementation for GPU-ready primitives.
 *
 * Parses GLB binary or glTF JSON+buffers into GPU-ready primitives.
 * Node TRS transforms and animation clips are preserved for runtime playback.
 * Textures are extracted as raw byte arrays for later GPU upload.
 */

import {
  computeWorldMatrices,
  createEmptyBounds,
  expandBounds,
  finalizeBounds,
  getOrderedBoundsCorners,
  transformPointMat4,
} from './model-spatial.js';

// ─── Public types ───

export interface Gltf2Mesh {
  positions: Float32Array;
  normals: Float32Array;
  texcoords: Float32Array;
  indices: Uint16Array | Uint32Array;
  vertexCount: number;
  indexCount: number;
  bounds: { min: [number, number, number]; max: [number, number, number] };
}

export interface Gltf2TextureData {
  data: Uint8Array;
  mimeType: string;
}

export interface Gltf2Material {
  baseColorFactor: [number, number, number, number];
  metallicFactor: number;
  roughnessFactor: number;
  doubleSided: boolean;
  alphaMode: 'OPAQUE' | 'MASK' | 'BLEND';
  alphaCutoff: number;
  unlit: boolean;
  baseColorTexture?: Gltf2TextureData;
  normalTexture?: Gltf2TextureData;
  metallicRoughnessTexture?: Gltf2TextureData;
  occlusionTexture?: Gltf2TextureData;
  emissiveTexture?: Gltf2TextureData;
  emissiveFactor: [number, number, number];
}

export interface Gltf2Primitive {
  mesh: Gltf2Mesh;
  material: Gltf2Material;
  name?: string;
  nodeIndex?: number;
}

export interface Gltf2Node {
  name?: string;
  mesh?: number;
  translation: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
  children: number[];
  parentIndex: number | null;
}

export interface Gltf2AnimationChannel {
  node: number;
  path: 'translation' | 'rotation' | 'scale';
  interpolation: 'STEP' | 'LINEAR' | 'CUBICSPLINE';
  input: Float32Array;
  output: Float32Array;
}

export interface Gltf2AnimationClip {
  name?: string;
  duration: number;
  channels: Gltf2AnimationChannel[];
}

export interface Gltf2Model {
  primitives: Gltf2Primitive[];
  boundingBox: { min: [number, number, number]; max: [number, number, number] };
  nodes: Gltf2Node[];
  animations: Gltf2AnimationClip[];
}

// ─── Internal GLTF JSON types ───

interface GltfAccessor {
  bufferView?: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: string;
}

interface GltfBufferView {
  buffer: number;
  byteOffset?: number;
  byteLength: number;
  byteStride?: number;
}

interface GltfPrimitive { attributes: Record<string, number>; indices?: number; material?: number; }
interface GltfMesh { primitives: GltfPrimitive[]; name?: string; }
interface GltfMaterial {
  pbrMetallicRoughness?: {
    baseColorFactor?: number[];
    metallicFactor?: number;
    roughnessFactor?: number;
    baseColorTexture?: { index: number };
    metallicRoughnessTexture?: { index: number };
  };
  normalTexture?: { index: number };
  occlusionTexture?: { index: number };
  emissiveFactor?: number[];
  emissiveTexture?: { index: number };
  alphaMode?: string;
  alphaCutoff?: number;
  doubleSided?: boolean;
  extensions?: { KHR_materials_unlit?: Record<string, never>; [k: string]: unknown };
  name?: string;
}
interface GltfNode {
  mesh?: number;
  name?: string;
  translation?: [number, number, number];
  rotation?: [number, number, number, number];
  scale?: [number, number, number];
  children?: number[];
}
interface GltfImage { bufferView?: number; mimeType?: string; uri?: string; }
interface GltfTexture { source?: number; }
interface GltfAnimationSamplerDef {
  input: number;
  output: number;
  interpolation?: string;
}
interface GltfAnimationChannelDef {
  sampler: number;
  target: { node?: number; path?: string };
}
interface GltfAnimationDef {
  name?: string;
  samplers?: GltfAnimationSamplerDef[];
  channels?: GltfAnimationChannelDef[];
}
interface GltfJson {
  asset: { version: string };
  meshes?: GltfMesh[];
  accessors?: GltfAccessor[];
  bufferViews?: GltfBufferView[];
  buffers?: { byteLength: number; uri?: string }[];
  materials?: GltfMaterial[];
  images?: GltfImage[];
  textures?: GltfTexture[];
  nodes?: GltfNode[];
  animations?: GltfAnimationDef[];
  scenes?: { nodes?: number[] }[];
  scene?: number;
}

// ─── Constants ───

const COMPONENT_SIZE: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const TYPE_COUNT: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

// ─── Helpers ───

function readAccessor(acc: GltfAccessor, bvs: GltfBufferView[], bin: Uint8Array): Float32Array | Uint16Array | Uint32Array {
  const compCount = TYPE_COUNT[acc.type] ?? 1;
  const byteSize = COMPONENT_SIZE[acc.componentType] ?? 4;
  const total = acc.count * compCount;

  if (acc.bufferView === undefined) {
    return acc.componentType === 5126 ? new Float32Array(total) : new Uint32Array(total);
  }

  const bv = bvs[acc.bufferView]!;
  const start = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);

  // Handle byteStride (interleaved data)
  if (bv.byteStride && bv.byteStride > compCount * byteSize) {
    const out = new Float32Array(total);
    for (let i = 0; i < acc.count; i++) {
      const srcOff = start + i * bv.byteStride;
      for (let c = 0; c < compCount; c++) {
        const dv = new DataView(bin.buffer, bin.byteOffset + srcOff + c * byteSize, byteSize);
        out[i * compCount + c] = acc.componentType === 5126 ? dv.getFloat32(0, true) : dv.getUint16(0, true);
      }
    }
    return out;
  }

  // Non-interleaved: copy into aligned buffer
  const sliceLen = total * byteSize;
  const aligned = new ArrayBuffer(sliceLen);
  new Uint8Array(aligned).set(bin.subarray(start, start + sliceLen));

  switch (acc.componentType) {
    case 5123: return new Uint16Array(aligned, 0, total);
    case 5125: return new Uint32Array(aligned, 0, total);
    default:   return new Float32Array(aligned, 0, total);
  }
}

function toFloat32(arr: Float32Array | Uint16Array | Uint32Array): Float32Array {
  if (arr instanceof Float32Array) return arr;
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) out[i] = arr[i]!;
  return out;
}

function parseAnimations(
  json: GltfJson,
  accs: GltfAccessor[],
  bvs: GltfBufferView[],
  bin: Uint8Array,
): Gltf2AnimationClip[] {
  const animations: Gltf2AnimationClip[] = [];

  for (const anim of json.animations ?? []) {
    const channels: Gltf2AnimationChannel[] = [];

    for (const channel of anim.channels ?? []) {
      const samplerDef = anim.samplers?.[channel.sampler];
      const node = channel.target.node;
      const path = channel.target.path;
      if (!samplerDef || node === undefined) continue;
      if (path !== 'translation' && path !== 'rotation' && path !== 'scale') continue;

      const inputAccessor = accs[samplerDef.input];
      const outputAccessor = accs[samplerDef.output];
      if (!inputAccessor || !outputAccessor) continue;

      channels.push({
        node,
        path,
        interpolation: (samplerDef.interpolation as Gltf2AnimationChannel['interpolation']) ?? 'LINEAR',
        input: toFloat32(readAccessor(inputAccessor, bvs, bin)),
        output: toFloat32(readAccessor(outputAccessor, bvs, bin)),
      });
    }

    if (channels.length === 0) continue;

    let duration = 0;
    for (const channel of channels) {
      const last = channel.input[channel.input.length - 1] ?? 0;
      if (last > duration) duration = last;
    }

    animations.push({
      name: anim.name,
      duration,
      channels,
    });
  }

  return animations;
}

function parseMesh(prim: GltfPrimitive, accs: GltfAccessor[], bvs: GltfBufferView[], bin: Uint8Array): Gltf2Mesh {
  const posAcc = accs[prim.attributes.POSITION!]!;
  const positions = toFloat32(readAccessor(posAcc, bvs, bin));
  const vertexCount = posAcc.count;
  const bounds = createEmptyBounds();
  for (let i = 0; i < vertexCount; i++) {
    expandBounds(bounds, [
      positions[i * 3]!,
      positions[i * 3 + 1]!,
      positions[i * 3 + 2]!,
    ]);
  }

  const normIdx = prim.attributes.NORMAL;
  const normals = normIdx !== undefined
    ? toFloat32(readAccessor(accs[normIdx]!, bvs, bin))
    : (() => { const n = new Float32Array(vertexCount * 3); for (let i = 0; i < vertexCount; i++) n[i * 3 + 2] = 1; return n; })();

  const texIdx = prim.attributes.TEXCOORD_0;
  const texcoords = texIdx !== undefined
    ? toFloat32(readAccessor(accs[texIdx]!, bvs, bin))
    : new Float32Array(vertexCount * 2);

  let indices: Uint16Array | Uint32Array;
  let indexCount: number;
  if (prim.indices !== undefined) {
    const raw = readAccessor(accs[prim.indices]!, bvs, bin);
    indices = raw instanceof Float32Array
      ? new Uint32Array(raw)
      : raw;
    indexCount = accs[prim.indices]!.count;
  } else {
    indices = new Uint32Array(vertexCount);
    for (let i = 0; i < vertexCount; i++) indices[i] = i;
    indexCount = vertexCount;
  }

  return { positions, normals, texcoords, indices, vertexCount, indexCount, bounds: finalizeBounds(bounds) };
}

function parseMaterial(idx: number | undefined, mats: GltfMaterial[] | undefined, json: GltfJson, bvs: GltfBufferView[], bin: Uint8Array): Gltf2Material {
  const def: Gltf2Material = {
    baseColorFactor: [1, 1, 1, 1], metallicFactor: 1, roughnessFactor: 1,
    doubleSided: false, alphaMode: 'OPAQUE', alphaCutoff: 0.5, unlit: false,
    emissiveFactor: [0, 0, 0],
  };
  if (idx === undefined || !mats || !mats[idx]) return def;

  const m = mats[idx]!;
  const pbr = m.pbrMetallicRoughness;
  const bcf = pbr?.baseColorFactor;

  const result: Gltf2Material = {
    baseColorFactor: bcf && bcf.length >= 4 ? [bcf[0]!, bcf[1]!, bcf[2]!, bcf[3]!] : def.baseColorFactor,
    metallicFactor: pbr?.metallicFactor ?? def.metallicFactor,
    roughnessFactor: pbr?.roughnessFactor ?? def.roughnessFactor,
    doubleSided: m.doubleSided ?? false,
    alphaMode: (m.alphaMode as Gltf2Material['alphaMode']) ?? 'OPAQUE',
    alphaCutoff: m.alphaCutoff ?? 0.5,
    unlit: m.extensions?.KHR_materials_unlit !== undefined,
    emissiveFactor: m.emissiveFactor && m.emissiveFactor.length >= 3
      ? [m.emissiveFactor[0]!, m.emissiveFactor[1]!, m.emissiveFactor[2]!] : [0, 0, 0],
  };

  // Extract texture data inline
  const extractTex = (texIdx: number | undefined): Gltf2TextureData | undefined => {
    if (texIdx === undefined) return undefined;
    const tex = json.textures?.[texIdx];
    if (!tex || tex.source === undefined) return undefined;
    const img = json.images?.[tex.source];
    if (!img) return undefined;

    if (img.bufferView !== undefined) {
      const bv = bvs[img.bufferView]!;
      const off = bv.byteOffset ?? 0;
      const data = new Uint8Array(bv.byteLength);
      data.set(bin.subarray(off, off + bv.byteLength));
      return { data, mimeType: img.mimeType ?? 'image/png' };
    }
    // data: URI images
    if (img.uri?.startsWith('data:')) {
      const [header, b64] = img.uri.split(',');
      const mime = header?.match(/data:(.*?);/)?.[1] ?? 'image/png';
      const binary = atob(b64!);
      const data = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i);
      return { data, mimeType: mime };
    }
    return undefined;
  };

  result.baseColorTexture = extractTex(pbr?.baseColorTexture?.index);
  result.normalTexture = extractTex(m.normalTexture?.index);
  result.metallicRoughnessTexture = extractTex(pbr?.metallicRoughnessTexture?.index);
  result.occlusionTexture = extractTex(m.occlusionTexture?.index);
  result.emissiveTexture = extractTex(m.emissiveTexture?.index);

  return result;
}

// ─── Main API ───

function buildFromJson(json: GltfJson, bin: Uint8Array): Gltf2Model {
  if (!json.meshes?.length) throw new Error('GLTF2: no meshes');
  const accs = json.accessors ?? [];
  const bvs = json.bufferViews ?? [];
  const primitives: Gltf2Primitive[] = [];
  const parentIndices = new Array((json.nodes ?? []).length).fill(null) as Array<number | null>;
  (json.nodes ?? []).forEach((node, parentIndex) => {
    for (const childIndex of node.children ?? []) {
      parentIndices[childIndex] = parentIndex;
    }
  });
  const nodes: Gltf2Node[] = (json.nodes ?? []).map((node, nodeIndex) => ({
    name: node.name,
    mesh: node.mesh,
    translation: node.translation ?? [0, 0, 0],
    rotation: node.rotation ?? [0, 0, 0, 1],
    scale: node.scale ?? [1, 1, 1],
    children: [...(node.children ?? [])],
    parentIndex: parentIndices[nodeIndex] ?? null,
  }));
  const animations = parseAnimations(json, accs, bvs, bin);

  const bbox = createEmptyBounds();
  const { worldMatrices } = computeWorldMatrices(nodes, nodes.map((node) => node.translation), nodes.map((node) => node.rotation), nodes.map((node) => node.scale));

  const processMesh = (meshIdx: number, node?: GltfNode, nodeIndex?: number) => {
    const gltfMesh = json.meshes![meshIdx]!;
    for (const gltfPrim of gltfMesh.primitives) {
      const mesh = parseMesh(gltfPrim, accs, bvs, bin);
      const material = parseMaterial(gltfPrim.material, json.materials, json, bvs, bin);

      const nodeWorldMatrix = nodeIndex === undefined ? null : (worldMatrices[nodeIndex] ?? null);
      for (const corner of getOrderedBoundsCorners(mesh.bounds)) {
        const worldPoint = nodeWorldMatrix
          ? transformPointMat4(nodeWorldMatrix, corner)
          : corner;
        expandBounds(bbox, worldPoint);
      }

      primitives.push({ mesh, material, name: node?.name ?? gltfMesh.name, nodeIndex });
    }
  };

  if (json.nodes?.length) {
    const processed = new Set<number>();
    json.nodes.forEach((node, nodeIndex) => {
      if (node.mesh === undefined) return;
      processed.add(node.mesh);
      processMesh(node.mesh, node, nodeIndex);
    });
    // Unreferenced meshes
    for (let i = 0; i < json.meshes.length; i++) {
      if (!processed.has(i)) processMesh(i);
    }
  } else {
    for (let i = 0; i < json.meshes.length; i++) processMesh(i);
  }

  if (!primitives.length) throw new Error('GLTF2: no primitives');
  return { primitives, boundingBox: finalizeBounds(bbox), nodes, animations };
}

/** Parse a GLB binary file. */
export function parseGlb2(data: ArrayBuffer): Gltf2Model {
  const view = new DataView(data);
  if (view.getUint32(0, true) !== 0x46546C67) throw new Error('GLTF2: invalid GLB magic');
  if (view.getUint32(4, true) !== 2) throw new Error('GLTF2: unsupported version');

  let pos = 12;
  const jsonLen = view.getUint32(pos, true); pos += 8;
  const json: GltfJson = JSON.parse(new TextDecoder().decode(new Uint8Array(data, pos, jsonLen)));
  pos += jsonLen;

  let bin = new Uint8Array(0);
  if (pos + 8 <= data.byteLength) {
    const binLen = view.getUint32(pos, true); pos += 8;
    bin = new Uint8Array(data, pos, binLen);
  }

  return buildFromJson(json, bin);
}

/** Parse a glTF JSON + external buffers. */
export function parseGltf2(jsonObj: unknown, buffers: ArrayBuffer[]): Gltf2Model {
  const json = jsonObj as GltfJson;

  // Merge buffers
  let totalSize = 0;
  for (const buf of buffers) totalSize += buf.byteLength;
  const merged = new Uint8Array(totalSize);
  const offsets: number[] = [];
  let wp = 0;
  for (const buf of buffers) {
    offsets.push(wp);
    merged.set(new Uint8Array(buf), wp);
    wp += buf.byteLength;
  }

  // Adjust bufferView offsets
  if (json.bufferViews) {
    for (const bv of json.bufferViews) {
      bv.byteOffset = (bv.byteOffset ?? 0) + (offsets[bv.buffer] ?? 0);
      bv.buffer = 0;
    }
  }

  return buildFromJson(json, merged);
}
