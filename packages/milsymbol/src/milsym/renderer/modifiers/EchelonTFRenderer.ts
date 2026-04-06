// Graphics2D
import { Font } from "../../graphics/Font"
import { Point2D } from "../../graphics/Point2D"
import { Rectangle2D } from "../../graphics/Rectangle2D"

// Renderer/Shapes
import { Path } from "../shapes/path";

// Renderer.Utilities
import { Modifiers } from "../utilities/Modifiers"
import { RectUtilities } from "../utilities/RectUtilities"
import { rendererSettings } from "../utilities/RendererSettings"
import { SymbolID } from "../utilities/SymbolID"
import { SymbolUtilities } from "../utilities/SymbolUtilities"
import { SVGTextInfo } from "../utilities/SVGTextInfo";

/**
 * Result interface for echelon, task force, and feint dummy indicator building
 */
export interface EchelonTFResult {
    liPath?: Path;
    liBounds?: Rectangle2D;
    liTop?: Point2D;
    liLeft?: Point2D;
    liRight?: Point2D;
    stiEchelon?: SVGTextInfo;
    echelonBounds?: Rectangle2D;
    tfRectangle?: Rectangle2D;
    tfBounds?: Rectangle2D;
    fdiTop?: Point2D;
    fdiLeft?: Point2D;
    fdiRight?: Point2D;
    fdiBounds?: Rectangle2D;
}

/**
 * Builds echelon, task force, and feint dummy indicator modifiers for a symbol.
 * Extracts logic from ModifierRenderer.processUnitDisplayModifiers (lines 472-676).
 *
 * @param symbolID The symbol ID string
 * @param symbolBounds The bounding rectangle of the symbol
 * @param imageBounds The current image bounds (will be updated with new bounds)
 * @param frc The rendering context
 * @param pixelSize The pixel size
 * @returns Object containing the result data and updated imageBounds
 */
