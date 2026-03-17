/**
 * Icon Pipeline Tests
 *
 * WGSL shader source ve pipeline factory fonksiyonlarının testleri.
 */

import { describe, it, expect } from 'vitest';
import {
  ICON_SHADER_SOURCE,
  createIconBindGroupLayout,
} from './icon-pipeline.js';

describe('icon-pipeline', () => {
  // ─── Shader Source ───

  it('exports non-empty WGSL shader source', () => {
    expect(ICON_SHADER_SOURCE).toBeTruthy();
    expect(ICON_SHADER_SOURCE.length).toBeGreaterThan(100);
  });

  it('shader source contains required struct definitions', () => {
    expect(ICON_SHADER_SOURCE).toContain('CameraUniforms');
    expect(ICON_SHADER_SOURCE).toContain('IconMaterial');
    expect(ICON_SHADER_SOURCE).toContain('tintColor');
    expect(ICON_SHADER_SOURCE).toContain('uvRect');
    expect(ICON_SHADER_SOURCE).toContain('rotation');
  });

  it('shader source contains vertex and fragment entry points', () => {
    expect(ICON_SHADER_SOURCE).toContain('fn vs_main');
    expect(ICON_SHADER_SOURCE).toContain('fn fs_main');
  });

  it('shader source contains texture sampling', () => {
    expect(ICON_SHADER_SOURCE).toContain('textureSample');
    expect(ICON_SHADER_SOURCE).toContain('iconTexture');
    expect(ICON_SHADER_SOURCE).toContain('iconSampler');
  });

  it('shader source contains billboard quad offsets', () => {
    expect(ICON_SHADER_SOURCE).toContain('quadOffsets');
  });

  it('shader source contains tint color application', () => {
    expect(ICON_SHADER_SOURCE).toContain('tintColor');
    expect(ICON_SHADER_SOURCE).toContain('tinted');
  });

  it('shader source contains rotation math', () => {
    expect(ICON_SHADER_SOURCE).toContain('cosR');
    expect(ICON_SHADER_SOURCE).toContain('sinR');
    expect(ICON_SHADER_SOURCE).toContain('rotatedOffset');
  });

  it('shader source contains alpha discard', () => {
    expect(ICON_SHADER_SOURCE).toContain('discard');
  });

  // ─── Bind Group Layout ───

  it('createIconBindGroupLayout is a function', () => {
    expect(typeof createIconBindGroupLayout).toBe('function');
  });
});
