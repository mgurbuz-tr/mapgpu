/**
 * Draw Delegate — Cluster (v2: CPU Clustering)
 *
 * Manages the cluster rendering lifecycle:
 * 1. Source buffer upload (persistent — survives across frames)
 * 2. CPU grid-hash clustering via gridCluster() — no GPU compute required
 * 3. Render dispatch (instanced billboard via drawIndirect)
 * 4. Canvas 2D digit atlas for readable count labels
 *
 * Key insight: render pipelines read `var<storage, read> clusters: array<ClusterOutput>`.
 * They don't know or care whether the data came from GPU compute or CPU.
 * Pipeline files (cluster-render-pipeline.ts, cluster-globe-render-pipeline.ts)
 * remain completely untouched.
 *
 * Eliminated:
 * - ClusterComputePipeline (no GPU compute dependency)
 * - cellsBuffer (no spatial hash on GPU)
 * - Render pass end/restart pattern (no compute pass interruption!)
 * - clearBuffer calls (no GPU-side state to reset)
 */

import type { ClusterStyleConfig } from '../core/index.js';
import type { FrameContext } from './frame-context.js';
import {
  createClusterRenderPipeline,
  type ClusterRenderPipeline,
} from './pipelines/cluster-render-pipeline.js';
import {
  createClusterGlobeRenderPipeline,
  type ClusterGlobeRenderPipeline,
} from './pipelines/cluster-globe-render-pipeline.js';
import { gridCluster, packClusterEntries, type CpuClusterResult } from './cpu-cluster.js';

// ─── Per-Layer State ───

interface ClusterLayerState {
  sourceBuffer: GPUBuffer;
  sourcePoints: Float32Array;      // CPU-side reference for clustering
  pointCount: number;
  sourceVersion: number;
  outputBuffer: GPUBuffer | null;
  outputCapacity: number;          // max entries the output buffer can hold
  countersBuffer: GPUBuffer;
  lastResult: CpuClusterResult | null;
  lastZoom: number;
  lastExtentKey: string;           // JSON key for cache comparison
  lastClusterRadius: number;
  lastMinClusterPoints: number;
}

// ─── Delegate ───

export class DrawDelegateCluster {
  // Render pipelines (lazy init)
  private renderPipeline2D: ClusterRenderPipeline | null = null;
  private renderPipelineGlobe: ClusterGlobeRenderPipeline | null = null;

  // Per-layer state
  private readonly layerStates = new Map<string, ClusterLayerState>();

  // Digit atlas texture (shared, init once)
  private digitAtlasTexture: GPUTexture | null = null;

  constructor(private readonly ctx: FrameContext) {}

  // ─── Source Upload ───

