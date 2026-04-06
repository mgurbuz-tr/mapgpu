/**
 * Animated Polylines — ArcGIS-style trail effect
 *
 * Demonstrates WGSLLayer with CPU-side polyline extrusion (quads with
 * miter joins) and GPU trail animation in the fragment shader.
 *
 * Each polyline vertex is extruded ±normal to create a quad strip.
 * The vertex shader projects positions and applies screen-space width.
 * The fragment shader uses `mod(distance - time * speed, cycle)` for
 * repeating trail and `exp(-|side| * EDGE_SHARPNESS)` for soft edges.
 *
 * Inspired by ArcGIS JS API BaseLayerViewGL2D animated lines sample.
 */

import { MapView, lonLatToMercator } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer, WGSLLayer } from '@mapgpu/layers';

// ─── WGSL Shaders ───

/**
 * Vertex layout (28 bytes per vertex):
 *   @location(0) position  : float32x2  (mercator x,y)
 *   @location(1) offset    : float32x2  (extrusion normal)
 *   @location(2) distSide  : float32x2  (distance along path, side ±1)
 *   @location(3) color     : unorm8x4   (RGBA)
 *
 * CustomUniforms:
 *   halfWidth   : f32  (pixels)
 *   trailSpeed  : f32  (units/sec)
 *   trailLength : f32  (units)
 *   trailCycle  : f32  (units)
 */

const VERTEX_SHADER = /* wgsl */ `
struct CustomUniforms {
  halfWidth: f32,
  trailSpeed: f32,
  trailLength: f32,
  trailCycle: f32,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) vColor: vec4<f32>,
  @location(1) vDistSide: vec2<f32>,
};

@vertex fn vs_main(
  @location(0) position: vec2<f32>,
  @location(1) offset: vec2<f32>,
  @location(2) distSide: vec2<f32>,
  @location(3) color: vec4<f32>,
) -> VertexOutput {
  var out: VertexOutput;

  // Project center position to clip space (works in both 2D and 3D/globe)
  let clipCenter = projectMercator(position);

  // Guard: if w <= 0 the vertex is behind the camera — collapse it.
  // Place at screen center (inside clip volume) with extreme side value
  // so edgeFade → 0 → alpha → 0 → discard in fragment shader.
  // Previously used vec4(0,0,2,1) which is BEYOND the far clip plane.
  // GPU clipped triangles at z=1, creating large screen-filling triangles
  // with dark interpolated vColor — the "black overlay" root cause.
  if (clipCenter.w < 0.0001) {
    out.position = vec4<f32>(0.0, 0.0, 0.5, 1.0);
    out.vColor = vec4<f32>(0.0);
    out.vDistSide = vec2<f32>(0.0, 100.0);
    return out;
  }

  // Project a nearby offset point to find screen-space normal direction
  let clipOffset = projectMercator(position + offset * 50000.0);

  // Guard: offset projection invalid — collapse extrusion to zero width
  // at the valid center position (degenerate triangle, near-zero area)
  if (clipOffset.w < 0.0001) {
    out.position = vec4<f32>(clipCenter.xy, clipCenter.z, clipCenter.w);
    out.vColor = color;
    out.vDistSide = vec2<f32>(distSide.x, 100.0);
    return out;
  }

  // Screen-space normal direction
  let screenCenter = clipCenter.xy / clipCenter.w;
  let screenOffset = clipOffset.xy / clipOffset.w;
  let rawDir = (screenOffset - screenCenter) * camera.viewport;
  let rawLen = length(rawDir);

  // Guard against degenerate direction (sub-pixel offset at low zoom)
  var screenDir: vec2<f32>;
  if (rawLen > 0.001) {
    screenDir = (rawDir / rawLen) / camera.viewport * custom.halfWidth * 2.0;
  } else {
    screenDir = vec2<f32>(0.0, 0.0);
  }

  let finalXY = clipCenter.xy + screenDir * clipCenter.w * distSide.y;

  // Final NaN safety: collapse to valid center position with extreme side
  if (!(finalXY.x == finalXY.x) || !(finalXY.y == finalXY.y) ||
      !(clipCenter.z == clipCenter.z) || !(clipCenter.w == clipCenter.w)) {
    out.position = vec4<f32>(clipCenter.xy, clipCenter.z, clipCenter.w);
    out.vColor = vec4<f32>(0.0);
    out.vDistSide = vec2<f32>(0.0, 100.0);
    return out;
  }

  out.position = vec4<f32>(finalXY, clipCenter.z, clipCenter.w);
  out.vColor = color;
  out.vDistSide = distSide;
  return out;
}
`;

