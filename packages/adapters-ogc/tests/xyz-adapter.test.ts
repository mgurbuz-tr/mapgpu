import { describe, it, expect } from 'vitest';
import { XyzAdapter } from '../src/xyz/xyz-adapter.js';

describe('XYZ Tile Adapter', () => {
  describe('Standard XYZ URL', () => {
    it('should generate correct tile URL with {z}/{x}/{y} template', () => {
      const adapter = new XyzAdapter({
        urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      });

      expect(adapter.getTileUrl(10, 550, 335)).toBe(
        'https://tile.openstreetmap.org/10/550/335.png',
      );
    });

    it('should handle zoom level 0', () => {
      const adapter = new XyzAdapter({
        urlTemplate: 'https://tiles.example.com/{z}/{x}/{y}.png',
      });

      expect(adapter.getTileUrl(0, 0, 0)).toBe(
        'https://tiles.example.com/0/0/0.png',
      );
    });

    it('should handle high zoom levels', () => {
      const adapter = new XyzAdapter({
        urlTemplate: 'https://tiles.example.com/{z}/{x}/{y}.png',
      });

      expect(adapter.getTileUrl(18, 137543, 89201)).toBe(
        'https://tiles.example.com/18/137543/89201.png',
      );
    });
  });

  describe('TMS y-flip', () => {
    it('should flip y-coordinate for TMS template ({-y})', () => {
      const adapter = new XyzAdapter({
        urlTemplate: 'https://tms.example.com/{z}/{x}/{-y}.png',
      });

      // TMS y = 2^z - 1 - y
      // At zoom 10: tmsY = 1023 - 335 = 688
      expect(adapter.getTileUrl(10, 550, 335)).toBe(
        'https://tms.example.com/10/550/688.png',
      );
    });

    it('should flip y at zoom level 0', () => {
      const adapter = new XyzAdapter({
        urlTemplate: 'https://tms.example.com/{z}/{x}/{-y}.png',
      });

      // At zoom 0: tmsY = 0 - 0 = 0
      expect(adapter.getTileUrl(0, 0, 0)).toBe(
        'https://tms.example.com/0/0/0.png',
      );
    });

    it('should flip y at zoom level 1', () => {
      const adapter = new XyzAdapter({
        urlTemplate: 'https://tms.example.com/{z}/{x}/{-y}.png',
      });

      // At zoom 1: 2^1 - 1 - 0 = 1
      expect(adapter.getTileUrl(1, 0, 0)).toBe(
        'https://tms.example.com/1/0/1.png',
      );

      // At zoom 1: 2^1 - 1 - 1 = 0
      expect(adapter.getTileUrl(1, 1, 1)).toBe(
        'https://tms.example.com/1/1/0.png',
      );
    });
  });

  describe('Options', () => {
    it('should expose minZoom and maxZoom defaults', () => {
      const adapter = new XyzAdapter({
        urlTemplate: 'https://tiles.example.com/{z}/{x}/{y}.png',
      });

      expect(adapter.minZoom).toBe(0);
      expect(adapter.maxZoom).toBe(22);
    });

    it('should accept custom minZoom and maxZoom', () => {
      const adapter = new XyzAdapter({
        urlTemplate: 'https://tiles.example.com/{z}/{x}/{y}.png',
        minZoom: 3,
        maxZoom: 18,
      });

      expect(adapter.minZoom).toBe(3);
      expect(adapter.maxZoom).toBe(18);
    });
  });
});
