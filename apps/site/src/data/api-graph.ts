/**
 * api-graph.ts
 * Complete mapgpu public API graph data for the interactive diagram.
 */

export interface PackageDef {
  id: string;
  label: string;
  color: string;
  row: number;
  col: number;
  description: string;
}

export interface ClassDef {
  id: string;
  pkg: string;
  type: 'abstract' | 'class';
  parent?: string;
  methods: string[];
  props?: string[];
}

export interface EdgeDef {
  source: string;
  target: string;
  type: 'extends' | 'uses';
}

// ─── Packages ────────────────────────────────────────────────────────

// Layout: Wide horizontal grid — dependency flows left-to-right
// Col  0          1           2          3           4
// Row0 core-eng   core-mgr    render     adapters
// Row1 layers-a   layers-b    widgets    tools       terrain/analysis
export const packages: Record<string, PackageDef> = {
  'core-engine':  { id: 'core-engine',  label: '@mapgpu/core — Engine',     color: '#ff6d3a', row: 0, col: 0, description: 'MapView, ViewCore, camera, animation' },
  'core-mgr':     { id: 'core-mgr',     label: '@mapgpu/core — Managers',   color: '#ff8a5c', row: 0, col: 1, description: 'Layer, tile, tool managers & utilities' },
  render:         { id: 'render',        label: '@mapgpu/render-webgpu',     color: '#f47067', row: 0, col: 2, description: 'WebGPU render engine, pipelines, buffers' },
  adapters:       { id: 'adapters',      label: '@mapgpu/adapters-ogc',      color: '#79c0ff', row: 0, col: 3, description: 'WMS, WFS, OGC API protocol adapters' },
  'layers-base':  { id: 'layers-base',   label: '@mapgpu/layers — Raster',   color: '#58a6ff', row: 1, col: 0, description: 'Base layer, raster, WMS, vector tile' },
  'layers-feat':  { id: 'layers-feat',   label: '@mapgpu/layers — Feature',  color: '#539bf5', row: 1, col: 1, description: 'GeoJSON, graphics, heatmap, animated, custom' },
  widgets:        { id: 'widgets',       label: '@mapgpu/widgets',           color: '#3fb950', row: 1, col: 2, description: 'UI widgets (panels, popups, toolbars)' },
  tools:          { id: 'tools',         label: '@mapgpu/tools',             color: '#bc8cff', row: 1, col: 3, description: 'Drawing, measurement, editing tools' },
  analysis:       { id: 'analysis',      label: '@mapgpu/analysis',          color: '#d29922', row: 1, col: 4, description: 'LOS, buffer, elevation, route analysis' },
  terrain:        { id: 'terrain',       label: '@mapgpu/terrain',           color: '#56d364', row: 0, col: 4, description: 'DTED & TerrainRGB terrain rendering' },
};

// ─── Classes ─────────────────────────────────────────────────────────

