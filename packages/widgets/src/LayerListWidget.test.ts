import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ILayer, IView, LayerEvents } from '@mapgpu/core';
import { LayerListWidget } from './LayerListWidget.js';

type LayerEventHandler<K extends keyof LayerEvents> = (data: LayerEvents[K]) => void;

function createMockLayer(id: string, options?: Partial<ILayer>): ILayer {
  const handlers = new Map<keyof LayerEvents, Set<LayerEventHandler<keyof LayerEvents>>>();

  return {
    id,
    type: 'feature',
    visible: true,
    opacity: 1,
    loaded: true,
    load: vi.fn(() => Promise.resolve()),
    refresh: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn(<K extends keyof LayerEvents>(event: K, handler: LayerEventHandler<K>) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler as LayerEventHandler<keyof LayerEvents>);
    }),
    off: vi.fn(<K extends keyof LayerEvents>(event: K, handler: LayerEventHandler<K>) => {
      handlers.get(event)?.delete(handler as LayerEventHandler<keyof LayerEvents>);
    }),
    ...options,
  };
}

function createMockView(): IView {
  return { id: 'view-1', type: '2d' };
}

describe('LayerListWidget', () => {
  let container: HTMLElement;
  let widget: LayerListWidget;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    widget = new LayerListWidget({ id: 'layer-list-test' });
    widget.mount(container);
  });

  it('should render with correct DOM structure', () => {
    const root = container.querySelector('#layer-list-test');
    expect(root).not.toBeNull();
    expect(root!.classList.contains('mapgpu-widget-layerlist')).toBe(true);

    const ul = root!.querySelector('ul');
    expect(ul).not.toBeNull();
  });

  describe('addLayer', () => {
    it('should add a layer and render it in the list', () => {
      const layer = createMockLayer('layer-1');
      widget.addLayer(layer);

      expect(widget.layers).toHaveLength(1);
      const li = container.querySelector('[data-layer-id="layer-1"]');
      expect(li).not.toBeNull();
    });

    it('should not add duplicate layers', () => {
      const layer = createMockLayer('layer-1');
      widget.addLayer(layer);
      widget.addLayer(layer);
      expect(widget.layers).toHaveLength(1);
    });

    it('should render checkbox with correct state', () => {
      const layer = createMockLayer('layer-vis', { visible: false });
      widget.addLayer(layer);

      const checkbox = container.querySelector(
        '[data-layer-id="layer-vis"] input[type="checkbox"]',
      ) as HTMLInputElement;
      expect(checkbox).not.toBeNull();
      expect(checkbox.checked).toBe(false);
    });

    it('should render opacity slider with correct value', () => {
      const layer = createMockLayer('layer-op', { opacity: 0.5 });
      widget.addLayer(layer);

      const slider = container.querySelector(
        '[data-layer-id="layer-op"] input[type="range"]',
      ) as HTMLInputElement;
      expect(slider).not.toBeNull();
      expect(slider.value).toBe('50');
    });

    it('should emit layer-add event', () => {
      const handler = vi.fn();
      widget.on('layer-add', handler);

      const layer = createMockLayer('layer-event');
      widget.addLayer(layer);

      expect(handler).toHaveBeenCalledWith(layer);
    });
  });

  describe('removeLayer', () => {
    it('should remove a layer by reference', () => {
      const layer = createMockLayer('layer-1');
      widget.addLayer(layer);
      widget.removeLayer(layer);

      expect(widget.layers).toHaveLength(0);
      expect(container.querySelector('[data-layer-id="layer-1"]')).toBeNull();
    });

    it('should remove a layer by id', () => {
      const layer = createMockLayer('layer-1');
      widget.addLayer(layer);
      widget.removeLayer('layer-1');

      expect(widget.layers).toHaveLength(0);
    });

    it('should emit layer-remove event', () => {
      const handler = vi.fn();
      widget.on('layer-remove', handler);

      const layer = createMockLayer('layer-rem');
      widget.addLayer(layer);
      widget.removeLayer(layer);

      expect(handler).toHaveBeenCalledWith(layer);
    });

    it('should be safe to remove non-existent layer', () => {
      expect(() => widget.removeLayer('non-existent')).not.toThrow();
    });
  });

  describe('visibility toggle', () => {
    it('should toggle layer visibility when checkbox is clicked', () => {
      const layer = createMockLayer('layer-toggle');
      widget.addLayer(layer);

      const checkbox = container.querySelector(
        '[data-layer-id="layer-toggle"] input[type="checkbox"]',
      ) as HTMLInputElement;
      expect(checkbox.checked).toBe(true);

      // Simulate unchecking
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change'));
      expect(layer.visible).toBe(false);
    });
  });

  describe('opacity slider', () => {
    it('should update layer opacity when slider changes', () => {
      const layer = createMockLayer('layer-slider');
      widget.addLayer(layer);

      const slider = container.querySelector(
        '[data-layer-id="layer-slider"] input[type="range"]',
      ) as HTMLInputElement;
      slider.value = '30';
      slider.dispatchEvent(new Event('input'));

      expect(layer.opacity).toBeCloseTo(0.3);
    });
  });

  describe('reorderLayer', () => {
    it('should reorder layers', () => {
      const l1 = createMockLayer('l1');
      const l2 = createMockLayer('l2');
      const l3 = createMockLayer('l3');
      widget.addLayer(l1);
      widget.addLayer(l2);
      widget.addLayer(l3);

      widget.reorderLayer('l3', 0);

      expect(widget.layers[0]!.id).toBe('l3');
      expect(widget.layers[1]!.id).toBe('l1');
      expect(widget.layers[2]!.id).toBe('l2');
    });

    it('should emit layer-reorder event', () => {
      const handler = vi.fn();
      widget.on('layer-reorder', handler);

      const l1 = createMockLayer('r1');
      const l2 = createMockLayer('r2');
      widget.addLayer(l1);
      widget.addLayer(l2);

      widget.reorderLayer('r2', 0);

      expect(handler).toHaveBeenCalledWith({
        layer: l2,
        newIndex: 0,
      });
    });

    it('should clamp index to valid range', () => {
      const l1 = createMockLayer('c1');
      const l2 = createMockLayer('c2');
      widget.addLayer(l1);
      widget.addLayer(l2);

      widget.reorderLayer('c1', 999);
      expect(widget.layers[1]!.id).toBe('c1');
    });
  });

  describe('bind', () => {
    it('should accept view binding', () => {
      const view = createMockView();
      expect(() => widget.bind(view)).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should clean up layers and DOM', () => {
      const layer = createMockLayer('d1');
      widget.addLayer(layer);
      widget.destroy();

      expect(container.querySelector('#layer-list-test')).toBeNull();
    });
  });

  describe('event subscriptions', () => {
    it('should subscribe and unsubscribe from layer events', () => {
      const layer = createMockLayer('ev-layer');
      widget.addLayer(layer);
      expect(layer.on).toHaveBeenCalled();
    });
  });
});
