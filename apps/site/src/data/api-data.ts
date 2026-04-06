// ─── API Documentation Data ───
// Central data source for all detailed class/interface documentation.
// Used by Astro pages to generate /api/[pkg]/[cls] detail pages.

export interface ParamInfo {
  name: string;
  type: string;
  required: boolean;
  default?: string;
  description: string;
}

export interface PropertyInfo {
  name: string;
  type: string;
  readonly: boolean;
  description: string;
}

export interface MethodInfo {
  name: string;
  signature: string;
  description: string;
  params?: ParamInfo[];
  returns?: string;
}

export interface EventInfo {
  name: string;
  payload: string;
  description: string;
}

export interface ClassDoc {
  name: string;
  kind: 'class' | 'interface' | 'function' | 'type';
  description: string;
  extends?: string;
  implements?: string[];
  constructor?: {
    signature: string;
    params: ParamInfo[];
  };
  optionsInterface?: {
    name: string;
    fields: ParamInfo[];
  };
  properties?: PropertyInfo[];
  methods?: MethodInfo[];
  events?: EventInfo[];
  example?: string;
}

export interface PackageDoc {
  name: string;
  slug: string;
  description: string;
  install: string;
  classes: ClassDoc[];
}

// ═══════════════════════════════════════════════
//  @mapgpu/core
// ═══════════════════════════════════════════════

