/**
 * Coordinates — React wrapper for CoordinatesWidget.
 *
 * Displays cursor coordinates on the map.
 *
 * Usage:
 *   <MapView>
 *     <Coordinates position="bottom-right" format="DD" />
 *   </MapView>
 */

import { useEffect, useRef } from 'react';
import { CoordinatesWidget } from '../../widgets/index.js';
import type { CoordinateFormat } from '../../widgets/index.js';
import type { WidgetPosition } from '../../core/index.js';
import { useMap } from '../useMap.js';

export interface CoordinatesProps {
  /** Widget position on the map */
  position?: WidgetPosition;
  /** Coordinate display format */
  format?: CoordinateFormat;
}

export function Coordinates({
  position = 'bottom-right',
  format,
}: CoordinatesProps): null {
  const { view } = useMap();
  const widgetRef = useRef<CoordinatesWidget | null>(null);

  useEffect(() => {
    if (!view) return;

    const container = (view as unknown as { _container?: HTMLElement | null })
      ._container ?? document.body;

    const widget = new CoordinatesWidget({
      position,
      format,
    });

    widget.mount(container);

    // Wire up screen-to-map conversion
    widget.screenToMap = (x: number, y: number) => view.toMap(x, y) ?? [0, 0];

    // Start listening on the container for mouse moves
    widget.listenTo(container);

    widgetRef.current = widget;

    return () => {
      widget.destroy();
      widgetRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Update format
  useEffect(() => {
    if (widgetRef.current && format !== undefined) {
      widgetRef.current.format = format;
    }
  }, [format]);

  return null;
}
