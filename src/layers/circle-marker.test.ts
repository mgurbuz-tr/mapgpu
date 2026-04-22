import { describe, it, expect } from 'vitest';
import { createCircleMarkerSymbol } from './circle-marker.js';

describe('createCircleMarkerSymbol', () => {
  it('returns correct defaults when called with no options', () => {
    const sym = createCircleMarkerSymbol();
    expect(sym.type).toBe('simple-marker');
    expect(sym.color).toEqual([66, 133, 244, 255]);
    expect(sym.size).toBe(10);
    expect(sym.outlineColor).toEqual([255, 255, 255, 255]);
    expect(sym.outlineWidth).toBe(1.5);
  });

  it('uses custom fillColor, strokeColor, strokeWeight, and radius', () => {
    const sym = createCircleMarkerSymbol({
      fillColor: [255, 0, 0, 200],
      strokeColor: [0, 0, 0, 255],
      strokeWeight: 3,
      radius: 20,
    });
    expect(sym.color).toEqual([255, 0, 0, 200]);
    expect(sym.size).toBe(20);
    expect(sym.outlineColor).toEqual([0, 0, 0, 255]);
    expect(sym.outlineWidth).toBe(3);
  });

  it('fillOpacity overrides fillColor alpha channel', () => {
    const sym = createCircleMarkerSymbol({
      fillColor: [100, 200, 50, 255],
      fillOpacity: 0.5,
    });
    expect(sym.color).toEqual([100, 200, 50, 128]);
  });

  it('fillOpacity works with default fillColor', () => {
    const sym = createCircleMarkerSymbol({ fillOpacity: 0 });
    expect(sym.color).toEqual([66, 133, 244, 0]);
  });

  it('fillOpacity of 1 produces alpha 255', () => {
    const sym = createCircleMarkerSymbol({ fillOpacity: 1 });
    expect(sym.color[3]).toBe(255);
  });
});
