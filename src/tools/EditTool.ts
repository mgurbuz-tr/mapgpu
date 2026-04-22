/**
 * EditTool — Select and reshape existing features.
 *
 * State machine:
 *   active ──[click on feature]──→ editing (show vertex handles)
 *   editing ──[drag vertex handle]──→ editing (geometry snapshot + undo)
 *   editing ──[dblclick on edge]──→ editing (insert vertex)
 *   editing ──[Delete on selected vertex]──→ editing (remove vertex)
 *   editing ──[click empty]──→ active (deselect)
 *   editing ──[Escape]──→ active (deselect)
 *
 * Hit-testing: vertex proximity + edge proximity + point-in-polygon.
 */

import type { ToolPointerEvent, ToolContext, Feature, ICommand, Geometry } from '../core/index.js';
import { ToolBase } from './ToolBase.js';
import type { ITargetLayer } from './commands/CreateFeatureCommand.js';
import {
  findNearestVertex,
  findNearestEdge,
  midpoint,
  screenDistance,
} from './helpers/geometryHelpers.js';

export interface EditToolOptions {
  editableLayers: (ITargetLayer & { getFeatures(): readonly Feature[]; readonly id: string })[];
  hitTolerance?: number;
}

// ─── Geometry Snapshot Command ───

class GeometryEditCommand implements ICommand {
  readonly description: string;
  private readonly _oldGeom: string; // JSON snapshot
  private readonly _newGeom: string;

  constructor(
    private readonly _layer: ITargetLayer,
    private readonly _feature: Feature,
    oldGeometry: Geometry,
    newGeometry: Geometry,
    desc: string,
  ) {
    this._oldGeom = JSON.stringify(oldGeometry);
    this._newGeom = JSON.stringify(newGeometry);
    this.description = desc;
  }

  execute(): void {
    this._feature.geometry = JSON.parse(this._newGeom) as Geometry;
    this._layer.add({ ...this._feature, geometry: this._feature.geometry });
  }

  undo(): void {
    this._feature.geometry = JSON.parse(this._oldGeom) as Geometry;
    this._layer.add({ ...this._feature, geometry: this._feature.geometry });
  }
}

// ─── EditTool ───

export class EditTool extends ToolBase {
  readonly id = 'edit';
  readonly name = 'Edit';

  private readonly _editableLayers: EditToolOptions['editableLayers'];
  private readonly _hitTolerance: number;

  // Selection state
  private _selectedFeature: Feature | null = null;
  private _selectedLayerId: string | null = null;
  private _editableVertices: [number, number][] = []; // Editable vertices (no duplicate closing vertex)
  private _isClosedRing = false; // Whether original geometry has a closed ring

  // Vertex drag state
  private _draggingVertexIndex: number | null = null;
  private _dragGeomSnapshot: Geometry | null = null;
  private _isDragging = false;

  // Feature move drag state
  private _draggingFeature = false;
  private _dragLastMapCoords: [number, number] | null = null;

  // Hover state for cursor feedback
  private _hoveredVertexIndex: number | null = null;

  constructor(options: EditToolOptions) {
    super();
    this._editableLayers = options.editableLayers;
    this._hitTolerance = options.hitTolerance ?? 12;
  }

  protected override onActivate(_context: ToolContext): void {
    this._cursor = 'pointer';
    this._clearSelection();
  }

  protected override onDeactivate(): void {
    this._clearSelection();
    this._context?.previewLayer.clear();
  }

