/**
 * glTF 2.0 parse worker — runs binary GLB parsing off the main thread.
 *
 * Pure TypeScript, no WASM dependency. The response `Gltf2Model` graph is
 * shipped back via structured clone (intentional — the parse itself is the
 * bottleneck, not the clone).
 */

import { parseGlb2 } from './gltf2-loader.js';
import {
  GLTF2_PARSE_TASK,
  type Gltf2ParseRequest,
  type Gltf2ParseResponse,
} from './gltf2-worker-protocol.js';

interface WorkerPoolRequest {
  id: number;
  type: string;
  data: Gltf2ParseRequest;
}

interface WorkerPoolResponse {
  id: number;
  result?: Gltf2ParseResponse;
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
  if (message.type !== GLTF2_PARSE_TASK) return;

  try {
    const model = parseGlb2(message.data.buffer);
    worker.postMessage({ id: message.id, result: model });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    worker.postMessage({ id: message.id, error: errorMessage });
  }
}
