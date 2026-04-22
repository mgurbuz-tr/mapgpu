import { describe, it, expect } from 'vitest';
import { BuildingObstacleProvider } from './BuildingObstacleProvider.js';
import type { Feature } from '../core/index.js';
import type { IElevationProvider } from './IElevationProvider.js';

function makeBuilding(
  id: string | number,
  coords: number[][][],
  height: number,
  minHeight = 0,
): Feature {
  return {
    id,
    geometry: {
      type: 'Polygon',
      coordinates: coords,
    },
    attributes: {
      render_height: height,
      render_min_height: minHeight,
    },
  };
}

// Simple square building around (29.0, 41.0)
const SQUARE_BUILDING = makeBuilding('bldg-1', [
  [
    [28.999, 40.999],
    [29.001, 40.999],
    [29.001, 41.001],
    [28.999, 41.001],
    [28.999, 40.999],
  ],
], 50);

describe('BuildingObstacleProvider', () => {
  it('should return building height when point is inside footprint', () => {
    const provider = new BuildingObstacleProvider({
      getFeatures: () => [SQUARE_BUILDING],
      heightField: 'render_height',
    });

    const elev = provider.sampleElevation(29.0, 41.0);
    expect(elev).toBe(50);
  });

  it('should return null when point is outside all buildings', () => {
    const provider = new BuildingObstacleProvider({
      getFeatures: () => [SQUARE_BUILDING],
      heightField: 'render_height',
    });

    const elev = provider.sampleElevation(30.0, 42.0);
    expect(elev).toBeNull();
  });

  it('should add base terrain elevation to building height', () => {
    const baseProvider: IElevationProvider = {
      sampleElevation: () => 100,
      sampleElevationBatch: (pts) => new Float64Array(pts.length / 2).fill(100),
    };

    const provider = new BuildingObstacleProvider({
      getFeatures: () => [SQUARE_BUILDING],
      heightField: 'render_height',
      baseProvider,
    });

    const elev = provider.sampleElevation(29.0, 41.0);
    expect(elev).toBe(150); // 100 terrain + 50 building
  });

  it('should subtract min height from height', () => {
    const building = makeBuilding('bldg-min', [
      [
        [28.999, 40.999],
        [29.001, 40.999],
        [29.001, 41.001],
        [28.999, 41.001],
        [28.999, 40.999],
      ],
    ], 50, 10);

    const provider = new BuildingObstacleProvider({
      getFeatures: () => [building],
      heightField: 'render_height',
      minHeightField: 'render_min_height',
    });

    const elev = provider.sampleElevation(29.0, 41.0);
    expect(elev).toBe(40); // 50 - 10
  });

  it('should skip non-polygon features', () => {
    const lineFeature: Feature = {
      id: 'line-1',
      geometry: { type: 'LineString', coordinates: [[29.0, 41.0], [29.1, 41.1]] },
      attributes: { render_height: 100 },
    };

    const provider = new BuildingObstacleProvider({
      getFeatures: () => [lineFeature],
      heightField: 'render_height',
    });

    expect(provider.sampleElevation(29.0, 41.0)).toBeNull();
  });

  it('should handle batch queries', () => {
    const provider = new BuildingObstacleProvider({
      getFeatures: () => [SQUARE_BUILDING],
      heightField: 'render_height',
    });

    const points = new Float64Array([
      29.0, 41.0,   // inside
      30.0, 42.0,   // outside
    ]);

    const result = provider.sampleElevationBatch(points);
    expect(result.length).toBe(2);
    expect(result[0]).toBe(50);
    expect(Number.isNaN(result[1])).toBe(true);
  });

  it('should handle empty feature list', () => {
    const provider = new BuildingObstacleProvider({
      getFeatures: () => [],
      heightField: 'render_height',
    });

    expect(provider.sampleElevation(29.0, 41.0)).toBeNull();
  });

  it('should handle MultiPolygon geometry', () => {
    const multiBuilding: Feature = {
      id: 'multi-bldg',
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [28.999, 40.999],
              [29.001, 40.999],
              [29.001, 41.001],
              [28.999, 41.001],
              [28.999, 40.999],
            ],
          ],
        ],
      },
      attributes: { render_height: 75 },
    };

    const provider = new BuildingObstacleProvider({
      getFeatures: () => [multiBuilding],
      heightField: 'render_height',
    });

    expect(provider.sampleElevation(29.0, 41.0)).toBe(75);
  });

  describe('line-segment intersection (batch)', () => {
    it('should detect building via segment intersection when samples miss', () => {
      // Narrow building between two sample points
      const narrowBuilding = makeBuilding('narrow', [
        [
          [29.0005, 40.999],
          [29.0006, 40.999],
          [29.0006, 41.001],
          [29.0005, 41.001],
          [29.0005, 40.999],
        ],
      ], 30);

      const provider = new BuildingObstacleProvider({
        getFeatures: () => [narrowBuilding],
        heightField: 'render_height',
      });

      // Two sample points that straddle the building but don't land inside it
      const points = new Float64Array([
        29.0003, 41.0, // before building
        29.0008, 41.0, // after building
      ]);

      const result = provider.sampleElevationBatch(points);
      // At least one sample should be marked with building height
      const hasDetection = result[0] === 30 || result[1] === 30;
      expect(hasDetection).toBe(true);
    });

    it('should detect building clipped at corner', () => {
      // Building that the LOS line clips at the corner
      const building = makeBuilding('corner', [
        [
          [29.0, 41.0],
          [29.002, 41.0],
          [29.002, 41.002],
          [29.0, 41.002],
          [29.0, 41.002],
        ],
      ], 40);

      const provider = new BuildingObstacleProvider({
        getFeatures: () => [building],
        heightField: 'render_height',
      });

      // LOS line clips the building's corner
      const points = new Float64Array([
        28.999, 40.999,  // before
        29.003, 41.003,  // after — line crosses building edge
      ]);

      const result = provider.sampleElevationBatch(points);
      const hasDetection = result[0] === 40 || result[1] === 40;
      expect(hasDetection).toBe(true);
    });

    it('should not false-positive when segment misses building', () => {
      const provider = new BuildingObstacleProvider({
        getFeatures: () => [SQUARE_BUILDING],
        heightField: 'render_height',
      });

      // Both points far from building
      const points = new Float64Array([
        30.0, 42.0,
        30.1, 42.1,
      ]);

      const result = provider.sampleElevationBatch(points);
      expect(Number.isNaN(result[0]!)).toBe(true);
      expect(Number.isNaN(result[1]!)).toBe(true);
    });
  });
});
