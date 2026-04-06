/**
 * PlaceGeometryTool — Interactive 3D geometry placement (Blender-style).
 *
 * Phase 1 (sizing):    Click + drag → radius (footprint preview)
 * Phase 2 (extruding): Release → move mouse up/down → real-time 3D mesh height
 * Confirm:             Click or Enter → finalize geometry
 * Cancel:              Escape at any phase
 *
 * During extrusion phase, a live 3D mesh preview is rendered via a temporary
 * GraphicsLayer with Mesh3DSymbol — updates every mouse move.
 */

import type { ToolPointerEvent, ToolContext, Feature } from '@mapgpu/core';
import { ToolBase } from './ToolBase.js';
import { CreateFeatureCommand } from './commands/CreateFeatureCommand.js';
import type { ITargetLayer } from './commands/CreateFeatureCommand.js';
import { generateFeatureId } from './helpers/geometryHelpers.js';
import { makeRectFootprint, makeCircleFootprint, distanceMeters } from './helpers/footprintGenerators.js';

export type PlaceableGeometryType = 'box' | 'cylinder' | 'sphere' | 'cone';

export interface PlaceGeometryToolOptions {
  targetLayer: ITargetLayer;
  geometryType?: PlaceableGeometryType;
  color?: [number, number, number, number];
  /** Pixels-to-meters ratio for height extrusion. Default: 2 (2m per pixel). */
  heightSensitivity?: number;
}

export const GEOMETRY_MODEL_IDS: Record<PlaceableGeometryType, string> = {
  box: '__geo-box__',
  cylinder: '__geo-cylinder__',
  sphere: '__geo-sphere__',
  cone: '__geo-cone__',
};

type Phase = 'idle' | 'sizing' | 'extruding';

/**
 * Callback fired during extrusion phase on every mouse move.
 * Consumers should update a temporary layer's renderer with the new scale.
 */
export type ExtrusionPreviewCallback = (center: [number, number], radius: number, height: number, geometryType: PlaceableGeometryType) => void;

export class PlaceGeometryTool extends ToolBase {
  readonly id = 'place-geometry';
  readonly name = 'Place Geometry';

  private _targetLayer: ITargetLayer;
  private _geometryType: PlaceableGeometryType;
  color: [number, number, number, number];
  private _heightSensitivity: number;

  private _phase: Phase = 'idle';
  private _center: [number, number] | null = null;
  private _radiusM: number = 0;
  private _heightM: number = 0;
  private _extrudeAnchorY: number = 0;

  /** External callback for live 3D preview during extrusion. */
  onExtrusionPreview: ExtrusionPreviewCallback | null = null;

  constructor(options: PlaceGeometryToolOptions) {
    super();
    this._targetLayer = options.targetLayer;
    this._geometryType = options.geometryType ?? 'cylinder';
    this.color = options.color ?? [88, 166, 255, 220];
    this._heightSensitivity = options.heightSensitivity ?? 2;
  }

  setGeometryType(type: PlaceableGeometryType): void { this._geometryType = type; }
  setColor(color: [number, number, number, number]): void { this.color = color; }
  get geometryType(): PlaceableGeometryType { return this._geometryType; }
  get phase(): Phase { return this._phase; }
  get currentRadius(): number { return this._radiusM; }
  get currentHeight(): number { return this._heightM; }

  protected override onActivate(_context: ToolContext): void {
    this._cursor = 'crosshair';
    this._reset();
  }

  protected override onDeactivate(): void {
    this._reset();
    this._context?.previewLayer.clear();
  }

  onPointerDown(e: ToolPointerEvent): boolean {
    if (!e.mapCoords || !this._context) return false;

    if (this._phase === 'idle') {
      // Phase 1 start: set center
      this._center = [...e.mapCoords] as [number, number];
      this._radiusM = 0;
      this._heightM = 0;
      this._phase = 'sizing';
      this._state = 'drawing';
      this._cursor = 'move';
      this._updatePreview();
      return true;
    }

    if (this._phase === 'extruding') {
      // Confirm: create feature
      this._createFeature();
      return true;
    }

    return false;
  }

