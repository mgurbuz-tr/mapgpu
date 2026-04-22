/* tslint:disable */
/* eslint-disable */

/**
 * Binary representation of parsed GeoJSON Point features.
 */
export class BinaryPointBuffer {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Number of parsed features
     */
    readonly feature_count: number;
    /**
     * Feature IDs (sequential, 0-based)
     */
    readonly feature_ids: Uint32Array;
    /**
     * Point positions: [x0, y0, x1, y1, ...]
     */
    readonly positions: Float64Array;
}

/**
 * Result of grid-based point clustering.
 */
export class ClusterResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Cluster assignment for each input point (cluster index)
     */
    readonly assignments: Int32Array;
    /**
     * Cluster centroid positions: [x0, y0, x1, y1, ...]
     */
    readonly centroids: Float64Array;
    /**
     * Number of points in each cluster
     */
    readonly counts: Uint32Array;
}

/**
 * Opaque handle to a grid-based spatial index stored in WASM memory.
 * The index is kept alive as long as this handle exists.
 */
export class GridIndex {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly num_points: number;
}

/**
 * Result of Line-of-Sight computation.
 */
export class LosResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly blocking_point: Float64Array;
    readonly profile: Float64Array;
    readonly visible: boolean;
}

/**
 * Packed binary feature buffer handle.
 */
export class PackedFeatures {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Get the byte length of the packed data
     */
    readonly byte_length: number;
    /**
     * Get the packed binary data
     */
    readonly data: Uint8Array;
}

/**
 * Result of RTC encoding: positions relative to a center point,
 * stored as Float32 for GPU consumption.
 */
export class RtcResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly center: Float64Array;
    readonly positions: Float32Array;
}

/**
 * Result of line tessellation: positions, normals, and UV coordinates
 * for GPU-ready rendering with screen-space width.
 */
export class TessellatedLineResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly indices: Uint32Array;
    readonly normals: Float32Array;
    readonly positions: Float32Array;
    readonly uvs: Float32Array;
}

/**
 * Result of polygon triangulation.
 * `vertices` are the original 2D positions [x0, y0, x1, y1, ...].
 * `indices` are triangle indices into the vertex array (every 3 form a triangle).
 */
export class TriangulateResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly indices: Uint32Array;
    readonly vertices: Float64Array;
}

/**
 * Unpacked feature data.
 */
export class UnpackedFeatures {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly attributes_json: string;
    readonly feature_count: number;
    readonly geometry_type: number;
    readonly offsets: Uint32Array;
    readonly positions: Float64Array;
}

/**
 * Build a grid-based spatial index over 2D points.
 *
 * `points`: flat coordinate array [x0, y0, x1, y1, ...]
 * `cell_size`: size of each grid cell (in the same coordinate units as points)
 *
 * Returns a GridIndex handle that can be queried with `query_grid_index`.
 */
export function build_grid_index(points: Float64Array, cell_size: number): GridIndex;

/**
 * Grid-based point clustering.
 *
 * `points`: flat coordinate array [x0, y0, x1, y1, ...]
 * `radius`: clustering radius in pixels
 * `extent`: map extent [minX, minY, maxX, maxY]
 * `zoom`: current zoom level
 *
 * The algorithm divides the extent into grid cells of size `radius / 2^zoom` and
 * groups points falling into the same cell. The centroid of each cluster
 * is the average position of its member points.
 */
export function cluster_points(points: Float64Array, radius: number, extent: Float64Array, zoom: number): ClusterResult;

/**
 * Compute hillshade from an elevation grid using Horn's method.
 *
 * # Arguments
 * * `elevations` - Row-major elevation grid (Int16 values)
 * * `width` - Grid width (columns)
 * * `height` - Grid height (rows)
 * * `cell_size_x` - Horizontal cell size in meters
 * * `cell_size_y` - Vertical cell size in meters
 * * `azimuth` - Sun azimuth in degrees (clockwise from north)
 * * `altitude` - Sun altitude in degrees above horizon
 *
 * # Returns
 * Luminance array (0-255), same dimensions as input
 */
export function compute_hillshade(elevations: Int16Array, width: number, height: number, cell_size_x: number, cell_size_y: number, azimuth: number, altitude: number): Uint8Array;

/**
 * Compute Line-of-Sight between observer and target using terrain elevations.
 *
 * `segments`: sample points between observer and target [x0,y0,z0, x1,y1,z1, ...]
 * `elevations`: terrain elevation at each sample point [e0, e1, ...]
 * `observer_offset`: additional height above terrain for observer
 * `target_offset`: additional height above terrain for target
 *
 * Returns LosResult with visibility, optional blocking point, and elevation profile.
 */
export function compute_los(segments: Float64Array, elevations: Float64Array, observer_offset: number, target_offset: number): LosResult;

/**
 * Compute Line-of-Sight with earth curvature correction.
 */
