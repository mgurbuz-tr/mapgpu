import type {
  VectorTileBinaryPayload,
  VectorTileWorkerRequest,
  VectorTileWorkerResponse,
} from '@mapgpu/core';

export const VECTOR_TILE_WORKER_TASK = 'vector-tile:parse-build';

export type { VectorTileWorkerRequest, VectorTileWorkerResponse };

export function collectVectorTilePayloadTransferables(
  payload: VectorTileBinaryPayload | null,
): Transferable[] {
  if (!payload) return [];

  const transferables: Transferable[] = [];

  for (const group of payload.pointGroups) {
    transferables.push(group.vertices.buffer);
  }

  for (const group of payload.lineGroups) {
    transferables.push(group.vertices.buffer, group.indices.buffer);
  }

  for (const group of payload.polygonGroups) {
    transferables.push(group.vertices.buffer, group.indices.buffer);
  }

  for (const group of payload.modelGroups) {
    transferables.push(group.instances.buffer);
  }

  for (const group of payload.extrusionGroups) {
    transferables.push(group.vertices.buffer, group.indices.buffer);
  }

  return transferables;
}
