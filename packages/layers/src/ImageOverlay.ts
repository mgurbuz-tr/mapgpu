/**
 * ImageOverlay — Display a static image at geographic bounds (Leaflet L.imageOverlay equivalent).
 */

import type { Extent } from '@mapgpu/core';
import { LayerBase } from './LayerBase.js';
import type { LayerBaseOptions } from './LayerBase.js';

export interface ImageOverlayOptions extends LayerBaseOptions {
  /** URL of the image to display. */
  url: string;
  /** Geographic bounds as [minLon, minLat, maxLon, maxLat] in EPSG:4326. */
  bounds: [number, number, number, number];
}

export class ImageOverlay extends LayerBase {
  readonly type = 'image-overlay';
  readonly url: string;
  readonly bounds: [number, number, number, number];
  private _imageData: ImageBitmap | null = null;

  constructor(options: ImageOverlayOptions) {
    super(options);
    this.url = options.url;
    this.bounds = options.bounds;
  }

  protected async onLoad(): Promise<void> {
    const response = await fetch(this.url);
    const blob = await response.blob();
    this._imageData = await createImageBitmap(blob);
    this._fullExtent = {
      minX: this.bounds[0], minY: this.bounds[1],
      maxX: this.bounds[2], maxY: this.bounds[3],
      spatialReference: 'EPSG:4326',
    };
  }

  /** Get the loaded image bitmap for rendering. */
  get imageData(): ImageBitmap | null {
    return this._imageData;
  }

  /** Get the extent for this overlay. */
  get fullExtent(): Extent | undefined {
    return this._fullExtent;
  }

  /** Update the image URL and reload. */
  setUrl(url: string): void {
    (this as { url: string }).url = url;
    this.refresh();
  }

  /** Update the geographic bounds. */
  setBounds(bounds: [number, number, number, number]): void {
    (this as { bounds: [number, number, number, number] }).bounds = bounds;
    this._fullExtent = {
      minX: bounds[0], minY: bounds[1],
      maxX: bounds[2], maxY: bounds[3],
      spatialReference: 'EPSG:4326',
    };
    this.redraw();
  }
}
