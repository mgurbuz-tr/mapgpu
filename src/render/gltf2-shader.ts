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
  outlineColor: vec4<f32>,
  outlineWidth: f32,
  pivot: vec3<f32>,
  depthLift: f32,
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
  @location(2) tangent: vec4<f32>,
  @location(3) texcoord: vec2<f32>,
  @location(4) worldPos: vec3<f32>,
  @location(5) scaleHeading: vec2<f32>,
  @location(6) pitchRollAnchor: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) vNormal: vec3<f32>,
  @location(1) vTangent: vec3<f32>,
  @location(2) vTangentSign: f32,
  @location(3) vTexcoord: vec2<f32>,
  @location(4) vWorldPos: vec3<f32>,
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
  let gltfTangent = normalize((material.nodeNormalMatrix * vec4<f32>(input.tangent.xyz, 0.0)).xyz);
  // glTF assets are Y-up by convention; mapgpu's model symbol math expects Z-up.
  let nodePosition = vec3<f32>(gltfPosition.x, -gltfPosition.z, gltfPosition.y);
  let nodeNormal = normalize(vec3<f32>(gltfNormal.x, -gltfNormal.z, gltfNormal.y));
  let nodeTangent = normalize(vec3<f32>(gltfTangent.x, -gltfTangent.z, gltfTangent.y));
  let rotMat = eulerToRotationMatrix(heading, pitch, roll);
  let mercatorScale = mercatorMetersPerMeter(input.worldPos.y);
  let mercScale = scale * mercatorScale;
  // Rotate around pivot point (pivot stays fixed in world, rest swings around it).
  // At identity rotation, this equals (nodePosition * mercScale) — pre-feature.
  let centeredPosition = nodePosition - material.pivot;
  let rotated = rotMat * (centeredPosition * mercScale) + material.pivot * mercScale;
  let relativeOrigin = input.worldPos - camera.worldOrigin.xyz;
  let projectedWorldPos = relativeOrigin + vec3<f32>(rotated.x, rotated.y, 0.0);
  let heightMeters = input.worldPos.z + anchorZ + rotated.z / max(mercatorScale, 0.01);
  let worldPos = vec3<f32>(projectedWorldPos.x, projectedWorldPos.y, heightMeters);

  output.clipPosition = camera.relativeViewProjection * vec4<f32>(projectedWorldPos, 1.0);
  // Signed log depth — every vertex maps to a distinct clip-Z, and +h / -h
  // do not collide on the same depth (previous abs()+clamp collapsed mesh's
  // upper/lower halves and sub-0.1m scales onto a single depth, causing
  // Z-fighting tears with cullMode='none').
  let logH = sign(heightMeters) * log2(abs(heightMeters) + 1.0);
  let logMax = log2(1001.0);
  let normalizedZ = clamp(0.5 - logH / (2.0 * logMax), 0.001, 0.999);
  output.clipPosition.z = max(0.0, normalizedZ - 0.0001) * output.clipPosition.w;
  output.vNormal = normalize(rotMat * nodeNormal);
  output.vTangent = normalize(rotMat * nodeTangent);
  output.vTangentSign = input.tangent.w;
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

fn mercatorMetersPerMeter(mercatorY: f32) -> f32 {
  let lat = atan(exp(mercatorY / EARTH_RADIUS_M)) * 2.0 - PI * 0.5;
  return 1.0 / max(cos(lat), 0.01);
}

