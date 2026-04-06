import { getStoredResults, clearStoredResults, type StoredResult } from './metrics';

type RunStatus = 'ok' | 'failed';

type ResultRecord = StoredResult & {
  status: RunStatus;
  error?: string;
  failureStage?: string;
};

const COLORS: Record<string, string> = {
  MapGPU: '#38bdf8',
  OpenLayers: '#34d399',
  Leaflet: '#f59e0b',
  'Cesium (2D)': '#f87171',
  'MapLibre GL': '#f97316',
};
const DEFAULT_COLOR = '#94a3b8';

function color(lib: string): string {
  return COLORS[lib] ?? DEFAULT_COLOR;
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${n / 1_000_000}M`;
  return `${n / 1000}K`;
}

function fmtCompact(v: number, unit: string): string {
  if (!isFinite(v) || v < 0) return 'N/A';
  if (unit === 'FPS') return v.toFixed(1);
  if (unit === 'ms') return v > 1000 ? `${(v / 1000).toFixed(1)}s` : `${v.toFixed(0)}ms`;
  if (unit === 'MB') return `${v.toFixed(0)}MB`;
  return v.toFixed(1);
}

function niceMax(max: number): number {
  if (max <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  const normalized = max / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

function normalizeResults(results: StoredResult[]): ResultRecord[] {
  return results.map((r) => ({
    ...r,
    status: r.status === 'failed' ? 'failed' : 'ok',
  }));
}

interface ChartConfig {
  title: string;
  unit: string;
  higherIsBetter: boolean;
  getValue: (r: ResultRecord) => number;
}

function buildChart(cfg: ChartConfig, results: ResultRecord[]): string {
  const counts = [...new Set(results.map((r) => r.lineCount))].sort((a, b) => a - b);
  const libraries = [...new Set(results.map((r) => r.library))];

  const byCount = new Map<number, Map<string, ResultRecord>>();
  for (const r of results) {
    if (!byCount.has(r.lineCount)) byCount.set(r.lineCount, new Map());
    byCount.get(r.lineCount)!.set(r.library, r);
  }

  const validVals = results
    .filter((r) => r.status === 'ok')
    .map(cfg.getValue)
    .filter((v) => v > 0 && isFinite(v));

  if (validVals.length === 0) {
    return `<div style="padding:42px 14px;color:#9cb4c3;text-align:center;font-size:0.9rem">No successful data for ${escapeHtml(cfg.title)} yet.</div>`;
  }

  const maxVal = niceMax(Math.max(...validVals));

  const W = 760;
  const H = 360;
  const mt = 44;
  const mr = 28;
  const mb = 82;
  const ml = 78;
  const cw = W - ml - mr;
  const ch = H - mt - mb;

  const groupW = cw / Math.max(1, counts.length);
  const gap = 5;
  const barW = Math.max(8, Math.min(24, Math.floor((groupW - gap * (libraries.length + 1)) / Math.max(1, libraries.length))));
  const totalBarsW = libraries.length * barW + (libraries.length - 1) * gap;
  const groupPad = (groupW - totalBarsW) / 2;

  const yScale = (v: number) => mt + ch - Math.max(0, Math.min(1, v / maxVal)) * ch;

  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block">`;
  s += `<rect width="${W}" height="${H}" fill="#071722" rx="10"/>`;

  const ticks = 6;
  for (let i = 0; i <= ticks; i++) {
    const val = (maxVal / ticks) * i;
    const y = mt + ch - (ch / ticks) * i;
    s += `<line x1="${ml}" y1="${y.toFixed(1)}" x2="${ml + cw}" y2="${y.toFixed(1)}" stroke="#224155" stroke-width="1"/>`;
    s += `<text x="${(ml - 10).toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="#86a6b8" font-size="10" font-family="monospace">${fmtCompact(val, cfg.unit)}</text>`;
  }

  for (let gi = 0; gi < counts.length; gi++) {
    const count = counts[gi]!;
    const gx = ml + gi * groupW + groupPad;

    if (gi % 2 === 1) {
      const bgX = ml + gi * groupW;
      s += `<rect x="${bgX.toFixed(1)}" y="${mt}" width="${groupW.toFixed(1)}" height="${ch.toFixed(1)}" fill="#0a1f2d" opacity="0.45"/>`;
    }

    for (let li = 0; li < libraries.length; li++) {
      const lib = libraries[li]!;
      const run = byCount.get(count)?.get(lib);
      const bx = gx + li * (barW + gap);

      if (!run) continue;

      if (run.status === 'failed') {
        const x = bx + barW / 2;
        const y = mt + ch - 9;
        const msg = escapeHtml(`${run.library} ${fmtCount(run.lineCount)} failed${run.error ? `: ${run.error}` : ''}`);
        s += `<line x1="${(x - 4).toFixed(1)}" y1="${(y - 4).toFixed(1)}" x2="${(x + 4).toFixed(1)}" y2="${(y + 4).toFixed(1)}" stroke="#ef4444" stroke-width="1.8"/>`;
        s += `<line x1="${(x + 4).toFixed(1)}" y1="${(y - 4).toFixed(1)}" x2="${(x - 4).toFixed(1)}" y2="${(y + 4).toFixed(1)}" stroke="#ef4444" stroke-width="1.8"/>`;
        s += `<title>${msg}</title>`;
        continue;
      }

      const val = cfg.getValue(run);
      if (!isFinite(val) || val < 0) continue;

      const by = yScale(val);
      const bh = mt + ch - by;
      const c = color(lib);

      s += `<defs><linearGradient id="g${gi}${li}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${c}" stop-opacity="0.95"/><stop offset="100%" stop-color="${c}" stop-opacity="0.58"/></linearGradient></defs>`;
      s += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW}" height="${Math.max(2, bh).toFixed(1)}" fill="url(#g${gi}${li})" rx="2"/>`;
      s += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW}" height="2" fill="${c}" rx="1"/>`;

      const label = fmtCompact(val, cfg.unit);
      const labelY = by - 5;
      if (labelY > mt + 4) {
        s += `<text x="${(bx + barW / 2).toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle" fill="#dbeaf2" font-size="9" font-family="monospace">${label}</text>`;
      }
    }

    const lx = ml + gi * groupW + groupW / 2;
    s += `<text x="${lx.toFixed(1)}" y="${(mt + ch + 20).toFixed(1)}" text-anchor="middle" fill="#a8c0cf" font-size="12">${fmtCount(count)}</text>`;
    s += `<text x="${lx.toFixed(1)}" y="${(mt + ch + 33).toFixed(1)}" text-anchor="middle" fill="#6f8a9b" font-size="9">lines</text>`;
  }

  s += `<line x1="${ml}" y1="${mt}" x2="${ml}" y2="${mt + ch}" stroke="#32556a" stroke-width="1.5"/>`;
  s += `<line x1="${ml}" y1="${mt + ch}" x2="${ml + cw}" y2="${mt + ch}" stroke="#32556a" stroke-width="1.5"/>`;

  s += `<text x="${ml + cw / 2}" y="24" text-anchor="middle" fill="#e9f5fb" font-size="14" font-weight="700" font-family="Avenir Next, sans-serif">${escapeHtml(cfg.title)}</text>`;
  s += `<text x="${ml + cw}" y="${(mt + ch + 58).toFixed(1)}" text-anchor="end" fill="#7ea0b2" font-size="9">${cfg.higherIsBetter ? 'Higher is better' : 'Lower is better'}</text>`;
  s += `<text x="14" y="${(mt + ch / 2).toFixed(1)}" text-anchor="middle" fill="#86a6b8" font-size="10" font-family="monospace" transform="rotate(-90 14 ${(mt + ch / 2).toFixed(1)})">${cfg.unit}</text>`;

  s += '</svg>';
  return s;
}

