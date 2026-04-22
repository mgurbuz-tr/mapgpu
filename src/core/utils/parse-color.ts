/**
 * parseColor — Normalize various CSS color inputs to an `[r, g, b, a]` tuple
 * with each channel in the 0-1 range (the format expected by the WebGPU
 * clear color and by `GlobeEffectsConfig.backgroundColor`).
 *
 * Accepted inputs:
 * - `"transparent"`                         → `[0, 0, 0, 0]`
 * - `"rgba(r, g, b, a)"`                    channels 0-255, alpha 0-1
 * - `"rgb(r, g, b)"`                        channels 0-255, alpha = 1
 * - `"#rrggbb"` / `"#rgb"`                  alpha = 1
 * - `"#rrggbbaa"` / `"#rgba"`               per-channel (incl. alpha)
 * - A handful of named CSS colors           (`"black"`, `"white"`, `"red"`, …)
 * - `[r, g, b, a]` tuple (0-1)              pass-through
 *
 * The parser is intentionally small and dependency-free. It is NOT a full
 * CSS Color 4 implementation — just the subset consumers of the public API
 * actually reach for.
 */

export type ColorInput = string | [number, number, number, number];
export type RgbaTuple = [number, number, number, number];

const NAMED_COLORS: Record<string, RgbaTuple> = {
  transparent: [0, 0, 0, 0],
  black: [0, 0, 0, 1],
  white: [1, 1, 1, 1],
  red: [1, 0, 0, 1],
  green: [0, 128 / 255, 0, 1],
  lime: [0, 1, 0, 1],
  blue: [0, 0, 1, 1],
  yellow: [1, 1, 0, 1],
  cyan: [0, 1, 1, 1],
  magenta: [1, 0, 1, 1],
  orange: [1, 165 / 255, 0, 1],
  gray: [128 / 255, 128 / 255, 128 / 255, 1],
  grey: [128 / 255, 128 / 255, 128 / 255, 1],
  silver: [192 / 255, 192 / 255, 192 / 255, 1],
  purple: [128 / 255, 0, 128 / 255, 1],
  navy: [0, 0, 128 / 255, 1],
  teal: [0, 128 / 255, 128 / 255, 1],
};

/**
 * Parse a color input into a normalized `[r, g, b, a]` tuple with channels
 * in the 0-1 range.
 *
 * @throws {Error} If the input is a string that cannot be parsed, or a tuple
 *   that is not exactly 4 finite numbers.
 */
export function parseColor(input: ColorInput): RgbaTuple {
  if (Array.isArray(input)) {
    return validateTuple(input);
  }
  if (typeof input !== 'string') {
    throw new Error(`parseColor: expected string or [r, g, b, a] tuple, got ${typeof input}`);
  }

  const raw = input.trim();
  if (raw.length === 0) {
    throw new Error('parseColor: input string is empty');
  }
  const lower = raw.toLowerCase();

  // Named colors.
  if (Object.prototype.hasOwnProperty.call(NAMED_COLORS, lower)) {
    const named = NAMED_COLORS[lower]!;
    return [named[0], named[1], named[2], named[3]];
  }

  // Hex: #rgb, #rgba, #rrggbb, #rrggbbaa.
  if (raw.startsWith('#')) {
    return parseHex(raw);
  }

  // rgba(...) / rgb(...) — case-insensitive, allow whitespace + commas or spaces.
  const fnMatch = /^(rgba?)\s*\(([^)]*)\)$/i.exec(raw);
  if (fnMatch) {
    const fn = fnMatch[1]!.toLowerCase() === 'rgba' ? 'rgba' : 'rgb';
    return parseRgbFunction(fn, fnMatch[2]!);
  }

  throw new Error(`parseColor: unrecognized color string "${input}"`);
}

function validateTuple(input: unknown[]): RgbaTuple {
  if (input.length !== 4) {
    throw new Error(`parseColor: tuple must have exactly 4 entries, got ${input.length}`);
  }
  const [r, g, b, a] = input;
  for (const v of [r, g, b, a]) {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error('parseColor: tuple channels must be finite numbers');
    }
  }
  return [r as number, g as number, b as number, a as number];
}

function parseHex(input: string): RgbaTuple {
  const hex = input.slice(1);
  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error(`parseColor: invalid hex color "${input}"`);
  }
  let r: number;
  let g: number;
  let b: number;
  let a = 1;
  if (hex.length === 3) {
    r = Number.parseInt(hex[0]! + hex[0]!, 16);
    g = Number.parseInt(hex[1]! + hex[1]!, 16);
    b = Number.parseInt(hex[2]! + hex[2]!, 16);
  } else if (hex.length === 4) {
    r = Number.parseInt(hex[0]! + hex[0]!, 16);
    g = Number.parseInt(hex[1]! + hex[1]!, 16);
    b = Number.parseInt(hex[2]! + hex[2]!, 16);
    a = Number.parseInt(hex[3]! + hex[3]!, 16) / 255;
  } else if (hex.length === 6) {
    r = Number.parseInt(hex.slice(0, 2), 16);
    g = Number.parseInt(hex.slice(2, 4), 16);
    b = Number.parseInt(hex.slice(4, 6), 16);
  } else if (hex.length === 8) {
    r = Number.parseInt(hex.slice(0, 2), 16);
    g = Number.parseInt(hex.slice(2, 4), 16);
    b = Number.parseInt(hex.slice(4, 6), 16);
    a = Number.parseInt(hex.slice(6, 8), 16) / 255;
  } else {
    throw new Error(`parseColor: hex color "${input}" must have 3, 4, 6, or 8 digits`);
  }
  return [r / 255, g / 255, b / 255, a];
}

function parseRgbFunction(fn: 'rgb' | 'rgba', body: string): RgbaTuple {
  // Accept either comma-separated ("rgb(1, 2, 3)") or whitespace/slash
  // ("rgb(1 2 3 / 0.5)"). Split on commas OR whitespace / slashes.
  const parts = body
    .split(/[,\s/]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const expected = fn === 'rgba' ? 4 : 3;
  if (parts.length !== expected) {
    throw new Error(
      `parseColor: ${fn}() expected ${expected} values, got ${parts.length} ("${body.trim()}")`,
    );
  }

  const channel = (raw: string): number => {
    if (raw.endsWith('%')) {
      const pct = Number.parseFloat(raw.slice(0, -1));
      if (!Number.isFinite(pct)) {
        throw new Error(`parseColor: invalid percentage "${raw}"`);
      }
      return clamp01(pct / 100);
    }
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n)) {
      throw new Error(`parseColor: invalid channel value "${raw}"`);
    }
    return clamp01(n / 255);
  };

  const r = channel(parts[0]!);
  const g = channel(parts[1]!);
  const b = channel(parts[2]!);
  let a = 1;
  if (fn === 'rgba') {
    const rawA = parts[3]!;
    if (rawA.endsWith('%')) {
      const pct = Number.parseFloat(rawA.slice(0, -1));
      if (!Number.isFinite(pct)) {
        throw new Error(`parseColor: invalid alpha "${rawA}"`);
      }
      a = clamp01(pct / 100);
    } else {
      const n = Number.parseFloat(rawA);
      if (!Number.isFinite(n)) {
        throw new Error(`parseColor: invalid alpha "${rawA}"`);
      }
      // Alpha is conventionally 0-1, but accept 0-255 too if someone passes
      // an integer > 1 (mirrors TileStyle behavior).
      a = clamp01(n <= 1 ? n : n / 255);
    }
  }
  return [r, g, b, a];
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
