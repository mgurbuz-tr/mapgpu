/**
 * WallLayer — Vertical wall (curtain) geometry from geographic coordinates.
 *
 * Extends GraphicsLayer — keeps lightweight polygon features for extent/query
 * compatibility, while the render path can consume raw wall control points
 * to build a true curtain mesh. Uses `replaceAll()` for efficient updates.
 *
 * Usage:
 * ```ts
 * const wall = new WallLayer({
 *   id: 'curtain',
 *   fillColor: [255, 109, 58, 60],
 *   outlineColor: [255, 109, 58, 180],
 * });
 * mapView.map.add(wall);
 * wall.append(29, 41, 500);  // lon, lat, height
 * wall.append(30, 41, 600);  // wall grows
 * ```
 */

import {
  SimpleRenderer,
  IncrementalWallBuffer,
  type IRenderEngine,
  type Mesh3DRenderBuffer,
  type Mesh3DSymbol,
  type ElevationInfo,
  type IWallElevationSampler,
} from '../core/index.js';
import { GraphicsLayer } from './GraphicsLayer.js';
import type { GraphicsLayerOptions } from './GraphicsLayer.js';

export interface WallLayerOptions extends GraphicsLayerOptions {
  /** Initial geographic positions [lon, lat][]. */
  positions?: [number, number][];
  /** Per-vertex maximum height in metres. */
  heights?: number[];
  /** Per-vertex minimum height in metres. Default all zeros. */
  minimumHeights?: number[];
  /** Fill color RGBA 0-255. */
  fillColor?: [number, number, number, number];
  /** Outline color RGBA 0-255. */
  outlineColor?: [number, number, number, number];
  /** Outline width in pixels. */
  outlineWidth?: number;
}

export interface WallGeometryData {
  positions: [number, number][];
  maximumHeights: number[];
  minimumHeights: number[];
}

export class WallLayer extends GraphicsLayer {
  // @ts-expect-error — WallLayer narrows the type from 'graphics' to 'wall'
  override readonly type = 'wall' as const;

  private _lons: number[] = [];
  private _lats: number[] = [];
  private _maxH: number[] = [];
  private _minH: number[] = [];

  /** Incremental GPU buffer — created via bindRenderEngine(). */
  private _incrementalBuffer: IncrementalWallBuffer | null = null;
  /** Whether terrain offset has been applied to the current buffer data. */
  private _terrainApplied = false;

  constructor(options: WallLayerOptions = {}) {
    super(options);

    // Set renderer with fill + outline
    this.renderer = new SimpleRenderer({
      type: 'simple-fill' as const,
      color: options.fillColor ?? [255, 109, 58, 60],
      outlineColor: options.outlineColor ?? [255, 109, 58, 180],
      outlineWidth: options.outlineWidth ?? 1,
    });

    // Initial data
    if (options.positions && options.heights) {
      const n = Math.min(options.positions.length, options.heights.length);
      for (let i = 0; i < n; i++) {
        this._lons.push(options.positions[i]![0]);
        this._lats.push(options.positions[i]![1]);
        this._maxH.push(options.heights[i]!);
        this._minH.push(options.minimumHeights?.[i] ?? 0);
      }
      this._rebuild();
    }
  }

  /** Number of points in the wall. */
  get length(): number { return this._lons.length; }

  /** Append a new point — wall grows, geometry auto-updates. */
  append(lon: number, lat: number, height: number, minHeight: number = 0): void {
    this._lons.push(lon);
    this._lats.push(lat);
    this._maxH.push(height);
    this._minH.push(minHeight);

    // Incremental fast path: write only the new segment to GPU
    if (this._incrementalBuffer && this._lons.length >= 2) {
      const i = this._lons.length - 2;
      this._incrementalBuffer.appendSegment(
        this._lons[i]!, this._lats[i]!, this._minH[i]!, this._maxH[i]!,
        this._lons[i + 1]!, this._lats[i + 1]!, this._minH[i + 1]!, this._maxH[i + 1]!,
      );

      this._terrainApplied = false; // new segment needs terrain offset
      // Lightweight repaint — no VectorBufferCache invalidation
      this.redraw();
      return;
    }

    this._rebuild();
  }

  /** Remove all points and clear. */
  override clear(): void {
    this._lons.length = 0;
    this._lats.length = 0;
    this._maxH.length = 0;
    this._minH.length = 0;
    this._incrementalBuffer?.clear();
    this._terrainApplied = false;
    super.clear();
  }

  /** Replace all data at once. */
  setPositions(positions: [number, number][], heights: number[], minimumHeights?: number[]): void {
    this._lons = positions.map(p => p[0]);
    this._lats = positions.map(p => p[1]);
    this._maxH = [...heights];
    this._minH = minimumHeights ? [...minimumHeights] : new Array(positions.length).fill(0) as number[];

    // Full rebuild of incremental buffer if available
    if (this._incrementalBuffer) {
      this._incrementalBuffer.rebuildFromControlPoints(this._lons, this._lats, this._maxH, this._minH);
      this._terrainApplied = false;
    }

    this._rebuild();
  }

