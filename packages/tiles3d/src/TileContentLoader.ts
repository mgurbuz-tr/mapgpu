/**
 * 3D Tiles content decoder.
 *
 * Decodes B3DM, I3DM, PNTS, and CMPT tile formats
 * into parsed model data for rendering.
 */

import { parseGlb } from '@mapgpu/render-webgpu';
import type { ParsedGltf } from '@mapgpu/render-webgpu';

// ─── Tile Format Headers ───

const B3DM_MAGIC = 0x6233646D; // "b3dm"
const I3DM_MAGIC = 0x69336474; // "i3dm" (note: actually "i3dm" but hex may differ)
const PNTS_MAGIC = 0x746E7073; // "pnts"
const CMPT_MAGIC = 0x74706D63; // "cmpt"

/** Result of decoding a tile's content */
export interface DecodedTileContent {
  type: 'model' | 'points' | 'composite';
  /** Parsed glTF model (for B3DM/I3DM) */
  model?: ParsedGltf;
  /** Point cloud positions (for PNTS) */
  positions?: Float32Array;
  /** Point cloud colors (for PNTS, optional) */
  colors?: Uint8Array;
  /** Point count (for PNTS) */
  pointCount?: number;
  /** Instance transforms (for I3DM) */
  instanceTransforms?: Float32Array;
  instanceCount?: number;
  /** Sub-contents (for CMPT) */
  children?: DecodedTileContent[];
}

/** Decode a 3D Tiles content buffer based on its magic number. */
export function decodeTileContent(data: ArrayBuffer): DecodedTileContent {
  if (data.byteLength < 4) {
    throw new Error('3D Tiles: content too small');
  }

  const view = new DataView(data);
  const magic = view.getUint32(0, true);

  switch (magic) {
    case B3DM_MAGIC: return decodeB3DM(data, view);
    case I3DM_MAGIC: return decodeI3DM(data, view);
    case PNTS_MAGIC: return decodePNTS(data, view);
    case CMPT_MAGIC: return decodeCMPT(data, view);
    default:
      // Try as raw GLB
      if (magic === 0x46546C67) {
        return { type: 'model', model: parseGlb(data) };
      }
      throw new Error(`3D Tiles: unknown content format magic 0x${magic.toString(16)}`);
  }
}

function decodeB3DM(data: ArrayBuffer, view: DataView): DecodedTileContent {
  // B3DM header: magic(4) + version(4) + byteLength(4) +
  //              featureTableJSONByteLength(4) + featureTableBinaryByteLength(4) +
  //              batchTableJSONByteLength(4) + batchTableBinaryByteLength(4) = 28 bytes
  if (data.byteLength < 28) throw new Error('B3DM: header too small');

  const featureTableJSONLen = view.getUint32(12, true);
  const featureTableBinLen = view.getUint32(16, true);
  const batchTableJSONLen = view.getUint32(20, true);
  const batchTableBinLen = view.getUint32(24, true);

  const glbOffset = 28 + featureTableJSONLen + featureTableBinLen + batchTableJSONLen + batchTableBinLen;
  const glbData = data.slice(glbOffset);

  return {
    type: 'model',
    model: parseGlb(glbData),
  };
}

