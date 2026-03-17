---
title: Globe Architecture
order: 6
section: Architecture
---

## Overview

MapGPU's 3D globe system is inspired by MapLibre GL JS's dual-projection model. It replaces the original CesiumJS-style ECEF approach with a lighter, shader-based solution.

## Dual-Projection Model

The globe uses two projections that blend together:

- **MercatorProjection** — Standard web map projection (zoom > 6)
- **VerticalPerspectiveProjection** — Globe view from space (zoom < 5)

A `globeness` factor (0.0 = flat Mercator, 1.0 = full globe) smoothly transitions between them at zoom levels 5–6.

```
zoom < 5:  globeness = 1.0  (full globe)
zoom 5-6:  globeness = lerp  (transition)
zoom > 6:  globeness = 0.0  (flat mercator)
```

## Shader-Based Vertex Projection

Instead of pre-transforming vertices on the CPU, the globe shader projects vertices on the GPU:

```
Tile UV → Mercator [0..1] → Angular (radians) → Unit Sphere (xyz)
```

The `projectionTransition` uniform mixes flat and sphere positions:

```wgsl
let flatPos = mercatorToClip(uv);
let globePos = sphereToClip(angularToSphere(mercatorToAngular(uv)));
let finalPos = mix(flatPos, globePos, projectionTransition);
```

## Unit Sphere Convention

- **Radius = 1** — float32 is sufficient (no precision issues)
- **Y-up** coordinate system
- The sphere is centered at origin

## Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `GlobeProjection` | core-ts/src/engine/projections/ | Dual projection wrapper |
| `VerticalPerspectiveTransform` | core-ts/src/engine/projections/ | View-from-space matrix |
| `GlobeTileCovering` | core-ts/src/engine/projections/ | Visible tile computation for globe |
| `GlobeInteraction` | core-ts/src/engine/ | Pan/zoom/pitch/bearing input |
| `globe-raster-pipeline` | render-webgpu/src/pipelines/ | WGSL shader + pipeline |
| `subdivision-mesh` | render-webgpu/src/pipelines/ | Shared 32x32 grid mesh |

## Tile Manager Integration

Globe mode reuses the existing TileManager with a coordinate adapter:

```
GlobeTileCovering.getTilesForGlobe(viewState)
  → TileCoord[] (z/x/y)
  → TileManager.getReadyTilesForCoords(coords, sources)
  → ImageryTile[] (with EPSG:3857 extents)
  → Mode3D converts to Mercator [0..1] for shader
```

## Vector Features on Globe

Vector features (points, lines, polygons) are projected in the shader using the same `mercatorToAngular → angularToSphere` pipeline:

- **globe-point-pipeline** — Circle/icon rendering on sphere
- **globe-line-pipeline** — Line rendering with sphere projection
- **globe-polygon-pipeline** — Filled polygons on sphere surface

### Y-Flip Convention (Critical)

Globe vector pipelines apply `1.0 - y` to convert EPSG:3857 Y-up to the `mercatorToAngular` formula's Y=0=north convention. The raster pipeline does NOT flip — UV↔extent mapping compensates.

## WGSL Preamble Sharing

Common WGSL code blocks are shared across 17 pipelines via `wgsl-preambles.ts`:

- `WGSL_CAMERA_UNIFORMS` — 2D camera uniform struct
- `WGSL_GLOBE_CAMERA_UNIFORMS` — Globe camera + projection uniforms
- `WGSL_GLOBE_CONSTANTS` — Math constants (PI, HALF_PI)
- `WGSL_GLOBE_HELPERS` — `mercatorToAngular()`, `angularToSphere()` functions
- `WGSL_GLOBE_PREAMBLE` — Combined preamble for globe shaders
