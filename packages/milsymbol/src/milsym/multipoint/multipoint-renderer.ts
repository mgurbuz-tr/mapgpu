/*
 * A class to serve JavaRendererServer
 */


import { BasicStroke } from "../graphics/BasicStroke"
import { Font } from "../graphics/Font"
import { Graphics2D } from "../graphics/Graphics2D"
import { Point2D } from "../graphics/Point2D"
import { Rectangle } from "../graphics/Rectangle"
import { Rectangle2D } from "../graphics/Rectangle2D"
import { CELineArray } from "../generators/line-array"
import { DISMSupport } from "../generators/dism-generator"
import { LineUtility } from "../math/line-ops"
import { POINT2 } from "../types/point"
import { Shape2 } from "../generators/shape2"
import { TacticalLines } from "../types/enums"
import { TacticalUtils as clsUtilityJTR } from "../tactical/tactical-utils"
import { Geodesic } from "../math/geodesic"
import { Modifier2 } from "../tactical/modifier-placement"
import { TacticalGraphic } from "../tactical/tactical-graphic"
import { Color } from "../renderer/utilities/Color"
import { DistanceUnit } from "../renderer/utilities/DistanceUnit"
import { DrawRules } from "../renderer/utilities/DrawRules"
import { ErrorLogger } from "../renderer/utilities/ErrorLogger"
import { IPointConversion } from "../renderer/utilities/IPointConversion"
import { MilStdSymbol } from "../renderer/utilities/MilStdSymbol"
import { Modifiers } from "../renderer/utilities/Modifiers"
import { MSInfo } from "../renderer/utilities/MSInfo"
import { msLookup } from "../renderer/utilities/MSLookup"
import { RendererSettings, rendererSettings } from "../renderer/utilities/RendererSettings"
import { ShapeInfo } from "../renderer/utilities/ShapeInfo"
import { SymbolID } from "../renderer/utilities/SymbolID"
import { SymbolUtilities } from "../renderer/utilities/SymbolUtilities"
import { ClipPolygon } from "../math/clip"
import { ClipQuad } from "../math/clip-quad"
import { MultipointRenderer2 } from "./multipoint-renderer2"
import { MultipointUtils } from "./multipoint-utils"
import { CPOFUtils } from "./cpof-utils"
import { GEUtils } from "./ge-utils"
import { BasicShapes } from "../generators/shape-builder";

/**
 * Rendering class
 *
 *
 */
export class MultipointRenderer {

    private static readonly _className: string = "MultipointRenderer";

