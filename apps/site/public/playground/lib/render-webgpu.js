import { DEPTH_STANDARD as rt, lonLatToMercator as xt, mercatorToLonLat as vt } from "@mapgpu/core";
async function bt() {
  const r = {
    mode: "cpu-degraded",
    features: {
      timestampQuery: !1,
      float32Filterable: !1,
      indirectFirstInstance: !1,
      shaderF16: !1
    },
    limits: {
      maxTextureDimension2D: 0,
      maxBufferSize: 0,
      maxStorageBufferBindingSize: 0
    },
    adapter: null,
    device: null
  };
  if (typeof navigator > "u" || !navigator.gpu)
    return r;
  const e = await navigator.gpu.requestAdapter({
    powerPreference: "high-performance"
  });
  if (!e)
    return r;
  const t = {
    timestampQuery: e.features.has("timestamp-query"),
    float32Filterable: e.features.has("float32-filterable"),
    indirectFirstInstance: e.features.has("indirect-first-instance"),
    shaderF16: e.features.has("shader-f16")
  }, o = {
    maxTextureDimension2D: e.limits.maxTextureDimension2D,
    maxBufferSize: e.limits.maxBufferSize,
    maxStorageBufferBindingSize: e.limits.maxStorageBufferBindingSize
  }, i = [];
  t.timestampQuery && i.push("timestamp-query"), t.float32Filterable && i.push("float32-filterable");
  const a = await e.requestDevice({
    requiredFeatures: i
  });
  return a.lost.then((s) => {
    console.error(`[mapgpu] GPU device lost: ${s.reason} — ${s.message}`);
  }), { mode: yt(o), features: t, limits: o, adapter: e, device: a };
}
function yt(r) {
  return r.maxTextureDimension2D < 4096 || r.maxBufferSize < 256 * 1024 * 1024 ? "gpu-lite" : "full-gpu";
}
class Pt {
  device;
  tracked = /* @__PURE__ */ new Map();
  persistentBytes = 0;
  transientBytes = 0;
  constructor(e) {
    this.device = e;
  }
  /**
   * Yeni GPU buffer oluştur ve takip et.
   */
  allocate(e, t, o = "persistent") {
    const i = this.device.createBuffer({
      size: e,
      usage: t,
      mappedAtCreation: !1
    }), a = { buffer: i, size: e, category: o };
    return this.tracked.set(i, a), o === "persistent" ? this.persistentBytes += e : this.transientBytes += e, i;
  }
  /**
   * Mevcut veriden GPU buffer oluştur (mapped at creation).
   */
  allocateWithData(e, t, o = "persistent") {
    const i = this.device.createBuffer({
      size: e.byteLength,
      usage: t,
      mappedAtCreation: !0
    }), a = i.getMappedRange();
    new Uint8Array(a).set(new Uint8Array(e.buffer, e.byteOffset, e.byteLength)), i.unmap();
    const n = { buffer: i, size: e.byteLength, category: o };
    return this.tracked.set(i, n), o === "persistent" ? this.persistentBytes += e.byteLength : this.transientBytes += e.byteLength, i;
  }
  /**
   * GPU buffer'ı serbest bırak ve tracking'den çıkar.
   */
  release(e) {
    const t = this.tracked.get(e);
    t && (t.category === "persistent" ? this.persistentBytes -= t.size : this.transientBytes -= t.size, this.tracked.delete(e), e.destroy());
  }
  /**
   * Tüm transient buffer'ları serbest bırak (her frame sonunda çağrılır).
   */
  releaseTransient() {
    for (const [e, t] of this.tracked)
      t.category === "transient" && (this.transientBytes -= t.size, this.tracked.delete(e), e.destroy());
  }
  /**
   * GPU memory accounting bilgisi döndür.
   * textureBytes burada 0 döner;
   * TextureManager tarafından ayrıca raporlanır.
   */
  getMemoryAccounting() {
    return {
      persistentBufferBytes: this.persistentBytes,
      transientBufferBytes: this.transientBytes,
      textureBytes: 0,
      totalTrackedBytes: this.persistentBytes + this.transientBytes
    };
  }
  /**
   * Tüm buffer'ları serbest bırak.
   */
  destroy() {
    for (const [e] of this.tracked)
      e.destroy();
    this.tracked.clear(), this.persistentBytes = 0, this.transientBytes = 0;
  }
  /** Tracked buffer sayısı (diagnostics için). */
  get trackedCount() {
    return this.tracked.size;
  }
}
class Ct {
  device;
  tracked = /* @__PURE__ */ new Map();
  totalTextureBytes = 0;
  constructor(e) {
    this.device = e;
  }
  /**
   * ImageBitmap'den GPU texture oluştur.
   * Format: rgba8unorm (4 bytes per pixel).
   */
  createFromImageBitmap(e) {
    const t = this.device.createTexture({
      size: { width: e.width, height: e.height },
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });
    this.device.queue.copyExternalImageToTexture(
      { source: e },
      { texture: t },
      { width: e.width, height: e.height }
    );
    const o = e.width * e.height * 4, i = {
      texture: t,
      byteSize: o,
      lastAccessTime: performance.now()
    };
    return this.tracked.set(t, i), this.totalTextureBytes += o, t;
  }
  /**
   * HTMLVideoElement'ten GPU texture oluştur.
   * WebGPU copyExternalImageToTexture doğrudan HTMLVideoElement kabul eder.
   */
  createFromVideoElement(e) {
    const t = e.videoWidth, o = e.videoHeight, i = this.device.createTexture({
      size: { width: t, height: o },
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });
    this.device.queue.copyExternalImageToTexture(
      { source: e },
      { texture: i },
      { width: t, height: o }
    );
    const a = t * o * 4;
    return this.tracked.set(i, {
      texture: i,
      byteSize: a,
      lastAccessTime: performance.now()
    }), this.totalTextureBytes += a, i;
  }
  /**
   * Mevcut GPU texture'ı HTMLVideoElement'in geçerli frame'i ile güncelle.
   * Boyut değişmediyse texture yeniden oluşturulmaz — sadece pixel verileri yazılır.
   */
  updateFromVideoElement(e, t) {
    this.device.queue.copyExternalImageToTexture(
      { source: t },
      { texture: e },
      { width: t.videoWidth, height: t.videoHeight }
    );
    const o = this.tracked.get(e);
    o && (o.lastAccessTime = performance.now());
  }
  /**
   * Texture erişim zamanını güncelle (LRU tracking).
   */
  touch(e) {
    const t = this.tracked.get(e);
    t && (t.lastAccessTime = performance.now());
  }
  /**
   * GPU texture'ı serbest bırak.
   */
  release(e) {
    const t = this.tracked.get(e);
    t && (this.totalTextureBytes -= t.byteSize, this.tracked.delete(e), e.destroy());
  }
  /**
   * LRU eviction: en eski texture'ları serbest bırak,
   * toplam byte sayısı maxBytes altına düşene kadar.
   */
  evict(e) {
    if (this.totalTextureBytes <= e) return;
    const t = [...this.tracked.entries()].sort(
      (o, i) => o[1].lastAccessTime - i[1].lastAccessTime
    );
    for (const [o, i] of t) {
      if (this.totalTextureBytes <= e) break;
      this.totalTextureBytes -= i.byteSize, this.tracked.delete(o), o.destroy();
    }
  }
  /**
   * Float32Array'den r32float GPU texture oluştur.
   * Tek kanallı elevation data için.
   */
  createFromFloat32(e, t, o) {
    const i = this.device.createTexture({
      label: `r32float-${t}x${o}`,
      size: { width: t, height: o },
      format: "r32float",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });
    this.device.queue.writeTexture(
      { texture: i },
      e.buffer,
      { bytesPerRow: t * 4, rowsPerImage: o },
      { width: t, height: o }
    );
    const a = t * o * 4, n = {
      texture: i,
      byteSize: a,
      lastAccessTime: performance.now()
    };
    return this.tracked.set(i, n), this.totalTextureBytes += a, i;
  }
  /**
   * Uint8Array'den r8unorm GPU texture oluştur.
   * Tek kanallı hillshade data için.
   */
  createFromUint8(e, t, o) {
    const i = this.device.createTexture({
      label: `r8unorm-${t}x${o}`,
      size: { width: t, height: o },
      format: "r8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    }), a = Math.ceil(t / 256) * 256;
    if (a === t)
      this.device.queue.writeTexture(
        { texture: i },
        e.buffer,
        { bytesPerRow: t, rowsPerImage: o },
        { width: t, height: o }
      );
    else {
      const l = new Uint8Array(a * o);
      for (let c = 0; c < o; c++)
        l.set(
          e.subarray(c * t, c * t + t),
          c * a
        );
      this.device.queue.writeTexture(
        { texture: i },
        l.buffer,
        { bytesPerRow: a, rowsPerImage: o },
        { width: t, height: o }
      );
    }
    const n = t * o, s = {
      texture: i,
      byteSize: n,
      lastAccessTime: performance.now()
    };
    return this.tracked.set(i, s), this.totalTextureBytes += n, i;
  }
  /**
   * Uint8Array'den rgba8unorm GPU texture oluştur.
   * Color ramp LUT (256×1) için.
   */
  createFromRGBA8(e, t, o) {
    const i = this.device.createTexture({
      label: `rgba8unorm-${t}x${o}`,
      size: { width: t, height: o },
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });
    this.device.queue.writeTexture(
      { texture: i },
      e.buffer,
      { bytesPerRow: t * 4, rowsPerImage: o },
      { width: t, height: o }
    );
    const a = t * o * 4, n = {
      texture: i,
      byteSize: a,
      lastAccessTime: performance.now()
    };
    return this.tracked.set(i, n), this.totalTextureBytes += a, i;
  }
  /**
   * Toplam texture byte kullanımı.
   */
  get textureBytes() {
    return this.totalTextureBytes;
  }
  /**
   * Tracked texture sayısı.
   */
  get trackedCount() {
    return this.tracked.size;
  }
  /**
   * Tüm texture'ları serbest bırak.
   */
  destroy() {
    for (const [e] of this.tracked)
      e.destroy();
    this.tracked.clear(), this.totalTextureBytes = 0;
  }
}
function De(r) {
  return `${r.pipelineId}:${r.resourceIds.join(",")}`;
}
class wt {
  cache = /* @__PURE__ */ new Map();
  totalEstimatedBytes = 0;
  /** Invalidation: resource ID -> cache key string set */
  resourceToKeys = /* @__PURE__ */ new Map();
  /**
   * Cache'ten var olan bind group'u al veya yeni oluştur.
   *
   * @param key Cache key
   * @param create Factory: cache miss olduğunda bind group oluşturur
   * @returns GPUBindGroup
   */
  getOrCreate(e, t) {
    const o = De(e), i = this.cache.get(o);
    if (i)
      return i.bindGroup;
    const a = t(), n = 64 + e.resourceIds.length * 8, s = new Set(e.resourceIds), l = {
      bindGroup: a,
      key: o,
      estimatedBytes: n,
      resourceRefs: s
    };
    this.cache.set(o, l), this.totalEstimatedBytes += n;
    for (const c of e.resourceIds) {
      let p = this.resourceToKeys.get(c);
      p || (p = /* @__PURE__ */ new Set(), this.resourceToKeys.set(c, p)), p.add(o);
    }
    return a;
  }
  /**
   * Belirli bir resource ID'si kullanılan tüm cache entry'lerini invalidate et.
   * Buffer veya texture release/destroy olduğunda çağrılır.
   *
   * @param resourceId Release edilen resource'ın unique ID'si
   */
  invalidate(e) {
    const t = this.resourceToKeys.get(e);
    if (t) {
      for (const o of t) {
        const i = this.cache.get(o);
        if (i) {
          this.totalEstimatedBytes -= i.estimatedBytes;
          for (const a of i.resourceRefs)
            if (a !== e) {
              const n = this.resourceToKeys.get(a);
              n && (n.delete(o), n.size === 0 && this.resourceToKeys.delete(a));
            }
          this.cache.delete(o);
        }
      }
      this.resourceToKeys.delete(e);
    }
  }
  /**
   * Cache'te bir key var mı kontrol et.
   */
  has(e) {
    return this.cache.has(De(e));
  }
  /**
   * Tüm cache'i temizle.
   */
  clear() {
    this.cache.clear(), this.resourceToKeys.clear(), this.totalEstimatedBytes = 0;
  }
  /**
   * Cache'teki toplam entry sayısı.
   */
  get size() {
    return this.cache.size;
  }
  /**
   * Tahmini cache memory overhead (bytes).
   * Not: Bu GPU memory değil, cache metadata boyutudur.
   */
  get estimatedBytes() {
    return this.totalEstimatedBytes;
  }
}
class St {
  resolution;
  worldExtent;
  cpuHeightmap;
  gpuTexture;
  gpuSampler;
  bindGroup;
  dirty = !1;
  hasStrokes = !1;
  addTexel(e, t, o) {
    if (e < 0 || t < 0 || e >= this.resolution || t >= this.resolution) return;
    const i = t * this.resolution + e;
    this.cpuHeightmap[i] = (this.cpuHeightmap[i] ?? 0) + o;
  }
  // When brush radius is smaller than one texel, splat bilinearly so
  // zooming in does not collapse the brush effect to zero.
  splatSubTexel(e, t, o) {
    const i = e - 0.5, a = t - 0.5, n = Math.floor(i), s = Math.floor(a), l = i - n, c = a - s;
    this.addTexel(n, s, o * (1 - l) * (1 - c)), this.addTexel(n + 1, s, o * l * (1 - c)), this.addTexel(n, s + 1, o * (1 - l) * c), this.addTexel(n + 1, s + 1, o * l * c);
  }
  constructor(e, t, o) {
    this.resolution = o?.resolution ?? 512, this.worldExtent = o?.worldExtent ?? [0, 0, 1, 1], this.cpuHeightmap = new Float32Array(this.resolution * this.resolution), this.gpuTexture = e.createTexture({
      label: "height-brush-texture",
      size: { width: this.resolution, height: this.resolution },
      format: "r32float",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    }), this.gpuSampler = e.createSampler({
      label: "height-brush-sampler",
      magFilter: "nearest",
      minFilter: "nearest",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge"
    }), this.bindGroup = e.createBindGroup({
      label: "height-brush-bind-group",
      layout: t,
      entries: [
        { binding: 0, resource: this.gpuTexture.createView() },
        { binding: 1, resource: this.gpuSampler }
      ]
    });
  }
  /**
   * Apply a brush stroke at world-space Mercator coordinates.
   * Rasterizes the stroke into the CPU heightmap with adjustable falloff.
   */
  apply(e, t, o, i, a = 0.8) {
    const n = this.resolution, [s, l, c, p] = this.worldExtent, u = c - s, d = p - l, f = 2 - 1.5 * Math.max(0, Math.min(1, a)), h = (e - s) / u * n, x = (t - l) / d * n, g = o / u * n, b = o / d * n, v = Math.max(g, b);
    if (v < 1) {
      this.splatSubTexel(h, x, i), this.dirty = !0, this.hasStrokes = !0;
      return;
    }
    const P = Math.max(0, Math.floor(x - v)), C = Math.min(n - 1, Math.ceil(x + v)), S = Math.max(0, Math.floor(h - v)), R = Math.min(n - 1, Math.ceil(h + v));
    for (let y = P; y <= C; y++)
      for (let w = S; w <= R; w++) {
        const B = w + 0.5 - h, T = y + 0.5 - x, F = B * B + T * T, M = v * v;
        if (F < M) {
          const _ = 1 - Math.sqrt(F) / v, G = Math.pow(Math.max(0, _), f), L = y * n + w;
          this.cpuHeightmap[L] = (this.cpuHeightmap[L] ?? 0) + i * G;
        }
      }
    this.dirty = !0, this.hasStrokes = !0;
  }
  /**
   * Upload CPU heightmap to GPU if dirty.
   */
  flush(e) {
    this.dirty && (e.queue.writeTexture(
      { texture: this.gpuTexture },
      this.cpuHeightmap.buffer,
      { bytesPerRow: this.resolution * 4 },
      { width: this.resolution, height: this.resolution }
    ), this.dirty = !1);
  }
  /**
   * Get the single bind group (texture + sampler).
   * Returns null if no strokes have been applied.
   * Flushes to GPU if dirty.
   */
  getBindGroup(e) {
    return this.hasStrokes ? (this.flush(e), this.bindGroup) : null;
  }
  /** Clear all brush data (zero out heightmap) */
  clear() {
    this.cpuHeightmap.fill(0), this.dirty = !0, this.hasStrokes = !1;
  }
  /** Release GPU resources */
  destroy() {
    this.gpuTexture.destroy();
  }
}
function Tt(r) {
  return r.createBindGroupLayout({
    label: "height-texture-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        texture: { sampleType: "unfilterable-float" }
      },
      {
        binding: 1,
        visibility: GPUShaderStage.VERTEX,
        sampler: { type: "non-filtering" }
      }
    ]
  });
}
function it(r, e) {
  const t = r.createTexture({
    label: "zero-height-texture",
    size: { width: 1, height: 1 },
    format: "r32float",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
  });
  r.queue.writeTexture(
    { texture: t },
    new Float32Array([0]).buffer,
    { bytesPerRow: 4 },
    { width: 1, height: 1 }
  );
  const o = r.createSampler({
    label: "zero-height-sampler",
    magFilter: "nearest",
    minFilter: "nearest",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge"
  }), i = r.createBindGroup({
    label: "zero-height-bind-group",
    layout: e,
    entries: [
      { binding: 0, resource: t.createView() },
      { binding: 1, resource: o }
    ]
  });
  return { texture: t, bindGroup: i };
}
const Bt = (
  /* wgsl */
  `

// ─── Constants ───

const PI: f32 = 3.14159265358979323846;
const TWO_PI: f32 = 6.28318530717958647692;
const EARTH_RADIUS_METERS: f32 = 6378137.0;

// ─── Bindings ───

struct GlobeCameraUniforms {
  // View-Projection matrix (column-major 4x4) — globe (unit sphere)
  viewProjection: mat4x4<f32>,
  // Flat Mercator VP matrix (column-major 4x4) — Mercator [0..1] ortho
  flatViewProjection: mat4x4<f32>,
  // Viewport dimensions
  viewport: vec2<f32>,
  // Projection transition: 0 = Mercator flat, 1 = globe sphere
  projectionTransition: f32,
  // Globe radius (unit sphere = 1.0)
  globeRadius: f32,
  // Clipping plane for horizon occlusion: Ax + By + Cz + D
  clippingPlane: vec4<f32>,
};

struct TileUniforms {
  // Tile Mercator extent: minX, minY, maxX, maxY (0..1 range)
  mercatorExtent: vec4<f32>,
  // Tile opacity
  opacity: f32,
  // Height exaggeration factor
  heightExaggeration: f32,
  // Height mode: 0 = world-space debug brush, 1 = tile-local terrain
  heightMode: f32,
  // Depth bias: fallback parent tiles pushed back to prevent z-fighting
  depthBias: f32,
  // Tile UV remap into terrain texture UV: [offsetX, offsetY, scaleX, scaleY]
  terrainUv: vec4<f32>,
  // Terrain lighting controls: [ambient, diffuse, shadowStrength, shadowSoftness]
  lightParams: vec4<f32>,
  // Sun controls: [azimuthDeg, altitudeDeg, enabled(0|1), _pad]
  sunParams: vec4<f32>,
  // Post-process filters: [brightness, contrast, saturate, _pad]
  filters: vec4<f32>,
};

@group(0) @binding(0) var<uniform> camera: GlobeCameraUniforms;
@group(1) @binding(0) var<uniform> tile: TileUniforms;
@group(1) @binding(1) var tileSampler: sampler;
@group(1) @binding(2) var tileTexture: texture_2d<f32>;
@group(2) @binding(0) var heightMap: texture_2d<f32>;
@group(2) @binding(1) var heightSampler: sampler;

// ─── Manual bilinear height sampling ───
// r32float doesn't support filtering sampler without float32-filterable feature.
// We use textureLoad + manual bilinear to get smooth interpolation.

fn sampleHeight(uv: vec2<f32>) -> f32 {
  let dims = vec2<f32>(textureDimensions(heightMap, 0));
  let tc = uv * max(dims - vec2(1.0), vec2(0.0));
  let tc0 = vec2<i32>(floor(tc));
  let f = fract(tc);
  let maxC = vec2<i32>(dims) - 1;
  let h00 = textureLoad(heightMap, clamp(tc0, vec2(0), maxC), 0).r;
  let h10 = textureLoad(heightMap, clamp(tc0 + vec2(1, 0), vec2(0), maxC), 0).r;
  let h01 = textureLoad(heightMap, clamp(tc0 + vec2(0, 1), vec2(0), maxC), 0).r;
  let h11 = textureLoad(heightMap, clamp(tc0 + vec2(1, 1), vec2(0), maxC), 0).r;
  return mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y);
}

fn terrainUvForTileUv(tileUv: vec2<f32>) -> vec2<f32> {
  return tile.terrainUv.xy + tileUv * tile.terrainUv.zw;
}

fn heightUvForTileUv(tileUv: vec2<f32>, mercUv: vec2<f32>) -> vec2<f32> {
  if (tile.heightMode >= 0.5) {
    return terrainUvForTileUv(tileUv);
  }
  return mercUv;
}

fn heightToWorldUnit(heightValue: f32) -> f32 {
  var hUnit = heightValue;
  if (tile.heightMode >= 0.5) {
    hUnit = heightValue / EARTH_RADIUS_METERS;
  }
  return hUnit * tile.heightExaggeration;
}

fn sunDirection(azimuthDeg: f32, altitudeDeg: f32) -> vec3<f32> {
  let az = azimuthDeg * PI / 180.0;
  let alt = altitudeDeg * PI / 180.0;
  let cosAlt = cos(alt);
  return normalize(vec3<f32>(
    sin(az) * cosAlt,  // east
    cos(az) * cosAlt,  // north
    sin(alt),          // up
  ));
}

// ─── Vertex ───

struct VertexInput {
  @location(0) uv: vec2<f32>,  // Grid UV (0..1)
  @location(1) skirt: f32,      // 0 = surface vertex, 1 = skirt vertex
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) texCoord: vec2<f32>,
  @location(1) clipDot: f32,  // For fragment discard (horizon)
};

// Mercator (0..1) → Angular (radians)
fn mercatorToAngular(merc: vec2<f32>) -> vec2<f32> {
  let lon = merc.x * TWO_PI - PI;
  let lat = atan(exp(PI - merc.y * TWO_PI)) * 2.0 - PI * 0.5;
  return vec2<f32>(lon, lat);
}

// Angular (radians) → Unit Sphere (3D)
fn angularToSphere(lon: f32, lat: f32) -> vec3<f32> {
  let cosLat = cos(lat);
  return vec3<f32>(
    cosLat * sin(lon),
    sin(lat),
    cosLat * cos(lon),
  );
}

// MapLibre custom Z: geometry-aware depth from clipping plane
// Replaces perspective Z — handles horizon occlusion + depth in one step
fn globeClippingZ(spherePos: vec3<f32>) -> f32 {
  return 1.0 - (dot(spherePos, camera.clippingPlane.xyz) + camera.clippingPlane.w);
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  // Map grid UV to tile Mercator coordinates
  let mercX = mix(tile.mercatorExtent.x, tile.mercatorExtent.z, input.uv.x);
  let mercY = mix(tile.mercatorExtent.y, tile.mercatorExtent.w, input.uv.y);

  // ─── Globe path: Mercator → Angular → Sphere → globe clip space ───
  let angular = mercatorToAngular(vec2<f32>(mercX, mercY));
  let sphereBase = angularToSphere(angular.x, angular.y);

  // Height sampling: world-space brush (mode=0) or tile-local terrain (mode=1).
  var h = 0.0;
  if (tile.heightMode >= 0.5) {
    h = sampleHeight(terrainUvForTileUv(input.uv));
  } else {
    h = sampleHeight(vec2<f32>(mercX, mercY));
  }
  var displacement = heightToWorldUnit(h);

  // Skirts hide tile cracks when adjacent tiles have different sampled heights.
  if (tile.heightMode >= 0.5 && input.skirt >= 0.5) {
    let skirtDepth = max(0.0015, abs(displacement) * 0.35 + 0.0006);
    displacement -= skirtDepth;
  }
  let spherePos = sphereBase * (1.0 + displacement);

  var globeClip = camera.viewProjection * vec4<f32>(spherePos, 1.0);
  // Replace globe Z with horizon-aware depth (use base for stable clipping)
  globeClip.z = globeClippingZ(sphereBase) * globeClip.w;

  // ─── Blend clip-space positions ───
  let clipDot = dot(sphereBase, camera.clippingPlane.xyz) + camera.clippingPlane.w;

  // Shader-level depth offset: tiles render in front of pole caps.
  // depthBias > 0 for fallback parent tiles, 0 for exact tiles — prevents z-fighting.
  const LAYER_DEPTH_OFFSET: f32 = 0.0001;
  var clipPos: vec4<f32>;
  if (camera.projectionTransition >= 0.999) {
    clipPos = globeClip;
  } else if (camera.projectionTransition <= 0.001) {
    var flatClip = camera.flatViewProjection * vec4<f32>(mercX, mercY, displacement, 1.0);
    clipPos = flatClip;
  } else {
    var flatClip = camera.flatViewProjection * vec4<f32>(mercX, mercY, displacement, 1.0);
    clipPos = mix(flatClip, globeClip, camera.projectionTransition);
  }
  clipPos.z -= LAYER_DEPTH_OFFSET * clipPos.w;
  clipPos.z += tile.depthBias * clipPos.w;
  clipPos.z = min(clipPos.z, clipPos.w * 0.9999);

  var out: VertexOutput;
  out.position = clipPos;
  out.texCoord = vec2<f32>(input.uv.x, input.uv.y);
  out.clipDot = clipDot;
  return out;
}

// ─── Fragment ───

fn applyFilters(c: vec3<f32>) -> vec3<f32> {
  var rgb = c * tile.filters.x;
  rgb = (rgb - 0.5) * tile.filters.y + 0.5;
  let gray = dot(rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
  return mix(vec3<f32>(gray), rgb, tile.filters.z);
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // Discard back-hemisphere fragments for clean horizon edge
  if (camera.projectionTransition > 0.01 && input.clipDot < -0.01) {
    discard;
  }

  var color = textureSample(tileTexture, tileSampler, input.texCoord);
  if (tile.sunParams.z < 0.5) {
    var rgb = applyFilters(color.rgb);
    return vec4<f32>(rgb, color.a * tile.opacity);
  }

  let mercX = mix(tile.mercatorExtent.x, tile.mercatorExtent.z, input.texCoord.x);
  let mercY = mix(tile.mercatorExtent.y, tile.mercatorExtent.w, input.texCoord.y);
  let mercUv = vec2<f32>(mercX, mercY);
  let heightUv = heightUvForTileUv(input.texCoord, mercUv);

  let dims = vec2<f32>(textureDimensions(heightMap, 0));
  let texel = vec2<f32>(1.0) / max(dims, vec2<f32>(1.0));
  let stepX = vec2<f32>(texel.x, 0.0);
  let stepY = vec2<f32>(0.0, texel.y);

  let hW = heightToWorldUnit(sampleHeight(heightUv - stepX));
  let hE = heightToWorldUnit(sampleHeight(heightUv + stepX));
  let hN = heightToWorldUnit(sampleHeight(heightUv - stepY));
  let hS = heightToWorldUnit(sampleHeight(heightUv + stepY));

  let dhdx = (hE - hW) / max(1e-6, 2.0 * texel.x);
  let dhdy = (hN - hS) / max(1e-6, 2.0 * texel.y);

  let angular = mercatorToAngular(mercUv);
  let up = normalize(angularToSphere(angular.x, angular.y));
  let refDir = select(vec3<f32>(0.0, 0.0, 1.0), vec3<f32>(1.0, 0.0, 0.0), abs(up.z) > 0.99);
  let east = normalize(cross(refDir, up));
  let north = normalize(cross(up, east));
  let normal = normalize(up - east * dhdx - north * dhdy);

  let lightDir = sunDirection(tile.sunParams.x, tile.sunParams.y);
  let ambient = clamp(tile.lightParams.x, 0.0, 1.0);
  let diffuse = clamp(tile.lightParams.y, 0.0, 2.0);
  let ndotl = max(dot(normal, lightDir), 0.0);
  var lightTerm = ambient + diffuse * ndotl;

  // Pseudo-shadow: compare height toward sun direction in local tangent frame.
  var lightUvDir = vec2<f32>(dot(lightDir, east), -dot(lightDir, north));
  let dirLen = max(length(lightUvDir), 1e-6);
  lightUvDir = lightUvDir / dirLen;

  let softness = clamp(tile.lightParams.w, 0.0, 1.0);
  let sampleDist = mix(1.5, 7.0, softness);
  let shadowStep = vec2<f32>(lightUvDir.x * texel.x, lightUvDir.y * texel.y) * sampleDist;

  let hCenter = heightToWorldUnit(sampleHeight(heightUv));
  let hTowardSun = heightToWorldUnit(sampleHeight(heightUv + shadowStep));
  let rise = max(0.0, hTowardSun - hCenter);

  let sunAltRad = tile.sunParams.y * PI / 180.0;
  let altitudeFactor = max(0.15, sin(sunAltRad));
  let riseScale = select(800.0, 22000.0, tile.heightMode >= 0.5);
  let occlusion = clamp(rise * riseScale / altitudeFactor, 0.0, 1.0);
  // Disable pseudo-shadow when view is strongly globe-like (zoomed out).
  // Shadows fade in only as we transition toward the flatter close-zoom view.
  let transitionToFlat = clamp(1.0 - camera.projectionTransition, 0.0, 1.0);
  let zoomShadowFade = smoothstep(0.08, 0.32, transitionToFlat);
  let shadowStrength = clamp(tile.lightParams.z, 0.0, 1.0) * zoomShadowFade;
  let pseudoShadow = 1.0 - occlusion * shadowStrength;
  lightTerm *= pseudoShadow;

  let litRgb = color.rgb * clamp(lightTerm, 0.0, 2.0);
  var finalRgb = applyFilters(litRgb);
  return vec4<f32>(finalRgb, color.a * tile.opacity);
}
`
);
function ot(r) {
  return r.createBindGroupLayout({
    label: "globe-camera-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }
      }
    ]
  });
}
function Gt(r) {
  return r.createBindGroupLayout({
    label: "globe-tile-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: "filtering" }
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: "float" }
      }
    ]
  });
}
function Mt(r) {
  return r.createBindGroupLayout({
    label: "globe-raster-height-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        texture: { sampleType: "unfilterable-float" }
      },
      {
        binding: 1,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        sampler: { type: "non-filtering" }
      }
    ]
  });
}
function _t(r) {
  const { device: e, colorFormat: t } = r, o = r.subdivisions ?? 32, i = ot(e), a = Gt(e), n = Mt(e), s = e.createShaderModule({
    label: "globe-raster-shader",
    code: Bt
  }), l = e.createPipelineLayout({
    label: "globe-raster-pipeline-layout",
    bindGroupLayouts: [i, a, n]
  }), c = Ft(e, o), p = e.createRenderPipeline({
    label: "globe-raster-pipeline",
    layout: l,
    vertex: {
      module: s,
      entryPoint: "vs_main",
      buffers: [
        {
          // vec3<f32> = uv.xy + skirtFlag
          arrayStride: 12,
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: "float32x2"
            },
            {
              shaderLocation: 1,
              offset: 8,
              format: "float32"
            }
          ]
        }
      ]
    },
    fragment: {
      module: s,
      entryPoint: "fs_main",
      targets: [
        {
          format: t,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            }
          }
        }
      ]
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "none"
      // Disabled until winding order is verified
    },
    depthStencil: {
      format: r.depthFormat ?? "depth24plus",
      depthWriteEnabled: !0,
      depthCompare: r.depthCompare ?? "less"
    },
    multisample: {
      count: r.sampleCount ?? E
    }
  }), u = e.createSampler({
    label: "globe-tile-sampler",
    magFilter: "linear",
    minFilter: "linear",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge"
  }), d = e.createSampler({
    label: "globe-height-sampler",
    magFilter: "nearest",
    minFilter: "nearest",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge"
  }), { texture: m, bindGroup: f } = it(e, n);
  return {
    pipeline: p,
    globeCameraBindGroupLayout: i,
    globeTileBindGroupLayout: a,
    heightBindGroupLayout: n,
    sampler: u,
    heightSampler: d,
    subdivisionMesh: c,
    zeroHeightTexture: m,
    zeroHeightBindGroup: f
  };
}
function Ft(r, e = 32) {
  const t = e + 1, o = t * t, i = [], a = new Uint32Array(o);
  for (let v = 0; v < t; v++)
    for (let P = 0; P < t; P++) {
      const C = i.length / 3;
      a[v * t + P] = C, i.push(P / e, v / e, 0);
    }
  const n = [];
  for (let v = 0; v < e; v++)
    for (let P = 0; P < e; P++) {
      const C = a[v * t + P], S = a[v * t + P + 1], R = a[(v + 1) * t + P], y = a[(v + 1) * t + P + 1];
      n.push(C, R, S), n.push(S, R, y);
    }
  const s = (v, P) => {
    const C = i.length / 3;
    return i.push(v, P, 1), C;
  }, l = new Uint32Array(t), c = new Uint32Array(t), p = new Uint32Array(t), u = new Uint32Array(t);
  for (let v = 0; v < t; v++) {
    const P = v / e;
    l[v] = s(P, 0), c[v] = s(1, P), p[v] = s(P, 1), u[v] = s(0, P);
  }
  const d = (v, P, C, S) => {
    n.push(v, C, P), n.push(P, C, S);
  };
  for (let v = 0; v < e; v++)
    d(
      a[v],
      a[v + 1],
      l[v],
      l[v + 1]
    );
  for (let v = 0; v < e; v++)
    d(
      a[v * t + e],
      a[(v + 1) * t + e],
      c[v],
      c[v + 1]
    );
  for (let v = 0; v < e; v++)
    d(
      a[e * t + v],
      a[e * t + v + 1],
      p[v],
      p[v + 1]
    );
  for (let v = 0; v < e; v++)
    d(
      a[v * t],
      a[(v + 1) * t],
      u[v],
      u[v + 1]
    );
  const m = new Float32Array(i), f = m.length / 3, x = f > 65535 ? new Uint32Array(n) : new Uint16Array(n), g = r.createBuffer({
    label: "globe-subdivision-vertex-buffer",
    size: m.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
  });
  r.queue.writeBuffer(g, 0, m);
  const b = r.createBuffer({
    label: "globe-subdivision-index-buffer",
    size: x.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
  });
  return r.queue.writeBuffer(b, 0, x), {
    vertexBuffer: g,
    indexBuffer: b,
    indexCount: x.length,
    vertexCount: f,
    subdivisions: e
  };
}
function J(r, e) {
  const t = new Float32Array(16);
  for (let o = 0; o < 4; o++)
    for (let i = 0; i < 4; i++) {
      let a = 0;
      for (let n = 0; n < 4; n++)
        a += r[n * 4 + i] * e[o * 4 + n];
      t[o * 4 + i] = a;
    }
  return t;
}
function Rt(r) {
  const e = new Float32Array(16), t = r[0], o = r[1], i = r[2], a = r[3], n = r[4], s = r[5], l = r[6], c = r[7], p = r[8], u = r[9], d = r[10], m = r[11], f = r[12], h = r[13], x = r[14], g = r[15], b = t * s - o * n, v = t * l - i * n, P = t * c - a * n, C = o * l - i * s, S = o * c - a * s, R = i * c - a * l, y = p * h - u * f, w = p * x - d * f, B = p * g - m * f, T = u * x - d * h, F = u * g - m * h, M = d * g - m * x, _ = b * M - v * F + P * T + C * B - S * w + R * y;
  if (Math.abs(_) < 1e-8)
    return null;
  const G = 1 / _;
  return e[0] = (s * M - l * F + c * T) * G, e[1] = (i * F - o * M - a * T) * G, e[2] = (h * R - x * S + g * C) * G, e[3] = (d * S - u * R - m * C) * G, e[4] = (l * B - n * M - c * w) * G, e[5] = (t * M - i * B + a * w) * G, e[6] = (x * P - f * R - g * v) * G, e[7] = (p * R - d * P + m * v) * G, e[8] = (n * F - s * B + c * y) * G, e[9] = (o * B - t * F - a * y) * G, e[10] = (f * S - h * P + g * b) * G, e[11] = (u * P - p * S - m * b) * G, e[12] = (s * w - n * T - l * y) * G, e[13] = (t * T - o * w + i * y) * G, e[14] = (h * v - f * C - x * b) * G, e[15] = (p * C - u * v + d * b) * G, e;
}
function Et(r, e, t) {
  return new Float32Array([
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    r,
    e,
    t,
    1
  ]);
}
const E = 4, Lt = 160, at = 192;
function Dt(r) {
  const e = J(r.projectionMatrix, r.viewMatrix), t = new Float32Array(at / 4);
  return t.set(e, 0), r.flatViewProjectionMatrix && t.set(r.flatViewProjectionMatrix, 16), t[32] = r.viewportWidth, t[33] = r.viewportHeight, t[34] = r.projectionTransition ?? 1, t[35] = r.globeRadius ?? 1, r.clippingPlane && (t[36] = r.clippingPlane[0], t[37] = r.clippingPlane[1], t[38] = r.clippingPlane[2], t[39] = r.clippingPlane[3]), t[40] = r.position[0] ?? 0, t[41] = r.position[1] ?? 0, t[42] = r.position[2] ?? 0, r.cameraMerc01 && (t[44] = r.cameraMerc01[0], t[45] = r.cameraMerc01[1], t[46] = r.cameraMerc01[2]), t;
}
class At {
  // ── GPU Device & Surface ──
  device = null;
  context = null;
  colorFormat = "bgra8unorm";
  canvas = null;
  // ── Resource Managers ──
  bufferPool = null;
  bindGroupCache = null;
  // ── Depth ──
  depthConfig = rt;
  depthTexture = null;
  // ── 2D Camera ──
  cameraBuffer = null;
  cameraBindGroup = null;
  cameraBindGroupLayout = null;
  // ── Globe Camera ──
  globeCameraBuffer = null;
  globeCameraBindGroup = null;
  globeCameraBindGroupLayout = null;
  // ── Per-frame State ──
  commandEncoder = null;
  backgroundPass = null;
  renderPass = null;
  currentCamera = null;
  frameTime = 0;
  swapChainView = null;
  msaaColorView = null;
  depthView = null;
  // ── Picking ──
  pickingEnabled = !0;
  pickingDrawCalls = [];
  // ── Current Layer ID (for picking) ──
  currentLayerId = "";
  // ── Placeholder ──
  placeholderTexture = null;
  // ── MSAA ──
  sampleCount = E;
  msaaColorTexture = null;
  // ── Lighting ──
  lightConfig = null;
  // ── Debug ──
  debugTileVertices = !1;
  extrusionDebugMode = !1;
  heightBrush = null;
  heightExaggeration = 1;
  // ── Continuous Render ──
  /** Set by delegates when animations need continuous rendering (e.g. extrusion grow) */
  needsContinuousRender = !1;
  // ── Device Lost ──
  deviceLost = !1;
  /**
   * Lazy-init globe camera buffer, bind group, and bind group layout.
   * Called from any delegate that needs globe rendering.
   * Safe to call multiple times — only creates resources once.
   */
  ensureGlobeCameraResources() {
    this.globeCameraBuffer || !this.device || !this.bufferPool || (this.globeCameraBindGroupLayout = ot(this.device), this.globeCameraBuffer = this.bufferPool.allocate(
      at,
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      "persistent"
    ), this.globeCameraBindGroup = this.device.createBindGroup({
      label: "globe-camera-bind-group",
      layout: this.globeCameraBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.globeCameraBuffer }
        }
      ]
    }));
  }
  /**
   * Write the provided camera state into the shared globe camera uniform buffer.
   */
  writeGlobeCamera(e) {
    if (!this.globeCameraBuffer || !this.device) return;
    const t = Dt(e);
    this.device.queue.writeBuffer(this.globeCameraBuffer, 0, t.buffer);
  }
  /**
   * Write globe camera uniforms for the current frame.
   * DRY helper — consolidates duplicate logic from globe draw methods.
   */
  ensureGlobeCameraWritten() {
    this.currentCamera && this.writeGlobeCamera(this.currentCamera);
  }
}
const Ut = (
  /* wgsl */
  `

// ─── Bindings ───

struct CameraUniforms {
  viewProjection: mat4x4<f32>,
};

struct TileUniforms {
  // Tile extent: minX, minY, maxX, maxY
  extent: vec4<f32>,
  // Opacity (0..1)
  opacity: f32,
  // Post-process filters (default 1.0 = no change)
  brightness: f32,
  contrast: f32,
  saturate: f32,
};

@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(1) @binding(0) var<uniform> tile: TileUniforms;
@group(1) @binding(1) var tileSampler: sampler;
@group(1) @binding(2) var tileTexture: texture_2d<f32>;

// ─── Vertex ───

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

// Full-screen quad: 4 vertex, 2 triangle (triangle-strip)
// vertex_index 0..3 → quad corners
@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VertexOutput {
  // Quad corners: BL, BR, TL, TR
  var positions = array<vec2<f32>, 4>(
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 1.0),
  );

  let uv = positions[vid];

  // RTE (Relative-to-Eye): tile extent is camera-relative (CPU subtracted center
  // in f64).  Using w=0 treats the position as a direction vector so that
  // viewProjection applies rotation + scale but NOT the camera translation
  // (which is already baked into the relative coordinates).  Adding (0,0,0,1)
  // restores the homogeneous point.  This keeps full f32 precision at any zoom.
  let relX = mix(tile.extent.x, tile.extent.z, uv.x);
  let relY = mix(tile.extent.y, tile.extent.w, uv.y);
  let clipOffset = camera.viewProjection * vec4<f32>(relX, relY, 0.0, 0.0);

  var out: VertexOutput;
  out.position = clipOffset + vec4<f32>(0.0, 0.0, 0.0, 1.0);
  // Flip UV Y: texture (0,0) = top-left (north), but world minY = south
  out.uv = vec2<f32>(uv.x, 1.0 - uv.y);
  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  var color = textureSample(tileTexture, tileSampler, input.uv);
  // Brightness
  var rgb = color.rgb * tile.brightness;
  // Contrast: (c - 0.5) * contrast + 0.5
  rgb = (rgb - 0.5) * tile.contrast + 0.5;
  // Saturation: mix grayscale ↔ color
  let gray = dot(rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
  rgb = mix(vec3<f32>(gray), rgb, tile.saturate);
  return vec4<f32>(rgb, color.a * tile.opacity);
}
`
);
function zt(r) {
  return r.createBindGroupLayout({
    label: "camera-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "uniform" }
      }
    ]
  });
}
function Vt(r) {
  return r.createBindGroupLayout({
    label: "raster-tile-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: "filtering" }
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: "float" }
      }
    ]
  });
}
function Ot(r) {
  const { device: e, colorFormat: t, cameraBindGroupLayout: o } = r, i = Vt(e), a = e.createShaderModule({
    label: "raster-shader",
    code: Ut
  }), n = e.createPipelineLayout({
    label: "raster-pipeline-layout",
    bindGroupLayouts: [o, i]
  }), s = e.createRenderPipeline({
    label: "raster-pipeline",
    layout: n,
    vertex: {
      module: a,
      entryPoint: "vs_main"
    },
    fragment: {
      module: a,
      entryPoint: "fs_main",
      targets: [
        {
          format: t,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            }
          }
        }
      ]
    },
    primitive: {
      topology: "triangle-strip",
      stripIndexFormat: void 0
    },
    depthStencil: {
      format: r.depthFormat ?? "depth24plus",
      depthWriteEnabled: !1,
      depthCompare: "always"
      // Raster always renders regardless of depth
    },
    multisample: {
      count: r.sampleCount ?? E
    }
  }), l = e.createSampler({
    label: "raster-tile-sampler",
    magFilter: "linear",
    minFilter: "linear",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge"
  });
  return { pipeline: s, rasterBindGroupLayout: i, sampler: l };
}
const z = (
  /* wgsl */
  `
struct CameraUniforms {
  viewProjection: mat4x4<f32>,
  viewport: vec2<f32>,
  relativeViewProjection: mat4x4<f32>,
  worldOrigin: vec4<f32>,
};

@group(0) @binding(0) var<uniform> camera: CameraUniforms;`
), te = (
  /* wgsl */
  `
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

@group(0) @binding(0) var<uniform> camera: GlobeCameraUniforms;`
), nt = (
  /* wgsl */
  `
const PI: f32 = 3.14159265358979323846;
const TWO_PI: f32 = 6.28318530717958647692;
const HALF_CIRCUMFERENCE: f32 = 20037508.34;`
), q = (
  /* wgsl */
  `
const EARTH_RADIUS_M: f32 = 6378137.0;
const ALTITUDE_EXAG: f32 = 1.0;

fn altitudeOffset(altMeters: f32) -> f32 {
  return altMeters / EARTH_RADIUS_M * ALTITUDE_EXAG;
}`
), st = (
  /* wgsl */
  `
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
}`
), N = te + `
` + nt + `
` + st, It = (
  /* wgsl */
  `

// ─── Bindings ───
${z}

struct PointMaterial {
  color: vec4<f32>,
  outlineColor: vec4<f32>,
  size: f32,
  outlineWidth: f32,
  // 0 = circle, 1 = square
  shape: f32,
  // 0 = solid (normal), >0 = soft radial glow falloff
  glowFalloff: f32,
};

@group(1) @binding(0) var<uniform> material: PointMaterial;

// ─── Vertex ───

struct VertexInput {
  // Per-instance: point center position (x, y, z)
  @location(0) position: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

// Billboard quad: 6 vertices (2 triangles) per point instance
@vertex
fn vs_main(
  input: VertexInput,
  @builtin(vertex_index) vid: u32,
) -> VertexOutput {
  // Quad corners: 2 triangles (0,1,2) and (2,1,3)
  var quadOffsets = array<vec2<f32>, 6>(
    vec2<f32>(-0.5, -0.5),
    vec2<f32>( 0.5, -0.5),
    vec2<f32>(-0.5,  0.5),
    vec2<f32>(-0.5,  0.5),
    vec2<f32>( 0.5, -0.5),
    vec2<f32>( 0.5,  0.5),
  );

  let offset = quadOffsets[vid];
  let uv = offset + vec2<f32>(0.5, 0.5);

  // Project center to clip space
  let clipCenter = camera.viewProjection * vec4<f32>(input.position.xy, 0.0, 1.0);

  // Billboard: offset in screen space then back to clip
  let pixelSize = material.size + material.outlineWidth * 2.0;
  let screenOffset = offset * pixelSize;
  let ndcOffset = vec2<f32>(
    screenOffset.x * 2.0 / camera.viewport.x,
    screenOffset.y * 2.0 / camera.viewport.y,
  );

  var out: VertexOutput;
  out.clipPosition = vec4<f32>(
    clipCenter.x + ndcOffset.x * clipCenter.w,
    clipCenter.y + ndcOffset.y * clipCenter.w,
    clipCenter.z,
    clipCenter.w,
  );
  out.uv = uv;
  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let centered = input.uv - vec2<f32>(0.5, 0.5);
  let totalRadius = 0.5;
  let dist = length(centered);

  // ── Soft glow mode: radial gradient falloff ──
  if (material.glowFalloff > 0.0) {
    if (dist > totalRadius) {
      discard;
    }
    // Quadratic falloff from center to edge → soft halo
    let t = dist / totalRadius;
    let alpha = (1.0 - t * t) * material.color.a;
    return vec4<f32>(material.color.rgb, alpha);
  }

  // ── Normal mode: solid circle/square with outline ──
  let outlineFraction = material.outlineWidth / (material.size + material.outlineWidth * 2.0);
  let innerRadius = totalRadius - outlineFraction;

  // Compute derivatives in uniform control flow (before any discard/branch)
  let aa = fwidth(dist);
  let squareDist = max(abs(centered.x), abs(centered.y));

  if (material.shape < 0.5) {
    // Circle SDF
    if (dist > totalRadius) {
      discard;
    }
    // Anti-alias edge with smooth transition
    let alpha = 1.0 - smoothstep(innerRadius - aa, innerRadius, dist);
    return mix(material.outlineColor, material.color, alpha);
  } else {
    // Square SDF
    if (squareDist > totalRadius) {
      discard;
    }
    if (squareDist > innerRadius) {
      return material.outlineColor;
    }
    return material.color;
  }
}
`
);
function Nt(r) {
  return r.createBindGroupLayout({
    label: "point-material-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }
      }
    ]
  });
}
function kt(r) {
  const { device: e, colorFormat: t, cameraBindGroupLayout: o } = r, i = Nt(e), a = e.createShaderModule({
    label: "point-shader",
    code: It
  }), n = e.createPipelineLayout({
    label: "point-pipeline-layout",
    bindGroupLayouts: [o, i]
  });
  return { pipeline: e.createRenderPipeline({
    label: "point-pipeline",
    layout: n,
    vertex: {
      module: a,
      entryPoint: "vs_main",
      buffers: [
        {
          // Per-instance vertex buffer: vec3<f32> position
          arrayStride: 12,
          // 3 * 4 bytes
          stepMode: "instance",
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: "float32x3"
            }
          ]
        }
      ]
    },
    fragment: {
      module: a,
      entryPoint: "fs_main",
      targets: [
        {
          format: t,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            }
          }
        }
      ]
    },
    primitive: {
      topology: "triangle-list"
    },
    depthStencil: {
      format: r.depthFormat ?? "depth24plus",
      depthWriteEnabled: !0,
      depthCompare: r.depthCompare ?? "less"
    },
    multisample: {
      count: r.sampleCount ?? E
    }
  }), materialBindGroupLayout: i };
}
const Ht = (
  /* wgsl */
  `

// ─── Bindings ───
${z}

struct LineMaterial {
  color: vec4<f32>,
  width: f32,
  // Dash pattern: 0=solid, 1=dash, 2=dot, 3=dash-dot
  dashStyle: f32,
  dashAnimationSpeed: f32,
  time: f32,
  // Custom dashArray — packed into 2 vec4s (up to 8 segments)
  dashSegments0: vec4<f32>,
  dashSegments1: vec4<f32>,
  // x=segment count (0=use dashStyle), y=total pattern length
  dashMeta: vec4<f32>,
};

@group(1) @binding(0) var<uniform> material: LineMaterial;

// ─── Vertex ───

// Each line segment uses 6 vertices (2 triangles forming a screen-space quad).
// Vertex buffer layout: [prevX, prevY, prevZ, currX, currY, currZ, nextX, nextY, nextZ, side, cumulDist]
// side: -1.0 or 1.0 (which side of the line)
// cumulDist: cumulative Mercator arc-length from polyline start
struct VertexInput {
  @location(0) prevPos: vec3<f32>,
  @location(1) currPos: vec3<f32>,
  @location(2) nextPos: vec3<f32>,
  @location(3) side: f32,
  @location(4) cumulDist: f32,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) lineDistance: f32,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  let clipCurr = camera.viewProjection * vec4<f32>(input.currPos.xy, 0.0, 1.0);
  let clipPrev = camera.viewProjection * vec4<f32>(input.prevPos.xy, 0.0, 1.0);
  let clipNext = camera.viewProjection * vec4<f32>(input.nextPos.xy, 0.0, 1.0);

  // Convert to screen space
  let screenCurr = clipCurr.xy / clipCurr.w * camera.viewport * 0.5;
  let screenPrev = clipPrev.xy / clipPrev.w * camera.viewport * 0.5;
  let screenNext = clipNext.xy / clipNext.w * camera.viewport * 0.5;

  // Direction vectors
  let dirPrev = normalize(screenCurr - screenPrev);
  let dirNext = normalize(screenNext - screenCurr);

  // Miter direction (average of two normals)
  let normalPrev = vec2<f32>(-dirPrev.y, dirPrev.x);
  let normalNext = vec2<f32>(-dirNext.y, dirNext.x);

  var miter: vec2<f32>;
  let hasPrev = length(input.currPos - input.prevPos) > 0.0001;
  let hasNext = length(input.nextPos - input.currPos) > 0.0001;

  if (hasPrev && hasNext) {
    miter = normalize(normalPrev + normalNext);
    // Miter length correction
    let miterLen = 1.0 / max(dot(miter, normalPrev), 0.1);
    miter = miter * min(miterLen, 3.0); // Cap miter to prevent spikes
  } else if (hasPrev) {
    miter = normalPrev;
  } else {
    miter = normalNext;
  }

  // Offset in screen space
  let halfWidth = material.width * 0.5;
  let offset = miter * halfWidth * input.side;

  // Back to clip space
  let screenPos = screenCurr + offset;
  let ndcPos = screenPos / (camera.viewport * 0.5);

  // Cumulative arc-length → screen-space via pixels-per-unit ratio
  let mercLen = length(input.currPos.xy - input.prevPos.xy);
  let screenLen = length(screenCurr - screenPrev);
  let ppu = select(1.0, screenLen / mercLen, mercLen > 0.0001);

  var out: VertexOutput;
  out.clipPosition = vec4<f32>(ndcPos * clipCurr.w, clipCurr.z, clipCurr.w);
  out.lineDistance = input.cumulDist * ppu;
  return out;
}

// ─── Fragment ───

fn getDashSegment(i: i32) -> f32 {
  if (i < 4) { return material.dashSegments0[i]; }
  return material.dashSegments1[i - 4];
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let dist = input.lineDistance + material.dashAnimationSpeed * material.time;

  // Custom dashArray takes priority when dashMeta.x > 0
  let segCount = i32(material.dashMeta.x);
  if (segCount > 0) {
    let total = material.dashMeta.y;
    let d = ((dist % total) + total) % total; // wrap positive
    var cumul = 0.0;
    for (var i = 0; i < 8; i++) {
      if (i >= segCount) { break; }
      cumul += getDashSegment(i);
      if (d < cumul) {
        if (i % 2 == 1) { discard; } // odd index = gap
        break;
      }
    }
    return material.color;
  }

  // Built-in dash patterns (screen-space units)
  if (material.dashStyle > 0.5 && material.dashStyle < 1.5) {
    // Dash: 10px on, 6px off
    let pattern = dist % 16.0;
    if (pattern > 10.0) { discard; }
  } else if (material.dashStyle > 1.5 && material.dashStyle < 2.5) {
    // Dot: 3px on, 3px off
    let pattern = dist % 6.0;
    if (pattern > 3.0) { discard; }
  } else if (material.dashStyle > 2.5) {
    // Dash-dot: 10px on, 4px off, 3px on, 4px off
    let pattern = dist % 21.0;
    if ((pattern > 10.0 && pattern < 14.0) || pattern > 17.0) { discard; }
  }

  return material.color;
}
`
);
function Wt(r) {
  return r.createBindGroupLayout({
    label: "line-material-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }
      }
    ]
  });
}
function jt(r) {
  const { device: e, colorFormat: t, cameraBindGroupLayout: o } = r, i = Wt(e), a = e.createShaderModule({
    label: "line-shader",
    code: Ht
  }), n = e.createPipelineLayout({
    label: "line-pipeline-layout",
    bindGroupLayouts: [o, i]
  });
  return { pipeline: e.createRenderPipeline({
    label: "line-pipeline",
    layout: n,
    vertex: {
      module: a,
      entryPoint: "vs_main",
      buffers: [
        {
          // Vertex buffer: prevPos(3) + currPos(3) + nextPos(3) + side(1) + cumulDist(1) = 11 floats
          arrayStride: 44,
          // 11 * 4 bytes
          stepMode: "vertex",
          attributes: [
            {
              // prevPos
              shaderLocation: 0,
              offset: 0,
              format: "float32x3"
            },
            {
              // currPos
              shaderLocation: 1,
              offset: 12,
              format: "float32x3"
            },
            {
              // nextPos
              shaderLocation: 2,
              offset: 24,
              format: "float32x3"
            },
            {
              // side
              shaderLocation: 3,
              offset: 36,
              format: "float32"
            },
            {
              // cumulDist
              shaderLocation: 4,
              offset: 40,
              format: "float32"
            }
          ]
        }
      ]
    },
    fragment: {
      module: a,
      entryPoint: "fs_main",
      targets: [
        {
          format: t,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            }
          }
        }
      ]
    },
    primitive: {
      topology: "triangle-list"
    },
    depthStencil: {
      format: r.depthFormat ?? "depth24plus",
      depthWriteEnabled: !0,
      depthCompare: r.depthCompare ?? "less"
    },
    multisample: {
      count: r.sampleCount ?? E
    }
  }), materialBindGroupLayout: i };
}
function se(r) {
  switch (r) {
    case "solid":
      return 0;
    case "dash":
      return 1;
    case "dot":
      return 2;
    case "dash-dot":
      return 3;
  }
}
const Xt = (
  /* wgsl */
  `

// ─── Bindings ───
${z}

struct PolygonMaterial {
  color: vec4<f32>,
};

@group(1) @binding(0) var<uniform> material: PolygonMaterial;

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
  // Surface family contract: flat 2D polygons clamp to the map plane.
  out.clipPosition = camera.viewProjection * vec4<f32>(input.position.xy, 0.0, 1.0);
  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  return material.color;
}
`
);
function $t(r) {
  return r.createBindGroupLayout({
    label: "polygon-material-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }
      }
    ]
  });
}
function Yt(r) {
  const { device: e, colorFormat: t, cameraBindGroupLayout: o } = r, i = $t(e), a = e.createShaderModule({
    label: "polygon-shader",
    code: Xt
  }), n = e.createPipelineLayout({
    label: "polygon-pipeline-layout",
    bindGroupLayouts: [o, i]
  });
  return { pipeline: e.createRenderPipeline({
    label: "polygon-pipeline",
    layout: n,
    vertex: {
      module: a,
      entryPoint: "vs_main",
      buffers: [
        {
          // Vertex buffer: position (vec3<f32>)
          arrayStride: 12,
          // 3 * 4 bytes
          stepMode: "vertex",
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: "float32x3"
            }
          ]
        }
      ]
    },
    fragment: {
      module: a,
      entryPoint: "fs_main",
      targets: [
        {
          format: t,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            }
          }
        }
      ]
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "none"
      // Polygons can be CW or CCW
    },
    depthStencil: {
      format: r.depthFormat ?? "depth24plus",
      // Polygon fills are typically semi-transparent and should NOT write to
      // the depth buffer. This ensures outlines (rendered afterwards via the
      // line pipeline at the same geometric Z) always pass the depth test.
      depthWriteEnabled: !1,
      depthCompare: r.depthCompare ?? "always"
    },
    multisample: {
      count: r.sampleCount ?? E
    }
  }), materialBindGroupLayout: i };
}
const Zt = (
  /* wgsl */
  `

// ─── Bindings ───
${z}

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
`
);
function qt(r) {
  return r.createBindGroupLayout({
    label: "picking-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }
      }
    ]
  });
}
function Kt(r) {
  const { device: e, cameraBindGroupLayout: t, width: o, height: i } = r, a = qt(e), n = e.createShaderModule({
    label: "picking-shader",
    code: Zt
  }), s = e.createPipelineLayout({
    label: "picking-pipeline-layout",
    bindGroupLayouts: [t, a]
  }), l = e.createRenderPipeline({
    label: "picking-pipeline",
    layout: s,
    vertex: {
      module: n,
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 12,
          // vec3<f32>
          stepMode: "vertex",
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: "float32x3"
            }
          ]
        }
      ]
    },
    fragment: {
      module: n,
      entryPoint: "fs_main",
      targets: [
        {
          format: "rgba8unorm"
          // No blending for picking — exact ID colors
        }
      ]
    },
    primitive: {
      topology: "triangle-list"
    },
    depthStencil: {
      format: r.depthFormat ?? "depth24plus",
      depthWriteEnabled: !0,
      depthCompare: r.depthCompare ?? "less"
    }
  }), c = e.createTexture({
    label: "picking-texture",
    size: { width: o, height: i },
    format: "rgba8unorm",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
  }), p = e.createTexture({
    label: "picking-depth-texture",
    size: { width: o, height: i },
    format: r.depthFormat ?? "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT
  }), u = e.createBuffer({
    label: "picking-readback-buffer",
    size: 256,
    // Min 256 bytes for mapAsync alignment
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
  });
  return {
    pipeline: l,
    pickingBindGroupLayout: a,
    pickingTexture: c,
    depthTexture: p,
    readbackBuffer: u,
    width: o,
    height: i
  };
}
function po(r, e) {
  const t = (r & 255) / 255, o = (r >> 8 & 255) / 255, i = (r >> 16 & 255) / 255, a = (e & 255) / 255;
  return [t, o, i, a];
}
function lt(r, e, t, o) {
  return r === 0 && e === 0 && t === 0 && o === 0 ? null : { featureId: r | e << 8 | t << 16, layerIndex: o };
}
async function fo(r, e, t, o) {
  if (t < 0 || t >= e.width || o < 0 || o >= e.height)
    return null;
  const i = r.createCommandEncoder({ label: "picking-readback-encoder" });
  i.copyTextureToBuffer(
    {
      texture: e.pickingTexture,
      origin: { x: Math.floor(t), y: Math.floor(o) }
    },
    {
      buffer: e.readbackBuffer,
      bytesPerRow: 256
      // Minimum alignment
    },
    { width: 1, height: 1 }
  ), r.queue.submit([i.finish()]), await e.readbackBuffer.mapAsync(GPUMapMode.READ);
  const a = new Uint8Array(e.readbackBuffer.getMappedRange(0, 4)), n = a[0], s = a[1], l = a[2], c = a[3];
  return e.readbackBuffer.unmap(), lt(n, s, l, c);
}
const Qt = (
  /* wgsl */
  `

// ─── Bindings ───
${z}

struct TextMaterial {
  color: vec4<f32>,
  haloColor: vec4<f32>,
  fontSize: f32,
  haloWidth: f32,
  // 0=center, 1=left, 2=right, 3=top, 4=bottom
  anchor: f32,
  _pad: f32,
};

@group(1) @binding(0) var<uniform> material: TextMaterial;
@group(1) @binding(1) var atlasSampler: sampler;
@group(1) @binding(2) var atlasTexture: texture_2d<f32>;

// ─── Vertex ───

struct VertexInput {
  // Per-instance: glyph position (world x, y, z)
  @location(0) position: vec3<f32>,
  // Per-instance: glyph UV rect in atlas (u0, v0, u1, v1)
  @location(1) uvRect: vec4<f32>,
  // Per-instance: glyph offset from anchor + size (offsetX, offsetY, width, height)
  @location(2) glyphOffset: vec4<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

// Billboard quad: 6 vertices (2 triangles) per glyph instance
@vertex
fn vs_main(
  input: VertexInput,
  @builtin(vertex_index) vid: u32,
) -> VertexOutput {
  // Quad corners: 2 triangles (0,1,2) and (2,1,3)
  var quadOffsets = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(0.0, 1.0),
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(1.0, 1.0),
  );

  let corner = quadOffsets[vid];

  // Interpolate UV from atlas rect
  let uv = vec2<f32>(
    mix(input.uvRect.x, input.uvRect.z, corner.x),
    mix(input.uvRect.y, input.uvRect.w, corner.y),
  );

  // Project center to clip space
  let clipCenter = camera.viewProjection * vec4<f32>(input.position, 1.0);

  // Screen-space offset for this glyph quad
  let pixelOffset = vec2<f32>(
    input.glyphOffset.x + corner.x * input.glyphOffset.z,
    input.glyphOffset.y + corner.y * input.glyphOffset.w,
  );

  let ndcOffset = vec2<f32>(
    pixelOffset.x * 2.0 / camera.viewport.x,
    pixelOffset.y * 2.0 / camera.viewport.y,
  );

  var out: VertexOutput;
  out.clipPosition = vec4<f32>(
    clipCenter.x + ndcOffset.x * clipCenter.w,
    clipCenter.y - ndcOffset.y * clipCenter.w,
    clipCenter.z,
    clipCenter.w,
  );
  out.uv = uv;
  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // SDF distance sample (r channel, 0.5 = edge)
  let dist = textureSample(atlasTexture, atlasSampler, input.uv).r;

  // SDF threshold: inside glyph
  let edgeThreshold = 0.5;
  let aa = fwidth(dist) * 0.75;

  // Halo rendering
  let haloThreshold = edgeThreshold - material.haloWidth * 0.05;
  let haloAlpha = smoothstep(haloThreshold - aa, haloThreshold + aa, dist);
  let fillAlpha = smoothstep(edgeThreshold - aa, edgeThreshold + aa, dist);

  // Composite: halo behind fill
  let haloResult = vec4<f32>(material.haloColor.rgb, material.haloColor.a * haloAlpha);
  let fillResult = vec4<f32>(material.color.rgb, material.color.a * fillAlpha);

  // Alpha blend: fill over halo
  let alpha = fillResult.a + haloResult.a * (1.0 - fillResult.a);
  if (alpha < 0.01) {
    discard;
  }

  let rgb = (fillResult.rgb * fillResult.a + haloResult.rgb * haloResult.a * (1.0 - fillResult.a)) / alpha;
  return vec4<f32>(rgb, alpha);
}
`
);
function Jt(r) {
  return r.createBindGroupLayout({
    label: "text-material-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: "filtering" }
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: "float" }
      }
    ]
  });
}
function er(r) {
  const { device: e, colorFormat: t, cameraBindGroupLayout: o } = r, i = Jt(e), a = e.createShaderModule({
    label: "text-shader",
    code: Qt
  }), n = e.createPipelineLayout({
    label: "text-pipeline-layout",
    bindGroupLayouts: [o, i]
  }), s = e.createRenderPipeline({
    label: "text-pipeline",
    layout: n,
    vertex: {
      module: a,
      entryPoint: "vs_main",
      buffers: [
        {
          // Per-instance vertex buffer:
          // vec3<f32> position (12) + vec4<f32> uvRect (16) + vec4<f32> glyphOffset (16) = 44 bytes
          arrayStride: 44,
          stepMode: "instance",
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: "float32x3"
              // position
            },
            {
              shaderLocation: 1,
              offset: 12,
              format: "float32x4"
              // uvRect
            },
            {
              shaderLocation: 2,
              offset: 28,
              format: "float32x4"
              // glyphOffset
            }
          ]
        }
      ]
    },
    fragment: {
      module: a,
      entryPoint: "fs_main",
      targets: [
        {
          format: t,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            }
          }
        }
      ]
    },
    primitive: {
      topology: "triangle-list"
    },
    depthStencil: {
      format: r.depthFormat ?? "depth24plus",
      depthWriteEnabled: !1,
      // Text overlay: less-equal for standard, greater-equal for reversed-Z
      depthCompare: r.depthCompare === "greater" ? "greater-equal" : "less-equal"
    },
    multisample: {
      count: r.sampleCount ?? E
    }
  }), l = e.createSampler({
    label: "text-atlas-sampler",
    magFilter: "linear",
    minFilter: "linear",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge"
  });
  return { pipeline: s, materialBindGroupLayout: i, sampler: l };
}
const tr = (
  /* wgsl */
  `

// ─── Bindings ───

struct PostProcessUniforms {
  // Reciprocal of screen size (1/width, 1/height)
  rcpScreenSize: vec2<f32>,
  // FXAA quality: subpixel aliasing removal (0.0 = off, 1.0 = full)
  fxaaQuality: f32,
  _pad: f32,
};

@group(0) @binding(0) var<uniform> params: PostProcessUniforms;
@group(0) @binding(1) var sceneSampler: sampler;
@group(0) @binding(2) var sceneTexture: texture_2d<f32>;

// ─── Vertex ───

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

// Full-screen quad: 4 vertices, triangle-strip
@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VertexOutput {
  var positions = array<vec2<f32>, 4>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0,  1.0),
  );

  let pos = positions[vid];
  let uv = pos * 0.5 + vec2<f32>(0.5, 0.5);

  var out: VertexOutput;
  out.position = vec4<f32>(pos, 0.0, 1.0);
  // Flip Y for texture sampling (UV origin = top-left)
  out.uv = vec2<f32>(uv.x, 1.0 - uv.y);
  return out;
}

// ─── FXAA Fragment ───

// Luma hesapla (Rec. 709)
fn luminance(color: vec3<f32>) -> f32 {
  return dot(color, vec3<f32>(0.299, 0.587, 0.114));
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let uv = input.uv;
  let rcpFrame = params.rcpScreenSize;

  // Center pixel
  let colorM = textureSample(sceneTexture, sceneSampler, uv);
  let lumaM = luminance(colorM.rgb);

  // Neighbor luma samples (NSWE)
  let lumaN = luminance(textureSample(sceneTexture, sceneSampler, uv + vec2<f32>(0.0, -rcpFrame.y)).rgb);
  let lumaS = luminance(textureSample(sceneTexture, sceneSampler, uv + vec2<f32>(0.0,  rcpFrame.y)).rgb);
  let lumaW = luminance(textureSample(sceneTexture, sceneSampler, uv + vec2<f32>(-rcpFrame.x, 0.0)).rgb);
  let lumaE = luminance(textureSample(sceneTexture, sceneSampler, uv + vec2<f32>( rcpFrame.x, 0.0)).rgb);

  // Edge detection: max contrast
  let lumaMin = min(lumaM, min(min(lumaN, lumaS), min(lumaW, lumaE)));
  let lumaMax = max(lumaM, max(max(lumaN, lumaS), max(lumaW, lumaE)));
  let lumaRange = lumaMax - lumaMin;

  // Skip low contrast areas
  let edgeThreshold = 0.0625;
  let edgeThresholdMin = 0.0312;
  if (lumaRange < max(edgeThresholdMin, lumaMax * edgeThreshold)) {
    return colorM;
  }

  // Corner samples for better edge direction estimation
  let lumaNW = luminance(textureSample(sceneTexture, sceneSampler, uv + vec2<f32>(-rcpFrame.x, -rcpFrame.y)).rgb);
  let lumaNE = luminance(textureSample(sceneTexture, sceneSampler, uv + vec2<f32>( rcpFrame.x, -rcpFrame.y)).rgb);
  let lumaSW = luminance(textureSample(sceneTexture, sceneSampler, uv + vec2<f32>(-rcpFrame.x,  rcpFrame.y)).rgb);
  let lumaSE = luminance(textureSample(sceneTexture, sceneSampler, uv + vec2<f32>( rcpFrame.x,  rcpFrame.y)).rgb);

  // Subpixel aliasing test
  let lumaAvg = (lumaN + lumaS + lumaW + lumaE) * 0.25;
  let subpixelBlend = clamp(abs(lumaAvg - lumaM) / lumaRange, 0.0, 1.0);
  let subpixelAmount = smoothstep(0.0, 1.0, subpixelBlend) * smoothstep(0.0, 1.0, subpixelBlend) * params.fxaaQuality;

  // Determine edge direction (horizontal vs vertical)
  let edgeH = abs(lumaN + lumaS - 2.0 * lumaM) * 2.0 +
              abs(lumaNE + lumaSE - 2.0 * lumaE) +
              abs(lumaNW + lumaSW - 2.0 * lumaW);
  let edgeV = abs(lumaE + lumaW - 2.0 * lumaM) * 2.0 +
              abs(lumaNE + lumaNW - 2.0 * lumaN) +
              abs(lumaSE + lumaSW - 2.0 * lumaS);
  let isHorizontal = edgeH >= edgeV;

  // Blend direction
  var blendDir: vec2<f32>;
  if (isHorizontal) {
    let gradN = abs(lumaN - lumaM);
    let gradS = abs(lumaS - lumaM);
    if (gradN >= gradS) {
      blendDir = vec2<f32>(0.0, -rcpFrame.y);
    } else {
      blendDir = vec2<f32>(0.0, rcpFrame.y);
    }
  } else {
    let gradW = abs(lumaW - lumaM);
    let gradE = abs(lumaE - lumaM);
    if (gradW >= gradE) {
      blendDir = vec2<f32>(-rcpFrame.x, 0.0);
    } else {
      blendDir = vec2<f32>(rcpFrame.x, 0.0);
    }
  }

  // Simple 2-tap blend along edge
  let blendedColor = textureSample(sceneTexture, sceneSampler, uv + blendDir * 0.5);

  // Mix with subpixel amount
  return mix(colorM, blendedColor, subpixelAmount);
}
`
);
function rr(r) {
  return r.createBindGroupLayout({
    label: "post-process-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: "filtering" }
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: "float" }
      }
    ]
  });
}
function ir(r) {
  const { device: e, colorFormat: t } = r, o = rr(e), i = e.createShaderModule({
    label: "post-process-shader",
    code: tr
  }), a = e.createPipelineLayout({
    label: "post-process-pipeline-layout",
    bindGroupLayouts: [o]
  }), n = e.createRenderPipeline({
    label: "post-process-pipeline",
    layout: a,
    vertex: {
      module: i,
      entryPoint: "vs_main"
    },
    fragment: {
      module: i,
      entryPoint: "fs_main",
      targets: [
        {
          format: t
        }
      ]
    },
    primitive: {
      topology: "triangle-strip",
      stripIndexFormat: void 0
    },
    multisample: {
      count: r.sampleCount ?? E
    }
  }), s = e.createSampler({
    label: "post-process-sampler",
    magFilter: "linear",
    minFilter: "linear",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge"
  });
  return { pipeline: n, bindGroupLayout: o, sampler: s };
}
const Ae = 512, Ue = 4096, V = 1;
class ho {
  glyphs = /* @__PURE__ */ new Map();
  shelves = [];
  _width;
  _height;
  data;
  dirty = !1;
  // GPU resources
  device = null;
  texture = null;
  constructor(e) {
    this._width = Ae, this._height = Ae, this.data = new Uint8Array(this._width * this._height), this.device = e ?? null;
  }
  get width() {
    return this._width;
  }
  get height() {
    return this._height;
  }
  get glyphCount() {
    return this.glyphs.size;
  }
  get isDirty() {
    return this.dirty;
  }
  /**
   * SDF glyph ekle.
   * @param charCode Unicode character code
   * @param sdfData SDF bitmap verisi (width x height, single channel)
   * @param metrics Glyph metrikleri
   * @returns Eklenen GlyphEntry veya null (yer yoksa)
   */
  addGlyph(e, t, o) {
    const i = this.glyphs.get(e);
    if (i) return i;
    const a = o.width + V * 2, n = o.height + V * 2;
    let s = !1, l = 0, c = 0;
    for (const h of this.shelves)
      if (h.height >= n && h.nextX + a <= this._width) {
        l = h.nextX, c = h.y, h.nextX += a, s = !0;
        break;
      }
    if (!s) {
      if ((this.shelves.length > 0 ? this.shelves[this.shelves.length - 1].y + this.shelves[this.shelves.length - 1].height : 0) + n > this._height && !this.grow())
        return null;
      const x = this.shelves.length > 0 ? this.shelves[this.shelves.length - 1].y + this.shelves[this.shelves.length - 1].height : 0;
      if (x + n > this._height)
        return null;
      const g = {
        y: x,
        height: n,
        nextX: a
      };
      this.shelves.push(g), l = 0, c = x;
    }
    for (let h = 0; h < o.height; h++)
      for (let x = 0; x < o.width; x++) {
        const g = h * o.width + x, b = (c + V + h) * this._width + (l + V + x);
        this.data[b] = t[g];
      }
    const p = (l + V) / this._width, u = (c + V) / this._height, d = (l + V + o.width) / this._width, m = (c + V + o.height) / this._height, f = {
      uv: [p, u, d, m],
      metrics: o,
      x: l + V,
      y: c + V
    };
    return this.glyphs.set(e, f), this.dirty = !0, f;
  }
  /**
   * Glyph bilgilerini getir.
   */
  getGlyph(e) {
    return this.glyphs.get(e);
  }
  /**
   * GPU texture'i getir (lazy create + upload).
   */
  getTexture() {
    return this.device ? ((!this.texture || this.dirty) && this.uploadToGPU(), this.texture) : null;
  }
  /**
   * Atlas'in ham verisini dondur (test icin).
   */
  getData() {
    return this.data;
  }
  /**
   * Atlas'i 2x buyut (maks MAX_SIZE).
   * @returns Buyume basarili mi?
   */
  grow() {
    const e = Math.min(this._width * 2, Ue), t = Math.min(this._height * 2, Ue);
    if (e === this._width && t === this._height)
      return !1;
    const o = new Uint8Array(e * t);
    for (let i = 0; i < this._height; i++)
      for (let a = 0; a < this._width; a++)
        o[i * e + a] = this.data[i * this._width + a];
    this._width = e, this._height = t, this.data = o;
    for (const [, i] of this.glyphs)
      i.uv[0] = i.x / this._width, i.uv[1] = i.y / this._height, i.uv[2] = (i.x + i.metrics.width) / this._width, i.uv[3] = (i.y + i.metrics.height) / this._height;
    return this.texture && (this.texture.destroy(), this.texture = null), this.dirty = !0, !0;
  }
  /**
   * Atlas verisini GPU texture'a yukle.
   */
  uploadToGPU() {
    this.device && (this.texture && (this.texture.width !== this._width || this.texture.height !== this._height) && (this.texture.destroy(), this.texture = null), this.texture || (this.texture = this.device.createTexture({
      label: "glyph-atlas-texture",
      size: { width: this._width, height: this._height },
      format: "r8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    })), this.device.queue.writeTexture(
      { texture: this.texture },
      this.data.buffer,
      { bytesPerRow: this._width },
      { width: this._width, height: this._height }
    ), this.dirty = !1);
  }
  /**
   * Tum kaynaklari serbest birak.
   */
  destroy() {
    this.texture?.destroy(), this.texture = null, this.glyphs.clear(), this.shelves = [], this.dirty = !1;
  }
}
const ze = 512, Ve = 4096, O = 1, k = 4;
class or {
  sprites = /* @__PURE__ */ new Map();
  shelves = [];
  _width;
  _height;
  data;
  dirty = !1;
  // GPU resources
  device = null;
  texture = null;
  constructor(e) {
    this._width = ze, this._height = ze, this.data = new Uint8Array(this._width * this._height * k), this.device = e ?? null;
  }
  get width() {
    return this._width;
  }
  get height() {
    return this._height;
  }
  get spriteCount() {
    return this.sprites.size;
  }
  get isDirty() {
    return this.dirty;
  }
  /**
   * Sprite ekle.
   * @param id Sprite tanimlayicisi
   * @param data RGBA piksel verisi (width * height * 4 bytes)
   * @param width Sprite genisligi
   * @param height Sprite yuksekligi
   * @returns Eklenen SpriteEntry veya null (yer yoksa)
   */
  addSprite(e, t, o, i) {
    const a = this.sprites.get(e);
    if (a) return a;
    const n = o + O * 2, s = i + O * 2;
    let l = !1, c = 0, p = 0;
    for (const x of this.shelves)
      if (x.height >= s && x.nextX + n <= this._width) {
        c = x.nextX, p = x.y, x.nextX += n, l = !0;
        break;
      }
    if (!l) {
      if ((this.shelves.length > 0 ? this.shelves[this.shelves.length - 1].y + this.shelves[this.shelves.length - 1].height : 0) + s > this._height && !this.grow())
        return null;
      const g = this.shelves.length > 0 ? this.shelves[this.shelves.length - 1].y + this.shelves[this.shelves.length - 1].height : 0;
      if (g + s > this._height)
        return null;
      const b = {
        y: g,
        height: s,
        nextX: n
      };
      this.shelves.push(b), c = 0, p = g;
    }
    for (let x = 0; x < i; x++)
      for (let g = 0; g < o; g++) {
        const b = (x * o + g) * k, v = ((p + O + x) * this._width + (c + O + g)) * k;
        this.data[v] = t[b], this.data[v + 1] = t[b + 1], this.data[v + 2] = t[b + 2], this.data[v + 3] = t[b + 3];
      }
    const u = (c + O) / this._width, d = (p + O) / this._height, m = (c + O + o) / this._width, f = (p + O + i) / this._height, h = {
      uv: [u, d, m, f],
      width: o,
      height: i,
      x: c + O,
      y: p + O
    };
    return this.sprites.set(e, h), this.dirty = !0, h;
  }
  /**
   * Sprite bilgilerini getir.
   */
  getSprite(e) {
    return this.sprites.get(e);
  }
  /**
   * GPU texture'i getir (lazy create + upload).
   */
  getTexture() {
    return this.device ? ((!this.texture || this.dirty) && this.uploadToGPU(), this.texture) : null;
  }
  /**
   * Atlas'in ham verisini dondur (test icin).
   */
  getData() {
    return this.data;
  }
  /**
   * Atlas'i 2x buyut (maks MAX_SIZE).
   */
  grow() {
    const e = Math.min(this._width * 2, Ve), t = Math.min(this._height * 2, Ve);
    if (e === this._width && t === this._height)
      return !1;
    const o = new Uint8Array(e * t * k);
    for (let i = 0; i < this._height; i++)
      for (let a = 0; a < this._width; a++) {
        const n = (i * this._width + a) * k, s = (i * e + a) * k;
        o[s] = this.data[n], o[s + 1] = this.data[n + 1], o[s + 2] = this.data[n + 2], o[s + 3] = this.data[n + 3];
      }
    this._width = e, this._height = t, this.data = o;
    for (const [, i] of this.sprites)
      i.uv[0] = i.x / this._width, i.uv[1] = i.y / this._height, i.uv[2] = (i.x + i.width) / this._width, i.uv[3] = (i.y + i.height) / this._height;
    return this.texture && (this.texture.destroy(), this.texture = null), this.dirty = !0, !0;
  }
  /**
   * Atlas verisini GPU texture'a yukle.
   */
  uploadToGPU() {
    this.device && (this.texture && (this.texture.width !== this._width || this.texture.height !== this._height) && (this.texture.destroy(), this.texture = null), this.texture || (this.texture = this.device.createTexture({
      label: "sprite-atlas-texture",
      size: { width: this._width, height: this._height },
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    })), this.device.queue.writeTexture(
      { texture: this.texture },
      this.data.buffer,
      { bytesPerRow: this._width * k },
      { width: this._width, height: this._height }
    ), this.dirty = !1);
  }
  /**
   * Tum kaynaklari serbest birak.
   */
  destroy() {
    this.texture?.destroy(), this.texture = null, this.sprites.clear(), this.shelves = [], this.dirty = !1;
  }
}
const ar = 64;
class mo {
  cellSize;
  constructor(e = ar) {
    this.cellSize = e;
  }
  /**
   * Label'lari viewport icerisine yerlestir, cakisanlari gizle.
   * @param labels Yerlestirilecek label'lar
   * @param viewport Viewport boyutlari
   * @returns Yerlestirme sonuclari (her label icin)
   */
  layoutLabels(e, t) {
    const o = [...e].sort((c, p) => p.priority - c.priority), i = Math.ceil(t.width / this.cellSize), a = Math.ceil(t.height / this.cellSize), n = [];
    for (let c = 0; c < a; c++) {
      n[c] = [];
      for (let p = 0; p < i; p++)
        n[c][p] = { labels: [] };
    }
    const s = [], l = [];
    for (const c of o) {
      const p = {
        id: c.id,
        screenX: c.screenX,
        screenY: c.screenY,
        visible: !0
      };
      if (c.screenX + c.width < 0 || c.screenX > t.width || c.screenY + c.height < 0 || c.screenY > t.height) {
        p.visible = !1, s.push(p);
        continue;
      }
      const u = Math.max(0, Math.floor(c.screenX / this.cellSize)), d = Math.min(i - 1, Math.floor((c.screenX + c.width) / this.cellSize)), m = Math.max(0, Math.floor(c.screenY / this.cellSize)), f = Math.min(a - 1, Math.floor((c.screenY + c.height) / this.cellSize));
      let h = !1;
      for (const x of l)
        if (this.rectsOverlap(
          c.screenX,
          c.screenY,
          c.width,
          c.height,
          x.x,
          x.y,
          x.w,
          x.h
        )) {
          h = !0;
          break;
        }
      if (h)
        p.visible = !1;
      else {
        for (let x = m; x <= f; x++)
          for (let g = u; g <= d; g++)
            n[x][g].labels.push(p);
        l.push({
          x: c.screenX,
          y: c.screenY,
          w: c.width,
          h: c.height
        });
      }
      s.push(p);
    }
    return s;
  }
  /**
   * Iki AABB'nin cakisip cakismadigini kontrol et.
   */
  rectsOverlap(e, t, o, i, a, n, s, l) {
    return !(e + o <= a || a + s <= e || t + i <= n || n + l <= t);
  }
}
const nr = (
  /* wgsl */
  `

// ─── Constants ───
${N}
${q}

// ─── Bindings ───

struct PointMaterial {
  color: vec4<f32>,
  outlineColor: vec4<f32>,
  size: f32,
  outlineWidth: f32,
  // 0 = circle, 1 = square
  shape: f32,
  _pad: f32,
};

@group(1) @binding(0) var<uniform> material: PointMaterial;

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
  let uv = offset + vec2<f32>(0.5, 0.5);

  // EPSG:3857 → Mercator [0..1] → Angular → Sphere
  let merc01 = epsg3857ToMerc01(input.position);
  let angular = mercatorToAngular(merc01);
  let baseSphere = angularToSphere(angular.x, angular.y);
  let altFrac = altitudeOffset(input.position.z);
  let spherePos = baseSphere * (1.0 + altFrac);

  // Globe clip space
  var globeClip = camera.viewProjection * vec4<f32>(spherePos, 1.0);
  globeClip.z = globeClippingZ(baseSphere) * globeClip.w;

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

  // Billboard offset in screen space
  let pixelSize = material.size + material.outlineWidth * 2.0;
  let screenOffset = offset * pixelSize;
  let ndcOffset = vec2<f32>(
    screenOffset.x * 2.0 / camera.viewport.x,
    screenOffset.y * 2.0 / camera.viewport.y,
  );

  // Shader-level depth offset: points render in front of lines
  const LAYER_DEPTH_OFFSET: f32 = 0.0008;
  let adjustedZ = clipCenter.z - LAYER_DEPTH_OFFSET * clipCenter.w;
  let clampedZ = min(adjustedZ, clipCenter.w * 0.9999);
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
  let totalRadius = 0.5;
  let outlineFraction = material.outlineWidth / (material.size + material.outlineWidth * 2.0);
  let innerRadius = totalRadius - outlineFraction;

  let dist = length(centered);
  let aa = fwidth(dist);
  let squareDist = max(abs(centered.x), abs(centered.y));

  if (material.shape < 0.5) {
    // Circle SDF
    if (dist > totalRadius) {
      discard;
    }
    let alpha = 1.0 - smoothstep(innerRadius - aa, innerRadius, dist);
    return mix(material.outlineColor, material.color, alpha);
  } else {
    // Square SDF
    if (squareDist > totalRadius) {
      discard;
    }
    if (squareDist > innerRadius) {
      return material.outlineColor;
    }
    return material.color;
  }
}
`
);
function sr(r) {
  return r.createBindGroupLayout({
    label: "globe-point-material-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }
      }
    ]
  });
}
function lr(r) {
  const { device: e, colorFormat: t, globeCameraBindGroupLayout: o } = r, i = sr(e), a = e.createShaderModule({
    label: "globe-point-shader",
    code: nr
  }), n = e.createPipelineLayout({
    label: "globe-point-pipeline-layout",
    bindGroupLayouts: [o, i]
  });
  return { pipeline: e.createRenderPipeline({
    label: "globe-point-pipeline",
    layout: n,
    vertex: {
      module: a,
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 12,
          // vec3<f32>
          stepMode: "instance",
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: "float32x3"
            }
          ]
        }
      ]
    },
    fragment: {
      module: a,
      entryPoint: "fs_main",
      targets: [
        {
          format: t,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            }
          }
        }
      ]
    },
    primitive: {
      topology: "triangle-list"
    },
    depthStencil: {
      format: r.depthFormat ?? "depth24plus",
      depthWriteEnabled: !0,
      depthCompare: r.depthCompare ?? "less"
    },
    multisample: {
      count: r.sampleCount ?? E
    }
  }), materialBindGroupLayout: i };
}
const cr = (
  /* wgsl */
  `

// ─── Constants ───
${N}
${q}

// ─── Bindings ───

struct LineMaterial {
  color: vec4<f32>,
  width: f32,
  dashStyle: f32,
  dashAnimationSpeed: f32,
  time: f32,
  dashSegments0: vec4<f32>,
  dashSegments1: vec4<f32>,
  dashMeta: vec4<f32>,
};

@group(1) @binding(0) var<uniform> material: LineMaterial;

fn projectToClip(pos: vec3<f32>) -> vec4<f32> {
  let merc01 = epsg3857ToMerc01(pos);
  let angular = mercatorToAngular(merc01);
  let baseSphere = angularToSphere(angular.x, angular.y);
  let altFrac = altitudeOffset(pos.z);
  let spherePos = baseSphere * (1.0 + altFrac);

  var globeClip = camera.viewProjection * vec4<f32>(spherePos, 1.0);
  globeClip.z = globeClippingZ(baseSphere) * globeClip.w;

  if (camera.projectionTransition >= 0.999) {
    return globeClip;
  } else if (camera.projectionTransition <= 0.001) {
    return camera.flatViewProjection * vec4<f32>(merc01.x, merc01.y, altFrac, 1.0);
  }
  let flatClip = camera.flatViewProjection * vec4<f32>(merc01.x, merc01.y, altFrac, 1.0);
  return mix(flatClip, globeClip, camera.projectionTransition);
}

// ─── Vertex ───

struct VertexInput {
  @location(0) prevPos: vec3<f32>,
  @location(1) currPos: vec3<f32>,
  @location(2) nextPos: vec3<f32>,
  @location(3) side: f32,
  @location(4) cumulDist: f32,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) lineDistance: f32,
  @location(1) clipDot: f32,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  let clipCurr = projectToClip(input.currPos);
  let clipPrev = projectToClip(input.prevPos);
  let clipNext = projectToClip(input.nextPos);

  // Convert to screen space
  let screenCurr = clipCurr.xy / clipCurr.w * camera.viewport * 0.5;
  let screenPrev = clipPrev.xy / clipPrev.w * camera.viewport * 0.5;
  let screenNext = clipNext.xy / clipNext.w * camera.viewport * 0.5;

  // Direction vectors
  let dirPrev = normalize(screenCurr - screenPrev);
  let dirNext = normalize(screenNext - screenCurr);

  // Miter direction
  let normalPrev = vec2<f32>(-dirPrev.y, dirPrev.x);
  let normalNext = vec2<f32>(-dirNext.y, dirNext.x);

  var miter: vec2<f32>;
  let hasPrev = length(input.currPos - input.prevPos) > 0.0001;
  let hasNext = length(input.nextPos - input.currPos) > 0.0001;

  if (hasPrev && hasNext) {
    miter = normalize(normalPrev + normalNext);
    let miterLen = 1.0 / max(dot(miter, normalPrev), 0.1);
    miter = miter * min(miterLen, 3.0);
  } else if (hasPrev) {
    miter = normalPrev;
  } else {
    miter = normalNext;
  }

  let halfWidth = material.width * 0.5;
  let offset = miter * halfWidth * input.side;
  let screenPos = screenCurr + offset;
  let ndcPos = screenPos / (camera.viewport * 0.5);

  // Cumulative arc-length → screen-space via pixels-per-unit ratio
  let mercLen = length(input.currPos.xy - input.prevPos.xy);
  let screenLen = length(screenCurr - screenPrev);
  let ppu = select(1.0, screenLen / mercLen, mercLen > 0.0001);

  // Horizon dot for current position
  let merc01 = epsg3857ToMerc01(input.currPos);
  let angular = mercatorToAngular(merc01);
  let spherePos = angularToSphere(angular.x, angular.y);
  let clipDot = dot(spherePos, camera.clippingPlane.xyz) + camera.clippingPlane.w;

  var out: VertexOutput;
  // Shader-level depth offset: lines render in front of polygons
  const LAYER_DEPTH_OFFSET: f32 = 0.0005;
  let adjustedZ = clipCurr.z - LAYER_DEPTH_OFFSET * clipCurr.w;
  let clampedZ = min(adjustedZ, clipCurr.w * 0.9999);
  out.clipPosition = vec4<f32>(ndcPos * clipCurr.w, clampedZ, clipCurr.w);
  out.lineDistance = input.cumulDist * ppu;
  out.clipDot = clipDot;
  return out;
}

// ─── Fragment ───

fn getDashSegment(i: i32) -> f32 {
  if (i < 4) { return material.dashSegments0[i]; }
  return material.dashSegments1[i - 4];
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // Horizon discard
  if (camera.projectionTransition > 0.01 && input.clipDot < -0.01) {
    discard;
  }

  let dist = input.lineDistance + material.dashAnimationSpeed * material.time;

  // Custom dashArray takes priority
  let segCount = i32(material.dashMeta.x);
  if (segCount > 0) {
    let total = material.dashMeta.y;
    let d = ((dist % total) + total) % total;
    var cumul = 0.0;
    for (var i = 0; i < 8; i++) {
      if (i >= segCount) { break; }
      cumul += getDashSegment(i);
      if (d < cumul) {
        if (i % 2 == 1) { discard; }
        break;
      }
    }
    return material.color;
  }

  // Built-in dash patterns
  if (material.dashStyle > 0.5 && material.dashStyle < 1.5) {
    let pattern = dist % 16.0;
    if (pattern > 10.0) { discard; }
  } else if (material.dashStyle > 1.5 && material.dashStyle < 2.5) {
    let pattern = dist % 6.0;
    if (pattern > 3.0) { discard; }
  } else if (material.dashStyle > 2.5) {
    let pattern = dist % 21.0;
    if ((pattern > 10.0 && pattern < 14.0) || pattern > 17.0) { discard; }
  }

  return material.color;
}
`
);
function ur(r) {
  return r.createBindGroupLayout({
    label: "globe-line-material-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }
      }
    ]
  });
}
function pr(r) {
  const { device: e, colorFormat: t, globeCameraBindGroupLayout: o } = r, i = ur(e), a = e.createShaderModule({
    label: "globe-line-shader",
    code: cr
  }), n = e.createPipelineLayout({
    label: "globe-line-pipeline-layout",
    bindGroupLayouts: [o, i]
  });
  return { pipeline: e.createRenderPipeline({
    label: "globe-line-pipeline",
    layout: n,
    vertex: {
      module: a,
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 44,
          // 11 floats: prev(3) + curr(3) + next(3) + side(1) + cumulDist(1)
          stepMode: "vertex",
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: "float32x3"
            },
            {
              shaderLocation: 1,
              offset: 12,
              format: "float32x3"
            },
            {
              shaderLocation: 2,
              offset: 24,
              format: "float32x3"
            },
            {
              shaderLocation: 3,
              offset: 36,
              format: "float32"
            },
            {
              shaderLocation: 4,
              offset: 40,
              format: "float32"
            }
          ]
        }
      ]
    },
    fragment: {
      module: a,
      entryPoint: "fs_main",
      targets: [
        {
          format: t,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            }
          }
        }
      ]
    },
    primitive: {
      topology: "triangle-list"
    },
    depthStencil: {
      format: r.depthFormat ?? "depth24plus",
      depthWriteEnabled: !0,
      depthCompare: r.depthCompare ?? "less"
    },
    multisample: {
      count: r.sampleCount ?? E
    }
  }), materialBindGroupLayout: i };
}
const dr = (
  /* wgsl */
  `

// ─── Constants ───
${N}
${q}

// ─── Bindings ───

struct PolygonMaterial {
  color: vec4<f32>,
};

@group(1) @binding(0) var<uniform> material: PolygonMaterial;

// ─── Vertex ───

struct VertexInput {
  @location(0) position: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) clipDot: f32,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  let merc01 = epsg3857ToMerc01(input.position);
  let angular = mercatorToAngular(merc01);
  let baseSphere = angularToSphere(angular.x, angular.y);
  let altFrac = altitudeOffset(input.position.z);
  let spherePos = baseSphere * (1.0 + altFrac);

  // Globe clip space
  var globeClip = camera.viewProjection * vec4<f32>(spherePos, 1.0);
  globeClip.z = globeClippingZ(baseSphere) * globeClip.w;

  let clipDot = dot(baseSphere, camera.clippingPlane.xyz) + camera.clippingPlane.w;

  // Shader-level depth offset: polygons render in front of tiles
  const LAYER_DEPTH_OFFSET: f32 = 0.0003;
  var clipPos: vec4<f32>;
  if (camera.projectionTransition >= 0.999) {
    clipPos = globeClip;
  } else if (camera.projectionTransition <= 0.001) {
    clipPos = camera.flatViewProjection * vec4<f32>(merc01.x, merc01.y, altFrac, 1.0);
  } else {
    let flatClip = camera.flatViewProjection * vec4<f32>(merc01.x, merc01.y, altFrac, 1.0);
    clipPos = mix(flatClip, globeClip, camera.projectionTransition);
  }
  clipPos.z -= LAYER_DEPTH_OFFSET * clipPos.w;
  clipPos.z = min(clipPos.z, clipPos.w * 0.9999);

  var out: VertexOutput;
  out.clipPosition = clipPos;
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

  return material.color;
}
`
);
function fr(r) {
  return r.createBindGroupLayout({
    label: "globe-polygon-material-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }
      }
    ]
  });
}
function hr(r) {
  const { device: e, colorFormat: t, globeCameraBindGroupLayout: o } = r, i = fr(e), a = e.createShaderModule({
    label: "globe-polygon-shader",
    code: dr
  }), n = e.createPipelineLayout({
    label: "globe-polygon-pipeline-layout",
    bindGroupLayouts: [o, i]
  });
  return { pipeline: e.createRenderPipeline({
    label: "globe-polygon-pipeline",
    layout: n,
    vertex: {
      module: a,
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 12,
          // vec3<f32>
          stepMode: "vertex",
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: "float32x3"
            }
          ]
        }
      ]
    },
    fragment: {
      module: a,
      entryPoint: "fs_main",
      targets: [
        {
          format: t,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            }
          }
        }
      ]
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "none"
    },
    depthStencil: {
      format: r.depthFormat ?? "depth24plus",
      depthWriteEnabled: !1,
      depthCompare: r.depthCompare ?? "always"
    },
    multisample: {
      count: r.sampleCount ?? E
    }
  }), materialBindGroupLayout: i };
}
function mr(r, e = 32) {
  const t = e + 1, o = t * t, i = new Float32Array(o * 2);
  for (let d = 0; d < t; d++)
    for (let m = 0; m < t; m++) {
      const f = (d * t + m) * 2;
      i[f] = m / e, i[f + 1] = d / e;
    }
  const n = e * e * 6, l = o > 65535 ? new Uint32Array(n) : new Uint16Array(n);
  let c = 0;
  for (let d = 0; d < e; d++)
    for (let m = 0; m < e; m++) {
      const f = d * t + m, h = f + 1, x = (d + 1) * t + m, g = x + 1;
      l[c++] = f, l[c++] = x, l[c++] = h, l[c++] = h, l[c++] = x, l[c++] = g;
    }
  const p = r.createBuffer({
    label: "subdivision-vertex-buffer",
    size: i.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
  });
  r.queue.writeBuffer(p, 0, i);
  const u = r.createBuffer({
    label: "subdivision-index-buffer",
    size: l.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
  });
  return r.queue.writeBuffer(u, 0, l), {
    vertexBuffer: p,
    indexBuffer: u,
    indexCount: n,
    vertexCount: o,
    subdivisions: e
  };
}
const re = [0, 1, 1, 0.35], ie = [1, 1, 0.3, 0.92], oe = [1, 0.4, 0, 0.85], gr = 3, xr = 2;
function vr(r) {
  const e = r + 1, t = e * e, i = 2 * r * e * 2, n = t > 65535 ? new Uint32Array(i) : new Uint16Array(i);
  let s = 0;
  for (let l = 0; l < e; l++)
    for (let c = 0; c < r; c++)
      n[s++] = l * e + c, n[s++] = l * e + c + 1;
  for (let l = 0; l < e; l++)
    for (let c = 0; c < r; c++)
      n[s++] = c * e + l, n[s++] = (c + 1) * e + l;
  return { data: n, count: i };
}
function br(r, e = 32) {
  const t = mr(r, e), { data: o, count: i } = vr(e), a = r.createBuffer({
    label: "tile-debug-wireframe-index",
    size: o.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
  });
  return r.queue.writeBuffer(a, 0, o.buffer), {
    vertexBuffer: t.vertexBuffer,
    wireframeIndexBuffer: a,
    wireframeIndexCount: i,
    vertexCount: t.vertexCount,
    subdivisions: e
  };
}
function yr(r) {
  const e = new Float32Array([
    -1,
    -1,
    1,
    -1,
    -1,
    1,
    1,
    -1,
    1,
    1,
    -1,
    1
  ]), t = r.createBuffer({
    label: "tile-debug-quad",
    size: e.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
  });
  return r.queue.writeBuffer(t, 0, e), t;
}
const Ge = (
  /* wgsl */
  `
struct TileDebugUniforms {
  extent: vec4<f32>,
  gridColor: vec4<f32>,
  dotColor: vec4<f32>,
  borderColor: vec4<f32>,
  params: vec4<f32>,
  heightMode: vec4<f32>,
  terrainUv: vec4<f32>,
};
@group(1) @binding(0) var<uniform> tile: TileDebugUniforms;
`
), Me = (
  /* wgsl */
  `
@group(2) @binding(0) var heightMap: texture_2d<f32>;
@group(2) @binding(1) var heightSampler: sampler;

// Manual bilinear height sampling (r32float needs unfilterable-float)
fn sampleHeight(uv: vec2<f32>) -> f32 {
  let dims = vec2<f32>(textureDimensions(heightMap, 0));
  let tc = uv * max(dims - vec2(1.0), vec2(0.0));
  let tc0 = vec2<i32>(floor(tc));
  let f = fract(tc);
  let maxC = vec2<i32>(dims) - 1;
  let h00 = textureLoad(heightMap, clamp(tc0, vec2(0), maxC), 0).r;
  let h10 = textureLoad(heightMap, clamp(tc0 + vec2(1, 0), vec2(0), maxC), 0).r;
  let h01 = textureLoad(heightMap, clamp(tc0 + vec2(0, 1), vec2(0), maxC), 0).r;
  let h11 = textureLoad(heightMap, clamp(tc0 + vec2(1, 1), vec2(0), maxC), 0).r;
  return mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y);
}
`
), _e = (
  /* wgsl */
  `
const EARTH_RADIUS_METERS: f32 = 6378137.0;

fn terrainUvForTileUv(tileUv: vec2<f32>) -> vec2<f32> {
  return tile.terrainUv.xy + tileUv * tile.terrainUv.zw;
}

fn heightAtUV(uv: vec2<f32>) -> f32 {
  if (tile.heightMode.x >= 0.5) {
    return sampleHeight(terrainUvForTileUv(uv)) / EARTH_RADIUS_METERS;
  }
  return sampleHeight(vec2<f32>(
    mix(tile.extent.x, tile.extent.z, uv.x),
    mix(tile.extent.y, tile.extent.w, uv.y)
  ));
}
`
);
function Fe(r) {
  return r ? (
    /* wgsl */
    `
const PI: f32 = 3.14159265358979323846;
const TWO_PI: f32 = 6.28318530717958647692;
struct GlobeCameraUniforms {
  viewProjection: mat4x4<f32>,
  flatViewProjection: mat4x4<f32>,
  viewport: vec2<f32>,
  projectionTransition: f32,
  globeRadius: f32,
  clippingPlane: vec4<f32>,
};
@group(0) @binding(0) var<uniform> camera: GlobeCameraUniforms;
fn mercatorToAngular(merc: vec2<f32>) -> vec2<f32> {
  let lon = merc.x * TWO_PI - PI;
  let lat = atan(exp(PI - merc.y * TWO_PI)) * 2.0 - PI * 0.5;
  return vec2<f32>(lon, lat);
}
fn angularToSphere(lon: f32, lat: f32) -> vec3<f32> {
  let cosLat = cos(lat);
  return vec3<f32>(cosLat * sin(lon), sin(lat), cosLat * cos(lon));
}
fn globeClippingZ(spherePos: vec3<f32>) -> f32 {
  return 1.0 - (dot(spherePos, camera.clippingPlane.xyz) + camera.clippingPlane.w);
}
`
  ) : (
    /* wgsl */
    `
struct CameraUniforms {
  viewProjection: mat4x4<f32>,
  viewport: vec2<f32>,
};
@group(0) @binding(0) var<uniform> camera: CameraUniforms;
`
  );
}
function Re(r) {
  return r ? (
    /* wgsl */
    `
struct ProjResult {
  clipPos: vec4<f32>,
  clipDot: f32,
};
fn projectUV(uv: vec2<f32>, height: f32) -> ProjResult {
  let mx = mix(tile.extent.x, tile.extent.z, uv.x);
  let my = mix(tile.extent.y, tile.extent.w, uv.y);
  let ang = mercatorToAngular(vec2<f32>(mx, my));
  let sp_base = angularToSphere(ang.x, ang.y);
  let exag = tile.params.z;
  let sp = sp_base * (1.0 + height * exag);
  var gc = camera.viewProjection * vec4<f32>(sp, 1.0);
  gc.z = globeClippingZ(sp_base) * gc.w;
  let cd = dot(sp_base, camera.clippingPlane.xyz) + camera.clippingPlane.w;
  var cp: vec4<f32>;
  if (camera.projectionTransition >= 0.999) { cp = gc; }
  else if (camera.projectionTransition <= 0.001) {
    var fc = camera.flatViewProjection * vec4<f32>(mx, my, height * exag, 1.0);
    cp = fc;
  } else {
    var fc = camera.flatViewProjection * vec4<f32>(mx, my, height * exag, 1.0);
    cp = mix(fc, gc, camera.projectionTransition);
  }
  cp.z -= 0.0005 * cp.w;
  cp.z = min(cp.z, cp.w * 0.9999);
  var r: ProjResult;
  r.clipPos = cp;
  r.clipDot = cd;
  return r;
}
`
  ) : (
    /* wgsl */
    `
struct ProjResult {
  clipPos: vec4<f32>,
  clipDot: f32,
};
fn projectUV(uv: vec2<f32>, height: f32) -> ProjResult {
  let wx = mix(tile.extent.x, tile.extent.z, uv.x);
  let wy = mix(tile.extent.y, tile.extent.w, uv.y);
  let exag = tile.params.z;
  var r: ProjResult;
  r.clipPos = camera.viewProjection * vec4<f32>(wx, wy, 0.0, 0.0) + vec4<f32>(0.0, 0.0, 0.0, 1.0);
  r.clipPos.y += height * exag * r.clipPos.w;
  r.clipDot = 1.0;
  return r;
}
`
  );
}
function Ee(r) {
  return r ? (
    /* wgsl */
    `
  if (camera.projectionTransition > 0.01 && input.clipDot < -0.01) { discard; }
`
  ) : "";
}
function Pr(r) {
  return Fe(r) + Ge + Me + Re(r) + _e + /* wgsl */
  `
struct VOut { @builtin(position) position: vec4<f32>, @location(0) clipDot: f32 };

@vertex fn vs_main(@builtin(vertex_index) vid: u32, @location(0) uv: vec2<f32>) -> VOut {
  let h = heightAtUV(uv);
  let p = projectUV(uv, h);
  var o: VOut;
  o.position = p.clipPos;
  o.clipDot = p.clipDot;
  return o;
}
@fragment fn fs_main(input: VOut) -> @location(0) vec4<f32> {
  ${Ee(r)}
  return tile.gridColor;
}
`;
}
function Cr(r) {
  return Fe(r) + Ge + Me + Re(r) + _e + /* wgsl */
  `
struct VOut {
  @builtin(position) position: vec4<f32>,
  @location(0) clipDot: f32,
  @location(1) local: vec2<f32>,
};

@vertex fn vs_main(
  @location(0) corner: vec2<f32>,
  @location(1) instUV: vec2<f32>,
  @builtin(instance_index) iid: u32,
) -> VOut {
  let h = heightAtUV(instUV);
  let p = projectUV(instUV, h);
  var cp = p.clipPos;
  let sz = tile.params.x;
  cp.x += corner.x * sz * 2.0 / camera.viewport.x * cp.w;
  cp.y -= corner.y * sz * 2.0 / camera.viewport.y * cp.w;
  var o: VOut;
  o.position = cp;
  o.clipDot = p.clipDot;
  o.local = corner;
  return o;
}
@fragment fn fs_main(input: VOut) -> @location(0) vec4<f32> {
  ${Ee(r)}
  if (length(input.local) > 1.0) { discard; }
  return tile.dotColor;
}
`;
}
function wr(r) {
  return Fe(r) + Ge + Me + Re(r) + _e + /* wgsl */
  `
struct VOut { @builtin(position) position: vec4<f32>, @location(0) clipDot: f32 };

@vertex fn vs_main(@builtin(vertex_index) vid: u32) -> VOut {
  // 4 edges: bottom, right, top, left
  var su = array<f32,4>(0.0, 1.0, 1.0, 0.0);
  var sv = array<f32,4>(0.0, 0.0, 1.0, 1.0);
  var eu = array<f32,4>(1.0, 1.0, 0.0, 0.0);
  var ev = array<f32,4>(0.0, 1.0, 1.0, 0.0);

  let edge = vid / 6u;
  let vi = vid % 6u;

  // t: 0=start, 1=end. side: -1 or +1
  var ts = array<f32,6>(0.0, 1.0, 0.0, 1.0, 1.0, 0.0);
  var si = array<f32,6>(-1.0, -1.0, 1.0, -1.0, 1.0, 1.0);
  let t = ts[vi];
  let side = si[vi];

  let startUV = vec2<f32>(su[edge], sv[edge]);
  let endUV   = vec2<f32>(eu[edge], ev[edge]);
  let uv = mix(startUV, endUV, t);

  let h     = heightAtUV(uv);
  let hS    = heightAtUV(startUV);
  let hE    = heightAtUV(endUV);
  let p     = projectUV(uv, h);
  let pStart = projectUV(startUV, hS);
  let pEnd   = projectUV(endUV, hE);

  // Screen-space edge direction → perpendicular
  let s0 = pStart.clipPos.xy / pStart.clipPos.w;
  let s1 = pEnd.clipPos.xy / pEnd.clipPos.w;
  let edgeDir = normalize(s1 - s0);
  let normal = vec2<f32>(-edgeDir.y, edgeDir.x);

  let hw = tile.params.y; // half-width in pixels
  let offset = normal * side * hw * 2.0 / camera.viewport;

  var cp = p.clipPos;
  cp.x += offset.x * cp.w;
  cp.y += offset.y * cp.w;

  var o: VOut;
  o.position = cp;
  o.clipDot = p.clipDot;
  return o;
}
@fragment fn fs_main(input: VOut) -> @location(0) vec4<f32> {
  ${Ee(r)}
  return tile.borderColor;
}
`;
}
function Sr(r) {
  return r.createBindGroupLayout({
    label: "tile-debug-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }
      }
    ]
  });
}
function Tr(r) {
  return r.createBindGroupLayout({
    label: "tile-debug-height-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        texture: { sampleType: "unfilterable-float" }
      },
      {
        binding: 1,
        visibility: GPUShaderStage.VERTEX,
        sampler: { type: "non-filtering" }
      }
    ]
  });
}
const Br = {
  color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
  alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" }
};
function Oe(r) {
  const { device: e, colorFormat: t, cameraBindGroupLayout: o } = r, i = r.globe ?? !1, a = Sr(e), n = Tr(e), s = e.createSampler({
    label: "tile-debug-height-sampler",
    magFilter: "nearest",
    minFilter: "nearest",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge"
  }), l = e.createPipelineLayout({
    label: `tile-debug-${i ? "globe" : "2d"}-layout`,
    bindGroupLayouts: [o, a, n]
  }), c = {
    format: r.depthFormat ?? "depth24plus",
    depthWriteEnabled: !1,
    depthCompare: i ? r.depthCompare ?? "less" : "always"
  }, p = { format: t, blend: Br }, u = { count: r.sampleCount ?? E }, d = e.createShaderModule({ label: "dbg-wireframe", code: Pr(i) }), m = e.createRenderPipeline({
    label: "dbg-wireframe",
    layout: l,
    vertex: {
      module: d,
      entryPoint: "vs_main",
      buffers: [{ arrayStride: 8, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }] }]
    },
    fragment: { module: d, entryPoint: "fs_main", targets: [p] },
    primitive: { topology: "line-list" },
    depthStencil: c,
    multisample: u
  }), f = e.createShaderModule({ label: "dbg-dot", code: Cr(i) }), h = e.createRenderPipeline({
    label: "dbg-dot",
    layout: l,
    vertex: {
      module: f,
      entryPoint: "vs_main",
      buffers: [
        { arrayStride: 8, stepMode: "vertex", attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }] },
        { arrayStride: 8, stepMode: "instance", attributes: [{ shaderLocation: 1, offset: 0, format: "float32x2" }] }
      ]
    },
    fragment: { module: f, entryPoint: "fs_main", targets: [p] },
    primitive: { topology: "triangle-list" },
    depthStencil: c,
    multisample: u
  }), x = e.createShaderModule({ label: "dbg-border", code: wr(i) }), g = e.createRenderPipeline({
    label: "dbg-border",
    layout: l,
    vertex: { module: x, entryPoint: "vs_main", buffers: [] },
    fragment: { module: x, entryPoint: "fs_main", targets: [p] },
    primitive: { topology: "triangle-list" },
    depthStencil: c,
    multisample: u
  }), b = br(e, 32), v = yr(e), { texture: P, bindGroup: C } = it(e, n);
  return {
    wireframePipeline: m,
    dotPipeline: h,
    borderPipeline: g,
    bindGroupLayout: a,
    heightBindGroupLayout: n,
    heightSampler: s,
    mesh: b,
    quadBuffer: v,
    zeroHeightTexture: P,
    zeroHeightBindGroup: C
  };
}
const ct = Math.atan(Math.sinh(Math.PI)), ae = Math.cos(ct), Ie = Math.sin(ct), Gr = (
  /* wgsl */
  `

// ─── Constants ───

const PI: f32 = 3.14159265358979323846;

// ─── Bindings ───
${te}

struct PoleCapUniforms {
  color: vec4<f32>,
};

@group(1) @binding(0) var<uniform> poleCap: PoleCapUniforms;

// ─── Vertex ───

struct VertexInput {
  @location(0) position: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) clipDot: f32,
};

fn globeClippingZ(spherePos: vec3<f32>) -> f32 {
  return 1.0 - (dot(spherePos, camera.clippingPlane.xyz) + camera.clippingPlane.w);
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var globeClip = camera.viewProjection * vec4<f32>(input.position, 1.0);
  globeClip.z = globeClippingZ(input.position) * globeClip.w;

  let clipDot = dot(input.position, camera.clippingPlane.xyz) + camera.clippingPlane.w;

  var out: VertexOutput;
  out.position = globeClip;
  out.clipDot = clipDot;
  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  if (input.clipDot < -0.01) {
    discard;
  }
  return poleCap.color;
}
`
);
function Mr(r, e = 64) {
  const t = 2 * (e + 1), o = new Float32Array(t * 3);
  o[0] = 0, o[1] = 1, o[2] = 0;
  for (let u = 0; u < e; u++) {
    const d = u / e * 2 * Math.PI, m = (1 + u) * 3;
    o[m] = ae * Math.sin(d), o[m + 1] = Ie, o[m + 2] = ae * Math.cos(d);
  }
  const i = e + 1, a = i * 3;
  o[a] = 0, o[a + 1] = -1, o[a + 2] = 0;
  for (let u = 0; u < e; u++) {
    const d = u / e * 2 * Math.PI, m = (i + 1 + u) * 3;
    o[m] = ae * Math.sin(d), o[m + 1] = -Ie, o[m + 2] = ae * Math.cos(d);
  }
  const n = 2 * e * 3, s = new Uint16Array(n);
  let l = 0;
  for (let u = 0; u < e; u++)
    s[l++] = 0, s[l++] = 1 + u, s[l++] = 1 + (u + 1) % e;
  for (let u = 0; u < e; u++)
    s[l++] = i, s[l++] = i + 1 + (u + 1) % e, s[l++] = i + 1 + u;
  const c = r.createBuffer({
    label: "pole-cap-vertex-buffer",
    size: o.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
  });
  r.queue.writeBuffer(c, 0, o);
  const p = r.createBuffer({
    label: "pole-cap-index-buffer",
    size: s.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
  });
  return r.queue.writeBuffer(p, 0, s), { vertexBuffer: c, indexBuffer: p, indexCount: n, vertexCount: t };
}
function _r(r) {
  return r.createBindGroupLayout({
    label: "pole-cap-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }
      }
    ]
  });
}
function Fr(r) {
  const { device: e, colorFormat: t, globeCameraBindGroupLayout: o } = r, i = r.segments ?? 64, a = _r(e), n = e.createShaderModule({
    label: "pole-cap-shader",
    code: Gr
  }), s = e.createPipelineLayout({
    label: "pole-cap-pipeline-layout",
    bindGroupLayouts: [o, a]
  }), l = Mr(e, i);
  return { pipeline: e.createRenderPipeline({
    label: "pole-cap-pipeline",
    layout: s,
    vertex: {
      module: n,
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 12,
          // vec3<f32>
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: "float32x3"
            }
          ]
        }
      ]
    },
    fragment: {
      module: n,
      entryPoint: "fs_main",
      targets: [
        {
          format: t,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            }
          }
        }
      ]
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "none"
    },
    depthStencil: {
      format: r.depthFormat ?? "depth24plus",
      depthWriteEnabled: !0,
      depthCompare: r.depthCompare ?? "less"
    },
    multisample: {
      count: r.sampleCount ?? E
    }
  }), poleCapBindGroupLayout: a, mesh: l };
}
const Rr = 1.15, Er = (
  /* wgsl */
  `

// ─── Constants ───

const PI: f32 = 3.14159265358979323846;

// ─── Bindings ───
${te}

struct AtmosphereUniforms {
  colorInner: vec4<f32>,
  colorOuter: vec4<f32>,
  strength: f32,
  falloff: f32,
  _pad0: f32,
  _pad1: f32,
};

@group(1) @binding(0) var<uniform> atmosphere: AtmosphereUniforms;

// ─── Vertex ───

struct VertexInput {
  @location(0) position: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) worldPos: vec3<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.clipPosition = camera.viewProjection * vec4<f32>(input.position, 1.0);
  out.worldPos = input.position;
  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // Normalize worldPos to project onto true sphere surface.
  // Linear interpolation between mesh vertices creates chords;
  // normalizing gives the exact spherical direction per-fragment.
  let sphereDir = normalize(input.worldPos);

  // Compute clipDot per-fragment (not interpolated) for smooth horizon
  let clipDot = dot(sphereDir, camera.clippingPlane.xyz) + camera.clippingPlane.w;

  // Discard back hemisphere
  if (clipDot < -0.15) {
    discard;
  }

  // Fresnel-like edge glow: view direction vs sphere normal
  let cameraDir = normalize(camera.clippingPlane.xyz);
  let facing = abs(dot(sphereDir, cameraDir));
  let edgeFactor = 1.0 - facing;

  // Glow intensity with configurable falloff
  let intensity = pow(edgeFactor, atmosphere.falloff);

  // Boost and clamp
  let boosted = clamp(intensity * 2.0, 0.0, 1.0);

  // Color gradient: inner (near globe edge) → outer (limb)
  let color = mix(atmosphere.colorInner, atmosphere.colorOuter, edgeFactor);

  // Final alpha: glow × strength × projectionTransition
  let alpha = boosted * atmosphere.strength * camera.projectionTransition;

  // Smooth horizon fade (per-fragment, not interpolated → no polygon edges)
  let horizonFade = smoothstep(-0.15, 0.05, clipDot);
  let finalAlpha = alpha * horizonFade;

  if (finalAlpha < 0.002) {
    discard;
  }

  return vec4<f32>(color.rgb, finalAlpha);
}
`
);
function Lr(r, e = 4) {
  const t = Rr;
  let o = [
    0,
    t,
    0,
    0,
    -t,
    0,
    t,
    0,
    0,
    -t,
    0,
    0,
    0,
    0,
    t,
    0,
    0,
    -t
  ], i = [
    0,
    4,
    2,
    0,
    2,
    5,
    0,
    5,
    3,
    0,
    3,
    4,
    1,
    2,
    4,
    1,
    5,
    2,
    1,
    3,
    5,
    1,
    4,
    3
  ];
  const a = /* @__PURE__ */ new Map();
  function n(u, d) {
    const m = u < d ? `${u}_${d}` : `${d}_${u}`, f = a.get(m);
    if (f !== void 0) return f;
    const h = o[u * 3], x = o[u * 3 + 1], g = o[u * 3 + 2], b = o[d * 3], v = o[d * 3 + 1], P = o[d * 3 + 2];
    let C = (h + b) * 0.5, S = (x + v) * 0.5, R = (g + P) * 0.5;
    const y = Math.sqrt(C * C + S * S + R * R);
    C = C / y * t, S = S / y * t, R = R / y * t;
    const w = o.length / 3;
    return o.push(C, S, R), a.set(m, w), w;
  }
  for (let u = 0; u < e; u++) {
    const d = [];
    a.clear();
    for (let m = 0; m < i.length; m += 3) {
      const f = i[m], h = i[m + 1], x = i[m + 2], g = n(f, h), b = n(h, x), v = n(x, f);
      d.push(f, g, v, h, b, g, x, v, b, g, b, v);
    }
    i = d;
  }
  const s = new Float32Array(o), l = o.length / 3 > 65535 ? new Uint32Array(i) : new Uint16Array(i), c = r.createBuffer({
    label: "atmosphere-vertex-buffer",
    size: s.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
  });
  r.queue.writeBuffer(c, 0, s);
  const p = r.createBuffer({
    label: "atmosphere-index-buffer",
    size: l.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
  });
  return r.queue.writeBuffer(p, 0, l), {
    vertexBuffer: c,
    indexBuffer: p,
    indexCount: i.length,
    vertexCount: o.length / 3
  };
}
function Dr(r) {
  return r.createBindGroupLayout({
    label: "atmosphere-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }
      }
    ]
  });
}
function Ar(r) {
  const { device: e, colorFormat: t, globeCameraBindGroupLayout: o } = r, i = Dr(e), a = e.createShaderModule({
    label: "atmosphere-shader",
    code: Er
  }), n = e.createPipelineLayout({
    label: "atmosphere-pipeline-layout",
    bindGroupLayouts: [o, i]
  }), s = Lr(e, r.subdivisions ?? 4);
  return { pipeline: e.createRenderPipeline({
    label: "atmosphere-pipeline",
    layout: n,
    vertex: {
      module: a,
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 12,
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: "float32x3"
            }
          ]
        }
      ]
    },
    fragment: {
      module: a,
      entryPoint: "fs_main",
      targets: [
        {
          format: t,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            }
          }
        }
      ]
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "front"
      // Render inner faces — camera is outside
    },
    depthStencil: {
      format: r.depthFormat ?? "depth24plus",
      depthWriteEnabled: !1,
      depthCompare: "always"
    },
    multisample: {
      count: r.sampleCount ?? E
    }
  }), atmosphereBindGroupLayout: i, mesh: s };
}
const Ur = 52, zr = 4, Vr = (
  /* wgsl */
  `
${te}

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
`
);
function Or(r) {
  return r.createBindGroupLayout({
    label: "sky-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }
      }
    ]
  });
}
function Ir(r) {
  const { device: e, colorFormat: t, globeCameraBindGroupLayout: o } = r, i = Or(e), a = e.createShaderModule({
    label: "sky-shader",
    code: Vr
  }), n = e.createPipelineLayout({
    label: "sky-pipeline-layout",
    bindGroupLayouts: [o, i]
  });
  return { pipeline: e.createRenderPipeline({
    label: "sky-pipeline",
    layout: n,
    vertex: {
      module: a,
      entryPoint: "vs_main"
    },
    fragment: {
      module: a,
      entryPoint: "fs_main",
      targets: [
        {
          format: t
        }
      ]
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "none"
    },
    multisample: {
      count: r.sampleCount ?? E
    }
  }), skyBindGroupLayout: i };
}
const Nr = (
  /* wgsl */
  `

// ─── Bindings ───
${z}

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
  // Per-instance: point center position (x, y, z)
  @location(0) position: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

// Billboard quad: 6 vertices (2 triangles) per point instance
@vertex
fn vs_main(
  input: VertexInput,
  @builtin(vertex_index) vid: u32,
) -> VertexOutput {
  // Quad corners: 2 triangles (0,1,2) and (2,1,3)
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

  // Project center to clip space
  let clipCenter = camera.viewProjection * vec4<f32>(input.position.xy, 0.0, 1.0);

  // Billboard: expand quad for background circle if present
  var pixelSize = material.size;
  if (material.bgRadius > 0.0) {
    pixelSize = max(material.size, material.bgRadius * 2.0 + material.outlineWidth * 2.0);
  }
  let screenOffset = rotatedOffset * pixelSize;
  let ndcOffset = vec2<f32>(
    screenOffset.x * 2.0 / camera.viewport.x,
    screenOffset.y * 2.0 / camera.viewport.y,
  );

  var out: VertexOutput;
  out.clipPosition = vec4<f32>(
    clipCenter.x + ndcOffset.x * clipCenter.w,
    clipCenter.y + ndcOffset.y * clipCenter.w,
    clipCenter.z,
    clipCenter.w,
  );
  out.uv = uv;
  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
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

  // Outside everything: discard
  if (pixelDist > outerEdge + aa) { discard; }

  // Outline ring (anti-aliased)
  if (pixelDist > material.bgRadius) {
    let outerAlpha = 1.0 - smoothstep(outerEdge - aa, outerEdge + aa, pixelDist);
    return vec4<f32>(material.outlineColor.rgb, material.outlineColor.a * outerAlpha);
  }

  // Background fill
  var result = material.bgColor;

  // Blend icon over background (only within icon bounds)
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
`
);
function kr(r) {
  return r.createBindGroupLayout({
    label: "icon-material-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: "filtering" }
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: "float" }
      }
    ]
  });
}
function Hr(r) {
  const { device: e, colorFormat: t, cameraBindGroupLayout: o } = r, i = kr(e), a = e.createShaderModule({
    label: "icon-shader",
    code: Nr
  }), n = e.createPipelineLayout({
    label: "icon-pipeline-layout",
    bindGroupLayouts: [o, i]
  }), s = e.createRenderPipeline({
    label: "icon-pipeline",
    layout: n,
    vertex: {
      module: a,
      entryPoint: "vs_main",
      buffers: [
        {
          // Per-instance vertex buffer: vec3<f32> position
          arrayStride: 12,
          // 3 * 4 bytes
          stepMode: "instance",
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: "float32x3"
            }
          ]
        }
      ]
    },
    fragment: {
      module: a,
      entryPoint: "fs_main",
      targets: [
        {
          format: t,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            }
          }
        }
      ]
    },
    primitive: {
      topology: "triangle-list"
    },
    depthStencil: {
      format: r.depthFormat ?? "depth24plus",
      depthWriteEnabled: !0,
      depthCompare: r.depthCompare ?? "less"
    },
    multisample: {
      count: r.sampleCount ?? E
    }
  }), l = e.createSampler({
    label: "icon-atlas-sampler",
    magFilter: "linear",
    minFilter: "linear",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge"
  });
  return { pipeline: s, materialBindGroupLayout: i, sampler: l };
}
const Wr = (
  /* wgsl */
  `

// ─── Constants ───
${N}
${q}

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

  // Globe clip space
  var globeClip = camera.viewProjection * vec4<f32>(spherePos, 1.0);
  globeClip.z = globeClippingZ(baseSphere) * globeClip.w;

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

  // Shader-level depth offset: icons render in front of lines
  const LAYER_DEPTH_OFFSET: f32 = 0.0008;
  let adjustedZ = clipCenter.z - LAYER_DEPTH_OFFSET * clipCenter.w;
  let clampedZ = min(adjustedZ, clipCenter.w * 0.9999);

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
`
);
function jr(r) {
  return r.createBindGroupLayout({
    label: "globe-icon-material-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: "filtering" }
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: "float" }
      }
    ]
  });
}
function Xr(r) {
  const { device: e, colorFormat: t, globeCameraBindGroupLayout: o } = r, i = jr(e), a = e.createShaderModule({
    label: "globe-icon-shader",
    code: Wr
  }), n = e.createPipelineLayout({
    label: "globe-icon-pipeline-layout",
    bindGroupLayouts: [o, i]
  }), s = e.createRenderPipeline({
    label: "globe-icon-pipeline",
    layout: n,
    vertex: {
      module: a,
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 12,
          // vec3<f32>
          stepMode: "instance",
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: "float32x3"
            }
          ]
        }
      ]
    },
    fragment: {
      module: a,
      entryPoint: "fs_main",
      targets: [
        {
          format: t,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            }
          }
        }
      ]
    },
    primitive: {
      topology: "triangle-list"
    },
    depthStencil: {
      format: r.depthFormat ?? "depth24plus",
      depthWriteEnabled: !0,
      depthCompare: r.depthCompare ?? "less"
    },
    multisample: {
      count: r.sampleCount ?? E
    }
  }), l = e.createSampler({
    label: "globe-icon-atlas-sampler",
    magFilter: "linear",
    minFilter: "linear",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge"
  });
  return { pipeline: s, materialBindGroupLayout: i, sampler: l };
}
const $r = z + `
`, Yr = (
  /* wgsl */
  `
struct FrameUniforms {
  time: f32,
  deltaTime: f32,
  frameNumber: f32,
  opacity: f32,
};
@group(1) @binding(0) var<uniform> frame: FrameUniforms;
`
), Zr = (
  /* wgsl */
  `
@group(2) @binding(0) var<uniform> custom: CustomUniforms;
`
), qr = (
  /* wgsl */
  `
@group(3) @binding(0) var texSampler: sampler;
@group(3) @binding(1) var texInput: texture_2d<f32>;
`
), Kr = (
  /* wgsl */
  `
fn projectMercator(pos: vec2<f32>) -> vec4<f32> {
  return camera.viewProjection * vec4<f32>(pos, 0.0, 1.0);
}
`
);
function go(r, e, t) {
  if (t.rawMode)
    return r + `
` + e;
  let o = $r + Yr;
  return t.hasCustomUniforms && (o += Zr), t.hasTexture && (o += qr), o += Kr, o + `
` + r + `
` + e;
}
function Qr(r) {
  const { device: e, colorFormat: t, depthFormat: o, cameraBindGroupLayout: i } = r, a = e.createBindGroupLayout({
    label: "custom-frame-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }
      }
    ]
  });
  let n = null;
  r.hasCustomUniforms && (n = e.createBindGroupLayout({
    label: "custom-user-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }
      }
    ]
  }));
  let s = null;
  r.hasTexture && (s = e.createBindGroupLayout({
    label: "custom-texture-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: "filtering" }
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: "float" }
      }
    ]
  }));
  const l = [
    i,
    // @group(0)
    a
    // @group(1)
  ];
  if (n && l.push(n), s) {
    if (!n) {
      const f = e.createBindGroupLayout({
        label: "custom-empty-bind-group-layout",
        entries: []
      });
      l.push(f);
    }
    l.push(s);
  }
  const c = e.createPipelineLayout({
    label: "custom-pipeline-layout",
    bindGroupLayouts: l
  }), p = r.vertexBufferLayouts.map((f) => ({
    arrayStride: f.arrayStride,
    stepMode: f.stepMode ?? "vertex",
    attributes: f.attributes.map((h) => ({
      shaderLocation: h.shaderLocation,
      offset: h.offset,
      format: h.format
    }))
  })), u = e.createShaderModule({
    label: "custom-shader-module",
    code: r.shaderSource
  }), d = r.blendState ?? {
    color: {
      srcFactor: "src-alpha",
      dstFactor: "one-minus-src-alpha",
      operation: "add"
    },
    alpha: {
      srcFactor: "one",
      dstFactor: "one-minus-src-alpha",
      operation: "add"
    }
  };
  return console.log("[CP5-DESC]", { topology: r.topology, colorFormat: t, depthFormat: o }), console.log("[CP5-BLEND]", JSON.stringify(d)), console.log("[CP5-DEPTH]", { depthWriteEnabled: !1, depthCompare: "always" }), console.log("[CP5-VB]", p.map((f) => ({
    arrayStride: f.arrayStride,
    attrCount: Array.from(f.attributes).length
  }))), console.log("[CP5-BGL]", {
    groupCount: l.length,
    groups: l.map((f, h) => `@group(${h})`)
  }), {
    pipeline: e.createRenderPipeline({
      label: "custom-render-pipeline",
      layout: c,
      vertex: {
        module: u,
        entryPoint: "vs_main",
        buffers: p
      },
      fragment: {
        module: u,
        entryPoint: "fs_main",
        targets: [
          {
            format: t,
            blend: d
          }
        ]
      },
      primitive: {
        topology: r.topology
      },
      depthStencil: {
        format: o,
        depthWriteEnabled: !1,
        depthCompare: "always"
      },
      multisample: {
        count: r.sampleCount ?? E
      }
    }),
    frameBindGroupLayout: a,
    customBindGroupLayout: n,
    textureBindGroupLayout: s
  };
}
const Jr = (
  /* wgsl */
  `
// ─── Bindings ───
${z}

struct ModelMaterial {
  baseColorFactor: vec4<f32>,       // 0-15
  tintColor: vec4<f32>,             // 16-31
  emissiveFactor: vec3<f32>,        // 32-43
  metallic: f32,                    // 44-47
  roughness: f32,                   // 48-51
  hasBaseColorTex: f32,             // 52-55
  hasNormalTex: f32,                // 56-59
  hasMetallicRoughnessTex: f32,     // 60-63
  hasOcclusionTex: f32,             // 64-67
  hasEmissiveTex: f32,              // 68-71
  alphaCutoff: f32,                 // 72-75
  isUnlit: f32,                     // 76-79
};

@group(1) @binding(0) var<uniform> material: ModelMaterial;
@group(1) @binding(1) var texSampler: sampler;
@group(1) @binding(2) var baseColorTex: texture_2d<f32>;
@group(1) @binding(3) var normalTex: texture_2d<f32>;
@group(1) @binding(4) var metallicRoughnessTex: texture_2d<f32>;
@group(1) @binding(5) var occlusionTex: texture_2d<f32>;
@group(1) @binding(6) var emissiveTex: texture_2d<f32>;

// ─── Vertex Input ───

struct VertexInput {
  // Per-vertex (slot 0)
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) texcoord: vec2<f32>,
  // Per-instance (slot 1)
  @location(3) worldPos: vec3<f32>,
  @location(4) scaleHeading: vec2<f32>,   // scale, heading
  @location(5) pitchRollAnchor: vec3<f32>, // pitch, roll, anchorZ
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) vNormal: vec3<f32>,
  @location(1) vTexcoord: vec2<f32>,
  @location(2) vWorldPos: vec3<f32>,
};

// ─── Rotation Matrix from Euler angles (heading/pitch/roll in degrees) ───

fn degreesToRadians(deg: f32) -> f32 {
  return deg * 3.14159265358979 / 180.0;
}

fn eulerToRotationMatrix(heading: f32, pitch: f32, roll: f32) -> mat3x3<f32> {
  let h = degreesToRadians(heading);
  let p = degreesToRadians(pitch);
  let r = degreesToRadians(roll);

  let ch = cos(h); let sh = sin(h);
  let cp = cos(p); let sp = sin(p);
  let cr = cos(r); let sr = sin(r);

  // ZYX rotation order: heading(Z) * pitch(Y) * roll(X)
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

  let rotMat = eulerToRotationMatrix(heading, pitch, roll);
  let mercatorScale = mercatorMetersPerMeter(input.worldPos.y);
  let rotated = rotMat * (input.position * (scale * mercatorScale));

  // 2D orthographic mode clips positive world-space Z. Keep the model anchored
  // to the ground plane for projection, then map altitude + local height into
  // clip-space depth so elevated models remain visible.
  let projectedWorldPos = vec3<f32>(input.worldPos.x + rotated.x, input.worldPos.y + rotated.y, 0.0);
  let heightMeters = input.worldPos.z + anchorZ + rotated.z / max(mercatorScale, 0.01);
  let worldPos = vec3<f32>(projectedWorldPos.x, projectedWorldPos.y, heightMeters);

  output.clipPosition = camera.viewProjection * vec4<f32>(projectedWorldPos, 1.0);
  let absH = abs(heightMeters);
  let logH = log2(max(absH, 0.1) + 1.0);
  let logMax = log2(1001.0);
  let normalizedZ = clamp(0.5 - logH / (2.0 * logMax), 0.01, 0.99);
  output.clipPosition.z = max(0.0, normalizedZ - 0.001) * output.clipPosition.w;

  output.vNormal = normalize(rotMat * input.normal);
  output.vTexcoord = input.texcoord;
  output.vWorldPos = worldPos;

  return output;
}

// ─── PBR Helpers ───

const PI: f32 = 3.14159265358979;
const EARTH_RADIUS_M: f32 = 6378137.0;

// GGX/Trowbridge-Reitz Normal Distribution Function
fn distributionGGX(NdotH: f32, roughness: f32) -> f32 {
  let a = roughness * roughness;
  let a2 = a * a;
  let d = NdotH * NdotH * (a2 - 1.0) + 1.0;
  return a2 / (PI * d * d + 0.0001);
}

// Schlick-GGX Geometry function
fn geometrySchlickGGX(NdotV: f32, roughness: f32) -> f32 {
  let r = roughness + 1.0;
  let k = (r * r) / 8.0;
  return NdotV / (NdotV * (1.0 - k) + k);
}

// Smith's method for combined geometry obstruction
fn geometrySmith(NdotV: f32, NdotL: f32, roughness: f32) -> f32 {
  return geometrySchlickGGX(NdotV, roughness) * geometrySchlickGGX(NdotL, roughness);
}

// Schlick Fresnel approximation
fn fresnelSchlick(cosTheta: f32, F0: vec3<f32>) -> vec3<f32> {
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

fn mercatorMetersPerMeter(mercatorY: f32) -> f32 {
  let lat = atan(exp(mercatorY / EARTH_RADIUS_M)) * 2.0 - PI * 0.5;
  return 1.0 / max(cos(lat), 0.01);
}

// ─── Fragment: PBR ───

@fragment
fn fs_main(input: VertexOutput, @builtin(front_facing) frontFacing: bool) -> @location(0) vec4<f32> {
  let uv = input.vTexcoord;

  // ── Base Color ──
  var baseColor = material.baseColorFactor;
  if (material.hasBaseColorTex > 0.5) {
    baseColor = baseColor * textureSample(baseColorTex, texSampler, uv);
  }
  baseColor = vec4<f32>(baseColor.rgb * material.tintColor.rgb, baseColor.a * material.tintColor.a);

  // Alpha test (MASK mode)
  if (material.alphaCutoff > 0.0 && baseColor.a < material.alphaCutoff) {
    discard;
  }

  // KHR_materials_unlit: skip all lighting
  if (material.isUnlit > 0.5) {
    return baseColor;
  }

  // ── Normal (flip for back-faces on double-sided materials) ──
  var N = normalize(input.vNormal);
  if (!frontFacing) { N = -N; }
  if (material.hasNormalTex > 0.5) {
    let tangentNormal = textureSample(normalTex, texSampler, uv).rgb * 2.0 - 1.0;
    // Cotangent frame from screen-space derivatives
    let dpdx_val = dpdx(input.vWorldPos);
    let dpdy_val = dpdy(input.vWorldPos);
    let dudx = dpdx(uv);
    let dvdy = dpdy(uv);
    let T = normalize(dpdx_val * dvdy.y - dpdy_val * dudx.y);
    let B = normalize(cross(N, T));
    let TBN = mat3x3<f32>(T, B, N);
    N = normalize(TBN * tangentNormal);
  }

  // ── Metallic / Roughness ──
  var metallic = material.metallic;
  var roughness = material.roughness;
  if (material.hasMetallicRoughnessTex > 0.5) {
    let mrSample = textureSample(metallicRoughnessTex, texSampler, uv);
    roughness = roughness * mrSample.g; // green channel = roughness
    metallic = metallic * mrSample.b;   // blue channel = metallic
  }
  roughness = clamp(roughness, 0.04, 1.0);

  // ── PBR Lighting ──
  let lightDir = normalize(vec3<f32>(0.5, 0.8, 0.6));
  let viewDir = normalize(vec3<f32>(0.0, 0.0, 1.0));
  let H = normalize(lightDir + viewDir);

  let NdotL = max(dot(N, lightDir), 0.0);
  let NdotV = max(dot(N, viewDir), 0.001);
  let NdotH = max(dot(N, H), 0.0);
  let HdotV = max(dot(H, viewDir), 0.0);

  // Dielectric/metallic F0
  let F0 = mix(vec3<f32>(0.04), baseColor.rgb, metallic);

  // Cook-Torrance BRDF
  let D = distributionGGX(NdotH, roughness);
  let G = geometrySmith(NdotV, NdotL, roughness);
  let F = fresnelSchlick(HdotV, F0);

  let specular = (D * G * F) / (4.0 * NdotV * NdotL + 0.0001);
  let kD = (vec3<f32>(1.0) - F) * (1.0 - metallic);
  let diffuse = kD * baseColor.rgb / PI;

  let radiance = vec3<f32>(1.0); // directional light color
  var color = (diffuse + specular) * radiance * NdotL;

  // Ambient
  color += 0.15 * baseColor.rgb;

  // ── Ambient Occlusion ──
  if (material.hasOcclusionTex > 0.5) {
    let ao = textureSample(occlusionTex, texSampler, uv).r;
    color = color * ao;
  }

  // ── Emissive ──
  var emissive = material.emissiveFactor;
  if (material.hasEmissiveTex > 0.5) {
    emissive = emissive * textureSample(emissiveTex, texSampler, uv).rgb;
  }
  color += emissive;

  return vec4<f32>(color, baseColor.a);
}
`
);
function ei(r) {
  return r.createBindGroupLayout({
    label: "model-material-bind-group-layout",
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      { binding: 5, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      { binding: 6, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } }
    ]
  });
}
function ti(r) {
  const { device: e, colorFormat: t, cameraBindGroupLayout: o, depthFormat: i, depthCompare: a } = r, n = ei(e), s = e.createPipelineLayout({
    label: "model-pipeline-layout",
    bindGroupLayouts: [o, n]
  }), l = e.createShaderModule({
    label: "model-shader",
    code: Jr
  }), c = e.createRenderPipeline({
    label: "model-pipeline",
    layout: s,
    vertex: {
      module: l,
      entryPoint: "vs_main",
      buffers: [
        // Slot 0: mesh vertex data (interleaved)
        {
          arrayStride: 32,
          // 8 floats × 4 bytes
          stepMode: "vertex",
          attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x3" },
            // position
            { shaderLocation: 1, offset: 12, format: "float32x3" },
            // normal
            { shaderLocation: 2, offset: 24, format: "float32x2" }
            // texcoord
          ]
        },
        // Slot 1: instance data
        {
          arrayStride: 32,
          // 8 floats × 4 bytes
          stepMode: "instance",
          attributes: [
            { shaderLocation: 3, offset: 0, format: "float32x3" },
            // worldPos (x,y,z)
            { shaderLocation: 4, offset: 12, format: "float32x2" },
            // scale, heading
            { shaderLocation: 5, offset: 20, format: "float32x3" }
            // pitch, roll, anchorZ
          ]
        }
      ]
    },
    fragment: {
      module: l,
      entryPoint: "fs_main",
      targets: [
        {
          format: t,
          blend: {
            color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
            alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
          }
        }
      ]
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "none"
    },
    depthStencil: {
      format: i,
      depthWriteEnabled: !0,
      depthCompare: a ?? "less"
    },
    multisample: {
      count: r.sampleCount ?? E
    }
  }), p = e.createSampler({
    label: "model-sampler",
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
    addressModeU: "repeat",
    addressModeV: "repeat"
  });
  return { pipeline: c, materialBindGroupLayout: n, sampler: p };
}
const ri = (
  /* wgsl */
  `
// ─── Constants ───
${N}
${q}

// ─── Bindings ───

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
};

@group(1) @binding(0) var<uniform> material: ModelMaterial;
@group(1) @binding(1) var texSampler: sampler;
@group(1) @binding(2) var baseColorTex: texture_2d<f32>;
@group(1) @binding(3) var normalTex: texture_2d<f32>;
@group(1) @binding(4) var metallicRoughnessTex: texture_2d<f32>;
@group(1) @binding(5) var occlusionTex: texture_2d<f32>;
@group(1) @binding(6) var emissiveTex: texture_2d<f32>;

// ─── Helpers ───

fn degreesToRadians(deg: f32) -> f32 {
  return deg * PI / 180.0;
}

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

// ─── Vertex ───

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) texcoord: vec2<f32>,
  @location(3) worldPos: vec3<f32>,
  @location(4) scaleHeading: vec2<f32>,
  @location(5) pitchRollAnchor: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) vNormal: vec3<f32>,
  @location(1) vTexcoord: vec2<f32>,
  @location(2) vWorldPos: vec3<f32>,
  @location(3) clipDot: f32,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  let scale = input.scaleHeading.x;
  let heading = input.scaleHeading.y;
  let pitch = input.pitchRollAnchor.x;
  let roll = input.pitchRollAnchor.y;
  let anchorZ = input.pitchRollAnchor.z;

  // Convert instance position to sphere
  let merc01 = epsg3857ToMerc01(input.worldPos);
  let angular = mercatorToAngular(merc01);
  let spherePos = angularToSphere(angular.x, angular.y);

  // Build LOCAL TANGENT FRAME at sphere position
  let up = normalize(spherePos);
  // Pole guard: if near pole, use X-axis instead of Y
  var refDir = vec3<f32>(0.0, 1.0, 0.0);
  if (abs(up.y) > 0.999) {
    refDir = vec3<f32>(1.0, 0.0, 0.0);
  }
  let east = normalize(cross(refDir, up));
  let north = cross(up, east);
  // Model local axes are x=east, y=north, z=up in mapgpu space.
  let tangentMatrix = mat3x3<f32>(east, north, up);

  // Rotation matrix (shared by globe and flat paths)
  let rotMat = eulerToRotationMatrix(heading, pitch, roll);

  // ─── Globe path: tangent frame on unit sphere ───
  let globeScale = scale / EARTH_RADIUS_M;
  let localOffset = tangentMatrix * (rotMat * (input.position * globeScale));
  let totalAlt = input.worldPos.z + anchorZ;
  let altFrac = altitudeOffset(totalAlt);
  let globeFinal = spherePos * (1.0 + altFrac) + localOffset;

  var globeClip = camera.viewProjection * vec4<f32>(globeFinal, 1.0);
  // Depth strategy: shift the entire model's projected depth to align with
  // globeClippingZ ordering. The shift is CONSTANT per instance (computed
  // from instance center), so relative depth between vertices is preserved
  // perfectly — no floating-point cancellation, no amplification.
  let instanceCenter = spherePos * (1.0 + altFrac);
  let centerClip = camera.viewProjection * vec4<f32>(instanceCenter, 1.0);
  let centerNDC = centerClip.z / centerClip.w;
  let globeNDC = globeClippingZ(instanceCenter);
  let depthShift = globeNDC - centerNDC;
  globeClip.z = globeClip.z + depthShift * globeClip.w;

  // ─── Flat path: model vertex offset in Mercator [0..1] space ───
  let flatMercatorScale = 1.0 / max(cos(angular.y), 0.01);
  let flatRotated = rotMat * (input.position * scale);
  let flatLocalScale = flatMercatorScale / (2.0 * HALF_CIRCUMFERENCE);
  let flatMerc = vec3<f32>(
    merc01.x + flatRotated.x * flatLocalScale,
    merc01.y - flatRotated.y * flatLocalScale,
    altitudeOffset(input.worldPos.z) + (flatRotated.z + anchorZ) * flatLocalScale
  );
  var flatClip = camera.flatViewProjection * vec4<f32>(flatMerc, 1.0);
  // Keep projected depth for self-occlusion, apply small layer pull
  flatClip.z -= 0.001 * flatClip.w;

  const LAYER_DEPTH_OFFSET: f32 = 0.0003;

  // Blend based on projection transition
  var clipPos: vec4<f32>;
  if (camera.projectionTransition >= 0.999) {
    clipPos = globeClip;
  } else if (camera.projectionTransition <= 0.001) {
    clipPos = flatClip;
  } else {
    clipPos = mix(flatClip, globeClip, camera.projectionTransition);
  }
  clipPos.z -= LAYER_DEPTH_OFFSET * clipPos.w;
  clipPos.z = min(clipPos.z, clipPos.w * 0.9999);

  output.clipPosition = clipPos;

  // Normal: globe tangent frame vs flat (match 2D mode in flat path)
  let globeNormal = normalize(tangentMatrix * (rotMat * input.normal));
  let flatNormal = normalize(rotMat * input.normal);
  if (camera.projectionTransition >= 0.999) {
    output.vNormal = globeNormal;
  } else if (camera.projectionTransition <= 0.001) {
    output.vNormal = flatNormal;
  } else {
    output.vNormal = normalize(mix(flatNormal, globeNormal, camera.projectionTransition));
  }
  output.vTexcoord = input.texcoord;
  output.vWorldPos = globeFinal;
  output.clipDot = dot(spherePos, camera.clippingPlane.xyz) + camera.clippingPlane.w;

  return output;
}

// ─── PBR Helpers ───

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

// ─── Fragment: PBR ───

@fragment
fn fs_main(input: VertexOutput, @builtin(front_facing) frontFacing: bool) -> @location(0) vec4<f32> {
  // Horizon occlusion
  if (camera.projectionTransition > 0.01 && input.clipDot < -0.01) { discard; }

  let uv = input.vTexcoord;

  // Base Color
  var baseColor = material.baseColorFactor;
  if (material.hasBaseColorTex > 0.5) {
    baseColor = baseColor * textureSample(baseColorTex, texSampler, uv);
  }
  baseColor = vec4<f32>(baseColor.rgb * material.tintColor.rgb, baseColor.a * material.tintColor.a);

  if (material.alphaCutoff > 0.0 && baseColor.a < material.alphaCutoff) { discard; }

  // KHR_materials_unlit: skip all lighting
  if (material.isUnlit > 0.5) { return baseColor; }

  // Normal (flip for back-faces on double-sided materials)
  var N = normalize(input.vNormal);
  if (!frontFacing) { N = -N; }

  // Metallic / Roughness
  var metallic = material.metallic;
  var roughness = material.roughness;
  if (material.hasMetallicRoughnessTex > 0.5) {
    let mrSample = textureSample(metallicRoughnessTex, texSampler, uv);
    roughness = roughness * mrSample.g;
    metallic = metallic * mrSample.b;
  }
  roughness = clamp(roughness, 0.04, 1.0);

  // PBR Lighting — view direction computed per-pixel from globe position
  // (same pattern as globe-extrusion-pipeline: -worldPos = outward from globe center ≈ toward camera)
  let lightDir = normalize(vec3<f32>(0.5, 0.8, 0.6));
  let viewDir = normalize(-input.vWorldPos);
  let H = normalize(lightDir + viewDir);

  let NdotL = max(dot(N, lightDir), 0.0);
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

  var color = (diffuse + specular) * NdotL;
  color += 0.15 * baseColor.rgb;

  if (material.hasOcclusionTex > 0.5) {
    color = color * textureSample(occlusionTex, texSampler, uv).r;
  }

  var emissive = material.emissiveFactor;
  if (material.hasEmissiveTex > 0.5) {
    emissive = emissive * textureSample(emissiveTex, texSampler, uv).rgb;
  }
  color += emissive;

  return vec4<f32>(color, baseColor.a);
}
`
);
function ii(r) {
  return r.createBindGroupLayout({
    label: "globe-model-material-bind-group-layout",
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      { binding: 5, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      { binding: 6, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } }
    ]
  });
}
function oi(r) {
  const { device: e, colorFormat: t, globeCameraBindGroupLayout: o, depthFormat: i, depthCompare: a } = r, n = ii(e), s = e.createPipelineLayout({
    label: "globe-model-pipeline-layout",
    bindGroupLayouts: [o, n]
  }), l = e.createShaderModule({
    label: "globe-model-shader",
    code: ri
  }), c = e.createRenderPipeline({
    label: "globe-model-pipeline",
    layout: s,
    vertex: {
      module: l,
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 32,
          stepMode: "vertex",
          attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x3" },
            { shaderLocation: 1, offset: 12, format: "float32x3" },
            { shaderLocation: 2, offset: 24, format: "float32x2" }
          ]
        },
        {
          arrayStride: 32,
          stepMode: "instance",
          attributes: [
            { shaderLocation: 3, offset: 0, format: "float32x3" },
            { shaderLocation: 4, offset: 12, format: "float32x2" },
            { shaderLocation: 5, offset: 20, format: "float32x3" }
          ]
        }
      ]
    },
    fragment: {
      module: l,
      entryPoint: "fs_main",
      targets: [
        {
          format: t,
          blend: {
            color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
            alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
          }
        }
      ]
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "none"
    },
    depthStencil: {
      format: i,
      depthWriteEnabled: !0,
      depthCompare: a ?? "less"
    },
    multisample: {
      count: r.sampleCount ?? E
    }
  }), p = e.createSampler({
    label: "globe-model-sampler",
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
    addressModeU: "repeat",
    addressModeV: "repeat"
  });
  return { pipeline: c, materialBindGroupLayout: n, sampler: p };
}
class ai {
  _device;
  _models = /* @__PURE__ */ new Map();
  constructor(e) {
    this._device = e;
  }
  /**
   * Upload a parsed GLTF model to GPU buffers (synchronous — no textures).
   * Interleaves position/normal/texcoord into a single vertex buffer per primitive.
   */
  upload(e, t) {
    if (this._models.has(e)) return;
    const o = t.primitives.map(
      (i, a) => this._uploadPrimitive(e, i.mesh, i.material, a)
    );
    this._models.set(e, { primitives: o });
  }
  /**
   * Upload a parsed GLTF model with async texture creation.
   * Falls back to sync upload if no textures are present.
   */
  async uploadAsync(e, t) {
    if (this._models.has(e)) return;
    const o = [];
    for (let i = 0; i < t.primitives.length; i++) {
      const a = t.primitives[i], n = this._uploadPrimitive(e, a.mesh, a.material, i), s = [
        { field: "baseColorTexture", index: a.material.baseColorTextureIndex },
        { field: "normalTexture", index: a.material.normalTextureIndex },
        { field: "metallicRoughnessTexture", index: a.material.metallicRoughnessTextureIndex },
        { field: "occlusionTexture", index: a.material.occlusionTextureIndex },
        { field: "emissiveTexture", index: a.material.emissiveTextureIndex }
      ];
      for (const l of s) {
        if (l.index === void 0) continue;
        const c = a.imageData.get(l.index);
        if (c)
          try {
            const p = new ArrayBuffer(c.data.byteLength);
            new Uint8Array(p).set(c.data);
            const u = new Blob([p], { type: c.mimeType }), d = await createImageBitmap(u);
            n[l.field] = this._createTextureFromBitmap(
              d,
              `${e}-p${i}-${l.field}`
            ), d.close();
          } catch {
          }
      }
      o.push(n);
    }
    this._models.set(e, { primitives: o });
  }
  /** Get a loaded model by ID */
  get(e) {
    return this._models.get(e);
  }
  /** Check if a model is loaded */
  has(e) {
    return this._models.has(e);
  }
  /** Release all GPU resources */
  destroy() {
    for (const e of this._models.values())
      for (const t of e.primitives)
        t.vertexBuffer.destroy(), t.indexBuffer.destroy(), t.baseColorTexture?.destroy(), t.normalTexture?.destroy(), t.metallicRoughnessTexture?.destroy(), t.occlusionTexture?.destroy(), t.emissiveTexture?.destroy();
    this._models.clear();
  }
  // ── Private ──
  _uploadPrimitive(e, t, o, i) {
    const n = new Float32Array(t.vertexCount * 8);
    for (let x = 0; x < t.vertexCount; x++) {
      const g = x * 8, b = x * 3, v = x * 3, P = x * 2;
      n[g + 0] = t.positions[b], n[g + 1] = t.positions[b + 1], n[g + 2] = t.positions[b + 2], n[g + 3] = t.normals[v], n[g + 4] = t.normals[v + 1], n[g + 5] = t.normals[v + 2], n[g + 6] = t.texcoords[P], n[g + 7] = t.texcoords[P + 1];
    }
    const s = `model-vertex-${e}${i > 0 ? `-p${i}` : ""}`, l = this._device.createBuffer({
      label: s,
      size: n.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: !0
    });
    new Float32Array(l.getMappedRange()).set(n), l.unmap();
    const c = t.indices, p = c instanceof Uint32Array ? "uint32" : "uint16", u = c.byteLength, d = Math.ceil(u / 4) * 4, m = `model-index-${e}${i > 0 ? `-p${i}` : ""}`, f = this._device.createBuffer({
      label: m,
      size: Math.max(d, 4),
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: !0
    }), h = f.getMappedRange(0, Math.max(d, 4));
    return c instanceof Uint32Array ? new Uint32Array(h).set(c) : new Uint16Array(h).set(c), f.unmap(), {
      vertexBuffer: l,
      indexBuffer: f,
      indexFormat: p,
      indexCount: t.indexCount,
      vertexCount: t.vertexCount,
      material: o,
      baseColorTexture: null,
      normalTexture: null,
      metallicRoughnessTexture: null,
      occlusionTexture: null,
      emissiveTexture: null
    };
  }
  _createTextureFromBitmap(e, t) {
    const o = this._device.createTexture({
      label: t,
      size: { width: e.width, height: e.height },
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });
    return this._device.queue.copyExternalImageToTexture(
      { source: e },
      { texture: o },
      { width: e.width, height: e.height }
    ), o;
  }
}
const Ne = 1179937895, ni = 2, ke = 1313821514, He = 5130562, si = {
  5120: 1,
  // BYTE
  5121: 1,
  // UNSIGNED_BYTE
  5122: 2,
  // SHORT
  5123: 2,
  // UNSIGNED_SHORT
  5125: 4,
  // UNSIGNED_INT
  5126: 4
  // FLOAT
}, li = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16
};
function ne(r, e, t) {
  const o = li[r.type];
  if (o === void 0)
    throw new Error(`GLB: unknown accessor type "${r.type}"`);
  const i = si[r.componentType];
  if (i === void 0)
    throw new Error(`GLB: unknown componentType ${r.componentType}`);
  const a = r.count * o;
  if (r.bufferView === void 0)
    return We(r.componentType, new ArrayBuffer(a * i), 0, a);
  const n = e[r.bufferView];
  if (!n)
    throw new Error(`GLB: bufferView index ${r.bufferView} out of range`);
  const s = n.byteOffset ?? 0, l = r.byteOffset ?? 0, c = s + l, p = a * i, u = new ArrayBuffer(p);
  return new Uint8Array(u).set(t.subarray(c, c + p)), We(r.componentType, u, 0, a);
}
function We(r, e, t, o) {
  switch (r) {
    case 5120:
      return new Int8Array(e, t, o);
    case 5121:
      return new Uint8Array(e, t, o);
    case 5122:
      return new Int16Array(e, t, o);
    case 5123:
      return new Uint16Array(e, t, o);
    case 5125:
      return new Uint32Array(e, t, o);
    case 5126:
      return new Float32Array(e, t, o);
    default:
      throw new Error(`GLB: unsupported componentType ${r}`);
  }
}
function ye(r) {
  if (r instanceof Float32Array) return r;
  const e = r, t = new Float32Array(e.length);
  for (let o = 0; o < e.length; o++) t[o] = e[o];
  return t;
}
function ci(r, e, t, o, i) {
  const [a, n, s, l] = o, c = a + a, p = n + n, u = s + s, d = a * c, m = a * p, f = a * u, h = n * p, x = n * u, g = s * u, b = l * c, v = l * p, P = l * u, C = 1 - (h + g), S = m - P, R = f + v, y = m + P, w = 1 - (d + g), B = x - b, T = f - v, F = x + b, M = 1 - (d + h), _ = r.length / 3;
  for (let G = 0; G < _; G++) {
    const L = G * 3, j = r[L] * i[0], X = r[L + 1] * i[1], de = r[L + 2] * i[2];
    r[L] = C * j + S * X + R * de + t[0], r[L + 1] = y * j + w * X + B * de + t[1], r[L + 2] = T * j + F * X + M * de + t[2];
    const fe = e[L], he = e[L + 1], me = e[L + 2], ge = C * fe + S * he + R * me, xe = y * fe + w * he + B * me, ve = T * fe + F * he + M * me, be = Math.sqrt(ge * ge + xe * xe + ve * ve) || 1;
    e[L] = ge / be, e[L + 1] = xe / be, e[L + 2] = ve / be;
  }
}
function ui(r) {
  const e = new Float32Array(r * 3);
  for (let t = 0; t < r; t++)
    e[t * 3 + 2] = 1;
  return e;
}
function pi(r) {
  return new Float32Array(r * 2);
}
function di(r) {
  const e = new Uint32Array(r);
  for (let t = 0; t < r; t++) e[t] = t;
  return e;
}
const I = {
  baseColorFactor: [1, 1, 1, 1],
  metallicFactor: 1,
  roughnessFactor: 1,
  emissiveFactor: [0, 0, 0],
  alphaMode: "OPAQUE",
  alphaCutoff: 0.5,
  doubleSided: !1,
  unlit: !1
};
function fi(r, e, t, o) {
  const i = r.attributes.POSITION;
  if (i === void 0)
    throw new Error("GLB: primitive has no POSITION attribute");
  const a = e[i];
  if (!a)
    throw new Error(`GLB: POSITION accessor index ${i} out of range`);
  const n = ye(ne(a, t, o)), s = a.count;
  let l;
  const c = r.attributes.NORMAL;
  if (c !== void 0) {
    const f = e[c];
    if (!f)
      throw new Error(`GLB: NORMAL accessor index ${c} out of range`);
    l = ye(ne(f, t, o));
  } else
    l = ui(s);
  let p;
  const u = r.attributes.TEXCOORD_0;
  if (u !== void 0) {
    const f = e[u];
    if (!f)
      throw new Error(`GLB: TEXCOORD_0 accessor index ${u} out of range`);
    p = ye(ne(f, t, o));
  } else
    p = pi(s);
  let d, m;
  if (r.indices !== void 0) {
    const f = e[r.indices];
    if (!f)
      throw new Error(`GLB: indices accessor index ${r.indices} out of range`);
    const h = ne(f, t, o);
    if (h instanceof Uint16Array)
      d = h;
    else if (h instanceof Uint32Array)
      d = h;
    else {
      const x = h, g = new Uint32Array(x.length);
      for (let b = 0; b < x.length; b++) g[b] = x[b];
      d = g;
    }
    m = f.count;
  } else
    d = di(s), m = s;
  return { positions: n, normals: l, texcoords: p, indices: d, vertexCount: s, indexCount: m };
}
function hi(r, e) {
  if (r === void 0 || !e || !e[r])
    return { ...I };
  const t = e[r], o = t.pbrMetallicRoughness, i = o?.baseColorFactor, a = {
    baseColorFactor: i && i.length >= 4 ? [i[0], i[1], i[2], i[3]] : I.baseColorFactor,
    metallicFactor: o?.metallicFactor ?? I.metallicFactor,
    roughnessFactor: o?.roughnessFactor ?? I.roughnessFactor,
    emissiveFactor: t.emissiveFactor && t.emissiveFactor.length >= 3 ? [t.emissiveFactor[0], t.emissiveFactor[1], t.emissiveFactor[2]] : I.emissiveFactor,
    alphaMode: t.alphaMode ?? I.alphaMode,
    alphaCutoff: t.alphaCutoff ?? I.alphaCutoff,
    doubleSided: t.doubleSided ?? I.doubleSided,
    unlit: t.extensions?.KHR_materials_unlit !== void 0
  };
  return o?.baseColorTexture !== void 0 && (a.baseColorTextureIndex = o.baseColorTexture.index), o?.metallicRoughnessTexture !== void 0 && (a.metallicRoughnessTextureIndex = o.metallicRoughnessTexture.index), t.normalTexture !== void 0 && (a.normalTextureIndex = t.normalTexture.index), t.occlusionTexture !== void 0 && (a.occlusionTextureIndex = t.occlusionTexture.index), t.emissiveTexture !== void 0 && (a.emissiveTextureIndex = t.emissiveTexture.index), a;
}
function mi(r, e, t, o) {
  const i = e.textures;
  if (!i || !i[r]) return;
  const a = i[r];
  if (a.source === void 0) return;
  const n = e.images;
  if (!n || !n[a.source]) return;
  const s = n[a.source];
  if (s.bufferView === void 0) return;
  const l = t[s.bufferView];
  if (!l) return;
  const c = l.byteOffset ?? 0, p = new Uint8Array(l.byteLength);
  return p.set(o.subarray(c, c + l.byteLength)), { data: p, mimeType: s.mimeType ?? "image/png" };
}
function gi(r) {
  if (r.byteLength < 12)
    throw new Error("GLB: data too small to contain a valid header");
  const e = new DataView(r), t = e.getUint32(0, !0);
  if (t !== Ne)
    throw new Error(
      `GLB: invalid magic 0x${t.toString(16).padStart(8, "0")}, expected 0x${Ne.toString(16).padStart(8, "0")}`
    );
  const o = e.getUint32(4, !0);
  if (o !== ni)
    throw new Error(`GLB: unsupported version ${o}, only version 2 is supported`);
  const i = e.getUint32(8, !0);
  if (i > r.byteLength)
    throw new Error(`GLB: declared length ${i} exceeds buffer size ${r.byteLength}`);
  let a = 12;
  if (a + 8 > i)
    throw new Error("GLB: missing JSON chunk header");
  const n = e.getUint32(a, !0), s = e.getUint32(a + 4, !0);
  if (s !== ke)
    throw new Error(
      `GLB: first chunk type 0x${s.toString(16)} is not JSON (0x${ke.toString(16)})`
    );
  if (a += 8, a + n > i)
    throw new Error("GLB: JSON chunk extends beyond file");
  const l = new Uint8Array(r, a, n), c = new TextDecoder().decode(l), p = JSON.parse(c);
  a += n;
  let u = new Uint8Array(0);
  if (a + 8 <= i) {
    const d = e.getUint32(a, !0), m = e.getUint32(a + 4, !0);
    if (m !== He)
      throw new Error(
        `GLB: second chunk type 0x${m.toString(16)} is not BIN (0x${He.toString(16)})`
      );
    if (a += 8, a + d > i)
      throw new Error("GLB: BIN chunk extends beyond file");
    u = new Uint8Array(r, a, d);
  }
  return ut(p, u);
}
function xi(r, e) {
  const t = r;
  let o = 0;
  for (const s of e) o += s.byteLength;
  const i = new Uint8Array(o), a = [];
  let n = 0;
  for (const s of e)
    a.push(n), i.set(new Uint8Array(s), n), n += s.byteLength;
  if (t.bufferViews)
    for (const s of t.bufferViews) {
      const l = a[s.buffer] ?? 0;
      s.byteOffset = (s.byteOffset ?? 0) + l, s.buffer = 0;
    }
  return ut(t, i);
}
function Pe(r, e, t, o, i, a) {
  const n = [];
  for (const s of r.primitives) {
    const l = fi(s, e, t, o), c = hi(s.material, i.materials);
    if (a) {
      const d = a.translation ?? [0, 0, 0], m = a.rotation ?? [0, 0, 0, 1], f = a.scale ?? [1, 1, 1];
      (a.translation || a.rotation || a.scale) && ci(l.positions, l.normals, d, m, f);
    }
    const p = /* @__PURE__ */ new Map(), u = [
      c.baseColorTextureIndex,
      c.normalTextureIndex,
      c.metallicRoughnessTextureIndex,
      c.occlusionTextureIndex,
      c.emissiveTextureIndex
    ];
    for (const d of u)
      if (d !== void 0 && !p.has(d)) {
        const m = mi(d, i, t, o);
        m && p.set(d, m);
      }
    n.push({ mesh: l, material: c, imageData: p, name: a?.name ?? r.name });
  }
  return n;
}
function ut(r, e) {
  if (!r.meshes || r.meshes.length === 0)
    throw new Error("GLB: no meshes found in JSON");
  const t = r.accessors ?? [], o = r.bufferViews ?? [], i = [];
  if (r.nodes && r.nodes.length > 0) {
    const a = /* @__PURE__ */ new Set();
    for (const n of r.nodes) {
      if (n.mesh === void 0) continue;
      const s = r.meshes[n.mesh];
      s && (a.add(n.mesh), i.push(...Pe(s, t, o, e, r, n)));
    }
    for (let n = 0; n < r.meshes.length; n++)
      a.has(n) || i.push(...Pe(r.meshes[n], t, o, e, r));
  } else
    for (const a of r.meshes)
      i.push(...Pe(a, t, o, e, r));
  if (i.length === 0)
    throw new Error("GLB: no primitives found");
  return { primitives: i };
}
const ee = [
  1,
  0,
  0,
  0,
  0,
  1,
  0,
  0,
  0,
  0,
  1,
  0,
  0,
  0,
  0,
  1
];
function Ce(r) {
  return {
    min: [r.min[0], r.min[1], r.min[2]],
    max: [r.max[0], r.max[1], r.max[2]]
  };
}
function $(r) {
  return Object.is(r, -0) ? 0 : r;
}
function ce() {
  return {
    min: [1 / 0, 1 / 0, 1 / 0],
    max: [-1 / 0, -1 / 0, -1 / 0]
  };
}
function ue(r, e) {
  e[0] < r.min[0] && (r.min[0] = e[0]), e[1] < r.min[1] && (r.min[1] = e[1]), e[2] < r.min[2] && (r.min[2] = e[2]), e[0] > r.max[0] && (r.max[0] = e[0]), e[1] > r.max[1] && (r.max[1] = e[1]), e[2] > r.max[2] && (r.max[2] = e[2]);
}
function pe(r) {
  return Number.isFinite(r.min[0]) ? (r.min[0] = $(r.min[0]), r.min[1] = $(r.min[1]), r.min[2] = $(r.min[2]), r.max[0] = $(r.max[0]), r.max[1] = $(r.max[1]), r.max[2] = $(r.max[2]), r) : {
    min: [0, 0, 0],
    max: [0, 0, 0]
  };
}
function vi(r) {
  return [r[0], -r[2], r[1]];
}
function Le(r) {
  const e = r.min[0], t = r.min[1], o = r.min[2], i = r.max[0], a = r.max[1], n = r.max[2];
  return [
    [e, t, o],
    [i, t, o],
    [i, a, o],
    [e, a, o],
    [e, t, n],
    [i, t, n],
    [i, a, n],
    [e, a, n]
  ];
}
function bi(r) {
  const e = Math.hypot(r[0], r[1], r[2], r[3]) || 1;
  return [
    r[0] / e,
    r[1] / e,
    r[2] / e,
    r[3] / e
  ];
}
function yi(r, e, t) {
  const [o, i, a, n] = bi(e), s = o + o, l = i + i, c = a + a, p = o * s, u = o * l, d = o * c, m = i * l, f = i * c, h = a * c, x = n * s, g = n * l, b = n * c, v = 1 - (m + h), P = u - b, C = d + g, S = u + b, R = 1 - (p + h), y = f - x, w = d - g, B = f + x, T = 1 - (p + m);
  return new Float32Array([
    v * t[0],
    S * t[0],
    w * t[0],
    0,
    P * t[1],
    R * t[1],
    B * t[1],
    0,
    C * t[2],
    y * t[2],
    T * t[2],
    0,
    r[0],
    r[1],
    r[2],
    1
  ]);
}
function pt(r, e) {
  return [
    r[0] * e[0] + r[4] * e[1] + r[8] * e[2] + r[12],
    r[1] * e[0] + r[5] * e[1] + r[9] * e[2] + r[13],
    r[2] * e[0] + r[6] * e[1] + r[10] * e[2] + r[14]
  ];
}
function Pi(r) {
  const e = r[0], t = r[4], o = r[8], i = r[1], a = r[5], n = r[9], s = r[2], l = r[6], c = r[10], p = c * a - n * l, u = -c * i + n * s, d = l * i - a * s;
  let m = e * p + t * u + o * d;
  if (Math.abs(m) < 1e-8)
    return new Float32Array(ee);
  m = 1 / m;
  const f = p * m, h = (-c * t + o * l) * m, x = (n * t - o * a) * m, g = u * m, b = (c * e - o * s) * m, v = (-n * e + o * i) * m, P = d * m, C = (-l * e + t * s) * m, S = (a * e - t * i) * m;
  return new Float32Array([
    f,
    h,
    x,
    0,
    g,
    b,
    v,
    0,
    P,
    C,
    S,
    0,
    0,
    0,
    0,
    1
  ]);
}
function je(r, e, t, o) {
  r.set(t, e), r.set(o, e + 16);
}
function Te(r, e, t, o) {
  const i = r.map(
    (c, p) => yi(
      e[p] ?? c.translation,
      t[p] ?? c.rotation,
      o[p] ?? c.scale
    )
  ), a = r.map(() => new Float32Array(ee)), n = r.map(() => new Float32Array(ee)), s = new Array(r.length).fill(!1), l = (c) => {
    if (s[c]) return;
    const p = r[c], u = i[c];
    p.parentIndex === null || p.parentIndex < 0 ? a[c] = u : (l(p.parentIndex), a[c] = J(a[p.parentIndex], u)), n[c] = Pi(a[c]), s[c] = !0;
  };
  for (let c = 0; c < r.length; c++)
    l(c);
  return { worldMatrices: a, normalMatrices: n };
}
function Xe(r, e) {
  const t = ce();
  for (const o of r) {
    const i = o.nodeIndex === null ? ee : e[o.nodeIndex] ?? ee;
    for (const a of Le(o.bounds))
      ue(t, vi(pt(i, a)));
  }
  return pe(t);
}
function $e(r, e, t, o) {
  const i = Ce(r), a = Ce(e);
  return {
    localBounds: Ce(a),
    restLocalBounds: i,
    currentLocalBounds: a,
    groundAnchorLocalZ: -a.min[2],
    restGroundAnchorLocalZ: -i.min[2],
    currentGroundAnchorLocalZ: -a.min[2],
    units: "meters",
    localAxes: "east-north-up",
    isAnimated: t,
    hasHierarchy: o
  };
}
function we(r) {
  return r * Math.PI / 180;
}
function Ci(r, e, t, o, i, a) {
  const n = we(o), s = we(i), l = we(a), c = Math.cos(n), p = Math.sin(n), u = Math.cos(s), d = Math.sin(s), m = Math.cos(l), f = Math.sin(l);
  return [
    c * u * r + (c * d * f - p * m) * e + (c * d * m + p * f) * t,
    p * u * r + (p * d * f + c * m) * e + (p * d * m - c * f) * t,
    -d * r + u * f * e + u * m * t
  ];
}
function wi(r, e) {
  const t = r.currentLocalBounds ?? r.localBounds, o = e.scale ?? 1, i = e.heading ?? 0, a = e.pitch ?? 0, n = e.roll ?? 0, s = e.anchorZ ?? 0, [l, c, p] = e.coordinates, [u, d] = xt(l, c), m = Le(t).map((g) => {
    const [b, v, P] = Ci(
      g[0] * o,
      g[1] * o,
      g[2] * o,
      i,
      a,
      n
    ), [C, S] = vt(u + b, d + v);
    return [C, S, p + s + P];
  }), f = ce();
  for (const g of m)
    ue(f, g);
  const h = [0, 1, 2, 3, 0].map((g) => m[g]), x = [4, 5, 6, 7, 4].map((g) => m[g]);
  return {
    cornersLonLatAlt: m,
    aabbLonLatAlt: pe(f),
    footprint: h,
    topOutline: x
  };
}
const Si = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }, Ti = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
function Y(r, e, t) {
  const o = Ti[r.type] ?? 1, i = Si[r.componentType] ?? 4, a = r.count * o;
  if (r.bufferView === void 0)
    return r.componentType === 5126 ? new Float32Array(a) : new Uint32Array(a);
  const n = e[r.bufferView], s = (n.byteOffset ?? 0) + (r.byteOffset ?? 0);
  if (n.byteStride && n.byteStride > o * i) {
    const p = new Float32Array(a);
    for (let u = 0; u < r.count; u++) {
      const d = s + u * n.byteStride;
      for (let m = 0; m < o; m++) {
        const f = new DataView(t.buffer, t.byteOffset + d + m * i, i);
        p[u * o + m] = r.componentType === 5126 ? f.getFloat32(0, !0) : f.getUint16(0, !0);
      }
    }
    return p;
  }
  const l = a * i, c = new ArrayBuffer(l);
  switch (new Uint8Array(c).set(t.subarray(s, s + l)), r.componentType) {
    case 5123:
      return new Uint16Array(c, 0, a);
    case 5125:
      return new Uint32Array(c, 0, a);
    default:
      return new Float32Array(c, 0, a);
  }
}
function K(r) {
  if (r instanceof Float32Array) return r;
  const e = new Float32Array(r.length);
  for (let t = 0; t < r.length; t++) e[t] = r[t];
  return e;
}
function Bi(r, e, t, o) {
  const i = [];
  for (const a of r.animations ?? []) {
    const n = [];
    for (const l of a.channels ?? []) {
      const c = a.samplers?.[l.sampler], p = l.target.node, u = l.target.path;
      if (!c || p === void 0 || u !== "translation" && u !== "rotation" && u !== "scale") continue;
      const d = e[c.input], m = e[c.output];
      !d || !m || n.push({
        node: p,
        path: u,
        interpolation: c.interpolation ?? "LINEAR",
        input: K(Y(d, t, o)),
        output: K(Y(m, t, o))
      });
    }
    if (n.length === 0) continue;
    let s = 0;
    for (const l of n) {
      const c = l.input[l.input.length - 1] ?? 0;
      c > s && (s = c);
    }
    i.push({
      name: a.name,
      duration: s,
      channels: n
    });
  }
  return i;
}
function Gi(r, e, t, o) {
  const i = e[r.attributes.POSITION], a = K(Y(i, t, o)), n = i.count, s = ce();
  for (let f = 0; f < n; f++)
    ue(s, [
      a[f * 3],
      a[f * 3 + 1],
      a[f * 3 + 2]
    ]);
  const l = r.attributes.NORMAL, c = l !== void 0 ? K(Y(e[l], t, o)) : (() => {
    const f = new Float32Array(n * 3);
    for (let h = 0; h < n; h++) f[h * 3 + 2] = 1;
    return f;
  })(), p = r.attributes.TEXCOORD_0, u = p !== void 0 ? K(Y(e[p], t, o)) : new Float32Array(n * 2);
  let d, m;
  if (r.indices !== void 0) {
    const f = Y(e[r.indices], t, o);
    d = f instanceof Float32Array ? new Uint32Array(f) : f, m = e[r.indices].count;
  } else {
    d = new Uint32Array(n);
    for (let f = 0; f < n; f++) d[f] = f;
    m = n;
  }
  return { positions: a, normals: c, texcoords: u, indices: d, vertexCount: n, indexCount: m, bounds: pe(s) };
}
function Mi(r, e, t, o, i) {
  const a = {
    baseColorFactor: [1, 1, 1, 1],
    metallicFactor: 1,
    roughnessFactor: 1,
    doubleSided: !1,
    alphaMode: "OPAQUE",
    alphaCutoff: 0.5,
    unlit: !1,
    emissiveFactor: [0, 0, 0]
  };
  if (r === void 0 || !e || !e[r]) return a;
  const n = e[r], s = n.pbrMetallicRoughness, l = s?.baseColorFactor, c = {
    baseColorFactor: l && l.length >= 4 ? [l[0], l[1], l[2], l[3]] : a.baseColorFactor,
    metallicFactor: s?.metallicFactor ?? a.metallicFactor,
    roughnessFactor: s?.roughnessFactor ?? a.roughnessFactor,
    doubleSided: n.doubleSided ?? !1,
    alphaMode: n.alphaMode ?? "OPAQUE",
    alphaCutoff: n.alphaCutoff ?? 0.5,
    unlit: n.extensions?.KHR_materials_unlit !== void 0,
    emissiveFactor: n.emissiveFactor && n.emissiveFactor.length >= 3 ? [n.emissiveFactor[0], n.emissiveFactor[1], n.emissiveFactor[2]] : [0, 0, 0]
  }, p = (u) => {
    if (u === void 0) return;
    const d = t.textures?.[u];
    if (!d || d.source === void 0) return;
    const m = t.images?.[d.source];
    if (m) {
      if (m.bufferView !== void 0) {
        const f = o[m.bufferView], h = f.byteOffset ?? 0, x = new Uint8Array(f.byteLength);
        return x.set(i.subarray(h, h + f.byteLength)), { data: x, mimeType: m.mimeType ?? "image/png" };
      }
      if (m.uri?.startsWith("data:")) {
        const [f, h] = m.uri.split(","), x = f?.match(/data:(.*?);/)?.[1] ?? "image/png", g = atob(h), b = new Uint8Array(g.length);
        for (let v = 0; v < g.length; v++) b[v] = g.charCodeAt(v);
        return { data: b, mimeType: x };
      }
    }
  };
  return c.baseColorTexture = p(s?.baseColorTexture?.index), c.normalTexture = p(n.normalTexture?.index), c.metallicRoughnessTexture = p(s?.metallicRoughnessTexture?.index), c.occlusionTexture = p(n.occlusionTexture?.index), c.emissiveTexture = p(n.emissiveTexture?.index), c;
}
function dt(r, e) {
  if (!r.meshes?.length) throw new Error("GLTF2: no meshes");
  const t = r.accessors ?? [], o = r.bufferViews ?? [], i = [], a = new Array((r.nodes ?? []).length).fill(null);
  (r.nodes ?? []).forEach((u, d) => {
    for (const m of u.children ?? [])
      a[m] = d;
  });
  const n = (r.nodes ?? []).map((u, d) => ({
    name: u.name,
    mesh: u.mesh,
    translation: u.translation ?? [0, 0, 0],
    rotation: u.rotation ?? [0, 0, 0, 1],
    scale: u.scale ?? [1, 1, 1],
    children: [...u.children ?? []],
    parentIndex: a[d] ?? null
  })), s = Bi(r, t, o, e), l = ce(), { worldMatrices: c } = Te(n, n.map((u) => u.translation), n.map((u) => u.rotation), n.map((u) => u.scale)), p = (u, d, m) => {
    const f = r.meshes[u];
    for (const h of f.primitives) {
      const x = Gi(h, t, o, e), g = Mi(h.material, r.materials, r, o, e), b = m === void 0 ? null : c[m] ?? null;
      for (const v of Le(x.bounds)) {
        const P = b ? pt(b, v) : v;
        ue(l, P);
      }
      i.push({ mesh: x, material: g, name: d?.name ?? f.name, nodeIndex: m });
    }
  };
  if (r.nodes?.length) {
    const u = /* @__PURE__ */ new Set();
    r.nodes.forEach((d, m) => {
      d.mesh !== void 0 && (u.add(d.mesh), p(d.mesh, d, m));
    });
    for (let d = 0; d < r.meshes.length; d++)
      u.has(d) || p(d);
  } else
    for (let u = 0; u < r.meshes.length; u++) p(u);
  if (!i.length) throw new Error("GLTF2: no primitives");
  return { primitives: i, boundingBox: pe(l), nodes: n, animations: s };
}
function Ye(r) {
  const e = new DataView(r);
  if (e.getUint32(0, !0) !== 1179937895) throw new Error("GLTF2: invalid GLB magic");
  if (e.getUint32(4, !0) !== 2) throw new Error("GLTF2: unsupported version");
  let t = 12;
  const o = e.getUint32(t, !0);
  t += 8;
  const i = JSON.parse(new TextDecoder().decode(new Uint8Array(r, t, o)));
  t += o;
  let a = new Uint8Array(0);
  if (t + 8 <= r.byteLength) {
    const n = e.getUint32(t, !0);
    t += 8, a = new Uint8Array(r, t, n);
  }
  return dt(i, a);
}
function _i(r, e) {
  const t = r;
  let o = 0;
  for (const s of e) o += s.byteLength;
  const i = new Uint8Array(o), a = [];
  let n = 0;
  for (const s of e)
    a.push(n), i.set(new Uint8Array(s), n), n += s.byteLength;
  if (t.bufferViews)
    for (const s of t.bufferViews)
      s.byteOffset = (s.byteOffset ?? 0) + (a[s.buffer] ?? 0), s.buffer = 0;
  return dt(t, i);
}
const Ze = (
  /* wgsl */
  `
${z}

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
  @location(2) texcoord: vec2<f32>,
  @location(3) worldPos: vec3<f32>,
  @location(4) scaleHeading: vec2<f32>,
  @location(5) pitchRollAnchor: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) vNormal: vec3<f32>,
  @location(1) vTexcoord: vec2<f32>,
  @location(2) vWorldPos: vec3<f32>,
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
  // glTF assets are Y-up by convention; mapgpu's model symbol math expects Z-up.
  let nodePosition = vec3<f32>(gltfPosition.x, -gltfPosition.z, gltfPosition.y);
  let nodeNormal = normalize(vec3<f32>(gltfNormal.x, -gltfNormal.z, gltfNormal.y));
  let rotMat = eulerToRotationMatrix(heading, pitch, roll);
  let mercatorScale = mercatorMetersPerMeter(input.worldPos.y);
  let rotated = rotMat * (nodePosition * (scale * mercatorScale));
  let relativeOrigin = input.worldPos - camera.worldOrigin.xyz;
  let projectedWorldPos = relativeOrigin + vec3<f32>(rotated.x, rotated.y, 0.0);
  let heightMeters = input.worldPos.z + anchorZ + rotated.z / max(mercatorScale, 0.01);
  let worldPos = vec3<f32>(projectedWorldPos.x, projectedWorldPos.y, heightMeters);

  output.clipPosition = camera.relativeViewProjection * vec4<f32>(projectedWorldPos, 1.0);
  let absH = abs(heightMeters);
  let logH = log2(max(absH, 0.1) + 1.0);
  let logMax = log2(1001.0);
  let normalizedZ = clamp(0.5 - logH / (2.0 * logMax), 0.01, 0.99);
  output.clipPosition.z = max(0.0, normalizedZ - 0.001) * output.clipPosition.w;
  output.vNormal = normalize(rotMat * nodeNormal);
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

fn mercatorMetersPerMeter(mercatorY: f32) -> f32 {
  let lat = atan(exp(mercatorY / EARTH_RADIUS_M)) * 2.0 - PI * 0.5;
  return 1.0 / max(cos(lat), 0.01);
}

@fragment
fn fs_main(input: VertexOutput, @builtin(front_facing) frontFacing: bool) -> @location(0) vec4<f32> {
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

  // Normal — flip for back-faces (doubleSided materials)
  var N = normalize(input.vNormal);
  if (!frontFacing) { N = -N; }

  if (material.hasNormalTex > 0.5) {
    let tangentNormal = textureSample(normalTex, texSampler, uv).rgb * 2.0 - 1.0;
    let dpdx_val = dpdx(input.vWorldPos);
    let dpdy_val = dpdy(input.vWorldPos);
    let dudx = dpdx(uv);
    let dvdy = dpdy(uv);
    let T = normalize(dpdx_val * dvdy.y - dpdy_val * dudx.y);
    let B = normalize(cross(N, T));
    let TBN = mat3x3<f32>(T, B, N);
    N = normalize(TBN * tangentNormal);
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
`
), qe = (
  /* wgsl */
  `
${N}
${q}

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
  @location(2) texcoord: vec2<f32>,
  @location(3) worldPos: vec3<f32>,
  @location(4) scaleHeading: vec2<f32>,
  @location(5) pitchRollAnchor: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) vNormal: vec3<f32>,
  @location(1) vTexcoord: vec2<f32>,
  @location(2) vGlobePos: vec3<f32>,
  @location(3) clipDot: f32,
  @location(4) vFlatPos: vec3<f32>,
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
  let nodePosition = vec3<f32>(gltfPosition.x, -gltfPosition.z, gltfPosition.y);
  let nodeNormal = normalize(vec3<f32>(gltfNormal.x, -gltfNormal.z, gltfNormal.y));
  let rotMat = eulerToRotationMatrix(heading, pitch, roll);

  // Globe model position
  let globeScale = scale / EARTH_RADIUS_M;
  let localOffset = tangentMatrix * (rotMat * (nodePosition * globeScale));
  let totalAlt = input.worldPos.z + anchorZ;
  let altFrac = totalAlt / EARTH_RADIUS_M * ALTITUDE_EXAG;
  let globeFinal = spherePos * (1.0 + altFrac) + localOffset;

  // STANDARD projection — NO depth override, NO globeClippingZ hack
  // GPU perspective depth handles model self-occlusion correctly.
  var globeClip = camera.viewProjection * vec4<f32>(globeFinal, 1.0);

  // Small depth bias so model renders above the globe surface tiles
  globeClip.z -= 0.0003 * globeClip.w;
  globeClip.z = min(globeClip.z, globeClip.w * 0.9999);

  // Flat path (for 2D↔3D transition)
  let flatMercatorScale = 1.0 / max(cos(angular.y), 0.01);
  let flatRotated = rotMat * (nodePosition * scale);
  let flatLocalScale = flatMercatorScale / (2.0 * HALF_CIRCUMFERENCE);
  let flatMerc = vec3<f32>(
    merc01.x + flatRotated.x * flatLocalScale,
    merc01.y - flatRotated.y * flatLocalScale,
    altitudeOffset(input.worldPos.z) + (flatRotated.z + anchorZ) * flatLocalScale
  );
  output.vFlatPos = flatMerc;
  var flatClip = camera.flatViewProjection * vec4<f32>(flatMerc, 1.0);

  // Blend globe ↔ flat
  var clipPos: vec4<f32>;
  if (camera.projectionTransition >= 0.999) {
    clipPos = globeClip;
  } else if (camera.projectionTransition <= 0.001) {
    clipPos = flatClip;
  } else {
    clipPos = mix(flatClip, globeClip, camera.projectionTransition);
  }

  output.clipPosition = clipPos;

  // Normal in globe tangent frame
  let globeNormal = normalize(tangentMatrix * (rotMat * nodeNormal));
  let flatNormal = normalize(rotMat * nodeNormal);
  if (camera.projectionTransition >= 0.999) {
    output.vNormal = globeNormal;
  } else if (camera.projectionTransition <= 0.001) {
    output.vNormal = flatNormal;
  } else {
    output.vNormal = normalize(mix(flatNormal, globeNormal, camera.projectionTransition));
  }

  output.vTexcoord = input.texcoord;
  output.vGlobePos = globeFinal;
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

@fragment
fn fs_main(input: VertexOutput, @builtin(front_facing) frontFacing: bool) -> @location(0) vec4<f32> {
  // Horizon occlusion
  if (camera.projectionTransition > 0.01 && input.clipDot < -0.01) { discard; }

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

  // Normal — flip for back-faces
  var N = normalize(input.vNormal);
  if (!frontFacing) { N = -N; }
  if (material.hasNormalTex > 0.5) {
    let tangentNormal = textureSample(normalTex, texSampler, uv).rgb * 2.0 - 1.0;
    var surfacePos = input.vFlatPos;
    if (camera.projectionTransition > 0.5) {
      surfacePos = input.vGlobePos;
    }
    let dpdx_val = dpdx(surfacePos);
    let dpdy_val = dpdy(surfacePos);
    let dudx = dpdx(uv);
    let dvdy = dpdy(uv);
    let T = normalize(dpdx_val * dvdy.y - dpdy_val * dudx.y);
    let B = normalize(cross(N, T));
    let TBN = mat3x3<f32>(T, B, N);
    N = normalize(TBN * tangentNormal);
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
`
), Fi = (
  /* wgsl */
  `
struct MipmapVertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@group(0) @binding(0) var mipSampler: sampler;
@group(0) @binding(1) var mipSource: texture_2d<f32>;

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> MipmapVertexOutput {
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0),
  );
  var uvs = array<vec2<f32>, 3>(
    vec2<f32>(0.0, 1.0),
    vec2<f32>(2.0, 1.0),
    vec2<f32>(0.0, -1.0),
  );

  var output: MipmapVertexOutput;
  output.clipPosition = vec4<f32>(positions[vertexIndex], 0.0, 1.0);
  output.uv = uvs[vertexIndex];
  return output;
}

@fragment
fn fs_main(input: MipmapVertexOutput) -> @location(0) vec4<f32> {
  return textureSampleLevel(mipSource, mipSampler, input.uv, 0.0);
}
`
);
function Z(r) {
  return [r[0], r[1], r[2]];
}
function Ke(r) {
  return [r[0], r[1], r[2], r[3]];
}
function Q(r) {
  return {
    min: Z(r.min),
    max: Z(r.max)
  };
}
function Be(r) {
  const e = Math.hypot(r[0], r[1], r[2], r[3]) || 1;
  return [r[0] / e, r[1] / e, r[2] / e, r[3] / e];
}
function W(r, e, t) {
  return r + (e - r) * t;
}
function Ri(r, e, t) {
  let o = r[0], i = r[1], a = r[2], n = r[3], s = e[0], l = e[1], c = e[2], p = e[3], u = o * s + i * l + a * c + n * p;
  if (u < 0 && (s = -s, l = -l, c = -c, p = -p, u = -u), u > 0.9995)
    return Be([
      W(o, s, t),
      W(i, l, t),
      W(a, c, t),
      W(n, p, t)
    ]);
  const d = Math.acos(Math.min(Math.max(u, -1), 1)), m = Math.sqrt(1 - u * u) || 1, f = Math.sin((1 - t) * d) / m, h = Math.sin(t * d) / m;
  return [
    o * f + s * h,
    i * f + l * h,
    a * f + c * h,
    n * f + p * h
  ];
}
function Ei(r) {
  return {
    ...r,
    localBounds: Q(r.localBounds),
    restLocalBounds: Q(r.restLocalBounds),
    currentLocalBounds: Q(r.currentLocalBounds)
  };
}
class Li {
  _device;
  _models = /* @__PURE__ */ new Map();
  _flatOpaquePipeline = null;
  _flatBlendPipeline = null;
  _globeOpaquePipeline = null;
  _globeBlendPipeline = null;
  _sampler = null;
  _materialLayout = null;
  _placeholderTexture = null;
  _mipmapBindGroupLayout = null;
  _mipmapSampler = null;
  _mipmapShaderModule = null;
  _mipmapPipelines = /* @__PURE__ */ new Map();
  constructor(e) {
    this._device = e;
  }
  // ─── Model Loading ───
  async loadModel(e, t) {
    if (this._models.has(e)) return;
    let o;
    if (t instanceof ArrayBuffer)
      o = Ye(t);
    else {
      const i = t;
      if (i.endsWith(".gltf") || i.includes(".gltf?")) {
        const a = i.substring(0, i.lastIndexOf("/") + 1), s = await (await fetch(i)).json(), l = s.buffers ?? [], c = await Promise.all(
          l.map(async (p) => {
            if (!p.uri) return new ArrayBuffer(p.byteLength);
            const u = p.uri.startsWith("data:") ? p.uri : a + p.uri;
            return (await fetch(u)).arrayBuffer();
          })
        );
        o = _i(s, c);
      } else {
        const a = await fetch(i);
        o = Ye(await a.arrayBuffer());
      }
    }
    await this._uploadModel(e, o);
  }
  has(e) {
    return this._models.has(e);
  }
  getBoundingBox(e) {
    const t = this._models.get(e)?.metadata;
    return t ? Q(t.localBounds) : null;
  }
  getGroundAnchorUnits(e) {
    return this._models.get(e)?.metadata.groundAnchorLocalZ ?? null;
  }
  getModelMetadata(e) {
    const t = this._models.get(e)?.metadata;
    return t ? Ei(t) : null;
  }
  resolveModelBounds(e) {
    const t = this._models.get(e.modelId)?.metadata;
    return t ? wi(t, e) : null;
  }
  isAnimated(e) {
    return this._models.get(e)?.animations.some((t) => t.duration > 0 && t.channels.length > 0) ?? !1;
  }
  syncAnimationState(e, t) {
    const o = this._models.get(e);
    o && this._updateAnimations(o, t);
  }
  // ─── Drawing ───
  drawFlat(e, t, o, i, a, n, s, l) {
    const c = this._models.get(s);
    if (!c) return;
    this._updateAnimations(c, l);
    const p = this._ensureFlatPipeline(i, a, n, !1), u = c.primitives.some((d) => d.alphaMode === "BLEND") ? this._ensureFlatPipeline(i, a, n, !0) : null;
    this._drawPrimitives(e, c, t, o, p, u);
  }
  drawGlobe(e, t, o, i, a, n, s, l) {
    const c = this._models.get(s);
    if (!c) return;
    this._updateAnimations(c, l);
    const p = this._ensureGlobePipeline(i, a, n, !1), u = c.primitives.some((d) => d.alphaMode === "BLEND") ? this._ensureGlobePipeline(i, a, n, !0) : null;
    this._drawPrimitives(e, c, t, o, p, u);
  }
  destroy() {
    for (const e of this._models.values())
      for (const t of e.primitives) {
        t.vertexBuffer.destroy(), t.indexBuffer.destroy(), t.materialBuffer.destroy();
        for (const o of t.ownedTextures)
          o.destroy();
      }
    this._models.clear(), this._placeholderTexture?.destroy();
  }
  // ─── Private: Upload ───
  async _uploadModel(e, t) {
    const o = [];
    for (let c = 0; c < t.primitives.length; c++) {
      const p = t.primitives[c], u = await this._uploadPrimitive(e, p, c);
      o.push(u);
    }
    const i = t.primitives.map((c) => ({
      bounds: Q(c.mesh.bounds),
      nodeIndex: c.nodeIndex ?? null
    })), a = Te(
      t.nodes,
      t.nodes.map((c) => Z(c.translation)),
      t.nodes.map((c) => Ke(c.rotation)),
      t.nodes.map((c) => Z(c.scale))
    ), n = Xe(i, a.worldMatrices), s = $e(
      n,
      n,
      t.animations.some((c) => c.duration > 0 && c.channels.length > 0),
      t.nodes.some((c) => c.parentIndex !== null || c.children.length > 0)
    ), l = {
      primitives: o,
      primitiveBounds: i,
      nodes: t.nodes,
      animations: t.animations,
      lastAnimationTime: null,
      metadata: s,
      worldMatrices: a.worldMatrices,
      normalMatrices: a.normalMatrices
    };
    this._writePrimitiveMatrices(l), this._models.set(e, l);
  }
  async _uploadPrimitive(e, t, o) {
    const { mesh: i, material: a } = t, n = this._device, s = 8, l = new Float32Array(i.vertexCount * s);
    for (let M = 0; M < i.vertexCount; M++) {
      const _ = M * s, G = M * 3, L = M * 2;
      l[_] = i.positions[G], l[_ + 1] = i.positions[G + 1], l[_ + 2] = i.positions[G + 2], l[_ + 3] = i.normals[G], l[_ + 4] = i.normals[G + 1], l[_ + 5] = i.normals[G + 2], l[_ + 6] = i.texcoords[L], l[_ + 7] = i.texcoords[L + 1];
    }
    const c = n.createBuffer({
      label: `gltf2-vb-${e}-${o}`,
      size: l.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: !0
    });
    new Float32Array(c.getMappedRange()).set(l), c.unmap();
    const p = i.indices, u = p instanceof Uint32Array ? "uint32" : "uint16", d = Math.ceil(p.byteLength / 4) * 4, m = n.createBuffer({
      label: `gltf2-ib-${e}-${o}`,
      size: Math.max(d, 4),
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: !0
    }), f = m.getMappedRange(0, Math.max(d, 4));
    p instanceof Uint32Array ? new Uint32Array(f).set(p) : new Uint16Array(f).set(p), m.unmap();
    const h = new Float32Array(52);
    h[0] = a.baseColorFactor[0], h[1] = a.baseColorFactor[1], h[2] = a.baseColorFactor[2], h[3] = a.baseColorFactor[3], h[4] = 1, h[5] = 1, h[6] = 1, h[7] = 1, h[8] = a.emissiveFactor[0], h[9] = a.emissiveFactor[1], h[10] = a.emissiveFactor[2], h[11] = a.metallicFactor, h[12] = a.roughnessFactor, h[13] = a.baseColorTexture ? 1 : 0, h[14] = a.normalTexture ? 1 : 0, h[15] = a.metallicRoughnessTexture ? 1 : 0, h[16] = a.occlusionTexture ? 1 : 0, h[17] = a.emissiveTexture ? 1 : 0, h[18] = a.alphaMode === "MASK" ? a.alphaCutoff : a.alphaMode === "OPAQUE" ? -1 : 0, h[19] = a.unlit ? 1 : 0;
    const x = new Float32Array([
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1
    ]);
    je(h, 20, x, x);
    const g = n.createBuffer({
      label: `gltf2-mat-${e}-${o}`,
      size: h.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    n.queue.writeBuffer(g, 0, h);
    const b = this._getPlaceholder(), v = this._getSampler(), P = this._getMaterialLayout(), C = [], S = async (M, _) => {
      if (!M) return b;
      try {
        const G = new ArrayBuffer(M.data.byteLength);
        new Uint8Array(G).set(M.data);
        const L = new Blob([G], { type: M.mimeType }), j = await createImageBitmap(L), X = this._createTextureWithMipmaps(`gltf2-tex-${e}-${o}-${_}`, j, this._getTextureFormat(_));
        return j.close(), C.push(X), X;
      } catch {
        return b;
      }
    }, R = await S(a.baseColorTexture, "baseColor"), y = await S(a.normalTexture, "normal"), w = await S(a.metallicRoughnessTexture, "metallicRoughness"), B = await S(a.occlusionTexture, "occlusion"), T = await S(a.emissiveTexture, "emissive"), F = n.createBindGroup({
      label: `gltf2-bg-${e}-${o}`,
      layout: P,
      entries: [
        { binding: 0, resource: { buffer: g } },
        { binding: 1, resource: v },
        { binding: 2, resource: R.createView() },
        { binding: 3, resource: y.createView() },
        { binding: 4, resource: w.createView() },
        { binding: 5, resource: B.createView() },
        { binding: 6, resource: T.createView() }
      ]
    });
    return {
      vertexBuffer: c,
      indexBuffer: m,
      indexFormat: u,
      indexCount: i.indexCount,
      vertexCount: i.vertexCount,
      materialBuffer: g,
      materialData: h,
      materialBindGroup: F,
      alphaMode: a.alphaMode,
      ownedTextures: C,
      doubleSided: a.doubleSided,
      nodeIndex: t.nodeIndex ?? null
    };
  }
  // ─── Private: Draw ───
  _drawPrimitives(e, t, o, i, a, n) {
    e.setBindGroup(0, i);
    let s = null;
    const l = (c, p) => {
      s !== p && (e.setPipeline(p), s = p), e.setBindGroup(1, c.materialBindGroup), e.setVertexBuffer(0, c.vertexBuffer), e.setVertexBuffer(1, o.instanceBuffer), e.setIndexBuffer(c.indexBuffer, c.indexFormat), e.drawIndexed(c.indexCount, o.instanceCount);
    };
    for (const c of t.primitives)
      c.alphaMode !== "BLEND" && l(c, a);
    if (n)
      for (const c of t.primitives)
        c.alphaMode === "BLEND" && l(c, n);
  }
  _updateAnimations(e, t) {
    if (e.animations.length === 0 || e.lastAnimationTime !== null && Math.abs(e.lastAnimationTime - t) < 1e-6) return;
    e.lastAnimationTime = t;
    const o = e.nodes.map((s) => Z(s.translation)), i = e.nodes.map((s) => Ke(s.rotation)), a = e.nodes.map((s) => Z(s.scale));
    for (const s of e.animations) {
      const l = s.duration > 0 ? t % s.duration : 0;
      for (const c of s.channels)
        this._applyAnimationChannel(c, l, o, i, a);
    }
    const n = Te(e.nodes, o, i, a);
    e.worldMatrices = n.worldMatrices, e.normalMatrices = n.normalMatrices, e.metadata = $e(
      e.metadata.restLocalBounds,
      Xe(e.primitiveBounds, e.worldMatrices),
      e.metadata.isAnimated,
      e.metadata.hasHierarchy
    ), this._writePrimitiveMatrices(e);
  }
  _writePrimitiveMatrices(e) {
    for (const t of e.primitives) {
      const o = t.nodeIndex === null ? new Float32Array([
        1,
        0,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        1
      ]) : e.worldMatrices[t.nodeIndex] ?? new Float32Array([
        1,
        0,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        1
      ]), i = t.nodeIndex === null ? o : e.normalMatrices[t.nodeIndex] ?? o;
      je(t.materialData, 20, o, i), this._device.queue.writeBuffer(
        t.materialBuffer,
        0,
        t.materialData.buffer,
        t.materialData.byteOffset,
        t.materialData.byteLength
      );
    }
  }
  _applyAnimationChannel(e, t, o, i, a) {
    const n = e.node, { input: s, output: l } = e;
    if (n < 0 || n >= o.length || s.length === 0) return;
    const c = e.path === "rotation" ? 4 : 3;
    let p = 0;
    for (; p + 1 < s.length && t >= s[p + 1]; )
      p++;
    const u = Math.min(p + 1, s.length - 1), d = s[p] ?? 0, m = s[u] ?? d, f = e.interpolation === "STEP" || u === p || m <= d ? 0 : (t - d) / (m - d), h = (v) => {
      const P = v * c;
      return Array.from(l.subarray(P, P + c));
    };
    if (e.path === "rotation") {
      const v = h(p), P = h(u);
      i[n] = Be(f === 0 ? v : Ri(v, P, f));
      return;
    }
    const x = h(p), g = h(u), b = f === 0 ? [x[0], x[1], x[2]] : [
      W(x[0], g[0], f),
      W(x[1], g[1], f),
      W(x[2], g[2], f)
    ];
    e.path === "translation" ? o[n] = b : a[n] = b;
  }
  // ─── Private: Pipeline Creation ───
  _ensureFlatPipeline(e, t, o, i) {
    return i ? this._flatBlendPipeline ? this._flatBlendPipeline : (this._flatBlendPipeline = this._createPipeline("gltf2-flat-blend", Ze, e, t, o, !0), this._flatBlendPipeline) : this._flatOpaquePipeline ? this._flatOpaquePipeline : (this._flatOpaquePipeline = this._createPipeline("gltf2-flat-opaque", Ze, e, t, o, !1), this._flatOpaquePipeline);
  }
  _ensureGlobePipeline(e, t, o, i) {
    return i ? this._globeBlendPipeline ? this._globeBlendPipeline : (this._globeBlendPipeline = this._createPipeline("gltf2-globe-blend", qe, e, t, o, !0), this._globeBlendPipeline) : this._globeOpaquePipeline ? this._globeOpaquePipeline : (this._globeOpaquePipeline = this._createPipeline("gltf2-globe-opaque", qe, e, t, o, !1), this._globeOpaquePipeline);
  }
  _createPipeline(e, t, o, i, a, n) {
    const s = this._device, l = this._getMaterialLayout(), c = s.createShaderModule({ label: `${e}-shader`, code: t });
    return s.createRenderPipeline({
      label: e,
      layout: s.createPipelineLayout({
        label: `${e}-layout`,
        bindGroupLayouts: [o, l]
      }),
      vertex: {
        module: c,
        entryPoint: "vs_main",
        buffers: [
          // Slot 0: mesh vertex data (interleaved, 32 bytes/vertex)
          {
            arrayStride: 32,
            stepMode: "vertex",
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x3" },
              { shaderLocation: 1, offset: 12, format: "float32x3" },
              { shaderLocation: 2, offset: 24, format: "float32x2" }
            ]
          },
          // Slot 1: instance data (32 bytes/instance) — same layout as existing ModelRenderBuffer
          {
            arrayStride: 32,
            stepMode: "instance",
            attributes: [
              { shaderLocation: 3, offset: 0, format: "float32x3" },
              { shaderLocation: 4, offset: 12, format: "float32x2" },
              { shaderLocation: 5, offset: 20, format: "float32x3" }
            ]
          }
        ]
      },
      fragment: {
        module: c,
        entryPoint: "fs_main",
        targets: [{
          format: i,
          blend: n ? {
            color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
            alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
          } : void 0
        }]
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none"
        // doubleSided handled by front_facing in shader
      },
      depthStencil: {
        format: a,
        depthWriteEnabled: !n,
        depthCompare: "less"
        // Standard depth test — NO custom override
      },
      multisample: { count: E }
    });
  }
  _getTextureFormat(e) {
    return e === "baseColor" || e === "emissive" ? "rgba8unorm-srgb" : "rgba8unorm";
  }
  _createTextureWithMipmaps(e, t, o) {
    const i = Math.floor(Math.log2(Math.max(t.width, t.height))) + 1, a = this._device.createTexture({
      label: e,
      size: { width: t.width, height: t.height },
      mipLevelCount: i,
      format: o,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });
    return this._device.queue.copyExternalImageToTexture(
      { source: t },
      { texture: a },
      { width: t.width, height: t.height }
    ), i > 1 && this._generateMipmaps(a, o, i), a;
  }
  _generateMipmaps(e, t, o) {
    const i = this._getMipmapPipeline(t), a = this._getMipmapBindGroupLayout(), n = this._getMipmapSampler(), s = this._device.createCommandEncoder({ label: "gltf2-mipmap-encoder" });
    for (let l = 1; l < o; l++) {
      const c = e.createView({ baseMipLevel: l - 1, mipLevelCount: 1 }), p = e.createView({ baseMipLevel: l, mipLevelCount: 1 }), u = this._device.createBindGroup({
        label: `gltf2-mipmap-bind-group-${l}`,
        layout: a,
        entries: [
          { binding: 0, resource: n },
          { binding: 1, resource: c }
        ]
      }), d = s.beginRenderPass({
        colorAttachments: [{
          view: p,
          loadOp: "clear",
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          storeOp: "store"
        }]
      });
      d.setPipeline(i), d.setBindGroup(0, u), d.draw(3), d.end();
    }
    this._device.queue.submit([s.finish()]);
  }
  _getMipmapPipeline(e) {
    const t = this._mipmapPipelines.get(e);
    if (t) return t;
    const o = this._device.createRenderPipeline({
      label: `gltf2-mipmap-${e}`,
      layout: this._device.createPipelineLayout({
        label: `gltf2-mipmap-layout-${e}`,
        bindGroupLayouts: [this._getMipmapBindGroupLayout()]
      }),
      vertex: {
        module: this._getMipmapShaderModule(),
        entryPoint: "vs_main"
      },
      fragment: {
        module: this._getMipmapShaderModule(),
        entryPoint: "fs_main",
        targets: [{ format: e }]
      },
      primitive: {
        topology: "triangle-list"
      }
    });
    return this._mipmapPipelines.set(e, o), o;
  }
  _getMipmapBindGroupLayout() {
    return this._mipmapBindGroupLayout ? this._mipmapBindGroupLayout : (this._mipmapBindGroupLayout = this._device.createBindGroupLayout({
      label: "gltf2-mipmap-bind-group-layout",
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } }
      ]
    }), this._mipmapBindGroupLayout);
  }
  _getMipmapShaderModule() {
    return this._mipmapShaderModule ? this._mipmapShaderModule : (this._mipmapShaderModule = this._device.createShaderModule({
      label: "gltf2-mipmap-shader",
      code: Fi
    }), this._mipmapShaderModule);
  }
  _getMipmapSampler() {
    return this._mipmapSampler ? this._mipmapSampler : (this._mipmapSampler = this._device.createSampler({
      label: "gltf2-mipmap-sampler",
      minFilter: "linear",
      magFilter: "linear",
      mipmapFilter: "linear",
      maxAnisotropy: 8,
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge"
    }), this._mipmapSampler);
  }
  // ─── Private: Shared Resources ───
  _getPlaceholder() {
    return this._placeholderTexture ? this._placeholderTexture : (this._placeholderTexture = this._device.createTexture({
      label: "gltf2-placeholder",
      size: { width: 1, height: 1 },
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    }), this._device.queue.writeTexture(
      { texture: this._placeholderTexture },
      new Uint8Array([255, 255, 255, 255]),
      { bytesPerRow: 4 },
      { width: 1, height: 1 }
    ), this._placeholderTexture);
  }
  _getSampler() {
    return this._sampler ? this._sampler : (this._sampler = this._device.createSampler({
      label: "gltf2-sampler",
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
      maxAnisotropy: 8,
      addressModeU: "repeat",
      addressModeV: "repeat"
    }), this._sampler);
  }
  _getMaterialLayout() {
    return this._materialLayout ? this._materialLayout : (this._materialLayout = this._device.createBindGroupLayout({
      label: "gltf2-material-layout",
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
        { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
        { binding: 5, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
        { binding: 6, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } }
      ]
    }), this._materialLayout);
  }
}
const Di = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  Gltf2Renderer: Li
}, Symbol.toStringTag, { value: "Module" })), Se = 20037508342789244e-9;
function Ai(r, e, t, o, i) {
  const a = r.length / 2;
  if (a === 0)
    return { entries: [], membership: [] };
  const n = e > 0 ? e : 60, s = 2 * Se / (256 * Math.pow(2, t)), l = n * s, c = l * l, p = o[0] - l, u = o[1] - l, d = o[2] + l, m = o[3] + l, f = /* @__PURE__ */ new Map();
  for (let y = 0; y < a; y++) {
    const w = r[y * 2], B = r[y * 2 + 1];
    if (w < p || w > d || B < u || B > m)
      continue;
    const T = Math.floor((w + Se) / l), F = Math.floor((B + Se) / l);
    if (!Number.isFinite(T) || !Number.isFinite(F))
      continue;
    const M = `${T},${F}`;
    let _ = f.get(M);
    _ || (_ = { cellX: T, cellY: F, sumX: 0, sumY: 0, count: 0, members: [] }, f.set(M, _)), _.sumX += w, _.sumY += B, _.count++, _.members.push(y);
  }
  if (f.size === 0)
    return { entries: [], membership: [] };
  const h = Array.from(f.values());
  h.sort((y, w) => y.cellY - w.cellY || y.cellX - w.cellX);
  const x = /* @__PURE__ */ new Map();
  for (let y = 0; y < h.length; y++) {
    const w = h[y];
    x.set(`${w.cellX},${w.cellY}`, y);
  }
  const g = new Ui(h.length), b = new Float64Array(h.length), v = new Float64Array(h.length);
  for (let y = 0; y < h.length; y++) {
    const w = h[y];
    b[y] = w.sumX / w.count, v[y] = w.sumY / w.count;
  }
  for (let y = 0; y < h.length; y++) {
    const w = h[y];
    for (let B = w.cellY - 1; B <= w.cellY + 1; B++)
      for (let T = w.cellX - 1; T <= w.cellX + 1; T++) {
        if (T < w.cellX || T === w.cellX && B <= w.cellY) continue;
        const F = x.get(`${T},${B}`);
        if (F === void 0 || F <= y) continue;
        const M = b[y] - b[F], _ = v[y] - v[F];
        M * M + _ * _ <= c && g.union(y, F);
      }
  }
  const P = /* @__PURE__ */ new Map();
  for (let y = 0; y < h.length; y++) {
    const w = g.find(y), B = h[y];
    let T = P.get(w);
    T || (T = { sumX: 0, sumY: 0, count: 0, members: [], minMember: 1 / 0 }, P.set(w, T)), T.sumX += B.sumX, T.sumY += B.sumY, T.count += B.count, T.members.push(...B.members);
    for (const F of B.members)
      F < T.minMember && (T.minMember = F);
  }
  const C = Array.from(P.values());
  C.sort((y, w) => y.minMember - w.minMember);
  const S = [], R = [];
  for (const y of C) {
    if (y.count >= i) {
      const B = y.sumX / y.count, T = y.sumY / y.count, F = y.members.slice().sort((_, G) => _ - G);
      let M = 0;
      M = 1, y.count >= 100 ? M |= 4 : y.count >= 10 && (M |= 2), S.push({ posX: B, posY: T, count: y.count, flags: M }), R.push(F);
      continue;
    }
    const w = y.members.slice().sort((B, T) => B - T);
    for (const B of w) {
      const T = r[B * 2], F = r[B * 2 + 1];
      S.push({ posX: T, posY: F, count: 1, flags: 0 }), R.push([B]);
    }
  }
  return { entries: S, membership: R };
}
class Ui {
  parent;
  rank;
  constructor(e) {
    this.parent = new Int32Array(e), this.rank = new Uint8Array(e);
    for (let t = 0; t < e; t++)
      this.parent[t] = t;
  }
  find(e) {
    let t = e;
    for (; this.parent[t] !== t; )
      t = this.parent[t];
    let o = e;
    for (; this.parent[o] !== o; ) {
      const i = this.parent[o];
      this.parent[o] = t, o = i;
    }
    return t;
  }
  union(e, t) {
    let o = this.find(e), i = this.find(t);
    if (o === i) return;
    const a = this.rank[o], n = this.rank[i];
    a < n && ([o, i] = [i, o]), this.parent[i] = o, a === n && (this.rank[o] = a + 1);
  }
}
function zi(r) {
  const e = new Float32Array(r.length * 4), t = new Uint32Array(e.buffer);
  for (let o = 0; o < r.length; o++) {
    const i = r[o], a = o * 4;
    e[a] = i.posX, e[a + 1] = i.posY, t[a + 2] = i.count, t[a + 3] = i.flags;
  }
  return e;
}
const Vi = (
  /* wgsl */
  `

${z}

struct ClusterOutput {
  posX: f32,
  posY: f32,
  count: u32,
  flags: u32,
};

struct ClusterMaterial {
  clusterFillSmall: vec4<f32>,
  clusterFillMedium: vec4<f32>,
  clusterFillLarge: vec4<f32>,
  clusterStroke: vec4<f32>,
  clusterText: vec4<f32>,
  pointFill: vec4<f32>,
  pointStroke: vec4<f32>,
  pointSize: f32,
  pointStrokeWidth: f32,
  clusterBaseSize: f32,
  clusterGrowRate: f32,
  clusterStrokeWidth: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
};

@group(1) @binding(0) var<storage, read> clusters: array<ClusterOutput>;
@group(1) @binding(1) var<uniform> material: ClusterMaterial;
@group(1) @binding(2) var digitAtlasTex: texture_2d<f32>;
@group(1) @binding(3) var digitSampler: sampler;

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) @interpolate(flat) instanceIdx: u32,
};

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32,
) -> VertexOutput {
  var quadOffsets = array<vec2<f32>, 6>(
    vec2<f32>(-0.5, -0.5),
    vec2<f32>( 0.5, -0.5),
    vec2<f32>(-0.5,  0.5),
    vec2<f32>(-0.5,  0.5),
    vec2<f32>( 0.5, -0.5),
    vec2<f32>( 0.5,  0.5),
  );

  let inst = clusters[iid];
  let isCluster = (inst.flags & 1u) != 0u;

  var pixelSize: f32;
  if (isCluster) {
    let tier = min(f32((inst.flags >> 1u) & 3u), 2.0);
    pixelSize = material.clusterBaseSize + material.clusterGrowRate * tier;
  } else {
    pixelSize = material.pointSize;
  }

  let offset = quadOffsets[vid];
  let uv = offset + vec2<f32>(0.5, 0.5);

  let clipCenter = camera.viewProjection * vec4<f32>(inst.posX, inst.posY, 0.0, 1.0);

  let screenOffset = offset * pixelSize;
  let ndcOffset = vec2<f32>(
    screenOffset.x * 2.0 / camera.viewport.x,
    screenOffset.y * 2.0 / camera.viewport.y,
  );

  var out: VertexOutput;
  out.clipPosition = vec4<f32>(
    clipCenter.x + ndcOffset.x * clipCenter.w,
    clipCenter.y + ndcOffset.y * clipCenter.w,
    clipCenter.z,
    clipCenter.w,
  );
  out.uv = uv;
  out.instanceIdx = iid;
  return out;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let inst = clusters[input.instanceIdx];
  let isCluster = (inst.flags & 1u) != 0u;

  let centered = input.uv - vec2<f32>(0.5, 0.5);
  let dist = length(centered);

  // ── Uniform control flow zone ──────────────────────────────────
  // fwidth + textureSample MUST be called before any non-uniform branch.
  let aa = fwidth(dist);

  // Digit atlas UV (computed unconditionally; result ignored for points)
  let count = inst.count;
  let digitCount = getDigitCount(count);
  let digitCountF = f32(max(digitCount, 1u));
  let textHeight = 0.54;
  let maxTotalWidth = 0.78;
  let naturalDigitWidth = textHeight * 0.52;
  let digitWidth = min(naturalDigitWidth, maxTotalWidth / digitCountF);
  let totalWidth = digitCountF * digitWidth;
  let startU = 0.5 - totalWidth * 0.5;
  let localU = input.uv.x;
  let localV = input.uv.y;
  let rawDigitIdx = (localU - startU) / digitWidth;
  let digitIdx = u32(max(rawDigitIdx, 0.0));
  let safeDigitIdx = min(digitIdx, max(digitCount, 1u) - 1u);
  let digit = getDigitAt(count, digitCount, safeDigitIdx);
  let withinU = fract(max(rawDigitIdx, 0.0));
  let vMin = 0.5 - textHeight * 0.5;
  let vMax = 0.5 + textHeight * 0.5;
  let withinV = clamp((localV - vMin) / textHeight, 0.0, 1.0);
  // Remove side-bearings inside each digit cell to tighten inter-digit spacing.
  let glyphCropMin = 0.18;
  let glyphCropMax = 0.82;
  let atlasDigitU = glyphCropMin + withinU * (glyphCropMax - glyphCropMin);
  let atlasU = (f32(digit) + atlasDigitU) / 10.0;
  let atlasV = withinV;
  let texColor = textureSample(digitAtlasTex, digitSampler, vec2<f32>(atlasU, atlasV));
  // ── End uniform zone ───────────────────────────────────────────

  // SDF circle — discard outside radius (uniform: depends only on UV)
  if (dist > 0.5) {
    discard;
  }

  // ── Non-uniform branching (safe — special ops already computed) ──
  if (!isCluster) {
    let strokeFrac = clamp(material.pointStrokeWidth / max(material.pointSize, 1.0), 0.0, 0.49);
    let inner = 0.5 - strokeFrac;
    let fillMix = 1.0 - smoothstep(inner - aa, inner, dist);
    let edgeAlpha = 1.0 - smoothstep(0.5 - aa, 0.5, dist);
    let color = mix(material.pointStroke, material.pointFill, fillMix);
    return vec4<f32>(color.rgb, color.a * edgeAlpha);
  }

  // Cluster circle — tier fill + stroke
  let tier = (inst.flags >> 1u) & 3u;
  var fillColor: vec4<f32>;
  if (tier >= 2u) {
    fillColor = material.clusterFillLarge;
  } else if (tier >= 1u) {
    fillColor = material.clusterFillMedium;
  } else {
    fillColor = material.clusterFillSmall;
  }

  let clusterTier = min(f32((inst.flags >> 1u) & 3u), 2.0);
  let clusterPixelSize = material.clusterBaseSize + material.clusterGrowRate * clusterTier;
  let strokeFrac = clamp(material.clusterStrokeWidth / max(clusterPixelSize, 1.0), 0.0, 0.49);
  let inner = 0.5 - strokeFrac;
  let fillMix = 1.0 - smoothstep(inner - aa, inner, dist);
  let edgeAlpha = 1.0 - smoothstep(0.5 - aa, 0.5, dist);
  let circleColor = mix(material.clusterStroke, fillColor, fillMix);

  let inDigitRegion = step(vMin, localV) * step(localV, vMax)
                    * step(startU, localU) * step(localU, startU + totalWidth)
                    * step(f32(digitIdx), f32(digitCount) - 0.5);
  let textAlpha = texColor.a * inDigitRegion * material.clusterText.a;

  let finalColor = mix(circleColor.rgb, material.clusterText.rgb, textAlpha);
  return vec4<f32>(finalColor, circleColor.a * edgeAlpha);
}

// ─── Digit Helpers ───

fn getDigitCount(n: u32) -> u32 {
  if (n >= 100000u) { return 6u; }
  if (n >= 10000u) { return 5u; }
  if (n >= 1000u) { return 4u; }
  if (n >= 100u) { return 3u; }
  if (n >= 10u) { return 2u; }
  return 1u;
}

fn getDigitAt(n: u32, digitCount: u32, idx: u32) -> u32 {
  // idx 0 = most significant digit
  var divisor = 1u;
  for (var i = 0u; i < digitCount - 1u - idx; i = i + 1u) {
    divisor = divisor * 10u;
  }
  return (n / divisor) % 10u;
}
`
);
function Oi(r) {
  return r.createBindGroupLayout({
    label: "cluster-render-bind-group-layout",
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } },
      { binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: {} }
    ]
  });
}
function Ii(r) {
  const { device: e, colorFormat: t, cameraBindGroupLayout: o } = r, i = Oi(e), a = e.createShaderModule({
    label: "cluster-render-shader",
    code: Vi
  }), n = e.createPipelineLayout({
    label: "cluster-render-pipeline-layout",
    bindGroupLayouts: [o, i]
  }), s = e.createRenderPipeline({
    label: "cluster-render-pipeline",
    layout: n,
    vertex: {
      module: a,
      entryPoint: "vs_main",
      buffers: []
      // No vertex buffers — all data from storage buffer
    },
    fragment: {
      module: a,
      entryPoint: "fs_main",
      targets: [{
        format: t,
        blend: {
          color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
          alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" }
        }
      }]
    },
    primitive: { topology: "triangle-list" },
    depthStencil: {
      format: r.depthFormat ?? "depth24plus",
      depthWriteEnabled: !0,
      depthCompare: r.depthCompare ?? "less"
    },
    multisample: {
      count: r.sampleCount ?? E
    }
  }), l = e.createSampler({
    label: "cluster-digit-sampler",
    magFilter: "linear",
    minFilter: "linear",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge"
  });
  return { pipeline: s, renderBindGroupLayout: i, sampler: l };
}
const Ni = (
  /* wgsl */
  `

${N}

struct ClusterOutput {
  posX: f32,
  posY: f32,
  count: u32,
  flags: u32,
};

struct ClusterMaterial {
  clusterFillSmall: vec4<f32>,
  clusterFillMedium: vec4<f32>,
  clusterFillLarge: vec4<f32>,
  clusterStroke: vec4<f32>,
  clusterText: vec4<f32>,
  pointFill: vec4<f32>,
  pointStroke: vec4<f32>,
  pointSize: f32,
  pointStrokeWidth: f32,
  clusterBaseSize: f32,
  clusterGrowRate: f32,
  clusterStrokeWidth: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
};

@group(1) @binding(0) var<storage, read> clusters: array<ClusterOutput>;
@group(1) @binding(1) var<uniform> material: ClusterMaterial;
@group(1) @binding(2) var digitAtlasTex: texture_2d<f32>;
@group(1) @binding(3) var digitSampler: sampler;

// Base depth offset. Large clusters need extra lift to avoid intersecting
// curved globe depth near the horizon (prevents "half-circle" clipping).
const LAYER_DEPTH_OFFSET_BASE: f32 = 0.001;

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) @interpolate(flat) instanceIdx: u32,
  @location(2) clipDot: f32,
};

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32,
) -> VertexOutput {
  var quadOffsets = array<vec2<f32>, 6>(
    vec2<f32>(-0.5, -0.5),
    vec2<f32>( 0.5, -0.5),
    vec2<f32>(-0.5,  0.5),
    vec2<f32>(-0.5,  0.5),
    vec2<f32>( 0.5, -0.5),
    vec2<f32>( 0.5,  0.5),
  );

  let inst = clusters[iid];
  let isCluster = (inst.flags & 1u) != 0u;

  var pixelSize: f32;
  if (isCluster) {
    let tier = min(f32((inst.flags >> 1u) & 3u), 2.0);
    pixelSize = material.clusterBaseSize + material.clusterGrowRate * tier;
  } else {
    pixelSize = material.pointSize;
  }

  let offset = quadOffsets[vid];
  let uv = offset + vec2<f32>(0.5, 0.5);

  // EPSG:3857 → Mercator [0..1] → angular → sphere
  let merc01 = epsg3857ToMerc01(vec3<f32>(inst.posX, inst.posY, 0.0));
  let ang = mercatorToAngular(merc01);
  let spherePos = angularToSphere(ang.x, ang.y);

  // Horizon dot product (passed to fragment for discard)
  let clipDot = dot(spherePos, camera.clippingPlane.xyz) + camera.clippingPlane.w;

  // Globe clip position
  var globeClip = camera.viewProjection * vec4<f32>(spherePos, 1.0);
  let clipZ = globeClippingZ(spherePos);
  globeClip.z = clipZ * globeClip.w;

  // Flat clip position (for transition blend)
  let flatClip = camera.flatViewProjection * vec4<f32>(merc01.x, merc01.y, 0.0, 1.0);

  // Blend based on projection transition
  var clipCenter: vec4<f32>;
  if (camera.projectionTransition >= 0.999) {
    clipCenter = globeClip;
  } else if (camera.projectionTransition <= 0.001) {
    clipCenter = flatClip;
  } else {
    clipCenter = mix(flatClip, globeClip, camera.projectionTransition);
  }

  // Depth offset + clamping (match other globe pipelines)
  // Size-aware offset keeps bigger billboards fully in front of globe depth.
  let layerDepthOffset = LAYER_DEPTH_OFFSET_BASE + pixelSize * 0.00006;
  let adjustedZ = clipCenter.z - layerDepthOffset * clipCenter.w;
  let clampedZ = min(adjustedZ, clipCenter.w * 0.9999);

  // Billboard offset in screen space
  let screenOffset = offset * pixelSize;
  let ndcOffset = vec2<f32>(
    screenOffset.x * 2.0 / camera.viewport.x,
    screenOffset.y * 2.0 / camera.viewport.y,
  );

  var out: VertexOutput;
  out.clipPosition = vec4<f32>(
    clipCenter.x + ndcOffset.x * clipCenter.w,
    clipCenter.y + ndcOffset.y * clipCenter.w,
    clampedZ,
    clipCenter.w,
  );
  out.uv = uv;
  out.instanceIdx = iid;
  out.clipDot = clipDot;
  return out;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let inst = clusters[input.instanceIdx];
  let isCluster = (inst.flags & 1u) != 0u;

  let centered = input.uv - vec2<f32>(0.5, 0.5);
  let dist = length(centered);

  // ── Uniform control flow zone ──────────────────────────────────
  // fwidth + textureSample MUST be called before any non-uniform branch.
  let aa = fwidth(dist);

  // Digit atlas UV (computed unconditionally; result ignored for points)
  let count = inst.count;
  let digitCount = getDigitCount(count);
  let digitCountF = f32(max(digitCount, 1u));
  let textHeight = 0.54;
  let maxTotalWidth = 0.78;
  let naturalDigitWidth = textHeight * 0.52;
  let digitWidth = min(naturalDigitWidth, maxTotalWidth / digitCountF);
  let totalWidth = digitCountF * digitWidth;
  let startU = 0.5 - totalWidth * 0.5;
  let localU = input.uv.x;
  let localV = input.uv.y;
  let rawDigitIdx = (localU - startU) / digitWidth;
  let digitIdx = u32(max(rawDigitIdx, 0.0));
  let safeDigitIdx = min(digitIdx, max(digitCount, 1u) - 1u);
  let digit = getDigitAt(count, digitCount, safeDigitIdx);
  let withinU = fract(max(rawDigitIdx, 0.0));
  let vMin = 0.5 - textHeight * 0.5;
  let vMax = 0.5 + textHeight * 0.5;
  let withinV = clamp((localV - vMin) / textHeight, 0.0, 1.0);
  // Remove side-bearings inside each digit cell to tighten inter-digit spacing.
  let glyphCropMin = 0.18;
  let glyphCropMax = 0.82;
  let atlasDigitU = glyphCropMin + withinU * (glyphCropMax - glyphCropMin);
  let atlasU = (f32(digit) + atlasDigitU) / 10.0;
  let atlasV = withinV;
  let texColor = textureSample(digitAtlasTex, digitSampler, vec2<f32>(atlasU, atlasV));
  // ── End uniform zone ───────────────────────────────────────────

  // Horizon culling — fragment discard (matching other globe pipelines)
  if (camera.projectionTransition > 0.01 && input.clipDot < -0.01) {
    discard;
  }

  if (dist > 0.5) {
    discard;
  }

  // ── Non-uniform branching (safe — special ops already computed) ──
  if (!isCluster) {
    let strokeFrac = clamp(material.pointStrokeWidth / max(material.pointSize, 1.0), 0.0, 0.49);
    let inner = 0.5 - strokeFrac;
    let fillMix = 1.0 - smoothstep(inner - aa, inner, dist);
    let edgeAlpha = 1.0 - smoothstep(0.5 - aa, 0.5, dist);
    let color = mix(material.pointStroke, material.pointFill, fillMix);
    return vec4<f32>(color.rgb, color.a * edgeAlpha);
  }

  let tier = (inst.flags >> 1u) & 3u;
  var fillColor: vec4<f32>;
  if (tier >= 2u) {
    fillColor = material.clusterFillLarge;
  } else if (tier >= 1u) {
    fillColor = material.clusterFillMedium;
  } else {
    fillColor = material.clusterFillSmall;
  }

  let clusterTier = min(f32((inst.flags >> 1u) & 3u), 2.0);
  let clusterPixelSize = material.clusterBaseSize + material.clusterGrowRate * clusterTier;
  let strokeFrac = clamp(material.clusterStrokeWidth / max(clusterPixelSize, 1.0), 0.0, 0.49);
  let inner = 0.5 - strokeFrac;
  let fillMix = 1.0 - smoothstep(inner - aa, inner, dist);
  let edgeAlpha = 1.0 - smoothstep(0.5 - aa, 0.5, dist);
  let circleColor = mix(material.clusterStroke, fillColor, fillMix);

  let inDigitRegion = step(vMin, localV) * step(localV, vMax)
                    * step(startU, localU) * step(localU, startU + totalWidth)
                    * step(f32(digitIdx), f32(digitCount) - 0.5);
  let textAlpha = texColor.a * inDigitRegion * material.clusterText.a;

  let finalColor = mix(circleColor.rgb, material.clusterText.rgb, textAlpha);
  return vec4<f32>(finalColor, circleColor.a * edgeAlpha);
}

fn getDigitCount(n: u32) -> u32 {
  if (n >= 100000u) { return 6u; }
  if (n >= 10000u) { return 5u; }
  if (n >= 1000u) { return 4u; }
  if (n >= 100u) { return 3u; }
  if (n >= 10u) { return 2u; }
  return 1u;
}

fn getDigitAt(n: u32, digitCount: u32, idx: u32) -> u32 {
  var divisor = 1u;
  for (var i = 0u; i < digitCount - 1u - idx; i = i + 1u) {
    divisor = divisor * 10u;
  }
  return (n / divisor) % 10u;
}
`
);
function ki(r) {
  const { device: e, colorFormat: t, globeCameraBindGroupLayout: o } = r, i = e.createBindGroupLayout({
    label: "cluster-globe-render-bind-group-layout",
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } },
      { binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: {} }
    ]
  }), a = e.createShaderModule({
    label: "cluster-globe-render-shader",
    code: Ni
  }), n = e.createPipelineLayout({
    label: "cluster-globe-render-pipeline-layout",
    bindGroupLayouts: [o, i]
  }), s = e.createRenderPipeline({
    label: "cluster-globe-render-pipeline",
    layout: n,
    vertex: {
      module: a,
      entryPoint: "vs_main",
      buffers: []
    },
    fragment: {
      module: a,
      entryPoint: "fs_main",
      targets: [{
        format: t,
        blend: {
          color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
          alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" }
        }
      }]
    },
    primitive: { topology: "triangle-list" },
    depthStencil: {
      format: r.depthFormat ?? "depth24plus",
      // Overlay-oriented depth behavior: avoid terrain/globe clipping artifacts
      // on large cluster billboards in 3D.
      depthWriteEnabled: !1,
      depthCompare: "always"
    },
    multisample: {
      count: r.sampleCount ?? E
    }
  }), l = e.createSampler({
    label: "cluster-globe-digit-sampler",
    magFilter: "linear",
    minFilter: "linear",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge"
  });
  return { pipeline: s, renderBindGroupLayout: i, sampler: l };
}
const Hi = (
  /* wgsl */
  `

// ─── Bindings ───
${z}
const ROOF_DEPTH_BIAS: f32 = 1e-4;
const WALL_DEPTH_BIAS: f32 = 2e-5;

struct ExtrusionMaterial {
  color: vec4<f32>,
  ambient: f32,
  debugMode: f32,
  animProgress: f32,
  animDuration: f32,
  waveOrigin: vec2<f32>,
  delayFactor: f32,
  bearing: f32,
  shininess: f32,
  specularStrength: f32,
  _pad1: f32,
  _pad2: f32,
};

@group(1) @binding(0) var<uniform> material: ExtrusionMaterial;

fn easeOutCubic(t: f32) -> f32 {
  let inv = 1.0 - t;
  return 1.0 - inv * inv * inv;
}

// ─── Vertex ───

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) centroid: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) vNormal: vec3<f32>,
  @location(1) debugData: vec3<f32>,
  @location(2) worldPos: vec3<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.debugData = vec3<f32>(0.0, 0.0, 0.0);

  // XY comes in Mercator [0..1], convert back to EPSG:3857 for 2D camera
  let HALF_CIRCUMFERENCE: f32 = 20037508.34;
  let epsg = vec2<f32>(
    input.position.x * 2.0 * HALF_CIRCUMFERENCE - HALF_CIRCUMFERENCE,
    (1.0 - input.position.y) * 2.0 * HALF_CIRCUMFERENCE - HALF_CIRCUMFERENCE
  );

  // Oblique offset in EPSG:3857: shift roof by height to create 2.5D appearance.
  // Direction rotates with camera bearing so buildings lean consistently on screen.
  var h = input.position.z;

  // Grow animation: scale height by eased progress
  if (material.animDuration > 0.0) {
    let dist = distance(input.centroid, material.waveOrigin);
    let delay = dist * material.delayFactor;
    let rawT = clamp((material.animProgress - delay) / material.animDuration, 0.0, 1.0);
    let progress = easeOutCubic(rawT);
    h = h * progress;
  }

  // Rotation-aware oblique: offset direction follows camera bearing
  let obliqueMag: f32 = 0.5;
  let offsetDir = vec2<f32>(-sin(material.bearing), cos(material.bearing));
  let obliquePos = vec3<f32>(
    epsg.x + h * offsetDir.x * obliqueMag,
    epsg.y + h * offsetDir.y * obliqueMag,
    h,
  );

  out.clipPosition = camera.viewProjection * vec4<f32>(obliquePos, 1.0);
  out.worldPos = obliquePos;

  // Logarithmic depth remap: better distribution across height range.
  // Maps [0..1000+m] → [0.5..0.01] with log2 distribution so both
  // low (1-5m) and tall (500m+) buildings have adequate depth separation.
  let logH = log2(max(h, 0.1) + 1.0);
  let logMax = log2(1001.0);
  let normalizedZ = clamp(0.5 - logH / (2.0 * logMax), 0.01, 0.99);
  out.clipPosition.z = normalizedZ * out.clipPosition.w;

  // Roof triangles share their top edge positions with wall quads.
  // Bias them slightly toward the camera to avoid wall-vs-roof depth acne.
  if (input.normal.z > 0.5) {
    out.clipPosition.z -= ROOF_DEPTH_BIAS * out.clipPosition.w;
  }

  // Shared building edges can still generate coplanar wall depth ties.
  // Split ties deterministically by wall normal orientation.
  if (abs(input.normal.z) < 0.5) {
    let wallDot = input.normal.x * 0.70710677 + input.normal.y * 0.70710677;
    let wallDir = select(-1.0, 1.0, wallDot >= 0.0);
    out.clipPosition.z -= wallDir * WALL_DEPTH_BIAS * out.clipPosition.w;
  }

  // Debug data: normalizedZ, height in km, face type (0=wall, 0.5=floor, 1=roof)
  let faceType2d = select(0.0, select(0.5, 1.0, input.normal.z > 0.5), abs(input.normal.z) > 0.1);
  out.debugData = vec3<f32>(normalizedZ, h * 0.001, faceType2d);

  out.vNormal = input.normal;
  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // Debug mode: visualize depth / height / face type as color
  if (material.debugMode > 0.5) {
    let depth = input.debugData.x;
    let faceType = input.debugData.z;
    // Depth gradient: green(far) → yellow → red(near camera)
    let t = clamp(1.0 - depth, 0.0, 1.0);
    var c = mix(vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(1.0, 1.0, 0.0), clamp(t * 2.0, 0.0, 1.0));
    c = mix(c, vec3<f32>(1.0, 0.0, 0.0), clamp(t * 2.0 - 1.0, 0.0, 1.0));
    if (faceType > 0.75) { c = mix(c, vec3<f32>(0.3, 0.3, 1.0), 0.4); }
    if (faceType > 0.25 && faceType < 0.75) { c = mix(c, vec3<f32>(0.8, 0.2, 0.8), 0.4); }
    return vec4<f32>(c, 0.9);
  }

  // Blinn-Phong directional lighting
  let lightDir = normalize(vec3<f32>(0.3, -0.5, 0.8));
  let normal = normalize(input.vNormal);
  let NdotL = max(dot(normal, lightDir), 0.0);

  // View direction: from above, rotated with camera bearing for consistent specular
  let viewDir = normalize(vec3<f32>(-sin(material.bearing), cos(material.bearing), 1.5));
  let halfDir = normalize(lightDir + viewDir);
  let NdotH = max(dot(normal, halfDir), 0.0);
  let specular = pow(NdotH, material.shininess) * material.specularStrength;

  let diffuse = (1.0 - material.ambient) * NdotL;
  let lit = material.ambient + diffuse + specular;
  let color = material.color.rgb * min(lit, 1.0);

  // Premultiplied alpha output
  return vec4<f32>(color * material.color.a, material.color.a);
}
`
);
function Wi(r) {
  return r.createBindGroupLayout({
    label: "extrusion-material-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }
      }
    ]
  });
}
function ji(r) {
  const { device: e, colorFormat: t, cameraBindGroupLayout: o } = r, i = Wi(e), a = e.createShaderModule({
    label: "extrusion-shader",
    code: Hi
  }), n = e.createPipelineLayout({
    label: "extrusion-pipeline-layout",
    bindGroupLayouts: [o, i]
  });
  return { pipeline: e.createRenderPipeline({
    label: "extrusion-pipeline",
    layout: n,
    vertex: {
      module: a,
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 32,
          // 8 * 4 bytes (position + normal + centroid)
          stepMode: "vertex",
          attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x3" },
            // position
            { shaderLocation: 1, offset: 12, format: "float32x3" },
            // normal
            { shaderLocation: 2, offset: 24, format: "float32x2" }
            // centroid
          ]
        }
      ]
    },
    fragment: {
      module: a,
      entryPoint: "fs_main",
      targets: [
        {
          format: t,
          // Premultiplied alpha blending (matches canvas alphaMode: 'premultiplied')
          blend: {
            color: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            }
          }
        }
      ]
    },
    primitive: {
      topology: "triangle-list",
      // With rotation-aware oblique and back-face culling, walls facing
      // away from the camera are correctly culled for better performance.
      cullMode: "back"
    },
    depthStencil: {
      format: r.depthFormat ?? "depth24plus",
      depthWriteEnabled: !0,
      depthCompare: r.depthCompare ?? "less"
    },
    multisample: {
      count: r.sampleCount ?? E
    }
  }), materialBindGroupLayout: i };
}
function Xi(r) {
  return r === "greater" || r === "greater-equal" ? 1 : -1;
}
function ft(r) {
  const e = Xi(r);
  return (
    /* wgsl */
    `

// ─── Bindings ───
${te}
${nt}
const EARTH_RADIUS_M: f32 = 6378137.0;
const ROOF_DEPTH_BIAS: f32 = 1e-4;
const WALL_DEPTH_BIAS: f32 = 2e-5;
const EXTRUSION_SURFACE_BIAS: f32 = 5e-5;
const ROOF_DEPTH_BIAS_SIGN: f32 = ${e};
${st}

struct ExtrusionMaterial {
  color: vec4<f32>,
  ambient: f32,
  debugMode: f32,
  animProgress: f32,
  animDuration: f32,
  waveOrigin: vec2<f32>,
  delayFactor: f32,
  _reserved: f32,
  shininess: f32,
  specularStrength: f32,
  _pad1: f32,
  _pad2: f32,
  cameraPos: vec4<f32>,
};

@group(1) @binding(0) var<uniform> material: ExtrusionMaterial;

fn easeOutCubic(t: f32) -> f32 {
  let inv = 1.0 - t;
  return 1.0 - inv * inv * inv;
}

// ─── Vertex ───

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) centroid: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) vNormal: vec3<f32>,
  @location(1) debugData: vec3<f32>,
  @location(2) worldPos: vec3<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;

  var h = input.position.z;

  // Grow animation: scale height by eased progress
  if (material.animDuration > 0.0) {
    let dist = distance(input.centroid, material.waveOrigin);
    let delay = dist * material.delayFactor;
    let rawT = clamp((material.animProgress - delay) / material.animDuration, 0.0, 1.0);
    let progress = easeOutCubic(rawT);
    h = h * progress;
  }

  // XY already in Mercator [0..1] from CPU-side normalization
  let merc01 = input.position.xy;
  let ang = mercatorToAngular(merc01);
  let sphereBase = angularToSphere(ang.x, ang.y);

  // Radial height offset: position on sphere at (1 + h/R)
  let radius = 1.0 + h / EARTH_RADIUS_M;
  let worldPos = sphereBase * radius;
  out.worldPos = worldPos;

  // Globe tangent space: transform flat normal to globe space
  // East = d(sphere)/d(lon), North = d(sphere)/d(lat), Up = sphereBase
  let cosLat = cos(ang.y);
  let sinLat = sin(ang.y);
  let cosLon = cos(ang.x);
  let sinLon = sin(ang.x);

  let east = vec3<f32>(cosLon, 0.0, -sinLon);
  let north = vec3<f32>(-sinLat * sinLon, cosLat, -sinLat * cosLon);
  let up = sphereBase;

  // Transform flat normal (input.normal) to globe tangent space
  // flat.x → east, flat.y → north, flat.z → up
  let globeNormal = normalize(
    input.normal.x * east +
    input.normal.y * north +
    input.normal.z * up
  );
  out.vNormal = globeNormal;
  out.debugData = vec3<f32>(0.0, 0.0, 0.0);

  // Clip position (globe)
  // Height-aware depth: EXTRUSION_SURFACE_BIAS keeps all extrusion faces
  // above the globe surface in the depth buffer so wall depth bias
  // (which can be negative for some face orientations) never pushes
  // walls behind the raster tile surface.
  // heightBias adds per-vertex height offset for inter-face depth ordering.
  var globeClip = camera.viewProjection * vec4<f32>(worldPos, 1.0);
  let clipZ = globeClippingZ(sphereBase);
  let heightBias = h / EARTH_RADIUS_M;
  let effectiveClipZ = select(clipZ, min(clipZ + EXTRUSION_SURFACE_BIAS + heightBias, 0.9999), clipZ <= 1.0);
  globeClip.z = effectiveClipZ * globeClip.w;

  // Debug data: clipZ, height in km, face type (0=wall, 0.5=floor, 1=roof)
  let faceType = select(0.0, select(0.5, 1.0, input.normal.z > 0.5), abs(input.normal.z) > 0.1);
  out.debugData = vec3<f32>(clipZ, h * 0.001, faceType);

  // Flat/Mercator path: height scaled consistently with globe path (h / R).
  // Using EARTH_RADIUS_M (not circumference) gives ~6.28× taller buildings,
  // matching the globe path's visual scale and providing proper depth separation.
  let heightScale = h / EARTH_RADIUS_M;
  let flatPos = vec4<f32>(merc01.x, merc01.y, heightScale, 1.0);

  if (camera.projectionTransition >= 0.999) {
    out.clipPosition = globeClip;
  } else if (camera.projectionTransition <= 0.001) {
    out.clipPosition = camera.flatViewProjection * flatPos;
    // Flat VP has Scale(1,-1,1) Y-flip — correct normals to match
    out.vNormal = vec3<f32>(input.normal.x, -input.normal.y, input.normal.z);
    out.worldPos = flatPos.xyz;
  } else {
    var flatClip = camera.flatViewProjection * flatPos;
    out.clipPosition = mix(flatClip, globeClip, camera.projectionTransition);
    let flatNormal = vec3<f32>(input.normal.x, -input.normal.y, input.normal.z);
    out.vNormal = mix(flatNormal, globeNormal, camera.projectionTransition);
    out.worldPos = mix(flatPos.xyz, worldPos, camera.projectionTransition);
  }

  // Depth-aware roof bias:
  // - less/less-equal: negative Z moves closer to camera
  // - greater/greater-equal (reverse-Z): positive Z moves closer to camera
  if (input.normal.z > 0.5) {
    out.clipPosition.z += ROOF_DEPTH_BIAS_SIGN * ROOF_DEPTH_BIAS * out.clipPosition.w;
  }

  if (abs(input.normal.z) < 0.5) {
    let wallDot = input.normal.x * 0.70710677 + input.normal.y * 0.70710677;
    let wallDir = select(-1.0, 1.0, wallDot >= 0.0);
    out.clipPosition.z += ROOF_DEPTH_BIAS_SIGN * wallDir * WALL_DEPTH_BIAS * out.clipPosition.w;
  }

  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // Debug mode: visualize clipZ / height / face type as color
  if (material.debugMode > 0.5) {
    let clipZ = input.debugData.x;
    let faceType = input.debugData.z;
    // Green(safe) → Yellow(mid) → Red(horizon risk)
    let t = clamp(clipZ, 0.0, 1.0);
    var c = mix(vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(1.0, 1.0, 0.0), clamp(t * 2.0, 0.0, 1.0));
    c = mix(c, vec3<f32>(1.0, 0.0, 0.0), clamp(t * 2.0 - 1.0, 0.0, 1.0));
    // Roof = blue tint, Floor = purple tint
    if (faceType > 0.75) { c = mix(c, vec3<f32>(0.3, 0.3, 1.0), 0.4); }
    if (faceType > 0.25 && faceType < 0.75) { c = mix(c, vec3<f32>(0.8, 0.2, 0.8), 0.4); }
    return vec4<f32>(c, 0.9);
  }

  // Blinn-Phong directional lighting
  let lightDir = normalize(vec3<f32>(0.3, -0.5, 0.8));
  let normal = normalize(input.vNormal);
  let NdotL = max(dot(normal, lightDir), 0.0);

  // View direction: globe path uses sphere-outward, flat path uses camera→point
  let globeViewDir = normalize(-input.worldPos);
  let flatViewDir = normalize(material.cameraPos.xyz - input.worldPos);
  let viewDir = normalize(mix(flatViewDir, globeViewDir, camera.projectionTransition));
  let halfDir = normalize(lightDir + viewDir);
  let NdotH = max(dot(normal, halfDir), 0.0);
  let specular = pow(NdotH, material.shininess) * material.specularStrength;

  let diffuse = (1.0 - material.ambient) * NdotL;
  let lit = material.ambient + diffuse + specular;
  let color = material.color.rgb * min(lit, 1.0);

  // Premultiplied alpha output
  return vec4<f32>(color * material.color.a, material.color.a);
}
`
  );
}
const xo = ft("greater");
function $i(r) {
  const { device: e, colorFormat: t, globeCameraBindGroupLayout: o } = r, i = e.createBindGroupLayout({
    label: "globe-extrusion-material-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }
      }
    ]
  }), a = e.createShaderModule({
    label: "globe-extrusion-shader",
    code: ft(r.depthCompare)
  }), n = e.createPipelineLayout({
    label: "globe-extrusion-pipeline-layout",
    bindGroupLayouts: [o, i]
  });
  return { pipeline: e.createRenderPipeline({
    label: "globe-extrusion-pipeline",
    layout: n,
    vertex: {
      module: a,
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 32,
          // 8 * 4 bytes (position + normal + centroid)
          stepMode: "vertex",
          attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x3" },
            // position
            { shaderLocation: 1, offset: 12, format: "float32x3" },
            // normal
            { shaderLocation: 2, offset: 24, format: "float32x2" }
            // centroid
          ]
        }
      ]
    },
    fragment: {
      module: a,
      entryPoint: "fs_main",
      targets: [
        {
          format: t,
          // Premultiplied alpha blending (matches canvas alphaMode: 'premultiplied')
          blend: {
            color: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            }
          }
        }
      ]
    },
    primitive: {
      topology: "triangle-list",
      // Flat path Y-flips handedness, globe path doesn't — 'none' is safe for both.
      cullMode: "none"
    },
    depthStencil: {
      format: r.depthFormat ?? "depth32float",
      depthWriteEnabled: !0,
      depthCompare: r.depthCompare ?? "greater"
    },
    multisample: {
      count: r.sampleCount ?? E
    }
  }), materialBindGroupLayout: i };
}
function vo(r) {
  return {
    enabled: r?.enabled ?? !1,
    fxaa: { enabled: r?.fxaa?.enabled ?? !0, quality: r?.fxaa?.quality ?? 0.75 },
    bloom: {
      enabled: r?.bloom?.enabled ?? !1,
      threshold: r?.bloom?.threshold ?? 0.8,
      intensity: r?.bloom?.intensity ?? 1,
      radius: r?.bloom?.radius ?? 0.5
    },
    ssao: {
      enabled: r?.ssao?.enabled ?? !1,
      radius: r?.ssao?.radius ?? 0.5,
      intensity: r?.ssao?.intensity ?? 1,
      bias: r?.ssao?.bias ?? 0.025
    },
    hdr: {
      enabled: r?.hdr?.enabled ?? !1,
      exposure: r?.hdr?.exposure ?? 1,
      toneMapping: r?.hdr?.toneMapping ?? "aces"
    }
  };
}
const bo = (
  /* wgsl */
  `

struct BloomUniforms {
  threshold: f32,
  intensity: f32,
  rcpSize: vec2<f32>,  // 1/width, 1/height
  direction: vec2<f32>, // (1,0) for H-blur, (0,1) for V-blur
  _pad: vec2<f32>,
};

@group(0) @binding(0) var<uniform> params: BloomUniforms;
@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var inputTexture: texture_2d<f32>;

// Full-screen triangle
@vertex
fn vsMain(@builtin(vertex_index) idx: u32) -> @builtin(position) vec4<f32> {
  let uv = vec2<f32>(f32((idx << 1u) & 2u), f32(idx & 2u));
  return vec4<f32>(uv * 2.0 - 1.0, 0.0, 1.0);
}

// Gaussian weights (9-tap kernel)
const KERNEL_SIZE: i32 = 4;
const WEIGHTS: array<f32, 5> = array<f32, 5>(
  0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216
);

@fragment
fn fsBrightPass(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = pos.xy * params.rcpSize;
  let color = textureSample(inputTexture, inputSampler, uv);
  let brightness = dot(color.rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
  if brightness > params.threshold {
    return vec4<f32>(color.rgb * params.intensity, 1.0);
  }
  return vec4<f32>(0.0, 0.0, 0.0, 1.0);
}

@fragment
fn fsBlur(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = pos.xy * params.rcpSize;
  var result = textureSample(inputTexture, inputSampler, uv).rgb * WEIGHTS[0];

  let texelOffset = params.direction * params.rcpSize;
  for (var i: i32 = 1; i <= KERNEL_SIZE; i = i + 1) {
    let offset = texelOffset * f32(i);
    result += textureSample(inputTexture, inputSampler, uv + offset).rgb * WEIGHTS[i];
    result += textureSample(inputTexture, inputSampler, uv - offset).rgb * WEIGHTS[i];
  }

  return vec4<f32>(result, 1.0);
}

@fragment
fn fsComposite(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = pos.xy * params.rcpSize;
  let scene = textureSample(inputTexture, inputSampler, uv);
  // Bloom texture would be bound as a second texture in a real implementation
  // For now, this is the additive pass placeholder
  return scene;
}
`
);
function yo() {
  return { threshold: 0.8, intensity: 1, radius: 0.5, enabled: !1 };
}
const Po = (
  /* wgsl */
  `

struct HDRUniforms {
  exposure: f32,
  toneMapper: f32,  // 0 = Reinhard, 1 = ACES
  rcpSize: vec2<f32>,
};

@group(0) @binding(0) var<uniform> params: HDRUniforms;
@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var inputTexture: texture_2d<f32>;

@vertex
fn vsMain(@builtin(vertex_index) idx: u32) -> @builtin(position) vec4<f32> {
  let uv = vec2<f32>(f32((idx << 1u) & 2u), f32(idx & 2u));
  return vec4<f32>(uv * 2.0 - 1.0, 0.0, 1.0);
}

fn reinhardToneMap(color: vec3<f32>) -> vec3<f32> {
  return color / (color + vec3<f32>(1.0));
}

fn acesToneMap(color: vec3<f32>) -> vec3<f32> {
  // ACES Filmic approximation (Narkowicz 2015)
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return saturate((color * (a * color + b)) / (color * (c * color + d) + e));
}

@fragment
fn fsMain(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = pos.xy * params.rcpSize;
  var color = textureSample(inputTexture, inputSampler, uv).rgb;

  // Apply exposure
  color = color * params.exposure;

  // Tone mapping
  if params.toneMapper < 0.5 {
    color = reinhardToneMap(color);
  } else {
    color = acesToneMap(color);
  }

  // Gamma correction (linear → sRGB)
  color = pow(color, vec3<f32>(1.0 / 2.2));

  return vec4<f32>(color, 1.0);
}
`
);
function Co() {
  return { exposure: 1, toneMapping: "aces", enabled: !1 };
}
const wo = (
  /* wgsl */
  `

struct SSAOUniforms {
  radius: f32,
  intensity: f32,
  bias: f32,
  sampleCount: f32,
  rcpSize: vec2<f32>,
  _pad: vec2<f32>,
};

@group(0) @binding(0) var<uniform> params: SSAOUniforms;
@group(0) @binding(1) var depthSampler: sampler;
@group(0) @binding(2) var depthTexture: texture_2d<f32>;

@vertex
fn vsMain(@builtin(vertex_index) idx: u32) -> @builtin(position) vec4<f32> {
  let uv = vec2<f32>(f32((idx << 1u) & 2u), f32(idx & 2u));
  return vec4<f32>(uv * 2.0 - 1.0, 0.0, 1.0);
}

// Simple hash for pseudo-random sampling directions
fn hash(p: vec2<f32>) -> f32 {
  var p3 = fract(vec3<f32>(p.x, p.y, p.x) * 0.1031);
  p3 = p3 + dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

@fragment
fn fsMain(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = pos.xy * params.rcpSize;
  let centerDepth = textureSample(depthTexture, depthSampler, uv).r;

  if centerDepth >= 1.0 {
    return vec4<f32>(1.0); // Sky — no occlusion
  }

  var occlusion: f32 = 0.0;
  let samples = i32(params.sampleCount);

  for (var i: i32 = 0; i < samples; i = i + 1) {
    let angle = f32(i) * 2.399963 + hash(pos.xy); // golden angle
    let r = params.radius * (f32(i) + 0.5) / f32(samples);
    let offset = vec2<f32>(cos(angle), sin(angle)) * r * params.rcpSize;

    let sampleDepth = textureSample(depthTexture, depthSampler, uv + offset).r;
    let diff = centerDepth - sampleDepth;

    if diff > params.bias && diff < params.radius {
      occlusion += 1.0;
    }
  }

  occlusion = 1.0 - (occlusion / f32(samples)) * params.intensity;
  return vec4<f32>(occlusion, occlusion, occlusion, 1.0);
}
`
);
function So() {
  return { radius: 0.5, intensity: 1, bias: 0.025, sampleCount: 16, enabled: !1 };
}
function To(r) {
  return {
    enabled: r?.enabled ?? !1,
    resolution: r?.resolution ?? 2048,
    cascadeCount: Math.min(4, Math.max(1, r?.cascadeCount ?? 3)),
    pcfKernelSize: r?.pcfKernelSize ?? 3,
    darkness: r?.darkness ?? 0.5,
    maxDistance: r?.maxDistance ?? 5e3,
    bias: r?.bias ?? 5e-3,
    normalBias: r?.normalBias ?? 0.02
  };
}
function Bo(r, e, t, o = 0.5) {
  const i = [];
  for (let a = 1; a <= t; a++) {
    const n = r + (e - r) * (a / t), s = r * Math.pow(e / r, a / t);
    i.push(o * s + (1 - o) * n);
  }
  return i;
}
const Go = (
  /* wgsl */
  `
// PCF shadow sampling function (injected into scene shaders)
fn sampleShadow(
  shadowMap: texture_depth_2d,
  shadowSampler: sampler_comparison,
  shadowCoord: vec3<f32>,
  bias: f32,
  texelSize: f32,
) -> f32 {
  let adjustedZ = shadowCoord.z - bias;
  var shadow: f32 = 0.0;

  // 3x3 PCF kernel
  for (var x: i32 = -1; x <= 1; x = x + 1) {
    for (var y: i32 = -1; y <= 1; y = y + 1) {
      let offset = vec2<f32>(f32(x), f32(y)) * texelSize;
      shadow += textureSampleCompare(
        shadowMap, shadowSampler,
        shadowCoord.xy + offset, adjustedZ
      );
    }
  }

  return shadow / 9.0;
}
`
);
function Mo(r) {
  return {
    position: r.position,
    emitter: {
      type: r.emitter.type,
      radius: r.emitter.radius ?? 1,
      width: r.emitter.width ?? 1,
      height: r.emitter.height ?? 1,
      depth: r.emitter.depth ?? 1,
      angle: r.emitter.angle ?? 45
    },
    emissionRate: r.emissionRate ?? 100,
    maxParticles: r.maxParticles ?? 1e4,
    lifetime: r.lifetime ?? 3,
    speed: r.speed ?? 1,
    speedVariation: r.speedVariation ?? 0.2,
    startScale: r.startScale ?? 5,
    endScale: r.endScale ?? 1,
    startColor: r.startColor ?? [1, 1, 1, 1],
    endColor: r.endColor ?? [1, 1, 1, 0],
    gravity: r.gravity ?? [0, -9.81, 0],
    wind: r.wind ?? [0, 0, 0],
    imageUrl: r.imageUrl ?? "",
    enabled: r.enabled ?? !0
  };
}
const _o = 52, Fo = {
  posX: 0,
  // f32
  posY: 4,
  // f32
  posZ: 8,
  // f32
  velX: 12,
  // f32
  velY: 16,
  // f32
  velZ: 20,
  // f32
  life: 24,
  // f32 (current)
  maxLife: 28,
  // f32
  scale: 32,
  // f32
  colorR: 36,
  // f32
  colorG: 40,
  // f32
  colorB: 44,
  // f32
  colorA: 48
  // f32
}, Ro = (
  /* wgsl */
  `

struct Particle {
  pos: vec3<f32>,
  vel: vec3<f32>,
  life: f32,
  maxLife: f32,
  scale: f32,
  color: vec4<f32>,
};

struct SimParams {
  deltaTime: f32,
  gravity: vec3<f32>,
  wind: vec3<f32>,
  startScale: f32,
  endScale: f32,
  startColor: vec4<f32>,
  endColor: vec4<f32>,
};

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: SimParams;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  if idx >= arrayLength(&particles) { return; }

  var p = particles[idx];

  // Skip dead particles
  if p.life <= 0.0 { return; }

  // Update lifetime
  p.life -= params.deltaTime;

  if p.life <= 0.0 {
    p.life = 0.0;
    p.color.a = 0.0;
    particles[idx] = p;
    return;
  }

  // Progress 0..1
  let t = 1.0 - (p.life / p.maxLife);

  // Physics
  p.vel += (params.gravity + params.wind) * params.deltaTime;
  p.pos += p.vel * params.deltaTime;

  // Interpolate visual properties
  p.scale = mix(params.startScale, params.endScale, t);
  p.color = mix(params.startColor, params.endColor, t);

  particles[idx] = p;
}
`
);
class Yi {
  constructor(e) {
    this.ctx = e;
  }
  pickingPipeline = null;
  ensurePickingPipeline() {
    if (!this.pickingPipeline) {
      const e = this.ctx.canvas?.width || 1, t = this.ctx.canvas?.height || 1;
      this.pickingPipeline = Kt({
        device: this.ctx.device,
        cameraBindGroupLayout: this.ctx.cameraBindGroupLayout,
        width: e,
        height: t,
        depthFormat: this.ctx.depthConfig.format,
        depthCompare: this.ctx.depthConfig.compareFunc
      });
    }
    return this.pickingPipeline;
  }
  async pick(e, t) {
    if (!this.ctx.device || !this.ctx.cameraBindGroup || this.ctx.deviceLost)
      return null;
    const o = this.ensurePickingPipeline();
    if (e < 0 || e >= o.width || t < 0 || t >= o.height)
      return null;
    const i = this.ctx.device.createCommandEncoder({ label: "picking-command-encoder" }), a = i.beginRenderPass({
      label: "picking-render-pass",
      colorAttachments: [
        {
          view: o.pickingTexture.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: "clear",
          storeOp: "store"
        }
      ],
      depthStencilAttachment: {
        view: o.depthTexture.createView(),
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "store"
      }
    });
    a.setPipeline(o.pipeline), a.setBindGroup(0, this.ctx.cameraBindGroup);
    let n = 1;
    for (const f of this.ctx.pickingDrawCalls) {
      const h = (n & 255) / 255, x = (n >> 8 & 255) / 255, g = (n >> 16 & 255) / 255, b = 1 / 255, v = new Float32Array([h, x, g, b]), P = this.ctx.bufferPool.allocateWithData(
        v,
        GPUBufferUsage.UNIFORM,
        "transient"
      ), C = this.ctx.device.createBindGroup({
        label: "picking-id-bind-group",
        layout: o.pickingBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: P }
          }
        ]
      });
      a.setBindGroup(1, C), f.type === "points" ? (a.setVertexBuffer(0, f.vertexBuffer), a.draw(f.vertexCount, f.instanceCount)) : (a.setVertexBuffer(0, f.vertexBuffer), a.setIndexBuffer(f.indexBuffer, "uint32"), a.drawIndexed(f.indexCount)), n++;
    }
    a.end(), i.copyTextureToBuffer(
      {
        texture: o.pickingTexture,
        origin: { x: Math.floor(e), y: Math.floor(t) }
      },
      {
        buffer: o.readbackBuffer,
        bytesPerRow: 256
      },
      { width: 1, height: 1 }
    ), this.ctx.device.queue.submit([i.finish()]), await o.readbackBuffer.mapAsync(GPUMapMode.READ);
    const s = new Uint8Array(o.readbackBuffer.getMappedRange(0, 4)), l = s[0], c = s[1], p = s[2], u = s[3];
    o.readbackBuffer.unmap();
    const d = lt(l, c, p, u);
    return d ? {
      layerId: this.ctx.pickingDrawCalls[n - 1]?.layerId ?? `layer-${d.layerIndex}`,
      featureId: d.featureId,
      screenX: e,
      screenY: t
    } : null;
  }
  destroy() {
    this.pickingPipeline && (this.pickingPipeline.pickingTexture.destroy(), this.pickingPipeline.depthTexture.destroy(), this.pickingPipeline.readbackBuffer.destroy(), this.pickingPipeline = null);
  }
  reset() {
    this.pickingPipeline = null;
  }
}
const H = {
  enabled: !0,
  ambient: 0.5,
  diffuse: 0.85,
  shadowStrength: 0.2,
  shadowSoftness: 0.4,
  sunAzimuth: 315,
  sunAltitude: 45
};
class Zi {
  constructor(e) {
    this.ctx = e;
  }
  rasterPipeline = null;
  globeRasterPipeline = null;
  // Debug suites (lazy-init)
  debugSuite2D = null;
  debugSuiteGlobe = null;
  initRasterPipeline() {
    this.ctx.device && (this.rasterPipeline = Ot({
      device: this.ctx.device,
      colorFormat: this.ctx.colorFormat,
      cameraBindGroupLayout: this.ctx.cameraBindGroupLayout,
      depthFormat: this.ctx.depthConfig.format,
      sampleCount: this.ctx.sampleCount
    }));
  }
  ensureGlobeRasterPipeline() {
    return this.globeRasterPipeline || (this.ctx.ensureGlobeCameraResources(), this.globeRasterPipeline = _t({
      device: this.ctx.device,
      colorFormat: this.ctx.colorFormat,
      depthFormat: this.ctx.depthConfig.format,
      depthCompare: this.ctx.depthConfig.compareFunc,
      sampleCount: this.ctx.sampleCount
    })), this.globeRasterPipeline;
  }
  // ─── Debug Suite Init ───
  ensureDebugSuite2D() {
    return this.debugSuite2D || (this.debugSuite2D = Oe({
      device: this.ctx.device,
      colorFormat: this.ctx.colorFormat,
      cameraBindGroupLayout: this.ctx.cameraBindGroupLayout,
      depthFormat: this.ctx.depthConfig.format,
      globe: !1,
      sampleCount: this.ctx.sampleCount
    })), this.debugSuite2D;
  }
  ensureDebugSuiteGlobe() {
    return this.debugSuiteGlobe || (this.ctx.ensureGlobeCameraResources(), this.debugSuiteGlobe = Oe({
      device: this.ctx.device,
      colorFormat: this.ctx.colorFormat,
      cameraBindGroupLayout: this.ctx.globeCameraBindGroupLayout,
      depthFormat: this.ctx.depthConfig.format,
      depthCompare: this.ctx.depthConfig.compareFunc,
      globe: !0,
      sampleCount: this.ctx.sampleCount
    })), this.debugSuiteGlobe;
  }
  // ─── Draw Imagery (2D) ───
  drawImagery(e) {
    if (!this.ctx.device || !this.ctx.renderPass || !this.rasterPipeline || !this.ctx.cameraBindGroup || !this.ctx.bufferPool) return;
    const t = this.ctx.currentCamera?.position[0] ?? 0, o = this.ctx.currentCamera?.position[1] ?? 0, i = new Float32Array(8);
    i[0] = e.extent[0] - t, i[1] = e.extent[1] - o, i[2] = e.extent[2] - t, i[3] = e.extent[3] - o, i[4] = e.opacity, i[5] = e.filters?.brightness ?? 1, i[6] = e.filters?.contrast ?? 1, i[7] = e.filters?.saturate ?? 1;
    const a = this.ctx.bufferPool.allocateWithData(i, GPUBufferUsage.UNIFORM, "transient"), n = this.ctx.device.createBindGroup({
      label: "raster-tile-bind-group",
      layout: this.rasterPipeline.rasterBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: a } },
        { binding: 1, resource: this.rasterPipeline.sampler },
        { binding: 2, resource: e.texture.createView() }
      ]
    });
    this.ctx.renderPass.setPipeline(this.rasterPipeline.pipeline), this.ctx.renderPass.setBindGroup(0, this.ctx.cameraBindGroup), this.ctx.renderPass.setBindGroup(1, n), this.ctx.renderPass.draw(4), this.ctx.debugTileVertices && this._drawDebugOverlay([e.extent[0] - t, e.extent[1] - o, e.extent[2] - t, e.extent[3] - o], !1);
  }
  // ─── Draw Globe Tile (3D) ───
  drawGlobeTile(e) {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.bufferPool) return;
    const t = this.ensureGlobeRasterPipeline();
    this.ctx.ensureGlobeCameraWritten();
    const o = (e.heightMode ?? 0) === 1, i = e.terrainUvOffsetScale ?? [0, 0, 1, 1], a = e.heightExaggeration ?? this.ctx.heightExaggeration, n = {
      enabled: e.lighting3D?.enabled ?? H.enabled,
      ambient: e.lighting3D?.ambient ?? H.ambient,
      diffuse: e.lighting3D?.diffuse ?? H.diffuse,
      shadowStrength: e.lighting3D?.shadowStrength ?? H.shadowStrength,
      shadowSoftness: e.lighting3D?.shadowSoftness ?? H.shadowSoftness,
      sunAzimuth: e.lighting3D?.sunAzimuth ?? H.sunAzimuth,
      sunAltitude: e.lighting3D?.sunAltitude ?? H.sunAltitude
    }, s = new Float32Array(24);
    s[0] = e.mercatorExtent[0], s[1] = e.mercatorExtent[1], s[2] = e.mercatorExtent[2], s[3] = e.mercatorExtent[3], s[4] = e.opacity, s[5] = a, s[6] = o ? 1 : 0, s[7] = e.depthBias ?? 0, s[8] = i[0], s[9] = i[1], s[10] = i[2], s[11] = i[3], s[12] = Math.max(0, Math.min(1, n.ambient)), s[13] = Math.max(0, Math.min(2, n.diffuse)), s[14] = Math.max(0, Math.min(1, n.shadowStrength)), s[15] = Math.max(0, Math.min(1, n.shadowSoftness)), s[16] = n.sunAzimuth, s[17] = Math.max(0, Math.min(89.9, n.sunAltitude)), s[18] = n.enabled ? 1 : 0, s[20] = e.filters?.brightness ?? 1, s[21] = e.filters?.contrast ?? 1, s[22] = e.filters?.saturate ?? 1;
    const l = this.ctx.bufferPool.allocateWithData(s, GPUBufferUsage.UNIFORM, "transient"), c = this.ctx.device.createBindGroup({
      label: "globe-tile-bind-group",
      layout: t.globeTileBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: l } },
        { binding: 1, resource: t.sampler },
        { binding: 2, resource: e.texture.createView() }
      ]
    });
    let p = t.zeroHeightBindGroup;
    o ? e.terrainHeightTexture && (p = this.ctx.device.createBindGroup({
      label: "globe-terrain-height-bind-group",
      layout: t.heightBindGroupLayout,
      entries: [
        { binding: 0, resource: e.terrainHeightTexture.createView() },
        { binding: 1, resource: t.heightSampler }
      ]
    })) : p = this.ctx.heightBrush?.getBindGroup(
      this.ctx.device
    ) ?? t.zeroHeightBindGroup, this.ctx.renderPass.setPipeline(t.pipeline), this.ctx.renderPass.setBindGroup(0, this.ctx.globeCameraBindGroup), this.ctx.renderPass.setBindGroup(1, c), this.ctx.renderPass.setBindGroup(2, p), this.ctx.renderPass.setVertexBuffer(0, t.subdivisionMesh.vertexBuffer), this.ctx.renderPass.setIndexBuffer(
      t.subdivisionMesh.indexBuffer,
      t.subdivisionMesh.vertexCount > 65535 ? "uint32" : "uint16"
    ), this.ctx.renderPass.drawIndexed(t.subdivisionMesh.indexCount), this.ctx.debugTileVertices && this._drawDebugOverlay(e.mercatorExtent, !0, {
      mode: o ? 1 : 0,
      exaggeration: a,
      terrainUvOffsetScale: i,
      terrainHeightTexture: e.terrainHeightTexture
    });
  }
  // ─── Debug Overlay (shared 2D/globe) ───
  _drawDebugOverlay(e, t, o) {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.bufferPool) return;
    const i = t ? this.ctx.globeCameraBindGroup : this.ctx.cameraBindGroup;
    if (!i) return;
    const a = t ? this.ensureDebugSuiteGlobe() : this.ensureDebugSuite2D(), n = new Float32Array(28);
    n[0] = e[0], n[1] = e[1], n[2] = e[2], n[3] = e[3], n[4] = re[0], n[5] = re[1], n[6] = re[2], n[7] = re[3], n[8] = ie[0], n[9] = ie[1], n[10] = ie[2], n[11] = ie[3], n[12] = oe[0], n[13] = oe[1], n[14] = oe[2], n[15] = oe[3], n[16] = gr, n[17] = xr, n[18] = o?.exaggeration ?? this.ctx.heightExaggeration, n[19] = a.mesh.subdivisions, n[20] = o?.mode ?? 0, n[24] = o?.terrainUvOffsetScale[0] ?? 0, n[25] = o?.terrainUvOffsetScale[1] ?? 0, n[26] = o?.terrainUvOffsetScale[2] ?? 1, n[27] = o?.terrainUvOffsetScale[3] ?? 1;
    const s = this.ctx.bufferPool.allocateWithData(n, GPUBufferUsage.UNIFORM, "transient"), l = this.ctx.device.createBindGroup({
      label: "tile-debug-bind-group",
      layout: a.bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: s } }]
    });
    let c = a.zeroHeightBindGroup;
    t && (o?.mode ?? 0) === 1 ? o?.terrainHeightTexture && (c = this.ctx.device.createBindGroup({
      label: "tile-debug-terrain-height-bind-group",
      layout: a.heightBindGroupLayout,
      entries: [
        { binding: 0, resource: o.terrainHeightTexture.createView() },
        { binding: 1, resource: a.heightSampler }
      ]
    })) : c = this.ctx.heightBrush?.getBindGroup(
      this.ctx.device
    ) ?? a.zeroHeightBindGroup;
    const u = this.ctx.renderPass, d = a.mesh.vertexCount > 65535 ? "uint32" : "uint16";
    u.setPipeline(a.wireframePipeline), u.setBindGroup(0, i), u.setBindGroup(1, l), u.setBindGroup(2, c), u.setVertexBuffer(0, a.mesh.vertexBuffer), u.setIndexBuffer(a.mesh.wireframeIndexBuffer, d), u.drawIndexed(a.mesh.wireframeIndexCount), u.setPipeline(a.borderPipeline), u.setBindGroup(0, i), u.setBindGroup(1, l), u.setBindGroup(2, c), u.draw(24), u.setPipeline(a.dotPipeline), u.setBindGroup(0, i), u.setBindGroup(1, l), u.setBindGroup(2, c), u.setVertexBuffer(0, a.quadBuffer), u.setVertexBuffer(1, a.mesh.vertexBuffer), u.draw(6, a.mesh.vertexCount);
  }
  destroy() {
    this.rasterPipeline = null, this.globeRasterPipeline = null, this.debugSuite2D = null, this.debugSuiteGlobe = null;
  }
  reset() {
    this.rasterPipeline = null, this.globeRasterPipeline = null, this.debugSuite2D = null, this.debugSuiteGlobe = null;
  }
}
function le(r, e, t) {
  const o = t.dashArray;
  if (!o || o.length === 0) return;
  const i = Math.min(o.length, 8);
  let a = 0;
  for (let n = 0; n < i; n++) {
    const s = o[n] ?? 0;
    r[e + n] = s, a += s;
  }
  r[e + 8] = i, r[e + 9] = a;
}
function D(r, e, t, o, i, a) {
  let n = e.get(t);
  const s = a || !n;
  if (!n) {
    const l = r.bufferPool.allocate(
      o.byteLength,
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      "persistent"
    );
    l.label = `${i}:${t}`, n = {
      buffer: l,
      resourceId: `buf-${l.label ?? `${i}:${t}`}`
    }, e.set(t, n);
  }
  return s && r.device.queue.writeBuffer(
    n.buffer,
    0,
    o.buffer,
    o.byteOffset,
    o.byteLength
  ), n;
}
function A(r, e, t, o) {
  return r.bindGroupCache?.getOrCreate({ pipelineId: e, resourceIds: t }, o) ?? o();
}
function U(r, e) {
  for (const { buffer: t } of e.values())
    r.bufferPool?.release(t);
  e.clear();
}
class ht {
  textureResourceIds = /* @__PURE__ */ new WeakMap();
  nextTextureResourceId = 0;
  getResourceId(e, t) {
    let o = this.textureResourceIds.get(e);
    if (!o) {
      const i = e.label ? `:${e.label}` : "";
      o = `tex-${t}-${++this.nextTextureResourceId}${i}`, this.textureResourceIds.set(e, o);
    }
    return o;
  }
}
class qi {
  constructor(e, t) {
    this.ctx = e, this.getIconAtlas = t;
  }
  globePointPipeline = null;
  globeLinePipeline = null;
  globePolygonPipeline = null;
  skyPipeline = null;
  poleCapPipeline = null;
  atmospherePipeline = null;
  globeIconPipeline = null;
  pointMaterials = /* @__PURE__ */ new Map();
  lineMaterials = /* @__PURE__ */ new Map();
  polygonMaterials = /* @__PURE__ */ new Map();
  iconMaterials = /* @__PURE__ */ new Map();
  skyBackgroundMaterials = /* @__PURE__ */ new Map();
  skyVolumetricMaterials = /* @__PURE__ */ new Map();
  atmosphereMaterials = /* @__PURE__ */ new Map();
  poleCapMaterials = /* @__PURE__ */ new Map();
  textureResourceRegistry = new ht();
  // ── Lazy Pipeline Init ──
  ensureGlobePointPipeline() {
    return this.globePointPipeline || (this.ctx.ensureGlobeCameraResources(), this.globePointPipeline = lr({
      device: this.ctx.device,
      colorFormat: this.ctx.colorFormat,
      globeCameraBindGroupLayout: this.ctx.globeCameraBindGroupLayout,
      depthFormat: this.ctx.depthConfig.format,
      depthCompare: this.ctx.depthConfig.compareFunc,
      sampleCount: this.ctx.sampleCount
    })), this.globePointPipeline;
  }
  ensureGlobeLinePipeline() {
    return this.globeLinePipeline || (this.ctx.ensureGlobeCameraResources(), this.globeLinePipeline = pr({
      device: this.ctx.device,
      colorFormat: this.ctx.colorFormat,
      globeCameraBindGroupLayout: this.ctx.globeCameraBindGroupLayout,
      depthFormat: this.ctx.depthConfig.format,
      depthCompare: this.ctx.depthConfig.compareFunc,
      sampleCount: this.ctx.sampleCount
    })), this.globeLinePipeline;
  }
  ensureGlobePolygonPipeline() {
    return this.globePolygonPipeline || (this.ctx.ensureGlobeCameraResources(), this.globePolygonPipeline = hr({
      device: this.ctx.device,
      colorFormat: this.ctx.colorFormat,
      globeCameraBindGroupLayout: this.ctx.globeCameraBindGroupLayout,
      depthFormat: this.ctx.depthConfig.format,
      depthCompare: this.ctx.depthConfig.compareFunc,
      sampleCount: this.ctx.sampleCount
    })), this.globePolygonPipeline;
  }
  ensurePoleCapPipeline() {
    return this.poleCapPipeline || (this.ctx.ensureGlobeCameraResources(), this.poleCapPipeline = Fr({
      device: this.ctx.device,
      colorFormat: this.ctx.colorFormat,
      globeCameraBindGroupLayout: this.ctx.globeCameraBindGroupLayout,
      depthFormat: this.ctx.depthConfig.format,
      depthCompare: this.ctx.depthConfig.compareFunc,
      sampleCount: this.ctx.sampleCount
    })), this.poleCapPipeline;
  }
  ensureSkyPipeline() {
    return this.skyPipeline || (this.ctx.ensureGlobeCameraResources(), this.skyPipeline = Ir({
      device: this.ctx.device,
      colorFormat: this.ctx.colorFormat,
      globeCameraBindGroupLayout: this.ctx.globeCameraBindGroupLayout,
      sampleCount: this.ctx.sampleCount
    })), this.skyPipeline;
  }
  ensureAtmospherePipeline() {
    return this.atmospherePipeline || (this.ctx.ensureGlobeCameraResources(), this.atmospherePipeline = Ar({
      device: this.ctx.device,
      colorFormat: this.ctx.colorFormat,
      globeCameraBindGroupLayout: this.ctx.globeCameraBindGroupLayout,
      depthFormat: this.ctx.depthConfig.format,
      sampleCount: this.ctx.sampleCount
    })), this.atmospherePipeline;
  }
  ensureGlobeIconPipeline() {
    return this.globeIconPipeline || (this.ctx.ensureGlobeCameraResources(), this.globeIconPipeline = Xr({
      device: this.ctx.device,
      colorFormat: this.ctx.colorFormat,
      globeCameraBindGroupLayout: this.ctx.globeCameraBindGroupLayout,
      depthFormat: this.ctx.depthConfig.format,
      depthCompare: this.ctx.depthConfig.compareFunc,
      sampleCount: this.ctx.sampleCount
    })), this.globeIconPipeline;
  }
  drawSky(e, t = 45, o = 315) {
    if (!this.ctx.device || !this.ctx.backgroundPass || !this.ctx.bufferPool || !this.ctx.currentCamera) return;
    const i = this.ensureSkyPipeline();
    this.ctx.ensureGlobeCameraWritten();
    const a = this.buildSkyRenderState(e, { sunAltitude: t, sunAzimuth: o }), n = this.createSkyBackgroundUniformData(a), s = this.createSkyVolumetricUniformData(a), l = D(
      this.ctx,
      this.skyBackgroundMaterials,
      "background",
      n,
      "sky-background-material",
      !0
    ), c = D(
      this.ctx,
      this.skyVolumetricMaterials,
      "volumetric",
      s,
      "sky-volumetric-material",
      !0
    ), p = A(
      this.ctx,
      "sky:default",
      [l.resourceId, c.resourceId],
      () => this.ctx.device.createBindGroup({
        label: "sky-bind-group",
        layout: i.skyBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: l.buffer }
          },
          {
            binding: 1,
            resource: { buffer: c.buffer }
          }
        ]
      })
    );
    this.ctx.backgroundPass.setPipeline(i.pipeline), this.ctx.backgroundPass.setBindGroup(0, this.ctx.globeCameraBindGroup), this.ctx.backgroundPass.setBindGroup(1, p), this.ctx.backgroundPass.draw(3);
  }
  // ── Draw Methods ──
  drawGlobePoints(e, t) {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.bufferPool) return;
    if (t.type === "icon" && t.src) {
      this._drawGlobeIconPoints(e, t);
      return;
    }
    const o = this.ensureGlobePointPipeline();
    if (this.ctx.ensureGlobeCameraWritten(), t.glowColor && t.glowSize && t.glowSize > 0) {
      const l = new Float32Array(12);
      l[0] = t.glowColor[0] / 255, l[1] = t.glowColor[1] / 255, l[2] = t.glowColor[2] / 255, l[3] = t.glowColor[3] / 255 * 0.35, l[8] = t.size + t.glowSize * 2, l[9] = 0, l[10] = 0, l[11] = 1;
      const c = `glow:${t.glowColor.join(",")}:${t.size}:${t.glowSize}`, p = D(
        this.ctx,
        this.pointMaterials,
        c,
        l,
        "globe-point-material",
        !1
      ), u = A(
        this.ctx,
        `globe-point:${c}`,
        [p.resourceId],
        () => this.ctx.device.createBindGroup({
          label: "globe-point-glow-bind-group",
          layout: o.materialBindGroupLayout,
          entries: [{ binding: 0, resource: { buffer: p.buffer } }]
        })
      );
      this.ctx.renderPass.setPipeline(o.pipeline), this.ctx.renderPass.setBindGroup(0, this.ctx.globeCameraBindGroup), this.ctx.renderPass.setBindGroup(1, u), this.ctx.renderPass.setVertexBuffer(0, e.vertexBuffer), this.ctx.renderPass.draw(6, e.count);
    }
    const i = new Float32Array(12);
    i[0] = t.color[0] / 255, i[1] = t.color[1] / 255, i[2] = t.color[2] / 255, i[3] = t.color[3] / 255, i[4] = (t.outlineColor?.[0] ?? 0) / 255, i[5] = (t.outlineColor?.[1] ?? 0) / 255, i[6] = (t.outlineColor?.[2] ?? 0) / 255, i[7] = (t.outlineColor?.[3] ?? 255) / 255, i[8] = t.size, i[9] = t.outlineWidth ?? 0, i[10] = 0, i[11] = 0;
    const a = [
      t.color.join(","),
      t.outlineColor?.join(",") ?? "",
      t.size,
      t.outlineWidth ?? 0
    ].join(":"), n = D(
      this.ctx,
      this.pointMaterials,
      a,
      i,
      "globe-point-material",
      !1
    ), s = A(
      this.ctx,
      `globe-point:${a}`,
      [n.resourceId],
      () => this.ctx.device.createBindGroup({
        label: "globe-point-material-bind-group",
        layout: o.materialBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: n.buffer }
          }
        ]
      })
    );
    this.ctx.renderPass.setPipeline(o.pipeline), this.ctx.renderPass.setBindGroup(0, this.ctx.globeCameraBindGroup), this.ctx.renderPass.setBindGroup(1, s), this.ctx.renderPass.setVertexBuffer(0, e.vertexBuffer), this.ctx.renderPass.draw(6, e.count);
  }
  drawGlobeLines(e, t) {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.bufferPool) return;
    const o = this.ensureGlobeLinePipeline();
    if (this.ctx.ensureGlobeCameraWritten(), t.glowColor && t.glowWidth && t.glowWidth > 0) {
      const l = new Float32Array(20);
      l[0] = t.glowColor[0] / 255, l[1] = t.glowColor[1] / 255, l[2] = t.glowColor[2] / 255, l[3] = t.glowColor[3] / 255 * 0.35, l[4] = t.width + t.glowWidth * 2, l[5] = se(t.style), l[6] = t.dashAnimationSpeed ?? 0, l[7] = this.ctx.frameTime, le(l, 8, t);
      const c = [
        "glow",
        t.glowColor.join(","),
        t.width,
        t.glowWidth,
        t.style,
        t.dashArray?.join(",") ?? "",
        t.dashAnimationSpeed ?? 0
      ].join(":"), p = D(
        this.ctx,
        this.lineMaterials,
        c,
        l,
        "globe-line-material",
        (t.dashAnimationSpeed ?? 0) !== 0
      ), u = A(
        this.ctx,
        `globe-line:${c}`,
        [p.resourceId],
        () => this.ctx.device.createBindGroup({
          label: "globe-line-glow-bind-group",
          layout: o.materialBindGroupLayout,
          entries: [{ binding: 0, resource: { buffer: p.buffer } }]
        })
      );
      this.ctx.renderPass.setPipeline(o.pipeline), this.ctx.renderPass.setBindGroup(0, this.ctx.globeCameraBindGroup), this.ctx.renderPass.setBindGroup(1, u), this.ctx.renderPass.setVertexBuffer(0, e.vertexBuffer), this.ctx.renderPass.setIndexBuffer(e.indexBuffer, "uint32"), this.ctx.renderPass.drawIndexed(e.indexCount);
    }
    const i = new Float32Array(20);
    i[0] = t.color[0] / 255, i[1] = t.color[1] / 255, i[2] = t.color[2] / 255, i[3] = t.color[3] / 255, i[4] = t.width, i[5] = se(t.style), i[6] = t.dashAnimationSpeed ?? 0, i[7] = this.ctx.frameTime, le(i, 8, t);
    const a = [
      t.color.join(","),
      t.width,
      t.style,
      t.dashArray?.join(",") ?? "",
      t.dashAnimationSpeed ?? 0
    ].join(":"), n = D(
      this.ctx,
      this.lineMaterials,
      a,
      i,
      "globe-line-material",
      (t.dashAnimationSpeed ?? 0) !== 0
    ), s = A(
      this.ctx,
      `globe-line:${a}`,
      [n.resourceId],
      () => this.ctx.device.createBindGroup({
        label: "globe-line-material-bind-group",
        layout: o.materialBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: n.buffer }
          }
        ]
      })
    );
    this.ctx.renderPass.setPipeline(o.pipeline), this.ctx.renderPass.setBindGroup(0, this.ctx.globeCameraBindGroup), this.ctx.renderPass.setBindGroup(1, s), this.ctx.renderPass.setVertexBuffer(0, e.vertexBuffer), this.ctx.renderPass.setIndexBuffer(e.indexBuffer, "uint32"), this.ctx.renderPass.drawIndexed(e.indexCount);
  }
  drawGlobePolygons(e, t) {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.bufferPool) return;
    const o = this.ensureGlobePolygonPipeline();
    this.ctx.ensureGlobeCameraWritten();
    const i = new Float32Array(4);
    i[0] = t.color[0] / 255, i[1] = t.color[1] / 255, i[2] = t.color[2] / 255, i[3] = t.color[3] / 255;
    const a = t.color.join(","), n = D(
      this.ctx,
      this.polygonMaterials,
      a,
      i,
      "globe-polygon-material",
      !1
    ), s = A(
      this.ctx,
      `globe-polygon:${a}`,
      [n.resourceId],
      () => this.ctx.device.createBindGroup({
        label: "globe-polygon-material-bind-group",
        layout: o.materialBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: n.buffer }
          }
        ]
      })
    );
    this.ctx.renderPass.setPipeline(o.pipeline), this.ctx.renderPass.setBindGroup(0, this.ctx.globeCameraBindGroup), this.ctx.renderPass.setBindGroup(1, s), this.ctx.renderPass.setVertexBuffer(0, e.vertexBuffer), this.ctx.renderPass.setIndexBuffer(e.indexBuffer, "uint32"), this.ctx.renderPass.drawIndexed(e.indexCount);
  }
  drawPoleCaps(e) {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.bufferPool) return;
    const t = this.ensurePoleCapPipeline();
    this.ctx.ensureGlobeCameraWritten();
    const o = new Float32Array(4);
    o[0] = e[0], o[1] = e[1], o[2] = e[2], o[3] = e[3];
    const i = D(
      this.ctx,
      this.poleCapMaterials,
      "default",
      o,
      "pole-cap-material",
      !0
    ), a = A(
      this.ctx,
      "pole-cap:default",
      [i.resourceId],
      () => this.ctx.device.createBindGroup({
        label: "pole-cap-color-bind-group",
        layout: t.poleCapBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: i.buffer }
          }
        ]
      })
    );
    this.ctx.renderPass.setPipeline(t.pipeline), this.ctx.renderPass.setBindGroup(0, this.ctx.globeCameraBindGroup), this.ctx.renderPass.setBindGroup(1, a), this.ctx.renderPass.setVertexBuffer(0, t.mesh.vertexBuffer), this.ctx.renderPass.setIndexBuffer(t.mesh.indexBuffer, "uint16"), this.ctx.renderPass.drawIndexed(t.mesh.indexCount);
  }
  drawAtmosphere(e, t) {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.bufferPool) return;
    const o = this.ensureAtmospherePipeline();
    this.ctx.ensureGlobeCameraWritten();
    const i = new Float32Array(12), a = t?.colorInner ?? [0.35, 0.55, 1, 1];
    i[0] = a[0], i[1] = a[1], i[2] = a[2], i[3] = a[3];
    const n = t?.colorOuter ?? [0.6, 0.85, 1, 1];
    i[4] = n[0], i[5] = n[1], i[6] = n[2], i[7] = n[3], i[8] = e * (t?.strength ?? 1), i[9] = t?.falloff ?? 1.5;
    const s = D(
      this.ctx,
      this.atmosphereMaterials,
      "default",
      i,
      "atmosphere-material",
      !0
    ), l = A(
      this.ctx,
      "atmosphere:default",
      [s.resourceId],
      () => this.ctx.device.createBindGroup({
        label: "atmosphere-bind-group",
        layout: o.atmosphereBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: s.buffer }
          }
        ]
      })
    );
    this.ctx.renderPass.setPipeline(o.pipeline), this.ctx.renderPass.setBindGroup(0, this.ctx.globeCameraBindGroup), this.ctx.renderPass.setBindGroup(1, l), this.ctx.renderPass.setVertexBuffer(0, o.mesh.vertexBuffer), this.ctx.renderPass.setIndexBuffer(
      o.mesh.indexBuffer,
      o.mesh.vertexCount > 65535 ? "uint32" : "uint16"
    ), this.ctx.renderPass.drawIndexed(o.mesh.indexCount);
  }
  /**
   * Internal: Globe icon point rendering via sprite atlas.
   */
  _drawGlobeIconPoints(e, t) {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.bufferPool) return;
    const o = this.getIconAtlas(), i = o.getSprite(t.src);
    if (!i) return;
    const a = o.getTexture();
    if (!a) return;
    if (this.ctx.ensureGlobeCameraWritten(), t.glowColor && t.glowSize && t.glowSize > 0) {
      const f = this.ensureGlobePointPipeline(), h = new Float32Array(12);
      h[0] = t.glowColor[0] / 255, h[1] = t.glowColor[1] / 255, h[2] = t.glowColor[2] / 255, h[3] = t.glowColor[3] / 255 * 0.35, h[8] = t.size + t.glowSize * 2, h[9] = 0, h[10] = 0, h[11] = 1;
      const x = `icon-glow:${t.glowColor.join(",")}:${t.size}:${t.glowSize}`, g = D(
        this.ctx,
        this.pointMaterials,
        x,
        h,
        "globe-point-material",
        !1
      ), b = A(
        this.ctx,
        `globe-icon-glow:${x}`,
        [g.resourceId],
        () => this.ctx.device.createBindGroup({
          label: "globe-icon-glow-bind-group",
          layout: f.materialBindGroupLayout,
          entries: [{ binding: 0, resource: { buffer: g.buffer } }]
        })
      );
      this.ctx.renderPass.setPipeline(f.pipeline), this.ctx.renderPass.setBindGroup(0, this.ctx.globeCameraBindGroup), this.ctx.renderPass.setBindGroup(1, b), this.ctx.renderPass.setVertexBuffer(0, e.vertexBuffer), this.ctx.renderPass.draw(6, e.count);
    }
    const n = this.ensureGlobeIconPipeline(), s = new Float32Array(20);
    s[0] = t.color[0] / 255, s[1] = t.color[1] / 255, s[2] = t.color[2] / 255, s[3] = t.color[3] / 255, s[4] = i.uv[0], s[5] = i.uv[1], s[6] = i.uv[2], s[7] = i.uv[3], s[8] = t.size, s[9] = t.rotation ?? 0, s[10] = (t.backgroundSize ?? 0) / 2, s[11] = t.outlineWidth ?? 0;
    const l = t.backgroundColor;
    s[12] = l ? l[0] / 255 : 0, s[13] = l ? l[1] / 255 : 0, s[14] = l ? l[2] / 255 : 0, s[15] = l ? l[3] / 255 : 0;
    const c = t.outlineColor;
    s[16] = c ? c[0] / 255 : 0, s[17] = c ? c[1] / 255 : 0, s[18] = c ? c[2] / 255 : 0, s[19] = c ? c[3] / 255 : 0;
    const p = [
      t.src ?? "",
      t.color.join(","),
      t.size,
      t.rotation ?? 0,
      t.backgroundColor?.join(",") ?? "",
      t.backgroundSize ?? 0,
      t.outlineColor?.join(",") ?? "",
      t.outlineWidth ?? 0,
      i.uv.join(",")
    ].join(":"), u = D(
      this.ctx,
      this.iconMaterials,
      p,
      s,
      "globe-icon-material",
      !1
    ), d = this.textureResourceRegistry.getResourceId(a, "sprite-atlas-texture"), m = A(
      this.ctx,
      `globe-icon:${p}`,
      [u.resourceId, d],
      () => this.ctx.device.createBindGroup({
        label: "globe-icon-material-bind-group",
        layout: n.materialBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: u.buffer }
          },
          {
            binding: 1,
            resource: n.sampler
          },
          {
            binding: 2,
            resource: a.createView()
          }
        ]
      })
    );
    this.ctx.renderPass.setPipeline(n.pipeline), this.ctx.renderPass.setBindGroup(0, this.ctx.globeCameraBindGroup), this.ctx.renderPass.setBindGroup(1, m), this.ctx.renderPass.setVertexBuffer(0, e.vertexBuffer), this.ctx.renderPass.draw(6, e.count);
  }
  destroy() {
    this.globePointPipeline = null, this.globeLinePipeline = null, this.globePolygonPipeline = null, this.skyPipeline = null, this.poleCapPipeline = null, this.atmospherePipeline = null, this.globeIconPipeline = null, U(this.ctx, this.pointMaterials), U(this.ctx, this.lineMaterials), U(this.ctx, this.polygonMaterials), U(this.ctx, this.iconMaterials), U(this.ctx, this.skyBackgroundMaterials), U(this.ctx, this.skyVolumetricMaterials), U(this.ctx, this.atmosphereMaterials), U(this.ctx, this.poleCapMaterials);
  }
  reset() {
    this.destroy();
  }
  buildSkyRenderState(e, t) {
    return {
      background: e,
      sunAltitude: t.sunAltitude,
      sunAzimuth: t.sunAzimuth,
      clouds: null
    };
  }
  createSkyBackgroundUniformData(e) {
    const t = this.ctx.currentCamera, o = Ki(t), i = Qi(t), a = new Float32Array(Ur);
    return a.set(o, 0), a.set(i, 16), a.set(e.background.horizonColor, 32), a.set(e.background.zenithColor, 36), a.set(e.background.spaceColor, 40), a[44] = e.background.horizonBlend, a[45] = e.background.verticalFalloff, a[46] = e.background.starIntensity, a[47] = e.background.starDensity, a[48] = e.background.starSeed, a[49] = e.sunAltitude, a[50] = e.sunAzimuth, a[51] = e.background.syncWithLighting ? 1 : 0, a;
  }
  createSkyVolumetricUniformData(e) {
    const t = new Float32Array(zr);
    return t[0] = e.clouds?.coverage ?? 0, t[1] = e.clouds?.opacity ?? 0, t[2] = e.clouds?.layerHeight ?? 0, t;
  }
}
function Ki(r) {
  const e = J(r.projectionMatrix, r.viewMatrix);
  return mt(e);
}
function Qi(r) {
  return r.flatViewProjectionMatrix ? mt(r.flatViewProjectionMatrix) : gt();
}
function mt(r) {
  return Rt(r) ?? gt();
}
function gt() {
  return new Float32Array([
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1
  ]);
}
class Ji {
  constructor(e, t) {
    this.ctx = e, this.getIconAtlas = t;
  }
  pointPipeline = null;
  linePipeline = null;
  polygonPipeline = null;
  textPipeline = null;
  postProcessPipeline = null;
  iconPipeline = null;
  pointMaterials = /* @__PURE__ */ new Map();
  lineMaterials = /* @__PURE__ */ new Map();
  polygonMaterials = /* @__PURE__ */ new Map();
  textMaterials = /* @__PURE__ */ new Map();
  iconMaterials = /* @__PURE__ */ new Map();
  postProcessMaterials = /* @__PURE__ */ new Map();
  textureResourceRegistry = new ht();
  // ── Lazy Pipeline Init ──
  ensurePointPipeline() {
    return this.pointPipeline || (this.pointPipeline = kt({
      device: this.ctx.device,
      colorFormat: this.ctx.colorFormat,
      cameraBindGroupLayout: this.ctx.cameraBindGroupLayout,
      depthFormat: this.ctx.depthConfig.format,
      depthCompare: this.ctx.depthConfig.compareFunc,
      sampleCount: this.ctx.sampleCount
    })), this.pointPipeline;
  }
  ensureLinePipeline() {
    return this.linePipeline || (this.linePipeline = jt({
      device: this.ctx.device,
      colorFormat: this.ctx.colorFormat,
      cameraBindGroupLayout: this.ctx.cameraBindGroupLayout,
      depthFormat: this.ctx.depthConfig.format,
      depthCompare: this.ctx.depthConfig.compareFunc,
      sampleCount: this.ctx.sampleCount
    })), this.linePipeline;
  }
  ensurePolygonPipeline() {
    return this.polygonPipeline || (this.polygonPipeline = Yt({
      device: this.ctx.device,
      colorFormat: this.ctx.colorFormat,
      cameraBindGroupLayout: this.ctx.cameraBindGroupLayout,
      depthFormat: this.ctx.depthConfig.format,
      depthCompare: this.ctx.depthConfig.compareFunc,
      sampleCount: this.ctx.sampleCount
    })), this.polygonPipeline;
  }
  ensureTextPipeline() {
    return this.textPipeline || (this.textPipeline = er({
      device: this.ctx.device,
      colorFormat: this.ctx.colorFormat,
      cameraBindGroupLayout: this.ctx.cameraBindGroupLayout,
      depthFormat: this.ctx.depthConfig.format,
      depthCompare: this.ctx.depthConfig.compareFunc,
      sampleCount: this.ctx.sampleCount
    })), this.textPipeline;
  }
  ensurePostProcessPipeline() {
    return this.postProcessPipeline || (this.postProcessPipeline = ir({
      device: this.ctx.device,
      colorFormat: this.ctx.colorFormat,
      sampleCount: this.ctx.sampleCount
    })), this.postProcessPipeline;
  }
  ensureIconPipeline() {
    return this.iconPipeline || (this.iconPipeline = Hr({
      device: this.ctx.device,
      colorFormat: this.ctx.colorFormat,
      cameraBindGroupLayout: this.ctx.cameraBindGroupLayout,
      depthFormat: this.ctx.depthConfig.format,
      depthCompare: this.ctx.depthConfig.compareFunc,
      sampleCount: this.ctx.sampleCount
    })), this.iconPipeline;
  }
  // ── Draw Methods ──
  drawPoints(e, t) {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.cameraBindGroup || !this.ctx.bufferPool)
      return;
    if (t.type === "icon" && t.src) {
      this._drawIconPoints(e, t);
      return;
    }
    const o = this.ensurePointPipeline();
    if (t.glowColor && t.glowSize && t.glowSize > 0) {
      const l = new Float32Array(12);
      l[0] = t.glowColor[0] / 255, l[1] = t.glowColor[1] / 255, l[2] = t.glowColor[2] / 255, l[3] = t.glowColor[3] / 255 * 0.35, l[8] = t.size + t.glowSize * 2, l[9] = 0, l[10] = 0, l[11] = 1;
      const c = `glow:${t.glowColor.join(",")}:${t.size}:${t.glowSize}`, p = D(
        this.ctx,
        this.pointMaterials,
        c,
        l,
        "point-material",
        !1
      ), u = A(
        this.ctx,
        `point:${c}`,
        [p.resourceId],
        () => this.ctx.device.createBindGroup({
          label: "point-glow-bind-group",
          layout: o.materialBindGroupLayout,
          entries: [{ binding: 0, resource: { buffer: p.buffer } }]
        })
      );
      this.ctx.renderPass.setPipeline(o.pipeline), this.ctx.renderPass.setBindGroup(0, this.ctx.cameraBindGroup), this.ctx.renderPass.setBindGroup(1, u), this.ctx.renderPass.setVertexBuffer(0, e.vertexBuffer), this.ctx.renderPass.draw(6, e.count);
    }
    const i = new Float32Array(12);
    i[0] = t.color[0] / 255, i[1] = t.color[1] / 255, i[2] = t.color[2] / 255, i[3] = t.color[3] / 255, i[4] = (t.outlineColor?.[0] ?? 0) / 255, i[5] = (t.outlineColor?.[1] ?? 0) / 255, i[6] = (t.outlineColor?.[2] ?? 0) / 255, i[7] = (t.outlineColor?.[3] ?? 255) / 255, i[8] = t.size, i[9] = t.outlineWidth ?? 0, i[10] = (t.type === "simple-marker", 0), i[11] = 0;
    const a = [
      t.color.join(","),
      t.outlineColor?.join(",") ?? "",
      t.size,
      t.outlineWidth ?? 0
    ].join(":"), n = D(
      this.ctx,
      this.pointMaterials,
      a,
      i,
      "point-material",
      !1
    ), s = A(
      this.ctx,
      `point:${a}`,
      [n.resourceId],
      () => this.ctx.device.createBindGroup({
        label: "point-material-bind-group",
        layout: o.materialBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: n.buffer }
          }
        ]
      })
    );
    this.ctx.renderPass.setPipeline(o.pipeline), this.ctx.renderPass.setBindGroup(0, this.ctx.cameraBindGroup), this.ctx.renderPass.setBindGroup(1, s), this.ctx.renderPass.setVertexBuffer(0, e.vertexBuffer), this.ctx.renderPass.draw(6, e.count);
  }
  drawLines(e, t) {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.cameraBindGroup || !this.ctx.bufferPool)
      return;
    const o = this.ensureLinePipeline();
    if (t.glowColor && t.glowWidth && t.glowWidth > 0) {
      const l = new Float32Array(20);
      l[0] = t.glowColor[0] / 255, l[1] = t.glowColor[1] / 255, l[2] = t.glowColor[2] / 255, l[3] = t.glowColor[3] / 255 * 0.35, l[4] = t.width + t.glowWidth * 2, l[5] = se(t.style), l[6] = t.dashAnimationSpeed ?? 0, l[7] = this.ctx.frameTime, le(l, 8, t);
      const c = [
        "glow",
        t.glowColor.join(","),
        t.width,
        t.glowWidth,
        t.style,
        t.dashArray?.join(",") ?? "",
        t.dashAnimationSpeed ?? 0
      ].join(":"), p = D(
        this.ctx,
        this.lineMaterials,
        c,
        l,
        "line-material",
        (t.dashAnimationSpeed ?? 0) !== 0
      ), u = A(
        this.ctx,
        `line:${c}`,
        [p.resourceId],
        () => this.ctx.device.createBindGroup({
          label: "line-glow-bind-group",
          layout: o.materialBindGroupLayout,
          entries: [{ binding: 0, resource: { buffer: p.buffer } }]
        })
      );
      this.ctx.renderPass.setPipeline(o.pipeline), this.ctx.renderPass.setBindGroup(0, this.ctx.cameraBindGroup), this.ctx.renderPass.setBindGroup(1, u), this.ctx.renderPass.setVertexBuffer(0, e.vertexBuffer), this.ctx.renderPass.setIndexBuffer(e.indexBuffer, "uint32"), this.ctx.renderPass.drawIndexed(e.indexCount);
    }
    const i = new Float32Array(20);
    i[0] = t.color[0] / 255, i[1] = t.color[1] / 255, i[2] = t.color[2] / 255, i[3] = t.color[3] / 255, i[4] = t.width, i[5] = se(t.style), i[6] = t.dashAnimationSpeed ?? 0, i[7] = this.ctx.frameTime, le(i, 8, t);
    const a = [
      t.color.join(","),
      t.width,
      t.style,
      t.dashArray?.join(",") ?? "",
      t.dashAnimationSpeed ?? 0
    ].join(":"), n = D(
      this.ctx,
      this.lineMaterials,
      a,
      i,
      "line-material",
      (t.dashAnimationSpeed ?? 0) !== 0
    ), s = A(
      this.ctx,
      `line:${a}`,
      [n.resourceId],
      () => this.ctx.device.createBindGroup({
        label: "line-material-bind-group",
        layout: o.materialBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: n.buffer }
          }
        ]
      })
    );
    this.ctx.renderPass.setPipeline(o.pipeline), this.ctx.renderPass.setBindGroup(0, this.ctx.cameraBindGroup), this.ctx.renderPass.setBindGroup(1, s), this.ctx.renderPass.setVertexBuffer(0, e.vertexBuffer), this.ctx.renderPass.setIndexBuffer(e.indexBuffer, "uint32"), this.ctx.renderPass.drawIndexed(e.indexCount), this.ctx.pickingDrawCalls.push({
      type: "indexed",
      vertexBuffer: e.vertexBuffer,
      indexBuffer: e.indexBuffer,
      indexCount: e.indexCount,
      layerId: this.ctx.currentLayerId
    });
  }
  drawPolygons(e, t) {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.cameraBindGroup || !this.ctx.bufferPool)
      return;
    const o = this.ensurePolygonPipeline(), i = new Float32Array(4);
    i[0] = t.color[0] / 255, i[1] = t.color[1] / 255, i[2] = t.color[2] / 255, i[3] = t.color[3] / 255;
    const a = t.color.join(","), n = D(
      this.ctx,
      this.polygonMaterials,
      a,
      i,
      "polygon-material",
      !1
    ), s = A(
      this.ctx,
      `polygon:${a}`,
      [n.resourceId],
      () => this.ctx.device.createBindGroup({
        label: "polygon-material-bind-group",
        layout: o.materialBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: n.buffer }
          }
        ]
      })
    );
    this.ctx.renderPass.setPipeline(o.pipeline), this.ctx.renderPass.setBindGroup(0, this.ctx.cameraBindGroup), this.ctx.renderPass.setBindGroup(1, s), this.ctx.renderPass.setVertexBuffer(0, e.vertexBuffer), this.ctx.renderPass.setIndexBuffer(e.indexBuffer, "uint32"), this.ctx.renderPass.drawIndexed(e.indexCount), this.ctx.pickingDrawCalls.push({
      type: "indexed",
      vertexBuffer: e.vertexBuffer,
      indexBuffer: e.indexBuffer,
      indexCount: e.indexCount,
      layerId: this.ctx.currentLayerId
    });
  }
  drawText(e, t) {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.cameraBindGroup || !this.ctx.bufferPool)
      return;
    const o = this.ensureTextPipeline(), i = new Float32Array(12);
    i[0] = t.color[0] / 255, i[1] = t.color[1] / 255, i[2] = t.color[2] / 255, i[3] = t.color[3] / 255, i[4] = (t.haloColor?.[0] ?? 0) / 255, i[5] = (t.haloColor?.[1] ?? 0) / 255, i[6] = (t.haloColor?.[2] ?? 0) / 255, i[7] = (t.haloColor?.[3] ?? 255) / 255, i[8] = t.fontSize, i[9] = t.haloWidth ?? 0;
    const a = {
      center: 0,
      left: 1,
      right: 2,
      top: 3,
      bottom: 4
    };
    i[10] = a[t.anchor] ?? 0, i[11] = 0;
    const n = [
      t.color.join(","),
      t.haloColor?.join(",") ?? "",
      t.fontSize,
      t.haloWidth ?? 0,
      t.anchor
    ].join(":"), s = D(
      this.ctx,
      this.textMaterials,
      n,
      i,
      "text-material",
      !1
    ), l = this.ctx.placeholderTexture, c = this.textureResourceRegistry.getResourceId(l, "placeholder-texture"), p = A(
      this.ctx,
      `text:${n}`,
      [s.resourceId, c],
      () => this.ctx.device.createBindGroup({
        label: "text-material-bind-group",
        layout: o.materialBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: s.buffer }
          },
          {
            binding: 1,
            resource: o.sampler
          },
          {
            binding: 2,
            resource: l.createView()
          }
        ]
      })
    );
    this.ctx.renderPass.setPipeline(o.pipeline), this.ctx.renderPass.setBindGroup(0, this.ctx.cameraBindGroup), this.ctx.renderPass.setBindGroup(1, p), this.ctx.renderPass.setVertexBuffer(0, e.vertexBuffer), this.ctx.renderPass.draw(6, e.count);
  }
  drawPostProcess(e) {
    if (!this.ctx.device || !this.ctx.context || !this.ctx.bufferPool)
      return;
    const t = this.ensurePostProcessPipeline(), o = this.ctx.canvas?.width || 1, i = this.ctx.canvas?.height || 1, a = new Float32Array(4);
    a[0] = 1 / o, a[1] = 1 / i, a[2] = 0.75, a[3] = 0;
    const n = D(
      this.ctx,
      this.postProcessMaterials,
      "default",
      a,
      "post-process-material",
      !0
    ), s = this.textureResourceRegistry.getResourceId(e, "post-process-scene"), l = A(
      this.ctx,
      `post-process:${o}x${i}`,
      [n.resourceId, s],
      () => this.ctx.device.createBindGroup({
        label: "post-process-bind-group",
        layout: t.bindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: n.buffer }
          },
          {
            binding: 1,
            resource: t.sampler
          },
          {
            binding: 2,
            resource: e.createView()
          }
        ]
      })
    ), c = this.ctx.device.createCommandEncoder({ label: "post-process-encoder" }), p = this.ctx.context.getCurrentTexture().createView(), u = c.beginRenderPass({
      label: "post-process-pass",
      colorAttachments: [
        {
          view: p,
          loadOp: "load",
          storeOp: "store"
        }
      ]
    });
    u.setPipeline(t.pipeline), u.setBindGroup(0, l), u.draw(4), u.end(), this.ctx.device.queue.submit([c.finish()]);
  }
  /**
   * Internal: 2D icon point rendering via sprite atlas.
   */
  _drawIconPoints(e, t) {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.cameraBindGroup || !this.ctx.bufferPool) return;
    const o = this.getIconAtlas(), i = o.getSprite(t.src);
    if (!i) return;
    const a = o.getTexture();
    if (!a) return;
    if (t.glowColor && t.glowSize && t.glowSize > 0) {
      const f = this.ensurePointPipeline(), h = new Float32Array(12);
      h[0] = t.glowColor[0] / 255, h[1] = t.glowColor[1] / 255, h[2] = t.glowColor[2] / 255, h[3] = t.glowColor[3] / 255 * 0.35, h[8] = t.size + t.glowSize * 2, h[9] = 0, h[10] = 0, h[11] = 1;
      const x = `icon-glow:${t.glowColor.join(",")}:${t.size}:${t.glowSize}`, g = D(
        this.ctx,
        this.pointMaterials,
        x,
        h,
        "point-material",
        !1
      ), b = A(
        this.ctx,
        `icon-glow:${x}`,
        [g.resourceId],
        () => this.ctx.device.createBindGroup({
          label: "icon-glow-bind-group",
          layout: f.materialBindGroupLayout,
          entries: [{ binding: 0, resource: { buffer: g.buffer } }]
        })
      );
      this.ctx.renderPass.setPipeline(f.pipeline), this.ctx.renderPass.setBindGroup(0, this.ctx.cameraBindGroup), this.ctx.renderPass.setBindGroup(1, b), this.ctx.renderPass.setVertexBuffer(0, e.vertexBuffer), this.ctx.renderPass.draw(6, e.count);
    }
    const n = this.ensureIconPipeline(), s = new Float32Array(20);
    s[0] = t.color[0] / 255, s[1] = t.color[1] / 255, s[2] = t.color[2] / 255, s[3] = t.color[3] / 255, s[4] = i.uv[0], s[5] = i.uv[1], s[6] = i.uv[2], s[7] = i.uv[3], s[8] = t.size, s[9] = t.rotation ?? 0, s[10] = (t.backgroundSize ?? 0) / 2, s[11] = t.outlineWidth ?? 0;
    const l = t.backgroundColor;
    s[12] = l ? l[0] / 255 : 0, s[13] = l ? l[1] / 255 : 0, s[14] = l ? l[2] / 255 : 0, s[15] = l ? l[3] / 255 : 0;
    const c = t.outlineColor;
    s[16] = c ? c[0] / 255 : 0, s[17] = c ? c[1] / 255 : 0, s[18] = c ? c[2] / 255 : 0, s[19] = c ? c[3] / 255 : 0;
    const p = [
      t.src ?? "",
      t.color.join(","),
      t.size,
      t.rotation ?? 0,
      t.backgroundColor?.join(",") ?? "",
      t.backgroundSize ?? 0,
      t.outlineColor?.join(",") ?? "",
      t.outlineWidth ?? 0,
      i.uv.join(",")
    ].join(":"), u = D(
      this.ctx,
      this.iconMaterials,
      p,
      s,
      "icon-material",
      !1
    ), d = this.textureResourceRegistry.getResourceId(a, "sprite-atlas-texture"), m = A(
      this.ctx,
      `icon:${p}`,
      [u.resourceId, d],
      () => this.ctx.device.createBindGroup({
        label: "icon-material-bind-group",
        layout: n.materialBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: u.buffer }
          },
          {
            binding: 1,
            resource: n.sampler
          },
          {
            binding: 2,
            resource: a.createView()
          }
        ]
      })
    );
    this.ctx.renderPass.setPipeline(n.pipeline), this.ctx.renderPass.setBindGroup(0, this.ctx.cameraBindGroup), this.ctx.renderPass.setBindGroup(1, m), this.ctx.renderPass.setVertexBuffer(0, e.vertexBuffer), this.ctx.renderPass.draw(6, e.count);
  }
  /**
   * Sprite atlas'a ikon ekle.
   */
  loadIcon(e, t) {
    if (!this.ctx.device) return;
    const o = this.getIconAtlas(), a = new OffscreenCanvas(t.width, t.height).getContext("2d");
    a.drawImage(t, 0, 0);
    const n = a.getImageData(0, 0, t.width, t.height), s = new Uint8Array(n.data.buffer);
    o.addSprite(e, s, t.width, t.height);
  }
  destroy() {
    this.pointPipeline = null, this.linePipeline = null, this.polygonPipeline = null, this.textPipeline = null, this.postProcessPipeline = null, this.iconPipeline = null, U(this.ctx, this.pointMaterials), U(this.ctx, this.lineMaterials), U(this.ctx, this.polygonMaterials), U(this.ctx, this.textMaterials), U(this.ctx, this.iconMaterials), U(this.ctx, this.postProcessMaterials);
  }
  reset() {
    this.destroy();
  }
}
class eo {
  constructor(e) {
    this.ctx = e;
  }
  modelPipeline = null;
  globeModelPipeline = null;
  modelManager = null;
  // ── Lazy Pipeline Init ──
  ensureModelPipeline() {
    return this.modelPipeline || (this.modelPipeline = ti({
      device: this.ctx.device,
      colorFormat: this.ctx.colorFormat,
      cameraBindGroupLayout: this.ctx.cameraBindGroupLayout,
      depthFormat: this.ctx.depthConfig.format,
      depthCompare: this.ctx.depthConfig.compareFunc,
      sampleCount: this.ctx.sampleCount
    })), this.modelPipeline;
  }
  ensureGlobeModelPipeline() {
    return this.globeModelPipeline || (this.ctx.ensureGlobeCameraResources(), this.globeModelPipeline = oi({
      device: this.ctx.device,
      colorFormat: this.ctx.colorFormat,
      globeCameraBindGroupLayout: this.ctx.globeCameraBindGroupLayout,
      depthFormat: this.ctx.depthConfig.format,
      depthCompare: this.ctx.depthConfig.compareFunc,
      sampleCount: this.ctx.sampleCount
    })), this.globeModelPipeline;
  }
  ensureModelManager() {
    return this.modelManager || (this.modelManager = new ai(this.ctx.device)), this.modelManager;
  }
  // ── Load ──
  async loadModel(e, t) {
    if (!this.ctx.device) return;
    const o = this.ensureModelManager();
    if (o.has(e)) return;
    const i = t instanceof ArrayBuffer ? gi(t) : xi(t.json, t.buffers);
    i.primitives.some((n) => n.imageData.size > 0) ? await o.uploadAsync(e, i) : o.upload(e, i);
  }
  // ── Draw Methods ──
  drawModels(e, t) {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.cameraBindGroup || !this.ctx.bufferPool)
      return;
    const i = this.ensureModelManager().get(t.modelId);
    if (!i) return;
    const a = this.ensureModelPipeline(), n = t.tintColor ?? [255, 255, 255, 255];
    for (const s of i.primitives) {
      const l = this._createMaterialBindGroup(s, n, a.materialBindGroupLayout, a.sampler);
      this.ctx.renderPass.setPipeline(a.pipeline), this.ctx.renderPass.setBindGroup(0, this.ctx.cameraBindGroup), this.ctx.renderPass.setBindGroup(1, l), this.ctx.renderPass.setVertexBuffer(0, s.vertexBuffer), this.ctx.renderPass.setVertexBuffer(1, e.instanceBuffer), this.ctx.renderPass.setIndexBuffer(s.indexBuffer, s.indexFormat), this.ctx.renderPass.drawIndexed(s.indexCount, e.instanceCount);
    }
  }
  drawGlobeModels(e, t) {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.bufferPool)
      return;
    const i = this.ensureModelManager().get(t.modelId);
    if (!i) return;
    const a = this.ensureGlobeModelPipeline();
    this.ctx.ensureGlobeCameraWritten();
    const n = t.tintColor ?? [255, 255, 255, 255];
    for (const s of i.primitives) {
      const l = this._createMaterialBindGroup(s, n, a.materialBindGroupLayout, a.sampler);
      this.ctx.renderPass.setPipeline(a.pipeline), this.ctx.renderPass.setBindGroup(0, this.ctx.globeCameraBindGroup), this.ctx.renderPass.setBindGroup(1, l), this.ctx.renderPass.setVertexBuffer(0, s.vertexBuffer), this.ctx.renderPass.setVertexBuffer(1, e.instanceBuffer), this.ctx.renderPass.setIndexBuffer(s.indexBuffer, s.indexFormat), this.ctx.renderPass.drawIndexed(s.indexCount, e.instanceCount);
    }
  }
  destroy() {
    this.modelPipeline = null, this.globeModelPipeline = null, this.modelManager?.destroy(), this.modelManager = null;
  }
  reset() {
    this.modelPipeline = null, this.globeModelPipeline = null, this.modelManager?.destroy(), this.modelManager = null;
  }
  // ── Private ──
  _createMaterialBindGroup(e, t, o, i) {
    const a = e.material, n = this.ctx.placeholderTexture, s = new Float32Array(20);
    s[0] = a.baseColorFactor[0], s[1] = a.baseColorFactor[1], s[2] = a.baseColorFactor[2], s[3] = a.baseColorFactor[3], s[4] = t[0] / 255, s[5] = t[1] / 255, s[6] = t[2] / 255, s[7] = t[3] / 255, s[8] = a.emissiveFactor[0], s[9] = a.emissiveFactor[1], s[10] = a.emissiveFactor[2], s[11] = a.metallicFactor, s[12] = a.roughnessFactor, s[13] = e.baseColorTexture ? 1 : 0, s[14] = e.normalTexture ? 1 : 0, s[15] = e.metallicRoughnessTexture ? 1 : 0, s[16] = e.occlusionTexture ? 1 : 0, s[17] = e.emissiveTexture ? 1 : 0, s[18] = a.alphaMode === "MASK" ? a.alphaCutoff : 0, s[19] = a.unlit ? 1 : 0;
    const l = this.ctx.bufferPool.allocateWithData(
      s,
      GPUBufferUsage.UNIFORM,
      "transient"
    );
    return this.ctx.device.createBindGroup({
      label: "model-material-bind-group",
      layout: o,
      entries: [
        { binding: 0, resource: { buffer: l } },
        { binding: 1, resource: i },
        { binding: 2, resource: (e.baseColorTexture ?? n).createView() },
        { binding: 3, resource: (e.normalTexture ?? n).createView() },
        { binding: 4, resource: (e.metallicRoughnessTexture ?? n).createView() },
        { binding: 5, resource: (e.occlusionTexture ?? n).createView() },
        { binding: 6, resource: (e.emissiveTexture ?? n).createView() }
      ]
    });
  }
}
class to {
  constructor(e) {
    this.ctx = e;
  }
  customPipelines = /* @__PURE__ */ new Map();
  /** Keys for which pipeline creation failed — prevents retrying every frame */
  customPipelineErrors = /* @__PURE__ */ new Set();
  _customDrawDbgCount = 0;
  drawCustom(e) {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.cameraBindGroup || !this.ctx.bufferPool || this.customPipelineErrors.has(e.pipelineKey)) return;
    e.useGlobeCamera && !this.ctx.globeCameraBindGroupLayout && this.ctx.ensureGlobeCameraResources();
    let t = this.customPipelines.get(e.pipelineKey);
    if (t)
      this._customDrawDbgCount < 3 && console.log("[CP3-PIPE]", { pipelineKey: e.pipelineKey, cached: !0, useGlobeCamera: e.useGlobeCamera });
    else try {
      const l = e.useGlobeCamera && this.ctx.globeCameraBindGroupLayout ? this.ctx.globeCameraBindGroupLayout : this.ctx.cameraBindGroupLayout;
      this._customDrawDbgCount < 3 && (console.log("[CP3-PIPE]", { pipelineKey: e.pipelineKey, cached: !1, useGlobeCamera: e.useGlobeCamera }), console.log("[CP3-CAM]", { globeLayout: !!(e.useGlobeCamera && this.ctx.globeCameraBindGroupLayout), camLayoutLabel: l.label ?? "n/a" }), console.log("[CP3-BLEND]", JSON.stringify(e.blendState))), t = Qr({
        device: this.ctx.device,
        colorFormat: this.ctx.colorFormat,
        depthFormat: this.ctx.depthConfig.format,
        cameraBindGroupLayout: l,
        shaderSource: e.shaderSource,
        vertexBufferLayouts: e.vertexBufferLayouts,
        topology: e.topology ?? "triangle-list",
        hasCustomUniforms: e.customUniforms !== null,
        hasTexture: e.textures.length > 0,
        blendState: e.blendState,
        sampleCount: this.ctx.sampleCount
      }), this.customPipelines.set(e.pipelineKey, t);
    } catch (l) {
      console.error(`[mapgpu] Custom pipeline creation failed for key "${e.pipelineKey}":`, l), console.error("[CP3-ERR]", l), this.customPipelineErrors.add(e.pipelineKey);
      return;
    }
    const o = this.ctx.bufferPool.allocateWithData(
      e.frameUniforms,
      GPUBufferUsage.UNIFORM,
      "transient"
    ), i = this.ctx.device.createBindGroup({
      label: "custom-frame-bind-group",
      layout: t.frameBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: o } }
      ]
    });
    let a = null;
    if (e.customUniforms && t.customBindGroupLayout) {
      const l = e.customUniforms instanceof Float32Array ? e.customUniforms : new Float32Array(e.customUniforms), c = this.ctx.bufferPool.allocateWithData(
        l,
        GPUBufferUsage.UNIFORM,
        "transient"
      );
      a = this.ctx.device.createBindGroup({
        label: "custom-user-bind-group",
        layout: t.customBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: c } }
        ]
      });
    }
    let n = null;
    if (e.textures.length > 0 && t.textureBindGroupLayout) {
      const l = e.textures[0], c = this.ctx.device.createSampler(l.sampler ?? {
        magFilter: "linear",
        minFilter: "linear",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge"
      });
      n = this.ctx.device.createBindGroup({
        label: "custom-texture-bind-group",
        layout: t.textureBindGroupLayout,
        entries: [
          { binding: 0, resource: c },
          { binding: 1, resource: l.texture.createView() }
        ]
      });
    }
    this.ctx.renderPass.setPipeline(t.pipeline), e.useGlobeCamera && this.ctx.globeCameraBindGroup ? (this.ctx.ensureGlobeCameraWritten(), this.ctx.renderPass.setBindGroup(0, this.ctx.globeCameraBindGroup)) : this.ctx.renderPass.setBindGroup(0, this.ctx.cameraBindGroup), this.ctx.renderPass.setBindGroup(1, i);
    let s = 2;
    if (t.customBindGroupLayout && (a && this.ctx.renderPass.setBindGroup(s, a), s++), t.textureBindGroupLayout) {
      if (!t.customBindGroupLayout) {
        const l = this.ctx.device.createBindGroupLayout({
          label: "custom-empty-placeholder",
          entries: []
        }), c = this.ctx.device.createBindGroup({
          label: "custom-empty-bind-group",
          layout: l,
          entries: []
        });
        this.ctx.renderPass.setBindGroup(2, c), s = 3;
      }
      n && this.ctx.renderPass.setBindGroup(s, n);
    }
    this._customDrawDbgCount < 3 && (console.log("[CP4-BIND]", {
      group0: e.useGlobeCamera ? "globe" : "flat",
      group1_frameSize: e.frameUniforms.byteLength,
      group2_customSize: e.customUniforms ? (e.customUniforms instanceof ArrayBuffer, e.customUniforms.byteLength) : null,
      group3_texture: e.textures.length > 0 ? "yes" : null
    }), console.log("[CP4-VB]", {
      bufferCount: e.vertexBuffers.length,
      bufferSizes: e.vertexBuffers.map((l) => l.size)
    }), console.log("[CP4-IB]", {
      hasIndex: !!e.indexBuffer,
      indexCount: e.indexCount,
      indexFormat: e.indexFormat
    }));
    for (let l = 0; l < e.vertexBuffers.length; l++)
      this.ctx.renderPass.setVertexBuffer(l, e.vertexBuffers[l]);
    e.indexBuffer ? (this.ctx.renderPass.setIndexBuffer(e.indexBuffer, e.indexFormat ?? "uint32"), this.ctx.renderPass.drawIndexed(e.indexCount ?? 0, e.instanceCount ?? 1), this._customDrawDbgCount < 3 && console.log("[CP4-DRAW]", { type: "drawIndexed", indexCount: e.indexCount ?? 0, instanceCount: e.instanceCount ?? 1 })) : (this.ctx.renderPass.draw(e.vertexCount ?? 0, e.instanceCount ?? 1), this._customDrawDbgCount < 3 && console.log("[CP4-DRAW]", { type: "draw", vertexCount: e.vertexCount ?? 0, instanceCount: e.instanceCount ?? 1 })), this._customDrawDbgCount < 3 && this._customDrawDbgCount++;
  }
  destroy() {
    this.customPipelines.clear(), this.customPipelineErrors.clear();
  }
  reset() {
    this.customPipelines.clear(), this.customPipelineErrors.clear();
  }
}
class ro {
  constructor(e) {
    this.ctx = e;
  }
  // Render pipelines (lazy init)
  renderPipeline2D = null;
  renderPipelineGlobe = null;
  // Per-layer state
  layerStates = /* @__PURE__ */ new Map();
  // Digit atlas texture (shared, init once)
  digitAtlasTexture = null;
  // ─── Source Upload ───
  setSource(e, t, o) {
    if (!this.ctx.device) return;
    const i = this.layerStates.get(e);
    if (i && i.sourceVersion === o) return;
    i?.sourceBuffer.destroy();
    const a = this.ctx.device.createBuffer({
      label: `cluster-source-${e}`,
      size: Math.max(t.byteLength, 4),
      // min 4 bytes for empty
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: !0
    });
    new Float32Array(a.getMappedRange()).set(t), a.unmap();
    const n = i?.countersBuffer ?? this.ctx.device.createBuffer({
      label: `cluster-counters-${e}`,
      size: 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.INDIRECT
    });
    this.layerStates.set(e, {
      sourceBuffer: a,
      sourcePoints: t,
      pointCount: t.length / 2,
      sourceVersion: o,
      outputBuffer: i?.outputBuffer ?? null,
      outputCapacity: i?.outputCapacity ?? 0,
      countersBuffer: n,
      lastResult: null,
      lastZoom: -1,
      lastExtentKey: "",
      lastClusterRadius: -1,
      lastMinClusterPoints: -1
    });
  }
  // ─── CPU Cluster + Render ───
  drawClusters(e, t, o, i, a, n, s) {
    const l = this.layerStates.get(e);
    if (!l || !this.ctx.device || !this.ctx.renderPass || l.pointCount === 0) return;
    this.digitAtlasTexture || (this.digitAtlasTexture = this._createDigitAtlas());
    const c = `${n[0]},${n[1]},${n[2]},${n[3]}`, p = Math.max(0, Math.floor(a)), u = p, d = Math.round(o * 100);
    (!l.lastResult || l.lastZoom !== u || l.lastExtentKey !== c || l.lastClusterRadius !== d || l.lastMinClusterPoints !== i) && (l.lastResult = Ai(
      l.sourcePoints,
      o,
      p,
      n,
      i
    ), l.lastZoom = u, l.lastExtentKey = c, l.lastClusterRadius = d, l.lastMinClusterPoints = i);
    const m = l.lastResult, f = m.entries.length;
    if (f === 0) return;
    const h = zi(m.entries);
    if (!l.outputBuffer || l.outputCapacity < f) {
      l.outputBuffer?.destroy();
      const v = Math.max(f, 64);
      l.outputBuffer = this.ctx.device.createBuffer({
        label: `cluster-output-${e}`,
        size: v * 16,
        // 16 bytes per ClusterOutput
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      }), l.outputCapacity = v;
    }
    this.ctx.device.queue.writeBuffer(l.outputBuffer, 0, h.buffer);
    const x = new Uint32Array([6, f, 0, 0]);
    this.ctx.device.queue.writeBuffer(l.countersBuffer, 0, x.buffer);
    const g = new Float32Array(36);
    g[0] = t.clusterFillSmall[0] / 255, g[1] = t.clusterFillSmall[1] / 255, g[2] = t.clusterFillSmall[2] / 255, g[3] = t.clusterFillSmall[3] / 255, g[4] = t.clusterFillMedium[0] / 255, g[5] = t.clusterFillMedium[1] / 255, g[6] = t.clusterFillMedium[2] / 255, g[7] = t.clusterFillMedium[3] / 255, g[8] = t.clusterFillLarge[0] / 255, g[9] = t.clusterFillLarge[1] / 255, g[10] = t.clusterFillLarge[2] / 255, g[11] = t.clusterFillLarge[3] / 255, g[12] = t.clusterStroke[0] / 255, g[13] = t.clusterStroke[1] / 255, g[14] = t.clusterStroke[2] / 255, g[15] = t.clusterStroke[3] / 255, g[16] = t.clusterText[0] / 255, g[17] = t.clusterText[1] / 255, g[18] = t.clusterText[2] / 255, g[19] = t.clusterText[3] / 255, g[20] = t.pointFill[0] / 255, g[21] = t.pointFill[1] / 255, g[22] = t.pointFill[2] / 255, g[23] = t.pointFill[3] / 255, g[24] = t.pointStroke[0] / 255, g[25] = t.pointStroke[1] / 255, g[26] = t.pointStroke[2] / 255, g[27] = t.pointStroke[3] / 255, g[28] = t.pointSize, g[29] = t.pointStrokeWidth, g[30] = t.clusterBaseSize, g[31] = t.clusterGrowRate, g[32] = t.clusterStrokeWidth, g[33] = 0, g[34] = 0, g[35] = 0;
    const b = this.ctx.bufferPool.allocateWithData(
      g,
      GPUBufferUsage.UNIFORM,
      "transient"
    );
    s ? this._drawGlobe(l, b) : this._draw2D(l, b);
  }
  // ─── 2D Render ───
  _draw2D(e, t) {
    if (!this.ctx.device || !this.ctx.renderPass) return;
    this.renderPipeline2D || (this.renderPipeline2D = Ii({
      device: this.ctx.device,
      colorFormat: this.ctx.colorFormat,
      cameraBindGroupLayout: this.ctx.cameraBindGroupLayout,
      depthFormat: this.ctx.depthConfig.format,
      depthCompare: this.ctx.depthConfig.compareFunc,
      sampleCount: this.ctx.sampleCount
    }));
    const o = this.ctx.device.createBindGroup({
      label: "cluster-render-bind-group",
      layout: this.renderPipeline2D.renderBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: e.outputBuffer } },
        { binding: 1, resource: { buffer: t } },
        { binding: 2, resource: this.digitAtlasTexture.createView() },
        { binding: 3, resource: this.renderPipeline2D.sampler }
      ]
    });
    this.ctx.renderPass.setPipeline(this.renderPipeline2D.pipeline), this.ctx.renderPass.setBindGroup(0, this.ctx.cameraBindGroup), this.ctx.renderPass.setBindGroup(1, o), this.ctx.renderPass.drawIndirect(e.countersBuffer, 0);
  }
  // ─── Globe Render ───
  _drawGlobe(e, t) {
    if (!this.ctx.device || !this.ctx.renderPass) return;
    this.ctx.ensureGlobeCameraResources(), this.ctx.ensureGlobeCameraWritten(), this.renderPipelineGlobe || (this.renderPipelineGlobe = ki({
      device: this.ctx.device,
      colorFormat: this.ctx.colorFormat,
      globeCameraBindGroupLayout: this.ctx.globeCameraBindGroupLayout,
      depthFormat: this.ctx.depthConfig.format,
      depthCompare: this.ctx.depthConfig.compareFunc,
      sampleCount: this.ctx.sampleCount
    }));
    const o = this.ctx.device.createBindGroup({
      label: "cluster-globe-render-bind-group",
      layout: this.renderPipelineGlobe.renderBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: e.outputBuffer } },
        { binding: 1, resource: { buffer: t } },
        { binding: 2, resource: this.digitAtlasTexture.createView() },
        { binding: 3, resource: this.renderPipelineGlobe.sampler }
      ]
    });
    this.ctx.renderPass.setPipeline(this.renderPipelineGlobe.pipeline), this.ctx.renderPass.setBindGroup(0, this.ctx.globeCameraBindGroup), this.ctx.renderPass.setBindGroup(1, o), this.ctx.renderPass.drawIndirect(e.countersBuffer, 0);
  }
  // ─── Digit Atlas (Canvas 2D) ───
  /**
   * Create a high-resolution RGBA texture containing digits 0-9.
   * Each digit occupies one square cell. Rendered via Canvas 2D with stroked text
   * for crisp, anti-aliased, readable text at all zoom levels.
   */
  _createDigitAtlas() {
    let i;
    if (typeof OffscreenCanvas < "u") {
      const s = new OffscreenCanvas(640, 64).getContext("2d");
      s.clearRect(0, 0, 640, 64), s.font = '700 46px "Roboto Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif', s.textAlign = "center", s.textBaseline = "middle", s.lineJoin = "round", s.lineCap = "round", s.lineWidth = 7, s.strokeStyle = "rgba(4, 10, 20, 0.92)", s.fillStyle = "white";
      for (let u = 0; u < 10; u++) {
        const d = u * 64 + 32, m = 64 * 0.52, f = String(u);
        s.strokeText(f, d, m), s.fillText(f, d, m);
      }
      const l = s.getImageData(0, 0, 640, 64), c = new Uint8Array(l.data.buffer);
      i = new Uint8Array(c.length);
      const p = 640 * 4;
      for (let u = 0; u < 64; u++) {
        const d = u * p, m = (63 - u) * p;
        i.set(c.subarray(d, d + p), m);
      }
    } else
      i = this._createBitmapDigitAtlas(640, 64, 64);
    const a = this.ctx.device.createTexture({
      label: "cluster-digit-atlas",
      size: { width: 640, height: 64 },
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });
    return this.ctx.device.queue.writeTexture(
      { texture: a },
      i.buffer,
      { bytesPerRow: 640 * 4 },
      { width: 640, height: 64 }
    ), a;
  }
  /**
   * Fallback bitmap digit atlas for environments without OffscreenCanvas.
   * Scaled 5×7 bitmap font to fill dynamic cells.
   */
  _createBitmapDigitAtlas(e, t, o) {
    const i = new Uint8Array(e * t * 4), a = [
      [14, 17, 19, 21, 25, 17, 14],
      [4, 12, 4, 4, 4, 4, 14],
      [14, 17, 1, 6, 8, 16, 31],
      [14, 17, 1, 6, 1, 17, 14],
      [2, 6, 10, 18, 31, 2, 2],
      [31, 16, 30, 1, 1, 17, 14],
      [6, 8, 16, 30, 17, 17, 14],
      [31, 1, 2, 4, 8, 8, 8],
      [14, 17, 17, 14, 17, 17, 14],
      [14, 17, 17, 15, 1, 2, 12]
    ], n = Math.max(3, Math.floor(o / 9)), s = 5 * n, l = 7 * n;
    for (let c = 0; c < 10; c++) {
      const p = a[c], d = c * o + Math.floor((o - s) / 2), m = Math.floor((t - l) / 2);
      for (let f = 0; f < 7; f++) {
        const h = p[f];
        for (let x = 0; x < 5; x++)
          if (h & 1 << 4 - x)
            for (let g = 0; g < n; g++)
              for (let b = 0; b < n; b++) {
                const v = d + x * n + b, P = m + f * n + g, C = t - 1 - P;
                if (v < e && C >= 0 && C < t) {
                  const S = (C * e + v) * 4;
                  i[S] = 255, i[S + 1] = 255, i[S + 2] = 255, i[S + 3] = 255;
                }
              }
      }
    }
    return i;
  }
  // ─── Lifecycle ───
  destroy() {
    for (const e of this.layerStates.values())
      e.sourceBuffer.destroy(), e.outputBuffer?.destroy(), e.countersBuffer.destroy();
    this.layerStates.clear(), this.digitAtlasTexture?.destroy(), this.digitAtlasTexture = null, this.renderPipeline2D = null, this.renderPipelineGlobe = null;
  }
}
class io {
  constructor(e) {
    this.ctx = e;
  }
  extrusionPipeline = null;
  globeExtrusionPipeline = null;
  extrusionMaterials = /* @__PURE__ */ new Map();
  globeExtrusionMaterials = /* @__PURE__ */ new Map();
  /** Tracks animation start per stable id (tileKey) or GPUBuffer fallback */
  animState = /* @__PURE__ */ new Map();
  /** Tile IDs whose grow animation has completed — never re-animate */
  animCompleted = /* @__PURE__ */ new Set();
  // ── Lazy Pipeline Init ──
  ensureExtrusionPipeline() {
    return this.extrusionPipeline || (this.extrusionPipeline = ji({
      device: this.ctx.device,
      colorFormat: this.ctx.colorFormat,
      cameraBindGroupLayout: this.ctx.cameraBindGroupLayout,
      depthFormat: this.ctx.depthConfig.format,
      depthCompare: this.ctx.depthConfig.compareFunc,
      sampleCount: this.ctx.sampleCount
    })), this.extrusionPipeline;
  }
  ensureGlobeExtrusionPipeline() {
    return this.globeExtrusionPipeline || (this.ctx.ensureGlobeCameraResources(), this.globeExtrusionPipeline = $i({
      device: this.ctx.device,
      colorFormat: this.ctx.colorFormat,
      globeCameraBindGroupLayout: this.ctx.globeCameraBindGroupLayout,
      depthFormat: this.ctx.depthConfig.format,
      depthCompare: this.ctx.depthConfig.compareFunc,
      sampleCount: this.ctx.sampleCount
    })), this.globeExtrusionPipeline;
  }
  // ── Draw Methods ──
  drawExtrusion(e, t) {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.cameraBindGroup || !this.ctx.bufferPool)
      return;
    const o = this.ensureExtrusionPipeline(), i = this._createMaterialResource(
      this.extrusionMaterials,
      t,
      "extrusion-material",
      e
    ), a = this.getOrCreateBindGroup(
      `extrusion:${t.color.join(",")}:${t.ambient ?? 0.35}`,
      [i.resourceId],
      () => this.ctx.device.createBindGroup({
        label: "extrusion-material-bind-group",
        layout: o.materialBindGroupLayout,
        entries: [{ binding: 0, resource: { buffer: i.buffer } }]
      })
    );
    this.ctx.renderPass.setPipeline(o.pipeline), this.ctx.renderPass.setBindGroup(0, this.ctx.cameraBindGroup), this.ctx.renderPass.setBindGroup(1, a), this.ctx.renderPass.setVertexBuffer(0, e.vertexBuffer), this.ctx.renderPass.setIndexBuffer(e.indexBuffer, "uint32"), this.ctx.renderPass.drawIndexed(e.indexCount);
  }
  drawGlobeExtrusion(e, t) {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.bufferPool)
      return;
    const o = this.ensureGlobeExtrusionPipeline();
    this.ctx.ensureGlobeCameraWritten();
    const i = this._createMaterialResource(
      this.globeExtrusionMaterials,
      t,
      "globe-extrusion-material",
      e,
      !0
      // isGlobe — 80-byte material with cameraPos
    ), a = this.getOrCreateBindGroup(
      `globe-extrusion:${t.color.join(",")}:${t.ambient ?? 0.35}`,
      [i.resourceId],
      () => this.ctx.device.createBindGroup({
        label: "globe-extrusion-material-bind-group",
        layout: o.materialBindGroupLayout,
        entries: [{ binding: 0, resource: { buffer: i.buffer } }]
      })
    );
    this.ctx.renderPass.setPipeline(o.pipeline), this.ctx.renderPass.setBindGroup(0, this.ctx.globeCameraBindGroup), this.ctx.renderPass.setBindGroup(1, a), this.ctx.renderPass.setVertexBuffer(0, e.vertexBuffer), this.ctx.renderPass.setIndexBuffer(e.indexBuffer, "uint32"), this.ctx.renderPass.drawIndexed(e.indexCount);
  }
  // ── Private ──
  _createMaterialResource(e, t, o, i, a = !1) {
    const n = this.ctx.extrusionDebugMode ? 1 : 0, s = t.animation, l = s ? (s.duration ?? 800) / 1e3 : 0, c = s?.delayFactor ?? 2, p = this.ctx.currentCamera;
    let u = 0;
    p && (u = Math.atan2(p.viewMatrix[1], p.viewMatrix[0]));
    let d = 0, m = 0.5, f = 0.5;
    const h = i.id ?? `buf:${i.vertexBuffer.label ?? String(this.animState.size)}`;
    let x = l;
    if (l > 0 && this.animCompleted.has(h) && (x = 0), x > 0) {
      let S = this.animState.get(h);
      if (!S) {
        if (p) {
          const y = 2003750834e-2;
          m = (p.position[0] + y) / (2 * y), f = 1 - (p.position[1] + y) / (2 * y);
        }
        S = { startTime: this.ctx.frameTime, origin: [m, f] }, this.animState.set(h, S);
      }
      d = this.ctx.frameTime - S.startTime, m = S.origin[0], f = S.origin[1];
      const R = 1.4142 * c;
      d < x + R ? this.ctx.needsContinuousRender = !0 : this.animCompleted.add(h);
    }
    const g = x > 0 && this.ctx.needsContinuousRender, b = t.color.join(","), v = g ? `${o}:anim:${h}:${b}:${this.ctx.frameTime}` : [b, t.ambient ?? 0.35, n].join(":"), P = a ? 20 : 16, C = new Float32Array(P);
    return C[0] = t.color[0] / 255, C[1] = t.color[1] / 255, C[2] = t.color[2] / 255, C[3] = t.color[3] / 255, C[4] = t.ambient ?? 0.35, C[5] = n, C[6] = d, C[7] = x, C[8] = m, C[9] = f, C[10] = c, C[11] = a ? 0 : u, C[12] = t.shininess ?? 32, C[13] = t.specularStrength ?? 0.15, a && p?.cameraMerc01 && (C[16] = p.cameraMerc01[0], C[17] = p.cameraMerc01[1], C[18] = p.cameraMerc01[2]), this.getOrCreateMaterialResource(
      e,
      v,
      C,
      o
    );
  }
  getOrCreateMaterialResource(e, t, o, i) {
    let a = e.get(t);
    if (!a) {
      const n = this.ctx.bufferPool.allocate(
        o.byteLength,
        GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        "persistent"
      );
      n.label = `${i}:${t}`, a = {
        buffer: n,
        resourceId: `buf-${n.label ?? `${i}:${t}`}`
      }, e.set(t, a);
    }
    return this.ctx.device.queue.writeBuffer(
      a.buffer,
      0,
      o.buffer,
      o.byteOffset,
      o.byteLength
    ), a;
  }
  getOrCreateBindGroup(e, t, o) {
    return this.ctx.bindGroupCache?.getOrCreate({ pipelineId: e, resourceIds: t }, o) ?? o();
  }
  releaseMaterials(e) {
    for (const { buffer: t } of e.values())
      this.ctx.bufferPool?.release(t);
    e.clear();
  }
  destroy() {
    this.extrusionPipeline = null, this.globeExtrusionPipeline = null, this.releaseMaterials(this.extrusionMaterials), this.releaseMaterials(this.globeExtrusionMaterials), this.animState.clear(), this.animCompleted.clear();
  }
}
const oo = (
  /* wgsl */
  `

${z}

struct Mesh3DMaterial {
  color: vec4<f32>,         // RGBA 0-1 (premultiplied in fragment)
  ambient: f32,
  shininess: f32,
  specularStrength: f32,
  _pad: f32,
};

@group(1) @binding(0) var<uniform> material: Mesh3DMaterial;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) vNormal: vec3<f32>,
  @location(1) worldPos: vec3<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;

  // XY comes in Mercator [0..1], convert to EPSG:3857 for 2D camera
  let HALF: f32 = 20037508.34;
  let epsg = vec2<f32>(
    input.position.x * 2.0 * HALF - HALF,
    (1.0 - input.position.y) * 2.0 * HALF - HALF
  );

  // Height (metres) + oblique 2.5D offset for visible 3D effect in top-down view
  let h = input.position.z;
  let obliqueMag: f32 = 0.5;
  let worldPos = vec3<f32>(
    epsg.x + h * obliqueMag,
    epsg.y + h * obliqueMag,
    h,
  );

  out.clipPosition = camera.viewProjection * vec4<f32>(worldPos, 1.0);
  out.worldPos = worldPos;
  out.vNormal = input.normal;

  // Logarithmic depth remap — matches extrusion pipeline.
  let absH = abs(h);
  let logH = log2(max(absH, 0.1) + 1.0);
  let logMax = log2(1001.0);
  let normalizedZ = clamp(0.5 - logH / (2.0 * logMax), 0.01, 0.99);
  out.clipPosition.z = normalizedZ * out.clipPosition.w;

  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let N = normalize(in.vNormal);
  let L = normalize(vec3<f32>(0.3, 0.8, 0.5)); // fixed directional light
  let V = normalize(vec3<f32>(0.0, 0.0, 1.0)); // approximate view direction
  let H = normalize(L + V); // Blinn half-vector

  // Diffuse
  let diff = max(dot(N, L), 0.0);

  // Specular (Blinn-Phong)
  let spec = pow(max(dot(N, H), 0.0), material.shininess) * material.specularStrength;

  let lighting = material.ambient + diff * (1.0 - material.ambient) + spec;
  let baseColor = material.color.rgb * lighting;
  let alpha = material.color.a;

  // Premultiplied alpha output
  return vec4<f32>(baseColor * alpha, alpha);
}
`
);
function ao(r) {
  return r.createBindGroupLayout({
    label: "mesh3d-material-bind-group-layout",
    entries: [{
      binding: 0,
      visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
      buffer: { type: "uniform" }
    }]
  });
}
function Qe(r) {
  const { device: e, colorFormat: t, cameraBindGroupLayout: o } = r, i = ao(e), a = e.createShaderModule({
    label: "mesh3d-shader",
    code: oo
  });
  return { pipeline: e.createRenderPipeline({
    label: "mesh3d-pipeline",
    layout: e.createPipelineLayout({
      label: "mesh3d-pipeline-layout",
      bindGroupLayouts: [o, i]
    }),
    vertex: {
      module: a,
      entryPoint: "vs_main",
      buffers: [{
        arrayStride: 24,
        // 6 × 4 bytes (position vec3 + normal vec3)
        stepMode: "vertex",
        attributes: [
          { shaderLocation: 0, offset: 0, format: "float32x3" },
          // position
          { shaderLocation: 1, offset: 12, format: "float32x3" }
          // normal
        ]
      }]
    },
    fragment: {
      module: a,
      entryPoint: "fs_main",
      targets: [{
        format: t,
        blend: {
          color: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
          alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" }
        }
      }]
    },
    primitive: { topology: "triangle-list", cullMode: "none" },
    depthStencil: {
      format: r.depthFormat ?? "depth24plus",
      depthWriteEnabled: r.depthWriteEnabled ?? !0,
      depthCompare: r.depthCompare ?? "less"
    },
    multisample: { count: r.sampleCount ?? E }
  }), materialBindGroupLayout: i };
}
const no = (
  /* wgsl */
  `

${N}

const EARTH_RADIUS_M: f32 = 6378137.0;

struct Mesh3DMaterial {
  color: vec4<f32>,
  ambient: f32,
  shininess: f32,
  specularStrength: f32,
  _pad: f32,
};

@group(1) @binding(0) var<uniform> material: Mesh3DMaterial;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) vNormal: vec3<f32>,
  @location(1) worldPos: vec3<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;

  // XY in Mercator [0..1], Z = height (metres)
  let merc01 = input.position.xy;
  let ang = mercatorToAngular(merc01);
  let sphereBase = angularToSphere(ang.x, ang.y);

  // Radial height: position on sphere at (1 + h/R)
  let h = input.position.z;
  let radius = 1.0 + h / EARTH_RADIUS_M;
  let worldPos = sphereBase * radius;

  // Horizon clipping
  let clipZ = globeClippingZ(sphereBase);
  if clipZ < -0.01 {
    out.clipPosition = vec4<f32>(0.0, 0.0, -2.0, 1.0); // behind camera
    return out;
  }

  var globeClip = camera.viewProjection * vec4<f32>(worldPos, 1.0);

  // Depth: use globe clipping Z + height bias (matches extrusion pattern)
  let heightBias = abs(h) / EARTH_RADIUS_M;
  let effectiveClipZ = select(clipZ, min(clipZ + 0.0001 + heightBias, 0.9999), clipZ <= 1.0);
  globeClip.z = effectiveClipZ * globeClip.w;

  // Flat path for transition zone
  let heightScale = h / EARTH_RADIUS_M;
  let flatPos = vec4<f32>(merc01.x, merc01.y, heightScale, 1.0);

  if (camera.projectionTransition >= 0.999) {
    out.clipPosition = globeClip;
  } else if (camera.projectionTransition <= 0.001) {
    out.clipPosition = camera.flatViewProjection * flatPos;
  } else {
    var flatClip = camera.flatViewProjection * flatPos;
    out.clipPosition = mix(flatClip, globeClip, camera.projectionTransition);
  }

  out.worldPos = worldPos;

  // Transform normals to globe tangent space
  let cosLat = cos(ang.y);
  let sinLat = sin(ang.y);
  let cosLon = cos(ang.x);
  let sinLon = sin(ang.x);
  let east = vec3<f32>(cosLon, 0.0, -sinLon);
  let north = vec3<f32>(-sinLat * sinLon, cosLat, -sinLat * cosLon);
  let up = sphereBase;

  out.vNormal = normalize(
    input.normal.x * east +
    input.normal.y * up +
    input.normal.z * north
  );

  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let N = normalize(in.vNormal);
  let L = normalize(vec3<f32>(0.3, 0.8, 0.5));
  let V = normalize(-in.worldPos);
  let H = normalize(L + V);

  let diff = max(dot(N, L), 0.0);
  let spec = pow(max(dot(N, H), 0.0), material.shininess) * material.specularStrength;
  let lighting = material.ambient + diff * (1.0 - material.ambient) + spec;
  let baseColor = material.color.rgb * lighting;
  let alpha = material.color.a;

  return vec4<f32>(baseColor * alpha, alpha);
}
`
);
function Je(r) {
  const { device: e, colorFormat: t, globeCameraBindGroupLayout: o } = r, i = e.createBindGroupLayout({
    label: "globe-mesh3d-material-bind-group-layout",
    entries: [{
      binding: 0,
      visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
      buffer: { type: "uniform" }
    }]
  }), a = e.createShaderModule({
    label: "globe-mesh3d-shader",
    code: no
  });
  return { pipeline: e.createRenderPipeline({
    label: "globe-mesh3d-pipeline",
    layout: e.createPipelineLayout({
      label: "globe-mesh3d-pipeline-layout",
      bindGroupLayouts: [o, i]
    }),
    vertex: {
      module: a,
      entryPoint: "vs_main",
      buffers: [{
        arrayStride: 24,
        stepMode: "vertex",
        attributes: [
          { shaderLocation: 0, offset: 0, format: "float32x3" },
          { shaderLocation: 1, offset: 12, format: "float32x3" }
        ]
      }]
    },
    fragment: {
      module: a,
      entryPoint: "fs_main",
      targets: [{
        format: t,
        blend: {
          color: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
          alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" }
        }
      }]
    },
    primitive: { topology: "triangle-list", cullMode: "none" },
    depthStencil: {
      format: r.depthFormat ?? "depth24plus",
      depthWriteEnabled: r.depthWriteEnabled ?? !0,
      depthCompare: r.depthCompare ?? "less"
    },
    multisample: { count: r.sampleCount ?? E }
  }), materialBindGroupLayout: i };
}
const so = 32;
class lo {
  constructor(e) {
    this.ctx = e;
  }
  _pipeline = null;
  _transparentPipeline = null;
  _globePipeline = null;
  _transparentGlobePipeline = null;
  _materials = /* @__PURE__ */ new Map();
  _globeMaterials = /* @__PURE__ */ new Map();
  // ─── Lazy Pipeline Init ───
  _ensurePipeline() {
    return this._pipeline || (this._pipeline = Qe({
      device: this.ctx.device,
      colorFormat: this.ctx.colorFormat,
      cameraBindGroupLayout: this.ctx.cameraBindGroupLayout,
      depthFormat: this.ctx.depthConfig.format,
      depthCompare: this.ctx.depthConfig.compareFunc,
      depthWriteEnabled: !0,
      sampleCount: this.ctx.sampleCount
    })), this._pipeline;
  }
  _ensureTransparentPipeline() {
    return this._transparentPipeline || (this._transparentPipeline = Qe({
      device: this.ctx.device,
      colorFormat: this.ctx.colorFormat,
      cameraBindGroupLayout: this.ctx.cameraBindGroupLayout,
      depthFormat: this.ctx.depthConfig.format,
      depthCompare: this.ctx.depthConfig.compareFunc,
      depthWriteEnabled: !1,
      sampleCount: this.ctx.sampleCount
    })), this._transparentPipeline;
  }
  _ensureGlobePipeline() {
    return this._globePipeline || (this.ctx.ensureGlobeCameraResources(), this._globePipeline = Je({
      device: this.ctx.device,
      colorFormat: this.ctx.colorFormat,
      globeCameraBindGroupLayout: this.ctx.globeCameraBindGroupLayout,
      depthFormat: this.ctx.depthConfig.format,
      depthCompare: this.ctx.depthConfig.compareFunc,
      depthWriteEnabled: !0,
      sampleCount: this.ctx.sampleCount
    })), this._globePipeline;
  }
  _ensureTransparentGlobePipeline() {
    return this._transparentGlobePipeline || (this.ctx.ensureGlobeCameraResources(), this._transparentGlobePipeline = Je({
      device: this.ctx.device,
      colorFormat: this.ctx.colorFormat,
      globeCameraBindGroupLayout: this.ctx.globeCameraBindGroupLayout,
      depthFormat: this.ctx.depthConfig.format,
      depthCompare: this.ctx.depthConfig.compareFunc,
      depthWriteEnabled: !1,
      sampleCount: this.ctx.sampleCount
    })), this._transparentGlobePipeline;
  }
  // ─── Draw Methods ───
  drawMesh3D(e, t) {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.cameraBindGroup) return;
    const o = t.color[3] < 255 ? this._ensureTransparentPipeline() : this._ensurePipeline(), i = this._getOrCreateMaterial(this._materials, t, o.materialBindGroupLayout);
    this.ctx.renderPass.setPipeline(o.pipeline), this.ctx.renderPass.setBindGroup(0, this.ctx.cameraBindGroup), this.ctx.renderPass.setBindGroup(1, i.bindGroup), this.ctx.renderPass.setVertexBuffer(0, e.vertexBuffer), this.ctx.renderPass.setIndexBuffer(e.indexBuffer, "uint32"), this.ctx.renderPass.drawIndexed(e.indexCount);
  }
  drawGlobeMesh3D(e, t) {
    if (!this.ctx.device || !this.ctx.renderPass) return;
    const o = t.color[3] < 255 ? this._ensureTransparentGlobePipeline() : this._ensureGlobePipeline();
    this.ctx.ensureGlobeCameraWritten();
    const i = this._getOrCreateMaterial(this._globeMaterials, t, o.materialBindGroupLayout);
    this.ctx.renderPass.setPipeline(o.pipeline), this.ctx.renderPass.setBindGroup(0, this.ctx.globeCameraBindGroup), this.ctx.renderPass.setBindGroup(1, i.bindGroup), this.ctx.renderPass.setVertexBuffer(0, e.vertexBuffer), this.ctx.renderPass.setIndexBuffer(e.indexBuffer, "uint32"), this.ctx.renderPass.drawIndexed(e.indexCount);
  }
  // ─── Material Cache ───
  _getOrCreateMaterial(e, t, o) {
    const i = `${t.color.join(",")}:${t.ambient ?? 0.35}:${t.shininess ?? 32}:${t.specularStrength ?? 0.15}`;
    let a = e.get(i);
    if (a) return a;
    const n = new Float32Array(8);
    n[0] = t.color[0] / 255, n[1] = t.color[1] / 255, n[2] = t.color[2] / 255, n[3] = t.color[3] / 255, n[4] = t.ambient ?? 0.35, n[5] = t.shininess ?? 32, n[6] = t.specularStrength ?? 0.15, n[7] = 0;
    const s = this.ctx.device.createBuffer({
      label: "mesh3d-material",
      size: so,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.ctx.device.queue.writeBuffer(s, 0, n);
    const l = this.ctx.device.createBindGroup({
      label: "mesh3d-material-bind-group",
      layout: o,
      entries: [{ binding: 0, resource: { buffer: s } }]
    });
    return a = { buffer: s, bindGroup: l }, e.set(i, a), a;
  }
  destroy() {
    for (const e of this._materials.values()) e.buffer.destroy();
    for (const e of this._globeMaterials.values()) e.buffer.destroy();
    this._materials.clear(), this._globeMaterials.clear(), this._pipeline = null, this._transparentPipeline = null, this._globePipeline = null, this._transparentGlobePipeline = null;
  }
}
class Eo {
  // ─── Shared State ───
  ctx = new At();
  // ─── Capabilities ───
  _capabilities = null;
  // ─── Resource Managers ───
  textureManager = null;
  bindGroupCache = null;
  iconAtlas = null;
  // ─── Delegates ───
  pickingDelegate = null;
  rasterDelegate = null;
  globeDelegate = null;
  vectorDelegate = null;
  modelDelegate = null;
  _gltf2Renderer = null;
  customDelegate = null;
  clusterDelegate = null;
  extrusionDelegate = null;
  mesh3dDelegate = null;
  loadedModelSources = /* @__PURE__ */ new Map();
  loadedModelV2Sources = /* @__PURE__ */ new Map();
  // ─── Clear Color ───
  _clearColor = { r: 0.05, g: 0.05, b: 0.1, a: 1 };
  /**
   * Mevcut GPU yetenekleri.
   */
  get capabilities() {
    if (!this._capabilities)
      throw new Error("[mapgpu] RenderEngine not initialized. Call init() first.");
    return this._capabilities;
  }
  /**
   * Expose depth config for pipeline creation.
   */
  get depthConfig() {
    return this.ctx.depthConfig;
  }
  /**
   * Whether any delegate requested continuous rendering (e.g., active animation).
   * Checked by the render loop after endFrame to keep rendering.
   */
  get needsContinuousRender() {
    return this.ctx.needsContinuousRender;
  }
  // ── Icon Atlas (shared between vector and globe delegates) ──
  ensureIconAtlas() {
    return this.iconAtlas || (this.iconAtlas = new or(this.ctx.device)), this.iconAtlas;
  }
  /**
   * WebGPU device init + capability detection.
   */
  async init(e, t) {
    this.ctx.canvas = e, this.ctx.depthConfig = t ?? rt;
    const o = await bt();
    if (!o.device || !o.adapter)
      return this._capabilities = {
        mode: o.mode,
        features: o.features,
        limits: o.limits
      }, this._capabilities;
    this.ctx.device = o.device, this.ctx.device.lost.then((a) => {
      a.reason !== "destroyed" && (this.ctx.deviceLost = !0, console.error(
        `[mapgpu] GPU device lost: ${a.reason} — ${a.message}`
      ));
    }), this.ctx.device.addEventListener("uncapturederror", (a) => {
      console.error("[mapgpu] GPU VALIDATION ERROR:", a.error.message);
    }), this.ctx.context = e.getContext("webgpu"), this.ctx.colorFormat = navigator.gpu.getPreferredCanvasFormat(), this.ctx.context.configure({
      device: this.ctx.device,
      format: this.ctx.colorFormat,
      alphaMode: "premultiplied"
    }), this.ctx.bufferPool = new Pt(this.ctx.device), this.textureManager = new Ct(this.ctx.device), this.bindGroupCache = new wt(), this.ctx.bindGroupCache = this.bindGroupCache, this.ctx.cameraBuffer = this.ctx.bufferPool.allocate(
      Lt,
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      "persistent"
    ), this.ctx.cameraBindGroupLayout = zt(this.ctx.device), this.ctx.cameraBindGroup = this.ctx.device.createBindGroup({
      label: "camera-bind-group",
      layout: this.ctx.cameraBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.ctx.cameraBuffer }
        }
      ]
    }), this.ctx.msaaColorTexture = this.ctx.device.createTexture({
      label: "msaa-color-texture",
      size: { width: e.width || 1, height: e.height || 1 },
      format: this.ctx.colorFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      sampleCount: this.ctx.sampleCount
    }), this.ctx.depthTexture = this.ctx.device.createTexture({
      label: "main-depth-texture",
      size: { width: e.width || 1, height: e.height || 1 },
      format: this.ctx.depthConfig.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      sampleCount: this.ctx.sampleCount
    }), this.ctx.placeholderTexture = this.ctx.device.createTexture({
      label: "placeholder-texture",
      size: { width: 1, height: 1 },
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    }), this.ctx.device.queue.writeTexture(
      { texture: this.ctx.placeholderTexture },
      new Uint8Array([255, 255, 255, 255]),
      { bytesPerRow: 4 },
      { width: 1, height: 1 }
    );
    const i = () => this.ensureIconAtlas();
    if (this.pickingDelegate = new Yi(this.ctx), this.rasterDelegate = new Zi(this.ctx), this.globeDelegate = new qi(this.ctx, i), this.vectorDelegate = new Ji(this.ctx, i), this.modelDelegate = new eo(this.ctx), this.ctx.device) {
      const { Gltf2Renderer: a } = await Promise.resolve().then(() => Di);
      this._gltf2Renderer = new a(this.ctx.device);
    }
    return this.customDelegate = new to(this.ctx), this.clusterDelegate = new ro(this.ctx), this.extrusionDelegate = new io(this.ctx), this.mesh3dDelegate = new lo(this.ctx), this.rasterDelegate.initRasterPipeline(), this._capabilities = {
      mode: o.mode,
      features: o.features,
      limits: o.limits
    }, await this.restoreLoadedModels(), this._capabilities;
  }
  /**
   * Clear color ayarla (RGBA, 0-1 araligi).
   */
  setClearColor(e, t, o, i) {
    this._clearColor = { r: e, g: t, b: o, a: i };
  }
  /**
   * Toggle wireframe debug overlay on raster tiles.
   */
  setDebugTileVertices(e) {
    this.ctx.debugTileVertices = e;
  }
  setExtrusionDebug(e) {
    this.ctx.extrusionDebugMode = e;
  }
  setLighting(e) {
    this.ctx.lightConfig = e;
  }
  applyDebugBrush(e, t, o, i, a) {
    if (this.ctx.device) {
      if (!this.ctx.heightBrush) {
        const n = Tt(this.ctx.device);
        this.ctx.heightBrush = new St(this.ctx.device, n);
      }
      this.ctx.heightBrush.apply(e, t, o, i, a);
    }
  }
  clearDebugBrush() {
    this.ctx.heightBrush?.clear();
  }
  setHeightExaggeration(e) {
    this.ctx.heightExaggeration = e;
  }
  /**
   * Frame baslangici — camera uniform guncelle, per-frame attachments hazirla.
   */
  beginFrame(e) {
    if (!this.ctx.device || !this.ctx.context || this.ctx.deviceLost) return;
    this.ctx.frameTime += 1 / 60, this.ctx.needsContinuousRender = !1, this.ctx.pickingDrawCalls = [], this.ctx.currentCamera = e;
    const t = J(e.projectionMatrix, e.viewMatrix), o = e.position, i = J(
      t,
      Et(o[0] ?? 0, o[1] ?? 0, o[2] ?? 0)
    ), a = new Float32Array(40);
    a.set(t, 0), a[16] = e.viewportWidth, a[17] = e.viewportHeight, a.set(i, 20), a[36] = o[0] ?? 0, a[37] = o[1] ?? 0, a[38] = o[2] ?? 0, this.ctx.device.queue.writeBuffer(this.ctx.cameraBuffer, 0, a.buffer), this.ctx.globeCameraBuffer && e.projectionTransition !== void 0 && this.ctx.writeGlobeCamera(e), this.ctx.heightBrush?.flush(this.ctx.device);
    const n = this.ctx.canvas?.width || 1, s = this.ctx.canvas?.height || 1;
    this.ctx.depthTexture && (this.ctx.depthTexture.width !== n || this.ctx.depthTexture.height !== s) && (this.ctx.depthTexture.destroy(), this.ctx.depthTexture = this.ctx.device.createTexture({
      label: "main-depth-texture",
      size: { width: n, height: s },
      format: this.ctx.depthConfig.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      sampleCount: this.ctx.sampleCount
    }), this.ctx.msaaColorTexture && (this.ctx.msaaColorTexture.destroy(), this.ctx.msaaColorTexture = this.ctx.device.createTexture({
      label: "msaa-color-texture",
      size: { width: n, height: s },
      format: this.ctx.colorFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      sampleCount: this.ctx.sampleCount
    }))), this.ctx.commandEncoder = this.ctx.device.createCommandEncoder({
      label: "frame-command-encoder"
    }), this.ctx.swapChainView = this.ctx.context.getCurrentTexture().createView(), this.ctx.msaaColorView = this.ctx.msaaColorTexture?.createView() ?? null, this.ctx.depthView = this.ctx.depthTexture?.createView() ?? null, this.ctx.backgroundPass = null, this.ctx.renderPass = null;
  }
  ensureBackgroundRenderPass() {
    !this.ctx.commandEncoder || this.ctx.backgroundPass || this.ctx.renderPass || !this.ctx.swapChainView || (this.ctx.backgroundPass = this.ctx.commandEncoder.beginRenderPass({
      label: "background-render-pass",
      colorAttachments: [
        this.ctx.msaaColorView ? {
          view: this.ctx.msaaColorView,
          resolveTarget: this.ctx.swapChainView,
          clearValue: this._clearColor,
          loadOp: "clear",
          storeOp: "store"
        } : {
          view: this.ctx.swapChainView,
          clearValue: this._clearColor,
          loadOp: "clear",
          storeOp: "store"
        }
      ]
    }));
  }
  ensureSceneRenderPass() {
    if (!this.ctx.commandEncoder || this.ctx.renderPass || !this.ctx.swapChainView) return;
    const e = this.ctx.backgroundPass !== null;
    this.ctx.backgroundPass && (this.ctx.backgroundPass.end(), this.ctx.backgroundPass = null), this.ctx.renderPass = this.ctx.commandEncoder.beginRenderPass({
      label: "main-render-pass",
      colorAttachments: [
        this.ctx.msaaColorView ? {
          view: this.ctx.msaaColorView,
          resolveTarget: this.ctx.swapChainView,
          clearValue: this._clearColor,
          loadOp: e ? "load" : "clear",
          storeOp: "discard"
        } : {
          view: this.ctx.swapChainView,
          clearValue: this._clearColor,
          loadOp: e ? "load" : "clear",
          storeOp: "store"
        }
      ],
      depthStencilAttachment: this.ctx.depthView ? {
        view: this.ctx.depthView,
        depthClearValue: this.ctx.depthConfig.clearValue,
        depthLoadOp: "clear",
        depthStoreOp: "store"
      } : void 0
    });
  }
  // ── Draw Methods (delegate one-liners) ──
  drawImagery(e) {
    this.ensureSceneRenderPass(), this.rasterDelegate?.drawImagery(e);
  }
  drawGlobeTile(e) {
    this.ensureSceneRenderPass(), this.rasterDelegate?.drawGlobeTile(e);
  }
  drawPoleCaps(e) {
    this.ensureSceneRenderPass(), this.globeDelegate?.drawPoleCaps(e);
  }
  drawSky(e, t, o) {
    this.ensureBackgroundRenderPass(), this.globeDelegate?.drawSky(e, t, o);
  }
  drawAtmosphere(e, t) {
    this.ensureSceneRenderPass(), this.globeDelegate?.drawAtmosphere(e, t);
  }
  drawGlobePoints(e, t) {
    this.ensureSceneRenderPass(), this.globeDelegate?.drawGlobePoints(e, t);
  }
  drawGlobeLines(e, t) {
    this.ensureSceneRenderPass(), this.globeDelegate?.drawGlobeLines(e, t);
  }
  drawGlobePolygons(e, t) {
    this.ensureSceneRenderPass(), this.globeDelegate?.drawGlobePolygons(e, t);
  }
  drawPoints(e, t) {
    this.ensureSceneRenderPass(), this.vectorDelegate?.drawPoints(e, t);
  }
  drawLines(e, t) {
    this.ensureSceneRenderPass(), this.vectorDelegate?.drawLines(e, t);
  }
  drawPolygons(e, t) {
    this.ensureSceneRenderPass(), this.vectorDelegate?.drawPolygons(e, t);
  }
  drawText(e, t) {
    this.ensureSceneRenderPass(), this.vectorDelegate?.drawText(e, t);
  }
  drawPostProcess(e) {
    this.ensureSceneRenderPass(), this.vectorDelegate?.drawPostProcess(e);
  }
  drawCustom(e) {
    this.ensureSceneRenderPass(), this.customDelegate?.drawCustom(e);
  }
  async loadModel(e, t) {
    this.loadedModelSources.set(e, et(t)), await this.modelDelegate?.loadModel(e, t);
  }
  drawModels(e, t) {
    if (this.ensureSceneRenderPass(), this._gltf2Renderer?.has(t.modelId)) {
      this.drawModelsV2(e, t);
      return;
    }
    this.modelDelegate?.drawModels(e, t);
  }
  drawGlobeModels(e, t) {
    if (this.ensureSceneRenderPass(), this._gltf2Renderer?.has(t.modelId)) {
      this.drawGlobeModelsV2(e, t);
      return;
    }
    this.modelDelegate?.drawGlobeModels(e, t);
  }
  // ─── GLTF2 Renderer (V2) ───
  async loadModelV2(e, t) {
    this.loadedModelV2Sources.set(e, tt(t)), await this._gltf2Renderer?.loadModel(e, t);
  }
  getModelMetadata(e) {
    return this._gltf2Renderer ? (this._gltf2Renderer.syncAnimationState(e, this.ctx.frameTime), this._gltf2Renderer.getModelMetadata(e)) : null;
  }
  resolveModelBounds(e) {
    return this._gltf2Renderer ? (this._gltf2Renderer.syncAnimationState(e.modelId, this.ctx.frameTime), this._gltf2Renderer.resolveModelBounds(e)) : null;
  }
  getModelGroundAnchorUnitsV2(e) {
    return this.getModelMetadata(e)?.groundAnchorLocalZ ?? null;
  }
  getModelBoundingBoxV2(e) {
    return this.getModelMetadata(e)?.localBounds ?? null;
  }
  drawModelsV2(e, t) {
    this.ensureSceneRenderPass(), !(!this._gltf2Renderer || !this.ctx.renderPass || !this.ctx.cameraBindGroup || !this.ctx.cameraBindGroupLayout) && (this._gltf2Renderer.isAnimated(t.modelId) && (this.ctx.needsContinuousRender = !0), this._gltf2Renderer.drawFlat(
      this.ctx.renderPass,
      e,
      this.ctx.cameraBindGroup,
      this.ctx.cameraBindGroupLayout,
      this.ctx.colorFormat,
      this.ctx.depthConfig.format,
      t.modelId,
      this.ctx.frameTime
    ));
  }
  drawGlobeModelsV2(e, t) {
    this.ensureSceneRenderPass(), !(!this._gltf2Renderer || !this.ctx.renderPass || !this.ctx.globeCameraBindGroup || !this.ctx.globeCameraBindGroupLayout) && (this._gltf2Renderer.isAnimated(t.modelId) && (this.ctx.needsContinuousRender = !0), this._gltf2Renderer.drawGlobe(
      this.ctx.renderPass,
      e,
      this.ctx.globeCameraBindGroup,
      this.ctx.globeCameraBindGroupLayout,
      this.ctx.colorFormat,
      this.ctx.depthConfig.format,
      t.modelId,
      this.ctx.frameTime
    ));
  }
  drawExtrusion(e, t) {
    this.ensureSceneRenderPass(), this.extrusionDelegate?.drawExtrusion(e, t);
  }
  drawGlobeExtrusion(e, t) {
    this.ensureSceneRenderPass(), this.extrusionDelegate?.drawGlobeExtrusion(e, t);
  }
  drawMesh3D(e, t) {
    this.ensureSceneRenderPass(), this.mesh3dDelegate?.drawMesh3D(e, t);
  }
  drawGlobeMesh3D(e, t) {
    this.ensureSceneRenderPass(), this.mesh3dDelegate?.drawGlobeMesh3D(e, t);
  }
  setClusterSource(e, t, o) {
    this.clusterDelegate?.setSource(e, t, o);
  }
  drawClusters(e, t, o, i, a, n, s) {
    this.ensureSceneRenderPass(), this.clusterDelegate?.drawClusters(e, t, o, i, a, n, s);
  }
  loadIcon(e, t) {
    this.vectorDelegate?.loadIcon(e, t);
  }
  setCurrentLayerId(e) {
    this.ctx.currentLayerId = e;
  }
  setPickingEnabled(e) {
    this.ctx.pickingEnabled = e;
  }
  async pick(e, t) {
    return this.ctx.pickingEnabled ? this.pickingDelegate?.pick(e, t) ?? null : null;
  }
  /**
   * Frame bitisi — command buffer submit, transient buffer cleanup.
   */
  endFrame() {
    if (!this.ctx.device || !this.ctx.commandEncoder) return;
    !this.ctx.backgroundPass && !this.ctx.renderPass && this.ensureBackgroundRenderPass(), this.ctx.backgroundPass && (this.ctx.backgroundPass.end(), this.ctx.backgroundPass = null), this.ctx.renderPass && (this.ctx.renderPass.end(), this.ctx.renderPass = null);
    const e = this.ctx.commandEncoder.finish();
    this.ctx.device.queue.submit([e]), this.ctx.commandEncoder = null, this.ctx.swapChainView = null, this.ctx.msaaColorView = null, this.ctx.depthView = null, this.ctx.bufferPool?.releaseTransient();
  }
  // ── Buffer / Texture Management ──
  createTexture(e) {
    if (!this.textureManager)
      throw new Error("[mapgpu] RenderEngine not initialized.");
    return this.textureManager.createFromImageBitmap(e);
  }
  createTextureFromVideo(e) {
    if (!this.textureManager)
      throw new Error("[mapgpu] RenderEngine not initialized.");
    return this.textureManager.createFromVideoElement(e);
  }
  updateTextureFromVideo(e, t) {
    if (!this.textureManager)
      throw new Error("[mapgpu] RenderEngine not initialized.");
    this.textureManager.updateFromVideoElement(e, t);
  }
  createBuffer(e, t) {
    if (!this.ctx.bufferPool)
      throw new Error("[mapgpu] RenderEngine not initialized.");
    return this.ctx.bufferPool.allocateWithData(e, t, "persistent");
  }
  writeBuffer(e, t, o) {
    this.ctx.device && this.ctx.device.queue.writeBuffer(e, t, o.buffer, o.byteOffset, o.byteLength);
  }
  releaseBuffer(e) {
    this.ctx.bufferPool?.release(e), this.bindGroupCache?.invalidate(`buf-${e.label ?? "unknown"}`);
  }
  releaseTexture(e) {
    this.textureManager?.release(e), this.bindGroupCache?.invalidate(`tex-${e.label ?? "unknown"}`);
  }
  // ── Texture Creation ──
  createFloat32Texture(e, t, o) {
    if (!this.textureManager) throw new Error("RenderEngine not initialized");
    return this.textureManager.createFromFloat32(e, t, o);
  }
  createUint8Texture(e, t, o) {
    if (!this.textureManager) throw new Error("RenderEngine not initialized");
    return this.textureManager.createFromUint8(e, t, o);
  }
  createRGBA8Texture(e, t, o) {
    if (!this.textureManager) throw new Error("RenderEngine not initialized");
    return this.textureManager.createFromRGBA8(e, t, o);
  }
  // ── Diagnostics ──
  getMemoryAccounting() {
    const e = this.ctx.bufferPool?.getMemoryAccounting() ?? {
      persistentBufferBytes: 0,
      transientBufferBytes: 0
    }, t = this.textureManager?.textureBytes ?? 0;
    return {
      persistentBufferBytes: e.persistentBufferBytes,
      transientBufferBytes: e.transientBufferBytes,
      textureBytes: t,
      totalTrackedBytes: e.persistentBufferBytes + e.transientBufferBytes + t
    };
  }
  // ── Recovery ──
  async recover(e) {
    if (!this.ctx.canvas)
      throw new Error("[mapgpu] Cannot recover: no canvas reference.");
    this.pickingDelegate?.destroy(), this.rasterDelegate?.destroy(), this.globeDelegate?.destroy(), this.vectorDelegate?.destroy(), this.modelDelegate?.destroy(), this._gltf2Renderer?.destroy(), this.customDelegate?.destroy(), this.clusterDelegate?.destroy(), this.extrusionDelegate?.destroy(), this.pickingDelegate = null, this.rasterDelegate = null, this.globeDelegate = null, this.vectorDelegate = null, this.modelDelegate = null, this._gltf2Renderer = null, this.customDelegate = null, this.clusterDelegate = null, this.extrusionDelegate = null, this.ctx.bufferPool?.destroy(), this.ctx.bufferPool = null, this.textureManager = null, this.bindGroupCache = null, this.ctx.bindGroupCache = null, this.iconAtlas = null, this.ctx.globeCameraBuffer = null, this.ctx.globeCameraBindGroup = null, this.ctx.globeCameraBindGroupLayout = null, this.ctx.cameraBuffer = null, this.ctx.cameraBindGroup = null, this.ctx.cameraBindGroupLayout = null, this.ctx.commandEncoder = null, this.ctx.backgroundPass = null, this.ctx.renderPass = null, this.ctx.depthTexture = null, this.ctx.msaaColorTexture = null, this.ctx.swapChainView = null, this.ctx.msaaColorView = null, this.ctx.depthView = null, this.ctx.placeholderTexture = null, this.ctx.device = null, this.ctx.context = null, this.ctx.deviceLost = !1, this.ctx.pickingDrawCalls = [], await this.init(this.ctx.canvas, e ?? this.ctx.depthConfig);
  }
  // ── Lifecycle ──
  destroy() {
    this.ctx.renderPass = null, this.ctx.backgroundPass = null, this.ctx.swapChainView = null, this.ctx.msaaColorView = null, this.ctx.depthView = null, this.ctx.commandEncoder = null, this.ctx.bufferPool?.destroy(), this.ctx.bufferPool = null, this.textureManager?.destroy(), this.textureManager = null, this.bindGroupCache?.clear(), this.bindGroupCache = null, this.ctx.bindGroupCache = null, this.pickingDelegate?.destroy(), this.rasterDelegate?.destroy(), this.globeDelegate?.destroy(), this.vectorDelegate?.destroy(), this.modelDelegate?.destroy(), this._gltf2Renderer?.destroy(), this.customDelegate?.destroy(), this.clusterDelegate?.destroy(), this.extrusionDelegate?.destroy(), this.pickingDelegate = null, this.rasterDelegate = null, this.globeDelegate = null, this.vectorDelegate = null, this.modelDelegate = null, this._gltf2Renderer = null, this.customDelegate = null, this.clusterDelegate = null, this.extrusionDelegate = null, this.iconAtlas = null, this.ctx.globeCameraBuffer = null, this.ctx.globeCameraBindGroup = null, this.ctx.globeCameraBindGroupLayout = null, this.ctx.depthTexture?.destroy(), this.ctx.depthTexture = null, this.ctx.msaaColorTexture?.destroy(), this.ctx.msaaColorTexture = null, this.ctx.placeholderTexture?.destroy(), this.ctx.placeholderTexture = null, this.ctx.cameraBuffer = null, this.ctx.cameraBindGroup = null, this.ctx.cameraBindGroupLayout = null, this.ctx.context?.unconfigure(), this.ctx.context = null, this.ctx.device?.destroy(), this.ctx.device = null, this._capabilities = null, this.ctx.canvas = null, this.ctx.deviceLost = !1, this.ctx.pickingDrawCalls = [], this.loadedModelSources.clear(), this.loadedModelV2Sources.clear();
  }
  async restoreLoadedModels() {
    if (this.modelDelegate)
      for (const [e, t] of this.loadedModelSources)
        await this.modelDelegate.loadModel(e, et(t));
    if (this._gltf2Renderer)
      for (const [e, t] of this.loadedModelV2Sources)
        await this._gltf2Renderer.loadModel(e, tt(t));
  }
}
function et(r) {
  return r instanceof ArrayBuffer ? r.slice(0) : {
    json: co(r.json),
    buffers: r.buffers.map((e) => e.slice(0))
  };
}
function tt(r) {
  return typeof r == "string" ? r : r.slice(0);
}
function co(r) {
  return typeof structuredClone == "function" ? structuredClone(r) : JSON.parse(JSON.stringify(r));
}
export {
  Er as ATMOSPHERE_SHADER_SOURCE,
  bo as BLOOM_SHADER_SOURCE,
  wt as BindGroupCache,
  Pt as BufferPool,
  Ni as CLUSTER_GLOBE_RENDER_SHADER_SOURCE,
  Vi as CLUSTER_RENDER_SHADER_SOURCE,
  Hi as EXTRUSION_SHADER_SOURCE,
  xo as GLOBE_EXTRUSION_SHADER_SOURCE,
  Wr as GLOBE_ICON_SHADER_SOURCE,
  cr as GLOBE_LINE_SHADER_SOURCE,
  ri as GLOBE_MODEL_SHADER_SOURCE,
  nr as GLOBE_POINT_SHADER_SOURCE,
  dr as GLOBE_POLYGON_SHADER_SOURCE,
  Bt as GLOBE_RASTER_SHADER_SOURCE,
  Li as Gltf2Renderer,
  ho as GlyphAtlas,
  Po as HDR_SHADER_SOURCE,
  St as HeightBrush,
  Nr as ICON_SHADER_SOURCE,
  Ht as LINE_SHADER_SOURCE,
  mo as LabelEngine,
  Jr as MODEL_SHADER_SOURCE,
  ai as ModelManager,
  Fo as PARTICLE_LAYOUT,
  _o as PARTICLE_STRIDE_BYTES,
  Ro as PARTICLE_UPDATE_WGSL,
  Zt as PICKING_SHADER_SOURCE,
  It as POINT_SHADER_SOURCE,
  Gr as POLE_CAP_SHADER_SOURCE,
  Xt as POLYGON_SHADER_SOURCE,
  tr as POST_PROCESS_SHADER_SOURCE,
  Ut as RASTER_SHADER_SOURCE,
  Eo as RenderEngine,
  Go as SHADOW_SAMPLING_WGSL,
  Ur as SKY_BACKGROUND_UNIFORM_FLOATS,
  Vr as SKY_SHADER_SOURCE,
  zr as SKY_VOLUMETRIC_UNIFORM_FLOATS,
  wo as SSAO_SHADER_SOURCE,
  or as SpriteAtlas,
  Qt as TEXT_SHADER_SOURCE,
  Ct as TextureManager,
  go as buildShaderSource,
  Bo as computeCascadeSplits,
  Dr as createAtmosphereBindGroupLayout,
  Lr as createAtmosphereMesh,
  Ar as createAtmospherePipeline,
  zt as createCameraBindGroupLayout,
  ki as createClusterGlobeRenderPipeline,
  Oi as createClusterRenderBindGroupLayout,
  Ii as createClusterRenderPipeline,
  Qr as createCustomPipeline,
  yo as createDefaultBloomState,
  Co as createDefaultHDRState,
  So as createDefaultSSAOState,
  Wi as createExtrusionBindGroupLayout,
  ji as createExtrusionPipeline,
  ot as createGlobeCameraBindGroupLayout,
  $i as createGlobeExtrusionPipeline,
  jr as createGlobeIconBindGroupLayout,
  Xr as createGlobeIconPipeline,
  ur as createGlobeLineBindGroupLayout,
  pr as createGlobeLinePipeline,
  ii as createGlobeModelBindGroupLayout,
  oi as createGlobeModelPipeline,
  sr as createGlobePointBindGroupLayout,
  lr as createGlobePointPipeline,
  fr as createGlobePolygonBindGroupLayout,
  hr as createGlobePolygonPipeline,
  _t as createGlobeRasterPipeline,
  Gt as createGlobeTileBindGroupLayout,
  Tt as createHeightTextureBindGroupLayout,
  kr as createIconBindGroupLayout,
  Hr as createIconPipeline,
  Wt as createLineBindGroupLayout,
  jt as createLinePipeline,
  ei as createModelBindGroupLayout,
  ti as createModelPipeline,
  qt as createPickingBindGroupLayout,
  Kt as createPickingPipeline,
  Nt as createPointBindGroupLayout,
  kt as createPointPipeline,
  _r as createPoleCapBindGroupLayout,
  Mr as createPoleCapMesh,
  Fr as createPoleCapPipeline,
  $t as createPolygonBindGroupLayout,
  Yt as createPolygonPipeline,
  rr as createPostProcessBindGroupLayout,
  ir as createPostProcessPipeline,
  Vt as createRasterBindGroupLayout,
  Ot as createRasterPipeline,
  Or as createSkyBindGroupLayout,
  Ir as createSkyPipeline,
  mr as createSubdivisionMesh,
  Jt as createTextBindGroupLayout,
  er as createTextPipeline,
  br as createTileDebugMesh,
  Oe as createTileDebugSuite,
  it as createZeroHeightTexture,
  se as dashStyleToUniform,
  lt as decodePickingId,
  bt as detectCapabilities,
  po as encodePickingId,
  Ai as gridCluster,
  zi as packClusterEntries,
  gi as parseGlb,
  Ye as parseGlb2,
  _i as parseGltf2,
  xi as parseGltfJson,
  fo as readPickingPixel,
  Mo as resolveParticleConfig,
  vo as resolvePostProcessConfig,
  To as resolveShadowConfig
};
