import { describe, it, expect } from 'vitest';
import { generateGLB } from './generateGLB.js';
import { createBoxGeometry, createCylinderGeometry, createSphereGeometry } from './Geometry3D.js';

describe('generateGLB', () => {
  it('produces valid GLB header', () => {
    const mesh = createBoxGeometry(1, 1, 1);
    const glb = generateGLB(mesh);
    const view = new DataView(glb);

    // Magic: "glTF" = 0x46546C67
    expect(view.getUint32(0, true)).toBe(0x46546C67);
    // Version: 2
    expect(view.getUint32(4, true)).toBe(2);
    // Total length matches buffer
    expect(view.getUint32(8, true)).toBe(glb.byteLength);
  });

  it('has JSON chunk and BIN chunk', () => {
    const mesh = createBoxGeometry(1, 1, 1);
    const glb = generateGLB(mesh);
    const view = new DataView(glb);

    // JSON chunk type at offset 16
    expect(view.getUint32(16, true)).toBe(0x4E4F534A); // "JSON"

    // Find BIN chunk after JSON
    const jsonLength = view.getUint32(12, true);
    const binOffset = 12 + 8 + jsonLength;
    expect(view.getUint32(binOffset + 4, true)).toBe(0x004E4942); // "BIN\0"
  });

  it('JSON chunk contains valid glTF', () => {
    const mesh = createBoxGeometry(2, 3, 4);
    const glb = generateGLB(mesh);
    const view = new DataView(glb);

    const jsonLength = view.getUint32(12, true);
    const jsonBytes = new Uint8Array(glb, 20, jsonLength);
    const jsonStr = new TextDecoder().decode(jsonBytes).trim();
    const json = JSON.parse(jsonStr);

    expect(json.asset.version).toBe('2.0');
    expect(json.meshes).toHaveLength(1);
    expect(json.meshes[0].primitives).toHaveLength(1);
    expect(json.accessors).toHaveLength(4); // POSITION, NORMAL, TEXCOORD_0, indices
    expect(json.bufferViews).toHaveLength(2); // vertex, index
    expect(json.materials).toHaveLength(1);
  });

  it('POSITION accessor has correct min/max', () => {
    const mesh = createBoxGeometry(2, 3, 4);
    const glb = generateGLB(mesh);
    const view = new DataView(glb);

    const jsonLength = view.getUint32(12, true);
    const jsonStr = new TextDecoder().decode(new Uint8Array(glb, 20, jsonLength)).trim();
    const json = JSON.parse(jsonStr);
    const posAccessor = json.accessors[0];

    expect(posAccessor.min[0]).toBeCloseTo(-1, 5); // halfW = 1
    expect(posAccessor.max[0]).toBeCloseTo(1, 5);
    expect(posAccessor.min[1]).toBeCloseTo(-1.5, 5); // halfH = 1.5
    expect(posAccessor.max[1]).toBeCloseTo(1.5, 5);
    expect(posAccessor.count).toBe(mesh.vertexCount);
  });

  it('works with cylinder', () => {
    const mesh = createCylinderGeometry(1, 1, 2, 16);
    const glb = generateGLB(mesh);
    expect(glb.byteLength).toBeGreaterThan(100);

    const view = new DataView(glb);
    expect(view.getUint32(0, true)).toBe(0x46546C67);
  });

  it('works with sphere', () => {
    const mesh = createSphereGeometry(1, 16, 8);
    const glb = generateGLB(mesh);
    expect(glb.byteLength).toBeGreaterThan(100);
  });

  it('accepts custom base color', () => {
    const mesh = createBoxGeometry(1, 1, 1);
    const glb = generateGLB(mesh, [1, 0, 0, 1]);
    const view = new DataView(glb);

    const jsonLength = view.getUint32(12, true);
    const jsonStr = new TextDecoder().decode(new Uint8Array(glb, 20, jsonLength)).trim();
    const json = JSON.parse(jsonStr);

    expect(json.materials[0].pbrMetallicRoughness.baseColorFactor).toEqual([1, 0, 0, 1]);
  });

  it('total length is 4-byte aligned', () => {
    const mesh = createCylinderGeometry(0.5, 1, 3, 12);
    const glb = generateGLB(mesh);
    expect(glb.byteLength % 4).toBe(0);
  });
});
