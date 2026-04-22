/**
 * Terrain worker — handles two task types off the main thread:
 *
 *   1. DTED_PARSE_TASK         — binary DTED parse (returns Int16 elevations)
 *   2. HILLSHADE_COMPUTE_TASK  — Horn's-method hillshade (Int16 → Uint8)
 *
 * Both are pure CPU routines with no WASM dependency, so worker boot is
 * near-zero cost. Large buffers cross the thread boundary via transferables
 * to avoid structured-clone copies.
 */

import { parseDTED } from './parsers/dted-parser.js';
import { composeHillshadeRgba, computeHillshadeTS } from './hillshade.js';
import {
  DTED_PARSE_TASK,
  HILLSHADE_COMPUTE_TASK,
  HILLSHADE_RGBA_TASK,
  collectDtedResponseTransferables,
  collectHillshadeResponseTransferables,
  collectHillshadeRgbaResponseTransferables,
  type DtedParseRequest,
  type DtedParseResponse,
  type HillshadeComputeRequest,
  type HillshadeComputeResponse,
  type HillshadeRgbaRequest,
  type HillshadeRgbaResponse,
} from './terrain-worker-protocol.js';

type TerrainWorkerRequest = DtedParseRequest | HillshadeComputeRequest | HillshadeRgbaRequest;
type TerrainWorkerResult = DtedParseResponse | HillshadeComputeResponse | HillshadeRgbaResponse;

interface WorkerPoolRequest {
  id: number;
  type: string;
  data: TerrainWorkerRequest;
}

interface WorkerPoolResponse {
  id: number;
  result?: TerrainWorkerResult;
  error?: string;
}

interface WorkerGlobalScopeLike {
  onmessage: ((event: MessageEvent<WorkerPoolRequest>) => void) | null;
  postMessage(message: WorkerPoolResponse, transfer?: Transferable[]): void;
}

const worker = globalThis as unknown as WorkerGlobalScopeLike;

worker.onmessage = (event) => {
  handleMessage(event.data);
};

function handleMessage(message: WorkerPoolRequest): void {
  try {
    if (message.type === DTED_PARSE_TASK) {
      const req = message.data as DtedParseRequest;
      const tile = parseDTED(req.buffer, { fileName: req.fileName });
      const response: DtedParseResponse = {
        id: tile.id,
        level: tile.level,
        origin: tile.origin,
        width: tile.width,
        height: tile.height,
        elevations: tile.elevations,
        minElevation: tile.minElevation,
        maxElevation: tile.maxElevation,
        extent: tile.extent,
      };
      worker.postMessage(
        { id: message.id, result: response },
        collectDtedResponseTransferables(response),
      );
      return;
    }

    if (message.type === HILLSHADE_COMPUTE_TASK) {
      const req = message.data as HillshadeComputeRequest;
      const shade = computeHillshadeTS(
        req.elevations,
        req.width,
        req.height,
        req.cellSizeX,
        req.cellSizeY,
        req.azimuth,
        req.altitude,
      );
      const response: HillshadeComputeResponse = { shade };
      worker.postMessage(
        { id: message.id, result: response },
        collectHillshadeResponseTransferables(response),
      );
      return;
    }

    if (message.type === HILLSHADE_RGBA_TASK) {
      const req = message.data as HillshadeRgbaRequest;
      const shade = computeHillshadeTS(
        req.elevations,
        req.width,
        req.height,
        req.cellSizeX,
        req.cellSizeY,
        req.azimuth,
        req.altitude,
      );
      const rgba = composeHillshadeRgba(shade, req.mask, req.altitude, req.softness);
      const response: HillshadeRgbaResponse = { rgba };
      worker.postMessage(
        { id: message.id, result: response },
        collectHillshadeRgbaResponseTransferables(response),
      );
      return;
    }
    // Unknown task type — no reply so the pool's pending map keeps waiting.
    // Matches the behavior of the existing vector-tile worker.
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    worker.postMessage({ id: message.id, error: errorMessage });
  }
}
