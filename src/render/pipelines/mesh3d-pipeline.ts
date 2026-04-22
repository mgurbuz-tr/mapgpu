/**
 * Mesh3D Pipeline — 2D rendering of arbitrary 3D mesh geometry.
 *
 * Renders Box, Cylinder, Sphere, Cone as real 3D meshes with Blinn-Phong lighting.
 * Uses oblique 2.5D projection (same as extrusion pipeline) for visible height in 2D mode.
 *
 * Vertex layout: [position: vec3<f32>, normal: vec3<f32>] — stride 24 bytes.
 * Material uniform: 32 bytes — [color(16) + ambient(4) + shininess(4) + specularStrength(4) + pad(4)].
 */

import { WGSL_CAMERA_UNIFORMS } from './wgsl-preambles.js';
import { MSAA_SAMPLE_COUNT } from '../frame-context.js';

export const MESH3D_SHADER_SOURCE = /* wgsl */ `

${WGSL_CAMERA_UNIFORMS}

struct Mesh3DMaterial {
  color: vec4<f32>,         // RGBA 0-1 (premultiplied in fragment)
  ambient: f32,
  shininess: f32,
  specularStrength: f32,
  _pad: f32,
};

@group(1) @binding(0) var<uniform> material: Mesh3DMaterial;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) vNormal: vec3<f32>,
  @location(1) worldPos: vec3<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;

  // XY comes in Mercator [0..1], convert to EPSG:3857 for 2D camera
  let HALF: f32 = 20037508.34;
  let epsg = vec2<f32>(
    input.position.x * 2.0 * HALF - HALF,
    (1.0 - input.position.y) * 2.0 * HALF - HALF
  );

  // Height (metres) + oblique 2.5D offset for visible 3D effect in top-down view
  let h = input.position.z;
  let obliqueMag: f32 = 0.5;
  let worldPos = vec3<f32>(
    epsg.x + h * obliqueMag,
    epsg.y + h * obliqueMag,
    h,
  );

  out.clipPosition = camera.viewProjection * vec4<f32>(worldPos, 1.0);
  out.worldPos = worldPos;
  out.vNormal = input.normal;

  // Logarithmic depth remap — matches extrusion pipeline.
  let absH = abs(h);
  let logH = log2(max(absH, 0.1) + 1.0);
  let logMax = log2(1001.0);
  let normalizedZ = clamp(0.5 - logH / (2.0 * logMax), 0.01, 0.99);
  out.clipPosition.z = normalizedZ * out.clipPosition.w;

  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let N = normalize(in.vNormal);
  let L = normalize(vec3<f32>(0.3, 0.8, 0.5)); // fixed directional light
  let V = normalize(vec3<f32>(0.0, 0.0, 1.0)); // approximate view direction
  let H = normalize(L + V); // Blinn half-vector

  // Diffuse
  let diff = max(dot(N, L), 0.0);

  // Specular (Blinn-Phong)
  let spec = pow(max(dot(N, H), 0.0), material.shininess) * material.specularStrength;

  let lighting = material.ambient + diff * (1.0 - material.ambient) + spec;
  let baseColor = material.color.rgb * lighting;
  let alpha = material.color.a;

  // Premultiplied alpha output
  return vec4<f32>(baseColor * alpha, alpha);
}
`;

// ─── Bind Group Layout ───

export function createMesh3DBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'mesh3d-material-bind-group-layout',
    entries: [{
      binding: 0,
      visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
      buffer: { type: 'uniform' },
    }],
  });
}

// ─── Pipeline ───

export interface Mesh3DPipelineDescriptor {
  device: GPUDevice;
  colorFormat: GPUTextureFormat;
  cameraBindGroupLayout: GPUBindGroupLayout;
  depthFormat?: GPUTextureFormat;
  depthCompare?: GPUCompareFunction;
  depthWriteEnabled?: boolean;
  sampleCount?: number;
}

export interface Mesh3DPipeline {
  pipeline: GPURenderPipeline;
  materialBindGroupLayout: GPUBindGroupLayout;
}

export function createMesh3DPipeline(desc: Mesh3DPipelineDescriptor): Mesh3DPipeline {
  const { device, colorFormat, cameraBindGroupLayout } = desc;
  const materialBindGroupLayout = createMesh3DBindGroupLayout(device);

  const shaderModule = device.createShaderModule({
    label: 'mesh3d-shader',
    code: MESH3D_SHADER_SOURCE,
  });

  const pipeline = device.createRenderPipeline({
    label: 'mesh3d-pipeline',
    layout: device.createPipelineLayout({
      label: 'mesh3d-pipeline-layout',
      bindGroupLayouts: [cameraBindGroupLayout, materialBindGroupLayout],
    }),
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
      buffers: [{
        arrayStride: 24, // 6 × 4 bytes (position vec3 + normal vec3)
        stepMode: 'vertex',
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' },   // position
          { shaderLocation: 1, offset: 12, format: 'float32x3' },  // normal
        ],
      }],
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs_main',
      targets: [{
        format: colorFormat,
        blend: {
          color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
        },
      }],
    },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    depthStencil: {
      format: desc.depthFormat ?? 'depth32float',
      depthWriteEnabled: desc.depthWriteEnabled ?? true,
      depthCompare: desc.depthCompare ?? 'less',
    },
    multisample: { count: desc.sampleCount ?? MSAA_SAMPLE_COUNT },
  });

  return { pipeline, materialBindGroupLayout };
}
