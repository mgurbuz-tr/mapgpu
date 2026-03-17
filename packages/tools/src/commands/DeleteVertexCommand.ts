import type { ICommand } from '@mapgpu/core';

export class DeleteVertexCommand implements ICommand {
  readonly description: string;
  private _removedCoords: [number, number] | null = null;

  constructor(
    private _vertices: [number, number][],
    private _index: number,
  ) {
    this.description = `Delete vertex at index ${_index}`;
  }

  execute(): void {
    this._removedCoords = this._vertices[this._index] ?? null;
    this._vertices.splice(this._index, 1);
  }

  undo(): void {
    if (this._removedCoords) {
      this._vertices.splice(this._index, 0, this._removedCoords);
    }
  }
}
