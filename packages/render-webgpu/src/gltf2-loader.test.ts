import { describe, expect, it } from 'vitest';

import { parseGltf2 } from './gltf2-loader.js';

function buildAnimatedGltfFixture(): { json: unknown; buffers: ArrayBuffer[] } {
  const chunks: Uint8Array[] = [];
  const bufferViews: Array<{ buffer: number; byteOffset: number; byteLength: number }> = [];
  const accessors: Array<Record<string, unknown>> = [];
  let offset = 0;

  const append = (
    typed: Float32Array | Uint16Array,
    type: string,
    componentType: number,
    count: number,
  ): number => {
    const raw = new Uint8Array(typed.buffer.slice(typed.byteOffset, typed.byteOffset + typed.byteLength));
    chunks.push(raw);
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: raw.byteLength });
    const accessorIndex = accessors.length;
    accessors.push({
      bufferView: bufferViews.length - 1,
      componentType,
      count,
      type,
    });
    offset += raw.byteLength;
    return accessorIndex;
  };

  const positionAccessor = append(new Float32Array([
    0, 0, 0,
    1, 0, 0,
    0, 1, 0,
  ]), 'VEC3', 5126, 3);
  const normalAccessor = append(new Float32Array([
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
  ]), 'VEC3', 5126, 3);
  const uvAccessor = append(new Float32Array([
    0, 0,
    1, 0,
    0, 1,
  ]), 'VEC2', 5126, 3);
  const indexAccessor = append(new Uint16Array([0, 1, 2]), 'SCALAR', 5123, 3);

  const animInputAccessor = append(new Float32Array([0, 1]), 'SCALAR', 5126, 2);
  const animTranslationAccessor = append(new Float32Array([
    1, 2, 3,
    4, 5, 6,
  ]), 'VEC3', 5126, 2);
  const animRotationAccessor = append(new Float32Array([
    0, 0, 0, 1,
    0, 0, 1, 0,
  ]), 'VEC4', 5126, 2);
  const animScaleAccessor = append(new Float32Array([
    1, 1, 1,
    2, 2, 2,
  ]), 'VEC3', 5126, 2);

  const merged = new Uint8Array(offset);
  let writeOffset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, writeOffset);
    writeOffset += chunk.byteLength;
  }

  return {
    json: {
      asset: { version: '2.0' },
      buffers: [{ byteLength: merged.byteLength }],
      bufferViews,
      accessors,
      meshes: [{
        primitives: [{
          attributes: {
            POSITION: positionAccessor,
            NORMAL: normalAccessor,
            TEXCOORD_0: uvAccessor,
          },
          indices: indexAccessor,
        }],
      }],
      nodes: [{
        mesh: 0,
        name: 'animated-node',
        translation: [1, 2, 3],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1],
      }],
      scenes: [{ nodes: [0] }],
      scene: 0,
      animations: [{
        name: 'spin',
        samplers: [
          { input: animInputAccessor, output: animTranslationAccessor, interpolation: 'LINEAR' },
          { input: animInputAccessor, output: animRotationAccessor, interpolation: 'LINEAR' },
          { input: animInputAccessor, output: animScaleAccessor, interpolation: 'STEP' },
        ],
        channels: [
          { sampler: 0, target: { node: 0, path: 'translation' } },
          { sampler: 1, target: { node: 0, path: 'rotation' } },
          { sampler: 2, target: { node: 0, path: 'scale' } },
        ],
      }],
    },
    buffers: [merged.buffer as ArrayBuffer],
  };
}

function buildHierarchicalGltfFixture(): { json: unknown; buffers: ArrayBuffer[] } {
  const chunks: Uint8Array[] = [];
  const bufferViews: Array<{ buffer: number; byteOffset: number; byteLength: number }> = [];
  const accessors: Array<Record<string, unknown>> = [];
  let offset = 0;

  const append = (
    typed: Float32Array | Uint16Array,
    type: string,
    componentType: number,
    count: number,
  ): number => {
    const raw = new Uint8Array(typed.buffer.slice(typed.byteOffset, typed.byteOffset + typed.byteLength));
    chunks.push(raw);
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: raw.byteLength });
    const accessorIndex = accessors.length;
    accessors.push({
      bufferView: bufferViews.length - 1,
      componentType,
      count,
      type,
    });
    offset += raw.byteLength;
    return accessorIndex;
  };

  const positionAccessor = append(new Float32Array([
    0, 0, 0,
    1, 0, 0,
    0, 1, 0,
  ]), 'VEC3', 5126, 3);
  const normalAccessor = append(new Float32Array([
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
  ]), 'VEC3', 5126, 3);
  const uvAccessor = append(new Float32Array([
    0, 0,
    1, 0,
    0, 1,
  ]), 'VEC2', 5126, 3);
  const indexAccessor = append(new Uint16Array([0, 1, 2]), 'SCALAR', 5123, 3);

  const merged = new Uint8Array(offset);
  let writeOffset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, writeOffset);
    writeOffset += chunk.byteLength;
  }

  return {
    json: {
      asset: { version: '2.0' },
      buffers: [{ byteLength: merged.byteLength }],
      bufferViews,
      accessors,
      meshes: [{
        primitives: [{
          attributes: {
            POSITION: positionAccessor,
            NORMAL: normalAccessor,
            TEXCOORD_0: uvAccessor,
          },
          indices: indexAccessor,
        }],
      }],
      nodes: [
        {
          name: 'parent',
          translation: [10, 0, 0],
          children: [1],
        },
        {
          name: 'child-mesh',
          mesh: 0,
          translation: [0, 5, 0],
        },
      ],
      scenes: [{ nodes: [0] }],
      scene: 0,
    },
    buffers: [merged.buffer as ArrayBuffer],
  };
}

describe('gltf2-loader', () => {
  it('preserves node transforms and animation clips for runtime playback', () => {
    const fixture = buildAnimatedGltfFixture();
    const model = parseGltf2(fixture.json, fixture.buffers);

    expect(model.primitives).toHaveLength(1);
    expect(model.primitives[0]!.nodeIndex).toBe(0);

    expect(model.nodes).toHaveLength(1);
    expect(model.nodes[0]!.name).toBe('animated-node');
    expect(model.nodes[0]!.translation).toEqual([1, 2, 3]);

    expect(model.animations).toHaveLength(1);
    expect(model.animations[0]!.name).toBe('spin');
    expect(model.animations[0]!.duration).toBe(1);
    expect(model.animations[0]!.channels).toHaveLength(3);
    expect(model.animations[0]!.channels[1]!.path).toBe('rotation');
    expect(Array.from(model.animations[0]!.channels[0]!.input)).toEqual([0, 1]);

    expect(model.boundingBox.min).toEqual([1, 2, 3]);
    expect(model.boundingBox.max).toEqual([2, 3, 3]);
  });

  it('tracks parent-child relationships and applies parent transforms to bounds', () => {
    const fixture = buildHierarchicalGltfFixture();
    const model = parseGltf2(fixture.json, fixture.buffers);

    expect(model.nodes).toHaveLength(2);
    expect(model.nodes[0]!.parentIndex).toBeNull();
    expect(model.nodes[1]!.parentIndex).toBe(0);
    expect(model.primitives[0]!.nodeIndex).toBe(1);
    expect(model.boundingBox.min).toEqual([10, 5, 0]);
    expect(model.boundingBox.max).toEqual([11, 6, 0]);
  });
});
