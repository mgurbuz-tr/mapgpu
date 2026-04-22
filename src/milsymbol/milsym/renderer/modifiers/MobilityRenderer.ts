//Graphics2D
import { Rectangle2D } from "../../graphics/Rectangle2D"

//Renderer/Shapes
import { Rectangle } from "../shapes/rectangle";
import { Line } from "../shapes/line";
import { Ellipse } from "../shapes/ellipse";
import { RoundedRectangle } from "../shapes/roundedrectangle";
import { Path } from "../shapes/path";

//Renderer.Utilities
import { Modifiers } from "../utilities/Modifiers"
import { SymbolID } from "../utilities/SymbolID"
import { SymbolUtilities } from "../utilities/SymbolUtilities"
import { ShapeTypes } from "../shapes/types";

/**
 * Builds mobility modifier shapes based on symbol ID and bounds
 * @param symbolID The symbol ID
 * @param symbolBounds The bounding rectangle of the symbol
 * @param ad The amplifier descriptor (echelon/mobility)
 * @param strokeWidth The stroke width for rendering
 * @returns Object containing mobilityPath, mobilityPathFill, mobilityBounds, and strokeWidthNL
 */
export function buildMobilityModifiers(
    symbolID: string,
    symbolBounds: Rectangle2D,
    ad: number,
    strokeWidth: number
): { mobilityPath: Array<any>, mobilityPathFill: Array<any>, mobilityBounds: Rectangle | null, strokeWidthNL: number } {

    let mobilityBounds: Rectangle | null = null;
    let offsetY: number = 0;
    let strokeWidthNL: number = 3.0;

    //let mobilityPath: Path2D;
    //let mobilityPathFill: Path2D;

    let mobilityPath: Array<any> = new Array<any>();
    let mobilityPathFill: Array<any> = new Array<any>();

    if (ad >= SymbolID.Mobility_WheeledLimitedCrossCountry &&
        (SymbolUtilities.hasModifier(symbolID, Modifiers.R_MOBILITY_INDICATOR) ||
            SymbolUtilities.hasModifier(symbolID, Modifiers.AG_AUX_EQUIP_INDICATOR))) {

        //Draw Mobility
        let fifth: number = ((symbolBounds.getWidth() * 0.2) + 0.5) as number;
        let x: number = 0;
        let y: number = 0;
        let centerX: number = 0;
        let bottomY: number = 0;
        let height: number = 0;
        let width: number = 0;
        let middleY: number = 0;
        let wheelOffset: number = 2;
        let wheelSize: number = fifth;//10;
        let rrHeight: number = fifth;//10;
        let rrArcWidth: number = ((fifth * 1.5) + 0.5) as number;//16;


        x = symbolBounds.getX() as number + 1;
        y = symbolBounds.getY() as number;
        height = (symbolBounds.getHeight()) as number;
        width = Math.round(symbolBounds.getWidth()) as number - 3;
        bottomY = y + height + 3;

        let shapes: Array<any> = new Array();


        if (ad >= SymbolID.Mobility_WheeledLimitedCrossCountry && ad < SymbolID.Mobility_ShortTowedArray &&//31, mobility starts above 30
            SymbolUtilities.canSymbolHaveModifier(symbolID, Modifiers.R_MOBILITY_INDICATOR)) {

            //wheelSize = width / 7;
            //rrHeight = width / 7;
            //rrArcWidth = width / 7;
            if (ad ===  SymbolID.Mobility_WheeledLimitedCrossCountry)//MO
            {
                //line
                mobilityPath.push(new Line(x, bottomY, x + width, bottomY));
                //left circle
                mobilityPath.push(new Ellipse(x, bottomY + wheelOffset, wheelSize, wheelSize));
                //right circle
                mobilityPath.push(new Ellipse(x + width - wheelSize, bottomY + wheelOffset, wheelSize, wheelSize));
            }
            else if (ad ===  SymbolID.Mobility_WheeledCrossCountry)//MP
            {
                //line
                mobilityPath.push(new Line(x, bottomY, x + width, bottomY));
                //left circle
                mobilityPath.push(new Ellipse(x, bottomY + wheelOffset, wheelSize, wheelSize));
                //right circle
                mobilityPath.push(new Ellipse(x + width - wheelSize, bottomY + wheelOffset, wheelSize, wheelSize));
                //center wheel
                mobilityPath.push(new Ellipse(x + (width / 2) - (wheelSize / 2), bottomY + wheelOffset, wheelSize, wheelSize));
            }
            else if (ad ===  SymbolID.Mobility_Tracked)//MQ
            {
                //round rectangle
                mobilityPath.push(new RoundedRectangle(x, bottomY, width, rrHeight, (rrHeight/3) * 2));

            }
            else if (ad ===  SymbolID.Mobility_Wheeled_Tracked)//MR
            {
                //round rectangle
                mobilityPath.push(new RoundedRectangle(x, bottomY, width, rrHeight, (rrHeight/3) * 2));
                //left circle
                mobilityPath.push(new Ellipse(x - wheelSize - (wheelSize/3), bottomY, wheelSize, wheelSize));
            }
            else if (ad ===  SymbolID.Mobility_Towed)//MS
            {
                //line
                mobilityPath.push(new Line(x + wheelSize, bottomY + (wheelSize / 2), x + width - wheelSize, bottomY + (wheelSize / 2)));
                //left circle
                mobilityPath.push(new Ellipse(x, bottomY, wheelSize, wheelSize));
                //right circle
                mobilityPath.push(new Ellipse(x + width - wheelSize, bottomY, wheelSize, wheelSize));
            }
            else if (ad ===  SymbolID.Mobility_Rail)//MT
            {
                //line
                mobilityPath.push(new Line(x, bottomY, x + width, bottomY));
                //left circle
                mobilityPath.push(new Ellipse(x + wheelSize, bottomY + wheelOffset, wheelSize, wheelSize));
                //left circle2
                mobilityPath.push(new Ellipse(x, bottomY + wheelOffset, wheelSize, wheelSize));
                //right circle
                mobilityPath.push(new Ellipse(x + width - wheelSize, bottomY + wheelOffset, wheelSize, wheelSize));
                //right circle2
                mobilityPath.push(new Ellipse(x + width - wheelSize - wheelSize, bottomY + wheelOffset, wheelSize, wheelSize));
            }
            else if (ad ===  SymbolID.Mobility_OverSnow)//MU
            {
                let muPath: Path = new Path();
                muPath.moveTo(x, bottomY);
                muPath.lineTo(x + 5, bottomY + 5);
                muPath.lineTo(x + width, bottomY + 5);
                mobilityPath.push(muPath);
            }
            else if (ad ===  SymbolID.Mobility_Sled)//MV
            {
                let mvPath: Path = new Path();
                mvPath.moveTo(x, bottomY);
                mvPath.bezierCurveTo(x, bottomY, x - rrHeight, bottomY + rrHeight/2, x, bottomY + rrHeight);
                mvPath.lineTo(x + width, bottomY + rrHeight);
                mvPath.bezierCurveTo(x + width, bottomY + rrHeight, x + width + rrHeight, bottomY + rrHeight/2, x + width, bottomY);
                mobilityPath.push(mvPath);
            }
            else if (ad ===  SymbolID.Mobility_PackAnimals)//MW
            {
                let mwPath: Path = new Path();

                centerX = Math.round(symbolBounds.getCenterX()) as number;
                let angleWidth: number = rrHeight / 2;
                mwPath.moveTo(centerX, bottomY + rrHeight + 2);
                mwPath.lineTo(centerX - angleWidth, bottomY);
                mwPath.lineTo(centerX - angleWidth * 2, bottomY + rrHeight + 2);

                mwPath.moveTo(centerX, bottomY + rrHeight + 2);
                mwPath.lineTo(centerX + angleWidth, bottomY);
                mwPath.lineTo(centerX + angleWidth * 2, bottomY + rrHeight + 2);

                mobilityPath.push(mwPath);
            }
            else if (ad ===  SymbolID.Mobility_Barge)//MX
            {
                let mxPath: Path = new Path();

                centerX = symbolBounds.getCenterX() as number;
                let quarterX: number = (centerX - x) / 2;
                let quarterY: number = (((bottomY + rrHeight) - bottomY) / 2);
                mxPath.moveTo(x + width, bottomY);
                mxPath.lineTo(x, bottomY);
                mxPath.bezierCurveTo(x + quarterX, bottomY + rrHeight, centerX + quarterX, bottomY + rrHeight, x + width, bottomY);

                mobilityPath.push(mxPath);
            }
            else if (ad ===  SymbolID.Mobility_Amphibious)//MY
            {
                /*let incrementX: number = width / 7;
                middleY = (((bottomY + rrHeight) - bottomY) / 2);

                mobilityPath.append(new Arc(x, bottomY + middleY, incrementX, rrHeight, 0, 180, Arc.OPEN), false);
                mobilityPath.append(new Arc(x + incrementX, bottomY + middleY, incrementX, rrHeight, 0, -180, Arc.OPEN), false);
                mobilityPath.append(new Arc(x + incrementX * 2, bottomY + middleY, incrementX, rrHeight, 0, 180, Arc.OPEN), false);
                mobilityPath.append(new Arc(x + incrementX * 3, bottomY + middleY, incrementX, rrHeight, 0, -180, Arc.OPEN), false);
                mobilityPath.append(new Arc(x + incrementX * 4, bottomY + middleY, incrementX, rrHeight, 0, 180, Arc.OPEN), false);
                mobilityPath.append(new Arc(x + incrementX * 5, bottomY + middleY, incrementX, rrHeight, 0, -180, Arc.OPEN), false);
                mobilityPath.append(new Arc(x + incrementX * 6, bottomY + middleY, incrementX, rrHeight, 0, 180, Arc.OPEN), false);//*/

                let incrementX: number = width / 7;
                let tY: number = bottomY;
                let mY: number = (bottomY + (rrHeight / 2));
                let bY: number = mY + (rrHeight / 2);

                let myPath = new Path();
                myPath.moveTo(x, mY);
                myPath.bezierCurveTo(x, tY, x + incrementX, tY, x + incrementX, mY);
                myPath.bezierCurveTo(x + incrementX, bY, x + incrementX * 2, bY, x + incrementX * 2, mY);
                myPath.bezierCurveTo(x + incrementX * 2, tY, x + incrementX * 3, tY, x + incrementX * 3, mY);
                myPath.bezierCurveTo(x + incrementX * 3, bY, x + incrementX * 4, bY, x + incrementX * 4, mY);
                myPath.bezierCurveTo(x + incrementX * 4, tY, x + incrementX * 5, tY, x + incrementX * 5, mY);
                myPath.bezierCurveTo(x + incrementX * 5, bY, x + incrementX * 6, bY, x + incrementX * 6, mY);
                myPath.bezierCurveTo(x + incrementX * 6, tY, x + incrementX * 7, tY, x + incrementX * 7, mY);

                mobilityPath.push(myPath);

            }
        }
        //Draw Towed Array Sonar
        if ((ad ===  SymbolID.Mobility_ShortTowedArray || ad ===  SymbolID.Mobility_LongTowedArray) &&
            SymbolUtilities.canSymbolHaveModifier(symbolID, Modifiers.AG_AUX_EQUIP_INDICATOR)) {
            //mobilityPath = new Path();
            let boxHeight: number = ((rrHeight * 0.5) + 0.5) as number;
            if (boxHeight < 5) {

                strokeWidthNL = 1;
            }

            bottomY = y + height + (boxHeight / 7);
            //mobilityPathFill = new Path();
            offsetY = boxHeight / 7;//1;
            centerX = symbolBounds.getCenterX() as number;
            let squareOffset: number = Math.round(boxHeight * 0.5);
            middleY = ((boxHeight / 2) + bottomY) + offsetY;//+1 for offset from symbol
            if (ad ===  SymbolID.Mobility_ShortTowedArray) {
                //subtract 0.5 becase lines 1 pixel thick get aliased into
                //a line two pixels wide.
                //line
                mobilityPath.push(new Line(centerX, bottomY - 1, centerX, bottomY + offsetY + boxHeight + offsetY));
                //PathUtilties.addLine(mobilityPath, centerX - 1, bottomY - 1, centerX - 1, bottomY + boxHeight + offsetY);

                //line
                mobilityPath.push(new Line(x, middleY, x + width, middleY));
                //PathUtilties.addLine(mobilityPath, x, middleY, x + width, middleY);

                //square
                mobilityPath.push(new Rectangle(x - squareOffset, bottomY + offsetY, boxHeight, boxHeight));
                //mobilityPathFill.addRect(PathUtilties.makeRectF(x - squareOffset, bottomY + offsetY, boxHeight, boxHeight), Direction.CW);

                //square
                mobilityPath.push(new Rectangle(Math.round(centerX - squareOffset), bottomY + offsetY, boxHeight, boxHeight));
                //mobilityPathFill.addRect(PathUtilties.makeRectF(Math.round(centerX - squareOffset), bottomY + offsetY, boxHeight, boxHeight), Direction.CW);

                //square
                mobilityPath.push(new Rectangle(x + width - squareOffset, bottomY + offsetY, boxHeight, boxHeight));
                //mobilityPathFill.addRect(PathUtilties.makeRectF(x + width - squareOffset, bottomY + offsetY, boxHeight, boxHeight), Direction.CW);
            }
            else if (ad ===  SymbolID.Mobility_LongTowedArray) {
                let leftX: number = x + (centerX - x) / 2;
                let
                    rightX: number = centerX + (x + width - centerX) / 2;

                //line vertical left
                mobilityPath.push(new Line(leftX, bottomY - 1, leftX, bottomY + offsetY + boxHeight + offsetY));
                //PathUtilties.addLine(mobilityPath, leftX, bottomY - 1, leftX, bottomY + offsetY + boxHeight + offsetY);

                //line vertical right
                mobilityPath.push(new Line(rightX, bottomY - 1, rightX, bottomY + offsetY + boxHeight + offsetY));
                //PathUtilties.addLine(mobilityPath, rightX, bottomY - 1, rightX, bottomY + offsetY + boxHeight + offsetY);

                //line horizontal
                mobilityPath.push(new Line(x, middleY, x + width, middleY));
                //PathUtilties.addLine(mobilityPath, x, middleY, x + width, middleY);

                //square left
                mobilityPath.push(new Rectangle(x - squareOffset, bottomY + offsetY, boxHeight, boxHeight));
                //mobilityPathFill.addRect(PathUtilties.makeRectF(x - squareOffset, bottomY + offsetY, boxHeight, boxHeight), Direction.CW);

                //square middle
                mobilityPath.push(new Rectangle(centerX - squareOffset, bottomY + offsetY, boxHeight, boxHeight));
                //mobilityPathFill.addRect(PathUtilties.makeRectF(centerX - squareOffset, bottomY + offsetY, boxHeight, boxHeight), Direction.CW);

                //square right
                mobilityPath.push(new Rectangle(x + width - squareOffset, bottomY + offsetY, boxHeight, boxHeight));
                //mobilityPathFill.addRect(PathUtilties.makeRectF(x + width - squareOffset, bottomY + offsetY, boxHeight, boxHeight), Direction.CW);

                //square middle left
                mobilityPath.push(new Rectangle(leftX - squareOffset, bottomY + offsetY, boxHeight, boxHeight));
                //mobilityPathFill.addRect(PathUtilties.makeRectF(leftX - squareOffset, bottomY + offsetY, boxHeight, boxHeight), Direction.CW);

                //square middle right
                mobilityPath.push(new Rectangle(rightX - squareOffset, bottomY + offsetY, boxHeight, boxHeight));
                //mobilityPathFill.addRect(PathUtilties.makeRectF(rightX - squareOffset, bottomY + offsetY, boxHeight, boxHeight), Direction.CW);

            }

        }

        //get mobility bounds
        if (mobilityPath !==  null && mobilityPath.length > 0) {

            //build mobility bounds
            mobilityBounds = mobilityPath[0].getBounds();
            let size: number = mobilityPath.length;
            let tempShape: any = null;
            for (var i = 1; i < size; i++) {
                tempShape = mobilityPath[i];
                mobilityBounds!.union(tempShape.getBounds());
            }



            //grow bounds to handle strokeWidth
            if (ad ===  SymbolID.Mobility_ShortTowedArray || ad ===  SymbolID.Mobility_LongTowedArray) {

                mobilityBounds!.grow(Math.ceil((strokeWidthNL / 2)));
            }

            else {

                mobilityBounds!.grow(Math.ceil((strokeWidth / 2)));
            }

        }
    }

    return {
        mobilityPath,
        mobilityPathFill,
        mobilityBounds,
        strokeWidthNL
    };
}
