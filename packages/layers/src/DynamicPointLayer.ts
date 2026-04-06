/**
 * DynamicPointLayer — Pre-allocated GPU buffer for bulk position updates.
 *
 * Designed for real-time simulation scenarios (e.g. missile tracks,
 * aircraft positions) where thousands of points update every frame.
 * Uses writeBuffer() for zero-allocation GPU updates.
 */
import { LayerBase } from './LayerBase.js';
import type { LayerBaseOptions } from './LayerBase.js';
import type { PointSymbol, IRenderEngine } from '@mapgpu/core';

export interface DynamicPointLayerOptions extends LayerBaseOptions {
  /** Maximum number of points this layer can hold. Default 10000. */
  maxPoints?: number;
  /** Symbol used for rendering all points. */
  symbol?: PointSymbol;
}

export class DynamicPointLayer extends LayerBase {
  readonly type = 'dynamic-point';

  private _maxPoints: number;
  private _pointCount = 0;
  private _positionBuffer: GPUBuffer | null = null;
  private _renderEngine: IRenderEngine | null = null;
  private _pointSymbol: PointSymbol;

  constructor(options: DynamicPointLayerOptions = {}) {
    super(options);
    this._maxPoints = options.maxPoints ?? 10000;
    this._pointSymbol = options.symbol ?? {
      type: 'simple-marker',
      color: [255, 87, 34, 255],
      size: 6,
    };
  }

  /** Number of active points. */
  get pointCount(): number { return this._pointCount; }

  /** Pre-allocated GPU vertex buffer for positions. */
  get positionBuffer(): GPUBuffer | null { return this._positionBuffer; }

  /** Symbol used for rendering all points. */
  get pointSymbol(): PointSymbol { return this._pointSymbol; }
  set pointSymbol(sym: PointSymbol) { this._pointSymbol = sym; }

  /** Maximum number of points this layer can hold. */
  get maxPoints(): number { return this._maxPoints; }

  /**
   * Attach render engine and allocate the GPU buffer.
   * Must be called before updatePositions().
   */
  attachRenderEngine(engine: IRenderEngine): void {
    this._renderEngine = engine;
    // Allocate buffer: each point = 12 bytes (x, y, z as f32)
    this._positionBuffer = engine.createBuffer(
      new Float32Array(this._maxPoints * 3),
      0x0020 | 0x0008, // VERTEX | COPY_DST
    );
  }

  /**
   * Bulk-update all positions via writeBuffer (no allocation).
   *
   * @param data - Float32Array of [x, y, z, x, y, z, ...] in EPSG:3857.
   *               Length must be a multiple of 3.
   *               The number of points is data.length / 3.
   */
  updatePositions(data: Float32Array): void {
    if (!this._renderEngine || !this._positionBuffer) return;
    const count = Math.min(Math.floor(data.length / 3), this._maxPoints);
    this._pointCount = count;
    if (count > 0) {
      this._renderEngine.writeBuffer(this._positionBuffer, 0, data.subarray(0, count * 3));
    }
  }

  protected async onLoad(): Promise<void> {
    // No async loading needed — buffer is allocated via attachRenderEngine
  }

  destroy(): void {
    if (this._positionBuffer && this._renderEngine) {
      this._renderEngine.releaseBuffer(this._positionBuffer);
    }
    this._positionBuffer = null;
    this._renderEngine = null;
    this._pointCount = 0;
    super.destroy();
  }
}
