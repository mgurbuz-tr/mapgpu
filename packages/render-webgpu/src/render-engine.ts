/**
 * Render Engine — Facade
 *
 * WebGPU render core — IRenderEngine interface implementation.
 * Delegates all draw operations to focused delegate classes.
 * Owns lifecycle (init, beginFrame, endFrame, destroy, recover)
 * and shared GPU state (FrameContext).
 */

import type {
  CameraState,
  ClusterStyleConfig,
  CustomDrawCall,
  DepthConfig,
  ExtrudedPolygonSymbol,
  ExtrusionRenderBuffer,
  FeaturePickResult,
  GlobeImageryTile,
  GpuCapabilities,
  GpuMemoryAccounting,
  ImageryTile,
  LightConfig,
  LineRenderBuffer,
  LineSymbol,
  ModelRenderBuffer,
  ModelSymbol,
  PointRenderBuffer,
  PointSymbol,
  PolygonRenderBuffer,
  PolygonSymbol,
  TextRenderBuffer,
  TextSymbol,
} from '@mapgpu/core';
import { DEPTH_STANDARD } from '@mapgpu/core';
import { HeightBrush, createHeightTextureBindGroupLayout } from './height-brush.js';

import {
  detectCapabilities,
  type GpuCapabilities as InternalGpuCapabilities,
} from './capabilities.js';
import { BufferPool } from './buffer-pool.js';
import { TextureManager } from './texture-manager.js';
import { BindGroupCache } from './bind-group-cache.js';
import { createCameraBindGroupLayout } from './pipelines/raster-pipeline.js';
import { SpriteAtlas } from './sprite-atlas.js';
import { multiplyMat4 } from './gpu-math.js';
import { FrameContext, CAMERA_UNIFORM_SIZE } from './frame-context.js';

// ── Delegates ──
import { DrawDelegatePicking } from './draw-delegate-picking.js';
import { DrawDelegateRaster } from './draw-delegate-raster.js';
import { DrawDelegateGlobe } from './draw-delegate-globe.js';
import { DrawDelegateVector } from './draw-delegate-vector.js';
import { DrawDelegateModel } from './draw-delegate-model.js';
import { DrawDelegateCustom } from './draw-delegate-custom.js';
import { DrawDelegateCluster } from './draw-delegate-cluster.js';
import { DrawDelegateExtrusion } from './draw-delegate-extrusion.js';

export class RenderEngine {
  // ─── Shared State ───
  private readonly ctx = new FrameContext();

  // ─── Capabilities ───
  private _capabilities: GpuCapabilities | null = null;

  // ─── Resource Managers ───
  private textureManager: TextureManager | null = null;
  private bindGroupCache: BindGroupCache | null = null;
  private iconAtlas: SpriteAtlas | null = null;

  // ─── Delegates ───
  private pickingDelegate: DrawDelegatePicking | null = null;
  private rasterDelegate: DrawDelegateRaster | null = null;
  private globeDelegate: DrawDelegateGlobe | null = null;
  private vectorDelegate: DrawDelegateVector | null = null;
  private modelDelegate: DrawDelegateModel | null = null;
  private customDelegate: DrawDelegateCustom | null = null;
  private clusterDelegate: DrawDelegateCluster | null = null;
  private extrusionDelegate: DrawDelegateExtrusion | null = null;

  // ─── Clear Color ───
  private _clearColor = { r: 0.05, g: 0.05, b: 0.1, a: 1 };

  /**
   * Mevcut GPU yetenekleri.
   */
  get capabilities(): GpuCapabilities {
    if (!this._capabilities) {
      throw new Error('[mapgpu] RenderEngine not initialized. Call init() first.');
    }
    return this._capabilities;
  }

  /**
   * Expose depth config for pipeline creation.
   */
  get depthConfig(): DepthConfig {
    return this.ctx.depthConfig;
  }

  /**
   * Whether any delegate requested continuous rendering (e.g., active animation).
   * Checked by the render loop after endFrame to keep rendering.
   */
  get needsContinuousRender(): boolean {
    return this.ctx.needsContinuousRender;
  }

  // ── Icon Atlas (shared between vector and globe delegates) ──

