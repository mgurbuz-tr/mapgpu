/**
 * Map — Layer koleksiyonu
 *
 * Layer ekleme/çıkarma, z-order yönetimi.
 * Event'ler: layer-add, layer-remove, layer-reorder.
 */

import type { ILayer } from '../interfaces/index.js';
import { EventBus } from '../events.js';

export interface MapEvents {
  [key: string]: unknown;
  'layer-add': { layer: ILayer; index: number };
  'layer-remove': { layer: ILayer; index: number };
  'layer-reorder': { layer: ILayer; fromIndex: number; toIndex: number };
}

export class GameMap {
  private _layers: ILayer[] = [];
  private _events = new EventBus<MapEvents>();

  /**
   * Read-only view of the layer stack (bottom-to-top draw order).
   */
  get layers(): readonly ILayer[] {
    return this._layers;
  }

  /**
   * Add a layer to the top of the layer stack.
   *
   * If the layer is a LayerGroup (`type === 'layer-group'`), its child
   * layers are flattened into the stack so the render system can see them.
   * The group itself is also stored so visibility/opacity cascading works.
   */
  add(layer: ILayer): void {
    // Prevent duplicate
    if (this._layers.some((l) => l.id === layer.id)) return;

    // Flatten LayerGroup children into the map so the render pipeline can see them
    if (layer.type === 'layer-group') {
      const group = layer as ILayer & { getLayers?: () => readonly ILayer[] };
      if (group.getLayers) {
        for (const child of group.getLayers()) {
          this.add(child);
        }
      }
      // Store the group itself for visibility/opacity cascading
      this._layers.push(layer);
      this._events.emit('layer-add', { layer, index: this._layers.length - 1 });
      return;
    }

    const index = this._layers.length;
    this._layers.push(layer);
    this._events.emit('layer-add', { layer, index });
  }

  /**
   * Remove a layer from the stack.
   * Returns the removed layer, or undefined if not found.
   * If the layer is a LayerGroup, its children are also removed.
   */
  remove(layer: ILayer): ILayer | undefined {
    // Remove LayerGroup children first
    if (layer.type === 'layer-group') {
      const group = layer as ILayer & { getLayers?: () => readonly ILayer[] };
      if (group.getLayers) {
        for (const child of group.getLayers()) {
          this.remove(child);
        }
      }
    }

    const index = this._layers.findIndex((l) => l.id === layer.id);
    if (index === -1) return undefined;

    const [removed] = this._layers.splice(index, 1);
    if (removed) {
      this._events.emit('layer-remove', { layer: removed, index });
    }
    return removed;
  }

  /**
   * Find a layer by its id.
   */
  findLayerById(id: string): ILayer | undefined {
    return this._layers.find((l) => l.id === id);
  }

  /**
   * Reorder a layer to the given index (z-order).
   * Index 0 = bottom (drawn first), length-1 = top (drawn last).
   */
  reorder(layer: ILayer, toIndex: number): void {
    const fromIndex = this._layers.findIndex((l) => l.id === layer.id);
    if (fromIndex === -1) return;

    // Clamp target index
    const clampedIndex = Math.max(0, Math.min(this._layers.length - 1, toIndex));

    if (fromIndex === clampedIndex) return;

    // Remove from current position
    this._layers.splice(fromIndex, 1);
    // Insert at new position
    this._layers.splice(clampedIndex, 0, layer);

    this._events.emit('layer-reorder', { layer, fromIndex, toIndex: clampedIndex });
  }

  /**
   * Remove all layers.
   */
  removeAll(): void {
    // Remove from top to bottom to generate correct events
    while (this._layers.length > 0) {
      const layer = this._layers.pop();
      if (layer) {
        this._events.emit('layer-remove', { layer, index: this._layers.length });
      }
    }
  }

  // ─── Events ───

  on<K extends keyof MapEvents>(
    event: K,
    handler: (data: MapEvents[K]) => void,
  ): void {
    this._events.on(event, handler);
  }

  off<K extends keyof MapEvents>(
    event: K,
    handler: (data: MapEvents[K]) => void,
  ): void {
    this._events.off(event, handler);
  }

  // ─── Lifecycle ───

  destroy(): void {
    this.removeAll();
    this._events.removeAll();
  }
}
