/**
 * SnapVisualizer — Renders snap indicator features to the preview layer
 * and updates the cursor to reflect the active snap type.
 *
 * Stateless utility. Call `render()` from tool's `_updatePreview()`.
 */

import type { IPreviewLayer } from '@mapgpu/core';
import { SnapType, type SnapResult } from './SnapTypes.js';

const SNAP_POINT_ID = '__snap-indicator__';
const SNAP_GUIDE_ID = '__snap-guide-line__';

/* ── Snap cursor SVGs (32x32, hotspot 16,16) ─────────────────────── */

function svgCursor(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 16 16, crosshair`;
}

const SNAP_CURSORS: Record<SnapType, string> = {
  // Endpoint: square rotated 45°
  [SnapType.EndPoint]: svgCursor(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">'
    + '<line x1="16" y1="0" x2="16" y2="12" stroke="#fff" stroke-width="1.5" opacity="0.6"/>'
    + '<line x1="16" y1="20" x2="16" y2="32" stroke="#fff" stroke-width="1.5" opacity="0.6"/>'
    + '<line x1="0" y1="16" x2="12" y2="16" stroke="#fff" stroke-width="1.5" opacity="0.6"/>'
    + '<line x1="20" y1="16" x2="32" y2="16" stroke="#fff" stroke-width="1.5" opacity="0.6"/>'
    + '<rect x="11" y="11" width="10" height="10" rx="1" fill="none" stroke="#00e640" stroke-width="2"/>'
    + '</svg>',
  ),
  // Midpoint: triangle
  [SnapType.MidPoint]: svgCursor(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">'
    + '<line x1="16" y1="0" x2="16" y2="10" stroke="#fff" stroke-width="1.5" opacity="0.6"/>'
    + '<line x1="16" y1="22" x2="16" y2="32" stroke="#fff" stroke-width="1.5" opacity="0.6"/>'
    + '<line x1="0" y1="16" x2="10" y2="16" stroke="#fff" stroke-width="1.5" opacity="0.6"/>'
    + '<line x1="22" y1="16" x2="32" y2="16" stroke="#fff" stroke-width="1.5" opacity="0.6"/>'
    + '<polygon points="16,10 22,22 10,22" fill="none" stroke="#ffb800" stroke-width="2"/>'
    + '</svg>',
  ),
  // Intersection: X mark
  [SnapType.Intersection]: svgCursor(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">'
    + '<line x1="16" y1="0" x2="16" y2="10" stroke="#fff" stroke-width="1.5" opacity="0.6"/>'
    + '<line x1="16" y1="22" x2="16" y2="32" stroke="#fff" stroke-width="1.5" opacity="0.6"/>'
    + '<line x1="0" y1="16" x2="10" y2="16" stroke="#fff" stroke-width="1.5" opacity="0.6"/>'
    + '<line x1="22" y1="16" x2="32" y2="16" stroke="#fff" stroke-width="1.5" opacity="0.6"/>'
    + '<line x1="11" y1="11" x2="21" y2="21" stroke="#ff6d3a" stroke-width="2.5"/>'
    + '<line x1="21" y1="11" x2="11" y2="21" stroke="#ff6d3a" stroke-width="2.5"/>'
    + '</svg>',
  ),
  // Nearest: circle on edge
  [SnapType.Nearest]: svgCursor(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">'
    + '<line x1="16" y1="0" x2="16" y2="10" stroke="#fff" stroke-width="1.5" opacity="0.6"/>'
    + '<line x1="16" y1="22" x2="16" y2="32" stroke="#fff" stroke-width="1.5" opacity="0.6"/>'
    + '<line x1="0" y1="16" x2="10" y2="16" stroke="#fff" stroke-width="1.5" opacity="0.6"/>'
    + '<line x1="22" y1="16" x2="32" y2="16" stroke="#fff" stroke-width="1.5" opacity="0.6"/>'
    + '<circle cx="16" cy="16" r="5" fill="none" stroke="#00c8ff" stroke-width="2"/>'
    + '</svg>',
  ),
  // Point: filled circle
  [SnapType.Point]: svgCursor(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">'
    + '<line x1="16" y1="0" x2="16" y2="10" stroke="#fff" stroke-width="1.5" opacity="0.6"/>'
    + '<line x1="16" y1="22" x2="16" y2="32" stroke="#fff" stroke-width="1.5" opacity="0.6"/>'
    + '<line x1="0" y1="16" x2="10" y2="16" stroke="#fff" stroke-width="1.5" opacity="0.6"/>'
    + '<line x1="22" y1="16" x2="32" y2="16" stroke="#fff" stroke-width="1.5" opacity="0.6"/>'
    + '<circle cx="16" cy="16" r="4" fill="#00e640" stroke="#fff" stroke-width="1.5"/>'
    + '</svg>',
  ),
  // Angle guide: diamond
  [SnapType.AngleGuide]: svgCursor(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">'
    + '<line x1="16" y1="0" x2="16" y2="10" stroke="#fff" stroke-width="1.5" opacity="0.6"/>'
    + '<line x1="16" y1="22" x2="16" y2="32" stroke="#fff" stroke-width="1.5" opacity="0.6"/>'
    + '<line x1="0" y1="16" x2="10" y2="16" stroke="#fff" stroke-width="1.5" opacity="0.6"/>'
    + '<line x1="22" y1="16" x2="32" y2="16" stroke="#fff" stroke-width="1.5" opacity="0.6"/>'
    + '<polygon points="16,10 22,16 16,22 10,16" fill="none" stroke="#b4ff00" stroke-width="2"/>'
    + '</svg>',
  ),
};

export class SnapVisualizer {
  /**
   * Update snap visualization on the preview layer and cursor.
   *
   * - Removes previous indicators.
   * - Adds snap point marker if snap is active.
   * - Adds guide line for angle guide snaps.
   * - Updates cursor to reflect active snap type.
   */
  static render(
    previewLayer: IPreviewLayer,
    snapResult: SnapResult | null,
    guideOrigin?: [number, number],
  ): void {
    previewLayer.remove(SNAP_POINT_ID);
    previewLayer.remove(SNAP_GUIDE_ID);

    if (!snapResult || snapResult.type === 'none') return;

    // Snap point indicator
    previewLayer.add({
      id: SNAP_POINT_ID,
      geometry: { type: 'Point', coordinates: snapResult.coords },
      attributes: {
        __preview: true,
        __type: 'snap-indicator',
        __snapType: snapResult.type,
      },
    });

    // Angle guide line
    if (snapResult.type === 'angle-guide' && guideOrigin) {
      const dx = snapResult.coords[0] - guideOrigin[0];
      const dy = snapResult.coords[1] - guideOrigin[1];
      const ext = 10;
      previewLayer.add({
        id: SNAP_GUIDE_ID,
        geometry: {
          type: 'LineString',
          coordinates: [
            [guideOrigin[0] - dx * ext, guideOrigin[1] - dy * ext],
            [guideOrigin[0] + dx * ext, guideOrigin[1] + dy * ext],
          ],
        },
        attributes: {
          __preview: true,
          __type: 'angle-guide-line',
        },
      });
    }
  }

  /** Remove all snap indicators. */
  static clear(previewLayer: IPreviewLayer): void {
    previewLayer.remove(SNAP_POINT_ID);
    previewLayer.remove(SNAP_GUIDE_ID);
  }

  /** Get the cursor string for a snap result. Returns `null` if no snap. */
  static getCursor(snapResult: SnapResult | null): string | null {
    if (!snapResult || snapResult.type === 'none') return null;
    return SNAP_CURSORS[snapResult.type] ?? null;
  }
}
