---
title: Getting Started
order: 1
section: Getting Started
---

## Installation

MapGPU is distributed as a set of npm packages. Install the core packages:

```bash
npm install @mapgpu/core @mapgpu/layers @mapgpu/render-webgpu
```

Or with pnpm:

```bash
pnpm add @mapgpu/core @mapgpu/layers @mapgpu/render-webgpu
```

## Prerequisites

- **Node.js** >= 20
- **Browser** with WebGPU support (Chrome 113+, Edge 113+, Firefox Nightly)
- **TypeScript** 5.7+ recommended (strict mode)

## Quick Start

Create a minimal map with an OpenStreetMap basemap:

```typescript
import { MapView } from '@mapgpu/core';
import { RasterTileLayer } from '@mapgpu/layers';

const view = new MapView({
  container: 'map',
  zoom: 4,
  center: [29, 41], // Istanbul [lon, lat]
});

const osm = new RasterTileLayer({
  id: 'osm',
  title: 'OpenStreetMap',
  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
});

view.map.add(osm);
```

```html
<div id="map" style="width: 100%; height: 100vh;"></div>
```

## Package Overview

| Package | Description |
|---------|-------------|
| `@mapgpu/core` | MapView, event system, projections, renderers |
| `@mapgpu/layers` | GeoJSON, RasterTile, WMS, Graphics, WGSLLayer |
| `@mapgpu/render-webgpu` | WebGPU render engine, shader pipelines |
| `@mapgpu/adapters-ogc` | WMS, WFS, OGC API adapters |
| `@mapgpu/widgets` | LayerList, ScaleBar, Coordinates, Legend, Popup |
| `@mapgpu/analysis` | LOS, viewshed, buffer, route sampling |
| `@mapgpu/tools` | Drawing tools, measurement, snapping |
| `@mapgpu/wasm-core` | Rust/WASM: projection, triangulation, clustering |

## Adding a GeoJSON Layer

```typescript
import { GeoJSONLayer } from '@mapgpu/layers';

const layer = new GeoJSONLayer({
  id: 'cities',
  title: 'World Cities',
  url: '/data/cities.geojson',
  renderer: {
    type: 'simple',
    symbol: { type: 'point', size: 8, color: [255, 109, 58, 255] },
  },
});

view.map.add(layer);
```

## 3D Globe Mode

Switch to globe mode with a single call:

```typescript
// Start in 2D
const view = new MapView({
  container: 'map',
  mode: '2d',
});

// Switch to 3D globe
await view.switchTo('3d');

// Fly to a location
await view.goTo({
  center: [29, 41],
  zoom: 5,
  pitch: 45,
  bearing: -20,
});
```

## What's Next?

- **[Architecture](/docs/architecture)** — Understand the layered system
- **[Coordinate Systems](/docs/coordinate-systems)** — CRS, projections, conventions
- **[Examples](/examples)** — Interactive demos with source code
- **[API Reference](/api)** — Package-level API documentation
