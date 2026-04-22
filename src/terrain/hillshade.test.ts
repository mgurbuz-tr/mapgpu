import { describe, expect, it } from 'vitest';
import { computeHillshadeTS } from './hillshade.js';
import { DTED_NODATA } from './types.js';

describe('computeHillshadeTS', () => {
  it('computes border pixels from clamped neighborhood instead of a fixed constant', () => {
    const width = 6;
    const height = 6;
    const elevations = new Int16Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        elevations[y * width + x] = x * 100;
      }
    }

    const out = computeHillshadeTS(elevations, width, height, 30, 30, 315, 45);

    // Regression guard: borders should no longer be force-written to 180.
    expect(out[0]).not.toBe(180);
    expect(out[width - 1]).not.toBe(180);
    expect(out[(height - 1) * width]).not.toBe(180);
  });

  it('keeps nodata pixels transparent candidates by emitting zero shade', () => {
    const width = 4;
    const height = 4;
    const elevations = new Int16Array(width * height).fill(100);
    elevations[5] = DTED_NODATA;

    const out = computeHillshadeTS(elevations, width, height, 30, 30, 315, 45);
    expect(out[5]).toBe(0);
  });
});
