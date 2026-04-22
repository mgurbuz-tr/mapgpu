/**
 * LosTool — Interactive Line of Sight analysis tool.
 *
 * State machine:
 *   active ──[click]──→ observer-placed (blue dot)
 *          ──[click]──→ target-placed → auto-run LOS → showing-result
 *          ──[drag handle]──→ dragging → [release] → re-run LOS
 *          ──[Escape]──→ active (clear)
 *          ──[Shift+drag vertical]──→ height-adjust (3D mode)
 *
 * Preview features:
 *   observer-point: blue circle (draggable)
 *   target-point: red circle (draggable)
 *   visible-line: green solid line
 *   blocked-line: red dashed line
 *   blocking-point: red X marker
 */

import {
  debounced,
  type DebouncedFn,
  type ToolPointerEvent,
  type ToolContext,
  type LosAnalysisResult,
} from '../core/index.js';
import { ToolBase } from './ToolBase.js';
import type { LosAnalysis } from '../analysis/index.js';

export interface LosToolOptions {
  analysis: LosAnalysis;
  /** Number of sample points along the LOS line (default 256) */
  sampleCount?: number;
  /** Debounce interval in ms for drag updates (default 50) */
  debounceMs?: number;
}

type LosToolState = 'active' | 'observer-placed' | 'showing-result';
type DragTarget = 'observer' | 'target' | null;

const HANDLE_HIT_RADIUS = 12; // pixels

export class LosTool extends ToolBase {
  readonly id = 'los';
  readonly name = 'Line of Sight';

  private readonly _analysis: LosAnalysis;
  private readonly _sampleCount: number;
  private readonly _debounceMs: number;

  private _observer: [number, number] | null = null;
  private _target: [number, number] | null = null;
  private _observerOffset = 1.8;
  private _targetOffset = 0;
  private _result: LosAnalysisResult | null = null;

  private _losState: LosToolState = 'active';
  private _dragTarget: DragTarget = null;
  private _isDragging = false;
  private readonly _runLosDebounced: DebouncedFn<[]>;
  private _cursorPos: [number, number] | null = null;
  private _shiftDragStartY: number | null = null;
  private _shiftDragStartOffset = 0;

  constructor(options: LosToolOptions) {
    super();
    this._analysis = options.analysis;
    this._sampleCount = options.sampleCount ?? 512;
    this._debounceMs = options.debounceMs ?? 50;
    this._runLosDebounced = debounced(() => void this._runLos(), this._debounceMs);
  }

  // ─── Public API ───

  get observer(): [number, number] | null { return this._observer; }
  get target(): [number, number] | null { return this._target; }
  get observerOffset(): number { return this._observerOffset; }
  get targetOffset(): number { return this._targetOffset; }
  get result(): LosAnalysisResult | null { return this._result; }

  setObserverOffset(meters: number): void {
    this._observerOffset = meters;
    if (this._observer && this._target) {
      this._runLosDebounced();
    }
  }

  setTargetOffset(meters: number): void {
    this._targetOffset = meters;
    if (this._observer && this._target) {
      this._runLosDebounced();
    }
  }

  setObserver(lon: number, lat: number): void {
    this._observer = [lon, lat];
    this._losState = 'observer-placed';
    if (this._target) {
      void this._runLos();
    } else {
      this._updatePreview();
    }
  }

  setTarget(lon: number, lat: number): void {
    this._target = [lon, lat];
    if (this._observer) {
      void this._runLos();
    }
  }

  // ─── Lifecycle ───

  protected override onActivate(_context: ToolContext): void {
    this._reset();
  }

  protected override onDeactivate(): void {
    this._runLosDebounced.cancel();
    this._context?.previewLayer.clear();
  }

  // ─── Event Handlers ───

  onPointerDown(e: ToolPointerEvent): boolean {
    if (!e.mapCoords || !this._context) return false;

    // Only allow handle dragging when result is shown (both handles exist)
    // In observer-placed state, prioritize placing the target over dragging
    if (this._losState === 'showing-result') {
      const target = this._hitTestHandle(e.screenX, e.screenY);
      if (target) {
        this._dragTarget = target;
        this._isDragging = true;
        this._cursor = 'grab';

        // Shift+drag = height adjust
        if (e.shiftKey) {
          this._shiftDragStartY = e.screenY;
          this._shiftDragStartOffset = target === 'observer'
            ? this._observerOffset
            : this._targetOffset;
        }

        return true;
      }
    }

    return false;
  }

