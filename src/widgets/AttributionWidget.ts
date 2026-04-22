/**
 * AttributionWidget — Displays data source attribution text (Leaflet L.control.attribution equivalent).
 */

import type { IView, WidgetPosition } from '../core/index.js';
import { WidgetBase } from './WidgetBase.js';

export interface AttributionWidgetOptions {
  id?: string;
  position?: WidgetPosition;
  prefix?: string | false;
}

export class AttributionWidget extends WidgetBase {
  private _prefix: string | false;
  private readonly _attributions = new Set<string>();
  private _contentEl: HTMLDivElement | null = null;

  constructor(options?: AttributionWidgetOptions) {
    super(options?.id ?? 'attribution', options);
    this._prefix = options?.prefix ?? 'MapGPU';
    if (!options?.position) this.position = 'bottom-right';
  }

  addAttribution(text: string): this {
    this._attributions.add(text);
    this._updateContent();
    return this;
  }

  removeAttribution(text: string): this {
    this._attributions.delete(text);
    this._updateContent();
    return this;
  }

  setPrefix(prefix: string | false): this {
    this._prefix = prefix;
    this._updateContent();
    return this;
  }

  protected render(root: HTMLElement): void {
    root.style.background = 'rgba(255,255,255,0.75)';
    root.style.padding = '2px 6px';
    root.style.borderRadius = '3px';
    root.style.fontSize = '11px';
    root.style.fontFamily = '-apple-system, BlinkMacSystemFont, sans-serif';
    root.style.color = '#333';
    root.style.lineHeight = '1.4';
    root.style.pointerEvents = 'auto';

    this._contentEl = document.createElement('div');
    root.appendChild(this._contentEl);
    this._updateContent();
  }

  private _updateContent(): void {
    if (!this._contentEl) return;
    const parts: string[] = [];
    if (this._prefix !== false) parts.push(this._prefix);
    for (const a of this._attributions) parts.push(a);
    this._contentEl.innerHTML = parts.join(' | ');
  }

  protected onViewBound(_view: IView): void {
    // Could listen to layer-add/remove to auto-collect attributions
  }
}
