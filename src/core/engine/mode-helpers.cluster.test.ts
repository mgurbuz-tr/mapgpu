import { describe, expect, it, vi } from 'vitest';
import type {
  ClusterStyleConfig,
  ClusterViewCallbacks,
  IClusterLayer,
  IFeatureLayer,
  IRenderEngine,
  LayerEvents,
} from '../interfaces/index.js';
import type { LayerManager } from './LayerManager.js';
import { renderClusterLayer } from './mode-helpers.js';

function makeFeatureLayer(): IFeatureLayer {
  return {
    id: 'source',
    type: 'graphics',
    visible: true,
    opacity: 1,
    loaded: true,
    load: async () => {},
    refresh: () => {},
    destroy: () => {},
    on: <K extends keyof LayerEvents>(_event: K, _handler: (data: LayerEvents[K]) => void) => {},
    off: <K extends keyof LayerEvents>(_event: K, _handler: (data: LayerEvents[K]) => void) => {},
    getFeatures: () => [],
  };
}

function makeClusterLayer(points: Float32Array): IClusterLayer {
  const style: ClusterStyleConfig = {
    clusterFillSmall: [1, 2, 3, 255],
    clusterFillMedium: [4, 5, 6, 255],
    clusterFillLarge: [7, 8, 9, 255],
    clusterStroke: [11, 12, 13, 255],
    clusterText: [245, 245, 245, 255],
    pointFill: [10, 11, 12, 255],
    pointStroke: [220, 221, 222, 255],
    pointSize: 8,
    pointStrokeWidth: 1.5,
    clusterBaseSize: 28,
    clusterGrowRate: 8,
    clusterStrokeWidth: 2,
  };

  return {
    id: 'cluster-layer',
    type: 'gpu-cluster',
    visible: true,
    opacity: 1,
    loaded: true,
    load: async () => {},
    refresh: () => {},
    destroy: () => {},
    on: <K extends keyof LayerEvents>(_event: K, _handler: (data: LayerEvents[K]) => void) => {},
    off: <K extends keyof LayerEvents>(_event: K, _handler: (data: LayerEvents[K]) => void) => {},
    sourceLayer: makeFeatureLayer(),
    setSource: () => {},
    clusterRadius: 60,
    clusterMinPoints: 7,
    getSourcePoints3857: () => points,
    pointCount: points.length / 2,
    sourceVersion: 3,
    handleClusterClick: () => {},
    clusterStyle: style,
    attachView: vi.fn(),
  };
}

describe('renderClusterLayer', () => {
  it('passes clusterMinPoints through to renderEngine.drawClusters', () => {
    const points = new Float32Array([1, 2, 3, 4]);
    const layer = makeClusterLayer(points);

    const renderEngine = {
      setClusterSource: vi.fn(),
      drawClusters: vi.fn(),
    } as unknown as IRenderEngine;

    const layerManager = {
      getLayer: vi.fn().mockReturnValue(layer),
    } as unknown as LayerManager;

    const callbacks: ClusterViewCallbacks = {
      toMap: () => [0, 0],
      getZoom: () => 5,
      getExtent: () => [0, 0, 10, 10],
    };

    renderClusterLayer(
      layer.id,
      renderEngine,
      layerManager,
      5,
      [0, 0, 10, 10],
      false,
      callbacks,
    );

    expect(renderEngine.setClusterSource).toHaveBeenCalledWith(layer.id, points, layer.sourceVersion);
    expect(renderEngine.drawClusters).toHaveBeenCalledWith(
      layer.id,
      layer.clusterStyle,
      layer.clusterRadius,
      layer.clusterMinPoints,
      5,
      [0, 0, 10, 10],
      false,
    );
  });
});
