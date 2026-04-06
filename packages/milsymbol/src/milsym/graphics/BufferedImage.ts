/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */


import { Graphics2D } from "./Graphics2D"


/**
 *
 *
 */
export class BufferedImage {
    public static readonly TYPE_INT_ARGB: number = 2;
    public constructor(width: number,
        height: number,
        imageType: number) 
    {
        
    }
    public createGraphics(): Graphics2D {
        return new Graphics2D();
    }
    public flush(): void {
        return;
    }
    public getWidth(): number {
        return 0;
    }
    public getHeight(): number {
        return 0;
    }
}
