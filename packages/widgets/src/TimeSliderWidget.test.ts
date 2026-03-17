import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TimeSliderWidget } from './TimeSliderWidget.js';

describe('TimeSliderWidget', () => {
  let container: HTMLElement;
  let widget: TimeSliderWidget;
  const min = new Date('2024-01-01');
  const max = new Date('2024-12-31');

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    widget = new TimeSliderWidget({
      id: 'time-test',
      min,
      max,
      step: 86_400_000, // 1 day
    });
    widget.mount(container);
  });

  afterEach(() => {
    widget.destroy();
    vi.useRealTimers();
  });

  it('should render with correct DOM structure', () => {
    const root = container.querySelector('#time-test');
    expect(root).not.toBeNull();
    expect(root!.classList.contains('mapgpu-widget-timeslider')).toBe(true);

    const slider = root!.querySelector('input[type="range"]');
    expect(slider).not.toBeNull();
  });

  it('should default value to min date', () => {
    expect(widget.value.getTime()).toBe(min.getTime());
  });

  it('should accept custom initial value', () => {
    const customWidget = new TimeSliderWidget({
      id: 'custom-time',
      min,
      max,
      value: new Date('2024-06-15'),
    });
    customWidget.mount(container);
    expect(customWidget.value.getTime()).toBe(new Date('2024-06-15').getTime());
    customWidget.destroy();
  });

  it('should change value via setValue', () => {
    const handler = vi.fn();
    widget.onTimeChange(handler);

    widget.setValue(new Date('2024-06-15'));
    expect(widget.value.getTime()).toBe(new Date('2024-06-15').getTime());
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should clamp value to min/max range', () => {
    widget.setValue(new Date('2023-01-01'));
    expect(widget.value.getTime()).toBe(min.getTime());

    widget.setValue(new Date('2025-12-31'));
    expect(widget.value.getTime()).toBe(max.getTime());
  });

  it('should update value when slider changes', () => {
    const handler = vi.fn();
    widget.onTimeChange(handler);

    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    const midTime = new Date('2024-06-15').getTime();
    slider.value = String(midTime);
    slider.dispatchEvent(new Event('input'));

    expect(handler).toHaveBeenCalled();
  });

  it('should play and advance time', () => {
    const handler = vi.fn();
    widget.onTimeChange(handler);

    widget.play();
    expect(widget.playing).toBe(true);

    // Advance enough for one tick (default speed 1x → 1000ms interval)
    vi.advanceTimersByTime(1000);
    expect(handler).toHaveBeenCalled();
    expect(widget.value.getTime()).toBeGreaterThan(min.getTime());
  });

  it('should pause playback', () => {
    widget.play();
    expect(widget.playing).toBe(true);

    widget.pause();
    expect(widget.playing).toBe(false);
  });

  it('should stop and reset to min', () => {
    widget.setValue(new Date('2024-06-15'));
    widget.stop();

    expect(widget.playing).toBe(false);
    expect(widget.value.getTime()).toBe(min.getTime());
  });

  it('should change speed', () => {
    widget.setSpeed(2);
    expect(widget.speed).toBe(2);

    const speedLabel = container.querySelector('.speed-label');
    expect(speedLabel!.textContent).toBe('2x');
  });

  it('should advance faster at higher speed', () => {
    const handler = vi.fn();
    widget.onTimeChange(handler);

    widget.setSpeed(4);
    widget.play();

    // At 4x, interval is 250ms
    vi.advanceTimersByTime(250);
    expect(handler).toHaveBeenCalled();
  });

  it('should stop automatically when reaching max', () => {
    // Set value close to max (1 day before)
    widget.setValue(new Date(max.getTime() - 86_400_000));
    widget.play();

    // Advance one tick
    vi.advanceTimersByTime(1000);
    expect(widget.value.getTime()).toBe(max.getTime());

    // Next tick should cause pause since we've reached max
    vi.advanceTimersByTime(1000);
    expect(widget.playing).toBe(false);
  });

  it('should toggle play/pause via button', () => {
    const playBtn = container.querySelector('.play-btn') as HTMLButtonElement;

    playBtn.click();
    expect(widget.playing).toBe(true);
    expect(playBtn.textContent).toBe('Pause');

    playBtn.click();
    expect(widget.playing).toBe(false);
    expect(playBtn.textContent).toBe('Play');
  });

  it('should unsubscribe handler', () => {
    const handler = vi.fn();
    widget.onTimeChange(handler);
    widget.offTimeChange(handler);

    widget.setValue(new Date('2024-06-15'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('should cycle speed via speed button', () => {
    const speedBtn = container.querySelector('.speed-btn') as HTMLButtonElement;

    expect(widget.speed).toBe(1);
    speedBtn.click();
    expect(widget.speed).toBe(2);
    speedBtn.click();
    expect(widget.speed).toBe(4);
    speedBtn.click();
    expect(widget.speed).toBe(1);
  });

  it('should display date label', () => {
    const label = container.querySelector('.time-label');
    expect(label).not.toBeNull();
    expect(label!.textContent).toBe('2024-01-01');
  });

  it('should clean up on destroy', () => {
    widget.destroy();
    expect(container.querySelector('#time-test')).toBeNull();
  });
});
