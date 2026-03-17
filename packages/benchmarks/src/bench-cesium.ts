const Cesium = (window as any).Cesium;

import { generateLineCoords, getLineCount } from './data-gen';
import { updateStatus, displayMetrics, saveResult, getMemoryMb, measureFps, nextAnimationFrame } from './metrics';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

async function run() {
  const lineCount = getLineCount();
  let dataGenMs = -1;
  let addLayerMs = -1;
  let firstRenderMs = -1;
  let steadyFps = -1;
  let memoryMb = -1;
  let failureStage = 'init';
  let viewer: any = null;
  let removeRenderErrorListener: (() => void) | null = null;

  try {
    // 1. Disable Ion default access — we use OSM tiles directly.
    failureStage = 'init';
    Cesium.Ion.defaultAccessToken = undefined;

    // 2. Set default initial view BEFORE Viewer creation.
    Cesium.Camera.DEFAULT_VIEW_RECTANGLE = Cesium.Rectangle.fromDegrees(26, 36, 45, 42);
    Cesium.Camera.DEFAULT_VIEW_FACTOR = 0;

    // 3. Create Cesium Viewer in 2D mode with OSM base layer.
    failureStage = 'viewer';
    viewer = new Cesium.Viewer('map', {
      sceneMode: Cesium.SceneMode.SCENE2D,
      mapProjection: new Cesium.WebMercatorProjection(),
      mapMode2D: Cesium.MapMode2D.ROTATE,
      baseLayer: new Cesium.ImageryLayer(
        new Cesium.UrlTemplateImageryProvider({
          url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          maximumLevel: 19,
        }),
      ),
      timeline: false,
      animation: false,
      geocoder: false,
      homeButton: false,
      navigationHelpButton: false,
      baseLayerPicker: false,
      sceneModePicker: false,
      fullscreenButton: false,
      selectionIndicator: false,
      infoBox: false,
    });

    viewer.clock.shouldAnimate = false;

    const ctrl = viewer.scene.screenSpaceCameraController;
    ctrl.inertiaSpin = 0;
    ctrl.inertiaTranslate = 0;
    ctrl.inertiaZoom = 0;

    await new Promise<void>((resolve) => setTimeout(resolve, 2000));

    // 4. Generate line data.
    failureStage = 'data-generation';
    updateStatus(`Generating ${lineCount.toLocaleString()} lines...`);
    const dataGenStart = performance.now();
    const lineCoords = generateLineCoords(lineCount);
    dataGenMs = performance.now() - dataGenStart;

    // 5. Build PolylineCollection with one shared material for all lines.
    failureStage = 'collection-build';
    updateStatus('Building PolylineCollection...');
    const collection = new Cesium.PolylineCollection();
    const orange = new Cesium.Color(1.0, 0.4, 0.2, 0.6);
    const lineMaterial = Cesium.Material.fromType('Color', { color: orange });

    for (let i = 0; i < lineCoords.length; i++) {
      const coords = lineCoords[i]!;
      collection.add({
        positions: Cesium.Cartesian3.fromDegreesArray(coords.flat()),
        width: 1,
        material: lineMaterial,
      });
    }

    // 6. Add primitive and wait for first render, with explicit crash detection.
    failureStage = 'add-to-scene';
    updateStatus('Adding to scene...');
    const addStart = performance.now();
    let added = false;
    let renderError: unknown = null;

    removeRenderErrorListener = viewer.scene.renderError.addEventListener((_scene: unknown, error: unknown) => {
      renderError = error;
    });

    viewer.scene.canvas.addEventListener(
      'webglcontextlost',
      (evt: Event) => {
        evt.preventDefault();
        renderError = new Error('WebGL context lost');
      },
      { once: true },
    );

    const firstRenderPromise = new Promise<void>((resolve, reject) => {
      const removePostRender = viewer.scene.postRender.addEventListener(() => {
        if (!added) return;
        if (renderError) {
          removePostRender();
          reject(renderError);
          return;
        }
        removePostRender();
        resolve();
      });
    });

    viewer.scene.primitives.add(collection);
    added = true;
    viewer.scene.requestRender();

    await nextAnimationFrame();
    if (renderError) throw renderError;
    addLayerMs = performance.now() - addStart;

    failureStage = 'first-render';
    updateStatus('Waiting for render...');
    await firstRenderPromise;
    if (renderError) throw renderError;
    firstRenderMs = performance.now() - addStart;

    // 7. Stabilization + FPS
    await new Promise<void>((resolve) => setTimeout(resolve, 2000));

    failureStage = 'fps';
    updateStatus('Measuring FPS...');
    steadyFps = await measureFps(3000);
    memoryMb = getMemoryMb();

    const metrics = {
      library: 'Cesium (2D)',
      lineCount,
      dataGenMs,
      addLayerMs,
      firstRenderMs,
      steadyFps,
      memoryMb,
      status: 'ok' as const,
    };
    saveResult(metrics);
    displayMetrics(metrics);
    updateStatus('Done!');
  } catch (error) {
    const message = getErrorMessage(error);
    updateStatus(`Failed at ${failureStage}: ${message}`);
    const metrics = {
      library: 'Cesium (2D)',
      lineCount,
      dataGenMs,
      addLayerMs,
      firstRenderMs,
      steadyFps,
      memoryMb,
      status: 'failed' as const,
      failureStage,
      error: message,
    };
    saveResult(metrics);
    displayMetrics(metrics);
  } finally {
    removeRenderErrorListener?.();
  }
}

run();
