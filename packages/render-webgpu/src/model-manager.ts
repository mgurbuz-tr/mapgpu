import type { ParsedGltf, ParsedGltfMaterial, ParsedGltfMesh } from './gltf-parser.js';

/** Per-primitive GPU resources — one draw call unit. */
export interface GpuModelPrimitive {
  /** Interleaved vertex buffer: [posX, posY, posZ, normX, normY, normZ, u, v] per vertex (32 bytes/vertex) */
  vertexBuffer: GPUBuffer;
  /** Index buffer (uint16 or uint32) */
  indexBuffer: GPUBuffer;
  /** Index format for setIndexBuffer call */
  indexFormat: GPUIndexFormat;
  /** Number of indices */
  indexCount: number;
  /** Number of vertices */
  vertexCount: number;
  /** PBR material data */
  material: ParsedGltfMaterial;
  /** PBR textures — null entries use the placeholder texture */
  baseColorTexture: GPUTexture | null;
  normalTexture: GPUTexture | null;
  metallicRoughnessTexture: GPUTexture | null;
  occlusionTexture: GPUTexture | null;
  emissiveTexture: GPUTexture | null;
}

export interface GpuModel {
  primitives: GpuModelPrimitive[];
}

export class ModelManager {
  private _device: GPUDevice;
  private _models = new Map<string, GpuModel>();

  constructor(device: GPUDevice) {
    this._device = device;
  }

  /**
   * Upload a parsed GLTF model to GPU buffers (synchronous — no textures).
   * Interleaves position/normal/texcoord into a single vertex buffer per primitive.
   */
  upload(id: string, parsed: ParsedGltf): void {
    if (this._models.has(id)) return;

    const primitives = parsed.primitives.map((prim, i) =>
      this._uploadPrimitive(id, prim.mesh, prim.material, i),
    );

    this._models.set(id, { primitives });
  }

  /**
   * Upload a parsed GLTF model with async texture creation.
   * Falls back to sync upload if no textures are present.
   */
  async uploadAsync(id: string, parsed: ParsedGltf): Promise<void> {
    if (this._models.has(id)) return;

    const primitives: GpuModelPrimitive[] = [];

    for (let i = 0; i < parsed.primitives.length; i++) {
      const prim = parsed.primitives[i]!;
      const gpuPrim = this._uploadPrimitive(id, prim.mesh, prim.material, i);

      // Upload all PBR textures from embedded image data
      const texSlots: { field: keyof Pick<GpuModelPrimitive, 'baseColorTexture' | 'normalTexture' | 'metallicRoughnessTexture' | 'occlusionTexture' | 'emissiveTexture'>; index?: number }[] = [
        { field: 'baseColorTexture', index: prim.material.baseColorTextureIndex },
        { field: 'normalTexture', index: prim.material.normalTextureIndex },
        { field: 'metallicRoughnessTexture', index: prim.material.metallicRoughnessTextureIndex },
        { field: 'occlusionTexture', index: prim.material.occlusionTextureIndex },
        { field: 'emissiveTexture', index: prim.material.emissiveTextureIndex },
      ];

      for (const slot of texSlots) {
        if (slot.index === undefined) continue;
        const imgData = prim.imageData.get(slot.index);
        if (!imgData) continue;
        try {
          const arrBuf = new ArrayBuffer(imgData.data.byteLength);
          new Uint8Array(arrBuf).set(imgData.data);
          const blob = new Blob([arrBuf], { type: imgData.mimeType });
          const bitmap = await createImageBitmap(blob);
          gpuPrim[slot.field] = this._createTextureFromBitmap(
            bitmap,
            `${id}-p${i}-${slot.field}`,
          );
          bitmap.close();
        } catch {
          // Texture decode failed — keep null
        }
      }

      primitives.push(gpuPrim);
    }

    this._models.set(id, { primitives });
  }

  /** Get a loaded model by ID */
  get(id: string): GpuModel | undefined {
    return this._models.get(id);
  }

  /** Check if a model is loaded */
  has(id: string): boolean {
    return this._models.has(id);
  }

  /** Release all GPU resources */
  destroy(): void {
    for (const model of this._models.values()) {
      for (const prim of model.primitives) {
        prim.vertexBuffer.destroy();
        prim.indexBuffer.destroy();
        prim.baseColorTexture?.destroy();
        prim.normalTexture?.destroy();
        prim.metallicRoughnessTexture?.destroy();
        prim.occlusionTexture?.destroy();
        prim.emissiveTexture?.destroy();
      }
    }
    this._models.clear();
  }

  // ── Private ──

  private _uploadPrimitive(
    modelId: string,
    mesh: ParsedGltfMesh,
    material: ParsedGltfMaterial,
    primIndex: number,
  ): GpuModelPrimitive {
    // Interleave: [posX, posY, posZ, normX, normY, normZ, u, v] × vertexCount
    const stride = 8;
    const interleaved = new Float32Array(mesh.vertexCount * stride);

    for (let i = 0; i < mesh.vertexCount; i++) {
      const vi = i * stride;
      const pi = i * 3;
      const ni = i * 3;
      const ti = i * 2;

      interleaved[vi + 0] = mesh.positions[pi]!;
      interleaved[vi + 1] = mesh.positions[pi + 1]!;
      interleaved[vi + 2] = mesh.positions[pi + 2]!;
      interleaved[vi + 3] = mesh.normals[ni]!;
      interleaved[vi + 4] = mesh.normals[ni + 1]!;
      interleaved[vi + 5] = mesh.normals[ni + 2]!;
      interleaved[vi + 6] = mesh.texcoords[ti]!;
      interleaved[vi + 7] = mesh.texcoords[ti + 1]!;
    }

    const label = `model-vertex-${modelId}${primIndex > 0 ? `-p${primIndex}` : ''}`;
    const vertexBuffer = this._device.createBuffer({
      label,
      size: interleaved.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(vertexBuffer.getMappedRange()).set(interleaved);
    vertexBuffer.unmap();

    // Index buffer
    const indexData = mesh.indices;
    const indexFormat: GPUIndexFormat =
      indexData instanceof Uint32Array ? 'uint32' : 'uint16';
    const indexByteLength = indexData.byteLength;
    const paddedSize = Math.ceil(indexByteLength / 4) * 4;

    const indexLabel = `model-index-${modelId}${primIndex > 0 ? `-p${primIndex}` : ''}`;
    const indexBuffer = this._device.createBuffer({
      label: indexLabel,
      size: Math.max(paddedSize, 4),
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    if (indexData instanceof Uint32Array) {
      new Uint32Array(indexBuffer.getMappedRange(0, indexData.byteLength)).set(indexData);
    } else {
      new Uint16Array(indexBuffer.getMappedRange(0, indexData.byteLength)).set(indexData);
    }
    indexBuffer.unmap();

    return {
      vertexBuffer,
      indexBuffer,
      indexFormat,
      indexCount: mesh.indexCount,
      vertexCount: mesh.vertexCount,
      material,
      baseColorTexture: null,
      normalTexture: null,
      metallicRoughnessTexture: null,
      occlusionTexture: null,
      emissiveTexture: null,
    };
  }

  private _createTextureFromBitmap(bitmap: ImageBitmap, label: string): GPUTexture {
    const texture = this._device.createTexture({
      label,
      size: { width: bitmap.width, height: bitmap.height },
      format: 'rgba8unorm',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });

    this._device.queue.copyExternalImageToTexture(
      { source: bitmap },
      { texture },
      { width: bitmap.width, height: bitmap.height },
    );

    return texture;
  }
}
