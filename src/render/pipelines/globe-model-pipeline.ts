/**
 * Globe Model Pipeline — 3D instanced mesh rendering on globe
 *
 * Projects GLTF meshes onto the unit sphere with tangent-frame orientation.
 */

import { WGSL_GLOBE_HEIGHT_SEMANTICS, WGSL_GLOBE_PREAMBLE } from './wgsl-preambles.js';
import { MSAA_SAMPLE_COUNT } from '../frame-context.js';

export const GLOBE_MODEL_SHADER_SOURCE = /* wgsl */ `
// ─── Constants ───
${WGSL_GLOBE_PREAMBLE}
${WGSL_GLOBE_HEIGHT_SEMANTICS}

// ─── Bindings ───

struct ModelMaterial {
  baseColorFactor: vec4<f32>,
  tintColor: vec4<f32>,
  emissiveFactor: vec3<f32>,
  metallic: f32,
  roughness: f32,
  hasBaseColorTex: f32,
  hasNormalTex: f32,
  hasMetallicRoughnessTex: f32,
  hasOcclusionTex: f32,
  hasEmissiveTex: f32,
  alphaCutoff: f32,
  isUnlit: f32,
  outlineColor: vec4<f32>,
  outlineWidth: f32,
  _outlinePad0: vec3<f32>,
};

@group(1) @binding(0) var<uniform> material: ModelMaterial;
@group(1) @binding(1) var texSampler: sampler;
@group(1) @binding(2) var baseColorTex: texture_2d<f32>;
@group(1) @binding(3) var normalTex: texture_2d<f32>;
@group(1) @binding(4) var metallicRoughnessTex: texture_2d<f32>;
@group(1) @binding(5) var occlusionTex: texture_2d<f32>;
@group(1) @binding(6) var emissiveTex: texture_2d<f32>;

// ─── Helpers ───

fn degreesToRadians(deg: f32) -> f32 {
  return deg * PI / 180.0;
}

fn eulerToRotationMatrix(heading: f32, pitch: f32, roll: f32) -> mat3x3<f32> {
  let h = degreesToRadians(heading);
  let p = degreesToRadians(pitch);
  let r = degreesToRadians(roll);

  let ch = cos(h); let sh = sin(h);
  let cp = cos(p); let sp = sin(p);
  let cr = cos(r); let sr = sin(r);

  return mat3x3<f32>(
    vec3<f32>(ch*cp, sh*cp, -sp),
    vec3<f32>(ch*sp*sr - sh*cr, sh*sp*sr + ch*cr, cp*sr),
    vec3<f32>(ch*sp*cr + sh*sr, sh*sp*cr - ch*sr, cp*cr),
  );
}

// ─── Vertex ───

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) texcoord: vec2<f32>,
  @location(3) worldPos: vec3<f32>,
  @location(4) scaleHeading: vec2<f32>,
  @location(5) pitchRollAnchor: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) vNormal: vec3<f32>,
  @location(1) vTexcoord: vec2<f32>,
  @location(2) vWorldPos: vec3<f32>,
  @location(3) clipDot: f32,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  let scale = input.scaleHeading.x;
  let heading = input.scaleHeading.y;
  let pitch = input.pitchRollAnchor.x;
  let roll = input.pitchRollAnchor.y;
  let anchorZ = input.pitchRollAnchor.z;

  // Convert instance position to sphere
  let merc01 = epsg3857ToMerc01(input.worldPos);
  let angular = mercatorToAngular(merc01);
  let spherePos = angularToSphere(angular.x, angular.y);

  // Build LOCAL TANGENT FRAME at sphere position
  let up = normalize(spherePos);
  // Pole guard: if near pole, use X-axis instead of Y
  var refDir = vec3<f32>(0.0, 1.0, 0.0);
  if (abs(up.y) > 0.999) {
    refDir = vec3<f32>(1.0, 0.0, 0.0);
  }
  let east = normalize(cross(refDir, up));
  let north = cross(up, east);
  // Model local axes are x=east, y=north, z=up in mapgpu space.
  let tangentMatrix = mat3x3<f32>(east, north, up);

  // Rotation matrix (shared by globe and flat paths)
  let rotMat = eulerToRotationMatrix(heading, pitch, roll);

  // ─── Globe path: tangent frame on unit sphere ───
  let globeScale = scale / EARTH_RADIUS_M;
  let localOffset = tangentMatrix * (rotMat * (input.position * globeScale));
  let totalAlt = input.worldPos.z + anchorZ;
  let altFrac = altitudeOffset(totalAlt);
  let spherePart = spherePos * (1.0 + altFrac);

  // RTE (Relative-To-Eye) — preserve vertex-to-vertex depth precision in f32.
  //   VP*(x, 1) == VP*(x - eye, 0) + VP*(eye, 1)
  // The first term is per-vertex with small magnitude (model-sized), the
  // second is a per-instance constant. Prevents z-fight at globe scale.
  let eyeSphere = camera.cameraWorld.xyz;
  let relativePos = (spherePart - eyeSphere) + localOffset;
  var globeClip = camera.viewProjection * vec4<f32>(relativePos, 0.0)
                + camera.viewProjection * vec4<f32>(eyeSphere, 1.0);

  // Phase 2 redesign: depthShift hack kaldırıldı — saf GPU perspective depth.

  // ─── Flat path: model vertex offset in Mercator [0..1] space ───
  let flatMercatorScale = 1.0 / max(cos(angular.y), 0.01);
  let flatRotated = rotMat * (input.position * scale);
  let flatLocalScale = flatMercatorScale / (2.0 * HALF_CIRCUMFERENCE);
  // Y pre-negation → flatViewProjection Y-flip compensate → winding korunur.
  let flatMerc = vec3<f32>(
    merc01.x + flatRotated.x * flatLocalScale,
    merc01.y + flatRotated.y * flatLocalScale,
    altitudeOffset(input.worldPos.z) + (flatRotated.z + anchorZ) * flatLocalScale
  );
  var flatClip = camera.flatViewProjection * vec4<f32>(flatMerc, 1.0);
  flatClip.z += 0.001 * flatClip.w;

  const LAYER_DEPTH_OFFSET: f32 = 0.0003;

  // High zoom (transition=0) flat (terrain ile align), düşük zoom globe.
  var clipPos: vec4<f32>;
  if (camera.projectionTransition >= 0.999) {
    clipPos = globeClip;
  } else if (camera.projectionTransition <= 0.001) {
    clipPos = flatClip;
  } else {
    clipPos = mix(flatClip, globeClip, camera.projectionTransition);
  }
  clipPos.z += LAYER_DEPTH_OFFSET * clipPos.w;

  output.clipPosition = clipPos;

  // Normal: globe tangent frame vs flat (match 2D mode in flat path)
  let globeNormal = normalize(tangentMatrix * (rotMat * input.normal));
  let flatNormal = normalize(rotMat * input.normal);
  if (camera.projectionTransition >= 0.999) {
    output.vNormal = globeNormal;
  } else if (camera.projectionTransition <= 0.001) {
    output.vNormal = flatNormal;
  } else {
    output.vNormal = normalize(mix(flatNormal, globeNormal, camera.projectionTransition));
  }
  output.vTexcoord = input.texcoord;
  output.vWorldPos = globeFinal;
  output.clipDot = dot(spherePos, camera.clippingPlane.xyz) + camera.clippingPlane.w;

  return output;
}

// ─── PBR Helpers ───

fn distributionGGX(NdotH: f32, roughness: f32) -> f32 {
  let a = roughness * roughness;
  let a2 = a * a;
  let d = NdotH * NdotH * (a2 - 1.0) + 1.0;
  return a2 / (PI * d * d + 0.0001);
}

fn geometrySchlickGGX(NdotV: f32, roughness: f32) -> f32 {
  let r = roughness + 1.0;
  let k = (r * r) / 8.0;
  return NdotV / (NdotV * (1.0 - k) + k);
}

fn geometrySmith(NdotV: f32, NdotL: f32, roughness: f32) -> f32 {
  return geometrySchlickGGX(NdotV, roughness) * geometrySchlickGGX(NdotL, roughness);
}

fn fresnelSchlick(cosTheta: f32, F0: vec3<f32>) -> vec3<f32> {
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
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
  // Horizon occlusion
  if (camera.projectionTransition > 0.01 && input.clipDot < -0.01) { discard; }

  // ─── Depth Debug Visualization (tintColor.a==0 sentinel) ───
  // R/G: log-scale gradient magnitude (red=z-fight risk, green=healthy spread).
  // B: actual NDC depth value (dark=near, bright=far). Lets you see whether
  // depth is pinned at ~1.0 (clamped) or varying normally. Near-uniform green
  // with a blue gradient = healthy. Solid red = total depth collapse.
  if (material.tintColor.a == 0.0) {
    let d = input.clipPosition.z;
    let grad = length(vec2<f32>(dpdx(d), dpdy(d)));
    let logGrad = clamp((log2(grad + 1e-10) + 26.6) / 13.3, 0.0, 1.0);
    return vec4<f32>(1.0 - logGrad, logGrad, d, 1.0);
  }

  let uv = input.vTexcoord;

  // Base Color
  var baseColor = material.baseColorFactor;
  if (material.hasBaseColorTex > 0.5) {
    baseColor = baseColor * textureSample(baseColorTex, texSampler, uv);
  }
  baseColor = vec4<f32>(baseColor.rgb * material.tintColor.rgb, baseColor.a * material.tintColor.a);

  if (material.alphaCutoff > 0.0 && baseColor.a < material.alphaCutoff) { discard; }

  // KHR_materials_unlit: skip all lighting
  if (material.isUnlit > 0.5) { return baseColor; }

  // Normal (flip for back-faces on double-sided materials)
  var N = normalize(input.vNormal);
  if (!frontFacing) { N = -N; }

  // Metallic / Roughness
  var metallic = material.metallic;
  var roughness = material.roughness;
  if (material.hasMetallicRoughnessTex > 0.5) {
    let mrSample = textureSample(metallicRoughnessTex, texSampler, uv);
    roughness = roughness * mrSample.g;
    metallic = metallic * mrSample.b;
  }
  roughness = clamp(roughness, 0.04, 1.0);

  // PBR Lighting — view direction computed per-pixel from globe position
  // (same pattern as globe-extrusion-pipeline: -worldPos = outward from globe center ≈ toward camera)
  let lightDir = normalize(vec3<f32>(0.5, 0.8, 0.6));
  let viewDir = normalize(-input.vWorldPos);
  let H = normalize(lightDir + viewDir);

  let NdotL = max(dot(N, lightDir), 0.0);
  let NdotV = max(dot(N, viewDir), 0.001);
  let NdotH = max(dot(N, H), 0.0);
  let HdotV = max(dot(H, viewDir), 0.0);

  let F0 = mix(vec3<f32>(0.04), baseColor.rgb, metallic);
  let D = distributionGGX(NdotH, roughness);
  let G = geometrySmith(NdotV, NdotL, roughness);
  let F = fresnelSchlick(HdotV, F0);

  let specular = (D * G * F) / (4.0 * NdotV * NdotL + 0.0001);
  let kD = (vec3<f32>(1.0) - F) * (1.0 - metallic);
  let diffuse = kD * baseColor.rgb / PI;

  var color = (diffuse + specular) * NdotL;
  color += 0.15 * baseColor.rgb;

  if (material.hasOcclusionTex > 0.5) {
    color = color * textureSample(occlusionTex, texSampler, uv).r;
  }

  var emissive = material.emissiveFactor;
  if (material.hasEmissiveTex > 0.5) {
    emissive = emissive * textureSample(emissiveTex, texSampler, uv).rgb;
  }
  color += emissive;
  color = applyOutline(color, material.outlineColor, material.outlineWidth, NdotV);

  return vec4<f32>(color, baseColor.a);
}
`;

