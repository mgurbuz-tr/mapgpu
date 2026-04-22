/**
 * LOS worker — runs the full line-of-sight pipeline off the main thread.
 *
 * Handles a single task type ({@link LOS_WORKER_TASK}) and expects elevations
 * to be pre-sampled by the caller (see the protocol file for why).
 *
 * The worker imports `@mapgpu/wasm-core` dynamically so the bundle stays small
 * and Vite's static analyzer doesn't try to resolve the package during the
 * browser build (same pattern used by `vector-tile.worker.ts`).
 */

import {
  LOS_WORKER_TASK,
  collectLosResponseTransferables,
  type LosWorkerRequest,
  type LosWorkerResponse,
} from './los-worker-protocol.js';

interface WorkerPoolRequest {
  id: number;
  type: string;
  data: LosWorkerRequest;
}

interface WorkerPoolResponse {
  id: number;
  result?: LosWorkerResponse;
  error?: string;
}

interface WorkerGlobalScopeLike {
  onmessage: ((event: MessageEvent<WorkerPoolRequest>) => void) | null;
  postMessage(message: WorkerPoolResponse, transfer?: Transferable[]): void;
}

interface WasmCoreLike {
  generateLosSegments(
    observer: Float64Array,
    target: Float64Array,
    sampleCount: number,
  ): Float64Array;
  computeLos(
    segments: Float64Array,
    elevations: Float64Array,
    observerOffset: number,
    targetOffset: number,
  ): {
    visible: boolean;
    blockingPoint: Float64Array | null;
    profile: Float64Array;
  };
}

let wasmInitPromise: Promise<WasmCoreLike | null> | null = null;

const worker = globalThis as unknown as WorkerGlobalScopeLike;

worker.onmessage = (event) => {
  void handleMessage(event.data);
};

async function handleMessage(message: WorkerPoolRequest): Promise<void> {
  if (message.type !== LOS_WORKER_TASK) return;

  try {
    const wasm = await ensureWasmCore();
    if (!wasm) {
      throw new Error('wasm-core unavailable in worker');
    }
    const response = runLosPipeline(wasm, message.data);
    const transfer = collectLosResponseTransferables(response);
    worker.postMessage({ id: message.id, result: response }, transfer);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    worker.postMessage({ id: message.id, error: errorMessage });
  }
}

function runLosPipeline(
  wasm: WasmCoreLike,
  req: LosWorkerRequest,
): LosWorkerResponse {
  const obsArr = new Float64Array([req.observer[0], req.observer[1], 0]);
  const tgtArr = new Float64Array([req.target[0], req.target[1], 0]);

  const segments = wasm.generateLosSegments(obsArr, tgtArr, req.sampleCount);
  const elevationCount = segments.length / 3;

  let elevations: Float64Array;
  if (req.elevations && req.elevations.length === elevationCount) {
    // Sanitize NaN → 0 for WASM compatibility (mirrors LosAnalysis main-path).
    elevations = new Float64Array(elevationCount);
    for (let i = 0; i < elevationCount; i++) {
      const v = req.elevations[i]!;
      elevations[i] = Number.isNaN(v) ? 0 : v;
    }
  } else {
    elevations = new Float64Array(elevationCount);
  }

  const losResult = wasm.computeLos(
    segments,
    elevations,
    req.observerOffset,
    req.targetOffset,
  );

  let visibleLine: Float64Array;
  let blockedLine: Float64Array | null = null;

  if (losResult.visible) {
    visibleLine = new Float64Array(segments);
  } else if (losResult.blockingPoint) {
    const blockIdx = findClosestSegmentIndex(segments, losResult.blockingPoint);
    visibleLine = new Float64Array(segments.buffer.slice(0, blockIdx * 3 * 8));
    blockedLine = new Float64Array(
      segments.slice(Math.max(0, blockIdx - 1) * 3),
    );
  } else {
    visibleLine = new Float64Array(0);
    blockedLine = new Float64Array(segments);
  }

  return {
    visible: losResult.visible,
    blockingPoint: losResult.blockingPoint,
    profile: losResult.profile,
    visibleLine,
    blockedLine,
  };
}

function findClosestSegmentIndex(
  segments: Float64Array,
  point: Float64Array,
): number {
  let minDist = Infinity;
  let minIdx = 0;
  const count = segments.length / 3;

  for (let i = 0; i < count; i++) {
    const dx = (segments[i * 3] ?? 0) - (point[0] ?? 0);
    const dy = (segments[i * 3 + 1] ?? 0) - (point[1] ?? 0);
    const dz = (segments[i * 3 + 2] ?? 0) - (point[2] ?? 0);
    const dist = dx * dx + dy * dy + dz * dz;
    if (dist < minDist) {
      minDist = dist;
      minIdx = i;
    }
  }

  return minIdx;
}

async function ensureWasmCore(): Promise<WasmCoreLike | null> {
  if (wasmInitPromise) return wasmInitPromise;

  wasmInitPromise = (async (): Promise<WasmCoreLike | null> => {
    try {
      const moduleName = '@mapgpu/wasm-core';
      const wasm: unknown = await import(/* @vite-ignore */ moduleName);
      const exports = wasm as {
        default?: unknown;
        generateLosSegments?: unknown;
        computeLos?: unknown;
      };

      if (typeof exports.default === 'function') {
        await (exports.default as () => Promise<unknown> | void)();
      }

      if (
        typeof exports.generateLosSegments !== 'function'
        || typeof exports.computeLos !== 'function'
      ) {
        return null;
      }

      return {
        generateLosSegments: exports.generateLosSegments as WasmCoreLike['generateLosSegments'],
        computeLos: exports.computeLos as WasmCoreLike['computeLos'],
      };
    } catch {
      return null;
    }
  })();

  return wasmInitPromise;
}
