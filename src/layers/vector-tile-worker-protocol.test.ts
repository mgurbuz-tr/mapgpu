import { describe, expect, it } from 'vitest';
import type { VectorTileBinaryPayload } from '../core/index.js';
import { collectVectorTilePayloadTransferables } from './vector-tile-worker-protocol.js';

describe('vector-tile-worker-protocol', () => {
  it('collects transferables from binary payload groups', () => {
    const payload: VectorTileBinaryPayload = {
      pointGroups: [
        {
          key: 'p',
          symbol: {
            type: 'simple-marker',
            color: [255, 0, 0, 255],
            size: 8,
            outlineColor: [255, 255, 255, 255],
            outlineWidth: 1,
          },
          vertices: new Float32Array([0, 0, 0]),
          count: 1,
        },
      ],
      lineGroups: [
        {
          key: 'l',
          symbol: {
            type: 'simple-line',
            color: [0, 0, 0, 255],
            width: 1,
            style: 'solid',
          },
          vertices: new Float32Array([0, 0, 0]),
          indices: new Uint32Array([0]),
          indexCount: 1,
        },
      ],
      polygonGroups: [],
      modelGroups: [
        {
          key: 'm',
          symbol: {
            type: 'model',
            modelId: 'tower',
          },
          instances: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0]),
          count: 1,
        },
      ],
      extrusionGroups: [
        {
          key: 'e',
          symbol: {
            type: 'fill-extrusion',
            color: [120, 120, 120, 255],
            heightField: 'height',
          },
          vertices: new Float32Array([0, 0, 0, 0, 0, 1]),
          indices: new Uint32Array([0]),
          indexCount: 1,
        },
      ],
    };

    const transferables = collectVectorTilePayloadTransferables(payload);
    expect(transferables.length).toBe(6);
  });
});
