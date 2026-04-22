import { describe, it, expect } from 'vitest';
import {
  CURSOR_POINT_SYMBOL,
  VERTEX_SYMBOL,
  MIDPOINT_SYMBOL,
  PREVIEW_LINE_SYMBOL,
  PREVIEW_POLYGON_SYMBOL,
  OUTPUT_POINT_SYMBOL,
  OUTPUT_LINE_SYMBOL,
  OUTPUT_POLYGON_SYMBOL,
  SELECTED_LINE_SYMBOL,
  SELECTED_POLYGON_SYMBOL,
  SNAP_INDICATOR_SYMBOL,
  ANGLE_GUIDE_LINE_SYMBOL,
} from './drawSymbols.js';

describe('drawSymbols', () => {
  describe('PointSymbol constants', () => {
    it('CURSOR_POINT_SYMBOL has correct structure', () => {
      expect(CURSOR_POINT_SYMBOL.type).toBe('simple-marker');
      expect(CURSOR_POINT_SYMBOL.color).toHaveLength(4);
      expect(CURSOR_POINT_SYMBOL.size).toBeGreaterThan(0);
      expect(CURSOR_POINT_SYMBOL.outlineColor).toHaveLength(4);
      expect(CURSOR_POINT_SYMBOL.outlineWidth).toBeGreaterThan(0);
    });

    it('VERTEX_SYMBOL has correct structure', () => {
      expect(VERTEX_SYMBOL.type).toBe('simple-marker');
      expect(VERTEX_SYMBOL.color).toEqual([255, 255, 255, 255]);
      expect(VERTEX_SYMBOL.size).toBeGreaterThan(0);
    });

    it('MIDPOINT_SYMBOL has correct structure', () => {
      expect(MIDPOINT_SYMBOL.type).toBe('simple-marker');
      expect(MIDPOINT_SYMBOL.color).toHaveLength(4);
      expect(MIDPOINT_SYMBOL.size).toBeLessThan(VERTEX_SYMBOL.size!);
    });

    it('OUTPUT_POINT_SYMBOL has correct structure', () => {
      expect(OUTPUT_POINT_SYMBOL.type).toBe('simple-marker');
      expect(OUTPUT_POINT_SYMBOL.color).toHaveLength(4);
    });

    it('SNAP_INDICATOR_SYMBOL has green color', () => {
      expect(SNAP_INDICATOR_SYMBOL.type).toBe('simple-marker');
      // Green channel should be the dominant
      expect(SNAP_INDICATOR_SYMBOL.color![1]).toBeGreaterThan(SNAP_INDICATOR_SYMBOL.color![0]!);
      expect(SNAP_INDICATOR_SYMBOL.size).toBeGreaterThan(VERTEX_SYMBOL.size!);
    });
  });

  describe('LineSymbol constants', () => {
    it('PREVIEW_LINE_SYMBOL has correct structure', () => {
      expect(PREVIEW_LINE_SYMBOL.type).toBe('simple-line');
      expect(PREVIEW_LINE_SYMBOL.color).toHaveLength(4);
      expect(PREVIEW_LINE_SYMBOL.width).toBeGreaterThan(0);
      expect(PREVIEW_LINE_SYMBOL.style).toBe('solid');
    });

    it('OUTPUT_LINE_SYMBOL has correct structure', () => {
      expect(OUTPUT_LINE_SYMBOL.type).toBe('simple-line');
      expect(OUTPUT_LINE_SYMBOL.style).toBe('solid');
    });

    it('SELECTED_LINE_SYMBOL has wider stroke than preview', () => {
      expect(SELECTED_LINE_SYMBOL.width).toBeGreaterThan(PREVIEW_LINE_SYMBOL.width!);
    });

    it('ANGLE_GUIDE_LINE_SYMBOL has dash style', () => {
      expect(ANGLE_GUIDE_LINE_SYMBOL.type).toBe('simple-line');
      expect(ANGLE_GUIDE_LINE_SYMBOL.style).toBe('dash');
    });
  });

  describe('PolygonSymbol constants', () => {
    it('PREVIEW_POLYGON_SYMBOL has correct structure', () => {
      expect(PREVIEW_POLYGON_SYMBOL.type).toBe('simple-fill');
      expect(PREVIEW_POLYGON_SYMBOL.color).toHaveLength(4);
      expect(PREVIEW_POLYGON_SYMBOL.outlineColor).toHaveLength(4);
      expect(PREVIEW_POLYGON_SYMBOL.outlineWidth).toBeGreaterThan(0);
    });

    it('PREVIEW_POLYGON_SYMBOL has semi-transparent fill', () => {
      expect(PREVIEW_POLYGON_SYMBOL.color![3]).toBeLessThan(255);
    });

    it('OUTPUT_POLYGON_SYMBOL has correct structure', () => {
      expect(OUTPUT_POLYGON_SYMBOL.type).toBe('simple-fill');
      expect(OUTPUT_POLYGON_SYMBOL.outlineColor).toHaveLength(4);
    });

    it('SELECTED_POLYGON_SYMBOL has correct structure', () => {
      expect(SELECTED_POLYGON_SYMBOL.type).toBe('simple-fill');
      expect(SELECTED_POLYGON_SYMBOL.outlineWidth).toBeGreaterThan(PREVIEW_POLYGON_SYMBOL.outlineWidth!);
    });
  });

  describe('color consistency', () => {
    it('all RGBA arrays have values in 0-255 range', () => {
      const allSymbols = [
        CURSOR_POINT_SYMBOL, VERTEX_SYMBOL, MIDPOINT_SYMBOL,
        PREVIEW_LINE_SYMBOL, PREVIEW_POLYGON_SYMBOL,
        OUTPUT_POINT_SYMBOL, OUTPUT_LINE_SYMBOL, OUTPUT_POLYGON_SYMBOL,
        SELECTED_LINE_SYMBOL, SELECTED_POLYGON_SYMBOL,
        SNAP_INDICATOR_SYMBOL, ANGLE_GUIDE_LINE_SYMBOL,
      ];

      for (const sym of allSymbols) {
        if ('color' in sym && sym.color) {
          for (const c of sym.color) {
            expect(c).toBeGreaterThanOrEqual(0);
            expect(c).toBeLessThanOrEqual(255);
          }
        }
        if ('outlineColor' in sym && sym.outlineColor) {
          for (const c of sym.outlineColor) {
            expect(c).toBeGreaterThanOrEqual(0);
            expect(c).toBeLessThanOrEqual(255);
          }
        }
      }
    });
  });
});
