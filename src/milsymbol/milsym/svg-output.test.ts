import { describe, it, expect } from 'vitest';
import { MilStdIconRenderer } from './renderer/MilStdIconRenderer';
import { MilStdAttributes } from './renderer/utilities/MilStdAttributes';

describe('SVG output inspection', () => {
  it('should produce valid SVG with correct dimensions', () => {
    const r = MilStdIconRenderer.getInstance();
    const sidc = '100310000012110000000000000000';
    const mod = new Map<string, string>();
    const attr = new Map<string, string>();
    attr.set(MilStdAttributes.PixelSize, '80');
    const res = r.RenderSVG(sidc, mod, attr);
    expect(res).not.toBeNull();

    const svg = res!.getSVG();
    console.log('=== SVG OUTPUT (first 1500 chars) ===');
    console.log(svg.substring(0, 1500));
    console.log('=== END ===');

    const b = res!.getImageBounds();
    console.log('ImageBounds:', b.getX(), b.getY(), b.getWidth(), b.getHeight());
    const sb = res!.getSymbolBounds();
    console.log('SymbolBounds:', sb.getX(), sb.getY(), sb.getWidth(), sb.getHeight());
    const cp = res!.getSymbolCenterPoint();
    console.log('CenterPoint:', cp.getX(), cp.getY());

    // Check SVG has width/height
    expect(svg).toContain('<svg');
    expect(svg).toContain('width=');
    expect(svg).toContain('height=');

    // Check no mirror transforms
    const hasNegativeScale = svg.includes('scale(-1') || svg.includes('scale( -1');
    console.log('Has negative scale transform:', hasNegativeScale);
  });
});
