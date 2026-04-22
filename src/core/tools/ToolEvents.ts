/**
 * ToolEvents — Typed event map for tool system.
 *
 * Used by ToolManager's EventBus for type-safe event dispatch.
 */

import type { Feature, Geometry } from '../interfaces/ILayer.js';

export interface ToolEvents {
  [key: string]: unknown;

  /** Fired when a tool is activated. */
  'tool-activate': { toolId: string };
  /** Fired when a tool is deactivated. */
  'tool-deactivate': { toolId: string };
  /** Fired when drawing starts (first vertex placed). */
  'draw-start': { toolId: string; geometry: Geometry };
  /** Fired when a vertex is added during drawing. */
  'vertex-add': { toolId: string; coords: [number, number]; vertexIndex: number };
  /** Fired when a vertex is removed during drawing. */
  'vertex-remove': { toolId: string; vertexIndex: number };
  /** Fired when drawing completes (feature finalized). */
  'draw-complete': { toolId: string; feature: Feature };
  /** Fired when drawing is cancelled (Escape). */
  'draw-cancel': { toolId: string };
  /** Fired on cursor movement with map coordinates. */
  'cursor-move': { screenX: number; screenY: number; mapCoords: [number, number] | null };
  /** Fired when a feature is selected in edit mode. */
  'feature-select': { feature: Feature; layerId: string };
  /** Fired when a feature is updated in edit mode. */
  'feature-update': { feature: Feature; layerId: string };
  /** Fired when undo/redo availability changes. */
  'history-change': { canUndo: boolean; canRedo: boolean };

  /** Fired when a measurement is completed. */
  'measure-complete': {
    toolId: string;
    type: 'point' | 'distance' | 'area';
    result: MeasurementResult;
  };
  /** Fired when measurements are cleared. */
  'measure-clear': { toolId: string };

  /** Fired when LOS analysis completes (observer + target placed or updated). */
  'los-update': {
    toolId: string;
    observer: [number, number];
    target: [number, number];
    observerOffset: number;
    targetOffset: number;
    result: import('../interfaces/IAnalysis.js').LosAnalysisResult;
  };
  /** Fired when LOS analysis is cleared. */
  'los-clear': { toolId: string };
}

export interface MeasurementResult {
  coordinates?: [number, number];
  totalDistance?: number;
  segmentDistances?: number[];
  area?: number;
  perimeter?: number;
  vertices: [number, number][];
}
