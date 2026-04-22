import { describe, it, expect } from 'vitest';
import { MilStdIconRenderer } from './renderer/MilStdIconRenderer';
import { MilStdAttributes } from './renderer/utilities/MilStdAttributes';
import { SymbolID } from './renderer/utilities/SymbolID';
import { SymbolUtilities } from './renderer/utilities/SymbolUtilities';
import { Modifiers } from './renderer/utilities/Modifiers';

// Land Unit (SS=10), Friendly(Aff=3), Entity=121100 (Infantry)
const LAND_INFANTRY = '110310000012110000000000000000';

function makeSidc(base: string, overrides: { ctx?: number, hqtfd?: number, ad?: number, status?: number }) {
    let chars = base.split('');
    if (overrides.ctx !== undefined) chars[2] = String(overrides.ctx);
    if (overrides.status !== undefined) chars[6] = String(overrides.status);
    if (overrides.hqtfd !== undefined) chars[7] = String(overrides.hqtfd);
    if (overrides.ad !== undefined) {
        let adStr = String(overrides.ad).padStart(2, '0');
        chars[8] = adStr[0];
        chars[9] = adStr[1];
    }
    return chars.join('');
}

function renderSvg(sidc: string): string {
    const renderer = MilStdIconRenderer.getInstance();
    const attrs = new Map<string, string>();
    attrs.set(MilStdAttributes.PixelSize, '80');
    attrs.set(MilStdAttributes.KeepUnitRatio, 'true');
    const result = renderer.RenderSVG(sidc, new Map(), attrs);
    return result?.getSVG() || '';
}

describe('HQTFD / Context / Echelon rendering', () => {

    describe('Echelon', () => {
        it('should render echelon text for Company (AD=15)', () => {
            const sidc = makeSidc(LAND_INFANTRY, { ad: 15 });
            expect(SymbolUtilities.hasModifier(sidc, Modifiers.B_ECHELON)).toBe(true);
            const svg = renderSvg(sidc);
            expect(svg).toContain('>I<'); // Company = "I"
        });

        it('should render echelon text for Brigade (AD=18)', () => {
            const svg = renderSvg(makeSidc(LAND_INFANTRY, { ad: 18 }));
            expect(svg).toContain('>X<'); // Brigade = "X"
        });

        it('should render echelon text for Division (AD=21)', () => {
            const svg = renderSvg(makeSidc(LAND_INFANTRY, { ad: 21 }));
            expect(svg).toContain('>XX<'); // Division = "XX"
        });
    });

    describe('Context', () => {
        it('should render Exercise context with "X" affiliation modifier', () => {
            const sidc = makeSidc(LAND_INFANTRY, { ctx: 1 });
            const svg = renderSvg(sidc);
            expect(svg.length).toBeGreaterThan(900); // must not crash (was 507 before fix)
            expect(svg).toContain('>X<'); // Exercise indicator
        });

        it('should render Simulation context with "S" affiliation modifier', () => {
            const sidc = makeSidc(LAND_INFANTRY, { ctx: 2 });
            const svg = renderSvg(sidc);
            expect(svg.length).toBeGreaterThan(900);
            expect(svg).toContain('>S<'); // Simulation indicator
        });

        it('should render Reality context without crash', () => {
            const svg = renderSvg(makeSidc(LAND_INFANTRY, { ctx: 0 }));
            expect(svg).toContain('<svg');
        });
    });

    describe('HQTFD', () => {
        it('should render HQ staff line (HQTFD=2)', () => {
            const sidc = makeSidc(LAND_INFANTRY, { hqtfd: 2, ad: 18 });
            expect(SymbolUtilities.isHQ(sidc)).toBe(true);
            const svg = renderSvg(sidc);
            // HQ adds an extra <line> element for the staff indicator
            const lineCount = (svg.match(/<line/g) || []).length;
            expect(lineCount).toBeGreaterThanOrEqual(3); // baseline 2 + HQ staff
        });

        it('should render Task Force rectangle (HQTFD=4)', () => {
            const sidc = makeSidc(LAND_INFANTRY, { hqtfd: 4, ad: 18 });
            expect(SymbolUtilities.isTaskForce(sidc)).toBe(true);
            const svg = renderSvg(sidc);
            const rectCount = (svg.match(/<rect/g) || []).length;
            expect(rectCount).toBeGreaterThanOrEqual(2); // baseline 1 + TF rect
        });

        it('should render Feint/Dummy indicator triangle (HQTFD=1)', () => {
            const sidc = makeSidc(LAND_INFANTRY, { hqtfd: 1, ad: 18 });
            expect(SymbolUtilities.hasFDI(sidc)).toBe(true);
            const svg = renderSvg(sidc);
            // FDI renders as a dashed <path> element
            const pathCount = (svg.match(/<path/g) || []).length;
            expect(pathCount).toBeGreaterThanOrEqual(1);
        });

        it('should render combined TF+HQ (HQTFD=6)', () => {
            const sidc = makeSidc(LAND_INFANTRY, { hqtfd: 6, ad: 18 });
            expect(SymbolUtilities.isHQ(sidc)).toBe(true);
            expect(SymbolUtilities.isTaskForce(sidc)).toBe(true);
            const svg = renderSvg(sidc);
            const lineCount = (svg.match(/<line/g) || []).length;
            const rectCount = (svg.match(/<rect/g) || []).length;
            expect(lineCount).toBeGreaterThanOrEqual(3); // HQ staff line
            expect(rectCount).toBeGreaterThanOrEqual(2); // TF rect
        });
    });
});
