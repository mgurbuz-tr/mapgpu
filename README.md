# MapGPU

**WebGPU-based GIS frontend library** for high-performance map rendering, OGC standards support, and spatial analysis.

Built with TypeScript, Rust/WebAssembly, and WGSL shaders.

---

## Features

- **WebGPU Rendering** — Hardware-accelerated 2D map and 3D globe with seamless mode switching
- **Vector & Raster Layers** — GeoJSON, MVT/PBF vector tiles, raster tiles (XYZ/TMS), WMS
- **3D Buildings** — Fill-extrusion from vector tiles with directional lighting
- **3D Models** — glTF/GLB with full PBR (Cook-Torrance BRDF, 5 texture maps)
- **Terrain** — DTED and TerrainRGB elevation with hillshade overlay
- **3D Tiles** — B3DM, I3DM, PNTS, CMPT decoder with SSE traversal
- **OGC Standards** — WMS, WFS, OGC API Features/Maps adapters
- **Drawing Tools** — Point, polyline, polygon with vertex editing and snap engine
- **Measurement** — Geodesic distance, area, and coordinate readout
- **Spatial Analysis** — Line of Sight, buffer, elevation queries
- **Widgets** — LayerList, Legend, Popup, ScaleBar, Coordinates, Search, BasemapGallery
- **Custom Shaders** — User-defined WGSL vertex/fragment shaders via WGSLLayer
- **Icon Symbology** — Sprite atlas, tint color, rotation with per-category rendering
- **Clustering** — Grid-based clustering with Canvas 2D labels
- **Globe** — MapLibre-inspired dual-projection (Mercator + Vertical Perspective)
- **React Bindings** — React components for MapGPU integration
- **Rust/WASM** — Projection, triangulation, and clustering in WebAssembly

## Packages

| Package | Description |
|---------|-------------|
| `@mapgpu/core` | Core types, interfaces, MapView engine, event system and coordinate utilities |
| `@mapgpu/render-webgpu` | WebGPU render engine, shader pipelines and draw delegates |
| `@mapgpu/layers` | GeoJSON, RasterTile, WMS, VectorTile, Graphics, WGSL layers |
| `@mapgpu/adapters-ogc` | WMS, WFS, and OGC API protocol adapters |
| `@mapgpu/widgets` | LayerList, Legend, Popup, ScaleBar, Coordinates, Search and more |
| `@mapgpu/analysis` | Line of Sight, buffer, elevation queries |
| `@mapgpu/tools` | Drawing and measurement tools with snap engine |
| `@mapgpu/terrain` | DTED and TerrainRGB elevation layers with hillshade |
| `@mapgpu/tiles3d` | 3D Tiles decoder: B3DM, I3DM, PNTS, CMPT with SSE traversal |
| `@mapgpu/wasm-core` | Rust/WASM: projection, triangulation, clustering |
| `@mapgpu/react` | React bindings for MapGPU components |
| `@mapgpu/testing` | Test utilities, fixtures and visual test helpers |
| `@mapgpu/examples` | Interactive example applications and demos |
| `@mapgpu/site` | Documentation website (Astro) |
| `@mapgpu/benchmarks` | Performance benchmarks |

## Quick Start

```bash
# Prerequisites: Node.js >= 20, pnpm 10.x, Rust toolchain (for WASM)
pnpm install
pnpm run build
pnpm run dev
```

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm run build` | Build all packages |
| `pnpm run dev` | Start dev server (examples: 5173, benchmarks: 5174, site: 4321) |
| `pnpm run test` | Run all tests |
| `pnpm run typecheck` | TypeScript type checking |
| `pnpm run lint` | ESLint |
| `pnpm run clean` | Clean build artifacts |

## Tech Stack

- **Language**: TypeScript (strict mode)
- **Rendering**: WebGPU + WGSL shaders
- **Compute**: Rust → WebAssembly (wasm-bindgen)
- **Monorepo**: pnpm workspaces + Turborepo
- **Testing**: Vitest (unit), Playwright (visual), criterion + proptest (Rust)
- **Site**: Astro (static)
- **CI**: GitHub Actions (Node 20/22 matrix)

## Docker

```bash
docker build -t mapgpu -f packages/site/Dockerfile .
docker run -p 3001:3001 mapgpu
```

Site: `http://localhost:3001` | Demos: `http://localhost:3001/demos/`

## License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](./LICENSE).

**Free** for personal, educational, research, and non-commercial use.

**Commercial use** requires a separate license. Contact: **mustafagurbuz@outlook.com.tr**
