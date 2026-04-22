/**
 * Vertical Perspective Transform
 *
 * MapLibre'nin VerticalPerspectiveTransform kamerasının TypeScript implementasyonu.
 * Unit sphere (radius=1) üzerinde globe render kamerası.
 *
 * Matris zinciri:
 *   perspective(fov, aspect, near, far)
 *     × translate(0, 0, -cameraToCenterDistance)
 *     × rotateX(-pitch)
 *     × rotateZ(bearing)
 *     × translate(0, 0, -1)        // globe center offset (radius=1)
 *     × rotateX(latitude)
 *     × rotateY(-longitude)
 *
 * Koordinat sistemi: Y-up, right-handed.
 */

import { EARTH_RADIUS } from '../coordinates.js';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const DEFAULT_FOV = 36.87; // degrees — MapLibre default (atan(0.75))
const MAX_PITCH = 85;
const MIN_ZOOM = 0;
const MAX_ZOOM = 22;

export interface GlobeCameraParams {
  center: [number, number];  // [lon, lat] degrees
  zoom: number;
  pitch: number;             // 0-85 degrees
  bearing: number;           // 0-360 degrees
  fov?: number;              // degrees, default ~36.87
  viewportWidth: number;
  viewportHeight: number;
}

export class VerticalPerspectiveTransform {
  // ─── Parameters ───
  private _center: [number, number] = [0, 0];
  private _zoom = 2;
  private _pitch = 0;
  private _bearing = 0;
  private _fov = DEFAULT_FOV;
  private _viewportWidth = 800;
  private _viewportHeight = 600;
  private _minCameraSurfaceDistanceMeters = 0;

  // ─── Cached matrices (column-major Float32Array) ───
  private readonly _viewMatrix = new Float32Array(16);
  private readonly _projectionMatrix = new Float32Array(16);
  private readonly _viewProjectionMatrix = new Float32Array(16);
  private readonly _flatViewProjectionMatrix = new Float32Array(16);
  private _cameraPosition: [number, number, number] = [0, 0, 0];
  private _clippingPlane: [number, number, number, number] = [0, 0, 1, 0];
  private _dirty = true;

