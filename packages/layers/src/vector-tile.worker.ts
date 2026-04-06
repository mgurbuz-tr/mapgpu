import {
  GeometryConverter,
  earcut,
  type ExtrudedPolygonSymbol,
  type Feature,
  type LineSymbol,
  type ModelSymbol,
  type PointSymbol,
  type PolygonSymbol,
  type SerializableRendererSnapshot,
  type VectorRenderableSymbol,
  type VectorTileBinaryPayload,
  type VectorTileWorkerFeature,
  type VectorTileWorkerRequest,
  type VectorTileWorkerResponse,
} from '@mapgpu/core';
import { parseMvtTile } from './mvt-parser.js';
import {
  collectVectorTilePayloadTransferables,
  VECTOR_TILE_WORKER_TASK,
} from './vector-tile-worker-protocol.js';

interface WorkerPoolRequest {
  id: number;
  type: string;
  data: VectorTileWorkerRequest;
}

interface WorkerPoolResponse {
  id: number;
  result?: VectorTileWorkerResponse;
  error?: string;
}

interface WorkerGlobalScopeLike {
  onmessage: ((event: MessageEvent<WorkerPoolRequest>) => void) | null;
  postMessage(message: WorkerPoolResponse, transfer?: Transferable[]): void;
}

type WasmTriangulateResult = {
  indices?: unknown;
  free?: () => void;
};

type WasmTriangulateFn = (
  vertices: Float64Array,
  holeIndices: Uint32Array,
) => WasmTriangulateResult;

let wasmInitPromise: Promise<void> | null = null;
let wasmTriangulateFn: WasmTriangulateFn | null = null;

const worker = globalThis as unknown as WorkerGlobalScopeLike;

worker.onmessage = (event) => {
  void handleMessage(event.data);
};

async function handleMessage(message: WorkerPoolRequest): Promise<void> {
  if (message.type !== VECTOR_TILE_WORKER_TASK) {
    return;
  }

  try {
    const response = await parseAndBuild(message.data);
    const transferables = collectVectorTilePayloadTransferables(response.binaryPayload);
    worker.postMessage({ id: message.id, result: response }, transferables);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    worker.postMessage({ id: message.id, error: errorMessage });
  }
}

async function parseAndBuild(
  request: VectorTileWorkerRequest,
): Promise<VectorTileWorkerResponse> {
  if (request.includeBinaryPayload) {
    await ensureWasmCore();
  }

  const parsed = parseMvtTile(
    request.data,
    request.z,
    request.x,
    request.y,
    request.sourceLayer,
  );

  let binaryPayload: VectorTileBinaryPayload | null = null;
  let usedWasm = false;

  if (request.includeBinaryPayload && request.rendererSnapshot) {
    const built = buildBinaryPayload(
      parsed.features,
      request.rendererSnapshot,
      request.zoom,
      request.minScreenAreaPx,
      wasmTriangulateFn,
    );
    binaryPayload = built.payload;
    usedWasm = built.usedWasm;
  }

  return {
    key: request.key,
    z: request.z,
    x: request.x,
    y: request.y,
    sourceLayer: request.sourceLayer,
    features: parsed.features,
    binaryPayload,
    pipeline: usedWasm ? 'worker-wasm' : 'worker-js',
  };
}

async function ensureWasmCore(): Promise<void> {
  if (wasmInitPromise) {
    await wasmInitPromise;
    return;
  }

  wasmInitPromise = Promise.resolve().then(async () => {
    try {
      const moduleName = '@mapgpu/wasm-core';
      const wasm: unknown = await import(/* @vite-ignore */ moduleName);
      const exports = wasm as {
        default?: unknown;
        triangulate?: unknown;
      };

      if (typeof exports.default === 'function') {
        await (exports.default as () => Promise<unknown> | void)();
      }

      if (typeof exports.triangulate === 'function') {
        wasmTriangulateFn = exports.triangulate as WasmTriangulateFn;
      }
    } catch {
      wasmTriangulateFn = null;
    }
  });

  await wasmInitPromise;
}

interface GroupBucket<S extends VectorRenderableSymbol> {
  key: string;
  symbol: S;
  features: VectorTileWorkerFeature[];
}

