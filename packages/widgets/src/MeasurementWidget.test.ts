import { describe, it, expect, beforeEach } from 'vitest';
import {
  MeasurementWidget,
  haversineDistance,
  sphericalPolygonArea,
} from './MeasurementWidget.js';

describe('haversineDistance', () => {
  it('should return 0 for same point', () => {
    expect(haversineDistance(0, 0, 0, 0)).toBe(0);
  });

  it('should calculate correct distance between Istanbul and Ankara', () => {
    // Istanbul: 28.97, 41.01 → Ankara: 32.86, 39.92
    // Approximately 351 km
    const dist = haversineDistance(28.97, 41.01, 32.86, 39.92);
    expect(dist).toBeGreaterThan(340_000);
    expect(dist).toBeLessThan(360_000);
  });

  it('should calculate distance across antimeridian', () => {
    const dist = haversineDistance(179, 0, -179, 0);
    // ~222 km (about 2 degrees at equator)
    expect(dist).toBeGreaterThan(200_000);
    expect(dist).toBeLessThan(250_000);
  });
});

describe('sphericalPolygonArea', () => {
  it('should return 0 for less than 3 points', () => {
    expect(sphericalPolygonArea([[0, 0], [1, 1]])).toBe(0);
  });

  it('should calculate area for a small square near equator', () => {
    // 1 degree x 1 degree square at equator, approx 12,309 km²
    const area = sphericalPolygonArea([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]);
    expect(area).toBeGreaterThan(10_000_000_000); // > 10,000 km² in m²
    expect(area).toBeLessThan(15_000_000_000);    // < 15,000 km² in m²
  });
});

describe('MeasurementWidget', () => {
  let container: HTMLElement;
  let widget: MeasurementWidget;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    widget = new MeasurementWidget({ id: 'measure-test' });
    widget.mount(container);
  });

  it('should render with correct DOM structure', () => {
    const root = container.querySelector('#measure-test');
    expect(root).not.toBeNull();
    expect(root!.classList.contains('mapgpu-widget-measurement')).toBe(true);
  });

  it('should default to none mode', () => {
    expect(widget.mode).toBe('none');
  });

  it('should switch to distance mode', () => {
    widget.setMode('distance');
    expect(widget.mode).toBe('distance');

    const modeLabel = container.querySelector('.mode-label');
    expect(modeLabel!.textContent).toContain('distance');
  });

  it('should switch to area mode', () => {
    widget.setMode('area');
    expect(widget.mode).toBe('area');
  });

  it('should add points and calculate distance', () => {
    widget.setMode('distance');
    widget.addPoint(0, 0);
    widget.addPoint(1, 0);

    const result = widget.getResult();
    expect(result.distance).toBeDefined();
    expect(result.distance).toBeGreaterThan(0);
    expect(result.unit).toBe('km');
  });

  it('should return distance in meters when < 1000m', () => {
    widget.setMode('distance');
    // Two very close points
    widget.addPoint(0, 0);
    widget.addPoint(0.001, 0);

    const result = widget.getResult();
    expect(result.distance).toBeDefined();
    expect(result.unit).toBe('m');
  });

  it('should convert distance to imperial (ft)', () => {
    widget.unit = 'imperial';
    widget.setMode('distance');
    widget.addPoint(0, 0);
    widget.addPoint(0.001, 0);

    const result = widget.getResult();
    expect(result.distance).toBeDefined();
    expect(result.unit).toBe('ft');
  });

  it('should convert distance to imperial (mi)', () => {
    widget.unit = 'imperial';
    widget.setMode('distance');
    widget.addPoint(0, 0);
    widget.addPoint(1, 0);

    const result = widget.getResult();
    expect(result.distance).toBeDefined();
    expect(result.unit).toBe('mi');
  });

  it('should calculate area for polygon', () => {
    widget.setMode('area');
    widget.addPoint(0, 0);
    widget.addPoint(1, 0);
    widget.addPoint(1, 1);
    widget.addPoint(0, 1);

    const result = widget.getResult();
    expect(result.area).toBeDefined();
    expect(result.area).toBeGreaterThan(0);
  });

  it('should clear points and results', () => {
    widget.setMode('distance');
    widget.addPoint(0, 0);
    widget.addPoint(1, 0);
    widget.clear();

    expect(widget.points).toHaveLength(0);
    const result = widget.getResult();
    expect(result.distance).toBe(0);
  });

  it('should clear points when switching modes', () => {
    widget.setMode('distance');
    widget.addPoint(0, 0);
    widget.addPoint(1, 0);

    widget.setMode('area');
    expect(widget.points).toHaveLength(0);
  });

  it('should update display when mode button is clicked', () => {
    const distBtn = container.querySelector('.mode-btn') as HTMLButtonElement;
    distBtn.click();
    expect(widget.mode).toBe('distance');
  });

  it('should return empty result for none mode', () => {
    const result = widget.getResult();
    expect(result.distance).toBeUndefined();
    expect(result.area).toBeUndefined();
    expect(result.unit).toBe('');
  });

  it('should clean up on destroy', () => {
    widget.destroy();
    expect(container.querySelector('#measure-test')).toBeNull();
  });
});
