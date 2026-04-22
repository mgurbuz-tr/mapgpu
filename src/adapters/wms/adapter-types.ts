/**
 * Re-export of core interface types used by the WMS adapter.
 *
 * These types mirror @mapgpu/core IOgcAdapter contract.
 * We re-export from a local definition to avoid circular dependencies
 * between packages during Faz 0.
 */

export type {
  IMapImageryAdapter,
  MapImageryCapabilities,
  MapImageryLayerInfo,
  MapImageryRequest,
  FeatureInfoRequest,
  FeatureInfoResult,
} from '../types.js';
