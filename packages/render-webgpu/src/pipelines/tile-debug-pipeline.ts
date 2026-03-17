/**
 * Tile Debug Pipeline — Wireframe + vertex dots + tile border overlay.
 *
 * Three visual layers per tile:
 *   1. Wireframe grid (line-list) — subtle cyan
 *   2. Vertex dots (instanced quads, circle-masked) — bright yellow
 *   3. Tile border (screen-space expanded quads) — thick orange
 *
 * All three layers support per-vertex height displacement via a height
 * texture at @group(2). Tiles without height data bind a shared zero texture.
 *
 * Works in both 2D (flat Mercator) and 3D (globe) modes.
 */

import { createSubdivisionMesh } from './subdivision-mesh.js';
import { createZeroHeightTexture } from '../height-brush.js';
import { MSAA_SAMPLE_COUNT } from '../frame-context.js';

// ─── Types ───

export interface TileDebugMesh {
  vertexBuffer: GPUBuffer;
  wireframeIndexBuffer: GPUBuffer;
  wireframeIndexCount: number;
  vertexCount: number;
  subdivisions: number;
}

export interface TileDebugSuiteDescriptor {
  device: GPUDevice;
  colorFormat: GPUTextureFormat;
  cameraBindGroupLayout: GPUBindGroupLayout;
  depthFormat?: GPUTextureFormat;
  depthCompare?: GPUCompareFunction;
  globe?: boolean;
  sampleCount?: number;
}

export interface TileDebugSuite {
  wireframePipeline: GPURenderPipeline;
  dotPipeline: GPURenderPipeline;
  borderPipeline: GPURenderPipeline;
  /** Uniform bind group layout (group 1) */
  bindGroupLayout: GPUBindGroupLayout;
  /** Height texture bind group layout (group 2) */
  heightBindGroupLayout: GPUBindGroupLayout;
  /** Shared sampler for dynamically bound terrain textures */
  heightSampler: GPUSampler;
  mesh: TileDebugMesh;
  quadBuffer: GPUBuffer;
  /** Shared zero-height texture for tiles without brush data */
  zeroHeightTexture: GPUTexture;
  /** Pre-built bind group for zero heights */
  zeroHeightBindGroup: GPUBindGroup;
}

// ─── Constants ───

/** Uniform layout: 112 bytes = 28 floats */
export const DEBUG_UNIFORM_SIZE = 112;

// Default colors
export const GRID_COLOR: [number, number, number, number]   = [0.0, 1.0, 1.0, 0.35];   // subtle cyan
export const DOT_COLOR: [number, number, number, number]    = [1.0, 1.0, 0.3, 0.92];    // bright yellow
export const BORDER_COLOR: [number, number, number, number] = [1.0, 0.4, 0.0, 0.85];    // orange
export const DOT_SIZE     = 3.0;  // pixels radius
export const BORDER_WIDTH = 2.0;  // pixels half-width

// ─── Mesh Creation ───

function createWireframeIndices(subdivisions: number): { data: Uint16Array | Uint32Array; count: number } {
  const gridSize = subdivisions + 1;
  const vertexCount = gridSize * gridSize;
  const lineSegments = 2 * subdivisions * gridSize;
  const indexCount = lineSegments * 2;
  const useUint32 = vertexCount > 65535;
  const indices = useUint32 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);

  let idx = 0;
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < subdivisions; x++) {
      indices[idx++] = y * gridSize + x;
      indices[idx++] = y * gridSize + x + 1;
    }
  }
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < subdivisions; y++) {
      indices[idx++] = y * gridSize + x;
      indices[idx++] = (y + 1) * gridSize + x;
    }
  }
  return { data: indices, count: indexCount };
}

