/**
 * CoordinatesWidget — Displays cursor coordinates on the map.
 *
 * Supports DD (decimal degrees), DMS (degrees-minutes-seconds), and MGRS formats.
 * Listens to mouse move events on the bound container.
 */

import type { IView, WidgetPosition } from '@mapgpu/core';
import { WidgetBase } from './WidgetBase.js';

export type CoordinateFormat = 'DD' | 'DMS' | 'MGRS';

export interface CoordinatesWidgetOptions {
  id?: string;
  position?: WidgetPosition;
  format?: CoordinateFormat;
}

export class CoordinatesWidget extends WidgetBase {
  private _format: CoordinateFormat;
  private _spanEl: HTMLSpanElement | null = null;
  private _mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
  private _mouseTarget: HTMLElement | null = null;

  /** Current longitude in decimal degrees */
  private _lon = 0;
  /** Current latitude in decimal degrees */
  private _lat = 0;

  /**
   * Optional function to convert pixel coordinates to map coordinates.
   * If not provided, the widget displays pixel coordinates.
   * Signature: (pixelX, pixelY) => [longitude, latitude]
   */
  screenToMap: ((x: number, y: number) => [number, number]) | null = null;

  constructor(options?: CoordinatesWidgetOptions) {
    super('coordinates', options);
    this._format = options?.format ?? 'DD';
  }

  get format(): CoordinateFormat {
    return this._format;
  }

  set format(value: CoordinateFormat) {
    this._format = value;
    this._updateDisplay();
  }

  get longitude(): number {
    return this._lon;
  }

  get latitude(): number {
    return this._lat;
  }

  /**
   * Manually set coordinates (useful for programmatic updates).
   */
  setCoordinates(lon: number, lat: number): void {
    this._lon = lon;
    this._lat = lat;
    this._updateDisplay();
  }

  /**
   * Start listening to mouse move events on a target element.
   */
  listenTo(target: HTMLElement): void {
    this._removeMouseListener();
    this._mouseTarget = target;
    this._mouseMoveHandler = (e: MouseEvent) => {
      const rect = target.getBoundingClientRect();
      const pixelX = e.clientX - rect.left;
      const pixelY = e.clientY - rect.top;

      if (this.screenToMap) {
        const [lon, lat] = this.screenToMap(pixelX, pixelY);
        this._lon = lon;
        this._lat = lat;
      } else {
        this._lon = pixelX;
        this._lat = pixelY;
      }
      this._updateDisplay();
    };
    target.addEventListener('mousemove', this._mouseMoveHandler);
  }

  protected render(root: HTMLElement): void {
    root.style.backgroundColor = 'rgba(255, 255, 255, 0.85)';
    root.style.borderRadius = '3px';
    root.style.padding = '4px 8px';
    root.style.fontFamily = 'monospace';
    root.style.fontSize = '12px';
    root.style.color = '#333';
    root.style.whiteSpace = 'nowrap';

    this._spanEl = document.createElement('span');
    this._spanEl.textContent = this._formatCoordinates(this._lon, this._lat);
    root.appendChild(this._spanEl);
  }

  protected onViewBound(view: IView): void {
    // Auto-wire screenToMap and listenTo when bound to a view
    this.screenToMap = (x: number, y: number) => {
      // view.toScreen exists, so the inverse should be available on MapView
      // IView doesn't expose toMap directly, but the MapView instance does.
      const mv = view as unknown as { toMap?: (x: number, y: number) => [number, number] };
      return mv.toMap ? mv.toMap(x, y) : [x, y];
    };
    if (this._container) {
      this.listenTo(this._container);
    }
    this._updateDisplay();
  }

  protected onDestroy(): void {
    this._removeMouseListener();
    this._spanEl = null;
  }

  private _removeMouseListener(): void {
    if (this._mouseMoveHandler && this._mouseTarget) {
      this._mouseTarget.removeEventListener('mousemove', this._mouseMoveHandler);
    }
    this._mouseMoveHandler = null;
    this._mouseTarget = null;
  }

  private _updateDisplay(): void {
    if (!this._spanEl) return;
    this._spanEl.textContent = this._formatCoordinates(this._lon, this._lat);
  }

  private _formatCoordinates(lon: number, lat: number): string {
    switch (this._format) {
      case 'DD':
        return CoordinatesWidget.formatDD(lon, lat);
      case 'DMS':
        return CoordinatesWidget.formatDMS(lon, lat);
      case 'MGRS':
        return CoordinatesWidget.formatMGRS(lon, lat);
    }
  }

  /**
   * Format as Decimal Degrees: "28.9784° E, 41.0082° N"
   */
  static formatDD(lon: number, lat: number): string {
    const ew = lon >= 0 ? 'E' : 'W';
    const ns = lat >= 0 ? 'N' : 'S';
    return `${Math.abs(lon).toFixed(4)}° ${ew}, ${Math.abs(lat).toFixed(4)}° ${ns}`;
  }

  /**
   * Format as Degrees-Minutes-Seconds: "28° 58' 42.24" E, 41° 0' 29.52" N"
   */
  static formatDMS(lon: number, lat: number): string {
    const ew = lon >= 0 ? 'E' : 'W';
    const ns = lat >= 0 ? 'N' : 'S';
    return `${CoordinatesWidget._toDMS(Math.abs(lon))} ${ew}, ${CoordinatesWidget._toDMS(Math.abs(lat))} ${ns}`;
  }

  /**
   * Simplified MGRS-like format.
   * Full MGRS requires UTM zone + grid square calculation.
   * This provides a simplified representation for display purposes.
   */
  static formatMGRS(lon: number, lat: number): string {
    // Calculate UTM zone
    const zone = Math.floor((lon + 180) / 6) + 1;
    // Simplified: show zone + coordinate
    const ew = lon >= 0 ? 'E' : 'W';
    const ns = lat >= 0 ? 'N' : 'S';
    return `${zone}${ns} ${Math.abs(lon).toFixed(4)}${ew} ${Math.abs(lat).toFixed(4)}${ns}`;
  }

  private static _toDMS(decimal: number): string {
    const d = Math.floor(decimal);
    const minFloat = (decimal - d) * 60;
    const m = Math.floor(minFloat);
    const s = ((minFloat - m) * 60).toFixed(2);
    return `${d}° ${m}' ${s}"`;
  }
}
