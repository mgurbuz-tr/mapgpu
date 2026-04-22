import { AffineTransform } from "../graphics/AffineTransform"
import { BasicStroke } from "../graphics/BasicStroke"
import { Font } from "../graphics/Font"
import { FontMetrics } from "../graphics/FontMetrics"
import { FontRenderContext } from "../graphics/FontRenderContext"
import { Graphics2D } from "../graphics/Graphics2D"
import { IPathIterator } from "../graphics/IPathIterator"
import { PathIterator } from "../graphics/PathIterator"
import { Point } from "../graphics/Point"
import { Point2D } from "../graphics/Point2D"
import { Shape } from "../graphics/Shape"
import { TextLayout } from "../graphics/TextLayout"
import { LineUtility } from "../math/line-ops"
import { POINT2 } from "../types/point"
import { Shape2 } from "../generators/shape2"
import { TacticalLines } from "../types/enums"
import { TacticalGraphic } from "./tactical-graphic"
import { Color } from "../renderer/utilities/Color"
import { ErrorLogger } from "../renderer/utilities/ErrorLogger"
import { IPointConversion } from "../renderer/utilities/IPointConversion"
import { ShapeInfo } from "../renderer/utilities/ShapeInfo"
import { rendererSettings } from "../renderer/utilities/RendererSettings"
import { TacticalUtils } from "./tactical-utils"
import { SVGSymbolInfo } from "../renderer/utilities/SVGSymbolInfo"
import { Modifier2 } from "./modifier-placement"

const _className: string = "Modifier2";

// Position constants mirrored from Modifier2 class for use in switch statements
const toEnd: number = 1;
const aboveMiddle: number = 2;
const area: number = 3;
const screen: number = 4;
const aboveEnd: number = 5;
const aboveMiddlePerpendicular: number = 6;
const aboveStartInside: number = 7;
const aboveEndInside: number = 8;
const areaImage: number = 9;

/**
 * Displays the tg modifiers using a client Graphics2D, this is an option
 * provided to clients for displaying modifiers without using shapes
 *
 * @param tg the tactical graphic
 * @param g2d the graphics object for drawing
 * @deprecated
 */
