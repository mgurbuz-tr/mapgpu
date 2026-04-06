/**
 * ScaleBarWidget — Displays a scale bar based on current view extent/zoom.
 *
 * Supports metric (m/km) and imperial (ft/mi) units.
 */

import type { IView, WidgetPosition } from '@mapgpu/core';
import { WidgetBase } from './WidgetBase.js';

export type ScaleBarUnit = 'metric' | 'imperial' | 'dual';

export interface ScaleBarWidgetOptions {
  id?: string;
  position?: WidgetPosition;
  unit?: ScaleBarUnit;
  maxWidthPx?: number;
}

/** Nice round numbers for scale bar labels */
const NICE_NUMBERS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000, 200_000, 500_000, 1_000_000];

const FEET_PER_METER = 3.28084;
const FEET_PER_MILE = 5280;

/** Equatorial circumference in meters (WGS-84). */
const EQUATORIAL_CIRCUMFERENCE = 40075016.686;

export class ScaleBarWidget extends WidgetBase {
  private _unit: ScaleBarUnit;
  private _maxWidthPx: number;
  private _barEl: HTMLDivElement | null = null;
  private _labelEl: HTMLSpanElement | null = null;
  private _groundResolution = 1; // meters per pixel
  private _viewChangeHandler: ((...args: unknown[]) => void) | null = null;

  constructor(options?: ScaleBarWidgetOptions) {
    super('scalebar', options);
    this._unit = options?.unit ?? 'metric';
    this._maxWidthPx = options?.maxWidthPx ?? 150;
  }

  get unit(): ScaleBarUnit {
    return this._unit;
  }

  set unit(value: ScaleBarUnit) {
    this._unit = value;
    this._updateDisplay();
  }

  /**
   * Update the scale bar based on ground resolution (meters per pixel).
   * Should be called whenever view changes (zoom, extent, etc.).
   */
  setGroundResolution(metersPerPixel: number): void {
    this._groundResolution = metersPerPixel;
    this._updateDisplay();
  }

  protected render(root: HTMLElement): void {
    root.style.backgroundColor = 'rgba(255, 255, 255, 0.85)';
    root.style.borderRadius = '3px';
    root.style.padding = '4px 8px';
    root.style.fontFamily = 'sans-serif';
    root.style.fontSize = '11px';
    root.style.lineHeight = '1';
    root.style.display = 'inline-block';

    this._barEl = document.createElement('div');
    this._barEl.classList.add('bar');
    this._barEl.style.height = '4px';
    this._barEl.style.backgroundColor = '#333';
    this._barEl.style.borderLeft = '2px solid #333';
    this._barEl.style.borderRight = '2px solid #333';
    this._barEl.style.marginBottom = '2px';
    root.appendChild(this._barEl);

    this._labelEl = document.createElement('span');
    this._labelEl.classList.add('label');
    this._labelEl.style.display = 'block';
    this._labelEl.style.textAlign = 'center';
    this._labelEl.style.color = '#333';
    root.appendChild(this._labelEl);

    this._updateDisplay();
  }

  protected onViewBound(view: IView): void {
    // Auto-listen to view-change so the scale bar stays in sync
    this._removeViewListener();
    this._viewChangeHandler = (data: unknown) => {
      const d = data as { zoom?: number };
      if (d.zoom != null) {
        this.setGroundResolution(
          (EQUATORIAL_CIRCUMFERENCE / 256) / Math.pow(2, d.zoom),
        );
      }
    };
    view.on('view-change', this._viewChangeHandler);
    this._updateDisplay();
  }

  protected onDestroy(): void {
    this._removeViewListener();
    this._barEl = null;
    this._labelEl = null;
  }

  private _removeViewListener(): void {
    if (this._viewChangeHandler && this._view) {
      this._view.off('view-change', this._viewChangeHandler);
      this._viewChangeHandler = null;
    }
  }

  private _updateDisplay(): void {
    if (!this._barEl || !this._labelEl) return;

    if (this._unit === 'imperial') {
      this._renderImperial();
    } else {
      this._renderMetric();
    }
  }

  private _renderMetric(): void {
    const maxDistanceM = this._maxWidthPx * this._groundResolution;
    const niceDistance = ScaleBarWidget.findNiceNumber(maxDistanceM);
    const barWidthPx = niceDistance / this._groundResolution;

    this._barEl!.style.width = `${Math.round(barWidthPx)}px`;

    if (niceDistance >= 1000) {
      this._labelEl!.textContent = `${niceDistance / 1000} km`;
    } else {
      this._labelEl!.textContent = `${niceDistance} m`;
    }
  }

  private _renderImperial(): void {
    const maxDistanceM = this._maxWidthPx * this._groundResolution;
    const maxDistanceFt = maxDistanceM * FEET_PER_METER;
    const niceDistanceFt = ScaleBarWidget.findNiceNumber(maxDistanceFt);
    const niceDistanceM = niceDistanceFt / FEET_PER_METER;
    const barWidthPx = niceDistanceM / this._groundResolution;

    this._barEl!.style.width = `${Math.round(barWidthPx)}px`;

    if (niceDistanceFt >= FEET_PER_MILE) {
      const miles = niceDistanceFt / FEET_PER_MILE;
      this._labelEl!.textContent = `${miles} mi`;
    } else {
      this._labelEl!.textContent = `${niceDistanceFt} ft`;
    }
  }

  /**
   * Find the largest "nice" number that is <= maxValue.
   * Exported as static for testability.
   */
  static findNiceNumber(maxValue: number): number {
    let result = NICE_NUMBERS[0]!;
    for (const n of NICE_NUMBERS) {
      if (n <= maxValue) {
        result = n;
      } else {
        break;
      }
    }
    return result;
  }
}
