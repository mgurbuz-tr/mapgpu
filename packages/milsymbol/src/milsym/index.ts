// milsym — MIL-STD-2525 D/E Symbol Rendering Engine
// Ported from mil-sym-ts (Apache-2.0)

// ─── Public API ───
export { WebRenderer } from './web/WebRenderer';
export { MilStdIconRenderer } from './renderer/MilStdIconRenderer';
export { SinglePointSVGRenderer, singlePointSVGRenderer } from './renderer/SinglePointSVGRenderer';
export { RendererSettings, rendererSettings } from './renderer/utilities/RendererSettings';
export { MilStdAttributes } from './renderer/utilities/MilStdAttributes';
export { Modifiers } from './renderer/utilities/Modifiers';
export { SymbolID } from './renderer/utilities/SymbolID';
export { SymbolUtilities } from './renderer/utilities/SymbolUtilities';
export { MSLookup, msLookup } from './renderer/utilities/MSLookup';
export { SVGLookup, svgLookup } from './renderer/utilities/SVGLookup';
export { MilStdSymbol } from './renderer/utilities/MilStdSymbol';
export { ShapeInfo } from './renderer/utilities/ShapeInfo';
export { Color } from './renderer/utilities/Color';
export { ErrorLogger } from './renderer/utilities/ErrorLogger';

// ─── Multipoint Rendering ───
export { MultiPointHandler } from './web/MultiPointHandler';
export { MultiPointHandlerSVG } from './web/MultiPointHandlerSVG';

// ─── Geometry Primitives ───
export { Point2D } from './graphics/Point2D';
export { Rectangle2D } from './graphics/Rectangle2D';
export { POINT2 } from './types/point';

// ─── Point Conversion Interface ───
export type { IPointConversion } from './renderer/utilities/IPointConversion';
