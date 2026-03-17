import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MapContext } from '../MapContext.js';
import type { MapContextValue } from '../MapContext.js';
import { LayerList } from './LayerList.js';

const mockInstances: Array<{
  position: string;
  mount: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  addLayer: ReturnType<typeof vi.fn>;
  removeLayer: ReturnType<typeof vi.fn>;
}> = [];

vi.mock('@mapgpu/widgets', () => {
  return {
    LayerListWidget: class MockLayerListWidget {
      position: string;
      mount = vi.fn();
      destroy = vi.fn();
      addLayer = vi.fn();
      removeLayer = vi.fn();

      constructor(options?: { position?: string }) {
        this.position = options?.position ?? 'top-right';
        mockInstances.push(this);
      }
    },
  };
});

function createMockView() {
  const handlers = new Map<string, Set<(...args: unknown[]) => void>>();

  return {
    _container: document.createElement('div'),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.get(event)?.delete(handler);
    }),
    map: {
      layers: [
        { id: 'layer-1', type: 'wms', visible: true, opacity: 1 },
        { id: 'layer-2', type: 'geojson', visible: true, opacity: 1 },
      ],
      add: vi.fn(),
      remove: vi.fn(),
      destroy: vi.fn(),
    },
    _handlers: handlers,
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

describe('LayerList', () => {
  it('mounts the LayerListWidget and syncs existing layers', () => {
    const view = createMockView();
    const wrapper = createWrapper(view);

    render(<LayerList />, { wrapper });

    expect(mockInstances).toHaveLength(1);
    expect(mockInstances[0]!.mount).toHaveBeenCalledTimes(1);
    // Should add existing layers
    expect(mockInstances[0]!.addLayer).toHaveBeenCalledTimes(2);
  });

  it('destroys the widget on unmount', () => {
    const view = createMockView();
    const wrapper = createWrapper(view);

    const { unmount } = render(<LayerList />, { wrapper });
    unmount();

    expect(mockInstances[0]!.destroy).toHaveBeenCalledTimes(1);
  });

  it('passes position prop', () => {
    const view = createMockView();
    const wrapper = createWrapper(view);

    render(<LayerList position="bottom-left" />, { wrapper });

    expect(mockInstances[0]!.position).toBe('bottom-left');
  });

  it('subscribes to layer-add and layer-remove events', () => {
    const view = createMockView();
    const wrapper = createWrapper(view);

    render(<LayerList />, { wrapper });

    expect(view.on).toHaveBeenCalledWith('layer-add', expect.any(Function));
    expect(view.on).toHaveBeenCalledWith('layer-remove', expect.any(Function));
  });

  it('unsubscribes from events on unmount', () => {
    const view = createMockView();
    const wrapper = createWrapper(view);

    const { unmount } = render(<LayerList />, { wrapper });
    unmount();

    expect(view.off).toHaveBeenCalledWith('layer-add', expect.any(Function));
    expect(view.off).toHaveBeenCalledWith('layer-remove', expect.any(Function));
  });
});
