/**
 * LayerGroup — A container for managing multiple layers as a unit (Leaflet L.layerGroup equivalent).
 *
 * Operations on the group (visibility, opacity) cascade to all child layers.
 */

import type { ILayer } from '@mapgpu/core';
import { LayerBase } from './LayerBase.js';
import type { LayerBaseOptions } from './LayerBase.js';

export interface LayerGroupOptions extends LayerBaseOptions {
  /** Initial layers to include in the group. */
  layers?: ILayer[];
}

export class LayerGroup extends LayerBase {
  readonly type = 'layer-group';
  private _layers: ILayer[] = [];

  constructor(options?: LayerGroupOptions) {
    super(options);
    if (options?.layers) {
      this._layers = [...options.layers];
    }
  }

  protected async onLoad(): Promise<void> {
    await Promise.all(this._layers.map(l => l.load()));
  }

  /** Add a layer to the group. */
  addLayer(layer: ILayer): this {
    if (!this._layers.includes(layer)) {
      this._layers.push(layer);
    }
    return this;
  }

  /** Remove a layer from the group. */
  removeLayer(layerOrId: ILayer | string): this {
    const id = typeof layerOrId === 'string' ? layerOrId : layerOrId.id;
    this._layers = this._layers.filter(l => l.id !== id);
    return this;
  }

  /** Check if a layer is in the group. */
  hasLayer(layerOrId: ILayer | string): boolean {
    const id = typeof layerOrId === 'string' ? layerOrId : layerOrId.id;
    return this._layers.some(l => l.id === id);
  }

  /** Get a layer by ID. */
  getLayer(id: string): ILayer | undefined {
    return this._layers.find(l => l.id === id);
  }

  /** Get all layers in the group. */
  getLayers(): readonly ILayer[] {
    return this._layers;
  }

  /** Number of layers in the group. */
  get count(): number {
    return this._layers.length;
  }

  /** Cascade visibility to all child layers. */
  override set visible(v: boolean) {
    super.visible = v;
    for (const layer of this._layers) {
      layer.visible = v;
      layer.refresh();
    }
  }

  override get visible(): boolean {
    return super.visible;
  }

  /** Cascade opacity to all child layers. */
  override set opacity(o: number) {
    super.opacity = o;
    for (const layer of this._layers) {
      layer.opacity = o;
      layer.refresh();
    }
  }

  override get opacity(): number {
    return super.opacity;
  }

  /** Remove all layers from the group. */
  clearLayers(): this {
    this._layers = [];
    return this;
  }

  /** Iterate over all layers. */
  eachLayer(fn: (layer: ILayer) => void): this {
    for (const layer of this._layers) fn(layer);
    return this;
  }

  override destroy(): void {
    for (const layer of this._layers) layer.destroy();
    this._layers = [];
    super.destroy();
  }
}
