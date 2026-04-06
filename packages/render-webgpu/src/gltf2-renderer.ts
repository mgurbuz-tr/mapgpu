/**
 * GLTF2 Renderer — Standalone 3D model renderer with correct depth and lighting.
 *
 * Uses standard GPU perspective depth (no custom depth override).
 * Per-pixel view direction for correct PBR lighting on globe.
 * Integrates with existing mapgpu FrameContext and camera bind groups.
 */

import type { ModelBoundsQuery, ModelMetadata, ResolvedModelBounds } from '@mapgpu/core';
import type {
  Gltf2AnimationChannel,
  Gltf2AnimationClip,
  Gltf2Model,
  Gltf2Node,
  Gltf2Primitive,
  Gltf2TextureData,
} from './gltf2-loader.js';
import { parseGlb2, parseGltf2 } from './gltf2-loader.js';
import { GLTF2_FLAT_SHADER, GLTF2_GLOBE_SHADER } from './gltf2-shader.js';
import { MSAA_SAMPLE_COUNT } from './frame-context.js';
import {
  buildModelMetadata,
  computeCanonicalLocalBounds,
  computeWorldMatrices,
  type Matrix4,
  resolveCanonicalModelBounds,
  writeNodeUniformMatrices,
} from './model-spatial.js';

// ─── GPU Model Types ───

interface GpuPrimitive {
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  indexFormat: GPUIndexFormat;
  indexCount: number;
  vertexCount: number;
  materialBuffer: GPUBuffer;
  materialData: Float32Array;
  materialBindGroup: GPUBindGroup;
  alphaMode: Gltf2Primitive['material']['alphaMode'];
  ownedTextures: GPUTexture[];
  doubleSided: boolean;
  nodeIndex: number | null;
}

interface GpuModel {
  primitives: GpuPrimitive[];
  primitiveBounds: Array<{ bounds: { min: [number, number, number]; max: [number, number, number] }; nodeIndex: number | null }>;
  nodes: Gltf2Node[];
  animations: Gltf2AnimationClip[];
  lastAnimationTime: number | null;
  metadata: ModelMetadata;
  worldMatrices: Matrix4[];
  normalMatrices: Matrix4[];
}

/** Matches existing ModelRenderBuffer interface */
export interface Gltf2RenderBuffer {
  instanceBuffer: GPUBuffer;
  instanceCount: number;
}

type MaterialTextureKind = 'baseColor' | 'normal' | 'metallicRoughness' | 'occlusion' | 'emissive';

const GLTF2_MIPMAP_SHADER = /* wgsl */ `
struct MipmapVertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@group(0) @binding(0) var mipSampler: sampler;
@group(0) @binding(1) var mipSource: texture_2d<f32>;

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> MipmapVertexOutput {
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0),
  );
  var uvs = array<vec2<f32>, 3>(
    vec2<f32>(0.0, 1.0),
    vec2<f32>(2.0, 1.0),
    vec2<f32>(0.0, -1.0),
  );

  var output: MipmapVertexOutput;
  output.clipPosition = vec4<f32>(positions[vertexIndex], 0.0, 1.0);
  output.uv = uvs[vertexIndex];
  return output;
}

@fragment
fn fs_main(input: MipmapVertexOutput) -> @location(0) vec4<f32> {
  return textureSampleLevel(mipSource, mipSampler, input.uv, 0.0);
}
`;

function copyVec3(src: [number, number, number]): [number, number, number] {
  return [src[0], src[1], src[2]];
}

function copyQuat(src: [number, number, number, number]): [number, number, number, number] {
  return [src[0], src[1], src[2], src[3]];
}

function copyBoundingBox(bbox: { min: [number, number, number]; max: [number, number, number] }): {
  min: [number, number, number];
  max: [number, number, number];
} {
  return {
    min: copyVec3(bbox.min),
    max: copyVec3(bbox.max),
  };
}

