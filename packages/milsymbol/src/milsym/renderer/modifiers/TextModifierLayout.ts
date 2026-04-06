import { Rectangle2D } from "../../graphics/Rectangle2D";
import { SymbolID } from "../utilities/SymbolID";
import { SymbolUtilities } from "../utilities/SymbolUtilities";
import { Modifiers } from "../utilities/Modifiers";
import { RendererSettings, rendererSettings } from "../utilities/RendererSettings";
import { MilStdAttributes } from "../utilities/MilStdAttributes";
import { Modifier } from "../utilities/Modifier";

export function getLabelPositionIndexes(symbolID:string, modifiers:Map<string,string>, attributes:Map<string,string>):Array<Modifier> | null
{
    let mods:Array<Modifier> | null = null;
    if(modifiers !==  null && modifiers.size > 0)
        mods = new Array<Modifier>();
    else
        return null;

    let ver:number = SymbolID.getVersion(symbolID);
    let ss:number = SymbolID.getSymbolSet(symbolID);
    let x:number = 0;
    let y:number = 0;
    let centered:boolean = true;
    let p:number = rendererSettings.getSPModifierPlacement();
    let strict:boolean = (rendererSettings.getSPModifierPlacement() == RendererSettings.ModifierPlacement_STRICT);
    if(attributes !==  null && attributes.has(MilStdAttributes.ModifierPlacement))
    {
        let mp:string | undefined = attributes.get(MilStdAttributes.ModifierPlacement);
        if(mp !== undefined && SymbolUtilities.isNumber(mp))
        {
            p = parseInt(mp);
            if(p == 0)
                strict = true;
            else
                strict = false;
        }
    }
    let temp:string | null = null;
    let sep:string = " ";
    if(ss == SymbolID.SymbolSet_DismountedIndividuals) {
        ver = SymbolID.Version_2525E;
    }

    if(ver < SymbolID.Version_2525E)
    {
        if(ss == SymbolID.SymbolSet_LandUnit ||
                ss == SymbolID.SymbolSet_LandCivilianUnit_Organization)
        {

            //Only Command & Control has AA; ec.equals("110000").  Always in the middle of the unit.
            if(modifiers.has(Modifiers.AA_SPECIAL_C2_HQ))
            {
                temp = modifiers.get(Modifiers.AA_SPECIAL_C2_HQ)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("AA", temp, 0, 0, true));
            }

            //Do top center label
            x = 0;//centered
            y = 9;//on top of symbol
            if(modifiers.has(Modifiers.B_ECHELON))
            {
                temp = modifiers.get(Modifiers.B_ECHELON)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("B", temp, x, y, centered));
            }

            //Do right side labels
            x = 1;//on right
            if(modifiers.has(Modifiers.H_ADDITIONAL_INFO_1))
            {
                y = 0;//center
                centered = true;//vertically centered, only matters for labels on left and right side
                temp = modifiers.get(Modifiers.H_ADDITIONAL_INFO_1)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("H", temp, x, y, centered));
            }
            else if(!strict)
            {
                //if no "H', bring G and M closer to the center
                centered = false;
            }

            if(modifiers.has(Modifiers.G_STAFF_COMMENTS))
            {
                y = 1;//above center
                temp = modifiers.get(Modifiers.G_STAFF_COMMENTS)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("G", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.F_REINFORCED_REDUCED) || modifiers.has(Modifiers.AS_COUNTRY))
            {
                y = 2;
                if(!strict && !modifiers.has(Modifiers.G_STAFF_COMMENTS))
                    y--;
                temp = "";
                if(modifiers.has(Modifiers.F_REINFORCED_REDUCED))
                    temp = modifiers.get(Modifiers.F_REINFORCED_REDUCED)! + sep;
                if(modifiers.has(Modifiers.AS_COUNTRY))
                    temp += modifiers.get(Modifiers.AS_COUNTRY)!;
                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("F AS", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.M_HIGHER_FORMATION))
            {
                y = -1;//below center
                temp = modifiers.get(Modifiers.M_HIGHER_FORMATION)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("M", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.J_EVALUATION_RATING) ||
                    modifiers.has(Modifiers.K_COMBAT_EFFECTIVENESS) ||
                    modifiers.has(Modifiers.P_IFF_SIF_AIS))
            {
                y = -2;
                if(!strict && !modifiers.has(Modifiers.M_HIGHER_FORMATION))
                    y++;
                temp = "";
                if(modifiers.has(Modifiers.J_EVALUATION_RATING))
                    temp = modifiers.get(Modifiers.J_EVALUATION_RATING)! + sep;
                if(modifiers.has(Modifiers.K_COMBAT_EFFECTIVENESS))
                    temp += modifiers.get(Modifiers.K_COMBAT_EFFECTIVENESS)! + sep;
                if(modifiers.has(Modifiers.P_IFF_SIF_AIS))
                    temp += modifiers.get(Modifiers.P_IFF_SIF_AIS)!;
                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("J K P", temp, x, y, centered));
            }

            //Do left side labels
            x = -1;//on left
            centered = false;

            if(modifiers.has(Modifiers.X_ALTITUDE_DEPTH) || modifiers.has(Modifiers.Y_LOCATION))
            {
                y = 1;
                temp = "";
                if(modifiers.has(Modifiers.X_ALTITUDE_DEPTH))
                    temp = modifiers.get(Modifiers.X_ALTITUDE_DEPTH)! + sep;
                if(modifiers.has(Modifiers.Y_LOCATION))
                    temp += modifiers.get(Modifiers.Y_LOCATION)!;

                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("X Y", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.W_DTG_1))
            {
                y = 2;//above center
                if(!strict && !(modifiers.has(Modifiers.X_ALTITUDE_DEPTH) || modifiers.has(Modifiers.Y_LOCATION)))
                    y--;
                temp = modifiers.get(Modifiers.W_DTG_1)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("W", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1))
            {
                y = -1;//below center
                temp = modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("T", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.Z_SPEED))
            {
                y = -2;
                if(!strict && !modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1))
                    y++;
                temp = modifiers.get(Modifiers.Z_SPEED)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier(Modifiers.J_EVALUATION_RATING, temp, x, y, centered));
            }
        }
        else if(ss == SymbolID.SymbolSet_LandEquipment ||
                ss == SymbolID.SymbolSet_SignalsIntelligence_Land)
        {
            //Do top center label
            x = 0;//centered
            y = 9;//on top of symbol
            if(modifiers.has(Modifiers.C_QUANTITY))
            {
                temp = modifiers.get(Modifiers.C_QUANTITY)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("C", temp, x, y, centered));
            }

            //Do right side labels
            x = 1;//on right
            if(modifiers.has(Modifiers.H_ADDITIONAL_INFO_1) || modifiers.has(Modifiers.AF_COMMON_IDENTIFIER))
            {
                y = 0;//center
                centered = true;//vertically centered, only matters for labels on left and right side
                temp = "";
                if(modifiers.has(Modifiers.H_ADDITIONAL_INFO_1))
                    temp = modifiers.get(Modifiers.H_ADDITIONAL_INFO_1)! + sep;
                if(modifiers.has(Modifiers.AF_COMMON_IDENTIFIER))
                    temp += modifiers.get(Modifiers.AF_COMMON_IDENTIFIER)!;
                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("H AF", temp, x, y, centered));
            }
            else if(!strict)
            {
                //if no "H', bring G and M closer to the center
                centered = false;
            }

            if(modifiers.has(Modifiers.G_STAFF_COMMENTS) || modifiers.has(Modifiers.AQ_GUARDED_UNIT))
            {
                y = 1;//above center
                temp = "";
                if(modifiers.has(Modifiers.G_STAFF_COMMENTS))
                    temp = modifiers.get(Modifiers.G_STAFF_COMMENTS)! + sep;
                if(modifiers.has(Modifiers.AQ_GUARDED_UNIT))
                    temp += modifiers.get(Modifiers.AQ_GUARDED_UNIT)!;
                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("G AQ", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.AS_COUNTRY))
            {
                y = 2;
                if(!strict && !(modifiers.has(Modifiers.G_STAFF_COMMENTS) || modifiers.has(Modifiers.AQ_GUARDED_UNIT)))
                    y--;

                temp = modifiers.get(Modifiers.AS_COUNTRY)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("AS", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.J_EVALUATION_RATING) ||
                    modifiers.has(Modifiers.L_SIGNATURE_EQUIP) ||
                    modifiers.has(Modifiers.N_HOSTILE) ||
                    modifiers.has(Modifiers.P_IFF_SIF_AIS))
            {
                y = -1;

                temp = "";
                if(modifiers.has(Modifiers.J_EVALUATION_RATING))
                    temp = modifiers.get(Modifiers.J_EVALUATION_RATING)! + sep;
                if(modifiers.has(Modifiers.L_SIGNATURE_EQUIP))
                    temp += modifiers.get(Modifiers.L_SIGNATURE_EQUIP)! + sep;
                if(modifiers.has(Modifiers.N_HOSTILE))
                    temp += modifiers.get(Modifiers.N_HOSTILE)! + sep;
                if(modifiers.has(Modifiers.P_IFF_SIF_AIS))
                    temp += modifiers.get(Modifiers.P_IFF_SIF_AIS)!;
                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("J L N P", temp, x, y, centered));
            }

            //Do left side labels
            x = -1;//on left

            if(modifiers.has(Modifiers.V_EQUIP_TYPE) ||
                    modifiers.has(Modifiers.AD_PLATFORM_TYPE) ||
                    modifiers.has(Modifiers.AE_EQUIPMENT_TEARDOWN_TIME))
            {
                y = 0;//center
                centered = true;//vertically centered, only matters for labels on left and right side

                temp = "";
                if(modifiers.has(Modifiers.V_EQUIP_TYPE))
                    temp = modifiers.get(Modifiers.V_EQUIP_TYPE)! + sep;
                if(modifiers.has(Modifiers.AD_PLATFORM_TYPE))
                    temp += modifiers.get(Modifiers.AD_PLATFORM_TYPE)! + sep;
                if(modifiers.has(Modifiers.AE_EQUIPMENT_TEARDOWN_TIME))
                    temp += modifiers.get(Modifiers.AE_EQUIPMENT_TEARDOWN_TIME)!;
                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("V AD AE", temp, x, y, centered));
            }
            else if(!strict)
            {
                centered = false;
            }

            if(modifiers.has(Modifiers.X_ALTITUDE_DEPTH) || modifiers.has(Modifiers.Y_LOCATION))
            {
                y = 1;
                temp = "";
                if(modifiers.has(Modifiers.X_ALTITUDE_DEPTH))
                    temp = modifiers.get(Modifiers.X_ALTITUDE_DEPTH)! + sep;
                if(modifiers.has(Modifiers.Y_LOCATION))
                    temp += modifiers.get(Modifiers.Y_LOCATION)!;

                temp = temp.trim();
                mods.push(new Modifier("X Y", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.W_DTG_1) || modifiers.has(Modifiers.AR_SPECIAL_DESIGNATOR))
            {
                y = 2;//above center
                if(!strict && !(modifiers.has(Modifiers.X_ALTITUDE_DEPTH) || modifiers.has(Modifiers.Y_LOCATION)))
                    y--;

                temp = modifiers.get(Modifiers.W_DTG_1)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("W", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1))
            {
                y = -1;//below center
                temp = modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("T", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.Z_SPEED))
            {
                y = -2;
                if(!strict && !modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1))
                    y++;
                temp = modifiers.get(Modifiers.Z_SPEED)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("Z", temp, x, y, centered));
            }
        }
        else if(ss == SymbolID.SymbolSet_LandInstallation)
        {
            //No top center label

            //Do right side labels
            x = 1;//on right

            if(modifiers.has(Modifiers.H_ADDITIONAL_INFO_1))
            {
                y = 0;//center
                centered = true;//vertically centered, only matters for labels on left and right side
                temp = modifiers.get(Modifiers.H_ADDITIONAL_INFO_1)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("H", temp, x, y, centered));
            }
            else if(!strict)
            {
                centered = false;
            }

            if(modifiers.has(Modifiers.G_STAFF_COMMENTS))
            {
                y = 1;//above center
                temp = modifiers.get(Modifiers.G_STAFF_COMMENTS)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("G", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.AS_COUNTRY))
            {
                y = 2;
                if(!strict && !modifiers.has(Modifiers.G_STAFF_COMMENTS))
                    y--;

                temp = modifiers.get(Modifiers.AS_COUNTRY)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("AS", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.J_EVALUATION_RATING) ||
                    modifiers.has(Modifiers.K_COMBAT_EFFECTIVENESS) ||
                    modifiers.has(Modifiers.P_IFF_SIF_AIS))
            {
                y = -1;

                temp = "";
                if(modifiers.has(Modifiers.J_EVALUATION_RATING))
                    temp = modifiers.get(Modifiers.J_EVALUATION_RATING)! + sep;
                if(modifiers.has(Modifiers.K_COMBAT_EFFECTIVENESS))
                    temp += modifiers.get(Modifiers.K_COMBAT_EFFECTIVENESS)! + sep;
                if(modifiers.has(Modifiers.P_IFF_SIF_AIS))
                    temp += modifiers.get(Modifiers.P_IFF_SIF_AIS)!;
                temp = temp.trim();
                mods.push(new Modifier("J K P", temp, x, y, centered));
            }

            //Do left side labels
            x = -1;//on left

            if(modifiers.has(Modifiers.X_ALTITUDE_DEPTH) || modifiers.has(Modifiers.Y_LOCATION))
            {
                y = 0;//center
                centered = true;//vertically centered, only matters for labels on left and right side

                temp = "";
                if(modifiers.has(Modifiers.X_ALTITUDE_DEPTH))
                    temp = modifiers.get(Modifiers.X_ALTITUDE_DEPTH)! + sep;
                if(modifiers.has(Modifiers.Y_LOCATION))
                    temp += modifiers.get(Modifiers.Y_LOCATION)!;
                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("X Y", temp, x, y, centered));
            }
            else if(!strict)
            {
                centered = false;
            }

            if(modifiers.has(Modifiers.W_DTG_1))
            {
                y = 1;//above center

                temp = modifiers.get(Modifiers.W_DTG_1)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("W AR", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1))
            {
                y = -1;//below center
                temp = modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("T", temp, x, y, centered));
            }
        }
        else if(ss == SymbolID.SymbolSet_Air ||
                ss == SymbolID.SymbolSet_AirMissile ||
                ss == SymbolID.SymbolSet_SignalsIntelligence_Air)
        {
            //No top center label


            //Do right side labels
            x = 1;//on right
            centered = false;

            if(modifiers.has(Modifiers.P_IFF_SIF_AIS))
            {
                y = 1;//above center
                temp = modifiers.get(Modifiers.P_IFF_SIF_AIS)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("P", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1))
            {
                y = 2;
                if(!strict && !modifiers.has(Modifiers.P_IFF_SIF_AIS))
                    y--;
                temp = modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("T", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.AS_COUNTRY))
            {
                y = 3;
                if(!strict)
                {
                    if(!modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1))
                        y--;
                    if(!modifiers.has(Modifiers.P_IFF_SIF_AIS))
                        y--;
                }

                temp = modifiers.get(Modifiers.AS_COUNTRY )!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("AS", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.V_EQUIP_TYPE))
            {
                y = -1;//below center
                temp = modifiers.get(Modifiers.V_EQUIP_TYPE)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("V", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.Z_SPEED)  ||
                    modifiers.has(Modifiers.X_ALTITUDE_DEPTH))
            {
                y = -2;//below center
                if(!modifiers.has(Modifiers.V_EQUIP_TYPE))
                    y++;

                temp = "";
                if(modifiers.has(Modifiers.Z_SPEED))
                    temp = modifiers.get(Modifiers.Z_SPEED)! + sep;
                if(modifiers.has(Modifiers.X_ALTITUDE_DEPTH))
                    temp += modifiers.get(Modifiers.X_ALTITUDE_DEPTH)!;
                temp = temp.trim();

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("Z X", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.G_STAFF_COMMENTS) ||
                    modifiers.has(Modifiers.H_ADDITIONAL_INFO_1))
            {
                y = -3;
                if(!strict)
                {
                    if(!(modifiers.has(Modifiers.Z_SPEED)  ||
                            modifiers.has(Modifiers.X_ALTITUDE_DEPTH)))
                        y++;
                    if(!modifiers.has(Modifiers.V_EQUIP_TYPE))
                        y++;
                }
                temp = "";
                if(modifiers.has(Modifiers.G_STAFF_COMMENTS))
                    temp = modifiers.get(Modifiers.G_STAFF_COMMENTS)! + sep;
                if(modifiers.has(Modifiers.H_ADDITIONAL_INFO_1))
                    temp += modifiers.get(Modifiers.H_ADDITIONAL_INFO_1);
                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("G H", temp, x, y, centered));
            }

            //No left side labels

        }
        else if(ss == SymbolID.SymbolSet_Space ||
                ss == SymbolID.SymbolSet_SpaceMissile ||
                ss == SymbolID.SymbolSet_SignalsIntelligence_Space)
        {
            //No top center label


            //Do right side labels
            x = 1;//on right
            centered = false;

            if(modifiers.has(Modifiers.V_EQUIP_TYPE))
            {
                y = 1;//above center
                temp = modifiers.get(Modifiers.V_EQUIP_TYPE)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("V", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1))
            {
                y = 2;
                if(!strict && !modifiers.has(Modifiers.V_EQUIP_TYPE))
                    y--;
                temp = modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("T", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.AS_COUNTRY))
            {
                y = 3;
                if(!strict)
                {
                    if(!modifiers.has(Modifiers.V_EQUIP_TYPE))
                        y--;
                    if(!modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1))
                        y--;
                }

                temp = modifiers.get(Modifiers.AS_COUNTRY )!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("AS", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.Z_SPEED)  ||
                    modifiers.has(Modifiers.X_ALTITUDE_DEPTH))
            {
                y = -1;//below center
                temp = "";
                if(modifiers.has(Modifiers.Z_SPEED))
                    temp = modifiers.get(Modifiers.Z_SPEED)! + sep;
                if(modifiers.has(Modifiers.X_ALTITUDE_DEPTH))
                    temp += modifiers.get(Modifiers.X_ALTITUDE_DEPTH)!;
                temp = temp.trim();

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("Z X", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.G_STAFF_COMMENTS) ||
                    modifiers.has(Modifiers.H_ADDITIONAL_INFO_1))
            {
                y = -2;
                if(!strict &&
                        !(modifiers.has(Modifiers.Z_SPEED) || modifiers.has(Modifiers.X_ALTITUDE_DEPTH)))
                    y++;
                temp = "";
                if(modifiers.has(Modifiers.G_STAFF_COMMENTS))
                    temp = modifiers.get(Modifiers.G_STAFF_COMMENTS)! + sep;
                if(modifiers.has(Modifiers.H_ADDITIONAL_INFO_1))
                    temp += modifiers.get(Modifiers.H_ADDITIONAL_INFO_1);
                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("G H", temp, x, y, centered));
            }

            //No left side labels
        }
        else if(ss == SymbolID.SymbolSet_SeaSurface ||
                ss == SymbolID.SymbolSet_SignalsIntelligence_SeaSurface)
        {
            //No top center label


            //Do right side labels
            x = 1;//on right
            centered = true;
            if(modifiers.has(Modifiers.V_EQUIP_TYPE))
            {
                y = 0;//center
                centered = true;//vertically centered, only matters for labels on left and right side
                temp = modifiers.get(Modifiers.V_EQUIP_TYPE)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("V", temp, x, y, centered));
            }
            else if(!strict)
            {
                //if no "H', bring G and M closer to the center
                centered = false;
            }

            if(modifiers.has(Modifiers.P_IFF_SIF_AIS))
            {
                y = 1;//above center
                temp = modifiers.get(Modifiers.P_IFF_SIF_AIS)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("P", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1))
            {
                y = 2;
                if(!strict && !modifiers.has(Modifiers.P_IFF_SIF_AIS))
                    y--;
                temp = modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("T", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.AS_COUNTRY))
            {
                y = 3;
                if(!strict)
                {
                    if(!modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1))
                        y--;
                    if(!modifiers.has(Modifiers.V_EQUIP_TYPE))
                        y--;
                }

                temp = modifiers.get(Modifiers.AS_COUNTRY )!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("AS", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.Z_SPEED)  ||
                    modifiers.has(Modifiers.X_ALTITUDE_DEPTH))
            {
                y = -1;//below center
                temp = "";
                if(modifiers.has(Modifiers.Z_SPEED))
                    temp = modifiers.get(Modifiers.Z_SPEED)! + sep;
                if(modifiers.has(Modifiers.X_ALTITUDE_DEPTH))
                    temp += modifiers.get(Modifiers.X_ALTITUDE_DEPTH)!;
                temp = temp.trim();

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("Z X", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.G_STAFF_COMMENTS) ||
                    modifiers.has(Modifiers.H_ADDITIONAL_INFO_1))
            {
                y = -2;
                if(!strict &&
                        !(modifiers.has(Modifiers.Z_SPEED) || modifiers.has(Modifiers.X_ALTITUDE_DEPTH)))
                    y++;
                temp = "";
                if(modifiers.has(Modifiers.G_STAFF_COMMENTS))
                    temp = modifiers.get(Modifiers.G_STAFF_COMMENTS)! + sep;
                if(modifiers.has(Modifiers.H_ADDITIONAL_INFO_1))
                    temp += modifiers.get(Modifiers.H_ADDITIONAL_INFO_1);
                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("G H", temp, x, y, centered));
            }

            //Do left side labels
            x = -1;
            centered = false;
            if(modifiers.has(Modifiers.AQ_GUARDED_UNIT) || modifiers.has(Modifiers.AR_SPECIAL_DESIGNATOR))
            {
                y = 3;//above center
                if(!strict)
                    y--;

                temp = "";
                if(modifiers.has(Modifiers.AQ_GUARDED_UNIT))
                    temp = modifiers.get(Modifiers.AQ_GUARDED_UNIT)! + sep;
                if(modifiers.has(Modifiers.AR_SPECIAL_DESIGNATOR))
                    temp += modifiers.get(Modifiers.AR_SPECIAL_DESIGNATOR)!;
                temp = temp.trim();

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("AQ AR", temp, x, y, centered));
            }
        }
        else if(ss == SymbolID.SymbolSet_SeaSubsurface ||
                ss == SymbolID.SymbolSet_SignalsIntelligence_SeaSubsurface)
        {
            //No top center label


            //Do right side labels
            x = 1;//on right
            centered = false;
            if(modifiers.has(Modifiers.V_EQUIP_TYPE))
            {
                y = 1;//center
                temp = modifiers.get(Modifiers.V_EQUIP_TYPE)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("V", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1))
            {
                y = 2;
                if(!strict && !modifiers.has(Modifiers.V_EQUIP_TYPE))
                    y--;
                temp = modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("T", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.AS_COUNTRY))
            {
                y = 3;
                if(!strict)
                {
                    if(!modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1))
                        y--;
                    if(!modifiers.has(Modifiers.V_EQUIP_TYPE))
                        y--;
                }

                temp = modifiers.get(Modifiers.AS_COUNTRY )!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("AS", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.X_ALTITUDE_DEPTH))
            {
                y = -1;//below center

                temp = modifiers.get(Modifiers.X_ALTITUDE_DEPTH)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("X", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.G_STAFF_COMMENTS))
            {
                y = -2;
                if(!strict && !(modifiers.has(Modifiers.X_ALTITUDE_DEPTH)))
                    y++;
                temp = modifiers.get(Modifiers.G_STAFF_COMMENTS)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("G", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.H_ADDITIONAL_INFO_1))
            {
                y = -3;//below center
                if(!strict)
                {
                    if(!modifiers.has(Modifiers.G_STAFF_COMMENTS))
                        y++;
                    if(!modifiers.has(Modifiers.X_ALTITUDE_DEPTH))
                        y++;
                }

                temp = modifiers.get(Modifiers.H_ADDITIONAL_INFO_1)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("H", temp, x, y, centered));
            }

            //Do left side labels
            x = -1;
            centered = false;
            if(modifiers.has(Modifiers.AR_SPECIAL_DESIGNATOR))
            {
                y = 3;//above center
                if(!strict)
                {
                    y--;
                }

                temp = modifiers.get(Modifiers.AR_SPECIAL_DESIGNATOR)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("AR", temp, x, y, centered));
            }

        }
        else if(ss == SymbolID.SymbolSet_Activities)
        {
            //No top center label

            //Do right side labels
            x = 1;//on right
            centered = false;

            if(modifiers.has(Modifiers.G_STAFF_COMMENTS))
            {
                y = 1;

                temp = modifiers.get(Modifiers.G_STAFF_COMMENTS)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("G", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.AS_COUNTRY))
            {
                y = 2;
                if(!strict && !modifiers.has(Modifiers.G_STAFF_COMMENTS))
                    y--;
                temp = modifiers.get(Modifiers.AS_COUNTRY)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("AS", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.H_ADDITIONAL_INFO_1))
            {
                y = -1;//below center
                temp = modifiers.get(Modifiers.H_ADDITIONAL_INFO_1)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("H", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.J_EVALUATION_RATING))
            {
                y = -2;
                if(!strict && !modifiers.has(Modifiers.H_ADDITIONAL_INFO_1))
                    y++;
                temp = modifiers.get(Modifiers.J_EVALUATION_RATING)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("J", temp, x, y, centered));
            }

            //Do left side labels
            x = -1;//on left
            centered = false;

            if(modifiers.has(Modifiers.Y_LOCATION))
            {
                y = 1;
                temp = modifiers.get(Modifiers.Y_LOCATION)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("Y", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.W_DTG_1))
            {
                y = 2;//above center
                if(!strict && !modifiers.has(Modifiers.Y_LOCATION))
                    y--;
                temp = modifiers.get(Modifiers.W_DTG_1)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("W", temp, x, y, centered));
            }

        }
        else if(ss == SymbolID.SymbolSet_CyberSpace)
        {
            //Do top center label
            x = 0;//centered
            y = 9;//on top of symbol
            if(modifiers.has(Modifiers.B_ECHELON))
            {
                temp = modifiers.get(Modifiers.B_ECHELON)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("B", temp, x, y, centered));
            }

            //Do right side labels
            x = 1;//on right
            if(modifiers.has(Modifiers.H_ADDITIONAL_INFO_1))
            {
                y = 0;//center
                centered = true;//vertically centered, only matters for labels on left and right side
                temp = modifiers.get(Modifiers.H_ADDITIONAL_INFO_1)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("H", temp, x, y, centered));
            }
            else if(!strict)
            {
                //if no "H', bring G and M closer to the center
                centered = false;
            }

            if(modifiers.has(Modifiers.G_STAFF_COMMENTS))
            {
                y = 1;//above center
                temp = modifiers.get(Modifiers.G_STAFF_COMMENTS)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("G", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.F_REINFORCED_REDUCED) || modifiers.has(Modifiers.AS_COUNTRY))
            {
                y = 2;
                if(!strict && !modifiers.has(Modifiers.G_STAFF_COMMENTS))
                    y--;
                temp = "";
                if(modifiers.has(Modifiers.F_REINFORCED_REDUCED))
                    temp = modifiers.get(Modifiers.F_REINFORCED_REDUCED)! + sep;
                if(modifiers.has(Modifiers.AS_COUNTRY))
                    temp += modifiers.get(Modifiers.AS_COUNTRY)!;
                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("F AS", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.M_HIGHER_FORMATION))
            {
                y = -1;//below center
                temp = modifiers.get(Modifiers.M_HIGHER_FORMATION)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("M", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.K_COMBAT_EFFECTIVENESS) ||
                    modifiers.has(Modifiers.L_SIGNATURE_EQUIP))
            {
                y = -2;
                if(!strict && !modifiers.has(Modifiers.M_HIGHER_FORMATION))
                    y++;
                temp = "";
                if(modifiers.has(Modifiers.K_COMBAT_EFFECTIVENESS))
                    temp = modifiers.get(Modifiers.K_COMBAT_EFFECTIVENESS) + sep;
                if(modifiers.has(Modifiers.L_SIGNATURE_EQUIP))
                    temp += modifiers.get(Modifiers.L_SIGNATURE_EQUIP);

                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("K L", temp, x, y, centered));
            }

            //Do left side labels
            x = -1;//on left
            centered = true;

            if(modifiers.has(Modifiers.Y_LOCATION))
            {
                y = 0;
                temp = modifiers.get(Modifiers.Y_LOCATION)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("Y", temp, x, y, centered));
            }
            else if (!strict)
            {
                centered = false;
            }

            if(modifiers.has(Modifiers.W_DTG_1))
            {
                y = 1;//above center
                temp = modifiers.get(Modifiers.W_DTG_1)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("W", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1) || modifiers.has(Modifiers.V_EQUIP_TYPE))
            {
                y = -1;//below center
                temp = "";
                if(modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1))
                    temp = modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1) + sep;
                if(modifiers.has(Modifiers.V_EQUIP_TYPE))
                    temp += modifiers.get(Modifiers.V_EQUIP_TYPE);

                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("T V", temp, x, y, centered));
            }

        }
        /*else if(ver == SymbolID.SymbolSet_MineWarfare)
        {
            //no modifiers
        }//*/
        //else//SymbolSet Unknown
            //processUnknownTextModifiers
    }
    else// if(ver >= SymbolID.Version_2525E)
    {
        let fs:string = SymbolID.getFrameShape(symbolID);
        if(ss == SymbolID.SymbolSet_LandUnit ||
                ss == SymbolID.SymbolSet_LandCivilianUnit_Organization ||
                (ss == SymbolID.SymbolSet_SignalsIntelligence && fs == SymbolID.FrameShape_LandUnit))
        {
            //Only Command & Control has AA; ec.equals("110000").  Always in the middle of the unit.
            if(modifiers.has(Modifiers.AA_SPECIAL_C2_HQ))
            {
                temp = modifiers.get(Modifiers.AA_SPECIAL_C2_HQ)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("AA", temp, 0, 0, true));
            }

            //Do top center label
            x = 0;//centered
            y = 9;//on top of symbol
            if(modifiers.has(Modifiers.B_ECHELON))
            {
                temp = modifiers.get(Modifiers.B_ECHELON)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("B", temp, x, y, centered));
            }

            //Do right side labels
            x = 1;//on right
            if(modifiers.has(Modifiers.H_ADDITIONAL_INFO_1) ||
                    modifiers.has(Modifiers.AF_COMMON_IDENTIFIER))
            {
                y = 0;//center
                centered = true;//vertically centered, only matters for labels on left and right side
                temp = "";
                if(modifiers.has(Modifiers.H_ADDITIONAL_INFO_1))
                    temp = modifiers.get(Modifiers.H_ADDITIONAL_INFO_1)! + sep;
                if(modifiers.has(Modifiers.AF_COMMON_IDENTIFIER))
                    temp += modifiers.get(Modifiers.AF_COMMON_IDENTIFIER)!;
                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("H AF", temp, x, y, centered));
            }
            else if(!strict)
            {
                //if no "H', bring G and M closer to the center
                centered = false;
            }

            if(modifiers.has(Modifiers.G_STAFF_COMMENTS) || modifiers.has(Modifiers.AQ_GUARDED_UNIT))
            {
                y = 1;//above center
                temp = "";
                if(modifiers.has(Modifiers.G_STAFF_COMMENTS))
                    temp = modifiers.get(Modifiers.G_STAFF_COMMENTS)! + sep;
                if(modifiers.has(Modifiers.AQ_GUARDED_UNIT))
                    temp += modifiers.get(Modifiers.AQ_GUARDED_UNIT)!;
                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("G AQ", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.F_REINFORCED_REDUCED) || modifiers.has(Modifiers.AS_COUNTRY))
            {
                y = 2;
                if(!strict && !(modifiers.has(Modifiers.G_STAFF_COMMENTS) || modifiers.has(Modifiers.AQ_GUARDED_UNIT)))
                    y--;
                temp = "";
                if(modifiers.has(Modifiers.F_REINFORCED_REDUCED))
                    temp = modifiers.get(Modifiers.F_REINFORCED_REDUCED)! + sep;
                if(modifiers.has(Modifiers.AS_COUNTRY))
                    temp += modifiers.get(Modifiers.AS_COUNTRY)!;
                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("F AS", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.M_HIGHER_FORMATION))
            {
                y = -1;//below center
                temp = modifiers.get(Modifiers.M_HIGHER_FORMATION)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("M", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.J_EVALUATION_RATING) ||
                    modifiers.has(Modifiers.K_COMBAT_EFFECTIVENESS) ||
                    modifiers.has(Modifiers.L_SIGNATURE_EQUIP) ||
                    modifiers.has(Modifiers.P_IFF_SIF_AIS))
            {
                y = -2;
                if(!strict && !modifiers.has(Modifiers.M_HIGHER_FORMATION))
                    y++;
                temp = "";
                if(modifiers.has(Modifiers.J_EVALUATION_RATING))
                    temp = modifiers.get(Modifiers.J_EVALUATION_RATING)! + sep;
                if(modifiers.has(Modifiers.K_COMBAT_EFFECTIVENESS))
                    temp += modifiers.get(Modifiers.K_COMBAT_EFFECTIVENESS)! + sep;
                if(modifiers.has(Modifiers.L_SIGNATURE_EQUIP))
                    temp += modifiers.get(Modifiers.L_SIGNATURE_EQUIP)! + sep;
                if(modifiers.has(Modifiers.P_IFF_SIF_AIS))
                    temp += modifiers.get(Modifiers.P_IFF_SIF_AIS)!;
                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("J K L P", temp, x, y, centered));
            }

            //Do left side labels
            x = -1;//on left

            if(modifiers.has(Modifiers.V_EQUIP_TYPE) ||
                    modifiers.has(Modifiers.AD_PLATFORM_TYPE) ||
                    modifiers.has(Modifiers.AE_EQUIPMENT_TEARDOWN_TIME))
            {
                y = 0;//center
                centered = true;//vertically centered, only matters for labels on left and right side

                temp = "";
                if(modifiers.has(Modifiers.V_EQUIP_TYPE))
                    temp = modifiers.get(Modifiers.V_EQUIP_TYPE)! + sep;
                if(modifiers.has(Modifiers.AD_PLATFORM_TYPE))
                    temp += modifiers.get(Modifiers.AD_PLATFORM_TYPE)! + sep;
                if(modifiers.has(Modifiers.AE_EQUIPMENT_TEARDOWN_TIME))
                    temp += modifiers.get(Modifiers.AE_EQUIPMENT_TEARDOWN_TIME)!;
                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("V AD AE", temp, x, y, centered));
            }
            else if(!strict)
            {
                centered = false;
            }

            if(modifiers.has(Modifiers.X_ALTITUDE_DEPTH) || modifiers.has(Modifiers.Y_LOCATION))
            {
                y = 1;
                temp = "";
                if(modifiers.has(Modifiers.X_ALTITUDE_DEPTH))
                    temp = modifiers.get(Modifiers.X_ALTITUDE_DEPTH)! + sep;
                if(modifiers.has(Modifiers.Y_LOCATION))
                    temp += modifiers.get(Modifiers.Y_LOCATION)!;

                temp = temp.trim();
                mods.push(new Modifier("X Y", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.W_DTG_1))
            {
                y = 2;//above center
                if(!strict && !(modifiers.has(Modifiers.X_ALTITUDE_DEPTH) || modifiers.has(Modifiers.Y_LOCATION)))
                    y--;

                temp = modifiers.get(Modifiers.W_DTG_1)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("W", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.C_QUANTITY) || modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1))
            {
                y = -1;//below center
                temp = "";
                if(modifiers.has(Modifiers.C_QUANTITY))
                    temp = modifiers.get(Modifiers.C_QUANTITY) + sep;
                if(modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1))
                    temp += modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1);

                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("C T", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.Z_SPEED))
            {
                y = -2;
                if(!strict && !(modifiers.has(Modifiers.C_QUANTITY) || modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1)))
                    y++;
                temp = modifiers.get(Modifiers.Z_SPEED)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("Z", temp, x, y, centered));
            }
        }
        else if(ss == SymbolID.SymbolSet_LandEquipment ||
                (ss == SymbolID.SymbolSet_SignalsIntelligence && fs == SymbolID.FrameShape_LandEquipment))
        {
            //Do top center label
            x = 0;//centered
            y = 9;//on top of symbol
            if(modifiers.has(Modifiers.C_QUANTITY))
            {
                temp = modifiers.get(Modifiers.C_QUANTITY)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("C", temp, x, y, centered));
            }

            //Do right side labels
            x = 1;//on right
            centered = false;

            if(modifiers.has(Modifiers.G_STAFF_COMMENTS) || modifiers.has(Modifiers.AQ_GUARDED_UNIT))
            {
                y = 1;//above center
                temp = "";
                if(modifiers.has(Modifiers.G_STAFF_COMMENTS))
                    temp = modifiers.get(Modifiers.G_STAFF_COMMENTS)! + sep;
                if(modifiers.has(Modifiers.AQ_GUARDED_UNIT))
                    temp += modifiers.get(Modifiers.AQ_GUARDED_UNIT)!;
                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("G AQ", temp, x, y, centered));
            }

            if( modifiers.has(Modifiers.AS_COUNTRY))
            {
                y = 2;
                if(!strict && !(modifiers.has(Modifiers.G_STAFF_COMMENTS) || modifiers.has(Modifiers.AQ_GUARDED_UNIT)))
                    y--;
                temp = modifiers.get(Modifiers.AS_COUNTRY)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("AS", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.H_ADDITIONAL_INFO_1) ||
                    modifiers.has(Modifiers.AF_COMMON_IDENTIFIER))
            {
                y = -1;
                temp = "";
                if(modifiers.has(Modifiers.H_ADDITIONAL_INFO_1))
                    temp = modifiers.get(Modifiers.H_ADDITIONAL_INFO_1)! + sep;
                if(modifiers.has(Modifiers.AF_COMMON_IDENTIFIER))
                    temp += modifiers.get(Modifiers.AF_COMMON_IDENTIFIER)!;
                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("H AF", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.J_EVALUATION_RATING) ||
                    modifiers.has(Modifiers.K_COMBAT_EFFECTIVENESS) ||
                    modifiers.has(Modifiers.L_SIGNATURE_EQUIP) ||
                    modifiers.has(Modifiers.P_IFF_SIF_AIS))
            {
                y = -2;
                if(!strict && !(modifiers.has(Modifiers.H_ADDITIONAL_INFO_1) ||
                        modifiers.has(Modifiers.AF_COMMON_IDENTIFIER)))
                    y++;
                temp = "";
                if(modifiers.has(Modifiers.J_EVALUATION_RATING))
                    temp = modifiers.get(Modifiers.J_EVALUATION_RATING)! + sep;
                if(modifiers.has(Modifiers.K_COMBAT_EFFECTIVENESS))
                    temp += modifiers.get(Modifiers.K_COMBAT_EFFECTIVENESS)! + sep;
                if(modifiers.has(Modifiers.L_SIGNATURE_EQUIP))
                    temp += modifiers.get(Modifiers.L_SIGNATURE_EQUIP)! + sep;
                if(modifiers.has(Modifiers.P_IFF_SIF_AIS))
                    temp += modifiers.get(Modifiers.P_IFF_SIF_AIS)!;
                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("J K L P", temp, x, y, centered));
            }

            //Do left side labels
            x = -1;//on left

            if(modifiers.has(Modifiers.V_EQUIP_TYPE) ||
                    modifiers.has(Modifiers.AD_PLATFORM_TYPE) ||
                    modifiers.has(Modifiers.AE_EQUIPMENT_TEARDOWN_TIME))
            {
                y = 0;//center
                centered = true;//vertically centered, only matters for labels on left and right side

                temp = "";
                if(modifiers.has(Modifiers.V_EQUIP_TYPE))
                    temp = modifiers.get(Modifiers.V_EQUIP_TYPE)! + sep;
                if(modifiers.has(Modifiers.AD_PLATFORM_TYPE))
                    temp += modifiers.get(Modifiers.AD_PLATFORM_TYPE)! + sep;
                if(modifiers.has(Modifiers.AE_EQUIPMENT_TEARDOWN_TIME))
                    temp += modifiers.get(Modifiers.AE_EQUIPMENT_TEARDOWN_TIME)!;
                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("V AD AE", temp, x, y, centered));
            }
            else if(!strict)
            {
                centered = false;
            }

            if(modifiers.has(Modifiers.X_ALTITUDE_DEPTH) || modifiers.has(Modifiers.Y_LOCATION))
            {
                y = 1;
                temp = "";
                if(modifiers.has(Modifiers.X_ALTITUDE_DEPTH))
                    temp = modifiers.get(Modifiers.X_ALTITUDE_DEPTH)! + sep;
                if(modifiers.has(Modifiers.Y_LOCATION))
                    temp += modifiers.get(Modifiers.Y_LOCATION)!;

                temp = temp.trim();
                mods.push(new Modifier("X Y", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.W_DTG_1))
            {
                y = 2;//above center
                if(!strict && !(modifiers.has(Modifiers.X_ALTITUDE_DEPTH) || modifiers.has(Modifiers.Y_LOCATION)))
                    y--;

                temp = modifiers.get(Modifiers.W_DTG_1)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("W", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1))
            {
                y = -1;//below center
                temp = modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1)!;

                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("T", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.Z_SPEED))
            {
                y = -2;
                if(!strict && !modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1))
                    y++;
                temp = modifiers.get(Modifiers.Z_SPEED)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("Z", temp, x, y, centered));
            }
        }
        else if(ss == SymbolID.SymbolSet_LandInstallation)
        {
            //No top center label

            //Do right side labels
            x = 1;//on right
            if(modifiers.has(Modifiers.H_ADDITIONAL_INFO_1))
            {
                y = 0;//center
                centered = true;//vertically centered, only matters for labels on left and right side
                temp = modifiers.get(Modifiers.H_ADDITIONAL_INFO_1) + sep;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("H", temp, x, y, centered));
            }
            else if(!strict)
            {
                //if no "H', bring G and M closer to the center
                centered = false;
            }

            if(modifiers.has(Modifiers.G_STAFF_COMMENTS) || modifiers.has(Modifiers.AQ_GUARDED_UNIT))
            {
                y = 1;//above center
                temp = "";
                if(modifiers.has(Modifiers.G_STAFF_COMMENTS))
                    temp = modifiers.get(Modifiers.G_STAFF_COMMENTS)! + sep;
                if(modifiers.has(Modifiers.AQ_GUARDED_UNIT))
                    temp += modifiers.get(Modifiers.AQ_GUARDED_UNIT)!;
                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("G AQ", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.AS_COUNTRY))
            {
                y = 2;
                if(!strict && !(modifiers.has(Modifiers.G_STAFF_COMMENTS) || modifiers.has(Modifiers.AQ_GUARDED_UNIT)))
                    y--;
                temp = modifiers.get(Modifiers.AS_COUNTRY)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("AS", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.M_HIGHER_FORMATION))
            {
                y = -1;//below center
                temp = modifiers.get(Modifiers.M_HIGHER_FORMATION)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("M", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.J_EVALUATION_RATING) ||
                    modifiers.has(Modifiers.K_COMBAT_EFFECTIVENESS) ||
                    modifiers.has(Modifiers.P_IFF_SIF_AIS))
            {
                y = -2;
                if(!strict && !modifiers.has(Modifiers.M_HIGHER_FORMATION))
                    y++;
                temp = "";
                if(modifiers.has(Modifiers.J_EVALUATION_RATING))
                    temp = modifiers.get(Modifiers.J_EVALUATION_RATING)! + sep;
                if(modifiers.has(Modifiers.K_COMBAT_EFFECTIVENESS))
                    temp += modifiers.get(Modifiers.K_COMBAT_EFFECTIVENESS)! + sep;
                if(modifiers.has(Modifiers.P_IFF_SIF_AIS))
                    temp += modifiers.get(Modifiers.P_IFF_SIF_AIS)!;
                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("J K P", temp, x, y, centered));
            }

            //Do left side labels
            x = -1;//on left
            centered = false;

            if(modifiers.has(Modifiers.X_ALTITUDE_DEPTH) || modifiers.has(Modifiers.Y_LOCATION))
            {
                y = 1;
                temp = "";
                if(modifiers.has(Modifiers.X_ALTITUDE_DEPTH))
                    temp = modifiers.get(Modifiers.X_ALTITUDE_DEPTH)! + sep;
                if(modifiers.has(Modifiers.Y_LOCATION))
                    temp += modifiers.get(Modifiers.Y_LOCATION)!;

                temp = temp.trim();
                mods.push(new Modifier("X Y", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.W_DTG_1))
            {
                y = 2;//above center
                if(!strict && !(modifiers.has(Modifiers.X_ALTITUDE_DEPTH) || modifiers.has(Modifiers.Y_LOCATION)))
                    y--;

                temp = modifiers.get(Modifiers.W_DTG_1)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("W", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.C_QUANTITY) || modifiers.has(Modifiers.AE_EQUIPMENT_TEARDOWN_TIME))
            {
                y = -1;//below center
                temp = "";
                if(modifiers.has(Modifiers.C_QUANTITY))
                    temp = modifiers.get(Modifiers.C_QUANTITY) + sep;
                if(modifiers.has(Modifiers.AE_EQUIPMENT_TEARDOWN_TIME))
                    temp += modifiers.get(Modifiers.AE_EQUIPMENT_TEARDOWN_TIME)!;

                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("C AE", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1))
            {
                y = -2;
                if(!strict && !(modifiers.has(Modifiers.C_QUANTITY) || modifiers.has(Modifiers.AE_EQUIPMENT_TEARDOWN_TIME)))
                    y++;
                temp = modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("T", temp, x, y, centered));
            }
        }
        else if(ss == SymbolID.SymbolSet_Space ||
                ss == SymbolID.SymbolSet_SpaceMissile ||
                ss == SymbolID.SymbolSet_Air ||
                ss == SymbolID.SymbolSet_AirMissile ||
                (ss == SymbolID.SymbolSet_SignalsIntelligence &&
                        (fs == SymbolID.FrameShape_Space || fs == SymbolID.FrameShape_Air)))
        {
            //No top center label
            x = 0;//centered
            y = 9;//on top of symbol

            if(modifiers.has(Modifiers.C_QUANTITY))
            {
                temp = modifiers.get(Modifiers.C_QUANTITY)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("C", temp, x, y, centered));
            }
            else if(modifiers.has(Modifiers.B_ECHELON))
            {
                temp = modifiers.get(Modifiers.B_ECHELON)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("B", temp, x, y, centered));
            }


            //Do right side labels
            x = 1;//on right
            centered = true;

            if(modifiers.has(Modifiers.V_EQUIP_TYPE) || modifiers.has(Modifiers.AF_COMMON_IDENTIFIER))
            {
                y = 0;//
                temp = "";
                if(modifiers.has(Modifiers.V_EQUIP_TYPE))
                    temp = modifiers.get(Modifiers.V_EQUIP_TYPE)! + sep;
                if(modifiers.has(Modifiers.AF_COMMON_IDENTIFIER))
                    temp += modifiers.get(Modifiers.AF_COMMON_IDENTIFIER)!;
                temp = temp.trim();

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("V AF", temp, x, y, centered));
            }
            else
            {
                centered = false;
            }

            if(modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1) || modifiers.has(Modifiers.Y_LOCATION))
            {
                y = 1;//above center
                temp = "";
                if(modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1))
                    temp = modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1) + sep;
                if(modifiers.has(Modifiers.Y_LOCATION))
                    temp += modifiers.get(Modifiers.Y_LOCATION)!;
                temp = temp.trim();

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("T Y", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.AS_COUNTRY))
            {
                y = 2;
                if(!strict && !(modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1) || modifiers.has(Modifiers.Y_LOCATION)))
                    y--;
                temp = modifiers.get(Modifiers.AS_COUNTRY)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("AS", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.P_IFF_SIF_AIS)  ||
                    modifiers.has(Modifiers.X_ALTITUDE_DEPTH)  ||
                    modifiers.has(Modifiers.Z_SPEED))
            {
                y = -1;//below center
                temp = "";
                if(modifiers.has(Modifiers.P_IFF_SIF_AIS))
                    temp = modifiers.get(Modifiers.P_IFF_SIF_AIS) + sep;
                if(modifiers.has(Modifiers.X_ALTITUDE_DEPTH))
                    temp = modifiers.get(Modifiers.X_ALTITUDE_DEPTH)! + sep;
                if(modifiers.has(Modifiers.Z_SPEED))
                    temp = modifiers.get(Modifiers.Z_SPEED)!;

                temp = temp.trim();

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("P X Z", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.G_STAFF_COMMENTS) ||
                    modifiers.has(Modifiers.H_ADDITIONAL_INFO_1) ||
                    modifiers.has(Modifiers.J_EVALUATION_RATING))
            {
                y = -2;//below center
                if(!(modifiers.has(Modifiers.P_IFF_SIF_AIS)  ||
                        modifiers.has(Modifiers.X_ALTITUDE_DEPTH)  ||
                        modifiers.has(Modifiers.Z_SPEED)))
                    y++;

                temp = "";
                if(modifiers.has(Modifiers.G_STAFF_COMMENTS))
                    temp = modifiers.get(Modifiers.G_STAFF_COMMENTS)! + sep;
                if(modifiers.has(Modifiers.H_ADDITIONAL_INFO_1))
                    temp = modifiers.get(Modifiers.H_ADDITIONAL_INFO_1)! + sep;
                if(modifiers.has(Modifiers.J_EVALUATION_RATING))
                    temp += modifiers.get(Modifiers.J_EVALUATION_RATING);
                temp = temp.trim();

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("G H J", temp, x, y, centered));
            }

            //No left side labels
            x = -1;//on right
            centered = true;

            if(modifiers.has(Modifiers.AD_PLATFORM_TYPE))
            {
                y = 0;//
                temp = (temp ?? "") + modifiers.get(Modifiers.AD_PLATFORM_TYPE)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("AD", temp, x, y, centered));
            }
            else
            {
                centered = false;
            }

            if(modifiers.has(Modifiers.AR_SPECIAL_DESIGNATOR))
            {
                y = 1;//above center
                temp = modifiers.get(Modifiers.AR_SPECIAL_DESIGNATOR)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("AR", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.W_DTG_1))
            {
                y = 2;
                if(!strict && !modifiers.has(Modifiers.AR_SPECIAL_DESIGNATOR))
                    y--;
                temp = modifiers.get(Modifiers.W_DTG_1)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("W", temp, x, y, centered));
            }
        }
        else if(ss == SymbolID.SymbolSet_SeaSurface ||
                (ss == SymbolID.SymbolSet_SignalsIntelligence && fs == SymbolID.FrameShape_SeaSurface))
        {
            //No top center label


            //Do right side labels
            x = 1;//on right
            centered = false;

            if(modifiers.has(Modifiers.V_EQUIP_TYPE))
            {
                y = 1;//above center
                temp = modifiers.get(Modifiers.V_EQUIP_TYPE)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("V", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1))
            {
                y = 2;
                if(!strict && !modifiers.has(Modifiers.V_EQUIP_TYPE))
                    y--;
                temp = modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("T", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.AS_COUNTRY))
            {
                y = 3;
                if(!strict)
                {
                    if(!modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1))
                        y--;
                    if(!modifiers.has(Modifiers.V_EQUIP_TYPE))
                        y--;
                }

                temp = modifiers.get(Modifiers.AS_COUNTRY )!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("AS", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.P_IFF_SIF_AIS))
            {
                y = -1;//below center
                temp = modifiers.get(Modifiers.P_IFF_SIF_AIS)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("P", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.G_STAFF_COMMENTS)  ||
                    modifiers.has(Modifiers.H_ADDITIONAL_INFO_1))
            {
                y = -2;//below center
                if(!modifiers.has(Modifiers.P_IFF_SIF_AIS))
                    y++;

                temp = "";
                if(modifiers.has(Modifiers.G_STAFF_COMMENTS))
                    temp = modifiers.get(Modifiers.G_STAFF_COMMENTS)! + sep;
                if(modifiers.has(Modifiers.H_ADDITIONAL_INFO_1))
                    temp += modifiers.get(Modifiers.H_ADDITIONAL_INFO_1);
                temp = temp.trim();

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("G H", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.Y_LOCATION) ||
                    modifiers.has(Modifiers.Z_SPEED))
            {
                y = -3;
                if(!strict)
                {
                    if(!(modifiers.has(Modifiers.G_STAFF_COMMENTS)  ||
                            modifiers.has(Modifiers.H_ADDITIONAL_INFO_1)))
                        y++;
                    if(!modifiers.has(Modifiers.P_IFF_SIF_AIS))
                        y++;
                }
                temp = "";
                if(modifiers.has(Modifiers.Y_LOCATION))
                    temp = modifiers.get(Modifiers.Y_LOCATION) + sep;
                if(modifiers.has(Modifiers.Z_SPEED))
                    temp += modifiers.get(Modifiers.Z_SPEED);
                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("Y Z", temp, x, y, centered));
            }

            //No left side labels
            x = -1;
            centered = false;
            if(modifiers.has(Modifiers.AQ_GUARDED_UNIT) ||
                    modifiers.has(Modifiers.AR_SPECIAL_DESIGNATOR))
            {
                y = 2;
                if(!strict)
                {
                    y--;
                }
                temp = "";
                if(modifiers.has(Modifiers.AQ_GUARDED_UNIT))
                    temp = modifiers.get(Modifiers.AQ_GUARDED_UNIT)! + sep;
                if(modifiers.has(Modifiers.AR_SPECIAL_DESIGNATOR))
                    temp += modifiers.get(Modifiers.AR_SPECIAL_DESIGNATOR)!;
                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("AQ AR", temp, x, y, centered));
            }
        }
        else if(ss == SymbolID.SymbolSet_SeaSubsurface ||
                (ss == SymbolID.SymbolSet_SignalsIntelligence && fs == SymbolID.FrameShape_SeaSubsurface))
        {
            //No top center label


            //Do right side labels
            x = 1;//on right
            centered = false;

            if(modifiers.has(Modifiers.V_EQUIP_TYPE))
            {
                y = 1;//above center
                temp = modifiers.get(Modifiers.V_EQUIP_TYPE)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("V", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1))
            {
                y = 2;
                if(!strict && !modifiers.has(Modifiers.V_EQUIP_TYPE))
                    y--;
                temp = modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("T", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.AS_COUNTRY))
            {
                y = 3;
                if(!strict)
                {
                    if(!modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1))
                        y--;
                    if(!modifiers.has(Modifiers.V_EQUIP_TYPE))
                        y--;
                }

                temp = modifiers.get(Modifiers.AS_COUNTRY )!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("AS", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.P_IFF_SIF_AIS))
            {
                y = -1;//below center
                temp = modifiers.get(Modifiers.P_IFF_SIF_AIS)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("P", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.G_STAFF_COMMENTS)  ||
                    modifiers.has(Modifiers.H_ADDITIONAL_INFO_1))
            {
                y = -2;//below center
                if(!modifiers.has(Modifiers.P_IFF_SIF_AIS))
                    y++;

                temp = "";
                if(modifiers.has(Modifiers.G_STAFF_COMMENTS))
                    temp = modifiers.get(Modifiers.G_STAFF_COMMENTS)! + sep;
                if(modifiers.has(Modifiers.H_ADDITIONAL_INFO_1))
                    temp += modifiers.get(Modifiers.H_ADDITIONAL_INFO_1);
                temp = temp.trim();

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("G H", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.Y_LOCATION) ||
                    modifiers.has(Modifiers.Z_SPEED))
            {
                y = -3;
                if(!strict)
                {
                    if(!(modifiers.has(Modifiers.G_STAFF_COMMENTS)  ||
                            modifiers.has(Modifiers.H_ADDITIONAL_INFO_1)))
                        y++;
                    if(!modifiers.has(Modifiers.P_IFF_SIF_AIS))
                        y++;
                }
                temp = "";
                if(modifiers.has(Modifiers.Y_LOCATION))
                    temp = modifiers.get(Modifiers.Y_LOCATION) + sep;
                if(modifiers.has(Modifiers.Z_SPEED))
                    temp += modifiers.get(Modifiers.Z_SPEED);
                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("Y Z", temp, x, y, centered));
            }

            //No left side labels
            x = -1;
            centered = false;
            if(modifiers.has(Modifiers.X_ALTITUDE_DEPTH))
            {
                y = 1;
                temp = modifiers.get(Modifiers.X_ALTITUDE_DEPTH)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("X", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.AR_SPECIAL_DESIGNATOR))
            {
                y = 2;
                if(!strict && !modifiers.has(Modifiers.X_ALTITUDE_DEPTH))
                {
                    y--;
                }
                temp = modifiers.get(Modifiers.AR_SPECIAL_DESIGNATOR)!;
                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("AR", temp, x, y, centered));
            }
        }
        else if(ss == SymbolID.SymbolSet_DismountedIndividuals)
        {
            //No top center label


            //Do right side labels
            x = 1;//on right
            if(modifiers.has(Modifiers.H_ADDITIONAL_INFO_1))
            {
                y = 0;//center
                centered = true;//vertically centered, only matters for labels on left and right side
                temp = modifiers.get(Modifiers.H_ADDITIONAL_INFO_1)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("H", temp, x, y, centered));
            }
            else if(!strict)
            {
                centered = false;
            }

            if(modifiers.has(Modifiers.G_STAFF_COMMENTS))
            {
                y = 1;//above center
                temp = modifiers.get(Modifiers.G_STAFF_COMMENTS)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("G", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.AS_COUNTRY))
            {
                y = 2;
                if(!strict && !(modifiers.has(Modifiers.G_STAFF_COMMENTS)))
                    y--;
                temp = modifiers.get(Modifiers.AS_COUNTRY)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("AS", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.M_HIGHER_FORMATION))
            {
                y = -1;//below center
                temp = modifiers.get(Modifiers.M_HIGHER_FORMATION)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("M", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.J_EVALUATION_RATING) ||
                    modifiers.has(Modifiers.K_COMBAT_EFFECTIVENESS) ||
                    modifiers.has(Modifiers.P_IFF_SIF_AIS))
            {
                y = -2;
                if(!strict && !modifiers.has(Modifiers.M_HIGHER_FORMATION))
                    y++;
                temp = "";
                if(modifiers.has(Modifiers.J_EVALUATION_RATING))
                    temp = modifiers.get(Modifiers.J_EVALUATION_RATING)! + sep;
                if(modifiers.has(Modifiers.K_COMBAT_EFFECTIVENESS))
                    temp += modifiers.get(Modifiers.K_COMBAT_EFFECTIVENESS)! + sep;
                if(modifiers.has(Modifiers.P_IFF_SIF_AIS))
                    temp += modifiers.get(Modifiers.P_IFF_SIF_AIS)!;
                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("J K P", temp, x, y, centered));
            }

            //Do left side labels
            x = -1;//on left

            if(modifiers.has(Modifiers.V_EQUIP_TYPE) ||
                    modifiers.has(Modifiers.AF_COMMON_IDENTIFIER))
            {
                y = 0;//center
                centered = true;//vertically centered, only matters for labels on left and right side

                temp = "";
                if(modifiers.has(Modifiers.V_EQUIP_TYPE))
                    temp = modifiers.get(Modifiers.V_EQUIP_TYPE)! + sep;
                if(modifiers.has(Modifiers.AF_COMMON_IDENTIFIER))
                    temp += modifiers.get(Modifiers.AF_COMMON_IDENTIFIER)!;
                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("V AF", temp, x, y, centered));
            }
            else if(!strict)
            {
                centered = false;
            }

            if(modifiers.has(Modifiers.X_ALTITUDE_DEPTH) || modifiers.has(Modifiers.Y_LOCATION))
            {
                y = 1;
                temp = "";
                if(modifiers.has(Modifiers.X_ALTITUDE_DEPTH))
                    temp = modifiers.get(Modifiers.X_ALTITUDE_DEPTH)! + sep;
                if(modifiers.has(Modifiers.Y_LOCATION))
                    temp += modifiers.get(Modifiers.Y_LOCATION)!;

                temp = temp.trim();
                mods.push(new Modifier("X Y", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.W_DTG_1))
            {
                y = 2;//above center
                if(!strict && !(modifiers.has(Modifiers.X_ALTITUDE_DEPTH) || modifiers.has(Modifiers.Y_LOCATION)))
                    y--;

                temp = modifiers.get(Modifiers.W_DTG_1)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("W", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1))
            {
                y = -1;//below center
                temp = modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("T", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.Z_SPEED))
            {
                y = -2;
                if(!strict && !(modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1)))
                    y++;
                temp = modifiers.get(Modifiers.Z_SPEED)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("Z", temp, x, y, centered));
            }
        }
        else if(ss == SymbolID.SymbolSet_Activities)
        {
            //No top center label


            //Do right side labels
            x = 1;//on right
            if(modifiers.has(Modifiers.G_STAFF_COMMENTS))
            {
                y = 0;//center
                centered = true;//vertically centered, only matters for labels on left and right side
                temp = modifiers.get(Modifiers.G_STAFF_COMMENTS)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("G", temp, x, y, centered));
            }
            else if(!strict)
            {
                centered = false;
            }

            if(modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1))
            {
                y = 1;//above center
                temp = modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("T", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.AS_COUNTRY))
            {
                y = 2;
                if(!strict && !(modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1)))
                    y--;
                temp = modifiers.get(Modifiers.AS_COUNTRY)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("AS", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.H_ADDITIONAL_INFO_1))
            {
                y = -1;//below center
                temp = modifiers.get(Modifiers.H_ADDITIONAL_INFO_1)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("H", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.J_EVALUATION_RATING))
            {
                y = -2;
                if(!strict && !modifiers.has(Modifiers.H_ADDITIONAL_INFO_1))
                    y++;
                temp = modifiers.get(Modifiers.J_EVALUATION_RATING)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("J", temp, x, y, centered));
            }

            //Do left side labels
            x = -1;//on left

            if(!strict)
            {
                centered = false;
            }

            if(modifiers.has(Modifiers.Y_LOCATION))
            {
                y = 1;
                temp = modifiers.get(Modifiers.Y_LOCATION)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("Y", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.W_DTG_1))
            {
                y = 2;//above center
                if(!strict && !(modifiers.has(Modifiers.Y_LOCATION)))
                    y--;

                temp = modifiers.get(Modifiers.W_DTG_1)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("W", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.C_QUANTITY))
            {
                y = -1;//below center
                temp = modifiers.get(Modifiers.C_QUANTITY)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("C", temp, x, y, centered));
            }

        }
        else if(ss == SymbolID.SymbolSet_CyberSpace ||
                (ss == SymbolID.SymbolSet_SignalsIntelligence && fs == SymbolID.FrameShape_Cyberspace))
        {
            //Do top center label
            x = 0;//centered
            y = 9;//on top of symbol
            if(modifiers.has(Modifiers.B_ECHELON))
            {
                temp = modifiers.get(Modifiers.B_ECHELON)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("B", temp, x, y, centered));
            }

            //Do right side labels
            x = 1;//on right
            if(modifiers.has(Modifiers.H_ADDITIONAL_INFO_1))
            {
                y = 0;//center
                centered = true;//vertically centered, only matters for labels on left and right side
                temp = modifiers.get(Modifiers.H_ADDITIONAL_INFO_1)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("H", temp, x, y, centered));
            }
            else if(!strict)
            {
                centered = false;
            }

            if(modifiers.has(Modifiers.G_STAFF_COMMENTS))
            {
                y = 1;//above center
                temp = modifiers.get(Modifiers.G_STAFF_COMMENTS)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("G", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.F_REINFORCED_REDUCED) || modifiers.has(Modifiers.AS_COUNTRY))
            {
                y = 2;
                if(!strict && !(modifiers.has(Modifiers.G_STAFF_COMMENTS)))
                    y--;
                temp = "";
                if(modifiers.has(Modifiers.F_REINFORCED_REDUCED))
                    temp = modifiers.get(Modifiers.F_REINFORCED_REDUCED)! + sep;
                if(modifiers.has(Modifiers.AS_COUNTRY))
                    temp += modifiers.get(Modifiers.AS_COUNTRY)!;
                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("F AS", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.M_HIGHER_FORMATION))
            {
                y = -1;//below center
                temp = modifiers.get(Modifiers.M_HIGHER_FORMATION)!;
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("M", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.K_COMBAT_EFFECTIVENESS) || modifiers.has(Modifiers.L_SIGNATURE_EQUIP))
            {
                y = -2;
                if(!strict && !modifiers.has(Modifiers.M_HIGHER_FORMATION))
                    y++;
                temp = "";
                if(modifiers.has(Modifiers.K_COMBAT_EFFECTIVENESS))
                    temp = modifiers.get(Modifiers.K_COMBAT_EFFECTIVENESS) + sep;
                if(modifiers.has(Modifiers.L_SIGNATURE_EQUIP))
                    temp += modifiers.get(Modifiers.L_SIGNATURE_EQUIP);
                temp = temp.trim();
                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("K L", temp, x, y, centered));
            }

            //Do left side labels
            x=-1;
            if(modifiers.has(Modifiers.V_EQUIP_TYPE))
            {
                y = 0;//center
                centered = true;//vertically centered, only matters for labels on left and right side

                temp = modifiers.get(Modifiers.V_EQUIP_TYPE)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("V", temp, x, y, centered));
            }
            else if(!strict)
            {
                centered = false;
            }

            if(modifiers.has(Modifiers.Y_LOCATION))
            {
                y = 1;
                temp = modifiers.get(Modifiers.Y_LOCATION)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("Y", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.W_DTG_1))
            {
                y = 2;//above center
                if(!strict && !(modifiers.has(Modifiers.Y_LOCATION)))
                    y--;

                temp = modifiers.get(Modifiers.W_DTG_1)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("W", temp, x, y, centered));
            }

            if(modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1))
            {
                y = -1;//below center
                temp = modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1)!;

                if(temp !==  null && temp !== "")
                    mods.push(new Modifier("T", temp, x, y, centered));
            }
        }
        /*else if(ver == SymbolID.SymbolSet_MineWarfare)
        {
            //no modifiers
        }//*/
        //else//SymbolSet Unknown
        //processUnknownTextModifiers
    }

    return mods;
}

