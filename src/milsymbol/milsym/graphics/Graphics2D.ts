/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */



import { AffineTransform } from "./AffineTransform"

import { BasicStroke } from "./BasicStroke"

import { Font } from "./Font"
import { FontMetrics } from "./FontMetrics"
import { FontRenderContext } from "./FontRenderContext"

import { Color } from "../renderer/utilities/Color"



/**
 *
 *
 */
export class Graphics2D {
    private _font: Font;
    private _fontMetrics: FontMetrics;
    private _fontRenderContext: FontRenderContext;
    public constructor() {

        this._font = new Font("arial", 10, 10);
        this._fontMetrics = new FontMetrics(this._font);
    }
    public setFont(value: Font): void {
        this._font = value;
        this._fontMetrics = new FontMetrics(this._font);
    }
    public getFont(): Font {
        return this._font;
    }
    public setFontMetrics(value: FontMetrics): void {
        this._fontMetrics = value;
    }
    public getFontMetrics(): FontMetrics {
        return this._fontMetrics;
    }
    public setColor(color: Color): void {
        //return;
    }
    public setBackground(color: Color): void {
        //return;
    }
    public setTransform(id: AffineTransform): void {
        //return;
    }
    public getTransform(): null {
        return null;
    }
    public setStroke(stroke: BasicStroke): void {
        //return;
    }
    public drawLine(x1: number, y1: number, x2: number, y2: number): void {
        //return;
    }
    public dispose(): void {
        //return;
    }
    public rotate(theta: number, x: number, y: number): void {
        //return;
    }
    public clearRect(x: number, y: number, width: number, height: number): void {
        //return;
    }
    public drawString(s: string, x: number, y: number): void {
        //return;
    }
    public getFontRenderContext(): FontRenderContext {
        return this._fontRenderContext;
    }
}
