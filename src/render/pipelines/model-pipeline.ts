/**
 * Model Pipeline — 2D instanced 3D mesh rendering
 *
 * Renders GLTF meshes at map positions with PBR shading.
 * Uses instanced rendering: mesh vertices × feature instances.
 * Supports base color, normal, metallic-roughness, occlusion, and emissive maps.
 *
 * In 2D mode the orthographic camera clips positive world-space Z, so the
 * flat path projects models onto the map plane and remaps altitude/local
 * height into depth. This keeps elevated models visible in top-down mode
 * while preserving per-model depth ordering.
 */

import { WGSL_CAMERA_UNIFORMS } from './wgsl-preambles.js';
import { MSAA_SAMPLE_COUNT } from '../frame-context.js';

export const MODEL_SHADER_SOURCE = /* wgsl */ `
// ─── Bindings ───
${WGSL_CAMERA_UNIFORMS}

struct ModelMaterial {
  baseColorFactor: vec4<f32>,       // 0-15
  tintColor: vec4<f32>,             // 16-31
  emissiveFactor: vec3<f32>,        // 32-43
  metallic: f32,                    // 44-47
  roughness: f32,                   // 48-51
  hasBaseColorTex: f32,             // 52-55
  hasNormalTex: f32,                // 56-59
  hasMetallicRoughnessTex: f32,     // 60-63
  hasOcclusionTex: f32,             // 64-67
  hasEmissiveTex: f32,              // 68-71
  alphaCutoff: f32,                 // 72-75
  isUnlit: f32,                     // 76-79
  outlineColor: vec4<f32>,          // 80-95
  outlineWidth: f32,                // 96-99
  _outlinePad0: vec3<f32>,          // 100-111
};

@group(1) @binding(0) var<uniform> material: ModelMaterial;
@group(1) @binding(1) var texSampler: sampler;
@group(1) @binding(2) var baseColorTex: texture_2d<f32>;
@group(1) @binding(3) var normalTex: texture_2d<f32>;
@group(1) @binding(4) var metallicRoughnessTex: texture_2d<f32>;
@group(1) @binding(5) var occlusionTex: texture_2d<f32>;
@group(1) @binding(6) var emissiveTex: texture_2d<f32>;

// ─── Vertex Input ───

struct VertexInput {
  // Per-vertex (slot 0)
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) texcoord: vec2<f32>,
  // Per-instance (slot 1)
  @location(3) worldPos: vec3<f32>,
  @location(4) scaleHeading: vec2<f32>,   // scale, heading
  @location(5) pitchRollAnchor: vec3<f32>, // pitch, roll, anchorZ
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) vNormal: vec3<f32>,
  @location(1) vTexcoord: vec2<f32>,
  @location(2) vWorldPos: vec3<f32>,
};

// ─── Rotation Matrix from Euler angles (heading/pitch/roll in degrees) ───

fn degreesToRadians(deg: f32) -> f32 {
  return deg * 3.14159265358979 / 180.0;
}

fn eulerToRotationMatrix(heading: f32, pitch: f32, roll: f32) -> mat3x3<f32> {
  let h = degreesToRadians(heading);
  let p = degreesToRadians(pitch);
  let r = degreesToRadians(roll);

  let ch = cos(h); let sh = sin(h);
  let cp = cos(p); let sp = sin(p);
  let cr = cos(r); let sr = sin(r);

  // ZYX rotation order: heading(Z) * pitch(Y) * roll(X)
  return mat3x3<f32>(
    vec3<f32>(ch*cp, sh*cp, -sp),
    vec3<f32>(ch*sp*sr - sh*cr, sh*sp*sr + ch*cr, cp*sr),
    vec3<f32>(ch*sp*cr + sh*sr, sh*sp*cr - ch*sr, cp*cr),
  );
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  let scale = input.scaleHeading.x;
  let heading = input.scaleHeading.y;
  let pitch = input.pitchRollAnchor.x;
  let roll = input.pitchRollAnchor.y;
  let anchorZ = input.pitchRollAnchor.z;

  let rotMat = eulerToRotationMatrix(heading, pitch, roll);
  let mercatorScale = mercatorMetersPerMeter(input.worldPos.y);
  let rotated = rotMat * (input.position * (scale * mercatorScale));

  // 2D orthographic mode clips positive world-space Z. Keep the model anchored
  // to the ground plane for projection, then map altitude + local height into
  // clip-space depth so elevated models remain visible.
  let projectedWorldPos = vec3<f32>(input.worldPos.x + rotated.x, input.worldPos.y + rotated.y, 0.0);
  let heightMeters = input.worldPos.z + anchorZ + rotated.z / max(mercatorScale, 0.01);
  let worldPos = vec3<f32>(projectedWorldPos.x, projectedWorldPos.y, heightMeters);

  output.clipPosition = camera.viewProjection * vec4<f32>(projectedWorldPos, 1.0);
  // Signed log depth — distinct clip-Z per vertex; see gltf2-shader.ts for
  // full rationale (abs() + 0.1 clamp collapsed sub-meter vertices to the
  // same depth, causing Z-fighting tears with cullMode='none').
  let logH = sign(heightMeters) * log2(abs(heightMeters) + 1.0);
  let logMax = log2(1001.0);
  let normalizedZ = clamp(0.5 - logH / (2.0 * logMax), 0.001, 0.999);
  output.clipPosition.z = max(0.0, normalizedZ - 0.0001) * output.clipPosition.w;

  output.vNormal = normalize(rotMat * input.normal);
  output.vTexcoord = input.texcoord;
  output.vWorldPos = worldPos;

  return output;
}

// ─── PBR Helpers ───

const PI: f32 = 3.14159265358979;
const EARTH_RADIUS_M: f32 = 6378137.0;

// GGX/Trowbridge-Reitz Normal Distribution Function
fn distributionGGX(NdotH: f32, roughness: f32) -> f32 {
  let a = roughness * roughness;
  let a2 = a * a;
  let d = NdotH * NdotH * (a2 - 1.0) + 1.0;
  return a2 / (PI * d * d + 0.0001);
}

// Schlick-GGX Geometry function
fn geometrySchlickGGX(NdotV: f32, roughness: f32) -> f32 {
  let r = roughness + 1.0;
  let k = (r * r) / 8.0;
  return NdotV / (NdotV * (1.0 - k) + k);
}

// Smith's method for combined geometry obstruction
fn geometrySmith(NdotV: f32, NdotL: f32, roughness: f32) -> f32 {
  return geometrySchlickGGX(NdotV, roughness) * geometrySchlickGGX(NdotL, roughness);
}

// Schlick Fresnel approximation
fn fresnelSchlick(cosTheta: f32, F0: vec3<f32>) -> vec3<f32> {
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

fn mercatorMetersPerMeter(mercatorY: f32) -> f32 {
  let lat = atan(exp(mercatorY / EARTH_RADIUS_M)) * 2.0 - PI * 0.5;
  return 1.0 / max(cos(lat), 0.01);
}

fn applyOutline(color: vec3<f32>, outlineColor: vec4<f32>, outlineWidth: f32, ndotv: f32) -> vec3<f32> {
  if (outlineWidth <= 0.0 || outlineColor.a <= 0.0) {
    return color;
  }
  let widthNorm = clamp(outlineWidth / 8.0, 0.0, 1.0);
  let silhouette = 1.0 - clamp(abs(ndotv), 0.0, 1.0);
  let threshold = mix(0.80, 0.30, widthNorm);
  let mask = smoothstep(threshold, 1.0, silhouette) * outlineColor.a;
  return mix(color, outlineColor.rgb, mask);
}

// ─── Fragment: PBR ───

@fragment
fn fs_main(input: VertexOutput, @builtin(front_facing) frontFacing: bool) -> @location(0) vec4<f32> {
  // ─── Depth Debug Visualization ───
  // R/G: log-scale gradient magnitude (red=z-fight risk, green=healthy spread).
  // B: actual NDC depth (dark=near, bright=far). Solid red = depth collapse.
  if (material.tintColor.a == 0.0) {
    let d = input.clipPosition.z;
    let grad = length(vec2<f32>(dpdx(d), dpdy(d)));
    let logGrad = clamp((log2(grad + 1e-10) + 26.6) / 13.3, 0.0, 1.0);
    return vec4<f32>(1.0 - logGrad, logGrad, d, 1.0);
  }

  let uv = input.vTexcoord;

  // ── Base Color ──
  var baseColor = material.baseColorFactor;
  if (material.hasBaseColorTex > 0.5) {
    baseColor = baseColor * textureSample(baseColorTex, texSampler, uv);
  }
  baseColor = vec4<f32>(baseColor.rgb * material.tintColor.rgb, baseColor.a * material.tintColor.a);

  // Alpha test (MASK mode)
  if (material.alphaCutoff > 0.0 && baseColor.a < material.alphaCutoff) {
    discard;
  }

  // KHR_materials_unlit: skip all lighting
  if (material.isUnlit > 0.5) {
    return baseColor;
  }

  // ── Normal (flip for back-faces on double-sided materials) ──
  var N = normalize(input.vNormal);
  if (!frontFacing) { N = -N; }
  if (material.hasNormalTex > 0.5) {
    let tangentNormal = textureSample(normalTex, texSampler, uv).rgb * 2.0 - 1.0;
    // Cotangent frame from screen-space derivatives
    let dpdx_val = dpdx(input.vWorldPos);
    let dpdy_val = dpdy(input.vWorldPos);
    let dudx = dpdx(uv);
    let dvdy = dpdy(uv);
    let T = normalize(dpdx_val * dvdy.y - dpdy_val * dudx.y);
    let B = normalize(cross(N, T));
    let TBN = mat3x3<f32>(T, B, N);
    N = normalize(TBN * tangentNormal);
  }

  // ── Metallic / Roughness ──
  var metallic = material.metallic;
  var roughness = material.roughness;
  if (material.hasMetallicRoughnessTex > 0.5) {
    let mrSample = textureSample(metallicRoughnessTex, texSampler, uv);
    roughness = roughness * mrSample.g; // green channel = roughness
    metallic = metallic * mrSample.b;   // blue channel = metallic
  }
  roughness = clamp(roughness, 0.04, 1.0);

  // ── PBR Lighting ──
  let lightDir = normalize(vec3<f32>(0.5, 0.8, 0.6));
  let viewDir = normalize(vec3<f32>(0.0, 0.0, 1.0));
  let H = normalize(lightDir + viewDir);

  let NdotL = max(dot(N, lightDir), 0.0);
  let NdotV = max(dot(N, viewDir), 0.001);
  let NdotH = max(dot(N, H), 0.0);
  let HdotV = max(dot(H, viewDir), 0.0);

  // Dielectric/metallic F0
  let F0 = mix(vec3<f32>(0.04), baseColor.rgb, metallic);

  // Cook-Torrance BRDF
  let D = distributionGGX(NdotH, roughness);
  let G = geometrySmith(NdotV, NdotL, roughness);
  let F = fresnelSchlick(HdotV, F0);

  let specular = (D * G * F) / (4.0 * NdotV * NdotL + 0.0001);
  let kD = (vec3<f32>(1.0) - F) * (1.0 - metallic);
  let diffuse = kD * baseColor.rgb / PI;

  let radiance = vec3<f32>(1.0); // directional light color
  var color = (diffuse + specular) * radiance * NdotL;

  // Ambient
  color += 0.15 * baseColor.rgb;

  // ── Ambient Occlusion ──
  if (material.hasOcclusionTex > 0.5) {
    let ao = textureSample(occlusionTex, texSampler, uv).r;
    color = color * ao;
  }

  // ── Emissive ──
  var emissive = material.emissiveFactor;
  if (material.hasEmissiveTex > 0.5) {
    emissive = emissive * textureSample(emissiveTex, texSampler, uv).rgb;
  }
  color += emissive;
  color = applyOutline(color, material.outlineColor, material.outlineWidth, NdotV);

  return vec4<f32>(color, baseColor.a);
}
`;

