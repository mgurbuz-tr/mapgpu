---
title: Coordinate Systems
order: 4
section: Architecture
---

## Overview

MapGPU uses two primary coordinate reference systems:

| Context | CRS | Convention |
|---------|-----|-----------|
| Public API | EPSG:4326 (WGS84) | `[longitude, latitude]` — GeoJSON standard |
| Render Core | EPSG:3857 (Web Mercator) | Projected coordinates for rendering |

All user-facing APIs accept and return `[longitude, latitude]` coordinates following the GeoJSON RFC 7946 convention.

## Coordinate Flow

```
User Input [lon, lat]  (EPSG:4326)
        │
        ▼
   lonLatToMercator()  (EPSG:3857)
        │
        ▼
   Render Pipeline     (pixel coordinates)
        │
        ▼
   Screen [x, y]
```

## EPSG:4326 — WGS84

- Geographic coordinate system
- Units: degrees
- Longitude range: -180 to 180
- Latitude range: -90 to 90
- Used in GeoJSON, GPS, and most user-facing contexts

## EPSG:3857 — Web Mercator

- Projected coordinate system
- Units: meters
- X range: -20037508.34 to 20037508.34
- Y range: -20037508.34 to 20037508.34 (clipped at ~85.06° latitude)
- Standard for web map tiles (OSM, Google, Mapbox)

## Globe Coordinate Convention

In globe mode (Mode3D), an additional coordinate space is used:

| Space | Range | Description |
|-------|-------|-------------|
| Mercator [0..1] | X: 0→1, Y: 0→1 | Normalized Mercator (Y=0 is north) |
| Angular | lon: -π→π, lat: -π/2→π/2 | Radians |
| Unit Sphere | radius = 1 | Cartesian XYZ |

The shader converts: **Tile UV → Mercator [0..1] → Angular → Unit Sphere**

```
// Y-flip convention (critical):
// Globe vector pipelines use 1.0 - y to convert
// EPSG:3857 Y-up to mercatorToAngular's Y=0=north convention
```

## Projection Utilities

```typescript
import { lonLatToMercator, mercatorToLonLat } from '@mapgpu/core';

// Convert lon/lat to Mercator
const [mx, my] = lonLatToMercator(29.0, 41.0);

// Convert back
const [lon, lat] = mercatorToLonLat(mx, my);
```

## Tile Coordinates

Standard slippy map tile convention (XYZ):

```
Zoom 0: 1 tile (entire world)
Zoom N: 2^N × 2^N tiles

URL template: https://tile.example.com/{z}/{x}/{y}.png

TMS variant: {-y} flips the Y axis
```
