// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InteractionHandler } from './InteractionHandler.js';
import { CameraController2D } from './CameraController2D.js';

function createTestCamera() {
  return new CameraController2D({
    center: [0, 0],
    zoom: 10,
    viewportWidth: 800,
    viewportHeight: 600,
  });
}

function createContainer(): HTMLElement {
  const el = document.createElement('div');
  // Mock getBoundingClientRect
  el.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  // Mock setPointerCapture / releasePointerCapture
  el.setPointerCapture = vi.fn();
  el.releasePointerCapture = vi.fn();
  document.body.appendChild(el);
  return el;
}

function pointerEvent(type: string, opts: Partial<PointerEvent> = {}): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    clientX: 0,
    clientY: 0,
    pointerId: 1,
    ...opts,
  });
}

describe('InteractionHandler', () => {
  let container: HTMLElement;
  let camera: CameraController2D;
  let onDirty: ReturnType<typeof vi.fn>;
  let onViewChange: ReturnType<typeof vi.fn>;
  let handler: InteractionHandler;

  beforeEach(() => {
    container = createContainer();
    camera = createTestCamera();
    onDirty = vi.fn();
    onViewChange = vi.fn();
  });

  afterEach(() => {
    handler?.destroy();
    container.remove();
  });

  describe('pan (drag)', () => {
    it('should pan camera on pointer drag', () => {
      handler = new InteractionHandler(container, camera, onDirty, onViewChange, {
        inertiaDuration: 0, // disable inertia for predictable test
      });

      const initialCenter = camera.center;

      // Pointer down at (400, 300)
      container.dispatchEvent(pointerEvent('pointerdown', { clientX: 400, clientY: 300 }));

      // Drag to (410, 300) — 10px right
      container.dispatchEvent(pointerEvent('pointermove', { clientX: 410, clientY: 300 }));

      // Center should have moved left (opposite of drag direction)
      const newCenter = camera.center;
      expect(newCenter[0]).toBeLessThan(initialCenter[0]);
      // Y should be unchanged
      expect(newCenter[1]).toBeCloseTo(initialCenter[1], 0);

      expect(onDirty).toHaveBeenCalled();
      expect(onViewChange).toHaveBeenCalled();
    });

    it('should not pan when pan is disabled', () => {
      handler = new InteractionHandler(container, camera, onDirty, onViewChange, {
        pan: false,
      });

      const initialCenter = camera.center;

      container.dispatchEvent(pointerEvent('pointerdown', { clientX: 400, clientY: 300 }));
      container.dispatchEvent(pointerEvent('pointermove', { clientX: 500, clientY: 300 }));

      expect(camera.center[0]).toEqual(initialCenter[0]);
      expect(camera.center[1]).toEqual(initialCenter[1]);
    });

    it('should stop dragging on pointer up', () => {
      handler = new InteractionHandler(container, camera, onDirty, onViewChange, {
        inertiaDuration: 0,
      });

      container.dispatchEvent(pointerEvent('pointerdown', { clientX: 400, clientY: 300 }));
      container.dispatchEvent(pointerEvent('pointerup', { clientX: 410, clientY: 300 }));

      onDirty.mockClear();
      // Move after release — should not pan
      container.dispatchEvent(pointerEvent('pointermove', { clientX: 500, clientY: 300 }));
      expect(onDirty).not.toHaveBeenCalled();
    });
  });

  describe('wheel zoom', () => {
    it('should zoom in on wheel scroll up', () => {
      handler = new InteractionHandler(container, camera, onDirty, onViewChange);

      const initialZoom = camera.zoom;

      // Wheel up (negative deltaY = zoom in)
      const wheelEvent = new WheelEvent('wheel', {
        deltaY: -100,
        clientX: 400,
        clientY: 300,
        bubbles: true,
        cancelable: true,
      });
      container.dispatchEvent(wheelEvent);

      expect(camera.zoom).toBeGreaterThan(initialZoom);
      expect(onDirty).toHaveBeenCalled();
    });

    it('should zoom out on wheel scroll down', () => {
      handler = new InteractionHandler(container, camera, onDirty, onViewChange);

      const initialZoom = camera.zoom;

      const wheelEvent = new WheelEvent('wheel', {
        deltaY: 100,
        clientX: 400,
        clientY: 300,
        bubbles: true,
        cancelable: true,
      });
      container.dispatchEvent(wheelEvent);

      expect(camera.zoom).toBeLessThan(initialZoom);
      expect(onDirty).toHaveBeenCalled();
    });

    it('should not zoom when zoom is disabled', () => {
      handler = new InteractionHandler(container, camera, onDirty, onViewChange, {
        zoom: false,
      });

      const initialZoom = camera.zoom;

      const wheelEvent = new WheelEvent('wheel', {
        deltaY: -100,
        clientX: 400,
        clientY: 300,
        bubbles: true,
        cancelable: true,
      });
      container.dispatchEvent(wheelEvent);

      expect(camera.zoom).toEqual(initialZoom);
    });

    it('should zoom to cursor position (not screen center)', () => {
      handler = new InteractionHandler(container, camera, onDirty, onViewChange);

      // Place cursor at top-left corner
      const mapBefore = camera.screenToMap(100, 100);

      const wheelEvent = new WheelEvent('wheel', {
        deltaY: -500, // strong zoom in
        clientX: 100,
        clientY: 100,
        bubbles: true,
        cancelable: true,
      });
      container.dispatchEvent(wheelEvent);

      // After zoom, the point under cursor should be approximately the same
      const mapAfter = camera.screenToMap(100, 100);
      expect(mapAfter[0]).toBeCloseTo(mapBefore[0], -2);
      expect(mapAfter[1]).toBeCloseTo(mapBefore[1], -2);
    });
  });

  describe('keyboard', () => {
    it('should zoom in with + key', () => {
      handler = new InteractionHandler(container, camera, onDirty, onViewChange);

      const initialZoom = camera.zoom;
      container.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));

      expect(camera.zoom).toBe(initialZoom + 1);
      expect(onDirty).toHaveBeenCalled();
    });

    it('should zoom out with - key', () => {
      handler = new InteractionHandler(container, camera, onDirty, onViewChange);

      const initialZoom = camera.zoom;
      container.dispatchEvent(new KeyboardEvent('keydown', { key: '-', bubbles: true }));

      expect(camera.zoom).toBe(initialZoom - 1);
    });

    it('should pan with arrow keys', () => {
      handler = new InteractionHandler(container, camera, onDirty, onViewChange);

      const initialCenter = camera.center;

      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      expect(camera.center[0]).toBeGreaterThan(initialCenter[0]);

      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      expect(camera.center[1]).toBeGreaterThan(initialCenter[1]);
    });

    it('should not handle keyboard when disabled', () => {
      handler = new InteractionHandler(container, camera, onDirty, onViewChange, {
        keyboard: false,
      });

      const initialZoom = camera.zoom;
      container.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
      expect(camera.zoom).toBe(initialZoom);
    });
  });

  describe('double-click zoom', () => {
    it('should zoom in on double-click', () => {
      handler = new InteractionHandler(container, camera, onDirty, onViewChange, {
        inertiaDuration: 0,
      });

      const initialZoom = camera.zoom;

      // First click
      container.dispatchEvent(pointerEvent('pointerdown', {
        clientX: 400,
        clientY: 300,
        pointerId: 1,
      }));
      container.dispatchEvent(pointerEvent('pointerup', {
        clientX: 400,
        clientY: 300,
        pointerId: 1,
      }));

      // Second click (rapid)
      container.dispatchEvent(pointerEvent('pointerdown', {
        clientX: 400,
        clientY: 300,
        pointerId: 1,
      }));

      expect(camera.zoom).toBe(initialZoom + 1);
    });
  });

  describe('touch-action CSS', () => {
    it('should set touch-action: none on element', () => {
      handler = new InteractionHandler(container, camera, onDirty, onViewChange);
      expect(container.style.touchAction).toBe('none');
    });
  });

  describe('destroy', () => {
    it('should stop responding to events after destroy', () => {
      handler = new InteractionHandler(container, camera, onDirty, onViewChange);
      handler.destroy();

      const initialZoom = camera.zoom;
      const wheelEvent = new WheelEvent('wheel', {
        deltaY: -100,
        clientX: 400,
        clientY: 300,
        bubbles: true,
        cancelable: true,
      });
      container.dispatchEvent(wheelEvent);
      expect(camera.zoom).toEqual(initialZoom);
    });

    it('should be safe to call destroy multiple times', () => {
      handler = new InteractionHandler(container, camera, onDirty, onViewChange);
      handler.destroy();
      handler.destroy(); // Should not throw
    });
  });

  describe('pointer capture', () => {
    it('should call setPointerCapture on pointerdown', () => {
      handler = new InteractionHandler(container, camera, onDirty, onViewChange);

      container.dispatchEvent(pointerEvent('pointerdown', {
        clientX: 400,
        clientY: 300,
        pointerId: 42,
      }));

      expect(container.setPointerCapture).toHaveBeenCalledWith(42);
    });
  });
});
