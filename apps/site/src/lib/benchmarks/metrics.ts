/**
 * Shared benchmark metrics collection, display, and persistence.
 */

export interface BenchMetrics {
  library: string;
  lineCount: number;
  dataGenMs: number;
  addLayerMs: number;
  firstRenderMs: number;
  steadyFps: number;
  memoryMb: number;
  status?: 'ok' | 'failed';
  error?: string;
  failureStage?: string;
}

export interface StoredResult extends BenchMetrics {
  timestamp: number;
}

const STORAGE_KEY = 'mapgpu-bench-results';

export function saveResult(m: BenchMetrics): void {
  const all = getStoredResults();
  const idx = all.findIndex((r) => r.library === m.library && r.lineCount === m.lineCount);
  const entry: StoredResult = { ...m, status: m.status ?? 'ok', timestamp: Date.now() };
  if (idx >= 0) all[idx] = entry;
  else all.push(entry);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // localStorage full — ignore
  }
}

export function getStoredResults(): StoredResult[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as StoredResult[];
  } catch {
    return [];
  }
}

export function clearStoredResults(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getMemoryMb(): number {
  const perf = performance as unknown as { memory?: { usedJSHeapSize: number } };
  return perf.memory ? perf.memory.usedJSHeapSize / (1024 * 1024) : -1;
}

export function updateStatus(msg: string): void {
  const el = document.getElementById('status');
  if (el) el.textContent = msg;
  console.log(`[bench] ${msg}`);
}

export function displayMetrics(m: Partial<BenchMetrics>): void {
  const el = document.getElementById('metrics');
  if (!el) return;

  const isFailed = m.status === 'failed';
  const fmtMs = (v: number | undefined) =>
    v != null && isFinite(v) && v >= 0 ? `${v.toFixed(0)} ms` : 'N/A';
  const fmtFps = (v: number | undefined) =>
    v != null && isFinite(v) && v >= 0 ? v.toFixed(1) : 'N/A';
  const fmtMem = (v: number | undefined) =>
    v != null ? (v > 0 && isFinite(v) ? `${v.toFixed(0)} MB` : 'N/A') : '...';

  el.innerHTML = `
    <tr><td>Library</td><td><b>${m.library ?? '...'}</b></td></tr>
    <tr><td>Status</td><td><b style="color:${isFailed ? '#ef4444' : '#22c55e'}">${isFailed ? 'FAILED' : 'OK'}</b></td></tr>
    <tr><td>Line count</td><td>${m.lineCount?.toLocaleString() ?? '...'}</td></tr>
    <tr><td>Data generation</td><td>${fmtMs(m.dataGenMs)}</td></tr>
    <tr><td>Add to map</td><td>${fmtMs(m.addLayerMs)}</td></tr>
    <tr><td>First render</td><td>${fmtMs(m.firstRenderMs)}</td></tr>
    <tr><td>Steady FPS</td><td>${fmtFps(m.steadyFps)}</td></tr>
    <tr><td>JS Heap</td><td>${fmtMem(m.memoryMb)}</td></tr>
    ${isFailed ? `<tr><td>Failure</td><td style="color:#fca5a5">${m.failureStage ?? 'runtime'}${m.error ? `: ${m.error}` : ''}</td></tr>` : ''}
  `;
}

export function measureFps(durationMs = 3000): Promise<number> {
  return new Promise((resolve) => {
    let frames = 0;
    const start = performance.now();

    function tick() {
      frames++;
      if (performance.now() - start < durationMs) {
        requestAnimationFrame(tick);
      } else {
        const elapsed = performance.now() - start;
        resolve((frames / elapsed) * 1000);
      }
    }

    requestAnimationFrame(tick);
  });
}

export function nextAnimationFrame(): Promise<number> {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

export function waitFrames(n: number): Promise<void> {
  return new Promise((resolve) => {
    let count = 0;
    function tick() {
      count++;
      if (count >= n) resolve();
      else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}
