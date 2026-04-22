/**
 * Glyph Atlas
 *
 * SDF (Signed Distance Field) glyph atlas yonetimi.
 * Shelf-first-fit bin packing ile glyph'leri 2D texture'a yerlestirir.
 * Baslangic boyutu 512x512, ihtiyac halinde 4096'ya kadar buyur.
 */

// ─── Types ───

export interface GlyphMetrics {
  /** Glyph genisligi (piksel) */
  width: number;
  /** Glyph yuksekligi (piksel) */
  height: number;
  /** Sol bearing (piksel) */
  bearingX: number;
  /** Ust bearing (piksel) */
  bearingY: number;
  /** Advance width (piksel) */
  advance: number;
}

export interface GlyphEntry {
  /** Atlas icerisindeki UV koordinatlari [u0, v0, u1, v1] */
  uv: [number, number, number, number];
  /** Glyph metrikleri */
  metrics: GlyphMetrics;
  /** Atlas icerisindeki piksel koordinatlari */
  x: number;
  y: number;
}

// ─── Shelf ───

interface Shelf {
  /** Shelf'in y baslangici */
  y: number;
  /** Shelf yuksekligi */
  height: number;
  /** Bir sonraki kullanilabilir x pozisyonu */
  nextX: number;
}

// ─── Constants ───

const INITIAL_SIZE = 512;
const MAX_SIZE = 4096;
const PADDING = 1;

// ─── GlyphAtlas ───

export class GlyphAtlas {
  private readonly glyphs = new Map<number, GlyphEntry>();
  private shelves: Shelf[] = [];
  private _width: number;
  private _height: number;
  private data: Uint8Array;
  private dirty = false;

  // GPU resources
  private readonly device: GPUDevice | null = null;
  private texture: GPUTexture | null = null;

