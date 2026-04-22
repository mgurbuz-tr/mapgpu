/**
 * LayerBase — Abstract base class for all layers.
 *
 * Implements the ILayer interface, providing common lifecycle,
 * visibility, opacity, scale management, and event delegation.
 */

import { EventBus } from '../core/index.js';
import type { ILayer, LayerEvents, LayerError, Extent } from '../core/index.js';

/**
 * Map void → undefined so that EventBus's `Record<string, unknown>` constraint
 * is satisfied (void is not assignable to unknown in strict mode).
 */
type NormalizedLayerEvents = {
  [K in keyof LayerEvents]: LayerEvents[K] extends void ? undefined : LayerEvents[K];
};

let layerIdCounter = 0;

function generateLayerId(prefix: string): string {
  layerIdCounter += 1;
  return `${prefix}-${layerIdCounter}`;
}

/** Reset counter (for testing only) */
export function _resetLayerIdCounter(): void {
  layerIdCounter = 0;
}

export interface LayerBaseOptions {
  /** Custom layer id (auto-generated if omitted) */
  id?: string;
  /** Initial visibility. Defaults to true. */
  visible?: boolean;
  /** Initial opacity (0-1). Defaults to 1. */
  opacity?: number;
  /** Minimum visible scale */
  minScale?: number;
  /** Maximum visible scale */
  maxScale?: number;
  /** Render ordering — higher values draw on top. Default 0. */
  zIndex?: number;
  /** Whether this layer responds to pointer interactions. Default true. */
  interactive?: boolean;
  /** Raster blend mode. Default 'normal'. */
  blendMode?: 'normal' | 'screen' | 'multiply' | 'overlay';
  /** Post-process color filters for raster tiles. */
  filters?: {
    brightness?: number;
    contrast?: number;
    saturate?: number;
  };
}

export abstract class LayerBase implements ILayer {
  readonly id: string;
  abstract readonly type: string;

  private _visible: boolean;
  private _opacity: number;
  private _loaded = false;
  private _destroyed = false;

  minScale?: number;
  maxScale?: number;
  zIndex?: number;
  interactive: boolean;
  blendMode: 'normal' | 'screen' | 'multiply' | 'overlay';
  filters?: {
    brightness?: number;
    contrast?: number;
    saturate?: number;
  };

  protected _fullExtent?: Extent;
  protected readonly eventBus = new EventBus<NormalizedLayerEvents>();

  constructor(options: LayerBaseOptions = {}) {
    this.id = options.id ?? generateLayerId('layer');
    this._visible = options.visible ?? true;
    this._opacity = options.opacity ?? 1;
    this.minScale = options.minScale;
    this.maxScale = options.maxScale;
    this.zIndex = options.zIndex;
    this.interactive = options.interactive ?? true;
    this.blendMode = options.blendMode ?? 'normal';
    this.filters = options.filters;
  }

  // ─── Visible ───

  get visible(): boolean {
    return this._visible;
  }

  set visible(value: boolean) {
    if (this._visible !== value) {
      this._visible = value;
      this.eventBus.emit('visibility-change', value);
    }
  }

  // ─── Opacity ───

  get opacity(): number {
    return this._opacity;
  }

  set opacity(value: number) {
    const clamped = Math.max(0, Math.min(1, value));
    if (this._opacity !== clamped) {
      this._opacity = clamped;
      this.eventBus.emit('opacity-change', clamped);
    }
  }

  // ─── Loaded state ───

  get loaded(): boolean {
    return this._loaded;
  }

  protected setLoaded(value: boolean): void {
    this._loaded = value;
  }

  // ─── Full Extent ───

  get fullExtent(): Extent | undefined {
    return this._fullExtent;
  }

  // ─── Lifecycle ───

  async load(): Promise<void> {
    if (this._loaded) return;
    if (this._destroyed) {
      throw new Error(`Layer "${this.id}" has been destroyed and cannot be loaded.`);
    }

    try {
      await this.onLoad();
      this._loaded = true;
      this.eventBus.emit('load', undefined);
    } catch (err) {
      const layerError: LayerError = {
        code: 'LAYER_LOAD_FAILED',
        message: err instanceof Error ? err.message : String(err),
        cause: err instanceof Error ? err : new Error(String(err)),
      };
      this.eventBus.emit('error', layerError);
      throw err;
    }
  }

  /** Subclass must implement actual loading logic */
  protected abstract onLoad(): Promise<void>;

  refresh(): void {
    this.eventBus.emit('refresh', undefined);
  }

  /**
   * Signal that the layer's visual style has changed (e.g. renderer update)
   * without clearing data or resetting load state.
   *
   * Emits the same 'refresh' event so that any listening render cache
   * (e.g. VectorBufferCache) is invalidated and the map repaints.
   * Unlike {@link refresh}, this does NOT clear features or mark the
   * layer as unloaded.
   */
  redraw(): void {
    this.eventBus.emit('refresh', undefined);
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._loaded = false;
    this.eventBus.removeAll();
  }

  // ─── Event delegation ───

  on<K extends keyof LayerEvents>(
    event: K,
    handler: (data: LayerEvents[K]) => void,
  ): void {
    this.eventBus.on(
      event,
      handler as (data: NormalizedLayerEvents[keyof NormalizedLayerEvents]) => void,
    );
  }

  off<K extends keyof LayerEvents>(
    event: K,
    handler: (data: LayerEvents[K]) => void,
  ): void {
    this.eventBus.off(
      event,
      handler as (data: NormalizedLayerEvents[keyof NormalizedLayerEvents]) => void,
    );
  }
}
