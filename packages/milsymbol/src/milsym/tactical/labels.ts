import { ErrorLogger } from "../renderer/utilities/ErrorLogger"
import { SymbolID } from "../renderer/utilities/SymbolID"
import { POINT2 } from "../types/point"
import { TacticalLines } from "../types/enums"
import { TacticalGraphic } from "./tactical-graphic"

const _className: string = "Modifier2";

/**
 * Returns true if the line segment pt0->pt1 doubles back relative to pt1->pt2
 */
function doublesBack(pt0: POINT2, pt1: POINT2, pt2: POINT2): boolean {
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
            ErrorLogger.LogException(_className, "DoublesBack",
                exc);
        } else {
            throw exc;
        }
    }
    return result;
}

/**
 * Returns a generic label for the symbol per Mil-Std-2525
 *
 * @param tg
 * @return
 */
export function getCenterLabel(tg: TacticalGraphic): string {
    let label: string = "";
    try {
        switch (tg.lineType) {
            case TacticalLines.SHIP_AOI_RECTANGULAR:
            case TacticalLines.SHIP_AOI_CIRCULAR: {
                label = "AOI";
                break;
            }

            case TacticalLines.DEFENDED_AREA_RECTANGULAR:
            case TacticalLines.DEFENDED_AREA_CIRCULAR: {
                label = "DA";
                break;
            }

            case TacticalLines.NOTACK: {
                label = "N";
                break;
            }

            case TacticalLines.LAUNCH_AREA: {
                label = "LA";
                break;
            }

            case TacticalLines.SL: {
                label = "SL";
                break;
            }

            case TacticalLines.TC: {
                label = "TC";
                break;
            }

            case TacticalLines.AARROZ: {
                label = "AARROZ";
                break;
            }

            case TacticalLines.UAROZ: {
                label = "UAROZ";
                break;
            }

            case TacticalLines.WEZ: {
                label = "WEZ";
                break;
            }

            case TacticalLines.FEZ: {
                label = "FEZ";
                break;
            }

            case TacticalLines.JEZ: {
                label = "JEZ";
                break;
            }

            case TacticalLines.IFF_OFF: {
                label = "IFF OFF";
                break;
            }

            case TacticalLines.IFF_ON: {
                label = "IFF ON";
                break;
            }

            case TacticalLines.BCL_REVD:
            case TacticalLines.BCL: {
                label = "BCL";
                break;
            }

            case TacticalLines.ICL: {
                label = "ICL";
                break;
            }

            case TacticalLines.FEBA: {
                label = "FEBA";
                break;
            }

            case TacticalLines.BDZ: {
                label = "BDZ";
                break;
            }

            case TacticalLines.JTAA: {
                label = "JTAA";
                break;
            }

            case TacticalLines.SAA: {
                label = "SAA";
                break;
            }

            case TacticalLines.SGAA: {
                label = "SGAA";
                break;
            }

            case TacticalLines.ASSAULT: {
                label = "ASLT";
                break;
            }

            case TacticalLines.SAAFR: {
                label = "SAAFR";
                break;
            }

            case TacticalLines.AC: {
                label = "AC";
                break;
            }

            case TacticalLines.SECURE:
            case TacticalLines.SEIZE: {
                label = "S";
                break;
            }

            case TacticalLines.TURN: {
                label = "T";
                break;
            }

            case TacticalLines.EVACUATE: {
                label = "E";
                break;
            }

            case TacticalLines.RETAIN: {
                label = "R";
                break;
            }

            case TacticalLines.PENETRATE: {
                label = "P";
                break;
            }

            case TacticalLines.OCCUPY: {
                label = "O";
                break;
            }

            case TacticalLines.ISOLATE: {
                label = "I";
                break;
            }

            case TacticalLines.AREA_DEFENSE: {
                label = "AD";
                break;
            }

            case TacticalLines.FIX: {
                label = "F";
                break;
            }

            case TacticalLines.DISRUPT: {
                label = "D";
                break;
            }

            case TacticalLines.CANALIZE:
            case TacticalLines.CLEAR: {
                label = "C";
                break;
            }

            case TacticalLines.BREACH:
            case TacticalLines.BYPASS: {
                label = "B";
                break;
            }

            case TacticalLines.CORDONKNOCK: {
                label = "C/K";
                break;
            }

            case TacticalLines.CORDONSEARCH: {
                label = "C/S";
                break;
            }

            case TacticalLines.UXO: {
                label = "UXO";
                break;
            }

            case TacticalLines.RETIRE: {
                label = "R";
                break;
            }

            case TacticalLines.PURSUIT: {
                label = "P";
                break;
            }

            case TacticalLines.ENVELOPMENT: {
                label = "E";
                break;
            }

            case TacticalLines.FPOL: {
                label = "P(F)";
                break;
            }

            case TacticalLines.RPOL: {
                label = "P(R)";
                break;
            }

            case TacticalLines.BRDGHD:
            case TacticalLines.BRDGHD_GE: {
                if (SymbolID.getVersion(tg.symbolId) >= SymbolID.Version_2525E) {

                    label = "BL";
                }

                else {

                    label = "B";
                }

                break;
            }

            case TacticalLines.HOLD:
            case TacticalLines.HOLD_GE: {
                //label="HOLDING LINE";
                label = "HL";
                break;
            }

            case TacticalLines.PL: {
                label = "PL";
                break;
            }

            case TacticalLines.LL: {
                label = "LL";
                break;
            }

            case TacticalLines.EWL: {
                label = "EWL";
                break;
            }

            case TacticalLines.SCREEN: {
                label = "S";
                break;
            }

            case TacticalLines.COVER: {
                label = "C";
                break;
            }

            case TacticalLines.GUARD: {
                label = "G";
                break;
            }

            case TacticalLines.RIP: {
                label = "RIP";
                break;
            }

            case TacticalLines.MOBILE_DEFENSE: {
                label = "MD";
                break;
            }

            case TacticalLines.DEMONSTRATE: {
                label = "DEM";
                break;
            }

            case TacticalLines.WITHDRAW: {
                label = "W";
                break;
            }

            case TacticalLines.DISENGAGE: {
                label = "DIS";
                break;
            }

            case TacticalLines.WDRAWUP: {
                label = "WP";
                break;
            }

            case TacticalLines.CATK:
            case TacticalLines.CATKBYFIRE: {
                label = "CATK";
                break;
            }

            case TacticalLines.FLOT: {
                label = "FLOT";
                break;
            }

            case TacticalLines.LC: {
                label = "LC";
                break;
            }

            case TacticalLines.ASSY: {
                label = "AA";
                break;
            }

            case TacticalLines.EA: {
                label = "EA";
                break;
            }

            case TacticalLines.DZ: {
                label = "DZ";
                break;
            }

            case TacticalLines.EZ: {
                label = "EZ";
                break;
            }

            case TacticalLines.LZ: {
                label = "LZ";
                break;
            }

            case TacticalLines.LAA: {
                label = "LAA";
                break;
            }

            case TacticalLines.PZ: {
                label = "PZ";
                break;
            }

            case TacticalLines.MRR: {
                label = "MRR";
                break;
            }

            case TacticalLines.SC: {
                label = "SC";
                break;
            }

            case TacticalLines.LLTR: {
                label = "LLTR";
                break;
            }

            case TacticalLines.ROZ: {
                label = "ROZ";
                break;
            }

            case TacticalLines.FAADZ: {
                label = "SHORADEZ";
                break;
            }

            case TacticalLines.HIDACZ: {
                label = "HIDACZ";
                break;
            }

            case TacticalLines.MEZ: {
                label = "MEZ";
                break;
            }

            case TacticalLines.LOMEZ: {
                label = "LOMEZ";
                break;
            }

            case TacticalLines.HIMEZ: {
                label = "HIMEZ";
                break;
            }

            case TacticalLines.WFZ_REVD:
            case TacticalLines.WFZ: {
                label = "WFZ";
                break;
            }

            case TacticalLines.MINED:
            case TacticalLines.FENCED: {
                label = "M";
                break;
            }

            case TacticalLines.PNO: {
                label = "(P)";
                break;
            }

            case TacticalLines.OBJ: {
                label = "OBJ";
                break;
            }

            case TacticalLines.NAI: {
                label = "NAI";
                break;
            }

            case TacticalLines.TAI: {
                label = "TAI";
                break;
            }

            case TacticalLines.BASE_CAMP_REVD:
            case TacticalLines.BASE_CAMP: {
                label = "BC";
                break;
            }

            case TacticalLines.GUERILLA_BASE_REVD:
            case TacticalLines.GUERILLA_BASE: {
                label = "GB";
                break;
            }

            case TacticalLines.LINTGTS: {
                label = "SMOKE";
                break;
            }

            case TacticalLines.FPF: {
                label = "FPF";
                break;
            }

            case TacticalLines.ATKPOS: {
                label = "ATK";
                break;
            }

            case TacticalLines.FCL: {
                label = "FCL";
                break;
            }

            case TacticalLines.LOA: {
                label = "LOA";
                break;
            }

            case TacticalLines.LOD: {
                label = "LD";
                break;
            }

            case TacticalLines.PLD: {
                label = "PLD";
                break;
            }

            case TacticalLines.DELAY: {
                label = "D";
                break;
            }

            case TacticalLines.RELEASE: {
                label = "RL";
                break;
            }

            case TacticalLines.HOL: {
                label = "HOL";
                break;
            }

            case TacticalLines.BHL: {
                label = "BHL";
                break;
            }

            case TacticalLines.SMOKE: {
                label = "SMOKE";
                break;
            }

            case TacticalLines.NFL: {
                label = "NFL";
                break;
            }

            case TacticalLines.MFP: {
                label = "MFP";
                break;
            }

            case TacticalLines.FSCL: {
                label = "FSCL";
                break;
            }

            case TacticalLines.CFL: {
                label = "CFL";
                break;
            }

            case TacticalLines.RFL: {
                label = "RFL";
                break;
            }

            case TacticalLines.AO: {
                label = "AO";
                break;
            }

            case TacticalLines.BOMB: {
                label = "BOMB";
                break;
            }

            case TacticalLines.TGMF: {
                label = "TGMF";
                break;
            }

            case TacticalLines.FSA: {
                label = "FSA";
                break;
            }

            case TacticalLines.FSA_CIRCULAR:
            case TacticalLines.FSA_RECTANGULAR: {
                label = "FSA";
                break;
            }

            case TacticalLines.ACA:
            case TacticalLines.ACA_CIRCULAR:
            case TacticalLines.ACA_RECTANGULAR: {
                label = "ACA";
                break;
            }

            case TacticalLines.FFA:
            case TacticalLines.FFA_CIRCULAR:
            case TacticalLines.FFA_RECTANGULAR: {
                label = "FFA";
                break;
            }

            case TacticalLines.NFA:
            case TacticalLines.NFA_CIRCULAR:
            case TacticalLines.NFA_RECTANGULAR: {
                label = "NFA";
                break;
            }

            case TacticalLines.RFA:
            case TacticalLines.RFA_CIRCULAR:
            case TacticalLines.RFA_RECTANGULAR: {
                label = "RFA";
                break;
            }

            case TacticalLines.ATI:
            case TacticalLines.ATI_CIRCULAR:
            case TacticalLines.ATI_RECTANGULAR: {
                if (SymbolID.getVersion(tg.symbolId) >= SymbolID.Version_2525Ech1)
                    label = "ATIZ";
                else
                    label = "ATI ZONE";
                break;
            }

            case TacticalLines.PAA:
            case TacticalLines.PAA_CIRCULAR:
            case TacticalLines.PAA_RECTANGULAR: {
                label = "PAA";
                break;
            }

            case TacticalLines.CFFZ:
            case TacticalLines.CFFZ_CIRCULAR:
            case TacticalLines.CFFZ_RECTANGULAR: {
                label = "CFF ZONE";
                break;
            }

            case TacticalLines.CFZ:
            case TacticalLines.CFZ_CIRCULAR:
            case TacticalLines.CFZ_RECTANGULAR: {
                label = "CF ZONE";
                break;
            }

            case TacticalLines.SENSOR:
            case TacticalLines.SENSOR_CIRCULAR:
            case TacticalLines.SENSOR_RECTANGULAR: {
                label = "SENSOR ZONE";
                break;
            }

            case TacticalLines.CENSOR:
            case TacticalLines.CENSOR_CIRCULAR:
            case TacticalLines.CENSOR_RECTANGULAR: {
                label = "CENSOR ZONE";
                break;
            }

            case TacticalLines.DA:
            case TacticalLines.DA_CIRCULAR:
            case TacticalLines.DA_RECTANGULAR: {
                label = "DA";
                break;
            }

            case TacticalLines.ZOR:
            case TacticalLines.ZOR_CIRCULAR:
            case TacticalLines.ZOR_RECTANGULAR: {
                label = "ZOR";
                break;
            }

            case TacticalLines.TBA:
            case TacticalLines.TBA_CIRCULAR:
            case TacticalLines.TBA_RECTANGULAR: {
                label = "TBA";
                break;
            }

            case TacticalLines.TVAR:
            case TacticalLines.TVAR_CIRCULAR:
            case TacticalLines.TVAR_RECTANGULAR: {
                label = "TVAR";
                break;
            }

            case TacticalLines.KILLBOXBLUE:
            case TacticalLines.KILLBOXBLUE_CIRCULAR:
            case TacticalLines.KILLBOXBLUE_RECTANGULAR: {
                label = "BKB";
                break;
            }

            case TacticalLines.KILLBOXPURPLE:
            case TacticalLines.KILLBOXPURPLE_CIRCULAR:
            case TacticalLines.KILLBOXPURPLE_RECTANGULAR: {
                label = "PKB";
                break;
            }

            case TacticalLines.MSR:
            case TacticalLines.MSR_ONEWAY:
            case TacticalLines.MSR_TWOWAY:
            case TacticalLines.MSR_ALT: {
                label = "MSR";
                break;
            }

            case TacticalLines.ASR:
            case TacticalLines.ASR_ONEWAY:
            case TacticalLines.ASR_TWOWAY:
            case TacticalLines.ASR_ALT: {
                label = "ASR";
                break;
            }

            case TacticalLines.TRAFFIC_ROUTE:
            case TacticalLines.TRAFFIC_ROUTE_ONEWAY:
            case TacticalLines.TRAFFIC_ROUTE_ALT: {
                label = "ROUTE";
                break;
            }

            case TacticalLines.LDLC: {
                label = "LD/LC";
                break;
            }

            case TacticalLines.AIRHEAD: {
                label = "AIRHEAD LINE";
                break;
            }

            case TacticalLines.BLOCK:
            case TacticalLines.BEARING: {
                label = "B";
                break;
            }

            case TacticalLines.BEARING_J: {
                label = "J";
                break;
            }

            case TacticalLines.BEARING_RDF: {
                label = "RDF";
                break;
            }

            case TacticalLines.ELECTRO: {
                label = "E";
                break;
            }

            case TacticalLines.BEARING_EW: {
                label = "EW";
                break;
            }

            case TacticalLines.ACOUSTIC:
            case TacticalLines.ACOUSTIC_AMB: {
                label = "A";
                break;
            }

            case TacticalLines.TORPEDO: {
                label = "T";
                break;
            }

            case TacticalLines.OPTICAL: {
                label = "O";
                break;
            }

            case TacticalLines.DHA: {
                label = "DHA";
                break;
            }

            case TacticalLines.KILL_ZONE: {
                label = "KILL ZONE";
                break;
            }

            case TacticalLines.FARP: {
                label = "FARP";
                break;
            }

            case TacticalLines.BSA: {
                label = "BSA";
                break;
            }

            case TacticalLines.DSA: {
                label = "DSA";
                break;
            }

            case TacticalLines.CSA: {
                label = "CSA";
                break;
            }

            case TacticalLines.RSA: {
                label = "RSA";
                break;
            }

            case TacticalLines.CONTAIN: {
                label = "C";
                break;
            }

            case TacticalLines.OBSFAREA: {
                label = "FREE";
                break;
            }

            case TacticalLines.TRIP: {
                label = "t";
                break;
            }

            case TacticalLines.INFILTRATION: {
                label = "IN";
                break;
            }

            default: {
                break;
            }

        }
    } catch (exc) {
        if (exc instanceof Error) {
            //TacticalUtils.WriteFile("Error in Modifier2.GetCenterLabel");
            ErrorLogger.LogException(_className, "GetCenterLabel",
                exc);
        } else {
            throw exc;
        }
    }
    return label;
}
