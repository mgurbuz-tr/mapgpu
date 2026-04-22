/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */


import { Font } from "./Font"
import { FontRenderContext } from "./FontRenderContext"


/**
 *
 *
 */
export class FontMetrics  {
    protected _fontRenderContext: FontRenderContext;
    protected _font: Font;
    public constructor(font: Font) {
        //_fontRenderContext=new FontRenderContext();
        this._font = font;
    }
    public stringWidth(str: string): number {
        return this._font.getSize() / 2 * str.length;
    }
    public getFontRenderContext(): FontRenderContext {
        return this._fontRenderContext;
    }
}