function buildBinaryPayload(
  features: VectorTileWorkerFeature[],
  rendererSnapshot: SerializableRendererSnapshot,
  zoom: number | undefined,
  minScreenAreaPx: number | undefined,
  triangulateFn: WasmTriangulateFn | null,
): { payload: VectorTileBinaryPayload | null; usedWasm: boolean } {
  const pointGroups = new Map<string, GroupBucket<PointSymbol>>();
  const lineGroups = new Map<string, GroupBucket<LineSymbol>>();
  const polygonGroups = new Map<string, GroupBucket<PolygonSymbol>>();
  const modelGroups = new Map<string, GroupBucket<ModelSymbol>>();
  const extrusionGroups = new Map<string, GroupBucket<ExtrudedPolygonSymbol>>();

  const minAreaPx = minScreenAreaPx ?? 0;

  for (const feature of features) {
    const geomType = feature.geometry?.type;
    if (!geomType) continue;

    const resolved = resolveSymbol(rendererSnapshot, feature);
    if (!resolved) continue;

    if (isExtrusionSymbol(resolved) && isPolygonGeometry(geomType)) {
      if (minAreaPx > 0 && shouldCullExtrusionFeature(feature, zoom, minAreaPx)) {
        continue;
      }
      addToGroup(extrusionGroups, resolved, feature);
      continue;
    }

    if (isModelSymbol(resolved) && isPointGeometry(geomType)) {
      addToGroup(modelGroups, resolved, feature);
      continue;
    }

    if (isPointGeometry(geomType)) {
      const pointSymbol = isPointSymbol(resolved)
        ? resolved
        : derivePointSymbol(resolved);
      addToGroup(pointGroups, pointSymbol, feature);
      continue;
    }

    if (isLineGeometry(geomType)) {
      const lineSymbol = isLineSymbol(resolved)
        ? resolved
        : deriveLineSymbol(resolved);
      addToGroup(lineGroups, lineSymbol, feature);
      continue;
    }

    if (isPolygonGeometry(geomType)) {
      const polygonSymbol = isPolygonSymbol(resolved)
        ? resolved
        : derivePolygonSymbol(resolved);
      addToGroup(polygonGroups, polygonSymbol, feature);
      addToGroup(lineGroups, outlineSymbolFromFill(polygonSymbol), feature);
    }
  }

  const payload: VectorTileBinaryPayload = {
    pointGroups: [],
    lineGroups: [],
    polygonGroups: [],
    modelGroups: [],
    extrusionGroups: [],
  };

  for (const group of pointGroups.values()) {
    const data = GeometryConverter.pointsFromFeatures(group.features as unknown as Feature[]);
    if (!data || data.count === 0) continue;
    payload.pointGroups.push({
      key: group.key,
      symbol: group.symbol,
      vertices: data.vertices,
      count: data.count,
    });
  }

  for (const group of lineGroups.values()) {
    const data = GeometryConverter.linesFromFeatures(group.features as unknown as Feature[]);
    if (!data || data.indexCount === 0) continue;
    payload.lineGroups.push({
      key: group.key,
      symbol: group.symbol,
      vertices: data.vertices,
      indices: data.indices,
      indexCount: data.indexCount,
    });
  }

  for (const group of polygonGroups.values()) {
    const data = GeometryConverter.polygonsFromFeatures(group.features as unknown as Feature[]);
    if (!data || data.indexCount === 0) continue;
    payload.polygonGroups.push({
      key: group.key,
      symbol: group.symbol,
      vertices: data.vertices,
      indices: data.indices,
      indexCount: data.indexCount,
    });
  }

  for (const group of modelGroups.values()) {
    const data = GeometryConverter.modelInstancesFromFeatures(
      group.features as unknown as Feature[],
      group.symbol.scale ?? 1,
      group.symbol.heading,
      group.symbol.pitch,
      group.symbol.roll,
      group.symbol.anchorZ ?? 0,
    );
    if (!data || data.count === 0) continue;
    payload.modelGroups.push({
      key: group.key,
      symbol: group.symbol,
      instances: data.instances,
      count: data.count,
    });
  }

  let usedWasm = false;
  for (const group of extrusionGroups.values()) {
    const built = extrudeProjectedFeatures(
      group.features,
      group.symbol.heightField,
      group.symbol.minHeightField ?? 'render_min_height',
      triangulateFn,
    );
    if (!built.data || built.data.indexCount === 0) continue;
    payload.extrusionGroups.push({
      key: group.key,
      symbol: group.symbol,
      vertices: built.data.vertices,
      indices: built.data.indices,
      indexCount: built.data.indexCount,
    });
    usedWasm = usedWasm || built.usedWasm;
  }

  if (
    payload.pointGroups.length === 0
    && payload.lineGroups.length === 0
    && payload.polygonGroups.length === 0
    && payload.modelGroups.length === 0
    && payload.extrusionGroups.length === 0
  ) {
    return { payload: null, usedWasm };
  }

  return { payload, usedWasm };
}

