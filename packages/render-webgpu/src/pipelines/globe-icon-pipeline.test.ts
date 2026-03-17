/**
 * Globe Icon Pipeline Tests
 *
 * Globe-specific icon shader source ve pipeline factory testleri.
 */

import { describe, it, expect } from 'vitest';
import {
  GLOBE_ICON_SHADER_SOURCE,
  createGlobeIconBindGroupLayout,
} from './globe-icon-pipeline.js';

describe('globe-icon-pipeline', () => {
  // ─── Shader Source ───

  it('exports non-empty WGSL shader source', () => {
    expect(GLOBE_ICON_SHADER_SOURCE).toBeTruthy();
    expect(GLOBE_ICON_SHADER_SOURCE.length).toBeGreaterThan(100);
  });

  it('shader source contains globe camera struct', () => {
    expect(GLOBE_ICON_SHADER_SOURCE).toContain('GlobeCameraUniforms');
    expect(GLOBE_ICON_SHADER_SOURCE).toContain('projectionTransition');
    expect(GLOBE_ICON_SHADER_SOURCE).toContain('clippingPlane');
    expect(GLOBE_ICON_SHADER_SOURCE).toContain('flatViewProjection');
  });

  it('shader source contains IconMaterial struct', () => {
    expect(GLOBE_ICON_SHADER_SOURCE).toContain('IconMaterial');
    expect(GLOBE_ICON_SHADER_SOURCE).toContain('tintColor');
    expect(GLOBE_ICON_SHADER_SOURCE).toContain('uvRect');
    expect(GLOBE_ICON_SHADER_SOURCE).toContain('rotation');
  });

  it('shader source contains globe projection helpers', () => {
    expect(GLOBE_ICON_SHADER_SOURCE).toContain('epsg3857ToMerc01');
    expect(GLOBE_ICON_SHADER_SOURCE).toContain('mercatorToAngular');
    expect(GLOBE_ICON_SHADER_SOURCE).toContain('angularToSphere');
    expect(GLOBE_ICON_SHADER_SOURCE).toContain('globeClippingZ');
  });

  it('shader source contains dual projection transition', () => {
    expect(GLOBE_ICON_SHADER_SOURCE).toContain('projectionTransition');
    expect(GLOBE_ICON_SHADER_SOURCE).toContain('flatClip');
    expect(GLOBE_ICON_SHADER_SOURCE).toContain('globeClip');
    expect(GLOBE_ICON_SHADER_SOURCE).toContain('mix(flatClip');
  });

  it('shader source contains horizon discard', () => {
    expect(GLOBE_ICON_SHADER_SOURCE).toContain('clipDot');
    expect(GLOBE_ICON_SHADER_SOURCE).toContain('discard');
  });

  it('shader source contains texture sampling', () => {
    expect(GLOBE_ICON_SHADER_SOURCE).toContain('textureSample');
    expect(GLOBE_ICON_SHADER_SOURCE).toContain('iconTexture');
    expect(GLOBE_ICON_SHADER_SOURCE).toContain('iconSampler');
  });

  it('shader source contains vertex and fragment entry points', () => {
    expect(GLOBE_ICON_SHADER_SOURCE).toContain('fn vs_main');
    expect(GLOBE_ICON_SHADER_SOURCE).toContain('fn fs_main');
  });

  it('shader source contains depth offset for icon ordering', () => {
    expect(GLOBE_ICON_SHADER_SOURCE).toContain('LAYER_DEPTH_OFFSET');
  });

  // ─── Bind Group Layout ───

  it('createGlobeIconBindGroupLayout is a function', () => {
    expect(typeof createGlobeIconBindGroupLayout).toBe('function');
  });
});
