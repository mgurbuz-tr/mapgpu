/**
 * LOSWidget — Line of Sight analysis control.
 *
 * Dark-themed, compact widget with:
 * - Observer/target coordinate display
 * - Height offset sliders with number inputs
 * - Visible/Blocked status badge
 * - Canvas2D elevation profile chart
 * - LosTool bidirectional binding
 */

import type { LosAnalysisResult, IView, WidgetPosition } from '../core/index.js';
import { WidgetBase } from './WidgetBase.js';

export interface LOSWidgetOptions {
  id?: string;
  position?: WidgetPosition;
}

export interface LOSObserverTarget {
  observer: [number, number];
  target: [number, number];
  observerOffset: number;
  targetOffset: number;
}

/** Minimal LosTool interface for binding (avoids hard dependency on @mapgpu/tools). */
interface ILosTool {
  readonly observer: [number, number] | null;
  readonly target: [number, number] | null;
  readonly observerOffset: number;
  readonly targetOffset: number;
  setObserverOffset(meters: number): void;
  setTargetOffset(meters: number): void;
}

/** Minimal event source for tool events. */
interface IToolEventSource {
  on(event: 'los-update', handler: (data: {
    observer: [number, number];
    target: [number, number];
    observerOffset: number;
    targetOffset: number;
    result: LosAnalysisResult;
  }) => void): void;
  on(event: 'los-clear', handler: (data: { toolId: string }) => void): void;
}

// ─── Profile chart constants ───
const CHART_WIDTH = 300;
const CHART_HEIGHT = 130;
const CHART_PAD_LEFT = 38;
const CHART_PAD_RIGHT = 8;
const CHART_PAD_TOP = 14;
const CHART_PAD_BOTTOM = 22;

// ─── Theme colors ───
const C = {
  bg: '#161b22',
  surface: '#21262d',
  border: '#30363d',
  text: '#e6edf3',
  muted: '#8b949e',
  green: '#3fb950',
  red: '#f85149',
  blue: '#58a6ff',
  orange: '#d29922',
  accent: '#ff6d3a',
  chartBg: '#0d1117',
  chartGrid: '#21262d',
  terrainFill: 'rgba(139,148,158,0.15)',
  terrainStroke: '#484f58',
};

export class LOSWidget extends WidgetBase {
  private _observer: [number, number] | null = null;
  private _target: [number, number] | null = null;
  private _observerOffset = 1.8;
  private _targetOffset = 0;
  private _result: LosAnalysisResult | null = null;

  private _observerInput: HTMLInputElement | null = null;
  private _targetInput: HTMLInputElement | null = null;
  private _observerOffsetInput: HTMLInputElement | null = null;
  private _targetOffsetInput: HTMLInputElement | null = null;
  private _observerSlider: HTMLInputElement | null = null;
  private _targetSlider: HTMLInputElement | null = null;
  private _resultEl: HTMLDivElement | null = null;
  private _profileCanvas: HTMLCanvasElement | null = null;
  private _pickBtn: HTMLButtonElement | null = null;

  private readonly _runHandlers = new Set<(params: LOSObserverTarget) => void>();
  private _boundTool: ILosTool | null = null;
  private _losUpdateHandler: ((data: unknown) => void) | null = null;
  private _losClearHandler: ((data: unknown) => void) | null = null;

  constructor(options?: LOSWidgetOptions) {
    super('los', options);
  }

  // ─── Public getters ───
  get observer(): [number, number] | null { return this._observer; }
  get target(): [number, number] | null { return this._target; }
  get observerOffset(): number { return this._observerOffset; }
  get targetOffset(): number { return this._targetOffset; }
  get result(): LosAnalysisResult | null { return this._result; }

  // ─── Public setters ───
  setObserver(lon: number, lat: number): void {
    this._observer = [lon, lat];
    if (this._observerInput) this._observerInput.value = `${lon.toFixed(4)}, ${lat.toFixed(4)}`;
  }

  setTarget(lon: number, lat: number): void {
    this._target = [lon, lat];
    if (this._targetInput) this._targetInput.value = `${lon.toFixed(4)}, ${lat.toFixed(4)}`;
  }

  setObserverOffset(meters: number): void {
    this._observerOffset = meters;
    if (this._observerOffsetInput) this._observerOffsetInput.value = meters.toFixed(1);
    if (this._observerSlider) this._observerSlider.value = String(meters);
  }

