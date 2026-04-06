/**
 * SnapEngine — Multi-type snap engine with priority-based candidate selection.
 *
 * Supports: endpoint, midpoint, intersection, nearest-on-edge, point, and angle guide snaps.
 * Follows openwebcad's two-phase pattern: entity snaps first, angle guides as fallback.
 */

import { screenDistance } from '../helpers/geometryHelpers.js';
import {
  SnapType,
  SNAP_PRIORITY,
  compareSnapCandidates,
  resolveSnapConfig,
  type SnapCandidate,
  type SnapResult,
  type SnapConfig,
  type SnapSourceLayer,
  type ResolvedSnapConfig,
} from './SnapTypes.js';
import {
  extractVertices,
  extractEdges,
  edgeMidpoint,
  nearestPointOnSegment,
  segmentSegmentIntersection,
} from './snapGeometry.js';
import { AngleGuideManager } from './AngleGuideManager.js';

/* ------------------------------------------------------------------ */
/*  Edge with source feature tracking (for intersection dedup)         */
/* ------------------------------------------------------------------ */

interface TaggedEdge {
  a: [number, number];
  b: [number, number];
  featureId: string | number;
}

/* ------------------------------------------------------------------ */
/*  SnapEngine                                                         */
/* ------------------------------------------------------------------ */

export class SnapEngine {
  private _config: ResolvedSnapConfig;
  private _sourceLayers: SnapSourceLayer[] = [];
  readonly angleGuideManager: AngleGuideManager;

  constructor(config?: SnapConfig) {
    this._config = resolveSnapConfig(config);
    this.angleGuideManager = new AngleGuideManager(
      this._config.angleGuideHoverThreshold,
    );
  }

  /* ── Source layer management ─────────────────────────────────────── */

  addSourceLayer(layer: SnapSourceLayer): void {
    this._sourceLayers.push(layer);
  }

  removeSourceLayer(layer: SnapSourceLayer): void {
    this._sourceLayers = this._sourceLayers.filter((l) => l !== layer);
  }

  /* ── Configuration ───────────────────────────────────────────────── */

  get config(): Readonly<ResolvedSnapConfig> {
    return this._config;
  }

  setTolerance(px: number): void {
    this._config.tolerance = px;
  }

  setEnabled(enabled: boolean): void {
    this._config.enabled = enabled;
  }

  enableType(type: SnapType): void {
    this._config.enabledTypes.add(type);
  }

  disableType(type: SnapType): void {
    this._config.enabledTypes.delete(type);
  }

  /* ── Main snap method ────────────────────────────────────────────── */

  /**
   * Extra vertices to include in endpoint snapping (e.g. in-progress drawing vertices).
   * Set by drawing tools before calling snap(), cleared after draw-complete.
   */
  activeVertices: [number, number][] = [];

