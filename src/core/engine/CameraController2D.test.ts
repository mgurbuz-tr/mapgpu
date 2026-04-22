import { describe, it, expect } from 'vitest';
import { CameraController2D } from './CameraController2D.js';

describe('CameraController2D', () => {
  // ─── Construction ───

  it('should create with default options', () => {
    const cam = new CameraController2D();
    expect(cam.center).toEqual([0, 0]);
    expect(cam.zoom).toBe(0);
    expect(cam.rotation).toBe(0);
    expect(cam.minZoom).toBe(0);
    expect(cam.maxZoom).toBe(24);
    expect(cam.viewportWidth).toBe(800);
    expect(cam.viewportHeight).toBe(600);
  });

  it('should create with custom options', () => {
    const cam = new CameraController2D({
      center: [1000, 2000],
      zoom: 5,
      rotation: Math.PI / 4,
      minZoom: 2,
      maxZoom: 18,
      viewportWidth: 1024,
      viewportHeight: 768,
    });
    expect(cam.center).toEqual([1000, 2000]);
    expect(cam.zoom).toBe(5);
    expect(cam.rotation).toBe(Math.PI / 4);
    expect(cam.minZoom).toBe(2);
    expect(cam.maxZoom).toBe(18);
  });

  // ─── Zoom ───

  it('should clamp zoom to min/max', () => {
    const cam = new CameraController2D({ minZoom: 2, maxZoom: 10 });
    cam.setZoom(1);
    expect(cam.zoom).toBe(2);
    cam.setZoom(15);
    expect(cam.zoom).toBe(10);
    cam.setZoom(5);
    expect(cam.zoom).toBe(5);
  });

  it('zoomIn should increment zoom by 1', () => {
    const cam = new CameraController2D({ zoom: 3 });
    cam.zoomIn();
    expect(cam.zoom).toBe(4);
  });

  it('zoomOut should decrement zoom by 1', () => {
    const cam = new CameraController2D({ zoom: 3 });
    cam.zoomOut();
    expect(cam.zoom).toBe(2);
  });

  it('zoomOut should not go below minZoom', () => {
    const cam = new CameraController2D({ zoom: 0, minZoom: 0 });
    cam.zoomOut();
    expect(cam.zoom).toBe(0);
  });

  // ─── Center ───

  it('should update center', () => {
    const cam = new CameraController2D();
    cam.setCenter([5000, 10000]);
    expect(cam.center).toEqual([5000, 10000]);
  });

  it('center getter should return a copy', () => {
    const cam = new CameraController2D({ center: [100, 200] });
    const c = cam.center;
    c[0] = 999;
    expect(cam.center[0]).toBe(100);
  });

  // ─── Rotation ───

  it('should update rotation', () => {
    const cam = new CameraController2D();
    cam.setRotation(Math.PI / 2);
    expect(cam.rotation).toBe(Math.PI / 2);
  });

  // ─── Viewport ───

  it('should update viewport', () => {
    const cam = new CameraController2D();
    cam.setViewport(1920, 1080);
    expect(cam.viewportWidth).toBe(1920);
    expect(cam.viewportHeight).toBe(1080);
  });

  // ─── Dirty ───

  it('should start dirty', () => {
    const cam = new CameraController2D();
    expect(cam.dirty).toBe(true);
  });

  it('should be dirty after state change', () => {
    const cam = new CameraController2D();
    cam.clearDirty();
    expect(cam.dirty).toBe(false);
    cam.setZoom(5);
    expect(cam.dirty).toBe(true);
  });

  it('should clear dirty', () => {
    const cam = new CameraController2D();
    cam.clearDirty();
    expect(cam.dirty).toBe(false);
  });

  // ─── Extent ───

  it('should compute extent without rotation', () => {
    const cam = new CameraController2D({
      center: [0, 0],
      zoom: 0,
      viewportWidth: 256,
      viewportHeight: 256,
    });
    const ext = cam.getExtent();
    expect(ext.spatialReference).toBe('EPSG:3857');
    // At zoom 0, 256 pixels = full world
    // resolution = 40075016.68... / 256 = 156543.03...
    // halfW = 128 * resolution = 20037508.34...
    expect(ext.minX).toBeCloseTo(-20037508.342789244, 0);
    expect(ext.maxX).toBeCloseTo(20037508.342789244, 0);
    expect(ext.minY).toBeCloseTo(-20037508.342789244, 0);
    expect(ext.maxY).toBeCloseTo(20037508.342789244, 0);
  });

  it('should compute extent with rotation (bounding box)', () => {
    const cam = new CameraController2D({
      center: [0, 0],
      zoom: 10,
      rotation: Math.PI / 4, // 45 degrees
      viewportWidth: 512,
      viewportHeight: 512,
    });
    const ext = cam.getExtent();

    // With 45-degree rotation, the bbox should be larger than without rotation
    const cam2 = new CameraController2D({
      center: [0, 0],
      zoom: 10,
      rotation: 0,
      viewportWidth: 512,
      viewportHeight: 512,
    });
    const ext2 = cam2.getExtent();

    // Rotated extent should be wider/taller (bounding box of rotated rectangle)
    expect(ext.maxX - ext.minX).toBeGreaterThan(ext2.maxX - ext2.minX);
  });

  // ─── Screen ↔ Map ───

  it('should round-trip screenToMap and mapToScreen', () => {
    const cam = new CameraController2D({
      center: [1000000, 2000000],
      zoom: 10,
      viewportWidth: 800,
      viewportHeight: 600,
    });

    const screenX = 300;
    const screenY = 200;
    const [mx, my] = cam.screenToMap(screenX, screenY);
    const [sx, sy] = cam.mapToScreen(mx, my);

    expect(sx).toBeCloseTo(screenX, 5);
    expect(sy).toBeCloseTo(screenY, 5);
  });

  it('screen center should map to camera center', () => {
    const cam = new CameraController2D({
      center: [5000000, 3000000],
      zoom: 8,
      viewportWidth: 800,
      viewportHeight: 600,
    });

    const [mx, my] = cam.screenToMap(400, 300);
    expect(mx).toBeCloseTo(5000000, 0);
    expect(my).toBeCloseTo(3000000, 0);
  });

  it('should round-trip with rotation', () => {
    const cam = new CameraController2D({
      center: [500000, 600000],
      zoom: 12,
      rotation: Math.PI / 6,
      viewportWidth: 1024,
      viewportHeight: 768,
    });

    const [mx, my] = cam.screenToMap(200, 300);
    const [sx, sy] = cam.mapToScreen(mx, my);

    expect(sx).toBeCloseTo(200, 4);
    expect(sy).toBeCloseTo(300, 4);
  });

  // ─── Matrices ───

  it('should produce valid viewMatrix and projectionMatrix', () => {
    const cam = new CameraController2D({ zoom: 5 });
    expect(cam.viewMatrix.length).toBe(16);
    expect(cam.projectionMatrix.length).toBe(16);
    // Projection should have non-zero diagonal
    expect(cam.projectionMatrix[0]).not.toBe(0);
    expect(cam.projectionMatrix[5]).not.toBe(0);
  });
});
