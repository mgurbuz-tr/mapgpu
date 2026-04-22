/**
 * IncrementalWallBuffer — GPU buffer that grows incrementally as wall segments
 * are appended, avoiding full geometry rebuild.
 *
 * Each wall segment is a vertical quad (4 vertices, 6 indices). New segments
 * are appended via sub-range `writeBuffer` calls, touching only the new data.
 * When the buffer runs out of capacity it doubles in size using a GPU-side copy.
 *
 * Vertex layout matches the Mesh3D pipeline (24 bytes / vertex):
 *   [merc01X: f32, merc01Y: f32, heightZ: f32, normalX: f32, normalY: f32, normalZ: f32]
 */

import type { IRenderEngine, Mesh3DRenderBuffer } from '../interfaces/IRenderEngine.js';
import type { ElevationInfo } from '../interfaces/ILayer.js';

export interface IWallElevationSampler {
  sampleElevation(lon: number, lat: number): number | null;
}

const EARTH_RADIUS = 6378137;
const MAX_LAT = 85.051128779806604;
const HALF_CIRC = 20037508.342789244;

const INITIAL_SEGMENT_CAPACITY = 256;
const GROWTH_FACTOR = 2;

/** GPU buffer usage flags — hardcoded to avoid runtime dependency on GPUBufferUsage global. */
const VERTEX_COPY_DST = 0x0020 | 0x0008; // GPUBufferUsage.VERTEX | COPY_DST
const INDEX_COPY_DST  = 0x0010 | 0x0008; // GPUBufferUsage.INDEX  | COPY_DST

/** Vertices per wall segment (quad). */
const VERTS_PER_SEG = 4;
/** Floats per vertex (pos3 + normal3). */
const FLOATS_PER_VERT = 6;
/** Indices per wall segment (2 triangles). */
const INDICES_PER_SEG = 6;

function lonToMerc01(lon: number): number {
  const mx = (lon * Math.PI * EARTH_RADIUS) / 180;
  return (mx + HALF_CIRC) / (2 * HALF_CIRC);
}

function latToMerc01(lat: number): number {
  const c = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const my = Math.log(Math.tan(Math.PI / 4 + (c * Math.PI / 180) / 2)) * EARTH_RADIUS;
  return 1 - (my + HALF_CIRC) / (2 * HALF_CIRC);
}

export class IncrementalWallBuffer {
  private readonly _engine: IRenderEngine;

  /** CPU-side vertex mirror (merc01 interleaved: pos3+norm3). */
  private _cpuVertices: Float32Array;
  /** CPU-side index mirror. */
  private _cpuIndices: Uint32Array;

  private _vertexBuffer: GPUBuffer;
  private _indexBuffer: GPUBuffer;

  private _segmentCount = 0;
  private _segmentCapacity: number;

  /** Set to true after any append; reset when outline rebuild is triggered. */
  outlineDirty = false;

  constructor(engine: IRenderEngine, initialCapacity: number = INITIAL_SEGMENT_CAPACITY) {
    this._engine = engine;
    this._segmentCapacity = initialCapacity;

    const vertFloats = initialCapacity * VERTS_PER_SEG * FLOATS_PER_VERT;
    const idxCount = initialCapacity * INDICES_PER_SEG;

    this._cpuVertices = new Float32Array(vertFloats);
    this._cpuIndices = new Uint32Array(idxCount);

    // Pre-allocate GPU buffers — VERTEX | COPY_DST for partial writes
    this._vertexBuffer = engine.createBuffer(
      new Float32Array(vertFloats),
      VERTEX_COPY_DST,
    );
    this._indexBuffer = engine.createBuffer(
      new Uint32Array(idxCount),
      INDEX_COPY_DST,
    );
  }

  /** Number of wall segments currently stored. */
  get segmentCount(): number { return this._segmentCount; }

  /** Total vertex count (4 per segment). */
  get vertexCount(): number { return this._segmentCount * VERTS_PER_SEG; }

  /** Total index count (6 per segment). */
  get indexCount(): number { return this._segmentCount * INDICES_PER_SEG; }