  constructor(params?: Partial<GlobeCameraParams>) {
    if (params) {
      if (params.center) this._center = [...params.center];
      // Input clamp — setter'larla tutarlı invariant: `_zoom ∈ [MIN_ZOOM, MAX_ZOOM]`,
      // `_pitch ∈ [0, MAX_PITCH]`, `_fov ∈ [10, 90]`. Constructor bypass'i önler
      // (setter'lar clamp ederken constructor direct assignment yapıyordu).
      if (params.zoom !== undefined) {
        this._zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, params.zoom));
      }
      if (params.pitch !== undefined) {
        this._pitch = Math.max(0, Math.min(MAX_PITCH, params.pitch));
      }
      if (params.bearing !== undefined) {
        this._bearing = ((params.bearing % 360) + 360) % 360;
      }
      if (params.fov !== undefined) {
        this._fov = Math.max(10, Math.min(90, params.fov));
      }
      if (params.viewportWidth !== undefined) this._viewportWidth = params.viewportWidth;
      if (params.viewportHeight !== undefined) this._viewportHeight = params.viewportHeight;
    }
    this.updateMatrices();
  }

  // ─── Getters ───

  get center(): [number, number] { return [...this._center] as [number, number]; }
  get zoom(): number { return this._zoom; }
  get pitch(): number { return this._pitch; }
  get bearing(): number { return this._bearing; }
  get fov(): number { return this._fov; }
  get viewportWidth(): number { return this._viewportWidth; }
  get viewportHeight(): number { return this._viewportHeight; }
  get cameraSurfaceDistanceMeters(): number {
    return this._cameraSurfaceDistanceMetersFor(this._zoom, this._pitch);
  }

  get viewMatrix(): Float32Array { this._ensureClean(); return this._viewMatrix; }
  get projectionMatrix(): Float32Array { this._ensureClean(); return this._projectionMatrix; }
  get viewProjectionMatrix(): Float32Array { this._ensureClean(); return this._viewProjectionMatrix; }
  /** Flat Mercator VP matrix — maps Mercator [0..1] → NDC for zoom >= 6 rendering */
  get flatViewProjectionMatrix(): Float32Array { this._ensureClean(); return this._flatViewProjectionMatrix; }
  get cameraPosition(): [number, number, number] { this._ensureClean(); return [...this._cameraPosition] as [number, number, number]; }

  /**
   * Globe radius in pixels.
   * MapLibre: worldSize / (2π) at equator.
   * worldSize = tileSize * 2^zoom (tileSize=512)
   */
  get globeRadius(): number {
    const worldSize = 512 * Math.pow(2, this._zoom);
    return worldSize / (2 * Math.PI);
  }

  /**
   * Camera-to-center distance in globe-radius units.
   * Based on zoom/fov: distance = 1 / (2 * tan(fov/2) * globeScale)
   * where globeScale relates zoom to sphere coverage.
   */
  get cameraToCenterDistance(): number {
    const fovRad = this._fov * DEG2RAD;
    const halfFov = fovRad / 2;
    // At zoom=0, globe should fill ~half viewport height
    // cameraToCenterDistance = 0.5 * viewportHeight / tan(fov/2) / globeRadius
    // Simplified: we work in unit-sphere space, so divide by globeRadius
    const pixelDistance = 0.5 * this._viewportHeight / Math.tan(halfFov);
    return pixelDistance / this.globeRadius;
  }

  /** Camera distance in Mercator [0..1] space — used for flat-path camera position. */
  get mercatorCameraDistance(): number {
    const worldSize = 512 * Math.pow(2, this._zoom);
    const fovRad = this._fov * DEG2RAD;
    const pixelDist = 0.5 * this._viewportHeight / Math.tan(fovRad / 2);
    return pixelDist / worldSize;
  }

  // ─── Setters ───

  setCenter(lon: number, lat: number): void {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    // Normalize longitude to [-180, 180) only when out of range
    const normalizedLon = (lon >= -180 && lon < 180) ? lon : ((lon % 360) + 540) % 360 - 180;
    this._center = [normalizedLon, Math.max(-85.051129, Math.min(85.051129, lat))];
    this._dirty = true;
  }

  setZoom(zoom: number): void {
    this._applyZoom(zoom);
  }

  setPitch(pitch: number): void {
    this._pitch = Math.max(0, Math.min(MAX_PITCH, pitch));
    this._applyZoom(this._zoom);
    this._dirty = true;
  }

  setBearing(bearing: number): void {
    this._bearing = ((bearing % 360) + 360) % 360;
    this._dirty = true;
  }

  setViewport(width: number, height: number): void {
    this._viewportWidth = width;
    this._viewportHeight = height;
    this._applyZoom(this._zoom);
    this._dirty = true;
  }

  setFov(fov: number): void {
    this._fov = Math.max(10, Math.min(90, fov));
    this._applyZoom(this._zoom);
    this._dirty = true;
  }

  setMinCameraSurfaceDistance(minDistanceMeters: number): boolean {
    const next = Number.isFinite(minDistanceMeters) ? Math.max(0, minDistanceMeters) : 0;
    if (Math.abs(next - this._minCameraSurfaceDistanceMeters) < 1e-6) return false;
    this._minCameraSurfaceDistanceMeters = next;
    return this._applyZoom(this._zoom);
  }

  // ─── Matrix Computation ───

  private _ensureClean(): void {
    if (this._dirty) {
      this.updateMatrices();
    }
  }

  private _applyZoom(zoom: number): boolean {
    const clampedZoom = this._clampZoom(zoom);
    const changed = Math.abs(clampedZoom - this._zoom) > 1e-9;
    this._zoom = clampedZoom;
    this._dirty = true;
    return changed;
  }

  private _clampZoom(zoom: number): number {
    const boundedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    const maxZoomForSurfaceDistance = this._maxZoomForSurfaceDistance(
      this._pitch,
      this._minCameraSurfaceDistanceMeters,
    );
    return Math.min(boundedZoom, maxZoomForSurfaceDistance);
  }

  private _cameraSurfaceDistanceMetersFor(zoom: number, pitch: number): number {
    const dist = this._cameraToCenterDistanceFor(zoom);
    const pitchRad = pitch * DEG2RAD;
    const radialDistance = Math.sqrt(1 + dist * dist + 2 * dist * Math.cos(pitchRad));
    return Math.max(0, (radialDistance - 1) * EARTH_RADIUS);
  }

  private _cameraToCenterDistanceFor(zoom: number): number {
    const fovRad = this._fov * DEG2RAD;
    const halfFov = fovRad / 2;
    const tanHalfFov = Math.tan(halfFov);
    if (this._viewportHeight <= 0 || !Number.isFinite(tanHalfFov) || tanHalfFov <= 0) return 0;

    const pixelDistance = 0.5 * this._viewportHeight / tanHalfFov;
    const worldSize = 512 * Math.pow(2, zoom);
    return pixelDistance / (worldSize / (2 * Math.PI));
  }

  private _maxZoomForSurfaceDistance(pitch: number, minDistanceMeters: number): number {
    if (minDistanceMeters <= 0) return MAX_ZOOM;
    if (this._viewportHeight <= 0) return MAX_ZOOM;

    const fovRad = this._fov * DEG2RAD;
    const tanHalfFov = Math.tan(fovRad / 2);
    if (!Number.isFinite(tanHalfFov) || tanHalfFov <= 0) return MAX_ZOOM;

    const requiredClearance = minDistanceMeters / EARTH_RADIUS;
    const cosPitch = Math.cos(pitch * DEG2RAD);
    const requiredDist = -cosPitch
      + Math.sqrt(cosPitch * cosPitch + 2 * requiredClearance + requiredClearance * requiredClearance);
    if (requiredDist <= 0) return MAX_ZOOM;

    const pixelDistance = 0.5 * this._viewportHeight / tanHalfFov;
    const distAtZoomZero = pixelDistance * (2 * Math.PI / 512);
    if (distAtZoomZero <= 0) return MAX_ZOOM;

    const zoom = Math.log2(distAtZoomZero / requiredDist);
    if (!Number.isFinite(zoom)) return MAX_ZOOM;
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
  }

  updateMatrices(): void {
    const fovRad = this._fov * DEG2RAD;
    const pitchRad = this._pitch * DEG2RAD;
    const bearingRad = this._bearing * DEG2RAD;
    const lonRad = this._center[0] * DEG2RAD;
    const latRad = this._center[1] * DEG2RAD;
    const aspect = this._viewportWidth / this._viewportHeight;
    const dist = this.cameraToCenterDistance;

    // Near/far
    const [near, far] = this.computeNearFar();

    // ─── Projection matrix (perspective) ───
    perspectiveMat4(this._projectionMatrix, fovRad, aspect, near, far);

    // ─── View matrix ───
    // Start with identity
    identityMat4(this._viewMatrix);

    // translate(0, 0, -cameraToCenterDistance)
    translateMat4(this._viewMatrix, 0, 0, -dist);

    // rotateX(-pitch)
    rotateXMat4(this._viewMatrix, -pitchRad);

    // rotateZ(bearing)
    rotateZMat4(this._viewMatrix, bearingRad);

    // translate(0, 0, -1) — globe center is 1 unit from the "surface point"
    translateMat4(this._viewMatrix, 0, 0, -1);

    // rotateX(latitude) — orient to look at lat
    rotateXMat4(this._viewMatrix, latRad);

    // rotateY(-longitude) — orient to look at lon
    rotateYMat4(this._viewMatrix, -lonRad);

    // ─── View-Projection matrix ───
    multiplyMat4(this._viewProjectionMatrix, this._projectionMatrix, this._viewMatrix);

    // ─── Camera position (in unit-sphere space) ───
    this._computeCameraPosition(dist, pitchRad, bearingRad, lonRad, latRad);

    // ─── Clipping plane ───
    this._computeClippingPlane(dist, pitchRad, bearingRad, lonRad, latRad);

    // ─── Flat Mercator VP matrix ───
    this._computeFlatViewProjection();

    this._dirty = false;
  }

  /**
   * Near/far hesapla.
   * dist = cameraToCenterDistance = kamera-yüzey mesafesi (unit sphere).
   * Near: en yakın yüzey noktası dist kadar uzak → dist * 0.1 güvenli margin.
   * Far: kamera → globe arkası = dist + 2 (çap).
   *
   * Reverse-Z precision dağılımı (f32 mantissa + 1/z uniform) çok büyük
   * near/far ratio'larını bile tolere eder. Bu sayede near plane floor'u
   * 1e-7 seviyesine kadar indirilebilir — yakın GLTF modelleri (ör. 100m
   * yükseklikteki offshore platform'un küçük deltası) hardware vertex
   * clipper tarafından kesilmez. Standart Z'de bu floor 1e-3'te tutulmalıydı.
   */
  computeNearFar(): [number, number] {
    const dist = this.cameraToCenterDistance;
    const near = Math.max(1e-7, dist * 0.1);
    const far = dist + 2; // globe arkası
    return [near, far];
  }

  /**
   * Flat Mercator VP matrix hesapla — perspective + pitch + bearing.
   * Maps Mercator [0..1] input to clip space.
   * Used for zoom >= 6 where the globe VP camera asymptotically stalls.
   *
   * Matrix chain (right-to-left application):
   *   Perspective(fov, aspect, near, far)
   *     × Translate(0, 0, -cameraDist)    // camera distance in merc space
   *     × RotateX(-pitch)                 // tilt view
   *     × Scale(1, -1, 1)                 // flip Y (merc Y↓ → view Y↑)
   *     × RotateZ(bearing)                // compass rotation
   *     × Translate(-cx, -cy, 0)          // center to origin
   *
   * At pitch=0 this reduces to the equivalent orthographic projection:
   *   ndcX = (2 * worldSize / vpWidth) * (mercX - cx)
   *   ndcY = (2 * worldSize / vpHeight) * (cy - mercY)
   */
  private _computeFlatViewProjection(): void {
    const out = this._flatViewProjectionMatrix;

    // Center in Mercator [0..1]
    const latRad = this._center[1] * DEG2RAD;
    const cx = (this._center[0] + 180) / 360;
    const cy = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2;

    const worldSize = 512 * Math.pow(2, this._zoom);
    const fovRad = this._fov * DEG2RAD;
    const pitchRad = this._pitch * DEG2RAD;
    const bearingRad = this._bearing * DEG2RAD;
    const aspect = this._viewportWidth / this._viewportHeight;

    // Camera distance in Mercator [0..1] space
    // In pixel space: 0.5 * viewportHeight / tan(fov/2)
    // Convert to Mercator space: divide by worldSize
    const pixelDist = 0.5 * this._viewportHeight / Math.tan(fovRad / 2);
    const mercDist = pixelDist / worldSize;

    // Near/far in Mercator space — wide range for extruded buildings
    // (height scale h/R can reach ~0.87× mercDist for tall buildings)
    const near = mercDist * 0.05;
    const far = mercDist * 200;

    // Build matrix chain — operations are right-multiplied
    // Step 1: Start with perspective projection
    perspectiveMat4(out, fovRad, aspect, near, far);

    // Step 2: Translate camera back along Z
    translateMat4(out, 0, 0, -mercDist);

    // Step 3: Rotate pitch (tilt view)
    rotateXMat4(out, -pitchRad);

    // Step 4: Flip Y — Mercator Y=0 is north, view Y-up is north
    // Scale column 1 by -1
    out[4] = -out[4]!;
    out[5] = -out[5]!;
    out[6] = -out[6]!;
    out[7] = -out[7]!;

    // Step 5: Rotate bearing
    rotateZMat4(out, bearingRad);

    // Step 6: Translate center to origin
    translateMat4(out, -cx, -cy, 0);
  }

  /**
   * Camera position hesapla (unit sphere space).
   * Inverse of view transform, starting from (0,0,0) → apply inverse chain.
   */
  private _computeCameraPosition(
    dist: number,
    pitchRad: number,
    bearingRad: number,
    lonRad: number,
    latRad: number,
  ): void {
    // Camera starts at origin in eye space, back-trace through transforms:
    // pos = rotateY(lon) × rotateX(-lat) × translate(0,0,1) × rotateZ(-bearing) × rotateX(pitch) × translate(0,0,dist) × (0,0,0)

    // Start with (0,0,dist) — camera is dist units along z in eye space
    let x = 0;
    let y = 0;
    let z = dist;

    // rotateX(pitch)
    const cp = Math.cos(pitchRad);
    const sp = Math.sin(pitchRad);
    const y1 = y * cp - z * sp;
    const z1 = y * sp + z * cp;
    y = y1; z = z1;

    // rotateZ(-bearing)
    const cb = Math.cos(-bearingRad);
    const sb = Math.sin(-bearingRad);
    const x2 = x * cb - y * sb;
    const y2 = x * sb + y * cb;
    x = x2; y = y2;

    // translate(0, 0, 1)
    z += 1;

    // rotateX(-lat)
    const clat = Math.cos(-latRad);
    const slat = Math.sin(-latRad);
    const y3 = y * clat - z * slat;
    const z3 = y * slat + z * clat;
    y = y3; z = z3;

    // rotateY(lon)
    const clon = Math.cos(lonRad);
    const slon = Math.sin(lonRad);
    const x4 = x * clon + z * slon;
    const z4 = -x * slon + z * clon;
    x = x4; z = z4;

    this._cameraPosition = [x, y, z];
  }

  /**
   * Clipping plane hesapla (horizon occlusion).
   * Plane: dot(surfacePoint, normal) + d ≥ 0 → visible.
   */
  private _computeClippingPlane(
    _dist: number,
    _pitchRad: number,
    _bearingRad: number,
    _lonRad: number,
    _latRad: number,
  ): void {
    const radius = 1; // unit sphere

    // Use actual camera-to-center distance from computed camera position
    // (NOT cameraToCenterDistance which is camera-to-surface distance).
    // View matrix: translate(0,0,-dist) ... translate(0,0,-1), so actual = dist + 1.
    const cx = this._cameraPosition[0];
    const cy = this._cameraPosition[1];
    const cz = this._cameraPosition[2];
    const actualDist = Math.hypot(cx, cy, cz);

    if (actualDist <= radius) {
      this._clippingPlane = [0, 0, 0, -1];
      return;
    }

    // Horizon tangent plane: r²/d distance from center along camera direction
    const planeD = radius * radius / actualDist;

    const nx = cx / actualDist;
    const ny = cy / actualDist;
    const nz = cz / actualDist;

    this._clippingPlane = [nx, ny, nz, -planeD];
  }

  /**
   * Clipping plane getter (horizon occlusion).
   * [A, B, C, D] where Ax + By + Cz + D ≥ 0 → visible.
   */
  getClippingPlane(): [number, number, number, number] {
    this._ensureClean();
    return [...this._clippingPlane] as [number, number, number, number];
  }

  /**
   * Screen coordinates → lon/lat.
   * Ray-sphere intersection.
   * Returns null if ray misses globe.
   */
  screenToLonLat(sx: number, sy: number): [number, number] | null {
    this._ensureClean();

    // Normalize to clip space
    const ndcX = (2 * sx / this._viewportWidth) - 1;
    const ndcY = 1 - (2 * sy / this._viewportHeight);

    // Inverse projection: NDC → eye space ray direction
    const fovRad = this._fov * DEG2RAD;
    const halfFov = Math.tan(fovRad / 2);
    const aspect = this._viewportWidth / this._viewportHeight;

    const rayDirEye: [number, number, number] = [
      ndcX * halfFov * aspect,
      ndcY * halfFov,
      -1,
    ];

    // Transform ray from eye space to globe space
    // We need inverse of the view matrix transforms (in reverse order)
    const pitchRad = this._pitch * DEG2RAD;
    const bearingRad = this._bearing * DEG2RAD;
    const lonRad = this._center[0] * DEG2RAD;
    const latRad = this._center[1] * DEG2RAD;

    // Normalize ray direction
    let len = Math.hypot(rayDirEye[0], rayDirEye[1], rayDirEye[2]);
    let dx = rayDirEye[0] / len;
    let dy = rayDirEye[1] / len;
    let dz = rayDirEye[2] / len;

    // Inverse rotateX(-pitch) → rotateX(pitch)
    {
      const c = Math.cos(pitchRad);
      const s = Math.sin(pitchRad);
      const ny = dy * c - dz * s;
      const nz = dy * s + dz * c;
      dy = ny; dz = nz;
    }

    // Inverse rotateZ(bearing) → rotateZ(-bearing)
    {
      const c = Math.cos(-bearingRad);
      const s = Math.sin(-bearingRad);
      const nx = dx * c - dy * s;
      const ny = dx * s + dy * c;
      dx = nx; dy = ny;
    }

    // Inverse rotateX(lat) → rotateX(-lat)
    {
      const c = Math.cos(-latRad);
      const s = Math.sin(-latRad);
      const ny = dy * c - dz * s;
      const nz = dy * s + dz * c;
      dy = ny; dz = nz;
    }

    // Inverse rotateY(-lon) → rotateY(lon)
    {
      const c = Math.cos(lonRad);
      const s = Math.sin(lonRad);
      const nx = dx * c + dz * s;
      const nz = -dx * s + dz * c;
      dx = nx; dz = nz;
    }

    // Ray origin = camera position (in globe space)
    const ox = this._cameraPosition[0];
    const oy = this._cameraPosition[1];
    const oz = this._cameraPosition[2];

    // Ray-sphere intersection (unit sphere at origin)
    const t = raySphereIntersect(ox, oy, oz, dx, dy, dz, 1);
    if (t === null) return null;

    // Hit point on sphere
    const hx = ox + t * dx;
    const hy = oy + t * dy;
    const hz = oz + t * dz;

    // Sphere surface → lon/lat
    const lat = Math.asin(Math.max(-1, Math.min(1, hy))) * RAD2DEG;
    const lon = Math.atan2(hx, hz) * RAD2DEG;

    return [lon, lat];
  }

  /**
   * lon/lat → screen coordinates (globe projection).
   * Returns null if point is on the back side of the globe.
   */
  lonLatToScreen(lon: number, lat: number): [number, number] | null {
    this._ensureClean();

    const [px, py, pz] = lonLatToSpherePoint(lon, lat, 0);
    if (!isSpherePointVisible(px, py, pz, this._clippingPlane)) {
      return null;
    }

    return clipPointToScreen(
      this._viewProjectionMatrix,
      px,
      py,
      pz,
      this._viewportWidth,
      this._viewportHeight,
    );
  }

  /**
   * lon/lat/altitude → screen coordinates (globe projection).
   * Uses the same meter-to-unit-sphere conversion as the globe shaders.
   */
  lonLatToScreenWithAltitude(lon: number, lat: number, altitudeMeters: number): [number, number] | null {
    this._ensureClean();

    const [px, py, pz] = lonLatToSpherePoint(lon, lat, altitudeMeters);
    if (!isSpherePointVisible(px, py, pz, this._clippingPlane)) {
      return null;
    }

    return clipPointToScreen(
      this._viewProjectionMatrix,
      px,
      py,
      pz,
      this._viewportWidth,
      this._viewportHeight,
    );
  }

  // ─── Flat Mercator Coordinate Conversion ───

  /**
   * lon/lat → screen coordinates using flat Mercator VP matrix.
   * Used when globeness ≈ 0 (high zoom) where the shader renders with flatViewProjection.
   * Maps lon/lat → Mercator [0..1] → flatVP → clip → NDC → screen.
   */
  lonLatToScreenFlat(lon: number, lat: number): [number, number] | null {
    this._ensureClean();

    const [mx, my] = lonLatToMercator01(lon, lat);
    return clipPointToScreen(
      this._flatViewProjectionMatrix,
      mx,
      my,
      0,
      this._viewportWidth,
      this._viewportHeight,
    );
  }

  /**
   * lon/lat/altitude → screen coordinates using flat Mercator VP matrix.
   */
  lonLatToScreenFlatWithAltitude(lon: number, lat: number, altitudeMeters: number): [number, number] | null {
    this._ensureClean();

    const [mx, my] = lonLatToMercator01(lon, lat);
    return clipPointToScreen(
      this._flatViewProjectionMatrix,
      mx,
      my,
      altitudeMeters / EARTH_RADIUS,
      this._viewportWidth,
      this._viewportHeight,
    );
  }

  /**
   * Screen coordinates → lon/lat using flat Mercator VP matrix inverse.
   * Used when globeness ≈ 0 (high zoom) where the shader renders with flatViewProjection.
   *
   * Solves: flatVP * (mx, my, 0, 1) = (ndcX * w, ndcY * w, _, w)
   * which gives a 2×2 linear system via Cramer's rule.
   */
  screenToLonLatFlat(sx: number, sy: number): [number, number] | null {
    this._ensureClean();

    // Screen → NDC
    const ndcX = (2 * sx / this._viewportWidth) - 1;
    const ndcY = 1 - (2 * sy / this._viewportHeight);

    const fp = this._flatViewProjectionMatrix;

    // Solve: (fp[col]*mx + fp[col]*my + fp[col]*1) / w = ndcX (or ndcY)
    // where w = fp[3]*mx + fp[7]*my + fp[15]
    //
    // Rearranging: (fp[0] - ndcX*fp[3])*mx + (fp[4] - ndcX*fp[7])*my = ndcX*fp[15] - fp[12]
    //              (fp[1] - ndcY*fp[3])*mx + (fp[5] - ndcY*fp[7])*my = ndcY*fp[15] - fp[13]

    const a11 = fp[0]! - ndcX * fp[3]!;
    const a12 = fp[4]! - ndcX * fp[7]!;
    const b1  = ndcX * fp[15]! - fp[12]!;

    const a21 = fp[1]! - ndcY * fp[3]!;
    const a22 = fp[5]! - ndcY * fp[7]!;
    const b2  = ndcY * fp[15]! - fp[13]!;

    // Cramer's rule
    const det = a11 * a22 - a12 * a21;
    if (Math.abs(det) < 1e-12) return null;

    const mx = (b1 * a22 - b2 * a12) / det;
    const my = (a11 * b2 - a21 * b1) / det;

    // Mercator [0..1] → lon/lat
    const lon = mx * 360 - 180;
    const latRad = Math.atan(Math.exp(Math.PI - my * 2 * Math.PI)) * 2 - Math.PI / 2;
    const lat = latRad * RAD2DEG;

    // Sanity check
    if (lat < -85.051129 || lat > 85.051129) return null;
    if (lon < -180 || lon > 180) return null;

    return [lon, lat];
  }
}

