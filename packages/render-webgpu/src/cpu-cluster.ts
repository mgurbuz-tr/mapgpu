/**
 * CPU Grid-Hash Clustering
 *
 * Pure TypeScript, zero GPU dependency, unit-testable.
 * Port of the GPU compute shader's two-pass algorithm (assignCells + finalizeClusters)
 * into a single-pass CPU implementation using a Map-based spatial hash.
 *
 * Output format matches ClusterOutput exactly (posX, posY, count, flags — 16 bytes),
 * so render pipelines consume the data identically.
 *
 * Additionally produces `membership` arrays for cluster-click fit-bounds:
 * membership[i] contains the source-point indices that belong to entries[i].
 */

// ─── Public Types ───

export interface CpuClusterEntry {
  posX: number;  // centroid X (EPSG:3857)
  posY: number;  // centroid Y (EPSG:3857)
  count: number;
  flags: number; // bit0=isCluster, bits1-2=tier (0=small, 1=medium, 2=large)
}

export interface CpuClusterResult {
  entries: CpuClusterEntry[];
  membership: number[][]; // entries[i] → source point indices
}

// ─── Internal Cell ───

interface CellAccumulator {
  cellX: number;
  cellY: number;
  sumX: number;
  sumY: number;
  count: number;
  members: number[];
}

// ─── Constants ───

const HALF_WORLD = 20037508.342789244;

// ─── Public API ───

/**
 * Grid-hash clustering in EPSG:3857 space.
 *
 * @param points         Flat [x,y,x,y,...] array of EPSG:3857 coordinates.
 * @param clusterRadius  Cluster radius in screen pixels.
 * @param zoom           Current map zoom level.
 * @param extent         Visible extent [minX, minY, maxX, maxY] in EPSG:3857.
 * @param minClusterCount Minimum point count to form a cluster (default 2).
 * @returns Cluster entries and membership arrays.
 */
