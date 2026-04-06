/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */





import { Polygon } from "../graphics/Polygon"
import { Area } from "../graphics/Area"
import { BasicStroke } from "../graphics/BasicStroke"
import { Rectangle2D } from "../graphics/Rectangle2D"
import { Shape } from "../graphics/Shape"
import { CELineArray } from "./line-array"
import { countsupport } from "./count-calculator"
import { DISMSupport } from "./dism-generator"
import { flot } from "./flotation-generator"
import { LineUtility } from "../math/line-ops"
import { POINT2 } from "../types/point"

import { Shape2 } from "./shape2"
import { TacticalLines } from "../types/enums"
import { TacticalGraphic } from "../tactical/tactical-graphic"
import { Color } from "../renderer/utilities/Color"
import { ErrorLogger } from "../renderer/utilities/ErrorLogger"
import { IPointConversion } from "../renderer/utilities/IPointConversion"
import { rendererSettings } from "../renderer/utilities/RendererSettings"


/**
 * Class to process the pixel arrays
 *
 */
export class arraysupport {

    private static readonly maxLength: number = 100;
    private static readonly minLength: number = 2.5;    //was 5
    private static dACP: number = 0;
    private static readonly _className: string = "arraysupport";

    //    protected static void setMinLength(double value)
    //    {
    //        minLength=value;
    //    }
    private static FillPoints(pLinePoints: POINT2[],
        counter: number,
        points: Array<POINT2>): void {
        points.length = 0; // points.clear()
        for (let j: number = 0; j < counter; j++) {
            points.push(pLinePoints[j]);
        }
    }

