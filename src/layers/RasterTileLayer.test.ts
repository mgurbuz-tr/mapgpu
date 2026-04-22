import { describe, it, expect } from 'vitest';
import { RasterTileLayer } from './RasterTileLayer.js';

describe('RasterTileLayer', () => {
  it('should have type "raster-tile"', () => {
    const layer = new RasterTileLayer({
      urlTemplate: 'https://tile.example.com/{z}/{x}/{y}.png',
    });
    expect(layer.type).toBe('raster-tile');
  });

  it('should throw if urlTemplate is empty', () => {
    expect(
      () => new RasterTileLayer({ urlTemplate: '' }),
    ).toThrow('requires a urlTemplate');
  });

  it('should default tms=false, minZoom=0, maxZoom=22', () => {
    const layer = new RasterTileLayer({
      urlTemplate: 'https://tile.example.com/{z}/{x}/{y}.png',
    });
    expect(layer.tms).toBe(false);
    expect(layer.minZoom).toBe(0);
    expect(layer.maxZoom).toBe(22);
  });

  it('should accept custom minZoom, maxZoom, attribution', () => {
    const layer = new RasterTileLayer({
      urlTemplate: 'https://tile.example.com/{z}/{x}/{y}.png',
      minZoom: 3,
      maxZoom: 18,
      attribution: 'Test Attribution',
    });
    expect(layer.minZoom).toBe(3);
    expect(layer.maxZoom).toBe(18);
    expect(layer.attribution).toBe('Test Attribution');
  });

  // ─── Load ───

  it('should load successfully with valid template', async () => {
    const layer = new RasterTileLayer({
      urlTemplate: 'https://tile.example.com/{z}/{x}/{y}.png',
    });
    await layer.load();
    expect(layer.loaded).toBe(true);
  });

  it('should fail to load with invalid template (missing placeholders)', async () => {
    const layer = new RasterTileLayer({
      urlTemplate: 'https://tile.example.com/tiles',
    });
    await expect(layer.load()).rejects.toThrow('must contain {z}, {x}, and {y}');
  });

  it('should fail to load with {s} but no subdomains', async () => {
    const layer = new RasterTileLayer({
      urlTemplate: 'https://{s}.tile.example.com/{z}/{x}/{y}.png',
    });
    await expect(layer.load()).rejects.toThrow('no subdomains were provided');
  });

  // ─── getTileUrl — standard XYZ ───

  it('should generate correct XYZ tile URL', async () => {
    const layer = new RasterTileLayer({
      urlTemplate: 'https://tile.example.com/{z}/{x}/{y}.png',
    });
    await layer.load();

    const url = layer.getTileUrl(5, 10, 15);
    expect(url).toBe('https://tile.example.com/5/10/15.png');
  });

  it('should handle zoom level 0', async () => {
    const layer = new RasterTileLayer({
      urlTemplate: 'https://tile.example.com/{z}/{x}/{y}.png',
    });
    await layer.load();

    const url = layer.getTileUrl(0, 0, 0);
    expect(url).toBe('https://tile.example.com/0/0/0.png');
  });

  // ─── getTileUrl — TMS y-flip ───

  it('should flip y for TMS tiles', async () => {
    const layer = new RasterTileLayer({
      urlTemplate: 'https://tile.example.com/{z}/{x}/{y}.png',
      tms: true,
    });
    await layer.load();

    // At zoom 2, 2^2 - 1 - 1 = 2
    const url = layer.getTileUrl(2, 1, 1);
    expect(url).toBe('https://tile.example.com/2/1/2.png');
  });

  it('should flip y=0 to max row at given zoom', async () => {
    const layer = new RasterTileLayer({
      urlTemplate: 'https://tile.example.com/{z}/{x}/{y}.png',
      tms: true,
    });
    await layer.load();

    // At zoom 3, 2^3 - 1 - 0 = 7
    const url = layer.getTileUrl(3, 0, 0);
    expect(url).toBe('https://tile.example.com/3/0/7.png');
  });

  // ─── Subdomain rotation ───

  it('should rotate through subdomains', async () => {
    const layer = new RasterTileLayer({
      urlTemplate: 'https://{s}.tile.example.com/{z}/{x}/{y}.png',
      subdomains: ['a', 'b', 'c'],
    });
    await layer.load();

    const urls = [
      layer.getTileUrl(1, 0, 0),
      layer.getTileUrl(1, 1, 0),
      layer.getTileUrl(1, 0, 1),
      layer.getTileUrl(1, 1, 1),
    ];

    expect(urls[0]).toContain('a.tile');
    expect(urls[1]).toContain('b.tile');
    expect(urls[2]).toContain('c.tile');
    expect(urls[3]).toContain('a.tile'); // wraps around
  });

  // ─── isZoomValid ───

  it('should validate zoom levels', () => {
    const layer = new RasterTileLayer({
      urlTemplate: 'https://tile.example.com/{z}/{x}/{y}.png',
      minZoom: 2,
      maxZoom: 18,
    });

    expect(layer.isZoomValid(0)).toBe(false);
    expect(layer.isZoomValid(2)).toBe(true);
    expect(layer.isZoomValid(10)).toBe(true);
    expect(layer.isZoomValid(18)).toBe(true);
    expect(layer.isZoomValid(19)).toBe(false);
  });

  // ─── Full extent ───

  it('should have a default world extent', () => {
    const layer = new RasterTileLayer({
      urlTemplate: 'https://tile.example.com/{z}/{x}/{y}.png',
    });
    const ext = layer.fullExtent!;
    expect(ext.minX).toBe(-180);
    expect(ext.maxX).toBe(180);
    expect(ext.minY).toBeCloseTo(-85.05, 1);
    expect(ext.maxY).toBeCloseTo(85.05, 1);
  });
});
