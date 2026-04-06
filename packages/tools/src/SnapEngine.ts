/**
 * SnapEngine — Backward-compatible wrapper around the new snap system.
 *
 * Preserves the original API surface (SnapOptions, SnapResult with 'vertex'|'edge'|'none')
 * while delegating to the new multi-type SnapEngine under the hood.
 *
 * @deprecated Import from `./snap/index.js` for the full-featured snap engine.
 */

import type { Feature } from '@mapgpu/core';
import { SnapEngine as NewSnapEngine } from './snap/SnapEngine.js';
import { SnapType } from './snap/SnapTypes.js';
import type { SnapSourceLayer as NewSnapSourceLayer } from './snap/SnapTypes.js';

/* ── Legacy interfaces (preserved for backward compat) ────────────── */

export interface SnapOptions {
  /** Enable vertex snapping. Default: true */
  vertex?: boolean;
  /** Enable edge snapping. Default: false */
  edge?: boolean;
  /** Snap tolerance in screen pixels. Default: 10 */
  tolerance?: number;
}

export interface SnapResult {
  /** Snapped geographic coordinates. */
  coords: [number, number];
  /** Type of snap that occurred. */
  type: 'vertex' | 'edge' | 'none';
  /** Source feature ID, if snapped to a feature. */
  sourceFeatureId?: string | number;
}

export interface SnapSourceLayer {
  getFeatures(): readonly Feature[];
}

/* ── Wrapper class ─────────────────────────────────────────────────── */

export class SnapEngine {
  private _inner: NewSnapEngine;

  constructor(options: SnapOptions = {}) {
    const enabledTypes = new Set<SnapType>();
    if (options.vertex !== false) enabledTypes.add(SnapType.EndPoint);
    if (options.edge === true) enabledTypes.add(SnapType.Nearest);

    this._inner = new NewSnapEngine({
      tolerance: options.tolerance ?? 10,
      enabledTypes,
    });
  }

  addSourceLayer(layer: SnapSourceLayer): void {
    this._inner.addSourceLayer(layer as NewSnapSourceLayer);
  }

  removeSourceLayer(layer: SnapSourceLayer): void {
    this._inner.removeSourceLayer(layer as NewSnapSourceLayer);
  }

  snap(
    screenX: number,
    screenY: number,
    mapCoords: [number, number],
    toScreen: (lon: number, lat: number) => [number, number] | null,
  ): SnapResult {
    const result = this._inner.snap(screenX, screenY, mapCoords, toScreen);

    // Map new SnapType back to legacy type string
    let legacyType: 'vertex' | 'edge' | 'none' = 'none';
    if (result.type === SnapType.EndPoint || result.type === SnapType.Point) {
      legacyType = 'vertex';
    } else if (result.type === SnapType.Nearest) {
      legacyType = 'edge';
    }

    return {
      coords: result.coords,
      type: legacyType,
      sourceFeatureId: result.sourceFeatureId,
    };
  }

  get options(): { vertex: boolean; edge: boolean; tolerance: number } {
    const cfg = this._inner.config;
    return {
      vertex: cfg.enabledTypes.has(SnapType.EndPoint),
      edge: cfg.enabledTypes.has(SnapType.Nearest),
      tolerance: cfg.tolerance,
    };
  }

  setTolerance(px: number): void {
    this._inner.setTolerance(px);
  }
}