  private ensureIconAtlas(): SpriteAtlas {
    if (!this.iconAtlas) {
      this.iconAtlas = new SpriteAtlas(this.ctx.device!);
    }
    return this.iconAtlas;
  }

  /**
   * WebGPU device init + capability detection.
   */
  async init(canvas: HTMLCanvasElement, depthConfig?: DepthConfig): Promise<GpuCapabilities> {
    this.ctx.canvas = canvas;
    this.ctx.depthConfig = depthConfig ?? DEPTH_STANDARD;

    // Capability detection
    const caps: InternalGpuCapabilities = await detectCapabilities();
    if (!caps.device || !caps.adapter) {
      this._capabilities = {
        mode: caps.mode,
        features: caps.features,
        limits: caps.limits,
      };
      return this._capabilities;
    }

    this.ctx.device = caps.device;

    // Device lost handling
    this.ctx.device.lost.then((info: GPUDeviceLostInfo) => {
      if (info.reason === 'destroyed') return;
      this.ctx.deviceLost = true;
      console.error(
        `[mapgpu] GPU device lost: ${info.reason} — ${info.message}`,
      );
    });

    // GPU validation error handler
    this.ctx.device.addEventListener('uncapturederror', (event: Event) => {
      const e = event as GPUUncapturedErrorEvent;
      console.error('[mapgpu] GPU VALIDATION ERROR:', e.error.message);
    });

    // Canvas context
    this.ctx.context = canvas.getContext('webgpu') as GPUCanvasContext;
    this.ctx.colorFormat = navigator.gpu.getPreferredCanvasFormat();
    this.ctx.context.configure({
      device: this.ctx.device,
      format: this.ctx.colorFormat,
      alphaMode: 'premultiplied',
    });

    // Resource managers
    this.ctx.bufferPool = new BufferPool(this.ctx.device);
    this.textureManager = new TextureManager(this.ctx.device);
    this.bindGroupCache = new BindGroupCache();
    this.ctx.bindGroupCache = this.bindGroupCache;

    // Camera uniform buffer (persistent)
    this.ctx.cameraBuffer = this.ctx.bufferPool.allocate(
      CAMERA_UNIFORM_SIZE,
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      'persistent',
    );

    // Camera bind group layout + bind group
    this.ctx.cameraBindGroupLayout = createCameraBindGroupLayout(this.ctx.device);
    this.ctx.cameraBindGroup = this.ctx.device.createBindGroup({
      label: 'camera-bind-group',
      layout: this.ctx.cameraBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.ctx.cameraBuffer },
        },
      ],
    });

    // MSAA color texture (multisampled render target — resolves to swap chain)
    this.ctx.msaaColorTexture = this.ctx.device.createTexture({
      label: 'msaa-color-texture',
      size: { width: canvas.width || 1, height: canvas.height || 1 },
      format: this.ctx.colorFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      sampleCount: this.ctx.sampleCount,
    });

    // Depth texture (must match MSAA sample count)
    this.ctx.depthTexture = this.ctx.device.createTexture({
      label: 'main-depth-texture',
      size: { width: canvas.width || 1, height: canvas.height || 1 },
      format: this.ctx.depthConfig.format as GPUTextureFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      sampleCount: this.ctx.sampleCount,
    });

    // Placeholder 1x1 white texture
    this.ctx.placeholderTexture = this.ctx.device.createTexture({
      label: 'placeholder-texture',
      size: { width: 1, height: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    this.ctx.device.queue.writeTexture(
      { texture: this.ctx.placeholderTexture },
      new Uint8Array([255, 255, 255, 255]),
      { bytesPerRow: 4 },
      { width: 1, height: 1 },
    );

    // Create delegates
    const getIconAtlas = () => this.ensureIconAtlas();
    this.pickingDelegate = new DrawDelegatePicking(this.ctx);
    this.rasterDelegate = new DrawDelegateRaster(this.ctx);
    this.globeDelegate = new DrawDelegateGlobe(this.ctx, getIconAtlas);
    this.vectorDelegate = new DrawDelegateVector(this.ctx, getIconAtlas);
    this.modelDelegate = new DrawDelegateModel(this.ctx);
    this.customDelegate = new DrawDelegateCustom(this.ctx);
    this.clusterDelegate = new DrawDelegateCluster(this.ctx);
    this.extrusionDelegate = new DrawDelegateExtrusion(this.ctx);

    // Eagerly init raster pipeline (most commonly used)
    this.rasterDelegate.initRasterPipeline();

    this._capabilities = {
      mode: caps.mode,
      features: caps.features,
      limits: caps.limits,
    };

    return this._capabilities;
  }

  /**
   * Clear color ayarla (RGBA, 0-1 araligi).
   */
  setClearColor(r: number, g: number, b: number, a: number): void {
    this._clearColor = { r, g, b, a };
  }

  /**
   * Toggle wireframe debug overlay on raster tiles.
   */
  setDebugTileVertices(enabled: boolean): void {
    this.ctx.debugTileVertices = enabled;
  }

  setExtrusionDebug(enabled: boolean): void {
    this.ctx.extrusionDebugMode = enabled;
  }

  setLighting(config: LightConfig): void {
    this.ctx.lightConfig = config;
  }

  applyDebugBrush(
    mercX: number,
    mercY: number,
    radius: number,
    strength: number,
    softness?: number,
  ): void {
    if (!this.ctx.device) return;
    if (!this.ctx.heightBrush) {
      const layout = createHeightTextureBindGroupLayout(this.ctx.device);
      this.ctx.heightBrush = new HeightBrush(this.ctx.device, layout);
    }
    this.ctx.heightBrush.apply(mercX, mercY, radius, strength, softness);
  }

  clearDebugBrush(): void {
    this.ctx.heightBrush?.clear();
  }

  setHeightExaggeration(factor: number): void {
    this.ctx.heightExaggeration = factor;
  }

  /**
   * Frame baslangici — camera uniform guncelle, render pass baslat.
   */
  beginFrame(camera: CameraState): void {
    if (!this.ctx.device || !this.ctx.context || this.ctx.deviceLost) return;

    this.ctx.frameTime += 1 / 60; // Approximate frame time for animations
    this.ctx.needsContinuousRender = false;
    this.ctx.pickingDrawCalls = [];
    this.ctx.currentCamera = camera;

    // Camera viewProjection matrix
    const vp = multiplyMat4(camera.projectionMatrix, camera.viewMatrix);

    // Write camera uniform: viewProjection (64 bytes) + viewport (8 bytes)
    const cameraData = new Float32Array(20); // 80 bytes
    cameraData.set(vp, 0);
    cameraData[16] = camera.viewportWidth;
    cameraData[17] = camera.viewportHeight;
    // [18..19] padding
    this.ctx.device.queue.writeBuffer(this.ctx.cameraBuffer!, 0, cameraData.buffer);

    // Write globe camera uniforms if globe pipeline is active
    if (this.ctx.globeCameraBuffer && camera.projectionTransition !== undefined) {
      const globeData = new Float32Array(40); // 160 bytes
      globeData.set(vp, 0);
      if (camera.flatViewProjectionMatrix) {
        globeData.set(camera.flatViewProjectionMatrix, 16);
      }
      globeData[32] = camera.viewportWidth;
      globeData[33] = camera.viewportHeight;
      globeData[34] = camera.projectionTransition;
      globeData[35] = camera.globeRadius ?? 1.0;
      if (camera.clippingPlane) {
        globeData[36] = camera.clippingPlane[0];
        globeData[37] = camera.clippingPlane[1];
        globeData[38] = camera.clippingPlane[2];
        globeData[39] = camera.clippingPlane[3];
      }
      this.ctx.device.queue.writeBuffer(this.ctx.globeCameraBuffer, 0, globeData.buffer);
    }

    // Flush height brush texture to GPU before draw calls
    this.ctx.heightBrush?.flush(this.ctx.device);

    // Ensure MSAA + depth texture sizes match canvas
    const cw = this.ctx.canvas?.width || 1;
    const ch = this.ctx.canvas?.height || 1;
    if (
      this.ctx.depthTexture &&
      (this.ctx.depthTexture.width !== cw || this.ctx.depthTexture.height !== ch)
    ) {
      this.ctx.depthTexture.destroy();
      this.ctx.depthTexture = this.ctx.device.createTexture({
        label: 'main-depth-texture',
        size: { width: cw, height: ch },
        format: this.ctx.depthConfig.format as GPUTextureFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        sampleCount: this.ctx.sampleCount,
      });

      if (this.ctx.msaaColorTexture) {
        this.ctx.msaaColorTexture.destroy();
        this.ctx.msaaColorTexture = this.ctx.device.createTexture({
          label: 'msaa-color-texture',
          size: { width: cw, height: ch },
          format: this.ctx.colorFormat,
          usage: GPUTextureUsage.RENDER_ATTACHMENT,
          sampleCount: this.ctx.sampleCount,
        });
      }
    }

    // Command encoder
    this.ctx.commandEncoder = this.ctx.device.createCommandEncoder({
      label: 'frame-command-encoder',
    });

    // Render pass — MSAA: render to multisampled texture, resolve to swap chain
    const swapChainView = this.ctx.context.getCurrentTexture().createView();
    const msaaView = this.ctx.msaaColorTexture?.createView();
    this.ctx.renderPass = this.ctx.commandEncoder.beginRenderPass({
      label: 'main-render-pass',
      colorAttachments: [
        msaaView
          ? {
              view: msaaView,
              resolveTarget: swapChainView,
              clearValue: this._clearColor,
              loadOp: 'clear',
              storeOp: 'discard', // MSAA samples discarded after resolve
            }
          : {
              view: swapChainView,
              clearValue: this._clearColor,
              loadOp: 'clear',
              storeOp: 'store',
            },
      ],
      depthStencilAttachment: this.ctx.depthTexture
        ? {
            view: this.ctx.depthTexture.createView(),
            depthClearValue: this.ctx.depthConfig.clearValue,
            depthLoadOp: 'clear',
            depthStoreOp: 'store',
          }
        : undefined,
    });
  }

  // ── Draw Methods (delegate one-liners) ──

  drawImagery(tile: ImageryTile): void {
    this.rasterDelegate?.drawImagery(tile);
  }

  drawGlobeTile(tile: GlobeImageryTile): void {
    this.rasterDelegate?.drawGlobeTile(tile);
  }

  drawPoleCaps(color: [number, number, number, number]): void {
    this.globeDelegate?.drawPoleCaps(color);
  }

  drawAtmosphere(strength: number): void {
    this.globeDelegate?.drawAtmosphere(strength);
  }

  drawGlobePoints(buffer: PointRenderBuffer, symbol: PointSymbol): void {
    this.globeDelegate?.drawGlobePoints(buffer, symbol);
  }

  drawGlobeLines(buffer: LineRenderBuffer, symbol: LineSymbol): void {
    this.globeDelegate?.drawGlobeLines(buffer, symbol);
  }

  drawGlobePolygons(buffer: PolygonRenderBuffer, symbol: PolygonSymbol): void {
    this.globeDelegate?.drawGlobePolygons(buffer, symbol);
  }

  drawPoints(buffer: PointRenderBuffer, symbol: PointSymbol): void {
    this.vectorDelegate?.drawPoints(buffer, symbol);
  }

  drawLines(buffer: LineRenderBuffer, symbol: LineSymbol): void {
    this.vectorDelegate?.drawLines(buffer, symbol);
  }

  drawPolygons(buffer: PolygonRenderBuffer, symbol: PolygonSymbol): void {
    this.vectorDelegate?.drawPolygons(buffer, symbol);
  }

  drawText(buffer: TextRenderBuffer, symbol: TextSymbol): void {
    this.vectorDelegate?.drawText(buffer, symbol);
  }

  drawPostProcess(sceneTexture: GPUTexture): void {
    this.vectorDelegate?.drawPostProcess(sceneTexture);
  }

  drawCustom(call: CustomDrawCall): void {
    this.customDelegate?.drawCustom(call);
  }

  async loadModel(id: string, source: ArrayBuffer | import('@mapgpu/core').GltfSource): Promise<void> {
    await this.modelDelegate?.loadModel(id, source);
  }

  drawModels(buffer: ModelRenderBuffer, symbol: ModelSymbol): void {
    this.modelDelegate?.drawModels(buffer, symbol);
  }

  drawGlobeModels(buffer: ModelRenderBuffer, symbol: ModelSymbol): void {
    this.modelDelegate?.drawGlobeModels(buffer, symbol);
  }

  drawExtrusion(buffer: ExtrusionRenderBuffer, symbol: ExtrudedPolygonSymbol): void {
    this.extrusionDelegate?.drawExtrusion(buffer, symbol);
  }

  drawGlobeExtrusion(buffer: ExtrusionRenderBuffer, symbol: ExtrudedPolygonSymbol): void {
    this.extrusionDelegate?.drawGlobeExtrusion(buffer, symbol);
  }

  setClusterSource(layerId: string, points: Float32Array, version: number): void {
    this.clusterDelegate?.setSource(layerId, points, version);
  }

  drawClusters(layerId: string, style: ClusterStyleConfig, clusterRadius: number, clusterMinPoints: number, zoom: number, extent: [number, number, number, number], globe: boolean): void {
    this.clusterDelegate?.drawClusters(layerId, style, clusterRadius, clusterMinPoints, zoom, extent, globe);
  }

  loadIcon(id: string, image: ImageBitmap): void {
    this.vectorDelegate?.loadIcon(id, image);
  }

  setCurrentLayerId(id: string): void {
    this.ctx.currentLayerId = id;
  }

  setPickingEnabled(enabled: boolean): void {
    this.ctx.pickingEnabled = enabled;
  }

  async pick(x: number, y: number): Promise<FeaturePickResult | null> {
    if (!this.ctx.pickingEnabled) return null;
    return this.pickingDelegate?.pick(x, y) ?? null;
  }

  /**
   * Frame bitisi — command buffer submit, transient buffer cleanup.
   */
  endFrame(): void {
    if (!this.ctx.device || !this.ctx.commandEncoder || !this.ctx.renderPass) return;

    this.ctx.renderPass.end();
    const commandBuffer = this.ctx.commandEncoder.finish();
    this.ctx.device.queue.submit([commandBuffer]);

    // Cleanup per-frame state
    this.ctx.commandEncoder = null;
    this.ctx.renderPass = null;

    // Transient buffer'lari serbest birak
    this.ctx.bufferPool?.releaseTransient();
  }

  // ── Buffer / Texture Management ──

  createTexture(image: ImageBitmap): GPUTexture {
    if (!this.textureManager) {
      throw new Error('[mapgpu] RenderEngine not initialized.');
    }
    return this.textureManager.createFromImageBitmap(image);
  }

  createBuffer(data: ArrayBufferView, usage: GPUBufferUsageFlags): GPUBuffer {
    if (!this.ctx.bufferPool) {
      throw new Error('[mapgpu] RenderEngine not initialized.');
    }
    return this.ctx.bufferPool.allocateWithData(data, usage, 'persistent');
  }

  writeBuffer(buffer: GPUBuffer, offset: number, data: ArrayBufferView): void {
    if (!this.ctx.device) return;
    this.ctx.device.queue.writeBuffer(buffer, offset, data.buffer, data.byteOffset, data.byteLength);
  }

  releaseBuffer(buffer: GPUBuffer): void {
    this.ctx.bufferPool?.release(buffer);
    this.bindGroupCache?.invalidate(`buf-${buffer.label ?? 'unknown'}`);
  }

  releaseTexture(texture: GPUTexture): void {
    this.textureManager?.release(texture);
    this.bindGroupCache?.invalidate(`tex-${texture.label ?? 'unknown'}`);
  }

  // ── Texture Creation ──

  createFloat32Texture(data: Float32Array, width: number, height: number): GPUTexture {
    if (!this.textureManager) throw new Error('RenderEngine not initialized');
    return this.textureManager.createFromFloat32(data, width, height);
  }

  createUint8Texture(data: Uint8Array, width: number, height: number): GPUTexture {
    if (!this.textureManager) throw new Error('RenderEngine not initialized');
    return this.textureManager.createFromUint8(data, width, height);
  }

  createRGBA8Texture(data: Uint8Array, width: number, height: number): GPUTexture {
    if (!this.textureManager) throw new Error('RenderEngine not initialized');
    return this.textureManager.createFromRGBA8(data, width, height);
  }

  // ── Diagnostics ──

  getMemoryAccounting(): GpuMemoryAccounting {
    const bufferAccounting = this.ctx.bufferPool?.getMemoryAccounting() ?? {
      persistentBufferBytes: 0,
      transientBufferBytes: 0,
      textureBytes: 0,
      totalTrackedBytes: 0,
    };

    const textureBytes = this.textureManager?.textureBytes ?? 0;

    return {
      persistentBufferBytes: bufferAccounting.persistentBufferBytes,
      transientBufferBytes: bufferAccounting.transientBufferBytes,
      textureBytes,
      totalTrackedBytes:
        bufferAccounting.persistentBufferBytes +
        bufferAccounting.transientBufferBytes +
        textureBytes,
    };
  }

  // ── Recovery ──

  async recover(depthConfig?: DepthConfig): Promise<void> {
    if (!this.ctx.canvas) {
      throw new Error('[mapgpu] Cannot recover: no canvas reference.');
    }

    // Destroy delegates
    this.pickingDelegate?.destroy();
    this.rasterDelegate?.destroy();
    this.globeDelegate?.destroy();
    this.vectorDelegate?.destroy();
    this.modelDelegate?.destroy();
    this.customDelegate?.destroy();
    this.clusterDelegate?.destroy();
    this.extrusionDelegate?.destroy();
    this.pickingDelegate = null;
    this.rasterDelegate = null;
    this.globeDelegate = null;
    this.vectorDelegate = null;
    this.modelDelegate = null;
    this.customDelegate = null;
    this.clusterDelegate = null;
    this.extrusionDelegate = null;

    // Reset shared state
    this.ctx.bufferPool = null;
    this.textureManager = null;
    this.bindGroupCache = null;
    this.ctx.bindGroupCache = null;
    this.iconAtlas = null;
    this.ctx.globeCameraBuffer = null;
    this.ctx.globeCameraBindGroup = null;
    this.ctx.globeCameraBindGroupLayout = null;
    this.ctx.cameraBuffer = null;
    this.ctx.cameraBindGroup = null;
    this.ctx.cameraBindGroupLayout = null;
    this.ctx.commandEncoder = null;
    this.ctx.renderPass = null;
    this.ctx.depthTexture = null;
    this.ctx.msaaColorTexture = null;
    this.ctx.placeholderTexture = null;
    this.ctx.device = null;
    this.ctx.context = null;
    this.ctx.deviceLost = false;
    this.ctx.pickingDrawCalls = [];

    await this.init(this.ctx.canvas, depthConfig ?? this.ctx.depthConfig);
  }

  // ── Lifecycle ──

  destroy(): void {
    this.ctx.renderPass = null;
    this.ctx.commandEncoder = null;

    this.ctx.bufferPool?.destroy();
    this.ctx.bufferPool = null;

    this.textureManager?.destroy();
    this.textureManager = null;

    this.bindGroupCache?.clear();
    this.bindGroupCache = null;
    this.ctx.bindGroupCache = null;

    // Destroy delegates
    this.pickingDelegate?.destroy();
    this.rasterDelegate?.destroy();
    this.globeDelegate?.destroy();
    this.vectorDelegate?.destroy();
    this.modelDelegate?.destroy();
    this.customDelegate?.destroy();
    this.clusterDelegate?.destroy();
    this.extrusionDelegate?.destroy();
    this.pickingDelegate = null;
    this.rasterDelegate = null;
    this.globeDelegate = null;
    this.vectorDelegate = null;
    this.modelDelegate = null;
    this.customDelegate = null;
    this.clusterDelegate = null;
    this.extrusionDelegate = null;
    this.iconAtlas = null;

    this.ctx.globeCameraBuffer = null;
    this.ctx.globeCameraBindGroup = null;
    this.ctx.globeCameraBindGroupLayout = null;

    this.ctx.depthTexture?.destroy();
    this.ctx.depthTexture = null;

    this.ctx.msaaColorTexture?.destroy();
    this.ctx.msaaColorTexture = null;

    this.ctx.placeholderTexture?.destroy();
    this.ctx.placeholderTexture = null;

    this.ctx.cameraBuffer = null;
    this.ctx.cameraBindGroup = null;
    this.ctx.cameraBindGroupLayout = null;

    this.ctx.context?.unconfigure();
    this.ctx.context = null;

    this.ctx.device?.destroy();
    this.ctx.device = null;

    this._capabilities = null;
    this.ctx.canvas = null;
    this.ctx.deviceLost = false;
    this.ctx.pickingDrawCalls = [];
  }
}
