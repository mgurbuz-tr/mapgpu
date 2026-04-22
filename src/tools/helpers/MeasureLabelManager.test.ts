import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MeasureLabelManager } from './MeasureLabelManager.js';
import type { MeasureLabel } from './MeasureLabelManager.js';

// Mock DOM
function createMockContainer(): HTMLElement {
  const el = document.createElement('div');
  return el;
}

describe('MeasureLabelManager', () => {
  let container: HTMLElement;
  let toScreen: ReturnType<typeof vi.fn>;
  let mgr: MeasureLabelManager;

  beforeEach(() => {
    container = createMockContainer();
    toScreen = vi.fn().mockReturnValue([100, 200]);
    mgr = new MeasureLabelManager({ container, toScreen });
  });

  // ─── addLabel ───

  it('adds a label element to container', () => {
    mgr.addLabel({
      id: 'test-1',
      geoPosition: [29, 41],
      text: 'Hello',
      type: 'distance',
      persistent: false,
    });

    expect(container.children).toHaveLength(1);
    const el = container.children[0] as HTMLDivElement;
    expect(el.textContent).toBe('Hello');
    expect(el.style.pointerEvents).toBe('none');
  });

  it('positions element using toScreen', () => {
    toScreen.mockReturnValue([150, 250]);
    mgr.addLabel({
      id: 'test-2',
      geoPosition: [10, 20],
      text: 'Pos',
      type: 'coordinate',
      persistent: false,
    });

    const el = container.children[0] as HTMLDivElement;
    expect(el.style.left).toBe('150px');
    expect(el.style.top).toBe('250px');
    expect(toScreen).toHaveBeenCalledWith(10, 20);
  });

  it('hides element when toScreen returns null', () => {
    toScreen.mockReturnValue(null);
    mgr.addLabel({
      id: 'test-3',
      geoPosition: [0, 0],
      text: 'Hidden',
      type: 'distance',
      persistent: false,
    });

    const el = container.children[0] as HTMLDivElement;
    expect(el.style.display).toBe('none');
  });

  it('replaces existing label with same id', () => {
    mgr.addLabel({ id: 'dup', geoPosition: [0, 0], text: 'First', type: 'distance', persistent: false });
    mgr.addLabel({ id: 'dup', geoPosition: [0, 0], text: 'Second', type: 'distance', persistent: false });

    expect(container.children).toHaveLength(1);
    expect((container.children[0] as HTMLDivElement).textContent).toBe('Second');
  });

  // ─── removeLabel ───

  it('removes a label', () => {
    mgr.addLabel({ id: 'rm', geoPosition: [0, 0], text: 'X', type: 'distance', persistent: false });
    expect(container.children).toHaveLength(1);

    mgr.removeLabel('rm');
    expect(container.children).toHaveLength(0);
    expect(mgr.labels.has('rm')).toBe(false);
  });

  it('no-op for non-existent label', () => {
    expect(() => mgr.removeLabel('does-not-exist')).not.toThrow();
  });

  // ─── updateLabel ───

  it('updates label text', () => {
    mgr.addLabel({ id: 'up', geoPosition: [0, 0], text: 'Old', type: 'distance', persistent: false });
    mgr.updateLabel('up', 'New');

    const el = container.children[0] as HTMLDivElement;
    expect(el.textContent).toBe('New');
    expect(mgr.labels.get('up')!.text).toBe('New');
  });

  // ─── clearTransient ───

  it('clears non-persistent labels', () => {
    mgr.addLabel({ id: 'p1', geoPosition: [0, 0], text: 'Persist', type: 'distance', persistent: true });
    mgr.addLabel({ id: 't1', geoPosition: [1, 1], text: 'Transient', type: 'distance', persistent: false });
    mgr.addLabel({ id: 't2', geoPosition: [2, 2], text: 'Transient2', type: 'distance', persistent: false });

    mgr.clearTransient();

    expect(container.children).toHaveLength(1);
    expect(mgr.labels.has('p1')).toBe(true);
    expect(mgr.labels.has('t1')).toBe(false);
    expect(mgr.labels.has('t2')).toBe(false);
  });

  // ─── clearAll ───

  it('clears all labels', () => {
    mgr.addLabel({ id: 'a', geoPosition: [0, 0], text: 'A', type: 'distance', persistent: true });
    mgr.addLabel({ id: 'b', geoPosition: [1, 1], text: 'B', type: 'distance', persistent: false });

    mgr.clearAll();

    expect(container.children).toHaveLength(0);
    expect(mgr.labels.size).toBe(0);
  });

  // ─── updatePositions ───

  it('updates all label positions', () => {
    mgr.addLabel({ id: 'x', geoPosition: [5, 10], text: 'X', type: 'distance', persistent: false });
    mgr.addLabel({ id: 'y', geoPosition: [15, 20], text: 'Y', type: 'distance', persistent: false });

    // Change toScreen to return new positions
    toScreen.mockReturnValue([300, 400]);
    mgr.updatePositions();

    const el1 = container.children[0] as HTMLDivElement;
    expect(el1.style.left).toBe('300px');
    expect(el1.style.top).toBe('400px');
  });

  // ─── destroy ───

  it('destroy clears everything', () => {
    mgr.addLabel({ id: 'd1', geoPosition: [0, 0], text: 'D', type: 'distance', persistent: true });
    mgr.destroy();

    expect(container.children).toHaveLength(0);
    expect(mgr.labels.size).toBe(0);
  });

  // ─── Label styling ───

  it('total label has bold orange style', () => {
    mgr.addLabel({ id: 'total', geoPosition: [0, 0], text: 'Total', type: 'total', persistent: false });
    const el = container.children[0] as HTMLDivElement;
    expect(el.style.fontWeight).toBe('bold');
  });

  it('area label has bold style', () => {
    mgr.addLabel({ id: 'area', geoPosition: [0, 0], text: 'Area', type: 'area', persistent: false });
    const el = container.children[0] as HTMLDivElement;
    expect(el.style.fontWeight).toBe('bold');
  });
});