export function displayModifiers(tg: TacticalGraphic,
    g2d: Graphics2D): void {
    try {
        let font: Font = g2d.getFont();
        let j: number = 0;
        let modifier: Modifier2;
        g2d.setBackground(Color.white);
        let pt: POINT2;
        let theta: number = 0;
        let stringWidth: number = 0;
        let stringHeight: number = 0;
        let metrics: FontMetrics = g2d.getFontMetrics();
        let s: string = "";
        let x: number = 0;
        let y: number = 0;
        let pt1: POINT2;
        let pt2: POINT2;
        let quadrant: number = -1;
        let n: number = tg.Pixels.length;
        //for (j = 0; j < tg.modifiers.length; j++)
        for (j = 0; j < n; j++) {
            modifier = tg.modifiers[j] as Modifier2;
            let lineFactor: number = modifier.lineFactor;
            s = modifier.text;
            let x1: number = 0;
            let y1: number = 0;
            let x2: number = 0;
            let y2: number = 0;
            pt = modifier.textPath[0];
            x1 = pt.x;
            y1 = pt.y;
            pt = modifier.textPath[1];
            x2 = pt.x;
            y2 = pt.y;
            theta = Math.atan2(y2 - y1, x2 - x1);
            let midPt: POINT2;
            if (x1 > x2) {
                theta -= Math.PI;
            }
            switch (modifier.type) {
                case toEnd: { //corresponds to LabelAndTextBeforeLineTG
                    g2d.rotate(theta, x1, y1);
                    stringWidth = metrics.stringWidth(s);
                    stringHeight = font.getSize();
                    if (x1 < x2 || (x1 === x2 && y1 > y2)) {
                        x = x1 as number - stringWidth;
                        y = y1 as number - Math.trunc(stringHeight / 2) + (lineFactor * stringHeight) as number;
                        g2d.setColor(tg.fontBackColor);
                        g2d.clearRect(x, y, stringWidth, stringHeight);
                        y = y1 as number + Math.trunc(stringHeight / 2) + (lineFactor * stringHeight) as number;
                        g2d.setColor(tg.textColor);
                        g2d.drawString(s, x, y);
                    } else {
                        x = x1 as number;
                        y = y1 as number - Math.trunc(stringHeight / 2) + (lineFactor * stringHeight) as number;
                        g2d.setColor(tg.fontBackColor);
                        g2d.clearRect(x, y, stringWidth, stringHeight);
                        y = y1 as number + Math.trunc(stringHeight / 2) + (lineFactor * stringHeight) as number;
                        g2d.setColor(tg.textColor);
                        g2d.drawString(s, x, y);
                    }
                    break;
                }

                case aboveMiddle: {
                    midPt = new POINT2((x1 + x2) / 2, (y1 + y2) / 2);
                    g2d.rotate(theta, midPt.x, midPt.y);
                    stringWidth = metrics.stringWidth(s);
                    stringHeight = font.getSize();
                    x = midPt.x as number - stringWidth / 2;
                    y = midPt.y as number - Math.trunc(stringHeight / 2) + (lineFactor * stringHeight) as number;
                    g2d.setColor(tg.fontBackColor);
                    g2d.clearRect(x, y, stringWidth, stringHeight);
                    y = midPt.y as number + (stringHeight / 2) as number + (lineFactor * stringHeight) as number;
                    g2d.setColor(tg.textColor);
                    g2d.drawString(s, x, y);
                    break;
                }

                case area: {
                    g2d.rotate(0, x1, y1);
                    stringWidth = metrics.stringWidth(s);
                    stringHeight = font.getSize();

                    x = x1 as number - stringWidth / 2;
                    y = y1 as number - Math.trunc(stringHeight / 2) + (lineFactor * stringHeight) as number;
                    g2d.setColor(tg.fontBackColor);
                    g2d.clearRect(x, y, stringWidth, stringHeight);
                    y = y1 as number + (stringHeight / 2) as number + (lineFactor * stringHeight) as number;
                    g2d.setColor(tg.textColor);
                    g2d.drawString(s, x, y);
                    break;
                }

                case screen: {    //for SCREEN, GUARD, COVER
                    if (tg.Pixels.length >= 14) {
                        pt1 = tg.Pixels[3];
                        pt2 = tg.Pixels[10];
                        quadrant = LineUtility.GetQuadrantDouble(pt1, pt2);
                        theta = Math.atan2(pt2.y - pt1.y, pt2.x - pt1.x);
                        switch (quadrant) {
                            case 1: {
                                theta += Math.PI / 2;
                                break;
                            }

                            case 2: {
                                theta -= Math.PI / 2;
                                break;
                            }

                            case 3: {
                                theta -= Math.PI / 2;
                                break;
                            }

                            case 4: {
                                theta += Math.PI / 2;
                                break;
                            }

                            default: {
                                break;
                            }

                        }

                        g2d.rotate(theta, x1, y1);
                        stringWidth = metrics.stringWidth(s);
                        stringHeight = font.getSize();

                        x = x1 as number - stringWidth / 2;
                        y = y1 as number - Math.trunc(stringHeight / 2) + (lineFactor * stringHeight) as number;
                        g2d.setColor(tg.fontBackColor);
                        g2d.clearRect(x, y, stringWidth, stringHeight);
                        y = y1 as number + (stringHeight / 2) as number + (lineFactor * stringHeight) as number;
                        g2d.setColor(tg.textColor);
                        g2d.drawString(s, x, y);
                    } else {
                        stringWidth = metrics.stringWidth(s);
                        stringHeight = font.getSize();
                        x = tg.Pixels[0].x as number;//(number) x1 - stringWidth / 2;
                        y = tg.Pixels[0].y as number;//(number) y1 - (number) stringHeight / 2 + (number) (lineFactor * stringHeight);
                        g2d.setColor(tg.fontBackColor);
                        g2d.clearRect(x, y, stringWidth, stringHeight);
                        y = y as number + (stringHeight / 2) as number + (lineFactor * stringHeight) as number;
                        g2d.setColor(tg.textColor);
                        g2d.drawString(s, x, y);
                    }
                    break;
                }

                default: {
                    break;
                }

            }   //end switch
        }   //end for
    } catch (exc) {
        if (exc instanceof Error) {
            ErrorLogger.LogException(_className, "DisplayModifiers",
                exc);
        } else {
            throw exc;
        }
    }
}//end function

