/**
 * InteractionHandler — Mouse/touch etkileşim yönetimi
 *
 * Pointer Events API ile pan, zoom (wheel + pinch) ve rotate işlemleri.
 * Canvas/container üzerinde DOM eventlerini dinler, CameraController2D'ye yansıtır.
 *
 * Features:
 * - Pan: pointer drag (left button / single touch)
 * - Zoom: mouse wheel (zoom-to-cursor) + pinch gesture
 * - Double-click/tap: zoom in
 * - Keyboard: +/- zoom, arrow keys pan
 */

import type { CameraController2D } from './CameraController2D.js';

// ─── Types ───

export interface InteractionHandlerOptions {
  /** Enable pan (default: true) */
  pan?: boolean;
  /** Enable zoom (default: true) */
  zoom?: boolean;
  /** Enable keyboard shortcuts (default: true) */
  keyboard?: boolean;
  /** Enable double-click/tap zoom (default: true) */
  doubleClickZoom?: boolean;
  /** Zoom speed multiplier for wheel events (default: 1) */
  zoomSpeed?: number;
  /** Pan inertia duration in ms (0 = disabled, default: 300) */
  inertiaDuration?: number;
}

export class InteractionHandler {
  private readonly _element: HTMLElement;
  private readonly _camera: CameraController2D;
  private readonly _onDirty: () => void;
  private readonly _onViewChange: () => void;

  // Feature flags
  private readonly _panEnabled: boolean;
  private readonly _zoomEnabled: boolean;
  private readonly _keyboardEnabled: boolean;
  private readonly _doubleClickZoom: boolean;
  private readonly _zoomSpeed: number;
  private readonly _inertiaDuration: number;

  // Pan state
  private _dragging = false;
  private _lastPointerX = 0;
  private _lastPointerY = 0;
  private _activePointerId: number | null = null;

  // Pinch zoom state
  private readonly _pointers = new Map<number, { x: number; y: number }>();
  private _lastPinchDist = 0;
  private _lastPinchCenterX = 0;
  private _lastPinchCenterY = 0;

  // Inertia state
  private _velocityX = 0;
  private _velocityY = 0;
  private _lastMoveTime = 0;
  private _inertiaRafId: number | null = null;

  // Double-click detection
  private _lastClickTime = 0;
  private _lastClickX = 0;
  private _lastClickY = 0;

  // Bound handlers (for cleanup)
  private readonly _onPointerDown: (e: PointerEvent) => void;
  private readonly _onPointerMove: (e: PointerEvent) => void;
  private readonly _onPointerUp: (e: PointerEvent) => void;
  private readonly _onWheel: (e: WheelEvent) => void;
  private readonly _onKeyDown: (e: KeyboardEvent) => void;
  private readonly _onContextMenu: (e: Event) => void;

  private _destroyed = false;

  constructor(
    element: HTMLElement,
    camera: CameraController2D,
    onDirty: () => void,
    onViewChange: () => void,
    options: InteractionHandlerOptions = {},
  ) {
    this._element = element;
    this._camera = camera;
    this._onDirty = onDirty;
    this._onViewChange = onViewChange;

    this._panEnabled = options.pan ?? true;
    this._zoomEnabled = options.zoom ?? true;
    this._keyboardEnabled = options.keyboard ?? true;
    this._doubleClickZoom = options.doubleClickZoom ?? true;
    this._zoomSpeed = options.zoomSpeed ?? 1;
    this._inertiaDuration = options.inertiaDuration ?? 300;

    // Bind handlers
    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);
    this._onWheel = this._handleWheel.bind(this);
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onContextMenu = (e: Event) => e.preventDefault();

