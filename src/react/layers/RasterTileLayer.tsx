/**
 * RasterTileLayer — React wrapper for @mapgpu/layers RasterTileLayer.
 *
 * Automatically adds/removes the layer from the parent MapView.
 *
 * Usage:
 *   <MapView>
 *     <RasterTileLayer urlTemplate="https://tile.osm.org/{z}/{x}/{y}.png" />
 *   </MapView>
 */

import { useEffect, useRef } from 'react';
import { RasterTileLayer as CoreRasterTileLayer } from '../../layers/index.js';
import type { RasterTileLayerOptions } from '../../layers/index.js';
import { useMap } from '../useMap.js';

export interface RasterTileLayerProps {
  /** URL template with {z}, {x}, {y}, {s} placeholders */
  urlTemplate: string;
  /** Use TMS y-flip convention. Defaults to false */
  tms?: boolean;
  /** Subdomains for load balancing */
  subdomains?: string[];
  /** Minimum zoom level */
  minZoom?: number;
  /** Maximum zoom level */
  maxZoom?: number;
  /** Attribution text */
  attribution?: string;
  /** Custom layer id */
  id?: string;
  /** Layer visibility. Defaults to true */
  visible?: boolean;
  /** Layer opacity (0-1). Defaults to 1 */
  opacity?: number;
}

export function RasterTileLayer({
  urlTemplate,
  tms,
  subdomains,
  minZoom,
  maxZoom,
  attribution,
  id,
  visible = true,
  opacity = 1,
}: RasterTileLayerProps): null {
  const { map } = useMap();
  const layerRef = useRef<CoreRasterTileLayer | null>(null);

  // Create and add layer
  useEffect(() => {
    if (!map) return;

    const options: RasterTileLayerOptions = {
      urlTemplate,
      tms,
      subdomains,
      minZoom,
      maxZoom,
      attribution,
      id,
    };

    const layer = new CoreRasterTileLayer(options);
    layer.visible = visible;
    layer.opacity = opacity;
    layerRef.current = layer;

    map.add(layer);

    return () => {
      map.remove(layer);
      layer.destroy();
      layerRef.current = null;
    };
    // Re-create when url template or identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, urlTemplate, id]);

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
