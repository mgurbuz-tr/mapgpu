/**
 * GLTF2 Renderer — Standalone 3D model renderer with correct depth and lighting.
 *
 * Uses standard GPU perspective depth (no custom depth override).
 * Per-pixel view direction for correct PBR lighting on globe.
 * Integrates with existing mapgpu FrameContext and camera bind groups.
 */

import type {
  IWorker,
  ModelSymbol,
  ModelBoundsQuery,
  ModelMetadata,
  ResolvedModelBounds,
  WorkerPoolRegistry,
  WorkerTaskDef,
} from '../core/index.js';
import type {
  Gltf2AnimationChannel,
  Gltf2AnimationClip,
  Gltf2Model,
  Gltf2Node,
  Gltf2Primitive,
  Gltf2TextureData,
} from './gltf2-loader.js';
import { parseGlb2, parseGltf2 } from './gltf2-loader.js';
import {
  createGltf2ParseTaskDef,
  type Gltf2ParseRequest,
  type Gltf2ParseResponse,
} from './gltf2-worker-protocol.js';
import {
  GLTF2_FLAT_MASK_SHADER,
  GLTF2_FLAT_SHADER,
  GLTF2_GLOBE_MASK_SHADER,
  GLTF2_GLOBE_SHADER,
} from './gltf2-shader.js';
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
  primitiveIndex: number;
  materialBuffer: GPUBuffer;
  materialData: Float32Array;
  materialBindGroup: GPUBindGroup;
  alphaMode: Gltf2Primitive['material']['alphaMode'];
  ownedTextures: GPUTexture[];
  doubleSided: boolean;
  materialName?: string;
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
  /** Bounding box geometric center (Z-up local space, meters). Used as default rotation pivot. */
  autoPivot: [number, number, number];
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

function inferImageMimeType(uri: string): string {
  const cleanUri = uri.split('?')[0]?.split('#')[0] ?? uri;
  const lower = cleanUri.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/png';
}

// ─── Renderer ───

/**
 * Per-frame record of a model draw that should also be rendered into the
 * silhouette mask. Recorded by drawFlat/drawGlobe at scene-render time and
 * replayed by drawMaskPass later in the frame.
 */
interface PendingMaskDraw {
  modelId: string;
  instanceBuffer: GPUBuffer;
  instanceCount: number;
  viewMode: 'flat' | 'globe';
  timeSeconds: number;
  symbol: ModelSymbol;
}

export class Gltf2Renderer {
  private readonly _device: GPUDevice;
  private readonly _models = new Map<string, GpuModel>();
  // Pipelines are cached per mode/blend/cull/depthCompare combination.
  // Double-sided glTF materials intentionally keep cullMode='none' so broken
  // or mixed winding in imported assets does not tear the mesh apart.
  // Key format: `${mode}-${blend?'blend':'opaque'}-${cullMode}-${depthCompare}`.
  private readonly _pipelineCache = new Map<string, GPURenderPipeline>();
  private _flatMaskPipeline: GPURenderPipeline | null = null;
  private _globeMaskPipeline: GPURenderPipeline | null = null;
  private _sampler: GPUSampler | null = null;
  private _materialLayout: GPUBindGroupLayout | null = null;
  private _placeholderTexture: GPUTexture | null = null;
  private _mipmapBindGroupLayout: GPUBindGroupLayout | null = null;
  private _mipmapSampler: GPUSampler | null = null;
  private _mipmapShaderModule: GPUShaderModule | null = null;
  private readonly _mipmapPipelines = new Map<GPUTextureFormat, GPURenderPipeline>();

  private readonly _pendingMaskDraws: PendingMaskDraw[] = [];
  private _lastDebugOverrideSig: string | null = null;

  private _workerRegistry: WorkerPoolRegistry | null = null;
  private _gltf2TaskDef: WorkerTaskDef<Gltf2ParseRequest, Gltf2ParseResponse> | null = null;
  private _workerDisabled = false;

  constructor(device: GPUDevice) {
    this._device = device;
  }

