/**
 * 3D Tiles worker protocol — off-thread content decoder.
 *
 * Offloads {@link decodeTileContent} (and transitively {@link parseGlb}) so
 * B3DM/I3DM/PNTS/CMPT parsing does not block the main thread. The heaviest
 * single piece of work on the 3D Tiles streaming path is binary glTF parse,
 * which this task type covers end-to-end.
 *
 * Transferables note: `DecodedTileContent` is a nested graph of TypedArrays
 * plus a Map of embedded image buffers. We currently rely on structured
 * clone to ship it back — the cost is small compared to parse time (~5ms
 * vs. 20-80ms parse), and walking the graph to build an exact transfer list
 * is brittle. Future optimization if profiling shows it matters.
 */

import type { IWorker, WorkerTaskDef } from '../core/index.js';
import type { DecodedTileContent } from './TileContentLoader.js';

export const TILES3D_DECODE_TASK = 'tiles3d:decode-content';

export interface Tiles3DDecodeRequest {
  /** Raw tile content bytes. Transferred — caller must not reuse the buffer. */
  readonly buffer: ArrayBuffer;
}

/**
 * Response mirrors {@link DecodedTileContent}. Kept as a distinct type so
 * upstream shape changes fail the protocol-level test surface rather than
 * silently propagating.
 */
export type Tiles3DDecodeResponse = DecodedTileContent;

export function createTiles3DDecodeTaskDef(
  workerFactory: () => IWorker,
): WorkerTaskDef<Tiles3DDecodeRequest, Tiles3DDecodeResponse> {
  return {
    taskType: TILES3D_DECODE_TASK,
    workerFactory,
    collectTransferables: (req) => [req.buffer],
  };
}
