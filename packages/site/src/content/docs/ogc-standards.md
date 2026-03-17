---
title: OGC Standards
order: 3
section: Standards
---

## Supported Standards

### Phase 1 (Current)

| Standard | Version | Support Level |
|----------|---------|---------------|
| WMS | 1.1.1, 1.3.0 | Full (read) |
| GeoJSON | RFC 7946 | Full |
| XYZ / Slippy Map Tiles | — | Full |
| OGC API - Features | Part 1: Core | Basic consumption |
| OGC API - Maps | Part 1: Core | Basic consumption |

### Phase 2 (Planned)

| Standard | Version | Support Level |
|----------|---------|---------------|
| WFS | 2.0.0 | Read (GetFeature) |
| WMTS | 1.0.0 | RESTful + KVP |
| Mapbox Vector Tiles (MVT) | 2.1 | Decode + render |

### Phase 3 (Future)

| Standard | Version |
|----------|---------|
| 3D Tiles | 1.1 |
| glTF | 2.0 |
| CoverageJSON | 0.6 |

## WMS Integration

MapGPU's WMS adapter handles both version 1.1.1 and 1.3.0 with automatic version detection.

### Key Version Differences

| Parameter | WMS 1.1.1 | WMS 1.3.0 |
|-----------|-----------|-----------|
| CRS parameter | `SRS=EPSG:4326` | `CRS=EPSG:4326` |
| BBOX order (4326) | lon,lat,lon,lat | **lat,lon,lat,lon** |
| Exception format | `INIMAGE` | `XML` |

> **Critical:** For EPSG:4326, WMS 1.3.0 reverses the BBOX coordinate order to lat,lon. The adapter handles this automatically.

### Usage

```typescript
import { WMSLayer } from '@mapgpu/layers';

const wmsLayer = new WMSLayer({
  id: 'boundaries',
  url: 'https://example.com/wms',
  layers: 'admin_boundaries,roads',
  transparent: true,
  format: 'image/png',
});

view.map.add(wmsLayer);
```

### GetFeatureInfo

```typescript
// Click query
const result = await wmsLayer.getFeatureInfo({
  x: clickX,
  y: clickY,
  format: 'application/geo+json',
});
```

## OGC API - Features

Modern REST-based alternative to WFS:

```typescript
import { OGCFeatureLayer } from '@mapgpu/layers';

const layer = new OGCFeatureLayer({
  id: 'admin',
  url: 'https://api.example.com/collections/admin',
  limit: 1000,
});

view.map.add(layer);
```

### Endpoint Pattern

```
GET /collections                         → Collection list
GET /collections/{id}/items              → Feature list (GeoJSON)
GET /collections/{id}/items?bbox=...     → Spatial filter
GET /collections/{id}/items?datetime=... → Temporal filter
```

## CORS Handling

Many enterprise WMS/WFS services don't return CORS headers. MapGPU provides a proxy option:

```typescript
// Per-layer proxy
new WMSLayer({
  url: 'https://internal-gis.company.com/wms',
  proxyUrl: 'https://my-proxy.example.com/ogc-proxy',
});

// Global proxy
mapgpu.config.proxyUrl = 'https://my-proxy.example.com/ogc-proxy';
```