  onPointerDown(e: ToolPointerEvent): boolean { // NOSONAR
    if (!e.mapCoords || !this._context) return false;

    if (this._state === 'editing' && this._selectedFeature) {
      // 1) Check vertex drag first
      if (this._editableVertices.length > 0) {
        const hit = findNearestVertex(
          this._editableVertices,
          e.screenX,
          e.screenY,
          this._context.toScreen,
          this._hitTolerance,
        );

        if (hit) {
          this._draggingVertexIndex = hit.index;
          this._dragGeomSnapshot = structuredClone(this._selectedFeature.geometry) as Geometry;
          this._isDragging = false;
          this._cursor = 'move';
          return true;
        }
      }

      // 2) Check midpoint handle click — insert vertex at that edge
      if (this._editableVertices.length >= 2) {
        const midHit = this._hitTestMidpoints(e.screenX, e.screenY);
        if (midHit !== null) {
          const oldGeom = structuredClone(this._selectedFeature.geometry) as Geometry;
          const mp = midHit.coords;
          this._editableVertices.splice(midHit.insertIndex, 0, mp);
          this._writeVerticesToGeometry();

          const newGeom = structuredClone(this._selectedFeature.geometry) as Geometry;
          const layer = this._findLayer(this._selectedLayerId);
          if (layer) {
            this._selectedFeature.geometry = structuredClone(oldGeom) as Geometry;
            const cmd = new GeometryEditCommand(
              layer, this._selectedFeature, oldGeom, newGeom,
              `Insert vertex at midpoint`,
            );
            this._context.commands.execute(cmd);
            this._readVerticesFromGeometry();
          }

          // Start dragging the newly inserted vertex immediately
          this._draggingVertexIndex = midHit.insertIndex;
          this._dragGeomSnapshot = structuredClone(this._selectedFeature.geometry) as Geometry;
          this._isDragging = false;
          this._cursor = 'move';
          this._updateEditPreview();
          return true;
        }
      }

      // 3) Check feature body hit → start feature move drag
      const bodyDist = this._featureScreenDistance(
        this._selectedFeature, e.screenX, e.screenY, this._context.toScreen,
      );
      if (bodyDist !== null && bodyDist <= this._hitTolerance * 2) {
        this._draggingFeature = true;
        this._dragLastMapCoords = [...e.mapCoords] as [number, number];
        this._dragGeomSnapshot = structuredClone(this._selectedFeature.geometry) as Geometry;
        this._isDragging = false;
        this._cursor = 'grab';
        return true;
      }
    }

    return false;
  }

  onPointerMove(e: ToolPointerEvent): boolean { // NOSONAR
    if (!e.mapCoords || !this._context) return false;

    // Handle vertex dragging
    if (this._draggingVertexIndex !== null && this._dragGeomSnapshot) {
      this._isDragging = true;
      this._editableVertices[this._draggingVertexIndex] = [...e.mapCoords] as [number, number];
      this._writeVerticesToGeometry();
      this._updateEditPreview();
      this.markDirty();
      return true;
    }

    // Handle feature move dragging
    if (this._draggingFeature && this._dragLastMapCoords) {
      this._isDragging = true;
      const dx = e.mapCoords[0] - this._dragLastMapCoords[0];
      const dy = e.mapCoords[1] - this._dragLastMapCoords[1];
      this._dragLastMapCoords = [...e.mapCoords] as [number, number];

      // Move all vertices by delta
      for (let i = 0; i < this._editableVertices.length; i++) {
        this._editableVertices[i] = [
          this._editableVertices[i]![0] + dx,
          this._editableVertices[i]![1] + dy,
        ];
      }
      this._writeVerticesToGeometry();
      this._updateEditPreview();
      this.markDirty();
      return true;
    }

    // Cursor feedback
    if (this._state === 'editing' && this._editableVertices.length > 0) {
      const hit = findNearestVertex(
        this._editableVertices,
        e.screenX,
        e.screenY,
        this._context.toScreen,
        this._hitTolerance,
      );

      if (hit) {
        this._hoveredVertexIndex = hit.index;
        this._cursor = 'move';
      } else if (this._selectedFeature) {
        this._hoveredVertexIndex = null;
        // Check if hovering over feature body (for grab cursor)
        const bodyDist = this._featureScreenDistance(
          this._selectedFeature, e.screenX, e.screenY, this._context.toScreen,
        );
        this._cursor = (bodyDist !== null && bodyDist <= this._hitTolerance * 2) ? 'grab' : 'pointer';
      } else {
        this._hoveredVertexIndex = null;
        this._cursor = 'pointer';
      }
    }

    return false;
  }

