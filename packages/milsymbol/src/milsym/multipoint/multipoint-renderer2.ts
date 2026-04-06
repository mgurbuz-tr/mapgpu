import { BasicStroke } from "../graphics/BasicStroke"
import { Graphics2D } from "../graphics/Graphics2D"
import { Point2D } from "../graphics/Point2D"
import { Rectangle } from "../graphics/Rectangle"
import { Rectangle2D } from "../graphics/Rectangle2D"
import { arraysupport } from "../generators/line-generator"
import { CELineArray } from "../generators/line-array"
import { LineUtility } from "../math/line-ops"
import { POINT2 } from "../types/point"
import { Shape2 } from "../generators/shape2"
import { TacticalLines } from "../types/enums"
import { ChannelUtils } from "../tactical/channel-utils"
import { TacticalUtils as clsUtilityJTR } from "../tactical/tactical-utils"
import { Modifier2 } from "../tactical/modifier-placement"
import { TacticalGraphic } from "../tactical/tactical-graphic"
import { Color } from "../renderer/utilities/Color"
import { ErrorLogger } from "../renderer/utilities/ErrorLogger"
import { IPointConversion } from "../renderer/utilities/IPointConversion"
import { MSInfo } from "../renderer/utilities/MSInfo"
import { msLookup } from "../renderer/utilities/MSLookup"
import { rendererSettings } from "../renderer/utilities/RendererSettings"
import { MultipointUtils } from "./multipoint-utils"
import { CPOFUtils } from "./cpof-utils"
import { METOC } from "../tactical/metoc";


/**
 * Rendering helper class
 *
 */
