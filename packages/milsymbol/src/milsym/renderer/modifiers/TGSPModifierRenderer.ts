//Graphics2D
import { Font } from "../../graphics/Font"
import { Point2D } from "../../graphics/Point2D"
import { Rectangle2D } from "../../graphics/Rectangle2D"

//Renderer/Shapes
import { Path } from "../shapes/path";

//Renderer.Utilities
import { Color } from "../utilities/Color"
import { ImageInfo } from "../utilities/ImageInfo"
import { MilStdAttributes } from "../utilities/MilStdAttributes"
import { Modifiers } from "../utilities/Modifiers"
import { MSInfo } from "../utilities/MSInfo"
import { msLookup } from "../utilities/MSLookup"
import { RectUtilities } from "../utilities/RectUtilities"
import { rendererSettings } from "../utilities/RendererSettings"
import { RendererUtilities } from "../utilities/RendererUtilities"
import { SVGSymbolInfo } from "../utilities/SVGSymbolInfo"
import { SymbolDimensionInfo } from "../utilities/SymbolDimensionInfo"
import { SymbolID } from "../utilities/SymbolID"
import { SymbolUtilities } from "../utilities/SymbolUtilities"
import { TextInfo } from "../utilities/TextInfo"
import { ShapeUtilities } from "../utilities/ShapeUtilities";

//Helper imports
import { getFont, getFontHeightandDescent, renderTextElements } from "./ModifierRenderUtils";
import { createDOMArrowPoints } from "./DirectionArrowRenderer";

/**
 * Tactical Graphic Single Point (TGSP) Modifier Renderer
 * Extracts and processes modifiers specifically for TGSP symbols
 */

