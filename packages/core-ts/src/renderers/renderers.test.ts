import { describe, it, expect } from 'vitest';
import { SimpleRenderer } from './SimpleRenderer.js';
import { UniqueValueRenderer } from './UniqueValueRenderer.js';
import { ClassBreaksRenderer } from './ClassBreaksRenderer.js';
import type { Feature } from '../interfaces/ILayer.js';
import type { PointSymbol, PolygonSymbol } from '../interfaces/IRenderEngine.js';

const redPoint: PointSymbol = {
  type: 'simple-marker',
  color: [255, 0, 0, 255],
  size: 10,
};

const bluePoint: PointSymbol = {
  type: 'simple-marker',
  color: [0, 0, 255, 255],
  size: 10,
};

const greenFill: PolygonSymbol = {
  type: 'simple-fill',
  color: [0, 255, 0, 128],
  outlineColor: [0, 0, 0, 255],
  outlineWidth: 1,
};

const grayFill: PolygonSymbol = {
  type: 'simple-fill',
  color: [128, 128, 128, 255],
  outlineColor: [0, 0, 0, 255],
  outlineWidth: 1,
};

function makeFeature(attrs: Record<string, unknown> = {}): Feature {
  return {
    geometry: { type: 'Point', coordinates: [0, 0] },
    attributes: attrs,
  };
}

// ─── SimpleRenderer ───

describe('SimpleRenderer', () => {
  it('returns same symbol for all features', () => {
    const renderer = new SimpleRenderer(redPoint);
    expect(renderer.type).toBe('simple');

    const f1 = makeFeature({ name: 'A' });
    const f2 = makeFeature({ name: 'B' });

    expect(renderer.getSymbol(f1)).toBe(redPoint);
    expect(renderer.getSymbol(f2)).toBe(redPoint);
  });

  it('symbol is accessible', () => {
    const renderer = new SimpleRenderer(greenFill);
    expect(renderer.symbol).toBe(greenFill);
  });
});

// ─── UniqueValueRenderer ───

describe('UniqueValueRenderer', () => {
  const renderer = new UniqueValueRenderer({
    field: 'category',
    defaultSymbol: grayFill,
    uniqueValues: [
      { value: 'park', symbol: greenFill },
      { value: 'water', symbol: { ...greenFill, color: [0, 100, 200, 128] } },
    ],
  });

  it('has type "unique-value"', () => {
    expect(renderer.type).toBe('unique-value');
  });

  it('returns matching symbol for known value', () => {
    const feature = makeFeature({ category: 'park' });
    expect(renderer.getSymbol(feature)).toBe(greenFill);
  });

  it('returns default symbol for unknown value', () => {
    const feature = makeFeature({ category: 'unknown' });
    expect(renderer.getSymbol(feature)).toBe(grayFill);
  });

  it('returns default symbol when field is missing', () => {
    const feature = makeFeature({});
    expect(renderer.getSymbol(feature)).toBe(grayFill);
  });

  it('returns default symbol for null field value', () => {
    const feature = makeFeature({ category: null });
    expect(renderer.getSymbol(feature)).toBe(grayFill);
  });

  it('supports numeric unique values', () => {
    const numRenderer = new UniqueValueRenderer({
      field: 'code',
      defaultSymbol: grayFill,
      uniqueValues: [
        { value: 1, symbol: redPoint },
        { value: 2, symbol: bluePoint },
      ],
    });

    expect(numRenderer.getSymbol(makeFeature({ code: 1 }))).toBe(redPoint);
    expect(numRenderer.getSymbol(makeFeature({ code: 2 }))).toBe(bluePoint);
    expect(numRenderer.getSymbol(makeFeature({ code: 3 }))).toBe(grayFill);
  });
});

// ─── ClassBreaksRenderer ───

describe('ClassBreaksRenderer', () => {
  const smallSym = { ...redPoint, size: 5 };
  const medSym = { ...redPoint, size: 10 };
  const largeSym = { ...redPoint, size: 20 };

  const renderer = new ClassBreaksRenderer({
    field: 'population',
    defaultSymbol: smallSym,
    breaks: [
      { min: 0, max: 100000, symbol: smallSym },
      { min: 100000, max: 1000000, symbol: medSym },
      { min: 1000000, max: Infinity, symbol: largeSym },
    ],
  });

  it('has type "class-breaks"', () => {
    expect(renderer.type).toBe('class-breaks');
  });

  it('returns symbol for matching range', () => {
    expect(renderer.getSymbol(makeFeature({ population: 50000 }))).toBe(smallSym);
    expect(renderer.getSymbol(makeFeature({ population: 500000 }))).toBe(medSym);
    expect(renderer.getSymbol(makeFeature({ population: 5000000 }))).toBe(largeSym);
  });

  it('uses min-inclusive, max-exclusive bounds', () => {
    // Exactly at boundary → belongs to next range
    expect(renderer.getSymbol(makeFeature({ population: 100000 }))).toBe(medSym);
    expect(renderer.getSymbol(makeFeature({ population: 1000000 }))).toBe(largeSym);
  });

  it('returns default symbol for non-numeric value', () => {
    expect(renderer.getSymbol(makeFeature({ population: 'big' }))).toBe(smallSym);
  });

  it('returns default symbol for missing field', () => {
    expect(renderer.getSymbol(makeFeature({}))).toBe(smallSym);
  });

  it('returns default when value is below all breaks', () => {
    const renderer2 = new ClassBreaksRenderer({
      field: 'val',
      defaultSymbol: grayFill,
      breaks: [
        { min: 10, max: 20, symbol: redPoint },
      ],
    });
    expect(renderer2.getSymbol(makeFeature({ val: 5 }))).toBe(grayFill);
  });
});
