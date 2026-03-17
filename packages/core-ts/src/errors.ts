/**
 * mapgpu Error Model
 *
 * Tüm async işlemler typed error döndürür.
 * Discriminated union pattern ile hata tipi kontrolü yapılır.
 */

export type MapError =
  | { kind: 'layer-load-failed'; layerId: string; cause: Error }
  | { kind: 'shader-compile-failed'; pipeline: string; log: string }
  | { kind: 'wasm-init-failed'; cause: Error }
  | { kind: 'webgpu-not-supported'; userAgent: string }
  | { kind: 'webgpu-device-lost'; reason: string; message: string }
  | { kind: 'service-unavailable'; url: string; status: number }
  | { kind: 'cors-blocked'; url: string }
  | { kind: 'crs-unsupported'; crs: string }
  | { kind: 'terrain-unavailable' }
  | { kind: 'los-out-of-bounds' }
  | { kind: 'unknown'; cause: Error };

export class MapGpuError extends Error {
  readonly error: MapError;

  constructor(error: MapError) {
    super(formatError(error));
    this.name = 'MapGpuError';
    this.error = error;
  }
}

function formatError(error: MapError): string {
  switch (error.kind) {
    case 'layer-load-failed':
      return `Layer "${error.layerId}" yüklenemedi: ${error.cause.message}`;
    case 'shader-compile-failed':
      return `Shader derleme hatası (${error.pipeline}): ${error.log}`;
    case 'wasm-init-failed':
      return `WASM başlatılamadı: ${error.cause.message}`;
    case 'webgpu-not-supported':
      return `WebGPU desteklenmiyor: ${error.userAgent}`;
    case 'webgpu-device-lost':
      return `GPU device kaybedildi (${error.reason}): ${error.message}`;
    case 'service-unavailable':
      return `Servis erişilemez: ${error.url} (${error.status})`;
    case 'cors-blocked':
      return `CORS engeli: ${error.url}`;
    case 'crs-unsupported':
      return `Desteklenmeyen CRS: ${error.crs}`;
    case 'terrain-unavailable':
      return 'Terrain verisi mevcut değil';
    case 'los-out-of-bounds':
      return 'LOS noktaları geçerli aralık dışında';
    case 'unknown':
      return `Bilinmeyen hata: ${error.cause.message}`;
  }
}
