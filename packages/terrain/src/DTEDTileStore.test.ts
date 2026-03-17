import { describe, expect, it } from 'vitest';
import { DTEDTileStore } from './DTEDTileStore.js';
import type { DTEDTile } from './types.js';

function makeTile(
  level: DTEDTile['level'],
  lon: number,
  lat: number,
  width: number,
  height: number,
  values: number[],
): DTEDTile {
  return {
    id: `${lat >= 0 ? 'n' : 's'}${Math.abs(lat)}${lon >= 0 ? 'e' : 'w'}${Math.abs(lon)}_${level}`,
    level,
    origin: [lon, lat],
    width,
    height,
    elevations: new Int16Array(values),
    minElevation: Math.min(...values),
    maxElevation: Math.max(...values),
    extent: {
      minX: lon,
      minY: lat,
      maxX: lon + 1,
      maxY: lat + 1,
    },
  };
}

describe('DTEDTileStore edge stitching', () => {
  it('stitches shared east-west edge values when adjacent cells are loaded', () => {
    const store = new DTEDTileStore();

    // Row-major north-up:
    // west:  [10,20]
    //        [30,40]
    // east:  [100,110]
    //        [120,130]
    const west = makeTile('dt1', 0, 0, 2, 2, [10, 20, 30, 40]);
    const east = makeTile('dt1', 1, 0, 2, 2, [100, 110, 120, 130]);

    store.addLocal(west);
    store.addLocal(east);

    const stitchedWest = store.getTile('dt1', 0, 0)!;
    const stitchedEast = store.getTile('dt1', 1, 0)!;

    expect([...stitchedWest.elevations]).toEqual([10, 60, 30, 80]);
    expect([...stitchedEast.elevations]).toEqual([60, 110, 80, 130]);
  });

  it('stitches shared north-south edge values when adjacent cells are loaded', () => {
    const store = new DTEDTileStore();

    // north (lat=1): [11,12]
    //                [50,60]  <- south edge
    // south (lat=0): [150,170] <- north edge
    //                [21,22]
    const north = makeTile('dt1', 0, 1, 2, 2, [11, 12, 50, 60]);
    const south = makeTile('dt1', 0, 0, 2, 2, [150, 170, 21, 22]);

    store.addLocal(north);
    store.addLocal(south);

    const stitchedNorth = store.getTile('dt1', 0, 1)!;
    const stitchedSouth = store.getTile('dt1', 0, 0)!;

    expect([...stitchedNorth.elevations]).toEqual([11, 12, 100, 115]);
    expect([...stitchedSouth.elevations]).toEqual([100, 115, 21, 22]);
  });
});
