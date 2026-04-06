/**
 * ZoomControlWidget — Zoom in/out buttons (Leaflet L.control.zoom equivalent).
 */

import type { IView, WidgetPosition } from '@mapgpu/core';
import { WidgetBase } from './WidgetBase.js';

export interface ZoomControlWidgetOptions {
  id?: string;
  position?: WidgetPosition;
  zoomInTitle?: string;
  zoomOutTitle?: string;
}

export class ZoomControlWidget extends WidgetBase {
  private _zoomInTitle: string;
  private _zoomOutTitle: string;
  private _btnIn: HTMLButtonElement | null = null;
  private _btnOut: HTMLButtonElement | null = null;

  constructor(options?: ZoomControlWidgetOptions) {
    super(options?.id ?? 'zoom-control', options);
    this._zoomInTitle = options?.zoomInTitle ?? 'Zoom in';
    this._zoomOutTitle = options?.zoomOutTitle ?? 'Zoom out';
    if (!options?.position) this.position = 'top-left';
  }

  protected render(root: HTMLElement): void {
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    root.style.gap = '1px';
    root.style.borderRadius = '4px';
    root.style.overflow = 'hidden';
    root.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';
    root.style.userSelect = 'none';

    this._btnIn = this._createButton('+', this._zoomInTitle, () => {
      (this._view as IView & { zoomIn?: (o?: { duration?: number }) => void })?.zoomIn?.({ duration: 300 });
    });
    this._btnOut = this._createButton('\u2212', this._zoomOutTitle, () => {
      (this._view as IView & { zoomOut?: (o?: { duration?: number }) => void })?.zoomOut?.({ duration: 300 });
    });

    root.appendChild(this._btnIn);
    root.appendChild(this._btnOut);
  }

  private _createButton(text: string, title: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.style.cssText = `
      display: flex; align-items: center; justify-content: center;
      width: 30px; height: 30px; border: none; margin: 0;
      background: rgba(22,27,34,0.9); color: #e6edf3;
      font-size: 18px; font-weight: 700; line-height: 1;
      cursor: pointer; font-family: -apple-system, sans-serif;
      transition: background 0.15s;
    `;
    btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(22,27,34,1)'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(22,27,34,0.9)'; });
    btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    return btn;
  }

  protected onViewBound(_view: IView): void {
    // Could subscribe to view-change to disable buttons at min/max zoom
  }
}