export function createTileDebugMesh(device: GPUDevice, subdivisions = 32): TileDebugMesh {
  const gridMesh = createSubdivisionMesh(device, subdivisions);
  const { data: wireframeIndices, count: wireframeIndexCount } = createWireframeIndices(subdivisions);

  const wireframeIndexBuffer = device.createBuffer({
    label: 'tile-debug-wireframe-index',
    size: wireframeIndices.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(wireframeIndexBuffer, 0, wireframeIndices.buffer);

  return {
    vertexBuffer: gridMesh.vertexBuffer,
    wireframeIndexBuffer,
    wireframeIndexCount,
    vertexCount: gridMesh.vertexCount,
    subdivisions,
  };
}

/** Unit quad: 6 vertices for 2 triangles (triangle-list). */
function createQuadBuffer(device: GPUDevice): GPUBuffer {
  const data = new Float32Array([
    -1, -1,   1, -1,  -1,  1,
     1, -1,   1,  1,  -1,  1,
  ]);
  const buf = device.createBuffer({
    label: 'tile-debug-quad',
    size: data.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(buf, 0, data);
  return buf;
}

// ─── WGSL Shader Generation ───

/**
 * Uniform struct shared by all 3 passes.
 *
 * Layout (112 bytes):
 *   [0-15]  extent:      vec4  — tile extent or mercator extent
 *   [16-31] gridColor:   vec4
 *   [32-47] dotColor:    vec4
 *   [48-63] borderColor: vec4
 *   [64-79] params:      vec4  — x=dotSize, y=borderWidth, z=heightExag, w=subdivisions
 *   [80-95] heightMode:  vec4  — x=0(world) or 1(tile-local)
 *   [96-111] terrainUv:  vec4  — [offsetX, offsetY, scaleX, scaleY]
 */
const UNIFORM_BLOCK = /* wgsl */ `
struct TileDebugUniforms {
  extent: vec4<f32>,
  gridColor: vec4<f32>,
  dotColor: vec4<f32>,
  borderColor: vec4<f32>,
  params: vec4<f32>,
  heightMode: vec4<f32>,
  terrainUv: vec4<f32>,
};
@group(1) @binding(0) var<uniform> tile: TileDebugUniforms;
`;

/** Height texture + sampler bindings */
const HEIGHT_TEXTURE = /* wgsl */ `
@group(2) @binding(0) var heightMap: texture_2d<f32>;
@group(2) @binding(1) var heightSampler: sampler;

// Manual bilinear height sampling (r32float needs unfilterable-float)
fn sampleHeight(uv: vec2<f32>) -> f32 {
  let dims = vec2<f32>(textureDimensions(heightMap, 0));
  let tc = uv * max(dims - vec2(1.0), vec2(0.0));
  let tc0 = vec2<i32>(floor(tc));
  let f = fract(tc);
  let maxC = vec2<i32>(dims) - 1;
  let h00 = textureLoad(heightMap, clamp(tc0, vec2(0), maxC), 0).r;
  let h10 = textureLoad(heightMap, clamp(tc0 + vec2(1, 0), vec2(0), maxC), 0).r;
  let h01 = textureLoad(heightMap, clamp(tc0 + vec2(0, 1), vec2(0), maxC), 0).r;
  let h11 = textureLoad(heightMap, clamp(tc0 + vec2(1, 1), vec2(0), maxC), 0).r;
  return mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y);
}
`;

/** Direct world-space height sampling (matches globe raster displacement). */
const HEIGHT_HELPER = /* wgsl */ `
const EARTH_RADIUS_METERS: f32 = 6378137.0;

fn terrainUvForTileUv(tileUv: vec2<f32>) -> vec2<f32> {
  return tile.terrainUv.xy + tileUv * tile.terrainUv.zw;
}

fn heightAtUV(uv: vec2<f32>) -> f32 {
  if (tile.heightMode.x >= 0.5) {
    return sampleHeight(terrainUvForTileUv(uv)) / EARTH_RADIUS_METERS;
  }
  return sampleHeight(vec2<f32>(
    mix(tile.extent.x, tile.extent.z, uv.x),
    mix(tile.extent.y, tile.extent.w, uv.y)
  ));
}
`;

function cameraBlock(globe: boolean): string {
  if (!globe) {
    return /* wgsl */ `
struct CameraUniforms {
  viewProjection: mat4x4<f32>,
  viewport: vec2<f32>,
};
@group(0) @binding(0) var<uniform> camera: CameraUniforms;
`;
  }
  return /* wgsl */ `
const PI: f32 = 3.14159265358979323846;
const TWO_PI: f32 = 6.28318530717958647692;
struct GlobeCameraUniforms {
  viewProjection: mat4x4<f32>,
  flatViewProjection: mat4x4<f32>,
  viewport: vec2<f32>,
  projectionTransition: f32,
  globeRadius: f32,
  clippingPlane: vec4<f32>,
};
@group(0) @binding(0) var<uniform> camera: GlobeCameraUniforms;
fn mercatorToAngular(merc: vec2<f32>) -> vec2<f32> {
  let lon = merc.x * TWO_PI - PI;
  let lat = atan(exp(PI - merc.y * TWO_PI)) * 2.0 - PI * 0.5;
  return vec2<f32>(lon, lat);
}
fn angularToSphere(lon: f32, lat: f32) -> vec3<f32> {
  let cosLat = cos(lat);
  return vec3<f32>(cosLat * sin(lon), sin(lat), cosLat * cos(lon));
}
fn globeClippingZ(spherePos: vec3<f32>) -> f32 {
  return 1.0 - (dot(spherePos, camera.clippingPlane.xyz) + camera.clippingPlane.w);
}
`;
}

/**
 * Shared projection function with height displacement.
 *
 * 2D: clip-space Y displacement (zoom-independent).
 * Globe: radial displacement + flat fallback via Mercator Z.
 */
function projectionFn(globe: boolean): string {
  if (!globe) {
    return /* wgsl */ `
struct ProjResult {
  clipPos: vec4<f32>,
  clipDot: f32,
};
fn projectUV(uv: vec2<f32>, height: f32) -> ProjResult {
  let wx = mix(tile.extent.x, tile.extent.z, uv.x);
  let wy = mix(tile.extent.y, tile.extent.w, uv.y);
  let exag = tile.params.z;
  var r: ProjResult;
  r.clipPos = camera.viewProjection * vec4<f32>(wx, wy, 0.0, 1.0);
  r.clipPos.y += height * exag * r.clipPos.w;
  r.clipDot = 1.0;
  return r;
}
`;
  }
  return /* wgsl */ `
struct ProjResult {
  clipPos: vec4<f32>,
  clipDot: f32,
};
fn projectUV(uv: vec2<f32>, height: f32) -> ProjResult {
  let mx = mix(tile.extent.x, tile.extent.z, uv.x);
  let my = mix(tile.extent.y, tile.extent.w, uv.y);
  let ang = mercatorToAngular(vec2<f32>(mx, my));
  let sp_base = angularToSphere(ang.x, ang.y);
  let exag = tile.params.z;
  let sp = sp_base * (1.0 + height * exag);
  var gc = camera.viewProjection * vec4<f32>(sp, 1.0);
  gc.z = globeClippingZ(sp_base) * gc.w;
  let cd = dot(sp_base, camera.clippingPlane.xyz) + camera.clippingPlane.w;
  var cp: vec4<f32>;
  if (camera.projectionTransition >= 0.999) { cp = gc; }
  else if (camera.projectionTransition <= 0.001) {
    var fc = camera.flatViewProjection * vec4<f32>(mx, my, height * exag, 1.0);
    cp = fc;
  } else {
    var fc = camera.flatViewProjection * vec4<f32>(mx, my, height * exag, 1.0);
    cp = mix(fc, gc, camera.projectionTransition);
  }
  cp.z -= 0.0005 * cp.w;
  cp.z = min(cp.z, cp.w * 0.9999);
  var r: ProjResult;
  r.clipPos = cp;
  r.clipDot = cd;
  return r;
}
`;
}

/** Horizon discard for fragment — no-op in 2D (clipDot always 1). */
function horizonDiscard(globe: boolean): string {
  if (!globe) return '';
  return /* wgsl */ `
  if (camera.projectionTransition > 0.01 && input.clipDot < -0.01) { discard; }
`;
}

// ─── Wireframe Shader ───

function buildWireframeShader(globe: boolean): string {
  return cameraBlock(globe) + UNIFORM_BLOCK + HEIGHT_TEXTURE + projectionFn(globe) + HEIGHT_HELPER + /* wgsl */ `
struct VOut { @builtin(position) position: vec4<f32>, @location(0) clipDot: f32 };

@vertex fn vs_main(@builtin(vertex_index) vid: u32, @location(0) uv: vec2<f32>) -> VOut {
  let h = heightAtUV(uv);
  let p = projectUV(uv, h);
  var o: VOut;
  o.position = p.clipPos;
  o.clipDot = p.clipDot;
  return o;
}
@fragment fn fs_main(input: VOut) -> @location(0) vec4<f32> {
  ${horizonDiscard(globe)}
  return tile.gridColor;
}
`;
}

// ─── Dot Shader (instanced quads) ───

function buildDotShader(globe: boolean): string {
  return cameraBlock(globe) + UNIFORM_BLOCK + HEIGHT_TEXTURE + projectionFn(globe) + HEIGHT_HELPER + /* wgsl */ `
struct VOut {
  @builtin(position) position: vec4<f32>,
  @location(0) clipDot: f32,
  @location(1) local: vec2<f32>,
};

@vertex fn vs_main(
  @location(0) corner: vec2<f32>,
  @location(1) instUV: vec2<f32>,
  @builtin(instance_index) iid: u32,
) -> VOut {
  let h = heightAtUV(instUV);
  let p = projectUV(instUV, h);
  var cp = p.clipPos;
  let sz = tile.params.x;
  cp.x += corner.x * sz * 2.0 / camera.viewport.x * cp.w;
  cp.y -= corner.y * sz * 2.0 / camera.viewport.y * cp.w;
  var o: VOut;
  o.position = cp;
  o.clipDot = p.clipDot;
  o.local = corner;
  return o;
}
@fragment fn fs_main(input: VOut) -> @location(0) vec4<f32> {
  ${horizonDiscard(globe)}
  if (length(input.local) > 1.0) { discard; }
  return tile.dotColor;
}
`;
}

// ─── Border Shader (4 edges × 6 verts from vertex_index) ───

function buildBorderShader(globe: boolean): string {
  return cameraBlock(globe) + UNIFORM_BLOCK + HEIGHT_TEXTURE + projectionFn(globe) + HEIGHT_HELPER + /* wgsl */ `
struct VOut { @builtin(position) position: vec4<f32>, @location(0) clipDot: f32 };

@vertex fn vs_main(@builtin(vertex_index) vid: u32) -> VOut {
  // 4 edges: bottom, right, top, left
  var su = array<f32,4>(0.0, 1.0, 1.0, 0.0);
  var sv = array<f32,4>(0.0, 0.0, 1.0, 1.0);
  var eu = array<f32,4>(1.0, 1.0, 0.0, 0.0);
  var ev = array<f32,4>(0.0, 1.0, 1.0, 0.0);

  let edge = vid / 6u;
  let vi = vid % 6u;

  // t: 0=start, 1=end. side: -1 or +1
  var ts = array<f32,6>(0.0, 1.0, 0.0, 1.0, 1.0, 0.0);
  var si = array<f32,6>(-1.0, -1.0, 1.0, -1.0, 1.0, 1.0);
  let t = ts[vi];
  let side = si[vi];

  let startUV = vec2<f32>(su[edge], sv[edge]);
  let endUV   = vec2<f32>(eu[edge], ev[edge]);
  let uv = mix(startUV, endUV, t);

  let h     = heightAtUV(uv);
  let hS    = heightAtUV(startUV);
  let hE    = heightAtUV(endUV);
  let p     = projectUV(uv, h);
  let pStart = projectUV(startUV, hS);
  let pEnd   = projectUV(endUV, hE);

  // Screen-space edge direction → perpendicular
  let s0 = pStart.clipPos.xy / pStart.clipPos.w;
  let s1 = pEnd.clipPos.xy / pEnd.clipPos.w;
  let edgeDir = normalize(s1 - s0);
  let normal = vec2<f32>(-edgeDir.y, edgeDir.x);

  let hw = tile.params.y; // half-width in pixels
  let offset = normal * side * hw * 2.0 / camera.viewport;

  var cp = p.clipPos;
  cp.x += offset.x * cp.w;
  cp.y += offset.y * cp.w;

  var o: VOut;
  o.position = cp;
  o.clipDot = p.clipDot;
  return o;
}
@fragment fn fs_main(input: VOut) -> @location(0) vec4<f32> {
  ${horizonDiscard(globe)}
  return tile.borderColor;
}
`;
}

// ─── Bind Group Layouts ───

function createDebugBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'tile-debug-bind-group-layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
    ],
  });
}

function createHeightBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'tile-debug-height-layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        texture: { sampleType: 'unfilterable-float' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.VERTEX,
        sampler: { type: 'non-filtering' },
      },
    ],
  });
}

// ─── Shared blend state ───

const BLEND_ALPHA = {
  color: { srcFactor: 'src-alpha' as GPUBlendFactor, dstFactor: 'one-minus-src-alpha' as GPUBlendFactor, operation: 'add' as GPUBlendOperation },
  alpha: { srcFactor: 'one' as GPUBlendFactor, dstFactor: 'one-minus-src-alpha' as GPUBlendFactor, operation: 'add' as GPUBlendOperation },
};

// ─── Suite Factory ───

export function createTileDebugSuite(desc: TileDebugSuiteDescriptor): TileDebugSuite {
  const { device, colorFormat, cameraBindGroupLayout } = desc;
  const globe = desc.globe ?? false;

  const bindGroupLayout = createDebugBindGroupLayout(device);
  const heightBindGroupLayout = createHeightBindGroupLayout(device);
  const heightSampler = device.createSampler({
    label: 'tile-debug-height-sampler',
    magFilter: 'nearest',
    minFilter: 'nearest',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
  });

  const layout = device.createPipelineLayout({
    label: `tile-debug-${globe ? 'globe' : '2d'}-layout`,
    bindGroupLayouts: [cameraBindGroupLayout, bindGroupLayout, heightBindGroupLayout],
  });

  const depthStencil = {
    format: (desc.depthFormat ?? 'depth24plus') as GPUTextureFormat,
    depthWriteEnabled: false,
    depthCompare: (globe ? (desc.depthCompare ?? 'less') : 'always') as GPUCompareFunction,
  };

  const target = { format: colorFormat, blend: BLEND_ALPHA };

  const multisample = { count: desc.sampleCount ?? MSAA_SAMPLE_COUNT };

  // 1) Wireframe pipeline
  const wireframeMod = device.createShaderModule({ label: 'dbg-wireframe', code: buildWireframeShader(globe) });
  const wireframePipeline = device.createRenderPipeline({
    label: 'dbg-wireframe',
    layout,
    vertex: {
      module: wireframeMod,
      entryPoint: 'vs_main',
      buffers: [{ arrayStride: 8, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' as GPUVertexFormat }] }],
    },
    fragment: { module: wireframeMod, entryPoint: 'fs_main', targets: [target] },
    primitive: { topology: 'line-list' },
    depthStencil,
    multisample,
  });

  // 2) Dot pipeline (instanced quads)
  const dotMod = device.createShaderModule({ label: 'dbg-dot', code: buildDotShader(globe) });
  const dotPipeline = device.createRenderPipeline({
    label: 'dbg-dot',
    layout,
    vertex: {
      module: dotMod,
      entryPoint: 'vs_main',
      buffers: [
        { arrayStride: 8, stepMode: 'vertex', attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' as GPUVertexFormat }] },
        { arrayStride: 8, stepMode: 'instance', attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x2' as GPUVertexFormat }] },
      ],
    },
    fragment: { module: dotMod, entryPoint: 'fs_main', targets: [target] },
    primitive: { topology: 'triangle-list' },
    depthStencil,
    multisample,
  });

  // 3) Border pipeline (24 verts from vertex_index, no vertex buffer)
  const borderMod = device.createShaderModule({ label: 'dbg-border', code: buildBorderShader(globe) });
  const borderPipeline = device.createRenderPipeline({
    label: 'dbg-border',
    layout,
    vertex: { module: borderMod, entryPoint: 'vs_main', buffers: [] },
    fragment: { module: borderMod, entryPoint: 'fs_main', targets: [target] },
    primitive: { topology: 'triangle-list' },
    depthStencil,
    multisample,
  });

  const mesh = createTileDebugMesh(device, 32);
  const quadBuffer = createQuadBuffer(device);

  // Zero-height texture for tiles without brush data (1×1 r32float = 0)
  const { texture: zeroHeightTexture, bindGroup: zeroHeightBindGroup } =
    createZeroHeightTexture(device, heightBindGroupLayout);

  return {
    wireframePipeline,
    dotPipeline,
    borderPipeline,
    bindGroupLayout,
    heightBindGroupLayout,
    heightSampler,
    mesh,
    quadBuffer,
    zeroHeightTexture,
    zeroHeightBindGroup,
  };
}
