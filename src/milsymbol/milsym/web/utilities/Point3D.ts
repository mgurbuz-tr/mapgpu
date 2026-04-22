import { Point2D } from "../../graphics/Point2D";

export class Point3D extends Point2D {
    public z: number;

    public constructor(pt: Point2D, z: number);
    public constructor(x: number, y: number, z: number);
    public constructor(...args: unknown[]) {

        switch (args.length) {
            case 0: {
                super();
                break;
            }

            case 2: {
                const [pt, z] = args as [Point2D, number];
                super(pt.x, pt.y);
                this.z = z;
                break;
            }

            case 3: {
                const [x, y, z] = args as [number, number, number];
                super(x, y);
                this.z = z;
                break;
            }

            default: {
                throw Error(`Invalid number of arguments`);
            }
        }
    }

    public getZ(): number {
        return this.z;
    }
}