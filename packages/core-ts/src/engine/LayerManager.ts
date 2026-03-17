/**
 * LayerManager — Layer lifecycle yönetimi
 *
 * Layer load orchestration (load() çağırma, hata yönetimi).
 * Visibility tracking (zoom bazlı min/maxScale kontrolü).
 * Layer'ın dirty state'ini takip et.
 */

import type { ILayer } from '../interfaces/index.js';
import type { MapError } from '../errors.js';
import { EventBus } from '../events.js';

export interface LayerManagerEvents {
  [key: string]: unknown;
  /** A layer finished loading */
  'layer-loaded': { layerId: string };
  /** A layer failed to load */
  'layer-load-error': { layerId: string; error: MapError };
  /** Layer visibility changed (by zoom or explicit toggle) */
  'layer-visibility-change': { layerId: string; visible: boolean };
  /** Layer dirty state changed */
  'layer-dirty': { layerId: string };
}

interface LayerState {
  layer: ILayer;
  loading: boolean;
  loadError: MapError | null;
  dirty: boolean;
  /** Effective visibility considering zoom constraints */
  effectivelyVisible: boolean;
}

export class LayerManager {
  private _layers = new Map<string, LayerState>();
  private _events = new EventBus<LayerManagerEvents>();
  private _currentZoom = 0;

  // ─── Layer Registration ───

  /**
   * Register a layer and begin loading it.
   * If the layer is already registered, this is a no-op.
   */
  async addLayer(layer: ILayer): Promise<void> {
    if (this._layers.has(layer.id)) return;

    const state: LayerState = {
      layer,
      loading: false,
      loadError: null,
      dirty: true,
      effectivelyVisible: this._isVisibleAtZoom(layer, this._currentZoom),
    };

    this._layers.set(layer.id, state);
    await this._loadLayer(state);
  }

  /**
   * Unregister a layer. Calls destroy() on the layer.
   */
  removeLayer(layerId: string): void {
    const state = this._layers.get(layerId);
    if (!state) return;
    state.layer.destroy();
    this._layers.delete(layerId);
  }

  /**
   * Remove all layers.
   */
  removeAll(): void {
    for (const state of this._layers.values()) {
      state.layer.destroy();
    }
    this._layers.clear();
  }

  /**
   * Get a registered layer by id.
   */
  getLayer(layerId: string): ILayer | undefined {
    return this._layers.get(layerId)?.layer;
  }

  /**
   * Get all registered layer ids.
   */
  getLayerIds(): string[] {
    return Array.from(this._layers.keys());
  }

  // ─── Zoom & Visibility ───

  /**
   * Update the current zoom level and re-evaluate visibility for all layers.
   */
  setCurrentZoom(zoom: number): void {
    this._currentZoom = zoom;
    for (const [layerId, state] of this._layers) {
      const wasVisible = state.effectivelyVisible;
      state.effectivelyVisible = this._isVisibleAtZoom(state.layer, zoom);

      if (wasVisible !== state.effectivelyVisible) {
        this._events.emit('layer-visibility-change', {
          layerId,
          visible: state.effectivelyVisible,
        });
        state.dirty = true;
      }
    }
  }

  /**
   * Check if a layer is effectively visible (considering zoom constraints).
   */
  isLayerVisible(layerId: string): boolean {
    const state = this._layers.get(layerId);
    return state ? state.effectivelyVisible : false;
  }

  // ─── Dirty Tracking ───

  /**
   * Mark a layer as dirty (needs re-render).
   */
  markDirty(layerId: string): void {
    const state = this._layers.get(layerId);
    if (state) {
      state.dirty = true;
      this._events.emit('layer-dirty', { layerId });
    }
  }

  /**
   * Get all dirty layer ids.
   */
  getDirtyLayers(): string[] {
    const result: string[] = [];
    for (const [layerId, state] of this._layers) {
      if (state.dirty && state.effectivelyVisible) {
        result.push(layerId);
      }
    }
    return result;
  }

  /**
   * Clear dirty flag for a specific layer.
   */
  clearDirty(layerId: string): void {
    const state = this._layers.get(layerId);
    if (state) {
      state.dirty = false;
    }
  }

  /**
   * Clear dirty flags for all layers.
   */
  clearAllDirty(): void {
    for (const state of this._layers.values()) {
      state.dirty = false;
    }
  }

  /**
   * Returns true if any registered layer is dirty.
   */
  hasAnyDirty(): boolean {
    for (const state of this._layers.values()) {
      if (state.dirty && state.effectivelyVisible) {
        return true;
      }
    }
    return false;
  }

  // ─── Events ───

  on<K extends keyof LayerManagerEvents>(
    event: K,
    handler: (data: LayerManagerEvents[K]) => void,
  ): void {
    this._events.on(event, handler);
  }

  off<K extends keyof LayerManagerEvents>(
    event: K,
    handler: (data: LayerManagerEvents[K]) => void,
  ): void {
    this._events.off(event, handler);
  }

  // ─── Lifecycle ───

  destroy(): void {
    this.removeAll();
    this._events.removeAll();
  }

  // ─── Private ───

  private async _loadLayer(state: LayerState): Promise<void> {
    if (state.layer.loaded || state.loading) return;

    state.loading = true;
    try {
      await state.layer.load();
      state.loading = false;
      state.dirty = true;
      this._events.emit('layer-loaded', { layerId: state.layer.id });
    } catch (err) {
      state.loading = false;
      const mapError: MapError = {
        kind: 'layer-load-failed',
        layerId: state.layer.id,
        cause: err instanceof Error ? err : new Error(String(err)),
      };
      state.loadError = mapError;
      this._events.emit('layer-load-error', {
        layerId: state.layer.id,
        error: mapError,
      });
    }
  }

  /**
   * Determine visibility based on zoom level and layer min/maxScale.
   *
   * Scale denominator at zoom level z = 559082264.028717 / 2^z.
   * A layer is visible when: minScale >= currentScale >= maxScale.
   * (minScale is a large number = zoomed out, maxScale is small = zoomed in)
   */
  private _isVisibleAtZoom(layer: ILayer, zoom: number): boolean {
    if (!layer.visible) return false;

    const scaleDenom = 559082264.028717 / Math.pow(2, zoom);

    if (layer.minScale !== undefined && layer.minScale > 0) {
      if (scaleDenom > layer.minScale) return false;
    }

    if (layer.maxScale !== undefined && layer.maxScale > 0) {
      if (scaleDenom < layer.maxScale) return false;
    }

    return true;
  }
}
