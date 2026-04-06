/**
 * Fetches bundled .d.ts type definitions and registers them with Monaco
 * for IntelliSense support on @mapgpu/* imports.
 */

import type { Monaco } from '@monaco-editor/react';

type TypeManifest = Record<string, Record<string, string>>;

let cachedManifest: TypeManifest | null = null;

export async function loadTypeDefinitions(monaco: Monaco): Promise<void> {
  if (!cachedManifest) {
    try {
      const res = await fetch('/playground/types-manifest.json');
      if (!res.ok) {
        console.warn('[type-registry] Failed to fetch type manifest:', res.status);
        return;
      }
      cachedManifest = await res.json();
    } catch (err) {
      console.warn('[type-registry] Error loading types:', err);
      return;
    }
  }

  const tsDefaults = monaco.languages.typescript.typescriptDefaults;

  // Configure compiler options — NodeNext resolution is critical for @mapgpu/* imports
  tsDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    strict: true,
    esModuleInterop: true,
    allowNonTsExtensions: true,
    lib: ['es2022', 'dom', 'dom.iterable'],
    jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
  });

  tsDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  });

  // Register type definitions for each package
  for (const [pkgName, files] of Object.entries(cachedManifest!)) {
    tsDefaults.addExtraLib(
      JSON.stringify({ name: pkgName, types: './index.d.ts', main: './index.js' }),
      `file:///node_modules/${pkgName}/package.json`,
    );

    for (const [filePath, content] of Object.entries(files)) {
      tsDefaults.addExtraLib(content, `file:///node_modules/${pkgName}/${filePath}`);
    }
  }
}
