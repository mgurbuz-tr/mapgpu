/**
 * DTED binary parser (MIL-PRF-89020B).
 *
 * Parses DT0/DT1/DT2 files into row-major, north-up grids.
 */

import { DTED_NODATA } from '../types.js';
import type { DTEDHeader, DTEDLevelName, DTEDTile } from '../types.js';

const UHL_OFFSET = 0;
const UHL_SIZE = 80;
const DSI_SIZE = 648;
const ACC_SIZE = 2700;
const DATA_OFFSET = UHL_SIZE + DSI_SIZE + ACC_SIZE; // 3428
const RECORD_SENTINEL = 0xaa;

function parseUHL(buffer: ArrayBuffer): DTEDHeader {
  const bytes = new Uint8Array(buffer, UHL_OFFSET, UHL_SIZE);
  const sentinel = String.fromCharCode(bytes[0] ?? 0, bytes[1] ?? 0, bytes[2] ?? 0);
  if (sentinel !== 'UHL') {
    throw new Error(`Invalid DTED: expected UHL sentinel, got "${sentinel}"`);
  }

  const originLon = parseDMSLon(bytes, 4);
  const originLat = parseDMSLat(bytes, 12);
  const lonIntervalRaw = parseFixedInt(bytes, 20, 4);
  const latIntervalRaw = parseFixedInt(bytes, 24, 4);
  const numLonLines = parseFixedInt(bytes, 47, 4);
  const numLatPoints = parseFixedInt(bytes, 51, 4);

  return {
    originLon,
    originLat,
    lonInterval: lonIntervalRaw / 10,
    latInterval: latIntervalRaw / 10,
    numLonLines,
    numLatPoints,
  };
}

function parseDMSLon(bytes: Uint8Array, offset: number): number {
  const deg = parseFixedInt(bytes, offset, 3);
  const min = parseFixedInt(bytes, offset + 3, 2);
  const sec = parseFixedInt(bytes, offset + 5, 2);
  const hem = String.fromCharCode(bytes[offset + 7] ?? 69); // E
  const value = deg + min / 60 + sec / 3600;
  return hem === 'W' ? -value : value;
}

function parseDMSLat(bytes: Uint8Array, offset: number): number {
  const deg = parseFixedInt(bytes, offset, 2);
  const min = parseFixedInt(bytes, offset + 2, 2);
  const sec = parseFixedInt(bytes, offset + 4, 2);
  const hem = String.fromCharCode(bytes[offset + 6] ?? 78); // N
  const value = deg + min / 60 + sec / 3600;
  return hem === 'S' ? -value : value;
}

function parseFixedInt(bytes: Uint8Array, offset: number, length: number): number {
  let str = '';
  for (let i = 0; i < length; i++) {
    str += String.fromCharCode(bytes[offset + i] ?? 32);
  }
  return parseInt(str.trim(), 10) || 0;
}

export function detectDTEDLevel(fileName: string, header: DTEDHeader): DTEDLevelName {
  const ext = fileName.toLowerCase();
  if (ext.endsWith('.dt2')) return 'dt2';
  if (ext.endsWith('.dt1')) return 'dt1';
  if (ext.endsWith('.dt0')) return 'dt0';

  // Fallback by sample count.
  if (header.numLonLines <= 121) return 'dt0';
  if (header.numLonLines <= 1201) return 'dt1';
  return 'dt2';
}

/**
 * Extract cell origin from filename patterns:
 * - "e032/n39.dt2"   (directory structure)
 * - "E032/N39.dt2"
 * - "n39e032.dt2"    (lat-first flat)
 * - "e032n39.dt2"    (lon-first flat)
 */