  setTargetOffset(meters: number): void {
    this._targetOffset = meters;
    if (this._targetOffsetInput) this._targetOffsetInput.value = meters.toFixed(1);
    if (this._targetSlider) this._targetSlider.value = String(meters);
  }

  setResult(result: LosAnalysisResult): void {
    this._result = result;
    this._renderResult();
    this._renderProfile();
  }

  clearResult(): void {
    this._result = null;
    this._observer = null;
    this._target = null;
    this._observerOffset = 1.8;
    this._targetOffset = 0;
    if (this._observerInput) this._observerInput.value = '';
    if (this._targetInput) this._targetInput.value = '';
    if (this._observerOffsetInput) this._observerOffsetInput.value = '1.8';
    if (this._targetOffsetInput) this._targetOffsetInput.value = '0';
    if (this._observerSlider) this._observerSlider.value = '1.8';
    if (this._targetSlider) this._targetSlider.value = '0';
    if (this._resultEl) this._resultEl.innerHTML = '';
    this._clearProfileCanvas();
  }

  onRunLos(handler: (params: LOSObserverTarget) => void): void { this._runHandlers.add(handler); }
  offRunLos(handler: (params: LOSObserverTarget) => void): void { this._runHandlers.delete(handler); }

  private readonly _pickHandlers = new Set<() => void>();

  /** Register a callback for the "Pick Points" button. */
  onPick(handler: () => void): void { this._pickHandlers.add(handler); }
  offPick(handler: () => void): void { this._pickHandlers.delete(handler); }

  bindLosTool(tool: ILosTool, eventSource: IToolEventSource): void {
    this._boundTool = tool;
    this._losUpdateHandler = (data: unknown) => {
      const d = data as { observer: [number, number]; target: [number, number]; observerOffset: number; targetOffset: number; result: LosAnalysisResult };
      this.setObserver(d.observer[0], d.observer[1]);
      this.setTarget(d.target[0], d.target[1]);
      this.setObserverOffset(d.observerOffset);
      this.setTargetOffset(d.targetOffset);
      this.setResult(d.result);
    };
    this._losClearHandler = () => { this.clearResult(); };
    eventSource.on('los-update', this._losUpdateHandler as never);
    eventSource.on('los-clear', this._losClearHandler as never);
  }

  // ─── Render ───

  protected render(root: HTMLElement): void {
    Object.assign(root.style, {
      backgroundColor: C.bg,
      borderRadius: '8px',
      padding: '0',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontSize: '12px',
      color: C.text,
      boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
      border: `1px solid ${C.border}`,
      minWidth: '310px',
      overflow: 'hidden',
    });

    // ─ Header
    const header = el('div', {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 12px', background: C.surface, borderBottom: `1px solid ${C.border}`,
    });
    const titleEl = el('span', { fontWeight: '600', fontSize: '13px', color: C.text });
    titleEl.textContent = 'Line of Sight';
    header.appendChild(titleEl);
    root.appendChild(header);

    // ─ Body
    const body = el('div', { padding: '10px 12px' });

    // Observer section
    body.appendChild(this._createCoordSection('observer', 'Observer', C.blue));
    body.appendChild(this._createHeightRow('observer', this._observerOffset));

    // Spacer
    body.appendChild(el('div', { height: '6px' }));

    // Target section
    body.appendChild(this._createCoordSection('target', 'Target', C.red));
    body.appendChild(this._createHeightRow('target', this._targetOffset));

    // Buttons
    const btnRow = el('div', { display: 'flex', gap: '6px', marginTop: '10px' });

    this._pickBtn = btn('Pick Points', C.accent, '#fff');
    this._pickBtn.classList.add('pick-btn');
    this._pickBtn.addEventListener('click', () => {
      for (const h of this._pickHandlers) h();
    });
    btnRow.appendChild(this._pickBtn);

    const runBtn = btn('Run', C.surface, C.text);
    runBtn.classList.add('run-btn');
    runBtn.style.border = `1px solid ${C.border}`;
    runBtn.addEventListener('click', () => this._emitRun());
    btnRow.appendChild(runBtn);

    const clearBtn = btn('Clear', C.surface, C.muted);
    clearBtn.classList.add('clear-btn');
    clearBtn.style.border = `1px solid ${C.border}`;
    clearBtn.addEventListener('click', () => this.clearResult());
    btnRow.appendChild(clearBtn);

    body.appendChild(btnRow);

    // Result badge
    this._resultEl = el('div', { marginTop: '8px' }) as HTMLDivElement;
    this._resultEl.classList.add('los-result');
    body.appendChild(this._resultEl);

    root.appendChild(body);

    // Profile canvas
    this._profileCanvas = document.createElement('canvas');
    this._profileCanvas.classList.add('los-profile');
    this._profileCanvas.width = CHART_WIDTH;
    this._profileCanvas.height = CHART_HEIGHT;
    Object.assign(this._profileCanvas.style, {
      width: `${CHART_WIDTH}px`, height: `${CHART_HEIGHT}px`,
      display: 'none', borderTop: `1px solid ${C.border}`,
    });
    root.appendChild(this._profileCanvas);
  }