function addToGroup<S extends VectorRenderableSymbol>(
  groups: Map<string, GroupBucket<S>>,
  symbol: S,
  feature: VectorTileWorkerFeature,
): void {
  const key = symbolKey(symbol);
  const existing = groups.get(key);
  if (existing) {
    existing.features.push(feature);
    return;
  }

  groups.set(key, {
    key,
    symbol,
    features: [feature],
  });
}

function resolveSymbol(
  snapshot: SerializableRendererSnapshot,
  feature: VectorTileWorkerFeature,
): VectorRenderableSymbol | null {
  if (snapshot.type === 'simple') {
    return snapshot.symbol;
  }

  if (snapshot.type === 'unique-value') {
    const value = feature.attributes[snapshot.field];
    for (const entry of snapshot.uniqueValues) {
      if (entry.value === value) {
        return entry.symbol;
      }
    }
    return snapshot.defaultSymbol;
  }

  if (snapshot.type === 'class-breaks') {
    const value = feature.attributes[snapshot.field];
    if (typeof value !== 'number') {
      return snapshot.defaultSymbol;
    }

    for (const brk of snapshot.breaks) {
      if (value >= brk.min && value < brk.max) {
        return brk.symbol;
      }
    }

    return snapshot.defaultSymbol;
  }

  return null;
}

function shouldCullExtrusionFeature(
  feature: VectorTileWorkerFeature,
  zoom: number | undefined,
  minScreenAreaPx: number,
): boolean {
  if (zoom === undefined || !Number.isFinite(zoom) || minScreenAreaPx <= 0) {
    return false;
  }

  const areaMeters2 = geometryAreaMeters2(feature.geometry);
  if (!(areaMeters2 > 0)) return true;

  const metersPerPixel = 156543.03392804097 / Math.pow(2, zoom);
  const areaPx = areaMeters2 / (metersPerPixel * metersPerPixel);
  return areaPx < minScreenAreaPx;
}

function geometryAreaMeters2(
  geometry: VectorTileWorkerFeature['geometry'],
): number {
  if (geometry.type === 'Polygon') {
    return polygonAreaMeters2(geometry.coordinates as number[][][]);
  }

  if (geometry.type === 'MultiPolygon') {
    let total = 0;
    for (const polygon of geometry.coordinates as number[][][][]) {
      total += polygonAreaMeters2(polygon);
    }
    return total;
  }

  return 0;
}

function polygonAreaMeters2(rings: number[][][]): number {
  if (rings.length === 0) return 0;

  const outer = Math.abs(ringSignedAreaMeters2(rings[0]!));
  let holes = 0;

  for (let i = 1; i < rings.length; i++) {
    holes += Math.abs(ringSignedAreaMeters2(rings[i]!));
  }

  return Math.max(0, outer - holes);
}

function ringSignedAreaMeters2(ring: number[][]): number {
  if (ring.length < 3) return 0;

  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const curr = ring[i]!;
    const next = ring[(i + 1) % ring.length]!;
    area += curr[0]! * next[1]! - next[0]! * curr[1]!;
  }

  return area * 0.5;
}

interface ExtrusionBuildResult {
  data: {
    vertices: Float32Array;
    indices: Uint32Array;
    indexCount: number;
  } | null;
  usedWasm: boolean;
}

