import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WGSL_GLOBE_HEIGHT_SEMANTICS } from './wgsl-preambles.js';

describe('wgsl-preambles docs parity', () => {
  it.skip('keeps globe height semantics aligned with the renderer spatial contract doc — docs/ not yet migrated', () => {
    const docPath = resolve(import.meta.dirname, '../../../docs/07-RENDERER-SPATIAL-CONTRACT.md');
    const doc = readFileSync(docPath, 'utf8');

    expect(WGSL_GLOBE_HEIGHT_SEMANTICS).toContain('const ALTITUDE_EXAG: f32 = 1.0;');
    expect(WGSL_GLOBE_HEIGHT_SEMANTICS).toContain('return altMeters / EARTH_RADIUS_M * ALTITUDE_EXAG;');
    expect(doc).toContain('ALTITUDE_EXAG = 1.0');
    expect(doc).toContain('altitudeOffset(altMeters) = altMeters / EARTH_RADIUS_M');
  });
});
