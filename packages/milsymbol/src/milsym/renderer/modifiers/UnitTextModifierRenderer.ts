//Graphics2D
import { Font } from "../../graphics/Font"
import { Point2D } from "../../graphics/Point2D"
import { Rectangle2D } from "../../graphics/Rectangle2D"

//Renderer.Utilities
import { Color } from "../utilities/Color"
import { gencLookup } from "../utilities/GENCLookup"
import { MilStdAttributes } from "../utilities/MilStdAttributes"
import { Modifiers } from "../utilities/Modifiers"
import { RectUtilities } from "../utilities/RectUtilities"
import { RendererSettings, rendererSettings } from "../utilities/RendererSettings"
import { SymbolDimensionInfo } from "../utilities/SymbolDimensionInfo"
import { SymbolID } from "../utilities/SymbolID"
import { SymbolUtilities } from "../utilities/SymbolUtilities"
import { TextInfo } from "../utilities/TextInfo"

//Shapes
import { Rectangle } from "../shapes/rectangle"

//Sub-module imports
import { shiftUnitPointsAndDraw, getFont, getFontHeightandDescent, isCOnTop } from "./ModifierRenderUtils"
import { getLabelPositionIndexes, getLabelXPosition, getLabelYPosition } from "./TextModifierLayout"
import { Modifier } from "../utilities/Modifier";

/**
 * Process unknown text modifiers for units
 * @param sdi Symbol dimension info
 * @param symbolID Symbol ID
 * @param modifiers Modifiers map
 * @param attributes Attributes map
 * @param frc Rendering context
 * @returns Updated SymbolDimensionInfo
 */