  snap(
    screenX: number,
    screenY: number,
    mapCoords: [number, number],
    toScreen: (lon: number, lat: number) => [number, number] | null,
  ): SnapResult {
    const noSnap: SnapResult = { coords: mapCoords, type: 'none', candidates: [] };

    if (!this._config.enabled) return noSnap;

    const candidates: SnapCandidate[] = [];
    const { enabledTypes, tolerance, priorities } = this._config;

    const getPriority = (t: SnapType): number => priorities[t] ?? SNAP_PRIORITY[t];

    // ─── Phase 1: Entity snaps ───────────────────────────────────
    const taggedEdges: TaggedEdge[] = [];

    for (const layer of this._sourceLayers) {
      for (const feature of layer.getFeatures()) {
        if (feature.attributes['__preview']) continue;

        const geom = feature.geometry;

        // EndPoint snap
        if (enabledTypes.has(SnapType.EndPoint)) {
          const verts = extractVertices(geom);
          for (const v of verts) {
            const sp = toScreen(v[0], v[1]);
            if (!sp) continue;
            const d = screenDistance(screenX, screenY, sp[0], sp[1]);
            if (d <= tolerance) {
              candidates.push({
                coords: v,
                type: SnapType.EndPoint,
                screenDistance: d,
                sourceFeatureId: feature.id,
                priority: getPriority(SnapType.EndPoint),
              });
            }
          }
        }

        // Point snap (for Point geometries only)
        if (enabledTypes.has(SnapType.Point) && geom.type === 'Point') {
          const c = geom.coordinates as number[];
          const pt: [number, number] = [c[0]!, c[1]!];
          const sp = toScreen(pt[0], pt[1]);
          if (sp) {
            const d = screenDistance(screenX, screenY, sp[0], sp[1]);
            if (d <= tolerance) {
              candidates.push({
                coords: pt,
                type: SnapType.Point,
                screenDistance: d,
                sourceFeatureId: feature.id,
                priority: getPriority(SnapType.Point),
              });
            }
          }
        }

        // Edge-based snaps (midpoint + nearest)
        const edges = extractEdges(geom);

        if (enabledTypes.has(SnapType.MidPoint)) {
          for (const [a, b] of edges) {
            const mp = edgeMidpoint(a, b);
            const sp = toScreen(mp[0], mp[1]);
            if (!sp) continue;
            const d = screenDistance(screenX, screenY, sp[0], sp[1]);
            if (d <= tolerance) {
              candidates.push({
                coords: mp,
                type: SnapType.MidPoint,
                screenDistance: d,
                sourceFeatureId: feature.id,
                priority: getPriority(SnapType.MidPoint),
              });
            }
          }
        }

        if (enabledTypes.has(SnapType.Nearest)) {
          for (const [a, b] of edges) {
            const result = nearestPointOnSegment(a, b, screenX, screenY, toScreen);
            if (!result) continue;
            // Exclude near-endpoints to avoid duplicating EndPoint snaps
            if (result.t < 0.02 || result.t > 0.98) continue;
            if (result.screenDistance <= tolerance) {
              candidates.push({
                coords: result.coords,
                type: SnapType.Nearest,
                screenDistance: result.screenDistance,
                sourceFeatureId: feature.id,
                priority: getPriority(SnapType.Nearest),
              });
            }
          }
        }

        // Collect edges for intersection detection
        if (enabledTypes.has(SnapType.Intersection)) {
          for (const [a, b] of edges) {
            taggedEdges.push({ a, b, featureId: feature.id });
          }
        }
      }
    }

    // Active vertices (in-progress drawing) — snap to own placed vertices
    if (enabledTypes.has(SnapType.EndPoint) && this.activeVertices.length > 0) {
      for (const v of this.activeVertices) {
        const sp = toScreen(v[0], v[1]);
        if (!sp) continue;
        const d = screenDistance(screenX, screenY, sp[0], sp[1]);
        if (d <= tolerance) {
          candidates.push({
            coords: v,
            type: SnapType.EndPoint,
            screenDistance: d,
            priority: getPriority(SnapType.EndPoint),
          });
        }
      }
    }

    // Intersection snap: pairwise between edges of DIFFERENT features
    if (enabledTypes.has(SnapType.Intersection) && taggedEdges.length > 1) {
      this._findIntersections(taggedEdges, screenX, screenY, tolerance, toScreen, getPriority, candidates);
    }

    // ─── Phase 2: Angle guides (fallback only) ───────────────────
    if (enabledTypes.has(SnapType.AngleGuide) && candidates.length === 0) {
      const guideSnap = this.angleGuideManager.findGuideSnap(
        screenX, screenY, toScreen, tolerance,
        this._config.angleGuideIntervals,
      );
      if (guideSnap) {
        candidates.push({
          ...guideSnap,
          type: SnapType.AngleGuide,
          priority: getPriority(SnapType.AngleGuide),
        });
      }
    }

    // ─── Phase 3: Sort & select best ─────────────────────────────
    candidates.sort(compareSnapCandidates);

    if (candidates.length > 0) {
      const best = candidates[0]!;
      return {
        coords: best.coords,
        type: best.type,
        sourceFeatureId: best.sourceFeatureId,
        candidates,
      };
    }

    return noSnap;
  }

  /* ── Intersection detection ──────────────────────────────────────── */

  private _findIntersections(
    taggedEdges: TaggedEdge[],
    screenX: number,
    screenY: number,
    tolerance: number,
    toScreen: (lon: number, lat: number) => [number, number] | null,
    getPriority: (t: SnapType) => number,
    candidates: SnapCandidate[],
  ): void {
    // O(n²) pairwise — only between different features
    for (let i = 0; i < taggedEdges.length; i++) {
      for (let j = i + 1; j < taggedEdges.length; j++) {
        const ei = taggedEdges[i]!;
        const ej = taggedEdges[j]!;
        if (ei.featureId === ej.featureId) continue;

        const pt = segmentSegmentIntersection(ei.a, ei.b, ej.a, ej.b);
        if (!pt) continue;

        const sp = toScreen(pt[0], pt[1]);
        if (!sp) continue;

        const d = screenDistance(screenX, screenY, sp[0], sp[1]);
        if (d <= tolerance) {
          candidates.push({
            coords: pt,
            type: SnapType.Intersection,
            screenDistance: d,
            priority: getPriority(SnapType.Intersection),
          });
        }
      }
    }
  }
}
