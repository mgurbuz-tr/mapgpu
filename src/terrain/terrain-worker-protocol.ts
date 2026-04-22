/**
 * Terrain worker protocol — currently hosts the DTED parse task.
 *
 * DTED files are 10-25MB binary blobs; parsing on the main thread blocks it
 * for 20-80ms on typical consumer hardware. The worker path keeps UI smooth
 * while local DT1/DT2 files are ingested.
 *
 * The response includes a transferable `elevations: Int16Array` — the
 * heavyweight field — so the data crosses the thread boundary without a copy.
 */

import type {
  IWorker,
  WorkerTaskDef,
} from '../core/index.js';
import type { DTEDLevelName, DTEDTile } from './types.js';

export const DTED_PARSE_TASK = 'terrain:parse-dted';
export const HILLSHADE_COMPUTE_TASK = 'terrain:compute-hillshade';
export const HILLSHADE_RGBA_TASK = 'terrain:compute-hillshade-rgba';

export interface DtedParseRequest {
  /** Raw DTED file bytes. Transferred, so the caller loses ownership. */
  readonly buffer: ArrayBuffer;
  /** Original file name — used to detect DTED level and cell origin. */
  readonly fileName: string;
}

/**
 * Worker response — structurally identical to {@link DTEDTile}. Kept as a
 * separate type so upstream changes to DTEDTile don't silently break the
 * protocol contract.
 */
export interface DtedParseResponse {
  readonly id: string;
  readonly level: DTEDLevelName;
  readonly origin: readonly [number, number];
  readonly width: number;
  readonly height: number;
  readonly elevations: Int16Array;
  readonly minElevation: number;
  readonly maxElevation: number;
  readonly extent: {
    readonly minX: number;
    readonly minY: number;
    readonly maxX: number;
    readonly maxY: number;
  };
}

/**
 * Convert a worker response to the canonical DTEDTile shape used by the
 * terrain store. The objects are structurally equivalent, but the store
 * expects the mutable type signature.
 */
export function dtedResponseToTile(response: DtedParseResponse): DTEDTile {
  return {
    id: response.id,
    level: response.level,
    origin: [response.origin[0], response.origin[1]],
    width: response.width,
    height: response.height,
    elevations: response.elevations,
    minElevation: response.minElevation,
    maxElevation: response.maxElevation,
    extent: {
      minX: response.extent.minX,
      minY: response.extent.minY,
      maxX: response.extent.maxX,
      maxY: response.extent.maxY,
    },
  };
}

/**
 * Collect transferables from a {@link DtedParseResponse} so the elevations
 * buffer moves to the main thread instead of being copied. Invoked from the
 * worker before `postMessage`.
 */
export function collectDtedResponseTransferables(
  response: DtedParseResponse,
): Transferable[] {
  return [response.elevations.buffer];
}

export function createDtedParseTaskDef(
  workerFactory: () => IWorker,
): WorkerTaskDef<DtedParseRequest, DtedParseResponse> {
  return {
    taskType: DTED_PARSE_TASK,
    workerFactory,
    collectTransferables: (req) => [req.buffer],
  };
}

// ─── Hillshade compute task ───

/**
 * Horn's-method hillshade (3×3 Sobel) is a pure CPU loop over the elevation
 * grid — ~30ms for a 1024×1024 tile. Every tile build on the terrain layers
 * triggers this, so offloading matters during active panning with heavy
 * 2D hillshade enabled.
 */
export interface HillshadeComputeRequest {
  /** Row-major Int16Array elevations, transferred. */
  readonly elevations: Int16Array;
  readonly width: number;
  readonly height: number;
  readonly cellSizeX: number;
  readonly cellSizeY: number;
  readonly azimuth: number;
  readonly altitude: number;
}

export interface HillshadeComputeResponse {
  /** Row-major Uint8Array grayscale shade. */
  readonly shade: Uint8Array;
}

export function collectHillshadeResponseTransferables(
  response: HillshadeComputeResponse,
): Transferable[] {
  return [response.shade.buffer];
}

export function createHillshadeTaskDef(
  workerFactory: () => IWorker,
): WorkerTaskDef<HillshadeComputeRequest, HillshadeComputeResponse> {
  return {
    taskType: HILLSHADE_COMPUTE_TASK,
    workerFactory,
    collectTransferables: (req) => [req.elevations.buffer],
  };
}

// ─── Fused hillshade → RGBA task ───

/**
 * Combines `computeHillshadeTS` + `composeHillshadeRgba` in a single worker
 * dispatch. Saves a round-trip + eliminates the main-thread compose loop
 * (262K pixels × 4 byte RGBA write) that was the #2 hotspot during DTED 3D
 * zoom according to the plan-19 trace analysis.
 *
 * Input transfers `elevations.buffer` AND `mask.buffer` so both crossings
 * are zero-copy. Output transfers `rgba.buffer` back.
 */
export interface HillshadeRgbaRequest {
  readonly elevations: Int16Array;
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly cellSizeX: number;
  readonly cellSizeY: number;
  readonly azimuth: number;
  readonly altitude: number;
  readonly softness: number;
}

export interface HillshadeRgbaResponse {
  /** Row-major RGBA Uint8Array — ready for GPU texture upload. */
  readonly rgba: Uint8Array;
}

export function collectHillshadeRgbaResponseTransferables(
  response: HillshadeRgbaResponse,
): Transferable[] {
  return [response.rgba.buffer];
}

export function createHillshadeRgbaTaskDef(
  workerFactory: () => IWorker,
): WorkerTaskDef<HillshadeRgbaRequest, HillshadeRgbaResponse> {
  return {
    taskType: HILLSHADE_RGBA_TASK,
    workerFactory,
    collectTransferables: (req) => [req.elevations.buffer, req.mask.buffer],
  };
}
