import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlaceGeometryTool, generateGeometrySlices, GEOMETRY_MODEL_IDS } from './PlaceGeometryTool.js';
import type { ITargetLayer } from './commands/CreateFeatureCommand.js';

function createMockPreviewLayer() {
  return {
    add: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
    graphics: [] as never[],
  };
}

function createMockContext() {
  return {
    toMap: vi.fn().mockReturnValue([29, 41]),
    toScreen: vi.fn().mockReturnValue([100, 200]),
    canvas: document.createElement('canvas'),
    mode: '2d' as const,
    zoom: 12,
    previewLayer: createMockPreviewLayer(),
    commands: {
      execute: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      canUndo: false,
      canRedo: false,
    },
    markDirty: vi.fn(),
    emitEvent: vi.fn(),
  };
}

function createMockPointerEvent(mapCoords: [number, number], screenY = 200): any {
  return {
    screenX: 100,
    screenY,
    mapCoords,
    originalEvent: new PointerEvent('pointerdown'),
    button: 0,
  };
}

function createMockTargetLayer(): ITargetLayer {
  return {
    add: vi.fn(),
    remove: vi.fn(),
  };
}

describe('PlaceGeometryTool', () => {
  let tool: PlaceGeometryTool;
  let targetLayer: ITargetLayer;

  beforeEach(() => {
    targetLayer = createMockTargetLayer();
    tool = new PlaceGeometryTool({ targetLayer });
  });

  describe('constructor', () => {
    it('has correct id and name', () => {
      expect(tool.id).toBe('place-geometry');
      expect(tool.name).toBe('Place Geometry');
    });

    it('defaults to cylinder geometry type', () => {
      expect(tool.geometryType).toBe('cylinder');
    });

    it('defaults to blue color', () => {
      expect(tool.color).toEqual([88, 166, 255, 220]);
    });

    it('accepts custom geometry type', () => {
      const t = new PlaceGeometryTool({ targetLayer, geometryType: 'box' });
      expect(t.geometryType).toBe('box');
    });

    it('accepts custom color', () => {
      const t = new PlaceGeometryTool({ targetLayer, color: [255, 0, 0, 255] });
      expect(t.color).toEqual([255, 0, 0, 255]);
    });
  });

  describe('setters', () => {
    it('setGeometryType changes the type', () => {
      tool.setGeometryType('cone');
      expect(tool.geometryType).toBe('cone');
    });

    it('setColor changes the color', () => {
      tool.setColor([0, 255, 0, 128]);
      expect(tool.color).toEqual([0, 255, 0, 128]);
    });
  });

  describe('lifecycle', () => {
    it('starts in idle phase', () => {
      expect(tool.phase).toBe('idle');
    });

    it('activate sets cursor to crosshair', () => {
      const ctx = createMockContext();
      tool.activate(ctx);
      expect(tool.cursor).toBe('crosshair');
      expect(tool.phase).toBe('idle');
    });

    it('deactivate clears preview', () => {
      const ctx = createMockContext();
      tool.activate(ctx);
      tool.deactivate();
      expect(ctx.previewLayer.clear).toHaveBeenCalled();
    });
  });

  describe('pointer events — sizing phase', () => {
    it('pointerDown in idle starts sizing', () => {
      const ctx = createMockContext();
      tool.activate(ctx);

      const e = createMockPointerEvent([29, 41]);
      const handled = tool.onPointerDown(e);
      expect(handled).toBe(true);
      expect(tool.phase).toBe('sizing');
    });

    it('pointerMove during sizing updates radius', () => {
      const ctx = createMockContext();
      tool.activate(ctx);

      tool.onPointerDown(createMockPointerEvent([29, 41]));

      // Move to a different location
      tool.onPointerMove(createMockPointerEvent([29.01, 41]));
      expect(tool.currentRadius).toBeGreaterThan(0);
    });

    it('pointerUp during sizing transitions to extruding', () => {
      const ctx = createMockContext();
      tool.activate(ctx);

      tool.onPointerDown(createMockPointerEvent([29, 41]));
      tool.onPointerMove(createMockPointerEvent([29.01, 41]));
      tool.onPointerUp(createMockPointerEvent([29.01, 41], 300));

      expect(tool.phase).toBe('extruding');
    });
  });

  describe('pointer events — extruding phase', () => {
    it('pointerMove during extruding updates height', () => {
      const ctx = createMockContext();
      tool.activate(ctx);

      tool.onPointerDown(createMockPointerEvent([29, 41]));
      tool.onPointerMove(createMockPointerEvent([29.01, 41]));
      tool.onPointerUp(createMockPointerEvent([29.01, 41], 300));

      // Move mouse up (lower screenY = higher)
      tool.onPointerMove(createMockPointerEvent([29.01, 41], 200));
      expect(tool.currentHeight).toBeGreaterThan(0);
    });

    it('pointerDown during extruding creates feature', () => {
      const ctx = createMockContext();
      tool.activate(ctx);

      tool.onPointerDown(createMockPointerEvent([29, 41]));
      tool.onPointerMove(createMockPointerEvent([29.01, 41]));
      tool.onPointerUp(createMockPointerEvent([29.01, 41], 300));
      tool.onPointerMove(createMockPointerEvent([29.01, 41], 200));

      // Click to confirm
      tool.onPointerDown(createMockPointerEvent([29.01, 41]));

      expect(ctx.commands.execute).toHaveBeenCalled();
      expect(ctx.emitEvent).toHaveBeenCalledWith('draw-complete', expect.any(Object));
      expect(tool.phase).toBe('idle');
    });

    it('fires onExtrusionPreview callback during extrusion', () => {
      const ctx = createMockContext();
      const callback = vi.fn();
      tool.onExtrusionPreview = callback;
      tool.activate(ctx);

      tool.onPointerDown(createMockPointerEvent([29, 41]));
      tool.onPointerMove(createMockPointerEvent([29.01, 41]));
      tool.onPointerUp(createMockPointerEvent([29.01, 41], 300));

      // Initial preview fire on pointerUp
      const callsAfterUp = callback.mock.calls.length;
      expect(callsAfterUp).toBeGreaterThanOrEqual(1);

      // Move to update height
      tool.onPointerMove(createMockPointerEvent([29.01, 41], 200));
      expect(callback.mock.calls.length).toBeGreaterThan(callsAfterUp);
    });
  });

  describe('keyboard events', () => {
    it('Escape cancels current operation', () => {
      const ctx = createMockContext();
      tool.activate(ctx);

      tool.onPointerDown(createMockPointerEvent([29, 41]));
      expect(tool.phase).toBe('sizing');

      const handled = tool.onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(handled).toBe(true);
      expect(tool.phase).toBe('idle');
    });

    it('Enter confirms during extruding', () => {
      const ctx = createMockContext();
      tool.activate(ctx);

      tool.onPointerDown(createMockPointerEvent([29, 41]));
      tool.onPointerMove(createMockPointerEvent([29.01, 41]));
      tool.onPointerUp(createMockPointerEvent([29.01, 41], 300));

      const handled = tool.onKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(handled).toBe(true);
      expect(ctx.commands.execute).toHaveBeenCalled();
    });

    it('Escape in idle is not handled', () => {
      const ctx = createMockContext();
      tool.activate(ctx);

      const handled = tool.onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(handled).toBe(false);
    });
  });

  describe('cancel', () => {
    it('resets to idle', () => {
      const ctx = createMockContext();
      tool.activate(ctx);
      tool.onPointerDown(createMockPointerEvent([29, 41]));
      tool.cancel();
      expect(tool.phase).toBe('idle');
      expect(ctx.previewLayer.clear).toHaveBeenCalled();
    });

    it('fires onExtrusionPreview with zero values on cancel', () => {
      const ctx = createMockContext();
      const callback = vi.fn();
      tool.onExtrusionPreview = callback;
      tool.activate(ctx);

      tool.onPointerDown(createMockPointerEvent([29, 41]));
      tool.cancel();

      // Should fire with radius=0, height=0
      expect(callback).toHaveBeenCalledWith(
        expect.any(Array),
        0,
        0,
        expect.any(String),
      );
    });
  });

  describe('double click', () => {
    it('confirms during extruding', () => {
      const ctx = createMockContext();
      tool.activate(ctx);

      tool.onPointerDown(createMockPointerEvent([29, 41]));
      tool.onPointerMove(createMockPointerEvent([29.01, 41]));
      tool.onPointerUp(createMockPointerEvent([29.01, 41], 300));

      const handled = tool.onDoubleClick(createMockPointerEvent([29.01, 41]));
      expect(handled).toBe(true);
      expect(ctx.commands.execute).toHaveBeenCalled();
    });

    it('is not handled in idle', () => {
      const ctx = createMockContext();
      tool.activate(ctx);
      const handled = tool.onDoubleClick(createMockPointerEvent([29, 41]));
      expect(handled).toBe(false);
    });
  });

  describe('feature creation — geometry types', () => {
    it('creates Polygon for box type', () => {
      const ctx = createMockContext();
      tool.setGeometryType('box');
      tool.activate(ctx);

      tool.onPointerDown(createMockPointerEvent([29, 41]));
      tool.onPointerMove(createMockPointerEvent([29.01, 41]));
      tool.onPointerUp(createMockPointerEvent([29.01, 41], 300));
      tool.onPointerDown(createMockPointerEvent([29.01, 41]));

      const cmd = (ctx.commands.execute as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(cmd).toBeDefined();
    });

    it('creates Point for cone type', () => {
      const ctx = createMockContext();
      tool.setGeometryType('cone');
      tool.activate(ctx);

      tool.onPointerDown(createMockPointerEvent([29, 41]));
      tool.onPointerMove(createMockPointerEvent([29.01, 41]));
      tool.onPointerUp(createMockPointerEvent([29.01, 41], 300));
      tool.onPointerDown(createMockPointerEvent([29.01, 41]));

      expect(ctx.commands.execute).toHaveBeenCalled();
    });
  });
});

describe('GEOMETRY_MODEL_IDS', () => {
  it('has entries for all geometry types', () => {
    expect(GEOMETRY_MODEL_IDS.box).toBe('__geo-box__');
    expect(GEOMETRY_MODEL_IDS.cylinder).toBe('__geo-cylinder__');
    expect(GEOMETRY_MODEL_IDS.sphere).toBe('__geo-sphere__');
    expect(GEOMETRY_MODEL_IDS.cone).toBe('__geo-cone__');
  });
});

describe('generateGeometrySlices', () => {
  it('generates a single slice for box', () => {
    const slices = generateGeometrySlices([29, 41], 50, 100, 'box');
    expect(slices).toHaveLength(1);
    expect(slices[0]!.geometry.type).toBe('Polygon');
    expect(slices[0]!.attributes.height).toBe(100);
    expect(slices[0]!.attributes.minHeight).toBe(0);
  });

  it('generates a single slice for cylinder', () => {
    const slices = generateGeometrySlices([29, 41], 50, 100, 'cylinder');
    expect(slices).toHaveLength(1);
    expect(slices[0]!.geometry.type).toBe('Polygon');
  });

  it('generates multiple slices for cone', () => {
    const slices = generateGeometrySlices([29, 41], 50, 100, 'cone');
    expect(slices.length).toBeGreaterThan(1);
    // Each slice should have ascending height
    for (let i = 1; i < slices.length; i++) {
      const prevH = slices[i - 1]!.attributes.minHeight as number;
      const currH = slices[i]!.attributes.minHeight as number;
      expect(currH).toBeGreaterThanOrEqual(prevH);
    }
  });

  it('generates multiple slices for sphere', () => {
    const slices = generateGeometrySlices([29, 41], 50, 100, 'sphere');
    expect(slices.length).toBeGreaterThan(1);
  });

  it('cone slices have decreasing radius', () => {
    const slices = generateGeometrySlices([29, 41], 100, 200, 'cone');
    for (let i = 1; i < slices.length; i++) {
      const prevR = slices[i - 1]!.attributes.radius as number;
      const currR = slices[i]!.attributes.radius as number;
      expect(currR).toBeLessThanOrEqual(prevR);
    }
  });
});
