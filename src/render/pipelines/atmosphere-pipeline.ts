/**
 * Atmosphere Pipeline
 *
 * Globe etrafında atmosfer halo efekti — mesh tabanlı, per-fragment glow.
 *
 * Trick: Mesh, görünür glow bölgesinden BÜYÜK (1.15×). Polygonal silhouette
 * kenarları glow'un sıfıra düştüğü alanda kalır → görünmez.
 * Fragment shader'da worldPos normalize edilerek her piksel doğru küre
 * yönünü hesaplar — interpolasyon artefaktı yok.
 *
 * Depth: depthWriteEnabled=false — globe/tile'ların üzerini örtmez.
 */

import { WGSL_GLOBE_CAMERA_UNIFORMS } from './wgsl-preambles.js';
import { MSAA_SAMPLE_COUNT } from '../frame-context.js';

// ─── Constants ───

/**
 * Mesh radius — görünür atmosphere'den büyük olmalı ki
 * polygonal silhouette edge'ler invisible zone'da kalsın.
 */
const ATMOSPHERE_MESH_SCALE = 1.15;

// ─── WGSL Shader ───

export const ATMOSPHERE_SHADER_SOURCE = /* wgsl */ `

// ─── Constants ───

const PI: f32 = 3.14159265358979323846;

// ─── Bindings ───
${WGSL_GLOBE_CAMERA_UNIFORMS}

struct AtmosphereUniforms {
  colorInner: vec4<f32>,
  colorOuter: vec4<f32>,
  strength: f32,
  falloff: f32,
  _pad0: f32,
  _pad1: f32,
};

@group(1) @binding(0) var<uniform> atmosphere: AtmosphereUniforms;

// ─── Vertex ───

struct VertexInput {
  @location(0) position: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) worldPos: vec3<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.clipPosition = camera.viewProjection * vec4<f32>(input.position, 1.0);
  out.worldPos = input.position;
  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // Normalize worldPos to project onto true sphere surface.
  // Linear interpolation between mesh vertices creates chords;
  // normalizing gives the exact spherical direction per-fragment.
  let sphereDir = normalize(input.worldPos);

  // Compute clipDot per-fragment (not interpolated) for smooth horizon
  let clipDot = dot(sphereDir, camera.clippingPlane.xyz) + camera.clippingPlane.w;

  // Discard back hemisphere
  if (clipDot < -0.15) {
    discard;
  }

  // Fresnel-like edge glow: view direction vs sphere normal
  let cameraDir = normalize(camera.clippingPlane.xyz);
  let facing = abs(dot(sphereDir, cameraDir));
  let edgeFactor = 1.0 - facing;

  // Glow intensity with configurable falloff
  let intensity = pow(edgeFactor, atmosphere.falloff);

  // Boost and clamp
  let boosted = clamp(intensity * 2.0, 0.0, 1.0);

  // Color gradient: inner (near globe edge) → outer (limb)
  let color = mix(atmosphere.colorInner, atmosphere.colorOuter, edgeFactor);

  // Final alpha: glow × strength × projectionTransition
  let alpha = boosted * atmosphere.strength * camera.projectionTransition;

  // Smooth horizon fade (per-fragment, not interpolated → no polygon edges)
  let horizonFade = smoothstep(-0.15, 0.05, clipDot);
  let finalAlpha = alpha * horizonFade;

  if (finalAlpha < 0.002) {
    discard;
  }

  return vec4<f32>(color.rgb, finalAlpha);
}
`;

// ─── Atmosphere Mesh ───

export interface AtmosphereMesh {
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  indexCount: number;
  vertexCount: number;
}

/**
 * Icosphere mesh — octahedron subdivided and projected onto sphere.
 * Radius = ATMOSPHERE_MESH_SCALE (larger than visible glow region).
 *
 * @param device - GPUDevice
 * @param subdivisions - Detail level (default 4 → 2048 triangles)
 */
