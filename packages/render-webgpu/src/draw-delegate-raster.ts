/**
 * Draw Delegate — Raster
 *
 * 2D raster tile rendering (drawImagery) and
 * globe raster tile rendering (drawGlobeTile).
 * Optional debug overlay: wireframe grid + vertex dots + tile borders.
 */

import type { GlobeImageryTile, ImageryTile } from '@mapgpu/core';

import {
  createRasterPipeline,
  type RasterPipeline,
} from './pipelines/raster-pipeline.js';
import {
  createGlobeRasterPipeline,
  type GlobeRasterPipeline,
} from './pipelines/globe-raster-pipeline.js';
import {
  createTileDebugSuite,
  type TileDebugSuite,
  GRID_COLOR, DOT_COLOR, BORDER_COLOR, DOT_SIZE, BORDER_WIDTH,
} from './pipelines/tile-debug-pipeline.js';
import type { FrameContext } from './frame-context.js';

interface DebugHeightOptions {
  mode: 0 | 1;
  exaggeration: number;
  terrainUvOffsetScale: [number, number, number, number];
  terrainHeightTexture?: GPUTexture;
}

const DEFAULT_TERRAIN_LIGHTING = {
  enabled: true,
  ambient: 0.35,
  diffuse: 0.85,
  shadowStrength: 0.35,
  shadowSoftness: 0.4,
  sunAzimuth: 315,
  sunAltitude: 45,
} as const;

export class DrawDelegateRaster {
  private rasterPipeline: RasterPipeline | null = null;
  private globeRasterPipeline: GlobeRasterPipeline | null = null;

  // Debug suites (lazy-init)
  private debugSuite2D: TileDebugSuite | null = null;
  private debugSuiteGlobe: TileDebugSuite | null = null;

  constructor(private readonly ctx: FrameContext) {}

  initRasterPipeline(): void {
    if (!this.ctx.device) return;
    this.rasterPipeline = createRasterPipeline({
      device: this.ctx.device,
      colorFormat: this.ctx.colorFormat,
      cameraBindGroupLayout: this.ctx.cameraBindGroupLayout!,
      depthFormat: this.ctx.depthConfig.format as GPUTextureFormat,
      sampleCount: this.ctx.sampleCount,
    });
  }

  ensureGlobeRasterPipeline(): GlobeRasterPipeline {
    if (!this.globeRasterPipeline) {
      this.ctx.ensureGlobeCameraResources();
      this.globeRasterPipeline = createGlobeRasterPipeline({
        device: this.ctx.device!,
        colorFormat: this.ctx.colorFormat,
        depthFormat: this.ctx.depthConfig.format as GPUTextureFormat,
        depthCompare: this.ctx.depthConfig.compareFunc,
        sampleCount: this.ctx.sampleCount,
      });
    }
    return this.globeRasterPipeline;
  }

  // ─── Debug Suite Init ───

  private ensureDebugSuite2D(): TileDebugSuite {
    if (!this.debugSuite2D) {
      this.debugSuite2D = createTileDebugSuite({
        device: this.ctx.device!,
        colorFormat: this.ctx.colorFormat,
        cameraBindGroupLayout: this.ctx.cameraBindGroupLayout!,
        depthFormat: this.ctx.depthConfig.format as GPUTextureFormat,
        globe: false,
        sampleCount: this.ctx.sampleCount,
      });
    }
    return this.debugSuite2D;
  }

  private ensureDebugSuiteGlobe(): TileDebugSuite {
    if (!this.debugSuiteGlobe) {
      this.ctx.ensureGlobeCameraResources();
      this.debugSuiteGlobe = createTileDebugSuite({
        device: this.ctx.device!,
        colorFormat: this.ctx.colorFormat,
        cameraBindGroupLayout: this.ctx.globeCameraBindGroupLayout!,
        depthFormat: this.ctx.depthConfig.format as GPUTextureFormat,
        depthCompare: this.ctx.depthConfig.compareFunc,
        globe: true,
        sampleCount: this.ctx.sampleCount,
      });
    }
    return this.debugSuiteGlobe;
  }

