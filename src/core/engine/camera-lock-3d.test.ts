import { describe, expect, it } from 'vitest';
import { resolve3DCameraLockCenter, project3DLockTarget } from './camera-lock-3d.js';
import { VerticalPerspectiveTransform } from './projections/VerticalPerspectiveTransform.js';

describe('3D camera lock center solver', () => {
  it('recenters an elevated target onto the screen center', () => {
    const options = {
      center: [29, 41] as [number, number],
      zoom: 11,
      pitch: 58,
      bearing: 0,
      viewportWidth: 800,
      viewportHeight: 600,
      targetCenter: [29, 41] as [number, number],
      targetAltitude: 1500,
    };

    const rawTransform = new VerticalPerspectiveTransform({
      center: options.targetCenter,
      zoom: options.zoom,
      pitch: options.pitch,
      bearing: options.bearing,
      viewportWidth: options.viewportWidth,
      viewportHeight: options.viewportHeight,
    });
    const before = project3DLockTarget(
      rawTransform,
      options.zoom,
      options.targetCenter,
      options.targetAltitude,
    );
    expect(before).not.toBeNull();
    expect(Math.abs(before![1] - options.viewportHeight * 0.5)).toBeGreaterThan(5);

    const resolvedCenter = resolve3DCameraLockCenter(options);
    const solvedTransform = new VerticalPerspectiveTransform({
      center: resolvedCenter,
      zoom: options.zoom,
      pitch: options.pitch,
      bearing: options.bearing,
      viewportWidth: options.viewportWidth,
      viewportHeight: options.viewportHeight,
    });
    const after = project3DLockTarget(
      solvedTransform,
      options.zoom,
      options.targetCenter,
      options.targetAltitude,
    );

    expect(after).not.toBeNull();
    expect(Math.abs(after![0] - options.viewportWidth * 0.5)).toBeLessThan(0.5);
    expect(Math.abs(after![1] - options.viewportHeight * 0.5)).toBeLessThan(0.5);
  });
});
