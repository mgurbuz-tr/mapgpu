import { describe, it, expect } from 'vitest';
import { detectDTEDLevel, extractCoordsFromFilename, parseDTED } from './dted-parser.js';

function writeAscii(bytes: Uint8Array, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    bytes[offset + i] = text.charCodeAt(i);
  }
}

function writeInt16BE(view: DataView, offset: number, value: number): void {
  view.setInt16(offset, value, false);
}

function createDTEDBuffer(options: {
  cols: number;
  rows: number;
  elevationsByColumn: number[][];
  originLon?: string;
  originLat?: string;
}): ArrayBuffer {
  const cols = options.cols;
  const rows = options.rows;
  const recordSize = 8 + rows * 2 + 4;
  const total = 3428 + cols * recordSize;
  const buffer = new ArrayBuffer(total);
  const bytes = new Uint8Array(buffer);
  bytes.fill(32); // spaces
  const view = new DataView(buffer);

  writeAscii(bytes, 0, 'UHL');
  writeAscii(bytes, 3, '1');
  writeAscii(bytes, 4, options.originLon ?? '0320000E');  // DDDMMSSH
  writeAscii(bytes, 12, options.originLat ?? '390000N');  // DDMMSSH
  writeAscii(bytes, 20, '0010'); // lon interval (0.1 arcsec units)
  writeAscii(bytes, 24, '0010'); // lat interval
  writeAscii(bytes, 47, String(cols).padStart(4, '0'));
  writeAscii(bytes, 51, String(rows).padStart(4, '0'));

  for (let col = 0; col < cols; col++) {
    const recordOffset = 3428 + col * recordSize;
    view.setUint8(recordOffset, 0xaa);
    const elevOffset = recordOffset + 8;
    const values = options.elevationsByColumn[col] ?? [];
    for (let row = 0; row < rows; row++) {
      writeInt16BE(view, elevOffset + row * 2, values[row] ?? 0);
    }
  }

  return buffer;
}

describe('dted-parser', () => {
  it('detects level from extension', () => {
    expect(detectDTEDLevel('foo.dt2', {
      originLon: 0,
      originLat: 0,
      lonInterval: 1,
      latInterval: 1,
      numLonLines: 10,
      numLatPoints: 10,
    })).toBe('dt2');
  });

  it('extracts coordinates from canonical file names', () => {
    expect(extractCoordsFromFilename('E032/N39.dt2')).toEqual([32, 39]);
    expect(extractCoordsFromFilename('n39e032.dt2')).toEqual([32, 39]);
    expect(extractCoordsFromFilename('W120/S07.dt1')).toEqual([-120, -7]);
  });

  it('parses header/grid and transposes to north-up row-major', () => {
    const buffer = createDTEDBuffer({
      cols: 2,
      rows: 2,
      // DTED record rows are south->north per column
      elevationsByColumn: [
        [100, 200], // col 0: south=100, north=200
        [300, 400], // col 1: south=300, north=400
      ],
    });

    const tile = parseDTED(buffer, { fileName: 'E032/N39.dt2' });
    expect(tile.level).toBe('dt2');
    expect(tile.origin).toEqual([32, 39]);
    expect(tile.width).toBe(2);
    expect(tile.height).toBe(2);
    expect(tile.minElevation).toBe(100);
    expect(tile.maxElevation).toBe(400);

    // Row-major north-up:
    // row0(north): [200, 400]
    // row1(south): [100, 300]
    expect([...tile.elevations]).toEqual([200, 400, 100, 300]);
  });
});
