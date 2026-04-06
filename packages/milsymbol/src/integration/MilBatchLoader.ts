/**
 * MilBatchLoader — Default IBatchLoader implementation using the milsym engine.
 *
 * Renders SIDC strings to SVG via MilStdIconRenderer, rasterizes to ImageBitmap,
 * and loads into an IIconSink. Uses parallel chunk processing for throughput.
 *
 * Render Pipeline (optimized in Phase 3):
 *   SIDC → SVG string → Blob → createImageBitmap → IIconSink.loadIcon()
 *
 * @example
 * ```ts
 * const loader = new MilBatchLoader();
 * const sink = new MapViewIconSink(mapView);
 * await loader.loadSymbols(sidcArray, 48, sink);
 * ```
 */

import type { IIconSink } from './IIconSink.js';
import type { IBatchLoader, BatchLoadOptions } from './IBatchLoader.js';
import { MilStdIconRenderer } from '../milsym/index.js';
import { MilStdAttributes } from '../milsym/index.js';

/** Default maximum number of icons to rasterize in parallel per batch */
const DEFAULT_CONCURRENCY = 16;

/**
 * Build a deterministic icon ID from SIDC + size.
 * Must match the format expected by the renderer pipeline.
 */
export function makeIconId(sidc: string, size: number): string {
  return `mil-${sidc}-${size}`;
}

/**
 * Convert SVG string to ImageBitmap using the optimized Blob pipeline.
 * Skips the intermediate Canvas step by using Blob → createImageBitmap directly
 * when the browser supports SVG blobs. Falls back to Image → Canvas if needed.
 */
async function svgToBitmap(svg: string, size: number): Promise<ImageBitmap> {
  // Optimized path: SVG Blob → createImageBitmap (skips Image + Canvas)
  if (typeof Blob !== 'undefined' && typeof createImageBitmap !== 'undefined') {
    try {
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const bitmap = await createImageBitmap(blob, {
        resizeWidth: size,
        resizeHeight: size,
        resizeQuality: 'high',
      });
      return bitmap;
    } catch {
      // Some browsers may not support createImageBitmap from SVG Blob
      // Fall through to legacy path
    }
  }

  // Legacy fallback: SVG Blob URL → Image → Canvas → ImageBitmap
  if (typeof Image === 'undefined') {
    throw new Error('svgToBitmap requires a browser environment with Image support');
  }

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  return new Promise<ImageBitmap>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      createImageBitmap(img, {
        resizeWidth: size,
        resizeHeight: size,
        resizeQuality: 'high',
      }).then(resolve, reject);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`SVG rasterize failed for SIDC icon`));
    };
    img.src = url;
  });
}

/** Render an SIDC to SVG using the milsym engine. */
function renderSvg(sidc: string, size: number): string {
  const renderer = MilStdIconRenderer.getInstance();
  const attr = new Map<string, string>();
  attr.set(MilStdAttributes.PixelSize, String(size));
  const result = renderer.RenderSVG(sidc, new Map(), attr);
  if (!result) throw new Error(`milsym render failed: ${sidc}`);
  return result.getSVG();
}

/**
 * Default IBatchLoader implementation backed by the milsym engine.
 *
 * Tracks loaded symbols in a local Set to avoid duplicate work.
 * Parallel rasterization is chunked for throughput vs memory balance.
 */
export class MilBatchLoader implements IBatchLoader {
  private readonly _loaded = new Set<string>();

  async loadSymbols(
    sidcs: readonly string[],
    size: number,
    sink: IIconSink,
    options?: BatchLoadOptions,
  ): Promise<void> {
    const concurrency = options?.concurrency ?? DEFAULT_CONCURRENCY;

    // Filter to only new icons
    const toLoad: Array<{ sidc: string; iconId: string }> = [];
    for (const sidc of sidcs) {
      const iconId = makeIconId(sidc, size);
      if (!this._loaded.has(iconId) && !sink.hasIcon(iconId)) {
        toLoad.push({ sidc, iconId });
        this._loaded.add(iconId); // Mark early to prevent duplicate work
      }
    }

    if (toLoad.length === 0) return;

    // Process in parallel chunks
    for (let i = 0; i < toLoad.length; i += concurrency) {
      const chunk = toLoad.slice(i, i + concurrency);

      // Step 1: Render SVGs synchronously (CPU-bound, fast)
      const rendered = chunk.map(({ sidc, iconId }) => ({
        iconId,
        svg: renderSvg(sidc, size),
      }));

      // Step 2: Rasterize all in parallel (GPU/async-bound)
      const bitmaps = await Promise.all(
        rendered.map(({ svg }) => svgToBitmap(svg, size)),
      );

      // Step 3: Load into icon sink
      await Promise.all(
        bitmaps.map((bitmap, idx) =>
          sink.loadIcon(rendered[idx].iconId, bitmap),
        ),
      );
    }
  }

  async loadSymbol(
    sidc: string,
    size: number,
    sink: IIconSink,
  ): Promise<void> {
    const iconId = makeIconId(sidc, size);
    if (this._loaded.has(iconId) || sink.hasIcon(iconId)) return;

    const svg = renderSvg(sidc, size);
    const bitmap = await svgToBitmap(svg, size);
    await sink.loadIcon(iconId, bitmap);
    this._loaded.add(iconId);
  }

  isLoaded(sidc: string, size: number): boolean {
    return this._loaded.has(makeIconId(sidc, size));
  }

  getLoadedCount(): number {
    return this._loaded.size;
  }

  clear(): void {
    this._loaded.clear();
  }
}
