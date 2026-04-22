/**
 * UniqueValueRenderer -- maps discrete attribute values to individual symbols.
 *
 * Each distinct value of a specified attribute field is associated with its
 * own symbol. Features whose attribute value is not in the map receive the
 * default symbol.
 *
 * Internally uses a `Map<string | number, Symbol>` for O(1) lookups.
 *
 * @example
 * ```ts
 * import { UniqueValueRenderer } from '../index.js';
 *
 * const renderer = new UniqueValueRenderer({
 *   field: 'landuse',
 *   defaultSymbol: {
 *     type: 'simple-fill',
 *     color: [128, 128, 128, 255],
 *     outlineColor: [0, 0, 0, 255],
 *     outlineWidth: 1,
 *   },
 *   uniqueValues: [
 *     {
 *       value: 'residential',
 *       symbol: { type: 'simple-fill', color: [255, 255, 150, 255], outlineColor: [0, 0, 0, 255], outlineWidth: 1 },
 *     },
 *     {
 *       value: 'commercial',
 *       symbol: { type: 'simple-fill', color: [150, 150, 255, 255], outlineColor: [0, 0, 0, 255], outlineWidth: 1 },
 *     },
 *     {
 *       value: 'industrial',
 *       symbol: { type: 'simple-fill', color: [200, 150, 200, 255], outlineColor: [0, 0, 0, 255], outlineWidth: 1 },
 *     },
 *   ],
 * });
 * layer.renderer = renderer;
 * ```
 *
 * @module UniqueValueRenderer
 */

import type { IRenderer, Symbol, SymbolRenderContext } from '../interfaces/IRenderer.js';
import type { Feature } from '../interfaces/ILayer.js';

/**
 * Describes a mapping from a single attribute value to a symbol.
 *
 * Used as an entry in {@link UniqueValueRendererOptions.uniqueValues}.
 *
 * @example
 * ```ts
 * const info: UniqueValueInfo = {
 *   value: 'highway',
 *   symbol: { type: 'simple-line', color: [255, 100, 0, 255], width: 3, style: 'solid' },
 * };
 * ```
 */
export interface UniqueValueInfo {
  /**
   * The attribute value to match against.
   *
   * Compared using strict equality (`===`) with the feature's attribute
   * value after a `Map.get()` lookup. Both strings and numbers are
   * supported.
   */
  value: string | number;

  /**
   * The symbol to render when the feature's attribute matches {@link value}.
   */
  symbol: Symbol;
}

/**
 * Configuration options for constructing a {@link UniqueValueRenderer}.
 *
 * @example
 * ```ts
 * const options: UniqueValueRendererOptions = {
 *   field: 'status',
 *   defaultSymbol: { type: 'simple-marker', color: [128,128,128,255], size: 6 },
 *   uniqueValues: [
 *     { value: 'active',   symbol: { type: 'simple-marker', color: [0,255,0,255], size: 8 } },
 *     { value: 'inactive', symbol: { type: 'simple-marker', color: [255,0,0,255], size: 6 } },
 *   ],
 * };
 * ```
 */
export interface UniqueValueRendererOptions {
  /**
   * The attribute field name to read from each feature's `attributes` object.
   *
   * The value at `feature.attributes[field]` is used for the symbol lookup.
   */
  field: string;

  /**
   * Fallback symbol used when a feature's attribute value is `null`,
   * `undefined`, or not present in the {@link uniqueValues} map.
   */
  defaultSymbol: Symbol;

  /**
   * Array of value-to-symbol mappings.
   *
   * Each entry associates a discrete attribute value with a symbol.
   * If duplicate values are provided, the last one wins (standard
   * `Map` constructor behavior).
   */
  uniqueValues: UniqueValueInfo[];
  /** Optional zoom-sensitivity hint for cache invalidation in vector pipelines. */
  zoomSensitive?: boolean;
}

