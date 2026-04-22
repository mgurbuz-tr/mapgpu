/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */


import { Line2D } from "./Line2D"
import { Point2D } from "./Point2D"

/**
 *
 *
 */
export class Rectangle2D {
    public x: number = 0;
    public y: number = 0;
    public width: number = 0;
    public height: number = 0;

    public add(newx: number, newy: number): void {
        const x1 = Math.min(this.getMinX(), newx);
        const x2 = Math.max(this.getMaxX(), newx);
        const y1 = Math.min(this.getMinY(), newy);
        const y2 = Math.max(this.getMaxY(), newy);
        this.setRect(x1, y1, x2 - x1, y2 - y1);
    }
    public createIntersection(r: Rectangle2D): Rectangle2D | null {
        if (r.x > this.x + this.width) {

            return null;
        }

        if (r.x + r.width < this.x) {

            return null;
        }

        if (r.y > this.y + this.height) {

            return null;
        }

        if (r.y + r.height < this.y) {

            return null;
        }

        if (r.contains(this)) {

            return this;
        }

        if (this.contains(r)) {

            return r;
        }


        //if it gets to this point we have a normal intersection
        let x1: number = 0;
        let y1: number = 0;
        let x2: number = 0;
        let y2: number = 0;
        if (this.x < r.x) {
            x1 = r.x;
            x2 = this.x + this.width;
        }
        else {
            x1 = this.x;
            x2 = r.x + r.width;
        }
        if (this.y < r.y) {
            y1 = r.y;
            y2 = this.y + this.height;
        }
        else {
            y1 = this.y;
            y2 = r.y + r.height;
        }
        return new Rectangle2D(x1, y1, x2 - x1, y2 - y1);
    }
    public createUnion(r: Rectangle2D): Rectangle2D 
    {
        let temp:Rectangle2D = this.clone();
        temp.union(r);
        return temp;
    }
    public getX(): number {
        return this.x;
    }
    public getY(): number {
        return this.y;
    }
    public getCenterX(): number {
        return (this.x + this.width) / 2;
    }
    public getCenterY(): number {
        return (this.y + this.height) / 2;
    }
    public getMinX(): number {
        return this.x;
    }
    public getMinY(): number {
        return this.y;
    }
    public getMaxX(): number {
        return this.x + this.width;
    }
    public getMaxY(): number {
        return this.y + this.height;
    }
    public getHeight(): number {
        return this.height;
    }
    public getWidth(): number {
        return this.width;
    }
    public contains(rect: Rectangle2D): boolean;
    public contains(pt: Point2D): boolean;
    public contains(x1: number, y1: number): boolean;
    public contains(x: number, y: number, width: number, height: number): boolean;
    public contains(...args: unknown[]): boolean {
        switch (args.length) {
            case 1: {
                if (args[0] instanceof Rectangle2D) {
                    const [rect] = args as [Rectangle2D];

                    let x1: number = rect.getX();
                    let y1: number = rect.getY();
                    if (this.contains(x1, y1)) {
                        x1 += rect.getWidth();
                        y1 += rect.getHeight();
                        if (this.contains(x1, y1)) {
                            return true;
                        }
                    }
                    return false;
                } else {
                    const [pt] = args as [Point2D];

                    if (this.x <= pt.getX() && pt.getX() <= this.x + this.width) {

                        if (this.y <= pt.getY() && pt.getY() <= this.y + this.height) {

                            return true;
                        }
                    }
                    return false;
                }
            }

            case 2: {
                const [x1, y1] = args as [number, number];

                if (this.x <= x1 && x1 <= this.x + this.width &&
                    this.y <= y1 && y1 <= this.y + this.height) {

                    return true;
                }

                else {
                    return false;
                }
            }

            case 4: {
                const [x, y, width, height] = args as [number, number, number, number];


                let x1: number = x;
                let y1: number = y;
                if (this.contains(x1, y1)) {
                    x1 += width;
                    y1 += height;
                    if (this.contains(x1, y1)) {

                        return true;
                    }

                }
                return false;
            }

            default: {
                throw Error(`Invalid number of arguments`);
            }
        }
    }

    public intersects(rect: Rectangle2D): boolean;
    public intersects(x1: number, y1: number, width1: number, height1: number): boolean;
    public intersects(...args: unknown[]): boolean {
        switch (args.length) {
            case 1: {
                const [rect] = args as [Rectangle2D];


                if (this.x + this.width < rect.x) {

                    return false;
                }

                if (this.x > rect.x + rect.width) {

                    return false;
                }

                if (this.y + this.height < rect.y) {

                    return false;
                }

                if (this.y > rect.y + rect.height) {

                    return false;
                }


                return true;


                break;
            }

            case 4: {
                const [x1, y1, width1, height1] = args as [number, number, number, number];


                if (this.x + this.width < x1) {

                    return false;
                }

                if (this.x > x1 + width1) {

                    return false;
                }

                if (this.y + this.height < y1) {

                    return false;
                }

                if (this.y > y1 + height1) {

                    return false;
                }


                return true;


                break;
            }

            default: {
                throw Error(`Invalid number of arguments`);
            }
        }
    }

