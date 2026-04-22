/**
 * Label Engine
 *
 * Label yerlesim motoru — grid-based collision detection ile
 * cakisan label'lari gizler, priority sirasina gore yerlestirir.
 */

// ─── Types ───

export interface LabelInput {
  /** Benzersiz tanimlayici */
  id: string;
  /** Ekran konumu (piksel, sol-ust kose referansi) */
  screenX: number;
  screenY: number;
  /** Label genisligi (piksel) */
  width: number;
  /** Label yuksekligi (piksel) */
  height: number;
  /** Oncelik (yuksek = daha onemli, once yerlestirilir) */
  priority: number;
}

export interface LabelPlacement {
  /** Label ID */
  id: string;
  /** Yerlestirilen ekran konumu X */
  screenX: number;
  /** Yerlestirilen ekran konumu Y */
  screenY: number;
  /** Label gorunur mu? */
  visible: boolean;
}

export interface Viewport {
  width: number;
  height: number;
}

// ─── Grid Cell ───

interface GridCell {
  labels: LabelPlacement[];
}

// ─── Constants ───

const DEFAULT_CELL_SIZE = 64;

// ─── LabelEngine ───

export class LabelEngine {
  private readonly cellSize: number;

  constructor(cellSize: number = DEFAULT_CELL_SIZE) {
    this.cellSize = cellSize;
  }

  /**
   * Label'lari viewport icerisine yerlestir, cakisanlari gizle.
   * @param labels Yerlestirilecek label'lar
   * @param viewport Viewport boyutlari
   * @returns Yerlestirme sonuclari (her label icin)
   */
  layoutLabels(labels: readonly LabelInput[], viewport: Viewport): LabelPlacement[] { // NOSONAR
    // Priority'ye gore sirala (yuksek once)
    const sorted = [...labels].sort((a, b) => b.priority - a.priority);

    // Grid olustur
    const cols = Math.ceil(viewport.width / this.cellSize);
    const rows = Math.ceil(viewport.height / this.cellSize);
    const grid: GridCell[][] = [];
    for (let r = 0; r < rows; r++) {
      grid[r] = [];
      for (let c = 0; c < cols; c++) {
        grid[r]![c] = { labels: [] };
      }
    }

    const results: LabelPlacement[] = [];
    const placedRects: Array<{ x: number; y: number; w: number; h: number }> = [];

    for (const label of sorted) {
      const placement: LabelPlacement = {
        id: label.id,
        screenX: label.screenX,
        screenY: label.screenY,
        visible: true,
      };

      // Viewport disinda mi?
      if (
        label.screenX + label.width < 0 ||
        label.screenX > viewport.width ||
        label.screenY + label.height < 0 ||
        label.screenY > viewport.height
      ) {
        placement.visible = false;
        results.push(placement);
        continue;
      }

      // Grid cell araligi hesapla
      const colMin = Math.max(0, Math.floor(label.screenX / this.cellSize));
      const colMax = Math.min(cols - 1, Math.floor((label.screenX + label.width) / this.cellSize));
      const rowMin = Math.max(0, Math.floor(label.screenY / this.cellSize));
      const rowMax = Math.min(rows - 1, Math.floor((label.screenY + label.height) / this.cellSize));

      // Cakisma kontrolu
      let collides = false;
      for (const placed of placedRects) {
        if (this.rectsOverlap(
          label.screenX, label.screenY, label.width, label.height,
          placed.x, placed.y, placed.w, placed.h,
        )) {
          collides = true;
          break;
        }
      }

      if (collides) {
        placement.visible = false;
      } else {
        // Grid'e kaydet
        for (let r = rowMin; r <= rowMax; r++) {
          for (let c = colMin; c <= colMax; c++) {
            grid[r]![c]!.labels.push(placement);
          }
        }
        placedRects.push({
          x: label.screenX,
          y: label.screenY,
          w: label.width,
          h: label.height,
        });
      }

      results.push(placement);
    }

    return results;
  }

  /**
   * Iki AABB'nin cakisip cakismadigini kontrol et.
   */
  private rectsOverlap( // NOSONAR
    x1: number, y1: number, w1: number, h1: number,
    x2: number, y2: number, w2: number, h2: number,
  ): boolean {
    return !(
      x1 + w1 <= x2 ||
      x2 + w2 <= x1 ||
      y1 + h1 <= y2 ||
      y2 + h2 <= y1
    );
  }
}