const FRAGMENT_SHADER = /* wgsl */ `
@fragment fn fs_main(
  @location(0) vColor: vec4<f32>,
  @location(1) vDistSide: vec2<f32>,
) -> @location(0) vec4<f32> {
  let dist = vDistSide.x;
  let side = vDistSide.y;

  // Trail animation: repeating pattern along distance
  let trailPos = dist - frame.time * custom.trailSpeed;
  let phase = trailPos - custom.trailCycle * floor(trailPos / custom.trailCycle);

  // Trail brightness: bright at head, fading tail
  let headFactor = 1.0 - smoothstep(0.0, custom.trailLength, phase);

  // Edge softness: fade at line edges
  let edgeFade = exp(-abs(side) * 3.0);

  // Combine — vColor.a gates guard vertices (interpolated → 0 near guards)
  let alpha = min(headFactor * edgeFade * frame.opacity * vColor.a, 0.85);

  // Discard transparent fragments (threshold raised from 0.002 for guard cleanup)
  if (alpha < 0.01 || !(alpha == alpha)) {
    discard;
  }

  // Premultiplied alpha output
  return vec4<f32>(vColor.rgb * alpha, alpha);
}
`;

// ─── Polyline Generation ───

interface City {
  name: string;
  lonLat: [number, number];
}

const CITIES: City[] = [
  { name: 'Istanbul', lonLat: [29.0, 41.01] },
  { name: 'Ankara', lonLat: [32.85, 39.92] },
  { name: 'Izmir', lonLat: [27.14, 38.42] },
  { name: 'Antalya', lonLat: [30.71, 36.89] },
  { name: 'Trabzon', lonLat: [39.72, 41.0] },
  { name: 'Adana', lonLat: [35.33, 37.0] },
  { name: 'Bursa', lonLat: [29.06, 40.19] },
  { name: 'Konya', lonLat: [32.49, 37.87] },
  { name: 'Samsun', lonLat: [36.33, 41.29] },
  { name: 'Diyarbakir', lonLat: [40.22, 37.91] },
  { name: 'Kayseri', lonLat: [35.48, 38.73] },
  { name: 'Eskisehir', lonLat: [30.52, 39.78] },
];

/** Generate a random polyline path between two cities with intermediate waypoints */
function generatePath(): [number, number][] {
  const from = CITIES[Math.floor(Math.random() * CITIES.length)]!;
  let to = from;
  while (to === from) {
    to = CITIES[Math.floor(Math.random() * CITIES.length)]!;
  }

  const numPoints = 5 + Math.floor(Math.random() * 10); // 5-14 vertices
  const path: [number, number][] = [];

  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    const lon = from.lonLat[0] + (to.lonLat[0] - from.lonLat[0]) * t + (Math.random() - 0.5) * 1.5;
    const lat = from.lonLat[1] + (to.lonLat[1] - from.lonLat[1]) * t + (Math.random() - 0.5) * 1.0;
    const [mx, my] = lonLatToMercator(lon, lat);
    path.push([mx, my]);
  }

  return path;
}

/** Random RGBA color (packed as 4 bytes) */
function randomColor(): [number, number, number, number] {
  const hue = Math.random();
  const h = hue * 6;
  const r = Math.max(0, Math.min(255, Math.round((Math.abs(h - 3) - 1) * 255)));
  const g = Math.max(0, Math.min(255, Math.round((2 - Math.abs(h - 2)) * 255)));
  const b = Math.max(0, Math.min(255, Math.round((2 - Math.abs(h - 4)) * 255)));
  return [r, g, b, 255];
}

// ─── CPU Polyline Extrusion ───

/**
 * Vertex stride: 28 bytes
 *   position   : 2 × f32 = 8 bytes  (offset 0)
 *   offset     : 2 × f32 = 8 bytes  (offset 8)
 *   distSide   : 2 × f32 = 8 bytes  (offset 16)
 *   color      : 4 × u8  = 4 bytes  (offset 24)
 */
const VERTEX_STRIDE = 28;
const FLOATS_PER_VERTEX = 7; // 6 floats + 1 u8x4 packed as float

