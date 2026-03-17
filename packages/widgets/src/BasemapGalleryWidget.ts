/**
 * BasemapGalleryWidget — Displays a gallery of basemap options with thumbnails.
 *
 * Users can click to switch the active basemap.
 */

import type { IView, WidgetPosition } from '@mapgpu/core';
import { WidgetBase } from './WidgetBase.js';

export interface BasemapItem {
  /** Unique basemap identifier */
  id: string;
  /** Display title */
  title: string;
  /** Thumbnail data URL or placeholder color */
  thumbnailUrl?: string;
}

export interface BasemapGalleryWidgetOptions {
  id?: string;
  position?: WidgetPosition;
  basemaps?: BasemapItem[];
  activeBasemapId?: string;
}

export class BasemapGalleryWidget extends WidgetBase {
  private _basemaps: BasemapItem[];
  private _activeBasemapId: string | null;
  private _galleryEl: HTMLDivElement | null = null;
  private _selectionHandlers = new Set<(basemap: BasemapItem) => void>();

  constructor(options?: BasemapGalleryWidgetOptions) {
    super('basemap-gallery', options);
    this._basemaps = options?.basemaps ?? [];
    this._activeBasemapId = options?.activeBasemapId ?? (this._basemaps[0]?.id ?? null);
  }

  get basemaps(): ReadonlyArray<BasemapItem> {
    return this._basemaps;
  }

  get activeBasemapId(): string | null {
    return this._activeBasemapId;
  }

  setBasemaps(basemaps: BasemapItem[]): void {
    this._basemaps = basemaps;
    if (basemaps.length > 0 && !basemaps.some((b) => b.id === this._activeBasemapId)) {
      this._activeBasemapId = basemaps[0]?.id ?? null;
    }
    this._rebuildGallery();
  }

  selectBasemap(basemapId: string): void {
    const basemap = this._basemaps.find((b) => b.id === basemapId);
    if (!basemap) return;

    this._activeBasemapId = basemapId;
    this._rebuildGallery();

    for (const handler of this._selectionHandlers) {
      handler(basemap);
    }
  }

  onSelect(handler: (basemap: BasemapItem) => void): void {
    this._selectionHandlers.add(handler);
  }

  offSelect(handler: (basemap: BasemapItem) => void): void {
    this._selectionHandlers.delete(handler);
  }

  protected render(root: HTMLElement): void {
    root.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
    root.style.borderRadius = '4px';
    root.style.padding = '8px';
    root.style.fontFamily = 'sans-serif';
    root.style.fontSize = '12px';
    root.style.boxShadow = '0 1px 4px rgba(0,0,0,0.2)';

    const title = document.createElement('div');
    title.textContent = 'Basemap';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '8px';
    title.style.fontSize = '14px';
    root.appendChild(title);

    this._galleryEl = document.createElement('div');
    this._galleryEl.style.display = 'flex';
    this._galleryEl.style.flexWrap = 'wrap';
    this._galleryEl.style.gap = '6px';
    root.appendChild(this._galleryEl);

    this._rebuildGallery();
  }

  protected onViewBound(_view: IView): void {
    this._rebuildGallery();
  }

  protected onDestroy(): void {
    this._selectionHandlers.clear();
    this._galleryEl = null;
    this._basemaps = [];
  }

  private _rebuildGallery(): void {
    if (!this._galleryEl) return;
    this._galleryEl.innerHTML = '';

    for (const basemap of this._basemaps) {
      const item = document.createElement('div');
      item.classList.add('item');
      item.setAttribute('data-basemap-id', basemap.id);
      item.style.width = '64px';
      item.style.cursor = 'pointer';
      item.style.textAlign = 'center';
      item.style.borderRadius = '4px';
      item.style.overflow = 'hidden';
      item.style.border = basemap.id === this._activeBasemapId
        ? '2px solid #007bff'
        : '2px solid transparent';
      item.style.padding = '2px';

      // Thumbnail
      const thumb = document.createElement('div');
      thumb.style.width = '60px';
      thumb.style.height = '40px';
      thumb.style.borderRadius = '3px';
      thumb.style.marginBottom = '2px';

      if (basemap.thumbnailUrl) {
        thumb.style.backgroundImage = `url(${basemap.thumbnailUrl})`;
        thumb.style.backgroundSize = 'cover';
        thumb.style.backgroundPosition = 'center';
      } else {
        thumb.style.backgroundColor = '#ddd';
      }
      item.appendChild(thumb);

      // Label
      const label = document.createElement('div');
      label.textContent = basemap.title;
      label.style.fontSize = '10px';
      label.style.overflow = 'hidden';
      label.style.textOverflow = 'ellipsis';
      label.style.whiteSpace = 'nowrap';
      item.appendChild(label);

      item.addEventListener('click', () => {
        this.selectBasemap(basemap.id);
      });

      this._galleryEl.appendChild(item);
    }
  }
}
