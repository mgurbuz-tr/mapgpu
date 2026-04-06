//Graphics2D
import { BasicStroke } from "../graphics/BasicStroke"
import { Font } from "../graphics/Font"
import { Point2D } from "../graphics/Point2D"
import { Rectangle2D } from "../graphics/Rectangle2D"

//Renderer/Shapes
import { Rectangle } from "./shapes/rectangle";
import { Line } from "./shapes/line";
import { Ellipse } from "./shapes/ellipse";
import { RoundedRectangle } from "./shapes/roundedrectangle";
import { Path } from "./shapes/path";

//Renderer.Utilities
import { Color } from "./utilities/Color"
import { gencLookup } from "./utilities/GENCLookup"
import { ImageInfo } from "./utilities/ImageInfo"
import { MilStdAttributes } from "./utilities/MilStdAttributes"
import { Modifiers } from "./utilities/Modifiers"
import { MSInfo } from "./utilities/MSInfo"
import { msLookup } from "./utilities/MSLookup"
import { RectUtilities } from "./utilities/RectUtilities"
import { RendererSettings, rendererSettings } from "./utilities/RendererSettings"
import { RendererUtilities } from "./utilities/RendererUtilities"
import { SettingsChangedEvent } from "./utilities/SettingsChangedEvent"
import { SettingsEventListener } from "./utilities/SettingsEventListener"
import { Shape2SVG } from "./utilities/Shape2SVG"
import { SVGSymbolInfo } from "./utilities/SVGSymbolInfo"
import { SymbolDimensionInfo } from "./utilities/SymbolDimensionInfo"
import { SymbolID } from "./utilities/SymbolID"
import { SymbolUtilities } from "./utilities/SymbolUtilities"
import { TextInfo } from "./utilities/TextInfo"
import { ShapeUtilities } from "./utilities/ShapeUtilities";
import { SVGTextInfo } from "./utilities/SVGTextInfo";
import { ShapeTypes } from "./shapes/types";

import { createMeasureCanvas } from '../canvas-factory';
import { SVGLookup } from "./utilities/SVGLookup";
import { SVGInfo } from "./utilities/SVGInfo";
import { ErrorLogger } from "./utilities/ErrorLogger";
import { Modifier } from "./utilities/Modifier";

// Import sub-renderer modules
import {
    getFont,
    getFontHeightandDescent,
    renderTextElement,
    renderTextElements,
    renderText,
    shiftUnitPointsAndDraw,
    isCOnTop
} from "./modifiers/ModifierRenderUtils";

import {
    createDOMArrowPoints,
    createDOMArrowHead,
    drawDOMArrow
} from "./modifiers/DirectionArrowRenderer";

import {
    processOperationalConditionIndicator,
    processOperationalConditionIndicatorSlash
} from "./modifiers/OperationalConditionRenderer";

import {
    processSpeedLeader
} from "./modifiers/SpeedLeaderRenderer";

import {
    buildMobilityModifiers
} from "./modifiers/MobilityRenderer";

import {
    buildEchelonTFModifiers
} from "./modifiers/EchelonTFRenderer";

import {
    buildEngagementBar,
    buildAffiliationModifier,
    buildHQStaff,
    buildRestrictedIndicator,
    buildNoStrikeIndicator,
    assembleSVG
} from "./modifiers/DisplayModifierComposer";

import {
    getLabelPositionIndexes,
    getLabelXPosition,
    getLabelYPosition
} from "./modifiers/TextModifierLayout";

import {
    processUnknownTextModifiers,
    processSPTextModifiers
} from "./modifiers/UnitTextModifierRenderer";

import {
    ProcessTGSPWithSpecialModifierLayout,
    ProcessTGSPModifiers
} from "./modifiers/TGSPModifierRenderer";

/**
 * This class is used for rendering the labels/amplifiers/modifiers around the single point symbol.
 * It acts as a thin facade that delegates to specialized sub-renderer modules.
 */
export class ModifierRenderer implements SettingsEventListener {

    private static _instance: ModifierRenderer;
    private static _className: string = "ModifierRenderer";
    private static RS: RendererSettings = rendererSettings;
    private static _modifierFont: Font = ModifierRenderer.RS.getLabelFont();

    private static _modifierFontHeight: number = 11;
    private static _modifierFontDescent: number = 3;

    private static isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;
    private static isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
    private static OSCDefined = typeof OffscreenCanvasRenderingContext2D !== 'undefined';//web workers fail isBrowser test

    private static _bmp: any;//OffscreenCanvas | Canvas;
    private static _frc: any;//OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

