import type { ICommand, Feature, Geometry } from '../../core/index.js';
import type { ITargetLayer } from './CreateFeatureCommand.js';

export class MoveFeatureCommand implements ICommand {
  readonly description: string;
  private readonly _oldGeometry: Geometry;

  constructor(
    private readonly _targetLayer: ITargetLayer,
    private readonly _feature: Feature,
    private readonly _deltaLon: number,
    private readonly _deltaLat: number,
  ) {
    this._oldGeometry = structuredClone(_feature.geometry) as Geometry;
    this.description = `Move feature ${String(_feature.id)}`;
  }

  execute(): void {
    this._offsetCoordinates(this._feature.geometry.coordinates, this._deltaLon, this._deltaLat);
    // Re-add to trigger refresh
    this._targetLayer.add({ ...this._feature });
  }

  undo(): void {
    this._feature.geometry = structuredClone(this._oldGeometry) as Geometry;
    this._targetLayer.add({ ...this._feature });
  }

  private _offsetCoordinates(coords: Geometry['coordinates'], dLon: number, dLat: number): void {
    if (!Array.isArray(coords) || coords.length === 0) return;

    if (typeof coords[0] === 'number') {
      const arr = coords as number[];
      arr[0] = (arr[0] ?? 0) + dLon;
      arr[1] = (arr[1] ?? 0) + dLat;
      return;
    }

    for (const sub of coords) {
      this._offsetCoordinates(sub as Geometry['coordinates'], dLon, dLat);
    }
  }
}