@fragment
fn fs_main(input: VertexOutput, @builtin(front_facing) frontFacing: bool) -> @location(0) vec4<f32> {
  if (material.tintColor.a < 0.0) {
    let faceColor = select(
      vec3<f32>(1.0, 0.18, 0.18),
      vec3<f32>(0.18, 1.0, 0.32),
      frontFacing,
    );
    let depthTint = clamp(input.clipPosition.z / max(input.clipPosition.w, 1e-5), 0.0, 1.0);
    return vec4<f32>(mix(faceColor, vec3<f32>(0.05, 0.95, 1.0), depthTint * 0.35), 1.0);
  }

  // ─── Depth Debug Visualization ───
  // R/G: log-scale gradient magnitude (red=z-fight risk, green=healthy spread).
  // B: actual NDC depth (dark=near, bright=far). Shows whether depth is
  // pinned at ~1 (clamped) or spreading. Solid red = total depth collapse.
  if (material.tintColor.a == 0.0) {
    let d = input.clipPosition.z;
    let grad = length(vec2<f32>(dpdx(d), dpdy(d)));
    let logGrad = clamp((log2(grad + 1e-10) + 26.6) / 13.3, 0.0, 1.0);
    return vec4<f32>(1.0 - logGrad, logGrad, d, 1.0);
  }

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

  let faceSign = select(-1.0, 1.0, frontFacing);
  var N = normalize(input.vNormal) * faceSign;
  if (material.hasNormalTex > 0.5) {
    let tangentNormal = textureSample(normalTex, texSampler, uv).xyz * 2.0 - 1.0;
    var T = (input.vTangent * faceSign) - N * dot(N, input.vTangent * faceSign);
    let tangentLength = length(T);
    if (tangentLength > 1e-5) {
      T = T / tangentLength;
      let B = normalize(cross(N, T)) * input.vTangentSign;
      N = normalize(T * tangentNormal.x + B * tangentNormal.y + N * tangentNormal.z);
    }
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

export const GLTF2_FLAT_OUTLINE_SHADER = /* wgsl */ `
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
  outlineColor: vec4<f32>,
  outlineWidth: f32,
  pivot: vec3<f32>,
  depthLift: f32,
  nodeMatrix: mat4x4<f32>,
  nodeNormalMatrix: mat4x4<f32>,
};

@group(1) @binding(0) var<uniform> material: ModelMaterial;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) tangent: vec4<f32>,
  @location(3) texcoord: vec2<f32>,
  @location(4) worldPos: vec3<f32>,
  @location(5) scaleHeading: vec2<f32>,
  @location(6) pitchRollAnchor: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
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

const PI: f32 = 3.14159265358979;
const EARTH_RADIUS_M: f32 = 6378137.0;

fn mercatorMetersPerMeter(mercatorY: f32) -> f32 {
  let lat = atan(exp(mercatorY / EARTH_RADIUS_M)) * 2.0 - PI * 0.5;
  return 1.0 / max(cos(lat), 0.01);
}

// MUST stay in sync with GLTF2_FLAT_SHADER vs_main — only difference is
// 'expandedPosition' (shell offset along normal) instead of 'nodePosition'.
// Any change to the main shader's vertex transform must be mirrored here,
// otherwise outline drifts from the mesh under camera motion.
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
  let nodePosition = vec3<f32>(gltfPosition.x, -gltfPosition.z, gltfPosition.y);
  let nodeNormal = normalize(vec3<f32>(gltfNormal.x, -gltfNormal.z, gltfNormal.y));
  let shellThickness = material.outlineWidth * 0.0025;
  let centeredPosition = nodePosition - material.pivot;
  let expandedPosition = centeredPosition + nodeNormal * shellThickness;

  let rotMat = eulerToRotationMatrix(heading, pitch, roll);
  let mercatorScale = mercatorMetersPerMeter(input.worldPos.y);
  let mercScale = scale * mercatorScale;
  let rotated = rotMat * (expandedPosition * mercScale) + material.pivot * mercScale;
  let relativeOrigin = input.worldPos - camera.worldOrigin.xyz;
  let projectedWorldPos = relativeOrigin + vec3<f32>(rotated.x, rotated.y, 0.0);
  let heightMeters = input.worldPos.z + anchorZ + rotated.z / max(mercatorScale, 0.01);

  output.clipPosition = camera.relativeViewProjection * vec4<f32>(projectedWorldPos, 1.0);
  // Mirror of FLAT_SHADER signed-log depth math; offset 1.5× of main shader
  // so outline stays in front of the mesh under camera motion.
  let logH = sign(heightMeters) * log2(abs(heightMeters) + 1.0);
  let logMax = log2(1001.0);
  let normalizedZ = clamp(0.5 - logH / (2.0 * logMax), 0.001, 0.999);
  output.clipPosition.z = max(0.0, normalizedZ - 0.00015) * output.clipPosition.w;

  return output;
}

@fragment
fn fs_main() -> @location(0) vec4<f32> {
  return vec4<f32>(material.outlineColor.rgb, material.outlineColor.a);
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
  outlineColor: vec4<f32>,
  outlineWidth: f32,
  pivot: vec3<f32>,
  depthLift: f32,
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
  @location(2) tangent: vec4<f32>,
  @location(3) texcoord: vec2<f32>,
  @location(4) worldPos: vec3<f32>,
  @location(5) scaleHeading: vec2<f32>,
  @location(6) pitchRollAnchor: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) vNormal: vec3<f32>,
  @location(1) vTangent: vec3<f32>,
  @location(2) vTangentSign: f32,
  @location(3) vTexcoord: vec2<f32>,
  @location(4) vGlobePos: vec3<f32>,
  @location(5) clipDot: f32,
  @location(6) vFlatPos: vec3<f32>,
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
  let gltfTangent = normalize((material.nodeNormalMatrix * vec4<f32>(input.tangent.xyz, 0.0)).xyz);
  let nodePosition = vec3<f32>(gltfPosition.x, -gltfPosition.z, gltfPosition.y);
  let nodeNormal = normalize(vec3<f32>(gltfNormal.x, -gltfNormal.z, gltfNormal.y));
  let nodeTangent = normalize(vec3<f32>(gltfTangent.x, -gltfTangent.z, gltfTangent.y));
  let rotMat = eulerToRotationMatrix(heading, pitch, roll);
  let centeredPosition = nodePosition - material.pivot;

  // Globe model position — rotate around pivot, pivot stays fixed.
  let globeScale = scale / EARTH_RADIUS_M;
  let localOffset = tangentMatrix * (rotMat * (centeredPosition * globeScale) + material.pivot * globeScale);
  let totalAlt = input.worldPos.z + anchorZ;
  let altFrac = totalAlt / EARTH_RADIUS_M * ALTITUDE_EXAG;
  let spherePart = spherePos * (1.0 + altFrac);

  // RTE (Relative-To-Eye) precision: subtract camera's sphere-space eye
  // position BEFORE projection. VP is linear so
  //   VP*(x, 1) == VP*(x - eye, 0) + VP*(eye, 1)
  // The first term receives only a small-magnitude vector (model-sized, not
  // earth-sized) and thus preserves vertex-to-vertex depth separation in f32.
  // Required because mere VP-splitting of (spherePart, localOffset) can still
  // lose sub-metre vertex deltas once Z/W lands on a far-plane NDC band.
  let eyeSphere = camera.cameraWorld.xyz;
  let relativePos = (spherePart - eyeSphere) + localOffset;
  var globeClip = camera.viewProjection * vec4<f32>(relativePos, 0.0)
                + camera.viewProjection * vec4<f32>(eyeSphere, 1.0);

  // Architectural redesign (Phase 2): depthShift hack'i kaldırıldı. Model artık
  // doğal GPU perspective depth kullanıyor (reverse-Z formatında). globeClippingZ
  // SADECE horizon visibility (clipDot) için — depth override için değil. Terrain
  // ve diğer globe layer'ları da aynı perspective Z'de yazdığı için doğal ordering.

  // Flat path — yuksek zoom seviyelerinde terrain ile ayni Mercator projection
  // paylasimi icin drift'i onler. flatViewProjection Scale(1,-1,1) Y-flip ile
  // winding CCW->CW donusumu yapar; flatRotated.y pre-negate ederek bu flip'i
  // compensate ederiz. Iki Y-negasyon det=+1 ve winding CCW'de kalir, cullMode
  // 'back' yanlis culle etmez.
  let flatMercatorScale = 1.0 / max(cos(angular.y), 0.01);
  let flatRotated = rotMat * (centeredPosition * scale) + material.pivot * scale;
  let flatLocalScale = flatMercatorScale / (2.0 * HALF_CIRCUMFERENCE);
  // Y pre-negation: flatViewProjection'ın Scale(1,-1,1) column-1 flip'ini compensate
  // eder. İki negasyon birlikte det=+1 → triangle winding korunur, cullMode='back'
  // GLTF'yi yanlış culle etmez.
  let flatMerc = vec3<f32>(
    merc01.x + flatRotated.x * flatLocalScale,
    merc01.y + flatRotated.y * flatLocalScale,
    altitudeOffset(input.worldPos.z) + (flatRotated.z + anchorZ) * flatLocalScale
  );
  output.vFlatPos = flatMerc;
  var flatClip = camera.flatViewProjection * vec4<f32>(flatMerc, 1.0);
  // flatViewProjection zaten reverse-Z üretir + Scale(1,-1,1) Y-flip içerir.
  flatClip.z += 0.001 * flatClip.w;

  const LAYER_DEPTH_OFFSET: f32 = 0.0003;

  // Projection transition'a göre clipPos seçimi: high zoom (transition=0) flat,
  // düşük zoom (transition=1) globe, arası animasyon için mix.
  var clipPos: vec4<f32>;
  if (camera.projectionTransition >= 0.999) {
    clipPos = globeClip;
  } else if (camera.projectionTransition <= 0.001) {
    clipPos = flatClip;
  } else {
    clipPos = mix(flatClip, globeClip, camera.projectionTransition);
  }
  // Reverse-Z: + işareti objeyi kameraya YAKIN tarafa kaydırır.
  clipPos.z += LAYER_DEPTH_OFFSET * clipPos.w;
  output.clipPosition = clipPos;

  // Normal: her zaman globe tangent frame'i (clipPos globeClip olduğu için).
  let globeNormal = normalize(tangentMatrix * (rotMat * nodeNormal));
  let globeTangent = normalize(tangentMatrix * (rotMat * nodeTangent));
  let flatNormal = normalize(rotMat * nodeNormal);
  let flatTangent = normalize(rotMat * nodeTangent);
  if (camera.projectionTransition >= 0.999) {
    output.vNormal = globeNormal;
  } else if (camera.projectionTransition <= 0.001) {
    output.vNormal = flatNormal;
  } else {
    output.vNormal = normalize(mix(flatNormal, globeNormal, camera.projectionTransition));
  }
  if (camera.projectionTransition >= 0.999) {
    output.vTangent = globeTangent;
  } else if (camera.projectionTransition <= 0.001) {
    output.vTangent = flatTangent;
  } else {
    output.vTangent = normalize(mix(flatTangent, globeTangent, camera.projectionTransition));
  }
  output.vTangentSign = input.tangent.w;
  output.vTexcoord = input.texcoord;
  // vGlobePos uses spherePart (instance anchor) instead of globeFinal to
  // avoid f32 precision loss at small scale values. localOffset is ~1e-4 at
  // scale=10 which disappears into the f32 mantissa of a ~1.0 magnitude
  // spherePart. The approximation is acceptable because the model is tiny
  // relative to the camera distance — view direction is effectively constant
  // across the model. Fragment lighting still varies per-vertex via vNormal.
  output.vGlobePos = spherePart;
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

@fragment
fn fs_main(input: VertexOutput, @builtin(front_facing) frontFacing: bool) -> @location(0) vec4<f32> {
  // Keep horizon discard gated by projectionTransition like the legacy globe
  // model shader. Some camera states report projectionTransition=0 even in
  // the globe renderer path, and unconditional discard can wrongly clip the
  // visible half of the model near the horizon.
  if (camera.projectionTransition > 0.01 && input.clipDot < -0.01) { discard; }

  if (material.tintColor.a < 0.0) {
    let faceColor = select(
      vec3<f32>(1.0, 0.18, 0.18),
      vec3<f32>(0.18, 1.0, 0.32),
      frontFacing,
    );
    let depthTint = clamp(input.clipPosition.z / max(input.clipPosition.w, 1e-5), 0.0, 1.0);
    return vec4<f32>(mix(faceColor, vec3<f32>(0.05, 0.95, 1.0), depthTint * 0.35), 1.0);
  }

  // ─── Depth Debug Visualization (tintColor.a==0 sentinel) ───
  // R/G: log-scale gradient magnitude (red=z-fight risk, green=healthy spread).
  // B: actual NDC depth (dark=near, bright=far). Solid red = depth collapse.
  if (material.tintColor.a == 0.0) {
    let d = input.clipPosition.z;
    let grad = length(vec2<f32>(dpdx(d), dpdy(d)));
    let logGrad = clamp((log2(grad + 1e-10) + 26.6) / 13.3, 0.0, 1.0);
    return vec4<f32>(1.0 - logGrad, logGrad, d, 1.0);
  }

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

  let faceSign = select(-1.0, 1.0, frontFacing);
  var N = normalize(input.vNormal) * faceSign;
  if (material.hasNormalTex > 0.5) {
    let tangentNormal = textureSample(normalTex, texSampler, uv).xyz * 2.0 - 1.0;
    var T = (input.vTangent * faceSign) - N * dot(N, input.vTangent * faceSign);
    let tangentLength = length(T);
    if (tangentLength > 1e-5) {
      T = T / tangentLength;
      let B = normalize(cross(N, T)) * input.vTangentSign;
      N = normalize(T * tangentNormal.x + B * tangentNormal.y + N * tangentNormal.z);
    }
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

export const GLTF2_GLOBE_OUTLINE_SHADER = /* wgsl */ `
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
  outlineColor: vec4<f32>,
  outlineWidth: f32,
  pivot: vec3<f32>,
  depthLift: f32,
  nodeMatrix: mat4x4<f32>,
  nodeNormalMatrix: mat4x4<f32>,
};

@group(1) @binding(0) var<uniform> material: ModelMaterial;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) tangent: vec4<f32>,
  @location(3) texcoord: vec2<f32>,
  @location(4) worldPos: vec3<f32>,
  @location(5) scaleHeading: vec2<f32>,
  @location(6) pitchRollAnchor: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) clipDot: f32,
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