export function gridCluster(
  points: Float32Array,
  clusterRadius: number,
  zoom: number,
  extent: [number, number, number, number],
  minClusterCount: number,
): CpuClusterResult {
  const pointCount = points.length / 2;
  if (pointCount === 0) {
    return { entries: [], membership: [] };
  }

  // Cell size in EPSG:3857 meters
  const radius = clusterRadius > 0 ? clusterRadius : 60;
  const metersPerPixel = (2 * HALF_WORLD) / (256 * Math.pow(2, zoom));
  const cellSize = radius * metersPerPixel;
  const mergeDistanceSq = cellSize * cellSize;

  // Extent filter with one-cell margin.
  const filterMinX = extent[0] - cellSize;
  const filterMinY = extent[1] - cellSize;
  const filterMaxX = extent[2] + cellSize;
  const filterMaxY = extent[3] + cellSize;

  // ── Pass 1: grid bucket accumulation (unbounded hash grid) ──
  const cells = new Map<string, CellAccumulator>();

  for (let i = 0; i < pointCount; i++) {
    const px = points[i * 2]!;
    const py = points[i * 2 + 1]!;

    // Ignore points outside extent + one-cell margin.
    if (px < filterMinX || px > filterMaxX || py < filterMinY || py > filterMaxY) {
      continue;
    }

    // World-anchored grid indices. This avoids viewport-origin dependent
    // cluster jitter while panning.
    const cellX = Math.floor((px + HALF_WORLD) / cellSize);
    const cellY = Math.floor((py + HALF_WORLD) / cellSize);
    if (!Number.isFinite(cellX) || !Number.isFinite(cellY)) {
      continue;
    }
    const key = `${cellX},${cellY}`;

    let cell = cells.get(key);
    if (!cell) {
      cell = { cellX, cellY, sumX: 0, sumY: 0, count: 0, members: [] };
      cells.set(key, cell);
    }

    cell.sumX += px;
    cell.sumY += py;
    cell.count++;
    cell.members.push(i);
  }

  if (cells.size === 0) {
    return { entries: [], membership: [] };
  }

  // ── Pass 2: neighbor-cell merging (Grid++) ──
  const cellList = Array.from(cells.values());
  cellList.sort((a, b) => (a.cellY - b.cellY) || (a.cellX - b.cellX));

  const indexByCoord = new Map<string, number>();
  for (let i = 0; i < cellList.length; i++) {
    const c = cellList[i]!;
    indexByCoord.set(`${c.cellX},${c.cellY}`, i);
  }

  const dsu = new UnionFind(cellList.length);
  const centroidX = new Float64Array(cellList.length);
  const centroidY = new Float64Array(cellList.length);
  for (let i = 0; i < cellList.length; i++) {
    const c = cellList[i]!;
    centroidX[i] = c.sumX / c.count;
    centroidY[i] = c.sumY / c.count;
  }

  for (let i = 0; i < cellList.length; i++) {
    const c = cellList[i]!;
    for (let ny = c.cellY - 1; ny <= c.cellY + 1; ny++) {
      for (let nx = c.cellX - 1; nx <= c.cellX + 1; nx++) {
        if (nx < c.cellX || (nx === c.cellX && ny <= c.cellY)) continue;

        const neighborIdx = indexByCoord.get(`${nx},${ny}`);
        if (neighborIdx === undefined || neighborIdx <= i) continue;

        const dx = centroidX[i]! - centroidX[neighborIdx]!;
        const dy = centroidY[i]! - centroidY[neighborIdx]!;
        if (dx * dx + dy * dy <= mergeDistanceSq) {
          dsu.union(i, neighborIdx);
        }
      }
    }
  }

  interface GroupAccumulator {
    sumX: number;
    sumY: number;
    count: number;
    members: number[];
    minMember: number;
  }

  const groups = new Map<number, GroupAccumulator>();
  for (let i = 0; i < cellList.length; i++) {
    const root = dsu.find(i);
    const cell = cellList[i]!;
    let group = groups.get(root);
    if (!group) {
      group = { sumX: 0, sumY: 0, count: 0, members: [], minMember: Infinity };
      groups.set(root, group);
    }
    group.sumX += cell.sumX;
    group.sumY += cell.sumY;
    group.count += cell.count;
    group.members.push(...cell.members);
    for (const member of cell.members) {
      if (member < group.minMember) group.minMember = member;
    }
  }

  const orderedGroups = Array.from(groups.values());
  orderedGroups.sort((a, b) => a.minMember - b.minMember);

  // ── Finalize ──
  const entries: CpuClusterEntry[] = [];
  const membership: number[][] = [];

  for (const group of orderedGroups) {
    if (group.count >= minClusterCount) {
      const cx = group.sumX / group.count;
      const cy = group.sumY / group.count;
      const sortedMembers = group.members.slice().sort((a, b) => a - b);

      let flags = 0;
      flags = 1; // isCluster
      if (group.count >= 100) {
        flags |= (2 << 1); // large tier
      } else if (group.count >= 10) {
        flags |= (1 << 1); // medium tier
      }
      entries.push({ posX: cx, posY: cy, count: group.count, flags });
      membership.push(sortedMembers);
      continue;
    }

    // Below cluster threshold -> keep original points as singles.
    const sortedMembers = group.members.slice().sort((a, b) => a - b);
    for (const idx of sortedMembers) {
      const px = points[idx * 2]!;
      const py = points[idx * 2 + 1]!;
      entries.push({ posX: px, posY: py, count: 1, flags: 0 });
      membership.push([idx]);
    }
  }

  return { entries, membership };
}

class UnionFind {
  private parent: Int32Array;
  private rank: Uint8Array;

  constructor(size: number) {
    this.parent = new Int32Array(size);
    this.rank = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      this.parent[i] = i;
    }
  }

  find(x: number): number {
    let root = x;
    while (this.parent[root]! !== root) {
      root = this.parent[root]!;
    }

    let cur = x;
    while (this.parent[cur]! !== cur) {
      const next = this.parent[cur]!;
      this.parent[cur] = root;
      cur = next;
    }
    return root;
  }

  union(a: number, b: number): void {
    let rootA = this.find(a);
    let rootB = this.find(b);
    if (rootA === rootB) return;

    const rankA = this.rank[rootA]!;
    const rankB = this.rank[rootB]!;
    if (rankA < rankB) {
      [rootA, rootB] = [rootB, rootA];
    }
    this.parent[rootB] = rootA;
    if (rankA === rankB) {
      this.rank[rootA] = rankA + 1;
    }
  }
}

/**
 * Pack CpuClusterEntry[] into a Float32Array suitable for GPU storage buffer.
 * Layout matches ClusterOutput struct: posX(f32), posY(f32), count(u32), flags(u32).
 */
export function packClusterEntries(entries: CpuClusterEntry[]): Float32Array {
  const data = new Float32Array(entries.length * 4);
  const u32View = new Uint32Array(data.buffer);

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    const offset = i * 4;
    data[offset] = e.posX;
    data[offset + 1] = e.posY;
    u32View[offset + 2] = e.count;
    u32View[offset + 3] = e.flags;
  }

  return data;
}