  onPointerUp(e: ToolPointerEvent): boolean { // NOSONAR
    if (!e.mapCoords || !this._context) return false;

    // Finish vertex drag
    if (this._draggingVertexIndex !== null && this._dragGeomSnapshot) {
      if (this._isDragging && this._selectedFeature) {
        this._editableVertices[this._draggingVertexIndex] = [...e.mapCoords] as [number, number];
        this._writeVerticesToGeometry();

        const newGeom = structuredClone(this._selectedFeature.geometry) as Geometry;
        const layer = this._findLayer(this._selectedLayerId);

        if (layer) {
          this._selectedFeature.geometry = structuredClone(this._dragGeomSnapshot) as Geometry;
          const cmd = new GeometryEditCommand(
            layer, this._selectedFeature, this._dragGeomSnapshot, newGeom,
            `Move vertex ${this._draggingVertexIndex}`,
          );
          this._context.commands.execute(cmd);
          this._readVerticesFromGeometry();
          this._updateEditPreview();
          this._context.emitEvent('feature-update', {
            feature: this._selectedFeature,
            layerId: this._selectedLayerId!,
          });
        }
      }

      this._draggingVertexIndex = null;
      this._dragGeomSnapshot = null;
      this._isDragging = false;
      this._cursor = 'pointer';
      this.markDirty();
      return true;
    }

    // Finish feature move drag
    if (this._draggingFeature && this._dragGeomSnapshot) {
      if (this._isDragging && this._selectedFeature) {
        const newGeom = structuredClone(this._selectedFeature.geometry) as Geometry;
        const layer = this._findLayer(this._selectedLayerId);

        if (layer) {
          this._selectedFeature.geometry = structuredClone(this._dragGeomSnapshot) as Geometry;
          const cmd = new GeometryEditCommand(
            layer, this._selectedFeature, this._dragGeomSnapshot, newGeom,
            'Move feature',
          );
          this._context.commands.execute(cmd);
          this._readVerticesFromGeometry();
          this._updateEditPreview();
          this._context.emitEvent('feature-update', {
            feature: this._selectedFeature,
            layerId: this._selectedLayerId!,
          });
        }
      }

      this._draggingFeature = false;
            this._dragLastMapCoords = null;
      this._dragGeomSnapshot = null;
      this._isDragging = false;
      this._cursor = 'pointer';
      this.markDirty();
      return true;
    }

    // Try to select a feature
    const hit = this._hitTestFeatures(e.screenX, e.screenY);
    if (hit) {
      this._selectFeature(hit.feature, hit.layerId);
      return true;
    }

    // Clicked empty space → deselect
    if (this._state === 'editing') {
      this._clearSelection();
      this._context.previewLayer.clear();
      this._state = 'active';
      this.markDirty();
    }

    return false;
  }

  onDoubleClick(e: ToolPointerEvent): boolean {
    if (!this._context || !e.mapCoords) return false;

    // Double-click on edge → insert vertex
    if (this._state === 'editing' && this._editableVertices.length >= 2 && this._selectedFeature) {
      const edgeHit = findNearestEdge(
        this._editableVertices,
        e.screenX,
        e.screenY,
        this._context.toScreen,
        this._hitTolerance * 2,
      );

      if (edgeHit) {
        const oldGeom = structuredClone(this._selectedFeature.geometry) as Geometry;

        // Insert vertex into editable list
        this._editableVertices.splice(edgeHit.edgeIndex + 1, 0, [...e.mapCoords] as [number, number]);
        this._writeVerticesToGeometry();

        const newGeom = structuredClone(this._selectedFeature.geometry) as Geometry;
        const layer = this._findLayer(this._selectedLayerId);

        if (layer) {
          this._selectedFeature.geometry = structuredClone(oldGeom) as Geometry;
          const cmd = new GeometryEditCommand(
            layer, this._selectedFeature, oldGeom, newGeom,
            `Insert vertex at edge ${edgeHit.edgeIndex}`,
          );
          this._context.commands.execute(cmd);

          this._readVerticesFromGeometry();
          this._updateEditPreview();
        }

        return true;
      }
    }

    return false;
  }