// MUST stay in sync with GLTF2_GLOBE_SHADER vs_main — only differences are
// 'expandedPosition' (shell offset along normal) instead of 'nodePosition',
// and a slightly larger depth bias so the outline renders just in front of
// the mesh. Any change to the main shader's flat/globe blend must be
// mirrored here, otherwise the outline drifts under camera motion or in
// 2D ↔ 3D transition.
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
  let tangentMatrix = mat3x3<f32>(east, north, up);

  let gltfPosition = (material.nodeMatrix * vec4<f32>(input.position, 1.0)).xyz;
  let gltfNormal = normalize((material.nodeNormalMatrix * vec4<f32>(input.normal, 0.0)).xyz);
  let nodePosition = vec3<f32>(gltfPosition.x, -gltfPosition.z, gltfPosition.y);
  let nodeNormal = normalize(vec3<f32>(gltfNormal.x, -gltfNormal.z, gltfNormal.y));
  let shellThickness = material.outlineWidth * 0.0025;
  let centeredPosition = nodePosition - material.pivot;
  let expandedPosition = centeredPosition + nodeNormal * shellThickness;

  let rotMat = eulerToRotationMatrix(heading, pitch, roll);

  // Globe model position — rotate around pivot, pivot fixed in world.
  let globeScale = scale / EARTH_RADIUS_M;
  let localOffset = tangentMatrix * (rotMat * (expandedPosition * globeScale) + material.pivot * globeScale);
  let totalAlt = input.worldPos.z + anchorZ;
  let altFrac = totalAlt / EARTH_RADIUS_M * ALTITUDE_EXAG;
  let spherePart = spherePos * (1.0 + altFrac);

  // RTE (Relative-To-Eye) precision. Mirrors GLTF2_GLOBE_SHADER:
  //   VP*(x, 1) == VP*(x - eye, 0) + VP*(eye, 1)
  let eyeSphere = camera.cameraWorld.xyz;
  let relativePos = (spherePart - eyeSphere) + localOffset;
  var globeClip = camera.viewProjection * vec4<f32>(relativePos, 0.0)
                + camera.viewProjection * vec4<f32>(eyeSphere, 1.0);

  // Phase 2 redesign: depthShift hack kaldırıldı — saf GPU perspective depth.

  let flatMercatorScale = 1.0 / max(cos(angular.y), 0.01);
  let flatRotated = rotMat * (expandedPosition * scale) + material.pivot * scale;
  let flatLocalScale = flatMercatorScale / (2.0 * HALF_CIRCUMFERENCE);
  // Y pre-negation compensates flatViewProjection Scale(1,-1,1) flip → winding korunur.
  let flatMerc = vec3<f32>(
    merc01.x + flatRotated.x * flatLocalScale,
    merc01.y + flatRotated.y * flatLocalScale,
    altitudeOffset(input.worldPos.z) + (flatRotated.z + anchorZ) * flatLocalScale
  );
  var flatClip = camera.flatViewProjection * vec4<f32>(flatMerc, 1.0);
  flatClip.z += 0.001 * flatClip.w;

  const LAYER_DEPTH_OFFSET: f32 = 0.0003;
  // Projection transition'a göre clipPos: high zoom=flat (terrain ile align), düşük=globe.
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
  output.clipDot = dot(spherePos, camera.clippingPlane.xyz) + camera.clippingPlane.w;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  if (camera.projectionTransition > 0.01 && input.clipDot < -0.01) { discard; }
  return vec4<f32>(material.outlineColor.rgb, material.outlineColor.a);
}
`;

// ─── Silhouette Mask Shaders ───
//
// These shaders write the model's pixel coverage to an offscreen single-
// channel mask texture. A subsequent post-process pass runs Sobel edge
// detection on that mask and composites the result onto the swap chain to
// produce a screen-space outline (Cesium-style silhouette).
//
// Vertex transform MUST stay in sync with the corresponding main shader
// (GLTF2_FLAT_SHADER / GLTF2_GLOBE_SHADER). The only intentional difference
// is the fragment output: the mask shader returns a constant 1.0, since the
// goal is to mark "this pixel is covered by the model" without computing PBR.

export const GLTF2_FLAT_MASK_SHADER = /* wgsl */ `
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
  outlineColor: vec4<f32>,
  outlineWidth: f32,
  pivot: vec3<f32>,
  depthLift: f32,
  nodeMatrix: mat4x4<f32>,
  nodeNormalMatrix: mat4x4<f32>,
};

