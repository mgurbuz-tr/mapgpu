---
title: WebGPU & Shaders
order: 7
section: Advanced
---

## WebGPU Pipeline Architecture

MapGPU's render engine is built on WebGPU with a delegate-based architecture:

### Draw Delegates

Each visual type has a dedicated delegate responsible for lazy pipeline initialization and draw calls:

| Delegate | Pipeline(s) | Purpose |
|----------|------------|---------|
| DrawDelegateRaster | raster-imagery | Tile imagery rendering |
| DrawDelegatePolygon | polygon-fill | Filled polygons |
| DrawDelegateLine | line | Solid, dashed, animated lines |
| DrawDelegatePoint | point-symbol, icon | Circle markers, icon symbols |
| DrawDelegateModel | model, globe-model | 3D GLTF/GLB models |
| DrawDelegateCustom | custom | User-defined WGSL shaders |

### Frame Context

A shared `FrameContext` object provides centralized GPU state to all delegates:

```typescript
interface FrameContext {
  device: GPUDevice;
  encoder: GPUCommandEncoder;
  passEncoder: GPURenderPassEncoder;
  cameraBuffer: GPUBuffer;
  viewState: ViewState;
  // ...
}
```

## Custom Shaders (WGSLLayer)

Write your own vertex/fragment shaders via `WGSLLayer`:

```typescript
import { WGSLLayer } from '@mapgpu/layers';

const layer = new WGSLLayer({
  id: 'particles',
  vertexShader: `
    @vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
      // Your vertex shader
    }
  `,
  fragmentShader: `
    @fragment fn fs() -> @location(0) vec4f {
      return vec4f(1.0, 0.4, 0.2, 1.0);
    }
  `,
  vertexCount: 1000,
  topology: 'point-list',
});
```

In globe mode (Mode3D), the preamble automatically includes `projectMercator()` with the Y-flip convention.

## WebGPU Capability Detection

MapGPU automatically detects GPU capabilities at initialization:

```typescript
// Auto-detected
const caps = await detectCapabilities();
// caps.mode: 'full-gpu' | 'gpu-lite' | 'cpu-degraded'
```

### Feature Detection

| Feature | Required | Usage |
|---------|---------|-------|
| Basic WebGPU | Yes | Core rendering |
| `timestamp-query` | No | Performance profiling |
| `float32-filterable` | No | Advanced texture filtering |
| `shader-f16` | No | Half-precision optimization |

## GPU Device Lost Handling

MapGPU handles GPU device loss (tab backgrounding, driver crash) with automatic recovery:

1. Release all GPU resources
2. Request new adapter + device
3. Recreate all pipelines
4. Re-upload textures from tile cache
5. Emit `'device-recovered'` or `'device-lost'` event

```typescript
view.on('error', (err) => {
  if (err.kind === 'webgpu-device-lost') {
    console.log('GPU device lost:', err.message);
  }
});
```