/**
 * Returns a Shape object for the text background for labels and modifiers
 *
 * @param tg the tactical graphic object
 * @param pt0 1st point of segment
 * @param pt1 last point of segment
 * @param stringWidth string width
 * @param stringHeight string height
 * @param lineFactor number of text lines above or below the segment
 * @param isTextFlipped true if text is flipped
 * @return the modifier shape
 */
export function buildModifierShape(
    tg: TacticalGraphic,
    pt0: POINT2,
    pt1: POINT2,
    stringWidth: number,
    stringHeight: number,
    lineFactor: number,
    isTextFlipped: boolean): Shape2 {
    let modifierFill: Shape2;
    try {

        let ptTemp0: POINT2 = new POINT2(pt0);
        let ptTemp1: POINT2 = new POINT2(pt1);

        if (isTextFlipped) {
            lineFactor += 1;
        }

        if (lineFactor < 0) //extend pt0,pt1 above the line
        {
            ptTemp0 = LineUtility.ExtendDirectedLine(pt0, pt1, pt0, 2, -lineFactor * stringHeight);
            ptTemp1 = LineUtility.ExtendDirectedLine(pt0, pt1, pt1, 2, -lineFactor * stringHeight);
        }
        if (lineFactor > 0) //extend pt0,pt1 below the line
        {
            ptTemp0 = LineUtility.ExtendDirectedLine(pt0, pt1, pt0, 3, lineFactor * stringHeight);
            ptTemp1 = LineUtility.ExtendDirectedLine(pt0, pt1, pt1, 3, lineFactor * stringHeight);
        }
        if (ptTemp0.y === ptTemp1.y) {
            ptTemp0.y += 1;
        }

        let pt3: POINT2;
        let pt4: POINT2;
        let pt5: POINT2;
        let pt6: POINT2;
        let pt7: POINT2;
        pt3 = LineUtility.extendAlongLine(ptTemp0, ptTemp1, -stringWidth);
        pt4 = LineUtility.ExtendDirectedLine(ptTemp1, ptTemp0, pt3, 0, stringHeight / 2);
        pt5 = LineUtility.ExtendDirectedLine(ptTemp1, ptTemp0, pt3, 1, stringHeight / 2);
        pt6 = LineUtility.ExtendDirectedLine(ptTemp1, ptTemp0, ptTemp0, 1, stringHeight / 2);
        pt7 = LineUtility.ExtendDirectedLine(ptTemp1, ptTemp0, ptTemp0, 0, stringHeight / 2);
        modifierFill = new Shape2(Shape2.SHAPE_TYPE_MODIFIER_FILL);

        modifierFill.moveTo(pt4);
        modifierFill.lineTo(pt5);
        modifierFill.lineTo(pt6);
        modifierFill.lineTo(pt7);
        modifierFill.lineTo(pt4);
    } catch (exc) {
        if (exc instanceof Error) {
            ErrorLogger.LogException(_className, "BuildModifierShape",
                exc);
        } else {
            throw exc;
        }
    }
    return modifierFill;
}

/**
 * For BOUNDARY and other line types which require breaks for the integral
 * text. Currently only boundary uses this
 *
 * @param tg
 * @param g2d the graphics object for drawing
 * @param shapes the shape array
 */