  /**
   * Configure the worker registry and task factory for off-thread GLB parse.
   * Intended to be called by the hosting RenderEngine once it has access to
   * ViewCore's WorkerPoolRegistry. When unset, `loadModel` runs parseGlb2 on
   * the main thread (legacy behavior).
   */
  setWorkerRegistry(
    registry: WorkerPoolRegistry | null,
    workerFactory?: () => IWorker,
  ): void {
    this._workerRegistry = registry;
    this._workerDisabled = false;

    if (registry && workerFactory) {
      this._gltf2TaskDef = createGltf2ParseTaskDef(workerFactory);
    } else if (registry) {
      this._gltf2TaskDef = createGltf2ParseTaskDef(() => {
        const w = new Worker(
          new URL('./gltf2.worker.js', import.meta.url),
          { type: 'module' },
        );
        return w as unknown as IWorker;
      });
    } else {
      this._gltf2TaskDef = null;
    }
  }

  // ─── Model Loading ───

  async loadModel(id: string, source: string | ArrayBuffer): Promise<void> {
    if (this._models.has(id)) return;

    let parsed: Gltf2Model;

    if (source instanceof ArrayBuffer) {
      parsed = await this._parseGlb(source);
    } else {
      const url = source;
      if (url.endsWith('.gltf') || url.includes('.gltf?')) {
        // Text glTF + external buffers path: stays main-thread because the
        // worker protocol currently covers GLB only.
        const baseUrl = new URL(url, globalThis.location?.href ?? 'http://localhost/');
        const resp = await fetch(url);
        const json = await resp.json();
        const bufferDefs = (json as { buffers?: { uri?: string; byteLength: number }[] }).buffers ?? [];
        const buffers = await Promise.all(
          bufferDefs.map(async (buf: { uri?: string; byteLength: number }) => {
            if (!buf.uri) return new ArrayBuffer(buf.byteLength);
            const bufUrl = buf.uri.startsWith('data:') ? buf.uri : new URL(buf.uri, baseUrl).toString();
            return (await fetch(bufUrl)).arrayBuffer();
          }),
        );
        const imageDefs = (json as { images?: { uri?: string; mimeType?: string }[] }).images ?? [];
        const externalImages = await Promise.all(
          imageDefs.map(async (img) => {
            if (!img?.uri || img.uri.startsWith('data:')) return undefined;
            const imgUrl = new URL(img.uri, baseUrl).toString();
            const imageResponse = await fetch(imgUrl);
            const imageBuffer = await imageResponse.arrayBuffer();
            return {
              data: new Uint8Array(imageBuffer),
              mimeType: img.mimeType ?? imageResponse.headers.get('content-type') ?? inferImageMimeType(img.uri),
            } satisfies Gltf2TextureData;
          }),
        );
        parsed = parseGltf2(json, buffers, externalImages);
      } else {
        const resp = await fetch(url);
        parsed = await this._parseGlb(await resp.arrayBuffer());
      }
    }

    await this._uploadModel(id, parsed);
  }

