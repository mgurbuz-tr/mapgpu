/**
 * SimpleRenderer -- applies the same symbol to every feature in a layer.
 *
 * This is the most basic renderer: all features share a single symbol
 * regardless of their attributes. Use it when uniform styling is desired
 * (e.g., all polygons the same color).
 *
 * @example
 * ```ts
 * import { SimpleRenderer } from '@mapgpu/core';
 *
 * // All features rendered as red filled polygons:
 * const renderer = new SimpleRenderer({
 *   type: 'simple-fill',
 *   color: [255, 0, 0, 180],
 *   outlineColor: [0, 0, 0, 255],
 *   outlineWidth: 2,
 * });
 * layer.renderer = renderer;
 * ```
 *
 * @example
 * ```ts
 * // All features rendered as blue markers:
 * const renderer = new SimpleRenderer({
 *   type: 'simple-marker',
 *   color: [0, 100, 255, 255],
 *   size: 10,
 *   outlineColor: [255, 255, 255, 255],
 *   outlineWidth: 1,
 * });
 * ```
 *
 * @module SimpleRenderer
 */

import type { IRenderer, Symbol, SymbolRenderContext } from '../interfaces/IRenderer.js';
import type { Feature } from '../interfaces/ILayer.js';

/**
 * A renderer that applies a single, uniform symbol to every feature.
 *
 * The simplest renderer implementation -- `getSymbol()` always returns
 * the same symbol, ignoring both the feature's attributes and the
 * render context.
 *
 * @example
 * ```ts
 * const renderer = new SimpleRenderer({
 *   type: 'simple-line',
 *   color: [0, 0, 0, 255],
 *   width: 2,
 *   style: 'solid',
 * });
 *
 * const sym = renderer.getSymbol(anyFeature);
 * // sym is always the line symbol above
 * ```
 */
export class SimpleRenderer implements IRenderer {
  /** Discriminant identifying this as a simple renderer. Always `'simple'`. */
  readonly type = 'simple';

  /**
   * The symbol applied to all features.
   *
   * Set once at construction time and never changes. Can be a
   * {@link PointSymbol}, {@link LineSymbol}, or {@link PolygonSymbol}.
   */
  readonly symbol: Symbol;

  /**
   * Create a new SimpleRenderer.
   *
   * @param symbol - The symbol to apply to every feature. Must match the
   *   geometry type of the layer (e.g., a PolygonSymbol for polygon layers).
   *
   * @example
   * ```ts
   * const renderer = new SimpleRenderer({
   *   type: 'simple-fill',
   *   color: [100, 149, 237, 200],
   *   outlineColor: [25, 25, 112, 255],
   *   outlineWidth: 1,
   * });
   * ```
   */
  constructor(symbol: Symbol) {
    this.symbol = symbol;
  }

  /**
   * Returns the same symbol for every feature.
   *
   * Both parameters are ignored -- the constructor-provided symbol is
   * always returned. This method never returns `null`, so no features
   * are hidden.
   *
   * @param _feature - The feature to symbolize (ignored).
   * @param _context - Optional render context (ignored).
   * @returns The single symbol assigned to this renderer.
   *
   * @example
   * ```ts
   * const sym = renderer.getSymbol(feature, { zoom: 5, resolution: 4891.97 });
   * // Always returns the same symbol regardless of feature or zoom
   * ```
   */
  getSymbol(_feature: Feature, _context?: SymbolRenderContext): Symbol {
    return this.symbol;
  }
}
