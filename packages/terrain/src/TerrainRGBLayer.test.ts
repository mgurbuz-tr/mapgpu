import { afterEach, describe, expect, it, vi } from 'vitest';
import { TerrainRGBLayer } from './TerrainRGBLayer.js';
import type { TerrainRGBImageData } from './types.js';

function encodeTerrainRgb(heightMeters: number): [number, number, number] {
  const v = Math.round((heightMeters + 10000) * 10);
  const r = Math.floor(v / 65536);
  const g = Math.floor((v - r * 65536) / 256);
  const b = v - r * 65536 - g * 256;
  return [r, g, b];
}

function makePixelData(
  width: number,
  height: number,
  pixels: Array<[number, number, number, number]>,
): TerrainRGBImageData {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const px = pixels[i] ?? [0, 0, 0, 0];
    const o = i * 4;
    data[o] = px[0];
    data[o + 1] = px[1];
    data[o + 2] = px[2];
    data[o + 3] = px[3];
  }
  return { width, height, data };
}

describe('TerrainRGBLayer', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads TileJSON URL and decodes terrain-rgb heights', async () => {
    const tileJson = {
      tiles: ['https://example.test/terrain/{z}/{x}/{y}.png'],
      minzoom: 0,
      maxzoom: 12,
      bounds: [-180, -85, 180, 85] as [number, number, number, number],
    };

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => tileJson,
    }));
    vi.stubGlobal('fetch', fetchMock);

    const h0 = encodeTerrainRgb(0);
    const h1 = encodeTerrainRgb(100);
    const h2 = encodeTerrainRgb(200);
    const h3 = encodeTerrainRgb(300);

    const layer = new TerrainRGBLayer({
      tileJsonUrl: 'https://example.test/tiles.json',
      hillshade2D: { enabled: false },
      pixelFetcher: async () => makePixelData(2, 2, [
        [h0[0], h0[1], h0[2], 255],
        [h1[0], h1[1], h1[2], 255],
        [h2[0], h2[1], h2[2], 255],
        [h3[0], h3[1], h3[2], 255],
      ]),
    });

    await layer.load();
    await layer.requestTile(5, 10, 12);

    const ready = layer.getReadyHeightTile(5, 10, 12);
    expect(ready).not.toBeNull();
    expect(ready!.width).toBe(2);
    expect(ready!.height).toBe(2);
    expect(ready!.data[0]).toBeCloseTo(0, 1);
    expect(ready!.data[1]).toBeCloseTo(100, 1);
    expect(ready!.data[2]).toBeCloseTo(200, 1);
    expect(ready!.data[3]).toBeCloseTo(300, 1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/tiles.json',
      expect.objectContaining({ mode: 'cors' }),
    );
  });

  it('does not produce ready tiles when decoded image has no valid alpha', async () => {
    const layer = new TerrainRGBLayer({
      tileJson: {
        tiles: ['https://example.test/terrain/{z}/{x}/{y}.png'],
      },
      hillshade2D: { enabled: true },
      pixelFetcher: async () => makePixelData(2, 2, [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]),
    });

    await layer.load();
    await layer.requestTile(3, 4, 2);

    expect(layer.getReadyHeightTile(3, 4, 2)).toBeNull();
    expect(layer.getReadyHillshadeTile(3, 4, 2)).toBeNull();
  });

  it('treats terrain-rgb (0,0,0,255) pixels as no-data', async () => {
    const layer = new TerrainRGBLayer({
      tileJson: {
        tiles: ['https://example.test/terrain/{z}/{x}/{y}.png'],
      },
      hillshade2D: { enabled: true },
      pixelFetcher: async () => makePixelData(2, 2, [
        [0, 0, 0, 255],
        [0, 0, 0, 255],
        [0, 0, 0, 255],
        [0, 0, 0, 255],
      ]),
    });

    await layer.load();
    await layer.requestTile(3, 4, 2);

    expect(layer.getReadyHeightTile(3, 4, 2)).toBeNull();
    expect(layer.getReadyHillshadeTile(3, 4, 2)).toBeNull();
  });

  it('builds hillshade with transparent mask outside valid pixels', async () => {
    const h = encodeTerrainRgb(120);
    const layer = new TerrainRGBLayer({
      tileJson: {
        tiles: ['https://example.test/terrain/{z}/{x}/{y}.png'],
      },
      hillshade2D: { enabled: true, opacity: 0.5, azimuth: 315, altitude: 45 },
      pixelFetcher: async () => makePixelData(2, 2, [
        [h[0], h[1], h[2], 255],
        [0, 0, 0, 0],
        [h[0], h[1], h[2], 255],
        [h[0], h[1], h[2], 255],
      ]),
    });

    await layer.load();
    await layer.requestTile(4, 8, 7);

    const hillshade = layer.getReadyHillshadeTile(4, 8, 7);
    expect(hillshade).not.toBeNull();

    const transparentPixel = 1;
    const base = transparentPixel * 4;
    expect(hillshade!.data[base]).toBe(0);
    expect(hillshade!.data[base + 1]).toBe(0);
    expect(hillshade!.data[base + 2]).toBe(0);
    expect(hillshade!.data[base + 3]).toBe(0);
  });

  it('allows runtime hillshade2D updates via API', () => {
    const layer = new TerrainRGBLayer({
      tileJson: {
        tiles: ['https://example.test/terrain/{z}/{x}/{y}.png'],
      },
      hillshade2D: { enabled: true, opacity: 0.45, azimuth: 315, altitude: 45, softness: 0.25 },
    });

    layer.setHillshade2D({ softness: 0.9, opacity: 0.2 });
    expect(layer.hillshade2D.softness).toBeCloseTo(0.9, 6);
    expect(layer.opacity).toBeCloseTo(0.2, 6);
  });

  it('allows runtime 3D lighting updates via API', () => {
    const layer = new TerrainRGBLayer({
      tileJson: {
        tiles: ['https://example.test/terrain/{z}/{x}/{y}.png'],
      },
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

    layer.setLighting3D({ sunAzimuth: 120, shadowStrength: 0.7, diffuse: 1.2 });
    expect(layer.lighting3D.sunAzimuth).toBeCloseTo(120, 6);
    expect(layer.lighting3D.shadowStrength).toBeCloseTo(0.7, 6);
    expect(layer.lighting3D.diffuse).toBeCloseTo(1.2, 6);
  });
});
