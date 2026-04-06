/**
 * Globe Mesh3D Pipeline — 3D mesh rendering on globe surface.
 *
 * Same vertex layout as mesh3d-pipeline but projects to unit sphere.
 * Height displacement: radius = 1 + h / EARTH_RADIUS_M.
 */

import { WGSL_GLOBE_PREAMBLE } from './wgsl-preambles.js';
import { MSAA_SAMPLE_COUNT } from '../frame-context.js';

export const GLOBE_MESH3D_SHADER_SOURCE = /* wgsl */ `

${WGSL_GLOBE_PREAMBLE}

const EARTH_RADIUS_M: f32 = 6378137.0;

struct Mesh3DMaterial {
  color: vec4<f32>,
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

  // XY in Mercator [0..1], Z = height (metres)
  let merc01 = input.position.xy;
  let ang = mercatorToAngular(merc01);
  let sphereBase = angularToSphere(ang.x, ang.y);

  // Radial height: position on sphere at (1 + h/R)
  let h = input.position.z;
  let radius = 1.0 + h / EARTH_RADIUS_M;
  let worldPos = sphereBase * radius;

  // Horizon clipping
  let clipZ = globeClippingZ(sphereBase);
  if clipZ < -0.01 {
    out.clipPosition = vec4<f32>(0.0, 0.0, -2.0, 1.0); // behind camera
    return out;
  }

  var globeClip = camera.viewProjection * vec4<f32>(worldPos, 1.0);

  // Depth: use globe clipping Z + height bias (matches extrusion pattern)
  let heightBias = abs(h) / EARTH_RADIUS_M;
  let effectiveClipZ = select(clipZ, min(clipZ + 0.0001 + heightBias, 0.9999), clipZ <= 1.0);
  globeClip.z = effectiveClipZ * globeClip.w;

  // Flat path for transition zone
  let heightScale = h / EARTH_RADIUS_M;
  let flatPos = vec4<f32>(merc01.x, merc01.y, heightScale, 1.0);

  if (camera.projectionTransition >= 0.999) {
    out.clipPosition = globeClip;
  } else if (camera.projectionTransition <= 0.001) {
    out.clipPosition = camera.flatViewProjection * flatPos;
  } else {
    var flatClip = camera.flatViewProjection * flatPos;
    out.clipPosition = mix(flatClip, globeClip, camera.projectionTransition);
  }

  out.worldPos = worldPos;

  // Transform normals to globe tangent space
  let cosLat = cos(ang.y);
  let sinLat = sin(ang.y);
  let cosLon = cos(ang.x);
  let sinLon = sin(ang.x);
  let east = vec3<f32>(cosLon, 0.0, -sinLon);
  let north = vec3<f32>(-sinLat * sinLon, cosLat, -sinLat * cosLon);
  let up = sphereBase;

  out.vNormal = normalize(
    input.normal.x * east +
    input.normal.y * up +
    input.normal.z * north
  );

  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let N = normalize(in.vNormal);
  let L = normalize(vec3<f32>(0.3, 0.8, 0.5));
  let V = normalize(-in.worldPos);
  let H = normalize(L + V);

  let diff = max(dot(N, L), 0.0);
  let spec = pow(max(dot(N, H), 0.0), material.shininess) * material.specularStrength;
  let lighting = material.ambient + diff * (1.0 - material.ambient) + spec;
  let baseColor = material.color.rgb * lighting;
  let alpha = material.color.a;

  return vec4<f32>(baseColor * alpha, alpha);
}
`;

export interface GlobeMesh3DPipelineDescriptor {
  device: GPUDevice;
  colorFormat: GPUTextureFormat;
  globeCameraBindGroupLayout: GPUBindGroupLayout;
  depthFormat?: GPUTextureFormat;
  depthCompare?: GPUCompareFunction;
  depthWriteEnabled?: boolean;
  sampleCount?: number;
}

export interface GlobeMesh3DPipeline {
  pipeline: GPURenderPipeline;
  materialBindGroupLayout: GPUBindGroupLayout;
}

export function createGlobeMesh3DPipeline(desc: GlobeMesh3DPipelineDescriptor): GlobeMesh3DPipeline {
  const { device, colorFormat, globeCameraBindGroupLayout } = desc;

  const materialBindGroupLayout = device.createBindGroupLayout({
    label: 'globe-mesh3d-material-bind-group-layout',
    entries: [{
      binding: 0,
      visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
      buffer: { type: 'uniform' },
    }],
  });

  const shaderModule = device.createShaderModule({
    label: 'globe-mesh3d-shader',
    code: GLOBE_MESH3D_SHADER_SOURCE,
  });

  const pipeline = device.createRenderPipeline({
    label: 'globe-mesh3d-pipeline',
    layout: device.createPipelineLayout({
      label: 'globe-mesh3d-pipeline-layout',
      bindGroupLayouts: [globeCameraBindGroupLayout, materialBindGroupLayout],
    }),
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
      buffers: [{
        arrayStride: 24,
        stepMode: 'vertex',
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' },
          { shaderLocation: 1, offset: 12, format: 'float32x3' },
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
      format: desc.depthFormat ?? 'depth24plus',
      depthWriteEnabled: desc.depthWriteEnabled ?? true,
      depthCompare: desc.depthCompare ?? 'less',
    },
    multisample: { count: desc.sampleCount ?? MSAA_SAMPLE_COUNT },
  });

  return { pipeline, materialBindGroupLayout };
}