function extrudeProjectedFeatures(
  features: VectorTileWorkerFeature[],
  heightField: string,
  minHeightField: string,
  triangulateFn: WasmTriangulateFn | null,
): ExtrusionBuildResult {
  const allVerts: number[] = [];
  const allIndices: number[] = [];
  let vertexOffset = 0;
  let usedWasm = false;

  for (const feature of features) {
    const geom = feature.geometry;
    const height = Number(feature.attributes[heightField]) || 10;
    const minHeight = Number(feature.attributes[minHeightField]) || 0;

    if (geom.type === 'Polygon') {
      const built = extrudePolygon(
        geom.coordinates as number[][][],
        geom.spatialReference,
        height,
        minHeight,
        allVerts,
        allIndices,
        vertexOffset,
        triangulateFn,
      );
      vertexOffset = built.vertexOffset;
      usedWasm = usedWasm || built.usedWasm;
      continue;
    }

    if (geom.type === 'MultiPolygon') {
      for (const polygon of geom.coordinates as number[][][][]) {
        const built = extrudePolygon(
          polygon,
          geom.spatialReference,
          height,
          minHeight,
          allVerts,
          allIndices,
          vertexOffset,
          triangulateFn,
        );
        vertexOffset = built.vertexOffset;
        usedWasm = usedWasm || built.usedWasm;
      }
    }
  }

  if (allIndices.length === 0) {
    return { data: null, usedWasm };
  }

  const sanitizedIndices = sanitizeTriangleIndices(
    allVerts,
    allIndices,
    EXTRUSION_MAX_TRI_EDGE_MERC01,
  );
  if (sanitizedIndices.length === 0) {
    return { data: null, usedWasm };
  }

  return {
    data: {
      vertices: new Float32Array(allVerts),
      indices: new Uint32Array(sanitizedIndices),
      indexCount: sanitizedIndices.length,
    },
    usedWasm,
  };
}

function extrudePolygon(
  rings: number[][][],
  spatialReference: string | undefined,
  height: number,
  minHeight: number,
  outVerts: number[],
  outIndices: number[],
  vertexOffset: number,
  triangulateFn: WasmTriangulateFn | null,
): { vertexOffset: number; usedWasm: boolean } {
  if (!Number.isFinite(height) || !Number.isFinite(minHeight)) {
    return { vertexOffset, usedWasm: false };
  }

  const flatCoords: number[] = [];
  const holeIndices: number[] = [];
  const projectedRings: number[][][] = [];

  const normalizedRings: number[][][] = [];
  for (const ring of rings) {
    const normalized = normalizeProjectedRing(ring, spatialReference);
    if (normalized.length >= 3) {
      normalizedRings.push(normalized);
    }
  }

  if (normalizedRings.length === 0) {
    return { vertexOffset, usedWasm: false };
  }

  for (let r = 0; r < normalizedRings.length; r++) {
    if (r > 0) {
      holeIndices.push(flatCoords.length / 2);
    }

    const ring = normalizedRings[r]!;
    const projectedRing: number[][] = [];

    for (const coord of ring) {
      const mx = coord[0]!;
      const my = coord[1]!;
      flatCoords.push(mx, my);
      projectedRing.push([mx, my]);
    }

    projectedRings.push(projectedRing);
  }

  // Centroid (outer ring average in merc01)
  const outerRing = projectedRings[0]!;
  let cx = 0, cy = 0;
  for (const c of outerRing) {
    const [m01x, m01y] = toMerc01(c[0]!, c[1]!);
    cx += m01x;
    cy += m01y;
  }
  cx /= outerRing.length;
  cy /= outerRing.length;

  const tri = triangulatePolygon(flatCoords, holeIndices, triangulateFn);
  const triIndices = tri.indices;
  const roofStartVertex = vertexOffset;
  const roofVertexCount = flatCoords.length / 2;

  for (let i = 0; i < flatCoords.length; i += 2) {
    const [m01x, m01y] = toMerc01(flatCoords[i]!, flatCoords[i + 1]!);
    outVerts.push(m01x, m01y, height);
    outVerts.push(0, 0, 1);
    outVerts.push(cx, cy);
  }

  for (const idx of triIndices) {
    outIndices.push(roofStartVertex + idx);
  }

  vertexOffset += roofVertexCount;

  const hasHeightSpan = (height - minHeight) > EXTRUSION_HEIGHT_EPSILON;
  if (minHeight > 0 && hasHeightSpan) {
    const floorStartVertex = vertexOffset;

    for (let i = 0; i < flatCoords.length; i += 2) {
      const [m01x, m01y] = toMerc01(flatCoords[i]!, flatCoords[i + 1]!);
      outVerts.push(m01x, m01y, minHeight);
      outVerts.push(0, 0, -1);
      outVerts.push(cx, cy);
    }

    for (let i = triIndices.length - 1; i >= 0; i--) {
      outIndices.push(floorStartVertex + triIndices[i]!);
    }

    vertexOffset += roofVertexCount;
  }

  if (!hasHeightSpan) {
    return {
      vertexOffset,
      usedWasm: tri.usedWasm,
    };
  }

  for (const ring of projectedRings) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]!;
      const b = ring[(i + 1) % ring.length]!;
      const dx = b[0]! - a[0]!;
      const dy = b[1]! - a[1]!;
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length < EXTRUSION_EDGE_EPSILON) continue;

      const nx = dy / length;
      const ny = -dx / length;

      // Convert positions to merc01 — exact same positions as roof edges.
      // Z-fighting between adjacent buildings is handled by shader WALL_DEPTH_BIAS.
      const [am01x, am01y] = toMerc01(a[0]!, a[1]!);
      const [bm01x, bm01y] = toMerc01(b[0]!, b[1]!);
      const base = vertexOffset;

      outVerts.push(am01x, am01y, minHeight, nx, ny, 0, cx, cy);
      outVerts.push(bm01x, bm01y, minHeight, nx, ny, 0, cx, cy);
      outVerts.push(bm01x, bm01y, height, nx, ny, 0, cx, cy);
      outVerts.push(am01x, am01y, height, nx, ny, 0, cx, cy);

      outIndices.push(base, base + 1, base + 2);
      outIndices.push(base, base + 2, base + 3);

      vertexOffset += 4;
    }
  }

  return {
    vertexOffset,
    usedWasm: tri.usedWasm,
  };
}

