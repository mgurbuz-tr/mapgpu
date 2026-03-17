/**
 * Extrusion Pipeline — 2D fill-extrusion (3D buildings)
 *
 * Renders extruded polygon geometry with Blinn-Phong directional lighting.
 * Uses rotation-aware oblique projection to create visible 2.5D buildings
 * from the top-down orthographic camera — the oblique offset direction
 * rotates with the camera bearing so buildings lean consistently on screen.
 *
 * Vertex layout: [position: vec3<f32>, normal: vec3<f32>, centroid: vec2<f32>] — stride 32 bytes.
 * Material uniform: 64 bytes (16 floats) — see ExtrusionMaterial struct.
 */

import { WGSL_CAMERA_UNIFORMS } from './wgsl-preambles.js';
import { MSAA_SAMPLE_COUNT } from '../frame-context.js';

// ─── WGSL Shader ───

export const EXTRUSION_SHADER_SOURCE = /* wgsl */ `

// ─── Bindings ───
${WGSL_CAMERA_UNIFORMS}
const ROOF_DEPTH_BIAS: f32 = 1e-4;
const WALL_DEPTH_BIAS: f32 = 2e-5;

struct ExtrusionMaterial {
  color: vec4<f32>,
  ambient: f32,
  debugMode: f32,
  animProgress: f32,
  animDuration: f32,
  waveOrigin: vec2<f32>,
  delayFactor: f32,
  bearing: f32,
  shininess: f32,
  specularStrength: f32,
  _pad1: f32,
  _pad2: f32,
};

@group(1) @binding(0) var<uniform> material: ExtrusionMaterial;

fn easeOutCubic(t: f32) -> f32 {
  let inv = 1.0 - t;
  return 1.0 - inv * inv * inv;
}

// ─── Vertex ───

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) centroid: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) vNormal: vec3<f32>,
  @location(1) debugData: vec3<f32>,
  @location(2) worldPos: vec3<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.debugData = vec3<f32>(0.0, 0.0, 0.0);

  // XY comes in Mercator [0..1], convert back to EPSG:3857 for 2D camera
  let HALF_CIRCUMFERENCE: f32 = 20037508.34;
  let epsg = vec2<f32>(
    input.position.x * 2.0 * HALF_CIRCUMFERENCE - HALF_CIRCUMFERENCE,
    (1.0 - input.position.y) * 2.0 * HALF_CIRCUMFERENCE - HALF_CIRCUMFERENCE
  );

  // Oblique offset in EPSG:3857: shift roof by height to create 2.5D appearance.
  // Direction rotates with camera bearing so buildings lean consistently on screen.
  var h = input.position.z;

  // Grow animation: scale height by eased progress
  if (material.animDuration > 0.0) {
    let dist = distance(input.centroid, material.waveOrigin);
    let delay = dist * material.delayFactor;
    let rawT = clamp((material.animProgress - delay) / material.animDuration, 0.0, 1.0);
    let progress = easeOutCubic(rawT);
    h = h * progress;
  }

  // Rotation-aware oblique: offset direction follows camera bearing
  let obliqueMag: f32 = 0.5;
  let offsetDir = vec2<f32>(-sin(material.bearing), cos(material.bearing));
  let obliquePos = vec3<f32>(
    epsg.x + h * offsetDir.x * obliqueMag,
    epsg.y + h * offsetDir.y * obliqueMag,
    h,
  );

  out.clipPosition = camera.viewProjection * vec4<f32>(obliquePos, 1.0);
  out.worldPos = obliquePos;

  // Logarithmic depth remap: better distribution across height range.
  // Maps [0..1000+m] → [0.5..0.01] with log2 distribution so both
  // low (1-5m) and tall (500m+) buildings have adequate depth separation.
  let logH = log2(max(h, 0.1) + 1.0);
  let logMax = log2(1001.0);
  let normalizedZ = clamp(0.5 - logH / (2.0 * logMax), 0.01, 0.99);
  out.clipPosition.z = normalizedZ * out.clipPosition.w;

  // Roof triangles share their top edge positions with wall quads.
  // Bias them slightly toward the camera to avoid wall-vs-roof depth acne.
  if (input.normal.z > 0.5) {
    out.clipPosition.z -= ROOF_DEPTH_BIAS * out.clipPosition.w;
  }

  // Shared building edges can still generate coplanar wall depth ties.
  // Split ties deterministically by wall normal orientation.
  if (abs(input.normal.z) < 0.5) {
    let wallDot = input.normal.x * 0.70710677 + input.normal.y * 0.70710677;
    let wallDir = select(-1.0, 1.0, wallDot >= 0.0);
    out.clipPosition.z -= wallDir * WALL_DEPTH_BIAS * out.clipPosition.w;
  }

  // Debug data: normalizedZ, height in km, face type (0=wall, 0.5=floor, 1=roof)
  let faceType2d = select(0.0, select(0.5, 1.0, input.normal.z > 0.5), abs(input.normal.z) > 0.1);
  out.debugData = vec3<f32>(normalizedZ, h * 0.001, faceType2d);

  out.vNormal = input.normal;
  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // Debug mode: visualize depth / height / face type as color
  if (material.debugMode > 0.5) {
    let depth = input.debugData.x;
    let faceType = input.debugData.z;
    // Depth gradient: green(far) → yellow → red(near camera)
    let t = clamp(1.0 - depth, 0.0, 1.0);
    var c = mix(vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(1.0, 1.0, 0.0), clamp(t * 2.0, 0.0, 1.0));
    c = mix(c, vec3<f32>(1.0, 0.0, 0.0), clamp(t * 2.0 - 1.0, 0.0, 1.0));
    if (faceType > 0.75) { c = mix(c, vec3<f32>(0.3, 0.3, 1.0), 0.4); }
    if (faceType > 0.25 && faceType < 0.75) { c = mix(c, vec3<f32>(0.8, 0.2, 0.8), 0.4); }
    return vec4<f32>(c, 0.9);
  }

  // Blinn-Phong directional lighting
  let lightDir = normalize(vec3<f32>(0.3, -0.5, 0.8));
  let normal = normalize(input.vNormal);
  let NdotL = max(dot(normal, lightDir), 0.0);

  // View direction: from above, rotated with camera bearing for consistent specular
  let viewDir = normalize(vec3<f32>(-sin(material.bearing), cos(material.bearing), 1.5));
  let halfDir = normalize(lightDir + viewDir);
  let NdotH = max(dot(normal, halfDir), 0.0);
  let specular = pow(NdotH, material.shininess) * material.specularStrength;

  let diffuse = (1.0 - material.ambient) * NdotL;
  let lit = material.ambient + diffuse + specular;
  let color = material.color.rgb * min(lit, 1.0);

  // Premultiplied alpha output
  return vec4<f32>(color * material.color.a, material.color.a);
}
`;