  onKeyDown(e: KeyboardEvent): boolean {
    if (!this._context || this._state !== 'editing' || !this._selectedFeature) return false;

    // Delete selected vertex (last hovered)
    if ((e.key === 'Delete' || e.key === 'Backspace') && this._hoveredVertexIndex !== null) {
      const idx = this._hoveredVertexIndex;
      if (this._editableVertices.length <= this._minVertexCount()) return false;

      const oldGeom = structuredClone(this._selectedFeature.geometry) as Geometry;

      this._editableVertices.splice(idx, 1);
      this._writeVerticesToGeometry();

      const newGeom = structuredClone(this._selectedFeature.geometry) as Geometry;
      const layer = this._findLayer(this._selectedLayerId);

      if (layer) {
        this._selectedFeature.geometry = structuredClone(oldGeom) as Geometry;
        const cmd = new GeometryEditCommand(
          layer, this._selectedFeature, oldGeom, newGeom,
          `Delete vertex ${idx}`,
        );
        this._context.commands.execute(cmd);

        this._readVerticesFromGeometry();
        this._updateEditPreview();
      }

      this._hoveredVertexIndex = null;
      return true;
    }

    return false;
  }

  cancel(): void {
    this._clearSelection();
    this._state = 'active';
    this._cursor = 'pointer';
    this._context?.previewLayer.clear();
    this.markDirty();
  }

  // ─── Private: Selection ───

  private _selectFeature(feature: Feature, layerId: string): void {
    this._selectedFeature = feature;
    this._selectedLayerId = layerId;
    this._readVerticesFromGeometry();
    this._state = 'editing';
    this._cursor = 'pointer';

    this._context?.emitEvent('feature-select', { feature, layerId });
    this._updateEditPreview();
  }

  private _clearSelection(): void {
    this._selectedFeature = null;
    this._selectedLayerId = null;
    this._editableVertices = [];
    this._isClosedRing = false;
    this._draggingVertexIndex = null;
    this._draggingFeature = false;
    this._dragLastMapCoords = null;
    this._dragGeomSnapshot = null;
    this._isDragging = false;
    this._hoveredVertexIndex = null;
  }

  // ─── Private: Vertex ↔ Geometry Sync ───

  /**
   * Read editable vertices from the selected feature's geometry.
   * For closed polygon rings, the duplicate closing vertex is omitted.
   */
  private _readVerticesFromGeometry(): void {
    if (!this._selectedFeature) { this._editableVertices = []; return; }

    const geom = this._selectedFeature.geometry;
    const flat: [number, number][] = [];
    this._flattenCoords(geom.coordinates, flat);

    // Detect closed ring (polygon: first == last)
    if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
      this._isClosedRing = true;
      // Remove duplicate closing vertex if present
      if (flat.length >= 2) {
        const first = flat[0]!;
        const last = flat.at(-1)!;
        if (first[0] === last[0] && first[1] === last[1]) {
          flat.pop();
        }
      }
    } else {
      this._isClosedRing = false;
    }