    /**
     * This is the interface function to CELineArray from MultipointRenderer2 for
     * non-channel types
     *
     * @param pts the client points
     * @param shapes the symbol ShapeInfo objects
     * @param clipBounds the rectangular clipping bounds
     */
    public static GetLineArray2(tg: TacticalGraphic,
        pts: Array<POINT2>,
        shapes: Array<Shape2>,
        clipBounds: Rectangle2D | null,
        converter: IPointConversion | null): Array<POINT2> | null {

        let points: Array<POINT2> | null = null;
        try {
            let pt: POINT2;
            let vblSaveCounter: number = pts.length;
            let pLinePoints: POINT2[] = new Array<POINT2>(vblSaveCounter);
            let j: number = 0;

            for (j = 0; j < vblSaveCounter; j++) {
                pt = pts[j] as POINT2;
                pLinePoints[j] = new POINT2(pt.x, pt.y, pt.style);
            }
            //get the number of points the array will require
            let vblCounter: number = countsupport.GetCountersDouble(tg, vblSaveCounter, pLinePoints, clipBounds);

            //resize pLinePoints and fill the first vblSaveCounter elements with the original points
            if (vblCounter > 0) {
                pLinePoints = new Array<POINT2>(vblCounter);
            } else {
                return null;
            }

            LineUtility.InitializePOINT2Array(pLinePoints);

            //safeguards added 2-17-11 after CPOF client was allowed to add points to autoshapes
            if (vblSaveCounter > pts.length) {
                vblSaveCounter = pts.length;
            }
            if (vblSaveCounter > pLinePoints.length) {
                vblSaveCounter = pLinePoints.length;
            }

            for (j = 0; j < vblSaveCounter; j++) {
                pt = pts[j] as POINT2;
                pLinePoints[j] = new POINT2(pt.x, pt.y, pt.style);
            }
            //we have to adjust the autoshapes because they are instantiating with fewer points
            points = arraysupport.GetLineArray2Double(tg, pLinePoints, vblCounter, vblSaveCounter, shapes, clipBounds, converter);

        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(arraysupport._className, "GetLineArray2",
                    exc);

            } else {
                throw exc;
            }
        }
        return points;
        //the caller can get points
    }

    /**
     * A function to calculate the points for FORTL
     *
     * @param pLinePoints OUT - the points arry also used for the return points
     * @param vblSaveCounter the number of client points
     * @return
     */
    private static GetFORTLPointsDouble(tg: TacticalGraphic, pLinePoints: POINT2[], vblSaveCounter: number): number {
        let nCounter: number = 0;
        try {
            let j: number = 0;
            let k: number = 0;
            let bolVertical: number = 0;
            let lCount: number = 0;
            let dIncrement: number = arraysupport.getScaledSize(20, tg.lineThickness, tg.patternScale);
            let pSpikePoints: POINT2[];
            let pt0: POINT2 = new POINT2();
            let pt1: POINT2 = new POINT2();

            lCount = countsupport.GetFORTLCountDouble(tg, pLinePoints, vblSaveCounter);
            let numGlyphs: number = 0;
            let dGlyphSize: number = dIncrement / 2;

            pSpikePoints = new Array<POINT2>(lCount);
            LineUtility.InitializePOINT2Array(pSpikePoints);

            for (j = 0; j < vblSaveCounter - 1; j++) {
                ({ result: bolVertical } = LineUtility.calcTrueSlope(pLinePoints[j], pLinePoints[j + 1]));
                let dLengthSegment: number = LineUtility.calcDistance(pLinePoints[j], pLinePoints[j + 1]);
                if (dLengthSegment / dIncrement < 1) {
                    pSpikePoints[nCounter] = new POINT2(pLinePoints[j]);
                    nCounter++;
                    pSpikePoints[nCounter] = new POINT2(pLinePoints[j + 1]);
                    nCounter++;
                    continue;
                }
                numGlyphs = Math.trunc(dLengthSegment / dIncrement);
                let dSegIncrement: number = (dLengthSegment / numGlyphs);

                //for (k = 0; k < dLengthSegment / 20 - 1; k++)
                for (k = 0; k < numGlyphs; k++) {
                    pSpikePoints[nCounter] = LineUtility.extendLine(pLinePoints[j + 1], pLinePoints[j], -k * dSegIncrement, 0);
                    nCounter++;
                    //pSpikePoints[nCounter] = LineUtility.extendLine(pLinePoints[j + 1], pLinePoints[j], -k * dSegIncrement - 10, 0);
                    pSpikePoints[nCounter] = LineUtility.extendLine(pLinePoints[j + 1], pLinePoints[j], -k * dSegIncrement - dSegIncrement / 2, 0);
                    nCounter++;
                    pt0 = new POINT2(pSpikePoints[nCounter - 1]);
                    //pt1 = LineUtility.ExtendLineDouble(pLinePoints[j], pSpikePoints[nCounter - 1], 10);
                    pt1 = LineUtility.ExtendLineDouble(pLinePoints[j], pSpikePoints[nCounter - 1], dSegIncrement / 2);
                    //the spikes
                    if (pLinePoints[j].x > pLinePoints[j + 1].x) {
                        pSpikePoints[nCounter] = LineUtility.ExtendDirectedLine(pLinePoints[j], pLinePoints[j + 1], pt0, 3, dGlyphSize);
                        nCounter++;
                        pSpikePoints[nCounter] = LineUtility.ExtendDirectedLine(pLinePoints[j], pLinePoints[j + 1], pt1, 3, dGlyphSize);
                        nCounter++;
                    }
                    if (pLinePoints[j].x < pLinePoints[j + 1].x) {
                        pSpikePoints[nCounter] = LineUtility.ExtendDirectedLine(pLinePoints[j], pLinePoints[j + 1], pt0, 2, dGlyphSize);
                        nCounter++;
                        pSpikePoints[nCounter] = LineUtility.ExtendDirectedLine(pLinePoints[j], pLinePoints[j + 1], pt1, 2, dGlyphSize);
                        nCounter++;
                    }
                    if (pLinePoints[j].x === pLinePoints[j + 1].x) {
                        if (pLinePoints[j].y < pLinePoints[j + 1].y) {
                            pSpikePoints[nCounter] = LineUtility.ExtendDirectedLine(pLinePoints[j], pLinePoints[j + 1], pt0, 1, dGlyphSize);
                            nCounter++;
                            pSpikePoints[nCounter] = LineUtility.ExtendDirectedLine(pLinePoints[j], pLinePoints[j + 1], pt1, 1, dGlyphSize);
                            nCounter++;
                        }
                        if (pLinePoints[j].y > pLinePoints[j + 1].y) {
                            pSpikePoints[nCounter] = LineUtility.ExtendDirectedLine(pLinePoints[j], pLinePoints[j + 1], pt0, 0, dGlyphSize);
                            nCounter++;
                            pSpikePoints[nCounter] = LineUtility.ExtendDirectedLine(pLinePoints[j], pLinePoints[j + 1], pt1, 0, dGlyphSize);
                            nCounter++;
                        }
                    }
                    //pSpikePoints[nCounter] = LineUtility.extendLine(pLinePoints[j], pSpikePoints[nCounter - 3], 10, 0);
                    pSpikePoints[nCounter] = LineUtility.extendLine(pLinePoints[j], pSpikePoints[nCounter - 3], dSegIncrement / 2, 0);
                    nCounter++;
                }//end for k
                pSpikePoints[nCounter] = new POINT2(pLinePoints[j + 1]);
                nCounter++;
            }//end for j
            for (j = 0; j < nCounter; j++) {
                pLinePoints[j] = new POINT2(pSpikePoints[j]);
            }

            return nCounter;
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(arraysupport._className, "GetFORTLPointsDouble",
                    exc);
            } else {
                throw exc;
            }
        }
        return nCounter;
    }

    private static GetATWallPointsDouble2(tg: TacticalGraphic, pLinePoints: POINT2[], vblSaveCounter: number): number {
        let nCounter: number = 0;
        try {
            let j: number = 0;
            let k: number = 0;
            let lCount: number = 0;
            let dLengthSegment: number = 0;
            let dIncrement: number = 0;
            let pSpikePoints: POINT2[];
            let pt0: POINT2;
            let dSpikeSize: number = 0;
            let limit: number = 0;
            let numSpikes: number = 0;;

            lCount = countsupport.GetFORTLCountDouble(tg, pLinePoints, vblSaveCounter);
            pSpikePoints = new Array<POINT2>(lCount);
            LineUtility.InitializePOINT2Array(pSpikePoints);
            pSpikePoints[nCounter++] = new POINT2(pLinePoints[0]);
            for (j = 0; j < vblSaveCounter - 1; j++) {
                dLengthSegment = LineUtility.calcDistance(pLinePoints[j], pLinePoints[j + 1]);
                dSpikeSize = arraysupport.getScaledSize(10, tg.lineThickness, tg.patternScale);
                dIncrement = 2 * dSpikeSize;
                //  diagnostic
                numSpikes = Math.round((dLengthSegment - dSpikeSize) / dIncrement) as number;
                dIncrement = dLengthSegment / numSpikes;

                //limit = (int) (dLengthSegment / dIncrement) - 1;
                limit = numSpikes - 1;
                //                if (limit < 1) {
                //                    pSpikePoints[nCounter] = new POINT2(pLinePoints[j]);
                //                    nCounter++;
                //                    pSpikePoints[nCounter] = new POINT2(pLinePoints[j + 1]);
                //                    nCounter++;
                //                    continue;
                //                }
                //  end diagnostic                
                for (k = -1; k < limit; k++)//was k=0 to limit
                {
                    pSpikePoints[nCounter] = LineUtility.extendLine(pLinePoints[j + 1], pLinePoints[j], -k * dIncrement - (dSpikeSize * 3), 0);
                    nCounter++;

                    pt0 = LineUtility.ExtendLineDouble(pLinePoints[j], pSpikePoints[nCounter - 1], dSpikeSize / 2);

                    //the spikes
                    if (pLinePoints[j].x > pLinePoints[j + 1].x) //extend above the line
                    {
                        pSpikePoints[nCounter] = LineUtility.ExtendDirectedLine(pLinePoints[j], pSpikePoints[nCounter - 1], pt0, 2, dSpikeSize);
                    }
                    if (pLinePoints[j].x < pLinePoints[j + 1].x) //extend below the line
                    {
                        pSpikePoints[nCounter] = LineUtility.ExtendDirectedLine(pLinePoints[j], pSpikePoints[nCounter - 1], pt0, 3, dSpikeSize);
                    }
                    if (pLinePoints[j].x === pLinePoints[j + 1].x) {
                        pSpikePoints[nCounter] = new POINT2(pt0);
                        if (pLinePoints[j].y < pLinePoints[j + 1].y) //extend left of line
                        {
                            pSpikePoints[nCounter].x = pt0.x - dSpikeSize;
                        } else //extend right of line
                        {
                            pSpikePoints[nCounter].x = pt0.x + dSpikeSize;
                        }
                    }
                    nCounter++;

                    pSpikePoints[nCounter] = LineUtility.extendLine(pLinePoints[j], pSpikePoints[nCounter - 2], dSpikeSize, 0);
                    nCounter++;
                }
                //use the original line point for the segment end point
                pSpikePoints[nCounter] = new POINT2(pLinePoints[j + 1]);
                pSpikePoints[nCounter].style = 0;
                nCounter++;
            }

            for (j = 0; j < nCounter; j++) {
                pLinePoints[j] = new POINT2(pSpikePoints[j]);
            }

        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(arraysupport._className, "GetATWallPointsDouble",
                    exc);
            } else {
                throw exc;
            }
        }
        return nCounter;
    }

    public static GetInsideOutsideDouble2(pt0: POINT2,
        pt1: POINT2,
        pLinePoints: POINT2[],
        vblCounter: number,
        index: number,
        lineType: number): number {
        let nDirection: number = 0;
        try {
            let mVal: number = 0;
            let m0Val: number = 0;

            let b0: number = 0;
            let b2: number = 0;

            let b: number = 0;
            let X0: number = 0;	//segment midpoint X value
            let Y0: number = 0;	//segment midpoint Y value
            let X: number = 0;	//X value of horiz line from left intercept with current segment
            let Y: number = 0;	//Y value of vertical line from top intercept with current segment
            let nInOutCounter: number = 0;
            let j: number = 0;
            let bolVertical: number = 0;
            let bolVertical2: number = 0;
            let nOrientation: number = 0; //will use 0 for horiz line from left, 1 for vertical line from top

            let pt2: POINT2 = new POINT2();
            //end declarations. will use this to determine the direction

            //slope of the segment
            ({ result: bolVertical, slope: m0Val } = LineUtility.calcTrueSlope(pt0, pt1));
            //get the midpoint of the segment
            X0 = (pt0.x + pt1.x) / 2;
            Y0 = (pt0.y + pt1.y) / 2;

            //slope is not too small or is vertical, use left to right
            if (Math.abs(m0Val) >= 1 || bolVertical === 0) {
                nOrientation = 0;	//left to right orientation
                for (j = 0; j < vblCounter - 1; j++) {
                    if (index !== j) {
                        //if ((pLinePoints[j].y <= Y0 && pLinePoints[j + 1].y >= Y0) ||
                        //      (pLinePoints[j].y >= Y0 && pLinePoints[j + 1].y <= Y0))
                        if ((pLinePoints[j].y < Y0 && pLinePoints[j + 1].y > Y0)
                            || (pLinePoints[j].y > Y0 && pLinePoints[j + 1].y < Y0)
                            || (pLinePoints[j].y < Y0 && pLinePoints[j + 1].y === Y0)
                            || (pLinePoints[j].y === Y0 && pLinePoints[j + 1].y < Y0)) {
                            ({ result: bolVertical2, slope: mVal } = LineUtility.calcTrueSlope(pLinePoints[j], pLinePoints[j + 1]));
                            if (bolVertical2 === 1 && mVal === 0) //current segment is horizontal, this should not happen
                            {	//counter unaffected
                                nInOutCounter++;
                                nInOutCounter--;
                            }
                            //current segment is vertical, it's x value must be to the left
                            //of the current segment X0 for the horiz line from the left to cross
                            if (bolVertical2 === 0) {
                                if (pLinePoints[j].x < X0) {
                                    nInOutCounter++;
                                }
                            }

                            //current segment is not horizontal and not vertical
                            if (mVal !== 0 && bolVertical2 === 1) {
                                //get the X value of the intersection between the horiz line
                                //from the left and the current segment
                                //b=Y0;
                                b = pLinePoints[j].y - mVal * pLinePoints[j].x;
                                X = (Y0 - b) / mVal;
                                if (X < X0) //the horizontal line crosses the segment
                                {
                                    nInOutCounter++;
                                }
                            }

                        }	//end if
                    }

                }	//end for
            } //end if
            else //use top to bottom to get orientation
            {
                nOrientation = 1;	//top down orientation
                for (j = 0; j < vblCounter - 1; j++) {
                    if (index !== j) {
                        //if ((pLinePoints[j].x <= X0 && pLinePoints[j + 1].x >= X0) ||
                        //  (pLinePoints[j].x >= X0 && pLinePoints[j + 1].x <= X0))
                        if ((pLinePoints[j].x < X0 && pLinePoints[j + 1].x > X0)
                            || (pLinePoints[j].x > X0 && pLinePoints[j + 1].x < X0)
                            || (pLinePoints[j].x < X0 && pLinePoints[j + 1].x === X0)
                            || (pLinePoints[j].x === X0 && pLinePoints[j + 1].x < X0)) {
                            ({ result: bolVertical2, slope: mVal } = LineUtility.calcTrueSlope(pLinePoints[j], pLinePoints[j + 1]));
                            if (bolVertical2 === 0) //current segment is vertical, this should not happen
                            {	//counter unaffected
                                nInOutCounter++;
                                nInOutCounter--;
                            }
                            //current segment is horizontal, it's y value must be above
                            //the current segment Y0 for the horiz line from the left to cross
                            if (bolVertical2 === 1 && mVal === 0) {
                                if (pLinePoints[j].y < Y0) {
                                    nInOutCounter++;
                                }
                            }

                            //current segment is not horizontal and not vertical
                            if (mVal !== 0 && bolVertical2 === 1) {
                                //get the Y value of the intersection between the vertical line
                                //from the top and the current segment
                                b = pLinePoints[j].y - mVal * pLinePoints[j].x;
                                Y = mVal * X0 + b;
                                if (Y < Y0) //the vertical line crosses the segment
                                {
                                    nInOutCounter++;
                                }
                            }
                        }	//end if
                    }
                }	//end for
            }

            switch (nInOutCounter % 2) {
                case 0: {
                    if (nOrientation === 0) {
                        nDirection = LineUtility.extend_left;
                    } else {
                        nDirection = LineUtility.extend_above;
                    }
                    break;
                }

                case 1: {
                    if (nOrientation === 0) {
                        nDirection = LineUtility.extend_right;
                    } else {
                        nDirection = LineUtility.extend_below;
                    }
                    break;
                }

                default: {
                    break;
                }

            }
            //reverse direction for ICING
             if (lineType == TacticalLines.ICING) {
                nDirection = LineUtility.reverseDirection(nDirection);
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(arraysupport._className, "GetInsideOutsideDouble2",
                    exc);
            } else {
                throw exc;
            }
        }
        return nDirection;
    }

    /**
     * BELT and others
     *
     * @param pLinePoints
     * @param vblSaveCounter
     * @return
     */
    protected static GetZONEPointsDouble2(tg: TacticalGraphic, pLinePoints: POINT2[], vblSaveCounter: number): number {
        let nCounter: number = 0;
        try {
            let lineType: number = tg.lineType;
            let j: number = 0;
            let k: number = 0;
            let n: number = 0;
            let lCount: number = 0;
            let dLengthSegment: number = 0;
            let pt0: POINT2 = new POINT2(pLinePoints[0]);
            let pt1: POINT2;
            let pt2: POINT2;
            let pt3: POINT2;
            let pSpikePoints: POINT2[];
            let nDirection: number = 0;
            let dIncrement: number = arraysupport.getScaledSize(20, tg.lineThickness, tg.patternScale);

            lCount = countsupport.GetFORTLCountDouble(tg, pLinePoints, vblSaveCounter);
            pSpikePoints = new Array<POINT2>(lCount);
            LineUtility.InitializePOINT2Array(pSpikePoints);
            let remainder: number = 0;
            for (j = 0; j < vblSaveCounter - 1; j++) {
                pt1 = new POINT2(pLinePoints[j]);
                pt2 = new POINT2(pLinePoints[j + 1]);
                //get the direction for the spikes
                nDirection = arraysupport.GetInsideOutsideDouble2(pt1, pt2, pLinePoints, vblSaveCounter, j as number, lineType);
                dLengthSegment = LineUtility.calcDistance(pLinePoints[j], pLinePoints[j + 1]);
                //reverse the direction for those lines with inward spikes
                if (dLengthSegment < dIncrement) {
                    pSpikePoints[nCounter] = new POINT2(pLinePoints[j]);
                    nCounter++;
                    pSpikePoints[nCounter] = new POINT2(pLinePoints[j + 1]);
                    nCounter++;
                    continue;
                }
                switch (lineType) {
                    case TacticalLines.OBSAREA:
                    case TacticalLines.OBSFAREA: {
                        nDirection = LineUtility.reverseDirection(nDirection);
                        break;
                    }

                    default: {
                        break;
                    }

                }
                n = Math.trunc(dLengthSegment / dIncrement);
                remainder = dLengthSegment - n * dIncrement;
                for (k = 0; k < n; k++) {
                    if (k > 0) {
                        pSpikePoints[nCounter++] = LineUtility.extendLine(pLinePoints[j + 1], pLinePoints[j], -k * dIncrement - remainder / 2, 0);//was +0
                        pSpikePoints[nCounter++] = LineUtility.extendLine(pLinePoints[j + 1], pLinePoints[j], -k * dIncrement - dIncrement / 2 - remainder / 2, 0);//was -10
                    } else {
                        pSpikePoints[nCounter++] = LineUtility.extendLine(pLinePoints[j + 1], pLinePoints[j], -k * dIncrement, 0);//was +0
                        pSpikePoints[nCounter++] = LineUtility.extendLine(pLinePoints[j + 1], pLinePoints[j], -k * dIncrement - dIncrement / 2, 0);//was -10
                    }

                    switch (lineType) {
                        case TacticalLines.OBSAREA:
                        case TacticalLines.OBSFAREA:
                        case TacticalLines.ZONE:
                        case TacticalLines.ENCIRCLE: {
                            pt0 = LineUtility.ExtendLineDouble(pLinePoints[j], pSpikePoints[nCounter - 1], dIncrement / 4);
                            break;
                        }

                        case TacticalLines.STRONG:
                        case TacticalLines.FORT_REVD:
                        case TacticalLines.FORT: {
                            pt0 = new POINT2(pSpikePoints[nCounter - 1]);
                            break;
                        }

                        default: {
                            break;
                        }

                    }

                    pSpikePoints[nCounter++] = LineUtility.ExtendDirectedLine(pt1, pt2, pt0, nDirection, dIncrement / 2);
                    //nCounter++;
                    switch (lineType) {
                        case TacticalLines.OBSAREA:
                        case TacticalLines.OBSFAREA:
                        case TacticalLines.ZONE:
                        case TacticalLines.ENCIRCLE: {
                            pSpikePoints[nCounter] = LineUtility.extendLine(pLinePoints[j], pSpikePoints[nCounter - 2], dIncrement / 2, 0);
                            break;
                        }

                        case TacticalLines.STRONG: {
                            pSpikePoints[nCounter] = new POINT2(pSpikePoints[nCounter - 2]);
                            break;
                        }

                        case TacticalLines.FORT_REVD:
                        case TacticalLines.FORT: {
                            pt3 = LineUtility.extendLine(pLinePoints[j], pSpikePoints[nCounter - 2], dIncrement / 2, 0);
                            pSpikePoints[nCounter] = LineUtility.ExtendDirectedLine(pt1, pt2, pt3, nDirection, dIncrement / 2);
                            nCounter++;
                            pSpikePoints[nCounter] = new POINT2(pt3);
                            break;
                        }

                        default: {
                            break;
                        }

                    }
                    //}
                    nCounter++;
                    //diagnostic
                    if (lineType === TacticalLines.ENCIRCLE) {
                        pSpikePoints[nCounter++] = new POINT2(pSpikePoints[nCounter - 4]);
                    }
                }//end for k
                pSpikePoints[nCounter++] = new POINT2(pLinePoints[j + 1]);
                //nCounter++;
            }//end for j
            for (j = 0; j < nCounter; j++) {
                if (lineType === TacticalLines.OBSAREA) {
                    pSpikePoints[j].style = 11;
                }
            }
            if (lineType === TacticalLines.OBSAREA) {
                pSpikePoints[nCounter - 1].style = 12;
            } else {
                if (nCounter > 0) {
                    pSpikePoints[nCounter - 1].style = 5;
                }
            }

            for (j = 0; j < nCounter; j++) {
                pLinePoints[j] = new POINT2(pSpikePoints[j]);
                if (j === nCounter - 1) {
                    if (lineType !== TacticalLines.OBSAREA) {
                        pLinePoints[j].style = 5;
                    }
                }
            }

        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(arraysupport._className, "GetZONEPointsDouble2",
                    exc);
            } else {
                throw exc;
            }
        }
        return nCounter;
    }

    private static IsTurnArcReversed(pPoints: POINT2[]): boolean {
        try {
            if (pPoints.length < 3) {
                return false;
            }

            let ptsSeize: POINT2[] = new Array<POINT2>(2);
            ptsSeize[0] = new POINT2(pPoints[0]);
            ptsSeize[1] = new POINT2(pPoints[1]);
            LineUtility.calcClockwiseCenter(ptsSeize);
            let d: number = LineUtility.calcDistance(ptsSeize[0], pPoints[2]);

            ptsSeize[0] = new POINT2(pPoints[1]);
            ptsSeize[1] = new POINT2(pPoints[0]);
            LineUtility.calcClockwiseCenter(ptsSeize);
            let dArcReversed: number = LineUtility.calcDistance(ptsSeize[0], pPoints[2]);

            if (dArcReversed > d) {
                return true;
            } else {
                return false;
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(arraysupport._className, "IsTurnArcReversed",
                    exc);
            } else {
                throw exc;
            }
        }
        return false;
    }

    private static GetIsolatePointsDouble(pLinePoints: POINT2[],
        lineType: number,
        converter: IPointConversion | null): void {
        try {
            let pt0: POINT2 = new POINT2(pLinePoints[0]);
            let pt1: POINT2 = new POINT2(pLinePoints[1]);
            let pt2: POINT2 = new POINT2(pLinePoints[0]);
            if (pt0.x === pt1.x && pt0.y === pt1.y) {
                pt1.x += 1;
            }

            let C: POINT2 = new POINT2();
            let E: POINT2 = new POINT2();
            let j: number = 0;
            let k: number = 0;
            let l: number = 0;
            let ptsArc: POINT2[] = new Array<POINT2>(26);
            let midPts: POINT2[] = new Array<POINT2>(7);
            let trianglePts: POINT2[] = new Array<POINT2>(35);
            let pArrowPoints: POINT2[] = new Array<POINT2>(3);
            let dRadius: number = LineUtility.calcDistance(pt0, pt1);
            let dLength: number = Math.abs(dRadius - 20);
            if (dRadius < 40) {
                dLength = dRadius / 1.5;
            }

            let d: number = LineUtility.MBRDistance(pLinePoints, 2);
            let ptsSeize: POINT2[] = new Array<POINT2>(2);
            let savepoints: POINT2[] = new Array<POINT2>(3);
            for (j = 0; j < 2; j++) {
                savepoints[j] = new POINT2(pLinePoints[j]);
            }

            if (pLinePoints.length >= 3) {
                savepoints[2] = new POINT2(pLinePoints[2]);
            }

            LineUtility.InitializePOINT2Array(ptsArc);
            LineUtility.InitializePOINT2Array(midPts);
            LineUtility.InitializePOINT2Array(trianglePts);
            LineUtility.InitializePOINT2Array(pArrowPoints);
            LineUtility.InitializePOINT2Array(ptsSeize);

            let DPIScaleFactor: number = rendererSettings.getDeviceDPI() / 96.0;
            if (d / 7 > arraysupport.maxLength * DPIScaleFactor) {
                d = 7 * arraysupport.maxLength * DPIScaleFactor;
            }
            if (d / 7 < arraysupport.minLength * DPIScaleFactor) {  //was minLength
                d = 7 * arraysupport.minLength * DPIScaleFactor;    //was minLength
            }
            //change due to outsized arrow in 6.0, 11-3-10
            if (d > 140 * DPIScaleFactor) {
                d = 140 * DPIScaleFactor;
            }
            //calculation points for the SEIZE arrowhead
            //for SEIZE calculations
            let ptsArc2: POINT2[] = new Array<POINT2>(26);
            LineUtility.InitializePOINT2Array(ptsArc2);

            E.x = 2 * pt1.x - pt0.x;
            E.y = 2 * pt1.y - pt0.y;
            ptsArc[0] = new POINT2(pLinePoints[1]);
            ptsArc[1] = new POINT2(E);
            if (converter != null) {
                ptsArc[0] = new POINT2(pLinePoints[0]);
                ptsArc[1] = new POINT2(pLinePoints[1]);
            }

            LineUtility.arcArray(ptsArc, 0, dRadius, lineType, converter);
            for (j = 0; j < 26; j++) {
                ptsArc[j].style = 0;
                pLinePoints[j] = new POINT2(ptsArc[j]);
                pLinePoints[j].style = 0;
            }
            if (lineType !== TacticalLines.OCCUPY) {
                LineUtility.GetArrowHead4Double(ptsArc[24], ptsArc[25], Math.trunc(d / 7), Math.trunc(d  / 7), pArrowPoints, 0);
            } else {
                LineUtility.GetArrowHead4Double(ptsArc[24], ptsArc[25], Math.trunc(d / 7), Math.trunc((1.75 * d) / 7), pArrowPoints, 0);
            }

            pLinePoints[25].style = 5;

            switch (lineType) {
                case TacticalLines.CORDONKNOCK:
                case TacticalLines.CORDONSEARCH:
                case TacticalLines.ISOLATE: {
                    if (dRadius > 100) {
                        dLength = 0.8 * dRadius;
                    }
                    for (j = 1; j <= 23; j++) {
                        if (j % 3 === 0) {
                            midPts[k].x = pt0.x - ((dLength / dRadius) * (pt0.x - ptsArc[j].x));
                            midPts[k].y = pt0.y - ((dLength / dRadius) * (pt0.y - ptsArc[j].y));
                            midPts[k].style = 0;
                            trianglePts[l] = new POINT2(ptsArc[j - 1]);
                            l++;
                            trianglePts[l] = new POINT2(midPts[k]);
                            l++;
                            trianglePts[l] = new POINT2(ptsArc[j + 1]);
                            trianglePts[l].style = 5;
                            l++;
                            k++;
                        }
                    }
                    for (j = 26; j < 47; j++) {
                        pLinePoints[j] = new POINT2(trianglePts[j - 26]);
                    }
                    pLinePoints[46].style = 5;
                    for (j = 47; j < 50; j++) {
                        pLinePoints[j] = new POINT2(pArrowPoints[j - 47]);
                        pLinePoints[j].style = 0;
                    }
                    break;
                }

                case TacticalLines.AREA_DEFENSE: {
                    if (dRadius > 100) {
                        dLength = 0.8 * dRadius;
                    }
                    for (j = 1; j <= 23; j++) {
                        if (j % 3 == 0) {
                            midPts[k].x = pt0.x - ((dRadius / dLength) * (pt0.x - ptsArc[j].x));
                            midPts[k].y = pt0.y - ((dRadius / dLength) * (pt0.y - ptsArc[j].y));
                            trianglePts[l] = new POINT2(ptsArc[j - 1]);
                            trianglePts[l].style = 9;
                            l++;
                            trianglePts[l] = new POINT2(midPts[k]);
                            trianglePts[l].style = 9;
                            l++;
                            trianglePts[l] = new POINT2(ptsArc[j + 1]);
                            trianglePts[l].style = 9;
                            l++;
                            trianglePts[l] = new POINT2(ptsArc[j]);
                            trianglePts[l].style = 9;
                            l++;
                            trianglePts[l] = new POINT2(ptsArc[j - 1]);
                            trianglePts[l].style = 10;
                            l++;
                            k++;
                        }
                    }
                    for (j = 26; j < 61; j++) {
                        pLinePoints[j] = new POINT2(trianglePts[j - 26]);
                    }
                    for (j = 61; j < 64; j++) {
                        pLinePoints[j] = new POINT2(pArrowPoints[j - 61]);
                        pLinePoints[j].style = 0;
                    }

                    LineUtility.GetArrowHead4Double(ptsArc[1], ptsArc[0], d / 7, d / 7, pArrowPoints, 0);
                    pLinePoints[63].style = 5;
                    for (j = 64; j < 67; j++) {
                        pLinePoints[j] = new POINT2(pArrowPoints[j - 64]);
                        pLinePoints[j].style = 0;
                    }
                    break;
                }

                case TacticalLines.OCCUPY: {
                    for (j = 26; j < 29; j++) {
                        pLinePoints[j] = new POINT2(pArrowPoints[j - 26]);
                    }

                    pLinePoints[29] = LineUtility.extendAlongLine(pArrowPoints[0], pArrowPoints[1], LineUtility.calcDistance(pArrowPoints[0], pArrowPoints[1]) * 2);
                    pLinePoints[30] = new POINT2(pArrowPoints[1]);
                    pLinePoints[31] = LineUtility.extendAlongLine(pArrowPoints[2], pArrowPoints[1], LineUtility.calcDistance(pArrowPoints[2], pArrowPoints[1]) * 2);
                    break;
                }

                case TacticalLines.SECURE: {
                    for (j = 26; j < 29; j++) {
                        pLinePoints[j] = new POINT2(pArrowPoints[j - 26]);
                        pLinePoints[j].style = 0;
                    }
                    pLinePoints[28].style = 5;
                    break;
                }


                case TacticalLines.TURN_REVD:
                case TacticalLines.TURN: {
                    let changeArc: boolean = arraysupport.IsTurnArcReversed(savepoints);
                    if (changeArc) //swap the points
                    {
                        pt0.x = pt1.x;
                        pt0.y = pt1.y;
                        pt1.x = pt2.x;
                        pt1.y = pt2.y;
                    }

                    ptsSeize[0] = new POINT2(pt0);
                    ptsSeize[1] = new POINT2(pt1);

                    dRadius = LineUtility.calcClockwiseCenter(ptsSeize);

                    C = new POINT2(ptsSeize[0]);
                    E = new POINT2(ptsSeize[1]);
                    ptsArc[0] = new POINT2(pt0);
                    ptsArc[1] = new POINT2(E);
                    LineUtility.arcArray(ptsArc, 0, dRadius, lineType, null);
                    for (j = 0; j < 26; j++) {
                        ptsArc[j].style = 0;
                        pLinePoints[j] = new POINT2(ptsArc[j]);
                        pLinePoints[j].style = 0;
                    }

                    if (changeArc) {
                        LineUtility.GetArrowHead4Double(ptsArc[1], pt0, Math.trunc(d / 7), Math.trunc(d / 7), pArrowPoints, 5);
                    } else {
                        LineUtility.GetArrowHead4Double(ptsArc[24], pt1, Math.trunc(d / 7), Math.trunc(d / 7), pArrowPoints, 5);
                    }

                    pLinePoints[25].style = 5;

                    for (j = 26; j < 29; j++) {
                        pLinePoints[j] = new POINT2(pArrowPoints[j - 26]);
                        pLinePoints[j].style = 9;
                    }
                    pLinePoints[28].style = 10;

                    break;
                }

                case TacticalLines.RETAIN: {
                    for (j = 26; j < 29; j++) {
                        pLinePoints[j] = new POINT2(pArrowPoints[j - 26]);
                        pLinePoints[j].style = 0;
                    }
                    pLinePoints[28].style = 5;
                    //get the extended points for retain
                    k = 29;
                    for (j = 1; j < 24; j++) {
                        pLinePoints[k] = new POINT2(ptsArc[j]);
                        pLinePoints[k].style = 0;
                        k++;
                        pLinePoints[k] = LineUtility.ExtendLineDouble(pt0, ptsArc[j], d / 7);
                        pLinePoints[k].style = 5;
                        k++;
                    }

                    break;
                }

                default: {
                    break;
                }

            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(arraysupport._className, "GetIsolatePointsDouble",
                    exc);
            } else {
                throw exc;
            }
        }
    }

    private static AirfieldCenterFeature(pLinePoints: POINT2[], vblCounter: number): void {
        try {
            let d: number = LineUtility.MBRDistance(pLinePoints, vblCounter - 5);
            let DPIScaleFactor: number = rendererSettings.getDeviceDPI() / 96.0;
            if (d > 350 * DPIScaleFactor) {
                d = 350 * DPIScaleFactor;
            } else {
                if (d < 100 * DPIScaleFactor) {
                    d = 100 * DPIScaleFactor;
                }
            }


            for (let k: number = 0; k < vblCounter; k++) {
                pLinePoints[k].style = 0;
            }

            pLinePoints[vblCounter - 5] = new POINT2(pLinePoints[0]);
            pLinePoints[vblCounter - 5].style = 5;
            pLinePoints[vblCounter - 4] = LineUtility.CalcCenterPointDouble(pLinePoints, vblCounter - 6);
            pLinePoints[vblCounter - 4].x -= d / 10;    //was 20
            pLinePoints[vblCounter - 4].style = 0;
            pLinePoints[vblCounter - 3] = new POINT2(pLinePoints[vblCounter - 4]);
            pLinePoints[vblCounter - 3].x = pLinePoints[vblCounter - 4].x + d / 5;//was 10
            pLinePoints[vblCounter - 3].style = 5;
            pLinePoints[vblCounter - 2] = new POINT2(pLinePoints[vblCounter - 4]);
            pLinePoints[vblCounter - 2].y += d / 20;//was 40
            pLinePoints[vblCounter - 2].style = 0;
            pLinePoints[vblCounter - 1] = new POINT2(pLinePoints[vblCounter - 3]);
            pLinePoints[vblCounter - 1].y -= d / 20;//was 40
            pLinePoints[vblCounter - 1].style = 0;
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(arraysupport._className, "AirfieldCenterFeature",
                    exc);
            } else {
                throw exc;
            }
        }
    }

    private static GetATWallPointsDouble(tg: TacticalGraphic, pLinePoints: POINT2[], vblSaveCounter: number): number {
        let nCounter: number = 0;
        try {
            let lineType: number = tg.lineType;
            let j: number = 0;
            let k: number = 0;
            let lCount: number = 0;
            let dLengthSegment: number = 0;
            let dIncrement: number = 0;
            let pSpikePoints: POINT2[];
            let pt0: POINT2;
            let dRemainder: number = 0;
            let dSpikeSize: number = 0;
            let limit: number = 0;
            let crossPt1: POINT2;
            let crossPt2: POINT2;

            lCount = countsupport.GetFORTLCountDouble(tg, pLinePoints, vblSaveCounter);
            pSpikePoints = new Array<POINT2>(lCount);
            switch (lineType) {
                case TacticalLines.CFG:
                case TacticalLines.CFY: {
                    pSpikePoints[nCounter] = pLinePoints[0];
                    pSpikePoints[nCounter].style = 0;
                    nCounter++;
                    break;
                }

                default: {
                    break;
                }

            }
            for (j = 0; j < vblSaveCounter - 1; j++) {
                dLengthSegment = LineUtility.calcDistance(pLinePoints[j], pLinePoints[j + 1]);
                switch (lineType) {
                    case TacticalLines.UCF:
                    case TacticalLines.CF:
                    case TacticalLines.CFG:
                    case TacticalLines.CFY: {
                        dIncrement = arraysupport.getScaledSize(60, tg.lineThickness, tg.patternScale);
                        dSpikeSize = arraysupport.getScaledSize(20, tg.lineThickness, tg.patternScale);
                        dRemainder = dLengthSegment / dIncrement - (Math.trunc(dLengthSegment / dIncrement));
                        if (dRemainder < 0.75) {
                            limit = Math.trunc(dLengthSegment / dIncrement);
                        } else {
                            limit = Math.trunc(dLengthSegment / dIncrement) + 1;
                        }
                        break;
                    }

                    default: {
                        dIncrement = arraysupport.getScaledSize(20, tg.lineThickness, tg.patternScale);
                        dSpikeSize = arraysupport.getScaledSize(10, tg.lineThickness, tg.patternScale);
                        limit = Math.trunc(dLengthSegment / dIncrement) - 1;
                        break;
                    }

                }
                if (limit < 1) {
                    pSpikePoints[nCounter] = pLinePoints[j];
                    nCounter++;
                    pSpikePoints[nCounter] = pLinePoints[j + 1];
                    nCounter++;
                    continue;
                }

                for (k = 0; k < limit; k++) {
                    switch (lineType) {
                        case TacticalLines.CFG: {	//linebreak for dot
                            if (k > 0) {
                                pSpikePoints[nCounter] = LineUtility.extendLine(pLinePoints[j + 1], pLinePoints[j], -k * dIncrement + arraysupport.getScaledSize(45, tg.lineThickness, tg.patternScale), 0);
                                nCounter++;
                                pSpikePoints[nCounter] = LineUtility.extendLine(pLinePoints[j + 1], pLinePoints[j], -k * dIncrement + arraysupport.getScaledSize(4, tg.lineThickness, tg.patternScale), 5);	//+2
                                nCounter++;
                                //dot
                                pSpikePoints[nCounter] = LineUtility.extendLine(pLinePoints[j + 1], pLinePoints[j], -k * dIncrement - arraysupport.getScaledSize(1, tg.lineThickness, tg.patternScale), 20);
                                nCounter++;
                                //remainder of line
                                pSpikePoints[nCounter] = LineUtility.extendLine(pLinePoints[j + 1], pLinePoints[j], -k * dIncrement - arraysupport.getScaledSize(10, tg.lineThickness, tg.patternScale), 0);	//-4
                            } else {
                                pSpikePoints[nCounter] = LineUtility.extendLine(pLinePoints[j + 1], pLinePoints[j], -k * dIncrement - arraysupport.getScaledSize(45, tg.lineThickness, tg.patternScale), 0);
                            }
                            break;
                        }

                        case TacticalLines.CFY: {	//linebreak for crossed line
                            if (k > 0) {
                                pSpikePoints[nCounter] = LineUtility.extendLine(pLinePoints[j + 1], pLinePoints[j], -k * dIncrement + arraysupport.getScaledSize(45, tg.lineThickness, tg.patternScale), 0);
                                nCounter++;
                                pSpikePoints[nCounter] = LineUtility.extendLine(pLinePoints[j + 1], pLinePoints[j], -k * dIncrement + arraysupport.getScaledSize(10, tg.lineThickness, tg.patternScale), 5);	//+2
                                nCounter++;
                                //dot
                                //replace the dot with crossed line segment
                                pSpikePoints[nCounter] = LineUtility.extendAlongLine(pSpikePoints[nCounter - 1], pLinePoints[j + 1], arraysupport.getScaledSize(5, tg.lineThickness, tg.patternScale), 0);
                                nCounter++;
                                pSpikePoints[nCounter] = LineUtility.extendAlongLine(pSpikePoints[nCounter - 1], pLinePoints[j + 1], arraysupport.getScaledSize(10, tg.lineThickness, tg.patternScale), 5);
                                nCounter++;
                                crossPt1 = LineUtility.ExtendDirectedLine(pSpikePoints[nCounter - 2], pSpikePoints[nCounter - 1], pSpikePoints[nCounter - 1], 3, arraysupport.getScaledSize(5, tg.lineThickness, tg.patternScale), 0);
                                crossPt2 = LineUtility.ExtendDirectedLine(pSpikePoints[nCounter - 1], pSpikePoints[nCounter - 2], pSpikePoints[nCounter - 2], 2, arraysupport.getScaledSize(5, tg.lineThickness, tg.patternScale), 5);
                                pSpikePoints[nCounter] = crossPt1;
                                nCounter++;
                                pSpikePoints[nCounter] = crossPt2;
                                nCounter++;
                                //remainder of line
                                pSpikePoints[nCounter] = LineUtility.extendLine(pLinePoints[j + 1], pLinePoints[j], -k * dIncrement - arraysupport.getScaledSize(10, tg.lineThickness, tg.patternScale), 0);	//-4
                            } else {
                                pSpikePoints[nCounter] = LineUtility.extendLine(pLinePoints[j + 1], pLinePoints[j], -k * dIncrement - arraysupport.getScaledSize(45, tg.lineThickness, tg.patternScale), 0);
                            }
                            break;
                        }

                        default: {
                            pSpikePoints[nCounter] = LineUtility.extendLine(pLinePoints[j + 1], pLinePoints[j], -k * dIncrement - arraysupport.getScaledSize(30, tg.lineThickness, tg.patternScale), 0);
                            break;
                        }

                    }
                    if (lineType === TacticalLines.CF) {
                        pSpikePoints[nCounter].style = 0;
                    }
                    nCounter++;
                    pSpikePoints[nCounter] = LineUtility.extendLine(pLinePoints[j + 1], pLinePoints[j], -k * dIncrement - dSpikeSize, 0);

                    if (lineType === TacticalLines.CF
                        || lineType === TacticalLines.CFG
                        || lineType === TacticalLines.CFY) {
                        pSpikePoints[nCounter].style = 9;
                    }

                    nCounter++;
                    pt0 = LineUtility.ExtendLineDouble(pLinePoints[j], pSpikePoints[nCounter - 1], dSpikeSize / 2);

                    //the spikes
                    if (pLinePoints[j].x > pLinePoints[j + 1].x) //extend above the line
                    {
                        pSpikePoints[nCounter] = LineUtility.ExtendDirectedLine(pLinePoints[j], pSpikePoints[nCounter - 1], pt0, 2, dSpikeSize);
                    }
                    if (pLinePoints[j].x < pLinePoints[j + 1].x) //extend below the line
                    {
                        pSpikePoints[nCounter] = LineUtility.ExtendDirectedLine(pLinePoints[j], pSpikePoints[nCounter - 1], pt0, 3, dSpikeSize);
                    }
                    if (pLinePoints[j].x === pLinePoints[j + 1].x) {
                        pSpikePoints[nCounter] = pt0;
                        if (pLinePoints[j].y < pLinePoints[j + 1].y) //extend left of line
                        {
                            pSpikePoints[nCounter].x = pt0.x - dSpikeSize;
                        } else //extend right of line
                        {
                            pSpikePoints[nCounter].x = pt0.x + dSpikeSize;
                        }
                    }
                    nCounter++;

                    if (lineType === TacticalLines.CF
                        || lineType === TacticalLines.CFG
                        || lineType === TacticalLines.CFY) {
                        pSpikePoints[nCounter - 1].style = 9;
                    }

                    pSpikePoints[nCounter] = LineUtility.extendLine(pLinePoints[j], pSpikePoints[nCounter - 2], dSpikeSize, 0);
                    //need an extra point for these
                    switch (lineType) {
                        case TacticalLines.CF: {
                            pSpikePoints[nCounter].style = 10;
                            break;
                        }

                        case TacticalLines.CFG:
                        case TacticalLines.CFY: {
                            pSpikePoints[nCounter].style = 10;
                            nCounter++;
                            pSpikePoints[nCounter] = LineUtility.extendLine(pLinePoints[j], pSpikePoints[nCounter - 3], dSpikeSize, 0);
                            break;
                        }

                        default: {
                            break;
                        }

                    }
                    nCounter++;
                }

                //use the original line point for the segment end point
                pSpikePoints[nCounter] = pLinePoints[j + 1];
                pSpikePoints[nCounter].style = 0;
                nCounter++;
            }

            for (j = 0; j < nCounter; j++) {
                pLinePoints[j] = pSpikePoints[j];
            }
            pLinePoints[nCounter - 1].style = 5;

        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(arraysupport._className, "GetATWallPointsDouble",
                    exc);
            } else {
                throw exc;
            }
        }
        return nCounter;
    }

    private static GetRidgePointsDouble(tg: TacticalGraphic, pLinePoints: POINT2[], vblSaveCounter: number): number {
        let nCounter: number = 0;
        try {
            let j: number = 0;
            let k: number = 0;
            let lCount: number = 0;
            let dLengthSegment: number = 0;
            let dIncrement: number = arraysupport.getScaledSize(20, tg.lineThickness, tg.patternScale);
            let pSpikePoints: POINT2[];
            let pt0: POINT2;
            let dSpikeSize: number = arraysupport.getScaledSize(20, tg.lineThickness, tg.patternScale);
            let limit: number = 0;
            let d: number = 0;
            let bolVertical: number = 0;

            lCount = countsupport.GetFORTLCountDouble(tg, pLinePoints, vblSaveCounter);

            pSpikePoints = new Array<POINT2>(lCount);
            LineUtility.InitializePOINT2Array(pSpikePoints);
            //for(j=0;j<numPts2-1;j++)
            for (j = 0; j < vblSaveCounter - 1; j++) {
                ({ result: bolVertical } = LineUtility.calcTrueSlope(pLinePoints[j], pLinePoints[j + 1]));
                dLengthSegment = LineUtility.calcDistance(pLinePoints[j], pLinePoints[j + 1]);
                limit = Math.trunc(dLengthSegment / dIncrement);
                if (limit < 1) {
                    pSpikePoints[nCounter] = new POINT2(pLinePoints[j]);
                    nCounter++;
                    pSpikePoints[nCounter] = new POINT2(pLinePoints[j + 1]);
                    nCounter++;
                    continue;
                }
                for (k = 0; k < limit; k++) {
                    pSpikePoints[nCounter] = LineUtility.extendLine(pLinePoints[j + 1], pLinePoints[j], -k * dIncrement, 0);
                    nCounter++;
                    d = LineUtility.calcDistance(pLinePoints[j], pSpikePoints[nCounter - 1]);
                    pt0 = LineUtility.ExtendLineDouble(pLinePoints[j + 1], pLinePoints[j], -d - dSpikeSize / 2);

                    //the spikes
                    if (bolVertical !== 0) //segment is not vertical
                    {
                        if (pLinePoints[j].x < pLinePoints[j + 1].x) //extend above the line
                        {
                            pSpikePoints[nCounter] = LineUtility.ExtendDirectedLine(pLinePoints[j], pLinePoints[j + 1], pt0, 2, dSpikeSize);
                        } else //extend below the line
                        {
                            pSpikePoints[nCounter] = LineUtility.ExtendDirectedLine(pLinePoints[j], pLinePoints[j + 1], pt0, 3, dSpikeSize);
                        }
                    } else //segment is vertical
                    {
                        if (pLinePoints[j + 1].y < pLinePoints[j].y) //extend left of the line
                        {
                            pSpikePoints[nCounter] = LineUtility.ExtendDirectedLine(pLinePoints[j], pLinePoints[j + 1], pt0, 0, dSpikeSize);
                        } else //extend right of the line
                        {
                            pSpikePoints[nCounter] = LineUtility.ExtendDirectedLine(pLinePoints[j], pLinePoints[j + 1], pt0, 1, dSpikeSize);
                        }
                    }
                    nCounter++;
                    pSpikePoints[nCounter] = LineUtility.extendLine(pLinePoints[j + 1], pLinePoints[j], -d - dSpikeSize, 0);
                    nCounter++;
                }
                pSpikePoints[nCounter] = new POINT2(pLinePoints[j + 1]);
                nCounter++;
            }

            for (j = 0; j < nCounter; j++) {
                pLinePoints[j] = new POINT2(pSpikePoints[j]);
            }
            for (j = nCounter; j < lCount; j++) {
                pLinePoints[j] = new POINT2(pSpikePoints[nCounter - 1]);
            }

        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(arraysupport._className, "GetRidgePointsDouble",
                    exc);
            } else {
                throw exc;
            }
        }
        return nCounter;
    }

    protected static GetSquallDouble(pLinePoints: POINT2[],
        amplitude: number,
        quantity: number,
        length: number,
        numPoints: number): number {
        let counter: number = 0;
        try {
            let j: number = 0;
            let k: number = 0;
            let StartSegPt: POINT2;
            let EndSegPt: POINT2;
            let savePoint1: POINT2 = new POINT2(pLinePoints[0]);
            let savePoint2: POINT2 = new POINT2(pLinePoints[numPoints - 1]);
            let signVal: number = -1;
            let segQty: number = 0;
            let totalQty: number = countsupport.GetSquallQty(pLinePoints, quantity, length, numPoints);
            let pSquallPts: POINT2[] = new Array<POINT2>(totalQty);
            let pSquallSegPts: POINT2[];

            LineUtility.InitializePOINT2Array(pSquallPts);
            if (totalQty === 0) {
                return 0;
            }

            for (j = 0; j < numPoints - 1; j++) {
                StartSegPt = new POINT2(pLinePoints[j]);
                EndSegPt = new POINT2(pLinePoints[j + 1]);
                segQty = countsupport.GetSquallSegQty(StartSegPt, EndSegPt, quantity, length);
                if (segQty > 0) {
                    pSquallSegPts = new Array<POINT2>(segQty);
                    LineUtility.InitializePOINT2Array(pSquallSegPts);
                } else {
                    pSquallPts[counter].x = StartSegPt.x;
                    pSquallPts[counter++].y = StartSegPt.y;
                    pSquallPts[counter].x = EndSegPt.x;
                    pSquallPts[counter++].y = EndSegPt.y;
                    continue;
                }
                signVal = -1;
                LineUtility.GetSquallSegment(StartSegPt, EndSegPt, pSquallSegPts, signVal, amplitude, quantity, length);
                for (k = 0; k < segQty; k++) {
                    pSquallPts[counter].x = pSquallSegPts[k].x;
                    pSquallPts[counter].y = pSquallSegPts[k].y;
                    if (k === 0) {
                        pSquallPts[counter] = new POINT2(pLinePoints[j]);
                    }
                    if (k === segQty - 1) {
                        pSquallPts[counter] = new POINT2(pLinePoints[j + 1]);
                    }
                    pSquallPts[counter].style = 0;
                    counter++;
                }
            }
            //load the squall points into the linepoints array
            for (j = 0; j < counter; j++) {
                if (j < totalQty) {
                    pLinePoints[j].x = pSquallPts[j].x;
                    pLinePoints[j].y = pSquallPts[j].y;
                    if (j === 0) {
                        pLinePoints[j] = new POINT2(savePoint1);
                    }
                    if (j === counter - 1) {
                        pLinePoints[j] = new POINT2(savePoint2);
                    }
                    pLinePoints[j].style = pSquallPts[j].style;
                }
            }
            if (counter === 0) {
                for (j = 0; j < pLinePoints.length; j++) {
                    if (j === 0) {
                        pLinePoints[j] = new POINT2(savePoint1);
                    } else {
                        pLinePoints[j] = new POINT2(savePoint2);
                    }
                }
                counter = pLinePoints.length;
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(arraysupport._className, "GetSquallDouble",
                    exc);
            } else {
                throw exc;
            }
        }
        return counter;
    }

    protected static GetSevereSquall(pLinePoints: POINT2[],
        length: number,
        numPoints: number): number {
        let l: number = 0;
        try {
            let quantity: number = 5;
            let j: number = 0;
            let k: number = 0;
            let totalQty: number = countsupport.GetSquallQty(pLinePoints, quantity, length, numPoints) + 2 * numPoints;
            let squallPts: POINT2[] = new Array<POINT2>(totalQty);
            let pt0: POINT2 = new POINT2();
            let pt1: POINT2 = new POINT2();
            let pt2: POINT2 = new POINT2();
            let
                pt3: POINT2 = new POINT2();
            let pt4: POINT2 = new POINT2();
            let pt5: POINT2 = new POINT2();
            let pt6: POINT2 = new POINT2();
            let
                pt7: POINT2 = new POINT2();
            let pt8: POINT2 = new POINT2();
            let segQty: number = 0;
            let dist: number = 0;

            LineUtility.InitializePOINT2Array(squallPts);
            //each segment looks like this: --- V
            for (j = 0; j < numPoints - 1; j++) {
                dist = LineUtility.calcDistance(pLinePoints[j], pLinePoints[j + 1]);
                segQty = Math.trunc(dist / length);
                for (k = 0; k < segQty; k++) {
                    pt0 = LineUtility.extendAlongLine2(pLinePoints[j], pLinePoints[j + 1], k * length);
                    pt1 = LineUtility.extendAlongLine(pLinePoints[j], pLinePoints[j + 1], k * length + length / 6 * 4);
                    pt1.style = 5;
                    squallPts[l++] = new POINT2(pt0);
                    squallPts[l++] = new POINT2(pt1);
                    pt5 = LineUtility.extendAlongLine(pLinePoints[j], pLinePoints[j + 1], k * length + length / 6 * 5);
                    pt6 = LineUtility.extendAlongLine(pLinePoints[j], pLinePoints[j + 1], k * length + length);
                    pt2 = LineUtility.ExtendDirectedLine(pt0, pt1, pt1, 2, length / 6, 0);   //extend above line
                    pt3 = LineUtility.ExtendDirectedLine(pt0, pt5, pt5, 3, length / 6, 0);   //extend below line
                    pt4 = LineUtility.ExtendDirectedLine(pt0, pt6, pt6, 2, length / 6, 5);   //extend above line
                    pt4.style = 5;
                    squallPts[l++] = new POINT2(pt2);
                    squallPts[l++] = new POINT2(pt3);
                    squallPts[l++] = new POINT2(pt4);
                }
                //segment remainder
                squallPts[l++] = new POINT2(pLinePoints[j + 1]);
                pt0 = LineUtility.extendAlongLine(pLinePoints[j + 1], pLinePoints[j], dist - segQty * length);
                pt0.style = 5;
                squallPts[l++] = new POINT2(pt0);
            }
            if (l > pLinePoints.length) {
                l = pLinePoints.length;
            }

            for (j = 0; j < l; j++) {
                if (j < totalQty) {
                    pLinePoints[j] = new POINT2(squallPts[j]);
                } else {
                    break;
                }
            }

        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(arraysupport._className, "GetSevereSquall",
                    exc);
            } else {
                throw exc;
            }
        }
        return l;
    }

    private static GetConvergencePointsDouble(pLinePoints: POINT2[], length: number, vblCounter: number): number {
        let counter: number = vblCounter;
        try {
            let j: number = 0;
            let k: number = 0;
            let d: number = 0;
            let pt0: POINT2 = new POINT2();
            let pt1: POINT2 = new POINT2();
            let tempPts: POINT2[] = new Array<POINT2>(vblCounter);
            let tempPt: POINT2 = new POINT2();
            let numJags: number = 0;
            //save the original points
            for (j = 0; j < vblCounter; j++) {
                tempPts[j] = new POINT2(pLinePoints[j]);
            }

            //result points begin with the original points,
            //set the last one's linestyle to 5;
            pLinePoints[vblCounter - 1].style = 5;
            for (j = 0; j < vblCounter - 1; j++) {

                pt0 = new POINT2(tempPts[j]);
                pt1 = new POINT2(tempPts[j + 1]);
                d = LineUtility.calcDistance(pt0, pt1);
                numJags = Math.trunc(d / length);
                //we don't want too small a remainder
                if (d - numJags * length < 5) {
                    numJags -= 1;
                }

                //each section has two spikes: one points above the line
                //the other spike points below the line
                for (k = 0; k < numJags; k++) {
                    //the first spike
                    tempPt = LineUtility.extendAlongLine(pt0, pt1, k * length + length / 2, 0);
                    pLinePoints[counter++] = new POINT2(tempPt);
                    tempPt = LineUtility.extendAlongLine(tempPt, pt1, length / 2);
                    tempPt = LineUtility.ExtendDirectedLine(pt0, tempPt, tempPt, 2, length / 2, 5);
                    pLinePoints[counter++] = new POINT2(tempPt);
                    //the 2nd spike
                    tempPt = LineUtility.extendAlongLine(pt0, pt1, (k + 1) * length, 0);
                    pLinePoints[counter++] = new POINT2(tempPt);
                    tempPt = LineUtility.extendAlongLine(tempPt, pt1, length / 2);
                    tempPt = LineUtility.ExtendDirectedLine(pt0, tempPt, tempPt, 3, length / 2, 5);
                    pLinePoints[counter++] = new POINT2(tempPt);
                }
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(arraysupport._className, "GetConvergencePointsDouble",
                    exc);
            } else {
                throw exc;
            }
        }
        return counter;
    }

    // Dashes are 2/3*length and spaces are 1/3*length.
    private static GetITDPointsDouble(pLinePoints: POINT2[], length: number, vblCounter: number): number {
        let counter: number = 0;
        try {
            let j: number = 0;
            let k: number = 0;
            let d: number = 0;
            let pt0: POINT2 = new POINT2();
            let pt1: POINT2 = new POINT2();
            let tempPts: POINT2[] = new Array<POINT2>(vblCounter);
            let tempPt: POINT2 = new POINT2();
            let numJags: number = 0;
            let lineStyle: number = 19;
            //save the original points
            for (j = 0; j < vblCounter; j++) {
                tempPts[j] = new POINT2(pLinePoints[j]);
            }

            //result points begin with the original points,
            //set the last one's linestyle to 5;
            //pLinePoints[vblCounter-1].style=5;
            for (j = 0; j < vblCounter - 1; j++) {
                pt0 = new POINT2(tempPts[j]);
                pt1 = new POINT2(tempPts[j + 1]);
                d = LineUtility.calcDistance(pt0, pt1);
                numJags = Math.trunc(d / length);
                //we don't want too small a remainder
                if (d - numJags * length / 3 * 2 < length / 3) {
                    numJags -= 1;
                }
                if (numJags === 0) {
                    pt0.style = 19;
                    pLinePoints[counter++] = new POINT2(pt0);
                    pt1.style = 5;
                    pLinePoints[counter++] = new POINT2(pt1);
                }

                for (k = 0; k < numJags; k++) {
                    tempPt = LineUtility.extendAlongLine(pt0, pt1, k * length + length / 3, lineStyle);
                    pLinePoints[counter++] = new POINT2(tempPt);

                    if (k < numJags - 1) {
                        tempPt = LineUtility.extendAlongLine(tempPt, pt1, length * 2 / 3, 5);
                    } else {
                        tempPt = new POINT2(tempPts[j + 1]);
                        tempPt.style = 5;
                    }
                    pLinePoints[counter++] = new POINT2(tempPt);
                    if (lineStyle === 19) {
                        lineStyle = 25;
                    } else {
                        lineStyle = 19;
                    }
                }
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(arraysupport._className, "GetITDPointsDouble",
                    exc);
            } else {
                throw exc;
            }
        }
        return counter;
    }

    private static GetXPoints(pOriginalLinePoints: POINT2[], XPoints: POINT2[], segmentLength: number, vblCounter: number): number {
        let xCounter: number = 0;
        try {
            let j: number = 0;
            let k: number = 0;
            let d: number = 0;
            let pt0: POINT2;
            let pt1: POINT2;
            let pt2: POINT2;
            let pt3: POINT2 = new POINT2();
            let pt4: POINT2 = new POINT2();
            let pt5: POINT2 = new POINT2();
            let pt6: POINT2 = new POINT2();
            let numThisSegment: number = 0;
            let distInterval: number = 0;
            let xSize: number = segmentLength / 6;
            for (j = 0; j < vblCounter - 1; j++) {
                d = LineUtility.calcDistance(pOriginalLinePoints[j], pOriginalLinePoints[j + 1]);
                numThisSegment = Math.trunc((d - segmentLength) / segmentLength);

                //added 4-19-12
                distInterval = d / numThisSegment;
                for (k = 0; k < numThisSegment; k++) {
                    //pt0=LineUtility.extendAlongLine(pOriginalLinePoints[j],pOriginalLinePoints[j+1], 10+20*k);
                    pt0 = LineUtility.extendAlongLine2(pOriginalLinePoints[j], pOriginalLinePoints[j + 1], distInterval / 2 + distInterval * k);
                    pt1 = LineUtility.extendAlongLine2(pt0, pOriginalLinePoints[j + 1], xSize);
                    pt2 = LineUtility.extendAlongLine2(pt0, pOriginalLinePoints[j + 1], -xSize);

                    pt3 = LineUtility.ExtendDirectedLine(pOriginalLinePoints[j], pt1, pt1, 2, xSize);
                    pt4 = LineUtility.ExtendDirectedLine(pOriginalLinePoints[j], pt1, pt1, 3, xSize);
                    pt4.style = 5;
                    pt5 = LineUtility.ExtendDirectedLine(pOriginalLinePoints[j], pt2, pt2, 2, xSize);
                    pt6 = LineUtility.ExtendDirectedLine(pOriginalLinePoints[j], pt2, pt2, 3, xSize);
                    pt6.style = 5;
                    XPoints[xCounter++] = new POINT2(pt3);
                    XPoints[xCounter++] = new POINT2(pt6);
                    XPoints[xCounter++] = new POINT2(pt5);
                    XPoints[xCounter++] = new POINT2(pt4);
                }
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(arraysupport._className, "GetXPointsDouble",
                    exc);
            } else {
                throw exc;
            }
        }
        return xCounter;
    }

    /**
     * returns a 37 point ellipse
     *
     * @param ptCenter
     * @param ptWidth
     * @param ptHeight
     * @return
     */
    private static getEllipsePoints(ptCenter: POINT2, ptWidth: POINT2, ptHeight: POINT2): POINT2[] | null {
        let pEllipsePoints: POINT2[] | null = null;
        try {
            pEllipsePoints = new Array<POINT2>(37);
            let l: number = 0;
            let dFactor: number = 0;
            let a: number = LineUtility.calcDistance(ptCenter, ptWidth);
            let b: number = LineUtility.calcDistance(ptCenter, ptHeight);
            LineUtility.InitializePOINT2Array(pEllipsePoints);
            for (l = 1; l < 37; l++) {
                dFactor = (10.0 * l) * Math.PI / 180.0;
                pEllipsePoints[l - 1].x = ptCenter.x + Math.trunc(a * Math.cos(dFactor));
                pEllipsePoints[l - 1].y = ptCenter.y + Math.trunc(b * Math.sin(dFactor));
                pEllipsePoints[l - 1].style = 0;
            }
            pEllipsePoints[36] = new POINT2(pEllipsePoints[0]);
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(arraysupport._className, "GetEllipsePoints",
                    exc);
            } else {
                throw exc;
            }
        }
        return pEllipsePoints;
    }

    /**
     * Calculate an ellipse and rotate about it's center by azimuth in degrees
     *
     * @param ptCenter
     * @param ptWidth
     * @param ptHeight
     * @param azimuth
     * @return
     */
    private static getRotatedEllipsePoints(ptCenter: POINT2, ptWidth: POINT2, ptHeight: POINT2, azimuth: number, lineType: number): POINT2[] | null {
        let pResultPoints: POINT2[] | null = null;
        try {
            let pEllipsePoints: POINT2[] = new Array<POINT2>(36);
            let l: number = 0;
            let j: number = 0;
            let dFactor: number = 0;
            let a: number = LineUtility.calcDistance(ptCenter, ptWidth);
            let b: number = LineUtility.calcDistance(ptCenter, ptHeight);
            LineUtility.InitializePOINT2Array(pEllipsePoints);
            for (l = 1; l < 37; l++) {
                dFactor = (10.0 * l) * Math.PI / 180.0;
                //pEllipsePoints[l - 1].x = ptCenter.x + (int) (a * Math.cos(dFactor));
                //pEllipsePoints[l - 1].y = ptCenter.y + (int) (b * Math.sin(dFactor));
                pEllipsePoints[l - 1].x = ptCenter.x + a * Math.cos(dFactor);
                pEllipsePoints[l - 1].y = ptCenter.y + b * Math.sin(dFactor);
                pEllipsePoints[l - 1].style = 0;
            }
            LineUtility.RotateGeometryDouble(pEllipsePoints, 36, azimuth - 90);
            pResultPoints = new Array<POINT2>(37);
            for (j = 0; j < 36; j++) {
                pResultPoints[j] = pEllipsePoints[j];
            }
            pResultPoints[36] = pEllipsePoints[0];
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(arraysupport._className, "GetRotatedEllipsePoints",
                    exc);
            } else {
                throw exc;
            }
        }
        return pResultPoints;
    }

    private static GetLVOPoints(pOriginalLinePoints: POINT2[], pLinePoints: POINT2[], ovalWidth: number, segmentLength: number, vblCounter: number): number {
        let lEllipseCounter: number = 0;
        try {
            let dAngle: number = 0;
            let d: number = 0;
            let ovalLength: number = ovalWidth * 2;
            let dFactor: number = 0;
            let lHowManyThisSegment: number = 0;
            let j: number = 0;
            let k: number = 0;
            let l: number = 0;
            let t: number = 0;
            let ptCenter: POINT2 = new POINT2();
            let pEllipsePoints2: POINT2[] = new Array<POINT2>(37);

            let distInterval: number = 0;
            //end declarations
            for (j = 0; j < vblCounter - 1; j++) {
                LineUtility.InitializePOINT2Array(pEllipsePoints2);
                d = LineUtility.calcDistance(pOriginalLinePoints[j], pOriginalLinePoints[j + 1]);
                lHowManyThisSegment = Math.trunc((d - segmentLength) / segmentLength);

                distInterval = d / lHowManyThisSegment;

                dAngle = LineUtility.calcSegmentAngle(pOriginalLinePoints[j], pOriginalLinePoints[j + 1]);
                dAngle = dAngle + Math.PI / 2;
                for (k = 0; k < lHowManyThisSegment; k++) {
                    ptCenter = LineUtility.extendAlongLine2(pOriginalLinePoints[j], pOriginalLinePoints[j + 1], k * distInterval);
                    for (l = 1; l < 37; l++) {
                        //dFactor = (10.0 * l) * Math.PI / 180.0;
                        dFactor = (20.0 * l) * Math.PI / 180.0;
                        pEllipsePoints2[l - 1].x = ptCenter.x + Math.trunc(ovalWidth * Math.cos(dFactor));
                        pEllipsePoints2[l - 1].y = ptCenter.y + Math.trunc(ovalLength * Math.sin(dFactor));
                        pEllipsePoints2[l - 1].style = 0;
                    }
                    LineUtility.RotateGeometryDouble(pEllipsePoints2, 36, Math.trunc(dAngle * 180 / Math.PI));
                    pEllipsePoints2[36] = new POINT2(pEllipsePoints2[35]);
                    pEllipsePoints2[36].style = 5;
                    for (l = 0; l < 37; l++) {
                        pLinePoints[lEllipseCounter] = new POINT2(pEllipsePoints2[l]);
                        lEllipseCounter++;
                    }
                }//end k loop
                //extra ellipse on the final segment at the end of the line
                if (j === vblCounter - 2) {
                    ptCenter = pOriginalLinePoints[j + 1];

                    for (l = 1; l < 37; l++) {
                        dFactor = (20.0 * l) * Math.PI / 180.0;
                        pEllipsePoints2[l - 1].x = ptCenter.x + Math.trunc(ovalWidth * Math.cos(dFactor));
                        pEllipsePoints2[l - 1].y = ptCenter.y + Math.trunc(ovalLength * Math.sin(dFactor));
                        pEllipsePoints2[l - 1].style = 0;
                    }
                    LineUtility.RotateGeometryDouble(pEllipsePoints2, 36, Math.trunc(dAngle * 180 / Math.PI));
                    pEllipsePoints2[36] = new POINT2(pEllipsePoints2[35]);
                    pEllipsePoints2[36].style = 5;
                    for (l = 0; l < 37; l++) {
                        pLinePoints[lEllipseCounter] = new POINT2(pEllipsePoints2[l]);
                        lEllipseCounter++;
                    }
                }
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(arraysupport._className, "GetLVOPointsDouble",
                    exc);
            } else {
                throw exc;
            }
        }
        return lEllipseCounter;
    }

    private static GetIcingPointsDouble(pLinePoints: POINT2[], length: number, vblCounter: number): number {
        let counter: number = 0;
        try {
            let j: number = 0;
            let origPoints: POINT2[] = new Array<POINT2>(vblCounter);
            let nDirection: number = -1;
            let k: number = 0;
            let numSegments: number = 0;
            let pt0: POINT2 = new POINT2();
            let pt1: POINT2 = new POINT2();
            let midPt: POINT2 = new POINT2();
            let pt2: POINT2 = new POINT2();
            //save the original points
            for (j = 0; j < vblCounter; j++) {
                origPoints[j] = new POINT2(pLinePoints[j]);
            }
            let distInterval: number = 0;
            for (j = 0; j < vblCounter - 1; j++) {
                //how many segments for this line segment?
                numSegments = Math.trunc(LineUtility.calcDistance(origPoints[j], origPoints[j + 1]));
                numSegments /= length;
                //4-19-12
                distInterval = LineUtility.calcDistance(origPoints[j], origPoints[j + 1]) / numSegments;
                //get the direction and the quadrant
                nDirection = arraysupport.GetInsideOutsideDouble2(origPoints[j], origPoints[j + 1], origPoints, vblCounter, j, TacticalLines.ICING);
                for (k = 0; k < numSegments; k++) {
                    //get the parallel segment
                    if (k === 0) {
                        pt0 = new POINT2(origPoints[j]);
                    } else {
                        pt0 = LineUtility.extendAlongLine(origPoints[j], origPoints[j + 1], k * distInterval, 0);
                    }

                    pt1 = LineUtility.extendAlongLine(origPoints[j], origPoints[j + 1], k * distInterval + length * 2 / 3, 5);
                    midPt = LineUtility.extendAlongLine(origPoints[j], origPoints[j + 1], k * distInterval + length / 3, 0);
                    //get the perpendicular segment
                    pt2 = LineUtility.ExtendDirectedLine(origPoints[j], origPoints[j + 1], midPt, nDirection, length / 3, 5);
                    pLinePoints[counter] = new POINT2(pt0);
                    pLinePoints[counter + 1] = new POINT2(pt1);
                    pLinePoints[counter + 2] = new POINT2(midPt);
                    pLinePoints[counter + 3] = new POINT2(pt2);
                    counter += 4;
                }
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(arraysupport._className, "GetIcingPointsDouble",
                    exc);
            } else {
                throw exc;
            }
        }
        return counter;
    }

    protected static GetAnchorageDouble(vbPoints2: POINT2[], floatDiameter: number, numPts: number): number {
        let lFlotCounter: number = 0;
        try {
            let j: number = 0;
            let k: number = 0;
            let l: number = 0;
            let x1: number = 0;
            let y1: number = 0;
            let numSegPts: number = -1;
            let lFlotCount: number = 0;
            let lNumSegs: number = 0;
            let dDistance: number = 0;
            let vbPoints: number[];
            let points: number[];
            let points2: number[];
            let pt: POINT2 = new POINT2();
            let pt1: POINT2 = new POINT2();
            let pt2: POINT2 = new POINT2();

            lFlotCount = flot.GetAnchorageCountDouble(vbPoints2, floatDiameter, numPts);
            vbPoints = new Array<number>(2 * numPts);

            for (j = 0; j < numPts; j++) {
                vbPoints[k] = vbPoints2[j].x as number;
                k++;
                vbPoints[k] = vbPoints2[j].y as number;
                k++;
            }
            k = 0;

            let bFlipVal: number = 0;
            let lDirectionVal: number = 0;
            let lLastDirectionVal: number = 0;
            for (l = 0; l < numPts - 1; l++) {
                pt1.x = vbPoints[2 * l];
                pt1.y = vbPoints[2 * l + 1];
                pt2.x = vbPoints[2 * l + 2];
                pt2.y = vbPoints[2 * l + 3];
                //for all segments after the first segment we shorten
                //the line by floatDiameter so the flots will not abut
                if (l > 0) {
                    pt1 = LineUtility.extendAlongLine(pt1, pt2, floatDiameter);
                }

                dDistance = LineUtility.calcDistance(pt1, pt2);

                lNumSegs = Math.trunc(dDistance / floatDiameter);

                if (lNumSegs > 0) {
                    points2 = new Array<number>(lNumSegs * 32);
                    const flotResult = flot.GetAnchorageFlotSegment(vbPoints, pt1.x as number, pt1.y as number, pt2.x as number, pt2.y as number, l, floatDiameter, points2, bFlipVal, lDirectionVal, lLastDirectionVal);
                    numSegPts = flotResult.count;
                    bFlipVal = flotResult.bFlip;
                    lDirectionVal = flotResult.lDirection;
                    lLastDirectionVal = flotResult.lLastDirection;
                    points = new Array<number>(numSegPts);

                    for (j = 0; j < numSegPts; j++) {
                        points[j] = points2[j];
                    }

                    for (j = 0; j < numSegPts / 3; j++) //only using half the flots
                    {
                        x1 = points[k];
                        y1 = points[k + 1];
                        k += 3;
                        if (j % 10 === 0) {
                            pt.x = x1;
                            pt.y = y1;
                            pt.style = 5;
                        } else {
                            if ((j + 1) % 10 === 0) {
                                if (lFlotCounter < lFlotCount) {
                                    vbPoints2[lFlotCounter].x = x1;
                                    vbPoints2[lFlotCounter++].y = y1;
                                    vbPoints2[lFlotCounter++] = new POINT2(pt);
                                    continue;
                                } else {
                                    break;
                                }
                            }
                        }

                        if (lFlotCounter < lFlotCount) {
                            vbPoints2[lFlotCounter].x = x1;
                            vbPoints2[lFlotCounter].y = y1;
                            lFlotCounter++;
                        } else {
                            break;
                        }
                    }
                    k = 0;
                } else {
                    if (lFlotCounter < lFlotCount) {
                        vbPoints2[lFlotCounter].x = vbPoints[2 * l];
                        vbPoints2[lFlotCounter].y = vbPoints[2 * l + 1];
                        lFlotCounter++;
                    }
                }
            }
            for (j = lFlotCounter - 1; j < lFlotCount; j++) {
                vbPoints2[j].style = 5;
            }

        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(arraysupport._className, "GetAnchorageDouble",
                    exc);
            } else {
                throw exc;
            }
        }
        return lFlotCounter;
    }

    private static GetPipePoints(pLinePoints: POINT2[],
        length: number,
        vblCounter: number): number {
        let counter: number = 0;
        try {
            let pOriginalPoints: POINT2[] = new Array<POINT2>(vblCounter);
            let pt0: POINT2 = new POINT2();
            let pt1: POINT2 = new POINT2();
            let pt2: POINT2 = new POINT2();
            let xPoints: POINT2[] = new Array<POINT2>(pLinePoints.length);
            let xCounter: number = 0;
            let j: number = 0;
            let k: number = 0;
            for (j = 0; j < vblCounter; j++) {
                pOriginalPoints[j] = new POINT2(pLinePoints[j]);
            }
            let numSegs: number = 0;
            let d: number = 0;

            LineUtility.InitializePOINT2Array(xPoints);
            for (j = 0; j < vblCounter - 1; j++) {
                d = LineUtility.calcDistance(pOriginalPoints[j], pOriginalPoints[j + 1]);
                numSegs = Math.trunc(d / length);
                for (k = 0; k < numSegs; k++) {
                    pt0 = LineUtility.extendAlongLine2(pOriginalPoints[j], pOriginalPoints[j + 1], length * k);
                    pt0.style = 0;
                    pt1 = LineUtility.extendAlongLine2(pOriginalPoints[j], pOriginalPoints[j + 1], length * k + length / 2);
                    pt1.style = 5;
                    pt2 = LineUtility.extendAlongLine2(pOriginalPoints[j], pOriginalPoints[j + 1], length * k + length / 2);
                    pt2.style = 20;	//for filled circle
                    pLinePoints[counter++] = new POINT2(pt0);
                    pLinePoints[counter++] = new POINT2(pt1);
                    xPoints[xCounter++] = new POINT2(pt2);
                }
                if (numSegs === 0) {
                    pLinePoints[counter] = new POINT2(pOriginalPoints[j]);
                    pLinePoints[counter++].style = 0;
                    pLinePoints[counter] = new POINT2(pOriginalPoints[j + 1]);
                    pLinePoints[counter++].style = 5;
                } else {
                    pLinePoints[counter] = new POINT2(pLinePoints[counter - 1]);
                    pLinePoints[counter++].style = 0;
                    pLinePoints[counter] = new POINT2(pOriginalPoints[j + 1]);
                    pLinePoints[counter++].style = 5;
                }
            }
            //load the circle points
            for (k = 0; k < xCounter; k++) {
                pLinePoints[counter++] = new POINT2(xPoints[k]);
            }
            //add one more circle
            pLinePoints[counter++] = new POINT2(pLinePoints[counter]);
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(arraysupport._className, "GetPipePoints",
                    exc);
            } else {
                throw exc;
            }
        }
        return counter;
    }

    private static GetReefPoints(pLinePoints: POINT2[],
        length: number,
        vblCounter: number): number {
        let counter: number = 0;
        try {
            let pOriginalPoints: POINT2[] = new Array<POINT2>(vblCounter);
            let pt0: POINT2 = new POINT2();
            let pt1: POINT2 = new POINT2();
            let pt2: POINT2 = new POINT2();
            let pt3: POINT2 = new POINT2();
            let pt4: POINT2 = new POINT2();
            //POINT2 pt5=new POINT2();
            for (let j: number = 0; j < vblCounter; j++) {
                pOriginalPoints[j] = new POINT2(pLinePoints[j]);
            }

            let numSegs: number = 0;
            let direction: number = 0;
            let d: number = 0;
            for (let j: number = 0; j < vblCounter - 1; j++) {
                if (pOriginalPoints[j].x < pOriginalPoints[j + 1].x) {
                    direction = 2;
                } else {
                    direction = 3;
                }

                d = LineUtility.calcDistance(pOriginalPoints[j], pOriginalPoints[j + 1]);
                numSegs = Math.trunc(d / length);
                for (let k: number = 0; k < numSegs; k++) {
                    pt0 = LineUtility.extendAlongLine2(pOriginalPoints[j], pOriginalPoints[j + 1], length * k);

                    pt1 = LineUtility.extendAlongLine2(pt0, pOriginalPoints[j + 1], length * .35);
                    pt1 = LineUtility.ExtendDirectedLine(pOriginalPoints[j], pOriginalPoints[j + 1], pt1, direction, length);//was 2

                    pt2 = LineUtility.extendAlongLine2(pt0, pOriginalPoints[j + 1], length * .4);
                    pt2 = LineUtility.ExtendDirectedLine(pOriginalPoints[j], pOriginalPoints[j + 1], pt2, direction, length * .6);//was 2

                    pt3 = LineUtility.extendAlongLine2(pt0, pOriginalPoints[j + 1], length * .75);
                    pt3 = LineUtility.ExtendDirectedLine(pOriginalPoints[j], pOriginalPoints[j + 1], pt3, direction, length * 1.35);//was 2

                    pt4 = LineUtility.extendAlongLine2(pOriginalPoints[j], pOriginalPoints[j + 1], length * (k + 1));
                    pLinePoints[counter++] = new POINT2(pt0);
                    pLinePoints[counter++] = new POINT2(pt1);
                    pLinePoints[counter++] = new POINT2(pt2);
                    pLinePoints[counter++] = new POINT2(pt3);
                    pLinePoints[counter++] = new POINT2(pt4);
                }
                if (numSegs === 0) {
                    pLinePoints[counter++] = new POINT2(pOriginalPoints[j]);
                    pLinePoints[counter++] = new POINT2(pOriginalPoints[j + 1]);
                }
            }
            pLinePoints[counter++] = new POINT2(pOriginalPoints[vblCounter - 1]);
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(arraysupport._className, "GetReefPoints",
                    exc);
            } else {
                throw exc;
            }
        }
        return counter;
    }

    private static GetRestrictedAreaPoints(pLinePoints: POINT2[],
        length: number,
        vblCounter: number): number {
        let counter: number = 0;
        try {
            let pOriginalPoints: POINT2[] = new Array<POINT2>(vblCounter);
            let pt0: POINT2 = new POINT2();
            let pt1: POINT2 = new POINT2();
            let pt2: POINT2 = new POINT2();
            let pt3: POINT2 = new POINT2();
            for (let j: number = 0; j < vblCounter; j++) {
                pOriginalPoints[j] = new POINT2(pLinePoints[j]);
            }
            let direction: number = 0;
            let numSegs: number = 0;
            let d: number = 0;
            for (let j: number = 0; j < vblCounter - 1; j++) {
                d = LineUtility.calcDistance(pOriginalPoints[j], pOriginalPoints[j + 1]);
                numSegs = Math.trunc(d / length);
                if (pOriginalPoints[j].x < pOriginalPoints[j + 1].x) {
                    direction = 3;
                } else {
                    direction = 2;
                }
                for (let k: number = 0; k < numSegs; k++) {
                    pt0 = LineUtility.extendAlongLine2(pOriginalPoints[j], pOriginalPoints[j + 1], length * k);
                    pt0.style = 0;
                    pt1 = LineUtility.extendAlongLine2(pOriginalPoints[j], pOriginalPoints[j + 1], length * k + length * 2 / 3);
                    pt1.style = 5;
                    pt2 = LineUtility.midPoint(pt0, pt1, 0);
                    //pt3 = LineUtility.ExtendDirectedLine(pOriginalPoints[j], pOriginalPoints[j + 1], pt2, 3, 10);
                    pt3 = LineUtility.ExtendDirectedLine(pOriginalPoints[j], pOriginalPoints[j + 1], pt2, direction, length * 2 / 3);
                    pt3.style = 5;
                    pLinePoints[counter++] = new POINT2(pt2);
                    pLinePoints[counter++] = new POINT2(pt3);
                    pLinePoints[counter++] = new POINT2(pt0);
                    pLinePoints[counter++] = new POINT2(pt1);
                }
                if (numSegs === 0) {
                    pLinePoints[counter++] = new POINT2(pOriginalPoints[j]);
                    pLinePoints[counter++] = new POINT2(pOriginalPoints[j + 1]);
                }
            }
            pLinePoints[counter - 1].style = 0;
            pLinePoints[counter++] = new POINT2(pOriginalPoints[vblCounter - 1]);
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(arraysupport._className, "GetRestrictedAreaPoints",
                    exc);
            } else {
                throw exc;
            }
        }
        return counter;
    }

    //there should be two linetypes depending on scale
    private static getOverheadWire(tg: TacticalGraphic, pLinePoints: POINT2[], vblCounter: number): number {
        let counter: number = 0;
        try {
            let j: number = 0;
            let pt: POINT2;
            let pt2: POINT2;
            let pts: Array<POINT2> = new Array();
            for (j = 0; j < vblCounter; j++) {
                pt = new POINT2(pLinePoints[j]);
                //tower
                pt2 = new POINT2(pt);
                pt2.y -= arraysupport.getScaledSize(5, tg.lineThickness, tg.patternScale);
                pts.push(pt2);
                pt2 = new POINT2(pt);
                pt2.x -= arraysupport.getScaledSize(5, tg.lineThickness, tg.patternScale);
                pts.push(pt2);
                pt2 = new POINT2(pt);
                pt2.y -= arraysupport.getScaledSize(20, tg.lineThickness, tg.patternScale);
                pts.push(pt2);
                pt2 = new POINT2(pt);
                pt2.x += arraysupport.getScaledSize(5, tg.lineThickness, tg.patternScale);
                pts.push(pt2);
                pt2 = new POINT2(pt);
                pt2.y -= arraysupport.getScaledSize(5, tg.lineThickness, tg.patternScale);
                pt2.style = 5;
                pts.push(pt2);
                //low cross piece
                pt2 = new POINT2(pt);
                pt2.x -= arraysupport.getScaledSize(2, tg.lineThickness, tg.patternScale);
                pt2.y -= arraysupport.getScaledSize(10, tg.lineThickness, tg.patternScale);
                pts.push(pt2);
                pt2 = new POINT2(pt);
                pt2.x += arraysupport.getScaledSize(2, tg.lineThickness, tg.patternScale);
                pt2.y -= arraysupport.getScaledSize(10, tg.lineThickness, tg.patternScale);
                pt2.style = 5;
                pts.push(pt2);
                //high cross piece
                pt2 = new POINT2(pt);
                pt2.x -= arraysupport.getScaledSize(7, tg.lineThickness, tg.patternScale);
                pt2.y -= arraysupport.getScaledSize(17, tg.lineThickness, tg.patternScale);
                pts.push(pt2);
                pt2 = new POINT2(pt);
                pt2.x -= arraysupport.getScaledSize(5, tg.lineThickness, tg.patternScale);
                pt2.y -= arraysupport.getScaledSize(20, tg.lineThickness, tg.patternScale);
                pts.push(pt2);
                pt2 = new POINT2(pt);
                pt2.x += arraysupport.getScaledSize(5, tg.lineThickness, tg.patternScale);
                pt2.y -= arraysupport.getScaledSize(20, tg.lineThickness, tg.patternScale);
                pts.push(pt2);
                pt2 = new POINT2(pt);
                pt2.x += arraysupport.getScaledSize(7, tg.lineThickness, tg.patternScale);
                pt2.y -= arraysupport.getScaledSize(17, tg.lineThickness, tg.patternScale);
                pt2.style = 5;
                pts.push(pt2);
                //angle piece
                pt2 = new POINT2(pt);
                pt2.y -= arraysupport.getScaledSize(20, tg.lineThickness, tg.patternScale);
                pts.push(pt2);
                pt2 = new POINT2(pt);
                pt2.x += arraysupport.getScaledSize(8, tg.lineThickness, tg.patternScale);
                pt2.y -= arraysupport.getScaledSize(12, tg.lineThickness, tg.patternScale);
                pt2.style = 5;
                pts.push(pt2);
            }
            //connect the towers
            for (j = 0; j < vblCounter - 1; j++) {
                pt = new POINT2(pLinePoints[j]);
                pt2 = new POINT2(pLinePoints[j + 1]);
                if (pt.x < pt2.x) {
                    pt.x += arraysupport.getScaledSize(5, tg.lineThickness, tg.patternScale);
                    pt.y -= arraysupport.getScaledSize(10, tg.lineThickness, tg.patternScale);
                    pt2.x -= arraysupport.getScaledSize(5, tg.lineThickness, tg.patternScale);
                    pt2.y -= arraysupport.getScaledSize(10, tg.lineThickness, tg.patternScale);
                    pt2.style = 5;
                } else {
                    pt.x -= arraysupport.getScaledSize(5, tg.lineThickness, tg.patternScale);
                    pt.y -= arraysupport.getScaledSize(10, tg.lineThickness, tg.patternScale);
                    pt2.x += arraysupport.getScaledSize(5, tg.lineThickness, tg.patternScale);
                    pt2.y -= arraysupport.getScaledSize(10, tg.lineThickness, tg.patternScale);
                    pt2.style = 5;
                }
                pts.push(pt);
                pts.push(pt2);
            }
            for (j = 0; j < pts.length; j++) {
                pLinePoints[j] = pts[j];
                counter++;
            }
            for (j = counter; j < pLinePoints.length; j++) {
                pLinePoints[j] = new POINT2(pLinePoints[counter - 1]);
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(arraysupport._className, "GetOverheadWire",
                    exc);
            } else {
                throw exc;
            }
        }
        return counter;
    }

    //private static int linetype=-1; //use for BLOCK, CONTIAN
    /**
     * Calculates the points for the non-channel symbols. The points will be
     * stored in the original POINT2 array in pixels, pLinePoints. The client
     * points occupy the first vblSaveCounter positions in pLinePoints and will
     * be overwritten by the symbol points.
     *
     * @param pLinePoints - OUT - an array of POINT2
     * @param vblCounter the number of points allocated
     * @param vblSaveCounter the number of client points
     *
     * @return the symbol point count
     */
    private static GetLineArray2Double(tg: TacticalGraphic,
        pLinePoints: POINT2[],
        vblCounter: number,
        vblSaveCounter: number,
        shapes: Array<Shape2>,
        clipBounds: Rectangle2D | null,
        converter: IPointConversion | null): Array<POINT2> | null {
        let points: Array<POINT2> = new Array();
        try {
            let lineType: number = tg.lineType;
            let client: string = CELineArray.getClient();
            if (pLinePoints == null || pLinePoints.length < 2) {
                return null;
            }
            let segments: number[];
            let dMRR: number = 0;
            let n: number = 0;
            let bolVertical: number = 0;
            let dExtendLength: number = 0;
            let dWidth: number = 0;
            let nQuadrant: number = 0;
            let lLinestyle: number = 0;
            let pointCounter: number = 0;
            let offsetXVal: number = 0;
            let offsetYVal: number = 0;
            let b: number = 0;
            let b1: number = 0;
            let dRadius: number = 0;
            let d1: number = 0;
            let d: number = 0;
            let mVal: number = 0;
            let direction: number = 0;
            let nCounter: number = 0;
            let j: number = 0;
            let k: number = 0;
            let middleSegment: number = -1;
            let dMBR: number = LineUtility.MBRDistance(pLinePoints, vblSaveCounter);
            let pt0: POINT2 = new POINT2(pLinePoints[0]);
            let  //calculation points for autoshapes
                pt1: POINT2 = new POINT2(pLinePoints[1]);
            let
                pt2: POINT2 = new POINT2(pLinePoints[1]);
            let
                pt3: POINT2 = new POINT2(pLinePoints[0]);
            let
                pt4: POINT2 = new POINT2(pLinePoints[0]);
            let
                pt5: POINT2 = new POINT2(pLinePoints[0]);
            let
                pt6: POINT2 = new POINT2(pLinePoints[0]);
            let
                pt7: POINT2 = new POINT2(pLinePoints[0]);
            let
                pt8: POINT2 = new POINT2(pLinePoints[0]);
            let
                ptYIntercept: POINT2 = new POINT2(pLinePoints[0]);
            let
                ptYIntercept1: POINT2 = new POINT2(pLinePoints[0]);
            let
                ptCenter: POINT2 = new POINT2(pLinePoints[0]);
            let pArrowPoints: POINT2[] = new Array<POINT2>(3);
            let
                arcPts: POINT2[] = new Array<POINT2>(26);
            let
                circlePoints: POINT2[] = new Array<POINT2>(100);
            let pts: POINT2[];
            let pts2: POINT2[];
            let midpt: POINT2 = new POINT2(pLinePoints[0]);
            let midpt1: POINT2 = new POINT2(pLinePoints[0]);

            let pOriginalLinePoints: POINT2[];
            let pUpperLinePoints: POINT2[];
            let pLowerLinePoints: POINT2[];
            let pUpperLowerLinePoints: POINT2[];

            let calcPoint0: POINT2 = new POINT2();
            let
                calcPoint1: POINT2 = new POINT2();
            let
                calcPoint2: POINT2 = new POINT2();
            let
                calcPoint3: POINT2 = new POINT2();
            let
                calcPoint4: POINT2 = new POINT2();
            let ptTemp: POINT2 = new POINT2(pLinePoints[0]);
            let acCounter: number = 0;
            let acPoints: POINT2[] = new Array<POINT2>(6);
            let lFlotCount: number = 0;
            //end declarations

            //Bearing line and others only have 2 points
            if (vblCounter > 2) {
                pt2 = new POINT2(pLinePoints[2]);
            }
            pt0.style = 0;
            pt1.style = 0;
            pt2.style = 0;

            //set jaggylength in clsDISMSupport before the points get bounded
            let xPoints: Array<POINT2>;
            pOriginalLinePoints = new Array<POINT2>(vblSaveCounter);
            for (j = 0; j < vblSaveCounter; j++) {
                pOriginalLinePoints[j] = new POINT2(pLinePoints[j]);
            }

            let DPIScaleFactor: number = rendererSettings.getDeviceDPI() / 96.0;

            //resize the array and get the line array
            //for the specified non-channel line type
            switch (lineType) {
                case TacticalLines.BBS_AREA: {
                    LineUtility.getExteriorPoints(pLinePoints, vblSaveCounter, lineType, false);
                    acCounter = vblSaveCounter;
                    break;
                }
                
                case TacticalLines.BS_CROSS: {
                    pt0 = new POINT2(pLinePoints[0]);
                    pLinePoints[0] = new POINT2(pt0);
                    pLinePoints[0].x -= 10;
                    pLinePoints[1] = new POINT2(pt0);
                    pLinePoints[1].x += 10;
                    pLinePoints[1].style = 10;
                    pLinePoints[2] = new POINT2(pt0);
                    pLinePoints[2].y += 10;
                    pLinePoints[3] = new POINT2(pt0);
                    pLinePoints[3].y -= 10;
                    acCounter = 4;
                    break;
                }  
                
                case TacticalLines.BS_RECTANGLE: {
                    LineUtility.calcMBRPoints(pLinePoints, pLinePoints.length, pt0, pt2);   //pt0=ul, pt1=lr
                    pt1 = new POINT2(pt0);
                    pt1.x = pt2.x;
                    pt3 = new POINT2(pt0);
                    pt3.y = pt2.y;
                    pLinePoints = new Array<POINT2>(5);
                    pLinePoints[0] = new POINT2(pt0);
                    pLinePoints[1] = new POINT2(pt1);
                    pLinePoints[2] = new POINT2(pt2);
                    pLinePoints[3] = new POINT2(pt3);
                    pLinePoints[4] = new POINT2(pt0);
                    acCounter = 5;
                    break;
                }
                
                case TacticalLines.BBS_RECTANGLE: {
                    //double xmax=pLinePoints[0].x,xmin=pLinePoints[1].x,ymax=pLinePoints[0].y,ymin=pLinePoints[1].y;
                    //double xmax=pLinePoints[2].x,xmin=pLinePoints[0].x,ymax=pLinePoints[2].y,ymin=pLinePoints[0].y;
                    let buffer: number = pLinePoints[0].style;

                    pOriginalLinePoints = new Array<POINT2>(5);
                    pOriginalLinePoints[0] = new POINT2(pLinePoints[0]);
                    pOriginalLinePoints[1] = new POINT2(pLinePoints[1]);
                    pOriginalLinePoints[2] = new POINT2(pLinePoints[2]);
                    pOriginalLinePoints[3] = new POINT2(pLinePoints[3]);
                    pOriginalLinePoints[4] = new POINT2(pLinePoints[0]);

                    //clockwise orientation
                    pt0 = pLinePoints[0];
                    pt0.x -= buffer;
                    pt0.y -= buffer;
                    pt1 = pLinePoints[1];
                    pt1.x += buffer;
                    pt1.y -= buffer;
                    pt2 = pLinePoints[2];
                    pt2.x += buffer;
                    pt2.y += buffer;
                    pt3 = pLinePoints[3];
                    pt3.x -= buffer;
                    pt3.y += buffer;
                    pLinePoints = new Array<POINT2>(5);
                    pLinePoints[0] = new POINT2(pt0);
                    pLinePoints[1] = new POINT2(pt1);
                    pLinePoints[2] = new POINT2(pt2);
                    pLinePoints[3] = new POINT2(pt3);
                    pLinePoints[4] = new POINT2(pt0);
                    vblSaveCounter = 5;
                    acCounter = 5;
                    break;
                }
            
                case TacticalLines.BS_ELLIPSE: {
                    pt0 = pLinePoints[0];//the center of the ellipse
                    pt1 = pLinePoints[1];//the width of the ellipse
                    pt2 = pLinePoints[2];//the height of the ellipse
                    //pLinePoints=getEllipsePoints(pt0,pt1,pt2);
                    let azimuth: number = pLinePoints[3].x;
                    pLinePoints = arraysupport.getRotatedEllipsePoints(pt0, pt1, pt2, azimuth, lineType);
                    acCounter = 37;
                    break;

                }

                case TacticalLines.OVERHEAD_WIRE: {
                    acCounter = arraysupport.getOverheadWire(tg, pLinePoints, vblSaveCounter);
                    break;
                }

                case TacticalLines.BOUNDARY: 
                case TacticalLines.TRIP: {
                    acCounter = pLinePoints.length;
                    break;
                }

                case TacticalLines.REEF: {
                    vblCounter = arraysupport.GetReefPoints(pLinePoints, arraysupport.getScaledSize(40, tg.lineThickness, tg.patternScale), vblSaveCounter);
                    acCounter = vblCounter;
                    break;
                }

                case TacticalLines.RESTRICTED_AREA: {
                    vblCounter = arraysupport.GetRestrictedAreaPoints(pLinePoints, arraysupport.getScaledSize(15, tg.lineThickness, tg.patternScale), vblSaveCounter);
                    acCounter = vblCounter;
                    break;
                }

                case TacticalLines.TRAINING_AREA: {
                    dMBR = LineUtility.MBRDistance(pLinePoints, vblSaveCounter);
                    d = 20 * DPIScaleFactor;
                    if (dMBR < 60 * DPIScaleFactor) {
                        d = dMBR / 4;
                    }
                    if (d < 5 * DPIScaleFactor) {
                        d = 5 * DPIScaleFactor;
                    }
                    for (j = 0; j < vblSaveCounter; j++) {
                        pLinePoints[j].style = 1;
                    }
                    pLinePoints[vblSaveCounter - 1].style = 5;
                    pt0 = LineUtility.CalcCenterPointDouble(pLinePoints, vblSaveCounter - 1);
                    //LineUtility.CalcCircleDouble(pt0, 20, 26, arcPts, 0);
                    LineUtility.CalcCircleDouble(pt0, d, 26, arcPts, 0);

                    for (j = vblSaveCounter; j < vblSaveCounter + 26; j++) {
                        pLinePoints[j] = new POINT2(arcPts[j - vblSaveCounter]);
                    }
                    pLinePoints[j - 1].style = 5;

                    // inside the circle
                    if (dMBR < 50 * DPIScaleFactor) {
                        //d was used as the circle radius
                        d *= 0.6;
                    } else {
                        d = 12 * DPIScaleFactor;
                    }

                    pt1 = new POINT2(pt0);
                    pt1.y -= d;
                    pt1.style = 0;
                    pt2 = new POINT2(pt1);
                    pt2.y += d;
                    pt2.style = 5;
                    pt3 = new POINT2(pt2);
                    pt3.y += d / 4 + tg.lineThickness;
                    pt3.style = 0;
                    pt4 = new POINT2(pt3);
                    pt4.y += d / 4;
                    pLinePoints[j++] = new POINT2(pt1);
                    pLinePoints[j++] = new POINT2(pt2);
                    pLinePoints[j++] = new POINT2(pt3);
                    pt4.style = 5;
                    pLinePoints[j++] = new POINT2(pt4);
                    vblCounter = j;
                    acCounter = vblCounter;
                    break;
                }

                case TacticalLines.PIPE: {
                    vblCounter = arraysupport.GetPipePoints(pLinePoints, arraysupport.getScaledSize(20, tg.lineThickness, tg.patternScale), vblSaveCounter);
                    acCounter = vblCounter;
                    break;
                }

                case TacticalLines.ANCHORAGE_AREA: {
                    //get the direction and quadrant of the first segment
                    n = arraysupport.GetInsideOutsideDouble2(pLinePoints[0], pLinePoints[1], pLinePoints, vblSaveCounter, 0, lineType);
                    nQuadrant = LineUtility.GetQuadrantDouble(pLinePoints[0], pLinePoints[1]);
                    //if the direction and quadrant are not compatible with GetFlotDouble then
                    //reverse the points
                    switch (nQuadrant) {
                        case 4: {
                            switch (n) {
                                case 1:	//extend left
                                case 2: {	//extend below
                                    break;
                                }

                                case 0:	//extend right
                                case 3: {	//extend above
                                    LineUtility.reversePoints(pLinePoints, vblSaveCounter);
                                    break;
                                }

                                default: {
                                    break;
                                }

                            }
                            break;
                        }

                        case 1: {
                            switch (n) {
                                case 1:	//extend left
                                case 3: {	//extend above
                                    break;
                                }

                                case 0:	//extend right
                                case 2: {	//extend below
                                    LineUtility.reversePoints(pLinePoints, vblSaveCounter);
                                    break;
                                }

                                default: {
                                    break;
                                }

                            }
                            break;
                        }

                        case 2: {
                            switch (n) {
                                case 1:	//extend left
                                case 2: {	//extend below
                                    LineUtility.reversePoints(pLinePoints, vblSaveCounter);
                                    break;
                                }

                                case 0:	//extend right
                                case 3: {	//extend above
                                    break;
                                }

                                default: {
                                    break;
                                }

                            }
                            break;
                        }

                        case 3: {
                            switch (n) {
                                case 1:	//extend left
                                case 3: {	//extend above
                                    LineUtility.reversePoints(pLinePoints, vblSaveCounter);
                                    break;
                                }

                                case 0:	//extend right
                                case 2: {	//extend above
                                    break;
                                }

                                default: {
                                    break;
                                }

                            }
                            break;
                        }

                        default: {
                            break;
                        }

                    }
                    lFlotCount = arraysupport.GetAnchorageDouble(pLinePoints, arraysupport.getScaledSize(20, tg.lineThickness, tg.patternScale), vblSaveCounter);
                    acCounter = lFlotCount;
                    break;
                }

                case TacticalLines.ANCHORAGE_LINE: {
                    LineUtility.reversePoints(pLinePoints, vblSaveCounter);
                    acCounter = arraysupport.GetAnchorageDouble(pLinePoints, arraysupport.getScaledSize(20, tg.lineThickness, tg.patternScale), vblSaveCounter);
                    break;
                }

                case TacticalLines.LRO: {
                    let xCount: number = countsupport.GetXPointsCount(pOriginalLinePoints, arraysupport.getScaledSize(30, tg.lineThickness, tg.patternScale), vblSaveCounter);
                    let xPoints2: POINT2[] = new Array<POINT2>(xCount);
                    let lvoCount: number = countsupport.GetLVOCount(pOriginalLinePoints, arraysupport.getScaledSize(30, tg.lineThickness, tg.patternScale), vblSaveCounter);
                    let lvoPoints: POINT2[] = new Array<POINT2>(lvoCount);
                    xCount = arraysupport.GetXPoints(pOriginalLinePoints, xPoints2, arraysupport.getScaledSize(30, tg.lineThickness, tg.patternScale), vblSaveCounter);
                    lvoCount = arraysupport.GetLVOPoints(pOriginalLinePoints, lvoPoints, arraysupport.getScaledSize(4, tg.lineThickness, tg.patternScale), arraysupport.getScaledSize(30, tg.lineThickness, tg.patternScale), vblSaveCounter);
                    for (k = 0; k < xCount; k++) {
                        pLinePoints[k] = new POINT2(xPoints2[k]);
                    }
                    if (xCount > 0) {
                        pLinePoints[xCount - 1].style = 5;
                    }
                    for (k = 0; k < lvoCount; k++) {
                        pLinePoints[xCount + k] = new POINT2(lvoPoints[k]);
                    }
                    acCounter = xCount + lvoCount;
                    break;
                }

                case TacticalLines.UNDERCAST: {
                    if (pLinePoints[0].x < pLinePoints[1].x) {
                        LineUtility.reversePoints(pLinePoints, vblSaveCounter);
                    }

                    lFlotCount = flot.GetFlotDouble(pLinePoints, arraysupport.getScaledSize(20, tg.lineThickness, tg.patternScale), vblSaveCounter);
                    acCounter = lFlotCount;
                    break;
                }

                case TacticalLines.LVO: {
                    acCounter = arraysupport.GetLVOPoints(pOriginalLinePoints, pLinePoints, arraysupport.getScaledSize(4, tg.lineThickness, tg.patternScale), arraysupport.getScaledSize(20, tg.lineThickness, tg.patternScale), vblSaveCounter);
                    break;
                }

                case TacticalLines.ICING: {
                    vblCounter = arraysupport.GetIcingPointsDouble(pLinePoints, arraysupport.getScaledSize(15, tg.lineThickness, tg.patternScale), vblSaveCounter);
                    acCounter = vblCounter;
                    break;
                }

                case TacticalLines.MVFR: {
                    //get the direction and quadrant of the first segment
                    n = arraysupport.GetInsideOutsideDouble2(pLinePoints[0], pLinePoints[1], pLinePoints, vblSaveCounter, 0, lineType);
                    nQuadrant = LineUtility.GetQuadrantDouble(pLinePoints[0], pLinePoints[1]);
                    //if the direction and quadrant are not compatible with GetFlotDouble then
                    //reverse the points
                    switch (nQuadrant) {
                        case 4: {
                            switch (n) {
                                case 0:	//extend left
                                case 3: {	//extend below
                                    break;
                                }

                                case 1:	//extend right
                                case 2: {	//extend above
                                    LineUtility.reversePoints(pLinePoints, vblSaveCounter);
                                    break;
                                }

                                default: {
                                    break;
                                }

                            }
                            break;
                        }

                        case 1: {
                            switch (n) {
                                case 0:	//extend left
                                case 2: {	//extend above
                                    break;
                                }

                                case 1:	//extend right
                                case 3: {	//extend below
                                    LineUtility.reversePoints(pLinePoints, vblSaveCounter);
                                    break;
                                }

                                default: {
                                    break;
                                }

                            }
                            break;
                        }

                        case 2: {
                            switch (n) {
                                case 0:	//extend left
                                case 3: {	//extend below
                                    LineUtility.reversePoints(pLinePoints, vblSaveCounter);
                                    break;
                                }

                                case 1:	//extend right
                                case 2: {	//extend above
                                    break;
                                }

                                default: {
                                    break;
                                }

                            }
                            break;
                        }

                        case 3: {
                            switch (n) {
                                case 0:	//extend left
                                case 2: {	//extend above
                                    LineUtility.reversePoints(pLinePoints, vblSaveCounter);
                                    break;
                                }

                                case 1:	//extend right
                                case 3: {	//extend above
                                    break;
                                }

                                default: {
                                    break;
                                }

                            }
                            break;
                        }

                        default: {
                            break;
                        }

                    }
                    lFlotCount = flot.GetFlotDouble(pLinePoints, arraysupport.getScaledSize(20, tg.lineThickness, tg.patternScale), vblSaveCounter);
                    acCounter = lFlotCount;
                    break;
                }

                case TacticalLines.ITD: {
                    acCounter = arraysupport.GetITDPointsDouble(pLinePoints, arraysupport.getScaledSize(15, tg.lineThickness, tg.patternScale), vblSaveCounter);
                    break;
                }

                case TacticalLines.CONVERGENCE: {
                    acCounter = arraysupport.GetConvergencePointsDouble(pLinePoints, arraysupport.getScaledSize(10, tg.lineThickness, tg.patternScale), vblSaveCounter);
                    break;
                }

                case TacticalLines.RIDGE: {
                    vblCounter = arraysupport.GetRidgePointsDouble(tg, pLinePoints, vblSaveCounter);
                    acCounter = vblCounter;
                    break;
                }

                case TacticalLines.TROUGH:
                case TacticalLines.UPPER_TROUGH:
                case TacticalLines.INSTABILITY:
                case TacticalLines.SHEAR: {
                    vblCounter = arraysupport.GetSquallDouble(pLinePoints, arraysupport.getScaledSize(10, tg.lineThickness, tg.patternScale), 6, arraysupport.getScaledSize(30, tg.lineThickness, tg.patternScale), vblSaveCounter);
                    acCounter = vblCounter;
                    break;
                }

                case TacticalLines.CABLE: {
                    vblCounter = arraysupport.GetSquallDouble(pLinePoints, arraysupport.getScaledSize(20, tg.lineThickness, tg.patternScale), 6, arraysupport.getScaledSize(20, tg.lineThickness, tg.patternScale), vblSaveCounter);
                    acCounter = vblCounter;
                    break;
                }

                case TacticalLines.SQUALL: {
                    vblCounter = arraysupport.GetSevereSquall(pLinePoints, arraysupport.getScaledSize(30, tg.lineThickness, tg.patternScale), vblSaveCounter);
                    acCounter = vblCounter;
                    break;
                }

                case TacticalLines.SF:
                case TacticalLines.USF:
                case TacticalLines.SFG:
                case TacticalLines.SFY: {
                    LineUtility.reversePoints(pLinePoints, vblSaveCounter);
                    vblCounter = flot.GetSFPointsDouble(tg, pLinePoints, vblSaveCounter);
                    acCounter = vblCounter;
                    break;
                }

                case TacticalLines.OFY: {
                    LineUtility.reversePoints(pLinePoints, vblSaveCounter);
                    vblCounter = flot.GetOFYPointsDouble(tg, pLinePoints, vblSaveCounter);
                    acCounter = vblCounter;
                    break;
                }

                case TacticalLines.OCCLUDED:
                case TacticalLines.UOF: {
                    LineUtility.reversePoints(pLinePoints, vblSaveCounter);
                    vblCounter = flot.GetOccludedPointsDouble(tg, pLinePoints, vblSaveCounter);
                    for (j = 0; j < vblSaveCounter; j++) {
                        pLinePoints[vblCounter + j] = pOriginalLinePoints[j];
                    }
                    vblCounter += vblSaveCounter;
                    acCounter = vblCounter;
                    break;
                }

                case TacticalLines.WF:
                case TacticalLines.UWF: {
                    LineUtility.reversePoints(pLinePoints, vblSaveCounter);
                    lFlotCount = flot.GetFlot2Double(tg, pLinePoints, vblSaveCounter);
                    for (j = 0; j < vblSaveCounter; j++) {
                        pLinePoints[vblCounter - vblSaveCounter + j] = pOriginalLinePoints[j];
                    }
                    acCounter = lFlotCount + vblSaveCounter;
                    break;
                }

                case TacticalLines.WFG:
                case TacticalLines.WFY: {
                    LineUtility.reversePoints(pLinePoints, vblSaveCounter);
                    lFlotCount = flot.GetFlot2Double(tg, pLinePoints, vblSaveCounter);
                    acCounter = lFlotCount;
                    break;
                }

                case TacticalLines.CFG:
                case TacticalLines.CFY: {
                    vblCounter = arraysupport.GetATWallPointsDouble(tg, pLinePoints, vblSaveCounter);
                    acCounter = vblCounter;
                    break;
                }

                case TacticalLines.CF:
                case TacticalLines.UCF: {
                    vblCounter = arraysupport.GetATWallPointsDouble(tg, pLinePoints, vblSaveCounter);
                    pLinePoints[vblCounter - 1].style = 5;
                    for (j = 0; j < vblSaveCounter; j++) {
                        pLinePoints[vblCounter + j] = pOriginalLinePoints[j];
                    }
                    vblCounter += vblSaveCounter;
                    pLinePoints[vblCounter - 1].style = 5;
                    acCounter = vblCounter;
                    break;
                }

                case TacticalLines.IL:
                case TacticalLines.PLANNED:
                case TacticalLines.ESR1:
                case TacticalLines.ESR2: {
                    LineUtility.LineRelativeToLine(pLinePoints[0], pLinePoints[1], pLinePoints[2], pt0, pt1);
                    d = LineUtility.calcDistance(pLinePoints[0], pt0);
                    pt4 = LineUtility.ExtendLineDouble(pt0, pLinePoints[0], d);
                    LineUtility.LineRelativeToLine(pLinePoints[0], pLinePoints[1], pt4, pt2, pt3);
                    pLinePoints[0] = new POINT2(pt0);
                    pLinePoints[1] = new POINT2(pt1);
                    pLinePoints[2] = new POINT2(pt3);
                    pLinePoints[3] = new POINT2(pt2);
                    switch (lineType) {
                        case TacticalLines.IL:
                        case TacticalLines.ESR2: {
                            pLinePoints[0].style = 0;
                            pLinePoints[1].style = 5;
                            pLinePoints[2].style = 0;
                            break;
                        }

                        case TacticalLines.PLANNED: {
                            pLinePoints[0].style = 1;
                            pLinePoints[1].style = 5;
                            pLinePoints[2].style = 1;
                            break;
                        }

                        case TacticalLines.ESR1: {
                            pLinePoints[1].style = 5;
                            if (pt0.x <= pt1.x) {
                                if (pLinePoints[1].y <= pLinePoints[2].y) {
                                    pLinePoints[0].style = 0;
                                    pLinePoints[2].style = 1;
                                } else {
                                    pLinePoints[0].style = 1;
                                    pLinePoints[2].style = 0;
                                }
                            } else {
                                if (pLinePoints[1].y >= pLinePoints[2].y) {
                                    pLinePoints[0].style = 0;
                                    pLinePoints[2].style = 1;
                                } else {
                                    pLinePoints[0].style = 1;
                                    pLinePoints[2].style = 0;
                                }
                            }
                            break;
                        }

                        default: {
                            break;
                        }

                    }
                    acCounter = 4;
                    break;
                }

                case TacticalLines.FORDSITE: {
                    LineUtility.LineRelativeToLine(pLinePoints[0], pLinePoints[1], pLinePoints[2], pt0, pt1);
                    pLinePoints[0].style = 1;
                    pLinePoints[1].style = 5;
                    pLinePoints[2] = new POINT2(pt0);
                    pLinePoints[2].style = 1;
                    pLinePoints[3] = new POINT2(pt1);
                    pLinePoints[3].style = 5;
                    acCounter = 4;
                    break;
                }

                case TacticalLines.ROADBLK: {
                    pts = new Array<POINT2>(4);
                    for (j = 0; j < 4; j++) {
                        pts[j] = new POINT2(pLinePoints[j]);
                    }
                    dRadius = LineUtility.calcDistance(pLinePoints[0], pLinePoints[1]);
                    d = LineUtility.calcDistanceToLine(pLinePoints[0], pLinePoints[1], pLinePoints[2]);

                    //first two lines
                    pLinePoints[0] = LineUtility.extendTrueLinePerp(pts[0], pts[1], pts[1], d, 0);
                    pLinePoints[1] = LineUtility.extendTrueLinePerp(pts[0], pts[1], pts[0], d, 5);
                    pLinePoints[2] = LineUtility.extendTrueLinePerp(pts[0], pts[1], pts[1], -d, 0);
                    pLinePoints[3] = LineUtility.extendTrueLinePerp(pts[0], pts[1], pts[0], -d, 5);

                    midpt = LineUtility.midPoint(pts[0], pts[1], 0);
                    //move the midpoint
                    midpt = LineUtility.ExtendLineDouble(pts[0], midpt, d);

                    //the next line
                    pLinePoints[4] = LineUtility.ExtendAngledLine(pts[0], pts[1], midpt, 105, dRadius / 2);
                    pLinePoints[5] = LineUtility.ExtendAngledLine(pts[0], pts[1], midpt, -75, dRadius / 2);
                    pLinePoints[5].style = 5;

                    //recompute the original midpt because it was moved
                    midpt = LineUtility.midPoint(pts[0], pts[1], 0);
                    //move the midpoint
                    midpt = LineUtility.ExtendLineDouble(pts[1], midpt, d);

                    //the last line
                    pLinePoints[6] = LineUtility.ExtendAngledLine(pts[0], pts[1], midpt, 105, dRadius / 2);
                    pLinePoints[7] = LineUtility.ExtendAngledLine(pts[0], pts[1], midpt, -75, dRadius / 2);
                    pLinePoints[7].style = 5;

                    acCounter = 8;
                    break;
                }

                case TacticalLines.AIRFIELD: {
                    arraysupport.AirfieldCenterFeature(pLinePoints, vblCounter);
                    acCounter = vblCounter;
                    //FillPoints(pLinePoints,acCounter,points);
                    break;
                }

                case TacticalLines.PNO:
                case TacticalLines.PLD:
                case TacticalLines.CFL: {
                    for (j = 0; j < vblCounter; j++) {
                        pLinePoints[j].style = 1;
                    }

                    acCounter = vblCounter;
                    break;
                }

                case TacticalLines.FENCED: {
                    arraysupport.FillPoints(pLinePoints, vblCounter, points);
                    xPoints = LineUtility.LineOfXPoints(tg, pOriginalLinePoints);
                    for (j = 0; j < xPoints.length; j++) {
                        points.push(xPoints[j] as POINT2);
                    }

                    acCounter = points.length;
                    break;
                }

                case TacticalLines.FOXHOLE: {
                    ({ result: bolVertical, slope: mVal } = LineUtility.calcTrueSlope(pt0, pt1));

                    if (bolVertical === 0) //line is vertical
                    {
                        if (pt0.y > pt1.y) {
                            direction = 0;
                        } else {
                            direction = 1;
                        }
                    }
                    if (bolVertical !== 0 && mVal <= 1) {
                        if (pt0.x < pt1.x) {
                            direction = 3;
                        } else {
                            direction = 2;
                        }
                    }
                    if (bolVertical !== 0 && mVal > 1) {
                        if (pt0.x < pt1.x && pt0.y > pt1.y) {
                            direction = 1;
                        }
                        if (pt0.x < pt1.x && pt0.y < pt1.y) {
                            direction = 0;
                        }

                        if (pt0.x > pt1.x && pt0.y > pt1.y) {
                            direction = 1;
                        }
                        if (pt0.x > pt1.x && pt0.y < pt1.y) {
                            direction = 0;
                        }
                    }

                    if (dMBR / 20 > arraysupport.maxLength * DPIScaleFactor) {
                        dMBR = 20 * arraysupport.maxLength * DPIScaleFactor;
                    }
                    if (dMBR / 20 < arraysupport.minLength * DPIScaleFactor) {
                        dMBR = 20 * arraysupport.minLength * DPIScaleFactor;
                    }
                    if (dMBR < 250 * DPIScaleFactor) {
                        dMBR = 250 * DPIScaleFactor;
                    }
                    if (dMBR > 500 * DPIScaleFactor) {
                        dMBR = 500 * DPIScaleFactor;
                    }

                    pLinePoints[0] = LineUtility.ExtendDirectedLine(pt0, pt1, pt0, direction, dMBR / 20);
                    pLinePoints[1] = new POINT2(pt0);
                    pLinePoints[2] = new POINT2(pt1);
                    pLinePoints[3] = LineUtility.ExtendDirectedLine(pt0, pt1, pt1, direction, dMBR / 20);
                    acCounter = 4;
                    break;
                }

                case TacticalLines.ISOLATE:
                case TacticalLines.CORDONKNOCK:
                case TacticalLines.CORDONSEARCH: {
                    arraysupport.GetIsolatePointsDouble(pLinePoints, lineType, converter);
                    acCounter = 50;
                    break;
                }

                case TacticalLines.AREA_DEFENSE: {
                    arraysupport.GetIsolatePointsDouble(pLinePoints, lineType, converter);
                    acCounter = 67;
                    break;
                }

                case TacticalLines.OCCUPY: {
                    arraysupport.GetIsolatePointsDouble(pLinePoints, lineType, converter);
                    acCounter = 32;
                    break;
                }

                case TacticalLines.RETAIN: {
                    arraysupport.GetIsolatePointsDouble(pLinePoints, lineType, converter);
                    acCounter = 75;
                    break;
                }

                case TacticalLines.SECURE: {
                    arraysupport.GetIsolatePointsDouble(pLinePoints, lineType, converter);
                    acCounter = 29;
                    break;
                }

                case TacticalLines.TURN_REVD:
                case TacticalLines.TURN: {
                    // Switch first and last point. Order changed in 2525C
                    let swapPt: POINT2 = pLinePoints[0];
                    pLinePoints[0] = pLinePoints[1];
                    pLinePoints[1] = swapPt;
                    arraysupport.GetIsolatePointsDouble(pLinePoints, lineType, null);
                    acCounter = 29;
                    break;
                }

                case TacticalLines.ENCIRCLE:
                case TacticalLines.ZONE:
                case TacticalLines.OBSAREA:
                case TacticalLines.OBSFAREA:
                case TacticalLines.STRONG:
                case TacticalLines.FORT_REVD:
                case TacticalLines.FORT: {
                    acCounter = arraysupport.GetZONEPointsDouble2(tg, pLinePoints, vblSaveCounter);
                    break;
                }

                case TacticalLines.ATWALL:
                case TacticalLines.LINE: {  //7-9-07
                    acCounter = arraysupport.GetATWallPointsDouble2(tg, pLinePoints, vblSaveCounter);
                    break;
                }

                case TacticalLines.SC:
                case TacticalLines.MRR:
                case TacticalLines.SL:
                case TacticalLines.TC:
                case TacticalLines.LLTR:	//added 5-4-07
                case TacticalLines.SAAFR:	//these have multiple segments
                case TacticalLines.AC: {
                    let bolSegmentAC: boolean = false;
                    //uncomment the next line if the air corridor is segmented
                    bolSegmentAC = true;
                    dMRR = arraysupport.dACP;
                    LineUtility.InitializePOINT2Array(acPoints);
                    LineUtility.InitializePOINT2Array(arcPts);
                    acCounter = 0;
                    if (!bolSegmentAC) {
                        for (j = 0; j < vblSaveCounter; j++) {
                            if (pOriginalLinePoints[j].style <= 0) {
                                pOriginalLinePoints[j].style = 1; //was 14
                            }
                        }
                    }
                    //get the SAAFR segments
                    for (j = 0; j < vblSaveCounter - 1; j++) {
                        //diagnostic: use style member for dMBR
                        dMBR = pOriginalLinePoints[j].style;
                        acPoints[0] = new POINT2(pOriginalLinePoints[j]);
                        acPoints[1] = new POINT2(pOriginalLinePoints[j + 1]);
                        LineUtility.GetSAAFRSegment(acPoints, lineType, dMBR);//was dMRR
                        for (k = 0; k < 6; k++) {
                            pLinePoints[acCounter] = new POINT2(acPoints[k]);
                            acCounter++;
                        }
                    }
                    //get the circles
                    let currentCircleSize: number = 0;
                    if (!bolSegmentAC) {
                        for (j = 0; j < vblSaveCounter - 1; j++) {
                            currentCircleSize = pOriginalLinePoints[j].style;
                            //nextCircleSize=pOriginalLinePoints[j+1].style;                        

                            //draw the circle at the segment front end
                            arcPts[0] = new POINT2(pOriginalLinePoints[j]);
                            //diagnostic: use style member for dMBR
                            dMBR = currentCircleSize;
                            LineUtility.CalcCircleDouble(arcPts[0], dMBR, 26, arcPts, 0);//was dMRR
                            arcPts[25].style = 5;
                            for (k = 0; k < 26; k++) {
                                pLinePoints[acCounter] = new POINT2(arcPts[k]);
                                acCounter++;
                            }

                            //draw the circle at the segment back end
                            arcPts[0] = new POINT2(pOriginalLinePoints[j + 1]);
                            dMBR = currentCircleSize;
                            LineUtility.CalcCircleDouble(arcPts[0], dMBR, 26, arcPts, 0);//was dMRR
                            arcPts[25].style = 5;
                            for (k = 0; k < 26; k++) {
                                pLinePoints[acCounter] = new POINT2(arcPts[k]);
                                acCounter++;
                            }
                        }
                    }
                    else    //segmented air corridors 
                    {
                        let lastCircleSize: number = 0;
                        let lastCirclePoint: POINT2 = pOriginalLinePoints[0];
                        for (j = 0; j < vblSaveCounter; j++) {
                            currentCircleSize = pOriginalLinePoints[j].style;
                            if (j === 0) {
                                lastCircleSize = currentCircleSize;
                                lastCirclePoint = pOriginalLinePoints[j];
                                continue;
                            }
                            if (currentCircleSize < 0) {
                                continue;
                            }
                            //the current circle point
                            arcPts[0] = new POINT2(pOriginalLinePoints[j]);
                            dMBR = lastCircleSize;
                            LineUtility.CalcCircleDouble(arcPts[0], dMBR, 26, arcPts, 0);
                            arcPts[25].style = 5;
                            for (k = 0; k < 26; k++) {
                                pLinePoints[acCounter] = new POINT2(arcPts[k]);
                                acCounter++;
                            }
                            //the previous circle point
                            arcPts[0] = new POINT2(lastCirclePoint);
                            LineUtility.CalcCircleDouble(arcPts[0], dMBR, 26, arcPts, 0);
                            arcPts[25].style = 5;
                            for (k = 0; k < 26; k++) {
                                pLinePoints[acCounter] = new POINT2(arcPts[k]);
                                acCounter++;
                            }
                            //set the last values
                            lastCircleSize = currentCircleSize;
                            lastCirclePoint = pOriginalLinePoints[j];
                        }
                    }
                    break;
                }

                case TacticalLines.MINED:
                case TacticalLines.UXO:
                case TacticalLines.ACOUSTIC:
                case TacticalLines.ACOUSTIC_AMB:
                case TacticalLines.BEARING:
                case TacticalLines.BEARING_J:
                case TacticalLines.BEARING_RDF:
                case TacticalLines.ELECTRO:
                case TacticalLines.BEARING_EW:
                case TacticalLines.TORPEDO:
                case TacticalLines.OPTICAL: {
                    acCounter = vblCounter;
                    break;
                }

                case TacticalLines.MSDZ: {
                    LineUtility.InitializePOINT2Array(circlePoints);
                    pt3 = new POINT2(pLinePoints[3]);
                    //dRadius = LineUtility.calcDistance(pt0, pt1);
                    if (converter == null) {
                        dRadius = LineUtility.calcDistance(pt0, pt1);
                        LineUtility.CalcCircleDouble(pt0, dRadius, 100,
                            circlePoints, 0);
                    }
                    else {
                        //use the converter
                        LineUtility.CalcCircleDouble2(pt0, pt1, 100,
                            circlePoints, converter);
                    }

                    for (j = 0; j < 100; j++) {
                        pLinePoints[j] = new POINT2(circlePoints[j]);
                    }
                    pLinePoints[99].style = 5;
                    //dRadius = LineUtility.calcDistance(pt0, pt2);
                    if (converter == null) {
                        dRadius = LineUtility.calcDistance(pt0, pt2);
                        LineUtility.CalcCircleDouble(pt0, dRadius, 100,
                            circlePoints, 0);
                    }
                    else {

                        LineUtility.CalcCircleDouble2(pt0, pt2, 100,
                            circlePoints, converter);
                    }

                    for (j = 0; j < 100; j++) {
                        pLinePoints[100 + j] = new POINT2(circlePoints[j]);
                    }
                    pLinePoints[199].style = 5;
                    //dRadius = LineUtility.calcDistance(pt0, pt3);
                    if (vblSaveCounter == 4) {
                        if (converter == null) {
                            dRadius = LineUtility.calcDistance(pt0, pt3);
                            LineUtility.CalcCircleDouble(pt0, dRadius, 100,
                                    circlePoints, 0);
                        } else
                            LineUtility.CalcCircleDouble2(pt0, pt3, 100,
                                    circlePoints, converter);
                        for (j = 0; j < 100; j++) {
                            pLinePoints[200 + j] = new POINT2(circlePoints[j]);
                        }
                    }
                    acCounter = vblCounter;
                    //FillPoints(pLinePoints,acCounter,points);
                    break;
                }

                case TacticalLines.CONVOY: {
                    if (dMBR < 150 * DPIScaleFactor) {
                        dMBR = 150 * DPIScaleFactor;
                    }
                    if (dMBR > 500 * DPIScaleFactor) {
                        dMBR = 500 * DPIScaleFactor;
                    }
                    dWidth = dMBR / 25;

                    pt0 = new POINT2(pLinePoints[0]);
                    pt1 = new POINT2(pLinePoints[1]);

                    ({ result: bolVertical, slope: mVal } = LineUtility.calcTrueSlope(pt1, pt0));
                    pt0 = LineUtility.extendLine(pt1, pt0, -dWidth * 3, 0);
                    if (mVal < 1) {
                        pLinePoints[0] = LineUtility.ExtendDirectedLine(pt0, pt1, pt0, 2, dWidth);
                        pLinePoints[1] = LineUtility.ExtendDirectedLine(pt0, pt1, pt1, 2, dWidth);
                        pLinePoints[2] = LineUtility.ExtendDirectedLine(pt0, pt1, pt1, 3, dWidth);
                        pLinePoints[3] = LineUtility.ExtendDirectedLine(pt0, pt1, pt0, 3, dWidth);
                    } else {
                        pLinePoints[0] = LineUtility.ExtendDirectedLine(pt0, pt1, pt0, 0, dWidth);
                        pLinePoints[1] = LineUtility.ExtendDirectedLine(pt0, pt1, pt1, 0, dWidth);
                        pLinePoints[2] = LineUtility.ExtendDirectedLine(pt0, pt1, pt1, 1, dWidth);
                        pLinePoints[3] = LineUtility.ExtendDirectedLine(pt0, pt1, pt0, 1, dWidth);
                    }
                    pt2 = LineUtility.ExtendLineDouble(pt1, pt0, dWidth * 3);
                    LineUtility.GetArrowHead4Double(pt0, pt2, Math.trunc(dWidth * 3), Math.trunc(dWidth * 3), pArrowPoints, 0);

                    d = LineUtility.calcDistance(pLinePoints[0], pArrowPoints[0]);
                    d1 = LineUtility.calcDistance(pLinePoints[3], pArrowPoints[0]);
                    pLinePoints[3].style = 5;
                    if (d < d1) {
                        pLinePoints[4] = new POINT2(pLinePoints[0]);
                        pLinePoints[4].style = 0;
                        pLinePoints[5] = new POINT2(pArrowPoints[0]);
                        pLinePoints[5].style = 0;
                        pLinePoints[6] = new POINT2(pArrowPoints[1]);
                        pLinePoints[6].style = 0;
                        pLinePoints[7] = new POINT2(pArrowPoints[2]);
                        pLinePoints[7].style = 0;
                        pLinePoints[8] = new POINT2(pLinePoints[3]);
                    } else {
                        pLinePoints[4] = pLinePoints[3];
                        pLinePoints[4].style = 0;
                        pLinePoints[5] = pArrowPoints[0];
                        pLinePoints[5].style = 0;
                        pLinePoints[6] = pArrowPoints[1];
                        pLinePoints[6].style = 0;
                        pLinePoints[7] = pArrowPoints[2];
                        pLinePoints[7].style = 0;
                        pLinePoints[8] = pLinePoints[0];
                    }

                    acCounter = 9;
                    //FillPoints(pLinePoints,acCounter,points);
                    break;
                }

                case TacticalLines.HCONVOY: {
                    if (dMBR < 150 * DPIScaleFactor) {
                        dMBR = 150 * DPIScaleFactor;
                    }
                    if (dMBR > 500 * DPIScaleFactor) {
                        dMBR = 500 * DPIScaleFactor;
                    }
                    dWidth = dMBR / 25;

                    pt0 = new POINT2(pLinePoints[0]);
                    pt1 = new POINT2(pLinePoints[1]);

                    pt2 = LineUtility.extendAlongLine(pt0, pt1, dWidth * 2); // Arrow point
                    LineUtility.GetArrowHead4Double(pt0, pt2, Math.trunc(dWidth * 2), Math.trunc(dWidth * 2), pArrowPoints, 0);

                    ({ result: bolVertical, slope: mVal } = LineUtility.calcTrueSlope(pt1, pt2));
                    if (mVal < 1) {
                        pLinePoints[0] = LineUtility.ExtendDirectedLine(pt2, pt1, pt2, LineUtility.extend_above, dWidth);
                        pLinePoints[1] = LineUtility.ExtendDirectedLine(pt2, pt1, pt1, LineUtility.extend_above, dWidth);
                        pLinePoints[2] = LineUtility.ExtendDirectedLine(pt2, pt1, pt1, LineUtility.extend_below, dWidth);
                        pLinePoints[3] = LineUtility.ExtendDirectedLine(pt2, pt1, pt2, LineUtility.extend_below, dWidth);
                    } else {
                        pLinePoints[0] = LineUtility.ExtendDirectedLine(pt2, pt1, pt2, LineUtility.extend_left, dWidth);
                        pLinePoints[1] = LineUtility.ExtendDirectedLine(pt2, pt1, pt1, LineUtility.extend_left, dWidth);
                        pLinePoints[2] = LineUtility.ExtendDirectedLine(pt2, pt1, pt1, LineUtility.extend_right, dWidth);
                        pLinePoints[3] = LineUtility.ExtendDirectedLine(pt2, pt1, pt2, LineUtility.extend_right, dWidth);
                    }

                    pLinePoints[4] = new POINT2(pLinePoints[0]);
                    pLinePoints[5] = new POINT2(pt2);
                    pLinePoints[5].style = 0;

                    pLinePoints[6] = new POINT2(pArrowPoints[1]);
                    pLinePoints[7] = new POINT2(pArrowPoints[0]);
                    pLinePoints[8] = new POINT2(pArrowPoints[2]);
                    pLinePoints[8].style = 0;
                    pLinePoints[9] = new POINT2(pArrowPoints[1]);

                    acCounter = 10;
                    //FillPoints(pLinePoints,acCounter,points);
                    break;
                }

                case TacticalLines.MSR_ONEWAY:
                case TacticalLines.MSR_TWOWAY:
                case TacticalLines.MSR_ALT:
                case TacticalLines.ASR_ONEWAY:
                case TacticalLines.ASR_TWOWAY:
                case TacticalLines.ASR_ALT:
                case TacticalLines.TRAFFIC_ROUTE_ONEWAY:
                case TacticalLines.TRAFFIC_ROUTE_ALT: {
                    nCounter = vblSaveCounter as number;
                    pLinePoints[vblSaveCounter - 1].style = 5;
                    for (j = 0; j < vblSaveCounter - 1; j++) {
                        d = LineUtility.calcDistance(pLinePoints[j], pLinePoints[j + 1]);
                        if (d < 20) //too short
                        {
                            continue;
                        }
                        pt0 = new POINT2(pLinePoints[j]);
                        pt1 = new POINT2(pLinePoints[j + 1]);
                        pt2 = LineUtility.extendLine(pLinePoints[j], pLinePoints[j + 1], -3 * d / 4, 0);
                        pt3 = LineUtility.extendLine(pLinePoints[j], pLinePoints[j + 1], -1 * d / 4, 5);
                        let distFromLine: number = 10 * DPIScaleFactor;
                        direction = arraysupport.SupplyRouteArrowSide(pLinePoints[j], pLinePoints[j + 1]);
                        pt2 = LineUtility.ExtendDirectedLine(pt0, pt1, pt2, direction, distFromLine);
                        pt3 = LineUtility.ExtendDirectedLine(pt0, pt1, pt3, direction, distFromLine);
                        pLinePoints[nCounter] = new POINT2(pt2);
                        nCounter++;
                        pLinePoints[nCounter] = new POINT2(pt3);
                        nCounter++;

                        d = distFromLine;
                        if (dMBR / 20 < arraysupport.minLength * DPIScaleFactor) {
                            d = 5 * DPIScaleFactor;
                        }

                        LineUtility.GetArrowHead4Double(pt2, pt3, d as number, d as number,
                            pArrowPoints, 0);

                        for (k = 0; k < 3; k++) {
                            pLinePoints[nCounter] = new POINT2(pArrowPoints[k]);
                            nCounter++;
                        }

                        if (lineType === TacticalLines.MSR_ALT || lineType === TacticalLines.ASR_ALT || lineType === TacticalLines.TRAFFIC_ROUTE_ALT) {
                            LineUtility.GetArrowHead4Double(pt3, pt2, d as number, d as number,
                                pArrowPoints, 0);

                            for (k = 0; k < 3; k++) {
                                pLinePoints[nCounter] = new POINT2(pArrowPoints[k]);
                                nCounter++;
                            }
                        }
                        if (lineType === TacticalLines.MSR_TWOWAY || lineType === TacticalLines.ASR_TWOWAY) {
                            distFromLine = 15 * DPIScaleFactor;
                            pt2 = LineUtility.ExtendDirectedLine(pt0, pt1, pt2, direction, distFromLine);
                            pt3 = LineUtility.ExtendDirectedLine(pt0, pt1, pt3, direction, distFromLine);

                            pLinePoints[nCounter] = new POINT2(pt2);
                            nCounter++;
                            pLinePoints[nCounter] = new POINT2(pt3);
                            nCounter++;
                            LineUtility.GetArrowHead4Double(pt3, pt2, d as number, d as number,
                                pArrowPoints, 0);

                            for (k = 0; k < 3; k++) {
                                pLinePoints[nCounter] = new POINT2(pArrowPoints[k]);
                                nCounter++;
                            }
                        }
                    }
                    acCounter = nCounter;
                    break;
                }

                case TacticalLines.FORDIF: {
                    LineUtility.LineRelativeToLine(pLinePoints[0], pLinePoints[1], pLinePoints[2], pt4, pt5);   //as pt2,pt3
                    pLinePoints[2] = new POINT2(pt5);//was pt3
                    pLinePoints[3] = new POINT2(pt4);//was pt2

                    for (j = 0; j < vblCounter; j++) {
                        pLinePoints[j].style = 1;
                    }

                    pt0 = LineUtility.midPoint(pLinePoints[0], pLinePoints[1], 0);
                    pt1 = LineUtility.midPoint(pLinePoints[2], pLinePoints[3], 0);
                    let savepoints: POINT2[] | null;
                    let drawJaggies: boolean = true;
                    if (clipBounds != null) {
                        let ul: POINT2 = new POINT2(clipBounds.getMinX(), clipBounds.getMinY());
                        let lr: POINT2 = new POINT2(clipBounds.getMaxX(), clipBounds.getMaxY());
                        savepoints = LineUtility.BoundOneSegment(pt0, pt1, ul, lr);
                        if (savepoints != null && savepoints.length > 1) {
                            pt0 = savepoints[0];
                            pt1 = savepoints[1];
                        } else {
                            savepoints = new Array<POINT2>(2);
                            savepoints[0] = new POINT2(pt0);
                            savepoints[1] = new POINT2(pt1);
                            drawJaggies = false;
                        }
                    }

                    midpt = LineUtility.midPoint(pt0, pt1, 0);
                    let dist0: number = LineUtility.calcDistance(midpt, pt0);
                    let dist1: number = LineUtility.calcDistance(midpt, pt1);

                    if (dist0 > dist1) {
                        LineUtility.LineRelativeToLine(pLinePoints[2], pLinePoints[3], pt0, pt4, pt5);
                        pLinePoints[0] = new POINT2(pt5.x, pt5.y, 1);
                        pLinePoints[1] = new POINT2(pt4.x, pt4.y, 1);
                    } else {
                        LineUtility.LineRelativeToLine(pLinePoints[0], pLinePoints[1], pt1, pt4, pt5);
                        pLinePoints[2] = new POINT2(pt5.x, pt5.y, 1);
                        pLinePoints[3] = new POINT2(pt4.x, pt4.y, 1);
                    }

                    //end section
                    //calculate start, end points for upper and lower lines
                    //across the middle
                    let spikeLength: number = arraysupport.getScaledSize(10, tg.lineThickness, tg.patternScale);
                    pt2 = LineUtility.extendLine(pLinePoints[0], pt0, -spikeLength, 0);
                    pt3 = LineUtility.extendLine(pLinePoints[3], pt1, -spikeLength, 0);
                    pt4 = LineUtility.extendLine(pLinePoints[0], pt0, spikeLength, 0);
                    pt5 = LineUtility.extendLine(pLinePoints[3], pt1, spikeLength, 0);

                    dWidth = LineUtility.calcDistance(pt0, pt1);

                    pointCounter = 4;
                    n = 1;
                    pLinePoints[pointCounter] = new POINT2(pt0);
                    pLinePoints[pointCounter].style = 0;
                    pointCounter++;
                    if (drawJaggies) {
                        while (dExtendLength < dWidth - spikeLength) {
                            dExtendLength = n as number * spikeLength / 2;
                            pLinePoints[pointCounter] = LineUtility.extendLine(pt2, pt3, dExtendLength - dWidth, 0);
                            pointCounter++;
                            n++;
                            //dExtendLength = (double) n * 10;
                            dExtendLength = n as number * spikeLength / 2;
                            pLinePoints[pointCounter] = LineUtility.extendLine(pt4, pt5, dExtendLength - dWidth, 0);
                            pointCounter++;
                            if (pointCounter >= pLinePoints.length - 1) {
                                break;
                            }
                            n++;
                        }
                    }
                    pLinePoints[pointCounter] = new POINT2(pt1);
                    pLinePoints[pointCounter].style = 5;
                    pointCounter++;
                    acCounter = pointCounter;
                    break;
                }

                case TacticalLines.ATDITCH: {
                    acCounter = LineUtility.getDitchSpike(tg, pLinePoints, vblSaveCounter, 0);
                    break;
                }

                case TacticalLines.ATDITCHC as number: {	//extra Points were calculated by a function
                    pLinePoints[0].style = 9;
                    acCounter = LineUtility.getDitchSpike(tg, pLinePoints, vblSaveCounter, 0);
                    //pLinePoints[vblCounter-1].style=10;
                    break;
                }

                case TacticalLines.ATDITCHM: {
                    LineUtility.reversePoints(
                        pLinePoints,
                        vblSaveCounter);
                    pLinePoints[0].style = 9;
                    acCounter = LineUtility.getDitchSpike(tg, pLinePoints, vblSaveCounter, 0);
                    break;
                }

                case TacticalLines.DIRATKGND: {
                    //was 20
                    if (dMBR / 30 > arraysupport.maxLength * DPIScaleFactor) {
                        dMBR = 30 * arraysupport.maxLength * DPIScaleFactor;
                    }
                    if (dMBR / 30 < arraysupport.minLength * DPIScaleFactor) {
                        dMBR = 30 * arraysupport.minLength * DPIScaleFactor;
                    }
                    if (dMBR < 150 * DPIScaleFactor) {
                        dMBR = 150 * DPIScaleFactor;
                    }
                    if (dMBR > 500 * DPIScaleFactor) {
                        dMBR = 500 * DPIScaleFactor;
                    }

                    d = LineUtility.calcDistance(pLinePoints[0], pLinePoints[1]);
                    if (d < dMBR / 40) {
                        pLinePoints[1] = LineUtility.ExtendLineDouble(pLinePoints[0], pLinePoints[1], dMBR / 40 + 1);
                    }

                    pLinePoints[0] = LineUtility.extendAlongLine(pLinePoints[0], pLinePoints[1], dMBR / 40);

                    //reverse the points
                    LineUtility.reversePoints(
                        pLinePoints,
                        vblSaveCounter);

                    pt0 = new POINT2(pLinePoints[vblCounter - 12]);
                    pt1 = new POINT2(pLinePoints[vblCounter - 11]);
                    pt2 = LineUtility.ExtendLineDouble(pt0, pt1, dMBR / 40);
                    LineUtility.GetArrowHead4Double(pt0, pt1, Math.trunc(dMBR / 20), Math.trunc(dMBR / 20),
                        pArrowPoints, 0);

                    for (j = 0; j < 3; j++) {
                        pLinePoints[vblCounter - 10 + j] = new POINT2(pArrowPoints[j]);
                    }
                    LineUtility.GetArrowHead4Double(pt0, pt2, Math.trunc(dMBR / 13.33), Math.trunc(dMBR / 13.33),
                        pArrowPoints, 0);

                    for (j = 0; j < 3; j++) {
                        pLinePoints[vblCounter - 7 + j] = new POINT2(pArrowPoints[j]);
                    }

                    pLinePoints[vblCounter - 4] = new POINT2(pLinePoints[vblCounter - 10]);
                    pLinePoints[vblCounter - 4].style = 0;
                    pLinePoints[vblCounter - 3] = new POINT2(pLinePoints[vblCounter - 7]);
                    pLinePoints[vblCounter - 3].style = 5;

                    pLinePoints[vblCounter - 2] = new POINT2(pLinePoints[vblCounter - 8]);
                    pLinePoints[vblCounter - 2].style = 0;
                    pLinePoints[vblCounter - 1] = new POINT2(pLinePoints[vblCounter - 5]);
                    pLinePoints[vblCounter - 1].style = 5;
                    acCounter = vblCounter;
                    break;
                }

                case TacticalLines.MFLANE:
                case TacticalLines.RAFT: {
                    pt2 = LineUtility.ExtendLineDouble(pLinePoints[vblCounter - 8], pLinePoints[vblCounter - 7], dMBR / 2);
                    pt3 = new POINT2(pLinePoints[vblCounter - 7]);
                    pt1 = LineUtility.ExtendLineDouble(pLinePoints[1], pLinePoints[0], dMBR / 2);

                    if (dMBR / 10 > arraysupport.maxLength * DPIScaleFactor) {
                        dMBR = 10 * arraysupport.maxLength * DPIScaleFactor;
                    }
                    if (dMBR / 10 < arraysupport.minLength * DPIScaleFactor) {
                        dMBR = 10 * arraysupport.minLength * DPIScaleFactor;
                    }
                    if (dMBR > 250 * DPIScaleFactor) {
                        dMBR = 250 * DPIScaleFactor;
                    }

                    LineUtility.GetArrowHead4Double(pt2, pt3, Math.trunc(dMBR / 10), Math.trunc(dMBR / 5),
                        pArrowPoints, 0);

                    for (k = 0; k < 3; k++) {
                        pLinePoints[vblCounter - 6 + k] = new POINT2(pArrowPoints[k]);
                    }

                    LineUtility.GetArrowHead4Double(pt1, pt0, Math.trunc(dMBR / 10), Math.trunc(dMBR / 5),
                        pArrowPoints, 0);

                    for (k = 0; k < 3; k++) {
                        pLinePoints[vblCounter - 3 + k] = new POINT2(pArrowPoints[k]);
                    }
                    pLinePoints[vblSaveCounter - 1].style = 5;
                    acCounter = vblCounter;
                    break;
                }

                case TacticalLines.DIRATKAIR: {
                    LineUtility.reversePoints(
                        pLinePoints,
                        vblSaveCounter);

                    for (k = vblSaveCounter - 1; k > 0; k--) {
                        d += LineUtility.calcDistance(pLinePoints[k], pLinePoints[k - 1]);
                        if (d > 60) {
                            break;
                        }
                    }
                    if (d > 60) {
                        middleSegment = k;
                        pt2 = pLinePoints[middleSegment];
                        if (middleSegment >= 1) {
                            pt3 = pLinePoints[middleSegment - 1];
                        }
                    } else {
                        if (vblSaveCounter <= 3) {
                            middleSegment = 1;
                        } else {
                            middleSegment = 2;
                        }

                        pt2 = pLinePoints[middleSegment];
                        if (middleSegment >= 1) {
                            pt3 = pLinePoints[middleSegment - 1];
                        }
                    }

                    pt0 = new POINT2(pLinePoints[0]);

                    if (dMBR / 20 > arraysupport.maxLength * DPIScaleFactor) {
                        dMBR = 20 * arraysupport.maxLength * DPIScaleFactor;
                    }
                    if (dMBR / 20 < arraysupport.minLength * DPIScaleFactor) {
                        dMBR = 20 * arraysupport.minLength * DPIScaleFactor;
                    }
                    if (dMBR < 150 * DPIScaleFactor) {
                        dMBR = 150 * DPIScaleFactor;
                    }

                    if (dMBR > 250 * DPIScaleFactor) {
                        dMBR = 250 * DPIScaleFactor;
                    }

                    LineUtility.GetArrowHead4Double(pLinePoints[vblCounter - 11], pLinePoints[vblCounter - 10], Math.trunc(dMBR / 20), Math.trunc(dMBR / 20),
                        pArrowPoints, 0);

                    for (j = 0; j < 3; j++) {
                        pLinePoints[vblCounter - 9 + j] = new POINT2(pArrowPoints[j]);
                    }

                    pLinePoints[vblCounter - 6].x = (pLinePoints[vblCounter - 11].x + pLinePoints[vblCounter - 10].x) / 2;
                    pLinePoints[vblCounter - 6].y = (pLinePoints[vblCounter - 11].y + pLinePoints[vblCounter - 10].y) / 2;
                    pt0 = new POINT2(pLinePoints[vblCounter - 6]);
                    LineUtility.GetArrowHead4Double(pLinePoints[vblCounter - 11], pt0, Math.trunc(dMBR / 20), Math.trunc(dMBR / 20),
                        pArrowPoints, 9);

                    if (middleSegment >= 1) {
                        pt0 = LineUtility.midPoint(pt2, pt3, 0);
                        LineUtility.GetArrowHead4Double(pt3, pt0, Math.trunc(dMBR / 20), Math.trunc(dMBR / 20),
                            pArrowPoints, 9);
                    }

                    for (j = 0; j < 3; j++) {
                        pLinePoints[vblCounter - 6 + j] = new POINT2(pArrowPoints[j]);
                    }

                    LineUtility.GetArrowHead4Double(pLinePoints[vblCounter - 10], pt0, Math.trunc(dMBR / 20), Math.trunc(dMBR / 20),
                        pArrowPoints, 9);
                    if (middleSegment >= 1) {
                        pt0 = LineUtility.midPoint(pt2, pt3, 0);
                        LineUtility.GetArrowHead4Double(pt2, pt0, Math.trunc(dMBR / 20), Math.trunc(dMBR / 20),
                            pArrowPoints, 9);
                    }
                    for (j = 0; j < 3; j++) {
                        pLinePoints[vblCounter - 3 + j] = new POINT2(pArrowPoints[j]);
                    }

                    //this section was added to remove fill from the bow tie feature
                    let airPts: Array<POINT2> = new Array();
                    pLinePoints[middleSegment - 1].style = 5;
                    //pLinePoints[middleSegment].style=14;
                    if (vblSaveCounter === 2) {
                        pLinePoints[1].style = 5;
                    }

                    for (j = 0; j < vblCounter; j++) {
                        airPts.push(new POINT2(pLinePoints[j]));
                    }

                    midpt = LineUtility.midPoint(pLinePoints[middleSegment - 1], pLinePoints[middleSegment], 0);
                    pt0 = LineUtility.extendAlongLine(midpt, pLinePoints[middleSegment], dMBR / 20, 0);
                    airPts.push(pt0);
                    pt1 = new POINT2(pLinePoints[middleSegment]);
                    pt1.style = 5;
                    airPts.push(pt1);

                    pt0 = LineUtility.extendAlongLine(midpt, pLinePoints[middleSegment - 1], dMBR / 20, 0);
                    airPts.push(pt0);
                    pt1 = new POINT2(pLinePoints[middleSegment - 1]);
                    pt1.style = 5;
                    airPts.push(pt1);

                    //re-dimension pLinePoints so that it can hold the
                    //the additional points required by the shortened middle segment
                    //which has the bow tie feature
                    vblCounter = airPts.length;
                    pLinePoints = new Array<POINT2>(airPts.length);
                    for (j = 0; j < airPts.length; j++) {
                        pLinePoints[j] = new POINT2(airPts[j]);
                    }
                    //end section

                    acCounter = vblCounter;
                    //FillPoints(pLinePoints,vblCounter,points);
                    break;
                }

                case TacticalLines.PDF: {
                    pt0 = new POINT2(pLinePoints[1]);
                    pt1 = new POINT2(pLinePoints[0]);
                    pLinePoints[0] = new POINT2(pt0);
                    pLinePoints[1] = new POINT2(pt1);
                    pts2 = new Array<POINT2>(3);
                    pts2[0] = new POINT2(pt0);
                    pts2[1] = new POINT2(pt1);
                    pts2[2] = new POINT2(pt2);
                    ({ x: offsetXVal, y: offsetYVal } = LineUtility.GetPixelsMin(pts2, 3));
                    if (offsetXVal < 0) {
                        offsetXVal = offsetXVal - 100;
                    } else {
                        offsetXVal = 0;
                    }

                    pLinePoints[2].style = 5;

                    if (dMBR / 20 > arraysupport.maxLength * DPIScaleFactor) {
                        dMBR = 20 * arraysupport.maxLength * DPIScaleFactor;
                    }
                    if (dMBR / 20 < arraysupport.minLength * DPIScaleFactor) {
                        dMBR = 20 * arraysupport.minLength * DPIScaleFactor;
                    }
                    if (dMBR > 500 * DPIScaleFactor) {
                        dMBR = 500 * DPIScaleFactor;
                    }

                    let rectWidth: number = arraysupport.getScaledSize(2, tg.lineThickness / 2.0, tg.patternScale);

                    pt2 = LineUtility.ExtendLineDouble(pt0, pt1, -dMBR / 10);
                    ({ result: bolVertical, slope: mVal } = LineUtility.calcTrueSlope(pt0, pt1));
                    if (bolVertical !== 0 && mVal !== 0) {
                        b = pt2.y + (1 / mVal) * pt2.x;
                        b1 = (-1 / mVal) * offsetXVal + b;
                        ptYIntercept.x = offsetXVal;
                        ptYIntercept.y = b1;
                        pLinePoints[3] = LineUtility.ExtendLineDouble(ptYIntercept, pt2, -rectWidth);
                        pLinePoints[3].style = 0;
                        pLinePoints[4] = LineUtility.ExtendLineDouble(ptYIntercept, pt2, rectWidth);
                        pLinePoints[4].style = 0;
                    }
                    if (bolVertical !== 0 && mVal === 0) {
                        pLinePoints[3] = new POINT2(pt2);
                        pLinePoints[3].y = pt2.y - rectWidth;
                        pLinePoints[3].style = 0;
                        pLinePoints[4] = new POINT2(pt2);
                        pLinePoints[4].y = pt2.y + rectWidth;
                        pLinePoints[4].style = 0;
                    }
                    if (bolVertical === 0) {
                        pLinePoints[3] = new POINT2(pt2);
                        pLinePoints[3].x = pt2.x - rectWidth;
                        pLinePoints[3].style = 0;
                        pLinePoints[4] = new POINT2(pt2);
                        pLinePoints[4].x = pt2.x + rectWidth;
                        pLinePoints[4].style = 0;
                    }

                    pt2 = LineUtility.ExtendLineDouble(pt1, pt0, -dMBR / 10);
                    if (bolVertical !== 0 && mVal !== 0) {
                        b = pt2.y + (1 / mVal) * pt2.x;
                        //get the Y intercept at x=offsetX
                        b1 = (-1 / mVal) * offsetXVal + b;
                        ptYIntercept.x = offsetXVal;
                        ptYIntercept.y = b1;
                        pLinePoints[5] = LineUtility.ExtendLineDouble(ptYIntercept, pt2, rectWidth);
                        pLinePoints[5].style = 0;
                        pLinePoints[6] = LineUtility.ExtendLineDouble(ptYIntercept, pt2, -rectWidth);
                    }
                    if (bolVertical !== 0 && mVal === 0) {
                        pLinePoints[5] = new POINT2(pt2);
                        pLinePoints[5].y = pt2.y + rectWidth;
                        pLinePoints[5].style = 0;
                        pLinePoints[6] = new POINT2(pt2);
                        pLinePoints[6].y = pt2.y - rectWidth;
                    }
                    if (bolVertical === 0) {
                        pLinePoints[5] = new POINT2(pt2);
                        pLinePoints[5].x = pt2.x + rectWidth;
                        pLinePoints[5].style = 0;
                        pLinePoints[6] = new POINT2(pt2);
                        pLinePoints[6].x = pt2.x - rectWidth;
                    }

                    pLinePoints[6].style = 0;
                    pLinePoints[7] = new POINT2(pLinePoints[3]);
                    pLinePoints[7].style = 5;
                    LineUtility.GetArrowHead4Double(pLinePoints[1], pLinePoints[0], Math.trunc(dMBR / 20), Math.trunc(dMBR / 20), pArrowPoints, 0);
                    for (j = 0; j < 3; j++) {
                        pLinePoints[8 + j] = new POINT2(pArrowPoints[j]);
                    }
                    LineUtility.GetArrowHead4Double(pLinePoints[1], pLinePoints[2], Math.trunc(dMBR / 20), Math.trunc(dMBR / 20), pArrowPoints, 0);
                    for (j = 0; j < 3; j++) {
                        pLinePoints[11 + j] = new POINT2(pArrowPoints[j]);
                        pLinePoints[11 + j].style = 0;
                    }
                    acCounter = 14;
                    break;
                }

                case TacticalLines.DIRATKSPT:
                case TacticalLines.INFILTRATION: {
                    if (lineType == TacticalLines.DIRATKSPT) {
                    //reverse the points
                    LineUtility.reversePoints(
                        pLinePoints,
                        vblSaveCounter);
                    }
                    if (dMBR / 20 > arraysupport.maxLength * DPIScaleFactor) {
                        dMBR = 20 * arraysupport.maxLength * DPIScaleFactor;
                    }
                    if (dMBR / 20 < arraysupport.minLength * DPIScaleFactor) {
                        dMBR = 20 * arraysupport.minLength * DPIScaleFactor;
                    }
                    if (dMBR < 150 * DPIScaleFactor) {
                        dMBR = 150 * DPIScaleFactor;
                    }
                    if (dMBR > 500 * DPIScaleFactor) {
                        dMBR = 500 * DPIScaleFactor;
                    }

                    LineUtility.GetArrowHead4Double(pLinePoints[vblCounter - 5], pLinePoints[vblCounter - 4], Math.trunc(dMBR / 20), Math.trunc(dMBR / 20), pArrowPoints, 0);
                    for (k = 0; k < 3; k++) {
                        pLinePoints[vblCounter - k - 1] = new POINT2(pArrowPoints[k]);
                    }
                    acCounter = vblCounter;
                    break;
                }

                case TacticalLines.EXPLOIT: {
                    // Convert arrows to 90 degrees with the hypotenuse distance = distance between pt1 and pt2
                    let triBiSector: number = (LineUtility.calcDistance(pt1, pt2) / Math.sqrt(2));

                    // Arrow at pt1
                    LineUtility.GetArrowHead4Double(pt1, pt0, triBiSector, triBiSector * 2, pArrowPoints, 0);
                    for (k = 0; k < 3; k++) {
                        pLinePoints[k+2] = new POINT2(pArrowPoints[k]);
                    }

                    // Dashed tail at pt2
                    LineUtility.GetArrowHead4Double(LineUtility.ExtendLineDouble(pt0, pt1, 10), pt1, triBiSector, triBiSector * 2, pArrowPoints, 1);
                    for (k = 0; k < 3; k++) {
                        pLinePoints[k+5] = new POINT2(pArrowPoints[k]);
                    }
                    acCounter = vblCounter;
                    break;
                }

                case TacticalLines.ABATIS: {
                    //must use an x offset for ptYintercept because of extending from it
                    pts2 = new Array<POINT2>(2);
                    pts2[0] = new POINT2(pt0);
                    pts2[1] = new POINT2(pt1);
                    ({ x: offsetXVal, y: offsetYVal } = LineUtility.GetPixelsMin(pts2, 2));
                    if (offsetXVal <= 0) {
                        offsetXVal = offsetXVal - 100;
                    } else {
                        offsetXVal = 0;
                    }
                    if (dMBR > 300 * DPIScaleFactor) {
                        dMBR = 300 * DPIScaleFactor;
                    }

                    pLinePoints[0] = LineUtility.ExtendLineDouble(pLinePoints[1], pLinePoints[0], -dMBR / 10);
                    ({ result: bolVertical, slope: mVal } = LineUtility.calcTrueSlope(pt0, pt1));
                    midpt.x = (pt0.x + pLinePoints[0].x) / 2;
                    midpt.y = (pt0.y + pLinePoints[0].y) / 2;
                    pLinePoints[vblCounter - 3] = new POINT2(pt0);
                    pLinePoints[vblCounter - 4].style = 5;
                    pLinePoints[vblCounter - 3].style = 0;
                    if (bolVertical !== 0 && mVal !== 0) {
                        b = midpt.y + (1 / mVal) * midpt.x;	//the line equation
                        //get Y intercept at x=offsetX
                        b1 = (-1 / mVal) * offsetXVal + b;
                        ptYIntercept.x = offsetXVal;
                        ptYIntercept.y = b1;
                        pLinePoints[vblCounter - 2] = LineUtility.ExtendLineDouble(ptYIntercept, midpt, dMBR / 20);
                        if (pLinePoints[vblCounter - 2].y >= midpt.y) {
                            pLinePoints[vblCounter - 2] = LineUtility.ExtendLineDouble(ptYIntercept, midpt, -dMBR / 20);
                        }
                    }
                    if (bolVertical !== 0 && mVal === 0) //horizontal line
                    {
                        pLinePoints[vblCounter - 2] = new POINT2(midpt);
                        pLinePoints[vblCounter - 2].y = midpt.y - dMBR / 20;
                    }
                    if (bolVertical === 0) {
                        pLinePoints[vblCounter - 2] = new POINT2(midpt);
                        pLinePoints[vblCounter - 2].x = midpt.x - dMBR / 20;
                    }
                    pLinePoints[vblCounter - 2].style = 0;
                    pLinePoints[vblCounter - 1] = new POINT2(pLinePoints[0]);

                    //FillPoints(pLinePoints,vblCounter,points);
                    acCounter = vblCounter;
                    //FillPoints(pLinePoints,acCounter,points);
                    break;
                }

                case TacticalLines.CLUSTER: {
                    //must use an x offset for ptYintercept because of extending from it
                    pts2 = new Array<POINT2>(2);

                    //for some reason occulus puts the points on top of one another
                    if (Math.abs(pt0.y - pt1.y) < 1) {
                        pt1.y = pt0.y + 1;
                    }

                    pts2[0] = new POINT2(pt0);
                    pts2[1] = new POINT2(pt1);

                    pts = new Array<POINT2>(26);
                    dRadius = LineUtility.calcDistance(pt0, pt1) / 2;
                    midpt.x = (pt1.x + pt0.x) / 2;
                    midpt.y = (pt1.y + pt0.y) / 2;
                    ({ result: bolVertical, slope: mVal } = LineUtility.calcTrueSlope(pt0, pt1));
                    if (bolVertical !== 0 && mVal !== 0) //not vertical or horizontal
                    {
                        b = midpt.y + (1 / mVal) * midpt.x;	//normal y intercept at x=0
                        ptYIntercept.x = 0;
                        ptYIntercept.y = b;
                        pt2 = LineUtility.ExtendLineDouble(ptYIntercept, midpt, dRadius);
                        if (pLinePoints[0].x <= pLinePoints[1].x) {
                            if (pt2.y >= midpt.y) {
                                pt2 = LineUtility.ExtendLineDouble(ptYIntercept, midpt, -dRadius);
                            }
                        } else {
                            if (pt2.y <= midpt.y) {
                                pt2 = LineUtility.ExtendLineDouble(ptYIntercept, midpt, -dRadius);
                            }
                        }

                    }
                    if (bolVertical !== 0 && mVal === 0) //horizontal line
                    {
                        pt2 = midpt;
                        if (pLinePoints[0].x <= pLinePoints[1].x) {
                            pt2.y = midpt.y - dRadius;
                        } else {
                            pt2.y = midpt.y + dRadius;
                        }
                    }
                    if (bolVertical === 0) //vertical line
                    {
                        pt2 = midpt;
                        if (pLinePoints[0].y <= pLinePoints[1].y) {
                            pt2.x = midpt.x + dRadius;
                        } else {
                            pt2.x = midpt.x - dRadius;
                        }
                    }

                    pt1 = LineUtility.ExtendLineDouble(midpt, pt2, 100);

                    pts[0] = new POINT2(pt2);
                    pts[1] = new POINT2(pt1);

                    LineUtility.arcArray(
                        pts,
                        0, dRadius,
                        lineType,
                        null);
                    pLinePoints[0].style = 1;
                    pLinePoints[1].style = 5;
                    for (j = 0; j < 26; j++) {
                        pLinePoints[2 + j] = new POINT2(pts[j]);
                        pLinePoints[2 + j].style = 1;
                    }
                    acCounter = 28;
                    break;
                }

                case TacticalLines.FOLLA: {
                    //reverse the points
                    LineUtility.reversePoints(pLinePoints, vblSaveCounter);

                    if (dMBR / 10 > arraysupport.maxLength * DPIScaleFactor) {
                        dMBR = 10 * arraysupport.maxLength * DPIScaleFactor;
                    }
                    if (dMBR / 10 < arraysupport.minLength * DPIScaleFactor) {
                        dMBR = 10 * arraysupport.minLength * DPIScaleFactor;
                    }
                    if (dMBR > 150 * DPIScaleFactor) {
                        dMBR = 150 * DPIScaleFactor;
                    }

                    pLinePoints[0] = LineUtility.ExtendLineDouble(pLinePoints[1], pLinePoints[0], -2 * dMBR / 10);

                    for (k = 0; k < vblCounter - 14; k++) {
                        pLinePoints[k].style = 18;
                    }
                    pLinePoints[vblCounter - 15].style = 5;

                    pt0 = LineUtility.ExtendLineDouble(pLinePoints[1], pLinePoints[0], 5 * dMBR / 10);

                    LineUtility.GetArrowHead4Double(pt0, pLinePoints[0], Math.trunc(dMBR / 10), Math.trunc(dMBR / 10), pArrowPoints, 0);
                    for (k = 0; k < 3; k++) {
                        pLinePoints[vblCounter - 14 + k] = new POINT2(pArrowPoints[k]);
                    }

                    pt3 = LineUtility.ExtendLineDouble(pLinePoints[1], pLinePoints[0], dMBR / 10);

                    LineUtility.GetArrowHead4Double(pt0, pt3, Math.trunc(dMBR / 10), Math.trunc(dMBR / 10), pArrowPoints, 0);
                    pLinePoints[vblCounter - 12].style = 0;
                    pLinePoints[vblCounter - 11] = new POINT2(pArrowPoints[2]);
                    pLinePoints[vblCounter - 11].style = 0;
                    pLinePoints[vblCounter - 10] = new POINT2(pArrowPoints[0]);
                    pLinePoints[vblCounter - 10].style = 0;
                    pLinePoints[vblCounter - 9] = new POINT2(pLinePoints[vblCounter - 14]);
                    pLinePoints[vblCounter - 9].style = 5;

                    LineUtility.GetArrowHead4Double(pLinePoints[vblCounter - 16], pLinePoints[vblCounter - 15], Math.trunc(dMBR / 10), Math.trunc(dMBR / 10), pArrowPoints, 0);

                    for (k = 0; k < 3; k++) {
                        pLinePoints[vblCounter - 8 + k] = new POINT2(pArrowPoints[k]);
                    }
                    pLinePoints[vblCounter - 6].style = 0;

                    //diagnostic to make first point tip of arrowhead    6-14-12
                    //pt3 = LineUtility.ExtendLineDouble(pLinePoints[vblCounter - 16], pLinePoints[vblCounter - 15], 0.75 * dMBR / 10);
                    pt3 = LineUtility.ExtendLineDouble(pLinePoints[vblCounter - 16], pLinePoints[vblCounter - 15], -0.75 * dMBR / 10);
                    pLinePoints[1] = pt3;
                    pLinePoints[1].style = 5;
                    //LineUtility.GetArrowHead4Double(pLinePoints[vblCounter - 16], pt3, (int) (1.25 * dMBR / 10), (int) (1.25 * dMBR / 10), pArrowPoints, 0);
                    LineUtility.GetArrowHead4Double(pLinePoints[vblCounter - 16], pt3, Math.trunc(dMBR / 10), Math.trunc(dMBR / 10), pArrowPoints, 0);
                    //end section

                    for (k = 0; k < 3; k++) {
                        pLinePoints[vblCounter - 5 + k] = new POINT2(pArrowPoints[2 - k]);
                    }
                    pLinePoints[vblCounter - 5].style = 0;

                    pLinePoints[vblCounter - 2] = new POINT2(pLinePoints[vblCounter - 8]);
                    pLinePoints[vblCounter - 2].style = 5;
                    pLinePoints[vblCounter - 1] = new POINT2(pLinePoints[vblCounter - 7]);
                    acCounter = 16;
                    break;
                }

                case TacticalLines.FOLSP: {
                    LineUtility.reversePoints(
                        pLinePoints,
                        vblSaveCounter);

                    if (dMBR / 15 > arraysupport.maxLength * DPIScaleFactor) {
                        dMBR = 15 * arraysupport.maxLength * DPIScaleFactor;
                    }
                    if (dMBR / 15 < arraysupport.minLength * DPIScaleFactor) {
                        dMBR = 15 * arraysupport.minLength * DPIScaleFactor;
                    }
                    if (dMBR < 100 * DPIScaleFactor) {
                        dMBR = 100 * DPIScaleFactor;
                    }
                    if (dMBR > 500 * DPIScaleFactor) {
                        dMBR = 500 * DPIScaleFactor;
                    }

                    //make tail larger 6-10-11 m. Deutch
                    pLinePoints[0] = LineUtility.ExtendLineDouble(pLinePoints[1], pLinePoints[0], -dMBR / 8.75);

                    pLinePoints[vblCounter - 15].style = 5;
                    pt0 = LineUtility.ExtendLineDouble(pLinePoints[1], pLinePoints[0], dMBR / 4);

                    LineUtility.GetArrowHead4Double(pt0, pLinePoints[0], Math.trunc(dMBR / 20), Math.trunc(dMBR / 20),
                        pArrowPoints, 0);

                    for (k = 0; k < 3; k++) {
                        pLinePoints[vblCounter - 14 + k] = new POINT2(pArrowPoints[k]);
                    }

                    pLinePoints[vblCounter - 12].style = 0;

                    //make tail larger 6-10-11 m. Deutch
                    pt3 = LineUtility.ExtendLineDouble(pLinePoints[1], pLinePoints[0], dMBR / 15);

                    LineUtility.GetArrowHead4Double(pt0, pt3, Math.trunc(dMBR / 20), Math.trunc(dMBR / 20), pArrowPoints, 0);

                    for (k = 0; k < 3; k++) {
                        pLinePoints[vblCounter - 11 + k] = new POINT2(pArrowPoints[2 - k]);
                        pLinePoints[vblCounter - 11 + k].style = 0;
                    }
                    pLinePoints[vblCounter - 8] = new POINT2(pLinePoints[vblCounter - 14]);
                    pLinePoints[vblCounter - 8].style = 5;

                    LineUtility.GetArrowHead4Double(pLinePoints[vblCounter - 16], pLinePoints[vblCounter - 15], Math.trunc(dMBR / 20), Math.trunc(dMBR / 20), pArrowPoints, 9);

                    for (k = 0; k < 3; k++) {
                        pLinePoints[vblCounter - 7 + k] = new POINT2(pArrowPoints[k]);
                    }
                    for (k = 4; k > 0; k--) {
                        pLinePoints[vblCounter - k].style = 5;
                    }
                    acCounter = 12;
                    break;
                }

                case TacticalLines.FERRY: {
                    lLinestyle = 9;
                    if (dMBR / 10 > arraysupport.maxLength * DPIScaleFactor) {
                        dMBR = 10 * arraysupport.maxLength * DPIScaleFactor;
                    }
                    if (dMBR / 10 < arraysupport.minLength * DPIScaleFactor) {
                        dMBR = 10 * arraysupport.minLength * DPIScaleFactor;
                    }
                    if (dMBR > 250 * DPIScaleFactor) {
                        dMBR = 250 * DPIScaleFactor;
                    }

                    LineUtility.GetArrowHead4Double(pLinePoints[vblCounter - 8], pLinePoints[vblCounter - 7], Math.trunc(dMBR / 10), Math.trunc(dMBR / 10), pArrowPoints, lLinestyle);
                    for (k = 0; k < 3; k++) {
                        pLinePoints[vblCounter - 6 + k] = new POINT2(pArrowPoints[k]);
                    }
                    LineUtility.GetArrowHead4Double(pLinePoints[1], pLinePoints[0], Math.trunc(dMBR / 10), Math.trunc(dMBR / 10), pArrowPoints, lLinestyle);
                    for (k = 0; k < 3; k++) {
                        pLinePoints[vblCounter - 3 + k] = new POINT2(pArrowPoints[k]);
                    }

                    acCounter = 8;
                    break;
                }

                case TacticalLines.NAVIGATION: {
                    let extensionLength: number = arraysupport.getScaledSize(10, tg.lineThickness, tg.patternScale);
                    pt3 = LineUtility.extendLine(pt1, pt0, -extensionLength, 0);
                    pt4 = LineUtility.extendLine(pt0, pt1, -extensionLength, 0);

                    pt5 = LineUtility.extendTrueLinePerp(pt0, pt1, pt3, extensionLength, 0);
                    pt6 = LineUtility.extendTrueLinePerp(pt0, pt1, pt3, -extensionLength, 0);
                    pt7 = LineUtility.extendTrueLinePerp(pt0, pt1, pt4, extensionLength, 0);
                    pt8 = LineUtility.extendTrueLinePerp(pt0, pt1, pt4, -extensionLength, 0);
                    if (pt5.y < pt6.y) {
                        pLinePoints[0] = new POINT2(pt5);
                    } else {
                        pLinePoints[0] = new POINT2(pt6);
                    }
                    if (pt7.y > pt8.y) {
                        pLinePoints[3] = new POINT2(pt7);
                    } else {
                        pLinePoints[3] = new POINT2(pt8);
                    }
                    pLinePoints[1] = new POINT2(pt0);
                    pLinePoints[2] = new POINT2(pt1);
                    acCounter = 4;
                    break;
                }

                case TacticalLines.FORTL: {
                    acCounter = arraysupport.GetFORTLPointsDouble(tg, pLinePoints, vblSaveCounter);
                    break;
                }

                case TacticalLines.CANALIZE: {
                    acCounter = DISMSupport.GetDISMCanalizeDouble(pLinePoints, lineType);
                    break;
                }

                case TacticalLines.BREACH: {
                    acCounter = DISMSupport.GetDISMBreachDouble(pLinePoints, lineType);
                    break;
                }

                case TacticalLines.SCREEN:
                case TacticalLines.GUARD:
                case TacticalLines.COVER: {
                    if (vblSaveCounter === 4) {
                        acCounter = DISMSupport.GetDISMCoverDoubleRevC(pLinePoints, lineType, vblSaveCounter);
                    } else {
                        acCounter = DISMSupport.GetDISMCoverDouble(pLinePoints, lineType);
                    }
                    break;
                }

                case TacticalLines.SARA: {
                    acCounter = DISMSupport.GetDISMCoverDouble(pLinePoints, lineType);
                    //reorder pLinePoints
                    let saraPts: POINT2[] = new Array<POINT2>(16);
                    for (j = 0; j < 4; j++) {
                        saraPts[j] = pLinePoints[j];  //0-3
                    }
                    for (j = 4; j < 8; j++) {
                        saraPts[j] = pLinePoints[j + 4];    //8-11
                    }
                    for (j = 8; j < 12; j++) {
                        saraPts[j] = pLinePoints[j - 4];    //4-7
                    }
                    for (j = 12; j < 16; j++) {
                        saraPts[j] = pLinePoints[j];  //12-15
                    }
                    pLinePoints = saraPts;
                    //acCounter=14;
                    break;
                }

                case TacticalLines.DISRUPT: {
                    acCounter = DISMSupport.GetDISMDisruptDouble(pLinePoints, lineType);
                    break;
                }

                case TacticalLines.CONTAIN: {
                    acCounter = DISMSupport.GetDISMContainDouble(pLinePoints, lineType);
                    break;
                }

                case TacticalLines.PENETRATE: {
                    DISMSupport.GetDISMPenetrateDouble(pLinePoints, lineType);
                    acCounter = 7;
                    break;
                }

                case TacticalLines.MNFLDBLK:
                case TacticalLines.BLOCK: {
                    DISMSupport.GetDISMBlockDouble2(
                        pLinePoints,
                        lineType);
                    acCounter = 4;
                    break;
                }

                case TacticalLines.LINTGT:
                case TacticalLines.LINTGTS:
                case TacticalLines.FPF: {
                    acCounter = DISMSupport.GetDISMLinearTargetDouble(pLinePoints, lineType, vblCounter);
                    break;
                }

                case TacticalLines.GAP:
                case TacticalLines.ASLTXING: {
                    DISMSupport.GetDISMGapDouble(
                        pLinePoints,
                        lineType);
                    acCounter = 12;
                    break;
                }

                case TacticalLines.MNFLDDIS: {
                    acCounter = DISMSupport.GetDISMMinefieldDisruptDouble(pLinePoints, lineType);
                    break;
                }

                case TacticalLines.SPTBYFIRE: {
                    acCounter = DISMSupport.GetDISMSupportByFireDouble(pLinePoints, lineType);
                    break;
                }

                case TacticalLines.ATKBYFIRE: {
                    acCounter = DISMSupport.GetDISMATKBYFIREDouble(pLinePoints, lineType);
                    break;
                }

                case TacticalLines.BYIMP: {
                    acCounter = DISMSupport.GetDISMByImpDouble(pLinePoints, lineType);
                    break;
                }

                case TacticalLines.CLEAR: {
                    acCounter = DISMSupport.GetDISMClearDouble(pLinePoints, lineType);
                    break;
                }

                case TacticalLines.BYDIF: {
                    acCounter = DISMSupport.GetDISMByDifDouble(pLinePoints, lineType, clipBounds);
                    break;
                }

                case TacticalLines.SEIZE:
                case TacticalLines.EVACUATE: {
                    let radius: number = 0;
                    if (vblSaveCounter === 4) {
                        radius = LineUtility.calcDistance(pLinePoints[0], pLinePoints[1]);
                        pLinePoints[1] = new POINT2(pLinePoints[3]);
                        pLinePoints[2] = new POINT2(pLinePoints[2]);
                    }
                    acCounter = DISMSupport.GetDISMSeizeDouble(pLinePoints, lineType, radius);
                    break;
                }

                case TacticalLines.FIX:
                case TacticalLines.MNFLDFIX: {
                    acCounter = DISMSupport.GetDISMFixDouble(pLinePoints, lineType, clipBounds);
                    break;
                }

                case TacticalLines.RIP:
                case TacticalLines.DEMONSTRATE: {
                    acCounter = DISMSupport.GetDISMRIPDouble(pLinePoints, lineType);
                    break;
                }

                case TacticalLines.MOBILE_DEFENSE: {
                    pLinePoints[2] = LineUtility.PointRelativeToLine(pt0, pt1, pt1, pt2);
                    pLinePoints[3] =  LineUtility.PointRelativeToLine(pt0, pt1, pt0, pt2);
                    acCounter = DISMSupport.GetDISMRIPDouble(pLinePoints, lineType);
                    // Add spikes
                    let trianglePts = new Array<POINT2>(18);
                    LineUtility.InitializePOINT2Array(trianglePts);
                    let l: number = 0;
                    dRadius = LineUtility.calcDistance(pLinePoints[1], pLinePoints[2]) / 2;
                    let arcCenter: POINT2 = LineUtility.midPoint(pLinePoints[1], pLinePoints[2], 0);
                    let dLength: number = Math.abs(dRadius - 20);
                    if (dRadius < 40) {
                        dLength = dRadius / 1.5;
                    }
                    if (dRadius > 100) {
                        dLength = 0.8 * dRadius;
                    }

                    let tmpPt = new POINT2();
                    tmpPt.x = arcCenter.x - ((dRadius / dLength) * (arcCenter.x - pLinePoints[10].x));
                    tmpPt.y = arcCenter.y - ((dRadius / dLength) * (arcCenter.y - pLinePoints[10].y));
                    trianglePts[l] = new POINT2(pLinePoints[10 - 1]);
                    trianglePts[l].style = 9;
                    l++;
                    trianglePts[l] = new POINT2(tmpPt);
                    trianglePts[l].style = 9;
                    l++;
                    trianglePts[l] = new POINT2(pLinePoints[10 + 1]);
                    trianglePts[l].style = 9;
                    l++;
                    trianglePts[l] = new POINT2(pLinePoints[10]);
                    trianglePts[l].style = 9;
                    l++;
                    trianglePts[l] = new POINT2(pLinePoints[10 - 1]);
                    trianglePts[l].style = 10;
                    l++;

                    tmpPt.x = arcCenter.x - ((dRadius / dLength) * (arcCenter.x - pLinePoints[22].x));
                    tmpPt.y = arcCenter.y - ((dRadius / dLength) * (arcCenter.y - pLinePoints[22].y));
                    trianglePts[l] = new POINT2(pLinePoints[22 - 1]);
                    trianglePts[l].style = 9;
                    l++;
                    trianglePts[l] = new POINT2(tmpPt);
                    trianglePts[l].style = 9;
                    l++;
                    trianglePts[l] = new POINT2(pLinePoints[22 + 1]);
                    trianglePts[l].style = 9;
                    l++;
                    trianglePts[l] = new POINT2(pLinePoints[22]);
                    trianglePts[l].style = 9;
                    l++;
                    trianglePts[l] = new POINT2(pLinePoints[22 - 1]);
                    trianglePts[l].style = 10;
                    l++;

                    let triangleBaseLen: number = LineUtility.calcDistance(trianglePts[0], trianglePts[2]);
                    let triangleHeight: number = LineUtility.calcDistance(trianglePts[1], trianglePts[3]);
                    trianglePts[l] = LineUtility.extendAlongLine(pLinePoints[3], pLinePoints[2], LineUtility.calcDistance(pt0, pt1) / 8, 9);
                    trianglePts[l].style = 9;
                    l++;

                    trianglePts[l] = LineUtility.extendAlongLine2(trianglePts[l-1], pLinePoints[2], triangleBaseLen);
                    trianglePts[l].style = 9;
                    l++;

                    trianglePts[l] = LineUtility.ExtendDirectedLine(trianglePts[l-2], trianglePts[l-1],
                            LineUtility.midPoint(trianglePts[l-2], trianglePts[l-1], 0), LineUtility.extend_above, triangleHeight);
                    trianglePts[l].style = 9;
                    l++;

                    trianglePts[l] = new POINT2(trianglePts[l-3]);
                    trianglePts[l].style = 10;
                    l++;

                    trianglePts[l] = LineUtility.extendAlongLine(pLinePoints[0], pLinePoints[1], LineUtility.calcDistance(pt0, pt1) / 8, 9);
                    trianglePts[l].style = 9;
                    l++;

                    trianglePts[l] = LineUtility.extendAlongLine2(trianglePts[l-1], pLinePoints[1], triangleBaseLen);
                    trianglePts[l].style = 9;
                    l++;

                    trianglePts[l] = LineUtility.ExtendDirectedLine(trianglePts[l-2], trianglePts[l-1],
                            LineUtility.midPoint(trianglePts[l-2], trianglePts[l-1], 0), LineUtility.extend_below, triangleHeight);
                    trianglePts[l].style = 9;
                    l++;

                    trianglePts[l] = new POINT2(trianglePts[l-3]);
                    trianglePts[l].style = 10;

                    for (j = 0; j < 18; j++) {
                        pLinePoints[acCounter] = new POINT2(trianglePts[j]);
                        acCounter++;
                    }
                    break;
                }

                case TacticalLines.DELAY:
                case TacticalLines.WITHDRAW:
                case TacticalLines.DISENGAGE:
                case TacticalLines.WDRAWUP:
                case TacticalLines.RETIRE:
                case TacticalLines.FPOL:
                case TacticalLines.RPOL:
                case TacticalLines.PURSUIT: {
                    acCounter = DISMSupport.GetDelayGraphicEtcDouble(pLinePoints, lineType);
                    break;
                }

                case TacticalLines.ENVELOPMENT: {
                    acCounter = DISMSupport.GetEnvelopmentGraphicDouble(pLinePoints);
                    break;
                }

                case TacticalLines.EASY: {
                    acCounter = DISMSupport.GetDISMEasyDouble(pLinePoints, lineType);
                    break;
                }

                case TacticalLines.BYPASS: {
                    acCounter = DISMSupport.GetDISMBypassDouble(pLinePoints, lineType);
                    break;
                }

                case TacticalLines.AMBUSH: {
                    acCounter = DISMSupport.AmbushPointsDouble(pLinePoints);
                    break;
                }

                case TacticalLines.FLOT: {
                    acCounter = flot.GetFlotDouble(pLinePoints, arraysupport.getScaledSize(20, tg.lineThickness, tg.patternScale), vblSaveCounter);
                    break;
                }

                default: {
                    acCounter = vblSaveCounter;
                    break;
                }

            }
            switch (lineType) {
                case TacticalLines.BOUNDARY: {
                    arraysupport.FillPoints(pLinePoints, acCounter, points);
                    return points;
                }

                case TacticalLines.CONTAIN:
                case TacticalLines.BLOCK:
                case TacticalLines.COVER:
                case TacticalLines.SCREEN:  //note: screen, cover, guard are getting their modifiers before the call to getlinearray
                case TacticalLines.GUARD:
                case TacticalLines.PAA_RECTANGULAR:
                case TacticalLines.RECTANGULAR_TARGET:
                case TacticalLines.FOLSP:
                case TacticalLines.FOLLA:
                //add these for rev c   3-12-12
                case TacticalLines.BREACH:
                case TacticalLines.BYPASS:
                case TacticalLines.CANALIZE:
                case TacticalLines.CLEAR:
                case TacticalLines.DISRUPT:
                case TacticalLines.FIX:
                case TacticalLines.ISOLATE:
                case TacticalLines.OCCUPY:
                case TacticalLines.PENETRATE:
                case TacticalLines.RETAIN:
                case TacticalLines.SECURE:
                case TacticalLines.AREA_DEFENSE:
                case TacticalLines.SEIZE:
                case TacticalLines.EVACUATE:
                case TacticalLines.TURN:
                case TacticalLines.BS_RECTANGLE:
                case TacticalLines.BBS_RECTANGLE:
                //add these
                case TacticalLines.AIRFIELD:
                case TacticalLines.CORDONKNOCK:
                case TacticalLines.CORDONSEARCH:
                case TacticalLines.MSDZ:
                case TacticalLines.CONVOY:
                case TacticalLines.HCONVOY:
                case TacticalLines.MFLANE:
                case TacticalLines.DIRATKAIR:
                case TacticalLines.ABATIS:
                case TacticalLines.MOBILE_DEFENSE:
                case TacticalLines.ENVELOPMENT: {
                    arraysupport.FillPoints(pLinePoints, acCounter, points);
                    break;
                }

                default: {
                    //if shapes is null then it is a non-CPOF client, dependent upon pixels
                    //instead of shapes
                    if (shapes == null) {
                        arraysupport.FillPoints(pLinePoints, acCounter, points);
                        return points;
                    }
                    break;
                }

            }

            //the shapes require pLinePoints
            //if the shapes are null then it is a non-CPOF client,
            if (shapes == null) {
                return points;
            }

            let shape: Shape2;
            let gp: Shape;
            let redShape: Shape2;
            let blueShape: Shape2;
            let paleBlueShape: Shape2;
            let whiteShape: Shape2;
            let redFillShape: Shape2;
            let blueFillShape: Shape2;
            let blackShape: Shape2;
            let blueStroke: BasicStroke;
            let paleBlueStroke: BasicStroke;
            let blueArea: Area;
            let paleBlueArea: Area;
            let whiteArea: Area;
            let beginLine: boolean = true;
            let poly: Polygon;
            let secondPoly: POINT2[];

            //a loop for the outline shapes
            switch (lineType) {
                case TacticalLines.PDF: {
                    // Lines
                    arraysupport.addPolyline(pLinePoints, 3, shapes);

                    // Rectangle
                    shape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                    shape.moveTo(pLinePoints[3]);
                    for (k = 4; k < 8; k++) {
                        shape.lineTo(pLinePoints[k]);
                    }
                    shapes.push(shape);

                    // Arrows
                    secondPoly = new Array<POINT2>(6);
                    for (let i: number = 0; i < 6; i++) {
                        secondPoly[i] = pLinePoints[i + 8];
                    }
                    arraysupport.addPolyline(secondPoly, 6, shapes);
                    break;
                }

                case TacticalLines.BBS_AREA:
                case TacticalLines.BBS_RECTANGLE: {
                    shape = new Shape2(Shape2.SHAPE_TYPE_FILL);
                    shape.moveTo(pLinePoints[0]);
                    for (j = 0; j < vblSaveCounter; j++) {
                        shape.lineTo(pLinePoints[j]);
                    }
                    shapes.push(shape);

                    shape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                    shape.moveTo(pOriginalLinePoints[0]);
                    for (j = 1; j < vblSaveCounter; j++) {
                        shape.lineTo(pOriginalLinePoints[j]);
                    }
                    shapes.push(shape);

                    break;
                }

                case TacticalLines.DIRATKGND: {
                    //create two shapes. the first shape is for the line
                    //the second shape is for the arrow
                    //renderer will know to use a skinny stroke for the arrow shape

                    //the line shape
                    shape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                    shape.moveTo(pLinePoints[0]);
                    for (j = 0; j < acCounter - 10; j++) {
                        shape.lineTo(pLinePoints[j]);
                    }

                    shapes.push(shape);

                    //the arrow shape
                    shape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                    shape.moveTo(pLinePoints[acCounter - 10]);

                    for (j = 9; j > 0; j--) {
                        if (pLinePoints[acCounter - j - 1].style === 5) {
                            shape.moveTo(pLinePoints[acCounter - j]);
                        } else {
                            shape.lineTo(pLinePoints[acCounter - j]);
                        }
                    }

                    shapes.push(shape);
                    break;
                }

                case TacticalLines.DEPTH_AREA: {
                    whiteShape = new Shape2(Shape2.SHAPE_TYPE_FILL);//use for symbol
                    whiteShape.setFillColor(Color.WHITE);
                    let whiteStroke: BasicStroke  = new BasicStroke(arraysupport.getScaledSize(28, tg.lineThickness, tg.patternScale));

                    blueShape = new Shape2(Shape2.SHAPE_TYPE_FILL);//use for symbol
                    blueShape.setFillColor(new Color(30, 144, 255));

                    paleBlueStroke = new BasicStroke(whiteStroke.getLineWidth() / 2);
                    paleBlueShape = new Shape2(Shape2.SHAPE_TYPE_FILL);//use for symbol
                    paleBlueShape.setFillColor(new Color(153, 204, 255));

                    poly = new Polygon();

                    for (k = 0; k < vblSaveCounter; k++) {
                        poly.addPoint(pLinePoints[k].x as number, pLinePoints[k].y as number);
                        if (k === 0) {
                            whiteShape.moveTo(pLinePoints[k]);
                        } else {
                            whiteShape.lineTo(pLinePoints[k]);
                        }
                    }

                    blueArea = new Area(poly);
                    blueShape.setShape(blueArea);

                    whiteArea = new Area(whiteStroke.createStrokedShape(poly));
                    whiteShape.setShape(LineUtility.createStrokedShape(whiteArea));

                    paleBlueArea = new Area(paleBlueStroke.createStrokedShape(poly));
                    paleBlueShape.setShape(LineUtility.createStrokedShape(paleBlueArea));

                    shapes.push(blueShape);
                    shapes.push(paleBlueShape);
                    shapes.push(whiteShape);
                    break;
                }

                case TacticalLines.TRAINING_AREA: {
                    redShape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);//use for outline
                    redShape.style = 1;
                    blueShape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);//use for symbol
                    blueShape.style = 0;

                    redShape.moveTo(pLinePoints[0]);
                    for (k = 1; k < vblSaveCounter; k++) {
                        redShape.lineTo(pLinePoints[k]);
                    }

                    beginLine = true;
                    for (k = vblSaveCounter; k < acCounter; k++) {
                        if (pLinePoints[k].style === 0) {
                            if (beginLine) {
                                blueShape.moveTo(pLinePoints[k]);
                                beginLine = false;
                            } else {
                                blueShape.lineTo(pLinePoints[k]);
                            }
                        }
                        if (pLinePoints[k].style === 5) {
                            blueShape.lineTo(pLinePoints[k]);
                            beginLine = true;
                        }
                    }
                    shapes.push(redShape);
                    shapes.push(blueShape);
                    break;
                }

                case TacticalLines.ITD: {
                    redShape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                    redShape.setLineColor(Color.RED);
                    blueShape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                    blueShape.setLineColor(Color.GREEN);
                    for (k = 0; k < acCounter - 1; k++) {
                        if (pLinePoints[k].style === 19 && pLinePoints[k + 1].style === 5) {
                            redShape.moveTo(pLinePoints[k]);
                            redShape.lineTo(pLinePoints[k + 1]);
                        } else {
                            if (pLinePoints[k].style === 25 && pLinePoints[k + 1].style === 5) {
                                blueShape.moveTo(pLinePoints[k]);
                                blueShape.lineTo(pLinePoints[k + 1]);
                            }
                        }

                    }
                    shapes.push(redShape);
                    shapes.push(blueShape);
                    tg.lineCap = BasicStroke.CAP_BUTT;
                    break;
                }

                case TacticalLines.SFY: {
                    redShape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                    redShape.setLineColor(Color.RED);
                    blueShape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                    blueShape.setLineColor(Color.BLUE);
                    //flots and spikes (triangles)
                    for (k = 0; k < acCounter - 1; k++) {
                        if (pLinePoints[k].style === 23) //red flots
                        {
                            redFillShape = new Shape2(Shape2.SHAPE_TYPE_FILL);    //1-3-12
                            redFillShape.setFillColor(Color.RED);
                            redFillShape.moveTo(pLinePoints[k - 9]);
                            for (let l: number = k - 8; l <= k; l++) {
                                redFillShape.lineTo(pLinePoints[l]);
                            }
                            shapes.push(redFillShape);   //1-3-12
                        }
                        if (pLinePoints[k].style === 24)//blue spikes
                        {
                            blueFillShape = new Shape2(Shape2.SHAPE_TYPE_FILL);   //1-3-12
                            blueFillShape.setFillColor(Color.BLUE);
                            blueFillShape.moveTo(pLinePoints[k - 2]);
                            blueFillShape.lineTo(pLinePoints[k - 1]);
                            blueFillShape.lineTo(pLinePoints[k]);
                            shapes.push(blueFillShape);  //1-3-12
                        }
                    }
                    //the corners
                    for (k = 0; k < vblSaveCounter; k++) {
                        if (k === 0) {
                            d = arraysupport.getScaledSize(50, tg.lineThickness, tg.patternScale);
                            redShape.moveTo(pOriginalLinePoints[0]);
                            d1 = LineUtility.calcDistance(pOriginalLinePoints[0], pOriginalLinePoints[1]);
                            if (d1 < d) {
                                d = d1;
                            }

                            pt0 = LineUtility.extendAlongLine(pOriginalLinePoints[0], pOriginalLinePoints[1], d);
                            redShape.lineTo(pt0);
                        } else {
                            if (k > 0 && k < vblSaveCounter - 1) {
                                d = arraysupport.getScaledSize(50, tg.lineThickness, tg.patternScale);
                                d1 = LineUtility.calcDistance(pOriginalLinePoints[k], pOriginalLinePoints[k - 1]);
                                if (d1 < d) {
                                    d = d1;
                                }

                                pt0 = LineUtility.extendAlongLine(pOriginalLinePoints[k], pOriginalLinePoints[k - 1], d);
                                pt1 = pOriginalLinePoints[k];

                                d = arraysupport.getScaledSize(50, tg.lineThickness, tg.patternScale);
                                d1 = LineUtility.calcDistance(pOriginalLinePoints[k], pOriginalLinePoints[k + 1]);
                                if (d1 < d) {
                                    d = d1;
                                }

                                pt2 = LineUtility.extendAlongLine(pOriginalLinePoints[k], pOriginalLinePoints[k + 1], d);
                                redShape.moveTo(pt0);
                                redShape.lineTo(pt1);
                                redShape.lineTo(pt2);
                            } else //last point
                            {
                                d = arraysupport.getScaledSize(50, tg.lineThickness, tg.patternScale);
                                d1 = LineUtility.calcDistance(pOriginalLinePoints[vblSaveCounter - 1], pOriginalLinePoints[vblSaveCounter - 2]);
                                if (d1 < d) {
                                    d = d1;
                                }

                                redShape.moveTo(pOriginalLinePoints[vblSaveCounter - 1]);
                                pt0 = LineUtility.extendAlongLine(pOriginalLinePoints[vblSaveCounter - 1], pOriginalLinePoints[vblSaveCounter - 2], d);
                                redShape.lineTo(pt0);
                            }
                        }

                    }
                    //red and blue short segments (between the flots)
                    for (k = 0; k < vblCounter - 1; k++) {
                        if (pLinePoints[k].style === 19 && pLinePoints[k + 1].style === 5) {
                            redShape.moveTo(pLinePoints[k]);
                            redShape.lineTo(pLinePoints[k + 1]);
                        } else {
                            if (pLinePoints[k].style === 25 && pLinePoints[k + 1].style === 5) {
                                blueShape.moveTo(pLinePoints[k]);
                                blueShape.lineTo(pLinePoints[k + 1]);
                            }
                        }

                    }
                    shapes.push(redShape);
                    shapes.push(blueShape);
                    break;
                }

                case TacticalLines.SFG: {
                    redShape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                    redShape.setLineColor(Color.RED);
                    blueShape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                    blueShape.setLineColor(Color.BLUE);
                    for (k = 0; k < acCounter - 1; k++) {
                        if (pLinePoints[k].style === 23) //red flots
                        {
                            redFillShape = new Shape2(Shape2.SHAPE_TYPE_FILL);    //1-3-12
                            redFillShape.setFillColor(Color.RED);
                            redFillShape.moveTo(pLinePoints[k - 9]);
                            for (let l: number = k - 8; l <= k; l++) {
                                redFillShape.lineTo(pLinePoints[l]);
                            }
                            shapes.push(redFillShape);   //1-3-12
                        }
                        if (pLinePoints[k].style === 24)//blue spikes red outline
                        {
                            blueFillShape = new Shape2(Shape2.SHAPE_TYPE_FILL);   //1-3-12
                            blueFillShape.setFillColor(Color.BLUE);
                            blueFillShape.moveTo(pLinePoints[k - 2]);
                            blueFillShape.lineTo(pLinePoints[k - 1]);
                            blueFillShape.lineTo(pLinePoints[k]);
                            shapes.push(blueFillShape);   //1-3-12
                        }
                    }
                    //the corners
                    for (k = 0; k < vblSaveCounter; k++) {
                        if (k === 0) {
                            d = arraysupport.getScaledSize(50, tg.lineThickness, tg.patternScale);
                            redShape.moveTo(pOriginalLinePoints[0]);
                            d1 = LineUtility.calcDistance(pOriginalLinePoints[0], pOriginalLinePoints[1]);
                            if (d1 < d) {
                                d = d1;
                            }

                            pt0 = LineUtility.extendAlongLine(pOriginalLinePoints[0], pOriginalLinePoints[1], d);
                            redShape.lineTo(pt0);
                        } else {
                            if (k > 0 && k < vblSaveCounter - 1) {
                                d = arraysupport.getScaledSize(50, tg.lineThickness, tg.patternScale);
                                d1 = LineUtility.calcDistance(pOriginalLinePoints[k], pOriginalLinePoints[k - 1]);
                                if (d1 < d) {
                                    d = d1;
                                }

                                pt0 = LineUtility.extendAlongLine(pOriginalLinePoints[k], pOriginalLinePoints[k - 1], d);
                                pt1 = pOriginalLinePoints[k];

                                d = arraysupport.getScaledSize(50, tg.lineThickness, tg.patternScale);
                                d1 = LineUtility.calcDistance(pOriginalLinePoints[k], pOriginalLinePoints[k + 1]);
                                if (d1 < d) {
                                    d = d1;
                                }

                                pt2 = LineUtility.extendAlongLine(pOriginalLinePoints[k], pOriginalLinePoints[k + 1], d);
                                redShape.moveTo(pt0);
                                redShape.lineTo(pt1);
                                redShape.lineTo(pt2);
                            } else //last point
                            {
                                d = arraysupport.getScaledSize(50, tg.lineThickness, tg.patternScale);
                                d1 = LineUtility.calcDistance(pOriginalLinePoints[vblSaveCounter - 1], pOriginalLinePoints[vblSaveCounter - 2]);
                                if (d1 < d) {
                                    d = d1;
                                }

                                redShape.moveTo(pOriginalLinePoints[vblSaveCounter - 1]);
                                pt0 = LineUtility.extendAlongLine(pOriginalLinePoints[vblSaveCounter - 1], pOriginalLinePoints[vblSaveCounter - 2], d);
                                redShape.lineTo(pt0);
                            }
                        }

                    }
                    shapes.push(redShape);
                    //the dots
                    for (k = 0; k < acCounter; k++) {
                        if (pLinePoints[k].style === 22) {
                            let CirclePoints: POINT2[] = new Array<POINT2>(8);
                            redShape = LineUtility.CalcCircleShape(pLinePoints[k], arraysupport.getScaledSize(3, tg.lineThickness, tg.patternScale), 8, CirclePoints, 9);
                            redShape.setFillColor(Color.RED);
                            if (redShape != null && redShape.getShape() != null) {
                                shapes.push(redShape);
                            }
                        }
                        if (pLinePoints[k].style === 20) {
                            let CirclePoints: POINT2[] = new Array<POINT2>(8);
                            blueShape = LineUtility.CalcCircleShape(pLinePoints[k], arraysupport.getScaledSize(3, tg.lineThickness, tg.patternScale), 8, CirclePoints, 9);
                            blueShape.setFillColor(Color.BLUE);
                            if (blueShape != null && blueShape.getShape() != null) {
                                shapes.push(blueShape);
                            }
                        }
                    }
                    break;
                }

                case TacticalLines.USF: {
                    redShape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                    redShape.setLineColor(Color.RED);
                    blueShape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                    blueShape.setLineColor(Color.BLUE);
                    beginLine = true;
                    //int color=0;//red
                    for (k = 0; k < acCounter - 1; k++) {
                        if (pLinePoints[k].style === 19 && pLinePoints[k + 1].style === 5) {
                            redShape.moveTo(pLinePoints[k]);
                            redShape.lineTo(pLinePoints[k + 1]);
                            //color=0;
                        }
                        if (pLinePoints[k].style === 19 && pLinePoints[k + 1].style === 19) {
                            redShape.moveTo(pLinePoints[k]);
                            redShape.lineTo(pLinePoints[k + 1]);
                            //color=0;
                        }
                        if (pLinePoints[k].style === 25 && pLinePoints[k + 1].style === 5) {
                            blueShape.moveTo(pLinePoints[k]);
                            blueShape.lineTo(pLinePoints[k + 1]);
                            //color=1;
                        }
                        if (pLinePoints[k].style === 25 && pLinePoints[k + 1].style === 25) {
                            blueShape.moveTo(pLinePoints[k]);
                            blueShape.lineTo(pLinePoints[k + 1]);
                            //color=1;
                        }
                        if (pLinePoints[k].style === 0 && pLinePoints[k + 1].style === 5) {
                            redShape.moveTo(pLinePoints[k]);
                            redShape.lineTo(pLinePoints[k + 1]);
                        }

                    }
                    shapes.push(redShape);
                    shapes.push(blueShape);
                    break;
                }

                case TacticalLines.SF: {
                    redShape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                    redShape.setLineColor(Color.RED);
                    blueShape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                    blueShape.setLineColor(Color.BLUE);
                    redFillShape = new Shape2(Shape2.SHAPE_TYPE_FILL);
                    redFillShape.setLineColor(Color.RED);
                    redFillShape.setFillColor(Color.RED);
                    blueFillShape = new Shape2(Shape2.SHAPE_TYPE_FILL);
                    blueFillShape.setLineColor(Color.BLUE);
                    blueFillShape.setFillColor(Color.BLUE);
                    for (k = 0; k < acCounter - 1; k++) {
                        if (pLinePoints[k].style === 19 && pLinePoints[k + 1].style === 5) {
                            redShape.moveTo(pLinePoints[k]);
                            redShape.lineTo(pLinePoints[k + 1]);
                        }
                        if (pLinePoints[k].style === 19 && pLinePoints[k + 1].style === 19) {
                            if (redFillShape.getPoints().length === 0) {
                                redFillShape.moveTo(pLinePoints[k + 9]);
                                for (let l: number = k + 9; l >= k; l--) {
                                    redFillShape.lineTo(pLinePoints[l]);
                                }
                            } else {
                                redFillShape.moveTo(pLinePoints[k]);
                                for (let l: number = k; l < k + 10; l++) {
                                    redFillShape.lineTo(pLinePoints[l]);
                                }
                            }

                            k += 9;
                            shapes.push(redFillShape);
                            redFillShape = new Shape2(Shape2.SHAPE_TYPE_FILL);
                            redFillShape.setLineColor(Color.RED);
                            redFillShape.setFillColor(Color.RED);
                        }
                        if (pLinePoints[k].style === 25 && pLinePoints[k + 1].style === 5) {
                            blueShape.moveTo(pLinePoints[k]);
                            blueShape.lineTo(pLinePoints[k + 1]);
                        }
                        if (pLinePoints[k].style === 25 && pLinePoints[k + 1].style === 25) {
                            if (blueFillShape.getPoints().length === 0) {
                                blueFillShape.moveTo(pLinePoints[k + 2]);
                                blueFillShape.lineTo(pLinePoints[k + 1]);
                                blueFillShape.lineTo(pLinePoints[k]);
                            } else {
                                blueFillShape.moveTo(pLinePoints[k]);
                                blueFillShape.lineTo(pLinePoints[k + 1]);
                                blueFillShape.lineTo(pLinePoints[k + 2]);
                            }
                            shapes.push(blueFillShape);
                            blueFillShape = new Shape2(Shape2.SHAPE_TYPE_FILL);
                            blueFillShape.setLineColor(Color.BLUE);
                            blueFillShape.setFillColor(Color.BLUE);
                        }
                        if (pLinePoints[k].style === 0 && pLinePoints[k + 1].style === 5) {
                            redShape.moveTo(pLinePoints[k]);
                            redShape.lineTo(pLinePoints[k + 1]);
                        }
                    }
                    shapes.push(redShape);
                    shapes.push(blueShape);
                    break;
                }

                case TacticalLines.WFG: {
                    shape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                    for (k = 0; k < acCounter - 1; k++) {
                        if (pLinePoints[k].style === 0 && pLinePoints[k + 1].style === 5) {
                            shape.moveTo(pLinePoints[k]);
                            shape.lineTo(pLinePoints[k + 1]);
                        }
                    }
                    shapes.push(shape);

                    //the dots
                    for (k = 0; k < acCounter; k++) {
                        if (pLinePoints[k].style === 20) {
                            let CirclePoints: POINT2[] = new Array<POINT2>(8);
                            shape = LineUtility.CalcCircleShape(pLinePoints[k], arraysupport.getScaledSize(3, tg.lineThickness, tg.patternScale), 8, CirclePoints, 9);
                            if (shape != null && shape.getShape() != null) {
                                shapes.push(shape);
                            }
                        }
                    }
                    break;
                }

                case TacticalLines.FOLLA: {
                    shape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                    shape.style = 1; //dashed line
                    shape.moveTo(pLinePoints[0]);
                    shape.lineTo(pLinePoints[1]);
                    shapes.push(shape);

                    shape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                    shape.style = 0; //dashed line
                    for (j = 2; j < vblCounter; j++) {
                        if (pLinePoints[j - 1].style !== 5) {
                            shape.lineTo(pLinePoints[j]);
                        } else {
                            shape.moveTo(pLinePoints[j]);
                        }
                    }
                    shapes.push(shape);
                    break;
                }

                case TacticalLines.CFG: {
                    for (k = 0; k < acCounter; k++) {
                        if (pLinePoints[k].style === 20) {
                            let CirclePoints: POINT2[] = new Array<POINT2>(8);
                            shape = LineUtility.CalcCircleShape(pLinePoints[k], arraysupport.getScaledSize(3, tg.lineThickness, tg.patternScale), 8, CirclePoints, 9);
                            if (shape != null && shape.getShape() != null) {
                                shapes.push(shape);
                            }
                            continue;
                        }
                    }
                    shape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                    for (k = 0; k < acCounter - 1; k++) {
                        if (pLinePoints[k].style === 0 && pLinePoints[k + 1].style === 0) {
                            shape.moveTo(pLinePoints[k]);
                            shape.lineTo(pLinePoints[k + 1]);
                        }
                        if (pLinePoints[k].style === 0 && pLinePoints[k + 1].style === 9) {
                            shape.moveTo(pLinePoints[k]);
                            shape.lineTo(pLinePoints[k + 1]);
                        }

                        if (pLinePoints[k].style === 0 && pLinePoints[k + 1].style === 5) {
                            d = LineUtility.calcDistance(pLinePoints[k], pLinePoints[k + 1]);
                            pt0 = LineUtility.extendAlongLine(pLinePoints[k], pLinePoints[k + 1], d - arraysupport.getScaledSize(5, tg.lineThickness, tg.patternScale));
                            shape.moveTo(pLinePoints[k]);
                            shape.lineTo(pt0);
                        }

                        if (pLinePoints[k].style === 0 && k === acCounter - 2) {
                            shape.moveTo(pLinePoints[k]);
                            shape.lineTo(pLinePoints[k + 1]);
                        }
                    }
                    shapes.push(shape);
                    break;
                }

                case TacticalLines.PIPE: {
                    for (k = 0; k < acCounter; k++) {
                        if (pLinePoints[k].style === 20) {
                            let CirclePoints: POINT2[] = new Array<POINT2>(8);
                            shape = LineUtility.CalcCircleShape(pLinePoints[k], arraysupport.getScaledSize(5, tg.lineThickness, tg.patternScale), 8, CirclePoints, 9);
                            if (shape != null && shape.getShape() != null) {
                                shapes.push(shape);
                            }
                        }
                    }
                    shape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                    for (k = 0; k < acCounter - 1; k++) {
                        if (pLinePoints[k].style === 0 && pLinePoints[k + 1].style === 5) {
                            shape.moveTo(pLinePoints[k]);
                            shape.lineTo(pLinePoints[k + 1]);
                        }
                    }
                    shapes.push(shape);
                    break;
                }

                case TacticalLines.ATDITCHM: {
                    for (k = 0; k < acCounter; k++) {
                        if (pLinePoints[k].style === 20) {
                            let CirclePoints: POINT2[] = new Array<POINT2>(8);
                            shape = LineUtility.CalcCircleShape(pLinePoints[k], arraysupport.getScaledSize(4, tg.lineThickness, tg.patternScale), 8, CirclePoints, 9);//was 3
                            if (shape != null && shape.getShape() != null) {
                                shapes.push(shape);
                            }
                            continue;
                        }
                        if (k < acCounter - 2) {
                            if (pLinePoints[k].style !== 0 && pLinePoints[k + 1].style === 0) {
                                shape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                                shape.style = pLinePoints[k].style;
                                shape.moveTo(pLinePoints[k]);
                                shape.lineTo(pLinePoints[k]);
                            } else {
                                if (pLinePoints[k].style === 0 && pLinePoints[k + 1].style === 0) {
                                    shape.moveTo(pLinePoints[k]);
                                    shape.lineTo(pLinePoints[k + 1]);
                                } else {
                                    if (pLinePoints[k].style === 0 && pLinePoints[k + 1].style === 10) {
                                        shape.moveTo(pLinePoints[k]);
                                        shape.lineTo(pLinePoints[k + 1]);
                                        shapes.push(shape);
                                    }
                                }

                            }

                        }
                        if (k < acCounter - 2) {
                            if (pLinePoints[k].style === 5 && pLinePoints[k + 1].style === 0) {
                                shape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                                shape.style = pLinePoints[k].style;
                                shape.moveTo(pLinePoints[k]);
                                //shape.lineTo(pLinePoints[k]);
                            } else {
                                if (pLinePoints[k].style === 0 && pLinePoints[k + 1].style === 0) {
                                    shape.lineTo(pLinePoints[k + 1]);
                                } else {
                                    if (pLinePoints[k].style === 0 && pLinePoints[k + 1].style === 5) {
                                        shape.lineTo(pLinePoints[k + 1]);
                                        shapes.push(shape);
                                    }
                                }

                            }

                        }
                    }//end for
                    break;
                }

                case TacticalLines.ESR1: {
                    shape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                    shape.style = pLinePoints[0].style;
                    shape.moveTo(pLinePoints[0]);
                    shape.lineTo(pLinePoints[1]);
                    //if(shape !=null && shape.get_Shape() != null)
                    shapes.push(shape);
                    shape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                    shape.style = pLinePoints[2].style;
                    shape.moveTo(pLinePoints[2]);
                    shape.lineTo(pLinePoints[3]);
                    //if(shape !=null && shape.get_Shape() != null)
                    shapes.push(shape);
                    break;
                }

                case TacticalLines.FORDIF: {
                    shape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                    shape.style = pLinePoints[0].style;
                    shape.moveTo(pLinePoints[0]);
                    shape.lineTo(pLinePoints[1]);
                    shape.moveTo(pLinePoints[2]);
                    shape.lineTo(pLinePoints[3]);
                    shapes.push(shape);
                    shape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                    shape.style = pLinePoints[4].style;
                    shape.moveTo(pLinePoints[4]);
                    for (k = 5; k < acCounter; k++) {
                        if (pLinePoints[k - 1].style !== 5) {
                            shape.lineTo(pLinePoints[k]);
                        }
                    }

                    if (shape != null && shape.getShape() != null) {
                        shapes.push(shape);
                    }
                    break;
                }

                case TacticalLines.FENCED: {
                    //first shape is the original points
                    shape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                    shape.style = points[0].style;
                    shape.moveTo(points[0]);
                    for (k = 1; k < vblCounter; k++) {
                        shape.lineTo(points[k]);
                    }
                    if (shape != null && shape.getShape() != null) {
                        shapes.push(shape);
                    }

                    //second shape are the xpoints
                    shape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                    beginLine = true;
                    for (k = vblCounter; k < points.length; k++) {
                        if (beginLine) {
                            if (k === 0) {
                                shape.style = points[k].style;
                            }

                            if (k > 0) //doubled points with linestyle=5
                            {
                                if (points[k].style === 5 && points[k - 1].style === 5) {
                                    shape.lineTo(points[k]);
                                }
                            }

                            shape.moveTo(points[k]);
                            beginLine = false;
                        } else {
                            shape.lineTo(points[k]);
                            if (points[k].style === 5 || points[k].style === 10) {
                                beginLine = true;
                                //unless there are doubled points with style=5
                            }
                        }
                        if (k === points.length - 1) //non-LC should only have one shape
                        {
                            if (shape != null && shape.getShape() != null) {
                                shapes.push(shape);
                            }
                        }
                    }
                    break;
                }

                case TacticalLines.AIRFIELD: {
                    shape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                    shape.moveTo(pLinePoints[0]);
                    for (k = 1; k < acCounter - 5; k++) {
                        shape.lineTo(pLinePoints[k]);
                    }

                    shapes.push(shape);

                    shape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                    shape.moveTo(pLinePoints[acCounter - 4]);
                    shape.lineTo(pLinePoints[acCounter - 3]);
                    shape.moveTo(pLinePoints[acCounter - 2]);
                    shape.lineTo(pLinePoints[acCounter - 1]);
                    shapes.push(shape);
                    break;
                }

                case TacticalLines.STRIKWARN: {
                    let midPointIndex = Math.trunc(acCounter / 2);
                    arraysupport.addPolyline(pLinePoints, midPointIndex, shapes);
                    secondPoly = new Array<POINT2>(midPointIndex);
                    for (let i: number = 0; i < midPointIndex; i++) {
                        secondPoly[i] = pLinePoints[i + midPointIndex];
                    }
                    arraysupport.addPolyline(secondPoly, midPointIndex, shapes);
                    break;
                }

                case TacticalLines.DIRATKAIR: {
                    secondPoly = new Array<POINT2>(9);
                    for (let i: number = 0; i < 4; i++) {
                        secondPoly[i] = pLinePoints[pLinePoints.length - 4 + i];
                    }
                    arraysupport.addPolyline(secondPoly, 4, shapes); // Main line
                    arraysupport.addPolyline(pLinePoints, acCounter - 13, shapes); // Main line extension
                    for (let i: number = 0; i < 9; i++) {
                        secondPoly[i] = pLinePoints[pLinePoints.length - 13 + i];
                    }
                    arraysupport.addPolyline(secondPoly, 9, shapes); // Arrow and bowtie
                    break;
                }

                case TacticalLines.DIRATKSPT:
                case TacticalLines.INFILTRATION: {
                    arraysupport.addPolyline(pLinePoints, acCounter - 3, shapes); // Main line
                    secondPoly = new Array<POINT2>(3);
                    for (let i: number = 0; i < 3; i++) {
                        secondPoly[i] = pLinePoints[pLinePoints.length - 3 + i];
                    }
                    arraysupport.addPolyline(secondPoly, 3, shapes); // Arrow
                    break;
                }

                case TacticalLines.EXPLOIT: {
                    arraysupport.addPolyline(pLinePoints, 2, shapes); // Main line
                    secondPoly = new Array<POINT2>(3);
                    for (let i = 0; i < 3; i++) {
                        secondPoly[i] = pLinePoints[i + 2];
                    }
                    arraysupport.addPolyline(secondPoly, 3, shapes); // Arrow at pt1
                    secondPoly = new Array<POINT2>(3);
                    for (let i = 0; i < 3; i++) {
                        secondPoly[i] = pLinePoints[i + 5];
                    }
                    arraysupport.addPolyline(secondPoly, 3, shapes); // Dashed tail at pt2
                    break;
                }

                default: {
                    arraysupport.addPolyline(pLinePoints, acCounter, shapes);
                    break;
                }

            }//end switch
            //a loop for arrowheads with fill
            //these require a separate shape for fill
            switch (lineType) {
                case TacticalLines.AC:
                case TacticalLines.SAAFR:
                case TacticalLines.MRR:
                case TacticalLines.SL:
                case TacticalLines.TC:
                case TacticalLines.SC:
                case TacticalLines.LLTR: {
                    for (j = 0; j < vblSaveCounter - 1; j++) {
                        dMBR = pOriginalLinePoints[j].style;
                        acPoints[0] = new POINT2(pOriginalLinePoints[j]);
                        acPoints[1] = new POINT2(pOriginalLinePoints[j + 1]);
                        LineUtility.GetSAAFRFillSegment(acPoints, dMBR);//was dMRR
                        shape = new Shape2(Shape2.SHAPE_TYPE_FILL);
                        shape.moveTo(acPoints[0]);
                        shape.lineTo(acPoints[1]);
                        shape.lineTo(acPoints[2]);
                        shape.lineTo(acPoints[3]);
                        shapes.splice(0, 0, shape);
                    }
                    break;
                }

                case TacticalLines.DIRATKAIR: {
                    //added this section to not fill the bow tie and instead
                    //add a shape to close what had been the bow tie fill areas with
                    //a line segment for each one
                    let outLineCounter: number = 0;
                    let ptOutline: POINT2[] = new Array<POINT2>(4);
                    for (k = 0; k < acCounter; k++) {
                        if (pLinePoints[k].style === 10) {
                            shape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
                            shape.moveTo(pLinePoints[k - 2]);
                            shape.lineTo(pLinePoints[k]);
                            if (shape != null && shape.getShape() != null) {
                                shapes.push(shape);
                            }

                            //collect these four points
                            ptOutline[outLineCounter++] = pLinePoints[k - 2];
                            ptOutline[outLineCounter++] = pLinePoints[k];
                        }
                    }//end for
                    break;
                }

                case TacticalLines.OFY:
                case TacticalLines.OCCLUDED:
                case TacticalLines.WF:
                case TacticalLines.WFG:
                case TacticalLines.WFY:
                case TacticalLines.CF:
                case TacticalLines.CFY:
                case TacticalLines.CFG:
                case TacticalLines.SARA:
                case TacticalLines.FERRY:
                case TacticalLines.EASY:
                case TacticalLines.BYDIF:
                case TacticalLines.BYIMP:
                case TacticalLines.FOLSP:
                case TacticalLines.ATDITCHC:
                case TacticalLines.ATDITCHM:
                case TacticalLines.MNFLDFIX:
                case TacticalLines.TURN_REVD:
                case TacticalLines.TURN:
                case TacticalLines.MNFLDDIS:
                case TacticalLines.AREA_DEFENSE:
                case TacticalLines.MOBILE_DEFENSE: {
                    //POINT2 initialFillPt=null;
                    for (k = 0; k < acCounter; k++) {
                        if (k === 0) {
                            if (pLinePoints[k].style === 9) {
                                shape = new Shape2(Shape2.SHAPE_TYPE_FILL);
                                shape.style = pLinePoints[k].style;
                                shape.moveTo(pLinePoints[k]);
                            }
                        } else //k>0
                        {
                            if (pLinePoints[k].style === 9 && pLinePoints[k - 1].style !== 9) {
                                shape = new Shape2(Shape2.SHAPE_TYPE_FILL);
                                shape.style = pLinePoints[k].style;
                                shape.moveTo(pLinePoints[k]);
                            }
                            if (pLinePoints[k].style === 9 && pLinePoints[k - 1].style === 9) //9,9,...,9,10
                            {
                                shape.lineTo(pLinePoints[k]);
                            }
                        }
                        if (pLinePoints[k].style === 10) {
                            shape.lineTo(pLinePoints[k]);
                            if (shape != null && shape.getShape() != null) {
                                if (lineType == TacticalLines.AREA_DEFENSE)
                                    shapes.push(shape);
                                else
                                    shapes.splice(0, 0, shape);
                            }
                        }
                    }//end for
                    break;
                }

                default: {
                    break;
                }

            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(arraysupport._className, "GetLineArray2Double",
                    exc);
            } else {
                throw exc;
            }
        }
        return points;
    }

    private static addPolyline(pLinePoints: POINT2[], acCounter: number, shapes: Array<Shape2>): void {
        let shape: Shape2 | null = null;
        let beginLine: boolean = true;
        for (let k: number = 0; k < acCounter; k++) {
            //use shapes instead of pixels
            if (shape == null) {
                shape = new Shape2(Shape2.SHAPE_TYPE_POLYLINE);
            }

            if (beginLine) {

                if (k === 0) {
                    shape.style = pLinePoints[k].style;
                }

                if (k > 0) //doubled points with linestyle=5
                {
                    if (pLinePoints[k].style === 5 && pLinePoints[k - 1].style === 5 && k < acCounter - 1) {
                        continue;
                    } else {
                        if (pLinePoints[k].style === 5 && pLinePoints[k - 1].style === 10) //CF
                        {
                            continue;
                        }
                    }

                }

                if (k === 0 && pLinePoints.length > 1) {
                    if (pLinePoints[k].style === 5 && pLinePoints[k + 1].style === 5) {
                        continue;
                    }
                }

                shape.moveTo(pLinePoints[k]);
                beginLine = false;
            } else {
                shape.lineTo(pLinePoints[k]);
                if (pLinePoints[k].style === 5 || pLinePoints[k].style === 10) {
                    beginLine = true;
                    //unless there are doubled points with style=5
                }
            }
            if (k === acCounter - 1) //non-LC should only have one shape
            {
                if (shape != null && shape.getShape() != null) {
                    shapes.push(shape);
                }
            }
        }//end for
    }

    /**
     * Returns which side of the line segment the arrow(s) go on for supply routes
     */
    public static SupplyRouteArrowSide(pt0: POINT2, pt1: POINT2): number {
        const { result: bolVertical, slope: mVal } = LineUtility.calcTrueSlope(pt0, pt1);
        if (pt0.x < pt1.x) {
            if (mVal < 1) {
                return 2;
            }
            if (mVal >= 1) {
                return 1;
            }
        } else {
            if (pt0.x > pt1.x) {
                if (mVal < 1) {
                    return 3;
                }
                if (mVal >= 1) {
                    return 0;
                }
            } else {
                if (bolVertical === 0) {
                    if (pt0.y > pt1.y) {
                        return 0;
                    } else {
                        return 1;
                    }
                }
            }

        }

        return 0;
    }

    public static getScaledSize(originalSize: number, lineWidth: number, patternScale: number): number {
        if (lineWidth <= 3) { // Default line width
            return originalSize;
        } else if (lineWidth > 100) {
            lineWidth = 100; // Max scale size
        }
        return originalSize * (1 + ((lineWidth - 3) / 2) * patternScale);
    }
}
