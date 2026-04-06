// Graphics2D imports
import { Point2D } from "../../graphics/Point2D"
import { Rectangle2D } from "../../graphics/Rectangle2D"

// Renderer/Shapes imports
import { Line } from "../shapes/line";
import { Ellipse } from "../shapes/ellipse";
import { Path } from "../shapes/path";

// Renderer.Utilities imports
import { Color } from "../utilities/Color"
import { RectUtilities } from "../utilities/RectUtilities"
import { rendererSettings } from "../utilities/RendererSettings"
import { RendererUtilities } from "../utilities/RendererUtilities"
import { SVGSymbolInfo } from "../utilities/SVGSymbolInfo"
import { SymbolID } from "../utilities/SymbolID"
import { SymbolUtilities } from "../utilities/SymbolUtilities"
import { ShapeUtilities } from "../utilities/ShapeUtilities";
import { SVGTextInfo } from "../utilities/SVGTextInfo";
import { SVGLookup, svgLookup } from "../utilities/SVGLookup";
import { SVGInfo } from "../utilities/SVGInfo";
import { ShapeTypes } from "../shapes/types";

/**
 * Result interface for engagement bar building
 */
export interface EngagementBarResult {
    stiAO?: SVGTextInfo;
    ebRectangle?: Rectangle2D;
    ebBounds?: Rectangle2D;
    ebColor?: Color;
}

/**
 * Result interface for affiliation modifier building
 */
export interface AffiliationModifierResult {
    stiAM?: SVGTextInfo;
    amBounds?: Rectangle2D;
}

/**
 * Result interface for HQ staff building
 */
export interface HQStaffResult {
    pt1HQ?: Point2D;
    pt2HQ?: Point2D;
    hqBounds?: Rectangle2D;
}

/**
 * Result interface for restricted indicator building
 */
export interface RestrictedResult {
    rPath?: Path;
    rPath2?: Path;
    rCircle?: Ellipse;
    rBounds?: Rectangle2D;
    rStrokeWidth: number;
}

/**
 * Result interface for no strike indicator building
 */
export interface NoStrikeResult {
    nsCircle?: Ellipse;
    nsLine?: Line;
    nsBounds?: Rectangle2D;
    nsStrokeWidth: number;
}

/**
 * Builds the engagement bar (AO modifier)
 * @param symbolID The symbol ID
 * @param modifiers Map of modifiers
 * @param symbolBounds The symbol bounds
 * @param symbolCenter The symbol center point
 * @param fillColor The fill color
 * @param modifierFont The modifier font
 * @param frc The font render context
 * @param attributes The symbol attributes
 * @param imageBounds The image bounds (will be updated)
 * @param fdiBounds The FDI bounds (if present)
 * @param tfBounds The task force bounds (if present)
 * @param echelonBounds The echelon bounds (if present)
 * @returns The engagement bar result
 */
