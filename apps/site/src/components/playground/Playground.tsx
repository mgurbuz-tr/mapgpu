import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import type { Monaco } from '@monaco-editor/react';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

const IMPORT_MAP = {
  imports: {
    '@mapgpu/core': '/playground/lib/core.js',
    '@mapgpu/render-webgpu': '/playground/lib/render-webgpu.js',
    '@mapgpu/layers': '/playground/lib/layers.js',
    '@mapgpu/widgets': '/playground/lib/widgets.js',
    '@mapgpu/tools': '/playground/lib/tools.js',
    '@mapgpu/analysis': '/playground/lib/analysis.js',
    '@mapgpu/terrain': '/playground/lib/terrain.js',
    '@mapgpu/adapters-ogc': '/playground/lib/adapters-ogc.js',
    '@mapgpu/tiles3d': '/playground/lib/tiles3d.js',
    '@mapgpu/milsymbol': '/playground/lib/milsymbol.js',
  },
};

interface PlaygroundProps {
  initialCode: string;
  title: string;
  hidePreview?: boolean;
}

export default function Playground({ initialCode, title, hidePreview }: PlaygroundProps) {
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [monacoReady, setMonacoReady] = useState(false);
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('preview');
  const [splitRatio, setSplitRatio] = useState(50);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const runKeyRef = useRef(0);

  // Transpile TS to JS using Monaco's built-in TypeScript worker
  const transpile = useCallback(async (tsCode: string): Promise<string> => {
    const monaco = monacoRef.current;
    if (!monaco) {
      console.warn('[playground] Monaco not available for transpile');
      return tsCode;
    }

    try {
      const uri = monaco.Uri.parse('file:///playground.tsx');
      let model = monaco.editor.getModel(uri);
      if (!model) {
        model = monaco.editor.createModel(tsCode, 'typescript', uri);
      } else {
        model.setValue(tsCode);
      }

      const worker = await monaco.languages.typescript.getTypeScriptWorker();
      const client = await worker(uri);
      const output = await client.getEmitOutput(uri.toString());

      if (output.outputFiles.length > 0) {
        return output.outputFiles[0].text;
      }
      return tsCode;
    } catch (err) {
      console.error('[playground] Transpile error:', err);
      return tsCode;
    }
  }, []);

  // Run code by reloading the runner iframe and sending code via postMessage
  const runCode = useCallback(async (codeToRun: string) => {
    setIsRunning(true);
    setError(null);

    try {
      const js = await transpile(codeToRun);
      const key = ++runKeyRef.current;

      // Listen for ready signal from new iframe
      const onMessage = (e: MessageEvent) => {
        if (key !== runKeyRef.current) return; // stale
        if (e.data?.type === 'playground-ready' && iframeRef.current?.contentWindow) {
          window.removeEventListener('message', onMessage);
          iframeRef.current.contentWindow.postMessage({
            type: 'playground-run',
            code: js,
            importMap: IMPORT_MAP,
          }, '*');
          setIsRunning(false);
        }
        if (e.data?.type === 'playground-error') {
          setError(e.data.message);
        }
      };
      window.addEventListener('message', onMessage);

      // Reload iframe to fresh runner page
      if (iframeRef.current) {
        iframeRef.current.src = '/playground/runner.html';
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setIsRunning(false);
    }
  }, [transpile]);

  // Run when Monaco becomes ready
  useEffect(() => {
    if (monacoReady) {
      runCode(initialCode);
    }
  }, [monacoReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for runtime errors from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'playground-error') {
        setError(e.data.message);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleRun = useCallback(() => runCode(code), [code, runCode]);
  const handleReset = useCallback(() => {
    setCode(initialCode);
    setError(null);
    runCode(initialCode);
  }, [initialCode, runCode]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).catch(() => {});
  }, [code]);

  const handleMonacoMount = useCallback(async (_editor: unknown, monaco: Monaco) => {
    monacoRef.current = monaco;

    // Always set compiler options — needed for top-level await and ESM emit
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      strict: true,
      esModuleInterop: true,
      allowNonTsExtensions: true,
      lib: ['esnext', 'dom', 'dom.iterable'],
      jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
    });

    try {
      const { loadTypeDefinitions } = await import('../../lib/sandbox/type-registry');
      await loadTypeDefinitions(monaco);
    } catch {
      // Type definitions are optional — editor still works without IntelliSense
    }

    // Force editor to re-validate after types are loaded
    // Monaco needs a model "touch" to pick up new extraLibs
    monaco.editor.getModels().forEach((model) => {
      const value = model.getValue();
      model.setValue(value + ' ');
      model.setValue(value);
    });

    setMonacoReady(true);
  }, []);

  // Drag handle for split pane
  const handleMouseDown = useCallback(() => { isDragging.current = true; }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !splitRef.current) return;
      const rect = splitRef.current.getBoundingClientRect();
      const ratio = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitRatio(Math.min(80, Math.max(20, ratio)));
    };
    const handleMouseUp = () => { isDragging.current = false; };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Keyboard shortcut: Ctrl/Cmd + Enter to run
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleRun]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className="playground">
      <div className="playground-toolbar">
        <span className="playground-title">{title}</span>
        <div className="playground-actions">
          <button
            className="pg-btn pg-btn-primary"
            onClick={handleRun}
            disabled={isRunning}
            title="Run (Ctrl+Enter)"
          >
            {isRunning ? 'Running...' : 'Run'}
          </button>
          <button className="pg-btn" onClick={handleReset} title="Reset to original">Reset</button>
          <button className="pg-btn" onClick={handleCopy} title="Copy code">Copy</button>
        </div>

        {isMobile && (
          <div className="mobile-tabs">
            <button
              className={`mobile-tab ${activeTab === 'code' ? 'active' : ''}`}
              onClick={() => setActiveTab('code')}
            >Code</button>
            <button
              className={`mobile-tab ${activeTab === 'preview' ? 'active' : ''}`}
              onClick={() => setActiveTab('preview')}
            >Preview</button>
          </div>
        )}
      </div>

      {error && (
        <div className="playground-error">
          <span>{error}</span>
          <button onClick={() => setError(null)}>x</button>
        </div>
      )}

      <div className="playground-panels" ref={splitRef}>
        <div
          className="playground-editor"
          style={{
            width: isMobile || hidePreview ? '100%' : `${splitRatio}%`,
            display: isMobile && activeTab !== 'code' ? 'none' : undefined,
          }}
        >
          <Suspense fallback={<EditorSkeleton />}>
            <MonacoEditor
              height="100%"
              language="typescript"
              theme="vs-dark"
              path="file:///playground.tsx"
              value={code}
              onChange={(v) => setCode(v ?? '')}
              onMount={handleMonacoMount}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                tabSize: 2,
                automaticLayout: true,
                padding: { top: 12 },
              }}
            />
          </Suspense>
        </div>

        {!hidePreview && !isMobile && (
          <div className="playground-divider" onMouseDown={handleMouseDown} />
        )}

        {!hidePreview && (
          <div
            className="playground-preview"
            style={{
              width: isMobile ? '100%' : `${100 - splitRatio}%`,
              display: isMobile && activeTab !== 'preview' ? 'none' : undefined,
            }}
          >
            <iframe
              ref={iframeRef}
              className="playground-iframe"
              title="Preview"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function EditorSkeleton() {
  return (
    <div className="editor-skeleton">
      <div className="skeleton-line" style={{ width: '60%' }} />
      <div className="skeleton-line" style={{ width: '80%' }} />
      <div className="skeleton-line" style={{ width: '45%' }} />
      <div className="skeleton-line" style={{ width: '70%' }} />
      <div className="skeleton-line" style={{ width: '55%' }} />
      <p className="skeleton-text">Loading editor...</p>
    </div>
  );
}
