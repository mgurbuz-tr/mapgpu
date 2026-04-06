/**
 * Named 3D Geometry Generators — Box, Cylinder, Sphere, Wall, Corridor.
 *
 * CesiumJS geometry type equivalents. Each generates position + normal + index
 * arrays ready for GPU upload via the ExtrusionPipeline or a dedicated 3D pipeline.
 */

export interface GeneratedMesh {
  /** Vertex positions [x, y, z, ...]. */
  positions: Float32Array;
  /** Vertex normals [nx, ny, nz, ...]. */
  normals: Float32Array;
  /** Triangle indices. */
  indices: Uint32Array;
  /** Number of vertices. */
  vertexCount: number;
}

/* ------------------------------------------------------------------ */
/*  Box                                                                */
/* ------------------------------------------------------------------ */

/**
 * Generate a box (cuboid) mesh centered at origin.
 *
 * @param width - X dimension (meters).
 * @param height - Y dimension (meters).
 * @param depth - Z dimension (meters).
 */
export function createBoxGeometry(
  width: number = 1,
  height: number = 1,
  depth: number = 1,
): GeneratedMesh {
  const hw = width / 2, hh = height / 2, hd = depth / 2;

  // 6 faces × 4 vertices = 24 vertices, 6 faces × 2 triangles × 3 indices = 36 indices
  const positions = new Float32Array([
    // Front (+Z)
    -hw, -hh, hd,   hw, -hh, hd,   hw, hh, hd,   -hw, hh, hd,
    // Back (-Z)
    hw, -hh, -hd,  -hw, -hh, -hd,  -hw, hh, -hd,   hw, hh, -hd,
    // Top (+Y)
    -hw, hh, hd,    hw, hh, hd,    hw, hh, -hd,   -hw, hh, -hd,
    // Bottom (-Y)
    -hw, -hh, -hd,  hw, -hh, -hd,  hw, -hh, hd,   -hw, -hh, hd,
    // Right (+X)
    hw, -hh, hd,    hw, -hh, -hd,  hw, hh, -hd,    hw, hh, hd,
    // Left (-X)
    -hw, -hh, -hd, -hw, -hh, hd,  -hw, hh, hd,    -hw, hh, -hd,
  ]);

  const normals = new Float32Array([
    // Front
    0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
    // Back
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
    // Top
    0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
    // Bottom
    0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    // Right
    1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,
    // Left
    -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
  ]);

  const indices = new Uint32Array([
    0, 1, 2,  0, 2, 3,     // Front
    4, 5, 6,  4, 6, 7,     // Back
    8, 9, 10, 8, 10, 11,   // Top
    12, 13, 14, 12, 14, 15, // Bottom
    16, 17, 18, 16, 18, 19, // Right
    20, 21, 22, 20, 22, 23, // Left
  ]);

  return { positions, normals, indices, vertexCount: 24 };
}

/* ------------------------------------------------------------------ */
/*  Cylinder                                                           */
/* ------------------------------------------------------------------ */

/**
 * Generate a cylinder mesh centered at origin, axis along Y.
 *
 * @param radiusTop - Top radius (0 for cone).
 * @param radiusBottom - Bottom radius.
 * @param height - Height along Y axis.
 * @param segments - Number of radial segments (default 32).
 */
export function createCylinderGeometry(
  radiusTop: number = 0.5,
  radiusBottom: number = 0.5,
  height: number = 1,
  segments: number = 32,
): GeneratedMesh {
  const halfH = height / 2;
  const posArr: number[] = [];
  const normArr: number[] = [];
  const idxArr: number[] = [];
  let vi = 0;

  // Side faces
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Bottom vertex
    posArr.push(cos * radiusBottom, -halfH, sin * radiusBottom);
    // Top vertex
    posArr.push(cos * radiusTop, halfH, sin * radiusTop);

    // Normal: approximate for tapered cylinder
    const slope = radiusBottom - radiusTop;
    const len = Math.sqrt(slope * slope + height * height);
    const nx = cos * height / len;
    const ny = slope / len;
    const nz = sin * height / len;
    normArr.push(nx, ny, nz);
    normArr.push(nx, ny, nz);

    if (i < segments) {
      const base = vi;
      idxArr.push(base, base + 1, base + 3);
      idxArr.push(base, base + 3, base + 2);
      vi += 2;
    }
  }
  vi += 2; // last pair

  // Top cap
  const topCenter = vi;
  posArr.push(0, halfH, 0);
  normArr.push(0, 1, 0);
  vi++;
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    posArr.push(Math.cos(angle) * radiusTop, halfH, Math.sin(angle) * radiusTop);
    normArr.push(0, 1, 0);
    if (i > 0) {
      idxArr.push(topCenter, vi - 1, vi);
    }
    vi++;
  }
  idxArr.push(topCenter, vi - 1, topCenter + 1);

  // Bottom cap
  const botCenter = vi;
  posArr.push(0, -halfH, 0);
  normArr.push(0, -1, 0);
  vi++;
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    posArr.push(Math.cos(angle) * radiusBottom, -halfH, Math.sin(angle) * radiusBottom);
    normArr.push(0, -1, 0);
    if (i > 0) {
      idxArr.push(botCenter, vi, vi - 1); // reversed winding
    }
    vi++;
  }
  idxArr.push(botCenter, botCenter + 1, vi - 1);

  return {
    positions: new Float32Array(posArr),
    normals: new Float32Array(normArr),
    indices: new Uint32Array(idxArr),
    vertexCount: posArr.length / 3,
  };
}