export function buildEngagementBar(
    symbolID: string,
    modifiers: Map<string, string>,
    symbolBounds: Rectangle2D,
    symbolCenter: Point2D,
    fillColor: Color,
    modifierFont: string,
    frc: any,
    attributes: Map<string, string>,
    imageBounds: Rectangle2D,
    fdiBounds?: Rectangle2D,
    tfBounds?: Rectangle2D,
    echelonBounds?: Rectangle2D
): EngagementBarResult {
    const result: EngagementBarResult = {};

    //A:BBB-CC
    let strAO: string | undefined;
    let ebRectangle: Rectangle2D | undefined;
    let ebBounds: Rectangle2D | undefined;
    let ebTextBounds: Rectangle2D | undefined;
    let stiAO: SVGTextInfo | undefined;
    let ebTop: number = 0;
    let ebLeft: number = 0;
    let ebWidth: number = 0;
    let ebHeight: number = 0;
    let ebColor: Color | null = null;

    if (attributes.has("EngagementBarColor")) {
        const colorStr = attributes.get("EngagementBarColor");
        if (colorStr !== undefined) {
            ebColor = RendererUtilities.getColorFromHexString(colorStr);
        }
    }
    if (ebColor ===  null) {
        ebColor = fillColor;
    }

    if (SymbolUtilities.hasModifier(symbolID, "AO") &&
        modifiers.has("AO")) {

        strAO = modifiers.get("AO");
    }

    if (strAO !== undefined)
    {
        stiAO = new SVGTextInfo(strAO, 0, 0, modifierFont, frc);

        ebTextBounds = stiAO.getTextBounds();
        ebHeight = ebTextBounds.getHeight() as number;

        let barOffset:number = Math.max(rendererSettings.getDeviceDPI()/32, 4);

        if (fdiBounds !== undefined)//set bar above FDI if present
        {
            ebTop = fdiBounds!.getY() as number - ebHeight - barOffset;
        }
        else if (tfBounds !== undefined)//set bar above TF if present
        {
            ebTop = tfBounds!.getY() as number - ebHeight - barOffset;
        }
        else if (echelonBounds !== undefined)//set bar above echelon if present
        {
            ebTop = echelonBounds!.getY() as number - ebHeight - barOffset;
        }
        else if((ModifierRenderer.isCOnTop(symbolID) && modifiers.has("C"))||
            SymbolID.getContext(symbolID) == SymbolID.StandardIdentity_Context_Exercise ||
            SymbolID.getContext(symbolID) == SymbolID.StandardIdentity_Context_Simulation)//OR frame in air/space
        {
            ebTop = symbolBounds.getY() as number - ebHeight * 2.4;
        }
        else if (SymbolID.getSymbolSet(symbolID) ===  SymbolID.SymbolSet_LandInstallation) {
            ebTop = symbolBounds.getY() as number - ebHeight - barOffset;
        }
        else//position above symbol
        {
            ebTop = symbolBounds.getY() as number - ebHeight - barOffset;
        }

        //if text wider than symbol, extend the bar.
        if (ebTextBounds.getWidth() + 4 > symbolBounds.getWidth()) {
            ebWidth = ebTextBounds.getWidth() as number + 4;
            ebLeft = symbolCenter.getX() as number - (ebWidth / 2);
        }
        else {
            ebLeft = symbolBounds.getX() as number + 1;// - 2;//leave room for outline
            ebWidth = symbolBounds.getWidth() as number - 2;// + 4;//leave room for outline
        }

        //set text location within the bar
        stiAO.setLocation(symbolCenter.getX() as number, (ebTop + ebHeight - stiAO.getDescent()));

        ebRectangle = new Rectangle2D(ebLeft, ebTop, ebWidth, ebHeight);
        ebBounds = RectUtilities.copyRect(ebRectangle);
        RectUtilities.grow(ebBounds, 1);

        imageBounds = imageBounds.createUnion(ebBounds);

        result.stiAO = stiAO;
        result.ebRectangle = ebRectangle;
        result.ebBounds = ebBounds;
        result.ebColor = ebColor;
    }

    return result;
}

/**
 * Builds the affiliation modifier
 * @param symbolID The symbol ID
 * @param symbolBounds The symbol bounds
 * @param echelonBounds The echelon bounds (if present)
 * @param imageBounds The image bounds (will be updated)
 * @param frc The font render context
 * @returns The affiliation modifier result
 */
