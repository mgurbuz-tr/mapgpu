/**
 * Globe Icon Pipeline
 *
 * WGSL shader: EPSG:3857 position → Mercator [0..1] → Angular → Unit Sphere.
 * Billboard quad per point with sprite atlas texture sampling.
 * GlobeCameraUniforms (160 byte) ile dual projection + horizon occlusion.
 */

import { WGSL_GLOBE_HEIGHT_SEMANTICS, WGSL_GLOBE_PREAMBLE } from './wgsl-preambles.js';
import { MSAA_SAMPLE_COUNT } from '../frame-context.js';

// ─── WGSL Shader ───

export const GLOBE_ICON_SHADER_SOURCE = /* wgsl */ `

// ─── Constants ───
${WGSL_GLOBE_PREAMBLE}
${WGSL_GLOBE_HEIGHT_SEMANTICS}

// ─── Bindings ───

struct IconMaterial {
  tintColor: vec4<f32>,
  uvRect: vec4<f32>,
  size: f32,
  rotation: f32,
  bgRadius: f32,
  outlineWidth: f32,
  bgColor: vec4<f32>,
  outlineColor: vec4<f32>,
};

@group(1) @binding(0) var<uniform> material: IconMaterial;
@group(1) @binding(1) var iconSampler: sampler;
@group(1) @binding(2) var iconTexture: texture_2d<f32>;

// ─── Vertex ───

struct VertexInput {
  @location(0) position: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) clipDot: f32,
};

@vertex
fn vs_main(
  input: VertexInput,
  @builtin(vertex_index) vid: u32,
) -> VertexOutput {
  var quadOffsets = array<vec2<f32>, 6>(
    vec2<f32>(-0.5, -0.5),
    vec2<f32>( 0.5, -0.5),
    vec2<f32>(-0.5,  0.5),
    vec2<f32>(-0.5,  0.5),
    vec2<f32>( 0.5, -0.5),
    vec2<f32>( 0.5,  0.5),
  );

  let offset = quadOffsets[vid];

  // Apply rotation
  let rad = material.rotation * 3.14159265 / 180.0;
  let cosR = cos(rad);
  let sinR = sin(rad);
  let rotatedOffset = vec2<f32>(
    offset.x * cosR - offset.y * sinR,
    offset.x * sinR + offset.y * cosR,
  );

  // Raw UV for fragment shader (0-1 across quad)
  let uv = offset + vec2<f32>(0.5, 0.5);

  // EPSG:3857 → Mercator [0..1] → Angular → Sphere
  let merc01 = epsg3857ToMerc01(input.position);
  let angular = mercatorToAngular(merc01);
  let baseSphere = angularToSphere(angular.x, angular.y);

  // Altitude: Z is meters above sea level → convert to unit sphere fraction
  let altFrac = altitudeOffset(input.position.z);
  let spherePos = baseSphere * (1.0 + altFrac);

  // Globe clip space (Phase 2 redesign: GPU perspective Z, override kaldırıldı)
  var globeClip = camera.viewProjection * vec4<f32>(spherePos, 1.0);

  var clipCenter: vec4<f32>;
  if (camera.projectionTransition >= 0.999) {
    clipCenter = globeClip;
  } else if (camera.projectionTransition <= 0.001) {
    clipCenter = camera.flatViewProjection * vec4<f32>(merc01.x, merc01.y, altFrac, 1.0);
  } else {
    let flatClip = camera.flatViewProjection * vec4<f32>(merc01.x, merc01.y, altFrac, 1.0);
    clipCenter = mix(flatClip, globeClip, camera.projectionTransition);
  }
  let clipDot = dot(spherePos, camera.clippingPlane.xyz) + camera.clippingPlane.w;

  // Billboard offset: expand for background circle if present
  var pixelSize = material.size;
  if (material.bgRadius > 0.0) {
    pixelSize = max(material.size, material.bgRadius * 2.0 + material.outlineWidth * 2.0);
  }
  let screenOffset = rotatedOffset * pixelSize;
  let ndcOffset = vec2<f32>(
    screenOffset.x * 2.0 / camera.viewport.x,
    screenOffset.y * 2.0 / camera.viewport.y,
  );

  // Shader-level depth offset: icons render in front of lines.
  // Reverse-Z: + işareti kameraya yakın, clamp MIN far'a yakın değer.
  const LAYER_DEPTH_OFFSET: f32 = 0.0008;
  let adjustedZ = clipCenter.z + LAYER_DEPTH_OFFSET * clipCenter.w;
  let clampedZ = max(adjustedZ, clipCenter.w * 0.0001);

  var out: VertexOutput;
  out.clipPosition = vec4<f32>(
    clipCenter.x + ndcOffset.x * clipCenter.w,
    clipCenter.y + ndcOffset.y * clipCenter.w,
    clampedZ,
    clipCenter.w,
  );
  out.uv = uv;
  out.clipDot = clipDot;
  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // Horizon discard
  if (camera.projectionTransition > 0.01 && input.clipDot < -0.01) {
    discard;
  }

  let centered = input.uv - vec2<f32>(0.5, 0.5);

  // ── No background: original icon-only path ──
  if (material.bgRadius <= 0.0) {
    let atlasUV = vec2<f32>(
      mix(material.uvRect.x, material.uvRect.z, input.uv.x),
      mix(material.uvRect.y, material.uvRect.w, input.uv.y),
    );
    let texColor = textureSample(iconTexture, iconSampler, atlasUV);
    if (texColor.a < 0.01) { discard; }
    return vec4<f32>(texColor.rgb * material.tintColor.rgb, texColor.a * material.tintColor.a);
  }

  // ── Background circle mode ──
  let totalSize = max(material.size, material.bgRadius * 2.0 + material.outlineWidth * 2.0);
  let pixelDist = length(centered) * totalSize;
  let outerEdge = material.bgRadius + material.outlineWidth;
  let aa = fwidth(pixelDist);

  // Sample icon texture unconditionally (uniform control flow)
  let iconLocalUV = clamp(centered * totalSize / material.size + vec2<f32>(0.5, 0.5), vec2<f32>(0.0), vec2<f32>(1.0));
  let atlasUV = vec2<f32>(
    mix(material.uvRect.x, material.uvRect.z, iconLocalUV.x),
    mix(material.uvRect.y, material.uvRect.w, iconLocalUV.y),
  );
  let texColor = textureSample(iconTexture, iconSampler, atlasUV);

  if (pixelDist > outerEdge + aa) { discard; }

  if (pixelDist > material.bgRadius) {
    let outerAlpha = 1.0 - smoothstep(outerEdge - aa, outerEdge + aa, pixelDist);
    return vec4<f32>(material.outlineColor.rgb, material.outlineColor.a * outerAlpha);
  }

  var result = material.bgColor;
  let iconHalf = material.size * 0.5;
  let pixelPos = centered * totalSize;
  let inIcon = step(abs(pixelPos.x), iconHalf) * step(abs(pixelPos.y), iconHalf);
  let tinted = vec4<f32>(
    texColor.rgb * material.tintColor.rgb,
    texColor.a * material.tintColor.a * inIcon,
  );
  result = vec4<f32>(
    mix(result.rgb, tinted.rgb, tinted.a),
    result.a + tinted.a * (1.0 - result.a),
  );

  return result;
}
`;