    public SettingsEventChanged(type: string): void {
        if (type === (SettingsChangedEvent.EventType_FontChanged)) {
            ModifierRenderer._modifierFont = rendererSettings.getLabelFont();
            ModifierRenderer._frc.font = ModifierRenderer._modifierFont.toString();

            //get new ascent and descent
            let tm: TextMetrics = ModifierRenderer._frc.measureText("Hj");
            if(ModifierRenderer.OSCDefined)//If OffscreenCanvas defined
            {
                ModifierRenderer._modifierFontHeight = tm.fontBoundingBoxAscent;//fm.getHeight();
                ModifierRenderer._modifierFontDescent = tm.fontBoundingBoxDescent;//fm.getMaxDescent();
            }
            else//likely in Node using node-canvas which uses different values in TextMetrics
            {
                ModifierRenderer._modifierFontHeight = tm.emHeightAscent;//fm.getHeight();
                ModifierRenderer._modifierFontDescent = tm.emHeightDescent;//fm.getMaxDescent();
            }
        }
    }

    private constructor() {
    }

    /**
     * Instance of the ModifierRenderer class
     * @return the instance
     */
    public static getInstance(): ModifierRenderer {
        if (!ModifierRenderer._instance) {
            if(ModifierRenderer.OSCDefined) {
                ModifierRenderer._bmp = new OffscreenCanvas(2, 2);
            }
            else {
                ModifierRenderer._bmp = createMeasureCanvas(2, 2);
            }
            ModifierRenderer._frc = ModifierRenderer._bmp.getContext("2d");

            ModifierRenderer._instance = new ModifierRenderer();
            rendererSettings.addEventListener(ModifierRenderer._instance);
            ModifierRenderer._instance.SettingsEventChanged(SettingsChangedEvent.EventType_FontChanged);
        }

        return ModifierRenderer._instance;
    }

