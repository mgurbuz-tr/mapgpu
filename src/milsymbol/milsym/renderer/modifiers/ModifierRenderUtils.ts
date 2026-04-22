//Graphics2D
import { Font } from "../../graphics/Font"
import { Point2D } from "../../graphics/Point2D"
import { Rectangle2D } from "../../graphics/Rectangle2D"

//Renderer/Shapes
import { Rectangle } from "../shapes/rectangle";
import { Line } from "../shapes/line";
import { Ellipse } from "../shapes/ellipse";
import { RoundedRectangle } from "../shapes/roundedrectangle";
import { Path } from "../shapes/path";

//Renderer.Utilities
import { Color } from "../utilities/Color"
import { ImageInfo } from "../utilities/ImageInfo"
import { MilStdAttributes } from "../utilities/MilStdAttributes"
import { Modifiers } from "../utilities/Modifiers"
import { RectUtilities } from "../utilities/RectUtilities"
import { RendererSettings, rendererSettings } from "../utilities/RendererSettings"
import { RendererUtilities } from "../utilities/RendererUtilities"
import { Shape2SVG } from "../utilities/Shape2SVG"
import { SymbolDimensionInfo } from "../utilities/SymbolDimensionInfo"
import { SymbolID } from "../utilities/SymbolID"
import { SymbolUtilities } from "../utilities/SymbolUtilities"
import { TextInfo } from "../utilities/TextInfo"
import { SVGSymbolInfo } from "../utilities/SVGSymbolInfo";

import { createMeasureCanvas } from '../../canvas-factory';

const OSCDefined = typeof OffscreenCanvasRenderingContext2D !== 'undefined';

/**
 * Utility function to check if C modifier is on top
 * @param symbolID The symbol ID to check
 * @returns true if C modifier should be rendered on top
 */
export function isCOnTop(symbolID: string): boolean {
    let onTop: boolean = false;

    let version: number = SymbolID.getVersion(symbolID);
    let ss: number = SymbolID.getSymbolSet(symbolID);
    let frame: string = SymbolID.getFrameShape(symbolID);

    if (SymbolUtilities.hasModifier(symbolID, Modifiers.C_QUANTITY)) {

        if (version >= SymbolID.Version_2525E) {

            if (ss == SymbolID.SymbolSet_Air ||
                ss == SymbolID.SymbolSet_AirMissile ||
                ss == SymbolID.SymbolSet_Space ||
                ss == SymbolID.SymbolSet_SpaceMissile ||
                ss == SymbolID.SymbolSet_LandEquipment) {
                onTop = true;
            }
            else if (ss == SymbolID.SymbolSet_SignalsIntelligence &&
                (frame == SymbolID.FrameShape_Air ||
                    frame == SymbolID.FrameShape_Space ||
                    frame == SymbolID.FrameShape_LandEquipment || frame == SymbolID.FrameShape_LandUnit || frame == '0')) {
                onTop = true;
            }

        }// else if <= SymbolID.Version_2525Dch1
        else if (ss == SymbolID.SymbolSet_LandEquipment ||
            ss == SymbolID.SymbolSet_SignalsIntelligence_Land) {
            onTop = true;
        }
    }
    return onTop;
}

/**
 * Get Font from attributes or use default
 * @param attributes Map of attributes
 * @returns Font object
 */
export function getFont(attributes: Map<string, string>): Font {
    let f: Font | null = null;

    let ff: string = rendererSettings.getLabelFontName();
    let fstyle: number = rendererSettings.getLabelFontType();
    let fsize: number = rendererSettings.getLabelFontSize();
    let temp: string | null = null;


    if (attributes.has(MilStdAttributes.FontFamily) ||
        attributes.has(MilStdAttributes.FontStyle) ||
        attributes.has(MilStdAttributes.FontSize)) {
        if (attributes.has(MilStdAttributes.FontStyle)) {
            temp = attributes.get(MilStdAttributes.FontStyle)!;
            if (temp !==  null && temp != "") {
                fstyle = parseInt(temp);
            }
        }
        if (attributes.has(MilStdAttributes.FontSize)) {
            temp = attributes.get(MilStdAttributes.FontSize)!;
            if (temp !==  null && temp != "") {
                fsize = parseInt(temp);
            }
        }
        if (attributes.has(MilStdAttributes.FontFamily)) {
            temp = attributes.get(MilStdAttributes.FontFamily)!;
            if (temp !==  null && temp != "") {
                ff = temp;//Typeface.create(temp,fstyle);
            }
        }
    }
    else
        return rendererSettings.getLabelFont();


    f = new Font(ff, fstyle, fsize);

    return f;

}