// ─── Bind Group Layout ───

export function createExtrusionBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'extrusion-material-bind-group-layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
    ],
  });
}

// ─── Pipeline ───

export interface ExtrusionPipelineDescriptor {
  device: GPUDevice;
  colorFormat: GPUTextureFormat;
  cameraBindGroupLayout: GPUBindGroupLayout;
  depthFormat?: GPUTextureFormat;
  depthCompare?: GPUCompareFunction;
  sampleCount?: number;
}

export interface ExtrusionPipeline {
  pipeline: GPURenderPipeline;
  materialBindGroupLayout: GPUBindGroupLayout;
}

export function createExtrusionPipeline(desc: ExtrusionPipelineDescriptor): ExtrusionPipeline {
  const { device, colorFormat, cameraBindGroupLayout } = desc;

  const materialBindGroupLayout = createExtrusionBindGroupLayout(device);

  const shaderModule = device.createShaderModule({
    label: 'extrusion-shader',
    code: EXTRUSION_SHADER_SOURCE,
  });

  const pipelineLayout = device.createPipelineLayout({
    label: 'extrusion-pipeline-layout',
    bindGroupLayouts: [cameraBindGroupLayout, materialBindGroupLayout],
  });

  const pipeline = device.createRenderPipeline({
    label: 'extrusion-pipeline',
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
      buffers: [
        {
          arrayStride: 32, // 8 * 4 bytes (position + normal + centroid)
          stepMode: 'vertex',
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x3' },  // position
            { shaderLocation: 1, offset: 12, format: 'float32x3' }, // normal
            { shaderLocation: 2, offset: 24, format: 'float32x2' }, // centroid
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
          // Premultiplied alpha blending (matches canvas alphaMode: 'premultiplied')
          blend: {
            color: {
              srcFactor: 'one',
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
      // With rotation-aware oblique and back-face culling, walls facing
      // away from the camera are correctly culled for better performance.
      cullMode: 'back',
    },
    depthStencil: {
      format: desc.depthFormat ?? 'depth24plus',
      depthWriteEnabled: true,
      depthCompare: desc.depthCompare ?? 'less',
    },
    multisample: {
      count: desc.sampleCount ?? MSAA_SAMPLE_COUNT,
    },
  });

  return { pipeline, materialBindGroupLayout };
}