export function processUnknownTextModifiers(sdi: SymbolDimensionInfo, symbolID: string, modifiers: Map<string, string>, attributes: Map<string, string>, frc: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D): SymbolDimensionInfo {
    let ii: any;
    let ssi: any;

    let modifierFont: Font = getFont(attributes);//ModifierRenderer.RS.getLabelFont();
    let hd:number[] = getFontHeightandDescent(modifierFont,frc);
    let modifierFontHeight: number = hd[0];
    let modifierFontDescent: number = hd[1];

    let bufferHorizontal = modifierFontHeight/2;
    let bufferXL: number = bufferHorizontal;
    let bufferXR: number = bufferHorizontal;
    let bufferY: number = 2;
    let bufferText: number = 2;
    let x: number = 0;
    let y: number = 0;//best y

    let newsdi: SymbolDimensionInfo | null;
    let alpha: number = -1;

    let textColor: Color = Color.BLACK;
    let textBackgroundColor: Color;

    let tiArray: Array<TextInfo> = new Array<TextInfo>();

    if (attributes.has(MilStdAttributes.Alpha)) {
        alpha = parseFloat(attributes.get(MilStdAttributes.Alpha)!) / 255;
    }

    let labelBounds: Rectangle2D;
    let labelWidth: number = 0;
    let labelHeight: number = 0;

    let bounds: Rectangle2D = (sdi.getSymbolBounds().clone()) as Rectangle2D;
    let symbolBounds: Rectangle2D = (sdi.getSymbolBounds().clone()) as Rectangle2D;
    let centerPoint: Point2D = sdi.getSymbolCenterPoint();
    let imageBounds: Rectangle2D = new Rectangle(sdi.getImageBounds().getX() as number, sdi.getImageBounds().getY() as number, sdi.getImageBounds().getWidth() as number, sdi.getImageBounds().getHeight() as number).toRectangle2D();
    let imageBoundsOld: Rectangle2D = imageBounds.clone() as Rectangle2D;

    let echelonText: string = SymbolUtilities.getEchelonText(SymbolID.getAmplifierDescriptor(symbolID));
    let amText: string = SymbolUtilities.getStandardIdentityModifier(symbolID);

    //adjust width of bounds for mobility/echelon/engagement bar which could be wider than the symbol
    bounds = RectUtilities.toRectangle2D(imageBounds.getX(), bounds.getY(), imageBounds.getWidth(), bounds.getHeight());



    //check if text is too tall:
    let byLabelHeight: boolean = true;
    labelHeight = (modifierFontHeight + 0.5) as number;/* RendererUtilities.measureTextHeight(RendererSettings.getModifierFontName(),
     RendererSettings.getModifierFontSize(),
     RendererSettings.getModifierFontStyle()).fullHeight;*/

    let maxHeight: number = (bounds.getHeight()) as number;
    if ((labelHeight * 3) > maxHeight) {
        byLabelHeight = true;
    }

    //Affiliation Modifier being drawn as a display modifier
    let affiliationModifier: string | null = null;
    if (rendererSettings.getDrawAffiliationModifierAsLabel() ===  true) {
        affiliationModifier = SymbolUtilities.getStandardIdentityModifier(symbolID);
    }
    if (affiliationModifier !==  null) {   //Set affiliation modifier
        modifiers.set(Modifiers.E_FRAME_SHAPE_MODIFIER, affiliationModifier);
        //modifiers[Modifiers.E_FRAME_SHAPE_MODIFIER] = affiliationModifier;
    }//*/

    //Check for Valid Country Code
    let cc: string = gencLookup.get3CharCode(SymbolID.getCountryCode(symbolID));
    if (cc !==  null && cc !== "") {
        modifiers.set(Modifiers.AS_COUNTRY, cc);
        //modifiers[Modifiers.CC_COUNTRY_CODE] = symbolID.substring(12,14);
    }

    //            int y0 = 0;//W            E/F
    //            int y1 = 0;//X/Y          G
    //            int y2 = 0;//V/AD/AE      H/AF
    //            int y3 = 0;//T            M CC
    //            int y4 = 0;//Z            J/K/L/N/P
    //
    //            y0 = bounds.y - 0;
    //            y1 = bounds.y - labelHeight;
    //            y2 = bounds.y - (labelHeight + (int)bufferText) * 2;
    //            y3 = bounds.y - (labelHeight + (int)bufferText) * 3;
    //            y4 = bounds.y - (labelHeight + (int)bufferText) * 4;
    // <editor-fold defaultstate="collapsed" desc="Build Modifiers">
    let modifierValue: string | null;
    let tiTemp: TextInfo;

    //if(Modifiers.C_QUANTITY in modifiers
    if (modifiers.has(Modifiers.C_QUANTITY)
        && SymbolUtilities.hasModifier(symbolID, Modifiers.C_QUANTITY)) {
        let text: string | undefined = modifiers.get(Modifiers.C_QUANTITY);
        if (text !== undefined) {
            //bounds = armyc2.c5isr.renderer.utilities.RendererUtilities.getTextOutlineBounds(_modifierFont, text, new SO.Point(0,0));
            tiTemp = new TextInfo(text, 0, 0, modifierFont, frc);
            labelBounds = tiTemp.getTextBounds();
            labelWidth = labelBounds.getWidth() as number;
            x = Math.round((symbolBounds.getX() + (symbolBounds.getWidth() * 0.5)) - (labelWidth * 0.5)) as number;
            y = Math.round(symbolBounds.getY() - bufferY - tiTemp.getDescent()) as number;
            tiTemp.setLocation(x, y);
            tiArray.push(tiTemp);
        }
    }

    //if(Modifiers.X_ALTITUDE_DEPTH in modifiers || Modifiers.Y_LOCATION in modifiers)
    if (modifiers.has(Modifiers.X_ALTITUDE_DEPTH) || modifiers.has(Modifiers.Y_LOCATION)) {
        modifierValue = null;

        let xm: string | null | undefined;
        let
            ym: string | null | undefined;

        if (modifiers.has(Modifiers.X_ALTITUDE_DEPTH) && SymbolUtilities.hasModifier(symbolID, Modifiers.X_ALTITUDE_DEPTH)) {
            xm = modifiers.get(Modifiers.X_ALTITUDE_DEPTH);// xm = modifiers.X;
        }
        if (modifiers.has(Modifiers.Y_LOCATION)) {
            ym = modifiers.get(Modifiers.Y_LOCATION);// ym = modifiers.Y;
        }
        if (xm == null && ym != null) {
            modifierValue = ym;
        }
        else {
            if (xm != null && ym == null) {
                modifierValue = xm;
            }
            else {
                if (xm != null && ym != null) {
                    modifierValue = xm + "  " + ym;
                }
            }

        }


        if (modifierValue !==  null) {
            tiTemp = new TextInfo(modifierValue, 0, 0, modifierFont, frc);
            labelBounds = tiTemp.getTextBounds();
            labelWidth = labelBounds.getWidth() as number;

            if (!byLabelHeight) {
                x = Math.round(bounds.getX() - labelBounds.getWidth() - bufferXL) as number;
                y = Math.round(bounds.getY() + labelHeight - tiTemp.getDescent()) as number;
            }
            else {
                x = (bounds.getX() - labelBounds.getWidth() - bufferXL) as number;

                y = (bounds.getHeight()) as number;
                y = ((y * 0.5) + (labelHeight * 0.5)) as number;

                y = y - ((labelHeight + bufferText));
                y = (bounds.getY() + y) as number;
            }

            tiTemp.setLocation(x, y);
            tiArray.push(tiTemp);
        }
    }

    if (modifiers.has(Modifiers.G_STAFF_COMMENTS) && SymbolUtilities.hasModifier(symbolID, Modifiers.G_STAFF_COMMENTS)) {
        modifierValue = modifiers.get(Modifiers.G_STAFF_COMMENTS) || null;

        if (modifierValue !==  null) {
            tiTemp = new TextInfo(modifierValue, 0, 0, modifierFont, frc);
            labelBounds = tiTemp.getTextBounds();
            labelWidth = labelBounds.getWidth() as number;

            x = (bounds.getX() + bounds.getWidth() + bufferXR) as number;
            if (!byLabelHeight) {
                y = (bounds.getY() + labelHeight - tiTemp.getDescent()) as number;
            }
            else {
                y = (bounds.getHeight()) as number;
                y = ((y * 0.5) + (labelHeight * 0.5)) as number;

                y = y - ((labelHeight + bufferText));
                y = (bounds.getY() + y) as number;
            }

            tiTemp.setLocation(x, y);
            tiArray.push(tiTemp);

        }
    }

    if ((modifiers.has(Modifiers.V_EQUIP_TYPE)) ||
        (modifiers.has(Modifiers.AD_PLATFORM_TYPE)) ||
        (modifiers.has(Modifiers.AE_EQUIPMENT_TEARDOWN_TIME))) {
        let vm: string | null | undefined;
        let
            adm: string | null | undefined;
        let
            aem: string | null | undefined;

        if (modifiers.has(Modifiers.V_EQUIP_TYPE) && SymbolUtilities.hasModifier(symbolID, Modifiers.V_EQUIP_TYPE)) {
            vm = modifiers.get(Modifiers.V_EQUIP_TYPE);
        }
        if (modifiers.has(Modifiers.AD_PLATFORM_TYPE) && SymbolUtilities.hasModifier(symbolID, Modifiers.AD_PLATFORM_TYPE)) {
            adm = modifiers.get(Modifiers.AD_PLATFORM_TYPE);
        }
        if (modifiers.has(Modifiers.AE_EQUIPMENT_TEARDOWN_TIME) && SymbolUtilities.hasModifier(symbolID, Modifiers.AE_EQUIPMENT_TEARDOWN_TIME)) {
            aem = modifiers.get(Modifiers.AE_EQUIPMENT_TEARDOWN_TIME);
        }

        modifierValue = "";
        if (vm != null && vm !== "") {

            modifierValue = vm;
        }

        if (adm != null && adm !== "") {

            modifierValue += " " + adm;
        }

        if (aem != null && aem !== "") {

            modifierValue += " " + aem;
        }


        if (modifierValue !==  null) {

            modifierValue = modifierValue.trim();
        }

        if (modifierValue !==  null && modifierValue !== "") {
            tiTemp = new TextInfo(modifierValue, 0, 0, modifierFont, frc);
            labelBounds = tiTemp.getTextBounds();
            labelWidth = labelBounds.getWidth() as number;

            x = (bounds.getX() - labelBounds.getWidth() - bufferXL) as number;

            y = (bounds.getHeight()) as number;
            y = ((y * 0.5) + ((labelHeight - tiTemp.getDescent()) * 0.5)) as number;
            y = bounds.getY() as number + y;

            tiTemp.setLocation(x, y);
            tiArray.push(tiTemp);
        }
    }

    if (modifiers.has(Modifiers.H_ADDITIONAL_INFO_1) || modifiers.has(Modifiers.AF_COMMON_IDENTIFIER)) {
        modifierValue = "";
        let hm: string | null | undefined = "";
        let
            afm: string | null | undefined = "";

        hm = modifiers.get(Modifiers.H_ADDITIONAL_INFO_1);
        if (modifiers.has(Modifiers.H_ADDITIONAL_INFO_1)) {
            hm = modifiers.get(Modifiers.H_ADDITIONAL_INFO_1);
        }
        if (modifiers.has(Modifiers.AF_COMMON_IDENTIFIER) && SymbolUtilities.hasModifier(symbolID, Modifiers.AF_COMMON_IDENTIFIER)) {
            afm = modifiers.get(Modifiers.AF_COMMON_IDENTIFIER);
        }

        modifierValue = hm + " " + afm;
        modifierValue = modifierValue.trim();

        if (modifierValue !==  null && modifierValue !== "") {
            tiTemp = new TextInfo(modifierValue, 0, 0, modifierFont, frc);
            labelBounds = tiTemp.getTextBounds();
            labelWidth = labelBounds.getWidth() as number;

            x = (bounds.getX() + bounds.getWidth() + bufferXR) as number;

            y = (bounds.getHeight()) as number;
            y = ((y * 0.5) + ((labelHeight - tiTemp.getDescent()) * 0.5)) as number;
            y = bounds.getY() as number + y;

            tiTemp.setLocation(x, y);
            tiArray.push(tiTemp);

        }
    }

    if (modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1)) {
        modifierValue = modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1) || null;

        if (modifierValue !==  null) {
            tiTemp = new TextInfo(modifierValue, 0, 0, modifierFont, frc);
            labelBounds = tiTemp.getTextBounds();
            labelWidth = labelBounds.getWidth() as number;

            if (!byLabelHeight) {
                x = bounds.getX() as number - labelWidth - bufferXL;
                y = (bounds.getY() + bounds.getHeight()) as number;
            }
            else {
                x = (bounds.getX() - labelWidth - bufferXL) as number;

                y = (bounds.getHeight()) as number;
                y = ((y * 0.5) + (labelHeight * 0.5)) as number;

                y = (y + ((labelHeight + bufferText) - tiTemp.getDescent())) as number;
                y = (bounds.getY() + y) as number;
            }

            tiTemp.setLocation(x, y);
            tiArray.push(tiTemp);
        }
    }

    if (modifiers.has(Modifiers.M_HIGHER_FORMATION) || modifiers.has(Modifiers.AS_COUNTRY)) {
        modifierValue = "";

        if (modifiers.has(Modifiers.M_HIGHER_FORMATION) && SymbolUtilities.hasModifier(symbolID, Modifiers.M_HIGHER_FORMATION)) {
            modifierValue += modifiers.get(Modifiers.M_HIGHER_FORMATION);
        }
        if (modifiers.has(Modifiers.AS_COUNTRY)) {
            if (modifierValue.length > 0) {
                modifierValue += " ";
            }
            modifierValue += modifiers.get(Modifiers.AS_COUNTRY);
        }

        if (modifierValue !== "") {
            tiTemp = new TextInfo(modifierValue, 0, 0, modifierFont, frc);
            labelBounds = tiTemp.getTextBounds();
            labelWidth = labelBounds.getWidth() as number;

            x = (bounds.getX() + bounds.getWidth() + bufferXR) as number;
            if (!byLabelHeight) {
                y = (bounds.getY() + bounds.getHeight()) as number;
            }
            else {
                y = (bounds.getHeight()) as number;
                y = ((y * 0.5) + (labelHeight * 0.5)) as number;

                y = (y + ((labelHeight + bufferText - tiTemp.getDescent()))) as number;
                y = bounds.getY() as number + y;
            }

            tiTemp.setLocation(x, y);
            tiArray.push(tiTemp);

        }
    }

    if (modifiers.has(Modifiers.Z_SPEED) && SymbolUtilities.hasModifier(symbolID, Modifiers.Z_SPEED)) {
        modifierValue = modifiers.get(Modifiers.Z_SPEED) || null;

        if (modifierValue !==  null) {
            tiTemp = new TextInfo(modifierValue, 0, 0, modifierFont, frc);
            labelBounds = tiTemp.getTextBounds();
            labelWidth = labelBounds.getWidth() as number;

            x = (bounds.getX() - labelWidth - bufferXL) as number;
            if (!byLabelHeight) {
                y = (Math.round(bounds.getY() + bounds.getHeight() + labelHeight + bufferText)) as number;
            }
            else {
                y = (bounds.getHeight()) as number;
                y = ((y * 0.5) + (labelHeight * 0.5)) as number;

                y = (y + ((labelHeight + bufferText) * 2) - (tiTemp.getDescent() * 2)) as number;
                y = Math.round(bounds.getY() + y) as number;
            }

            tiTemp.setLocation(x, y);
            tiArray.push(tiTemp);
        }
    }

    if (modifiers.has(Modifiers.J_EVALUATION_RATING)
        || modifiers.has(Modifiers.K_COMBAT_EFFECTIVENESS)//
        || modifiers.has(Modifiers.L_SIGNATURE_EQUIP)//
        || modifiers.has(Modifiers.N_HOSTILE)//
        || modifiers.has(Modifiers.P_IFF_SIF_AIS))//
    {
        modifierValue = null;

        let jm: string | null | undefined;
        let
            km: string | null | undefined;
        let
            lm: string | null | undefined;
        let
            nm: string | null | undefined;
        let
            pm: string | null | undefined;

        if (modifiers.has(Modifiers.J_EVALUATION_RATING)) {
            jm = modifiers.get(Modifiers.J_EVALUATION_RATING);
        }
        if (modifiers.has(Modifiers.K_COMBAT_EFFECTIVENESS) && SymbolUtilities.hasModifier(symbolID, Modifiers.K_COMBAT_EFFECTIVENESS)) {
            km = modifiers.get(Modifiers.K_COMBAT_EFFECTIVENESS);
        }
        if (modifiers.has(Modifiers.L_SIGNATURE_EQUIP) && SymbolUtilities.hasModifier(symbolID, Modifiers.L_SIGNATURE_EQUIP)) {
            lm = modifiers.get(Modifiers.L_SIGNATURE_EQUIP);
        }
        if (modifiers.has(Modifiers.N_HOSTILE) && SymbolUtilities.hasModifier(symbolID, Modifiers.N_HOSTILE)) {
            nm = modifiers.get(Modifiers.N_HOSTILE);
        }
        if (modifiers.has(Modifiers.P_IFF_SIF_AIS) && SymbolUtilities.hasModifier(symbolID, Modifiers.P_IFF_SIF_AIS)) {
            pm = modifiers.get(Modifiers.P_IFF_SIF_AIS);
        }

        modifierValue = "";
        if (jm !==  null && jm !== "") {
            modifierValue = modifierValue + jm;
        }
        if (km !==  null && km !== "") {
            modifierValue = modifierValue + " " + km;
        }
        if (lm !==  null && lm !== "") {
            modifierValue = modifierValue + " " + lm;
        }
        if (nm !==  null && nm !== "") {
            modifierValue = modifierValue + " " + nm;
        }
        if (pm !==  null && pm !== "") {
            modifierValue = modifierValue + " " + pm;
        }

        if (modifierValue.length > 2 && modifierValue.charAt(0) ===  ' ') {
            modifierValue = modifierValue.substring(1);
        }

        modifierValue = modifierValue.trim();

        if (modifierValue !== "") {
            tiTemp = new TextInfo(modifierValue, 0, 0, modifierFont, frc);
            labelBounds = tiTemp.getTextBounds();
            labelWidth = labelBounds.getWidth() as number;

            x = (bounds.getX() + bounds.getWidth() + bufferXR) as number;
            if (!byLabelHeight) {
                y = (Math.round(bounds.getY() + bounds.getHeight() + labelHeight + bufferText)) as number;
            }
            else {
                y = (bounds.getHeight()) as number;
                y = ((y * 0.5) + (labelHeight * 0.5)) as number;

                y = (y + ((labelHeight + bufferText) * 2) - (tiTemp.getDescent() * 2)) as number;
                y = Math.round(bounds.getY() + y) as number;
            }

            tiTemp.setLocation(x, y);
            tiArray.push(tiTemp);

        }

    }

    if (modifiers.has(Modifiers.W_DTG_1)) {
        modifierValue = modifiers.get(Modifiers.W_DTG_1) || null;

        if (modifierValue !==  null) {
            tiTemp = new TextInfo(modifierValue, 0, 0, modifierFont, frc);
            labelBounds = tiTemp.getTextBounds();
            labelWidth = labelBounds.getWidth() as number;

            if (!byLabelHeight) {
                x = (bounds.getX() - labelWidth - bufferXL) as number;
                y = (bounds.getY() - bufferY - tiTemp.getDescent()) as number;
            }
            else {
                x = (bounds.getX() - labelWidth - bufferXL) as number;

                y = (bounds.getHeight()) as number;
                y = ((y * 0.5) + (labelHeight * 0.5)) as number;

                y = y - ((labelHeight + bufferText) * 2);
                y = bounds.getY() as number + y;
            }

            tiTemp.setLocation(x, y);
            tiArray.push(tiTemp);
        }
    }

    if (modifiers.has(Modifiers.F_REINFORCED_REDUCED) || modifiers.has(Modifiers.E_FRAME_SHAPE_MODIFIER)) {
        modifierValue = null;
        let E: string | null | undefined;
        let
            F: string | null | undefined;

        if (modifiers.has(Modifiers.E_FRAME_SHAPE_MODIFIER)) {
            E = modifiers.get(Modifiers.E_FRAME_SHAPE_MODIFIER);
            modifiers.delete(Modifiers.E_FRAME_SHAPE_MODIFIER);
        }
        if (modifiers.has(Modifiers.F_REINFORCED_REDUCED) && SymbolUtilities.hasModifier(symbolID, Modifiers.F_REINFORCED_REDUCED)) {
            F = modifiers.get(Modifiers.F_REINFORCED_REDUCED);
        }

        if (E != null && E !== "") {
            modifierValue = E;
        }

        if (F != null && F !== "") {
            if (F.toUpperCase() ===  ("R")) {
                F = "(+)";
            }
            else if (F.toUpperCase() ===  ("D")) {
                F = "(-)";
            }
            else if (F.toUpperCase() ===  ("RD")) {
                F = "(" + String.fromCharCode(177) + ")";
            }
        }

        if (F != null && F !== "") {
            if (modifierValue != null && modifierValue !== "") {
                modifierValue = modifierValue + " " + F;
            }
            else {
                modifierValue = F;
            }
        }

        if (modifierValue !==  null) {
            tiTemp = new TextInfo(modifierValue, 0, 0, modifierFont, frc);
            labelBounds = tiTemp.getTextBounds();
            labelWidth = labelBounds.getWidth() as number;

            if (!byLabelHeight) {
                x = (bounds.getX() + bounds.getWidth() + bufferXR) as number;
                y = (bounds.getY() - bufferY - tiTemp.getDescent()) as number;
            }
            else {
                x = (bounds.getX() + bounds.getWidth() + bufferXR) as number;

                y = (bounds.getHeight()) as number;
                y = ((y * 0.5) + (labelHeight * 0.5)) as number;

                y = y - ((labelHeight + bufferText) * 2);
                y = bounds.getY() as number + y;
            }

            tiTemp.setLocation(x, y);
            tiArray.push(tiTemp);
        }
    }

    if (modifiers.has(Modifiers.AA_SPECIAL_C2_HQ) && SymbolUtilities.hasModifier(symbolID, Modifiers.AA_SPECIAL_C2_HQ)) {
        modifierValue = modifiers.get(Modifiers.AA_SPECIAL_C2_HQ) || null;

        if (modifierValue !==  null) {
            tiTemp = new TextInfo(modifierValue, 0, 0, modifierFont, frc);
            labelBounds = tiTemp.getTextBounds();
            labelWidth = labelBounds.getWidth() as number;

            x = ((symbolBounds.getX() + (symbolBounds.getWidth() * 0.5)) - (labelWidth * 0.5)) as number;

            y = (symbolBounds.getHeight()) as number;//checkpoint, get box above the point
            y = ((y * 0.5) + ((labelHeight - tiTemp.getDescent()) * 0.5)) as number;
            y = symbolBounds.getY() as number + y;

            tiTemp.setLocation(x, y);
            tiArray.push(tiTemp);
        }
    }


    // </editor-fold>

    //Shift Points and Draw
    newsdi = shiftUnitPointsAndDraw(tiArray,sdi,attributes);

    // <editor-fold defaultstate="collapsed" desc="Cleanup">
    tiArray = null!;
    tiTemp = null!;
    //tempShape = null;
    imageBoundsOld = null!;
    //ctx = null;
    //buffer = null;
    // </editor-fold>

    return newsdi!;

}