// ─── Pipeline Types ───

export interface ModelPipeline {
  pipeline: GPURenderPipeline;
  materialBindGroupLayout: GPUBindGroupLayout;
  sampler: GPUSampler;
}

export interface ModelPipelineDescriptor {
  device: GPUDevice;
  colorFormat: GPUTextureFormat;
  cameraBindGroupLayout: GPUBindGroupLayout;
  depthFormat: GPUTextureFormat;
  depthCompare?: GPUCompareFunction;
  sampleCount?: number;
}

// ─── Factory ───

export function createModelBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'model-material-bind-group-layout',
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: 5, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: 6, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
    ],
  });
}

export function createModelPipeline(desc: ModelPipelineDescriptor): ModelPipeline {
  const { device, colorFormat, cameraBindGroupLayout, depthFormat, depthCompare } = desc;

  const materialBindGroupLayout = createModelBindGroupLayout(device);

  const pipelineLayout = device.createPipelineLayout({
    label: 'model-pipeline-layout',
    bindGroupLayouts: [cameraBindGroupLayout, materialBindGroupLayout],
  });

  const shaderModule = device.createShaderModule({
    label: 'model-shader',
    code: MODEL_SHADER_SOURCE,
  });

  const pipeline = device.createRenderPipeline({
    label: 'model-pipeline',
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
      buffers: [
        // Slot 0: mesh vertex data (interleaved)
        {
          arrayStride: 32, // 8 floats × 4 bytes
          stepMode: 'vertex' as GPUVertexStepMode,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x3' as GPUVertexFormat },  // position
            { shaderLocation: 1, offset: 12, format: 'float32x3' as GPUVertexFormat }, // normal
            { shaderLocation: 2, offset: 24, format: 'float32x2' as GPUVertexFormat }, // texcoord
          ],
        },
        // Slot 1: instance data
        {
          arrayStride: 32, // 8 floats × 4 bytes
          stepMode: 'instance' as GPUVertexStepMode,
          attributes: [
            { shaderLocation: 3, offset: 0, format: 'float32x3' as GPUVertexFormat },  // worldPos (x,y,z)
            { shaderLocation: 4, offset: 12, format: 'float32x2' as GPUVertexFormat }, // scale, heading
            { shaderLocation: 5, offset: 20, format: 'float32x3' as GPUVertexFormat }, // pitch, roll, anchorZ
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
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
          },
        },
      ],
    },
    primitive: {
      topology: 'triangle-list',
      // See gltf2-renderer.ts for rationale — back-face culling avoids
      // camera-rotation-dependent shimmer at globe-scale depth precision.
      cullMode: 'back',
    },
    depthStencil: {
      format: depthFormat,
      depthWriteEnabled: true,
      depthCompare: depthCompare ?? 'less',
    },
    multisample: {
      count: desc.sampleCount ?? MSAA_SAMPLE_COUNT,
    },
  });

  const sampler = device.createSampler({
    label: 'model-sampler',
    magFilter: 'linear',
    minFilter: 'linear',
    mipmapFilter: 'linear',
    addressModeU: 'repeat',
    addressModeV: 'repeat',
  });

  return { pipeline, materialBindGroupLayout, sampler };
}
