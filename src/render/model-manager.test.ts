import { describe, it, expect, vi } from 'vitest';
import { ModelManager } from './model-manager.js';
import type { ParsedGltf } from './gltf-parser.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function mockDevice(): GPUDevice {
  return {
    createBuffer: vi.fn((desc: GPUBufferDescriptor) => ({
      label: desc.label,
      size: desc.size,
      usage: desc.usage,
      getMappedRange: vi.fn(
        (offset?: number, size?: number) =>
          new ArrayBuffer(size ?? desc.size),
      ),
      unmap: vi.fn(),
      destroy: vi.fn(),
      mapAsync: vi.fn(),
    })),
  } as unknown as GPUDevice;
}

function makeParsedGltf(primCount = 1): ParsedGltf {
  const primitives = [];
  for (let i = 0; i < primCount; i++) {
    primitives.push({
      mesh: {
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
        texcoords: new Float32Array([0, 0, 1, 0, 0, 1]),
        indices: new Uint16Array([0, 1, 2]),
        vertexCount: 3,
        indexCount: 3,
      },
      material: {
        baseColorFactor: [1, 1, 1, 1] as [number, number, number, number],
        metallicFactor: 0,
        roughnessFactor: 1,
        emissiveFactor: [0, 0, 0] as [number, number, number],
        alphaMode: 'OPAQUE' as const,
        alphaCutoff: 0.5,
        doubleSided: false,
        unlit: false,
      },
      imageData: new Map(),
      name: `prim-${i}`,
    });
  }
  return { primitives };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('ModelManager', () => {
  it('upload stores model and get retrieves it', () => {
    const device = mockDevice();
    const mgr = new ModelManager(device);
    const parsed = makeParsedGltf();

    mgr.upload('tank', parsed);

    const model = mgr.get('tank');
    expect(model).toBeDefined();
    expect(model!.primitives).toHaveLength(1);

    const prim = model!.primitives[0]!;
    expect(prim.indexCount).toBe(3);
    expect(prim.vertexCount).toBe(3);
    expect(prim.indexFormat).toBe('uint16');
    expect(prim.material.baseColorFactor).toEqual([1, 1, 1, 1]);
    expect(prim.material.metallicFactor).toBe(0);
    expect(prim.material.roughnessFactor).toBe(1);
    expect(prim.baseColorTexture).toBeNull();

    // GPU buffers: 1 vertex + 1 index per primitive = 2
    expect(device.createBuffer).toHaveBeenCalledTimes(2);
  });

  it('upload is idempotent (skip duplicate)', () => {
    const device = mockDevice();
    const mgr = new ModelManager(device);
    const parsed = makeParsedGltf();

    mgr.upload('tank', parsed);
    mgr.upload('tank', parsed);

    expect(device.createBuffer).toHaveBeenCalledTimes(2);
  });

  it('has returns correct state', () => {
    const device = mockDevice();
    const mgr = new ModelManager(device);

    expect(mgr.has('tank')).toBe(false);
    expect(mgr.get('tank')).toBeUndefined();

    mgr.upload('tank', makeParsedGltf());

    expect(mgr.has('tank')).toBe(true);
    expect(mgr.has('helicopter')).toBe(false);
  });

  it('destroy releases all GPU resources', () => {
    const device = mockDevice();
    const mgr = new ModelManager(device);

    mgr.upload('tank', makeParsedGltf());
    mgr.upload('jeep', makeParsedGltf());

    const tankPrim = mgr.get('tank')!.primitives[0]!;
    const jeepPrim = mgr.get('jeep')!.primitives[0]!;

    mgr.destroy();

    expect(tankPrim.vertexBuffer.destroy).toHaveBeenCalled();
    expect(tankPrim.indexBuffer.destroy).toHaveBeenCalled();
    expect(jeepPrim.vertexBuffer.destroy).toHaveBeenCalled();
    expect(jeepPrim.indexBuffer.destroy).toHaveBeenCalled();

    expect(mgr.has('tank')).toBe(false);
    expect(mgr.has('jeep')).toBe(false);
  });

  it('interleaves vertex data correctly', () => {
    const capturedVertexData: Float32Array[] = [];

    const device = {
      createBuffer: vi.fn((desc: GPUBufferDescriptor) => {
        const buf = new ArrayBuffer(desc.size);
        return {
          label: desc.label,
          size: desc.size,
          usage: desc.usage,
          getMappedRange: vi.fn(
            (offset?: number, size?: number) => {
              const view = size != null
                ? buf.slice(offset ?? 0, (offset ?? 0) + size)
                : buf;
              if (desc.label?.includes('vertex')) {
                capturedVertexData.push(new Float32Array(view));
              }
              return view;
            },
          ),
          unmap: vi.fn(),
          destroy: vi.fn(),
          mapAsync: vi.fn(),
        };
      }),
    } as unknown as GPUDevice;

    const mgr = new ModelManager(device);

    const parsed: ParsedGltf = {
      primitives: [{
        mesh: {
          positions: new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]),
          normals: new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]),
          texcoords: new Float32Array([0.0, 0.1, 0.2, 0.3, 0.4, 0.5]),
          indices: new Uint16Array([0, 1, 2]),
          vertexCount: 3,
          indexCount: 3,
        },
        material: {
          baseColorFactor: [1, 1, 1, 1],
          metallicFactor: 0,
          roughnessFactor: 1,
          emissiveFactor: [0, 0, 0],
          alphaMode: 'OPAQUE',
          alphaCutoff: 0.5,
          doubleSided: false,
        unlit: false,
        },
        imageData: new Map(),
      }],
    };

    mgr.upload('test', parsed);

    const vertexBufDesc = (device.createBuffer as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(vertexBufDesc.size).toBe(96);
    expect(vertexBufDesc.label).toBe('model-vertex-test');

    expect(capturedVertexData.length).toBeGreaterThan(0);
    const vd = capturedVertexData[0]!;
    // Vertex 0: pos(1,2,3) norm(0.1,0.2,0.3) uv(0.0,0.1)
    expect(vd[0]).toBeCloseTo(1);
    expect(vd[1]).toBeCloseTo(2);
    expect(vd[2]).toBeCloseTo(3);
    expect(vd[3]).toBeCloseTo(0.1);
    expect(vd[4]).toBeCloseTo(0.2);
    expect(vd[5]).toBeCloseTo(0.3);
    expect(vd[6]).toBeCloseTo(0.0);
    expect(vd[7]).toBeCloseTo(0.1);
    // Vertex 1
    expect(vd[8]).toBeCloseTo(4);
    expect(vd[11]).toBeCloseTo(0.4);
    expect(vd[14]).toBeCloseTo(0.2);
    // Vertex 2
    expect(vd[16]).toBeCloseTo(7);
    expect(vd[22]).toBeCloseTo(0.4);
  });

  it('handles uint32 index format', () => {
    const device = mockDevice();
    const mgr = new ModelManager(device);

    const parsed: ParsedGltf = {
      primitives: [{
        mesh: {
          positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
          texcoords: new Float32Array([0, 0, 1, 0, 0, 1]),
          indices: new Uint32Array([0, 1, 2]),
          vertexCount: 3,
          indexCount: 3,
        },
        material: {
          baseColorFactor: [1, 0, 0, 1],
          metallicFactor: 0.5,
          roughnessFactor: 0.5,
          emissiveFactor: [0, 0, 0],
          alphaMode: 'OPAQUE',
          alphaCutoff: 0.5,
          doubleSided: false,
        unlit: false,
        },
        imageData: new Map(),
      }],
    };

    mgr.upload('bigmodel', parsed);

    const prim = mgr.get('bigmodel')!.primitives[0]!;
    expect(prim.indexFormat).toBe('uint32');
  });

  // ---- Multi-primitive tests ----

  it('uploads model with multiple primitives', () => {
    const device = mockDevice();
    const mgr = new ModelManager(device);
    const parsed = makeParsedGltf(3);

    mgr.upload('multi', parsed);

    const model = mgr.get('multi');
    expect(model).toBeDefined();
    expect(model!.primitives).toHaveLength(3);

    // 3 primitives × (1 vertex + 1 index) = 6 buffer creates
    expect(device.createBuffer).toHaveBeenCalledTimes(6);

    // Each primitive has correct data
    for (const prim of model!.primitives) {
      expect(prim.vertexCount).toBe(3);
      expect(prim.indexCount).toBe(3);
      expect(prim.indexFormat).toBe('uint16');
    }
  });

  it('destroy releases all primitive GPU resources', () => {
    const device = mockDevice();
    const mgr = new ModelManager(device);
    mgr.upload('multi', makeParsedGltf(2));

    const prims = mgr.get('multi')!.primitives;
    mgr.destroy();

    for (const prim of prims) {
      expect(prim.vertexBuffer.destroy).toHaveBeenCalled();
      expect(prim.indexBuffer.destroy).toHaveBeenCalled();
    }
  });
});