export function buildAffiliationModifier(
    symbolID: string,
    symbolBounds: Rectangle2D,
    echelonBounds: Rectangle2D,
    imageBounds: Rectangle2D,
    frc: any
): AffiliationModifierResult {
    const result: AffiliationModifierResult = {};

    //Draw Echelon
    //not needed for 2525D because built into the SVG files.
    let affiliationModifier: string | undefined;

    if (rendererSettings.getDrawAffiliationModifierAsLabel() ===  false) {
        affiliationModifier = SymbolUtilities.getStandardIdentityModifier(symbolID);
    }
    if (affiliationModifier !== undefined) {

        let amOffset: number = 2;
        let outlineOffset: number = rendererSettings.getTextOutlineWidth();

        let stiAM = new SVGTextInfo(affiliationModifier, 0, 0, rendererSettings.getLabelFont().toString(), frc);
        let amBounds = stiAM.getTextBounds();

        let x: number = 0;
        let y: number = 0;

        if (echelonBounds != null
            && ((echelonBounds.getMinX() + echelonBounds.getWidth() > symbolBounds.getMinX() + symbolBounds.getWidth()))) {
            y = Math.round(symbolBounds.getMinY() - amOffset) as number;
            x = (echelonBounds.getMinX() + echelonBounds.getWidth() + amOffset) as number;
        }
        else {
            y = Math.round(symbolBounds.getMinY() - amOffset) as number;
            x = (Math.round(symbolBounds.getMinX() + symbolBounds.getWidth() + amOffset + rendererSettings.getTextOutlineWidth())) as number;
        }
        stiAM.setLocation(x, y);

        //adjust for outline.
        amBounds.grow(outlineOffset);
        ShapeUtilities.offset(amBounds, 0, -outlineOffset);
        stiAM.setLocation(x, y - outlineOffset);

        imageBounds = imageBounds.createUnion(amBounds);

        result.stiAM = stiAM;
        result.amBounds = amBounds;
    }

    return result;
}

/**
 * Builds the HQ staff indicator
 * @param symbolID The symbol ID
 * @param symbolBounds The symbol bounds
 * @param centerPoint The center point (will be updated if HQ)
 * @param imageBounds The image bounds (will be updated)
 * @returns The HQ staff result
 */
export function buildHQStaff(
    symbolID: string,
    symbolBounds: Rectangle2D,
    centerPoint: Point2D,
    imageBounds: Rectangle2D
): HQStaffResult {
    const result: HQStaffResult = {};

    //Draw HQ Staff
    if (SymbolUtilities.isHQ(symbolID)) {

        let affiliation: number = SymbolID.getAffiliation(symbolID);
        let context: number = SymbolID.getContext(symbolID);
        //get points for the HQ staff
        let pt1HQ: Point2D;
        let pt2HQ: Point2D;
        let hqBounds: Rectangle2D;

        if (SymbolUtilities.hasRectangleFrame(symbolID)) {
            pt1HQ = new Point2D(symbolBounds.getX() + 1,
                (symbolBounds.getY() + symbolBounds.getHeight()));
        }
        else {
            pt1HQ = new Point2D(symbolBounds.getX() as number + 1,
                (symbolBounds.getY() + (symbolBounds.getHeight() / 2)) as number);
        }
        pt2HQ = new Point2D(pt1HQ.getX(), (pt1HQ.getY() + symbolBounds.getHeight()));

        //create bounding rectangle for HQ staff.
        hqBounds = new Rectangle2D(pt1HQ.getX(), pt1HQ.getY(), 2, pt2HQ.getY() - pt1HQ.getY());
        //adjust the image bounds accordingly.
        imageBounds = imageBounds.createUnion(new Rectangle2D(pt1HQ.getX(), pt1HQ.getY(), pt2HQ.getX() - pt1HQ.getX(), pt2HQ.getY() - pt1HQ.getY()));
        //adjust symbol center
        centerPoint.setLocation(pt2HQ.getX(), pt2HQ.getY());

        result.pt1HQ = pt1HQ;
        result.pt2HQ = pt2HQ;
        result.hqBounds = hqBounds;
    }

    return result;
}

/**
 * Builds the restricted indicator
 * @param symbolID The symbol ID
 * @param symbolBounds The symbol bounds
 * @param imageBounds The image bounds (will be updated)
 * @returns The restricted indicator result
 */
