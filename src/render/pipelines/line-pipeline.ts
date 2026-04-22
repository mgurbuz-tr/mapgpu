/**
 * Line Pipeline
 *
 * Screen-space line width with miter join.
 * Supports solid, dash, dot, dash-dot patterns.
 * LineSymbol'den renk, kalınlık, stil okur.
 */

import { WGSL_CAMERA_UNIFORMS } from './wgsl-preambles.js';
import { MSAA_SAMPLE_COUNT } from '../frame-context.js';

// ─── WGSL Shader ───

export const LINE_SHADER_SOURCE = /* wgsl */ `

// ─── Bindings ───
${WGSL_CAMERA_UNIFORMS}

struct LineMaterial {
  color: vec4<f32>,
  width: f32,
  // Dash pattern: 0=solid, 1=dash, 2=dot, 3=dash-dot
  dashStyle: f32,
  dashAnimationSpeed: f32,
  time: f32,
  // Custom dashArray — packed into 2 vec4s (up to 8 segments)
  dashSegments0: vec4<f32>,
  dashSegments1: vec4<f32>,
  // x=segment count (0=use dashStyle), y=total pattern length
  dashMeta: vec4<f32>,
};

@group(1) @binding(0) var<uniform> material: LineMaterial;

// ─── Vertex ───

// Each line segment uses 6 vertices (2 triangles forming a screen-space quad).
// Vertex buffer layout: [prevX, prevY, prevZ, currX, currY, currZ, nextX, nextY, nextZ, side, cumulDist]
// side: -1.0 or 1.0 (which side of the line)
// cumulDist: cumulative Mercator arc-length from polyline start
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
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  let clipCurr = camera.viewProjection * vec4<f32>(input.currPos.xy, 0.0, 1.0);
  let clipPrev = camera.viewProjection * vec4<f32>(input.prevPos.xy, 0.0, 1.0);
  let clipNext = camera.viewProjection * vec4<f32>(input.nextPos.xy, 0.0, 1.0);

  // Convert to screen space
  let screenCurr = clipCurr.xy / clipCurr.w * camera.viewport * 0.5;
  let screenPrev = clipPrev.xy / clipPrev.w * camera.viewport * 0.5;
  let screenNext = clipNext.xy / clipNext.w * camera.viewport * 0.5;

  // Direction vectors
  let dirPrev = normalize(screenCurr - screenPrev);
  let dirNext = normalize(screenNext - screenCurr);

  // Miter direction (average of two normals)
  let normalPrev = vec2<f32>(-dirPrev.y, dirPrev.x);
  let normalNext = vec2<f32>(-dirNext.y, dirNext.x);

  var miter: vec2<f32>;
  let hasPrev = length(input.currPos - input.prevPos) > 0.0001;
  let hasNext = length(input.nextPos - input.currPos) > 0.0001;

  if (hasPrev && hasNext) {
    miter = normalize(normalPrev + normalNext);
    // Miter length correction
    let miterLen = 1.0 / max(dot(miter, normalPrev), 0.1);
    miter = miter * min(miterLen, 3.0); // Cap miter to prevent spikes
  } else if (hasPrev) {
    miter = normalPrev;
  } else {
    miter = normalNext;
  }

  // Offset in screen space
  let halfWidth = material.width * 0.5;
  let offset = miter * halfWidth * input.side;

  // Back to clip space
  let screenPos = screenCurr + offset;
  let ndcPos = screenPos / (camera.viewport * 0.5);

  // Cumulative arc-length → screen-space via pixels-per-unit ratio
  let mercLen = length(input.currPos.xy - input.prevPos.xy);
  let screenLen = length(screenCurr - screenPrev);
  let ppu = select(1.0, screenLen / mercLen, mercLen > 0.0001);

  var out: VertexOutput;
  out.clipPosition = vec4<f32>(ndcPos * clipCurr.w, clipCurr.z, clipCurr.w);
  out.lineDistance = input.cumulDist * ppu;
  return out;
}

// ─── Fragment ───

fn getDashSegment(i: i32) -> f32 {
  if (i < 4) { return material.dashSegments0[i]; }
  return material.dashSegments1[i - 4];
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let dist = input.lineDistance + material.dashAnimationSpeed * material.time;

  // Custom dashArray takes priority when dashMeta.x > 0
  let segCount = i32(material.dashMeta.x);
  if (segCount > 0) {
    let total = material.dashMeta.y;
    let d = ((dist % total) + total) % total; // wrap positive
    var cumul = 0.0;
    for (var i = 0; i < 8; i++) {
      if (i >= segCount) { break; }
      cumul += getDashSegment(i);
      if (d < cumul) {
        if (i % 2 == 1) { discard; } // odd index = gap
        break;
      }
    }
    return material.color;
  }

  // Built-in dash patterns (screen-space units)
  if (material.dashStyle > 0.5 && material.dashStyle < 1.5) {
    // Dash: 10px on, 6px off
    let pattern = dist % 16.0;
    if (pattern > 10.0) { discard; }
  } else if (material.dashStyle > 1.5 && material.dashStyle < 2.5) {
    // Dot: 3px on, 3px off
    let pattern = dist % 6.0;
    if (pattern > 3.0) { discard; }
  } else if (material.dashStyle > 2.5) {
    // Dash-dot: 10px on, 4px off, 3px on, 4px off
    let pattern = dist % 21.0;
    if ((pattern > 10.0 && pattern < 14.0) || pattern > 17.0) { discard; }
  }

  return material.color;
}
`;