/**
 *
 * @param bounds bounds of the core icon
 * @param labelWidth height of the label to be placed
 * @param buffer additional horizontal spacing buffer between label and symbol if desired
 * @param location -1 left, 0 center, 1 right
 * @param modifierFontHeight
 * @returns
 */
export function getLabelXPosition(bounds:Rectangle2D, labelWidth:number, location:number, modifierFontHeight:number):number
{
    let x:number = 0;
    let buffer:number = modifierFontHeight/2;
    if(location ===  1)
    {
        //x = (int)(bounds.getX() + bounds.getWidth() + bufferXR);
        x = bounds.getX() + bounds.getWidth() + buffer;
    }
    else if (location ===  -1)
    {
        //x = (int) (bounds.getX() - labelWidth - bufferXL);
        x = bounds.x - labelWidth - buffer;
    }
    else if (location ===  0)
    {
        x = Math.round((bounds.getX() + (bounds.getWidth() * 0.5)) - (labelWidth * 0.5));
    }
    return x;
}

/**
 *
 * @param bounds bounds of the core icon
 * @param labelHeight height of the label to be placed
 * @param descent descent of the label to be placed
 * @param bufferText additional vertical spacing buffer between labels if desired
 * @param centered if true, there will be a center label location identified by 0
 * @param location positive 1, 2, 3 to be above symbol mid-point or negative values to be below
 * @returns y position
 */
