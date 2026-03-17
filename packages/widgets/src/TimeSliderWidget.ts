/**
 * TimeSliderWidget — Temporal dimension control with play/pause/stop and speed settings.
 *
 * Uses HTML range input for time navigation.
 * Supports autoplay with configurable speed multiplier.
 */

import type { IView, WidgetPosition } from '@mapgpu/core';
import { WidgetBase } from './WidgetBase.js';

export interface TimeSliderWidgetOptions {
  id?: string;
  position?: WidgetPosition;
  min: Date;
  max: Date;
  value?: Date;
  step?: number;
}

export type PlaybackSpeed = 1 | 2 | 4;

export class TimeSliderWidget extends WidgetBase {
  private _min: Date;
  private _max: Date;
  private _value: Date;
  private _step: number;
  private _speed: PlaybackSpeed = 1;
  private _playing = false;
  private _playTimer: ReturnType<typeof setInterval> | null = null;

  private _sliderEl: HTMLInputElement | null = null;
  private _labelEl: HTMLSpanElement | null = null;
  private _playBtn: HTMLButtonElement | null = null;
  private _speedLabel: HTMLSpanElement | null = null;

  private _timeChangeHandlers = new Set<(date: Date) => void>();

  constructor(options: TimeSliderWidgetOptions) {
    super('timeslider', options);
    this._min = options.min;
    this._max = options.max;
    this._value = options.value ?? new Date(options.min.getTime());
    this._step = options.step ?? 86_400_000; // default: 1 day in ms
  }

  get min(): Date {
    return this._min;
  }

  get max(): Date {
    return this._max;
  }

  get value(): Date {
    return this._value;
  }

  get speed(): PlaybackSpeed {
    return this._speed;
  }

  get playing(): boolean {
    return this._playing;
  }

  setValue(date: Date): void {
    const clamped = new Date(
      Math.max(this._min.getTime(), Math.min(date.getTime(), this._max.getTime())),
    );
    this._value = clamped;
    this._updateSlider();
    this._emitTimeChange();
  }

  setSpeed(speed: PlaybackSpeed): void {
    this._speed = speed;
    if (this._speedLabel) {
      this._speedLabel.textContent = `${speed}x`;
    }
    // If currently playing, restart interval with new speed
    if (this._playing) {
      this._stopTimer();
      this._startTimer();
    }
  }

  play(): void {
    if (this._playing) return;
    this._playing = true;
    if (this._playBtn) {
      this._playBtn.textContent = 'Pause';
    }
    this._startTimer();
  }

  pause(): void {
    if (!this._playing) return;
    this._playing = false;
    if (this._playBtn) {
      this._playBtn.textContent = 'Play';
    }
    this._stopTimer();
  }

  stop(): void {
    this.pause();
    this._value = new Date(this._min.getTime());
    this._updateSlider();
    this._emitTimeChange();
  }

  onTimeChange(handler: (date: Date) => void): void {
    this._timeChangeHandlers.add(handler);
  }

  offTimeChange(handler: (date: Date) => void): void {
    this._timeChangeHandlers.delete(handler);
  }

  protected render(root: HTMLElement): void {
    root.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
    root.style.borderRadius = '4px';
    root.style.padding = '8px';
    root.style.fontFamily = 'sans-serif';
    root.style.fontSize = '13px';
    root.style.boxShadow = '0 1px 4px rgba(0,0,0,0.2)';
    root.style.minWidth = '260px';

    const title = document.createElement('div');
    title.textContent = 'Time Slider';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '6px';
    title.style.fontSize = '14px';
    root.appendChild(title);

    // Slider
    this._sliderEl = document.createElement('input');
    this._sliderEl.type = 'range';
    this._sliderEl.min = String(this._min.getTime());
    this._sliderEl.max = String(this._max.getTime());
    this._sliderEl.value = String(this._value.getTime());
    this._sliderEl.step = String(this._step);
    this._sliderEl.style.width = '100%';
    this._sliderEl.style.marginBottom = '6px';

    this._sliderEl.addEventListener('input', () => {
      const time = parseInt(this._sliderEl!.value, 10);
      this._value = new Date(time);
      this._updateLabel();
      this._emitTimeChange();
    });

    root.appendChild(this._sliderEl);

    // Label
    this._labelEl = document.createElement('span');
    this._labelEl.classList.add('time-label');
    this._labelEl.style.display = 'block';
    this._labelEl.style.textAlign = 'center';
    this._labelEl.style.marginBottom = '6px';
    this._labelEl.style.fontSize = '12px';
    this._updateLabel();
    root.appendChild(this._labelEl);

    // Controls row
    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.gap = '4px';
    controls.style.alignItems = 'center';

    this._playBtn = document.createElement('button');
    this._playBtn.textContent = 'Play';
    this._playBtn.classList.add('play-btn');
    this._playBtn.addEventListener('click', () => {
      if (this._playing) {
        this.pause();
      } else {
        this.play();
      }
    });
    controls.appendChild(this._playBtn);

    const stopBtn = document.createElement('button');
    stopBtn.textContent = 'Stop';
    stopBtn.classList.add('stop-btn');
    stopBtn.addEventListener('click', () => this.stop());
    controls.appendChild(stopBtn);

    // Speed control
    const speedBtn = document.createElement('button');
    speedBtn.textContent = 'Speed';
    speedBtn.classList.add('speed-btn');
    speedBtn.addEventListener('click', () => {
      const nextSpeed = this._speed === 1 ? 2 : this._speed === 2 ? 4 : 1;
      this.setSpeed(nextSpeed as PlaybackSpeed);
    });
    controls.appendChild(speedBtn);

    this._speedLabel = document.createElement('span');
    this._speedLabel.classList.add('speed-label');
    this._speedLabel.textContent = `${this._speed}x`;
    this._speedLabel.style.fontSize = '11px';
    this._speedLabel.style.color = '#666';
    controls.appendChild(this._speedLabel);

    root.appendChild(controls);
  }

  protected onViewBound(_view: IView): void {
    // no-op
  }

  protected onDestroy(): void {
    this._stopTimer();
    this._timeChangeHandlers.clear();
    this._sliderEl = null;
    this._labelEl = null;
    this._playBtn = null;
    this._speedLabel = null;
  }

  private _startTimer(): void {
    const intervalMs = 1000 / this._speed;
    this._playTimer = setInterval(() => {
      this._tick();
    }, intervalMs);
  }

  private _stopTimer(): void {
    if (this._playTimer !== null) {
      clearInterval(this._playTimer);
      this._playTimer = null;
    }
  }

  private _tick(): void {
    const nextTime = this._value.getTime() + this._step;
    if (nextTime > this._max.getTime()) {
      this.pause();
      return;
    }
    this._value = new Date(nextTime);
    this._updateSlider();
    this._emitTimeChange();
  }

  private _updateSlider(): void {
    if (this._sliderEl) {
      this._sliderEl.value = String(this._value.getTime());
    }
    this._updateLabel();
  }

  private _updateLabel(): void {
    if (this._labelEl) {
      this._labelEl.textContent = this._value.toISOString().slice(0, 10);
    }
  }

  private _emitTimeChange(): void {
    for (const handler of this._timeChangeHandlers) {
      handler(new Date(this._value.getTime()));
    }
  }
}