export function ProcessTGSPWithSpecialModifierLayout(sdi: SymbolDimensionInfo, symbolID: string, modifiers: Map<string, string>, attributes: Map<string, string>, lineColor: Color, frc: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D): SymbolDimensionInfo | null {

    let ii!: ImageInfo;
    let ssi!: SVGSymbolInfo;

    let modifierFont: Font = getFont(attributes);//ModifierRenderer.RS.getLabelFont();
    let hd:number[] = getFontHeightandDescent(modifierFont,frc);
    let modifierFontHeight: number = hd[0];
    let modifierFontDescent: number = hd[1];

    let bufferXL: number = 6;
    let bufferXR: number = 4;
    let bufferY: number = 2;
    let bufferText: number = 2;
    let centerOffset: number = 1; //getCenterX/Y function seems to go over by a pixel
    let x: number = 0;
    let y: number = 0;
    let x2: number = 0;
    let y2: number = 0;

    let outlineOffset: number = rendererSettings.getTextOutlineWidth();
    let labelHeight: number = 0;
    let labelWidth: number = 0;
    let strokeWidth: number = 2.0;
    let alpha: number = -1;
    let newsdi!: SymbolDimensionInfo;
    let textColor: Color = lineColor;
    let textBackgroundColor!: Color;
    let ss: number = SymbolID.getSymbolSet(symbolID);
    let ec: number = SymbolID.getEntityCode(symbolID);
    let e: number = SymbolID.getEntity(symbolID);
    let et: number = SymbolID.getEntityType(symbolID);
    let est: number = SymbolID.getEntitySubtype(symbolID);

    //Feint Dummy Indicator variables
    let fdiBounds!: Rectangle2D;
    let fdiTop!: Point2D;
    let fdiLeft!: Point2D;
    let fdiRight!: Point2D;

    let arrMods: Array<TextInfo> = new Array<TextInfo>();
    let duplicate: boolean = false;

    let bounds: Rectangle2D = RectUtilities.copyRect(sdi.getSymbolBounds());
    let symbolBounds: Rectangle2D = RectUtilities.copyRect(sdi.getSymbolBounds());
    let centerPoint: Point2D = sdi.getSymbolCenterPoint();
    let imageBounds: Rectangle2D = sdi.getImageBounds().clone();

    if(attributes !==  null)
    {
        if (attributes.has(MilStdAttributes.PixelSize)) {
            let pixelSize: number = parseInt(attributes.get(MilStdAttributes.PixelSize)!);
            if (pixelSize <= 100) {

                strokeWidth = 2.0;
            }

            else {

                strokeWidth = 2 + ((pixelSize - 100) / 100);
            }

        }

        if (attributes.has(MilStdAttributes.Alpha)) {
            alpha = parseFloat(attributes.get(MilStdAttributes.Alpha)!) / 255;
        }
    }



    centerPoint = new Point2D(Math.round(sdi.getSymbolCenterPoint().x), Math.round(sdi.getSymbolCenterPoint().y));

    let byLabelHeight: boolean = false;
    labelHeight = (modifierFontHeight + 0.5) as number;

    let maxHeight: number = (symbolBounds.getHeight()) as number;
    if ((labelHeight * 3) > maxHeight) {
        byLabelHeight = true;
    }

    let descent: number = (modifierFontDescent) as number;
    let yForY: number = -1;

    let labelBounds1: Rectangle2D;//text.getPixelBounds(null, 0, 0);
    let labelBounds2: Rectangle2D;
    let strText: string = "";
    let strText1: string = "";
    let strText2: string = "";
    let text1: TextInfo;
    let text2: TextInfo;


    if (outlineOffset > 2) {
        outlineOffset = ((outlineOffset - 1) / 2);
    }
    else {
        outlineOffset = 0;
    }


    // <editor-fold defaultstate="collapsed" desc="Process Special Modifiers">
    let ti: TextInfo;
    if (SymbolUtilities.isCBRNEvent(symbolID))//chemical
    {
        if ((labelHeight * 3) > bounds.getHeight()) {
            byLabelHeight = true;
        }
    }

    if (ss ===  SymbolID.SymbolSet_ControlMeasure && modifiers !==  null && modifiers.size > 0) {
        if (ec ===  130500) //contact point
        {
            if (modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1)) {
                strText = modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1)!;
                if (strText !==  null) {
                    ti = new TextInfo(strText, 0, 0, modifierFont, frc);
                    labelWidth = Math.round(ti.getTextBounds().getWidth()) as number;
                    //One modifier symbols and modifier goes in center
                    x = (bounds.getMinX() + (bounds.getWidth() * 0.5) as number) as number;
                    x = x - (labelWidth * 0.5) as number;
                    y = (bounds.getMinY() + (bounds.getHeight() * 0.4) as number) as number;
                    y = y + (labelHeight * 0.5) as number;

                    ti.setLocation(Math.round(x), Math.round(y));
                    arrMods.push(ti);
                }
            }
            if (modifiers.has(Modifiers.W_DTG_1)) {
                strText = modifiers.get(Modifiers.W_DTG_1)!;
                if (strText !==  null) {
                    ti = new TextInfo(strText, 0, 0, modifierFont, frc);
                    labelWidth = Math.round(ti.getTextBounds().getWidth()) as number;

                    x = (bounds.getMinX() - labelWidth - bufferXL);
                    y = (bounds.getMinY() + labelHeight - descent);

                    ti.setLocation(Math.round(x), Math.round(y));
                    arrMods.push(ti);
                }
            }
        }
        if (ec ===  130700) //decision point
        {
            if (modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1)) {
                strText = modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1)!;
                if (strText !==  null) {
                    ti = new TextInfo(strText, 0, 0, modifierFont, frc);
                    labelWidth = Math.round(ti.getTextBounds().getWidth()) as number;
                    //One modifier symbols and modifier goes in center
                    x = (bounds.getMinX() + (bounds.getWidth() * 0.5) as number) as number;
                    x = x - (labelWidth * 0.5) as number;
                    y = (bounds.getMinY() + (bounds.getHeight() * 0.5) as number) as number;
                    y = y + (labelHeight * 0.5) as number;

                    ti.setLocation(Math.round(x), Math.round(y));
                    arrMods.push(ti);
                }
            }
        }
        else {
            if (ec ===  212800)//harbor
            {
                if (modifiers.has(Modifiers.H_ADDITIONAL_INFO_1)) {
                    strText = modifiers.get(Modifiers.H_ADDITIONAL_INFO_1)!;
                    if (strText !==  null) {
                        ti = new TextInfo(strText, 0, 0, modifierFont, frc);
                        labelWidth = Math.round(ti.getTextBounds().getWidth()) as number;
                        //One modifier symbols and modifier goes in center
                        x = (bounds.getMinX() + (bounds.getWidth() * 0.5) as number) as number;
                        x = x - (labelWidth * 0.5) as number;
                        y = (bounds.getMinY() + (bounds.getHeight() * 0.5) as number) as number;
                        y = y + (labelHeight * 0.5) as number;

                        ti.setLocation(Math.round(x), Math.round(y));
                        arrMods.push(ti);
                    }
                }
            // @ts-ignore
            else if (ec ===  131300)//point of interest
            {
                if (modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1)) {
                    strText = modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1)!;
                    if (strText !==  null) {
                        ti = new TextInfo(strText, 0, 0, modifierFont, frc);
                        labelWidth = Math.round(ti.getTextBounds().getWidth()) as number;
                        //One modifier symbols, top third & center
                        x = (bounds.getMinX() + (bounds.getWidth() * 0.5) as number) as number;
                        x = x - (labelWidth * 0.5) as number;
                        y = (bounds.getMinY() + (bounds.getHeight() * 0.25) as number) as number;
                        y = y + (labelHeight * 0.5) as number;

                        ti.setLocation(Math.round(x), Math.round(y));
                        arrMods.push(ti);
                    }
                }
            }
            // @ts-ignore
            else if (ec ===  131800//waypoint
                    // @ts-ignore
                    || ec ===  240900)//fire support station
            {
                if (modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1)) {
                    strText = modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1)!;
                    if (strText !==  null) {
                        ti = new TextInfo(strText, 0, 0, modifierFont, frc);

                        //One modifier symbols and modifier goes right of center
                        // @ts-ignore
                        if (ec ===  131800) {

                            x = (bounds.getMinX() + (bounds.getWidth() * 0.75)) as number;
                        }

                        else {

                            x = (bounds.getMinX() + (bounds.getWidth())) as number;
                        }

                        y = (bounds.getMinY() + (bounds.getHeight() * 0.5)) as number;
                        y = y + ((labelHeight - descent) * 0.5) as number;

                        ti.setLocation(Math.round(x), Math.round(y));
                        arrMods.push(ti);
                    }
                }
            }
            // @ts-ignore
            else if (ec ===  131900)  //Airfield (AEGIS Only)
            {
                if (modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1)) {
                    strText = modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1)!;
                    if (strText !==  null) {
                        ti = new TextInfo(strText, 0, 0, modifierFont, frc);

                        //One modifier symbols and modifier goes right of center
                        x = (bounds.getMinX() + (bounds.getWidth() + bufferXR)) as number;

                        y = (bounds.getMinY() + (bounds.getHeight() * 0.5)) as number;
                        y = y + ((labelHeight - descent) * 0.5) as number;

                        ti.setLocation(Math.round(x), Math.round(y));
                        arrMods.push(ti);
                    }
                }
            } else {
                        // @ts-ignore
                        if (ec ===  180100 //Air Control point
                            // @ts-ignore
                            || ec ===  180200) //Communications Check point
                        {
                            if (modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1)) {
                                strText = modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1)!;
                                if (strText !==  null) {
                                    ti = new TextInfo(strText, 0, 0, modifierFont, frc);
                                    labelWidth = ti.getTextBounds().getWidth() as number;
                                    //One modifier symbols and modifier goes just below of center
                                    x = (bounds.getMinX() + (bounds.getWidth() * 0.5)) as number;
                                    x = x - (labelWidth * 0.5) as number;
                                    y = (bounds.getMinY() + (bounds.getHeight() * 0.5)) as number;
                                    y = y + (((bounds.getHeight() * 0.5) - labelHeight) / 2) as number + labelHeight - descent;

                                    ti.setLocation(Math.round(x), Math.round(y));
                                    arrMods.push(ti);
                                }
                            }
                        } else {
                            // @ts-ignore
                            if (ec ===  160300 || //T (target reference point)
                                // @ts-ignore
                                ec ===  132000 || //T (Target Handover)
                                // @ts-ignore
                                ec ===  240601 || //ap,ap1,x,h (Point/Single Target)
                                // @ts-ignore
                                ec ===  240602) //T (nuclear target)
                            { //Targets with special modifier positions
                                if (modifiers.has(Modifiers.H_ADDITIONAL_INFO_1)
                                    // @ts-ignore
                                    && ec ===  240601)//H //point single target
                                {
                                    strText = modifiers.get(Modifiers.H_ADDITIONAL_INFO_1)!;
                                    if (strText !==  null) {
                                        ti = new TextInfo(strText, 0, 0, modifierFont, frc);

                                        x = (bounds.getCenterX() + (bounds.getWidth() * 0.15)) as number;
                                        y = (bounds.getMinY() + (bounds.getHeight() * 0.75)) as number;
                                        y = y + (labelHeight * 0.5) as number;

                                        ti.setLocation(Math.round(x), Math.round(y));
                                        arrMods.push(ti);
                                    }
                                }
                                if (modifiers.has(Modifiers.X_ALTITUDE_DEPTH)
                                    // @ts-ignore
                                    && ec ===  240601)//X point or single target
                                {
                                    strText = modifiers.get(Modifiers.X_ALTITUDE_DEPTH)!;
                                    if (strText !==  null) {
                                        ti = new TextInfo(strText, 0, 0, modifierFont, frc);
                                        labelWidth = Math.round(ti.getTextBounds().getWidth()) as number;
                                        x = (bounds.getCenterX() - (bounds.getWidth() * 0.15) as number) as number;
                                        x = x - (labelWidth);
                                        y = (bounds.getMinY() + (bounds.getHeight() * 0.75)) as number;
                                        y = y + (labelHeight * 0.5) as number;

                                        ti.setLocation(Math.round(x), Math.round(y));
                                        arrMods.push(ti);
                                    }
                                }
                                if (modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1) &&
                                    // @ts-ignore
                                    (ec ===  160300 || ec ===  132000)) {
                                    strText = modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1)!;
                                    if (strText !==  null) {
                                        ti = new TextInfo(strText, 0, 0, modifierFont, frc);

                                        x = (bounds.getCenterX() + (bounds.getWidth() * 0.15)) as number;
                                        //                  x = x - (labelbounds.getWidth * 0.5);
                                        y = (bounds.getMinY() + (bounds.getHeight() * 0.30)) as number;

                                        ti.setLocation(Math.round(x), Math.round(y));
                                        arrMods.push(ti);
                                    }
                                }
                                // @ts-ignore
                                if (ec ===  240601 || ec ===  240602) {
                                    if (modifiers.has(Modifiers.AP_TARGET_NUMBER)) {
                                        strText = modifiers.get(Modifiers.AP_TARGET_NUMBER)!;
                                    }
                                    // @ts-ignore
                                    if (ec ===  240601 && modifiers.has(Modifiers.AP1_TARGET_NUMBER_EXTENSION)) {
                                        if (strText !==  null) {

                                            strText = strText + "  " + modifiers.get(Modifiers.AP1_TARGET_NUMBER_EXTENSION);
                                        }

                                        else {

                                            strText = modifiers.get(Modifiers.AP1_TARGET_NUMBER_EXTENSION)!;
                                        }
                                    }
                                    if (strText !==  null) {
                                        ti = new TextInfo(strText, 0, 0, modifierFont, frc);

                                        x = (bounds.getCenterX() + (bounds.getWidth() * 0.15)) as number;
                                        //                  x = x - (labelbounds.getWidth * 0.5);
                                        y = (bounds.getMinY() + (bounds.getHeight() * 0.30)) as number;

                                        ti.setLocation(Math.round(x), Math.round(y));
                                        arrMods.push(ti);
                                    }
                                }
                            }
                            else {
                                // @ts-ignore
                                if (ec ===  132100)  //Key Terrain
                                {
                                    if (modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1)) {
                                        strText = modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1)!;
                                        if (strText !==  null) {
                                            ti = new TextInfo(strText, 0, 0, modifierFont, frc);

                                            //One modifier symbols and modifier goes right of center
                                            x = (bounds.getMinX() + (bounds.getWidth() * 0.5 + bufferXR)) as number;

                                            y = (bounds.getMinY() + (bounds.getHeight() * 0.5)) as number;
                                            y = y + ((labelHeight - descent) * 0.5) as number;

                                            ti.setLocation(Math.round(x), Math.round(y));
                                            arrMods.push(ti);
                                        }
                                    }
                                }
                                // @ts-ignore
                                else if(ec == 182600)//Isolated Personnel Location
                                {

                                    if (modifiers.has(Modifiers.C_QUANTITY)) {
                                        strText = modifiers.get(Modifiers.C_QUANTITY)!;
                                        if (strText !==  null) {
                                            ti = new TextInfo(strText, 0, 0, modifierFont, frc);
                                            labelWidth = Math.round(ti.getTextBounds().getWidth());
                                            //subset of NBC, just nuclear
                                            x = (bounds.getMinX() + (bounds.getWidth() * 0.5));
                                            x = x -  (labelWidth * 0.5);
                                            y = bounds.getMinY() - descent;
                                            ti.setLocation(Math.round(x), Math.round(y));
                                            arrMods.push(ti);
                                        }
                                    }
                                    if (modifiers.has(Modifiers.W_DTG_1)) {
                                        strText = modifiers.get(Modifiers.W_DTG_1)!;
                                        if (strText !==  null) {
                                            ti = new TextInfo(strText, 0, 0, modifierFont, frc);
                                            labelWidth = Math.round(ti.getTextBounds().getWidth());

                                            x = bounds.getMinX() - labelWidth - bufferXL;
                                            if (!byLabelHeight) {
                                                y = bounds.getMinY() + labelHeight - descent;
                                            } else {
                                                y = (bounds.getMinY() + ((bounds.getHeight() * 0.5) - ((labelHeight - descent) * 0.5) + (-descent - bufferText)));
                                            }

                                            ti.setLocation(Math.round(x), Math.round(y));
                                            arrMods.push(ti);
                                        }
                                    }
                                    if (modifiers.has(Modifiers.W1_DTG_2)) {
                                        strText = modifiers.get(Modifiers.W1_DTG_2)!;
                                        if (strText !==  null) {
                                            ti = new TextInfo(strText, 0, 0, modifierFont, frc);
                                            labelWidth = Math.round(ti.getTextBounds().getWidth());

                                            x = bounds.getMinX() - labelWidth - bufferXL;
                                            if (!byLabelHeight) {
                                                y = bounds.getMinY() + labelHeight - descent;
                                            } else {
                                                y = (bounds.getMinY() + ((bounds.getHeight() * 0.5) - (((labelHeight * 2) - descent) * 0.5) + (-descent - bufferText)));
                                            }

                                            ti.setLocation(Math.round(x), Math.round(y));
                                            arrMods.push(ti);
                                        }
                                    }
                                }
                                else {
                                    if (SymbolUtilities.isCBRNEvent(symbolID)) //CBRN
                                    {
                                        if (modifiers.has(Modifiers.N_HOSTILE)) {
                                            strText = modifiers.get(Modifiers.N_HOSTILE)!;
                                            if (strText !==  null) {
                                                ti = new TextInfo(strText, 0, 0, modifierFont, frc);

                                                x = (bounds.getMinX() + bounds.getWidth() + bufferXR) as number;

                                                if (!byLabelHeight) {
                                                    y = (bounds.getMinY() + bounds.getHeight()) as number;
                                                } else {
                                                    y = (bounds.getMinY() + ((bounds.getHeight() * 0.5) + ((labelHeight - descent) * 0.5) + (labelHeight - descent + bufferText))) as number;
                                                }

                                                ti.setLocation(Math.round(x), Math.round(y));
                                                arrMods.push(ti);
                                            }

                                        }
                                        if (modifiers.has(Modifiers.H_ADDITIONAL_INFO_1)) {
                                            strText = modifiers.get(Modifiers.H_ADDITIONAL_INFO_1)!;
                                            if (strText !==  null) {
                                                ti = new TextInfo(strText, 0, 0, modifierFont, frc);

                                                x = (bounds.getMinX() + bounds.getWidth() + bufferXR) as number;
                                                if (!byLabelHeight) {
                                                    y = (bounds.getMinY() + labelHeight - descent) as number;
                                                } else {
                                                    //y = bounds.y + ((bounds.getHeight * 0.5) + (labelHeight * 0.5) - (labelHeight + bufferText));
                                                    y = (bounds.getMinY() + ((bounds.getHeight() * 0.5) - ((labelHeight - descent) * 0.5) + (-descent - bufferText))) as number;
                                                }

                                                ti.setLocation(Math.round(x), Math.round(y));
                                                arrMods.push(ti);
                                            }
                                        }
                                        if (modifiers.has(Modifiers.W_DTG_1)) {
                                            strText = modifiers.get(Modifiers.W_DTG_1)!;
                                            if (strText !==  null) {
                                                ti = new TextInfo(strText, 0, 0, modifierFont, frc);
                                                labelWidth = Math.round(ti.getTextBounds().getWidth()) as number;

                                                x = bounds.getMinX() as number - labelWidth - bufferXL;
                                                if (!byLabelHeight) {
                                                    y = bounds.getMinY() as number + labelHeight - descent;
                                                } else {
                                                    //y = bounds.y + ((bounds.getHeight * 0.5) + (labelHeight * 0.5) - (labelHeight + bufferText));
                                                    y = (bounds.getMinY() + ((bounds.getHeight() * 0.5) - ((labelHeight - descent) * 0.5) + (-descent - bufferText))) as number;
                                                }

                                                ti.setLocation(Math.round(x), Math.round(y));
                                                arrMods.push(ti);
                                            }
                                        }
                                        // @ts-ignore
                                        if ((ec ===  281500 || ec ===  281600) && modifiers.has(Modifiers.V_EQUIP_TYPE)) {//nuclear event or nuclear fallout producing event
                                            strText = modifiers.get(Modifiers.V_EQUIP_TYPE)!;
                                            if (strText !==  null) {
                                                ti = new TextInfo(strText, 0, 0, modifierFont, frc);

                                                //subset of nbc, just nuclear
                                                labelWidth = Math.round(ti.getTextBounds().getWidth()) as number;
                                                x = bounds.getMinX() as number - labelWidth - bufferXL;
                                                y = (bounds.getMinY() + ((bounds.getHeight() * 0.5) + ((labelHeight - descent) * 0.5))) as number;//((bounds.getHeight / 2) - (labelHeight/2));

                                                ti.setLocation(Math.round(x), Math.round(y));
                                                arrMods.push(ti);
                                            }
                                        }
                                        if (modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1)) {
                                            strText = modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1)!;
                                            if (strText !==  null) {
                                                ti = new TextInfo(strText, 0, 0, modifierFont, frc);
                                                labelWidth = Math.round(ti.getTextBounds().getWidth()) as number;
                                                x = bounds.getMinX() as number - labelWidth - bufferXL;
                                                if (!byLabelHeight) {
                                                    y = (bounds.getMinY() + bounds.getHeight()) as number;
                                                } else {
                                                    //y = bounds.y + ((bounds.getHeight * 0.5) + ((labelHeight-descent) * 0.5) + (labelHeight + bufferText));
                                                    y = (bounds.getMinY() + ((bounds.getHeight() * 0.5) + ((labelHeight - descent) * 0.5) + (labelHeight - descent + bufferText))) as number;
                                                }
                                                ti.setLocation(Math.round(x), Math.round(y));
                                                arrMods.push(ti);
                                            }
                                        }
                                        if (modifiers.has(Modifiers.Y_LOCATION)) {
                                            strText = modifiers.get(Modifiers.Y_LOCATION)!;
                                            if (strText !==  null) {
                                                ti = new TextInfo(strText, 0, 0, modifierFont, frc);
                                                labelWidth = Math.round(ti.getTextBounds().getWidth()) as number;
                                                //just NBC
                                                //x = bounds.getX() + (bounds.getWidth() * 0.5);
                                                //x = x - (labelWidth * 0.5);
                                                x = (bounds.getMinX() + (bounds.getWidth() * 0.5)) as number;
                                                x = x - (labelWidth * 0.5) as number;

                                                if (!byLabelHeight) {
                                                    y = (bounds.getMinY() + bounds.getHeight() + labelHeight - descent + bufferY) as number;
                                                } else {
                                                    y = (bounds.getMinY() + ((bounds.getHeight() * 0.5) + ((labelHeight - descent) * 0.5) + ((labelHeight + bufferText) * 2) - descent) as number) as number;

                                                }
                                                yForY = y + descent; //so we know where to start the DOM arrow.
                                                ti.setLocation(Math.round(x), Math.round(y));
                                                arrMods.push(ti);
                                            }

                                        }
                                        if (modifiers.has(Modifiers.C_QUANTITY)) {
                                            strText = modifiers.get(Modifiers.C_QUANTITY)!;
                                            if (strText !==  null) {
                                                ti = new TextInfo(strText, 0, 0, modifierFont, frc);
                                                labelWidth = Math.round(ti.getTextBounds().getWidth()) as number;
                                                //subset of NBC, just nuclear
                                                x = (bounds.getMinX() + (bounds.getWidth() * 0.5)) as number;
                                                x = x - (labelWidth * 0.5) as number;
                                                y = bounds.getMinY() as number - descent;
                                                ti.setLocation(Math.round(x), Math.round(y));
                                                arrMods.push(ti);
                                            }

                                        }
                                    }
                                    else {
                                        // @ts-ignore
                                        if (ec ===  270701)//static depiction
                                        {
                                            if (modifiers.has(Modifiers.H_ADDITIONAL_INFO_1)) {
                                                strText = modifiers.get(Modifiers.H_ADDITIONAL_INFO_1)!;
                                                if (strText !==  null) {
                                                    ti = new TextInfo(strText, 0, 0, modifierFont, frc);
                                                    labelWidth = Math.round(ti.getTextBounds().getWidth()) as number;
                                                    x = (bounds.getMinX() + (bounds.getWidth() * 0.5)) as number;
                                                    x = x - (labelWidth * 0.5) as number;
                                                    y = bounds.getMinY() as number - descent;// + (bounds.getHeight * 0.5);
                                                    //y = y + (labelHeight * 0.5);

                                                    ti.setLocation(Math.round(x), Math.round(y));
                                                    arrMods.push(ti);
                                                }

                                            }
                                            if (modifiers.has(Modifiers.W_DTG_1)) {
                                                strText = modifiers.get(Modifiers.W_DTG_1)!;
                                                if (strText !==  null) {
                                                    ti = new TextInfo(strText, 0, 0, modifierFont, frc);
                                                    labelWidth = Math.round(ti.getTextBounds().getWidth()) as number;
                                                    x = (bounds.getMinX() + (bounds.getWidth() * 0.5) as number) as number;
                                                    x = x - (labelWidth * 0.5) as number;
                                                    y = (bounds.getMinY() + (bounds.getHeight())) as number;
                                                    y = y + (labelHeight);

                                                    ti.setLocation(Math.round(x), Math.round(y));
                                                    arrMods.push(ti);
                                                }
                                            }
                                            if (modifiers.has(Modifiers.N_HOSTILE)) {
                                                strText = modifiers.get(Modifiers.N_HOSTILE)!;
                                                if (strText !==  null) {
                                                    ti = new TextInfo(strText, 0, 0, modifierFont, frc);
                                                    let ti2: TextInfo = new TextInfo(strText, 0, 0, modifierFont, frc);
                                                    labelWidth = Math.round(ti.getTextBounds().getWidth()) as number;
                                                    x = (bounds.getMinX() + (bounds.getWidth()) + bufferXR) as number;//right
                                                    //x = x + labelWidth;//- (labelbounds.getWidth * 0.75);

                                                    duplicate = true;

                                                    x2 = bounds.getMinX() as number;//left
                                                    x2 = x2 - labelWidth - bufferXL;// - (labelbounds.getWidth * 0.25);

                                                    y = (bounds.getMinY() + (bounds.getHeight() * 0.5) as number) as number;//center
                                                    y = y + ((labelHeight - descent) * 0.5) as number;

                                                    y2 = y;

                                                    ti.setLocation(Math.round(x), Math.round(y));
                                                    ti2.setLocation(Math.round(x2), Math.round(y2));
                                                    arrMods.push(ti);
                                                    arrMods.push(ti2);
                                                }
                                            }

                                        }
                                        else {
                                            if (e ===  21 && et ===  35)//sonobuoys
                                            {
                                                let is2525E:boolean = (SymbolID.getVersion(symbolID) >= SymbolID.Version_2525E);
                                                //H sitting on center of circle to the right
                                                //T above H
                                                centerPoint = SymbolUtilities.getCMSymbolAnchorPoint(symbolID, RectUtilities.copyRect(bounds)).toPoint2D();
                                                if (modifiers.has(Modifiers.H_ADDITIONAL_INFO_1)) {
                                                    strText = modifiers.get(Modifiers.H_ADDITIONAL_INFO_1)!;
                                                    if (strText !==  null) {
                                                        ti = new TextInfo(strText, 0, 0, modifierFont, frc);
                                                        let ti2: TextInfo = new TextInfo(strText, 0, 0, modifierFont, frc);
                                                        labelWidth = Math.round(ti.getTextBounds().getWidth()) as number;
                                                        x = (bounds.getMinX() + (bounds.getWidth()) + bufferXR) as number;//right
                                                        y = centerPoint.y;

                                                        if(is2525E) {
                                                            x = x - (bounds.getWidth() * 0.2);
                                                            y = bounds.getY() + (bounds.getHeight() / 2);
                                                        }

                                                        ti.setLocation(Math.round(x), Math.round(y));
                                                        arrMods.push(ti);
                                                    }
                                                }
                                                if (est ===  0 || est ===  1 || est ===  4 || est ===  7 || est ===  8 || est ===  15) {
                                                    if (modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1)) {
                                                        strText = modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1)!;
                                                        if (strText !==  null) {
                                                            ti = new TextInfo(strText, 0, 0, modifierFont, frc);
                                                            let ti2: TextInfo = new TextInfo(strText, 0, 0, modifierFont, frc);
                                                            labelWidth = Math.round(ti.getTextBounds().getWidth()) as number;
                                                            x = (bounds.getMinX() + (bounds.getWidth()) + bufferXR - (bounds.getWidth() * 0.2) );//right
                                                            y = centerPoint.y - labelHeight;

                                                            if(is2525E) {
                                                                y = (bounds.getY() + (bounds.getHeight() / 2)) - labelHeight;
                                                            }

                                                            ti.setLocation(Math.round(x), Math.round(y));
                                                            arrMods.push(ti);
                                                        }
                                                    }
                                                }
                                            }
                                            else {
                                                // @ts-ignore
                                                if (ec ===  282001 || //tower, low
                                                    // @ts-ignore
                                                    ec ===  282002)   //tower, high
                                                {
                                                    if (modifiers.has(Modifiers.X_ALTITUDE_DEPTH)) {
                                                        strText = modifiers.get(Modifiers.X_ALTITUDE_DEPTH)!;
                                                        if (strText !==  null) {
                                                            ti = new TextInfo(strText, 0, 0, modifierFont, frc);
                                                            labelWidth = Math.round(ti.getTextBounds().getWidth()) as number;
                                                            x = (bounds.getMinX() + (bounds.getWidth() * 0.7)) as number;
                                                            y = bounds.getMinY() as number + labelHeight;// + (bounds.getHeight * 0.5);
                                                            //y = y + (labelHeight * 0.5);

                                                            ti.setLocation(Math.round(x), Math.round(y));
                                                            arrMods.push(ti);
                                                        }

                                                    }
                                                }
                                                else {
                                                    // @ts-ignore
                                                    if (ec ===  180600)  //TACAN
                                                    {
                                                        if (modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1)) {
                                                            strText = modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1)!;
                                                            if (strText !==  null) {
                                                                ti = new TextInfo(strText, 0, 0, modifierFont, frc);

                                                                //One modifier symbols and modifier goes top right of symbol
                                                                x = (bounds.getMinX() + (bounds.getWidth() + bufferXR)) as number;

                                                                y = (bounds.getMinY() + labelHeight) as number;


                                                                ti.setLocation(Math.round(x), Math.round(y));
                                                                arrMods.push(ti);
                                                            }
                                                        }
                                                    }
                                                    else {
                                                        // @ts-ignore
                                                        if (ec ===  210300)  //Defended Asset
                                                        {
                                                            if (modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1)) {
                                                                strText = modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1)!;
                                                                if (strText !==  null) {
                                                                    ti = new TextInfo(strText, 0, 0, modifierFont, frc);

                                                                    //One modifier symbols and modifier goes top right of symbol
                                                                    x = (bounds.getMinX() - labelWidth - bufferXL) as number;

                                                                    y = (bounds.getMinY() + labelHeight) as number;


                                                                    ti.setLocation(Math.round(x), Math.round(y));
                                                                    arrMods.push(ti);
                                                                }
                                                            }
                                                        }
                                                        else {
                                                            // @ts-ignore
                                                            if (ec ===  210600)  //Air Detonation
                                                            {
                                                                if (modifiers.has(Modifiers.X_ALTITUDE_DEPTH)) {
                                                                    strText = modifiers.get(Modifiers.X_ALTITUDE_DEPTH)!;
                                                                    if (strText !==  null) {
                                                                        ti = new TextInfo(strText, 0, 0, modifierFont, frc);

                                                                        //One modifier symbols and modifier goes top right of symbol
                                                                        x = (bounds.getMinX() + (bounds.getWidth() + bufferXR)) as number;

                                                                        y = (bounds.getMinY() + labelHeight) as number;


                                                                        ti.setLocation(Math.round(x), Math.round(y));
                                                                        arrMods.push(ti);
                                                                    }
                                                                }
                                                            }
                                                            else {
                                                                // @ts-ignore
                                                                if (ec ===  210800)  //Impact Point
                                                                {
                                                                    if (modifiers.has(Modifiers.X_ALTITUDE_DEPTH)) {
                                                                        strText = modifiers.get(Modifiers.X_ALTITUDE_DEPTH)!;
                                                                        if (strText !==  null) {
                                                                            ti = new TextInfo(strText, 0, 0, modifierFont, frc);

                                                                            //One modifier symbols and modifier goes upper right of center
                                                                            x = (bounds.getX() + (bounds.getWidth() * 0.65)) as number;
                                                                            //                  x = x - (labelBounds.width * 0.5);
                                                                            y = (bounds.getY() + (bounds.getHeight() * 0.25)) as number;
                                                                            y = y + (labelHeight * 0.5) as number;


                                                                            ti.setLocation(Math.round(x), Math.round(y));
                                                                            arrMods.push(ti);
                                                                        }
                                                                    }
                                                                }
                                                                else {
                                                                    // @ts-ignore
                                                                    if (ec ===  211000)  //Launched Torpedo
                                                                    {
                                                                        if (modifiers.has(Modifiers.H_ADDITIONAL_INFO_1)) {
                                                                            strText = modifiers.get(Modifiers.H_ADDITIONAL_INFO_1)!;
                                                                            if (strText !==  null) {
                                                                                ti = new TextInfo(strText, 0, 0, modifierFont, frc);

                                                                                //One modifier symbols and modifier goes upper right of center
                                                                                labelWidth = Math.round(ti.getTextBounds().getWidth()) as number;
                                                                                x = (bounds.getX() + (bounds.getWidth() * 0.5) - (labelWidth / 2)) as number;
                                                                                y = (bounds.getY() - bufferY) as number;


                                                                                ti.setLocation(Math.round(x), Math.round(y));
                                                                                arrMods.push(ti);
                                                                            }
                                                                        }
                                                                    }
                                                                    else {
                                                                        // @ts-ignore
                                                                        if (ec ===  214900 || ec ===  215600)//General Sea SubSurface Station & General Sea Surface Station
                                                                        {
                                                                            if (modifiers.has(Modifiers.W_DTG_1)) {
                                                                                strText = modifiers.get(Modifiers.W_DTG_1)!;
                                                                                if (strText !==  null) {
                                                                                    ti = new TextInfo(strText + " - ", 0, 0, modifierFont, frc);

                                                                                    //One modifier symbols and modifier goes top right of symbol
                                                                                    x = (bounds.getMinX() + (bounds.getWidth() + bufferXR)) as number;
                                                                                    y = (bounds.getMinY() + labelHeight) as number;

                                                                                    ti.setLocation(Math.round(x), Math.round(y));
                                                                                    arrMods.push(ti);
                                                                                }
                                                                            }
                                                                            if (modifiers.has(Modifiers.W1_DTG_2)) {
                                                                                strText = modifiers.get(Modifiers.W1_DTG_2)!;
                                                                                if (strText !==  null) {
                                                                                    ti = new TextInfo(strText, 0, 0, modifierFont, frc);

                                                                                    //One modifier symbols and modifier goes top right of symbol
                                                                                    x = (bounds.getMinX() + (bounds.getWidth() + bufferXR)) as number;
                                                                                    y = (bounds.getMinY() + (labelHeight * 2)) as number;

                                                                                    ti.setLocation(Math.round(x), Math.round(y));
                                                                                    arrMods.push(ti);
                                                                                }
                                                                            }
                                                                            if (modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1)) {
                                                                                strText = modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1)!;
                                                                                if (strText !==  null) {
                                                                                    ti = new TextInfo(strText, 0, 0, modifierFont, frc);

                                                                                    //One modifier symbols and modifier goes top right of symbol
                                                                                    x = (bounds.getMinX() + (bounds.getWidth() + bufferXR)) as number;
                                                                                    y = (bounds.getMinY() + (labelHeight * 3)) as number;

                                                                                    ti.setLocation(Math.round(x), Math.round(y));
                                                                                    arrMods.push(ti);
                                                                                }
                                                                            }
                                                                        }
                                                                        else {
                                                                            // @ts-ignore
                                                                            if (ec ===  217000)//Shore Control Station
                                                                            {
                                                                                if (modifiers.has(Modifiers.H_ADDITIONAL_INFO_1)) {
                                                                                    strText = modifiers.get(Modifiers.H_ADDITIONAL_INFO_1)!;
                                                                                    if (strText !==  null) {
                                                                                        ti = new TextInfo(strText, 0, 0, modifierFont, frc);

                                                                                        //One modifier symbols and modifier goes upper right of center
                                                                                        labelWidth = Math.round(ti.getTextBounds().getWidth()) as number;
                                                                                        x = (bounds.getX() + (bounds.getWidth() * 0.5) - (labelWidth / 2)) as number;
                                                                                        y = (bounds.getY() + bounds.getHeight() + labelHeight + bufferY) as number;


                                                                                        ti.setLocation(Math.round(x), Math.round(y));
                                                                                        arrMods.push(ti);
                                                                                    }
                                                                                }
                                                                            }
                                                                            else {
                                                                                // @ts-ignore
                                                                                if (ec ===  250600)//Known Point
                                                                                {
                                                                                    if (modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1)) {
                                                                                        strText = modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1)!;
                                                                                        if (strText !==  null) {
                                                                                            ti = new TextInfo(strText, 0, 0, modifierFont, frc);

                                                                                            //One modifier symbols and modifier goes upper right of center
                                                                                            x = (bounds.getX() + (bounds.getWidth() + bufferXR)) as number;

                                                                                            if(!rendererSettings.getOutlineSPControlMeasures() &&
                                                                                                !(attributes.has(MilStdAttributes.OutlineSymbol) && (attributes.get(MilStdAttributes.OutlineSymbol)!.toUpperCase()=== "TRUE")))
                                                                                                x += bufferXR;

                                                                                            y = (bounds.getY() + (bounds.getHeight() * 0.30)) as number;

                                                                                            ti.setLocation(Math.round(x), Math.round(y));
                                                                                            arrMods.push(ti);
                                                                                        }
                                                                                    }
                                                                                }
                                                                            }

                                                                        }

                                                                    }

                                                                }

                                                            }

                                                        }

                                                    }

                                                }

                                            }

                                        }

                                    }

                                }

                            }

                        }

                    }

                }

            }

        }
        else {
            if (ss ===  SymbolID.SymbolSet_Atmospheric) {
                let modX: string | undefined;
                if (modifiers !==  null && modifiers.has(Modifiers.X_ALTITUDE_DEPTH)) {

                    modX = (modifiers.get(Modifiers.X_ALTITUDE_DEPTH))!;
                }


                if (ec ===  162300)//Freezing Level
                {
                    strText = "0" + String.fromCharCode(176) + ":";
                    if (modX !==  null) {

                        strText += modX;
                    }

                    else {

                        strText += "?";
                    }


                    ti = new TextInfo(strText, 0, 0, modifierFont, frc);
                    labelWidth = Math.round(ti.getTextBounds().getWidth()) as number;
                    //One modifier symbols and modifier goes in center
                    x = (bounds.getMinX() + (bounds.getWidth() * 0.5)) as number;
                    x = x - (labelWidth * 0.5) as number;
                    y = (bounds.getMinY() + (bounds.getHeight() * 0.5)) as number;
                    y = y + ((labelHeight - modifierFontDescent) * 0.5) as number;

                    ti.setLocation(Math.round(x), Math.round(y));
                    arrMods.push(ti);
                }
                else {
                    // @ts-ignore
                    if (ec ===  162200)//tropopause Level
                    {
                        strText = "X?";
                        if (modX !== undefined) {

                            strText = modX;
                        }


                        ti = new TextInfo(strText, 0, 0, modifierFont, frc);
                        labelWidth = Math.round(ti.getTextBounds().getWidth()) as number;
                        //One modifier symbols and modifier goes in center
                        x = (bounds.getMinX() + (bounds.getWidth() * 0.5)) as number;
                        x = x - (labelWidth * 0.5) as number;
                        y = (bounds.getMinY() + (bounds.getHeight() * 0.5)) as number;
                        y = y + ((labelHeight - modifierFontDescent) * 0.5) as number;

                        ti.setLocation(Math.round(x), Math.round(y));
                        arrMods.push(ti);
                    }
                    else {
                        // @ts-ignore
                        if (ec ===  110102)//tropopause Low
                        {
                            strText = "X?";
                            if (modX !== undefined) {

                                strText = modX;
                            }


                            ti = new TextInfo(strText, 0, 0, modifierFont, frc);
                            labelWidth = Math.round(ti.getTextBounds().getWidth()) as number;
                            //One modifier symbols and modifier goes in center
                            x = (bounds.getMinX() + (bounds.getWidth() * 0.5) as number) as number;
                            x = x - (labelWidth * 0.5) as number;
                            y = (bounds.getMinY() + (bounds.getHeight() * 0.5) as number) as number;
                            y = y - descent;

                            ti.setLocation(Math.round(x), Math.round(y));
                            arrMods.push(ti);
                        }
                        else {
                            // @ts-ignore
                            if (ec ===  110202)//tropopause High
                            {
                                strText = "X?";
                                if (modX !== undefined) {

                                    strText = modX;
                                }


                                ti = new TextInfo(strText, 0, 0, modifierFont, frc);
                                labelWidth = Math.round(ti.getTextBounds().getWidth()) as number;
                                //One modifier symbols and modifier goes in center
                                x = (bounds.getMinX() + (bounds.getWidth() * 0.5) as number) as number;
                                x = x - (labelWidth * 0.5) as number;
                                y = (bounds.getMinY() + (bounds.getHeight() * 0.5) as number) as number;
                                //y = y + (int) ((labelHeight * 0.5f) + (labelHeight/2));
                                y = y + (((labelHeight * 0.5) - (labelHeight / 2)) + labelHeight - descent) as number;

                                ti.setLocation(Math.round(x), Math.round(y));
                                arrMods.push(ti);
                            }
                        }

                    }

                }

            }
        }

        // </editor-fold>

        // <editor-fold defaultstate="collapsed" desc="DOM Arrow">
        let domPoints!: Point2D[] | null;
        let domBounds!: Rectangle2D | null;

        if (modifiers !==  null && modifiers.has(Modifiers.Q_DIRECTION_OF_MOVEMENT) &&
            SymbolUtilities.isCBRNEvent(symbolID))//CBRN events
        {
            strText = modifiers.get(Modifiers.Q_DIRECTION_OF_MOVEMENT)!;
            if (strText !==  null && SymbolUtilities.isNumber(strText)) {
                let q: number = parseFloat(strText);
                let tempBounds: Rectangle2D = RectUtilities.copyRect(bounds);

                tempBounds = tempBounds.createUnion(new Rectangle2D(bounds.getCenterX(), yForY, 0, 0));

                //boolean isY = modifiers.has(Modifiers.Y_LOCATION);

                domPoints = createDOMArrowPoints(symbolID, tempBounds, sdi.getSymbolCenterPoint(), q, false, frc, modifierFontHeight);

                domBounds = new Rectangle2D(domPoints[0].getX(), domPoints[0].getY(), 1, 1);

                let temp: Point2D;
                for (let i: number = 1; i < 6; i++) {
                    temp = domPoints[i];
                    if (temp !==  null) {
                        domBounds = domBounds.createUnion(new Rectangle2D(temp.getX(), temp.getY(), 0, 0));
                    }
                }
                imageBounds = imageBounds.createUnion(domBounds);
            }
        }
        // </editor-fold>

        // <editor-fold defaultstate="collapsed" desc="Build Feint Dummy Indicator">

        if (SymbolUtilities.hasFDI(symbolID)) {
            //create feint indicator /\
            fdiLeft = new Point2D(bounds.getX(), bounds.getY());
            fdiRight = new Point2D((bounds.getX() + bounds.getWidth()), bounds.getY());
            fdiTop = new Point2D(Math.round(bounds.getCenterX()), Math.round(bounds.getY() - (bounds.getWidth() * .5)));


            fdiBounds = new Rectangle2D(fdiLeft.getX(), fdiTop.getY(), fdiRight.getX() - fdiLeft.getX(), fdiLeft.getY() - fdiTop.getY());

            ti = new TextInfo("TEST", 0, 0, modifierFont, frc);
            if (ti !==  null && SymbolUtilities.isCBRNEvent(symbolID)) {
                let shiftY: number = Math.round(bounds.getY() - ti.getTextBounds().getHeight() - 2) as number;
                fdiLeft.setLocation(fdiLeft.getX(), fdiLeft.getY() + shiftY);
                //fdiLeft.offset(0, shiftY);
                fdiTop.setLocation(fdiTop.getX(), fdiTop.getY() + shiftY);
                //fdiTop.offset(0, shiftY);
                fdiRight.setLocation(fdiRight.getX(), fdiRight.getY() + shiftY);
                //fdiRight.offset(0, shiftY);
                fdiBounds = new Rectangle2D(fdiLeft.getX(), fdiTop.getY(), fdiRight.getX() - fdiLeft.getX(), fdiLeft.getY() - fdiTop.getY());
                //fdiBounds.offset(0, shiftY);
            }

            imageBounds = imageBounds.createUnion(fdiBounds);

        }
        // </editor-fold>

        // <editor-fold defaultstate="collapsed" desc="Shift Points and Draw">
        let modifierBounds!: Rectangle2D;
        if (arrMods !==  null && arrMods.length > 0) {

            //build modifier bounds/////////////////////////////////////////
            modifierBounds = arrMods[0].getTextOutlineBounds();
            let size: number = arrMods.length;
            let tempShape: TextInfo;
            for (let i: number = 1; i < size; i++) {
                tempShape = arrMods[i];
                modifierBounds = modifierBounds.createUnion(tempShape.getTextOutlineBounds());
            }

        }

        if (modifierBounds !==  null || domBounds !==  null || fdiBounds !==  null) {

            if (modifierBounds !==  null) {
                imageBounds = imageBounds.createUnion(modifierBounds);
            }
            if (domBounds !==  null) {
                imageBounds = imageBounds.createUnion(domBounds);
            }
            if (fdiBounds !==  null) {
                imageBounds = imageBounds.createUnion(fdiBounds);
            }

            //shift points if needed////////////////////////////////////////
            if (sdi instanceof ImageInfo && (imageBounds.getMinX() < 0 || imageBounds.getMinY() < 0)) {
                let shiftX: number = Math.abs(imageBounds.getMinX() as number);
                let shiftY: number = Math.abs(imageBounds.getMinY() as number);

                //shift mobility points
                let size: number = arrMods.length;
                let tempShape: TextInfo;
                for (let i: number = 0; i < size; i++) {
                    tempShape = arrMods[i];
                    tempShape.shift(shiftX, shiftY);
                }
                if (modifierBounds !==  null) {

                    RectUtilities.shift(modifierBounds, shiftX, shiftY);
                }


                if (domBounds !==  null) {
                    for (let i: number = 0; i < 6; i++) {
                        let temp: Point2D = domPoints![i];
                        if (temp !==  null) {
                            temp.setLocation(temp.getX() + shiftX, temp.getY() + shiftY);
                        }
                    }
                    RectUtilities.shift(domBounds, shiftX, shiftY);
                }

                //If there's an FDI
                if (fdiBounds !==  null) {
                    ShapeUtilities.offset(fdiBounds, shiftX, shiftY);
                    ShapeUtilities.offset(fdiLeft, shiftX, shiftY);
                    ShapeUtilities.offset(fdiTop, shiftX, shiftY);
                    ShapeUtilities.offset(fdiRight, shiftX, shiftY);
                }

                //shift image points
                centerPoint.setLocation(centerPoint.getX() + shiftX, centerPoint.getY() + shiftY);
                RectUtilities.shift(symbolBounds, shiftX, shiftY);
                RectUtilities.shift(imageBounds, shiftX, shiftY);
            }

            if (attributes.has(MilStdAttributes.TextColor)) {
                textColor = RendererUtilities.getColorFromHexString(attributes.get(MilStdAttributes.TextColor)!)!;
            }
            if (attributes.has(MilStdAttributes.TextBackgroundColor)) {
                textBackgroundColor = RendererUtilities.getColorFromHexString(attributes.get(MilStdAttributes.TextBackgroundColor)!)!;
            }
            textColor = RendererUtilities.setColorAlpha(textColor, alpha);
            textBackgroundColor = RendererUtilities.setColorAlpha(textBackgroundColor, alpha);

            if (sdi instanceof SVGSymbolInfo) {
                let svgStroke: string = RendererUtilities.colorToHexString(lineColor, false);
                let svgStrokeWidth: number = strokeWidth;//"3";
                let svgAlpha: string;
                if (alpha > -1) {

                    svgAlpha = alpha.toString();
                }

                ssi = sdi as SVGSymbolInfo;
                let sbSVG:string =  "";
                sbSVG += (ssi.getSVG());
                sbSVG += (renderTextElements(arrMods, textColor, textBackgroundColor));

                // <editor-fold defaultstate="collapsed" desc="DOM arrow">
                if (domBounds !==  null) {
                    let domPath: Path = new Path();

                    domPath.moveTo(domPoints![0].getX(), domPoints![0].getY());
                    if (domPoints![1] !==  null) {
                        domPath.lineTo(domPoints![1].getX(), domPoints![1].getY());
                    }
                    if (domPoints![2] !==  null) {
                        domPath.lineTo(domPoints![2].getX(), domPoints![2].getY());
                    }
                    sbSVG += (domPath.toSVGElement(svgStroke, svgStrokeWidth, null));

                    domPath = new Path();

                    domPath.moveTo(domPoints![3].getX(), domPoints![3].getY());
                    domPath.lineTo(domPoints![4].getX(), domPoints![4].getY());
                    domPath.lineTo(domPoints![5].getX(), domPoints![5].getY());
                    sbSVG += (domPath.toSVGElement(null, 0, svgStroke));

                    domBounds = null;
                    domPoints = null;
                }
                // </editor-fold>

                //<editor-fold defaultstate="collapsed" desc="Draw FDI">
                if (fdiBounds !==  null) {
                    let svgFDIDashArray: string = "6 4";
                    let dashArray: number[] = [6, 4];

                    if (symbolBounds.getHeight() < 20) {
                        svgFDIDashArray = "5 3";
                    }

                    /// ///////////////////////////////////
                    //Divide line in 14 parts. line is 3 parts to 2 parts gap
                    let distance: number = RendererUtilities.getDistanceBetweenPoints(fdiTop,fdiLeft);
                    //distance = distance / 14f;
                    dashArray[1] = ((distance / 14) * 2);
                    dashArray[0] = ((distance / 14) * 3);//*/
                    svgFDIDashArray = "" + dashArray[0] + " " + dashArray[1];
                    /// //////////////////////////////////

                    let fdiPath: Path = new Path();
                    fdiPath.moveTo(fdiTop.getX(), fdiTop.getY());
                    fdiPath.lineTo(fdiLeft.getX(), fdiLeft.getY());
                    fdiPath.moveTo(fdiTop.getX(), fdiTop.getY());
                    fdiPath.lineTo(fdiRight.getX(), fdiRight.getY());//*/

                    sbSVG += (fdiPath.toSVGElement(svgStroke, svgStrokeWidth, null));
                }
                //</editor-fold>

                newsdi = new SVGSymbolInfo(sbSVG.toString().valueOf(), centerPoint, symbolBounds, imageBounds);

            }


            // <editor-fold defaultstate="collapsed" desc="Cleanup">

            // </editor-fold>

            return newsdi;

        }
        else
        {
            return null;
        }
        // </editor-fold>

    }

