/**
 * LabelEngine Tests
 *
 * Grid-based collision detection, priority siralamasi,
 * viewport disinda label'larin gizlenmesi testleri.
 */

import { describe, it, expect } from 'vitest';
import { LabelEngine } from './label-engine.js';
import type { LabelInput, Viewport } from './label-engine.js';

const VIEWPORT: Viewport = { width: 800, height: 600 };

describe('LabelEngine', () => {
  // ─── Basic Construction ───

  it('creates with default cell size', () => {
    const engine = new LabelEngine();
    expect(engine).toBeDefined();
  });

  it('creates with custom cell size', () => {
    const engine = new LabelEngine(128);
    expect(engine).toBeDefined();
  });

  // ─── Empty input ───

  it('returns empty array for empty input', () => {
    const engine = new LabelEngine();
    const result = engine.layoutLabels([], VIEWPORT);
    expect(result).toHaveLength(0);
  });

  // ─── Single label ───

  it('places single label as visible', () => {
    const engine = new LabelEngine();
    const labels: LabelInput[] = [
      { id: 'a', screenX: 100, screenY: 100, width: 80, height: 20, priority: 1 },
    ];

    const result = engine.layoutLabels(labels, VIEWPORT);
    expect(result).toHaveLength(1);
    expect(result[0]!.visible).toBe(true);
    expect(result[0]!.id).toBe('a');
  });

  // ─── Non-overlapping labels ───

  it('places non-overlapping labels as visible', () => {
    const engine = new LabelEngine();
    const labels: LabelInput[] = [
      { id: 'a', screenX: 10, screenY: 10, width: 50, height: 20, priority: 1 },
      { id: 'b', screenX: 200, screenY: 200, width: 50, height: 20, priority: 1 },
      { id: 'c', screenX: 400, screenY: 400, width: 50, height: 20, priority: 1 },
    ];

    const result = engine.layoutLabels(labels, VIEWPORT);
    expect(result.every(r => r.visible)).toBe(true);
  });

  // ─── Overlapping labels ───

  it('hides lower priority overlapping label', () => {
    const engine = new LabelEngine();
    const labels: LabelInput[] = [
      { id: 'high', screenX: 100, screenY: 100, width: 80, height: 20, priority: 10 },
      { id: 'low', screenX: 110, screenY: 105, width: 80, height: 20, priority: 1 },
    ];

    const result = engine.layoutLabels(labels, VIEWPORT);
    const high = result.find(r => r.id === 'high')!;
    const low = result.find(r => r.id === 'low')!;

    expect(high.visible).toBe(true);
    expect(low.visible).toBe(false);
  });

  it('shows higher priority label when overlapping', () => {
    const engine = new LabelEngine();
    const labels: LabelInput[] = [
      { id: 'low', screenX: 100, screenY: 100, width: 80, height: 20, priority: 1 },
      { id: 'high', screenX: 110, screenY: 105, width: 80, height: 20, priority: 10 },
    ];

    const result = engine.layoutLabels(labels, VIEWPORT);
    const high = result.find(r => r.id === 'high')!;
    const low = result.find(r => r.id === 'low')!;

    // High priority is placed first, low priority is hidden
    expect(high.visible).toBe(true);
    expect(low.visible).toBe(false);
  });

  // ─── Multiple overlaps ───

  it('handles chain of overlapping labels', () => {
    const engine = new LabelEngine();
    const labels: LabelInput[] = [
      { id: 'a', screenX: 100, screenY: 100, width: 60, height: 20, priority: 3 },
      { id: 'b', screenX: 120, screenY: 105, width: 60, height: 20, priority: 2 },
      { id: 'c', screenX: 140, screenY: 110, width: 60, height: 20, priority: 1 },
    ];

    const result = engine.layoutLabels(labels, VIEWPORT);
    const visible = result.filter(r => r.visible);

    // Only the highest priority should be visible
    expect(visible).toHaveLength(1);
    expect(visible[0]!.id).toBe('a');
  });

  // ─── Viewport clipping ───

  it('hides labels completely outside viewport (left)', () => {
    const engine = new LabelEngine();
    const labels: LabelInput[] = [
      { id: 'outside', screenX: -200, screenY: 100, width: 80, height: 20, priority: 10 },
    ];

    const result = engine.layoutLabels(labels, VIEWPORT);
    expect(result[0]!.visible).toBe(false);
  });

  it('hides labels completely outside viewport (right)', () => {
    const engine = new LabelEngine();
    const labels: LabelInput[] = [
      { id: 'outside', screenX: 900, screenY: 100, width: 80, height: 20, priority: 10 },
    ];

    const result = engine.layoutLabels(labels, VIEWPORT);
    expect(result[0]!.visible).toBe(false);
  });

  it('hides labels completely outside viewport (top)', () => {
    const engine = new LabelEngine();
    const labels: LabelInput[] = [
      { id: 'outside', screenX: 100, screenY: -100, width: 80, height: 20, priority: 10 },
    ];

    const result = engine.layoutLabels(labels, VIEWPORT);
    expect(result[0]!.visible).toBe(false);
  });

  it('hides labels completely outside viewport (bottom)', () => {
    const engine = new LabelEngine();
    const labels: LabelInput[] = [
      { id: 'outside', screenX: 100, screenY: 700, width: 80, height: 20, priority: 10 },
    ];

    const result = engine.layoutLabels(labels, VIEWPORT);
    expect(result[0]!.visible).toBe(false);
  });

  it('shows labels partially inside viewport', () => {
    const engine = new LabelEngine();
    const labels: LabelInput[] = [
      { id: 'partial', screenX: -40, screenY: 100, width: 80, height: 20, priority: 1 },
    ];

    const result = engine.layoutLabels(labels, VIEWPORT);
    // Partially inside — should be visible
    expect(result[0]!.visible).toBe(true);
  });

  // ─── Priority ordering ───

  it('processes higher priority labels first', () => {
    const engine = new LabelEngine();
    // All overlap at same position
    const labels: LabelInput[] = [
      { id: 'p1', screenX: 100, screenY: 100, width: 80, height: 20, priority: 1 },
      { id: 'p5', screenX: 100, screenY: 100, width: 80, height: 20, priority: 5 },
      { id: 'p3', screenX: 100, screenY: 100, width: 80, height: 20, priority: 3 },
    ];

    const result = engine.layoutLabels(labels, VIEWPORT);
    const p5 = result.find(r => r.id === 'p5')!;
    expect(p5.visible).toBe(true);

    const p1 = result.find(r => r.id === 'p1')!;
    const p3 = result.find(r => r.id === 'p3')!;
    expect(p1.visible).toBe(false);
    expect(p3.visible).toBe(false);
  });

  // ─── Edge-touching labels (no overlap) ───

  it('treats edge-touching labels as non-overlapping', () => {
    const engine = new LabelEngine();
    const labels: LabelInput[] = [
      { id: 'a', screenX: 100, screenY: 100, width: 50, height: 20, priority: 1 },
      { id: 'b', screenX: 150, screenY: 100, width: 50, height: 20, priority: 1 },
    ];

    const result = engine.layoutLabels(labels, VIEWPORT);
    expect(result.every(r => r.visible)).toBe(true);
  });

  // ─── Position preservation ───

  it('preserves screen position in output', () => {
    const engine = new LabelEngine();
    const labels: LabelInput[] = [
      { id: 'a', screenX: 123, screenY: 456, width: 50, height: 20, priority: 1 },
    ];

    const result = engine.layoutLabels(labels, VIEWPORT);
    expect(result[0]!.screenX).toBe(123);
    expect(result[0]!.screenY).toBe(456);
  });

  // ─── Large number of labels ───

  it('handles many labels without error', () => {
    const engine = new LabelEngine();
    const labels: LabelInput[] = [];
    for (let i = 0; i < 500; i++) {
      labels.push({
        id: `label-${i}`,
        screenX: Math.random() * 800,
        screenY: Math.random() * 600,
        width: 60,
        height: 16,
        priority: Math.floor(Math.random() * 10),
      });
    }

    const result = engine.layoutLabels(labels, VIEWPORT);
    expect(result).toHaveLength(500);

    // At least some should be visible
    const visible = result.filter(r => r.visible);
    expect(visible.length).toBeGreaterThan(0);
    // Not all can be visible with random placement and 500 labels
    expect(visible.length).toBeLessThan(500);
  });

  // ─── Returns all labels ───

  it('returns a placement for every input label', () => {
    const engine = new LabelEngine();
    const labels: LabelInput[] = [
      { id: 'a', screenX: 100, screenY: 100, width: 80, height: 20, priority: 1 },
      { id: 'b', screenX: 105, screenY: 105, width: 80, height: 20, priority: 2 },
      { id: 'c', screenX: 500, screenY: 500, width: 80, height: 20, priority: 0 },
    ];

    const result = engine.layoutLabels(labels, VIEWPORT);
    expect(result).toHaveLength(3);

    const ids = result.map(r => r.id).sort();
    expect(ids).toEqual(['a', 'b', 'c']);
  });
});
