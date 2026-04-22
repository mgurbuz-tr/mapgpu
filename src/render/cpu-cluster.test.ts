import { describe, it, expect } from 'vitest';
import { gridCluster, packClusterEntries, unpackClusterResult } from './cpu-cluster.js';

const HALF = 20037508.342789244;

describe('gridCluster', () => {
  it('returns empty result for empty input', () => {
    const result = gridCluster(
      new Float32Array([]),
      60, 4,
      [-HALF, -HALF, HALF, HALF],
      2,
    );
    expect(result.entries).toHaveLength(0);
    expect(result.membership).toHaveLength(0);
  });

  it('returns a single non-cluster entry for one point', () => {
    const pts = new Float32Array([1000, 2000]);
    const result = gridCluster(pts, 60, 4, [-HALF, -HALF, HALF, HALF], 2);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.count).toBe(1);
    expect(result.entries[0]!.flags & 1).toBe(0); // NOT a cluster
    expect(result.entries[0]!.posX).toBeCloseTo(1000, 5);
    expect(result.entries[0]!.posY).toBeCloseTo(2000, 5);
    expect(result.membership[0]).toEqual([0]);
  });

  it('clusters two nearby points', () => {
    // Two points very close together (same cell at zoom 4)
    const pts = new Float32Array([1000, 2000, 1001, 2001]);
    const result = gridCluster(pts, 60, 4, [-HALF, -HALF, HALF, HALF], 2);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.count).toBe(2);
    expect(result.entries[0]!.flags & 1).toBe(1); // IS a cluster
    // Centroid should be average
    expect(result.entries[0]!.posX).toBeCloseTo(1000.5, 1);
    expect(result.entries[0]!.posY).toBeCloseTo(2000.5, 1);
    expect(result.membership[0]).toEqual([0, 1]);
  });

  it('keeps two far-apart points separate', () => {
    // Points on opposite sides of the world
    const pts = new Float32Array([-10000000, 5000000, 10000000, -5000000]);
    const result = gridCluster(pts, 60, 4, [-HALF, -HALF, HALF, HALF], 2);

    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]!.count).toBe(1);
    expect(result.entries[1]!.count).toBe(1);
    // Neither is a cluster
    expect(result.entries[0]!.flags & 1).toBe(0);
    expect(result.entries[1]!.flags & 1).toBe(0);
    // Each has its own membership
    expect(result.membership[0]).toHaveLength(1);
    expect(result.membership[1]).toHaveLength(1);
  });

  it('classifies tiers correctly: small, medium, large', () => {
    // Build 150 points in same spot → large cluster
    const count = 150;
    const pts = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      pts[i * 2] = 1000 + Math.random() * 0.001;
      pts[i * 2 + 1] = 2000 + Math.random() * 0.001;
    }

    const result = gridCluster(pts, 60, 4, [-HALF, -HALF, HALF, HALF], 2);

    // Should have one cluster with all 150 points
    const cluster = result.entries.find(e => e.count === count);
    expect(cluster).toBeDefined();
    const tier = (cluster!.flags >> 1) & 3;
    expect(tier).toBe(2); // large
  });

  it('classifies medium tier (10-99)', () => {
    const count = 15;
    const pts = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      pts[i * 2] = 5000 + Math.random() * 0.001;
      pts[i * 2 + 1] = 5000 + Math.random() * 0.001;
    }

    const result = gridCluster(pts, 60, 4, [-HALF, -HALF, HALF, HALF], 2);
    const cluster = result.entries.find(e => e.count === count);
    expect(cluster).toBeDefined();
    const tier = (cluster!.flags >> 1) & 3;
    expect(tier).toBe(1); // medium
  });

  it('classifies small tier (2-9)', () => {
    const count = 5;
    const pts = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      pts[i * 2] = 3000 + Math.random() * 0.001;
      pts[i * 2 + 1] = 3000 + Math.random() * 0.001;
    }

    const result = gridCluster(pts, 60, 4, [-HALF, -HALF, HALF, HALF], 2);
    const cluster = result.entries.find(e => e.count === count);
    expect(cluster).toBeDefined();
    const tier = (cluster!.flags >> 1) & 3;
    expect(tier).toBe(0); // small
    expect(cluster!.flags & 1).toBe(1); // but still a cluster
  });

  it('preserves membership correctly', () => {
    // 3 points close together + 1 far away
    const pts = new Float32Array([
      100, 200,      // 0
      100.5, 200.5,  // 1
      101, 201,      // 2
      10000000, 10000000, // 3 — far away
    ]);

    const result = gridCluster(pts, 60, 4, [-HALF, -HALF, HALF, HALF], 2);

    // Find the cluster entry (count >= 2)
    const clusterEntry = result.entries.find(e => (e.flags & 1) === 1);
    const singleEntry = result.entries.find(e => (e.flags & 1) === 0);

    expect(clusterEntry).toBeDefined();
    expect(singleEntry).toBeDefined();

    // The cluster membership should contain {0,1,2}
    const clusterIdx = result.entries.indexOf(clusterEntry!);
    const members = result.membership[clusterIdx]!;
    expect(members.sort()).toEqual([0, 1, 2]);

    // The single membership should contain {3}
    const singleIdx = result.entries.indexOf(singleEntry!);
    expect(result.membership[singleIdx]).toEqual([3]);
  });

  it('respects minClusterCount', () => {
    // Two nearby points with minClusterCount=3 → neither forms a cluster
    const pts = new Float32Array([1000, 2000, 1001, 2001]);
    const result = gridCluster(pts, 60, 4, [-HALF, -HALF, HALF, HALF], 3);

    // Below threshold points are emitted as individual singles.
    expect(result.entries).toHaveLength(2);
    expect(result.membership).toHaveLength(2);
    expect(result.membership[0]).toEqual([0]);
    expect(result.membership[1]).toEqual([1]);

    // All entries should be non-clusters.
    for (const e of result.entries) {
      expect(e.flags & 1).toBe(0);
      expect(e.count).toBe(1);
    }
  });

  it('ignores points outside extent + one-cell margin', () => {
    const extent: [number, number, number, number] = [0, 0, 100, 100];
    const pts = new Float32Array([
      50, 50,             // inside extent
      -1_000_000, -1_000_000, // far outside margin
      1_000_000, 1_000_000,   // far outside margin
    ]);

    const result = gridCluster(pts, 10, 4, extent, 2);
    expect(result.entries).toHaveLength(1);
    expect(result.membership).toHaveLength(1);
    expect(result.membership[0]).toEqual([0]);
  });

  it('keeps points inside the one-cell margin', () => {
    const extent: [number, number, number, number] = [0, 0, 100, 100];
    const radius = 10;
    const zoom = 4;
    const metersPerPixel = (2 * HALF) / (256 * Math.pow(2, zoom));
    const margin = radius * metersPerPixel;
    const minXWithMargin = extent[0] - margin;

    const pts = new Float32Array([
      minXWithMargin + 1, 50,  // inside margin
      extent[0] + 10, 50,      // inside extent
      minXWithMargin - 1, 50,  // outside margin
    ]);

    const result = gridCluster(pts, radius, zoom, extent, 2);
    const allMembers = result.membership.flat().sort((a, b) => a - b);
    expect(allMembers).toEqual([0, 1]);
  });

  it('does not drop points at high zoom when extent requires >256 cells', () => {
    const extent: [number, number, number, number] = [-HALF, -HALF, HALF, HALF];
    const pts = new Float32Array([
      -18_000_000, -9_000_000, // 0
      0, 0,                    // 1
      18_000_000, 9_000_000,   // 2
    ]);

    const result = gridCluster(pts, 60, 14, extent, 2);
    const allMembers = result.membership.flat().sort((a, b) => a - b);
    expect(allMembers).toEqual([0, 1, 2]);
  });
});

