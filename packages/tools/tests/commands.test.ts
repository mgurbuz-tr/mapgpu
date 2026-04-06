import { describe, it, expect, beforeEach } from 'vitest';
import {
  AddVertexCommand,
  RemoveVertexCommand,
  CreateFeatureCommand,
  MoveVertexCommand,
  DeleteVertexCommand,
  MoveFeatureCommand,
} from '../src/commands/index.js';
import type { Feature } from '@mapgpu/core';

describe('AddVertexCommand', () => {
  it('appends vertex and undoes', () => {
    const vertices: [number, number][] = [[0, 0]];
    const cmd = new AddVertexCommand(vertices, [1, 1]);

    cmd.execute();
    expect(vertices).toEqual([[0, 0], [1, 1]]);

    cmd.undo();
    expect(vertices).toEqual([[0, 0]]);
  });

  it('inserts at specific index', () => {
    const vertices: [number, number][] = [[0, 0], [2, 2]];
    const cmd = new AddVertexCommand(vertices, [1, 1], 1);

    cmd.execute();
    expect(vertices).toEqual([[0, 0], [1, 1], [2, 2]]);

    cmd.undo();
    expect(vertices).toEqual([[0, 0], [2, 2]]);
  });
});

describe('RemoveVertexCommand', () => {
  it('removes vertex and restores on undo', () => {
    const vertices: [number, number][] = [[0, 0], [1, 1], [2, 2]];
    const cmd = new RemoveVertexCommand(vertices, 1);

    cmd.execute();
    expect(vertices).toEqual([[0, 0], [2, 2]]);

    cmd.undo();
    expect(vertices).toEqual([[0, 0], [1, 1], [2, 2]]);
  });
});

describe('CreateFeatureCommand', () => {
  let features: Feature[];
  let layer: { add: (f: Feature) => void; remove: (id: string | number) => boolean };

  beforeEach(() => {
    features = [];
    layer = {
      add: (f) => features.push(f),
      remove: (id) => {
        const idx = features.findIndex(f => f.id === id);
        if (idx >= 0) { features.splice(idx, 1); return true; }
        return false;
      },
    };
  });

  it('adds feature and removes on undo', () => {
    const feature: Feature = {
      id: 'test-1',
      geometry: { type: 'Point', coordinates: [29, 41] },
      attributes: {},
    };
    const cmd = new CreateFeatureCommand(layer, feature);

    cmd.execute();
    expect(features).toHaveLength(1);

    cmd.undo();
    expect(features).toHaveLength(0);
  });
});

describe('MoveVertexCommand', () => {
  it('moves vertex and restores on undo', () => {
    const vertices: [number, number][] = [[0, 0], [1, 1]];
    const cmd = new MoveVertexCommand(vertices, 0, [5, 5]);

    cmd.execute();
    expect(vertices[0]).toEqual([5, 5]);

    cmd.undo();
    expect(vertices[0]).toEqual([0, 0]);
  });
});

describe('DeleteVertexCommand', () => {
  it('deletes vertex and restores on undo', () => {
    const vertices: [number, number][] = [[0, 0], [1, 1], [2, 2]];
    const cmd = new DeleteVertexCommand(vertices, 1);

    cmd.execute();
    expect(vertices).toEqual([[0, 0], [2, 2]]);

    cmd.undo();
    expect(vertices).toEqual([[0, 0], [1, 1], [2, 2]]);
  });
});

describe('MoveFeatureCommand', () => {
  let features: Feature[];
  let layer: { add: (f: Feature) => void; remove: (id: string | number) => boolean };

  beforeEach(() => {
    features = [];
    layer = {
      add: (f) => {
        const idx = features.findIndex(x => x.id === f.id);
        if (idx >= 0) features[idx] = f;
        else features.push(f);
      },
      remove: (id) => {
        const idx = features.findIndex(f => f.id === id);
        if (idx >= 0) { features.splice(idx, 1); return true; }
        return false;
      },
    };
  });

  it('offsets point coordinates and restores on undo', () => {
    const feature: Feature = {
      id: 'p1',
      geometry: { type: 'Point', coordinates: [29.0, 41.0] },
      attributes: {},
    };
    features.push(feature);

    const cmd = new MoveFeatureCommand(layer, feature, 1.0, 0.5);

    cmd.execute();
    expect(feature.geometry.coordinates[0]).toBeCloseTo(30.0);
    expect(feature.geometry.coordinates[1]).toBeCloseTo(41.5);

    cmd.undo();
    expect(feature.geometry.coordinates[0]).toBeCloseTo(29.0);
    expect(feature.geometry.coordinates[1]).toBeCloseTo(41.0);
  });
});
