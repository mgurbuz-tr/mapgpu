import { Point } from "../graphics/Point";
import { Point2D } from "../graphics/Point2D";
import { IPointConversion } from "../renderer/utilities/IPointConversion";
import { GeoPixelConversion } from "./GeoPixelConversion";


/**
 *
 *
 */
export class PointConverter implements IPointConversion {
    private _controlLat: number = 0;
    private _controlLong: number = 0;
    private _scale: number = 0;
    private _metersPerPixel: number = 0;
    private _normalize: boolean = true;
    public set_normalize(value: boolean): void {
        this._normalize = value;
    }
    public constructor(controlLong: number, controlLat: number, scale: number);
    /**
     * add constructor to handle when earth is flipped about it's X axis (South is on top)
     * @param left
     * @param right
     * @param top
     * @param bottom
     * @param scale
     */
    public constructor(left: number, top: number, right: number, bottom: number, scale: number);
    public constructor(...args: unknown[]) {
        switch (args.length) {
            case 3: {
                const [controlLong, controlLat, scale] = args as [number, number, number];
                try {
                    this._controlLat = controlLat;
                    this._controlLong = controlLong;
                    this._scale = scale;
                    this._metersPerPixel = GeoPixelConversion.metersPerPixel(scale);
                } catch (e) {
                    if (e instanceof Error) {
                        throw e;
                    } else {
                        throw e;
                    }
                }

                break;
            }

            case 5: {
                const [left, top, right, bottom, scale] = args as [number, number, number, number, number];

                try {
                    this._controlLat = top;
                    this._controlLong = left;
                    this._scale = scale;
                    this._metersPerPixel = GeoPixelConversion.metersPerPixel(scale);
                    if (top < bottom) {

                        this._metersPerPixel = -this._metersPerPixel;
                    }

                } catch (e) {
                    if (e instanceof Error) {
                        throw e;
                    } else {
                        throw e;
                    }
                }

                break;
            }

            default: {
                throw Error(`Invalid number of arguments`);
            }
        }
    }

    public PixelsToGeo(pixel: Point): Point;
    public PixelsToGeo(pixel: Point2D): Point2D;
    public PixelsToGeo(...args: unknown[]): Point | Point2D {
        const [pixel] = args as [Point | Point2D];
        try {
            let y: number = GeoPixelConversion.y2lat(pixel.getY(), this._scale, this._controlLat, this._metersPerPixel);
            let x: number = GeoPixelConversion.x2long(pixel.getX(), this._scale, this._controlLong, y, this._metersPerPixel);
            if (pixel instanceof Point)
                return new Point(x, y)
            else
                return new Point2D(x, y)
        } catch (e) {
            if (e instanceof Error) {
                throw e;
            } else {
                throw e;
            }
        }
    }


    public GeoToPixels(coord: Point): Point;

    public GeoToPixels(coord: Point2D): Point2D;
    public GeoToPixels(...args: unknown[]): Point | Point2D {
        const [coord] = args as [Point | Point2D];

        try {
            let y: number = GeoPixelConversion.lat2y(coord.getY(), this._scale, this._controlLat, this._metersPerPixel);
            let x: number = GeoPixelConversion.long2x(coord.getX(), this._scale, this._controlLong, coord.getY(), this._metersPerPixel, this._normalize);
            if (coord instanceof Point)
                return new Point(x, y)
            else
                return new Point2D(x, y)
        } catch (e) {
            if (e instanceof Error) {
                throw e;
            } else {
                throw e;
            }
        }

    }
}
