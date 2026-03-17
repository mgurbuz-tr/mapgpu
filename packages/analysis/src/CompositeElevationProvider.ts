/**
 * CompositeElevationProvider — chains multiple IElevationProviders.
 *
 * Returns the maximum elevation from all providers at each point.
 * Useful for combining terrain + building obstacle providers.
 */

import type { IElevationProvider } from './IElevationProvider.js';

export class CompositeElevationProvider implements IElevationProvider {
  private readonly _providers: IElevationProvider[];

  constructor(providers: IElevationProvider[]) {
    this._providers = providers;
  }

  sampleElevation(lon: number, lat: number): number | null {
    let maxElev: number | null = null;

    for (const provider of this._providers) {
      const elev = provider.sampleElevation(lon, lat);
      if (elev !== null) {
        maxElev = maxElev === null ? elev : Math.max(maxElev, elev);
      }
    }

    return maxElev;
  }

  sampleElevationBatch(points: Float64Array): Float64Array {
    const count = points.length / 2;
    const result = new Float64Array(count).fill(NaN);

    for (const provider of this._providers) {
      const batch = provider.sampleElevationBatch(points);
      for (let i = 0; i < count; i++) {
        const val = batch[i]!;
        if (Number.isFinite(val)) {
          result[i] = Number.isNaN(result[i]!) ? val : Math.max(result[i]!, val);
        }
      }
    }

    return result;
  }
}
