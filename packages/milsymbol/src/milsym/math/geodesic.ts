
import { Rectangle2D } from "../graphics/Rectangle2D"
import { POINT2 } from "../types/point"
import { ErrorLogger } from "../renderer/utilities/ErrorLogger"

/**
 * Class to calculate the geodesic based shapes for the Fire Support Areas
 *
 */
export class Geodesic {
    private static readonly _className: string = "Geodesic";
    private static readonly sm_a: number = 6378137;

    private static DegToRad(deg: number): number {
        return deg / 180.0 * Math.PI;
    }

    private static RadToDeg(rad: number): number {
        return rad / Math.PI * 180.0;
    }
    /**
     * Returns the azimuth from true north between two points
     * @param c1
     * @param c2
     * @return the azimuth from c1 to c2
     */
    public static GetAzimuth(c1: POINT2,
        c2: POINT2): number {//was private
        let theta: number = 0;
        try {
            let lat1: number = Geodesic.DegToRad(c1.y);
            let lon1: number = Geodesic.DegToRad(c1.x);
            let lat2: number = Geodesic.DegToRad(c2.y);
            let lon2: number = Geodesic.DegToRad(c2.x);
            //formula
            //θ = atan2( sin(Δlong).cos(lat2),
            //cos(lat1).sin(lat2) − sin(lat1).cos(lat2).cos(Δlong) )
            //var theta:Number = Math.atan2( Math.sin(lon2-lon1)*Math.cos(lat2),
            //Math.cos(lat1)*Math.sin(lat2) − Math.sin(lat1)*Math.cos(lat2)*Math.cos(lon2-lon1) );
            let y: number = Math.sin(lon2 - lon1);
            y *= Math.cos(lat2);
            let x: number = Math.cos(lat1);
            x *= Math.sin(lat2);
            let z: number = Math.sin(lat1);
            z *= Math.cos(lat2);
            z *= Math.cos(lon2 - lon1);
            x = x - z;
            theta = Math.atan2(y, x);
            theta = Geodesic.RadToDeg(theta);
        } catch (exc) {
            if (exc instanceof Error) {
                //console.log(e.message);
                //clsUtility.WriteFile("Error in Geodesic.GetAzimuth");
                ErrorLogger.LogException(Geodesic._className, "GetAzimuth",
                    exc);
            } else {
                throw exc;
            }
        }
        return theta;//RadToDeg(k);
    }
    /**
     * Calculates the distance in meters between two geodesic points.
     * Also calculates the azimuth from c1 to c2 and from c2 to c1.
     *
     * @param c1 the first point
     * @param c2 the last point
     * @param a12 OUT - an object with a member to hold the calculated azimuth in degrees from c1 to c2
     * @param a21 OUT - an object with a member to hold the calculated azimuth in degrees from c2 to c1
     * @return the distance in meters between c1 and c2
     */
    public static geodesic_distance(c1: POINT2,
        c2: POINT2): { distance: number, a12: number, a21: number } {
        let h: number = 0;
        let a12Val: number = 0;
        let a21Val: number = 0;
        try {
            //formula
            //R = earth's radius (mean radius = 6,371km)
            //Δlat = lat2− lat1
            //Δlong = long2− long1
            //a = sin²(Δlat/2) + cos(lat1).cos(lat2).sin²(Δlong/2)
            //c = 2.atan2(√a, √(1−a))
            //d = R.c
            //set the azimuth
            a12Val = Geodesic.GetAzimuth(c1, c2);
            a21Val = Geodesic.GetAzimuth(c2, c1);
            //c1.x+=360;
            let dLat: number = Geodesic.DegToRad(c2.y - c1.y);
            let dLon: number = Geodesic.DegToRad(c2.x - c1.x);

            let b: number = 0;
            let lat1: number = 0;
            let lat2: number = 0;
            let e: number = 0;
            let f: number = 0;
            let g: number = 0;
            let k: number = 0;
            b = Math.sin(dLat / 2);
            lat1 = Geodesic.DegToRad(c1.y);
            lat2 = Geodesic.DegToRad(c2.y);
            e = Math.sin(dLon / 2);
            f = Math.cos(lat1);
            g = Math.cos(lat2);
            //uncomment this to test calculation
            //var a:Number = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(DegToRad(c1.y)) * Math.cos(DegToRad(c2.y)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
            let a: number = b * b + f * g * e * e;
            h = Math.sqrt(a);
            k = Math.sqrt(1 - a);
            h = 2 * Math.atan2(h, k);
        } catch (exc) {
            if (exc instanceof Error) {
                //console.log(e.message);
                //clsUtility.WriteFile("Error in Geodesic.geodesic_distance");
                ErrorLogger.LogException(Geodesic._className, "geodesic_distance",
                    exc);
            } else {
                throw exc;
            }
        }
        return { distance: Geodesic.sm_a * h, a12: a12Val, a21: a21Val };
    }
    /**
     * Calculates a geodesic point and given distance and azimuth from the srating geodesic point
     *
     * @param start the starting point
     * @param distance the distance in meters
     * @param azimuth the azimuth or bearing in degrees
     *
     * @return the calculated point
     */
    public static geodesic_coordinate(start: POINT2,
        distance: number,
        azimuth: number): POINT2 {
        let pt: POINT2;
        try {
            //formula
            //lat2 = asin(sin(lat1)*cos(d/R) + cos(lat1)*sin(d/R)*cos(θ))
            //lon2 = lon1 + atan2(sin(θ)*sin(d/R)*cos(lat1), cos(d/R)−sin(lat1)*sin(lat2))

            let a: number = 0;
            let b: number = 0;
            let c: number = 0;
            let d: number = 0;
            let e: number = 0;
            let f: number = 0;
            let g: number = 0;
            let h: number = 0;
            let
                j: number = 0;
            let k: number = 0;
            let l: number = 0;
            let m: number = 0;
            let n: number = 0;
            let p: number = 0;
            let q: number = 0;

            a = Geodesic.DegToRad(start.y);
            b = Math.cos(a);
            c = Geodesic.DegToRad(azimuth);
            d = Math.sin(a);
            e = Math.cos(distance / Geodesic.sm_a);
            f = Math.sin(distance / Geodesic.sm_a);
            g = Math.cos(c);
            //uncomment to test calculation
            //var lat2:Number = RadToDeg(Math.asin(Math.sin(DegToRad(start.y)) * Math.cos(DegToRad(distance / sm_a)) + Math.cos(DegToRad(start.y)) * Math.sin(DegToRad(distance / sm_a)) * Math.cos(DegToRad(azimuth))));
            //lat2 = asin(sin(lat1)*cos(d/R) + cos(lat1)*sin(d/R)*cos(θ))
            //var lat2:Number = RadToDeg(Math.asin(Math.sin(DegToRad(start.y)) * Math.cos(distance / sm_a) + Math.cos(DegToRad(start.y)) * Math.sin(distance / sm_a) * Math.cos(DegToRad(azimuth))));
            //double lat2 = RadToDeg(Math.asin(Math.sin(DegToRad(start.y)) * Math.cos(distance / sm_a) + Math.cos(DegToRad(start.y)) * Math.sin(distance / sm_a) * Math.cos(DegToRad(azimuth))));
            let lat: number = Geodesic.RadToDeg(Math.asin(d * e + b * f * g));
            h = Math.sin(c);
            k = Math.sin(h);
            l = Math.cos(a);
            m = Geodesic.DegToRad(lat);
            n = Math.sin(m);
            p = Math.atan2(h * f * b, e - d * n);
            //uncomment to test calculation
            //var lon2:Number = start.x + DegToRad(Math.atan2(Math.sin(DegToRad(azimuth)) * Math.sin(DegToRad(distance / sm_a)) * Math.cos(DegToRad(start.y)), Math.cos(DegToRad(distance / sm_a)) - Math.sin(DegToRad(start.y)) * Math.sin(DegToRad(lat))));
            //lon2 = lon1 + atan2(sin(θ)*sin(d/R)*cos(lat1), cos(d/R)−sin(lat1)*sin(lat2))
            //var lon2:Number = start.x + RadToDeg(Math.atan2(Math.sin(DegToRad(azimuth)) * Math.sin(distance / sm_a) * Math.cos(DegToRad(start.y)), Math.cos(distance / sm_a) - Math.sin(DegToRad(start.y)) * Math.sin(DegToRad(lat2))));
            let lon: number = start.x + Geodesic.RadToDeg(p);
            pt = new POINT2(lon, lat);
        } catch (exc) {
            if (exc instanceof Error) {
                //clsUtility.WriteFile("Error in Geodesic.geodesic_distance");
                ErrorLogger.LogException(Geodesic._className, "geodesic_coordinate",
                    exc);
            } else {
                throw exc;
            }
        }
        return pt;
    }
    /**
     * Calculates an arc from geodesic point and uses them for the change 1 circular symbols
     *
     * @param pPoints array of 3 points, currently the last 2 points are the same. The first point
     * is the center and the next point defines the radius.
     *
     * @return points for the geodesic circle
     */
    public static GetGeodesicArc(pPoints: POINT2[]): Array<POINT2> | null {
        let pPoints2: Array<POINT2> = new Array();
        try {
            if (pPoints == null) {
                return null;
            }
            if (pPoints.length < 3) {
                return null;
            }

            let ptCenter: POINT2 = new POINT2(pPoints[0]);
            let pt1: POINT2 = new POINT2(pPoints[1]);
            let pt2: POINT2 = new POINT2(pPoints[2]);
            let ptTemp: POINT2;
            let dist2: number = 0.0;
            let dist1: number = 0.0;
            //distance and azimuth from the center to the 1st point
            const result1 = Geodesic.geodesic_distance(ptCenter, pt1);
            dist1 = result1.distance;
            let a12Val: number = result1.a12;
            let saveAzimuth: number = result1.a21;
            //distance and azimuth from the center to the 2nd point
            const result2 = Geodesic.geodesic_distance(ptCenter, pt2);
            dist2 = result2.distance;
            let a12bVal: number = result2.a12;
            let a21Val2: number = result2.a21;
            //if the points are nearly the same we want 360 degree range fan
            if (Math.abs(a21Val2 - saveAzimuth) <= 1) {
                if (a12Val < 360) {
                    a12Val += 360;
                }

                a12bVal = a12Val + 360;
            }

            let j: number = 0;
            if (a12bVal < 0) {
                a12bVal = 360 + a12bVal;
            }
            if (a12Val < 0) {
                a12Val = 360 + a12Val;
            }
            if (a12bVal < a12Val) {
                a12bVal = a12bVal + 360;
            }
            for (j = 0; j <= 100; j++) {

                let a12cVal: number = a12Val + (j as number / 100.0) * (a12bVal - a12Val);
                ptTemp = Geodesic.geodesic_coordinate(ptCenter, dist1, a12cVal);
                pPoints2.push(ptTemp);
            }

            //if the points are nearly the same we want 360 degree range fan
            //with no line from the center
            if (Math.abs(a21Val2 - saveAzimuth) > 1) {
                pPoints2.push(ptCenter);
            }

            if (a12Val < a12bVal) {
                pPoints2.push(pt1);
            } else {
                pPoints2.push(pt2);
            }
        } catch (exc) {
            if (exc instanceof Error) {
                //clsUtility.WriteFile("Error in Geodesic.GetGeodesicArc");
                ErrorLogger.LogException(Geodesic._className, "GetGeodesicArc",
                    exc);
            } else {
                throw exc;
            }
        }
        return pPoints2;
    }
    /**
     * Calculates the sector points for a sector range fan.
     *
     * @param pPoints array of 3 points. The first point
     * is the center and the next two points define either side of the sector
     * @param pPoints2 OUT - the calculated geodesic sector points
     *
     * @return true if the sector is a circle
     */
    public static GetGeodesicArc2(pPoints: Array<POINT2>,
        pPoints2: Array<POINT2>): boolean {
        let circle: boolean = false;
        try {
            let ptCenter: POINT2 = new POINT2(pPoints[0]);
            let pt1: POINT2 = new POINT2(pPoints[1]);
            let pt2: POINT2 = new POINT2(pPoints[2]);

            //double dist2 = 0d;
            let dist1: number = 0;
            //double lat2c = 0.0;
            //distance and azimuth from the center to the 1st point
            const result1 = Geodesic.geodesic_distance(ptCenter, pt1);
            dist1 = result1.distance;
            let a12Val: number = result1.a12;
            let saveAzimuth: number = result1.a21;
            //distance and azimuth from the center to the 2nd point
            const result2 = Geodesic.geodesic_distance(ptCenter, pt2);
            let dist2: number = result2.distance;
            let a12bVal: number = result2.a12;
            let a21Val2: number = result2.a21;
            //if the points are nearly the same we want 360 degree range fan
            if (Math.abs(a21Val2 - saveAzimuth) <= 1) {
                if (a12Val < 360) {
                    a12Val += 360;
                }
                a12bVal = a12Val + 360;
                circle = true;
            }

            //assume caller has set pPoints2 as new Array

            let j: number = 0;
            let pPoint: POINT2 = new POINT2();
            if (a12bVal < 0) {
                a12bVal = 360 + a12bVal;
            }
            if (a12Val < 0) {
                a12Val = 360 + a12Val;
            }
            if (a12bVal < a12Val) {
                a12bVal = a12bVal + 360;
            }
            for (j = 0; j <= 100; j++) {

                let a12cVal: number = a12Val + (j as number / 100) * (a12bVal - a12Val);
                pPoint = Geodesic.geodesic_coordinate(ptCenter, dist1, a12cVal);
                pPoints2.push(pPoint);
            }
        } catch (exc) {
            if (exc instanceof Error) {
                //console.log(e.message);
                //clsUtility.WriteFile("Error in Geodesic.GetGeodesicArc2");
                ErrorLogger.LogException(Geodesic._className, "GetGeodesicArc2",
                    exc);
            } else {
                throw exc;
            }
        }
        return circle;
    }
    /**
     * returns intersection of two lines, each defined by a point and a bearing
     * <a href="http://creativecommons.org/licenses/by/3.0/"><img alt="Creative Commons License" style="border-width:0" src="http://i.creativecommons.org/l/by/3.0/88x31.png"></a><br>This work is licensed under a <a href="http://creativecommons.org/licenses/by/3.0/">Creative Commons Attribution 3.0 Unported License</a>.
     * @param p1 1st point
     * @param brng1 first line bearing in degrees from true north
     * @param p2 2nd point
     * @param brng2 2nd point bearing in degrees from true north
     * @return
     * @deprecated
     */
    public static IntersectLines(p1: POINT2,
        brng1: number,
        p2: POINT2,
        brng2: number): POINT2 | null {
        let ptResult: POINT2;
        try {
            let lat1: number = Geodesic.DegToRad(p1.y);//p1._lat.toRad();
            let lon1: number = Geodesic.DegToRad(p1.x);//p1._lon.toRad();
            let lat2: number = Geodesic.DegToRad(p2.y);//p2._lat.toRad();
            let lon2: number = Geodesic.DegToRad(p2.x);//p2._lon.toRad();
            let brng13: number = Geodesic.DegToRad(brng1);//brng1.toRad();
            let brng23: number = Geodesic.DegToRad(brng2);//brng2.toRad();
            let dLat: number = lat2 - lat1;
            let dLon: number = lon2 - lon1;


            let dist12: number = 2 * Math.asin(Math.sqrt(Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2)));

            if (dist12 === 0) {
                return null;
            }

            let brngA: number = Math.acos((Math.sin(lat2) - Math.sin(lat1) * Math.cos(dist12)) /
                (Math.sin(dist12) * Math.cos(lat1)));

            if (Number.isNaN(brngA)) {
                brngA = 0;  // protect against rounding
            }
            let brngB: number = Math.acos((Math.sin(lat1) - Math.sin(lat2) * Math.cos(dist12)) /
                (Math.sin(dist12) * Math.cos(lat2)));

            let brng12: number = 0;
            let brng21: number = 0;
            if (Math.sin(lon2 - lon1) > 0) {
                brng12 = brngA;
                brng21 = 2 * Math.PI - brngB;
            } else {
                brng12 = 2 * Math.PI - brngA;
                brng21 = brngB;
            }

            let alpha1: number = (brng13 - brng12 + Math.PI) % (2 * Math.PI) - Math.PI;  // angle 2-1-3
            let alpha2: number = (brng21 - brng23 + Math.PI) % (2 * Math.PI) - Math.PI;  // angle 1-2-3

            if (Math.sin(alpha1) === 0 && Math.sin(alpha2) === 0) {
                return null;  // infinite intersections
            }
            if (Math.sin(alpha1) * Math.sin(alpha2) < 0) {
                return null;       // ambiguous intersection
            }
            //alpha1 = Math.abs(alpha1);
            //alpha2 = Math.abs(alpha2);  // ... Ed Williams takes abs of alpha1/alpha2, but seems to break calculation?
            let alpha3: number = Math.acos(-Math.cos(alpha1) * Math.cos(alpha2) +
                Math.sin(alpha1) * Math.sin(alpha2) * Math.cos(dist12));

            let dist13: number = Math.atan2(Math.sin(dist12) * Math.sin(alpha1) * Math.sin(alpha2),
                Math.cos(alpha2) + Math.cos(alpha1) * Math.cos(alpha3));

            let lat3: number = Math.asin(Math.sin(lat1) * Math.cos(dist13) +
                Math.cos(lat1) * Math.sin(dist13) * Math.cos(brng13));
            let dLon13: number = Math.atan2(Math.sin(brng13) * Math.sin(dist13) * Math.cos(lat1),
                Math.cos(dist13) - Math.sin(lat1) * Math.sin(lat3));
            let lon3: number = lon1 + dLon13;
            lon3 = (lon3 + Math.PI) % (2 * Math.PI) - Math.PI;  // normalise to -180..180º

            //return new POINT2(lat3.toDeg(), lon3.toDeg());
            ptResult = new POINT2(Geodesic.RadToDeg(lon3), Geodesic.RadToDeg(lat3));

        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(Geodesic._className, "IntersectLines",
                    exc);
            } else {
                throw exc;
            }
        }
        return ptResult;
    }
    /**
     * Normalizes geo points for arrays which span the IDL
     *
     * @param geoPoints
     * @return
     */
    public static normalize_points(geoPoints: Array<POINT2>): Array<POINT2> {
        let normalizedPts: Array<POINT2>;
        try {
            if (geoPoints == null || geoPoints.length === 0) {
                return normalizedPts;
            }

            let j: number = 0;
            let minx: number = geoPoints[0].x;
            let maxx: number = minx;
            let spansIDL: boolean = false;
            let pt: POINT2;
            let n: number = geoPoints.length;
            //for (j = 1; j < geoPoints.length; j++)
            for (j = 1; j < n; j++) {
                pt = geoPoints[j];
                if (pt.x < minx) {
                    minx = pt.x;
                }
                if (pt.x > maxx) {
                    maxx = pt.x;
                }
            }
            if (maxx - minx > 180) {
                spansIDL = true;
            }

            if (!spansIDL) {
                return geoPoints;
            }

            normalizedPts = new Array();
            n = geoPoints.length;
            //for (j = 0; j < geoPoints.length; j++)
            for (j = 0; j < n; j++) {
                pt = geoPoints[j];
                if (pt.x < 0) {
                    pt.x += 360;
                }
                normalizedPts.push(pt);
            }
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(Geodesic._className, "normalize_pts",
                    exc);
            } else {
                throw exc;
            }
        }
        return normalizedPts;
    }

    /**
     * calculates the geodesic MBR, intended for regular shaped areas
     *
     * @param geoPoints
     * @return
     */
    public static geodesic_mbr(geoPoints: Array<POINT2>): Rectangle2D | null {
        let rect2d: Rectangle2D;
        try {
            if (geoPoints == null || geoPoints.length === 0) {
                return null;
            }

            let normalizedPts: Array<POINT2> = Geodesic.normalize_points(geoPoints);
            let ulx: number = normalizedPts[0].x;
            let lrx: number = ulx;
            let uly: number = normalizedPts[0].y;
            let lry: number = uly;
            let j: number = 0;
            let pt: POINT2;
            let n: number = normalizedPts.length;
            //for(j=1;j<normalizedPts.length;j++)
            for (j = 1; j < n; j++) {
                pt = normalizedPts[j];
                if (pt.x < ulx) {

                    ulx = pt.x;
                }

                if (pt.x > lrx) {

                    lrx = pt.x;
                }


                if (pt.y > uly) {

                    uly = pt.y;
                }

                if (pt.y < lry) {

                    lry = pt.y;
                }

            }
            let ul: POINT2 = new POINT2(ulx, uly);
            let ur: POINT2 = new POINT2(lrx, uly);
            let lr: POINT2 = new POINT2(lrx, lry);
            let width: number = Geodesic.geodesic_distance(ul, ur).distance;
            let height: number = Geodesic.geodesic_distance(ur, lr).distance;
            rect2d = new Rectangle2D(ulx, uly, width, height);
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(Geodesic._className, "geodesic_mbr",
                    exc);
            } else {
                throw exc;
            }
        }
        return rect2d;
    }

    /**
     * Currently used by AddModifiers for greater accuracy on center labels
     *
     * @param geoPoints
     * @return
     */
    public static geodesic_center(geoPoints: Array<POINT2>): POINT2 | null {
        let pt: POINT2;
        try {
            if (geoPoints == null || geoPoints.length === 0) {
                return null;
            }


            let rect2d: Rectangle2D = Geodesic.geodesic_mbr(geoPoints);
            let deltax: number = rect2d.getWidth() / 2;
            let deltay: number = rect2d.getHeight() / 2;
            let ul: POINT2 = new POINT2(rect2d.x, rect2d.y);
            //first walk east by deltax
            let ptEast: POINT2 = Geodesic.geodesic_coordinate(ul, deltax, 90);
            //next walk south by deltay;
            pt = Geodesic.geodesic_coordinate(ptEast, deltay, 180);

        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(Geodesic._className, "geodesic_center",
                    exc);
            } else {
                throw exc;
            }
        }
        return pt;
    }
    /**
     * rotates a point from a center point in degrees
     * @param ptCenter center point to rotate about
     * @param ptRotate point to rotate
     * @param rotation rotation angle in degrees
     * @return
     */
    private static geoRotatePoint(ptCenter: POINT2, ptRotate: POINT2, rotation: number): POINT2 | null {
        try {
            let bearing: number = Geodesic.GetAzimuth(ptCenter, ptRotate);
            let dist: number = Geodesic.geodesic_distance(ptCenter, ptRotate).distance;
            return Geodesic.geodesic_coordinate(ptCenter, dist, bearing + rotation);
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(Geodesic._className, "geoRotatePoint",
                    exc);
            } else {
                throw exc;
            }
        }
        return null;
    }
    /**
     * Calculates points for a geodesic ellipse and rotates the points by rotation
     * @param ptCenter
     * @param majorRadius
     * @param minorRadius
     * @param rotation  rotation angle in degrees
     * @return
     */
    public static getGeoEllipse(ptCenter: POINT2, majorRadius: number, minorRadius: number, rotation: number): POINT2[] {
        let pEllipsePoints: POINT2[];
        try {
            pEllipsePoints = new Array<POINT2>(37);
            //int l=0;
            let pt: POINT2;
            let dFactor: number = 0;
            let azimuth: number = 0;
            let a: number = 0;
            let b: number = 0;
            let dist: number = 0;
            let bearing: number = 0;
            let ptLongitude: POINT2;
            let ptLatitude: POINT2;
            for (let l: number = 1; l < 37; l++) {
                dFactor = (10.0 * l) * Math.PI / 180.0;
                a = majorRadius * Math.cos(dFactor);
                b = minorRadius * Math.sin(dFactor);
                //dist=Math.sqrt(a*a+b*b);
                //azimuth = (10.0 * l);// * Math.PI / 180.0;
                //azimuth=90-azimuth;
                //pt = geodesic_coordinate(ptCenter,dist,azimuth);
                //pt = geodesic_coordinate(ptCenter,dist,azimuth);
                ptLongitude = Geodesic.geodesic_coordinate(ptCenter, a, 90);
                ptLatitude = Geodesic.geodesic_coordinate(ptCenter, b, 0);
                //pt=new POINT2(ptLatitude.x,ptLongitude.y);
                pt = new POINT2(ptLongitude.x, ptLatitude.y);
                //pEllipsePoints[l-1]=pt;
                pEllipsePoints[l - 1] = Geodesic.geoRotatePoint(ptCenter, pt, -rotation);
            }
            pEllipsePoints[36] = new POINT2(pEllipsePoints[0]);
        } catch (exc) {
            if (exc instanceof Error) {
                ErrorLogger.LogException(Geodesic._className, "GetGeoEllipse",
                    exc);
            } else {
                throw exc;
            }
        }
        return pEllipsePoints;
    }
}
