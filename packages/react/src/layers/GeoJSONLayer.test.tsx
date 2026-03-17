import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MapContext } from '../MapContext.js';
import type { MapContextValue } from '../MapContext.js';
import { GeoJSONLayer } from './GeoJSONLayer.js';

const mockInstances: Array<{
  id: string;
  url?: string;
  data?: unknown;
  visible: boolean;
  opacity: number;
  destroy: ReturnType<typeof vi.fn>;
}> = [];

vi.mock('@mapgpu/layers', () => {
  return {
    GeoJSONLayer: class MockGeoJSONLayer {
      id: string;
      url?: string;
      data?: unknown;
      visible = true;
      opacity = 1;
      destroy = vi.fn();

      constructor(options: { id?: string; url?: string; data?: unknown }) {
        this.id = options.id ?? `geojson-${mockInstances.length}`;
        this.url = options.url;
        this.data = options.data;
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

const sampleGeoJSON = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      geometry: { type: 'Point', coordinates: [28.97, 41.0] },
      properties: { name: 'Istanbul' },
    },
  ],
};

describe('GeoJSONLayer', () => {
  it('adds a GeoJSON layer with data prop to the map', () => {
    const map = createMockMap();
    const wrapper = createWrapper(map);

    render(<GeoJSONLayer data={sampleGeoJSON} />, { wrapper });

    expect(map.add).toHaveBeenCalledTimes(1);
    expect(mockInstances).toHaveLength(1);
    expect(mockInstances[0]!.data).toBe(sampleGeoJSON);
  });

  it('adds a GeoJSON layer with url prop to the map', () => {
    const map = createMockMap();
    const wrapper = createWrapper(map);

    render(<GeoJSONLayer url="https://example.com/data.geojson" />, { wrapper });

    expect(mockInstances[0]!.url).toBe('https://example.com/data.geojson');
  });

  it('removes the layer on unmount', () => {
    const map = createMockMap();
    const wrapper = createWrapper(map);

    const { unmount } = render(<GeoJSONLayer data={sampleGeoJSON} />, { wrapper });
    unmount();

    expect(map.remove).toHaveBeenCalledTimes(1);
    expect(mockInstances[0]!.destroy).toHaveBeenCalledTimes(1);
  });

  it('applies opacity prop', () => {
    const map = createMockMap();
    const wrapper = createWrapper(map);

    render(<GeoJSONLayer data={sampleGeoJSON} opacity={0.7} />, { wrapper });

    expect(mockInstances[0]!.opacity).toBe(0.7);
  });

  it('updates visibility when prop changes', () => {
    const map = createMockMap();
    const wrapper = createWrapper(map);

    const { rerender } = render(
      <GeoJSONLayer data={sampleGeoJSON} visible={true} />,
      { wrapper },
    );

    expect(mockInstances[0]!.visible).toBe(true);

    rerender(<GeoJSONLayer data={sampleGeoJSON} visible={false} />);

    expect(mockInstances[0]!.visible).toBe(false);
  });
});
