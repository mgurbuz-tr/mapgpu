import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GlobeInteraction } from './GlobeInteraction.js';
import { VerticalPerspectiveTransform } from './projections/VerticalPerspectiveTransform.js';

// ─── Mock Element ───

function createMockElement(): HTMLElement {
  const listeners = new Map<string, Set<EventListener>>();

  const el = {
    addEventListener: vi.fn((type: string, handler: EventListener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(handler);
    }),
    removeEventListener: vi.fn((type: string, handler: EventListener) => {
      listeners.get(type)?.delete(handler);
    }),
    setAttribute: vi.fn(),
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0, toJSON: () => ({}) }),
    _fire: (type: string, eventInit: Record<string, unknown> = {}) => {
      const event = { type, preventDefault: vi.fn(), ...eventInit } as unknown as Event;
      listeners.get(type)?.forEach(h => h(event));
    },
  };

  return el as unknown as HTMLElement;
}

describe('GlobeInteraction', () => {
  let element: ReturnType<typeof createMockElement>;
  let transform: VerticalPerspectiveTransform;
  let onDirty: ReturnType<typeof vi.fn>;
  let onViewChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    element = createMockElement();
    transform = new VerticalPerspectiveTransform({
      center: [0, 0],
      zoom: 3,
      pitch: 0,
      bearing: 0,
      viewportWidth: 800,
      viewportHeight: 600,
    });
    onDirty = vi.fn();
    onViewChange = vi.fn();
  });

  // ─── Construction ───

  it('registers event listeners on element', () => {
    const interaction = new GlobeInteraction(
      element as unknown as HTMLElement,
      transform,
      onDirty,
      onViewChange,
    );
    expect(element.addEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    expect(element.addEventListener).toHaveBeenCalledWith('pointermove', expect.any(Function));
    expect(element.addEventListener).toHaveBeenCalledWith('pointerup', expect.any(Function));
    expect(element.addEventListener).toHaveBeenCalledWith('wheel', expect.any(Function), { passive: false });
    interaction.destroy();
  });

  it('sets tabindex for keyboard support', () => {
    const interaction = new GlobeInteraction(
      element as unknown as HTMLElement,
      transform,
      onDirty,
      onViewChange,
    );
    expect(element.setAttribute).toHaveBeenCalledWith('tabindex', '0');
    interaction.destroy();
  });

  // ─── Pan ───

  it('pans globe on left-click drag', () => {
    const interaction = new GlobeInteraction(
      element as unknown as HTMLElement,
      transform,
      onDirty,
      onViewChange,
    );

    const initialCenter = transform.center;

    // Simulate pointer down → move → up
    element._fire('pointerdown', { pointerId: 1, button: 0, clientX: 400, clientY: 300 });
    element._fire('pointermove', { pointerId: 1, button: 0, clientX: 420, clientY: 310 });

    expect(onDirty).toHaveBeenCalled();
    expect(onViewChange).toHaveBeenCalled();

    // Center should have changed
    const newCenter = transform.center;
    expect(
      Math.abs(newCenter[0] - initialCenter[0]) > 0.001 ||
      Math.abs(newCenter[1] - initialCenter[1]) > 0.001,
    ).toBe(true);

    element._fire('pointerup', { pointerId: 1 });
    interaction.destroy();
  });

  // ─── Pitch/Bearing ───

  it('changes pitch/bearing on right-click drag', () => {
    const interaction = new GlobeInteraction(
      element as unknown as HTMLElement,
      transform,
      onDirty,
      onViewChange,
    );

    element._fire('pointerdown', { pointerId: 1, button: 2, clientX: 400, clientY: 300 });
    element._fire('pointermove', { pointerId: 1, button: 2, clientX: 450, clientY: 250 });

    expect(transform.pitch).toBeGreaterThan(0);
    expect(transform.bearing).toBeGreaterThan(0);
    expect(onDirty).toHaveBeenCalled();

    element._fire('pointerup', { pointerId: 1 });
    interaction.destroy();
  });

  // ─── Wheel zoom ───

  it('zooms on wheel event', () => {
    const interaction = new GlobeInteraction(
      element as unknown as HTMLElement,
      transform,
      onDirty,
      onViewChange,
    );

    const initialZoom = transform.zoom;
    element._fire('wheel', { deltaY: -100 });

    expect(transform.zoom).toBeGreaterThan(initialZoom);
    expect(onDirty).toHaveBeenCalled();
    expect(onViewChange).toHaveBeenCalled();

    interaction.destroy();
  });

  it('zoom out on positive deltaY', () => {
    const interaction = new GlobeInteraction(
      element as unknown as HTMLElement,
      transform,
      onDirty,
      onViewChange,
    );

    const initialZoom = transform.zoom;
    element._fire('wheel', { deltaY: 100 });

    expect(transform.zoom).toBeLessThan(initialZoom);
    interaction.destroy();
  });

  it('wheel zoom shifts center toward pointer (pointer-fixed zoom)', () => {
    const interaction = new GlobeInteraction(
      element as unknown as HTMLElement,
      transform,
      onDirty,
      onViewChange,
      { getGlobeness: () => 0 }, // flat mode — full compensation
    );

    // Pointer is at RIGHT side of viewport (x=600, center=400)
    element._fire('wheel', { deltaY: -100, clientX: 600, clientY: 300 });

    // Center should shift RIGHT (positive longitude)
    expect(transform.center[0]).toBeGreaterThan(0);
    interaction.destroy();
  });

  it('wheel zoom at viewport center does not shift center', () => {
    const interaction = new GlobeInteraction(
      element as unknown as HTMLElement,
      transform,
      onDirty,
      onViewChange,
    );

    // Pointer at exact center (viewport 800×600 → center = 400,300)
    element._fire('wheel', { deltaY: -100, clientX: 400, clientY: 300 });

    // Center should stay at [0, 0]
    expect(Math.abs(transform.center[0])).toBeLessThan(0.001);
    expect(Math.abs(transform.center[1])).toBeLessThan(0.001);
    interaction.destroy();
  });

  // ─── Keyboard ───

  it('zooms in with +/= key', () => {
    const interaction = new GlobeInteraction(
      element as unknown as HTMLElement,
      transform,
      onDirty,
      onViewChange,
    );

    const initialZoom = transform.zoom;
    element._fire('keydown', { key: '+' });

    expect(transform.zoom).toBeGreaterThan(initialZoom);
    interaction.destroy();
  });

  it('zooms out with - key', () => {
    const interaction = new GlobeInteraction(
      element as unknown as HTMLElement,
      transform,
      onDirty,
      onViewChange,
    );

    const initialZoom = transform.zoom;
    element._fire('keydown', { key: '-' });

    expect(transform.zoom).toBeLessThan(initialZoom);
    interaction.destroy();
  });

  it('pans with arrow keys', () => {
    const interaction = new GlobeInteraction(
      element as unknown as HTMLElement,
      transform,
      onDirty,
      onViewChange,
    );

    const initial = transform.center;
    element._fire('keydown', { key: 'ArrowRight' });

    const after = transform.center;
    expect(after[0]).toBeGreaterThan(initial[0]);
    interaction.destroy();
  });

  // ─── Options ───

  it('disables pan when pan=false', () => {
    const interaction = new GlobeInteraction(
      element as unknown as HTMLElement,
      transform,
      onDirty,
      onViewChange,
      { pan: false },
    );

    const initialCenter = transform.center;
    element._fire('pointerdown', { pointerId: 1, button: 0, clientX: 400, clientY: 300 });
    element._fire('pointermove', { pointerId: 1, button: 0, clientX: 420, clientY: 310 });

    expect(transform.center).toEqual(initialCenter);
    interaction.destroy();
  });

  it('disables zoom when zoom=false', () => {
    const interaction = new GlobeInteraction(
      element as unknown as HTMLElement,
      transform,
      onDirty,
      onViewChange,
      { zoom: false },
    );

    const initialZoom = transform.zoom;
    element._fire('wheel', { deltaY: -100 });

    expect(transform.zoom).toBe(initialZoom);
    interaction.destroy();
  });

  // ─── Globe Zoom Overshoot ───

  it('rapid zoom-out at low zoom does not overshoot center', () => {
    // Start at zoom 2 (full globe) with center at Istanbul
    transform.setZoom(2);
    transform.setCenter(29, 41);

    const interaction = new GlobeInteraction(
      element as unknown as HTMLElement,
      transform,
      onDirty,
      onViewChange,
      { getGlobeness: () => 1 }, // full globe
    );

    const initialCenter = transform.center;

    // Simulate 10 rapid zoom-out wheel events with pointer off-center
    for (let i = 0; i < 10; i++) {
      element._fire('wheel', { deltaY: 300, clientX: 700, clientY: 100 });
    }

    // Center should NOT jump more than a few degrees
    const lonDelta = Math.abs(transform.center[0] - initialCenter[0]);
    const latDelta = Math.abs(transform.center[1] - initialCenter[1]);
    expect(lonDelta).toBeLessThan(5);
    expect(latDelta).toBeLessThan(5);

    interaction.destroy();
  });

  it('zoom-0 boundary produces no-op compensation (actualDelta === 0)', () => {
    transform.setZoom(0); // at minimum zoom
    transform.setCenter(0, 0);

    const interaction = new GlobeInteraction(
      element as unknown as HTMLElement,
      transform,
      onDirty,
      onViewChange,
      { getGlobeness: () => 1 },
    );

    // Try to zoom out further (should clamp to 0)
    element._fire('wheel', { deltaY: 500, clientX: 700, clientY: 100 });

    // Center should not change (actualDelta === 0)
    expect(transform.center[0]).toBe(0);
    expect(transform.center[1]).toBe(0);

    interaction.destroy();
  });

  it('high-zoom wheel still applies pointer-fixed compensation', () => {
    transform.setZoom(10);
    transform.setCenter(29, 41);

    const interaction = new GlobeInteraction(
      element as unknown as HTMLElement,
      transform,
      onDirty,
      onViewChange,
      { getGlobeness: () => 0 }, // flat Mercator
    );

    // Zoom in with pointer to the right
    element._fire('wheel', { deltaY: -100, clientX: 600, clientY: 300 });

    // Center should shift toward pointer (positive longitude)
    expect(transform.center[0]).toBeGreaterThan(29);

    interaction.destroy();
  });

  // ─── Destroy ───

  it('removes event listeners on destroy', () => {
    const interaction = new GlobeInteraction(
      element as unknown as HTMLElement,
      transform,
      onDirty,
      onViewChange,
    );

    interaction.destroy();
    expect(element.removeEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    expect(element.removeEventListener).toHaveBeenCalledWith('wheel', expect.any(Function));
    expect(element.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('ignores events after destroy', () => {
    const interaction = new GlobeInteraction(
      element as unknown as HTMLElement,
      transform,
      onDirty,
      onViewChange,
    );

    interaction.destroy();
    onDirty.mockClear();

    element._fire('wheel', { deltaY: -100 });
    expect(onDirty).not.toHaveBeenCalled();
  });
});
