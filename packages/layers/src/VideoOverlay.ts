/**
 * VideoOverlay — Display a video element at geographic bounds (Leaflet L.videoOverlay equivalent).
 */

import type { Extent } from '@mapgpu/core';
import { LayerBase } from './LayerBase.js';
import type { LayerBaseOptions } from './LayerBase.js';

export interface VideoOverlayOptions extends LayerBaseOptions {
  /** URL(s) of the video. Multiple for format fallback. */
  url: string | string[];
  /** Geographic bounds as [minLon, minLat, maxLon, maxLat] in EPSG:4326. */
  bounds: [number, number, number, number];
  /** Autoplay the video. Default: true. */
  autoplay?: boolean;
  /** Loop the video. Default: true. */
  loop?: boolean;
  /** Mute the video. Default: true. */
  muted?: boolean;
}

export class VideoOverlay extends LayerBase {
  readonly type = 'video-overlay';
  readonly bounds: [number, number, number, number];
  private _video: HTMLVideoElement | null = null;
  private _urls: string[];
  private _autoplay: boolean;
  private _loop: boolean;
  private _muted: boolean;

  constructor(options: VideoOverlayOptions) {
    super(options);
    this._urls = Array.isArray(options.url) ? options.url : [options.url];
    this.bounds = options.bounds;
    this._autoplay = options.autoplay ?? true;
    this._loop = options.loop ?? true;
    this._muted = options.muted ?? true;
  }

  protected async onLoad(): Promise<void> {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    video.autoplay = this._autoplay;
    video.loop = this._loop;
    video.muted = this._muted;

    for (const url of this._urls) {
      const source = document.createElement('source');
      source.src = url;
      video.appendChild(source);
    }

    await new Promise<void>((resolve, reject) => {
      video.addEventListener('loadeddata', () => resolve(), { once: true });
      video.addEventListener('error', () => reject(new Error('Video load failed')), { once: true });
      video.load();
    });

    this._video = video;
    this._fullExtent = {
      minX: this.bounds[0], minY: this.bounds[1],
      maxX: this.bounds[2], maxY: this.bounds[3],
      spatialReference: 'EPSG:4326',
    };

    if (this._autoplay) video.play().catch(() => { /* autoplay may be blocked */ });
  }

  /** Get the underlying HTMLVideoElement. */
  get videoElement(): HTMLVideoElement | null {
    return this._video;
  }

  /** Play the video. */
  play(): void { this._video?.play(); }

  /** Pause the video. */
  pause(): void { this._video?.pause(); }

  get fullExtent(): Extent | undefined { return this._fullExtent; }
}
