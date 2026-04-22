import { arraysupport } from "./line-generator"
import { Channels } from "./channel-generator"
import { countsupport } from "./count-calculator"
import { flot } from "./flotation-generator"
import { LineUtility } from "../math/line-ops"
import { POINT2 } from "../types/point"
import { TacticalLines } from "../types/enums"
import { TacticalGraphic } from "../tactical/tactical-graphic"
import { ErrorLogger } from "../renderer/utilities/ErrorLogger"

/**
 * A class for the interface between the points calculation CELineArray and
 * the tactical renderer.
 *
 *
 */
export class CELineArray {
    private static readonly _className: string = "CELineArray";
    /**
    * public function to return the line count required for all of the symbols
    *
    * @param plArrayOfLongs the client points as an array of POINT2 in pixels.
    * @param lElements the number of client points.
    * @param ChannelWidth the chanel width in pixels
    *
    * @return the number of points which will be required for the symbol.
    */
    public static CGetLineCountDouble(tg: TacticalGraphic,
        plArrayOfLongs: number[],
        lElements: number, //number of points
        ChannelWidth: number): number {
        let lResult: number = 0;
        try {
            //declarations
            let lPtrcntr: number = 0;
            let lLowerFlotCount: number = 0;
            let lUpperFlotCount: number = 0;
            let pLinePoints: POINT2[] = new Array<POINT2>(lElements);
            let pLowerLinePoints: POINT2[] = new Array<POINT2>(lElements);
            let
                pUpperLinePoints: POINT2[] = new Array<POINT2>(lElements);
            let
                pUpperLowerLinePoints: POINT2[] = new Array<POINT2>(2 * lElements + 2);
            let i: number = 0;
            //end declarations

            if (lElements <= 0) {
                return -1;
            }

            LineUtility.InitializePOINT2Array(pLinePoints);
            LineUtility.InitializePOINT2Array(pUpperLinePoints);
            LineUtility.InitializePOINT2Array(pLowerLinePoints);
            for (i = 0; i < lElements; i++) {
                pLinePoints[i].x = plArrayOfLongs[lPtrcntr];
                lPtrcntr++;
                pLinePoints[i].y = plArrayOfLongs[lPtrcntr];
                lPtrcntr++;
            }
            for (i = 0; i < lElements; i++) {
                pLowerLinePoints[i] = new POINT2(pLinePoints[i]);
                pUpperLinePoints[i] = new POINT2(pLinePoints[i]);
            }

            switch (tg.lineType) {
                case TacticalLines.CHANNEL:
                case TacticalLines.CHANNEL_FLARED:
                case TacticalLines.CHANNEL_DASHED: {
                    lResult = 2 * lElements;
                    break;
                }

                case TacticalLines.MAIN:
                case TacticalLines.MAIN_STRAIGHT:
                case TacticalLines.AIRAOA:
                case TacticalLines.SPT:
                case TacticalLines.SPT_STRAIGHT: {
                    //points for these need not be bounded
                    //they have an extra 8 points for the arrowhead
                    lResult = 2 * lElements + 8;
                    break;
                }

                case TacticalLines.FRONTAL_ATTACK: {
                    lResult = 2 * lElements + 15;
                    break;
                }

                case TacticalLines.TURNING_MOVEMENT: {
                    lResult = 2 * lElements + 14;
                    break;
                }

                case TacticalLines.MOVEMENT_TO_CONTACT: {
                    lResult = 2 * lElements + 24;
                    break;
                }

                case TacticalLines.CATK: {
                    lResult = 2 * lElements + 8;
                    break;
                }

                case TacticalLines.CATKBYFIRE: {
                    lResult = 2 * lElements + 17;
                    break;
                }

                case TacticalLines.AAAAA: {
                    lResult = 2 * lElements + 19;
                    break;
                }

                case TacticalLines.LC: {
                    pUpperLinePoints = Channels.GetChannelArray2Double(1, pUpperLinePoints, 1, lElements, tg.lineType, ChannelWidth);
                    pLowerLinePoints = Channels.GetChannelArray2Double(1, pLowerLinePoints, 0, lElements, tg.lineType, ChannelWidth);
                    lUpperFlotCount = flot.GetFlotCountDouble(pUpperLinePoints, arraysupport.getScaledSize(20, tg.lineThickness, tg.patternScale), lElements);
                    lLowerFlotCount = flot.GetFlotCountDouble(pLowerLinePoints, arraysupport.getScaledSize(20, tg.lineThickness, tg.patternScale), lElements);
                    lResult = lUpperFlotCount + lLowerFlotCount;
                    break;
                }

                default: {
                    //call GetCountersDouble for the remaining line types.
                    lResult = countsupport.GetCountersDouble(tg, lElements, pLinePoints, null);
                    break;
                }

            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(CELineArray._className, "CGetLineCountDouble",
                    exc);
            } else {
                throw exc;
            }
        }
        return (lResult);
    }
    /**
     * Return true is the line type is a channel type
     * @param lineType line type
     * @return
     */
    public static CIsChannel(lineType: number): number {
        let lResult: number = 0;
        try {
            switch (lineType) {
                case TacticalLines.CATK:
                case TacticalLines.CATKBYFIRE:
                case TacticalLines.LC:
                case TacticalLines.AIRAOA:
                case TacticalLines.AAAAA:
                case TacticalLines.MAIN:
                case TacticalLines.MAIN_STRAIGHT:
                case TacticalLines.SPT:
                case TacticalLines.SPT_STRAIGHT:
                case TacticalLines.FRONTAL_ATTACK:
                case TacticalLines.TURNING_MOVEMENT:
                case TacticalLines.MOVEMENT_TO_CONTACT:
                case TacticalLines.UNSP:
                case TacticalLines.SFENCE:
                case TacticalLines.DFENCE:
                case TacticalLines.DOUBLEA:
                case TacticalLines.LWFENCE:
                case TacticalLines.HWFENCE:
                case TacticalLines.BBS_LINE:
                case TacticalLines.SINGLEC:
                case TacticalLines.DOUBLEC:
                case TacticalLines.TRIPLE:
                case TacticalLines.CHANNEL:
                case TacticalLines.CHANNEL_FLARED:
                case TacticalLines.CHANNEL_DASHED: {
                    lResult = 1;
                    break;
                }

                default: {
                    lResult = 0;
                    break;
                }

            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(CELineArray._className, "CIsChannel",
                    exc);
            } else {
                throw exc;
            }
        }
        return lResult;
    }
    private static _client: string = "";
    public static setClient(value: string): void {
        CELineArray._client = value;
        Channels.setClient(value);
    }
    public static getClient(): string {
        return CELineArray._client;
    }
    //    public static void setMinLength(double value)
    //    {
    //        DISMSupport.setMinLength(value);
    //        arraysupport.setMinLength(value);
    //        countsupport.setMinLength(value);
    //        return;
    //    }
}
