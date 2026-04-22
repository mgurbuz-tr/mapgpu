import { GlobeProjection } from './projections/GlobeProjection.js';
import { VerticalPerspectiveTransform } from './projections/VerticalPerspectiveTransform.js';

export interface Resolve3DCameraLockCenterOptions {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
  viewportWidth: number;
  viewportHeight: number;
  targetCenter: [number, number];
  targetAltitude: number;
  maxIterations?: number;
  tolerancePx?: number;
}

export function resolve3DCameraLockCenter( // NOSONAR
  options: Resolve3DCameraLockCenterOptions,
): [number, number] {
  const viewportWidth = Math.max(1, options.viewportWidth);
  const viewportHeight = Math.max(1, options.viewportHeight);
  const tolerancePx = options.tolerancePx ?? 0.5;
  const maxIterations = options.maxIterations ?? 8;
  const targetScreenX = viewportWidth * 0.5;
  const targetScreenY = viewportHeight * 0.5;
  let candidate: [number, number] = [...options.center] as [number, number];

  for (let i = 0; i < maxIterations; i++) {
    const transform = createTransform(options, candidate, viewportWidth, viewportHeight);
    const screen = project3DLockTarget(transform, options.zoom, options.targetCenter, options.targetAltitude);
    if (!screen) {
      if (!nearlyEqual(candidate[0], options.targetCenter[0], 1e-9) || !nearlyEqual(candidate[1], options.targetCenter[1], 1e-9)) {
        candidate = [...options.targetCenter] as [number, number];
        continue;
      }
      return candidate;
    }

    const dx = screen[0] - targetScreenX;
    const dy = screen[1] - targetScreenY;
    if (Math.abs(dx) <= tolerancePx && Math.abs(dy) <= tolerancePx) {
      return candidate;
    }

    const jacobian = estimateScreenJacobian(options, candidate, viewportWidth, viewportHeight);
    if (!jacobian) {
      return candidate;
    }

    const det = jacobian.dScreenXDLon * jacobian.dScreenYDLat - jacobian.dScreenXDLat * jacobian.dScreenYDLon;
    if (Math.abs(det) < 1e-9) {
      return candidate;
    }

    const deltaLon = (dx * jacobian.dScreenYDLat - dy * jacobian.dScreenXDLat) / det;
    const deltaLat = (jacobian.dScreenXDLon * dy - jacobian.dScreenYDLon * dx) / det;
    const nextCenter: [number, number] = [
      wrapLongitude(candidate[0] - clamp(deltaLon, -1, 1)),
      clamp(candidate[1] - clamp(deltaLat, -1, 1), -85.051129, 85.051129),
    ];
    if (nearlyEqual(candidate[0], nextCenter[0], 1e-9) && nearlyEqual(candidate[1], nextCenter[1], 1e-9)) {
      return candidate;
    }
    candidate = nextCenter;
  }

  return candidate;
}

export function project3DLockTarget(
  transform: VerticalPerspectiveTransform,
  zoom: number,
  targetCenter: [number, number],
  targetAltitude: number,
): [number, number] | null {
  const globeness = GlobeProjection.globenessFromZoom(zoom);
  const [lon, lat] = targetCenter;

  if (globeness >= 0.999) {
    return transform.lonLatToScreenWithAltitude(lon, lat, targetAltitude);
  }
  if (globeness <= 0.001) {
    return transform.lonLatToScreenFlatWithAltitude(lon, lat, targetAltitude);
  }

  const globe = transform.lonLatToScreenWithAltitude(lon, lat, targetAltitude);
  const flat = transform.lonLatToScreenFlatWithAltitude(lon, lat, targetAltitude);
  if (!flat) return globe;
  if (!globe) return flat;

  return [
    flat[0] + (globe[0] - flat[0]) * globeness,
    flat[1] + (globe[1] - flat[1]) * globeness,
  ];
}

function createTransform(
  options: Resolve3DCameraLockCenterOptions,
  center: [number, number],
  viewportWidth: number,
  viewportHeight: number,
): VerticalPerspectiveTransform {
  return new VerticalPerspectiveTransform({
    center,
    zoom: options.zoom,
    pitch: options.pitch,
    bearing: options.bearing,
    viewportWidth,
    viewportHeight,
  });
}

function estimateScreenJacobian(
  options: Resolve3DCameraLockCenterOptions,
  center: [number, number],
  viewportWidth: number,
  viewportHeight: number,
): {
  dScreenXDLon: number;
  dScreenXDLat: number;
  dScreenYDLon: number;
  dScreenYDLat: number;
} | null {
  const epsilon = 1e-3;
  const centerProjection = projectAtCenter(options, center, viewportWidth, viewportHeight);
  const lonProjection = projectAtCenter(
    options,
    [wrapLongitude(center[0] + epsilon), center[1]],
    viewportWidth,
    viewportHeight,
  );
  const latProjection = projectAtCenter(
    options,
    [center[0], clamp(center[1] + epsilon, -85.051129, 85.051129)],
    viewportWidth,
    viewportHeight,
  );
  if (!centerProjection || !lonProjection || !latProjection) {
    return null;
  }

  return {
    dScreenXDLon: (lonProjection[0] - centerProjection[0]) / epsilon,
    dScreenXDLat: (latProjection[0] - centerProjection[0]) / epsilon,
    dScreenYDLon: (lonProjection[1] - centerProjection[1]) / epsilon,
    dScreenYDLat: (latProjection[1] - centerProjection[1]) / epsilon,
  };
}

function projectAtCenter(
  options: Resolve3DCameraLockCenterOptions,
  center: [number, number],
  viewportWidth: number,
  viewportHeight: number,
): [number, number] | null {
  const transform = createTransform(options, center, viewportWidth, viewportHeight);
  return project3DLockTarget(transform, options.zoom, options.targetCenter, options.targetAltitude);
}

function wrapLongitude(lon: number): number {
  let wrapped = ((lon + 180) % 360 + 360) % 360 - 180;
  if (wrapped === -180 && lon > 0) {
    wrapped = 180;
  }
  return wrapped;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function nearlyEqual(a: number, b: number, epsilon: number): boolean {
  return Math.abs(a - b) <= epsilon;
}