/* ------------------------------------------------------------------ */
/*  Sphere (UV)                                                        */
/* ------------------------------------------------------------------ */

/**
 * Generate a UV sphere mesh centered at origin.
 *
 * @param radius - Sphere radius.
 * @param widthSegments - Horizontal segments (default 32).
 * @param heightSegments - Vertical segments (default 16).
 */
export function createSphereGeometry(
  radius: number = 1,
  widthSegments: number = 32,
  heightSegments: number = 16,
): GeneratedMesh {
  const posArr: number[] = [];
  const normArr: number[] = [];
  const idxArr: number[] = [];

  for (let y = 0; y <= heightSegments; y++) {
    const phi = (y / heightSegments) * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    for (let x = 0; x <= widthSegments; x++) {
      const theta = (x / widthSegments) * Math.PI * 2;
      const nx = sinPhi * Math.cos(theta);
      const ny = cosPhi;
      const nz = sinPhi * Math.sin(theta);

      posArr.push(nx * radius, ny * radius, nz * radius);
      normArr.push(nx, ny, nz);
    }
  }

  for (let y = 0; y < heightSegments; y++) {
    for (let x = 0; x < widthSegments; x++) {
      const a = y * (widthSegments + 1) + x;
      const b = a + widthSegments + 1;
      idxArr.push(a, b, a + 1);
      idxArr.push(b, b + 1, a + 1);
    }
  }

  return {
    positions: new Float32Array(posArr),
    normals: new Float32Array(normArr),
    indices: new Uint32Array(idxArr),
    vertexCount: posArr.length / 3,
  };
}

/* ------------------------------------------------------------------ */
/*  Hemisphere                                                         */
/* ------------------------------------------------------------------ */

/**
 * Generate a hemisphere mesh (upper half of sphere + flat bottom cap).
 * Y=0 at base, Y=radius at top. Smooth normals on dome, flat normal on base.
 *
 * @param radius - Hemisphere radius.
 * @param widthSegments - Horizontal segments (default 32).
 * @param heightSegments - Vertical segments for dome (default 12).
 */
export function createHemisphereGeometry(
  radius: number = 1,
  widthSegments: number = 32,
  heightSegments: number = 12,
): GeneratedMesh {
  const posArr: number[] = [];
  const normArr: number[] = [];
  const idxArr: number[] = [];

  // ─── Dome: upper half of UV sphere (phi: 0 → PI/2) ───
  for (let y = 0; y <= heightSegments; y++) {
    const phi = (y / heightSegments) * (Math.PI / 2); // 0 → π/2 (top → equator)
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    for (let x = 0; x <= widthSegments; x++) {
      const theta = (x / widthSegments) * Math.PI * 2;
      const nx = sinPhi * Math.cos(theta);
      const ny = cosPhi;
      const nz = sinPhi * Math.sin(theta);

      posArr.push(nx * radius, ny * radius, nz * radius);
      normArr.push(nx, ny, nz);
    }
  }

  for (let y = 0; y < heightSegments; y++) {
    for (let x = 0; x < widthSegments; x++) {
      const a = y * (widthSegments + 1) + x;
      const b = a + widthSegments + 1;
      idxArr.push(a, b, a + 1);
      idxArr.push(b, b + 1, a + 1);
    }
  }

  // ─── Base cap: flat circle at Y=0, normal pointing down ───
  const baseStart = posArr.length / 3;
  // Center vertex
  posArr.push(0, 0, 0);
  normArr.push(0, -1, 0);

  for (let x = 0; x <= widthSegments; x++) {
    const theta = (x / widthSegments) * Math.PI * 2;
    posArr.push(Math.cos(theta) * radius, 0, Math.sin(theta) * radius);
    normArr.push(0, -1, 0);
  }

  for (let x = 0; x < widthSegments; x++) {
    idxArr.push(baseStart, baseStart + 1 + x + 1, baseStart + 1 + x); // reversed winding for bottom face
  }

  return {
    positions: new Float32Array(posArr),
    normals: new Float32Array(normArr),
    indices: new Uint32Array(idxArr),
    vertexCount: posArr.length / 3,
  };
}