  /**
   * Append a single wall segment between two control points.
   *
   * Writes only the new 4 vertices (96 bytes) and 6 indices (24 bytes) to the
   * GPU buffer via sub-range writeBuffer. O(1) per call.
   */
  appendSegment( // NOSONAR
    lon0: number, lat0: number, minH0: number, maxH0: number,
    lon1: number, lat1: number, minH1: number, maxH1: number,
  ): void {
    if (this._segmentCount >= this._segmentCapacity) {
      this._grow();
    }

    const seg = this._segmentCount;
    const vBase = seg * VERTS_PER_SEG;
    const vOff = vBase * FLOATS_PER_VERT;
    const iOff = seg * INDICES_PER_SEG;

    // Convert to Mercator [0..1]
    const mx0 = lonToMerc01(lon0);
    const my0 = latToMerc01(lat0);
    const mx1 = lonToMerc01(lon1);
    const my1 = latToMerc01(lat1);

    // Wall normal: perpendicular to segment in Mercator XY plane
    const dx = mx1 - mx0;
    const dy = my1 - my0;
    const len = Math.hypot(dx, dy) || 1e-10;
    const nx = -dy / len;
    const ny = dx / len;

    // 4 vertices: bottom-left, bottom-right, top-right, top-left
    const v = this._cpuVertices;
    // bottom-left
    v[vOff]     = mx0; v[vOff + 1] = my0; v[vOff + 2] = minH0;
    v[vOff + 3] = nx;  v[vOff + 4] = ny;  v[vOff + 5] = 0;
    // bottom-right
    v[vOff + 6] = mx1; v[vOff + 7] = my1; v[vOff + 8] = minH1;
    v[vOff + 9] = nx;  v[vOff + 10] = ny; v[vOff + 11] = 0;
    // top-right
    v[vOff + 12] = mx1; v[vOff + 13] = my1; v[vOff + 14] = maxH1;
    v[vOff + 15] = nx;  v[vOff + 16] = ny;  v[vOff + 17] = 0;
    // top-left
    v[vOff + 18] = mx0; v[vOff + 19] = my0; v[vOff + 20] = maxH0;
    v[vOff + 21] = nx;  v[vOff + 22] = ny;  v[vOff + 23] = 0;

    // 6 indices: two triangles
    const idx = this._cpuIndices;
    idx[iOff]     = vBase;
    idx[iOff + 1] = vBase + 1;
    idx[iOff + 2] = vBase + 2;
    idx[iOff + 3] = vBase;
    idx[iOff + 4] = vBase + 2;
    idx[iOff + 5] = vBase + 3;

    // GPU sub-range write — only new data
    const vertByteOffset = vOff * 4; // Float32 = 4 bytes
    const vertSlice = new Float32Array(v.buffer, vertByteOffset, VERTS_PER_SEG * FLOATS_PER_VERT);
    this._engine.writeBuffer(this._vertexBuffer, vertByteOffset, vertSlice);

    const idxByteOffset = iOff * 4; // Uint32 = 4 bytes
    const idxSlice = new Uint32Array(idx.buffer, idxByteOffset, INDICES_PER_SEG);
    this._engine.writeBuffer(this._indexBuffer, idxByteOffset, idxSlice);

    this._segmentCount++;
    this.outlineDirty = true;
  }

  /** Reset segment count without deallocating GPU buffers. */
  clear(): void {
    this._segmentCount = 0;
    this.outlineDirty = true;
  }

  /** Get the render buffer for the Mesh3D draw delegate. */
  getRenderBuffer(): Mesh3DRenderBuffer {
    return {
      vertexBuffer: this._vertexBuffer,
      indexBuffer: this._indexBuffer,
      indexCount: this._segmentCount * INDICES_PER_SEG,
    };
  }

  /** Release GPU resources. */
  destroy(): void {
    this._engine.releaseBuffer(this._vertexBuffer);
    this._engine.releaseBuffer(this._indexBuffer);
  }

