/**
 * Picking Pipeline
 *
 * Offscreen render pass: her feature'a unique ID rengi atar.
 * Feature ID -> RGBA encoding (24-bit ID + 8-bit layer index).
 * readback: mapAsync ile piksel okuma.
 */

import { WGSL_CAMERA_UNIFORMS } from './wgsl-preambles.js';

// ─── WGSL Shader ───

export const PICKING_SHADER_SOURCE = /* wgsl */ `

// ─── Bindings ───
${WGSL_CAMERA_UNIFORMS}

struct PickingUniforms {
  // Feature ID encoded as color: R = id & 0xFF, G = (id >> 8) & 0xFF, B = (id >> 16) & 0xFF
  // A = layer index
  featureColor: vec4<f32>,
};

@group(1) @binding(0) var<uniform> picking: PickingUniforms;

// ─── Vertex ───

struct VertexInput {
  @location(0) position: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  // Picking must mirror flat surface rendering: clamp 2D surfaces to z=0.
  out.clipPosition = camera.viewProjection * vec4<f32>(input.position.xy, 0.0, 1.0);
  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  return picking.featureColor;
}
`;

// ─── Bind Group Layout ───

/**
 * Picking uniform bind group layout (group 1).
 */
export function createPickingBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'picking-bind-group-layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
    ],
  });
}

// ─── Pipeline ───

export interface PickingPipelineDescriptor {
  device: GPUDevice;
  cameraBindGroupLayout: GPUBindGroupLayout;
  depthFormat?: GPUTextureFormat;
  depthCompare?: GPUCompareFunction;
}

export interface PickingPipeline {
  pipeline: GPURenderPipeline;
  pickingBindGroupLayout: GPUBindGroupLayout;
  pickingTexture: GPUTexture;
  depthTexture: GPUTexture;
  readbackBuffer: GPUBuffer;
  width: number;
  height: number;
}

/**
 * Picking render pipeline oluştur.
 * Offscreen rgba8unorm texture'a render eder.
 */
export function createPickingPipeline(desc: PickingPipelineDescriptor & { width: number; height: number }): PickingPipeline {
  const { device, cameraBindGroupLayout, width, height } = desc;

  const pickingBindGroupLayout = createPickingBindGroupLayout(device);

  const shaderModule = device.createShaderModule({
    label: 'picking-shader',
    code: PICKING_SHADER_SOURCE,
  });

  const pipelineLayout = device.createPipelineLayout({
    label: 'picking-pipeline-layout',
    bindGroupLayouts: [cameraBindGroupLayout, pickingBindGroupLayout],
  });

  const pipeline = device.createRenderPipeline({
    label: 'picking-pipeline',
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
      buffers: [
        {
          arrayStride: 12, // vec3<f32>
          stepMode: 'vertex',
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
          format: 'rgba8unorm',
          // No blending for picking — exact ID colors
        },
      ],
    },
    primitive: {
      topology: 'triangle-list',
    },
    depthStencil: {
      format: desc.depthFormat ?? 'depth32float',
      depthWriteEnabled: true,
      depthCompare: desc.depthCompare ?? 'less',
    },
  });

  // Offscreen picking texture
  const pickingTexture = device.createTexture({
    label: 'picking-texture',
    size: { width, height },
    format: 'rgba8unorm',
    usage:
      GPUTextureUsage.RENDER_ATTACHMENT |
      GPUTextureUsage.COPY_SRC,
  });

  // Depth texture for picking pass
  const depthTexture = device.createTexture({
    label: 'picking-depth-texture',
    size: { width, height },
    format: desc.depthFormat ?? 'depth32float',
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  // Readback buffer: 4 bytes (1 pixel RGBA)
  const readbackBuffer = device.createBuffer({
    label: 'picking-readback-buffer',
    size: 256, // Min 256 bytes for mapAsync alignment
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  return {
    pipeline,
    pickingBindGroupLayout,
    pickingTexture,
    depthTexture,
    readbackBuffer,
    width,
    height,
  };
}

// ─── ID Encoding/Decoding ───

/**
 * Feature ID ve layer index'i RGBA float renk değerlerine encode et.
 * 24-bit feature ID + 8-bit layer index.
 *
 * @param featureId 0..16777215 (24-bit)
 * @param layerIndex 0..255 (8-bit)
 * @returns [r, g, b, a] normalized 0..1
 */
export function encodePickingId(featureId: number, layerIndex: number): [number, number, number, number] {
  const r = (featureId & 0xFF) / 255;
  const g = ((featureId >> 8) & 0xFF) / 255;
  const b = ((featureId >> 16) & 0xFF) / 255;
  const a = (layerIndex & 0xFF) / 255;
  return [r, g, b, a];
}

/**
 * RGBA uint8 piksel değerlerinden feature ID ve layer index'i decode et.
 *
 * @param r 0..255
 * @param g 0..255
 * @param b 0..255
 * @param a 0..255
 * @returns { featureId, layerIndex } veya null (boş piksel)
 */
export function decodePickingId(
  r: number,
  g: number,
  b: number,
  a: number,
): { featureId: number; layerIndex: number } | null {
  // 0,0,0,0 = boş piksel (clear color)
  if (r === 0 && g === 0 && b === 0 && a === 0) {
    return null;
  }

  const featureId = r | (g << 8) | (b << 16);
  const layerIndex = a;

  return { featureId, layerIndex };
}

/**
 * Picking pass sonrası piksel oku.
 * mapAsync ile asenkron GPU readback yapar.
 *
 * @param device GPUDevice
 * @param pickingPipeline Picking pipeline state
 * @param x Ekran X koordinatı
 * @param y Ekran Y koordinatı
 * @returns Decoded feature ID veya null
 */
export async function readPickingPixel(
  device: GPUDevice,
  pickingPipeline: PickingPipeline,
  x: number,
  y: number,
): Promise<{ featureId: number; layerIndex: number } | null> {
  // Bounds check
  if (x < 0 || x >= pickingPipeline.width || y < 0 || y >= pickingPipeline.height) {
    return null;
  }

  const encoder = device.createCommandEncoder({ label: 'picking-readback-encoder' });

  // Copy single pixel from picking texture to readback buffer
  encoder.copyTextureToBuffer(
    {
      texture: pickingPipeline.pickingTexture,
      origin: { x: Math.floor(x), y: Math.floor(y) },
    },
    {
      buffer: pickingPipeline.readbackBuffer,
      bytesPerRow: 256, // Minimum alignment
    },
    { width: 1, height: 1 },
  );

  device.queue.submit([encoder.finish()]);

  // Map and read
  await pickingPipeline.readbackBuffer.mapAsync(GPUMapMode.READ);
  const data = new Uint8Array(pickingPipeline.readbackBuffer.getMappedRange(0, 4));
  const r = data[0]!;
  const g = data[1]!;
  const b = data[2]!;
  const a = data[3]!;
  pickingPipeline.readbackBuffer.unmap();

  return decodePickingId(r, g, b, a);
}
