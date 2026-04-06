---
title: Custom WGSL Shader
description: User-defined WGSL vertex/fragment shaders via WGSLLayer. Animated polyline trail effect with GPU-side animation.
icon: "\u2728"
category: advanced
tags: [WGSLLayer, Custom Shader, WGSL, Animation]
code: |
  import { MapView, lonLatToMercator } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer, WGSLLayer } from '@mapgpu/layers';

  const VERTEX_SHADER = /* wgsl */ `
  struct CustomUniforms { halfWidth: f32, trailSpeed: f32, trailLength: f32, trailCycle: f32 };
  struct VertexOutput { @builtin(position) position: vec4<f32>, @location(0) vColor: vec4<f32>, @location(1) vDistSide: vec2<f32> };
  @vertex fn vs_main(
    @location(0) pos: vec2<f32>, @location(1) offset: vec2<f32>,
    @location(2) distSide: vec2<f32>, @location(3) color: vec4<f32>,
  ) -> VertexOutput {
    var out: VertexOutput;
    let clip = projectMercator(pos);
    if (clip.w < 0.0001) { out.position = vec4<f32>(0,0,0.5,1); out.vColor = vec4<f32>(0); out.vDistSide = vec2<f32>(0,100); return out; }
    let clipOff = projectMercator(pos + offset * 50000.0);
    let sc = clip.xy / clip.w; let so = clipOff.xy / clipOff.w;
    let dir = normalize((so - sc) * camera.viewport) / camera.viewport * custom.halfWidth * 2.0;
    out.position = vec4<f32>(clip.xy + dir * clip.w * distSide.y, clip.z, clip.w);
    out.vColor = color; out.vDistSide = distSide; return out;
  }`;

  const FRAGMENT_SHADER = /* wgsl */ `
  @fragment fn fs_main(@location(0) vColor: vec4<f32>, @location(1) vDistSide: vec2<f32>) -> @location(0) vec4<f32> {
    let phase = vDistSide.x - frame.time * custom.trailSpeed;
    let t = phase - custom.trailCycle * floor(phase / custom.trailCycle);
    let head = 1.0 - smoothstep(0.0, custom.trailLength, t);
    let edge = exp(-abs(vDistSide.y) * 3.0);
    let alpha = min(head * edge * frame.opacity * vColor.a, 0.85);
    if (alpha < 0.01) { discard; }
    return vec4<f32>(vColor.rgb * alpha, alpha);
  }`;

  const engine = new RenderEngine();
  const view = new MapView({
    container: document.getElementById('map-container')!,
    center: [32, 39.5], zoom: 6, renderEngine: engine,
  });

  await view.when();
  view.map.add(new RasterTileLayer({ id: 'osm', urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' }));

  const STRIDE = 28;
  const layer = new WGSLLayer({
    id: 'animated-lines', vertexShader: VERTEX_SHADER, fragmentShader: FRAGMENT_SHADER,
    vertexBufferLayouts: [{ arrayStride: STRIDE, stepMode: 'vertex', attributes: [
      { shaderLocation: 0, offset: 0, format: 'float32x2' as GPUVertexFormat },
      { shaderLocation: 1, offset: 8, format: 'float32x2' as GPUVertexFormat },
      { shaderLocation: 2, offset: 16, format: 'float32x2' as GPUVertexFormat },
      { shaderLocation: 3, offset: 24, format: 'unorm8x4' as GPUVertexFormat },
    ]}],
    animated: true, topology: 'triangle-list',
    blendState: { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                  alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } },
  });
  await layer.load();

  layer.setCustomUniforms(new Float32Array([4, 500000, 200000, 800000]));
  view.map.add(layer);
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers']
---