  /**
   * Rebuild the entire buffer from raw control point arrays.
   * Used after setPositions() or full rebuild scenarios.
   */
  rebuildFromControlPoints( // NOSONAR
    lons: readonly number[],
    lats: readonly number[],
    maxH: readonly number[],
    minH: readonly number[],
    elevationInfo?: ElevationInfo,
    elevationSampler?: IWallElevationSampler,
  ): void {
    const n = lons.length;
    if (n < 2) {
      this.clear();
      return;
    }

    const segCount = n - 1;

    // Ensure capacity
    while (segCount > this._segmentCapacity) {
      this._growCapacity();
    }

    this._segmentCount = 0;

    // Pre-compute terrain offsets if elevation mode is not absolute
    const needsTerrainOffset = elevationInfo &&
      elevationInfo.mode !== 'absolute' && elevationSampler;
    const terrainOffset = needsTerrainOffset
      ? new Float64Array(n)
      : null;

    if (terrainOffset && elevationSampler) {
      const offset = elevationInfo!.offset ?? 0;
      for (let i = 0; i < n; i++) {
        terrainOffset[i] = (elevationSampler.sampleElevation(lons[i]!, lats[i]!) ?? 0) + offset;
      }
    }

    // Build all segments locally, then single bulk upload
    for (let i = 0; i < segCount; i++) {
      const seg = i;
      const vBase = seg * VERTS_PER_SEG;
      const vOff = vBase * FLOATS_PER_VERT;
      const iOff = seg * INDICES_PER_SEG;

      const mx0 = lonToMerc01(lons[i]!);
      const my0 = latToMerc01(lats[i]!);
      const mx1 = lonToMerc01(lons[i + 1]!);
      const my1 = latToMerc01(lats[i + 1]!);

      const dx = mx1 - mx0;
      const dy = my1 - my0;
      const len = Math.hypot(dx, dy) || 1e-10;
      const nx = -dy / len;
      const ny = dx / len;

      // Apply terrain offset: for 'relative-to-ground', add terrain height
      // For 'on-the-ground', ignore feature height and use terrain directly
      let bH0 = minH[i]!;
      let bH1 = minH[i + 1]!;
      let tH0 = maxH[i]!;
      let tH1 = maxH[i + 1]!;

      if (terrainOffset) {
        const t0 = terrainOffset[i]!;
        const t1 = terrainOffset[i + 1]!;
        if (elevationInfo!.mode === 'on-the-ground') {
          bH0 = t0; bH1 = t1;
          tH0 = t0; tH1 = t1;
        } else {
          // relative-to-ground
          bH0 += t0; bH1 += t1;
          tH0 += t0; tH1 += t1;
        }
      }

      const v = this._cpuVertices;
      v[vOff]     = mx0; v[vOff + 1] = my0; v[vOff + 2] = bH0;
      v[vOff + 3] = nx;  v[vOff + 4] = ny;  v[vOff + 5] = 0;
      v[vOff + 6] = mx1; v[vOff + 7] = my1; v[vOff + 8] = bH1;
      v[vOff + 9] = nx;  v[vOff + 10] = ny; v[vOff + 11] = 0;
      v[vOff + 12] = mx1; v[vOff + 13] = my1; v[vOff + 14] = tH1;
      v[vOff + 15] = nx;  v[vOff + 16] = ny;  v[vOff + 17] = 0;
      v[vOff + 18] = mx0; v[vOff + 19] = my0; v[vOff + 20] = tH0;
      v[vOff + 21] = nx;  v[vOff + 22] = ny;  v[vOff + 23] = 0;

      const idx = this._cpuIndices;
      idx[iOff]     = vBase;
      idx[iOff + 1] = vBase + 1;
      idx[iOff + 2] = vBase + 2;
      idx[iOff + 3] = vBase;
      idx[iOff + 4] = vBase + 2;
      idx[iOff + 5] = vBase + 3;
    }

    this._segmentCount = segCount;

    // Bulk upload
    const vertEnd = segCount * VERTS_PER_SEG * FLOATS_PER_VERT;
    this._engine.writeBuffer(this._vertexBuffer, 0, this._cpuVertices.subarray(0, vertEnd));
    const idxEnd = segCount * INDICES_PER_SEG;
    this._engine.writeBuffer(this._indexBuffer, 0, this._cpuIndices.subarray(0, idxEnd));

    // Store terrain version so we can detect when rebuild is needed
    this._lastTerrainVersion = elevationSampler ? Date.now() : -1;

    this.outlineDirty = true;
  }

  /** Stored terrain version to detect when terrain offset rebuild is needed. */
  private _lastTerrainVersion = -1;

  /** Whether terrain offset needs to be reapplied (e.g., terrain data changed). */
  get terrainVersionStale(): boolean { return this._lastTerrainVersion === -1; }

  // ─── Private ───

  /** Double the buffer capacity (CPU arrays only, GPU buffers reallocated). */
  private _grow(): void {
    this._growCapacity();
  }

  private _growCapacity(): void {
    const newCap = this._segmentCapacity * GROWTH_FACTOR;
    const newVertFloats = newCap * VERTS_PER_SEG * FLOATS_PER_VERT;
    const newIdxCount = newCap * INDICES_PER_SEG;

    // Grow CPU arrays
    const newVerts = new Float32Array(newVertFloats);
    newVerts.set(this._cpuVertices);
    this._cpuVertices = newVerts;

    const newIdx = new Uint32Array(newIdxCount);
    newIdx.set(this._cpuIndices);
    this._cpuIndices = newIdx;

    // Recreate GPU buffers at new size and re-upload existing data
    const oldVertBuf = this._vertexBuffer;
    const oldIdxBuf = this._indexBuffer;

    this._vertexBuffer = this._engine.createBuffer(
      new Float32Array(newVertFloats),
      VERTEX_COPY_DST,
    );
    this._indexBuffer = this._engine.createBuffer(
      new Uint32Array(newIdxCount),
      INDEX_COPY_DST,
    );

    // Re-upload existing data
    if (this._segmentCount > 0) {
      const vertEnd = this._segmentCount * VERTS_PER_SEG * FLOATS_PER_VERT;
      this._engine.writeBuffer(this._vertexBuffer, 0, this._cpuVertices.subarray(0, vertEnd));
      const idxEnd = this._segmentCount * INDICES_PER_SEG;
      this._engine.writeBuffer(this._indexBuffer, 0, this._cpuIndices.subarray(0, idxEnd));
    }

    this._engine.releaseBuffer(oldVertBuf);
    this._engine.releaseBuffer(oldIdxBuf);
    this._segmentCapacity = newCap;
  }
}
