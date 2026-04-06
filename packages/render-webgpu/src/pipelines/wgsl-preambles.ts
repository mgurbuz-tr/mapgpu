/**
 * Shared WGSL Preambles
 *
 * Extracts duplicated WGSL shader snippets (structs, constants, helpers)
 * into reusable string constants. Each pipeline imports what it needs
 * and interpolates via template literals.
 *
 * IMPORTANT: These strings must stay character-for-character identical
 * to the inline WGSL they replace — do NOT reformat or add/remove whitespace.
 */

// ─── 2D Camera Uniforms ───

/**
 * CameraUniforms struct + @group(0) @binding(0) declaration.
 * Used by 2D pipelines: point, line, polygon, text, icon, model, picking.
 *
 * Note: raster-pipeline uses a smaller CameraUniforms (no viewport).
 * Note: custom-pipeline has its own preamble with different group layout.
 */
export const WGSL_CAMERA_UNIFORMS = /* wgsl */ `
struct CameraUniforms {
  viewProjection: mat4x4<f32>,
  viewport: vec2<f32>,
  relativeViewProjection: mat4x4<f32>,
  worldOrigin: vec4<f32>,
};

@group(0) @binding(0) var<uniform> camera: CameraUniforms;`;

// ─── Globe Camera Uniforms ───

/**
 * GlobeCameraUniforms struct + @group(0) @binding(0) declaration.
 * Used by all globe pipelines: globe-raster, globe-point, globe-line,
 * globe-polygon, globe-icon, globe-model, pole-cap, atmosphere.
 */
export const WGSL_GLOBE_CAMERA_UNIFORMS = /* wgsl */ `
struct GlobeCameraUniforms {
  viewProjection: mat4x4<f32>,
  flatViewProjection: mat4x4<f32>,
  viewport: vec2<f32>,
  projectionTransition: f32,
  globeRadius: f32,
  clippingPlane: vec4<f32>,
  cameraWorld: vec4<f32>,
  cameraMerc01: vec4<f32>,
};

@group(0) @binding(0) var<uniform> camera: GlobeCameraUniforms;`;

// ─── Globe Constants ───

/**
 * Core globe constants: PI, TWO_PI, HALF_CIRCUMFERENCE.
 * Used by globe-point, globe-line, globe-polygon, globe-icon, globe-model, globe-raster.
 *
 * Note: Globe vector/model pipelines should share the same physical
 * meter-to-globe conversion via WGSL_GLOBE_HEIGHT_SEMANTICS below.
 */
export const WGSL_GLOBE_CONSTANTS = /* wgsl */ `
const PI: f32 = 3.14159265358979323846;
const TWO_PI: f32 = 6.28318530717958647692;
const HALF_CIRCUMFERENCE: f32 = 20037508.34;`;

/**
 * Shared globe height semantics.
 *
 * ALTITUDE_EXAG intentionally defaults to 1.0 so globe vector/model geometry
 * uses physical meter heights consistently across pipelines.
 */
export const WGSL_GLOBE_HEIGHT_SEMANTICS = /* wgsl */ `
const EARTH_RADIUS_M: f32 = 6378137.0;
const ALTITUDE_EXAG: f32 = 1.0;

fn altitudeOffset(altMeters: f32) -> f32 {
  return altMeters / EARTH_RADIUS_M * ALTITUDE_EXAG;
}`;

// ─── Globe Helper Functions ───

/**
 * Shared globe projection helpers:
 *   epsg3857ToMerc01  — EPSG:3857 → Mercator [0..1] with Y-flip
 *   mercatorToAngular — Mercator [0..1] → Angular (radians)
 *   angularToSphere   — Angular → Unit Sphere (3D)
 *   globeClippingZ    — Horizon-aware depth from clipping plane
 *
 * Used by globe-point, globe-line, globe-polygon, globe-icon, globe-model.
 *
 * Note: globe-raster only uses mercatorToAngular, angularToSphere, globeClippingZ
 *       (no epsg3857ToMerc01) — those are kept inline.
 */
export const WGSL_GLOBE_HELPERS = /* wgsl */ `
fn epsg3857ToMerc01(pos: vec3<f32>) -> vec2<f32> {
  return vec2<f32>(
    (pos.x + HALF_CIRCUMFERENCE) / (2.0 * HALF_CIRCUMFERENCE),
    1.0 - (pos.y + HALF_CIRCUMFERENCE) / (2.0 * HALF_CIRCUMFERENCE)
  );
}

fn mercatorToAngular(merc: vec2<f32>) -> vec2<f32> {
  let lon = merc.x * TWO_PI - PI;
  let lat = atan(exp(PI - merc.y * TWO_PI)) * 2.0 - PI * 0.5;
  return vec2<f32>(lon, lat);
}

fn angularToSphere(lon: f32, lat: f32) -> vec3<f32> {
  let cosLat = cos(lat);
  return vec3<f32>(
    cosLat * sin(lon),
    sin(lat),
    cosLat * cos(lon),
  );
}

fn globeClippingZ(spherePos: vec3<f32>) -> f32 {
  return 1.0 - (dot(spherePos, camera.clippingPlane.xyz) + camera.clippingPlane.w);
}`;

// ─── Composite Preamble ───

/**
 * Full globe preamble: camera uniforms + constants + helpers.
 * Convenience constant for pipelines that use all three parts.
 */
export const WGSL_GLOBE_PREAMBLE = WGSL_GLOBE_CAMERA_UNIFORMS + '\n' + WGSL_GLOBE_CONSTANTS + '\n' + WGSL_GLOBE_HELPERS;