function normalizeQuat(q: [number, number, number, number]): [number, number, number, number] {
  const len = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function slerpQuat(
  a: [number, number, number, number],
  b: [number, number, number, number],
  t: number,
): [number, number, number, number] {
  let ax = a[0], ay = a[1], az = a[2], aw = a[3];
  let bx = b[0], by = b[1], bz = b[2], bw = b[3];
  let cosHalfTheta = ax * bx + ay * by + az * bz + aw * bw;

  if (cosHalfTheta < 0) {
    bx = -bx; by = -by; bz = -bz; bw = -bw;
    cosHalfTheta = -cosHalfTheta;
  }

  if (cosHalfTheta > 0.9995) {
    return normalizeQuat([
      lerp(ax, bx, t),
      lerp(ay, by, t),
      lerp(az, bz, t),
      lerp(aw, bw, t),
    ]);
  }

  const halfTheta = Math.acos(Math.min(Math.max(cosHalfTheta, -1), 1));
  const sinHalfTheta = Math.sqrt(1 - cosHalfTheta * cosHalfTheta) || 1;
  const aWeight = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
  const bWeight = Math.sin(t * halfTheta) / sinHalfTheta;
  return [
    ax * aWeight + bx * bWeight,
    ay * aWeight + by * bWeight,
    az * aWeight + bz * bWeight,
    aw * aWeight + bw * bWeight,
  ];
}

function copyModelMetadata(metadata: ModelMetadata): ModelMetadata {
  return {
    ...metadata,
    localBounds: copyBoundingBox(metadata.localBounds),
    restLocalBounds: copyBoundingBox(metadata.restLocalBounds),
    currentLocalBounds: copyBoundingBox(metadata.currentLocalBounds),
  };
}

// ─── Renderer ───

export class Gltf2Renderer {
  private _device: GPUDevice;
  private _models = new Map<string, GpuModel>();
  private _flatOpaquePipeline: GPURenderPipeline | null = null;
  private _flatBlendPipeline: GPURenderPipeline | null = null;
  private _globeOpaquePipeline: GPURenderPipeline | null = null;
  private _globeBlendPipeline: GPURenderPipeline | null = null;
  private _sampler: GPUSampler | null = null;
  private _materialLayout: GPUBindGroupLayout | null = null;
  private _placeholderTexture: GPUTexture | null = null;
  private _mipmapBindGroupLayout: GPUBindGroupLayout | null = null;
  private _mipmapSampler: GPUSampler | null = null;
  private _mipmapShaderModule: GPUShaderModule | null = null;
  private _mipmapPipelines = new Map<GPUTextureFormat, GPURenderPipeline>();

  constructor(device: GPUDevice) {
    this._device = device;
  }

  // ─── Model Loading ───

  async loadModel(id: string, source: string | ArrayBuffer): Promise<void> {
    if (this._models.has(id)) return;

    let parsed: Gltf2Model;

    if (source instanceof ArrayBuffer) {
      parsed = parseGlb2(source);
    } else {
      const url = source;
      if (url.endsWith('.gltf') || url.includes('.gltf?')) {
        const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
        const resp = await fetch(url);
        const json = await resp.json();
        const bufferDefs = (json as { buffers?: { uri?: string; byteLength: number }[] }).buffers ?? [];
        const buffers = await Promise.all(
          bufferDefs.map(async (buf: { uri?: string; byteLength: number }) => {
            if (!buf.uri) return new ArrayBuffer(buf.byteLength);
            const bufUrl = buf.uri.startsWith('data:') ? buf.uri : baseUrl + buf.uri;
            return (await fetch(bufUrl)).arrayBuffer();
          }),
        );
        parsed = parseGltf2(json, buffers);
      } else {
        const resp = await fetch(url);
        parsed = parseGlb2(await resp.arrayBuffer());
      }
    }

    await this._uploadModel(id, parsed);
  }

  has(id: string): boolean { return this._models.has(id); }
  getBoundingBox(id: string): { min: [number, number, number]; max: [number, number, number] } | null {
    const metadata = this._models.get(id)?.metadata;
    return metadata ? copyBoundingBox(metadata.localBounds) : null;
  }
  getGroundAnchorUnits(id: string): number | null {
    return this._models.get(id)?.metadata.groundAnchorLocalZ ?? null;
  }
  getModelMetadata(id: string): ModelMetadata | null {
    const metadata = this._models.get(id)?.metadata;
    return metadata ? copyModelMetadata(metadata) : null;
  }
  resolveModelBounds(query: ModelBoundsQuery): ResolvedModelBounds | null {
    const metadata = this._models.get(query.modelId)?.metadata;
    if (!metadata) return null;
    return resolveCanonicalModelBounds(metadata, query);
  }
  isAnimated(id: string): boolean {
    return this._models.get(id)?.animations.some((clip) => clip.duration > 0 && clip.channels.length > 0) ?? false;
  }
  syncAnimationState(id: string, timeSeconds: number): void {
    const model = this._models.get(id);
    if (!model) return;
    this._updateAnimations(model, timeSeconds);
  }

  // ─── Drawing ───

  drawFlat(
    pass: GPURenderPassEncoder,
    buffer: Gltf2RenderBuffer,
    cameraBindGroup: GPUBindGroup,
    cameraBindGroupLayout: GPUBindGroupLayout,
    colorFormat: GPUTextureFormat,
    depthFormat: GPUTextureFormat,
    modelId: string,
    timeSeconds: number,
  ): void {
    const model = this._models.get(modelId);
    if (!model) return;
    this._updateAnimations(model, timeSeconds);

    const opaquePipeline = this._ensureFlatPipeline(cameraBindGroupLayout, colorFormat, depthFormat, false);
    const blendPipeline = model.primitives.some((prim) => prim.alphaMode === 'BLEND')
      ? this._ensureFlatPipeline(cameraBindGroupLayout, colorFormat, depthFormat, true)
      : null;

    this._drawPrimitives(pass, model, buffer, cameraBindGroup, opaquePipeline, blendPipeline);
  }

  drawGlobe(
    pass: GPURenderPassEncoder,
    buffer: Gltf2RenderBuffer,
    cameraBindGroup: GPUBindGroup,
    cameraBindGroupLayout: GPUBindGroupLayout,
    colorFormat: GPUTextureFormat,
    depthFormat: GPUTextureFormat,
    modelId: string,
    timeSeconds: number,
  ): void {
    const model = this._models.get(modelId);
    if (!model) return;
    this._updateAnimations(model, timeSeconds);

    const opaquePipeline = this._ensureGlobePipeline(cameraBindGroupLayout, colorFormat, depthFormat, false);
    const blendPipeline = model.primitives.some((prim) => prim.alphaMode === 'BLEND')
      ? this._ensureGlobePipeline(cameraBindGroupLayout, colorFormat, depthFormat, true)
      : null;

    this._drawPrimitives(pass, model, buffer, cameraBindGroup, opaquePipeline, blendPipeline);
  }

  destroy(): void {
    for (const model of this._models.values()) {
      for (const prim of model.primitives) {
        prim.vertexBuffer.destroy();
        prim.indexBuffer.destroy();
        prim.materialBuffer.destroy();
        for (const texture of prim.ownedTextures) {
          texture.destroy();
        }
      }
    }
    this._models.clear();
    this._placeholderTexture?.destroy();
  }

  // ─── Private: Upload ───

  private async _uploadModel(id: string, parsed: Gltf2Model): Promise<void> {
    const gpuPrims: GpuPrimitive[] = [];

    for (let i = 0; i < parsed.primitives.length; i++) {
      const prim = parsed.primitives[i]!;
      const gpu = await this._uploadPrimitive(id, prim, i);
      gpuPrims.push(gpu);
    }

    const primitiveBounds = parsed.primitives.map((primitive) => ({
      bounds: copyBoundingBox(primitive.mesh.bounds),
      nodeIndex: primitive.nodeIndex ?? null,
    }));
    const restTransforms = computeWorldMatrices(
      parsed.nodes,
      parsed.nodes.map((node) => copyVec3(node.translation)),
      parsed.nodes.map((node) => copyQuat(node.rotation)),
      parsed.nodes.map((node) => copyVec3(node.scale)),
    );
    const restLocalBounds = computeCanonicalLocalBounds(primitiveBounds, restTransforms.worldMatrices);
    const metadata = buildModelMetadata(
      restLocalBounds,
      restLocalBounds,
      parsed.animations.some((clip) => clip.duration > 0 && clip.channels.length > 0),
      parsed.nodes.some((node) => node.parentIndex !== null || node.children.length > 0),
    );

    const model: GpuModel = {
      primitives: gpuPrims,
      primitiveBounds,
      nodes: parsed.nodes,
      animations: parsed.animations,
      lastAnimationTime: null,
      metadata,
      worldMatrices: restTransforms.worldMatrices,
      normalMatrices: restTransforms.normalMatrices,
    };
    this._writePrimitiveMatrices(model);
    this._models.set(id, model);
  }

  private async _uploadPrimitive(
    modelId: string,
    prim: Gltf2Primitive,
    idx: number,
  ): Promise<GpuPrimitive> {
    const { mesh, material } = prim;
    const device = this._device;

    // Interleave vertices: [pos(3) + normal(3) + uv(2)] = 8 floats per vertex
    const stride = 8;
    const interleaved = new Float32Array(mesh.vertexCount * stride);
    for (let i = 0; i < mesh.vertexCount; i++) {
      const vi = i * stride, pi = i * 3, ti = i * 2;
      interleaved[vi]     = mesh.positions[pi]!;
      interleaved[vi + 1] = mesh.positions[pi + 1]!;
      interleaved[vi + 2] = mesh.positions[pi + 2]!;
      interleaved[vi + 3] = mesh.normals[pi]!;
      interleaved[vi + 4] = mesh.normals[pi + 1]!;
      interleaved[vi + 5] = mesh.normals[pi + 2]!;
      interleaved[vi + 6] = mesh.texcoords[ti]!;
      interleaved[vi + 7] = mesh.texcoords[ti + 1]!;
    }

    // Vertex buffer
    const vb = device.createBuffer({
      label: `gltf2-vb-${modelId}-${idx}`,
      size: interleaved.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(vb.getMappedRange()).set(interleaved);
    vb.unmap();

    // Index buffer (4-byte aligned for getMappedRange)
    const indexData = mesh.indices;
    const indexFormat: GPUIndexFormat = indexData instanceof Uint32Array ? 'uint32' : 'uint16';
    const paddedSize = Math.ceil(indexData.byteLength / 4) * 4;
    const ib = device.createBuffer({
      label: `gltf2-ib-${modelId}-${idx}`,
      size: Math.max(paddedSize, 4),
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    const mappedRange = ib.getMappedRange(0, Math.max(paddedSize, 4));
    if (indexData instanceof Uint32Array) {
      new Uint32Array(mappedRange).set(indexData);
    } else {
      new Uint16Array(mappedRange).set(indexData);
    }
    ib.unmap();

    // Material uniform (base 20 floats + nodeMatrix 16 + nodeNormalMatrix 16)
    const matData = new Float32Array(52);
    matData[0] = material.baseColorFactor[0]; matData[1] = material.baseColorFactor[1];
    matData[2] = material.baseColorFactor[2]; matData[3] = material.baseColorFactor[3];
    matData[4] = 1; matData[5] = 1; matData[6] = 1; matData[7] = 1; // tintColor default white
    matData[8] = material.emissiveFactor[0]; matData[9] = material.emissiveFactor[1];
    matData[10] = material.emissiveFactor[2];
    matData[11] = material.metallicFactor;
    matData[12] = material.roughnessFactor;
    matData[13] = material.baseColorTexture ? 1 : 0;
    matData[14] = material.normalTexture ? 1 : 0;
    matData[15] = material.metallicRoughnessTexture ? 1 : 0;
    matData[16] = material.occlusionTexture ? 1 : 0;
    matData[17] = material.emissiveTexture ? 1 : 0;
    matData[18] = material.alphaMode === 'MASK' ? material.alphaCutoff : material.alphaMode === 'OPAQUE' ? -1 : 0;
    matData[19] = material.unlit ? 1 : 0;

    const identityMatrix = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
    writeNodeUniformMatrices(matData, 20, identityMatrix, identityMatrix);

    const mb = device.createBuffer({
      label: `gltf2-mat-${modelId}-${idx}`,
      size: matData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(mb, 0, matData);

    // Textures
    const placeholder = this._getPlaceholder();
    const sampler = this._getSampler();
    const layout = this._getMaterialLayout();
    const ownedTextures: GPUTexture[] = [];

    const uploadTex = async (texData: Gltf2TextureData | undefined, kind: MaterialTextureKind): Promise<GPUTexture> => {
      if (!texData) return placeholder;
      try {
        const arrBuf = new ArrayBuffer(texData.data.byteLength);
        new Uint8Array(arrBuf).set(texData.data);
        const blob = new Blob([arrBuf], { type: texData.mimeType });
        const bitmap = await createImageBitmap(blob);
        const tex = this._createTextureWithMipmaps(`gltf2-tex-${modelId}-${idx}-${kind}`, bitmap, this._getTextureFormat(kind));
        bitmap.close();
        ownedTextures.push(tex);
        return tex;
      } catch {
        return placeholder;
      }
    };

    const bcTex = await uploadTex(material.baseColorTexture, 'baseColor');
    const nTex = await uploadTex(material.normalTexture, 'normal');
    const mrTex = await uploadTex(material.metallicRoughnessTexture, 'metallicRoughness');
    const aoTex = await uploadTex(material.occlusionTexture, 'occlusion');
    const emTex = await uploadTex(material.emissiveTexture, 'emissive');

    const materialBindGroup = device.createBindGroup({
      label: `gltf2-bg-${modelId}-${idx}`,
      layout,
      entries: [
        { binding: 0, resource: { buffer: mb } },
        { binding: 1, resource: sampler },
        { binding: 2, resource: bcTex.createView() },
        { binding: 3, resource: nTex.createView() },
        { binding: 4, resource: mrTex.createView() },
        { binding: 5, resource: aoTex.createView() },
        { binding: 6, resource: emTex.createView() },
      ],
    });

    return {
      vertexBuffer: vb, indexBuffer: ib, indexFormat,
      indexCount: mesh.indexCount, vertexCount: mesh.vertexCount,
      materialBuffer: mb, materialData: matData, materialBindGroup,
      alphaMode: material.alphaMode,
      ownedTextures,
      doubleSided: material.doubleSided,
      nodeIndex: prim.nodeIndex ?? null,
    };
  }

  // ─── Private: Draw ───

  private _drawPrimitives(
    pass: GPURenderPassEncoder,
    model: GpuModel,
    buffer: Gltf2RenderBuffer,
    cameraBindGroup: GPUBindGroup,
    opaquePipeline: GPURenderPipeline,
    blendPipeline: GPURenderPipeline | null,
  ): void {
    pass.setBindGroup(0, cameraBindGroup);
    let activePipeline: GPURenderPipeline | null = null;

    const drawPrimitive = (prim: GpuPrimitive, pipeline: GPURenderPipeline) => {
      if (activePipeline !== pipeline) {
        pass.setPipeline(pipeline);
        activePipeline = pipeline;
      }

      pass.setBindGroup(1, prim.materialBindGroup);
      pass.setVertexBuffer(0, prim.vertexBuffer);
      pass.setVertexBuffer(1, buffer.instanceBuffer);
      pass.setIndexBuffer(prim.indexBuffer, prim.indexFormat);
      pass.drawIndexed(prim.indexCount, buffer.instanceCount);
    };

    for (const prim of model.primitives) {
      if (prim.alphaMode !== 'BLEND') {
        drawPrimitive(prim, opaquePipeline);
      }
    }

    if (!blendPipeline) return;

    for (const prim of model.primitives) {
      if (prim.alphaMode === 'BLEND') {
        drawPrimitive(prim, blendPipeline);
      }
    }
  }

  private _updateAnimations(model: GpuModel, timeSeconds: number): void {
    if (model.animations.length === 0) return;
    if (model.lastAnimationTime !== null && Math.abs(model.lastAnimationTime - timeSeconds) < 1e-6) return;
    model.lastAnimationTime = timeSeconds;

    const translations = model.nodes.map((node) => copyVec3(node.translation));
    const rotations = model.nodes.map((node) => copyQuat(node.rotation));
    const scales = model.nodes.map((node) => copyVec3(node.scale));

    for (const clip of model.animations) {
      const clipTime = clip.duration > 0 ? timeSeconds % clip.duration : 0;
      for (const channel of clip.channels) {
        this._applyAnimationChannel(channel, clipTime, translations, rotations, scales);
      }
    }
    const transforms = computeWorldMatrices(model.nodes, translations, rotations, scales);
    model.worldMatrices = transforms.worldMatrices;
    model.normalMatrices = transforms.normalMatrices;
    model.metadata = buildModelMetadata(
      model.metadata.restLocalBounds,
      computeCanonicalLocalBounds(model.primitiveBounds, model.worldMatrices),
      model.metadata.isAnimated,
      model.metadata.hasHierarchy,
    );
    this._writePrimitiveMatrices(model);
  }

  private _writePrimitiveMatrices(model: GpuModel): void {
    for (const prim of model.primitives) {
      const worldMatrix = prim.nodeIndex === null
        ? new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
          ])
        : (model.worldMatrices[prim.nodeIndex] ?? new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
          ]));
      const normalMatrix = prim.nodeIndex === null
        ? worldMatrix
        : (model.normalMatrices[prim.nodeIndex] ?? worldMatrix);
      writeNodeUniformMatrices(prim.materialData, 20, worldMatrix, normalMatrix);
      this._device.queue.writeBuffer(
        prim.materialBuffer,
        0,
        prim.materialData.buffer as ArrayBuffer,
        prim.materialData.byteOffset,
        prim.materialData.byteLength,
      );
    }
  }

  private _applyAnimationChannel(
    channel: Gltf2AnimationChannel,
    timeSeconds: number,
    translations: [number, number, number][],
    rotations: [number, number, number, number][],
    scales: [number, number, number][],
  ): void {
    const targetIndex = channel.node;
    const { input, output } = channel;
    if (targetIndex < 0 || targetIndex >= translations.length || input.length === 0) return;

    const componentSize = channel.path === 'rotation' ? 4 : 3;
    let frameIndex = 0;
    while (frameIndex + 1 < input.length && timeSeconds >= input[frameIndex + 1]!) {
      frameIndex++;
    }

    const nextIndex = Math.min(frameIndex + 1, input.length - 1);
    const t0 = input[frameIndex] ?? 0;
    const t1 = input[nextIndex] ?? t0;
    const alpha = channel.interpolation === 'STEP' || nextIndex === frameIndex || t1 <= t0
      ? 0
      : (timeSeconds - t0) / (t1 - t0);

    const readFrame = (index: number): number[] => {
      const start = index * componentSize;
      return Array.from(output.subarray(start, start + componentSize));
    };

    if (channel.path === 'rotation') {
      const a = readFrame(frameIndex) as [number, number, number, number];
      const b = readFrame(nextIndex) as [number, number, number, number];
      rotations[targetIndex] = alpha === 0 ? normalizeQuat(a) : normalizeQuat(slerpQuat(a, b, alpha));
      return;
    }

    const a = readFrame(frameIndex) as [number, number, number];
    const b = readFrame(nextIndex) as [number, number, number];
    const value: [number, number, number] = alpha === 0
      ? [a[0], a[1], a[2]]
      : [
          lerp(a[0], b[0], alpha),
          lerp(a[1], b[1], alpha),
          lerp(a[2], b[2], alpha),
        ];

    if (channel.path === 'translation') {
      translations[targetIndex] = value;
    } else {
      scales[targetIndex] = value;
    }
  }

  // ─── Private: Pipeline Creation ───

  private _ensureFlatPipeline(
    cameraLayout: GPUBindGroupLayout,
    colorFormat: GPUTextureFormat,
    depthFormat: GPUTextureFormat,
    blend: boolean,
  ): GPURenderPipeline {
    if (blend) {
      if (this._flatBlendPipeline) return this._flatBlendPipeline;
      this._flatBlendPipeline = this._createPipeline('gltf2-flat-blend', GLTF2_FLAT_SHADER, cameraLayout, colorFormat, depthFormat, true);
      return this._flatBlendPipeline;
    }

    if (this._flatOpaquePipeline) return this._flatOpaquePipeline;
    this._flatOpaquePipeline = this._createPipeline('gltf2-flat-opaque', GLTF2_FLAT_SHADER, cameraLayout, colorFormat, depthFormat, false);
    return this._flatOpaquePipeline;
  }

  private _ensureGlobePipeline(
    cameraLayout: GPUBindGroupLayout,
    colorFormat: GPUTextureFormat,
    depthFormat: GPUTextureFormat,
    blend: boolean,
  ): GPURenderPipeline {
    if (blend) {
      if (this._globeBlendPipeline) return this._globeBlendPipeline;
      this._globeBlendPipeline = this._createPipeline('gltf2-globe-blend', GLTF2_GLOBE_SHADER, cameraLayout, colorFormat, depthFormat, true);
      return this._globeBlendPipeline;
    }

    if (this._globeOpaquePipeline) return this._globeOpaquePipeline;
    this._globeOpaquePipeline = this._createPipeline('gltf2-globe-opaque', GLTF2_GLOBE_SHADER, cameraLayout, colorFormat, depthFormat, false);
    return this._globeOpaquePipeline;
  }

  private _createPipeline(
    label: string,
    shaderSource: string,
    cameraLayout: GPUBindGroupLayout,
    colorFormat: GPUTextureFormat,
    depthFormat: GPUTextureFormat,
    blend: boolean,
  ): GPURenderPipeline {
    const device = this._device;
    const materialLayout = this._getMaterialLayout();

    const module = device.createShaderModule({ label: `${label}-shader`, code: shaderSource });

    return device.createRenderPipeline({
      label,
      layout: device.createPipelineLayout({
        label: `${label}-layout`,
        bindGroupLayouts: [cameraLayout, materialLayout],
      }),
      vertex: {
        module,
        entryPoint: 'vs_main',
        buffers: [
          // Slot 0: mesh vertex data (interleaved, 32 bytes/vertex)
          {
            arrayStride: 32,
            stepMode: 'vertex' as GPUVertexStepMode,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' as GPUVertexFormat },
              { shaderLocation: 1, offset: 12, format: 'float32x3' as GPUVertexFormat },
              { shaderLocation: 2, offset: 24, format: 'float32x2' as GPUVertexFormat },
            ],
          },
          // Slot 1: instance data (32 bytes/instance) — same layout as existing ModelRenderBuffer
          {
            arrayStride: 32,
            stepMode: 'instance' as GPUVertexStepMode,
            attributes: [
              { shaderLocation: 3, offset: 0, format: 'float32x3' as GPUVertexFormat },
              { shaderLocation: 4, offset: 12, format: 'float32x2' as GPUVertexFormat },
              { shaderLocation: 5, offset: 20, format: 'float32x3' as GPUVertexFormat },
            ],
          },
        ],
      },
      fragment: {
        module,
        entryPoint: 'fs_main',
        targets: [{
          format: colorFormat,
          blend: blend ? {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
          } : undefined,
        }],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none', // doubleSided handled by front_facing in shader
      },
      depthStencil: {
        format: depthFormat,
        depthWriteEnabled: !blend,
        depthCompare: 'less',  // Standard depth test — NO custom override
      },
      multisample: { count: MSAA_SAMPLE_COUNT },
    });
  }

  private _getTextureFormat(kind: MaterialTextureKind): GPUTextureFormat {
    return kind === 'baseColor' || kind === 'emissive' ? 'rgba8unorm-srgb' : 'rgba8unorm';
  }

  private _createTextureWithMipmaps(
    label: string,
    bitmap: ImageBitmap,
    format: GPUTextureFormat,
  ): GPUTexture {
    const mipLevelCount = Math.floor(Math.log2(Math.max(bitmap.width, bitmap.height))) + 1;
    const texture = this._device.createTexture({
      label,
      size: { width: bitmap.width, height: bitmap.height },
      mipLevelCount,
      format,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    this._device.queue.copyExternalImageToTexture(
      { source: bitmap },
      { texture },
      { width: bitmap.width, height: bitmap.height },
    );

    if (mipLevelCount > 1) {
      this._generateMipmaps(texture, format, mipLevelCount);
    }

    return texture;
  }

  private _generateMipmaps(texture: GPUTexture, format: GPUTextureFormat, mipLevelCount: number): void {
    const pipeline = this._getMipmapPipeline(format);
    const bindGroupLayout = this._getMipmapBindGroupLayout();
    const sampler = this._getMipmapSampler();
    const encoder = this._device.createCommandEncoder({ label: 'gltf2-mipmap-encoder' });

    for (let mipLevel = 1; mipLevel < mipLevelCount; mipLevel++) {
      const srcView = texture.createView({ baseMipLevel: mipLevel - 1, mipLevelCount: 1 });
      const dstView = texture.createView({ baseMipLevel: mipLevel, mipLevelCount: 1 });
      const bindGroup = this._device.createBindGroup({
        label: `gltf2-mipmap-bind-group-${mipLevel}`,
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: srcView },
        ],
      });

      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: dstView,
          loadOp: 'clear',
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          storeOp: 'store',
        }],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(3);
      pass.end();
    }

    this._device.queue.submit([encoder.finish()]);
  }

  private _getMipmapPipeline(format: GPUTextureFormat): GPURenderPipeline {
    const existing = this._mipmapPipelines.get(format);
    if (existing) return existing;

    const pipeline = this._device.createRenderPipeline({
      label: `gltf2-mipmap-${format}`,
      layout: this._device.createPipelineLayout({
        label: `gltf2-mipmap-layout-${format}`,
        bindGroupLayouts: [this._getMipmapBindGroupLayout()],
      }),
      vertex: {
        module: this._getMipmapShaderModule(),
        entryPoint: 'vs_main',
      },
      fragment: {
        module: this._getMipmapShaderModule(),
        entryPoint: 'fs_main',
        targets: [{ format }],
      },
      primitive: {
        topology: 'triangle-list',
      },
    });

    this._mipmapPipelines.set(format, pipeline);
    return pipeline;
  }

  private _getMipmapBindGroupLayout(): GPUBindGroupLayout {
    if (this._mipmapBindGroupLayout) return this._mipmapBindGroupLayout;
    this._mipmapBindGroupLayout = this._device.createBindGroupLayout({
      label: 'gltf2-mipmap-bind-group-layout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      ],
    });
    return this._mipmapBindGroupLayout;
  }

  private _getMipmapShaderModule(): GPUShaderModule {
    if (this._mipmapShaderModule) return this._mipmapShaderModule;
    this._mipmapShaderModule = this._device.createShaderModule({
      label: 'gltf2-mipmap-shader',
      code: GLTF2_MIPMAP_SHADER,
    });
    return this._mipmapShaderModule;
  }

  private _getMipmapSampler(): GPUSampler {
    if (this._mipmapSampler) return this._mipmapSampler;
    this._mipmapSampler = this._device.createSampler({
      label: 'gltf2-mipmap-sampler',
      minFilter: 'linear',
      magFilter: 'linear',
      mipmapFilter: 'linear',
      maxAnisotropy: 8,
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });
    return this._mipmapSampler;
  }

  // ─── Private: Shared Resources ───

  private _getPlaceholder(): GPUTexture {
    if (this._placeholderTexture) return this._placeholderTexture;
    this._placeholderTexture = this._device.createTexture({
      label: 'gltf2-placeholder',
      size: { width: 1, height: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    this._device.queue.writeTexture(
      { texture: this._placeholderTexture },
      new Uint8Array([255, 255, 255, 255]),
      { bytesPerRow: 4 },
      { width: 1, height: 1 },
    );
    return this._placeholderTexture;
  }

  private _getSampler(): GPUSampler {
    if (this._sampler) return this._sampler;
    this._sampler = this._device.createSampler({
      label: 'gltf2-sampler',
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
      maxAnisotropy: 8,
      addressModeU: 'repeat',
      addressModeV: 'repeat',
    });
    return this._sampler;
  }

  private _getMaterialLayout(): GPUBindGroupLayout {
    if (this._materialLayout) return this._materialLayout;
    this._materialLayout = this._device.createBindGroupLayout({
      label: 'gltf2-material-layout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 5, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 6, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      ],
    });
    return this._materialLayout;
  }
}
