import { GeoPixelConversion } from "../../web/GeoPixelConversion";


/**
 *
 * 
 */
export class GeoPixelConversion3D {
    public static metersPerPixel(scale: number): number {
        return GeoPixelConversion.metersPerPixel(scale);
    }

    public static lat2y(latitude: number, scale: number, latOrigin: number, metPerPix: number): number {

        let latRem: number = Math.abs(latitude - latOrigin);
        let pixDis: number = 0;
        if (latRem > 0) {
            pixDis = (latRem * GeoPixelConversion.METERS_PER_DEG) / metPerPix;
            if (latitude > latOrigin)//was < M. Deutch 6-20-11
            {
                pixDis = -pixDis;
            }
        }
        return pixDis;
    }

    public static y2lat(yPosition: number, scale: number, latOrigin: number, metPerPix: number): number {

        let latitude: number = latOrigin;
        if (yPosition !== 0) {
            latitude = latOrigin - ((yPosition * metPerPix) / GeoPixelConversion.METERS_PER_DEG);//was + M. Deutch 6-18-11
        }
        return latitude;
    }

    public static long2x(longitude: number, scale: number, longOrigin: number, latitude: number, metPerPix: number): number {

        let longRem: number = Math.abs(longitude - longOrigin);
        let metersPerDeg: number = GeoPixelConversion3D.GetMetersPerDegAtLat(latitude);
        let pixDis: number = 0;
        if (longRem > 0) {
            pixDis = (longRem * metersPerDeg) / metPerPix;
            if (longitude < longOrigin) {
                pixDis = -pixDis;
            }
        }
        return pixDis;
    }

    public static x2long(xPosition: number, scale: number, longOrigin: number, latitude: number, metPerPix: number): number {

        let metersPerDeg: number = GeoPixelConversion3D.GetMetersPerDegAtLat(latitude);
        let longitude: number = longOrigin;
        if (xPosition !== 0) {
            longitude = longOrigin + ((xPosition * metPerPix) / metersPerDeg);
        }
        return longitude;
    }


    public static Deg2Rad(deg: number): number {
        let conv_factor: number = (2.0 * Math.PI) / 360.0;
        return (deg * conv_factor);
    }

    public static GetMetersPerDegAtLat(lat: number): number {
        // Convert latitude to radians
        lat = GeoPixelConversion3D.Deg2Rad(lat);
        // Set up "Constants"
        let p1: number = 111412.84;		// longitude calculation term 1

        let p2: number = -93.5;			// longitude calculation term 2

        let p3: number = 0.118;			// longitude calculation term 3

        // Calculate the length of a degree of longitude in meters at given latitude
        let longlen: number = (p1 * Math.cos(lat)) + (p2 * Math.cos(3 * lat)) + (p3 * Math.cos(5 * lat));

        return longlen;
    }


}
