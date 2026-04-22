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

  // Node.js: require('canvas') — hidden from bundler static analysis via
  // direct eval so browser builds (Vite/Rollup) never try to resolve 'canvas'
  // (which is Node-only). Direct eval still runs in the current module scope,
  // so vitest's per-module require shim remains accessible in Node tests.
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-eval
    const req = eval('typeof require === "function" ? require : null') as
      | ((name: string) => { createCanvas: (w: number, h: number) => any })
      | null;
    if (!req) throw new Error('require not available');
    const mod = req('canvas');
    _factory = mod.createCanvas;
    return _factory!(w, h);
  } catch {
    throw new Error(
      'Node.js ortamında "canvas" paketi gerekli: npm i -D canvas',
    );
  }
}
