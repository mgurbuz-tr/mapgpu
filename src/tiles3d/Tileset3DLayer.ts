/**
 * Tileset3DLayer — ILayer implementation for 3D Tiles.
 *
 * Loads a tileset.json, manages tile tree traversal (SSE-based),
 * content loading, and integrates with the mapgpu render engine.
 */

import type {
  Feature,
  IWorker,
  WorkerPoolRegistry,
  WorkerTaskDef,
} from '../core/index.js';
import { parseTileset } from './TilesetParser.js';
import { traverseTileset, type TileNode, type TraversalResult } from './TileTraversal.js';
import { decodeTileContent, type DecodedTileContent } from './TileContentLoader.js';
import {
  createTiles3DDecodeTaskDef,
  type Tiles3DDecodeRequest,
  type Tiles3DDecodeResponse,
} from './tiles3d-worker-protocol.js';
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
  /**
   * Optional worker pool registry (owned by ViewCore) used to offload tile
   * content decoding (B3DM/I3DM/PNTS/CMPT + glTF parse) off the main thread.
   * Falls back to sync main-thread decoding on any worker error.
   */
  workerRegistry?: WorkerPoolRegistry;
  /**
   * Optional override for the tiles3d worker factory. Defaults to the bundled
   * module worker. Intended for test injection.
   */
  tiles3dWorkerFactory?: () => IWorker;
}

export class Tileset3DLayer {
  readonly id: string;
  readonly type = 'tileset3d' as const;
  visible: boolean;

  private readonly _url: string;
  private readonly _sseThreshold: number;
  private _root: TileNode | null = null;
  private readonly _cache: TileCache;
  private _loadingCount = 0;
  private _ready = false;

  private readonly _workerRegistry: WorkerPoolRegistry | null;
  private readonly _decodeTaskDef: WorkerTaskDef<Tiles3DDecodeRequest, Tiles3DDecodeResponse> | null;
  private _workerDisabled = false;

  // Renderer is not applicable for 3D Tiles — content carries its own materials
  renderer = null;

  constructor(options: Tileset3DLayerOptions) {
    this.id = options.id;
    this._url = options.url;
    this._sseThreshold = options.sseThreshold ?? 16;
    this.visible = options.visible ?? true;
    this._cache = new TileCache(options.maxCacheBytes);

    this._workerRegistry = options.workerRegistry ?? null;
    if (this._workerRegistry && options.tiles3dWorkerFactory) {
      this._decodeTaskDef = createTiles3DDecodeTaskDef(options.tiles3dWorkerFactory);
    } else if (this._workerRegistry) {
      this._decodeTaskDef = createTiles3DDecodeTaskDef(() => {
        const w = new Worker(
          new URL('./tiles3d.worker.js', import.meta.url),
          { type: 'module' },
        );
        return w as unknown as IWorker;
      });
    } else {
      this._decodeTaskDef = null;
    }
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
      const byteLength = data.byteLength;
      const decoded = await this._decodeTileBuffer(data);

      this._cache.set(tile.contentUri, decoded, byteLength);
      tile._loaded = true;
    } catch (e) {
      console.error(`[tiles3d] Failed to load tile: ${tile.contentUri}`, e);
    } finally {
      tile._loading = false;
      this._loadingCount--;
    }
  }

  /**
   * Decode a raw tile content buffer. Routes through the tiles3d worker when
   * a registry is configured and the worker has not been disabled by a prior
   * failure. Falls back to sync main-thread decoding otherwise.
   *
   * Note: byteLength must be captured BEFORE this call because the worker
   * path transfers ownership of the buffer — `.byteLength` becomes 0 after.
   */
  private async _decodeTileBuffer(data: ArrayBuffer): Promise<DecodedTileContent> {
    if (
      this._workerRegistry
      && this._decodeTaskDef
      && !this._workerDisabled
    ) {
      try {
        return await this._workerRegistry.run(this._decodeTaskDef, { buffer: data });
      } catch (err) {
        this._workerDisabled = true;
        console.warn('[tiles3d] worker decode disabled, falling back to main thread:', err);
      }
    }
    return decodeTileContent(data);
  }
}
