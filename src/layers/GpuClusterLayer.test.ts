import { describe, expect, it, vi } from 'vitest';
import type {
  ClusterViewCallbacks,
  Feature,
  IWorker,
  WorkerRequest,
  WorkerResponse,
} from '../core/index.js';
import { WorkerPoolRegistry, mercatorToLonLat } from '../core/index.js';
import {
  CLUSTER_WORKER_TASK,
  gridCluster,
  packClusterEntries,
  type ClusterWorkerResponse,
} from '../render/index.js';
import { GraphicsLayer } from './GraphicsLayer.js';
import { GpuClusterLayer } from './GpuClusterLayer.js';

const HALF_WORLD = 20037508.342789244;
const SCREEN_SCALE = 10;

const CLUSTER_FEATURES: Feature[] = [
  {
    id: 'a',
    geometry: { type: 'Point', coordinates: [29, 41] },
    attributes: {},
  },
  {
    id: 'b',
    geometry: { type: 'Point', coordinates: [29.0001, 41.0001] },
    attributes: {},
  },
];

async function createSourceLayer(features: readonly Feature[]): Promise<GraphicsLayer> {
  const source = new GraphicsLayer({ id: 'source-layer', visible: false });
  await source.load();
  source.addMany([...features]);
  return source;
}

function createViewCallbacks(
  zoom: number,
  goTo?: ReturnType<typeof vi.fn>,
): ClusterViewCallbacks {
  return {
    toMap: (screenX: number, screenY: number) => [screenX / SCREEN_SCALE, screenY / SCREEN_SCALE],
    toScreen: (lon: number, lat: number) => [lon * SCREEN_SCALE, lat * SCREEN_SCALE],
    getZoom: () => zoom,
    getExtent: () => [-HALF_WORLD, -HALF_WORLD, HALF_WORLD, HALF_WORLD],
    getViewportSize: () => [1024, 768],
    ...(goTo ? { goTo } : {}),
  };
}

function clusterCenterScreen(layer: GpuClusterLayer, callbacks: ClusterViewCallbacks, zoom: number): [number, number] {
  const points = layer.getSourcePoints3857();
  if (!points || !callbacks.toScreen) throw new Error('Missing points or toScreen callback');

  const result = gridCluster(
    points,
    layer.clusterRadius,
    zoom,
    callbacks.getExtent(),
    layer.clusterMinPoints,
  );
  const entry = result.entries.find((e) => (e.flags & 1) === 1);
  if (!entry) throw new Error('Cluster entry not found');
  const [lon, lat] = mercatorToLonLat(entry.posX, entry.posY);
  const screen = callbacks.toScreen(lon, lat);
  if (!screen) throw new Error('Screen projection failed');
  return screen;
}

