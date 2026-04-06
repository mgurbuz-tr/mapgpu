//Graphics2D
import { Rectangle2D } from "../../graphics/Rectangle2D"

//Renderer/Shapes
import { Path } from "../shapes/path";

//Renderer.Utilities
import { Color } from "../utilities/Color"
import { SymbolID } from "../utilities/SymbolID"
import { SymbolUtilities } from "../utilities/SymbolUtilities"

/**
 * Process the Operational Condition Indicator bar for a symbol
 * @param symbolID the symbol ID to extract status from
 * @param symbolBounds the bounds of the symbol
 * @param offsetY the Y offset for the bar
 * @returns a Rectangle2D representing the operational condition bar, or undefined
 */
export function processOperationalConditionIndicator(symbolID: string, symbolBounds: Rectangle2D, offsetY: number): Rectangle2D | undefined {
    //create Operational Condition Indicator
    //set color
    let bar: Rectangle2D | undefined;
    let status: number = 0;
    let statusColor: Color;
    let barSize: number = 0;
    let pixelSize: number = symbolBounds.getHeight() as number;

    status = SymbolID.getStatus(symbolID);
    if (status === SymbolID.Status_Present_FullyCapable ||
        status === SymbolID.Status_Present_Damaged ||
        status === SymbolID.Status_Present_Destroyed ||
        status === SymbolID.Status_Present_FullToCapacity) {
        if (pixelSize > 0) {
            barSize = Math.round(pixelSize / 5);
        }

        if (barSize < 2) {
            barSize = 2;
        }

        offsetY += Math.round(symbolBounds.getY() + symbolBounds.getHeight());

        bar = new Rectangle2D(symbolBounds.getX() as number + 2, offsetY, Math.round(symbolBounds.getWidth()) as number - 4, barSize);
    }

    return bar;
}

/**
 * Process the Operational Condition Indicator slash (for Damaged/Destroyed status)
 * @param symbolID the symbol ID to extract status from
 * @param symbolBounds the bounds of the symbol
 * @returns a Path representing the slash indicator, or undefined
 */
export function processOperationalConditionIndicatorSlash(symbolID: string, symbolBounds: Rectangle2D): Path | undefined {
    //create Operational Condition Indicator
    let path: Path | undefined;
    let status: number = 0;
    status = SymbolID.getStatus(symbolID);

    if (status === SymbolID.Status_Present_Damaged || status === SymbolID.Status_Present_Destroyed) {
        let widthRatio: number = SymbolUtilities.getUnitRatioWidth(symbolID);
        let heightRatio: number = SymbolUtilities.getUnitRatioHeight(symbolID);

        let slashHeight: number = (symbolBounds.getHeight() / heightRatio * 1.47);
        let slashWidth: number = (symbolBounds.getWidth() / widthRatio * 0.85);
        let centerX: number = symbolBounds.getCenterX();
        let centerY: number = symbolBounds.getCenterY();
        path = new Path();
        if (status === SymbolID.Status_Present_Damaged)//Damaged /
        {
            path.moveTo(centerX - (slashWidth / 2), centerY + (slashHeight / 2));
            path.lineTo(centerX + (slashWidth / 2), centerY - (slashHeight / 2));
        }
        else {
            if (status === SymbolID.Status_Present_Destroyed)//Destroyed X
            {
                path.moveTo(centerX - (slashWidth / 2), centerY + (slashHeight / 2));
                path.lineTo(centerX + (slashWidth / 2), centerY - (slashHeight / 2));
                path.moveTo(centerX - (slashWidth / 2), centerY - (slashHeight / 2));
                path.lineTo(centerX + (slashWidth / 2), centerY + (slashHeight / 2));
            }
        }

        return path;

    }

    return path;
}
