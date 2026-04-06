/**
 * Draw Delegate — Extrusion
 *
 * Handles extruded polygon (3D building) rendering for both 2D and globe modes.
 * Follows the same lazy-init delegate pattern as DrawDelegateVector.
 *
 * 2D material uniform layout (64 bytes, 16 floats):
 *   color: vec4<f32>       [0..15]
 *   ambient: f32           [16..19]
 *   debugMode: f32         [20..23]
 *   animProgress: f32      [24..27]
 *   animDuration: f32      [28..31]
 *   waveOrigin: vec2<f32>  [32..39]
 *   delayFactor: f32       [40..43]
 *   bearing: f32           [44..47]
 *   shininess: f32         [48..51]
 *   specularStrength: f32  [52..55]
 *   _pad1: f32             [56..59]
 *   _pad2: f32             [60..63]
 *
 * Globe material uniform layout (80 bytes, 20 floats):
 *   (same as 2D layout for first 16 floats)
 *   cameraPos: vec4<f32>   [64..79]  — xyz = Mercator [0..1] camera position
 */

import type { ExtrusionRenderBuffer, ExtrudedPolygonSymbol } from '@mapgpu/core';

import {
  createExtrusionPipeline,
  type ExtrusionPipeline,
} from './pipelines/extrusion-pipeline.js';
import {
  createGlobeExtrusionPipeline,
  type GlobeExtrusionPipeline,
} from './pipelines/globe-extrusion-pipeline.js';
import type { FrameContext } from './frame-context.js';

interface CachedUniformResource {
  buffer: GPUBuffer;
  resourceId: string;
}

export class DrawDelegateExtrusion {
  private extrusionPipeline: ExtrusionPipeline | null = null;
  private globeExtrusionPipeline: GlobeExtrusionPipeline | null = null;
  private extrusionMaterials = new Map<string, CachedUniformResource>();
  private globeExtrusionMaterials = new Map<string, CachedUniformResource>();
  /** Tracks animation start per stable id (tileKey) or GPUBuffer fallback */
  private animState = new Map<string, { startTime: number; origin: [number, number] }>();
  /** Tile IDs whose grow animation has completed — never re-animate */
  private animCompleted = new Set<string>();

  constructor(private readonly ctx: FrameContext) {}

  // ── Lazy Pipeline Init ──

  private ensureExtrusionPipeline(): ExtrusionPipeline {
    if (!this.extrusionPipeline) {
      this.extrusionPipeline = createExtrusionPipeline({
        device: this.ctx.device!,
        colorFormat: this.ctx.colorFormat,
        cameraBindGroupLayout: this.ctx.cameraBindGroupLayout!,
        depthFormat: this.ctx.depthConfig.format as GPUTextureFormat,
        depthCompare: this.ctx.depthConfig.compareFunc,
        sampleCount: this.ctx.sampleCount,
      });
    }
    return this.extrusionPipeline;
  }

  private ensureGlobeExtrusionPipeline(): GlobeExtrusionPipeline {
    if (!this.globeExtrusionPipeline) {
      this.ctx.ensureGlobeCameraResources();
      this.globeExtrusionPipeline = createGlobeExtrusionPipeline({
        device: this.ctx.device!,
        colorFormat: this.ctx.colorFormat,
        globeCameraBindGroupLayout: this.ctx.globeCameraBindGroupLayout!,
        depthFormat: this.ctx.depthConfig.format as GPUTextureFormat,
        depthCompare: this.ctx.depthConfig.compareFunc,
        sampleCount: this.ctx.sampleCount,
      });
    }
    return this.globeExtrusionPipeline;
  }

  // ── Draw Methods ──

  drawExtrusion(buffer: ExtrusionRenderBuffer, symbol: ExtrudedPolygonSymbol): void {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.cameraBindGroup || !this.ctx.bufferPool) {
      return;
    }
    const pipeline = this.ensureExtrusionPipeline();
    const material = this._createMaterialResource(
      this.extrusionMaterials,
      symbol,
      'extrusion-material',
      buffer,
    );
    const materialBindGroup = this.getOrCreateBindGroup(
      `extrusion:${symbol.color.join(',')}:${symbol.ambient ?? 0.35}`,
      [material.resourceId],
      () => this.ctx.device!.createBindGroup({
        label: 'extrusion-material-bind-group',
        layout: pipeline.materialBindGroupLayout,
        entries: [{ binding: 0, resource: { buffer: material.buffer } }],
      }),
    );

