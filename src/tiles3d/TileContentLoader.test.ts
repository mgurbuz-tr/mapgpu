import { describe, it, expect, vi } from 'vitest';

// We need to mock parseGlb since it depends on full GLB parsing
vi.mock('../render/index.js', () => ({
  parseGlb: vi.fn().mockReturnValue({
    meshes: [],
    materials: [],
  }),
}));

import { decodeTileContent } from './TileContentLoader.js';

// ─── Helpers to build binary tile data ───

function writeUint32LE(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, true);
}

function createB3DMBuffer(
  featureTableJSONLen = 0,
  featureTableBinLen = 0,
  batchTableJSONLen = 0,
  batchTableBinLen = 0,
): ArrayBuffer {
  const glbMagic = 0x46546C67; // "glTF"
  const glbVersion = 2;
  const glbMinSize = 12;
  const headerSize = 28;
  const totalSize = headerSize + featureTableJSONLen + featureTableBinLen +
    batchTableJSONLen + batchTableBinLen + glbMinSize;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  writeUint32LE(view, 0, 0x6233646D);  // B3DM magic
  writeUint32LE(view, 4, 1);            // version
  writeUint32LE(view, 8, totalSize);     // byteLength
  writeUint32LE(view, 12, featureTableJSONLen);
  writeUint32LE(view, 16, featureTableBinLen);
  writeUint32LE(view, 20, batchTableJSONLen);
  writeUint32LE(view, 24, batchTableBinLen);

  // Write minimal GLB header at glbOffset
  const glbOffset = headerSize + featureTableJSONLen + featureTableBinLen +
    batchTableJSONLen + batchTableBinLen;
  writeUint32LE(view, glbOffset, glbMagic);
  writeUint32LE(view, glbOffset + 4, glbVersion);
  writeUint32LE(view, glbOffset + 8, glbMinSize);

  return buffer;
}

function createPNTSBuffer(pointCount: number, includeRGB = false): ArrayBuffer {
  const ftJson: Record<string, unknown> = { POINTS_LENGTH: pointCount };

  // Position data
  const positionByteLength = pointCount * 3 * 4; // 3 floats per point
  ftJson.POSITION = { byteOffset: 0 };

  let rgbByteLength = 0;
  if (includeRGB) {
    ftJson.RGB = { byteOffset: positionByteLength };
    rgbByteLength = pointCount * 3;
  }

  const ftJsonStr = JSON.stringify(ftJson);
  // Pad to 8-byte alignment
  const ftJsonPadded = ftJsonStr.padEnd(Math.ceil(ftJsonStr.length / 8) * 8, ' ');
  const ftJsonLen = ftJsonPadded.length;
  const ftBinLen = positionByteLength + rgbByteLength;

  const headerSize = 28;
  const totalSize = headerSize + ftJsonLen + ftBinLen;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  writeUint32LE(view, 0, 0x746E7073);  // PNTS magic
  writeUint32LE(view, 4, 1);
  writeUint32LE(view, 8, totalSize);
  writeUint32LE(view, 12, ftJsonLen);
  writeUint32LE(view, 16, ftBinLen);
  writeUint32LE(view, 20, 0);  // batchTableJSON
  writeUint32LE(view, 24, 0);  // batchTableBin

  // Write feature table JSON
  const encoder = new TextEncoder();
  const jsonBytes = encoder.encode(ftJsonPadded);
  new Uint8Array(buffer, headerSize, ftJsonLen).set(jsonBytes);

  // Write position data (some test values)
  const posView = new DataView(buffer, headerSize + ftJsonLen);
  for (let i = 0; i < pointCount * 3; i++) {
    posView.setFloat32(i * 4, i * 1.5, true);
  }

  // Write RGB data if requested
  if (includeRGB) {
    const rgbArray = new Uint8Array(buffer, headerSize + ftJsonLen + positionByteLength);
    for (let i = 0; i < pointCount * 3; i++) {
      rgbArray[i] = (i * 37) % 256;
    }
  }

  return buffer;
}

function createCMPTBuffer(innerTiles: ArrayBuffer[]): ArrayBuffer {
  const headerSize = 16;
  let innerSize = 0;
  for (const tile of innerTiles) {
    innerSize += tile.byteLength;
  }

  const totalSize = headerSize + innerSize;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  writeUint32LE(view, 0, 0x74706D63);  // CMPT magic
  writeUint32LE(view, 4, 1);
  writeUint32LE(view, 8, totalSize);
  writeUint32LE(view, 12, innerTiles.length);

  let offset = headerSize;
  for (const tile of innerTiles) {
    new Uint8Array(buffer, offset, tile.byteLength).set(new Uint8Array(tile));
    offset += tile.byteLength;
  }

  return buffer;
}

