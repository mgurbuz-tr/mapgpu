/**
 * LatLngBounds — Immutable geographic bounds class (Leaflet L.LatLngBounds equivalent).
 *
 * Represents a rectangular area in geographic coordinates (EPSG:4326).
 */

export class LatLngBounds {
  readonly minLon: number;
  readonly minLat: number;
  readonly maxLon: number;
  readonly maxLat: number;

  constructor(southwest: [number, number], northeast: [number, number]) {
    this.minLon = Math.min(southwest[0], northeast[0]);
    this.minLat = Math.min(southwest[1], northeast[1]);
    this.maxLon = Math.max(southwest[0], northeast[0]);
    this.maxLat = Math.max(southwest[1], northeast[1]);
  }

  /** Create from a flat array [minLon, minLat, maxLon, maxLat]. */
  static fromArray(arr: [number, number, number, number]): LatLngBounds {
    return new LatLngBounds([arr[0], arr[1]], [arr[2], arr[3]]);
  }

  /** Create bounds that contain all given points. */
  static fromPoints(points: [number, number][]): LatLngBounds {
    if (points.length === 0) return new LatLngBounds([0, 0], [0, 0]);
    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
    for (const [lon, lat] of points) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    return new LatLngBounds([minLon, minLat], [maxLon, maxLat]);
  }

  /** Southwest corner [lon, lat]. */
  get southWest(): [number, number] { return [this.minLon, this.minLat]; }

  /** Northeast corner [lon, lat]. */
  get northEast(): [number, number] { return [this.maxLon, this.maxLat]; }

  /** Center point [lon, lat]. */
  get center(): [number, number] {
    return [(this.minLon + this.maxLon) / 2, (this.minLat + this.maxLat) / 2];
  }

  /** Width in degrees. */
  get width(): number { return this.maxLon - this.minLon; }

  /** Height in degrees. */
  get height(): number { return this.maxLat - this.minLat; }

  /** Check if bounds are valid (non-zero area). */
  get isValid(): boolean {
    return isFinite(this.minLon) && isFinite(this.maxLon)
      && isFinite(this.minLat) && isFinite(this.maxLat)
      && this.minLon <= this.maxLon && this.minLat <= this.maxLat;
  }

  /** Check if a point is inside the bounds. */
  contains(point: [number, number]): boolean {
    return point[0] >= this.minLon && point[0] <= this.maxLon
      && point[1] >= this.minLat && point[1] <= this.maxLat;
  }

  /** Check if another bounds is fully inside this bounds. */
  containsBounds(other: LatLngBounds): boolean {
    return other.minLon >= this.minLon && other.maxLon <= this.maxLon
      && other.minLat >= this.minLat && other.maxLat <= this.maxLat;
  }

  /** Check if another bounds intersects this bounds. */
  intersects(other: LatLngBounds): boolean {
    return other.maxLon >= this.minLon && other.minLon <= this.maxLon
      && other.maxLat >= this.minLat && other.minLat <= this.maxLat;
  }

  /** Return a new bounds expanded to include the given point. */
  extend(point: [number, number]): LatLngBounds {
    return new LatLngBounds(
      [Math.min(this.minLon, point[0]), Math.min(this.minLat, point[1])],
      [Math.max(this.maxLon, point[0]), Math.max(this.maxLat, point[1])],
    );
  }

  /** Return a new bounds that is the union of this and another. */
  union(other: LatLngBounds): LatLngBounds {
    return new LatLngBounds(
      [Math.min(this.minLon, other.minLon), Math.min(this.minLat, other.minLat)],
      [Math.max(this.maxLon, other.maxLon), Math.max(this.maxLat, other.maxLat)],
    );
  }

  /** Return a new bounds padded by a ratio (0.1 = 10% padding). */
  pad(ratio: number): LatLngBounds {
    const dLon = this.width * ratio;
    const dLat = this.height * ratio;
    return new LatLngBounds(
      [this.minLon - dLon, this.minLat - dLat],
      [this.maxLon + dLon, this.maxLat + dLat],
    );
  }

  /** Check equality with another bounds. */
  equals(other: LatLngBounds): boolean {
    return this.minLon === other.minLon && this.minLat === other.minLat
      && this.maxLon === other.maxLon && this.maxLat === other.maxLat;
  }

  /** Convert to flat array [minLon, minLat, maxLon, maxLat]. */
  toArray(): [number, number, number, number] {
    return [this.minLon, this.minLat, this.maxLon, this.maxLat];
  }

  toString(): string {
    return `LatLngBounds([${this.minLon}, ${this.minLat}], [${this.maxLon}, ${this.maxLat}])`;
  }
}
