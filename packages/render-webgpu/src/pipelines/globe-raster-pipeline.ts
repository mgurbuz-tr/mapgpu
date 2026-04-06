/**
 * Globe Raster Pipeline
 *
 * WGSL shader: tile UV → Mercator → Angular → Unit Sphere dönüşüm zinciri.
 * projectionTransition (0-1) ile Mercator flat ↔ globe sphere smooth blend.
 * Horizon occlusion: clipping plane dot product testi.
 * Height displacement:
 * - mode 0: world-space debug brush height texture
 * - mode 1: tile-local terrain height texture (meters -> world unit conversion)
 *
 * MapLibre'nin _projection_globe.vertex.glsl adaptasyonu — WebGPU/WGSL.
 */

import type { SubdivisionMesh } from './subdivision-mesh.js';
import { createZeroHeightTexture } from '../height-brush.js';
import { MSAA_SAMPLE_COUNT } from '../frame-context.js';

// ─── WGSL Shader ───

export const GLOBE_RASTER_SHADER_SOURCE = /* wgsl */ `

// ─── Constants ───

const PI: f32 = 3.14159265358979323846;
const TWO_PI: f32 = 6.28318530717958647692;
const EARTH_RADIUS_METERS: f32 = 6378137.0;

// ─── Bindings ───

struct GlobeCameraUniforms {
  // View-Projection matrix (column-major 4x4) — globe (unit sphere)
  viewProjection: mat4x4<f32>,
  // Flat Mercator VP matrix (column-major 4x4) — Mercator [0..1] ortho
  flatViewProjection: mat4x4<f32>,
  // Viewport dimensions
  viewport: vec2<f32>,
  // Projection transition: 0 = Mercator flat, 1 = globe sphere
  projectionTransition: f32,
  // Globe radius (unit sphere = 1.0)
  globeRadius: f32,
  // Clipping plane for horizon occlusion: Ax + By + Cz + D
  clippingPlane: vec4<f32>,
};

struct TileUniforms {
  // Tile Mercator extent: minX, minY, maxX, maxY (0..1 range)
  mercatorExtent: vec4<f32>,
  // Tile opacity
  opacity: f32,
  // Height exaggeration factor
  heightExaggeration: f32,
  // Height mode: 0 = world-space debug brush, 1 = tile-local terrain
  heightMode: f32,
  // Depth bias: fallback parent tiles pushed back to prevent z-fighting
  depthBias: f32,
  // Tile UV remap into terrain texture UV: [offsetX, offsetY, scaleX, scaleY]
  terrainUv: vec4<f32>,
  // Terrain lighting controls: [ambient, diffuse, shadowStrength, shadowSoftness]
  lightParams: vec4<f32>,
  // Sun controls: [azimuthDeg, altitudeDeg, enabled(0|1), _pad]
  sunParams: vec4<f32>,
  // Post-process filters: [brightness, contrast, saturate, _pad]
  filters: vec4<f32>,
};

@group(0) @binding(0) var<uniform> camera: GlobeCameraUniforms;
@group(1) @binding(0) var<uniform> tile: TileUniforms;
@group(1) @binding(1) var tileSampler: sampler;
@group(1) @binding(2) var tileTexture: texture_2d<f32>;
@group(2) @binding(0) var heightMap: texture_2d<f32>;
@group(2) @binding(1) var heightSampler: sampler;

// ─── Manual bilinear height sampling ───
// r32float doesn't support filtering sampler without float32-filterable feature.
// We use textureLoad + manual bilinear to get smooth interpolation.

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

fn terrainUvForTileUv(tileUv: vec2<f32>) -> vec2<f32> {
  return tile.terrainUv.xy + tileUv * tile.terrainUv.zw;
}

fn heightUvForTileUv(tileUv: vec2<f32>, mercUv: vec2<f32>) -> vec2<f32> {
  if (tile.heightMode >= 0.5) {
    return terrainUvForTileUv(tileUv);
  }
  return mercUv;
}

fn heightToWorldUnit(heightValue: f32) -> f32 {
  var hUnit = heightValue;
  if (tile.heightMode >= 0.5) {
    hUnit = heightValue / EARTH_RADIUS_METERS;
  }
  return hUnit * tile.heightExaggeration;
}

fn sunDirection(azimuthDeg: f32, altitudeDeg: f32) -> vec3<f32> {
  let az = azimuthDeg * PI / 180.0;
  let alt = altitudeDeg * PI / 180.0;
  let cosAlt = cos(alt);
  return normalize(vec3<f32>(
    sin(az) * cosAlt,  // east
    cos(az) * cosAlt,  // north
    sin(alt),          // up
  ));
}

// ─── Vertex ───

struct VertexInput {
  @location(0) uv: vec2<f32>,  // Grid UV (0..1)
  @location(1) skirt: f32,      // 0 = surface vertex, 1 = skirt vertex
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) texCoord: vec2<f32>,
  @location(1) clipDot: f32,  // For fragment discard (horizon)
};

// Mercator (0..1) → Angular (radians)
fn mercatorToAngular(merc: vec2<f32>) -> vec2<f32> {
  let lon = merc.x * TWO_PI - PI;
  let lat = atan(exp(PI - merc.y * TWO_PI)) * 2.0 - PI * 0.5;
  return vec2<f32>(lon, lat);
}

// Angular (radians) → Unit Sphere (3D)
fn angularToSphere(lon: f32, lat: f32) -> vec3<f32> {
  let cosLat = cos(lat);
  return vec3<f32>(
    cosLat * sin(lon),
    sin(lat),
    cosLat * cos(lon),
  );
}

// MapLibre custom Z: geometry-aware depth from clipping plane
// Replaces perspective Z — handles horizon occlusion + depth in one step
fn globeClippingZ(spherePos: vec3<f32>) -> f32 {
  return 1.0 - (dot(spherePos, camera.clippingPlane.xyz) + camera.clippingPlane.w);
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  // Map grid UV to tile Mercator coordinates
  let mercX = mix(tile.mercatorExtent.x, tile.mercatorExtent.z, input.uv.x);
  let mercY = mix(tile.mercatorExtent.y, tile.mercatorExtent.w, input.uv.y);

  // ─── Globe path: Mercator → Angular → Sphere → globe clip space ───
  let angular = mercatorToAngular(vec2<f32>(mercX, mercY));
  let sphereBase = angularToSphere(angular.x, angular.y);

  // Height sampling: world-space brush (mode=0) or tile-local terrain (mode=1).
  var h = 0.0;
  if (tile.heightMode >= 0.5) {
    h = sampleHeight(terrainUvForTileUv(input.uv));
  } else {
    h = sampleHeight(vec2<f32>(mercX, mercY));
  }
  var displacement = heightToWorldUnit(h);

  // Skirts hide tile cracks when adjacent tiles have different sampled heights.
  if (tile.heightMode >= 0.5 && input.skirt >= 0.5) {
    let skirtDepth = max(0.0015, abs(displacement) * 0.35 + 0.0006);
    displacement -= skirtDepth;
  }
  let spherePos = sphereBase * (1.0 + displacement);

  var globeClip = camera.viewProjection * vec4<f32>(spherePos, 1.0);
  // Replace globe Z with horizon-aware depth (use base for stable clipping)
  globeClip.z = globeClippingZ(sphereBase) * globeClip.w;

  // ─── Blend clip-space positions ───
  let clipDot = dot(sphereBase, camera.clippingPlane.xyz) + camera.clippingPlane.w;

  // Shader-level depth offset: tiles render in front of pole caps.
  // depthBias > 0 for fallback parent tiles, 0 for exact tiles — prevents z-fighting.
  const LAYER_DEPTH_OFFSET: f32 = 0.0001;
  var clipPos: vec4<f32>;
  if (camera.projectionTransition >= 0.999) {
    clipPos = globeClip;
  } else if (camera.projectionTransition <= 0.001) {
    var flatClip = camera.flatViewProjection * vec4<f32>(mercX, mercY, displacement, 1.0);
    clipPos = flatClip;
  } else {
    var flatClip = camera.flatViewProjection * vec4<f32>(mercX, mercY, displacement, 1.0);
    clipPos = mix(flatClip, globeClip, camera.projectionTransition);
  }
  clipPos.z -= LAYER_DEPTH_OFFSET * clipPos.w;
  clipPos.z += tile.depthBias * clipPos.w;
  clipPos.z = min(clipPos.z, clipPos.w * 0.9999);

  var out: VertexOutput;
  out.position = clipPos;
  out.texCoord = vec2<f32>(input.uv.x, input.uv.y);
  out.clipDot = clipDot;
  return out;
}

// ─── Fragment ───

fn applyFilters(c: vec3<f32>) -> vec3<f32> {
  var rgb = c * tile.filters.x;
  rgb = (rgb - 0.5) * tile.filters.y + 0.5;
  let gray = dot(rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
  return mix(vec3<f32>(gray), rgb, tile.filters.z);
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // Discard back-hemisphere fragments for clean horizon edge
  if (camera.projectionTransition > 0.01 && input.clipDot < -0.01) {
    discard;
  }

  var color = textureSample(tileTexture, tileSampler, input.texCoord);
  if (tile.sunParams.z < 0.5) {
    var rgb = applyFilters(color.rgb);
    return vec4<f32>(rgb, color.a * tile.opacity);
  }

  let mercX = mix(tile.mercatorExtent.x, tile.mercatorExtent.z, input.texCoord.x);
  let mercY = mix(tile.mercatorExtent.y, tile.mercatorExtent.w, input.texCoord.y);
  let mercUv = vec2<f32>(mercX, mercY);
  let heightUv = heightUvForTileUv(input.texCoord, mercUv);

  let dims = vec2<f32>(textureDimensions(heightMap, 0));
  let texel = vec2<f32>(1.0) / max(dims, vec2<f32>(1.0));
  let stepX = vec2<f32>(texel.x, 0.0);
  let stepY = vec2<f32>(0.0, texel.y);

  let hW = heightToWorldUnit(sampleHeight(heightUv - stepX));
  let hE = heightToWorldUnit(sampleHeight(heightUv + stepX));
  let hN = heightToWorldUnit(sampleHeight(heightUv - stepY));
  let hS = heightToWorldUnit(sampleHeight(heightUv + stepY));

  let dhdx = (hE - hW) / max(1e-6, 2.0 * texel.x);
  let dhdy = (hN - hS) / max(1e-6, 2.0 * texel.y);

  let angular = mercatorToAngular(mercUv);
  let up = normalize(angularToSphere(angular.x, angular.y));
  let refDir = select(vec3<f32>(0.0, 0.0, 1.0), vec3<f32>(1.0, 0.0, 0.0), abs(up.z) > 0.99);
  let east = normalize(cross(refDir, up));
  let north = normalize(cross(up, east));
  let normal = normalize(up - east * dhdx - north * dhdy);

  let lightDir = sunDirection(tile.sunParams.x, tile.sunParams.y);
  let ambient = clamp(tile.lightParams.x, 0.0, 1.0);
  let diffuse = clamp(tile.lightParams.y, 0.0, 2.0);
  let ndotl = max(dot(normal, lightDir), 0.0);
  var lightTerm = ambient + diffuse * ndotl;

  // Pseudo-shadow: compare height toward sun direction in local tangent frame.
  var lightUvDir = vec2<f32>(dot(lightDir, east), -dot(lightDir, north));
  let dirLen = max(length(lightUvDir), 1e-6);
  lightUvDir = lightUvDir / dirLen;

  let softness = clamp(tile.lightParams.w, 0.0, 1.0);
  let sampleDist = mix(1.5, 7.0, softness);
  let shadowStep = vec2<f32>(lightUvDir.x * texel.x, lightUvDir.y * texel.y) * sampleDist;

  let hCenter = heightToWorldUnit(sampleHeight(heightUv));
  let hTowardSun = heightToWorldUnit(sampleHeight(heightUv + shadowStep));
  let rise = max(0.0, hTowardSun - hCenter);

  let sunAltRad = tile.sunParams.y * PI / 180.0;
  let altitudeFactor = max(0.15, sin(sunAltRad));
  let riseScale = select(800.0, 22000.0, tile.heightMode >= 0.5);
  let occlusion = clamp(rise * riseScale / altitudeFactor, 0.0, 1.0);
  // Disable pseudo-shadow when view is strongly globe-like (zoomed out).
  // Shadows fade in only as we transition toward the flatter close-zoom view.
  let transitionToFlat = clamp(1.0 - camera.projectionTransition, 0.0, 1.0);
  let zoomShadowFade = smoothstep(0.08, 0.32, transitionToFlat);
  let shadowStrength = clamp(tile.lightParams.z, 0.0, 1.0) * zoomShadowFade;
  let pseudoShadow = 1.0 - occlusion * shadowStrength;
  lightTerm *= pseudoShadow;

  let litRgb = color.rgb * clamp(lightTerm, 0.0, 2.0);
  var finalRgb = applyFilters(litRgb);
  return vec4<f32>(finalRgb, color.a * tile.opacity);
}
`;

