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

// ─── Logger utility ───

function log(message: string): void {
  console.log(`[wms-layer] ${message}`);
  const logEl = document.getElementById('log');
  if (logEl) {
    const entry = document.createElement('div');
    entry.className = 'entry';
    const now = new Date().toLocaleTimeString();
    entry.innerHTML = `<span class="time">[${now}]</span> ${message}`;
    logEl.appendChild(entry);
    logEl.scrollTop = logEl.scrollHeight;
  }
}

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
      log(`  [mock] GetCapabilities -> ${serviceTitle} (${layerNames.length} layers)`);
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
      log(`  [mock] GetFeatureInfo at pixel (${request.x}, ${request.y})`);
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

log('MapView created (Istanbul region, zoom 8)');

// ─── Add base layer ───

const osmLayer = new RasterTileLayer({
  id: 'osm-base',
  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  minZoom: 0,
  maxZoom: 19,
});
view.map.add(osmLayer);
log(`Base layer added: "${osmLayer.id}"`);

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
log(`WMS layer added: "${adminWmsLayer.id}" (layers: ${adminWmsLayer.layerNames.join(', ')})`);

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
log(`WMS layer added: "${landUseWmsLayer.id}" (opacity: ${landUseWmsLayer.opacity})`);

// ─── Load WMS layers (triggers capabilities fetch) ───

async function loadWmsLayers(): Promise<void> {
  log('Loading WMS layer capabilities...');

  try {
    await adminWmsLayer.load();
    const infos = adminWmsLayer.getLayerInfos();
    log(`  "${adminWmsLayer.id}" loaded: ${infos.length} layer(s) available`);
    for (const info of infos) {
      log(`    - ${info.name}: "${info.title}" (queryable: ${info.queryable})`);
    }

    // Demonstrate getTileUrl
    const extent = { minX: 28.5, minY: 40.8, maxX: 29.5, maxY: 41.2 };
    const tileUrl = adminWmsLayer.getTileUrl(extent, 256, 256);
    log(`  Sample GetMap URL: ${tileUrl.substring(0, 80)}...`);
  } catch (err) {
    log(`  Error loading admin WMS: ${err}`);
  }

  try {
    await landUseWmsLayer.load();
    log(`  "${landUseWmsLayer.id}" loaded successfully`);
  } catch (err) {
    log(`  Error loading land use WMS: ${err}`);
  }
}

void loadWmsLayers();

// ─── LayerList Widget ───

const layerListContainer = document.getElementById('layer-list-container')!;
const layerList = new LayerListWidget({
  position: 'manual',
});

layerList.mount(layerListContainer);
log('LayerListWidget mounted');

// Populate layer list
layerList.addLayer(osmLayer);
layerList.addLayer(adminWmsLayer);
layerList.addLayer(landUseWmsLayer);
log(`LayerList has ${layerList.layers.length} layers`);

// Listen to layer list events
layerList.on('layer-add', (layer) => {
  log(`LayerList event: layer added -> "${layer.id}"`);
});

layerList.on('layer-remove', (layer) => {
  log(`LayerList event: layer removed -> "${layer.id}"`);
});

layerList.on('layer-reorder', (data) => {
  log(`LayerList event: layer reordered -> "${data.layer.id}" to index ${data.newIndex}`);
});

// ─── Feature Info on Click ───

container.addEventListener('click', (e) => {
  const rect = container.getBoundingClientRect();
  const pixelX = e.clientX - rect.left;
  const pixelY = e.clientY - rect.top;
  const [lon, lat] = view.toMap(pixelX, pixelY);

  log(`Click at [${lon.toFixed(4)}, ${lat.toFixed(4)}] - querying feature info...`);

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
    ).then((result) => {
      log(`  FeatureInfo result: ${result.features.length} feature(s) found`);
      for (const feature of result.features) {
        const attrs = feature.attributes;
        const attrStr = Object.entries(attrs)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ');
        log(`    [${feature.layerName}] ${attrStr}`);
      }
    }).catch((err) => {
      log(`  FeatureInfo error: ${err}`);
    });
  } else {
    log('  Admin WMS layer not loaded yet; cannot query features.');
  }
});

// ─── Layer visibility toggle demo ───

view.on('layer-add', (data) => {
  log(`Map event: layer-add -> "${data.layer.id}" (visible: ${data.layer.visible})`);
});

view.on('layer-remove', (data) => {
  log(`Map event: layer-remove -> "${data.layer.id}"`);
});

// ─── Ready ───

void view.when().then(() => {
  log('View is ready.');
  log(`Total map layers: ${view.map.layers.length}`);
  log('Click anywhere on the map to simulate a GetFeatureInfo query.');
});
