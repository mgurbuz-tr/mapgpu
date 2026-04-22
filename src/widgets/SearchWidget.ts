/**
 * SearchWidget — Text input with configurable search sources and debounced search.
 *
 * Displays results in a dropdown list. Emits select event when a result is chosen.
 */

import { debounced, type DebouncedFn, type Extent, type IView, type WidgetPosition } from '../core/index.js';
import { WidgetBase } from './WidgetBase.js';

const SEARCH_DEBOUNCE_MS = 300;

export interface SearchResult {
  text: string;
  location?: [number, number];
  extent?: Extent;
}

export interface SearchSource {
  name: string;
  search(query: string): Promise<SearchResult[]>;
}

export interface SearchWidgetOptions {
  id?: string;
  position?: WidgetPosition;
  placeholder?: string;
  sources: SearchSource[];
}

export class SearchWidget extends WidgetBase {
  private readonly _sources: SearchSource[];
  private readonly _placeholder: string;
  private _inputEl: HTMLInputElement | null = null;
  private _dropdownEl: HTMLDivElement | null = null;
  private _results: SearchResult[] = [];
  private readonly _runSearchDebounced: DebouncedFn<[string]> = debounced(
    (query: string) => void this.search(query),
    SEARCH_DEBOUNCE_MS,
  );
  private readonly _selectHandlers = new Set<(result: SearchResult) => void>();

  constructor(options: SearchWidgetOptions) {
    super('search', options);
    this._sources = options.sources;
    this._placeholder = options.placeholder ?? 'Search...';
  }

  get results(): ReadonlyArray<SearchResult> {
    return this._results;
  }

  onSelect(handler: (result: SearchResult) => void): void {
    this._selectHandlers.add(handler);
  }

  offSelect(handler: (result: SearchResult) => void): void {
    this._selectHandlers.delete(handler);
  }

  /**
   * Programmatically trigger a search.
   */
  async search(query: string): Promise<SearchResult[]> {
    if (!query.trim()) {
      this._results = [];
      this._renderDropdown();
      return [];
    }

    const allResults: SearchResult[] = [];
    const promises = this._sources.map(async (source) => {
      const results = await source.search(query);
      allResults.push(...results);
    });
    await Promise.all(promises);

    this._results = allResults;
    this._renderDropdown();
    return allResults;
  }

  /**
   * Clear search results and input.
   */
  clear(): void {
    this._results = [];
    if (this._inputEl) {
      this._inputEl.value = '';
    }
    this._renderDropdown();
  }

  protected render(root: HTMLElement): void {
    root.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
    root.style.borderRadius = '4px';
    root.style.padding = '0';
    root.style.fontFamily = 'sans-serif';
    root.style.fontSize = '13px';
    root.style.boxShadow = '0 1px 4px rgba(0,0,0,0.2)';
    root.style.minWidth = '240px';

    this._inputEl = document.createElement('input');
    this._inputEl.type = 'text';
    this._inputEl.placeholder = this._placeholder;
    this._inputEl.style.width = '100%';
    this._inputEl.style.padding = '8px 10px';
    this._inputEl.style.border = 'none';
    this._inputEl.style.borderRadius = '4px';
    this._inputEl.style.fontSize = '13px';
    this._inputEl.style.boxSizing = 'border-box';
    this._inputEl.style.outline = 'none';

    this._inputEl.addEventListener('input', () => {
      this._onInput();
    });

    root.appendChild(this._inputEl);

    this._dropdownEl = document.createElement('div');
    this._dropdownEl.classList.add('search-dropdown');
    this._dropdownEl.style.maxHeight = '200px';
    this._dropdownEl.style.overflowY = 'auto';
    root.appendChild(this._dropdownEl);
  }

  protected onViewBound(_view: IView): void {
    // no-op
  }

  protected onDestroy(): void {
    this._runSearchDebounced.cancel();
    this._selectHandlers.clear();
    this._inputEl = null;
    this._dropdownEl = null;
    this._results = [];
  }

  private _onInput(): void {
    this._runSearchDebounced(this._inputEl?.value ?? '');
  }

  private _renderDropdown(): void {
    if (!this._dropdownEl) return;
    this._dropdownEl.innerHTML = '';

    for (const result of this._results) {
      const item = document.createElement('div');
      item.classList.add('search-result');
      item.textContent = result.text;
      item.style.padding = '6px 10px';
      item.style.cursor = 'pointer';
      item.style.borderTop = '1px solid #eee';

      item.addEventListener('click', () => {
        this._emitSelect(result);
      });

      this._dropdownEl.appendChild(item);
    }
  }

  private _emitSelect(result: SearchResult): void {
    for (const handler of this._selectHandlers) {
      handler(result);
    }
  }
}