export function createAtmosphereMesh(device: GPUDevice, subdivisions = 4): AtmosphereMesh {
  const r = ATMOSPHERE_MESH_SCALE;

  // Octahedron base vertices
  let vertices: number[] = [
    0, r, 0, 0, -r, 0, r, 0, 0, -r, 0, 0, 0, 0, r, 0, 0, -r,
  ];
  let indices: number[] = [
    0, 4, 2, 0, 2, 5, 0, 5, 3, 0, 3, 4, 1, 2, 4, 1, 5, 2, 1, 3, 5, 1, 4, 3,
  ];

  const midpointCache = new Map<string, number>();

  function getMidpoint(a: number, b: number): number {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    const cached = midpointCache.get(key);
    if (cached !== undefined) return cached;

    const ax = vertices[a * 3]!;
    const ay = vertices[a * 3 + 1]!;
    const az = vertices[a * 3 + 2]!;
    const bx = vertices[b * 3]!;
    const by = vertices[b * 3 + 1]!;
    const bz = vertices[b * 3 + 2]!;

    let mx = (ax + bx) * 0.5;
    let my = (ay + by) * 0.5;
    let mz = (az + bz) * 0.5;

    // Normalize to mesh radius
    const len = Math.hypot(mx, my, mz);
    mx = (mx / len) * r;
    my = (my / len) * r;
    mz = (mz / len) * r;

    const idx = vertices.length / 3;
    vertices.push(mx, my, mz);
    midpointCache.set(key, idx);
    return idx;
  }

  for (let s = 0; s < subdivisions; s++) {
    const newIndices: number[] = [];
    midpointCache.clear();
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i]!;
      const b = indices[i + 1]!;
      const c = indices[i + 2]!;
      const ab = getMidpoint(a, b);
      const bc = getMidpoint(b, c);
      const ca = getMidpoint(c, a);
      newIndices.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
    }
    indices = newIndices;
  }

  const vertexData = new Float32Array(vertices);
  const indexData =
    vertices.length / 3 > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);

  const vertexBuffer = device.createBuffer({
    label: 'atmosphere-vertex-buffer',
    size: vertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertexData);

  const indexBuffer = device.createBuffer({
    label: 'atmosphere-index-buffer',
    size: indexData.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(indexBuffer, 0, indexData);

  return {
    vertexBuffer,
    indexBuffer,
    indexCount: indices.length,
    vertexCount: vertices.length / 3,
  };
}

// ─── Bind Group Layout ───

export function createAtmosphereBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'atmosphere-bind-group-layout',
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

export interface AtmospherePipelineDescriptor {
  device: GPUDevice;
  colorFormat: GPUTextureFormat;
  globeCameraBindGroupLayout: GPUBindGroupLayout;
  depthFormat?: GPUTextureFormat;
  subdivisions?: number;
  sampleCount?: number;
}

export interface AtmospherePipeline {
  pipeline: GPURenderPipeline;
  atmosphereBindGroupLayout: GPUBindGroupLayout;
  mesh: AtmosphereMesh;
}

/**
 * Atmosphere pipeline — mesh-based glow with per-fragment sphere projection.
 * Mesh larger than visible glow → polygonal edges invisible.
 * depthWriteEnabled=false, depthCompare=always.
 */
export function createAtmospherePipeline(
  desc: AtmospherePipelineDescriptor,
): AtmospherePipeline {
  const { device, colorFormat, globeCameraBindGroupLayout } = desc;

  const atmosphereBindGroupLayout = createAtmosphereBindGroupLayout(device);

  const shaderModule = device.createShaderModule({
    label: 'atmosphere-shader',
    code: ATMOSPHERE_SHADER_SOURCE,
  });

  const pipelineLayout = device.createPipelineLayout({
    label: 'atmosphere-pipeline-layout',
    bindGroupLayouts: [globeCameraBindGroupLayout, atmosphereBindGroupLayout],
  });

  const mesh = createAtmosphereMesh(device, desc.subdivisions ?? 4);

  const pipeline = device.createRenderPipeline({
    label: 'atmosphere-pipeline',
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
      buffers: [
        {
          arrayStride: 12,
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: 'float32x3' as GPUVertexFormat,
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
      cullMode: 'front', // Render inner faces — camera is outside
    },
    depthStencil: {
      format: desc.depthFormat ?? 'depth32float',
      depthWriteEnabled: false,
      depthCompare: 'always',
    },
    multisample: {
      count: desc.sampleCount ?? MSAA_SAMPLE_COUNT,
    },
  });

  return { pipeline, atmosphereBindGroupLayout, mesh };
}