    /**
     * Processes unit display modifiers by delegating to specialized sub-renderers.
     * This is the orchestration method that coordinates all modifier rendering.
     */
    public static processUnitDisplayModifiers(
        sdi: SymbolDimensionInfo,
        symbolID: string,
        modifiers: Map<string, string>,
        attributes: Map<string, string>,
        frc: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D
    ): SymbolDimensionInfo | null {

        let RS: RendererSettings = rendererSettings;
        let modifierFont: Font = getFont(attributes);
        let hd:number[] = getFontHeightandDescent(modifierFont, frc);
        let modifierFontHeight: number = hd[0];
        let modifierFontDescent: number = hd[1];

        // Initialize variable setup
        let ii: ImageInfo;
        let ssi: SVGSymbolInfo;
        let newsdi: SymbolDimensionInfo;
        let symbolBounds: Rectangle2D = sdi.getSymbolBounds().clone() as Rectangle2D;
        let imageBounds: Rectangle2D = sdi.getImageBounds();
        let centerPoint: Point2D = sdi.getSymbolCenterPoint();
        let symbolCenter: Point2D = new Point2D(symbolBounds.getCenterX(), symbolBounds.getCenterY());
        let textColor: Color = Color.BLACK;
        let textBackgroundColor: Color;
        let strokeWidth: number = 3.0;
        let strokeWidthNL: number = 3.0;
        let lineColor: Color = Color.BLACK;
        let fillColor: Color = SymbolUtilities.getFillColorOfAffiliation(symbolID);
        let buffer: number = 0;
        let alpha: number = -1;
        let offsetX: number = 0;
        let offsetY: number = 0;
        let pixelSize: number = rendererSettings.getDefaultPixelSize();

        let ss: number = SymbolID.getSymbolSet(symbolID);

        // Apply attributes
        if (attributes.has(MilStdAttributes.Alpha)) {
            alpha = parseFloat(attributes.get(MilStdAttributes.Alpha)) / 255;
        }
        if (attributes.has(MilStdAttributes.TextColor)) {
            textColor = RendererUtilities.getColorFromHexString(attributes.get(MilStdAttributes.TextColor));
        }
        if (attributes.has(MilStdAttributes.TextBackgroundColor)) {
            textBackgroundColor = RendererUtilities.getColorFromHexString(attributes.get(MilStdAttributes.TextBackgroundColor));
        }
        else {
            textBackgroundColor = RendererUtilities.getIdealOutlineColor(textColor);
        }
        if (attributes.has(MilStdAttributes.LineColor)) {
            lineColor = RendererUtilities.getColorFromHexString(attributes.get(MilStdAttributes.LineColor));
        }
        if (attributes.has(MilStdAttributes.FillColor)) {
            fillColor = RendererUtilities.getColorFromHexString(attributes.get(MilStdAttributes.FillColor));
        }
        if (attributes.has(MilStdAttributes.PixelSize)) {
            pixelSize = parseInt(attributes.get(MilStdAttributes.PixelSize));
        }

        let dpi:number = rendererSettings.getDeviceDPI();
        strokeWidth = 1;
        strokeWidth = Math.max(pixelSize / 25, strokeWidth);
        strokeWidth = Math.min(strokeWidth, dpi/32);

        let ad: number = SymbolID.getAmplifierDescriptor(symbolID);

        // Build Mobility Modifiers
        let mobilityResult = buildMobilityModifiers(symbolID, symbolBounds, ad, strokeWidth);
        let mobilityBounds: Rectangle2D = mobilityResult.mobilityBounds ? mobilityResult.mobilityBounds.toRectangle2D() : null;
        let mobilityPath: Array<any> = mobilityResult.mobilityPath;
        let mobilityPathFill: Array<any> = mobilityResult.mobilityPathFill;

        // Build Echelon/TF Modifiers
        let echelonTFData = buildEchelonTFModifiers(symbolID, symbolBounds, imageBounds, frc, pixelSize);
        let echelonTFResult = echelonTFData.result;
        imageBounds = echelonTFData.imageBounds;
        let stiEchelon: SVGTextInfo = echelonTFResult.stiEchelon ?? null;
        let echelonBounds: Rectangle2D = echelonTFResult.echelonBounds ?? null;
        let tfBounds: Rectangle2D = echelonTFResult.tfBounds ?? null;
        let tfRectangle: Rectangle2D = echelonTFResult.tfRectangle ?? null;
        let pt1HQ: Point2D = null;
        let pt2HQ: Point2D = null;
        let hqBounds: Rectangle2D = null;

        // Build Engagement Bar
        let engagementResult = buildEngagementBar(
            symbolID, modifiers, symbolBounds, symbolCenter, fillColor,
            modifierFont.toString(), frc, attributes, imageBounds, null, tfBounds, echelonBounds
        );
        let stiAO: SVGTextInfo = engagementResult.stiAO;
        let ebRectangle: Rectangle2D = engagementResult.ebRectangle;
        let ebBounds: Rectangle2D = engagementResult.ebBounds;
        let ebColor: Color = engagementResult.ebColor;

        // Build Affiliation Modifier
        let affiliationResult = buildAffiliationModifier(
            symbolID, symbolBounds, echelonBounds, imageBounds, frc
        );
        let stiAM: SVGTextInfo = affiliationResult.stiAM;
        let amBounds: Rectangle2D = affiliationResult.amBounds;

        // Build HQ/Staff
        let hqResult = buildHQStaff(symbolID, symbolBounds, centerPoint, imageBounds);
        if (hqResult && hqResult.hqBounds) {
            pt1HQ = hqResult.pt1HQ;
            pt2HQ = hqResult.pt2HQ;
            hqBounds = hqResult.hqBounds;
        }

        // Initialize bounds variables needed for DOM arrow and OCI
        let domBounds: Rectangle2D = null;
        let domPoints: Point2D[] = null;
        let ociBounds: Rectangle2D = null;
        let ociShape: Rectangle2D = null;
        let ociSlashShape: Path = null;
        let fdiBounds: Rectangle2D = echelonTFResult.fdiBounds ?? null;
        let fdiTop: Point2D = echelonTFResult.fdiTop ?? null;
        let fdiLeft: Point2D = echelonTFResult.fdiLeft ?? null;
        let fdiRight: Point2D = echelonTFResult.fdiRight ?? null;
        let liBounds: Rectangle2D = echelonTFResult.liBounds ?? null;
        let liPath: Path = echelonTFResult.liPath ?? null;

        // Handle DOM Arrow bounds (Direction of Movement)
        if (modifiers != null && modifiers.has(Modifiers.Q_DIRECTION_OF_MOVEMENT)) {
            let angle: number = parseFloat(modifiers.get(Modifiers.Q_DIRECTION_OF_MOVEMENT));
            domPoints = createDOMArrowPoints(symbolID, symbolBounds, centerPoint, angle, false, frc, modifierFontHeight);
            if (domPoints != null) {
                domBounds = new Rectangle2D(0, 0, 1, 1);
            }
        }

        // Handle OCI bounds (Operational Condition Indicator)
        let status: number = SymbolID.getStatus(symbolID);
        if (status > 1) {
            ociBounds = processOperationalConditionIndicator(symbolID, symbolBounds, offsetY);
            if (ociBounds != null) {
                ociShape = ociBounds;
                imageBounds = imageBounds.createUnion(ociBounds);
            }
            ociSlashShape = processOperationalConditionIndicatorSlash(symbolID, symbolBounds);
        }

        // Build Restricted Indicator
        let restrictedResult = buildRestrictedIndicator(symbolID, symbolBounds, imageBounds);
        let rBounds: Rectangle2D = restrictedResult.rBounds;
        let rPath: Path = restrictedResult.rPath;
        let rPath2: Path = restrictedResult.rPath2;
        let rCircle: Ellipse = restrictedResult.rCircle;
        let rStrokeWidth: number = restrictedResult.rStrokeWidth;

        // Build No Strike Indicator
        let noStrikeResult = buildNoStrikeIndicator(symbolID, symbolBounds, imageBounds);
        let nsBounds: Rectangle2D = noStrikeResult.nsBounds;
        let nsCircle: Ellipse = noStrikeResult.nsCircle;
        let nsLine: Line = noStrikeResult.nsLine;
        let nsStrokeWidth: number = noStrikeResult.nsStrokeWidth;

        // Assemble final SVG by delegating to DisplayModifierComposer
        newsdi = assembleSVG(
            sdi, symbolID, centerPoint, symbolBounds, imageBounds,
            lineColor, fillColor, textColor, textBackgroundColor,
            strokeWidth, strokeWidthNL, alpha, ad, pixelSize,
            // HQ Staff
            hqBounds, pt1HQ, pt2HQ,
            // Engagement Bar
            ebBounds, ebRectangle, ebColor, stiAO,
            // Affiliation Modifier
            stiAM, amBounds,
            // Echelon
            stiEchelon, echelonBounds,
            // Task Force
            tfBounds, tfRectangle,
            // FDI
            fdiBounds, fdiTop, fdiLeft, fdiRight,
            // Leadership Indicator
            liBounds, liPath,
            // OCI
            ociBounds, ociShape, ociSlashShape,
            // Mobility
            mobilityBounds, mobilityPath,
            // DOM Arrow
            domBounds, domPoints,
            // Restricted Indicator
            rBounds, rPath, rPath2, rCircle, rStrokeWidth,
            // No Strike Indicator
            nsBounds, nsCircle, nsLine, nsStrokeWidth
        );

        if (newsdi != null) {
            return newsdi;
        }
        else {
            return null;
        }
    }

