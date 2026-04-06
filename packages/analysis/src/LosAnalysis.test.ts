import { describe, it, expect } from 'vitest';
import { LosAnalysis } from './LosAnalysis.js';
import { MockWasmCore } from './__mocks__/MockWasmCore.js';
import { MapGpuError } from '@mapgpu/core';

describe('LosAnalysis', () => {
  const wasm = new MockWasmCore();
  const los = new LosAnalysis(wasm);

  it('should compute a basic visible LOS on flat terrain', async () => {
    const result = await los.runLos({
      observer: [29.0, 41.0],
      target: [29.1, 41.1],
      observerOffset: 2,
    });

    expect(result.visible).toBe(true);
    expect(result.blockingPoint).toBeNull();
    expect(result.visibleLine.length).toBeGreaterThan(0);
    expect(result.blockedLine).toBeNull();
    expect(result.profile.length).toBeGreaterThan(0);
  });

  it('should handle LOS with offsets', async () => {
    const result = await los.runLos({
      observer: [29.0, 41.0],
      target: [29.1, 41.1],
      observerOffset: 5,
      targetOffset: 3,
    });

    expect(result.visible).toBe(true);
    expect(result.profile.length).toBeGreaterThan(0);
  });

  it('should use custom sampleCount', async () => {
    const result = await los.runLos({
      observer: [29.0, 41.0],
      target: [29.1, 41.1],
      sampleCount: 128,
    });

    // Profile has 2 entries per sample (distance, elevation)
    expect(result.profile.length).toBe(128 * 2);
  });

  it('should use default sampleCount (512) when not provided', async () => {
    const result = await los.runLos({
      observer: [29.0, 41.0],
      target: [29.1, 41.1],
    });

    expect(result.profile.length).toBe(512 * 2);
  });

  describe('input validation', () => {
    it('should reject observer longitude out of range', async () => {
      await expect(
        los.runLos({
          observer: [200, 41.0],
          target: [29.0, 41.0],
        }),
      ).rejects.toThrow(MapGpuError);
    });

    it('should reject observer latitude out of range', async () => {
      await expect(
        los.runLos({
          observer: [29.0, 100],
          target: [29.0, 41.0],
        }),
      ).rejects.toThrow(MapGpuError);
    });

    it('should reject target longitude out of range', async () => {
      await expect(
        los.runLos({
          observer: [29.0, 41.0],
          target: [-181, 41.0],
        }),
      ).rejects.toThrow(MapGpuError);
    });

    it('should reject target latitude out of range', async () => {
      await expect(
        los.runLos({
          observer: [29.0, 41.0],
          target: [29.0, -91],
        }),
      ).rejects.toThrow(MapGpuError);
    });

    it('should reject sampleCount below minimum', async () => {
      await expect(
        los.runLos({
          observer: [29.0, 41.0],
          target: [29.1, 41.1],
          sampleCount: 1,
        }),
      ).rejects.toThrow(MapGpuError);
    });

    it('should reject sampleCount above maximum', async () => {
      await expect(
        los.runLos({
          observer: [29.0, 41.0],
          target: [29.1, 41.1],
          sampleCount: 10000,
        }),
      ).rejects.toThrow(MapGpuError);
    });

    it('should reject NaN coordinates', async () => {
      await expect(
        los.runLos({
          observer: [NaN, 41.0],
          target: [29.0, 41.0],
        }),
      ).rejects.toThrow(MapGpuError);
    });

    it('should reject Infinity coordinates', async () => {
      await expect(
        los.runLos({
          observer: [Infinity, 41.0],
          target: [29.0, 41.0],
        }),
      ).rejects.toThrow(MapGpuError);
    });
  });

  describe('edge cases', () => {
    it('should handle observer === target (same point)', async () => {
      const result = await los.runLos({
        observer: [29.0, 41.0],
        target: [29.0, 41.0],
        observerOffset: 2,
      });

      expect(result.visible).toBe(true);
    });

    it('should handle boundary coordinates (180, 90)', async () => {
      const result = await los.runLos({
        observer: [180, 90],
        target: [-180, -90],
      });

      expect(result).toBeDefined();
      expect(result.profile.length).toBeGreaterThan(0);
    });

    it('should handle zero offsets', async () => {
      const result = await los.runLos({
        observer: [29.0, 41.0],
        target: [29.1, 41.1],
        observerOffset: 0,
        targetOffset: 0,
      });

      expect(result).toBeDefined();
    });
  });
});