// ─── Matrix Utility Functions (column-major Float32Array) ───

function identityMat4(out: Float32Array): void {
  out.fill(0);
  out[0] = 1; out[5] = 1; out[10] = 1; out[15] = 1;
}

/**
 * WebGPU reverse-Z perspective matrix: NDC z ∈ [0, 1] where
 *   near plane → z_ndc = 1,
 *   far plane  → z_ndc = 0.
 *
 * Reverse-Z, standart z'nin (near→0, far→1) 1/z dağılımının far plane'de
 * precision'ı sıkıştırma sorununu IEEE754 f32 mantissa'sının "near-zero" yüksek
 * çözünürlüğü ile dengeler. Derinlik testi compareFunc='greater' + clearValue=0
 * ile kullanılmalıdır.
 */
function perspectiveMat4(
  out: Float32Array,
  fovRad: number,
  aspect: number,
  near: number,
  far: number,
): void {
  const f = 1 / Math.tan(fovRad / 2);
  const rangeInv = 1 / (near - far);

  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = -near * rangeInv;          // Reverse-Z: maps near→1, far→0
  out[11] = -1;
  out[14] = -near * far * rangeInv;    // Reverse-Z: near*far/(far-near)
}

function translateMat4(m: Float32Array, x: number, y: number, z: number): void {
  for (let i = 0; i < 4; i++) {
    const prev = m[12 + i]!;
    m[12 + i] = prev + m[i]! * x + m[4 + i]! * y + m[8 + i]! * z;
  }
}

