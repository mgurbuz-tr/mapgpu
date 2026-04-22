import { describe, it, expect, vi } from 'vitest';
import { VectorTileLayer } from './VectorTileLayer.js';

describe('VectorTileLayer', () => {
  // ─── Constructor & defaults ───

  it('should have type "vector-tile"', () => {
    const layer = new VectorTileLayer({
      url: 'https://tiles.example.com/{z}/{x}/{y}.pbf',
    });
    expect(layer.type).toBe('vector-tile');
  });

  it('should throw if url is empty', () => {
    expect(() => new VectorTileLayer({ url: '' })).toThrow('requires a url');
  });

  it('should use default minZoom and maxZoom', () => {
    const layer = new VectorTileLayer({
      url: 'https://tiles.example.com/{z}/{x}/{y}.pbf',
    });
    expect(layer.minZoom).toBe(0);
    expect(layer.maxZoom).toBe(22);
  });

  it('should accept custom options', () => {
    const style = {
      fillColor: [255, 0, 0, 128] as [number, number, number, number],
      strokeWidth: 2,
    };
    const layer = new VectorTileLayer({
      url: 'https://tiles.example.com/{z}/{x}/{y}.pbf',
      sourceLayer: 'buildings',
      minZoom: 5,
      maxZoom: 18,
      style,
    });
    expect(layer.url).toBe('https://tiles.example.com/{z}/{x}/{y}.pbf');
    expect(layer.sourceLayer).toBe('buildings');
    expect(layer.minZoom).toBe(5);
    expect(layer.maxZoom).toBe(18);
    expect(layer.style.fillColor).toEqual([255, 0, 0, 128]);
    expect(layer.style.strokeWidth).toBe(2);
  });

  // ─── Style property ───

  it('should allow updating style', () => {
    const layer = new VectorTileLayer({
      url: 'https://tiles.example.com/{z}/{x}/{y}.pbf',
    });
    layer.style = {
      strokeColor: [0, 128, 255, 255],
      strokeWidth: 3,
      labelField: 'name',
    };
    expect(layer.style.strokeColor).toEqual([0, 128, 255, 255]);
    expect(layer.style.strokeWidth).toBe(3);
    expect(layer.style.labelField).toBe('name');
  });

  // ─── Load ───

  it('should load successfully with valid URL template', async () => {
    const layer = new VectorTileLayer({
      url: 'https://tiles.example.com/{z}/{x}/{y}.pbf',
    });
    await layer.load();
    expect(layer.loaded).toBe(true);
  });

  it('should fail to load with invalid URL template', async () => {
    const layer = new VectorTileLayer({
      url: 'https://tiles.example.com/tiles',
    });
    await expect(layer.load()).rejects.toThrow('must contain {z}, {x}, and {y}');
  });

  // ─── getTileUrl ───

  it('should generate correct tile URL', async () => {
    const layer = new VectorTileLayer({
      url: 'https://tiles.example.com/{z}/{x}/{y}.pbf',
    });
    await layer.load();

    const url = layer.getTileUrl(5, 10, 15);
    expect(url).toBe('https://tiles.example.com/5/10/15.pbf');
  });

  it('should handle zoom level 0', async () => {
    const layer = new VectorTileLayer({
      url: 'https://tiles.example.com/{z}/{x}/{y}.pbf',
    });
    await layer.load();

    const url = layer.getTileUrl(0, 0, 0);
    expect(url).toBe('https://tiles.example.com/0/0/0.pbf');
  });

  it('should handle high zoom levels', async () => {
    const layer = new VectorTileLayer({
      url: 'https://tiles.example.com/{z}/{x}/{y}.pbf',
    });
    await layer.load();

    const url = layer.getTileUrl(18, 131072, 65536);
    expect(url).toBe('https://tiles.example.com/18/131072/65536.pbf');
  });

  // ─── isZoomValid ───

  it('should validate zoom levels', () => {
    const layer = new VectorTileLayer({
      url: 'https://tiles.example.com/{z}/{x}/{y}.pbf',
      minZoom: 3,
      maxZoom: 15,
    });
    expect(layer.isZoomValid(2)).toBe(false);
    expect(layer.isZoomValid(3)).toBe(true);
    expect(layer.isZoomValid(10)).toBe(true);
    expect(layer.isZoomValid(15)).toBe(true);
    expect(layer.isZoomValid(16)).toBe(false);
  });

  // ─── Full extent ───

  it('should have a default world extent', () => {
    const layer = new VectorTileLayer({
      url: 'https://tiles.example.com/{z}/{x}/{y}.pbf',
    });
    const ext = layer.fullExtent!;
    expect(ext.minX).toBe(-180);
    expect(ext.maxX).toBe(180);
    expect(ext.minY).toBeCloseTo(-85.05, 1);
    expect(ext.maxY).toBeCloseTo(85.05, 1);
  });

  // ─── Refresh ───

  it('should reset loaded state on refresh', async () => {
    const layer = new VectorTileLayer({
      url: 'https://tiles.example.com/{z}/{x}/{y}.pbf',
    });
    await layer.load();
    expect(layer.loaded).toBe(true);

    layer.refresh();
    expect(layer.loaded).toBe(false);
  });

  // ─── sourceLayer property ───

  it('should return undefined sourceLayer when not provided', () => {
    const layer = new VectorTileLayer({
      url: 'https://tiles.example.com/{z}/{x}/{y}.pbf',
    });
    expect(layer.sourceLayer).toBeUndefined();
  });

  it('keeps visible tiles unflattened until getFeatures is called and memoizes the result', () => {
    const layer = new VectorTileLayer({
      url: 'https://tiles.example.com/{z}/{x}/{y}.pbf',
    });
    const tile = {
      key: '0/0/0',
      z: 0,
      x: 0,
      y: 0,
      version: 1,
      features: [{
        id: 1,
        geometry: {
          type: 'Point',
          coordinates: [0, 0],
          spatialReference: 'EPSG:3857',
        },
        attributes: { name: 'Center' },
      }],
    };
    const getReadyTiles = vi.fn(() => [tile]);

    (layer as any)._vtManager = {
      getReadyTiles,
      clear: vi.fn(),
      onTileLoaded: null,
    };

    layer.updateVisibleTiles([{ z: 0, x: 0, y: 0 }]);

    expect(getReadyTiles).toHaveBeenCalledTimes(1);
    expect((layer as any)._publicFeatures).toEqual([]);

    const first = layer.getFeatures();
    const second = layer.getFeatures();

    expect(first).toHaveLength(1);
    expect(first[0]!.attributes.name).toBe('Center');
    expect(second).toBe(first);
  });

  it('re-requests the same tile set after refresh clears tile-native state', () => {
    const layer = new VectorTileLayer({
      url: 'https://tiles.example.com/{z}/{x}/{y}.pbf',
    });
    const getReadyTiles = vi.fn(() => []);
    const clear = vi.fn();

    (layer as any)._vtManager = {
      getReadyTiles,
      clear,
      onTileLoaded: null,
    };

    layer.updateVisibleTiles([{ z: 4, x: 8, y: 6 }]);
    layer.refresh();
    layer.updateVisibleTiles([{ z: 4, x: 8, y: 6 }]);

    expect(clear).toHaveBeenCalledTimes(1);
    expect(getReadyTiles).toHaveBeenCalledTimes(2);
  });
});