export function getIntegralTextShapes(tg: TacticalGraphic,
    g2d: Graphics2D,
    shapes: Array<Shape2>): void {
    try {
        if (tg.Pixels == null || shapes == null) {
            return;
        }

        let hmap: Map<number, Color> = TacticalUtils.getMSRSegmentColors(tg);
        let color: Color;

        let shape: Shape2;
        let segShape: Shape2;//diangostic 1-22-13
        g2d.setFont(tg.font);
        let j: number = 0;
        let affiliation: string;
        let metrics: FontMetrics = g2d.getFontMetrics();
        let echelonSymbol: string;
        let stringWidthEchelonSymbol: number = 0;
        //boolean lineTooShort = false;
        let ptEchelonStart: POINT2;
        let ptEchelonEnd: POINT2;
        let midpt: POINT2;
        let
            ptENY0Start: POINT2;
        let ptENY0End: POINT2;
        let ptENY1Start: POINT2;
        let ptENY1End: POINT2;
        let pt0: POINT2;
        let pt1: POINT2;
        let dist: number = 0;
        let stroke: BasicStroke;
        switch (tg.lineType) {
            case TacticalLines.BOUNDARY: {
                echelonSymbol = tg.echelonSymbol;
                //shapes = new ArrayList();
                shape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                shape.setLineColor(tg.lineColor);
                shape.style = tg.lineStyle;
                stroke = TacticalUtils.getLineStroke(tg.lineThickness, shape.style, tg.lineCap, BasicStroke.JOIN_ROUND);
                shape.setStroke(stroke);
                if (echelonSymbol != null && echelonSymbol.length > 0) {
                    stringWidthEchelonSymbol = metrics.stringWidth(echelonSymbol);
                }
                //diagnostic
                if (hmap == null || hmap.size === 0) {
                    shape.moveTo(tg.Pixels[0]);
                    for (j = 1; j < tg.Pixels.length; j++) {
                        shape.lineTo(tg.Pixels[j]);
                    }
                    shapes.push(shape);
                    break;
                }
                //end section
                let n: number = tg.Pixels.length;
                //for (j = 0; j < tg.Pixels.length - 1; j++)
                for (j = 0; j < n - 1; j++) {
                    segShape = null;
                    if (hmap != null) {
                        if (hmap.has(j)) {
                            color = hmap.get(j) as Color;
                            segShape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                            segShape.setLineColor(color);
                            segShape.style = tg.lineStyle;
                            segShape.setStroke(stroke);
                        }
                    }

                    pt0 = tg.Pixels[j];
                    pt1 = tg.Pixels[j + 1];
                    //lineTooShort = GetBoundarySegmentTooShort(tg, g2d, j);
                    if (segShape != null) {
                        segShape.moveTo(pt0);
                    } else {
                        shape.moveTo(pt0);
                    }

                    //uncoment comment to remove line breaks for GE
                    //if (lineTooShort || tg.client === "ge")
                    if (tg.client === "ge" || Modifier2.GetBoundarySegmentTooShort(tg, g2d, j) === true) {
                        if (segShape != null) {
                            segShape.lineTo(pt1);
                            shapes.push(segShape);
                            continue;
                        } else {
                            shape.lineTo(pt1);
                            continue;
                        }
                    }

                    midpt = LineUtility.midPoint(pt0, pt1, 0);
                    if (segShape != null) {
                        segShape.moveTo(pt0);
                    } else {
                        shape.moveTo(pt0);
                    }

                    if (stringWidthEchelonSymbol > 0) {
                        midpt = LineUtility.midPoint(pt0, pt1, 0);
                        dist = LineUtility.calcDistance(pt0, midpt) - stringWidthEchelonSymbol / 1.5;
                        ptEchelonStart = LineUtility.extendAlongLine(pt0, pt1, dist);
                        dist = LineUtility.calcDistance(pt0, midpt) + stringWidthEchelonSymbol / 1.5;
                        ptEchelonEnd = LineUtility.extendAlongLine(pt0, pt1, dist);
                        if (segShape != null) {
                            segShape.lineTo(ptEchelonStart);
                            segShape.moveTo(ptEchelonEnd);
                        } else {
                            shape.lineTo(ptEchelonStart);
                            shape.moveTo(ptEchelonEnd);
                        }
                    }
                    if (segShape != null) {
                        segShape.lineTo(pt1);
                    } else {
                        shape.lineTo(pt1);
                    }
                    if (segShape != null) {
                        shapes.push(segShape);
                    }
                }//end for
                shapes.push(shape);
                break;
            }

            default: {
                break;
            }

        }
    } catch (exc) {
        if (exc instanceof Error) {
            ErrorLogger.LogException(_className, "GetIntegralTextShapes",
                exc);
        } else {
            throw exc;
        }
    }
}