  protected onViewBound(_view: IView): void { /* no-op */ }

  protected onDestroy(): void {
    this._runHandlers.clear();
    this._pickHandlers.clear();
    this._boundTool = null;
    this._losUpdateHandler = null;
    this._losClearHandler = null;
    this._observerInput = null;
    this._targetInput = null;
    this._observerOffsetInput = null;
    this._targetOffsetInput = null;
    this._observerSlider = null;
    this._targetSlider = null;
    this._resultEl = null;
    this._profileCanvas = null;
    this._pickBtn = null;
    this._result = null;
  }

  // ─── UI Builders ───

  private _createCoordSection(which: 'observer' | 'target', label: string, dotColor: string): HTMLElement {
    const row = el('div', { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' });

    // Colored dot
    const dot = el('span', {
      width: '8px', height: '8px', borderRadius: '50%', background: dotColor, flexShrink: '0',
    });
    row.appendChild(dot);

    // Label
    const lbl = el('span', { color: C.muted, fontSize: '11px', minWidth: '52px' });
    lbl.textContent = label;
    row.appendChild(lbl);

    // Coordinate input
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'lon, lat';
    input.readOnly = true;
    input.classList.add(`${which}-input`);
    Object.assign(input.style, {
      flex: '1', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '4px',
      color: C.text, padding: '3px 6px', fontSize: '11px', fontFamily: 'var(--font-mono, monospace)',
      outline: 'none',
    });
    row.appendChild(input);

    if (which === 'observer') this._observerInput = input;
    else this._targetInput = input;

    return row;
  }

  private _createHeightRow(which: 'observer' | 'target', defaultValue: number): HTMLElement {
    const row = el('div', {
      display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', paddingLeft: '16px',
    });

    const lbl = el('span', { color: C.muted, fontSize: '10px', minWidth: '52px' });
    lbl.textContent = 'Height';
    row.appendChild(lbl);

    // Slider
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '200';
    slider.step = '0.5';
    slider.value = String(defaultValue);
    slider.classList.add(`${which}-slider`);
    Object.assign(slider.style, {
      flex: '1', height: '4px', accentColor: which === 'observer' ? C.blue : C.red,
    });
    row.appendChild(slider);

    // Number input
    const numInput = document.createElement('input');
    numInput.type = 'number';
    numInput.value = defaultValue.toFixed(1);
    numInput.min = '0';
    numInput.max = '200';
    numInput.step = '0.5';
    numInput.classList.add(`${which}-offset-input`);
    Object.assign(numInput.style, {
      width: '48px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '4px',
      color: C.text, padding: '2px 4px', fontSize: '11px', textAlign: 'right' as const, outline: 'none',
    });
    row.appendChild(numInput);

    const unit = el('span', { color: C.muted, fontSize: '10px' });
    unit.textContent = 'm';
    row.appendChild(unit);

    if (which === 'observer') { this._observerSlider = slider; this._observerOffsetInput = numInput; }
    else { this._targetSlider = slider; this._targetOffsetInput = numInput; }

    const onChange = (val: number) => {
      if (which === 'observer') { this._observerOffset = val; }
      else { this._targetOffset = val; }
      this._onOffsetChange(which);
    };

    slider.addEventListener('input', () => {
      const v = Number.parseFloat(slider.value) || 0;
      numInput.value = v.toFixed(1);
      onChange(v);
    });
    numInput.addEventListener('input', () => {
      const v = Number.parseFloat(numInput.value) || 0;
      slider.value = String(v);
      onChange(v);
    });

    return row;
  }

  private _onOffsetChange(which: 'observer' | 'target'): void {
    if (this._boundTool) {
      if (which === 'observer') this._boundTool.setObserverOffset(this._observerOffset);
      else this._boundTool.setTargetOffset(this._targetOffset);
    }
    this._emitRun();
  }

  // ─── Result Display ───

  private _renderResult(): void {
    if (!this._resultEl || !this._result) return;
    this._resultEl.innerHTML = '';

    const badge = el('div', {
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: '600',
    });

    if (this._result.visible) {
      Object.assign(badge.style, { background: 'rgba(63,185,80,0.15)', color: C.green });
      badge.innerHTML = `<span style="width:6px;height:6px;border-radius:50%;background:${C.green}"></span> Visible`;
    } else {
      Object.assign(badge.style, { background: 'rgba(248,81,73,0.15)', color: C.red });
      badge.innerHTML = `<span style="width:6px;height:6px;border-radius:50%;background:${C.red}"></span> Blocked`;
    }
    this._resultEl.appendChild(badge);

    if (this._result.blockingPoint) {
      const bp = this._result.blockingPoint;
      const info = el('div', { fontSize: '11px', color: C.muted, marginTop: '4px' });
      info.classList.add('blocking-info');
      info.textContent = `Obstacle: ${bp[0]!.toFixed(4)}, ${bp[1]!.toFixed(4)} (${bp[2]!.toFixed(1)}m)`;
      this._resultEl.appendChild(info);
    }
  }

  // ─── Profile Chart ───

  private _renderProfile(): void { // NOSONAR
    if (!this._profileCanvas || !this._result) return;

    this._profileCanvas.style.display = 'block';
    const ctx = this._profileCanvas.getContext('2d');
    if (!ctx) return;

    const profile = this._result.profile;
    const sampleCount = profile.length / 2;
    if (sampleCount < 2) return;

    const w = CHART_WIDTH, h = CHART_HEIGHT;
    const pl = CHART_PAD_LEFT, pr = CHART_PAD_RIGHT, pt = CHART_PAD_TOP, pb = CHART_PAD_BOTTOM;
    const cw = w - pl - pr, ch = h - pt - pb;

    const distances: number[] = [];
    const elevations: number[] = [];
    for (let i = 0; i < sampleCount; i++) {
      distances.push(profile[i * 2]!);
      elevations.push(profile[i * 2 + 1]!);
    }

    const maxDist = distances.at(-1)!;
    const minElev = Math.min(...elevations);
    const maxElev = Math.max(...elevations, this._observerOffset, this._targetOffset);
    const elevRange = Math.max(maxElev - minElev, 1);
    const elevPad = elevRange * 0.12;
    const eMin = minElev - elevPad;
    const eMax = maxElev + elevPad;
    const eRange = eMax - eMin;

    // Background
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = C.chartBg;
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = C.chartGrid;
    ctx.lineWidth = 0.5;
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = pt + (i / gridLines) * ch;
      ctx.beginPath();
      ctx.moveTo(pl, y);
      ctx.lineTo(pl + cw, y);
      ctx.stroke();
    }

    // Terrain fill
    ctx.beginPath();
    ctx.moveTo(pl, pt + ch);
    for (let i = 0; i < sampleCount; i++) {
      const x = pl + (maxDist > 0 ? (distances[i]! / maxDist) * cw : 0);
      const y = pt + ch - ((elevations[i]! - eMin) / eRange) * ch;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(pl + cw, pt + ch);
    ctx.closePath();
    ctx.fillStyle = C.terrainFill;
    ctx.fill();

    // Terrain outline
    ctx.beginPath();
    for (let i = 0; i < sampleCount; i++) {
      const x = pl + (maxDist > 0 ? (distances[i]! / maxDist) * cw : 0);
      const y = pt + ch - ((elevations[i]! - eMin) / eRange) * ch;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = C.terrainStroke;
    ctx.lineWidth = 1;
    ctx.stroke();

    // LOS ray
    const obsY = pt + ch - ((this._observerOffset + (elevations[0] ?? 0) - eMin) / eRange) * ch;
    const tgtY = pt + ch - ((this._targetOffset + (elevations[sampleCount - 1] ?? 0) - eMin) / eRange) * ch;

    if (this._result.visible) {
      ctx.beginPath();
      ctx.moveTo(pl, obsY);
      ctx.lineTo(pl + cw, tgtY);
      ctx.strokeStyle = C.green;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (this._result.blockingPoint) {
      const blockDist = findBlockingDistance(distances, elevations, this._observerOffset, this._targetOffset);
      const blockX = pl + blockDist * cw;
      const blockY = obsY + blockDist * (tgtY - obsY);

      // Green portion
      ctx.beginPath();
      ctx.moveTo(pl, obsY);
      ctx.lineTo(blockX, blockY);
      ctx.strokeStyle = C.green;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Red portion
      ctx.beginPath();
      ctx.moveTo(blockX, blockY);
      ctx.lineTo(pl + cw, tgtY);
      ctx.strokeStyle = C.red;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Blocking X marker
      const s = 4;
      ctx.beginPath();
      ctx.moveTo(blockX - s, blockY - s); ctx.lineTo(blockX + s, blockY + s);
      ctx.moveTo(blockX + s, blockY - s); ctx.lineTo(blockX - s, blockY + s);
      ctx.strokeStyle = C.orange;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Observer dot
    ctx.beginPath();
    ctx.arc(pl, obsY, 4, 0, Math.PI * 2);
    ctx.fillStyle = C.blue;
    ctx.fill();

    // Target dot
    ctx.beginPath();
    ctx.arc(pl + cw, tgtY, 4, 0, Math.PI * 2);
    ctx.fillStyle = C.red;
    ctx.fill();

    // Y-axis labels
    ctx.fillStyle = C.muted;
    ctx.font = '9px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= gridLines; i++) {
      const elev = eMax - (i / gridLines) * eRange;
      ctx.fillText(`${elev.toFixed(0)}`, pl - 4, pt + (i / gridLines) * ch + 3);
    }

    // X-axis
    ctx.textAlign = 'center';
    ctx.fillText('0', pl, h - 5);
    if (maxDist > 0) {
      ctx.fillText(maxDist > 1 ? `${maxDist.toFixed(1)}km` : `${(maxDist * 1000).toFixed(0)}m`, pl + cw, h - 5);
    }

    // OBS / TGT labels
    ctx.font = 'bold 8px -apple-system, sans-serif';
    ctx.fillStyle = C.blue;
    ctx.fillText('OBS', pl, obsY - 7);
    ctx.fillStyle = C.red;
    ctx.fillText('TGT', pl + cw, tgtY - 7);
  }

  private _clearProfileCanvas(): void {
    if (!this._profileCanvas) return;
    const ctx = this._profileCanvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, CHART_WIDTH, CHART_HEIGHT);
    this._profileCanvas.style.display = 'none';
  }

  private _emitRun(): void {
    if (!this._observer || !this._target) return;
    const params: LOSObserverTarget = {
      observer: this._observer, target: this._target,
      observerOffset: this._observerOffset, targetOffset: this._targetOffset,
    };
    for (const handler of this._runHandlers) handler(params);
  }
}

// ─── Helpers ───

function el(tag: string, styles: Record<string, string>): HTMLElement {
  const e = document.createElement(tag);
  Object.assign(e.style, styles);
  return e;
}

function btn(text: string, bg: string, color: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = text;
  Object.assign(b.style, {
    background: bg, color, border: 'none', borderRadius: '4px',
    padding: '5px 12px', fontSize: '11px', fontWeight: '500',
    cursor: 'pointer', flex: '1',
  });
  return b;
}

function findBlockingDistance(
  distances: number[], elevations: number[], obsOffset: number, tgtOffset: number,
): number {
  const n = distances.length;
  if (n < 2) return 0.5;
  const maxDist = distances[n - 1]!;
  if (maxDist <= 0) return 0.5;
  const obsElev = (elevations[0] ?? 0) + obsOffset;
  const tgtElev = (elevations[n - 1] ?? 0) + tgtOffset;
  for (let i = 1; i < n - 1; i++) {
    const t = distances[i]! / maxDist;
    const losElev = obsElev + t * (tgtElev - obsElev);
    if ((elevations[i] ?? 0) > losElev) return t;
  }
  return 0.5;
}
