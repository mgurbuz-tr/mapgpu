/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */



/**
 *
 *
 */
interface IPathIterator {
	//methods
	currentSegment(coords: number[]): number;
	currentSegment(coords: number[]): number;
	getWindingRule(): number;
	isDone(): boolean;
	next(): void;
}

// eslint-disable-next-line @typescript-eslint/no-namespace, no-redeclare
export namespace IPathIterator {
	export const SEG_CLOSE: number = 4;
	export const SEG_CUBICTO: number = 3;
	export const SEG_LINETO: number = 1;
	export const SEG_MOVETO: number = 0;
	export const SEG_QUADTO: number = 2;
	export const WIND_EVEN_ODD: number = 0;
	export const WIND_NON_ZERO: number = 1;
}


