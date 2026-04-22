/**
 * useMap — Hook to access the MapView and GameMap from MapContext.
 *
 * Usage:
 *   const { view, map } = useMap();
 */

import { useContext } from 'react';
import type { MapView as CoreMapView, GameMap } from '../core/index.js';
import { MapContext } from './MapContext.js';

export interface UseMapResult {
  /** The MapView instance (null if view is not yet ready) */
  view: CoreMapView | null;
  /** The GameMap layer collection (null if view is not yet ready) */
  map: GameMap | null;
}

export function useMap(): UseMapResult {
  const context = useContext(MapContext);

  if (context === undefined) {
    throw new Error('useMap must be used within a <MapView> component.');
  }

  return context;
}