    /**
     * Set tg geo points from the client points
     *
     * @param milStd
     * @param tg
     */
    private static setClientCoords(milStd: MilStdSymbol,
        tg: TacticalGraphic): void {
        try {
            let latLongs: Array<POINT2> = new Array();
            let j: number = 0;
            let coords: Array<Point2D> = milStd.getCoordinates();
            let pt2d: Point2D;
            let pt2: POINT2;
            let n: number = coords.length;
            //for (j = 0; j < coords.length; j++)
            for (j = 0; j < n; j++) {
                pt2d = coords[j];
                pt2 = MultipointUtils.Point2DToPOINT2(pt2d);
                latLongs.push(pt2);
            }
            tg.LatLongs = latLongs;
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException("MultipointRenderer", "setClientCoords",
                    exc);
            } else {
                throw exc;
            }
        }
    }

    private static getClientCoords(tg: TacticalGraphic): Array<Point2D> {
        let coords: Array<Point2D>;
        try {
            let j: number = 0;
            let pt2d: Point2D;
            let pt2: POINT2;
            coords = new Array();
            let n: number = tg.LatLongs.length;
            //for (j = 0; j < tg.LatLongs.length; j++)
            for (j = 0; j < n; j++) {
                pt2 = tg.LatLongs[j];
                pt2d = new Point2D(pt2.x, pt2.y);
                coords.push(pt2d);
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException("MultipointRenderer", "getClientCoords",
                    exc);
            } else {
                throw exc;
            }
        }
        return coords;
    }

        /**
     * Build a tactical graphic object from the client MilStdSymbol
     *
     * @param milStd MilstdSymbol object
     * @param converter geographic to pixels converter
     * @param lineType {@link BasicShapes}
     * @return tactical graphic
     */
    public static createTacticalGraphicFromMilStdSymbolBasicShape(milStd: MilStdSymbol,
                                                                converter: IPointConversion,
                                                                   lineType: number): TacticalGraphic {
        let tg: TacticalGraphic = new TacticalGraphic();
        try {
            let useLineInterpolation: boolean = milStd.getUseLineInterpolation();
            tg.useLineInterpolation = useLineInterpolation;
            tg.lineType = lineType;
            let status: string = tg.status;
            tg.visibleModifiers = true;
            //set tg latlongs and pixels
            MultipointRenderer.setClientCoords(milStd, tg);
            //build tg.Pixels
            tg.Pixels = MultipointUtils.LatLongToPixels(tg.LatLongs, converter);
            //tg.font = new Font("Arial", Font.PLAIN, 12);
            let r: RendererSettings = rendererSettings;
            let type: number = r.getMPLabelFontType();
            let name: string = r.getMPLabelFontName();
            let sz: number = r.getMPLabelFontSize();
            let font: Font = new Font(name, type, sz);
            tg.font = font;
            tg.fillColor = milStd.getFillColor();
            tg.lineColor = milStd.getLineColor();
            tg.lineThickness = milStd.getLineWidth();
            tg.texturePaint = milStd.getFillStyle();
            tg.fillStyle = milStd.getPatternFillType();
            tg.patternScale = milStd.getPatternScale();

            tg.setIconSize(milStd.getUnitSize());
            tg.keepUnitRatio = milStd.getKeepUnitRatio();

            tg.fontBackColor = Color.WHITE;
            tg.textColor = milStd.getTextColor();
            if (milStd.getModifier(Modifiers.W_DTG_1) != null) {
                tg.dtg = milStd.getModifier(Modifiers.W_DTG_1);
            }
            if (milStd.getModifier(Modifiers.W1_DTG_2) != null) {
                tg.dtg1 = milStd.getModifier(Modifiers.W1_DTG_2);
            }
            if (milStd.getModifier(Modifiers.H_ADDITIONAL_INFO_1) != null) {
                tg.h = milStd.getModifier(Modifiers.H_ADDITIONAL_INFO_1);
            }
            if (milStd.getModifier(Modifiers.H1_ADDITIONAL_INFO_2) != null) {
                tg.h1 = milStd.getModifier(Modifiers.H1_ADDITIONAL_INFO_2);
            }
            if (milStd.getModifier(Modifiers.H2_ADDITIONAL_INFO_3) != null) {
                tg.h2 = milStd.getModifier(Modifiers.H2_ADDITIONAL_INFO_3);
            }
            if (milStd.getModifier(Modifiers.T_UNIQUE_DESIGNATION_1) != null) {
                tg.name = milStd.getModifier(Modifiers.T_UNIQUE_DESIGNATION_1);
            }
            if (milStd.getModifier(Modifiers.T1_UNIQUE_DESIGNATION_2) != null) {
                tg.t1 = milStd.getModifier(Modifiers.T1_UNIQUE_DESIGNATION_2);
            }
            if (milStd.getModifier(Modifiers.V_EQUIP_TYPE) != null) {
                tg.v = milStd.getModifier(Modifiers.V_EQUIP_TYPE);
            }
            if (milStd.getModifier(Modifiers.AS_COUNTRY) != null) {
                tg.as = milStd.getModifier(Modifiers.AS_COUNTRY);
            }
            if (milStd.getModifier(Modifiers.AP_TARGET_NUMBER) != null) {
                tg.ap = milStd.getModifier(Modifiers.AP_TARGET_NUMBER);
            }
            if (milStd.getModifier(Modifiers.Y_LOCATION) != null) {
                tg.location = milStd.getModifier(Modifiers.Y_LOCATION);
            }
            if (milStd.getModifier(Modifiers.N_HOSTILE) != null) {
                tg.n = milStd.getModifier(Modifiers.N_HOSTILE);
            }
            tg.useDashArray = milStd.getUseDashArray();
            tg.useHatchFill = milStd.getUseFillPattern();
            //tg.set_UsePatternFill(milStd.getUseFillPattern());
            tg.hideOptionalLabels = milStd.getHideOptionalLabels();
            let isClosedArea: boolean = clsUtilityJTR.isClosedPolygon(lineType);

            if (isClosedArea) {
                clsUtilityJTR.ClosePolygon(tg.Pixels);
                clsUtilityJTR.ClosePolygon(tg.LatLongs);
            }

            let strXAlt: string = "";
            //construct the H1 and H2 modifiers for sector from the mss AM, AN, and X arraylists
            if (lineType == TacticalLines.BS_ELLIPSE) {
                let AM: Array<number> = milStd.getModifiers_AM_AN_X(Modifiers.AM_DISTANCE);
                let AN: Array<number> = milStd.getModifiers_AM_AN_X(Modifiers.AN_AZIMUTH);
                //ensure array length 3
                let r2: number =0;
                let b: number =0;
                if(AM.length==1)
                {
                    r2=AM[0];
                    AM.push(r2);
                    AM.push(0);
                }
                else if(AM.length==2)
                {
                    r2=AM[0];
                    b=AM[1];
                    AM[1] = r2;
                    AM.push(b);
                }
                if (AN == null) {
                    AN = [];
                }
                if (AN.length < 1) {
                    AN.push(0);
                }
                if (AM != null && AM.length >= 2 && AN != null && AN.length >= 1) {
                    let ptAzimuth: POINT2 = new POINT2(0, 0);
                    ptAzimuth.x = AN[0];
                    let ptCenter: POINT2 = tg.Pixels[0];
                    let pt0: POINT2 = Geodesic.geodesic_coordinate(tg.LatLongs[0], AM[0], 90);//semi-major axis
                    let pt1: POINT2 = Geodesic.geodesic_coordinate(tg.LatLongs[0], AM[1], 0);//semi-minor axis
                    let pt02d: Point2D = new Point2D(pt0.x, pt0.y);
                    let pt12d: Point2D = new Point2D(pt1.x, pt1.y);
                    pt02d = converter.GeoToPixels(pt02d);
                    pt12d = converter.GeoToPixels(pt12d);
                    pt0 = new POINT2(pt02d.getX(), pt02d.getY());
                    pt1 = new POINT2(pt12d.getX(), pt12d.getY());
                    tg.Pixels = [];
                    tg.Pixels.push(ptCenter);
                    tg.Pixels.push(pt0);
                    tg.Pixels.push(pt1);
                    tg.Pixels.push(ptAzimuth);
                }
                if(AM != null && AM.length>2)
                {
                    //use AM[2] for the buffer, so PBS_CIRCLE requires AM size 3 like PBS_ELLIPSE to use a buffer
                    let dist: number=AM[2];
                    let pt0: POINT2=Geodesic.geodesic_coordinate(tg.LatLongs[0], dist, 45);   //azimuth 45 is arbitrary
                    let pt02d: Point2D = new Point2D(tg.LatLongs[0].x,tg.LatLongs[0].y);
                    let pt12d: Point2D = new Point2D(pt0.x, pt0.y);
                    pt02d = converter.GeoToPixels(pt02d);
                    pt12d = converter.GeoToPixels(pt12d);
                    pt0=new POINT2(pt02d.getX(),pt02d.getY());
                    let pt1: POINT2=new POINT2(pt12d.getX(),pt12d.getY());
                    dist=LineUtility.calcDistance(pt0, pt1);
                    //arraysupport will use line style to create the buffer shape
                    tg.Pixels[0].style=Math.trunc(dist);
                }
            }
            let j: number = 0;
            if (lineType == TacticalLines.BBS_RECTANGLE || lineType == TacticalLines.BS_BBOX) {
                let minLat: number = tg.LatLongs[0].y;
                let maxLat: number = tg.LatLongs[0].y;
                let minLong: number = tg.LatLongs[0].x;
                let maxLong: number = tg.LatLongs[0].x;
                for (j = 1; j < tg.LatLongs.length; j++) {
                    if (tg.LatLongs[j].x < minLong) {
                        minLong = tg.LatLongs[j].x;
                    }
                    if (tg.LatLongs[j].x > maxLong) {
                        maxLong = tg.LatLongs[j].x;
                    }
                    if (tg.LatLongs[j].y < minLat) {
                        minLat = tg.LatLongs[j].y;
                    }
                    if (tg.LatLongs[j].y > maxLat) {
                        maxLat = tg.LatLongs[j].y;
                    }
                }
                tg.LatLongs = [];
                tg.LatLongs.push(new POINT2(minLong, maxLat));
                tg.LatLongs.push(new POINT2(maxLong, maxLat));
                tg.LatLongs.push(new POINT2(maxLong, minLat));
                tg.LatLongs.push(new POINT2(minLong, minLat));
                if (lineType == TacticalLines.BS_BBOX) {
                    tg.LatLongs.push(new POINT2(minLong, maxLat));
                }
                tg.Pixels = MultipointUtils.LatLongToPixels(tg.LatLongs, converter);
            }
            //these have a buffer value in meters which we'll stuff tg.H2
            //and use the style member of tg.Pixels to stuff the buffer width in pixels
            switch (lineType) {
                case TacticalLines.BBS_AREA:
                case TacticalLines.BBS_LINE:
                case TacticalLines.BBS_RECTANGLE:
                    let H2: string = null;
                    let dist: number = 0;
                    let pt0: POINT2;
                    let pt1: POINT2;//45 is arbitrary
                    let AM: Array<number> = milStd.getModifiers_AM_AN_X(Modifiers.AM_DISTANCE);
                    if (AM != null && AM.length > 0) {
                        H2 = AM[0].toString();
                        tg.h2 = H2;
                    }
                    if (H2 != null && !(H2.length === 0)) {
                        for (j = 0; j < tg.LatLongs.length; j++) {
                            if (tg.LatLongs.length > j) {
                                if (!isNaN(parseFloat(H2))) {
                                    if (j == 0) {
                                        dist = parseFloat(H2);
                                        pt0 = new POINT2(tg.LatLongs[0]);
                                        pt1 = Geodesic.geodesic_coordinate(pt0, dist, 45);//45 is arbitrary
                                        let pt02d: Point2D = new Point2D(pt0.x, pt0.y);
                                        let pt12d: Point2D = new Point2D(pt1.x, pt1.y);
                                        pt02d = converter.GeoToPixels(pt02d);
                                        pt12d = converter.GeoToPixels(pt12d);
                                        pt0.x = pt02d.getX();
                                        pt0.y = pt02d.getY();
                                        pt1.x = pt12d.getX();
                                        pt1.y = pt12d.getY();
                                        dist = LineUtility.calcDistance(pt0, pt1);
                                    }
                                    tg.Pixels[j].style = Math.round(dist);
                                } else {
                                    tg.Pixels[j].style = 0;
                                }
                            }
                        }
                    }
                    break;
                default:
                    break;
            }
            if (lineType == TacticalLines.PBS_ELLIPSE) //geo ellipse
            {
                let AM: Array<number> = milStd.getModifiers_AM_AN_X(Modifiers.AM_DISTANCE);
                let AN: Array<number> = milStd.getModifiers_AM_AN_X(Modifiers.AN_AZIMUTH);
                if (AM != null && AM.length > 1) {
                    let strAM: string = AM[0].toString(); // major axis
                    tg.am = strAM;
                    let strAM1: string = AM[1].toString(); // minor axis
                    tg.am1 = strAM1;
                }
                if (AN != null && AN.length > 0) {
                    let strAN: string = AN[0].toString(); // rotation
                    tg.an = strAN;
                }
            }
            if (lineType === TacticalLines.BS_CAKE) {
                let AM: Array<number> = milStd.getModifiers_AM_AN_X(Modifiers.AM_DISTANCE);
                let AN: Array<number> = milStd.getModifiers_AM_AN_X(Modifiers.AN_AZIMUTH);
                if (AM != null) {
                    let strAM: string = "";
                    for (let j: number = 0; j < AM.length; j++) {
                        strAM += AM[j].toString();
                        if (j < AM.length - 1) {
                            strAM += ",";
                        }
                    }
                    tg.am = strAM;
                }
                if (AN != null) {
                    let strAN: string = "";
                    for (let j: number = 0; j < AN.length; j++) {
                        strAN += AN[j];
                        if (j < AN.length - 1) {
                            strAN += ",";
                        }
                    }
                    tg.an = strAN;
                }
                if (AM != null && AN != null) {
                    let numSectors: number = AN.length / 2;
                    let left: number = 0;
                    let right: number = 0;
                    let min: number = 0;
                    let max: number = 0;
                    //construct left,right,min,max from the arraylists
                    let strLeftRightMinMax: string = "";
                    for (let j: number = 0; j < numSectors; j++) {
                        left = AN[2 * j];
                        right = AN[2 * j + 1];
                        min = AM[2 * j];
                        max = AM[2 * j + 1];
                        strLeftRightMinMax += left.toString() + "," + right.toString() + "," + min.toString() + "," + max.toString();
                        if (j < numSectors - 1) {
                            strLeftRightMinMax += ",";
                        }

                    }
                    let len: number = strLeftRightMinMax.length;
                    let c: string = strLeftRightMinMax.substring(len - 1, len);
                    if (c === ",") {
                        strLeftRightMinMax = strLeftRightMinMax.substring(0, len - 1);
                    }
                    tg.leftRightMinMax = strLeftRightMinMax;
                }
            }
            if (lineType === TacticalLines.BS_RADARC) {
                let AM: Array<number> = milStd.getModifiers_AM_AN_X(Modifiers.AM_DISTANCE);
                let AN: Array<number> = milStd.getModifiers_AM_AN_X(Modifiers.AN_AZIMUTH);
                if (AM != null) {
                    let strAM: string = "";
                    for (let j: number = 0; j < AM.length && j < 2; j++) {
                        strAM += AM[j].toString();
                        if (j < AM.length - 1) {
                            strAM += ",";
                        }
                    }
                    tg.am = strAM;
                }
                if (AN != null) {
                    let strAN: string = "";
                    for (let j: number = 0; j < AN.length && j < 2; j++) {
                        strAN += AN[j];
                        if (j < AN.length - 1) {
                            strAN += ",";
                        }
                    }
                    tg.an = strAN;
                }
                if (AM != null && AN != null) {
                    let left: number = 0;
                    let right: number = 0;
                    let min: number = 0;
                    let max: number = 0;
                    //construct left,right,min,max from the arraylists
                    let strLeftRightMinMax: string = "";
                    left = AN[0];
                    right = AN[1];
                    min = AM[0];
                    max = AM[1];
                    strLeftRightMinMax += left.toString() + "," + right.toString() + "," + min.toString() + "," + max.toString();
                    tg.leftRightMinMax = strLeftRightMinMax;
                }
            }
            if (lineType === TacticalLines.BS_POLYARC) {
                let AM: Array<number> = milStd.getModifiers_AM_AN_X(Modifiers.AM_DISTANCE);
                let AN: Array<number> = milStd.getModifiers_AM_AN_X(Modifiers.AN_AZIMUTH);
                if (AM != null && AM.length > 0) {
                    let strAM: string = AM[0].toString();
                    tg.am = strAM;
                }
                if (AN != null) {
                    let strAN: string = "";
                    for (let j: number = 0; j < AN.length && j < 2; j++) {
                        strAN += AN[j];
                        if (j < AN.length - 1) {
                            strAN += ",";
                        }
                    }
                    tg.an = strAN;
                }                   
            }
            switch (lineType) {
                case TacticalLines.BBS_AREA:
                case TacticalLines.BBS_LINE:
                case TacticalLines.BBS_POINT:
                case TacticalLines.BBS_RECTANGLE:
                    if (tg.fillColor == null) {
                        tg.fillColor = Color.LIGHT_GRAY;
                    }
                    break;
                default:
                    break;
            }
            switch (lineType) {
                case TacticalLines.PBS_CIRCLE:
                case TacticalLines.BBS_POINT:
                case TacticalLines.BS_ROUTE:
                case TacticalLines.BS_TRACK:
                case TacticalLines.BS_ORBIT:
                    let AM: Array<number> = milStd.getModifiers_AM_AN_X(Modifiers.AM_DISTANCE);
                    if (AM != null && AM.length > 0) {
                        let strAM: string = String(AM[0]);
                        //set width for rectangles or radius for circles
                        tg.am = strAM;
                    } else if (lineType == TacticalLines.BBS_POINT && tg.LatLongs.length > 1) {
                        let dist: number = Geodesic.geodesic_distance(tg.LatLongs[0], tg.LatLongs[1]).distance;
                        let strT1: string = String(dist);
                        tg.t1 = strT1;
                    }
                    break;
                default:
                    break;
            }
            if (lineType === TacticalLines.BS_TRACK) {
                let AM: Array<number> = milStd.getModifiers_AM_AN_X(Modifiers.AM_DISTANCE);
                if (AM != null) {
                    let strAM: string = "";
                    for (let j: number = 0; j < AM.length; j++) {
                        strAM += AM[j].toString();
                        if (j < AM.length - 1) {
                            strAM += ",";
                        }
                    }
                    tg.am = strAM;
                }
            }
            if (lineType == TacticalLines.PBS_RECTANGLE || lineType == TacticalLines.PBS_SQUARE) {
                let AM: Array<number> = milStd.getModifiers_AM_AN_X(Modifiers.AM_DISTANCE);
                let AN: Array<number> = milStd.getModifiers_AM_AN_X(Modifiers.AN_AZIMUTH);
                if (lineType == TacticalLines.PBS_SQUARE) //for square
                {
                    let r2: number=AM[0];
                    let b: number=0;
                    if(AM.length==1)
                    {
                        AM.push(r2);
                        AM.push(b);
                    }
                    else if(AM.length==2)
                    {
                        b=AM[1];
                        AM[1] = r2;
                        AM.push(b);
                    }
                    else if(AM.length>2)
                        AM[1] = r2;
                }
                //if all these conditions are not met we do not want to set any tg modifiers
                if (lineType == TacticalLines.PBS_SQUARE) //square
                {
                    let am0: number = AM[0];
                    if (AM.length == 1) {
                        AM.push(am0);
                    } else if (AM.length >= 2) {
                        AM[1] = am0;
                    }
                }
                if (AN == null) {
                    AN = [];
                }
                if (AN.length === 0) {
                    AN.push(0);
                }

                if (AM != null && AM.length > 1) {
                    let strAM: string = String(AM[0]);    //width
                    let strAM1: string = String(AM[1]);     //length
                    //set width and length in meters for rectangular target
                    tg.am = strAM;
                    tg.am1 = strAM1;
                    //set attitude in degrees
                    let strAN: string = String(AN[0]);
                    tg.an = strAN;
                }
                /*
                if(AM.length>2)
                {
                    let strH1: string = string(AM.get(2));     //buffer size
                    tg.h1 = strH1;
                }
                 */
            }
        } catch (exc) {
            if (exc instanceof Error) {
               ErrorLogger.LogException("MultipointRenderer", "createTacticalGraphicFromBasicMilStdSymbol",
                    exc);
            } else {
                throw exc;
            }
        }

        return tg;
    }

    /**
     * Create MilStdSymbol from tactical graphic
     *
     * @deprecated
     * @param tg tactical graphic
     * @param converter geographic to pixels to converter
     * @return MilstdSymbol object
     */
    public static createMilStdSymboFromTacticalGraphic(tg: TacticalGraphic, converter: IPointConversion): MilStdSymbol {
        let milStd: MilStdSymbol;
        try {
            let symbolId: string = tg.symbolId;
            let lineType: number = clsUtilityJTR.GetLinetypeFromString(symbolId);
            let status: string = tg.status;
            //build tg.Pixels
            tg.Pixels = MultipointUtils.LatLongToPixels(tg.LatLongs, converter);
            let isClosedArea: boolean = clsUtilityJTR.isClosedPolygon(lineType);
            if (isClosedArea) {
                clsUtilityJTR.ClosePolygon(tg.Pixels);
                clsUtilityJTR.ClosePolygon(tg.LatLongs);
            }

            let coords: Array<Point2D> = MultipointRenderer.getClientCoords(tg);
            tg.font = new Font("Arial", Font.PLAIN, 12);
            let modifiers: Map<string, string> = new Map();
            modifiers.set(Modifiers.W_DTG_1, tg.dtg);
            modifiers.set(Modifiers.W1_DTG_2, tg.dtg1);
            modifiers.set(Modifiers.H_ADDITIONAL_INFO_1, tg.h);
            modifiers.set(Modifiers.H1_ADDITIONAL_INFO_2, tg.h1);
            modifiers.set(Modifiers.H2_ADDITIONAL_INFO_3, tg.h2);
            modifiers.set(Modifiers.T_UNIQUE_DESIGNATION_1, tg.name);
            modifiers.set(Modifiers.T1_UNIQUE_DESIGNATION_2, tg.t1);
            modifiers.set(Modifiers.Y_LOCATION, tg.location);
            modifiers.set(Modifiers.N_HOSTILE, tg.n);

            milStd = new MilStdSymbol(symbolId, "1", coords, modifiers);
            milStd.setFillColor(tg.fillColor);
            milStd.setLineColor(tg.lineColor);
            milStd.setLineWidth(tg.lineThickness);
            milStd.setFillStyle(tg.texturePaint);
            milStd.setPatternScale(tg.patternScale);
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException("MultipointRenderer", "createMilStdSymboFromTacticalGraphic",
                    exc);
            } else {
                throw exc;
            }
        }
        return milStd;
    }

    /**
     * Build a tactical graphic object from the client MilStdSymbol
     *
     * @param milStd MilstdSymbol object
     * @param converter geographic to pixels converter
     * @return tactical graphic
     */
    public static createTacticalGraphicFromMilStdSymbol(milStd: MilStdSymbol,
        converter: IPointConversion): TacticalGraphic;

    /**
     * @deprecated @param milStd
     * @param converter
     * @param computeChannelPt
     * @return
     */
    public static createTacticalGraphicFromMilStdSymbol(milStd: MilStdSymbol,
        converter: IPointConversion, computeChannelPt: boolean): TacticalGraphic;
    public static createTacticalGraphicFromMilStdSymbol(...args: unknown[]): TacticalGraphic {
        switch (args.length) {
            case 2: {
                const [milStd, converter] = args as [MilStdSymbol, IPointConversion];


                let tg: TacticalGraphic = new TacticalGraphic();
                try {
                    let symbolId: string = milStd.getSymbolID();
                    tg.symbolId = symbolId;
                    let useLineInterpolation: boolean = milStd.getUseLineInterpolation();
                    tg.useLineInterpolation = useLineInterpolation;
                    let lineType: number = clsUtilityJTR.GetLinetypeFromString(symbolId);
                    tg.lineType = lineType;
                    let status: string = tg.status;
                    if (status != null && status === "A") {
                        tg.lineStyle = 1;
                    }
                    tg.visibleModifiers = true;
                    //set tg latlongs and pixels
                    MultipointRenderer.setClientCoords(milStd, tg);
                    //build tg.Pixels
                    tg.Pixels = MultipointUtils.LatLongToPixels(tg.LatLongs, converter);
                    //tg.font = new Font("Arial", Font.PLAIN, 12);
                    tg.font = rendererSettings.getMPLabelFont();

                    tg.fillColor = milStd.getFillColor();
                    tg.lineColor = milStd.getLineColor();
                    tg.lineThickness = milStd.getLineWidth();
                    tg.texturePaint = milStd.getFillStyle();
                    tg.patternScale = milStd.getPatternScale();

                    tg.setIconSize(milStd.getUnitSize());
                    tg.keepUnitRatio = milStd.getKeepUnitRatio();

                    tg.fontBackColor = Color.WHITE;
                    tg.textColor = milStd.getTextColor();
                    if (milStd.getModifier(Modifiers.W_DTG_1) != null) {
                        tg.dtg = milStd.getModifier(Modifiers.W_DTG_1);
                    }
                    if (milStd.getModifier(Modifiers.W1_DTG_2) != null) {
                        tg.dtg1 = milStd.getModifier(Modifiers.W1_DTG_2);
                    }
                    if (milStd.getModifier(Modifiers.H_ADDITIONAL_INFO_1) != null) {
                        tg.h = milStd.getModifier(Modifiers.H_ADDITIONAL_INFO_1);
                    }
                    if (milStd.getModifier(Modifiers.H1_ADDITIONAL_INFO_2) != null) {
                        tg.h1 = milStd.getModifier(Modifiers.H1_ADDITIONAL_INFO_2);
                    }
                    if (milStd.getModifier(Modifiers.H2_ADDITIONAL_INFO_3) != null) {
                        tg.h2 = milStd.getModifier(Modifiers.H2_ADDITIONAL_INFO_3);
                    }
                    if (milStd.getModifier(Modifiers.T_UNIQUE_DESIGNATION_1) != null) {
                        tg.name = milStd.getModifier(Modifiers.T_UNIQUE_DESIGNATION_1);
                    }
                    if (milStd.getModifier(Modifiers.T1_UNIQUE_DESIGNATION_2) != null) {
                        tg.t1 = milStd.getModifier(Modifiers.T1_UNIQUE_DESIGNATION_2);
                    }
                    if (milStd.getModifier(Modifiers.V_EQUIP_TYPE) != null) {
                        tg.v = milStd.getModifier(Modifiers.V_EQUIP_TYPE);
                    }
                    if (milStd.getModifier(Modifiers.AS_COUNTRY) != null) {
                        tg.as = milStd.getModifier(Modifiers.AS_COUNTRY);
                    }
                    if (milStd.getModifier(Modifiers.AP_TARGET_NUMBER) != null) {
                        tg.ap = milStd.getModifier(Modifiers.AP_TARGET_NUMBER);
                    }
                    if (milStd.getModifier(Modifiers.Y_LOCATION) != null) {
                        tg.location = milStd.getModifier(Modifiers.Y_LOCATION);
                    }
                    if (milStd.getModifier(Modifiers.N_HOSTILE) != null) {
                        tg.n = milStd.getModifier(Modifiers.N_HOSTILE);
                    }
                    tg.useDashArray = milStd.getUseDashArray();
                    tg.useHatchFill = milStd.getUseFillPattern();
                    //tg.set_UsePatternFill(milStd.getUseFillPattern());
                    tg.hideOptionalLabels = milStd.getHideOptionalLabels();
                    let isClosedArea: boolean = clsUtilityJTR.isClosedPolygon(lineType);

                    if (lineType === TacticalLines.STRIKWARN) {
                        let poly1Pixels: Array<POINT2> = tg.Pixels.slice(0, tg.Pixels.length / 2);
                        let poly1LatLons: Array<POINT2> = tg.LatLongs.slice(0, tg.LatLongs.length / 2);
                        let poly2Pixels: Array<POINT2> = tg.Pixels.slice(tg.Pixels.length / 2, tg.Pixels.length);
                        let poly2LatLons: Array<POINT2> = tg.LatLongs.slice(tg.LatLongs.length / 2, tg.LatLongs.length);

                        clsUtilityJTR.ClosePolygon(poly1Pixels);
                        clsUtilityJTR.ClosePolygon(poly1LatLons);
                        tg.Pixels = poly1Pixels;
                        tg.LatLongs = poly1LatLons;

                        clsUtilityJTR.ClosePolygon(poly2Pixels);
                        clsUtilityJTR.ClosePolygon(poly2LatLons);
                        tg.Pixels.push(...poly2Pixels);
                        tg.LatLongs.push(...poly2LatLons);
                    }
                    else {
                        if (isClosedArea) {
                            clsUtilityJTR.ClosePolygon(tg.Pixels);
                            clsUtilityJTR.ClosePolygon(tg.LatLongs);
                        }
                    }


                    //implement meters to feet for altitude labels
                    let altitudeLabel: string = milStd.getAltitudeMode();
                    if (altitudeLabel == null || altitudeLabel.length === 0) {
                        altitudeLabel = "AMSL";
                    }
                    let altitudeUnit: DistanceUnit = milStd.getAltitudeUnit();
                    if (altitudeUnit == null) {
                        altitudeUnit = DistanceUnit.FEET;
                    }
                    let distanceUnit: DistanceUnit = milStd.getDistanceUnit();
                    if (distanceUnit == null) {
                        distanceUnit = DistanceUnit.METERS;
                    }

                    let strXAlt: string = "";
                    //construct the H1 and H2 modifiers for sector from the mss AM, AN, and X arraylists
                    if (lineType === TacticalLines.RANGE_FAN_SECTOR) {
                        let AM: Array<number> = milStd.getModifiers_AM_AN_X(Modifiers.AM_DISTANCE);
                        let AN: Array<number> = milStd.getModifiers_AM_AN_X(Modifiers.AN_AZIMUTH);
                        let X: Array<number> = milStd.getModifiers_AM_AN_X(Modifiers.X_ALTITUDE_DEPTH);
                        if (AM != null) {
                            let strAM: string = "";
                            for (let j: number = 0; j < AM.length; j++) {
                                strAM += AM[j].toString();
                                if (j < AM.length - 1) {
                                    strAM += ",";
                                }
                            }
                            tg.am = strAM;
                        }
                        if (AN != null) {
                            let strAN: string = "";
                            for (let j: number = 0; j < AN.length; j++) {
                                strAN += AN[j];
                                if (j < AN.length - 1) {
                                    strAN += ",";
                                }
                            }
                            tg.an = strAN;
                        }
                        if (X != null) {
                            let strX: string = "";
                            for (let j: number = 0; j < X.length; j++) {
                                strXAlt = MultipointRenderer.createAltitudeLabel(X[j], altitudeUnit, altitudeLabel);
                                strX += strXAlt;

                                if (j < X.length - 1) {
                                    strX += ",";
                                }
                            }
                            tg.x = strX;
                        }
                        if (AM != null && AN != null) {
                            let numSectors: number = AN.length / 2;
                            let left: number = 0;
                            let right: number = 0;
                            let min: number = 0;
                            let max: number = 0;
                            //construct left,right,min,max from the arraylists
                            let strLeftRightMinMax: string = "";
                            for (let j: number = 0; j < numSectors; j++) {
                                left = AN[2 * j];
                                right = AN[2 * j + 1];
                                if (j + 1 === AM.length) {
                                    break;
                                }
                                min = AM[j];
                                max = AM[j + 1];
                                strLeftRightMinMax += left.toString() + "," + right.toString() + "," + min.toString() + "," + max.toString();
                                if (j < numSectors - 1) {
                                    strLeftRightMinMax += ",";
                                }

                            }
                            let len: number = strLeftRightMinMax.length;
                            let c: string = strLeftRightMinMax.substring(len - 1, len);
                            if (c === ",") {
                                strLeftRightMinMax = strLeftRightMinMax.substring(0, len - 1);
                            }
                            tg.leftRightMinMax = strLeftRightMinMax;
                        }
                    } else {
                        if (lineType === TacticalLines.RADAR_SEARCH) {
                            let AM: Array<number> = milStd.getModifiers_AM_AN_X(Modifiers.AM_DISTANCE);
                            let AN: Array<number> = milStd.getModifiers_AM_AN_X(Modifiers.AN_AZIMUTH);
                            if (AM != null) {
                                let strAM: string = "";
                                for (let j: number = 0; j < AM.length && j < 2; j++) {
                                    strAM += AM[j].toString();
                                    if (j < AM.length - 1) {
                                        strAM += ",";
                                    }
                                }
                                tg.am = strAM;
                            }
                            if (AN != null) {
                                let strAN: string = "";
                                for (let j: number = 0; j < AN.length && j < 2; j++) {
                                    strAN += AN[j];
                                    if (j < AN.length - 1) {
                                        strAN += ",";
                                    }
                                }
                                tg.an = strAN;
                            }
                            if (AM != null && AN != null) {
                                let left: number = 0;
                                let right: number = 0;
                                let min: number = 0;
                                let max: number = 0;
                                //construct left,right,min,max from the arraylists
                                let strLeftRightMinMax: string = "";
                                left = AN[0];
                                right = AN[1];
                                min = AM[0];
                                max = AM[1];
                                strLeftRightMinMax += left.toString() + "," + right.toString() + "," + min.toString() + "," + max.toString();
                                tg.leftRightMinMax = strLeftRightMinMax;
                            }
                        }
                    }

                    let j: number = 0;
                    if (lineType === TacticalLines.LAUNCH_AREA || lineType === TacticalLines.DEFENDED_AREA_CIRCULAR || lineType === TacticalLines.SHIP_AOI_CIRCULAR) //geo ellipse
                    {
                        let AM: Array<number> = milStd.getModifiers_AM_AN_X(Modifiers.AM_DISTANCE);
                        let AN: Array<number> = milStd.getModifiers_AM_AN_X(Modifiers.AN_AZIMUTH);
                        if (AM != null && AM.length > 1) {
                            let strAM: string = AM[0].toString(); // major axis
                            tg.am = strAM;
                            let strAM1: string = AM[1].toString(); // minor axis
                            tg.am1 = strAM1;
                        }
                        if (AN != null && AN.length > 0) {
                            let strAN: string = AN[0].toString(); // rotation
                            tg.an = strAN;
                        }
                    }
                    switch (lineType) {
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
                        case TacticalLines.ACA:
                        case TacticalLines.ACA_RECTANGULAR:
                        case TacticalLines.ACA_CIRCULAR:
                        case TacticalLines.WFZ: {
                            let X: Array<number> = milStd.getModifiers_AM_AN_X(Modifiers.X_ALTITUDE_DEPTH);
                            if (X != null && X.length > 0) {
                                strXAlt = MultipointRenderer.createAltitudeLabel(X[0], altitudeUnit, altitudeLabel);
                                tg.x = strXAlt;
                            }
                            if (X != null && X.length > 1) {
                                strXAlt = MultipointRenderer.createAltitudeLabel(X[1], altitudeUnit, altitudeLabel);
                                tg.x1 = strXAlt;
                            }
                            break;
                        }

                        case TacticalLines.SC:
                        case TacticalLines.MRR:
                        case TacticalLines.SL:
                        case TacticalLines.TC:
                        case TacticalLines.LLTR:
                        case TacticalLines.AC:
                        case TacticalLines.SAAFR: {
                            let pt: POINT2 = tg.LatLongs[0];
                            let pt2d0: Point2D = new Point2D(pt.x, pt.y);
                            let pt2d0Pixels: Point2D = converter.GeoToPixels(pt2d0);
                            let pt0Pixels: POINT2 = new POINT2(pt2d0Pixels.getX(), pt2d0Pixels.getY());

                            //get some point 10000 meters away from pt
                            //10000 should work for any scale                    
                            let dist: number = 10000;
                            let pt2: POINT2 = Geodesic.geodesic_coordinate(pt, dist, 0);
                            let pt2d1: Point2D = new Point2D(pt2.x, pt2.y);
                            let pt2d1Pixels: Point2D = converter.GeoToPixels(pt2d1);
                            let pt1Pixels: POINT2 = new POINT2(pt2d1Pixels.getX(), pt2d1Pixels.getY());
                            //calculate pixels per meter
                            let distPixels: number = LineUtility.calcDistance(pt0Pixels, pt1Pixels);
                            let pixelsPerMeter: number = distPixels / dist;

                            let AM: Array<number> = milStd.getModifiers_AM_AN_X(Modifiers.AM_DISTANCE);
                            if (AM != null) {
                                let strAM: string = "";
                                for (j = 0; j < AM.length; j++) {
                                    strAM += AM[j].toString();
                                    if (j < AM.length - 1) {
                                        strAM += ",";
                                    }
                                }
                                tg.am = strAM;
                            }
                            let strRadii: string[];
                            //get the widest value
                            //the current requirement is to use the greatest width as the default width
                            let maxWidth: number = 0;
                            let
                                temp: number = 0;
                            let maxWidthMeters: number = 0;
                            if (tg.am != null && tg.am.length > 0) {
                                strRadii = tg.am.split(",");
                                if (strRadii.length > 0) {
                                    for (j = 0; j < strRadii.length; j++) {
                                        if (!Number.isNaN(parseFloat(strRadii[j]))) {
                                            temp = parseFloat(strRadii[j]);
                                            if (temp > maxWidth) {
                                                maxWidth = temp;
                                            }
                                        }
                                    }
                                    maxWidthMeters = maxWidth;
                                    maxWidth *= pixelsPerMeter / 2;

                                    for (j = 0; j < tg.Pixels.length; j++) {
                                        if (strRadii.length > j) {
                                            if (!Number.isNaN(parseFloat(strRadii[j]))) {
                                                let pixels: number = parseFloat(strRadii[j]) * pixelsPerMeter / 2;
                                                tg.Pixels[j].style = pixels as number;
                                                tg.LatLongs[j].style = pixels as number;
                                            } else {
                                                tg.Pixels[j].style = maxWidth as number;
                                                tg.LatLongs[j].style = maxWidth as number;
                                            }
                                        } else {
                                            tg.Pixels[j].style = maxWidth as number;
                                            tg.LatLongs[j].style = maxWidth as number;
                                        }
                                    }
                                }
                            }

                            maxWidthMeters *= distanceUnit.conversionFactor;
                            maxWidthMeters *= 10.0;
                            maxWidthMeters = Math.round(maxWidthMeters);
                            let tempWidth: number = maxWidthMeters as number;
                            maxWidthMeters = tempWidth / 10.0;

                            tg.am = maxWidthMeters.toString() + " " + distanceUnit.label;
                            //use X, X1 to set tg.H, tg.H1
                            let X = milStd.getModifiers_AM_AN_X(Modifiers.X_ALTITUDE_DEPTH);
                            if (X != null && X.length > 0) {
                                strXAlt = MultipointRenderer.createAltitudeLabel(X[0], altitudeUnit, altitudeLabel);
                                tg.x = strXAlt;
                            }
                            if (X != null && X.length > 1) {
                                strXAlt = MultipointRenderer.createAltitudeLabel(X[1], altitudeUnit, altitudeLabel);
                                tg.x1 = strXAlt;
                            }
                            break;
                        }

                        default: {
                            break;
                        }

                    }
                    //circular range fans
                    if (lineType === TacticalLines.RANGE_FAN) {
                        let AM: Array<number> = milStd.getModifiers_AM_AN_X(Modifiers.AM_DISTANCE);
                        let X: Array<number> = milStd.getModifiers_AM_AN_X(Modifiers.X_ALTITUDE_DEPTH);
                        let strAM: string = "";
                        let strX: string = "";
                        if (AM != null) {
                            // Range fan circular has a maximum of 3 circles
                            for (j = 0; j < AM.length && j < 3; j++) {
                                strAM += AM[j].toString();
                                if (j < AM.length - 1) {
                                    strAM += ",";
                                }

                                if (X != null && j < X.length) {
                                    strXAlt = MultipointRenderer.createAltitudeLabel(X[j], altitudeUnit, altitudeLabel);
                                    strX += strXAlt;
                                    if (j < X.length - 1) {
                                        strX += ",";
                                    }
                                }
                            }
                        }
                        tg.am = strAM;
                        tg.x = strX;
                    }
                    switch (lineType) {
                        case TacticalLines.PAA_RECTANGULAR:
                        case TacticalLines.RECTANGULAR_TARGET:
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
                        case TacticalLines.CIRCULAR:
                        case TacticalLines.BDZ:
                        case TacticalLines.FSA_CIRCULAR:
                        case TacticalLines.NOTACK:
                        case TacticalLines.ACA_CIRCULAR:
                        case TacticalLines.FFA_CIRCULAR:
                        case TacticalLines.NFA_CIRCULAR:
                        case TacticalLines.RFA_CIRCULAR:
                        case TacticalLines.PAA_CIRCULAR:
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
                        case TacticalLines.KILLBOXPURPLE_CIRCULAR:
                        case TacticalLines.KILLBOXBLUE_RECTANGULAR:
                        case TacticalLines.KILLBOXPURPLE_RECTANGULAR: {
                            let AM: Array<number> = milStd.getModifiers_AM_AN_X(Modifiers.AM_DISTANCE);
                            if (AM != null && AM.length > 0) {
                                let strAM: string = AM[0].toString();
                                //set width for rectangles or radius for circles
                                tg.am = strAM;
                            }
                            break;
                        }

                        default: {
                            break;
                        }

                    }
                    if (lineType === TacticalLines.RECTANGULAR || lineType === TacticalLines.CUED_ACQUISITION) {
                        let AM: Array<number> = milStd.getModifiers_AM_AN_X(Modifiers.AM_DISTANCE);
                        let AN: Array<number> = milStd.getModifiers_AM_AN_X(Modifiers.AN_AZIMUTH);
                        if (AN == null) {
                            AN = new Array();
                        }
                        if (AN.length === 0) {
                            AN.push(0);
                        }

                        if (AM != null && AM.length > 1) {
                            let strAM: string = AM[0].toString();    //width
                            let strAM1: string = AM[1].toString();     //length
                            //set width and length in meters for rectangular target
                            tg.am = strAM;
                            tg.am1 = strAM1;
                            //set attitude in degrees
                            let strAN: string = AN[0].toString();
                            tg.an = strAN;
                        }
                        /*
                        if(AM.length>2)
                        {
                            let strH1: string = string(AM[2]);     //buffer size
                            tg.h1 = strH1;
                        }
                         */
                    }
                } catch (exc) {
                    if (exc instanceof Error) {
                        ErrorLogger.LogException("MultipointRenderer", "createTacticalGraphicfromMilStdSymbol",
                            exc);
                    } else {
                        throw exc;
                    }
                }
                return tg;


                break;
            }

            case 3: {
                const [milStd, converter, computeChannelPt] = args as [MilStdSymbol, IPointConversion, boolean];


                let tg: TacticalGraphic = new TacticalGraphic();
                try {
                    let symbolId: string = milStd.getSymbolID();
                    tg.symbolId = symbolId;
                    let status: string = tg.status;
                    if (status != null && status === "A") {
                        //lineStyle=GraphicProperties.LINE_TYPE_DASHED;
                        tg.lineStyle = 1;
                    }
                    tg.visibleModifiers = true;
                    //set tg latlongs and pixels
                    MultipointRenderer.setClientCoords(milStd, tg);
                    //build tg.Pixels
                    tg.Pixels = MultipointUtils.LatLongToPixels(tg.LatLongs, converter);
                    tg.font = new Font("Arial", Font.PLAIN, 12);
                    tg.fillColor = milStd.getFillColor();
                    tg.lineColor = milStd.getLineColor();
                    tg.lineThickness = milStd.getLineWidth();
                    tg.texturePaint = milStd.getFillStyle();
                    tg.patternScale = milStd.getPatternScale();
                    tg.fontBackColor = Color.WHITE;
                    tg.textColor = milStd.getTextColor();

                    //            tg.dtg = milStd.getModifier(Modifiers.W_DTG_1);
                    //            tg.dtg1 = milStd.getModifier(Modifiers.W1_DTG_2);
                    //            tg.h = milStd.getModifier(Modifiers.H_ADDITIONAL_INFO_1);
                    //            tg.h1 = milStd.getModifier(Modifiers.H1_ADDITIONAL_INFO_2);
                    //            tg.h2 = milStd.getModifier(Modifiers.H2_ADDITIONAL_INFO_3);
                    //            tg.name = milStd.getModifier(Modifiers.T_UNIQUE_DESIGNATION_1);
                    //            tg.t1 = milStd.getModifier(Modifiers.T1_UNIQUE_DESIGNATION_2);
                    //            tg.location = milStd.getModifier(Modifiers.Y_LOCATION);
                    //            tg.n = Modifiers.N_HOSTILE;
                    if (milStd.getModifier(Modifiers.W_DTG_1) != null) {
                        tg.dtg = milStd.getModifier(Modifiers.W_DTG_1);
                    }
                    if (milStd.getModifier(Modifiers.W1_DTG_2) != null) {
                        tg.dtg1 = milStd.getModifier(Modifiers.W1_DTG_2);
                    }
                    if (milStd.getModifier(Modifiers.H_ADDITIONAL_INFO_1) != null) {
                        tg.h = milStd.getModifier(Modifiers.H_ADDITIONAL_INFO_1);
                    }
                    if (milStd.getModifier(Modifiers.H1_ADDITIONAL_INFO_2) != null) {
                        tg.h1 = milStd.getModifier(Modifiers.H1_ADDITIONAL_INFO_2);
                    }
                    if (milStd.getModifier(Modifiers.H2_ADDITIONAL_INFO_3) != null) {
                        tg.h2 = milStd.getModifier(Modifiers.H2_ADDITIONAL_INFO_3);
                    }
                    if (milStd.getModifier(Modifiers.T_UNIQUE_DESIGNATION_1) != null) {
                        tg.name = milStd.getModifier(Modifiers.T_UNIQUE_DESIGNATION_1);
                    }
                    if (milStd.getModifier(Modifiers.T1_UNIQUE_DESIGNATION_2) != null) {
                        tg.t1 = milStd.getModifier(Modifiers.T1_UNIQUE_DESIGNATION_2);
                    }
                    if (milStd.getModifier(Modifiers.V_EQUIP_TYPE) != null) {
                        tg.v = milStd.getModifier(Modifiers.V_EQUIP_TYPE);
                    }
                    if (milStd.getModifier(Modifiers.AS_COUNTRY) != null) {
                        tg.as = milStd.getModifier(Modifiers.AS_COUNTRY);
                    }
                    if (milStd.getModifier(Modifiers.AP_TARGET_NUMBER) != null) {
                        tg.ap = milStd.getModifier(Modifiers.AP_TARGET_NUMBER);
                    }
                    if (milStd.getModifier(Modifiers.Y_LOCATION) != null) {
                        tg.location = milStd.getModifier(Modifiers.Y_LOCATION);
                    }
                    if (milStd.getModifier(Modifiers.N_HOSTILE) != null) {
                        tg.n = milStd.getModifier(Modifiers.N_HOSTILE);
                    }

                    //int lineType=CELineArray.CGetLinetypeFromString(tg.symbolId);
                    let lineType: number = clsUtilityJTR.GetLinetypeFromString(symbolId);
                    let isClosedArea: boolean = clsUtilityJTR.isClosedPolygon(lineType);

                    if (isClosedArea) {
                        clsUtilityJTR.ClosePolygon(tg.Pixels);
                        clsUtilityJTR.ClosePolygon(tg.LatLongs);
                    }

                    //these channels need a channel point added
                    if (computeChannelPt) {
                        switch (lineType) {
                            case TacticalLines.CATK:
                            case TacticalLines.CATKBYFIRE:
                            case TacticalLines.AAAAA:
                            case TacticalLines.AIRAOA:
                            case TacticalLines.MAIN:
                            case TacticalLines.SPT:
                            case TacticalLines.FRONTAL_ATTACK:
                            case TacticalLines.TURNING_MOVEMENT:
                            case TacticalLines.MOVEMENT_TO_CONTACT: {
                                let ptPixels: POINT2 = clsUtilityJTR.ComputeLastPoint(tg.Pixels);
                                tg.Pixels.push(ptPixels);
                                //Point pt = MultipointUtils.POINT2ToPoint(ptPixels);
                                let pt: Point2D = new Point2D(ptPixels.x, ptPixels.y);
                                //in case it needs the corresponding geo point
                                let ptGeo2d: Point2D = converter.PixelsToGeo(pt);
                                let ptGeo: POINT2 = MultipointUtils.Point2DToPOINT2(ptGeo2d);
                                tg.LatLongs.push(ptGeo);
                                //}
                                break;
                            }

                            default: {
                                break;
                            }

                        }
                    }
                } catch (exc) {
                    if (exc instanceof Error) {
                        ErrorLogger.LogException("MultipointRenderer", "createTacticalGraphicfromMilStdSymbol",
                            exc);
                    } else {
                        throw exc;
                    }
                }
                return tg;


                break;
            }

            default: {
                throw Error(`Invalid number of arguments`);
            }
        }
    }


    private static createAltitudeLabel(distance: number, altitudeUnit: DistanceUnit, altitudeLabel: string): string {
        let conversionFactor: number = 0;

        // if using "FL" (Flight Level) for altitudeLabel, override conversion factor to avoid potential user error with altitudeUnit
        if (altitudeLabel === "FL") {
            conversionFactor = DistanceUnit.FLIGHT_LEVEL.conversionFactor;
        } else {
            conversionFactor = altitudeUnit.conversionFactor;
        }

        // Truncate the result
        let result: number = distance * conversionFactor;
        result *= 10.0;
        result = Math.round(result);
        let tempResult: number = Math.trunc(result);
        let truncatedResult: number = Math.trunc(tempResult / 10);
        // MIL-STD-2525D says altitude/depth must be an integer

        // Simplifies labels of "0 units AGL" to "GL" (Ground Level) and "0 units AMSL/BMSL" to "MSL" (Mean Sea Level)
        // as permitted by MIL-STD-2525D 5.3.7.5.1.
        // Also works for "0 units GL" and "0 units MSL", which are improperly labeled but can be understood to mean the same thing.
        if (truncatedResult === 0) {
            if (altitudeLabel === "AGL" || altitudeLabel === "GL") {
                return "GL";
            }
            if (altitudeLabel === "AMSL" || altitudeLabel === "BMSL" || altitudeLabel === "MSL") {
                return "MSL";
            }
        }

        // Flight level is a special altitude displayed as "FL ###" where ### are 3 digits representing hundreds of feet.
        if (altitudeLabel === "FL") {
            return "FL " + String(truncatedResult).padStart(3, '0');
        }

        return truncatedResult + " " + altitudeUnit.label + " " + altitudeLabel;
    }

    private static Shape2ToShapeInfo(shapeInfos: Array<ShapeInfo>, shapes: Array<Shape2>): void {
        try {
            let j: number = 0;
            let shape: Shape2;
            if (shapes == null || shapeInfos == null || shapes.length === 0) {
                return;
            }

            for (j = 0; j < shapes.length; j++) 
            {
                shape = shapes[j];
                if(shape != null && shape !== undefined)
                    shapeInfos.push(shape as ShapeInfo);
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException("MultipointRenderer", "Shape2ToShapeInfo",
                    exc);
            } else {
                throw exc;
            }
        }
    }

    /**
     * Added function to handle when coords or display area spans IDL but not
     * both, it prevents the symbol from rendering if the bounding rectangles
     * don't intersect.
     *
     * @param tg
     * @param converter
     * @param clipArea
     * @return
     */
    public static intersectsClipArea(tg: TacticalGraphic, converter: IPointConversion, clipArea: Point2D[] | Rectangle | Rectangle2D): boolean {
        let result: boolean = false;
        try {
            if (clipArea == null || tg.LatLongs.length < 2) {
                return true;
            }

            let clipBounds: Rectangle2D = null;
            let clipPoints: Array<Point2D> = null;

            //            if (clipArea != null) {
            //                if (clipArea.getClass().isAssignableFrom(Rectangle2D.class)) {
            //                    clipBounds = (Rectangle2D) clipArea;
            //                } else if (clipArea.getClass().isAssignableFrom(Rectangle.class)) {
            //                    clipBounds = (Rectangle2D) clipArea;
            //                } else if (clipArea.getClass().isAssignableFrom(ArrayList.class)) {
            //                    clipPoints = (ArrayList<Point2D>) clipArea;
            //                }
            //            }
            if (clipArea != null) {
                if (clipArea instanceof Rectangle2D) {
                    clipBounds = clipArea as Rectangle2D;
                } else {
                    if (clipArea instanceof Rectangle) {
                        let rectx: Rectangle = clipArea as Rectangle;
                        clipBounds = new Rectangle2D(rectx.x, rectx.y, rectx.width, rectx.height);
                    } else {
                        if (clipArea instanceof Array) {
                            clipPoints = clipArea as Array<Point2D>;
                            //let x0: number=clipPoints[0].getX(),y0=clipPoints[0].getY();
                            //let w: number=clipPoints[1].getX()-x0,h=clipPoints[3].getY()-y0;
                            //clipBounds = new Rectangle2D(x0, y0, w, h);
                            clipBounds = MultipointUtils.getMBR(clipPoints);
                        }
                    }

                }

            }
            //assumes we are using clipBounds
            let j: number = 0;
            let x: number = clipBounds.getMinX();
            let y: number = clipBounds.getMinY();
            let width: number = clipBounds.getWidth();
            let height: number = clipBounds.getHeight();
            let tl: POINT2 = new POINT2(x, y);
            let br: POINT2 = new POINT2(x + width, y + height);
            tl = MultipointUtils.PointPixelsToLatLong(tl, converter);
            br = MultipointUtils.PointPixelsToLatLong(br, converter);
            //the latitude range
            //boolean ptInside = false, ptAbove = false, ptBelow = false;
            let coordsLeft: number = tg.LatLongs[0].x;
            let coordsRight: number = coordsLeft;
            let coordsTop: number = tg.LatLongs[0].y;
            let coordsBottom: number = coordsTop;
            let intersects: boolean = false;
            let minx: number = tg.LatLongs[0].x;
            let maxx: number = minx;
            let maxNegX: number = 0;
            for (j = 0; j < tg.LatLongs.length; j++) {
                let pt: POINT2 = tg.LatLongs[j];
                if (pt.x < minx) {

                    minx = pt.x;
                }

                if (pt.x > maxx) {

                    maxx = pt.x;
                }

                if (maxNegX === 0 && pt.x < 0) {

                    maxNegX = pt.x;
                }

                if (maxNegX < 0 && pt.x < 0 && pt.x > maxNegX) {

                    maxNegX = pt.x;
                }

                if (pt.y < coordsBottom) {

                    coordsBottom = pt.y;
                }

                if (pt.y > coordsTop) {

                    coordsTop = pt.y;
                }

            }
            let coordSpanIDL: boolean = false;
            if (maxx === 180 || minx === -180) {

                coordSpanIDL = true;
            }

            if (maxx - minx >= 180) {
                coordSpanIDL = true;
                coordsLeft = maxx;
                coordsRight = maxNegX;
            } else {
                coordsLeft = minx;
                coordsRight = maxx;
            }
            //if(canClipPoints)
            //{                
            if (br.y <= coordsBottom && coordsBottom <= tl.y) {
                intersects = true;
            } else if (coordsBottom <= br.y && br.y <= coordsTop) {
                intersects = true;
            }
            else {
                return false;
            }

            //}
            //if it gets this far then the latitude ranges intersect
            //re-initialize intersects for the longitude ranges
            intersects = false;
            //the longitude range
            //the min and max coords longitude
            let boxSpanIDL: boolean = false;
            //boolean coordSpanIDL = false;
            if (tl.x === 180 || tl.x === -180 || br.x === 180 || br.x === -180) {

                boxSpanIDL = true;
            } else if (Math.abs(br.x - tl.x) > 180) {
                boxSpanIDL = true;
            }


            //            if (coordsRight - coordsLeft > 180)
            //            {
            //                let temp: number = coordsLeft;
            //                coordsLeft = coordsRight;
            //                coordsRight = temp;
            //                coordSpanIDL=true;
            //            }
            //boolean intersects=false;
            if (coordSpanIDL && boxSpanIDL) {
                intersects = true;
            } else if (!coordSpanIDL && !boxSpanIDL)   //was && canclipPoints
            {
                if (coordsLeft <= tl.x && tl.x <= coordsRight) {
                    intersects = true;
                }

                if (coordsLeft <= br.x && br.x <= coordsRight) {
                    intersects = true;
                }

                if (tl.x <= coordsLeft && coordsLeft <= br.x) {
                    intersects = true;
                }

                if (tl.x <= coordsRight && coordsRight <= br.x) {
                    intersects = true;
                }
            } else if (!coordSpanIDL && boxSpanIDL)    //box spans IDL and coords do not
            {
                if (tl.x < coordsRight && coordsRight < 180) {
                    intersects = true;
                }

                if (-180 < coordsLeft && coordsLeft < br.x) {
                    intersects = true;
                }

            } else if (coordSpanIDL && !boxSpanIDL)    //coords span IDL and box does not
            {
                if (coordsLeft < br.x && br.x < 180) {
                    intersects = true;
                }

                if (-180 < tl.x && tl.x < coordsRight) {
                    intersects = true;
                }
            }

            return intersects;
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException("MultipointRenderer", "intersectsClipArea",
                    exc);
            } else {
                throw exc;
            }
        }
        return result;
    }

    /**
     * Adds Feint, decoy, or dummy indicator to shapes. Does not check if tactical graphic should have indicator
     */
    private static addFDI(tg: TacticalGraphic, shapes: Array<Shape2>): void {
        try {
            let msi: MSInfo = msLookup.getMSLInfo(tg.symbolId);
            let drawRule: number = msi != null ? msi.getDrawRule() : -1;
            let lineType: number = tg.lineType;

            if (lineType === TacticalLines.MAIN) {
                // Only Axis of Advance with arrowhead in a different location
                let points: Array<POINT2> = shapes[1].getPoints();
                let ptA: POINT2 = new POINT2(points[points.length - 3]);
                let ptB: POINT2 = new POINT2(points[points.length - 8]);
                let ptC: POINT2 = new POINT2(points[points.length - 7]);
                shapes.push(DISMSupport.getFDIShape(tg, ptA, ptB, ptC));
            } else if (drawRule === DrawRules.AXIS1 || drawRule === DrawRules.AXIS2) {
                // Axis of Advance symbols
                let points: Array<POINT2> = shapes[0].getPoints();
                let midPointIndex = Math.trunc(points.length / 2);
                let ptA: POINT2 = new POINT2(points[midPointIndex - 1]);
                let ptB: POINT2 = new POINT2(points[midPointIndex]);
                let ptC: POINT2 = new POINT2(points[midPointIndex + 1]);
                shapes.push(DISMSupport.getFDIShape(tg, ptA, ptB, ptC));
            }
            // Direction of attack symbols
            else if (lineType === TacticalLines.DIRATKAIR) {
                let points: Array<POINT2> = shapes[2].getPoints();
                let ptA: POINT2 = new POINT2(points[0]);
                let ptB: POINT2 = new POINT2(points[1]);
                let ptC: POINT2 = new POINT2(points[2]);
                shapes.push(DISMSupport.getFDIShape(tg, ptA, ptB, ptC));
            } else if (lineType === TacticalLines.DIRATKGND) {
                let points: Array<POINT2> = shapes[1].getPoints();
                let ptA: POINT2 = new POINT2(points[7]);
                let ptB: POINT2 = new POINT2(points[4]);
                let ptC: POINT2 = new POINT2(points[9]);
                shapes.push(DISMSupport.getFDIShape(tg, ptA, ptB, ptC));
            } else if (lineType === TacticalLines.DIRATKSPT || lineType == TacticalLines.INFILTRATION) {
                let points: Array<POINT2> = shapes[1].getPoints();
                let ptA: POINT2 = new POINT2(points[0]);
                let ptB: POINT2 = new POINT2(points[1]);
                let ptC: POINT2 = new POINT2(points[2]);
                shapes.push(DISMSupport.getFDIShape(tg, ptA, ptB, ptC));
            }
            else if (lineType == TacticalLines.EXPLOIT) {
                let points: Array<POINT2> = shapes[1].getPoints();
                let ptA = new POINT2(points[0]);
                let ptB = new POINT2(points[1]);
                let ptC = new POINT2(points[2]);
                shapes.push(DISMSupport.getFDIShape(tg, ptA, ptB, ptC));
            }
            else {
                // Shape has no arrow. Put on top of shape
                let firstPoint: POINT2 = shapes[0].getPoints()[0];
                let ptUl: POINT2 = new POINT2(firstPoint);
                let ptUr: POINT2 = new POINT2(firstPoint);
                let ptLr: POINT2 = new POINT2(firstPoint);
                let ptLl: POINT2 = new POINT2(firstPoint);
                MultipointUtils.GetMBR(shapes, ptUl, ptUr, ptLr, ptLl);
                shapes.push(DISMSupport.getFDIShape(tg, ptUl, ptUr));
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(MultipointRenderer._className, "addFDI", exc);
            } else {
                throw exc;
            }
        }
    }

    /**
     * GoogleEarth renderer uses polylines for rendering
     *
     * @param mss MilStdSymbol object
     * @param converter the geographic to pixels coordinate converter
     * @param clipArea the clip bounds
     */
    public static renderWithPolylines(mss: MilStdSymbol,
        converter: IPointConversion,
        clipArea: Point2D[] | Rectangle | Rectangle2D): void;

    /**
     * @param mss
     * @param converter
     * @param clipArea
     * @param g2d
     * @deprecated Graphics2D not used
     */
    public static renderWithPolylines(mss: MilStdSymbol,
        converter: IPointConversion,
        clipArea: Point2D[] | Rectangle | Rectangle2D,
        g2d: Graphics2D): void;
    public static renderWithPolylines(...args: unknown[]): void {
        switch (args.length) {
            case 3: {
                const [mss, converter, clipArea] = args as [MilStdSymbol, IPointConversion, Point2D[] | Rectangle | Rectangle2D];


                try {
                    let tg: TacticalGraphic = MultipointRenderer.createTacticalGraphicFromMilStdSymbol(mss, converter);
                    let shapeInfos: Array<ShapeInfo> = new Array();
                    let modifierShapeInfos: Array<ShapeInfo> = new Array();
                    if (MultipointRenderer.intersectsClipArea(tg, converter, clipArea)) {
                        MultipointRenderer.render_GE(tg, shapeInfos, modifierShapeInfos, converter, clipArea);
                    }
                    mss.setSymbolShapes(shapeInfos);
                    mss.setModifierShapes(modifierShapeInfos);
                    mss.setWasClipped(tg.wasClipped);
                } catch (exc) {
                    if (exc instanceof Error) {
                        ErrorLogger.LogException("MultipointRenderer", "renderWithPolylines",
                            exc);
                    } else {
                        throw exc;
                    }
                }


                break;
            }

            case 4: {
                const [mss, converter, clipArea, g2d] = args as [MilStdSymbol, IPointConversion, Point2D[] | Rectangle | Rectangle2D, Graphics2D];


                try {
                    let tg: TacticalGraphic = MultipointRenderer.createTacticalGraphicFromMilStdSymbol(mss, converter);
                    let shapeInfos: Array<ShapeInfo> = new Array();
                    let modifierShapeInfos: Array<ShapeInfo> = new Array();
                    if (MultipointRenderer.intersectsClipArea(tg, converter, clipArea)) {
                        MultipointRenderer.render_GE(tg, shapeInfos, modifierShapeInfos, converter, clipArea, g2d);
                    }
                    mss.setSymbolShapes(shapeInfos);
                    mss.setModifierShapes(modifierShapeInfos);
                } catch (exc) {
                    if (exc instanceof Error) {
                        ErrorLogger.LogException("MultipointRenderer", "renderWithPolylines",
                            exc);
                    } else {
                        throw exc;
                    }
                }


                break;
            }

            default: {
                throw Error(`Invalid number of arguments`);
            }
        }
    }


    /**
     * Google Earth renderer: Called by mapfragment-demo This is the public
     * interface for Google Earth renderer assumes tg.Pixels is filled assumes
     * the caller instantiated the ShapeInfo arrays
     *
     * @param tg tactical graphic
     * @param shapeInfos symbol ShapeInfo array
     * @param modifierShapeInfos modifier ShapeInfo array
     * @param converter geographic to pixels coordinate converter
     * @param clipArea clipping bounds in pixels
     */
    public static render_GE(tg: TacticalGraphic,
        shapeInfos: Array<ShapeInfo>,
        modifierShapeInfos: Array<ShapeInfo>,
        converter: IPointConversion,
        clipArea: Point2D[] | Rectangle | Rectangle2D): void;

    /**
     * See render_GE below for comments
     *
     * @param tg
     * @param shapeInfos
     * @param modifierShapeInfos
     * @param converter
     * @param clipArea
     * @param g2d test android-gradle
     * @deprecated Graphics2D not used
     */
    public static render_GE(tg: TacticalGraphic,
        shapeInfos: Array<ShapeInfo>,
        modifierShapeInfos: Array<ShapeInfo>,
        converter: IPointConversion,
        clipArea: Point2D[] | Rectangle | Rectangle2D,
        g2d: Graphics2D): void;
    public static render_GE(...args: unknown[]): void {
        switch (args.length) {
            case 5: {
                const [tg, shapeInfos, modifierShapeInfos, converter, clipArea] = args as [TacticalGraphic, Array<ShapeInfo>, Array<ShapeInfo>, IPointConversion, Point2D[] | Rectangle2D];


                try {
                    MultipointRenderer.reversePointsRevD(tg);

                    let clipBounds: Rectangle2D = null;
                    CELineArray.setClient("ge");
                    //            ArrayList<POINT2> origPixels = null;
                    //            ArrayList<POINT2> origLatLongs = null;
                    //            if (GEUtils.segmentColorsSet(tg)) {
                    //                origPixels=LineUtility.getDeepCopy(tg.Pixels);
                    //                origLatLongs=LineUtility.getDeepCopy(tg.LatLongs);
                    //            }
                    let origFillPixels: Array<POINT2> = LineUtility.getDeepCopy(tg.Pixels);

                    if (tg.lineType === TacticalLines.LC) {

                        clsUtilityJTR.SegmentLCPoints(tg, converter);
                    }


                    //            boolean shiftLines = Channels.getShiftLines();
                    //            if (shiftLines) {
                    //                let affiliation: string = tg.get_Affiliation();
                    //                Channels.setAffiliation(affiliation);
                    //            }
                    //CELineArray.setMinLength(2.5);    //2-27-2013
                    let clipPoints: Array<Point2D> = null;
                    if (clipArea != null) {
                        if (clipArea instanceof Rectangle2D) {
                            clipBounds = clipArea as Rectangle2D;
                        } else if (clipArea instanceof Rectangle) {
                            let rectx: Rectangle = clipArea as Rectangle;
                            clipBounds = new Rectangle2D(rectx.x, rectx.y, rectx.width, rectx.height);
                        } else if (clipArea instanceof Array) {
                            clipPoints = clipArea as Array<Point2D>;
                        }
                    }
                    let zoomFactor: number = GEUtils.getZoomFactor(clipBounds, clipPoints, tg.Pixels);
                    //add sub-section to test clipArea if client passes the rectangle
                    /*
                    let useClipPoints: boolean = false;    //currently not used
                    if (useClipPoints === true && clipBounds != null) {
                        let x: number = clipBounds.getMinX();
                        let y: number = clipBounds.getMinY();
                        let width: number = clipBounds.getWidth();
                        let height: number = clipBounds.getHeight();
                        clipPoints = new Array();
                        clipPoints.push(new Point2D(x, y));
                        clipPoints.push(new Point2D(x + width, y));
                        clipPoints.push(new Point2D(x + width, y + height));
                        clipPoints.push(new Point2D(x, y + height));
                        clipPoints.push(new Point2D(x, y));
                        clipBounds = null;
                    }
                    //end section
                    */
                    if (tg.client == null || tg.client.length === 0) {
                        tg.client = "ge";
                    }

                    MultipointUtils.RemoveDuplicatePoints(tg);

                    let linetype: number = tg.lineType;
                    if (linetype < 0) {
                        linetype = clsUtilityJTR.GetLinetypeFromString(tg.symbolId);
                        //CPOFUtils.SegmentGeoPoints(tg, converter);
                        tg.lineType = linetype;
                    }

                    let isTextFlipped: boolean = false;
                    let shapes: Array<Shape2>;   //use this to collect all the shapes
                    GEUtils.setSplineLinetype(tg);

                    CPOFUtils.SegmentGeoPoints(tg, converter, zoomFactor);
                    if (clipBounds != null || clipPoints != null) {
                        if (CPOFUtils.canClipPoints(tg)) {
                            //check assignment
                            if (clipBounds != null) {
                                ClipPolygon.ClipPolygon(tg, clipBounds);
                            } else {
                                if (clipPoints != null) {
                                    ClipQuad.ClipPolygon(tg, clipPoints);
                                }
                            }

                            GEUtils.removeTrailingPoints(tg, clipArea);
                            tg.LatLongs = MultipointUtils.PixelsToLatLong(tg.Pixels, converter);
                        }
                    }

                    //if MSR segment data set use original pixels unless tg.Pixels is empty from clipping
                    //            if (origPixels != null) {
                    //                if (tg.Pixels.length === 0) {
                    //                    return;
                    //                } else {
                    //                    tg.Pixels = origPixels;
                    //                    tg.LatLongs = origLatLongs;
                    //                    clipArea = null;
                    //                }
                    //            }
                    clsUtilityJTR.InterpolatePixels(tg);

                    tg.modifiers = new Array();
                    let g2d: Graphics2D = new Graphics2D();
                    g2d.setFont(tg.font);
                    Modifier2.AddModifiersGeo(tg, g2d, clipArea, converter);

                    CPOFUtils.FilterPoints2(tg, converter);
                    clsUtilityJTR.FilterVerticalSegments(tg);
                    MultipointUtils.FilterAXADPoints(tg, converter);
                    CPOFUtils.ClearPixelsStyle(tg);

                    let linesWithFillShapes: Array<Shape2> = null;

                    let savePixels: Array<POINT2> = tg.Pixels;
                    tg.Pixels = origFillPixels;

                    //check assignment
                    if (clipBounds != null) {
                        linesWithFillShapes = ClipPolygon.LinesWithFill(tg, clipBounds);
                    } else if (clipPoints != null) {
                        linesWithFillShapes = ClipQuad.LinesWithFill(tg, clipPoints);
                    } else if (clipArea == null) {
                        linesWithFillShapes = ClipPolygon.LinesWithFill(tg, null);
                    }

                    tg.Pixels = savePixels;

                    let rangeFanFillShapes: Array<Shape2>;
                    //do not fill the original shapes for circular range fans
                    let savefillStyle: number = tg.fillStyle;
                    if (linetype === TacticalLines.RANGE_FAN) {
                        tg.fillStyle = 0;
                    }

                    //check assignment (pass which clip object is not null)
                    if (clipBounds != null) {
                        shapes = MultipointRenderer2.GetLineArray(tg, converter, isTextFlipped, clipBounds); //takes clip object           
                    } else if (clipPoints != null) {
                        shapes = MultipointRenderer2.GetLineArray(tg, converter, isTextFlipped, clipPoints);
                    } else if (clipArea == null) {
                        shapes = MultipointRenderer2.GetLineArray(tg, converter, isTextFlipped, null);
                    }

                    // Add Feint, decoy, or dummy indicator
                    if (shapes != null
                        && SymbolID.getSymbolSet(tg.symbolId) === SymbolID.SymbolSet_ControlMeasure
                        && SymbolUtilities.hasFDI(tg.symbolId)) {
                        MultipointRenderer.addFDI(tg, shapes);
                    }

                    switch (linetype) {
                        case TacticalLines.RANGE_FAN:
                        case TacticalLines.RANGE_FAN_SECTOR:
                        case TacticalLines.RADAR_SEARCH: {
                            if (tg.fillColor == null || tg.fillColor.getAlpha() < 2) {
                                break;
                            }
                            let tg1: TacticalGraphic = CPOFUtils.GetCircularRangeFanFillTG(tg);
                            tg1.fillStyle = savefillStyle;
                            tg1.symbolId = tg.symbolId;
                            //check assignment (pass which clip object is not null)
                            if (clipBounds != null) {
                                rangeFanFillShapes = MultipointRenderer2.GetLineArray(tg1, converter, isTextFlipped, clipBounds);
                            } else {
                                if (clipPoints != null) {
                                    rangeFanFillShapes = MultipointRenderer2.GetLineArray(tg1, converter, isTextFlipped, clipPoints);
                                } else {
                                    if (clipArea == null) {
                                        rangeFanFillShapes = MultipointRenderer2.GetLineArray(tg1, converter, isTextFlipped, null);
                                    }
                                }

                            }


                            if (rangeFanFillShapes != null) {
                                if (shapes == null) {
                                    console.log("shapes is null");
                                    break;
                                } else {
                                    shapes.splice(0, 0, ...rangeFanFillShapes);
                                }

                            }
                            break;
                        }

                        default: {
                            MultipointRenderer2.getAutoshapeFillShape(tg, shapes);
                            break;
                        }

                    }
                    //end section

                    //undo any fillcolor for lines with fill
                    CPOFUtils.LinesWithSeparateFill(tg.lineType, shapes);
                    ClipPolygon.addAbatisFill(tg, shapes);

                    //if this line is commented then the extra line in testbed goes away
                    if (shapes != null && linesWithFillShapes != null && linesWithFillShapes.length > 0) {
                        shapes.splice(0, 0, ...linesWithFillShapes);
                    }

                    if (CPOFUtils.canClipPoints(tg) === false && clipBounds != null) {
                        shapes = CPOFUtils.postClipShapes(tg, shapes, clipBounds);
                    } else {
                        if (CPOFUtils.canClipPoints(tg) === false && clipPoints != null) {
                            shapes = CPOFUtils.postClipShapes(tg, shapes, clipPoints);
                        }
                    }
                    MultipointRenderer.resolvePostClippedShapes(tg,shapes);

                    //returns early if textSpecs are null
                    //currently the client is ignoring these
                    if (modifierShapeInfos != null) {
                        let textSpecs: Array<Shape2> = new Array();
                        Modifier2.DisplayModifiers2(tg, g2d, textSpecs, isTextFlipped, converter);
                        MultipointRenderer.Shape2ToShapeInfo(modifierShapeInfos, textSpecs);
                    }
                    MultipointRenderer.Shape2ToShapeInfo(shapeInfos, shapes);
                    MultipointUtils.addHatchFills(tg, shapeInfos);

                    //check assignment (pass which clip object is not null)
                    if (clipBounds != null) {
                        GEUtils.SetShapeInfosPolylines(tg, shapeInfos, clipBounds);//takes a clip object            
                    } else {
                        if (clipPoints != null) {
                            GEUtils.SetShapeInfosPolylines(tg, shapeInfos, clipPoints);
                        } else {
                            if (clipArea == null) {
                                GEUtils.SetShapeInfosPolylines(tg, shapeInfos, null);
                            }
                        }

                    }

                } catch (exc) {
                    if (exc instanceof Error) {
                        ErrorLogger.LogException(MultipointRenderer._className, "render_GE",
                            exc);

                    } else {
                        throw exc;
                    }
                }


                break;
            }

            case 6: {
                const [tg, shapeInfos, modifierShapeInfos, converter, clipArea, g2d] = args as [TacticalGraphic, Array<ShapeInfo>, Array<ShapeInfo>, IPointConversion, Point2D[] | Rectangle | Rectangle2D, Graphics2D];

                MultipointRenderer.render_GE(tg, shapeInfos, modifierShapeInfos, converter, clipArea);


                break;

            }
            default: {
                throw Error(`Invalid number of arguments`);
            }
        }
    }

    /**
     * creates a shape for known symbols. The intent is to use client points for
     * the shape and is intended for use with ellipse. If hatch &gt; 1 it creates 2 shapes
     * one for the hatch pattern, the second one is for the outline.
     *
     * @param milStd
     * @param ipc
     * @param clipArea
     * @param shapeType
     * @param lineColor
     * @param fillColor
     * @param hatch
     */
    public static render_Shape(milStd: MilStdSymbol,
        ipc: IPointConversion,
        clipArea: Point2D[] | Rectangle | Rectangle2D = null,
        shapeType: number,
        lineColor: Color = null,
        fillColor: Color = null,
        hatch: number): void {
        try {
            let clipBounds: Rectangle2D = null;
            //CELineArray.setClient("ge");
            let clipPoints: Array<Point2D> = null;

            if (clipArea != null) {
                if (clipArea instanceof Rectangle2D) {
                    clipBounds = clipArea as Rectangle2D;
                } else if (clipArea instanceof Rectangle) {
                    clipBounds = new Rectangle2D(clipArea.x, clipArea.y, clipArea.width, clipArea.height); // clipArea as Rectangle2D;
                } else if (clipArea instanceof Array) {
                    clipPoints = clipArea as Array<Point2D>;
                }

            }

            //can't use following line because it resets the pixels
            //TacticalGraphic tg = createTacticalGraphicFromMilStdSymbol(milStd, ipc);
            let tg: TacticalGraphic = new TacticalGraphic();
            tg.symbolId = milStd.getSymbolID();
            //tg.visibleModifiers = true;
            //set tg latlongs and pixels
            MultipointRenderer.setClientCoords(milStd, tg);
            //build tg.Pixels
            tg.Pixels = MultipointUtils.LatLongToPixels(tg.LatLongs, ipc);

            //int fillStyle = milStd.getPatternFillType();
            let shape: Shape2 = new Shape2(shapeType);
            shape.setFillColor(fillColor);
            if (lineColor != null) {
                shape.setLineColor(lineColor);
                shape.setStroke(new BasicStroke(milStd.getLineWidth()));
            }
            //the client has already set the coordinates for the shape
            let pt: POINT2;
            for (let j: number = 0; j < tg.Pixels.length; j++) {
                pt = tg.Pixels[j];
                if (j === 0) {
                    shape.moveTo(pt);
                } else {
                    shape.lineTo(pt);
                }
            }

            //post clip the shape and set the polylines
            let shapes: Array<Shape2> = new Array();
            shapes.push(shape);
            //post-clip the shape
            if (CPOFUtils.canClipPoints(tg) === false && clipBounds != null) {
                shapes = CPOFUtils.postClipShapes(tg, shapes, clipBounds);
            } else {
                if (CPOFUtils.canClipPoints(tg) === false && clipPoints != null) {
                    shapes = CPOFUtils.postClipShapes(tg, shapes, clipPoints);
                }
            }

            shape = shapes[0];
            if (hatch > 1) {
                shape = MultipointUtils.buildHatchArea(tg, shape, hatch, 20);
                shape.setLineColor(lineColor);
                shape.setStroke(new BasicStroke(1));
                //shapes.clear();
                shapes.push(shape);
            }
            let shapeInfos: Array<ShapeInfo> = new Array();
            MultipointRenderer.Shape2ToShapeInfo(shapeInfos, shapes);
            //set the shapeInfo polylines
            if (clipBounds != null) {
                GEUtils.SetShapeInfosPolylines(tg, shapeInfos, clipBounds);
            } else {
                if (clipPoints != null) {
                    GEUtils.SetShapeInfosPolylines(tg, shapeInfos, clipPoints);
                } else {
                    if (clipArea == null) {
                        GEUtils.SetShapeInfosPolylines(tg, shapeInfos, null);
                    }
                }

            }

            //set milStd symbol shapes
            if (milStd.getSymbolShapes() == null) {
                milStd.setSymbolShapes(shapeInfos);
            } else {
                milStd.getSymbolShapes().push(...shapeInfos);
            }
            return;
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(MultipointRenderer._className, "render_Shape",
                    exc);

            } else {
                throw exc;
            }
        }
    }

    private static resolvePostClippedShapes(tg: TacticalGraphic, shapes: Array<Shape2>): void {
        try {
            //resolve the PBS and BBS shape properties after the post clip, regardless whether they were clipped
            switch (tg.lineType) {
                case TacticalLines.BBS_RECTANGLE:
                case TacticalLines.BBS_POINT:
                case TacticalLines.BBS_LINE:
                case TacticalLines.BBS_AREA:
                case TacticalLines.PBS_RECTANGLE:
                case TacticalLines.PBS_SQUARE:
                    break;
                default:
                    return;
            }
            let fillColor: Color = tg.fillColor;
            shapes[0].setFillColor(fillColor);
            shapes[1].setFillColor(null);
            let fillStyle: number = tg.fillStyle;
            shapes[0].setFillStyle(0);
            shapes[1].setFillStyle(fillStyle);
            return;

        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(MultipointRenderer._className, "resolvePostClippedShapes",
                    exc);
            } else {
                throw exc;
            }
        }
    }

    /**
     * set the clip rectangle as an arraylist or a Rectangle2D depending on the
     * object
     *
     * @param clipBounds
     * @param clipRect
     * @param clipArray
     * @return
     */
    private static setClip(clipBounds: Rectangle2D | Rectangle | Array<Point2D> | null, clipRect: Rectangle2D, clipArray: Array<Point2D>): boolean {
        try {
            if (clipBounds == null) {
                return false;
            } else if (clipBounds instanceof Rectangle2D) {
                clipRect.setRect(clipBounds as Rectangle2D);
            } else if (clipBounds instanceof Rectangle) {
                //clipRect.setRect((Rectangle2D)clipBounds);
                let rectx: Rectangle = clipBounds as Rectangle;
                //clipBounds=new Rectangle2D(rectx.x,rectx.y,rectx.width,rectx.height);
                clipRect.setRect(rectx.x, rectx.y, rectx.width, rectx.height);
            } else if (clipBounds instanceof Array) {
                clipArray.push(...clipBounds);
            }

        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(MultipointRenderer._className, "setClip",
                    exc);

            } else {
                throw exc;
            }
        }
        return true;
    }

    /**
     * public render function transferred from JavaLineArrayCPOF project. Use
     * this function to replicate CPOF renderer functionality.
     *
     * @param mss the milStdSymbol object
     * @param converter the geographic to pixels coordinate converter
     * @param clipBounds the pixels based clip bounds
     */
    public static render(mss: MilStdSymbol,
        converter: IPointConversion,
        clipBounds: Rectangle2D | Array<Point2D> | null): void;

    /**
     * Generic tester button says Tiger or use JavaRendererSample. Generic
     * renderer testers: called by JavaRendererSample and TestJavaLineArray
     * public render function transferred from JavaLineArrayCPOF project. Use
     * this function to replicate CPOF renderer functionality.
     *
     * @param mss MilStdSymbol
     * @param converter geographic to pixels converter
     * @param shapeInfos ShapeInfo array
     * @param modifierShapeInfos modifier ShapeInfo array
     * @param clipBounds clip bounds
     */
    public static render(mss: MilStdSymbol,
        converter: IPointConversion,
        shapeInfos: Array<ShapeInfo>,
        modifierShapeInfos: Array<ShapeInfo>,
        clipBounds: Rectangle2D | Rectangle | Array<Point2D> | null): void;
    public static render(...args: unknown[]): void {
        switch (args.length) {
            case 3: {
                const [mss, converter, clipBounds] = args as [MilStdSymbol, IPointConversion, Rectangle2D | Rectangle | Array<Point2D> | null];


                try {
                    let shapeInfos: Array<ShapeInfo> = new Array();
                    let modifierShapeInfos: Array<ShapeInfo> = new Array();
                    MultipointRenderer.render(mss, converter, shapeInfos, modifierShapeInfos, clipBounds);
                } catch (exc) {
                    if (exc instanceof Error) {
                        ErrorLogger.LogException(MultipointRenderer._className, "render",
                            exc);

                    } else {
                        throw exc;
                    }
                }


                break;
            }

            case 5: {
                const [mss, converter, shapeInfos, modifierShapeInfos, clipBounds] = args as [MilStdSymbol, IPointConversion, Array<ShapeInfo>, Array<ShapeInfo>, Rectangle2D | Array<Point2D> | null];


                try {
                    //boolean shiftLines = Channels.getShiftLines();
                    //end section

                    let clipRect: Rectangle2D = new Rectangle2D();
                    let clipArray: Array<Point2D> = new Array();
                    MultipointRenderer.setClip(clipBounds, clipRect, clipArray);

                    let tg: TacticalGraphic = MultipointRenderer.createTacticalGraphicFromMilStdSymbol(mss, converter);
                    MultipointRenderer.reversePointsRevD(tg);
                    CELineArray.setClient("generic");
                    //            if (shiftLines) {
                    //                let affiliation: string = tg.get_Affiliation();
                    //                Channels.setAffiliation(affiliation);
                    //            }
                    //CELineArray.setMinLength(2.5);    //2-27-2013

                    let linetype: number = tg.lineType;
                    //replace calls to MovePixels
                    MultipointUtils.RemoveDuplicatePoints(tg);

                    let g2d: Graphics2D = new Graphics2D();
                    g2d.setFont(tg.font);
                    CPOFUtils.SegmentGeoPoints(tg, converter, 1);
                    MultipointUtils.FilterAXADPoints(tg, converter);

                    //prevent vertical segments for oneway, twoway, alt
                    clsUtilityJTR.FilterVerticalSegments(tg);
                    let isChange1Area: boolean = clsUtilityJTR.IsChange1Area(linetype);
                    let isTextFlipped: boolean = false;
                    //for 3d change 1 symbols we do not transform the points

                    //if it is world view then we want to flip the far points about
                    //the left and right sides to get two symbols
                    let farLeftPixels: Array<POINT2> = new Array();
                    let farRightPixels: Array<POINT2> = new Array();
                    if (isChange1Area === false) {
                        CPOFUtils.GetFarPixels(tg, converter, farLeftPixels, farRightPixels);
                    }

                    let shapesLeft: Array<Shape2> = new Array();
                    let shapesRight: Array<Shape2> = new Array();
                    let shapes: Array<Shape2>;   //use this to collect all the shapes

                    //CPOF 6.0 diagnostic
                    let textSpecsLeft: Array<Shape2>;
                    let textSpecsRight: Array<Shape2>;
                    //Note: DisplayModifiers3 returns early if textSpecs are null
                    textSpecsLeft = new Array();
                    textSpecsRight = new Array();

                    if (farLeftPixels.length > 0) {
                        tg.Pixels = farLeftPixels;
                        shapesLeft = MultipointRenderer2.GetLineArray(tg, converter, isTextFlipped, clipBounds);
                        //CPOF 6.0
                        //returns early if textSpecs are null
                        Modifier2.DisplayModifiers2(tg, g2d, textSpecsLeft, isTextFlipped, null);
                    }
                    if (farRightPixels.length > 0) {
                        tg.Pixels = farRightPixels;
                        shapesRight = MultipointRenderer2.GetLineArray(tg, converter, isTextFlipped, clipBounds);
                        //CPOF 6.0
                        //returns early if textSpecs are null
                        Modifier2.DisplayModifiers2(tg, g2d, textSpecsRight, isTextFlipped, null);
                    }

                    //CPOF 6.0 diagnostic
                    let textSpecs: Array<Shape2> = new Array();

                    if (shapesLeft.length === 0 || shapesRight.length === 0) {
                        let linesWithFillShapes: Array<Shape2> = null;
                        if (clipArray != null && clipArray.length > 0) {
                            linesWithFillShapes = ClipQuad.LinesWithFill(tg, clipArray);
                        } else {
                            if (clipRect != null && clipRect.getWidth() !== 0) {
                                linesWithFillShapes = ClipPolygon.LinesWithFill(tg, clipRect);
                            } else {
                                linesWithFillShapes = ClipPolygon.LinesWithFill(tg, null);
                            }
                        }


                        //diagnostic: comment two lines if using the WW tester
                        if (CPOFUtils.canClipPoints(tg) && clipBounds != null) {
                            if (clipArray != null && clipArray.length > 0) {
                                ClipQuad.ClipPolygon(tg, clipArray);
                            } else {
                                if (clipRect != null && clipRect.getWidth() !== 0) {
                                    ClipPolygon.ClipPolygon(tg, clipRect);
                                }
                            }


                            tg.LatLongs = MultipointUtils.PixelsToLatLong(tg.Pixels, converter);
                        }

                        //diagnostic 1-28-13
                        clsUtilityJTR.InterpolatePixels(tg);

                        tg.modifiers = new Array();
                        Modifier2.AddModifiersGeo(tg, g2d, clipBounds, converter);

                        CPOFUtils.FilterPoints2(tg, converter);
                        CPOFUtils.ClearPixelsStyle(tg);
                        //add section to replace preceding line M. Deutch 11-4-2011
                        let rangeFanFillShapes: Array<Shape2> | null;
                        //do not fill the original shapes for circular range fans
                        let savefillStyle: number = tg.fillStyle;
                        if (linetype === TacticalLines.RANGE_FAN) {
                            tg.fillStyle = 0;
                        }

                        shapes = MultipointRenderer2.GetLineArray(tg, converter, isTextFlipped, clipBounds);

                        // Add Feint, decoy, or dummy indicator
                        if (shapes != null
                            && SymbolID.getSymbolSet(tg.symbolId) === SymbolID.SymbolSet_ControlMeasure
                            && SymbolUtilities.hasFDI(tg.symbolId)) {
                            MultipointRenderer.addFDI(tg, shapes);
                        }

                        switch (linetype) {
                            case TacticalLines.RANGE_FAN:
                            case TacticalLines.RANGE_FAN_SECTOR:
                            case TacticalLines.RADAR_SEARCH: {
                                if (tg.fillColor == null || tg.fillColor.getAlpha() < 2) {
                                    break;
                                }
                                let tg1: TacticalGraphic = CPOFUtils.GetCircularRangeFanFillTG(tg);
                                tg1.fillStyle = savefillStyle;
                                tg1.symbolId = tg.symbolId;
                                rangeFanFillShapes = MultipointRenderer2.GetLineArray(tg1, converter, isTextFlipped, clipBounds);

                                if (rangeFanFillShapes != null) {
                                    shapes.splice(0, 0, ...rangeFanFillShapes);
                                }
                                break;
                            }

                            default: {
                                break;
                            }

                        }

                        //undo any fillcolor for lines with fill
                        CPOFUtils.LinesWithSeparateFill(tg.lineType, shapes);
                        ClipPolygon.addAbatisFill(tg, shapes);

                        //if this line is commented then the extra line in testbed goes away
                        if (shapes != null && linesWithFillShapes != null && linesWithFillShapes.length > 0) {
                            shapes.splice(0, 0, ...linesWithFillShapes);
                        }

                        if (shapes != null && shapes.length > 0) {
                            Modifier2.DisplayModifiers2(tg, g2d, textSpecs, isTextFlipped, null);
                            MultipointRenderer.Shape2ToShapeInfo(modifierShapeInfos, textSpecs);
                            mss.setModifierShapes(modifierShapeInfos);
                        }
                    } else //symbol was more than 180 degrees wide, use left and right symbols
                    {
                        shapes = shapesLeft;
                        shapes.push(...shapesRight);

                        if (textSpecs != null) {
                            textSpecs.push(...textSpecsLeft);
                            textSpecs.push(...textSpecsRight);
                        }
                    }
                    //post-clip the points if the tg could not be pre-clipped
                    if (CPOFUtils.canClipPoints(tg) === false && clipBounds != null) {
                        shapes = CPOFUtils.postClipShapes(tg, shapes, clipBounds);
                    }

                    MultipointRenderer.Shape2ToShapeInfo(shapeInfos, shapes);
                    MultipointUtils.addHatchFills(tg, shapeInfos);
                    mss.setSymbolShapes(shapeInfos);
                } catch (exc) {
                    if (exc instanceof Error) {
                        ErrorLogger.LogException(MultipointRenderer._className, "render",
                            exc);

                    } else {
                        throw exc;
                    }
                }


                break;
            }

            default: {
                throw Error(`Invalid number of arguments`);
            }
        }
    }


    public static getCMLineType(version: number, entityCode: number): number {
        // Check if line type is specific to a version
        if (version >= SymbolID.Version_2525Ech1) {
            switch (entityCode) {
                // Added in 2525Ech1
                case 152600:
                    return TacticalLines.AREA_DEFENSE;
                case 152700:
                    return TacticalLines.FRONTAL_ATTACK;
                case 152900:
                    return TacticalLines.TURNING_MOVEMENT;
                case 152800:
                    return TacticalLines.MOBILE_DEFENSE;
                case 242800:
                    return TacticalLines.KILL_ZONE;
                case 342900:
                    return TacticalLines.MOVEMENT_TO_CONTACT;
                case 343100:
                    return TacticalLines.EXPLOIT;
                case 343300:
                    return TacticalLines.DEMONSTRATE;
                case 343500:
                    return TacticalLines.ENVELOPMENT;
                case 343800:
                    return TacticalLines.INFILTRATION;
                case 344000:
                    return TacticalLines.PURSUIT;
                case 344400:
                    return TacticalLines.DISENGAGE;
                case 344500:
                    return TacticalLines.EVACUATE;
                case 344700:
                    return TacticalLines.TURN;
                // Updated in 2525Ech1
                case 172000:
                    return TacticalLines.WFZ;
                // Removed in 2525Ech1
                case 240804:
                    return -1;
            }
        }
        if (version >= SymbolID.Version_2525E) {
            switch (entityCode) {
                // Added in 2525E
                case 110400: {
                    return TacticalLines.GENERIC_LINE;
                }

                case 120700: {
                    return TacticalLines.GENERIC_AREA;
                }

                case 141800: {
                    return TacticalLines.HOL;
                }

                case 141900: {
                    return TacticalLines.BHL;
                }

                case 310800: {
                    return TacticalLines.CSA;
                }

                case 330500: {
                    return TacticalLines.TRAFFIC_ROUTE;
                }

                case 330501: {
                    return TacticalLines.TRAFFIC_ROUTE_ONEWAY;
                }

                case 330502: {
                    return TacticalLines.TRAFFIC_ROUTE_ALT;
                }

                case 344100: {
                    return TacticalLines.FPOL;
                }

                case 344200: {
                    return TacticalLines.RPOL;
                }

                // Updated in 2525E
                case 120500: {
                    return TacticalLines.BASE_CAMP;
                }

                case 120600: {
                    return TacticalLines.GUERILLA_BASE;
                }

                case 151000: {
                    return TacticalLines.FORT;
                }

                case 260400: {
                    return TacticalLines.BCL;
                }

                case 310100: {
                    return TacticalLines.DHA;
                }

                // Updated in 2525Ech1
                case 172000: {
                    return TacticalLines.WFZ_REVD;
                }

                default:

            }
        } else { // 2525Dchange 1 and older
            switch (entityCode) {
                // Updated in 2525E
                case 120500: {
                    return TacticalLines.BASE_CAMP_REVD;
                }

                case 120600: {
                    return TacticalLines.GUERILLA_BASE_REVD;
                }

                case 151000: {
                    return TacticalLines.FORT_REVD;
                }

                case 260400: {
                    return TacticalLines.BCL_REVD;
                }

                case 310100: {
                    return TacticalLines.DHA_REVD;
                }

                // Removed in 2525E
                case 150300: {
                    return TacticalLines.ASSY;
                }

                case 241601: {
                    return TacticalLines.SENSOR;
                }

                case 241602: {
                    return TacticalLines.SENSOR_RECTANGULAR;
                }

                case 241603: {
                    return TacticalLines.SENSOR_CIRCULAR;
                }

                // Updated in 2525Ech1
                case 172000: {
                    return TacticalLines.WFZ_REVD;
                }

                default:

            }
        }
        // Line type isn't specific to a version or doesn't exist
        switch (entityCode) {
            case 200101: {
                return TacticalLines.LAUNCH_AREA;
            }

            case 200201: {
                return TacticalLines.DEFENDED_AREA_CIRCULAR;
            }

            case 200202: {
                return TacticalLines.DEFENDED_AREA_RECTANGULAR;
            }

            case 120100: {
                return TacticalLines.AO;
            }

            case 120200: {
                return TacticalLines.NAI;
            }

            case 120300: {
                return TacticalLines.TAI;
            }

            case 120400: {
                return TacticalLines.AIRFIELD;
            }

            case 151401: {
                return TacticalLines.AIRAOA;
            }

            case 151402: {
                return TacticalLines.AAAAA;
            }

            case 151403: {
                return TacticalLines.MAIN;
            }

            case 151404: {
                return TacticalLines.SPT;
            }

            case 110100: {
                return TacticalLines.BOUNDARY;
            }

            case 110200: {
                return TacticalLines.LL;
            }

            case 110300: {
                return TacticalLines.EWL;
            }

            case 140100: {
                return TacticalLines.FLOT;
            }

            case 140200: {
                return TacticalLines.LC;
            }

            case 140300: {
                return TacticalLines.PL;
            }

            case 140400: {
                return TacticalLines.FEBA;
            }

            case 140500: {
                return TacticalLines.PDF;
            }

            case 140601: {
                return TacticalLines.DIRATKAIR;
            }

            case 140602: {
                return TacticalLines.DIRATKGND;
            }

            case 140603: {
                return TacticalLines.DIRATKSPT;
            }

            case 140700: {
                return TacticalLines.FCL;
            }

            case 140800: {
                return TacticalLines.IL;
            }

            case 140900: {
                return TacticalLines.LOA;
            }

            case 141000: {
                return TacticalLines.LOD;
            }

            case 141100: {
                return TacticalLines.LDLC;
            }

            case 141200: {
                return TacticalLines.PLD;
            }

            case 150200: {
                return TacticalLines.ASSY;
            }

            case 150100: {
                return TacticalLines.GENERAL;
            }

            case 150501: {
                return TacticalLines.JTAA;
            }

            case 150502: {
                return TacticalLines.SAA;
            }

            case 150503: {
                return TacticalLines.SGAA;
            }

            case 150600: {    //dz no eny
                return TacticalLines.DZ;
            }

            case 150700: {    //ez no eny
                return TacticalLines.EZ;
            }

            case 150800: {    //lz no eny
                return TacticalLines.LZ;
            }

            case 150900: {    //pz no eny
                return TacticalLines.PZ;
            }

            case 151100: {
                return TacticalLines.LAA;
            }

            case 151200: {
                return TacticalLines.BATTLE;
            }

            case 151202: {
                return TacticalLines.PNO;
            }

            case 151204: {
                return TacticalLines.CONTAIN;
            }

            case 151205: {
                return TacticalLines.RETAIN;
            }

            case 151300: {
                return TacticalLines.EA;
            }

            case 151203: {
                return TacticalLines.STRONG;
            }

            case 151500: {
                return TacticalLines.ASSAULT;
            }

            case 151600: {
                return TacticalLines.ATKPOS;
            }

            case 151700: {
                return TacticalLines.OBJ;
            }

            case 151800: {
                return TacticalLines.ENCIRCLE;
            }

            case 151900: {
                return TacticalLines.PEN;
            }

            case 152000: {
                return TacticalLines.ATKBYFIRE;
            }

            case 152100: {
                return TacticalLines.SPTBYFIRE;
            }

            case 152200: {
                return TacticalLines.SARA;
            }

            case 141300: {
                return TacticalLines.AIRHEAD;
            }

            case 141400: {
                return TacticalLines.BRDGHD;
            }

            case 141500: {
                return TacticalLines.HOLD;
            }

            case 141600: {
                return TacticalLines.RELEASE;
            }

            case 141700: {
                return TacticalLines.AMBUSH;
            }

            case 170100: {
                return TacticalLines.AC;
            }

            case 170200: {
                return TacticalLines.LLTR;
            }

            case 170300: {
                return TacticalLines.MRR;
            }

            case 170400: {
                return TacticalLines.SL;
            }

            case 170500: {
                return TacticalLines.SAAFR;
            }

            case 170600: {
                return TacticalLines.TC;
            }

            case 170700: {
                return TacticalLines.SC;
            }

            case 170800: {
                return TacticalLines.BDZ;
            }

            case 170900: {
                return TacticalLines.HIDACZ;
            }

            case 171000: {
                return TacticalLines.ROZ;
            }

            case 171100: {
                return TacticalLines.AARROZ;
            }

            case 171200: {
                return TacticalLines.UAROZ;
            }

            case 171300: {
                return TacticalLines.WEZ;
            }

            case 171400: {
                return TacticalLines.FEZ;
            }

            case 171500: {
                return TacticalLines.JEZ;
            }

            case 171600: {
                return TacticalLines.MEZ;
            }

            case 171700: {
                return TacticalLines.LOMEZ;
            }

            case 171800: {
                return TacticalLines.HIMEZ;
            }

            case 171900: {
                return TacticalLines.FAADZ;
            }

            case 200401: {
                return TacticalLines.SHIP_AOI_CIRCULAR;
            }

            case 240804: {
                return TacticalLines.RECTANGULAR_TARGET;
            }

            case 220100: {
                return TacticalLines.BEARING;
            }

            case 220101: {
                return TacticalLines.ELECTRO;
            }

            case 220102: {    //EW                //new label
                return TacticalLines.BEARING_EW;
            }

            case 220103: {
                return TacticalLines.ACOUSTIC;
            }

            case 220104: {
                return TacticalLines.ACOUSTIC_AMB;
            }

            case 220105: {
                return TacticalLines.TORPEDO;
            }

            case 220106: {
                return TacticalLines.OPTICAL;
            }

            case 218400: {
                return TacticalLines.NAVIGATION;
            }

            case 220107: {    //Jammer                //new label
                return TacticalLines.BEARING_J;
            }

            case 220108: {    //RDF                   //new label
                return TacticalLines.BEARING_RDF;
            }

            case 240101: {
                return TacticalLines.ACA;
            }

            case 240102: {
                return TacticalLines.ACA_RECTANGULAR;
            }

            case 240103: {
                return TacticalLines.ACA_CIRCULAR;
            }


            case 240201: {
                return TacticalLines.FFA;
            }

            case 240202: {
                return TacticalLines.FFA_RECTANGULAR;
            }

            case 240203: {
                return TacticalLines.FFA_CIRCULAR;
            }


            case 240301: {
                return TacticalLines.NFA;
            }

            case 240302: {
                return TacticalLines.NFA_RECTANGULAR;
            }

            case 240303: {
                return TacticalLines.NFA_CIRCULAR;
            }


            case 240401: {
                return TacticalLines.RFA;
            }

            case 240402: {
                return TacticalLines.RFA_RECTANGULAR;
            }

            case 240403: {
                return TacticalLines.RFA_CIRCULAR;
            }

            case 240503: {
                return TacticalLines.PAA;
            }

            case 240501: {
                return TacticalLines.PAA_RECTANGULAR;
            }

            case 240502: {
                return TacticalLines.PAA_CIRCULAR;
            }

            case 260100: {
                return TacticalLines.FSCL;
            }

            case 300100: {
                return TacticalLines.ICL;
            }

            case 190100: {
                return TacticalLines.IFF_OFF;
            }

            case 190200: {
                return TacticalLines.IFF_ON;
            }

            case 260200: {
                return TacticalLines.CFL;
            }

            case 260300: {
                return TacticalLines.NFL;
            }

            case 260500: {
                return TacticalLines.RFL;
            }

            case 260600: {
                return TacticalLines.MFP;
            }

            case 240701: {
                return TacticalLines.LINTGT;
            }

            case 240702: {
                return TacticalLines.LINTGTS;
            }

            case 240703: {
                return TacticalLines.FPF;
            }

            case 240801: {
                return TacticalLines.AT;
            }

            case 240802: {
                return TacticalLines.RECTANGULAR;
            }

            case 240803: {
                return TacticalLines.CIRCULAR;
            }

            case 240805: {
                return TacticalLines.SERIES;
            }

            case 240806: {
                return TacticalLines.SMOKE;
            }

            case 240808: {
                return TacticalLines.BOMB;
            }

            case 241001: {
                return TacticalLines.FSA;
            }

            case 241002: {
                return TacticalLines.FSA_RECTANGULAR;
            }

            case 200402: {
                return TacticalLines.SHIP_AOI_RECTANGULAR;
            }

            case 200600: {
                return TacticalLines.CUED_ACQUISITION;
            }

            case 200700: {
                return TacticalLines.RADAR_SEARCH;
            }

            case 241003: {
                return TacticalLines.FSA_CIRCULAR;
            }

            case 200300: {
                return TacticalLines.NOTACK;
            }

            case 241101: {
                return TacticalLines.ATI;
            }

            case 241102: {
                return TacticalLines.ATI_RECTANGULAR;
            }

            case 241103: {
                return TacticalLines.ATI_CIRCULAR;
            }

            case 241201: {
                return TacticalLines.CFFZ;
            }

            case 241202: {
                return TacticalLines.CFFZ_RECTANGULAR;
            }

            case 241203: {
                return TacticalLines.CFFZ_CIRCULAR;
            }

            case 241301: {
                return TacticalLines.CENSOR;
            }

            case 241302: {
                return TacticalLines.CENSOR_RECTANGULAR;
            }

            case 241303: {
                return TacticalLines.CENSOR_CIRCULAR;
            }

            case 241401: {
                return TacticalLines.CFZ;
            }

            case 241402: {
                return TacticalLines.CFZ_RECTANGULAR;
            }

            case 241403: {
                return TacticalLines.CFZ_CIRCULAR;
            }

            case 241501: {
                return TacticalLines.DA;
            }

            case 241502: {
                return TacticalLines.DA_RECTANGULAR;
            }

            case 241503: {
                return TacticalLines.DA_CIRCULAR;
            }

            case 241701: {
                return TacticalLines.TBA;
            }

            case 241702: {
                return TacticalLines.TBA_RECTANGULAR;
            }

            case 241703: {
                return TacticalLines.TBA_CIRCULAR;
            }

            case 241801: {
                return TacticalLines.TVAR;
            }

            case 241802: {
                return TacticalLines.TVAR_RECTANGULAR;
            }

            case 241803: {
                return TacticalLines.TVAR_CIRCULAR;
            }

            case 241901: {
                return TacticalLines.ZOR;
            }

            case 241902: {
                return TacticalLines.ZOR_RECTANGULAR;
            }

            case 241903: {
                return TacticalLines.ZOR_CIRCULAR;
            }

            case 242000: {
                return TacticalLines.TGMF;
            }

            case 242100: {
                return TacticalLines.RANGE_FAN;
            }

            case 242200: {
                return TacticalLines.RANGE_FAN_SECTOR;
            }

            case 242301: {
                return TacticalLines.KILLBOXBLUE;
            }

            case 242302: {
                return TacticalLines.KILLBOXBLUE_RECTANGULAR;
            }

            case 242303: {
                return TacticalLines.KILLBOXBLUE_CIRCULAR;
            }

            case 242304: {
                return TacticalLines.KILLBOXPURPLE;
            }

            case 242305: {
                return TacticalLines.KILLBOXPURPLE_RECTANGULAR;
            }

            case 242306: {
                return TacticalLines.KILLBOXPURPLE_CIRCULAR;
            }

            case 270100:
            case 270200: {
                return TacticalLines.ZONE;
            }

            case 270300: {
                return TacticalLines.OBSFAREA;
            }

            case 270400: {
                return TacticalLines.OBSAREA;
            }

            case 270501: {
                return TacticalLines.MNFLDBLK;
            }

            case 270502: {
                return TacticalLines.MNFLDDIS;
            }

            case 270503: {
                return TacticalLines.MNFLDFIX;
            }

            case 270504: {
                return TacticalLines.TURN_REVD;
            }

            case 270601: {
                return TacticalLines.EASY;
            }

            case 270602: {
                return TacticalLines.BYDIF;
            }

            case 270603: {
                return TacticalLines.BYIMP;
            }

            case 271100: {
                return TacticalLines.GAP;
            }

            case 271201: {
                return TacticalLines.PLANNED;
            }

            case 271202: {
                return TacticalLines.ESR1;
            }

            case 271203: {
                return TacticalLines.ESR2;
            }

            case 271204: {
                return TacticalLines.ROADBLK;
            }

            case 280100: {
                return TacticalLines.ABATIS;
            }

            case 290100: {
                return TacticalLines.LINE;
            }

            case 290201: {
                return TacticalLines.ATDITCH;
            }

            case 290202: {
                return TacticalLines.ATDITCHC;
            }

            case 290203: {
                return TacticalLines.ATDITCHM;
            }

            case 290204: {
                return TacticalLines.ATWALL;
            }

            case 290301: {
                return TacticalLines.UNSP;
            }

            case 290302: {
                return TacticalLines.SFENCE;
            }

            case 290303: {
                return TacticalLines.DFENCE;
            }

            case 290304: {
                return TacticalLines.DOUBLEA;
            }

            case 290305: {
                return TacticalLines.LWFENCE;
            }

            case 290306: {
                return TacticalLines.HWFENCE;
            }

            case 290307: {
                return TacticalLines.SINGLEC;
            }

            case 290308: {
                return TacticalLines.DOUBLEC;
            }

            case 290309: {
                return TacticalLines.TRIPLE;
            }

            case 290600: {
                return TacticalLines.MFLANE;
            }

            case 270707: {
                return TacticalLines.DEPICT;
            }

            case 270800: {
                return TacticalLines.MINED;
            }

            case 270801: {
                return TacticalLines.FENCED;
            }

            case 290101: {
                return TacticalLines.MINE_LINE;
            }

            case 271000: {
                return TacticalLines.UXO;
            }

            case 271700: {
                return TacticalLines.BIO;
            }

            case 271800: {
                return TacticalLines.CHEM;
            }

            case 271900: {
                return TacticalLines.NUC;
            }

            case 272000: {
                return TacticalLines.RAD;
            }

            case 290400: {
                return TacticalLines.CLUSTER;
            }

            case 290500: {
                return TacticalLines.TRIP;
            }

            case 282003: {
                return TacticalLines.OVERHEAD_WIRE;
            }

            case 271300: {
                return TacticalLines.ASLTXING;
            }

            case 271500: {
                return TacticalLines.FORDSITE;
            }

            case 271600: {
                return TacticalLines.FORDIF;
            }

            case 290700: {
                return TacticalLines.FERRY;
            }

            case 290800: {
                return TacticalLines.RAFT;
            }

            case 290900: {
                return TacticalLines.FORTL;
            }

            case 291000: {
                return TacticalLines.FOXHOLE;
            }

            case 272100: {
                return TacticalLines.MSDZ;
            }

            case 272200: {
                return TacticalLines.DRCL;
            }


            case 310200: {
                return TacticalLines.EPW;
            }

            case 310300: {
                return TacticalLines.FARP;
            }

            case 310400: {
                return TacticalLines.RHA;
            }

            case 310500: {
                return TacticalLines.RSA;
            }

            case 310600: {
                return TacticalLines.BSA;
            }

            case 310700: {
                return TacticalLines.DSA;
            }

            case 330100: {
                return TacticalLines.CONVOY;
            }

            case 330200: {
                return TacticalLines.HCONVOY;
            }

            case 330300: {
                return TacticalLines.MSR;
            }

            case 330301: {
                return TacticalLines.MSR_ONEWAY;
            }

            case 330401: {
                return TacticalLines.ASR_ONEWAY;
            }

            case 330302: {
                return TacticalLines.MSR_TWOWAY;
            }

            case 330402: {
                return TacticalLines.ASR_TWOWAY;
            }

            case 330303: {
                return TacticalLines.MSR_ALT;
            }

            case 330403: {
                return TacticalLines.ASR_ALT;
            }


            case 330400: {
                return TacticalLines.ASR;
            }


            case 340100: {
                return TacticalLines.BLOCK;
            }

            case 340200: {
                return TacticalLines.BREACH;
            }

            case 340300: {
                return TacticalLines.BYPASS;
            }

            case 340400: {
                return TacticalLines.CANALIZE;
            }

            case 340500: {
                return TacticalLines.CLEAR;
            }

            case 340600: {
                return TacticalLines.CATK;
            }

            case 340700: {
                return TacticalLines.CATKBYFIRE;
            }


            case 340800: {
                return TacticalLines.DELAY;
            }

            case 341000: {
                return TacticalLines.DISRUPT;
            }

            case 341100: {
                return TacticalLines.FIX;
            }

            case 341200: {
                return TacticalLines.FOLLA;
            }

            case 341300: {
                return TacticalLines.FOLSP;
            }

            case 341500: {
                return TacticalLines.ISOLATE;
            }

            case 341700: {
                return TacticalLines.OCCUPY;
            }

            case 341800: {
                return TacticalLines.PENETRATE;
            }

            case 341900: {
                return TacticalLines.RIP;
            }

            case 342000: {
                return TacticalLines.RETIRE;
            }

            case 342100: {
                return TacticalLines.SECURE;
            }

            case 342201: {
                return TacticalLines.COVER;
            }

            case 342202: {
                return TacticalLines.GUARD;
            }

            case 342203: {
                return TacticalLines.SCREEN;
            }

            case 342300: {
                return TacticalLines.SEIZE;
            }

            case 342400: {
                return TacticalLines.WITHDRAW;
            }

            case 342500: {
                return TacticalLines.WDRAWUP;
            }

            case 342600: {
                return TacticalLines.CORDONKNOCK;
            }

            case 342700: {
                return TacticalLines.CORDONSEARCH;
            }

            case 272101: {
                return TacticalLines.STRIKWARN;
            }

            default: {
                break;
            }

        }
        return -1;
    }

    /**
     * Some symbol's points are reversed when moving from 2525C to 2525D. This method should be called at the start of each render.
     *
     * It's a simpler fix to reverse the points order at start than to reverse order when rendering.
     *
     * Note: Make sure to only call once to not reverse reversed points
     * @param tg
     */
    private static reversePointsRevD(tg: TacticalGraphic): void {
        try {
            if (tg.symbolId.length < 20 || SymbolID.getSymbolSet(tg.symbolId) !== 25) {
                return;
            }
            switch (tg.lineType) {
                case TacticalLines.UNSP:
                case TacticalLines.LWFENCE:
                case TacticalLines.HWFENCE:
                case TacticalLines.SINGLEC:
                case TacticalLines.DOUBLEC:
                case TacticalLines.TRIPLE:
                case TacticalLines.LINE: {
                    if (tg.Pixels != null) {
                        tg.Pixels.reverse();
                    }
                    if (tg.LatLongs != null) {
                        tg.LatLongs.reverse();
                    }
                    break;
                }

                case TacticalLines.CLUSTER: {
                    if (SymbolID.getVersion(tg.symbolId) < SymbolID.Version_2525E) {
                        if (tg.Pixels != null) {
                            tg.Pixels.reverse();
                        }
                        if (tg.LatLongs != null) {
                            tg.LatLongs.reverse();
                        }
                    }
                    break;
                }

                default: {
                    break;
                }

            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException("MultipointRenderer", "reversePointsRevD",
                    exc);
            } else {
                throw exc;
            }
        }
    }
}
