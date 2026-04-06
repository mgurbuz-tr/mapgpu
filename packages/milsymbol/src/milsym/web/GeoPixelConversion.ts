


import { rendererSettings } from "../renderer/utilities/RendererSettings";



export class GeoPixelConversion {

    public static readonly INCHES_PER_METER: number = 39.3700787;
    public static readonly METERS_PER_DEG: number = 40075017 / 360; // Earth's circumference in meters / 360 degrees

    public static metersPerPixel(scale: number): number {
        let step1: number = scale / rendererSettings.getDeviceDPI();
        return step1 / GeoPixelConversion.INCHES_PER_METER;
    }

    public static lat2y(latitude: number, scale: number, latOrigin: number, metPerPix: number): number {

        let latRem: number = -(latitude - latOrigin);
        let pixDis: number = (latRem * GeoPixelConversion.METERS_PER_DEG) / metPerPix;
        return pixDis;
    }

    public static y2lat(yPosition: number, scale: number, latOrigin: number, metPerPix: number): number {

        let latitude: number = latOrigin - ((yPosition * metPerPix) / GeoPixelConversion.METERS_PER_DEG);
        return latitude;
    }

    public static long2x(longitude: number, scale: number, longOrigin: number, latitude: number, metPerPix: number, normalize: boolean): number {

        let longRem: number = longitude - longOrigin;
        if (normalize) {
            if (longRem > 180) {
                longRem -= 360;
            }
            if (longRem < -180) {
                longRem += 360;
            }
        }
        let metersPerDeg: number = GeoPixelConversion.GetMetersPerDegAtLat(latitude);
        let pixDis: number = (longRem * metersPerDeg) / metPerPix;
        return pixDis;
    }

    public static x2long(xPosition: number, scale: number, longOrigin: number, latitude: number, metPerPix: number): number {

        let metersPerDeg: number = GeoPixelConversion.GetMetersPerDegAtLat(latitude);
        let longitude: number = longOrigin + ((xPosition * metPerPix) / metersPerDeg);

        if (longitude < -180) {
            longitude += 360;
        } else {
            if (longitude > 180) {
                longitude -= 360;
            }
        }


        return longitude;
    }

    public static Deg2Rad(deg: number): number {
        let conv_factor: number = (2.0 * Math.PI) / 360.0;
        return (deg * conv_factor);
    }

    public static GetMetersPerDegAtLat(lat: number): number {
        // Convert latitude to radians
        lat = GeoPixelConversion.Deg2Rad(lat);
        // Set up "Constants"
        let p1: number = 111412.84; // longitude calculation term 1

        let p2: number = -93.5; // longitude calculation term 2

        let p3: number = 0.118; // longitude calculation term 3

        // Calculate the length of a degree of longitude in meters at given
        // latitude
        let longlen: number = (p1 * Math.cos(lat)) + (p2 * Math.cos(3 * lat)) + (p3 * Math.cos(5 * lat));

        return longlen;
    }
}
