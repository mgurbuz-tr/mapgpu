/**
 * LayerList — React wrapper for LayerListWidget.
 *
 * Mounts/unmounts the widget and syncs layers from the map.
 *
 * Usage:
 *   <MapView>
 *     <LayerList position="top-right" />
 *   </MapView>
 */

import { useEffect, useRef } from 'react';
import { LayerListWidget } from '@mapgpu/widgets';
import type { ILayer, WidgetPosition } from '@mapgpu/core';
import { useMap } from '../useMap.js';

export interface LayerListProps {
  /** Widget position on the map */
  position?: WidgetPosition;
}

export function LayerList({
  position = 'top-right',
}: LayerListProps): null {
  const { view, map } = useMap();
  const widgetRef = useRef<LayerListWidget | null>(null);

  useEffect(() => {
    if (!view || !map) return;

    const container = (view as unknown as { _container?: HTMLElement | null })
      ._container ?? document.body;

    const widget = new LayerListWidget({ position });
    widget.mount(container as HTMLElement);
    widgetRef.current = widget;

    // Sync existing layers
    for (const layer of map.layers) {
      widget.addLayer(layer);
    }

    // Listen for layer changes
    const onAdd = ({ layer }: { layer: ILayer }): void => {
      widget.addLayer(layer);
    };
    const onRemove = ({ layer }: { layer: ILayer }): void => {
      widget.removeLayer(layer.id);
    };

    view.on('layer-add', onAdd);
    view.on('layer-remove', onRemove);

    return () => {
      view.off('layer-add', onAdd);
      view.off('layer-remove', onRemove);
      widget.destroy();
      widgetRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, map]);

  return null;
}