export function buildRestrictedIndicator(
    symbolID: string,
    symbolBounds: Rectangle2D,
    imageBounds: Rectangle2D
): RestrictedResult {
    const result: RestrictedResult = { rStrokeWidth: 3 };

    if(SymbolID.getContext(symbolID) ===  SymbolID.StandardIdentity_Context_Restricted_Target_Reality)
    {
        // <path id="primary" d="M380,320l38,-67l40,67h-78m38,-11v-1m0,-10l0,-20" fill="yellow" stroke="black" stroke-linecap="round" stroke-linejoin="round" stroke-width="7" />
        let nsTx:number = 0;
        let nsTy:number = 0;
        let ratio:number = 1;
        const siResult = svgLookup.getSVGLInfo(SVGLookup.getFrameID(symbolID),SymbolID.getVersion(symbolID));
        if (siResult ===  null) {
            return result;
        }
        let si:SVGInfo = siResult;
        if(symbolBounds.getHeight() > symbolBounds.getWidth())
        {
            let sHeight:number = si.getBbox().getHeight();
            ratio = symbolBounds.getHeight() / sHeight;
        }
        else
        {
            let sWidth:number = si.getBbox().getWidth();
            ratio = symbolBounds.getHeight() / sWidth;
        }

        nsTx = (si.getBbox().getX() * ratio) * -1;
        nsTy = (si.getBbox().getY() * ratio) * -1;

        let radius:number = 36 * ratio;
        let x:number = 418 * ratio - radius;
        let y:number = 288 * ratio - radius;

        //<path d="m373,313l53,-97l57,97l-110,0" fill="yellow" id="triangle" stroke="black" stroke-linecap="round" stroke-linejoin="round" stroke-width="6"/>
        //<path d="m373,313L426,216L483,313L373,313" fill="yellow" id="triangle" stroke="black" stroke-linecap="round" stroke-linejoin="round" stroke-width="6"/>
        let rPath = new Path();//triangle
        rPath.moveTo(373 * ratio, 313 * ratio);
        rPath.lineTo(426 * ratio, 216 * ratio);
        rPath.lineTo(483 * ratio, 313 * ratio);
        rPath.lineTo(373 * ratio, 313 * ratio);

        //<path d="M426.5,276L426.5,244" fill="none" id="line" stroke="black" stroke-linecap="round" stroke-linejoin="round" stroke-width="10"/>
        let rPath2 = new Path();//line
        rPath2.moveTo(426.5 * ratio, 276 * ratio);
        rPath2.lineTo(426.5 * ratio, 248 * ratio);

        //<circle cx="426.5" cy="293" r="6" id="dot"/>
        let rCircle = new Ellipse(423.5 * ratio, 290 * ratio, 6 * ratio, 6 * ratio);

        //need to shift like we do the frame and main icons since it's based in that space
        rPath.shift(nsTx,nsTy);
        rPath2.shift(nsTx,nsTy);
        rCircle.shift(nsTx,nsTy);


        let bounds = rPath.getBounds().clone();//triangle bounds
        let rBounds = RectUtilities.toRectangle2D(bounds.getX(),bounds.getY(),bounds.getWidth(), bounds.getHeight());
        let rStrokeWidth = (2/66.666667) * (symbolBounds.getHeight() / SymbolUtilities.getUnitRatioHeight(symbolID));
        rBounds.grow(Math.ceil(rStrokeWidth/2));
        imageBounds = imageBounds.createUnion(rBounds);

        result.rPath = rPath;
        result.rPath2 = rPath2;
        result.rCircle = rCircle;
        result.rBounds = rBounds;
        result.rStrokeWidth = rStrokeWidth;
    }

    return result;
}

/**
 * Builds the no strike indicator
 * @param symbolID The symbol ID
 * @param symbolBounds The symbol bounds
 * @param imageBounds The image bounds (will be updated)
 * @returns The no strike indicator result
 */
