/**
 * AngleGuideManager — Tracks hover origins and generates angle guide snaps.
 *
 * Origins are registered when:
 * 1. User hovers near a snap point for longer than the threshold (auto-mark)
 * 2. User places a vertex during drawing (explicit add)
 *
 * Guide rays are emitted from each origin at configured angle intervals.
 */

import { generateAngleGuides, snapToAngleGuide } from './snapGeometry.js';

const MAX_ORIGINS = 5;

interface HoverState {
  coords: [number, number];
  startTime: number;
}

export class AngleGuideManager {
  private _origins: [number, number][] = [];
  private _hoverThreshold: number;
  private _hover: HoverState | null = null;

  constructor(hoverThresholdMs: number = 500) {
    this._hoverThreshold = hoverThresholdMs;
  }

  /** Explicitly add an origin (e.g., when user places a vertex). */
  addOrigin(coords: [number, number]): void {
    // Avoid duplicates (within ~1m)
    const exists = this._origins.some(
      (o) => Math.abs(o[0] - coords[0]) < 1e-6 && Math.abs(o[1] - coords[1]) < 1e-6,
    );
    if (exists) return;

    this._origins.push([...coords] as [number, number]);
    if (this._origins.length > MAX_ORIGINS) {
      this._origins.shift();
    }
  }

  /** Update hover tracking. Call on every pointer move. */
  updateHover(
    snapCoords: [number, number] | null,
    now: number = Date.now(),
  ): void {
    if (!snapCoords) {
      this._hover = null;
      return;
    }

    if (this._hover) {
      // Check if still hovering same point (~1px tolerance in coords)
      const dx = Math.abs(this._hover.coords[0] - snapCoords[0]);
      const dy = Math.abs(this._hover.coords[1] - snapCoords[1]);
      if (dx < 1e-6 && dy < 1e-6) {
        // Still hovering — check if threshold exceeded
        if (now - this._hover.startTime >= this._hoverThreshold) {
          this.addOrigin(snapCoords);
          this._hover = null;
        }
        return;
      }
    }

    // New hover target
    this._hover = { coords: [...snapCoords] as [number, number], startTime: now };
  }

  /**
   * Find the best angle guide snap for the current cursor position.
   * Returns a partial SnapCandidate (coords + screenDistance) or null.
   */
  findGuideSnap(
    screenX: number,
    screenY: number,
    toScreen: (lon: number, lat: number) => [number, number] | null,
    tolerance: number,
    angleIntervals: number[],
  ): { coords: [number, number]; screenDistance: number } | null {
    if (this._origins.length === 0) return null;

    const guides = generateAngleGuides(this._origins, angleIntervals);

    let best: { coords: [number, number]; screenDistance: number } | null = null;

    for (const guide of guides) {
      const result = snapToAngleGuide(guide, screenX, screenY, toScreen, tolerance);
      if (result && (!best || result.screenDistance < best.screenDistance)) {
        best = result;
      }
    }

    return best;
  }

  /** Get current origins (read-only). */
  get origins(): readonly [number, number][] {
    return this._origins;
  }

  /** Clear all origins and hover state. */
  reset(): void {
    this._origins = [];
    this._hover = null;
  }
}
