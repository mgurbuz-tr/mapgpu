/**
 * 3D Tiles Styling Language — Declarative feature styling for 3D Tiles.
 *
 * CesiumJS Cesium3DTileStyle equivalent. Evaluates JSON-based style conditions
 * against batch table properties to produce per-feature color, show, and pointSize.
 *
 * @example
 * ```ts
 * const style = new TileStyle({
 *   color: {
 *     conditions: [
 *       ['${height} > 100', 'color("red")'],
 *       ['${height} > 50',  'color("orange")'],
 *       ['true',            'color("white")'],
 *     ],
 *   },
 *   show: '${type} !== "parking"',
 *   pointSize: '${population} / 1000 + 3',
 * });
 * ```
 */

export interface TileStyleDefinition {
  /** Color expression or conditions. */
  color?: string | { conditions: [string, string][] };
  /** Show/hide expression (boolean result). */
  show?: string | boolean;
  /** Point size expression (number result). */
  pointSize?: string | number;
}

export interface TileStyleResult {
  color: [number, number, number, number]; // RGBA 0-255
  show: boolean;
  pointSize: number;
}

const DEFAULT_RESULT: TileStyleResult = {
  color: [255, 255, 255, 255],
  show: true,
  pointSize: 3,
};

export class TileStyle {
  private readonly _definition: TileStyleDefinition;

  constructor(definition: TileStyleDefinition = {}) {
    this._definition = definition;
  }

  get definition(): TileStyleDefinition {
    return this._definition;
  }

  /**
   * Evaluate style against a set of feature properties.
   *
   * @param properties - Batch table properties for a single feature.
   * @returns Resolved color, show flag, and point size.
   */
  evaluate(properties: Record<string, unknown>): TileStyleResult {
    return {
      color: this._evaluateColor(properties),
      show: this._evaluateShow(properties),
      pointSize: this._evaluatePointSize(properties),
    };
  }

  private _evaluateColor(props: Record<string, unknown>): [number, number, number, number] {
    const colorDef = this._definition.color;
    if (!colorDef) return DEFAULT_RESULT.color;

    if (typeof colorDef === 'string') {
      return _parseColorExpr(colorDef, props);
    }

    // Conditions: first match wins
    for (const [condition, colorExpr] of colorDef.conditions) {
      if (_evaluateBoolExpr(condition, props)) {
        return _parseColorExpr(colorExpr, props);
      }
    }

    return DEFAULT_RESULT.color;
  }

  private _evaluateShow(props: Record<string, unknown>): boolean {
    const showDef = this._definition.show;
    if (showDef === undefined) return true;
    if (typeof showDef === 'boolean') return showDef;
    return _evaluateBoolExpr(showDef, props);
  }

  private _evaluatePointSize(props: Record<string, unknown>): number {
    const sizeDef = this._definition.pointSize;
    if (sizeDef === undefined) return DEFAULT_RESULT.pointSize;
    if (typeof sizeDef === 'number') return sizeDef;
    return _evaluateNumExpr(sizeDef, props);
  }
}

// ─── Expression Evaluator ────────────────────────────────────────────

/**
 * Substitute `${propertyName}` with actual values from properties.
 */
function _substituteProps(expr: string, props: Record<string, unknown>): string {
  return expr.replaceAll(/\$\{(\w+)\}/g, (_match, key: string) => {
    const val = props[key];
    if (val === undefined || val === null) return '0';
    if (typeof val === 'string') return `"${val}"`;
    if (typeof val === 'object' || typeof val === 'function') return JSON.stringify(val);
    return `${val as number | boolean}`;
  });
}

/**
 * Evaluate a simple boolean expression.
 * Supports: comparisons (>, <, >=, <=, ===, !==), 'true', 'false', and basic &&/||.
 */