  constructor(device?: GPUDevice) {
    this._width = INITIAL_SIZE;
    this._height = INITIAL_SIZE;
    this.data = new Uint8Array(this._width * this._height);
    this.device = device ?? null;
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  get glyphCount(): number {
    return this.glyphs.size;
  }

  get isDirty(): boolean {
    return this.dirty;
  }

  /**
   * SDF glyph ekle.
   * @param charCode Unicode character code
   * @param sdfData SDF bitmap verisi (width x height, single channel)
   * @param metrics Glyph metrikleri
   * @returns Eklenen GlyphEntry veya null (yer yoksa)
   */
  addGlyph(charCode: number, sdfData: Uint8Array, metrics: GlyphMetrics): GlyphEntry | null { // NOSONAR
    // Zaten mevcut mu?
    const existing = this.glyphs.get(charCode);
    if (existing) return existing;

    const glyphW = metrics.width + PADDING * 2;
    const glyphH = metrics.height + PADDING * 2;

    // Shelf-first-fit: mevcut shelf'lerde yer ara
    let placed = false;
    let placeX = 0;
    let placeY = 0;

    for (const shelf of this.shelves) {
      if (shelf.height >= glyphH && shelf.nextX + glyphW <= this._width) {
        placeX = shelf.nextX;
        placeY = shelf.y;
        shelf.nextX += glyphW;
        placed = true;
        break;
      }
    }

    // Yeni shelf olustur
    if (!placed) {
      const shelfY = this.shelves.length > 0
        ? this.shelves.at(-1)!.y + this.shelves.at(-1)!.height
        : 0;

      // Atlas'i buyutmek gerekiyor mu?
      if (shelfY + glyphH > this._height) {
        if (!this.grow()) {
          return null; // Maksimum boyuta ulasildi
        }
      }

      // Tekrar kontrol (grow sonrasi)
      const newShelfY = this.shelves.length > 0
        ? this.shelves.at(-1)!.y + this.shelves.at(-1)!.height
        : 0;

      if (newShelfY + glyphH > this._height) {
        return null;
      }

      const newShelf: Shelf = {
        y: newShelfY,
        height: glyphH,
        nextX: glyphW,
      };
      this.shelves.push(newShelf);
      placeX = 0;
      placeY = newShelfY;
    }

    // SDF verisini atlas data'ya kopyala (padding ile)
    for (let row = 0; row < metrics.height; row++) {
      for (let col = 0; col < metrics.width; col++) {
        const srcIdx = row * metrics.width + col;
        const dstIdx = (placeY + PADDING + row) * this._width + (placeX + PADDING + col);
        this.data[dstIdx] = sdfData[srcIdx]!;
      }
    }

    // UV hesapla
    const u0 = (placeX + PADDING) / this._width;
    const v0 = (placeY + PADDING) / this._height;
    const u1 = (placeX + PADDING + metrics.width) / this._width;
    const v1 = (placeY + PADDING + metrics.height) / this._height;

    const entry: GlyphEntry = {
      uv: [u0, v0, u1, v1],
      metrics,
      x: placeX + PADDING,
      y: placeY + PADDING,
    };

    this.glyphs.set(charCode, entry);
    this.dirty = true;

    return entry;
  }

  /**
   * Glyph bilgilerini getir.
   */
  getGlyph(charCode: number): GlyphEntry | undefined {
    return this.glyphs.get(charCode);
  }

  /**
   * GPU texture'i getir (lazy create + upload).
   */
  getTexture(): GPUTexture | null {
    if (!this.device) return null;

    if (!this.texture || this.dirty) {
      this.uploadToGPU();
    }

    return this.texture;
  }

  /**
   * Atlas'in ham verisini dondur (test icin).
   */
  getData(): Uint8Array {
    return this.data;
  }

  /**
   * Atlas'i 2x buyut (maks MAX_SIZE).
   * @returns Buyume basarili mi?
   */
  private grow(): boolean {
    const newWidth = Math.min(this._width * 2, MAX_SIZE);
    const newHeight = Math.min(this._height * 2, MAX_SIZE);

    if (newWidth === this._width && newHeight === this._height) {
      return false; // Zaten maksimum
    }

    const newData = new Uint8Array(newWidth * newHeight);

    // Mevcut veriyi kopyala
    for (let row = 0; row < this._height; row++) {
      for (let col = 0; col < this._width; col++) {
        newData[row * newWidth + col] = this.data[row * this._width + col]!;
      }
    }

    this._width = newWidth;
    this._height = newHeight;
    this.data = newData;

    // UV'leri guncelle (atlas boyutu degisti)
    for (const [, entry] of this.glyphs) {
      entry.uv[0] = entry.x / this._width;
      entry.uv[1] = entry.y / this._height;
      entry.uv[2] = (entry.x + entry.metrics.width) / this._width;
      entry.uv[3] = (entry.y + entry.metrics.height) / this._height;
    }

    // Eski texture'i yok et
    if (this.texture) {
      this.texture.destroy();
      this.texture = null;
    }

    this.dirty = true;
    return true;
  }

  /**
   * Atlas verisini GPU texture'a yukle.
   */
  private uploadToGPU(): void {
    if (!this.device) return;

    // Eski texture boyutu farkli mi?
    if (this.texture && (this.texture.width !== this._width || this.texture.height !== this._height)) {
      this.texture.destroy();
      this.texture = null;
    }

    this.texture ??= this.device.createTexture({
      label: 'glyph-atlas-texture',
      size: { width: this._width, height: this._height },
      format: 'r8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    this.device.queue.writeTexture(
      { texture: this.texture },
      this.data.buffer as ArrayBuffer,
      { bytesPerRow: this._width },
      { width: this._width, height: this._height },
    );

    this.dirty = false;
  }

  /**
   * Tum kaynaklari serbest birak.
   */
  destroy(): void {
    this.texture?.destroy();
    this.texture = null;
    this.glyphs.clear();
    this.shelves = [];
    this.dirty = false;
  }
}