  onPointerMove(e: ToolPointerEvent): boolean { // NOSONAR
    if (!this._context) return false;

    if (this._isDragging && this._dragTarget && e.mapCoords) {
      // Shift+drag vertical = height adjust
      if (this._shiftDragStartY === null) {
        // Position drag
        if (this._dragTarget === 'observer') {
          this._observer = e.mapCoords;
        } else {
          this._target = e.mapCoords;
        }
      } else {
        const dy = this._shiftDragStartY - e.screenY; // up = positive
        const newOffset = Math.max(0, this._shiftDragStartOffset + dy * 0.1);
        if (this._dragTarget === 'observer') {
          this._observerOffset = newOffset;
        } else {
          this._targetOffset = newOffset;
        }
      }

      this._runLosDebounced();
      this._updatePreview();
      return true;
    }

    // Update cursor style based on handle hover
    if (e.mapCoords) {
      this._cursorPos = e.mapCoords;
      const hit = this._hitTestHandle(e.screenX, e.screenY);
      this._cursor = hit ? 'pointer' : 'crosshair';
    }

    // Show rubber-band line from observer to cursor
    if (this._losState === 'observer-placed' && this._cursorPos) {
      this._updatePreview();
    }

    return false;
  }

  onPointerUp(e: ToolPointerEvent): boolean {
    if (!e.mapCoords || !this._context) return false;

    // Finish drag
    if (this._isDragging) {
      this._isDragging = false;
      this._dragTarget = null;
      this._shiftDragStartY = null;
      this._cursor = 'crosshair';

      if (this._observer && this._target) {
        void this._runLos();
      }
      return true;
    }

    // Place observer
    if (this._losState === 'active') {
      this._observer = [...e.mapCoords] as [number, number];
      this._losState = 'observer-placed';
      this._updatePreview();
      return true;
    }

    // Place target
    if (this._losState === 'observer-placed') {
      this._target = [...e.mapCoords] as [number, number];
      void this._runLos();
      return true;
    }

    // Re-place: if showing result, new click starts over
    if (this._losState === 'showing-result') {
      // Check if not on a handle (already handled in pointerDown)
      const hit = this._hitTestHandle(e.screenX, e.screenY);
      if (!hit) {
        this._reset();
        this._observer = [...e.mapCoords] as [number, number];
        this._losState = 'observer-placed';
        this._updatePreview();
        return true;
      }
    }

    return false;
  }

  onDoubleClick(_e: ToolPointerEvent): boolean {
    return false;
  }

  onKeyDown(e: KeyboardEvent): boolean {
    if (e.key === 'Escape') {
      this._clearAndEmit();
      return true;
    }
    return false;
  }

  cancel(): void {
    this._clearAndEmit();
  }

  // ─── Private ───

  private _reset(): void {
    this._observer = null;
    this._target = null;
    this._result = null;
    this._losState = 'active';
    this._dragTarget = null;
    this._isDragging = false;
    this._cursorPos = null;
    this._shiftDragStartY = null;
    this._runLosDebounced.cancel();
    this._context?.previewLayer.clear();
    this.markDirty();
  }

  private _clearAndEmit(): void {
    this._reset();
    this._context?.emitEvent('los-clear', { toolId: this.id });
  }

  private async _runLos(): Promise<void> {
    if (!this._observer || !this._target || !this._context) return;

    try {
      const result = await this._analysis.runLos({
        observer: this._observer,
        target: this._target,
        observerOffset: this._observerOffset,
        targetOffset: this._targetOffset,
        sampleCount: this._sampleCount,
      });

      this._result = result;
      this._losState = 'showing-result';
      this._updatePreview();

      this._context.emitEvent('los-update', {
        toolId: this.id,
        observer: this._observer,
        target: this._target,
        observerOffset: this._observerOffset,
        targetOffset: this._targetOffset,
        result,
      });
    } catch (err) {
      // Log errors for debugging (silent during drag to avoid spam)
      if (!this._isDragging) {
        console.warn('[LosTool] LOS analysis failed:', err);
      }
    }
  }

