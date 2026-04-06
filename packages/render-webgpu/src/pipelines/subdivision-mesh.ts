/**
 * Subdivision Mesh — Shared grid for globe tile rendering
 *
 * Her tile aynı subdivided quad mesh'i paylaşır.
 * Grid boyutu (subdivisions × subdivisions) → vertex shader'da
 * tile UV → Mercator → Angular → Sphere dönüşümü yapılır.
 *
 * Default: 64×64 = 4,225 vertex, 2×64×64 = 8,192 triangle.
 * Vertex layout: vec2<f32> position (UV: 0..1)
 */

export interface SubdivisionMesh {
  /** Vertex buffer: vec2<f32> positions, UV (0..1) */
  vertexBuffer: GPUBuffer;
  /** Index buffer: uint16 indices */
  indexBuffer: GPUBuffer;
  /** Number of indices to draw */
  indexCount: number;
  /** Number of vertices */
  vertexCount: number;
  /** Grid subdivisions per side */
  subdivisions: number;
}

/**
 * Shared subdivision grid mesh oluştur.
 * Tüm globe tile'lar bu mesh'i paylaşır — per-tile uniform ile farklı pozisyonlara map edilir.
 *
 * @param device - GPUDevice
 * @param subdivisions - Grid bölümleri (default 32)
 */
export function createSubdivisionMesh(
  device: GPUDevice,
  subdivisions = 32,
): SubdivisionMesh {
  const gridSize = subdivisions + 1; // n subdivisions → n+1 vertices per side
  const vertexCount = gridSize * gridSize;

  // ─── Vertices: UV positions ───
  const vertices = new Float32Array(vertexCount * 2);
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const idx = (y * gridSize + x) * 2;
      vertices[idx] = x / subdivisions;     // u: 0..1
      vertices[idx + 1] = y / subdivisions; // v: 0..1
    }
  }

  // ─── Indices: two triangles per grid cell ───
  const cellCount = subdivisions * subdivisions;
  const indexCount = cellCount * 6; // 2 triangles × 3 indices
  const useUint32 = vertexCount > 65535;
  const indices = useUint32
    ? new Uint32Array(indexCount)
    : new Uint16Array(indexCount);

  let idx = 0;
  for (let y = 0; y < subdivisions; y++) {
    for (let x = 0; x < subdivisions; x++) {
      const tl = y * gridSize + x;
      const tr = tl + 1;
      const bl = (y + 1) * gridSize + x;
      const br = bl + 1;

      // Triangle 1: TL → BL → TR
      indices[idx++] = tl;
      indices[idx++] = bl;
      indices[idx++] = tr;

      // Triangle 2: TR → BL → BR
      indices[idx++] = tr;
      indices[idx++] = bl;
      indices[idx++] = br;
    }
  }

  // ─── GPU Buffers ───
  const vertexBuffer = device.createBuffer({
    label: 'subdivision-vertex-buffer',
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertices);

  const indexBuffer = device.createBuffer({
    label: 'subdivision-index-buffer',
    size: indices.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(indexBuffer, 0, indices);

  return {
    vertexBuffer,
    indexBuffer,
    indexCount,
    vertexCount,
    subdivisions,
  };
}
