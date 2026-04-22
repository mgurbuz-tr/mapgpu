/**
 * Sky Pipeline
 *
 * Fullscreen background pass for 3D globe views.
 * Renders gradient sky, horizon blending, and stars behind the globe.
 *
 * This pipeline is intentionally depth-free because it renders in its own
 * dedicated background pass before the main 3D scene pass begins.
 * Future volumetric clouds will append on top of the background uniforms.
 */

import { WGSL_GLOBE_CAMERA_UNIFORMS } from './wgsl-preambles.js';
import { MSAA_SAMPLE_COUNT } from '../frame-context.js';

export const SKY_BACKGROUND_UNIFORM_FLOATS = 52;
export const SKY_VOLUMETRIC_UNIFORM_FLOATS = 4;

export const SKY_SHADER_SOURCE = /* wgsl */ `
${WGSL_GLOBE_CAMERA_UNIFORMS}

struct SkyBackgroundUniforms {
  inverseGlobeViewProjection: mat4x4<f32>,
  inverseFlatViewProjection: mat4x4<f32>,
  horizonColor: vec4<f32>,
  zenithColor: vec4<f32>,
  spaceColor: vec4<f32>,
  horizonBlend: f32,
  verticalFalloff: f32,
  starIntensity: f32,
  starDensity: f32,
  starSeed: f32,
  sunAltitude: f32,
  sunAzimuth: f32,
  syncWithLighting: f32,
};

struct SkyVolumetricUniforms {
  cloudCoverage: f32,
  cloudOpacity: f32,
  cloudLayerHeight: f32,
  _pad0: f32,
};

@group(1) @binding(0) var<uniform> skyBackground: SkyBackgroundUniforms;
@group(1) @binding(1) var<uniform> skyVolumetrics: SkyVolumetricUniforms;

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) ndc: vec2<f32>,
};

const PI: f32 = 3.14159265358979323846;
const ATMOSPHERE_RAYLEIGH_COEFFICIENT: vec3<f32> = vec3<f32>(5.5e-6, 13.0e-6, 28.4e-6);
const ATMOSPHERE_MIE_COEFFICIENT: vec3<f32> = vec3<f32>(21.0e-6, 21.0e-6, 21.0e-6);
const ATMOSPHERE_RAYLEIGH_SCALE_HEIGHT: f32 = 10000.0;
const ATMOSPHERE_MIE_SCALE_HEIGHT: f32 = 3200.0;
const ATMOSPHERE_MIE_ANISOTROPY: f32 = 0.9;
const THREE_OVER_SIXTEEN_PI: f32 = 0.05968310365946075;
const ONE_OVER_FOUR_PI: f32 = 0.07957747154594767;
const SUN_CUTOFF_ANGLE: f32 = 1.6110731556870734;
const SUN_STEEPNESS: f32 = 1.5;
const SUN_ILLUMINANCE: f32 = 1000.0;

fn saturate(value: f32) -> f32 {
  return clamp(value, 0.0, 1.0);
}

fn degToRad(value: f32) -> f32 {
  return value * PI / 180.0;
}

fn safeNormalize(value: vec3<f32>, fallback: vec3<f32>) -> vec3<f32> {
  let lenSq = dot(value, value);
  if (lenSq <= 0.000001) {
    return fallback;
  }
  return value * inverseSqrt(lenSq);
}

fn hash13(inputValue: vec3<f32>) -> f32 {
  var p3 = fract(inputValue * 0.1031);
  p3 = p3 + dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn directionToSkyUv(rayDir: vec3<f32>) -> vec2<f32> {
  let dir = safeNormalize(rayDir, vec3<f32>(0.0, 1.0, 0.0));
  let phi = atan2(dir.z, dir.x);
  let theta = acos(clamp(dir.y, -1.0, 1.0));
  return vec2<f32>(phi / (2.0 * PI) + 0.5, theta / PI);
}

fn unprojectWorldPosition(inverseViewProjection: mat4x4<f32>, ndc: vec2<f32>, clipDepth: f32) -> vec3<f32> {
  let clipPosition = vec4<f32>(ndc, clipDepth, 1.0);
  let worldPosition = inverseViewProjection * clipPosition;
  let safeW = select(-1.0, 1.0, worldPosition.w >= 0.0) * max(abs(worldPosition.w), 0.0001);
  return worldPosition.xyz / safeW;
}

fn computeRayDirection(inverseViewProjection: mat4x4<f32>, ndc: vec2<f32>) -> vec3<f32> {
  let nearWorld = unprojectWorldPosition(inverseViewProjection, ndc, 0.0);
  let farWorld = unprojectWorldPosition(inverseViewProjection, ndc, 1.0);
  return normalize(farWorld - nearWorld);
}

fn computeSkyRayDirection(ndc: vec2<f32>) -> vec3<f32> {
  let globeRay = computeRayDirection(skyBackground.inverseGlobeViewProjection, ndc);
  if (camera.projectionTransition >= 0.999) {
    return globeRay;
  }

  let flatRay = computeRayDirection(skyBackground.inverseFlatViewProjection, ndc);
  if (camera.projectionTransition <= 0.001) {
    return flatRay;
  }

  return normalize(mix(flatRay, globeRay, camera.projectionTransition));
}

fn computeSkyUp() -> vec3<f32> {
  let globeUp = normalize(camera.cameraWorld.xyz);
  if (camera.projectionTransition >= 0.999) {
    return globeUp;
  }

  let flatUp = vec3<f32>(0.0, 0.0, 1.0);
  if (camera.projectionTransition <= 0.001) {
    return flatUp;
  }

  return normalize(mix(flatUp, globeUp, camera.projectionTransition));
}

fn computeSkyEast(localUp: vec3<f32>) -> vec3<f32> {
  let primaryNorth = vec3<f32>(0.0, 1.0, 0.0);
  let fallbackNorth = vec3<f32>(0.0, 0.0, 1.0);
  let east = cross(primaryNorth, localUp);
  if (dot(east, east) > 0.000001) {
    return normalize(east);
  }
  return safeNormalize(cross(fallbackNorth, localUp), vec3<f32>(1.0, 0.0, 0.0));
}

fn computeSunDirection(localUp: vec3<f32>, sunAltitude: f32, sunAzimuth: f32) -> vec3<f32> {
  let east = computeSkyEast(localUp);
  let north = safeNormalize(cross(localUp, east), vec3<f32>(0.0, 1.0, 0.0));
  let altitude = degToRad(sunAltitude);
  let azimuth = degToRad(sunAzimuth);
  let horizontalMagnitude = cos(altitude);

  return normalize(
    east * (sin(azimuth) * horizontalMagnitude) +
    north * (cos(azimuth) * horizontalMagnitude) +
    localUp * sin(altitude)
  );
}

fn rayleighPhase(cosTheta: f32) -> f32 {
  return THREE_OVER_SIXTEEN_PI * (1.0 + cosTheta * cosTheta);
}

fn hgPhase(cosTheta: f32, g: f32) -> f32 {
  let g2 = g * g;
  let inverse = 1.0 / pow(max(0.0001, 1.0 - 2.0 * g * cosTheta + g2), 1.5);
  return ONE_OVER_FOUR_PI * ((1.0 - g2) * inverse);
}

fn sunIntensity(zenithAngleCos: f32) -> f32 {
  let clamped = clamp(zenithAngleCos, -1.0, 1.0);
  return SUN_ILLUMINANCE * max(
    0.0,
    1.0 - exp(-((SUN_CUTOFF_ANGLE - acos(clamped)) / SUN_STEEPNESS)),
  );
}

fn opticalAirMass(viewZenithCos: f32) -> f32 {
  let zenithAngle = acos(max(0.0, viewZenithCos));
  let horizonTerm = max(0.001, 93.885 - (zenithAngle * 180.0 / PI));
  return 1.0 / max(0.05, cos(zenithAngle) + 0.15 * pow(horizonTerm, -1.253));
}

fn computeAtmosphericScattering(rayDir: vec3<f32>, localUp: vec3<f32>, sunDir: vec3<f32>) -> vec3<f32> {
  let sunZenithCos = dot(sunDir, localUp);
  let sunE = sunIntensity(sunZenithCos);
  let sunFade = 1.0 - clamp(1.0 - exp(sunZenithCos / 0.18), 0.0, 1.0);
  let rayleighStrength = max(0.12, 1.0 - (1.0 - sunFade) * 0.85);

  let betaR = ATMOSPHERE_RAYLEIGH_COEFFICIENT * rayleighStrength;
  let betaM = ATMOSPHERE_MIE_COEFFICIENT;

  let airMass = opticalAirMass(dot(localUp, rayDir));
  let sR = ATMOSPHERE_RAYLEIGH_SCALE_HEIGHT * airMass;
  let sM = ATMOSPHERE_MIE_SCALE_HEIGHT * airMass;
  let extinction = exp(-(betaR * sR + betaM * sM));

  let cosTheta = dot(rayDir, sunDir);
  let betaRTheta = betaR * rayleighPhase(cosTheta);
  let betaMTheta = betaM * hgPhase(cosTheta, ATMOSPHERE_MIE_ANISOTROPY);
  let scattering = (betaRTheta + betaMTheta) / max(betaR + betaM, vec3<f32>(0.000001));

  var skyLight = pow(sunE * scattering * (1.0 - extinction), vec3<f32>(1.35));
  let duskMix = clamp(pow(1.0 - max(sunZenithCos, 0.0), 5.0), 0.0, 1.0);
  let duskScatter = pow(sunE * scattering * extinction, vec3<f32>(0.5));
  skyLight *= mix(vec3<f32>(1.0), duskScatter, duskMix);

  return clamp(skyLight * 0.04, vec3<f32>(0.0), vec3<f32>(1.0));
}

fn starLayer(rayDir: vec3<f32>, scale: f32, threshold: f32, seedOffset: f32) -> f32 {
  let uv = directionToSkyUv(rayDir) * scale;
  let seededUv = uv + vec2<f32>(
    skyBackground.starSeed * (0.73 + seedOffset),
    skyBackground.starSeed * (1.11 + seedOffset * 0.37),
  );
  let cell = floor(seededUv);
  let local = fract(seededUv) - 0.5;
  let star = hash13(vec3<f32>(cell, seedOffset));
  let sparkle = hash13(vec3<f32>(cell + 11.7, seedOffset + 13.1));
  let thresholded = smoothstep(threshold, 1.0, star);
  let radius = mix(0.52, 0.16, sparkle);
  let dist = length(local);
  let halo = smoothstep(radius, 0.0, dist);
  return thresholded * pow(halo, mix(2.8, 1.1, sparkle)) * mix(0.8, 1.5, sparkle);
}

fn starField(rayDir: vec3<f32>) -> f32 {
  let primaryScale = mix(90.0, 240.0, skyBackground.starDensity);
  let secondaryScale = mix(180.0, 520.0, skyBackground.starDensity);
  let thresholdA = mix(0.975, 0.88, skyBackground.starDensity);
  let thresholdB = mix(0.99, 0.94, skyBackground.starDensity);
  let wideStars = starLayer(rayDir, primaryScale, thresholdA, 1.0);
  let denseStars = starLayer(rayDir, secondaryScale, thresholdB, 7.0);
  return wideStars * 1.35 + denseStars;
}

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var out: VertexOutput;
  let positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0),
  );
  let position = positions[vertexIndex];
  out.clipPosition = vec4<f32>(position, 0.0, 1.0);
  out.ndc = position;
  return out;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let rayDir = computeSkyRayDirection(input.ndc);
  let localUp = computeSkyUp();
  let altitude = dot(rayDir, localUp);
  let horizonWidth = mix(0.015, 0.62, pow(skyBackground.horizonBlend, 0.8));
  let aboveHorizon = smoothstep(-horizonWidth, horizonWidth, altitude);
  let falloffNorm = saturate((skyBackground.verticalFalloff - 0.4) / 2.0);
  let altitude01 = saturate(max(altitude, 0.0));
  let blendLift = mix(0.0, 0.22, skyBackground.horizonBlend);
  let liftedAltitude = saturate((altitude01 + blendLift) / (1.0 + blendLift));
  let zenithFactor = pow(liftedAltitude, mix(0.18, 2.75, falloffNorm));
  let spaceFactor = pow(zenithFactor, mix(0.8, 2.2, falloffNorm));
  let horizonBand = 1.0 - smoothstep(0.0, horizonWidth, abs(altitude));
  let horizonEnvelope = pow(
    1.0 - saturate((max(altitude, 0.0) + 0.02) / (0.08 + skyBackground.horizonBlend * 0.92)),
    mix(4.2, 0.95, skyBackground.horizonBlend),
  );
  let hazeEnvelope = pow(1.0 - altitude01, mix(0.45, 3.2, falloffNorm));

  let lightingEnabled = skyBackground.syncWithLighting > 0.5;
  let effectiveSunAltitude = select(32.0, skyBackground.sunAltitude, lightingEnabled);
  let effectiveSunAzimuth = select(135.0, skyBackground.sunAzimuth, lightingEnabled);
  let dayFactor = select(1.0, smoothstep(-6.0, 20.0, effectiveSunAltitude), lightingEnabled);
  let nightFactor = select(0.0, 1.0 - smoothstep(-12.0, 2.0, effectiveSunAltitude), lightingEnabled);
  let duskFactor = select(0.18, saturate(1.0 - smoothstep(12.0, 58.0, effectiveSunAltitude)), lightingEnabled);
  let sunDir = computeSunDirection(localUp, effectiveSunAltitude, effectiveSunAzimuth);

  var baseGradient = mix(skyBackground.horizonColor.rgb, skyBackground.zenithColor.rgb, zenithFactor);
  baseGradient = mix(baseGradient, skyBackground.spaceColor.rgb, spaceFactor * mix(0.08, 0.62, nightFactor));
  baseGradient = mix(
    baseGradient,
    mix(skyBackground.horizonColor.rgb, baseGradient, altitude01),
    skyBackground.horizonBlend * (0.22 + hazeEnvelope * 0.48),
  );
  baseGradient = mix(
    baseGradient,
    mix(skyBackground.horizonColor.rgb, skyBackground.zenithColor.rgb, zenithFactor * 0.5),
    horizonEnvelope * mix(0.25, 0.82, skyBackground.horizonBlend),
  );
  baseGradient = mix(
    baseGradient,
    skyBackground.horizonColor.rgb,
    skyBackground.horizonBlend * hazeEnvelope * 0.42,
  );

  let scattering = computeAtmosphericScattering(rayDir, localUp, sunDir);
  var daySky = mix(baseGradient, scattering + baseGradient * 0.22, 0.82);
  daySky = mix(daySky, daySky + skyBackground.horizonColor.rgb * 0.28, horizonEnvelope * 0.45);

  let sunFacing = saturate(dot(rayDir, sunDir));
  let sunGlow = vec3<f32>(1.0, 0.74, 0.42) *
    pow(sunFacing, mix(96.0, 12.0, duskFactor)) *
    mix(0.04, 0.42, duskFactor) *
    (1.0 - nightFactor * 0.75);
  let warmHorizon = vec3<f32>(1.0, 0.58, 0.26) *
    horizonBand *
    pow(saturate(sunFacing * 0.5 + 0.5), 3.0) *
    0.28 *
    duskFactor *
    (1.0 - nightFactor);
  daySky += warmHorizon + sunGlow;

  var nightGradient = mix(
    skyBackground.spaceColor.rgb,
    mix(skyBackground.spaceColor.rgb, skyBackground.zenithColor.rgb, 0.18),
    aboveHorizon * 0.4,
  );
  nightGradient = mix(nightGradient, skyBackground.horizonColor.rgb * 0.18, horizonEnvelope * 0.35);

  var color = mix(nightGradient, daySky, dayFactor);
  color = mix(skyBackground.spaceColor.rgb, color, mix(0.22, 1.0, aboveHorizon));
  color = mix(
    color,
    skyBackground.horizonColor.rgb,
    (horizonBand * 0.14 + horizonEnvelope * 0.32 + hazeEnvelope * skyBackground.horizonBlend * 0.28) * (1.0 - nightFactor * 0.6),
  );
  color = clamp(color, vec3<f32>(0.0), vec3<f32>(1.0));

  let twilightVisibility = smoothstep(30.0, -6.0, effectiveSunAltitude);
  let daySuppression = mix(0.95, 0.45, skyBackground.starIntensity);
  let starVisibility = aboveHorizon *
    max(0.0, max(nightFactor, twilightVisibility) - dayFactor * daySuppression) *
    mix(0.6, 2.4, skyBackground.starIntensity) *
    mix(0.7, 1.9, skyBackground.starDensity);
  let stars = starField(rayDir) * starVisibility * 2.2;

  // Placeholder for future volumetric clouds without changing the v1 API shape.
  let cloudDimmer = 1.0 - skyVolumetrics.cloudOpacity * 0.0;
  color = color * cloudDimmer + vec3<f32>(stars);

  return vec4<f32>(color, 1.0);
}
`;

