/**
 * SSE-based tile selection for 3D Tiles.
 *
 * Computes Screen-Space Error for each tile and determines
 * which tiles to render vs. refine (load children).
 */

import type { TileBoundingVolume } from './TileBoundingVolume.js';
import { distanceToBoundingVolume } from './TileBoundingVolume.js';

/** A node in the parsed tileset tree. */
export interface TileNode {
  /** Unique URI or path for content loading */
  contentUri?: string;
  /** Geometric error in meters */
  geometricError: number;
  /** Bounding volume */
  boundingVolume: TileBoundingVolume;
  /** Child tiles */
  children: TileNode[];
  /** Refinement strategy */
  refine: 'ADD' | 'REPLACE';
  /** Transform (4×4 column-major, identity if not specified) */
  transform?: Float64Array;
  /** Loading state */
  _loaded?: boolean;
  _loading?: boolean;
}

/** Parameters for SSE-based tile traversal */
export interface TraversalParams {
  cameraPosition: [number, number, number];
  viewportHeight: number;
  fieldOfView: number; // vertical FOV in radians
  sseThreshold: number; // default 16 pixels
}

/** Result of traversal — tiles to render and tiles to request */
export interface TraversalResult {
  /** Tiles whose content should be rendered this frame */
  render: TileNode[];
  /** Tiles whose content needs to be loaded */
  load: TileNode[];
}

/**
 * Compute Screen-Space Error for a tile.
 *
 * SSE = geometricError × (viewportHeight / (2 × distance × tan(fov/2)))
 */
export function computeSSE(
  geometricError: number,
  distance: number,
  viewportHeight: number,
  fov: number,
): number {
  if (distance <= 0) return Infinity;
  return geometricError * (viewportHeight / (2 * distance * Math.tan(fov / 2)));
}

/**
 * Traverse the tile tree and determine which tiles to render.
 *
 * Uses SSE (Screen-Space Error) to decide refinement:
 * - SSE > threshold → refine (recurse into children)
 * - SSE ≤ threshold → render this tile
 */
export function traverseTileset(
  root: TileNode,
  params: TraversalParams,
): TraversalResult {
  const render: TileNode[] = [];
  const load: TileNode[] = [];

  function visit(node: TileNode): void { // NOSONAR
    const distance = distanceToBoundingVolume(
      node.boundingVolume,
      params.cameraPosition,
    );

    const sse = computeSSE(
      node.geometricError,
      distance,
      params.viewportHeight,
      params.fieldOfView,
    );

    if (sse <= params.sseThreshold || node.children.length === 0) {
      // This tile is detailed enough — render it
      if (node.contentUri) {
        if (node._loaded) {
          render.push(node);
        } else if (!node._loading) {
          load.push(node);
        }
      }
      return;
    }

    // SSE too high — refine (use children)
    if (node.refine === 'REPLACE') {
      // Check if ALL children are loaded
      const allChildrenReady = node.children.every(
        (c) => !c.contentUri || c._loaded,
      );

      if (allChildrenReady) {
        // Use children
        for (const child of node.children) visit(child);
      } else {
        // Fall back to this tile while children load
        if (node.contentUri && node._loaded) {
          render.push(node);
        }
        // Request unloaded children
        for (const child of node.children) {
          if (child.contentUri && !child._loaded && !child._loading) {
            load.push(child);
          }
        }
      }
    } else {
      // ADD refinement: render this tile AND children
      if (node.contentUri && node._loaded) {
        render.push(node);
      } else if (node.contentUri && !node._loaded && !node._loading) {
        load.push(node);
      }
      for (const child of node.children) visit(child);
    }
  }

  visit(root);
  return { render, load };
}
