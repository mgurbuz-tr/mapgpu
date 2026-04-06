/**
 * AnalysisService — Facade / orchestration.
 *
 * Implements IAnalysis interface. Delegates each analysis type to the
 * corresponding specialised class.
 * IWasmCore is injected via constructor (dependency injection).
 */

import type {
  IAnalysis,
  IWasmCore,
  LosParams,
  LosAnalysisResult,
  ElevationQueryParams,
  ElevationQueryResult,
  BufferParams,
  BufferResult,
  RouteSampleParams,
  RouteSampleResult,
} from '@mapgpu/core';

import { LosAnalysis } from './LosAnalysis.js';
import { ElevationQuery } from './ElevationQuery.js';
import { BufferAnalysis } from './BufferAnalysis.js';
import { RouteSampler } from './RouteSampler.js';

export class AnalysisService implements IAnalysis {
  private readonly losAnalysis: LosAnalysis;
  private readonly elevationQuery: ElevationQuery;
  private readonly bufferAnalysis: BufferAnalysis;
  private readonly routeSampler: RouteSampler;

  constructor(wasmCore: IWasmCore) {
    this.losAnalysis = new LosAnalysis(wasmCore);
    this.elevationQuery = new ElevationQuery();
    this.bufferAnalysis = new BufferAnalysis();
    this.routeSampler = new RouteSampler();
  }

  runLos(params: LosParams): Promise<LosAnalysisResult> {
    return this.losAnalysis.runLos(params);
  }

  queryElevation(params: ElevationQueryParams): Promise<ElevationQueryResult> {
    return this.elevationQuery.queryElevation(params);
  }

  buffer(params: BufferParams): Promise<BufferResult> {
    return this.bufferAnalysis.buffer(params);
  }

  sampleRoute(params: RouteSampleParams): Promise<RouteSampleResult> {
    return this.routeSampler.sampleRoute(params);
  }
}
