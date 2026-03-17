import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { LosAnalysisResult } from '@mapgpu/core';
import { LOSWidget } from './LOSWidget.js';

function createMockResult(visible: boolean): LosAnalysisResult {
  return {
    visible,
    blockingPoint: visible ? null : new Float64Array([29.0, 40.5, 350.0]),
    profile: new Float64Array([0, 100, 1000, 200, 2000, 150]),
    visibleLine: new Float64Array([28.97, 41.01, 100, 29.0, 40.8, 200]),
    blockedLine: visible ? null : new Float64Array([29.0, 40.5, 350, 29.5, 40.0, 0]),
  };
}

describe('LOSWidget', () => {
  let container: HTMLElement;
  let widget: LOSWidget;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    widget = new LOSWidget({ id: 'los-test' });
    widget.mount(container);
  });

  it('should render with correct DOM structure', () => {
    const root = container.querySelector('#los-test');
    expect(root).not.toBeNull();
    expect(root!.classList.contains('mapgpu-widget-los')).toBe(true);
  });

  it('should have observer and target inputs', () => {
    const observerInput = container.querySelector('.observer-input');
    const targetInput = container.querySelector('.target-input');
    expect(observerInput).not.toBeNull();
    expect(targetInput).not.toBeNull();
  });

  it('should have offset sliders', () => {
    const obsSlider = container.querySelector('.observer-slider') as HTMLInputElement;
    const tgtSlider = container.querySelector('.target-slider') as HTMLInputElement;
    expect(obsSlider).not.toBeNull();
    expect(tgtSlider).not.toBeNull();
    expect(obsSlider.type).toBe('range');
    expect(tgtSlider.type).toBe('range');
  });

  it('should have offset number inputs', () => {
    const obsOffset = container.querySelector('.observer-offset-input') as HTMLInputElement;
    const tgtOffset = container.querySelector('.target-offset-input') as HTMLInputElement;
    expect(obsOffset).not.toBeNull();
    expect(tgtOffset).not.toBeNull();
    expect(obsOffset.value).toBe('1.8');
    expect(tgtOffset.value).toBe('0.0');
  });

  it('should have profile canvas', () => {
    const canvas = container.querySelector('.los-profile') as HTMLCanvasElement;
    expect(canvas).not.toBeNull();
    expect(canvas.style.display).toBe('none'); // Hidden before result
  });

  it('should have pick points button', () => {
    const pickBtn = container.querySelector('.pick-btn');
    expect(pickBtn).not.toBeNull();
    expect(pickBtn!.textContent).toBe('Pick Points');
  });

  it('should set observer programmatically', () => {
    widget.setObserver(28.97, 41.01);
    expect(widget.observer).toEqual([28.97, 41.01]);

    const input = container.querySelector('.observer-input') as HTMLInputElement;
    expect(input.value).toContain('28.97');
  });

  it('should set target programmatically', () => {
    widget.setTarget(29.5, 40.0);
    expect(widget.target).toEqual([29.5, 40.0]);
  });

  it('should update observer offset via slider', () => {
    const slider = container.querySelector('.observer-slider') as HTMLInputElement;
    slider.value = '10';
    slider.dispatchEvent(new Event('input'));
    expect(widget.observerOffset).toBe(10);
  });

  it('should update target offset via number input', () => {
    const numInput = container.querySelector('.target-offset-input') as HTMLInputElement;
    numInput.value = '5';
    numInput.dispatchEvent(new Event('input'));
    expect(widget.targetOffset).toBe(5);
  });

  it('should sync slider and number input for observer', () => {
    widget.setObserverOffset(15);
    const slider = container.querySelector('.observer-slider') as HTMLInputElement;
    const numInput = container.querySelector('.observer-offset-input') as HTMLInputElement;
    expect(slider.value).toBe('15');
    expect(numInput.value).toBe('15.0');
  });

  it('should emit run event with correct params', () => {
    const handler = vi.fn();
    widget.onRunLos(handler);

    widget.setObserver(28.97, 41.01);
    widget.setTarget(29.5, 40.0);
    widget.setObserverOffset(5);
    widget.setTargetOffset(2);

    const runBtn = container.querySelector('.run-btn') as HTMLButtonElement;
    runBtn.click();

    expect(handler).toHaveBeenCalledWith({
      observer: [28.97, 41.01],
      target: [29.5, 40.0],
      observerOffset: 5,
      targetOffset: 2,
    });
  });

  it('should not emit run when observer/target not set', () => {
    const handler = vi.fn();
    widget.onRunLos(handler);

    const runBtn = container.querySelector('.run-btn') as HTMLButtonElement;
    runBtn.click();

    expect(handler).not.toHaveBeenCalled();
  });

  it('should display visible result', () => {
    const result = createMockResult(true);
    widget.setResult(result);

    const resultEl = container.querySelector('.los-result');
    expect(resultEl).not.toBeNull();
    expect(resultEl!.textContent).toContain('Visible');
  });

  it('should display blocked result with obstacle info', () => {
    const result = createMockResult(false);
    widget.setResult(result);

    const resultEl = container.querySelector('.los-result');
    expect(resultEl!.textContent).toContain('Blocked');

    const blocking = container.querySelector('.blocking-info');
    expect(blocking).not.toBeNull();
    expect(blocking!.textContent).toContain('29.0000');
  });

  it('should show profile canvas after result', () => {
    widget.setResult(createMockResult(true));
    const canvas = container.querySelector('.los-profile') as HTMLCanvasElement;
    expect(canvas.style.display).toBe('block');
  });

  it('should clear result and inputs', () => {
    widget.setObserver(28.97, 41.01);
    widget.setTarget(29.5, 40.0);
    widget.setResult(createMockResult(true));

    widget.clearResult();

    expect(widget.observer).toBeNull();
    expect(widget.target).toBeNull();
    expect(widget.result).toBeNull();

    const resultEl = container.querySelector('.los-result');
    expect(resultEl!.innerHTML).toBe('');

    const canvas = container.querySelector('.los-profile') as HTMLCanvasElement;
    expect(canvas.style.display).toBe('none');
  });

  it('should reset sliders on clear', () => {
    widget.setObserverOffset(50);
    widget.setTargetOffset(25);
    widget.clearResult();

    const obsSlider = container.querySelector('.observer-slider') as HTMLInputElement;
    const tgtSlider = container.querySelector('.target-slider') as HTMLInputElement;
    expect(obsSlider.value).toBe('1.8');
    expect(tgtSlider.value).toBe('0');
  });

  it('should unsubscribe run handler', () => {
    const handler = vi.fn();
    widget.onRunLos(handler);
    widget.offRunLos(handler);

    widget.setObserver(28.97, 41.01);
    widget.setTarget(29.5, 40.0);

    const runBtn = container.querySelector('.run-btn') as HTMLButtonElement;
    runBtn.click();

    expect(handler).not.toHaveBeenCalled();
  });

  it('should bind to LosTool', () => {
    const mockTool = {
      observer: null,
      target: null,
      observerOffset: 1.8,
      targetOffset: 0,
      setObserverOffset: vi.fn(),
      setTargetOffset: vi.fn(),
    };

    const eventSource = {
      on: vi.fn(),
    };

    widget.bindLosTool(mockTool, eventSource as never);

    // Should register two event handlers
    expect(eventSource.on).toHaveBeenCalledTimes(2);
    expect(eventSource.on).toHaveBeenCalledWith('los-update', expect.any(Function));
    expect(eventSource.on).toHaveBeenCalledWith('los-clear', expect.any(Function));
  });

  it('should clean up on destroy', () => {
    widget.destroy();
    expect(container.querySelector('#los-test')).toBeNull();
  });
});
