
import { AffineTransform } from "../graphics/AffineTransform"
import { BasicStroke } from "../graphics/BasicStroke"
import { Font } from "../graphics/Font"
import { FontMetrics } from "../graphics/FontMetrics"
import { FontRenderContext } from "../graphics/FontRenderContext"
import { Graphics2D } from "../graphics/Graphics2D"
import { Line2D } from "../graphics/Line2D"
import { PathIterator } from "../graphics/PathIterator"
import { Point } from "../graphics/Point"
import { Point2D } from "../graphics/Point2D"
import { Polygon } from "../graphics/Polygon"
import { Rectangle2D } from "../graphics/Rectangle2D"
import { Shape } from "../graphics/Shape"
import { TextLayout } from "../graphics/TextLayout"
import { arraysupport } from "../generators/line-generator"
import { Channels } from "../generators/channel-generator"
import { LineUtility } from "../math/line-ops"
import { POINT2 } from "../types/point"
import { Shape2 } from "../generators/shape2"
import { TacticalLines } from "../types/enums"
import { Geodesic } from "../math/geodesic"
import { TacticalGraphic } from "./tactical-graphic"
import { Color } from "../renderer/utilities/Color"
import { EntityCode } from "../renderer/utilities/EntityCode"
import { ErrorLogger } from "../renderer/utilities/ErrorLogger"
import { IPointConversion } from "../renderer/utilities/IPointConversion"
import { MilStdAttributes } from "../renderer/utilities/MilStdAttributes"
import { rendererSettings } from "../renderer/utilities/RendererSettings"
import { RendererUtilities } from "../renderer/utilities/RendererUtilities"
import { ShapeInfo } from "../renderer/utilities/ShapeInfo"
import { SymbolID } from "../renderer/utilities/SymbolID"
import { TacticalUtils } from "./tactical-utils";
import { IPathIterator } from "../graphics/IPathIterator";
import { singlePointSVGRenderer } from "../renderer/SinglePointSVGRenderer";
import { SVGSymbolInfo } from "../renderer/utilities/SVGSymbolInfo";
import { getCenterLabel } from "./labels"
import {
    displayModifiers as _displayModifiers,
    buildModifierShape as _buildModifierShape,
    getIntegralTextShapes as _getIntegralTextShapes,
    displayModifiers2 as _displayModifiers2,
    getTextShape as _getTextShape,
    createTextOutline as _createTextOutline,
} from "./modifier-shapes"


/**
 * This class handles everything having to do with text for a
 * tactical graphic. Note: labels are handled the same as text modifiers.
 *
 *
 */
export class Modifier2 {
    public textPath: POINT2[];
    private textID: string;
    private featureID: string;
    public text: string;

    public image: SVGSymbolInfo;
    private iteration: number = 0;
    private justify: number = 0;
    public type: number = 0;
    public lineFactor: number = 0;
    private static readonly _className: string = "Modifier2";
    public isIntegral: boolean = false;
    private fitsMBR: boolean = true;

    protected constructor() {
        this.textPath = new Array<POINT2>(2);
    }

    private static readonly toEnd: number = 1; // Put next to pt0 on opposite side of line
    private static readonly aboveMiddle: number = 2;    //use both points
    private static readonly area: number = 3;   //use one point
    private static readonly screen: number = 4;   //use one point, screen, cover, guard points
    private static readonly aboveEnd: number = 5; // Put next to pt0 on line
    private static readonly aboveMiddlePerpendicular: number = 6; //use both points
    private static readonly aboveStartInside: number = 7; //place at the start inside the shape
    private static readonly aboveEndInside: number = 8;  //place at the end inside the shape
    private static readonly areaImage: number = 9;   //use one point
    private static fillAlphaCanObscureText: number = 50;

