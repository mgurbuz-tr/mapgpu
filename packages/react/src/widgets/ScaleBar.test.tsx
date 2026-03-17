import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MapContext } from '../MapContext.js';
import type { MapContextValue } from '../MapContext.js';
import { ScaleBar } from './ScaleBar.js';

const mockInstances: Array<{
  position: string;
  unit: string;
  mount: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}> = [];

vi.mock('@mapgpu/widgets', () => {
  return {
    ScaleBarWidget: class MockScaleBarWidget {
      position: string;
      unit: string;
      mount = vi.fn();
      destroy = vi.fn();

      constructor(options?: { position?: string; unit?: string; maxWidthPx?: number }) {
        this.position = options?.position ?? 'bottom-left';
        this.unit = options?.unit ?? 'metric';
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

describe('ScaleBar', () => {
  it('mounts the ScaleBarWidget when view is available', () => {
    const view = createMockView();
    const wrapper = createWrapper(view);

    render(<ScaleBar />, { wrapper });

    expect(mockInstances).toHaveLength(1);
    expect(mockInstances[0]!.mount).toHaveBeenCalledTimes(1);
  });

  it('destroys the widget on unmount', () => {
    const view = createMockView();
    const wrapper = createWrapper(view);

    const { unmount } = render(<ScaleBar />, { wrapper });
    unmount();

    expect(mockInstances[0]!.destroy).toHaveBeenCalledTimes(1);
  });

  it('passes position prop to the widget', () => {
    const view = createMockView();
    const wrapper = createWrapper(view);

    render(<ScaleBar position="top-left" />, { wrapper });

    expect(mockInstances[0]!.position).toBe('top-left');
  });

  it('updates unit when prop changes', () => {
    const view = createMockView();
    const wrapper = createWrapper(view);

    const { rerender } = render(<ScaleBar unit="metric" />, { wrapper });

    expect(mockInstances[0]!.unit).toBe('metric');

    rerender(<ScaleBar unit="imperial" />);

    expect(mockInstances[0]!.unit).toBe('imperial');
  });

  it('does not mount when view is null', () => {
    const value: MapContextValue = { view: null, map: null };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MapContext.Provider value={value}>{children}</MapContext.Provider>
    );

    render(<ScaleBar />, { wrapper });

    expect(mockInstances).toHaveLength(0);
  });
});
