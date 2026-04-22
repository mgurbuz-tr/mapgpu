import type { ICommand, Feature } from '../../core/index.js';

/** Target layer interface — subset of GraphicsLayer. */
export interface ITargetLayer {
  add(feature: Feature): void;
  remove(id: string | number): boolean;
}

export class CreateFeatureCommand implements ICommand {
  readonly description: string;

  constructor(
    private readonly _targetLayer: ITargetLayer,
    private readonly _feature: Feature,
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
