/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */


import { AffineTransform } from "./AffineTransform"
import { PathIterator } from "./PathIterator"
import { Point2D } from "./Point2D"

import { Rectangle } from "./Rectangle"
import { Rectangle2D } from "./Rectangle2D"




/**
 *
 *
 */
export interface Shape {
      contains(x: number, y: number): boolean;
      contains(x: number, y: number, width: number, height: number): boolean;
      contains(pt: Point2D): boolean;
      getBounds2D(): Rectangle2D;
      getBounds(): Rectangle;
      intersects(x: number, y: number, w: number, h: number): boolean;
      intersects(rect: Rectangle2D): boolean;
      getPathIterator(at: AffineTransform | null): PathIterator;
}