export function compute_los_with_curvature(segments: Float64Array, elevations: Float64Array, observer_offset: number, target_offset: number): LosResult;

/**
 * Compute an RGB8 normal map from an elevation grid using Horn's method.
 *
 * # Arguments
 * * `elevations` - Row-major f32 elevation grid
 * * `width`      - Grid width (columns)
 * * `height`     - Grid height (rows)
 * * `cell_size_x` - Horizontal distance between cells (meters)
 * * `cell_size_y` - Vertical distance between cells (meters)
 *
 * # Returns
 * `Vec<u8>` of length `width * height * 3` (RGB8).
 * Normal encoding: `(nx * 127 + 128, ny * 127 + 128, nz * 127 + 128)`
 */
export function compute_normal_map(elevations: Float32Array, width: number, height: number, cell_size_x: number, cell_size_y: number): Uint8Array;

/**
 * Generate evenly spaced sample segments between observer and target
 * observer: [x, y, z], target: [x, y, z]
 * Returns: [x0,y0,z0, x1,y1,z1, ...] (n sample points)
 */
export function generate_los_segments(observer: Float64Array, target: Float64Array, sample_count: number): Float64Array;

/**
 * Generate terrain grid triangle indices (main grid + skirt geometry).
 *
 * # Arguments
 * * `resolution` - Number of cells per side (must match `generate_terrain_vertices`)
 *
 * # Returns
 * Flat `u32` index array for triangle list rendering.
 * - Grid: `resolution^2 * 6` indices (2 triangles per cell)
 * - Skirt: `4 * resolution * 6` indices (2 triangles per skirt segment)
 */
export function generate_terrain_indices(resolution: number): Uint32Array;

/**
 * Generate terrain grid vertices with UV coordinates and skirt geometry.
 *
 * # Arguments
 * * `resolution` - Number of cells per side (e.g. 32 → 33×33 inner vertices)
 *
 * # Returns
 * Flat `f32` array: `[u0, v0, isSkirt0, u1, v1, isSkirt1, ...]`
 * - Grid vertices: `(resolution+1)^2` with `isSkirt = 0.0`
 * - Skirt vertices: `4 * (resolution+1)` with `isSkirt = 1.0`
 */
export function generate_terrain_vertices(resolution: number): Float32Array;

/**
 * Web Mercator (x, y) → WGS84 (lon, lat)
 */
export function mercator_to_wgs84(coords: Float64Array): Float64Array;

/**
 * Pack features into a compact binary buffer (SoA format).
 *
 * `geometry_type`: 1=Point, 2=LineString, 3=Polygon
 * `positions`: flat coordinate array [x0, y0, x1, y1, ...]
 * `offsets`: geometry part boundaries
 * `feature_count`: number of features
 *
 * Returns PackedFeatures containing the binary buffer.
 */
export function pack_features(geometry_type: number, positions: Float64Array, offsets: Uint32Array, feature_count: number): PackedFeatures;

/**
 * Parse a GeoJSON string and extract Point geometries into a binary buffer.
 *
 * Supports:
 * - FeatureCollection with Point features
 * - Single Feature with Point geometry
 * - Bare Point geometry
 *
 * Non-Point geometries are silently skipped.
 *
 * Returns BinaryPointBuffer with positions and feature_ids.
 */
export function parse_geojson_points(json: string): BinaryPointBuffer;

/**
 * Parse Mapbox Vector Tile data and return filtered feature payload as JSON.
 *
 * - `source_layer`: optional layer-name filter
 * - `attribute_whitelist_csv`: optional comma-separated list of attribute names
 */
export function parse_mvt(data: Uint8Array, source_layer?: string | null, attribute_whitelist_csv?: string | null): string;

/**
 * Query the grid index for all points within a bounding box.
 *
 * `index`: the GridIndex handle built with `build_grid_index`
 * `bbox`: [minX, minY, maxX, maxY]
 *
 * Returns a Vec<u32> of point indices that fall within the bbox.
 */
export function query_grid_index(index: GridIndex, bbox: Float64Array): Uint32Array;

/**
 * Reproject dispatcher
 */
export function reproject_points(coords: Float64Array, from_epsg: number, to_epsg: number): Float64Array;

/**
 * Decode RTC positions back to absolute f64 coordinates.
 *
 * `rtc_positions`: Float32Array of relative offsets [dx0, dy0, ...]
 * `center`: the center used during encoding [cx, cy]
 *
 * Returns the reconstructed f64 coordinates.
 */
export function rtc_decode(rtc_positions: Float32Array, center: Float64Array): Float64Array;

/**
 * Encode positions as Relative-to-Center offsets in Float32.
 *
 * Subtracts the center from each coordinate and stores the result as f32.
 * This preserves precision for GPU rendering by keeping values small.
 *
 * `positions`: flat f64 coordinate array [x0, y0, x1, y1, ...]
 * `center`: reference center [cx, cy]
 *
 * Returns RtcResult with f32 offsets and the center used.
 */
