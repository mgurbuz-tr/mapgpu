/**
 * WMS Layer Example
 *
 * Demonstrates:
 * - MapView + WMSLayer with mock adapter
 * - LayerListWidget for layer visibility control
 * - Feature info query on click (console.log)
 * - Multiple WMS layers from different services
 */

import { MapView } from '@mapgpu/core';
import type { IMapImageryAdapter, MapImageryCapabilities, FeatureInfoResult } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { WMSLayer, RasterTileLayer } from '@mapgpu/layers';
import { LayerListWidget } from '@mapgpu/widgets';

// ─── Mock WMS Adapter ───
// Since we don't have a real WMS server, we create a mock adapter that
// implements IMapImageryAdapter to demonstrate the API patterns.

function createMockWmsAdapter(serviceTitle: string, layerNames: string[]): IMapImageryAdapter {
  const capabilities: MapImageryCapabilities = {
    type: 'WMS' as const,
    version: '1.3.0',
    title: serviceTitle,
    formats: ['image/png', 'image/jpeg'],
    layers: layerNames.map((name) => ({
      name,
      title: `${name} layer`,
      queryable: true,
      extent: [25.0, 36.0, 45.0, 42.5] as [number, number, number, number],
      crs: ['EPSG:3857', 'EPSG:4326'],
      styles: [{ name: 'default', title: 'Default Style' }],
    })),
  };

  return {
    async getCapabilities(): Promise<MapImageryCapabilities> {
      return capabilities;
    },

    getMapUrl(request): string {
      const bbox = `${request.bbox.minX},${request.bbox.minY},${request.bbox.maxX},${request.bbox.maxY}`;
      const url = `http://localhost:8080/geoserver/ne/wms?` +
        `SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap` +
        `&LAYERS=${request.layers.join(',')}&CRS=${request.crs ?? 'EPSG:3857'}` +
        `&BBOX=${bbox}&WIDTH=${request.width}&HEIGHT=${request.height}` +
        `&FORMAT=${request.format ?? 'image/png'}`;
      return url;
    },

    async getFeatureInfo(request): Promise<FeatureInfoResult> {
      return {
        features: [
          {
            layerName: 'admin_boundaries',
            attributes: {
              name: 'Sample Feature',
              type: 'boundary',
              population: 15_000_000,
              province: 'Istanbul',
            },
          },
          {
            layerName: 'provinces',
            attributes: {
              name: 'Secondary Feature',
              type: 'road',
              road_class: 'primary',
            },
          },
        ],
      };
    },
  };
}

// ─── Initialize Map ───

const container = document.getElementById('map-container')!;

const view = new MapView({
  container,
  center: [29.0, 41.0],  // Istanbul region
  zoom: 8,
  renderEngine: new RenderEngine(),
});


// ─── Add base layer ───

const osmLayer = new RasterTileLayer({
  id: 'osm-base',
  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  minZoom: 0,
  maxZoom: 19,
});
view.map.add(osmLayer);

// ─── Add WMS layers ───

const adminAdapter = createMockWmsAdapter('Turkish Admin Boundaries', ['ne:states', 'states']);
const adminWmsLayer = new WMSLayer({
  id: 'wms-admin',
  url: 'https://mock-wms.example.com/admin/wms',
  layers: ['states', 'states'],
  format: 'image/png',
  transparent: true,
  crs: 'EPSG:3857',
  adapter: adminAdapter,
});

view.map.add(adminWmsLayer);

const landUseAdapter = createMockWmsAdapter('Land Use Classification', ['land_use']);
const landUseWmsLayer = new WMSLayer({
  id: 'wms-landuse',
  url: 'https://mock-wms.example.com/landuse/wms',
  layers: ['land_use'],
  format: 'image/png',
  transparent: true,
  adapter: landUseAdapter,
  opacity: 0.6,
});

view.map.add(landUseWmsLayer);

// ─── Load WMS layers (triggers capabilities fetch) ───

async function loadWmsLayers(): Promise<void> {
  try {
    await adminWmsLayer.load();
  } catch {
    // WMS load error
  }

  try {
    await landUseWmsLayer.load();
  } catch {
    // WMS load error
  }
}

void loadWmsLayers();

// ─── LayerList Widget ───

const layerListContainer = document.getElementById('layer-list-container')!;
const layerList = new LayerListWidget({
  position: 'manual',
});

layerList.mount(layerListContainer);

// Populate layer list
layerList.addLayer(osmLayer);
layerList.addLayer(adminWmsLayer);
layerList.addLayer(landUseWmsLayer);


// ─── Feature Info on Click ───

container.addEventListener('click', (e) => {
  const rect = container.getBoundingClientRect();
  const pixelX = e.clientX - rect.left;
  const pixelY = e.clientY - rect.top;
  const [lon, lat] = view.toMap(pixelX, pixelY);


  // Query the admin WMS layer for feature info
  if (adminWmsLayer.loaded) {
    const queryExtent = {
      minX: lon - 0.5,
      minY: lat - 0.5,
      maxX: lon + 0.5,
      maxY: lat + 0.5,
    };

    void adminWmsLayer.getFeatureInfo(
      Math.round(pixelX), Math.round(pixelY),
      queryExtent, 256, 256,
    ).catch(() => { /* feature info query error */ });
  }
});

// ─── 2D/3D Mode Toggle ───
document.getElementById("btn-3d")!.addEventListener("click", async () => {
  const newMode = view.mode === "2d" ? "3d" : "2d";
  await view.switchTo(newMode);
  (document.getElementById("btn-3d") as HTMLButtonElement).textContent = `Switch to ${view.mode === "2d" ? "3D" : "2D"}`;
});