  // ─── Draw Imagery (2D) ───

  drawImagery(tile: ImageryTile): void {
    if (!this.ctx.device || !this.ctx.renderPass || !this.rasterPipeline || !this.ctx.cameraBindGroup || !this.ctx.bufferPool) return;

    const tileUniformData = new Float32Array(8);
    tileUniformData[0] = tile.extent[0];
    tileUniformData[1] = tile.extent[1];
    tileUniformData[2] = tile.extent[2];
    tileUniformData[3] = tile.extent[3];
    tileUniformData[4] = tile.opacity;
    tileUniformData[5] = tile.filters?.brightness ?? 1;
    tileUniformData[6] = tile.filters?.contrast ?? 1;
    tileUniformData[7] = tile.filters?.saturate ?? 1;

    const tileUniformBuffer = this.ctx.bufferPool.allocateWithData(tileUniformData, GPUBufferUsage.UNIFORM, 'transient');

    const tileBindGroup = this.ctx.device.createBindGroup({
      label: 'raster-tile-bind-group',
      layout: this.rasterPipeline.rasterBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: tileUniformBuffer } },
        { binding: 1, resource: this.rasterPipeline.sampler },
        { binding: 2, resource: tile.texture.createView() },
      ],
    });

    this.ctx.renderPass.setPipeline(this.rasterPipeline.pipeline);
    this.ctx.renderPass.setBindGroup(0, this.ctx.cameraBindGroup);
    this.ctx.renderPass.setBindGroup(1, tileBindGroup);
    this.ctx.renderPass.draw(4);

    if (this.ctx.debugTileVertices) {
      this._drawDebugOverlay(tile.extent, false);
    }
  }

  // ─── Draw Globe Tile (3D) ───

  drawGlobeTile(tile: GlobeImageryTile): void {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.bufferPool) return;

    const pipeline = this.ensureGlobeRasterPipeline();
    this.ctx.ensureGlobeCameraWritten();

    const useTerrain = (tile.heightMode ?? 0) === 1;
    const terrainUv = tile.terrainUvOffsetScale ?? [0, 0, 1, 1];
    const heightExaggeration = tile.heightExaggeration ?? this.ctx.heightExaggeration;
    const lighting = {
      enabled: tile.lighting3D?.enabled ?? DEFAULT_TERRAIN_LIGHTING.enabled,
      ambient: tile.lighting3D?.ambient ?? DEFAULT_TERRAIN_LIGHTING.ambient,
      diffuse: tile.lighting3D?.diffuse ?? DEFAULT_TERRAIN_LIGHTING.diffuse,
      shadowStrength: tile.lighting3D?.shadowStrength ?? DEFAULT_TERRAIN_LIGHTING.shadowStrength,
      shadowSoftness: tile.lighting3D?.shadowSoftness ?? DEFAULT_TERRAIN_LIGHTING.shadowSoftness,
      sunAzimuth: tile.lighting3D?.sunAzimuth ?? DEFAULT_TERRAIN_LIGHTING.sunAzimuth,
      sunAltitude: tile.lighting3D?.sunAltitude ?? DEFAULT_TERRAIN_LIGHTING.sunAltitude,
    };

    const tileUniformData = new Float32Array(24);
    tileUniformData[0] = tile.mercatorExtent[0];
    tileUniformData[1] = tile.mercatorExtent[1];
    tileUniformData[2] = tile.mercatorExtent[2];
    tileUniformData[3] = tile.mercatorExtent[3];
    tileUniformData[4] = tile.opacity;
    tileUniformData[5] = heightExaggeration;
    tileUniformData[6] = useTerrain ? 1 : 0;
    tileUniformData[8] = terrainUv[0];
    tileUniformData[9] = terrainUv[1];
    tileUniformData[10] = terrainUv[2];
    tileUniformData[11] = terrainUv[3];
    tileUniformData[12] = Math.max(0, Math.min(1, lighting.ambient));
    tileUniformData[13] = Math.max(0, Math.min(2, lighting.diffuse));
    tileUniformData[14] = Math.max(0, Math.min(1, lighting.shadowStrength));
    tileUniformData[15] = Math.max(0, Math.min(1, lighting.shadowSoftness));
    tileUniformData[16] = lighting.sunAzimuth;
    tileUniformData[17] = Math.max(0, Math.min(89.9, lighting.sunAltitude));
    tileUniformData[18] = lighting.enabled ? 1 : 0;
    // filters: brightness, contrast, saturate (default 1.0)
    tileUniformData[20] = tile.filters?.brightness ?? 1;
    tileUniformData[21] = tile.filters?.contrast ?? 1;
    tileUniformData[22] = tile.filters?.saturate ?? 1;

    const tileUniformBuffer = this.ctx.bufferPool.allocateWithData(tileUniformData, GPUBufferUsage.UNIFORM, 'transient');

    const tileBindGroup = this.ctx.device.createBindGroup({
      label: 'globe-tile-bind-group',
      layout: pipeline.globeTileBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: tileUniformBuffer } },
        { binding: 1, resource: pipeline.sampler },
        { binding: 2, resource: tile.texture.createView() },
      ],
    });

    let heightBG = pipeline.zeroHeightBindGroup;
    if (useTerrain) {
      if (tile.terrainHeightTexture) {
        heightBG = this.ctx.device.createBindGroup({
          label: 'globe-terrain-height-bind-group',
          layout: pipeline.heightBindGroupLayout,
          entries: [
            { binding: 0, resource: tile.terrainHeightTexture.createView() },
            { binding: 1, resource: pipeline.heightSampler },
          ],
        });
      }
    } else {
      heightBG = this.ctx.heightBrush?.getBindGroup(
        this.ctx.device!,
      ) ?? pipeline.zeroHeightBindGroup;
    }

    this.ctx.renderPass.setPipeline(pipeline.pipeline);
    this.ctx.renderPass.setBindGroup(0, this.ctx.globeCameraBindGroup!);
    this.ctx.renderPass.setBindGroup(1, tileBindGroup);
    this.ctx.renderPass.setBindGroup(2, heightBG);
    this.ctx.renderPass.setVertexBuffer(0, pipeline.subdivisionMesh.vertexBuffer);
    this.ctx.renderPass.setIndexBuffer(
      pipeline.subdivisionMesh.indexBuffer,
      pipeline.subdivisionMesh.vertexCount > 65535 ? 'uint32' : 'uint16',
    );
    this.ctx.renderPass.drawIndexed(pipeline.subdivisionMesh.indexCount);

    if (this.ctx.debugTileVertices) {
      this._drawDebugOverlay(tile.mercatorExtent, true, {
        mode: useTerrain ? 1 : 0,
        exaggeration: heightExaggeration,
        terrainUvOffsetScale: terrainUv,
        terrainHeightTexture: tile.terrainHeightTexture,
      });
    }
  }

  // ─── Debug Overlay (shared 2D/globe) ───

  private _drawDebugOverlay(
    extent: [number, number, number, number],
    globe: boolean,
    heightOptions?: DebugHeightOptions,
  ): void {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.bufferPool) return;

    const cameraBindGroup = globe ? this.ctx.globeCameraBindGroup : this.ctx.cameraBindGroup;
    if (!cameraBindGroup) return;

    const suite = globe ? this.ensureDebugSuiteGlobe() : this.ensureDebugSuite2D();

    // Shared uniform:
    // extent + gridColor + dotColor + borderColor + params + heightMode + terrainUv
    const u = new Float32Array(28);
    u[0] = extent[0]; u[1] = extent[1]; u[2] = extent[2]; u[3] = extent[3];
    u[4] = GRID_COLOR[0]; u[5] = GRID_COLOR[1]; u[6] = GRID_COLOR[2]; u[7] = GRID_COLOR[3];
    u[8] = DOT_COLOR[0]; u[9] = DOT_COLOR[1]; u[10] = DOT_COLOR[2]; u[11] = DOT_COLOR[3];
    u[12] = BORDER_COLOR[0]; u[13] = BORDER_COLOR[1]; u[14] = BORDER_COLOR[2]; u[15] = BORDER_COLOR[3];
    u[16] = DOT_SIZE;
    u[17] = BORDER_WIDTH;
    u[18] = heightOptions?.exaggeration ?? this.ctx.heightExaggeration;
    u[19] = suite.mesh.subdivisions;         // params.w — grid subdivisions for border shader
    u[20] = heightOptions?.mode ?? 0;
    u[24] = heightOptions?.terrainUvOffsetScale[0] ?? 0;
    u[25] = heightOptions?.terrainUvOffsetScale[1] ?? 0;
    u[26] = heightOptions?.terrainUvOffsetScale[2] ?? 1;
    u[27] = heightOptions?.terrainUvOffsetScale[3] ?? 1;

    const uniformBuffer = this.ctx.bufferPool.allocateWithData(u, GPUBufferUsage.UNIFORM, 'transient');

    const bindGroup = this.ctx.device.createBindGroup({
      label: 'tile-debug-bind-group',
      layout: suite.bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    });

    let heightBindGroup = suite.zeroHeightBindGroup;
    const useTerrain = globe && (heightOptions?.mode ?? 0) === 1;
    if (useTerrain) {
      if (heightOptions?.terrainHeightTexture) {
        heightBindGroup = this.ctx.device.createBindGroup({
          label: 'tile-debug-terrain-height-bind-group',
          layout: suite.heightBindGroupLayout,
          entries: [
            { binding: 0, resource: heightOptions.terrainHeightTexture.createView() },
            { binding: 1, resource: suite.heightSampler },
          ],
        });
      }
    } else {
      heightBindGroup = this.ctx.heightBrush?.getBindGroup(
        this.ctx.device!,
      ) ?? suite.zeroHeightBindGroup;
    }

    const pass = this.ctx.renderPass;
    const indexFormat: GPUIndexFormat = suite.mesh.vertexCount > 65535 ? 'uint32' : 'uint16';

    // Pass 1: Wireframe grid
    pass.setPipeline(suite.wireframePipeline);
    pass.setBindGroup(0, cameraBindGroup);
    pass.setBindGroup(1, bindGroup);
    pass.setBindGroup(2, heightBindGroup);
    pass.setVertexBuffer(0, suite.mesh.vertexBuffer);
    pass.setIndexBuffer(suite.mesh.wireframeIndexBuffer, indexFormat);
    pass.drawIndexed(suite.mesh.wireframeIndexCount);

    // Pass 2: Border (24 vertices from vertex_index, no vertex buffer)
    pass.setPipeline(suite.borderPipeline);
    pass.setBindGroup(0, cameraBindGroup);
    pass.setBindGroup(1, bindGroup);
    pass.setBindGroup(2, heightBindGroup);
    pass.draw(24);

    // Pass 3: Vertex dots (instanced quads)
    pass.setPipeline(suite.dotPipeline);
    pass.setBindGroup(0, cameraBindGroup);
    pass.setBindGroup(1, bindGroup);
    pass.setBindGroup(2, heightBindGroup);
    pass.setVertexBuffer(0, suite.quadBuffer);           // quad corners (per-vertex)
    pass.setVertexBuffer(1, suite.mesh.vertexBuffer);    // grid UVs (per-instance)
    pass.draw(6, suite.mesh.vertexCount);                // 6 verts/quad × N instances
  }

  destroy(): void {
    this.rasterPipeline = null;
    this.globeRasterPipeline = null;
    this.debugSuite2D = null;
    this.debugSuiteGlobe = null;
  }

  reset(): void {
    this.rasterPipeline = null;
    this.globeRasterPipeline = null;
    this.debugSuite2D = null;
    this.debugSuiteGlobe = null;
  }
}