describe('TileContentLoader', () => {
  describe('decodeTileContent', () => {
    it('throws for content too small', () => {
      const tiny = new ArrayBuffer(2);
      expect(() => decodeTileContent(tiny)).toThrow('content too small');
    });

    it('throws for unknown magic', () => {
      const buffer = new ArrayBuffer(8);
      const view = new DataView(buffer);
      writeUint32LE(view, 0, 0xDEADBEEF);
      expect(() => decodeTileContent(buffer)).toThrow('unknown content format');
    });
  });

  describe('B3DM decoding', () => {
    it('decodes a minimal B3DM tile', () => {
      const buffer = createB3DMBuffer();
      const result = decodeTileContent(buffer);

      expect(result.type).toBe('model');
      expect(result.model).toBeDefined();
    });

    it('throws for B3DM header too small', () => {
      const buffer = new ArrayBuffer(20);
      const view = new DataView(buffer);
      writeUint32LE(view, 0, 0x6233646D);
      expect(() => decodeTileContent(buffer)).toThrow('header too small');
    });

    it('skips feature table and batch table correctly', () => {
      const buffer = createB3DMBuffer(16, 0, 8, 0);
      const result = decodeTileContent(buffer);
      expect(result.type).toBe('model');
    });
  });

  describe('PNTS decoding', () => {
    it('decodes a PNTS tile with positions', () => {
      const buffer = createPNTSBuffer(10);
      const result = decodeTileContent(buffer);

      expect(result.type).toBe('points');
      expect(result.pointCount).toBe(10);
      expect(result.positions).toBeInstanceOf(Float32Array);
      expect(result.positions!.length).toBe(30); // 10 points * 3
    });

    it('decodes a PNTS tile with RGB colors', () => {
      const buffer = createPNTSBuffer(5, true);
      const result = decodeTileContent(buffer);

      expect(result.type).toBe('points');
      expect(result.pointCount).toBe(5);
      expect(result.colors).toBeInstanceOf(Uint8Array);
      expect(result.colors!.length).toBe(15); // 5 points * 3
    });

    it('handles PNTS without RGB', () => {
      const buffer = createPNTSBuffer(3, false);
      const result = decodeTileContent(buffer);

      expect(result.type).toBe('points');
      expect(result.colors).toBeUndefined();
    });

    it('throws for PNTS header too small', () => {
      const buffer = new ArrayBuffer(20);
      const view = new DataView(buffer);
      writeUint32LE(view, 0, 0x746E7073);
      expect(() => decodeTileContent(buffer)).toThrow('header too small');
    });
  });

  describe('CMPT decoding', () => {
    it('decodes composite with multiple inner tiles', () => {
      const pnts = createPNTSBuffer(5);
      const b3dm = createB3DMBuffer();
      const buffer = createCMPTBuffer([pnts, b3dm]);

      const result = decodeTileContent(buffer);

      expect(result.type).toBe('composite');
      expect(result.children).toHaveLength(2);
      expect(result.children![0]!.type).toBe('points');
      expect(result.children![1]!.type).toBe('model');
    });

    it('decodes empty composite', () => {
      const buffer = createCMPTBuffer([]);
      const result = decodeTileContent(buffer);

      expect(result.type).toBe('composite');
      expect(result.children).toHaveLength(0);
    });

    it('throws for CMPT header too small', () => {
      const buffer = new ArrayBuffer(12);
      const view = new DataView(buffer);
      writeUint32LE(view, 0, 0x74706D63);
      expect(() => decodeTileContent(buffer)).toThrow('header too small');
    });
  });

  describe('raw GLB fallback', () => {
    it('decodes raw GLB data', () => {
      const buffer = new ArrayBuffer(16);
      const view = new DataView(buffer);
      writeUint32LE(view, 0, 0x46546C67); // glTF magic
      writeUint32LE(view, 4, 2);           // version
      writeUint32LE(view, 8, 16);          // length

      const result = decodeTileContent(buffer);
      expect(result.type).toBe('model');
    });
  });
});