/**
 * Displays the modifiers to a Graphics2D from a BufferedImage
 *
 * @param tg the tactical graphic
 * @param g2d the Graphic for drawing
 * @param shapes the shape array
 * @param isTextFlipped true if text is flipped
 * @param converter to convert between geographic and pixel coordinates
 */
export function displayModifiers2(tg: TacticalGraphic,
    g2d: Graphics2D,
    shapes: Array<Shape2>,
    isTextFlipped: boolean,
    converter: IPointConversion): void {
    try {
        if (shapes == null) {
            return;
        }

        if (tg.modifiers == null || tg.modifiers.length === 0) {
            return;
        }
        let font: Font;
        let j: number = 0;
        let modifier: Modifier2;
        let fontBackColor: Color = tg.fontBackColor;
        let theta: number = 0;
        let stringWidth: number = 0;
        let stringHeight: number = 0;
        let s: string = "";
        let image: SVGSymbolInfo;
        let x: number = 0;
        let y: number = 0;
        let pt0: POINT2;
        let pt1: POINT2;
        let pt2: POINT2;
        let pt3: POINT2;
        let quadrant: number = -1;
        let shape2: Shape2;
        let lineType: number = tg.lineType;
        font = tg.font;    //might have to change this
        if (font == null) {
            font = g2d.getFont();
        }
        if (font.getSize() === 0) {
            return;
        }
        g2d.setFont(font);
        let metrics: FontMetrics = g2d.getFontMetrics();
        //we need a background color
        if (fontBackColor != null) {
            g2d.setBackground(fontBackColor);
        } else {
            g2d.setBackground(Color.white);
        }

        let direction: number = -1;
        let glyphPosition: Point;
        for (j = 0; j < tg.modifiers.length; j++) {
            modifier = tg.modifiers[j] as Modifier2;

            let lineFactor: number = modifier.lineFactor;

            if (isTextFlipped) {
                lineFactor = -lineFactor;
            }

            s = modifier.text;
            if (s == null || s === "") {

                image = modifier.image;
                if (image == null) {
                    continue;
                }
            }
            stringWidth = s != null ? metrics.stringWidth(s) as number + 1 : image.getSymbolBounds().width + 1;
            stringHeight = s != null ? font.getSize() as number : image.getSymbolBounds().height;

            let x1: number = 0;
            let y1: number = 0;
            let x2: number = 0;
            let y2: number = 0;
            let dist: number = 0;
            pt0 = modifier.textPath[0];
            x1 = Math.round(pt0.x);
            y1 = Math.round(pt0.y);
            pt1 = modifier.textPath[1];
            x2 = Math.round(pt1.x);
            y2 = Math.round(pt1.y);
            theta = Math.atan2(y2 - y1, x2 - x1);
            let midPt: POINT2;
            if (x1 > x2) {
                theta -= Math.PI;
            }
            pt0 = new POINT2(x1, y1);
            pt1 = new POINT2(x2, y2);
            midPt = new POINT2((x1 + x2) / 2, (y1 + y2) / 2);
            let modifierPosition: Point2D;  //use this if using justify
            let justify: number = ShapeInfo.justify_left;
            switch (modifier.type) {
                case aboveEnd: // On line
                case toEnd: { // Next to line
                    if (x1 === x2) {
                        x2 += 1;
                    }

                    if (lineFactor >= 0) {
                        direction = 2;
                    } else {
                        direction = 3;
                    }

                    if (lineType === TacticalLines.LC || tg.client.toLowerCase() === "ge") {
                        direction = LineUtility.reverseDirection(direction);
                    }

                    if ((modifier.type === toEnd && x1 < x2) || (modifier.type === aboveEnd && x2 < x1)) {
                        justify = ShapeInfo.justify_right;
                    } else {
                        justify = ShapeInfo.justify_left;
                    }

                    pt3 = LineUtility.ExtendDirectedLine(pt1, pt0, pt0, direction, lineFactor * stringHeight);

                    glyphPosition = new Point(pt3.x as number, pt3.y as number);
                    modifierPosition = new Point2D(pt3.x, pt3.y);
                    break;
                }

                case aboveStartInside: {
                    pt3 = LineUtility.extendAlongLine(pt0, pt1, stringWidth);

                    glyphPosition = new Point(pt3.x as number, pt3.y as number);
                    modifierPosition = new Point2D(pt3.x as number, pt3.y);
                    break;
                }

                case aboveEndInside: {
                    pt3 = LineUtility.extendAlongLine(pt1, pt0, stringWidth);

                    glyphPosition = new Point(pt3.x as number, pt3.y as number);
                    modifierPosition = new Point2D(pt3.x as number, pt3.y);
                    break;
                }

                case aboveMiddle:
                case aboveMiddlePerpendicular: {
                    pt2 = midPt;
                    if (tg.client === "2D") {
                        lineFactor += 0.5;
                    }

                    if (lineFactor >= 0) {
                        pt3 = LineUtility.ExtendDirectedLine(pt0, pt2, pt2, 3, Math.abs((lineFactor) * stringHeight));
                        midPt = LineUtility.ExtendDirectedLine(pt0, midPt, midPt, 3, Math.abs((lineFactor) * stringHeight));
                    } else {
                        pt3 = LineUtility.ExtendDirectedLine(pt0, pt2, pt2, 2, Math.abs((lineFactor) * stringHeight));
                        midPt = LineUtility.ExtendDirectedLine(pt0, midPt, midPt, 2, Math.abs((lineFactor) * stringHeight));
                    }
                    //pt3=LineUtility.ExtendDirectedLine(pt0, pt2, pt2, 2, lineFactor*stringHeight);
                    if (x1 === x2 && y1 > y2) {
                        pt3 = LineUtility.ExtendDirectedLine(pt0, pt2, pt2, 1, Math.abs((lineFactor) * stringHeight));
                        midPt = LineUtility.ExtendDirectedLine(pt0, midPt, midPt, 1, Math.abs((lineFactor) * stringHeight));
                    }
                    if (x1 === x2 && y1 < y2) {
                        pt3 = LineUtility.ExtendDirectedLine(pt0, pt2, pt2, 0, Math.abs((lineFactor) * stringHeight));
                        midPt = LineUtility.ExtendDirectedLine(pt0, midPt, midPt, 0, Math.abs((lineFactor) * stringHeight));
                    }

                    glyphPosition = new Point(pt3.x as number, pt3.y as number);
                    justify = ShapeInfo.justify_center;
                    modifierPosition = new Point2D(midPt.x, midPt.y);

                    if (modifier.type === aboveMiddlePerpendicular) {
                        // Need to negate the original rotation
                        if (x1 > x2) {
                            theta += Math.PI;
                        }
                        // Adjust the label rotation based on the y values
                        if (y1 > y2) {
                            theta += Math.PI;
                        }
                        // Rotate by 90 degrees. This is how we rotate the label perpendicular to the line
                        theta -= Math.PI / 2;
                    }
                    break;
                }

                case area: {
                    theta = 0;

                    //y = (int) y1 + (int) (stringHeight / 2) + (int) (1.25 * lineFactor * stringHeight);
                    y = y1 as number + (stringHeight / 2) as number + (lineFactor * stringHeight) as number;
                    x = image != null ? (x1 - stringWidth / 3) as number : x1 as number;

                    glyphPosition = new Point(x, y);
                    justify = ShapeInfo.justify_center;
                    modifierPosition = new Point2D(x, y);
                    break;
                }

                case areaImage: {
                    glyphPosition = new Point(x1 as number, y1 as number);
                    justify = ShapeInfo.justify_center;
                    modifierPosition = new Point2D(x1 as number, y1 as number);
                    break;
                }

                case screen: {    //for SCREEN, GUARD, COVER, not currently used
                    if (tg.Pixels.length >= 14) {
                        pt1 = tg.Pixels[3];
                        pt2 = tg.Pixels[10];
                        quadrant = LineUtility.GetQuadrantDouble(pt1, pt2);
                        theta = Math.atan2(pt2.y - pt1.y, pt2.x - pt1.x);
                        if (Math.abs(theta) < Math.PI / 8) {
                            if (theta < 0) {
                                theta -= Math.PI / 2;
                            } else {
                                theta += Math.PI / 2;
                            }
                        }
                        switch (quadrant) {
                            case 1: {
                                theta += Math.PI / 2;
                                break;
                            }

                            case 2: {
                                theta -= Math.PI / 2;
                                break;
                            }

                            case 3: {
                                theta -= Math.PI / 2;
                                break;
                            }

                            case 4: {
                                theta += Math.PI / 2;
                                break;
                            }

                            default: {
                                break;
                            }

                        }

                        x = x1 as number - stringWidth as number / 2;
                        y = y1 as number - Math.trunc(stringHeight / 2) + (lineFactor * stringHeight) as number;
                        y = y1 as number + (stringHeight / 2) as number + (lineFactor * stringHeight) as number;
                    } else {
                        theta = 0;
                        x = tg.Pixels[0].x as number;
                        y = tg.Pixels[0].y as number;
                        x = x as number - stringWidth as number / 2;
                        y = y as number - Math.trunc(stringHeight / 2) + (lineFactor * stringHeight) as number;
                        y = y as number + (stringHeight / 2) as number + (lineFactor * stringHeight) as number;
                    }

                    glyphPosition = new Point(x, y);
                    //glyphPosition=new Point2D(x,y);
                    break;
                }

                default: {
                    break;
                }

            }   //end switch

            shape2 = new Shape2(Shape2.SHAPE_TYPE_MODIFIER_FILL);

            shape2.setStroke(new BasicStroke(0, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND, 3));

            if (tg.textColor != null) {
                shape2.setFillColor(tg.textColor);
            } else {
                if (tg.lineColor != null) {
                    shape2.setFillColor(tg.lineColor);
                }
            }

            if (tg.lineColor != null) {
                shape2.setLineColor(tg.lineColor);
            }
            //only GE uses the converter, generic uses the affine transform and draws at 0,0
            if (converter != null) {
                shape2.setGlyphPosition(glyphPosition);
            } else {
                shape2.setGlyphPosition(new Point2D(0, 0));
            }
            //shape2.setGlyphPosition(new Point(0,0));
            //added two settings for use by GE
            if (s != null && s !== "") {
                shape2.setModifierString(s);
                let tl: TextLayout = new TextLayout(s, font, g2d.getFontMetrics().getFontRenderContext());
                shape2.setTextLayout(tl);
                shape2.setTextJustify(justify);
            } else {
                if (image != null) {
                    shape2.setModifierImage(image);
                }
            }

            //shape2.setModifierStringPosition(glyphPosition);//M. Deutch 7-6-11
            shape2.setModifierAngle(theta * 180 / Math.PI);
            shape2.setModifierPosition(modifierPosition);

            if (shape2 != null) {
                shapes.push(shape2);
            }

        }   //end for
    } catch (exc) {
        if (exc instanceof Error) {
            ErrorLogger.LogException(_className, "DisplayModifiers2",
                exc);
        } else {
            throw exc;
        }
    }
}//end function