// ─── Bind Group Layouts ───

/**
 * Globe camera bind group layout (group 0).
 * Extended with projectionTransition, globeRadius, clippingPlane.
 */
export function createGlobeCameraBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'globe-camera-bind-group-layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
    ],
  });
}

/**
 * Globe tile bind group layout (group 1).
 * Same as raster: uniform + sampler + texture.
 */
export function createGlobeTileBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'globe-tile-bind-group-layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: 'filtering' },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'float' },
      },
    ],
  });
}

/**
 * Height texture bind group layout (group 2).
 * R32Float heightmap texture + sampler for terrain displacement.
 */
function createHeightBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'globe-raster-height-layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'unfilterable-float' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        sampler: { type: 'non-filtering' },
      },
    ],
  });
}

// ─── Pipeline ───

export interface GlobeRasterPipelineDescriptor {
  device: GPUDevice;
  colorFormat: GPUTextureFormat;
  depthFormat?: GPUTextureFormat;
  depthCompare?: GPUCompareFunction;
  subdivisions?: number;
  sampleCount?: number;
}

export interface GlobeRasterPipeline {
  pipeline: GPURenderPipeline;
  globeCameraBindGroupLayout: GPUBindGroupLayout;
  globeTileBindGroupLayout: GPUBindGroupLayout;
  heightBindGroupLayout: GPUBindGroupLayout;
  sampler: GPUSampler;
  heightSampler: GPUSampler;
  subdivisionMesh: SubdivisionMesh;
  zeroHeightTexture: GPUTexture;
  zeroHeightBindGroup: GPUBindGroup;
}