// ─── Bind Group Layout ───

export function createGlobeIconBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'globe-icon-material-bind-group-layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: 'filtering' },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'float' },
      },
    ],
  });
}

// ─── Pipeline ───

export interface GlobeIconPipelineDescriptor {
  device: GPUDevice;
  colorFormat: GPUTextureFormat;
  globeCameraBindGroupLayout: GPUBindGroupLayout;
  depthFormat?: GPUTextureFormat;
  depthCompare?: GPUCompareFunction;
  sampleCount?: number;
}

export interface GlobeIconPipeline {
  pipeline: GPURenderPipeline;
  materialBindGroupLayout: GPUBindGroupLayout;
  sampler: GPUSampler;
}

export function createGlobeIconPipeline(
  desc: GlobeIconPipelineDescriptor,
): GlobeIconPipeline {
  const { device, colorFormat, globeCameraBindGroupLayout } = desc;

  const materialBindGroupLayout = createGlobeIconBindGroupLayout(device);

  const shaderModule = device.createShaderModule({
    label: 'globe-icon-shader',
    code: GLOBE_ICON_SHADER_SOURCE,
  });

  const pipelineLayout = device.createPipelineLayout({
    label: 'globe-icon-pipeline-layout',
    bindGroupLayouts: [globeCameraBindGroupLayout, materialBindGroupLayout],
  });

  const pipeline = device.createRenderPipeline({
    label: 'globe-icon-pipeline',
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
      buffers: [
        {
          arrayStride: 12, // vec3<f32>
          stepMode: 'instance',
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: 'float32x3',
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
    },
    depthStencil: {
      format: desc.depthFormat ?? 'depth32float',
      depthWriteEnabled: true,
      // Reverse-Z default: 3D globe mode compareFunc='greater' (clearValue=0).
      depthCompare: desc.depthCompare ?? 'greater',
    },
    multisample: {
      count: desc.sampleCount ?? MSAA_SAMPLE_COUNT,
    },
  });

  const sampler = device.createSampler({
    label: 'globe-icon-atlas-sampler',
    magFilter: 'linear',
    minFilter: 'linear',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
  });

  return { pipeline, materialBindGroupLayout, sampler };
}
