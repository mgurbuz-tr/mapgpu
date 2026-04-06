---
title: Clock & Time
description: "JulianDate, Clock tick, SampledProperty interpolation. Play/pause, speed control, animated vehicle position."
icon: "\u23F1"
category: data-formats
tags: [Clock, JulianDate, SampledProperty, Temporal]
code: |
  import { MapView, JulianDate, Clock, SampledProperty } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer, GraphicsLayer } from '@mapgpu/layers';

  const toolbar = document.getElementById('toolbar')!;

  const view = new MapView({
    container: document.getElementById('map-container')!,
    center: [29.5, 41],
    zoom: 9,
    renderEngine: new RenderEngine(),
  });

  await view.when();

  view.map.add(new RasterTileLayer({
    id: 'osm',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  }));

  const markerLayer = new GraphicsLayer({ id: 'marker' });
  view.map.add(markerLayer);

  // Clock with 1-hour range, 60x speed (1 min/sec)
  const start = JulianDate.fromIso8601('2024-01-01T00:00:00Z');
  const stop = JulianDate.fromIso8601('2024-01-01T01:00:00Z');
  const clock = new Clock({
    startTime: start,
    stopTime: stop,
    currentTime: start.clone(),
    multiplier: 60,
    clockRange: 'LOOP_STOP',
  });

  // Sampled position: vehicle moving along 4 keyframes
  const position = new SampledProperty(2, 'linear');
  position.addSample(start, [29.0, 41.0]);
  position.addSample(start.addSeconds(1200), [29.3, 41.1]);
  position.addSample(start.addSeconds(2400), [29.7, 41.05]);
  position.addSample(start.addSeconds(3600), [30.0, 41.0]);

  // Animate marker on each tick
  clock.on('tick', ({ time }) => {
    const pos = position.getValue(time);
    markerLayer.clear();
    markerLayer.add({
      id: 'vehicle',
      geometry: { type: 'Point', coordinates: [pos[0]!, pos[1]!] },
      attributes: {},
    });
  });

  // ── Toolbar: play/pause + speed ──
  const playBtn = document.createElement('button');
  playBtn.textContent = '⏸ Pause';
  playBtn.classList.add('active');
  playBtn.addEventListener('click', () => {
    if (clock.shouldAnimate) {
      clock.stop();
      playBtn.textContent = '▶ Play';
      playBtn.classList.remove('active');
    } else {
      clock.start();
      playBtn.textContent = '⏸ Pause';
      playBtn.classList.add('active');
    }
  });
  toolbar.appendChild(playBtn);

  const speedSelect = document.createElement('select');
  for (const s of [1, 10, 60, 300, 600]) {
    const opt = document.createElement('option');
    opt.value = String(s);
    opt.textContent = `${s}x`;
    if (s === 60) opt.selected = true;
    speedSelect.appendChild(opt);
  }
  speedSelect.addEventListener('change', () => {
    clock.multiplier = Number(speedSelect.value);
  });
  toolbar.appendChild(speedSelect);

  // Start the clock
  clock.start();
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers']
---
