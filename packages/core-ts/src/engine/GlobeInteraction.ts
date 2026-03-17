/**
 * GlobeInteraction — Globe mouse/touch interaction
 *
 * MapLibre'nin VerticalPerspectiveCameraHelper pattern'i:
 * - Pan: ray-sphere intersection ile globe yüzeyinde sürükleme
 * - Zoom: wheel/pinch (target-fixed — fare noktası sabit kalır)
 * - Pitch/Bearing: right-click drag
 * - Latitude clamp: ±85.051129°
 *
 * VerticalPerspectiveTransform'u doğrudan kontrol eder.
 */

import type { VerticalPerspectiveTransform } from './projections/VerticalPerspectiveTransform.js';

export interface GlobeInteractionOptions {
  pan?: boolean;
  zoom?: boolean;
  keyboard?: boolean;
  doubleClickZoom?: boolean;
  pitchBearing?: boolean;
  zoomSpeed?: number;
  /** Returns current globeness (0=flat, 1=globe). Used to dampen pointer-fixed zoom compensation. */
  getGlobeness?: () => number;
}

export class GlobeInteraction {
  private readonly _element: HTMLElement;
  private readonly _transform: VerticalPerspectiveTransform;
  private readonly _onDirty: () => void;
  private readonly _onViewChange: () => void;

  // Feature flags
  private readonly _panEnabled: boolean;
  private readonly _zoomEnabled: boolean;
  private readonly _keyboardEnabled: boolean;
  private readonly _doubleClickZoom: boolean;
  private readonly _pitchBearingEnabled: boolean;
  private readonly _zoomSpeed: number;
  private readonly _getGlobeness: () => number;

  // Pan state
  private _dragging = false;
  private _lastPointerX = 0;
  private _lastPointerY = 0;
  private _activePointerId: number | null = null;
  private _dragButton = 0;

  // Pinch zoom state
  private _pointers = new Map<number, { x: number; y: number }>();
  private _lastPinchDist = 0;

  // Double-click detection
  private _lastClickTime = 0;

  // Bound handlers
  private readonly _onPointerDown: (e: PointerEvent) => void;
  private readonly _onPointerMove: (e: PointerEvent) => void;
  private readonly _onPointerUp: (e: PointerEvent) => void;
  private readonly _onWheel: (e: WheelEvent) => void;
  private readonly _onKeyDown: (e: KeyboardEvent) => void;
  private readonly _onContextMenu: (e: Event) => void;

  private _destroyed = false;

  constructor(
    element: HTMLElement,
    transform: VerticalPerspectiveTransform,
    onDirty: () => void,
    onViewChange: () => void,
    options?: GlobeInteractionOptions,
  ) {
    this._element = element;
    this._transform = transform;
    this._onDirty = onDirty;
    this._onViewChange = onViewChange;

    this._panEnabled = options?.pan ?? true;
    this._zoomEnabled = options?.zoom ?? true;
    this._keyboardEnabled = options?.keyboard ?? true;
    this._doubleClickZoom = options?.doubleClickZoom ?? true;
    this._pitchBearingEnabled = options?.pitchBearing ?? true;
    this._zoomSpeed = options?.zoomSpeed ?? 1;
    this._getGlobeness = options?.getGlobeness ?? (() => 1);

    // Bind handlers
    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);
    this._onWheel = this._handleWheel.bind(this);
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onContextMenu = (e: Event) => e.preventDefault();

    element.addEventListener('pointerdown', this._onPointerDown);
    element.addEventListener('pointermove', this._onPointerMove);
    element.addEventListener('pointerup', this._onPointerUp);
    element.addEventListener('pointercancel', this._onPointerUp);
    element.addEventListener('wheel', this._onWheel, { passive: false });
    element.addEventListener('contextmenu', this._onContextMenu);