/**
 * Process special (SP) text modifiers for units
 * @param sdi Symbol dimension info
 * @param symbolID Symbol ID
 * @param modifiers Modifiers map
 * @param attributes Attributes map
 * @param frc Rendering context
 * @returns Updated SymbolDimensionInfo
 */
export function processSPTextModifiers(sdi: SymbolDimensionInfo, symbolID: string, modifiers: Map<string, string>, attributes: Map<string, string>, frc: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D): SymbolDimensionInfo {
    let ii: any;
    let ssi: any;

    let modifierFont: Font = getFont(attributes);//ModifierRenderer.RS.getLabelFont();
    let hd:number[] = getFontHeightandDescent(modifierFont, frc);
    let modifierFontHeight: number = hd[0];
    let modifierFontDescent: number = hd[1];

    let bufferXL: number = 7;
    let bufferXR: number = 7;
    let bufferY: number = 2;
    let bufferText: number = 2;
    let x: number = 0;
    let y: number = 0;//best y

    let newsdi: SymbolDimensionInfo | null;
    let alpha: number = -1;

    let textColor: Color = Color.BLACK;
    let textBackgroundColor: Color;

    let tiArray: Array<TextInfo> = new Array<TextInfo>();

    let descent: number = (modifierFontDescent) as number;

    if (attributes.has(MilStdAttributes.Alpha)) {
        alpha = parseFloat(attributes.get(MilStdAttributes.Alpha)!) / 255;
    }

    let labelBounds: Rectangle2D;
    let labelWidth: number = 0;
    let labelHeight: number = 0;

    let bounds: Rectangle2D = sdi.getSymbolBounds();
    let symbolBounds: Rectangle2D = (sdi.getSymbolBounds().clone()) as Rectangle2D;
    let centerPoint: Point2D = sdi.getSymbolCenterPoint();
    let imageBounds: Rectangle2D = sdi.getImageBounds().clone();
    let imageBoundsOld: Rectangle2D = imageBounds.clone() as Rectangle2D;

    let echelonText: string = SymbolUtilities.getEchelonText(SymbolID.getAmplifierDescriptor(symbolID));
    let amText: string = SymbolUtilities.getStandardIdentityModifier(symbolID);

    //adjust width of bounds for mobility/echelon/engagement bar which could be wider than the symbol
    bounds = RectUtilities.toRectangle2D(imageBounds.getX(), bounds.getY(), imageBounds.getWidth(), bounds.getHeight());


    //check if text is too tall:
    let byLabelHeight: boolean = true;
    labelHeight = (modifierFontHeight + 0.5) as number;/* RendererUtilities.measureTextHeight(RendererSettings.getModifierFontName(),
     RendererSettings.getModifierFontSize(),
     RendererSettings.getModifierFontStyle()).fullHeight;*/

    let maxHeight: number = (bounds.getHeight()) as number;
    if ((labelHeight * 3) > maxHeight) {
        byLabelHeight = true;
    }

    //Affiliation Modifier being drawn as a display modifier
    let affiliationModifier: string | null = null;
    if (rendererSettings.getDrawAffiliationModifierAsLabel() ===  true) {
        affiliationModifier = SymbolUtilities.getStandardIdentityModifier(symbolID);
    }
    if (affiliationModifier !==  null) {   //Set affiliation modifier
        modifiers.set(Modifiers.E_FRAME_SHAPE_MODIFIER, affiliationModifier);
        //modifiers[Modifiers.E_FRAME_SHAPE_MODIFIER] = affiliationModifier;
    }//*/

    //Check for Valid Country Code
    let cc: string = gencLookup.get3CharCode(SymbolID.getCountryCode(symbolID));
    if (cc !==  null && cc !== "") {
        modifiers.set(Modifiers.AS_COUNTRY, cc);
    }


    // <editor-fold defaultstate="collapsed" desc="Build Modifiers">
    let modifierValue: string | null;
    let tiTemp: TextInfo;

    let mods:Array<Modifier> | null = getLabelPositionIndexes(symbolID, modifiers, attributes);

    let mod: Modifier | null | undefined = null;
    if(mods !==  null)
    {
        for(let i = 0; i < mods.length; i++)
        {
            mod = mods.at(i)!;

            tiTemp = new TextInfo(mod.getText(), 0, 0, modifierFont, frc);
            labelBounds = tiTemp.getTextBounds();
            labelWidth = labelBounds.getWidth();

            //on left
            x = getLabelXPosition(bounds, labelWidth, mod.getIndexX(), modifierFontHeight);
            //above center V
            y = getLabelYPosition(bounds, labelHeight, descent, bufferText, mod.getCentered(), mod.getIndexY());

            tiTemp.setLocation(x, y);
            tiArray.push(tiTemp);
        }
    }

    // </editor-fold>

    //Shift Points and Draw
    newsdi = shiftUnitPointsAndDraw(tiArray,sdi,attributes);

    // <editor-fold defaultstate="collapsed" desc="Cleanup">
    tiArray = null!;
    tiTemp = null!;
    //tempShape = null;
    imageBoundsOld = null!;
    //ctx = null;
    //buffer = null;
    // </editor-fold>

    return newsdi!;
}
