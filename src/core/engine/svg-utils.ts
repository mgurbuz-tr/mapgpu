/**
 * svg-utils — SVG rasterization utilities for icon symbology.
 */

/**
 * Rasterize SVG markup to an ImageBitmap.
 *
 * Uses Blob + createImageBitmap for browser-native SVG rendering.
 * Throws if the environment does not support createImageBitmap.
 *
 * @param svgMarkup - Raw SVG string (e.g. `<svg>...</svg>`)
 * @param width - Target width in pixels
 * @param height - Target height in pixels
 * @returns Rasterized ImageBitmap at the requested size
 */
export async function svgToImageBitmap(
  svgMarkup: string,
  width: number,
  height: number,
): Promise<ImageBitmap> {
  const blob = new Blob([svgMarkup], { type: 'image/svg+xml' });
  return createImageBitmap(blob, { resizeWidth: width, resizeHeight: height });
}