    if (this._keyboardEnabled) {
      element.setAttribute('tabindex', '0');
      element.addEventListener('keydown', this._onKeyDown);
    }
  }

  // ─── Pointer handlers ───

  private _handlePointerDown(e: PointerEvent): void {
    if (this._destroyed) return;

    // Skip interaction if event originated from a widget, UI control, or tool overlay
    const target = e.target as HTMLElement | null;
    if (target && target !== this._element && target.tagName !== 'CANVAS') {
      return;
    }

    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this._pointers.size === 1) {
      // Single pointer → pan or pitch/bearing
      this._dragging = true;
      this._dragButton = e.button;
      this._activePointerId = e.pointerId;
      this._lastPointerX = e.clientX;
      this._lastPointerY = e.clientY;
      this._element.setPointerCapture(e.pointerId);

      // Double-click detection
      if (this._doubleClickZoom && e.button === 0) {
        const now = Date.now();
        if (now - this._lastClickTime < 300) {
          this._handleDoubleClick(e);
        }
        this._lastClickTime = now;
      }
    } else if (this._pointers.size === 2) {
      // Pinch start
      this._lastPinchDist = this._getPinchDistance();
    }
  }

  private _handlePointerMove(e: PointerEvent): void {
    if (this._destroyed) return;

    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this._pointers.size === 2 && this._zoomEnabled) {
      // Pinch zoom
      const dist = this._getPinchDistance();
      if (this._lastPinchDist > 0) {
        const ratio = dist / this._lastPinchDist;
        const zoomDelta = Math.log2(ratio);
        this._transform.setZoom(this._transform.zoom + zoomDelta);
        this._onDirty();
        this._onViewChange();
      }
      this._lastPinchDist = dist;
      return;
    }

    if (!this._dragging || e.pointerId !== this._activePointerId) return;

    const dx = e.clientX - this._lastPointerX;
    const dy = e.clientY - this._lastPointerY;
    this._lastPointerX = e.clientX;
    this._lastPointerY = e.clientY;

    if (this._dragButton === 2 && this._pitchBearingEnabled) {
      // Right-click drag → pitch/bearing
      const bearingDelta = dx * 0.3;
      const pitchDelta = -dy * 0.3;
      this._transform.setBearing(this._transform.bearing + bearingDelta);
      this._transform.setPitch(this._transform.pitch + pitchDelta);
      this._onDirty();
      this._onViewChange();
    } else if (this._dragButton === 0 && this._panEnabled) {
      // Left-click drag → pan (rotate globe)
      this._handlePan(dx, dy);
    }
  }

  private _handlePointerUp(e: PointerEvent): void {
    if (this._destroyed) return;

    this._pointers.delete(e.pointerId);

    if (e.pointerId === this._activePointerId) {
      this._dragging = false;
      this._activePointerId = null;
      try {
        this._element.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    if (this._pointers.size < 2) {
      this._lastPinchDist = 0;
    }
  }

  // ─── Pan ───

  private _handlePan(dx: number, dy: number): void {
    // Scale factor: degrees per pixel at current zoom level
    const scale = 180 / (Math.pow(2, this._transform.zoom) * 256);

    const center = this._transform.center;
    const bearingRad = this._transform.bearing * (Math.PI / 180);

    // Rotate the drag direction by bearing
    const cosB = Math.cos(bearingRad);
    const sinB = Math.sin(bearingRad);
    const rotDx = dx * cosB + dy * sinB;
    const rotDy = -dx * sinB + dy * cosB;

    // Apply latitude-based scaling for longitude (Mercator-like compensation)
    const latRad = center[1] * (Math.PI / 180);
    const latScale = Math.max(0.1, Math.cos(latRad));

    const newLon = center[0] - rotDx * scale / latScale;
    const newLat = Math.max(-85.051129, Math.min(85.051129,
      center[1] + rotDy * scale));

    this._transform.setCenter(newLon, newLat);
    this._onDirty();
    this._onViewChange();
  }

  // ─── Wheel zoom ───

  private _handleWheel(e: WheelEvent): void {
    if (this._destroyed || !this._zoomEnabled) return;
    e.preventDefault();

    const delta = -e.deltaY * 0.003 * this._zoomSpeed;
    const oldZoom = this._transform.zoom;
    const newZoom = oldZoom + delta;

    // Pointer-fixed zoom: direct Mercator pixel math (no ray-sphere dependency)
    const rect = typeof this._element.getBoundingClientRect === 'function'
      ? this._element.getBoundingClientRect()
      : null;
    const pointerX = rect ? e.clientX - rect.left : this._transform.viewportWidth / 2;
    const pointerY = rect ? e.clientY - rect.top : this._transform.viewportHeight / 2;

    // Pixel offset from viewport center
    const dx = pointerX - this._transform.viewportWidth / 2;
    const dy = pointerY - this._transform.viewportHeight / 2;

    this._transform.setZoom(newZoom);
    const actualDelta = this._transform.zoom - oldZoom;

    // Only compensate if pointer is off-center AND zoom actually changed
    if (actualDelta !== 0 && (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5)) {
      // Dampen compensation by globeness: full globe → 0, flat → 1
      const globeness = this._getGlobeness();
      const dampening = 1 - globeness;

      if (dampening > 0.001) {
        // Bearing rotation: viewport pixels → map-aligned pixels
        const bearingRad = this._transform.bearing * (Math.PI / 180);
        const cosB = Math.cos(bearingRad);
        const sinB = Math.sin(bearingRad);
        const rotDx = dx * cosB + dy * sinB;
        const rotDy = -dx * sinB + dy * cosB;

        // Degrees per pixel at each zoom level
        const oldScale = 360 / (Math.pow(2, oldZoom) * 512);
        const newScale = 360 / (Math.pow(2, this._transform.zoom) * 512);

        const center = this._transform.center;
        const latRad = center[1] * (Math.PI / 180);
        const latScale = Math.max(0.1, Math.cos(latRad));

        const lonShift = rotDx * (oldScale - newScale) / latScale * dampening;
        const latShift = -rotDy * (oldScale - newScale) * dampening;

        this._transform.setCenter(
          center[0] + lonShift,
          Math.max(-85.051129, Math.min(85.051129, center[1] + latShift)),
        );
      }
    }

    this._onDirty();
    this._onViewChange();
  }

  // ─── Double-click zoom ───

  private _handleDoubleClick(_e: PointerEvent): void {
    if (!this._zoomEnabled) return;
    this._transform.setZoom(this._transform.zoom + 1);
    this._onDirty();
    this._onViewChange();
  }

  // ─── Keyboard ───

  private _handleKeyDown(e: KeyboardEvent): void {
    if (this._destroyed) return;

    const panStep = 50;
    const scale = 180 / (Math.pow(2, this._transform.zoom) * 256);

    switch (e.key) {
      case '+':
      case '=':
        if (this._zoomEnabled) {
          this._transform.setZoom(this._transform.zoom + 0.5);
          this._onDirty();
          this._onViewChange();
        }
        break;
      case '-':
        if (this._zoomEnabled) {
          this._transform.setZoom(this._transform.zoom - 0.5);
          this._onDirty();
          this._onViewChange();
        }
        break;
      case 'ArrowLeft':
        if (this._panEnabled) {
          const c = this._transform.center;
          this._transform.setCenter(c[0] - panStep * scale, c[1]);
          this._onDirty();
          this._onViewChange();
        }
        break;
      case 'ArrowRight':
        if (this._panEnabled) {
          const c = this._transform.center;
          this._transform.setCenter(c[0] + panStep * scale, c[1]);
          this._onDirty();
          this._onViewChange();
        }
        break;
      case 'ArrowUp':
        if (this._panEnabled) {
          const c = this._transform.center;
          this._transform.setCenter(c[0], Math.min(85.051129, c[1] + panStep * scale));
          this._onDirty();
          this._onViewChange();
        }
        break;
      case 'ArrowDown':
        if (this._panEnabled) {
          const c = this._transform.center;
          this._transform.setCenter(c[0], Math.max(-85.051129, c[1] - panStep * scale));
          this._onDirty();
          this._onViewChange();
        }
        break;
    }
  }

  // ─── Helpers ───

  private _getPinchDistance(): number {
    const pts = [...this._pointers.values()];
    if (pts.length < 2) return 0;
    const dx = pts[1]!.x - pts[0]!.x;
    const dy = pts[1]!.y - pts[0]!.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ─── Lifecycle ───

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    this._element.removeEventListener('pointerdown', this._onPointerDown);
    this._element.removeEventListener('pointermove', this._onPointerMove);
    this._element.removeEventListener('pointerup', this._onPointerUp);
    this._element.removeEventListener('pointercancel', this._onPointerUp);
    this._element.removeEventListener('wheel', this._onWheel);
    this._element.removeEventListener('contextmenu', this._onContextMenu);
    this._element.removeEventListener('keydown', this._onKeyDown);
  }
}
