/**
 * Projection Interface
 *
 * Dual-projection model'in temel sözleşmesi.
 * MercatorProjection ve GlobeProjection bu interface'i implemente eder.
 */

export interface IProjection {
  /** Projeksiyon adı */
  readonly name: string;

  /**
   * lon/lat (derece) → normalized koordinatlar (0..1).
   * Mercator: Web Mercator 0..1 space
   * Globe: aynı (shader'da sphere'e dönüşüm yapılır)
   */
  project(lon: number, lat: number): [number, number];

  /**
   * Normalized koordinat (0..1) → lon/lat (derece).
   */
  unproject(x: number, y: number): [number, number];

  /** Yatayda sarma (antimeridian wrapping) yapıyor mu? */
  readonly wrapsHorizontally: boolean;
}
