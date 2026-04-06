import { type long } from "../graphics/BasicTypes";

import { GeneralPath } from "../graphics/GeneralPath"
import { PathIterator } from "../graphics/PathIterator"
import { Point } from "../graphics/Point"
import { Point2D } from "../graphics/Point2D"
import { Shape } from "../graphics/Shape"
import { arraysupport } from "../generators/line-generator"
import { POINT2 } from "../types/point"

import { Shape2 } from "../generators/shape2"
import { TacticalLines } from "../types/enums"
import { Geodesic } from "./geodesic"
import { TacticalGraphic } from "../tactical/tactical-graphic"
import { ErrorLogger } from "../renderer/utilities/ErrorLogger"
import { IPointConversion } from "../renderer/utilities/IPointConversion"
import { IPathIterator } from "../graphics/IPathIterator";


/**
 * A class to provide the utility functions required for calculating the line
 * points.
 *
 *
 */
export class LineUtility {

    private static readonly _className: string = "LineUtility";
    public static readonly extend_left: number = 0;
    public static readonly extend_right: number = 1;
    public static readonly extend_above: number = 2;
    public static readonly extend_below: number = 3;

    /**
     * Resizes the array to the length speicifed, called by the Channels class.
     *
     * @param pLinePoints the array to resize
     * @param length the length to which to resize the array.
     * @return the resized array
     */
    static ResizeArray(pLinePoints: POINT2[], length: number): POINT2[] {
        let array: POINT2[] = new Array<POINT2>(length);
        try {
            if (pLinePoints.length <= length) {
                return pLinePoints;
            }

            let j: number = 0;
            for (j = 0; j < length; j++) {
                array[j] = new POINT2(pLinePoints[j]);
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "ResizeArray",
                    exc);
            } else {
                throw exc;
            }
        }
        return array;
    }

    /**
     * post-segments a line segment into 50 pixel intervals
     *
     * @param pt0
     * @param pt1
     * @param shape
     */
    protected static SegmentLineShape(pt0: POINT2, pt1: POINT2, shape: Shape2): void {
        try {
            if (pt0 == null || pt1 == null) {
                return;
            }

            let j: number = 0;
            let n: number = 0;
            let dist: number = LineUtility.calcDistance(pt0, pt1);
            n = Math.trunc(dist / 25);
            let pt: POINT2;
            shape.lineTo(pt0);
            for (j = 1; j <= n; j++) {
                pt = LineUtility.extendAlongLine(pt0, pt1, 25);
                shape.lineTo(pt);
            }
            shape.lineTo(pt1);
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "SegmentLineShape",
                    exc);
            } else {
                throw exc;
            }
        }
    }

    /**
     * Calculates the middle segment for the Direction of Attack Aviation symbol
     *
     * @param pLinePoints the point array
     * @param vblSaveCounter the size of the point array
     * @return the middle segment
     */
    public static GetDirAtkAirMiddleSegment(pLinePoints: POINT2[],
        vblSaveCounter: number): number {
        let middleSegment: number = -1;
        try {
            let d: number = 0;
            let k: number = 0;
            for (k = vblSaveCounter - 1; k > 0; k--) {
                d += LineUtility.calcDistance(pLinePoints[k], pLinePoints[k - 1]);
                if (d > 60) {
                    break;
                }
            }
            if (d > 60) {
                middleSegment = k;
            } else {
                if (vblSaveCounter <= 3) {
                    middleSegment = 1;
                } else {
                    middleSegment = 2;
                }
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "GetDirAtkAirMiddleSegment",
                    exc);
            } else {
                throw exc;
            }
        }
        return middleSegment;
    }

    /**
     * Computes the angle in radians between two points
     *
     * @param pt0 the first point
     * @param pt1 the last point
     *
     * @return the angle in radians
     */
    static calcSegmentAngle(pt0: POINT2,
        pt1: POINT2): number {
        let dAngle: number = 0;
        try {
            //declarations
            //end declarations

            const { result: nTemp, slope: mVal } = LineUtility.calcTrueSlope(pt0, pt1);
            if (nTemp === 0) {
                dAngle = Math.PI / 2;
            } else {
                dAngle = Math.atan(mVal);
            }

        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "calcSegmentAngle",
                    exc);
            } else {
                throw exc;
            }
        }
        return dAngle;
    }

    /**
     * POINT2 in previous applications has been a struct that did not require
     * initialization.
     *
     * @param pts array of points to instantiate.
     */
    static InitializePOINT2Array(pts: POINT2[]): void {
        //int j=0;
        if (pts == null || pts.length === 0) {
            return;
        }
        let n: number = pts.length;
        //for (int j = 0; j < pts.length; j++) 
        for (let j: number = 0; j < n; j++) {
            pts[j] = new POINT2();
        }
    }

    /**
     * Calculates the center point of an area using the first vblCounter points
     * in the array.
     *
     * @param pLinePoints the client points
     * @param vblCounter the number of points in the array to use
     *
     * @return the center point
     */
    static CalcCenterPointDouble(pLinePoints: POINT2[],
        vblCounter: number): POINT2 {
        let CenterLinePoint: POINT2 = new POINT2(pLinePoints[0]);
        try {
            //declarations
            let j: number = 0;
            let dMinX: number = pLinePoints[0].x;
            let
                dMinY: number = pLinePoints[0].y;
            let
                dMaxX: number = pLinePoints[0].x;
            let
                dMaxY: number = pLinePoints[0].y;

            //end declarations
            dMinX = pLinePoints[0].x;
            dMinY = pLinePoints[0].y;
            dMaxX = pLinePoints[0].x;
            dMaxY = pLinePoints[0].y;

            for (j = 0; j < vblCounter; j++) {
                if (pLinePoints[j].x < dMinX) {
                    dMinX = pLinePoints[j].x;
                }

                if (pLinePoints[j].y < dMinY) {
                    dMinY = pLinePoints[j].y;
                }

                if (pLinePoints[j].x > dMaxX) {
                    dMaxX = pLinePoints[j].x;
                }

                if (pLinePoints[j].y > dMaxY) {
                    dMaxY = pLinePoints[j].y;
                }

            }	//end for

            CenterLinePoint.x = (dMinX + dMaxX) / 2;
            CenterLinePoint.y = (dMinY + dMaxY) / 2;
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "CalcCenterPointDouble",
                    exc);
            } else {
                throw exc;
            }
        }
        return CenterLinePoint;
    }

    /**
     * Called by renderer Modifier2 class after ArrayList.ToArray was called,
     * which produces an array of objects.
     *
     * @param pLinePoints
     * @param vblCounter
     * @return
     */
    public static CalcCenterPointDouble2(pLinePoints: POINT2[],
        vblCounter: number): POINT2 {
        let pt0: POINT2 = pLinePoints[0];
        let CenterLinePoint: POINT2 = new POINT2();
        try {
            //declarations
            let j: number = 0;
            let dMinX: number = pt0.x;
            let
                dMinY: number = pt0.y;
            let
                dMaxX: number = pt0.x;
            let
                dMaxY: number = pt0.y;

            //end declarations
            dMinX = pt0.x;
            dMinY = pt0.y;
            dMaxX = pt0.x;
            dMaxY = pt0.y;

            let pt: POINT2;

            for (j = 0; j < vblCounter; j++) {
                pt = pLinePoints[j];
                if (pt.x < dMinX) {
                    dMinX = pt.x;
                }

                if (pt.y < dMinY) {
                    dMinY = pt.y;
                }

                if (pt.x > dMaxX) {
                    dMaxX = pt.x;
                }

                if (pt.y > dMaxY) {
                    dMaxY = pt.y;
                }

            }	//end for

            CenterLinePoint.x = (dMinX + dMaxX) / 2;
            CenterLinePoint.y = (dMinY + dMaxY) / 2;
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "CalcCenterPointDouble2",
                    exc);
            } else {
                throw exc;
            }
        }
        return CenterLinePoint;
    }

    /**
     * Calculates the distance in pixels between two points
     *
     * @param p1 the first point
     * @param p2 the last point
     *
     * @return the distance between p1 and p2 in pixels
     */
    public static calcDistance(p1: POINT2 | Point2D, p2: POINT2 | Point2D): number {

        let returnValue: number = 0;
        try {
            returnValue = Math.sqrt((p1.getX() - p2.getX())
                * (p1.getX() - p2.getX())
                + (p1.getY() - p2.getY())
                * (p1.getY() - p2.getY()));

            //sanity check
            //return x or y distance if returnValue is 0 or infinity
            let xdist: number = Math.abs(p1.getX() - p2.getX());
            let ydist: number = Math.abs(p1.getY() - p2.getY());
            let max: number = xdist;
            if (ydist > xdist) {
                max = ydist;
            }

            if (returnValue === 0 || !Number.isFinite(returnValue)) {
                if (max > 0) {
                    returnValue = max;
                }
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "calcDistance",
                    exc);
            } else {
                throw exc;
            }
        }
        return returnValue;
    }


    /**
     * Computes the slope of a line
     *
     * @param firstLinePoint the first line point
     * @param lastLinePoint the last line point
     * @param slope OUT - object with member to hold the slope of the line
     *
     * @return 1 if successful, else return 0
     */
    static calcTrueSlope(firstLinePoint: POINT2,
        lastLinePoint: POINT2): { result: number, slope: number }
    {
        let result: number = 1;
        let slopeVal: number = 0;
        try {
            let deltaX: number = 0;
            let deltaY: number = 0;
            deltaX = firstLinePoint.x - lastLinePoint.x;
            //if (deltaX == 0)
            if (Math.abs(deltaX) < 1) {
                //deltaX = 1;
                if (deltaX >= 0) {

                    deltaX = 1;
                }

                else {

                    deltaX = -1;
                }

                result = 1;
            }
            deltaY = firstLinePoint.y - lastLinePoint.y;

            slopeVal = deltaY / deltaX;	//cannot blow up
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "calcTrueSlope",
                    exc);
            } else {
                throw exc;
            }
        }
        return { result, slope: slopeVal };
    }

    /**
     * reverses the first vblCounter points
     *
     * @param pLowerLinePoints OUT - points to reverse
     * @param vblCounter
     */
    static reversePoints(pLowerLinePoints: POINT2[],
        vblCounter: number): void {
        try {
            let pResultPoints: POINT2[] = new Array<POINT2>(vblCounter);
            let k: number = 0;
            for (k = 0; k < vblCounter; k++) {
                pResultPoints[k] = new POINT2(pLowerLinePoints[vblCounter - k - 1]);
            }
            for (k = 0; k < vblCounter; k++) {
                pLowerLinePoints[k] = new POINT2(pResultPoints[k]);
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "reversePoints",
                    exc);
            } else {
                throw exc;
            }
        }
    }

    public static calcTrueSlopeForRoutes(firstLinePoint: POINT2,
        lastLinePoint: POINT2): { result: boolean, slope: number } {
        let slopeVal: number = 0;
        try {
            let deltaX: number = 0;
            let deltaY: number = 0;
            deltaX = (firstLinePoint.x) as number - (lastLinePoint.x) as number;
            if (Math.abs(deltaX) < 2) //was 2,infinite slope
            {
                return { result: false, slope: slopeVal };
            }

            deltaY = (firstLinePoint.y) as number - (lastLinePoint.y) as number;

            slopeVal = deltaY / deltaX;
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "calcTrueSlopeForRoutes",
                    exc);
            } else {
                throw exc;
            }
        }
        return { result: true, slope: slopeVal };
    }

    /**
     * Computes the slope of a line
     *
     * @param firstLinePoint the first line point
     * @param lastLinePoint the last line point
     * @param slope OUT - object with member to hold the slope of the line
     *
     * @return true if successful
     */
    public static calcTrueSlope2(firstLinePoint: POINT2,
        lastLinePoint: POINT2): { result: boolean, slope: number } {
        let resultVal: boolean = true;
        let slopeVal: number = 0;
        try {
            let deltaX: number = 0;
            let deltaY: number = 0;
            deltaX = (firstLinePoint.x) as number - (lastLinePoint.x) as number;
            //if (deltaX == 0)
            if (Math.abs(deltaX) < 1) {
                //deltaX = 1;
                if (deltaX >= 0) {

                    deltaX = 1;
                }

                else {

                    deltaX = -1;
                }

                resultVal = false;
            }

            deltaY = (firstLinePoint.y) as number - (lastLinePoint.y) as number;

            slopeVal = deltaY / deltaX;
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "calcTrueSlope2",
                    exc);
            } else {
                throw exc;
            }
        }
        return { result: resultVal, slope: slopeVal };
    }

    /**
     * Calculates the slopes and y intercepts in pixels for the line from pt1 to
     * pt2 and a parallel line a vertical distance from the line
     *
     * @param nDistance the distance in pixels
     * @param linePoint1 first point on the line
     * @param linePoint2 last point on the line
     * @param pdResult OUT - array to hold m, b for both lines
     *
     * @return 1 if the lines are not vertical, else return 0
     */
    static calcTrueLines(nDistance: number,
        linePoint1: POINT2,
        linePoint2: POINT2): { result: number, values: number[] } //for vertical line e.g. if line equation is x=7
    {
        let values: number[] = new Array<number>(6);
        try {
            //declarations
            let b: number = 0;
            let delta: number = 0;
            //end declarations
            const { result: nTemp, slope: mVal } = LineUtility.calcTrueSlope(linePoint1, linePoint2);
            //Fill the result array with the line parameters
            if (nTemp === 0) //vertical lines
            {
                values[3] = linePoint1.x + nDistance as number;	//the lower line eqn, e.g. x=7
                values[5] = linePoint1.x - nDistance as number;	//the upper line eqn,
                return { result: 0, values };
            } else {
                b = linePoint2.y - mVal * linePoint2.x;
                delta = Math.sqrt(mVal * mVal * ((nDistance) as number * (nDistance) as number)
                    + ((nDistance) as number * (nDistance) as number));
                values[0] = mVal;    //original line eq'n: y = mx + b
                values[1] = b;
                values[2] = mVal;    //lower line eq'n: y = mx + (b+dDistance)
                values[3] = b + delta;
                values[4] = mVal;    //upper line eq'n: y = mx + (b-dDistance)
                values[5] = b - delta;
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "calcTrueLines",
                    exc);
            } else {
                throw exc;
            }
        }
        return { result: 1, values };
    }

    /**
     * Calculates the intersection of two lines.
     *
     * @param m1 slope of first line
     * @param b1 Y intercept of first line
     * @param m2 slope of second line
     * @param b2 Y intercept of second line
     * @param bolVertical1 0 if first line is vertical, else 1
     * @param bolVertical2 0 if second line is vertical, else 1
     * @param X1 X intercept if first line is vertical
     * @param X2 X intercept if 2nd line is vertical.
     *
     * @return intersection point
     */
    public static calcTrueIntersect(m1: number,
        b1: number,
        m2: number,
        b2: number,
        bolVertical1: number,
        bolVertical2: number,
        X1: number, //x intercept if line1 is vertical
        X2: number): POINT2 {
        let ptIntersect: POINT2 = new POINT2();
        try {
            //declarations
            let x: number = 0;
            let y: number = 0;
            //end declarations

            //initialize ptIntersect
            ptIntersect.x = X1;
            ptIntersect.y = X2;
            if (bolVertical1 === 0 && bolVertical2 === 0) //both lines vertical
            {
                return ptIntersect;
            }
            //the following 3 if blocks are the only ways to get an intersection
            if (bolVertical1 === 0 && bolVertical2 === 1) //line1 vertical, line2 not
            {
                ptIntersect.x = X1;
                ptIntersect.y = m2 * X1 + b2;
                return ptIntersect;
            }
            if (bolVertical1 === 1 && bolVertical2 === 0) //line2 vertical, line1 not
            {
                ptIntersect.x = X2;
                ptIntersect.y = m1 * X2 + b1;
                return ptIntersect;
            }
            //if either of the lines is vertical function has already returned
            //so both m1 and m2 should be valid
            if (m1 !== m2) {
                x = (b2 - b1) / (m1 - m2);	//cannot blow up
                y = (m1 * x + b1);
                ptIntersect.x = x;
                ptIntersect.y = y;
                return ptIntersect;
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "calcTrueIntersect",
                    exc);
            } else {
                throw exc;
            }
        }
        return ptIntersect;
    }

    /**
     * Calculates an offset point for channel types which require arrows.
     *
     * @param startLinePoint the first point
     * @param endLinePoint the last point
     * @param nOffset the offset in pixels
     *
     * @return the offset point
     */
    static GetOffsetPointDouble(startLinePoint: POINT2,
        endLinePoint: POINT2,
        nOffset: number): POINT2 {
        let tempLinePoint: POINT2 = new POINT2(startLinePoint);
        try {
            //declarations
            let dx: number = endLinePoint.x - startLinePoint.x;
            let
                dy: number = endLinePoint.y - startLinePoint.y;
            let
                dOffset: number = nOffset;
            let
                dHypotenuse: number = 0;
            let
                dAngle: number = 0;

            //end declarations
            if (dx === 0) {
                if (dy > 0) {
                    tempLinePoint.x = endLinePoint.x;
                    tempLinePoint.y = endLinePoint.y + dOffset;
                } else {
                    tempLinePoint.x = endLinePoint.x;
                    tempLinePoint.y = endLinePoint.y - dOffset;
                }
                return tempLinePoint;
            }
            if (dy === 0) {
                if (dx > 0) {
                    tempLinePoint.x = endLinePoint.x + dOffset;
                    tempLinePoint.y = endLinePoint.y;
                } else {
                    tempLinePoint.x = endLinePoint.x - dOffset;
                    tempLinePoint.y = endLinePoint.y;
                }
                return tempLinePoint;
            }

            if (dy === 0) {
                dAngle = 0;
            } else {
                dAngle = Math.atan(dx / dy) + Math.PI / 2;//1.570795;
            }
            dHypotenuse = nOffset;
            if (endLinePoint.x > startLinePoint.x) {
                tempLinePoint.x = endLinePoint.x + dHypotenuse * Math.abs(Math.cos(dAngle));
            } else {
                tempLinePoint.x = endLinePoint.x - dHypotenuse * Math.abs(Math.cos(dAngle));
            }
            if (endLinePoint.y > startLinePoint.y) {
                tempLinePoint.y = endLinePoint.y + dHypotenuse * Math.abs(Math.sin(dAngle));
            } else {
                tempLinePoint.y = endLinePoint.y - dHypotenuse * Math.abs(Math.sin(dAngle));
            }

        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "GetOffsetPointDouble",
                    exc);
            } else {
                throw exc;
            }
        }
        return (tempLinePoint);
    }

    /**
     * Used for DMAF
     *
     * @param pLinePoints the client points
     * @return ArrayList of X points
     */
    static LineOfXPoints(tg: TacticalGraphic, pLinePoints: POINT2[]): Array<POINT2> {
        let xPoints: Array<POINT2> = new Array();
        try {
            let j: number = 0;
            let k: number = 0;
            let dist: number = 0;
            let iterations: number = 0;
            let frontPt: POINT2;
            let backPt: POINT2;
            let extendFrontAbove: POINT2;
            let extendFrontBelow: POINT2;
            let extendBackAbove: POINT2;
            let extendBackBelow: POINT2;
            let xPoint1: POINT2;
            let xPoint2: POINT2;
            let n: number = pLinePoints.length;
            let xSize: number = arraysupport.getScaledSize(5, tg.lineThickness, tg.patternScale);
            let dIncrement: number = xSize * 4;
            //for (j = 0; j < pLinePoints.length - 1; j++) 
            for (j = 0; j < n - 1; j++) {
                dist = LineUtility.calcDistance(pLinePoints[j], pLinePoints[j + 1]);
                iterations = Math.trunc((dist - xSize) / dIncrement);
                if (dist - iterations * dIncrement > dIncrement / 2) {
                    iterations += 1;
                }

                for (k = 0; k < iterations; k++) {
                    frontPt = LineUtility.extendAlongLine(pLinePoints[j], pLinePoints[j + 1], k * dIncrement - xSize);
                    backPt = LineUtility.extendAlongLine(pLinePoints[j], pLinePoints[j + 1], k * dIncrement + xSize);
                    extendFrontAbove = LineUtility.ExtendDirectedLine(pLinePoints[j], pLinePoints[j + 1], frontPt, 2, xSize);
                    extendFrontBelow = LineUtility.ExtendDirectedLine(pLinePoints[j], pLinePoints[j + 1], frontPt, 3, xSize);
                    extendBackAbove = LineUtility.ExtendDirectedLine(pLinePoints[j], pLinePoints[j + 1], backPt, 2, xSize);
                    extendBackBelow = LineUtility.ExtendDirectedLine(pLinePoints[j], pLinePoints[j + 1], backPt, 3, xSize);
                    xPoints.push(extendFrontAbove);
                    extendBackBelow.style = 5;
                    xPoints.push(extendBackBelow);
                    xPoints.push(extendBackAbove);
                    extendFrontBelow.style = 5;
                    xPoints.push(extendFrontBelow);
                }
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "LineOfXPoints",
                    exc);
            } else {
                throw exc;
            }
        }
        return xPoints;
    }

    /**
     * Computes the distance in pixels of pt3 to the line from pt1 to pt2.
     *
     * @param pt1 first line point
     * @param pt2 last line point
     * @param pt3 point distance to compute
     * @return distance to pt3
     */
    public static calcDistanceToLine(pt1: POINT2,
        pt2: POINT2,
        pt3: POINT2): number {
        let dResult: number = 0;
        try {
            //declarations
            let m1: number = 1;
            let b: number = 0;
            let b1: number = 0;
            let ptIntersect: POINT2 = new POINT2(pt1);
            //end declarations

            const { result: bolVertical, slope: mVal } = LineUtility.calcTrueSlope(pt1, pt2);

            //get line y intercepts
            if (bolVertical !== 0 && mVal !== 0) {
                m1 = -1 / mVal;
                b = pt1.y - mVal * pt1.x;
                b1 = pt3.y - m1 * pt3.x;
                ptIntersect = LineUtility.calcTrueIntersect(mVal, b, m1, b1, 1, 1, ptIntersect.x, ptIntersect.y);
            }
            if (bolVertical !== 0 && mVal === 0) //horizontal line
            {
                ptIntersect.y = pt1.y;
                ptIntersect.x = pt3.x;
            }
            if (bolVertical === 0) //vertical line
            {
                ptIntersect.y = pt3.y;
                ptIntersect.x = pt1.x;
            }

            dResult = LineUtility.calcDistance(pt3, ptIntersect);
        } catch (exc) {
            if (exc instanceof Error) {
                //console.log(e.message);
                ErrorLogger.LogException(LineUtility._className, "CaclDistanceToLineDouble",
                    exc);
            } else {
                throw exc;
            }
        }
        return dResult;
    }

    /**
     * Calculates a point along a line. Returns the past point if the distance
     * is 0.
     *
     * @param pt1 first line point
     * @param pt2 last line point
     * @param dist extension distance in pixels from the beginning of the line
     *
     * @return the extension point
     */
    public static ExtendLineDouble(pt1: POINT2,
        pt2: POINT2,
        dist: number): POINT2 {
        let pt3: POINT2 = new POINT2();
        try {
            let dOriginalDistance: number = LineUtility.calcDistance(pt1, pt2);
            if (dOriginalDistance === 0 || dist === 0) {
                return pt2;
            }

            pt3.x = (dOriginalDistance + dist) / dOriginalDistance * (pt2.x - pt1.x) + pt1.x;
            pt3.y = (dOriginalDistance + dist) / dOriginalDistance * (pt2.y - pt1.y) + pt1.y;
        } catch (exc) {
            if (exc instanceof Error) {
                //console.log(e.message);
                ErrorLogger.LogException(LineUtility._className, "ExtendLineDouble",
                    exc);
            } else {
                throw exc;
            }
        }
        return pt3;
    }

    /**
     * Extends a point along a line. If dist is 0 returns last point.
     *
     * @param pt1 first point on the line
     * @param pt2 last point on the line
     * @param dist the distance in pixels from pt1
     *
     * @return the extended point
     */
    public static extendAlongLine(pt1: POINT2, pt2: POINT2, dist: number): POINT2;

    public static extendAlongLine(pt1: POINT2, pt2: POINT2, dist: number, styl: number): POINT2;
    public static extendAlongLine(...args: unknown[]): POINT2 {
        switch (args.length) {
            case 3: {
                const [pt1, pt2, dist] = args as [POINT2, POINT2, number];


                let pt3: POINT2 = new POINT2();
                try {
                    let dOriginalDistance: number = LineUtility.calcDistance(pt1, pt2);
                    if (dOriginalDistance === 0 || dist === 0) {
                        return pt2;
                    }

                    pt3.x = ((dist / dOriginalDistance) * (pt2.x - pt1.x) + pt1.x);
                    pt3.y = ((dist / dOriginalDistance) * (pt2.y - pt1.y) + pt1.y);
                } catch (exc) {
                    if (exc instanceof Error) {
                        //console.log(e.message);
                        ErrorLogger.LogException(LineUtility._className, "extendAlongLine",
                            exc);
                    } else {
                        throw exc;
                    }
                }
                return pt3;


                break;
            }

            case 4: {
                const [pt1, pt2, dist, styl] = args as [POINT2, POINT2, number, number];


                let pt3: POINT2 = new POINT2();
                try {
                    let dOriginalDistance: number = LineUtility.calcDistance(pt1, pt2);
                    if (dOriginalDistance === 0 || dist === 0) {
                        return pt2;
                    }

                    pt3.x = (dist / dOriginalDistance * (pt2.x - pt1.x) + pt1.x);
                    pt3.y = (dist / dOriginalDistance * (pt2.y - pt1.y) + pt1.y);
                    pt3.style = styl;
                } catch (exc) {
                    if (exc instanceof Error) {
                        //console.log(e.message);
                        ErrorLogger.LogException(LineUtility._className, "extendAlongLine",
                            exc);
                    } else {
                        throw exc;
                    }
                }
                return pt3;


                break;
            }

            default: {
                throw Error(`Invalid number of arguments`);
            }
        }
    }


    public static extendAlongLine2(pt1: POINT2, pt2: POINT2, dist: number): POINT2;

    public static extendAlongLine2(pt1: Point2D, pt2: Point2D, dist: number): Point2D;
    public static extendAlongLine2(...args: unknown[]): POINT2 | Point2D {
        if (args[0] instanceof POINT2) {
            const [pt1, pt2, dist] = args as [POINT2, POINT2, number];

            let pt3: POINT2 = new POINT2();
            try {
                let dOriginalDistance: number = LineUtility.calcDistance(pt1, pt2);
                if (dOriginalDistance === 0 || dist === 0) {
                    return pt1;
                }

                pt3.x = (dist / dOriginalDistance * (pt2.x - pt1.x) + pt1.x);
                pt3.y = (dist / dOriginalDistance * (pt2.y - pt1.y) + pt1.y);
            } catch (exc) {
                if (exc instanceof Error) {
                    //console.log(e.message);
                    ErrorLogger.LogException(LineUtility._className, "extendAlongLine2",
                        exc);
                } else {
                    throw exc;
                }
            }
            return pt3;

        } else {

            const [pt1, pt2, dist] = args as [Point2D, Point2D, number];


            try {
                let dOriginalDistance: number = LineUtility.calcDistance(pt1, pt2);
                if (dOriginalDistance === 0 || dist === 0) {
                    return new Point2D(pt1.getX(), pt1.getY());
                }

                let x: number = (dist / dOriginalDistance * (pt2.getX() - pt1.getX()) + pt1.getX());
                let y: number = (dist / dOriginalDistance * (pt2.getY() - pt1.getY()) + pt1.getY());
                return new Point2D(x, y);
            } catch (exc) {
                if (exc instanceof Error) {
                    ErrorLogger.LogException(LineUtility._className, "extendAlongLine2",
                        exc);
                } else {
                    throw exc;
                }
            }
            return new Point2D(0, 0);
        }
    }


    /**
     * Extends a point above a line
     *
     * @param pt1 first line point
     * @param pt2 last line point
     * @param pt3 point at which to extend
     * @param d distance in pixels to extend above the line
     * @param X OUT - extended point x value
     * @param Y OUT - extended point y value
     * @param direction direction to extend the line
     *
     * @return 1 if successful, else return 0
     */
    protected static ExtendLineAbove(pt1: POINT2,
        pt2: POINT2,
        pt3: POINT2,
        d: number,
        direction: number): { result: number, x: number, y: number } {
        let xVal: number = 0;
        let yVal: number = 0;
        try {
            let dx: number = 0;
            let dy: number = 0;

            const { result: bolVertical, slope: mVal } = LineUtility.calcTrueSlope(pt1, pt2);
            if (bolVertical === 0) {
                return { result: 0, x: xVal, y: yVal };	//cannot extend above a vertical line
            }
            if (mVal === 0) {
                xVal = pt3.x;
                if (direction === 0) //extend above the line
                {
                    yVal = pt3.y - Math.abs(d);
                } else //extend below the line
                {
                    yVal = pt3.y + Math.abs(d);
                }
                return { result: 1, x: xVal, y: yVal };
            }
            //the line is neither vertical nor horizontal
            //else function would already have returned
            if (direction === 0) //extend above the line
            {
                dy = -Math.abs(d / (mVal * Math.sqrt(1 + 1 / (mVal * mVal))));
            } else //extend below the line
            {
                dy = Math.abs(d / (mVal * Math.sqrt(1 + 1 / (mVal * mVal))));
            }

            dx = -mVal * dy;
            xVal = pt3.x + dx;
            yVal = pt3.y + dy;
        } catch (exc) {
            if (exc instanceof Error) {
                //console.log(e.message);
                ErrorLogger.LogException(LineUtility._className, "ExtendLineAbove",
                    exc);
            } else {
                throw exc;
            }
        }
        return { result: 1, x: xVal, y: yVal };
    }

    /**
     * Extends a point to the left of a line
     *
     * @param pt1 first line point
     * @param pt2 last line point
     * @param pt3 point at which to extend
     * @param d distance in pixels to extend above the line
     * @param X OUT - extended point x value
     * @param Y OUT - extended point y value
     * @param direction direction to extend the line
     *
     * @return 1 if successful, else return 0
     */
    protected static ExtendLineLeft(pt1: POINT2,
        pt2: POINT2,
        pt3: POINT2,
        d: number,
        direction: number): { result: number, x: number, y: number } {
        let xVal: number = 0;
        let yVal: number = 0;
        try {
            let dx: number = 0;
            let dy: number = 0;

            const { result: bolVertical, slope: mVal } = LineUtility.calcTrueSlope(pt1, pt2);
            if (bolVertical !== 0 && mVal === 0) {
                return { result: 0, x: xVal, y: yVal };	//cannot left of horiz line
            }
            if (bolVertical === 0) //vertical line
            {
                yVal = pt3.y;
                if (direction === 0) //extend left of the line
                {
                    xVal = pt3.x - Math.abs(d);
                } else //extend right of the line
                {
                    xVal = pt3.x + Math.abs(d);
                }

                return { result: 1, x: xVal, y: yVal };
            }
            //the line is neither vertical nor horizontal
            //else function would already have returned
            if (direction === 0) //extend left of the line
            {
                dx = -Math.abs(d / Math.sqrt(1 + 1 / (mVal * mVal)));
            } else //extend right of the line
            {
                dx = Math.abs(d / Math.sqrt(1 + 1 / (mVal * mVal)));
            }

            dy = -(1 / mVal) * dx;

            xVal = pt3.x + dx;
            yVal = pt3.y + dy;
        } catch (exc) {
            if (exc instanceof Error) {
                //console.log(e.message);
                ErrorLogger.LogException(LineUtility._className, "ExtendLineLeft",
                    exc);
            } else {
                throw exc;
            }
        }
        return { result: 1, x: xVal, y: yVal };
    }

    /**
     * Calculates the direction of a point relative to a line
     *
     * @param pt0 first point fo the line
     * @param pt1 last point of the line
     * @param ptRelative relative point
     * @return 0 if left, 1 if right, 2 if above, 3 if below
     */
    static CalcDirectionFromLine(pt0: POINT2,
        pt1: POINT2,
        ptRelative: POINT2): number {
        let result: number = -1;
        try {
            let m2: number = 0;
            let b1: number = 0;
            let b2: number = 0;
            let ptIntersect: POINT2 = new POINT2();
            //int direction=-1;
            //handle vertical line
            if (pt0.x === pt1.x) {
                if (ptRelative.x < pt0.x) {
                    return 0;
                } else {
                    return 1;
                }
            }
            //handle horizontal line so that we do not have slope = 0.
            if (pt0.y === pt1.y) {
                if (ptRelative.y < pt0.y) {
                    return 2;
                } else {
                    return 3;
                }
            }
            const { slope: m1Val } = LineUtility.calcTrueSlope(pt0, pt1);
            m2 = -1 / m1Val;	//slope for the perpendicular line from the line to ptRelative
            //b=mx-y line equation for line
            b1 = pt0.y - m1Val * pt0.x;
            //b=mx-y line equation for perpendicular line which contains ptRelative
            b2 = ptRelative.y - m2 * ptRelative.x;
            ptIntersect = LineUtility.calcTrueIntersect(m1Val, b1, m2, b2, 1, 1, 0, 0);
            //compare the intersection point with ptRelative to get the direction,
            //i.e. the direction from the line is the same as the direction
            //from the interseciton point.
            if (m1Val > 1) //line is steep, use left/right
            {
                if (ptRelative.x < ptIntersect.x) {
                    return 0;
                } else {
                    return 1;
                }
            } else //line is not steep, use above/below
            {
                if (ptRelative.y < ptIntersect.y) {
                    return 2;
                } else {
                    return 3;
                }
            }
            //should not reach this point
            //return direction;
        } catch (e) {
            if (e instanceof Error) {
                console.log(e.message);
            } else {
                throw e;
            }
        }
        return result;
    }

    /**
     * Returns a point extended perpendicularly from a line at a given direction
     *
     * @param pt1 first line point
     * @param pt2 last line point
     * @param pt0 on line from which to extend
     * @param direction the direction to extend: above, below, left, right
     * @param d the length to extend in pixels
     *
     */
    public static ExtendDirectedLine(pt1: POINT2,
        pt2: POINT2,
        pt0: POINT2,
        direction: number,
        d: number): POINT2;

    /**
     * Returns a point extended perpendicularly from a line at a given direction
     *
     * @param pt1 first line point
     * @param pt2 last line point
     * @param pt0 on line from which to extend
     * @param direction the direction to extend: above, below, left, right
     * @param d the length to extend in pixels
     * @param style the style to assign the return point
     *
     */
    public static ExtendDirectedLine(pt1: POINT2,
        pt2: POINT2,
        pt0: POINT2,
        direction: number,
        d: number,
        style: number): POINT2;
    public static ExtendDirectedLine(...args: unknown[]): POINT2 {
        switch (args.length) {
            case 5: {
                const [pt1, pt2, pt0, direction, d] = args as [POINT2, POINT2, POINT2, number, number];


                let ptResult: POINT2 = new POINT2();
                try {
                    let extResult: { result: number, x: number, y: number };
                    ptResult = new POINT2(pt0);
                    switch (direction) {
                        case 0: {	//extend left
                            extResult = LineUtility.ExtendLineLeft(pt1, pt2, pt0, d, 0);
                            ptResult.x = extResult.x;
                            ptResult.y = extResult.y;
                            break;
                        }

                        case 1: {	//extend right
                            extResult = LineUtility.ExtendLineLeft(pt1, pt2, pt0, d, 1);
                            ptResult.x = extResult.x;
                            ptResult.y = extResult.y;
                            break;
                        }

                        case 2: {	//extend above
                            extResult = LineUtility.ExtendLineAbove(pt1, pt2, pt0, d, 0);
                            ptResult.x = extResult.x;
                            ptResult.y = extResult.y;
                            break;
                        }

                        case 3: {	//extend below
                            extResult = LineUtility.ExtendLineAbove(pt1, pt2, pt0, d, 1);
                            ptResult.x = extResult.x;
                            ptResult.y = extResult.y;
                            break;
                        }

                        default: {
                            break;
                        }

                    }
                } catch (exc) {
                    if (exc instanceof Error) {
                        //console.log(e.message);
                        ErrorLogger.LogException(LineUtility._className, "ExtendDirectedLine",
                            exc);
                    } else {
                        throw exc;
                    }
                }
                return ptResult;


                break;
            }

            case 6: {
                let [pt1, pt2, pt0, direction, d, style] = args as [POINT2, POINT2, POINT2, number, number, number];

                let ptResult: POINT2 = new POINT2(pt0);
                try {
                    let extResult: { result: number, x: number, y: number };
                    //int bolResult=0;
                    //handle parallel, perpendicular cases
                    if (pt1.x === pt2.x) {
                        if (direction === 2) {
                            direction = 0;
                        }
                        if (direction === 3) {
                            direction = 1;
                        }
                    }
                    if (pt1.y === pt2.y) {
                        if (direction === 0) {
                            direction = 2;
                        }
                        if (direction === 1) {
                            direction = 3;
                        }
                    }
                    switch (direction) {
                        case 0: {	//extend left
                            extResult = LineUtility.ExtendLineLeft(pt1, pt2, pt0, d, 0);
                            ptResult.x = extResult.x;
                            ptResult.y = extResult.y;
                            break;
                        }

                        case 1: {	//extend right
                            extResult = LineUtility.ExtendLineLeft(pt1, pt2, pt0, d, 1);
                            ptResult.x = extResult.x;
                            ptResult.y = extResult.y;
                            break;
                        }

                        case 2: {	//extend above
                            extResult = LineUtility.ExtendLineAbove(pt1, pt2, pt0, d, 0);
                            ptResult.x = extResult.x;
                            ptResult.y = extResult.y;
                            break;
                        }

                        case 3: {	//extend below
                            extResult = LineUtility.ExtendLineAbove(pt1, pt2, pt0, d, 1);
                            ptResult.x = extResult.x;
                            ptResult.y = extResult.y;
                            break;
                        }


                        default:

                    }
                    ptResult.style = style;
                } catch (exc) {
                    if (exc instanceof Error) {
                        ErrorLogger.LogException(LineUtility._className, "ExtendDirectedLine",
                            exc);
                    } else {
                        throw exc;
                    }
                }
                return ptResult;


                break;
            }

            default: {
                throw Error(`Invalid number of arguments`);
            }
        }
    }


    /**
     * @deprecated Returns a point extended perpendicularly from a line at a
     * given direction same as original function except it accounts for vertical
     * lines and negative d values
     *
     * @param pt1 first line point
     * @param pt2 last line point
     * @param pt0 on line from which to extend
     * @param direction the direction to extend: above, below, left, right
     * @param d the length to extend in pixels
     *
     */
    public static ExtendDirectedLineText(pt1: POINT2,
        pt2: POINT2,
        pt0: POINT2,
        direction: number,
        d: number): POINT2 {
        let ptResult: POINT2 = new POINT2();
        try {
            let extResult: { result: number, x: number, y: number } = { result: 0, x: 0, y: 0 };
            ptResult = new POINT2(pt0);
            if (d < 0) {
                direction = LineUtility.reverseDirection(direction);
                d = Math.abs(d);
            }
            if (pt1.y === pt2.y)//horizontal segment
            {
                switch (direction) {
                    case 0: {//left means above
                        direction = LineUtility.extend_above;
                        break;
                    }

                    case 1: {//right means below
                        direction = LineUtility.extend_below;
                        break;
                    }

                    default: {
                        break;
                    }

                }
            }
            if (pt1.x === pt2.x)//vertical segment
            {
                switch (direction) {
                    case 2: {//above means left
                        direction = LineUtility.extend_left;
                        break;
                    }

                    case 3: {//below means right
                        direction = LineUtility.extend_right;
                        break;
                    }

                    default: {
                        break;
                    }

                }
            }
            switch (direction) {
                case 0: {	//extend left
                    extResult = LineUtility.ExtendLineLeft(pt1, pt2, pt0, d, 0);
                    break;
                }

                case 1: {	//extend right
                    extResult = LineUtility.ExtendLineLeft(pt1, pt2, pt0, d, 1);
                    break;
                }

                case 2: {	//extend above
                    extResult = LineUtility.ExtendLineAbove(pt1, pt2, pt0, d, 0);
                    break;
                }

                case 3: {	//extend below
                    extResult = LineUtility.ExtendLineAbove(pt1, pt2, pt0, d, 1);
                    break;
                }

                default: {
                    break;
                }

            }
            ptResult.x = extResult.x;
            ptResult.y = extResult.y;
        } catch (exc) {
            if (exc instanceof Error) {
                //console.log(e.message);
                ErrorLogger.LogException(LineUtility._className, "ExtendDirectedLine",
                    exc);
            } else {
                throw exc;
            }
        }
        return ptResult;
    }

    /**
     * Calculates a point along a line
     *
     * @param pt1 first line point
     * @param pt2 last line point
     * @param dist extension distance in pixels from the beginning of the line
     * @param styl the line style to assign the point
     *
     * @return the extension point
     */
    static extendLine(pt1: POINT2,
        pt2: POINT2,
        dist: number,
        styl: number): POINT2 {
        let pt3: POINT2 = new POINT2();
        try {
            let dOriginalDistance: number = LineUtility.calcDistance(pt1, pt2);

            pt3.x = pt2.x;
            pt3.y = pt2.y;
            if (dOriginalDistance > 0) {
                pt3.x = ((dOriginalDistance + dist) / dOriginalDistance * (pt2.x - pt1.x) + pt1.x);
                pt3.y = ((dOriginalDistance + dist) / dOriginalDistance * (pt2.y - pt1.y) + pt1.y);
                pt3.style = styl;
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "extendLine",
                    exc);
            } else {
                throw exc;
            }
        }
        return pt3;
    }

    /**
     * Extends a point at an angle from a line.
     *
     * @param pt0 the first line point
     * @param pt1 the second line point
     * @param pt2 point on line from which to extend
     * @param alpha angle of extension in degrees
     * @param d the distance in pixels to extend
     *
     * @return the extension point
     */
    public static ExtendAngledLine(pt0: POINT2,
        pt1: POINT2,
        pt2: POINT2,
        alpha: number,
        d: number): POINT2 {
        let pt: POINT2 = new POINT2();
        try {
            //first get the angle psi between pt0 and pt1
            let psi: number = Math.atan((pt1.y - pt0.y) / (pt1.x - pt0.x));
            //convert alpha to radians
            let alpha1: number = Math.PI * alpha / 180;

            //theta is the angle of extension from the x axis
            let theta: number = psi + alpha1;
            //dx is the x extension from pt2
            let dx: number = d * Math.cos(theta);
            //dy is the y extension form pt2
            let dy: number = d * Math.sin(theta);
            pt.x = pt2.x + dx;
            pt.y = pt2.y + dy;
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "ExtendAngledLine",
                    exc);
            } else {
                throw exc;
            }
        }
        return pt;
    }

    /**
     * Returns an integer indicating the quadrant for the direction of the line
     * from pt1 to pt2
     *
     * @param pt1 first line point
     * @param pt2 second line point
     *
     * @return the quadrant
     */
    public static GetQuadrantDouble(pt1: POINT2,
        pt2: POINT2): number;

    public static GetQuadrantDouble(x1: number, y1: number,
        x2: number, y2: number): number;
    public static GetQuadrantDouble(...args: unknown[]): number {
        switch (args.length) {
            case 2: {
                const [pt1, pt2] = args as [POINT2, POINT2];


                let nQuadrant: number = 1;
                try {
                    if (pt2.x >= pt1.x && pt2.y <= pt1.y) {
                        nQuadrant = 1;
                    }
                    if (pt2.x >= pt1.x && pt2.y >= pt1.y) {
                        nQuadrant = 2;
                    }
                    if (pt2.x <= pt1.x && pt2.y >= pt1.y) {
                        nQuadrant = 3;
                    }
                    if (pt2.x <= pt1.x && pt2.y <= pt1.y) {
                        nQuadrant = 4;
                    }

                } catch (exc) {
                    if (exc instanceof Error) {
                        ErrorLogger.LogException(LineUtility._className, "GetQuadrantDouble",
                            exc);
                    } else {
                        throw exc;
                    }
                }
                return nQuadrant;


                break;
            }

            case 4: {
                const [x1, y1, x2, y2] = args as [number, number, number, number];


                let nQuadrant: number = 1;
                try {
                    //            if(pt2.x>=pt1.x && pt2.y<=pt1.y)
                    //                    nQuadrant=1;
                    //            if(pt2.x>=pt1.x && pt2.y>=pt1.y)
                    //                    nQuadrant=2;
                    //            if(pt2.x<=pt1.x && pt2.y>=pt1.y)
                    //                    nQuadrant=3;
                    //            if(pt2.x<=pt1.x && pt2.y<=pt1.y)
                    //                    nQuadrant=4;

                    if (x2 >= x1 && y2 <= y1) {
                        nQuadrant = 1;
                    }
                    if (x2 >= x1 && y2 >= y1) {
                        nQuadrant = 2;
                    }
                    if (x2 <= x1 && y2 >= y1) {
                        nQuadrant = 3;
                    }
                    if (x2 <= x1 && y2 <= y1) {
                        nQuadrant = 4;
                    }
                } catch (exc) {
                    if (exc instanceof Error) {
                        ErrorLogger.LogException(LineUtility._className, "GetQuadrantDouble",
                            exc);
                    } else {
                        throw exc;
                    }
                }
                return nQuadrant;


                break;
            }

            default: {
                throw Error(`Invalid number of arguments`);
            }
        }
    }


    /**
     * Returns the smallest x and y pixel values from an array of points
     *
     * @param ptsSeize array of points from which to find minimum vaules
     * @param vblCounter the number of points to test in the array
     * @param x OUT - an object with a member to hold the xminimum
     * @param y OUT - an object with a member to hold the y minimum value
     *
     */
    public static GetPixelsMin(ptsSeize: POINT2[],
        vblCounter: number): { x: number, y: number } {
        let xmin: number = Number.POSITIVE_INFINITY;
        let ymin: number = Number.POSITIVE_INFINITY;
        try {
            let j: number = 0;

            for (j = 0; j < vblCounter; j++) {
                if (ptsSeize[j].x < xmin) {
                    xmin = ptsSeize[j].x;
                }
                if (ptsSeize[j].y < ymin) {
                    ymin = ptsSeize[j].y;
                }
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "GetPixelsMin",
                    exc);
            } else {
                throw exc;
            }
        }
        return { x: xmin, y: ymin };
    }

    /**
     * Returns the largest x and y pixel values from an array of points
     *
     * @param ptsSeize array of points from which to find maximum values
     * @param vblCounter the number of points to test in the array
     * @param x OUT - an object with a member to hold the x maximum value
     * @param y OUT - an object with a member to hold the y maximum value
     *
     */
    public static GetPixelsMax(ptsSeize: POINT2[],
        vblCounter: number): { x: number, y: number } {
        let xmax: number = Number.NEGATIVE_INFINITY;
        let ymax: number = Number.NEGATIVE_INFINITY;
        try {
            let j: number = 0;

            for (j = 0; j < vblCounter; j++) {
                if (ptsSeize[j].x > xmax) {
                    xmax = ptsSeize[j].x;
                }
                if (ptsSeize[j].y > ymax) {
                    ymax = ptsSeize[j].y;
                }
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "GetPixelsMax",
                    exc);
            } else {
                throw exc;
            }
        }
        return { x: xmax, y: ymax };
    }

    /**
     * Returns center point for a clockwise arc to connect pts 1 and 2. Also
     * returns an extended point on the line between pt1 and the new center
     * Caller passes a POINT1 array of size 2 for ptsSeize, passes pt1 and pt2
     * in ptsSeize Returns the radius of the 90 degree arc between C (arc
     * center) and pt1
     *
     * @param ptsSeize OUT - two point array also used for the returned two
     * points
     *
     * @return the radius
     */
    static calcClockwiseCenter(ptsSeize: POINT2[]): number {
        let dRadius: number = 0;
        try {
            //declarations
            let pt1: POINT2 = new POINT2(ptsSeize[0]);
            let pt2: POINT2 = new POINT2(ptsSeize[1]);
            let C: POINT2 = new POINT2(pt1);
            let midPt: POINT2 = new POINT2(pt1);	//the center to calculate
            let E: POINT2 = new POINT2(pt1);	//the extended point to calculate
            let ptYIntercept: POINT2 = new POINT2(pt1);
            let nQuadrant: number = 1;
            let b: number = 0;
            let b1: number = 0;
            let b2: number = 0;
            let dLength: number = 0;
            let ptsTemp: POINT2[] = new Array<POINT2>(2);
            //end declarations

            //must offset the points if necessary because there will be calculations
            //extending from the Y Intercept
            ptsTemp[0] = new POINT2(pt1);
            ptsTemp[1] = new POINT2(pt2);
            let offsetMin = LineUtility.GetPixelsMin(ptsTemp, 2);
            let offsetXVal: number = offsetMin.x;
            if (offsetXVal < 0) {
                offsetXVal = offsetXVal - 100;
            } else {
                offsetXVal = 0;
            }
            //end section

            midPt.x = (pt1.x + pt2.x) / 2;
            midPt.y = (pt1.y + pt2.y) / 2;
            dLength = LineUtility.calcDistance(pt1, pt2);
            dRadius = dLength / Math.sqrt(2);
            nQuadrant = LineUtility.GetQuadrantDouble(pt1, pt2);

            const { result: bolVertical, slope: mVal } = LineUtility.calcTrueSlope(pt1, pt2);
            if (bolVertical !== 0 && mVal !== 0) //line not vertical or horizontal
            {
                b = pt1.y - mVal * pt1.x;
                //y intercept of line perpendicular to midPt of pt,p2
                b1 = midPt.y + (1 / mVal) * midPt.x;
                //we want to shift the Y axis to the left by offsetX
                //so we get the new Y intercept at x=offsetX
                b2 = (-1 / mVal) * offsetXVal + b1;
                ptYIntercept.x = offsetXVal;
                ptYIntercept.y = b2;
                switch (nQuadrant) {
                    case 1:
                    case 4: {
                        C = LineUtility.ExtendLineDouble(ptYIntercept, midPt, dLength / 2);
                        break;
                    }

                    case 2:
                    case 3: {
                        C = LineUtility.ExtendLineDouble(ptYIntercept, midPt, -dLength / 2);
                        break;
                    }

                    default: {
                        break;
                    }

                }
            }
            if (bolVertical !== 0 && mVal === 0) //horizontal line
            {
                C.x = midPt.x;
                if (pt1.x < pt2.x) {
                    C.y = midPt.y + dLength / 2;
                } else {
                    C.y = midPt.y - dLength / 2;
                }
            }
            if (bolVertical === 0) //vertical line
            {
                ptYIntercept.x = offsetXVal;
                ptYIntercept.y = midPt.y;
                switch (nQuadrant) {
                    case 1:
                    case 4: {
                        C = LineUtility.ExtendLineDouble(ptYIntercept, midPt, dLength / 2);
                        break;
                    }

                    case 2:
                    case 3: {
                        C = LineUtility.ExtendLineDouble(ptYIntercept, midPt, -dLength / 2);
                        break;
                    }

                    default: {
                        break;
                    }

                }
            }

            E = LineUtility.ExtendLineDouble(C, pt1, 50);
            ptsSeize[0] = new POINT2(C);
            ptsSeize[1] = new POINT2(E);
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "calcClockwiseCenter",
                    exc);
            } else {
                throw exc;
            }
        }
        return dRadius;
    }

    /**
     * Computes the points for an arrowhead based on a line segment
     *
     * @param startLinePoint segment start point
     * @param endLinePoint segment end point
     * @param nBiSector bisecotr in pixels
     * @param nBase base size in pixels
     * @param pResultLinePoints OUT - the arrowhead points
     * @param styl the line style to assign the last aroowhead point
     */
    static GetArrowHead4Double(startLinePoint: POINT2,
        endLinePoint: POINT2,
        nBiSector: number,
        nBase: number,
        pResultLinePoints: POINT2[],
        styl: number): void {
        try {
            //declarations
            let j: number = 0;
            let dy: number = (endLinePoint.y - startLinePoint.y) as number;
            let
                dx: number = (endLinePoint.x - startLinePoint.x) as number;
            let
                dSign: number = 1.0;
            let
                AHBY: number = 0;
            let
                AHBX: number = 0;
            let
                AHBLY: number = 0;
            let
                AHBLX: number = 0;
            let
                AHBRY: number = 0;
            let
                AHBRX: number = 0;
            let
                dAngle: number = 0;
            let
                dHypotenuse: number = 0;

            let tempLinePoint: POINT2 = new POINT2(startLinePoint);
            //end declarations

            if (dy === 0) {
                if (dx > 0) {
                    dAngle = Math.PI;
                } else {
                    dAngle = 0;
                }
            } else {
                dAngle = Math.atan(dx / dy) + Math.PI / 2;
            }

            tempLinePoint.style = 0;//PS_SOLID;

            if (dx <= 0.0 && dy <= 0.0) {
                dSign = -1.0;
            }
            if (dx >= 0.0 && dy <= 0.0) {
                dSign = -1.0;
            }
            if (dx <= 0.0 && dy >= 0.0) {
                dSign = 1.0;
            }
            if (dx >= 0.0 && dy >= 0.0) {
                dSign = 1.0;
            }

            dHypotenuse = dSign * nBiSector as number;

            //Find x, y for Arrow Head nBase startLinePoint POINT1
            AHBX = endLinePoint.x as number + dHypotenuse * Math.cos(dAngle);
            AHBY = endLinePoint.y as number - dHypotenuse * Math.sin(dAngle);

            //Half of the arrow head's length will be 10 units
            dHypotenuse = dSign * (nBase / 2.0) as number;

            //Find x, y of Arrow Head nBase Left side end POINT1
            AHBLX = AHBX - dHypotenuse * Math.sin(dAngle);
            AHBLY = AHBY - dHypotenuse * Math.cos(dAngle);

            //Find x, y of Arrow Head nBase Right side end POINT1
            AHBRX = AHBX + dHypotenuse * Math.sin(dAngle);
            AHBRY = AHBY + dHypotenuse * Math.cos(dAngle);

            //replacement, just trying to return the POINT1s
            tempLinePoint.x = AHBLX as number;
            tempLinePoint.y = AHBLY as number;
            pResultLinePoints[0] = new POINT2(tempLinePoint);
            pResultLinePoints[1] = new POINT2(endLinePoint);
            tempLinePoint.x = AHBRX as number;
            tempLinePoint.y = AHBRY as number;
            pResultLinePoints[2] = new POINT2(tempLinePoint);
            switch (styl) {
                case 0: {
                    for (j = 0; j < 2; j++) {
                        pResultLinePoints[j].style = 0;
                    }
                    pResultLinePoints[2].style = 5;
                    break;
                }

                case 9: {
                    for (j = 0; j < 2; j++) {
                        pResultLinePoints[j].style = 9;
                    }
                    pResultLinePoints[2].style = 10;
                    break;
                }

                case 18: {
                    for (j = 0; j < 2; j++) {
                        pResultLinePoints[j].style = 18;
                    }
                    pResultLinePoints[2].style = 5;
                    break;
                }

                default: {
                    for (j = 0; j < 2; j++) {
                        pResultLinePoints[j].style = styl;
                    }
                    pResultLinePoints[2].style = 5;
                    break;
                }

            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "GetArrowhead4Double",
                    exc);
            } else {
                throw exc;
            }
        }
    }

    /**
     * Returns the midpoint between two points.
     *
     * @param pt0 the first point
     * @param pt1 the second point
     * @param styl the style to assign the mid point
     *
     * @return the mid point
     */
    public static midPoint(pt0: POINT2,
        pt1: POINT2,
        styl: number): POINT2 {
        let ptResult: POINT2 = new POINT2(pt0);
        try {
            ptResult.x = (pt0.x + pt1.x) / 2;
            ptResult.y = (pt0.y + pt1.y) / 2;
            ptResult.style = styl;
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "midPoint",
                    exc);
            } else {
                throw exc;
            }
        }
        return ptResult;
    }

    /**
     * Rotates an the first vblCounter points in the array about its first point
     *
     * @param pLinePoints OUT - the points to rotate
     * @param vblCounter the number of points to rotate
     * @param lAngle the angle in degrees to rotate
     *
     * @return pLinePoints
     */
    protected static RotateGeometryDoubleOrigin(pLinePoints: POINT2[],
        vblCounter: number,
        lAngle: number): POINT2[] {
        try {
            //declarations
            let j: number = 0;
            let dRotate: number = 0;
            let
                dTheta: number = 0;
            let
                dGamma: number = 0;
            let
                x: number = 0;
            let
                y: number = 0;
            //end declarations

            if (lAngle !== 0) {
                let pdCenter: POINT2 = new POINT2();
                dRotate = lAngle as number * Math.PI / 180;
                //pdCenter = CalcCenterPointDouble(pLinePoints,vblCounter);
                pdCenter = new POINT2(pLinePoints[0]);

                for (j = 0; j < vblCounter; j++) {
                    dGamma = Math.PI + Math.atan((pLinePoints[j].y - pdCenter.y)
                        / (pLinePoints[j].x - pdCenter.x));

                    if (pLinePoints[j].x >= pdCenter.x) {
                        dGamma = dGamma + Math.PI;
                    }

                    dTheta = dRotate + dGamma;
                    y = LineUtility.calcDistance(pLinePoints[j], pdCenter) * Math.sin(dTheta);
                    x = LineUtility.calcDistance(pLinePoints[j], pdCenter) * Math.cos(dTheta);
                    pLinePoints[j].y = pdCenter.y + y;
                    pLinePoints[j].x = pdCenter.x + x;
                }	//end for

                return pLinePoints;
            }	//end if
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "RotateGeometryDoubleOrigin",
                    exc);
            } else {
                throw exc;
            }
        }
        return pLinePoints;
    }  // end function

    /**
     * Returns a point a distance d pixels perpendicular to the pt0-pt1 line and
     * going toward pt2
     *
     * @param pt0 the first line point
     * @param pt1 the second line point
     * @param pt2 the relative line point
     * @param d the distance in pixels
     * @param styl the linestyle to assign the computed point
     *
     * @return the extended point
     */
    public static extendTrueLinePerp(pt0: POINT2,
        pt1: POINT2,
        pt2: POINT2,
        d: number,
        styl: number): POINT2 {
        let ptResult: POINT2 = new POINT2(pt0);
        try {
            let ptYIntercept: POINT2 = new POINT2(pt0);
            let b: number = 0;
            let b1: number = 0;	//b is the normal Y intercept (at 0)
            			//b1 is the y intercept at offsetX

            //must obtain x minimum to get the y-intercept to the left of
            //the left-most point
            let pts: POINT2[] = new Array<POINT2>(3);
            pts[0] = new POINT2(pt0);
            pts[1] = new POINT2(pt1);
            pts[2] = new POINT2(pt2);
            const offsetMin = LineUtility.GetPixelsMin(pts, 3);
            let offsetXVal: number = offsetMin.x;

            if (offsetXVal <= 0) //was < 0
            {
                offsetXVal = offsetXVal - 100;
            } else {
                offsetXVal = 0;
            }
            //end section

            const { result: nTemp, slope: mVal } = LineUtility.calcTrueSlope(pt0, pt1);
            switch (nTemp) {
                case 0: {	//vertical line
                    if (pt0.y < pt1.y) {
                        ptResult.x = pt2.x - d;
                        ptResult.y = pt2.y;
                    } else {
                        ptResult.x = pt2.x + d;
                        ptResult.y = pt2.y;
                    }
                    break;
                }

                default: {	//non-vertical line
                    if (mVal === 0) {
                        ptResult.x = pt2.x;
                        ptResult.y = pt2.y + d;
                    } else {
                        b = pt2.y as number + (1 / mVal) * pt2.x as number;
                        //we need the y-intercept at the -offset
                        b1 = (-1 / mVal) * offsetXVal + b;
                        ptYIntercept.x = offsetXVal;
                        ptYIntercept.y = b1;
                        ptResult = LineUtility.ExtendLineDouble(ptYIntercept, pt2, d);
                    }
                    break;
                }

            }
            ptResult.style = styl;
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "extendTrueLinePerp",
                    exc);
            } else {
                throw exc;
            }
        }
        return ptResult;
    }

    /**
     * Calculates the intersection of 2 lines pelative to a point. if one of the
     * lines is vertical use a distance dWidth above or below the line. pass
     * bolVertical1 = 1, or bolVertical2 = 1 if either line segment is vertical,
     * else pass 0. return the unique intersection in X,Y pointers. p2 is the
     * point that connects the 2 line segments to which the intersecting lines
     * are related, i.e. the intersecting lines are a distance dWidth pixels
     * above or below p2. uses dWidth and lOrient for cases in which at least
     * one of the lines is vertical. for normal lines this function assumes the
     * caller has passed the m, b for the appropriate upper or lower lines to
     * get the desired intgercept. this function is used for calculating the
     * upper and lower channel lines for channel types. For lOrient: see
     * comments in Channels.ConnectTrueDouble2
     *
     * @param m1 slope of the first line
     * @param b1 intercept of the first line
     * @param m2 slope of the second line
     * @param b2 y intercept of the second line
     * @param p2 point that connects the 2 line segments to which the
     * intersecting lines are related
     * @param bolVerticalSlope1 1 if first segment is vertical, else 0
     * @param bolVerticalSlope2 1 if second line segment is vertical, else 0
     * @param dWidth the distance of the intersecting lines from p2 in pixels
     * @param lOrient the orientation of the intersecting lines relative to the
     * segments connecting p2
     * @param X OUT - object holds the x value of the intersection point
     * @param Y OUT - object holds the y value of the intersection point
     */
    static calcTrueIntersectAbs(m1: number,
        b1: number,
        m2: number,
        b2: number,
        p2: POINT2, //can use for vertical lines
        bolVerticalSlope1: number,
        bolVerticalSlope2: number,
        dWidth: number, //use for vertical lines, use + for upper line, - for lower line
        lOrient: number): { result: number, x: number, y: number }
    {
        let xVal: number = p2.x;
        let yVal: number = p2.y;

        try {
            //case both lines are vertical
            let dWidth2: number = Math.abs(dWidth);
            let b: number = 0;
            let dx: number = 0;
            let dy: number = 0;
            let m: number = 0;

            //cannot get out of having to do this
            //the problem is caused by inexact slopes which are created by
            //clsLineUtility.DisplayIntersectPixels. This occurs when setting
            //pt2 or pt3 with X or Y on the boundary +/-maxPixels
            //if you try to walk out until you get exactly the same slope
            //it can be thousands of pixels, so you have to accept an arbitrary
            //and, unfortuantely, inexact slope
            if (m1 !== m2 && Math.abs(m1 - m2) <= Number.MIN_VALUE) {
                m1 = m2;
            }
            if (b1 !== b2 && Math.abs(b1 - b2) <= Number.MIN_VALUE) {
                b1 = b2;
            }

            //M. Deutch 10-24-11
            if (b1 === b2 && m1 + b1 === m2 + b2) {
                m1 = m2;
            }

            if (bolVerticalSlope1 === 0 && bolVerticalSlope2 === 0) //both lines vertical
            {
                switch (lOrient) {
                    case 0: {
                        xVal = p2.x - dWidth2;
                        yVal = p2.y;
                        break;
                    }

                    case 3: {
                        xVal = p2.x + dWidth2;
                        yVal = p2.y;
                        break;
                    }

                    default: {	//can never occur
                        xVal = p2.x;
                        yVal = p2.y;
                        break;
                    }

                }
                return { result: 1, x: xVal, y: yVal };
            }
            if (bolVerticalSlope1 === 0 && bolVerticalSlope2 !== 0) //line1 vertical, line2 is not
            {	//there is a unique intersection
                switch (lOrient) {
                    case 0:	//Line1 above segment1
                    case 1: {
                        xVal = p2.x - dWidth2;
                        yVal = m2 * xVal + b2;
                        break;
                    }

                    case 2:	//Line1 below segment1
                    case 3: {
                        xVal = p2.x + dWidth2;
                        yVal = m2 * xVal + b2;
                        break;
                    }

                    default: {	//can not occur
                        xVal = p2.x;
                        yVal = p2.y;
                        break;
                    }

                }
                return { result: 1, x: xVal, y: yVal };
            }
            if (bolVerticalSlope2 === 0 && bolVerticalSlope1 !== 0) //line2 vertical, line1 is not
            {	//there is a unique intersection
                switch (lOrient) {
                    case 0:	//Line1 above segment2
                    case 2: {
                        xVal = p2.x - dWidth2;
                        yVal = m1 * (xVal) + b1;
                        break;
                    }

                    case 1:	//Line1 below segment2
                    case 3: {
                        xVal = p2.x + dWidth2;
                        yVal = m1 * (xVal) + b1;
                        break;
                    }

                    default: {	//can not occur
                        xVal = p2.x;
                        yVal = p2.y;
                        break;
                    }

                }
                return { result: 1, x: xVal, y: yVal };
            }//end if

            //must deal with this case separately because normal lines use m1-m2 as a denominator
            //but we've handled all the vertical cases above so can assume it's not vertical
            //if the b's are different then one is an upper line, the other is a lower, no intersection
            //m and b will be used to build the perpendicular line thru p2 which we will use to
            //build the intersection, so must assume slopes are not 0, handle separately
            if (m1 === m2 && m1 !== 0) {
                if (b1 === b2) //then the intercept is the point joining the 2 segments
                {
                    //build the perpendicular line
                    m = -1 / m1;
                    b = p2.y - m * p2.x;
                    xVal = (b2 - b) / (m - m2);	//intersect the lines (cannot blow up, m = m2 not possible)
                    yVal = (m1 * (xVal) + b1);
                    return { result: 1, x: xVal, y: yVal };
                } else //can not occur
                {
                    xVal = p2.x;
                    yVal = p2.y;
                    return { result: 1, x: xVal, y: yVal };
                }
            }
            //slope is zero
            if (m1 === m2 && m1 === 0) {
                switch (lOrient) {
                    case 0:	//Line1 above the line
                    case 1: {	//should never happen
                        xVal = p2.x;
                        yVal = p2.y - dWidth2;
                        break;
                    }

                    case 3:	//Line1 below the line
                    case 2: {	//should never happen
                        xVal = p2.x;
                        yVal = p2.y + dWidth2;
                        break;
                    }

                    default: {	//can not occur
                        xVal = p2.x;
                        yVal = p2.y;
                        break;
                    }

                }
                return { result: 1, x: xVal, y: yVal };
            }

            if (m1 === m2 && b1 === b2 && bolVerticalSlope1 !== 0 && bolVerticalSlope2 !== 0) {
                switch (lOrient) {
                    case 0: {	//Line1 is above the line
                        if (m1 < 0) {
                            dy = m1 * dWidth / Math.sqrt(1 + m1 * m1);	//dy is negative
                            dx = dy / m1;	//dx is negative
                            xVal = p2.x + dx;
                            yVal = p2.y + dy;
                        }
                        if (m1 > 0) //slope is positive
                        {
                            dy = -m1 * dWidth / Math.sqrt(1 + m1 * m1);	//dy is negative
                            dx = -dy / m1;	//dx is positive
                            xVal = p2.x + dx;
                            yVal = p2.y + dy;
                        }
                        break;
                    }

                    case 3: {	//Line1 is below the line
                        if (m1 <= 0) {
                            dy = -m1 * dWidth / Math.sqrt(1 + m1 * m1);	//dy is positive
                            dx = dy / m1;	//dx is positive
                            xVal = p2.x + dx;
                            yVal = p2.y + dy;
                        } else {
                            dy = m1 * dWidth / Math.sqrt(1 + m1 * m1);	//dy is positive
                            dx = -dy / m1;	//dx is negative
                            xVal = p2.x + dx;
                            yVal = p2.y + dy;
                        }
                        break;
                    }

                    default: {
                        xVal = p2.x;
                        yVal = p2.y;
                        break;
                    }

                }
                return { result: 1, x: xVal, y: yVal };
            }//end if

            //a normal line. no vertical or identical slopes
            //if m1=m2 function will not reach this point
            xVal = (b2 - b1) / (m1 - m2);	//intersect the lines
            yVal = (m1 * (xVal) + b1);
            return { result: 1, x: xVal, y: yVal };
        } catch (exc) {
            if (exc instanceof Error) {
                xVal = p2.x;
                yVal = p2.y;
                ErrorLogger.LogException(LineUtility._className, "calcTrueIntersectAbs",
                    exc);
            } else {
                throw exc;
            }
        }
        return { result: 1, x: xVal, y: yVal };
    }

    /**
     * Returns the distance in pixels from x1,y1 to x2,y2
     *
     * @param x1 first point x location in pixels
     * @param y1 first point y location in pixels
     * @param x2 second point x location in pixels
     * @param y2 second point y location in pixels
     *
     * @return the distance
     */
    static CalcDistance2(x1: number,
        y1: number,
        x2: number,
        y2: number): number {
        let dResult: number = 0;
        try {
            dResult = Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2));

            //sanity check
            //return x or y distance if return value is 0 or infinity
            let xdist: number = Math.abs(x1 - x2);
            let ydist: number = Math.abs(y1 - y2);
            let max: number = xdist;
            if (ydist > xdist) {
                max = ydist;
            }
            if (dResult === 0 || !Number.isFinite(dResult)) {
                if (max > 0) {
                    dResult = max;
                }
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "CalcDistance2",
                    exc);
            } else {
                throw exc;
            }
        }
        return dResult;
    }
    /**
     * gets the middle line for Rev B air corridors AC, LLTR, MRR, UAV
     * Middle line is handled separately now because the line may have been segmented
     * @param pLinePoints
     * @return 
     */
    protected static GetSAAFRMiddleLine(pLinePoints: POINT2[]): POINT2[] {
        let pts: POINT2[];
        try {
            let j: number = 0;
            let count: number = 0;
            for (j = 0; j < pLinePoints.length - 1; j++) {
                if (pLinePoints[j].style > 0) {
                    count++;
                }
            }
            pts = new Array<POINT2>(count * 2);
            count = 0;
            let dMRR: number = 0;
            let firstSegPt: POINT2;
            let lastSegPt: POINT2 | null = null;
            let pt0: POINT2;
            let pt1: POINT2;
            for (j = 0; j < pLinePoints.length; j++) {
                if (pLinePoints[j].style >= 0 || j === pLinePoints.length - 1) {
                    if (lastSegPt != null) {
                        firstSegPt = new POINT2(lastSegPt);
                        lastSegPt = new POINT2(pLinePoints[j]);
                        dMRR = firstSegPt.style;
                        pt0 = LineUtility.extendLine(lastSegPt, firstSegPt, -dMRR, 0);
                        pt1 = LineUtility.extendLine(firstSegPt, lastSegPt, -dMRR, 5);
                        pts[count++] = pt0;
                        pts[count++] = pt1;
                    }
                    else {
                        lastSegPt = new POINT2(pLinePoints[j]);
                    }
                }
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "GetSAAFRMiddleLine",
                    exc);
            } else {
                throw exc;
            }
        }
        return pts;
    }
    /**
     * Computes the points for a SAAFR segment
     *
     * @param pLinePoints OUT - the client points also used for the returned
     * points
     * @param lineType the line type
     * @param dMRR the symbol width
     */
    static GetSAAFRSegment(pLinePoints: POINT2[],
        lineType: number,
        dMRR: number): void {
        try {
            let pt0: POINT2 = new POINT2();
            let pt1: POINT2 = new POINT2();
            let pt2: POINT2 = new POINT2();
            let pt3: POINT2 = new POINT2();
            let pt4: POINT2 = new POINT2();
            let pt5: POINT2 = new POINT2();
            const { result: bolVertical, slope: mVal } = LineUtility.calcTrueSlope(pLinePoints[0], pLinePoints[1]);
            //shortened line
            //pt1=extendLine(pLinePoints[0],pLinePoints[1],-dMRR/2,5);
            //pt0=extendLine(pLinePoints[1],pLinePoints[0],-dMRR/2,0);
            pt1 = LineUtility.extendLine(pLinePoints[0], pLinePoints[1], -dMRR, 5);
            pt0 = LineUtility.extendLine(pLinePoints[1], pLinePoints[0], -dMRR, 0);
            if (bolVertical !== 0 && mVal < 1) {
                //upper line
                pt2 = LineUtility.ExtendDirectedLine(pLinePoints[0], pLinePoints[1], pLinePoints[0], 2, dMRR);
                pt2.style = 0;
                pt3 = LineUtility.ExtendDirectedLine(pLinePoints[0], pLinePoints[1], pLinePoints[1], 2, dMRR);
                pt3.style = 5;
                //lower line
                pt4 = LineUtility.ExtendDirectedLine(pLinePoints[0], pLinePoints[1], pLinePoints[0], 3, dMRR);
                pt4.style = 0;
                pt5 = LineUtility.ExtendDirectedLine(pLinePoints[0], pLinePoints[1], pLinePoints[1], 3, dMRR);
                pt5.style = 5;
            } //if( (bolVertical!=0 && m>1) || bolVertical==0)
            else {
                //left line
                pt2 = LineUtility.ExtendDirectedLine(pLinePoints[0], pLinePoints[1], pLinePoints[0], 0, dMRR);
                pt2.style = 0;
                pt3 = LineUtility.ExtendDirectedLine(pLinePoints[0], pLinePoints[1], pLinePoints[1], 0, dMRR);
                pt3.style = 5;
                //right line
                pt4 = LineUtility.ExtendDirectedLine(pLinePoints[0], pLinePoints[1], pLinePoints[0], 1, dMRR);
                pt4.style = 0;
                pt5 = LineUtility.ExtendDirectedLine(pLinePoints[0], pLinePoints[1], pLinePoints[1], 1, dMRR);
                pt5.style = 5;
            }
            //load the line points
            pLinePoints[0] = new POINT2(pt0);
            pLinePoints[1] = new POINT2(pt1);
            pLinePoints[2] = new POINT2(pt2);
            pLinePoints[3] = new POINT2(pt3);
            pLinePoints[4] = new POINT2(pt4);
            pLinePoints[5] = new POINT2(pt5);
            pLinePoints[5].style = 5;
            pLinePoints[0].style = 5;
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "GetSAAFRSegment",
                    exc);
            } else {
                throw exc;
            }
        }
    }
    /**
     * Called by arraysupport for SAAFR and AC fill shapes
     * @param pLinePoints
     * @param dMRR
     */
    static GetSAAFRFillSegment(pLinePoints: POINT2[],
        dMRR: number): void {
        try {
            let pt2: POINT2 = new POINT2();
            let pt3: POINT2 = new POINT2();
            let pt4: POINT2 = new POINT2();
            let pt5: POINT2 = new POINT2();
            const { result: bolVertical, slope: mVal } = LineUtility.calcTrueSlope(pLinePoints[0], pLinePoints[1]);
            if (bolVertical !== 0 && mVal < 1) {
                //upper line
                pt2 = LineUtility.ExtendDirectedLine(pLinePoints[0], pLinePoints[1], pLinePoints[0], 2, dMRR);
                pt3 = LineUtility.ExtendDirectedLine(pLinePoints[0], pLinePoints[1], pLinePoints[1], 2, dMRR);
                //lower line
                pt4 = LineUtility.ExtendDirectedLine(pLinePoints[0], pLinePoints[1], pLinePoints[0], 3, dMRR);
                pt5 = LineUtility.ExtendDirectedLine(pLinePoints[0], pLinePoints[1], pLinePoints[1], 3, dMRR);
            } //if( (bolVertical!=0 && m>1) || bolVertical==0)
            else {
                //left line
                pt2 = LineUtility.ExtendDirectedLine(pLinePoints[0], pLinePoints[1], pLinePoints[0], 0, dMRR);
                pt3 = LineUtility.ExtendDirectedLine(pLinePoints[0], pLinePoints[1], pLinePoints[1], 0, dMRR);
                //right line
                pt4 = LineUtility.ExtendDirectedLine(pLinePoints[0], pLinePoints[1], pLinePoints[0], 1, dMRR);
                pt5 = LineUtility.ExtendDirectedLine(pLinePoints[0], pLinePoints[1], pLinePoints[1], 1, dMRR);
            }
            //load the line points
            pLinePoints[0] = new POINT2(pt2);
            pLinePoints[1] = new POINT2(pt3);
            pLinePoints[2] = new POINT2(pt5);
            pLinePoints[3] = new POINT2(pt4);
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "GetSAAFRFillSegment",
                    exc);
            } else {
                throw exc;
            }
        }
        //return;
    }
    /**
     * Computes an arc.
     *
     * @param pResultLinePoints OUT - contains center and start point and holds
     * the result arc points
     * @param vblCounter the number of client points
     * @param dRadius the arc radius in pixels
     * @param linetype the linetype determines start andgle and end angle for
     * the arc
     *
     */
    static arcArray(pResultLinePoints: POINT2[],
        vblCounter: number,
        dRadius: number,
        linetype: number,
        converter: IPointConversion | null): POINT2[] {
        try {
            //declarations
            let startangle: number = 0;
            let  //start of pArcLinePoints
                endangle: number = 0;
            let  //end of the pArcLinePoints
                increment: number = 0;
            let
                //m = 0,
                length: number = 0;
            let  //length of a to e
                M: number = 0;

            let j: number = 0;
            let numarcpts: number = 0;
            //C is the center of the pArcLinePoints derived from a and e
            let C: POINT2 = new POINT2(pResultLinePoints[0]);
            let
                a: POINT2 = new POINT2(pResultLinePoints[1]);
            let
                e: POINT2 = new POINT2(pResultLinePoints[0]);

            let pArcLinePoints: POINT2[];
            //end declarations

            const { result: bolVertical, slope: mVal } = LineUtility.calcTrueSlope(a, e);
            if (bolVertical !== 0) {
                M = Math.atan(mVal);
            } else {
                if (a.y < e.y) {
                    M = -Math.PI / 2;
                } else {
                    M = Math.PI / 2;
                }
            }
            if (converter != null) {
                let pt02d: Point2D = new Point2D(pResultLinePoints[0].x, pResultLinePoints[0].y);
                let pt12d: Point2D = new Point2D(pResultLinePoints[1].x, pResultLinePoints[1].y);
                //boolean reverseM=false;
                pt02d = converter.PixelsToGeo(pt02d);
                pt12d = converter.PixelsToGeo(pt12d);
                //M=Geodesic.GetAzimuth(pt02d,pt12d);
                M = Geodesic.GetAzimuth(new POINT2(pt02d.getX(), pt02d.getY()), new POINT2(pt12d.getX(), pt12d.getY()));
                M *= (Math.PI / 180);
                if (M < 0) {

                    M += Math.PI;
                }

            }
            length = LineUtility.calcDistance(a, e);
            if (converter != null) {
                let pt02d: Point2D = new Point2D(pResultLinePoints[0].x, pResultLinePoints[0].y);
                let pt12d: Point2D = new Point2D(pResultLinePoints[1].x, pResultLinePoints[1].y);
                pt02d = converter.PixelsToGeo(pt02d);
                pt12d = converter.PixelsToGeo(pt12d);
                //length=Geodesic.geodesic_distance(pt02d,pt12d,null,null);
                length = Geodesic.geodesic_distance(new POINT2(pt02d.getX(), pt02d.getY()), new POINT2(pt12d.getX(), pt12d.getY())).distance;
            }
            switch (linetype) {
                case TacticalLines.CLUSTER: {
                    startangle = M - 90 * Math.PI / 180.0;
                    endangle = startangle + 2 * 90 * Math.PI / 180.0;
                    break;
                }

                case TacticalLines.ISOLATE:
                case TacticalLines.CORDONKNOCK:
                case TacticalLines.CORDONSEARCH:
                case TacticalLines.AREA_DEFENSE: {
                    startangle = M;
                    endangle = startangle + 330 * Math.PI / 180;
                    break;
                }

                case TacticalLines.TURN_REVD:
                case TacticalLines.TURN: {
                    startangle = M;
                    endangle = startangle + 90 * Math.PI / 180;
                    break;
                }

                case TacticalLines.OCCUPY:
                case TacticalLines.RETAIN:
                case TacticalLines.SECURE: {
                    startangle = M;
                    //if(CELineArrayGlobals.Change1==false)
                    endangle = startangle + 338 * Math.PI / 180;
                    //else
                    //	endangle=startangle+330*pi/180;
                    break;
                }

                default: {
                    startangle = 0;
                    endangle = 2 * Math.PI;
                    break;
                }

            }

            if (a.x < e.x) {
                switch (linetype) {
                    case TacticalLines.ISOLATE:
                    case TacticalLines.CORDONKNOCK:
                    case TacticalLines.CORDONSEARCH:
                    case TacticalLines.AREA_DEFENSE: {
                        startangle = M - Math.PI;
                        endangle = startangle + 330 * Math.PI / 180;
                        break;
                    }

                    case TacticalLines.OCCUPY:
                    case TacticalLines.RETAIN:
                    case TacticalLines.SECURE: {
                        startangle = M - Math.PI;
                        //if(CELineArrayGlobals.Change1==false)
                        endangle = startangle + 338 * Math.PI / 180;
                        //else
                        //	endangle=startangle+330*pi/180;
                        break;
                    }

                    case TacticalLines.TURN_REVD:
                    case TacticalLines.TURN: {
                        startangle = M - Math.PI;
                        endangle = startangle + 90 * Math.PI / 180;
                        break;
                    }

                    case TacticalLines.CLUSTER: {
                        startangle = M - Math.PI + 90 * Math.PI / 180.0;
                        endangle = startangle - 2 * 90 * Math.PI / 180.0;
                        break;
                    }

                    default: {
                        break;
                    }

                }
            }

            numarcpts = 26;
            pArcLinePoints = new Array<POINT2>(numarcpts);
            LineUtility.InitializePOINT2Array(pArcLinePoints);
            increment = (endangle - startangle) / (numarcpts - 1);
            if (dRadius !== 0 && length !== 0) {
                C.x = (e.x as number - (dRadius / length)
                    * Math.trunc(a.x as number - e.x as number));
                C.y = (e.y as number - (dRadius / length)
                    * Math.trunc(a.y as number - e.y as number));
            }
            else {
                C.x = e.x;
                C.y = e.y;
            }
            if (converter != null) {
                let C2d: Point2D = new Point2D(pResultLinePoints[0].x, pResultLinePoints[0].y);
                C2d = converter.PixelsToGeo(C2d);
                let az: number = 0;
                let ptGeo2d: Point2D;
                let ptGeo: POINT2;
                let ptPixels: POINT2;
                for (j = 0; j < numarcpts; j++) {
                    az = startangle * 180 / Math.PI + j * increment * 180 / Math.PI;
                    //ptGeo=Geodesic.geodesic_coordinate(C2d,length,az);
                    ptGeo = Geodesic.geodesic_coordinate(new POINT2(C2d.getX(), C2d.getY()), length, az);
                    ptGeo2d = new Point2D(ptGeo.x, ptGeo.y);
                    ptGeo2d = converter.GeoToPixels(ptGeo2d);
                    ptPixels = new POINT2(ptGeo2d.getX(), ptGeo2d.getY());
                    pArcLinePoints[j].x = ptPixels.x;
                    pArcLinePoints[j].y = ptPixels.y;
                }
            }
            else {
                for (j = 0; j < numarcpts; j++) {
                    //pArcLinePoints[j]=pResultLinePoints[0];	//initialize
                    pArcLinePoints[j].x = Math.trunc(dRadius * Math.cos(startangle + j * increment));
                    pArcLinePoints[j].y = Math.trunc(dRadius * Math.sin(startangle + j * increment));
                }

                for (j = 0; j < numarcpts; j++) {
                    pArcLinePoints[j].x += C.x;
                    pArcLinePoints[j].y += C.y;
                }
            }
            for (j = 0; j < numarcpts; j++) {
                pResultLinePoints[j] = new POINT2(pArcLinePoints[j]);
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "arcArray",
                    exc);
            } else {
                throw exc;
            }
        }
        return pResultLinePoints;
    }
    /**
     * Gets geodesic circle using the converter
     * @param Center in pixels
     * @param pt1 a point on the radius in pixels
     * @param numpts number of points to return
     * @param CirclePoints the result points
     * @param converter 
     */
    static CalcCircleDouble2(Center: POINT2,
        pt1: POINT2,
        numpts: number,
        CirclePoints: POINT2[],
        converter: IPointConversion): void {
        try {
            let j: number = 0;
            let increment: number = (Math.PI * 2) / (numpts - 1);
            let ptCenter2d: Point2D = new Point2D(Center.x, Center.y);
            ptCenter2d = converter.PixelsToGeo(ptCenter2d);
            let pt12d: Point2D = new Point2D(pt1.x, pt1.y);
            pt12d = converter.PixelsToGeo(pt12d);
            Center = new POINT2(ptCenter2d.getX(), ptCenter2d.getY());
            pt1 = new POINT2(pt12d.getX(), pt12d.getY());
            let dist: number = Geodesic.geodesic_distance(Center, pt1).distance;

            //double dSegmentAngle = 2 * Math.PI / numpts;
            let az: number = 0;
            let startangle: number = 0;
            let endAngle: number = Math.PI * 2;
            let ptGeo: POINT2;
            let ptPixels: POINT2;
            let ptGeo2d: Point2D;
            for (j = 0; j < numpts - 1; j++) {
                az = startangle * 180 / Math.PI + j * increment * 180 / Math.PI;
                //ptGeo=Geodesic.geodesic_coordinate(C2d,length,az);
                ptGeo = Geodesic.geodesic_coordinate(Center, dist, az);
                ptGeo2d = new Point2D(ptGeo.x, ptGeo.y);
                ptGeo2d = converter.GeoToPixels(ptGeo2d);
                ptPixels = new POINT2(ptGeo2d.getX(), ptGeo2d.getY());
                CirclePoints[j].x = ptPixels.x;
                CirclePoints[j].y = ptPixels.y;
            }
            CirclePoints[numpts - 1] = new POINT2(CirclePoints[0]);

        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "CalcCircleDouble2",
                    exc);
            } else {
                throw exc;
            }
        }
        return;
    }
    /**
     * Computes the points for a circle. Assumes CirclePoints has been allocated
     * with size numpts.
     *
     * @param Center the cicle center
     * @param radius the circle radius in pixels
     * @param numpts the number of circle points
     * @param CirclePoints - OUT - array of circle points
     * @param styl the style to set the last circle point
     */
    static CalcCircleDouble(Center: POINT2,
        radius: number,
        numpts: number,
        CirclePoints: POINT2[],
        styl: number): void {
        try {
            let j: number = 0;
            let dSegmentAngle: number = 2 * Math.PI / (numpts - 1);
            let x: number = 0;
            let y: number = 0;
            for (j = 0; j < numpts - 1; j++) {
                x = Center.x + (radius * Math.cos(j as number * dSegmentAngle));
                y = Center.y + (radius * Math.sin(j as number * dSegmentAngle));
                CirclePoints[j] = new POINT2(x, y);
                CirclePoints[j].style = styl;
            }
            CirclePoints[numpts - 1] = new POINT2(CirclePoints[0]);

            switch (styl) {
                case 0: {
                    CirclePoints[numpts - 1].style = 0;
                    break;
                }

                case 9: {
                    CirclePoints[numpts - 1].style = 10;
                    break;
                }

                case 11: {
                    CirclePoints[numpts - 1].style = 12;
                    break;
                }

                default: {
                    CirclePoints[numpts - 1].style = 5;
                    break;
                }

            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "CalcCircleDouble",
                    exc);
            } else {
                throw exc;
            }
        }
    }

    static CalcCircleShape(Center: POINT2,
        radius: number,
        numpts: number,
        CirclePoints: POINT2[],
        styl: number): Shape2 {
        let shape: Shape2;
        if (styl === 9) {
            shape = new Shape2(Shape2.SHAPE_TYPE_FILL);
        } else {
            shape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
        }

        shape.style = styl;
        try {
            let j: number = 0;
            LineUtility.CalcCircleDouble(Center, radius, numpts, CirclePoints, styl);
            shape.moveTo(CirclePoints[0]);
            for (j = 1; j < numpts; j++) {
                shape.lineTo(CirclePoints[j]);
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "CalcCircleShape",
                    exc);
            } else {
                throw exc;
            }
        }
        return shape;
    }

    private static GetSquallCurve(StartPt: POINT2,
        EndPt: POINT2,
        pSquallPts: POINT2[],
        sign: number,
        amplitude: number,
        quantity: number): void {
        try {
            let dist: number = LineUtility.calcDistance(StartPt, EndPt);
            let ptTemp: POINT2 = new POINT2();
            let j: number = 0;
            //end declarations

            //get points along the horizontal segment between StartPt and EndPt2;
            for (j = 0; j < quantity; j++) {
                ptTemp = LineUtility.ExtendLineDouble(EndPt, StartPt, -dist * j as number / quantity as number);
                pSquallPts[j].x = ptTemp.x;
                //calculate the sin value along the x axis
                pSquallPts[j].y = ptTemp.y + amplitude * sign * Math.sin(j as number * 180 / quantity as number * Math.PI / 180);
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "GetSquallShape",
                    exc);
            } else {
                throw exc;
            }
        }
    }
    //caller needs to instantiate sign.value
    /**
     * Gets the squall curves for a line segment Assumes pSquallPts has been
     * allocated the proper number of points.
     *
     * @param StartPt segment start point
     * @param EndPt segment end point
     * @param pSquallPts OUT - the squall points
     * @param sign OUT - an object with a member to hold the starting curve sign
     * for the segment.
     * @param amplitude the sin curve amplitutde
     * @param quantity the number of points for each sin curve
     * @param length the desired length of the curve along the segment for each
     * sin curve
     *
     * @return segment squall points count
     */
    static GetSquallSegment(StartPt: POINT2,
        EndPt: POINT2,
        pSquallPts: POINT2[],
        signVal: number,
        amplitude: number,
        quantity: number,
        length: number): number {
        let counter: number = 0;
        try {
            let StartCurvePt: POINT2;
            let EndCurvePt: POINT2;	//use these for the curve points
            let pSquallPts2: POINT2[] = new Array<POINT2>(quantity);
            let dist: number = LineUtility.calcDistance(StartPt, EndPt);
            let numCurves: number = Math.trunc(dist / length as number);
            let j: number = 0;
            let k: number = 0;
            let EndPt2: POINT2 = new POINT2();
            let angle: number = Math.atan((StartPt.y - EndPt.y) / (StartPt.x - EndPt.x));
            let lAngle: number = Math.trunc((180 / Math.PI) * angle);
            LineUtility.InitializePOINT2Array(pSquallPts2);
            //define EndPt2 to be the point dist from StartPt along the x axis
            if (StartPt.x < EndPt.x) {
                EndPt2.x = StartPt.x + dist;
            } else {
                EndPt2.x = StartPt.x - dist;
            }

            EndPt2.y = StartPt.y;

            EndCurvePt = StartPt;
            let currentSign: number = signVal;
            for (j = 0; j < numCurves; j++) {
                StartCurvePt = LineUtility.ExtendLineDouble(EndPt2, StartPt, - (j * length) as number);
                EndCurvePt = LineUtility.ExtendLineDouble(EndPt2, StartPt, - ((j + 1) * length) as number);

                //get the curve points
                LineUtility.GetSquallCurve(StartCurvePt, EndCurvePt, pSquallPts2, currentSign, amplitude, quantity);

                //fill the segment points with the curve points
                for (k = 0; k < quantity; k++) {
                    //pSquallPts[counter].x=pSquallPts2[k].x;
                    //pSquallPts[counter].y=pSquallPts2[k].y;
                    pSquallPts[counter] = new POINT2(pSquallPts2[k]);
                    counter++;
                }
                //reverse the sign

                currentSign = -currentSign;
            }
            if (numCurves === 0) {
                pSquallPts[counter] = new POINT2(StartPt);
                counter++;
                pSquallPts[counter] = new POINT2(EndPt);
                counter++;
            }
            //the points are along the x axis. Rotate them about the first point as the origin
            LineUtility.RotateGeometryDoubleOrigin(pSquallPts, counter, lAngle);
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "GetSquallSegment",
                    exc);
            } else {
                throw exc;
            }
        }
        return counter;
    }

    //temporarily using 2000 pixels
    private static PointInBounds(pt: POINT2): number {
        try {
            //double maxPixels=CELineArrayGlobals.MaxPixels2;
            let maxPixels: number = 100000;//was 2000
            if (Math.abs(pt.x) <= maxPixels && Math.abs(pt.y) <= maxPixels) {
                return 1;
            } else {
                return 0;
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "PointInBounds",
                    exc);
            } else {
                throw exc;
            }
        }
        return 1;
    }

    /**
     * @param pt
     * @param ul
     * @param lr
     * @return
     */
    private static PointInBounds2(pt: POINT2, ul: POINT2, lr: POINT2): number {
        try {
            let maxX: number = lr.x;
            let minX: number = ul.x;
            let maxY: number = lr.y;
            let minY: number = ul.y;
            if (pt.x <= maxX && pt.x >= minX && pt.y <= maxY && pt.y >= minY) {
                return 1;
            } else {
                return 0;
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "PointInBounds2",
                    exc);
            } else {
                throw exc;
            }
        }
        return 1;
    }

    /**
     * Analyzes if line from pt0 to pt 1 intersects a side and returns the
     * intersection or null assumes pt0 to pt1 is not vertical. the caller will
     * replace pt0 with the intersection point if it is not null
     *
     * @param pt0
     * @param pt1
     * @param sidePt0 vertical or horizontal side first point
     * @param sidePt1
     * @return null if it does not intersect the side
     */
    private static intersectSegment(pt0: POINT2, pt1: POINT2, sidePt0: POINT2, sidePt1: POINT2): POINT2 | null {
        let pt: POINT2;
        try {
            if (pt0.x === pt1.x) {
                return null;
            }
            let m: number = (pt1.y - pt0.y) / (pt1.x - pt0.x);
            let dx: number = 0;
            let dy: number = 0;
            let x: number = 0;
            let y: number = 0;
            let upper: POINT2;
            let lower: POINT2;
            let left: POINT2;
            let right: POINT2;
            let bolVertical: boolean = false;
            //the side is either vertical or horizontal
            if (sidePt0.x === sidePt1.x) //vertical side
            {
                bolVertical = true;
                if (sidePt0.y < sidePt1.y) {
                    upper = sidePt0;
                    lower = sidePt1;
                } else {
                    upper = sidePt1;
                    lower = sidePt0;
                }
            } else //horizontal side
            {
                if (sidePt0.x < sidePt1.x) {
                    left = sidePt0;
                    right = sidePt1;
                } else {
                    left = sidePt1;
                    right = sidePt0;
                }
            }
            //travel in the direction from pt0 to pt1 to find the pt0 intersect
            if (bolVertical) {  //the side to intersect is vertical
                dx = upper.x - pt0.x;
                dy = m * dx;
                x = upper.x;
                y = pt0.y + dy;
                //the potential intersection point
                pt = new POINT2(x, y);

                if (pt0.x <= pt.x && pt.x <= pt1.x) //left to right
                {
                    if (upper.y <= pt.y && pt.y <= lower.y) {
                        return pt;
                    }
                } else {
                    if (pt0.x >= pt.x && pt.x >= pt1.x) //right to left
                    {
                        if (upper.y <= pt.y && pt.y <= lower.y) {
                            return pt;
                        }
                    }
                }

            } else //horizontal side
            {
                dy = left.y - pt0.y;
                dx = dy / m;
                x = pt0.x + dx;
                y = left.y;
                //the potential intersection point
                pt = new POINT2(x, y);

                if (pt0.y <= pt.y && pt.y <= pt1.y) {
                    if (left.x <= pt.x && pt.x <= right.x) {
                        return pt;
                    }
                } else {
                    if (pt0.y >= pt.y && pt.y >= pt1.y) {
                        if (left.x <= pt.x && pt.x <= right.x) {
                            return pt;
                        }
                    }
                }

            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "intersectSegment",
                    exc);
            } else {
                throw exc;
            }
        }
        return null;
    }

    /**
     * side 1 ----- | | side 0 | | side 2 | | ------ side 3 bounds one segment
     * for autoshapes that need it: bydif, fordif, fix, mnfldfix if null is
     * returned the client should conect the original line points (i.e. no
     * jaggies)
     *
     * @param pt0
     * @param pt1
     * @param ul
     * @param lr
     * @return bounded segment or null
     */
    public static BoundOneSegment(pt0: POINT2, pt1: POINT2, ul: POINT2, lr: POINT2): POINT2[] | null {
        let line: POINT2[] = new Array<POINT2>(2);
        try {
            if (pt0.y < ul.y && pt1.y < ul.y) {
                return null;
            }
            if (pt0.y > lr.y && pt1.y > lr.y) {
                return null;
            }
            if (pt0.x < ul.x && pt1.x < ul.x) {
                return null;
            }
            if (pt0.x > lr.x && pt1.x > lr.x) {
                return null;
            }

            let bolVertical: boolean = false;
            LineUtility.InitializePOINT2Array(line);
            if (pt0.x === pt1.x) {
                bolVertical = true;
            }

            if (bolVertical) {
                line[0] = new POINT2(pt0);
                if (line[0].y < ul.y) {
                    line[0].y = ul.y;
                }
                if (line[0].y > lr.y) {
                    line[0].y = lr.y;
                }

                line[1] = new POINT2(pt1);
                if (line[1].y < ul.y) {
                    line[1].y = ul.y;
                }
                if (line[1].y > lr.y) {
                    line[1].y = lr.y;
                }

                return line;
            }

            let dx: number = 0;
            let dy: number = 0;
            let x: number = 0;
            let y: number = 0;
            let m: number = (pt1.y - pt0.y) / (pt1.x - pt0.x);
            let side0Intersect: boolean = false;
            let
                side1Intersect: boolean = false;
            let
                side2Intersect: boolean = false;
            let
                side3Intersect: boolean = false;
            //travel in the direction from pt0 to pt1 to find pt0 intersect
            let ur: POINT2 = new POINT2(lr.x, ul.y);
            let ll: POINT2 = new POINT2(ul.x, lr.y);

            let pt0Intersect: POINT2;
            if (LineUtility.PointInBounds2(pt0, ul, lr) === 1) {
                pt0Intersect = pt0;
            }
            if (pt0Intersect == null) {
                pt0Intersect = LineUtility.intersectSegment(pt0, pt1, ll, ul);  //interesect side 0
                side0Intersect = true;
            }
            if (pt0Intersect == null) {
                pt0Intersect = LineUtility.intersectSegment(pt0, pt1, ul, ur);  //interesect side 1
                side1Intersect = true;
            }
            if (pt0Intersect == null) {
                pt0Intersect = LineUtility.intersectSegment(pt0, pt1, ur, lr);  //interesect side 2
                side2Intersect = true;
            }
            if (pt0Intersect == null) {
                pt0Intersect = LineUtility.intersectSegment(pt0, pt1, ll, lr);  //interesect side 3
                side3Intersect = true;
            }

            //travel in the direction from pt1 to pt0 to find pt1 intersect
            let pt1Intersect: POINT2;
            if (LineUtility.PointInBounds2(pt1, ul, lr) === 1) {
                pt1Intersect = pt1;
            }
            if (pt1Intersect == null && side0Intersect === false) {
                pt1Intersect = LineUtility.intersectSegment(pt1, pt0, ll, ul);  //interesect side 0
            }
            if (pt1Intersect == null && side1Intersect === false) {
                pt1Intersect = LineUtility.intersectSegment(pt1, pt0, ul, ur);  //interesect side 1
            }
            if (pt1Intersect == null && side2Intersect === false) {
                pt1Intersect = LineUtility.intersectSegment(pt1, pt0, ur, lr);  //interesect side 2
            }
            if (pt1Intersect == null && side3Intersect === false) {
                pt1Intersect = LineUtility.intersectSegment(pt1, pt0, ll, lr);  //interesect side 3
            }

            if (pt0Intersect != null && pt1Intersect != null) {
                line[0] = pt0Intersect;
                line[1] = pt1Intersect;
                //return line;
            } else {
                line = null;
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "BoundOneSegment",
                    exc);
            } else {
                throw exc;
            }
        }
        return line;
    }

    private static DisplayIntersectPixels(pt0: POINT2,
        pt1: POINT2): { result: number, pt2x: number, pt2y: number, pt3x: number, pt3y: number }
    {
        let nResult: number = -1;
        let pt2xVal: number = pt0.x;
        let pt2yVal: number = pt0.y;
        let pt3xVal: number = pt1.x;
        let pt3yVal: number = pt1.y;
        try {
            //declarations
            let X: number = 0;
            let Y: number = 0;
            //double maxPixels=CELineArrayGlobals.MaxPixels2;
            let maxPixels: number = 2000;
            //double maxX=lr.x,minX=ul.x,maxY=lr.y,minY=ul.y;

            let bol0Inside: number = 0;
            let bol1Inside: number = 0;
            const { result: bolVertical, slope: mVal } = LineUtility.calcTrueSlope(pt0, pt1);
            let b: number = pt0.y - mVal * pt0.x;	//the y intercept for the segment line
            let pt2: POINT2;
            let pt3: POINT2;
            //end declarations

            pt2 = new POINT2(pt0);
            pt3 = new POINT2(pt1);

            //diagnostic
            if (pt0.x <= maxPixels && pt0.x >= -maxPixels
                && pt0.y <= maxPixels && pt0.y >= -maxPixels) {
                bol0Inside = 1;
            }
            if (pt1.x <= maxPixels && pt1.x >= -maxPixels
                && pt1.y <= maxPixels && pt1.y >= -maxPixels) {
                bol1Inside = 1;
            }
            //if both points are inside the area then use the whole segment
            if (bol0Inside === 1 && bol1Inside === 1) {
                return { result: 0, pt2x: pt2xVal, pt2y: pt2yVal, pt3x: pt3xVal, pt3y: pt3yVal };
            }
            //if at leat one of the points is inside the area then use some of the segment
            if (bol0Inside === 1 || bol1Inside === 1) {
                nResult = 1;
            }

            //segment is not vertical
            if (bolVertical !== 0) {
                //analysis for side 0, get the intersection for either point if it exists
                //diagnostic
                X = -maxPixels;
                //X=minX;

                Y = mVal * X + b;
                if (pt0.x < -maxPixels && -maxPixels < pt1.x) //pt0 is outside the area
                {
                    if (-maxPixels <= Y && Y <= maxPixels) //intersection is on side 0
                    //if(minY<=Y && Y<=maxY)	//intersection is on side 0
                    {
                        pt2.x = X;
                        pt2.y = Y;
                        nResult = 1;	//use at least some of the pixels
                    }
                }
                if (pt1.x < -maxPixels && -maxPixels < pt0.x) //pt1 is outside the area
                //if(pt1.x<minX && minX<pt0.x)	//pt1 is outside the area
                {
                    if (-maxPixels <= Y && Y <= maxPixels) //intersection is on side 0
                    {
                        pt3.x = X;
                        pt3.y = Y;
                        nResult = 1;	//use at least some of the pixels
                    }
                }

                //analysis for side 1, get the intersection for either point if it exists
                Y = -maxPixels;
                if (mVal !== 0) {
                    X = (Y - b) / mVal;
                    if (pt0.y < -maxPixels && -maxPixels < pt1.y) //pt0 is outside the area
                    {
                        if (-maxPixels <= X && X <= maxPixels) //intersection is on side 1
                        {
                            pt2.x = X;
                            pt2.y = Y;
                            nResult = 1;	//use at least some of the pixels
                        }
                    }
                    if (pt1.y <= -maxPixels && -maxPixels <= pt0.y) //pt1 is outside the area
                    {
                        if (-maxPixels < X && X < maxPixels) //intersection is on the boundary
                        {
                            pt3.x = X;
                            pt3.y = Y;
                            nResult = 1;	//use at least some of the pixels
                        }
                    }
                }
                //analysis for side 2, get the intersection for either point if it exists
                X = maxPixels;
                Y = mVal * X + b;
                if (pt0.x < maxPixels && maxPixels < pt1.x) //pt1 is outside the area
                {
                    if (-maxPixels <= Y && Y <= maxPixels) //intersection is on the boundary
                    {
                        pt3.x = X;
                        pt3.y = Y;
                        nResult = 1;	//use at least some of the pixels
                    }
                }
                if (pt1.x < maxPixels && maxPixels < pt0.x) //pt0 is outside the area
                {
                    if (-maxPixels <= Y && Y <= maxPixels) //intersection is on the boundary
                    {
                        pt2.x = X;
                        pt2.y = Y;
                        nResult = 1;	//use at least some of the pixels
                    }
                }

                //analysis for side 3, get the intersection for either point if it exists
                Y = maxPixels;
                if (mVal !== 0) {
                    X = (Y - b) / mVal;
                    if (pt0.y < maxPixels && maxPixels < pt1.y) //pt1 is outside the area
                    {
                        if (-maxPixels <= X && X <= maxPixels) //intersection is on the boundary
                        {
                            pt3.x = X;
                            pt3.y = Y;
                            nResult = 1;	//use at least some of the pixels
                        }
                    }
                    if (pt1.y < maxPixels && maxPixels < pt0.y) //pt0 is outside the area
                    {
                        if (-maxPixels <= X && X <= maxPixels) //intersection is on the boundary
                        {
                            pt2.x = X;
                            pt2.y = Y;
                            nResult = 1;	//use at least some of the pixels
                        }
                    }
                }
            }

            //segment is vertical
            if (bolVertical === 0) {
                //analysis for side 1
                X = pt0.x;
                Y = -maxPixels;
                if (-maxPixels < pt0.x && pt0.x < maxPixels) {
                    if (pt0.y <= -maxPixels && -maxPixels <= pt1.y) //pt0 outside the area
                    {
                        pt2.x = X;
                        pt2.y = Y;
                        nResult = 1;	//use at least some of the pixels
                    }
                    if (pt1.y <= -maxPixels && -maxPixels <= pt0.y) //pt1 outside the area
                    {
                        pt3.x = X;
                        pt3.y = Y;
                        nResult = 1;	//use at least some of the pixels
                    }
                }

                //analysis for side 3
                X = pt0.x;
                Y = maxPixels;
                if (-maxPixels < pt0.x && pt0.x < maxPixels) {
                    if (pt0.y <= maxPixels && maxPixels <= pt1.y) //pt1 outside the area
                    {
                        pt3.x = X;
                        pt3.y = Y;
                        nResult = 1;	//use at least some of the pixels
                    }
                    if (pt1.y <= maxPixels && maxPixels <= pt0.y) //pt0 outside the area
                    {
                        pt2.x = X;
                        pt2.y = Y;
                        nResult = 1;	//use at least some of the pixels
                    }
                }
            }

            pt2xVal = pt2.x;
            pt2yVal = pt2.y;
            pt3xVal = pt3.x;
            pt3yVal = pt3.y;
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "DisplayIntersectPixels",
                    exc);
            } else {
                throw exc;
            }
        }
        return { result: nResult, pt2x: pt2xVal, pt2y: pt2yVal, pt3x: pt3xVal, pt3y: pt3yVal };
    }
    /**
     * Computes Ditch spikes for the ATDITCH line types. This function uses
     * linestyles provided by the caller to skip segments.
     *
     * @param pLinePoints OUT - the client points also used for the return
     * points
     * @param nOldCounter the number of client points
     * @param bWayIs the parallel line to use (0) for inner or outer spikes
     *
     * @return the symbol point count
     */
    static getDitchSpike(tg: TacticalGraphic, pLinePoints: POINT2[],
        nOldCounter: number,
        bWayIs: number): number {
        let nSpikeCounter: number = 0;
        try {
            //declarations
            let linetype: number = tg.lineType;
            let nNumberOfSegments: number = 0;
            let
                lCircleCounter: number = 0;
            let
                bolVertical: number = 0;
            let
                nTemp: number = 0;
            let
                i: number = 0;
            let
                j: number = 0;
            let dPrinter: number = 1.0;
            let dIntLocation1x: number = 0;
            let
                dIntLocation2x: number = 0;
            let
                dIntLocation1y: number = 0;
            let
                dIntLocation2y: number = 0;
            let
                r: number = 0;
            let
                s: number = 0;
            let
                use: number = 0;
            let
                length: number = 0;
            let
                k: number = 0;
            let
                bint: number = 0;
            let UpperLinePoint: POINT2 = new POINT2(pLinePoints[0]);
            let
                Lower1LinePoint: POINT2 = new POINT2(pLinePoints[0]);
            let
                Lower2LinePoint: POINT2 = new POINT2(pLinePoints[0]);
            let
                a: POINT2 = new POINT2(pLinePoints[0]);
            let
                b: POINT2 = new POINT2(pLinePoints[0]);
            let pCirclePoints: POINT2[] = new Array<POINT2>(pLinePoints.length);
            let averagePoint: POINT2 = new POINT2();
            let lastAveragePoint: POINT2 = new POINT2();
            let pTempLinePoints: POINT2[];
            //end declarations

            pTempLinePoints = new Array<POINT2>(nOldCounter);
            for (j = 0; j < nOldCounter; j++) {
                pTempLinePoints[j] = new POINT2(pLinePoints[j]);
            }

            let basePoints: Array<POINT2> = new Array();

            LineUtility.InitializePOINT2Array(pCirclePoints);
            nSpikeCounter = nOldCounter;
            let spikeLength: number = arraysupport.getScaledSize(12, tg.lineThickness, tg.patternScale);
            let spikeHeight: number = spikeLength * 1.25;
            let minLength: number = 2 * spikeLength;
            for (i = 0; i < nOldCounter - 1; i++) {
                if (linetype === TacticalLines.ATDITCHM && i === 0) {
                    let radius: number = arraysupport.getScaledSize(4, tg.lineThickness, tg.patternScale);
                    minLength = spikeLength * 2.5 + radius * 2;
                }

                const linesResult = LineUtility.calcTrueLines((spikeHeight * dPrinter), pLinePoints[i], pLinePoints[i + 1]);
                nTemp = linesResult.result;
                r = linesResult.values[3];
                s = linesResult.values[5];
                length = LineUtility.calcDistance(pLinePoints[i], pLinePoints[i + 1]);
                const slopeResult = LineUtility.calcTrueSlope(pLinePoints[i], pLinePoints[i + 1]);
                bolVertical = slopeResult.result;
                const mVal = slopeResult.slope;
                nNumberOfSegments = Math.trunc((length - 1) / (spikeLength * dPrinter));

                if (length > minLength * dPrinter) {    //minLength was 24
                    if (bWayIs !== 0) {
                        if (pLinePoints[i].x <= pLinePoints[i + 1].x) {
                            use = r;
                        }
                        if (pLinePoints[i].x >= pLinePoints[i + 1].x) {
                            use = s;
                        }
                    } //end if
                    else {
                        if (pLinePoints[i].x <= pLinePoints[i + 1].x) {
                            use = s;
                        }
                        if (pLinePoints[i].x >= pLinePoints[i + 1].x) {
                            use = r;
                        }
                    }	//end else

                    for (j = 1; j <= nNumberOfSegments; j++) {
                        k = j as number;
                        a = new POINT2(pLinePoints[i]);
                        b = new POINT2(pLinePoints[i + 1]);

                        if (j > 1) {
                            dIntLocation1x = dIntLocation2x;
                        } else {
                            dIntLocation1x
                                = pLinePoints[i].x as number + ((k * spikeLength - spikeLength / 2) * dPrinter / length)
                                * (pLinePoints[i + 1].x - pLinePoints[i].x) as number;
                        }

                        if (j > 1) //added M. Deutch 2-23-99
                        {
                            dIntLocation1y = dIntLocation2y;
                        } else {
                            dIntLocation1y
                                = pLinePoints[i].y as number + ((k * spikeLength - spikeLength / 2) * dPrinter / length)
                                * (pLinePoints[i + 1].y - pLinePoints[i].y) as number;
                        }

                        dIntLocation2x = pLinePoints[i].x as number
                            + ((k * spikeLength + spikeLength / 2) * dPrinter / length)
                            * (pLinePoints[i + 1].x
                                - pLinePoints[i].x) as number;

                        dIntLocation2y = pLinePoints[i].y as number
                            + ((k * spikeLength + spikeLength / 2) * dPrinter / length)
                            * (pLinePoints[i + 1].y
                                - pLinePoints[i].y) as number;

                        if (mVal !== 0 && bolVertical !== 0) {
                            bint = (dIntLocation1y + dIntLocation2y) / 2.0
                                + (1 / mVal) * (dIntLocation1x + dIntLocation2x) / 2.0;
                            //independent of direction
                            UpperLinePoint = LineUtility.calcTrueIntersect(mVal, use, -1 / mVal, bint, 1, 1, pLinePoints[0].x, pLinePoints[0].y);
                        }

                        if (bolVertical === 0) //vertical segment
                        {
                            if (dIntLocation1y < dIntLocation2y) {
                                UpperLinePoint.y = dIntLocation1y as number + Math.trunc(length / nNumberOfSegments / 2);
                            } else {
                                UpperLinePoint.y = dIntLocation1y as number - Math.trunc(length / nNumberOfSegments / 2);
                            }
                            if (pLinePoints[i].y < pLinePoints[i + 1].y) {
                                UpperLinePoint.x = dIntLocation1x as number + Math.trunc(length / nNumberOfSegments);
                            } else {
                                UpperLinePoint.x = dIntLocation1x as number - Math.trunc(length / nNumberOfSegments);
                            }
                        }
                        if (mVal === 0 && bolVertical !== 0) {
                            if (dIntLocation1x < dIntLocation2x) {
                                UpperLinePoint.x = dIntLocation1x as number + Math.trunc(length / nNumberOfSegments / 2);
                            } else {
                                UpperLinePoint.x = dIntLocation1x as number - Math.trunc(length / nNumberOfSegments / 2);
                            }
                            if (pLinePoints[i + 1].x < pLinePoints[i].x) {
                                UpperLinePoint.y = dIntLocation1y as number + Math.trunc(length / nNumberOfSegments);
                            } else {
                                UpperLinePoint.y = dIntLocation1y as number - Math.trunc(length / nNumberOfSegments);
                            }
                        }
                        //end section

                        Lower1LinePoint.x = dIntLocation1x;
                        Lower1LinePoint.y = dIntLocation1y;
                        Lower2LinePoint.x = dIntLocation2x;
                        Lower2LinePoint.y = dIntLocation2y;

                        pLinePoints[nSpikeCounter] = new POINT2(Lower1LinePoint);
                        if (linetype === TacticalLines.ATDITCHC || linetype === TacticalLines.ATDITCHM) {
                            pLinePoints[nSpikeCounter].style = 9;
                        }
                        if (j % 2 === 1 && linetype === TacticalLines.ATDITCHM)//diagnostic 1-8-13
                        {
                            pLinePoints[nSpikeCounter].style = 5;
                        }

                        nSpikeCounter++;

                        pLinePoints[nSpikeCounter] = new POINT2(UpperLinePoint);
                        if (linetype === TacticalLines.ATDITCHC || linetype === TacticalLines.ATDITCHM) {
                            pLinePoints[nSpikeCounter].style = 9;
                        }
                        if (j % 2 === 1 && linetype === TacticalLines.ATDITCHM)//diagnostic 1-8-13
                        {
                            pLinePoints[nSpikeCounter].style = 5;
                        }

                        nSpikeCounter++;

                        pLinePoints[nSpikeCounter] = new POINT2(Lower2LinePoint);
                        if (linetype === TacticalLines.ATDITCHC || linetype === TacticalLines.ATDITCHM) {
                            pLinePoints[nSpikeCounter].style = 10;
                        }
                        if (j % 2 === 1 && linetype === TacticalLines.ATDITCHM)//diagnostic 1-8-13
                        {
                            pLinePoints[nSpikeCounter].style = 5;
                        }

                        nSpikeCounter++;

                        if (linetype === TacticalLines.ATDITCHM) {
                            if (j % 2 === 0) {
                                averagePoint = LineUtility.midPoint(Lower1LinePoint, Lower2LinePoint, 0);
                                averagePoint = LineUtility.midPoint(averagePoint, UpperLinePoint, 0);
                            } else {
                                if (j === 1) {
                                    averagePoint = LineUtility.ExtendLineDouble(Lower2LinePoint, Lower1LinePoint, 5);
                                    averagePoint = LineUtility.midPoint(averagePoint, UpperLinePoint, 0);
                                }
                            }

                        }
                        //end section
                        if (j > 1 && j < nNumberOfSegments) {
                            basePoints.push(new POINT2(Lower1LinePoint));
                            //if(j==nNumberOfSegments-1)
                            //  basePoints[basePoints.length-1].style=5;
                        } else {
                            if (j === 1) {
                                basePoints.push(new POINT2(pLinePoints[i]));
                            } else {
                                if (j === nNumberOfSegments) {
                                    basePoints.push(new POINT2(pLinePoints[i + 1]));
                                    basePoints[basePoints.length - 1].style = 5;
                                }
                            }

                        }

                        if (linetype === TacticalLines.ATDITCHM && j > 1) {
                            if (j % 2 === 0) {
                                pCirclePoints[lCircleCounter] = LineUtility.midPoint(averagePoint, lastAveragePoint, 20);
                                lCircleCounter++;
                            }
                            //end section
                        }
                        if (j < nNumberOfSegments && linetype === TacticalLines.ATDITCHM) {
                            if (j === 1 || j % 2 === 0) {
                                //LastUpperLinePoint = new POINT2(UpperLinePoint);
                                lastAveragePoint = new POINT2(averagePoint);
                            }
                            //end section
                        }
                    }//end for j<numberOfsegments
                } //end if length big enough
                else {
                    //diagnostic
                    pLinePoints[nSpikeCounter].x = pLinePoints[i].x;
                    pLinePoints[nSpikeCounter].y = pLinePoints[i].y;
                    pLinePoints[nSpikeCounter].style = 0;
                    nSpikeCounter++;
                    pLinePoints[nSpikeCounter].x = pLinePoints[i + 1].x;
                    pLinePoints[nSpikeCounter].y = pLinePoints[i + 1].y;
                    pLinePoints[nSpikeCounter].style = 5;
                    nSpikeCounter++;
                }
            }

            for (j = 0; j < nOldCounter; j++) //reverse the first nOldCounter points for
            {
                pLinePoints[j] = new POINT2(pTempLinePoints[nOldCounter - j - 1]); //purpose of drawing
                pLinePoints[j].style = 5;
            }

            if (pLinePoints[nSpikeCounter - 1].style === 0) {
                pLinePoints[nSpikeCounter - 1].style = 5;
            }
            let t: number = basePoints.length;
            //for (j = nSpikeCounter; j < nSpikeCounter + basePoints.length; j++) 
            for (j = nSpikeCounter; j < nSpikeCounter + t; j++) {
                pLinePoints[j] = new POINT2(basePoints[j - nSpikeCounter]);
                //if(linetype == TacticalLines.ATDITCHM && pLinePoints[j].style != 5)
                if (pLinePoints[j].style !== 5) {
                    pLinePoints[j].style = 0;
                }
            }
            nSpikeCounter += basePoints.length;

            if (linetype === TacticalLines.ATDITCHM as number) {
                pLinePoints[nSpikeCounter - 1].style = 5;//was 10
                for (j = nSpikeCounter; j < nSpikeCounter + lCircleCounter; j++) {
                    pLinePoints[j] = new POINT2(pCirclePoints[j - nSpikeCounter]);
                    pLinePoints[j].style = 20;
                }
                nSpikeCounter += lCircleCounter;
            }

        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "getDitchSpike",
                    exc);
            } else {
                throw exc;
            }
        }
        return nSpikeCounter;
    }

    /**
     * Moves pixels if points are identical, used for the channel types
     *
     * @param pLinePoints OUT - client points also for returned points
     */
    static MoveChannelPixels(pLinePoints: POINT2[]): void {
        try {
            if (pLinePoints == null || pLinePoints.length <= 0) {
                return;
            }

            let pixels: number[] = new Array<number>(pLinePoints.length * 2);
            let bolNoRepeats: boolean;
            let j: number = 0;
            let k: number = 0;
            let x1: number = 0;
            let y1: number = 0;
            let x2: number = 0;
            let y2: number = 0;
            let count: number = pLinePoints.length;
            //stuff pixels
            for (j = 0; j < count; j++) {
                pixels[k++] = pLinePoints[j].x;
                pixels[k++] = pLinePoints[j].y;
            }

            bolNoRepeats = false;
            do {
                bolNoRepeats = true;
                for (j = 0; j < count - 1; j++) {
                    x1 = pixels[2 * j];
                    y1 = pixels[2 * j + 1];
                    x2 = pixels[2 * j + 2];
                    y2 = pixels[2 * j + 3];
                    if (x1 === x2 && y1 === y2) //it's the same point
                    {
                        bolNoRepeats = false;
                        pixels[2 * j + 2] = x2 + 1; //move the point
                        break;
                    }
                }
            } while (bolNoRepeats === false);
            //stuff pLinePoints
            k = 0;
            for (j = 0; j < count; j++) {
                pLinePoints[j].x = pixels[k++];
                pLinePoints[j].y = pixels[k++];
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "MoveChannelPixels",
                    exc);
            } else {
                throw exc;
            }
        }
    }

    /**
     * Single Concertina cannot have horizontal first segment
     *
     * @param linetype
     * @param pLinePoints
     */
    static moveSingleCPixels(linetype: number, pLinePoints: POINT2[]): void {
        try {
            switch (linetype) {
                case TacticalLines.SINGLEC: {
                    break;
                }

                default: {
                    return;
                }

            }
            if (pLinePoints.length > 1) {
                if (pLinePoints[1].y === pLinePoints[0].y) {
                    pLinePoints[1].y++;
                }
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "MoveSingleCPixels",
                    exc);
            } else {
                throw exc;
            }
        }
    }

    /**
     * Rotates an the first vblCounter points in the array about its first point
     *
     * @param pLinePoints OUT - the points to rotate
     * @param vblCounter the number of points to rotate
     * @param lAngle the angle in degrees to rotate
     */
    static RotateGeometryDouble(pLinePoints: POINT2[],
        vblCounter: number,
        lAngle: number): void {
        try {
            let j: number = 0;
            let dRotate: number = 0;
            let
                dTheta: number = 0;
            let
                dGamma: number = 0;
            let
                x: number = 0;
            let
                y: number = 0;

            if (lAngle !== 0) //if the angle is 0 no rotation occurs
            {
                let pdCenter: POINT2;
                dRotate = lAngle * Math.PI / 180;
                pdCenter = LineUtility.CalcCenterPointDouble(pLinePoints, vblCounter);

                for (j = 0; j < vblCounter; j++) {
                    //added if/else to get rid of divide by zero error 5/12/04 M. Deutch
                    if (pLinePoints[j].x === pdCenter.x) {
                        if ((pLinePoints[j].y > pdCenter.y)) {
                            dGamma = Math.PI + Math.PI / 2;
                        } else {
                            dGamma = Math.PI / 2;
                        }
                    } else {
                        dGamma = Math.PI + Math.atan((pLinePoints[j].y - pdCenter.y)
                            / (pLinePoints[j].x - pdCenter.x));
                    }

                    if (pLinePoints[j].x as number >= pdCenter.x) {
                        dGamma = dGamma + Math.PI;
                    }

                    dTheta = dRotate + dGamma;
                    y = LineUtility.calcDistance(pLinePoints[j], pdCenter) * Math.sin(dTheta);
                    x = LineUtility.calcDistance(pLinePoints[j], pdCenter) * Math.cos(dTheta);
                    pLinePoints[j].y = pdCenter.y + y;
                    pLinePoints[j].x = pdCenter.x + x;
                }	//end for

                return;
            }	//end if
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "RotateGeometryDouble",
                    exc);
            } else {
                throw exc;
            }
        }
    }  // end

    /**
     * Returns the point on line (pt0 to pt1) closest to ptRelative
     *
     * @param pt0 the first point on line
     * @param pt1 the second point on line
     * @param ptRelative the second point on line
     * @return the point closest to ptRelative on the line
     */
    public static ClosestPointOnLine(pt0: POINT2, pt1: POINT2, ptRelative: POINT2): POINT2 {
        if (pt0.x == ptRelative.x && pt0.y == ptRelative.y)
            return new POINT2(pt0);
        else if (pt1.x == ptRelative.x && pt1.y == ptRelative.y)
            return new POINT2(pt1);
        else if (pt0.x == pt1.x && pt0.y == pt1.y)
            return new POINT2(pt0);

        let atob = new POINT2(pt1.x - pt0.x,  pt1.y - pt0.y );
        let atop = new POINT2(ptRelative.x - pt0.x,  ptRelative.y - pt0.y );
        let len: number = atob.x * atob.x + atob.y * atob.y;
        let dot: number = atop.x * atob.x + atop.y * atob.y;
        let t: number = Math.min( 1, Math.max( 0, dot / len ) );

        return new POINT2(pt0.x + atob.x * t, pt0.y + atob.y * t);
    }

    /**
     * Returns the intersection between two line segments or null if it doesn't exist
     *
     * @param pt1
     * @param pt2
     * @param pt3
     * @param pt4
     * @return
     */
    private static getIntersectionPoint(pt1: POINT2, pt2: POINT2, pt3: POINT2, pt4: POINT2): POINT2 {
        let denom: number = (pt4.y - pt3.y) * (pt2.x - pt1.x) - (pt4.x - pt3.x) * (pt2.y - pt1.y);

        if (denom == 0.0) { // Lines are parallel or collinear
            return null;
        }

        let ua: number = ((pt4.x - pt3.x) * (pt1.y - pt3.y) - (pt4.y - pt3.y) * (pt1.x - pt3.x)) / denom;
        let ub: number = ((pt2.x - pt1.x) * (pt1.y - pt3.y) - (pt2.y - pt1.y) * (pt1.x - pt3.x)) / denom;

        if (ua >= 0.0 && ua <= 1.0 && ub >= 0.0 && ub <= 1.0) {
            // Intersection point lies within both segments
            let intersectX: number = pt1.x + ua * (pt2.x - pt1.x);
            let intersectY: number = pt1.y + ua * (pt2.y - pt1.y);
            return new POINT2(intersectX, intersectY);
        }

        return null; // Segments do not intersect
    }

    /**
     * Returns the intersection between a polygon and a line or null if it doesn't exist
     *
     * @param polyPts
     * @param pt0
     * @param pt1
     * @return
     */
    public static intersectPolygon(polyPts: POINT2[], pt0: POINT2, pt1: POINT2): POINT2 {
        for (let i = 0; i < polyPts.length; i++) {
            let temp = LineUtility.getIntersectionPoint(polyPts[i], polyPts[(i + 1) % polyPts.length], pt0, pt1);
            if (temp != null) return temp;
        }
        return null;
    }

    /**
     * Returns the point perpendicular to the line (pt0 to pt1) at the midpoint
     * the same distance from (and on the same side of) the the line as
     * ptRelative.
     *
     * @param pt0 the first point
     * @param pt1 the second point
     * @param ptRelative the point to use for computing the return point
     *
     * @return the point perpendicular to the line at the midpoint
     */
    static PointRelativeToLine(pt0: POINT2,
        pt1: POINT2,
        ptRelative: POINT2): POINT2;

    /**
     * Returns the point perpendicular to the line (pt0 to pt1) at atPoint the
     * same distance from (and on the same side of) the the line as ptRelative.
     *
     * @param pt0 the first point
     * @param pt1 the second point
     * @param atPoint the point on the line at which to compute the extended
     * point
     * @param ptRelative the point to use for computing the return point
     *
     * @return the point perpendicular to the line at ptRelative
     */
    static PointRelativeToLine(pt0: POINT2,
        pt1: POINT2,
        atPoint: POINT2,
        ptRelative: POINT2): POINT2;
    static PointRelativeToLine(...args: unknown[]): POINT2 {
        switch (args.length) {
            case 3: {
                const [pt0, pt1, ptRelative] = args as [POINT2, POINT2, POINT2];


                let ptResult: POINT2 = new POINT2(pt0);
                try {
                    let midPt: POINT2 = LineUtility.midPoint(pt0, pt1, 0);
                    let b1: number = 0;
                    let b2: number = 0;
                    //end declarations

                    const { result: bolVertical, slope: mVal } = LineUtility.calcTrueSlope(pt0, pt1);
                    if (bolVertical === 0) //line is vertical
                    {
                        ptResult.x = ptRelative.x;
                        ptResult.y = midPt.y;
                    }
                    if (bolVertical !== 0 && mVal === 0) {
                        ptResult.x = midPt.x;
                        ptResult.y = ptRelative.y;
                    }
                    if (bolVertical !== 0 && mVal !== 0) {
                        b1 = midPt.y + (1 / mVal) * midPt.x;	//the line perp to midPt
                        b2 = ptRelative.y - mVal * ptRelative.x;	//the line  ptRelative with the slope of pt1-pt2
                        ptResult = LineUtility.calcTrueIntersect(-1 / mVal, b1, mVal, b2, 1, 1, 0, 0);
                    }
                } catch (exc) {
                    if (exc instanceof Error) {
                        ErrorLogger.LogException(LineUtility._className, "PointRelativeToLine",
                            exc);
                    } else {
                        throw exc;
                    }
                }
                return ptResult;


                break;
            }

            case 4: {
                const [pt0, pt1, atPoint, ptRelative] = args as [POINT2, POINT2, POINT2, POINT2];


                let ptResult: POINT2 = new POINT2(pt0);
                try {
                    let b1: number = 0;
                    let b2: number = 0;

                    const { result: bolVertical, slope: mVal } = LineUtility.calcTrueSlope(pt0, pt1);
                    if (bolVertical === 0) //line is vertical
                    {
                        ptResult.x = ptRelative.x;
                        ptResult.y = atPoint.y;
                    }
                    if (bolVertical !== 0 && mVal === 0) {
                        ptResult.x = atPoint.x;
                        ptResult.y = ptRelative.y;
                    }
                    if (bolVertical !== 0 && mVal !== 0) {
                        b1 = atPoint.y + (1 / mVal) * atPoint.x;	//the line perp to midPt
                        b2 = ptRelative.y - mVal * ptRelative.x;	//the line  ptRelative with the slope of pt1-pt2
                        ptResult = LineUtility.calcTrueIntersect(-1 / mVal, b1, mVal, b2, 1, 1, 0, 0);
                    }
                } catch (exc) {
                    if (exc instanceof Error) {
                        ErrorLogger.LogException(LineUtility._className, "PointRelativeToLine",
                            exc);
                    } else {
                        throw exc;
                    }
                }
                return ptResult;


                break;
            }

            default: {
                throw Error(`Invalid number of arguments`);
            }
        }
    }


    /**
     * shift the control point to match the shift that occurs in
     * Channels.GetAXADDouble for CATKBYFIRE. This is because the rotary feature
     * arrow tip must align with the anchor point
     *
     * @param linetype
     * @param pLinePoints the anchor points including the control point
     * @param dist the minimum required distance from the front of the rotary
     * arrow
     */
    public static adjustCATKBYFIREControlPoint(linetype: number,
        pLinePoints: Array<POINT2>,
        dist: number): void {
        try {
            if (linetype !== TacticalLines.CATKBYFIRE) {
                return;
            }

            let dist2: number = LineUtility.calcDistance(pLinePoints[0], pLinePoints[1]);
            if (dist2 <= dist) {
                return;
            }

            let pt: POINT2;
            let count: number = pLinePoints.length;
            let pt0: POINT2 = new POINT2(pLinePoints[0]);
            let pt1: POINT2 = new POINT2(pLinePoints[1]);
            let controlPt: POINT2 = new POINT2(pLinePoints[count - 1]);
            let pt4: POINT2 = LineUtility.PointRelativeToLine(pt0, pt1, pt1, controlPt);
            pt = LineUtility.ExtendLineDouble(pt4, controlPt, dist);
            pLinePoints[count - 1] = pt;
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "adjustCATKBYFIREControlPoint",
                    exc);
            } else {
                throw exc;
            }
        }
    }

    /**
     * Returns in pt2 and pt3 the line segment parallel to segment pt0-pt1 which
     * would contain ptRelative. pt2 corresponds to pt0 and pt3 corresponds to
     * pt1.
     *
     * @param pt0 first line point
     * @param pt1 second line point
     * @param ptRelative relative line point
     * @param pt2 OUT - first computed relative line point
     * @param pt3 OUT - second computed relative line point
     */
    public static LineRelativeToLine(pt0: POINT2,
        pt1: POINT2,
        ptRelative: POINT2,
        pt2: POINT2,
        pt3: POINT2): void {
        try {
            let b1: number = 0;
            let b2: number = 0;
            let pt2Temp: POINT2;
            let pt3Temp: POINT2;

            const { result: bolVertical, slope: mVal } = LineUtility.calcTrueSlope(pt0, pt1);
            if (bolVertical === 0) //line is vertical
            {
                pt2.x = ptRelative.x;
                pt2.y = pt0.y;
                pt3.x = ptRelative.x;
                pt3.y = pt1.y;
            }
            if (bolVertical !== 0 && mVal === 0) //line is horizontal
            {
                pt2.x = pt0.x;
                pt2.y = ptRelative.y;
                pt3.x = pt1.x;
                pt3.y = ptRelative.y;
            }
            if (bolVertical !== 0 && mVal !== 0) {
                b1 = pt0.y + (1 / mVal) * pt0.x;	//the line perp to pt0
                b2 = ptRelative.y - mVal * ptRelative.x;	//the line the ptRelative with the slope of pt0-pt1
                pt2Temp = LineUtility.calcTrueIntersect(-1 / mVal, b1, mVal, b2, 1, 1, 0, 0);

                b1 = pt1.y + (1 / mVal) * pt1.x;	//the line perp to pt1
                //b2=ptRelative.y-m*ptRelative.x;	//the line the ptRelative with the slope of pt0-pt1
                pt3Temp = LineUtility.calcTrueIntersect(-1 / mVal, b1, mVal, b2, 1, 1, 0, 0);

                pt2.x = pt2Temp.x;
                pt2.y = pt2Temp.y;
                pt3.x = pt3Temp.x;
                pt3.y = pt3Temp.y;
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "LineRelativeToLine",
                    exc);
            } else {
                throw exc;
            }
        }
    }

    private static calcMBR(pLinePoints: POINT2[],
        numpts: number): { ulx: number, uly: number, lrx: number, lry: number } {
        let ulxVal: number = Number.MAX_VALUE;//was 99999
        let ulyVal: number = Number.MAX_VALUE;//was 99999
        let lrxVal: number = -Number.MAX_VALUE;//was -99999
        let lryVal: number = -Number.MAX_VALUE;//was -99999
        try {
            let j: number = 0;
            for (j = 0; j < numpts; j++) {
                if (pLinePoints[j].x > lrxVal) {
                    lrxVal = pLinePoints[j].x;
                }
                if (pLinePoints[j].y > lryVal) {
                    lryVal = pLinePoints[j].y;
                }
                if (pLinePoints[j].x < ulxVal) {
                    ulxVal = pLinePoints[j].x;
                }
                if (pLinePoints[j].y < ulyVal) {
                    ulyVal = pLinePoints[j].y;
                }
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "calcMBR",
                    exc);
            } else {
                throw exc;
            }
        }
        return { ulx: ulxVal, uly: ulyVal, lrx: lrxVal, lry: lryVal };
    }

    public static calcMBRPoints(pLinePoints: POINT2[],
        numpts: number,
        ul: POINT2,
        lr: POINT2): void {
        try {
            let j: number = 0;
            ul.x = Number.MAX_VALUE;
            ul.y = Number.MAX_VALUE;
            lr.x = -Number.MAX_VALUE;
            lr.y = -Number.MAX_VALUE;
            for (j = 0; j < numpts; j++) {
                if (pLinePoints[j].x > lr.x) {
                    lr.x = pLinePoints[j].x;
                }
                if (pLinePoints[j].y > lr.y) {
                    lr.y = pLinePoints[j].y;
                }
                if (pLinePoints[j].x < ul.x) {
                    ul.x = pLinePoints[j].x;
                }
                if (pLinePoints[j].y < ul.y) {
                    ul.y = pLinePoints[j].y;
                }
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "calcMBRPoints",
                    exc);
            } else {
                throw exc;
            }
        }
    }

    /**
     * Computes the distance in pixels from upper left to lower right of the
     * minimum bounding rectangle for the first numpts of pLinePoints
     *
     * @param pLinePoints the inpupt point array
     * @param numpts the number of points to use
     *
     * @return the distance in pixels
     */
    static MBRDistance(pLinePoints: POINT2[],
        numpts: number): number {
        let result: number = 0;
        try {
            const mbr = LineUtility.calcMBR(pLinePoints, numpts);
            result = Math.sqrt((mbr.lrx - mbr.ulx) * (mbr.lrx - mbr.ulx) + (mbr.lry - mbr.uly) * (mbr.lry - mbr.uly));
            //sanity check

            //return x or y distance if returnValue is 0 or infinity
            let xdist: number = Math.abs(mbr.lrx - mbr.ulx);
            let ydist: number = Math.abs(mbr.lry - mbr.uly);
            let max: number = xdist;
            if (ydist > xdist) {
                max = ydist;
            }

            if (result === 0 || !Number.isFinite(result)) {
                if (max > 0) {
                    result = max;
                }
            }

        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "MBRDistance",
                    exc);
            } else {
                throw exc;
            }
        }
        return result;
    }

    /**
     * Swaps two points.
     *
     * @param pt1 OUT - first point
     * @param pt2 OUT - second point
     *
     */
    static Reverse2Points(pt1: POINT2, pt2: POINT2): void {
        try {
            let tempPt: POINT2 = new POINT2();
            //store pt1
            tempPt.x = pt1.x;
            tempPt.y = pt1.y;
            pt1.x = pt2.x;
            pt1.y = pt2.y;
            pt2.x = tempPt.x;
            pt2.y = tempPt.y;
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "Reverse2Points",
                    exc);
            } else {
                throw exc;
            }
        }
    }
    /**
     * Creates a GeneralPath from a Path2D
     *
     * @param shape
     * @return
     */
    public static createStrokedShape(shape: Shape): Shape {
        let newshape: GeneralPath = new GeneralPath(); // Start with an empty shape
        try {
            // Iterate through the specified shape, perturb its coordinates, and
            // use them to build up the new shape.
            let coords: number[] = new Array<number>(6);
            for (let i: PathIterator = shape.getPathIterator(null); !i.isDone(); i.next()) {
                let type: number = i.currentSegment(coords);
                switch (type) {
                    case IPathIterator.SEG_MOVETO: {
                        //perturb(coords, 2);
                        newshape.moveTo(coords[0], coords[1]);
                        break;
                    }

                    case IPathIterator.SEG_LINETO: {
                        //perturb(coords, 2);
                        newshape.lineTo(coords[0], coords[1]);
                        break;
                    }

                    case IPathIterator.SEG_QUADTO: {
                        //perturb(coords, 4);
                        newshape.quadTo(coords[0], coords[1], coords[2], coords[3]);
                        break;
                    }

                    case IPathIterator.SEG_CUBICTO: {
                        //perturb(coords, 6);
                        newshape.curveTo(coords[0], coords[1], coords[2], coords[3],
                            coords[4], coords[5]);
                        break;
                    }

                    case IPathIterator.SEG_CLOSE: {
                        newshape.closePath();
                        break;
                    }
                }
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "createStrokedShape",
                    exc);
            } else {
                throw exc;
            }
        }
        return newshape;
    }
    //These functions were added to create a minimum bounding polygon
    /**
     * @deprecated Returns the determinant of the point matrix This determinant
     * tells how far p3 is from vector p1p2 and on which side it is
     * @param p1
     * @param p2
     * @param p3
     * @return
     */
    private static distance(p1: Point, p2: Point, p3: Point): number {
        try {
            let x1: number = p1.x;
            let x2: number = p2.x;
            let x3: number = p3.x;
            let y1: number = p1.y;
            let y2: number = p2.y;
            let y3: number = p3.y;
            return x1 * y2 + x3 * y1 + x2 * y3 - x3 * y2 - x2 * y1 - x1 * y3;
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "distance",
                    exc);
            } else {
                throw exc;
            }
        }
        return 0;
    }

    /**
     * @deprecated Returns the determinant of the point matrix This determinant
     * tells how far p3 is from vector p1p2 and on which side it is
     * @param p1
     * @param p2
     * @param p3
     * @return
     */
    private static distance2(p1: POINT2, p2: POINT2, p3: POINT2): number {
        try {
            let x1: number = p1.x;
            let x2: number = p2.x;
            let x3: number = p3.x;
            let y1: number = p1.y;
            let y2: number = p2.y;
            let y3: number = p3.y;
            return x1 * y2 + x3 * y1 + x2 * y3 - x3 * y2 - x2 * y1 - x1 * y3;
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "distance2",
                    exc);
            } else {
                throw exc;
            }
        }
        return 0;
    }
    //Returns the points of convex hull in the correct order
    /**
     * @deprecated @param array
     * @return
     */
    static cHull(array: Array<Point>): Array<Point>;

    /**
     * @deprecated @param points
     * @param l
     * @param r
     * @param path
     */
    static cHull(points: Array<Point>, l: Point, r: Point, path: Array<Point>): void;
    static cHull(...args: unknown[]): Array<Point> | void | null {
        switch (args.length) {
            case 1: {
                const [array] = args as [Array<Point>];


                let size: number = array.length;
                if (size < 2) {
                    return null;
                }

                let l: Point = array[0];
                let r: Point = array[size - 1];
                let path: Array<Point> = new Array<Point>();
                path.push(l);
                LineUtility.cHull(array, l, r, path);
                path.push(r);
                LineUtility.cHull(array, r, l, path);
                return path;


                break;
            }

            case 4: {
                const [points, l, r, path] = args as [Array<Point>, Point, Point, Array<Point>];



                if (points.length < 3) {
                    return;
                }

                let maxDist: number = 0;
                let tmp: number = 0;
                let p: Point;

                for (let pt of points) {
                    if (pt !== l && pt !== r) {
                        tmp = LineUtility.distance(l, r, pt);

                        if (tmp > maxDist) {
                            maxDist = tmp;
                            p = pt;
                        }
                    }
                }

                let left: Array<Point> = new Array<Point>();
                let right: Array<Point> = new Array<Point>();
                left.push(l);
                right.push(p);

                for (let pt of points) {
                    if (LineUtility.distance(l, p, pt) > 0) {
                        left.push(pt);
                    } else {
                        if (LineUtility.distance(p, r, pt) > 0) {
                            right.push(pt);
                        }
                    }

                }

                left.push(p);
                right.push(r);
                LineUtility.cHull(left, l, p, path);
                path.push(p);
                LineUtility.cHull(right, p, r, path);


                break;
            }

            default: {
                throw Error(`Invalid number of arguments`);
            }
        }
    }


    /**
     * @deprecated @param array
     * @return
     */
    static cHull2(array: Array<POINT2>): Array<POINT2>;

    /**
     * @deprecated @param points
     * @param l
     * @param r
     * @param path
     */
    static cHull2(points: Array<POINT2>, l: POINT2, r: POINT2, path: Array<POINT2>): void;
    static cHull2(...args: unknown[]): Array<POINT2> | void | null {
        switch (args.length) {
            case 1: {
                const [array] = args as [Array<POINT2>];


                try {
                    let size: number = array.length;
                    if (size < 2) {
                        return null;
                    }

                    let l: POINT2 = array[0];
                    let r: POINT2 = array[size - 1];
                    let path: Array<POINT2> = new Array<POINT2>();
                    path.push(l);
                    LineUtility.cHull2(array, l, r, path);
                    path.push(r);
                    LineUtility.cHull2(array, r, l, path);
                    return path;
                } catch (exc) {
                    if (exc instanceof Error) {
                        ErrorLogger.LogException(LineUtility._className, "cHull2",
                            exc);
                    } else {
                        throw exc;
                    }
                }
                return null;


                break;
            }

            case 4: {
                const [points, l, r, path] = args as [Array<POINT2>, POINT2, POINT2, Array<POINT2>];



                if (points.length < 3) {
                    return;
                }

                let maxDist: number = 0;
                let tmp: number = 0;
                let p: POINT2;

                for (let pt of points) {
                    if (pt !== l && pt !== r) {
                        tmp = LineUtility.distance2(l, r, pt);

                        if (tmp > maxDist) {
                            maxDist = tmp;
                            p = pt;
                        }
                    }
                }

                let left: Array<POINT2> = new Array<POINT2>();
                let right: Array<POINT2> = new Array<POINT2>();
                left.push(l);
                right.push(p);

                for (let pt of points) {
                    if (LineUtility.distance2(l, p, pt) > 0) {
                        left.push(pt);
                    } else {
                        if (LineUtility.distance2(p, r, pt) > 0) {
                            right.push(pt);
                        }
                    }

                }

                left.push(p);
                right.push(r);
                LineUtility.cHull2(left, l, p, path);
                path.push(p);
                LineUtility.cHull2(right, p, r, path);


                break;
            }

            default: {
                throw Error(`Invalid number of arguments`);
            }
        }
    }


    public static getExteriorPoints(pLinePoints: POINT2[],
        vblCounter: number,
        lineType: number,
        interior: boolean
    ): void {
        let j: number = 0;
        let index: number = 0;
        let pt0: POINT2;
        let pt1: POINT2;
        let pt2: POINT2;
        let direction: number = 0;
        let intersectPt: POINT2;
        let intersectPoints: Array<POINT2> = new Array();
        let b01: number = 0;
        let b12: number = 0;	//the y intercepts for the lines corresponding to m1,m2 
        let dist: number = pLinePoints[0].style;
        for (j = 0; j < vblCounter; j++) {
            if (j === 0 || j === vblCounter - 1) {
                pt0 = new POINT2(pLinePoints[vblCounter - 2]);
                pt1 = new POINT2(pLinePoints[0]);
                pt2 = new POINT2(pLinePoints[1]);
            } else {
                pt0 = new POINT2(pLinePoints[j - 1]);
                pt1 = new POINT2(pLinePoints[j]);
                pt2 = new POINT2(pLinePoints[j + 1]);
            }
            if (pt1.style > 0) {
                dist = pt1.style;
            }
            //the exterior/interior points
            let pt00: POINT2;
            let pt01: POINT2;
            let pt10: POINT2;
            let pt11: POINT2;

            index = j - 1;
            if (index < 0) {
                index = vblCounter - 1;
            }
            let pts: POINT2[] = new Array<POINT2>(pLinePoints.length);
            let n: number = pLinePoints.length;
            //for (int k = 0; k < pLinePoints.length; k++) 
            for (let k: number = 0; k < n; k++) {
                pts[k] = pLinePoints[k];
            }

            direction = arraysupport.GetInsideOutsideDouble2(pt0, pt1, pts, vblCounter, index, lineType);
            //reverse the direction if these are interior points
            if (interior === true) {
                direction = LineUtility.reverseDirection(direction);
            }
            //pt00-pt01 will be the interior line inside line pt0-pt1
            //pt00 is inside pt0, pt01 is inside pt1
            pt00 = LineUtility.ExtendDirectedLine(pt0, pt1, pt0, direction, dist);
            pt01 = LineUtility.ExtendDirectedLine(pt0, pt1, pt1, direction, dist);

            //pt10-pt11 will be the interior line inside line pt1-pt2
            //pt10 is inside pt1, pt11 is inside pt2
            index = j;
            if (j === vblCounter - 1) {
                index = 0;
            }
            direction = arraysupport.GetInsideOutsideDouble2(pt1, pt2, pts as POINT2[], vblCounter, index, lineType);
            //reverse the direction if these are interior points
            if (interior === true) {
                direction = LineUtility.reverseDirection(direction);
            }
            pt10 = LineUtility.ExtendDirectedLine(pt1, pt2, pt1, direction, dist);
            pt11 = LineUtility.ExtendDirectedLine(pt1, pt2, pt2, direction, dist);
            //intersectPt=new POINT2(null);
            //get the intersection of pt01-p00 and pt10-pt11
            //so it it is the interior intersection of pt0-pt1 and pt1-pt2

            //first handle the case of vertical lines.
            if (pt0.x === pt1.x && pt1.x === pt2.x) {
                intersectPt = new POINT2(pt01);
                intersectPoints.push(intersectPt);
                continue;
            }
            //it's the same situation if the slopes are identical,
            //simply use pt01 or pt10 since they already uniquely define the intesection
            const { slope: m01Val } = LineUtility.calcTrueSlope2(pt00, pt01);
            const { slope: m12Val } = LineUtility.calcTrueSlope2(pt10, pt11);
            //if(m01.dbl==m12.dbl)
            if (m01Val === m12Val) {
                intersectPt = new POINT2(pt01);
                intersectPoints.push(intersectPt);
                continue;
            }
            //now we are assuming a non-trivial intersection
            //calculate the y-intercepts using y=mx+b (use b=y-mx)
            b01 = pt01.y - m01Val * pt01.x;
            b12 = pt11.y - m12Val * pt11.x;
            intersectPt = LineUtility.calcTrueIntersect(m01Val, b01, m12Val, b12, 1, 1, 0, 0);
            intersectPoints.push(intersectPt);
        }//end for
        let n: number = intersectPoints.length;
        //for (j = 0; j < intersectPoints.length; j++) 
        for (j = 0; j < n; j++) {
            pLinePoints[j] = intersectPoints[j];
        }
    }
    public static getDeepCopy(pts: Array<POINT2>): Array<POINT2> {
        let deepCopy: Array<POINT2>;
        try {
            if (pts == null || pts.length === 0) {

                return pts;
            }

            deepCopy = new Array();
            let j: number = 0;
            let pt: POINT2;
            for (j = 0; j < pts.length; j++) {
                pt = new POINT2(pts[j].x, pts[j].y, pts[j].style);
                deepCopy.push(pt);
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(LineUtility._className, "getDeepCopy",
                    exc);
            } else {
                throw exc;
            }
        }
        return deepCopy;
    }

    public static reverseDirection(direction: number): number {
        switch (direction) {
            case LineUtility.extend_left:
                return LineUtility.extend_right;
            case LineUtility.extend_right:
                return LineUtility.extend_left;
            case LineUtility.extend_above:
                return LineUtility.extend_below;
            case LineUtility.extend_below:
                return LineUtility.extend_above;
            default:
                return direction;
        }
    }
}//end LineUtility