export function getLabelYPosition(bounds:Rectangle2D, labelHeight:number, descent:number, bufferText:number, centered:boolean, location:number):number
{
    let y:number = 0;
    if (bounds !==  null && !bounds.isEmpty())
    {
        if(centered)
        {
            switch (location)
            {
                case 3://3 above center
                    y = (bounds.getHeight());
                    y = ((y * 0.5) + (labelHeight * 0.5));
                    y = y - ((labelHeight + bufferText) * 3);
                    y = bounds.getY() + y;
                    break;
                case 2://2 above center
                    y = (bounds.getHeight());
                    y = ((y * 0.5) + (labelHeight * 0.5));
                    y = y - ((labelHeight + bufferText) * 2);
                    y = bounds.getY() + y;
                    break;
                case 1://1 above center
                    y = (bounds.getHeight());
                    y = ((y * 0.5) + (labelHeight * 0.5));
                    y = y - ((labelHeight + bufferText));
                    y = bounds.getY() + y;
                    break;
                case 0: //centered
                    y = (bounds.getHeight());
                    y = ((y * 0.5) + ((labelHeight - descent) * 0.5));
                    y = bounds.getY() + y;
                    break;
                case -1://1 below center
                    y = (bounds.getHeight());
                    y = ((y * 0.5) + (labelHeight * 0.5));
                    y = y + ((labelHeight + bufferText - descent));
                    y = bounds.getY() + y;
                    break;
                case -2://2 below center
                    y = (bounds.getHeight());
                    y = ((y * 0.5) + (labelHeight * 0.5));
                    y = y + ((labelHeight + bufferText) * 2) - (descent);
                    y = bounds.getY() + y;
                    break;
                case -3://3 below center
                    y = (bounds.getHeight());
                    y = ((y * 0.5) + (labelHeight * 0.5));
                    y = y + ((labelHeight + bufferText) * 3) - (descent);
                    y = bounds.getY() + y;
                    break;
            }
        }
        else//split between top and bottom
        {
            switch (location)
            {
                case 3:
                    y = (bounds.getY() + ((bounds.getHeight() / 2) - descent - labelHeight*2 - bufferText));
                    break;
                case 2:
                    y = (bounds.getY() + ((bounds.getHeight() / 2) - descent - labelHeight - bufferText));
                    break;
                case 1:
                    y = (bounds.getY() + ((bounds.getHeight() / 2) - descent));
                    break;
                case -1:
                    y = (bounds.getY() + (bounds.getHeight() / 2) + (labelHeight - descent + bufferText));
                    break;
                case -2:
                    y = (bounds.getY() + (bounds.getHeight() / 2) + ((labelHeight*2 - descent + bufferText)));
                    break;
                case -3:
                    y = (bounds.getY() + (bounds.getHeight() / 2) + ((labelHeight*3 - descent + bufferText)));
                    break;
            }
        }
        if(location ===  9)
        {
            y = Math.round(bounds.getY() - bufferText - descent);
        }
    }
    return y;
}