/**
 * Get font height and descent values
 * @param font Font to be used
 * @param ctx OPTIONAL: If user wants to re-use a context for performance
 * @returns Array with [height, descent]
 */
export function getFontHeightandDescent(font: Font, ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null): number[] {
    let hd: number[] = [0, 0];
    let osc: any;
    //let ctx:any;//OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
    let tm: TextMetrics | any;//node-canvas doesn't fully implement TextMetics so must set to any

    if (ctx === null) {
        if (OSCDefined)
            osc = new OffscreenCanvas(2, 2);
        else
            osc = createMeasureCanvas(2, 2);

        ctx = osc.getContext("2d")!;
    }

    if (font !==  null) {
        ctx!.font = font.toString();
        //let tm: TextMetrics = ModifierRenderer._frc.measureText("Hj");
        tm = ctx!.measureText("Hj");
        if (OSCDefined)//If OffscreenCanvas defined
        {
            hd[0] = (tm.fontBoundingBoxAscent + tm.fontBoundingBoxDescent);//tm.fontBoundingBoxAscent;
            hd[1] = tm.fontBoundingBoxDescent;
        }
        else//likely in Node using node-canvas which uses different values in TextMetrics
        {
            hd[0] = (tm.emHeightAscent + tm.emHeightDescent);//tm.emHeightAscent;
            hd[1] = tm.emHeightDescent;
        }

    }

    return hd;
}

/**
 * Render a single text element to SVG
 * @param tiArray Array of TextInfo elements
 * @param color Text color
 * @param backgroundColor Background color
 * @returns SVG string
 */
export function renderTextElement(tiArray: Array<TextInfo>, color: Color, backgroundColor: Color): string {
    let sbSVG: string = "";

    let svgStroke: string = RendererUtilities.colorToHexString(RendererUtilities.getIdealOutlineColor(color), false);
    if (backgroundColor !==  null) {

        svgStroke = RendererUtilities.colorToHexString(backgroundColor, false);
    }


    let svgFill: string = RendererUtilities.colorToHexString(color, false);
    let svgStrokeWidth: string = rendererSettings.getTextOutlineWidth().toString();
    for (let ti of tiArray) {
        sbSVG += (Shape2SVG.Convert(ti, svgStroke, svgFill, svgStrokeWidth, "", "", ""));
        sbSVG += ("\n");
    }

    return sbSVG.toString().valueOf();
}

/**
 * Render multiple text elements to SVG with group styling
 * @param tiArray Array of TextInfo elements
 * @param color Text color
 * @param backgroundColor Background color
 * @returns SVG string
 */
export function renderTextElements(tiArray: Array<TextInfo>, color: Color, backgroundColor: Color | null): string {
    let style: string;
    let name: string = tiArray[0].getFontName();//rendererSettings.getLabelFont().getName(); + ", sans-serif";//"SansSerif";
    if (!name.endsWith("serif"))
        name += ", sans-serif";
    let size: string = tiArray[0].getFontSize().toString();//rendererSettings.getLabelFont().getSize().toString();
    let weight: string | null = null;
    let anchor: string;//"start";
    if (tiArray[0].getFontStyle() == Font.BOLD)//(rendererSettings.getLabelFont().isBold())
    {
        weight = "bold";
    }

    let sbSVG: string = "";

    let svgStroke: string = RendererUtilities.colorToHexString(RendererUtilities.getIdealOutlineColor(color), false);
    if (backgroundColor !==  null) {

        svgStroke = RendererUtilities.colorToHexString(backgroundColor, false);
    }


    let svgFill: string = RendererUtilities.colorToHexString(color, false);
    let svgStrokeWidth: string = rendererSettings.getTextOutlineWidth().toString();
    sbSVG += ("\n<g");
    sbSVG += (" font-family=\"" + name + '"');
    sbSVG += (" font-size=\"" + size + "px\"");
    if (weight !==  null) {

        sbSVG += (" font-weight=\"" + weight + "\"");
    }

    sbSVG += (" alignment-baseline=\"alphabetic\"");//
    sbSVG += (">");

    for (let ti of tiArray) {
        sbSVG += (Shape2SVG.ConvertForGroup(ti, svgStroke, svgFill, svgStrokeWidth, "", "", ""));
        sbSVG += ("\n");
    }
    sbSVG += ("</g>\n");

    return sbSVG.toString().valueOf();

}

