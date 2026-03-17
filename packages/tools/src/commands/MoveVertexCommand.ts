import type { ICommand } from '@mapgpu/core';

export class MoveVertexCommand implements ICommand {
  readonly description: string;
  private _oldCoords: [number, number];

  constructor(
    private _vertices: [number, number][],
    private _index: number,
    private _newCoords: [number, number],
  ) {
    this._oldCoords = [...(_vertices[_index] ?? [0, 0])] as [number, number];
    this.description = `Move vertex ${_index} to [${_newCoords[0].toFixed(4)}, ${_newCoords[1].toFixed(4)}]`;
  }

  execute(): void {
    this._vertices[this._index] = [...this._newCoords] as [number, number];
  }

  undo(): void {
    this._vertices[this._index] = [...this._oldCoords] as [number, number];
  }
}
