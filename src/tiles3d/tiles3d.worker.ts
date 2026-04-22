/**
 * 3D Tiles content decoder worker.
 *
 * Runs `decodeTileContent` off the main thread so the B3DM/I3DM/PNTS/CMPT
 * parse chain (which includes the ~700-LOC glTF parser) doesn't block UI.
 */

import { decodeTileContent } from './TileContentLoader.js';
import {
  TILES3D_DECODE_TASK,
  type Tiles3DDecodeRequest,
  type Tiles3DDecodeResponse,
} from './tiles3d-worker-protocol.js';

interface WorkerPoolRequest {
  id: number;
  type: string;
  data: Tiles3DDecodeRequest;
}

interface WorkerPoolResponse {
  id: number;
  result?: Tiles3DDecodeResponse;
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
  if (message.type !== TILES3D_DECODE_TASK) return;

  try {
    const decoded = decodeTileContent(message.data.buffer);
    worker.postMessage({ id: message.id, result: decoded });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    worker.postMessage({ id: message.id, error: errorMessage });
  }
}
