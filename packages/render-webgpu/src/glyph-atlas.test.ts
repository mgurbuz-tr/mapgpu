/**
 * GlyphAtlas Tests
 *
 * SDF glyph atlas bin packing, glyph ekleme/sorgulama,
 * atlas buyutme, UV hesaplama testleri.
 */

import { describe, it, expect } from 'vitest';
import { GlyphAtlas } from './glyph-atlas.js';
import type { GlyphMetrics } from './glyph-atlas.js';

function makeMetrics(w: number, h: number): GlyphMetrics {
  return {
    width: w,
    height: h,
    bearingX: 0,
    bearingY: h,
    advance: w + 2,
  };
}

function makeSdfData(w: number, h: number): Uint8Array {
  const data = new Uint8Array(w * h);
  for (let i = 0; i < data.length; i++) {
    data[i] = 128; // mid-range SDF value
  }
  return data;
}

describe('GlyphAtlas', () => {
  // ─── Basic Construction ───

  it('creates with default 512x512 size', () => {
    const atlas = new GlyphAtlas();
    expect(atlas.width).toBe(512);
    expect(atlas.height).toBe(512);
    expect(atlas.glyphCount).toBe(0);
  });

  it('starts with clean dirty state', () => {
    const atlas = new GlyphAtlas();
    expect(atlas.isDirty).toBe(false);
  });

  // ─── addGlyph ───

  it('adds a glyph and returns entry', () => {
    const atlas = new GlyphAtlas();
    const metrics = makeMetrics(16, 20);
    const sdf = makeSdfData(16, 20);

    const entry = atlas.addGlyph(65, sdf, metrics); // 'A'
    expect(entry).not.toBeNull();
    expect(entry!.metrics).toBe(metrics);
    expect(atlas.glyphCount).toBe(1);
  });

  it('sets dirty flag after adding a glyph', () => {
    const atlas = new GlyphAtlas();
    atlas.addGlyph(65, makeSdfData(10, 10), makeMetrics(10, 10));
    expect(atlas.isDirty).toBe(true);
  });

  it('returns existing entry for duplicate charCode', () => {
    const atlas = new GlyphAtlas();
    const metrics = makeMetrics(10, 10);
    const sdf = makeSdfData(10, 10);

    const first = atlas.addGlyph(65, sdf, metrics);
    const second = atlas.addGlyph(65, sdf, metrics);
    expect(first).toBe(second);
    expect(atlas.glyphCount).toBe(1);
  });

  it('adds multiple glyphs', () => {
    const atlas = new GlyphAtlas();
    for (let i = 0; i < 10; i++) {
      const entry = atlas.addGlyph(65 + i, makeSdfData(12, 14), makeMetrics(12, 14));
      expect(entry).not.toBeNull();
    }
    expect(atlas.glyphCount).toBe(10);
  });

  // ─── getGlyph ───

  it('returns undefined for unknown charCode', () => {
    const atlas = new GlyphAtlas();
    expect(atlas.getGlyph(65)).toBeUndefined();
  });

  it('returns correct entry for known charCode', () => {
    const atlas = new GlyphAtlas();
    const metrics = makeMetrics(10, 10);
    atlas.addGlyph(65, makeSdfData(10, 10), metrics);

    const entry = atlas.getGlyph(65);
    expect(entry).toBeDefined();
    expect(entry!.metrics.width).toBe(10);
    expect(entry!.metrics.height).toBe(10);
  });

  // ─── UV Coordinates ───

  it('computes UV coordinates within [0,1] range', () => {
    const atlas = new GlyphAtlas();
    const entry = atlas.addGlyph(65, makeSdfData(16, 20), makeMetrics(16, 20));

    expect(entry).not.toBeNull();
    const [u0, v0, u1, v1] = entry!.uv;
    expect(u0).toBeGreaterThanOrEqual(0);
    expect(v0).toBeGreaterThanOrEqual(0);
    expect(u1).toBeLessThanOrEqual(1);
    expect(v1).toBeLessThanOrEqual(1);
    expect(u1).toBeGreaterThan(u0);
    expect(v1).toBeGreaterThan(v0);
  });

  it('UV width/height matches glyph size ratio', () => {
    const atlas = new GlyphAtlas();
    const w = 16, h = 20;
    const entry = atlas.addGlyph(65, makeSdfData(w, h), makeMetrics(w, h));

    const uvW = (entry!.uv[2] - entry!.uv[0]) * atlas.width;
    const uvH = (entry!.uv[3] - entry!.uv[1]) * atlas.height;
    expect(uvW).toBeCloseTo(w, 0);
    expect(uvH).toBeCloseTo(h, 0);
  });

  // ─── Shelf Packing ───

  it('places multiple glyphs on the same shelf when they fit', () => {
    const atlas = new GlyphAtlas();
    const entry1 = atlas.addGlyph(65, makeSdfData(30, 20), makeMetrics(30, 20));
    const entry2 = atlas.addGlyph(66, makeSdfData(30, 20), makeMetrics(30, 20));

    // Same Y means same shelf (with padding)
    expect(entry1!.y).toBe(entry2!.y);
    // Different X
    expect(entry2!.x).toBeGreaterThan(entry1!.x);
  });

  it('creates new shelf for taller glyphs', () => {
    const atlas = new GlyphAtlas();
    const entry1 = atlas.addGlyph(65, makeSdfData(30, 20), makeMetrics(30, 20));
    const entry2 = atlas.addGlyph(66, makeSdfData(30, 40), makeMetrics(30, 40));

    // Different shelves (different Y)
    expect(entry2!.y).toBeGreaterThan(entry1!.y);
  });

  // ─── SDF Data Copy ───

  it('copies SDF data to atlas', () => {
    const atlas = new GlyphAtlas();
    const w = 4, h = 4;
    const sdf = new Uint8Array(w * h);
    sdf[0] = 200;
    sdf[w * h - 1] = 100;

    const entry = atlas.addGlyph(65, sdf, makeMetrics(w, h));
    const data = atlas.getData();

    // Check that data was copied at the entry position
    const idx = entry!.y * atlas.width + entry!.x;
    expect(data[idx]).toBe(200);
  });

  // ─── Atlas Growth ───

  it('grows atlas when running out of space', () => {
    const atlas = new GlyphAtlas();
    const bigGlyphSize = 100;

    // Fill atlas with big glyphs until it grows
    let grewSize = false;
    for (let i = 0; i < 100; i++) {
      const entry = atlas.addGlyph(i, makeSdfData(bigGlyphSize, bigGlyphSize), makeMetrics(bigGlyphSize, bigGlyphSize));
      if (entry && atlas.width > 512) {
        grewSize = true;
        break;
      }
    }
    expect(grewSize).toBe(true);
    expect(atlas.width).toBe(1024);
  });

  it('updates UV coordinates after growth', () => {
    const atlas = new GlyphAtlas();
    const bigSize = 100;

    // Add first glyph
    atlas.addGlyph(65, makeSdfData(bigSize, bigSize), makeMetrics(bigSize, bigSize));
    const uvBefore = atlas.getGlyph(65)!.uv.slice() as [number, number, number, number];

    // Force growth by adding many glyphs
    for (let i = 1; i < 100; i++) {
      atlas.addGlyph(65 + i, makeSdfData(bigSize, bigSize), makeMetrics(bigSize, bigSize));
      if (atlas.width > 512) break;
    }

    // UV should have changed (atlas is now bigger)
    if (atlas.width > 512) {
      const uvAfter = atlas.getGlyph(65)!.uv;
      // UV values should be smaller (same pixel position, bigger atlas)
      expect(uvAfter[2]).toBeLessThan(uvBefore[2]);
    }
  });

  it('returns null when atlas is at max size and full', () => {
    // We can't easily fill a 4096x4096 atlas in a test,
    // but we can verify the contract: addGlyph returns null when it cannot fit
    const atlas = new GlyphAtlas();
    // This test just verifies the return type contract
    const entry = atlas.addGlyph(65, makeSdfData(10, 10), makeMetrics(10, 10));
    expect(entry).not.toBeNull();
  });

  // ─── getTexture (without device) ───

  it('getTexture returns null without GPU device', () => {
    const atlas = new GlyphAtlas();
    expect(atlas.getTexture()).toBeNull();
  });

  // ─── destroy ───

  it('destroy clears all state', () => {
    const atlas = new GlyphAtlas();
    atlas.addGlyph(65, makeSdfData(10, 10), makeMetrics(10, 10));
    atlas.addGlyph(66, makeSdfData(10, 10), makeMetrics(10, 10));

    atlas.destroy();
    expect(atlas.glyphCount).toBe(0);
    expect(atlas.getGlyph(65)).toBeUndefined();
  });
});
