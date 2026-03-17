import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MapContext } from '../MapContext.js';
import type { MapContextValue } from '../MapContext.js';
import { BasemapGallery } from './BasemapGallery.js';

type SelectHandler = (basemap: { id: string; title: string }) => void;

const mockInstances: Array<{
  position: string;
  basemaps: Array<{ id: string; title: string }>;
  activeBasemapId: string | null;
  mount: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  setBasemaps: ReturnType<typeof vi.fn>;
  onSelect: ReturnType<typeof vi.fn>;
  offSelect: ReturnType<typeof vi.fn>;
  _selectHandlers: Set<SelectHandler>;
}> = [];

vi.mock('@mapgpu/widgets', () => {
  return {
    BasemapGalleryWidget: class MockBasemapGalleryWidget {
      position: string;
      basemaps: Array<{ id: string; title: string }>;
      activeBasemapId: string | null;
      mount = vi.fn();
      destroy = vi.fn();
      setBasemaps = vi.fn();
      _selectHandlers = new Set<SelectHandler>();
      onSelect = vi.fn((handler: SelectHandler) => {
        this._selectHandlers.add(handler);
      });
      offSelect = vi.fn((handler: SelectHandler) => {
        this._selectHandlers.delete(handler);
      });

      constructor(options?: {
        position?: string;
        basemaps?: Array<{ id: string; title: string }>;
        activeBasemapId?: string;
      }) {
        this.position = options?.position ?? 'bottom-right';
        this.basemaps = options?.basemaps ?? [];
        this.activeBasemapId = options?.activeBasemapId ?? null;
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

const sampleBasemaps = [
  { id: 'osm', title: 'OpenStreetMap' },
  { id: 'satellite', title: 'Satellite' },
];

describe('BasemapGallery', () => {
  it('mounts the BasemapGalleryWidget', () => {
    const view = createMockView();
    const wrapper = createWrapper(view);

    render(<BasemapGallery basemaps={sampleBasemaps} />, { wrapper });

    expect(mockInstances).toHaveLength(1);
    expect(mockInstances[0]!.mount).toHaveBeenCalledTimes(1);
  });

  it('destroys the widget and unregisters handler on unmount', () => {
    const view = createMockView();
    const wrapper = createWrapper(view);

    const { unmount } = render(<BasemapGallery basemaps={sampleBasemaps} />, { wrapper });
    unmount();

    expect(mockInstances[0]!.offSelect).toHaveBeenCalledTimes(1);
    expect(mockInstances[0]!.destroy).toHaveBeenCalledTimes(1);
  });

  it('passes basemaps and activeBasemapId props', () => {
    const view = createMockView();
    const wrapper = createWrapper(view);

    render(
      <BasemapGallery basemaps={sampleBasemaps} activeBasemapId="satellite" />,
      { wrapper },
    );

    expect(mockInstances[0]!.basemaps).toEqual(sampleBasemaps);
    expect(mockInstances[0]!.activeBasemapId).toBe('satellite');
  });

  it('calls onSelect callback when a basemap is selected', () => {
    const view = createMockView();
    const wrapper = createWrapper(view);
    const onSelect = vi.fn();

    render(
      <BasemapGallery basemaps={sampleBasemaps} onSelect={onSelect} />,
      { wrapper },
    );

    // Simulate widget calling the select handler
    const instance = mockInstances[0]!;
    for (const handler of instance._selectHandlers) {
      handler({ id: 'satellite', title: 'Satellite' });
    }

    expect(onSelect).toHaveBeenCalledWith({ id: 'satellite', title: 'Satellite' });
  });

  it('updates basemaps when prop changes', () => {
    const view = createMockView();
    const wrapper = createWrapper(view);

    const newBasemaps = [{ id: 'topo', title: 'Topographic' }];

    const { rerender } = render(
      <BasemapGallery basemaps={sampleBasemaps} />,
      { wrapper },
    );

    rerender(<BasemapGallery basemaps={newBasemaps} />);

    expect(mockInstances[0]!.setBasemaps).toHaveBeenCalledWith(newBasemaps);
  });
});
