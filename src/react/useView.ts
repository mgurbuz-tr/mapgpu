/**
 * useView — Hook that provides reactive view state (center, zoom, mode, etc.).
 *
 * Subscribes to the 'view-change' event on the MapView and returns
 * the latest view state values.
 *
 * Usage:
 *   const { center, zoom, rotation, pitch, bearing, mode } = useView();
 */

import { useState, useEffect } from 'react';
import { useMap } from './useMap.js';

export interface ViewState {
  /** Current center [longitude, latitude] */
  center: [number, number];
  /** Current zoom level */
  zoom: number;
  /** Current rotation in degrees (2D mode) */
  rotation: number;
  /** Current pitch in degrees (3D mode) */
  pitch: number;
  /** Current bearing in degrees (3D mode) */
  bearing: number;
  /** Active rendering mode */
  mode: '2d' | '3d';
}

export function useView(): ViewState {
  const { view } = useMap();

  const [state, setState] = useState<ViewState>(() => ({
    center: view?.center ?? [0, 0],
    zoom: view?.zoom ?? 0,
    rotation: view?.rotation ?? 0,
    pitch: view?.pitch ?? 0,
    bearing: view?.bearing ?? 0,
    mode: view?.mode ?? '2d',
  }));

  useEffect(() => {
    if (!view) return;

    // Sync initial state
    setState({
      center: view.center,
      zoom: view.zoom,
      rotation: view.rotation,
      pitch: view.pitch,
      bearing: view.bearing,
      mode: view.mode,
    });

    const handler = (data: {
      center: [number, number];
      zoom: number;
      pitch: number;
      bearing: number;
      rotation: number;
      mode: '2d' | '3d';
    }): void => {
      setState({
        center: data.center,
        zoom: data.zoom,
        rotation: data.rotation,
        pitch: data.pitch,
        bearing: data.bearing,
        mode: data.mode,
      });
    };

    view.on('view-change', handler);

    return () => {
      view.off('view-change', handler);
    };
  }, [view]);

  return state;
}