describe('packClusterEntries', () => {
  it('packs entries into Float32Array with correct layout', () => {
    const entries = [
      { posX: 100.5, posY: 200.5, count: 42, flags: 3 },
    ];

    const packed = packClusterEntries(entries);
    expect(packed).toHaveLength(4);
    expect(packed[0]).toBeCloseTo(100.5);
    expect(packed[1]).toBeCloseTo(200.5);

    // count and flags are u32 stored in f32 buffer
    const u32 = new Uint32Array(packed.buffer);
    expect(u32[2]).toBe(42);
    expect(u32[3]).toBe(3);
  });

  it('returns empty array for empty input', () => {
    const packed = packClusterEntries([]);
    expect(packed).toHaveLength(0);
  });
});

describe('unpackClusterResult', () => {
  it('round-trips a gridCluster result through the flat worker representation', () => {
    const pts = new Float32Array([
      0, 0,
      100, 100,
      200, 200,
      5_000_000, 5_000_000,
    ]);
    const original = gridCluster(pts, 60, 4, [-HALF, -HALF, HALF, HALF], 2);

    const packedEntries = packClusterEntries(original.entries);
    let totalMembers = 0;
    for (const m of original.membership) totalMembers += m.length;
    const membershipValues = new Int32Array(totalMembers);
    const membershipOffsets = new Int32Array(original.membership.length + 1);
    let cursor = 0;
    for (let i = 0; i < original.membership.length; i++) {
      membershipOffsets[i] = cursor;
      const members = original.membership[i]!;
      for (let j = 0; j < members.length; j++) {
        membershipValues[cursor + j] = members[j]!;
      }
      cursor += members.length;
    }
    membershipOffsets[original.membership.length] = cursor;

    const reconstructed = unpackClusterResult(packedEntries, membershipValues, membershipOffsets);

    expect(reconstructed.entries.length).toBe(original.entries.length);
    for (let i = 0; i < original.entries.length; i++) {
      expect(reconstructed.entries[i]!.posX).toBeCloseTo(original.entries[i]!.posX, 3);
      expect(reconstructed.entries[i]!.posY).toBeCloseTo(original.entries[i]!.posY, 3);
      expect(reconstructed.entries[i]!.count).toBe(original.entries[i]!.count);
      expect(reconstructed.entries[i]!.flags).toBe(original.entries[i]!.flags);
    }
    expect(reconstructed.membership).toEqual(original.membership);
  });
});