/**
 * Builds a shape object to wrap text
 *
 * @param g2d the Graphic object for drawing
 * @param str text to wrap
 * @param font the draw font
 * @param tx the drawing transform, text rotation and translation
 * @return
 */
export function getTextShape(g2d: Graphics2D,
    str: string,
    font: Font,
    tx: AffineTransform): Shape {
    let tl: TextLayout;
    let frc: FontRenderContext;
    try {
        frc = g2d.getFontRenderContext();
        tl = new TextLayout(str, font, frc);
    } catch (exc) {
        if (exc instanceof Error) {
            ErrorLogger.LogException(_className, "getTextShape",
                exc);
        } else {
            throw exc;
        }
    }
    return tl.getOutline(tx);
}

/**
 * Creates text outline as a shape
 *
 * @param originalText the original text
 * @return text shape
 */
export function createTextOutline(originalText: Shape2): Shape2 {
    let siOutline: Shape2;
    try {
        let outline: Shape = originalText.getShape();

        siOutline = new Shape2(Shape2.SHAPE_TYPE_MODIFIER_FILL);
        siOutline.setShape(outline);

        if (originalText.getFillColor().getRed() === 255
            && originalText.getFillColor().getGreen() === 255
            && originalText.getFillColor().getBlue() === 255) {
            siOutline.setLineColor(Color.BLACK);
        } else {
            siOutline.setLineColor(Color.WHITE);
        }

        let width: number = rendererSettings.getTextOutlineWidth();

        siOutline.setStroke(new BasicStroke(width, BasicStroke.CAP_ROUND,
            BasicStroke.JOIN_ROUND, 3));

    } catch (exc) {
        if (exc instanceof Error) {
            ErrorLogger.LogException(_className, "createTextOutline",
                exc);
        } else {
            throw exc;
        }
    }
    return siOutline;
}