interface ExtrusionResult {
  vertexData: ArrayBuffer;
  indexData: Uint32Array;
  vertexCount: number;
  indexCount: number;
}

/**
 * Extrude a set of polylines into triangle-strip quads with miter joins.
 *
 * For each segment, we produce 2 vertices (left/right of the line at +1/-1 side).
 * At joints we use a simple averaged normal (miter). The triangle strip for each
 * segment pair uses 2 triangles (6 indices for quad between consecutive edge pairs).
 */
function extrudePolylines(paths: [number, number][][], colors: [number, number, number, number][]): ExtrusionResult {
  // Count total vertices needed: each path point → 2 extruded vertices
  let totalVerts = 0;
  let totalIndices = 0;
  for (const path of paths) {
    if (path.length < 2) continue;
    totalVerts += path.length * 2;
    totalIndices += (path.length - 1) * 6; // 2 triangles per segment
  }

  const buf = new ArrayBuffer(totalVerts * VERTEX_STRIDE);
  const floatView = new Float32Array(buf);
  const uint8View = new Uint8Array(buf);
  const indices = new Uint32Array(totalIndices);

  let vOffset = 0; // vertex index
  let iOffset = 0; // index offset

  for (let p = 0; p < paths.length; p++) {
    const path = paths[p]!;
    const color = colors[p]!;
    if (path.length < 2) continue;

    let cumulativeDist = 0;
    const baseVertex = vOffset;

    for (let i = 0; i < path.length; i++) {
      const [x, y] = path[i]!;

      // Compute normal at this vertex (averaged from prev/next segments)
      let nx = 0;
      let ny = 0;

      if (i < path.length - 1) {
        // Forward segment direction
        const [x1, y1] = path[i + 1]!;
        const dx = x1 - x;
        const dy = y1 - y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          // Perpendicular (left normal)
          nx += -dy / len;
          ny += dx / len;
        }
      }

      if (i > 0) {
        // Backward segment direction
        const [x0, y0] = path[i - 1]!;
        const dx = x - x0;
        const dy = y - y0;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          nx += -dy / len;
          ny += dx / len;
        }

        // Accumulate distance
        cumulativeDist += Math.sqrt(
          (x - x0) * (x - x0) + (y - y0) * (y - y0),
        );
      }

      // Normalize the averaged normal
      const nLen = Math.sqrt(nx * nx + ny * ny);
      if (nLen > 0) {
        nx /= nLen;
        ny /= nLen;
      }

      // Write two vertices: +side and -side
      for (const side of [1, -1]) {
        const fi = vOffset * FLOATS_PER_VERTEX;
        floatView[fi + 0] = x;              // position.x
        floatView[fi + 1] = y;              // position.y
        floatView[fi + 2] = nx;             // offset.x (normal direction)
        floatView[fi + 3] = ny;             // offset.y
        floatView[fi + 4] = cumulativeDist; // distance along path
        floatView[fi + 5] = side;           // side (+1 or -1)

        // Pack color as RGBA u8 into the last 4 bytes of the stride
        const byteOff = vOffset * VERTEX_STRIDE + 24;
        uint8View[byteOff + 0] = color[0];
        uint8View[byteOff + 1] = color[1];
        uint8View[byteOff + 2] = color[2];
        uint8View[byteOff + 3] = color[3];

        vOffset++;
      }

      // Build indices: connect this pair to next pair (quad = 2 triangles)
      if (i > 0) {
        const prev0 = baseVertex + (i - 1) * 2;     // prev left
        const prev1 = baseVertex + (i - 1) * 2 + 1;  // prev right
        const curr0 = baseVertex + i * 2;              // curr left
        const curr1 = baseVertex + i * 2 + 1;          // curr right

        // Triangle 1: prev-left, prev-right, curr-left
        indices[iOffset++] = prev0;
        indices[iOffset++] = prev1;
        indices[iOffset++] = curr0;

        // Triangle 2: prev-right, curr-right, curr-left
        indices[iOffset++] = prev1;
        indices[iOffset++] = curr1;
        indices[iOffset++] = curr0;
      }
    }
  }

  return {
    vertexData: buf,
    indexData: indices,
    vertexCount: vOffset,
    indexCount: iOffset,
  };
}

// ─── Main ───