export interface GlobeModelPipeline {
  pipeline: GPURenderPipeline;
  materialBindGroupLayout: GPUBindGroupLayout;
  sampler: GPUSampler;
}

export interface GlobeModelPipelineDescriptor {
  device: GPUDevice;
  colorFormat: GPUTextureFormat;
  globeCameraBindGroupLayout: GPUBindGroupLayout;
  depthFormat: GPUTextureFormat;
  depthCompare?: GPUCompareFunction;
  sampleCount?: number;
}

export function createGlobeModelBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'globe-model-material-bind-group-layout',
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

export function createGlobeModelPipeline(desc: GlobeModelPipelineDescriptor): GlobeModelPipeline {
  const { device, colorFormat, globeCameraBindGroupLayout, depthFormat, depthCompare } = desc;

  const materialBindGroupLayout = createGlobeModelBindGroupLayout(device);

  const pipelineLayout = device.createPipelineLayout({
    label: 'globe-model-pipeline-layout',
    bindGroupLayouts: [globeCameraBindGroupLayout, materialBindGroupLayout],
  });

  const shaderModule = device.createShaderModule({
    label: 'globe-model-shader',
    code: GLOBE_MODEL_SHADER_SOURCE,
  });

  const pipeline = device.createRenderPipeline({
    label: 'globe-model-pipeline',
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
      buffers: [
        {
          arrayStride: 32,
          stepMode: 'vertex' as GPUVertexStepMode,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x3' as GPUVertexFormat },
            { shaderLocation: 1, offset: 12, format: 'float32x3' as GPUVertexFormat },
            { shaderLocation: 2, offset: 24, format: 'float32x2' as GPUVertexFormat },
          ],
        },
        {
          arrayStride: 32,
          stepMode: 'instance' as GPUVertexStepMode,
          attributes: [
            { shaderLocation: 3, offset: 0, format: 'float32x3' as GPUVertexFormat },
            { shaderLocation: 4, offset: 12, format: 'float32x2' as GPUVertexFormat },
            { shaderLocation: 5, offset: 20, format: 'float32x3' as GPUVertexFormat },
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
    label: 'globe-model-sampler',
    magFilter: 'linear',
    minFilter: 'linear',
    mipmapFilter: 'linear',
    addressModeU: 'repeat',
    addressModeV: 'repeat',
  });

  return { pipeline, materialBindGroupLayout, sampler };
}
