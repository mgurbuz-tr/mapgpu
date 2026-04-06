/**
 * GeoJSON Layer Example — Points, Lines, Polygons
 */

import { MapView } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer, GeoJSONLayer } from '@mapgpu/layers';

// ─── Init ───

const container = document.getElementById('map-container')!;
const engine = new RenderEngine();
const view = new MapView({
  container,
  center: [32.0, 39.5],
  zoom: 6,
  renderEngine: engine,
});

// ─── 2D/3D Mode Toggle ───
document.getElementById("btn-3d")!.addEventListener("click", async () => {
  const newMode = view.mode === "2d" ? "3d" : "2d";
  await view.switchTo(newMode);
  (document.getElementById("btn-3d") as HTMLButtonElement).textContent = `Switch to ${view.mode === "2d" ? "3D" : "2D"}`;
});

void view.when().then(() => {
  if (!view.gpuReady) return;

  // ─── Step 1: OSM basemap ───
  view.map.add(new RasterTileLayer({
    id: 'osm',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  }));

  // ─── Step 2: GeoJSON Points ───
  setTimeout(() => {
    view.map.add(new GeoJSONLayer({
      id: 'cities',
      data: {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', id: 'istanbul', geometry: { type: 'Point', coordinates: [28.9784, 41.0082] }, properties: { name: 'Istanbul' } },
          { type: 'Feature', id: 'ankara', geometry: { type: 'Point', coordinates: [32.8597, 39.9334] }, properties: { name: 'Ankara' } },
          { type: 'Feature', id: 'izmir', geometry: { type: 'Point', coordinates: [27.1428, 38.4237] }, properties: { name: 'Izmir' } },
          { type: 'Feature', id: 'antalya', geometry: { type: 'Point', coordinates: [30.7133, 36.8969] }, properties: { name: 'Antalya' } },
          { type: 'Feature', id: 'trabzon', geometry: { type: 'Point', coordinates: [39.7168, 41.0027] }, properties: { name: 'Trabzon' } },
        ],
      },
    }));

    // ─── Step 3: GeoJSON LineString ───
    setTimeout(() => {
      view.map.add(new GeoJSONLayer({
        id: 'route',
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature', id: 'route-1',
              geometry: {
                type: 'LineString',
                coordinates: [
                  [28.9784, 41.0082],  // Istanbul
                  [32.8597, 39.9334],  // Ankara
                  [27.1428, 38.4237],  // Izmir
                  [30.7133, 36.8969],  // Antalya
                ],
              },
              properties: { name: 'West Route' },
            },
          ],
        },
      }));

      // ─── Step 4: GeoJSON Polygon ───
      setTimeout(() => {
        view.map.add(new GeoJSONLayer({
          id: 'region-solid',
          data: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature', id: 'central-solid',
                geometry: {
                  type: 'Polygon',
                  coordinates: [[
                    [29.2, 40.8],
                    [33.1, 40.8],
                    [33.1, 38.5],
                    [29.2, 38.5],
                    [29.2, 40.8],
                  ]],
                },
                properties: { name: 'Solid Polygon' },
              },
            ],
          },
        }));

        // ─── Step 5: GeoJSON Polygon (with hole) ───
        setTimeout(() => {
          view.map.add(new GeoJSONLayer({
            id: 'region-hole',
            data: {
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature', id: 'central-hole',
                  geometry: {
                    type: 'Polygon',
                    coordinates: [
                      // Outer ring
                      [
                        [33.8, 40.6],
                        [37.8, 40.6],
                        [37.8, 38.2],
                        [33.8, 38.2],
                        [33.8, 40.6],
                      ],
                      // Inner ring (hole)
                      [
                        [35.0, 39.8],
                        [36.6, 39.8],
                        [36.6, 38.9],
                        [35.0, 38.9],
                        [35.0, 39.8],
                      ],
                    ],
                  },
                  properties: { name: 'Polygon With Hole' },
                },
              ],
            },
          }));

        }, 2000);
      }, 2000);
    }, 2000);
  }, 2000);
});

