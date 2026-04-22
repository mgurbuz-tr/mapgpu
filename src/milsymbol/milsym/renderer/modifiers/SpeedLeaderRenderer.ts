//Graphics2D
import { Point2D } from "../../graphics/Point2D"
import { Rectangle2D } from "../../graphics/Rectangle2D"

//Renderer/Shapes
import { Path } from "../shapes/path";

//Renderer.Utilities
import { MilStdAttributes } from "../utilities/MilStdAttributes"
import { Modifiers } from "../utilities/Modifiers"
import { rendererSettings } from "../utilities/RendererSettings"
import { SVGSymbolInfo } from "../utilities/SVGSymbolInfo"
import { SymbolID } from "../utilities/SymbolID"
import { SymbolUtilities } from "../utilities/SymbolUtilities"
import { ErrorLogger } from "../utilities/ErrorLogger";

/**
 * Renders the speed leader modifier for military symbols.
 * Extracts the speed leader method from ModifierRenderer.
 */
export function processSpeedLeader(sdi:SVGSymbolInfo, symbolID:string, modifiers:Map<string,string>, attributes:Map<string,string>): SVGSymbolInfo
{
    let rsdi:SVGSymbolInfo = sdi;

    let imageBounds:Rectangle2D = sdi.getImageBounds();
    let symbolBounds:Rectangle2D = sdi.getSymbolBounds();
    let symbolCenter:Point2D = sdi.getSymbolCenterPoint();
    let ss:number = SymbolID.getSymbolSet(symbolID);
    let pixelSize:number = rendererSettings.getDefaultPixelSize();
    let dpi:number = rendererSettings.getDeviceDPI();
    if(attributes !==  null && attributes.has(MilStdAttributes.PixelSize)) {
        let ps = attributes.get(MilStdAttributes.PixelSize);
        if (ps) pixelSize = parseInt(ps);
    }
    let strokeWidth:number = 3;
    strokeWidth = dpi / 48;
    if (strokeWidth < 1)
        strokeWidth = 1;

    let slPath:Path | null = null;
    let slBounds:Rectangle2D | null = null;
    try{
        if (modifiers !==  null && SymbolUtilities.hasModifier(symbolID, Modifiers.AJ_SPEED_LEADER) &&
                (modifiers.has(Modifiers.AJ_SPEED_LEADER)))
        {
            let aj = modifiers.get(Modifiers.AJ_SPEED_LEADER);
            if (!aj) return rsdi;
            let values:string[] = aj.split(" ");
            if(values.length >= 3)
            {
                let speed:number = parseInt(values[0]);
                let speedUnit:string = values[1]!;
                let angle:number = 0;
                if(values[2].length==3)
                    angle = parseInt(values[2]);
                else
                    angle = parseInt(values[2]) * 0.05625;//convert mils to degrees

                slPath = new Path();
                slPath.moveTo(symbolCenter.getX(), symbolCenter.getY());

                //convert to Knots
                switch(speedUnit)//KPH, KPS, MPH, NMH, KTS//https://www.aviationhunt.com/speed-converter/
                {
                    case "KPH":
                        speed = speed * 0.539957;
                        break;
                    case "KPS"://https://www.metric-conversions.org/speed/kilometers-per-second-to-knots.htm
                        speed = speed * 1943.84;
                        break;
                    case "MPH":
                        speed = speed * 0.86897;
                        break;
                }

                let distance:number = 0;
                let frame:string = SymbolID.getFrameShape(symbolID);
                let dpi:number = rendererSettings.getDeviceDPI();
                let fast:boolean = false;
                if (frame == '0' && ss == SymbolID.SymbolSet_Air ||
                        ss == SymbolID.SymbolSet_AirMissile ||
                        ss == SymbolID.SymbolSet_SignalsIntelligence_Air ||
                        ss == SymbolID.SymbolSet_SpaceMissile ||
                        ss == SymbolID.SymbolSet_Space ||
                        (SymbolID.getVersion(symbolID) <= SymbolID.Version_2525Dch1 && ss == SymbolID.SymbolSet_SignalsIntelligence_Space))
                {
                    fast = true;
                }
                else if(frame == SymbolID.FrameShape_Air || frame == SymbolID.FrameShape_Space)
                {
                    fast = true;
                }

                let distanceScaler:number = dpi;//spec does scale by inch, but if the symbol is too big, scale by pixel size
                if(dpi < pixelSize)
                    distanceScaler = pixelSize;

                if(fast)
                {//aircraft might be 1/4 inch if its speed is less than 300 knots, 1/2 inch if its speed is between 300 and 600 knots and 3/4 inch if its speed is more than 600 knots.
                    if(speed < 300)
                        distance = (distanceScaler * 0.25)/300 * speed;
                    else if (speed < 600)
                        distance = (distanceScaler * 0.5)/600 * speed;
                    else
                        distance = (distanceScaler * 0.75);
                }
                else//submarine might be 1/4 inch if its speed is less than 15 knots, 1/2 inch if its speed is between 15 and 30 knots and 3/4 inch if its speed is more than 30 knots
                {
                    if(speed < 15)
                        distance = (distanceScaler * 0.25)/15 * speed;
                    else if (speed < 30)
                        distance = (distanceScaler * 0.5)/30 * speed;
                    else
                        distance = (distanceScaler * 0.75);
                }

                angle = angle - 90; //in java, east is zero, we want north to be zero
                let radians = (angle * (Math.PI / 180));//convert degrees to radians
                let x2:number = (symbolCenter.getX() + distance * Math.cos(radians));
                let y2:number = (symbolCenter.getY() + distance * Math.sin(radians));

                slPath.lineTo(x2,y2);
                slBounds = slPath.getBounds().toRectangle2D();
                imageBounds = imageBounds.createUnion(slBounds);
            }

            let svg:string = sdi.getSVG();
            if(slPath !==  null)
            {
                svg += slPath.toSVGElement("#000000",strokeWidth,"none",undefined,undefined,undefined,undefined);
                rsdi = new SVGSymbolInfo(svg,symbolCenter,symbolBounds,imageBounds);
            }
        }
    }
    catch(exc)
    {
        if (exc instanceof Error) {
            ErrorLogger.LogException("ModifierRenderer","processSpeedLeader",exc)
        }
    }
    return rsdi;

}
