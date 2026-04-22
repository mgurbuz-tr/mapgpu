/**
 * Tileset JSON parser.
 *
 * Parses the tileset.json descriptor and builds the tile tree structure.
 */

import { parseBoundingVolume } from './TileBoundingVolume.js';
import type { TileNode } from './TileTraversal.js';

/** Raw tileset.json structure (subset of the 3D Tiles spec) */
interface TilesetJson {
  asset: { version: string; tilesetVersion?: string };
  geometricError: number;
  root: TileJsonNode;
}

interface TileJsonNode {
  boundingVolume: Record<string, unknown>;
  geometricError: number;
  refine?: string;
  content?: { uri?: string; url?: string };
  children?: TileJsonNode[];
  transform?: number[];
}

/**
 * Parse a tileset.json into a TileNode tree.
 *
 * @param json    - The tileset.json object.
 * @param baseUrl - The base URL for resolving content URIs.
 */
export function parseTileset(json: unknown, baseUrl: string): TileNode {
  const tileset = json as TilesetJson;

  if (!tileset.root) {
    throw new Error('3D Tiles: tileset.json has no root');
  }

  return parseNode(tileset.root, baseUrl, 'REPLACE');
}

function parseNode(
  raw: TileJsonNode,
  baseUrl: string,
  parentRefine: string,
): TileNode {
  const bv = parseBoundingVolume(raw.boundingVolume);
  if (!bv) {
    throw new Error('3D Tiles: tile has no valid bounding volume');
  }

  // Content URI (spec allows both "uri" and legacy "url")
  let contentUri: string | undefined;
  if (raw.content) {
    const uri = raw.content.uri ?? raw.content.url;
    if (uri) {
      contentUri = uri.startsWith('http') || uri.startsWith('data:')
        ? uri
        : baseUrl + uri;
    }
  }

  // Transform (column-major 4×4)
  let transform: Float64Array | undefined;
  if (raw.transform?.length === 16) {
    transform = new Float64Array(raw.transform);
  }

  const refine = ((raw.refine ?? parentRefine).toUpperCase()) as 'ADD' | 'REPLACE';

  const children: TileNode[] = (raw.children ?? []).map((child) =>
    parseNode(child, baseUrl, refine),
  );

  return {
    contentUri,
    geometricError: raw.geometricError,
    boundingVolume: bv,
    children,
    refine,
    transform,
  };
}
