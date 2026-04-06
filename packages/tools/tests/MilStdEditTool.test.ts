import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MilStdEditTool } from '../src/MilStdEditTool.js';
import type { ToolContext, IPreviewLayer, ToolPointerEvent, Feature } from '@mapgpu/core';
import { CommandSystem } from '@mapgpu/core';

function createMockPreview(): IPreviewLayer {
  const features: Feature[] = [];
  return {
    add(f: Feature) { features.push(f); },
    remove(id: string | number) {
      const idx = features.findIndex(f => f.id === id);
      if (idx >= 0) { features.splice(idx, 1); return true; }
      return false;
    },
    clear() { features.length = 0; },
    get graphics() { return features; },
  };
}

function createMockContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    toMap: (_sx, _sy) => [29.0, 41.0],
    toScreen: (lon, lat) => [lon * 10, lat * 10], // Simple mapping for hit-testing
    canvas: document.createElement('canvas'),
    mode: '2d',
    zoom: 10,
    previewLayer: createMockPreview(),
    commands: new CommandSystem(),
    markDirty: vi.fn(),
    emitEvent: vi.fn(),
    ...overrides,
  };
}

function pe(
  coords: [number, number] | null,
  screenX = 400,
  screenY = 300,
): ToolPointerEvent {
  return {
    screenX,
    screenY,
    mapCoords: coords,
    originalEvent: new PointerEvent('pointerdown'),
    button: 0,
    shiftKey: false,
    ctrlKey: false,
  };
}

