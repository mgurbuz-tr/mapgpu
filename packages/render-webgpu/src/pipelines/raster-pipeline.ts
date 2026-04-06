/**
 * Raster Imagery Pipeline
 *
 * Basit bir raster tile çizim pipeline'ı.
 * Vertex shader: quad (4 vertex) → tile extent'e map
 * Fragment shader: texture sample * opacity
 */

import { MSAA_SAMPLE_COUNT } from '../frame-context.js';

// ─── WGSL Shader ───

export const RASTER_SHADER_SOURCE = /* wgsl */ `

// ─── Bindings ───

struct CameraUniforms {
  viewProjection: mat4x4<f32>,
};

struct TileUniforms {
  // Tile extent: minX, minY, maxX, maxY
  extent: vec4<f32>,
  // Opacity (0..1)
  opacity: f32,
  // Post-process filters (default 1.0 = no change)
  brightness: f32,
  contrast: f32,
  saturate: f32,
};

@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(1) @binding(0) var<uniform> tile: TileUniforms;
@group(1) @binding(1) var tileSampler: sampler;
@group(1) @binding(2) var tileTexture: texture_2d<f32>;

// ─── Vertex ───

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

// Full-screen quad: 4 vertex, 2 triangle (triangle-strip)
// vertex_index 0..3 → quad corners
@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VertexOutput {
  // Quad corners: BL, BR, TL, TR
  var positions = array<vec2<f32>, 4>(
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 1.0),
  );

  let uv = positions[vid];

  // RTE (Relative-to-Eye): tile extent is camera-relative (CPU subtracted center
  // in f64).  Using w=0 treats the position as a direction vector so that
  // viewProjection applies rotation + scale but NOT the camera translation
  // (which is already baked into the relative coordinates).  Adding (0,0,0,1)
  // restores the homogeneous point.  This keeps full f32 precision at any zoom.
  let relX = mix(tile.extent.x, tile.extent.z, uv.x);
  let relY = mix(tile.extent.y, tile.extent.w, uv.y);
  let clipOffset = camera.viewProjection * vec4<f32>(relX, relY, 0.0, 0.0);

  var out: VertexOutput;
  out.position = clipOffset + vec4<f32>(0.0, 0.0, 0.0, 1.0);
  // Flip UV Y: texture (0,0) = top-left (north), but world minY = south
  out.uv = vec2<f32>(uv.x, 1.0 - uv.y);
  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  var color = textureSample(tileTexture, tileSampler, input.uv);
  // Brightness
  var rgb = color.rgb * tile.brightness;
  // Contrast: (c - 0.5) * contrast + 0.5
  rgb = (rgb - 0.5) * tile.contrast + 0.5;
  // Saturation: mix grayscale ↔ color
  let gray = dot(rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
  rgb = mix(vec3<f32>(gray), rgb, tile.saturate);
  return vec4<f32>(rgb, color.a * tile.opacity);
}
`;

// ─── Bind Group Layouts ───

/**
 * Camera bind group layout (group 0): shared across all pipelines.
 */
export function createCameraBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'camera-bind-group-layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'uniform' },
      },
    ],
  });
}

/**
 * Raster tile bind group layout (group 1).
 */
export function createRasterBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'raster-tile-bind-group-layout',
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

// ─── Pipeline ───

export interface RasterPipelineDescriptor {
  device: GPUDevice;
  colorFormat: GPUTextureFormat;
  cameraBindGroupLayout: GPUBindGroupLayout;
  depthFormat?: GPUTextureFormat;
  sampleCount?: number;
}

export interface RasterPipeline {
  pipeline: GPURenderPipeline;
  rasterBindGroupLayout: GPUBindGroupLayout;
  sampler: GPUSampler;
}

/**
 * Raster imagery render pipeline oluştur.
 */
export function createRasterPipeline(desc: RasterPipelineDescriptor): RasterPipeline {
  const { device, colorFormat, cameraBindGroupLayout } = desc;

  const rasterBindGroupLayout = createRasterBindGroupLayout(device);

  const shaderModule = device.createShaderModule({
    label: 'raster-shader',
    code: RASTER_SHADER_SOURCE,
  });

  const pipelineLayout = device.createPipelineLayout({
    label: 'raster-pipeline-layout',
    bindGroupLayouts: [cameraBindGroupLayout, rasterBindGroupLayout],
  });

  const pipeline = device.createRenderPipeline({
    label: 'raster-pipeline',
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
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
      topology: 'triangle-strip',
      stripIndexFormat: undefined,
    },
    depthStencil: {
      format: desc.depthFormat ?? 'depth24plus',
      depthWriteEnabled: false,
      depthCompare: 'always', // Raster always renders regardless of depth
    },
    multisample: {
      count: desc.sampleCount ?? MSAA_SAMPLE_COUNT,
    },
  });

  const sampler = device.createSampler({
    label: 'raster-tile-sampler',
    magFilter: 'linear',
    minFilter: 'linear',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
  });

  return { pipeline, rasterBindGroupLayout, sampler };
}
