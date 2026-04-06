//Graphics2D
import { BasicStroke } from "../../graphics/BasicStroke"
import { Point2D } from "../../graphics/Point2D"
import { Rectangle2D } from "../../graphics/Rectangle2D"

//Renderer/Shapes
import { Path } from "../shapes/path";

//Renderer.Utilities
import { Color } from "../utilities/Color"
import { Modifiers } from "../utilities/Modifiers"
import { rendererSettings } from "../utilities/RendererSettings"
import { SymbolID } from "../utilities/SymbolID"
import { SymbolUtilities } from "../utilities/SymbolUtilities"

/**
 * Utility functions for rendering direction arrows in DOM context
 */

export function createDOMArrowPoints(symbolID: string, bounds: Rectangle2D, center: Point2D, angle: number, isY: boolean, frc: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D, modifierFontHeight: number): Point2D[] {
    let arrowPoints: Point2D[] = new Array<Point2D>(6);
    let pt1: Point2D;
    let pt2: Point2D | null = null;
    let pt3: Point2D | null = null;


    let length: number = 40;
    if (SymbolUtilities.isCBRNEvent(symbolID)) {
        length = Math.round(bounds.getHeight() / 2) as number;
    }
    else {
        if ((SymbolUtilities.isHQ(symbolID))) {
            if (SymbolUtilities.hasRectangleFrame(symbolID)) {

                length = Math.round(bounds.getHeight()) as number;
            }

            else {

                length = Math.round(bounds.getHeight() * 0.7) as number;
            }

        }
        else //if (bounds.getHeight() >= 100)
        {
                length = Math.round(bounds.getHeight() * 0.7) as number;
        }

    }


    //get endpoint
    let dx2: number = 0;
    let dy2: number = 0;
    let
        x1: number = 0;
    let y1: number = 0;
    let
        x2: number = 0;
    let y2: number = 0;

    x1 = Math.round(center.getX()) as number;
    y1 = Math.round(center.getY()) as number;

    pt1 = new Point2D(x1, y1);

    if (SymbolUtilities.hasModifier(symbolID, Modifiers.Q_DIRECTION_OF_MOVEMENT) &&
        SymbolUtilities.isCBRNEvent(symbolID) ||
        SymbolUtilities.isLand(symbolID) ||
        SymbolID.getSymbolSet(symbolID)==SymbolID.SymbolSet_DismountedIndividuals)
    {
        //drawStaff = true;
        if (SymbolUtilities.isHQ(symbolID) ===  false)//has HQ staff to start from
        {
            y1 = (bounds.getY() + bounds.getHeight()) as number;
            pt1 = new Point2D(x1, y1);

            if (isY ===  true && SymbolUtilities.isCBRNEvent(symbolID))//make room for y modifier
            {
                let yModifierOffset: number = modifierFontHeight as number;

                yModifierOffset += rendererSettings.getTextOutlineWidth();

                pt1.setLocation(pt1.getX(), pt1.getY() + yModifierOffset);
            }//*/

            y1 = y1 + length;
            pt2 = new Point2D(x1, y1);
        }
        else {
            x1 = bounds.getX() as number + 1;

            if (SymbolUtilities.hasRectangleFrame(symbolID)) {
                /*y1 = bounds.top + bounds.height();
                pt1 = new Point(x1, y1);
                y1 = y1 + length;
                pt2 = new Point(x1, y1);//*/

                y1 = (bounds.getY() + bounds.getHeight()) as number;
                pt1 = new Point2D(x1, y1);
                y1 = y1 + length;
                pt2 = new Point2D(x1, y1);//*/

            }
            else {
                y1 = (bounds.getY() + (bounds.getHeight() / 2)) as number;
                pt1 = new Point2D(x1, y1);

                x2 = x1;
                y1 = (pt1.getY() + bounds.getHeight()) as number;
                pt2 = new Point2D(x2, y1);

                //I feel like the below code is the same as above but it didn't work out that way
                //keeping to try and figure out later
                /*y1 = (int)(bounds.getY() + (bounds.getHeight() / 2));
                pt1 = new Point2D(x1, y1);

                x2 = x1;
                y2 = (int)(pt1.getY() + bounds.getHeight());
                pt2= new Point2D(x2, y2);*/
            }
        }
    }

    //get endpoint given start point and an angle
    //x2 = x1 + (length * Math.cos(radians)));
    //y2 = y1 + (length * Math.sin(radians)));
    angle = angle - 90;//in java, east is zero, we want north to be zero
    let radians: number = 0;
    radians = (angle * (Math.PI / 180));//convert degrees to radians

    dx2 = x1 + (length * Math.cos(radians)) as number;
    dy2 = y1 + (length * Math.sin(radians)) as number;
    x2 = Math.round(dx2);
    y2 = Math.round(dy2);

    //UPDATED ARROWHEAD CODE
    let head: Point2D[] = new Array();
    let endPoint: Point2D = new Point2D(x2, y2);
    if(pt2 !==  null)
        head = createDOMArrowHead(pt2, endPoint);//pt3);
    else
        head = createDOMArrowHead(pt1, endPoint);//pt3);

    if(head !==  null)
    {
        arrowPoints[0] = pt1;
        arrowPoints[1] = pt2 || pt1;
        arrowPoints[2] = pt3 || pt1;
        arrowPoints[3] = head[0];
        arrowPoints[4] = head[1];
        arrowPoints[5] = head[2];

        //adjusted endpoint
        if(head.length >= 4 && head[3] !==  null)
        {
            arrowPoints[2] = head[3];
        }
    }

    return arrowPoints;

}

