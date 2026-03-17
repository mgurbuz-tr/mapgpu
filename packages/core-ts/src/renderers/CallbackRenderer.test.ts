import { describe, it, expect, vi } from 'vitest';
import { CallbackRenderer } from './CallbackRenderer.js';
import type { CallbackRendererFn } from './CallbackRenderer.js';
import type { Feature } from '../interfaces/ILayer.js';
import type { PointSymbol, LineSymbol, PolygonSymbol } from '../interfaces/IRenderEngine.js';
import type { SymbolRenderContext } from '../interfaces/IRenderer.js';

// ─── Fixtures ───

const redMarker: PointSymbol = {
  type: 'simple-marker',
  color: [255, 0, 0, 255],
  size: 8,
};

const blueLine: LineSymbol = {
  type: 'simple-line',
  color: [0, 0, 255, 255],
  width: 2,
  style: 'solid',
};

const greenFill: PolygonSymbol = {
  type: 'simple-fill',
  color: [0, 255, 0, 128],
  outlineColor: [0, 0, 0, 255],
  outlineWidth: 1,
};

function makeFeature(id: string | number, attrs: Record<string, unknown> = {}): Feature {
  return {
    id,
    geometry: { type: 'Point', coordinates: [0, 0] },
    attributes: attrs,
  };
}

// ─── Tests ───

describe('CallbackRenderer', () => {
  it('has type "callback"', () => {
    const renderer = new CallbackRenderer(() => redMarker);
    expect(renderer.type).toBe('callback');
  });

  it('delegates getSymbol to the callback function', () => {
    const fn = vi.fn().mockReturnValue(redMarker);
    const renderer = new CallbackRenderer(fn);
    const feature = makeFeature('f1', { name: 'test' });

    const result = renderer.getSymbol(feature);

    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith(feature, undefined);
    expect(result).toBe(redMarker);
  });

  it('returns different symbols based on feature attributes', () => {
    const fn: CallbackRendererFn = (feature) => {
      const kind = feature.attributes['kind'] as string;
      switch (kind) {
        case 'city': return redMarker;
        case 'river': return blueLine;
        case 'park': return greenFill;
        default: return null;
      }
    };

    const renderer = new CallbackRenderer(fn);

    expect(renderer.getSymbol(makeFeature(1, { kind: 'city' }))).toBe(redMarker);
    expect(renderer.getSymbol(makeFeature(2, { kind: 'river' }))).toBe(blueLine);
    expect(renderer.getSymbol(makeFeature(3, { kind: 'park' }))).toBe(greenFill);
  });

  it('returns null to skip a feature', () => {
    const fn: CallbackRendererFn = (feature) => {
      if (feature.attributes['hidden']) return null;
      return redMarker;
    };

    const renderer = new CallbackRenderer(fn);

    expect(renderer.getSymbol(makeFeature('v1', { hidden: true }))).toBeNull();
    expect(renderer.getSymbol(makeFeature('v2', { hidden: false }))).toBe(redMarker);
    expect(renderer.getSymbol(makeFeature('v3', {}))).toBe(redMarker);
  });

  it('passes context through to the callback', () => {
    const fn = vi.fn().mockReturnValue(redMarker);
    const renderer = new CallbackRenderer(fn);
    const feature = makeFeature('f1');
    const context: SymbolRenderContext = { zoom: 10, resolution: 152.87 };

    renderer.getSymbol(feature, context);

    expect(fn).toHaveBeenCalledWith(feature, context);
  });

  it('supports zoom-dependent symbology via context', () => {
    const fn: CallbackRendererFn = (_feature, context) => {
      const size = context ? Math.max(4, context.zoom * 2) : 8;
      return { type: 'simple-marker', color: [255, 0, 0, 255], size };
    };

    const renderer = new CallbackRenderer(fn);
    const feature = makeFeature('f1');

    const lowZoom = renderer.getSymbol(feature, { zoom: 3, resolution: 1000 });
    const highZoom = renderer.getSymbol(feature, { zoom: 15, resolution: 10 });
    const noContext = renderer.getSymbol(feature);

    expect(lowZoom).toEqual({ type: 'simple-marker', color: [255, 0, 0, 255], size: 6 });
    expect(highZoom).toEqual({ type: 'simple-marker', color: [255, 0, 0, 255], size: 30 });
    expect(noContext).toEqual({ type: 'simple-marker', color: [255, 0, 0, 255], size: 8 });
  });
});