function decodeI3DM(data: ArrayBuffer, view: DataView): DecodedTileContent {
  // I3DM header: magic(4) + version(4) + byteLength(4) +
  //              featureTableJSONByteLength(4) + featureTableBinaryByteLength(4) +
  //              batchTableJSONByteLength(4) + batchTableBinaryByteLength(4) +
  //              gltfFormat(4) = 32 bytes
  if (data.byteLength < 32) throw new Error('I3DM: header too small');

  const featureTableJSONLen = view.getUint32(12, true);
  const featureTableBinLen = view.getUint32(16, true);
  const batchTableJSONLen = view.getUint32(20, true);
  const batchTableBinLen = view.getUint32(24, true);

  // Parse feature table for instance positions
  const ftJsonOffset = 32;
  const ftJsonBytes = new Uint8Array(data, ftJsonOffset, featureTableJSONLen);
  const ftJson = JSON.parse(new TextDecoder().decode(ftJsonBytes)) as Record<string, unknown>;

  const ftBinOffset = ftJsonOffset + featureTableJSONLen;
  const ftBin = new Uint8Array(data, ftBinOffset, featureTableBinLen);

  // Extract POSITION from feature table
  const instanceCount = (ftJson.INSTANCES_LENGTH ?? 0) as number;
  let instanceTransforms: Float32Array | undefined;

  if (instanceCount > 0 && ftJson.POSITION) {
    const posRef = ftJson.POSITION as { byteOffset: number };
    const posOffset = posRef.byteOffset ?? 0;
    instanceTransforms = new Float32Array(
      ftBin.buffer,
      ftBin.byteOffset + posOffset,
      instanceCount * 3,
    );
  }

  // Embedded GLB
  const glbOffset = 32 + featureTableJSONLen + featureTableBinLen + batchTableJSONLen + batchTableBinLen;
  const glbData = data.slice(glbOffset);

  return {
    type: 'model',
    model: parseGlb(glbData),
    instanceTransforms,
    instanceCount,
  };
}

function decodePNTS(data: ArrayBuffer, view: DataView): DecodedTileContent {
  // PNTS header: magic(4) + version(4) + byteLength(4) +
  //              featureTableJSONByteLength(4) + featureTableBinaryByteLength(4) +
  //              batchTableJSONByteLength(4) + batchTableBinaryByteLength(4) = 28 bytes
  if (data.byteLength < 28) throw new Error('PNTS: header too small');

  const featureTableJSONLen = view.getUint32(12, true);
  const featureTableBinLen = view.getUint32(16, true);

  const ftJsonBytes = new Uint8Array(data, 28, featureTableJSONLen);
  const ftJson = JSON.parse(new TextDecoder().decode(ftJsonBytes)) as Record<string, unknown>;
  const ftBin = new Uint8Array(data, 28 + featureTableJSONLen, featureTableBinLen);

  const pointCount = (ftJson.POINTS_LENGTH ?? 0) as number;
  let positions: Float32Array | undefined;
  let colors: Uint8Array | undefined;

  // POSITION
  if (ftJson.POSITION) {
    const posRef = ftJson.POSITION as { byteOffset: number };
    const aligned = new Float32Array(pointCount * 3);
    const src = new DataView(ftBin.buffer, ftBin.byteOffset + (posRef.byteOffset ?? 0), pointCount * 12);
    for (let i = 0; i < pointCount * 3; i++) {
      aligned[i] = src.getFloat32(i * 4, true);
    }
    positions = aligned;
  }

  // RGB (optional)
  if (ftJson.RGB) {
    const rgbRef = ftJson.RGB as { byteOffset: number };
    colors = new Uint8Array(pointCount * 3);
    colors.set(ftBin.subarray(rgbRef.byteOffset ?? 0, (rgbRef.byteOffset ?? 0) + pointCount * 3));
  }

  return { type: 'points', positions, colors, pointCount };
}

function decodeCMPT(data: ArrayBuffer, view: DataView): DecodedTileContent {
  // CMPT header: magic(4) + version(4) + byteLength(4) + tilesLength(4) = 16 bytes
  if (data.byteLength < 16) throw new Error('CMPT: header too small');

  const tilesLength = view.getUint32(12, true);
  const children: DecodedTileContent[] = [];
  let offset = 16;

  for (let i = 0; i < tilesLength; i++) {
    if (offset + 12 > data.byteLength) break;
    const innerLength = new DataView(data, offset + 8, 4).getUint32(0, true);
    const innerData = data.slice(offset, offset + innerLength);
    children.push(decodeTileContent(innerData));
    offset += innerLength;
  }

  return { type: 'composite', children };
}
