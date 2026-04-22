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
  WorkerPoolRegistry,
} from '../core/index.js';

import { LosAnalysis, type LosAnalysisOptions } from './LosAnalysis.js';
import { ElevationQuery } from './ElevationQuery.js';
import { BufferAnalysis } from './BufferAnalysis.js';
import { RouteSampler } from './RouteSampler.js';

export interface AnalysisServiceOptions {
  /** Optional worker registry (owned by ViewCore) for off-thread analysis. */
  workerRegistry?: WorkerPoolRegistry;
}

export class AnalysisService implements IAnalysis {
  private readonly losAnalysis: LosAnalysis;
  private readonly elevationQuery: ElevationQuery;
  private readonly bufferAnalysis: BufferAnalysis;
  private readonly routeSampler: RouteSampler;

  constructor(wasmCore: IWasmCore, options?: AnalysisServiceOptions) {
    const losOpts: LosAnalysisOptions = {};
    if (options?.workerRegistry) {
      losOpts.workerRegistry = options.workerRegistry;
    }
    this.losAnalysis = new LosAnalysis(wasmCore, undefined, losOpts);
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
