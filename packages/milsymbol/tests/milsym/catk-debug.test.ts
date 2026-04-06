/**
 * Regression test: Counterattack (CATK) rendering
 *
 * Verifies that channel-type tactical graphics like CATK produce valid
 * GeoJSON output from WebRenderer with correct feature structure.
 */
import { describe, test, expect } from 'vitest';
import { WebRenderer, MSLookup, SymbolUtilities } from '../../src/milsym/index.js';

describe('Counterattack (CATK) rendering', () => {
  // 2525D, Friend, SS25, CATK — must be exactly 30 chars
  // 10(ver) 0(ctx) 3(aff) 25(ss) 0(stat) 0(hqtfd) 00(amp) 340600(entity) 00(m1) 00(m2) + pad to 30
  const sidc = '100325000034060000000000000000'; // 30 chars

  test('SIDC should produce correct basic ID', () => {
    const basicID = SymbolUtilities.getBasicSymbolID(sidc);
    expect(basicID).toBe('25340600');
    expect(basicID).toHaveLength(8);
  });

  test('should look up CATK symbol info', () => {
    const ms = MSLookup.getInstance();
    const info = ms.getMSLInfo(sidc);
    expect(info).not.toBeNull();
    expect(info!.getMinPointCount()).toBe(3);
    expect(info!.getMaxPointCount()).toBe(50);
    expect(info!.getDrawRule()).toBe(502); // AXIS2
  });

  test('should render CATK with 3 points (minimum)', async () => {
    await MSLookup.ensureForSIDC(sidc);

    const result = WebRenderer.RenderSymbol(
      'test-catk', 'Counterattack', '', sidc,
      '29.0,41.0 29.05,41.05 29.1,41.0',
      'clampToGround', 50000, '28.5,40.5,29.5,41.5',
      new Map(), new Map(),
      WebRenderer.OUTPUT_FORMAT_GEOJSON,
    );

    const json = JSON.parse(result);
    expect(json.type).not.toBe('error');
    expect(json.features?.length).toBeGreaterThan(0);

    // Should have: Polygon (channel), MultiLineString (dashed sides), Point (label), Polygon (metadata)
    const types = json.features.map((f: any) => f.geometry?.type);
    expect(types).toContain('MultiLineString');

    // Dashed sides should have strokeColor
    const dashedFeature = json.features.find((f: any) => f.geometry?.type === 'MultiLineString');
    expect(dashedFeature.properties.strokeColor).toBe('#000000');
    expect(dashedFeature.properties.strokeDasharray).toBeDefined();
  });

  test('should render CATK with 4 points', async () => {
    await MSLookup.ensureForSIDC(sidc);

    const result = WebRenderer.RenderSymbol(
      'test-catk-4', 'Counterattack', '', sidc,
      '29.0,41.0 29.03,41.03 29.06,41.05 29.1,41.0',
      'clampToGround', 50000, '28.5,40.5,29.5,41.5',
      new Map(), new Map(),
      WebRenderer.OUTPUT_FORMAT_GEOJSON,
    );

    const json = JSON.parse(result);
    expect(json.type).not.toBe('error');
    expect(json.features?.length).toBeGreaterThan(0);
  });
});