  /**
   * Parse a binary GLB buffer. Uses the worker path when a registry is
   * configured and has not been disabled by a prior failure. Falls back to
   * sync main-thread `parseGlb2` otherwise.
   *
   * The caller owns `buffer`; if the worker path takes it, the worker
   * protocol transfers ownership and the main-thread buffer is detached.
   * The caller does not reuse `buffer` after this call (verified by call
   * sites above), so transfer is safe.
   */
  private async _parseGlb(buffer: ArrayBuffer): Promise<Gltf2Model> {
    if (
      this._workerRegistry
      && this._gltf2TaskDef
      && !this._workerDisabled
    ) {
      try {
        return await this._workerRegistry.run(this._gltf2TaskDef, { buffer });
      } catch (err) {
        this._workerDisabled = true;
        console.warn('[Gltf2Renderer] worker parse disabled, falling back to main thread:', err);
      }
    }
    return parseGlb2(buffer);
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

  /**
   * Reset per-frame state. Must be called by RenderEngine.beginFrame() before
   * any draw commands are recorded. Currently only clears the pending mask
   * draw list — drawFlat/drawGlobe re-populate it as scene rendering happens.
   */
  beginFrame(): void {
    this._pendingMaskDraws.length = 0;
  }

  /** Whether any models were queued during this frame. */
  hasPendingMaskDraws(): boolean {
    return this._pendingMaskDraws.length > 0;
  }

  drawFlat( // NOSONAR
    pass: GPURenderPassEncoder,
    buffer: Gltf2RenderBuffer,
    cameraBindGroup: GPUBindGroup,
    cameraBindGroupLayout: GPUBindGroupLayout,
    colorFormat: GPUTextureFormat,
    depthFormat: GPUTextureFormat,
    symbol: ModelSymbol,
    timeSeconds: number,
  ): void {
    const model = this._models.get(symbol.modelId);
    if (!model) return;
    this._updateAnimations(model, timeSeconds);
    this._applySymbolMaterialOverrides(model, symbol);

    const pickFlat = (blend: boolean, doubleSided: boolean): GPURenderPipeline =>
      this._ensureFlatPipeline(cameraBindGroupLayout, colorFormat, depthFormat, blend, doubleSided);

    this._drawPrimitives(pass, model, buffer, cameraBindGroup, pickFlat, 'flat');

    // Queue the same draw for the silhouette mask pass — replayed later in
    // the frame against the offscreen R8 mask texture. The legacy shell-
    // expansion outline (_drawOutlinePrimitives) is intentionally skipped
    // here; the screen-space Sobel composite produces the actual outline.
    if ((symbol.outlineWidth ?? 0) > 0 && (symbol.outlineColor?.[3] ?? 0) > 0) {
      this._pendingMaskDraws.push({
        modelId: symbol.modelId,
        instanceBuffer: buffer.instanceBuffer,
        instanceCount: buffer.instanceCount,
        viewMode: 'flat',
        timeSeconds,
        symbol,
      });
    }
  }

  drawGlobe( // NOSONAR
    pass: GPURenderPassEncoder,
    buffer: Gltf2RenderBuffer,
    cameraBindGroup: GPUBindGroup,
    cameraBindGroupLayout: GPUBindGroupLayout,
    colorFormat: GPUTextureFormat,
    depthFormat: GPUTextureFormat,
    symbol: ModelSymbol,
    timeSeconds: number,
  ): void {
    const model = this._models.get(symbol.modelId);
    if (!model) return;
    this._updateAnimations(model, timeSeconds);
    this._applySymbolMaterialOverrides(model, symbol);

    const pickGlobe = (blend: boolean, doubleSided: boolean): GPURenderPipeline =>
      this._ensureGlobePipeline(cameraBindGroupLayout, colorFormat, depthFormat, blend, doubleSided);

    this._drawPrimitives(pass, model, buffer, cameraBindGroup, pickGlobe, 'globe');

    if ((symbol.outlineWidth ?? 0) > 0 && (symbol.outlineColor?.[3] ?? 0) > 0) {
      this._pendingMaskDraws.push({
        modelId: symbol.modelId,
        instanceBuffer: buffer.instanceBuffer,
        instanceCount: buffer.instanceCount,
        viewMode: 'globe',
        timeSeconds,
        symbol,
      });
    }
  }

  /**
   * Replay all queued draws into a silhouette mask pass.
   *
   * The mask pass uses a simplified mask shader that writes 1.0 into a
   * single-channel R8Unorm attachment for every pixel covered by the model
   * (regardless of occlusion by other scene geometry). A subsequent
   * post-process applies Sobel edge detection on this mask and composites
   * the resulting outline onto the swap chain — producing a clean
   * screen-space silhouette that matches Cesium's selectedFeatures style.
   *
   * Per-symbol outline color/width are NOT consumed here. They live on the
   * silhouette composite uniform, set by the caller before the composite pass.
   */
  drawMaskPass(
    pass: GPURenderPassEncoder,
    flatCameraBindGroup: GPUBindGroup,
    flatCameraBindGroupLayout: GPUBindGroupLayout,
    globeCameraBindGroup: GPUBindGroup | null,
    globeCameraBindGroupLayout: GPUBindGroupLayout | null,
    maskFormat: GPUTextureFormat,
  ): void {
    if (this._pendingMaskDraws.length === 0) return;

    let activePipeline: GPURenderPipeline | null = null;
    let activeViewMode: 'flat' | 'globe' | null = null;

    for (const draw of this._pendingMaskDraws) {
      const model = this._models.get(draw.modelId);
      if (!model) continue;

      const pipeline = draw.viewMode === 'flat'
        ? this._ensureFlatMaskPipeline(flatCameraBindGroupLayout, maskFormat)
        : (globeCameraBindGroupLayout
            ? this._ensureGlobeMaskPipeline(globeCameraBindGroupLayout, maskFormat)
            : null);
      if (!pipeline) continue;

      if (activePipeline !== pipeline || activeViewMode !== draw.viewMode) {
        pass.setPipeline(pipeline);
        const camBg = draw.viewMode === 'flat' ? flatCameraBindGroup : globeCameraBindGroup;
        if (!camBg) continue;
        pass.setBindGroup(0, camBg);
        activePipeline = pipeline;
        activeViewMode = draw.viewMode;
      }

      for (const prim of model.primitives) {
        pass.setBindGroup(1, prim.materialBindGroup);
        pass.setVertexBuffer(0, prim.vertexBuffer);
        pass.setVertexBuffer(1, draw.instanceBuffer);
        pass.setIndexBuffer(prim.indexBuffer, prim.indexFormat);
        pass.drawIndexed(prim.indexCount, draw.instanceCount);
      }
    }
  }

  /**
   * Per-frame outline color resolved from the most recent symbol that
   * recorded a pending mask draw. The composite pass uses this to color the
   * Sobel edges. Returns null when no mask draws are pending — caller
   * should skip the composite pass in that case.
   */
  getActiveOutlineUniform(): { color: [number, number, number, number]; width: number } | null {
    if (this._pendingMaskDraws.length === 0) return null;
    const last = this._pendingMaskDraws[this._pendingMaskDraws.length - 1]!;
    const c = last.symbol.outlineColor ?? [0, 0, 0, 255];
    return {
      color: [c[0] / 255, c[1] / 255, c[2] / 255, c[3] / 255],
      width: last.symbol.outlineWidth ?? 1,
    };
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

    // Auto-pivot: XY = bounding box center (natural rotation center for
    // heading/pitch/roll), Z = 0 (glTF origin — most models anchor origin at
    // the base). Avoids sinking the model half-way below the ground plane
    // while still rotating around the visual center of mass.
    const autoPivot: [number, number, number] = [
      (restLocalBounds.min[0] + restLocalBounds.max[0]) * 0.5,
      (restLocalBounds.min[1] + restLocalBounds.max[1]) * 0.5,
      0,
    ];

    console.log('[mapgpu][gltf2] uploadModel', {
      modelId: id,
      primitiveCount: parsed.primitives.length,
      nodeCount: parsed.nodes.length,
      nodes: parsed.nodes.map((n, i) => ({
        i,
        name: n.name,
        parentIndex: n.parentIndex,
        translation: n.translation,
        rotation: n.rotation,
        scale: n.scale,
      })),
      rawMeshBounds: parsed.primitives.map((p, i) => ({
        i,
        nodeIndex: p.nodeIndex,
        bounds: { min: [...p.mesh.bounds.min], max: [...p.mesh.bounds.max] },
      })),
      canonicalRestLocalBounds: {
        min: [restLocalBounds.min[0], restLocalBounds.min[1], restLocalBounds.min[2]],
        max: [restLocalBounds.max[0], restLocalBounds.max[1], restLocalBounds.max[2]],
      },
      autoPivot,
    });

    const model: GpuModel = {
      primitives: gpuPrims,
      primitiveBounds,
      nodes: parsed.nodes,
      animations: parsed.animations,
      lastAnimationTime: null,
      metadata,
      worldMatrices: restTransforms.worldMatrices,
      normalMatrices: restTransforms.normalMatrices,
      autoPivot,
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

    // Interleave vertices: [pos(3) + normal(3) + tangent(4) + uv(2)] = 12 floats per vertex
    const stride = 12;
    const interleaved = new Float32Array(mesh.vertexCount * stride);
    for (let i = 0; i < mesh.vertexCount; i++) {
      const vi = i * stride;
      const pi = i * 3;
      const gi = i * 4;
      const ti = i * 2;
      interleaved[vi]     = mesh.positions[pi]!;
      interleaved[vi + 1] = mesh.positions[pi + 1]!;
      interleaved[vi + 2] = mesh.positions[pi + 2]!;
      interleaved[vi + 3] = mesh.normals[pi]!;
      interleaved[vi + 4] = mesh.normals[pi + 1]!;
      interleaved[vi + 5] = mesh.normals[pi + 2]!;
      interleaved[vi + 6] = mesh.tangents[gi]!;
      interleaved[vi + 7] = mesh.tangents[gi + 1]!;
      interleaved[vi + 8] = mesh.tangents[gi + 2]!;
      interleaved[vi + 9] = mesh.tangents[gi + 3]!;
      interleaved[vi + 10] = mesh.texcoords[ti]!;
      interleaved[vi + 11] = mesh.texcoords[ti + 1]!;
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

    // Material uniform layout must match WGSL struct size exactly.
    // 20 floats base block + 8 floats outline block + 32 floats matrices = 60,
    // then padded to 16-float / 64-byte alignment for uniform-buffer binding.
    const matData = new Float32Array(64);
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
    let alphaVal: number;
    if (material.alphaMode === 'MASK') {
      alphaVal = material.alphaCutoff;
    } else if (material.alphaMode === 'OPAQUE') {
      alphaVal = -1;
    } else {
      alphaVal = 0;
    }
    matData[18] = alphaVal;
    matData[19] = material.unlit ? 1 : 0;
    matData[20] = 0;
    matData[21] = 0;
    matData[22] = 0;
    matData[23] = 0;
    matData[24] = 0;

    const identityMatrix = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
    writeNodeUniformMatrices(matData, 32, identityMatrix, identityMatrix);

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
      primitiveIndex: idx,
      indexCount: mesh.indexCount, vertexCount: mesh.vertexCount,
      materialBuffer: mb, materialData: matData, materialBindGroup,
      alphaMode: material.alphaMode,
      ownedTextures,
      doubleSided: material.doubleSided,
      materialName: material.name,
      nodeIndex: prim.nodeIndex ?? null,
    };
  }

  // ─── Private: Draw ───

  private _drawPrimitives(
    pass: GPURenderPassEncoder,
    model: GpuModel,
    buffer: Gltf2RenderBuffer,
    cameraBindGroup: GPUBindGroup,
    pickPipeline: (
      blend: boolean,
      doubleSided: boolean,
      cullMode?: GPUCullMode,
      depthCompare?: GPUCompareFunction,
    ) => GPURenderPipeline,
    viewMode: 'flat' | 'globe',
  ): void {
    pass.setBindGroup(0, cameraBindGroup);
    let activePipeline: GPURenderPipeline | null = null;
    const debugEnabled = (globalThis as { __MAPGPU_MODEL_DEBUG__?: boolean }).__MAPGPU_MODEL_DEBUG__ === true;

    const drawWithPipeline = (
      prim: GpuPrimitive,
      blend: boolean,
      cullMode?: GPUCullMode,
      depthCompare?: GPUCompareFunction,
      passLabel?: string,
    ) => {
      const pipeline = pickPipeline(blend, prim.doubleSided, cullMode, depthCompare);
      if (activePipeline !== pipeline) {
        pass.setPipeline(pipeline);
        activePipeline = pipeline;
      }

      pass.setBindGroup(1, prim.materialBindGroup);
      pass.setVertexBuffer(0, prim.vertexBuffer);
      pass.setVertexBuffer(1, buffer.instanceBuffer);
      pass.setIndexBuffer(prim.indexBuffer, prim.indexFormat);
      if (debugEnabled) {
        console.log('[mapgpu][gltf2][draw]', {
          viewMode,
          pass: passLabel ?? 'single-pass',
          primitiveIndex: prim.primitiveIndex,
          materialName: prim.materialName ?? null,
          nodeIndex: prim.nodeIndex,
          nodeName: prim.nodeIndex !== null ? (model.nodes[prim.nodeIndex]?.name ?? null) : null,
          alphaMode: prim.alphaMode,
          doubleSided: prim.doubleSided,
          cullMode: cullMode ?? (prim.doubleSided ? 'none' : 'back'),
          depthCompare: depthCompare ?? 'less',
          indexCount: prim.indexCount,
          instanceCount: buffer.instanceCount,
          pipeline: pipeline.label ?? null,
        });
      }
      pass.drawIndexed(prim.indexCount, buffer.instanceCount);
    };

    const drawPrimitive = (prim: GpuPrimitive, blend: boolean) => {
      // cullMode: doubleSided material'lar için none, diğerleri back.
      // depthCompare: pipeline factory 3D globe için 'greater' (reverse-Z) default'una çevrildi.
      drawWithPipeline(prim, blend, prim.doubleSided ? 'none' : 'back', undefined);
    };

    // Draw opaque first (depth writes), then blend on top.
    for (const prim of model.primitives) {
      if (prim.alphaMode !== 'BLEND') drawPrimitive(prim, false);
    }
    for (const prim of model.primitives) {
      if (prim.alphaMode === 'BLEND') drawPrimitive(prim, true);
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
      writeNodeUniformMatrices(prim.materialData, 32, worldMatrix, normalMatrix);
      this._device.queue.writeBuffer(
        prim.materialBuffer,
        0,
        prim.materialData.buffer as ArrayBuffer,
        prim.materialData.byteOffset,
        prim.materialData.byteLength,
      );
    }
  }

  private _applySymbolMaterialOverrides(model: GpuModel, symbol: ModelSymbol): void {
    const tint = symbol.tintColor ?? [255, 255, 255, 255];
    const outline = symbol.outlineColor ?? [0, 0, 0, 0];
    const outlineWidth = symbol.outlineWidth ?? 0;
    // Pivot default is [0,0,0] (glTF origin) to preserve pre-feature behavior.
    // Users who want rotation around the visual center can override with
    // `symbol.pivot = renderEngine.getModelBounds(id)` midpoint.
    const pivot = symbol.pivot ?? [0, 0, 0];
    const bounds = model.metadata.localBounds;
    // Conservative support radius from pivot to the farthest bounds corner.
    // Despite the historical name "depthLift", this value is now used by the
    // globe shader as a camera-direction support radius so the nearest part of
    // the model, not just the anchor center, stays inside the shifted depth
    // band when zooming close.
    const corners: Array<[number, number, number]> = [
      [bounds.min[0], bounds.min[1], bounds.min[2]],
      [bounds.min[0], bounds.min[1], bounds.max[2]],
      [bounds.min[0], bounds.max[1], bounds.min[2]],
      [bounds.min[0], bounds.max[1], bounds.max[2]],
      [bounds.max[0], bounds.min[1], bounds.min[2]],
      [bounds.max[0], bounds.min[1], bounds.max[2]],
      [bounds.max[0], bounds.max[1], bounds.min[2]],
      [bounds.max[0], bounds.max[1], bounds.max[2]],
    ];
    const depthLift = Math.max(
      ...corners.map((corner) => Math.hypot(
        corner[0] - pivot[0],
        corner[1] - pivot[1],
        corner[2] - pivot[2],
      )),
    );

    const sig = `${symbol.modelId}|${symbol.heading ?? 0}|${symbol.pitch ?? 0}|${symbol.roll ?? 0}|${symbol.scale ?? 1}|${pivot[0]},${pivot[1]},${pivot[2]}`;
    if (this._lastDebugOverrideSig !== sig) {
      this._lastDebugOverrideSig = sig;
      console.log('[mapgpu][gltf2] applyOverride', {
        modelId: symbol.modelId,
        heading: symbol.heading ?? 0,
        pitch: symbol.pitch ?? 0,
        roll: symbol.roll ?? 0,
        scale: symbol.scale ?? 1,
        anchorZ: symbol.anchorZ ?? 0,
        pivot,
        depthLift,
        pivotSource: symbol.pivot ? 'symbol' : 'auto',
        autoPivot: model.autoPivot,
      });
    }

    for (const prim of model.primitives) {
      prim.materialData[4] = tint[0] / 255;
      prim.materialData[5] = tint[1] / 255;
      prim.materialData[6] = tint[2] / 255;
      prim.materialData[7] = tint[3] / 255;
      prim.materialData[20] = outline[0] / 255;
      prim.materialData[21] = outline[1] / 255;
      prim.materialData[22] = outline[2] / 255;
      prim.materialData[23] = outline[3] / 255;
      prim.materialData[24] = outlineWidth;
      // Pivot (vec3) lives at std140 offset 112 (float index 28) due to vec3 alignment.
      prim.materialData[28] = pivot[0];
      prim.materialData[29] = pivot[1];
      prim.materialData[30] = pivot[2];
      prim.materialData[31] = depthLift;
      this._device.queue.writeBuffer(
        prim.materialBuffer,
        4 * 4,
        prim.materialData.buffer as ArrayBuffer,
        prim.materialData.byteOffset + 4 * 4,
        5 * 4,
      );
      this._device.queue.writeBuffer(
        prim.materialBuffer,
        20 * 4,
        prim.materialData.buffer as ArrayBuffer,
        prim.materialData.byteOffset + 20 * 4,
        12 * 4,
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
    doubleSided: boolean,
    cullMode?: GPUCullMode,
    depthCompare?: GPUCompareFunction,
  ): GPURenderPipeline {
    const resolvedCullMode = cullMode ?? (doubleSided ? 'none' : 'back');
    const resolvedDepthCompare = depthCompare ?? 'less';
    const key = `flat-${blend ? 'blend' : 'opaque'}-${resolvedCullMode}-${resolvedDepthCompare}`;
    let p = this._pipelineCache.get(key);
    if (p) return p;
    p = this._createPipeline(
      `gltf2-${key}`,
      GLTF2_FLAT_SHADER,
      cameraLayout,
      colorFormat,
      depthFormat,
      blend,
      resolvedCullMode,
      resolvedDepthCompare,
    );
    this._pipelineCache.set(key, p);
    return p;
  }

  private _ensureGlobePipeline(
    cameraLayout: GPUBindGroupLayout,
    colorFormat: GPUTextureFormat,
    depthFormat: GPUTextureFormat,
    blend: boolean,
    doubleSided: boolean,
    cullMode?: GPUCullMode,
    depthCompare?: GPUCompareFunction,
  ): GPURenderPipeline {
    const resolvedCullMode = cullMode ?? (doubleSided ? 'none' : 'back');
    // 3D globe mode reverse-Z buffer kullanıyor (compareFunc='greater', clearValue=0).
    // Globe shader de reverse-Z NDC yazıyor. Default compareFunc 'greater' olmalı.
    const resolvedDepthCompare = depthCompare ?? 'greater';
    const key = `globe-${blend ? 'blend' : 'opaque'}-${resolvedCullMode}-${resolvedDepthCompare}`;
    let p = this._pipelineCache.get(key);
    if (p) return p;
    p = this._createPipeline(
      `gltf2-${key}`,
      GLTF2_GLOBE_SHADER,
      cameraLayout,
      colorFormat,
      depthFormat,
      blend,
      resolvedCullMode,
      resolvedDepthCompare,
    );
    this._pipelineCache.set(key, p);
    return p;
  }

  private _ensureFlatMaskPipeline(
    cameraLayout: GPUBindGroupLayout,
    maskFormat: GPUTextureFormat,
  ): GPURenderPipeline {
    if (this._flatMaskPipeline) return this._flatMaskPipeline;
    this._flatMaskPipeline = this._createMaskPipeline('gltf2-flat-mask', GLTF2_FLAT_MASK_SHADER, cameraLayout, maskFormat);
    return this._flatMaskPipeline;
  }

  private _ensureGlobeMaskPipeline(
    cameraLayout: GPUBindGroupLayout,
    maskFormat: GPUTextureFormat,
  ): GPURenderPipeline {
    if (this._globeMaskPipeline) return this._globeMaskPipeline;
    this._globeMaskPipeline = this._createMaskPipeline('gltf2-globe-mask', GLTF2_GLOBE_MASK_SHADER, cameraLayout, maskFormat);
    return this._globeMaskPipeline;
  }

  /**
   * Create a silhouette mask pipeline.
   *
   * Differences from the main scene pipeline:
   * - Color target is a single-channel mask (e.g. R8Unorm), not the swap chain
   * - No depth/stencil attachment — the mask records the model's full
   *   silhouette regardless of occlusion by other geometry
   * - Multisample count is 1 — the mask is sampled by a fullscreen
   *   composite pass and doesn't need MSAA
   * - Cull mode is 'none' — both faces of the model contribute to coverage
   */
  private _createMaskPipeline(
    label: string,
    shaderSource: string,
    cameraLayout: GPUBindGroupLayout,
    maskFormat: GPUTextureFormat,
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
          {
            arrayStride: 48,
            stepMode: 'vertex' as GPUVertexStepMode,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' as GPUVertexFormat },
              { shaderLocation: 1, offset: 12, format: 'float32x3' as GPUVertexFormat },
              { shaderLocation: 2, offset: 24, format: 'float32x4' as GPUVertexFormat },
              { shaderLocation: 3, offset: 40, format: 'float32x2' as GPUVertexFormat },
            ],
          },
          {
            arrayStride: 32,
            stepMode: 'instance' as GPUVertexStepMode,
            attributes: [
              { shaderLocation: 4, offset: 0, format: 'float32x3' as GPUVertexFormat },
              { shaderLocation: 5, offset: 12, format: 'float32x2' as GPUVertexFormat },
              { shaderLocation: 6, offset: 20, format: 'float32x3' as GPUVertexFormat },
            ],
          },
        ],
      },
      fragment: {
        module,
        entryPoint: 'fs_main',
        targets: [{ format: maskFormat }],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back',
      },
      multisample: { count: 1 },
    });
  }

  private _createPipeline(
    label: string,
    shaderSource: string,
    cameraLayout: GPUBindGroupLayout,
    colorFormat: GPUTextureFormat,
    depthFormat: GPUTextureFormat,
    blend: boolean,
    cullMode: GPUCullMode,
    depthCompare: GPUCompareFunction,
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
          // Slot 0: mesh vertex data (interleaved, 48 bytes/vertex)
          {
            arrayStride: 48,
            stepMode: 'vertex' as GPUVertexStepMode,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' as GPUVertexFormat },
              { shaderLocation: 1, offset: 12, format: 'float32x3' as GPUVertexFormat },
              { shaderLocation: 2, offset: 24, format: 'float32x4' as GPUVertexFormat },
              { shaderLocation: 3, offset: 40, format: 'float32x2' as GPUVertexFormat },
            ],
          },
          // Slot 1: instance data (32 bytes/instance) — same layout as existing ModelRenderBuffer
          {
            arrayStride: 32,
            stepMode: 'instance' as GPUVertexStepMode,
            attributes: [
              { shaderLocation: 4, offset: 0, format: 'float32x3' as GPUVertexFormat },
              { shaderLocation: 5, offset: 12, format: 'float32x2' as GPUVertexFormat },
              { shaderLocation: 6, offset: 20, format: 'float32x3' as GPUVertexFormat },
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
        cullMode,
      },
      depthStencil: {
        format: depthFormat,
        depthWriteEnabled: !blend,
        depthCompare,
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