    this.ctx.renderPass.setPipeline(pipeline.pipeline);
    this.ctx.renderPass.setBindGroup(0, this.ctx.cameraBindGroup);
    this.ctx.renderPass.setBindGroup(1, materialBindGroup);
    this.ctx.renderPass.setVertexBuffer(0, buffer.vertexBuffer);
    this.ctx.renderPass.setIndexBuffer(buffer.indexBuffer, 'uint32');
    this.ctx.renderPass.drawIndexed(buffer.indexCount);
  }

  drawGlobeExtrusion(buffer: ExtrusionRenderBuffer, symbol: ExtrudedPolygonSymbol): void {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.bufferPool) {
      return;
    }

    const pipeline = this.ensureGlobeExtrusionPipeline();
    this.ctx.ensureGlobeCameraWritten();

    const material = this._createMaterialResource(
      this.globeExtrusionMaterials,
      symbol,
      'globe-extrusion-material',
      buffer,
      true, // isGlobe — 80-byte material with cameraPos
    );
    const materialBindGroup = this.getOrCreateBindGroup(
      `globe-extrusion:${symbol.color.join(',')}:${symbol.ambient ?? 0.35}`,
      [material.resourceId],
      () => this.ctx.device!.createBindGroup({
        label: 'globe-extrusion-material-bind-group',
        layout: pipeline.materialBindGroupLayout,
        entries: [{ binding: 0, resource: { buffer: material.buffer } }],
      }),
    );

    this.ctx.renderPass.setPipeline(pipeline.pipeline);
    this.ctx.renderPass.setBindGroup(0, this.ctx.globeCameraBindGroup!);
    this.ctx.renderPass.setBindGroup(1, materialBindGroup);
    this.ctx.renderPass.setVertexBuffer(0, buffer.vertexBuffer);
    this.ctx.renderPass.setIndexBuffer(buffer.indexBuffer, 'uint32');
    this.ctx.renderPass.drawIndexed(buffer.indexCount);
  }

  // ── Private ──

  private _createMaterialResource(
    cache: Map<string, CachedUniformResource>,
    symbol: ExtrudedPolygonSymbol,
    labelPrefix: string,
    buffer: ExtrusionRenderBuffer,
    isGlobe = false,
  ): CachedUniformResource {
    const debug = this.ctx.extrusionDebugMode ? 1 : 0;
    const anim = symbol.animation;
    const animDuration = anim ? (anim.duration ?? 800) / 1000 : 0;
    const delayFactor = anim?.delayFactor ?? 2.0;

    // Camera rotation (bearing) for rotation-aware oblique offset
    const cam = this.ctx.currentCamera;
    // CameraController2D stores rotation as map rotation in radians.
    // For oblique projection, the bearing determines the offset direction.
    // We extract it from the view matrix: atan2(view[1], view[0]) gives -rotation.
    let bearing = 0;
    if (cam) {
      bearing = Math.atan2(cam.viewMatrix[1]!, cam.viewMatrix[0]!);
    }

    // Track animation start time per stable tile id (or buffer pointer fallback).
    // Once an animation completes for a given id, it never replays — even if
    // the GPU buffer is recreated (e.g. zoom change invalidates tile cache).
    let animProgress = 0;
    let waveOriginX = 0.5;
    let waveOriginY = 0.5;
    // Effective animDuration: 0 if this tile already completed its animation
    const animId = buffer.id ?? `buf:${buffer.vertexBuffer.label ?? String(this.animState.size)}`;
    let effectiveAnimDuration = animDuration;
    if (animDuration > 0 && this.animCompleted.has(animId)) {
      effectiveAnimDuration = 0; // already played — render fully grown
    }
    if (effectiveAnimDuration > 0) {
      let state = this.animState.get(animId);
      if (!state) {
        // Compute wave origin from camera position → merc01
        if (cam) {
          const HALF_C = 20037508.34;
          waveOriginX = (cam.position[0] + HALF_C) / (2 * HALF_C);
          waveOriginY = 1.0 - (cam.position[1] + HALF_C) / (2 * HALF_C);
        }
        state = { startTime: this.ctx.frameTime, origin: [waveOriginX, waveOriginY] };
        this.animState.set(animId, state);
      }
      animProgress = this.ctx.frameTime - state.startTime;
      waveOriginX = state.origin[0];
      waveOriginY = state.origin[1];

      // Max possible delay = sqrt(2) * delayFactor (diagonal of merc01 unit square)
      const maxDelay = 1.4142 * delayFactor;
      if (animProgress < effectiveAnimDuration + maxDelay) {
        this.ctx.needsContinuousRender = true;
      } else {
        // Animation done — mark as completed so it never replays
        this.animCompleted.add(animId);
      }
    }

    // For animated tiles, bypass cache (progress changes each frame).
    // Key MUST include symbol.color — otherwise all ClassBreaksRenderer
    // groups for the same tile share one material and get the same color.
    const isAnimating = effectiveAnimDuration > 0 && this.ctx.needsContinuousRender;
    const colorKey = symbol.color.join(',');
    const key = isAnimating
      ? `${labelPrefix}:anim:${animId}:${colorKey}:${this.ctx.frameTime}`
      : [colorKey, symbol.ambient ?? 0.35, debug].join(':');

    // Globe material: 20 floats (80 bytes) — includes cameraPos vec4
    // 2D material:    16 floats (64 bytes)
    const floatCount = isGlobe ? 20 : 16;
    const data = new Float32Array(floatCount);
    data[0] = symbol.color[0] / 255;
    data[1] = symbol.color[1] / 255;
    data[2] = symbol.color[2] / 255;
    data[3] = symbol.color[3] / 255;
    data[4] = symbol.ambient ?? 0.35;
    data[5] = debug;
    data[6] = animProgress;
    data[7] = effectiveAnimDuration;
    data[8] = waveOriginX;
    data[9] = waveOriginY;
    data[10] = delayFactor;
    data[11] = isGlobe ? 0 : bearing; // bearing only used by 2D pipeline
    data[12] = symbol.shininess ?? 32;
    data[13] = symbol.specularStrength ?? 0.15;
    // data[14] = _pad1
    // data[15] = _pad2

    // Globe: write camera position in Mercator [0..1] for flat-path specular
    if (isGlobe && cam?.cameraMerc01) {
      data[16] = cam.cameraMerc01[0]; // cx
      data[17] = cam.cameraMerc01[1]; // cy
      data[18] = cam.cameraMerc01[2]; // mercDist (height)
      // data[19] = 0 (w padding)
    }

    return this.getOrCreateMaterialResource(
      cache,
      key,
      data,
      labelPrefix,
    );
  }

  private getOrCreateMaterialResource(
    cache: Map<string, CachedUniformResource>,
    key: string,
    data: Float32Array,
    labelPrefix: string,
  ): CachedUniformResource {
    let cached = cache.get(key);
    if (!cached) {
      const buffer = this.ctx.bufferPool!.allocate(
        data.byteLength,
        GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        'persistent',
      );
      buffer.label = `${labelPrefix}:${key}`;
      cached = {
        buffer,
        resourceId: `buf-${buffer.label ?? `${labelPrefix}:${key}`}`,
      };
      cache.set(key, cached);
    }

    this.ctx.device!.queue.writeBuffer(
      cached.buffer,
      0,
      data.buffer,
      data.byteOffset,
      data.byteLength,
    );
    return cached;
  }

  private getOrCreateBindGroup(
    pipelineId: string,
    resourceIds: string[],
    create: () => GPUBindGroup,
  ): GPUBindGroup {
    return this.ctx.bindGroupCache?.getOrCreate({ pipelineId, resourceIds }, create) ?? create();
  }

  private releaseMaterials(cache: Map<string, CachedUniformResource>): void {
    for (const { buffer } of cache.values()) {
      this.ctx.bufferPool?.release(buffer);
    }
    cache.clear();
  }

  destroy(): void {
    this.extrusionPipeline = null;
    this.globeExtrusionPipeline = null;
    this.releaseMaterials(this.extrusionMaterials);
    this.releaseMaterials(this.globeExtrusionMaterials);
    this.animState.clear();
    this.animCompleted.clear();
  }
}
