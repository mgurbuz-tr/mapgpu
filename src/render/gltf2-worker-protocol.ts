/**
 * glTF 2.0 worker protocol — off-thread GLB parsing.
 *
 * Scope: binary GLB path only. The text glTF+buffers variant stays on the
 * main thread because it's rare (most pipelines ship GLB), and its input
 * shape (`jsonObj` + `ArrayBuffer[]`) would need a separate task type.
 *
 * Binary glTF parse + material/texture extraction is ~20-80ms on consumer
 * hardware for typical building-footprint GLBs. Transferring the input
 * buffer avoids the default structured-clone copy on the way in; the
 * response `Gltf2Model` graph crosses back via structured clone (acceptable
 * given the parse cost dominates).
 */

import type {
  IWorker,
  WorkerTaskDef,
} from '../core/index.js';
import type { Gltf2Model } from './gltf2-loader.js';

export const GLTF2_PARSE_TASK = 'render:parse-gltf2';

export interface Gltf2ParseRequest {
  /** Raw GLB bytes. Transferred — caller loses ownership. */
  readonly buffer: ArrayBuffer;
}

export type Gltf2ParseResponse = Gltf2Model;

export function createGltf2ParseTaskDef(
  workerFactory: () => IWorker,
): WorkerTaskDef<Gltf2ParseRequest, Gltf2ParseResponse> {
  return {
    taskType: GLTF2_PARSE_TASK,
    workerFactory,
    collectTransferables: (req) => [req.buffer],
  };
}