function rotateXMat4(m: Float32Array, rad: number): void {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  for (let i = 0; i < 4; i++) {
    const a = m[4 + i]!;
    const b = m[8 + i]!;
    m[4 + i] = a * c + b * s;
    m[8 + i] = b * c - a * s;
  }
}

function rotateYMat4(m: Float32Array, rad: number): void {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  for (let i = 0; i < 4; i++) {
    const a = m[i]!;
    const b = m[8 + i]!;
    m[i] = a * c - b * s;
    m[8 + i] = a * s + b * c;
  }
}

function rotateZMat4(m: Float32Array, rad: number): void {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  for (let i = 0; i < 4; i++) {
    const a = m[i]!;
    const b = m[4 + i]!;
    m[i] = a * c + b * s;
    m[4 + i] = b * c - a * s;
  }
}

function multiplyMat4(out: Float32Array, a: Float32Array, b: Float32Array): void {
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[k * 4 + row]! * b[col * 4 + k]!;
      }
      out[col * 4 + row] = sum;
    }
  }
}

/**
 * Ray-sphere intersection.
 * Returns nearest positive t, or null if no intersection.
 */
function raySphereIntersect(
  ox: number, oy: number, oz: number, // ray origin
  dx: number, dy: number, dz: number, // ray direction (normalized)
  r: number,                           // sphere radius
): number | null {
  // a = dot(d, d) = 1 (normalized)
  const b = 2 * (ox * dx + oy * dy + oz * dz);
  const c = ox * ox + oy * oy + oz * oz - r * r;
  const discriminant = b * b - 4 * c;

  if (discriminant < 0) return null;

  const sqrtDisc = Math.sqrt(discriminant);
  const t0 = (-b - sqrtDisc) / 2;
  const t1 = (-b + sqrtDisc) / 2;

  // Return nearest positive intersection
  if (t0 > 0) return t0;
  if (t1 > 0) return t1;
  return null;
}

