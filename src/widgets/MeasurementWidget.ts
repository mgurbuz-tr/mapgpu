/**
 * MeasurementWidget — Distance and area measurement tool.
 *
 * Supports Haversine distance and Shoelace (geodesic) area calculations.
 * Unit conversion: m/km, ft/mi.
 */

import type { IView, WidgetPosition } from '../core/index.js';
import { WidgetBase } from './WidgetBase.js';

export type MeasurementMode = 'distance' | 'area' | 'none';
export type MeasurementUnit = 'metric' | 'imperial';

export interface MeasurementResult {
  distance?: number;
  area?: number;
  unit: string;
}

export interface MeasurementWidgetOptions {
  id?: string;
  position?: WidgetPosition;
  mode?: MeasurementMode;
  unit?: MeasurementUnit;
}

const EARTH_RADIUS_M = 6_371_000;
const FEET_PER_METER = 3.28084;
const FEET_PER_MILE = 5280;
const SQ_FEET_PER_SQ_METER = 10.7639;
const SQ_FEET_PER_ACRE = 43_560;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Haversine distance between two points on Earth.
 * @returns distance in meters
 */
export function haversineDistance(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

/**
 * Shoelace formula for geodesic polygon area.
 * Uses spherical excess for approximate geodesic area.
 * @returns area in square meters
 */
export function sphericalPolygonArea(points: Array<[number, number]>): number {
  if (points.length < 3) return 0;

  // Use the Shoelace-like formula on a sphere
  // Based on the spherical excess method
  let total = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const lon1 = toRad(points[i]![0]);
    const lat1 = toRad(points[i]![1]);
    const lon2 = toRad(points[j]![0]);
    const lat2 = toRad(points[j]![1]);

    total += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  const areaRad = Math.abs(total / 2);
  return areaRad * EARTH_RADIUS_M * EARTH_RADIUS_M;
}

export class MeasurementWidget extends WidgetBase {
  private _mode: MeasurementMode;
  private _unit: MeasurementUnit;
  private _points: Array<[number, number]> = [];
  private _modeLabel: HTMLSpanElement | null = null;
  private _resultLabel: HTMLSpanElement | null = null;
  private _distBtn: HTMLButtonElement | null = null;
  private _areaBtn: HTMLButtonElement | null = null;

  constructor(options?: MeasurementWidgetOptions) {
    super('measurement', options);
    this._mode = options?.mode ?? 'none';
    this._unit = options?.unit ?? 'metric';
  }

  get mode(): MeasurementMode {
    return this._mode;
  }

  get unit(): MeasurementUnit {
    return this._unit;
  }

  set unit(value: MeasurementUnit) {
    this._unit = value;
    this._updateDisplay();
  }

  get points(): ReadonlyArray<[number, number]> {
    return this._points;
  }

  setMode(mode: MeasurementMode): void {
    this._mode = mode;
    this._points = [];
    this._updateModeHighlight();
    this._updateDisplay();
  }

  addPoint(lon: number, lat: number): void {
    this._points.push([lon, lat]);
    this._updateDisplay();
  }

  getResult(): MeasurementResult { // NOSONAR
    if (this._mode === 'distance') {
      const dist = this._calculateTotalDistance();
      if (this._unit === 'imperial') {
        const distFt = dist * FEET_PER_METER;
        if (distFt >= FEET_PER_MILE) {
          return { distance: distFt / FEET_PER_MILE, unit: 'mi' };
        }
        return { distance: distFt, unit: 'ft' };
      }
      if (dist >= 1000) {
        return { distance: dist / 1000, unit: 'km' };
      }
      return { distance: dist, unit: 'm' };
    }

    if (this._mode === 'area') {
      const areaM2 = sphericalPolygonArea(this._points);
      if (this._unit === 'imperial') {
        const areaSqFt = areaM2 * SQ_FEET_PER_SQ_METER;
        if (areaSqFt >= SQ_FEET_PER_ACRE) {
          return { area: areaSqFt / SQ_FEET_PER_ACRE, unit: 'acres' };
        }
        return { area: areaSqFt, unit: 'sq ft' };
      }
      if (areaM2 >= 1_000_000) {
        return { area: areaM2 / 1_000_000, unit: 'km²' };
      }
      return { area: areaM2, unit: 'm²' };
    }

    return { unit: '' };
  }

  clear(): void {
    this._points = [];
    this._updateDisplay();
  }

  protected render(root: HTMLElement): void {
    root.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
    root.style.borderRadius = '4px';
    root.style.padding = '8px';
    root.style.fontFamily = 'sans-serif';
    root.style.fontSize = '13px';
    root.style.boxShadow = '0 1px 4px rgba(0,0,0,0.2)';
    root.style.minWidth = '180px';

    const title = document.createElement('div');
    title.textContent = 'Measurement';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '6px';
    title.style.fontSize = '14px';
    root.appendChild(title);

    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '4px';
    btnRow.style.marginBottom = '8px';

    this._distBtn = document.createElement('button');
    this._distBtn.textContent = 'Distance';
    this._distBtn.classList.add('mode-btn');
    this._distBtn.addEventListener('click', () => this.setMode('distance'));
    btnRow.appendChild(this._distBtn);

    this._areaBtn = document.createElement('button');
    this._areaBtn.textContent = 'Area';
    this._areaBtn.classList.add('mode-btn');
    this._areaBtn.addEventListener('click', () => this.setMode('area'));
    btnRow.appendChild(this._areaBtn);

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    clearBtn.classList.add('clear-btn');
    clearBtn.addEventListener('click', () => {
      this.setMode('none');
    });
    btnRow.appendChild(clearBtn);

    root.appendChild(btnRow);

    this._modeLabel = document.createElement('span');
    this._modeLabel.classList.add('mode-label');
    this._modeLabel.style.display = 'block';
    this._modeLabel.style.fontSize = '11px';
    this._modeLabel.style.color = '#666';
    this._modeLabel.style.marginBottom = '4px';
    root.appendChild(this._modeLabel);

    this._resultLabel = document.createElement('span');
    this._resultLabel.classList.add('result-label');
    this._resultLabel.style.display = 'block';
    this._resultLabel.style.fontWeight = 'bold';
    root.appendChild(this._resultLabel);

    this._updateModeHighlight();
    this._updateDisplay();
  }

  protected onViewBound(_view: IView): void {
    // no-op
  }

  protected onDestroy(): void {
    this._points = [];
    this._modeLabel = null;
    this._resultLabel = null;
    this._distBtn = null;
    this._areaBtn = null;
  }

  private _calculateTotalDistance(): number {
    let total = 0;
    for (let i = 1; i < this._points.length; i++) {
      const prev = this._points[i - 1]!;
      const curr = this._points[i]!;
      total += haversineDistance(prev[0], prev[1], curr[0], curr[1]);
    }
    return total;
  }

  private _updateModeHighlight(): void {
    if (this._distBtn) {
      this._distBtn.style.fontWeight = this._mode === 'distance' ? 'bold' : 'normal';
    }
    if (this._areaBtn) {
      this._areaBtn.style.fontWeight = this._mode === 'area' ? 'bold' : 'normal';
    }
  }

  private _updateDisplay(): void {
    if (!this._modeLabel || !this._resultLabel) return;

    if (this._mode === 'none') {
      this._modeLabel.textContent = 'Select a measurement mode';
      this._resultLabel.textContent = '';
      return;
    }

    this._modeLabel.textContent = `Mode: ${this._mode} | Points: ${this._points.length}`;

    const result = this.getResult();
    if (result.distance !== undefined) {
      this._resultLabel.textContent = `${result.distance.toFixed(2)} ${result.unit}`;
    } else if (result.area === undefined) {
      this._resultLabel.textContent = '';
    } else {
      this._resultLabel.textContent = `${result.area.toFixed(2)} ${result.unit}`;
    }
  }
}
