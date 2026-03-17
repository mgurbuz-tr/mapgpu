/**
 * GeoJSONLayer — React wrapper for @mapgpu/layers GeoJSONLayer.
 *
 * Automatically adds/removes the layer from the parent MapView.
 *
 * Usage:
 *   <MapView>
 *     <GeoJSONLayer data={geojsonObject} />
 *     <GeoJSONLayer url="https://example.com/data.geojson" />
 *   </MapView>
 */

import { useEffect, useRef } from 'react';
import { GeoJSONLayer as CoreGeoJSONLayer } from '@mapgpu/layers';
import type { GeoJSONLayerOptions } from '@mapgpu/layers';
import { useMap } from '../useMap.js';

export interface GeoJSONLayerProps {
  /** URL to a GeoJSON file */
  url?: string;
  /** Inline GeoJSON FeatureCollection data */
  data?: GeoJSONLayerOptions['data'];
  /** Custom layer id */
  id?: string;
  /** Layer visibility. Defaults to true */
  visible?: boolean;
  /** Layer opacity (0-1). Defaults to 1 */
  opacity?: number;
}

export function GeoJSONLayer({
  url,
  data,
  id,
  visible = true,
  opacity = 1,
}: GeoJSONLayerProps): null {
  const { map } = useMap();
  const layerRef = useRef<CoreGeoJSONLayer | null>(null);

  // Create and add layer
  useEffect(() => {
    if (!map) return;

    const options: GeoJSONLayerOptions = {
      url,
      data,
      id,
    };

    const layer = new CoreGeoJSONLayer(options);
    layer.visible = visible;
    layer.opacity = opacity;
    layerRef.current = layer;

    map.add(layer);

    return () => {
      map.remove(layer);
      layer.destroy();
      layerRef.current = null;
    };
    // Re-create layer when data source or identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, url, data, id]);

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