  onPointerMove(e: ToolPointerEvent): boolean {
    if (!this._context || !this._center) return false;

    if (this._phase === 'sizing' && e.mapCoords) {
      this._radiusM = Math.max(
        distanceMeters(this._center[0], this._center[1], e.mapCoords[0], e.mapCoords[1]),
        5,
      );
      this._updatePreview();
      return false;
    }

    if (this._phase === 'extruding') {
      // Mouse Y delta → height. UP = positive height.
      const deltaPixels = this._extrudeAnchorY - e.screenY;
      this._heightM = Math.max(deltaPixels * this._heightSensitivity, 1);
      this._updatePreview();

      // Fire live preview callback
      if (this.onExtrusionPreview && this._center) {
        this.onExtrusionPreview(this._center, this._radiusM, this._heightM, this._geometryType);
      }
      return false;
    }

    return false;
  }

  onPointerUp(e: ToolPointerEvent): boolean {
    if (this._phase !== 'sizing' || !this._center || !this._context) return false;

    // Lock radius, switch to extrusion phase
    if (e.mapCoords) {
      this._radiusM = distanceMeters(this._center[0], this._center[1], e.mapCoords[0], e.mapCoords[1]);
    }
    this._radiusM = Math.max(this._radiusM, 10);
    this._heightM = 1;
    this._extrudeAnchorY = e.screenY;
    this._phase = 'extruding';
    this._cursor = 'ns-resize';

    // Fire initial preview
    if (this.onExtrusionPreview && this._center) {
      this.onExtrusionPreview(this._center, this._radiusM, this._heightM, this._geometryType);
    }

    this._updatePreview();
    return true;
  }

  onDoubleClick(_e: ToolPointerEvent): boolean {
    if (this._phase === 'extruding') { this._createFeature(); return true; }
    return false;
  }

  onKeyDown(e: KeyboardEvent): boolean {
    if (e.key === 'Escape' && this._phase !== 'idle') { this.cancel(); return true; }
    if (e.key === 'Enter' && this._phase === 'extruding') { this._createFeature(); return true; }
    return false;
  }

  cancel(): void {
    // Notify consumers to clear preview
    if (this.onExtrusionPreview && this._center) {
      this.onExtrusionPreview(this._center, 0, 0, this._geometryType);
    }
    this._reset();
    this._context?.previewLayer.clear();
    this.markDirty();
  }

  // ─── Private ───

  private _reset(): void {
    this._center = null;
    this._radiusM = 0;
    this._heightM = 0;
    this._extrudeAnchorY = 0;
    this._phase = 'idle';
    this._state = 'active';
    this._cursor = 'crosshair';
  }

  private _createFeature(): void {
    if (!this._center || !this._context) return;

    let feature: Feature;

    if (this._geometryType === 'box' || this._geometryType === 'cylinder') {
      // Polygon footprint → extrusion pipeline (exact footprint match)
      const ring = this._geometryType === 'box'
        ? makeRectFootprint(this._center[0], this._center[1], this._radiusM, this._radiusM)
        : makeCircleFootprint(this._center[0], this._center[1], this._radiusM, 32);

      feature = {
        id: generateFeatureId(),
        geometry: { type: 'Polygon', coordinates: [ring] },
        attributes: {
          geometryType: this._geometryType,
          radius: Math.round(this._radiusM),
          height: Math.round(this._heightM),
          minHeight: 0,
        },
      };
    } else {
      // Point → Mesh3D pipeline (cone, sphere with footprint-based mesh)
      feature = {
        id: generateFeatureId(),
        geometry: { type: 'Point', coordinates: [this._center[0], this._center[1]] },
        attributes: {
          geometryType: this._geometryType,
          radius: Math.round(this._radiusM),
          height: Math.round(this._heightM),
        },
      };
    }

    const cmd = new CreateFeatureCommand(this._targetLayer, feature);
    this._context.commands.execute(cmd);
    this._context.emitEvent('draw-complete', { toolId: this.id, feature });

    this._reset();
    this._context.previewLayer.clear();
    this.markDirty();
  }