  private _hitTestHandle(screenX: number, screenY: number): DragTarget {
    if (!this._context) return null;

    if (this._observer) {
      const obsScreen = this._context.toScreen(this._observer[0], this._observer[1]);
      if (obsScreen) {
        const dx = screenX - obsScreen[0];
        const dy = screenY - obsScreen[1];
        if (dx * dx + dy * dy < HANDLE_HIT_RADIUS * HANDLE_HIT_RADIUS) {
          return 'observer';
        }
      }
    }

    if (this._target) {
      const tgtScreen = this._context.toScreen(this._target[0], this._target[1]);
      if (tgtScreen) {
        const dx = screenX - tgtScreen[0];
        const dy = screenY - tgtScreen[1];
        if (dx * dx + dy * dy < HANDLE_HIT_RADIUS * HANDLE_HIT_RADIUS) {
          return 'target';
        }
      }
    }

    return null;
  }

  private _updatePreview(): void {
    if (!this._context) return;
    const preview = this._context.previewLayer;
    preview.clear();

    const obsZ = this._observerOffset;
    const tgtZ = this._targetOffset;

    // Observer handle — at observer height
    if (this._observer) {
      preview.add({
        id: '__los-observer__',
        geometry: { type: 'Point', coordinates: [this._observer[0], this._observer[1], obsZ] },
        attributes: { __preview: true, __type: 'los-observer' },
      });
    }

    // Target handle — at target height
    if (this._target) {
      preview.add({
        id: '__los-target__',
        geometry: { type: 'Point', coordinates: [this._target[0], this._target[1], tgtZ] },
        attributes: { __preview: true, __type: 'los-target' },
      });
    }

    // Result lines — LOS ray elevated at sight-line height
    if (this._result && this._observer && this._target) {

      // Visible line (green)
      if (this._result.visibleLine.length >= 6) {
        const visCoords = float64ToLosRayCoords(this._result.visibleLine, obsZ, tgtZ, this._observer, this._target);
        preview.add({
          id: '__los-visible-line__',
          geometry: { type: 'LineString', coordinates: visCoords },
          attributes: { __preview: true, __type: 'los-visible' },
        });
      }

      // Blocked line (red)
      if (this._result.blockedLine && this._result.blockedLine.length >= 6) {
        const blkCoords = float64ToLosRayCoords(this._result.blockedLine, obsZ, tgtZ, this._observer, this._target);
        preview.add({
          id: '__los-blocked-line__',
          geometry: { type: 'LineString', coordinates: blkCoords },
          attributes: { __preview: true, __type: 'los-blocked' },
        });
      }

      // Blocking point — at LOS ray height
      if (this._result.blockingPoint) {
        const bp = this._result.blockingPoint;
        const t = computeFraction(bp[0]!, bp[1]!, this._observer, this._target);
        const blockZ = obsZ + t * (tgtZ - obsZ);
        preview.add({
          id: '__los-blocking-point__',
          geometry: { type: 'Point', coordinates: [bp[0]!, bp[1]!, blockZ] },
          attributes: { __preview: true, __type: 'los-blocking' },
        });
      }
    } else if (this._losState === 'observer-placed' && this._observer && this._cursorPos) {
      // Rubber-band line — elevated at offset heights
      preview.add({
        id: '__los-rubberband__',
        geometry: {
          type: 'LineString',
          coordinates: [
            [this._observer[0], this._observer[1], this._observerOffset],
            [this._cursorPos[0], this._cursorPos[1], this._targetOffset],
          ],
        },
        attributes: { __preview: true, __type: 'rubberband' },
      });
    }

    this.markDirty();
  }
}

/**
 * Convert flat Float64Array [x0,y0,z0, x1,y1,z1, ...] to coordinates
 * with Z = LOS ray height (not terrain height).
 *
 * The LOS ray is a straight line from observer (at obsZ) to target (at tgtZ).
 * Each point's Z is interpolated based on its fractional distance along the line.
 */
function float64ToLosRayCoords(
  arr: Float64Array,
  obsZ: number,
  tgtZ: number,
  observer: [number, number],
  target: [number, number],
): number[][] {
  const coords: number[][] = [];
  for (let i = 0; i < arr.length; i += 3) {
    const lon = arr[i]!;
    const lat = arr[i + 1]!;
    const t = computeFraction(lon, lat, observer, target);
    const z = obsZ + t * (tgtZ - obsZ);
    coords.push([lon, lat, z]);
  }
  return coords;
}

/**
 * Compute the fractional distance (0..1) of a point along the observer→target line.
 */
function computeFraction(
  lon: number,
  lat: number,
  observer: [number, number],
  target: [number, number],
): number {
  const dx = target[0] - observer[0];
  const dy = target[1] - observer[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-18) return 0;
  const px = lon - observer[0];
  const py = lat - observer[1];
  return Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq));
}