describe('MilStdEditTool', () => {
  let tool: MilStdEditTool;

  beforeEach(() => {
    tool = new MilStdEditTool({ tolerance: 12 });
  });

  // ─── Identity ───

  it('has correct id and name', () => {
    expect(tool.id).toBe('milstd-edit');
    expect(tool.name).toBe('MIL-STD Edit');
  });

  it('starts in idle state', () => {
    expect(tool.state).toBe('idle');
  });

  it('transitions to active on activate', () => {
    const ctx = createMockContext();
    tool.activate(ctx);
    expect(tool.state).toBe('active');
    expect(tool.cursor).toBe('default');
  });

  // ─── selectFeature ───

  describe('selectFeature', () => {
    it('extracts control points from attributes (tactical graphic)', () => {
      const ctx = createMockContext();
      tool.activate(ctx);

      const feature: Feature = {
        id: 'tg-1',
        geometry: {
          type: 'LineString',
          coordinates: [[29.0, 41.0], [29.1, 41.1]],
        },
        attributes: {
          sidc: 'GFGPOLAZ------',
          controlPoints: JSON.stringify([[29.0, 41.0], [29.1, 41.1]]),
        },
      };

      tool.selectFeature(feature);

      expect(tool.state).toBe('editing');
      expect(tool.controlPoints).toHaveLength(2);
      expect(tool.controlPoints[0]).toEqual([29.0, 41.0]);
      expect(tool.controlPoints[1]).toEqual([29.1, 41.1]);
      expect(tool.selectedFeature).toBe(feature);
    });

    it('extracts coordinates from Point geometry when no controlPoints attribute', () => {
      const ctx = createMockContext();
      tool.activate(ctx);

      const feature: Feature = {
        id: 'pt-1',
        geometry: { type: 'Point', coordinates: [29.5, 41.5] },
        attributes: { sidc: 'SFGPUCIZ------' },
      };

      tool.selectFeature(feature);

      expect(tool.controlPoints).toHaveLength(1);
      expect(tool.controlPoints[0]).toEqual([29.5, 41.5]);
    });

    it('shows control point handles in preview', () => {
      const ctx = createMockContext();
      tool.activate(ctx);

      const feature: Feature = {
        id: 'tg-1',
        geometry: {
          type: 'LineString',
          coordinates: [[29.0, 41.0], [29.1, 41.1]],
        },
        attributes: {
          sidc: 'GFGPOLAZ------',
          controlPoints: JSON.stringify([[29.0, 41.0], [29.1, 41.1]]),
        },
      };

      tool.selectFeature(feature);

      const previews = ctx.previewLayer.graphics;
      // Should have 2 CP points + 1 line
      const cpPoints = previews.filter(f => f.attributes.__type === 'control-point');
      expect(cpPoints).toHaveLength(2);

      const cpLine = previews.find(f => f.geometry.type === 'LineString');
      expect(cpLine).toBeDefined();
    });
  });

  // ─── deselectFeature ───

  describe('deselectFeature', () => {
    it('clears state and preview', () => {
      const ctx = createMockContext();
      tool.activate(ctx);

      const feature: Feature = {
        id: 'tg-1',
        geometry: { type: 'Point', coordinates: [29.0, 41.0] },
        attributes: { sidc: 'SFGPUCIZ------' },
      };

      tool.selectFeature(feature);
      expect(tool.state).toBe('editing');

      tool.deselectFeature();

      expect(tool.state).toBe('active');
      expect(tool.selectedFeature).toBeNull();
      expect(tool.controlPoints).toHaveLength(0);
      expect(ctx.previewLayer.graphics).toHaveLength(0);
    });
  });

  // ─── changeSidc ───

  describe('changeSidc', () => {
    it('updates feature sidc attribute', () => {
      const ctx = createMockContext();
      tool.activate(ctx);

      const feature: Feature = {
        id: 'pt-1',
        geometry: { type: 'Point', coordinates: [29.0, 41.0] },
        attributes: { sidc: 'SFGPUCIZ------' },
      };

      tool.selectFeature(feature);
      tool.changeSidc('SHGPUCIZ------');

      expect(feature.attributes.sidc).toBe('SHGPUCIZ------');
    });

    it('does nothing if no feature is selected', () => {
      const ctx = createMockContext();
      tool.activate(ctx);

      // Should not throw
      tool.changeSidc('SHGPUCIZ------');
    });
  });

  // ─── Control Point Dragging ───

  describe('control point dragging', () => {
    it('starts drag on pointer down near control point', () => {
      // toScreen maps coords to [lon*10, lat*10]
      // CP at [29.0, 41.0] → screen [290, 410]
      const ctx = createMockContext();
      tool.activate(ctx);

      const feature: Feature = {
        id: 'tg-1',
        geometry: {
          type: 'LineString',
          coordinates: [[29.0, 41.0], [29.1, 41.1]],
        },
        attributes: {
          sidc: 'GFGPOLAZ------',
          controlPoints: JSON.stringify([[29.0, 41.0], [29.1, 41.1]]),
        },
      };

      tool.selectFeature(feature);

      // Click near first CP: screen [290, 410], click at [295, 415] (within tolerance=12)
      const result = tool.onPointerDown(pe([29.0, 41.0], 295, 415));
      expect(result).toBe(true);
      expect(tool.cursor).toBe('move');
    });

    it('returns false when clicking away from control points', () => {
      const ctx = createMockContext();
      tool.activate(ctx);

      const feature: Feature = {
        id: 'tg-1',
        geometry: {
          type: 'LineString',
          coordinates: [[29.0, 41.0], [29.1, 41.1]],
        },
        attributes: {
          sidc: 'GFGPOLAZ------',
          controlPoints: JSON.stringify([[29.0, 41.0], [29.1, 41.1]]),
        },
      };

      tool.selectFeature(feature);

      // Click far from any CP
      const result = tool.onPointerDown(pe([50.0, 50.0], 100, 100));
      expect(result).toBe(false);
    });

    it('updates control point position during drag', () => {
      const ctx = createMockContext();
      tool.activate(ctx);

      const feature: Feature = {
        id: 'tg-1',
        geometry: {
          type: 'LineString',
          coordinates: [[29.0, 41.0], [29.1, 41.1]],
        },
        attributes: {
          sidc: 'GFGPOLAZ------',
          controlPoints: JSON.stringify([[29.0, 41.0], [29.1, 41.1]]),
        },
      };

      tool.selectFeature(feature);

      // Start drag on first CP (screen: [290, 410])
      tool.onPointerDown(pe([29.0, 41.0], 290, 410));

      // Move to new position
      const moveResult = tool.onPointerMove(pe([29.5, 41.5], 295, 415));
      expect(moveResult).toBe(true);
      expect(tool.controlPoints[0]).toEqual([29.5, 41.5]);
    });

    it('finishes drag on pointer up and updates attributes', () => {
      const ctx = createMockContext();
      tool.activate(ctx);

      const feature: Feature = {
        id: 'tg-1',
        geometry: {
          type: 'LineString',
          coordinates: [[29.0, 41.0], [29.1, 41.1]],
        },
        attributes: {
          sidc: 'GFGPOLAZ------',
          controlPoints: JSON.stringify([[29.0, 41.0], [29.1, 41.1]]),
        },
      };

      tool.selectFeature(feature);

      // Start drag on first CP
      tool.onPointerDown(pe([29.0, 41.0], 290, 410));
      tool.onPointerMove(pe([29.5, 41.5], 295, 415));

      const upResult = tool.onPointerUp(pe([29.5, 41.5], 295, 415));
      expect(upResult).toBe(true);
      expect(tool.cursor).toBe('default');

      // Attributes should be updated
      const updatedCp = JSON.parse(feature.attributes.controlPoints as string);
      expect(updatedCp[0]).toEqual([29.5, 41.5]);
      expect(updatedCp[1]).toEqual([29.1, 41.1]); // Second CP unchanged

      // Should emit feature-update
      expect(ctx.emitEvent).toHaveBeenCalledWith('feature-update', expect.objectContaining({
        feature,
      }));
    });

    it('does not consume pointer move when not dragging', () => {
      const ctx = createMockContext();
      tool.activate(ctx);

      const result = tool.onPointerMove(pe([29.0, 41.0]));
      expect(result).toBe(false);
    });

    it('does not consume pointer up when not dragging', () => {
      const ctx = createMockContext();
      tool.activate(ctx);

      const result = tool.onPointerUp(pe([29.0, 41.0]));
      expect(result).toBe(false);
    });
  });

  // ─── Keyboard ───

  describe('keyboard', () => {
    it('deselects on Escape', () => {
      const ctx = createMockContext();
      tool.activate(ctx);

      const feature: Feature = {
        id: 'pt-1',
        geometry: { type: 'Point', coordinates: [29.0, 41.0] },
        attributes: { sidc: 'SFGPUCIZ------' },
      };

      tool.selectFeature(feature);
      expect(tool.state).toBe('editing');

      const result = tool.onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(result).toBe(true);
      expect(tool.state).toBe('active');
      expect(tool.selectedFeature).toBeNull();
    });

    it('ignores Escape when not editing', () => {
      const ctx = createMockContext();
      tool.activate(ctx);

      const result = tool.onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(result).toBe(false);
    });
  });

  // ─── cancel ───

  describe('cancel', () => {
    it('deselects feature', () => {
      const ctx = createMockContext();
      tool.activate(ctx);

      const feature: Feature = {
        id: 'pt-1',
        geometry: { type: 'Point', coordinates: [29.0, 41.0] },
        attributes: { sidc: 'SFGPUCIZ------' },
      };

      tool.selectFeature(feature);
      tool.cancel();

      expect(tool.state).toBe('active');
      expect(tool.selectedFeature).toBeNull();
    });
  });

  // ─── Deactivation ───

  it('deselects on deactivate', () => {
    const ctx = createMockContext();
    tool.activate(ctx);

    const feature: Feature = {
      id: 'pt-1',
      geometry: { type: 'Point', coordinates: [29.0, 41.0] },
      attributes: { sidc: 'SFGPUCIZ------' },
    };

    tool.selectFeature(feature);
    tool.deactivate();

    expect(tool.state).toBe('idle');
    expect(tool.selectedFeature).toBeNull();
  });

  it('handles invalid controlPoints JSON gracefully', () => {
    const ctx = createMockContext();
    tool.activate(ctx);

    const feature: Feature = {
      id: 'tg-1',
      geometry: {
        type: 'LineString',
        coordinates: [[29.0, 41.0], [29.1, 41.1]],
      },
      attributes: {
        sidc: 'GFGPOLAZ------',
        controlPoints: 'not-valid-json',
      },
    };

    tool.selectFeature(feature);
    expect(tool.controlPoints).toHaveLength(0);
  });
});
