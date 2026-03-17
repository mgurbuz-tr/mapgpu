/**
 * Globe Point Pipeline
 *
 * WGSL shader: EPSG:3857 position → Mercator [0..1] → Angular → Unit Sphere.
 * Billboard quad per point with SDF circle/square.
 * GlobeCameraUniforms (160 byte) ile dual projection + horizon occlusion.
 */

import { WGSL_GLOBE_PREAMBLE } from './wgsl-preambles.js';
import { MSAA_SAMPLE_COUNT } from '../frame-context.js';

// ─── WGSL Shader ───

export const GLOBE_POINT_SHADER_SOURCE = /* wgsl */ `

// ─── Constants ───
${WGSL_GLOBE_PREAMBLE}
const EARTH_RADIUS_M: f32 = 6371000.0;
const ALTITUDE_EXAG: f32 = 5.0;

// ─── Bindings ───

struct PointMaterial {
  color: vec4<f32>,
  outlineColor: vec4<f32>,
  size: f32,
  outlineWidth: f32,
  // 0 = circle, 1 = square
  shape: f32,
  _pad: f32,
};

@group(1) @binding(0) var<uniform> material: PointMaterial;

// ─── Helpers ───

fn altitudeOffset(altMeters: f32) -> f32 {
  return altMeters / EARTH_RADIUS_M * ALTITUDE_EXAG;
}

// ─── Vertex ───

struct VertexInput {
  @location(0) position: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) clipDot: f32,
};

@vertex
fn vs_main(
  input: VertexInput,
  @builtin(vertex_index) vid: u32,
) -> VertexOutput {
  var quadOffsets = array<vec2<f32>, 6>(
    vec2<f32>(-0.5, -0.5),
    vec2<f32>( 0.5, -0.5),
    vec2<f32>(-0.5,  0.5),
    vec2<f32>(-0.5,  0.5),
    vec2<f32>( 0.5, -0.5),
    vec2<f32>( 0.5,  0.5),
  );

  let offset = quadOffsets[vid];
  let uv = offset + vec2<f32>(0.5, 0.5);

  // EPSG:3857 → Mercator [0..1] → Angular → Sphere
  let merc01 = epsg3857ToMerc01(input.position);
  let angular = mercatorToAngular(merc01);
  let baseSphere = angularToSphere(angular.x, angular.y);
  let altFrac = altitudeOffset(input.position.z);
  let spherePos = baseSphere * (1.0 + altFrac);

  // Globe clip space
  var globeClip = camera.viewProjection * vec4<f32>(spherePos, 1.0);
  globeClip.z = globeClippingZ(baseSphere) * globeClip.w;

  var clipCenter: vec4<f32>;
  if (camera.projectionTransition >= 0.999) {
    clipCenter = globeClip;
  } else if (camera.projectionTransition <= 0.001) {
    clipCenter = camera.flatViewProjection * vec4<f32>(merc01.x, merc01.y, altFrac, 1.0);
  } else {
    let flatClip = camera.flatViewProjection * vec4<f32>(merc01.x, merc01.y, altFrac, 1.0);
    clipCenter = mix(flatClip, globeClip, camera.projectionTransition);
  }
  let clipDot = dot(spherePos, camera.clippingPlane.xyz) + camera.clippingPlane.w;

  // Billboard offset in screen space
  let pixelSize = material.size + material.outlineWidth * 2.0;
  let screenOffset = offset * pixelSize;
  let ndcOffset = vec2<f32>(
    screenOffset.x * 2.0 / camera.viewport.x,
    screenOffset.y * 2.0 / camera.viewport.y,
  );

  // Shader-level depth offset: points render in front of lines
  const LAYER_DEPTH_OFFSET: f32 = 0.0008;
  let adjustedZ = clipCenter.z - LAYER_DEPTH_OFFSET * clipCenter.w;
  let clampedZ = min(adjustedZ, clipCenter.w * 0.9999);
  var out: VertexOutput;
  out.clipPosition = vec4<f32>(
    clipCenter.x + ndcOffset.x * clipCenter.w,
    clipCenter.y + ndcOffset.y * clipCenter.w,
    clampedZ,
    clipCenter.w,
  );
  out.uv = uv;
  out.clipDot = clipDot;
  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // Horizon discard
  if (camera.projectionTransition > 0.01 && input.clipDot < -0.01) {
    discard;
  }

  let centered = input.uv - vec2<f32>(0.5, 0.5);
  let totalRadius = 0.5;
  let outlineFraction = material.outlineWidth / (material.size + material.outlineWidth * 2.0);
  let innerRadius = totalRadius - outlineFraction;

  let dist = length(centered);
  let aa = fwidth(dist);
  let squareDist = max(abs(centered.x), abs(centered.y));

  if (material.shape < 0.5) {
    // Circle SDF
    if (dist > totalRadius) {
      discard;
    }
    let alpha = 1.0 - smoothstep(innerRadius - aa, innerRadius, dist);
    return mix(material.outlineColor, material.color, alpha);
  } else {
    // Square SDF
    if (squareDist > totalRadius) {
      discard;
    }
    if (squareDist > innerRadius) {
      return material.outlineColor;
    }
    return material.color;
  }
}
`;

// ─── Bind Group Layout ───

export function createGlobePointBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'globe-point-material-bind-group-layout',
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

export interface GlobePointPipelineDescriptor {
  device: GPUDevice;
  colorFormat: GPUTextureFormat;
  globeCameraBindGroupLayout: GPUBindGroupLayout;
  depthFormat?: GPUTextureFormat;
  depthCompare?: GPUCompareFunction;
  sampleCount?: number;
}

export interface GlobePointPipeline {
  pipeline: GPURenderPipeline;
  materialBindGroupLayout: GPUBindGroupLayout;
}

export function createGlobePointPipeline(
  desc: GlobePointPipelineDescriptor,
): GlobePointPipeline {
  const { device, colorFormat, globeCameraBindGroupLayout } = desc;

  const materialBindGroupLayout = createGlobePointBindGroupLayout(device);

  const shaderModule = device.createShaderModule({
    label: 'globe-point-shader',
    code: GLOBE_POINT_SHADER_SOURCE,
  });

  const pipelineLayout = device.createPipelineLayout({
    label: 'globe-point-pipeline-layout',
    bindGroupLayouts: [globeCameraBindGroupLayout, materialBindGroupLayout],
  });

  const pipeline = device.createRenderPipeline({
    label: 'globe-point-pipeline',
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
      buffers: [
        {
          arrayStride: 12, // vec3<f32>
          stepMode: 'instance',
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: 'float32x3',
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

  return { pipeline, materialBindGroupLayout };
}
