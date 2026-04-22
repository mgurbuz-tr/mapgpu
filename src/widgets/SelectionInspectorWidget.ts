/**
 * SelectionInspectorWidget — Displays selected feature attributes in a table format.
 *
 * Supports pagination (max 10 per page), clear selection, and feature count display.
 */

import type { Feature, IView, WidgetPosition } from '../core/index.js';
import { WidgetBase } from './WidgetBase.js';

export interface SelectionInspectorWidgetOptions {
  id?: string;
  position?: WidgetPosition;
  pageSize?: number;
}

export class SelectionInspectorWidget extends WidgetBase {
  private _features: Feature[] = [];
  private readonly _pageSize: number;
  private _currentPage = 0;
  private _tableEl: HTMLTableElement | null = null;
  private _paginationEl: HTMLDivElement | null = null;
  private _countEl: HTMLSpanElement | null = null;
  private readonly _clearHandlers = new Set<() => void>();

  constructor(options?: SelectionInspectorWidgetOptions) {
    super('selection-inspector', options);
    this._pageSize = options?.pageSize ?? 10;
  }

  get features(): ReadonlyArray<Feature> {
    return this._features;
  }

  get currentPage(): number {
    return this._currentPage;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this._features.length / this._pageSize));
  }

  get pageSize(): number {
    return this._pageSize;
  }

  setFeatures(features: Feature[]): void {
    this._features = features;
    this._currentPage = 0;
    this._rebuild();
  }

  clearSelection(): void {
    this._features = [];
    this._currentPage = 0;
    this._rebuild();
    for (const handler of this._clearHandlers) {
      handler();
    }
  }

  goToPage(page: number): void {
    const maxPage = this.totalPages - 1;
    this._currentPage = Math.max(0, Math.min(page, maxPage));
    this._rebuildTable();
    this._rebuildPagination();
  }

  nextPage(): void {
    this.goToPage(this._currentPage + 1);
  }

  prevPage(): void {
    this.goToPage(this._currentPage - 1);
  }

  onClear(handler: () => void): void {
    this._clearHandlers.add(handler);
  }

  offClear(handler: () => void): void {
    this._clearHandlers.delete(handler);
  }

  protected render(root: HTMLElement): void {
    root.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
    root.style.borderRadius = '4px';
    root.style.padding = '8px';
    root.style.fontFamily = 'sans-serif';
    root.style.fontSize = '13px';
    root.style.boxShadow = '0 1px 4px rgba(0,0,0,0.2)';
    root.style.minWidth = '280px';
    root.style.maxHeight = '400px';
    root.style.overflowY = 'auto';

    // Header
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '8px';

    const title = document.createElement('span');
    title.textContent = 'Selection Inspector';
    title.style.fontWeight = 'bold';
    title.style.fontSize = '14px';
    header.appendChild(title);

    this._countEl = document.createElement('span');
    this._countEl.classList.add('feature-count');
    this._countEl.style.fontSize = '12px';
    this._countEl.style.color = '#666';
    header.appendChild(this._countEl);

    root.appendChild(header);

    // Clear button
    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear Selection';
    clearBtn.classList.add('clear-btn');
    clearBtn.style.marginBottom = '8px';
    clearBtn.style.fontSize = '12px';
    clearBtn.addEventListener('click', () => this.clearSelection());
    root.appendChild(clearBtn);

    // Table
    this._tableEl = document.createElement('table');
    this._tableEl.style.width = '100%';
    this._tableEl.style.borderCollapse = 'collapse';
    this._tableEl.style.fontSize = '12px';
    root.appendChild(this._tableEl);

    // Pagination
    this._paginationEl = document.createElement('div');
    this._paginationEl.classList.add('pagination');
    this._paginationEl.style.display = 'flex';
    this._paginationEl.style.justifyContent = 'center';
    this._paginationEl.style.gap = '4px';
    this._paginationEl.style.marginTop = '8px';
    root.appendChild(this._paginationEl);

    this._rebuild();
  }

  protected onViewBound(_view: IView): void {
    // no-op
  }

  protected onDestroy(): void {
    this._clearHandlers.clear();
    this._features = [];
    this._tableEl = null;
    this._paginationEl = null;
    this._countEl = null;
  }

  private _rebuild(): void {
    this._updateCount();
    this._rebuildTable();
    this._rebuildPagination();
  }

  private _updateCount(): void {
    if (this._countEl) {
      this._countEl.textContent = `${this._features.length} feature${this._features.length === 1 ? '' : 's'}`;
    }
  }

  private _rebuildTable(): void { // NOSONAR
    if (!this._tableEl) return;
    this._tableEl.innerHTML = '';

    if (this._features.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.textContent = 'No features selected';
      cell.style.color = '#999';
      cell.style.padding = '8px';
      row.appendChild(cell);
      this._tableEl.appendChild(row);
      return;
    }

    // Get all attribute keys from the page's features
    const startIdx = this._currentPage * this._pageSize;
    const endIdx = Math.min(startIdx + this._pageSize, this._features.length);
    const pageFeatures = this._features.slice(startIdx, endIdx);

    const allKeys = new Set<string>();
    allKeys.add('id');
    for (const feature of pageFeatures) {
      for (const key of Object.keys(feature.attributes)) {
        allKeys.add(key);
      }
    }
    const keys = Array.from(allKeys);

    // Header row
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const key of keys) {
      const th = document.createElement('th');
      th.textContent = key;
      th.style.padding = '4px 6px';
      th.style.borderBottom = '2px solid #ddd';
      th.style.textAlign = 'left';
      th.style.fontSize = '11px';
      th.style.fontWeight = 'bold';
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    this._tableEl.appendChild(thead);

    // Body rows
    const tbody = document.createElement('tbody');
    for (const feature of pageFeatures) {
      const row = document.createElement('tr');
      row.dataset.featureId = String(feature.id);
      for (const key of keys) {
        const td = document.createElement('td');
        td.style.padding = '3px 6px';
        td.style.borderBottom = '1px solid #eee';
        if (key === 'id') {
          td.textContent = String(feature.id);
        } else {
          const val = feature.attributes[key];
          if (val === undefined || val === null) {
            td.textContent = '';
          } else if (typeof val === 'object') {
            td.textContent = JSON.stringify(val);
          } else {
            td.textContent = `${val as string | number | boolean}`;
          }
        }
        row.appendChild(td);
      }
      tbody.appendChild(row);
    }
    this._tableEl.appendChild(tbody);
  }

  private _rebuildPagination(): void {
    if (!this._paginationEl) return;
    this._paginationEl.innerHTML = '';

    const total = this.totalPages;
    if (total <= 1) return;

    const prevBtn = document.createElement('button');
    prevBtn.textContent = 'Prev';
    prevBtn.classList.add('prev-btn');
    prevBtn.disabled = this._currentPage === 0;
    prevBtn.style.fontSize = '11px';
    prevBtn.addEventListener('click', () => this.prevPage());
    this._paginationEl.appendChild(prevBtn);

    const pageInfo = document.createElement('span');
    pageInfo.classList.add('page-info');
    pageInfo.textContent = `${this._currentPage + 1} / ${total}`;
    pageInfo.style.fontSize = '11px';
    pageInfo.style.lineHeight = '24px';
    this._paginationEl.appendChild(pageInfo);

    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next';
    nextBtn.classList.add('next-btn');
    nextBtn.disabled = this._currentPage >= total - 1;
    nextBtn.style.fontSize = '11px';
    nextBtn.addEventListener('click', () => this.nextPage());
    this._paginationEl.appendChild(nextBtn);
  }
}
