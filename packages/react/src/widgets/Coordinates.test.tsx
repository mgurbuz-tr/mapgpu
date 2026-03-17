import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MapContext } from '../MapContext.js';
import type { MapContextValue } from '../MapContext.js';
import { Coordinates } from './Coordinates.js';

const mockInstances: Array<{
  position: string;
  format: string;
  mount: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  listenTo: ReturnType<typeof vi.fn>;
  screenToMap: ((x: number, y: number) => [number, number]) | null;
}> = [];

vi.mock('@mapgpu/widgets', () => {
  return {
    CoordinatesWidget: class MockCoordinatesWidget {
      position: string;
      format: string;
      mount = vi.fn();
      destroy = vi.fn();
      listenTo = vi.fn();
      screenToMap: ((x: number, y: number) => [number, number]) | null = null;

      constructor(options?: { position?: string; format?: string }) {
        this.position = options?.position ?? 'bottom-right';
        this.format = options?.format ?? 'DD';
        mockInstances.push(this);
      }
    },
  };
});

function createMockView() {
  return {
    _container: document.createElement('div'),
    on: vi.fn(),
    off: vi.fn(),
    toMap: vi.fn((x: number, y: number) => [x, y] as [number, number]),
    map: { layers: [], add: vi.fn(), remove: vi.fn(), destroy: vi.fn() },
  };
}

function createWrapper(view: ReturnType<typeof createMockView>) {
  const value: MapContextValue = {
    view: view as unknown as MapContextValue['view'],
    map: view.map as unknown as MapContextValue['map'],
  };

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MapContext.Provider value={value}>
        {children}
      </MapContext.Provider>
    );
  };
}

afterEach(() => {
  cleanup();
  mockInstances.length = 0;
  vi.clearAllMocks();
});

describe('Coordinates', () => {
  it('mounts the CoordinatesWidget and sets up screenToMap', () => {
    const view = createMockView();
    const wrapper = createWrapper(view);

    render(<Coordinates />, { wrapper });

    expect(mockInstances).toHaveLength(1);
    expect(mockInstances[0]!.mount).toHaveBeenCalledTimes(1);
    expect(mockInstances[0]!.screenToMap).toBeTypeOf('function');
    expect(mockInstances[0]!.listenTo).toHaveBeenCalledTimes(1);
  });

  it('destroys the widget on unmount', () => {
    const view = createMockView();
    const wrapper = createWrapper(view);

    const { unmount } = render(<Coordinates />, { wrapper });
    unmount();

    expect(mockInstances[0]!.destroy).toHaveBeenCalledTimes(1);
  });

  it('passes position and format props', () => {
    const view = createMockView();
    const wrapper = createWrapper(view);

    render(<Coordinates position="top-left" format="DMS" />, { wrapper });

    expect(mockInstances[0]!.position).toBe('top-left');
    expect(mockInstances[0]!.format).toBe('DMS');
  });

  it('updates format when prop changes', () => {
    const view = createMockView();
    const wrapper = createWrapper(view);

    const { rerender } = render(<Coordinates format="DD" />, { wrapper });

    expect(mockInstances[0]!.format).toBe('DD');

    rerender(<Coordinates format="DMS" />);

    expect(mockInstances[0]!.format).toBe('DMS');
  });

  it('does not mount when view is null', () => {
    const value: MapContextValue = { view: null, map: null };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MapContext.Provider value={value}>{children}</MapContext.Provider>
    );

    render(<Coordinates />, { wrapper });

    expect(mockInstances).toHaveLength(0);
  });
});
