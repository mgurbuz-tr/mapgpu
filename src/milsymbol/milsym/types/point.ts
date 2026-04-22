/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */





/**
 * Class to provide a Point object with a linestyle to facilitate drawing.
 *
 */
export class POINT2 {
  public x: number = 0;
  public y: number = 0;
  public style: number = 0;
  public segment: number = 0;
  public constructor();
  public constructor(pt: POINT2);
  public constructor(x: number, y: number);
  public constructor(x: number, y: number, style: number);
  public constructor(x: number, y: number, segment: number, style: number);
  public constructor(...args: unknown[]) {
    switch (args.length) {
      case 0: {

        this.x = 0;
        this.y = 0;
        this.style = 0;

        break;
      }

      case 1: {
        const [pt] = args as [POINT2];

        this.x = pt.x;
        this.y = pt.y;
        this.segment = pt.segment;
        this.style = pt.style;

        break;
      }

      case 2: {
        const [x, y] = args as [number, number];

        this.x = x;
        this.y = y;
        this.style = 0;

        break;
      }

      case 3: {
        const [x, y, style] = args as [number, number, number];

        this.x = x;
        this.y = y;
        this.style = style;

        break;
      }

      case 4: {
        const [x, y, segment, style] = args as [number, number, number, number];

        this.x = x;
        this.y = y;
        this.segment = segment;
        this.style = style;

        break;
      }

      default: {
        throw Error(`Invalid number of arguments`);
      }
    }
  }

  public getX() {
    return this.x;
  }

  public getY() {
    return this.y;
  }

}

