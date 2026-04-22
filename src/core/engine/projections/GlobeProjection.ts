/**
 * Globe Projection (Dual-Projection Wrapper)
 *
 * MercatorProjection + globe transition logic.
 * `globeness` faktörü (0=mercator, 1=globe) zoom seviyesine göre otomatik geçiş yapar.
 *
 * MapLibre'nin GlobeProjection yaklaşımını takip eder:
 * - zoom < TRANSITION_ZOOM_LOW  → globeness = 1 (tam globe)
 * - zoom > TRANSITION_ZOOM_HIGH → globeness = 0 (tam mercator)
 * - arada → smooth interpolation
 */

import type { IProjection } from './IProjection.js';
import { MercatorProjection } from './MercatorProjection.js';

export class GlobeProjection implements IProjection {
  readonly name = 'globe';

  /** Zoom < bu değer → tam globe */
  static readonly TRANSITION_ZOOM_LOW = 5;
  /** Zoom > bu değer → tam mercator */
  static readonly TRANSITION_ZOOM_HIGH = 6;

  private _globeness = 1;
  private readonly _mercator: MercatorProjection;

  constructor() {
    this._mercator = new MercatorProjection();
  }

  /** Mevcut globeness değeri (0=mercator, 1=globe) */
  get globeness(): number {
    return this._globeness;
  }

  /** Globe modunda horizontal wrap yok */
  get wrapsHorizontally(): boolean {
    return this._globeness < 1;
  }

  /**
   * Zoom seviyesinden globeness hesapla.
   * smooth interpolation: low=1, high=0, arada cosine easing.
   */
  static globenessFromZoom(zoom: number): number {
    if (zoom <= GlobeProjection.TRANSITION_ZOOM_LOW) return 1;
    if (zoom >= GlobeProjection.TRANSITION_ZOOM_HIGH) return 0;
    const t =
      (zoom - GlobeProjection.TRANSITION_ZOOM_LOW) /
      (GlobeProjection.TRANSITION_ZOOM_HIGH - GlobeProjection.TRANSITION_ZOOM_LOW);
    // Cosine easing for smooth transition
    return 0.5 * (1 + Math.cos(t * Math.PI));
  }

  /** Globeness değerini doğrudan ayarla (0-1) */
  setGlobeness(value: number): void {
    this._globeness = Math.max(0, Math.min(1, value));
  }

  /** Zoom seviyesinden globeness güncelle */
  updateFromZoom(zoom: number): void {
    this._globeness = GlobeProjection.globenessFromZoom(zoom);
  }

  /**
   * lon/lat → normalized Mercator (0..1).
   * Globe modunda da aynı Mercator coordinates — shader'da sphere'e dönüşüm yapılır.
   */
  project(lon: number, lat: number): [number, number] {
    return this._mercator.project(lon, lat);
  }

  /**
   * Normalized Mercator (0..1) → lon/lat.
   */
  unproject(x: number, y: number): [number, number] {
    return this._mercator.unproject(x, y);
  }

  /**
   * Mercator (0..1) → Angular coordinates (radians).
   * Shader'daki mercatorToAngular ile aynı:
   * - x → longitude: x * 2π - π → [-π, π] → shifted: x*2π+π (MapLibre convention)
   * - y → latitude: 2*atan(exp(π - y*2π)) - π/2
   */
  static mercatorToAngular(mx: number, my: number): [number, number] {
    const lon = mx * 2 * Math.PI - Math.PI;
    const lat = 2 * Math.atan(Math.exp(Math.PI - my * 2 * Math.PI)) - Math.PI / 2;
    return [lon, lat];
  }

  /**
   * Angular (radians) → unit sphere (3D).
   * Shader'daki angularToSphere ile aynı:
   * - x = cos(lat) * sin(lon)
   * - y = sin(lat)
   * - z = cos(lat) * cos(lon)
   */
  static angularToSphere(lon: number, lat: number): [number, number, number] {
    const cosLat = Math.cos(lat);
    return [
      cosLat * Math.sin(lon),
      Math.sin(lat),
      cosLat * Math.cos(lon),
    ];
  }

  /**
   * lon/lat (derece) → unit sphere (3D).
   * Convenience: project → angular → sphere.
   */
  static lonLatToSphere(lon: number, lat: number): [number, number, number] {
    const lonRad = lon * (Math.PI / 180);
    const latRad = lat * (Math.PI / 180);
    return GlobeProjection.angularToSphere(lonRad, latRad);
  }
}
