/* @ts-self-types="./mapgpu_wasm_core.d.ts" */

/**
 * Binary representation of parsed GeoJSON Point features.
 */
export class BinaryPointBuffer {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(BinaryPointBuffer.prototype);
        obj.__wbg_ptr = ptr;
        BinaryPointBufferFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BinaryPointBufferFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_binarypointbuffer_free(ptr, 0);
    }
    /**
     * Number of parsed features
     * @returns {number}
     */
    get feature_count() {
        const ret = wasm.binarypointbuffer_feature_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Feature IDs (sequential, 0-based)
     * @returns {Uint32Array}
     */
    get feature_ids() {
        const ret = wasm.binarypointbuffer_feature_ids(this.__wbg_ptr);
        var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * Point positions: [x0, y0, x1, y1, ...]
     * @returns {Float64Array}
     */
    get positions() {
        const ret = wasm.binarypointbuffer_positions(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
}
if (Symbol.dispose) BinaryPointBuffer.prototype[Symbol.dispose] = BinaryPointBuffer.prototype.free;

/**
 * Result of grid-based point clustering.
 */
export class ClusterResult {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(ClusterResult.prototype);
        obj.__wbg_ptr = ptr;
        ClusterResultFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ClusterResultFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_clusterresult_free(ptr, 0);
    }
    /**
     * Cluster assignment for each input point (cluster index)
     * @returns {Int32Array}
     */
    get assignments() {
        const ret = wasm.clusterresult_assignments(this.__wbg_ptr);
        var v1 = getArrayI32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * Cluster centroid positions: [x0, y0, x1, y1, ...]
     * @returns {Float64Array}
     */
    get centroids() {
        const ret = wasm.clusterresult_centroids(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * Number of points in each cluster
     * @returns {Uint32Array}
     */
    get counts() {
        const ret = wasm.clusterresult_counts(this.__wbg_ptr);
        var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
}
if (Symbol.dispose) ClusterResult.prototype[Symbol.dispose] = ClusterResult.prototype.free;

/**
 * Opaque handle to a grid-based spatial index stored in WASM memory.
 * The index is kept alive as long as this handle exists.
 */
export class GridIndex {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(GridIndex.prototype);
        obj.__wbg_ptr = ptr;
        GridIndexFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        GridIndexFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_gridindex_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get num_points() {
        const ret = wasm.gridindex_num_points(this.__wbg_ptr);
        return ret >>> 0;
    }
}
if (Symbol.dispose) GridIndex.prototype[Symbol.dispose] = GridIndex.prototype.free;

/**
 * Result of Line-of-Sight computation.
 */
export class LosResult {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(LosResult.prototype);
        obj.__wbg_ptr = ptr;
        LosResultFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        LosResultFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_losresult_free(ptr, 0);
    }
    /**
     * @returns {Float64Array}
     */
    get blocking_point() {
        const ret = wasm.losresult_blocking_point(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * @returns {Float64Array}
     */
    get profile() {
        const ret = wasm.losresult_profile(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * @returns {boolean}
     */
    get visible() {
        const ret = wasm.losresult_visible(this.__wbg_ptr);
        return ret !== 0;
    }
}
if (Symbol.dispose) LosResult.prototype[Symbol.dispose] = LosResult.prototype.free;

/**
 * Packed binary feature buffer handle.
 */
export class PackedFeatures {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(PackedFeatures.prototype);
        obj.__wbg_ptr = ptr;
        PackedFeaturesFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PackedFeaturesFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_packedfeatures_free(ptr, 0);
    }
    /**
     * Get the byte length of the packed data
     * @returns {number}
     */
    get byte_length() {
        const ret = wasm.packedfeatures_byte_length(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Get the packed binary data
     * @returns {Uint8Array}
     */
    get data() {
        const ret = wasm.packedfeatures_data(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
}
if (Symbol.dispose) PackedFeatures.prototype[Symbol.dispose] = PackedFeatures.prototype.free;

/**
 * Result of RTC encoding: positions relative to a center point,
 * stored as Float32 for GPU consumption.
 */
export class RtcResult {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(RtcResult.prototype);
        obj.__wbg_ptr = ptr;
        RtcResultFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        RtcResultFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_rtcresult_free(ptr, 0);
    }
    /**
     * @returns {Float64Array}
     */
    get center() {
        const ret = wasm.rtcresult_center(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * @returns {Float32Array}
     */
    get positions() {
        const ret = wasm.rtcresult_positions(this.__wbg_ptr);
        var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
}
if (Symbol.dispose) RtcResult.prototype[Symbol.dispose] = RtcResult.prototype.free;

/**
 * Result of line tessellation: positions, normals, and UV coordinates
 * for GPU-ready rendering with screen-space width.
 */
export class TessellatedLineResult {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(TessellatedLineResult.prototype);
        obj.__wbg_ptr = ptr;
        TessellatedLineResultFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        TessellatedLineResultFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_tessellatedlineresult_free(ptr, 0);
    }
    /**
     * @returns {Uint32Array}
     */
    get indices() {
        const ret = wasm.tessellatedlineresult_indices(this.__wbg_ptr);
        var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @returns {Float32Array}
     */
    get normals() {
        const ret = wasm.tessellatedlineresult_normals(this.__wbg_ptr);
        var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @returns {Float32Array}
     */
    get positions() {
        const ret = wasm.tessellatedlineresult_positions(this.__wbg_ptr);
        var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @returns {Float32Array}
     */
    get uvs() {
        const ret = wasm.tessellatedlineresult_uvs(this.__wbg_ptr);
        var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
}
if (Symbol.dispose) TessellatedLineResult.prototype[Symbol.dispose] = TessellatedLineResult.prototype.free;

/**
 * Result of polygon triangulation.
 * `vertices` are the original 2D positions [x0, y0, x1, y1, ...].
 * `indices` are triangle indices into the vertex array (every 3 form a triangle).
 */
export class TriangulateResult {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(TriangulateResult.prototype);
        obj.__wbg_ptr = ptr;
        TriangulateResultFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        TriangulateResultFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_triangulateresult_free(ptr, 0);
    }
    /**
     * @returns {Uint32Array}
     */
    get indices() {
        const ret = wasm.triangulateresult_indices(this.__wbg_ptr);
        var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @returns {Float64Array}
     */
    get vertices() {
        const ret = wasm.triangulateresult_vertices(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
}
if (Symbol.dispose) TriangulateResult.prototype[Symbol.dispose] = TriangulateResult.prototype.free;

/**
 * Unpacked feature data.
 */
export class UnpackedFeatures {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(UnpackedFeatures.prototype);
        obj.__wbg_ptr = ptr;
        UnpackedFeaturesFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        UnpackedFeaturesFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_unpackedfeatures_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    get attributes_json() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.unpackedfeatures_attributes_json(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {number}
     */
    get feature_count() {
        const ret = wasm.unpackedfeatures_feature_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get geometry_type() {
        const ret = wasm.unpackedfeatures_geometry_type(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {Uint32Array}
     */
    get offsets() {
        const ret = wasm.unpackedfeatures_offsets(this.__wbg_ptr);
        var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @returns {Float64Array}
     */
    get positions() {
        const ret = wasm.unpackedfeatures_positions(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
}
if (Symbol.dispose) UnpackedFeatures.prototype[Symbol.dispose] = UnpackedFeatures.prototype.free;

/**
 * Build a grid-based spatial index over 2D points.
 *
 * `points`: flat coordinate array [x0, y0, x1, y1, ...]
 * `cell_size`: size of each grid cell (in the same coordinate units as points)
 *
 * Returns a GridIndex handle that can be queried with `query_grid_index`.
 * @param {Float64Array} points
 * @param {number} cell_size
 * @returns {GridIndex}
 */
export function build_grid_index(points, cell_size) {
    const ptr0 = passArrayF64ToWasm0(points, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.build_grid_index(ptr0, len0, cell_size);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return GridIndex.__wrap(ret[0]);
}

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
 * @param {Float64Array} points
 * @param {number} radius
 * @param {Float64Array} extent
 * @param {number} zoom
 * @returns {ClusterResult}
 */
export function cluster_points(points, radius, extent, zoom) {
    const ptr0 = passArrayF64ToWasm0(points, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(extent, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.cluster_points(ptr0, len0, radius, ptr1, len1, zoom);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return ClusterResult.__wrap(ret[0]);
}

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
 * @param {Int16Array} elevations
 * @param {number} width
 * @param {number} height
 * @param {number} cell_size_x
 * @param {number} cell_size_y
 * @param {number} azimuth
 * @param {number} altitude
 * @returns {Uint8Array}
 */
export function compute_hillshade(elevations, width, height, cell_size_x, cell_size_y, azimuth, altitude) {
    const ptr0 = passArray16ToWasm0(elevations, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.compute_hillshade(ptr0, len0, width, height, cell_size_x, cell_size_y, azimuth, altitude);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Compute Line-of-Sight between observer and target using terrain elevations.
 *
 * `segments`: sample points between observer and target [x0,y0,z0, x1,y1,z1, ...]
 * `elevations`: terrain elevation at each sample point [e0, e1, ...]
 * `observer_offset`: additional height above terrain for observer
 * `target_offset`: additional height above terrain for target
 *
 * Returns LosResult with visibility, optional blocking point, and elevation profile.
 * @param {Float64Array} segments
 * @param {Float64Array} elevations
 * @param {number} observer_offset
 * @param {number} target_offset
 * @returns {LosResult}
 */
export function compute_los(segments, elevations, observer_offset, target_offset) {
    const ptr0 = passArrayF64ToWasm0(segments, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(elevations, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.compute_los(ptr0, len0, ptr1, len1, observer_offset, target_offset);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return LosResult.__wrap(ret[0]);
}

/**
 * Compute Line-of-Sight with earth curvature correction.
 * @param {Float64Array} segments
 * @param {Float64Array} elevations
 * @param {number} observer_offset
 * @param {number} target_offset
 * @returns {LosResult}
 */
export function compute_los_with_curvature(segments, elevations, observer_offset, target_offset) {
    const ptr0 = passArrayF64ToWasm0(segments, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(elevations, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.compute_los_with_curvature(ptr0, len0, ptr1, len1, observer_offset, target_offset);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return LosResult.__wrap(ret[0]);
}

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
 * @param {Float32Array} elevations
 * @param {number} width
 * @param {number} height
 * @param {number} cell_size_x
 * @param {number} cell_size_y
 * @returns {Uint8Array}
 */
export function compute_normal_map(elevations, width, height, cell_size_x, cell_size_y) {
    const ptr0 = passArrayF32ToWasm0(elevations, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.compute_normal_map(ptr0, len0, width, height, cell_size_x, cell_size_y);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Generate evenly spaced sample segments between observer and target
 * observer: [x, y, z], target: [x, y, z]
 * Returns: [x0,y0,z0, x1,y1,z1, ...] (n sample points)
 * @param {Float64Array} observer
 * @param {Float64Array} target
 * @param {number} sample_count
 * @returns {Float64Array}
 */
export function generate_los_segments(observer, target, sample_count) {
    const ptr0 = passArrayF64ToWasm0(observer, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(target, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.generate_los_segments(ptr0, len0, ptr1, len1, sample_count);
    var v3 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v3;
}

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
 * @param {number} resolution
 * @returns {Uint32Array}
 */
export function generate_terrain_indices(resolution) {
    const ret = wasm.generate_terrain_indices(resolution);
    var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
}

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
 * @param {number} resolution
 * @returns {Float32Array}
 */
export function generate_terrain_vertices(resolution) {
    const ret = wasm.generate_terrain_vertices(resolution);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
}

/**
 * Web Mercator (x, y) → WGS84 (lon, lat)
 * @param {Float64Array} coords
 * @returns {Float64Array}
 */
export function mercator_to_wgs84(coords) {
    const ptr0 = passArrayF64ToWasm0(coords, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.mercator_to_wgs84(ptr0, len0);
    var v2 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v2;
}

/**
 * Pack features into a compact binary buffer (SoA format).
 *
 * `geometry_type`: 1=Point, 2=LineString, 3=Polygon
 * `positions`: flat coordinate array [x0, y0, x1, y1, ...]
 * `offsets`: geometry part boundaries
 * `feature_count`: number of features
 *
 * Returns PackedFeatures containing the binary buffer.
 * @param {number} geometry_type
 * @param {Float64Array} positions
 * @param {Uint32Array} offsets
 * @param {number} feature_count
 * @returns {PackedFeatures}
 */
export function pack_features(geometry_type, positions, offsets, feature_count) {
    const ptr0 = passArrayF64ToWasm0(positions, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray32ToWasm0(offsets, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.pack_features(geometry_type, ptr0, len0, ptr1, len1, feature_count);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return PackedFeatures.__wrap(ret[0]);
}

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
 * @param {string} json
 * @returns {BinaryPointBuffer}
 */
export function parse_geojson_points(json) {
    const ptr0 = passStringToWasm0(json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.parse_geojson_points(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return BinaryPointBuffer.__wrap(ret[0]);
}

/**
 * Parse Mapbox Vector Tile data and return filtered feature payload as JSON.
 *
 * - `source_layer`: optional layer-name filter
 * - `attribute_whitelist_csv`: optional comma-separated list of attribute names
 * @param {Uint8Array} data
 * @param {string | null} [source_layer]
 * @param {string | null} [attribute_whitelist_csv]
 * @returns {string}
 */
export function parse_mvt(data, source_layer, attribute_whitelist_csv) {
    let deferred5_0;
    let deferred5_1;
    try {
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        var ptr1 = isLikeNone(source_layer) ? 0 : passStringToWasm0(source_layer, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len1 = WASM_VECTOR_LEN;
        var ptr2 = isLikeNone(attribute_whitelist_csv) ? 0 : passStringToWasm0(attribute_whitelist_csv, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len2 = WASM_VECTOR_LEN;
        const ret = wasm.parse_mvt(ptr0, len0, ptr1, len1, ptr2, len2);
        var ptr4 = ret[0];
        var len4 = ret[1];
        if (ret[3]) {
            ptr4 = 0; len4 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred5_0 = ptr4;
        deferred5_1 = len4;
        return getStringFromWasm0(ptr4, len4);
    } finally {
        wasm.__wbindgen_free(deferred5_0, deferred5_1, 1);
    }
}

/**
 * Query the grid index for all points within a bounding box.
 *
 * `index`: the GridIndex handle built with `build_grid_index`
 * `bbox`: [minX, minY, maxX, maxY]
 *
 * Returns a Vec<u32> of point indices that fall within the bbox.
 * @param {GridIndex} index
 * @param {Float64Array} bbox
 * @returns {Uint32Array}
 */
export function query_grid_index(index, bbox) {
    _assertClass(index, GridIndex);
    const ptr0 = passArrayF64ToWasm0(bbox, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.query_grid_index(index.__wbg_ptr, ptr0, len0);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v2;
}

/**
 * Reproject dispatcher
 * @param {Float64Array} coords
 * @param {number} from_epsg
 * @param {number} to_epsg
 * @returns {Float64Array}
 */
export function reproject_points(coords, from_epsg, to_epsg) {
    const ptr0 = passArrayF64ToWasm0(coords, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.reproject_points(ptr0, len0, from_epsg, to_epsg);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v2;
}

/**
 * Decode RTC positions back to absolute f64 coordinates.
 *
 * `rtc_positions`: Float32Array of relative offsets [dx0, dy0, ...]
 * `center`: the center used during encoding [cx, cy]
 *
 * Returns the reconstructed f64 coordinates.
 * @param {Float32Array} rtc_positions
 * @param {Float64Array} center
 * @returns {Float64Array}
 */
export function rtc_decode(rtc_positions, center) {
    const ptr0 = passArrayF32ToWasm0(rtc_positions, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(center, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.rtc_decode(ptr0, len0, ptr1, len1);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v3 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v3;
}

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
 * @param {Float64Array} positions
 * @param {Float64Array} center
 * @returns {RtcResult}
 */
export function rtc_encode(positions, center) {
    const ptr0 = passArrayF64ToWasm0(positions, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(center, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.rtc_encode(ptr0, len0, ptr1, len1);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return RtcResult.__wrap(ret[0]);
}

/**
 * Tessellate polylines into GPU-ready triangle geometry.
 *
 * `positions`: flat coordinate array [x0, y0, x1, y1, ...]
 * `offsets`: vertex-count offsets for multi-line boundaries [0, n1, n1+n2, ...]
 *   If empty, the entire positions array is treated as a single line.
 * `line_width`: desired line width in coordinate units
 *
 * Returns TessellatedLineResult with vertex positions, extrusion normals, UVs, and indices.
 * @param {Float64Array} positions
 * @param {Uint32Array} offsets
 * @param {number} line_width
 * @returns {TessellatedLineResult}
 */
export function tessellate_lines(positions, offsets, line_width) {
    const ptr0 = passArrayF64ToWasm0(positions, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray32ToWasm0(offsets, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.tessellate_lines(ptr0, len0, ptr1, len1, line_width);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return TessellatedLineResult.__wrap(ret[0]);
}

/**
 * Triangulate a 2D polygon using the earcut algorithm.
 *
 * `vertices`: flat coordinate array [x0, y0, x1, y1, ...]
 * `hole_indices`: indices into the vertex array (vertex index, not coord index)
 *   where each hole ring starts. Empty slice means no holes.
 *
 * Returns TriangulateResult with the original vertices and computed triangle indices.
 * @param {Float64Array} vertices
 * @param {Uint32Array} hole_indices
 * @returns {TriangulateResult}
 */
export function triangulate(vertices, hole_indices) {
    const ptr0 = passArrayF64ToWasm0(vertices, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray32ToWasm0(hole_indices, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.triangulate(ptr0, len0, ptr1, len1);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return TriangulateResult.__wrap(ret[0]);
}

/**
 * Unpack a binary feature buffer back into component arrays.
 *
 * Returns UnpackedFeatures with geometry_type, positions, offsets, feature_count, and attributes.
 * @param {Uint8Array} data
 * @returns {UnpackedFeatures}
 */
export function unpack_features(data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.unpack_features(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return UnpackedFeatures.__wrap(ret[0]);
}

/**
 * WGS84 (lon, lat) → Web Mercator (x, y)
 * Input: interleaved [lon0, lat0, lon1, lat1, ...]
 * @param {Float64Array} coords
 * @returns {Float64Array}
 */
export function wgs84_to_mercator(coords) {
    const ptr0 = passArrayF64ToWasm0(coords, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.wgs84_to_mercator(ptr0, len0);
    var v2 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v2;
}

function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_throw_6ddd609b62940d55: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbindgen_cast_0000000000000001: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./mapgpu_wasm_core_bg.js": import0,
    };
}

const BinaryPointBufferFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_binarypointbuffer_free(ptr >>> 0, 1));
const ClusterResultFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_clusterresult_free(ptr >>> 0, 1));
const GridIndexFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_gridindex_free(ptr >>> 0, 1));
const LosResultFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_losresult_free(ptr >>> 0, 1));
const PackedFeaturesFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_packedfeatures_free(ptr >>> 0, 1));
const RtcResultFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_rtcresult_free(ptr >>> 0, 1));
const TessellatedLineResultFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_tessellatedlineresult_free(ptr >>> 0, 1));
const TriangulateResultFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_triangulateresult_free(ptr >>> 0, 1));
const UnpackedFeaturesFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_unpackedfeatures_free(ptr >>> 0, 1));

function _assertClass(instance, klass) {
    if (!(instance instanceof klass)) {
        throw new Error(`expected instance of ${klass.name}`);
    }
}

function getArrayF32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayF64FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat64ArrayMemory0().subarray(ptr / 8, ptr / 8 + len);
}

function getArrayI32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getInt32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayU32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

let cachedFloat64ArrayMemory0 = null;
function getFloat64ArrayMemory0() {
    if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
        cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64ArrayMemory0;
}

let cachedInt32ArrayMemory0 = null;
function getInt32ArrayMemory0() {
    if (cachedInt32ArrayMemory0 === null || cachedInt32ArrayMemory0.byteLength === 0) {
        cachedInt32ArrayMemory0 = new Int32Array(wasm.memory.buffer);
    }
    return cachedInt32ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint16ArrayMemory0 = null;
function getUint16ArrayMemory0() {
    if (cachedUint16ArrayMemory0 === null || cachedUint16ArrayMemory0.byteLength === 0) {
        cachedUint16ArrayMemory0 = new Uint16Array(wasm.memory.buffer);
    }
    return cachedUint16ArrayMemory0;
}

let cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArray16ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 2, 2) >>> 0;
    getUint16ArrayMemory0().set(arg, ptr / 2);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArray32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getUint32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayF32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getFloat32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayF64ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 8, 8) >>> 0;
    getFloat64ArrayMemory0().set(arg, ptr / 8);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasm;
function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    wasmModule = module;
    cachedFloat32ArrayMemory0 = null;
    cachedFloat64ArrayMemory0 = null;
    cachedInt32ArrayMemory0 = null;
    cachedUint16ArrayMemory0 = null;
    cachedUint32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('mapgpu_wasm_core_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
