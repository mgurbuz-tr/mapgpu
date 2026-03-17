/**
 * CallbackRenderer — Per-feature symbology via user-supplied callback.
 *
 * Enables fully dynamic, data-driven styling where the user provides
 * a function that receives each feature (and optional render context)
 * and returns the appropriate symbol.
 *
 * The multi-group path in VectorBufferCache handles grouping
 * automatically — no cache changes needed.
 */
import type { IRenderer, Symbol, SymbolRenderContext } from '../interfaces/IRenderer.js';
import type { Feature } from '../interfaces/ILayer.js';

export type CallbackRendererFn = (feature: Feature, context?: SymbolRenderContext) => Symbol | null;

export class CallbackRenderer implements IRenderer {
  readonly type = 'callback';
  private _fn: CallbackRendererFn;

  constructor(fn: CallbackRendererFn) {
    this._fn = fn;
  }

  getSymbol(feature: Feature, context?: SymbolRenderContext): Symbol | null {
    return this._fn(feature, context);
  }
}
