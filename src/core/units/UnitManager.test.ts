import { describe, it, expect, vi } from 'vitest';
import { UnitManager } from './UnitManager.js';

describe('UnitManager', () => {
  // ─── Constructor defaults ───

  it('has default values', () => {
    const um = new UnitManager();
    expect(um.distanceUnit).toBe('metric');
    expect(um.areaUnit).toBe('metric');
    expect(um.coordinateFormat).toBe('DD');
  });

  it('accepts custom options', () => {
    const um = new UnitManager({
      distanceUnit: 'imperial',
      areaUnit: 'imperial',
      coordinateFormat: 'DMS',
    });
    expect(um.distanceUnit).toBe('imperial');
    expect(um.areaUnit).toBe('imperial');
    expect(um.coordinateFormat).toBe('DMS');
  });

  // ─── Events ───

  it('emits units-change on distanceUnit change', () => {
    const um = new UnitManager();
    const handler = vi.fn();
    um.on('units-change', handler);
    um.distanceUnit = 'imperial';
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({
      distanceUnit: 'imperial',
      areaUnit: 'metric',
      coordinateFormat: 'DD',
    });
  });

  it('does not emit if same value set', () => {
    const um = new UnitManager();
    const handler = vi.fn();
    um.on('units-change', handler);
    um.distanceUnit = 'metric'; // same as default
    expect(handler).not.toHaveBeenCalled();
  });

  it('emits units-change on areaUnit change', () => {
    const um = new UnitManager();
    const handler = vi.fn();
    um.on('units-change', handler);
    um.areaUnit = 'imperial';
    expect(handler).toHaveBeenCalledOnce();
  });

  it('emits units-change on coordinateFormat change', () => {
    const um = new UnitManager();
    const handler = vi.fn();
    um.on('units-change', handler);
    um.coordinateFormat = 'DMS';
    expect(handler).toHaveBeenCalledOnce();
  });

  it('off removes handler', () => {
    const um = new UnitManager();
    const handler = vi.fn();
    um.on('units-change', handler);
    um.off('units-change', handler);
    um.distanceUnit = 'imperial';
    expect(handler).not.toHaveBeenCalled();
  });

  it('destroy cleans up', () => {
    const um = new UnitManager();
    const handler = vi.fn();
    um.on('units-change', handler);
    um.destroy();
    um.distanceUnit = 'imperial';
    expect(handler).not.toHaveBeenCalled();
  });

  // ─── formatDistance ───

  describe('formatDistance', () => {
    it('metric: meters below 1000', () => {
      const um = new UnitManager({ distanceUnit: 'metric' });
      expect(um.formatDistance(500)).toBe('500 m');
    });

    it('metric: kilometers above 1000', () => {
      const um = new UnitManager({ distanceUnit: 'metric' });
      expect(um.formatDistance(1500)).toBe('1.50 km');
    });

    it('metric: exact 1000 threshold', () => {
      const um = new UnitManager({ distanceUnit: 'metric' });
      expect(um.formatDistance(1000)).toBe('1.00 km');
    });

    it('imperial: feet below mile', () => {
      const um = new UnitManager({ distanceUnit: 'imperial' });
      expect(um.formatDistance(100)).toBe('328 ft');
    });

    it('imperial: miles above threshold', () => {
      const um = new UnitManager({ distanceUnit: 'imperial' });
      // 5280 ft = 1 mile, 1 mile ≈ 1609.34 m
      expect(um.formatDistance(3000)).toMatch(/^\d+\.\d{2} mi$/);
    });

    it('nautical: meters below 1852', () => {
      const um = new UnitManager({ distanceUnit: 'nautical' });
      expect(um.formatDistance(1000)).toBe('1000 m');
    });

    it('nautical: nmi above 1852', () => {
      const um = new UnitManager({ distanceUnit: 'nautical' });
      expect(um.formatDistance(5556)).toBe('3.00 nmi');
    });
  });

  // ─── formatArea ───

  describe('formatArea', () => {
    it('metric: square meters below 1M', () => {
      const um = new UnitManager({ areaUnit: 'metric' });
      expect(um.formatArea(50000)).toBe('50000 m²');
    });

    it('metric: square km above 1M', () => {
      const um = new UnitManager({ areaUnit: 'metric' });
      expect(um.formatArea(2_500_000)).toBe('2.50 km²');
    });

    it('imperial: square feet below acre', () => {
      const um = new UnitManager({ areaUnit: 'imperial' });
      // 100 m² * 10.7639 = 1076 sq ft
      expect(um.formatArea(100)).toBe('1076 sq ft');
    });

    it('imperial: acres above threshold', () => {
      const um = new UnitManager({ areaUnit: 'imperial' });
      // 43560 sq ft = 1 acre, 1 acre ≈ 4046.86 m²
      expect(um.formatArea(10000)).toMatch(/^\d+\.\d{2} acres$/);
    });
  });

  // ─── formatCoordinate ───

  describe('formatCoordinate', () => {
    it('DD format', () => {
      const um = new UnitManager({ coordinateFormat: 'DD' });
      const result = um.formatCoordinate(29.0784, 41.0082);
      expect(result).toContain('29.0784');
      expect(result).toContain('E');
      expect(result).toContain('41.0082');
      expect(result).toContain('N');
    });

    it('DD format negative longitude', () => {
      const um = new UnitManager({ coordinateFormat: 'DD' });
      const result = um.formatCoordinate(-73.9857, 40.7484);
      expect(result).toContain('W');
      expect(result).toContain('N');
    });

    it('DMS format', () => {
      const um = new UnitManager({ coordinateFormat: 'DMS' });
      const result = um.formatCoordinate(29.0784, 41.0082);
      expect(result).toContain('29°');
      expect(result).toContain('E');
      expect(result).toContain('41°');
      expect(result).toContain('N');
    });

    it('MGRS format', () => {
      const um = new UnitManager({ coordinateFormat: 'MGRS' });
      const result = um.formatCoordinate(29.0784, 41.0082);
      expect(result).toContain('N');
      expect(result).toContain('E');
    });
  });

  // ─── Static formatters ───

  describe('static formatDD', () => {
    it('formats correctly', () => {
      expect(UnitManager.formatDD(29.0, 41.0)).toBe('29.0000° E, 41.0000° N');
    });

    it('handles southern hemisphere', () => {
      expect(UnitManager.formatDD(18.4241, -33.9249)).toBe('18.4241° E, 33.9249° S');
    });
  });

  describe('static formatDMS', () => {
    it('formats correctly', () => {
      const result = UnitManager.formatDMS(29.0, 41.0);
      expect(result).toContain('29° 0\'');
      expect(result).toContain('E');
      expect(result).toContain('41° 0\'');
      expect(result).toContain('N');
    });
  });
});