@group(1) @binding(0) var<uniform> material: ModelMaterial;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) tangent: vec4<f32>,
  @location(3) texcoord: vec2<f32>,
  @location(4) worldPos: vec3<f32>,
  @location(5) scaleHeading: vec2<f32>,
  @location(6) pitchRollAnchor: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
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

const PI: f32 = 3.14159265358979;
const EARTH_RADIUS_M: f32 = 6378137.0;

fn mercatorMetersPerMeter(mercatorY: f32) -> f32 {
  let lat = atan(exp(mercatorY / EARTH_RADIUS_M)) * 2.0 - PI * 0.5;
  return 1.0 / max(cos(lat), 0.01);
}

// MUST stay in sync with GLTF2_FLAT_SHADER vs_main.
@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  let scale = input.scaleHeading.x;
  let heading = input.scaleHeading.y;
  let pitch = input.pitchRollAnchor.x;
  let roll = input.pitchRollAnchor.y;
  let anchorZ = input.pitchRollAnchor.z;

  let gltfPosition = (material.nodeMatrix * vec4<f32>(input.position, 1.0)).xyz;
  let nodePosition = vec3<f32>(gltfPosition.x, -gltfPosition.z, gltfPosition.y);

  let rotMat = eulerToRotationMatrix(heading, pitch, roll);
  let mercatorScale = mercatorMetersPerMeter(input.worldPos.y);
  let mercScale = scale * mercatorScale;
  // Rotate around pivot point (pivot stays fixed in world, rest swings around it).
  // At identity rotation, this equals (nodePosition * mercScale) — pre-feature.
  let centeredPosition = nodePosition - material.pivot;
  let rotated = rotMat * (centeredPosition * mercScale) + material.pivot * mercScale;
  let relativeOrigin = input.worldPos - camera.worldOrigin.xyz;
  let projectedWorldPos = relativeOrigin + vec3<f32>(rotated.x, rotated.y, 0.0);
  let heightMeters = input.worldPos.z + anchorZ + rotated.z / max(mercatorScale, 0.01);

  output.clipPosition = camera.relativeViewProjection * vec4<f32>(projectedWorldPos, 1.0);
  let absH = abs(heightMeters);
  let logH = log2(max(absH, 0.1) + 1.0);
  let logMax = log2(1001.0);
  let normalizedZ = clamp(0.5 - logH / (2.0 * logMax), 0.01, 0.99);
  output.clipPosition.z = max(0.0, normalizedZ - 0.001) * output.clipPosition.w;

  return output;
}

