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

  it('reads Uint32 (componentType 5125) index buffers correctly', () => {
    // Minimal glTF fixture: one primitive with 4 vertices and uint32 indices.
    // Values fit in uint16 but componentType is 5125 to exercise the uint32 path.
    const positions = new Float32Array([
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
      1, 1, 0,
    ]);
    const normals = new Float32Array([
      0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
    ]);
    const uvs = new Float32Array([
      0, 0, 1, 0, 0, 1, 1, 1,
    ]);
    const indicesU32 = new Uint32Array([0, 1, 2, 2, 1, 3]);

    const chunks = [
      new Uint8Array(positions.buffer),
      new Uint8Array(normals.buffer),
      new Uint8Array(uvs.buffer),
      new Uint8Array(indicesU32.buffer),
    ];
    let off = 0;
    const bufferViews = chunks.map((c) => {
      const bv = { buffer: 0, byteOffset: off, byteLength: c.byteLength };
      off += c.byteLength;
      return bv;
    });
    const merged = new Uint8Array(off);
    let w = 0;
    for (const c of chunks) { merged.set(c, w); w += c.byteLength; }

    const json = {
      asset: { version: '2.0' },
      buffers: [{ byteLength: merged.byteLength }],
      bufferViews,
      accessors: [
        { bufferView: 0, componentType: 5126, count: 4, type: 'VEC3' },
        { bufferView: 1, componentType: 5126, count: 4, type: 'VEC3' },
        { bufferView: 2, componentType: 5126, count: 4, type: 'VEC2' },
        { bufferView: 3, componentType: 5125, count: 6, type: 'SCALAR' },
      ],
      meshes: [{
        primitives: [{
          attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
          indices: 3,
        }],
      }],
      nodes: [{ mesh: 0 }],
      scenes: [{ nodes: [0] }],
      scene: 0,
    };

    const model = parseGltf2(json, [merged.buffer as ArrayBuffer]);
    const mesh = model.primitives[0]!.mesh;

    expect(mesh.indices).toBeInstanceOf(Uint32Array);
    expect(mesh.indexCount).toBe(6);
    expect(Array.from(mesh.indices)).toEqual([0, 1, 2, 2, 1, 3]);
    // Sanity check: positions unaffected
    expect(mesh.vertexCount).toBe(4);
    expect(Array.from(mesh.positions)).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]);
  });

  it('generates tangents when TANGENT attribute is absent', () => {
    const positions = new Float32Array([
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
    ]);
    const normals = new Float32Array([
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
    ]);
    const uvs = new Float32Array([
      0, 0,
      1, 0,
      0, 1,
    ]);
    const indices = new Uint16Array([0, 1, 2]);

    const chunks = [
      new Uint8Array(positions.buffer),
      new Uint8Array(normals.buffer),
      new Uint8Array(uvs.buffer),
      new Uint8Array(indices.buffer),
    ];
    let off = 0;
    const bufferViews = chunks.map((chunk) => {
      const view = { buffer: 0, byteOffset: off, byteLength: chunk.byteLength };
      off += chunk.byteLength;
      return view;
    });
    const merged = new Uint8Array(off);
    let writeOffset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, writeOffset);
      writeOffset += chunk.byteLength;
    }

    const model = parseGltf2({
      asset: { version: '2.0' },
      buffers: [{ byteLength: merged.byteLength }],
      bufferViews,
      accessors: [
        { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' },
        { bufferView: 1, componentType: 5126, count: 3, type: 'VEC3' },
        { bufferView: 2, componentType: 5126, count: 3, type: 'VEC2' },
        { bufferView: 3, componentType: 5123, count: 3, type: 'SCALAR' },
      ],
      meshes: [{
        primitives: [{
          attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
          indices: 3,
        }],
      }],
    }, [merged.buffer as ArrayBuffer]);

    expect(model.primitives[0]!.mesh.tangents).toHaveLength(12);
    expect(Array.from(model.primitives[0]!.mesh.tangents.slice(0, 4))).toEqual([1, 0, 0, 1]);
  });

  it('resolves external image payloads for .gltf materials', () => {
    const positions = new Float32Array([
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
    ]);
    const normals = new Float32Array([
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
    ]);
    const uvs = new Float32Array([
      0, 0,
      1, 0,
      0, 1,
    ]);
    const indices = new Uint16Array([0, 1, 2]);

    const chunks = [
      new Uint8Array(positions.buffer),
      new Uint8Array(normals.buffer),
      new Uint8Array(uvs.buffer),
      new Uint8Array(indices.buffer),
    ];
    let off = 0;
    const bufferViews = chunks.map((chunk) => {
      const view = { buffer: 0, byteOffset: off, byteLength: chunk.byteLength };
      off += chunk.byteLength;
      return view;
    });
    const merged = new Uint8Array(off);
    let writeOffset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, writeOffset);
      writeOffset += chunk.byteLength;
    }

    const pngBytes = new Uint8Array([137, 80, 78, 71]);
    const model = parseGltf2({
      asset: { version: '2.0' },
      buffers: [{ byteLength: merged.byteLength }],
      bufferViews,
      accessors: [
        { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' },
        { bufferView: 1, componentType: 5126, count: 3, type: 'VEC3' },
        { bufferView: 2, componentType: 5126, count: 3, type: 'VEC2' },
        { bufferView: 3, componentType: 5123, count: 3, type: 'SCALAR' },
      ],
      images: [{ uri: 'textures/baseColor.png', mimeType: 'image/png' }],
      textures: [{ source: 0 }],
      materials: [{
        pbrMetallicRoughness: {
          baseColorTexture: { index: 0 },
        },
      }],
      meshes: [{
        primitives: [{
          attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
          indices: 3,
          material: 0,
        }],
      }],
    }, [merged.buffer as ArrayBuffer], [{
      data: pngBytes,
      mimeType: 'image/png',
    }]);

    expect(model.primitives[0]!.material.baseColorTexture?.mimeType).toBe('image/png');
    expect(Array.from(model.primitives[0]!.material.baseColorTexture?.data ?? [])).toEqual(Array.from(pngBytes));
  });
});
