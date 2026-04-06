

import { BasicStroke } from "../graphics/BasicStroke"
import { Font } from "../graphics/Font"
import { TexturePaint } from "../graphics/TexturePaint"
import { POINT2 } from "../types/point"
import { TacticalLines } from "../types/enums"
import { Modifier2 } from "./modifier-placement"
import { Color } from "../renderer/utilities/Color"
import { ErrorLogger } from "../renderer/utilities/ErrorLogger"
import { SymbolID } from "../renderer/utilities/SymbolID"
import { SymbolUtilities } from "../renderer/utilities/SymbolUtilities"
import { rendererSettings } from "../renderer/utilities/RendererSettings";

/**
 * A class to encapsulate the tactical graphic object. Many of the properties
 * correspond to a client MilStdSymbol object.
 *
 *
 */
export class TacticalGraphic {

    public LatLongs: Array<POINT2>;

    private static readonly _className: string = "TacticalGraphic";

    public Pixels: Array<POINT2>;

    public modifiers: Array<Modifier2>;

    public texturePaint: TexturePaint;

    protected maskOff: boolean;

    public constructor() {

    }

    public font: Font;

    private iconSize: number = 50;

    /**
     * Set the icon size for areas that have a symbol like LAA or Biological Contaminated Area
     * @param pixelSize
     */
    public setIconSize(pixelSize: number): void { this.iconSize = pixelSize; }

    public getIconSize(): number { return this.iconSize; }

    public keepUnitRatio: boolean = true;

    public lineType: number = 0;

    public lineStyle: number = 0;

    public lineColor: Color | null;

    public fillStyle: number = 0;

    public fillColor: Color | null;

    public fontBackColor: Color = Color.WHITE;

    public textColor: Color;

    public lineThickness: number = 0;

    // --- Accessors with visibleModifiers check ---

    private _name: string = "";

    public get name(): string {
        if (this.visibleModifiers) {
            return this._name;
        } else {
            return "";
        }
    }

    public set name(value: string) {
        this._name = value;
    }

    public client: string = "";

    private _t1: string = "";

    public get t1(): string {
        if (this.visibleModifiers) {
            return this._t1;
        } else {
            return "";
        }
    }

    public set t1(value: string) {
        this._t1 = value;
    }

    private _am: string = "";

    public get am(): string {
        if (this.visibleModifiers) {
            return this._am;
        } else {
            return "";
        }
    }

    public set am(value: string) {
        this._am = value;
    }

    private _am1: string = "";

    public get am1(): string {
        if (this.visibleModifiers) {
            return this._am1;
        } else {
            return "";
        }
    }

    public set am1(value: string) {
        this._am1 = value;
    }

    private _an: string = "";

    public get an(): string {
        if (this.visibleModifiers) {
            return this._an;
        } else {
            return "";
        }
    }

    public set an(value: string) {
        this._an = value;
    }

    private _v: string = "";

    public get v(): string {
        if (this.visibleModifiers) {
            return this._v;
        } else {
            return "";
        }
    }

    public set v(value: string) {
        this._v = value;
    }

    private _ap: string = "";

    public get ap(): string {
        if (this.visibleModifiers) {
            return this._ap;
        } else {
            return "";
        }
    }

    public set ap(value: string) {
        this._ap = value;
    }

    private _as: string = "";

    public get as(): string {
        if (this.visibleModifiers) {
            return this._as;
        } else {
            return "";
        }
    }

    public set as(value: string) {
        this._as = value;
    }

    public x: string = "";

    public x1: string = "";

    private _h: string = "";

    public get h(): string {
        if (this.visibleModifiers || this.lineType === TacticalLines.RECTANGULAR) {
            return this._h;
        } else {
            return "";
        }
    }

    public set h(value: string) {
        this._h = value;
    }

    private _location: string = "";

    public get location(): string {
        if (this.visibleModifiers) {
            if (this._location.length > 0) {
                return this._location;
            } else {
                return this._h;
            }
        } else {
            return "";
        }
    }

