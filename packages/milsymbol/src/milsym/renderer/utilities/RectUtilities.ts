
import { Rectangle } from "../../graphics/Rectangle"
import { Rectangle2D } from "../../graphics/Rectangle2D"
import { Rectangle as Rect } from "../shapes/rectangle";

export class RectUtilities {

	public static makeRectangleFromRect(x1: number, y1: number, x2: number, y2: number): Rectangle {
		return new Rectangle(x1, y1, x2 - x1, y2 - y1);
	}

	public static makeRectangle2DFromRect(x1: number, y1: number, x2: number, y2: number): Rectangle2D {
		return new Rectangle2D(x1, y1, x2 - x1, y2 - y1);
	}



	/**
	 * Copies a Rectangle
	 * @param rect {@link Rectangle2D}
	 * @return {@link Rectangle2D}
	 */
	public static copyRect(rect: Rectangle2D): Rectangle2D {
		return new Rectangle2D(Math.floor(rect.getX()), Math.floor(rect.getY()), Math.ceil(rect.getWidth()), Math.ceil(rect.getHeight()));
	}

	/**
	 * copies and rounds the points.  x,y round down &amp; width,height round up
	 * @param rect {@link Rectangle2D}
	 * @return {@link Rectangle2D}
	 */
	public static roundRect(rect: Rectangle2D): Rectangle2D {
		let offsetX: number = rect.getX() - (rect.getX()) as number;
		let offsetY: number = rect.getY() - (rect.getY()) as number;

		return new Rectangle2D(rect.getX() as number, rect.getY() as number, (Math.round(rect.getWidth() + offsetX + 0.5)) as number, Math.round(rect.getHeight() + offsetY + 0.5) as number);
	}

	public static grow(rect: Rectangle2D, size: number): void {
		rect.setRect(rect.getX() - size, rect.getY() - size, rect.getWidth() + (size * 2), rect.getHeight() + (size * 2));
		//return new Rectangle2D(rect.left - size, rect.top - size, rect.right + size, rect.bottom + size);
	}


	public static shift(rect: Rectangle2D, x: number, y: number): void {
		rect.setRect(rect.getX() + x, rect.getY() + y, rect.getWidth(), rect.getHeight());
	}


	public static shiftBR(rect: Rectangle2D, x: number, y: number): void {
		rect.setRect(rect.getX(), rect.getY(), rect.getWidth() + x, rect.getHeight() + y);
	}

	public static toRectangle(b: Rectangle2D): Rectangle;

	public static toRectangle(x: number, y: number, w: number, h: number): Rectangle;
	public static toRectangle(...args: unknown[]): Rectangle | null {
		switch (args.length) {
			case 1: {
				const [b] = args as [Rectangle2D];


				if (b == null) {
					return null;
				}/*from w ww . j a  va 2s . c o  m*/
				if (b instanceof Rectangle) {
					return b as Rectangle;
				} else {
					return new Rectangle(b.getX() as number, b.getY() as number,
						b.getWidth() as number, b.getHeight() as number);
				}
				
			}

			case 4: {
				const [x, y, w, h] = args as [number, number, number, number];

				return new Rectangle(x as number, y as number,w as number, h as number);
			}

			default: {
				throw Error(`Invalid number of arguments`);
			}
		}
	}

	public static toRectangle2D(b: Rectangle): Rectangle2D;
	public static toRectangle2D(x: number, y: number, w: number, h: number): Rectangle2D;
	public static toRectangle2D(...args: unknown[]): Rectangle2D | null {
		switch (args.length) {
			case 1: {
				const [b] = args as [Rectangle];


				if (b == null) {
					return null;
				}/*from w ww . j a  va 2s . c o  m*/
				else 
				{
					return new Rectangle2D(b.getX(), b.getY(),b.getWidth(), b.getHeight());
				}
				
			}

			case 4: {
				const [x, y, w, h] = args as [number, number, number, number];

				return new Rectangle2D(x as number, y as number,w as number, h as number);
			}

			default: {
				throw Error(`Invalid number of arguments`);
			}
		}
	}

}