import { describe, it, expect, vi } from 'vitest';
import { svgToImageBitmap } from './svg-utils.js';

describe('svgToImageBitmap', () => {
  it('is a function export', () => {
    expect(typeof svgToImageBitmap).toBe('function');
  });

  it('calls Blob with svg+xml type and createImageBitmap with resize options', async () => {
    const fakeBitmap = { width: 32, height: 32, close: vi.fn() };

    // Mock browser globals
    const origBlob = globalThis.Blob;
    const origCreateImageBitmap = globalThis.createImageBitmap;

    let capturedBlobArgs: unknown[] = [];
    const MockBlob = vi.fn((...args: unknown[]) => {
      capturedBlobArgs = args;
      return { __mockBlob: true };
    });
    globalThis.Blob = MockBlob as unknown as typeof Blob;
    globalThis.createImageBitmap = vi.fn().mockResolvedValue(fakeBitmap);

    try {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle r="30"/></svg>';
      const result = await svgToImageBitmap(svg, 32, 32);

      // Verify Blob was created with svg content and correct type
      expect(MockBlob).toHaveBeenCalledOnce();
      expect(capturedBlobArgs[0]).toEqual([svg]);
      expect(capturedBlobArgs[1]).toEqual({ type: 'image/svg+xml' });

      // Verify createImageBitmap was called with the blob and resize options
      expect(globalThis.createImageBitmap).toHaveBeenCalledWith(
        { __mockBlob: true },
        { resizeWidth: 32, resizeHeight: 32 },
      );

      expect(result).toBe(fakeBitmap);
    } finally {
      // Restore globals
      globalThis.Blob = origBlob;
      globalThis.createImageBitmap = origCreateImageBitmap;
    }
  });

  it('propagates errors from createImageBitmap', async () => {
    const origBlob = globalThis.Blob;
    const origCreateImageBitmap = globalThis.createImageBitmap;

    globalThis.Blob = vi.fn().mockReturnValue({}) as unknown as typeof Blob;
    globalThis.createImageBitmap = vi.fn().mockRejectedValue(new Error('decode failed'));

    try {
      await expect(svgToImageBitmap('<svg/>', 16, 16)).rejects.toThrow('decode failed');
    } finally {
      globalThis.Blob = origBlob;
      globalThis.createImageBitmap = origCreateImageBitmap;
    }
  });
});