    this._attach();
  }

  // ─── Lifecycle ───

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._stopInertia();
    this._detach();
  }

  // ─── Private: Attach / Detach ───

  private _attach(): void {
    const el = this._element;
    el.addEventListener('pointerdown', this._onPointerDown);
    el.addEventListener('pointermove', this._onPointerMove);
    el.addEventListener('pointerup', this._onPointerUp);
    el.addEventListener('pointercancel', this._onPointerUp);
    el.addEventListener('wheel', this._onWheel, { passive: false });
    el.addEventListener('contextmenu', this._onContextMenu);

    // Make element focusable for keyboard events
    if (this._keyboardEnabled) {
      if (!el.getAttribute('tabindex')) {
        el.setAttribute('tabindex', '0');
      }
      el.addEventListener('keydown', this._onKeyDown);
    }

    // Touch-action CSS to prevent browser default gestures
    el.style.touchAction = 'none';
  }

  private _detach(): void {
    const el = this._element;
    el.removeEventListener('pointerdown', this._onPointerDown);
    el.removeEventListener('pointermove', this._onPointerMove);
    el.removeEventListener('pointerup', this._onPointerUp);
    el.removeEventListener('pointercancel', this._onPointerUp);
    el.removeEventListener('wheel', this._onWheel);
    el.removeEventListener('contextmenu', this._onContextMenu);
    el.removeEventListener('keydown', this._onKeyDown);
  }

  // ─── Pointer Handlers ───

  private _handlePointerDown(e: PointerEvent): void {
    if (this._destroyed) return;

    // Skip interaction if event originated from a widget, UI overlay, or tool overlay
    const target = e.target as HTMLElement | null;
    if (target && target !== this._element && target.tagName !== 'CANVAS') {
      return;
    }

    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this._element.setPointerCapture(e.pointerId);
    this._stopInertia();

    if (this._pointers.size === 1) {
      // Single pointer — start pan
      if (!this._panEnabled) return;
      this._dragging = true;
      this._activePointerId = e.pointerId;
      this._lastPointerX = e.clientX;
      this._lastPointerY = e.clientY;
      this._velocityX = 0;
      this._velocityY = 0;
      this._lastMoveTime = performance.now();

      // Double-click detection
      if (this._doubleClickZoom) {
        const now = performance.now();
        const dt = now - this._lastClickTime;
        const dx = e.clientX - this._lastClickX;
        const dy = e.clientY - this._lastClickY;
        if (dt < 300 && Math.abs(dx) < 5 && Math.abs(dy) < 5) {
          this._handleDoubleClick(e.clientX, e.clientY);
          this._lastClickTime = 0; // Reset to avoid triple-click
          return;
        }
        this._lastClickTime = now;
        this._lastClickX = e.clientX;
        this._lastClickY = e.clientY;
      }
    } else if (this._pointers.size === 2) {
      // Two pointers — start pinch
      this._dragging = false;
      this._initPinch();
    }
  }

  private _handlePointerMove(e: PointerEvent): void {
    if (this._destroyed) return;

    // Update pointer position
    if (this._pointers.has(e.pointerId)) {
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (this._pointers.size === 2 && this._zoomEnabled) {
      // Pinch zoom
      this._handlePinchMove();
      return;
    }

    if (!this._dragging || e.pointerId !== this._activePointerId) return;

    const dx = e.clientX - this._lastPointerX;
    const dy = e.clientY - this._lastPointerY;

    if (dx === 0 && dy === 0) return;

    // Convert pixel delta to map units
    const resolution = this._getResolution();
    const mapDx = -dx * resolution;
    const mapDy = dy * resolution; // Y flipped: screen down = world south

    // Apply rotation if needed
    const rotation = this._camera.rotation;
    let worldDx = mapDx;
    let worldDy = mapDy;
    if (rotation !== 0) {
      const cos = Math.cos(-rotation);
      const sin = Math.sin(-rotation);
      worldDx = mapDx * cos - mapDy * sin;
      worldDy = mapDx * sin + mapDy * cos;
    }

    const center = this._camera.center;
    this._camera.setCenter([center[0] + worldDx, center[1] + worldDy]);

    // Track velocity for inertia
    const now = performance.now();
    const dt = now - this._lastMoveTime;
    if (dt > 0) {
      this._velocityX = worldDx / dt;
      this._velocityY = worldDy / dt;
    }
    this._lastMoveTime = now;

    this._lastPointerX = e.clientX;
    this._lastPointerY = e.clientY;

    this._notifyChange();
  }

  private _handlePointerUp(e: PointerEvent): void {
    if (this._destroyed) return;

    this._pointers.delete(e.pointerId);

    try {
      this._element.releasePointerCapture(e.pointerId);
    } catch {
      // Pointer capture may already be released
    }

    if (this._pointers.size < 2) {
      this._lastPinchDist = 0;
    }

    if (this._pointers.size === 1) {
      // Switch from pinch back to single-pointer pan
      const [remainingId, remainingPos] = [...this._pointers.entries()][0]!;
      this._dragging = true;
      this._activePointerId = remainingId;
      this._lastPointerX = remainingPos.x;
      this._lastPointerY = remainingPos.y;
      return;
    }

    if (e.pointerId === this._activePointerId) {
      this._dragging = false;
      this._activePointerId = null;

      // Start inertia if velocity is significant
      if (this._inertiaDuration > 0 && this._panEnabled) {
        const speed = Math.hypot(this._velocityX, this._velocityY);
        if (speed > 0.001) {
          this._startInertia();
        }
      }
    }
  }

  // ─── Wheel Zoom ───

  private _handleWheel(e: WheelEvent): void {
    if (this._destroyed || !this._zoomEnabled) return;
    e.preventDefault();

    // Normalize delta across browsers (pixels vs lines vs pages)
    let delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 16; // lines → pixels
    if (e.deltaMode === 2) delta *= 100; // pages → pixels

    // Zoom amount: negative delta = zoom in, positive = zoom out
    const zoomDelta = -delta * 0.002 * this._zoomSpeed;
    const newZoom = this._camera.zoom + zoomDelta;

    // Zoom-to-cursor: adjust center so the point under cursor stays fixed
    const rect = this._element.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    this._zoomToPoint(cursorX, cursorY, newZoom);
    this._notifyChange();
  }

  // ─── Keyboard ───

  private _handleKeyDown(e: KeyboardEvent): void {
    if (this._destroyed) return;

    // Don't handle if focus is on an input element
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      return;
    }

    const resolution = this._getResolution();
    const panStep = 100 * resolution; // 100 pixels worth of panning

    switch (e.key) {
      case '+':
      case '=':
        if (!this._zoomEnabled) return;
        e.preventDefault();
        this._camera.setZoom(this._camera.zoom + 1);
        this._notifyChange();
        break;
      case '-':
      case '_':
        if (!this._zoomEnabled) return;
        e.preventDefault();
        this._camera.setZoom(this._camera.zoom - 1);
        this._notifyChange();
        break;
      case 'ArrowLeft':
        if (!this._panEnabled) return;
        e.preventDefault();
        this._camera.setCenter([
          this._camera.center[0] - panStep,
          this._camera.center[1],
        ]);
        this._notifyChange();
        break;
      case 'ArrowRight':
        if (!this._panEnabled) return;
        e.preventDefault();
        this._camera.setCenter([
          this._camera.center[0] + panStep,
          this._camera.center[1],
        ]);
        this._notifyChange();
        break;
      case 'ArrowUp':
        if (!this._panEnabled) return;
        e.preventDefault();
        this._camera.setCenter([
          this._camera.center[0],
          this._camera.center[1] + panStep,
        ]);
        this._notifyChange();
        break;
      case 'ArrowDown':
        if (!this._panEnabled) return;
        e.preventDefault();
        this._camera.setCenter([
          this._camera.center[0],
          this._camera.center[1] - panStep,
        ]);
        this._notifyChange();
        break;
    }
  }

  // ─── Double-click Zoom ───

  private _handleDoubleClick(clientX: number, clientY: number): void {
    if (!this._zoomEnabled) return;

    const rect = this._element.getBoundingClientRect();
    const cursorX = clientX - rect.left;
    const cursorY = clientY - rect.top;

    this._zoomToPoint(cursorX, cursorY, this._camera.zoom + 1);
    this._notifyChange();
  }

  // ─── Pinch Zoom ───

  private _initPinch(): void {
    const pointers = [...this._pointers.values()];
    if (pointers.length < 2) return;

    const p1 = pointers[0]!;
    const p2 = pointers[1]!;

    this._lastPinchDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    this._lastPinchCenterX = (p1.x + p2.x) / 2;
    this._lastPinchCenterY = (p1.y + p2.y) / 2;
  }

  private _handlePinchMove(): void {
    const pointers = [...this._pointers.values()];
    if (pointers.length < 2) return;

    const p1 = pointers[0]!;
    const p2 = pointers[1]!;

    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const centerX = (p1.x + p2.x) / 2;
    const centerY = (p1.y + p2.y) / 2;

    if (this._lastPinchDist > 0) {
      const scale = dist / this._lastPinchDist;
      const zoomDelta = Math.log2(scale);
      const newZoom = this._camera.zoom + zoomDelta;

      // Zoom to pinch center
      const rect = this._element.getBoundingClientRect();
      const localX = centerX - rect.left;
      const localY = centerY - rect.top;

      this._zoomToPoint(localX, localY, newZoom);

      // Pan with pinch center movement
      if (this._panEnabled) {
        const resolution = this._getResolution();
        const panDx = -(centerX - this._lastPinchCenterX) * resolution;
        const panDy = (centerY - this._lastPinchCenterY) * resolution;

        const center = this._camera.center;
        this._camera.setCenter([center[0] + panDx, center[1] + panDy]);
      }

      this._notifyChange();
    }

    this._lastPinchDist = dist;
    this._lastPinchCenterX = centerX;
    this._lastPinchCenterY = centerY;
  }

  // ─── Inertia ───

  private _startInertia(): void {
    const startTime = performance.now();
    const vx = this._velocityX;
    const vy = this._velocityY;
    const duration = this._inertiaDuration;

    const tick = (): void => {
      if (this._destroyed || this._dragging) return;

      const elapsed = performance.now() - startTime;
      if (elapsed >= duration) {
        this._inertiaRafId = null;
        return;
      }

      // Ease-out: decelerate smoothly
      const t = elapsed / duration;
      const factor = 1 - t * t; // quadratic ease-out
      const dt = 16; // approximate frame time

      const dx = vx * dt * factor;
      const dy = vy * dt * factor;

      const center = this._camera.center;
      this._camera.setCenter([center[0] + dx, center[1] + dy]);
      this._notifyChange();

      this._inertiaRafId = requestAnimationFrame(tick);
    };

    this._inertiaRafId = requestAnimationFrame(tick);
  }

  private _stopInertia(): void {
    if (this._inertiaRafId !== null) {
      cancelAnimationFrame(this._inertiaRafId);
      this._inertiaRafId = null;
    }
  }

  // ─── Helpers ───

  /**
   * Zoom to a specific point on screen: the point under the cursor stays fixed.
   */
  private _zoomToPoint(screenX: number, screenY: number, newZoom: number): void {
    // Map position under cursor before zoom
    const mapBefore = this._camera.screenToMap(screenX, screenY);

    // Apply new zoom
    this._camera.setZoom(newZoom);

    // Map position under cursor after zoom (shifted due to new resolution)
    const mapAfter = this._camera.screenToMap(screenX, screenY);

    // Compensate: move center so mapBefore stays at the same screen position
    const center = this._camera.center;
    this._camera.setCenter([
      center[0] + (mapBefore[0] - mapAfter[0]),
      center[1] + (mapBefore[1] - mapAfter[1]),
    ]);
  }

  /**
   * Get current camera resolution (meters per pixel).
   */
  private _getResolution(): number {
    const WORLD_HALF = 20037508.342789244;
    return (WORLD_HALF * 2) / (256 * Math.pow(2, this._camera.zoom));
  }

  /**
   * Notify render loop + view change event.
   */
  private _notifyChange(): void {
    this._onDirty();
    this._onViewChange();
  }
}
