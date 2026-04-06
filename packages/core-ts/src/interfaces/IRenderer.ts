/**
 * IRenderer -- Symbology system for feature layers.
 *
 * A renderer determines which symbol to use for each feature based on
 * its attributes and/or the current render context. Renderers are the
 * primary mechanism for data-driven styling in mapgpu.
 *
 * Renderers are optional on {@link IFeatureLayer} -- when absent, the default
 * symbols from VectorBufferCache are used.
 *
 * Three built-in implementations are provided:
 * - {@link SimpleRenderer}: applies the same symbol to every feature
 * - {@link UniqueValueRenderer}: maps discrete attribute values to symbols
 * - {@link ClassBreaksRenderer}: maps numeric attribute ranges to symbols
 *
 * @module IRenderer
 */

import type { PointSymbol, LineSymbol, PolygonSymbol, ModelSymbol, ExtrudedPolygonSymbol, Mesh3DSymbol } from './IRenderEngine.js';
import type { Feature } from './ILayer.js';

// ─── Symbol Union ───

/**
 * Union type representing all supported symbol kinds.
 *
 * Each variant corresponds to a geometry type:
 * - {@link PointSymbol} -- rendered as markers, icons, or SDF icons
 * - {@link LineSymbol} -- rendered as stroked lines (solid, dash, dot, dash-dot)
 * - {@link PolygonSymbol} -- rendered as filled polygons with outlines
 * - {@link ModelSymbol} -- rendered as 3D GLB models placed at point locations
 *
 * The `type` discriminant field on each variant enables narrowing:
 *
 * @example
 * ```ts
 * function describeSymbol(sym: Symbol): string {
 *   switch (sym.type) {
 *     case 'simple-marker':
 *     case 'icon':
 *     case 'sdf-icon':
 *       return `Point symbol, size=${sym.size}`;
 *     case 'simple-line':
 *       return `Line symbol, width=${sym.width}, style=${sym.style}`;
 *     case 'simple-fill':
 *       return `Fill symbol, outlineWidth=${sym.outlineWidth}`;
 *   }
 * }
 * ```
 */
export type Symbol = PointSymbol | LineSymbol | PolygonSymbol | ModelSymbol | ExtrudedPolygonSymbol | Mesh3DSymbol;

// ─── Render Context ───

/**
 * Contextual information about the current map view, passed to
 * {@link IRenderer.getSymbol} so renderers can implement zoom-dependent
 * or resolution-dependent symbology.
 *
 * @example
 * ```ts
 * // A renderer could use context to vary symbol size by zoom:
 * getSymbol(feature: Feature, context?: SymbolRenderContext): Symbol {
 *   const size = context ? Math.max(4, context.zoom * 2) : 8;
 *   return { type: 'simple-marker', color: [255,0,0,255], size };
 * }
 * ```
 */
export interface SymbolRenderContext {
  /**
   * Active render mode for the current frame.
   *
   * `surface` families can use this to keep a single world-space geometry
   * source while adapting purely visual choices between flat and globe views.
   */
  renderMode: '2d' | '3d';

  /**
   * Current map zoom level.
   *
   * Typically ranges from 0 (world view) to ~22 (building level).
   */
  zoom: number;

  /**
   * Ground resolution at the current zoom level, expressed as meters per pixel.
   *
   * Useful for scale-dependent rendering decisions such as hiding detailed
   * symbology at coarse zoom levels or adjusting line widths to maintain
   * a consistent real-world width.
   */
  resolution: number;
}

// ─── IRenderer ───

/**
 * Core interface for the symbology/renderer system.
 *
 * A renderer maps features to symbols. It is set on a feature layer to
 * control how each feature is drawn. The render engine calls
 * {@link getSymbol} once per feature per frame to determine the visual
 * representation.
 *
 * Implementations must be stateless with respect to the feature being
 * symbolized -- the same feature and context should always produce the
 * same symbol.
 *
 * @example
 * ```ts
 * // Assign a renderer to a layer:
 * import { SimpleRenderer } from '@mapgpu/core';
 *
 * const renderer: IRenderer = new SimpleRenderer({
 *   type: 'simple-fill',
 *   color: [0, 120, 255, 200],
 *   outlineColor: [0, 0, 0, 255],
 *   outlineWidth: 1,
 * });
 *
 * featureLayer.renderer = renderer;
 * ```
 */
export interface IRenderer {
  /**
   * Discriminant string identifying the renderer type.
   *
   * Built-in values: `'simple'`, `'unique-value'`, `'class-breaks'`, `'callback'`.
   * Custom renderer implementations should use a unique string.
   */
  readonly type: string;

  /**
   * When true, the renderer's symbols may vary with zoom level.
   *
   * This causes VectorBufferCache to pass the current zoom via
   * {@link SymbolRenderContext} and to invalidate cached buffers
   * when the zoom changes (since symbols may differ per zoom).
   *
   * Default: false (symbols are zoom-independent).
   */
  readonly zoomSensitive?: boolean;

  /**
   * Resolve the symbol for a given feature.
   *
   * Called by the render engine once per feature during each render pass.
   * The implementation should inspect the feature's attributes (and
   * optionally the render context) to determine which symbol to return.
   *
   * Returning `null` indicates the feature should not be drawn in this
   * frame -- this can be used for attribute-based visibility filtering.
   *
   * @param feature - The feature to symbolize. The renderer typically
   *   reads from `feature.attributes` to make symbology decisions.
   * @param context - Optional render context providing the current zoom
   *   level and resolution. May be `undefined` during unit tests or
   *   when the view has not yet initialized.
   * @returns The symbol to use for rendering, or `null` to hide the feature.
   *
   * @example
   * ```ts
   * const sym = renderer.getSymbol(feature, { renderMode: '3d', zoom: 10, resolution: 152.87 });
   * if (sym) {
   *   // draw feature with sym
   * }
   * ```
   */
  getSymbol(feature: Feature, context?: SymbolRenderContext): Symbol | null;
}