function lonLatToSpherePoint(
  lon: number,
  lat: number,
  altitudeMeters: number,
): [number, number, number] {
  const lonRad = lon * DEG2RAD;
  const latRad = lat * DEG2RAD;
  const cosLat = Math.cos(latRad);
  const altitudeScale = 1 + altitudeMeters / EARTH_RADIUS;
  return [
    cosLat * Math.sin(lonRad) * altitudeScale,
    Math.sin(latRad) * altitudeScale,
    cosLat * Math.cos(lonRad) * altitudeScale,
  ];
}

function lonLatToMercator01(lon: number, lat: number): [number, number] {
  const latRad = lat * DEG2RAD;
  const mx = (lon + 180) / 360;
  const sinLat = Math.sin(latRad);
  const clamped = Math.max(-0.9999, Math.min(0.9999, sinLat));
  const my = (1 - Math.log((1 + clamped) / (1 - clamped)) / (2 * Math.PI)) / 2;
  return [mx, my];
}

function isSpherePointVisible(
  x: number,
  y: number,
  z: number,
  clippingPlane: [number, number, number, number],
): boolean {
  return x * clippingPlane[0] + y * clippingPlane[1] + z * clippingPlane[2] + clippingPlane[3] >= 0;
}

function clipPointToScreen(
  matrix: Float32Array,
  x: number,
  y: number,
  z: number,
  viewportWidth: number,
  viewportHeight: number,
): [number, number] | null {
  const clipX = matrix[0]! * x + matrix[4]! * y + matrix[8]! * z + matrix[12]!;
  const clipY = matrix[1]! * x + matrix[5]! * y + matrix[9]! * z + matrix[13]!;
  const clipW = matrix[3]! * x + matrix[7]! * y + matrix[11]! * z + matrix[15]!;

  if (clipW <= 0) return null;

  const ndcX = clipX / clipW;
  const ndcY = clipY / clipW;

  return [
    (ndcX + 1) * 0.5 * viewportWidth,
    (1 - ndcY) * 0.5 * viewportHeight,
  ];
}
