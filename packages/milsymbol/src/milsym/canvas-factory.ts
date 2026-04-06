/**
 * canvas-factory — Browser-first canvas creation with Node.js fallback.
 *
 * Uses OffscreenCanvas in browser environments.
 * Falls back to 'canvas' npm package in Node.js (must be installed as devDependency).
 */

let _factory: ((w: number, h: number) => any) | null = null;

export function createMeasureCanvas(w: number, h: number): any {
  if (_factory) return _factory(w, h);

  // Browser: OffscreenCanvas
  if (typeof OffscreenCanvas !== 'undefined') {
    _factory = (ww, hh) => new OffscreenCanvas(ww, hh);
    return _factory(w, h);
  }

  // Node.js: require('canvas')
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('canvas');
    _factory = mod.createCanvas;
    return _factory!(w, h);
  } catch {
    throw new Error(
      'Node.js ortamında "canvas" paketi gerekli: npm i -D canvas',
    );
  }
}
