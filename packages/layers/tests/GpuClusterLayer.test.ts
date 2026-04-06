import { describe, expect, it, vi } from 'vitest';
import type { ClusterViewCallbacks, Feature } from '@mapgpu/core';
import { mercatorToLonLat } from '@mapgpu/core';
import { gridCluster } from '@mapgpu/render-webgpu';
import { GraphicsLayer } from '../src/GraphicsLayer.js';
import { GpuClusterLayer } from '../src/GpuClusterLayer.js';

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
});
