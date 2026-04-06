import { afterEach, describe, expect, it, vi } from 'vitest';
import { DTEDLayer } from './DTEDLayer.js';

function writeAscii(bytes: Uint8Array, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    bytes[offset + i] = text.charCodeAt(i);
  }
}

function toLonDms(lon: number): string {
  const hem = lon < 0 ? 'W' : 'E';
  return `${String(Math.abs(Math.trunc(lon))).padStart(3, '0')}0000${hem}`;
}

function toLatDms(lat: number): string {
  const hem = lat < 0 ? 'S' : 'N';
  return `${String(Math.abs(Math.trunc(lat))).padStart(2, '0')}0000${hem}`;
}

function createConstantDTEDBuffer(levelExt: 'dt0' | 'dt1' | 'dt2', value: number, lon = 0, lat = 0): { name: string; buffer: ArrayBuffer } {
  const cols = 2;
  const rows = 2;
  const recordSize = 8 + rows * 2 + 4;
  const total = 3428 + cols * recordSize;
  const buffer = new ArrayBuffer(total);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  bytes.fill(32);

  writeAscii(bytes, 0, 'UHL');
  writeAscii(bytes, 3, '1');
  writeAscii(bytes, 4, toLonDms(lon));
  writeAscii(bytes, 12, toLatDms(lat));
  writeAscii(bytes, 20, '0010');
  writeAscii(bytes, 24, '0010');
  writeAscii(bytes, 47, '0002');
  writeAscii(bytes, 51, '0002');

  for (let col = 0; col < cols; col++) {
    const recordOffset = 3428 + col * recordSize;
    view.setUint8(recordOffset, 0xaa);
    const elevOffset = recordOffset + 8;
    view.setInt16(elevOffset + 0, value, false);
    view.setInt16(elevOffset + 2, value, false);
  }

  const lonHem = lon < 0 ? 'W' : 'E';
  const latHem = lat < 0 ? 'S' : 'N';
  const name = `${lonHem}${String(Math.abs(lon)).padStart(3, '0')}/${latHem}${String(Math.abs(lat)).padStart(2, '0')}.${levelExt}`;
  return { name, buffer };
}

function mean(data: Float32Array): number {
  if (data.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i] ?? 0;
  }
  return sum / data.length;
}

describe('DTEDLayer (hybrid source)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prefers higher level data (DT2 > DT1) when both are available', async () => {
    const localDt1 = createConstantDTEDBuffer('dt1', 100, 0, 0);
    const remoteDt2 = createConstantDTEDBuffer('dt2', 200, 0, 0);

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => remoteDt2.buffer,
    }));
    vi.stubGlobal('fetch', fetchMock);

    const layer = new DTEDLayer({
      mode: 'hybrid',
      localFiles: [localDt1],
      urlForCell: ({ lon, lat, level }) => (level === 'dt2' && lon === 0 && lat === 0
        ? 'https://example.test/e000/n00.dt2'
        : null),
      tileSize: 16,
      hillshade2D: { enabled: false },
    });

    await layer.load();
    await layer.requestTile(9, 256, 255); // tile bounds inside cell [0,0]

    const ready = layer.getReadyHeightTile(9, 256, 255);
    expect(ready).not.toBeNull();
    const avg = mean(ready!.data);
    expect(avg).toBeGreaterThan(150);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('falls back to lower level local data when remote higher level is missing', async () => {
    const localDt1 = createConstantDTEDBuffer('dt1', 100, 0, 0);

    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 404,
      arrayBuffer: async () => new ArrayBuffer(0),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const layer = new DTEDLayer({
      mode: 'hybrid',
      localFiles: [localDt1],
      urlForCell: ({ lon, lat, level }) => (level === 'dt2' && lon === 0 && lat === 0
        ? 'https://example.test/e000/n00.dt2'
        : null),
      tileSize: 16,
      hillshade2D: { enabled: false },
    });

    await layer.load();
    await layer.requestTile(9, 256, 255);

    const ready = layer.getReadyHeightTile(9, 256, 255);
    expect(ready).not.toBeNull();
    const avg = mean(ready!.data);
    expect(avg).toBeGreaterThan(90);
    expect(avg).toBeLessThan(110);
  });

  it('does not produce hillshade tile where DTED coverage is missing', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 404,
      arrayBuffer: async () => new ArrayBuffer(0),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const layer = new DTEDLayer({
      mode: 'hybrid',
      localFiles: [],
      urlForCell: () => null,
      tileSize: 16,
      hillshade2D: { enabled: true, opacity: 0.5, azimuth: 315, altitude: 45 },
    });

    await layer.load();
    await layer.requestTile(3, 4, 2);

    const hillshade = layer.getReadyHillshadeTile(3, 4, 2);
    expect(hillshade).toBeNull();
  });

  it('allows runtime hillshade2D updates via API', () => {
    const layer = new DTEDLayer({
      mode: 'local',
      localFiles: [],
      hillshade2D: { enabled: true, opacity: 0.45, azimuth: 315, altitude: 45, softness: 0.25 },
    });

    layer.setHillshade2D({ softness: 0.8, opacity: 0.3 });
    expect(layer.hillshade2D.softness).toBeCloseTo(0.8, 6);
    expect(layer.opacity).toBeCloseTo(0.3, 6);
  });

  it('allows runtime 3D lighting updates via API', () => {
    const layer = new DTEDLayer({
      mode: 'local',
      localFiles: [],
      lighting3D: {
        enabled: true,
        sunAzimuth: 315,
        sunAltitude: 45,
        ambient: 0.35,
        diffuse: 0.85,
        shadowStrength: 0.35,
        shadowSoftness: 0.4,
      },
    });

    layer.setLighting3D({ sunAzimuth: 150, shadowStrength: 0.6, ambient: 0.25 });
    expect(layer.lighting3D.sunAzimuth).toBeCloseTo(150, 6);
    expect(layer.lighting3D.shadowStrength).toBeCloseTo(0.6, 6);
    expect(layer.lighting3D.ambient).toBeCloseTo(0.25, 6);
  });
});