/**
 * A renderer that assigns symbols based on discrete attribute values.
 *
 * Ideal for categorical data such as land-use types, road classifications,
 * or status codes where each distinct value should have its own visual style.
 *
 * @example
 * ```ts
 * const renderer = new UniqueValueRenderer({
 *   field: 'type',
 *   defaultSymbol: { type: 'simple-fill', color: [128,128,128,255], outlineColor: [0,0,0,255], outlineWidth: 1 },
 *   uniqueValues: [
 *     { value: 'park',   symbol: { type: 'simple-fill', color: [0,180,0,255], outlineColor: [0,0,0,255], outlineWidth: 1 } },
 *     { value: 'water',  symbol: { type: 'simple-fill', color: [0,100,255,255], outlineColor: [0,0,0,255], outlineWidth: 1 } },
 *   ],
 * });
 *
 * const sym = renderer.getSymbol({ id: 1, geometry: g, attributes: { type: 'park' } });
 * // Returns the green park symbol
 *
 * const sym2 = renderer.getSymbol({ id: 2, geometry: g, attributes: { type: 'unknown' } });
 * // Returns the gray default symbol
 * ```
 */
export class UniqueValueRenderer implements IRenderer {
  /** Discriminant identifying this as a unique-value renderer. Always `'unique-value'`. */
  readonly type = 'unique-value';

  /**
   * The attribute field name used for symbol lookup.
   *
   * The renderer reads `feature.attributes[field]` to determine which
   * symbol to return.
   */
  readonly field: string;

  /**
   * Fallback symbol returned when the feature's attribute value does not
   * match any entry in the value map, or when the attribute is missing.
   */
  readonly defaultSymbol: Symbol;
  /** Public copy of configured unique-value mapping (serializable). */
  readonly uniqueValues: readonly UniqueValueInfo[];
  readonly zoomSensitive?: boolean;

  /**
   * Internal lookup map from attribute value to symbol.
   *
   * Built once at construction time from the provided `uniqueValues` array.
   * @internal
   */
  private readonly _map: Map<string | number, Symbol>;

  /**
   * Create a new UniqueValueRenderer.
   *
   * @param options - Configuration specifying the field, default symbol,
   *   and the array of value-to-symbol mappings.
   *
   * @example
   * ```ts
   * const renderer = new UniqueValueRenderer({
   *   field: 'category',
   *   defaultSymbol: { type: 'simple-marker', color: [128,128,128,255], size: 6 },
   *   uniqueValues: [
   *     { value: 'A', symbol: { type: 'simple-marker', color: [255,0,0,255], size: 8 } },
   *     { value: 'B', symbol: { type: 'simple-marker', color: [0,0,255,255], size: 8 } },
   *   ],
   * });
   * ```
   */
  constructor(options: UniqueValueRendererOptions) {
    this.field = options.field;
    this.defaultSymbol = options.defaultSymbol;
    this.uniqueValues = options.uniqueValues.slice();
    this.zoomSensitive = options.zoomSensitive;
    this._map = new Map(
      options.uniqueValues.map((uv) => [uv.value, uv.symbol]),
    );
  }

  /**
   * Look up the symbol for a feature based on its attribute value.
   *
   * Reads `feature.attributes[this.field]` and performs an O(1) map
   * lookup. Returns {@link defaultSymbol} when:
   * - The attribute value is `null` or `undefined`
   * - The value is not present in the unique values map
   *
   * This method never returns `null` -- all features are always drawn.
   *
   * @param feature - The feature whose attribute value determines the symbol.
   * @param _context - Optional render context (currently unused by this renderer).
   * @returns The matched symbol, or the default symbol if no match is found.
   *
   * @example
   * ```ts
   * const feature = { id: 42, geometry: geom, attributes: { landuse: 'residential' } };
   * const sym = renderer.getSymbol(feature);
   * // Returns the symbol mapped to 'residential', or defaultSymbol if unmapped
   * ```
   */
  getSymbol(feature: Feature, _context?: SymbolRenderContext): Symbol {
    const val = feature.attributes[this.field];
    if (val === undefined || val === null) return this.defaultSymbol;
    return this._map.get(val as string | number) ?? this.defaultSymbol;
  }
}
