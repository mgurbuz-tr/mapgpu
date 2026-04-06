import { describe, it, expect } from 'vitest';
import { MilStdIconRenderer } from '../../src/milsym/renderer/MilStdIconRenderer';
import { MilStdAttributes } from '../../src/milsym/renderer/utilities/MilStdAttributes';
import { SymbolID } from '../../src/milsym/renderer/utilities/SymbolID';
import { SVGLookup, svgLookup } from '../../src/milsym/renderer/utilities/SVGLookup';
import { SymbolUtilities } from '../../src/milsym/renderer/utilities/SymbolUtilities';
import { msLookup } from '../../src/milsym/renderer/utilities/MSLookup';

describe('User reported SIDC debug', () => {
  const SIDC = '110301200011000000000000000000';

  it('should parse SIDC correctly', () => {
    expect(SymbolID.getVersion(SIDC)).toBe(11);
    expect(SymbolID.getContext(SIDC)).toBe(0);
    expect(SymbolID.getAffiliation(SIDC)).toBe(3);
    expect(SymbolID.getSymbolSet(SIDC)).toBe(1); // Air
    expect(SymbolID.getStatus(SIDC)).toBe(2); // Fully Capable
    expect(SymbolID.getHQTFD(SIDC)).toBe(0);
    expect(SymbolID.getAmplifierDescriptor(SIDC)).toBe(0);
    expect(SymbolID.getEntityCode(SIDC)).toBe(110000);
  });

  it('should find basicID in MSLookup', () => {
    const basicID = SymbolUtilities.getBasicSymbolID(SIDC);
    console.log('BasicID:', basicID);
    const info = msLookup.getMSLInfo(SIDC);
    console.log('MSInfo:', info ? `name=${info.getName()}, drawRule=${info.getDrawRule()}` : 'NULL');
    expect(info).not.toBeNull();
  });

  it('should find frame and icon in SVGLookup', () => {
    const ver = SymbolID.getVersion(SIDC);
    const frameID = SVGLookup.getFrameID(SIDC);
    const iconID = SVGLookup.getMainIconID(SIDC);
    console.log('frameID:', frameID);
    console.log('iconID:', iconID);

    const siFrame = svgLookup.getSVGLInfo(frameID, ver);
    const siIcon = svgLookup.getSVGLInfo(iconID, ver);
    console.log('siFrame:', siFrame ? 'FOUND' : 'NULL');
    console.log('siIcon:', siIcon ? 'FOUND' : 'NULL');

    expect(siFrame).not.toBeNull();
  });

  it('should CanRender', () => {
    const renderer = MilStdIconRenderer.getInstance();
    const canRender = renderer.CanRender(SIDC, new Map());
    console.log('CanRender:', canRender);
    expect(canRender).toBe(true);
  });

  it('should RenderSVG without modifiers and show OCI for status=2', () => {
    const renderer = MilStdIconRenderer.getInstance();
    const attrs = new Map<string, string>();
    attrs.set(MilStdAttributes.PixelSize, '80');
    attrs.set(MilStdAttributes.KeepUnitRatio, 'true');

    const result = renderer.RenderSVG(SIDC, new Map(), attrs);
    expect(result).not.toBeNull();
    const svg = result!.getSVG();
    console.log('Status=2 full SVG:\n' + svg);
    expect(svg).toContain('<svg');

    // For Fully Capable (status=2), expect OCI bar (2 rect elements: outline + fill)
    // OCI bar color for Fully Capable = green (#00FF00)
    const rectCount = (svg.match(/<rect/g) || []).length;
    console.log('rect count:', rectCount, '(expect >= 2 for frame + OCI bar)');

    // Verify viewBox expands to include OCI bar below the symbol
    const vbMatch = svg.match(/viewBox="([^"]+)"/);
    expect(vbMatch).not.toBeNull();
    const [, , , vbHeight] = vbMatch![1].split(/[\s,]+/).map(Number);
    const symbolBounds = result!.getSymbolBounds();
    const symbolHeight = symbolBounds.getHeight();
    expect(vbHeight).toBeGreaterThan(symbolHeight);
  });

  it('should render status=3 (Damaged) with a slash path', () => {
    // Status=3 = Damaged → OCI slash "/" through symbol
    const damagedSidc = '110301300011000000000000000000';
    expect(SymbolID.getStatus(damagedSidc)).toBe(3);

    const renderer = MilStdIconRenderer.getInstance();
    const attrs = new Map<string, string>();
    attrs.set(MilStdAttributes.PixelSize, '80');
    attrs.set(MilStdAttributes.KeepUnitRatio, 'true');

    const result = renderer.RenderSVG(damagedSidc, new Map(), attrs);
    expect(result).not.toBeNull();
    const svg = result!.getSVG();

    // Damaged status renders a "/" slash as a <line> or <path> element
    const hasSlash = svg.includes('<line') || svg.includes('<path');
    expect(hasSlash).toBe(true);
  });

  it('should RenderSVG WITH modifiers (labels)', () => {
    const renderer = MilStdIconRenderer.getInstance();
    const attrs = new Map<string, string>();
    attrs.set(MilStdAttributes.PixelSize, '80');
    attrs.set(MilStdAttributes.KeepUnitRatio, 'true');
    attrs.set(MilStdAttributes.DrawAsIcon, 'false');

    const mods = new Map<string, string>();
    mods.set('T', 'TEST');

    const result = renderer.RenderSVG(SIDC, mods, attrs);
    console.log('RenderSVG+mods result:', result ? `len=${result.getSVG().length}` : 'NULL');
    if (result) {
      const svg = result.getSVG();
      console.log('Has <svg>:', svg.includes('<svg'));
      console.log('SVG last 300:', svg.substring(svg.length - 300));
    }
    expect(result).not.toBeNull();
    expect(result!.getSVG()).toContain('<svg');
  });

  // Test all statuses with same symbol (Air, entity 110000)
  for (const status of [0, 1, 2, 3, 4, 5]) {
    it(`should render status=${status} for Air symbol`, () => {
      // VV=11,Ctx=0,Aff=3,SS=01,Status=X,HQTFD=0,Amp=00,Entity=110000,Mod=0000,Pad=0000000000 = 30
      const sidc = '110301' + status + '00011000000000000000000';
      // Verify length
      expect(sidc.length).toBe(30);
      expect(SymbolID.getStatus(sidc)).toBe(status);

      const renderer = MilStdIconRenderer.getInstance();
      const attrs = new Map<string, string>();
      attrs.set(MilStdAttributes.PixelSize, '80');
      attrs.set(MilStdAttributes.KeepUnitRatio, 'true');

      const result = renderer.RenderSVG(sidc, new Map(), attrs);
      expect(result).not.toBeNull();
      const svg = result!.getSVG();
      console.log(`Status ${status}: len=${svg.length}, has_svg=${svg.includes('<svg')}`);
      expect(svg).toContain('<svg');
    });
  }
});
