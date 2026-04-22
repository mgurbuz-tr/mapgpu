/**
 * Silhouette Composite Pipeline
 *
 * Reads an offscreen single-channel mask texture (where each Gltf2 model has
 * written 1.0 to the pixels it covers) and runs a 3x3 Sobel edge-detection
 * filter to find the model silhouette. Edge pixels are alpha-blended onto
 * the swap chain in the configured outline color, leaving the rest of the
 * scene untouched.
 *
 * This is the screen-space equivalent of Cesium's
 * PostProcessStageLibrary.createSilhouetteStage(). Since it samples a mask
 * texture (not the scene color), we never need to feed the scene through an
 * offscreen color buffer — the composite pass simply alpha-blends outline
 * pixels onto whatever is already in the swap chain.
 */

// ─── WGSL Shader ───

export const SILHOUETTE_COMPOSITE_SHADER_SOURCE = /* wgsl */ `

struct SilhouetteUniforms {
  outlineColor: vec4<f32>,
  rcpScreenSize: vec2<f32>,
  outlineWidth: f32,
  threshold: f32,
};

@group(0) @binding(0) var<uniform> params: SilhouetteUniforms;
@group(0) @binding(1) var maskSampler: sampler;
@group(0) @binding(2) var maskTexture: texture_2d<f32>;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

// Full-screen triangle: 3 vertices covering [-1, 3] in clip space so the
// rasterized triangle entirely fills [-1, 1]. This is faster than a
// 4-vertex triangle-strip because it avoids the diagonal seam.
@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VertexOutput {
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 3.0, -1.0),
    vec2<f32>(-1.0,  3.0),
  );
  var uvs = array<vec2<f32>, 3>(
    vec2<f32>(0.0, 1.0),
    vec2<f32>(2.0, 1.0),
    vec2<f32>(0.0, -1.0),
  );

  var out: VertexOutput;
  out.position = vec4<f32>(positions[vid], 0.0, 1.0);
  out.uv = uvs[vid];
  return out;
}

// Sample the single-channel mask. We only care about the R component.
fn sampleMask(uv: vec2<f32>) -> f32 {
  return textureSample(maskTexture, maskSampler, uv).r;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // Outline width scales the sampling radius. Width 1 => 1-pixel kernel,
  // width 2 => 2-pixel kernel, etc. Cap at 4 to keep the shader O(1).
  let radius = clamp(params.outlineWidth, 1.0, 4.0);
  let step = params.rcpScreenSize * radius;

  // 3x3 Sobel kernel centered on the current pixel, sampling the mask.
  // The X kernel detects horizontal gradients; Y detects vertical.
  let tl = sampleMask(input.uv + vec2<f32>(-step.x, -step.y));
  let tc = sampleMask(input.uv + vec2<f32>(    0.0, -step.y));
  let tr = sampleMask(input.uv + vec2<f32>( step.x, -step.y));
  let ml = sampleMask(input.uv + vec2<f32>(-step.x,    0.0));
  let mc = sampleMask(input.uv);
  let mr = sampleMask(input.uv + vec2<f32>( step.x,    0.0));
  let bl = sampleMask(input.uv + vec2<f32>(-step.x,  step.y));
  let bc = sampleMask(input.uv + vec2<f32>(    0.0,  step.y));
  let br = sampleMask(input.uv + vec2<f32>( step.x,  step.y));

  let gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
  let gy = (bl + 2.0 * bc + br) - (tl + 2.0 * tc + tr);
  let edge = sqrt(gx * gx + gy * gy);

  // Threshold the edge magnitude. Because the mask is binary (0 or 1),
  // edge values cluster near 0 (interior/exterior) and near 4 (silhouette).
  // A small threshold gives a clean single-pixel outline.
  if (edge < params.threshold) {
    discard;
  }

  // Emit the outline color premultiplied by edge strength so the alpha
  // blend below produces an anti-aliased silhouette at the boundary.
  let strength = clamp(edge, 0.0, 1.0);
  return vec4<f32>(params.outlineColor.rgb, params.outlineColor.a * strength);
}
`;

// ─── Bind Group Layout ───

export function createSilhouetteCompositeBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'silhouette-composite-bind-group-layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
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

export interface SilhouetteCompositePipelineDescriptor {
  device: GPUDevice;
  colorFormat: GPUTextureFormat;
}

export interface SilhouetteCompositePipeline {
  pipeline: GPURenderPipeline;
  bindGroupLayout: GPUBindGroupLayout;
  sampler: GPUSampler;
}

/**
 * Uniform buffer layout (std140, 32 bytes total):
 *   vec4<f32> outlineColor      ->  0-15
 *   vec2<f32> rcpScreenSize     -> 16-23
 *   f32       outlineWidth      -> 24-27
 *   f32       threshold         -> 28-31
 */
export const SILHOUETTE_COMPOSITE_UNIFORM_SIZE = 32;

export function writeSilhouetteCompositeUniform(
  out: Float32Array,
  outlineColor: [number, number, number, number],
  rcpScreenSize: [number, number],
  outlineWidth: number,
  threshold: number,
): void {
  out[0] = outlineColor[0];
  out[1] = outlineColor[1];
  out[2] = outlineColor[2];
  out[3] = outlineColor[3];
  out[4] = rcpScreenSize[0];
  out[5] = rcpScreenSize[1];
  out[6] = outlineWidth;
  out[7] = threshold;
}

export function createSilhouetteCompositePipeline(
  desc: SilhouetteCompositePipelineDescriptor,
): SilhouetteCompositePipeline {
  const { device, colorFormat } = desc;

  const bindGroupLayout = createSilhouetteCompositeBindGroupLayout(device);

  const shaderModule = device.createShaderModule({
    label: 'silhouette-composite-shader',
    code: SILHOUETTE_COMPOSITE_SHADER_SOURCE,
  });

  const pipelineLayout = device.createPipelineLayout({
    label: 'silhouette-composite-pipeline-layout',
    bindGroupLayouts: [bindGroupLayout],
  });

  const pipeline = device.createRenderPipeline({
    label: 'silhouette-composite-pipeline',
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
          // Standard premultiplied-alpha-style src-over blend so the outline
          // color appears on top of the existing scene without darkening
          // unaffected pixels.
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
          },
        },
      ],
    },
    primitive: {
      topology: 'triangle-list',
    },
    // No depth/stencil — composite is a screen-space pass
  });

  // Single non-MSAA sampler for the mask (linear filtering for smoother
  // edges between pixels).
  const sampler = device.createSampler({
    label: 'silhouette-composite-sampler',
    magFilter: 'linear',
    minFilter: 'linear',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
  });

  return { pipeline, bindGroupLayout, sampler };
}