@fragment
fn fs_main() -> @location(0) f32 {
  return 1.0;
}
`;

export const GLTF2_GLOBE_MASK_SHADER = /* wgsl */ `
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
  outlineColor: vec4<f32>,
  outlineWidth: f32,
  pivot: vec3<f32>,
  depthLift: f32,
  nodeMatrix: mat4x4<f32>,
  nodeNormalMatrix: mat4x4<f32>,
};

@group(1) @binding(0) var<uniform> material: ModelMaterial;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) tangent: vec4<f32>,
  @location(3) texcoord: vec2<f32>,
  @location(4) worldPos: vec3<f32>,
  @location(5) scaleHeading: vec2<f32>,
  @location(6) pitchRollAnchor: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) clipDot: f32,
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

// MUST stay in sync with GLTF2_GLOBE_SHADER vs_main.
@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  let scale = input.scaleHeading.x;
  let heading = input.scaleHeading.y;
  let pitch = input.pitchRollAnchor.x;
  let roll = input.pitchRollAnchor.y;
  let anchorZ = input.pitchRollAnchor.z;

  let merc01 = epsg3857ToMerc01(input.worldPos);
  let angular = mercatorToAngular(merc01);
  let spherePos = angularToSphere(angular.x, angular.y);

  let up = normalize(spherePos);
  var refDir = vec3<f32>(0.0, 1.0, 0.0);
  if (abs(up.y) > 0.999) { refDir = vec3<f32>(1.0, 0.0, 0.0); }
  let east = normalize(cross(refDir, up));
  let north = cross(up, east);
  let tangentMatrix = mat3x3<f32>(east, north, up);

  let gltfPosition = (material.nodeMatrix * vec4<f32>(input.position, 1.0)).xyz;
  let nodePosition = vec3<f32>(gltfPosition.x, -gltfPosition.z, gltfPosition.y);

  let rotMat = eulerToRotationMatrix(heading, pitch, roll);
  let centeredPosition = nodePosition - material.pivot;
  let globeScale = scale / EARTH_RADIUS_M;
  let localOffset = tangentMatrix * (rotMat * (centeredPosition * globeScale) + material.pivot * globeScale);
  let totalAlt = input.worldPos.z + anchorZ;
  let altFrac = totalAlt / EARTH_RADIUS_M * ALTITUDE_EXAG;
  let spherePart = spherePos * (1.0 + altFrac);

  // RTE (Relative-To-Eye) — see GLTF2_GLOBE_SHADER for rationale.
  let eyeSphere = camera.cameraWorld.xyz;
  let relativePos = (spherePart - eyeSphere) + localOffset;
  var globeClip = camera.viewProjection * vec4<f32>(relativePos, 0.0)
                + camera.viewProjection * vec4<f32>(eyeSphere, 1.0);

  // Phase 2 redesign: depthShift hack kaldırıldı — saf GPU perspective depth.

  let flatMercatorScale = 1.0 / max(cos(angular.y), 0.01);
  let flatRotated = rotMat * (centeredPosition * scale) + material.pivot * scale;
  let flatLocalScale = flatMercatorScale / (2.0 * HALF_CIRCUMFERENCE);
  // Y pre-negation compensates flatViewProjection Scale(1,-1,1) flip → winding korunur.
  let flatMerc = vec3<f32>(
    merc01.x + flatRotated.x * flatLocalScale,
    merc01.y + flatRotated.y * flatLocalScale,
    altitudeOffset(input.worldPos.z) + (flatRotated.z + anchorZ) * flatLocalScale
  );
  var flatClip = camera.flatViewProjection * vec4<f32>(flatMerc, 1.0);
  flatClip.z += 0.001 * flatClip.w;

  const LAYER_DEPTH_OFFSET: f32 = 0.0003;
  // Projection transition'a göre clipPos: high zoom=flat (terrain ile align), düşük=globe.
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
  output.clipDot = dot(spherePos, camera.clippingPlane.xyz) + camera.clippingPlane.w;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) f32 {
  if (camera.projectionTransition > 0.01 && input.clipDot < -0.01) { discard; }
  return 1.0;
}
`;
