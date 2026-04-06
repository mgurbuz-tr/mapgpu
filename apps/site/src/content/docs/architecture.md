---
title: Architecture
order: 2
section: Architecture
---

## Layered Architecture

MapGPU follows a strict four-layer architecture where each layer has clear responsibilities and boundaries.

```
┌──────────────────────────────────────────────────────┐
│  APPLICATION LAYER                                    │
│  Widgets · Commands · Panels · Search UI              │
│  → No GPU or WASM code                               │
│  → Communicates only via Public SDK                   │
└────────────────────────┬─────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────┐
│  PUBLIC SDK (TypeScript — @mapgpu/core)               │
│  MapView · Layer API · Widget API · Event System      │
│  → User-facing surface                                │
│  → All async operations are Promise-based             │
│  → State ownership lives here                         │
└──────┬─────────────────────────┬─────────────────────┘
       │                         │
┌──────▼──────────────┐  ┌──────▼──────────────────────┐
│  ENGINE (TypeScript)  │  │  SPATIAL CORE (Rust/WASM)   │
│  Render graph         │  │  Triangulation               │
│  Tile scheduler       │  │  Tessellation                │
│  Camera controller    │  │  Clustering                  │
│  Scene graph          │  │  Projection math             │
│  Layer lifecycle      │  │  Spatial indexing             │
└──────┬────────────────┘  └──────────────────────────────┘
       │
┌──────▼───────────────────────────────────────────────┐
│  GPU CORE (WebGPU/WGSL — @mapgpu/render-webgpu)      │
│  Pipelines: point, line, polygon, raster, model, ...  │
│  Resources: GPUBuffer pool, texture atlas, bind groups│
└──────────────────────────────────────────────────────┘
```

## Responsibility Boundaries

| Operation | TypeScript | Rust/WASM | WebGPU/WGSL |
|-----------|:---------:|:---------:|:-----------:|
| User API surface | ✅ | | |
| Widget lifecycle | ✅ | | |
| Layer state management | ✅ | | |
| Camera/view state | ✅ | | |
| Tile scheduling | ✅ | | |
| Geometry triangulation | | ✅ | |
| Polygon tessellation | | ✅ | |
| Spatial index creation | | ✅ | |
| Clustering | | ✅ | |
| Render execution | | | ✅ |
| Shader computation | | | ✅ |
| GPU picking pass | | | ✅ |

## Data Flow — GeoJSON Layer

```
1. User:         map.add(new GeoJSONLayer({ url }))
2. core:         HTTP fetch → GeoJSON response
3. wasm-core:    triangulate_polygons() → vertex + index arrays
4. wasm-core:    build_spatial_index() → R-tree
5. core:         GPUBuffer upload
6. render-webgpu: polygon-fill + line + point pipelines
7. Interaction:  picking-pipeline → feature id → highlight
```

## Data Flow — WMS Layer

```
1. User:         map.add(new WMSLayer({ url, layers }))
2. adapters-ogc: GetCapabilities → parse capabilities
3. core:         Tile scheduler → compute visible tiles
4. core:         WMS GetMap URLs generated (BBOX, SRS, SIZE)
5. Network:      PNG/JPG tile response
6. core:         ImageBitmap decode
7. render-webgpu: GPUTexture upload → raster pipeline → draw
```

## Render Frame Flow

Every frame (via `requestAnimationFrame`):

1. Check if view state has changed
2. Get dirty layer list
3. Evaluate render graph
4. Determine draw call order from layer z-order
5. `GPUCommandEncoder.beginRenderPass()`
6. For each layer, call the appropriate pipeline (imagery/polygon/line/point)
7. Text/glyph pass (labels — always on top)
8. Post-process pass (optional)
9. `GPUCommandEncoder.finish()` → `queue.submit()`

> **Note:** The render pass order is NOT fixed by pipeline type. The user's layer stack determines draw order. Labels and post-processing always run last.

## Memory Model

### GPU Memory
- **Persistent Buffer Pool** — vertex, instance, and uniform buffers (reused across frames)
- **Transient Buffer Pool** — per-frame uniforms, camera matrices (recycled each frame)
- **Texture Atlas Pool** — sprite atlas, glyph atlas, terrain/imagery tile cache with LRU eviction

### CPU/WASM Memory
- WASM linear memory: starts at 64MB, max 512MB (configurable)
- Spatial index per layer: R-tree (Hilbert curve optimized)
- Feature binary store: SoA (Structure of Arrays) layout
- Tile cache: LRU, configurable max tile count

## Strategy Pattern — View Modes

MapGPU uses the Strategy pattern for 2D/3D switching:

```
MapView (unified public API)
  └── ViewCore (shared infrastructure)
        ├── Mode2D (CameraController2D + InteractionHandler)
        └── Mode3D (GlobeProjection + GlobeInteraction)
```

- **MapView** — Unified entry point with `switchTo('2d' | '3d')`
- **ViewCore** — Shared canvas, render engine, tile/layer managers
- **IViewMode** — Strategy interface defining ViewState, RenderFrameContext, GoToTarget
- Modes are hot-swappable at runtime without losing layer state
