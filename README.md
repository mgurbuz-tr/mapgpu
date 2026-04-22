# MapGPU

WebGPU-based high-performance map and globe visualization library.

MapGPU is distributed as a single npm package built with TypeScript, WGSL, and Rust/WebAssembly. Alongside the unified top-level API, it provides subpath entry points for `core`, `layers`, `render`, `adapters`, `analysis`, `widgets`, `tools`, `terrain`, `tiles3d`, `react`, `milsymbol`, `testing`, and `wasm`.

## Features

- WebGPU-accelerated 2D map and 3D globe rendering
- GeoJSON, raster tile, vector tile, WMS, imagery, and custom layer support
- Terrain, hillshade, and elevation workflows with DTED and Terrain RGB
- 3D Tiles, glTF/GLB models, and extrusion-based 3D scenes
- WMS, WFS, OGC API Features, and OGC API Maps adapters
- Drawing, measurement, vertex editing, and snapping tools
- Line of sight, buffer, elevation query, and route sampling analysis
- Framework-agnostic widgets and React components
- MIL-STD symbology integration
- Rust/WASM helpers for performance-critical workloads

## Installation

```bash
pnpm add mapgpu
```

If you are using React, `react` and `react-dom` are also required as peer dependencies.

## Package Layout

MapGPU is now published as a single package instead of multiple npm packages. Modules are consumed through subpath exports:

| Import path | Contents |
| --- | --- |
| `mapgpu` | Unified top-level entry point |
| `mapgpu/core` | Core types, engine, event system, geometry, and utilities |
| `mapgpu/render` | WebGPU render engine, atlas, pipelines, and GPU helpers |
| `mapgpu/layers` | GeoJSON, raster, vector tile, WMS, graphics, and other layers |
| `mapgpu/adapters` | WMS, WFS, OGC API, XYZ, KML, GPX, CZML, and imagery adapters |
| `mapgpu/analysis` | LOS, buffer, elevation, and obstacle providers |
| `mapgpu/widgets` | Framework-agnostic widgets |
| `mapgpu/tools` | Drawing, measurement, editing, and snapping tools |
| `mapgpu/terrain` | Terrain layers, parsers, and hillshade helpers |
| `mapgpu/tiles3d` | 3D Tiles parsing, traversal, and layer support |
| `mapgpu/react` | React wrappers, hooks, and declarative layer/widget components |
| `mapgpu/milsymbol` | MIL-STD symbology integration |
| `mapgpu/testing` | Test helpers, fixtures, and benchmark utilities |
| `mapgpu/wasm` | Compiled WASM bindings |

## Quick Start

### Using the unified entry point

```ts
import { MapView, GeoJSONLayer, RasterTileLayer } from 'mapgpu';

const view = new MapView({
  container: 'map',
  center: [29.0, 41.0],
  zoom: 8,
});

view.map.add(
  new RasterTileLayer({
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  }),
);

view.map.add(
  new GeoJSONLayer({
    data: {
      type: 'FeatureCollection',
      features: [],
    },
  }),
);
```

### Using subpath entry points

```ts
import { MapView } from 'mapgpu/core';
import { GeoJSONLayer, RasterTileLayer } from 'mapgpu/layers';
import { WmsAdapter } from 'mapgpu/adapters';
import { LosAnalysis } from 'mapgpu/analysis';
```

### Using React

```tsx
import { MapView, RasterTileLayer, ScaleBar } from 'mapgpu/react';

export function App() {
  return (
    <MapView center={[29.0, 41.0]} zoom={8}>
      <RasterTileLayer urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ScaleBar />
    </MapView>
  );
}
```

## Development

Requirements:

- Node.js 20+
- pnpm 10+
- Rust toolchain and `wasm-pack` if you are building the WASM package

Commands:

| Command | Description |
| --- | --- |
| `pnpm install` | Installs dependencies |
| `pnpm run build` | Builds the TypeScript, milsymbol, and React outputs |
| `pnpm run build:ts` | Builds the main TypeScript outputs |
| `pnpm run build:milsymbol` | Builds the `src/milsymbol` outputs |
| `pnpm run build:react` | Builds the React entry point outputs |
| `pnpm run build:wasm` | Builds the Rust package in `wasm/` into `wasm/pkg` |
| `pnpm run test` | Runs the full Vitest suite |
| `pnpm run test:watch` | Runs tests in watch mode |
| `pnpm run test:coverage` | Generates a coverage report |
| `pnpm run test:rust` | Runs Rust tests |
| `pnpm run lint` | Runs ESLint |
| `pnpm run typecheck` | Runs TypeScript type checking |
| `pnpm run clean` | Removes build artifacts |
| `pnpm run api:json` | Generates TypeDoc JSON output |

## Source Layout

```text
src/
  core/        Core engine, map/view, geometry, events, temporal structures
  render/      WebGPU render engine, pipelines, and GPU helpers
  layers/      Map layers
  adapters/    OGC and geodata parser/adapter layer
  analysis/    Spatial analysis modules
  widgets/     Framework-agnostic widgets
  tools/       Drawing, measurement, editing, and snapping tools
  terrain/     Elevation and hillshade modules
  tiles3d/     3D Tiles support
  react/       React components and hooks
  milsymbol/   MIL-STD symbology integration
  testing/     Test helpers
wasm/          Rust sources and generated WASM package files
```

## Tech Stack

- TypeScript
- WebGPU + WGSL
- Rust + WebAssembly
- Vitest
- ESLint
- TypeDoc

## License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](./LICENSE).

It is free for personal, educational, research, and other non-commercial use.

Commercial use requires a separate license. Contact: `mustafagurbuz@outlook.com.tr`
