/**
 * Snap type definitions, candidate interfaces, and configuration.
 *
 * Inspired by openwebcad's snap system — adapted for GIS map coordinates
 * with screen-space tolerance matching.
 */

import type { Feature } from '@mapgpu/core';

/* ------------------------------------------------------------------ */
/*  Snap type enum & priority                                          */
/* ------------------------------------------------------------------ */

/** All supported snap point types. */
export enum SnapType {
  /** Line/polygon vertex endpoints. */
  EndPoint = 'endpoint',
  /** Point geometry features. */
  Point = 'point',
  /** Midpoint of each edge segment. */
  MidPoint = 'midpoint',
  /** Intersection of edges from different features. */
  Intersection = 'intersection',
  /** Perpendicular nearest point on an edge. */
  Nearest = 'nearest',
  /** Snap to angle guide lines (45°, 90° etc.). */
  AngleGuide = 'angle-guide',
}

/**
 * Default priority for each snap type (lower number = higher priority).
 * Entity snaps (0–49) always beat guide snaps (50+).
 */
export const SNAP_PRIORITY: Record<SnapType, number> = {
  [SnapType.EndPoint]: 0,
  [SnapType.Point]: 5,
  [SnapType.MidPoint]: 10,
  [SnapType.Intersection]: 20,
  [SnapType.Nearest]: 30,
  [SnapType.AngleGuide]: 50,
};

/** All entity-based snap types (excludes angle guides). */
export const ENTITY_SNAP_TYPES: ReadonlySet<SnapType> = new Set([
  SnapType.EndPoint,
  SnapType.Point,
  SnapType.MidPoint,
  SnapType.Intersection,
  SnapType.Nearest,
]);

/* ------------------------------------------------------------------ */
/*  Interfaces                                                         */
/* ------------------------------------------------------------------ */

/** A single snap candidate produced during the snap search. */
export interface SnapCandidate {
  /** Snapped geographic [lon, lat]. */
  coords: [number, number];
  /** Snap type that produced this candidate. */
  type: SnapType;
  /** Screen-space pixel distance from cursor. */
  screenDistance: number;
  /** Source feature ID, if snap came from a feature. */
  sourceFeatureId?: string | number;
  /** Priority (lower wins). Derived from SNAP_PRIORITY unless overridden. */
  priority: number;
}

/** Result returned by the snap engine. */
export interface SnapResult {
  /** Final snapped coordinates (best candidate, or raw mapCoords if no snap). */
  coords: [number, number];
  /** Type of snap that occurred. `'none'` if no candidate within tolerance. */
  type: SnapType | 'none';
  /** Source feature ID, if snapped to a feature. */
  sourceFeatureId?: string | number;
  /** All candidates within tolerance, sorted by priority then distance. */
  candidates: SnapCandidate[];
}

/** Configuration for the snap engine. */
export interface SnapConfig {
  /** Master on/off switch. Default: `true`. */
  enabled?: boolean;
  /** Active snap types. Default: all entity snaps enabled, angle guide disabled. */
  enabledTypes?: Set<SnapType>;
  /** Screen-pixel tolerance for proximity. Default: `10`. */
  tolerance?: number;
  /** Angle guide intervals in degrees. Default: `[0, 45, 90, 135]`. */
  angleGuideIntervals?: number[];
  /** Hover duration (ms) before a point becomes an angle guide origin. Default: `500`. */
  angleGuideHoverThreshold?: number;
  /** Custom priority overrides (SnapType → priority number). */
  priorityOverrides?: Partial<Record<SnapType, number>>;
}

/** Resolved (non-optional) snap configuration. */
export interface ResolvedSnapConfig {
  enabled: boolean;
  enabledTypes: Set<SnapType>;
  tolerance: number;
  angleGuideIntervals: number[];
  angleGuideHoverThreshold: number;
  priorities: Record<SnapType, number>;
}

/** A layer that provides features for snapping. */
export interface SnapSourceLayer {
  getFeatures(): readonly Feature[];
}

/** Default snap configuration values. */
export function resolveSnapConfig(cfg?: SnapConfig): ResolvedSnapConfig {
  const priorities = { ...SNAP_PRIORITY, ...cfg?.priorityOverrides };
  return {
    enabled: cfg?.enabled ?? true,
    enabledTypes: cfg?.enabledTypes ?? new Set(ENTITY_SNAP_TYPES),
    tolerance: cfg?.tolerance ?? 10,
    angleGuideIntervals: cfg?.angleGuideIntervals ?? [0, 45, 90, 135],
    angleGuideHoverThreshold: cfg?.angleGuideHoverThreshold ?? 500,
    priorities,
  };
}

/** Compare two candidates: lower priority wins, ties broken by closer distance. */
export function compareSnapCandidates(a: SnapCandidate, b: SnapCandidate): number {
  if (a.priority !== b.priority) return a.priority - b.priority;
  return a.screenDistance - b.screenDistance;
}