/**
 * Globe raster pipeline oluştur.
 * Subdivision mesh + WGSL shader + WebGPU pipeline.
 */
export function createGlobeRasterPipeline(
  desc: GlobeRasterPipelineDescriptor,
): GlobeRasterPipeline {
  const { device, colorFormat } = desc;
  const subdivisions = desc.subdivisions ?? 32;

  const globeCameraBindGroupLayout = createGlobeCameraBindGroupLayout(device);
  const globeTileBindGroupLayout = createGlobeTileBindGroupLayout(device);
  const heightBindGroupLayout = createHeightBindGroupLayout(device);

  const shaderModule = device.createShaderModule({
    label: 'globe-raster-shader',
    code: GLOBE_RASTER_SHADER_SOURCE,
  });

  const pipelineLayout = device.createPipelineLayout({
    label: 'globe-raster-pipeline-layout',
    bindGroupLayouts: [globeCameraBindGroupLayout, globeTileBindGroupLayout, heightBindGroupLayout],
  });

  const subdivisionMesh = createSubdivisionMeshWithSkirts(device, subdivisions);

  const pipeline = device.createRenderPipeline({
    label: 'globe-raster-pipeline',
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
      buffers: [
        {
          // vec3<f32> = uv.xy + skirtFlag
          arrayStride: 12,
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: 'float32x2',
            },
            {
              shaderLocation: 1,
              offset: 8,
              format: 'float32',
            },
          ],
        },
      ],
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs_main',
      targets: [
        {
          format: colorFormat,
          blend: {
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
          },
        },
      ],
    },
    primitive: {
      topology: 'triangle-list',
      cullMode: 'none', // Disabled until winding order is verified
    },
    depthStencil: {
      format: (desc.depthFormat ?? 'depth24plus') as GPUTextureFormat,
      depthWriteEnabled: true,
      depthCompare: desc.depthCompare ?? 'less',
    },
    multisample: {
      count: desc.sampleCount ?? MSAA_SAMPLE_COUNT,
    },
  });

  const sampler = device.createSampler({
    label: 'globe-tile-sampler',
    magFilter: 'linear',
    minFilter: 'linear',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
  });

  const heightSampler = device.createSampler({
    label: 'globe-height-sampler',
    magFilter: 'nearest',
    minFilter: 'nearest',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
  });

  // Zero-height texture for tiles without terrain data (1×1 r32float = 0)
  const { texture: zeroHeightTexture, bindGroup: zeroHeightBindGroup } =
    createZeroHeightTexture(device, heightBindGroupLayout);

  return {
    pipeline,
    globeCameraBindGroupLayout,
    globeTileBindGroupLayout,
    heightBindGroupLayout,
    sampler,
    heightSampler,
    subdivisionMesh,
    zeroHeightTexture,
    zeroHeightBindGroup,
  };
}

