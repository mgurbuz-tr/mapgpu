import { describe, it, expect, beforeEach } from 'vitest';
import type { IView } from '@mapgpu/core';
import { ScaleBarWidget } from './ScaleBarWidget.js';

function createMockView(): IView {
  return { id: 'view-1', type: '2d' };
}

describe('ScaleBarWidget', () => {
  let container: HTMLElement;
  let widget: ScaleBarWidget;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    widget = new ScaleBarWidget({ id: 'scalebar-test' });
    widget.mount(container);
  });

  it('should render with correct DOM structure', () => {
    const root = container.querySelector('#scalebar-test');
    expect(root).not.toBeNull();
    expect(root!.classList.contains('mapgpu-widget-scalebar')).toBe(true);

    const bar = root!.querySelector('.bar');
    expect(bar).not.toBeNull();

    const label = root!.querySelector('.label');
    expect(label).not.toBeNull();
  });

  it('should default to metric unit', () => {
    expect(widget.unit).toBe('metric');
  });

  describe('findNiceNumber', () => {
    it('should return 1 for very small values', () => {
      expect(ScaleBarWidget.findNiceNumber(0.5)).toBe(1);
    });

    it('should return the largest nice number <= maxValue', () => {
      expect(ScaleBarWidget.findNiceNumber(7)).toBe(5);
      expect(ScaleBarWidget.findNiceNumber(10)).toBe(10);
      expect(ScaleBarWidget.findNiceNumber(15)).toBe(10);
      expect(ScaleBarWidget.findNiceNumber(250)).toBe(200);
      expect(ScaleBarWidget.findNiceNumber(999)).toBe(500);
      expect(ScaleBarWidget.findNiceNumber(1000)).toBe(1000);
      expect(ScaleBarWidget.findNiceNumber(3000)).toBe(2000);
    });

    it('should return 1_000_000 for very large values', () => {
      expect(ScaleBarWidget.findNiceNumber(5_000_000)).toBe(1_000_000);
    });
  });

  describe('metric display', () => {
    it('should show meters for small scales', () => {
      // 1 meter per pixel, 150px max width => max 150m => nice number 100
      widget.setGroundResolution(1);

      const label = container.querySelector('.label');
      expect(label!.textContent).toBe('100 m');
    });

    it('should show kilometers for large scales', () => {
      // 100 meters per pixel, 150px => 15000m => nice 10000 => 10 km
      widget.setGroundResolution(100);

      const label = container.querySelector('.label');
      expect(label!.textContent).toBe('10 km');
    });

    it('should update bar width proportionally', () => {
      widget.setGroundResolution(1);
      // nice number = 100, bar width = 100/1 = 100px
      const bar = container.querySelector('.bar') as HTMLElement;
      expect(bar.style.width).toBe('100px');
    });
  });

  describe('imperial display', () => {
    it('should show feet for small scales', () => {
      widget.unit = 'imperial';
      // 1 meter per pixel, 150px => 150m => ~492ft => nice number <= 492 is 200
      widget.setGroundResolution(1);

      const label = container.querySelector('.label');
      expect(label!.textContent).toBe('200 ft');
    });

    it('should show miles for large scales', () => {
      widget.unit = 'imperial';
      // 1000 meters per pixel, 150px => 150000m => ~492125ft => nice number ~200000ft => but NICE_NUMBERS max 1M
      // 150000m * 3.28084 = 492126 ft => nice = 200000
      // 200000 / 5280 = 37.878... miles
      widget.setGroundResolution(1000);

      const label = container.querySelector('.label');
      const text = label!.textContent!;
      expect(text).toContain('mi');
    });
  });

  describe('unit switching', () => {
    it('should update display when unit changes', () => {
      widget.setGroundResolution(1);
      const label = container.querySelector('.label');
      expect(label!.textContent).toBe('100 m');

      widget.unit = 'imperial';
      expect(label!.textContent).toContain('ft');
    });
  });

  describe('bind', () => {
    it('should accept view binding and update display', () => {
      const view = createMockView();
      expect(() => widget.bind(view)).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should clean up DOM', () => {
      widget.destroy();
      expect(container.querySelector('#scalebar-test')).toBeNull();
    });
  });
});