/* ------------------------------------------------------------------ */
/*  Wall                                                               */
/* ------------------------------------------------------------------ */

const WALL_EARTH_RADIUS = 6378137;
const WALL_MAX_LAT = 85.051128779806604;

function wallLonToMercX(lon: number): number {
  return (lon * Math.PI * WALL_EARTH_RADIUS) / 180;
}

function wallLatToMercY(lat: number): number {
  const c = Math.max(-WALL_MAX_LAT, Math.min(WALL_MAX_LAT, lat));
  return Math.log(Math.tan(Math.PI / 4 + (c * Math.PI / 180) / 2)) * WALL_EARTH_RADIUS;
}

/**
 * Generate a vertical wall (curtain) from geographic coordinates.
 *
 * CesiumJS-compatible API: takes [lon, lat] positions with per-vertex heights.
 * Output is in EPSG:3857 (Web Mercator) coordinates with Z = altitude in metres,
 * ready for GPU upload via the line/polygon/mesh pipeline.
 *
 * @param positions - Geographic [lon, lat] pairs (EPSG:4326).
 * @param maximumHeights - Per-vertex top height in metres (length must match positions).
 * @param minimumHeights - Per-vertex bottom height in metres (default all zeros).
 */
export function createWallGeometry(
  positions: [number, number][],
  maximumHeights: number[],
  minimumHeights?: number[],
): GeneratedMesh {
  if (positions.length < 2 || maximumHeights.length < positions.length) {
    return { positions: new Float32Array(0), normals: new Float32Array(0), indices: new Uint32Array(0), vertexCount: 0 };
  }

  const mins = minimumHeights ?? new Array(positions.length).fill(0) as number[];
  const posArr: number[] = [];
  const normArr: number[] = [];
  const idxArr: number[] = [];

  for (let i = 0; i < positions.length - 1; i++) {
    const [lon0, lat0] = positions[i]!;
    const [lon1, lat1] = positions[i + 1]!;

    // Convert to Mercator
    const mx0 = wallLonToMercX(lon0), my0 = wallLatToMercY(lat0);
    const mx1 = wallLonToMercX(lon1), my1 = wallLatToMercY(lat1);

    // Normal: perpendicular to wall segment in XY Mercator plane, pointing outward
    const dx = mx1 - mx0;
    const dy = my1 - my0;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    const base = posArr.length / 3;

    // 4 vertices per segment: [mercX, mercY, altitudeZ]
    // bottom-left, bottom-right, top-right, top-left
    posArr.push(mx0, my0, mins[i]!);
    posArr.push(mx1, my1, mins[i + 1]!);
    posArr.push(mx1, my1, maximumHeights[i + 1]!);
    posArr.push(mx0, my0, maximumHeights[i]!);

    // Normal in Mercator XY plane (Z=0 for vertical walls)
    normArr.push(nx, ny, 0);
    normArr.push(nx, ny, 0);
    normArr.push(nx, ny, 0);
    normArr.push(nx, ny, 0);

    idxArr.push(base, base + 1, base + 2);
    idxArr.push(base, base + 2, base + 3);
  }

  return {
    positions: new Float32Array(posArr),
    normals: new Float32Array(normArr),
    indices: new Uint32Array(idxArr),
    vertexCount: posArr.length / 3,
  };
}

/**
 * Incremental wall builder — append points one by one, get updated mesh.
 *
 * Designed for animation: as a vehicle moves, append its position and
 * the wall geometry grows without rebuilding from scratch.
 *
 * Usage:
 * ```ts
 * const builder = new WallGeometryBuilder();
 * builder.append(29.0, 41.0, 500, 0);   // lon, lat, topHeight, bottomHeight
 * builder.append(30.0, 41.0, 600, 0);   // second point → first quad generated
 * builder.append(31.0, 41.5, 700, 0);   // third point → second quad appended
 * const mesh = builder.toMesh();          // ready for GPU upload
 * ```
 */