export function extractCoordsFromFilename(fileName: string): [number, number] | null {
  const normalized = fileName.toLowerCase().replace(/\\/g, '/');

  // Directory format: "e032/n39.dt2"
  const dirMatch = normalized.match(/([ew])(\d{3})[/]([ns])(\d{2})/);
  if (dirMatch) {
    let lon = parseInt(dirMatch[2] ?? '0', 10);
    let lat = parseInt(dirMatch[4] ?? '0', 10);
    if (dirMatch[1] === 'w') lon = -lon;
    if (dirMatch[3] === 's') lat = -lat;
    return [lon, lat];
  }

  // Lat-first flat format: "n39e032.dt2"
  const latFirstMatch = normalized.match(/([ns])(\d{2})([ew])(\d{3})/);
  if (latFirstMatch) {
    let lat = parseInt(latFirstMatch[2] ?? '0', 10);
    let lon = parseInt(latFirstMatch[4] ?? '0', 10);
    if (latFirstMatch[1] === 's') lat = -lat;
    if (latFirstMatch[3] === 'w') lon = -lon;
    return [lon, lat];
  }

  // Lon-first flat format: "e032n39.dt2"
  const lonFirstMatch = normalized.match(/([ew])(\d{3})([ns])(\d{2})/);
  if (lonFirstMatch) {
    let lon = parseInt(lonFirstMatch[2] ?? '0', 10);
    let lat = parseInt(lonFirstMatch[4] ?? '0', 10);
    if (lonFirstMatch[1] === 'w') lon = -lon;
    if (lonFirstMatch[3] === 's') lat = -lat;
    return [lon, lat];
  }

  return null;
}

export interface ParseDTEDOptions {
  fileName?: string;
}

export function parseDTED(buffer: ArrayBuffer, options: ParseDTEDOptions = {}): DTEDTile {
  const fileName = options.fileName ?? '';
  const header = parseUHL(buffer);
  const cols = header.numLonLines;
  const rows = header.numLatPoints;
  if (cols <= 0 || rows <= 0) {
    throw new Error('Invalid DTED: zero-sized grid');
  }

  const level = detectDTEDLevel(fileName, header);
  const fileCoords = extractCoordsFromFilename(fileName);
  const originLon = fileCoords?.[0] ?? header.originLon;
  const originLat = fileCoords?.[1] ?? header.originLat;

  // Record layout:
  // sentinel(1) + seq(3) + lonCount(2) + latCount(2) + elevations(rows*2) + checksum(4)
  const recordHeaderSize = 8;
  const elevationBytes = rows * 2;
  const checksumSize = 4;
  const recordSize = recordHeaderSize + elevationBytes + checksumSize;

  const dataView = new DataView(buffer);
  const columnMajor = new Int16Array(cols * rows);

  let minElev = Number.POSITIVE_INFINITY;
  let maxElev = Number.NEGATIVE_INFINITY;

  for (let col = 0; col < cols; col++) {
    const recordOffset = DATA_OFFSET + col * recordSize;
    if (recordOffset >= buffer.byteLength) {
      throw new Error(`DTED truncated at column ${col}`);
    }

    const sentinel = dataView.getUint8(recordOffset);
    if (sentinel !== RECORD_SENTINEL) {
      throw new Error(
        `Invalid DTED record sentinel at column ${col}: expected 0xAA, got 0x${sentinel.toString(16)}`,
      );
    }

    const elevOffset = recordOffset + recordHeaderSize;
    for (let row = 0; row < rows; row++) {
      const value = dataView.getInt16(elevOffset + row * 2, false);
      const idx = col * rows + row;
      columnMajor[idx] = value;
      if (value !== DTED_NODATA) {
        if (value < minElev) minElev = value;
        if (value > maxElev) maxElev = value;
      }
    }
  }

  if (!Number.isFinite(minElev)) minElev = 0;
  if (!Number.isFinite(maxElev)) maxElev = 0;

  // Transpose column-major (south->north) to row-major north-up.
  const rowMajor = new Int16Array(cols * rows);
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const srcIdx = col * rows + row;
      const dstRow = rows - 1 - row;
      const dstIdx = dstRow * cols + col;
      rowMajor[dstIdx] = columnMajor[srcIdx] ?? DTED_NODATA;
    }
  }

  const latHem = originLat >= 0 ? 'n' : 's';
  const lonHem = originLon >= 0 ? 'e' : 'w';
  const id = `${latHem}${String(Math.abs(originLat)).padStart(2, '0')}${lonHem}${String(Math.abs(originLon)).padStart(3, '0')}_${level}`;

  return {
    id,
    level,
    origin: [originLon, originLat],
    width: cols,
    height: rows,
    elevations: rowMajor,
    minElevation: minElev,
    maxElevation: maxElev,
    extent: {
      minX: originLon,
      minY: originLat,
      maxX: originLon + 1,
      maxY: originLat + 1,
    },
  };
}
