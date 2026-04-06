/**
 * MapView — Main React component for rendering a 2D/3D map.
 *
 * Creates and manages a unified MapView instance. Provides MapContext to children
 * so that layer/widget components can access the view.
 *
 * Usage:
 *   <MapView center={[28.97, 41.0]} zoom={12} mode="2d">
 *     <WMSLayer url="..." layers={[...]} />
 *   </MapView>
 */

import {
  useRef,
  useEffect,
  useState,
  useMemo,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { MapView as CoreMapView, MapGpuError } from '@mapgpu/core';
import type { MapViewOptions } from '@mapgpu/core';
import { MapContext } from './MapContext.js';
import type { MapContextValue } from './MapContext.js';

export interface MapViewProps {
  /** Initial center [longitude, latitude] in EPSG:4326 */
  center?: [number, number];
  /** Initial zoom level */
  zoom?: number;
  /** Initial rotation in degrees */
  rotation?: number;
  /** Rendering mode: '2d' for flat Mercator, '3d' for globe/terrain */
  mode?: '2d' | '3d';
  /** Pitch angle in degrees (3D mode only) */
  pitch?: number;
  /** Bearing/heading in degrees (3D mode only) */
  bearing?: number;
  /** CSS class name for the container div */
  className?: string;
  /** Inline styles for the container div */
  style?: CSSProperties;
  /** Called when the view is ready */
  onViewReady?: (view: CoreMapView) => void;
  /** Called when an error occurs */
  onError?: (error: Error) => void;
  /** Child components (layers, widgets, etc.) */
  children?: ReactNode;
}

export function MapView({
  center,
  zoom,
  rotation,
  mode,
  pitch,
  bearing,
  className,
  style,
  onViewReady,
  onError,
  children,
}: MapViewProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<CoreMapView | null>(null);

  // Create MapView on mount, destroy on unmount
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let destroyed = false;
    let instance: CoreMapView | null = null;

    try {
      const options: MapViewOptions = {
        container,
        center,
        zoom,
        rotation,
        mode,
      };

      instance = new CoreMapView(options);

      instance.when().then(() => {
        if (!destroyed) {
          setView(instance);
          onViewReady?.(instance!);
        }
      }).catch((err: unknown) => {
        if (!destroyed) {
          onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      });

      instance.on('error', (mapError) => {
        if (!destroyed) {
          onError?.(new MapGpuError(mapError));
        }
      });
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }

    return () => {
      destroyed = true;
      if (instance) {
        instance.destroy();
      }
      setView(null);
    };
    // Only run on mount/unmount — initial props are captured once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update center when prop changes (after initial mount)
  useEffect(() => {
    if (view && center) {
      void view.goTo({ center, duration: 0 });
    }
  }, [view, center]);

  // Update zoom when prop changes
  useEffect(() => {
    if (view && zoom !== undefined) {
      void view.goTo({ zoom, duration: 0 });
    }
  }, [view, zoom]);

  // Update rotation when prop changes
  useEffect(() => {
    if (view && rotation !== undefined) {
      void view.goTo({ rotation, duration: 0 });
    }
  }, [view, rotation]);

  // Update pitch when prop changes (3D mode)
  useEffect(() => {
    if (view && pitch !== undefined) {
      void view.goTo({ pitch, duration: 0 });
    }
  }, [view, pitch]);

  // Update bearing when prop changes (3D mode)
  useEffect(() => {
    if (view && bearing !== undefined) {
      void view.goTo({ bearing, duration: 0 });
    }
  }, [view, bearing]);

  const contextValue = useMemo<MapContextValue>(
    () => ({
      view,
      map: view?.map ?? null,
    }),
    [view],
  );

  const containerStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    ...style,
  };

  return (
    <div ref={containerRef} className={className} style={containerStyle}>
      <MapContext.Provider value={contextValue}>
        {children}
      </MapContext.Provider>
    </div>
  );
}
