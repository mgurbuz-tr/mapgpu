import type { ICommand, Feature } from '@mapgpu/core';

/** Target layer interface — subset of GraphicsLayer. */
export interface ITargetLayer {
  add(feature: Feature): void;
  remove(id: string | number): boolean;
}

export class CreateFeatureCommand implements ICommand {
  readonly description: string;

  constructor(
    private _targetLayer: ITargetLayer,
    private _feature: Feature,
  ) {
    this.description = `Create ${_feature.geometry.type} feature`;
  }

  execute(): void {
    this._targetLayer.add(this._feature);
  }

  undo(): void {
    this._targetLayer.remove(this._feature.id);
  }
}
