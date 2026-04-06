---
title: Post-Processing
description: "Bloom, HDR tone mapping (ACES/Reinhard), SSAO, FXAA configuration with resolvePostProcessConfig."
icon: "\u2728"
category: advanced
tags: [Bloom, HDR, SSAO, FXAA, PostProcess]
code: |
  import { MapView } from '@mapgpu/core';
  import { RenderEngine, resolvePostProcessConfig } from '@mapgpu/render-webgpu';
  import { RasterTileLayer } from '@mapgpu/layers';

  const view = new MapView({
    container: document.getElementById('map-container')!,
    center: [29, 41], zoom: 12, renderEngine: new RenderEngine(),
  });

  view.map.add(new RasterTileLayer({ id: 'osm', urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' }));

  await view.when();

  // Build a post-process configuration with bloom, HDR, SSAO, and FXAA
  const config = resolvePostProcessConfig({
    enabled: true,
    bloom: { enabled: true, threshold: 0.8, intensity: 0.5 },
    hdr: { enabled: true, exposure: 1.0, toneMapping: 'aces' },
    ssao: { enabled: true, radius: 0.5 },
    fxaa: { enabled: true },
  });

  console.log('PostProcess config:', {
    bloom: `enabled=${config.bloom.enabled}, threshold=${config.bloom.threshold}`,
    hdr: `enabled=${config.hdr.enabled}, exposure=${config.hdr.exposure}`,
    ssao: `enabled=${config.ssao.enabled}, radius=${config.ssao.radius}`,
    fxaa: `enabled=${config.fxaa.enabled}`,
  });
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers']
---
