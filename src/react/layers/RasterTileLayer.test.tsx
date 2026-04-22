import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MapContext } from '../MapContext.js';
import type { MapContextValue } from '../MapContext.js';
import { RasterTileLayer } from './RasterTileLayer.js';

const mockInstances: Array<{
  id: string;
  urlTemplate: string;
  tms?: boolean;
  subdomains?: string[];
  visible: boolean;
  opacity: number;
  destroy: ReturnType<typeof vi.fn>;
}> = [];

vi.mock('../../layers/index.js', () => {
  return {
    RasterTileLayer: class MockRasterTileLayer {
      id: string;
      urlTemplate: string;
      tms?: boolean;
      subdomains?: string[];
      visible = true;
      opacity = 1;
      destroy = vi.fn();

      constructor(options: {
        id?: string;
        urlTemplate: string;
        tms?: boolean;
        subdomains?: string[];
      }) {
        this.id = options.id ?? `raster-${mockInstances.length}`;
        this.urlTemplate = options.urlTemplate;
        this.tms = options.tms;
        this.subdomains = options.subdomains;
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

describe('RasterTileLayer', () => {
  it('adds a raster tile layer to the map on mount', () => {
    const map = createMockMap();
    const wrapper = createWrapper(map);

    render(
      <RasterTileLayer urlTemplate="https://tile.osm.org/{z}/{x}/{y}.png" />,
      { wrapper },
    );

    expect(map.add).toHaveBeenCalledTimes(1);
    expect(mockInstances).toHaveLength(1);
    expect(mockInstances[0]!.urlTemplate).toBe('https://tile.osm.org/{z}/{x}/{y}.png');
  });

  it('removes the layer on unmount', () => {
    const map = createMockMap();
    const wrapper = createWrapper(map);

    const { unmount } = render(
      <RasterTileLayer urlTemplate="https://tile.osm.org/{z}/{x}/{y}.png" />,
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
      <RasterTileLayer
        urlTemplate="https://tile.osm.org/{z}/{x}/{y}.png"
        visible={false}
        opacity={0.3}
      />,
      { wrapper },
    );

    expect(mockInstances[0]!.visible).toBe(false);
    expect(mockInstances[0]!.opacity).toBe(0.3);
  });

  it('updates opacity when prop changes', () => {
    const map = createMockMap();
    const wrapper = createWrapper(map);

    const { rerender } = render(
      <RasterTileLayer
        urlTemplate="https://tile.osm.org/{z}/{x}/{y}.png"
        opacity={1}
      />,
      { wrapper },
    );

    expect(mockInstances[0]!.opacity).toBe(1);

    rerender(
      <RasterTileLayer
        urlTemplate="https://tile.osm.org/{z}/{x}/{y}.png"
        opacity={0.5}
      />,
    );

    expect(mockInstances[0]!.opacity).toBe(0.5);
  });

  it('passes tms and subdomains options', () => {
    const map = createMockMap();
    const wrapper = createWrapper(map);

    render(
      <RasterTileLayer
        urlTemplate="https://{s}.tile.osm.org/{z}/{x}/{y}.png"
        tms={true}
        subdomains={['a', 'b', 'c']}
      />,
      { wrapper },
    );

    expect(mockInstances[0]!.tms).toBe(true);
    expect(mockInstances[0]!.subdomains).toEqual(['a', 'b', 'c']);
  });
});
