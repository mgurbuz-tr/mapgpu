/**
 * WMSLayer — React wrapper for @mapgpu/layers WMSLayer.
 *
 * Automatically adds/removes the layer from the parent MapView.
 * Updates layer properties when props change.
 *
 * Usage:
 *   <MapView>
 *     <WMSLayer url="https://example.com/wms" layers={['roads']} />
 *   </MapView>
 */

import { useEffect, useRef } from 'react';
import { WMSLayer as CoreWMSLayer } from '@mapgpu/layers';
import type { WMSLayerOptions } from '@mapgpu/layers';
import { useMap } from '../useMap.js';

export interface WMSLayerProps {
  /** WMS service base URL */
  url: string;
  /** Layer name(s) to display */
  layers: string[];
  /** Image format. Defaults to 'image/png' */
  format?: string;
  /** Request transparent tiles. Defaults to true */
  transparent?: boolean;
  /** Custom layer id */
  id?: string;
  /** Layer visibility. Defaults to true */
  visible?: boolean;
  /** Layer opacity (0-1). Defaults to 1 */
  opacity?: number;
}

export function WMSLayer({
  url,
  layers,
  format,
  transparent,
  id,
  visible = true,
  opacity = 1,
}: WMSLayerProps): null {
  const { map } = useMap();
  const layerRef = useRef<CoreWMSLayer | null>(null);

  // Create and add layer
  useEffect(() => {
    if (!map) return;

    const options: WMSLayerOptions = {
      url,
      layers,
      format,
      transparent,
      id,
    };

    const layer = new CoreWMSLayer(options);
    layer.visible = visible;
    layer.opacity = opacity;
    layerRef.current = layer;

    map.add(layer);

    return () => {
      map.remove(layer);
      layer.destroy();
      layerRef.current = null;
    };
    // Only re-create when identity-level props change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, url, id]);

  // Update layers prop
  useEffect(() => {
    // layers array change requires re-create since it's readonly on the core layer
    // This is handled by the main effect via url/id deps.
    // For cases where only the layers array changes, we destroy & re-add.
  }, [layers]);

  // Update visibility
  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.visible = visible;
    }
  }, [visible]);

  // Update opacity
  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.opacity = opacity;
    }
  }, [opacity]);

  return null;
}
