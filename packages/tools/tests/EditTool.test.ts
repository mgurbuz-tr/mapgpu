import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditTool } from '../src/EditTool.js';
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
    toScreen: (lon, _lat) => [lon * 10, _lat * 10], // Simple mapping
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
  screenX: number,
  screenY: number,
  mapCoords: [number, number] | null = [screenX / 10, screenY / 10],
): ToolPointerEvent {
  return {
    screenX,
    screenY,
    mapCoords,
    originalEvent: new PointerEvent('pointerup'),
    button: 0,
    shiftKey: false,
    ctrlKey: false,
  };
}

describe('EditTool', () => {
  let tool: EditTool;
  let layerFeatures: Feature[];
  let editableLayer: {
    add: (f: Feature) => void;
    remove: (id: string | number) => boolean;
    getFeatures: () => readonly Feature[];
    readonly id: string;
  };

  beforeEach(() => {
    layerFeatures = [];
    editableLayer = {
      id: 'test-layer',
      add(f: Feature) {
        const idx = layerFeatures.findIndex(x => x.id === f.id);
        if (idx >= 0) layerFeatures[idx] = f;
        else layerFeatures.push(f);
      },
      remove(id: string | number) {
        const idx = layerFeatures.findIndex(f => f.id === id);
        if (idx >= 0) { layerFeatures.splice(idx, 1); return true; }
        return false;
      },
      getFeatures() { return layerFeatures; },
    };
    tool = new EditTool({ editableLayers: [editableLayer] });
  });

  it('starts idle', () => {
    expect(tool.state).toBe('idle');
    expect(tool.id).toBe('edit');
    expect(tool.name).toBe('Edit');
  });

  it('activates with pointer cursor', () => {
    const ctx = createMockContext();
    tool.activate(ctx);
    expect(tool.state).toBe('active');
    expect(tool.cursor).toBe('pointer');
  });

  it('selects a feature on click near vertex', () => {
    const feature: Feature = {
      id: 'test-1',
      geometry: { type: 'Point', coordinates: [29.0, 41.0] },
      attributes: {},
    };
    layerFeatures.push(feature);

    const ctx = createMockContext();
    tool.activate(ctx);

    // Click near the feature's vertex (toScreen maps [29, 41] → [290, 410])
    tool.onPointerUp(pe(290, 410, [29.0, 41.0]));

    expect(tool.state).toBe('editing');
    expect(ctx.emitEvent).toHaveBeenCalledWith('feature-select', expect.objectContaining({
      feature: expect.objectContaining({ id: 'test-1' }),
      layerId: 'test-layer',
    }));
  });

  it('shows vertex handles when feature is selected', () => {
    const feature: Feature = {
      id: 'line-1',
      geometry: {
        type: 'LineString',
        coordinates: [[29.0, 41.0], [29.1, 41.1]],
      },
      attributes: {},
    };
    layerFeatures.push(feature);

    const ctx = createMockContext();
    tool.activate(ctx);

    tool.onPointerUp(pe(290, 410, [29.0, 41.0]));

    // Should have vertex handles + midpoint handles
    const vertexHandles = ctx.previewLayer.graphics.filter(
      f => f.attributes['__type'] === 'vertex-handle'
    );
    expect(vertexHandles.length).toBe(2);
  });

  it('deselects on click in empty space', () => {
    const feature: Feature = {
      id: 'p1',
      geometry: { type: 'Point', coordinates: [29.0, 41.0] },
      attributes: {},
    };
    layerFeatures.push(feature);

    const ctx = createMockContext();
    tool.activate(ctx);

    // Select
    tool.onPointerUp(pe(290, 410, [29.0, 41.0]));
    expect(tool.state).toBe('editing');

    // Click far away
    tool.onPointerUp(pe(0, 0, [0, 0]));
    expect(tool.state).toBe('active');
  });

  it('cancels selection on cancel()', () => {
    const feature: Feature = {
      id: 'p1',
      geometry: { type: 'Point', coordinates: [29.0, 41.0] },
      attributes: {},
    };
    layerFeatures.push(feature);

    const ctx = createMockContext();
    tool.activate(ctx);

    tool.onPointerUp(pe(290, 410, [29.0, 41.0]));
    expect(tool.state).toBe('editing');

    tool.cancel();
    expect(tool.state).toBe('active');
    expect(ctx.previewLayer.graphics).toHaveLength(0);
  });

  it('transitions to idle on deactivate', () => {
    const ctx = createMockContext();
    tool.activate(ctx);
    tool.deactivate();
    expect(tool.state).toBe('idle');
  });
});
