import { describe, it, expect } from 'vitest';
import { MilStdIconRenderer } from '../../src/milsym/renderer/MilStdIconRenderer';
import { MilStdAttributes } from '../../src/milsym/renderer/utilities/MilStdAttributes';
import { SymbolID } from '../../src/milsym/renderer/utilities/SymbolID';

describe('Status rendering debug', () => {
  // Infantry, Friend, 2525Dch1
  // VV=11, Ctx=0, Aff=3, SS=10, Status=X, HQTFD=0, Amp=00, Entity=121100, Mod=0000
  // Padded to 30: "110310X000121100000000000000000"
  const BASE = '110310';
  // HQTFD(1)=0 + Amp(2)=00 + Entity(6)=121100 + Mod(4)=0000 + Pad(10)=0000000000 = 23 chars
  const TAIL = '00012110000000000000000';

  const statuses = [
    { name: 'Present', val: '0', code: SymbolID.Status_Present },
    { name: 'Planned', val: '1', code: SymbolID.Status_Planned_Anticipated_Suspect },
    { name: 'FullyCapable', val: '2', code: SymbolID.Status_Present_FullyCapable },
    { name: 'Damaged', val: '3', code: SymbolID.Status_Present_Damaged },
    { name: 'Destroyed', val: '4', code: SymbolID.Status_Present_Destroyed },
    { name: 'FullToCapacity', val: '5', code: SymbolID.Status_Present_FullToCapacity },
  ];

  for (const s of statuses) {
    it(`should render status=${s.val} (${s.name})`, () => {
      const sidc = BASE + s.val + TAIL;
      expect(sidc).toHaveLength(30);
      expect(SymbolID.getStatus(sidc)).toBe(s.code);

      const renderer = MilStdIconRenderer.getInstance();
      const canRender = renderer.CanRender(sidc, new Map());
      expect(canRender).toBe(true);

      const attrs = new Map<string, string>();
      attrs.set(MilStdAttributes.PixelSize, '80');
      attrs.set(MilStdAttributes.KeepUnitRatio, 'true');

      const result = renderer.RenderSVG(sidc, new Map(), attrs);
      expect(result).not.toBeNull();

      const svg = result!.getSVG();
      console.log(`${s.name}: len=${svg.length}, hasRect=${svg.includes('<rect')}, hasLine=${svg.includes('<line')}`);
      console.log(`  SVG first 300: ${svg.substring(0, 300)}`);

      // All statuses should produce valid SVG with a rect (the frame)
      expect(svg).toContain('<svg');
      expect(svg).toContain('<rect');
    });

    it(`should render status=${s.val} (${s.name}) WITH labels`, () => {
      const sidc = BASE + s.val + TAIL;
      const renderer = MilStdIconRenderer.getInstance();

      const attrs = new Map<string, string>();
      attrs.set(MilStdAttributes.PixelSize, '80');
      attrs.set(MilStdAttributes.KeepUnitRatio, 'true');
      // NOT icon mode — should show modifiers including OCI
      attrs.set(MilStdAttributes.DrawAsIcon, 'false');

      const modifiers = new Map<string, string>();
      modifiers.set('T', 'TEST');
      modifiers.set('H', 'X');

      const result = renderer.RenderSVG(sidc, modifiers, attrs);
      expect(result).not.toBeNull();

      const svg = result!.getSVG();
      console.log(`${s.name}+labels: len=${svg.length}`);
      console.log(`  SVG snippet: ...${svg.substring(svg.length - 200)}`);

      expect(svg).toContain('<svg');
    });
  }
});