export function buildNoStrikeIndicator(
    symbolID: string,
    symbolBounds: Rectangle2D,
    imageBounds: Rectangle2D
): NoStrikeResult {
    const result: NoStrikeResult = { nsStrokeWidth: 3 };

    if(SymbolID.getContext(symbolID) ===  SymbolID.StandardIdentity_Context_No_Strike_Entity_Reality)
    {
        //octagon~182.08058166503906~272.0794677734375~245.8407440185547~244.85235595703125
        //restricted~375.44801678047673~248.63298320770264~85.1039714496415~79.36734275822477
        //no-strike~378.0~248.0~80.0~80.0
        //<circle cx="418" cy="288" fill="yellow" r="36" stroke="black" stroke-width="8"/>
        //<line fill="none" stroke="black" stroke-linecap="round" stroke-linejoin="round" stroke-width="8" x1="390" x2="446" y1="265" y2="310"/>
        //nsCircle = new Ellipse(x,y,radius * 2, radius * 2);
        //nsLine = new Line(390 * ratio, 265 * ratio, 446 * ratio, 310 * ratio);
        let nsTx:number = 0;
        let nsTy:number = 0;
        let ratio:number = 1;
        const siResult = svgLookup.getSVGLInfo(SVGLookup.getFrameID(symbolID),SymbolID.getVersion(symbolID));
        if (siResult ===  null) {
            return result;
        }
        let si:SVGInfo = siResult;
        if(symbolBounds.getHeight() > symbolBounds.getWidth())
        {
            let sHeight:number = si.getBbox().getHeight();
            ratio = symbolBounds.getHeight() / sHeight;
        }
        else
        {
            let sWidth:number = si.getBbox().getWidth();
            ratio = symbolBounds.getWidth() / sWidth;
        }

        nsTx = (si.getBbox().getX() * ratio) * -1;
        nsTy = (si.getBbox().getY() * ratio) * -1;

        let radius:number = 50 * ratio;
        let x:number = 426 * ratio - radius;
        let y:number = 267 * ratio - radius;
        let nsCircle = new Ellipse(x,y,radius * 2, radius * 2);
        let nsLine = new Line(390 * ratio, 235 * ratio, 463 * ratio, 298 * ratio);

        //need to shift like we do the frame and main icons since it's based in that space
        nsCircle.shift(nsTx,nsTy);
        nsLine.shift(nsTx,nsTy);

        let bounds = nsCircle.getBounds().clone();
        bounds.union(nsLine.getBounds());
        let nsBounds = RectUtilities.toRectangle2D(bounds.getX(),bounds.getY(),bounds.getWidth(), bounds.getHeight());
        let nsStrokeWidth = (2/66.666667) * (symbolBounds.getHeight() / SymbolUtilities.getUnitRatioHeight(symbolID));
        nsBounds.grow(Math.ceil(nsStrokeWidth/2));
        imageBounds = imageBounds.createUnion(nsBounds);

        result.nsCircle = nsCircle;
        result.nsLine = nsLine;
        result.nsBounds = nsBounds;
        result.nsStrokeWidth = nsStrokeWidth;
    }

    return result;
}

/**
 * Assembles all display modifiers into SVG format
 * @param sdi The source symbol display info
 * @param centerPoint The center point
 * @param symbolBounds The symbol bounds
 * @param imageBounds The image bounds
 * @param lineColor The line color
 * @param fillColor The fill color
 * @param textColor The text color
 * @param textBackgroundColor The text background color
 * @param strokeWidth The stroke width
 * @param strokeWidthNL The stroke width for non-linear
 * @param alpha The alpha transparency
 * @param ad The angle descriptor
 * @param pixelSize The pixel size
 * @param hqBounds The HQ bounds result
 * @param pt1HQ The first HQ point
 * @param pt2HQ The second HQ point
 * @param ebBounds The engagement bar bounds
 * @param ebRectangle The engagement bar rectangle
 * @param ebColor The engagement bar color
 * @param stiAO The engagement bar text info
 * @param stiAM The affiliation modifier text info
 * @param amBounds The affiliation modifier bounds
 * @param stiEchelon The echelon text info
 * @param echelonBounds The echelon bounds
 * @param tfBounds The task force bounds
 * @param tfRectangle The task force rectangle
 * @param fdiBounds The FDI bounds
 * @param fdiTop The FDI top point
 * @param fdiLeft The FDI left point
 * @param fdiRight The FDI right point
 * @param liBounds The leadership indicator bounds
 * @param liPath The leadership indicator path
 * @param ociBounds The OCI bounds
 * @param ociShape The OCI shape
 * @param ociSlashShape The OCI slash shape
 * @param mobilityBounds The mobility bounds
 * @param mobilityPath The mobility path
 * @param domBounds The DOM arrow bounds
 * @param domPoints The DOM arrow points
 * @param rBounds The restricted indicator bounds
 * @param rPath The restricted path
 * @param rPath2 The restricted path 2
 * @param rCircle The restricted circle
 * @param rStrokeWidth The restricted stroke width
 * @param nsBounds The no strike bounds
 * @param nsCircle The no strike circle
 * @param nsLine The no strike line
 * @param nsStrokeWidth The no strike stroke width
 * @returns The SVG symbol info
 */
