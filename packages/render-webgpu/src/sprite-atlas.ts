/**
 * Sprite Atlas
 *
 * Ikon sprite atlas yonetimi.
 * Shelf-first-fit bin packing ile sprite'lari 2D RGBA texture'a yerlestirir.
 * Baslangic boyutu 512x512, ihtiyac halinde 4096'ya kadar buyur.
 */

// ─── Types ───

export interface SpriteEntry {
  /** Atlas icerisindeki UV koordinatlari [u0, v0, u1, v1] */
  uv: [number, number, number, number];
  /** Sprite genisligi (piksel) */
  width: number;
  /** Sprite yuksekligi (piksel) */
  height: number;
  /** Atlas icerisindeki piksel koordinatlari */
  x: number;
  y: number;
}

// ─── Shelf ───

interface Shelf {
  y: number;
  height: number;
  nextX: number;
}

// ─── Constants ───

const INITIAL_SIZE = 512;
const MAX_SIZE = 4096;
const PADDING = 1;
const CHANNELS = 4; // RGBA

// ─── SpriteAtlas ───

export class SpriteAtlas {
  private sprites = new Map<string, SpriteEntry>();
  private shelves: Shelf[] = [];
  private _width: number;
  private _height: number;
  private data: Uint8Array;
  private dirty = false;

  // GPU resources
  private device: GPUDevice | null = null;
  private texture: GPUTexture | null = null;

  constructor(device?: GPUDevice) {
    this._width = INITIAL_SIZE;
    this._height = INITIAL_SIZE;
    this.data = new Uint8Array(this._width * this._height * CHANNELS);
    this.device = device ?? null;
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  get spriteCount(): number {
    return this.sprites.size;
  }

  get isDirty(): boolean {
    return this.dirty;
  }

  /**
   * Sprite ekle.
   * @param id Sprite tanimlayicisi
   * @param data RGBA piksel verisi (width * height * 4 bytes)
   * @param width Sprite genisligi
   * @param height Sprite yuksekligi
   * @returns Eklenen SpriteEntry veya null (yer yoksa)
   */
  addSprite(id: string, data: Uint8Array, width: number, height: number): SpriteEntry | null {
    // Zaten mevcut mu?
    const existing = this.sprites.get(id);
    if (existing) return existing;

    const spriteW = width + PADDING * 2;
    const spriteH = height + PADDING * 2;

    // Shelf-first-fit
    let placed = false;
    let placeX = 0;
    let placeY = 0;

    for (const shelf of this.shelves) {
      if (shelf.height >= spriteH && shelf.nextX + spriteW <= this._width) {
        placeX = shelf.nextX;
        placeY = shelf.y;
        shelf.nextX += spriteW;
        placed = true;
        break;
      }
    }

    if (!placed) {
      const shelfY = this.shelves.length > 0
        ? this.shelves[this.shelves.length - 1]!.y + this.shelves[this.shelves.length - 1]!.height
        : 0;

      if (shelfY + spriteH > this._height) {
        if (!this.grow()) {
          return null;
        }
      }

      const newShelfY = this.shelves.length > 0
        ? this.shelves[this.shelves.length - 1]!.y + this.shelves[this.shelves.length - 1]!.height
        : 0;

      if (newShelfY + spriteH > this._height) {
        return null;
      }

      const newShelf: Shelf = {
        y: newShelfY,
        height: spriteH,
        nextX: spriteW,
      };
      this.shelves.push(newShelf);
      placeX = 0;
      placeY = newShelfY;
    }

    // RGBA verisini atlas data'ya kopyala
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const srcBase = (row * width + col) * CHANNELS;
        const dstBase = ((placeY + PADDING + row) * this._width + (placeX + PADDING + col)) * CHANNELS;
        this.data[dstBase] = data[srcBase]!;
        this.data[dstBase + 1] = data[srcBase + 1]!;
        this.data[dstBase + 2] = data[srcBase + 2]!;
        this.data[dstBase + 3] = data[srcBase + 3]!;
      }
    }

    // UV hesapla
    const u0 = (placeX + PADDING) / this._width;
    const v0 = (placeY + PADDING) / this._height;
    const u1 = (placeX + PADDING + width) / this._width;
    const v1 = (placeY + PADDING + height) / this._height;

    const entry: SpriteEntry = {
      uv: [u0, v0, u1, v1],
      width,
      height,
      x: placeX + PADDING,
      y: placeY + PADDING,
    };

    this.sprites.set(id, entry);
    this.dirty = true;

    return entry;
  }

  /**
   * Sprite bilgilerini getir.
   */
  getSprite(id: string): SpriteEntry | undefined {
    return this.sprites.get(id);
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
   */
  private grow(): boolean {
    const newWidth = Math.min(this._width * 2, MAX_SIZE);
    const newHeight = Math.min(this._height * 2, MAX_SIZE);

    if (newWidth === this._width && newHeight === this._height) {
      return false;
    }

    const newData = new Uint8Array(newWidth * newHeight * CHANNELS);

    for (let row = 0; row < this._height; row++) {
      for (let col = 0; col < this._width; col++) {
        const srcBase = (row * this._width + col) * CHANNELS;
        const dstBase = (row * newWidth + col) * CHANNELS;
        newData[dstBase] = this.data[srcBase]!;
        newData[dstBase + 1] = this.data[srcBase + 1]!;
        newData[dstBase + 2] = this.data[srcBase + 2]!;
        newData[dstBase + 3] = this.data[srcBase + 3]!;
      }
    }

    this._width = newWidth;
    this._height = newHeight;
    this.data = newData;

    // UV'leri guncelle
    for (const [, entry] of this.sprites) {
      entry.uv[0] = entry.x / this._width;
      entry.uv[1] = entry.y / this._height;
      entry.uv[2] = (entry.x + entry.width) / this._width;
      entry.uv[3] = (entry.y + entry.height) / this._height;
    }

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

    if (this.texture && (this.texture.width !== this._width || this.texture.height !== this._height)) {
      this.texture.destroy();
      this.texture = null;
    }

    if (!this.texture) {
      this.texture = this.device.createTexture({
        label: 'sprite-atlas-texture',
        size: { width: this._width, height: this._height },
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      });
    }

    this.device.queue.writeTexture(
      { texture: this.texture },
      this.data.buffer as ArrayBuffer,
      { bytesPerRow: this._width * CHANNELS },
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
    this.sprites.clear();
    this.shelves = [];
    this.dirty = false;
  }
}
