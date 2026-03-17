import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MapContext } from './MapContext.js';
import type { MapContextValue } from './MapContext.js';
import { useView } from './useView.js';

type ViewChangeHandler = (data: {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
  rotation: number;
  mode: '2d' | '3d';
}) => void;

function createMockView(overrides?: {
  center?: [number, number];
  zoom?: number;
  rotation?: number;
  pitch?: number;
  bearing?: number;
  mode?: '2d' | '3d';
}) {
  const handlers = new Map<string, Set<ViewChangeHandler>>();

  const view = {
    center: overrides?.center ?? [28.97, 41.0] as [number, number],
    zoom: overrides?.zoom ?? 12,
    rotation: overrides?.rotation ?? 0,
    pitch: overrides?.pitch ?? 0,
    bearing: overrides?.bearing ?? 0,
    mode: overrides?.mode ?? '2d' as '2d' | '3d',
    on: vi.fn((event: string, handler: ViewChangeHandler) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
    }),
    off: vi.fn((event: string, handler: ViewChangeHandler) => {
      handlers.get(event)?.delete(handler);
    }),
    _emit(event: string, data: Parameters<ViewChangeHandler>[0]) {
      handlers.get(event)?.forEach((h) => h(data));
    },
  };

  return view;
}

function createWrapper(view: ReturnType<typeof createMockView> | null) {
  const value: MapContextValue = {
    view: view as unknown as MapContextValue['view'],
    map: view ? ({ layers: [] } as unknown as MapContextValue['map']) : null,
  };

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MapContext.Provider value={value}>
        {children}
      </MapContext.Provider>
    );
  };
}

describe('useView', () => {
  it('returns default state when no view is available', () => {
    const wrapper = createWrapper(null);
    const { result } = renderHook(() => useView(), { wrapper });

    expect(result.current.center).toEqual([0, 0]);
    expect(result.current.zoom).toBe(0);
    expect(result.current.rotation).toBe(0);
    expect(result.current.pitch).toBe(0);
    expect(result.current.bearing).toBe(0);
    expect(result.current.mode).toBe('2d');
  });

  it('returns initial view state from the MapView', () => {
    const view = createMockView({ center: [10, 20], zoom: 5, rotation: 30 });
    const wrapper = createWrapper(view);
    const { result } = renderHook(() => useView(), { wrapper });

    expect(result.current.center).toEqual([10, 20]);
    expect(result.current.zoom).toBe(5);
    expect(result.current.rotation).toBe(30);
  });

  it('updates state when view-change event fires', () => {
    const view = createMockView();
    const wrapper = createWrapper(view);
    const { result } = renderHook(() => useView(), { wrapper });

    act(() => {
      view._emit('view-change', {
        center: [35.0, 39.0],
        zoom: 8,
        rotation: 15,
        pitch: 30,
        bearing: 45,
        mode: '3d',
      });
    });

    expect(result.current.center).toEqual([35.0, 39.0]);
    expect(result.current.zoom).toBe(8);
    expect(result.current.rotation).toBe(15);
    expect(result.current.pitch).toBe(30);
    expect(result.current.bearing).toBe(45);
    expect(result.current.mode).toBe('3d');
  });

  it('unsubscribes from view-change on unmount', () => {
    const view = createMockView();
    const wrapper = createWrapper(view);
    const { unmount } = renderHook(() => useView(), { wrapper });

    expect(view.on).toHaveBeenCalledWith('view-change', expect.any(Function));

    unmount();

    expect(view.off).toHaveBeenCalledWith('view-change', expect.any(Function));
  });

  it('handles multiple rapid view changes', () => {
    const view = createMockView();
    const wrapper = createWrapper(view);
    const { result } = renderHook(() => useView(), { wrapper });

    act(() => {
      view._emit('view-change', {
        center: [1, 1],
        zoom: 1,
        rotation: 1,
        pitch: 0,
        bearing: 0,
        mode: '2d',
      });
      view._emit('view-change', {
        center: [2, 2],
        zoom: 2,
        rotation: 2,
        pitch: 0,
        bearing: 0,
        mode: '2d',
      });
      view._emit('view-change', {
        center: [3, 3],
        zoom: 3,
        rotation: 3,
        pitch: 0,
        bearing: 0,
        mode: '2d',
      });
    });

    // Should have the last value
    expect(result.current.center).toEqual([3, 3]);
    expect(result.current.zoom).toBe(3);
  });
});
