import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IView } from '@mapgpu/core';
import { BasemapGalleryWidget } from './BasemapGalleryWidget.js';
import type { BasemapItem } from './BasemapGalleryWidget.js';

function createMockView(): IView {
  return { id: 'view-1', type: '2d' };
}

const sampleBasemaps: BasemapItem[] = [
  { id: 'osm', title: 'OpenStreetMap' },
  { id: 'satellite', title: 'Satellite', thumbnailUrl: 'data:image/png;base64,abc' },
  { id: 'topo', title: 'Topographic' },
];

describe('BasemapGalleryWidget', () => {
  let container: HTMLElement;
  let widget: BasemapGalleryWidget;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    widget = new BasemapGalleryWidget({
      id: 'basemap-test',
      basemaps: sampleBasemaps,
    });
    widget.mount(container);
  });

  it('should render with correct DOM structure', () => {
    const root = container.querySelector('#basemap-test');
    expect(root).not.toBeNull();
    expect(root!.classList.contains('mapgpu-widget-basemap-gallery')).toBe(true);

    const items = root!.querySelectorAll('.item');
    expect(items.length).toBe(3);
  });

  it('should render basemap items with data-basemap-id attribute', () => {
    const items = container.querySelectorAll('[data-basemap-id]');
    expect(items.length).toBe(3);
    expect(items[0]!.getAttribute('data-basemap-id')).toBe('osm');
    expect(items[1]!.getAttribute('data-basemap-id')).toBe('satellite');
    expect(items[2]!.getAttribute('data-basemap-id')).toBe('topo');
  });

  it('should set first basemap as active by default', () => {
    expect(widget.activeBasemapId).toBe('osm');

    const activeItem = container.querySelector('[data-basemap-id="osm"]') as HTMLElement;
    expect(activeItem.style.border).toContain('solid');
    expect(activeItem.style.border).toContain('#007bff');
  });

  it('should accept custom activeBasemapId', () => {
    const w = new BasemapGalleryWidget({
      id: 'custom-active',
      basemaps: sampleBasemaps,
      activeBasemapId: 'satellite',
    });
    w.mount(container);
    expect(w.activeBasemapId).toBe('satellite');
  });

  describe('selectBasemap', () => {
    it('should change active basemap', () => {
      widget.selectBasemap('satellite');
      expect(widget.activeBasemapId).toBe('satellite');
    });

    it('should highlight the selected item', () => {
      widget.selectBasemap('topo');

      const osmItem = container.querySelector('[data-basemap-id="osm"]') as HTMLElement;
      const topoItem = container.querySelector('[data-basemap-id="topo"]') as HTMLElement;

      expect(topoItem.style.border).toContain('#007bff');
      expect(osmItem.style.border).toContain('transparent');
    });

    it('should fire onSelect handler', () => {
      const handler = vi.fn();
      widget.onSelect(handler);

      widget.selectBasemap('satellite');

      expect(handler).toHaveBeenCalledWith(sampleBasemaps[1]);
    });

    it('should not fire for non-existent basemap', () => {
      const handler = vi.fn();
      widget.onSelect(handler);

      widget.selectBasemap('non-existent');

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('click selection', () => {
    it('should select basemap on click', () => {
      const handler = vi.fn();
      widget.onSelect(handler);

      const satItem = container.querySelector('[data-basemap-id="satellite"]') as HTMLElement;
      satItem.click();

      expect(widget.activeBasemapId).toBe('satellite');
      expect(handler).toHaveBeenCalledWith(sampleBasemaps[1]);
    });
  });

  describe('setBasemaps', () => {
    it('should replace basemap list and rebuild gallery', () => {
      const newBasemaps: BasemapItem[] = [
        { id: 'dark', title: 'Dark Mode' },
        { id: 'light', title: 'Light Mode' },
      ];
      widget.setBasemaps(newBasemaps);

      expect(widget.basemaps).toHaveLength(2);

      const items = container.querySelectorAll('[data-basemap-id]');
      expect(items.length).toBe(2);
      expect(items[0]!.getAttribute('data-basemap-id')).toBe('dark');
    });

    it('should reset active basemap if current is not in new list', () => {
      widget.selectBasemap('satellite');
      expect(widget.activeBasemapId).toBe('satellite');

      widget.setBasemaps([{ id: 'new-map', title: 'New Map' }]);
      expect(widget.activeBasemapId).toBe('new-map');
    });

    it('should keep active basemap if it exists in new list', () => {
      widget.selectBasemap('osm');
      widget.setBasemaps([
        { id: 'osm', title: 'OSM Updated' },
        { id: 'new-map', title: 'New' },
      ]);
      expect(widget.activeBasemapId).toBe('osm');
    });
  });

  describe('offSelect', () => {
    it('should unsubscribe handler', () => {
      const handler = vi.fn();
      widget.onSelect(handler);
      widget.offSelect(handler);

      widget.selectBasemap('satellite');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('bind', () => {
    it('should accept view binding', () => {
      const view = createMockView();
      expect(() => widget.bind(view)).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should clean up DOM and handlers', () => {
      const handler = vi.fn();
      widget.onSelect(handler);
      widget.destroy();

      expect(container.querySelector('#basemap-test')).toBeNull();
      // After destroy, selecting should not fire handler (widget is destroyed)
    });
  });
});
