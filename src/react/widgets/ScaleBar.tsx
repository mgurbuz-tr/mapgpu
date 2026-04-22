/**
 * ScaleBar — React wrapper for ScaleBarWidget.
 *
 * Mounts/unmounts the widget into the map container.
 *
 * Usage:
 *   <MapView>
 *     <ScaleBar position="bottom-left" unit="metric" />
 *   </MapView>
 */

import { useEffect, useRef } from 'react';
import { ScaleBarWidget } from '../../widgets/index.js';
import type { ScaleBarUnit } from '../../widgets/index.js';
import type { WidgetPosition } from '../../core/index.js';
import { useMap } from '../useMap.js';

export interface ScaleBarProps {
  /** Widget position on the map */
  position?: WidgetPosition;
  /** Scale bar unit: 'metric' | 'imperial' | 'dual' */
  unit?: ScaleBarUnit;
  /** Maximum bar width in pixels */
  maxWidthPx?: number;
}

export function ScaleBar({
  position = 'bottom-left',
  unit,
  maxWidthPx,
}: ScaleBarProps): null {
  const { view } = useMap();
  const widgetRef = useRef<ScaleBarWidget | null>(null);

  useEffect(() => {
    if (!view) return;

    const container = (view as unknown as { _container?: HTMLElement | null })
      ._container ?? document.body;

    const widget = new ScaleBarWidget({
      position,
      unit,
      maxWidthPx,
    });

    widget.mount(container);
    widgetRef.current = widget;

    return () => {
      widget.destroy();
      widgetRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Update unit
  useEffect(() => {
    if (widgetRef.current && unit !== undefined) {
      widgetRef.current.unit = unit;
    }
  }, [unit]);

  return null;
}