/**
 * Render text elements to a canvas context
 * @param g2d Canvas rendering context
 * @param tiArray Array of TextInfo elements
 * @param textColor Text color
 * @param textBackgroundColor Background color
 */
export function renderText(g2d: OffscreenCanvasRenderingContext2D, tiArray: TextInfo[], textColor: Color, textBackgroundColor: Color): void {
    let color: Color = textColor;

    /*for (TextInfo textInfo : tiArray)
     {
     ctx.drawText(textInfo.getText(), textInfo.getLocation().x, textInfo.getLocation().y, _modifierFont);
     }*/

    let size: number = tiArray.length;

    let tbm: number = rendererSettings.getTextBackgroundMethod();
    let outlineWidth: number = rendererSettings.getTextOutlineWidth();

    if (outlineWidth > 2) {

        outlineWidth = 2;
    }



    if (textColor ===  null) {
        color = Color.BLACK;
    }

    let outlineColor: Color = RendererUtilities.getIdealOutlineColor(color);

    if (textBackgroundColor !==  null) {

        outlineColor = textBackgroundColor;
    }

    else {

        outlineColor = RendererUtilities.getIdealOutlineColor(color);
    }


    if (color.getAlpha() !== 255 && outlineColor.getAlpha() ===  255) {

        outlineColor = RendererUtilities.setColorAlpha(outlineColor, color.getAlpha() / 255);
    }

    g2d.font = rendererSettings.getLabelFont.toString();
    //g2d.setFont(rendererSettings.getLabelFont());
    //g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
    //g2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
    g2d.lineWidth = outlineWidth;
    g2d.fillStyle = color.toHexString();
    g2d.strokeStyle = textBackgroundColor.toHexString();

    /*if (tbm ===  RendererSettings.TextBackgroundMethod_OUTLINE_QUICK) {
        let tempShape: TextInfo;
        //draw text outline
        //_modifierFont.setStyle(Style.FILL);
        //            _modifierFont.setStrokeWidth(RS.getTextOutlineWidth());
        //            _modifierFont.setColor(outlineColor.toInt());
        if (outlineWidth > 0) {
            for (var i = 0; i < size; i++) {
                tempShape = tiArray.at(i);
                tempShape.strokeText(g2d);
            }
        }
        //draw text
        g2d.fillStyle = color.toHexString(false);

        for (let j: number = 0; j < size; j++) {
            let textInfo: TextInfo = tiArray.at(j);
            textInfo.fillText(g2d);
        }
    }
    else //*/
    if (tbm ===  RendererSettings.TextBackgroundMethod_OUTLINE) {
        //TODO: compare performance against TextBackgroundMethod_OUTLINE_QUICK
        let tempShape: TextInfo;
        if (outlineWidth > 0)
            g2d.lineWidth = (outlineWidth * 2) + 1;

        for (var i = 0; i < size; i++) {
            tempShape = tiArray[i];
            if (outlineWidth > 0) {
                tempShape.strokeText(g2d);
            }
            tempShape.fillText(g2d);
        }
    }
    else if (tbm ===  RendererSettings.TextBackgroundMethod_COLORFILL) {
        g2d.fillStyle = outlineColor.toHexString();

        //draw rectangle
        for (let k: number = 0; k < size; k++) {
            let textInfo: TextInfo = tiArray[k];
            textInfo.getTextOutlineBounds().fill(g2d);
        }
        //draw text
        g2d.fillStyle = color.toHexString();

        for (let j: number = 0; j < size; j++) {
            let textInfo: TextInfo = tiArray[j];
            textInfo.fillText(g2d);
        }
    }
    else if (tbm ===  RendererSettings.TextBackgroundMethod_NONE) {
        for (let j: number = 0; j < size; j++) {
            let textInfo: TextInfo = tiArray[j];
            textInfo.fillText(g2d);
        }
    }


}

