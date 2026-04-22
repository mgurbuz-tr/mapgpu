/**
 * BasemapGallery — React wrapper for BasemapGalleryWidget.
 *
 * Displays a gallery of basemap options.
 *
 * Usage:
 *   <MapView>
 *     <BasemapGallery
 *       position="bottom-right"
 *       basemaps={[{ id: 'osm', title: 'OpenStreetMap' }]}
 *       onSelect={(basemap) => console.log(basemap)}
 *     />
 *   </MapView>
 */

import { useEffect, useRef } from 'react';
import { BasemapGalleryWidget } from '../../widgets/index.js';
import type { BasemapItem } from '../../widgets/index.js';
import type { WidgetPosition } from '../../core/index.js';
import { useMap } from '../useMap.js';

export interface BasemapGalleryProps {
  /** Widget position on the map */
  position?: WidgetPosition;
  /** Available basemaps */
  basemaps?: BasemapItem[];
  /** Initially active basemap id */
  activeBasemapId?: string;
  /** Called when a basemap is selected */
  onSelect?: (basemap: BasemapItem) => void;
}

export function BasemapGallery({
  position = 'bottom-right',
  basemaps,
  activeBasemapId,
  onSelect,
}: BasemapGalleryProps): null {
  const { view } = useMap();
  const widgetRef = useRef<BasemapGalleryWidget | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!view) return;

    const container = (view as unknown as { _container?: HTMLElement | null })
      ._container ?? document.body;

    const widget = new BasemapGalleryWidget({
      position,
      basemaps,
      activeBasemapId,
    });

    widget.mount(container);

    const handler = (basemap: BasemapItem): void => {
      onSelectRef.current?.(basemap);
    };
    widget.onSelect(handler);

    widgetRef.current = widget;

    return () => {
      widget.offSelect(handler);
      widget.destroy();
      widgetRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Update basemaps
  useEffect(() => {
    if (widgetRef.current && basemaps) {
      widgetRef.current.setBasemaps(basemaps);
    }
  }, [basemaps]);

  return null;
}