  /** Raw wall control points for render paths that generate real curtain meshes. */
  getWallGeometryData(): WallGeometryData {
    return {
      positions: this._lons.map((lon, i) => [lon, this._lats[i]!] as [number, number]),
      maximumHeights: [...this._maxH],
      minimumHeights: [...this._minH],
    };
  }

  /** Update fill/outline style. */
  setStyle(options: {
    fillColor?: [number, number, number, number];
    outlineColor?: [number, number, number, number];
    outlineWidth?: number;
  }): void {
    this.renderer = new SimpleRenderer({
      type: 'simple-fill',
      color: options.fillColor ?? [255, 109, 58, 60],
      outlineColor: options.outlineColor ?? [255, 109, 58, 180],
      outlineWidth: options.outlineWidth ?? 1,
    } as never);
  }

  // ─── Incremental buffer integration ───

  /**
   * Bind a render engine to enable incremental GPU buffer appends.
   * Called by the rendering system when the layer is first rendered.
   */
  bindRenderEngine(engine: IRenderEngine): void {
    if (this._incrementalBuffer) return; // already bound
    this._incrementalBuffer = new IncrementalWallBuffer(engine);

    // If data already exists, do a bulk upload
    if (this._lons.length >= 2) {
      this._incrementalBuffer.rebuildFromControlPoints(this._lons, this._lats, this._maxH, this._minH);

    }
  }

  /** Whether this layer has an active incremental buffer with data. */
  hasIncrementalBuffer(): boolean {
    return this._incrementalBuffer !== null && this._incrementalBuffer.segmentCount > 0;
  }

  /** Get the incremental render buffer for direct draw calls. */
  getIncrementalRenderBuffer(): Mesh3DRenderBuffer | null {
    return this._incrementalBuffer?.getRenderBuffer() ?? null;
  }

  /** Get the wall fill symbol for rendering. */
  getWallSymbol(): Mesh3DSymbol {
    const r = this.renderer;
    // Extract color from the renderer's symbol for a dummy feature
    const dummyFeature = { id: '__wall__', geometry: { type: 'Polygon' as const, coordinates: [] }, attributes: {} };
    const sym = r?.getSymbol?.(dummyFeature) ?? null;
    const color: [number, number, number, number] = sym && 'color' in sym ? sym.color : [255, 109, 58, 60];
    return {
      type: 'mesh-3d',
      meshType: 'box',
      color,
      ambient: 1,
      shininess: 18,
      specularStrength: 0,
    };
  }

  /**
   * Rebuild the incremental buffer with terrain elevation offsets baked in.
   * Called by the render path when elevationInfo.mode !== 'absolute'.
   */
  rebuildWithTerrain(elevationInfo: ElevationInfo, sampler: IWallElevationSampler): void {
    if (!this._incrementalBuffer || this._lons.length < 2) return;
    if (this._terrainApplied) return; // already applied, skip redundant rebuild
    this._incrementalBuffer.rebuildFromControlPoints(
      this._lons, this._lats, this._maxH, this._minH,
      elevationInfo, sampler,
    );
    this._terrainApplied = true;
  }

  override destroy(): void {
    this._incrementalBuffer?.destroy();
    this._incrementalBuffer = null;

    super.destroy();
  }

  // ─── Internal rebuild ───

  private _rebuild(): void {
    const n = this._lons.length;
    if (n < 2) {
      super.clear();
      return;
    }

    // Build lightweight fallback polygon features for extent/query behavior.
    // The actual wall rendering path now prefers raw wall control points and
    // generates a proper 3D curtain mesh from them.
    const OFFSET = 0.00001; // ~1m in degrees
    const features = [];
    for (let i = 0; i < n - 1; i++) {
      const lo0 = this._lons[i]!, la0 = this._lats[i]!;
      const lo1 = this._lons[i + 1]!, la1 = this._lats[i + 1]!;
      const bH0 = this._minH[i] ?? 0, bH1 = this._minH[i + 1] ?? 0;
      const tH0 = this._maxH[i]!, tH1 = this._maxH[i + 1]!;

      // Perpendicular offset direction for this segment
      const dx = lo1 - lo0, dy = la1 - la0;
      const len = Math.hypot(dx, dy) || 1;
      const px = (-dy / len) * OFFSET;
      const py = (dx / len) * OFFSET;

      features.push({
        id: `__wq${i}`,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[
            [lo0, la0, bH0],
            [lo1, la1, bH1],
            [lo1 + px, la1 + py, tH1],
            [lo0 + px, la0 + py, tH0],
            [lo0, la0, bH0], // close
          ]],
        },
        attributes: {},
      });
    }

    this.replaceAll(features);
  }
}