function triangulatePolygon(
  flatCoords: number[],
  holeIndices: number[],
  triangulateFn: WasmTriangulateFn | null,
): { indices: number[]; usedWasm: boolean } {
  if (triangulateFn) {
    try {
      const wasmResult = triangulateFn(
        new Float64Array(flatCoords),
        new Uint32Array(holeIndices),
      );

      const wasmIndices = extractWasmIndices(wasmResult);
      if (wasmIndices.length > 0) {
        return { indices: wasmIndices, usedWasm: true };
      }
    } catch {
      // fall through to JS earcut
    }
  }

  return {
    indices: earcut(
      flatCoords,
      holeIndices.length > 0 ? holeIndices : undefined,
      2,
    ),
    usedWasm: false,
  };
}

function extractWasmIndices(result: WasmTriangulateResult): number[] {
  const raw = typeof result.indices === 'function'
    ? (result.indices as () => unknown)()
    : result.indices;

  let indices: number[] = [];

  if (Array.isArray(raw)) {
    indices = raw.map((value) => Number(value));
  } else if (raw instanceof Uint32Array) {
    indices = Array.from(raw);
  }

  if (typeof result.free === 'function') {
    try {
      result.free();
    } catch {
      // no-op
    }
  }

  return indices
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.trunc(value));
}

const EARTH_RADIUS = 6378137;
const MAX_LAT = 85.051128779806604;
const HALF_CIRCUMFERENCE = 20037508.342789244;
const EXTRUSION_RING_EPSILON = 1e-7;
const EXTRUSION_EDGE_EPSILON = 1e-10;
const EXTRUSION_HEIGHT_EPSILON = 1e-3;
const EXTRUSION_MAX_TRI_EDGE_MERC01 = 1_000_000 / (2 * HALF_CIRCUMFERENCE);

function pointsNear(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): boolean {
  return Math.abs(ax - bx) <= EXTRUSION_RING_EPSILON
    && Math.abs(ay - by) <= EXTRUSION_RING_EPSILON;
}

function toMerc01(mx: number, my: number): [number, number] {
  return [
    (mx + HALF_CIRCUMFERENCE) / (2 * HALF_CIRCUMFERENCE),
    1.0 - (my + HALF_CIRCUMFERENCE) / (2 * HALF_CIRCUMFERENCE),
  ];
}

