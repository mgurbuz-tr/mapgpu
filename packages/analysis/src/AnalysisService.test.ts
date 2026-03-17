import { describe, it, expect, vi } from 'vitest';
import { AnalysisService } from './AnalysisService.js';
import { MockWasmCore } from './__mocks__/MockWasmCore.js';

describe('AnalysisService', () => {
  const wasm = new MockWasmCore();
  const service = new AnalysisService(wasm);

  it('should implement IAnalysis interface methods', () => {
    expect(typeof service.runLos).toBe('function');
    expect(typeof service.queryElevation).toBe('function');
    expect(typeof service.buffer).toBe('function');
    expect(typeof service.sampleRoute).toBe('function');
  });

  it('should delegate runLos to LosAnalysis', async () => {
    const result = await service.runLos({
      observer: [29.0, 41.0],
      target: [29.1, 41.1],
      observerOffset: 2,
    });

    expect(result).toBeDefined();
    expect(typeof result.visible).toBe('boolean');
    expect(result.profile).toBeInstanceOf(Float64Array);
    expect(result.visibleLine).toBeInstanceOf(Float64Array);
  });

  it('should delegate queryElevation to ElevationQuery', async () => {
    const result = await service.queryElevation({
      points: new Float64Array([29.0, 41.0, 32.85, 39.92]),
    });

    expect(result).toBeDefined();
    expect(result.elevations).toBeInstanceOf(Float64Array);
    expect(result.elevations.length).toBe(2);
  });

  it('should delegate buffer to BufferAnalysis', async () => {
    const result = await service.buffer({
      geometry: { type: 'Point', coordinates: [29.0, 41.0] },
      distance: 1000,
    });

    expect(result).toBeDefined();
    expect(result.geometry.type).toBe('Polygon');
    expect(result.geometry.coordinates.length).toBe(1);
  });

  it('should delegate sampleRoute to RouteSampler', async () => {
    const result = await service.sampleRoute({
      route: new Float64Array([29.0, 41.0, 29.1, 41.1]),
      interval: 5000,
    });

    expect(result).toBeDefined();
    expect(result.samples).toBeInstanceOf(Float64Array);
    expect(typeof result.totalDistance).toBe('number');
  });

  it('should use the injected IWasmCore for LOS operations', async () => {
    const spyGenerate = vi.spyOn(wasm, 'generateLosSegments');
    const spyCompute = vi.spyOn(wasm, 'computeLos');

    await service.runLos({
      observer: [29.0, 41.0],
      target: [29.1, 41.1],
    });

    expect(spyGenerate).toHaveBeenCalled();
    expect(spyCompute).toHaveBeenCalled();

    spyGenerate.mockRestore();
    spyCompute.mockRestore();
  });
});
