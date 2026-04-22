import { describe, it, expect, vi } from 'vitest';
import { AnimationManager, Easing } from './AnimationManager.js';

describe('AnimationManager', () => {
  // ─── Basic Animation ───

  it('should create an animation and call onUpdate on update()', () => {
    const mgr = new AnimationManager();
    const onUpdate = vi.fn();

    mgr.animate({
      from: 0,
      to: 100,
      duration: 1000,
      easing: 'linear',
      onUpdate,
    });

    expect(mgr.activeCount).toBe(1);

    // First update: sets start time
    mgr.update(0);
    expect(onUpdate).toHaveBeenCalledWith(0, 0);

    // 50% through
    mgr.update(500);
    expect(onUpdate).toHaveBeenCalledWith(50, 0.5);

    // 100% through
    mgr.update(1000);
    expect(onUpdate).toHaveBeenCalledWith(100, 1);

    expect(mgr.activeCount).toBe(0);

    mgr.destroy();
  });

  it('should call onComplete when animation finishes', () => {
    const mgr = new AnimationManager();
    const onComplete = vi.fn();

    mgr.animate({
      from: 0,
      to: 1,
      duration: 100,
      onUpdate: vi.fn(),
      onComplete,
    });

    mgr.update(0);
    expect(onComplete).not.toHaveBeenCalled();

    mgr.update(100);
    expect(onComplete).toHaveBeenCalledTimes(1);

    mgr.destroy();
  });

  it('should not call onComplete when cancelled', () => {
    const mgr = new AnimationManager();
    const onComplete = vi.fn();

    const handle = mgr.animate({
      from: 0,
      to: 1,
      duration: 1000,
      onUpdate: vi.fn(),
      onComplete,
    });

    mgr.update(0);
    handle.cancel();

    mgr.update(1000);
    expect(onComplete).not.toHaveBeenCalled();

    mgr.destroy();
  });

  // ─── Cancel ───

  it('should cancel an animation', () => {
    const mgr = new AnimationManager();
    const onUpdate = vi.fn();

    const handle = mgr.animate({
      from: 0,
      to: 100,
      duration: 1000,
      onUpdate,
    });

    expect(handle.done).toBe(false);
    expect(mgr.activeCount).toBe(1);

    mgr.cancel(handle.id);

    expect(handle.done).toBe(true);
    expect(mgr.activeCount).toBe(0);

    // Further updates should not call onUpdate
    mgr.update(500);
    expect(onUpdate).not.toHaveBeenCalled();

    mgr.destroy();
  });

  it('should cancel via handle.cancel()', () => {
    const mgr = new AnimationManager();

    const handle = mgr.animate({
      from: 0,
      to: 100,
      duration: 1000,
      onUpdate: vi.fn(),
    });

    handle.cancel();
    expect(handle.done).toBe(true);
    expect(mgr.activeCount).toBe(0);

    mgr.destroy();
  });

  // ─── Easing Functions ───

  it('linear easing should return t', () => {
    expect(Easing.linear(0)).toBe(0);
    expect(Easing.linear(0.5)).toBe(0.5);
    expect(Easing.linear(1)).toBe(1);
  });

  it('easeIn should accelerate (t^2)', () => {
    expect(Easing.easeIn(0)).toBe(0);
    expect(Easing.easeIn(0.5)).toBe(0.25);
    expect(Easing.easeIn(1)).toBe(1);
  });

  it('easeOut should decelerate', () => {
    expect(Easing.easeOut(0)).toBe(0);
    expect(Easing.easeOut(0.5)).toBe(0.75);
    expect(Easing.easeOut(1)).toBe(1);
  });

  it('easeInOut should be symmetric', () => {
    expect(Easing.easeInOut(0)).toBe(0);
    expect(Easing.easeInOut(1)).toBe(1);
    // At 0.5, easeInOut should be 0.5
    expect(Easing.easeInOut(0.5)).toBe(0.5);
    // First half accelerates, second half decelerates
    expect(Easing.easeInOut(0.25)).toBeLessThan(0.25);
    expect(Easing.easeInOut(0.75)).toBeGreaterThan(0.75);
  });

  it('should apply easeIn easing during animation', () => {
    const mgr = new AnimationManager();
    const values: number[] = [];

    mgr.animate({
      from: 0,
      to: 100,
      duration: 1000,
      easing: 'easeIn',
      onUpdate: (value) => values.push(value),
    });

    mgr.update(0);    // t=0
    mgr.update(500);  // t=0.5
    mgr.update(1000); // t=1.0

    // easeIn: t^2 → at t=0.5 eased is 0.25 → value is 25
    expect(values[0]).toBe(0);
    expect(values[1]).toBe(25);
    expect(values[2]).toBe(100);

    mgr.destroy();
  });

  it('should accept a custom easing function', () => {
    const mgr = new AnimationManager();
    const values: number[] = [];

    // Custom easing: cubic
    const cubic = (t: number) => t * t * t;

    mgr.animate({
      from: 0,
      to: 1000,
      duration: 1000,
      easing: cubic,
      onUpdate: (value) => values.push(value),
    });

    mgr.update(0);
    mgr.update(500); // t=0.5, cubic=0.125, value=125

    expect(values[1]).toBe(125);

    mgr.destroy();
  });

  // ─── Concurrent Animations ───

  it('should run multiple animations concurrently', () => {
    const mgr = new AnimationManager();
    const updateA = vi.fn();
    const updateB = vi.fn();

    mgr.animate({
      from: 0,
      to: 100,
      duration: 1000,
      easing: 'linear',
      onUpdate: updateA,
    });

    mgr.animate({
      from: 200,
      to: 300,
      duration: 500,
      easing: 'linear',
      onUpdate: updateB,
    });

    expect(mgr.activeCount).toBe(2);

    // Update both
    mgr.update(0);
    expect(updateA).toHaveBeenCalledWith(0, 0);
    expect(updateB).toHaveBeenCalledWith(200, 0);

    mgr.update(250);
    expect(updateA).toHaveBeenCalledWith(25, 0.25);
    expect(updateB).toHaveBeenCalledWith(250, 0.5);

    // Animation B completes at 500ms
    mgr.update(500);
    expect(updateB).toHaveBeenCalledWith(300, 1);
    expect(mgr.activeCount).toBe(1);

    // Animation A continues
    mgr.update(1000);
    expect(updateA).toHaveBeenCalledWith(100, 1);
    expect(mgr.activeCount).toBe(0);

    mgr.destroy();
  });

  // ─── Update Progression ───

  it('should handle zero-duration animation', () => {
    const mgr = new AnimationManager();
    const onUpdate = vi.fn();
    const onComplete = vi.fn();

    mgr.animate({
      from: 0,
      to: 100,
      duration: 0,
      onUpdate,
      onComplete,
    });

    // Should complete immediately on first update
    mgr.update(0);
    expect(onUpdate).toHaveBeenCalledWith(100, 1);
    expect(onComplete).toHaveBeenCalled();
    expect(mgr.activeCount).toBe(0);

    mgr.destroy();
  });

  it('should clamp progress to 1 when beyond duration', () => {
    const mgr = new AnimationManager();
    const onUpdate = vi.fn();

    mgr.animate({
      from: 0,
      to: 100,
      duration: 100,
      easing: 'linear',
      onUpdate,
    });

    mgr.update(0);
    mgr.update(200); // Way past duration

    // Should not exceed to value
    expect(onUpdate).toHaveBeenLastCalledWith(100, 1);

    mgr.destroy();
  });

  // ─── Cancel All ───

  it('should cancel all animations', () => {
    const mgr = new AnimationManager();

    const h1 = mgr.animate({ from: 0, to: 1, duration: 100, onUpdate: vi.fn() });
    const h2 = mgr.animate({ from: 0, to: 1, duration: 100, onUpdate: vi.fn() });

    mgr.cancelAll();

    expect(h1.done).toBe(true);
    expect(h2.done).toBe(true);
    expect(mgr.activeCount).toBe(0);

    mgr.destroy();
  });

  // ─── Destroy ───

  it('should clean up on destroy', () => {
    const mgr = new AnimationManager();
    mgr.animate({ from: 0, to: 1, duration: 100, onUpdate: vi.fn() });
    mgr.animate({ from: 0, to: 1, duration: 100, onUpdate: vi.fn() });

    mgr.destroy();
    expect(mgr.activeCount).toBe(0);
  });
});