    this._editableVertices = flat;
  }

  /**
   * Write editable vertices back into the selected feature's geometry.
   * For closed polygon rings, the closing vertex is auto-appended.
   */
  private _writeVerticesToGeometry(): void {
    if (!this._selectedFeature) return;
    const geom = this._selectedFeature.geometry;

    const verts = [...this._editableVertices];

    // Re-close the ring for polygons
    if (this._isClosedRing && verts.length >= 1) {
      verts.push([...verts[0]!] as [number, number]);
    }

    // Reconstruct coordinates based on geometry type
    switch (geom.type) {
      case 'Point':
        if (verts[0]) geom.coordinates = [...verts[0]];
        break;
      case 'MultiPoint':
      case 'LineString':
        geom.coordinates = verts;
        break;
      case 'Polygon': {
        // Single ring for now (editable vertices = outer ring)
        geom.coordinates = [verts];
        break;
      }
      case 'MultiLineString':
        geom.coordinates = [verts];
        break;
      case 'MultiPolygon':
        geom.coordinates = [[verts]];
        break;
    }

    // Re-add feature to layer for display refresh
    const layer = this._findLayer(this._selectedLayerId);
    if (layer) {
      layer.add({ ...this._selectedFeature, geometry: geom });
    }
  }

  // ─── Private: Hit Testing ───

  /**
   * Hit-test all editable features using vertex proximity + edge proximity.
   * For polygons, also uses point-in-polygon.
   */
  private _hitTestFeatures(
    screenX: number,
    screenY: number,
  ): { feature: Feature; layerId: string } | null {
    if (!this._context) return null;
    const toScreen = this._context.toScreen;

    let bestHit: { feature: Feature; layerId: string; dist: number } | null = null;

    for (const layer of this._editableLayers) {
      const features = layer.getFeatures();
      for (const feature of features) {
        const dist = this._featureScreenDistance(feature, screenX, screenY, toScreen);
        if (dist !== null && dist <= this._hitTolerance * 2) {
          if (!bestHit || dist < bestHit.dist) {
            bestHit = { feature, layerId: layer.id, dist };
          }
        }
      }
    }

    return bestHit;
  }

  /**
   * Compute screen distance from a point to a feature.
   * Uses vertex + edge proximity for lines/points.
   * For polygons, also checks point-in-polygon (returns 0 if inside).
   */
  private _featureScreenDistance( // NOSONAR
    feature: Feature,
    screenX: number,
    screenY: number,
    toScreen: (lon: number, lat: number) => [number, number] | null,
  ): number | null {
    const geomType = feature.geometry.type;

    // Point-in-polygon for polygon geometries (screen-space ray casting)
    if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
      const rings = this._extractScreenRings(feature.geometry, toScreen);
      for (const ring of rings) {
        if (this._pointInRing(screenX, screenY, ring)) {
          return 0; // Inside polygon → distance = 0
        }
      }
    }

    const verts: [number, number][] = [];
    this._flattenCoords(feature.geometry.coordinates, verts);
    if (verts.length === 0) return null;

    // Vertex proximity
    let minDist = Infinity;
    for (const v of verts) {
      const sp = toScreen(v[0], v[1]);
      if (!sp) continue;
      const d = screenDistance(screenX, screenY, sp[0], sp[1]);
      if (d < minDist) minDist = d;
    }

    // Edge proximity for line-like geometries
    if (verts.length >= 2) {
      for (let i = 0; i < verts.length - 1; i++) {
        const a = toScreen(verts[i]![0], verts[i]![1]);
        const b = toScreen(verts[i + 1]![0], verts[i + 1]![1]);
        if (!a || !b) continue;

        const d = this._pointToSegDist(screenX, screenY, a[0], a[1], b[0], b[1]);
        if (d < minDist) minDist = d;
      }
    }

    return Number.isFinite(minDist) ? minDist : null;
  }

  /**
   * Extract polygon outer rings as screen-space coordinate arrays.
   */
  private _extractScreenRings( // NOSONAR
    geometry: Geometry,
    toScreen: (lon: number, lat: number) => [number, number] | null,
  ): [number, number][][] {
    const result: [number, number][][] = [];
    const coords = geometry.coordinates;

    if (geometry.type === 'Polygon') {
      const rings = coords as number[][][];
      if (rings[0]) {
        const screenRing: [number, number][] = [];
        for (const c of rings[0]) {
          const sp = toScreen(c[0]!, c[1]!);
          if (sp) screenRing.push(sp);
        }
        if (screenRing.length >= 3) result.push(screenRing);
      }
    } else if (geometry.type === 'MultiPolygon') {
      const polys = coords as number[][][][];
      for (const poly of polys) {
        if (poly[0]) {
          const screenRing: [number, number][] = [];
          for (const c of poly[0]) {
            const sp = toScreen(c[0]!, c[1]!);
            if (sp) screenRing.push(sp);
          }
          if (screenRing.length >= 3) result.push(screenRing);
        }
      }
    }

    return result;
  }

  /**
   * Ray-casting point-in-polygon test (screen space).
   */
  private _pointInRing(px: number, py: number, ring: [number, number][]): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i]![0], yi = ring[i]![1];
      const xj = ring[j]![0], yj = ring[j]![1];

      if ((yi > py) !== (yj > py) &&
          px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  private _pointToSegDist(
    px: number, py: number,
    ax: number, ay: number,
    bx: number, by: number,
  ): number {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return screenDistance(px, py, ax, ay);

    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    return screenDistance(px, py, ax + t * dx, ay + t * dy);
  }

  // ─── Private: Helpers ───

  /**
   * Hit-test midpoint handles. Returns the insert index and midpoint coords if hit.
   */
  private _hitTestMidpoints(
    screenX: number,
    screenY: number,
  ): { insertIndex: number; coords: [number, number] } | null {
    if (!this._context) return null;
    const toScreen = this._context.toScreen;

    // Check midpoints between consecutive vertices
    for (let i = 0; i < this._editableVertices.length - 1; i++) {
      const mp = midpoint(this._editableVertices[i]!, this._editableVertices[i + 1]!);
      const sp = toScreen(mp[0], mp[1]);
      if (!sp) continue;
      const d = screenDistance(screenX, screenY, sp[0], sp[1]);
      if (d <= this._hitTolerance) {
        return { insertIndex: i + 1, coords: mp };
      }
    }

    // Check closing midpoint for polygon rings
    if (this._isClosedRing && this._editableVertices.length >= 3) {
      const first = this._editableVertices[0]!;
      const last = this._editableVertices.at(-1)!;
      const mp = midpoint(last, first);
      const sp = toScreen(mp[0], mp[1]);
      if (sp) {
        const d = screenDistance(screenX, screenY, sp[0], sp[1]);
        if (d <= this._hitTolerance) {
          return { insertIndex: this._editableVertices.length, coords: mp };
        }
      }
    }

    return null;
  }

  private _findLayer(layerId: string | null) {
    if (!layerId) return null;
    return this._editableLayers.find((l) => l.id === layerId) ?? null;
  }

  private _minVertexCount(): number {
    if (!this._selectedFeature) return 1;
    switch (this._selectedFeature.geometry.type) {
      case 'Point': return 1;
      case 'LineString': case 'MultiLineString': return 2;
      case 'Polygon': case 'MultiPolygon': return 3;
      default: return 1;
    }
  }

  private _flattenCoords(
    coords: Feature['geometry']['coordinates'],
    out: [number, number][],
  ): void {
    if (!Array.isArray(coords) || coords.length === 0) return;

    if (typeof coords[0] === 'number') {
      out.push([coords[0], (coords[1] ?? 0) as number]);
      return;
    }

    for (const sub of coords) {
      this._flattenCoords(sub as Feature['geometry']['coordinates'], out);
    }
  }

  private _updateEditPreview(): void {
    if (!this._context) return;
    const preview = this._context.previewLayer;
    preview.clear();

    // Vertex handles
    for (let i = 0; i < this._editableVertices.length; i++) {
      const isHovered = this._hoveredVertexIndex === i;
      preview.add({
        id: `__edit-vertex-${i}__`,
        geometry: { type: 'Point', coordinates: this._editableVertices[i]! },
        attributes: {
          __preview: true,
          __type: isHovered ? 'vertex-handle-hover' : 'vertex-handle',
        },
      });
    }

    // Midpoint handles (between consecutive editable vertices)
    for (let i = 0; i < this._editableVertices.length - 1; i++) {
      const mp = midpoint(this._editableVertices[i]!, this._editableVertices[i + 1]!);
      preview.add({
        id: `__edit-midpoint-${i}__`,
        geometry: { type: 'Point', coordinates: mp },
        attributes: { __preview: true, __type: 'midpoint-handle' },
      });
    }

    // Closing midpoint for polygon rings
    if (this._isClosedRing && this._editableVertices.length >= 3) {
      const first = this._editableVertices[0]!;
      const last = this._editableVertices.at(-1)!;
      const mp = midpoint(last, first);
      preview.add({
        id: '__edit-midpoint-close__',
        geometry: { type: 'Point', coordinates: mp },
        attributes: { __preview: true, __type: 'midpoint-handle' },
      });
    }

    this.markDirty();
  }
}
