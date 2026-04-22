# MapGPU Roadmap

This document tracks the direction of MapGPU. Items are grouped by stage, not by fixed dates — priorities shift as feedback arrives. If something here matters to you, open an issue or reach out: **mustafagurbuz@outlook.com.tr**.

Current version: **0.0.10** (pre-release)

---

## Shipped

Work that has landed on `main`.

### Architecture
- Consolidated 13-package monorepo into a single `mapgpu` npm package with subpath exports (`mapgpu`, `mapgpu/render`, `mapgpu/layers`, `mapgpu/adapters`, `mapgpu/widgets`, `mapgpu/analysis`, `mapgpu/tools`, `mapgpu/terrain`, `mapgpu/tiles3d`, `mapgpu/react`, `mapgpu/milsymbol`, `mapgpu/testing`, `mapgpu/wasm`).
- Rust/WASM core for projection, triangulation and clustering, packaged with the TS build.
- Render pipeline orchestration: stage-based `FrameOrchestrator`, `RenderPassRegistry`, `GpuResourceRegistry`.

### Rendering
- WebGPU 2D map + 3D globe with seamless mode switching.
- Dual-projection globe (Mercator + Vertical Perspective) inspired by MapLibre.
- Vector tile pipeline (MVT/PBF), raster tiles (XYZ/TMS), WMS/WFS adapters, GeoJSON.
- 3D buildings via fill-extrusion with directional lighting.
- glTF/GLB models with full PBR (Cook-Torrance BRDF, 5 texture maps).
- Custom WGSL shaders through `WGSLLayer`.
- Sprite atlas with tint color, rotation and per-category rendering; grid-based clustering with Canvas 2D labels.

### Terrain & 3D Tiles
- DTED + TerrainRGB elevation layers with hillshade overlay.
- 3D Tiles decoder (B3DM, I3DM, PNTS, CMPT) with SSE traversal.

### Tools, Analysis & Widgets
- Drawing tools (point, polyline, polygon) with vertex editing + snap engine.
- Measurement: geodesic distance, area, coordinate readout.
- Line-of-Sight, buffer and elevation queries.
- Widgets: LayerList, Legend, Popup, ScaleBar, Coordinates, Search, BasemapGallery.

### Quality
- SonarQube: 0 bugs, 0 code smells.
- Vitest coverage reporting wired up (~41% baseline, climbing).
- React bindings as a separate subpath export.

---

## In Progress

- **Test coverage** — raising unit + integration coverage above the current ~41% baseline, module by module.
- **API stability review** — auditing public exports ahead of the first `0.1.x` minor.
- **TypeDoc reference** — improving inline JSDoc so the generated API surface is self-contained.

---

## Planned — Next


- Improved diagnostics: frame-time overlay, GPU memory accounting, layer-level profiling hooks.
- Expanded terrain support: slope/aspect derivatives, terrain-anchored drawing.

---

## Planned — Later

Larger themes that will shape the library over time.

- **OGC coverage** — WMTS tile matrix sets, OGC API Coverages, richer WFS filter support.
- **3D Tiles** — I3DM instanced feature improvements, PNTS point-cloud styling, CDB compatibility.
- **Performance** — GPU-side culling, compute-shader line/polygon builders, texture streaming for terrain and tiles.
- **Globe** — atmosphere scattering, sun/moon lighting, high-altitude LOD.
- **Analysis** — viewshed, watershed, shortest-path, geodesic corridors.
- **Mil-symbol** — full MIL-STD-2525D coverage + configurable rendering pipeline.
- **Accessibility** — keyboard navigation, screen-reader annotations for widgets.

---

## Aspirational (v1.0)

- Stable, semver-guaranteed public API.
- Full WebGPU + WebGL2 adapter (for browsers without WebGPU).
- Offline-first tile + terrain pipelines.
- Plugin architecture for third-party layers, tools and adapters.

---

## Out of Scope

These are explicitly *not* goals for MapGPU, to keep the focus narrow:

- Being a drop-in replacement for any specific existing library (MapLibre, Cesium, ArcGIS).
- Server-side rendering or headless tile generation.
- A styling DSL that mirrors MapLibre Style Spec 1:1 — MapGPU will have its own styling model.

---

## Contributing & Feedback

- Issues and feature requests: GitHub issues (preferred for public discussion).
- Commercial licensing and support: **mustafagurbuz@outlook.com.tr**.
- This roadmap is a living document; pull requests that propose additions or re-ordering are welcome.
