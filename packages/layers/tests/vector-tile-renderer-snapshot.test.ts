import { describe, expect, it } from 'vitest';
import {
  CallbackRenderer,
  ClassBreaksRenderer,
  SimpleRenderer,
  UniqueValueRenderer,
  type Feature,
} from '@mapgpu/core';
import { createSerializableRendererSnapshot } from '../src/vector-tile-renderer-snapshot.js';

describe('createSerializableRendererSnapshot', () => {
  it('serializes simple renderer snapshots', () => {
    const renderer = new SimpleRenderer({
      type: 'simple-marker',
      color: [255, 0, 0, 255],
      size: 10,
      outlineColor: [255, 255, 255, 255],
      outlineWidth: 1,
    });

    const snapshot = createSerializableRendererSnapshot(renderer);

    expect(snapshot).not.toBeNull();
    expect(snapshot?.type).toBe('simple');
    if (snapshot?.type === 'simple') {
      expect(snapshot.symbol.type).toBe('simple-marker');
      expect(snapshot.symbol.color).toEqual([255, 0, 0, 255]);
    }
  });

  it('serializes unique-value renderer snapshots', () => {
    const renderer = new UniqueValueRenderer({
      field: 'kind',
      defaultSymbol: {
        type: 'simple-fill',
        color: [100, 100, 100, 255],
        outlineColor: [0, 0, 0, 255],
        outlineWidth: 1,
      },
      uniqueValues: [
        {
          value: 'building',
          symbol: {
            type: 'simple-fill',
            color: [0, 120, 255, 255],
            outlineColor: [0, 0, 0, 255],
            outlineWidth: 1,
          },
        },
      ],
    });

    const snapshot = createSerializableRendererSnapshot(renderer);

    expect(snapshot).not.toBeNull();
    expect(snapshot?.type).toBe('unique-value');
    if (snapshot?.type === 'unique-value') {
      expect(snapshot.field).toBe('kind');
      expect(snapshot.uniqueValues).toHaveLength(1);
      expect(snapshot.uniqueValues[0]?.value).toBe('building');
    }
  });

  it('serializes class-breaks renderer snapshots', () => {
    const renderer = new ClassBreaksRenderer({
      field: 'height',
      defaultSymbol: {
        type: 'simple-fill',
        color: [180, 180, 180, 255],
        outlineColor: [0, 0, 0, 255],
        outlineWidth: 1,
      },
      breaks: [
        {
          min: 0,
          max: 20,
          symbol: {
            type: 'simple-fill',
            color: [200, 230, 255, 255],
            outlineColor: [0, 0, 0, 255],
            outlineWidth: 1,
          },
        },
      ],
    });

    const snapshot = createSerializableRendererSnapshot(renderer);

    expect(snapshot).not.toBeNull();
    expect(snapshot?.type).toBe('class-breaks');
    if (snapshot?.type === 'class-breaks') {
      expect(snapshot.field).toBe('height');
      expect(snapshot.breaks).toHaveLength(1);
      expect(snapshot.breaks[0]?.min).toBe(0);
      expect(snapshot.breaks[0]?.max).toBe(20);
    }
  });

  it('returns null for callback renderers (worker fallback case)', () => {
    const renderer = new CallbackRenderer((feature: Feature) => {
      const kind = feature.attributes.kind;
      if (kind === 'road') {
        return {
          type: 'simple-line',
          color: [255, 100, 0, 255],
          width: 2,
          style: 'solid',
        };
      }

      return {
        type: 'simple-fill',
        color: [0, 120, 255, 255],
        outlineColor: [0, 0, 0, 255],
        outlineWidth: 1,
      };
    });

    const snapshot = createSerializableRendererSnapshot(renderer);
    expect(snapshot).toBeNull();
  });
});
