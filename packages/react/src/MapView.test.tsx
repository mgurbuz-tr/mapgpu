import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { MapView } from './MapView.js';
import { MapView as CoreMapView } from '@mapgpu/core';

// Mock MapView (CoreMapView) to avoid real DOM measurement and render loop
vi.mock('@mapgpu/core', async () => {
  const actual = await vi.importActual<typeof import('@mapgpu/core')>('@mapgpu/core');

  class MockMapView {
    map = { layers: [] as unknown[], add: vi.fn(), remove: vi.fn(), destroy: vi.fn() };
    private _readyResolve: (() => void) | null = null;
    private _readyPromise: Promise<void>;
    private _handlers = new Map<string, Set<(...args: unknown[]) => void>>();
    private _center: [number, number] = [0, 0];
    private _zoom = 0;
    private _rotation = 0;
    private _mode: '2d' | '3d' = '2d';
    private _pitch = 0;
    private _bearing = 0;
    private _destroyed = false;

    constructor(options: { center?: [number, number]; zoom?: number; rotation?: number; mode?: '2d' | '3d' }) {
      this._center = options.center ?? [0, 0];
      this._zoom = options.zoom ?? 0;
      this._rotation = options.rotation ?? 0;
      this._mode = options.mode ?? '2d';
      this._readyPromise = new Promise<void>((resolve) => {
        this._readyResolve = resolve;
      });
      // Resolve immediately in next microtask
      queueMicrotask(() => {
        if (!this._destroyed) {
          this._readyResolve?.();
        }
      });
    }

    get center(): [number, number] { return this._center; }
    get zoom(): number { return this._zoom; }
    get rotation(): number { return this._rotation; }
    get mode(): '2d' | '3d' { return this._mode; }
    get pitch(): number { return this._pitch; }
    get bearing(): number { return this._bearing; }
    when() { return this._readyPromise; }

    goTo(target: { center?: [number, number]; zoom?: number; rotation?: number; pitch?: number; bearing?: number }) {
      if (target.center) this._center = target.center;
      if (target.zoom !== undefined) this._zoom = target.zoom;
      if (target.rotation !== undefined) this._rotation = target.rotation;
      if (target.pitch !== undefined) this._pitch = target.pitch;
      if (target.bearing !== undefined) this._bearing = target.bearing;
      return Promise.resolve();
    }

    on(event: string, handler: (...args: unknown[]) => void) {
      if (!this._handlers.has(event)) this._handlers.set(event, new Set());
      this._handlers.get(event)!.add(handler);
    }

    off(event: string, handler: (...args: unknown[]) => void) {
      this._handlers.get(event)?.delete(handler);
    }

    destroy() {
      this._destroyed = true;
      this._readyResolve?.();
    }
  }

  return {
    ...actual,
    MapView: MockMapView,
  };
});

afterEach(() => {
  cleanup();
});

describe('MapView', () => {
  it('renders a container div', () => {
    const { container } = render(<MapView />);
    const div = container.firstChild as HTMLElement;
    expect(div).toBeInstanceOf(HTMLDivElement);
    expect(div.style.position).toBe('relative');
  });

  it('applies className and style props', () => {
    const { container } = render(
      <MapView className="my-map" style={{ border: '1px solid red' }} />,
    );
    const div = container.firstChild as HTMLElement;
    expect(div.className).toBe('my-map');
    expect(div.style.border).toBe('1px solid red');
  });

  it('calls onViewReady when the view becomes ready', async () => {
    const onViewReady = vi.fn();

    render(<MapView center={[28.97, 41.0]} zoom={12} onViewReady={onViewReady} />);

    // Let the microtask / promise resolve
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(onViewReady).toHaveBeenCalledTimes(1);
    expect(onViewReady).toHaveBeenCalledWith(expect.objectContaining({ map: expect.any(Object) }));
  });

  it('destroys the MapView on unmount', async () => {
    const onViewReady = vi.fn();
    const { unmount } = render(
      <MapView center={[0, 0]} zoom={5} onViewReady={onViewReady} />,
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const viewInstance = onViewReady.mock.calls[0]?.[0];
    const destroySpy = vi.spyOn(viewInstance, 'destroy');

    unmount();
    expect(destroySpy).toHaveBeenCalled();
  });

  it('renders children inside the provider', () => {
    const { getByTestId } = render(
      <MapView>
        <div data-testid="child">Hello</div>
      </MapView>,
    );
    expect(getByTestId('child').textContent).toBe('Hello');
  });

  it('passes center/zoom/rotation to MapView constructor', async () => {
    const onViewReady = vi.fn();
    render(
      <MapView center={[10, 20]} zoom={8} rotation={45} onViewReady={onViewReady} />,
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const viewInstance = onViewReady.mock.calls[0]?.[0];
    expect(viewInstance).toBeDefined();
    // The mock stores these values
    expect(viewInstance.center).toEqual([10, 20]);
    expect(viewInstance.zoom).toBe(8);
    expect(viewInstance.rotation).toBe(45);
  });
});
