/**
 * MeasureLabelManager — HTML overlay labels for measurement tools.
 *
 * Creates positioned HTML elements above geographic coordinates,
 * updated via toScreen() projection on view-change events.
 * Labels are pointer-events:none so they don't interfere with map interaction.
 */

export interface MeasureLabel {
  id: string;
  geoPosition: [number, number]; // [lon, lat]
  text: string;
  type: 'distance' | 'area' | 'coordinate' | 'total';
  persistent: boolean; // survives tool deactivation
}

export interface MeasureLabelManagerOptions {
  container: HTMLElement;
  toScreen: (lon: number, lat: number) => [number, number] | null;
}

export class MeasureLabelManager {
  private readonly _container: HTMLElement;
  private readonly _toScreen: (lon: number, lat: number) => [number, number] | null;
  private readonly _labels = new Map<string, MeasureLabel>();
  private readonly _elements = new Map<string, HTMLDivElement>();

  constructor(options: MeasureLabelManagerOptions) {
    this._container = options.container;
    this._toScreen = options.toScreen;
  }

  addLabel(label: MeasureLabel): void {
    // Remove existing label with same id
    if (this._labels.has(label.id)) {
      this.removeLabel(label.id);
    }

    this._labels.set(label.id, { ...label });

    const el = document.createElement('div');
    el.dataset['labelId'] = label.id;
    el.style.position = 'absolute';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '5';
    el.style.transform = 'translate(-50%, -100%)';
    el.style.padding = '2px 6px';
    el.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    el.style.color = '#333';
    el.style.fontFamily = 'monospace';
    el.style.fontSize = '11px';
    el.style.borderRadius = '3px';
    el.style.whiteSpace = 'nowrap';
    el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
    el.style.border = '1px solid rgba(255, 87, 34, 0.3)';

    // Style based on label type
    if (label.type === 'total') {
      el.style.fontWeight = 'bold';
      el.style.backgroundColor = 'rgba(255, 87, 34, 0.9)';
      el.style.color = '#fff';
    } else if (label.type === 'area') {
      el.style.fontWeight = 'bold';
      el.style.backgroundColor = 'rgba(255, 87, 34, 0.85)';
      el.style.color = '#fff';
    }

    el.textContent = label.text;
    this._elements.set(label.id, el);
    this._container.appendChild(el);

    this._positionElement(label, el);
  }

  removeLabel(id: string): void {
    this._labels.delete(id);
    const el = this._elements.get(id);
    if (el) {
      el.remove();
      this._elements.delete(id);
    }
  }

  updateLabel(id: string, text: string): void {
    const label = this._labels.get(id);
    if (label) {
      label.text = text;
    }
    const el = this._elements.get(id);
    if (el) {
      el.textContent = text;
    }
  }

  /** Remove all non-persistent labels. */
  clearTransient(): void {
    for (const [id, label] of this._labels) {
      if (!label.persistent) {
        this.removeLabel(id);
      }
    }
  }

  /** Remove all labels. */
  clearAll(): void {
    for (const el of this._elements.values()) {
      el.remove();
    }
    this._labels.clear();
    this._elements.clear();
  }

  /** Reproject all labels via toScreen. Call on view-change. */
  updatePositions(): void {
    for (const [id, label] of this._labels) {
      const el = this._elements.get(id);
      if (el) {
        this._positionElement(label, el);
      }
    }
  }

  /** Get all current labels (readonly). */
  get labels(): ReadonlyMap<string, MeasureLabel> {
    return this._labels;
  }

  destroy(): void {
    this.clearAll();
  }

  // ─── Private ───

  private _positionElement(label: MeasureLabel, el: HTMLDivElement): void {
    const pos = this._toScreen(label.geoPosition[0], label.geoPosition[1]);
    if (!pos) {
      el.style.display = 'none';
      return;
    }
    el.style.display = '';
    el.style.left = `${pos[0]}px`;
    el.style.top = `${pos[1]}px`;
  }
}
