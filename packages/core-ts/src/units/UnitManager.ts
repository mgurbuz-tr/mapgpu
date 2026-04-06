/**
 * UnitManager — Global unit/format management with reactive events.
 *
 * Manages distance, area, and coordinate format settings.
 * Emits 'units-change' whenever any setting changes so consumers
 * (e.g. measurement labels) can reactively re-format.
 */

import { EventBus } from '../events.js';

// ─── Types ───

export type DistanceUnit = 'metric' | 'imperial' | 'nautical';
export type AreaUnit = 'metric' | 'imperial';
export type CoordinateFormat = 'DD' | 'DMS' | 'MGRS';

export interface UnitManagerOptions {
  distanceUnit?: DistanceUnit;
  areaUnit?: AreaUnit;
  coordinateFormat?: CoordinateFormat;
}

export interface UnitManagerEvents {
  [key: string]: unknown;
  'units-change': {
    distanceUnit: DistanceUnit;
    areaUnit: AreaUnit;
    coordinateFormat: CoordinateFormat;
  };
}

// ─── Constants ───

const FEET_PER_METER = 3.28084;
const FEET_PER_MILE = 5280;
const METERS_PER_NMI = 1852;
const SQ_FEET_PER_SQ_METER = 10.7639;
const SQ_FEET_PER_ACRE = 43_560;

// ─── UnitManager ───

export class UnitManager {
  private _distanceUnit: DistanceUnit;
  private _areaUnit: AreaUnit;
  private _coordinateFormat: CoordinateFormat;
  private _events = new EventBus<UnitManagerEvents>();

  constructor(options?: UnitManagerOptions) {
    this._distanceUnit = options?.distanceUnit ?? 'metric';
    this._areaUnit = options?.areaUnit ?? 'metric';
    this._coordinateFormat = options?.coordinateFormat ?? 'DD';
  }

  // ─── Getters / Setters ───

  get distanceUnit(): DistanceUnit { return this._distanceUnit; }
  set distanceUnit(unit: DistanceUnit) {
    if (this._distanceUnit === unit) return;
    this._distanceUnit = unit;
    this._emitChange();
  }

  get areaUnit(): AreaUnit { return this._areaUnit; }
  set areaUnit(unit: AreaUnit) {
    if (this._areaUnit === unit) return;
    this._areaUnit = unit;
    this._emitChange();
  }

  get coordinateFormat(): CoordinateFormat { return this._coordinateFormat; }
  set coordinateFormat(format: CoordinateFormat) {
    if (this._coordinateFormat === format) return;
    this._coordinateFormat = format;
    this._emitChange();
  }

  // ─── Formatters ───

  /**
   * Format a distance value in meters to the current distance unit.
   * metric: < 1000m → "X m", >= 1000m → "X.XX km"
   * imperial: < 5280ft → "X ft", >= 5280ft → "X.XX mi"
   * nautical: < 1852m → "X m", >= 1852m → "X.XX nmi"
   */
  formatDistance(meters: number): string {
    switch (this._distanceUnit) {
      case 'metric': {
        if (meters >= 1000) {
          return `${(meters / 1000).toFixed(2)} km`;
        }
        return `${Math.round(meters)} m`;
      }
      case 'imperial': {
        const feet = meters * FEET_PER_METER;
        if (feet >= FEET_PER_MILE) {
          return `${(feet / FEET_PER_MILE).toFixed(2)} mi`;
        }
        return `${Math.round(feet)} ft`;
      }
      case 'nautical': {
        if (meters >= METERS_PER_NMI) {
          return `${(meters / METERS_PER_NMI).toFixed(2)} nmi`;
        }
        return `${Math.round(meters)} m`;
      }
    }
  }

  /**
   * Format an area value in square meters to the current area unit.
   * metric: < 1M m² → "X m²", >= 1M → "X.XX km²"
   * imperial: < 43560 sqft → "X sq ft", >= → "X.XX acres"
   */
  formatArea(sqMeters: number): string {
    switch (this._areaUnit) {
      case 'metric': {
        if (sqMeters >= 1_000_000) {
          return `${(sqMeters / 1_000_000).toFixed(2)} km²`;
        }
        return `${Math.round(sqMeters)} m²`;
      }
      case 'imperial': {
        const sqFeet = sqMeters * SQ_FEET_PER_SQ_METER;
        if (sqFeet >= SQ_FEET_PER_ACRE) {
          return `${(sqFeet / SQ_FEET_PER_ACRE).toFixed(2)} acres`;
        }
        return `${Math.round(sqFeet)} sq ft`;
      }
    }
  }

  /**
   * Format a coordinate pair to the current coordinate format.
   * DD: "29.0784° E, 41.0082° N"
   * DMS: "29° 04' 42.24" E, 41° 0' 29.52" N"
   * MGRS: "35T LF 12345 67890" (simplified)
   */
  formatCoordinate(lon: number, lat: number): string {
    switch (this._coordinateFormat) {
      case 'DD':
        return UnitManager.formatDD(lon, lat);
      case 'DMS':
        return UnitManager.formatDMS(lon, lat);
      case 'MGRS':
        return UnitManager.formatMGRS(lon, lat);
    }
  }

  // ─── Static Formatters ───

  static formatDD(lon: number, lat: number): string {
    const ew = lon >= 0 ? 'E' : 'W';
    const ns = lat >= 0 ? 'N' : 'S';
    return `${Math.abs(lon).toFixed(4)}° ${ew}, ${Math.abs(lat).toFixed(4)}° ${ns}`;
  }

  static formatDMS(lon: number, lat: number): string {
    const ew = lon >= 0 ? 'E' : 'W';
    const ns = lat >= 0 ? 'N' : 'S';
    return `${UnitManager._toDMS(Math.abs(lon))} ${ew}, ${UnitManager._toDMS(Math.abs(lat))} ${ns}`;
  }

  static formatMGRS(lon: number, lat: number): string {
    const zone = Math.floor((lon + 180) / 6) + 1;
    const ns = lat >= 0 ? 'N' : 'S';
    const ew = lon >= 0 ? 'E' : 'W';
    return `${zone}${ns} ${Math.abs(lon).toFixed(4)}${ew} ${Math.abs(lat).toFixed(4)}${ns}`;
  }

  private static _toDMS(decimal: number): string {
    const d = Math.floor(decimal);
    const minFloat = (decimal - d) * 60;
    const m = Math.floor(minFloat);
    const s = ((minFloat - m) * 60).toFixed(2);
    return `${d}° ${m}' ${s}"`;
  }

  // ─── Events ───

  on(event: 'units-change', handler: (data: UnitManagerEvents['units-change']) => void): void {
    this._events.on(event, handler);
  }

  off(event: 'units-change', handler: (data: UnitManagerEvents['units-change']) => void): void {
    this._events.off(event, handler);
  }

  destroy(): void {
    this._events.removeAll();
  }

  // ─── Private ───

  private _emitChange(): void {
    this._events.emit('units-change', {
      distanceUnit: this._distanceUnit,
      areaUnit: this._areaUnit,
      coordinateFormat: this._coordinateFormat,
    });
  }
}