async function main(): Promise<void> {
  const engine = new RenderEngine();
  const view = new MapView({
    container: '#map-container',
    mode: '2d',
    center: [32, 39.5],
    zoom: 6,
    renderEngine: engine,
  });

  await view.when();

  // Base map
  const baseLayer = new RasterTileLayer({
    id: 'osm',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    minZoom: 0,
    maxZoom: 19,
    opacity: 1,
  });
  await baseLayer.load();
  view.map.add(baseLayer);
  view.switchTo('3d');

  // ─── UI state ───
  let lineCount = parseInt((document.getElementById('slider-count') as HTMLInputElement).value);
  let halfWidth = parseFloat((document.getElementById('slider-width') as HTMLInputElement).value);
  let trailSpeed = parseFloat((document.getElementById('slider-speed') as HTMLInputElement).value);

  // ─── WGSLLayer ───
  const shaderLayer = new WGSLLayer({
    id: 'animated-lines',
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    vertexBufferLayouts: [
      {
        arrayStride: VERTEX_STRIDE,
        stepMode: 'vertex',
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x2' as GPUVertexFormat },   // position
          { shaderLocation: 1, offset: 8, format: 'float32x2' as GPUVertexFormat },   // offset
          { shaderLocation: 2, offset: 16, format: 'float32x2' as GPUVertexFormat },  // distSide
          { shaderLocation: 3, offset: 24, format: 'unorm8x4' as GPUVertexFormat },   // color
        ],
      },
    ],
    animated: true,
    topology: 'triangle-list',
    blendState: {
      color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
      alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
    },
  });

  await shaderLayer.load();

  // Generate and upload geometry
  function rebuildGeometry(): void {
    const paths: [number, number][][] = [];
    const colors: [number, number, number, number][] = [];

    for (let i = 0; i < lineCount; i++) {
      paths.push(generatePath());
      colors.push(randomColor());
    }

    const { vertexData, indexData, indexCount } = extrudePolylines(paths, colors);

    const vertexBuffer = engine.createBuffer(
      new Float32Array(vertexData),
      GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    );
    const indexBuffer = engine.createBuffer(
      indexData,
      GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    );

    shaderLayer.setVertexBuffer(0, vertexBuffer);
    shaderLayer.setIndexBuffer(indexBuffer, 'uint32');
    shaderLayer.setDrawParams({ indexCount });
  }

  // Upload custom uniforms
  function updateUniforms(): void {
    const uniforms = new Float32Array(4);
    uniforms[0] = halfWidth;              // halfWidth (pixels)
    uniforms[1] = trailSpeed * 1000;     // trailSpeed (Mercator units/sec — slider × 1000)
    uniforms[2] = 200000;                // trailLength (Mercator units, ~200km bright head)
    uniforms[3] = 800000;                // trailCycle  (Mercator units, ~800km repeat)
    shaderLayer.setCustomUniforms(uniforms);
  }

  rebuildGeometry();
  updateUniforms();

  view.map.add(shaderLayer);

  // ─── UI Controls ───

  const valCount = document.getElementById('val-count')!;
  const valWidth = document.getElementById('val-width')!;
  const valSpeed = document.getElementById('val-speed')!;

  document.getElementById('slider-count')!.addEventListener('input', (e) => {
    lineCount = parseInt((e.target as HTMLInputElement).value);
    valCount.textContent = String(lineCount);
    rebuildGeometry();
    shaderLayer.requestRender();
  });

  document.getElementById('slider-width')!.addEventListener('input', (e) => {
    halfWidth = parseFloat((e.target as HTMLInputElement).value);
    valWidth.textContent = String(halfWidth);
    updateUniforms();
    shaderLayer.requestRender();
  });

  document.getElementById('slider-speed')!.addEventListener('input', (e) => {
    trailSpeed = parseFloat((e.target as HTMLInputElement).value);
    valSpeed.textContent = String(trailSpeed);
    updateUniforms();
    shaderLayer.requestRender();
  });

  document.getElementById('btn-istanbul')!.addEventListener('click', () => {
    void view.goTo({ center: [29.0, 41.01], zoom: 8, duration: 1000 });
  });

  document.getElementById('btn-ankara')!.addEventListener('click', () => {
    void view.goTo({ center: [32.85, 39.92], zoom: 8, duration: 1000 });
  });

  // FPS counter
  view.on('frame', ({ fps }) => {
    document.title = `Animated Lines — ${fps.toFixed(0)} FPS`;
  });

}

main().catch(console.error);