/**
 * Shift unit points and draw modifiers
 * @param tiArray Array of TextInfo elements
 * @param sdi Symbol dimension info
 * @param attributes Map of attributes
 * @returns SVGSymbolInfo or null
 */
export function shiftUnitPointsAndDraw(tiArray: Array<TextInfo>, sdi: SymbolDimensionInfo, attributes: Map<string, string>) {
    let ii: ImageInfo | null = null;
    let ssi: SVGSymbolInfo | null = null;
    let newsdi: SymbolDimensionInfo | null = null;

    let alpha: number = -1;

    if (attributes !==  null && attributes.has(MilStdAttributes.Alpha)) {
        alpha = Number.parseInt(attributes.get(MilStdAttributes.Alpha)!);
    }

    let textColor: Color = Color.BLACK;
    let textBackgroundColor: Color | null = null;

    let symbolBounds: Rectangle2D = sdi.getSymbolBounds();
    let centerPoint: Point2D = sdi.getSymbolCenterPoint();
    let imageBounds: Rectangle2D = sdi.getImageBounds();
    let imageBoundsOld: Rectangle2D = sdi.getImageBounds();

    let modifierBounds: Rectangle2D | null = null;
    if (tiArray !==  null && tiArray.length > 0) {

        //build modifier bounds/////////////////////////////////////////
        modifierBounds = tiArray[0].getTextOutlineBounds();
        let size: number = tiArray.length;
        let tempShape: TextInfo;
        for (let i: number = 1; i < size; i++) {
            tempShape = tiArray[i];
            modifierBounds.union(tempShape.getTextOutlineBounds());
        }

    }

    if (modifierBounds !==  null) {

        imageBounds.union(modifierBounds);

        //shift points if needed////////////////////////////////////////
        if (sdi instanceof ImageInfo && (imageBounds.getX() < 0 || imageBounds.getY() < 0)) {
            let shiftX: number = Math.round(Math.abs(imageBounds.getX())) as number;
            let
                shiftY: number = Math.round(Math.abs(imageBounds.getY())) as number;

            //shift mobility points
            let size: number = tiArray.length;
            let tempShape: TextInfo;
            for (let i: number = 0; i < size; i++) {
                tempShape = tiArray[i];
                tempShape.shift(shiftX, shiftY);
            }
            RectUtilities.shift(modifierBounds, shiftX, shiftY);
            //modifierBounds.shift(shiftX,shiftY);

            //shift image points
            centerPoint.setLocation(centerPoint.getX() + shiftX, centerPoint.getY() + shiftY);
            RectUtilities.shift(symbolBounds, shiftX, shiftY);
            RectUtilities.shift(imageBounds, shiftX, shiftY);
            RectUtilities.shift(imageBoundsOld, shiftX, shiftY);
            /*centerPoint.shift(shiftX, shiftY);
             symbolBounds.shift(shiftX, shiftY);
             imageBounds.shift(shiftX, shiftY);
             imageBoundsOld.shift(shiftX, shiftY);//*/
        }

        if (attributes.has(MilStdAttributes.TextColor)) {
            textColor = RendererUtilities.getColorFromHexString(attributes.get(MilStdAttributes.TextColor)!) || Color.BLACK;
        }
        if (attributes.has(MilStdAttributes.TextBackgroundColor)) {
            textBackgroundColor = RendererUtilities.getColorFromHexString(attributes.get(MilStdAttributes.TextBackgroundColor)!);
        }
        textColor = RendererUtilities.setColorAlpha(textColor, alpha)!;
        if (textBackgroundColor !==  null) {
            textBackgroundColor = RendererUtilities.setColorAlpha(textBackgroundColor, alpha);
        }

        if (sdi instanceof SVGSymbolInfo) {
            ssi = sdi as SVGSymbolInfo;
            let sb: string = "";
            sb += (ssi.getSVG());
            sb += (renderTextElements(tiArray, textColor, textBackgroundColor));
            newsdi = new SVGSymbolInfo(sb.toString().valueOf(), centerPoint, symbolBounds, imageBounds);
        }
    }

    return newsdi;
}
