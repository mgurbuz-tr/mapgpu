import { createMeasureCanvas } from "../../canvas-factory";

/**
 * Utility methods that reference Canvas
 * Not exported in index.ts to hide Canvas import from client
 */
export class CanvasUtilities {
    public static getCanvas(width:number, height:number):OffscreenCanvas | any
    {
        let OSCDefined:boolean = (typeof OffscreenCanvasRenderingContext2D !== 'undefined');//web workers fail isBrowser test
        let osc:OffscreenCanvas | any = null;
        let ctx:OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null;
        if(OSCDefined)
            osc = new OffscreenCanvas(width,height);
        else
            osc = createMeasureCanvas(width,height);
           
        return osc;
    }

    /**
     * 
     * @param canvas 
     * @returns OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D
     */
    public static getContext(canvas:OffscreenCanvas | any):any
    {
        //OffscreenCanvas | any
        //OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null
        if(canvas != null)
        {
            return canvas.getContext("2d");
        }
        else
            return null;
    }
}