function createSubdivisionMeshWithSkirts(
  device: GPUDevice,
  subdivisions = 32,
): SubdivisionMesh {
  const gridSize = subdivisions + 1;
  const baseVertexCount = gridSize * gridSize;

  // Vertex format: [u, v, skirtFlag]
  const vertices: number[] = [];
  const baseIndex = new Uint32Array(baseVertexCount);

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const idx = vertices.length / 3;
      baseIndex[y * gridSize + x] = idx;
      vertices.push(x / subdivisions, y / subdivisions, 0);
    }
  }

  const indices: number[] = [];

  // Surface triangles
  for (let y = 0; y < subdivisions; y++) {
    for (let x = 0; x < subdivisions; x++) {
      const tl = baseIndex[y * gridSize + x]!;
      const tr = baseIndex[y * gridSize + x + 1]!;
      const bl = baseIndex[(y + 1) * gridSize + x]!;
      const br = baseIndex[(y + 1) * gridSize + x + 1]!;

      indices.push(tl, bl, tr);
      indices.push(tr, bl, br);
    }
  }

  const addSkirtVertex = (u: number, v: number): number => {
    const idx = vertices.length / 3;
    vertices.push(u, v, 1);
    return idx;
  };

  const topSkirt = new Uint32Array(gridSize);
  const rightSkirt = new Uint32Array(gridSize);
  const bottomSkirt = new Uint32Array(gridSize);
  const leftSkirt = new Uint32Array(gridSize);

  for (let i = 0; i < gridSize; i++) {
    const t = i / subdivisions;
    topSkirt[i] = addSkirtVertex(t, 0);
    rightSkirt[i] = addSkirtVertex(1, t);
    bottomSkirt[i] = addSkirtVertex(t, 1);
    leftSkirt[i] = addSkirtVertex(0, t);
  }

  const addSkirtStrip = (
    b0: number,
    b1: number,
    s0: number,
    s1: number,
  ): void => {
    indices.push(b0, s0, b1);
    indices.push(b1, s0, s1);
  };

  // Top
  for (let i = 0; i < subdivisions; i++) {
    addSkirtStrip(
      baseIndex[i]!,
      baseIndex[i + 1]!,
      topSkirt[i]!,
      topSkirt[i + 1]!,
    );
  }
  // Right
  for (let i = 0; i < subdivisions; i++) {
    addSkirtStrip(
      baseIndex[i * gridSize + subdivisions]!,
      baseIndex[(i + 1) * gridSize + subdivisions]!,
      rightSkirt[i]!,
      rightSkirt[i + 1]!,
    );
  }
  // Bottom
  for (let i = 0; i < subdivisions; i++) {
    addSkirtStrip(
      baseIndex[subdivisions * gridSize + i]!,
      baseIndex[subdivisions * gridSize + i + 1]!,
      bottomSkirt[i]!,
      bottomSkirt[i + 1]!,
    );
  }
  // Left
  for (let i = 0; i < subdivisions; i++) {
    addSkirtStrip(
      baseIndex[i * gridSize]!,
      baseIndex[(i + 1) * gridSize]!,
      leftSkirt[i]!,
      leftSkirt[i + 1]!,
    );
  }

  const vertexArray = new Float32Array(vertices);
  const vertexCount = vertexArray.length / 3;
  const useUint32 = vertexCount > 65535;
  const indexArray = useUint32 ? new Uint32Array(indices) : new Uint16Array(indices);

  const vertexBuffer = device.createBuffer({
    label: 'globe-subdivision-vertex-buffer',
    size: vertexArray.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertexArray);

  const indexBuffer = device.createBuffer({
    label: 'globe-subdivision-index-buffer',
    size: indexArray.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(indexBuffer, 0, indexArray);

  return {
    vertexBuffer,
    indexBuffer,
    indexCount: indexArray.length,
    vertexCount,
    subdivisions,
  };
}
