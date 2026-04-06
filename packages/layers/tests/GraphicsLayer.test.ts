import { describe, it, expect } from 'vitest';
import { GraphicsLayer } from '../src/GraphicsLayer.js';
import type { Feature } from '@mapgpu/core';

// ─── Test Fixtures ───

function createPointFeature(
  id: string | number,
  x: number,
  y: number,
  attrs: Record<string, unknown> = {},
): Feature {
  return {
    id,
    geometry: { type: 'Point', coordinates: [x, y] },
    attributes: attrs,
  };
}

function createPolygonFeature(
  id: string | number,
  coords: number[][][],
  attrs: Record<string, unknown> = {},
): Feature {
  return {
    id,
    geometry: { type: 'Polygon', coordinates: coords },
    attributes: attrs,
  };
}

describe('GraphicsLayer', () => {
  it('should have type "graphics"', () => {
    const layer = new GraphicsLayer();
    expect(layer.type).toBe('graphics');
  });

  it('should load immediately (no remote data)', async () => {
    const layer = new GraphicsLayer();
    await layer.load();
    expect(layer.loaded).toBe(true);
  });

  // ─── Add / Remove / Clear ───

  it('should add features', () => {
    const layer = new GraphicsLayer();
    const f1 = createPointFeature('a', 10, 20);
    const f2 = createPointFeature('b', 30, 40);

    layer.add(f1);
    layer.add(f2);

    expect(layer.graphics).toHaveLength(2);
    expect(layer.count).toBe(2);
  });

  it('should replace feature with same id', () => {
    const layer = new GraphicsLayer();
    const f1 = createPointFeature('a', 10, 20, { name: 'v1' });
    const f2 = createPointFeature('a', 30, 40, { name: 'v2' });

    layer.add(f1);
    layer.add(f2);

    expect(layer.graphics).toHaveLength(1);
    expect(layer.graphics[0]!.attributes['name']).toBe('v2');
  });

  it('should addMany features', () => {
    const layer = new GraphicsLayer();
    layer.addMany([
      createPointFeature('a', 10, 20),
      createPointFeature('b', 30, 40),
    ]);
    expect(layer.count).toBe(2);
  });

  it('should remove a feature by id', () => {
    const layer = new GraphicsLayer();
    layer.add(createPointFeature('a', 10, 20));
    layer.add(createPointFeature('b', 30, 40));

    const removed = layer.remove('a');
    expect(removed).toBe(true);
    expect(layer.count).toBe(1);
    expect(layer.graphics[0]!.id).toBe('b');
  });

  it('should return false when removing non-existent feature', () => {
    const layer = new GraphicsLayer();
    expect(layer.remove('nonexistent')).toBe(false);
  });

  it('should clear all features', () => {
    const layer = new GraphicsLayer();
    layer.add(createPointFeature('a', 10, 20));
    layer.add(createPointFeature('b', 30, 40));

    layer.clear();
    expect(layer.count).toBe(0);
    expect(layer.graphics).toEqual([]);
    expect(layer.fullExtent).toBeUndefined();
  });

  // ─── replaceAll ───

  it('should replace all features atomically', () => {
    const layer = new GraphicsLayer();
    layer.add(createPointFeature('a', 10, 20));
    layer.add(createPointFeature('b', 30, 40));

    layer.replaceAll([
      createPointFeature('c', 50, 60),
      createPointFeature('d', 70, 80),
      createPointFeature('e', 90, 100),
    ]);

    expect(layer.count).toBe(3);
    expect(layer.graphics.map((f) => f.id)).toEqual(['c', 'd', 'e']);
    expect(layer.fullExtent).toEqual({
      minX: 50,
      minY: 60,
      maxX: 90,
      maxY: 100,
    });
  });

  it('should handle replaceAll with empty array', () => {
    const layer = new GraphicsLayer();
    layer.add(createPointFeature('a', 10, 20));

    layer.replaceAll([]);
    expect(layer.count).toBe(0);
    expect(layer.fullExtent).toBeUndefined();
  });

  // ─── Extent ───

  it('should update extent when adding features', () => {
    const layer = new GraphicsLayer();
    layer.add(createPointFeature('a', 10, 20));
    layer.add(createPointFeature('b', 30, 40));

    expect(layer.fullExtent).toEqual({
      minX: 10,
      minY: 20,
      maxX: 30,
      maxY: 40,
    });
  });

  it('should update extent when removing features', () => {
    const layer = new GraphicsLayer();
    layer.add(createPointFeature('a', 10, 20));
    layer.add(createPointFeature('b', 30, 40));

    layer.remove('b');
    expect(layer.fullExtent).toEqual({
      minX: 10,
      minY: 20,
      maxX: 10,
      maxY: 20,
    });
  });

  it('should return undefined extent when empty', () => {
    const layer = new GraphicsLayer();
    expect(layer.fullExtent).toBeUndefined();
  });

  // ─── queryFeatures ───

  it('should query all features', async () => {
    const layer = new GraphicsLayer();
    layer.add(createPointFeature('a', 10, 20, { type: 'city' }));
    layer.add(createPointFeature('b', 30, 40, { type: 'town' }));

    const result = await layer.queryFeatures({});
    expect(result).toHaveLength(2);
  });

  it('should filter by bbox', async () => {
    const layer = new GraphicsLayer();
    layer.add(createPointFeature('a', 10, 20));
    layer.add(createPointFeature('b', 100, 200));

    const result = await layer.queryFeatures({
      geometry: { minX: 0, minY: 0, maxX: 50, maxY: 50 },
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('a');
  });

  it('should filter by where clause', async () => {
    const layer = new GraphicsLayer();
    layer.add(createPointFeature('a', 10, 20, { type: 'city', pop: 1000 }));
    layer.add(createPointFeature('b', 30, 40, { type: 'town', pop: 200 }));

    const result = await layer.queryFeatures({
      where: "type = 'city'",
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('a');
  });

  it('should filter by numeric where clause', async () => {
    const layer = new GraphicsLayer();
    layer.add(createPointFeature('a', 10, 20, { pop: 1000 }));
    layer.add(createPointFeature('b', 30, 40, { pop: 200 }));

    const result = await layer.queryFeatures({ where: 'pop >= 500' });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('a');
  });

  it('should respect maxResults', async () => {
    const layer = new GraphicsLayer();
    for (let i = 0; i < 10; i++) {
      layer.add(createPointFeature(`f${i}`, i, i));
    }

    const result = await layer.queryFeatures({ maxResults: 3 });
    expect(result).toHaveLength(3);
  });

  it('should select outFields', async () => {
    const layer = new GraphicsLayer();
    layer.add(createPointFeature('a', 10, 20, { name: 'A', type: 'city', pop: 100 }));

    const result = await layer.queryFeatures({ outFields: ['name'] });
    expect(Object.keys(result[0]!.attributes)).toEqual(['name']);
  });

  // ─── queryExtent ───

  it('should return extent of all graphics', async () => {
    const layer = new GraphicsLayer();
    layer.add(createPointFeature('a', 10, 20));
    layer.add(createPointFeature('b', 30, 40));

    const ext = await layer.queryExtent();
    expect(ext).toEqual({ minX: 10, minY: 20, maxX: 30, maxY: 40 });
  });

  it('should return extent of filtered graphics', async () => {
    const layer = new GraphicsLayer();
    layer.add(createPointFeature('a', 10, 20, { type: 'city' }));
    layer.add(createPointFeature('b', 100, 200, { type: 'town' }));

    const ext = await layer.queryExtent({
      where: "type = 'city'",
    });
    expect(ext.minX).toBe(10);
    expect(ext.maxX).toBe(10);
  });

  // ─── Polygon features ───

  it('should handle polygon features', () => {
    const layer = new GraphicsLayer();
    const poly = createPolygonFeature(
      'poly1',
      [
        [
          [0, 0],
          [100, 0],
          [100, 100],
          [0, 100],
          [0, 0],
        ],
      ],
    );
    layer.add(poly);
    expect(layer.fullExtent).toEqual({
      minX: 0,
      minY: 0,
      maxX: 100,
      maxY: 100,
    });
  });
});