function buildLegend(libraries: string[]): string {
  const items = libraries
    .map((lib) => {
      const c = color(lib);
      return `<span style="display:inline-flex;align-items:center;gap:7px;margin-right:18px;margin-bottom:6px">
        <span style="width:12px;height:12px;border-radius:3px;background:${c};flex-shrink:0"></span>
        <span style="font-size:0.86rem;color:#d7e8f2">${escapeHtml(lib)}</span>
      </span>`;
    })
    .join('');
  return `<div style="display:flex;flex-wrap:wrap;gap:4px">${items}</div>`;
}

function render(): void {
  const raw = getStoredResults();
  const results = normalizeResults(raw);

  const countEl = document.getElementById('result-count')!;
  const legendEl = document.getElementById('legend')!;
  const chartsEl = document.getElementById('charts')!;

  countEl.textContent = `${results.length} result${results.length !== 1 ? 's' : ''} stored`;

  if (results.length === 0) {
    legendEl.innerHTML = '';
    chartsEl.innerHTML = `<div class="chart-card" style="padding:26px;color:#9cb4c3;text-align:center">Run a benchmark and open this page again.</div>`;
    return;
  }

  const libraries = [...new Set(results.map((r) => r.library))];
  legendEl.innerHTML = buildLegend(libraries);

  const charts: ChartConfig[] = [
    {
      title: 'Steady-State FPS',
      unit: 'FPS',
      higherIsBetter: true,
      getValue: (r) => r.steadyFps,
    },
    {
      title: 'First Render Latency',
      unit: 'ms',
      higherIsBetter: false,
      getValue: (r) => r.firstRenderMs,
    },
    {
      title: 'Add Layer Latency',
      unit: 'ms',
      higherIsBetter: false,
      getValue: (r) => r.addLayerMs,
    },
    {
      title: 'JS Heap After Run',
      unit: 'MB',
      higherIsBetter: false,
      getValue: (r) => (r.memoryMb > 0 ? r.memoryMb : Number.NaN),
    },
  ];

  chartsEl.innerHTML = charts
    .map((cfg) => `<div class="chart-card">${buildChart(cfg, results)}</div>`)
    .join('');
}

document.getElementById('clear-btn')!.addEventListener('click', () => {
  if (confirm('Clear all stored results?')) {
    clearStoredResults();
    render();
  }
});

render();