export function rtc_encode(positions: Float64Array, center: Float64Array): RtcResult;

/**
 * Tessellate polylines into GPU-ready triangle geometry.
 *
 * `positions`: flat coordinate array [x0, y0, x1, y1, ...]
 * `offsets`: vertex-count offsets for multi-line boundaries [0, n1, n1+n2, ...]
 *   If empty, the entire positions array is treated as a single line.
 * `line_width`: desired line width in coordinate units
 *
 * Returns TessellatedLineResult with vertex positions, extrusion normals, UVs, and indices.
 */
export function tessellate_lines(positions: Float64Array, offsets: Uint32Array, line_width: number): TessellatedLineResult;

/**
 * Triangulate a 2D polygon using the earcut algorithm.
 *
 * `vertices`: flat coordinate array [x0, y0, x1, y1, ...]
 * `hole_indices`: indices into the vertex array (vertex index, not coord index)
 *   where each hole ring starts. Empty slice means no holes.
 *
 * Returns TriangulateResult with the original vertices and computed triangle indices.
 */
export function triangulate(vertices: Float64Array, hole_indices: Uint32Array): TriangulateResult;

/**
 * Unpack a binary feature buffer back into component arrays.
 *
 * Returns UnpackedFeatures with geometry_type, positions, offsets, feature_count, and attributes.
 */
export function unpack_features(data: Uint8Array): UnpackedFeatures;

/**
 * WGS84 (lon, lat) → Web Mercator (x, y)
 * Input: interleaved [lon0, lat0, lon1, lat1, ...]
 */
export function wgs84_to_mercator(coords: Float64Array): Float64Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly parse_mvt: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
    readonly __wbg_clusterresult_free: (a: number, b: number) => void;
    readonly cluster_points: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
    readonly clusterresult_assignments: (a: number) => [number, number];
    readonly clusterresult_centroids: (a: number) => [number, number];
    readonly clusterresult_counts: (a: number) => [number, number];
    readonly __wbg_binarypointbuffer_free: (a: number, b: number) => void;
    readonly binarypointbuffer_feature_count: (a: number) => number;
    readonly binarypointbuffer_feature_ids: (a: number) => [number, number];
    readonly binarypointbuffer_positions: (a: number) => [number, number];
    readonly parse_geojson_points: (a: number, b: number) => [number, number, number];
    readonly __wbg_losresult_free: (a: number, b: number) => void;
    readonly __wbg_tessellatedlineresult_free: (a: number, b: number) => void;
    readonly compute_los: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
    readonly compute_los_with_curvature: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
    readonly generate_los_segments: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly losresult_blocking_point: (a: number) => [number, number];
    readonly losresult_profile: (a: number) => [number, number];
    readonly losresult_visible: (a: number) => number;
    readonly mercator_to_wgs84: (a: number, b: number) => [number, number];
    readonly reproject_points: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly tessellate_lines: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly tessellatedlineresult_indices: (a: number) => [number, number];
    readonly tessellatedlineresult_normals: (a: number) => [number, number];
    readonly tessellatedlineresult_positions: (a: number) => [number, number];
    readonly tessellatedlineresult_uvs: (a: number) => [number, number];
    readonly wgs84_to_mercator: (a: number, b: number) => [number, number];
    readonly __wbg_rtcresult_free: (a: number, b: number) => void;
    readonly __wbg_triangulateresult_free: (a: number, b: number) => void;
    readonly rtc_decode: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly rtc_encode: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly rtcresult_center: (a: number) => [number, number];
    readonly rtcresult_positions: (a: number) => [number, number];
    readonly triangulate: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly triangulateresult_indices: (a: number) => [number, number];
    readonly triangulateresult_vertices: (a: number) => [number, number];
    readonly __wbg_gridindex_free: (a: number, b: number) => void;
    readonly build_grid_index: (a: number, b: number, c: number) => [number, number, number];
    readonly compute_hillshade: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number];
    readonly compute_normal_map: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly generate_terrain_indices: (a: number) => [number, number];
    readonly generate_terrain_vertices: (a: number) => [number, number];
    readonly gridindex_num_points: (a: number) => number;
    readonly query_grid_index: (a: number, b: number, c: number) => [number, number, number, number];
    readonly __wbg_packedfeatures_free: (a: number, b: number) => void;
    readonly __wbg_unpackedfeatures_free: (a: number, b: number) => void;
    readonly pack_features: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
    readonly packedfeatures_byte_length: (a: number) => number;
    readonly packedfeatures_data: (a: number) => [number, number];
    readonly unpack_features: (a: number, b: number) => [number, number, number];
    readonly unpackedfeatures_attributes_json: (a: number) => [number, number];
    readonly unpackedfeatures_feature_count: (a: number) => number;
    readonly unpackedfeatures_geometry_type: (a: number) => number;
    readonly unpackedfeatures_offsets: (a: number) => [number, number];
    readonly unpackedfeatures_positions: (a: number) => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