// ─── Bind Group Layout ───

/**
 * Line material bind group layout (group 1).
 */
export function createLineBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'line-material-bind-group-layout',
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

export interface LinePipelineDescriptor {
  device: GPUDevice;
  colorFormat: GPUTextureFormat;
  cameraBindGroupLayout: GPUBindGroupLayout;
  depthFormat?: GPUTextureFormat;
  depthCompare?: GPUCompareFunction;
  sampleCount?: number;
}

export interface LinePipeline {
  pipeline: GPURenderPipeline;
  materialBindGroupLayout: GPUBindGroupLayout;
}

/**
 * Line render pipeline oluştur.
 * Screen-space line width with miter joins and dash patterns.
 */
export function createLinePipeline(desc: LinePipelineDescriptor): LinePipeline {
  const { device, colorFormat, cameraBindGroupLayout } = desc;

  const materialBindGroupLayout = createLineBindGroupLayout(device);

  const shaderModule = device.createShaderModule({
    label: 'line-shader',
    code: LINE_SHADER_SOURCE,
  });

  const pipelineLayout = device.createPipelineLayout({
    label: 'line-pipeline-layout',
    bindGroupLayouts: [cameraBindGroupLayout, materialBindGroupLayout],
  });

  const pipeline = device.createRenderPipeline({
    label: 'line-pipeline',
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
      buffers: [
        {
          // Vertex buffer: prevPos(3) + currPos(3) + nextPos(3) + side(1) + cumulDist(1) = 11 floats
          arrayStride: 44, // 11 * 4 bytes
          stepMode: 'vertex',
          attributes: [
            {
              // prevPos
              shaderLocation: 0,
              offset: 0,
              format: 'float32x3',
            },
            {
              // currPos
              shaderLocation: 1,
              offset: 12,
              format: 'float32x3',
            },
            {
              // nextPos
              shaderLocation: 2,
              offset: 24,
              format: 'float32x3',
            },
            {
              // side
              shaderLocation: 3,
              offset: 36,
              format: 'float32',
            },
            {
              // cumulDist
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
      format: desc.depthFormat ?? 'depth32float',
      depthWriteEnabled: true,
      depthCompare: desc.depthCompare ?? 'less',
    },
    multisample: {
      count: desc.sampleCount ?? MSAA_SAMPLE_COUNT,
    },
  });

  return { pipeline, materialBindGroupLayout };
}

// ─── Dash Style Mapping ───

/**
 * LineSymbol.style string'ini shader dashStyle uniform değerine çevir.
 */
export function dashStyleToUniform(style: 'solid' | 'dash' | 'dot' | 'dash-dot'): number {
  switch (style) {
    case 'solid': return 0;
    case 'dash': return 1;
    case 'dot': return 2;
    case 'dash-dot': return 3;
  }
}