describe('GpuClusterLayer', () => {
  it('calls goTo with fit-bounds target when a cluster is clicked', async () => {
    const source = await createSourceLayer(CLUSTER_FEATURES);
    const layer = new GpuClusterLayer({
      id: 'clusters',
      source,
      clusterRadius: 60,
      clusterMaxZoom: 18,
    });
    await layer.load();

    const goTo = vi.fn().mockResolvedValue(undefined);
    const callbacks = createViewCallbacks(4, goTo);
    layer.attachView(callbacks);

    const [x, y] = clusterCenterScreen(layer, callbacks, 4);
    layer.handleClusterClick(x, y);

    expect(goTo).toHaveBeenCalledTimes(1);
    const target = goTo.mock.calls[0]![0] as { center?: [number, number]; zoom?: number; duration?: number };
    expect(target.duration).toBe(300);
    expect(target.center).toBeDefined();
    expect(target.zoom).toBeDefined();
    expect(target.zoom!).toBeGreaterThan(4);
    expect(target.zoom!).toBeLessThanOrEqual(18);
  });

  it('does nothing when click misses all clusters', async () => {
    const source = await createSourceLayer(CLUSTER_FEATURES);
    const layer = new GpuClusterLayer({ id: 'clusters', source, clusterRadius: 60, clusterMaxZoom: 18 });
    await layer.load();

    const goTo = vi.fn().mockResolvedValue(undefined);
    const callbacks = createViewCallbacks(4, goTo);
    layer.attachView(callbacks);

    layer.handleClusterClick(0, 0);
    expect(goTo).not.toHaveBeenCalled();
  });

  it('recenters without zooming when already at clusterMaxZoom', async () => {
    const source = await createSourceLayer(CLUSTER_FEATURES);
    const layer = new GpuClusterLayer({ id: 'clusters', source, clusterRadius: 60, clusterMaxZoom: 4 });
    await layer.load();

    const goTo = vi.fn().mockResolvedValue(undefined);
    const callbacks = createViewCallbacks(4, goTo);
    layer.attachView(callbacks);

    const [x, y] = clusterCenterScreen(layer, callbacks, 4);
    layer.handleClusterClick(x, y);

    expect(goTo).toHaveBeenCalledTimes(1);
    const target = goTo.mock.calls[0]![0] as { center?: [number, number]; zoom?: number; duration?: number };
    expect(target.center).toBeDefined();
    expect(target.zoom).toBeUndefined();
    expect(target.duration).toBe(300);
  });

  it('falls back to map-space hit testing when toScreen misses', async () => {
    const source = await createSourceLayer(CLUSTER_FEATURES);
    const layer = new GpuClusterLayer({ id: 'clusters', source, clusterRadius: 60, clusterMaxZoom: 18 });
    await layer.load();

    const goTo = vi.fn().mockResolvedValue(undefined);
    const callbacks = createViewCallbacks(4, goTo);
    callbacks.toScreen = () => null;
    layer.attachView(callbacks);

    const [x, y] = clusterCenterScreen(layer, createViewCallbacks(4), 4);
    layer.handleClusterClick(x, y);

    expect(goTo).toHaveBeenCalledTimes(1);
  });

  it('supports theme preset with style override', async () => {
    const source = await createSourceLayer(CLUSTER_FEATURES);
    const layer = new GpuClusterLayer({
      id: 'clusters',
      source,
      themePreset: 'legacy-orange',
      style: {
        clusterStrokeWidth: 3.5,
      },
    });
    await layer.load();

    expect(layer.clusterStyle.clusterStrokeWidth).toBe(3.5);
    expect(layer.clusterStyle.clusterFillMedium).toEqual([255, 109, 58, 235]);
  });

  it('does not throw if goTo callback is missing', async () => {
    const source = await createSourceLayer(CLUSTER_FEATURES);
    const layer = new GpuClusterLayer({ id: 'clusters', source, clusterRadius: 60, clusterMaxZoom: 18 });
    await layer.load();

    const callbacks = createViewCallbacks(4);
    delete callbacks.goTo;
    layer.attachView(callbacks);

    const [x, y] = clusterCenterScreen(layer, callbacks, 4);
    expect(() => layer.handleClusterClick(x, y)).not.toThrow();
  });

  // ─── Worker offload path ───

  describe('cluster worker', () => {
    /**
     * Mock worker that runs `gridCluster` on the same thread and returns the
     * packed flat representation the protocol expects. This exercises the
     * routing (layer → registry → worker → unpack) without a real Worker.
     */
    function createGridClusterWorker(): IWorker {
      const worker = {
        onmessage: null as ((e: { data: WorkerResponse }) => void) | null,
        onerror: null as ((e: { message: string }) => void) | null,
        postMessage(msg: WorkerRequest, _transfer: Transferable[]): void {
          if (msg.type !== CLUSTER_WORKER_TASK) return;
          queueMicrotask(() => {
            try {
              const req = msg.data as {
                points: Float32Array;
                clusterRadius: number;
                zoom: number;
                extent: [number, number, number, number];
                minClusterCount: number;
              };
              const result = gridCluster(
                req.points,
                req.clusterRadius,
                req.zoom,
                req.extent,
                req.minClusterCount,
              );
              const packedEntries = packClusterEntries(result.entries);
              let total = 0;
              for (const m of result.membership) total += m.length;
              const membershipValues = new Int32Array(total);
              const membershipOffsets = new Int32Array(result.membership.length + 1);
              let c = 0;
              for (let i = 0; i < result.membership.length; i++) {
                membershipOffsets[i] = c;
                const members = result.membership[i]!;
                for (let j = 0; j < members.length; j++) {
                  membershipValues[c + j] = members[j]!;
                }
                c += members.length;
              }
              membershipOffsets[result.membership.length] = c;
              const response: ClusterWorkerResponse = {
                packedEntries,
                membershipValues,
                membershipOffsets,
              };
              worker.onmessage?.({ data: { id: msg.id, result: response } });
            } catch (err) {
              worker.onmessage?.({
                data: { id: msg.id, error: (err as Error).message },
              });
            }
          });
        },
        terminate: vi.fn(),
      };
      return worker;
    }

    it('routes cluster click through the worker when registry is supplied', async () => {
      const source = await createSourceLayer(CLUSTER_FEATURES);
      const registry = new WorkerPoolRegistry({ maxWorkersPerTask: 1 });
      const factory = vi.fn(() => createGridClusterWorker());

      const layer = new GpuClusterLayer({
        id: 'clusters',
        source,
        clusterRadius: 60,
        clusterMaxZoom: 18,
        workerRegistry: registry,
        clusterWorkerFactory: factory,
      });
      await layer.load();

      const goTo = vi.fn().mockResolvedValue(undefined);
      const callbacks = createViewCallbacks(4, goTo);
      layer.attachView(callbacks);

      const [x, y] = clusterCenterScreen(layer, callbacks, 4);
      layer.handleClusterClick(x, y);

      // Worker response resolves on a microtask — flush the queue.
      await new Promise<void>((resolve) => queueMicrotask(resolve));
      await new Promise<void>((resolve) => queueMicrotask(resolve));

      expect(factory).toHaveBeenCalled();
      expect(goTo).toHaveBeenCalledTimes(1);

      registry.terminateAll();
    });

    it('falls back to main-thread cluster when the worker errors', async () => {
      const source = await createSourceLayer(CLUSTER_FEATURES);
      const registry = new WorkerPoolRegistry({ maxWorkersPerTask: 1 });

      const failingWorker: IWorker = {
        onmessage: null,
        onerror: null,
        postMessage(msg: WorkerRequest, _transfer: Transferable[]): void {
          queueMicrotask(() => {
            this.onmessage?.({
              data: { id: msg.id, error: 'boom' } as WorkerResponse,
            });
          });
        },
        terminate: vi.fn(),
      };

      const layer = new GpuClusterLayer({
        id: 'clusters',
        source,
        clusterRadius: 60,
        clusterMaxZoom: 18,
        workerRegistry: registry,
        clusterWorkerFactory: () => failingWorker,
      });
      await layer.load();

      const goTo = vi.fn().mockResolvedValue(undefined);
      const callbacks = createViewCallbacks(4, goTo);
      layer.attachView(callbacks);

      const [x, y] = clusterCenterScreen(layer, callbacks, 4);
      layer.handleClusterClick(x, y);

      await new Promise<void>((resolve) => queueMicrotask(resolve));
      await new Promise<void>((resolve) => queueMicrotask(resolve));

      expect(goTo).toHaveBeenCalledTimes(1);
      registry.terminateAll();
    });
  });
});