    public set location(value: string) {
        this._location = value;
    }

    private _h1: string = "";

    /**
     * @deprecated
     */
    public get h1(): string {
        if (this.visibleModifiers) {
            return this._h1;
        } else {
            return "";
        }
    }

    /**
     * @deprecated
     */
    public set h1(value: string) {
        this._h1 = value;
    }

    public n: string = "ENY";

    private _h2: string = "";

    /**
     * @deprecated
     */
    public get h2(): string {
        if (this.visibleModifiers || this.lineType === TacticalLines.RECTANGULAR) {
            return this._h2;
        } else {
            return "";
        }
    }

    /**
     * @deprecated
     */
    public set h2(value: string) {
        this._h2 = value;
    }

    /**
     * Only used for range fan
     * left azimuth,right azimuth,min radius,max radius
     */
    public leftRightMinMax: string = "";

    private _dtg: string = "";

    public get dtg(): string {
        if (this.visibleModifiers) {
            return this._dtg;
        } else {
            return "";
        }
    }

    public set dtg(value: string) {
        this._dtg = value;
    }

    private _dtg1: string = "";

    public get dtg1(): string {
        if (this.visibleModifiers) {
            return this._dtg1;
        } else {
            return "";
        }
    }

    public set dtg1(value: string) {
        this._dtg1 = value;
    }


    public standardIdentity: string = "00";

    /**
     * @return true if standard identity is suspect/joker or hostile/faker
     */
    public isHostile(): boolean {
        if (this.standardIdentity != null) {
            return this.standardIdentity.charAt(1) === '5' || this.standardIdentity.charAt(1) === '6';
        } else {
            return false;
        }
    }

    public echelonSymbol: string = "";

    private _symbolId: string = "00000000";

    public get symbolId(): string {
        return this._symbolId;
    }

    // "P" for present or "A" for anticipated
    public status: string = "P";

    /**
     * Sets tactical graphic properties based on the 20-30 digit Mil-Std-2525 symbol code
     *
     * @param value
     */
    public set symbolId(value: string) {
        try {
            this._symbolId = value;
            let symbolSet: number = SymbolID.getSymbolSet(this._symbolId);
            if (symbolSet === 25) {
                this.standardIdentity = SymbolID.getStandardIdentity(this._symbolId) + "";
                if (this.standardIdentity.length === 1) {

                    this.standardIdentity = "0" + this.standardIdentity;
                }


                this.status = "P"; // default to present
                if (SymbolID.getStatus(this._symbolId) === 1) {
                    // Planned/Anticipated/Suspect
                    this.status = "A";
                    this.lineStyle = 1; // dashed
                }

                let amplifier: number = SymbolID.getAmplifierDescriptor(this._symbolId);
                this.echelonSymbol = SymbolUtilities.getEchelonText(amplifier);
                if (this.echelonSymbol == null) {
                    this.echelonSymbol = "";
                }
            }
        } catch (exc) {
            if (exc instanceof Error) {
                //clsUtility.WriteFile("Error in TacticalGraphic.set_SymbolId");
                ErrorLogger.LogException(TacticalGraphic._className, "set_SymbolId",
                    exc);
            } else {
                throw exc;
            }
        }
    }

    public visibleModifiers: boolean = true;

    public visibleLabels: boolean;

    public useLineInterpolation: boolean = false;

    public useDashArray: boolean = false;

    public useHatchFill: boolean = false;

    //    boolean _usePatternFill = false;
    //    public boolean get_UsePatternFill() {
    //        return _usePatternFill;
    //    }
    //
    //    public void set_UsePatternFill(boolean value) {
    //        _usePatternFill = value;
    //    }

    public wasClipped: boolean = false;

    //boolean determines whether to add the range and azimuth modifiers for range fans
    public hideOptionalLabels: boolean = false;

    public lineCap: number = BasicStroke.CAP_SQUARE;

    public patternScale: number = rendererSettings.getPatternScale();
}