export class MultipointRenderer2 {
    private static readonly _className: string = "MultipointRenderer2";
    /**
     * MSR and ASR use segment data for segment colors
     * Assumes tg.H has been revised for clipping
     * @param tg
     * @param shapes 
     */
    private static getMSRShapes(tg: TacticalGraphic,
        shapes: Array<Shape2>): void {
        try {
            let linetype: number = tg.lineType;
            if (linetype !== TacticalLines.MSR && linetype !== TacticalLines.ASR && linetype !== TacticalLines.TRAFFIC_ROUTE) {
                return;
            }


            let hmap: Map<number, Color> = clsUtilityJTR.getMSRSegmentColors(tg);
            let shape: Shape2;

            let stroke: BasicStroke = clsUtilityJTR.getLineStroke(tg.lineThickness, tg.lineStyle, tg.lineCap, BasicStroke.JOIN_ROUND);

            let j: number = 0;
            let n: number = tg.Pixels.length;
            let color: Color;
            let segShape: Shape2;
            shape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
            shape.setLineColor(tg.lineColor);
            shape.setStroke(stroke);

            //if colors are not set then use one shape
            //assumes colors may be set if string is comma delimited
            //            String strH=tg.h;
            //            if(strH != null && strH.length > 0)
            //            {               
            //                String[] strs=strH.split(",");
            //                if(strs.length<2)
            //                {
            //                    shape.moveTo(tg.Pixels[0]);
            //                    //n=tg.Pixels.length;
            //                    //for(j=1;j<tg.Pixels.length;j++)
            //                    for(j=1;j<n;j++)
            //                    {
            //                        shape.lineTo(tg.Pixels[j]);
            //                    }
            //                    shapes.push(shape);
            //                    return;
            //                }
            //            }

            //if the hashmap contains the segment then use the color corresponding to the segment
            //in the hashtable to create a one segment shape to add to the shape array.
            //else sdd the segment to the original shape
            let lastColor: Color;   //diagnostic
            let dist: number = 0;
            let dist2: number = 0;
            let pt0: POINT2;
            let pt1: POINT2;
            let lastPt: POINT2;
            //for(j=0;j<tg.Pixels.length-1;j++)
            for (j = 0; j < n - 1; j++) {
                pt0 = tg.Pixels[j];
                pt1 = tg.Pixels[j + 1];
                if (hmap != null && hmap.has(j)) {
                    color = hmap.get(j) as Color;
                    if (color !== lastColor) {
                        if (segShape != null) {

                            shapes.push(segShape);
                        }


                        segShape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                        segShape.setLineColor(color);
                        segShape.style = tg.lineStyle;
                        segShape.setStroke(stroke);
                    }
                    segShape.moveTo(pt0);
                    segShape.lineTo(pt1);
                    //lastColor=new Color(Integer.toHexString(color.getRGB()));
                    lastColor = color;
                }
                else {
                    if (hmap != null && hmap.has(j + 1)) {
                        shape.moveTo(pt0);
                        shape.lineTo(pt1);
                        lastPt = new POINT2(pt1);
                    }
                    else {
                        if (hmap != null && hmap.has(j - 1)) {
                            shape.moveTo(pt0);
                            shape.lineTo(pt1);
                            lastPt = new POINT2(pt1);
                        }
                        else {
                            if (j === tg.Pixels.length - 2) {
                                shape.moveTo(pt0);
                                shape.lineTo(pt1);
                            }
                            else {
                                if (lastPt == null) {
                                    lastPt = new POINT2(pt0);
                                    shape.moveTo(lastPt);
                                    //shape.lineTo(lastPt);
                                }
                                dist = LineUtility.calcDistance(pt0, pt1);
                                if (dist > 10) {
                                    //shape.moveTo(pt0);
                                    shape.lineTo(pt1);
                                    lastPt = new POINT2(pt1);
                                }
                                else {
                                    dist2 = LineUtility.calcDistance(lastPt, pt1);
                                    if (dist2 > 10) {
                                        //shape.moveTo(pt0);
                                        shape.lineTo(pt1);
                                        lastPt = new POINT2(pt1);
                                    }
                                }
                            }
                        }

                    }

                    //shapes.push(shape);
                }
            }
            if (segShape != null) {
                shapes.push(segShape);
            }


            shapes.push(shape);
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(MultipointRenderer2._className, "getMSRShapes",
                    exc);
            } else {
                throw exc;
            }
        }
    }
    /**
     * 
     * @param tg
     * @param converter client converter
     * @param isTextFlipped
     * @return
     */
    public static GetLineArray(tg: TacticalGraphic,
        converter: IPointConversion,
        isTextFlipped: boolean,
        clipBounds: Rectangle2D | Rectangle | Array<Point2D> | null): Array<Shape2> | null {
        let shapes: Array<Shape2> = new Array();
        try {
            if (tg.Pixels == null || tg.Pixels.length === 0) {

                return null;
            }

            let x: number = 0;
            let y: number = 0;
            let width: number = 0;
            let height: number = 0;
            let clipBounds2: Rectangle2D;

            let clipRect: Rectangle2D;
            let clipArray: Array<Point2D>;
            if (clipBounds != null) {
                if (clipBounds instanceof Rectangle2D) {
                    //clipRect=(Rectangle2D)clipBounds;
                    clipRect = clipBounds as Rectangle2D;
                    x = clipRect.getMinX() - 50;
                    y = clipRect.getMinY() - 50;
                    width = clipRect.getWidth() + 100;
                    height = clipRect.getHeight() + 100;
                    clipBounds2 = new Rectangle2D(x, y, width, height);
                } else if (clipBounds instanceof Rectangle) {
                    let rectx: Rectangle = clipBounds as Rectangle;
                    clipRect = new Rectangle2D(rectx.x, rectx.y, rectx.width, rectx.height);
                    x = clipRect.getMinX() - 50;
                    y = clipRect.getMinY() - 50;
                    width = clipRect.getWidth() + 100;
                    height = clipRect.getHeight() + 100;
                    clipBounds2 = new Rectangle2D(x, y, width, height);
                } else if (clipBounds instanceof Array) {
                    clipArray = clipBounds as Array<Point2D>;
                    clipBounds2 = MultipointUtils.getMBR(clipArray);
                }



            }

            let lineType: number = tg.lineType;
            // In some cases render shapes as another line type but return to input line type before adding modifiers
            let inputLineType: number = lineType;

            // Render complex arrows as simple arrow when very small
            let DPIScaleFactor: number = rendererSettings.getDeviceDPI() / 96.0;
            if ((lineType === TacticalLines.FOLLA || lineType === TacticalLines.FOLSP || lineType === TacticalLines.CONVOY)
                && LineUtility.calcDistance(tg.Pixels[0], tg.Pixels[1]) <= 30 * DPIScaleFactor) {
                lineType = TacticalLines.DIRATKSPT;
                tg.lineType = lineType;
            }

            let minPoints2: number = 0;
            let msInfo: MSInfo = msLookup.getMSLInfo(tg.symbolId);
            if (msInfo != null) {
                minPoints2 = msInfo.getMinPointCount();
            } else {
                minPoints2 = -1;
            }
            let bolResult: boolean = clsUtilityJTR.IsChange1Area(lineType);
            let bolMeTOC: number = METOC.IsWeather(tg.symbolId);

            let pts: Array<POINT2> = new Array();
            //uncomment one line for usas1314
            let usas1314: boolean = true;
            let j: number = 0;
            let n: number = tg.Pixels.length;
            if (tg.lineType === TacticalLines.SINGLEC) {
                //reverse single concertina
                pts = [...tg.Pixels];
                //for(j=0;j<tg.Pixels.length;j++)
                for (j = 0; j < n; j++) {
                    tg.Pixels[j] = pts[pts.length - j - 1];
                }

            }

            let g2d: Graphics2D = new Graphics2D();
            g2d.setFont(tg.font);

            if (tg.Pixels.length < minPoints2) {
                bolResult = false;
            }

            if (bolResult) {
                tg.Pixels.length = 0; // tg.Pixels.clear()
                bolResult = CPOFUtils.Change1TacticalAreas(tg, lineType, converter, shapes);
            }
            else {
                if (bolMeTOC > 0) {
                    if (tg.Pixels.length < 2) {
                        return null;
                    }

                    try {
                        METOC.GetMeTOCShape(tg, shapes);
                    } catch (exc) {
                        if (exc instanceof Error) {
                            ErrorLogger.LogException(MultipointRenderer2._className, "GetLineArray",
                                exc);
                        } else {
                            throw exc;
                        }
                    }
                }
                else {
                    //this will help with click-drag mode
                    if (tg.Pixels.length < 2) {
                        if(lineType != TacticalLines.BS_CROSS)
                            return null;
                    }


                    if (CELineArray.CIsChannel(lineType) === 0) {
                        if (lineType === TacticalLines.ASR || lineType === TacticalLines.MSR || lineType === TacticalLines.TRAFFIC_ROUTE) {
                            MultipointRenderer2.getMSRShapes(tg, shapes);
                        }
                        else {
                            tg.Pixels = arraysupport.GetLineArray2(tg, tg.Pixels, shapes, clipBounds2, converter);
                        }
                    }
                    else //channel type
                    {
                        ChannelUtils.DrawChannel(tg.Pixels, lineType, tg, shapes, null, clipBounds2, converter);
                    }
                }
            }

            //set CELineArray.shapes properties
            if (bolMeTOC <= 0) {
                if (lineType !== TacticalLines.ASR && lineType !== TacticalLines.MSR && lineType !== TacticalLines.TRAFFIC_ROUTE) {
                    clsUtilityJTR.SetShapeProperties(tg, shapes);
                }

            }

            if (lineType !== inputLineType) {
                // lineType was switched temporarily while rendering shapes
                tg.lineType = inputLineType;
            }

            //at this point tg.Pixels has the points from CELineArray
            //the following line adds modifiers for those sybmols which require
            //the calculated points to use for the modifiers.
            //currentlly only BLOCK and CONTAIN use tg.Pixels for computing
            //the modifiers after the call to GetLineArray
            //Modifier2.AddModifiers2(tg);//flipped only for 3d for change 1 symbols
            Modifier2.AddModifiers2(tg, converter);

            //boundary has shapes for line break
            Modifier2.GetIntegralTextShapes(tg, g2d, shapes);
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(MultipointRenderer2._className, "GetLineArray",
                    exc);
            } else {
                throw exc;
            }
        }
        return shapes;
    }
    /**
     * Isolate and others require special handling for the fill shapes.
     * @param tg 
     * @param shapes the existing shapes which characterize the graphic
     */
    static getAutoshapeFillShape(tg: TacticalGraphic, shapes: Array<Shape2>): void {
        try {
            if (shapes == null || shapes.length === 0) {

                return;
            }

            if (tg.Pixels == null || tg.Pixels.length === 0) {

                return;
            }

            if (tg.fillColor == null) {

                return;
            }


            let linetype: number = tg.lineType;
            let j: number = 0;
            let shape: Shape2 = new Shape2(Shape2.SHAPE_TYPE_FILL);
            shape.setFillColor(tg.fillColor);
            shape.setLineColor(null);
            let t: number = shapes.length;
            let n: number = tg.Pixels.length;
            switch (linetype) {
                case TacticalLines.RETAIN: {
                    if (shapes != null && shapes.length > 0) {

                        //for(j=0;j<shapes.length;j++)
                        for (j = 0; j < t; j++) {

                            shapes[j].setFillColor(null);
                        }

                    }


                    shape.moveTo(tg.Pixels[0]);
                    for (j = 1; j < 26; j++) {

                        shape.lineTo(tg.Pixels[j]);
                    }


                    shape.lineTo(tg.Pixels[0]);
                    shapes.splice(0, 0, shape);
                    break;
                }

                case TacticalLines.SECURE:
                case TacticalLines.OCCUPY: {
                    if (shapes != null && shapes.length > 0) {

                        //for(j=0;j<shapes.length;j++)
                        for (j = 0; j < t; j++) {

                            shapes[j].setFillColor(null);
                        }

                    }


                    shape.moveTo(tg.Pixels[0]);
                    //for(j=1;j<tg.Pixels.length-3;j++)                    
                    for (j = 1; j < n - 3; j++) {

                        shape.lineTo(tg.Pixels[j]);
                    }


                    shape.lineTo(tg.Pixels[0]);
                    shapes.splice(0, 0, shape);
                    break;
                }

                case TacticalLines.CONVOY:
                case TacticalLines.HCONVOY: {
                    if (shapes != null && shapes.length > 0) {

                        //for(j=0;j<shapes.length;j++)
                        for (j = 0; j < t; j++) {

                            shapes[j].setFillColor(null);
                        }

                    }


                    shape.moveTo(tg.Pixels[0]);
                    //for(j=1;j<tg.Pixels.length;j++)                    
                    for (j = 1; j < n; j++) {

                        shape.lineTo(tg.Pixels[j]);
                    }


                    shape.lineTo(tg.Pixels[0]);
                    shapes.splice(0, 0, shape);
                    break;
                }

                case TacticalLines.CORDONSEARCH:
                case TacticalLines.CORDONKNOCK:
                case TacticalLines.ISOLATE: {
                    //set the fillcolor to null for the existing shapes
                    //we are going to create a new fill shape
                    if (shapes != null && shapes.length > 0) {

                        //for(j=0;j<shapes.length;j++)
                        for (j = 0; j < t; j++) {

                            shapes[j].setFillColor(null);
                        }

                    }


                    shape.moveTo(tg.Pixels[0]);
                    for (j = 26; j < 47; j++) {

                        shape.lineTo(tg.Pixels[j]);
                    }


                    shape.lineTo(tg.Pixels[23]);
                    shape.lineTo(tg.Pixels[24]);
                    shape.lineTo(tg.Pixels[25]);
                    shape.lineTo(tg.Pixels[0]);
                    shapes.splice(0, 0, shape);
                    break;
                }

                default: {
                    return;
                }

            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(MultipointRenderer2._className, "getAutoshapeFillShape",
                    exc);
            } else {
                throw exc;
            }
        }
    }
}
