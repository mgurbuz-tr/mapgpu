/**
 * Test Setup
 *
 * WebGPU global'leri Node.js test ortamında mevcut olmadığı için polyfill sağlar.
 */

// WebGPU shader stage flags
if (globalThis.GPUShaderStage === undefined) {
  (globalThis as Record<string, unknown>).GPUShaderStage = {
    VERTEX: 0x1,
    FRAGMENT: 0x2,
    COMPUTE: 0x4,
  };
}

// WebGPU buffer usage flags
if (globalThis.GPUBufferUsage === undefined) {
  (globalThis as Record<string, unknown>).GPUBufferUsage = {
    MAP_READ: 0x0001,
    MAP_WRITE: 0x0002,
    COPY_SRC: 0x0004,
    COPY_DST: 0x0008,
    INDEX: 0x0010,
    VERTEX: 0x0020,
    UNIFORM: 0x0040,
    STORAGE: 0x0080,
    INDIRECT: 0x0100,
    QUERY_RESOLVE: 0x0200,
  };
}

// WebGPU texture usage flags
if (globalThis.GPUTextureUsage === undefined) {
  (globalThis as Record<string, unknown>).GPUTextureUsage = {
    COPY_SRC: 0x01,
    COPY_DST: 0x02,
    TEXTURE_BINDING: 0x04,
    STORAGE_BINDING: 0x08,
    RENDER_ATTACHMENT: 0x10,
  };
}

// WebGPU map mode
if (globalThis.GPUMapMode === undefined) {
  (globalThis as Record<string, unknown>).GPUMapMode = {
    READ: 0x0001,
    WRITE: 0x0002,
  };
}
