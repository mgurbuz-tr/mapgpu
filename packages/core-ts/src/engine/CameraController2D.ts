/**
 * CameraController2D — 2D kamera yönetimi
 *
 * View state (center, zoom, rotation) yönetir.
 * Ortho projection ve view matrix hesaplar.
 * Extent hesaplama (viewport boyutuna göre).
 *
 * Render coordinate space: EPSG:3857 (Web Mercator)
 */

import type { Extent } from '../interfaces/index.js';

/** Web Mercator half-world size in meters */
const WORLD_HALF = 20037508.342789244;

export interface ViewState {
  /** Center in EPSG:3857 [x, y] */
  center: [number, number];
  /** Zoom level (0–22+) */
  zoom: number;
  /** Rotation in radians */
  rotation: number;
}

export interface CameraController2DOptions {
  center?: [number, number];
  zoom?: number;
  rotation?: number;
  minZoom?: number;
  maxZoom?: number;
  viewportWidth?: number;
  viewportHeight?: number;
}

export class CameraController2D {
  private _center: [number, number];
  private _zoom: number;
  private _rotation: number;
  private _minZoom: number;
  private _maxZoom: number;
  private _viewportWidth: number;
  private _viewportHeight: number;
  private _dirty = true;

  // Cached matrices
  private _viewMatrix: Float32Array = new Float32Array(16);
  private _projectionMatrix: Float32Array = new Float32Array(16);

  constructor(options: CameraController2DOptions = {}) {
    this._center = options.center ?? [0, 0];
    this._zoom = options.zoom ?? 0;
    this._rotation = options.rotation ?? 0;
    this._minZoom = options.minZoom ?? 0;
    this._maxZoom = options.maxZoom ?? 24;
    this._viewportWidth = options.viewportWidth ?? 800;
    this._viewportHeight = options.viewportHeight ?? 600;
    this._clampZoom();
    this._updateMatrices();
  }

  // ─── Getters ───

  get center(): [number, number] {
    return [this._center[0], this._center[1]];
  }

  get zoom(): number {
    return this._zoom;
  }

  get rotation(): number {
    return this._rotation;
  }

  get minZoom(): number {
    return this._minZoom;
  }

  get maxZoom(): number {
    return this._maxZoom;
  }

  get viewportWidth(): number {
    return this._viewportWidth;
  }

  get viewportHeight(): number {
    return this._viewportHeight;
  }

  get dirty(): boolean {
    return this._dirty;
  }

  // ─── Setters / Actions ───

  setCenter(center: [number, number]): void {
    this._center = [center[0], center[1]];
    this._dirty = true;
    this._updateMatrices();
  }

  setZoom(zoom: number): void {
    this._zoom = zoom;
    this._clampZoom();
    this._dirty = true;
    this._updateMatrices();
  }

  setRotation(rotation: number): void {
    this._rotation = rotation;
    this._dirty = true;
    this._updateMatrices();
  }

  setViewport(width: number, height: number): void {
    this._viewportWidth = width;
    this._viewportHeight = height;
    this._dirty = true;
    this._updateMatrices();
  }

  zoomIn(): void {
    this.setZoom(this._zoom + 1);
  }

  zoomOut(): void {
    this.setZoom(this._zoom - 1);
  }

  clearDirty(): void {
    this._dirty = false;
  }

  // ─── Matrix Access ───

  get viewMatrix(): Float32Array {
    return this._viewMatrix;
  }

  get projectionMatrix(): Float32Array {
    return this._projectionMatrix;
  }

  // ─── Extent ───