    public intersectsLine(line: Line2D): boolean {
        return false;
    }
    public isEmpty(): boolean {
        if (this.width === 0 && this.height === 0) {

            return true;
        }

        else {

            return false;
        }

    }
    public setRect(r: Rectangle2D): void;
    public setRect(x1: number, y1: number, width1: number, height1: number): void;
    public setRect(...args: unknown[]): void {
        switch (args.length) {
            case 1: {
                const [r] = args as [Rectangle2D];


                this.x = r.getX();
                this.y = r.getY();
                this.width = r.getWidth();
                this.height = r.getHeight();


                break;
            }

            case 4: {
                const [x1, y1, width1, height1] = args as [number, number, number, number];


                this.x = x1;
                this.y = y1;
                this.width = width1;
                this.height = height1;


                break;
            }

            default: {
                throw Error(`Invalid number of arguments`);
            }
        }
    }

    public grow(size: number): void;
    public grow(h: number, v: number): void;
    public grow(...args: unknown[]) {
        switch (args.length) {
            case 1:
                {
                    const [size] = args as [number];
                    this.x = this.x - size;
                    this.y = this.y - size;
                    this.width = this.width + (2 * size);
                    this.height = this.height + (2 * size);
                    break;
                }
            case 2:
                {
                    const [h, v] = args as [number, number];
                    this.x = this.x - h;
                    this.y = this.y - v;
                    this.width = this.width + (2 * h);
                    this.height = this.height + (2 * v);
                    break;
                }
        }
    }

    public stroke(context: OffscreenCanvasRenderingContext2D) {
        context.strokeRect(this.getX(), this.getY(), this.getWidth(), this.getHeight());
    };
    public fill(context: OffscreenCanvasRenderingContext2D) {
        context.fillRect(this.getX(), this.getY(), this.getWidth(), this.getHeight());
    };

    public clone(): Rectangle2D {
        return new Rectangle2D(this.x, this.y, this.width, this.height);
    }

    /**
     * Will merge the bounds of two rectangle.
     * @param rect 
     */
    public union(rect: Rectangle2D) {
        let thisBR: Point2D = new Point2D(this.x + this.width, this.y + this.height);
        let rectBR: Point2D = new Point2D(rect.x + rect.width, rect.y + rect.height);
        let x:number;
        let y:number;
        let bottom:number;
        let right:number;
        if (rect) {
            if (rect.y < this.y)
                y = rect.y;
            else
                y = this.y;
            if (rect.x < this.x)
                x = rect.x;
            else
                x = this.x;
            if (rectBR.getY() > thisBR.getY())
                bottom = rectBR.getY();
            else
                bottom = thisBR.getY();
            if (rectBR.getX() > thisBR.getX())
                right = rectBR.getX();
            else
                right = thisBR.getX();

            this.setRect(x,y,right-x, bottom-y);
        }

    }

    public constructor();
    public constructor(x1: number, y1: number, width1: number, height1: number);
    public constructor(...args: unknown[]) {
        switch (args.length) {
            case 0: {

                this.x = 0;
                this.y = 0;
                this.width = 0;
                this.height = 0;


                break;
            }

            case 4: {
                const [x1, y1, width1, height1] = args as [number, number, number, number];


                this.x = x1;
                this.y = y1;
                this.width = width1;
                this.height = height1;


                break;
            }

            default: {
                throw Error(`Invalid number of arguments`);
            }
        }
    }

    /**
 * 
 * @param stroke named color or hex color
 * @param strokeWidth width of line in # of pixels
 * @param fill named color or hex color
 * @returns 
 */
    public toSVGElement(stroke: string | null, strokeWidth: number, fill: string | null): string {
        var line = '<rect x="' + this.x + '" y="' + this.y;
        line += '" width="' + this.width + '" height="' + this.height + '"';

        if (strokeWidth)
            line += ' stroke-width="' + strokeWidth + '"';
        else if (stroke)
            line += ' stroke-width="2"';

        if (stroke)
            line += ' stroke="' + stroke + '"';

        if (fill)
            line += ' fill="' + fill + '"';
        else
            line += ' fill="none"';

        line += '/>';
        return line;
    }
}