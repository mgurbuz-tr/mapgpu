/**
 * Pure geometry functions for the snap system.
 *
 * All functions are stateless — no side effects, no DOM, no GPU.
 * Screen-space helpers reuse `screenDistance` and `pointToSegmentDistance`
 * from `../helpers/geometryHelpers.ts`.
 */

import type { Geometry } from '@mapgpu/core';
import { screenDistance, pointToSegmentDistance } from '../helpers/geometryHelpers.js';

const EPSILON = 1e-10;

/* ------------------------------------------------------------------ */
/*  Core vector math                                                   */
/* ------------------------------------------------------------------ */

/** 2D cross product of vectors (ax,ay) × (bx,by). */
export function cross2D(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

/** Linear interpolation between two coordinate pairs. */
export function lerpCoords(
  a: [number, number],
  b: [number, number],
  t: number,
): [number, number] {
  return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
}

/** Midpoint of two coordinate pairs. */
export function edgeMidpoint(
  a: [number, number],
  b: [number, number],
): [number, number] {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/* ------------------------------------------------------------------ */
/*  Segment-segment intersection                                       */
/* ------------------------------------------------------------------ */

/**
 * Find intersection point of two line segments in 2D.
 *
 * Uses parametric form:
 *   P = p1 + t*(p2 - p1)
 *   Q = p3 + u*(p4 - p3)
 *
 * Returns [lon, lat] or null if no intersection.
 */
export function segmentSegmentIntersection(
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  p4: [number, number],
): [number, number] | null {
  const d1x = p2[0] - p1[0];
  const d1y = p2[1] - p1[1];
  const d2x = p4[0] - p3[0];
  const d2y = p4[1] - p3[1];

  const denom = cross2D(d1x, d1y, d2x, d2y);

  // Parallel or coincident
  if (Math.abs(denom) < EPSILON) return null;

  const dx = p3[0] - p1[0];
  const dy = p3[1] - p1[1];

  const t = cross2D(dx, dy, d2x, d2y) / denom;
  const u = cross2D(dx, dy, d1x, d1y) / denom;

  // Both parameters must be in [0, 1] for segments to intersect
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;

  return [p1[0] + t * d1x, p1[1] + t * d1y];
}

/* ------------------------------------------------------------------ */
/*  Edge extraction from geometry                                      */
/* ------------------------------------------------------------------ */

type Edge = [[number, number], [number, number]];

/**
 * Extract edges as pairs of coordinate tuples from any GeoJSON geometry.
 *
 * - Point / MultiPoint → empty
 * - LineString → N-1 edges
 * - Polygon → ring edges (including closing segment)
 * - Multi* → recursive flatten
 */
export function extractEdges(geometry: Geometry): Edge[] {
  const edges: Edge[] = [];

  switch (geometry.type) {
    case 'Point':
    case 'MultiPoint':
      break;

    case 'LineString':
      _lineStringEdges(geometry.coordinates as number[][], edges);
      break;

    case 'MultiLineString':
      for (const line of geometry.coordinates as number[][][]) {
        _lineStringEdges(line, edges);
      }
      break;

    case 'Polygon':
      for (const ring of geometry.coordinates as number[][][]) {
        _ringEdges(ring, edges);
      }
      break;

    case 'MultiPolygon':
      for (const polygon of geometry.coordinates as number[][][][]) {
        for (const ring of polygon) {
          _ringEdges(ring, edges);
        }
      }
      break;
  }

  return edges;
}

function _lineStringEdges(coords: number[][], out: Edge[]): void {
  for (let i = 0; i < coords.length - 1; i++) {
    out.push([
      [coords[i]![0]!, coords[i]![1]!],
      [coords[i + 1]![0]!, coords[i + 1]![1]!],
    ]);
  }
}

function _ringEdges(coords: number[][], out: Edge[]): void {
  if (coords.length < 2) return;
  for (let i = 0; i < coords.length - 1; i++) {
    out.push([
      [coords[i]![0]!, coords[i]![1]!],
      [coords[i + 1]![0]!, coords[i + 1]![1]!],
    ]);
  }
  // If ring is not already closed, add closing edge
  const first = coords[0]!;
  const last = coords[coords.length - 1]!;
  if (Math.abs(first[0]! - last[0]!) > EPSILON || Math.abs(first[1]! - last[1]!) > EPSILON) {
    out.push([
      [last[0]!, last[1]!],
      [first[0]!, first[1]!],
    ]);
  }
}

/**
 * Extract all vertex coordinates from any GeoJSON geometry.
 */
export function extractVertices(geometry: Geometry): [number, number][] {
  const result: [number, number][] = [];
  _flattenCoords(geometry.coordinates, result);
  return result;
}

function _flattenCoords(
  coords: Geometry['coordinates'],
  out: [number, number][],
): void {
  if (!Array.isArray(coords) || coords.length === 0) return;

  if (typeof coords[0] === 'number') {
    out.push([coords[0] as number, (coords[1] ?? 0) as number]);
    return;
  }

  for (const sub of coords) {
    _flattenCoords(sub as Geometry['coordinates'], out);
  }
}

/* ------------------------------------------------------------------ */
/*  Nearest point on segment (screen-space check, map-space result)    */
/* ------------------------------------------------------------------ */

export interface NearestOnSegmentResult {
  coords: [number, number];
  screenDistance: number;
  t: number;
}

/**
 * Find the nearest point on a map-space segment from a screen cursor.
 *
 * 1. Projects segment endpoints to screen space.
 * 2. Computes perpendicular projection in screen space (reuses pointToSegmentDistance).
 * 3. Interpolates in map coordinates using the parametric t.
 */
export function nearestPointOnSegment(
  segA: [number, number],
  segB: [number, number],
  screenX: number,
  screenY: number,
  toScreen: (lon: number, lat: number) => [number, number] | null,
): NearestOnSegmentResult | null {
  const sa = toScreen(segA[0], segA[1]);
  const sb = toScreen(segB[0], segB[1]);
  if (!sa || !sb) return null;

  const { distance, t } = pointToSegmentDistance(screenX, screenY, sa[0], sa[1], sb[0], sb[1]);
  const coords = lerpCoords(segA, segB, t);

  return { coords, screenDistance: distance, t };
}

/* ------------------------------------------------------------------ */
/*  Angle guide geometry                                               */
/* ------------------------------------------------------------------ */

export interface AngleGuide {
  origin: [number, number];
  direction: [number, number];
  angleDeg: number;
}

/**
 * Generate angle guide rays from origin points.
 *
 * Each origin emits rays at the specified angle intervals.
 * Angles are measured from geographic north (0°=N, 90°=E).
 * Only half-circle (0–179°) is needed since each line extends both ways.
 */
export function generateAngleGuides(
  origins: [number, number][],
  anglesDeg: number[],
): AngleGuide[] {
  const guides: AngleGuide[] = [];
  const DEG2RAD = Math.PI / 180;

  for (const origin of origins) {
    for (const deg of anglesDeg) {
      const rad = deg * DEG2RAD;
      // dx/dy as unit vector in lon/lat space
      // sin for east-west component, cos for north-south
      const dx = Math.sin(rad);
      const dy = Math.cos(rad);
      guides.push({ origin, direction: [dx, dy], angleDeg: deg });
    }
  }

  return guides;
}

/**
 * Snap cursor to an angle guide ray (infinite line through origin).
 *
 * Projects the ray to screen space, finds the perpendicular projection
 * of the cursor onto the line, and returns the map-space coordinate.
 */
export function snapToAngleGuide(
  guide: AngleGuide,
  screenX: number,
  screenY: number,
  toScreen: (lon: number, lat: number) => [number, number] | null,
  tolerance: number,
): { coords: [number, number]; screenDistance: number } | null {
  const STEP = 0.01; // ~1km at equator — enough to define direction in screen space

  const screenA = toScreen(guide.origin[0], guide.origin[1]);
  if (!screenA) return null;

  // Sample a second point along the ray to define screen-space direction
  const farPoint: [number, number] = [
    guide.origin[0] + guide.direction[0] * STEP,
    guide.origin[1] + guide.direction[1] * STEP,
  ];
  const screenB = toScreen(farPoint[0], farPoint[1]);
  if (!screenB) return null;

  // Direction in screen space
  const sdx = screenB[0] - screenA[0];
  const sdy = screenB[1] - screenA[1];
  const lenSq = sdx * sdx + sdy * sdy;
  if (lenSq < EPSILON) return null;

  // Parametric projection of cursor onto the screen-space line (unbounded)
  const t = ((screenX - screenA[0]) * sdx + (screenY - screenA[1]) * sdy) / lenSq;

  // Projected point in screen space
  const projSx = screenA[0] + t * sdx;
  const projSy = screenA[1] + t * sdy;
  const dist = screenDistance(screenX, screenY, projSx, projSy);

  if (dist > tolerance) return null;

  // Convert screen t back to map-space coordinates
  // t is relative to the STEP, so map-space offset = t * STEP * direction
  const mapCoords: [number, number] = [
    guide.origin[0] + t * STEP * guide.direction[0],
    guide.origin[1] + t * STEP * guide.direction[1],
  ];

  return { coords: mapCoords, screenDistance: dist };
}
