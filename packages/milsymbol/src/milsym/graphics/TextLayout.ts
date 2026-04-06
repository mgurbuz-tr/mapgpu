/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */


import { AffineTransform } from "./AffineTransform"
import { Font } from "./Font"
import { FontRenderContext } from "./FontRenderContext"
import { GeneralPath } from "./GeneralPath"
import { Rectangle } from "./Rectangle"
import { Shape } from "./Shape"


//import android.graphics.drawable.shapes.Shape;
//import android.graphics.drawable.shapes.PathShape;
//import android.graphics.Path;
/**
 *
 *
 */
export class TextLayout {
    protected _font: Font;
    protected _str: string = "";
    public constructor(s: string, font: Font, frc: FontRenderContext) {

        this._font = font;
        this._str = s;
        //return;
    }
    public getOutline(tx: AffineTransform | null): Shape {
        return new GeneralPath();
    }
    //used by ShapeInfo
    public getPixelBounds(frc: FontRenderContext, x: number, y: number): null {
        return null;
    }
    public getBounds(): Rectangle {
        let width: number = this._font.getSize() / 2 * this._str.length;
        let height: number = this._font.getSize();
        let rect: Rectangle = new Rectangle(0, 0, width, height);
        return rect;
    }
}
