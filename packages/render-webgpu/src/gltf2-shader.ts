/**
 * GLTF2 Shaders — Correct PBR rendering with standard depth buffer.
 *
 * Key differences from old model-pipeline/globe-model-pipeline:
 * - 2D flat mode remaps height into depth so elevated models stay visible
 * - Per-pixel view direction (not hardcoded)
 * - front_facing normal flip for doubleSided materials
 * - Globe mode uses same tangent-frame projection but preserves GPU depth
 *
 * References:
 * - Toji WebGPU glTF case study: standard camera.projection * camera.view * model.matrix
 * - Three.js WebGPU: per-pixel viewDir = normalize(cameraPos - worldPos)
 * - mapgpu globe-extrusion-pipeline: globe viewDir = normalize(-worldPos)
 */

import { WGSL_CAMERA_UNIFORMS, WGSL_GLOBE_HEIGHT_SEMANTICS, WGSL_GLOBE_PREAMBLE } from './pipelines/wgsl-preambles.js';

// ─── 2D (Flat) Model Shader ───

export const GLTF2_FLAT_SHADER = /* wgsl */ `
${WGSL_CAMERA_UNIFORMS}

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
  nodeMatrix: mat4x4<f32>,
  nodeNormalMatrix: mat4x4<f32>,
};

@group(1) @binding(0) var<uniform> material: ModelMaterial;
@group(1) @binding(1) var texSampler: sampler;
@group(1) @binding(2) var baseColorTex: texture_2d<f32>;
@group(1) @binding(3) var normalTex: texture_2d<f32>;
@group(1) @binding(4) var metallicRoughnessTex: texture_2d<f32>;
@group(1) @binding(5) var occlusionTex: texture_2d<f32>;
@group(1) @binding(6) var emissiveTex: texture_2d<f32>;

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
};

fn degreesToRadians(d: f32) -> f32 { return d * 3.14159265 / 180.0; }

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

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  let scale = input.scaleHeading.x;
  let heading = input.scaleHeading.y;
  let pitch = input.pitchRollAnchor.x;
  let roll = input.pitchRollAnchor.y;
  let anchorZ = input.pitchRollAnchor.z;

  let gltfPosition = (material.nodeMatrix * vec4<f32>(input.position, 1.0)).xyz;
  let gltfNormal = normalize((material.nodeNormalMatrix * vec4<f32>(input.normal, 0.0)).xyz);
  // glTF assets are Y-up by convention; mapgpu's model symbol math expects Z-up.
  let nodePosition = vec3<f32>(gltfPosition.x, -gltfPosition.z, gltfPosition.y);
  let nodeNormal = normalize(vec3<f32>(gltfNormal.x, -gltfNormal.z, gltfNormal.y));
  let rotMat = eulerToRotationMatrix(heading, pitch, roll);
  let mercatorScale = mercatorMetersPerMeter(input.worldPos.y);
  let rotated = rotMat * (nodePosition * (scale * mercatorScale));
  let relativeOrigin = input.worldPos - camera.worldOrigin.xyz;
  let projectedWorldPos = relativeOrigin + vec3<f32>(rotated.x, rotated.y, 0.0);
  let heightMeters = input.worldPos.z + anchorZ + rotated.z / max(mercatorScale, 0.01);
  let worldPos = vec3<f32>(projectedWorldPos.x, projectedWorldPos.y, heightMeters);

  output.clipPosition = camera.relativeViewProjection * vec4<f32>(projectedWorldPos, 1.0);
  let absH = abs(heightMeters);
  let logH = log2(max(absH, 0.1) + 1.0);
  let logMax = log2(1001.0);
  let normalizedZ = clamp(0.5 - logH / (2.0 * logMax), 0.01, 0.99);
  output.clipPosition.z = max(0.0, normalizedZ - 0.001) * output.clipPosition.w;
  output.vNormal = normalize(rotMat * nodeNormal);
  output.vTexcoord = input.texcoord;
  output.vWorldPos = worldPos;

  return output;
}

// ─── PBR Helpers ───

const PI: f32 = 3.14159265358979;
const EARTH_RADIUS_M: f32 = 6378137.0;

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

fn encodeOutputColor(color: vec3<f32>) -> vec3<f32> {
  return pow(clamp(color, vec3<f32>(0.0), vec3<f32>(1.0)), vec3<f32>(1.0 / 2.2));
}

fn mercatorMetersPerMeter(mercatorY: f32) -> f32 {
  let lat = atan(exp(mercatorY / EARTH_RADIUS_M)) * 2.0 - PI * 0.5;
  return 1.0 / max(cos(lat), 0.01);
}

@fragment
fn fs_main(input: VertexOutput, @builtin(front_facing) frontFacing: bool) -> @location(0) vec4<f32> {
  let uv = input.vTexcoord;

  // Base color
  var baseColor = material.baseColorFactor;
  if (material.hasBaseColorTex > 0.5) {
    baseColor = baseColor * textureSample(baseColorTex, texSampler, uv);
  }
  baseColor = vec4<f32>(baseColor.rgb * material.tintColor.rgb, baseColor.a * material.tintColor.a);

  let alphaCutoff = max(material.alphaCutoff, 0.0);
  let finalAlpha = select(baseColor.a, 1.0, material.alphaCutoff != 0.0);

  if (alphaCutoff > 0.0 && baseColor.a < alphaCutoff) { discard; }
  if (material.isUnlit > 0.5) { return vec4<f32>(encodeOutputColor(baseColor.rgb), finalAlpha); }

  // Normal — flip for back-faces (doubleSided materials)
  var N = normalize(input.vNormal);
  if (!frontFacing) { N = -N; }

  if (material.hasNormalTex > 0.5) {
    let tangentNormal = textureSample(normalTex, texSampler, uv).rgb * 2.0 - 1.0;
    let dpdx_val = dpdx(input.vWorldPos);
    let dpdy_val = dpdy(input.vWorldPos);
    let dudx = dpdx(uv);
    let dvdy = dpdy(uv);
    let T = normalize(dpdx_val * dvdy.y - dpdy_val * dudx.y);
    let B = normalize(cross(N, T));
    let TBN = mat3x3<f32>(T, B, N);
    N = normalize(TBN * tangentNormal);
  }

  // PBR parameters
  var metallic = material.metallic;
  var roughness = material.roughness;
  if (material.hasMetallicRoughnessTex > 0.5) {
    let mrSample = textureSample(metallicRoughnessTex, texSampler, uv);
    roughness = roughness * mrSample.g;
    metallic = metallic * mrSample.b;
  }
  roughness = clamp(roughness, 0.04, 1.0);

  // Lighting — top-down view direction for 2D map mode
  let lightDir = normalize(vec3<f32>(0.35, 0.52, 0.78));
  let fillLightDir = normalize(vec3<f32>(-0.28, -0.18, 0.94));
  let viewDir = normalize(vec3<f32>(0.0, 0.0, 1.0));
  let H = normalize(lightDir + viewDir);

  let NdotL = max(dot(N, lightDir), 0.0);
  let NdotFill = max(dot(N, fillLightDir), 0.0);
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
  let hemi = mix(
    vec3<f32>(0.14, 0.12, 0.10),
    vec3<f32>(0.58, 0.64, 0.76),
    clamp(N.z * 0.5 + 0.5, 0.0, 1.0),
  );

  var color = (diffuse + specular) * NdotL;
  color += diffuse * NdotFill * 0.35;
  color += hemi * baseColor.rgb * 0.45;

  if (material.hasOcclusionTex > 0.5) {
    color = color * textureSample(occlusionTex, texSampler, uv).r;
  }

  var emissive = material.emissiveFactor;
  if (material.hasEmissiveTex > 0.5) {
    emissive = emissive * textureSample(emissiveTex, texSampler, uv).rgb;
  }
  color += emissive;

  return vec4<f32>(encodeOutputColor(color), finalAlpha);
}
`;

