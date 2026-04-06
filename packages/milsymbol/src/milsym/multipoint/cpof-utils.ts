import { GeneralPath } from "../graphics/GeneralPath"
import { PathIterator } from "../graphics/PathIterator"
import { Point2D } from "../graphics/Point2D"
import { Rectangle } from "../graphics/Rectangle"
import { Rectangle2D } from "../graphics/Rectangle2D"
import { Shape } from "../graphics/Shape"
import { arraysupport } from "../generators/line-generator"
import { LineUtility } from "../math/line-ops"
import { POINT2 } from "../types/point"
import { Shape2 } from "../generators/shape2"
import { TacticalLines } from "../types/enums"
import { TacticalUtils as clsUtilityJTR } from "../tactical/tactical-utils"
import { Geodesic } from "../math/geodesic"
import { TacticalGraphic } from "../tactical/tactical-graphic"
import { ErrorLogger } from "../renderer/utilities/ErrorLogger"
import { IPointConversion } from "../renderer/utilities/IPointConversion"
import { ShapeInfo } from "../renderer/utilities/ShapeInfo"
import { SymbolUtilities } from "../renderer/utilities/SymbolUtilities"
import { ClipPolygon } from "../math/clip"
import { ClipQuad } from "../math/clip-quad"
import { MultipointUtils } from "./multipoint-utils"
import { METOC } from "../tactical/metoc";


/**
 * CPOF utility functions taken from JavaLineArrayCPOF
 *
 *
 */
export class CPOFUtils {

    private static readonly _className: string = "CPOFUtils";

