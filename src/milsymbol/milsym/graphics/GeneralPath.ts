import { AffineTransform } from "./AffineTransform"
import { IPathIterator } from "./IPathIterator"
import { PathIterator } from "./PathIterator"
import { Point2D } from "./Point2D"
import { Rectangle } from "./Rectangle"
import { Rectangle2D } from "./Rectangle2D"
import { Shape } from "./Shape"

import { POINT2 } from "../types/point"


export class GeneralPath implements Shape {
    private _pathIterator: PathIterator;
    public constructor() {
        this._pathIterator = new PathIterator(null);
    }
    public lineTo(x: number, y: number): void {
        this._pathIterator.lineTo(x, y);
    }
    public moveTo(x: number, y: number): void {
        this._pathIterator.moveTo(x, y);
    }
    public quadTo(x1: number, y1: number, x2: number, y2: number): void {
        this._pathIterator.quadTo(x1, y1, x2, y2);
    }
    public cubicTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
        this._pathIterator.cubicTo(x1, y1, x2, y2, x3, y3);
    }
    public curveTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
        this._pathIterator.cubicTo(x1, y1, x2, y2, x3, y3);
    }
    public computeBounds(rect: Rectangle2D): void {
        const bounds = this._pathIterator.getBounds();
        rect.setRect(bounds.x, bounds.y, bounds.width, bounds.height);
    }
    public closePath(): void {
        // no-op: path closing is handled by the renderer
    }
    public contains(pt: Point2D): boolean;

    public contains(r: Rectangle2D): boolean;
    public contains(x: number, y: number): boolean;
    public contains(x: number, y: number, width: number, height: number): boolean;
    public contains(...args: unknown[]): boolean {
        switch (args.length) {
            case 1: {
                if (args[0] instanceof Point2D) {
                    return false;
                } else {
                    const [r] = args as [Rectangle2D];
                    let rect: Rectangle = new Rectangle(r.x as number, r.y as number, r.width as number, r.height as number);
                    let rect2: Rectangle = this.getBounds();
                    return rect2.contains(rect.x, rect.y, rect.width, rect.height);
                }
            }

            case 2: {
                const [x, y] = args as [number, number];


                return false;


                break;
            }

            case 4: {
                const [x, y, width, height] = args as [number, number, number, number];


                let rect2: Rectangle = this.getBounds();
                return rect2.contains(x, y, width, height);


                break;
            }

            default: {
                throw Error(`Invalid number of arguments`);
            }
        }
    }

    public getBounds2D(): Rectangle2D {
        return this._pathIterator.getBounds();
    }
    public getBounds(): Rectangle {
        let rect: Rectangle2D = this._pathIterator.getBounds();
        return new Rectangle(rect.x as number, rect.y as number, rect.width as number, rect.height as number);
    }
    /**
     * called only when the GeneralPath is a rectangle
     * @param rect
     * @return 
     */
    public intersects(rect: Rectangle2D): boolean;
    /**
     * Only tests against the bounds, used only when the GeneralPath is a rectangle
     * @param x
     * @param y
     * @param w
     * @param h
     * @return 
     */
    public intersects(x: number, y: number, w: number, h: number): boolean;
    public intersects(...args: unknown[]): boolean {
        switch (args.length) {
            case 1: {
                const [rect] = args as [Rectangle2D];


                return this.getBounds().intersects(rect.x, rect.y, rect.width, rect.height);


                break;
            }

            case 4: {
                const [x, y, w, h] = args as [number, number, number, number];


                return this.getBounds().intersects(x, y, w, h);


                break;
            }

            default: {
                throw Error(`Invalid number of arguments`);
            }
        }
    }

    public append(shape: Shape, connect: boolean): void {
        let gp: GeneralPath = shape as GeneralPath;
        let pts: Array<POINT2> = gp._pathIterator.getPoints();
        let pt: POINT2;
        let pt1: POINT2;
        let pt2: POINT2;
        let n: number = pts.length;
        for (let j = 0; j < n; j++) {
            pt = pts[j];
            switch (pt.style) {
                case IPathIterator.SEG_MOVETO: {
                    this._pathIterator.moveTo(pt.x, pt.y);
                    break;
                }

                case IPathIterator.SEG_LINETO: {
                    this._pathIterator.lineTo(pt.x, pt.y);
                    break;
                }

                case IPathIterator.SEG_CUBICTO: {
                    pt1 = pts[j + 1]; j++;
                    pt2 = pts[j + 2]; j++;
                    this._pathIterator.cubicTo(pt.x, pt.y, pt1.x, pt1.y, pt2.x, pt2.y);
                    break;
                }

                default: {
                    break;
                }

            }
        }
    }
    public getPathIterator(tx: AffineTransform | null): PathIterator {
        this._pathIterator.reset();
        return this._pathIterator;
    }
}
