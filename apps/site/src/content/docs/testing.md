---
title: Testing Strategy
order: 5
section: Advanced
---

## Five-Layer Test Approach

MapGPU uses a comprehensive test strategy with five distinct layers:

### 1. Unit Tests (CI, no GPU)

- **Framework:** Vitest for TypeScript, `cargo test` for Rust
- **Scope:** Pure logic — projections, math, state machines, parsers
- **Co-located:** Tests live next to source files (`*.test.ts`)
- **Count:** ~1,500+ tests across 11 packages

```bash
pnpm run test:unit
```

### 2. WASM Binding Tests (CI, no GPU)

- **Framework:** `wasm-pack test`
- **Scope:** Verify Rust ↔ JS boundary works correctly
- **Tests:** TypedArray round-trips, error propagation, memory ownership

```bash
cd packages/wasm-core
wasm-pack test --node
```

### 3. WebGPU Logic Tests (CI, mock GPU)

- **Framework:** Vitest with mock GPUDevice
- **Scope:** Pipeline creation logic, buffer management, bind group layout
- **No real GPU required** — tests validate orchestration, not rendering

### 4. Visual/Render Tests (self-hosted GPU runner)

- **Framework:** Playwright + Chrome
- **Scope:** Pixel-level rendering verification
- **Process:** Render → screenshot → compare against baseline
- **Runner:** Requires a machine with GPU access

### 5. Benchmark Tests (self-hosted GPU runner)

- **Framework:** Playwright + Criterion (Rust)
- **Scope:** Performance regression detection
- **Metrics:** Frame time, pipeline creation time, WASM computation throughput

## Test Coverage by Package

| Package | Tests | Focus |
|---------|------:|-------|
| core-ts | 558 | MapView, ViewCore, modes, projections, renderers |
| render-webgpu | 261 | Pipelines, delegates, GLTF parser |
| layers | 213 | All layer types |
| widgets | 192 | 11 widget classes |
| tools | 136 | Drawing, measurement, snap engine |
| adapters-ogc | 106 | WMS, WFS, OGC API |
| wasm-core | 67 | Rust unit tests |
| analysis | 54 | LOS, viewshed, buffer |
| react | 50 | React wrapper components |
| testing | 21 | Test utilities |

## Running Tests

```bash
# All tests
pnpm run test

# Unit tests only (fast, no build required)
pnpm run test:unit

# Single package
pnpm --filter @mapgpu/core run test

# Rust tests
cd packages/wasm-core && cargo test
```
