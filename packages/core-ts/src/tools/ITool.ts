/**
 * ITool — Drawing/editing tool interface contract.
 *
 * Strategy pattern: each tool implements this interface and is managed
 * by ToolManager. Tools receive pointer events, manage their own state
 * machine, and render previews via IPreviewLayer.
 */

import type { Feature, Geometry } from '../interfaces/ILayer.js';
import type { CommandSystem } from '../engine/CommandSystem.js';
import type { ToolEvents } from './ToolEvents.js';

// ─── Tool State & Cursor ───

export type ToolState = 'idle' | 'active' | 'drawing' | 'editing';
export type ToolCursor = 'default' | 'crosshair' | 'pointer' | 'grab' | 'move' | (string & {});

// ─── Preview Layer ───

/** Subset of GraphicsLayer used for tool preview rendering (rubber-band, vertex handles). */
export interface IPreviewLayer {
  add(feature: Feature): void;
  remove(id: string | number): boolean;
  clear(): void;
  readonly graphics: readonly Feature[];
}

// ─── Tool Pointer Event ───

export interface ToolPointerEvent {
  /** Pointer X position relative to the canvas. */
  screenX: number;
  /** Pointer Y position relative to the canvas. */
  screenY: number;
  /** Geographic [lon, lat] at the pointer position, or null if off-map. */
  mapCoords: [number, number] | null;
  /** The original DOM PointerEvent. */
  originalEvent: PointerEvent;
  /** Mouse button (0=left, 1=middle, 2=right). */
  button: number;
  /** Whether Shift key was held. */
  shiftKey: boolean;
  /** Whether Ctrl/Cmd key was held. */
  ctrlKey: boolean;
}

// ─── Tool Context ───

/** Context provided to tools when activated. Contains view services. */
export interface ToolContext {
  /** Convert screen coordinates to geographic [lon, lat]. */
  toMap(screenX: number, screenY: number): [number, number] | null;
  /** Convert geographic coordinates to screen [x, y]. */
  toScreen(lon: number, lat: number): [number, number] | null;
  /** The map canvas element. */
  readonly canvas: HTMLCanvasElement;
  /** Current rendering mode. */
  readonly mode: '2d' | '3d';
  /** Current zoom level. */
  readonly zoom: number;
  /** Preview layer for rubber-band / vertex handle rendering. */
  readonly previewLayer: IPreviewLayer;
  /** Command system for undo/redo. */
  readonly commands: CommandSystem;
  /** Mark the view as needing a re-render. */
  markDirty(): void;
  /** Emit a tool event. */
  emitEvent<K extends keyof ToolEvents>(event: K, data: ToolEvents[K]): void;
}

// ─── ITool Interface ───

export interface ITool {
  /** Unique tool identifier (e.g. 'draw-point', 'draw-polyline'). */
  readonly id: string;
  /** Human-readable tool name. */
  readonly name: string;
  /** Current tool state. */
  readonly state: ToolState;
  /** Current cursor to display. */
  readonly cursor: ToolCursor;

  /** Activate this tool with the given context. */
  activate(context: ToolContext): void;
  /** Deactivate this tool. */
  deactivate(): void;

  /** Handle pointer down. Return true if consumed. */
  onPointerDown(e: ToolPointerEvent): boolean;
  /** Handle pointer move. Return true if consumed. */
  onPointerMove(e: ToolPointerEvent): boolean;
  /** Handle pointer up. Return true if consumed. */
  onPointerUp(e: ToolPointerEvent): boolean;
  /** Handle double click. Return true if consumed. */
  onDoubleClick(e: ToolPointerEvent): boolean;
  /** Handle key down. Return true if consumed. */
  onKeyDown(e: KeyboardEvent): boolean;

  /** Cancel current in-progress operation (e.g. Escape). Tool stays active. */
  cancel(): void;
  /** Fully destroy the tool and release resources. */
  destroy(): void;
}

// Re-export types needed by tools
export type { Feature, Geometry };
