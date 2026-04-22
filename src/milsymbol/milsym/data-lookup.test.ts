import { describe, it, expect } from 'vitest';
import { MSLookup } from './renderer/utilities/MSLookup';
import { SVGLookup } from './renderer/utilities/SVGLookup';
import { SymbolID } from './renderer/utilities/SymbolID';

describe('MSLookup — symbol definition lookup', () => {
  it('should initialize singleton', () => {
    const instance = MSLookup.getInstance();
    expect(instance).toBeDefined();
  });

  it('should find infantry by basic ID (2525D)', () => {
    const instance = MSLookup.getInstance();
    // basicID = symbolSet(2) + entityCode(6) = "10121100"
    const info = instance.getMSLInfo('10121100', SymbolID.Version_2525Dch1);
    expect(info).not.toBeNull();
  });

  it('should find infantry by basic ID (2525E)', () => {
    const instance = MSLookup.getInstance();
    const info = instance.getMSLInfo('10121100', SymbolID.Version_2525E);
    expect(info).not.toBeNull();
  });

  it('should return symbol code list for 2525D', () => {
    const instance = MSLookup.getInstance();
    const codes = instance.getIDList(SymbolID.Version_2525Dch1);
    expect(codes).toBeDefined();
    expect(codes.length).toBeGreaterThan(0);
  });

  it('should return symbol code list for 2525E', () => {
    const instance = MSLookup.getInstance();
    const codes = instance.getIDList(SymbolID.Version_2525E);
    expect(codes).toBeDefined();
    expect(codes.length).toBeGreaterThan(0);
  });

  it('should report ready after init', () => {
    const instance = MSLookup.getInstance();
    expect(instance.isReady()).toBe(true);
  });
});

describe('SVGLookup — SVG path lookup', () => {
  it('should initialize singleton', () => {
    const instance = SVGLookup.getInstance();
    expect(instance).toBeDefined();
  });

  it('should look up SVG data for infantry icon (2525D)', () => {
    const instance = SVGLookup.getInstance();
    // SVG IDs use suffix: 10121100_0 = base icon for infantry
    const info = instance.getSVGLInfo('10121100_0', SymbolID.Version_2525Dch1);
    expect(info).not.toBeNull();
  });

  it('should look up SVG data for infantry icon (2525E)', () => {
    const instance = SVGLookup.getInstance();
    const info = instance.getSVGLInfo('10121100_0', SymbolID.Version_2525E);
    expect(info).not.toBeNull();
  });

  it('should get frame ID', () => {
    // 2525D friendly land unit
    const frameId = SVGLookup.getFrameID('100310000016121100000000000000');
    expect(frameId).toBeDefined();
    expect(frameId.length).toBeGreaterThan(0);
  });

  it('should get main icon ID', () => {
    const iconId = SVGLookup.getMainIconID('100310000016121100000000000000');
    expect(iconId).toBeDefined();
  });
});
