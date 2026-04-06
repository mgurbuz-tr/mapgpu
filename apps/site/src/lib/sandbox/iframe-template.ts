/**
 * Generates the iframe HTML for the playground preview.
 * Uses import maps with absolute URLs so they resolve correctly.
 * Returns an HTML string to be loaded via blob URL in the iframe.
 */

const LIB_PACKAGES = [
  '@mapgpu/core',
  '@mapgpu/render-webgpu',
  '@mapgpu/layers',
  '@mapgpu/widgets',
  '@mapgpu/tools',
  '@mapgpu/analysis',
  '@mapgpu/terrain',
  '@mapgpu/adapters-ogc',
  '@mapgpu/tiles3d',
  '@mapgpu/milsymbol',
];

const LIB_FILE_MAP: Record<string, string> = {
  '@mapgpu/core': 'core.js',
  '@mapgpu/render-webgpu': 'render-webgpu.js',
  '@mapgpu/layers': 'layers.js',
  '@mapgpu/widgets': 'widgets.js',
  '@mapgpu/tools': 'tools.js',
  '@mapgpu/analysis': 'analysis.js',
  '@mapgpu/terrain': 'terrain.js',
  '@mapgpu/adapters-ogc': 'adapters-ogc.js',
  '@mapgpu/tiles3d': 'tiles3d.js',
  '@mapgpu/milsymbol': 'milsymbol.js',
};

function buildImportMap(origin: string): string {
  const imports: Record<string, string> = {};
  for (const pkg of LIB_PACKAGES) {
    imports[pkg] = `${origin}/playground/lib/${LIB_FILE_MAP[pkg]}`;
  }
  return JSON.stringify({ imports });
}

export function generateIframeHtml(compiledJs: string, origin: string): string {
  const importMap = buildImportMap(origin);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="referrer" content="no-referrer" />
  <script type="importmap">${importMap}</script>
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #0d1117; }
    #map-container { width: 100%; height: 100%; position: relative; }
    .playground-error-overlay {
      position: fixed; inset: 0; z-index: 9999;
      display: flex; align-items: center; justify-content: center;
      background: rgba(13, 17, 23, 0.9);
      padding: 20px;
    }
    .playground-error-overlay pre {
      max-width: 90%; max-height: 80%;
      overflow: auto; padding: 16px 20px;
      background: #1e1e2e; color: #f87171;
      border: 1px solid #7f1d1d; border-radius: 8px;
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 0.85rem; line-height: 1.5;
      white-space: pre-wrap; word-break: break-word;
    }
  </style>
</head>
<body>
  <div id="map-container"></div>
  <script type="module">
    function showError(msg) {
      window.parent.postMessage({ type: 'playground-error', message: String(msg) }, '*');
      const overlay = document.createElement('div');
      overlay.className = 'playground-error-overlay';
      overlay.innerHTML = '<pre>' + String(msg).replace(/</g, '&lt;') + '</pre>';
      document.body.appendChild(overlay);
    }

    window.addEventListener('error', (e) => showError(e.message + '\\n' + (e.filename || '') + ':' + e.lineno));
    window.addEventListener('unhandledrejection', (e) => showError('Unhandled rejection: ' + e.reason));

    console.log('[iframe] Script starting...');
    console.log('[iframe] map-container element:', document.getElementById('map-container'));
  </script>
  <script type="module">
${compiledJs}
    console.log('[iframe] User code executed successfully');
  </script>
</body>
</html>`;
}

export function generateErrorHtml(errorMessage: string): string {
  const escaped = errorMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!DOCTYPE html>
<html>
<head><style>
  body { margin: 0; background: #0d1117; color: #f87171; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: monospace; padding: 20px; }
  pre { max-width: 90%; overflow: auto; font-size: 0.85rem; line-height: 1.5; white-space: pre-wrap; }
</style></head>
<body><pre>${escaped}</pre></body>
</html>`;
}
