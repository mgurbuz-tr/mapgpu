import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SearchWidget } from './SearchWidget.js';
import type { SearchSource, SearchResult } from './SearchWidget.js';

function createMockSource(name: string, results: SearchResult[]): SearchSource {
  return {
    name,
    search: vi.fn(() => Promise.resolve(results)),
  };
}

describe('SearchWidget', () => {
  let container: HTMLElement;
  let widget: SearchWidget;
  let source: SearchSource;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);

    source = createMockSource('test', [
      { text: 'Istanbul', location: [28.97, 41.01] },
      { text: 'Ankara', location: [32.86, 39.92] },
    ]);

    widget = new SearchWidget({
      id: 'search-test',
      sources: [source],
      placeholder: 'Search places...',
    });
    widget.mount(container);
  });

  afterEach(() => {
    vi.useRealTimers();
    widget.destroy();
  });

  it('should render with correct DOM structure', () => {
    const root = container.querySelector('#search-test');
    expect(root).not.toBeNull();
    expect(root!.classList.contains('mapgpu-widget-search')).toBe(true);

    const input = root!.querySelector('input');
    expect(input).not.toBeNull();
    expect(input!.placeholder).toBe('Search places...');
  });

  it('should render a dropdown container', () => {
    const root = container.querySelector('#search-test');
    const dropdown = root!.querySelector('.search-dropdown');
    expect(dropdown).not.toBeNull();
  });

  it('should debounce input by 300ms', () => {
    const input = container.querySelector('input') as HTMLInputElement;
    input.value = 'Ist';
    input.dispatchEvent(new Event('input'));

    // Before 300ms, search should not be called
    vi.advanceTimersByTime(200);
    expect(source.search).not.toHaveBeenCalled();

    // After 300ms, search should be called
    vi.advanceTimersByTime(100);
    expect(source.search).toHaveBeenCalledWith('Ist');
  });

  it('should reset debounce timer on new input', () => {
    const input = container.querySelector('input') as HTMLInputElement;
    input.value = 'Is';
    input.dispatchEvent(new Event('input'));

    vi.advanceTimersByTime(200);
    input.value = 'Ist';
    input.dispatchEvent(new Event('input'));

    vi.advanceTimersByTime(200);
    expect(source.search).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(source.search).toHaveBeenCalledWith('Ist');
    expect(source.search).toHaveBeenCalledTimes(1);
  });

  it('should call search on all sources', async () => {
    const source2 = createMockSource('source2', [
      { text: 'Izmir', location: [27.14, 38.42] },
    ]);

    const multiWidget = new SearchWidget({
      id: 'multi-search',
      sources: [source, source2],
    });
    multiWidget.mount(container);

    await multiWidget.search('test');

    expect(source.search).toHaveBeenCalledWith('test');
    expect(source2.search).toHaveBeenCalledWith('test');

    multiWidget.destroy();
  });

  it('should render search results in dropdown', async () => {
    await widget.search('Istanbul');

    const results = container.querySelectorAll('.search-result');
    expect(results.length).toBe(2);
    expect(results[0]!.textContent).toBe('Istanbul');
    expect(results[1]!.textContent).toBe('Ankara');
  });

  it('should emit select event when result is clicked', async () => {
    const handler = vi.fn();
    widget.onSelect(handler);

    await widget.search('Istanbul');

    const firstResult = container.querySelector('.search-result') as HTMLElement;
    firstResult.click();

    expect(handler).toHaveBeenCalledWith({
      text: 'Istanbul',
      location: [28.97, 41.01],
    });
  });

  it('should clear results and input', async () => {
    await widget.search('Istanbul');
    expect(widget.results.length).toBe(2);

    widget.clear();
    expect(widget.results.length).toBe(0);

    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('');

    const results = container.querySelectorAll('.search-result');
    expect(results.length).toBe(0);
  });

  it('should return empty results for empty query', async () => {
    const results = await widget.search('');
    expect(results).toHaveLength(0);
    expect(source.search).not.toHaveBeenCalled();
  });

  it('should unsubscribe select handler', async () => {
    const handler = vi.fn();
    widget.onSelect(handler);
    widget.offSelect(handler);

    await widget.search('Istanbul');
    const firstResult = container.querySelector('.search-result') as HTMLElement;
    firstResult.click();

    expect(handler).not.toHaveBeenCalled();
  });

  it('should clean up on destroy', () => {
    widget.destroy();
    expect(container.querySelector('#search-test')).toBeNull();
  });
});
