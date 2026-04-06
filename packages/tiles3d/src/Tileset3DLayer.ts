/**
 * Tileset3DLayer — ILayer implementation for 3D Tiles.
 *
 * Loads a tileset.json, manages tile tree traversal (SSE-based),
 * content loading, and integrates with the mapgpu render engine.
 */

import type { Feature } from '@mapgpu/core';
import { parseTileset } from './TilesetParser.js';
import type { TileNode } from './TileTraversal.js';
import { traverseTileset, type TraversalResult } from './TileTraversal.js';
import { decodeTileContent, type DecodedTileContent } from './TileContentLoader.js';
import { TileCache } from './TileCache.js';

export interface Tileset3DLayerOptions {
  id: string;
  /** URL to tileset.json */
  url: string;
  /** Screen-Space Error threshold (default 16) */
  sseThreshold?: number;
  /** Max cache size in bytes (default 256 MB) */
  maxCacheBytes?: number;
  /** Visibility */
  visible?: boolean;
}

export class Tileset3DLayer {
  readonly id: string;
  readonly type = 'tileset3d' as const;
  visible: boolean;

  private _url: string;
  private _sseThreshold: number;
  private _root: TileNode | null = null;
  private _cache: TileCache;
  private _loadingCount = 0;
  private _ready = false;

  // Renderer is not applicable for 3D Tiles — content carries its own materials
  renderer = null;

  constructor(options: Tileset3DLayerOptions) {
    this.id = options.id;
    this._url = options.url;
    this._sseThreshold = options.sseThreshold ?? 16;
    this.visible = options.visible ?? true;
    this._cache = new TileCache(options.maxCacheBytes);
  }

  /** Whether the tileset root has been loaded and parsed. */
  get ready(): boolean {
    return this._ready;
  }

  /** Number of tiles currently being loaded. */
  get loadingCount(): number {
    return this._loadingCount;
  }

  /** Total bytes cached. */
  get cacheBytes(): number {
    return this._cache.totalBytes;
  }

  /** Tiles in cache. */
  get cacheSize(): number {
    return this._cache.size;
  }

  /** Load the tileset.json and parse the tile tree. */
  async load(): Promise<void> {
    const baseUrl = this._url.substring(0, this._url.lastIndexOf('/') + 1);
    const response = await fetch(this._url);
    const json = await response.json();

    this._root = parseTileset(json, baseUrl);
    this._ready = true;
  }

  /**
   * Per-frame update: traverse the tile tree and determine which tiles
   * to render / load based on the current camera.
   *
   * @returns Traversal result with render and load lists.
   */
  update(
    cameraPosition: [number, number, number],
    viewportHeight: number,
    fieldOfView: number,
  ): TraversalResult | null {
    if (!this._root || !this.visible) return null;

    const result = traverseTileset(this._root, {
      cameraPosition,
      viewportHeight,
      fieldOfView,
      sseThreshold: this._sseThreshold,
    });

    // Trigger loading for unloaded tiles
    for (const tile of result.load) {
      this._loadTileContent(tile);
    }

    return result;
  }

  /** Get the decoded content for a tile. */
  getContent(tile: TileNode): DecodedTileContent | undefined {
    if (!tile.contentUri) return undefined;
    return this._cache.get(tile.contentUri)?.data as DecodedTileContent | undefined;
  }

  /** ILayer compatibility — 3D Tiles don't expose features directly. */
  getFeatures(): Feature[] {
    return [];
  }

  destroy(): void {
    this._cache.clear();
    this._root = null;
    this._ready = false;
  }

  // ── Private ──

  private async _loadTileContent(tile: TileNode): Promise<void> {
    if (!tile.contentUri || tile._loaded || tile._loading) return;
    if (this._cache.has(tile.contentUri)) {
      tile._loaded = true;
      return;
    }

    tile._loading = true;
    this._loadingCount++;

    try {
      const response = await fetch(tile.contentUri);
      const data = await response.arrayBuffer();
      const decoded = decodeTileContent(data);

      this._cache.set(tile.contentUri, decoded, data.byteLength);
      tile._loaded = true;
    } catch (e) {
      console.error(`[tiles3d] Failed to load tile: ${tile.contentUri}`, e);
    } finally {
      tile._loading = false;
      this._loadingCount--;
    }
  }
}
