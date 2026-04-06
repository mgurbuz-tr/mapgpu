import { describe, it, expect } from 'vitest';
import { parseCzml } from './CzmlParser.js';

const SIMPLE_CZML = [
  {
    id: 'document',
    name: 'Test CZML',
    version: '1.0',
    clock: {
      interval: '2024-01-01T00:00:00Z/2024-01-02T00:00:00Z',
      currentTime: '2024-01-01T00:00:00Z',
      multiplier: 60,
      range: 'LOOP_STOP',
      step: 'SYSTEM_CLOCK_MULTIPLIER',
    },
  },
  {
    id: 'vehicle1',
    name: 'Vehicle 1',
    description: 'A test vehicle',
    availability: '2024-01-01T00:00:00Z/2024-01-02T00:00:00Z',
    position: {
      epoch: '2024-01-01T00:00:00Z',
      cartographicDegrees: [0, 29.0, 41.0, 100, 3600, 30.0, 42.0, 200],
    },
    billboard: { image: 'icon.png', scale: 1.5 },
  },
  {
    id: 'route1',
    name: 'Route 1',
    polyline: {
      positions: {
        cartographicDegrees: [29.0, 41.0, 0, 30.0, 42.0, 0, 31.0, 41.5, 0],
      },
      width: 3,
      material: { solidColor: { color: { rgba: [255, 0, 0, 255] } } },
    },
  },
  {
    id: 'area1',
    name: 'Area 1',
    polygon: {
      positions: {
        cartographicDegrees: [29, 41, 0, 30, 41, 0, 30, 42, 0, 29, 42, 0],
      },
    },
  },
  {
    id: 'static1',
    name: 'Static Point',
    position: { cartographicDegrees: [28.0, 40.0, 50] },
  },
];

describe('parseCzml', () => {
  it('parses document metadata', () => {
    const result = parseCzml(SIMPLE_CZML);
    expect(result.name).toBe('Test CZML');
  });

  it('parses clock', () => {
    const result = parseCzml(SIMPLE_CZML);
    expect(result.clock).toBeDefined();
    expect(result.clock!.multiplier).toBe(60);
    expect(result.clock!.range).toBe('LOOP_STOP');
  });

  it('parses 4 entity features', () => {
    const result = parseCzml(SIMPLE_CZML);
    expect(result.features).toHaveLength(4);
  });

  it('parses sampled position entity', () => {
    const result = parseCzml(SIMPLE_CZML);
    const vehicle = result.features[0]!;
    expect(vehicle.id).toBe('vehicle1');
    expect(vehicle.geometry.type).toBe('Point');
    expect(vehicle.availability).toBe('2024-01-01T00:00:00Z/2024-01-02T00:00:00Z');
    expect(vehicle.sampledPositions).toHaveLength(1);
    expect(vehicle.sampledPositions![0]!.epoch).toBe('2024-01-01T00:00:00Z');
    expect(vehicle.sampledPositions![0]!.cartographicDegrees).toHaveLength(8);
  });

  it('parses polyline entity', () => {
    const result = parseCzml(SIMPLE_CZML);
    const route = result.features[1]!;
    expect(route.geometry.type).toBe('LineString');
    const coords = route.geometry.coordinates as number[][];
    expect(coords).toHaveLength(3);
    expect(coords[0]).toEqual([29, 41, 0]);
  });

  it('parses polygon entity', () => {
    const result = parseCzml(SIMPLE_CZML);
    const area = result.features[2]!;
    expect(area.geometry.type).toBe('Polygon');
    const ring = (area.geometry.coordinates as number[][][])[0]!;
    expect(ring).toHaveLength(5); // 4 + closing
  });

  it('parses static position', () => {
    const result = parseCzml(SIMPLE_CZML);
    const pt = result.features[3]!;
    expect(pt.geometry.type).toBe('Point');
    expect(pt.geometry.coordinates).toEqual([28, 40, 50]);
  });

  it('throws on empty array', () => {
    expect(() => parseCzml([])).toThrow();
  });
});