export interface SkyPipelineDescriptor {
  device: GPUDevice;
  colorFormat: GPUTextureFormat;
  globeCameraBindGroupLayout: GPUBindGroupLayout;
  sampleCount?: number;
}

export interface SkyPipeline {
  pipeline: GPURenderPipeline;
  skyBindGroupLayout: GPUBindGroupLayout;
}

export function createSkyBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'sky-bind-group-layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
    ],
  });
}

export function createSkyPipeline(desc: SkyPipelineDescriptor): SkyPipeline {
  const { device, colorFormat, globeCameraBindGroupLayout } = desc;
  const skyBindGroupLayout = createSkyBindGroupLayout(device);

  const shaderModule = device.createShaderModule({
    label: 'sky-shader',
    code: SKY_SHADER_SOURCE,
  });

  const pipelineLayout = device.createPipelineLayout({
    label: 'sky-pipeline-layout',
    bindGroupLayouts: [globeCameraBindGroupLayout, skyBindGroupLayout],
  });

  const pipeline = device.createRenderPipeline({
    label: 'sky-pipeline',
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs_main',
      targets: [
        {
          format: colorFormat,
        },
      ],
    },
    primitive: {
      topology: 'triangle-list',
      cullMode: 'none',
    },
    multisample: {
      count: desc.sampleCount ?? MSAA_SAMPLE_COUNT,
    },
  });

  return { pipeline, skyBindGroupLayout };
}