  /**
   * Calculates the visible extent in EPSG:3857 coordinates.
   * Takes into account center, zoom, rotation, and viewport size.
   */
  getExtent(): Extent {
    const resolution = this._getResolution();
    const halfW = (this._viewportWidth / 2) * resolution;
    const halfH = (this._viewportHeight / 2) * resolution;

    if (this._rotation === 0) {
      return {
        minX: this._center[0] - halfW,
        minY: this._center[1] - halfH,
        maxX: this._center[0] + halfW,
        maxY: this._center[1] + halfH,
        spatialReference: 'EPSG:3857',
      };
    }

    // With rotation, compute the bounding box of the rotated viewport
    const cos = Math.cos(this._rotation);
    const sin = Math.sin(this._rotation);

    const corners: Array<[number, number]> = [
      [-halfW, -halfH],
      [halfW, -halfH],
      [halfW, halfH],
      [-halfW, halfH],
    ];

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const [cx, cy] of corners) {
      const rx = cx * cos - cy * sin + this._center[0];
      const ry = cx * sin + cy * cos + this._center[1];
      minX = Math.min(minX, rx);
      minY = Math.min(minY, ry);
      maxX = Math.max(maxX, rx);
      maxY = Math.max(maxY, ry);
    }

    return {
      minX,
      minY,
      maxX,
      maxY,
      spatialReference: 'EPSG:3857',
    };
  }

  // ─── Coordinate Conversions ───

  /**
   * Convert screen coordinates to map coordinates (EPSG:3857).
   */
  screenToMap(screenX: number, screenY: number): [number, number] {
    const resolution = this._getResolution();

    // Screen origin is top-left; map origin is center
    let dx = (screenX - this._viewportWidth / 2) * resolution;
    let dy = (this._viewportHeight / 2 - screenY) * resolution;

    // Apply inverse rotation
    if (this._rotation !== 0) {
      const cos = Math.cos(-this._rotation);
      const sin = Math.sin(-this._rotation);
      const rx = dx * cos - dy * sin;
      const ry = dx * sin + dy * cos;
      dx = rx;
      dy = ry;
    }

    return [this._center[0] + dx, this._center[1] + dy];
  }

  /**
   * Convert map coordinates (EPSG:3857) to screen coordinates.
   */
  mapToScreen(mapX: number, mapY: number): [number, number] {
    const resolution = this._getResolution();

    let dx = mapX - this._center[0];
    let dy = mapY - this._center[1];

    // Apply rotation
    if (this._rotation !== 0) {
      const cos = Math.cos(this._rotation);
      const sin = Math.sin(this._rotation);
      const rx = dx * cos - dy * sin;
      const ry = dx * sin + dy * cos;
      dx = rx;
      dy = ry;
    }

    const screenX = dx / resolution + this._viewportWidth / 2;
    const screenY = this._viewportHeight / 2 - dy / resolution;

    return [screenX, screenY];
  }

  // ─── Private ───

  /**
   * Meters per pixel at current zoom level.
   * At zoom 0 the entire world (2 * WORLD_HALF meters) fits into 256 pixels.
   */
  private _getResolution(): number {
    return (WORLD_HALF * 2) / (256 * Math.pow(2, this._zoom));
  }

  private _clampZoom(): void {
    this._zoom = Math.max(this._minZoom, Math.min(this._maxZoom, this._zoom));
  }

  /**
   * Build orthographic projection and view matrices.
   * Column-major layout (WebGPU/OpenGL convention).
   */
  private _updateMatrices(): void {
    const resolution = this._getResolution();
    const halfW = (this._viewportWidth / 2) * resolution;
    const halfH = (this._viewportHeight / 2) * resolution;

    // Orthographic projection matrix (column-major)
    // Maps [-halfW, halfW] x [-halfH, halfH] to [-1, 1] x [-1, 1]
    const proj = this._projectionMatrix;
    proj.fill(0);
    proj[0] = 1 / halfW;    // m00
    proj[5] = 1 / halfH;    // m11
    proj[10] = -1;           // m22 (depth: near=0, far=1 for WebGPU)
    proj[15] = 1;            // m33

    // View matrix: translate(-center) then rotate(-rotation)
    const view = this._viewMatrix;
    const cos = Math.cos(-this._rotation);
    const sin = Math.sin(-this._rotation);
    const tx = -this._center[0];
    const ty = -this._center[1];

    view.fill(0);
    view[0] = cos;
    view[1] = sin;
    view[4] = -sin;
    view[5] = cos;
    view[10] = 1;
    view[12] = cos * tx + (-sin) * ty;
    view[13] = sin * tx + cos * ty;
    view[15] = 1;
  }
}