function normalizeProjectedRing(
  ring: number[][],
  spatialReference?: string,
): number[][] {
  const normalized: number[][] = [];

  for (const coord of ring) {
    const [mx, my] = coordinateToMercator(coord, spatialReference);
    if (!Number.isFinite(mx) || !Number.isFinite(my)) continue;
    const prev = normalized[normalized.length - 1];
    if (prev && pointsNear(prev[0]!, prev[1]!, mx, my)) continue;
    normalized.push([mx, my]);
  }

  if (normalized.length > 1) {
    const first = normalized[0]!;
    const last = normalized[normalized.length - 1]!;
    if (pointsNear(first[0]!, first[1]!, last[0]!, last[1]!)) {
      normalized.pop();
    }
  }

  return normalized;
}

function sanitizeTriangleIndices(
  vertices: number[],
  indices: number[],
  maxEdgeXY: number,
): number[] {
  const sanitized: number[] = [];
  const maxEdgeSq = maxEdgeXY * maxEdgeXY;
  const vertexCount = Math.floor(vertices.length / 8);

  for (let i = 0; i + 2 < indices.length; i += 3) {
    const ia = indices[i]!;
    const ib = indices[i + 1]!;
    const ic = indices[i + 2]!;
    if (ia < 0 || ib < 0 || ic < 0) continue;
    if (ia >= vertexCount || ib >= vertexCount || ic >= vertexCount) continue;

    const a = ia * 8;
    const b = ib * 8;
    const c = ic * 8;

    const ax = vertices[a]!;
    const ay = vertices[a + 1]!;
    const az = vertices[a + 2]!;
    const bx = vertices[b]!;
    const by = vertices[b + 1]!;
    const bz = vertices[b + 2]!;
    const cx = vertices[c]!;
    const cy = vertices[c + 1]!;
    const cz = vertices[c + 2]!;

    if (
      !Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(az)
      || !Number.isFinite(bx) || !Number.isFinite(by) || !Number.isFinite(bz)
      || !Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(cz)
    ) {
      continue;
    }

    // Check XY distance only — Z is in metres (height), always reasonable.
    const abSq = (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
    const bcSq = (cx - bx) * (cx - bx) + (cy - by) * (cy - by);
    const caSq = (ax - cx) * (ax - cx) + (ay - cy) * (ay - cy);

    if (abSq > maxEdgeSq || bcSq > maxEdgeSq || caSq > maxEdgeSq) {
      continue;
    }

    sanitized.push(ia, ib, ic);
  }

  return sanitized;
}

function coordinateToMercator(
  coord: number[],
  spatialReference?: string,
): [number, number] {
  if (spatialReference === 'EPSG:3857') {
    return [coord[0]!, coord[1]!];
  }

  const lon = coord[0]!;
  const lat = Math.max(-MAX_LAT, Math.min(MAX_LAT, coord[1]!));
  const x = (lon * Math.PI * EARTH_RADIUS) / 180;
  const latRad = (lat * Math.PI) / 180;
  const y = Math.log(Math.tan(Math.PI / 4 + latRad / 2)) * EARTH_RADIUS;
  return [x, y];
}

function outlineSymbolFromFill(fill: PolygonSymbol): LineSymbol {
  return {
    type: 'simple-line',
    color: fill.outlineColor,
    width: fill.outlineWidth,
    style: 'solid',
    glowColor: fill.outlineGlowColor,
    glowWidth: fill.outlineGlowWidth,
  };
}

function symbolKey(sym: VectorRenderableSymbol): string {
  if (sym.type === 'simple-marker') {
    return `m:${sym.color}:${sym.size}:${sym.outlineColor ?? ''}:${sym.outlineWidth ?? 0}:${sym.glowColor ?? ''}:${sym.glowSize ?? 0}`;
  }
  if (sym.type === 'icon') {
    return `i:${sym.src ?? ''}:${sym.size}:${sym.color}:${sym.rotation ?? 0}:${sym.glowColor ?? ''}:${sym.glowSize ?? 0}:${sym.backgroundColor ?? ''}:${sym.backgroundSize ?? 0}:${sym.outlineColor ?? ''}:${sym.outlineWidth ?? 0}`;
  }
  if (sym.type === 'sdf-icon') {
    return `s:${sym.size}:${sym.color}:${sym.rotation ?? 0}:${sym.glowColor ?? ''}:${sym.glowSize ?? 0}`;
  }
  if (sym.type === 'simple-line') {
    return `l:${sym.color}:${sym.width}:${sym.style}:${sym.glowColor ?? ''}:${sym.glowWidth ?? 0}`;
  }
  if (sym.type === 'simple-fill') {
    return `f:${sym.color}:${sym.outlineColor}:${sym.outlineWidth}:${sym.outlineGlowColor ?? ''}:${sym.outlineGlowWidth ?? 0}`;
  }
  if (sym.type === 'model') {
    return `M:${sym.modelId}:${sym.scale ?? 1}:${sym.heading ?? 0}:${sym.pitch ?? 0}:${sym.roll ?? 0}:${sym.anchorZ ?? 0}:${sym.tintColor ?? ''}`;
  }
  if (sym.type === 'fill-extrusion') {
    return `E:${sym.color}:${sym.heightField}:${sym.minHeightField ?? ''}:${sym.ambient ?? 0.35}:${sym.shininess ?? 32}:${sym.specularStrength ?? 0.15}`;
  }
  return `?:${JSON.stringify(sym)}`;
}

function extractColor(sym: VectorRenderableSymbol): [number, number, number, number] {
  if ('color' in sym) {
    return sym.color as [number, number, number, number];
  }
  if (isModelSymbol(sym) && sym.tintColor) {
    return sym.tintColor;
  }
  return [128, 128, 128, 255];
}

function derivePointSymbol(sym: VectorRenderableSymbol): PointSymbol {
  const c = extractColor(sym);
  const outline = 'outlineColor' in sym && sym.outlineColor
    ? sym.outlineColor as [number, number, number, number]
    : [c[0], c[1], c[2], 255] as [number, number, number, number];

  return {
    type: 'simple-marker',
    color: c,
    size: 'size' in sym ? (sym as PointSymbol).size : 10,
    outlineColor: outline,
    outlineWidth: 'outlineWidth' in sym ? (sym as PolygonSymbol).outlineWidth : 1,
  };
}

function deriveLineSymbol(sym: VectorRenderableSymbol): LineSymbol {
  const c = extractColor(sym);
  return {
    type: 'simple-line',
    color: [c[0], c[1], c[2], 255],
    width: 'width' in sym
      ? (sym as LineSymbol).width
      : 'outlineWidth' in sym
        ? (sym as PolygonSymbol).outlineWidth + 1
        : 2,
    style: 'solid',
  };
}

function derivePolygonSymbol(sym: VectorRenderableSymbol): PolygonSymbol {
  const c = extractColor(sym);
  return {
    type: 'simple-fill',
    color: [c[0], c[1], c[2], c[3] < 255 ? c[3] : 100],
    outlineColor: [c[0], c[1], c[2], 255],
    outlineWidth: 'outlineWidth' in sym ? (sym as PolygonSymbol).outlineWidth : 1,
  };
}

function isPointGeometry(type: string): boolean {
  return type === 'Point' || type === 'MultiPoint';
}

function isLineGeometry(type: string): boolean {
  return type === 'LineString' || type === 'MultiLineString';
}

function isPolygonGeometry(type: string): boolean {
  return type === 'Polygon' || type === 'MultiPolygon';
}

function isPointSymbol(sym: VectorRenderableSymbol): sym is PointSymbol {
  return sym.type === 'simple-marker' || sym.type === 'icon' || sym.type === 'sdf-icon';
}

function isLineSymbol(sym: VectorRenderableSymbol): sym is LineSymbol {
  return sym.type === 'simple-line';
}

function isPolygonSymbol(sym: VectorRenderableSymbol): sym is PolygonSymbol {
  return sym.type === 'simple-fill';
}

function isModelSymbol(sym: VectorRenderableSymbol): sym is ModelSymbol {
  return sym.type === 'model';
}

function isExtrusionSymbol(sym: VectorRenderableSymbol): sym is ExtrudedPolygonSymbol {
  return sym.type === 'fill-extrusion';
}
