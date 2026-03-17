/**
 * LayerListWidget — Displays layers with visibility toggle, opacity slider, and drag-reorder.
 *
 * Subscribes to layer add/remove events via the EventBus pattern.
 */

import type { ILayer, IView, WidgetPosition } from '@mapgpu/core';
import { WidgetBase } from './WidgetBase.js';

export interface LayerListEvents {
  'layer-add': ILayer;
  'layer-remove': ILayer;
  'layer-reorder': { layer: ILayer; newIndex: number };
}

type LayerListEventHandler<K extends keyof LayerListEvents> = (
  data: LayerListEvents[K],
) => void;

export interface LayerListWidgetOptions {
  id?: string;
  position?: WidgetPosition;
}

export class LayerListWidget extends WidgetBase {
  private _layers: ILayer[] = [];
  private _listEl: HTMLUListElement | null = null;
  private _layerEventCleanups: Array<() => void> = [];

  // Event bus for widget-level events
  private _listeners = new Map<keyof LayerListEvents, Set<LayerListEventHandler<keyof LayerListEvents>>>();

  constructor(options?: LayerListWidgetOptions) {
    super('layerlist', options);
  }

  get layers(): ReadonlyArray<ILayer> {
    return this._layers;
  }

  addLayer(layer: ILayer): void {
    if (this._layers.some((l) => l.id === layer.id)) return;
    this._layers.push(layer);
    this._subscribeLayerEvents(layer);
    this.emitEvent('layer-add', layer);
    this._rebuildList();
  }

  removeLayer(layerOrId: ILayer | string): void {
    const id = typeof layerOrId === 'string' ? layerOrId : layerOrId.id;
    const idx = this._layers.findIndex((l) => l.id === id);
    if (idx === -1) return;
    const removed = this._layers.splice(idx, 1)[0];
    if (removed) {
      this.emitEvent('layer-remove', removed);
    }
    this._rebuildList();
  }

  reorderLayer(layerId: string, newIndex: number): void {
    const idx = this._layers.findIndex((l) => l.id === layerId);
    if (idx === -1) return;

    const clampedIndex = Math.max(0, Math.min(newIndex, this._layers.length - 1));
    const [layer] = this._layers.splice(idx, 1);
    if (!layer) return;
    this._layers.splice(clampedIndex, 0, layer);
    this.emitEvent('layer-reorder', { layer, newIndex: clampedIndex });
    this._rebuildList();
  }

  on<K extends keyof LayerListEvents>(event: K, handler: LayerListEventHandler<K>): void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(handler as LayerListEventHandler<keyof LayerListEvents>);
  }

  off<K extends keyof LayerListEvents>(event: K, handler: LayerListEventHandler<K>): void {
    this._listeners.get(event)?.delete(handler as LayerListEventHandler<keyof LayerListEvents>);
  }

  protected render(root: HTMLElement): void {
    root.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
    root.style.borderRadius = '4px';
    root.style.padding = '8px';
    root.style.minWidth = '200px';
    root.style.fontFamily = 'sans-serif';
    root.style.fontSize = '13px';
    root.style.boxShadow = '0 1px 4px rgba(0,0,0,0.2)';

    const title = document.createElement('div');
    title.textContent = 'Layers';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '6px';
    title.style.fontSize = '14px';
    root.appendChild(title);

    this._listEl = document.createElement('ul');
    this._listEl.style.listStyle = 'none';
    this._listEl.style.padding = '0';
    this._listEl.style.margin = '0';
    root.appendChild(this._listEl);

    this._rebuildList();
  }

  protected onViewBound(_view: IView): void {
    // Re-render if already mounted
    if (this._root) {
      this._rebuildList();
    }
  }

  protected onDestroy(): void {
    for (const cleanup of this._layerEventCleanups) {
      cleanup();
    }
    this._layerEventCleanups = [];
    this._listeners.clear();
    this._layers = [];
    this._listEl = null;
  }

  private _subscribeLayerEvents(layer: ILayer): void {
    const onVisChange = (visible: boolean): void => {
      void visible;
      this._updateLayerItem(layer);
    };
    const onOpacityChange = (opacity: number): void => {
      void opacity;
      this._updateLayerItem(layer);
    };

    layer.on('visibility-change', onVisChange);
    layer.on('opacity-change', onOpacityChange);

    this._layerEventCleanups.push(() => {
      layer.off('visibility-change', onVisChange);
      layer.off('opacity-change', onOpacityChange);
    });
  }

  private _updateLayerItem(layer: ILayer): void {
    if (!this._listEl) return;
    const li = this._listEl.querySelector(`[data-layer-id="${layer.id}"]`);
    if (!li) return;

    const checkbox = li.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    if (checkbox) {
      checkbox.checked = layer.visible;
    }

    const slider = li.querySelector('input[type="range"]') as HTMLInputElement | null;
    if (slider) {
      slider.value = String(Math.round(layer.opacity * 100));
    }
  }

  private _rebuildList(): void {
    if (!this._listEl) return;
    this._listEl.innerHTML = '';

    for (const layer of this._layers) {
      const li = document.createElement('li');
      li.setAttribute('data-layer-id', layer.id);
      li.style.display = 'flex';
      li.style.alignItems = 'center';
      li.style.gap = '6px';
      li.style.padding = '4px 0';
      li.style.borderBottom = '1px solid #eee';
      li.draggable = true;

      // Drag events
      li.addEventListener('dragstart', (e) => {
        e.dataTransfer?.setData('text/plain', layer.id);
      });
      li.addEventListener('dragover', (e) => {
        e.preventDefault();
      });
      li.addEventListener('drop', (e) => {
        e.preventDefault();
        const draggedId = e.dataTransfer?.getData('text/plain');
        if (draggedId && draggedId !== layer.id) {
          const targetIdx = this._layers.findIndex((l) => l.id === layer.id);
          if (targetIdx !== -1) {
            this.reorderLayer(draggedId, targetIdx);
          }
        }
      });

      // Visibility checkbox
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = layer.visible;
      checkbox.addEventListener('change', () => {
        layer.visible = checkbox.checked;
      });
      li.appendChild(checkbox);

      // Layer name
      const label = document.createElement('span');
      label.textContent = layer.id;
      label.style.flex = '1';
      label.style.overflow = 'hidden';
      label.style.textOverflow = 'ellipsis';
      label.style.whiteSpace = 'nowrap';
      li.appendChild(label);

      // Opacity slider
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '0';
      slider.max = '100';
      slider.value = String(Math.round(layer.opacity * 100));
      slider.style.width = '60px';
      slider.addEventListener('input', () => {
        layer.opacity = parseInt(slider.value, 10) / 100;
      });
      li.appendChild(slider);

      this._listEl.appendChild(li);
    }
  }

  private emitEvent<K extends keyof LayerListEvents>(event: K, data: LayerListEvents[K]): void {
    const handlers = this._listeners.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      handler(data);
    }
  }
}
