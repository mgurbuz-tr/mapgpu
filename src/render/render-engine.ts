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
  Mesh3DRenderBuffer,
  Mesh3DSymbol,
  FeaturePickResult,
  GlobeImageryTile,
  GltfSource,
  GpuCapabilities,
  GpuMemoryAccounting,
  ImageryTile,
  LightConfig,
  LineRenderBuffer,
  LineSymbol,
  ModelBoundsQuery,
  ModelMetadata,
  ModelRenderBuffer,
  ModelSymbol,
  PointRenderBuffer,
  PointSymbol,
  PolygonRenderBuffer,
  PolygonSymbol,
  ResolvedSkyConfig,
  ResolvedModelBounds,
  TextRenderBuffer,
  TextSymbol,
} from '../core/index.js';
import { DEPTH_STANDARD } from '../core/index.js';
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
import { createTranslationMat4, multiplyMat4 } from './gpu-math.js';
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
import { DrawDelegateMesh3D } from './draw-delegate-mesh3d.js';
import { DrawDelegateParticle } from './draw-delegate-particle.js';
import type { ParticleLayer } from '../layers/ParticleLayer.js';
import {
  createSilhouetteCompositePipeline,
  SILHOUETTE_COMPOSITE_UNIFORM_SIZE,
  writeSilhouetteCompositeUniform,
  type SilhouetteCompositePipeline,
} from './pipelines/silhouette-composite-pipeline.js';

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
  private _gltf2Renderer: import('./gltf2-renderer.js').Gltf2Renderer | null = null;
  // ── Silhouette composite (lazy, created on first model with outline) ──
  private _silhouetteCompositePipeline: SilhouetteCompositePipeline | null = null;
  private _silhouetteCompositeUniformBuffer: GPUBuffer | null = null;
  private readonly _silhouetteCompositeUniformData = new Float32Array(SILHOUETTE_COMPOSITE_UNIFORM_SIZE / 4);
  private customDelegate: DrawDelegateCustom | null = null;
  private clusterDelegate: DrawDelegateCluster | null = null;
  private extrusionDelegate: DrawDelegateExtrusion | null = null;
  private mesh3dDelegate: DrawDelegateMesh3D | null = null;
  private particleDelegate: DrawDelegateParticle | null = null;

  /**
   * Shared worker registry — owned by ViewCore, passed in by MapView after
   * GPU init. Forwarded to delegates that can offload CPU work to workers
   * (currently Gltf2Renderer for off-thread GLB parse). Null until wired.
   */
  private _workerRegistry: import('../core/engine/WorkerPoolRegistry.js').WorkerPoolRegistry | null = null;
  private readonly loadedModelSources = new Map<string, ArrayBuffer | GltfSource>();
  private readonly loadedModelV2Sources = new Map<string, string | ArrayBuffer>();

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
    this.iconAtlas ??= new SpriteAtlas(this.ctx.device!);
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
      format: this.ctx.depthConfig.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      sampleCount: this.ctx.sampleCount,
    });

    // Silhouette mask (single-channel, single-sample, sampled by composite)
    this.ctx.silhouetteMaskTexture = this.ctx.device.createTexture({
      label: 'silhouette-mask-texture',
      size: { width: canvas.width || 1, height: canvas.height || 1 },
      format: 'r8unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      sampleCount: 1,
    });
    this.ctx.silhouetteMaskView = this.ctx.silhouetteMaskTexture.createView();

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
    // Standalone GLTF2 renderer with correct depth & lighting
    if (this.ctx.device) {
      const { Gltf2Renderer } = await import('./gltf2-renderer.js');
      this._gltf2Renderer = new Gltf2Renderer(this.ctx.device);
      // If a worker registry was set before GPU init (unusual order),
      // forward it now so the renderer picks up the worker path on its
      // first loadModel call.
      if (this._workerRegistry) {
        this._gltf2Renderer.setWorkerRegistry(this._workerRegistry);
      }
    }
    this.customDelegate = new DrawDelegateCustom(this.ctx);
    this.clusterDelegate = new DrawDelegateCluster(this.ctx);
    this.extrusionDelegate = new DrawDelegateExtrusion(this.ctx);
    this.mesh3dDelegate = new DrawDelegateMesh3D(this.ctx);
    this.particleDelegate = new DrawDelegateParticle(this.ctx);

    // Eagerly init raster pipeline (most commonly used)
    this.rasterDelegate.initRasterPipeline();

    this._capabilities = {
      mode: caps.mode,
      features: caps.features,
      limits: caps.limits,
    };

    await this.restoreLoadedModels();

    return this._capabilities;
  }

  /**
   * The underlying WebGPU device, or `null` if the engine has not been
   * initialized (or is running in headless mode without WebGPU support).
   *
   * Exposed for advanced use cases — primarily custom WGSL layers that
   * need to allocate their own `GPUBuffer` / `GPUTexture` instances.
   */
  get device(): GPUDevice | null {
    return this.ctx.device;
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
   * Frame baslangici — camera uniform guncelle, per-frame attachments hazirla.
   */
  beginFrame(camera: CameraState): void {
    if (!this.ctx.device || !this.ctx.context || this.ctx.deviceLost) return;

    this.ctx.frameTime += 1 / 60; // Approximate frame time for animations
    this.ctx.needsContinuousRender = false;
    this.ctx.pickingDrawCalls = [];
    this.ctx.currentCamera = camera;
    // Reset Gltf2Renderer's per-frame mask draw queue. Models will re-add
    // themselves to the queue inside drawFlat/drawGlobe as scene rendering
    // happens; the queue is replayed in endFrame's silhouette mask pass.
    this._gltf2Renderer?.beginFrame();

    // Camera viewProjection matrix
    const vp = multiplyMat4(camera.projectionMatrix, camera.viewMatrix);

    const worldOrigin = camera.position;
    const relativeVP = multiplyMat4(
      vp,
      createTranslationMat4(worldOrigin[0] ?? 0, worldOrigin[1] ?? 0, worldOrigin[2] ?? 0),
    );

    // Write camera uniform: VP + viewport + relative VP + world origin
    const cameraData = new Float32Array(40); // 160 bytes
    cameraData.set(vp, 0);
    cameraData[16] = camera.viewportWidth;
    cameraData[17] = camera.viewportHeight;
    cameraData.set(relativeVP, 20);
    cameraData[36] = worldOrigin[0] ?? 0;
    cameraData[37] = worldOrigin[1] ?? 0;
    cameraData[38] = worldOrigin[2] ?? 0;
    this.ctx.device.queue.writeBuffer(this.ctx.cameraBuffer!, 0, cameraData.buffer);

    // Write globe camera uniforms if globe pipeline is active.
    // The buffer layout is owned by FrameContext so delegate-time writes and
    // frame-start writes stay byte-for-byte identical.
    if (this.ctx.globeCameraBuffer && camera.projectionTransition !== undefined) {
      this.ctx.writeGlobeCamera(camera);
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
        format: this.ctx.depthConfig.format,
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

      if (this.ctx.silhouetteMaskTexture) {
        this.ctx.silhouetteMaskTexture.destroy();
        this.ctx.silhouetteMaskTexture = this.ctx.device.createTexture({
          label: 'silhouette-mask-texture',
          size: { width: cw, height: ch },
          format: 'r8unorm',
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
          sampleCount: 1,
        });
        this.ctx.silhouetteMaskView = this.ctx.silhouetteMaskTexture.createView();
      }
    }

    // Command encoder
    this.ctx.commandEncoder = this.ctx.device.createCommandEncoder({
      label: 'frame-command-encoder',
    });

    this.ctx.swapChainView = this.ctx.context.getCurrentTexture().createView();
    this.ctx.msaaColorView = this.ctx.msaaColorTexture?.createView() ?? null;
    this.ctx.depthView = this.ctx.depthTexture?.createView() ?? null;
    this.ctx.backgroundPass = null;
    this.ctx.renderPass = null;
  }

  /**
   * Lazily create the silhouette composite pipeline + uniform buffer.
   * Called the first time a frame contains a Gltf2 model with outline.
   */
  private ensureSilhouetteCompositeResources(): SilhouetteCompositePipeline | null {
    if (this._silhouetteCompositePipeline) return this._silhouetteCompositePipeline;
    if (!this.ctx.device) return null;

    this._silhouetteCompositePipeline = createSilhouetteCompositePipeline({
      device: this.ctx.device,
      colorFormat: this.ctx.colorFormat,
    });
    this._silhouetteCompositeUniformBuffer = this.ctx.device.createBuffer({
      label: 'silhouette-composite-uniform',
      size: SILHOUETTE_COMPOSITE_UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    return this._silhouetteCompositePipeline;
  }

  /**
   * Two sub-passes that produce the Cesium-style silhouette outline:
   *
   *   1. Mask pass: replay queued Gltf2 model draws into an offscreen R8
   *      texture, writing 1.0 wherever the model covers a pixel. No depth
   *      attachment — coverage is recorded regardless of occlusion.
   *
   *   2. Composite pass: full-screen Sobel edge detection on the mask,
   *      alpha-blended onto the swap chain in the configured outline color.
   *
   * Both passes are skipped when no model in this frame requested an outline.
   */
  private _runSilhouettePostProcess(): void {
    if (!this.ctx.device || !this.ctx.commandEncoder) return;
    if (!this._gltf2Renderer || !this._gltf2Renderer.hasPendingMaskDraws()) return;
    if (!this.ctx.silhouetteMaskView || !this.ctx.swapChainView) return;
    if (!this.ctx.cameraBindGroup || !this.ctx.cameraBindGroupLayout) return;

    const compositeRes = this.ensureSilhouetteCompositeResources();
    if (!compositeRes || !this._silhouetteCompositeUniformBuffer) return;

    // ── 1. Mask pass ─────────────────────────────────────────────────
    const maskPass = this.ctx.commandEncoder.beginRenderPass({
      label: 'silhouette-mask-pass',
      colorAttachments: [
        {
          view: this.ctx.silhouetteMaskView,
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      // No depth/stencil — full silhouette regardless of scene occlusion
    });
    this._gltf2Renderer.drawMaskPass(
      maskPass,
      this.ctx.cameraBindGroup,
      this.ctx.cameraBindGroupLayout,
      this.ctx.globeCameraBindGroup,
      this.ctx.globeCameraBindGroupLayout,
      'r8unorm',
    );
    maskPass.end();

    // ── 2. Composite pass ────────────────────────────────────────────
    // Resolve outline color/width from the most recent symbol that queued a
    // mask draw. If there are multiple outline symbols this frame they all
    // share the same composite color — a future enhancement could write
    // group IDs into the mask and look up colors via a uniform array.
    const outline = this._gltf2Renderer.getActiveOutlineUniform();
    if (!outline) return;
    const cw = this.ctx.canvas?.width || 1;
    const ch = this.ctx.canvas?.height || 1;
    writeSilhouetteCompositeUniform(
      this._silhouetteCompositeUniformData,
      outline.color,
      [1 / cw, 1 / ch],
      outline.width,
      0.5, // edge-magnitude threshold (mask is 0/1, so any non-zero gradient is a real edge)
    );
    this.ctx.device.queue.writeBuffer(
      this._silhouetteCompositeUniformBuffer,
      0,
      this._silhouetteCompositeUniformData.buffer as ArrayBuffer,
      this._silhouetteCompositeUniformData.byteOffset,
      this._silhouetteCompositeUniformData.byteLength,
    );

    const compositeBindGroup = this.ctx.device.createBindGroup({
      label: 'silhouette-composite-bind-group',
      layout: compositeRes.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this._silhouetteCompositeUniformBuffer } },
        { binding: 1, resource: compositeRes.sampler },
        { binding: 2, resource: this.ctx.silhouetteMaskView },
      ],
    });

    const compositePass = this.ctx.commandEncoder.beginRenderPass({
      label: 'silhouette-composite-pass',
      colorAttachments: [
        {
          // Composite writes directly to the swap chain, on top of the
          // already-resolved scene. No MSAA — single-sample output.
          view: this.ctx.swapChainView,
          loadOp: 'load',
          storeOp: 'store',
        },
      ],
    });
    compositePass.setPipeline(compositeRes.pipeline);
    compositePass.setBindGroup(0, compositeBindGroup);
    compositePass.draw(3);
    compositePass.end();
  }

  private ensureBackgroundRenderPass(): void {
    if (!this.ctx.commandEncoder || this.ctx.backgroundPass || this.ctx.renderPass || !this.ctx.swapChainView) return;

    this.ctx.backgroundPass = this.ctx.commandEncoder.beginRenderPass({
      label: 'background-render-pass',
      colorAttachments: [
        this.ctx.msaaColorView
          ? {
              view: this.ctx.msaaColorView,
              resolveTarget: this.ctx.swapChainView,
              clearValue: this._clearColor,
              loadOp: 'clear',
              storeOp: 'store',
            }
          : {
              view: this.ctx.swapChainView,
              clearValue: this._clearColor,
              loadOp: 'clear',
              storeOp: 'store',
            },
      ],
    });
  }

  private ensureSceneRenderPass(): void {
    if (!this.ctx.commandEncoder || this.ctx.renderPass || !this.ctx.swapChainView) return;

    const hadBackgroundPass = this.ctx.backgroundPass !== null;
    if (this.ctx.backgroundPass) {
      this.ctx.backgroundPass.end();
      this.ctx.backgroundPass = null;
    }

    this.ctx.renderPass = this.ctx.commandEncoder.beginRenderPass({
      label: 'main-render-pass',
      colorAttachments: [
        this.ctx.msaaColorView
          ? {
              view: this.ctx.msaaColorView,
              resolveTarget: this.ctx.swapChainView,
              clearValue: this._clearColor,
              loadOp: hadBackgroundPass ? 'load' : 'clear',
              storeOp: 'discard',
            }
          : {
              view: this.ctx.swapChainView,
              clearValue: this._clearColor,
              loadOp: hadBackgroundPass ? 'load' : 'clear',
              storeOp: 'store',
            },
      ],
      depthStencilAttachment: this.ctx.depthView
        ? {
            view: this.ctx.depthView,
            depthClearValue: this.ctx.depthConfig.clearValue,
            depthLoadOp: 'clear',
            depthStoreOp: 'store',
          }
        : undefined,
    });
  }

  // ── Draw Methods (delegate one-liners) ──

  drawImagery(tile: ImageryTile): void {
    this.ensureSceneRenderPass();
    this.rasterDelegate?.drawImagery(tile);
  }

  drawGlobeTile(tile: GlobeImageryTile): void {
    this.ensureSceneRenderPass();
    this.rasterDelegate?.drawGlobeTile(tile);
  }

  drawPoleCaps(color: [number, number, number, number]): void {
    this.ensureSceneRenderPass();
    this.globeDelegate?.drawPoleCaps(color);
  }

  drawSky(config: ResolvedSkyConfig, sunAltitude?: number, sunAzimuth?: number): void {
    this.ensureBackgroundRenderPass();
    this.globeDelegate?.drawSky(config, sunAltitude, sunAzimuth);
  }

  drawAtmosphere(strength: number, config?: import('../core/index.js').AtmosphereConfig): void {
    this.ensureSceneRenderPass();
    this.globeDelegate?.drawAtmosphere(strength, config);
  }

  drawGlobePoints(buffer: PointRenderBuffer, symbol: PointSymbol): void {
    this.ensureSceneRenderPass();
    this.globeDelegate?.drawGlobePoints(buffer, symbol);
  }

  drawGlobeLines(buffer: LineRenderBuffer, symbol: LineSymbol): void {
    this.ensureSceneRenderPass();
    this.globeDelegate?.drawGlobeLines(buffer, symbol);
  }

  drawGlobePolygons(buffer: PolygonRenderBuffer, symbol: PolygonSymbol): void {
    this.ensureSceneRenderPass();
    this.globeDelegate?.drawGlobePolygons(buffer, symbol);
  }

  drawPoints(buffer: PointRenderBuffer, symbol: PointSymbol): void {
    this.ensureSceneRenderPass();
    this.vectorDelegate?.drawPoints(buffer, symbol);
  }

  drawLines(buffer: LineRenderBuffer, symbol: LineSymbol): void {
    this.ensureSceneRenderPass();
    this.vectorDelegate?.drawLines(buffer, symbol);
  }

  drawPolygons(buffer: PolygonRenderBuffer, symbol: PolygonSymbol): void {
    this.ensureSceneRenderPass();
    this.vectorDelegate?.drawPolygons(buffer, symbol);
  }

  drawText(buffer: TextRenderBuffer, symbol: TextSymbol): void {
    this.ensureSceneRenderPass();
    this.vectorDelegate?.drawText(buffer, symbol);
  }

  drawPostProcess(sceneTexture: GPUTexture): void {
    this.ensureSceneRenderPass();
    this.vectorDelegate?.drawPostProcess(sceneTexture);
  }

  drawCustom(call: CustomDrawCall): void {
    this.ensureSceneRenderPass();
    this.customDelegate?.drawCustom(call);
  }

  async loadModel(id: string, source: ArrayBuffer | import('../core/index.js').GltfSource): Promise<void> {
    this.loadedModelSources.set(id, cloneModelSource(source));
    await this.modelDelegate?.loadModel(id, source);
  }

  drawModels(buffer: ModelRenderBuffer, symbol: ModelSymbol): void {
    this.ensureSceneRenderPass();
    // Auto-dispatch to V2 if model was loaded via loadModelV2
    if (this._gltf2Renderer?.has(symbol.modelId)) {
      this.drawModelsV2(buffer, symbol);
      return;
    }
    this.modelDelegate?.drawModels(buffer, symbol);
  }

  drawGlobeModels(buffer: ModelRenderBuffer, symbol: ModelSymbol): void {
    this.ensureSceneRenderPass();
    if (this._gltf2Renderer?.has(symbol.modelId)) {
      this.drawGlobeModelsV2(buffer, symbol);
      return;
    }
    this.modelDelegate?.drawGlobeModels(buffer, symbol);
  }

  // ─── Worker Registry ───

  /**
   * Receive the shared {@link WorkerPoolRegistry} from ViewCore. Forwarded
   * to any delegate that can offload CPU work to workers (currently just
   * Gltf2Renderer — more to come as Faz 5 lands).
   *
   * Call order is flexible: may be invoked before or after `initGpu`. If
   * the renderer is not yet constructed, the registry is stored and applied
   * when `initGpu` creates it.
   */
  setWorkerRegistry(
    registry: import('../core/engine/WorkerPoolRegistry.js').WorkerPoolRegistry | null,
  ): void {
    this._workerRegistry = registry;
    this._gltf2Renderer?.setWorkerRegistry(registry);
  }

  // ─── GLTF2 Renderer (V2) ───

  async loadModelV2(id: string, source: string | ArrayBuffer): Promise<void> {
    this.loadedModelV2Sources.set(id, cloneModelV2Source(source));
    await this._gltf2Renderer?.loadModel(id, source);
  }

  getModelMetadata(id: string): ModelMetadata | null {
    if (!this._gltf2Renderer) return null;
    this._gltf2Renderer.syncAnimationState(id, this.ctx.frameTime);
    return this._gltf2Renderer.getModelMetadata(id);
  }

  resolveModelBounds(query: ModelBoundsQuery): ResolvedModelBounds | null {
    if (!this._gltf2Renderer) return null;
    this._gltf2Renderer.syncAnimationState(query.modelId, this.ctx.frameTime);
    return this._gltf2Renderer.resolveModelBounds(query);
  }

  getModelGroundAnchorUnitsV2(id: string): number | null {
    return this.getModelMetadata(id)?.groundAnchorLocalZ ?? null;
  }

  getModelBoundingBoxV2(id: string): { min: [number, number, number]; max: [number, number, number] } | null {
    return this.getModelMetadata(id)?.localBounds ?? null;
  }

  drawModelsV2(buffer: ModelRenderBuffer, symbol: ModelSymbol): void {
    this.ensureSceneRenderPass();
    if (!this._gltf2Renderer || !this.ctx.renderPass || !this.ctx.cameraBindGroup || !this.ctx.cameraBindGroupLayout) return;
    if (this._gltf2Renderer.isAnimated(symbol.modelId)) {
      this.ctx.needsContinuousRender = true;
    }
    this._gltf2Renderer.drawFlat(
      this.ctx.renderPass, buffer, this.ctx.cameraBindGroup,
      this.ctx.cameraBindGroupLayout, this.ctx.colorFormat, this.ctx.depthConfig.format,
      symbol, this.ctx.frameTime,
    );
  }

  drawGlobeModelsV2(buffer: ModelRenderBuffer, symbol: ModelSymbol): void {
    this.ensureSceneRenderPass();
    if (!this._gltf2Renderer || !this.ctx.renderPass || !this.ctx.globeCameraBindGroup || !this.ctx.globeCameraBindGroupLayout) return;
    if (this._gltf2Renderer.isAnimated(symbol.modelId)) {
      this.ctx.needsContinuousRender = true;
    }
    this._gltf2Renderer.drawGlobe(
      this.ctx.renderPass, buffer, this.ctx.globeCameraBindGroup,
      this.ctx.globeCameraBindGroupLayout, this.ctx.colorFormat, this.ctx.depthConfig.format,
      symbol, this.ctx.frameTime,
    );
  }

  drawExtrusion(buffer: ExtrusionRenderBuffer, symbol: ExtrudedPolygonSymbol): void {
    this.ensureSceneRenderPass();
    this.extrusionDelegate?.drawExtrusion(buffer, symbol);
  }

  drawGlobeExtrusion(buffer: ExtrusionRenderBuffer, symbol: ExtrudedPolygonSymbol): void {
    this.ensureSceneRenderPass();
    this.extrusionDelegate?.drawGlobeExtrusion(buffer, symbol);
  }

  drawMesh3D(buffer: Mesh3DRenderBuffer, symbol: Mesh3DSymbol): void {
    this.ensureSceneRenderPass();
    this.mesh3dDelegate?.drawMesh3D(buffer, symbol);
  }

  /**
   * Pre-pass particle tick: CPU emission + GPU compute update.
   *
   * MUST be called before {@link ensureSceneRenderPass} opens the main
   * render pass on the frame command encoder. WebGPU forbids opening a
   * compute pass on an encoder that is locked by an active render pass,
   * so compute work is split off into this pre-pass entry point.
   *
   * Called from Mode2D / Mode3D for each visible ParticleLayer before any
   * scene draw calls.
   */
  tickParticles(layer: ParticleLayer, deltaSeconds: number): void {
    if (!this.particleDelegate) return;
    // Emission is a CPU writeBuffer (legal at any time) — kept here so all
    // particle pre-pass work lives in one place. Compute dispatch MUST run
    // before any render pass is opened on the frame encoder.
    this.particleDelegate.emit(layer, deltaSeconds);
    this.particleDelegate.update(layer, deltaSeconds);
    // Keep rendering while this layer is alive so the simulation advances.
    this.ctx.needsContinuousRender = true;
  }

  /**
   * Per-frame particle render dispatch. Assumes {@link tickParticles} has
   * already run for this layer earlier in the frame. Opens (or joins) the
   * scene render pass and issues the point-list draw.
   */
  drawParticles(layer: ParticleLayer, globe: boolean): void {
    if (!this.particleDelegate || !this.ctx.currentCamera) return;
    this.ensureSceneRenderPass();
    this.particleDelegate.render(layer, this.ctx.currentCamera, globe);
  }

  /** Release GPU resources for a particle layer (ParticleSystem + delegate state). */
  disposeParticleLayer(layer: ParticleLayer): void {
    this.particleDelegate?.dispose(layer);
  }

  drawGlobeMesh3D(buffer: Mesh3DRenderBuffer, symbol: Mesh3DSymbol): void {
    this.ensureSceneRenderPass();
    this.mesh3dDelegate?.drawGlobeMesh3D(buffer, symbol);
  }

  setClusterSource(layerId: string, points: Float32Array, version: number): void {
    this.clusterDelegate?.setSource(layerId, points, version);
  }

  drawClusters(layerId: string, style: ClusterStyleConfig, clusterRadius: number, clusterMinPoints: number, zoom: number, extent: [number, number, number, number], globe: boolean): void {
    this.ensureSceneRenderPass();
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
    if (!this.ctx.device || !this.ctx.commandEncoder) return;

    if (!this.ctx.backgroundPass && !this.ctx.renderPass) {
      this.ensureBackgroundRenderPass();
    }
    if (this.ctx.backgroundPass) {
      this.ctx.backgroundPass.end();
      this.ctx.backgroundPass = null;
    }
    if (this.ctx.renderPass) {
      this.ctx.renderPass.end();
      this.ctx.renderPass = null;
    }

    // Cesium-style screen-space silhouette: replay queued model draws into
    // an offscreen R8 mask, then alpha-blend the Sobel edge result onto the
    // swap chain. Skipped when no model with outline is in the frame.
    this._runSilhouettePostProcess();

    const commandBuffer = this.ctx.commandEncoder.finish();
    this.ctx.device.queue.submit([commandBuffer]);

    // Cleanup per-frame state
    this.ctx.commandEncoder = null;
    this.ctx.swapChainView = null;
    this.ctx.msaaColorView = null;
    this.ctx.depthView = null;

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

  createTextureFromVideo(video: HTMLVideoElement): GPUTexture {
    if (!this.textureManager) {
      throw new Error('[mapgpu] RenderEngine not initialized.');
    }
    return this.textureManager.createFromVideoElement(video);
  }

  updateTextureFromVideo(texture: GPUTexture, video: HTMLVideoElement): void {
    if (!this.textureManager) {
      throw new Error('[mapgpu] RenderEngine not initialized.');
    }
    this.textureManager.updateFromVideoElement(texture, video);
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

  /**
   * Rebuild only the depth-dependent GPU state (depth texture + every
   * render pipeline) while keeping the WebGPU device, buffers, textures,
   * bind groups and the tile/terrain caches intact.
   *
   * Called by {@link MapView.switchTo} when the mode change only needs a
   * different depth format (e.g. Mode2D's `depth24plus` ↔ Mode3D's
   * reverse-Z `depth32float`). Using this instead of {@link recover} is
   * important because `recover()` creates a *new* WebGPU device, which
   * forces a full tile cache flush — and that, in turn, produces a
   * visible flash on mode switch as the parent-fallback chain has to
   * rebuild from zero.
   *
   * Safety: every GPU resource kept alive here (tile textures, layer
   * buffers, camera buffers, MSAA/silhouette render targets, placeholder
   * texture) was created from and is bound to `this.ctx.device`. Since
   * the device pointer is preserved, those resources remain valid after
   * this call. Only pipelines are invalidated, and pipelines are owned
   * exclusively by the delegates we destroy+recreate below.
   */
  async rebuildForDepthChange(depthConfig: DepthConfig): Promise<void> {
    if (!this.ctx.canvas) {
      throw new Error('[mapgpu] rebuildForDepthChange: no canvas reference.');
    }
    if (!this.ctx.device) {
      throw new Error('[mapgpu] rebuildForDepthChange: device is not initialised.');
    }

    // 1. Destroy every pipeline owner. Pipelines compile against the
    //    current depth format + compare func + clear value; they must
    //    recompile when any of those change.
    this.pickingDelegate?.destroy();
    this.rasterDelegate?.destroy();
    this.globeDelegate?.destroy();
    this.vectorDelegate?.destroy();
    this.modelDelegate?.destroy();
    this._gltf2Renderer?.destroy();
    this.customDelegate?.destroy();
    this.clusterDelegate?.destroy();
    this.extrusionDelegate?.destroy();
    this.mesh3dDelegate?.destroy();
    this.particleDelegate?.destroy();
    this.pickingDelegate = null;
    this.rasterDelegate = null;
    this.globeDelegate = null;
    this.vectorDelegate = null;
    this.modelDelegate = null;
    this._gltf2Renderer = null;
    this.customDelegate = null;
    this.clusterDelegate = null;
    this.extrusionDelegate = null;
    this.mesh3dDelegate = null;
    this.particleDelegate = null;

    // 2. Destroy depth-bound standalone pipelines (silhouette composite).
    this._silhouetteCompositeUniformBuffer = null;
    this._silhouetteCompositePipeline = null;

    // 3. Replace the depth texture with one in the new format. The
    //    `depthView` is computed lazily on the next frame so just null
    //    it here.
    this.ctx.depthTexture?.destroy();
    this.ctx.depthView = null;
    this.ctx.depthConfig = depthConfig;
    this.ctx.depthTexture = this.ctx.device.createTexture({
      label: 'main-depth-texture',
      size: {
        width: this.ctx.canvas.width || 1,
        height: this.ctx.canvas.height || 1,
      },
      format: depthConfig.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      sampleCount: this.ctx.sampleCount,
    });

    // 4. Rebuild delegates. They pick up the new depthConfig from ctx and
    //    compile fresh pipelines against it.
    const getIconAtlas = () => this.ensureIconAtlas();
    this.pickingDelegate = new DrawDelegatePicking(this.ctx);
    this.rasterDelegate = new DrawDelegateRaster(this.ctx);
    this.globeDelegate = new DrawDelegateGlobe(this.ctx, getIconAtlas);
    this.vectorDelegate = new DrawDelegateVector(this.ctx, getIconAtlas);
    this.modelDelegate = new DrawDelegateModel(this.ctx);
    const { Gltf2Renderer } = await import('./gltf2-renderer.js');
    this._gltf2Renderer = new Gltf2Renderer(this.ctx.device);
    if (this._workerRegistry) {
      this._gltf2Renderer.setWorkerRegistry(this._workerRegistry);
    }
    this.customDelegate = new DrawDelegateCustom(this.ctx);
    this.clusterDelegate = new DrawDelegateCluster(this.ctx);
    this.extrusionDelegate = new DrawDelegateExtrusion(this.ctx);
    this.mesh3dDelegate = new DrawDelegateMesh3D(this.ctx);
    this.particleDelegate = new DrawDelegateParticle(this.ctx);

    // Eagerly init raster pipeline (most commonly used after a switch).
    this.rasterDelegate.initRasterPipeline();

    // Gltf2Renderer is fresh → re-upload previously loaded models to it.
    // Model bytes are kept on the CPU side in the engine's registry so
    // this is GPU upload only (no re-download).
    await this.restoreLoadedModels();
  }

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
    this._gltf2Renderer?.destroy();
    this.customDelegate?.destroy();
    this.clusterDelegate?.destroy();
    this.extrusionDelegate?.destroy();
    this.mesh3dDelegate?.destroy();
    this.particleDelegate?.destroy();
    this.pickingDelegate = null;
    this.rasterDelegate = null;
    this.globeDelegate = null;
    this.vectorDelegate = null;
    this.modelDelegate = null;
    this._gltf2Renderer = null;
    this.customDelegate = null;
    this.clusterDelegate = null;
    this.extrusionDelegate = null;
    this.mesh3dDelegate = null;
    this.particleDelegate = null;

    // Reset shared state — destroy old pool so any remaining GPU buffers are freed
    this.ctx.bufferPool?.destroy();
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
    this.ctx.backgroundPass = null;
    this.ctx.renderPass = null;
    this.ctx.depthTexture = null;
    this.ctx.msaaColorTexture = null;
    this.ctx.silhouetteMaskTexture = null;
    this.ctx.silhouetteMaskView = null;
    this._silhouetteCompositeUniformBuffer = null;
    this._silhouetteCompositePipeline = null;
    this.ctx.swapChainView = null;
    this.ctx.msaaColorView = null;
    this.ctx.depthView = null;
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
    this.ctx.backgroundPass = null;
    this.ctx.swapChainView = null;
    this.ctx.msaaColorView = null;
    this.ctx.depthView = null;
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
    this._gltf2Renderer?.destroy();
    this.customDelegate?.destroy();
    this.clusterDelegate?.destroy();
    this.extrusionDelegate?.destroy();
    this.mesh3dDelegate?.destroy();
    this.particleDelegate?.destroy();
    this.pickingDelegate = null;
    this.rasterDelegate = null;
    this.globeDelegate = null;
    this.vectorDelegate = null;
    this.modelDelegate = null;
    this._gltf2Renderer = null;
    this.customDelegate = null;
    this.clusterDelegate = null;
    this.extrusionDelegate = null;
    this.mesh3dDelegate = null;
    this.particleDelegate = null;
    this.iconAtlas = null;

    this.ctx.globeCameraBuffer = null;
    this.ctx.globeCameraBindGroup = null;
    this.ctx.globeCameraBindGroupLayout = null;

    this.ctx.depthTexture?.destroy();
    this.ctx.depthTexture = null;

    this.ctx.msaaColorTexture?.destroy();
    this.ctx.msaaColorTexture = null;

    this.ctx.silhouetteMaskTexture?.destroy();
    this.ctx.silhouetteMaskTexture = null;
    this.ctx.silhouetteMaskView = null;
    this._silhouetteCompositeUniformBuffer?.destroy();
    this._silhouetteCompositeUniformBuffer = null;
    this._silhouetteCompositePipeline = null;

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
    this.loadedModelSources.clear();
    this.loadedModelV2Sources.clear();
  }

  private async restoreLoadedModels(): Promise<void> {
    if (this.modelDelegate) {
      for (const [id, source] of this.loadedModelSources) {
        await this.modelDelegate.loadModel(id, cloneModelSource(source));
      }
    }

    if (this._gltf2Renderer) {
      for (const [id, source] of this.loadedModelV2Sources) {
        await this._gltf2Renderer.loadModel(id, cloneModelV2Source(source));
      }
    }
  }
}

function cloneModelSource(source: ArrayBuffer | GltfSource): ArrayBuffer | GltfSource {
  if (source instanceof ArrayBuffer) {
    return source.slice(0);
  }

  return {
    json: cloneUnknownJson(source.json),
    buffers: source.buffers.map((buffer) => buffer.slice(0)),
  };
}

function cloneModelV2Source(source: string | ArrayBuffer): string | ArrayBuffer {
  return typeof source === 'string' ? source : source.slice(0);
}

function cloneUnknownJson<T>(value: T): T {
  return structuredClone(value);
}