export class WallGeometryBuilder {
  private _lons: number[] = [];
  private _lats: number[] = [];
  private _maxH: number[] = [];
  private _minH: number[] = [];

  /** Number of points added so far. */
  get length(): number { return this._lons.length; }

  /** Append a new geographic point to the wall. */
  append(lon: number, lat: number, maxHeight: number, minHeight: number = 0): void {
    this._lons.push(lon);
    this._lats.push(lat);
    this._maxH.push(maxHeight);
    this._minH.push(minHeight);
  }

  /** Clear all points. */
  clear(): void {
    this._lons.length = 0;
    this._lats.length = 0;
    this._maxH.length = 0;
    this._minH.length = 0;
  }

  /** Generate the wall mesh from all appended points. */
  toMesh(): GeneratedMesh {
    const positions = this._lons.map((lon, i) => [lon, this._lats[i]!] as [number, number]);
    return createWallGeometry(positions, this._maxH, this._minH);
  }
}

/* ------------------------------------------------------------------ */
/*  Corridor                                                           */
/* ------------------------------------------------------------------ */

/**
 * Generate a corridor (swept path with width) from a polyline.
 *
 * Creates a flat ribbon following the polyline path, offset by half-width
 * on each side. Optionally extruded to a given height.
 *
 * @param positions - Center-line [x, z] pairs (2D path).
 * @param width - Corridor width in meters.
 * @param height - Optional extrusion height (0 = flat ribbon).
 */
export function createCorridorGeometry(
  positions: [number, number][],
  width: number,
  height: number = 0,
): GeneratedMesh {
  if (positions.length < 2) {
    return { positions: new Float32Array(0), normals: new Float32Array(0), indices: new Uint32Array(0), vertexCount: 0 };
  }

  const halfW = width / 2;
  const leftPoints: [number, number][] = [];
  const rightPoints: [number, number][] = [];

  for (let i = 0; i < positions.length; i++) {
    const [x, z] = positions[i]!;

    // Compute perpendicular direction
    let dx: number, dz: number;
    if (i === 0) {
      dx = positions[1]![0] - x;
      dz = positions[1]![1] - z;
    } else if (i === positions.length - 1) {
      dx = x - positions[i - 1]![0];
      dz = z - positions[i - 1]![1];
    } else {
      // Average of incoming and outgoing directions
      dx = positions[i + 1]![0] - positions[i - 1]![0];
      dz = positions[i + 1]![1] - positions[i - 1]![1];
    }

    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    const perpX = -dz / len;
    const perpZ = dx / len;

    leftPoints.push([x + perpX * halfW, z + perpZ * halfW]);
    rightPoints.push([x - perpX * halfW, z - perpZ * halfW]);
  }

  const posArr: number[] = [];
  const normArr: number[] = [];
  const idxArr: number[] = [];

  const y = height;

  // Top surface
  for (let i = 0; i < positions.length; i++) {
    posArr.push(leftPoints[i]![0], y, leftPoints[i]![1]);
    posArr.push(rightPoints[i]![0], y, rightPoints[i]![1]);
    normArr.push(0, 1, 0);
    normArr.push(0, 1, 0);

    if (i < positions.length - 1) {
      const base = i * 2;
      idxArr.push(base, base + 2, base + 1);
      idxArr.push(base + 1, base + 2, base + 3);
    }
  }

  // If extruded, add bottom + sides
  if (height > 0) {
    const topVerts = positions.length * 2;

    // Bottom surface
    for (let i = 0; i < positions.length; i++) {
      posArr.push(leftPoints[i]![0], 0, leftPoints[i]![1]);
      posArr.push(rightPoints[i]![0], 0, rightPoints[i]![1]);
      normArr.push(0, -1, 0);
      normArr.push(0, -1, 0);

      if (i < positions.length - 1) {
        const base = topVerts + i * 2;
        idxArr.push(base, base + 1, base + 2);
        idxArr.push(base + 1, base + 3, base + 2);
      }
    }
  }

  return {
    positions: new Float32Array(posArr),
    normals: new Float32Array(normArr),
    indices: new Uint32Array(idxArr),
    vertexCount: posArr.length / 3,
  };
}