    /**
     * @deprecated no longer a thing in 2525D
     * TODO: remove
     */
    private static getYPositionForSCC(symbolID: string): number {
        let ec: number = SymbolID.getEntityCode(symbolID);
        let ss: number = SymbolID.getSymbolSet(symbolID);
        let hqtfd: number = SymbolID.getHQTFD(symbolID);
        let ad: number = SymbolID.getAmplifierDescriptor(symbolID);

        if (ss === SymbolID.SymbolSet_LandUnit) {
            if (ad === SymbolID.Echelon_Army ||
                ad === SymbolID.Echelon_Corps_MEF ||
                ad === SymbolID.Echelon_Division ||
                ad === SymbolID.Echelon_Brigade ||
                ad === SymbolID.Echelon_Battalion_Squadron ||
                ad === SymbolID.Echelon_Company_Battery_Troop ||
                ad === SymbolID.Echelon_Platoon_Detachment ||
                ad === SymbolID.Echelon_Section) {
                return 1;
            }
            else if (hqtfd === SymbolID.HQTFD_TaskForce ||
                hqtfd === SymbolID.HQTFD_FeintDummy ||
                hqtfd === SymbolID.HQTFD_FeintDummy_TaskForce ||
                hqtfd === SymbolID.HQTFD_FeintDummy_TaskForce_Headquarters) {
                return 1;
            }
        }

        return 0;
    }

    public static processSpeedLeader(
        sdi:SVGSymbolInfo,
        symbolID:string,
        modifiers:Map<string,string>,
        attributes:Map<string,string>
    ): SVGSymbolInfo {
        return processSpeedLeader(sdi, symbolID, modifiers, attributes);
    }

    public static processUnknownTextModifiers(
        sdi: SymbolDimensionInfo,
        symbolID: string,
        modifiers: Map<string, string>,
        attributes: Map<string, string>,
        frc: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D
    ): SymbolDimensionInfo {
        return processUnknownTextModifiers(sdi, symbolID, modifiers, attributes, frc);
    }

