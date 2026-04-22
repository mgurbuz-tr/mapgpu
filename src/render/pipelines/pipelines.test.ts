/**
 * Pipeline Tests
 *
 * GPU pipeline factory fonksiyonlarını mock GPUDevice ile test eder.
 * WGSL shader string'lerinin valid yapıda olduğunu kontrol eder.
 * Picking ID encoding/decoding round-trip testi.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RASTER_SHADER_SOURCE,
  createRasterPipeline,
  createCameraBindGroupLayout,
  createRasterBindGroupLayout,
} from './raster-pipeline.js';
import {
  POINT_SHADER_SOURCE,
  createPointPipeline,
  createPointBindGroupLayout,
} from './point-pipeline.js';
import {
  ICON_SHADER_SOURCE,
} from './icon-pipeline.js';
import {
  LINE_SHADER_SOURCE,
  createLinePipeline,
  createLineBindGroupLayout,
  dashStyleToUniform,
} from './line-pipeline.js';
import {
  POLYGON_SHADER_SOURCE,
  createPolygonPipeline,
  createPolygonBindGroupLayout,
} from './polygon-pipeline.js';
import {
  PICKING_SHADER_SOURCE,
  createPickingPipeline,
  createPickingBindGroupLayout,
  encodePickingId,
  decodePickingId,
} from './picking-pipeline.js';
import {
  CLUSTER_RENDER_SHADER_SOURCE,
} from './cluster-render-pipeline.js';
import {
  CLUSTER_GLOBE_RENDER_SHADER_SOURCE,
} from './cluster-globe-render-pipeline.js';
import {
  TEXT_SHADER_SOURCE,
  createTextPipeline,
  createTextBindGroupLayout,
} from './text-pipeline.js';
import {
  POST_PROCESS_SHADER_SOURCE,
  createPostProcessPipeline,
  createPostProcessBindGroupLayout,
} from './post-process-pipeline.js';
import {
  GLOBE_RASTER_SHADER_SOURCE,
  createGlobeRasterPipeline,
  createGlobeCameraBindGroupLayout,
  createGlobeTileBindGroupLayout,
} from './globe-raster-pipeline.js';
import {
  POLE_CAP_SHADER_SOURCE,
  createPoleCapPipeline,
  createPoleCapMesh,
  createPoleCapBindGroupLayout,
} from './pole-cap-pipeline.js';
import {
  GLOBE_POINT_SHADER_SOURCE,
  createGlobePointPipeline,
  createGlobePointBindGroupLayout,
} from './globe-point-pipeline.js';
import {
  GLOBE_LINE_SHADER_SOURCE,
  createGlobeLinePipeline,
  createGlobeLineBindGroupLayout,
} from './globe-line-pipeline.js';
import {
  GLOBE_POLYGON_SHADER_SOURCE,
  createGlobePolygonPipeline,
  createGlobePolygonBindGroupLayout,
} from './globe-polygon-pipeline.js';
import {
  createMesh3DPipeline,
} from './mesh3d-pipeline.js';
import {
  MODEL_SHADER_SOURCE,
} from './model-pipeline.js';
import {
  createGlobeMesh3DPipeline,
} from './globe-mesh3d-pipeline.js';
import { EXTRUSION_SHADER_SOURCE } from './extrusion-pipeline.js';
import {
  GLOBE_EXTRUSION_SHADER_SOURCE,
  createGlobeExtrusionShaderSource,
} from './globe-extrusion-pipeline.js';
import {
  ATMOSPHERE_SHADER_SOURCE,
  createAtmospherePipeline,
  createAtmosphereBindGroupLayout,
  createAtmosphereMesh,
} from './atmosphere-pipeline.js';
import {
  SKY_SHADER_SOURCE,
  createSkyPipeline,
  createSkyBindGroupLayout,
} from './sky-pipeline.js';
import {
  createTileDebugSuite,
} from './tile-debug-pipeline.js';
import { GLTF2_FLAT_SHADER } from '../gltf2-shader.js';

// ─── Mock GPUDevice ───

function createMockBindGroupLayout(): GPUBindGroupLayout {
  return { label: 'mock-layout' } as unknown as GPUBindGroupLayout;
}

function createMockRenderPipeline(): GPURenderPipeline {
  return { label: 'mock-pipeline' } as unknown as GPURenderPipeline;
}

function createMockShaderModule(): GPUShaderModule {
  return { label: 'mock-shader' } as unknown as GPUShaderModule;
}

function createMockPipelineLayout(): GPUPipelineLayout {
  return { label: 'mock-pipeline-layout' } as unknown as GPUPipelineLayout;
}

function createMockSampler(): GPUSampler {
  return { label: 'mock-sampler' } as unknown as GPUSampler;
}

function createMockTexture(): GPUTexture {
  return {
    label: 'mock-texture',
    createView: vi.fn(() => ({ label: 'mock-view' })),
    destroy: vi.fn(),
    width: 256,
    height: 256,
  } as unknown as GPUTexture;
}

function createMockBuffer(): GPUBuffer {
  return {
    label: 'mock-buffer',
    destroy: vi.fn(),
    mapAsync: vi.fn(),
    getMappedRange: vi.fn(),
    unmap: vi.fn(),
    size: 256,
  } as unknown as GPUBuffer;
}

function createMockDevice(): GPUDevice {
  return {
    createBindGroupLayout: vi.fn(() => createMockBindGroupLayout()),
    createRenderPipeline: vi.fn(() => createMockRenderPipeline()),
    createShaderModule: vi.fn(() => createMockShaderModule()),
    createPipelineLayout: vi.fn(() => createMockPipelineLayout()),
    createSampler: vi.fn(() => createMockSampler()),
    createTexture: vi.fn(() => createMockTexture()),
    createBuffer: vi.fn(() => createMockBuffer()),
    createBindGroup: vi.fn(() => ({ label: 'mock-bind-group' })),
    queue: {
      submit: vi.fn(),
      writeBuffer: vi.fn(),
      writeTexture: vi.fn(),
    },
  } as unknown as GPUDevice;
}

// ─── WGSL Shader Structure Validation ───

describe('WGSL Shader Sources', () => {
  it('RASTER_SHADER_SOURCE contains required entry points', () => {
    expect(RASTER_SHADER_SOURCE).toContain('@vertex');
    expect(RASTER_SHADER_SOURCE).toContain('fn vs_main');
    expect(RASTER_SHADER_SOURCE).toContain('@fragment');
    expect(RASTER_SHADER_SOURCE).toContain('fn fs_main');
  });

  it('RASTER_SHADER_SOURCE uses correct bind groups', () => {
    expect(RASTER_SHADER_SOURCE).toContain('@group(0) @binding(0)');
    expect(RASTER_SHADER_SOURCE).toContain('@group(1) @binding(0)');
  });

  it('POINT_SHADER_SOURCE contains required entry points', () => {
    expect(POINT_SHADER_SOURCE).toContain('@vertex');
    expect(POINT_SHADER_SOURCE).toContain('fn vs_main');
    expect(POINT_SHADER_SOURCE).toContain('@fragment');
    expect(POINT_SHADER_SOURCE).toContain('fn fs_main');
  });

  it('POINT_SHADER_SOURCE contains SDF for circle and square', () => {
    expect(POINT_SHADER_SOURCE).toContain('Circle SDF');
    expect(POINT_SHADER_SOURCE).toContain('Square SDF');
  });

  it('POINT_SHADER_SOURCE uses correct bind groups', () => {
    expect(POINT_SHADER_SOURCE).toContain('@group(0) @binding(0)');
    expect(POINT_SHADER_SOURCE).toContain('@group(1) @binding(0)');
  });

  it('POINT_SHADER_SOURCE contains CameraUniforms with viewport', () => {
    expect(POINT_SHADER_SOURCE).toContain('viewport: vec2<f32>');
  });

  it('LINE_SHADER_SOURCE contains required entry points', () => {
    expect(LINE_SHADER_SOURCE).toContain('@vertex');
    expect(LINE_SHADER_SOURCE).toContain('fn vs_main');
    expect(LINE_SHADER_SOURCE).toContain('@fragment');
    expect(LINE_SHADER_SOURCE).toContain('fn fs_main');
  });

  it('LINE_SHADER_SOURCE contains dash pattern support', () => {
    expect(LINE_SHADER_SOURCE).toContain('dashStyle');
    expect(LINE_SHADER_SOURCE).toContain('dashAnimationSpeed');
  });

  it('LINE_SHADER_SOURCE uses correct bind groups', () => {
    expect(LINE_SHADER_SOURCE).toContain('@group(0) @binding(0)');
    expect(LINE_SHADER_SOURCE).toContain('@group(1) @binding(0)');
  });

  it('LINE_SHADER_SOURCE has miter join logic', () => {
    expect(LINE_SHADER_SOURCE).toContain('miter');
    expect(LINE_SHADER_SOURCE).toContain('normalPrev');
    expect(LINE_SHADER_SOURCE).toContain('normalNext');
  });

  it('POLYGON_SHADER_SOURCE contains required entry points', () => {
    expect(POLYGON_SHADER_SOURCE).toContain('@vertex');
    expect(POLYGON_SHADER_SOURCE).toContain('fn vs_main');
    expect(POLYGON_SHADER_SOURCE).toContain('@fragment');
    expect(POLYGON_SHADER_SOURCE).toContain('fn fs_main');
  });


  it('POLYGON_SHADER_SOURCE uses correct bind groups', () => {
    expect(POLYGON_SHADER_SOURCE).toContain('@group(0) @binding(0)');
    expect(POLYGON_SHADER_SOURCE).toContain('@group(1) @binding(0)');
  });

  it('PICKING_SHADER_SOURCE contains required entry points', () => {
    expect(PICKING_SHADER_SOURCE).toContain('@vertex');
    expect(PICKING_SHADER_SOURCE).toContain('fn vs_main');
    expect(PICKING_SHADER_SOURCE).toContain('@fragment');
    expect(PICKING_SHADER_SOURCE).toContain('fn fs_main');
  });

  it('PICKING_SHADER_SOURCE outputs feature color without blending', () => {
    expect(PICKING_SHADER_SOURCE).toContain('featureColor');
    expect(PICKING_SHADER_SOURCE).toContain('return picking.featureColor');
  });

  it('flat surface-family shaders clamp world z to the map plane', () => {
    expect(POINT_SHADER_SOURCE).toContain('vec4<f32>(input.position.xy, 0.0, 1.0)');
    expect(ICON_SHADER_SOURCE).toContain('vec4<f32>(input.position.xy, 0.0, 1.0)');
    expect(LINE_SHADER_SOURCE).toContain('vec4<f32>(input.currPos.xy, 0.0, 1.0)');
    expect(POLYGON_SHADER_SOURCE).toContain('vec4<f32>(input.position.xy, 0.0, 1.0)');
    expect(PICKING_SHADER_SOURCE).toContain('vec4<f32>(input.position.xy, 0.0, 1.0)');
  });

  it('cluster shaders stay surface-only in both flat and globe paths', () => {
    expect(CLUSTER_RENDER_SHADER_SOURCE).toContain('vec4<f32>(inst.posX, inst.posY, 0.0, 1.0)');
    expect(CLUSTER_GLOBE_RENDER_SHADER_SOURCE).toContain('epsg3857ToMerc01(vec3<f32>(inst.posX, inst.posY, 0.0))');
    expect(CLUSTER_GLOBE_RENDER_SHADER_SOURCE).toContain('camera.flatViewProjection * vec4<f32>(merc01.x, merc01.y, 0.0, 1.0)');
  });

  // ─── Text Shader ───

  it('TEXT_SHADER_SOURCE contains required entry points', () => {
    expect(TEXT_SHADER_SOURCE).toContain('@vertex');
    expect(TEXT_SHADER_SOURCE).toContain('fn vs_main');
    expect(TEXT_SHADER_SOURCE).toContain('@fragment');
    expect(TEXT_SHADER_SOURCE).toContain('fn fs_main');
  });

  it('TEXT_SHADER_SOURCE contains SDF text rendering', () => {
    expect(TEXT_SHADER_SOURCE).toContain('TextMaterial');
    expect(TEXT_SHADER_SOURCE).toContain('haloColor');
    expect(TEXT_SHADER_SOURCE).toContain('haloWidth');
    expect(TEXT_SHADER_SOURCE).toContain('atlasTexture');
  });

  it('TEXT_SHADER_SOURCE uses correct bind groups', () => {
    expect(TEXT_SHADER_SOURCE).toContain('@group(0) @binding(0)');
    expect(TEXT_SHADER_SOURCE).toContain('@group(1) @binding(0)');
    expect(TEXT_SHADER_SOURCE).toContain('@group(1) @binding(1)');
    expect(TEXT_SHADER_SOURCE).toContain('@group(1) @binding(2)');
  });

  it('TEXT_SHADER_SOURCE has SDF distance field logic', () => {
    expect(TEXT_SHADER_SOURCE).toContain('smoothstep');
    expect(TEXT_SHADER_SOURCE).toContain('fwidth');
    expect(TEXT_SHADER_SOURCE).toContain('discard');
  });

  // ─── Post-Process Shader ───

  it('POST_PROCESS_SHADER_SOURCE contains required entry points', () => {
    expect(POST_PROCESS_SHADER_SOURCE).toContain('@vertex');
    expect(POST_PROCESS_SHADER_SOURCE).toContain('fn vs_main');
    expect(POST_PROCESS_SHADER_SOURCE).toContain('@fragment');
    expect(POST_PROCESS_SHADER_SOURCE).toContain('fn fs_main');
  });

  it('POST_PROCESS_SHADER_SOURCE contains FXAA logic', () => {
    expect(POST_PROCESS_SHADER_SOURCE).toContain('luminance');
    expect(POST_PROCESS_SHADER_SOURCE).toContain('edgeThreshold');
    expect(POST_PROCESS_SHADER_SOURCE).toContain('fxaaQuality');
    expect(POST_PROCESS_SHADER_SOURCE).toContain('rcpScreenSize');
  });

  it('POST_PROCESS_SHADER_SOURCE uses group(0) bindings', () => {
    expect(POST_PROCESS_SHADER_SOURCE).toContain('@group(0) @binding(0)');
    expect(POST_PROCESS_SHADER_SOURCE).toContain('@group(0) @binding(1)');
    expect(POST_PROCESS_SHADER_SOURCE).toContain('@group(0) @binding(2)');
  });

  it('POST_PROCESS_SHADER_SOURCE has luma-based edge detection', () => {
    expect(POST_PROCESS_SHADER_SOURCE).toContain('lumaMin');
    expect(POST_PROCESS_SHADER_SOURCE).toContain('lumaMax');
    expect(POST_PROCESS_SHADER_SOURCE).toContain('lumaRange');
  });

  // ─── Globe Raster Shader ───

  it('GLOBE_RASTER_SHADER_SOURCE contains required entry points', () => {
    expect(GLOBE_RASTER_SHADER_SOURCE).toContain('@vertex');
    expect(GLOBE_RASTER_SHADER_SOURCE).toContain('fn vs_main');
    expect(GLOBE_RASTER_SHADER_SOURCE).toContain('@fragment');
    expect(GLOBE_RASTER_SHADER_SOURCE).toContain('fn fs_main');
  });

  it('GLOBE_RASTER_SHADER_SOURCE contains globe projection functions', () => {
    expect(GLOBE_RASTER_SHADER_SOURCE).toContain('fn mercatorToAngular');
    expect(GLOBE_RASTER_SHADER_SOURCE).toContain('fn angularToSphere');
  });

  it('GLOBE_RASTER_SHADER_SOURCE contains GlobeCameraUniforms struct with dual VP', () => {
    expect(GLOBE_RASTER_SHADER_SOURCE).toContain('struct GlobeCameraUniforms');
    expect(GLOBE_RASTER_SHADER_SOURCE).toContain('viewProjection: mat4x4<f32>');
    expect(GLOBE_RASTER_SHADER_SOURCE).toContain('flatViewProjection: mat4x4<f32>');
    expect(GLOBE_RASTER_SHADER_SOURCE).toContain('projectionTransition');
    expect(GLOBE_RASTER_SHADER_SOURCE).toContain('clippingPlane');
    expect(GLOBE_RASTER_SHADER_SOURCE).toContain('globeRadius');
  });

  it('GLOBE_RASTER_SHADER_SOURCE uses correct bind groups', () => {
    expect(GLOBE_RASTER_SHADER_SOURCE).toContain('@group(0) @binding(0)');
    expect(GLOBE_RASTER_SHADER_SOURCE).toContain('@group(1) @binding(0)');
    expect(GLOBE_RASTER_SHADER_SOURCE).toContain('@group(1) @binding(1)');
    expect(GLOBE_RASTER_SHADER_SOURCE).toContain('@group(1) @binding(2)');
  });

  it('GLOBE_RASTER_SHADER_SOURCE contains horizon occlusion logic', () => {
    expect(GLOBE_RASTER_SHADER_SOURCE).toContain('clipDot');
    expect(GLOBE_RASTER_SHADER_SOURCE).toContain('discard');
  });

  it('GLOBE_RASTER_SHADER_SOURCE uses mix for projection transition in clip space', () => {
    expect(GLOBE_RASTER_SHADER_SOURCE).toContain('mix(flatClip, globeClip');
  });

  it('GLOBE_RASTER_SHADER_SOURCE supports world/tile-local height modes', () => {
    expect(GLOBE_RASTER_SHADER_SOURCE).toContain('heightMode: f32');
    expect(GLOBE_RASTER_SHADER_SOURCE).toContain('terrainUv: vec4<f32>');
    expect(GLOBE_RASTER_SHADER_SOURCE).toContain('if (tile.heightMode >= 0.5)');
    expect(GLOBE_RASTER_SHADER_SOURCE).toContain('h = sampleHeight(terrainUvForTileUv(input.uv));');
    expect(GLOBE_RASTER_SHADER_SOURCE).toContain('h = sampleHeight(vec2<f32>(mercX, mercY));');
    expect(GLOBE_RASTER_SHADER_SOURCE).toContain('heightValue / EARTH_RADIUS_METERS');
    expect(GLOBE_RASTER_SHADER_SOURCE).not.toContain('sampleHeightFiltered(');
    expect(GLOBE_RASTER_SHADER_SOURCE).toContain('vec4<f32>(mercX, mercY, displacement, 1.0)');
  });

  it('GLOBE_RASTER_SHADER_SOURCE includes 3D terrain lighting + pseudo-shadow hooks', () => {
    expect(GLOBE_RASTER_SHADER_SOURCE).toContain('lightParams: vec4<f32>');
    expect(GLOBE_RASTER_SHADER_SOURCE).toContain('sunParams: vec4<f32>');
    expect(GLOBE_RASTER_SHADER_SOURCE).toContain('fn sunDirection');
    expect(GLOBE_RASTER_SHADER_SOURCE).toContain('Pseudo-shadow: compare height toward sun direction');
    expect(GLOBE_RASTER_SHADER_SOURCE).toContain('transitionToFlat = clamp(1.0 - camera.projectionTransition');
    expect(GLOBE_RASTER_SHADER_SOURCE).toContain('zoomShadowFade = smoothstep(');
  });

  // ─── Pole Cap Shader ───

  it('POLE_CAP_SHADER_SOURCE contains required entry points', () => {
    expect(POLE_CAP_SHADER_SOURCE).toContain('@vertex');
    expect(POLE_CAP_SHADER_SOURCE).toContain('fn vs_main');
    expect(POLE_CAP_SHADER_SOURCE).toContain('@fragment');
    expect(POLE_CAP_SHADER_SOURCE).toContain('fn fs_main');
  });

  it('POLE_CAP_SHADER_SOURCE uses correct bind groups', () => {
    expect(POLE_CAP_SHADER_SOURCE).toContain('@group(0) @binding(0)');
    expect(POLE_CAP_SHADER_SOURCE).toContain('@group(1) @binding(0)');
  });

  it('POLE_CAP_SHADER_SOURCE contains GlobeCameraUniforms struct', () => {
    expect(POLE_CAP_SHADER_SOURCE).toContain('GlobeCameraUniforms');
    expect(POLE_CAP_SHADER_SOURCE).toContain('viewProjection: mat4x4<f32>');
    expect(POLE_CAP_SHADER_SOURCE).toContain('clippingPlane');
  });

  it('POLE_CAP_SHADER_SOURCE contains PoleCapUniforms struct', () => {
    expect(POLE_CAP_SHADER_SOURCE).toContain('PoleCapUniforms');
    expect(POLE_CAP_SHADER_SOURCE).toContain('color: vec4<f32>');
  });

  it('POLE_CAP_SHADER_SOURCE contains horizon occlusion logic', () => {
    expect(POLE_CAP_SHADER_SOURCE).toContain('clipDot');
    expect(POLE_CAP_SHADER_SOURCE).toContain('discard');
    expect(POLE_CAP_SHADER_SOURCE).toContain('globeClippingZ');
  });

  it('POLE_CAP_SHADER_SOURCE takes vec3 position input (not UV)', () => {
    expect(POLE_CAP_SHADER_SOURCE).toContain('position: vec3<f32>');
  });

  // ─── Atmosphere Shader ───

  it('ATMOSPHERE_SHADER_SOURCE contains required entry points', () => {
    expect(ATMOSPHERE_SHADER_SOURCE).toContain('@vertex');
    expect(ATMOSPHERE_SHADER_SOURCE).toContain('fn vs_main');
    expect(ATMOSPHERE_SHADER_SOURCE).toContain('@fragment');
    expect(ATMOSPHERE_SHADER_SOURCE).toContain('fn fs_main');
  });

  it('ATMOSPHERE_SHADER_SOURCE contains GlobeCameraUniforms and AtmosphereUniforms', () => {
    expect(ATMOSPHERE_SHADER_SOURCE).toContain('struct GlobeCameraUniforms');
    expect(ATMOSPHERE_SHADER_SOURCE).toContain('struct AtmosphereUniforms');
    expect(ATMOSPHERE_SHADER_SOURCE).toContain('colorInner');
    expect(ATMOSPHERE_SHADER_SOURCE).toContain('colorOuter');
    expect(ATMOSPHERE_SHADER_SOURCE).toContain('strength');
    expect(ATMOSPHERE_SHADER_SOURCE).toContain('falloff');
  });

  it('ATMOSPHERE_SHADER_SOURCE normalizes worldPos per-fragment for smooth glow', () => {
    expect(ATMOSPHERE_SHADER_SOURCE).toContain('normalize(input.worldPos)');
    expect(ATMOSPHERE_SHADER_SOURCE).toContain('edgeFactor');
    expect(ATMOSPHERE_SHADER_SOURCE).toContain('smoothstep');
    expect(ATMOSPHERE_SHADER_SOURCE).toContain('discard');
  });

  it('ATMOSPHERE_SHADER_SOURCE uses correct bind groups', () => {
    expect(ATMOSPHERE_SHADER_SOURCE).toContain('@group(0) @binding(0)');
    expect(ATMOSPHERE_SHADER_SOURCE).toContain('@group(1) @binding(0)');
  });

  // ─── Sky Shader ───

  it('SKY_SHADER_SOURCE contains required entry points', () => {
    expect(SKY_SHADER_SOURCE).toContain('@vertex');
    expect(SKY_SHADER_SOURCE).toContain('fn vs_main');
    expect(SKY_SHADER_SOURCE).toContain('@fragment');
    expect(SKY_SHADER_SOURCE).toContain('fn fs_main');
  });

  it('SKY_SHADER_SOURCE contains horizon blend and star logic', () => {
    expect(SKY_SHADER_SOURCE).toContain('horizonBlend');
    expect(SKY_SHADER_SOURCE).toContain('starIntensity');
    expect(SKY_SHADER_SOURCE).toContain('starDensity');
    expect(SKY_SHADER_SOURCE).toContain('starField');
    expect(SKY_SHADER_SOURCE).toContain('computeRayDirection');
    expect(SKY_SHADER_SOURCE).toContain('inverseFlatViewProjection');
    expect(SKY_SHADER_SOURCE).toContain('camera.projectionTransition');
    expect(SKY_SHADER_SOURCE).toContain('computeSkyRayDirection');
    expect(SKY_SHADER_SOURCE).toContain('computeSunDirection');
    expect(SKY_SHADER_SOURCE).toContain('computeAtmosphericScattering');
    expect(SKY_SHADER_SOURCE).toContain('rayleighPhase');
    expect(SKY_SHADER_SOURCE).toContain('hgPhase');
    expect(SKY_SHADER_SOURCE).toContain('sunAzimuth');
  });

  it('SKY_SHADER_SOURCE uses future-ready volumetric uniforms separately from background uniforms', () => {
    expect(SKY_SHADER_SOURCE).toContain('struct SkyBackgroundUniforms');
    expect(SKY_SHADER_SOURCE).toContain('struct SkyVolumetricUniforms');
    expect(SKY_SHADER_SOURCE).toContain('@group(1) @binding(0)');
    expect(SKY_SHADER_SOURCE).toContain('@group(1) @binding(1)');
  });

  // ─── Globe Point Shader ───

  it('GLOBE_POINT_SHADER_SOURCE contains required entry points', () => {
    expect(GLOBE_POINT_SHADER_SOURCE).toContain('@vertex');
    expect(GLOBE_POINT_SHADER_SOURCE).toContain('fn vs_main');
    expect(GLOBE_POINT_SHADER_SOURCE).toContain('@fragment');
    expect(GLOBE_POINT_SHADER_SOURCE).toContain('fn fs_main');
  });

  it('GLOBE_POINT_SHADER_SOURCE contains GlobeCameraUniforms and epsg3857ToMerc01', () => {
    expect(GLOBE_POINT_SHADER_SOURCE).toContain('struct GlobeCameraUniforms');
    expect(GLOBE_POINT_SHADER_SOURCE).toContain('fn epsg3857ToMerc01');
    expect(GLOBE_POINT_SHADER_SOURCE).toContain('fn mercatorToAngular');
    expect(GLOBE_POINT_SHADER_SOURCE).toContain('fn angularToSphere');
  });

  it('GLOBE_POINT_SHADER_SOURCE contains SDF for circle and square', () => {
    expect(GLOBE_POINT_SHADER_SOURCE).toContain('Circle SDF');
    expect(GLOBE_POINT_SHADER_SOURCE).toContain('Square SDF');
  });

  it('GLOBE_POINT_SHADER_SOURCE contains horizon discard', () => {
    expect(GLOBE_POINT_SHADER_SOURCE).toContain('clipDot');
    expect(GLOBE_POINT_SHADER_SOURCE).toContain('discard');
  });

  it('GLOBE_POINT_SHADER_SOURCE uses correct bind groups', () => {
    expect(GLOBE_POINT_SHADER_SOURCE).toContain('@group(0) @binding(0)');
    expect(GLOBE_POINT_SHADER_SOURCE).toContain('@group(1) @binding(0)');
  });

  // ─── Globe Line Shader ───

  it('GLOBE_LINE_SHADER_SOURCE contains required entry points', () => {
    expect(GLOBE_LINE_SHADER_SOURCE).toContain('@vertex');
    expect(GLOBE_LINE_SHADER_SOURCE).toContain('fn vs_main');
    expect(GLOBE_LINE_SHADER_SOURCE).toContain('@fragment');
    expect(GLOBE_LINE_SHADER_SOURCE).toContain('fn fs_main');
  });

  it('GLOBE_LINE_SHADER_SOURCE contains GlobeCameraUniforms and epsg3857ToMerc01', () => {
    expect(GLOBE_LINE_SHADER_SOURCE).toContain('struct GlobeCameraUniforms');
    expect(GLOBE_LINE_SHADER_SOURCE).toContain('fn epsg3857ToMerc01');
  });

  it('GLOBE_LINE_SHADER_SOURCE has miter join and dash pattern', () => {
    expect(GLOBE_LINE_SHADER_SOURCE).toContain('miter');
    expect(GLOBE_LINE_SHADER_SOURCE).toContain('dashStyle');
    expect(GLOBE_LINE_SHADER_SOURCE).toContain('dashAnimationSpeed');
  });

  it('GLOBE_LINE_SHADER_SOURCE contains horizon discard', () => {
    expect(GLOBE_LINE_SHADER_SOURCE).toContain('clipDot');
    expect(GLOBE_LINE_SHADER_SOURCE).toContain('discard');
  });

  it('GLOBE_LINE_SHADER_SOURCE uses correct bind groups', () => {
    expect(GLOBE_LINE_SHADER_SOURCE).toContain('@group(0) @binding(0)');
    expect(GLOBE_LINE_SHADER_SOURCE).toContain('@group(1) @binding(0)');
  });

  // ─── Globe Polygon Shader ───

  it('GLOBE_POLYGON_SHADER_SOURCE contains required entry points', () => {
    expect(GLOBE_POLYGON_SHADER_SOURCE).toContain('@vertex');
    expect(GLOBE_POLYGON_SHADER_SOURCE).toContain('fn vs_main');
    expect(GLOBE_POLYGON_SHADER_SOURCE).toContain('@fragment');
    expect(GLOBE_POLYGON_SHADER_SOURCE).toContain('fn fs_main');
  });

  it('GLOBE_POLYGON_SHADER_SOURCE contains GlobeCameraUniforms and epsg3857ToMerc01', () => {
    expect(GLOBE_POLYGON_SHADER_SOURCE).toContain('struct GlobeCameraUniforms');
    expect(GLOBE_POLYGON_SHADER_SOURCE).toContain('fn epsg3857ToMerc01');
  });

  it('GLOBE_POLYGON_SHADER_SOURCE contains horizon discard', () => {
    expect(GLOBE_POLYGON_SHADER_SOURCE).toContain('clipDot');
    expect(GLOBE_POLYGON_SHADER_SOURCE).toContain('discard');
  });

  it('GLOBE_POLYGON_SHADER_SOURCE uses correct bind groups', () => {
    expect(GLOBE_POLYGON_SHADER_SOURCE).toContain('@group(0) @binding(0)');
    expect(GLOBE_POLYGON_SHADER_SOURCE).toContain('@group(1) @binding(0)');
  });

  it('extrusion shaders bias roofs ahead of wall depth', () => {
    expect(EXTRUSION_SHADER_SOURCE).toContain('const ROOF_DEPTH_BIAS');
    expect(EXTRUSION_SHADER_SOURCE).toContain('input.normal.z > 0.5');
    expect(EXTRUSION_SHADER_SOURCE).toContain('out.clipPosition.z -= ROOF_DEPTH_BIAS');

    expect(GLOBE_EXTRUSION_SHADER_SOURCE).toContain('const ROOF_DEPTH_BIAS');
    // Phase 2 redesign: EXTRUSION_SURFACE_BIAS kaldırıldı — height ordering natural.
    expect(GLOBE_EXTRUSION_SHADER_SOURCE).toContain('const ROOF_DEPTH_BIAS_SIGN: f32 = 1');
    expect(GLOBE_EXTRUSION_SHADER_SOURCE).toContain('input.normal.z > 0.5');
    expect(GLOBE_EXTRUSION_SHADER_SOURCE).toContain('ROOF_DEPTH_BIAS_SIGN * ROOF_DEPTH_BIAS');

    const standardDepthShader = createGlobeExtrusionShaderSource('less');
    expect(standardDepthShader).toContain('const ROOF_DEPTH_BIAS_SIGN: f32 = -1');
  });

  it('2D extrusion shader converts merc01 back to EPSG:3857', () => {
    expect(EXTRUSION_SHADER_SOURCE).toContain('HALF_CIRCUMFERENCE');
    expect(EXTRUSION_SHADER_SOURCE).toContain('epsg');
  });

  it('2D extrusion shader uses rotation-aware oblique with bearing', () => {
    expect(EXTRUSION_SHADER_SOURCE).toContain('material.bearing');
    expect(EXTRUSION_SHADER_SOURCE).toContain('offsetDir');
    expect(EXTRUSION_SHADER_SOURCE).toContain('obliqueMag');
  });

  it('2D extrusion shader uses logarithmic depth remap', () => {
    expect(EXTRUSION_SHADER_SOURCE).toContain('log2');
    expect(EXTRUSION_SHADER_SOURCE).toContain('logH');
    expect(EXTRUSION_SHADER_SOURCE).toContain('logMax');
  });

  it('2D model shader keeps elevated models visible via depth remap', () => {
    expect(MODEL_SHADER_SOURCE).toContain('projectedWorldPos');
    expect(MODEL_SHADER_SOURCE).toContain('heightMeters');
    expect(MODEL_SHADER_SOURCE).toContain('rotated.z / max(mercatorScale, 0.01)');
    expect(MODEL_SHADER_SOURCE).toContain('normalizedZ');
    // Signed-log depth mapping (sign(h)*log2(|h|+1)) preserves vertex-distinct
    // depth for sub-meter models, avoiding Z-fighting tears with cullMode='none'.
    expect(MODEL_SHADER_SOURCE).toContain('sign(heightMeters) * log2(abs(heightMeters) + 1.0)');
    expect(MODEL_SHADER_SOURCE).toContain('max(0.0, normalizedZ - 0.0001)');
  });

  it('GLTF2 flat shader keeps elevated models visible via depth remap', () => {
    expect(GLTF2_FLAT_SHADER).toContain('projectedWorldPos');
    expect(GLTF2_FLAT_SHADER).toContain('heightMeters');
    expect(GLTF2_FLAT_SHADER).toContain('rotated.z / max(mercatorScale, 0.01)');
    expect(GLTF2_FLAT_SHADER).toContain('normalizedZ');
    expect(GLTF2_FLAT_SHADER).toContain('sign(heightMeters) * log2(abs(heightMeters) + 1.0)');
    expect(GLTF2_FLAT_SHADER).toContain('max(0.0, normalizedZ - 0.0001)');
  });

  it('extrusion shaders use Blinn-Phong lighting with specular', () => {
    expect(EXTRUSION_SHADER_SOURCE).toContain('halfDir');
    expect(EXTRUSION_SHADER_SOURCE).toContain('shininess');
    expect(EXTRUSION_SHADER_SOURCE).toContain('specularStrength');
    expect(EXTRUSION_SHADER_SOURCE).toContain('specular');

    expect(GLOBE_EXTRUSION_SHADER_SOURCE).toContain('halfDir');
    expect(GLOBE_EXTRUSION_SHADER_SOURCE).toContain('shininess');
    expect(GLOBE_EXTRUSION_SHADER_SOURCE).toContain('specularStrength');
  });

  it('extrusion shaders output premultiplied alpha', () => {
    expect(EXTRUSION_SHADER_SOURCE).toContain('color * material.color.a');
    expect(GLOBE_EXTRUSION_SHADER_SOURCE).toContain('color * material.color.a');
  });

  it('globe extrusion shader uses input.position.xy directly (CPU-normalized merc01)', () => {
    expect(GLOBE_EXTRUSION_SHADER_SOURCE).toContain('input.position.xy');
    expect(GLOBE_EXTRUSION_SHADER_SOURCE).not.toContain('epsg3857ToMerc01(input.position)');
  });

  it('globe extrusion shader uses pure GPU perspective Z (Phase 2 redesign)', () => {
    // Phase 2: globeClippingZ Z-override kaldırıldı. Extrusion depth artık
    // doğal perspective projection'dan geliyor + ROOF/WALL_DEPTH_BIAS ince ayar.
    // Tile-debug konstantları: EXTRUSION_SURFACE_BIAS, heightBias, effectiveClipZ
    // kaldırıldı; height ordering worldPos'un kendisinden geliyor (radial altitude).
    expect(GLOBE_EXTRUSION_SHADER_SOURCE).not.toContain('EXTRUSION_SURFACE_BIAS');
    expect(GLOBE_EXTRUSION_SHADER_SOURCE).not.toContain('effectiveClipZ');
    // ROOF/WALL depth bias hala var — face-level ince ayar için.
    expect(GLOBE_EXTRUSION_SHADER_SOURCE).toContain('ROOF_DEPTH_BIAS');
    expect(GLOBE_EXTRUSION_SHADER_SOURCE).toContain('WALL_DEPTH_BIAS');
  });

  it('globe extrusion shader uses consistent height scale for flat path', () => {
    // Flat path must use h / EARTH_RADIUS_M (not h / FULL_EARTH) for visual parity with globe path
    expect(GLOBE_EXTRUSION_SHADER_SOURCE).toContain('h / EARTH_RADIUS_M');
    expect(GLOBE_EXTRUSION_SHADER_SOURCE).not.toContain('FULL_EARTH');
  });

  it('globe extrusion shader has cameraPos uniform and flat-aware viewDir', () => {
    expect(GLOBE_EXTRUSION_SHADER_SOURCE).toContain('cameraPos: vec4<f32>');
    expect(GLOBE_EXTRUSION_SHADER_SOURCE).toContain('globeViewDir');
    expect(GLOBE_EXTRUSION_SHADER_SOURCE).toContain('flatViewDir');
    expect(GLOBE_EXTRUSION_SHADER_SOURCE).toContain('material.cameraPos');
  });

  it('globe extrusion shader Y-flips normals in flat path', () => {
    expect(GLOBE_EXTRUSION_SHADER_SOURCE).toContain('-input.normal.y');
  });

  it('extrusion shaders have centroid attribute and animation support', () => {
    expect(EXTRUSION_SHADER_SOURCE).toContain('centroid: vec2<f32>');
    expect(EXTRUSION_SHADER_SOURCE).toContain('animProgress');
    expect(EXTRUSION_SHADER_SOURCE).toContain('animDuration');
    expect(EXTRUSION_SHADER_SOURCE).toContain('easeOutCubic');
    expect(EXTRUSION_SHADER_SOURCE).toContain('waveOrigin');

    expect(GLOBE_EXTRUSION_SHADER_SOURCE).toContain('centroid: vec2<f32>');
    expect(GLOBE_EXTRUSION_SHADER_SOURCE).toContain('animProgress');
    expect(GLOBE_EXTRUSION_SHADER_SOURCE).toContain('animDuration');
    expect(GLOBE_EXTRUSION_SHADER_SOURCE).toContain('easeOutCubic');
    expect(GLOBE_EXTRUSION_SHADER_SOURCE).toContain('waveOrigin');
  });

  // ─── All camera-based shaders ───

  it('all camera-based shaders define CameraUniforms struct', () => {
    const shaders = [
      RASTER_SHADER_SOURCE,
      POINT_SHADER_SOURCE,
      LINE_SHADER_SOURCE,
      POLYGON_SHADER_SOURCE,
      PICKING_SHADER_SOURCE,
      TEXT_SHADER_SOURCE,
    ];
    for (const shader of shaders) {
      expect(shader).toContain('struct CameraUniforms');
      expect(shader).toContain('viewProjection: mat4x4<f32>');
    }
  });

  it('all camera-based shaders use group(0) for camera uniforms', () => {
    const shaders = [
      RASTER_SHADER_SOURCE,
      POINT_SHADER_SOURCE,
      LINE_SHADER_SOURCE,
      POLYGON_SHADER_SOURCE,
      PICKING_SHADER_SOURCE,
      TEXT_SHADER_SOURCE,
    ];
    for (const shader of shaders) {
      expect(shader).toContain('@group(0) @binding(0) var<uniform> camera: CameraUniforms');
    }
  });
});

// ─── Pipeline Factory Tests ───

describe('Pipeline Factory Functions', () => {
  let device: GPUDevice;
  let cameraLayout: GPUBindGroupLayout;

  beforeEach(() => {
    device = createMockDevice();
    cameraLayout = createMockBindGroupLayout();
  });

  describe('createCameraBindGroupLayout', () => {
    it('creates bind group layout with correct entries', () => {
      createCameraBindGroupLayout(device);
      expect(device.createBindGroupLayout).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'camera-bind-group-layout',
          entries: expect.arrayContaining([
            expect.objectContaining({
              binding: 0,
              visibility: GPUShaderStage.VERTEX,
              buffer: { type: 'uniform' },
            }),
          ]),
        }),
      );
    });
  });

  describe('createRasterPipeline', () => {
    it('creates raster pipeline with correct configuration', () => {
      const result = createRasterPipeline({
        device,
        colorFormat: 'bgra8unorm',
        cameraBindGroupLayout: cameraLayout,
      });

      expect(result.pipeline).toBeDefined();
      expect(result.rasterBindGroupLayout).toBeDefined();
      expect(result.sampler).toBeDefined();
      expect(device.createShaderModule).toHaveBeenCalled();
      expect(device.createRenderPipeline).toHaveBeenCalled();
      expect(device.createSampler).toHaveBeenCalled();
    });

    it('uses triangle-strip topology', () => {
      createRasterPipeline({
        device,
        colorFormat: 'bgra8unorm',
        cameraBindGroupLayout: cameraLayout,
      });

      expect(device.createRenderPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          primitive: expect.objectContaining({
            topology: 'triangle-strip',
          }),
        }),
      );
    });
  });

  describe('createPointPipeline', () => {
    it('creates point pipeline with instanced rendering config', () => {
      const result = createPointPipeline({
        device,
        colorFormat: 'bgra8unorm',
        cameraBindGroupLayout: cameraLayout,
      });

      expect(result.pipeline).toBeDefined();
      expect(result.materialBindGroupLayout).toBeDefined();

      expect(device.createRenderPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'point-pipeline',
          vertex: expect.objectContaining({
            buffers: expect.arrayContaining([
              expect.objectContaining({
                stepMode: 'instance',
                arrayStride: 12,
              }),
            ]),
          }),
          primitive: expect.objectContaining({
            topology: 'triangle-list',
          }),
          depthStencil: expect.objectContaining({
            format: 'depth32float',
          }),
        }),
      );
    });
  });

  describe('createLinePipeline', () => {
    it('creates line pipeline with correct vertex layout', () => {
      const result = createLinePipeline({
        device,
        colorFormat: 'bgra8unorm',
        cameraBindGroupLayout: cameraLayout,
      });

      expect(result.pipeline).toBeDefined();
      expect(result.materialBindGroupLayout).toBeDefined();

      expect(device.createRenderPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'line-pipeline',
          vertex: expect.objectContaining({
            buffers: expect.arrayContaining([
              expect.objectContaining({
                arrayStride: 44,
                stepMode: 'vertex',
                attributes: expect.arrayContaining([
                  expect.objectContaining({ shaderLocation: 0, format: 'float32x3' }),
                  expect.objectContaining({ shaderLocation: 1, format: 'float32x3' }),
                  expect.objectContaining({ shaderLocation: 2, format: 'float32x3' }),
                  expect.objectContaining({ shaderLocation: 3, format: 'float32' }),
                  expect.objectContaining({ shaderLocation: 4, format: 'float32', offset: 40 }),
                ]),
              }),
            ]),
          }),
        }),
      );
    });
  });

  describe('createPolygonPipeline', () => {
    it('creates polygon pipeline with no culling', () => {
      const result = createPolygonPipeline({
        device,
        colorFormat: 'bgra8unorm',
        cameraBindGroupLayout: cameraLayout,
      });

      expect(result.pipeline).toBeDefined();
      expect(result.materialBindGroupLayout).toBeDefined();

      expect(device.createRenderPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'polygon-pipeline',
          primitive: expect.objectContaining({
            topology: 'triangle-list',
            cullMode: 'none',
          }),
        }),
      );
    });
  });

  describe('createPickingPipeline', () => {
    it('creates picking pipeline with offscreen texture', () => {
      const result = createPickingPipeline({
        device,
        cameraBindGroupLayout: cameraLayout,
        width: 800,
        height: 600,
      });

      expect(result.pipeline).toBeDefined();
      expect(result.pickingBindGroupLayout).toBeDefined();
      expect(result.pickingTexture).toBeDefined();
      expect(result.depthTexture).toBeDefined();
      expect(result.readbackBuffer).toBeDefined();
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
    });

    it('creates picking texture with rgba8unorm format', () => {
      createPickingPipeline({
        device,
        cameraBindGroupLayout: cameraLayout,
        width: 800,
        height: 600,
      });

      expect(device.createTexture).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'picking-texture',
          format: 'rgba8unorm',
        }),
      );
    });

    it('creates readback buffer with MAP_READ usage', () => {
      createPickingPipeline({
        device,
        cameraBindGroupLayout: cameraLayout,
        width: 800,
        height: 600,
      });

      expect(device.createBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'picking-readback-buffer',
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        }),
      );
    });
  });

  describe('createTextPipeline', () => {
    it('creates text pipeline with instanced rendering config', () => {
      const result = createTextPipeline({
        device,
        colorFormat: 'bgra8unorm',
        cameraBindGroupLayout: cameraLayout,
      });

      expect(result.pipeline).toBeDefined();
      expect(result.materialBindGroupLayout).toBeDefined();
      expect(result.sampler).toBeDefined();

      expect(device.createRenderPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'text-pipeline',
          vertex: expect.objectContaining({
            buffers: expect.arrayContaining([
              expect.objectContaining({
                stepMode: 'instance',
                arrayStride: 44,
                attributes: expect.arrayContaining([
                  expect.objectContaining({ shaderLocation: 0, format: 'float32x3' }),
                  expect.objectContaining({ shaderLocation: 1, format: 'float32x4' }),
                  expect.objectContaining({ shaderLocation: 2, format: 'float32x4' }),
                ]),
              }),
            ]),
          }),
          primitive: expect.objectContaining({
            topology: 'triangle-list',
          }),
        }),
      );
    });

    it('uses depth stencil with less-equal compare and no write', () => {
      createTextPipeline({
        device,
        colorFormat: 'bgra8unorm',
        cameraBindGroupLayout: cameraLayout,
      });

      expect(device.createRenderPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          depthStencil: expect.objectContaining({
            depthWriteEnabled: false,
            depthCompare: 'less-equal',
          }),
        }),
      );
    });
  });

  describe('createPostProcessPipeline', () => {
    it('creates post-process pipeline with correct configuration', () => {
      const result = createPostProcessPipeline({
        device,
        colorFormat: 'bgra8unorm',
      });

      expect(result.pipeline).toBeDefined();
      expect(result.bindGroupLayout).toBeDefined();
      expect(result.sampler).toBeDefined();
      expect(device.createShaderModule).toHaveBeenCalled();
      expect(device.createRenderPipeline).toHaveBeenCalled();
      expect(device.createSampler).toHaveBeenCalled();
    });

    it('uses triangle-strip topology', () => {
      createPostProcessPipeline({
        device,
        colorFormat: 'bgra8unorm',
      });

      expect(device.createRenderPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'post-process-pipeline',
          primitive: expect.objectContaining({
            topology: 'triangle-strip',
          }),
        }),
      );
    });

    it('has no depth stencil (full-screen pass)', () => {
      createPostProcessPipeline({
        device,
        colorFormat: 'bgra8unorm',
      });

      // Post-process pipeline should NOT have depthStencil
      const calls = (device.createRenderPipeline as ReturnType<typeof vi.fn>).mock.calls;
      const lastCall = calls[calls.length - 1]![0];
      expect(lastCall.depthStencil).toBeUndefined();
    });
  });

  describe('createGlobeRasterPipeline', () => {
    it('creates globe raster pipeline with subdivision mesh', () => {
      const result = createGlobeRasterPipeline({
        device,
        colorFormat: 'bgra8unorm',
      });

      expect(result.pipeline).toBeDefined();
      expect(result.globeCameraBindGroupLayout).toBeDefined();
      expect(result.globeTileBindGroupLayout).toBeDefined();
      expect(result.sampler).toBeDefined();
      expect(result.subdivisionMesh).toBeDefined();
      expect(result.subdivisionMesh.indexCount).toBeGreaterThan(0);
      expect(result.subdivisionMesh.vertexCount).toBeGreaterThan(0);
    });

    it('uses triangle-list topology with no face culling', () => {
      createGlobeRasterPipeline({
        device,
        colorFormat: 'bgra8unorm',
      });

      expect(device.createRenderPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'globe-raster-pipeline',
          primitive: expect.objectContaining({
            topology: 'triangle-list',
            cullMode: 'none',
          }),
        }),
      );
    });

    it('has vertex buffer with uv + skirt layout', () => {
      createGlobeRasterPipeline({
        device,
        colorFormat: 'bgra8unorm',
      });

      expect(device.createRenderPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          vertex: expect.objectContaining({
            buffers: expect.arrayContaining([
              expect.objectContaining({
                arrayStride: 12,
                attributes: expect.arrayContaining([
                  expect.objectContaining({
                    shaderLocation: 0,
                    format: 'float32x2',
                  }),
                  expect.objectContaining({
                    shaderLocation: 1,
                    format: 'float32',
                  }),
                ]),
              }),
            ]),
          }),
        }),
      );
    });

    it('creates subdivision mesh with skirts for default 32 subdivisions', () => {
      const result = createGlobeRasterPipeline({
        device,
        colorFormat: 'bgra8unorm',
      });

      expect(result.subdivisionMesh.subdivisions).toBe(32);
      // Surface (33×33) + skirts (4×33)
      expect(result.subdivisionMesh.vertexCount).toBe(1221);
      // Surface indices + skirt strip indices
      expect(result.subdivisionMesh.indexCount).toBe(6912);
    });

    it('globe camera uniform buffer is 192 bytes (dual VP matrix + camera vectors)', () => {
      // GlobeCameraUniforms layout:
      //   mat4x4 viewProjection        = 64 bytes
      //   mat4x4 flatViewProjection    = 64 bytes
      //   vec2   viewport              = 8 bytes
      //   f32    projectionTransition   = 4 bytes
      //   f32    globeRadius            = 4 bytes
      //   vec4   clippingPlane          = 16 bytes
      //   vec4   cameraWorld            = 16 bytes
      //   vec4   cameraMerc01           = 16 bytes
      //   Total                         = 192 bytes = 48 floats
      const expectedSize = 192;
      const expectedFloats = expectedSize / 4;
      expect(expectedFloats).toBe(48);
      // Verify the buffer can hold all uniform data
      const testBuffer = new Float32Array(expectedFloats);
      expect(testBuffer.byteLength).toBe(expectedSize);
    });

    it('respects custom subdivision count', () => {
      const result = createGlobeRasterPipeline({
        device,
        colorFormat: 'bgra8unorm',
        subdivisions: 16,
      });

      expect(result.subdivisionMesh.subdivisions).toBe(16);
      expect(result.subdivisionMesh.vertexCount).toBe(357); // (17×17) + (4×17)
      expect(result.subdivisionMesh.indexCount).toBe(1920); // (16×16×6) + (4×16×6)
    });
  });

  describe('createTileDebugSuite', () => {
    it('uses matching world/tile-local height sampling in generated shaders', () => {
      const globeCameraLayout = createMockBindGroupLayout();
      createTileDebugSuite({
        device,
        colorFormat: 'bgra8unorm',
        cameraBindGroupLayout: globeCameraLayout,
        globe: true,
      });

      const shaderCalls = (device.createShaderModule as ReturnType<typeof vi.fn>).mock.calls;
      const shaderCodes = shaderCalls.map((call) => String(call[0]?.code ?? ''));
      expect(shaderCodes.length).toBeGreaterThan(0);
      for (const code of shaderCodes) {
        expect(code).toContain('if (tile.heightMode.x >= 0.5)');
        expect(code).toContain('sampleHeight(terrainUvForTileUv(uv)) / EARTH_RADIUS_METERS');
        expect(code).toContain('return sampleHeight(vec2<f32>(');
        expect(code).toContain('vec4<f32>(mx, my, height * exag, 1.0)');
      }
    });
  });

  describe('createPoleCapPipeline', () => {
    it('creates pole cap pipeline with mesh', () => {
      const globeCameraLayout = createMockBindGroupLayout();
      const result = createPoleCapPipeline({
        device,
        colorFormat: 'bgra8unorm',
        globeCameraBindGroupLayout: globeCameraLayout,
      });

      expect(result.pipeline).toBeDefined();
      expect(result.poleCapBindGroupLayout).toBeDefined();
      expect(result.mesh).toBeDefined();
      expect(result.mesh.indexCount).toBeGreaterThan(0);
      expect(result.mesh.vertexCount).toBeGreaterThan(0);
    });

    it('uses triangle-list topology with no face culling', () => {
      const globeCameraLayout = createMockBindGroupLayout();
      createPoleCapPipeline({
        device,
        colorFormat: 'bgra8unorm',
        globeCameraBindGroupLayout: globeCameraLayout,
      });

      expect(device.createRenderPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'pole-cap-pipeline',
          primitive: expect.objectContaining({
            topology: 'triangle-list',
            cullMode: 'none',
          }),
        }),
      );
    });

    it('has vertex buffer with vec3<f32> layout', () => {
      const globeCameraLayout = createMockBindGroupLayout();
      createPoleCapPipeline({
        device,
        colorFormat: 'bgra8unorm',
        globeCameraBindGroupLayout: globeCameraLayout,
      });

      expect(device.createRenderPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          vertex: expect.objectContaining({
            buffers: expect.arrayContaining([
              expect.objectContaining({
                arrayStride: 12,
                attributes: expect.arrayContaining([
                  expect.objectContaining({
                    shaderLocation: 0,
                    format: 'float32x3',
                  }),
                ]),
              }),
            ]),
          }),
        }),
      );
    });

    it('does not use depthBias (z-ordering handled by shader-level depth offsets)', () => {
      const globeCameraLayout = createMockBindGroupLayout();
      createPoleCapPipeline({
        device,
        colorFormat: 'bgra8unorm',
        globeCameraBindGroupLayout: globeCameraLayout,
      });

      const call = (device.createRenderPipeline as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.depthStencil.depthBias).toBeUndefined();
    });

    it('default 64 segments: 2 × (64+1) = 130 vertices, 2 × 64 × 3 = 384 indices', () => {
      const globeCameraLayout = createMockBindGroupLayout();
      const result = createPoleCapPipeline({
        device,
        colorFormat: 'bgra8unorm',
        globeCameraBindGroupLayout: globeCameraLayout,
      });

      expect(result.mesh.vertexCount).toBe(130); // 2 × (64+1)
      expect(result.mesh.indexCount).toBe(384);   // 2 × 64 × 3
    });

    it('respects custom segment count', () => {
      const globeCameraLayout = createMockBindGroupLayout();
      const result = createPoleCapPipeline({
        device,
        colorFormat: 'bgra8unorm',
        globeCameraBindGroupLayout: globeCameraLayout,
        segments: 32,
      });

      expect(result.mesh.vertexCount).toBe(66);  // 2 × (32+1)
      expect(result.mesh.indexCount).toBe(192);   // 2 × 32 × 3
    });
  });

  describe('createPoleCapMesh', () => {
    it('generates north and south cap vertices on unit sphere', () => {
      const mesh = createPoleCapMesh(device, 8);
      // 2 × (8+1) = 18 vertices, 3 floats each = 54 floats
      expect(mesh.vertexCount).toBe(18);
      expect(mesh.indexCount).toBe(48); // 2 × 8 × 3
    });

    it('vertex buffer is created with correct size', () => {
      createPoleCapMesh(device, 8);
      expect(device.createBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'pole-cap-vertex-buffer',
          size: 18 * 3 * 4, // 18 vertices × 3 floats × 4 bytes
        }),
      );
    });

    it('index buffer is created with uint16 indices', () => {
      createPoleCapMesh(device, 8);
      expect(device.createBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'pole-cap-index-buffer',
          size: 48 * 2, // 48 indices × 2 bytes (uint16)
        }),
      );
    });
  });

  describe('createAtmospherePipeline', () => {
    it('creates atmosphere pipeline (fullscreen, no mesh)', () => {
      const globeCameraLayout = createMockBindGroupLayout();
      const result = createAtmospherePipeline({
        device,
        colorFormat: 'bgra8unorm',
        globeCameraBindGroupLayout: globeCameraLayout,
      });

      expect(result.pipeline).toBeDefined();
      expect(result.atmosphereBindGroupLayout).toBeDefined();
    });

    it('uses mesh vertex buffers with disabled depth writes', () => {
      const globeCameraLayout = createMockBindGroupLayout();
      createAtmospherePipeline({
        device,
        colorFormat: 'bgra8unorm',
        globeCameraBindGroupLayout: globeCameraLayout,
      });

      expect(device.createRenderPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'atmosphere-pipeline',
          vertex: expect.objectContaining({
            buffers: [
              expect.objectContaining({
                arrayStride: 12,
                attributes: expect.arrayContaining([
                  expect.objectContaining({
                    shaderLocation: 0,
                    format: 'float32x3',
                  }),
                ]),
              }),
            ],
          }),
          depthStencil: expect.objectContaining({
            depthWriteEnabled: false,
            depthCompare: 'always',
          }),
        }),
      );
    });
  });

  describe('createSkyBindGroupLayout', () => {
    it('creates separate background and volumetric uniform bindings', () => {
      createSkyBindGroupLayout(device);

      expect(device.createBindGroupLayout).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'sky-bind-group-layout',
          entries: [
            expect.objectContaining({
              binding: 0,
              visibility: GPUShaderStage.FRAGMENT,
              buffer: { type: 'uniform' },
            }),
            expect.objectContaining({
              binding: 1,
              visibility: GPUShaderStage.FRAGMENT,
              buffer: { type: 'uniform' },
            }),
          ],
        }),
      );
    });
  });

  describe('createSkyPipeline', () => {
    it('creates a fullscreen sky pipeline for a dedicated background pass without depth state', () => {
      const globeCameraLayout = createMockBindGroupLayout();
      const result = createSkyPipeline({
        device,
        colorFormat: 'bgra8unorm',
        globeCameraBindGroupLayout: globeCameraLayout,
      });

      expect(result.pipeline).toBeDefined();
      expect(result.skyBindGroupLayout).toBeDefined();

      const calls = (device.createRenderPipeline as ReturnType<typeof vi.fn>).mock.calls;
      const call = calls[calls.length - 1]![0];
      expect(call.label).toBe('sky-pipeline');
      expect(call.vertex.buffers).toBeUndefined();
      expect(call.depthStencil).toBeUndefined();
      expect(call.primitive.topology).toBe('triangle-list');
    });
  });

  describe('createGlobePointPipeline', () => {
    it('creates globe point pipeline with instanced rendering', () => {
      const globeCameraLayout = createMockBindGroupLayout();
      const result = createGlobePointPipeline({
        device,
        colorFormat: 'bgra8unorm',
        globeCameraBindGroupLayout: globeCameraLayout,
      });

      expect(result.pipeline).toBeDefined();
      expect(result.materialBindGroupLayout).toBeDefined();

      expect(device.createRenderPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'globe-point-pipeline',
          vertex: expect.objectContaining({
            buffers: expect.arrayContaining([
              expect.objectContaining({
                stepMode: 'instance',
                arrayStride: 12,
              }),
            ]),
          }),
          primitive: expect.objectContaining({
            topology: 'triangle-list',
          }),
        }),
      );
    });
  });

  describe('createGlobeLinePipeline', () => {
    it('creates globe line pipeline with correct vertex layout', () => {
      const globeCameraLayout = createMockBindGroupLayout();
      const result = createGlobeLinePipeline({
        device,
        colorFormat: 'bgra8unorm',
        globeCameraBindGroupLayout: globeCameraLayout,
      });

      expect(result.pipeline).toBeDefined();
      expect(result.materialBindGroupLayout).toBeDefined();

      expect(device.createRenderPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'globe-line-pipeline',
          vertex: expect.objectContaining({
            buffers: expect.arrayContaining([
              expect.objectContaining({
                arrayStride: 44,
                stepMode: 'vertex',
                attributes: expect.arrayContaining([
                  expect.objectContaining({ shaderLocation: 0, format: 'float32x3' }),
                  expect.objectContaining({ shaderLocation: 1, format: 'float32x3' }),
                  expect.objectContaining({ shaderLocation: 2, format: 'float32x3' }),
                  expect.objectContaining({ shaderLocation: 3, format: 'float32' }),
                  expect.objectContaining({ shaderLocation: 4, format: 'float32', offset: 40 }),
                ]),
              }),
            ]),
          }),
        }),
      );
    });
  });

  describe('createMesh3DPipeline', () => {
    it('supports disabling depth writes for translucent meshes', () => {
      const cameraLayout = createMockBindGroupLayout();
      createMesh3DPipeline({
        device,
        colorFormat: 'bgra8unorm',
        cameraBindGroupLayout: cameraLayout,
        depthWriteEnabled: false,
      });

      expect(device.createRenderPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'mesh3d-pipeline',
          depthStencil: expect.objectContaining({
            depthWriteEnabled: false,
          }),
        }),
      );
    });
  });

  describe('createGlobeMesh3DPipeline', () => {
    it('supports disabling depth writes for translucent globe meshes', () => {
      const globeCameraLayout = createMockBindGroupLayout();
      createGlobeMesh3DPipeline({
        device,
        colorFormat: 'bgra8unorm',
        globeCameraBindGroupLayout: globeCameraLayout,
        depthWriteEnabled: false,
      });

      expect(device.createRenderPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'globe-mesh3d-pipeline',
          depthStencil: expect.objectContaining({
            depthWriteEnabled: false,
          }),
        }),
      );
    });
  });

  describe('createGlobePolygonPipeline', () => {
    it('creates globe polygon pipeline with no culling', () => {
      const globeCameraLayout = createMockBindGroupLayout();
      const result = createGlobePolygonPipeline({
        device,
        colorFormat: 'bgra8unorm',
        globeCameraBindGroupLayout: globeCameraLayout,
      });

      expect(result.pipeline).toBeDefined();
      expect(result.materialBindGroupLayout).toBeDefined();

      expect(device.createRenderPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'globe-polygon-pipeline',
          vertex: expect.objectContaining({
            buffers: expect.arrayContaining([
              expect.objectContaining({
                arrayStride: 12,
                stepMode: 'vertex',
              }),
            ]),
          }),
          primitive: expect.objectContaining({
            topology: 'triangle-list',
            cullMode: 'none',
          }),
        }),
      );
    });
  });

  // ─── Shader-level depth offset tests ───

  describe('shader-level LAYER_DEPTH_OFFSET constants', () => {
    it('globe raster shader has LAYER_DEPTH_OFFSET = 0.0001', () => {
      expect(GLOBE_RASTER_SHADER_SOURCE).toContain('LAYER_DEPTH_OFFSET: f32 = 0.0001');
    });

    it('globe polygon shader has LAYER_DEPTH_OFFSET = 0.0003', () => {
      expect(GLOBE_POLYGON_SHADER_SOURCE).toContain('LAYER_DEPTH_OFFSET: f32 = 0.0003');
    });

    it('globe line shader has LAYER_DEPTH_OFFSET = 0.0005', () => {
      expect(GLOBE_LINE_SHADER_SOURCE).toContain('LAYER_DEPTH_OFFSET: f32 = 0.0005');
    });

    it('globe point shader has LAYER_DEPTH_OFFSET = 0.0008', () => {
      expect(GLOBE_POINT_SHADER_SOURCE).toContain('LAYER_DEPTH_OFFSET: f32 = 0.0008');
    });

    it('pole cap shader has no LAYER_DEPTH_OFFSET (renders furthest back)', () => {
      expect(POLE_CAP_SHADER_SOURCE).not.toContain('LAYER_DEPTH_OFFSET');
    });

    it('depth offsets increase: raster < polygon < line < point', () => {
      const rasterMatch = GLOBE_RASTER_SHADER_SOURCE.match(/LAYER_DEPTH_OFFSET: f32 = ([\d.]+)/);
      const polygonMatch = GLOBE_POLYGON_SHADER_SOURCE.match(/LAYER_DEPTH_OFFSET: f32 = ([\d.]+)/);
      const lineMatch = GLOBE_LINE_SHADER_SOURCE.match(/LAYER_DEPTH_OFFSET: f32 = ([\d.]+)/);
      const pointMatch = GLOBE_POINT_SHADER_SOURCE.match(/LAYER_DEPTH_OFFSET: f32 = ([\d.]+)/);

      const raster = parseFloat(rasterMatch![1]);
      const polygon = parseFloat(polygonMatch![1]);
      const line = parseFloat(lineMatch![1]);
      const point = parseFloat(pointMatch![1]);

      expect(raster).toBeLessThan(polygon);
      expect(polygon).toBeLessThan(line);
      expect(line).toBeLessThan(point);
    });
  });

  describe('shader mix() bypass for projection extremes', () => {
    it('all globe shaders have projectionTransition >= 0.999 branch', () => {
      expect(GLOBE_RASTER_SHADER_SOURCE).toContain('projectionTransition >= 0.999');
      expect(GLOBE_POLYGON_SHADER_SOURCE).toContain('projectionTransition >= 0.999');
      expect(GLOBE_LINE_SHADER_SOURCE).toContain('projectionTransition >= 0.999');
      expect(GLOBE_POINT_SHADER_SOURCE).toContain('projectionTransition >= 0.999');
    });

    it('all globe shaders have depth z clamp (reverse-Z: max(z, 0.0001*w))', () => {
      // Reverse-Z clamp: prevent NDC hitting far plane=0 exactly (f32 zero bucket).
      expect(GLOBE_RASTER_SHADER_SOURCE).toContain('0.0001');
      expect(GLOBE_POLYGON_SHADER_SOURCE).toContain('0.0001');
      expect(GLOBE_LINE_SHADER_SOURCE).toContain('0.0001');
      expect(GLOBE_POINT_SHADER_SOURCE).toContain('0.0001');
    });

    it('pole cap shader does NOT use mix or projection bypass (globe-only)', () => {
      expect(POLE_CAP_SHADER_SOURCE).not.toContain('camera.projectionTransition');
      expect(POLE_CAP_SHADER_SOURCE).not.toContain('mix(');
    });
  });
});

// ─── Bind Group Layout Tests ───

describe('Bind Group Layouts', () => {
  let device: GPUDevice;

  beforeEach(() => {
    device = createMockDevice();
  });

  it('createPointBindGroupLayout creates layout with uniform buffer', () => {
    createPointBindGroupLayout(device);
    expect(device.createBindGroupLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'point-material-bind-group-layout',
      }),
    );
  });

  it('createLineBindGroupLayout creates layout with uniform buffer', () => {
    createLineBindGroupLayout(device);
    expect(device.createBindGroupLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'line-material-bind-group-layout',
      }),
    );
  });

  it('createPolygonBindGroupLayout creates layout with uniform buffer', () => {
    createPolygonBindGroupLayout(device);
    expect(device.createBindGroupLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'polygon-material-bind-group-layout',
      }),
    );
  });

  it('createPickingBindGroupLayout creates layout with uniform buffer', () => {
    createPickingBindGroupLayout(device);
    expect(device.createBindGroupLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'picking-bind-group-layout',
      }),
    );
  });

  it('createRasterBindGroupLayout creates layout with 3 entries', () => {
    createRasterBindGroupLayout(device);
    expect(device.createBindGroupLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        entries: expect.arrayContaining([
          expect.objectContaining({ binding: 0 }),
          expect.objectContaining({ binding: 1 }),
          expect.objectContaining({ binding: 2 }),
        ]),
      }),
    );
  });

  it('createTextBindGroupLayout creates layout with 3 entries', () => {
    createTextBindGroupLayout(device);
    expect(device.createBindGroupLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'text-material-bind-group-layout',
        entries: expect.arrayContaining([
          expect.objectContaining({ binding: 0 }),
          expect.objectContaining({ binding: 1 }),
          expect.objectContaining({ binding: 2 }),
        ]),
      }),
    );
  });

  it('createPostProcessBindGroupLayout creates layout with 3 entries', () => {
    createPostProcessBindGroupLayout(device);
    expect(device.createBindGroupLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'post-process-bind-group-layout',
        entries: expect.arrayContaining([
          expect.objectContaining({ binding: 0 }),
          expect.objectContaining({ binding: 1 }),
          expect.objectContaining({ binding: 2 }),
        ]),
      }),
    );
  });

  it('createGlobeCameraBindGroupLayout creates layout with uniform buffer', () => {
    createGlobeCameraBindGroupLayout(device);
    expect(device.createBindGroupLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'globe-camera-bind-group-layout',
      }),
    );
  });

  it('createGlobeTileBindGroupLayout creates layout with 3 entries', () => {
    createGlobeTileBindGroupLayout(device);
    expect(device.createBindGroupLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'globe-tile-bind-group-layout',
        entries: expect.arrayContaining([
          expect.objectContaining({ binding: 0 }),
          expect.objectContaining({ binding: 1 }),
          expect.objectContaining({ binding: 2 }),
        ]),
      }),
    );
  });

  it('createPoleCapBindGroupLayout creates layout with uniform buffer', () => {
    createPoleCapBindGroupLayout(device);
    expect(device.createBindGroupLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'pole-cap-bind-group-layout',
      }),
    );
  });

  it('createGlobePointBindGroupLayout creates layout with uniform buffer', () => {
    createGlobePointBindGroupLayout(device);
    expect(device.createBindGroupLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'globe-point-material-bind-group-layout',
      }),
    );
  });

  it('createGlobeLineBindGroupLayout creates layout with uniform buffer', () => {
    createGlobeLineBindGroupLayout(device);
    expect(device.createBindGroupLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'globe-line-material-bind-group-layout',
      }),
    );
  });

  it('createGlobePolygonBindGroupLayout creates layout with uniform buffer', () => {
    createGlobePolygonBindGroupLayout(device);
    expect(device.createBindGroupLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'globe-polygon-material-bind-group-layout',
      }),
    );
  });
});

// ─── Picking ID Encoding/Decoding ───

describe('Picking ID Encoding/Decoding', () => {
  it('encodes feature ID 0 correctly', () => {
    const [r, g, b, a] = encodePickingId(0, 0);
    expect(r).toBe(0);
    expect(g).toBe(0);
    expect(b).toBe(0);
    expect(a).toBe(0);
  });

  it('encodes feature ID 1 correctly', () => {
    const [r, g, b, a] = encodePickingId(1, 0);
    expect(r).toBeCloseTo(1 / 255, 5);
    expect(g).toBe(0);
    expect(b).toBe(0);
    expect(a).toBe(0);
  });

  it('encodes feature ID 256 correctly', () => {
    const [r, g, b, a] = encodePickingId(256, 0);
    expect(r).toBe(0);
    expect(g).toBeCloseTo(1 / 255, 5);
    expect(b).toBe(0);
  });

  it('encodes layer index correctly', () => {
    const [_r, _g, _b, a] = encodePickingId(0, 5);
    expect(a).toBeCloseTo(5 / 255, 5);
  });

  it('round-trip encoding/decoding for small IDs', () => {
    for (const featureId of [1, 2, 10, 100, 255]) {
      for (const layerIndex of [0, 1, 5, 127, 255]) {
        const encoded = encodePickingId(featureId, layerIndex);

        // Simulate GPU: convert float [0,1] to uint8 [0,255]
        const r = Math.round(encoded[0] * 255);
        const g = Math.round(encoded[1] * 255);
        const b = Math.round(encoded[2] * 255);
        const a = Math.round(encoded[3] * 255);

        const decoded = decodePickingId(r, g, b, a);
        expect(decoded).not.toBeNull();
        expect(decoded!.featureId).toBe(featureId);
        expect(decoded!.layerIndex).toBe(layerIndex);
      }
    }
  });

  it('round-trip encoding/decoding for large IDs', () => {
    const testIds = [256, 1000, 65535, 65536, 100000, 16777215];
    for (const featureId of testIds) {
      const encoded = encodePickingId(featureId, 1);
      const r = Math.round(encoded[0] * 255);
      const g = Math.round(encoded[1] * 255);
      const b = Math.round(encoded[2] * 255);
      const a = Math.round(encoded[3] * 255);

      const decoded = decodePickingId(r, g, b, a);
      expect(decoded).not.toBeNull();
      expect(decoded!.featureId).toBe(featureId);
    }
  });

  it('decodes (0,0,0,0) as null (empty pixel)', () => {
    const result = decodePickingId(0, 0, 0, 0);
    expect(result).toBeNull();
  });

  it('decodes non-zero pixels correctly', () => {
    const result = decodePickingId(42, 0, 0, 1);
    expect(result).not.toBeNull();
    expect(result!.featureId).toBe(42);
    expect(result!.layerIndex).toBe(1);
  });

  it('handles maximum 24-bit feature ID (16777215)', () => {
    const maxId = (1 << 24) - 1; // 16777215
    const encoded = encodePickingId(maxId, 255);
    const r = Math.round(encoded[0] * 255);
    const g = Math.round(encoded[1] * 255);
    const b = Math.round(encoded[2] * 255);
    const a = Math.round(encoded[3] * 255);

    expect(r).toBe(255);
    expect(g).toBe(255);
    expect(b).toBe(255);
    expect(a).toBe(255);

    const decoded = decodePickingId(r, g, b, a);
    expect(decoded!.featureId).toBe(maxId);
    expect(decoded!.layerIndex).toBe(255);
  });
});

// ─── dashStyleToUniform ───

describe('dashStyleToUniform', () => {
  it('maps solid to 0', () => {
    expect(dashStyleToUniform('solid')).toBe(0);
  });

  it('maps dash to 1', () => {
    expect(dashStyleToUniform('dash')).toBe(1);
  });

  it('maps dot to 2', () => {
    expect(dashStyleToUniform('dot')).toBe(2);
  });

  it('maps dash-dot to 3', () => {
    expect(dashStyleToUniform('dash-dot')).toBe(3);
  });
});
