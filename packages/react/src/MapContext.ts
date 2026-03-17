/**
 * MapContext — React context for sharing the MapView instance.
 *
 * Provides the view (MapView) and map (GameMap) to child components
 * such as layer and widget wrappers.
 */

import { createContext } from 'react';
import type { MapView as CoreMapView, GameMap } from '@mapgpu/core';

export interface MapContextValue {
  /** The MapView instance (null while initializing) */
  view: CoreMapView | null;
  /** The GameMap layer collection (null while initializing) */
  map: GameMap | null;
}

export const MapContext = createContext<MapContextValue>({
  view: null,
  map: null,
});