export function assembleSVG(
    sdi: any,
    symbolID: string,
    centerPoint: Point2D,
    symbolBounds: Rectangle2D,
    imageBounds: Rectangle2D,
    lineColor: Color,
    fillColor: Color,
    textColor: Color,
    textBackgroundColor: Color,
    strokeWidth: number,
    strokeWidthNL: number,
    alpha: number,
    ad: number,
    pixelSize: number,
    // HQ Staff params
    hqBounds?: Rectangle2D,
    pt1HQ?: Point2D,
    pt2HQ?: Point2D,
    // Engagement Bar params
    ebBounds?: Rectangle2D,
    ebRectangle?: Rectangle2D,
    ebColor?: Color,
    stiAO?: SVGTextInfo,
    // Affiliation Modifier params
    stiAM?: SVGTextInfo,
    amBounds?: Rectangle2D,
    // Echelon params
    stiEchelon?: SVGTextInfo,
    echelonBounds?: Rectangle2D,
    // Task Force params
    tfBounds?: Rectangle2D,
    tfRectangle?: Rectangle2D,
    // FDI params
    fdiBounds?: Rectangle2D,
    fdiTop?: Point2D,
    fdiLeft?: Point2D,
    fdiRight?: Point2D,
    // Leadership Indicator params
    liBounds?: Rectangle2D,
    liPath?: Path,
    // OCI params
    ociBounds?: Rectangle2D,
    ociShape?: Rectangle2D,
    ociSlashShape?: Path,
    // Mobility params
    mobilityBounds?: Rectangle2D,
    mobilityPath?: any[],
    // DOM Arrow params
    domBounds?: Rectangle2D,
    domPoints?: Point2D[],
    // Restricted Indicator params
    rBounds?: Rectangle2D,
    rPath?: Path,
    rPath2?: Path,
    rCircle?: Ellipse,
    rStrokeWidth?: number,
    // No Strike Indicator params
    nsBounds?: Rectangle2D,
    nsCircle?: Ellipse,
    nsLine?: Line,
    nsStrokeWidth?: number
): SVGSymbolInfo {
    let newsdi: SVGSymbolInfo | undefined;

    if (sdi instanceof SVGSymbolInfo) {
        let sbSVG:string = "";
        let temp: any;
        let svgStroke: string = RendererUtilities.colorToHexString(lineColor, false);
        let svgFill: string = RendererUtilities.colorToHexString(fillColor, false);
        let svgTextColor: string = RendererUtilities.colorToHexString(textColor, false);
        let svgTextBGColor: string = RendererUtilities.colorToHexString(textBackgroundColor, false);
        let svgStrokeWidth: number = strokeWidth;
        let svgTextOutlineWidth: number = rendererSettings.getTextOutlineWidth();
        let svgAlpha: string;
        if (alpha >= 0 && alpha <= 1) {
            svgAlpha = alpha.toString();
        }

        let svgDashArray: string;

        // All guards use != null (loose equality) to catch both null AND undefined,
        // since result objects from builders use optional properties (undefined when unset)
        // while some variables are initialized to null in ModifierRenderer.
        if (hqBounds != null && pt1HQ != null && pt2HQ != null) {
            let hqStaff: Line = new Line(pt1HQ.getX(), pt1HQ.getY(), pt2HQ.getX(), pt2HQ.getY());
            sbSVG += (hqStaff.toSVGElement(svgStroke, strokeWidth, null));
        }
        if (echelonBounds != null && stiEchelon != null) {
            sbSVG += (stiEchelon.toSVGElement(svgTextColor, svgTextBGColor, svgTextOutlineWidth));
        }
        if (amBounds != null && stiAM != null) {
            sbSVG += (stiAM.toSVGElement(svgTextColor, svgTextBGColor, svgTextOutlineWidth));
        }
        if (tfBounds != null && tfRectangle != null) {
            sbSVG += (tfRectangle.toSVGElement(svgStroke, svgStrokeWidth, null));
        }
        if (ebBounds != null && ebRectangle != null && ebColor != null && stiAO != null) {
            let svgEBFill: string = RendererUtilities.colorToHexString(ebColor, false);
            //create fill and outline
            sbSVG += (ebRectangle.toSVGElement(svgStroke, svgStrokeWidth, svgEBFill));
            //create internal text
            sbSVG += (stiAO.toSVGElement("#000000", null,0,"middle"));
        }
        if (fdiBounds != null && fdiTop != null && fdiLeft != null && fdiRight != null) {
            let svgFDIDashArray: string = "6 4";
            let dashArray: number[] = [6, 4];

            if (symbolBounds.getHeight() < 20) {
                svgFDIDashArray = "5 3";
            }

            /// ///////////////////////////////////
            //Divide line in 14 parts. line is 3 parts to 2 parts gap
            let distance: number = RendererUtilities.getDistanceBetweenPoints(fdiTop!,fdiLeft!);
            //distance = distance / 14f;
            dashArray[1] = ((distance / 14) * 2);
            dashArray[0] = ((distance / 14) * 3);//*/
            svgFDIDashArray = "" + dashArray[0] + " " + dashArray[1];
            /// //////////////////////////////////

            let fdiPath: Path = new Path();
            fdiPath.moveTo(fdiTop!.getX(), fdiTop!.getY());
            fdiPath.lineTo(fdiLeft!.getX(), fdiLeft!.getY());
            fdiPath.moveTo(fdiTop!.getX(), fdiTop!.getY());
            fdiPath.lineTo(fdiRight!.getX(), fdiRight!.getY());//*/

            fdiPath.setLineDash(svgFDIDashArray);

            sbSVG += (fdiPath.toSVGElement(svgStroke, svgStrokeWidth, null));

        }
        if (liBounds != null && liPath != null) {
            let liStrokeWidth: number = 2;
            if (pixelSize < 100) {
                liStrokeWidth = 1;
            }

            sbSVG += (liPath!.toSVGElement(svgStroke, liStrokeWidth, null));
        }
        // OCI bar: use != null to correctly skip when values are null (not just undefined)
        if (ociShape != null) {

            let status: number = SymbolID.getStatus(symbolID);
            let statusColor: Color = Color.gray;

            switch (status) {
                //Fully Capable
                case SymbolID.Status_Present_FullyCapable: {
                    statusColor = Color.green;
                    break;
                }

                //Damaged
                case SymbolID.Status_Present_Damaged: {
                    statusColor = Color.yellow;
                    break;
                }

                //Destroyed
                case SymbolID.Status_Present_Destroyed: {
                    statusColor = Color.red;
                    break;
                }

                //full to capacity(hospital)
                case SymbolID.Status_Present_FullToCapacity: {
                    statusColor = Color.blue;
                    break;
                }

                default: {
                    break;
                }

            }

            let svgOCIStatusColor: string = RendererUtilities.colorToHexString(statusColor, false);
            sbSVG += (ociBounds!.toSVGElement(svgStroke, 0, svgStroke));
            sbSVG += (ociShape!.toSVGElement(svgStroke, 0, svgOCIStatusColor));

            ociShape = undefined;

        }
        if (mobilityBounds != null && mobilityPath != null) {

            let svgMobilitySW: number = svgStrokeWidth;
            if (!(ad > 30 && ad < 60))//mobility
            {
                svgMobilitySW = strokeWidthNL;
            }

            for (let i = 0; i < mobilityPath.length; i++) {
                if (mobilityPath[i].getShapeType() !== ShapeTypes.RECTANGLE) {
                    sbSVG += (mobilityPath[i].toSVGElement(svgStroke, svgMobilitySW, "none"));
                }
                else {
                    sbSVG += (mobilityPath[i].toSVGElement("none", 0, svgStroke));
                }
            }
        }

        //add symbol
        let ssi = sdi as SVGSymbolInfo;
        sbSVG += (ssi.getSVG());

        // OCI slash/X: Damaged = "/" slash, Destroyed = "X" cross
        // Use != null to correctly handle null initial values from ModifierRenderer
        if (ociSlashShape != null) {
            let size: number = symbolBounds.getWidth();
            let ociStrokeWidth: number = 3;

            ociStrokeWidth = size as number / 20;
            if (ociStrokeWidth < 1) {
                ociStrokeWidth = 1;
            }

            sbSVG += (ociSlashShape!.toSVGElement(svgStroke, ociStrokeWidth, null));

            ociSlashShape = undefined;
        }

        if (domBounds != null && domPoints != null) {
            let domPath: Path = new Path();

            domPath.moveTo(domPoints[0].getX(), domPoints[0].getY());
            if (domPoints[1] != null) {
                domPath.lineTo(domPoints[1].getX(), domPoints[1].getY());
            }
            if (domPoints[2] != null) {
                domPath.lineTo(domPoints[2].getX(), domPoints[2].getY());
            }

            sbSVG += (domPath.toSVGElement(svgStroke, svgStrokeWidth, null));

            domPath = new Path();

            domPath.moveTo(domPoints[3].getX(), domPoints[3].getY());
            domPath.lineTo(domPoints[4].getX(), domPoints[4].getY());
            domPath.lineTo(domPoints[5].getX(), domPoints[5].getY());
            sbSVG += (domPath.toSVGElement("none", 0, svgStroke));
        }

        if (rBounds != null && rPath != null && rPath2 != null && rCircle != null)
        {
            let restrictedGroup = "<g id=\"restricted\" stroke-linecap=\"round\" stroke-linejoin=\"round\">";
            //triangle
            restrictedGroup += rPath.toSVGElement("black",rStrokeWidth!,"yellow");
            //exclamation
            restrictedGroup += rPath2.toSVGElement("black",rStrokeWidth! * 1.66667,"none");
            //dot
            restrictedGroup += rCircle.toSVGElement("black",rStrokeWidth!,"black");
            restrictedGroup += "</g>";

            sbSVG += restrictedGroup;
        }

        if (nsBounds != null && nsCircle != null && nsLine != null)
        {
            let noStrikeGroup = "<g id=\"nostrike\">";
            noStrikeGroup += nsCircle.toSVGElement("black",nsStrokeWidth!,"yellow");
            noStrikeGroup += nsLine.toSVGElement("black",nsStrokeWidth!,null);
            noStrikeGroup += "</g>";
            sbSVG += noStrikeGroup;
        }

        newsdi = new SVGSymbolInfo(sbSVG.toString().valueOf(), new Point2D(centerPoint.x, centerPoint.y), symbolBounds, imageBounds);
    }

    return newsdi!;
}

// Placeholder for ModifierRenderer static methods needed by this module
// These will be imported from ModifierRenderer when used in actual code
class ModifierRenderer {
    private static RS: any = null;
    static isCOnTop(symbolID: string): boolean {
        // This should be imported from ModifierRenderer
        return false;
    }
}
