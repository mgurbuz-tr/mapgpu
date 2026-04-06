/**
 * Globe Line Pipeline
 *
 * WGSL shader: EPSG:3857 → Mercator [0..1] → Angular → Unit Sphere.
 * Screen-space miter join on globe-projected positions.
 * Dash patterns + horizon occlusion.
 */

import { WGSL_GLOBE_HEIGHT_SEMANTICS, WGSL_GLOBE_PREAMBLE } from './wgsl-preambles.js';
import { MSAA_SAMPLE_COUNT } from '../frame-context.js';

// ─── WGSL Shader ───

export const GLOBE_LINE_SHADER_SOURCE = /* wgsl */ `

// ─── Constants ───
${WGSL_GLOBE_PREAMBLE}
${WGSL_GLOBE_HEIGHT_SEMANTICS}

// ─── Bindings ───

struct LineMaterial {
  color: vec4<f32>,
  width: f32,
  dashStyle: f32,
  dashAnimationSpeed: f32,
  time: f32,
  dashSegments0: vec4<f32>,
  dashSegments1: vec4<f32>,
  dashMeta: vec4<f32>,
};

@group(1) @binding(0) var<uniform> material: LineMaterial;

fn projectToClip(pos: vec3<f32>) -> vec4<f32> {
  let merc01 = epsg3857ToMerc01(pos);
  let angular = mercatorToAngular(merc01);
  let baseSphere = angularToSphere(angular.x, angular.y);
  let altFrac = altitudeOffset(pos.z);
  let spherePos = baseSphere * (1.0 + altFrac);

  var globeClip = camera.viewProjection * vec4<f32>(spherePos, 1.0);
  globeClip.z = globeClippingZ(baseSphere) * globeClip.w;

  if (camera.projectionTransition >= 0.999) {
    return globeClip;
  } else if (camera.projectionTransition <= 0.001) {
    return camera.flatViewProjection * vec4<f32>(merc01.x, merc01.y, altFrac, 1.0);
  }
  let flatClip = camera.flatViewProjection * vec4<f32>(merc01.x, merc01.y, altFrac, 1.0);
  return mix(flatClip, globeClip, camera.projectionTransition);
}

// ─── Vertex ───

struct VertexInput {
  @location(0) prevPos: vec3<f32>,
  @location(1) currPos: vec3<f32>,
  @location(2) nextPos: vec3<f32>,
  @location(3) side: f32,
  @location(4) cumulDist: f32,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) lineDistance: f32,
  @location(1) clipDot: f32,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  let clipCurr = projectToClip(input.currPos);
  let clipPrev = projectToClip(input.prevPos);
  let clipNext = projectToClip(input.nextPos);

  // Convert to screen space
  let screenCurr = clipCurr.xy / clipCurr.w * camera.viewport * 0.5;
  let screenPrev = clipPrev.xy / clipPrev.w * camera.viewport * 0.5;
  let screenNext = clipNext.xy / clipNext.w * camera.viewport * 0.5;

  // Direction vectors
  let dirPrev = normalize(screenCurr - screenPrev);
  let dirNext = normalize(screenNext - screenCurr);

  // Miter direction
  let normalPrev = vec2<f32>(-dirPrev.y, dirPrev.x);
  let normalNext = vec2<f32>(-dirNext.y, dirNext.x);

  var miter: vec2<f32>;
  let hasPrev = length(input.currPos - input.prevPos) > 0.0001;
  let hasNext = length(input.nextPos - input.currPos) > 0.0001;

  if (hasPrev && hasNext) {
    miter = normalize(normalPrev + normalNext);
    let miterLen = 1.0 / max(dot(miter, normalPrev), 0.1);
    miter = miter * min(miterLen, 3.0);
  } else if (hasPrev) {
    miter = normalPrev;
  } else {
    miter = normalNext;
  }

  let halfWidth = material.width * 0.5;
  let offset = miter * halfWidth * input.side;
  let screenPos = screenCurr + offset;
  let ndcPos = screenPos / (camera.viewport * 0.5);

  // Cumulative arc-length → screen-space via pixels-per-unit ratio
  let mercLen = length(input.currPos.xy - input.prevPos.xy);
  let screenLen = length(screenCurr - screenPrev);
  let ppu = select(1.0, screenLen / mercLen, mercLen > 0.0001);

  // Horizon dot for current position
  let merc01 = epsg3857ToMerc01(input.currPos);
  let angular = mercatorToAngular(merc01);
  let spherePos = angularToSphere(angular.x, angular.y);
  let clipDot = dot(spherePos, camera.clippingPlane.xyz) + camera.clippingPlane.w;

  var out: VertexOutput;
  // Shader-level depth offset: lines render in front of polygons
  const LAYER_DEPTH_OFFSET: f32 = 0.0005;
  let adjustedZ = clipCurr.z - LAYER_DEPTH_OFFSET * clipCurr.w;
  let clampedZ = min(adjustedZ, clipCurr.w * 0.9999);
  out.clipPosition = vec4<f32>(ndcPos * clipCurr.w, clampedZ, clipCurr.w);
  out.lineDistance = input.cumulDist * ppu;
  out.clipDot = clipDot;
  return out;
}

// ─── Fragment ───

fn getDashSegment(i: i32) -> f32 {
  if (i < 4) { return material.dashSegments0[i]; }
  return material.dashSegments1[i - 4];
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // Horizon discard
  if (camera.projectionTransition > 0.01 && input.clipDot < -0.01) {
    discard;
  }

  let dist = input.lineDistance + material.dashAnimationSpeed * material.time;

  // Custom dashArray takes priority
  let segCount = i32(material.dashMeta.x);
  if (segCount > 0) {
    let total = material.dashMeta.y;
    let d = ((dist % total) + total) % total;
    var cumul = 0.0;
    for (var i = 0; i < 8; i++) {
      if (i >= segCount) { break; }
      cumul += getDashSegment(i);
      if (d < cumul) {
        if (i % 2 == 1) { discard; }
        break;
      }
    }
    return material.color;
  }

  // Built-in dash patterns
  if (material.dashStyle > 0.5 && material.dashStyle < 1.5) {
    let pattern = dist % 16.0;
    if (pattern > 10.0) { discard; }
  } else if (material.dashStyle > 1.5 && material.dashStyle < 2.5) {
    let pattern = dist % 6.0;
    if (pattern > 3.0) { discard; }
  } else if (material.dashStyle > 2.5) {
    let pattern = dist % 21.0;
    if ((pattern > 10.0 && pattern < 14.0) || pattern > 17.0) { discard; }
  }

  return material.color;
}
`;