/**
 * Channels don't return points in tg.Pixels. For Channels modifiers we only
 * need to collect the points, don't need internal arrays, and can calculate
 * on which segments the modifiers lie.
 *
 * @param shape
 * @return
 */
function getShapePoints(shape: Shape): Array<POINT2> | null {
    try {
        let ptsPoly: Array<Point2D> = new Array();
        let ptPoly: Point2D;
        let coords: number[] = new Array<number>(6);
        let zeros: number = 0;
        for (let i: PathIterator = shape.getPathIterator(null); !i.isDone(); i.next()) {
            let type: number = i.currentSegment(coords);
            if (type === 0 && zeros === 2) {
                break;
            }
            switch (type) {
                case IPathIterator.SEG_MOVETO: {
                    ptPoly = new Point2D(coords[0], coords[1]);
                    ptsPoly.push(ptPoly);
                    zeros++;
                    break;
                }

                case IPathIterator.SEG_LINETO: {
                    ptPoly = new Point2D(coords[0], coords[1]);
                    ptsPoly.push(ptPoly);
                    break;
                }

                case IPathIterator.SEG_QUADTO: { //quadTo was never used
                    break;
                }

                case IPathIterator.SEG_CUBICTO: {  //curveTo was used for some METOC's
                    break;
                }

                case IPathIterator.SEG_CLOSE: {    //closePath was never used
                    break;
                }


                default:

            }
        }
        if (ptsPoly.length > 0) {
            let pts: Array<POINT2>;
            pts = new Array();
            for (let j: number = 0; j < ptsPoly.length; j++) {
                let pt2d: Point2D = ptsPoly[j];
                let pt: POINT2 = new POINT2(pt2d.getX(), pt2d.getY());
                pts.push(pt);
            }
            return pts;
        }
    } catch (exc) {
        if (exc instanceof Error) {
            ErrorLogger.LogException(_className, "getshapePoints",
                exc);
        } else {
            throw exc;
        }
    }
    return null;
}
