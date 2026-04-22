import type { ICommand } from '../../core/index.js';

export class AddVertexCommand implements ICommand {
  readonly description: string;

  constructor(
    private readonly _vertices: [number, number][],
    private readonly _coords: [number, number],
    private readonly _index?: number,
  ) {
    this.description = `Add vertex at [${_coords[0].toFixed(4)}, ${_coords[1].toFixed(4)}]`;
  }

  execute(): void {
    if (this._index === undefined) {
      this._vertices.push(this._coords);
    } else {
      this._vertices.splice(this._index, 0, this._coords);
    }
  }

  undo(): void {
    const idx = this._index ?? this._vertices.length - 1;
    this._vertices.splice(idx, 1);
  }
}