  setSource(layerId: string, points: Float32Array, version: number): void {
    if (!this.ctx.device) return;

    const existing = this.layerStates.get(layerId);
    if (existing?.sourceVersion === version) return; // No change

    // Destroy old source buffer
    existing?.sourceBuffer.destroy();

    const sourceBuffer = this.ctx.device.createBuffer({
      label: `cluster-source-${layerId}`,
      size: Math.max(points.byteLength, 4), // min 4 bytes for empty
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(sourceBuffer.getMappedRange()).set(points);
    sourceBuffer.unmap();

    // Counters buffer: 16 bytes = GPUDrawIndirectArgs (vertexCount, instanceCount, firstVertex, firstInstance)
    const countersBuffer = existing?.countersBuffer ?? this.ctx.device.createBuffer({
      label: `cluster-counters-${layerId}`,
      size: 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.INDIRECT,
    });

    this.layerStates.set(layerId, {
      sourceBuffer,
      sourcePoints: points,
      pointCount: points.length / 2,
      sourceVersion: version,
      outputBuffer: existing?.outputBuffer ?? null,
      outputCapacity: existing?.outputCapacity ?? 0,
      countersBuffer,
      lastResult: null,
      lastZoom: -1,
      lastExtentKey: '',
      lastClusterRadius: -1,
      lastMinClusterPoints: -1,
    });
  }

  // ─── CPU Cluster + Render ───

  drawClusters(
    layerId: string,
    style: ClusterStyleConfig,
    clusterRadius: number,
    clusterMinPoints: number,
    zoom: number,
    extent: [number, number, number, number],
    globe: boolean,
  ): void {
    const state = this.layerStates.get(layerId);
    if (!state || !this.ctx.device || !this.ctx.renderPass) return;
    if (state.pointCount === 0) return;

    // Ensure digit atlas
    this.digitAtlasTexture ??= this._createDigitAtlas();

    // ── CPU Clustering (with cache) ──

    const extentKey = `${extent[0]},${extent[1]},${extent[2]},${extent[3]}`;
    // Leaflet-like behavior: clustering updates on integer zoom levels.
    const clusterZoom = Math.max(0, Math.floor(zoom));
    const zoomInt = clusterZoom;
    const radiusInt = Math.round(clusterRadius * 100);

    if (
      !state.lastResult
      || state.lastZoom !== zoomInt
      || state.lastExtentKey !== extentKey
      || state.lastClusterRadius !== radiusInt
      || state.lastMinClusterPoints !== clusterMinPoints
    ) {
      state.lastResult = gridCluster(
        state.sourcePoints,
        clusterRadius,
        clusterZoom,
        extent,
        clusterMinPoints,
      );
      state.lastZoom = zoomInt;
      state.lastExtentKey = extentKey;
      state.lastClusterRadius = radiusInt;
      state.lastMinClusterPoints = clusterMinPoints;
    }

    const result = state.lastResult;
    const entryCount = result.entries.length;
    if (entryCount === 0) return;

    // ── Pack entries → GPU buffer ──

    const packed = packClusterEntries(result.entries);

    // Resize output buffer if needed
    if (!state.outputBuffer || state.outputCapacity < entryCount) {
      state.outputBuffer?.destroy();
      const newCapacity = Math.max(entryCount, 64); // min 64 entries
      state.outputBuffer = this.ctx.device.createBuffer({
        label: `cluster-output-${layerId}`,
        size: newCapacity * 16, // 16 bytes per ClusterOutput
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
      state.outputCapacity = newCapacity;
    }

    // Write cluster data — no render pass end/restart needed!
    this.ctx.device.queue.writeBuffer(state.outputBuffer, 0, packed.buffer);

    // Write indirect args: vertexCount=6, instanceCount=N, firstVertex=0, firstInstance=0
    const counterData = new Uint32Array([6, entryCount, 0, 0]);
    this.ctx.device.queue.writeBuffer(state.countersBuffer, 0, counterData.buffer);

    // ── Material Uniform ──

    const materialData = new Float32Array(36); // 144 bytes
    materialData[0] = style.clusterFillSmall[0] / 255;
    materialData[1] = style.clusterFillSmall[1] / 255;
    materialData[2] = style.clusterFillSmall[2] / 255;
    materialData[3] = style.clusterFillSmall[3] / 255;
    materialData[4] = style.clusterFillMedium[0] / 255;
    materialData[5] = style.clusterFillMedium[1] / 255;
    materialData[6] = style.clusterFillMedium[2] / 255;
    materialData[7] = style.clusterFillMedium[3] / 255;
    materialData[8] = style.clusterFillLarge[0] / 255;
    materialData[9] = style.clusterFillLarge[1] / 255;
    materialData[10] = style.clusterFillLarge[2] / 255;
    materialData[11] = style.clusterFillLarge[3] / 255;
    materialData[12] = style.clusterStroke[0] / 255;
    materialData[13] = style.clusterStroke[1] / 255;
    materialData[14] = style.clusterStroke[2] / 255;
    materialData[15] = style.clusterStroke[3] / 255;
    materialData[16] = style.clusterText[0] / 255;
    materialData[17] = style.clusterText[1] / 255;
    materialData[18] = style.clusterText[2] / 255;
    materialData[19] = style.clusterText[3] / 255;
    materialData[20] = style.pointFill[0] / 255;
    materialData[21] = style.pointFill[1] / 255;
    materialData[22] = style.pointFill[2] / 255;
    materialData[23] = style.pointFill[3] / 255;
    materialData[24] = style.pointStroke[0] / 255;
    materialData[25] = style.pointStroke[1] / 255;
    materialData[26] = style.pointStroke[2] / 255;
    materialData[27] = style.pointStroke[3] / 255;
    materialData[28] = style.pointSize;
    materialData[29] = style.pointStrokeWidth;
    materialData[30] = style.clusterBaseSize;
    materialData[31] = style.clusterGrowRate;
    materialData[32] = style.clusterStrokeWidth;
    materialData[33] = 0; // padding
    materialData[34] = 0; // padding
    materialData[35] = 0; // padding

    const materialBuffer = this.ctx.bufferPool!.allocateWithData(
      materialData,
      GPUBufferUsage.UNIFORM,
      'transient',
    );

    if (globe) {
      this._drawGlobe(state, materialBuffer);
    } else {
      this._draw2D(state, materialBuffer);
    }
  }

  // ─── 2D Render ───

  private _draw2D(state: ClusterLayerState, materialBuffer: GPUBuffer): void {
    if (!this.ctx.device || !this.ctx.renderPass) return;

    this.renderPipeline2D ??= createClusterRenderPipeline({
      device: this.ctx.device,
      colorFormat: this.ctx.colorFormat,
      cameraBindGroupLayout: this.ctx.cameraBindGroupLayout!,
      depthFormat: this.ctx.depthConfig.format,
      depthCompare: this.ctx.depthConfig.compareFunc,
      sampleCount: this.ctx.sampleCount,
    });

    const renderBindGroup = this.ctx.device.createBindGroup({
      label: 'cluster-render-bind-group',
      layout: this.renderPipeline2D.renderBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: state.outputBuffer! } },
        { binding: 1, resource: { buffer: materialBuffer } },
        { binding: 2, resource: this.digitAtlasTexture!.createView() },
        { binding: 3, resource: this.renderPipeline2D.sampler },
      ],
    });

    this.ctx.renderPass.setPipeline(this.renderPipeline2D.pipeline);
    this.ctx.renderPass.setBindGroup(0, this.ctx.cameraBindGroup!);
    this.ctx.renderPass.setBindGroup(1, renderBindGroup);
    this.ctx.renderPass.drawIndirect(state.countersBuffer, 0);
  }

  // ─── Globe Render ───

  private _drawGlobe(state: ClusterLayerState, materialBuffer: GPUBuffer): void {
    if (!this.ctx.device || !this.ctx.renderPass) return;

    this.ctx.ensureGlobeCameraResources();
    this.ctx.ensureGlobeCameraWritten();

    this.renderPipelineGlobe ??= createClusterGlobeRenderPipeline({
      device: this.ctx.device,
      colorFormat: this.ctx.colorFormat,
      globeCameraBindGroupLayout: this.ctx.globeCameraBindGroupLayout!,
      depthFormat: this.ctx.depthConfig.format,
      depthCompare: this.ctx.depthConfig.compareFunc,
      sampleCount: this.ctx.sampleCount,
    });

    const renderBindGroup = this.ctx.device.createBindGroup({
      label: 'cluster-globe-render-bind-group',
      layout: this.renderPipelineGlobe.renderBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: state.outputBuffer! } },
        { binding: 1, resource: { buffer: materialBuffer } },
        { binding: 2, resource: this.digitAtlasTexture!.createView() },
        { binding: 3, resource: this.renderPipelineGlobe.sampler },
      ],
    });

    this.ctx.renderPass.setPipeline(this.renderPipelineGlobe.pipeline);
    this.ctx.renderPass.setBindGroup(0, this.ctx.globeCameraBindGroup!);
    this.ctx.renderPass.setBindGroup(1, renderBindGroup);
    this.ctx.renderPass.drawIndirect(state.countersBuffer, 0);
  }

  // ─── Digit Atlas (Canvas 2D) ───

  /**
   * Create a high-resolution RGBA texture containing digits 0-9.
   * Each digit occupies one square cell. Rendered via Canvas 2D with stroked text
   * for crisp, anti-aliased, readable text at all zoom levels.
   */
  private _createDigitAtlas(): GPUTexture {
    const CELL = 64;
    const W = 10 * CELL;
    const H = CELL;
    let data: Uint8Array;

    if (typeof OffscreenCanvas === 'undefined') {
      // ── Fallback: procedural bitmap (test/headless) ──
      data = this._createBitmapDigitAtlas(W, H, CELL);
    } else {
      // ── Canvas 2D rendering (browser) ──
      // Canvas 2D is Y-down, but GPU textures are Y-up (V=0 at bottom).
      // We flip the rows after getImageData so the shader's atlasV maps correctly.
      const canvas = new OffscreenCanvas(W, H);
      const ctx2d = canvas.getContext('2d')!;
      ctx2d.clearRect(0, 0, W, H);
      ctx2d.font = '700 46px "Roboto Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
      ctx2d.textAlign = 'center';
      ctx2d.textBaseline = 'middle';
      ctx2d.lineJoin = 'round';
      ctx2d.lineCap = 'round';
      ctx2d.lineWidth = 7;
      ctx2d.strokeStyle = 'rgba(4, 10, 20, 0.92)';
      ctx2d.fillStyle = 'white';
      for (let d = 0; d < 10; d++) {
        const x = d * CELL + CELL * 0.5;
        const y = H * 0.52;
        const glyph = String(d);
        ctx2d.strokeText(glyph, x, y);
        ctx2d.fillText(glyph, x, y);
      }
      const imageData = ctx2d.getImageData(0, 0, W, H);
      // Flip rows vertically (Y-down → Y-up)
      const src = new Uint8Array(imageData.data.buffer);
      data = new Uint8Array(src.length);
      const rowBytes = W * 4;
      for (let row = 0; row < H; row++) {
        const srcOffset = row * rowBytes;
        const dstOffset = (H - 1 - row) * rowBytes;
        data.set(src.subarray(srcOffset, srcOffset + rowBytes), dstOffset);
      }
    }

    const texture = this.ctx.device!.createTexture({
      label: 'cluster-digit-atlas',
      size: { width: W, height: H },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    this.ctx.device!.queue.writeTexture(
      { texture },
      data.buffer,
      { bytesPerRow: W * 4 },
      { width: W, height: H },
    );

    return texture;
  }

  /**
   * Fallback bitmap digit atlas for environments without OffscreenCanvas.
   * Scaled 5×7 bitmap font to fill dynamic cells.
   */
  private _createBitmapDigitAtlas(W: number, H: number, cell: number): Uint8Array { // NOSONAR
    const data = new Uint8Array(W * H * 4);
    const glyphs: number[][] = [
      [0x0E, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0E],
      [0x04, 0x0C, 0x04, 0x04, 0x04, 0x04, 0x0E],
      [0x0E, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1F],
      [0x0E, 0x11, 0x01, 0x06, 0x01, 0x11, 0x0E],
      [0x02, 0x06, 0x0A, 0x12, 0x1F, 0x02, 0x02],
      [0x1F, 0x10, 0x1E, 0x01, 0x01, 0x11, 0x0E],
      [0x06, 0x08, 0x10, 0x1E, 0x11, 0x11, 0x0E],
      [0x1F, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
      [0x0E, 0x11, 0x11, 0x0E, 0x11, 0x11, 0x0E],
      [0x0E, 0x11, 0x11, 0x0F, 0x01, 0x02, 0x0C],
    ];
    const scale = Math.max(3, Math.floor(cell / 9));
    const glyphW = 5 * scale;
    const glyphH = 7 * scale;
    for (let digit = 0; digit < 10; digit++) {
      const glyph = glyphs[digit]!;
      const cellX = digit * cell;
      const startX = cellX + Math.floor((cell - glyphW) / 2);
      const startY = Math.floor((H - glyphH) / 2);
      for (let row = 0; row < 7; row++) {
        const bits = glyph[row]!;
        for (let col = 0; col < 5; col++) {
          if (bits & (1 << (4 - col))) {
            for (let sy = 0; sy < scale; sy++) {
              for (let sx = 0; sx < scale; sx++) {
                const px = startX + col * scale + sx;
                const pyDown = startY + row * scale + sy;
                const py = H - 1 - pyDown; // flip Y for GPU texture (Y-up)
                if (px < W && py >= 0 && py < H) {
                  const idx = (py * W + px) * 4;
                  data[idx] = 255;
                  data[idx + 1] = 255;
                  data[idx + 2] = 255;
                  data[idx + 3] = 255;
                }
              }
            }
          }
        }
      }
    }
    return data;
  }

  // ─── Lifecycle ───

  destroy(): void {
    for (const state of this.layerStates.values()) {
      state.sourceBuffer.destroy();
      state.outputBuffer?.destroy();
      state.countersBuffer.destroy();
    }
    this.layerStates.clear();

    this.digitAtlasTexture?.destroy();
    this.digitAtlasTexture = null;

    this.renderPipeline2D = null;
    this.renderPipelineGlobe = null;
  }
}