export const classes: ClassDef[] = [
  // @mapgpu/core — Engine (left half)
  { id: 'MapView', pkg: 'core-engine', type: 'class',
    methods: ['switchTo(mode)', 'goTo(target, opts?)', 'hitTest(x, y)', 'getViewState()', 'on(event, handler)', 'destroy()'],
    props: ['container', 'mode', 'zoom', 'center', 'layerManager', 'toolManager'] },
  { id: 'ViewCore', pkg: 'core-engine', type: 'class',
    methods: ['initialize()', 'getDevice()', 'resize()', 'destroy()'],
    props: ['canvas', 'device', 'tileManager', 'layerManager'] },
  { id: 'CameraController2D', pkg: 'core-engine', type: 'class',
    methods: ['setZoom(zoom, pivot?)', 'pan(dx, dy)', 'rotate(delta)', 'getExtent()'],
    props: ['center', 'zoom', 'rotation', 'viewMatrix'] },
  { id: 'RenderLoop', pkg: 'core-engine', type: 'class',
    methods: ['start()', 'stop()', 'markDirty()', 'onFrame(cb)'] },
  { id: 'AnimationManager', pkg: 'core-engine', type: 'class',
    methods: ['animate(opts)', 'cancelAll()', 'update(timestamp)'] },
  { id: 'SceneGraph', pkg: 'core-engine', type: 'class',
    methods: ['createNode(opts)', 'removeNode(id)', 'traverse(cb)'] },
  { id: 'EventBus', pkg: 'core-engine', type: 'class',
    methods: ['emit(event, data)', 'on(event, handler)', 'off(event, handler)'] },

  // @mapgpu/core — Managers (right half)
  { id: 'LayerManager', pkg: 'core-mgr', type: 'class',
    methods: ['addLayer(layer)', 'removeLayer(id)', 'removeAll()', 'getLayer(id)', 'getVisibleLayers()', 'on(event, handler)'] },
  { id: 'ToolManager', pkg: 'core-mgr', type: 'class',
    methods: ['registerTool(tool)', 'activateTool(id)', 'deactivateCurrentTool()', 'getCurrentTool()'] },
  { id: 'TileScheduler', pkg: 'core-mgr', type: 'class',
    methods: ['getTilesForExtent(extent, zoom)', 'getTileCoord(lon, lat, z)'] },
  { id: 'TileManager', pkg: 'core-mgr', type: 'class',
    methods: ['updateVisibleTiles(coords)', 'getTile(coord)', 'clearCache()'] },
  { id: 'SimpleRenderer', pkg: 'core-mgr', type: 'class',
    methods: ['getSymbol(feature)'], props: ['type', 'symbol'] },
  { id: 'UniqueValueRenderer', pkg: 'core-mgr', type: 'class',
    methods: ['getSymbol(feature)'], props: ['type', 'field'] },
  { id: 'ClassBreaksRenderer', pkg: 'core-mgr', type: 'class',
    methods: ['getSymbol(feature)'], props: ['type', 'field'] },
  { id: 'ResourceManager', pkg: 'core-mgr', type: 'class',
    methods: ['registerBuffer(id, desc)', 'releaseBuffer(id)', 'getMemoryUsage()'] },
  { id: 'UnitManager', pkg: 'core-mgr', type: 'class',
    methods: ['convertDistance(val, from, to)', 'formatDistance(val, unit?)'],
    props: ['currentDistanceUnit', 'currentAreaUnit'] },

  // @mapgpu/render-webgpu
  { id: 'RenderEngine', pkg: 'render', type: 'class',
    methods: ['initialize()', 'beginFrame(camera)', 'endFrame()', 'recoverFromDeviceLoss()', 'destroy()'] },
  { id: 'BufferPool', pkg: 'render', type: 'class',
    methods: ['allocate(category, size)', 'release(buffer)', 'getMemoryUsage()'] },
  { id: 'TextureManager', pkg: 'render', type: 'class',
    methods: ['registerTexture(id, tex)', 'getTexture(id)', 'releaseTexture(id)', 'getMemoryUsage()'] },
  { id: 'BindGroupCache', pkg: 'render', type: 'class',
    methods: ['get(key, factory)', 'clear()'] },
  { id: 'GlyphAtlas', pkg: 'render', type: 'class',
    methods: ['addGlyph(codepoint, metrics)', 'getGlyph(codepoint)'], props: ['texture'] },
  { id: 'SpriteAtlas', pkg: 'render', type: 'class',
    methods: ['addSprite(id, bitmap)', 'getSprite(id)'], props: ['texture'] },
  { id: 'LabelEngine', pkg: 'render', type: 'class',
    methods: ['layoutLabels(input)', 'getLayoutStats()'] },
  { id: 'ModelManager', pkg: 'render', type: 'class',
    methods: ['loadGltf(url)', 'loadGlb(buffer)', 'getModel(id)', 'releaseModel(id)'] },

  // @mapgpu/adapters-ogc
  { id: 'WmsAdapter', pkg: 'adapters', type: 'class',
    methods: ['getCapabilities()', 'getMap(request)', 'getFeatureInfo(req)', 'getGetMapUrl(req)'] },
  { id: 'WfsAdapter', pkg: 'adapters', type: 'class',
    methods: ['getCollections()', 'queryFeatures(params)', 'describeFeatureType(name)'] },
  { id: 'OgcApiFeaturesAdapter', pkg: 'adapters', type: 'class',
    methods: ['getCollections()', 'queryFeatures(params)'] },
  { id: 'OgcApiMapsAdapter', pkg: 'adapters', type: 'class',
    methods: ['getCapabilities()', 'getMap(request)'] },
  { id: 'ServiceDiscovery', pkg: 'adapters', type: 'class',
    methods: ['detectService(url)', 'createAdapter(url)'] },

  // @mapgpu/layers — Raster / base (left half)
  { id: 'LayerBase', pkg: 'layers-base', type: 'abstract',
    methods: ['load()', 'destroy()', 'redraw()', 'on(event, handler)'],
    props: ['id', 'type', 'visible', 'opacity', 'loaded', 'zIndex'] },
  { id: 'RasterTileLayer', pkg: 'layers-base', type: 'class', parent: 'LayerBase',
    methods: ['getTileUrl(z, x, y)'], props: ['urlTemplate', 'tms', 'minZoom'] },
  { id: 'WMSLayer', pkg: 'layers-base', type: 'class', parent: 'LayerBase',
    methods: ['getCapabilities()', 'getFeatureInfo(params)'], props: ['url', 'layerNames'] },
  { id: 'VectorTileLayer', pkg: 'layers-base', type: 'class', parent: 'LayerBase',
    methods: ['getTileUrl(z, x, y)', 'getVisibleFeatures(tiles)'], props: ['url', 'style'] },
  { id: 'FeatureLayer', pkg: 'layers-base', type: 'class', parent: 'LayerBase',
    methods: ['query(params)', 'getFeatures()', 'getFeatureById(id)'], props: ['renderer'] },

  // @mapgpu/layers — Feature / special (right half)
  { id: 'GeoJSONLayer', pkg: 'layers-feat', type: 'class', parent: 'LayerBase',
    methods: ['query(params)', 'getFeatures()', 'getFeatureById(id)'], props: ['features', 'renderer'] },
  { id: 'GraphicsLayer', pkg: 'layers-feat', type: 'class', parent: 'LayerBase',
    methods: ['add(feature)', 'addMany(features)', 'remove(id)', 'clear()'] },
  { id: 'HeatmapLayer', pkg: 'layers-feat', type: 'class', parent: 'LayerBase',
    methods: ['getHeatmapGrid()'], props: ['radius', 'intensity'] },
  { id: 'GpuClusterLayer', pkg: 'layers-feat', type: 'class', parent: 'LayerBase',
    methods: ['on(event, handler)'], props: ['clusterRadius', 'themePreset'] },
  { id: 'AnimatedLayer', pkg: 'layers-feat', type: 'class', parent: 'LayerBase',
    methods: ['play()', 'pause()', 'stop()'], props: ['speed', 'currentTime'] },
  { id: 'WGSLLayer', pkg: 'layers-feat', type: 'class', parent: 'LayerBase',
    methods: ['setVertexBuffers(bufs)', 'setCustomUniforms(data)'], props: ['vertexShader'] },
  { id: 'DynamicPointLayer', pkg: 'layers-feat', type: 'class', parent: 'LayerBase',
    methods: ['updatePositions(data)'], props: ['pointCount', 'maxPoints'] },

  // @mapgpu/widgets
  { id: 'WidgetBase', pkg: 'widgets', type: 'abstract',
    methods: ['mount(container)', 'unmount()', 'bind(view)', 'destroy()'], props: ['id', 'position'] },
  { id: 'LayerListWidget', pkg: 'widgets', type: 'class', parent: 'WidgetBase',
    methods: ['addLayer(layer)', 'removeLayer(id)', 'reorderLayer(id, idx)', 'on(event, handler)'] },
  { id: 'ScaleBarWidget', pkg: 'widgets', type: 'class', parent: 'WidgetBase',
    methods: ['getScaleAtZoom(zoom)'], props: ['unit'] },
  { id: 'CoordinatesWidget', pkg: 'widgets', type: 'class', parent: 'WidgetBase',
    methods: ['updateCoordinates(lon, lat)'], props: ['format'] },
  { id: 'BasemapGalleryWidget', pkg: 'widgets', type: 'class', parent: 'WidgetBase',
    methods: ['addBasemap(item)', 'removeBasemap(id)', 'selectBasemap(id)'] },
  { id: 'SearchWidget', pkg: 'widgets', type: 'class', parent: 'WidgetBase',
    methods: ['addSource(source)', 'search(query)', 'on(event, handler)'] },
  { id: 'MeasurementWidget', pkg: 'widgets', type: 'class', parent: 'WidgetBase',
    methods: ['startMeasurement()', 'endMeasurement()', 'clearMeasurements()'], props: ['mode', 'unit'] },
  { id: 'TimeSliderWidget', pkg: 'widgets', type: 'class', parent: 'WidgetBase',
    methods: ['play()', 'pause()', 'stop()'], props: ['currentTime', 'timeRange', 'speed'] },
  { id: 'LOSWidget', pkg: 'widgets', type: 'class', parent: 'WidgetBase',
    methods: ['setObserver(lon, lat)', 'setTargets(points)', 'runAnalysis()'], props: ['results'] },
  { id: 'DockPanel', pkg: 'widgets', type: 'class', parent: 'WidgetBase',
    methods: ['addWidget(widget, pos)', 'removeWidget(id)', 'togglePanel(pos)'], props: ['widgets'] },
  { id: 'PopupWidget', pkg: 'widgets', type: 'class', parent: 'WidgetBase',
    methods: ['show(content, position)', 'hide()'], props: ['isVisible'] },
  { id: 'DrawToolbarWidget', pkg: 'widgets', type: 'class', parent: 'WidgetBase',
    methods: ['activateTool(toolId)'], props: ['activeTool'] },
  { id: 'SelectionInspectorWidget', pkg: 'widgets', type: 'class', parent: 'WidgetBase',
    methods: ['setSelection(features)', 'clearSelection()'], props: ['selectedFeatures'] },

  // @mapgpu/tools
  { id: 'ToolBase', pkg: 'tools', type: 'abstract',
    methods: ['activate(ctx)', 'deactivate()', 'onPointerDown(e)', 'onPointerMove(e)', 'onPointerUp(e)', 'cancel()', 'destroy()'],
    props: ['id', 'name', 'state', 'cursor'] },
  { id: 'DrawPointTool', pkg: 'tools', type: 'class', parent: 'ToolBase', methods: [] },
  { id: 'DrawPolylineTool', pkg: 'tools', type: 'class', parent: 'ToolBase', methods: [] },
  { id: 'DrawPolygonTool', pkg: 'tools', type: 'class', parent: 'ToolBase', methods: [] },
  { id: 'EditTool', pkg: 'tools', type: 'class', parent: 'ToolBase',
    methods: ['setEditableLayers(layers)'] },
  { id: 'MeasureLineTool', pkg: 'tools', type: 'class', parent: 'ToolBase',
    methods: ['clearLastMeasurement()', 'clearAllMeasurements()'] },
  { id: 'MeasurePolygonTool', pkg: 'tools', type: 'class', parent: 'ToolBase',
    methods: ['clearLastMeasurement()', 'clearAllMeasurements()'] },
  { id: 'MilStdDrawTool', pkg: 'tools', type: 'class', parent: 'ToolBase',
    methods: ['setSidc(sidc, mode, minCp?, maxCp?)'], props: ['sidc'] },
  { id: 'MilStdEditTool', pkg: 'tools', type: 'class', parent: 'ToolBase', methods: [] },
  { id: 'LosTool', pkg: 'tools', type: 'class', parent: 'ToolBase',
    methods: ['setElevationProvider(provider)'], props: ['results'] },
  { id: 'SnapEngine', pkg: 'tools', type: 'class',
    methods: ['addSourceLayer(layer)', 'removeSourceLayer(layer)', 'snap(x, y, coords, toScreen)'] },

  // @mapgpu/analysis
  { id: 'LosAnalysis', pkg: 'analysis', type: 'class',
    methods: ['setElevationProvider(provider)', 'runLos(params)'] },
  { id: 'ElevationQuery', pkg: 'analysis', type: 'class',
    methods: ['queryElevation(params)'] },
  { id: 'BufferAnalysis', pkg: 'analysis', type: 'class',
    methods: ['buffer(params)'] },
  { id: 'RouteSampler', pkg: 'analysis', type: 'class',
    methods: ['sampleRoute(params)'] },
  { id: 'TerrainElevationProvider', pkg: 'analysis', type: 'class',
    methods: ['getElevations(points)'] },
  { id: 'BuildingObstacleProvider', pkg: 'analysis', type: 'class',
    methods: ['getElevations(points)'] },
  { id: 'CompositeElevationProvider', pkg: 'analysis', type: 'class',
    methods: ['getElevations(points)'] },

  // @mapgpu/terrain
  { id: 'DTEDLayer', pkg: 'terrain', type: 'class', parent: 'LayerBase',
    methods: ['getHeightTile(coord)', 'getHillshadeTile(coord)', 'queryElevation(lon, lat)'],
    props: ['mode', 'levels', 'exaggeration', 'hillshade2D'] },
  { id: 'TerrainRGBLayer', pkg: 'terrain', type: 'class', parent: 'LayerBase',
    methods: ['getHeightTile(coord)', 'queryElevation(lon, lat)'], props: ['url', 'encoding'] },
  { id: 'DTEDTileStore', pkg: 'terrain', type: 'class',
    methods: ['getTile(level, lon, lat)', 'clearCache()'] },
];