    /**
     *
     * @param ptLatLong
     * @param converter
     * @return
     */
    private static PointLatLongToPixels(ptLatLong: POINT2,
        converter: IPointConversion): POINT2 {
        let pt: POINT2 = new POINT2();
        try {
            let x: number = ptLatLong.x;
            let y: number = ptLatLong.y;
            let ptPixels: Point2D = converter.GeoToPixels(new Point2D(x, y));
            pt.x = ptPixels.getX();
            pt.y = ptPixels.getY();
            pt.style = ptLatLong.style;

        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(CPOFUtils._className, "PointLatLongToPixels",
                    exc);
            } else {
                throw exc;
            }
        }
        return pt;
    }

    /**
     * for the change 1 fire support areas
     *
     * @param tg
     * @param lineType
     * @param radius
     * @param width
     * @param length
     * @param attitude
     */
    private static GetNumericFields(tg: TacticalGraphic,
        lineType: number): { radius: number, width: number, length: number, attitude: number[] } {
        let radiusVal: number = 0;
        let widthVal: number = 0;
        let lengthVal: number = 0;
        let attitudeVal: number[] = [0, 0];
        try {
            if (lineType === TacticalLines.RANGE_FAN_FILL) {
                return { radius: radiusVal, width: widthVal, length: lengthVal, attitude: attitudeVal };
            }
            let dist: number = 0;
            let pt0: POINT2 = new POINT2(0, 0);
            let pt1: POINT2 = new POINT2(0, 0);
            switch (lineType) {
                case TacticalLines.CIRCULAR:
                case TacticalLines.PBS_CIRCLE:
                case TacticalLines.BDZ:
                case TacticalLines.BBS_POINT:
                case TacticalLines.FSA_CIRCULAR:
                case TacticalLines.NOTACK:
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
                case TacticalLines.ACA_CIRCULAR:
                case TacticalLines.KILLBOXBLUE_CIRCULAR:
                case TacticalLines.KILLBOXPURPLE_CIRCULAR: {
                    if (SymbolUtilities.isNumber(tg.am)) {
                        radiusVal = parseFloat(tg.am);
                    }
                    break;
                }

                case TacticalLines.LAUNCH_AREA:
                case TacticalLines.DEFENDED_AREA_CIRCULAR:
                case TacticalLines.SHIP_AOI_CIRCULAR:
                case TacticalLines.PBS_ELLIPSE: {
                    //minor radius in meters
                    if (SymbolUtilities.isNumber(tg.am1)) {
                        lengthVal = parseFloat(tg.am1);
                    }
                    //major radius in meters
                    if (SymbolUtilities.isNumber(tg.am)) {
                        widthVal = parseFloat(tg.am);
                    }
                    //rotation angle in degrees
                    if (SymbolUtilities.isNumber(tg.an)) {
                        attitudeVal[0] = parseFloat(tg.an);
                    }

                    break;
                }

                case TacticalLines.RECTANGULAR: {
                    if (SymbolUtilities.isNumber(tg.am1)) {
                        lengthVal = parseFloat(tg.am1);
                    }
                    if (SymbolUtilities.isNumber(tg.am)) {
                        widthVal = parseFloat(tg.am);
                    }
                    //assume that attitude was passed in mils
                    //so we must multiply by 360/6400 to convert to degrees
                    if (SymbolUtilities.isNumber(tg.an)) {
                        attitudeVal[0] = parseFloat(tg.an) * (360 / 6400);
                    }
                    break;
                }

                case TacticalLines.PBS_RECTANGLE:
                case TacticalLines.PBS_SQUARE: {
                    if (SymbolUtilities.isNumber(tg.am1)) {
                        lengthVal = parseFloat(tg.am1);
                    }
                    if (SymbolUtilities.isNumber(tg.am)) {
                        widthVal = parseFloat(tg.am);
                    }
                    //assume that attitude was passed in mils
                    //so we must multiply by 360/6400 to convert to degrees
                    if (SymbolUtilities.isNumber(tg.an)) {
                        attitudeVal[0] = parseFloat(tg.an);
                    }
                    break;
                }

                case TacticalLines.CUED_ACQUISITION: {
                    if (SymbolUtilities.isNumber(tg.am)) {
                        lengthVal = parseFloat(tg.am);
                    }
                    if (SymbolUtilities.isNumber(tg.am1)) {
                        widthVal = parseFloat(tg.am1);
                    }
                    if (SymbolUtilities.isNumber(tg.an)) {
                        // Make 0 degrees point north instead of East
                        attitudeVal[0] = parseFloat(tg.an) + 270;
                    }
                    break;
                }

                case TacticalLines.PAA_RECTANGULAR:
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
                case TacticalLines.KILLBOXPURPLE_RECTANGULAR:
                case TacticalLines.RECTANGULAR_TARGET:
                case TacticalLines.BS_ORBIT: {
                    if (tg.LatLongs.length >= 2) {
                        //get the length and the attitude in mils
                        pt0 = tg.LatLongs[0];
                        pt1 = tg.LatLongs[1];
                        const geoResult = Geodesic.geodesic_distance(pt0, pt1);
                        dist = geoResult.distance;
                        attitudeVal[0] = geoResult.a12;
                    }
                    if (SymbolUtilities.isNumber(tg.am)) {
                        widthVal = parseFloat(tg.am);
                    }
                    break;
                }

                case TacticalLines.BS_POLYARC: {
                    if (SymbolUtilities.isNumber(tg.am)) {
                        lengthVal = parseFloat(tg.am);
                    }
                    let an = tg.an.split(",");
                    attitudeVal[0] = parseFloat(an[0]);
                    attitudeVal[1] = parseFloat(an[1]);
                    break;
                }

                default: {
                    break;
                }

            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(CPOFUtils._className, "GetNumericFields",
                    exc);
            } else {
                throw exc;
            }
        }
        return { radius: radiusVal, width: widthVal, length: lengthVal, attitude: attitudeVal };
    }

    /**
     * Do a 360 degree horizontal shift for points on either side of the
     * midpoint of the display, if the MBR for the pixels is greater than 180
     * degrees wide. Builds pixels for two symbols to draw a symbol flipped
     * about the left edge and also a symbol flipped about the right edge. This
     * function is typically used at world view. Caller must instantiate last
     * two parameters.
     *
     * @param tg
     * @param converter
     * @param farLeftPixels - OUT - the resultant pixels for left shift symbol
     * @param farRightPixels - OUT - the result pixels for the right shift
     * symbol
     */
    static GetFarPixels(tg: TacticalGraphic,
        converter: IPointConversion,
        farLeftPixels: POINT2[],
        farRightPixels: POINT2[]): void {
        try {
            if (farLeftPixels == null || farRightPixels == null) {
                return;
            }
            //Cannot use tg.LatLon to get width in degrees because it shifts +/-180 at IDL.
            //Get degrees per pixel longitude, will use it for determining width in degrees
            let ptPixels50: Point2D = converter.GeoToPixels(new Point2D(50, 30));
            let ptPixels60: Point2D = converter.GeoToPixels(new Point2D(60, 30));
            let degLonPerPixel: number = 10 / Math.abs(ptPixels60.getX() - ptPixels50.getX());
            let j: number = 0;
            let minX: number = Number.MAX_VALUE;
            let maxX: number = -Number.MAX_VALUE;
            let n: number = tg.Pixels.length;
            //for(j=0;j<tg.Pixels.length;j++)
            for (j = 0; j < n; j++) {
                if (tg.Pixels[j].x < minX) {
                    minX = tg.Pixels[j].x;
                }
                if (tg.Pixels[j].x > maxX) {
                    maxX = tg.Pixels[j].x;
                }
            }
            let degWidth: number = (maxX - minX) * degLonPerPixel;
            if (Math.abs(degWidth) < 180) {
                return;
            }

            //if it did not return then we must shift the pixels left and right
            //first get the midpoint X value to use for partitioning the points
            let midX: number = Math.abs(180 / degLonPerPixel);
            let x: number = 0;
            let y: number = 0;
            //do a shift about the left hand side
            //for(j=0;j<tg.Pixels.length;j++)
            for (j = 0; j < n; j++) {
                x = tg.Pixels[j].x;
                y = tg.Pixels[j].y;
                if (x > midX) {
                    //shift x left by 360 degrees in pixels
                    x -= 2 * midX;
                }
                //else do not shift the point
                //add the shifted (or not) point to the new arraylist
                farLeftPixels.push(new POINT2(x, y));
            }
            //do a shift about the right hand side
            //for(j=0;j<tg.Pixels.length;j++)
            for (j = 0; j < n; j++) {
                x = tg.Pixels[j].x;
                y = tg.Pixels[j].y;
                if (x < midX) {
                    //shift x right by 360 degrees in pixels
                    x += 2 * midX;
                }
                //else do not shift the point
                //add the shifted (or not) point to the new arraylist
                farRightPixels.push(new POINT2(x, y));
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(CPOFUtils._className, "GetFarPixels",
                    exc);
            } else {
                throw exc;
            }
        }
    }

    /**
     *
     * @param tg
     * @param lineType
     * @param converter
     * @param shapes
     * @return
     */
    static Change1TacticalAreas(tg: TacticalGraphic,
        lineType: number, converter: IPointConversion, shapes: Array<Shape2>): boolean {
        try {
            const numFields = CPOFUtils.GetNumericFields(tg, lineType);
            const widthVal = numFields.width;
            const lengthVal = numFields.length;
            const attitudeVal = numFields.attitude;
            const radiusVal = numFields.radius;
            let j: number = 0;
            let pt0: POINT2 = tg.LatLongs[0];
            let pt1: POINT2;
            let ptTemp: POINT2 = new POINT2();
            let pt00: POINT2 = new POINT2();
            if (tg.LatLongs.length > 1) {
                pt1 = tg.LatLongs[1];
            } else {
                pt1 = tg.LatLongs[0];
            }
            let pPoints: POINT2[];
            let ptCenter: POINT2 = CPOFUtils.PointLatLongToPixels(pt0, converter);
            switch (lineType) {
                case TacticalLines.LAUNCH_AREA:
                case TacticalLines.DEFENDED_AREA_CIRCULAR:
                case TacticalLines.SHIP_AOI_CIRCULAR:
                case TacticalLines.PBS_ELLIPSE: {
                    let ellipsePts: POINT2[] = Geodesic.getGeoEllipse(pt0, widthVal, lengthVal, attitudeVal[0]);
                    for (j = 0; j < ellipsePts.length; j++) //was 103
                    {
                        pt0 = ellipsePts[j];
                        pt1 = CPOFUtils.PointLatLongToPixels(pt0, converter);
                        tg.Pixels.push(pt1);
                    }
                    break;
                }

                case TacticalLines.PAA_RECTANGULAR:
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
                    //get the upper left corner                    
                    pt00 = Geodesic.geodesic_coordinate(pt0, widthVal / 2, attitudeVal[0] - 90);
                    pt00 = CPOFUtils.PointLatLongToPixels(pt00, converter);

                    pt00.style = 0;
                    tg.Pixels.push(pt00);

                    //second corner (clockwise from center)
                    ptTemp = Geodesic.geodesic_coordinate(pt0, widthVal / 2, attitudeVal[0] + 90);
                    ptTemp = CPOFUtils.PointLatLongToPixels(ptTemp, converter);
                    ptTemp.style = 0;
                    tg.Pixels.push(ptTemp);

                    //third corner (clockwise from center)
                    ptTemp = Geodesic.geodesic_coordinate(pt1, widthVal / 2, attitudeVal[0] + 90);
                    ptTemp = CPOFUtils.PointLatLongToPixels(ptTemp, converter);
                    ptTemp.style = 0;
                    tg.Pixels.push(ptTemp);

                    //fourth corner (clockwise from center)
                    ptTemp = Geodesic.geodesic_coordinate(pt1, widthVal / 2, attitudeVal[0] - 90);
                    ptTemp = CPOFUtils.PointLatLongToPixels(ptTemp, converter);
                    ptTemp.style = 0;
                    tg.Pixels.push(ptTemp);

                    tg.Pixels.push(pt00);
                    break;
                }

                case TacticalLines.BS_ORBIT: {
                    ptTemp = Geodesic.geodesic_coordinate(pt0, widthVal / 2, attitudeVal[0] - 90);
                    ptTemp = CPOFUtils.PointLatLongToPixels(ptTemp, converter);
                    ptTemp.style = 0;
                    tg.Pixels.push(ptTemp);

                    ptTemp = Geodesic.geodesic_coordinate(pt1, widthVal / 2, attitudeVal[0] - 90);
                    pPoints = new Array<POINT2>(3);
                    pPoints[0] = new POINT2(pt1);
                    pPoints[1] = new POINT2(ptTemp);
                    pPoints[2] = new POINT2(ptTemp);
                    let pPoints2 = Geodesic.GetGeodesicArc(pPoints);
                    for (j = 0; j < pPoints2.length / 2; j++) {
                        ptTemp = CPOFUtils.PointLatLongToPixels(pPoints2[j], converter);
                        ptTemp.style = 0;
                        tg.Pixels.push(ptTemp);
                    }

                    ptTemp = Geodesic.geodesic_coordinate(pt0, widthVal / 2, attitudeVal[0] + 90);
                    pPoints[0] = new POINT2(pt0);
                    pPoints[1] = new POINT2(ptTemp);
                    pPoints[2] = new POINT2(ptTemp);
                    pPoints2 = Geodesic.GetGeodesicArc(pPoints);
                    for (j = 0; j < pPoints2.length / 2; j++) {
                        ptTemp = CPOFUtils.PointLatLongToPixels(pPoints2[j], converter);
                        ptTemp.style = 0;
                        tg.Pixels.push(ptTemp);
                    }
                    break;
                }

                case TacticalLines.BS_ROUTE: {
                    let am = tg.am.split(",");
                    while (am.length < tg.LatLongs.length - 1) {
                        am.push(am[am.length - 1]);
                    }
                    for (let i = 0; i < tg.LatLongs.length - 1; i++) {
                        let pt0: POINT2 = tg.LatLongs[i];
                        let pt1: POINT2 = tg.LatLongs[i + 1];
                        let width: number;
                        let attitude: number;

                        const geoResult = Geodesic.geodesic_distance(pt0, pt1);
                        attitude = geoResult.a12;

                        if (SymbolUtilities.isNumber(am[i])) {
                            width = parseFloat(am[i]);
                        }

                        //get the upper left corner                    
                        pt00 = Geodesic.geodesic_coordinate(pt0, width / 2, attitude - 90);
                        pt00 = CPOFUtils.PointLatLongToPixels(pt00, converter);

                        pt00.style = 0;
                        tg.Pixels.push(pt00);

                        //second corner (clockwise from center)
                        ptTemp = Geodesic.geodesic_coordinate(pt0, width / 2, attitude + 90);
                        ptTemp = CPOFUtils.PointLatLongToPixels(ptTemp, converter);
                        ptTemp.style = 0;
                        tg.Pixels.push(ptTemp);

                        //third corner (clockwise from center)
                        ptTemp = Geodesic.geodesic_coordinate(pt1, width / 2, attitude + 90);
                        ptTemp = CPOFUtils.PointLatLongToPixels(ptTemp, converter);
                        ptTemp.style = 0;
                        tg.Pixels.push(ptTemp);

                        //fourth corner (clockwise from center)
                        ptTemp = Geodesic.geodesic_coordinate(pt1, width / 2, attitude - 90);
                        ptTemp = CPOFUtils.PointLatLongToPixels(ptTemp, converter);
                        ptTemp.style = 0;
                        tg.Pixels.push(ptTemp);

                        pt00 = new POINT2(pt00);
                        pt00.style = 5;
                        tg.Pixels.push(pt00);
                    }
                    break;
                }

                case TacticalLines.BS_TRACK: {
                    let am = tg.am.split(",");
                    while (am.length < 2 * (tg.LatLongs.length - 1)) {
                        am.push(am[am.length - 1]);
                    }
                    for (let i = 0; i < tg.LatLongs.length - 1; i++) {
                        let pt0: POINT2 = tg.LatLongs[i];
                        let pt1: POINT2 = tg.LatLongs[i + 1];
                        let leftWidth: number;
                        let rightWidth: number;
                        let attitude: number;

                        const geoResult = Geodesic.geodesic_distance(pt0, pt1);
                        attitude = geoResult.a12;

                        if (SymbolUtilities.isNumber(am[2 * i])) {
                            leftWidth = parseFloat(am[2 * i]);
                        }
                        if (SymbolUtilities.isNumber(am[2 * i + 1])) {
                            rightWidth = parseFloat(am[2 * i + 1]);
                        }

                        //get the upper left corner                    
                        pt00 = Geodesic.geodesic_coordinate(pt0, leftWidth, attitude - 90);
                        pt00 = CPOFUtils.PointLatLongToPixels(pt00, converter);

                        pt00.style = 0;
                        tg.Pixels.push(pt00);

                        //second corner (clockwise from center)
                        ptTemp = Geodesic.geodesic_coordinate(pt0, rightWidth, attitude + 90);
                        ptTemp = CPOFUtils.PointLatLongToPixels(ptTemp, converter);
                        ptTemp.style = 0;
                        tg.Pixels.push(ptTemp);

                        //third corner (clockwise from center)
                        ptTemp = Geodesic.geodesic_coordinate(pt1, rightWidth, attitude + 90);
                        ptTemp = CPOFUtils.PointLatLongToPixels(ptTemp, converter);
                        ptTemp.style = 0;
                        tg.Pixels.push(ptTemp);

                        //fourth corner (clockwise from center)
                        ptTemp = Geodesic.geodesic_coordinate(pt1, leftWidth, attitude - 90);
                        ptTemp = CPOFUtils.PointLatLongToPixels(ptTemp, converter);
                        ptTemp.style = 0;
                        tg.Pixels.push(ptTemp);

                        pt00 = new POINT2(pt00);
                        pt00.style = 5;
                        tg.Pixels.push(pt00);
                    }
                    break;
                }

                case TacticalLines.RECTANGULAR_TARGET: {
                    let pts: POINT2[] = new Array<POINT2>(4); // 4 Corners

                    // get the upper left corner
                    pts[0] = Geodesic.geodesic_coordinate(pt0, widthVal / 2, attitudeVal[0] - 90);
                    ptTemp = CPOFUtils.PointLatLongToPixels(pts[0], converter);
                    ptTemp.style = 0;
                    tg.Pixels.push(ptTemp);

                    // second corner (clockwise from center)
                    pts[1] = Geodesic.geodesic_coordinate(pt0, widthVal / 2, attitudeVal[0] + 90);
                    ptTemp = CPOFUtils.PointLatLongToPixels(pts[1], converter);
                    ptTemp.style = 0;
                    tg.Pixels.push(ptTemp);

                    // third corner (clockwise from center)
                    pts[2] = Geodesic.geodesic_coordinate(pt1, widthVal / 2, attitudeVal[0] + 90);
                    ptTemp = CPOFUtils.PointLatLongToPixels(pts[2], converter);
                    ptTemp.style = 0;
                    tg.Pixels.push(ptTemp);

                    // fourth corner (clockwise from center)
                    pts[3] = Geodesic.geodesic_coordinate(pt1, widthVal / 2, attitudeVal[0] - 90);
                    ptTemp = CPOFUtils.PointLatLongToPixels(pts[3], converter);
                    ptTemp.style = 0;
                    tg.Pixels.push(ptTemp);

                    // Close shape
                    ptTemp = CPOFUtils.PointLatLongToPixels(pts[0], converter);
                    ptTemp.style = 5;
                    tg.Pixels.push(ptTemp);

                    let heightD: number = Geodesic.geodesic_distance(pts[0], pts[1]).distance;
                    let widthD: number = Geodesic.geodesic_distance(pts[1], pts[2]).distance;
                    let crossLength: number = Math.min(heightD, widthD) * .4; // Length from center

                    let centerPt: POINT2 = LineUtility.CalcCenterPointDouble2(pts, 4);

                    ptTemp = Geodesic.geodesic_coordinate(centerPt, crossLength, 0);
                    ptTemp = CPOFUtils.PointLatLongToPixels(ptTemp, converter);
                    ptTemp.style = 0;
                    tg.Pixels.push(ptTemp);

                    ptTemp = Geodesic.geodesic_coordinate(centerPt, crossLength, 180);
                    ptTemp = CPOFUtils.PointLatLongToPixels(ptTemp, converter);
                    ptTemp.style = 5;
                    tg.Pixels.push(ptTemp);

                    ptTemp = Geodesic.geodesic_coordinate(centerPt, crossLength, -90);
                    ptTemp = CPOFUtils.PointLatLongToPixels(ptTemp, converter);
                    ptTemp.style = 0;
                    tg.Pixels.push(ptTemp);

                    ptTemp = Geodesic.geodesic_coordinate(centerPt, crossLength, 90);
                    ptTemp = CPOFUtils.PointLatLongToPixels(ptTemp, converter);
                    ptTemp.style = 0;
                    tg.Pixels.push(ptTemp);
                    break;
                }

                case TacticalLines.RECTANGULAR:
                case TacticalLines.PBS_RECTANGLE:
                case TacticalLines.PBS_SQUARE:
                case TacticalLines.CUED_ACQUISITION: {
                    //AFATDS swap length and width
                    //comment next three lines to render per Mil-Std-2525
                    //double temp=widthVal;
                    //widthVal=lengthVal;
                    //lengthVal=temp;

                    //get the upper left corner
                    ptTemp = Geodesic.geodesic_coordinate(pt0, lengthVal / 2, attitudeVal[0] - 90);//was length was -90
                    ptTemp = Geodesic.geodesic_coordinate(ptTemp, widthVal / 2, attitudeVal[0] + 0);//was width was 0

                    ptTemp = CPOFUtils.PointLatLongToPixels(ptTemp, converter);
                    tg.Pixels.push(ptTemp);
                    //second corner (clockwise from center)
                    ptTemp = Geodesic.geodesic_coordinate(pt0, lengthVal / 2, attitudeVal[0] + 90);  //was length was +90
                    ptTemp = Geodesic.geodesic_coordinate(ptTemp, widthVal / 2, attitudeVal[0] + 0);   //was width was 0

                    ptTemp = CPOFUtils.PointLatLongToPixels(ptTemp, converter);

                    tg.Pixels.push(ptTemp);

                    //third corner (clockwise from center)
                    ptTemp = Geodesic.geodesic_coordinate(pt0, lengthVal / 2, attitudeVal[0] + 90);//was length was +90
                    ptTemp = Geodesic.geodesic_coordinate(ptTemp, widthVal / 2, attitudeVal[0] + 180);//was width was +180

                    ptTemp = CPOFUtils.PointLatLongToPixels(ptTemp, converter);

                    tg.Pixels.push(ptTemp);

                    //fouth corner (clockwise from center)
                    ptTemp = Geodesic.geodesic_coordinate(pt0, lengthVal / 2, attitudeVal[0] - 90);//was length was -90
                    ptTemp = Geodesic.geodesic_coordinate(ptTemp, widthVal / 2, attitudeVal[0] + 180);//was width was +180

                    ptTemp = CPOFUtils.PointLatLongToPixels(ptTemp, converter);
                    tg.Pixels.push(ptTemp);
                    tg.Pixels.push(new POINT2(tg.Pixels[0].x, tg.Pixels[0].y));
                    break;
                }

                case TacticalLines.CIRCULAR:
                case TacticalLines.PBS_CIRCLE:
                case TacticalLines.BDZ:
                case TacticalLines.BBS_POINT:
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
                case TacticalLines.KILLBOXPURPLE_CIRCULAR: {
                    //get a horizontal point on the radius
                    pt0 = tg.LatLongs[0];

                    ptTemp = Geodesic.geodesic_coordinate(pt0, radiusVal, 90);

                    pPoints = new Array<POINT2>(3);
                    pPoints[0] = new POINT2(pt0);
                    pPoints[1] = new POINT2(ptTemp);
                    pPoints[2] = new POINT2(ptTemp);

                    let pPoints2: Array<POINT2> = Geodesic.GetGeodesicArc(pPoints);
                    let ptTemp2: POINT2;
                    //fill pixels and latlongs
                    for (j = 0; j < pPoints2.length; j++) //was 103
                    {
                        pt0 = pPoints2[j];
                        ptTemp2 = new POINT2();
                        ptTemp2 = CPOFUtils.PointLatLongToPixels(pt0, converter);

                        tg.Pixels.push(ptTemp2);
                    }
                    break;
                }

                case TacticalLines.RANGE_FAN: {
                    //get the concentric circles
                    CPOFUtils.GetConcentricCircles(tg, lineType, converter);
                    //Mil-Std-2525 Rev C does not have the orientation arrow
                    //assume we are using Rev C if there is only 1 anchor point
                    if (tg.LatLongs.length > 1) {
                        CPOFUtils.RangeFanOrientation(tg, lineType, converter);
                    }
                    break;
                }

                case TacticalLines.RANGE_FAN_SECTOR: {
                    CPOFUtils.GetSectorRangeFan(tg, converter);
                    CPOFUtils.RangeFanOrientation(tg, lineType, converter);
                    break;
                }

                case TacticalLines.RADAR_SEARCH:
                case TacticalLines.BS_RADARC:
                case TacticalLines.BS_CAKE: {
                    CPOFUtils.GetSectorRangeFan(tg, converter);
                    break;
                }

                case TacticalLines.RANGE_FAN_FILL: {  //circular range fan calls Change1TacticalAreas twice
                    CPOFUtils.GetSectorRangeFan(tg, converter);
                    break;
                }

                case TacticalLines.BS_POLYARC: {
                    // Polyarc points should be counterclockwise 
                    if (CPOFUtils.CalculateSignedAreaOfPolygon(tg.LatLongs) < 0) {
                        tg.LatLongs = [tg.LatLongs[0]].concat(tg.LatLongs.slice(1).reverse());
                    }

                    let pPointsArc: Array<POINT2> = new Array();
                    let pPoints: Array<POINT2> = new Array();
                    pPoints.push(pt0);
                    pPoints.push(Geodesic.geodesic_coordinate(pt0, lengthVal, attitudeVal[0]));
                    pPoints.push(Geodesic.geodesic_coordinate(pt0, lengthVal, attitudeVal[1]));
                    Geodesic.GetGeodesicArc2(pPoints, pPointsArc);

                    for (let i = 0; i < pPointsArc.length; i++) {
                        ptTemp = new POINT2(pPointsArc[i]);
                        ptTemp = CPOFUtils.PointLatLongToPixels(ptTemp, converter);
                        tg.Pixels.push(ptTemp);
                    }

                    for (let i = 1; i < tg.LatLongs.length; i++) {
                        ptTemp = new POINT2(tg.LatLongs[i]);
                        ptTemp = CPOFUtils.PointLatLongToPixels(ptTemp, converter);
                        tg.Pixels.push(ptTemp);
                    }

                    tg.Pixels.push(tg.Pixels[0]);
                    break;
                }

                default: {
                    return false;
                }

            }

            //the shapes
            let farLeftPixels: Array<POINT2> = new Array();
            let farRightPixels: Array<POINT2> = new Array();
            CPOFUtils.GetFarPixels(tg, converter, farLeftPixels, farRightPixels);
            let shapesLeft: Array<Shape2> = new Array();
            let shapesRight: Array<Shape2> = new Array();
            //ArrayList<Shape2>shapes=null;   //use this to collect all the shapes

            if (farLeftPixels.length === 0 || farRightPixels.length === 0) {
                //diagnostic
                //Change1PixelsToShapes(tg,shapes);
                let tempPixels: Array<POINT2> = new Array();
                tempPixels.push(...tg.Pixels);
                CPOFUtils.postSegmentFSA(tg, converter);
                CPOFUtils.Change1PixelsToShapes(tg, shapes, false);
                //reuse the original pixels for the subsequent call to AddModifier2
                tg.Pixels = tempPixels;
                //end section
            } else //symbol was more than 180 degrees wide, use left and right symbols
            {
                //set tg.Pixels to the left shapes for the call to Change1PixelsToShapes
                tg.Pixels = farLeftPixels;
                CPOFUtils.Change1PixelsToShapes(tg, shapesLeft, false);
                //set tg.Pixels to the right shapes for the call to Change1PixelsToShapes
                tg.Pixels = farRightPixels;
                CPOFUtils.Change1PixelsToShapes(tg, shapesRight, false);
                //load left and right shapes into shapes
                shapes.push(...shapesLeft);
                shapes.push(...shapesRight);
            }
            if (lineType == TacticalLines.BBS_POINT) {
                let shape: Shape2 = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                shape.moveTo(ptCenter);
                //ptCenter.x+=1;
                ptCenter.y += 1;
                shape.lineTo(ptCenter);
                shapes.push(shape);
            }
            if (lineType == TacticalLines.PBS_RECTANGLE || lineType == TacticalLines.PBS_SQUARE)
            {
                let dist: number = radiusVal;//Double.parseDouble(strH1);
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
                dist = LineUtility.calcDistance(pt0, pt1);    //pixels distance
                //tg.Pixels.get(0).style=(int)dist;
                let tempPixels: Array<POINT2> = [];
                tempPixels.push(...tg.Pixels);
                let pts: POINT2[] = tempPixels;
                pts[0].style=Math.trunc(dist);
                LineUtility.getExteriorPoints(pts, pts.length, lineType, false);
                tg.Pixels.length = 0;
                for(j=0;j<pts.length;j++)
                    tg.Pixels.push(new POINT2(pts[j].x,pts[j].y));

                CPOFUtils.Change1PixelsToShapes(tg, shapes, true);
                //reuse the original pixels for the subsequent call to AddModifier2
                tg.Pixels = tempPixels;
            }
            return true;
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(CPOFUtils._className, "Change1TacticalAreas",
                    exc);
            } else {
                throw exc;
            }
        }
        return false;
    }

    /**
     * build shapes arraylist from tg.Pixels for the Change 1 symbols
     *
     * @param tg
     * @param shapes - OUT - caller instantiates the arraylist
     */
    private static Change1PixelsToShapes(tg: TacticalGraphic, shapes: Array<Shape2>, fill: boolean): void {
        let shape: Shape2;
        let beginLine: boolean = true;
        let currentPt: POINT2;
        let lastPt: POINT2;
        let k: number = 0;
        let linetype: number = tg.lineType;
        let n: number = tg.Pixels.length;
        //a loop for the outline shapes            
        //for (k = 0; k < tg.Pixels.length; k++)
        for (k = 0; k < n; k++) {
            //use shapes instead of pixels
            if (shape == null) {
                //shape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                if (!fill) {

                    shape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                }

                else {
                    if (fill) {

                        shape = new Shape2(Shape2.SHAPE_TYPE_FILL);
                    }

                }

            }

            currentPt = tg.Pixels[k];
            if (k > 0) {
                lastPt = tg.Pixels[k - 1];
            }

            if (beginLine) {
                if (k === 0) {
                    shape.style = currentPt.style;
                }

                if (k > 0) //doubled points with linestyle=5
                {
                    if (currentPt.style === 5 && lastPt.style === 5) {
                        shape.lineTo(currentPt);
                    }
                }

                shape.moveTo(currentPt);
                beginLine = false;
            } else {
                shape.lineTo(currentPt);
                if (currentPt.style === 5 || currentPt.style === 10) {
                    beginLine = true;
                    //unless there are doubled points with style=5
                    if ((linetype === TacticalLines.RANGE_FAN_FILL || linetype === TacticalLines.BS_ROUTE || linetype === TacticalLines.BS_TRACK || linetype === TacticalLines.BS_CAKE) && k < tg.Pixels.length - 1) {
                        shapes.push(shape);
                        shape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                    }
                }
            }
            if (k === tg.Pixels.length - 1) //PBS shapes have 2 shapes, other non-LC symbols have 1 shape
            {
                //shapes.push(shape);
                if (shape.getShapeType() === ShapeInfo.SHAPE_TYPE_FILL) {

                    shapes.splice(0, 0, shape);
                }

                else {

                    shapes.push(shape);
                }

            }
        }   //end for

    }

    private static GetConcentricCircles(tg: TacticalGraphic, lineType: number, converter: IPointConversion): void {
        try {
            let j: number = 0;
            let l: number = 0;
            let radius: number = 0;

            let pt: POINT2 = new POINT2();
            let pts: Array<POINT2> = new Array();
            let radii: number[]; // AM
            let strAM: string = tg.am;
            if (tg.LatLongs.length === 1 && strAM != null) {
                let strs: string[] = strAM.split(",");
                radii = new Array<number>(strs.length);
                for (j = 0; j < strs.length; j++) {
                    radii[j] = parseFloat(strs[j]);
                }
            }

            let n: number = radii.length;

            //loop thru the circles
            let pPoints: POINT2[];
            for (l = 0; l < n; l++) {
                radius = radii[l];
                if (radius === 0) {
                    continue;
                }

                pPoints = new Array<POINT2>(3);
                pt = tg.LatLongs[0];
                pPoints[0] = new POINT2(pt);
                //radius, 90, ref lon2c, ref lat2c);
                pt = Geodesic.geodesic_coordinate(pt, radius, 90);
                pPoints[1] = new POINT2(pt);
                pPoints[2] = new POINT2(pt);

                pts = Geodesic.GetGeodesicArc(pPoints);

                let ptTemp2: POINT2;
                //fill pixels and latlongs
                let t: number = pts.length;
                //for (j = 0; j < pts.length; j++)//was 103
                for (j = 0; j < t; j++)//was 103
                {
                    ptTemp2 = new POINT2();
                    ptTemp2 = CPOFUtils.PointLatLongToPixels(pts[j], converter);
                    ptTemp2.style = 0;
                    if (j === pts.length - 1) {
                        ptTemp2.style = 5;
                    }

                    tg.Pixels.push(ptTemp2);
                }
            }
            let length: number = tg.Pixels.length;
            tg.Pixels[length - 1].style = 5;

        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(CPOFUtils._className, "GetConcentricCircles",
                    exc);
            } else {
                throw exc;
            }
        }
    }

    /**
     * if tg.H2 is filled then the max range sector is used to determine the
     * orientation
     *
     * @param tg
     * @return left,right,min,max
     */
    private static GetMaxSector(tg: TacticalGraphic): string | null {
        let strLeftRightMinMax: string;
        try {
            let max: number = 0;
            let maxx: number = -Number.MAX_VALUE;
            //get the number of sectors
            strLeftRightMinMax = tg.leftRightMinMax;
            let leftRightMinMax: string[] = strLeftRightMinMax.split(",");
            let numSectors: number = leftRightMinMax.length / 4;
            let k: number = 0;
            let maxIndex: number = -1;
            //there must be at least one sector
            if (numSectors < 1) {
                return null;
            }

            if (numSectors * 4 !== leftRightMinMax.length) {
                return null;
            }
            //get the max index

            for (k = 0; k < numSectors; k++) {
                //left = Double.parseFloat(leftRightMinMax[4 * k]);
                //right = Double.parseFloat(leftRightMinMax[4 * k + 1]);
                //min = Double.parseFloat(leftRightMinMax[4 * k + 2]);
                max = parseFloat(leftRightMinMax[4 * k + 3]);
                if (max > maxx) {
                    maxx = max;
                    maxIndex = k;
                }
            }

            let strLeft: string = leftRightMinMax[4 * maxIndex];
            let strRight: string = leftRightMinMax[4 * maxIndex + 1];
            let strMin: string = leftRightMinMax[4 * maxIndex + 2];
            let strMax: string = leftRightMinMax[4 * maxIndex + 3];
            strLeftRightMinMax = strLeft + "," + strRight + "," + strMin + "," + strMax;
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(CPOFUtils._className, "GetMaxSector",
                    exc);
            } else {
                throw exc;
            }
        }
        return strLeftRightMinMax;
    }

    /**
     * Create a tg with a new line type to used for circular range fan fill
     *
     * @param tg
     * @return
     */
    static GetCircularRangeFanFillTG(tg: TacticalGraphic): TacticalGraphic {
        let tg1: TacticalGraphic;
        try {
            //instantiate a dummy tg which will be used to call GetSectorRangeFan
            tg1 = new TacticalGraphic();
            tg1.visibleModifiers = true;
            tg1.lineThickness = 0;
            tg1.fillColor = tg.fillColor;
            tg1.fillStyle = tg.fillStyle;
            tg1.LatLongs = new Array<POINT2>();
            tg1.Pixels = new Array<POINT2>();
            //we only want the 0th point
            tg1.LatLongs.push(tg.LatLongs[0]);
            tg1.Pixels.push(tg.Pixels[0]);
            tg1.Pixels.push(tg.Pixels[1]);
            tg1.lineType = TacticalLines.RANGE_FAN_FILL;

            if (tg.lineType === TacticalLines.RANGE_FAN_SECTOR || tg.lineType === TacticalLines.RADAR_SEARCH) {
                tg1.leftRightMinMax = tg.leftRightMinMax;
                return tg1;
            } else {
                if (tg.lineType === TacticalLines.RANGE_FAN) {
                    let radii: string[] = tg.am.split(",");
                    let strLeftRightMinMax: string = "";
                    for (let j: number = 0; j < radii.length - 1; j++) {
                        if (j > 0) {
                            strLeftRightMinMax += ",";
                        }

                        strLeftRightMinMax += "0,0," + radii[j] + "," + radii[j + 1];
                    }
                    tg1.leftRightMinMax = strLeftRightMinMax;
                }
            }

        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(CPOFUtils._className, "GetCircularRangeFanFillTG",
                    exc);
            } else {
                throw exc;
            }
        }
        return tg1;
    }

    /**
     *
     * @param tg
     * @param converter
     * @return
     */
    private static GetSectorRangeFan(tg: TacticalGraphic, converter: IPointConversion): boolean {
        let circle: boolean = false;
        try {
            let ptCenter: POINT2 = tg.LatLongs[0];
            let k: number = 0;
            let l: number = 0;
            let numSectors: number = 0;
            clsUtilityJTR.GetSectorRadiiFromPoints(tg);

            //use pPoints to get each geodesic arc
            let pPoints: Array<POINT2> = new Array();
            let pPointsInnerArc: Array<POINT2> = new Array();
            let pPointsOuterArc: Array<POINT2> = new Array();
            let sectorPoints: Array<POINT2> = new Array();
            let allPoints: Array<POINT2> = new Array();

            //use these and the center to define each sector
            let pt1: POINT2 = new POINT2();
            let pt2: POINT2 = new POINT2();

            //get the number of sectors
            let strLeftRightMinMax: string = tg.leftRightMinMax;
            let leftRightMinMax: string[] = strLeftRightMinMax.split(",");

            //sanity checks
            let left: number = 0;
            let right: number = 0;
            let min: number = 0;
            let max: number = 0;
            numSectors = leftRightMinMax.length / 4;

            //there must be at least one sector
            if (numSectors < 1) {
                return false;
            }

            if (numSectors * 4 !== leftRightMinMax.length) {
                return false;
            }

            //left must be  less than right,
            //min must be less than max, each sector

            for (k = 0; k < numSectors; k++) {
                left = parseFloat(leftRightMinMax[4 * k]);
                right = parseFloat(leftRightMinMax[4 * k + 1]);
                min = parseFloat(leftRightMinMax[4 * k + 2]);
                max = parseFloat(leftRightMinMax[4 * k + 3]);
            }



            for (k = 0; k < numSectors; k++) //was k=0
            {
                //empty any points that were there from the last sector
                sectorPoints.length = 0; // sectorPoints.clear()
                pPointsOuterArc.length = 0; // pPointsOuterArc.clear()
                pPointsInnerArc.length = 0; // pPointsInnerArc.clear()

                left = parseFloat(leftRightMinMax[4 * k]);
                right = parseFloat(leftRightMinMax[4 * k + 1]);
                min = parseFloat(leftRightMinMax[4 * k + 2]);
                max = parseFloat(leftRightMinMax[4 * k + 3]);

                //get the first point of the sector inner arc
                pt1 = Geodesic.geodesic_coordinate(ptCenter, min, left);

                //get the last point of the sector inner arc
                pt2 = Geodesic.geodesic_coordinate(ptCenter, min, right);

                pPoints.length = 0; // pPoints.clear()

                pPoints.push(ptCenter);
                pPoints.push(pt1);
                pPoints.push(pt2);

                circle = Geodesic.GetGeodesicArc2(pPoints, pPointsInnerArc);

                pPoints.length = 0; // pPoints.clear()
                circle = false;

                pt1 = Geodesic.geodesic_coordinate(ptCenter, max, left);
                pt2 = Geodesic.geodesic_coordinate(ptCenter, max, right);

                pPoints.push(ptCenter);
                pPoints.push(pt1);
                pPoints.push(pt2);

                //get the geodesic min arc from left to right
                circle = Geodesic.GetGeodesicArc2(pPoints, pPointsOuterArc);

                //we now have all the points and can add them to the polygon to return
                //we will have to reverse the order of points in the outer arc
                let n: number = pPointsInnerArc.length;
                for (l = 0; l < n; l++) {
                    pt1 = new POINT2(pPointsInnerArc[l]);
                    sectorPoints.push(pt1);
                }
                n = pPointsOuterArc.length;
                //for (l = pPointsOuterArc.length - 1; l >= 0; l--)
                for (l = n - 1; l >= 0; l--) {
                    pt1 = new POINT2(pPointsOuterArc[l]);
                    sectorPoints.push(pt1);
                }

                //close the polygon
                pt1 = new POINT2(pPointsInnerArc[0]);
                pt1.style = 5;
                sectorPoints.push(pt1);
                n = sectorPoints.length;
                //for (l = 0; l < sectorPoints.length; l++)
                for (l = 0; l < n; l++) {
                    allPoints.push(sectorPoints[l]);
                }
            }

            //cleanup what we can
            pPointsInnerArc = null;
            pPointsOuterArc = null;
            ptCenter = null;

            let ptTemp: POINT2;
            let n: number = allPoints.length;
            //for (l = 0; l < allPoints.length; l++)
            for (l = 0; l < n; l++) {
                pt1 = new POINT2();
                pt1 = CPOFUtils.PointLatLongToPixels(allPoints[l], converter);
                //do not add duplicates
                if (ptTemp != null && pt1.x === ptTemp.x && pt1.y === ptTemp.y) {
                    continue;
                }
                tg.Pixels.push(new POINT2(pt1));
                ptTemp = new POINT2(pt1);
            }

            return true;
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(CPOFUtils._className, "GetSectorRangeFan",
                    exc);
            } else {
                throw exc;
            }
        }
        return circle;
    }

    private static RangeFanOrientation(tg: TacticalGraphic, lineType: number, converter: IPointConversion): void {
        try {
            let pt0: POINT2 = tg.LatLongs[0];
            let dist: number = 0;
            let orientation: number = 0;
            let radius: number = 0;
            //double[] radii = MultipointUtils.GetRadii(tg,lineType);
            let j: number = 0;
            let pt1: POINT2 = new POINT2();
            //if tg.PointCollection has more than one point
            //we use pts[1] to stuff tg.H with the orientation
            if (tg.LatLongs.length > 1) //rev B can use points
            {
                pt1 = tg.LatLongs[1];
                const geoResult = Geodesic.geodesic_distance(pt0, pt1);
                dist = geoResult.distance;
                orientation = geoResult.a12;
            } else //rev C uses H2
            {
                let strLeftRightMinMax: string = CPOFUtils.GetMaxSector(tg);
                let sector: string[] = strLeftRightMinMax.split(",");
                let left: number = parseFloat(sector[0]);
                let right: number = parseFloat(sector[1]);
                let min: number = parseFloat(sector[2]);
                let max: number = parseFloat(sector[3]);
                //we want the range to be 0 to 360
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

                if (left > right) {
                    orientation = (left - 360 + right) / 2;
                } else {
                    orientation = (left + right) / 2;
                }

                dist = max;
            }
            radius = dist * 1.1;
            let pt0F: POINT2 = new POINT2();
            let pt1F: POINT2 = new POINT2();
            let ptBaseF: POINT2 = new POINT2();
            let ptLeftF: POINT2 = new POINT2();
            let ptRightF: POINT2 = new POINT2();
            let ptTipF: POINT2 = new POINT2();

            pt0 = tg.LatLongs[0];

            pt0F = CPOFUtils.PointLatLongToPixels(pt0, converter);

            pt1 = Geodesic.geodesic_coordinate(pt0, radius, orientation);

            pt1F = CPOFUtils.PointLatLongToPixels(pt1, converter);
            dist = LineUtility.calcDistance(pt0F, pt1F);
            let base: number = 10;
            if (dist < 100) {
                base = dist / 10;
            }
            if (base < 5) {
                base = 5;
            }
            let basex2: number = 2 * base;
            ptBaseF = LineUtility.extendAlongLine(pt0F, pt1F, dist + base);   //was 10
            ptTipF = LineUtility.extendAlongLine(pt0F, pt1F, dist + basex2);  //was 20

            ptLeftF = LineUtility.ExtendDirectedLine(pt0F, ptBaseF, ptBaseF, 0, base);    //was 10
            ptRightF = LineUtility.ExtendDirectedLine(pt0F, ptBaseF, ptBaseF, 1, base);   //was 10
            //length1 = tg.Pixels.length;

            tg.Pixels.push(pt0F);
            ptTipF.style = 5;
            tg.Pixels.push(ptTipF);
            tg.Pixels.push(ptLeftF);
            ptTipF.style = 0;
            tg.Pixels.push(ptTipF);
            tg.Pixels.push(ptRightF);
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(CPOFUtils._className, "RangeFanOrientation",
                    exc);
            } else {
                throw exc;
            }
        }
    }

    /**
     * after filtering pixels it needs to reinitialize the style to 0 or it
     * causes CELineArraydotNet to build wrong shapes
     *
     * @param tg
     */
    static ClearPixelsStyle(tg: TacticalGraphic): void {
        try {
            //do not clear pixel style for the air corridors because
            //arraysupport is using linestyle for these to set the segment width         
            switch (tg.lineType) {
                case TacticalLines.BBS_AREA:
                case TacticalLines.BBS_LINE:
                case TacticalLines.BBS_RECTANGLE:
                case TacticalLines.SC:
                case TacticalLines.MRR:
                case TacticalLines.SL:
                case TacticalLines.TC:
                case TacticalLines.LLTR:
                case TacticalLines.AC:
                case TacticalLines.SAAFR:
                case TacticalLines.BS_ELLIPSE: {
                    return;
                }

                default: {
                    break;
                }


            }
            let n: number = tg.Pixels.length;
            //for(int j=0;j<tg.Pixels.length;j++)            
            for (let j: number = 0; j < n; j++) {
                tg.Pixels[j].style = 0;
            }

        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(CPOFUtils._className, "ClearPixelsStyle",
                    exc);

            } else {
                throw exc;
            }
        }
    }

    /**
     * Filters too close points after segmenting and clipping
     *
     * @param tg
     * @param converter
     */
    static FilterPoints2(tg: TacticalGraphic, converter: IPointConversion): void {
        try {
            let lineType: number = tg.lineType;
            let minSpikeDistance: number = 0;
            let segmented: boolean = true;
            if (tg.Pixels.length < 3) {
                return;
            }

            switch (lineType) {
                case TacticalLines.PL:
                case TacticalLines.FEBA:
                case TacticalLines.LOA:
                case TacticalLines.LL:
                case TacticalLines.EWL:
                case TacticalLines.FCL:
                case TacticalLines.LOD:
                case TacticalLines.LDLC:
                case TacticalLines.PLD:
                case TacticalLines.HOLD:
                case TacticalLines.HOLD_GE:
                case TacticalLines.RELEASE:
                case TacticalLines.HOL:
                case TacticalLines.BHL:
                case TacticalLines.BRDGHD:
                case TacticalLines.BRDGHD_GE:
                case TacticalLines.NFL: {
                    minSpikeDistance = arraysupport.getScaledSize(5, tg.lineThickness, tg.patternScale);
                    segmented = false;
                    break;
                }

                case TacticalLines.ATDITCH:
                case TacticalLines.ATDITCHC:
                case TacticalLines.ATDITCHM:
                case TacticalLines.FLOT:
                case TacticalLines.FORT_REVD:
                case TacticalLines.FORT:
                case TacticalLines.FORTL:
                case TacticalLines.STRONG: {
                    minSpikeDistance = arraysupport.getScaledSize(25, tg.lineThickness, tg.patternScale);
                    break;
                }

                case TacticalLines.LC:
                case TacticalLines.OBSAREA:
                case TacticalLines.OBSFAREA:
                case TacticalLines.ENCIRCLE:
                case TacticalLines.ZONE:
                case TacticalLines.LINE:
                case TacticalLines.ATWALL:
                //case TacticalLines.ATWALL3D:
                case TacticalLines.UNSP:
                case TacticalLines.SFENCE:
                case TacticalLines.DFENCE:
                case TacticalLines.DOUBLEA:
                case TacticalLines.LWFENCE:
                case TacticalLines.HWFENCE:
                case TacticalLines.SINGLEC:
                case TacticalLines.DOUBLEC:
                case TacticalLines.TRIPLE: {
                    minSpikeDistance = arraysupport.getScaledSize(35, tg.lineThickness, tg.patternScale);
                    break;
                }

                case TacticalLines.ICE_EDGE_RADAR:  //METOCs
                case TacticalLines.ICE_OPENINGS_FROZEN:
                case TacticalLines.CRACKS_SPECIFIC_LOCATION: {
                    minSpikeDistance = arraysupport.getScaledSize(35, tg.lineThickness, tg.patternScale);
                    break;
                }

                default: {
                    return;
                }

            }
            let dist: number = 0;

            let pts: Array<POINT2> = new Array();

            //stuff pts with tg.Pixels
            //loop through pts to remove any points which are too close
            //then reset tg.Pixels with the new array with boundary points removed,            
            let j: number = 0;
            let pt: POINT2;
            let pt0: POINT2;
            let pt1: POINT2;
            let n: number = tg.Pixels.length;
            //for(j=0;j<tg.Pixels.length;j++)
            for (j = 0; j < n; j++) {
                pt = tg.Pixels[j];
                pt.style = tg.Pixels[j].style;
                pts.push(pt);
            }

            let removedPt: boolean = true;
            //order of priority is: keep anchor points, then boundary points, then segmented points
            outer:
            while (removedPt === true) {
                removedPt = false;
                //n=pts.length;
                for (j = 0; j < pts.length - 1; j++) {
                    pt0 = pts[j];
                    pt1 = pts[j + 1];
                    dist = LineUtility.calcDistance(pts[j], pts[j + 1]);
                    if (dist < minSpikeDistance) {
                        if (segmented === false) {
                            if (j + 1 === pts.length - 1) {
                                pts.splice(j, 1);
                            } else {
                                pts.splice(j + 1, 1);
                            }

                            removedPt = true;
                            break outer;
                        } else if (pt0.style === 0 && pt1.style === -1)//-1 are clipped boundary points
                        {
                            pts.splice(j + 1, 1);
                            removedPt = true;
                            break outer;
                        } else if (pt0.style === 0 && pt1.style === -2)//-2 are segmented points, this should never happen
                        {
                            pts.splice(j + 1, 1);
                            removedPt = true;
                            break outer;
                        } else if (pt0.style === -1 && pt1.style === 0) {
                            pts.splice(j, 1);
                            removedPt = true;
                            break outer;
                        } else if (pt0.style === -1 && pt1.style === -1) {
                            pts.splice(j + 1, 1);
                            removedPt = true;
                            break outer;
                        } else if (pt0.style === -1 && pt1.style === -2) {
                            pts.splice(j + 1, 1);
                            removedPt = true;
                            break outer;
                        } else if (pt0.style === -2 && pt1.style === 0)//this should never happen
                        {
                            pts.splice(j, 1);
                            removedPt = true;
                            break outer;
                        } else if (pt0.style === -2 && pt1.style === -1) {
                            pts.splice(j, 1);
                            removedPt = true;
                            break outer;
                        } else if (pt0.style === -2 && pt1.style === -2) {
                            pts.splice(j + 1, 1);
                            removedPt = true;
                            break outer;
                        }
                    }
                    //n=pts.length;
                }
            }
            tg.Pixels = pts;
            tg.LatLongs = MultipointUtils.PixelsToLatLong(pts, converter);

        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(CPOFUtils._className, "FilterPoints2",
                    exc);

            } else {
                throw exc;
            }
        }
    }

    /**
     * returns true if the line type can be clipped before calculating the
     * shapes
     *
     * @param tg tactical graphic
     * @return true if can pre-clip points
     */
    public static canClipPoints(tg: TacticalGraphic): boolean {
        try {
            let symbolId: string = tg.symbolId;
            if (METOC.IsWeather(symbolId) > 0) {
                return true;
            }

            let linetype: number = tg.lineType;
            switch (linetype) {
                case TacticalLines.ABATIS:
                //                case TacticalLines.BOUNDARY:
                case TacticalLines.FLOT:
                case TacticalLines.LC:
                case TacticalLines.PL:
                case TacticalLines.FEBA:
                case TacticalLines.LL:
                case TacticalLines.EWL:
                case TacticalLines.GENERAL:
                case TacticalLines.JTAA:
                case TacticalLines.SAA:
                case TacticalLines.SGAA:
                case TacticalLines.BS_AREA:
                case TacticalLines.BS_LINE:
                case TacticalLines.ASSY:
                case TacticalLines.EA:
                case TacticalLines.FORT_REVD:
                case TacticalLines.FORT:
                case TacticalLines.DZ:
                case TacticalLines.EZ:
                case TacticalLines.LZ:
                case TacticalLines.PZ:
                case TacticalLines.LAA:
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
                case TacticalLines.WFZ_REVD:
                case TacticalLines.WFZ:
                case TacticalLines.AIRFIELD:
                case TacticalLines.BATTLE:
                case TacticalLines.PNO:
                case TacticalLines.DIRATKAIR:
                case TacticalLines.DIRATKGND:
                case TacticalLines.DIRATKSPT:
                case TacticalLines.INFILTRATION:
                case TacticalLines.FCL:
                case TacticalLines.HOLD:
                case TacticalLines.BRDGHD:
                case TacticalLines.HOLD_GE:
                case TacticalLines.BRDGHD_GE:
                case TacticalLines.LOA:
                case TacticalLines.LOD:
                case TacticalLines.LDLC:
                case TacticalLines.PLD:
                case TacticalLines.ASSAULT:
                case TacticalLines.ATKPOS:
                case TacticalLines.OBJ:
                case TacticalLines.PEN:
                case TacticalLines.RELEASE:
                case TacticalLines.HOL:
                case TacticalLines.BHL:
                case TacticalLines.AO:
                case TacticalLines.AIRHEAD:
                case TacticalLines.ENCIRCLE:
                case TacticalLines.NAI:
                case TacticalLines.TAI:
                case TacticalLines.BASE_CAMP_REVD:
                case TacticalLines.BASE_CAMP:
                case TacticalLines.GUERILLA_BASE_REVD:
                case TacticalLines.GUERILLA_BASE:
                case TacticalLines.GENERIC_AREA:
                case TacticalLines.LINE:
                case TacticalLines.ZONE:
                case TacticalLines.OBSAREA:
                case TacticalLines.OBSFAREA:
                case TacticalLines.ATDITCH:
                case TacticalLines.ATDITCHC:
                case TacticalLines.ATDITCHM:
                case TacticalLines.ATWALL:
                case TacticalLines.DEPICT:
                case TacticalLines.MINED:
                case TacticalLines.FENCED:
                case TacticalLines.UXO:
                case TacticalLines.UNSP:
                case TacticalLines.SFENCE:
                case TacticalLines.DFENCE:
                case TacticalLines.DOUBLEA:
                case TacticalLines.LWFENCE:
                case TacticalLines.HWFENCE:
                case TacticalLines.SINGLEC:
                case TacticalLines.DOUBLEC:
                case TacticalLines.TRIPLE:
                case TacticalLines.FORTL:
                case TacticalLines.STRONG:
                case TacticalLines.RAD:
                case TacticalLines.BIO:
                case TacticalLines.NUC:
                case TacticalLines.CHEM:
                case TacticalLines.DRCL:
                case TacticalLines.LINTGT:
                case TacticalLines.LINTGTS:
                case TacticalLines.FPF:
                case TacticalLines.FSCL:
                case TacticalLines.BCL_REVD:
                case TacticalLines.BCL:
                case TacticalLines.ICL:
                case TacticalLines.IFF_OFF:
                case TacticalLines.IFF_ON:
                case TacticalLines.GENERIC_LINE:
                case TacticalLines.CFL:
                case TacticalLines.TRIP:
                case TacticalLines.OVERHEAD_WIRE:
                case TacticalLines.NFL:
                case TacticalLines.MFP:
                case TacticalLines.RFL:
                case TacticalLines.AT:
                case TacticalLines.SERIES:
                case TacticalLines.STRIKWARN:
                case TacticalLines.SMOKE:
                case TacticalLines.BOMB:
                case TacticalLines.FSA:
                case TacticalLines.ACA:
                case TacticalLines.FFA:
                case TacticalLines.NFA:
                case TacticalLines.RFA:
                case TacticalLines.PAA:
                case TacticalLines.ATI:
                case TacticalLines.CFFZ:
                case TacticalLines.CFZ:
                case TacticalLines.SENSOR:
                case TacticalLines.CENSOR:
                case TacticalLines.DA:
                case TacticalLines.ZOR:
                case TacticalLines.TBA:
                case TacticalLines.TVAR:
                case TacticalLines.KILLBOXBLUE:
                case TacticalLines.KILLBOXPURPLE:
                //                case TacticalLines.MSR:
                //                case TacticalLines.ASR:
                case TacticalLines.MSR_ONEWAY:
                case TacticalLines.MSR_TWOWAY:
                case TacticalLines.MSR_ALT:
                case TacticalLines.ASR_ONEWAY:
                case TacticalLines.ASR_TWOWAY:
                case TacticalLines.ASR_ALT:
                case TacticalLines.TRAFFIC_ROUTE_ONEWAY:
                case TacticalLines.TRAFFIC_ROUTE_ALT:
                case TacticalLines.DHA_REVD:
                case TacticalLines.DHA:
                case TacticalLines.KILL_ZONE:
                case TacticalLines.EPW:
                case TacticalLines.FARP:
                case TacticalLines.RHA:
                case TacticalLines.BSA:
                case TacticalLines.DSA:
                case TacticalLines.CSA:
                case TacticalLines.RSA:
                case TacticalLines.TGMF: {
                    return true;
                }

                case TacticalLines.MSR: //post clip these so there are identical points regardless whether segment data is set 10-5-16
                case TacticalLines.ASR:
                case TacticalLines.TRAFFIC_ROUTE:
                case TacticalLines.BOUNDARY: {
                    return false;
                }

                default: {
                    return false;
                }

            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(CPOFUtils._className, "canClipPoints",
                    exc);
            } else {
                throw exc;
            }
        }
        return false;
    }

    /**
     * These get clipped so the fill must be treated as a separate shape.
     * Normally lines with fill do not have a separate shape for the fill.
     *
     * @param linetype
     * @return
     */
    static LinesWithSeparateFill(linetype: number, shapes: Array<Shape2>): boolean {
        if (shapes == null) {
            return false;
        }

        switch (linetype) {
            case TacticalLines.MSDZ: {
                return true;
            }

            //treat these as lines: because of the feint they need an extra shape for the fill
            case TacticalLines.OBSFAREA:
            case TacticalLines.OBSAREA:
            case TacticalLines.STRONG:
            case TacticalLines.ZONE:
            case TacticalLines.FORT_REVD:
            case TacticalLines.FORT:
            case TacticalLines.ENCIRCLE:
            //return true;
            case TacticalLines.FIX:
            case TacticalLines.BOUNDARY:
            case TacticalLines.FLOT:
            case TacticalLines.LC:
            case TacticalLines.PL:
            case TacticalLines.FEBA:
            case TacticalLines.LL:
            case TacticalLines.EWL:
            case TacticalLines.AC:
            case TacticalLines.MRR:
            case TacticalLines.SL:
            case TacticalLines.TC:
            case TacticalLines.SAAFR:
            case TacticalLines.SC:
            case TacticalLines.LLTR:
            case TacticalLines.DIRATKAIR:
            case TacticalLines.DIRATKGND:
            case TacticalLines.DIRATKSPT:
            case TacticalLines.INFILTRATION:
            case TacticalLines.FCL:
            case TacticalLines.HOLD:
            case TacticalLines.BRDGHD:
            case TacticalLines.HOLD_GE:
            case TacticalLines.BRDGHD_GE:
            case TacticalLines.LOA:
            case TacticalLines.LOD:
            case TacticalLines.LDLC:
            case TacticalLines.PLD:
            case TacticalLines.RELEASE:
            case TacticalLines.HOL:
            case TacticalLines.BHL:
            case TacticalLines.LINE:
            case TacticalLines.ABATIS:
            case TacticalLines.ATDITCH:
            case TacticalLines.ATDITCHC:
            case TacticalLines.ATDITCHM:
            case TacticalLines.ATWALL:
            case TacticalLines.MNFLDFIX:
            case TacticalLines.UNSP:
            case TacticalLines.SFENCE:
            case TacticalLines.DFENCE:
            case TacticalLines.DOUBLEA:
            case TacticalLines.LWFENCE:
            case TacticalLines.HWFENCE:
            case TacticalLines.SINGLEC:
            case TacticalLines.DOUBLEC:
            case TacticalLines.TRIPLE:
            case TacticalLines.FORTL:
            case TacticalLines.LINTGT:
            case TacticalLines.LINTGTS:
            case TacticalLines.FSCL:
            case TacticalLines.BCL_REVD:
            case TacticalLines.BCL:
            case TacticalLines.ICL:
            case TacticalLines.IFF_OFF:
            case TacticalLines.IFF_ON:
            case TacticalLines.GENERIC_LINE:
            case TacticalLines.CFL:
            case TacticalLines.TRIP:
            case TacticalLines.NFL:
            case TacticalLines.MFP:
            case TacticalLines.RFL:
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
            case TacticalLines.TRAFFIC_ROUTE_ALT: {
                //undo any fill
                let shape: Shape2;
                if (shapes != null && shapes.length > 0) {
                    let n: number = shapes.length;
                    //for(int j=0;j<shapes.length;j++)
                    for (let j: number = 0; j < n; j++) {
                        shape = shapes[j];
                        if (shape.getShapeType() === Shape2.SHAPE_TYPE_POLYLINE) {
                            shapes[j].setFillColor(null);
                        }
                    }
                }
                return true;
            }

            default: {
                return false;
            }


        }
    }

    /**
     * uses a hash map to set the POINT2 style when creating tg.Pixels from
     * Point2D ArrayList
     *
     * @param pts2d
     * @param hashMap
     * @return
     */
    static Point2DtoPOINT2Mapped(pts2d: Array<Point2D>, hashMap: Map<string, Point2D>): Array<POINT2> {
        let pts: Array<POINT2> = new Array();
        try {
            let pt2d: Point2D;
            let style: number = 0;
            let n: number = pts2d.length;
            //for(int j=0;j<pts2d.length;j++)
            for (let j: number = 0; j < n; j++) {
                pt2d = pts2d[j];
                //the hash map contains the original tg.Pixels before clipping
                if (Array.from(hashMap.values()).includes(pt2d)) {
                    style = 0;
                } else {
                    style = -1;   //style set to -1 identifies it as a clip bounds point
                }
                pts.push(new POINT2(pts2d[j].getX(), pts2d[j].getY(), style));
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(CPOFUtils._className, "Point2DToPOINT2Mapped",
                    exc);
            } else {
                throw exc;
            }
        }
        return pts;
    }

    protected static Point2DtoPOINT2(pts2d: Array<Point2D>): Array<POINT2> {
        let pts: Array<POINT2> = new Array();
        try {
            let n: number = pts2d.length;
            //for(int j=0;j<pts2d.length;j++)
            for (let j: number = 0; j < n; j++) {
                pts.push(new POINT2(pts2d[j].getX(), pts2d[j].getY()));
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(CPOFUtils._className, "Point2DToPOINT2",
                    exc);
            } else {
                throw exc;
            }
        }
        return pts;
    }

    static POINT2toPoint2D(pts: Array<POINT2>): Array<Point2D> {
        let pts2d: Array<Point2D> = new Array();
        try {
            let n: number = pts.length;
            //for(int j=0;j<pts.length;j++)
            for (let j: number = 0; j < n; j++) {
                pts2d.push(new Point2D(pts[j].x, pts[j].y));;
            }

        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(CPOFUtils._className, "POINT2toPoint2D",
                    exc);
            } else {
                throw exc;
            }
        }
        return pts2d;
    }

    /**
     * Builds a single shape from a point array. Currently we assume the array
     * represents a moveTo followed by a series of lineTo operations
     *
     * @param pts2d
     * @return
     */
    private static BuildShapeFromPoints(pts2d: Array<Point2D>): Shape {
        let shape: GeneralPath = new GeneralPath();
        try {
            shape.moveTo(pts2d[0].getX(), pts2d[0].getY());
            let n: number = pts2d.length;
            //for(int j=1;j<pts2d.length;j++)
            for (let j: number = 1; j < n; j++) {
                shape.lineTo(pts2d[j].getX(), pts2d[j].getY());
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(CPOFUtils._className, "buildShapeFromPoints",
                    exc);

            } else {
                throw exc;
            }
        }
        return shape;
    }

    /**
     * Clips a ShapeSpec. Assumes we are not post clipping splines, therefore
     * all the operations are moveTo, lineTo. Each ShapeSpec is assumed to be:
     * moveTo, lineTo ... lineTo, followed by another moveTo, lineTo, ...
     * lineTo, followed by ...
     *
     * @param shapeSpec
     * @param pts
     * @param clipArea
     * @return a single clipped shapeSpec
     */
    protected static buildShapeSpecFromPoints(tg0: TacticalGraphic,
        shapeSpec: Shape2, //the original ShapeSpec
        pts: Array<POINT2>,
        clipArea: Rectangle | Rectangle2D | Array<Point2D>): Array<Shape2> {
        let shapeSpecs2: Array<Shape2>;
        let shapeSpec2: Shape2;
        try {
            //create a tg to use for the clip
            shapeSpecs2 = new Array();
            let j: number = 0;
            let n: number = 0;
            //return null if it is outside the bounds
            let rect: Rectangle = shapeSpec.getBounds();
            let h: number = shapeSpec.getBounds().height;
            let w: number = shapeSpec.getBounds().width;
            let x: number = shapeSpec.getBounds().x;
            let y: number = shapeSpec.getBounds().y;
            //            if(h==0 && w==0)
            //                return shapeSpecs2;

            if (h === 0) {
                h = 1;
            }
            if (w === 0) {
                w = 1;
            }

            let clipBounds: Rectangle2D;
            let clipPoints: Array<Point2D>;
            if (clipArea != null && clipArea instanceof Rectangle2D) {
                clipBounds = clipArea as Rectangle2D;
            } else if (clipArea != null && clipArea instanceof Rectangle) {
                //clipBounds=(Rectangle2D)clipArea;
                let rectx: Rectangle = clipArea as Rectangle;
                clipBounds = new Rectangle2D(rectx.x, rectx.y, rectx.width, rectx.height);
            } else if (clipArea != null && clipArea instanceof Array) {
                clipPoints = clipArea as Array<Point2D>;
            }

            if (clipBounds != null && clipBounds.contains(shapeSpec.getShape().getBounds2D()) === false
                && clipBounds.intersects(shapeSpec.getShape().getBounds2D()) === false) {
                //this tests if the shape has height or width 0
                //but may be contained within the clipbounds or intersect it
                //in that case we gave it a default width or thickness of 1
                if (clipBounds.contains(x, y, w, h) === false
                    && clipBounds.intersects(x, y, w, h) === false) {
                    return shapeSpecs2;
                }
            } else {
                if (clipPoints != null) {
                    let poly: GeneralPath = new GeneralPath();
                    n = clipPoints.length;
                    //for(j=0;j<clipPoints.length;j++)
                    for (j = 0; j < n; j++) {
                        if (j === 0) {
                            poly.moveTo(clipPoints[j].getX(), clipPoints[j].getY());
                        } else {
                            poly.lineTo(clipPoints[j].getX(), clipPoints[j].getY());
                        }
                    }
                    poly.closePath();
                    if (poly.contains(shapeSpec.getShape().getBounds2D()) === false
                        && poly.intersects(shapeSpec.getShape().getBounds2D()) === false) {
                        if (poly.contains(x, y, w, h) === false
                            && poly.intersects(x, y, w, h) === false) {
                            return shapeSpecs2;
                        }
                    }
                }
            }


            if (shapeSpec.getShapeType() === Shape2.SHAPE_TYPE_MODIFIER
                || shapeSpec.getShapeType() === Shape2.SHAPE_TYPE_MODIFIER_FILL) {
                shapeSpecs2.push(shapeSpec);
                return shapeSpecs2;
            }
            let tg: TacticalGraphic = new TacticalGraphic();
            let pt: POINT2;
            tg.lineType = TacticalLines.PL;
            let pts2: Array<POINT2> = new Array();
            let pts2d: Array<Point2D>;
            let shape: Shape;
            let gp: GeneralPath = new GeneralPath();
            //loop through the points
            n = pts.length;
            //for(j=0;j<pts.length;j++)
            for (j = 0; j < n; j++) {
                pt = pts[j];
                //new line
                switch (pt.style) {
                    case 0: { //moveTo,
                        //they lifted the pencil, so we build the shape from the existing pts and append it
                        if (pts2.length > 1) {
                            //clip the points
                            tg = new TacticalGraphic();
                            tg.lineType = TacticalLines.PL;
                            tg.Pixels = pts2;
                            if (clipBounds != null) {
                                pts2d = ClipPolygon.ClipPolygon(tg, clipBounds);
                            } else {
                                if (clipPoints != null && clipPoints.length > 0) {
                                    pts2d = ClipQuad.ClipPolygon(tg, clipPoints);
                                }
                            }


                            //build a GeneralPath from the points we collected, we will append it
                            if (pts2d != null && pts2d.length > 1) {
                                shape = CPOFUtils.BuildShapeFromPoints(pts2d);
                                //append the shape because we want to return only one shape
                                gp.append(shape, false);
                            }
                            //clear the points array and begin the next line
                            pts2.length = 0; // pts2.clear()
                            pts2.push(pt);
                        } else {
                            pts2.push(pt);
                        }
                        break;
                    }

                    case 1: { //lineTo
                        pts2.push(pt);
                        break;
                    }

                    default: {
                        pts2.push(pt);
                        break;
                    }

                }
            }//end for
            //append the last shape
            if (pts2.length > 1) {
                //clip the points
                tg = new TacticalGraphic();
                tg.lineType = TacticalLines.PL;
                tg.Pixels = pts2;
                if (clipBounds != null) {
                    pts2d = ClipPolygon.ClipPolygon(tg, clipBounds);
                } else {
                    if (clipPoints != null) {
                        pts2d = ClipQuad.ClipPolygon(tg, clipPoints);
                    }
                }

                //build a GeneralPath from the points we collected, we will append it
                if (pts2d != null && pts2d.length > 1) {
                    shape = CPOFUtils.BuildShapeFromPoints(pts2d);
                    gp.append(shape, false);
                }
                tg0.wasClipped = tg.wasClipped;
            }
            //create the shapespec here
            //initialize the clipped ShapeSpec
            shapeSpec2 = new Shape2(shapeSpec.getShapeType());
            shapeSpec2.setLineColor(shapeSpec.getLineColor());
            shapeSpec2.setFillColor(shapeSpec.getFillColor());
            shapeSpec2.setStroke(shapeSpec.getStroke());
            shapeSpec2.setTexturePaint(shapeSpec.getTexturePaint());
            shapeSpec2.setShape(gp);
            shapeSpecs2.push(shapeSpec2);
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(CPOFUtils._className, "buildShapeSpecFromPoints",
                    exc);

            } else {
                throw exc;
            }
        }
        return shapeSpecs2;
    }

    /**
     * Currently assumes no MeTOC symbols are post clipped
     *
     * @param tg
     * @param shapeSpecsArray
     * @param clipArea
     * @return
     */
    static postClipShapes(tg: TacticalGraphic, shapeSpecsArray: Array<Shape2>, clipArea: Point2D[] | Rectangle | Rectangle2D): Array<Shape2> | null {
        let shapeSpecs2: Array<Shape2>;
        let tempShapes: Array<Shape2>;
        try {
            if (shapeSpecsArray == null || shapeSpecsArray.length === 0) {
                return null;
            }

            shapeSpecs2 = new Array();
            let j: number = 0;
            let shapeSpecs: Array<Shape2> = new Array();
            let n: number = shapeSpecsArray.length;
            //for(j=0;j<shapeSpecsArray.length;j++)
            for (j = 0; j < n; j++) {
                shapeSpecs.push(shapeSpecsArray[j]);;
            }

            let pts: Array<POINT2> = new Array();//use these
            let shape: Shape;
            let pt: POINT2;
            let coords: number[] = new Array<number>(6);
            let shapeSpec: Shape2;
            n = shapeSpecs.length;
            //for(j=0;j<shapeSpecs.length;j++)
            for (j = 0; j < n; j++) {
                shapeSpec = shapeSpecs[j];
                shape = shapeSpec.getShape();
                pts.length = 0; // pts.clear()
                for (let i: PathIterator = shape.getPathIterator(null); !i.isDone(); i.next()) {
                    let type: number = i.currentSegment(coords);
                    switch (type) {
                        case PathIterator.SEG_MOVETO: {
                            pt = new POINT2(coords[0], coords[1]);
                            pt.style = 0;
                            pts.push(pt);
                            break;
                        }

                        case PathIterator.SEG_LINETO: {
                            pt = new POINT2(coords[0], coords[1]);
                            pt.style = 1;
                            pts.push(pt);
                            break;
                        }

                        case PathIterator.SEG_QUADTO: {   //not using this
                            pt = new POINT2(coords[0], coords[1]);
                            pt.style = 2;
                            pts.push(pt);
                            pt = new POINT2(coords[2], coords[3]);
                            pt.style = 2;
                            pts.push(pt);
                            break;
                        }

                        case PathIterator.SEG_CUBICTO: {  //not using this
                            pt = new POINT2(coords[0], coords[1]);
                            pt.style = 3;
                            pts.push(pt);
                            pt = new POINT2(coords[2], coords[3]);
                            pt.style = 3;
                            pts.push(pt);
                            pt = new POINT2(coords[4], coords[5]);
                            pt.style = 3;
                            pts.push(pt);
                            break;
                        }

                        case PathIterator.SEG_CLOSE: {//not using this
                            pt = new POINT2(coords[0], coords[1]);
                            pt.style = 4;
                            pts.push(pt);
                            break;
                        }

                        default: {
                            pt = null;
                            break;
                        }

                    }//end switch
                }   //end for pathiterator i
                tempShapes = CPOFUtils.buildShapeSpecFromPoints(tg, shapeSpec, pts, clipArea);
                shapeSpecs2.push(...tempShapes);
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(CPOFUtils._className, "postClipShapes",
                    exc);
            } else {
                throw exc;
            }
        }
        return shapeSpecs2;
    }

    /**
     * For the 3d map we cannot pre-segment the auto-shapes or fire support
     * areas. We do need to pre-segment generic lines regardless of the status
     * if clipping is set. Currently we are not pre-segmenting axis of advance
     * symbols.
     *
     * @param tg
     * @return true if pre-segmenting is to be used
     */
    private static segmentAnticipatedLine(tg: TacticalGraphic): boolean {
        try {
            let linetype: number = tg.lineType;
            //do not pre-segment the fire support rectangular and circular areas
            if (clsUtilityJTR.IsChange1Area(linetype)) {
                return false;
            }
            //do not pre-segment the autoshapes
            if (clsUtilityJTR.isAutoshape(tg)) {
                return false;
            }
            if (SymbolUtilities.isBasicShape(linetype)) {
                return false;
            }
            //temporarily do not pre-segment the channel types.
            switch (linetype) {
                case TacticalLines.OVERHEAD_WIRE:
                case TacticalLines.CATK:
                case TacticalLines.CATKBYFIRE:
                case TacticalLines.MAIN:
                case TacticalLines.SPT:
                case TacticalLines.FRONTAL_ATTACK:
                case TacticalLines.TURNING_MOVEMENT:
                case TacticalLines.MOVEMENT_TO_CONTACT:
                case TacticalLines.AIRAOA:
                case TacticalLines.AAAAA: {
                    return false;
                }

                case TacticalLines.MSR_ONEWAY:
                case TacticalLines.MSR_TWOWAY:
                case TacticalLines.MSR_ALT:
                case TacticalLines.ASR_ONEWAY:
                case TacticalLines.ASR_TWOWAY:
                case TacticalLines.ASR_ALT:
                case TacticalLines.TRAFFIC_ROUTE_ONEWAY:
                case TacticalLines.TRAFFIC_ROUTE_ALT: {
                    //added because of segment data 4-22-13
                    //removed from this case block since we now post-clip these because of segment color data 10-5-16
                    //                case TacticalLines.MSR:
                    //                case TacticalLines.ASR:
                    //                case TacticalLines.BOUNDARY:
                    return false;
                }

                default: {
                    break;
                }

            }

        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(CPOFUtils._className, "segmentGenericLine",
                    exc);
            } else {
                throw exc;
            }
        }
        return true;
    }

    /**
     * cannot pre-segment the fire support areas, must post segment them after
     * the pixels were calculated
     *
     * @param tg
     * @param converter
     */
    protected static postSegmentFSA(tg: TacticalGraphic,
        converter: IPointConversion): void {
        try {
            if (tg.client === "2D") {
                return;
            }

            let linetype: number = tg.lineType;
            switch (linetype) {
                case TacticalLines.PAA_RECTANGULAR:
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
                    return;
                }

            }
            let latLongs: Array<POINT2> = new Array();
            let resultPts: Array<POINT2> = new Array();
            let j: number = 0;
            let k: number = 0;
            let n: number = 0;
            let pt0: POINT2;
            let pt1: POINT2;
            let pt: POINT2;
            let dist: number = 0;
            //double interval=1000000;
            let interval: number = 250000;
            let az: number = 0;

            let maxDist: number = 0;
            let pt2d: Point2D;
            let t: number = tg.Pixels.length;
            //for(j=0;j<tg.Pixels.length;j++)
            for (j = 0; j < t; j++) {
                pt0 = tg.Pixels[j];
                pt2d = new Point2D(pt0.x, pt0.y);
                pt2d = converter.PixelsToGeo(pt2d);
                pt0 = new POINT2(pt2d.getX(), pt2d.getY());
                latLongs.push(pt0);
            }
            t = latLongs.length;
            //for(j=0;j<latLongs.length-1;j++)
            for (j = 0; j < t - 1; j++) {
                pt0 = latLongs[j];
                pt1 = latLongs[j + 1];
                pt1.style = -1;//end point
                az = Geodesic.GetAzimuth(pt0, pt1);
                dist = Geodesic.geodesic_distance(latLongs[j], latLongs[j + 1]).distance;
                if (dist > maxDist) {
                    maxDist = dist;
                }
            }

            if (interval > maxDist) {
                interval = maxDist;
            }

            //for(j=0;j<latLongs.length-1;j++)
            for (j = 0; j < t - 1; j++) {
                pt0 = new POINT2(latLongs[j]);
                pt0.style = 0;//anchor point
                pt1 = new POINT2(latLongs[j + 1]);
                pt1.style = 0;//anchor point point
                az = Geodesic.GetAzimuth(pt0, pt1);
                dist = Geodesic.geodesic_distance(latLongs[j], latLongs[j + 1]).distance;

                n = Math.trunc(dist / interval);
                if (j === 0) {
                    resultPts.push(pt0);
                }

                for (k = 1; k <= n; k++) {
                    pt = Geodesic.geodesic_coordinate(pt0, interval * k, az);
                    pt.style = -2;
                    //we do not want the last segment to be too close to the anchor point
                    //only add the segment point if it is a distance at least half the inteval
                    //from the 2nd anchor point
                    dist = Geodesic.geodesic_distance(pt, pt1).distance;
                    if (dist >= interval / 2) {
                        resultPts.push(pt);
                    }
                }
                //ad the 2nd anchor point
                resultPts.push(pt1);
            }
            latLongs = resultPts;
            tg.Pixels = MultipointUtils.LatLongToPixels(latLongs, converter);
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(CPOFUtils._className, "postSegmentFSA",
                    exc);
            } else {
                throw exc;
            }
        }
    }

    /**
     * Similar to Vincenty algorithm for more accurate interpolation of geo
     * anchor points
     *
     * @return the interpolated points
     */
    private static toGeodesic(tg: TacticalGraphic, interval: number, hmap: Map<number, string>): Array<POINT2> | null {
        let locs: Array<POINT2> = new Array<POINT2>();
        try {
            let i: number = 0;
            let k: number = 0;
            let n: number = 0;
            let points: Array<POINT2> = tg.LatLongs;
            let H: string = "";
            let color: string = "";
            let bolIsAC: boolean = false;
            let acWidth: number = 0;
            let linetype: number = tg.lineType;
            switch (linetype) {
                case TacticalLines.AC:
                case TacticalLines.LLTR:
                case TacticalLines.MRR:
                case TacticalLines.SL:
                case TacticalLines.SAAFR:
                case TacticalLines.TC:
                case TacticalLines.SC: {
                    bolIsAC = true;
                    break;
                }

                default: {
                    break;
                }

            }
            for (i = 0; i < points.length - 1; i++) {
                if (bolIsAC) {

                    acWidth = points[i].style;
                }

                // Convert coordinates from degrees to Radians
                //var lat1 = points[i].latitude * (PI / 180);
                //var lon1 = points[i].longitude * (PI / 180);
                //var lat2 = points[i + 1].latitude * (PI / 180);
                //var lon2 = points[i + 1].longitude * (PI / 180);                
                let lat1: number = points[i].y * Math.PI / 180.0;
                let lon1: number = points[i].x * Math.PI / 180.0;
                let lat2: number = points[i + 1].y * Math.PI / 180.0;
                let lon2: number = points[i + 1].x * Math.PI / 180.0;
                // Calculate the total extent of the route
                //var d = 2 * asin(sqrt(pow((sin((lat1 - lat2) / 2)), 2) + cos(lat1) * cos(lat2) * pow((sin((lon1 - lon2) / 2)), 2)));
                let d: number = 2 * Math.asin(Math.sqrt(Math.pow((Math.sin((lat1 - lat2) / 2)), 2) + Math.cos(lat1) * Math.cos(lat2) * Math.pow((Math.sin((lon1 - lon2) / 2)), 2)));

                let dist: number = Geodesic.geodesic_distance(points[i], points[i + 1]).distance;
                //double dist=d;
                let flt: number = dist / interval;
                n = Math.round(flt);
                if (n < 1) {
                    n = 1;
                }
                if (n > 32) {
                    n = 32;
                }
                // Calculate  positions at fixed intervals along the route
                for (k = 0; k <= n; k++) {
                    //we must preserve the anchor points
                    if (k === 0) {
                        locs.push(new POINT2(points[i]));
                        if (hmap != null && hmap.has(i)) {
                            if (H.length > 0) {
                                H += ",";
                            }
                            color = String(hmap.get(i));
                            H += (locs.length - 1).toString() + ":" + color;
                        }
                        continue;
                    } else {
                        if (k === n) {
                            if (i === points.length - 2) {
                                locs.push(new POINT2(points[i + 1]));
                                if (hmap != null && hmap.has(i + 1)) {
                                    if (H.length > 0) {
                                        H += ",";
                                    }
                                    color = String(hmap.get(i + 1));
                                    H += (locs.length - 1).toString() + ":" + color;
                                }
                            }
                            break;
                        }
                    }

                    //var f = (k / n);
                    //var A = sin((1 - f) * d) / sin(d);
                    //var B = sin(f * d) / sin(d);
                    let f: number = (k as number / n as number);
                    let A: number = Math.sin((1 - f) * d) / Math.sin(d);
                    let B: number = Math.sin(f * d) / Math.sin(d);
                    // Obtain 3D Cartesian coordinates of each point
                    //var x = A * cos(lat1) * cos(lon1) + B * cos(lat2) * cos(lon2);
                    //var y = A * cos(lat1) * sin(lon1) + B * cos(lat2) * sin(lon2);
                    //var z = A * sin(lat1) + B * sin(lat2);
                    let x: number = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
                    let y: number = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
                    let z: number = A * Math.sin(lat1) + B * Math.sin(lat2);
                    // Convert these to latitude/longitude
                    //var lat = atan2(z, sqrt(pow(x, 2) + pow(y, 2)));
                    //var lon = atan2(y, x);
                    let lat: number = Math.atan2(z, Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2)));
                    let lon: number = Math.atan2(y, x);
                    lat *= 180.0 / Math.PI;
                    lon *= 180.0 / Math.PI;
                    let pt: POINT2 = new POINT2(lon, lat);
                    if (bolIsAC) {

                        pt.style = -acWidth;
                    }

                    locs.push(pt);
                    if (hmap != null && hmap.has(i)) {
                        if (H.length > 0) {
                            H += ",";
                        }
                        color = String(hmap.get(i));
                        H += (locs.length - 1).toString() + ":" + color;
                    }
                }
            }
            if (H.length > 0) {
                tg.h = H;
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(CPOFUtils._className, "toGeodesic",
                    exc);
                return null;
            } else {
                throw exc;
            }
        }
        return locs;
    }

    /**
     * Pre-segment the lines based on max or min latitude for the segment
     * interval. This is necessary because GeoPixelconversion does not work well
     * over distance greater than 1M meters, especially at extreme latitudes.
     *
     * @param tg
     * @param converter
     */
    static SegmentGeoPoints(tg: TacticalGraphic,
        converter: IPointConversion,
        zoomFactor: number): void {
        try {
            if (tg.client === "2D") {
                return;
            }

            let resultPts: Array<POINT2> = new Array();
            let lineType: number = tg.lineType;
            //double interval=1000000;
            let interval: number = 250000;
            let bolSegmentAC: boolean = false;
            let bolIsAC: boolean = false;
            bolSegmentAC = true;
            //conservative interval in meters
            //return early for those lines not requiring pre-segmenting geo points
            switch (lineType) {
                case TacticalLines.AC:
                case TacticalLines.LLTR:
                case TacticalLines.MRR:
                case TacticalLines.SL:
                case TacticalLines.SAAFR:
                case TacticalLines.TC:
                case TacticalLines.SC: {
                    if (!bolSegmentAC) {
                        return;
                    }
                    bolIsAC = true;
                    break;
                }

                case TacticalLines.PLD:
                case TacticalLines.CFL:
                case TacticalLines.UNSP:
                case TacticalLines.TRIPLE:
                case TacticalLines.DOUBLEC:
                case TacticalLines.SINGLEC:
                case TacticalLines.ATDITCH:
                case TacticalLines.ATDITCHC:
                case TacticalLines.ATDITCHM:
                case TacticalLines.ATWALL:
                case TacticalLines.LINE:
                case TacticalLines.DIRATKAIR:
                case TacticalLines.STRONG:
                case TacticalLines.ENCIRCLE:
                case TacticalLines.FLOT:
                case TacticalLines.ZONE:
                case TacticalLines.OBSAREA:
                case TacticalLines.OBSFAREA:
                case TacticalLines.FORT_REVD:
                case TacticalLines.FORT:
                case TacticalLines.FORTL: {
                    break;
                }

                case TacticalLines.HWFENCE:
                case TacticalLines.LWFENCE:
                case TacticalLines.DOUBLEA:
                case TacticalLines.DFENCE:
                case TacticalLines.SFENCE: {
                    interval = 500000;
                    break;
                }

                case TacticalLines.LC: {
                    interval = 2000000;
                    break;
                }

                default: {
                    //if the line is an anticipated generic line then segment the line
                    if (CPOFUtils.segmentAnticipatedLine(tg)) {
                        break;
                    }
                    return;
                }

            }

            let j: number = 0;
            let k: number = 0;
            let n: number = 0;
            let pt0: POINT2;
            let pt1: POINT2;
            let pt: POINT2;
            let dist: number = 0;
            let az: number = 0;

            let maxDist: number = 0;
            let t: number = tg.LatLongs.length;
            //for(j=0;j<tg.LatLongs.length-1;j++)
            for (j = 0; j < t - 1; j++) {
                pt0 = tg.LatLongs[j];
                pt1 = tg.LatLongs[j + 1];
                if (!bolIsAC) {

                    pt1.style = -1;
                }
                //end point
                az = Geodesic.GetAzimuth(pt0, pt1);
                dist = Geodesic.geodesic_distance(tg.LatLongs[j], tg.LatLongs[j + 1]).distance;
                if (dist > maxDist) {
                    maxDist = dist;
                }
            }

            if (interval > maxDist) {
                interval = maxDist;
            }

            if (zoomFactor > 0 && zoomFactor < 0.01) {
                zoomFactor = 0.01;
            }
            if (zoomFactor > 0 && zoomFactor < 1) {
                interval *= zoomFactor;
            }

            let useVincenty: boolean = false;
            let H: string = "";
            let color: string = "";
            let hmap: Map<number, string> = clsUtilityJTR.getMSRSegmentColorStrings(tg);
            if (hmap != null) {
                tg.h = "";
            }
            //uncomment one line to use (similar to) Vincenty algorithm
            useVincenty = true;
            if (useVincenty) {
                resultPts = CPOFUtils.toGeodesic(tg, interval, hmap);
                tg.LatLongs = resultPts;
                tg.Pixels = MultipointUtils.LatLongToPixels(tg.LatLongs, converter);
                return;
            }

            for (j = 0; j < tg.LatLongs.length - 1; j++) {
                pt0 = new POINT2(tg.LatLongs[j]);
                pt0.style = 0;//anchor point
                pt1 = new POINT2(tg.LatLongs[j + 1]);
                pt1.style = 0;//anchor point point
                az = Geodesic.GetAzimuth(pt0, pt1);
                dist = Geodesic.geodesic_distance(tg.LatLongs[j], tg.LatLongs[j + 1]).distance;

                n = Math.trunc(dist / interval);
                if (j === 0) {
                    resultPts.push(pt0);
                    if (hmap != null && hmap.has(j)) {
                        if (H.length > 0) {
                            H += ",";
                        }
                        color = String(hmap.get(j));
                        //H+=(resultPts.length-1).toString()+":"+color;
                        H += (resultPts.length - 1).toString() + ":" + color;
                    }
                }
                for (k = 1; k <= n; k++) {
                    pt = Geodesic.geodesic_coordinate(pt0, interval * k, az);
                    pt.style = -2;
                    //we do not want the last segment to be too close to the anchor point
                    //only add the segment point if it is a distance at least half the inteval
                    //from the 2nd anchor point
                    dist = Geodesic.geodesic_distance(pt, pt1).distance;
                    if (dist >= interval / 2) {
                        resultPts.push(pt);
                        if (hmap != null && hmap.has(j)) {
                            color = String(hmap.get(j));
                            if (H.length > 0) {
                                H += ",";
                            }
                            //H+=(resultPts.length-1).toString()+":"+color;
                            H += (resultPts.length - 1).toString() + ":" + color;
                        }
                    }
                }
                //ad the 2nd anchor point
                resultPts.push(pt1);
                if (hmap != null && hmap.has(j + 1)) {
                    if (H.length > 0) {
                        H += ",";
                    }
                    color = String(hmap.get(j + 1));
                    //H+=(resultPts.length-1).toString()+":"+color;
                    H += (resultPts.length - 1).toString() + ":" + color;
                }
            }
            if (H.length > 0) {
                tg.h = H;
            }
            tg.LatLongs = resultPts;
            tg.Pixels = MultipointUtils.LatLongToPixels(tg.LatLongs, converter);
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(CPOFUtils._className, "SegmentGeoPoints",
                    exc);
            } else {
                throw exc;
            }
        }
    }

    /**
     * Calculating the signed area will tell you which direction the points are going.  
     * Negative = Clock-wise, Positive = counter clock-wise
     * A = 1/2 * (x1*y2 - x2*y1 + x2*y3 - x3*y2 + ... + xn*y1 - x1*yn)
     */
    static CalculateSignedAreaOfPolygon(coords: POINT2[]): number {
        var signedArea = 0;
        const len = coords.length;
        for (var i = 0; i < len; i++) {
            const x1 = coords[i].getX();
            const y1 = coords[i].getY();
            const x2 = coords[(i + 1) % len].getX();
            const y2 = coords[(i + 1) % len].getY();
            signedArea += (x1 * y2 - x2 * y1);
        }
        return signedArea / 2;
    }
}