const corePackage: PackageDoc = {
  name: '@mapgpu/core',
  slug: 'core',
  description: 'Core types, MapView, event system, projections, and renderers.',
  install: 'npm install @mapgpu/core',
  classes: [
    // ─── MapView ───
    {
      name: 'MapView',
      kind: 'class',
      description:
        'Unified map view with 2D/3D mode switching. Creates a WebGPU canvas, manages layers, handles user interaction, and provides coordinate conversion. This is the main entry point for the library.',
      implements: ['IView'],
      constructor: {
        signature: 'new MapView(options: MapViewOptions)',
        params: [
          { name: 'options', type: 'MapViewOptions', required: true, description: 'View configuration' },
        ],
      },
      optionsInterface: {
        name: 'MapViewOptions',
        fields: [
          { name: 'container', type: 'HTMLElement | string | null', required: true, description: 'DOM element or CSS selector for the map container' },
          { name: 'mode', type: "'2d' | '3d'", required: false, default: "'2d'", description: 'Initial rendering mode' },
          { name: 'center', type: '[number, number]', required: false, default: '[0, 0]', description: 'Initial center as [longitude, latitude]' },
          { name: 'zoom', type: 'number', required: false, default: '2', description: 'Initial zoom level' },
          { name: 'rotation', type: 'number', required: false, default: '0', description: 'Initial rotation in degrees (2D only)' },
          { name: 'pitch', type: 'number', required: false, default: '0', description: 'Initial pitch in degrees (3D only)' },
          { name: 'bearing', type: 'number', required: false, default: '0', description: 'Initial bearing in degrees (3D only)' },
          { name: 'minZoom', type: 'number', required: false, default: '0', description: 'Minimum allowed zoom level' },
          { name: 'maxZoom', type: 'number', required: false, default: '22', description: 'Maximum allowed zoom level' },
          { name: 'renderEngine', type: 'IRenderEngine', required: false, description: 'WebGPU render engine instance (e.g. new RenderEngine())' },
          { name: 'backgroundColor', type: 'string', required: false, default: "'black'", description: 'Canvas background color' },
          { name: 'interaction', type: 'InteractionHandlerOptions | GlobeInteractionOptions | false', required: false, description: 'Interaction config, or false to disable' },
        ],
      },
      properties: [
        { name: 'id', type: 'string', readonly: true, description: 'Unique view identifier' },
        { name: 'type', type: "'2d' | '3d'", readonly: true, description: 'Active rendering mode' },
        { name: 'map', type: 'GameMap', readonly: true, description: 'Layer collection (add/remove/reorder layers here)' },
        { name: 'canvas', type: 'HTMLCanvasElement | null', readonly: true, description: 'WebGPU canvas element' },
        { name: 'center', type: '[number, number]', readonly: true, description: 'Current center [longitude, latitude]' },
        { name: 'zoom', type: 'number', readonly: true, description: 'Current zoom level' },
        { name: 'pitch', type: 'number', readonly: true, description: 'Current pitch in degrees' },
        { name: 'bearing', type: 'number', readonly: true, description: 'Current bearing in degrees' },
        { name: 'rotation', type: 'number', readonly: true, description: 'Current rotation in degrees (2D only)' },
        { name: 'mode', type: "'2d' | '3d'", readonly: true, description: 'Active mode string' },
        { name: 'ready', type: 'boolean', readonly: true, description: 'True when GPU + canvas initialized' },
        { name: 'gpuReady', type: 'boolean', readonly: true, description: 'True when WebGPU device ready' },
        { name: 'toolManager', type: 'ToolManager', readonly: true, description: 'Tool manager (lazy-initialized on first access)' },
      ],
      methods: [
        { name: 'switchTo', signature: 'switchTo(mode: \'2d\' | \'3d\'): Promise<void>', description: 'Switch between 2D flat map and 3D globe mode. Preserves center/zoom.', params: [{ name: 'mode', type: "'2d' | '3d'", required: true, description: 'Target mode' }], returns: 'Promise<void>' },
        { name: 'goTo', signature: 'goTo(target: GoToTarget): Promise<void>', description: 'Animated navigation to a target view state.', params: [{ name: 'target', type: 'GoToTarget', required: true, description: '{ center?, zoom?, pitch?, bearing?, rotation?, duration? }' }], returns: 'Promise<void>' },
        { name: 'toMap', signature: 'toMap(screenX: number, screenY: number): [number, number] | null', description: 'Convert screen pixel coordinates to geographic [lon, lat].', returns: '[number, number] | null' },
        { name: 'toScreen', signature: 'toScreen(lon: number, lat: number): [number, number] | null', description: 'Convert geographic coordinates to screen pixels.', returns: '[number, number] | null' },
        { name: 'hitTest', signature: 'hitTest(screenX: number, screenY: number): Promise<HitTestResult[]>', description: 'Query features at a screen position using GPU picking.', returns: 'Promise<HitTestResult[]>' },
        { name: 'when', signature: 'when(): Promise<void>', description: 'Promise that resolves when the map is fully initialized (GPU + canvas ready).', returns: 'Promise<void>' },
        { name: 'on', signature: 'on<K extends keyof MapViewEvents>(event: K, handler: (data: MapViewEvents[K]) => void): void', description: 'Register an event listener.', returns: 'void' },
        { name: 'off', signature: 'off<K extends keyof MapViewEvents>(event: K, handler: (data: MapViewEvents[K]) => void): void', description: 'Remove an event listener.', returns: 'void' },
        { name: 'loadIcon', signature: 'loadIcon(id: string, source: string | ImageBitmap): Promise<void>', description: 'Load an icon image for use with PointSymbol type="icon".', returns: 'Promise<void>' },
        { name: 'loadSvgIcon', signature: 'loadSvgIcon(id: string, svgMarkup: string, width: number, height: number): Promise<void>', description: 'Load an SVG string as an icon.', returns: 'Promise<void>' },
        { name: 'loadModel', signature: 'loadModel(id: string, source: string | ArrayBuffer): Promise<void>', description: 'Load a GLTF/GLB 3D model for use with ModelSymbol.', returns: 'Promise<void>' },
        { name: 'getBounds', signature: 'getBounds(): Extent | null', description: 'Get the current visible extent as an Extent.', returns: 'Extent | null' },
        { name: 'getViewState', signature: 'getViewState(): ViewState', description: 'Get the full view state (center, zoom, pitch, bearing, rotation).', returns: 'ViewState' },
        { name: 'setHeightExaggeration', signature: 'setHeightExaggeration(factor: number): void', description: 'Set terrain height exaggeration factor.', returns: 'void' },
        { name: 'destroy', signature: 'destroy(): void', description: 'Release all GPU resources, detach canvas, stop render loop.', returns: 'void' },
      ],
      events: [
        { name: 'view-change', payload: '{ center, zoom, pitch, bearing, rotation, mode }', description: 'Fires on any camera/view state change' },
        { name: 'mode-change', payload: "{ from: '2d'|'3d', to: '2d'|'3d' }", description: 'Fires when switching between 2D and 3D' },
        { name: 'ready', payload: 'void', description: 'Fires when GPU + canvas fully initialized' },
        { name: 'error', payload: 'MapError', description: 'Fires on any error (GPU lost, shader compile, etc.)' },
        { name: 'layer-add', payload: '{ layer: ILayer }', description: 'Fires when a layer is added to the map' },
        { name: 'layer-remove', payload: '{ layer: ILayer }', description: 'Fires when a layer is removed' },
        { name: 'click', payload: '{ screenX, screenY, mapPoint }', description: 'Fires on map click' },
        { name: 'pointer-move', payload: '{ screenX, screenY, mapPoint }', description: 'Fires on pointer move over the map' },
        { name: 'frame', payload: '{ frameNumber, fps }', description: 'Fires every rendered frame' },
        { name: 'destroy', payload: 'void', description: 'Fires when the view is destroyed' },
      ],
      example: `import { MapView } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer } from '@mapgpu/layers';

const view = new MapView({
  container: '#map',
  center: [28.97, 41.01],
  zoom: 10,
  renderEngine: new RenderEngine(),
});

view.map.add(new RasterTileLayer({
  id: 'osm',
  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
}));

await view.when();
console.log('Map ready!');`,
    },

    // ─── GameMap ───
    {
      name: 'GameMap',
      kind: 'class',
      description: 'Layer container that manages add, remove, reorder, and findById operations. Accessed via MapView.map.',
      properties: [
        { name: 'layers', type: 'readonly ILayer[]', readonly: true, description: 'All layers in display order' },
      ],
      methods: [
        { name: 'add', signature: 'add(layer: ILayer, index?: number): void', description: 'Add a layer. Optional index for insertion position.', returns: 'void' },
        { name: 'remove', signature: 'remove(layer: ILayer): void', description: 'Remove a layer from the map.', returns: 'void' },
        { name: 'removeAll', signature: 'removeAll(): void', description: 'Remove all layers.', returns: 'void' },
        { name: 'reorder', signature: 'reorder(layer: ILayer, newIndex: number): void', description: 'Move a layer to a new position.', returns: 'void' },
        { name: 'findById', signature: 'findById(id: string): ILayer | undefined', description: 'Find a layer by its ID.', returns: 'ILayer | undefined' },
        { name: 'on', signature: 'on(event: string, handler: Function): void', description: 'Listen for layer-add, layer-remove, layer-reorder events.', returns: 'void' },
      ],
      example: `const view = new MapView({ container: '#map' });

// Add layers
view.map.add(osmLayer);
view.map.add(geojsonLayer);

// Reorder
view.map.reorder(geojsonLayer, 0); // move to bottom

// Find by ID
const layer = view.map.findById('osm');`,
    },

    // ─── SimpleRenderer ───
    {
      name: 'SimpleRenderer',
      kind: 'class',
      description: 'Applies the same symbol to every feature. Use when all features should look identical.',
      implements: ['IRenderer'],
      constructor: {
        signature: 'new SimpleRenderer(symbol: Symbol)',
        params: [
          { name: 'symbol', type: 'Symbol', required: true, description: 'PointSymbol | LineSymbol | PolygonSymbol | ModelSymbol' },
        ],
      },
      properties: [
        { name: 'type', type: "'simple'", readonly: true, description: 'Renderer type discriminant' },
        { name: 'symbol', type: 'Symbol', readonly: true, description: 'The uniform symbol applied to all features' },
      ],
      methods: [
        { name: 'getSymbol', signature: 'getSymbol(feature: Feature, context?: SymbolRenderContext): Symbol', description: 'Always returns the constructor symbol.', returns: 'Symbol' },
      ],
      example: `const renderer = new SimpleRenderer({
  type: 'simple-marker',
  color: [255, 0, 0, 255],
  size: 8,
});

const layer = new GeoJSONLayer({
  url: '/data/cities.geojson',
});
layer.renderer = renderer;`,
    },

    // ─── UniqueValueRenderer ───
    {
      name: 'UniqueValueRenderer',
      kind: 'class',
      description: 'Assigns symbols based on a feature attribute value. Use for categorical data (e.g. country, type, status).',
      implements: ['IRenderer'],
      constructor: {
        signature: 'new UniqueValueRenderer(options: UniqueValueRendererOptions)',
        params: [
          { name: 'options', type: 'UniqueValueRendererOptions', required: true, description: 'Renderer configuration' },
        ],
      },
      optionsInterface: {
        name: 'UniqueValueRendererOptions',
        fields: [
          { name: 'field', type: 'string', required: true, description: 'Attribute field name to classify on' },
          { name: 'defaultSymbol', type: 'Symbol', required: true, description: 'Fallback symbol when no match found' },
          { name: 'uniqueValues', type: 'UniqueValueInfo[]', required: true, description: 'Array of { value, symbol } pairs' },
        ],
      },
      properties: [
        { name: 'type', type: "'unique-value'", readonly: true, description: 'Renderer type discriminant' },
        { name: 'field', type: 'string', readonly: true, description: 'Attribute field name' },
        { name: 'defaultSymbol', type: 'Symbol', readonly: true, description: 'Fallback symbol' },
      ],
      methods: [
        { name: 'getSymbol', signature: 'getSymbol(feature: Feature, context?: SymbolRenderContext): Symbol', description: 'Look up symbol by attribute value. Falls back to defaultSymbol.', returns: 'Symbol' },
      ],
      example: `const renderer = new UniqueValueRenderer({
  field: 'type',
  defaultSymbol: { type: 'simple-marker', color: [128,128,128,255], size: 6 },
  uniqueValues: [
    { value: 'airport', symbol: { type: 'simple-marker', color: [0,100,255,255], size: 10 } },
    { value: 'station', symbol: { type: 'simple-marker', color: [0,200,0,255], size: 8 } },
  ],
});`,
    },

    // ─── ClassBreaksRenderer ───
    {
      name: 'ClassBreaksRenderer',
      kind: 'class',
      description: 'Assigns symbols based on numeric ranges. Use for quantitative data (e.g. population, elevation, speed).',
      implements: ['IRenderer'],
      constructor: {
        signature: 'new ClassBreaksRenderer(options: ClassBreaksRendererOptions)',
        params: [
          { name: 'options', type: 'ClassBreaksRendererOptions', required: true, description: 'Renderer configuration' },
        ],
      },
      optionsInterface: {
        name: 'ClassBreaksRendererOptions',
        fields: [
          { name: 'field', type: 'string', required: true, description: 'Numeric attribute field name' },
          { name: 'defaultSymbol', type: 'Symbol', required: true, description: 'Fallback symbol when no range matches' },
          { name: 'breaks', type: 'ClassBreakInfo[]', required: true, description: 'Array of { min, max, symbol } definitions' },
        ],
      },
      properties: [
        { name: 'type', type: "'class-breaks'", readonly: true, description: 'Renderer type discriminant' },
        { name: 'field', type: 'string', readonly: true, description: 'Numeric field name' },
        { name: 'defaultSymbol', type: 'Symbol', readonly: true, description: 'Fallback symbol' },
        { name: 'breaks', type: 'readonly ClassBreakInfo[]', readonly: true, description: 'Immutable break definitions' },
      ],
      methods: [
        { name: 'getSymbol', signature: 'getSymbol(feature: Feature, context?: SymbolRenderContext): Symbol', description: 'Classify numeric value into range and return matching symbol.', returns: 'Symbol' },
      ],
      example: `const renderer = new ClassBreaksRenderer({
  field: 'population',
  defaultSymbol: { type: 'simple-marker', color: [128,128,128,255], size: 4 },
  breaks: [
    { min: 0, max: 100000, symbol: { type: 'simple-marker', color: [0,200,0,255], size: 6 } },
    { min: 100000, max: 1000000, symbol: { type: 'simple-marker', color: [255,200,0,255], size: 10 } },
    { min: 1000000, max: Infinity, symbol: { type: 'simple-marker', color: [255,0,0,255], size: 14 } },
  ],
});`,
    },

    // ─── CallbackRenderer ───
    {
      name: 'CallbackRenderer',
      kind: 'class',
      description: 'Per-feature dynamic symbol via a callback function. Maximum flexibility — use when other renderers are insufficient.',
      implements: ['IRenderer'],
      constructor: {
        signature: 'new CallbackRenderer(fn: (feature: Feature, context?: SymbolRenderContext) => Symbol | null)',
        params: [
          { name: 'fn', type: '(feature: Feature, context?: SymbolRenderContext) => Symbol | null', required: true, description: 'Callback that returns a symbol (or null to skip)' },
        ],
      },
      properties: [
        { name: 'type', type: "'callback'", readonly: true, description: 'Renderer type discriminant' },
      ],
      methods: [
        { name: 'getSymbol', signature: 'getSymbol(feature: Feature, context?: SymbolRenderContext): Symbol | null', description: 'Invoke user callback to get symbol.', returns: 'Symbol | null' },
      ],
      example: `const renderer = new CallbackRenderer((feature) => {
  const pop = feature.attributes.population as number;
  const size = Math.sqrt(pop / 10000) * 2;
  return {
    type: 'simple-marker',
    color: pop > 1000000 ? [255,0,0,255] : [0,128,255,255],
    size: Math.max(4, Math.min(size, 20)),
  };
});`,
    },

    // ─── PointSymbol ───
    {
      name: 'PointSymbol',
      kind: 'interface',
      description: 'Symbol definition for point features. Supports simple circle markers, icon images, and SDF icons. Includes optional glow halo and background circle effects.',
      properties: [
        { name: 'type', type: "'simple-marker' | 'icon' | 'sdf-icon'", readonly: false, description: "Symbol type discriminant. 'simple-marker' for circles, 'icon' for loaded images, 'sdf-icon' for SDF rendering." },
        { name: 'color', type: '[number, number, number, number]', readonly: false, description: 'RGBA fill color (0-255)' },
        { name: 'size', type: 'number', readonly: false, description: 'Symbol diameter in pixels' },
        { name: 'outlineColor', type: '[number, number, number, number]', readonly: false, description: 'Outline RGBA color (0-255). Optional.' },
        { name: 'outlineWidth', type: 'number', readonly: false, description: 'Outline width in pixels. Optional.' },
        { name: 'src', type: 'string', readonly: false, description: "Icon ID loaded via MapView.loadIcon(). Only for type='icon'." },
        { name: 'rotation', type: 'number', readonly: false, description: 'Icon rotation angle in degrees (clockwise). Optional.' },
        { name: 'glowColor', type: '[number, number, number, number]', readonly: false, description: 'Glow halo RGBA color (0-255). When set, a soft radial halo is drawn behind the point/icon. Optional.' },
        { name: 'glowSize', type: 'number', readonly: false, description: 'Glow spread in pixels beyond the point/icon size. Default 0 (no glow). Optional.' },
        { name: 'backgroundColor', type: '[number, number, number, number]', readonly: false, description: 'Background circle fill color (RGBA 0-255). Draws a filled circle behind the icon. Optional.' },
        { name: 'backgroundSize', type: 'number', readonly: false, description: 'Background circle diameter in pixels. 0 = no background. Optional.' },
      ],
      example: `// Simple marker with glow
const symbol: PointSymbol = {
  type: 'simple-marker',
  color: [255, 0, 0, 255],
  size: 10,
  glowColor: [255, 100, 100, 200],
  glowSize: 8,
};

// Icon with background circle
const iconSymbol: PointSymbol = {
  type: 'icon',
  color: [255, 255, 255, 255], // tint color
  size: 24,
  src: 'hospital',
  backgroundColor: [0, 120, 255, 255],
  backgroundSize: 32,
};`,
    },

    // ─── LineSymbol ───
    {
      name: 'LineSymbol',
      kind: 'interface',
      description: 'Symbol definition for line/polyline features. Supports solid, dash, dot, and dash-dot styles with optional animated dashes and glow effects.',
      properties: [
        { name: 'type', type: "'simple-line'", readonly: false, description: 'Symbol type discriminant' },
        { name: 'color', type: '[number, number, number, number]', readonly: false, description: 'RGBA line color (0-255)' },
        { name: 'width', type: 'number', readonly: false, description: 'Line width in pixels' },
        { name: 'style', type: "'solid' | 'dash' | 'dot' | 'dash-dot'", readonly: false, description: 'Line dash style' },
        { name: 'dashAnimationSpeed', type: 'number', readonly: false, description: 'Animated dash speed in pixels/second. 0 = static. Optional.' },
        { name: 'dashArray', type: 'number[]', readonly: false, description: 'Custom dash pattern (pixel lengths: [dash, gap, ...]). Max 8 segments. Optional.' },
        { name: 'glowColor', type: '[number, number, number, number]', readonly: false, description: 'Glow effect RGBA color (0-255). Draws a wider translucent pass behind the line. Optional.' },
        { name: 'glowWidth', type: 'number', readonly: false, description: 'Glow spread in pixels beyond the line width. Default 0. Optional.' },
      ],
      example: `const lineSymbol: LineSymbol = {
  type: 'simple-line',
  color: [0, 100, 255, 255],
  width: 3,
  style: 'solid',
  glowColor: [0, 150, 255, 120],
  glowWidth: 6,
};`,
    },

    // ─── PolygonSymbol ───
    {
      name: 'PolygonSymbol',
      kind: 'interface',
      description: 'Symbol definition for polygon features. Supports fill color, outline, and optional glow effect on the outline.',
      properties: [
        { name: 'type', type: "'simple-fill'", readonly: false, description: 'Symbol type discriminant' },
        { name: 'color', type: '[number, number, number, number]', readonly: false, description: 'RGBA fill color (0-255)' },
        { name: 'outlineColor', type: '[number, number, number, number]', readonly: false, description: 'Outline RGBA color (0-255)' },
        { name: 'outlineWidth', type: 'number', readonly: false, description: 'Outline width in pixels' },
        { name: 'outlineGlowColor', type: '[number, number, number, number]', readonly: false, description: 'Glow effect on polygon outline (RGBA 0-255). Optional.' },
        { name: 'outlineGlowWidth', type: 'number', readonly: false, description: 'Glow spread in pixels beyond the outline width. Default 0. Optional.' },
      ],
      example: `const polygonSymbol: PolygonSymbol = {
  type: 'simple-fill',
  color: [0, 100, 255, 80],
  outlineColor: [0, 50, 200, 255],
  outlineWidth: 2,
  outlineGlowColor: [0, 150, 255, 120],
  outlineGlowWidth: 4,
};`,
    },

    // ─── GlobeProjection ───
    {
      name: 'GlobeProjection',
      kind: 'class',
      description: 'Dual projection that blends Mercator (flat) and Vertical Perspective (globe) based on zoom level. Transition happens at zoom 5-6 with a smooth globeness factor.',
      implements: ['IProjection'],
      properties: [
        { name: 'globeness', type: 'number', readonly: true, description: '0 = pure Mercator, 1 = pure globe. Auto-transitions at zoom 5-6.' },
        { name: 'name', type: 'string', readonly: true, description: "Projection name ('globe')" },
      ],
      methods: [
        { name: 'project', signature: 'project(lon: number, lat: number): [number, number]', description: 'Project geographic coords to normalized [0..1].', returns: '[number, number]' },
        { name: 'unproject', signature: 'unproject(x: number, y: number): [number, number]', description: 'Unproject normalized coords to geographic.', returns: '[number, number]' },
        { name: 'getViewProjectionMatrix', signature: 'getViewProjectionMatrix(state: ViewState, width: number, height: number): Float32Array', description: 'Compute view-projection matrix for the current state.', returns: 'Float32Array' },
      ],
    },

    // ─── VectorBufferCache ───
    {
      name: 'VectorBufferCache',
      kind: 'class',
      description: 'GPU buffer cache for vector features. Builds GPU buffers from Feature[] + Renderer, caches by layer ID and symbol key. Invalidates on data or renderer change.',
      constructor: {
        signature: 'new VectorBufferCache(engine?: IRenderEngine | null)',
        params: [
          { name: 'engine', type: 'IRenderEngine | null', required: false, default: 'null', description: 'Render engine for buffer creation' },
        ],
      },
      methods: [
        { name: 'getOrBuild', signature: 'getOrBuild(layerId: string, features: readonly Feature[], renderer?: IRenderer, zoom?: number): VectorBufferEntry | null', description: 'Get cached buffers or build new ones from features + renderer.', returns: 'VectorBufferEntry | null' },
        { name: 'has', signature: 'has(layerId: string): boolean', description: 'Check if layer has cached buffers.', returns: 'boolean' },
        { name: 'invalidate', signature: 'invalidate(layerId: string): void', description: 'Clear cached buffers for a specific layer.', returns: 'void' },
        { name: 'invalidateAll', signature: 'invalidateAll(): void', description: 'Clear all cached buffers.', returns: 'void' },
        { name: 'setRenderEngine', signature: 'setRenderEngine(engine: IRenderEngine): void', description: 'Set render engine reference (needed before getOrBuild).', returns: 'void' },
        { name: 'destroy', signature: 'destroy(): void', description: 'Release all GPU resources.', returns: 'void' },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════
//  @mapgpu/layers
// ═══════════════════════════════════════════════

const layersPackage: PackageDoc = {
  name: '@mapgpu/layers',
  slug: 'layers',
  description: 'Layer implementations for all data types.',
  install: 'npm install @mapgpu/layers',
  classes: [
    // ─── GeoJSONLayer ───
    {
      name: 'GeoJSONLayer',
      kind: 'class',
      description: 'Load and render GeoJSON data. Supports URL fetch or inline data. Automatically detects geometry types (Point, LineString, Polygon) and applies renderer symbology.',
      extends: 'LayerBase',
      implements: ['IFeatureLayer', 'IQueryableLayer'],
      constructor: {
        signature: 'new GeoJSONLayer(options: GeoJSONLayerOptions)',
        params: [
          { name: 'options', type: 'GeoJSONLayerOptions', required: true, description: 'Layer configuration' },
        ],
      },
      optionsInterface: {
        name: 'GeoJSONLayerOptions',
        fields: [
          { name: 'id', type: 'string', required: false, description: 'Layer ID (auto-generated if omitted)' },
          { name: 'url', type: 'string', required: false, description: 'URL to a GeoJSON file (mutually exclusive with data)' },
          { name: 'data', type: 'GeoJsonFeatureCollection', required: false, description: 'Inline GeoJSON data (mutually exclusive with url)' },
          { name: 'fetchFn', type: 'typeof fetch', required: false, description: 'Custom fetch function for loading' },
          { name: 'visible', type: 'boolean', required: false, default: 'true', description: 'Initial visibility' },
          { name: 'opacity', type: 'number', required: false, default: '1', description: 'Layer opacity (0-1)' },
          { name: 'zIndex', type: 'number', required: false, description: 'Display order' },
          { name: 'interactive', type: 'boolean', required: false, default: 'true', description: 'Enable hit testing' },
          { name: 'blendMode', type: "'normal' | 'screen' | 'multiply' | 'overlay'", required: false, default: "'normal'", description: 'GPU blend mode' },
          { name: 'filters', type: '{ brightness?, contrast?, saturate? }', required: false, description: 'Visual filters' },
        ],
      },
      properties: [
        { name: 'type', type: "'geojson'", readonly: true, description: 'Layer type discriminant' },
        { name: 'renderer', type: 'IRenderer | undefined', readonly: false, description: 'Feature renderer (set to apply symbology)' },
      ],
      methods: [
        { name: 'getFeatures', signature: 'getFeatures(): readonly Feature[]', description: 'Get all loaded features.', returns: 'readonly Feature[]' },
        { name: 'queryFeatures', signature: 'queryFeatures(params: QueryParams): Promise<Feature[]>', description: 'Query features with optional bbox, where filter, and limit.', returns: 'Promise<Feature[]>' },
        { name: 'queryExtent', signature: 'queryExtent(params?: QueryParams): Promise<Extent>', description: 'Get bounding extent of query results.', returns: 'Promise<Extent>' },
        { name: 'refresh', signature: 'refresh(): void', description: 'Clear cached features and reload data from the source URL. Layer re-fetches and re-renders automatically.', returns: 'void' },
      ],
      example: `const layer = new GeoJSONLayer({
  id: 'cities',
  url: '/data/cities.geojson',
});
layer.renderer = new SimpleRenderer({
  type: 'simple-marker',
  color: [255, 100, 50, 255],
  size: 8,
});
view.map.add(layer);`,
    },

    // ─── RasterTileLayer ───
    {
      name: 'RasterTileLayer',
      kind: 'class',
      description: 'XYZ/TMS raster tile layer. Loads map tiles from a URL template with {z}/{x}/{y} placeholders. Used for basemaps (OpenStreetMap, Mapbox, etc.).',
      extends: 'LayerBase',
      implements: ['ITileLayer'],
      constructor: {
        signature: 'new RasterTileLayer(options: RasterTileLayerOptions)',
        params: [
          { name: 'options', type: 'RasterTileLayerOptions', required: true, description: 'Tile layer configuration' },
        ],
      },
      optionsInterface: {
        name: 'RasterTileLayerOptions',
        fields: [
          { name: 'id', type: 'string', required: false, description: 'Layer ID' },
          { name: 'urlTemplate', type: 'string', required: true, description: 'URL with {z}, {x}, {y}, {s} placeholders' },
          { name: 'tms', type: 'boolean', required: false, default: 'false', description: 'Use TMS y-flip convention' },
          { name: 'subdomains', type: 'string[]', required: false, default: '[]', description: 'Subdomain rotation for {s}' },
          { name: 'minZoom', type: 'number', required: false, default: '0', description: 'Minimum zoom level' },
          { name: 'maxZoom', type: 'number', required: false, default: '22', description: 'Maximum zoom level' },
          { name: 'attribution', type: 'string', required: false, description: 'Attribution text' },
          { name: 'visible', type: 'boolean', required: false, default: 'true', description: 'Initial visibility' },
          { name: 'opacity', type: 'number', required: false, default: '1', description: 'Layer opacity (0-1)' },
          { name: 'filters', type: '{ brightness?, contrast?, saturate? }', required: false, description: 'Visual filters' },
        ],
      },
      properties: [
        { name: 'type', type: "'raster-tile'", readonly: true, description: 'Layer type discriminant' },
        { name: 'urlTemplate', type: 'string', readonly: true, description: 'URL template' },
        { name: 'tms', type: 'boolean', readonly: true, description: 'TMS mode flag' },
        { name: 'subdomains', type: 'readonly string[]', readonly: true, description: 'Subdomain list' },
        { name: 'minZoom', type: 'number', readonly: true, description: 'Min zoom' },
        { name: 'maxZoom', type: 'number', readonly: true, description: 'Max zoom' },
        { name: 'attribution', type: 'string | undefined', readonly: true, description: 'Attribution text' },
      ],
      methods: [
        { name: 'getTileUrl', signature: 'getTileUrl(z: number, x: number, y: number): string', description: 'Generate a tile URL for given coordinates.', returns: 'string' },
        { name: 'isZoomValid', signature: 'isZoomValid(z: number): boolean', description: 'Check if zoom level is within min/max bounds.', returns: 'boolean' },
      ],
      example: `const osm = new RasterTileLayer({
  id: 'osm',
  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  minZoom: 0,
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors',
});
view.map.add(osm);`,
    },

    // ─── GraphicsLayer ───
    {
      name: 'GraphicsLayer',
      kind: 'class',
      description: 'Client-side layer for programmatically adding, removing, and querying features. Does not fetch from any remote service. Ideal for dynamic data, user-drawn geometry, and animation.',
      extends: 'LayerBase',
      implements: ['IFeatureLayer', 'IQueryableLayer'],
      constructor: {
        signature: 'new GraphicsLayer(options?: GraphicsLayerOptions)',
        params: [
          { name: 'options', type: 'GraphicsLayerOptions', required: false, description: 'Inherits from LayerBaseOptions' },
        ],
      },
      optionsInterface: {
        name: 'GraphicsLayerOptions',
        fields: [
          { name: 'id', type: 'string', required: false, description: 'Layer ID' },
          { name: 'visible', type: 'boolean', required: false, default: 'true', description: 'Initial visibility' },
          { name: 'opacity', type: 'number', required: false, default: '1', description: 'Layer opacity (0-1)' },
          { name: 'zIndex', type: 'number', required: false, description: 'Display order' },
          { name: 'interactive', type: 'boolean', required: false, default: 'true', description: 'Enable hit testing' },
        ],
      },
      properties: [
        { name: 'type', type: "'graphics'", readonly: true, description: 'Layer type discriminant' },
        { name: 'renderer', type: 'IRenderer | undefined', readonly: false, description: 'Feature renderer for symbology. Set to apply custom symbols to features.' },
        { name: 'graphics', type: 'readonly Feature[]', readonly: true, description: 'All current features (readonly view)' },
        { name: 'count', type: 'number', readonly: true, description: 'Number of features' },
      ],
      methods: [
        { name: 'add', signature: 'add(feature: Feature): void', description: 'Add a feature. Replaces existing feature with same id.', returns: 'void' },
        { name: 'addMany', signature: 'addMany(features: Feature[]): void', description: 'Add multiple features at once.', returns: 'void' },
        { name: 'replaceAll', signature: 'replaceAll(features: Feature[]): void', description: 'Replace all features atomically with a single refresh. Much more efficient than clear() + addMany() for animation loops.', returns: 'void' },
        { name: 'remove', signature: 'remove(id: string | number): boolean', description: 'Remove a feature by id. Returns true if found and removed.', returns: 'boolean' },
        { name: 'clear', signature: 'clear(): void', description: 'Remove all features.', returns: 'void' },
        { name: 'getFeatures', signature: 'getFeatures(): readonly Feature[]', description: 'Get all features (IFeatureLayer).', returns: 'readonly Feature[]' },
        { name: 'queryFeatures', signature: 'queryFeatures(params: QueryParams): Promise<Feature[]>', description: 'Query with bbox, where filter, outFields, and maxResults.', returns: 'Promise<Feature[]>' },
        { name: 'queryExtent', signature: 'queryExtent(params?: QueryParams): Promise<Extent>', description: 'Get bounding extent.', returns: 'Promise<Extent>' },
      ],
      example: `const graphics = new GraphicsLayer({ id: 'user-markers' });
graphics.renderer = new SimpleRenderer({
  type: 'simple-marker',
  color: [255, 0, 0, 255],
  size: 10,
});
view.map.add(graphics);

// Add a point
graphics.add({
  id: 1,
  geometry: { type: 'Point', coordinates: [28.97, 41.01] },
  attributes: { name: 'Istanbul' },
});

// Animation pattern — replaceAll is O(1) refresh
graphics.replaceAll(updatedFeatures);`,
    },

    // ─── FeatureLayer ───
    {
      name: 'FeatureLayer',
      kind: 'class',
      description: 'Feature layer that queries a remote OGC service (WFS, OGC API Features). Supports pagination, caching, and collection switching.',
      extends: 'LayerBase',
      implements: ['IFeatureLayer', 'IQueryableLayer'],
      constructor: {
        signature: 'new FeatureLayer(options: FeatureLayerOptions)',
        params: [
          { name: 'options', type: 'FeatureLayerOptions', required: true, description: 'Feature layer configuration' },
        ],
      },
      optionsInterface: {
        name: 'FeatureLayerOptions',
        fields: [
          { name: 'id', type: 'string', required: false, description: 'Layer ID' },
          { name: 'url', type: 'string', required: false, description: 'Service base URL' },
          { name: 'collectionId', type: 'string', required: false, description: 'Feature collection ID' },
          { name: 'adapter', type: 'IFeatureAdapter', required: false, description: 'Injected adapter instance' },
          { name: 'adapterFactory', type: '(url: string) => IFeatureAdapter', required: false, description: 'Factory function for creating adapters' },
          { name: 'enableCache', type: 'boolean', required: false, description: 'Enable local feature caching' },
          { name: 'visible', type: 'boolean', required: false, default: 'true', description: 'Initial visibility' },
          { name: 'opacity', type: 'number', required: false, default: '1', description: 'Layer opacity (0-1)' },
        ],
      },
      properties: [
        { name: 'type', type: "'feature'", readonly: true, description: 'Layer type discriminant' },
        { name: 'renderer', type: 'IRenderer | undefined', readonly: false, description: 'Feature renderer for symbology. Set to apply custom symbols to features.' },
      ],
      methods: [
        { name: 'getFeatures', signature: 'getFeatures(): readonly Feature[]', description: 'Get cached features.', returns: 'readonly Feature[]' },
        { name: 'queryFeatures', signature: 'queryFeatures(params: QueryParams): Promise<Feature[]>', description: 'Remote query with bbox/where/limit.', returns: 'Promise<Feature[]>' },
        { name: 'queryExtent', signature: 'queryExtent(params?: QueryParams): Promise<Extent>', description: 'Get bounding extent of results.', returns: 'Promise<Extent>' },
        { name: 'getCollections', signature: 'getCollections(): readonly FeatureCollectionInfo[]', description: 'Get available feature collections from service.', returns: 'readonly FeatureCollectionInfo[]' },
        { name: 'getCollectionId', signature: 'getCollectionId(): string | undefined', description: 'Get current collection ID.', returns: 'string | undefined' },
      ],
      example: `const layer = new FeatureLayer({
  id: 'buildings',
  url: 'https://example.com/ogc/api',
  collectionId: 'buildings',
});
view.map.add(layer);

const results = await layer.queryFeatures({
  geometry: view.getBounds(),
  maxResults: 100,
});`,
    },

    // ─── WMSLayer ───
    {
      name: 'WMSLayer',
      kind: 'class',
      description: 'OGC WMS layer with GetCapabilities auto-detection, GetMap tile loading, and GetFeatureInfo queries.',
      extends: 'LayerBase',
      constructor: {
        signature: 'new WMSLayer(options: WMSLayerOptions)',
        params: [
          { name: 'options', type: 'WMSLayerOptions', required: true, description: 'WMS layer configuration' },
        ],
      },
      optionsInterface: {
        name: 'WMSLayerOptions',
        fields: [
          { name: 'id', type: 'string', required: false, description: 'Layer ID' },
          { name: 'url', type: 'string', required: true, description: 'WMS service URL' },
          { name: 'layers', type: 'string[]', required: true, description: 'Layer names to display' },
          { name: 'format', type: 'string', required: false, default: "'image/png'", description: 'Image format' },
          { name: 'transparent', type: 'boolean', required: false, default: 'true', description: 'Transparent background' },
          { name: 'crs', type: 'string', required: false, description: 'Coordinate reference system' },
          { name: 'proxyUrl', type: 'string', required: false, description: 'Proxy URL prefix for CORS' },
          { name: 'vendorParams', type: 'Record<string, string>', required: false, description: 'Extra WMS vendor parameters' },
          { name: 'adapter', type: 'IMapImageryAdapter', required: false, description: 'Injected adapter' },
          { name: 'visible', type: 'boolean', required: false, default: 'true', description: 'Initial visibility' },
          { name: 'opacity', type: 'number', required: false, default: '1', description: 'Layer opacity (0-1)' },
        ],
      },
      properties: [
        { name: 'type', type: "'wms'", readonly: true, description: 'Layer type discriminant' },
        { name: 'url', type: 'string', readonly: true, description: 'WMS service URL' },
        { name: 'layerNames', type: 'string[]', readonly: true, description: 'Visible layer names' },
        { name: 'format', type: 'string', readonly: true, description: 'Image format' },
        { name: 'transparent', type: 'boolean', readonly: true, description: 'Transparency flag' },
      ],
      methods: [
        { name: 'getTileUrl', signature: 'getTileUrl(extent: Extent, width: number, height: number): string', description: 'Generate GetMap URL for a given extent.', returns: 'string' },
        { name: 'getFeatureInfo', signature: 'getFeatureInfo(x: number, y: number, extent: Extent, width: number, height: number): Promise<FeatureInfoResult>', description: 'Query feature info at pixel position.', returns: 'Promise<FeatureInfoResult>' },
        { name: 'getLayerInfos', signature: 'getLayerInfos(): readonly MapImageryLayerInfo[]', description: 'Get capabilities metadata.', returns: 'readonly MapImageryLayerInfo[]' },
      ],
      example: `const wmsLayer = new WMSLayer({
  url: 'https://ows.mundialis.de/services/service',
  layers: ['TOPO-OSM-WMS'],
  format: 'image/png',
  transparent: true,
});
view.map.add(wmsLayer);`,
    },

    // ─── WGSLLayer ───
    {
      name: 'WGSLLayer',
      kind: 'class',
      description: 'Custom WGSL shader layer. Write your own vertex/fragment shaders with full control over the GPU pipeline. Supports uniforms, textures, and animation.',
      extends: 'LayerBase',
      implements: ['ICustomShaderLayer'],
      constructor: {
        signature: 'new WGSLLayer(options: WGSLLayerOptions)',
        params: [
          { name: 'options', type: 'WGSLLayerOptions', required: true, description: 'Shader layer configuration' },
        ],
      },
      optionsInterface: {
        name: 'WGSLLayerOptions',
        fields: [
          { name: 'id', type: 'string', required: false, description: 'Layer ID' },
          { name: 'vertexShader', type: 'string', required: true, description: 'WGSL vertex shader source' },
          { name: 'fragmentShader', type: 'string', required: true, description: 'WGSL fragment shader source' },
          { name: 'vertexBufferLayouts', type: 'CustomVertexBufferLayout[]', required: true, description: 'Vertex buffer layout definitions' },
          { name: 'animated', type: 'boolean', required: false, default: 'false', description: 'Force continuous rendering (for animations)' },
          { name: 'rawMode', type: 'boolean', required: false, default: 'false', description: 'Skip preamble injection (advanced)' },
          { name: 'blendState', type: 'GPUBlendState', required: false, description: 'GPU blend state override' },
          { name: 'topology', type: 'GPUPrimitiveTopology', required: false, default: "'triangle-list'", description: 'Primitive topology' },
        ],
      },
      properties: [
        { name: 'type', type: "'custom-shader'", readonly: true, description: 'Layer type discriminant' },
        { name: 'animated', type: 'boolean', readonly: true, description: 'Continuous render flag' },
        { name: 'rawMode', type: 'boolean', readonly: true, description: 'Raw mode flag' },
      ],
      methods: [
        { name: 'setVertexBuffer', signature: 'setVertexBuffer(index: number, buffer: GPUBuffer): void', description: 'Set a vertex buffer at a specific slot.', returns: 'void' },
        { name: 'setIndexBuffer', signature: 'setIndexBuffer(buffer: GPUBuffer, format?: GPUIndexFormat): void', description: 'Set the index buffer.', returns: 'void' },
        { name: 'setCustomUniforms', signature: 'setCustomUniforms(data: ArrayBuffer | Float32Array): void', description: 'Set custom uniform data.', returns: 'void' },
        { name: 'setTexture', signature: 'setTexture(texture: GPUTexture, samplerDesc?: GPUSamplerDescriptor): void', description: 'Set a texture binding.', returns: 'void' },
        { name: 'setDrawParams', signature: 'setDrawParams(params: { vertexCount?, instanceCount?, indexCount? }): void', description: 'Set draw call parameters.', returns: 'void' },
        { name: 'requestRender', signature: 'requestRender(): void', description: 'Trigger a repaint.', returns: 'void' },
      ],
      example: `const shaderLayer = new WGSLLayer({
  id: 'particles',
  vertexShader: \`/* your WGSL vertex shader */\`,
  fragmentShader: \`/* your WGSL fragment shader */\`,
  vertexBufferLayouts: [{
    arrayStride: 16,
    attributes: [
      { shaderLocation: 0, offset: 0, format: 'float32x2' },
      { shaderLocation: 1, offset: 8, format: 'float32x2' },
    ],
  }],
  animated: true,
});`,
    },

    // ─── GpuClusterLayer ───
    {
      name: 'GpuClusterLayer',
      kind: 'class',
      description: 'Point clustering layer using Grid++ algorithm. Clusters points at each zoom level, renders cluster circles with count labels using Canvas 2D. Supports theme presets and click-to-zoom.',
      extends: 'LayerBase',
      implements: ['IClusterLayer'],
      constructor: {
        signature: 'new GpuClusterLayer(options: GpuClusterLayerOptions)',
        params: [
          { name: 'options', type: 'GpuClusterLayerOptions', required: true, description: 'Cluster layer configuration' },
        ],
      },
      optionsInterface: {
        name: 'GpuClusterLayerOptions',
        fields: [
          { name: 'id', type: 'string', required: false, description: 'Layer ID' },
          { name: 'source', type: 'IFeatureLayer', required: true, description: 'Source feature layer containing points' },
          { name: 'clusterRadius', type: 'number', required: false, default: '60', description: 'Cluster radius in pixels' },
          { name: 'clusterMinPoints', type: 'number', required: false, default: '2', description: 'Minimum points to form a cluster' },
          { name: 'clusterMaxZoom', type: 'number', required: false, description: 'Stop clustering above this zoom' },
          { name: 'themePreset', type: "'ref-dark-cyan' | 'legacy-orange'", required: false, description: 'Visual theme preset' },
          { name: 'style', type: 'Partial<ClusterStyleConfig>', required: false, description: 'Custom style overrides' },
        ],
      },
      properties: [
        { name: 'type', type: "'gpu-cluster'", readonly: true, description: 'Layer type discriminant' },
        { name: 'sourceLayer', type: 'IFeatureLayer', readonly: false, description: 'Source feature layer' },
        { name: 'pointCount', type: 'number', readonly: true, description: 'Total point count' },
        { name: 'clusterRadius', type: 'number', readonly: false, description: 'Cluster radius (pixels)' },
        { name: 'clusterMinPoints', type: 'number', readonly: false, description: 'Min points per cluster' },
        { name: 'clusterStyle', type: 'ClusterStyleConfig', readonly: true, description: 'Current style config' },
        { name: 'themePreset', type: 'ClusterThemePreset', readonly: true, description: 'Active theme preset' },
      ],
      methods: [
        { name: 'setSource', signature: 'setSource(layer: IFeatureLayer): void', description: 'Set a new source feature layer.', returns: 'void' },
        { name: 'setThemePreset', signature: 'setThemePreset(preset: ClusterThemePreset, style?: Partial<ClusterStyleConfig>): void', description: 'Switch theme preset with optional overrides.', returns: 'void' },
        { name: 'setStyle', signature: 'setStyle(style: Partial<ClusterStyleConfig>): void', description: 'Apply style overrides.', returns: 'void' },
        { name: 'handleClusterClick', signature: 'handleClusterClick(screenX: number, screenY: number): void', description: 'Zoom to cluster bounds on click.', returns: 'void' },
        { name: 'attachView', signature: 'attachView(callbacks: ClusterViewCallbacks): void', description: 'Attach view coordinate conversion callbacks.', returns: 'void' },
      ],
      example: `const sourceLayer = new GeoJSONLayer({
  url: '/data/earthquakes.geojson',
});

const clusters = new GpuClusterLayer({
  source: sourceLayer,
  clusterRadius: 80,
  themePreset: 'ref-dark-cyan',
});
view.map.add(clusters);`,
    },
  ],
};

// ═══════════════════════════════════════════════
//  @mapgpu/render-webgpu
// ═══════════════════════════════════════════════

const renderPackage: PackageDoc = {
  name: '@mapgpu/render-webgpu',
  slug: 'render-webgpu',
  description: 'WebGPU render engine with shader pipelines.',
  install: 'npm install @mapgpu/render-webgpu',
  classes: [
    {
      name: 'RenderEngine',
      kind: 'class',
      description: 'Main GPU render engine. Manages WebGPU device, shader pipelines, draw delegates, sprite atlas, and model manager. Lazy-initializes pipelines on first use.',
      implements: ['IRenderEngine'],
      constructor: {
        signature: 'new RenderEngine()',
        params: [],
      },
      properties: [
        { name: 'capabilities', type: 'GpuCapabilities', readonly: true, description: 'GPU capability info (mode, features, limits)' },
      ],
      methods: [
        { name: 'init', signature: 'init(canvas: HTMLCanvasElement, depthConfig?: DepthConfig): Promise<GpuCapabilities>', description: 'Initialize WebGPU device and configure canvas context.', returns: 'Promise<GpuCapabilities>' },
        { name: 'setClearColor', signature: 'setClearColor(r: number, g: number, b: number, a: number): void', description: 'Set frame clear color (RGBA 0-1).', returns: 'void' },
        { name: 'beginFrame', signature: 'beginFrame(camera: CameraState): void', description: 'Begin a render frame with camera state.', returns: 'void' },
        { name: 'endFrame', signature: 'endFrame(): void', description: 'Submit all GPU commands.', returns: 'void' },
        { name: 'loadIcon', signature: 'loadIcon(id: string, image: ImageBitmap): void', description: 'Register an icon image in the sprite atlas.', returns: 'void' },
        { name: 'loadModel', signature: 'loadModel(id: string, glbData: ArrayBuffer): Promise<void>', description: 'Parse and upload a GLB model to GPU.', returns: 'Promise<void>' },
        { name: 'createBuffer', signature: 'createBuffer(data: ArrayBufferView, usage: GPUBufferUsageFlags): GPUBuffer', description: 'Create a GPU buffer with initial data.', returns: 'GPUBuffer' },
        { name: 'releaseBuffer', signature: 'releaseBuffer(buffer: GPUBuffer): void', description: 'Release a GPU buffer.', returns: 'void' },
        { name: 'pick', signature: 'pick(x: number, y: number): Promise<FeaturePickResult | null>', description: 'GPU picking — read feature ID at screen position.', returns: 'Promise<FeaturePickResult | null>' },
        { name: 'getMemoryAccounting', signature: 'getMemoryAccounting(): GpuMemoryAccounting', description: 'Get GPU memory usage breakdown.', returns: 'GpuMemoryAccounting' },
        { name: 'recover', signature: 'recover(): Promise<void>', description: 'Recover from device lost event.', returns: 'Promise<void>' },
        { name: 'destroy', signature: 'destroy(): void', description: 'Release all GPU resources.', returns: 'void' },
      ],
      example: `import { RenderEngine } from '@mapgpu/render-webgpu';

const engine = new RenderEngine();
const view = new MapView({
  container: '#map',
  renderEngine: engine,
});`,
    },
    {
      name: 'RenderLoop',
      kind: 'class',
      description: 'requestAnimationFrame loop with frame timing, dirty checking, and FPS stats. Only renders when marked dirty.',
      constructor: {
        signature: 'new RenderLoop(options?: RenderLoopOptions)',
        params: [
          { name: 'options', type: 'RenderLoopOptions', required: false, description: 'Loop configuration' },
        ],
      },
      optionsInterface: {
        name: 'RenderLoopOptions',
        fields: [
          { name: 'targetFps', type: 'number', required: false, default: '60', description: 'Target FPS (0 = unlimited)' },
        ],
      },
      properties: [
        { name: 'running', type: 'boolean', readonly: true, description: 'Whether the loop is active' },
        { name: 'isDirty', type: 'boolean', readonly: true, description: 'Whether a render is pending' },
      ],
      methods: [
        { name: 'markDirty', signature: 'markDirty(): void', description: 'Signal that a render is needed.', returns: 'void' },
        { name: 'start', signature: 'start(): void', description: 'Start the render loop.', returns: 'void' },
        { name: 'stop', signature: 'stop(): void', description: 'Stop the render loop.', returns: 'void' },
        { name: 'onFrame', signature: 'onFrame(callback: (deltaMs: number, frameNumber: number) => void): void', description: 'Register a frame callback.', returns: 'void' },
        { name: 'offFrame', signature: 'offFrame(callback: FrameCallback): void', description: 'Remove a frame callback.', returns: 'void' },
        { name: 'getStats', signature: 'getStats(): FrameStats', description: 'Get { fps, frameDurationMs, totalFrames, skippedFrames }.', returns: 'FrameStats' },
        { name: 'destroy', signature: 'destroy(): void', description: 'Stop loop and release resources.', returns: 'void' },
      ],
    },
    {
      name: 'SpriteAtlas',
      kind: 'class',
      description: 'Dynamic sprite atlas for icon symbols. Uses shelf-first-fit bin packing. Grows from 512x512 to 4096x4096 as icons are added.',
      methods: [
        { name: 'addIcon', signature: 'addIcon(id: string, image: ImageBitmap): UVRect', description: 'Add an icon and get its UV rectangle in the atlas.', returns: 'UVRect' },
        { name: 'getUVRect', signature: 'getUVRect(id: string): UVRect | undefined', description: 'Get UV rectangle for a previously loaded icon.', returns: 'UVRect | undefined' },
        { name: 'hasIcon', signature: 'hasIcon(id: string): boolean', description: 'Check if an icon is in the atlas.', returns: 'boolean' },
      ],
    },
    {
      name: 'ModelManager',
      kind: 'class',
      description: 'GLTF/GLB model GPU buffer cache. Parses GLB files, uploads vertex/index data, and manages instanced rendering buffers.',
      methods: [
        { name: 'loadModel', signature: 'loadModel(id: string, glbData: ArrayBuffer): Promise<void>', description: 'Parse and upload a GLB model.', returns: 'Promise<void>' },
        { name: 'hasModel', signature: 'hasModel(id: string): boolean', description: 'Check if model is loaded.', returns: 'boolean' },
        { name: 'getModel', signature: 'getModel(id: string): ParsedModel | undefined', description: 'Get parsed model data.', returns: 'ParsedModel | undefined' },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════
//  @mapgpu/adapters-ogc
// ═══════════════════════════════════════════════

const adaptersPackage: PackageDoc = {
  name: '@mapgpu/adapters-ogc',
  slug: 'adapters-ogc',
  description: 'Protocol adapters for OGC web services.',
  install: 'npm install @mapgpu/adapters-ogc',
  classes: [
    {
      name: 'WmsAdapter',
      kind: 'class',
      description: 'WMS 1.1.1/1.3.0 adapter with auto-version detection and BBOX axis order handling.',
      constructor: {
        signature: 'new WmsAdapter(options: WmsAdapterOptions)',
        params: [
          { name: 'options', type: 'WmsAdapterOptions', required: true, description: 'Adapter configuration' },
        ],
      },
      optionsInterface: {
        name: 'WmsAdapterOptions',
        fields: [
          { name: 'url', type: 'string', required: true, description: 'WMS service URL' },
          { name: 'fetchFn', type: 'typeof fetch', required: false, description: 'Custom fetch function' },
          { name: 'proxyUrl', type: 'string', required: false, description: 'Proxy URL prefix' },
        ],
      },
      methods: [
        { name: 'getCapabilities', signature: 'getCapabilities(): Promise<WmsCapabilities>', description: 'Fetch and parse GetCapabilities response.', returns: 'Promise<WmsCapabilities>' },
        { name: 'getMapUrl', signature: 'getMapUrl(params: GetMapParams): string', description: 'Generate GetMap URL.', returns: 'string' },
        { name: 'getFeatureInfo', signature: 'getFeatureInfo(params: GetFeatureInfoParams): Promise<FeatureInfoResult>', description: 'Query feature info at pixel.', returns: 'Promise<FeatureInfoResult>' },
      ],
    },
    {
      name: 'WfsAdapter',
      kind: 'class',
      description: 'WFS 2.0 adapter with GetFeature requests and pagination support.',
      constructor: {
        signature: 'new WfsAdapter(options: WfsAdapterOptions)',
        params: [
          { name: 'options', type: 'WfsAdapterOptions', required: true, description: 'Adapter configuration' },
        ],
      },
      optionsInterface: {
        name: 'WfsAdapterOptions',
        fields: [
          { name: 'url', type: 'string', required: true, description: 'WFS service URL' },
          { name: 'fetchFn', type: 'typeof fetch', required: false, description: 'Custom fetch function' },
          { name: 'proxyUrl', type: 'string', required: false, description: 'Proxy URL prefix' },
        ],
      },
      methods: [
        { name: 'getFeature', signature: 'getFeature(params: GetFeatureParams): Promise<Feature[]>', description: 'Fetch features with optional bbox/filter.', returns: 'Promise<Feature[]>' },
        { name: 'describeFeatureType', signature: 'describeFeatureType(typeName: string): Promise<FeatureTypeInfo>', description: 'Get schema of a feature type.', returns: 'Promise<FeatureTypeInfo>' },
      ],
    },
    {
      name: 'OgcApiAdapter',
      kind: 'class',
      description: 'OGC API - Features/Maps adapter with async iteration and collection discovery.',
      constructor: {
        signature: 'new OgcApiAdapter(options: OgcApiAdapterOptions)',
        params: [
          { name: 'options', type: 'OgcApiAdapterOptions', required: true, description: 'Adapter configuration' },
        ],
      },
      optionsInterface: {
        name: 'OgcApiAdapterOptions',
        fields: [
          { name: 'url', type: 'string', required: true, description: 'OGC API base URL' },
          { name: 'fetchFn', type: 'typeof fetch', required: false, description: 'Custom fetch function' },
        ],
      },
      methods: [
        { name: 'getCollections', signature: 'getCollections(): Promise<CollectionInfo[]>', description: 'List available feature collections.', returns: 'Promise<CollectionInfo[]>' },
        { name: 'getItems', signature: 'getItems(collectionId: string, params?: GetItemsParams): Promise<Feature[]>', description: 'Fetch items from a collection.', returns: 'Promise<Feature[]>' },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════
//  @mapgpu/widgets
// ═══════════════════════════════════════════════

const widgetsPackage: PackageDoc = {
  name: '@mapgpu/widgets',
  slug: 'widgets',
  description: 'UI widgets for map interaction.',
  install: 'npm install @mapgpu/widgets',
  classes: [
    {
      name: 'LayerListWidget',
      kind: 'class',
      description: 'Toggleable layer list with drag-to-reorder. Shows layer visibility, opacity, and display order.',
      constructor: {
        signature: 'new LayerListWidget(options?: LayerListWidgetOptions)',
        params: [{ name: 'options', type: 'LayerListWidgetOptions', required: false, description: 'Widget configuration' }],
      },
      optionsInterface: {
        name: 'LayerListWidgetOptions',
        fields: [
          { name: 'id', type: 'string', required: false, description: 'Widget ID' },
          { name: 'position', type: 'WidgetPosition', required: false, description: "Position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'manual'" },
        ],
      },
      properties: [
        { name: 'layers', type: 'ReadonlyArray<ILayer>', readonly: true, description: 'All registered layers' },
      ],
      methods: [
        { name: 'addLayer', signature: 'addLayer(layer: ILayer): void', description: 'Add a layer to the list.', returns: 'void' },
        { name: 'removeLayer', signature: 'removeLayer(layerOrId: ILayer | string): void', description: 'Remove a layer.', returns: 'void' },
        { name: 'reorderLayer', signature: 'reorderLayer(layerId: string, newIndex: number): void', description: 'Reorder a layer.', returns: 'void' },
        { name: 'mount', signature: 'mount(container: HTMLElement): void', description: 'Mount widget into DOM container.', returns: 'void' },
        { name: 'unmount', signature: 'unmount(): void', description: 'Remove from DOM.', returns: 'void' },
        { name: 'destroy', signature: 'destroy(): void', description: 'Cleanup and remove.', returns: 'void' },
      ],
    },
    {
      name: 'ScaleBarWidget',
      kind: 'class',
      description: 'Dynamic scale bar with metric/imperial units. Updates automatically on view changes.',
      constructor: {
        signature: 'new ScaleBarWidget(options?: ScaleBarWidgetOptions)',
        params: [{ name: 'options', type: 'ScaleBarWidgetOptions', required: false, description: 'Widget configuration' }],
      },
      optionsInterface: {
        name: 'ScaleBarWidgetOptions',
        fields: [
          { name: 'position', type: 'WidgetPosition', required: false, default: "'bottom-left'", description: 'Widget position' },
          { name: 'unit', type: "'metric' | 'imperial' | 'dual'", required: false, default: "'metric'", description: 'Unit system' },
          { name: 'maxWidthPx', type: 'number', required: false, default: '150', description: 'Maximum bar width in pixels' },
        ],
      },
      methods: [
        { name: 'setGroundResolution', signature: 'setGroundResolution(metersPerPixel: number): void', description: 'Update scale bar for current resolution.', returns: 'void' },
        { name: 'mount', signature: 'mount(container: HTMLElement): void', description: 'Mount widget.', returns: 'void' },
        { name: 'unmount', signature: 'unmount(): void', description: 'Unmount widget.', returns: 'void' },
      ],
    },
    {
      name: 'CoordinatesWidget',
      kind: 'class',
      description: 'Cursor position display. Supports DD (Decimal Degrees), DMS, and MGRS formats.',
      constructor: {
        signature: 'new CoordinatesWidget(options?: CoordinatesWidgetOptions)',
        params: [{ name: 'options', type: 'CoordinatesWidgetOptions', required: false, description: 'Widget configuration' }],
      },
      optionsInterface: {
        name: 'CoordinatesWidgetOptions',
        fields: [
          { name: 'position', type: 'WidgetPosition', required: false, default: "'bottom-right'", description: 'Widget position' },
          { name: 'format', type: "'DD' | 'DMS' | 'MGRS'", required: false, default: "'DD'", description: 'Coordinate display format' },
        ],
      },
      properties: [
        { name: 'screenToMap', type: '(x: number, y: number) => [number, number] | null', readonly: false, description: 'Set to view.toMap for coordinate conversion' },
      ],
      methods: [
        { name: 'setCoordinates', signature: 'setCoordinates(lon: number, lat: number): void', description: 'Manually set displayed coordinates.', returns: 'void' },
        { name: 'listenTo', signature: 'listenTo(container: HTMLElement): void', description: 'Auto-update on mouse move over container.', returns: 'void' },
        { name: 'mount', signature: 'mount(container: HTMLElement): void', description: 'Mount widget.', returns: 'void' },
      ],
    },
    {
      name: 'BasemapGalleryWidget',
      kind: 'class',
      description: 'Basemap switcher with thumbnail gallery. Switch between predefined basemap configurations.',
      constructor: {
        signature: 'new BasemapGalleryWidget(options?: BasemapGalleryWidgetOptions)',
        params: [{ name: 'options', type: 'BasemapGalleryWidgetOptions', required: false, description: 'Widget configuration' }],
      },
      methods: [
        { name: 'mount', signature: 'mount(container: HTMLElement): void', description: 'Mount widget.', returns: 'void' },
        { name: 'destroy', signature: 'destroy(): void', description: 'Cleanup.', returns: 'void' },
      ],
    },
    {
      name: 'PopupWidget',
      kind: 'class',
      description: 'Info popup anchored to map features. Shows at screen coordinates with custom HTML content.',
      constructor: {
        signature: 'new PopupWidget(options?: PopupWidgetOptions)',
        params: [{ name: 'options', type: 'PopupWidgetOptions', required: false, description: 'Widget configuration' }],
      },
      optionsInterface: {
        name: 'PopupWidgetOptions',
        fields: [
          { name: 'id', type: 'string', required: false, description: 'Widget ID' },
          { name: 'position', type: 'WidgetPosition', required: false, description: 'Widget position' },
        ],
      },
      methods: [
        { name: 'open', signature: 'open(options: { title?: string, content: string, screenX: number, screenY: number }): void', description: 'Open popup at screen position.', returns: 'void' },
        { name: 'close', signature: 'close(): void', description: 'Close the popup.', returns: 'void' },
        { name: 'mount', signature: 'mount(container: HTMLElement): void', description: 'Mount widget.', returns: 'void' },
      ],
    },
    {
      name: 'TooltipWidget',
      kind: 'class',
      description: 'Hover tooltip for feature attributes. Follows cursor and shows/hides on enter/leave.',
      constructor: {
        signature: 'new TooltipWidget(options?: TooltipWidgetOptions)',
        params: [{ name: 'options', type: 'TooltipWidgetOptions', required: false, description: 'Widget configuration' }],
      },
      methods: [
        { name: 'show', signature: 'show(content: string, screenX: number, screenY: number): void', description: 'Show tooltip at position.', returns: 'void' },
        { name: 'hide', signature: 'hide(): void', description: 'Hide the tooltip.', returns: 'void' },
        { name: 'mount', signature: 'mount(container: HTMLElement): void', description: 'Mount widget.', returns: 'void' },
      ],
    },
    {
      name: 'SearchWidget',
      kind: 'class',
      description: 'Geocoding search with pluggable providers. Text input with autocomplete results.',
      methods: [
        { name: 'mount', signature: 'mount(container: HTMLElement): void', description: 'Mount widget.', returns: 'void' },
        { name: 'destroy', signature: 'destroy(): void', description: 'Cleanup.', returns: 'void' },
      ],
    },
    {
      name: 'LegendWidget',
      kind: 'class',
      description: 'Auto-generated legend from layer renderers. Shows symbol previews with labels.',
      methods: [
        { name: 'mount', signature: 'mount(container: HTMLElement): void', description: 'Mount widget.', returns: 'void' },
        { name: 'destroy', signature: 'destroy(): void', description: 'Cleanup.', returns: 'void' },
      ],
    },
    {
      name: 'DrawToolbarWidget',
      kind: 'class',
      description: 'Drawing tool toolbar with tool switching. Integrates with ToolManager for point/polyline/polygon/edit tools.',
      methods: [
        { name: 'mount', signature: 'mount(container: HTMLElement): void', description: 'Mount widget.', returns: 'void' },
        { name: 'destroy', signature: 'destroy(): void', description: 'Cleanup.', returns: 'void' },
      ],
    },
    {
      name: 'MeasureToolbarWidget',
      kind: 'class',
      description: 'Measurement toolbar for point/line/area measurement. Unit switching (metric/imperial/nautical).',
      methods: [
        { name: 'mount', signature: 'mount(container: HTMLElement): void', description: 'Mount widget.', returns: 'void' },
        { name: 'destroy', signature: 'destroy(): void', description: 'Cleanup.', returns: 'void' },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════
//  @mapgpu/analysis
// ═══════════════════════════════════════════════

const analysisPackage: PackageDoc = {
  name: '@mapgpu/analysis',
  slug: 'analysis',
  description: 'Spatial analysis capabilities.',
  install: 'npm install @mapgpu/analysis',
  classes: [
    {
      name: 'BufferAnalysis',
      kind: 'class',
      description: 'Generate geodesic buffer polygons around geometries (points, lines, polygons).',
      constructor: { signature: 'new BufferAnalysis()', params: [] },
      methods: [
        { name: 'buffer', signature: 'buffer(params: BufferParams): Promise<BufferResult>', description: 'Create a buffer polygon around a geometry.', params: [
          { name: 'params.geometry', type: 'Geometry', required: true, description: 'Input geometry' },
          { name: 'params.distance', type: 'number', required: true, description: 'Buffer distance in meters' },
          { name: 'params.segments', type: 'number', required: false, default: '64', description: 'Circle approximation segments' },
        ], returns: 'Promise<BufferResult>' },
      ],
    },
    {
      name: 'RouteSampler',
      kind: 'class',
      description: 'Sample points along a route for elevation profile generation.',
      methods: [
        { name: 'sample', signature: 'sample(params: RouteSampleParams): Promise<RouteSampleResult>', description: 'Sample elevation along a route.', returns: 'Promise<RouteSampleResult>' },
      ],
    },
    {
      name: 'ElevationQuery',
      kind: 'class',
      description: 'Query elevation values from terrain data sources.',
      methods: [
        { name: 'query', signature: 'query(params: ElevationQueryParams): Promise<ElevationQueryResult>', description: 'Query elevation at points.', returns: 'Promise<ElevationQueryResult>' },
      ],
    },
    {
      name: 'LineOfSight',
      kind: 'class',
      description: 'LOS (Line of Sight) analysis between observer and target with terrain sampling.',
      constructor: {
        signature: 'new LosAnalysis(wasm: IWasmCore)',
        params: [{ name: 'wasm', type: 'IWasmCore', required: true, description: 'WASM core instance for computation' }],
      },
      methods: [
        { name: 'runLos', signature: 'runLos(params: LosParams): Promise<LosAnalysisResult>', description: 'Run LOS analysis.', params: [
          { name: 'params.observer', type: '[number, number, number?]', required: true, description: '[lon, lat, elevation]' },
          { name: 'params.target', type: '[number, number, number?]', required: true, description: '[lon, lat, elevation]' },
          { name: 'params.observerOffset', type: 'number', required: false, description: 'Observer height offset (m)' },
          { name: 'params.targetOffset', type: 'number', required: false, description: 'Target height offset (m)' },
          { name: 'params.sampleCount', type: 'number', required: false, description: 'Number of terrain samples' },
        ], returns: 'Promise<LosAnalysisResult>' },
      ],
    },
    {
      name: 'Viewshed',
      kind: 'class',
      description: 'Viewshed computation from an observer point. Determines visible/hidden areas based on terrain.',
      methods: [
        { name: 'compute', signature: 'compute(params: ViewshedParams): Promise<ViewshedResult>', description: 'Compute viewshed from observer.', returns: 'Promise<ViewshedResult>' },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════
//  @mapgpu/tools
// ═══════════════════════════════════════════════

const toolsPackage: PackageDoc = {
  name: '@mapgpu/tools',
  slug: 'tools',
  description: 'Interactive drawing and measurement tools.',
  install: 'npm install @mapgpu/tools',
  classes: [
    {
      name: 'ToolManager',
      kind: 'class',
      description: 'Tool lifecycle manager. Creates an overlay div for event interception, manages tool activation/deactivation, undo/redo command system.',
      constructor: {
        signature: 'new ToolManager(options?: ToolManagerOptions)',
        params: [{ name: 'options', type: 'ToolManagerOptions', required: false, description: 'Configuration' }],
      },
      optionsInterface: {
        name: 'ToolManagerOptions',
        fields: [
          { name: 'previewLayer', type: 'IPreviewLayer', required: false, description: 'Layer for drawing previews' },
          { name: 'maxHistorySize', type: 'number', required: false, default: '50', description: 'Undo history limit' },
          { name: 'wheelPassthrough', type: 'boolean', required: false, default: 'true', description: 'Pass wheel events to map' },
        ],
      },
      properties: [
        { name: 'activeTool', type: 'ITool | null', readonly: true, description: 'Currently active tool' },
        { name: 'tools', type: 'ReadonlyMap<string, ITool>', readonly: true, description: 'All registered tools' },
      ],
      methods: [
        { name: 'init', signature: 'init(refs: { canvas, container, toMap, toScreen, getMode, getZoom, markDirty }): void', description: 'Initialize with view references. Called automatically by MapView.', returns: 'void' },
        { name: 'registerTool', signature: 'registerTool(tool: ITool): void', description: 'Register a tool.', returns: 'void' },
        { name: 'unregisterTool', signature: 'unregisterTool(id: string): void', description: 'Remove a tool.', returns: 'void' },
        { name: 'activateTool', signature: 'activateTool(id: string): void', description: 'Activate a tool by ID.', returns: 'void' },
        { name: 'deactivateTool', signature: 'deactivateTool(): void', description: 'Deactivate the current tool.', returns: 'void' },
        { name: 'undo', signature: 'undo(): void', description: 'Undo last command.', returns: 'void' },
        { name: 'redo', signature: 'redo(): void', description: 'Redo last undone command.', returns: 'void' },
        { name: 'destroy', signature: 'destroy(): void', description: 'Cleanup overlay and event listeners.', returns: 'void' },
      ],
    },
    {
      name: 'DrawPointTool',
      kind: 'class',
      description: 'Point placement tool. Click to place a point feature.',
      implements: ['ITool'],
      constructor: {
        signature: 'new DrawPointTool(options: DrawPointToolOptions)',
        params: [{ name: 'options', type: 'DrawPointToolOptions', required: true, description: 'Tool configuration' }],
      },
      optionsInterface: {
        name: 'DrawPointToolOptions',
        fields: [
          { name: 'targetLayer', type: 'ITargetLayer', required: true, description: 'Layer to add drawn features to' },
        ],
      },
      properties: [
        { name: 'id', type: "'draw-point'", readonly: true, description: 'Tool ID' },
        { name: 'name', type: "'Draw Point'", readonly: true, description: 'Display name' },
      ],
    },
    {
      name: 'DrawPolylineTool',
      kind: 'class',
      description: 'Polyline drawing tool. Click to add vertices, double-click to finish.',
      implements: ['ITool'],
      constructor: {
        signature: 'new DrawPolylineTool(options: DrawPolylineToolOptions)',
        params: [{ name: 'options', type: 'DrawPolylineToolOptions', required: true, description: 'Tool configuration' }],
      },
      optionsInterface: {
        name: 'DrawPolylineToolOptions',
        fields: [
          { name: 'targetLayer', type: 'ITargetLayer', required: true, description: 'Layer to add drawn features to' },
        ],
      },
      properties: [
        { name: 'id', type: "'draw-polyline'", readonly: true, description: 'Tool ID' },
        { name: 'name', type: "'Draw Polyline'", readonly: true, description: 'Display name' },
      ],
    },
    {
      name: 'DrawPolygonTool',
      kind: 'class',
      description: 'Polygon drawing tool. Click to add vertices, double-click to close and finish.',
      implements: ['ITool'],
      constructor: {
        signature: 'new DrawPolygonTool(options: DrawPolygonToolOptions)',
        params: [{ name: 'options', type: 'DrawPolygonToolOptions', required: true, description: 'Tool configuration' }],
      },
      optionsInterface: {
        name: 'DrawPolygonToolOptions',
        fields: [
          { name: 'targetLayer', type: 'ITargetLayer', required: true, description: 'Layer to add drawn features to' },
        ],
      },
      properties: [
        { name: 'id', type: "'draw-polygon'", readonly: true, description: 'Tool ID' },
        { name: 'name', type: "'Draw Polygon'", readonly: true, description: 'Display name' },
      ],
    },
    {
      name: 'EditTool',
      kind: 'class',
      description: 'Vertex editing tool. Move, delete, and insert vertices on existing features.',
      implements: ['ITool'],
      properties: [
        { name: 'id', type: "'edit'", readonly: true, description: 'Tool ID' },
        { name: 'name', type: "'Edit'", readonly: true, description: 'Display name' },
      ],
    },
    {
      name: 'SnapEngine',
      kind: 'class',
      description: 'Vertex/edge snapping engine with configurable tolerance. Snaps drawing tools to nearby features.',
      constructor: {
        signature: 'new SnapEngine(options?: SnapOptions)',
        params: [{ name: 'options', type: 'SnapOptions', required: false, description: 'Snap configuration' }],
      },
      optionsInterface: {
        name: 'SnapOptions',
        fields: [
          { name: 'vertex', type: 'boolean', required: false, default: 'true', description: 'Enable vertex snapping' },
          { name: 'edge', type: 'boolean', required: false, default: 'false', description: 'Enable edge snapping' },
          { name: 'tolerance', type: 'number', required: false, default: '10', description: 'Snap tolerance in pixels' },
        ],
      },
      methods: [
        { name: 'snap', signature: 'snap(screenX: number, screenY: number, mapCoords: [number, number], toScreen: Function): SnapResult', description: "Snap to nearest vertex/edge. Returns { coords, type: 'vertex'|'edge'|'none' }.", returns: 'SnapResult' },
        { name: 'addSourceLayer', signature: 'addSourceLayer(layer: SnapSourceLayer): void', description: 'Add a snap source layer.', returns: 'void' },
        { name: 'removeSourceLayer', signature: 'removeSourceLayer(layer: SnapSourceLayer): void', description: 'Remove a snap source.', returns: 'void' },
        { name: 'setTolerance', signature: 'setTolerance(px: number): void', description: 'Change snap tolerance.', returns: 'void' },
      ],
    },
    {
      name: 'MeasurePointTool',
      kind: 'class',
      description: 'Point coordinate measurement tool.',
      implements: ['ITool'],
      properties: [
        { name: 'id', type: "'measure-point'", readonly: true, description: 'Tool ID' },
      ],
    },
    {
      name: 'MeasureLineTool',
      kind: 'class',
      description: 'Geodesic distance measurement using Haversine formula.',
      implements: ['ITool'],
      properties: [
        { name: 'id', type: "'measure-line'", readonly: true, description: 'Tool ID' },
      ],
    },
    {
      name: 'MeasureAreaTool',
      kind: 'class',
      description: 'Spherical area measurement tool.',
      implements: ['ITool'],
      properties: [
        { name: 'id', type: "'measure-area'", readonly: true, description: 'Tool ID' },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════
//  @mapgpu/wasm-core
// ═══════════════════════════════════════════════

const wasmPackage: PackageDoc = {
  name: '@mapgpu/wasm-core',
  slug: 'wasm-core',
  description: 'Rust/WASM spatial computing primitives.',
  install: 'npm install @mapgpu/wasm-core',
  classes: [
    {
      name: 'triangulate',
      kind: 'function',
      description: 'Polygon triangulation returning vertex + index TypedArrays. Uses earcut algorithm for holes support.',
      methods: [
        { name: 'triangulate', signature: 'triangulate(coords: Float64Array, holeIndices?: Uint32Array): { vertices: Float32Array, indices: Uint32Array }', description: 'Triangulate a polygon (with optional holes).', returns: '{ vertices: Float32Array, indices: Uint32Array }' },
      ],
    },
    {
      name: 'cluster_points',
      kind: 'function',
      description: 'Grid++ point clustering algorithm. Groups nearby points into clusters at a given radius.',
      methods: [
        { name: 'cluster_points', signature: 'cluster_points(points: Float32Array, radius: number, extent: Float64Array): ClusterResult', description: 'Cluster points within radius.', returns: 'ClusterResult' },
      ],
    },
    {
      name: 'project_coordinates',
      kind: 'function',
      description: 'Batch coordinate projection between CRS (EPSG:4326 ↔ EPSG:3857).',
      methods: [
        { name: 'project_coordinates', signature: 'project_coordinates(coords: Float64Array, fromCrs: string, toCrs: string): Float64Array', description: 'Project coordinate pairs.', returns: 'Float64Array' },
      ],
    },
    {
      name: 'build_spatial_index',
      kind: 'function',
      description: 'R-tree spatial index with Hilbert curve optimization for fast bbox queries.',
      methods: [
        { name: 'build_spatial_index', signature: 'build_spatial_index(bboxes: Float64Array): SpatialIndex', description: 'Build spatial index from bounding boxes.', returns: 'SpatialIndex' },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════
//  Export all packages
// ═══════════════════════════════════════════════

export const allPackages: PackageDoc[] = [
  corePackage,
  layersPackage,
  renderPackage,
  adaptersPackage,
  widgetsPackage,
  analysisPackage,
  toolsPackage,
  wasmPackage,
];

export function getPackageBySlug(slug: string): PackageDoc | undefined {
  return allPackages.find((p) => p.slug === slug);
}

export function getClassDoc(pkgSlug: string, className: string): { pkg: PackageDoc; cls: ClassDoc } | undefined {
  const pkg = getPackageBySlug(pkgSlug);
  if (!pkg) return undefined;
  const cls = pkg.classes.find((c) => c.name === className);
  if (!cls) return undefined;
  return { pkg, cls };
}