// ─── Edges ───────────────────────────────────────────────────────────

export const edges: EdgeDef[] = [
  // Inheritance — layers
  { source: 'RasterTileLayer',   target: 'LayerBase', type: 'extends' },
  { source: 'WMSLayer',          target: 'LayerBase', type: 'extends' },
  { source: 'GeoJSONLayer',      target: 'LayerBase', type: 'extends' },
  { source: 'GraphicsLayer',     target: 'LayerBase', type: 'extends' },
  { source: 'FeatureLayer',      target: 'LayerBase', type: 'extends' },
  { source: 'VectorTileLayer',   target: 'LayerBase', type: 'extends' },
  { source: 'HeatmapLayer',      target: 'LayerBase', type: 'extends' },
  { source: 'GpuClusterLayer',   target: 'LayerBase', type: 'extends' },
  { source: 'AnimatedLayer',     target: 'LayerBase', type: 'extends' },
  { source: 'WGSLLayer',         target: 'LayerBase', type: 'extends' },
  { source: 'DynamicPointLayer', target: 'LayerBase', type: 'extends' },
  { source: 'DTEDLayer',         target: 'LayerBase', type: 'extends' },
  { source: 'TerrainRGBLayer',   target: 'LayerBase', type: 'extends' },
  // Inheritance — widgets
  { source: 'LayerListWidget',          target: 'WidgetBase', type: 'extends' },
  { source: 'ScaleBarWidget',           target: 'WidgetBase', type: 'extends' },
  { source: 'CoordinatesWidget',        target: 'WidgetBase', type: 'extends' },
  { source: 'BasemapGalleryWidget',     target: 'WidgetBase', type: 'extends' },
  { source: 'SearchWidget',             target: 'WidgetBase', type: 'extends' },
  { source: 'MeasurementWidget',        target: 'WidgetBase', type: 'extends' },
  { source: 'TimeSliderWidget',         target: 'WidgetBase', type: 'extends' },
  { source: 'LOSWidget',                target: 'WidgetBase', type: 'extends' },
  { source: 'DockPanel',                target: 'WidgetBase', type: 'extends' },
  { source: 'PopupWidget',              target: 'WidgetBase', type: 'extends' },
  { source: 'DrawToolbarWidget',        target: 'WidgetBase', type: 'extends' },
  { source: 'SelectionInspectorWidget', target: 'WidgetBase', type: 'extends' },
  // Inheritance — tools
  { source: 'DrawPointTool',    target: 'ToolBase', type: 'extends' },
  { source: 'DrawPolylineTool', target: 'ToolBase', type: 'extends' },
  { source: 'DrawPolygonTool',  target: 'ToolBase', type: 'extends' },
  { source: 'EditTool',         target: 'ToolBase', type: 'extends' },
  { source: 'MeasureLineTool',  target: 'ToolBase', type: 'extends' },
  { source: 'MeasurePolygonTool', target: 'ToolBase', type: 'extends' },
  { source: 'MilStdDrawTool',   target: 'ToolBase', type: 'extends' },
  { source: 'MilStdEditTool',   target: 'ToolBase', type: 'extends' },
  { source: 'LosTool',          target: 'ToolBase', type: 'extends' },
  // Composition — core orchestration
  { source: 'MapView', target: 'ViewCore',            type: 'uses' },
  { source: 'MapView', target: 'LayerManager',        type: 'uses' },
  { source: 'MapView', target: 'ToolManager',         type: 'uses' },
  { source: 'MapView', target: 'CameraController2D',  type: 'uses' },
  { source: 'ViewCore', target: 'TileManager',        type: 'uses' },
  { source: 'ViewCore', target: 'SceneGraph',         type: 'uses' },
  { source: 'ViewCore', target: 'RenderLoop',         type: 'uses' },
  // Composition — render engine
  { source: 'RenderEngine', target: 'BufferPool',      type: 'uses' },
  { source: 'RenderEngine', target: 'TextureManager',  type: 'uses' },
  { source: 'RenderEngine', target: 'BindGroupCache',  type: 'uses' },
  { source: 'RenderEngine', target: 'GlyphAtlas',      type: 'uses' },
  { source: 'RenderEngine', target: 'SpriteAtlas',     type: 'uses' },
  { source: 'RenderEngine', target: 'LabelEngine',     type: 'uses' },
  { source: 'RenderEngine', target: 'ModelManager',    type: 'uses' },
  // Cross-package composition
  { source: 'WMSLayer',          target: 'WmsAdapter',              type: 'uses' },
  { source: 'FeatureLayer',      target: 'WfsAdapter',              type: 'uses' },
  { source: 'FeatureLayer',      target: 'OgcApiFeaturesAdapter',   type: 'uses' },
  { source: 'LosAnalysis',       target: 'TerrainElevationProvider', type: 'uses' },
  { source: 'LosAnalysis',       target: 'CompositeElevationProvider', type: 'uses' },
  { source: 'CompositeElevationProvider', target: 'TerrainElevationProvider', type: 'uses' },
  { source: 'CompositeElevationProvider', target: 'BuildingObstacleProvider', type: 'uses' },
  { source: 'LosTool',           target: 'LosAnalysis',   type: 'uses' },
  { source: 'TerrainElevationProvider', target: 'DTEDLayer', type: 'uses' },
  { source: 'LayerListWidget',   target: 'LayerManager',  type: 'uses' },
  { source: 'LOSWidget',         target: 'LosAnalysis',   type: 'uses' },
  { source: 'DrawToolbarWidget', target: 'ToolManager',   type: 'uses' },
];
