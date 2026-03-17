/**
 * Widget Interface Contract
 *
 * Framework-agnostic widget sözleşmesi.
 * Widgets Agent bu interface'i implement eder.
 */

export interface IView {
  readonly id: string;
  readonly type: '2d' | '3d';
}

export interface IWidget {
  /** Unique widget identifier */
  readonly id: string;

  /** Widget'ı DOM container'a bağla */
  mount(container: HTMLElement): void;

  /** Widget'ı DOM'dan kaldır */
  unmount(): void;

  /** Widget'ı bir view'a bağla (harita verisi/event akışı) */
  bind(view: IView): void;

  /** Widget'ı devre dışı bırak */
  destroy(): void;
}

export type WidgetPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'manual';