  private _updatePreview(): void {
    if (!this._context || !this._center) return;
    const preview = this._context.previewLayer;
    preview.clear();

    // Center point
    preview.add({
      id: '__place-center__',
      geometry: { type: 'Point', coordinates: this._center },
      attributes: { __preview: true, __type: 'vertex' },
    });

    if (this._radiusM > 0) {
      // Footprint outline
      const ring = this._geometryType === 'box'
        ? makeRectFootprint(this._center[0], this._center[1], this._radiusM, this._radiusM)
        : makeCircleFootprint(this._center[0], this._center[1], this._radiusM, 32);

      preview.add({
        id: '__place-footprint__',
        geometry: { type: 'Polygon', coordinates: [ring] },
        attributes: { __preview: true, __type: 'rubberband' },
      });

      // Radius line
      preview.add({
        id: '__place-radius__',
        geometry: { type: 'LineString', coordinates: [this._center, ring[0]!] },
        attributes: { __preview: true, __type: 'rubberband' },
      });
    }

    // Info label
    if (this._phase === 'extruding') {
      preview.add({
        id: '__place-info__',
        geometry: { type: 'Point', coordinates: this._center },
        attributes: {
          __preview: true,
          __type: 'cursor',
          label: `r=${Math.round(this._radiusM)}m h=${Math.round(this._heightM)}m`,
        },
      });
    } else if (this._phase === 'sizing' && this._radiusM > 0) {
      preview.add({
        id: '__place-info__',
        geometry: { type: 'Point', coordinates: this._center },
        attributes: {
          __preview: true,
          __type: 'cursor',
          label: `r=${Math.round(this._radiusM)}m`,
        },
      });
    }

    this.markDirty();
  }
}

// ─── Geometry Slice Generator (exported for reuse) ───

const SLICE_COUNT = 12;

/**
 * Generate extrusion slice features for a geometry type.
 *
 * - **Box/Cylinder**: 1 slice — full radius, constant walls
 * - **Cone**: 12 stacked slices with linearly decreasing radius (wide at bottom, point at top)
 * - **Sphere**: 12 stacked slices with hemisphere profile: r(h) = R × sqrt(1 - (h/R)²)
 *
 * Each slice is a Polygon feature with `height` and `minHeight` attributes
 * for use with `ExtrudedPolygonSymbol`.
 */
export function generateGeometrySlices(
  center: [number, number],
  radius: number,
  height: number,
  geoType: PlaceableGeometryType,
): Feature[] {
  const baseId = generateFeatureId();

  // Box and Cylinder: single slice, constant radius
  if (geoType === 'box' || geoType === 'cylinder') {
    const ring = geoType === 'box'
      ? makeRectFootprint(center[0], center[1], radius, radius)
      : makeCircleFootprint(center[0], center[1], radius, 32);
    return [{
      id: baseId,
      geometry: { type: 'Polygon', coordinates: [ring] },
      attributes: { geometryType: geoType, radius: Math.round(radius), height: Math.round(height), minHeight: 0 },
    }];
  }

  // Cone and Sphere: stacked extrusion slices
  const features: Feature[] = [];

  for (let i = 0; i < SLICE_COUNT; i++) {
    const t = i / SLICE_COUNT;
    const h0 = t * height;
    const h1 = ((i + 1) / SLICE_COUNT) * height;

    let sliceRadius: number;

    if (geoType === 'cone') {
      // Linear taper: R at ground, 0 at top
      sliceRadius = radius * (1 - t);
    } else {
      // Hemisphere: r(h) = R * sqrt(1 - (h/R)²)
      // h goes from 0 to R (hemisphere height = radius)
      // We map tool height to hemisphere: actual height = radius
      const hNorm = t; // 0..1
      sliceRadius = radius * Math.sqrt(Math.max(0, 1 - hNorm * hNorm));
    }

    if (sliceRadius < 0.5) continue;

    const ring = makeCircleFootprint(center[0], center[1], sliceRadius, 24);
    features.push({
      id: `${baseId}-s${i}`,
      geometry: { type: 'Polygon', coordinates: [ring] },
      attributes: {
        geometryType: geoType,
        radius: Math.round(sliceRadius),
        height: Math.round(h1),
        minHeight: Math.round(h0),
      },
    });
  }

  return features;
}