export function createDOMArrowHead(lpt1: Point2D, lpt2: Point2D): Point2D[]
{
    let arrowPoints: Point2D[] = new Array();
    let pt1: Point2D | null = null;
    let pt2: Point2D | null = null;
    let pt3: Point2D | null = null;

    let x1: number = lpt1.getX();
    let y1: number = lpt1.getY();
    let x2: number = lpt2.getX();
    let y2: number = lpt2.getY();

    // Compute direction vector
    let dx: number = x2 - x1;
    let dy: number = y2 - y1;
    let length: number = Math.sqrt(dx * dx + dy * dy);

    // Scale triangle size
    let scale: number = length * 0.1;  // Scaling factor for size
    let offset: number = scale * 1.5;  // Move triangle further down the line

    // Normalize direction vector
    let unitX: number = dx / length;
    let unitY: number = dy / length;

    // Compute perpendicular vector for triangle base
    let nx: number = -unitY;
    let ny: number = unitX;

    // Compute adjusted triangle vertices
    let tipX: number = x2;
    let tipY: number = y2;
    let baseX1: number = (x2 - offset * unitX + scale * nx);
    let baseY1: number = (y2 - offset * unitY + scale * ny);
    let baseX2: number = (x2 - offset * unitX - scale * nx);
    let baseY2: number = (y2 - offset * unitY - scale * ny);


    //arrowHead = new Polygon(xPoints, yPoints, 3);
    arrowPoints[0] = new Point2D(tipX, tipY);
    arrowPoints[1] = new Point2D(baseX1, baseY1);
    arrowPoints[2] = new Point2D(baseX2, baseY2);
    // Adjust line endpoint to be the middle of the base line of the arrowhead
    let adjustedX2 = (baseX1 + baseX2) / 2;
    let adjustedY2 = (baseY1 + baseY2) / 2;
    arrowPoints[3] = new Point2D(adjustedX2, adjustedY2);

    return arrowPoints;

}

export function drawDOMArrow(g2d: OffscreenCanvasRenderingContext2D, domPoints: Point2D[], color: Color, strokeWidth: number): void {
    let stroke: BasicStroke = new BasicStroke(strokeWidth, BasicStroke.CAP_BUTT, BasicStroke.JOIN_MITER, 10.0);

    let domPath: Path = new Path();

    domPath.moveTo(domPoints[0].getX(), domPoints[0].getY());
    if (domPoints[1] !==  null) {
        domPath.lineTo(domPoints[1].getX(), domPoints[1].getY());
    }
    if (domPoints[2] !==  null) {
        domPath.lineTo(domPoints[2].getX(), domPoints[2].getY());
    }
    /*g2d.setStroke(stroke);
    g2d.stroke =
    g2d.setColor(color);
    g2d.draw(domPath);

    domPath.reset();//*/

    domPath.moveTo(domPoints[3].getX(), domPoints[3].getY());
    domPath.lineTo(domPoints[4].getX(), domPoints[4].getY());
    domPath.lineTo(domPoints[5].getX(), domPoints[5].getY());
    //g2d.fill(domPath);
    domPath.fill(g2d);
}
