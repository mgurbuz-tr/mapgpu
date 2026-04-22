/**
 * CPU cluster worker — runs gridCluster + packClusterEntries off main thread.
 *
 * Output is packed into three typed arrays so the entire response transfers
 * zero-copy: packedEntries (Float32/Uint32 interleaved), membershipValues
 * (flat Int32 of source-point indices), membershipOffsets (prefix scan).
 */

import { gridCluster, packClusterEntries } from './cpu-cluster.js';
import {
  CLUSTER_WORKER_TASK,
  collectClusterResponseTransferables,
  type ClusterWorkerRequest,
  type ClusterWorkerResponse,
} from './cluster-worker-protocol.js';

interface WorkerPoolRequest {
  id: number;
  type: string;
  data: ClusterWorkerRequest;
}

interface WorkerPoolResponse {
  id: number;
  result?: ClusterWorkerResponse;
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
  if (message.type !== CLUSTER_WORKER_TASK) return;

  try {
    const { points, clusterRadius, zoom, extent, minClusterCount } = message.data;
    const result = gridCluster(
      points,
      clusterRadius,
      zoom,
      [extent[0], extent[1], extent[2], extent[3]],
      minClusterCount,
    );

    const packedEntries = packClusterEntries(result.entries);

    // Flatten membership: values array + prefix offsets (length N+1).
    const entryCount = result.membership.length;
    let totalMembers = 0;
    for (let i = 0; i < entryCount; i++) {
      totalMembers += result.membership[i]!.length;
    }

    const membershipValues = new Int32Array(totalMembers);
    const membershipOffsets = new Int32Array(entryCount + 1);
    let cursor = 0;
    for (let i = 0; i < entryCount; i++) {
      membershipOffsets[i] = cursor;
      const members = result.membership[i]!;
      for (let j = 0; j < members.length; j++) {
        membershipValues[cursor + j] = members[j]!;
      }
      cursor += members.length;
    }
    membershipOffsets[entryCount] = cursor;

    const response: ClusterWorkerResponse = {
      packedEntries,
      membershipValues,
      membershipOffsets,
    };

    worker.postMessage(
      { id: message.id, result: response },
      collectClusterResponseTransferables(response),
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    worker.postMessage({ id: message.id, error: errorMessage });
  }
}
