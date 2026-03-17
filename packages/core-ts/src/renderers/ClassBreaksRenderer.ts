/**
 * ClassBreaksRenderer -- maps numeric attribute ranges (class breaks) to symbols.
 *
 * Each break defines a half-open interval `[min, max)`. The feature's
 * numeric attribute value is compared against breaks in order; the first
 * matching range determines the symbol. If no break matches (or the
 * attribute is non-numeric), the default symbol is used.
 *
 * Breaks should be contiguous and non-overlapping for predictable results.
 * Use `Infinity` as the `max` of the last break to capture all values
 * above a threshold.
 *
 * @example
 * ```ts
 * import { ClassBreaksRenderer } from '@mapgpu/core';
 *
 * const renderer = new ClassBreaksRenderer({
 *   field: 'population',
 *   defaultSymbol: { type: 'simple-marker', color: [128,128,128,255], size: 4 },
 *   breaks: [
 *     { min: 0,        max: 10000,    symbol: { type: 'simple-marker', color: [200,230,200,255], size: 4 } },
 *     { min: 10000,    max: 100000,   symbol: { type: 'simple-marker', color: [100,200,100,255], size: 8 } },
 *     { min: 100000,   max: 1000000,  symbol: { type: 'simple-marker', color: [0,150,0,255],     size: 12 } },
 *     { min: 1000000,  max: Infinity, symbol: { type: 'simple-marker', color: [0,80,0,255],      size: 18 } },
 *   ],
 * });
 * layer.renderer = renderer;
 * ```
 *
 * @module ClassBreaksRenderer
 */

import type { IRenderer, Symbol, SymbolRenderContext } from '../interfaces/IRenderer.js';
import type { Feature } from '../interfaces/ILayer.js';

/**
 * Describes a single numeric class break: a half-open interval `[min, max)`
 * mapped to a symbol.
 *
 * @example
 * ```ts
 * const breakInfo: ClassBreakInfo = {
 *   min: 0,
 *   max: 100,
 *   symbol: { type: 'simple-fill', color: [0,255,0,128], outlineColor: [0,0,0,255], outlineWidth: 1 },
 * };
 * ```
 */
export interface ClassBreakInfo {
  /**
   * Lower bound of the interval (inclusive).
   *
   * A feature's attribute value must be `>= min` to match this break.
   */
  min: number;

  /**
   * Upper bound of the interval (exclusive).
   *
   * A feature's attribute value must be `< max` to match this break.
   * Use `Infinity` for the final break to capture all remaining values.
   */
  max: number;

  /**
   * The symbol to render when the feature's attribute value falls within
   * the `[min, max)` range.
   */
  symbol: Symbol;
}

/**
 * Configuration options for constructing a {@link ClassBreaksRenderer}.
 *
 * @example
 * ```ts
 * const options: ClassBreaksRendererOptions = {
 *   field: 'elevation',
 *   defaultSymbol: { type: 'simple-fill', color: [128,128,128,255], outlineColor: [0,0,0,255], outlineWidth: 1 },
 *   breaks: [
 *     { min: 0,    max: 500,      symbol: { type: 'simple-fill', color: [0,150,0,255],   outlineColor: [0,0,0,255], outlineWidth: 1 } },
 *     { min: 500,  max: 1500,     symbol: { type: 'simple-fill', color: [200,200,0,255], outlineColor: [0,0,0,255], outlineWidth: 1 } },
 *     { min: 1500, max: Infinity, symbol: { type: 'simple-fill', color: [180,80,0,255],  outlineColor: [0,0,0,255], outlineWidth: 1 } },
 *   ],
 * };
 * ```
 */
export interface ClassBreaksRendererOptions {
  /**
   * The numeric attribute field name to read from each feature.
   *
   * The value at `feature.attributes[field]` is tested against each break.
   * Non-numeric values cause the default symbol to be returned.
   */
  field: string;

  /**
   * Fallback symbol used when:
   * - The attribute value is not a number
   * - The attribute is missing (`undefined` or `null`)
   * - The numeric value does not fall within any break range
   */
  defaultSymbol: Symbol;

  /**
   * Ordered array of class breaks.
   *
   * Breaks are evaluated in array order; the first matching range wins.
   * For best results, keep breaks contiguous (each break's `min` equals
   * the previous break's `max`) and non-overlapping.
   */
  breaks: ClassBreakInfo[];
  /** Optional zoom-sensitivity hint for cache invalidation in vector pipelines. */
  zoomSensitive?: boolean;
}