export function buildEchelonTFModifiers(
    symbolID: string,
    symbolBounds: Rectangle2D,
    imageBounds: Rectangle2D,
    frc: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    pixelSize: number
): { result: EchelonTFResult, imageBounds: Rectangle2D } {
    const result: EchelonTFResult = {};
    let currentImageBounds = imageBounds;

    // <editor-fold defaultstate="collapsed" desc="Leadership Indicator Modifier">
    let liBounds: Rectangle2D;
    let liPath: Path;
    let liTop: Point2D;
    let liLeft: Point2D;
    let liRight: Point2D;
    if (SymbolID.getAmplifierDescriptor(symbolID) ===  SymbolID.Leadership_Individual &&
        SymbolID.getSymbolSet(symbolID) ===  SymbolID.SymbolSet_DismountedIndividuals &&
        (SymbolID.getFrameShape(symbolID) ===  SymbolID.FrameShape_DismountedIndividuals ||
            SymbolID.getFrameShape(symbolID) ===  SymbolID.FrameShape_Unknown)) {
        liPath = new Path();

        let si: number = SymbolID.getStandardIdentity(symbolID);
        let af: number = SymbolID.getAffiliation(symbolID);
        let c: number = SymbolID.getContext(symbolID);
        let centerOffset: number = 0;
        let sideOffset: number = 0;
        let left: number = symbolBounds.getX();
        let right: number = symbolBounds.getX() + symbolBounds.getWidth();

        if (af ===  SymbolID.StandardIdentity_Affiliation_Unknown || af ===  SymbolID.StandardIdentity_Affiliation_Pending) {
            centerOffset = (symbolBounds.getHeight() * 0.1012528735632184);
            sideOffset = (right - left) * 0.3583513488109785;
        }
        if (af ===  SymbolID.StandardIdentity_Affiliation_Neutral) {
            centerOffset = (symbolBounds.getHeight() * 0.25378787878787878);
            sideOffset = (right - left) * 0.2051402812352822;
        }
        if (SymbolUtilities.isReality(symbolID) || SymbolUtilities.isSimulation(symbolID)) {
            if (af ===  SymbolID.StandardIdentity_Affiliation_Friend || af ===  SymbolID.StandardIdentity_Affiliation_AssumedFriend) {
                centerOffset = (symbolBounds.getHeight() * 0.08);
                sideOffset = (right - left) * 0.282714524168219;
            }
            else {
                if (af ===  SymbolID.StandardIdentity_Affiliation_Hostile_Faker || af ===  SymbolID.StandardIdentity_Affiliation_Suspect_Joker) {
                    left = symbolBounds.getCenterX() - ((symbolBounds.getWidth() / 2) * 1.0653694149);
                    right = symbolBounds.getCenterX() + ((symbolBounds.getWidth() / 2) * 1.0653694149);

                    centerOffset = (symbolBounds.getHeight() * 0.08);
                    sideOffset = (right - left) * 0.4923255424955992;
                }
            }

        }
        else {
            if (af !== SymbolID.StandardIdentity_Affiliation_Unknown ||
                af ===  SymbolID.StandardIdentity_Affiliation_Neutral) {
                centerOffset = (symbolBounds.getHeight() * 0.08);
                sideOffset = (right - left) * 0.282714524168219;
            }
        }

        // create leadership indicator /\
        liTop = new Point2D(symbolBounds.getCenterX(), symbolBounds.getY() - centerOffset);
        liLeft = new Point2D(left, liTop.getY() + sideOffset);
        liRight = new Point2D(right, liTop.getY() + sideOffset);

        liPath.moveTo(liTop.getX(), liTop.getY());
        liPath.lineTo(liLeft.getX(), liLeft.getY());
        liPath.moveTo(liTop.getX(), liTop.getY());
        liPath.lineTo(liRight.getX(), liRight.getY());

        liBounds = liPath.getBounds().toRectangle2D();
        liBounds = new Rectangle2D(liLeft.getX(), liTop.getY(), liRight.getX() - liLeft.getX(), liLeft.getY() - liTop.getY());

        RectUtilities.grow(liBounds, 2);

        currentImageBounds = currentImageBounds.createUnion(liBounds);

        result.liPath = liPath;
        result.liBounds = liBounds;
        result.liTop = liTop;
        result.liLeft = liLeft;
        result.liRight = liRight;
    }
    // </editor-fold>

    // <editor-fold defaultstate="collapsed" desc="Build Echelon">
    let stiEchelon: SVGTextInfo | null = null;
    let echelonBounds: Rectangle2D | null = null;
    let intEchelon: number = SymbolID.getAmplifierDescriptor(symbolID);
    let strEchelon: string | null = null;
    if (intEchelon > 10 && intEchelon < 29 && SymbolUtilities.hasModifier(symbolID, Modifiers.B_ECHELON)) {
        strEchelon = SymbolUtilities.getEchelonText(intEchelon);
    }
    if (strEchelon !==  null && SymbolUtilities.hasModifier(symbolID, Modifiers.B_ECHELON)) {

        let echelonOffset: number = 2;
        let outlineOffset: number = rendererSettings.getTextOutlineWidth();
        let modifierFont: Font = rendererSettings.getLabelFont();
        stiEchelon = new SVGTextInfo(strEchelon, 0, 0, modifierFont.toString(), frc);
        echelonBounds = stiEchelon.getTextBounds();

        let y: number = Math.round(symbolBounds.getY() - echelonOffset) as number;
        let x: number = (Math.round(symbolBounds.getX()) + (symbolBounds.getWidth() / 2) - (echelonBounds.getWidth() / 2)) as number;
        stiEchelon.setLocation(x, y);

        // make echelon bounds a little more spacious for things like nearby labels and Task Force.
        echelonBounds.grow(outlineOffset);

        stiEchelon.setLocation(x, y - outlineOffset);

        currentImageBounds = currentImageBounds.createUnion(echelonBounds);

        result.stiEchelon = stiEchelon;
        result.echelonBounds = echelonBounds;
    }
    // </editor-fold>

    // <editor-fold defaultstate="collapsed" desc="Build Task Force">
    let tfBounds: Rectangle2D;
    let tfRectangle: Rectangle2D;
    let hqtfd: number = SymbolID.getHQTFD(symbolID);
    if (SymbolUtilities.isTaskForce(symbolID) && SymbolUtilities.hasModifier(symbolID, Modifiers.D_TASK_FORCE_INDICATOR)) {
        let height: number = Math.round(symbolBounds.getHeight() / 4) as number;
        let width: number = Math.round(symbolBounds.getWidth() / 3) as number;

        if (!SymbolUtilities.hasRectangleFrame(symbolID)) {
            height = Math.round(symbolBounds.getHeight() / 6) as number;
        }

        tfRectangle = new Rectangle2D((symbolBounds.getX() + width) as number,
            (symbolBounds.getY() - height) as number,
            width,
            height);

        tfBounds = new Rectangle2D((tfRectangle.getX() - 1) as number,
            (tfRectangle.getY() - 1) as number,
            (tfRectangle.getWidth() + 2) as number,
            (tfRectangle.getHeight() + 2) as number);

        if (echelonBounds !==  null && stiEchelon !==  null) {
            let tfx: number = tfRectangle.getX();
            let tfw: number = tfRectangle.getWidth();
            let tfy: number = tfRectangle.getY();
            let tfh: number = tfRectangle.getHeight();

            if (echelonBounds.getWidth() > tfRectangle.getWidth()) {
                tfx = symbolBounds.getX() + symbolBounds.getWidth() / 2 - (echelonBounds.getWidth() / 2) - 1;
                tfw = echelonBounds.getWidth() + 2;
            }
            if (echelonBounds.getHeight() > tfRectangle.getHeight()) {
                tfy = echelonBounds.getY() - 1;
                tfh = echelonBounds.getHeight() + 2;
            }
            tfRectangle = new Rectangle2D(tfx,
                tfy,
                tfw,
                tfh);

            tfBounds = new Rectangle2D((tfRectangle.getX() - 1) as number,
                (tfRectangle.getY() - 1) as number,
                (tfRectangle.getWidth() + 2) as number,
                (tfRectangle.getHeight() + 2) as number);
        }
        currentImageBounds = currentImageBounds.createUnion(tfBounds);

        result.tfRectangle = tfRectangle;
        result.tfBounds = tfBounds;
    }
    // </editor-fold>

    // <editor-fold defaultstate="collapsed" desc="Build Feint Dummy Indicator">
    let fdiBounds: Rectangle2D;
    let fdiTop: Point2D;
    let fdiLeft: Point2D;
    let fdiRight: Point2D;

    if (SymbolUtilities.hasFDI(symbolID)
        && SymbolUtilities.hasModifier(symbolID, Modifiers.AB_FEINT_DUMMY_INDICATOR)) {
        // create feint indicator /\
        fdiLeft = new Point2D(symbolBounds.getX(), symbolBounds.getY());
        fdiRight = new Point2D((symbolBounds.getX() + symbolBounds.getWidth()), symbolBounds.getY());
        fdiTop = new Point2D(Math.round(symbolBounds.getCenterX()), Math.round(symbolBounds.getY() - (symbolBounds.getWidth() * .5)));

        fdiBounds = new Rectangle2D(fdiLeft.getX(), fdiTop.getY(), fdiRight.getX() - fdiLeft.getX(), fdiLeft.getY() - fdiTop.getY());

        if (echelonBounds !==  null && stiEchelon !==  null) {
            let shiftY: number = Math.round(symbolBounds.getY() - echelonBounds.getHeight() - 2) as number;
            fdiLeft.setLocation(fdiLeft.getX(), fdiLeft.getY() + shiftY);
            fdiTop.setLocation(fdiTop.getX(), fdiTop.getY() + shiftY);
            fdiRight.setLocation(fdiRight.getX(), fdiRight.getY() + shiftY);
            fdiBounds = new Rectangle2D(fdiLeft.getX(), fdiTop.getY(), fdiRight.getX() - fdiLeft.getX(), fdiLeft.getY() - fdiTop.getY());
        }

        currentImageBounds = currentImageBounds.createUnion(fdiBounds);

        result.fdiTop = fdiTop;
        result.fdiLeft = fdiLeft;
        result.fdiRight = fdiRight;
        result.fdiBounds = fdiBounds;
    }
    // </editor-fold>

    return { result, imageBounds: currentImageBounds };
}
