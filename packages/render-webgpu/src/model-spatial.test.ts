import { describe, expect, it } from 'vitest';
import { lonLatToMercator } from '@mapgpu/core';
import {
  buildModelMetadata,
  computeCanonicalLocalBounds,
  computeWorldMatrices,
  resolveCanonicalModelBounds,
} from './model-spatial.js';

describe('model-spatial', () => {
  it('computes hierarchy-aware canonical bounds', () => {
    const nodes = [
      {
        translation: [10, 0, 0] as [number, number, number],
        rotation: [0, 0, 0, 1] as [number, number, number, number],
        scale: [1, 1, 1] as [number, number, number],
        children: [1],
        parentIndex: null,
      },
      {
        translation: [0, 5, 0] as [number, number, number],
        rotation: [0, 0, 0, 1] as [number, number, number, number],
        scale: [1, 1, 1] as [number, number, number],
        children: [],
        parentIndex: 0,
      },
    ];

    const transforms = computeWorldMatrices(
      nodes,
      nodes.map((node) => node.translation),
      nodes.map((node) => node.rotation),
      nodes.map((node) => node.scale),
    );
    const bounds = computeCanonicalLocalBounds([{
      bounds: {
        min: [0, 0, 0],
        max: [2, 1, 1],
      },
      nodeIndex: 1,
    }], transforms.worldMatrices);

    expect(bounds.min).toEqual([10, -1, 5]);
    expect(bounds.max).toEqual([12, 0, 6]);
  });

  it('resolves canonical bounds into world-space corners and outlines', () => {
    const metadata = buildModelMetadata(
      {
        min: [-1, -2, 0],
        max: [1, 2, 4],
      },
      {
        min: [-1, -2, 0],
        max: [1, 2, 4],
      },
      false,
      false,
    );

    const resolved = resolveCanonicalModelBounds(metadata, {
      modelId: 'heli',
      coordinates: [29, 41, 100],
      scale: 2,
      anchorZ: 3,
    });

    expect(resolved.cornersLonLatAlt).toHaveLength(8);
    expect(resolved.footprint).toHaveLength(5);
    expect(resolved.topOutline).toHaveLength(5);
    expect(resolved.aabbLonLatAlt.min[2]).toBe(103);
    expect(resolved.aabbLonLatAlt.max[2]).toBe(111);

    const [originX, originY] = lonLatToMercator(29, 41);
    const [cornerLon, cornerLat] = resolved.cornersLonLatAlt[0]!;
    const [cornerX, cornerY] = lonLatToMercator(cornerLon, cornerLat);
    expect(cornerX).toBeCloseTo(originX - 2, 6);
    expect(cornerY).toBeCloseTo(originY - 4, 6);
  });
});
