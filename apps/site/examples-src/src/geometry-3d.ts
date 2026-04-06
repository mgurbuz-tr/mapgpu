/**
 * 3D Geometries Demo — Real 3D mesh rendering via dedicated Mesh3D pipeline.
 *
 * Box, Cylinder, Sphere, Cone rendered as true 3D meshes with Blinn-Phong lighting.
 * Uses Mesh3DSymbol → Mesh3DConverter → Mesh3D pipeline (NOT extrusion or model).
 */
import { MapView, SimpleRenderer } from '@mapgpu/core';
import type { Mesh3DSymbol, ExtrudedPolygonSymbol } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer, GraphicsLayer } from '@mapgpu/layers';
import { PlaceGeometryTool, makeRectFootprint, makeCircleFootprint } from '@mapgpu/tools';
import type { PlaceableGeometryType } from '@mapgpu/tools';

const view = new MapView({
  container: '#map-container',
  center: [29.02, 41.01],
  zoom: 14,
  renderEngine: new RenderEngine(),
});
view.map.add(new RasterTileLayer({ id: 'osm', urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' }));

const CX = 29.02, CY = 41.01;

// ─── Preset geometries via "Generate All" ───

void view.when().then(() => {
  document.getElementById('btn-generate')!.addEventListener('click', () => {
    const offsets: [number, number][] = [
      [-0.003, 0.002], [0, 0.002], [0.003, 0.002], [0, -0.002],
    ];

    const configs: { name: string; meshType: Mesh3DSymbol['meshType']; color: [number, number, number, number]; scale: [number, number, number] }[] = [
      { name: 'Box Tower', meshType: 'box', color: [255, 109, 58, 220], scale: [80, 200, 80] },
      { name: 'Cylinder Silo', meshType: 'cylinder', color: [88, 166, 255, 220], scale: [60, 150, 60] },
      { name: 'Sphere Dome', meshType: 'sphere', color: [188, 140, 255, 220], scale: [100, 100, 100] },
      { name: 'Cone Spire', meshType: 'cone', color: [63, 185, 80, 220], scale: [50, 180, 50] },
    ];

    configs.forEach((cfg, i) => {
      const layerId = `preset-${cfg.meshType}`;
      const old = view.map.findLayerById?.(layerId);
      if (old) view.map.remove(old);

      const layer = new GraphicsLayer({ id: layerId });
      layer.renderer = new SimpleRenderer({
        type: 'mesh-3d',
        meshType: cfg.meshType,
        color: cfg.color,
        scale: cfg.scale,
        ambient: 0.35,
        shininess: 32,
        specularStrength: 0.15,
      } satisfies Mesh3DSymbol);

      const [offLon, offLat] = offsets[i]!;
      layer.add({
        id: `geo-${cfg.meshType}`,
        geometry: { type: 'Point', coordinates: [CX + offLon, CY + offLat] },
        attributes: { name: cfg.name },
      });
      view.map.add(layer);
    });

    view.fitBounds([CX - 0.006, CY - 0.004, CX + 0.006, CY + 0.004]);
  });

  // ─── Interactive Draw ───
  const drawLayer = new GraphicsLayer({ id: 'drawn-geo' });
  const previewLayer = new GraphicsLayer({ id: '__place-preview__' });
  view.map.add(drawLayer);
  view.map.add(previewLayer);

  // Live 3D preview layer — updated every mouse move during extrusion
  const livePreviewLayer = new GraphicsLayer({ id: '__live-mesh-preview__' });
  view.map.add(livePreviewLayer);

  const placeTool = new PlaceGeometryTool({
    targetLayer: drawLayer,
    geometryType: 'cylinder',
  });

  // Live 3D preview — Box/Cylinder via extrusion, Cone/Sphere via Mesh3D
  placeTool.onExtrusionPreview = (center, radius, height, geoType) => {
    livePreviewLayer.clear();
    if (radius <= 0 || height <= 0) return;

    if (geoType === 'box' || geoType === 'cylinder') {
      // Extrusion preview — footprint polygon
      const ring = geoType === 'box'
        ? makeRectFootprint(center[0], center[1], radius, radius)
        : makeCircleFootprint(center[0], center[1], radius, 32);

      livePreviewLayer.renderer = new SimpleRenderer({
        type: 'fill-extrusion',
        color: [255, 165, 0, 140],
        heightField: 'height',
        minHeightField: 'minHeight',
        ambient: 0.4,
        shininess: 16,
        specularStrength: 0.1,
      } satisfies ExtrudedPolygonSymbol);

      livePreviewLayer.add({
        id: '__live-extrusion-preview__',
        geometry: { type: 'Polygon', coordinates: [ring] },
        attributes: { height, minHeight: 0 },
      });
    } else {
      // Mesh3D preview — smooth cone/hemisphere
      livePreviewLayer.renderer = new SimpleRenderer({
        type: 'mesh-3d',
        meshType: geoType,
        color: [255, 165, 0, 140],
        scale: [radius, height, radius],
        ambient: 0.4,
        shininess: 16,
        specularStrength: 0.1,
      } satisfies Mesh3DSymbol);

      livePreviewLayer.add({
        id: '__live-mesh-preview__',
        geometry: { type: 'Point', coordinates: center },
        attributes: {},
      });
    }
  };

  const tm = view.toolManager;
  tm.setPreviewLayer(previewLayer);
  tm.registerTool(placeTool);

  function updateDrawRenderer(type: PlaceableGeometryType) {
    drawLayer.renderer = new SimpleRenderer({
      type: 'mesh-3d',
      meshType: type,
      color: [255, 165, 0, 220],
      scale: [50, 100, 50],
      ambient: 0.35,
    } satisfies Mesh3DSymbol);
  }
  updateDrawRenderer('cylinder');

  const DRAW_TYPES: PlaceableGeometryType[] = ['box', 'cylinder', 'sphere', 'cone'];
  const drawBtns: Record<string, HTMLElement> = {
    box: document.getElementById('btn-box')!,
    cylinder: document.getElementById('btn-cylinder')!,
    sphere: document.getElementById('btn-sphere')!,
    cone: document.getElementById('btn-cone')!,
  };

  function activateDraw(type: PlaceableGeometryType) {
    placeTool.setGeometryType(type);
    updateDrawRenderer(type);
    tm.activateTool('place-geometry');
    for (const [t, btn] of Object.entries(drawBtns)) btn.classList.toggle('active', t === type);
  }

  for (const type of DRAW_TYPES) {
    drawBtns[type]!.addEventListener('click', (e) => { e.stopPropagation(); activateDraw(type); });
  }

  let drawCount = 0;
  tm.on('draw-complete', ({ feature }) => {
    drawCount++;
    const a = feature.attributes as Record<string, unknown>;
    const radius = (a['radius'] as number) || 50;
    const height = (a['height'] as number) || 100;
    const geoType = (a['geometryType'] as string) || 'cylinder';

    livePreviewLayer.clear();
    drawLayer.remove(feature.id);

    const layerId = `placed-${drawCount}`;
    const newLayer = new GraphicsLayer({ id: layerId });

    if (geoType === 'box' || geoType === 'cylinder') {
      // Polygon footprint → extrusion (footprint = geometry base, exact match)
      newLayer.renderer = new SimpleRenderer({
        type: 'fill-extrusion',
        color: [255, 165, 0, 220],
        heightField: 'height',
        minHeightField: 'minHeight',
        ambient: 0.35,
        shininess: 32,
        specularStrength: 0.15,
        animation: { duration: 600, easing: 'ease-out-cubic' },
      } satisfies ExtrudedPolygonSymbol);
    } else {
      // Point → Mesh3D pipeline (cone, hemisphere — smooth mesh from footprint)
      newLayer.renderer = new SimpleRenderer({
        type: 'mesh-3d',
        meshType: geoType as Mesh3DSymbol['meshType'],
        color: [255, 165, 0, 220],
        scale: [radius, height, radius],
        ambient: 0.35,
        shininess: 32,
        specularStrength: 0.15,
      } satisfies Mesh3DSymbol);
    }

    newLayer.add({
      id: `geo-placed-${drawCount}`,
      geometry: feature.geometry,
      attributes: { ...a, height, minHeight: 0 },
    });
    view.map.add(newLayer);
  });
});

// ─── 2D/3D Toggle ───
document.getElementById('btn-3d')!.addEventListener('click', async () => {
  const newMode = view.mode === '2d' ? '3d' : '2d';
  await view.switchTo(newMode);
  (document.getElementById('btn-3d') as HTMLButtonElement).textContent = `Switch to ${view.mode === '2d' ? '3D' : '2D'}`;
  if (view.mode === '3d') {
    view.goTo({ pitch: 60, zoom: 14, duration: 1000 });
  }
});
