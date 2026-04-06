/**
 * @mapgpu/adapters-ogc
 *
 * OGC service adapters — WMS, WFS, OGC API Features, OGC API Maps,
 * XYZ tile, Service Discovery, and shared types.
 */

// ─── Types ───
export type {
  IMapImageryAdapter,
  MapImageryCapabilities,
  MapImageryLayerInfo,
  MapImageryRequest,
  FeatureInfoRequest,
  FeatureInfoResult,
  ServiceCapabilities,
  IFeatureAdapter,
  FeatureCollectionInfo,
  FeatureQueryParams,
  GeoJsonFeature,
  OgcError,
  ServiceType,
  IServiceDiscovery,
} from './types.js';

// ─── WMS ───
export { parseWmsCapabilities } from './wms/capabilities-parser.js';
export { buildGetMapUrl, buildGetFeatureInfoUrl } from './wms/url-builder.js';
export { WmsAdapter } from './wms/wms-adapter.js';
export type { WmsAdapterOptions } from './wms/wms-adapter.js';
export type {
  WmsCapabilities,
  WmsLayerInfo,
  WmsStyle,
  WmsBoundingBox,
  WmsTimeDimension,
  GetMapParams,
  GetFeatureInfoParams,
} from './wms/types.js';

// ─── WFS ───
export { parseWfsCapabilities } from './wfs/capabilities-parser.js';
export { buildGetFeatureUrl, buildDescribeFeatureTypeUrl } from './wfs/url-builder.js';
export { WfsAdapter, parseGmlFeatures } from './wfs/wfs-adapter.js';
export type { WfsAdapterOptions } from './wfs/wfs-adapter.js';
export type {
  WfsCapabilities,
  WfsFeatureType,
  WfsBoundingBox,
  WfsQueryParams,
} from './wfs/types.js';

// ─── OGC API Features ───
export { OgcApiFeaturesAdapter } from './ogc-api-features/ogc-api-features-adapter.js';
export type { OgcApiFeaturesAdapterOptions } from './ogc-api-features/ogc-api-features-adapter.js';
export type {
  OgcApiCollection,
  OgcApiLink,
  OgcApiCollectionsResponse,
  OgcApiItemsResponse,
} from './ogc-api-features/types.js';

// ─── OGC API Maps ───
export { OgcApiMapsAdapter } from './ogc-api-maps/ogc-api-maps-adapter.js';
export type { OgcApiMapsAdapterOptions } from './ogc-api-maps/ogc-api-maps-adapter.js';

// ─── XYZ ───
export { XyzAdapter } from './xyz/xyz-adapter.js';
export type { XyzAdapterOptions } from './xyz/xyz-adapter.js';

// ─── Service Discovery ───
export { ServiceDiscovery, detectFromUrlPattern } from './discovery/service-discovery.js';
export type { ServiceDiscoveryOptions } from './discovery/service-discovery.js';

// ─── KML ───
export { parseKml } from './kml/KmlParser.js';
export type { KmlFeature, KmlGeometry, KmlStyle, KmlParseResult } from './kml/KmlParser.js';

// ─── GPX ───
export { parseGpx, gpxToFeatures } from './gpx/GpxParser.js';
export type { GpxFeature, GpxGeometry, GpxParseResult } from './gpx/GpxParser.js';

// ─── CZML ───
export { parseCzml } from './czml/CzmlParser.js';
export type { CzmlFeature, CzmlGeometry, CzmlSampledPosition, CzmlParseResult, CzmlClock } from './czml/CzmlParser.js';

// ─── Imagery Providers ───
export { BingMapsProvider } from './imagery/BingMapsProvider.js';
export type { BingMapsProviderOptions } from './imagery/BingMapsProvider.js';
export { MapboxProvider } from './imagery/MapboxProvider.js';
export type { MapboxProviderOptions } from './imagery/MapboxProvider.js';
export { ArcGISProvider } from './imagery/ArcGISProvider.js';
export type { ArcGISProviderOptions } from './imagery/ArcGISProvider.js';
export { WMTSProvider } from './imagery/WMTSProvider.js';
export type { WMTSProviderOptions } from './imagery/WMTSProvider.js';
export type { IImageryProvider, ImageryProviderMetadata } from './imagery/ImageryProviderTypes.js';
