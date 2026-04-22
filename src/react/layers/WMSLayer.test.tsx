import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MapContext } from '../MapContext.js';
import type { MapContextValue } from '../MapContext.js';
import { WMSLayer } from './WMSLayer.js';

// Mock @mapgpu/layers WMSLayer
const mockDestroy = vi.fn();
const mockInstances: Array<{
  id?: string;
  url: string;
  layerNames: string[];
  visible: boolean;
  opacity: number;
  destroy: ReturnType<typeof vi.fn>;
}> = [];

vi.mock('../../layers/index.js', () => {
  return {
    WMSLayer: class MockWMSLayer {
      id: string;
      url: string;
      layerNames: string[];
      visible = true;
      opacity = 1;
      destroy = vi.fn();

      constructor(options: { id?: string; url: string; layers: string[] }) {
        this.id = options.id ?? `wms-${mockInstances.length}`;
        this.url = options.url;
        this.layerNames = options.layers;
        mockInstances.push(this);
      }
    },
  };
});

function createMockMap() {
  return {
    layers: [] as unknown[],
    add: vi.fn(),
    remove: vi.fn(),
    destroy: vi.fn(),
  };
}

function createWrapper(map: ReturnType<typeof createMockMap>) {
  const value: MapContextValue = {
    view: { map } as unknown as MapContextValue['view'],
    map: map as unknown as MapContextValue['map'],
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

describe('WMSLayer', () => {
  it('adds a WMS layer to the map on mount', () => {
    const map = createMockMap();
    const wrapper = createWrapper(map);

    render(
      <WMSLayer url="https://example.com/wms" layers={['roads']} />,
      { wrapper },
    );

    expect(map.add).toHaveBeenCalledTimes(1);
    expect(mockInstances).toHaveLength(1);
    expect(mockInstances[0]!.url).toBe('https://example.com/wms');
  });

  it('removes the layer from the map on unmount', () => {
    const map = createMockMap();
    const wrapper = createWrapper(map);

    const { unmount } = render(
      <WMSLayer url="https://example.com/wms" layers={['roads']} />,
      { wrapper },
    );

    unmount();

    expect(map.remove).toHaveBeenCalledTimes(1);
    expect(mockInstances[0]!.destroy).toHaveBeenCalledTimes(1);
  });

  it('applies visibility and opacity props', () => {
    const map = createMockMap();
    const wrapper = createWrapper(map);

    render(
      <WMSLayer url="https://example.com/wms" layers={['roads']} visible={false} opacity={0.5} />,
      { wrapper },
    );

    expect(mockInstances[0]!.visible).toBe(false);
    expect(mockInstances[0]!.opacity).toBe(0.5);
  });

  it('updates visibility when prop changes', () => {
    const map = createMockMap();
    const wrapper = createWrapper(map);

    const { rerender } = render(
      <WMSLayer url="https://example.com/wms" layers={['roads']} visible={true} />,
      { wrapper },
    );

    expect(mockInstances[0]!.visible).toBe(true);

    rerender(
      <WMSLayer url="https://example.com/wms" layers={['roads']} visible={false} />,
    );

    expect(mockInstances[0]!.visible).toBe(false);
  });

  it('passes custom id to the layer', () => {
    const map = createMockMap();
    const wrapper = createWrapper(map);

    render(
      <WMSLayer id="my-wms" url="https://example.com/wms" layers={['roads']} />,
      { wrapper },
    );

    expect(mockInstances[0]!.id).toBe('my-wms');
  });
});
