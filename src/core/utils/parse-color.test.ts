import { describe, it, expect } from 'vitest';
import { parseColor } from './parse-color.js';

describe('parseColor', () => {
  describe('named colors', () => {
    it('resolves "transparent" to [0,0,0,0]', () => {
      expect(parseColor('transparent')).toEqual([0, 0, 0, 0]);
    });

    it('resolves "black" and "white"', () => {
      expect(parseColor('black')).toEqual([0, 0, 0, 1]);
      expect(parseColor('white')).toEqual([1, 1, 1, 1]);
    });

    it('is case-insensitive for named colors', () => {
      expect(parseColor('TRANSPARENT')).toEqual([0, 0, 0, 0]);
      expect(parseColor('Red')).toEqual([1, 0, 0, 1]);
    });

    it('trims surrounding whitespace', () => {
      expect(parseColor('  black  ')).toEqual([0, 0, 0, 1]);
    });
  });

  describe('hex', () => {
    it('parses #rgb', () => {
      const [r, g, b, a] = parseColor('#fff');
      expect(r).toBeCloseTo(1);
      expect(g).toBeCloseTo(1);
      expect(b).toBeCloseTo(1);
      expect(a).toBe(1);
    });

    it('parses #rrggbb', () => {
      const [r, g, b, a] = parseColor('#ff0000');
      expect(r).toBe(1);
      expect(g).toBe(0);
      expect(b).toBe(0);
      expect(a).toBe(1);
    });

    it('parses #rrggbbaa with alpha', () => {
      const [, , , a] = parseColor('#ffffff80');
      expect(a).toBeCloseTo(128 / 255, 5);
    });

    it('parses #rgba short form with alpha', () => {
      const [r, g, b, a] = parseColor('#f008');
      expect(r).toBe(1);
      expect(g).toBe(0);
      expect(b).toBe(0);
      expect(a).toBeCloseTo(0x88 / 255, 5);
    });

    it('parses #rrggbbaa with zero alpha', () => {
      expect(parseColor('#00000000')).toEqual([0, 0, 0, 0]);
    });

    it('throws on invalid hex length', () => {
      expect(() => parseColor('#ff')).toThrow(/hex/);
      expect(() => parseColor('#fffff')).toThrow(/hex/);
    });

    it('throws on non-hex characters', () => {
      expect(() => parseColor('#zzzzzz')).toThrow(/invalid hex/i);
    });
  });

  describe('rgb() / rgba()', () => {
    it('parses rgb()', () => {
      const [r, g, b, a] = parseColor('rgb(255, 0, 0)');
      expect(r).toBe(1);
      expect(g).toBe(0);
      expect(b).toBe(0);
      expect(a).toBe(1);
    });

    it('parses rgba() with alpha 0-1', () => {
      expect(parseColor('rgba(0, 0, 0, 0)')).toEqual([0, 0, 0, 0]);
      expect(parseColor('rgba(255, 255, 255, 0.5)')).toEqual([1, 1, 1, 0.5]);
    });

    it('parses rgba() with alpha in 0-255 range', () => {
      const [, , , a] = parseColor('rgba(255, 255, 255, 128)');
      expect(a).toBeCloseTo(128 / 255, 5);
    });

    it('accepts percentage alpha', () => {
      expect(parseColor('rgba(255, 255, 255, 50%)')[3]).toBe(0.5);
    });

    it('accepts whitespace-separated form', () => {
      expect(parseColor('rgb(255 0 0)')).toEqual([1, 0, 0, 1]);
      const whiteHalf = parseColor('rgba(255 255 255 / 0.5)');
      expect(whiteHalf).toEqual([1, 1, 1, 0.5]);
    });

    it('clamps values to 0-1', () => {
      const [r] = parseColor('rgb(999, 0, 0)');
      expect(r).toBe(1);
    });

    it('throws on wrong number of arguments', () => {
      expect(() => parseColor('rgb(1, 2)')).toThrow(/expected/);
      expect(() => parseColor('rgba(1, 2, 3)')).toThrow(/expected/);
    });

    it('throws on non-numeric channels', () => {
      expect(() => parseColor('rgb(a, b, c)')).toThrow(/invalid/);
    });
  });

  describe('tuple passthrough', () => {
    it('passes through a valid tuple', () => {
      expect(parseColor([0.1, 0.2, 0.3, 0.4])).toEqual([0.1, 0.2, 0.3, 0.4]);
    });

    it('passes through transparent tuple', () => {
      expect(parseColor([0, 0, 0, 0])).toEqual([0, 0, 0, 0]);
    });

    it('throws on tuple of wrong length', () => {
      expect(() => parseColor([0, 0, 0] as unknown as [number, number, number, number])).toThrow();
    });

    it('throws on non-finite tuple channels', () => {
      expect(() => parseColor([NaN, 0, 0, 1])).toThrow(/finite/);
    });
  });

  describe('invalid input', () => {
    it('throws on empty string', () => {
      expect(() => parseColor('')).toThrow(/empty/);
    });

    it('throws on garbage string', () => {
      expect(() => parseColor('not-a-color')).toThrow(/unrecognized/);
    });

    it('throws on wrong type', () => {
      expect(() => parseColor(42 as unknown as string)).toThrow();
      expect(() => parseColor(null as unknown as string)).toThrow();
    });
  });
});
