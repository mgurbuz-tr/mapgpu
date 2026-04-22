import { describe, it, expect, beforeEach } from 'vitest';
import type { IView } from '../core/index.js';
import { CoordinatesWidget } from './CoordinatesWidget.js';

function createMockView(): IView {
  return { id: 'view-1', type: '2d' };
}

describe('CoordinatesWidget', () => {
  let container: HTMLElement;
  let widget: CoordinatesWidget;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    widget = new CoordinatesWidget({ id: 'coords-test' });
    widget.mount(container);
  });

  it('should render with correct DOM structure', () => {
    const root = container.querySelector('#coords-test');
    expect(root).not.toBeNull();
    expect(root!.classList.contains('mapgpu-widget-coordinates')).toBe(true);

    const span = root!.querySelector('span');
    expect(span).not.toBeNull();
  });

  it('should default to DD format', () => {
    expect(widget.format).toBe('DD');
  });

  describe('setCoordinates', () => {
    it('should update displayed coordinates', () => {
      widget.setCoordinates(28.9784, 41.0082);

      const span = container.querySelector('#coords-test span');
      expect(span!.textContent).toBe('28.9784° E, 41.0082° N');
    });

    it('should handle negative coordinates (west/south)', () => {
      widget.setCoordinates(-73.9857, -33.8688);

      const span = container.querySelector('#coords-test span');
      expect(span!.textContent).toBe('73.9857° W, 33.8688° S');
    });
  });

  describe('formatDD', () => {
    it('should format positive coordinates', () => {
      expect(CoordinatesWidget.formatDD(28.9784, 41.0082)).toBe(
        '28.9784° E, 41.0082° N',
      );
    });

    it('should format negative coordinates', () => {
      expect(CoordinatesWidget.formatDD(-73.9857, -33.8688)).toBe(
        '73.9857° W, 33.8688° S',
      );
    });

    it('should format zero coordinates', () => {
      const result = CoordinatesWidget.formatDD(0, 0);
      expect(result).toBe('0.0000° E, 0.0000° N');
    });
  });

  describe('formatDMS', () => {
    it('should convert decimal degrees to DMS', () => {
      const result = CoordinatesWidget.formatDMS(28.9784, 41.0082);

      // 28.9784 => 28° 58' 42.24"
      expect(result).toContain('28°');
      expect(result).toContain('58\'');
      expect(result).toContain('E');

      // 41.0082 => 41° 0' 29.52"
      expect(result).toContain('41°');
      expect(result).toContain('N');
    });

    it('should handle negative coordinates', () => {
      const result = CoordinatesWidget.formatDMS(-73.9857, -33.8688);
      expect(result).toContain('W');
      expect(result).toContain('S');
      // Should use absolute values for degrees
      expect(result).toContain('73°');
      expect(result).toContain('33°');
    });

    it('should handle whole degrees', () => {
      const result = CoordinatesWidget.formatDMS(30, 40);
      expect(result).toContain('30°');
      expect(result).toContain("0'");
      expect(result).toContain('0.00"');
    });
  });

  describe('formatMGRS', () => {
    it('should include UTM zone', () => {
      // Istanbul: lon=28.9784, zone = floor((28.9784+180)/6)+1 = floor(208.9784/6)+1 = 34+1 = 35
      const result = CoordinatesWidget.formatMGRS(28.9784, 41.0082);
      expect(result).toContain('35');
      expect(result).toContain('N');
    });

    it('should handle negative longitude', () => {
      // New York: lon=-73.9857, zone = floor((-73.9857+180)/6)+1 = floor(106.0143/6)+1 = 17+1 = 18
      const result = CoordinatesWidget.formatMGRS(-73.9857, 40.7484);
      expect(result).toContain('18');
    });
  });

  describe('format switching', () => {
    it('should update display when format changes', () => {
      widget.setCoordinates(28.9784, 41.0082);
      const span = container.querySelector('#coords-test span');

      expect(span!.textContent).toContain('°');
      expect(span!.textContent).toContain('E');

      widget.format = 'DMS';
      expect(span!.textContent).toContain("'");
      expect(span!.textContent).toContain('"');
    });
  });

  describe('listenTo', () => {
    it('should update coordinates on mouse move', () => {
      const target = document.createElement('div');
      // getBoundingClientRect returns 0,0 in happy-dom
      widget.screenToMap = (x: number, y: number) => [x * 0.1, y * 0.1];
      widget.listenTo(target);

      const event = new MouseEvent('mousemove', {
        clientX: 100,
        clientY: 50,
      });
      target.dispatchEvent(event);

      // With screenToMap: (100-0)*0.1=10, (50-0)*0.1=5
      expect(widget.longitude).toBeCloseTo(10);
      expect(widget.latitude).toBeCloseTo(5);
    });

    it('should use pixel coordinates if no screenToMap provided', () => {
      const target = document.createElement('div');
      widget.listenTo(target);

      const event = new MouseEvent('mousemove', {
        clientX: 200,
        clientY: 100,
      });
      target.dispatchEvent(event);

      expect(widget.longitude).toBe(200);
      expect(widget.latitude).toBe(100);
    });
  });

  describe('bind', () => {
    it('should accept view binding', () => {
      const view = createMockView();
      expect(() => widget.bind(view)).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should clean up event listeners and DOM', () => {
      const target = document.createElement('div');
      widget.listenTo(target);
      widget.destroy();

      expect(container.querySelector('#coords-test')).toBeNull();
    });
  });
});