// ─── Globe Model Shader ───

export const GLTF2_GLOBE_SHADER = /* wgsl */ `
${WGSL_GLOBE_PREAMBLE}
${WGSL_GLOBE_HEIGHT_SEMANTICS}

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
  nodeMatrix: mat4x4<f32>,
  nodeNormalMatrix: mat4x4<f32>,
};

@group(1) @binding(0) var<uniform> material: ModelMaterial;
@group(1) @binding(1) var texSampler: sampler;
@group(1) @binding(2) var baseColorTex: texture_2d<f32>;
@group(1) @binding(3) var normalTex: texture_2d<f32>;
@group(1) @binding(4) var metallicRoughnessTex: texture_2d<f32>;
@group(1) @binding(5) var occlusionTex: texture_2d<f32>;
@group(1) @binding(6) var emissiveTex: texture_2d<f32>;

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
  @location(2) vGlobePos: vec3<f32>,
  @location(3) clipDot: f32,
  @location(4) vFlatPos: vec3<f32>,
};

fn degreesToRadians(d: f32) -> f32 { return d * PI / 180.0; }

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

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  let scale = input.scaleHeading.x;
  let heading = input.scaleHeading.y;
  let pitch = input.pitchRollAnchor.x;
  let roll = input.pitchRollAnchor.y;
  let anchorZ = input.pitchRollAnchor.z;

  // Mercator → sphere
  let merc01 = epsg3857ToMerc01(input.worldPos);
  let angular = mercatorToAngular(merc01);
  let spherePos = angularToSphere(angular.x, angular.y);

  // Tangent frame
  let up = normalize(spherePos);
  var refDir = vec3<f32>(0.0, 1.0, 0.0);
  if (abs(up.y) > 0.999) { refDir = vec3<f32>(1.0, 0.0, 0.0); }
  let east = normalize(cross(refDir, up));
  let north = cross(up, east);
  // mapgpu model math uses local axes x=east, y=north, z=up.
  let tangentMatrix = mat3x3<f32>(east, north, up);

  let gltfPosition = (material.nodeMatrix * vec4<f32>(input.position, 1.0)).xyz;
  let gltfNormal = normalize((material.nodeNormalMatrix * vec4<f32>(input.normal, 0.0)).xyz);
  let nodePosition = vec3<f32>(gltfPosition.x, -gltfPosition.z, gltfPosition.y);
  let nodeNormal = normalize(vec3<f32>(gltfNormal.x, -gltfNormal.z, gltfNormal.y));
  let rotMat = eulerToRotationMatrix(heading, pitch, roll);

  // Globe model position
  let globeScale = scale / EARTH_RADIUS_M;
  let localOffset = tangentMatrix * (rotMat * (nodePosition * globeScale));
  let totalAlt = input.worldPos.z + anchorZ;
  let altFrac = totalAlt / EARTH_RADIUS_M * ALTITUDE_EXAG;
  let globeFinal = spherePos * (1.0 + altFrac) + localOffset;

  // STANDARD projection — NO depth override, NO globeClippingZ hack
  // GPU perspective depth handles model self-occlusion correctly.
  var globeClip = camera.viewProjection * vec4<f32>(globeFinal, 1.0);

  // Small depth bias so model renders above the globe surface tiles
  globeClip.z -= 0.0003 * globeClip.w;
  globeClip.z = min(globeClip.z, globeClip.w * 0.9999);

  // Flat path (for 2D↔3D transition)
  let flatMercatorScale = 1.0 / max(cos(angular.y), 0.01);
  let flatRotated = rotMat * (nodePosition * scale);
  let flatLocalScale = flatMercatorScale / (2.0 * HALF_CIRCUMFERENCE);
  let flatMerc = vec3<f32>(
    merc01.x + flatRotated.x * flatLocalScale,
    merc01.y - flatRotated.y * flatLocalScale,
    altitudeOffset(input.worldPos.z) + (flatRotated.z + anchorZ) * flatLocalScale
  );
  output.vFlatPos = flatMerc;
  var flatClip = camera.flatViewProjection * vec4<f32>(flatMerc, 1.0);

  // Blend globe ↔ flat
  var clipPos: vec4<f32>;
  if (camera.projectionTransition >= 0.999) {
    clipPos = globeClip;
  } else if (camera.projectionTransition <= 0.001) {
    clipPos = flatClip;
  } else {
    clipPos = mix(flatClip, globeClip, camera.projectionTransition);
  }

  output.clipPosition = clipPos;

  // Normal in globe tangent frame
  let globeNormal = normalize(tangentMatrix * (rotMat * nodeNormal));
  let flatNormal = normalize(rotMat * nodeNormal);
  if (camera.projectionTransition >= 0.999) {
    output.vNormal = globeNormal;
  } else if (camera.projectionTransition <= 0.001) {
    output.vNormal = flatNormal;
  } else {
    output.vNormal = normalize(mix(flatNormal, globeNormal, camera.projectionTransition));
  }

  output.vTexcoord = input.texcoord;
  output.vGlobePos = globeFinal;
  output.clipDot = dot(spherePos, camera.clippingPlane.xyz) + camera.clippingPlane.w;

  return output;
}

// ─── PBR ───

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

fn encodeOutputColor(color: vec3<f32>) -> vec3<f32> {
  return pow(clamp(color, vec3<f32>(0.0), vec3<f32>(1.0)), vec3<f32>(1.0 / 2.2));
}

@fragment
fn fs_main(input: VertexOutput, @builtin(front_facing) frontFacing: bool) -> @location(0) vec4<f32> {
  // Horizon occlusion
  if (camera.projectionTransition > 0.01 && input.clipDot < -0.01) { discard; }

  let uv = input.vTexcoord;

  // Base color
  var baseColor = material.baseColorFactor;
  if (material.hasBaseColorTex > 0.5) {
    baseColor = baseColor * textureSample(baseColorTex, texSampler, uv);
  }
  baseColor = vec4<f32>(baseColor.rgb * material.tintColor.rgb, baseColor.a * material.tintColor.a);

  let alphaCutoff = max(material.alphaCutoff, 0.0);
  let finalAlpha = select(baseColor.a, 1.0, material.alphaCutoff != 0.0);

  if (alphaCutoff > 0.0 && baseColor.a < alphaCutoff) { discard; }
  if (material.isUnlit > 0.5) { return vec4<f32>(encodeOutputColor(baseColor.rgb), finalAlpha); }

  // Normal — flip for back-faces
  var N = normalize(input.vNormal);
  if (!frontFacing) { N = -N; }
  if (material.hasNormalTex > 0.5) {
    let tangentNormal = textureSample(normalTex, texSampler, uv).rgb * 2.0 - 1.0;
    var surfacePos = input.vFlatPos;
    if (camera.projectionTransition > 0.5) {
      surfacePos = input.vGlobePos;
    }
    let dpdx_val = dpdx(surfacePos);
    let dpdy_val = dpdy(surfacePos);
    let dudx = dpdx(uv);
    let dvdy = dpdy(uv);
    let T = normalize(dpdx_val * dvdy.y - dpdy_val * dudx.y);
    let B = normalize(cross(N, T));
    let TBN = mat3x3<f32>(T, B, N);
    N = normalize(TBN * tangentNormal);
  }

  // PBR parameters
  var metallic = material.metallic;
  var roughness = material.roughness;
  if (material.hasMetallicRoughnessTex > 0.5) {
    let mrSample = textureSample(metallicRoughnessTex, texSampler, uv);
    roughness = roughness * mrSample.g;
    metallic = metallic * mrSample.b;
  }
  roughness = clamp(roughness, 0.04, 1.0);

  let globeViewDir = normalize(camera.cameraWorld.xyz - input.vGlobePos);
  let flatViewDir = normalize(camera.cameraMerc01.xyz - input.vFlatPos);
  let viewDir = normalize(mix(flatViewDir, globeViewDir, camera.projectionTransition));

  // Light direction — sun-like, slightly from above-right
  let lightDir = normalize(vec3<f32>(0.34, 0.82, 0.46));
  let fillLightDir = normalize(vec3<f32>(-0.52, 0.18, 0.84));
  let H = normalize(lightDir + viewDir);

  let NdotL = max(dot(N, lightDir), 0.0);
  let NdotFill = max(dot(N, fillLightDir), 0.0);
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
  let upDir = normalize(mix(vec3<f32>(0.0, 0.0, 1.0), normalize(input.vGlobePos), camera.projectionTransition));
  let hemi = mix(
    vec3<f32>(0.15, 0.12, 0.10),
    vec3<f32>(0.56, 0.62, 0.74),
    clamp(dot(N, upDir) * 0.5 + 0.5, 0.0, 1.0),
  );

  var color = (diffuse + specular) * NdotL;
  color += diffuse * NdotFill * 0.32;
  color += hemi * baseColor.rgb * 0.42;

  if (material.hasOcclusionTex > 0.5) {
    color = color * textureSample(occlusionTex, texSampler, uv).r;
  }

  var emissive = material.emissiveFactor;
  if (material.hasEmissiveTex > 0.5) {
    emissive = emissive * textureSample(emissiveTex, texSampler, uv).rgb;
  }
  color += emissive;

  return vec4<f32>(encodeOutputColor(color), finalAlpha);
}
`;