/**
 * A renderer that assigns symbols based on numeric attribute ranges.
 *
 * Ideal for quantitative data such as population density, elevation,
 * temperature, or any continuous numeric attribute that should be
 * classified into discrete visual categories.
 *
 * The matching rule for each break is: `min <= value < max` (half-open
 * interval, inclusive lower bound, exclusive upper bound).
 *
 * @example
 * ```ts
 * const renderer = new ClassBreaksRenderer({
 *   field: 'temperature',
 *   defaultSymbol: { type: 'simple-marker', color: [128,128,128,255], size: 6 },
 *   breaks: [
 *     { min: -40, max: 0,   symbol: { type: 'simple-marker', color: [0,0,255,255],   size: 8 } },
 *     { min: 0,   max: 20,  symbol: { type: 'simple-marker', color: [0,200,0,255],   size: 8 } },
 *     { min: 20,  max: 35,  symbol: { type: 'simple-marker', color: [255,200,0,255], size: 8 } },
 *     { min: 35,  max: 60,  symbol: { type: 'simple-marker', color: [255,0,0,255],   size: 8 } },
 *   ],
 * });
 *
 * // Feature with temperature=25 gets the yellow symbol (20 <= 25 < 35)
 * const sym = renderer.getSymbol({ id: 1, geometry: g, attributes: { temperature: 25 } });
 *
 * // Feature with temperature=-50 gets the default gray symbol (no break matches)
 * const sym2 = renderer.getSymbol({ id: 2, geometry: g, attributes: { temperature: -50 } });
 * ```
 */
export class ClassBreaksRenderer implements IRenderer {
  /** Discriminant identifying this as a class-breaks renderer. Always `'class-breaks'`. */
  readonly type = 'class-breaks';

  /**
   * The numeric attribute field name used for classification.
   *
   * The renderer reads `feature.attributes[field]` and checks whether
   * the value is a number before testing it against breaks.
   */
  readonly field: string;

  /**
   * Fallback symbol returned when the attribute is non-numeric, missing,
   * or does not fall within any defined break range.
   */
  readonly defaultSymbol: Symbol;

  /**
   * Immutable array of class breaks, evaluated in order.
   *
   * The first break whose range `[min, max)` contains the attribute
   * value is used. Subsequent breaks are not tested.
   */
  readonly breaks: readonly ClassBreakInfo[];
  readonly zoomSensitive?: boolean;

  /**
   * Create a new ClassBreaksRenderer.
   *
   * @param options - Configuration specifying the field, default symbol,
   *   and the ordered array of class breaks.
   *
   * @example
   * ```ts
   * const renderer = new ClassBreaksRenderer({
   *   field: 'magnitude',
   *   defaultSymbol: { type: 'simple-marker', color: [200,200,200,255], size: 4 },
   *   breaks: [
   *     { min: 0, max: 3,        symbol: { type: 'simple-marker', color: [0,200,0,255],   size: 5 } },
   *     { min: 3, max: 5,        symbol: { type: 'simple-marker', color: [255,165,0,255], size: 9 } },
   *     { min: 5, max: Infinity, symbol: { type: 'simple-marker', color: [255,0,0,255],   size: 14 } },
   *   ],
   * });
   * ```
   */
  constructor(options: ClassBreaksRendererOptions) {
    this.field = options.field;
    this.defaultSymbol = options.defaultSymbol;
    this.breaks = options.breaks;
    this.zoomSensitive = options.zoomSensitive;
  }

  /**
   * Determine the symbol for a feature by classifying its numeric attribute.
   *
   * Reads `feature.attributes[this.field]` and returns:
   * - The symbol from the first break where `min <= value < max`
   * - {@link defaultSymbol} if the value is not a number
   * - {@link defaultSymbol} if no break range matches
   *
   * This method never returns `null` -- all features are always drawn.
   *
   * @param feature - The feature whose numeric attribute is classified.
   * @param _context - Optional render context (currently unused by this renderer).
   * @returns The symbol for the matching class break, or the default symbol.
   *
   * @example
   * ```ts
   * const feature = { id: 7, geometry: geom, attributes: { population: 250000 } };
   * const sym = renderer.getSymbol(feature);
   * // Returns the symbol whose break range contains 250000
   * ```
   */
  getSymbol(feature: Feature, _context?: SymbolRenderContext): Symbol {
    const val = feature.attributes[this.field];
    if (typeof val !== 'number') return this.defaultSymbol;

    for (const brk of this.breaks) {
      if (val >= brk.min && val < brk.max) {
        return brk.symbol;
      }
    }

    return this.defaultSymbol;
  }
}
