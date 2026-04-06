---
title: KML Parser
description: "Parse KML XML data -- Placemarks, Styles, ExtendedData. Point, LineString, Polygon geometries rendered on map."
icon: "\U0001F30D"
category: data-formats
tags: [KML, parseKml, Style, Placemark]
code: |
  import { MapView } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer, GraphicsLayer } from '@mapgpu/layers';
  import { parseKml } from '@mapgpu/adapters-ogc';

  const view = new MapView({
    container: document.getElementById('map-container')!,
    center: [30, 40], zoom: 6, renderEngine: new RenderEngine(),
  });

  view.map.add(new RasterTileLayer({ id: 'osm', urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' }));
  const dataLayer = new GraphicsLayer({ id: 'kml-data' });
  view.map.add(dataLayer);

  await view.when();

  const kml = `<?xml version="1.0" encoding="UTF-8"?>
  <kml xmlns="http://www.opengis.net/kml/2.2">
    <Document>
      <name>Turkey Cities</name>
      <Placemark id="ist"><name>Istanbul</name><description>Largest city</description>
        <Point><coordinates>28.98,41.01,0</coordinates></Point></Placemark>
      <Placemark id="ank"><name>Ankara</name><description>Capital</description>
        <Point><coordinates>32.85,39.92,0</coordinates></Point></Placemark>
      <Placemark id="route"><name>Istanbul-Ankara Route</name>
        <LineString><coordinates>28.98,41.01,0 30.5,40.5,0 32.85,39.92,0</coordinates></LineString>
      </Placemark>
      <Placemark id="area"><name>Marmara Region</name>
        <Polygon><outerBoundaryIs><LinearRing>
          <coordinates>27,40 30,40 30,41.5 27,41.5 27,40</coordinates>
        </LinearRing></outerBoundaryIs></Polygon>
      </Placemark>
    </Document>
  </kml>`;

  const result = parseKml(kml);
  for (const f of result.features) {
    dataLayer.add({ id: f.id, geometry: f.geometry, attributes: f.attributes });
  }
  console.log(`Parsed "${result.name}" -- ${result.features.length} features`);
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers', '@mapgpu/adapters-ogc']
---