function _evaluateBoolExpr(expr: string, props: Record<string, unknown>): boolean {
  const substituted = _substituteProps(expr, props);

  if (substituted.trim() === 'true') return true;
  if (substituted.trim() === 'false') return false;

  // Simple comparison: "value op value"
  const compMatch = /^(.+?)\s*(===|!==|>=|<=|>|<)\s*(.+)$/.exec(substituted);
  if (compMatch) {
    const left = _coerce(compMatch[1]!.trim());
    const right = _coerce(compMatch[3]!.trim());
    const op = compMatch[2]!;
    switch (op) {
      case '>':   return (left as number) > (right as number);
      case '<':   return (left as number) < (right as number);
      case '>=':  return (left as number) >= (right as number);
      case '<=':  return (left as number) <= (right as number);
      case '===': return left === right;
      case '!==': return left !== right;
    }
  }

  return Boolean(_coerce(substituted.trim()));
}

/**
 * Evaluate a simple numeric expression.
 * Supports: basic arithmetic (+, -, *, /), and property substitution.
 */
function _evaluateNumExpr(expr: string, props: Record<string, unknown>): number {
  const substituted = _substituteProps(expr, props);
  // Simple arithmetic eval via Function (safe: only numbers)
  try {
    const cleaned = substituted.replaceAll(/[^0-9+\-*/.()\s]/g, '');
    return Number(new Function(`return (${cleaned})`)()) || DEFAULT_RESULT.pointSize;
  } catch {
    return DEFAULT_RESULT.pointSize;
  }
}

/**
 * Parse a color expression like `color("red")`, `rgba(255,0,0,255)`, `#ff0000`.
 */
function _parseColorExpr(expr: string, props: Record<string, unknown>): [number, number, number, number] {
  const substituted = _substituteProps(expr, props);

  // color("name") or color("#hex")
  const colorFnMatch = /color\(\s*"([^"]+)"\s*\)/.exec(substituted);
  if (colorFnMatch) return _namedColor(colorFnMatch[1]!);

  // rgba(r, g, b, a) — values 0-255
  const rgbaMatch = /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/.exec(substituted);
  if (rgbaMatch) {
    return [
      Number(rgbaMatch[1]),
      Number(rgbaMatch[2]),
      Number(rgbaMatch[3]),
      Math.round(Number(rgbaMatch[4]) * (Number(rgbaMatch[4]) <= 1 ? 255 : 1)),
    ];
  }

  // rgb(r, g, b) — values 0-255
  const rgbMatch = /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/.exec(substituted);
  if (rgbMatch) {
    return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3]), 255];
  }

  // #rrggbb hex
  const hexMatch = /#([0-9a-fA-F]{6})/.exec(substituted);
  if (hexMatch) {
    const hex = hexMatch[1]!;
    return [
      Number.parseInt(hex.slice(0, 2), 16),
      Number.parseInt(hex.slice(2, 4), 16),
      Number.parseInt(hex.slice(4, 6), 16),
      255,
    ];
  }

  return DEFAULT_RESULT.color;
}

function _namedColor(name: string): [number, number, number, number] {
  const colors: Record<string, [number, number, number, number]> = {
    red: [255, 0, 0, 255],
    green: [0, 128, 0, 255],
    blue: [0, 0, 255, 255],
    yellow: [255, 255, 0, 255],
    orange: [255, 165, 0, 255],
    white: [255, 255, 255, 255],
    black: [0, 0, 0, 255],
    gray: [128, 128, 128, 255],
    cyan: [0, 255, 255, 255],
    magenta: [255, 0, 255, 255],
    transparent: [0, 0, 0, 0],
  };

  // Check named color
  if (colors[name.toLowerCase()]) return colors[name.toLowerCase()]!;

  // Check hex
  if (name.startsWith('#')) return _parseColorExpr(name, {});

  return DEFAULT_RESULT.color;
}

function _coerce(val: string): string | number | boolean {
  if (val === 'true') return true;
  if (val === 'false') return false;
  // Remove quotes
  if (val.startsWith('"') && val.endsWith('"')) return val.slice(1, -1);
  const n = Number(val);
  if (!Number.isNaN(n)) return n;
  return val;
}