// ─── Bind Group Layout ───

export function createGlobeLineBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'globe-line-material-bind-group-layout',
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

export interface GlobeLinePipelineDescriptor {
  device: GPUDevice;
  colorFormat: GPUTextureFormat;
  globeCameraBindGroupLayout: GPUBindGroupLayout;
  depthFormat?: GPUTextureFormat;
  depthCompare?: GPUCompareFunction;
  sampleCount?: number;
}

export interface GlobeLinePipeline {
  pipeline: GPURenderPipeline;
  materialBindGroupLayout: GPUBindGroupLayout;
}

export function createGlobeLinePipeline(
  desc: GlobeLinePipelineDescriptor,
): GlobeLinePipeline {
  const { device, colorFormat, globeCameraBindGroupLayout } = desc;

  const materialBindGroupLayout = createGlobeLineBindGroupLayout(device);

  const shaderModule = device.createShaderModule({
    label: 'globe-line-shader',
    code: GLOBE_LINE_SHADER_SOURCE,
  });

  const pipelineLayout = device.createPipelineLayout({
    label: 'globe-line-pipeline-layout',
    bindGroupLayouts: [globeCameraBindGroupLayout, materialBindGroupLayout],
  });

  const pipeline = device.createRenderPipeline({
    label: 'globe-line-pipeline',
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
      buffers: [
        {
          arrayStride: 44, // 11 floats: prev(3) + curr(3) + next(3) + side(1) + cumulDist(1)
          stepMode: 'vertex',
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: 'float32x3',
            },
            {
              shaderLocation: 1,
              offset: 12,
              format: 'float32x3',
            },
            {
              shaderLocation: 2,
              offset: 24,
              format: 'float32x3',
            },
            {
              shaderLocation: 3,
              offset: 36,
              format: 'float32',
            },
            {
              shaderLocation: 4,
              offset: 40,
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
