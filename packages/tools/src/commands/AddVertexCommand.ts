import type { ICommand } from '@mapgpu/core';

export class AddVertexCommand implements ICommand {
  readonly description: string;

  constructor(
    private _vertices: [number, number][],
    private _coords: [number, number],
    private _index?: number,
  ) {
    this.description = `Add vertex at [${_coords[0].toFixed(4)}, ${_coords[1].toFixed(4)}]`;
  }

  execute(): void {
    if (this._index !== undefined) {
      this._vertices.splice(this._index, 0, this._coords);
    } else {
      this._vertices.push(this._coords);
    }
  }

  undo(): void {
    const idx = this._index ?? this._vertices.length - 1;
    this._vertices.splice(idx, 1);
  }
}
