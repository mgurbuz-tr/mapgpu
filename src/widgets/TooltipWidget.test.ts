import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TooltipWidget } from './TooltipWidget.js';

function createMockView(toScreenResult: [number, number] | null = [100, 100]) {
  const canvas = document.createElement('canvas');
  const parent = document.createElement('div');
  parent.appendChild(canvas);

  return {
    id: 'test-view',
    type: '2d' as const,
    canvas,
    parent,
    on: vi.fn(),
    off: vi.fn(),
    toScreen: vi.fn().mockReturnValue(toScreenResult),
  };
}

describe('TooltipWidget', () => {
  let tooltip: TooltipWidget;

  beforeEach(() => {
    tooltip = new TooltipWidget();
  });

  it('should create sticky element with correct class and styles', () => {
    // Access the sticky element indirectly by attaching to a view
    const view = createMockView();
    tooltip.attachTo(view);

    const stickyEl = view.parent.querySelector('.mapgpu-tooltip--sticky') as HTMLElement;
    expect(stickyEl).not.toBeNull();
    expect(stickyEl.style.position).toBe('absolute');
    expect(stickyEl.style.display).toBe('none');
    expect(stickyEl.style.pointerEvents).toBe('none');
    expect(stickyEl.style.whiteSpace).toBe('nowrap');
  });

  it('should addPermanent and create element with content', () => {
    const view = createMockView();
    tooltip.attachTo(view);

    tooltip.addPermanent('city', 'Istanbul', [29.0, 41.0]);

    const el = view.parent.querySelector('.mapgpu-tooltip--permanent');
    expect(el).not.toBeNull();
    expect(el!.textContent).toBe('Istanbul');
  });

  it('should position permanent tooltip using toScreen', () => {
    const view = createMockView([200, 300]);
    tooltip.attachTo(view);

    tooltip.addPermanent('pt', 'Test', [10, 20]);

    expect(view.toScreen).toHaveBeenCalledWith(10, 20);

    const el = view.parent.querySelector('.mapgpu-tooltip--permanent') as HTMLElement;
    expect(el.style.left).toBe('210px');  // 200 + 10 default offset
    expect(el.style.top).toBe('300px');   // 300 + 0 default offset
  });

  it('should apply custom offset and className to permanent tooltip', () => {
    const view = createMockView([50, 60]);
    tooltip.attachTo(view);

    tooltip.addPermanent('pt', 'Custom', [0, 0], {
      offset: [5, -10],
      className: 'my-tooltip',
    });

    const el = view.parent.querySelector('.my-tooltip') as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.style.left).toBe('55px');   // 50 + 5
    expect(el.style.top).toBe('50px');    // 60 + (-10)
  });

  it('should removePermanent and remove element from DOM', () => {
    const view = createMockView();
    tooltip.attachTo(view);

    tooltip.addPermanent('city', 'Istanbul', [29.0, 41.0]);
    expect(view.parent.querySelector('.mapgpu-tooltip--permanent')).not.toBeNull();

    tooltip.removePermanent('city');
    expect(view.parent.querySelector('.mapgpu-tooltip--permanent')).toBeNull();
  });

  it('should replace permanent tooltip when same id is added again', () => {
    const view = createMockView();
    tooltip.attachTo(view);

    tooltip.addPermanent('city', 'Old', [0, 0]);
    tooltip.addPermanent('city', 'New', [1, 1]);

    const els = view.parent.querySelectorAll('.mapgpu-tooltip--permanent');
    expect(els.length).toBe(1);
    expect(els[0]!.textContent).toBe('New');
  });

  it('should showSticky and display at screen position', () => {
    const view = createMockView();
    tooltip.attachTo(view);

    tooltip.showSticky('Hover info', 150, 250);

    const stickyEl = view.parent.querySelector('.mapgpu-tooltip--sticky') as HTMLElement;
    expect(stickyEl.style.display).not.toBe('none');
    expect(stickyEl.textContent).toBe('Hover info');
    expect(stickyEl.style.left).toBe('160px');  // 150 + 10
    expect(stickyEl.style.top).toBe('250px');
  });

  it('should hideSticky and hide the element', () => {
    const view = createMockView();
    tooltip.attachTo(view);

    tooltip.showSticky('Visible', 0, 0);
    tooltip.hideSticky();

    const stickyEl = view.parent.querySelector('.mapgpu-tooltip--sticky') as HTMLElement;
    expect(stickyEl.style.display).toBe('none');
  });

  it('should hide permanent tooltip when toScreen returns null', () => {
    const view = createMockView(null);
    tooltip.attachTo(view);

    tooltip.addPermanent('hidden', 'Not visible', [0, 0]);

    const el = view.parent.querySelector('.mapgpu-tooltip--permanent') as HTMLElement;
    expect(el.style.display).toBe('none');
  });

  it('should destroy and clean up all tooltips and listeners', () => {
    const view = createMockView();
    tooltip.attachTo(view);

    tooltip.addPermanent('a', 'One', [0, 0]);
    tooltip.addPermanent('b', 'Two', [1, 1]);
    tooltip.showSticky('Sticky', 10, 10);

    tooltip.destroy();

    // Permanent tooltips removed
    expect(view.parent.querySelectorAll('.mapgpu-tooltip--permanent').length).toBe(0);
    // Sticky element removed
    expect(view.parent.querySelector('.mapgpu-tooltip--sticky')).toBeNull();
    // off was called for view-change
    expect(view.off).toHaveBeenCalledWith('view-change', expect.any(Function));
  });

  it('should be safe to removePermanent with non-existent id', () => {
    expect(() => tooltip.removePermanent('non-existent')).not.toThrow();
  });

  it('should append sticky element to canvas parent on attachTo', () => {
    const view = createMockView();
    tooltip.attachTo(view);

    expect(view.parent.style.position).toBe('relative');
    expect(view.parent.querySelector('.mapgpu-tooltip--sticky')).not.toBeNull();
  });

  it('should subscribe to view-change event on attachTo', () => {
    const view = createMockView();
    tooltip.attachTo(view);

    expect(view.on).toHaveBeenCalledWith('view-change', expect.any(Function));
  });
});
