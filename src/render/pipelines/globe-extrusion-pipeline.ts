/**
 * Globe Extrusion Pipeline — 3D buildings on globe
 *
 * Same vertex layout as extrusion-pipeline but projects through
 * EPSG:3857 → Mercator [0..1] → angular → unit sphere with
 * radial height offset, normal transform to globe tangent space,
 * Blinn-Phong lighting, and horizon clipping.
 */

import { WGSL_GLOBE_CAMERA_UNIFORMS, WGSL_GLOBE_CONSTANTS, WGSL_GLOBE_HELPERS } from './wgsl-preambles.js';
import { MSAA_SAMPLE_COUNT } from '../frame-context.js';

// ─── WGSL Shader ───

function roofBiasSignFromDepthCompare(depthCompare?: GPUCompareFunction): number {
  if (depthCompare === 'greater' || depthCompare === 'greater-equal') {
    return 1;
  }
  return -1;
}

export function createGlobeExtrusionShaderSource(depthCompare?: GPUCompareFunction): string {
  const roofBiasSign = roofBiasSignFromDepthCompare(depthCompare);
  return /* wgsl */ `

// ─── Bindings ───
${WGSL_GLOBE_CAMERA_UNIFORMS}
${WGSL_GLOBE_CONSTANTS}
const EARTH_RADIUS_M: f32 = 6378137.0;
const ROOF_DEPTH_BIAS: f32 = 1e-4;
const WALL_DEPTH_BIAS: f32 = 2e-5;
const ROOF_DEPTH_BIAS_SIGN: f32 = ${roofBiasSign};
${WGSL_GLOBE_HELPERS}

struct ExtrusionMaterial {
  color: vec4<f32>,
  ambient: f32,
  debugMode: f32,
  animProgress: f32,
  animDuration: f32,
  waveOrigin: vec2<f32>,
  delayFactor: f32,
  _reserved: f32,
  shininess: f32,
  specularStrength: f32,
  _pad1: f32,
  _pad2: f32,
  cameraPos: vec4<f32>,
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

  var h = input.position.z;

  // Grow animation: scale height by eased progress
  if (material.animDuration > 0.0) {
    let dist = distance(input.centroid, material.waveOrigin);
    let delay = dist * material.delayFactor;
    let rawT = clamp((material.animProgress - delay) / material.animDuration, 0.0, 1.0);
    let progress = easeOutCubic(rawT);
    h = h * progress;
  }

  // XY already in Mercator [0..1] from CPU-side normalization
  let merc01 = input.position.xy;
  let ang = mercatorToAngular(merc01);
  let sphereBase = angularToSphere(ang.x, ang.y);

  // Radial height offset: position on sphere at (1 + h/R)
  let radius = 1.0 + h / EARTH_RADIUS_M;
  let worldPos = sphereBase * radius;
  out.worldPos = worldPos;

  // Globe tangent space: transform flat normal to globe space
  // East = d(sphere)/d(lon), North = d(sphere)/d(lat), Up = sphereBase
  let cosLat = cos(ang.y);
  let sinLat = sin(ang.y);
  let cosLon = cos(ang.x);
  let sinLon = sin(ang.x);

  let east = vec3<f32>(cosLon, 0.0, -sinLon);
  let north = vec3<f32>(-sinLat * sinLon, cosLat, -sinLat * cosLon);
  let up = sphereBase;

  // Transform flat normal (input.normal) to globe tangent space
  // flat.x → east, flat.y → north, flat.z → up
  let globeNormal = normalize(
    input.normal.x * east +
    input.normal.y * north +
    input.normal.z * up
  );
  out.vNormal = globeNormal;
  out.debugData = vec3<f32>(0.0, 0.0, 0.0);

  // Phase 2 redesign: GPU perspective Z, globeClippingZ override kaldırıldı.
  // Height ordering artık doğal — extruded buildings terrain'in üstünde because
  // worldPos.height > 0 (surface). ROOF/WALL_DEPTH_BIAS (aşağıda) ince ayar yapar.
  var globeClip = camera.viewProjection * vec4<f32>(worldPos, 1.0);

  // Debug data: height in km, face type (0=wall, 0.5=floor, 1=roof)
  let faceType = select(0.0, select(0.5, 1.0, input.normal.z > 0.5), abs(input.normal.z) > 0.1);
  out.debugData = vec3<f32>(0.0, h * 0.001, faceType);

  // Flat/Mercator path: height scaled consistently with globe path (h / R).
  // Using EARTH_RADIUS_M (not circumference) gives ~6.28× taller buildings,
  // matching the globe path's visual scale and providing proper depth separation.
  let heightScale = h / EARTH_RADIUS_M;
  let flatPos = vec4<f32>(merc01.x, merc01.y, heightScale, 1.0);

  if (camera.projectionTransition >= 0.999) {
    out.clipPosition = globeClip;
  } else if (camera.projectionTransition <= 0.001) {
    out.clipPosition = camera.flatViewProjection * flatPos;
    // Flat VP has Scale(1,-1,1) Y-flip — correct normals to match
    out.vNormal = vec3<f32>(input.normal.x, -input.normal.y, input.normal.z);
    out.worldPos = flatPos.xyz;
  } else {
    var flatClip = camera.flatViewProjection * flatPos;
    out.clipPosition = mix(flatClip, globeClip, camera.projectionTransition);
    let flatNormal = vec3<f32>(input.normal.x, -input.normal.y, input.normal.z);
    out.vNormal = mix(flatNormal, globeNormal, camera.projectionTransition);
    out.worldPos = mix(flatPos.xyz, worldPos, camera.projectionTransition);
  }

  // Depth-aware roof bias:
  // - less/less-equal: negative Z moves closer to camera
  // - greater/greater-equal (reverse-Z): positive Z moves closer to camera
  if (input.normal.z > 0.5) {
    out.clipPosition.z += ROOF_DEPTH_BIAS_SIGN * ROOF_DEPTH_BIAS * out.clipPosition.w;
  }

  if (abs(input.normal.z) < 0.5) {
    let wallDot = input.normal.x * 0.70710677 + input.normal.y * 0.70710677;
    let wallDir = select(-1.0, 1.0, wallDot >= 0.0);
    out.clipPosition.z += ROOF_DEPTH_BIAS_SIGN * wallDir * WALL_DEPTH_BIAS * out.clipPosition.w;
  }

  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // Debug mode: visualize clipZ / height / face type as color
  if (material.debugMode > 0.5) {
    let clipZ = input.debugData.x;
    let faceType = input.debugData.z;
    // Green(safe) → Yellow(mid) → Red(horizon risk)
    let t = clamp(clipZ, 0.0, 1.0);
    var c = mix(vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(1.0, 1.0, 0.0), clamp(t * 2.0, 0.0, 1.0));
    c = mix(c, vec3<f32>(1.0, 0.0, 0.0), clamp(t * 2.0 - 1.0, 0.0, 1.0));
    // Roof = blue tint, Floor = purple tint
    if (faceType > 0.75) { c = mix(c, vec3<f32>(0.3, 0.3, 1.0), 0.4); }
    if (faceType > 0.25 && faceType < 0.75) { c = mix(c, vec3<f32>(0.8, 0.2, 0.8), 0.4); }
    return vec4<f32>(c, 0.9);
  }

  // Blinn-Phong directional lighting
  let lightDir = normalize(vec3<f32>(0.3, -0.5, 0.8));
  let normal = normalize(input.vNormal);
  let NdotL = max(dot(normal, lightDir), 0.0);

  // View direction: globe path uses sphere-outward, flat path uses camera→point
  let globeViewDir = normalize(-input.worldPos);
  let flatViewDir = normalize(material.cameraPos.xyz - input.worldPos);
  let viewDir = normalize(mix(flatViewDir, globeViewDir, camera.projectionTransition));
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
}

// Keep default exportable source for static shader tests.
export const GLOBE_EXTRUSION_SHADER_SOURCE = createGlobeExtrusionShaderSource('greater');

// ─── Pipeline ───

export interface GlobeExtrusionPipelineDescriptor {
  device: GPUDevice;
  colorFormat: GPUTextureFormat;
  globeCameraBindGroupLayout: GPUBindGroupLayout;
  depthFormat?: GPUTextureFormat;
  depthCompare?: GPUCompareFunction;
  sampleCount?: number;
}

export interface GlobeExtrusionPipeline {
  pipeline: GPURenderPipeline;
  materialBindGroupLayout: GPUBindGroupLayout;
}

export function createGlobeExtrusionPipeline(desc: GlobeExtrusionPipelineDescriptor): GlobeExtrusionPipeline {
  const { device, colorFormat, globeCameraBindGroupLayout } = desc;

  const materialBindGroupLayout = device.createBindGroupLayout({
    label: 'globe-extrusion-material-bind-group-layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
    ],
  });

  const shaderModule = device.createShaderModule({
    label: 'globe-extrusion-shader',
    code: createGlobeExtrusionShaderSource(desc.depthCompare),
  });

  const pipelineLayout = device.createPipelineLayout({
    label: 'globe-extrusion-pipeline-layout',
    bindGroupLayouts: [globeCameraBindGroupLayout, materialBindGroupLayout],
  });

  const pipeline = device.createRenderPipeline({
    label: 'globe-extrusion-pipeline',
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
      // Flat path Y-flips handedness, globe path doesn't — 'none' is safe for both.
      cullMode: 'none',
    },
    depthStencil: {
      format: desc.depthFormat ?? 'depth32float',
      depthWriteEnabled: true,
      depthCompare: desc.depthCompare ?? 'greater',
    },
    multisample: {
      count: desc.sampleCount ?? MSAA_SAMPLE_COUNT,
    },
  });

  return { pipeline, materialBindGroupLayout };
}