/**
 * Process modifiers for action points
 */
export function ProcessTGSPModifiers(sdi: SymbolDimensionInfo, symbolID: string, modifiers: Map<string, string>, attributes: Map<string, string>, lineColor: Color, frc: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D): SymbolDimensionInfo {

        // <editor-fold defaultstate="collapsed" desc="Variables">
        let ii: ImageInfo;
        let ssi: SVGSymbolInfo;

        let modifierFont: Font = getFont(attributes);//ModifierRenderer.RS.getLabelFont();
        let hd:number[] = getFontHeightandDescent(modifierFont,frc);
        let modifierFontHeight: number = hd[0];
        let modifierFontDescent: number = hd[1];

        let bufferXL: number = 6;
        let bufferXR: number = 4;
        let bufferY: number = 2;
        let bufferText: number = 2;
        let centerOffset: number = 1; //getCenterX/Y function seems to go over by a pixel
        let x: number = 0;
        let y: number = 0;
        let x2: number = 0;
        let y2: number = 0;

        //Feint Dummy Indicator variables
        let fdiBounds!: Rectangle2D;
        let fdiTop!: Point2D;
        let fdiLeft!: Point2D;
        let fdiRight!: Point2D;

        let outlineOffset: number = rendererSettings.getTextOutlineWidth();
        let labelHeight: number = 0;
        let labelWidth: number = 0;
        let alpha: number = -1;
        let newsdi!: SymbolDimensionInfo;

        let textColor: Color = lineColor;
        let textBackgroundColor!: Color;

        let arrMods: Array<TextInfo> = new Array<TextInfo>();
        let duplicate: boolean = false;

        let msi: MSInfo = msLookup.getMSLInfo(symbolID);


        if (attributes.has(MilStdAttributes.Alpha)) {
            alpha = parseFloat(attributes.get(MilStdAttributes.Alpha)!) / 255;
        }

        let bounds: Rectangle2D = RectUtilities.copyRect(sdi.getSymbolBounds());
        let symbolBounds: Rectangle2D = RectUtilities.copyRect((sdi.getSymbolBounds()));
        let centerPoint: Point2D = sdi.getSymbolCenterPoint();
        let imageBounds: Rectangle2D = RectUtilities.copyRect((sdi.getImageBounds()));

        //centerPoint = new Point2D(Math.round(sdi.getSymbolCenterPoint().x), Math.round(sdi.getSymbolCenterPoint().y));
        centerPoint = new Point2D(sdi.getSymbolCenterPoint().x, sdi.getSymbolCenterPoint().y);

        let byLabelHeight: boolean = false;

        labelHeight = Math.round(modifierFontHeight + 0.5);
        let maxHeight: number = (symbolBounds.getHeight()) as number;
        if ((labelHeight * 3) > maxHeight) {
            byLabelHeight = true;
        }

        let descent: number = (modifierFontDescent) as number;
        let yForY: number = -1;

        let labelBounds1: Rectangle2D;//text.getPixelBounds(null, 0, 0);
        let labelBounds2: Rectangle2D;
        let strText: string = "";
        let strText1: string = "";
        let strText2: string = "";
        let text1: TextInfo;
        let text2: TextInfo;

        let basicID: string = SymbolUtilities.getBasicSymbolID(symbolID);

        if (outlineOffset > 2) {
            outlineOffset = ((outlineOffset - 1) / 2);
        }
        else {
            outlineOffset = 0;
        }

        /*bufferXL += outlineOffset;
         bufferXR += outlineOffset;
         bufferY += outlineOffset;
         bufferText += outlineOffset;*/
        // </editor-fold>
        // <editor-fold defaultstate="collapsed" desc="Process Modifiers">
        let ti: TextInfo;

        if(modifiers !==  null && modifiers.size > 0)
        {
            if (msi.getModifiers().includes(Modifiers.N_HOSTILE) && modifiers.has(Modifiers.N_HOSTILE)) {
                strText = modifiers.get(Modifiers.N_HOSTILE)!;
                if (strText !==  null) {
                    ti = new TextInfo(strText, 0, 0, modifierFont, frc);

                    x = (bounds.getMinX() + bounds.getWidth() + bufferXR) as number;

                    if (!byLabelHeight) {
                        y = ((bounds.getHeight() / 3) * 2) as number;//checkpoint, get box above the point
                        y = bounds.getMinY() as number + y;
                    }
                    else {
                        //y = ((labelHeight + bufferText) * 3);
                        //y = bounds.y + y - descent;
                        y = (bounds.getMinY() + bounds.getHeight()) as number;
                    }

                    ti.setLocation(x, y);
                    arrMods.push(ti);
                }

            }
            if (msi.getModifiers().includes(Modifiers.H_ADDITIONAL_INFO_1) && modifiers.has(Modifiers.H_ADDITIONAL_INFO_1)) {
                strText = modifiers.get(Modifiers.H_ADDITIONAL_INFO_1)!;
                if (strText !==  null) {
                    ti = new TextInfo(strText, 0, 0, modifierFont, frc);
                    labelWidth = Math.round(ti.getTextBounds().getWidth()) as number;

                    x = (bounds.getMinX() + (bounds.getWidth() * 0.5)) as number;
                    x = x - (labelWidth * 0.5) as number;
                    y = bounds.getMinY() as number - descent;

                    ti.setLocation(x, y);
                    arrMods.push(ti);
                }
            }
            if (msi.getModifiers().includes(Modifiers.H1_ADDITIONAL_INFO_2) && modifiers.has(Modifiers.H1_ADDITIONAL_INFO_2)) {
                strText = modifiers.get(Modifiers.H1_ADDITIONAL_INFO_2)!;
                if (strText !==  null) {
                    ti = new TextInfo(strText, 0, 0, modifierFont, frc);
                    labelWidth = Math.round(ti.getTextBounds().getWidth()) as number;

                    x = (bounds.getMinX() + (bounds.getWidth() * 0.5)) as number;
                    x = x - (labelWidth * 0.5) as number;
                    y = (bounds.getMinY() + labelHeight - descent + (bounds.getHeight() * 0.07)) as number;

                    ti.setLocation(x, y);
                    arrMods.push(ti);
                }
            }
            if (msi.getModifiers().includes(Modifiers.A_SYMBOL_ICON)) {
                if (modifiers.has(Modifiers.A_SYMBOL_ICON)) {

                    strText = modifiers.get(Modifiers.A_SYMBOL_ICON)!;
                }

                else {
                    if (SymbolID.getEntityCode(symbolID) ===  321706) {
                        //NATO Multiple Supply Class Point
                        strText = "ALL?";
                    }

                }
                //make it clear the required 'A' value wasn't set for this symbol.

                if (strText !==  null) {
                    ti = new TextInfo(strText, 0, 0, modifierFont, frc);
                    labelWidth = Math.round(ti.getTextBounds().getWidth()) as number;

                    x = (bounds.getMinX() + (bounds.getWidth() * 0.5)) as number;
                    x = x - (labelWidth * 0.5) as number;
                    y = (bounds.getMinY() + labelHeight - descent + (bounds.getHeight() * 0.07)) as number;

                    ti.setLocation(x, y);
                    arrMods.push(ti);
                }
            }
            if (msi.getModifiers().includes(Modifiers.W_DTG_1) && modifiers.has(Modifiers.W_DTG_1)) {
                strText = modifiers.get(Modifiers.W_DTG_1)!;
                if (strText !==  null) {
                    ti = new TextInfo(strText, 0, 0, modifierFont, frc);
                    labelWidth = Math.round(ti.getTextBounds().getWidth()) as number;

                    x = (bounds.getMinX() - labelWidth - bufferXL) as number;
                    y = (bounds.getMinY() + labelHeight - descent) as number;

                    ti.setLocation(x, y);
                    arrMods.push(ti);
                }
            }
            if (msi.getModifiers().includes(Modifiers.W1_DTG_2) && modifiers.has(Modifiers.W1_DTG_2)) {
                strText = modifiers.get(Modifiers.W1_DTG_2)!;
                if (strText !==  null) {
                    ti = new TextInfo(strText, 0, 0, modifierFont, frc);
                    labelWidth = Math.round(ti.getTextBounds().getWidth()) as number;

                    x = bounds.getMinX() as number - labelWidth - bufferXL;

                    y = ((labelHeight - descent + bufferText) * 2);
                    y = bounds.getMinY() as number + y;

                    ti.setLocation(x, y);
                    arrMods.push(ti);
                }
            }
            if (msi.getModifiers().includes(Modifiers.T_UNIQUE_DESIGNATION_1) && modifiers.has(Modifiers.T_UNIQUE_DESIGNATION_1)) {
                strText = modifiers.get(Modifiers.T_UNIQUE_DESIGNATION_1)!;
                if (strText !==  null) {
                    ti = new TextInfo(strText, 0, 0, modifierFont, frc);

                    x = (bounds.getMinX() + bounds.getWidth() + bufferXR) as number;
                    y = bounds.getMinY() as number + labelHeight - descent;

                    ti.setLocation(x, y);
                    arrMods.push(ti);
                }
            }
            if (msi.getModifiers().includes(Modifiers.T1_UNIQUE_DESIGNATION_2) && modifiers.has(Modifiers.T1_UNIQUE_DESIGNATION_2)) {
                strText = modifiers.get(Modifiers.T1_UNIQUE_DESIGNATION_2)!;
                if (strText !==  null) {
                    ti = new TextInfo(strText, 0, 0, modifierFont, frc);
                    labelWidth = Math.round(ti.getTextBounds().getWidth()) as number;

                    //points
                    x = (bounds.getMinX() + (bounds.getWidth() * 0.5)) as number;
                    x = x - (labelWidth * 0.5) as number;
                    //y = bounds.y + (bounds.getHeight * 0.5);

                    y = ((bounds.getHeight() * 0.55)) as number;//633333333
                    y = bounds.getMinY() as number + y;

                    let ec:number = SymbolID.getEntityCode(symbolID);
                    if((ec >= 281800 && ec <= 281809) || ec == 321100)
                    {
                        y = ((bounds.getHeight() * 0.63));
                        y = bounds.getMinY() + y;
                    }

                    ti.setLocation(x, y);
                    arrMods.push(ti);
                }
            }

        }
        // <editor-fold defaultstate="collapsed" desc="Build Feint Dummy Indicator">

        if (SymbolUtilities.hasFDI(symbolID)) {
            //create feint indicator /\
            fdiLeft = new Point2D(bounds.getX(), bounds.getY());
            fdiRight = new Point2D((bounds.getX() + bounds.getWidth()), bounds.getY());
            fdiTop = new Point2D(Math.round(bounds.getCenterX()), Math.round(bounds.getY() - (bounds.getWidth() * .5)));


            fdiBounds = new Rectangle2D(fdiLeft.getX(), fdiTop.getY(), fdiRight.getX() - fdiLeft.getX(), fdiLeft.getY() - fdiTop.getY());

            ti = new TextInfo("TEST", 0, 0, modifierFont, frc);
            if (ti !==  null) {
                let shiftY: number = Math.round(bounds.getY() - ti.getTextBounds().getHeight() - 2) as number;
                fdiLeft.setLocation(fdiLeft.getX(), fdiLeft.getY() + shiftY);
                //fdiLeft.offset(0, shiftY);
                fdiTop.setLocation(fdiTop.getX(), fdiTop.getY() + shiftY);
                //fdiTop.offset(0, shiftY);
                fdiRight.setLocation(fdiRight.getX(), fdiRight.getY() + shiftY);
                //fdiRight.offset(0, shiftY);
                fdiBounds = new Rectangle2D(fdiLeft.getX(), fdiTop.getY(), fdiRight.getX() - fdiLeft.getX(), fdiLeft.getY() - fdiTop.getY());
                //fdiBounds.offset(0, shiftY);
            }

            imageBounds = imageBounds.createUnion(fdiBounds);
        // </editor-fold>

        }

        // </editor-fold>
        // <editor-fold defaultstate="collapsed" desc="Shift Points and Draw">
        let modifierBounds!: Rectangle2D;
        if (arrMods !==  null && arrMods.length > 0) {

            //build modifier bounds/////////////////////////////////////////
            modifierBounds = arrMods[0].getTextOutlineBounds();
            let size: number = arrMods.length;
            let tempShape: TextInfo;
            for (let i: number = 1; i < size; i++) {
                tempShape = arrMods[i];
                modifierBounds = modifierBounds.createUnion(tempShape.getTextOutlineBounds());
            }

        }

        if (fdiBounds !==  null) {
            if (modifierBounds !==  null) {

                modifierBounds = modifierBounds.createUnion(fdiBounds);
            }

            else {

                modifierBounds = fdiBounds;
            }

        }


        if (modifierBounds !==  null) {

            imageBounds = imageBounds.createUnion(modifierBounds);

            //shift points if needed////////////////////////////////////////
            if (sdi instanceof ImageInfo && (imageBounds.getMinX() < 0 || imageBounds.getMinY() < 0)) {
                let shiftX: number = Math.abs(imageBounds.getMinX()) as number;
                let shiftY: number = Math.abs(imageBounds.getMinY()) as number;

                //shift mobility points
                let size: number = arrMods.length;
                let tempShape: TextInfo;
                for (let i: number = 0; i < size; i++) {
                    tempShape = arrMods[i];
                    tempShape.shift(shiftX, shiftY);
                }
                RectUtilities.shift(modifierBounds, shiftX, shiftY);

                //shift image points
                centerPoint.setLocation(centerPoint.getX() + shiftX, centerPoint.getY() + shiftY);
                RectUtilities.shift(symbolBounds, shiftX, shiftY);
                RectUtilities.shift(imageBounds, shiftX, shiftY);

                //If there's an FDI
                if (fdiBounds !==  null) {
                    ShapeUtilities.offset(fdiBounds, shiftX, shiftY);
                    ShapeUtilities.offset(fdiLeft, shiftX, shiftY);
                    ShapeUtilities.offset(fdiTop, shiftX, shiftY);
                    ShapeUtilities.offset(fdiRight, shiftX, shiftY);
                }
            }

            if (attributes.has(MilStdAttributes.TextColor)) {
                textColor = RendererUtilities.getColorFromHexString(attributes.get(MilStdAttributes.TextColor)!)!;
            }
            if (attributes.has(MilStdAttributes.TextBackgroundColor)) {
                textBackgroundColor = RendererUtilities.getColorFromHexString(attributes.get(MilStdAttributes.TextBackgroundColor)!)!;
            }
            textColor = RendererUtilities.setColorAlpha(textColor, alpha);
            textBackgroundColor = RendererUtilities.setColorAlpha(textBackgroundColor, alpha);

            if (sdi instanceof SVGSymbolInfo) {
                let svgStroke: string = RendererUtilities.colorToHexString(lineColor, false);
                let svgStrokeWidth: number = 3;
                let svgAlpha: string;
                if (alpha > -1) {

                    svgAlpha = alpha.toString();
                }

                ssi = sdi as SVGSymbolInfo;
                let sbSVG:string = "";
                sbSVG += (ssi.getSVG());
                sbSVG += (renderTextElements(arrMods, textColor, textBackgroundColor));

                //<editor-fold defaultstate="collapsed" desc="Draw FDI">
                if (fdiBounds !==  null) {
                    let svgFDIDashArray: string = "6 4";
                    let dashArray: number[] = [6, 4];

                    if (symbolBounds.getHeight() < 20) {
                        svgFDIDashArray = "5 3";
                    }

                    /// ///////////////////////////////////
                    //Divide line in 14 parts. line is 3 parts to 2 parts gap
                    let distance: number = RendererUtilities.getDistanceBetweenPoints(fdiTop,fdiLeft);
                    //distance = distance / 14f;
                    dashArray[1] = ((distance / 14) * 2);
                    dashArray[0] = ((distance / 14) * 3);//*/
                    svgFDIDashArray = "" + dashArray[0] + " " + dashArray[1];
                    /// //////////////////////////////////

                    let fdiPath: Path = new Path();
                    fdiPath.moveTo(fdiTop.getX(), fdiTop.getY());
                    fdiPath.lineTo(fdiLeft.getX(), fdiLeft.getY());
                    fdiPath.moveTo(fdiTop.getX(), fdiTop.getY());
                    fdiPath.lineTo(fdiRight.getX(), fdiRight.getY());//*/

                    fdiPath.setLineDash(svgFDIDashArray);
                    sbSVG += (fdiPath.toSVGElement(svgStroke, svgStrokeWidth, null));
                }
                //</editor-fold>

                newsdi = new SVGSymbolInfo(sbSVG.toString().valueOf(), centerPoint, symbolBounds, imageBounds);
            }

            // <editor-fold defaultstate="collapsed" desc="Cleanup">

            // </editor-fold>
        }
        // </editor-fold>
        return newsdi;
}