    private static DoublesBack(pt0: POINT2, pt1: POINT2, pt2: POINT2): boolean {
        let result: boolean = true;
        try {
            let theta1: number = Math.atan2(pt2.y - pt1.y, pt2.x - pt1.x);
            let theta0: number = Math.atan2(pt0.y - pt1.y, pt0.x - pt1.x);
            let beta: number = Math.abs(theta0 - theta1);
            if (beta > 0.1) {
                result = false;
            }

        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(Modifier2._className, "DoublesBack",
                    exc);
            } else {
                throw exc;
            }
        }
        return result;
    }

    /**
     * Returns a generic label for the symbol per Mil-Std-2525.
     * Delegates to standalone function in labels.ts.
     */
    public static GetCenterLabel(tg: TacticalGraphic): string {
        return getCenterLabel(tg);
    }
    //non CPOF clients using best fit need these accessors

    public get_TextPath(): POINT2[] {
        return this.textPath;
    }

    protected set_TextPath(value: POINT2[]): void {
        this.textPath = value;
    }

    // set_IsIntegral/get_IsIntegral removed — use public property `isIntegral` directly

    private static AddOffsetModifier(tg: TacticalGraphic,
        text: string,
        type: number,
        lineFactor: number,
        startIndex: number,
        endIndex: number,
        spaces: number,
        rightOrLeft: string): void {
        if (rightOrLeft == null || tg.Pixels == null || tg.Pixels.length < 2 || endIndex >= tg.Pixels.length) {
            return;
        }

        let pt0: POINT2 = tg.Pixels[startIndex];
        let pt1: POINT2 = tg.Pixels[endIndex];
        if (rightOrLeft === "left") {
            pt0.x -= spaces;
            pt1.x -= spaces;
        } else {
            pt0.x += spaces;
            pt1.x += spaces;
        }
        Modifier2.AddModifier2(tg, text, type, lineFactor, pt0, pt1, false);
    }

    /**
     *
     * @param tg
     * @param text
     * @param type
     * @param lineFactor
     * @param ptStart
     * @param ptEnd
     */
    private static AddModifier(tg: TacticalGraphic,
        text: string,
        type: number,
        lineFactor: number,
        ptStart: POINT2,
        ptEnd: POINT2): void {
        if (tg.Pixels == null || tg.Pixels.length < 2) {
            return;
        }
        Modifier2.AddModifier2(tg, text, type, lineFactor, ptStart, ptEnd, false);
    }

    private static AddModifier2(tg: TacticalGraphic,
        text: string,
        type: number,
        lineFactor: number,
        pt0: POINT2,
        pt1: POINT2,
        isIntegral: boolean = false,
        modifierType?: string): void {
        try {
            if (text == null || text === "") {
                return;
            }

            let modifier: Modifier2 = new Modifier2();
            modifier.isIntegral = isIntegral;
            modifier.text = text;
            modifier.type = type;
            modifier.lineFactor = lineFactor;
            modifier.textPath[0] = pt0;
            modifier.textPath[1] = pt1;
            modifier.textID = modifierType;
            tg.modifiers.push(modifier);
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(Modifier2._className, "AddModifier",
                    exc);
            } else {
                throw exc;
            }
        }

    }

    private static AddIntegralModifier(tg: TacticalGraphic,
        text: string,
        type: number,
        lineFactor: number,
        startIndex: number,
        endIndex: number,
        isIntegral: boolean = true,
        modifierType: string | null = null): void {
        if (tg.Pixels == null || tg.Pixels.length === 0 || endIndex >= tg.Pixels.length) {
            return;
        }
        Modifier2.AddIntegralAreaModifier(tg, text, type, lineFactor, tg.Pixels[Math.trunc(startIndex)], tg.Pixels[Math.trunc(endIndex)], isIntegral, modifierType);
    }

    /**
     * sets modifier.textId to the modifier type, e.g. label, T, T1, etc.
     *
     * @param tg
     * @param text
     * @param type
     * @param lineFactor
     * @param pt0
     * @param pt1
     * @param modifierType
     */
    private static AddAreaModifier(tg: TacticalGraphic,
        text: string,
        type: number,
        lineFactor: number,
        pt0: POINT2,
        pt1: POINT2,
        modifierType?: string): void {
        if (modifierType) {
            Modifier2.AddIntegralAreaModifier(tg, text, type, lineFactor, pt0, pt1, true, modifierType);
        } else {
            Modifier2.AddIntegralAreaModifier(tg, text, type, lineFactor, pt0, pt1, true);
        }
    }


    private static AddIntegralAreaModifier(tg: TacticalGraphic,
        text: string,
        type: number,
        lineFactor: number,
        pt0: POINT2,
        pt1: POINT2,
        isIntegral: boolean,
        modifierType?: string): void {
        if (pt0 === undefined || pt1 === undefined) {
            return;
        }
        Modifier2.AddModifier2(tg, text, type, lineFactor, pt0, pt1, isIntegral, modifierType);
    }

    private static AddImageModifier(tg: TacticalGraphic,
        type: number,
        lineFactor: number,
        pt0: POINT2,
        pt1: POINT2,
        isIntegral: boolean): void {
        try {
            if (pt0 == null || pt1 == null) {
                return;
            }

            let symbolID: string = tg.symbolId;
            let symbol: SVGSymbolInfo;
            let mods: Map<string, string> = new Map();
            let sa: Map<string, string> = new Map();
            sa.set(MilStdAttributes.PixelSize, tg.getIconSize().toString());
            let contaminationCode: number = EntityCode.getSymbolForContaminationArea(SymbolID.getEntityCode(symbolID));
            let modifier1Code: number = SymbolID.getModifier1(symbolID);
            let lineType: number = TacticalUtils.GetLinetypeFromString(symbolID);
            if (contaminationCode > 0) {
                sa.set(MilStdAttributes.OutlineSymbol, "true");
                sa.set(MilStdAttributes.FillColor, RendererUtilities.colorToHexString(tg.fillColor, true));
                sa.set(MilStdAttributes.LineColor, RendererUtilities.colorToHexString(tg.lineColor, true));
                let contaminationSP: string = SymbolID.setEntityCode(symbolID, contaminationCode);
                contaminationSP = SymbolID.setHQTFD(contaminationSP, 0); // Remove fdi if necessary
                symbol = singlePointSVGRenderer.RenderSP(contaminationSP, mods, sa);
            } else {
                if (lineType === TacticalLines.DEPICT || lineType === TacticalLines.MINED || lineType === TacticalLines.FENCED || lineType === TacticalLines.MINE_LINE) {
                    if (modifier1Code < 13 || modifier1Code > 50) {
                        // Invalid mine type
                        modifier1Code = 13;//unspecified mine (default value if not specified as per MilStd 2525)
                        symbolID = SymbolID.setModifier1(symbolID, modifier1Code);
                    }
                    if (tg.keepUnitRatio) {
                        sa.set(MilStdAttributes.PixelSize, ((tg.getIconSize() * 1.5) as number).toString());
                    }
                    sa.set(MilStdAttributes.OutlineSymbol, "true");
                    symbol = singlePointSVGRenderer.RenderModifier(symbolID, sa);
                } else if (lineType === TacticalLines.LAA && modifier1Code > 0) {
                    sa.set(MilStdAttributes.OutlineSymbol, "true");
                    sa.set(MilStdAttributes.FillColor, RendererUtilities.colorToHexString(tg.fillColor, true));
                    sa.set(MilStdAttributes.LineColor, RendererUtilities.colorToHexString(tg.lineColor, true));
                    if (tg.keepUnitRatio) {
                        sa.set(MilStdAttributes.PixelSize, ((tg.getIconSize() * 1.5) as number).toString());
                    }
                    symbol = singlePointSVGRenderer.RenderModifier(symbolID, sa);
                } else if (lineType === TacticalLines.ANCHORAGE_LINE || lineType === TacticalLines.ANCHORAGE_AREA) {
                    sa.set(MilStdAttributes.OutlineSymbol, "false");
                    let anchorPoint: string = SymbolID.setEntityCode(symbolID, EntityCode.EntityCode_AnchoragePoint);
                    symbol = singlePointSVGRenderer.RenderSP(anchorPoint, mods, sa);
                }
            }

            if (symbol == null) {
                return;
            }

            let modifier: Modifier2 = new Modifier2();
            modifier.isIntegral = isIntegral;
            modifier.image = symbol;
            modifier.type = type;
            modifier.lineFactor = lineFactor;
            modifier.textPath[0] = pt0;
            modifier.textPath[1] = pt1;
            tg.modifiers.push(modifier);
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(Modifier2._className, "AddAreaModifier",
                    exc);
            } else {
                throw exc;
            }
        }
    }


    /**
     * Returns symbol MBR. Assumes points have been initialized with value of
     * 0th point
     *
     * @param tg the tactical graphic object
     * @param ptUl OUT - MBR upper left
     * @param ptUr OUT - MBR upper right
     * @param ptLr OUT - MBR lower right
     * @param ptLl OUT - MBR lower left
     */
    public static GetMBR(tg: TacticalGraphic,
        ptUl: POINT2,
        ptUr: POINT2,
        ptLr: POINT2,
        ptLl: POINT2): void {
        try {
            let j: number = 0;
            let x: number = 0;
            let y: number = 0;
            ptUl.x = tg.Pixels[0].x;
            ptUl.y = tg.Pixels[0].y;
            ptUr.x = tg.Pixels[0].x;
            ptUr.y = tg.Pixels[0].y;
            ptLl.x = tg.Pixels[0].x;
            ptLl.y = tg.Pixels[0].y;
            ptLr.x = tg.Pixels[0].x;
            ptLr.y = tg.Pixels[0].y;
            let n: number = tg.Pixels.length;
            //for (j = 1; j < tg.Pixels.length; j++)
            for (j = 1; j < n; j++) {
                x = tg.Pixels[j].x;
                y = tg.Pixels[j].y;
                if (x < ptLl.x) {
                    ptLl.x = x;
                    ptUl.x = x;
                }
                if (x > ptLr.x) {
                    ptLr.x = x;
                    ptUr.x = x;
                }
                if (y > ptLl.y) {
                    ptLl.y = y;
                    ptLr.y = y;
                }
                if (y < ptUl.y) {
                    ptUl.y = y;
                    ptUr.y = y;
                }
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(Modifier2._className, "GetMBR",
                    exc);
            } else {
                throw exc;
            }
        }
    }

    /**
     * Tests segment of a Boundary
     *
     * @param tg
     * @param g2d
     * @param middleSegment
     * @return
     */
    public static GetBoundarySegmentTooShort(tg: TacticalGraphic,
        g2d: Graphics2D,
        middleSegment: number): boolean {
        let lineTooShort: boolean = false;
        try {
            //int middleSegment = tg.Pixels.length / 2 - 1;
            g2d.setFont(tg.font);
            let metrics: FontMetrics = g2d.getFontMetrics();
            let echelonSymbol: string;
            let stringWidthEchelonSymbol: number = 0;

            let pt0: POINT2 = tg.Pixels[middleSegment];
            let pt1: POINT2 = tg.Pixels[middleSegment + 1];
            let dist: number = LineUtility.calcDistance(pt0, pt1);

            echelonSymbol = tg.echelonSymbol;

            if (echelonSymbol != null) {
                stringWidthEchelonSymbol = metrics.stringWidth(echelonSymbol);
            }

            let tWidth: number = 0;
            let t1Width: number = 0;
            if (tg.name != null && tg.name.length > 0) {
                tWidth = metrics.stringWidth(tg.name);
            }
            if (tg.t1 != null && tg.t1.length > 0) {
                t1Width = metrics.stringWidth(tg.t1);
            }

            let totalWidth: number = stringWidthEchelonSymbol;
            if (totalWidth < tWidth) {
                totalWidth = tWidth;
            }
            if (totalWidth < t1Width) {
                totalWidth = t1Width;
            }

            switch (tg.lineType) {
                case TacticalLines.BOUNDARY: {
                    if (dist < 1.25 * (totalWidth)) {
                        lineTooShort = true;
                    }
                    break;
                }

                default: {
                    break;
                }

            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(Modifier2._className, "GetBoundaryLineTooShort",
                    exc);
            } else {
                throw exc;
            }
        }
        return lineTooShort;
    }

    /**
     * Handles the line breaks for Boundary and Engineer Work Line
     *
     * @param tg
     * @param g2d
     */
    private static AddBoundaryModifiers(tg: TacticalGraphic,
        g2d: Graphics2D,
        clipBounds: Rectangle2D | Array<Point2D> | null): void {
        try {
            let j: number = 0;
            let csFactor: number = 1;
            let foundSegment: boolean = false;
            let pt0: POINT2;
            let pt1: POINT2;
            let ptLast: POINT2;
            let TLineFactor: number = 0;
            let T1LineFactor: number = 0;
            let lineTooShort: boolean = false;
            let countryCode: string = "";
            if (tg.as !== "") {
                countryCode = " (" + tg.as + ")";
            }
            if (tg.client === "cpof3d") {
                csFactor = 0.85;
            }

            let middleSegment: number = Modifier2.getVisibleMiddleSegment(tg, clipBounds);
            //for (j = 0; j < tg.Pixels.length - 1; j++) {
            for (j = middleSegment; j === middleSegment; j++) {
                /* if (tg.client.equalsIgnoreCase("ge")) {
                    if (j != middleSegment) {
                        continue;
                    }
                }*/

                pt0 = tg.Pixels[j];
                pt1 = tg.Pixels[j + 1];
                if (pt0.x < pt1.x) {
                    TLineFactor = -1.3;
                    T1LineFactor = 1;
                } else {
                    if (pt0.x === pt1.x) {
                        if (pt1.y < pt0.y) {
                            TLineFactor = -1;
                            T1LineFactor = 1;
                        } else {
                            TLineFactor = 1;
                            T1LineFactor = -1;
                        }
                    } else {
                        TLineFactor = 1;
                        T1LineFactor = -1.3;
                    }
                }

                //is the segment too short?
                lineTooShort = Modifier2.GetBoundarySegmentTooShort(tg, g2d, j);

                if (lineTooShort === false) {
                    foundSegment = true;
                    Modifier2.AddIntegralModifier(tg, tg.name + countryCode, Modifier2.aboveMiddle, TLineFactor * csFactor, j, j + 1, true);
                    //the echelon symbol
                    if (tg.echelonSymbol != null && tg.echelonSymbol !== "") {
                        Modifier2.AddIntegralModifier(tg, tg.echelonSymbol, Modifier2.aboveMiddle, -0.20 * csFactor, j, j + 1, true);
                    }
                    //the T1 modifier
                    Modifier2.AddIntegralModifier(tg, tg.t1, Modifier2.aboveMiddle, T1LineFactor * csFactor, j, j + 1, true);
                }
            }//end for loop
            if (foundSegment === false) {
                pt0 = new POINT2();
                pt1 = new POINT2();
                // Get boundary middle segment
                let echelonSymbol: string = tg.echelonSymbol;
                let metrics: FontMetrics = g2d.getFontMetrics();
                let modDist: number = 0;

                if (echelonSymbol != null) {
                    modDist = 1.5 * metrics.stringWidth(echelonSymbol);
                }

                let segDist: number = LineUtility.calcDistance(tg.Pixels[middleSegment], tg.Pixels[middleSegment + 1]);

                g2d.setFont(tg.font);
                let midpt: POINT2 = LineUtility.midPoint(tg.Pixels[middleSegment], tg.Pixels[middleSegment + 1], 0);
                let ptTemp: POINT2;
                if (segDist < modDist) {
                    ptTemp = LineUtility.extendAlongLine(midpt, tg.Pixels[middleSegment], modDist / 2);
                    pt0.x = ptTemp.x;
                    pt0.y = ptTemp.y;
                    ptTemp = LineUtility.extendAlongLine(midpt, tg.Pixels[middleSegment + 1], modDist / 2);
                } else {
                    ptTemp = tg.Pixels[middleSegment];
                    pt0.x = ptTemp.x;
                    pt0.y = ptTemp.y;
                    ptTemp = tg.Pixels[middleSegment + 1];
                }
                pt1.x = ptTemp.x;
                pt1.y = ptTemp.y;

                Modifier2.AddIntegralModifier(tg, tg.name + countryCode, Modifier2.aboveMiddle, TLineFactor * csFactor, middleSegment, middleSegment + 1, true);
                //the echelon symbol
                if (echelonSymbol != null && echelonSymbol !== "") {
                    Modifier2.AddIntegralModifier(tg, echelonSymbol, Modifier2.aboveMiddle, -0.2020 * csFactor, middleSegment, middleSegment + 1, true);
                }
                //the T1 modifier
                Modifier2.AddIntegralModifier(tg, tg.t1, Modifier2.aboveMiddle, T1LineFactor * csFactor, middleSegment, middleSegment + 1, true);
            }//end if foundSegment==false
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(Modifier2._className, "AddBoundaryModifiers",
                    exc);
            } else {
                throw exc;
            }
        }
    }

    /**
     * added for USAS
     *
     * @param tg
     * @param metrics
     * @deprecated
     */
    private static AddNameAboveDTG(tg: TacticalGraphic, metrics: FontMetrics): void {
        try {
            let csFactor: number = 1;
            if (tg.client === "cpof3d") {
                csFactor = 0.667;
            }
            let label: string = Modifier2.GetCenterLabel(tg);
            let pt0: POINT2 = new POINT2(tg.Pixels[0]);
            let pt1: POINT2 = new POINT2(tg.Pixels[1]);
            let lastIndex: number = tg.Pixels.length - 1;
            let nextToLastIndex: number = tg.Pixels.length - 2;
            let ptLast: POINT2 = new POINT2(tg.Pixels[lastIndex]);
            let ptNextToLast: POINT2 = new POINT2(tg.Pixels[nextToLastIndex]);
            Modifier2.shiftModifierPath(tg, pt0, pt1, ptLast, ptNextToLast);
            let stringWidth: number = metrics.stringWidth(label + " " + tg.name);
            Modifier2.AddIntegralAreaModifier(tg, label + " " + tg.name, Modifier2.toEnd, 0, pt0, pt1, false);
            pt1 = LineUtility.extendAlongLine(tg.Pixels[0], tg.Pixels[1], -1.5 * stringWidth);
            Modifier2.AddModifier2(tg, tg.dtg, Modifier2.aboveMiddle, 0.7 * csFactor, pt0, pt1, false);
            Modifier2.AddModifier2(tg, tg.dtg1, Modifier2.aboveMiddle, 1.7 * csFactor, pt0, pt1, false);
            Modifier2.AddIntegralAreaModifier(tg, label + " " + tg.name, Modifier2.toEnd, 0, ptLast, ptNextToLast, false);
            pt0 = tg.Pixels[lastIndex];
            pt1 = LineUtility.extendAlongLine(tg.Pixels[lastIndex], tg.Pixels[nextToLastIndex], -1.5 * stringWidth);
            Modifier2.AddModifier2(tg, tg.dtg, Modifier2.aboveMiddle, 0.7 * csFactor, pt0, pt1, false);
            Modifier2.AddModifier2(tg, tg.dtg1, Modifier2.aboveMiddle, 1.7 * csFactor, pt0, pt1, false);
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(Modifier2._className, "AddNameAboveDTG",
                    exc);
            } else {
                throw exc;
            }
        }
    }

    /**
     * shifts the path for modifiers that use toEnd to prevent vertical paths
     *
     * @param tg
     * @param pt0
     * @param pt1
     * @param ptLast
     * @param ptNextToLast
     */
    private static shiftModifierPath(tg: TacticalGraphic,
        pt0: POINT2,
        pt1: POINT2,
        ptLast: POINT2,
        ptNextToLast: POINT2): void {
        try {
            let p0: POINT2;
            let p1: POINT2;
            let last: number = -1.0;
            switch (tg.lineType) {
                case TacticalLines.BOUNDARY: {
                    for (let j: number = 0; j < tg.Pixels.length - 1; j++) {
                        p0 = tg.Pixels[j];
                        p1 = tg.Pixels[j + 1];
                        //if(p0.x==p1.x)
                        if (Math.abs(p0.x - p1.x) < 1) {
                            p1.x += last;
                            last = -last;
                        }
                    }
                    break;
                }

                case TacticalLines.PDF:
                case TacticalLines.PL:
                case TacticalLines.FEBA:
                case TacticalLines.LOA:
                case TacticalLines.LOD:
                case TacticalLines.RELEASE:
                case TacticalLines.HOL:
                case TacticalLines.BHL:
                case TacticalLines.LDLC:
                case TacticalLines.LL:
                case TacticalLines.EWL:
                case TacticalLines.FCL:
                case TacticalLines.PLD:
                case TacticalLines.NFL:
                case TacticalLines.FLOT:
                case TacticalLines.LC:
                case TacticalLines.HOLD:
                case TacticalLines.BRDGHD:
                case TacticalLines.HOLD_GE:
                case TacticalLines.BRDGHD_GE: {
                    //if (pt0 != null && pt1 != null && pt0.x == pt1.x)
                    if (pt0 != null && pt1 != null && Math.abs(pt0.x - pt1.x) < 1) {
                        pt1.x += 1;
                    }
                    //if (ptLast != null && ptNextToLast != null && ptNextToLast.x == ptLast.x)
                    if (ptLast != null && ptNextToLast != null && Math.abs(ptNextToLast.x - ptLast.x) < 1) {
                        ptNextToLast.x += 1;
                    }
                    break;
                }

                default: {
                    return;
                }

            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(Modifier2._className, "shiftModifierPath",
                    exc);
            } else {
                throw exc;
            }
        }
    }

    /**
     * Adds two or four labels on area outline
     *
     * @param label
     * @param tg
     * @param twoLabelOnly - when true only two labels are added to line (east and west most segment midpoints)
     *                     when false, four labels are added to line (north, south, east and west most segment midpoints)
     */
    private static addModifierOnLine(label: string, tg: TacticalGraphic, twoLabelOnly: boolean = false): void {
        if (label == null || label.length === 0 || tg.Pixels.length === 0) {
            return;
        }
        try {
            let leftPt: POINT2 = LineUtility.midPoint(tg.Pixels[0], tg.Pixels[1], 0);
            let rightPt: POINT2 = LineUtility.midPoint(tg.Pixels[0], tg.Pixels[1], 0);
            let topPt: POINT2 = LineUtility.midPoint(tg.Pixels[0], tg.Pixels[1], 0);
            let bottomPt: POINT2 = LineUtility.midPoint(tg.Pixels[0], tg.Pixels[1], 0);
            for (let j: number = 1; j < tg.Pixels.length - 1; j++) {
                let midPt: POINT2 = LineUtility.midPoint(tg.Pixels[j], tg.Pixels[j + 1], 0);
                if (midPt.x <= leftPt.x) {
                    leftPt = midPt;
                }
                if (midPt.x >= rightPt.x) {
                    rightPt = midPt;
                }
                if (midPt.y <= topPt.y) {
                    topPt = midPt;
                }
                if (midPt.y >= bottomPt.y) {
                    bottomPt = midPt;
                }
            }

            if (leftPt != rightPt)
                Modifier2.AddAreaModifier(tg, label, Modifier2.aboveMiddle, 0, leftPt, leftPt);
            Modifier2.AddAreaModifier(tg, label, Modifier2.aboveMiddle, 0, rightPt, rightPt);
            if (!twoLabelOnly) {
                if (bottomPt != leftPt && bottomPt != rightPt)
                    Modifier2.AddAreaModifier(tg, label, Modifier2.aboveMiddle, 0, bottomPt, bottomPt);
                if (topPt != leftPt && topPt != rightPt && topPt != bottomPt)
                    Modifier2.AddAreaModifier(tg, label, Modifier2.aboveMiddle, 0, topPt, topPt);
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(Modifier2._className, "addModifierOnLine",
                    exc);
            } else {
                throw exc;
            }
        }
    }


    /**
     * Adds N modifier on area outline
     */
    private static addNModifier(tg: TacticalGraphic): void {
        if (tg.isHostile()) {
            Modifier2.addModifierOnLine(tg.n, tg, true);
        }
    }

    private static addModifierBottomSegment(tg: TacticalGraphic, text: string): void {
        let index: number = 0;
        let y: number = tg.Pixels[index].y + tg.Pixels[index + 1].y;
        for (let i: number = 1; i < tg.Pixels.length - 1; i++) {
            if (tg.Pixels[i].y + tg.Pixels[i + 1].y > y) {
                index = i;
                y = tg.Pixels[index].y + tg.Pixels[index + 1].y;
            }
        }
        Modifier2.AddIntegralModifier(tg, text, Modifier2.aboveMiddle, 0, index, index + 1, false);
    }

    private static addModifierTopSegment(tg: TacticalGraphic, text: string): void {
        let index: number = 0;
        let y: number = tg.Pixels[index].y + tg.Pixels[index + 1].y;
        for (let i: number = 1; i < tg.Pixels.length - 1; i++) {
            if (tg.Pixels[i].y + tg.Pixels[i + 1].y < y) {
                index = i;
                y = tg.Pixels[index].y + tg.Pixels[index + 1].y;
            }
        }
        Modifier2.AddIntegralModifier(tg, text, Modifier2.aboveMiddle, 0, index, index + 1, false);
    }

    private static addDTG(tg: TacticalGraphic, type: number, lineFactor1: number, lineFactor2: number, pt0: POINT2, pt1: POINT2, metrics: FontMetrics): void {
        if (pt0 == null || pt1 == null) {

            return;
        }


        let maxDTGWidth: number = 0;
        if (pt0.x === pt1.x && pt0.y === pt1.y) {
            let ptUl: POINT2 = new POINT2();
            let ptUr: POINT2 = new POINT2();
            let ptLr: POINT2 = new POINT2();
            let ptLl: POINT2 = new POINT2();
            Modifier2.GetMBR(tg, ptUl, ptUr, ptLr, ptLl);
            maxDTGWidth = LineUtility.calcDistance(ptUl, ptUr);
        } else {
            maxDTGWidth = LineUtility.calcDistance(pt0, pt1);
        }

        let dash: string = "";
        if (tg.dtg != null && tg.dtg1 != null && tg.dtg.length > 0 && tg.dtg1.length > 0) {
            dash = " - ";
        }

        let combinedDTG: string = tg.dtg + dash + tg.dtg1;

        let stringWidth: number = metrics.stringWidth(combinedDTG);

        if (stringWidth < maxDTGWidth) {
            // Add on one line
            Modifier2.AddModifier(tg, combinedDTG, type, lineFactor1, pt0, pt1);
        } else {
            // add on two lines
            // Use min and max on lineFactors. Always want W1 on top. This fixes when lineFactor < 0 W1 should use lineFactor1
            Modifier2.AddModifier(tg, tg.dtg + dash, type, Math.min(lineFactor1, lineFactor2), pt0, pt1);
            Modifier2.AddModifier(tg, tg.dtg1, type, Math.max(lineFactor1, lineFactor2), pt0, pt1);
        }
    }

    private static getVisibleMiddleSegment(tg: TacticalGraphic, clipBounds: Rectangle2D | Array<Point2D> | null): number {
        let middleSegment: number = -1;
        try {
            let clipBoundsPoly: Polygon;
            let clipRect: Rectangle2D;
            let useClipRect: boolean; // true if clipBounds is Rectangle2D otherwise use clipBoundsPoly
            let pt0: POINT2;
            let pt1: POINT2;
            let dist: number = 0;
            let lastPt: POINT2;
            let lineType: number = tg.lineType;
            //we want the middle segment to be visible
            middleSegment = Math.trunc((tg.Pixels.length + 1) / 2 - 1);

            let foundVisibleSegment: boolean = false;
            if (clipBounds == null) {
                return middleSegment;
            }

            if (clipBounds instanceof Array) {
                useClipRect = false;
                clipBoundsPoly = new Polygon();
                let clipArray: Array<Point2D> = clipBounds as Array<Point2D>;
                for (let j: number = 0; j < clipArray.length; j++) {
                    let x: number = (clipArray[j]).getX() as number;
                    let y: number = (clipArray[j]).getY() as number;
                    clipBoundsPoly.addPoint(x, y);
                }
            } else if (clipBounds instanceof Rectangle2D) {
                useClipRect = true;
                clipRect = clipBounds as Rectangle2D;
            } else {
                return middleSegment;
            }

            //walk through the segments to find the first visible segment from the middle
            for (let j: number = middleSegment; j < tg.Pixels.length - 1; j++) {
                pt0 = tg.Pixels[j];
                pt1 = tg.Pixels[j + 1];
                dist = LineUtility.calcDistance(pt0, pt1);
                if (dist < 5) {
                    continue;
                }
                //diagnostic
                if (j > 0 && lineType === TacticalLines.BOUNDARY) {
                    if (lastPt == null) {
                        lastPt = tg.Pixels[j - 1];
                    }
                    if (Modifier2.DoublesBack(lastPt, pt0, pt1)) {
                        continue;
                    }

                    lastPt = null;
                }
                //if either of the points is within the bound then most of the segment is visible
                if (!useClipRect) {
                    if (clipBoundsPoly.contains(pt0.x, pt0.y) || clipBoundsPoly.contains(pt1.x, pt1.y)) {
                        middleSegment = j;
                        foundVisibleSegment = true;
                        break;
                    }
                } else {
                    if (clipRect.contains(pt0.x, pt0.y) || clipRect.contains(pt1.x, pt1.y)) {
                        middleSegment = j;
                        foundVisibleSegment = true;
                        break;
                    }
                }
            }

            if (!foundVisibleSegment) {
                for (let j: number = middleSegment; j > 0; j--) {
                    pt0 = tg.Pixels[j];
                    pt1 = tg.Pixels[j - 1];
                    dist = LineUtility.calcDistance(pt0, pt1);
                    if (dist < 5) {
                        continue;
                    }
                    //diagnostic
                    if (lineType === TacticalLines.BOUNDARY) {
                        if (lastPt == null) {
                            lastPt = tg.Pixels[j - 1];
                        }

                        if (Modifier2.DoublesBack(lastPt, pt0, pt1)) {
                            continue;
                        }

                        lastPt = null;
                    }
                    //if either of the points is within the bound then most of the segment is visible
                    if (!useClipRect) {
                        if (clipBoundsPoly.contains(pt0.x, pt0.y) || clipBoundsPoly.contains(pt1.x, pt1.y)) {
                            middleSegment = j - 1;
                            foundVisibleSegment = true;
                            break;
                        }
                    } else {
                        if (clipRect.contains(pt0.x, pt0.y) || clipRect.contains(pt1.x, pt1.y)) {
                            middleSegment = j - 1;
                            foundVisibleSegment = true;
                            break;
                        }
                    }
                }
            }

            if (!foundVisibleSegment) {
                middleSegment = Math.trunc(tg.Pixels.length / 2 - 1);
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(Modifier2._className, "getMiddleSegment",
                    exc);
            } else {
                throw exc;
            }
        }
        return middleSegment;
    }

    /**
     * called repeatedly by RemoveModifiers to remove modifiers which fall
     * outside the symbol MBR
     *
     * @param tg
     * @param modifierType
     */
    private static removeModifier(tg: TacticalGraphic,
        modifierType: string): void {
        try {
            let j: number = 0;
            let modifier: Modifier2;
            let n: number = tg.Pixels.length;
            //for (j = 0; j < tg.modifiers.length; j++)
            for (j = 0; j < n; j++) {
                modifier = tg.modifiers[j];

                if (modifier.textID == null) {
                    continue;
                }

                if (modifier.textID.toUpperCase() === modifierType.toUpperCase()) {
                    tg.modifiers.splice(j, 1); // remove modifier
                    break;
                }
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(Modifier2._className, "removeModifier",
                    exc);
            } else {
                throw exc;
            }
        }
    }

    /**
     * removes text modifiers for CPOF tactical areas which do not fit inside
     * the symbol MBR
     *
     * @param tg
     * @param g2d
     * @param isTextFlipped true if text is flipped from the last segment
     * orientation
     * @param iteration the instance count for this modifier
     */
    public static RemoveModifiers(tg: TacticalGraphic,
        g2d: Graphics2D,
        isTextFlipped: boolean,
        iteration: number): void {
        try {
            //CPOF clients only
            if (tg.client.toLowerCase() !== ("cpof2d") && tg.client.toLowerCase() !== ("cpof3d")) {
                return;
            }

            let j: number = 0;
            let mbrPoly: Polygon;
            //if it's a change 1 rectangular area then use the pixels instead of the mbr
            //because those use aboveMiddle to build angular text
            switch (tg.lineType) {
                case TacticalLines.RECTANGULAR:
                case TacticalLines.CUED_ACQUISITION:
                case TacticalLines.ACA_RECTANGULAR: //aboveMiddle modifiers: slanted text
                case TacticalLines.FFA_RECTANGULAR:
                case TacticalLines.NFA_RECTANGULAR:
                case TacticalLines.RFA_RECTANGULAR:
                case TacticalLines.KILLBOXBLUE_RECTANGULAR:
                case TacticalLines.KILLBOXPURPLE_RECTANGULAR:
                case TacticalLines.FSA_RECTANGULAR:
                case TacticalLines.SHIP_AOI_RECTANGULAR:
                case TacticalLines.DEFENDED_AREA_RECTANGULAR:
                case TacticalLines.ATI_RECTANGULAR:
                case TacticalLines.CFFZ_RECTANGULAR:
                case TacticalLines.SENSOR_RECTANGULAR:
                case TacticalLines.CENSOR_RECTANGULAR:
                case TacticalLines.DA_RECTANGULAR:
                case TacticalLines.CFZ_RECTANGULAR:
                case TacticalLines.ZOR_RECTANGULAR:
                case TacticalLines.TBA_RECTANGULAR:
                case TacticalLines.TVAR_RECTANGULAR:
                case TacticalLines.ACA_CIRCULAR:
                case TacticalLines.CIRCULAR:
                case TacticalLines.BDZ:
                case TacticalLines.FSA_CIRCULAR:
                case TacticalLines.NOTACK:
                case TacticalLines.ATI_CIRCULAR:
                case TacticalLines.CFFZ_CIRCULAR:
                case TacticalLines.SENSOR_CIRCULAR:
                case TacticalLines.CENSOR_CIRCULAR:
                case TacticalLines.DA_CIRCULAR:
                case TacticalLines.CFZ_CIRCULAR:
                case TacticalLines.ZOR_CIRCULAR:
                case TacticalLines.TBA_CIRCULAR:
                case TacticalLines.TVAR_CIRCULAR:
                case TacticalLines.FFA_CIRCULAR:
                case TacticalLines.NFA_CIRCULAR:
                case TacticalLines.RFA_CIRCULAR:
                case TacticalLines.KILLBOXBLUE_CIRCULAR:
                case TacticalLines.KILLBOXPURPLE_CIRCULAR: {
                    if (tg.modifiers == null || tg.modifiers.length === 0 || iteration !== 1) {
                        return;
                    }

                    mbrPoly = new Polygon();
                    let n: number = tg.Pixels.length;
                    //for (j = 0; j < tg.Pixels.length; j++)
                    for (j = 0; j < n; j++) {
                        mbrPoly.addPoint(tg.Pixels[j].x as number, tg.Pixels[j].y as number);
                    }

                    break;
                }

                default: {    //area modifiers: horizontal text
                    if (TacticalUtils.isClosedPolygon(tg.lineType) === false || iteration !== 0) {
                        return;
                    }
                    if (tg.modifiers == null || tg.modifiers.length === 0) {
                        return;
                    }

                    mbrPoly = new Polygon();
                    let t: number = tg.Pixels.length;
                    //for (j = 0; j < tg.Pixels.length; j++)
                    for (j = 0; j < t; j++) {
                        mbrPoly.addPoint(tg.Pixels[j].x as number, tg.Pixels[j].y as number);
                    }
                }

            }

            let font: Font;
            font = tg.font;    //might have to change this
            if (font == null) {
                font = g2d.getFont();
            }
            g2d.setFont(font);
            let metrics: FontMetrics = g2d.getFontMetrics();

            let stringWidth: number = 0;
            let stringHeight: number = 0;
            let wfits: boolean = true;
            let w1fits: boolean = true;
            let ww1fits: boolean = true;
            let hfits: boolean = true;
            let h1fits: boolean = true;
            let h2fits: boolean = true;
            let modifier: Modifier2;
            let modifierType: string = "";
            let s: string = "";
            let pt0: POINT2;
            let pt1: POINT2;
            let pt2: POINT2;
            let pt3: POINT2;
            let pt4: POINT2;
            let lineFactor: number = 0;
            let x: number = 0;
            let y: number = 0;
            let x1: number = 0;
            let y1: number = 0;
            let x2: number = 0;
            let y2: number = 0;            //logic as follows:
            //we have to loop through to determine if each modifiers fits and set its fitsMBR member
            //then run a 2nd loop to remove groups of modifiers based on whether any of the others do not fit
            //e.g. if W does not fit then remove W and W1 modifiers
            let n: number = tg.modifiers.length;
            //for (j = 0; j < tg.modifiers.length; j++)
            for (j = 0; j < n; j++) {
                modifier = tg.modifiers[j];
                if (modifier.textID == null || modifier.textID.length === 0) {
                    continue;
                }

                modifierType = modifier.textID;
                lineFactor = modifier.lineFactor;

                if (isTextFlipped) {
                    lineFactor = -lineFactor;
                }

                s = modifier.text;
                if (s == null || s === "") {
                    continue;
                }
                stringWidth = metrics.stringWidth(s) as number + 1;
                stringHeight = font.getSize() as number;

                if (modifier.type === Modifier2.area) {
                    pt0 = modifier.textPath[0];
                    x1 = pt0.x;
                    y1 = pt0.y;
                    x = x1 as number - Math.trunc(stringWidth / 2);
                    y = y1 as number + Math.trunc(stringHeight / 2) + Math.trunc(1.25 * lineFactor * stringHeight);
                    //pt1 = modifier.textPath[1];
                    x2 = x1 as number + Math.trunc(stringWidth / 2);
                    y2 = y1 as number + Math.trunc(stringHeight / 2) + Math.trunc(1.25 * lineFactor * stringHeight);
                    if (mbrPoly.contains(x, y) && mbrPoly.contains(x2, y2)) {
                        modifier.fitsMBR = true;
                    } else {
                        modifier.fitsMBR = false;
                    }
                } else {
                    if (modifier.type === Modifier2.aboveMiddle) {
                        pt0 = modifier.textPath[0];
                        pt1 = modifier.textPath[1];
                        //double dist=LineUtility.calcDistance(pt0, pt1);
                        let ptCenter: POINT2 = LineUtility.midPoint(pt0, pt1, 0);
                        pt0 = LineUtility.extendAlongLine(ptCenter, pt0, stringWidth / 2);
                        pt1 = LineUtility.extendAlongLine(ptCenter, pt1, stringWidth / 2);

                        if (lineFactor >= 0) {
                            pt2 = LineUtility.ExtendDirectedLine(ptCenter, pt0, pt0, 3, Math.abs((lineFactor) * stringHeight));
                        } else {
                            pt2 = LineUtility.ExtendDirectedLine(ptCenter, pt0, pt0, 2, Math.abs((lineFactor) * stringHeight));
                        }

                        if (lineFactor >= 0) {
                            pt3 = LineUtility.ExtendDirectedLine(ptCenter, pt1, pt1, 3, Math.abs((lineFactor) * stringHeight));
                        } else {
                            pt3 = LineUtility.ExtendDirectedLine(ptCenter, pt1, pt1, 2, Math.abs((lineFactor) * stringHeight));
                        }

                        x1 = pt2.x;
                        y1 = pt2.y;
                        x2 = pt3.x;
                        y2 = pt3.y;
                        if (mbrPoly.contains(x1, y1) && mbrPoly.contains(x2, y2)) {
                            modifier.fitsMBR = true;
                        } else {
                            modifier.fitsMBR = false;
                        }
                    } else {
                        modifier.fitsMBR = true;
                    }
                }

            }
            n = tg.modifiers.length;
            //for (j = 0; j < tg.modifiers.length; j++)
            for (j = 0; j < n; j++) {
                modifier = tg.modifiers[j];
                if (modifier.textID == null || modifier.textID.length === 0) {
                    continue;
                }

                if (modifier.fitsMBR === false) {
                    if (modifier.textID.toUpperCase() === "W") {
                        wfits = false;
                    } else {
                        if (modifier.textID.toUpperCase() === "W1") {
                            w1fits = false;
                        } else {
                            if (modifier.textID.toUpperCase() === "W+W1") {
                                ww1fits = false;
                            } else {
                                if (modifier.textID.toUpperCase() === "H") {
                                    hfits = false;
                                } else {
                                    if (modifier.textID.toUpperCase() === "H1") {
                                        h1fits = false;
                                    } else {
                                        if (modifier.textID.toUpperCase() === "H2") {
                                            h2fits = false;
                                        }
                                    }

                                }

                            }

                        }

                    }

                }
            }
            if (wfits === false || w1fits === false) {
                Modifier2.removeModifier(tg, "W");
                Modifier2.removeModifier(tg, "W1");
            }
            if (ww1fits === false) {
                Modifier2.removeModifier(tg, "W+W1");
            }
            if (hfits === false || h1fits === false || h2fits === false) {
                Modifier2.removeModifier(tg, "H");
                Modifier2.removeModifier(tg, "H1");
                Modifier2.removeModifier(tg, "H2");
            }

        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(Modifier2._className, "RemoveModifeirs",
                    exc);
            } else {
                throw exc;
            }
        }
    }

    /**
     * Calculates a segment in the pixels middle by length to hold a string.
     *
     * @param tg
     * @param stringWidth
     * @param segPt0
     * @param segPt1
     */
    private static getPixelsMiddleSegment(tg: TacticalGraphic,
        stringWidth: number,
        segPt0: POINT2,
        segPt1: POINT2): void {
        try {
            switch (tg.lineType) {
                case TacticalLines.CFL: {
                    break;
                }

                default: {
                    return;
                }

            }
            let totalLength: number = 0;
            let j: number = 0;
            let dist: number = 0;
            let mid: number = 0;
            let remainder: number = 0;
            let pt0: POINT2;
            let pt1: POINT2;
            let pt2: POINT2;
            let pt3: POINT2;
            let midPt: POINT2;
            //first get the total length of all the segments
            let n: number = tg.Pixels.length;
            //for (j = 0; j < tg.Pixels.length - 1; j++)
            for (j = 0; j < n - 1; j++) {
                dist = LineUtility.calcDistance(tg.Pixels[j], tg.Pixels[j + 1]);
                totalLength += dist;
            }
            mid = totalLength / 2;
            totalLength = 0;
            //walk thru the segments to find the middle
            //for (j = 0; j < tg.Pixels.length - 1; j++)
            for (j = 0; j < n - 1; j++) {
                dist = LineUtility.calcDistance(tg.Pixels[j], tg.Pixels[j + 1]);
                totalLength += dist;
                if (totalLength >= mid)//current segment contains the middle
                {
                    remainder = totalLength - mid;
                    pt0 = tg.Pixels[j];
                    pt1 = tg.Pixels[j + 1];
                    //calculate the pixels mid point
                    midPt = LineUtility.extendAlongLine2(pt1, pt0, remainder);
                    pt2 = LineUtility.extendAlongLine2(midPt, pt0, stringWidth / 2);
                    pt3 = LineUtility.extendAlongLine2(midPt, pt1, stringWidth / 2);
                    segPt0.x = pt2.x;
                    segPt0.y = pt2.y;
                    segPt1.x = pt3.x;
                    segPt1.y = pt3.y;
                    break;
                }
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(Modifier2._className, "getPixelsMidpoint",
                    exc);
            } else {
                throw exc;
            }
        }
    }

    private static getChange1Height(tg: TacticalGraphic): number {
        let height: number = 0;
        try {
            switch (tg.lineType) {
                //case TacticalLines.PAA_RECTANGULAR:
                case TacticalLines.FSA_RECTANGULAR:
                case TacticalLines.SHIP_AOI_RECTANGULAR:
                case TacticalLines.DEFENDED_AREA_RECTANGULAR:
                case TacticalLines.FFA_RECTANGULAR:
                case TacticalLines.ACA_RECTANGULAR:
                case TacticalLines.NFA_RECTANGULAR:
                case TacticalLines.RFA_RECTANGULAR:
                case TacticalLines.ATI_RECTANGULAR:
                case TacticalLines.CFFZ_RECTANGULAR:
                case TacticalLines.SENSOR_RECTANGULAR:
                case TacticalLines.CENSOR_RECTANGULAR:
                case TacticalLines.DA_RECTANGULAR:
                case TacticalLines.CFZ_RECTANGULAR:
                case TacticalLines.ZOR_RECTANGULAR:
                case TacticalLines.TBA_RECTANGULAR:
                case TacticalLines.TVAR_RECTANGULAR:
                case TacticalLines.KILLBOXBLUE_RECTANGULAR:
                case TacticalLines.KILLBOXPURPLE_RECTANGULAR: {
                    break;
                }

                default: {
                    return 0;
                }

            }
            let x1: number = tg.Pixels[0].x;
            let y1: number = tg.Pixels[0].y;
            let x2: number = tg.Pixels[1].x;
            let y2: number = tg.Pixels[1].y;
            let deltax: number = x2 - x1;
            let deltay: number = y2 - y1;
            height = Math.sqrt(deltax * deltax + deltay * deltay);
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(Modifier2._className, "getChange1Height",
                    exc);
            } else {
                throw exc;
            }
        }
        return height;
    }

    /**
     * scale the line factor for closed areas
     *
     * @param tg
     */
    private static scaleModifiers(tg: TacticalGraphic): void {
        try {
            if (rendererSettings.getAutoCollapseModifiers() === false) {
                return;
            }
            if (tg.client.toLowerCase() !== "ge") {
                return;
            }
            //exit if there are no modifiers or it's not a closed area
            if (tg.modifiers == null || tg.modifiers.length === 0) {
                return;
            }
            let linetype: number = tg.lineType;
            let isClosedPolygon: boolean = TacticalUtils.isClosedPolygon(linetype);
            let isChange1Area: boolean = TacticalUtils.IsChange1Area(linetype);
            if (!isClosedPolygon && !isChange1Area) {
                return;
            }
            switch (linetype) {
                case TacticalLines.PAA_CIRCULAR:
                case TacticalLines.PAA_RECTANGULAR:
                case TacticalLines.RECTANGULAR_TARGET:
                case TacticalLines.RANGE_FAN:
                case TacticalLines.RANGE_FAN_SECTOR:
                case TacticalLines.RADAR_SEARCH: {
                    return;
                }

                default: {
                    break;
                }

            }
            let ptUl: POINT2 = new POINT2();
            let ptUr: POINT2 = new POINT2();
            let ptLr: POINT2 = new POINT2();
            let ptLl: POINT2 = new POINT2();
            Modifier2.GetMBR(tg, ptUl, ptUr, ptLr, ptLl);
            let sz: number = tg.font.getSize();
            //heightMBR is half the MBR height
            //double heightMBR=Math.abs(ptLr.y-ptUr.y)/2;
            let heightMBR: number = 0;
            let change1Height: number = Modifier2.getChange1Height(tg);
            if (change1Height <= 0) {
                heightMBR = Math.abs(ptLr.y - ptUr.y) / 2;
            } else {
                heightMBR = change1Height;
            }

            let heightModifiers: number = 0;
            let modifiers: Array<Modifier2> = tg.modifiers;
            let modifier: Modifier2;
            let minLF: number = Number.MAX_VALUE;
            let j: number = 0;
            let isValid: boolean = false;
            for (j = 0; j < modifiers.length; j++) {
                modifier = modifiers[j];
                //if(modifier.type == area)
                //type3Area=true;
                if (modifier.type === Modifier2.toEnd) {
                    continue;
                }
                if (modifier.type === Modifier2.aboveMiddle && isChange1Area === false) {
                    continue;
                }
                if (modifier.lineFactor < minLF) {
                    minLF = modifier.lineFactor;
                }
                isValid = true;
            }
            //if there are no 'area' modifiers then exit early
            if (!isValid) {
                return;
            }

            heightModifiers = Math.abs(minLF) * sz;
            let expandModifiers: boolean = false;
            let shrinkModifiers: boolean = false;
            if (heightModifiers > heightMBR) {
                shrinkModifiers = true;
            } else {
                if (heightModifiers < 0.5 * heightMBR) {
                    expandModifiers = true;
                }
            }


            let addEllipsis: boolean = false;
            //modifierE is ellipses modifier
            let modifierE: Modifier2 = new Modifier2();
            if (expandModifiers) {
                let factor: number = heightMBR / heightModifiers;
                factor = 1 + (factor - 1) / 4;
                if (factor > 2) {
                    factor = 2;
                }
                for (j = 0; j < modifiers.length; j++) {
                    modifier = modifiers[j];
                    if (modifier.type === Modifier2.aboveMiddle) {
                        if (isChange1Area === false) {

                            continue;
                        }

                    }
                    else {
                        if (modifier.type !== Modifier2.area) {

                            continue;
                        }

                    }


                    modifier.lineFactor *= factor;
                }
            } else {
                if (shrinkModifiers) {
                    let deltaLF: number = (heightModifiers - heightMBR) / sz;
                    let newLF: number = 0;
                    //use maxLF for the ellipsis modifier
                    let maxLF: number = 0;
                    for (j = 0; j < modifiers.length; j++) {
                        modifier = modifiers[j];
                        if (modifier.type === Modifier2.aboveMiddle) {
                            if (isChange1Area === false) {

                                continue;
                            }

                        }
                        else {
                            if (modifier.type !== Modifier2.area) {

                                continue;
                            }

                        }

                        newLF = modifier.lineFactor + deltaLF;
                        if (Math.abs(newLF * sz) >= heightMBR) {
                            //flag the modifier to remove
                            if (modifier.lineFactor > minLF) {
                                modifierE.type = modifier.type;
                                modifier.type = 7;
                                if (modifier.text.length > 0) {
                                    addEllipsis = true;
                                }
                            }
                            modifier.lineFactor = newLF;
                            //modifierE.type=area;
                            //modifierE.type=modifier.type;
                            modifierE.textPath = modifier.textPath;
                            continue;
                        }
                        modifier.lineFactor = newLF;
                    }
                    let modifiers2: Array<Modifier2> = new Array();
                    for (j = 0; j < modifiers.length; j++) {
                        modifier = modifiers[j];
                        if (modifier.type !== 7) {
                            if (modifier.lineFactor > maxLF) {
                                maxLF = modifier.lineFactor;
                            }
                            modifiers2.push(modifier);
                        }
                    }
                    if (addEllipsis) {
                        let echelonSymbol: string = '\u{25CF}\u{25CF}\u{25CF}';
                        modifierE.text = echelonSymbol;
                        modifierE.lineFactor = maxLF + 1;
                        modifiers2.push(modifierE);
                    }
                    tg.modifiers = modifiers2;
                }
            }
            //end shrink modifiers
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(Modifier2._className, "scaleModifiers",
                    exc);
            } else {
                throw exc;
            }
        }
    }

    /**
     * Calculate modifiers identical to addModifiers except use geodesic
     * calculations for the center point.
     *
     * @param tg
     * @param g2d
     * @param clipBounds
     * @param converter
     */
    public static AddModifiersGeo(tg: TacticalGraphic,
        g2d: Graphics2D,
        clipBounds: Rectangle2D | Array<Point2D> | null,
        converter: IPointConversion): void {
        try {
            //exit early for those not affected
            if (tg.Pixels == null || tg.Pixels.length === 0) {
                return;
            }
            let origPoints: Array<POINT2>;
            let font: Font = tg.font;
            if (font == null) {
                font = g2d.getFont();
            }
            g2d.setFont(font);

            let shiftLines: boolean = Channels.getShiftLines();
            let usas: boolean = false;
            let foundSegment: boolean = false;
            let csFactor: number = 1;
            let dist: number = 0;
            let dist2: number = 0;//this will be used for text spacing the 3d map (CommandCight)
            let midPt: POINT2;
            let northestPtIndex: number = 0;
            let southestPtIndex: number = 0;
            let northestPt: POINT2;
            let southestPt: POINT2;

            let clipRect: Rectangle2D;
            let clipArray: Array<Point2D>;
            if (clipBounds != null && clipBounds instanceof Array) {
                clipArray = clipBounds as Array<Point2D>;
            }
            if (clipBounds != null && clipBounds instanceof Rectangle2D) {
                clipRect = clipBounds as Rectangle2D;
            }

            let metrics: FontMetrics = g2d.getFontMetrics();
            let stringWidth: number = 0;
            let stringWidth2: number = 0;
            let WDash: string = ""; // Dash between W and W1 if they're not empty
            let TSpace: string = "";
            let TDash: string = ""; // Space or dash between label and T modifier if T isn't empty
            if (tg.dtg != null && tg.dtg1 != null && tg.dtg.length > 0 && tg.dtg1.length > 0) {
                WDash = " - ";
            }
            if (tg.name != null && tg.name.length > 0) {
                TSpace = " ";
                TDash = " - ";
            }

            if (tg.client === "cpof3d") {
                csFactor = 0.9;
            }

            switch (tg.lineType) {
                case TacticalLines.SERIES:
                case TacticalLines.STRIKWARN:
                case TacticalLines.MSR:
                case TacticalLines.MSR_ONEWAY:
                case TacticalLines.MSR_TWOWAY:
                case TacticalLines.MSR_ALT:
                case TacticalLines.ASR:
                case TacticalLines.ASR_ONEWAY:
                case TacticalLines.ASR_TWOWAY:
                case TacticalLines.ASR_ALT:
                case TacticalLines.TRAFFIC_ROUTE:
                case TacticalLines.TRAFFIC_ROUTE_ONEWAY:
                case TacticalLines.TRAFFIC_ROUTE_ALT:
                case TacticalLines.DHA_REVD:
                case TacticalLines.DHA:
                case TacticalLines.KILL_ZONE:
                case TacticalLines.EPW:
                case TacticalLines.UXO:
                case TacticalLines.FARP:
                case TacticalLines.BSA:
                case TacticalLines.DSA:
                case TacticalLines.CSA:
                case TacticalLines.RSA:
                case TacticalLines.THUNDERSTORMS:
                case TacticalLines.ICING:
                case TacticalLines.FREEFORM:
                case TacticalLines.RHA:
                case TacticalLines.LINTGT:
                case TacticalLines.LINTGTS:
                case TacticalLines.FPF:
                case TacticalLines.GAP:
                case TacticalLines.DEPICT:
                case TacticalLines.AIRHEAD:
                case TacticalLines.FSA:
                case TacticalLines.DIRATKAIR:
                case TacticalLines.OBJ:
                case TacticalLines.AO:
                case TacticalLines.ACA:
                case TacticalLines.FFA:
                case TacticalLines.PAA:
                case TacticalLines.NFA:
                case TacticalLines.RFA:
                case TacticalLines.ATI:
                case TacticalLines.CFFZ:
                case TacticalLines.CFZ:
                case TacticalLines.TBA:
                case TacticalLines.TVAR:
                case TacticalLines.KILLBOXBLUE:
                case TacticalLines.KILLBOXPURPLE:
                case TacticalLines.ZOR:
                case TacticalLines.DA:
                case TacticalLines.SENSOR:
                case TacticalLines.CENSOR:
                case TacticalLines.SMOKE:
                case TacticalLines.BATTLE:
                case TacticalLines.PNO:
                case TacticalLines.PDF:
                case TacticalLines.NAI:
                case TacticalLines.TAI:
                case TacticalLines.BASE_CAMP_REVD:
                case TacticalLines.BASE_CAMP:
                case TacticalLines.GUERILLA_BASE_REVD:
                case TacticalLines.GUERILLA_BASE:
                case TacticalLines.GENERIC_AREA:
                case TacticalLines.ATKPOS:
                case TacticalLines.ASSAULT:
                case TacticalLines.WFZ_REVD:
                case TacticalLines.WFZ:
                case TacticalLines.OBSFAREA:
                case TacticalLines.OBSAREA:
                case TacticalLines.ROZ:
                case TacticalLines.AARROZ:
                case TacticalLines.UAROZ:
                case TacticalLines.WEZ:
                case TacticalLines.FEZ:
                case TacticalLines.JEZ:
                case TacticalLines.FAADZ:
                case TacticalLines.HIDACZ:
                case TacticalLines.MEZ:
                case TacticalLines.LOMEZ:
                case TacticalLines.HIMEZ:
                case TacticalLines.SAAFR:
                case TacticalLines.AC:
                case TacticalLines.MRR:
                case TacticalLines.SL:
                case TacticalLines.TC:
                case TacticalLines.SC:
                case TacticalLines.LLTR:
                case TacticalLines.AIRFIELD:
                case TacticalLines.GENERAL:
                case TacticalLines.JTAA:
                case TacticalLines.SAA:
                case TacticalLines.SGAA:
                case TacticalLines.FORT_REVD:
                case TacticalLines.FORT:
                case TacticalLines.ENCIRCLE:
                case TacticalLines.ASSY:
                case TacticalLines.EA:
                case TacticalLines.DZ:
                case TacticalLines.EZ:
                case TacticalLines.LZ:
                case TacticalLines.PZ:
                case TacticalLines.LAA:
                case TacticalLines.BOUNDARY:
                case TacticalLines.MINED:
                case TacticalLines.FENCED:
                case TacticalLines.PL:
                case TacticalLines.FEBA:
                case TacticalLines.FCL:
                case TacticalLines.HOLD:
                case TacticalLines.BRDGHD:
                case TacticalLines.HOLD_GE:
                case TacticalLines.BRDGHD_GE:
                case TacticalLines.LOA:
                case TacticalLines.LOD:
                case TacticalLines.LL:
                case TacticalLines.EWL:
                case TacticalLines.RELEASE:
                case TacticalLines.HOL:
                case TacticalLines.BHL:
                case TacticalLines.LDLC:
                case TacticalLines.PLD:
                case TacticalLines.NFL:
                case TacticalLines.MFP:
                case TacticalLines.FSCL:
                case TacticalLines.BCL_REVD:
                case TacticalLines.BCL:
                case TacticalLines.ICL:
                case TacticalLines.IFF_OFF:
                case TacticalLines.IFF_ON:
                case TacticalLines.GENERIC_LINE:
                case TacticalLines.CFL:
                case TacticalLines.TRIP:
                case TacticalLines.RFL:
                case TacticalLines.FLOT:
                case TacticalLines.LC:
                case TacticalLines.CATK:
                case TacticalLines.CATKBYFIRE:
                case TacticalLines.IL:
                case TacticalLines.DRCL:
                case TacticalLines.RETIRE:
                case TacticalLines.PURSUIT:
                case TacticalLines.FPOL:
                case TacticalLines.RPOL:
                case TacticalLines.WITHDRAW:
                case TacticalLines.DISENGAGE:
                case TacticalLines.WDRAWUP:
                case TacticalLines.BEARING:
                case TacticalLines.BEARING_J:
                case TacticalLines.BEARING_RDF:
                case TacticalLines.ELECTRO:
                case TacticalLines.BEARING_EW:
                case TacticalLines.ACOUSTIC:
                case TacticalLines.ACOUSTIC_AMB:
                case TacticalLines.TORPEDO:
                case TacticalLines.OPTICAL:
                case TacticalLines.RIP:
                case TacticalLines.DEMONSTRATE:
                case TacticalLines.BOMB:
                case TacticalLines.ZONE:
                case TacticalLines.AT:
                case TacticalLines.STRONG:
                case TacticalLines.MSDZ:
                case TacticalLines.SCREEN:
                case TacticalLines.COVER:
                case TacticalLines.GUARD:
                case TacticalLines.DELAY:
                case TacticalLines.TGMF:
                case TacticalLines.BIO:
                case TacticalLines.CHEM:
                case TacticalLines.NUC:
                case TacticalLines.RAD:
                case TacticalLines.MINE_LINE:
                case TacticalLines.ANCHORAGE_LINE:
                case TacticalLines.ANCHORAGE_AREA:
                case TacticalLines.SPT:
                case TacticalLines.FRONTAL_ATTACK:
                case TacticalLines.TURNING_MOVEMENT:
                case TacticalLines.MOVEMENT_TO_CONTACT:
                case TacticalLines.AIRAOA:
                case TacticalLines.AAAAA:
                case TacticalLines.MAIN:
                case TacticalLines.DIRATKSPT:
                case TacticalLines.INFILTRATION:
                case TacticalLines.DIRATKGND:
                case TacticalLines.LAUNCH_AREA:
                case TacticalLines.DEFENDED_AREA_CIRCULAR:
                case TacticalLines.RECTANGULAR:
                case TacticalLines.CIRCULAR:
                case TacticalLines.RECTANGULAR_TARGET:
                case TacticalLines.LINE:
                case TacticalLines.ASLTXING:
                case TacticalLines.BS_LINE:
                case TacticalLines.BS_AREA:
                case TacticalLines.BBS_LINE:
                case TacticalLines.BBS_AREA:
                case TacticalLines.PBS_CIRCLE:
                case TacticalLines.PBS_ELLIPSE:
                case TacticalLines.PBS_RECTANGLE:
                case TacticalLines.BBS_POINT: {
                    origPoints = LineUtility.getDeepCopy(tg.Pixels);
                    break;
                }

                default: {    //exit early for those not applicable
                    return;
                }

            }

            let linetype: number = tg.lineType;
            let j: number = 0;
            let k: number = 0;
            let x: number = 0;
            let y: number = 0;

            let lastIndex: number = tg.Pixels.length - 1;
            let nextToLastIndex: number = tg.Pixels.length - 2;
            let pt0: POINT2 = new POINT2(tg.Pixels[0]);
            let pt1: POINT2;
            let pt2: POINT2;
            let pt3: POINT2;
            let ptLast: POINT2 = new POINT2(tg.Pixels[lastIndex]);
            let ptNextToLast: POINT2;
            let DPIScaleFactor: number = rendererSettings.getDeviceDPI() / 96.0;

            if (lastIndex > 0) {
                ptNextToLast = new POINT2(tg.Pixels[nextToLastIndex]);
            }

            if (tg.Pixels.length > 1) {
                pt1 = new POINT2(tg.Pixels[1]);
            }

            //prevent vertical paths for modifiers that use toEnd
            Modifier2.shiftModifierPath(tg, pt0, pt1, ptLast, ptNextToLast);

            let label: string = Modifier2.GetCenterLabel(tg);
            let v: string = tg.v;
            let ap: string = tg.ap;
            let pts: POINT2[] = tg.Pixels;
            //need this for areas and some lines
            let ptCenter: POINT2;
            if (converter != null) //cpof uses latlonconverter so cpof passes null for this
            {
                ptCenter = Geodesic.geodesic_center(tg.LatLongs);
                if (ptCenter != null) {
                    let pt22: Point2D = converter.GeoToPixels(new Point2D(ptCenter.x, ptCenter.y));
                    ptCenter.x = pt22.getX();
                    ptCenter.y = pt22.getY();
                } else {
                    ptCenter = LineUtility.CalcCenterPointDouble2(pts, pts.length);
                }
            } else {
                ptCenter = LineUtility.CalcCenterPointDouble2(pts, pts.length);
            }

            let middleSegment: number = Math.trunc((tg.Pixels.length + 1) / 2 - 1);
            let middleSegment2: number = 0;

            if (clipRect != null) {
                middleSegment = Modifier2.getVisibleMiddleSegment(tg, clipRect);
            } else {
                if (clipArray != null) {
                    middleSegment = Modifier2.getVisibleMiddleSegment(tg, clipArray);
                }
            }

            if (tg.Pixels.length > 2) {
                pt2 = tg.Pixels[2];
            }
            if (tg.Pixels.length > 3) {
                pt3 = tg.Pixels[3];
            }
            let TLineFactor: number = 0;
            let T1LineFactor: number = 0;
            let lr: POINT2 = new POINT2(tg.Pixels[0]);
            let ll: POINT2 = new POINT2(tg.Pixels[0]);
            let ul: POINT2 = new POINT2(tg.Pixels[0]);
            let ur: POINT2 = new POINT2(tg.Pixels[0]);
            let index: number = 0;
            let nextIndex: number = 0;
            let size: number = tg.Pixels.length;
            let line: Line2D;

            let dAngle0: number = 0;
            let dAngle1: number = 0;
            let stringHeight: number = 0;

            switch (linetype) {
                case TacticalLines.PL: {
                    Modifier2.AddIntegralAreaModifier(tg, label + TSpace + tg.name, Modifier2.toEnd, T1LineFactor, pt0, pt1, false);
                    Modifier2.AddIntegralAreaModifier(tg, label + TSpace + tg.name, Modifier2.toEnd, T1LineFactor, ptLast, ptNextToLast, false);
                    break;
                }

                case TacticalLines.BS_LINE:
                case TacticalLines.BBS_LINE: {
                    if (tg.t1 == null || tg.t1 == "") {
                        Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.toEnd, T1LineFactor, pt0, pt1, false);
                        Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.toEnd, T1LineFactor, ptLast, ptNextToLast, false);
                    } else {
                        if (tg.t1 == "1") {
                            for (j = 0; j < tg.Pixels.length - 1; j++) {
                                Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.aboveMiddle, 0, tg.Pixels[j], tg.Pixels[j + 1], false);
                            }
                        } else if (tg.t1 == "2") {
                            Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.toEnd, T1LineFactor, pt0, pt1, false);
                            Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.toEnd, T1LineFactor, ptLast, ptNextToLast, false);
                        } else if (tg.t1 == "3") {
                            //either end of the polyline
                            dist = LineUtility.calcDistance(pt0, pt1);
                            stringWidth = metrics.stringWidth(tg.name);
                            stringWidth /= 2;
                            pt2 = LineUtility.extendAlongLine2(pt1, pt0, dist + stringWidth);
                            Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.area, 0, pt2, pt2, false);
                            dist = LineUtility.calcDistance(ptNextToLast, ptLast);
                            pt2 = LineUtility.extendAlongLine2(ptNextToLast, ptLast, dist + stringWidth);
                            Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.area, 0, pt2, pt2, false);
                            //the intermediate points
                            for (j = 1; j < tg.Pixels.length - 1; j++) {
                                Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.area, 0, tg.Pixels[j], tg.Pixels[j], false);
                            }
                        } else //t1 is set inadvertantly or for other graphics
                        {
                            Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.toEnd, T1LineFactor, pt0, pt1, false);
                            Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.toEnd, T1LineFactor, ptLast, ptNextToLast, false);
                        }
                    }
                    break;
                }

                case TacticalLines.BS_AREA:
                case TacticalLines.BBS_AREA: {
                    Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.area, 0, ptCenter, ptCenter, false);
                    break;
                }

                case TacticalLines.FEBA: {
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.toEnd, 0, pt0, pt1, false);
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.toEnd, 0, ptLast, ptNextToLast, false);
                    break;
                }

                // T before label
                case TacticalLines.FSCL: {
                    pt0 = tg.Pixels[0];
                    pt1 = tg.Pixels[1];
                    pt2 = tg.Pixels[tg.Pixels.length - 1];
                    pt3 = tg.Pixels[tg.Pixels.length - 2];
                    dist = LineUtility.calcDistance(pt0, pt1);
                    dist2 = LineUtility.calcDistance(pt2, pt3);
                    stringWidth = (metrics.stringWidth(tg.name + " " + label) as number) as number;
                    stringWidth2 = (metrics.stringWidth(tg.dtg) as number) as number;
                    if (stringWidth2 > stringWidth) {
                        stringWidth = stringWidth2;
                    }

                    if (tg.Pixels.length === 2) //one segment
                    {
                        pt1 = LineUtility.extendAlongLine(pt0, pt1, stringWidth);
                        Modifier2.AddModifier2(tg, tg.name + " " + label, Modifier2.aboveMiddle, -0.7 * csFactor, pt0, pt1, false);
                        Modifier2.AddModifier2(tg, tg.dtg + WDash, Modifier2.aboveMiddle, 0.7 * csFactor, pt0, pt1, false);
                        Modifier2.AddModifier2(tg, tg.dtg1, Modifier2.aboveMiddle, 1.7 * csFactor, pt0, pt1, false);
                        if (dist > 3.5 * stringWidth)//was 28stringwidth+5
                        {
                            pt0 = tg.Pixels[tg.Pixels.length - 1];
                            pt1 = tg.Pixels[tg.Pixels.length - 2];
                            pt1 = LineUtility.extendAlongLine(pt0, pt1, stringWidth);
                            Modifier2.AddModifier2(tg, tg.name + " " + label, Modifier2.aboveMiddle, -0.7 * csFactor, pt0, pt1, false);
                            Modifier2.AddModifier2(tg, tg.dtg + WDash, Modifier2.aboveMiddle, 0.7 * csFactor, pt0, pt1, false);
                            Modifier2.AddModifier2(tg, tg.dtg1, Modifier2.aboveMiddle, 1.7 * csFactor, pt0, pt1, false);
                        }
                    } else //more than one semgent
                    {
                        let dist3: number = LineUtility.calcDistance(pt0, pt2);
                        if (dist > stringWidth + 5 || dist >= dist2 || dist3 > stringWidth + 5) {
                            pt1 = LineUtility.extendAlongLine(pt0, pt1, stringWidth);
                            Modifier2.AddModifier2(tg, tg.name + " " + label, Modifier2.aboveMiddle, -0.7 * csFactor, pt0, pt1, false);
                            Modifier2.AddModifier2(tg, tg.dtg + WDash, Modifier2.aboveMiddle, 0.7 * csFactor, pt0, pt1, false);
                            Modifier2.AddModifier2(tg, tg.dtg1, Modifier2.aboveMiddle, 1.7 * csFactor, pt0, pt1, false);
                        }
                        if (dist2 > stringWidth + 5 || dist2 > dist || dist3 > stringWidth + 5) {
                            pt0 = tg.Pixels[tg.Pixels.length - 1];
                            pt1 = tg.Pixels[tg.Pixels.length - 2];
                            pt1 = LineUtility.extendAlongLine(pt0, pt1, stringWidth);
                            Modifier2.AddModifier2(tg, tg.name + " " + label, Modifier2.aboveMiddle, -0.7 * csFactor, pt0, pt1, false);
                            Modifier2.AddModifier2(tg, tg.dtg + WDash, Modifier2.aboveMiddle, 0.7 * csFactor, pt0, pt1, false);
                            Modifier2.AddModifier2(tg, tg.dtg1, Modifier2.aboveMiddle, 1.7 * csFactor, pt0, pt1, false);
                        }
                    }
                    break;
                }

                // T after label
                case TacticalLines.ICL:
                case TacticalLines.NFL:
                case TacticalLines.BCL_REVD:
                case TacticalLines.RFL: {
                    pt0 = tg.Pixels[0];
                    pt1 = tg.Pixels[1];
                    pt2 = tg.Pixels[tg.Pixels.length - 1];
                    pt3 = tg.Pixels[tg.Pixels.length - 2];
                    dist = LineUtility.calcDistance(pt0, pt1);
                    dist2 = LineUtility.calcDistance(pt2, pt3);
                    stringWidth = (metrics.stringWidth(tg.name + " " + label) as number) as number;
                    stringWidth2 = (metrics.stringWidth(tg.dtg) as number) as number;
                    if (stringWidth2 > stringWidth) {
                        stringWidth = stringWidth2;
                    }

                    if (tg.Pixels.length === 2) //one segment
                    {
                        pt1 = LineUtility.extendAlongLine(pt0, pt1, stringWidth);
                        Modifier2.AddModifier2(tg, label + TSpace + tg.name, Modifier2.aboveMiddle, -0.7 * csFactor, pt0, pt1, false);
                        Modifier2.AddModifier2(tg, tg.dtg + WDash, Modifier2.aboveMiddle, 0.7 * csFactor, pt0, pt1, false);
                        Modifier2.AddModifier2(tg, tg.dtg1, Modifier2.aboveMiddle, 1.7 * csFactor, pt0, pt1, false);
                        if (dist > 3.5 * stringWidth)//was 28stringwidth+5
                        {
                            pt0 = tg.Pixels[tg.Pixels.length - 1];
                            pt1 = tg.Pixels[tg.Pixels.length - 2];
                            pt1 = LineUtility.extendAlongLine(pt0, pt1, stringWidth);
                            Modifier2.AddModifier2(tg, label + TSpace + tg.name, Modifier2.aboveMiddle, -0.7 * csFactor, pt0, pt1, false);
                            Modifier2.AddModifier2(tg, tg.dtg + WDash, Modifier2.aboveMiddle, 0.7 * csFactor, pt0, pt1, false);
                            Modifier2.AddModifier2(tg, tg.dtg1, Modifier2.aboveMiddle, 1.7 * csFactor, pt0, pt1, false);
                        }
                    } else //more than one semgent
                    {
                        let dist3: number = LineUtility.calcDistance(pt0, pt2);
                        if (dist > stringWidth + 5 || dist >= dist2 || dist3 > stringWidth + 5) {
                            pt1 = LineUtility.extendAlongLine(pt0, pt1, stringWidth);
                            Modifier2.AddModifier2(tg, label + TSpace + tg.name, Modifier2.aboveMiddle, -0.7 * csFactor, pt0, pt1, false);
                            Modifier2.AddModifier2(tg, tg.dtg + WDash, Modifier2.aboveMiddle, 0.7 * csFactor, pt0, pt1, false);
                            Modifier2.AddModifier2(tg, tg.dtg1, Modifier2.aboveMiddle, 1.7 * csFactor, pt0, pt1, false);
                        }
                        if (dist2 > stringWidth + 5 || dist2 > dist || dist3 > stringWidth + 5) {
                            pt0 = tg.Pixels[tg.Pixels.length - 1];
                            pt1 = tg.Pixels[tg.Pixels.length - 2];
                            pt1 = LineUtility.extendAlongLine(pt0, pt1, stringWidth);
                            Modifier2.AddModifier2(tg, label + TSpace + tg.name, Modifier2.aboveMiddle, -0.7 * csFactor, pt0, pt1, false);
                            Modifier2.AddModifier2(tg, tg.dtg + WDash, Modifier2.aboveMiddle, 0.7 * csFactor, pt0, pt1, false);
                            Modifier2.AddModifier2(tg, tg.dtg1, Modifier2.aboveMiddle, 1.7 * csFactor, pt0, pt1, false);
                        }
                    }
                    break;
                }

                case TacticalLines.BCL: {
                    pt0 = tg.Pixels[0];
                    pt1 = tg.Pixels[1];
                    pt2 = tg.Pixels[tg.Pixels.length - 1];
                    pt3 = tg.Pixels[tg.Pixels.length - 2];
                    dist = LineUtility.calcDistance(pt0, pt1);
                    dist2 = LineUtility.calcDistance(pt2, pt3);
                    let TMod: string = ""; // Don't add parenthesis if T modifier is empty
                    if (tg.name != null && tg.name.length > 0) {

                        TMod = " (" + tg.name + ")";
                    }

                    stringWidth = (metrics.stringWidth(label + TMod) as number) as number;
                    stringWidth2 = (metrics.stringWidth(tg.dtg) as number) as number;
                    if (stringWidth2 > stringWidth) {
                        stringWidth = stringWidth2;
                    }

                    if (tg.Pixels.length === 2) //one segment
                    {
                        pt1 = LineUtility.extendAlongLine(pt0, pt1, stringWidth);
                        Modifier2.AddModifier2(tg, label + TMod, Modifier2.aboveMiddle, -0.7 * csFactor, pt0, pt1, false);
                        Modifier2.AddModifier2(tg, tg.dtg + WDash, Modifier2.aboveMiddle, 0.7 * csFactor, pt0, pt1, false);
                        Modifier2.AddModifier2(tg, tg.dtg1, Modifier2.aboveMiddle, 1.7 * csFactor, pt0, pt1, false);
                        if (dist > 3.5 * stringWidth)//was 28stringwidth+5
                        {
                            pt0 = tg.Pixels[tg.Pixels.length - 1];
                            pt1 = tg.Pixels[tg.Pixels.length - 2];
                            pt1 = LineUtility.extendAlongLine(pt0, pt1, stringWidth);
                            Modifier2.AddModifier2(tg, label + TMod, Modifier2.aboveMiddle, -0.7 * csFactor, pt0, pt1, false);
                            Modifier2.AddModifier2(tg, tg.dtg + WDash, Modifier2.aboveMiddle, 0.7 * csFactor, pt0, pt1, false);
                            Modifier2.AddModifier2(tg, tg.dtg1, Modifier2.aboveMiddle, 1.7 * csFactor, pt0, pt1, false);
                        }
                    } else //more than one semgent
                    {
                        let dist3: number = LineUtility.calcDistance(pt0, pt2);
                        if (dist > stringWidth + 5 || dist >= dist2 || dist3 > stringWidth + 5) {
                            pt1 = LineUtility.extendAlongLine(pt0, pt1, stringWidth);
                            Modifier2.AddModifier2(tg, label + TMod, Modifier2.aboveMiddle, -0.7 * csFactor, pt0, pt1, false);
                            Modifier2.AddModifier2(tg, tg.dtg + WDash, Modifier2.aboveMiddle, 0.7 * csFactor, pt0, pt1, false);
                            Modifier2.AddModifier2(tg, tg.dtg1, Modifier2.aboveMiddle, 1.7 * csFactor, pt0, pt1, false);
                        }
                        if (dist2 > stringWidth + 5 || dist2 > dist || dist3 > stringWidth + 5) {
                            pt0 = tg.Pixels[tg.Pixels.length - 1];
                            pt1 = tg.Pixels[tg.Pixels.length - 2];
                            pt1 = LineUtility.extendAlongLine(pt0, pt1, stringWidth);
                            Modifier2.AddModifier2(tg, label + TMod, Modifier2.aboveMiddle, -0.7 * csFactor, pt0, pt1, false);
                            Modifier2.AddModifier2(tg, tg.dtg + WDash, Modifier2.aboveMiddle, 0.7 * csFactor, pt0, pt1, false);
                            Modifier2.AddModifier2(tg, tg.dtg1, Modifier2.aboveMiddle, 1.7 * csFactor, pt0, pt1, false);
                        }
                    }
                    break;
                }

                case TacticalLines.DIRATKSPT:
                case TacticalLines.DIRATKAIR:
                case TacticalLines.DIRATKGND: {
                    midPt = LineUtility.midPoint(pt0, pt1, 0);
                    //midPt=LineUtility.midPoint(pt0, midPt, 0);
                    Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.aboveMiddle, 0, pt0, midPt, false);
                    Modifier2.addDTG(tg, Modifier2.aboveMiddle, csFactor, 2 * csFactor, pt0, pt1, metrics);
                    break;
                }

                case TacticalLines.INFILTRATION: {
                    Modifier2.AddIntegralModifier(tg, label, Modifier2.aboveMiddle, 0, middleSegment, middleSegment + 1, true);
                    break;
                }

                case TacticalLines.SPT:
                case TacticalLines.FRONTAL_ATTACK:
                case TacticalLines.TURNING_MOVEMENT:
                case TacticalLines.MOVEMENT_TO_CONTACT:
                case TacticalLines.AIRAOA:
                case TacticalLines.AAAAA:
                case TacticalLines.MAIN: {
                    if (tg.Pixels.length === 3) //one segment
                    {
                        midPt = LineUtility.midPoint(pt0, pt1, 0);
                        Modifier2.AddIntegralAreaModifier(tg, tg.dtg + WDash, Modifier2.aboveMiddle, 0, midPt, midPt, false);
                        Modifier2.AddIntegralAreaModifier(tg, tg.dtg1, Modifier2.aboveMiddle, csFactor, midPt, midPt, false);
                        Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.aboveMiddle, 2 * csFactor, midPt, midPt, false);

                    } else {
                        if (tg.Pixels.length === 4) //2 segments
                        {
                            midPt = LineUtility.midPoint(pt1, pt2, 0);
                            Modifier2.AddIntegralAreaModifier(tg, tg.dtg + WDash, Modifier2.aboveMiddle, 0, midPt, midPt, false);
                            Modifier2.AddIntegralAreaModifier(tg, tg.dtg1, Modifier2.aboveMiddle, csFactor, midPt, midPt, false);
                            Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.aboveMiddle, 2 * csFactor, midPt, midPt, false);
                        } else // 3 or more segments
                        {
                            midPt = LineUtility.midPoint(pt1, pt2, 0);
                            Modifier2.AddIntegralAreaModifier(tg, tg.dtg + WDash, Modifier2.aboveMiddle, -csFactor / 2, midPt, midPt, false);
                            Modifier2.AddIntegralAreaModifier(tg, tg.dtg1, Modifier2.aboveMiddle, csFactor / 2, midPt, midPt, false);
                            midPt = LineUtility.midPoint(pt2, pt3, 0);
                            Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.aboveMiddle, -csFactor / 2, midPt, midPt, false);
                        }
                    }
                    break;
                }

                case TacticalLines.LL:
                case TacticalLines.LOD:
                case TacticalLines.LDLC:
                case TacticalLines.PLD:
                case TacticalLines.RELEASE:
                case TacticalLines.HOL:
                case TacticalLines.BHL:
                case TacticalLines.FCL:
                case TacticalLines.HOLD:
                case TacticalLines.BRDGHD:
                case TacticalLines.HOLD_GE:
                case TacticalLines.BRDGHD_GE:
                case TacticalLines.LOA:
                case TacticalLines.IFF_OFF:
                case TacticalLines.IFF_ON: {
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.aboveEnd, -csFactor, pt0, pt1, false);
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.aboveEnd, -csFactor, ptLast, ptNextToLast, false);
                    break;
                }

                case TacticalLines.EWL: {
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.aboveEnd, -csFactor, pt0, pt1, false);
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.aboveEnd, -csFactor, ptLast, ptNextToLast, false);
                    tg.echelonSymbol = "";
                    if (clipRect != null) {
                        Modifier2.AddBoundaryModifiers(tg, g2d, clipRect);
                    } else {
                        Modifier2.AddBoundaryModifiers(tg, g2d, clipArray);
                    }
                    break;
                }

                case TacticalLines.AIRFIELD: {
                    ur = new POINT2();
                    ul = new POINT2();
                    ll = new POINT2();
                    lr = new POINT2();
                    Modifier2.GetMBR(tg, ul, ur, lr, ll);
                    stringWidth = metrics.stringWidth(tg.h);
                    pt0.x = ur.x + stringWidth / 2 + 1;
                    //pt0.x=ptUr.x+1;
                    //pt0.y=(ptUr.y+ptLr.y)/2-metrics.getFont().getSize()
                    pt0.y = (ur.y + lr.y) / 2 - font.getSize();
                    Modifier2.AddIntegralAreaModifier(tg, tg.h, Modifier2.area, csFactor, pt0, pt0, false);
                    break;
                }

                case TacticalLines.LAUNCH_AREA:
                case TacticalLines.DEFENDED_AREA_CIRCULAR: {
                    Modifier2.AddIntegralAreaModifier(tg, label + TDash + tg.name, Modifier2.area, 0, ptCenter, ptCenter, false);
                    break;
                }

                case TacticalLines.JTAA:
                case TacticalLines.SAA:
                case TacticalLines.SGAA: {
                    Modifier2.addNModifier(tg);
                    Modifier2.AddIntegralAreaModifier(tg, label + TDash + tg.name, Modifier2.area, 0, ptCenter, ptCenter, false);
                    Modifier2.addDTG(tg, Modifier2.area, csFactor, 2 * csFactor, ptCenter, ptCenter, metrics);
                    break;
                }

                case TacticalLines.FORT:
                case TacticalLines.ZONE: {
                    Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.area, 0, ptCenter, ptCenter, false);
                    break;
                }

                case TacticalLines.BDZ: {
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.area, 0, pt0, pt0, false);
                    break;
                }

                case TacticalLines.ASSAULT:
                case TacticalLines.ATKPOS:
                case TacticalLines.OBJ:
                case TacticalLines.NAI:
                case TacticalLines.TAI:
                case TacticalLines.BASE_CAMP_REVD:
                case TacticalLines.GUERILLA_BASE_REVD:
                case TacticalLines.ASSY:
                case TacticalLines.EA:
                case TacticalLines.DZ:
                case TacticalLines.EZ:
                case TacticalLines.LZ:
                case TacticalLines.PZ:
                case TacticalLines.AO: {
                    Modifier2.AddIntegralAreaModifier(tg, label + TSpace + tg.name, Modifier2.area, 0, ptCenter, ptCenter, false);
                    break;
                }

                case TacticalLines.BASE_CAMP:
                case TacticalLines.GUERILLA_BASE: {
                    Modifier2.AddIntegralAreaModifier(tg, label + TSpace + tg.name, Modifier2.area, -1 * csFactor, ptCenter, ptCenter, false);
                    Modifier2.AddModifier(tg, tg.h, Modifier2.area, 0, ptCenter, ptCenter);
                    Modifier2.addDTG(tg, Modifier2.area, 1 * csFactor, 2 * csFactor, ptCenter, ptCenter, metrics);
                    Modifier2.addNModifier(tg);
                    Modifier2.addModifierBottomSegment(tg, tg.echelonSymbol);
                    break;
                }

                case TacticalLines.GENERIC_AREA: {
                    Modifier2.AddIntegralAreaModifier(tg, tg.h + " " + tg.name, Modifier2.area, -0.5 * csFactor, ptCenter, ptCenter, false);
                    Modifier2.addDTG(tg, Modifier2.area, 0.5 * csFactor, 1.5 * csFactor, ptCenter, ptCenter, metrics);
                    Modifier2.addNModifier(tg);
                    break;
                }

                case TacticalLines.AIRHEAD: {
                    Modifier2.GetMBR(tg, ul, ur, lr, ll);
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.aboveMiddle, csFactor, ll, lr, false);
                    break;
                }

                case TacticalLines.AC:
                case TacticalLines.LLTR:
                case TacticalLines.MRR:
                case TacticalLines.SL:
                case TacticalLines.TC:
                case TacticalLines.SAAFR:
                case TacticalLines.SC: {
                    Modifier2.AddIntegralModifier(tg, "Name: " + tg.name, Modifier2.aboveMiddle, -7 * csFactor, middleSegment, middleSegment + 1, false);
                    Modifier2.AddIntegralModifier(tg, "Width: " + Modifier2.removeDecimal(tg.am), Modifier2.aboveMiddle, -6 * csFactor, middleSegment, middleSegment + 1, false);
                    Modifier2.AddIntegralModifier(tg, "Min Alt: " + tg.x, Modifier2.aboveMiddle, -5 * csFactor, middleSegment, middleSegment + 1, false);
                    Modifier2.AddIntegralModifier(tg, "Max Alt: " + tg.x1, Modifier2.aboveMiddle, -4 * csFactor, middleSegment, middleSegment + 1, false);
                    Modifier2.AddIntegralModifier(tg, "DTG Start: " + tg.dtg, Modifier2.aboveMiddle, -3 * csFactor, middleSegment, middleSegment + 1, false);
                    Modifier2.AddIntegralModifier(tg, "DTG End: " + tg.dtg1, Modifier2.aboveMiddle, -2 * csFactor, middleSegment, middleSegment + 1, false);
                    Modifier2.AddIntegralModifier(tg, label + TSpace + tg.name, Modifier2.aboveMiddle, 0, middleSegment, middleSegment + 1, false);
                    break;
                }

                case TacticalLines.BEARING_J:
                case TacticalLines.BEARING_RDF:
                case TacticalLines.BEARING:
                case TacticalLines.ELECTRO:
                case TacticalLines.BEARING_EW:
                case TacticalLines.ACOUSTIC:
                case TacticalLines.ACOUSTIC_AMB:
                case TacticalLines.TORPEDO:
                case TacticalLines.OPTICAL: {
                    midPt = LineUtility.midPoint(pt0, pt1, 0);
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.aboveMiddle, 0, midPt, midPt, true);
                    pt3 = LineUtility.ExtendDirectedLine(pt0, pt1, pt1, 3, font.getSize() / 2.0);
                    Modifier2.AddIntegralAreaModifier(tg, tg.h, Modifier2.aboveMiddle, 1, pt3, pt3, true);
                    break;
                }

                case TacticalLines.ACA: {
                    Modifier2.AddIntegralAreaModifier(tg, label + TSpace + tg.name, Modifier2.area, -3 * csFactor, ptCenter, ptCenter, false);
                    Modifier2.AddIntegralAreaModifier(tg, tg.t1, Modifier2.area, -2 * csFactor, ptCenter, ptCenter, false);
                    Modifier2.AddIntegralAreaModifier(tg, "MIN ALT: " + tg.x, Modifier2.area, -1 * csFactor, ptCenter, ptCenter, false, "H");
                    Modifier2.AddIntegralAreaModifier(tg, "MAX ALT: " + tg.x1, Modifier2.area, 0, ptCenter, ptCenter, false, "H1");
                    Modifier2.AddIntegralAreaModifier(tg, "GRID " + tg.location, Modifier2.area, 1 * csFactor, ptCenter, ptCenter, false, "H2");
                    Modifier2.AddModifier2(tg, "EFF " + tg.dtg + WDash, Modifier2.area, 2 * csFactor, ptCenter, ptCenter, false, "W");
                    Modifier2.AddModifier2(tg, tg.dtg1, Modifier2.area, 3 * csFactor, ptCenter, ptCenter, false, "W1");
                    break;
                }

                case TacticalLines.MFP: {
                    pt0 = tg.Pixels[middleSegment];
                    pt1 = tg.Pixels[middleSegment + 1];
                    Modifier2.AddIntegralModifier(tg, label, Modifier2.aboveMiddle, 0, middleSegment, middleSegment + 1, true);
                    Modifier2.AddIntegralModifier(tg, tg.dtg + WDash, Modifier2.aboveEnd, 1 * csFactor, 0, 1, false);
                    Modifier2.AddIntegralModifier(tg, tg.dtg1, Modifier2.aboveEnd, 2 * csFactor, 0, 1, false);
                    break;
                }

                case TacticalLines.LINTGT: {
                    Modifier2.AddIntegralModifier(tg, ap, Modifier2.aboveMiddle, -0.7 * csFactor, middleSegment, middleSegment + 1, false);
                    break;
                }

                case TacticalLines.LINTGTS: {
                    Modifier2.AddIntegralModifier(tg, ap, Modifier2.aboveMiddle, -0.7 * csFactor, middleSegment, middleSegment + 1, false);
                    Modifier2.AddIntegralModifier(tg, label, Modifier2.aboveMiddle, 0.7 * csFactor, middleSegment, middleSegment + 1, false);
                    break;
                }

                case TacticalLines.FPF: {
                    Modifier2.AddIntegralModifier(tg, ap, Modifier2.aboveMiddle, -0.7 * csFactor, 0, 1, false);
                    Modifier2.AddIntegralModifier(tg, label, Modifier2.aboveMiddle, .7 * csFactor, 0, 1, false);
                    Modifier2.AddIntegralModifier(tg, tg.t1, Modifier2.aboveMiddle, 1.7 * csFactor, 0, 1, false);
                    Modifier2.AddIntegralModifier(tg, v, Modifier2.aboveMiddle, 2.7 * csFactor, 0, 1, false);
                    break;
                }

                case TacticalLines.AT: {
                    Modifier2.AddIntegralAreaModifier(tg, ap, Modifier2.area, 0, ptCenter, ptCenter, false);
                    break;
                }

                case TacticalLines.RECTANGULAR:
                case TacticalLines.CIRCULAR: {
                    Modifier2.AddIntegralAreaModifier(tg, ap, Modifier2.area, 0, pt0, pt0, false);
                    break;
                }

                case TacticalLines.PBS_CIRCLE:
                case TacticalLines.PBS_ELLIPSE:
                case TacticalLines.PBS_RECTANGLE:
                case TacticalLines.BBS_POINT: {
                    Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.area, 0, pt0, pt0, false);
                    break;
                }

                case TacticalLines.RECTANGULAR_TARGET: {
                    stringWidth = metrics.stringWidth(tg.name);
                    let offsetCenterPoint: POINT2 = new POINT2(ptCenter.x + (stringWidth as number) / 2.0, ptCenter.y);
                    Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.area, -1 * csFactor, offsetCenterPoint, offsetCenterPoint, false);
                    break;
                }

                case TacticalLines.SMOKE: {
                    Modifier2.AddIntegralAreaModifier(tg, ap, Modifier2.area, -csFactor, ptCenter, ptCenter, false);
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.area, 0, ptCenter, ptCenter, false);
                    Modifier2.addDTG(tg, Modifier2.area, 1 * csFactor, 2 * csFactor, ptCenter, ptCenter, metrics);
                    break;
                }

                case TacticalLines.LINE: {
                    Modifier2.AddIntegralModifier(tg, tg.name, Modifier2.aboveMiddle, csFactor, middleSegment, middleSegment + 1, false);
                    break;
                }

                case TacticalLines.MINED: {
                    if (tg.isHostile()) {
                        pt1 = LineUtility.midPoint(pt0, pt1, 0);
                        Modifier2.AddIntegralAreaModifier(tg, tg.n, Modifier2.aboveMiddle, 0, pt0, pt1, true);
                        if (middleSegment !== 0) {
                            pt0 = tg.Pixels[middleSegment];
                            pt1 = tg.Pixels[middleSegment + 1];
                            pt1 = LineUtility.midPoint(pt0, pt1, 0);
                            Modifier2.AddIntegralAreaModifier(tg, tg.n, Modifier2.aboveMiddle, 0, pt0, pt1, true);
                        }
                    }
                    Modifier2.GetMBR(tg, ul, ur, lr, ll);
                    Modifier2.AddIntegralAreaModifier(tg, tg.h, Modifier2.aboveMiddle, -1.5 * csFactor, ul, ur, false);
                    Modifier2.AddIntegralAreaModifier(tg, tg.dtg, Modifier2.aboveMiddle, 1.5 * csFactor, ll, lr, false);
                    Modifier2.addModifierOnLine("M", tg);
                    Modifier2.AddImageModifier(tg, Modifier2.areaImage, 0, ptCenter, ptCenter, false);
                    break;
                }

                case TacticalLines.FENCED: {
                    if (tg.isHostile()) {
                        pt1 = LineUtility.midPoint(pt0, pt1, 0);
                        Modifier2.AddIntegralAreaModifier(tg, tg.n, Modifier2.aboveMiddle, 0, pt0, pt1, true);
                        if (middleSegment !== 0) {
                            pt0 = tg.Pixels[middleSegment];
                            pt1 = tg.Pixels[middleSegment + 1];
                            pt1 = LineUtility.midPoint(pt0, pt1, 0);
                            Modifier2.AddIntegralAreaModifier(tg, tg.n, Modifier2.aboveMiddle, 0, pt0, pt1, true);
                        }
                    }
                    Modifier2.addModifierOnLine("M", tg);
                    Modifier2.AddImageModifier(tg, Modifier2.areaImage, 0, ptCenter, ptCenter, false);
                    break;
                }

                case TacticalLines.ASLTXING: {
                    if (tg.Pixels[1].y > tg.Pixels[0].y) {
                        pt0 = tg.Pixels[1];
                        pt1 = tg.Pixels[3];
                        pt2 = tg.Pixels[0];
                        pt3 = tg.Pixels[2];
                    } else {
                        pt0 = tg.Pixels[0];
                        pt1 = tg.Pixels[2];
                        pt2 = tg.Pixels[1];
                        pt3 = tg.Pixels[3];
                    }
                    pt2 = LineUtility.extendAlongLine2(pt0, pt2, -20);
                    pt3 = LineUtility.extendAlongLine2(pt1, pt3, -20);
                    Modifier2.addDTG(tg, Modifier2.aboveMiddle, 0, csFactor, pt2, pt3, metrics);
                    break;
                }

                case TacticalLines.SERIES:
                case TacticalLines.DRCL: {
                    Modifier2.addModifierTopSegment(tg, tg.name);
                    break;
                }

                case TacticalLines.STRIKWARN: {
                    Modifier2.AddIntegralModifier(tg, "1", Modifier2.aboveMiddle, 0, index, index + 1, true);
                    Modifier2.AddIntegralModifier(tg, "2", Modifier2.aboveMiddle, 0, Math.trunc(size / 2), Math.trunc(size / 2) + 1, true);
                    break;
                }

                case TacticalLines.SCREEN:
                case TacticalLines.COVER:
                case TacticalLines.GUARD: {
                    if (tg.Pixels.length === 4) {
                        pt1 = new POINT2(tg.Pixels[1]);
                        pt2 = new POINT2(tg.Pixels[2]);
                        Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.area, 0, pt1, pt1, true);
                        Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.area, 0, pt2, pt2, true);
                    } else {
                        stringHeight = Math.trunc(0.5 * font.getSize() as number);
                        dAngle0 = Math.atan2(tg.Pixels[0].y - tg.Pixels[1].y, tg.Pixels[0].x - tg.Pixels[1].x);
                        dAngle1 = Math.atan2(tg.Pixels[0].y - tg.Pixels[2].y, tg.Pixels[0].x - tg.Pixels[2].x);
                        pt0 = new POINT2(tg.Pixels[0]);
                        pt0.x -= 30 * Math.cos(dAngle0);
                        pt0.y -= 30 * Math.sin(dAngle0) + stringHeight;
                        pt1 = new POINT2(tg.Pixels[0]);
                        pt1.x -= 30 * Math.cos(dAngle1);
                        pt1.y -= 30 * Math.sin(dAngle1) + stringHeight;
                        Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.area, 0, pt0, pt0, true);
                        Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.area, 0, pt1, pt1, true);
                    }
                    break;
                }

                case TacticalLines.MSR_ONEWAY:
                case TacticalLines.ASR_ONEWAY:
                case TacticalLines.TRAFFIC_ROUTE_ONEWAY:
                case TacticalLines.MSR_TWOWAY:
                case TacticalLines.ASR_TWOWAY:
                case TacticalLines.MSR_ALT:
                case TacticalLines.ASR_ALT:
                case TacticalLines.TRAFFIC_ROUTE_ALT: {
                    stringWidth = (1.5 * metrics.stringWidth(label + TSpace + tg.name) as number) as number;
                    let arrowOffset: number = 10 * DPIScaleFactor;
                    if (linetype === TacticalLines.MSR_TWOWAY || linetype === TacticalLines.ASR_TWOWAY) {

                        arrowOffset = 25 * DPIScaleFactor;
                    }

                    let isAlt: boolean = linetype === TacticalLines.MSR_ALT || linetype === TacticalLines.ASR_ALT || linetype === TacticalLines.TRAFFIC_ROUTE_ALT;
                    if (isAlt) {
                        stringWidth2 = (1.5 * metrics.stringWidth("ALT") as number) as number;
                        if (stringWidth2 > stringWidth) {
                            stringWidth = stringWidth2;
                        }
                    }

                    foundSegment = false;
                    //acevedo - 11/30/2017 - adding option to render only 2 labels.
                    if (rendererSettings.getTwoLabelOnly() === false) {
                        for (j = 0; j < tg.Pixels.length - 1; j++) {
                            pt0 = tg.Pixels[j];
                            pt1 = tg.Pixels[j + 1];
                            dist = LineUtility.calcDistance(pt0, pt1);
                            let arrowSide: number = arraysupport.SupplyRouteArrowSide(pt0, pt1);
                            if (dist < stringWidth) {
                                continue;
                            } else {
                                if (arrowSide === 1 || arrowSide === 2) {
                                    // Shift points to account for arrow shift with DPI
                                    pt0 = LineUtility.ExtendDirectedLine(pt1, pt0, pt0, arrowSide, arrowOffset);
                                    pt1 = LineUtility.ExtendDirectedLine(pt1, pt0, pt1, arrowSide, arrowOffset);
                                    Modifier2.AddModifier(tg, label + TSpace + tg.name, Modifier2.aboveMiddle, -1.7 * csFactor, pt0, pt1);
                                    if (isAlt) {

                                        Modifier2.AddModifier(tg, "ALT", Modifier2.aboveMiddle, 0, pt0, pt1);
                                    }

                                } else {
                                    Modifier2.AddModifier(tg, label + TSpace + tg.name, Modifier2.aboveMiddle, -0.7 * csFactor, pt0, pt1);
                                    if (isAlt) {
                                        pt0 = LineUtility.ExtendDirectedLine(pt1, pt0, pt0, arrowSide, arrowOffset);
                                        pt1 = LineUtility.ExtendDirectedLine(pt1, pt0, pt1, arrowSide, arrowOffset);
                                        Modifier2.AddModifier(tg, "ALT", Modifier2.aboveMiddle, 0, pt0, pt1);
                                    }
                                }
                                foundSegment = true;
                            }
                        }
                        if (foundSegment === false) {
                            pt0 = tg.Pixels[middleSegment];
                            pt1 = tg.Pixels[middleSegment + 1];
                            let arrowSide: number = arraysupport.SupplyRouteArrowSide(pt0, pt1);
                            if (arrowSide === 1 || arrowSide === 2) {
                                // Shift points to account for arrow shift with DPI
                                pt0 = LineUtility.ExtendDirectedLine(pt1, pt0, pt0, arrowSide, arrowOffset);
                                pt1 = LineUtility.ExtendDirectedLine(pt1, pt0, pt1, arrowSide, arrowOffset);
                                Modifier2.AddModifier(tg, label + TSpace + tg.name, Modifier2.aboveMiddle, -1.7 * csFactor, pt0, pt1);
                                if (isAlt) {

                                    Modifier2.AddModifier(tg, "ALT", Modifier2.aboveMiddle, 0, pt0, pt1);
                                }

                            } else {
                                Modifier2.AddModifier(tg, label + TSpace + tg.name, Modifier2.aboveMiddle, -0.7 * csFactor, pt0, pt1);
                                if (isAlt) {
                                    pt0 = LineUtility.ExtendDirectedLine(pt1, pt0, pt0, arrowSide, arrowOffset);
                                    pt1 = LineUtility.ExtendDirectedLine(pt1, pt0, pt1, arrowSide, arrowOffset);
                                    Modifier2.AddModifier(tg, "ALT", Modifier2.aboveMiddle, 0, pt0, pt1);
                                }
                            }
                        }
                    }
                    else {
                        // 2 labels one to the north and the other to the south of graphic.
                        northestPtIndex = 0;
                        northestPt = tg.Pixels[northestPtIndex];
                        southestPtIndex = 0;
                        southestPt = tg.Pixels[southestPtIndex];

                        for (j = 0; j < tg.Pixels.length - 1; j++) {
                            pt0 = tg.Pixels[j];
                            if (pt0.y >= northestPt.y) {
                                northestPt = pt0;
                                northestPtIndex = j;
                            }
                            if (pt0.y <= southestPt.y) {
                                southestPt = pt0;
                                southestPtIndex = j;
                            }
                        }

                        Modifier2.AddIntegralModifier(tg, label + TSpace + tg.name, Modifier2.aboveMiddle, -1.7 * csFactor, northestPtIndex, northestPtIndex + 1, false);
                        if (isAlt) {

                            Modifier2.AddIntegralModifier(tg, "ALT", Modifier2.aboveMiddle, -0.7 * csFactor, northestPtIndex, northestPtIndex + 1, false);
                        }


                        if (northestPtIndex !== southestPtIndex) {
                            Modifier2.AddIntegralModifier(tg, label + TSpace + tg.name, Modifier2.aboveMiddle, -1.7 * csFactor, southestPtIndex, southestPtIndex + 1, false);
                            if (isAlt) {

                                Modifier2.AddIntegralModifier(tg, "ALT", Modifier2.aboveMiddle, -0.7 * csFactor, southestPtIndex, southestPtIndex + 1, false);
                            }

                        }
                    }//else
                    break;
                }

                case TacticalLines.DHA_REVD: {
                    Modifier2.AddIntegralAreaModifier(tg, "DETAINEE", Modifier2.area, -1.5 * csFactor, ptCenter, ptCenter, false);
                    Modifier2.AddIntegralAreaModifier(tg, "HOLDING", Modifier2.area, -0.5 * csFactor, ptCenter, ptCenter, false);
                    Modifier2.AddIntegralAreaModifier(tg, "AREA", Modifier2.area, 0.5 * csFactor, ptCenter, ptCenter, false);
                    Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.area, 1.5 * csFactor, ptCenter, ptCenter, false);
                    break;
                }

                case TacticalLines.EPW: {
                    Modifier2.AddIntegralAreaModifier(tg, "EPW", Modifier2.area, -1.5 * csFactor, ptCenter, ptCenter, false);
                    Modifier2.AddIntegralAreaModifier(tg, "HOLDING", Modifier2.area, -0.5 * csFactor, ptCenter, ptCenter, false);
                    Modifier2.AddIntegralAreaModifier(tg, "AREA", Modifier2.area, 0.5 * csFactor, ptCenter, ptCenter, false);
                    Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.area, 1.5 * csFactor, ptCenter, ptCenter, false);
                    break;
                }

                case TacticalLines.UXO: {
                    Modifier2.addModifierOnLine("UXO", tg, true);
                    break;
                }

                case TacticalLines.GENERAL: {
                    Modifier2.addNModifier(tg);
                    break;
                }

                case TacticalLines.DHA:
                case TacticalLines.KILL_ZONE:
                case TacticalLines.FARP: {
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.area, -0.5 * csFactor, ptCenter, ptCenter, false);
                    Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.area, 0.5 * csFactor, ptCenter, ptCenter, false);
                    break;
                }

                case TacticalLines.BSA:
                case TacticalLines.DSA:
                case TacticalLines.CSA:
                case TacticalLines.RSA: {
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.area, 0, ptCenter, ptCenter, false);
                    break;
                }

                case TacticalLines.RHA: {
                    Modifier2.AddIntegralAreaModifier(tg, "REFUGEE", Modifier2.area, -1.5 * csFactor, ptCenter, ptCenter, false);
                    Modifier2.AddIntegralAreaModifier(tg, "HOLDING", Modifier2.area, -0.5 * csFactor, ptCenter, ptCenter, false);
                    Modifier2.AddIntegralAreaModifier(tg, "AREA", Modifier2.area, 0.5 * csFactor, ptCenter, ptCenter, false);
                    Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.area, 1.5 * csFactor, ptCenter, ptCenter, false);
                    break;
                }

                case TacticalLines.MSR:
                case TacticalLines.ASR:
                case TacticalLines.TRAFFIC_ROUTE: {
                    //AddIntegralModifier(tg, label + tg.name, aboveMiddle, -1*csFactor, middleSegment, middleSegment + 1,false);
                    foundSegment = false;
                    //acevedo - 11/30/2017 - adding option to render only 2 labels.
                    if (rendererSettings.getTwoLabelOnly() === false) {
                        for (j = 0; j < tg.Pixels.length - 1; j++) {
                            pt0 = tg.Pixels[j];
                            pt1 = tg.Pixels[j + 1];
                            stringWidth = (1.5 * metrics.stringWidth(label + TSpace + tg.name) as number) as number;
                            dist = LineUtility.calcDistance(pt0, pt1);
                            if (dist < stringWidth) {
                                continue;
                            } else {
                                Modifier2.AddIntegralModifier(tg, label + TSpace + tg.name, Modifier2.aboveMiddle, -1 * csFactor, j, j + 1, false);
                                foundSegment = true;
                            }
                        }
                        if (foundSegment === false) {
                            Modifier2.AddIntegralModifier(tg, label + TSpace + tg.name, Modifier2.aboveMiddle, -1 * csFactor, middleSegment, middleSegment + 1, false);
                        }
                    }
                    else {
                        // 2 labels one to the north and the other to the south of graphic.
                        for (j = 0; j < tg.Pixels.length; j++) {
                            pt0 = tg.Pixels[j];

                            if (northestPt == null) {
                                northestPt = pt0;
                                northestPtIndex = j;
                            }
                            if (southestPt == null) {
                                southestPt = pt0;
                                southestPtIndex = j;
                            }
                            if (pt0.y >= northestPt.y) {
                                northestPt = pt0;
                                northestPtIndex = j;
                            }

                            if (pt0.y <= southestPt.y) {
                                southestPt = pt0;
                                southestPtIndex = j;
                            }
                        }//for
                        middleSegment = northestPtIndex;
                        middleSegment2 = southestPtIndex;

                        if (middleSegment === tg.Pixels.length - 1) {
                            middleSegment -= 1;
                        }
                        if (middleSegment2 === tg.Pixels.length - 1) {
                            middleSegment2 -= 1;
                        }
                        if (middleSegment === middleSegment2) {
                            middleSegment2 -= 1;
                        }

                        // if (middleSegment != middleSegment2) {
                        Modifier2.AddIntegralModifier(tg, label + TSpace + tg.name, Modifier2.aboveMiddle, 0, middleSegment, middleSegment + 1, false);
                        //}
                        Modifier2.AddIntegralModifier(tg, label + TSpace + tg.name, Modifier2.aboveMiddle, 0, middleSegment2, middleSegment2 + 1, false);

                    }//else
                    break;
                }

                case TacticalLines.TRIP: {
                    foundSegment = false;
                    stringWidth = (1.5 * metrics.stringWidth(label) as number) as number;
                    for (j = 0; j < tg.Pixels.length - 1; j++) {
                        pt0 = tg.Pixels[j];
                        pt1 = tg.Pixels[j + 1];
                        midPt = LineUtility.midPoint(pt0, pt1, 0);
                        dist = LineUtility.calcDistance(pt0, pt1);
                        if (dist > stringWidth) {
                            Modifier2.AddModifier2(tg, label, Modifier2.aboveMiddle, -0.7 * csFactor, midPt, midPt, false);
                            foundSegment = true;
                        }
                    }
                    if (!foundSegment) {
                        midPt = LineUtility.midPoint(tg.Pixels[middleSegment], tg.Pixels[middleSegment + 1], 0);
                        Modifier2.AddModifier2(tg, label, Modifier2.aboveMiddle, -0.7 * csFactor, midPt, midPt, false);
                    }
                    break;
                }

                case TacticalLines.GAP: {
                    if (tg.Pixels[1].y > tg.Pixels[0].y) {
                        pt0 = tg.Pixels[1];
                        pt1 = tg.Pixels[3];
                        pt2 = tg.Pixels[0];
                        pt3 = tg.Pixels[2];
                    } else {
                        pt0 = tg.Pixels[0];
                        pt1 = tg.Pixels[2];
                        pt2 = tg.Pixels[1];
                        pt3 = tg.Pixels[3];
                    }
                    pt2 = LineUtility.extendAlongLine2(pt0, pt2, -20);
                    pt3 = LineUtility.extendAlongLine2(pt1, pt3, -20);
                    Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.aboveMiddle, 0, pt0, pt1, false);
                    Modifier2.addDTG(tg, Modifier2.aboveMiddle, 0, csFactor, pt2, pt3, metrics);
                    break;
                }

                case TacticalLines.BIO:
                case TacticalLines.CHEM:
                case TacticalLines.NUC:
                case TacticalLines.RAD: {
                    Modifier2.AddImageModifier(tg, Modifier2.areaImage, 0, ptCenter, ptCenter, false);
                    break;
                }

                case TacticalLines.ANCHORAGE_LINE: {
                    Modifier2.AddImageModifier(tg, Modifier2.aboveMiddle, -0.15 * csFactor, tg.Pixels[middleSegment], tg.Pixels[middleSegment + 1], false);
                    break;
                }

                case TacticalLines.ANCHORAGE_AREA: {
                    // Add anchor on segment with lowest midpoint
                    y = pt0.y + pt1.y;
                    index = 0;
                    for (j = 1; j < size - 1; j++) {
                        if (y < tg.Pixels[j].y + tg.Pixels[j + 1].y) {
                            index = j;
                            y = tg.Pixels[index].y + tg.Pixels[index + 1].y;
                        }
                    }
                    Modifier2.AddImageModifier(tg, Modifier2.aboveMiddle, -0.25 * csFactor, tg.Pixels[index], tg.Pixels[index + 1], false);
                    break;
                }

                case TacticalLines.MINE_LINE: {
                    Modifier2.AddImageModifier(tg, Modifier2.aboveMiddle, -0.2 * csFactor, tg.Pixels[middleSegment], tg.Pixels[middleSegment + 1], false);
                    if (tg.isHostile()) {
                        Modifier2.AddIntegralAreaModifier(tg, tg.n, Modifier2.toEnd, 0.0, pt0, pt1, false);
                        Modifier2.AddIntegralAreaModifier(tg, tg.n, Modifier2.toEnd, 0.0, ptLast, ptNextToLast, false);
                    }
                    break;
                }

                case TacticalLines.DEPICT: {
                    Modifier2.GetMBR(tg, ul, ur, lr, ll);
                    Modifier2.addNModifier(tg);
                    Modifier2.AddImageModifier(tg, Modifier2.areaImage, 0, ptCenter, ptCenter, false);
                    break;
                }

                case TacticalLines.FFA:
                case TacticalLines.RFA:
                case TacticalLines.NFA: {
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.area, -1 * csFactor, ptCenter, ptCenter, false);
                    Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.area, 0, ptCenter, ptCenter, false);
                    Modifier2.addDTG(tg, Modifier2.area, 1 * csFactor, 2 * csFactor, ptCenter, ptCenter, metrics);
                    break;
                }

                case TacticalLines.PAA: {
                    Modifier2.addModifierOnLine("PAA", tg);
                    Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.area, -0.5 * csFactor, ptCenter, ptCenter, false);
                    Modifier2.addDTG(tg, Modifier2.area, 0.5 * csFactor, 1.5 * csFactor, ptCenter, ptCenter, metrics);
                    break;
                }

                case TacticalLines.FSA: {
                    Modifier2.AddIntegralAreaModifier(tg, label + TSpace + tg.name, Modifier2.area, -0.5 * csFactor, ptCenter, ptCenter, false);
                    Modifier2.addDTG(tg, Modifier2.area, 0.5 * csFactor, 1.5 * csFactor, ptCenter, ptCenter, metrics);
                    break;
                }

                case TacticalLines.ATI:
                case TacticalLines.CFFZ:
                case TacticalLines.CFZ:
                case TacticalLines.TBA:
                case TacticalLines.TVAR:
                case TacticalLines.ZOR:
                case TacticalLines.DA:
                case TacticalLines.SENSOR:
                case TacticalLines.CENSOR:
                case TacticalLines.KILLBOXBLUE:
                case TacticalLines.KILLBOXPURPLE: {
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.area, -0.5 * csFactor, ptCenter, ptCenter, false);
                    Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.area, 0.5 * csFactor, ptCenter, ptCenter, false);
                    Modifier2.GetMBR(tg, ul, ur, lr, ll);
                    let ptLeft: POINT2 = ul;
                    let ptRight: POINT2 = ur;
                    if (tg.client.toLowerCase() == "ge") {
                        ptLeft.x -= font.getSize() / 2;
                        ptRight.x -= font.getSize() / 2;
                    }
                    Modifier2.AddIntegralAreaModifier(tg, tg.dtg + WDash, Modifier2.toEnd, 0.5 * csFactor, ptLeft, ptRight, false, "W");
                    Modifier2.AddIntegralAreaModifier(tg, tg.dtg1, Modifier2.toEnd, 1.5 * csFactor, ptLeft, ptRight, false, "W1");
                    break;
                }

                case TacticalLines.BATTLE:
                case TacticalLines.STRONG: {
                    Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.area, 0, ptCenter, ptCenter, false);
                    Modifier2.addModifierBottomSegment(tg, tg.echelonSymbol);
                    break;
                }

                case TacticalLines.PNO: {
                    Modifier2.AddIntegralAreaModifier(tg, label + TSpace + tg.name, Modifier2.area, 0, ptCenter, ptCenter, false);
                    Modifier2.addModifierBottomSegment(tg, tg.echelonSymbol);
                    Modifier2.addNModifier(tg);
                    break;
                }

                case TacticalLines.WFZ_REVD: {
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.area, -1.5 * csFactor, ptCenter, ptCenter, true);
                    Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.area, -0.5 * csFactor, ptCenter, ptCenter, true);
                    Modifier2.AddIntegralAreaModifier(tg, "TIME FROM: " + tg.dtg, Modifier2.area, 0.5 * csFactor, ptCenter, ptCenter, true, "W");
                    Modifier2.AddIntegralAreaModifier(tg, "TIME TO: " + tg.dtg1, Modifier2.area, 1.5 * csFactor, ptCenter, ptCenter, true, "W1");
                    break;
                }
                
                case TacticalLines.WFZ: {
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.area, -2.5 * csFactor, ptCenter, ptCenter, true);
                    Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.area, -1.5 * csFactor, ptCenter, ptCenter, true);
                    Modifier2.AddIntegralAreaModifier(tg, "TIME FROM: " + tg.dtg, Modifier2.area, -0.5 * csFactor, ptCenter, ptCenter, true, "W");
                    Modifier2.AddIntegralAreaModifier(tg, "TIME TO: " + tg.dtg1, Modifier2.area, 0.5 * csFactor, ptCenter, ptCenter, true, "W1");
                    Modifier2.AddIntegralAreaModifier(tg, "MIN ALT: " + tg.x, Modifier2.area, 1.5 * csFactor, ptCenter, ptCenter, false, "H");
                    Modifier2.AddIntegralAreaModifier(tg, "MAX ALT: " + tg.x1, Modifier2.area, 2.5, ptCenter, ptCenter, false, "H1");
                    break;
                }

                case TacticalLines.OBSFAREA: {
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.area, -1.5 * csFactor, ptCenter, ptCenter, false);
                    Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.area, -0.5 * csFactor, ptCenter, ptCenter, false);
                    Modifier2.AddIntegralAreaModifier(tg, tg.dtg + WDash, Modifier2.area, 0.5 * csFactor, ptCenter, ptCenter, false, "W");
                    Modifier2.AddIntegralAreaModifier(tg, tg.dtg1, Modifier2.area, 1.5 * csFactor, ptCenter, ptCenter, false, "W1");
                    break;
                }

                case TacticalLines.OBSAREA: {
                    Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.area, -1 * csFactor, ptCenter, ptCenter, true);
                    Modifier2.AddIntegralAreaModifier(tg, tg.dtg + WDash, Modifier2.area, 0, ptCenter, ptCenter, true, "W");
                    Modifier2.AddIntegralAreaModifier(tg, tg.dtg1, Modifier2.area, 1 * csFactor, ptCenter, ptCenter, true, "W1");
                    break;
                }

                case TacticalLines.ROZ:
                case TacticalLines.AARROZ:
                case TacticalLines.UAROZ:
                case TacticalLines.WEZ:
                case TacticalLines.FEZ:
                case TacticalLines.JEZ:
                case TacticalLines.FAADZ:
                case TacticalLines.HIDACZ:
                case TacticalLines.MEZ:
                case TacticalLines.LOMEZ:
                case TacticalLines.HIMEZ: {
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.area, -2.5, ptCenter, ptCenter, false, "");
                    Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.area, -1.5, ptCenter, ptCenter, false, "T");
                    Modifier2.AddIntegralAreaModifier(tg, "MIN ALT: " + tg.x, Modifier2.area, -0.5, ptCenter, ptCenter, false, "H");
                    Modifier2.AddIntegralAreaModifier(tg, "MAX ALT: " + tg.x1, Modifier2.area, 0.5, ptCenter, ptCenter, false, "H1");
                    Modifier2.AddIntegralAreaModifier(tg, "TIME FROM: " + tg.dtg, Modifier2.area, 1.5, ptCenter, ptCenter, false, "W");
                    Modifier2.AddIntegralAreaModifier(tg, "TIME TO: " + tg.dtg1, Modifier2.area, 2.5, ptCenter, ptCenter, false, "W1");
                    break;
                }

                case TacticalLines.ENCIRCLE: {
                    if (tg.isHostile()) {
                        Modifier2.AddIntegralModifier(tg, tg.n, Modifier2.aboveMiddle, 0, 0, 1, true);
                        Modifier2.AddIntegralModifier(tg, tg.n, Modifier2.aboveMiddle, 0, middleSegment, middleSegment + 1, true);
                    }
                    break;
                }

                case TacticalLines.LAA: {
                    Modifier2.AddImageModifier(tg, Modifier2.areaImage, 0, ptCenter, ptCenter, false);
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.area, -1 * csFactor, ptCenter, ptCenter, false);
                    break;
                }

                case TacticalLines.BOUNDARY: {
                    if (clipRect != null) {
                        Modifier2.AddBoundaryModifiers(tg, g2d, clipRect);
                    } else {
                        Modifier2.AddBoundaryModifiers(tg, g2d, clipArray);
                    }
                    break;
                }

                case TacticalLines.CFL: {
                    stringWidth = (metrics.stringWidth(label + TSpace + tg.name) as number) as number;
                    stringWidth2 = (metrics.stringWidth(tg.dtg + WDash + tg.dtg1) as number) as number;
                    if (stringWidth2 > stringWidth) {
                        stringWidth = stringWidth2;
                    }
                    pt0 = new POINT2(tg.Pixels[middleSegment]);
                    pt1 = new POINT2(tg.Pixels[middleSegment + 1]);
                    Modifier2.getPixelsMiddleSegment(tg, stringWidth, pt0, pt1);
                    Modifier2.AddModifier2(tg, label + TSpace + tg.name, Modifier2.aboveMiddle, -0.7 * csFactor, pt0, pt1, false);
                    Modifier2.addDTG(tg, Modifier2.aboveMiddle, 0.7 * csFactor, 1.7 * csFactor, pt0, pt1, metrics);
                    break;
                }

                case TacticalLines.FLOT: {
                    if (tg.h === "1") {
                        label = "LC";
                    } else {
                        if (tg.h === "2") {
                            label = "";
                        }
                    }

                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.toEnd, 0, pt0, pt1, false);
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.toEnd, 0, ptLast, ptNextToLast, false);

                    if (tg.isHostile()) {
                        Modifier2.AddIntegralAreaModifier(tg, tg.n, Modifier2.toEnd, -1 * csFactor, pt0, pt1, false);
                        Modifier2.AddIntegralAreaModifier(tg, tg.n, Modifier2.toEnd, -1 * csFactor, ptLast, ptNextToLast, false);
                    }
                    break;
                }

                case TacticalLines.LC: {
                    let shiftFactor: number = 1;
                    if (shiftLines) {
                        shiftFactor = 0.5;
                    }
                    if (tg.isHostile()) {
                        if (pt0.x < pt1.x) {
                            TLineFactor = -shiftFactor;//was -1
                        } else {
                            TLineFactor = shiftFactor;//was 1
                        }
                        Modifier2.AddIntegralAreaModifier(tg, tg.n, Modifier2.toEnd, TLineFactor, pt0, pt1, false);
                        if (ptNextToLast.x < ptLast.x) {
                            TLineFactor = -shiftFactor;//was -1
                        } else {
                            TLineFactor = shiftFactor;//was 1
                        }
                        Modifier2.AddIntegralAreaModifier(tg, tg.n, Modifier2.toEnd, TLineFactor, ptLast, ptNextToLast, false);
                    }
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.toEnd, 0, pt0, pt1, false);
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.toEnd, 0, ptLast, ptNextToLast, false);
                    break;
                }

                case TacticalLines.CATK: {
                    Modifier2.AddIntegralModifier(tg, label, Modifier2.aboveMiddle, 0, 1, 0, false);
                    break;
                }

                case TacticalLines.CATKBYFIRE: {
                    stringWidth = (1.5 * metrics.stringWidth(label) as number) as number;
                    pt2 = LineUtility.extendAlongLine(pt0, pt1, stringWidth);
                    Modifier2.AddModifier2(tg, label, Modifier2.aboveMiddle, 0, pt1, pt2, false);
                    break;
                }

                case TacticalLines.IL: {
                    Modifier2.AddIntegralModifier(tg, tg.name, Modifier2.aboveMiddle, 0, 1, 0, false);
                    break;
                }

                case TacticalLines.RETIRE:
                case TacticalLines.PURSUIT:
                case TacticalLines.FPOL:
                case TacticalLines.RPOL:
                case TacticalLines.WITHDRAW:
                case TacticalLines.DISENGAGE:
                case TacticalLines.WDRAWUP:
                case TacticalLines.DEMONSTRATE: {
                    Modifier2.AddIntegralModifier(tg, label, Modifier2.aboveMiddle, 0, 0, 1, true);
                    break;
                }

                case TacticalLines.RIP:
                case TacticalLines.BOMB:
                case TacticalLines.TGMF: {
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.area, 0, ptCenter, ptCenter, true);
                    break;
                }

                case TacticalLines.MSDZ: {
                    Modifier2.AddIntegralAreaModifier(tg, "1", Modifier2.area, 0, pt1, pt1, true);
                    Modifier2.AddIntegralAreaModifier(tg, "2", Modifier2.area, 0, pt2, pt2, true);
                    Modifier2.AddIntegralAreaModifier(tg, "3", Modifier2.area, 0, pt3, pt3, true);
                    break;
                }

                case TacticalLines.DELAY: {
                    Modifier2.AddIntegralModifier(tg, tg.dtg, Modifier2.aboveMiddle, -1 * csFactor, 0, 1, false);
                    Modifier2.AddIntegralModifier(tg, label, Modifier2.aboveMiddle, 0, 0, 1, true);
                    break;
                }

                case TacticalLines.GENERIC_LINE: {
                    pt0 = tg.Pixels[0];
                    pt1 = tg.Pixels[1];
                    pt2 = tg.Pixels[tg.Pixels.length - 1];
                    pt3 = tg.Pixels[tg.Pixels.length - 2];
                    dist = LineUtility.calcDistance(pt0, pt1);
                    dist2 = LineUtility.calcDistance(pt2, pt3);
                    stringWidth = (metrics.stringWidth(tg.h + " " + tg.name) as number) as number;
                    stringWidth2 = (metrics.stringWidth(tg.dtg) as number) as number;
                    if (stringWidth2 > stringWidth) {
                        stringWidth = stringWidth2;
                    }

                    if (tg.Pixels.length === 2) //one segment
                    {
                        pt1 = LineUtility.extendAlongLine(pt0, pt1, stringWidth);
                        Modifier2.AddModifier2(tg, tg.h + " " + tg.name, Modifier2.aboveMiddle, -0.7 * csFactor, pt0, pt1, false);
                        Modifier2.AddModifier2(tg, tg.dtg + WDash, Modifier2.aboveMiddle, 0.7 * csFactor, pt0, pt1, false);
                        Modifier2.AddModifier2(tg, tg.dtg1, Modifier2.aboveMiddle, 1.7 * csFactor, pt0, pt1, false);
                        if (dist > 3.5 * stringWidth)//was 28stringwidth+5
                        {
                            pt0 = tg.Pixels[tg.Pixels.length - 1];
                            pt1 = tg.Pixels[tg.Pixels.length - 2];
                            pt1 = LineUtility.extendAlongLine(pt0, pt1, stringWidth);
                            Modifier2.AddModifier2(tg, tg.h + " " + tg.name, Modifier2.aboveMiddle, -0.7 * csFactor, pt0, pt1, false);
                            Modifier2.AddModifier2(tg, tg.dtg + WDash, Modifier2.aboveMiddle, 0.7 * csFactor, pt0, pt1, false);
                            Modifier2.AddModifier2(tg, tg.dtg1, Modifier2.aboveMiddle, 1.7 * csFactor, pt0, pt1, false);
                        }
                    } else //more than one semgent
                    {
                        let dist3: number = LineUtility.calcDistance(pt0, pt2);
                        if (dist > stringWidth + 5 || dist >= dist2 || dist3 > stringWidth + 5) {
                            pt1 = LineUtility.extendAlongLine(pt0, pt1, stringWidth);
                            Modifier2.AddModifier2(tg, tg.h + " " + tg.name, Modifier2.aboveMiddle, -0.7 * csFactor, pt0, pt1, false);
                            Modifier2.AddModifier2(tg, tg.dtg + WDash, Modifier2.aboveMiddle, 0.7 * csFactor, pt0, pt1, false);
                            Modifier2.AddModifier2(tg, tg.dtg1, Modifier2.aboveMiddle, 1.7 * csFactor, pt0, pt1, false);
                        }
                        if (dist2 > stringWidth + 5 || dist2 > dist || dist3 > stringWidth + 5) {
                            pt0 = tg.Pixels[tg.Pixels.length - 1];
                            pt1 = tg.Pixels[tg.Pixels.length - 2];
                            pt1 = LineUtility.extendAlongLine(pt0, pt1, stringWidth);
                            Modifier2.AddModifier2(tg, tg.h + " " + tg.name, Modifier2.aboveMiddle, -0.7 * csFactor, pt0, pt1, false);
                            Modifier2.AddModifier2(tg, tg.dtg + WDash, Modifier2.aboveMiddle, 0.7 * csFactor, pt0, pt1, false);
                            Modifier2.AddModifier2(tg, tg.dtg1, Modifier2.aboveMiddle, 1.7 * csFactor, pt0, pt1, false);
                        }
                    }
                    break;
                }

                default: {
                    break;
                }

            }
            Modifier2.scaleModifiers(tg);
            tg.Pixels = origPoints;
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(Modifier2._className, "AddModifiersGeo",
                    exc);
            } else {
                throw exc;
            }
        }

    }

    /**
     * RFA, NFA, FFA need these for line spacing
     *
     * @param tg
     * @return
     */
    private static getRFALines(tg: TacticalGraphic): number {
        let lines: number = 1;
        try {
            if (tg.name != null && tg.name.length > 0) {
                lines++;
            }
            if (tg.dtg != null && tg.dtg.length > 0) {
                lines++;
            } else {
                if (tg.dtg1 != null && tg.dtg1.length > 0) {
                    lines++;
                }
            }

        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(Modifier2._className, "AddModifiers",
                    exc);
            } else {
                throw exc;
            }
        }
        return lines;
    }

    /**
     * Added sector range fan modifiers based using the calculated orientation
     * indicator points
     *
     * @param tg
     * @param converter
     * @return
     */
    private static addSectorModifiers(tg: TacticalGraphic, converter: IPointConversion): void {
        try {
            if (tg.lineType === TacticalLines.RANGE_FAN_SECTOR) {
                let AM: Array<number> = new Array();
                let AN: Array<number> = new Array();
                //get the number of sectors
                let X: string = tg.x;
                let altitudes: string[];
                let am: string[] = tg.am.split(",");
                let an: string[] = tg.an.split(",");
                let numSectors: number = an.length / 2;
                //there must be at least one sector
                if (numSectors < 1) {
                    return;
                }
                if (X.length > 0) {
                    altitudes = X.split(",");
                }

                for (let s of am) {
                    AM.push(parseFloat(s));
                }
                for (let s of an) {
                    AN.push(parseFloat(s));
                }

                if (numSectors + 1 > AM.length) {
                    if (parseFloat(am[0]) !== 0) {
                        AM.splice(0, 0, 0);
                    }
                }

                let n: number = tg.Pixels.length;
                //pt0 and pt1 are points for the location indicator
                let pt0: POINT2 = tg.Pixels[n - 5];
                let pt1: POINT2 = tg.Pixels[n - 4];
                let pt02d: Point2D = new Point2D(pt0.x, pt0.y);
                let pt12d: Point2D = new Point2D(pt1.x, pt1.y);
                pt02d = converter.PixelsToGeo(pt02d);
                pt12d = converter.PixelsToGeo(pt12d);
                pt0.x = pt02d.getX();
                pt0.y = pt02d.getY();
                pt1.x = pt12d.getX();
                pt1.y = pt12d.getY();
                //azimuth of the orientation indicator
                let az12: number = Geodesic.GetAzimuth(pt0, pt1);

                let pt2: POINT2;
                let locModifier: Array<POINT2> = new Array();
                //diagnostic
                let ptLeft: POINT2;
                let ptRight: POINT2;
                let locAZModifier: Array<POINT2> = new Array();
                //end section
                let pt22d: Point2D;
                let radius: number = 0;
                for (let k: number = 0; k < numSectors; k++) {
                    if (AM.length < k + 2) {
                        break;
                    }
                    radius = (AM[k] + AM[k + 1]) / 2;
                    pt2 = Geodesic.geodesic_coordinate(pt0, radius, az12);
                    //need locModifier in geo pixels
                    pt22d = new Point2D(pt2.x, pt2.y);
                    pt22d = converter.GeoToPixels(pt22d);
                    pt2.x = pt22d.getX();
                    pt2.y = pt22d.getY();
                    locModifier.push(pt2);
                    //diagnostic
                    if (tg.hideOptionalLabels) {

                        continue;
                    }

                    ptLeft = Geodesic.geodesic_coordinate(pt0, radius, AN[2 * k]);
                    //need ptLeft in geo pixels
                    pt22d = new Point2D(ptLeft.x, ptLeft.y);
                    pt22d = converter.GeoToPixels(pt22d);
                    ptLeft.x = pt22d.getX();
                    ptLeft.y = pt22d.getY();
                    ptRight = Geodesic.geodesic_coordinate(pt0, radius, AN[2 * k + 1]);
                    //need ptRight in geo pixels
                    pt22d = new Point2D(ptRight.x, ptRight.y);
                    pt22d = converter.GeoToPixels(pt22d);
                    ptRight.x = pt22d.getX();
                    ptRight.y = pt22d.getY();
                    locAZModifier.push(ptLeft);
                    locAZModifier.push(ptRight);
                    //end section
                }
                if (altitudes != null) {
                    for (let k: number = 0; k < altitudes.length; k++) {
                        if (k >= locModifier.length) {
                            break;
                        }
                        pt0 = locModifier[k];
                        Modifier2.AddAreaModifier(tg, "ALT " + altitudes[k], Modifier2.area, 0, pt0, pt0);
                    }
                }

                if (!tg.hideOptionalLabels) {
                    for (let k: number = 0; k < numSectors; k++) {
                        pt0 = locModifier[k];
                        Modifier2.AddAreaModifier(tg, "RG " + Modifier2.removeDecimal(AM[k + 1]), Modifier2.area, -1, pt0, pt0);
                        ptLeft = locAZModifier[2 * k];
                        ptRight = locAZModifier[2 * k + 1];
                        Modifier2.AddAreaModifier(tg, Modifier2.removeDecimal(an[2 * k]), Modifier2.area, 0, ptLeft, ptLeft);
                        Modifier2.AddAreaModifier(tg, Modifier2.removeDecimal(an[2 * k + 1]), Modifier2.area, 0, ptRight, ptRight);
                    }
                }
            } else {
                if (tg.lineType === TacticalLines.RADAR_SEARCH) {
                    // Copies functionality from RANGE_FAN_SECTOR with one sector and different modifiers
                    let strLeftRightMinMax: string = tg.leftRightMinMax;
                    let sector: string[] = strLeftRightMinMax.split(",");
                    let left: number = parseFloat(sector[0]);
                    let right: number = parseFloat(sector[1]);

                    while (left > 360) {
                        left -= 360;
                    }
                    while (right > 360) {
                        right -= 360;
                    }
                    while (left < 0) {
                        left += 360;
                    }
                    while (right < 0) {
                        right += 360;
                    }

                    let orientation: number = 0;
                    if (left > right) {
                        orientation = (left - 360 + right) / 2;
                    } else {
                        orientation = (left + right) / 2;
                    }

                    let dist: number = parseFloat(sector[3]);
                    let radius: number = dist * 1.1;

                    let pt0: POINT2 = tg.LatLongs[0];
                    let ptPixels: Point2D = converter.GeoToPixels(new Point2D(pt0.x, pt0.y));
                    let pt0F: POINT2 = new POINT2();
                    pt0F.x = ptPixels.getX();
                    pt0F.y = ptPixels.getY();
                    pt0F.style = pt0.style;

                    let pt1: POINT2 = Geodesic.geodesic_coordinate(pt0, radius, orientation);
                    ptPixels = converter.GeoToPixels(new Point2D(pt1.x, pt1.y));
                    let pt1F: POINT2 = new POINT2();
                    pt1F.x = ptPixels.getX();
                    pt1F.y = ptPixels.getY();
                    pt1F.style = pt1.style;

                    dist = LineUtility.calcDistance(pt0F, pt1F);
                    let base: number = 10;
                    if (dist < 100) {
                        base = dist / 10;
                    }
                    if (base < 5) {
                        base = 5;
                    }
                    let basex2: number = 2 * base;
                    let ptTipF: POINT2 = LineUtility.extendAlongLine(pt0F, pt1F, dist + basex2);  //was 20

                    pt0 = pt0F;
                    pt1 = ptTipF;

                    let AM: Array<number> = new Array();
                    let am: string[] = tg.am.split(",");

                    for (let s of am) {
                        AM.push(parseFloat(s));
                    }

                    if (AM.length < 2) {
                        if (parseFloat(am[0]) !== 0) {
                            AM.splice(0, 0, 0);
                        } else {
                            return;
                        }
                    }

                    let pt02d: Point2D = new Point2D(pt0.x, pt0.y);
                    let pt12d: Point2D = new Point2D(pt1.x, pt1.y);
                    pt02d = converter.PixelsToGeo(pt02d);
                    pt12d = converter.PixelsToGeo(pt12d);
                    pt0.x = pt02d.getX();
                    pt0.y = pt02d.getY();
                    pt1.x = pt12d.getX();
                    pt1.y = pt12d.getY();
                    let az12: number = Geodesic.GetAzimuth(pt0, pt1);

                    let pt22d: Point2D;

                    radius = (AM[0] + AM[1]) / 2;
                    let pt2: POINT2 = Geodesic.geodesic_coordinate(pt0, radius, az12);
                    pt22d = new Point2D(pt2.x, pt2.y);
                    pt22d = converter.GeoToPixels(pt22d);
                    pt2.x = pt22d.getX();
                    pt2.y = pt22d.getY();
                    Modifier2.AddAreaModifier(tg, tg.name, Modifier2.area, -1, pt2, pt2);
                }
            }

        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(Modifier2._className, "addSectorModifiers",
                    exc);
            } else {
                throw exc;
            }
        }
    }

    /**
     * Called by the renderer after tg.Pixels has been filled with the
     * calculated points. The modifier path depends on points calculated by
     * CELineArray.
     *
     * @param tg
     */
    public static AddModifiers2(tg: TacticalGraphic, converter: IPointConversion): void {
        try {
            if (tg.Pixels == null || tg.Pixels.length === 0) {
                return;
            }
            switch (tg.lineType) {
                case TacticalLines.BS_RECTANGLE:
                case TacticalLines.BBS_RECTANGLE:
                case TacticalLines.CONVOY:
                case TacticalLines.HCONVOY:
                case TacticalLines.BREACH:
                case TacticalLines.BYPASS:
                case TacticalLines.CANALIZE:
                case TacticalLines.PENETRATE:
                case TacticalLines.CLEAR:
                case TacticalLines.DISRUPT:
                case TacticalLines.FIX:
                case TacticalLines.ISOLATE:
                case TacticalLines.OCCUPY:
                case TacticalLines.RETAIN:
                case TacticalLines.SECURE:
                case TacticalLines.AREA_DEFENSE:
                case TacticalLines.CONTAIN:
                case TacticalLines.SEIZE:
                case TacticalLines.EVACUATE:
                case TacticalLines.TURN:
                case TacticalLines.CORDONKNOCK:
                case TacticalLines.CORDONSEARCH:
                case TacticalLines.FOLLA:
                case TacticalLines.FOLSP:
                case TacticalLines.ACA_RECTANGULAR:
                case TacticalLines.ACA_CIRCULAR:
                case TacticalLines.RECTANGULAR:
                case TacticalLines.CUED_ACQUISITION:
                case TacticalLines.CIRCULAR:
                case TacticalLines.BDZ:
                case TacticalLines.BBS_POINT:
                case TacticalLines.FSA_CIRCULAR:
                case TacticalLines.NOTACK:
                case TacticalLines.ATI_CIRCULAR:
                case TacticalLines.CFFZ_CIRCULAR:
                case TacticalLines.SENSOR_CIRCULAR:
                case TacticalLines.CENSOR_CIRCULAR:
                case TacticalLines.DA_CIRCULAR:
                case TacticalLines.CFZ_CIRCULAR:
                case TacticalLines.ZOR_CIRCULAR:
                case TacticalLines.TBA_CIRCULAR:
                case TacticalLines.TVAR_CIRCULAR:
                case TacticalLines.FFA_CIRCULAR:
                case TacticalLines.NFA_CIRCULAR:
                case TacticalLines.RFA_CIRCULAR:
                case TacticalLines.KILLBOXBLUE_CIRCULAR:
                case TacticalLines.KILLBOXPURPLE_CIRCULAR:
                case TacticalLines.BLOCK:
                case TacticalLines.FFA_RECTANGULAR:
                case TacticalLines.NFA_RECTANGULAR:
                case TacticalLines.RFA_RECTANGULAR:
                case TacticalLines.KILLBOXBLUE_RECTANGULAR:
                case TacticalLines.KILLBOXPURPLE_RECTANGULAR:
                case TacticalLines.FSA_RECTANGULAR:
                case TacticalLines.SHIP_AOI_RECTANGULAR:
                case TacticalLines.DEFENDED_AREA_RECTANGULAR:
                case TacticalLines.ATI_RECTANGULAR:
                case TacticalLines.CFFZ_RECTANGULAR:
                case TacticalLines.SENSOR_RECTANGULAR:
                case TacticalLines.CENSOR_RECTANGULAR:
                case TacticalLines.DA_RECTANGULAR:
                case TacticalLines.CFZ_RECTANGULAR:
                case TacticalLines.ZOR_RECTANGULAR:
                case TacticalLines.TBA_RECTANGULAR:
                case TacticalLines.TVAR_RECTANGULAR:
                case TacticalLines.PAA:
                case TacticalLines.PAA_RECTANGULAR:
                case TacticalLines.RECTANGULAR_TARGET:
                case TacticalLines.PAA_CIRCULAR:
                case TacticalLines.RANGE_FAN:
                case TacticalLines.RANGE_FAN_SECTOR:
                case TacticalLines.RADAR_SEARCH:
                case TacticalLines.SHIP_AOI_CIRCULAR:
                case TacticalLines.MFLANE:
                case TacticalLines.ENVELOPMENT:
                case TacticalLines.MOBILE_DEFENSE: {
                    break;
                }

                default: {
                    return;
                }

            }
            //end section
            let origPoints: Array<POINT2> = LineUtility.getDeepCopy(tg.Pixels);
            let n: number = tg.Pixels.length;
            if (tg.modifiers == null) {
                tg.modifiers = new Array();
            }
            let font: Font = tg.font;
            let ptCenter: POINT2;
            let csFactor: number = 1;//this will be used for text spacing the 3d map (CommandCight)
            //String affiliation=tg.get_Affiliation();
            let linetype: number = tg.lineType;
            let pt0: POINT2;
            let pt1: POINT2;
            let pt2: POINT2;
            let pt3: POINT2;
            let j: number = 0;
            let k: number = 0;
            let dist: number = 0;
            let label: string = Modifier2.GetCenterLabel(tg);
            let X: string[];
            let lastIndex: number = tg.Pixels.length - 1;
            let nextToLastIndex: number = 0;
            if (tg.Pixels.length > 1) {
                nextToLastIndex = tg.Pixels.length - 2;
            }
            let ptLast: POINT2 = new POINT2(tg.Pixels[lastIndex]);
            let ptNextToLast: POINT2;
            if (tg.Pixels.length > 1) {
                ptNextToLast = new POINT2(tg.Pixels[nextToLastIndex]);
            }
            let WDash: string = ""; // Dash between W and W1 if they're not empty
            let TSpace: string = "";
            let TDash: string = ""; // Space or dash between label and T modifier if T isn't empty
            if (tg.dtg != null && tg.dtg1 != null && tg.dtg.length > 0 && tg.dtg1.length > 0) {
                WDash = " - ";
            }
            if (tg.name != null && tg.name.length > 0) {
                TSpace = " ";
                TDash = " - ";
            }

            let ptLeft: POINT2;
            let ptRight: POINT2;
            let metrics: FontMetrics = new FontMetrics(tg.font)
            let stringWidth: number = 0;
            let rfaLines: number = 0;
            pt0 = new POINT2(tg.Pixels[0]);
            if (tg.Pixels.length > 1) {
                pt1 = new POINT2(tg.Pixels[1]);
            }

            let pts: POINT2[];
            // if the client is the 3d map (CS) then we want to shrink the spacing bnetween
            // the lines of text
            if (tg.client === "cpof3d") {
                csFactor = 0.9;
            }

            Modifier2.shiftModifierPath(tg, pt0, pt1, ptLast, ptNextToLast);
            switch (linetype) {
                case TacticalLines.BS_RECTANGLE:
                case TacticalLines.BBS_RECTANGLE:{
                    pts = new Array<POINT2>(4);
                    for (j = 0; j < 4; j++) {
                        pts[j] = tg.Pixels[j];
                    }
                    ptCenter = LineUtility.CalcCenterPointDouble2(pts, 4);
                    Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.area, -0.125 * csFactor, ptCenter, ptCenter, false);
                    break;
                }
                
                case TacticalLines.CONVOY:
                case TacticalLines.HCONVOY: {
                    pt2 = LineUtility.midPoint(tg.Pixels[0], tg.Pixels[3], 0);
                    pt3 = LineUtility.midPoint(tg.Pixels[1], tg.Pixels[2], 0);
                    Modifier2.AddIntegralAreaModifier(tg, tg.v, Modifier2.aboveEndInside, 0, pt2, pt3, false);
                    Modifier2.AddIntegralAreaModifier(tg, tg.h, Modifier2.aboveStartInside, 0, pt2, pt3, false);
                    Modifier2.addDTG(tg, Modifier2.aboveMiddle, 1.2 * csFactor, 2.2 * csFactor, pt2, pt3, metrics);
                    break;
                }

                case TacticalLines.BREACH:
                case TacticalLines.BYPASS:
                case TacticalLines.CANALIZE: {
                    pt0 = tg.Pixels[1];
                    pt1 = tg.Pixels[2];
                    //pt1=LineUtility.extendAlongLine(pt1, pt0, -10);
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.aboveMiddlePerpendicular, -0.125 * csFactor, pt0, pt1, true);
                    break;
                }

                case TacticalLines.PENETRATE:
                case TacticalLines.CLEAR: {
                    pt0 = tg.Pixels[2];
                    pt1 = tg.Pixels[3];
                    //pt1=LineUtility.extendAlongLine(pt1, pt0, -10);
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.aboveMiddle, -0.125 * csFactor, pt0, pt1, true);
                    break;
                }

                case TacticalLines.DISRUPT: {
                    pt0 = tg.Pixels[4];
                    pt1 = tg.Pixels[5];
                    //pt1=LineUtility.extendAlongLine(pt1, pt0, -10);
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.aboveMiddle, -0.125 * csFactor, pt0, pt1, true);
                    break;
                }

                case TacticalLines.FIX: {
                    pt0 = tg.Pixels[0];
                    pt1 = tg.Pixels[1];
                    //pt1=LineUtility.extendAlongLine(pt1, pt0, -10);
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.aboveMiddle, -0.125 * csFactor, pt0, pt1, true);
                    break;
                }

                case TacticalLines.ISOLATE:
                case TacticalLines.OCCUPY:
                case TacticalLines.RETAIN:
                case TacticalLines.SECURE:
                case TacticalLines.AREA_DEFENSE: {
                    pt0 = tg.Pixels[13];
                    pt1 = tg.Pixels[14];
                    //pt1=LineUtility.extendAlongLine(pt1, pt0, -10);
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.aboveMiddle, -0.125 * csFactor, pt0, pt1, true);
                    break;
                }

                case TacticalLines.CONTAIN: {
                    pt0 = tg.Pixels[13];
                    pt1 = tg.Pixels[14];
                    //pt1=LineUtility.extendAlongLine(pt1, pt0, -10);
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.aboveMiddle, -0.125 * csFactor, pt0, pt1, true);

                    // Contain always has "ENY" even if friendly (not N modifier)
                    for (j = 0; j < n; j++) {
                        if (tg.Pixels[j].style === 14) {
                            pt0 = tg.Pixels[j];
                            pt1 = tg.Pixels[j + 1];
                            Modifier2.AddIntegralAreaModifier(tg, "ENY", Modifier2.aboveMiddle, 0, pt0, pt1, true);
                            break;
                        }
                    }
                    break;
                }

                case TacticalLines.TURN: {
                    pt0 = tg.Pixels[12];
                    pt1 = tg.Pixels[13];
                    ptCenter = LineUtility.midPoint(pt0, pt1, 0);
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.area, -0.125 * csFactor, ptCenter, ptCenter, true);
                    break;
                }

                case TacticalLines.SEIZE:
                case TacticalLines.EVACUATE: {
                    pt0 = tg.Pixels[26];
                    pt1 = tg.Pixels[27];
                    //pt1=LineUtility.extendAlongLine(pt1, pt0, -10);
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.aboveMiddle, -0.125 * csFactor, pt0, pt1, true);
                    break;
                }

                case TacticalLines.DEFENDED_AREA_RECTANGULAR: {
                    ptLeft = LineUtility.midPoint(tg.Pixels[0], tg.Pixels[1], 0);
                    ptRight = LineUtility.midPoint(tg.Pixels[2], tg.Pixels[3], 0);
                    Modifier2.AddIntegralAreaModifier(tg, label + TDash + tg.name, Modifier2.aboveMiddle, 0, ptLeft, ptRight, false);
                    break;
                }

                case TacticalLines.SHIP_AOI_RECTANGULAR: {
                    if (tg.Pixels[0].x > tg.Pixels[3].x) {
                        Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.aboveMiddle, csFactor, tg.Pixels[0], tg.Pixels[3], false);
                    } else {
                        Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.aboveMiddle, csFactor, tg.Pixels[1], tg.Pixels[2], false);
                    }
                    break;
                }

                case TacticalLines.NOTACK: {
                    ptCenter = LineUtility.midPoint(tg.Pixels[0], tg.Pixels[Math.trunc(tg.Pixels.length / 2)], 0);
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.area, -1, ptCenter, ptCenter, false);
                    Modifier2.addDTG(tg, Modifier2.area, csFactor, 2 * csFactor, ptCenter, ptCenter, metrics);
                    break;
                }

                case TacticalLines.SHIP_AOI_CIRCULAR: {
                    // Moved from AddModifiersGeo()
                    // AddModifiersGeo() called before getGeoEllipse(). Unable to use getMBR with single anchor point

                    // Get variables from AddModifiersGeo
                    let lr: POINT2 = new POINT2(tg.Pixels[0]);
                    let ll: POINT2 = new POINT2(tg.Pixels[0]);
                    let ul: POINT2 = new POINT2(tg.Pixels[0]);
                    let ur: POINT2 = new POINT2(tg.Pixels[0]);
                    Modifier2.GetMBR(tg, ul, ur, lr, ll);

                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.aboveMiddle, csFactor, ll, lr, false);
                    break;
                }

                case TacticalLines.MFLANE: {
                    //pt0=tg.Pixels[7];
                    //pt1=tg.Pixels[5];
                    pt0 = tg.Pixels[4];
                    pt1 = tg.Pixels[2];
                    if (tg.Pixels[0].y < tg.Pixels[1].y) {
                        Modifier2.addDTG(tg, Modifier2.aboveMiddle, 0.5 * csFactor, 1.5 * csFactor, pt0, pt1, metrics);
                    } else {
                        Modifier2.addDTG(tg, Modifier2.aboveMiddle, -0.5 * csFactor, -1.5 * csFactor, pt0, pt1, metrics);
                    }
                    break;
                }

                case TacticalLines.CORDONKNOCK:
                case TacticalLines.CORDONSEARCH: {
                    pt0 = tg.Pixels[13];
                    pt1 = tg.Pixels[0];
                    stringWidth = metrics.stringWidth(label);
                    if (pt0.x < pt1.x) {
                        stringWidth = -stringWidth;
                    }
                    pt1 = LineUtility.extendAlongLine2(pt0, pt1, 0.75 * stringWidth);
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.aboveMiddle, 0, pt0, pt1, true);
                    break;
                }

                case TacticalLines.FOLLA: {
                    pt0 = tg.Pixels[0];
                    pt1 = LineUtility.midPoint(tg.Pixels[5], tg.Pixels[6], 0);
                    pt1 = LineUtility.extendAlongLine(pt1, pt0, -10);
                    Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.aboveMiddle, 0, pt0, pt1, true);
                    break;
                }

                case TacticalLines.FOLSP: {
                    pt0 = tg.Pixels[3];
                    pt1 = tg.Pixels[6];
                    pt1 = LineUtility.extendAlongLine(pt1, pt0, -10);
                    Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.aboveMiddle, 0, pt0, pt1, true);
                    break;
                }

                case TacticalLines.ACA_RECTANGULAR: {
                    ptLeft = LineUtility.midPoint(tg.Pixels[0], tg.Pixels[1], 0);
                    ptRight = LineUtility.midPoint(tg.Pixels[2], tg.Pixels[3], 0);
                    Modifier2.AddModifier2(tg, label + TSpace + tg.name, Modifier2.aboveMiddle, -3 * csFactor, ptLeft, ptRight, false);
                    Modifier2.AddModifier2(tg, tg.t1, Modifier2.aboveMiddle, -2 * csFactor, ptLeft, ptRight, false, "T1");
                    Modifier2.AddModifier2(tg, "MIN ALT: " + tg.x, Modifier2.aboveMiddle, -1 * csFactor, ptLeft, ptRight, false, "H");
                    Modifier2.AddModifier2(tg, "MAX ALT: " + tg.x1, Modifier2.aboveMiddle, 0, ptLeft, ptRight, false, "H1");
                    Modifier2.AddModifier2(tg, "GRID " + tg.location, Modifier2.aboveMiddle, 1 * csFactor, ptLeft, ptRight, false, "H2");
                    Modifier2.AddModifier2(tg, "EFF " + tg.dtg + WDash, Modifier2.aboveMiddle, 2 * csFactor, ptLeft, ptRight, false, "W");
                    Modifier2.AddModifier2(tg, tg.dtg1, Modifier2.aboveMiddle, 3 * csFactor, ptLeft, ptRight, false, "W1");
                    break;
                }

                case TacticalLines.ACA_CIRCULAR: {
                    ptCenter = LineUtility.CalcCenterPointDouble2(tg.Pixels, tg.Pixels.length);
                    Modifier2.AddIntegralAreaModifier(tg, label + TSpace + tg.name, Modifier2.area, -3 * csFactor, ptCenter, ptCenter, false);
                    Modifier2.AddModifier2(tg, tg.t1, Modifier2.area, -2 * csFactor, ptCenter, ptCenter, false, "T1");
                    Modifier2.AddIntegralAreaModifier(tg, "MIN ALT: " + tg.x, Modifier2.area, -1 * csFactor, ptCenter, ptCenter, false, "H");
                    Modifier2.AddIntegralAreaModifier(tg, "MAX ALT: " + tg.x1, Modifier2.area, 0, ptCenter, ptCenter, false, "H1");
                    Modifier2.AddIntegralAreaModifier(tg, "GRID " + tg.location, Modifier2.area, 1 * csFactor, ptCenter, ptCenter, false, "H2");
                    Modifier2.AddIntegralAreaModifier(tg, "EFF " + tg.dtg + WDash, Modifier2.area, 2 * csFactor, ptCenter, ptCenter, false, "W");
                    Modifier2.AddIntegralAreaModifier(tg, tg.dtg1, Modifier2.area, 3 * csFactor, ptCenter, ptCenter, false, "W1");
                    break;
                }

                case TacticalLines.FSA_CIRCULAR:
                case TacticalLines.ATI_CIRCULAR:
                case TacticalLines.CFFZ_CIRCULAR:
                case TacticalLines.SENSOR_CIRCULAR:
                case TacticalLines.CENSOR_CIRCULAR:
                case TacticalLines.DA_CIRCULAR:
                case TacticalLines.CFZ_CIRCULAR:
                case TacticalLines.ZOR_CIRCULAR:
                case TacticalLines.TBA_CIRCULAR:
                case TacticalLines.TVAR_CIRCULAR:
                case TacticalLines.KILLBOXBLUE_CIRCULAR:
                case TacticalLines.KILLBOXPURPLE_CIRCULAR: {
                    ptCenter = LineUtility.midPoint(tg.Pixels[0], tg.Pixels[Math.trunc(tg.Pixels.length / 2)], 0);
                    Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.area, -0.5 * csFactor, ptCenter, ptCenter, false);
                    Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.area, 0.5 * csFactor, ptCenter, ptCenter, false);
                    Modifier2.AddOffsetModifier(tg, tg.dtg + WDash, Modifier2.toEnd, -1 * csFactor, tg.Pixels.length / 2, 0, 4, "left");
                    Modifier2.AddOffsetModifier(tg, tg.dtg1, Modifier2.toEnd, 0, tg.Pixels.length / 2, 0, 4, "left");
                    break;
                }

                case TacticalLines.FFA_CIRCULAR:
                case TacticalLines.NFA_CIRCULAR:
                case TacticalLines.RFA_CIRCULAR: {
                    rfaLines = Modifier2.getRFALines(tg);
                    ptCenter = LineUtility.midPoint(tg.Pixels[0], tg.Pixels[51], 0);
                    switch (rfaLines) {
                        case 3: { //2 valid modifiers and a label
                            Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.area, -1 * csFactor, ptCenter, ptCenter, true);
                            Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.area, 0, ptCenter, ptCenter, true);
                            Modifier2.addDTG(tg, Modifier2.area, 1 * csFactor, 2 * csFactor, ptCenter, ptCenter, metrics);
                            break;
                        }

                        case 2: { //one valid modifier and a label
                            Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.area, -0.5 * csFactor, ptCenter, ptCenter, true);
                            if (tg.name != null && tg.name.length > 0) {
                                Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.area, 0.5 * csFactor, ptCenter, ptCenter, true);
                            } else {
                                Modifier2.addDTG(tg, Modifier2.area, 0.5 * csFactor, 1.5 * csFactor, ptCenter, ptCenter, metrics);
                            }
                            break;
                        }

                        default: {    //one label only
                            Modifier2.AddIntegralAreaModifier(tg, label, Modifier2.area, 0, ptCenter, ptCenter, true);
                            break;
                        }

                    }
                    break;
                }

                case TacticalLines.BLOCK: {
                    //for (j = 0; j < tg.Pixels.length; j++)
                    for (j = 0; j < n; j++) {
                        if (tg.Pixels[j].style === 14) {
                            Modifier2.AddIntegralModifier(tg, label, Modifier2.aboveMiddle, 0, j, j + 1);
                            break;
                        }
                    }
                    break;
                }

                case TacticalLines.FFA_RECTANGULAR:
                case TacticalLines.NFA_RECTANGULAR:
                case TacticalLines.RFA_RECTANGULAR: {
                    rfaLines = Modifier2.getRFALines(tg);
                    pt0 = LineUtility.midPoint(tg.Pixels[0], tg.Pixels[1], 0);
                    pt1 = LineUtility.midPoint(tg.Pixels[2], tg.Pixels[3], 0);
                    switch (rfaLines) {
                        case 3: { //two valid modifiers and one label
                            Modifier2.AddModifier2(tg, label, Modifier2.aboveMiddle, -1 * csFactor, pt0, pt1, false);
                            Modifier2.AddModifier2(tg, tg.name, Modifier2.aboveMiddle, 0, pt0, pt1, false);
                            Modifier2.addDTG(tg, Modifier2.aboveMiddle, 1 * csFactor, 2 * csFactor, pt0, pt1, metrics);
                            break;
                        }

                        case 2: { //one valid modifier and one label
                            Modifier2.AddModifier2(tg, label, Modifier2.aboveMiddle, -0.5 * csFactor, pt0, pt1, false);
                            if (tg.name != null && tg.name.length > 0) {
                                Modifier2.AddModifier2(tg, tg.name, Modifier2.aboveMiddle, 0.5 * csFactor, pt0, pt1, false);
                            } else {
                                Modifier2.addDTG(tg, Modifier2.aboveMiddle, 0.5 * csFactor, 1.5 * csFactor, pt0, pt1, metrics);
                            }
                            break;
                        }

                        default: {    //one label only
                            Modifier2.AddModifier2(tg, label, Modifier2.aboveMiddle, 0, pt0, pt1, false);
                            break;
                        }

                    }
                    break;
                }

                case TacticalLines.KILLBOXBLUE_RECTANGULAR:
                case TacticalLines.KILLBOXPURPLE_RECTANGULAR:
                case TacticalLines.FSA_RECTANGULAR:
                case TacticalLines.ATI_RECTANGULAR:
                case TacticalLines.CFFZ_RECTANGULAR:
                case TacticalLines.SENSOR_RECTANGULAR:
                case TacticalLines.CENSOR_RECTANGULAR:
                case TacticalLines.DA_RECTANGULAR:
                case TacticalLines.CFZ_RECTANGULAR:
                case TacticalLines.ZOR_RECTANGULAR:
                case TacticalLines.TBA_RECTANGULAR:
                case TacticalLines.TVAR_RECTANGULAR: {
                    ptLeft = LineUtility.midPoint(tg.Pixels[0], tg.Pixels[1], 0);
                    ptRight = LineUtility.midPoint(tg.Pixels[2], tg.Pixels[3], 0);
                    Modifier2.AddModifier2(tg, label, Modifier2.aboveMiddle, -0.5 * csFactor, ptLeft, ptRight, false);
                    Modifier2.AddModifier2(tg, tg.name, Modifier2.aboveMiddle, 0.5 * csFactor, ptLeft, ptRight, false);
                    pt0 = tg.Pixels[0];
                    pt1 = tg.Pixels[1];
                    pt2 = tg.Pixels[2];
                    pt3 = tg.Pixels[3];
                    if (tg.client.toLowerCase() == "ge") {
                        pt0.x -= font.getSize() / 2;
                        pt2.x -= font.getSize() / 2;
                    }
                    if (tg.client.toLowerCase() !== "ge")//added 2-27-12
                    {
                        TacticalUtils.shiftModifiersLeft(pt0, pt3, 12.5);
                        TacticalUtils.shiftModifiersLeft(pt1, pt2, 12.5);
                    }
                    if (ptLeft.x === ptRight.x) {
                        ptRight.x += 1;
                    }
                    if (ptLeft.x < ptRight.x) {
                        Modifier2.AddModifier(tg, tg.dtg + WDash, Modifier2.toEnd, 0, pt0, pt3);//was 1,2 switched for CPOF
                        Modifier2.AddModifier(tg, tg.dtg1, Modifier2.toEnd, 1 * csFactor, pt0, pt3);//was 1,2
                    } else {
                        Modifier2.AddModifier(tg, tg.dtg + WDash, Modifier2.toEnd, 0, pt2, pt1);//was 3,0 //switched for CPOF
                        Modifier2.AddModifier(tg, tg.dtg1, Modifier2.toEnd, 1 * csFactor, pt2, pt1);//was 3,0
                    }

                    break;
                }

                case TacticalLines.PAA_RECTANGULAR: {
                    Modifier2.AddIntegralModifier(tg, label, Modifier2.aboveMiddlePerpendicular, 0, 0, 1, true);
                    Modifier2.AddIntegralModifier(tg, label, Modifier2.aboveMiddle, 0, 1, 2, true);
                    Modifier2.AddIntegralModifier(tg, label, Modifier2.aboveMiddlePerpendicular, 0, 2, 3, true);
                    Modifier2.AddIntegralModifier(tg, label, Modifier2.aboveMiddle, 0, 3, 0, true);
                    rfaLines = Modifier2.getRFALines(tg);
                    pt0 = LineUtility.midPoint(tg.Pixels[0], tg.Pixels[1], 0);
                    pt1 = LineUtility.midPoint(tg.Pixels[2], tg.Pixels[3], 0);
                    switch (rfaLines) {
                        case 3: { // two valid modifiers
                            Modifier2.AddModifier2(tg, tg.name, Modifier2.aboveMiddle, -0.5, pt0, pt1, false);
                            Modifier2.addDTG(tg, Modifier2.aboveMiddle, 0.5 * csFactor, 1.5 * csFactor, pt0, pt1, metrics);
                            break;
                        }

                        case 2: { // one valid modifier
                            if (tg.name != null && tg.name.length > 0) {
                                Modifier2.AddModifier2(tg, tg.name, Modifier2.aboveMiddle, 0, pt0, pt1, false);
                            } else {
                                Modifier2.addDTG(tg, Modifier2.aboveMiddle, 0, csFactor, pt0, pt1, metrics);
                            }
                            break;
                        }

                        default: {
                            break;
                        }

                    }
                    break;
                }

                case TacticalLines.PAA_CIRCULAR: {
                    for (let i: number = 0; i < 4; i++) {
                        Modifier2.AddIntegralModifier(tg, label, Modifier2.area, -0.5 * csFactor, n / 4 * i, n / 4 * i, false);
                    }

                    rfaLines = Modifier2.getRFALines(tg);
                    ptCenter = LineUtility.midPoint(tg.Pixels[0], tg.Pixels[Math.trunc(n / 2.0 + 0.5)], 0);
                    switch (rfaLines) {
                        case 3: { // two valid modifiers
                            Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.area, -0.5, ptCenter, ptCenter, false);
                            Modifier2.addDTG(tg, Modifier2.area, 0.5 * csFactor, 1.5 * csFactor, ptCenter, ptCenter, metrics);
                            break;
                        }

                        case 2: { // one valid modifier
                            if (tg.name != null && tg.name.length > 0) {
                                Modifier2.AddIntegralAreaModifier(tg, tg.name, Modifier2.area, 0, ptCenter, ptCenter, false);
                            } else {
                                Modifier2.addDTG(tg, Modifier2.area, 0, csFactor, ptCenter, ptCenter, metrics);
                            }
                            break;
                        }

                        default: {
                            break;
                        }

                    }
                    break;
                }

                case TacticalLines.RANGE_FAN: {
                    if (tg.x != null) {
                        X = tg.x.split(",");
                        for (j = 0; j < X.length; j++) {
                            if (tg.Pixels.length > j * 102 + 25) {
                                pt0 = tg.Pixels[j * 102 + 25];
                                Modifier2.AddAreaModifier(tg, "ALT " + X[j], Modifier2.area, 0, pt0, pt0);
                            }
                        }
                    }
                    if (!tg.hideOptionalLabels) {
                        let am: string[] = tg.am.split(",");
                        for (j = 0; j < am.length; j++) {
                            if (tg.Pixels.length > j * 102 + 25) {
                                pt0 = tg.Pixels[j * 102 + 25];
                                //AddAreaModifier(tg, "RG " + am[j], area, -1, pt0, pt0);
                                if (j === 0) {

                                    Modifier2.AddAreaModifier(tg, "MIN RG " + Modifier2.removeDecimal(am[j]), 3, -1, pt0, pt0);
                                }

                                else {

                                    Modifier2.AddAreaModifier(tg, "MAX RG " + "(" + j.toString() + ") " + Modifier2.removeDecimal(am[j]), 3, -1, pt0, pt0);
                                }

                            }
                        }
                    }// end if set range fan text
                    break;
                }

                case TacticalLines.RANGE_FAN_SECTOR:
                case TacticalLines.RADAR_SEARCH: {
                    Modifier2.addSectorModifiers(tg, converter);
                    break;
                }

                case TacticalLines.ENVELOPMENT: {
                    Modifier2.AddIntegralModifier(tg, label, Modifier2.aboveMiddle, 0, 0, 1, true);
                    break;
                }

                case TacticalLines.MOBILE_DEFENSE: {
                    Modifier2.AddIntegralModifier(tg, label, Modifier2.area, 0, 16, 16, true);
                    break;
                }

                default: {
                    break;
                }

            }//end switch
            Modifier2.scaleModifiers(tg);
            tg.Pixels = origPoints;
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(Modifier2._className, "AddModifiers2",
                    exc);
            } else {
                throw exc;
            }
        }
    }

    /**
     * Displays the tg modifiers using a client Graphics2D.
     * Delegates to standalone function in modifier-shapes.ts.
     * @deprecated
     */
    public static DisplayModifiers(tg: TacticalGraphic,
        g2d: Graphics2D): void {
        _displayModifiers(tg, g2d);
    }

    /**
     * Returns a Shape object for the text background for labels and modifiers.
     * Delegates to standalone function in modifier-shapes.ts.
     */
    public static BuildModifierShape(
        tg: TacticalGraphic,
        pt0: POINT2,
        pt1: POINT2,
        stringWidth: number,
        stringHeight: number,
        lineFactor: number,
        isTextFlipped: boolean): Shape2 {
        return _buildModifierShape(tg, pt0, pt1, stringWidth, stringHeight, lineFactor, isTextFlipped);
    }

    /**
     * For BOUNDARY and other line types which require breaks for the integral text.
     * Delegates to standalone function in modifier-shapes.ts.
     */
    public static GetIntegralTextShapes(tg: TacticalGraphic,
        g2d: Graphics2D,
        shapes: Array<Shape2>): void {
        _getIntegralTextShapes(tg, g2d, shapes);
    }

    /**
     * Displays the modifiers to a Graphics2D from a BufferedImage.
     * Delegates to standalone function in modifier-shapes.ts.
     */
    public static DisplayModifiers2(tg: TacticalGraphic,
        g2d: Graphics2D,
        shapes: Array<Shape2>,
        isTextFlipped: boolean,
        converter: IPointConversion): void {
        _displayModifiers2(tg, g2d, shapes, isTextFlipped, converter);
    }

    /**
     * Builds a shape object to wrap text.
     * Delegates to standalone function in modifier-shapes.ts.
     */
    public static getTextShape(g2d: Graphics2D,
        str: string,
        font: Font,
        tx: AffineTransform): Shape {
        return _getTextShape(g2d, str, font, tx);
    }

    /**
     * Creates text outline as a shape.
     * Delegates to standalone function in modifier-shapes.ts.
     */
    public static createTextOutline(originalText: Shape2): Shape2 {
        return _createTextOutline(originalText);
    }

    // Original method bodies for DisplayModifiers, BuildModifierShape,
    // GetIntegralTextShapes, DisplayModifiers2, getTextShape, createTextOutline,
    // and getShapePoints have been moved to modifier-shapes.ts


    private static removeDecimal(doubleVal: string | number): string {
        if (typeof doubleVal === "string") {
            if (doubleVal.indexOf(" ") > 0) // String contains unit
                return Math.round(Number.parseFloat(doubleVal.substring(0, doubleVal.indexOf(" ")))) + doubleVal.substring(doubleVal.indexOf(" "));
            else
                return String(Math.round(Number.parseFloat(doubleVal)));
        } else {
            return String(Math.round(doubleVal));
        }
    }
}
