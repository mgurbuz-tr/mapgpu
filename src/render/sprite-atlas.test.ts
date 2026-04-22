/**
 * SpriteAtlas Tests
 *
 * Ikon sprite atlas bin packing, sprite ekleme/sorgulama,
 * atlas buyutme, UV hesaplama testleri.
 */

import { describe, it, expect } from 'vitest';
import { SpriteAtlas } from './sprite-atlas.js';

function makeRgbaData(w: number, h: number, r = 255, g = 0, b = 0, a = 255): Uint8Array {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = a;
  }
  return data;
}

describe('SpriteAtlas', () => {
  // ─── Basic Construction ───

  it('creates with default 512x512 size', () => {
    const atlas = new SpriteAtlas();
    expect(atlas.width).toBe(512);
    expect(atlas.height).toBe(512);
    expect(atlas.spriteCount).toBe(0);
  });

  it('starts with clean dirty state', () => {
    const atlas = new SpriteAtlas();
    expect(atlas.isDirty).toBe(false);
  });

  // ─── addSprite ───

  it('adds a sprite and returns entry', () => {
    const atlas = new SpriteAtlas();
    const entry = atlas.addSprite('icon-1', makeRgbaData(32, 32), 32, 32);
    expect(entry).not.toBeNull();
    expect(entry!.width).toBe(32);
    expect(entry!.height).toBe(32);
    expect(atlas.spriteCount).toBe(1);
  });

  it('sets dirty flag after adding a sprite', () => {
    const atlas = new SpriteAtlas();
    atlas.addSprite('icon-1', makeRgbaData(16, 16), 16, 16);
    expect(atlas.isDirty).toBe(true);
  });

  it('returns existing entry for duplicate ID', () => {
    const atlas = new SpriteAtlas();
    const data = makeRgbaData(16, 16);

    const first = atlas.addSprite('icon-1', data, 16, 16);
    const second = atlas.addSprite('icon-1', data, 16, 16);
    expect(first).toBe(second);
    expect(atlas.spriteCount).toBe(1);
  });

  it('adds multiple sprites', () => {
    const atlas = new SpriteAtlas();
    for (let i = 0; i < 10; i++) {
      const entry = atlas.addSprite(`icon-${i}`, makeRgbaData(24, 24), 24, 24);
      expect(entry).not.toBeNull();
    }
    expect(atlas.spriteCount).toBe(10);
  });

  // ─── getSprite ───

  it('returns undefined for unknown ID', () => {
    const atlas = new SpriteAtlas();
    expect(atlas.getSprite('unknown')).toBeUndefined();
  });

  it('returns correct entry for known ID', () => {
    const atlas = new SpriteAtlas();
    atlas.addSprite('icon-1', makeRgbaData(24, 32), 24, 32);

    const entry = atlas.getSprite('icon-1');
    expect(entry).toBeDefined();
    expect(entry!.width).toBe(24);
    expect(entry!.height).toBe(32);
  });

  // ─── UV Coordinates ───

  it('computes UV coordinates within [0,1] range', () => {
    const atlas = new SpriteAtlas();
    const entry = atlas.addSprite('icon-1', makeRgbaData(32, 32), 32, 32);

    expect(entry).not.toBeNull();
    const [u0, v0, u1, v1] = entry!.uv;
    expect(u0).toBeGreaterThanOrEqual(0);
    expect(v0).toBeGreaterThanOrEqual(0);
    expect(u1).toBeLessThanOrEqual(1);
    expect(v1).toBeLessThanOrEqual(1);
    expect(u1).toBeGreaterThan(u0);
    expect(v1).toBeGreaterThan(v0);
  });

  it('UV width/height matches sprite size ratio', () => {
    const atlas = new SpriteAtlas();
    const w = 32, h = 48;
    const entry = atlas.addSprite('icon-1', makeRgbaData(w, h), w, h);

    const uvW = (entry!.uv[2] - entry!.uv[0]) * atlas.width;
    const uvH = (entry!.uv[3] - entry!.uv[1]) * atlas.height;
    expect(uvW).toBeCloseTo(w, 0);
    expect(uvH).toBeCloseTo(h, 0);
  });

  // ─── Shelf Packing ───

  it('places multiple sprites on the same shelf when they fit', () => {
    const atlas = new SpriteAtlas();
    const entry1 = atlas.addSprite('a', makeRgbaData(30, 30), 30, 30);
    const entry2 = atlas.addSprite('b', makeRgbaData(30, 30), 30, 30);

    expect(entry1!.y).toBe(entry2!.y);
    expect(entry2!.x).toBeGreaterThan(entry1!.x);
  });

  it('creates new shelf for taller sprites', () => {
    const atlas = new SpriteAtlas();
    const entry1 = atlas.addSprite('a', makeRgbaData(30, 20), 30, 20);
    const entry2 = atlas.addSprite('b', makeRgbaData(30, 50), 30, 50);

    expect(entry2!.y).toBeGreaterThan(entry1!.y);
  });

  // ─── RGBA Data Copy ───

  it('copies RGBA data to atlas', () => {
    const atlas = new SpriteAtlas();
    const w = 4, h = 4;
    const rgba = makeRgbaData(w, h, 42, 84, 126, 200);

    const entry = atlas.addSprite('icon-1', rgba, w, h);
    const data = atlas.getData();

    // Check first pixel at entry position
    const idx = (entry!.y * atlas.width + entry!.x) * 4;
    expect(data[idx]).toBe(42);     // R
    expect(data[idx + 1]).toBe(84); // G
    expect(data[idx + 2]).toBe(126);// B
    expect(data[idx + 3]).toBe(200);// A
  });

  // ─── Atlas Growth ───

  it('grows atlas when running out of space', () => {
    const atlas = new SpriteAtlas();
    const bigSize = 100;

    let grewSize = false;
    for (let i = 0; i < 100; i++) {
      const entry = atlas.addSprite(`icon-${i}`, makeRgbaData(bigSize, bigSize), bigSize, bigSize);
      if (entry && atlas.width > 512) {
        grewSize = true;
        break;
      }
    }
    expect(grewSize).toBe(true);
    expect(atlas.width).toBe(1024);
  });

  it('updates UV coordinates after growth', () => {
    const atlas = new SpriteAtlas();
    const bigSize = 100;

    atlas.addSprite('first', makeRgbaData(bigSize, bigSize), bigSize, bigSize);
    const uvBefore = atlas.getSprite('first')!.uv.slice() as [number, number, number, number];

    for (let i = 1; i < 100; i++) {
      atlas.addSprite(`icon-${i}`, makeRgbaData(bigSize, bigSize), bigSize, bigSize);
      if (atlas.width > 512) break;
    }

    if (atlas.width > 512) {
      const uvAfter = atlas.getSprite('first')!.uv;
      expect(uvAfter[2]).toBeLessThan(uvBefore[2]);
    }
  });

  // ─── getTexture (without device) ───

  it('getTexture returns null without GPU device', () => {
    const atlas = new SpriteAtlas();
    expect(atlas.getTexture()).toBeNull();
  });

  // ─── destroy ───

  it('destroy clears all state', () => {
    const atlas = new SpriteAtlas();
    atlas.addSprite('a', makeRgbaData(10, 10), 10, 10);
    atlas.addSprite('b', makeRgbaData(10, 10), 10, 10);

    atlas.destroy();
    expect(atlas.spriteCount).toBe(0);
    expect(atlas.getSprite('a')).toBeUndefined();
  });
});