    public static processSPTextModifiers(
        sdi: SymbolDimensionInfo,
        symbolID: string,
        modifiers: Map<string, string>,
        attributes: Map<string, string>,
        frc: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D
    ): SymbolDimensionInfo {
        return processSPTextModifiers(sdi, symbolID, modifiers, attributes, frc);
    }

    public static ProcessTGSPWithSpecialModifierLayout(
        sdi: SymbolDimensionInfo,
        symbolID: string,
        modifiers: Map<string, string>,
        attributes: Map<string, string>,
        lineColor: Color,
        frc: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D
    ): SymbolDimensionInfo | null {
        return ProcessTGSPWithSpecialModifierLayout(sdi, symbolID, modifiers, attributes, lineColor, frc);
    }

    public static ProcessTGSPModifiers(
        sdi: SymbolDimensionInfo,
        symbolID: string,
        modifiers: Map<string, string>,
        attributes: Map<string, string>,
        lineColor: Color,
        frc: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D
    ): SymbolDimensionInfo {
        return ProcessTGSPModifiers(sdi, symbolID, modifiers, attributes, lineColor, frc);
    }

    public static renderText(
        g2d: OffscreenCanvasRenderingContext2D,
        tiArray: TextInfo[],
        textColor: Color,
        textBackgroundColor: Color
    ): void {
        renderText(g2d, tiArray, textColor, textBackgroundColor);
    }

    public static hasDisplayModifiers(symbolID: string, modifiers: Map<string, string>): boolean {
        let hasModifiers: boolean = false;
        let ss: number = SymbolID.getSymbolSet(symbolID);
        let status: number = SymbolID.getStatus(symbolID);
        let context: number = SymbolID.getContext(symbolID);

        if (ss === SymbolID.SymbolSet_ControlMeasure)//check control measure
        {
            if (SymbolUtilities.isCBRNEvent(symbolID) === true && modifiers != null && modifiers.has(Modifiers.Q_DIRECTION_OF_MOVEMENT)) {
                hasModifiers = true;
            }
            else {
                if (SymbolUtilities.hasFDI(symbolID)) {
                    hasModifiers = true;
                }
            }
        }
        else if (ss !== SymbolID.SymbolSet_Atmospheric &&
            ss !== SymbolID.SymbolSet_Oceanographic &&
            ss !== SymbolID.SymbolSet_MeteorologicalSpace) //checking units
        {
            if (context > 0) {
                //Exercise or Simulation
                hasModifiers = true;
            }

            //echelon or mobility,
            if (SymbolID.getAmplifierDescriptor(symbolID) > 0) {
                hasModifiers = true;
            }

            if(modifiers != null) {
                if (modifiers.has(Modifiers.AO_ENGAGEMENT_BAR) ||
                    modifiers.has(Modifiers.Q_DIRECTION_OF_MOVEMENT) ||
                        modifiers.has(Modifiers.AJ_SPEED_LEADER)) {
                    hasModifiers = true;
                }
            }

            //HQ/Taskforce
            if (SymbolID.getHQTFD(symbolID) > 0) {
                hasModifiers = true;
            }

            if (status > 1) {
                //Fully capable, damaged, destroyed
                hasModifiers = true;
            }
        }

        return hasModifiers;
    }

    public static hasTextModifiers(symbolID: string, modifiers: Map<string, string>): boolean {

        let ss: number = SymbolID.getSymbolSet(symbolID);
        let ec: number = SymbolID.getEntityCode(symbolID);
        if (ss === SymbolID.SymbolSet_Atmospheric) {
            switch (ec) {
                case 110102: //tropopause low
                case 110202: //tropopause high
                case 162200: //tropopause level ?
                case 162300: { //freezing level ?
                    return true;
                }

                default: {
                    return false;
                }
            }
        }
        else if (ss === SymbolID.SymbolSet_Oceanographic || ss === SymbolID.SymbolSet_MeteorologicalSpace) {
            return false;
        }
        else if (ss === SymbolID.SymbolSet_ControlMeasure) {
            let msi: MSInfo = msLookup.getMSLInfo(symbolID);

            if (msi.getModifiers().length > 0 && modifiers != null && modifiers.size > 0) {
                return true;
            }
            else {
                return false;
            }
        }
        else if (SymbolUtilities.getStandardIdentityModifier(symbolID) != null) {
            return true;
        }

        let cc: number = SymbolID.getCountryCode(symbolID);
        if (cc > 0 && gencLookup.get3CharCode(cc) !== "") {
            return true;
        }

        else {
            if (modifiers != null && modifiers.size > 0) {
                return true;
            }
        }

        return false;
    }
}
