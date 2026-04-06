import { describe, it, expect } from 'vitest';
import { WebRenderer } from '../../src/milsym/web/WebRenderer';
import { MilStdAttributes } from '../../src/milsym/renderer/utilities/MilStdAttributes';
import { Modifiers } from '../../src/milsym/renderer/utilities/Modifiers';
import { RendererSettings } from '../../src/milsym/renderer/utilities/RendererSettings';
import { SymbolUtilities } from '../../src/milsym/renderer/utilities/SymbolUtilities';
import { SymbolID } from '../../src/milsym/renderer/utilities/SymbolID';
import { Color } from '../../src/milsym/renderer/utilities/Color';

describe('WebRenderer — multipoint rendering', () => {
  // Friendly phase line — 2525D control measure
  // SS=25 (ControlMeasure), Entity=151401 (Phase Line)
  // Format: VV(2)+Ctx(1)+SI(1)+SS(2)+Status(1)+HQTFD(1)+Amp(2)+Entity(6)+Mod1(2)+Mod2(2)+pad(10) = 30 chars
  const PHASE_LINE_SIDC = '100325000015140100000000000000';
  const PHASE_LINE_POINTS = '32.5,37.5 33.0,37.5 33.5,37.0';
  const SCALE = 500000;
  const BBOX = '31.0,36.0,35.0,39.0';

  it('should render a phase line as GeoJSON', () => {
    const modifiers = new Map<string, string>();
    modifiers.set(Modifiers.T_UNIQUE_DESIGNATION_1, 'ALPHA');

    const attributes = new Map<string, string>();

    const result = WebRenderer.RenderSymbol(
      'test-1',
      'Phase Line Alpha',
      'Test phase line',
      PHASE_LINE_SIDC,
      PHASE_LINE_POINTS,
      'clampToGround',
      SCALE,
      BBOX,
      modifiers,
      attributes,
      WebRenderer.OUTPUT_FORMAT_GEOJSON
    );

    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
    // Should be valid GeoJSON FeatureCollection (not an error response)
    const parsed = JSON.parse(result);
    expect(parsed).toBeDefined();
    expect(parsed.type).toBe('FeatureCollection');
    expect(parsed.features.length).toBeGreaterThan(0);
  });

  it('should render a phase line as SVG', () => {
    const modifiers = new Map<string, string>();
    modifiers.set(Modifiers.T_UNIQUE_DESIGNATION_1, 'BRAVO');
    const attributes = new Map<string, string>();

    const result = WebRenderer.RenderSymbol(
      'test-2',
      'Phase Line Bravo',
      'Test SVG output',
      PHASE_LINE_SIDC,
      PHASE_LINE_POINTS,
      'clampToGround',
      SCALE,
      BBOX,
      modifiers,
      attributes,
      WebRenderer.OUTPUT_FORMAT_GEOSVG
    );

    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('RendererSettings', () => {
  it('should be a singleton', () => {
    const a = RendererSettings.getInstance();
    const b = RendererSettings.getInstance();
    expect(a).toBe(b);
  });

  it('should set and get single-point symbol outline', () => {
    const settings = RendererSettings.getInstance();
    settings.setSinglePointSymbolOutlineWidth(3);
    expect(settings.getSinglePointSymbolOutlineWidth()).toBe(3);
  });
});

describe('SymbolUtilities', () => {
  it('should detect multipoint symbol', () => {
    // Control measure (SS=25), Phase Line (entity=151401)
    // 2525D 20-digit: VV+SI+SS+Status+HQTFD+Amp+Entity(6)+Mod1+Mod2, padded to 30
    const sidc = '100325000015140100000000000000';
    const isMulti = SymbolUtilities.isMultiPoint(sidc);
    expect(isMulti).toBe(true);
  });

  it('should detect single-point symbol', () => {
    // Land Unit (SS=10), Infantry (entity=121100) — not multipoint
    const sidc = '100310000012110000000000000000';
    const isMulti = SymbolUtilities.isMultiPoint(sidc);
    expect(isMulti).toBe(false);
  });
});

describe('Color', () => {
  it('should create color from RGB', () => {
    const c = new Color(255, 0, 0);
    expect(c.getRed()).toBe(255);
    expect(c.getGreen()).toBe(0);
    expect(c.getBlue()).toBe(0);
  });

  it('should create color from hex string', () => {
    const c = new Color('#FF0000');
    expect(c).toBeDefined();
    expect(c.getRed()).toBe(255);
    expect(c.getGreen()).toBe(0);
    expect(c.getBlue()).toBe(0);
  });

  it('should create named colors', () => {
    expect(Color.RED.getRed()).toBe(255);
    expect(Color.BLUE.getBlue()).toBe(255);
    expect(Color.BLACK.getRed()).toBe(0);
  });
});
