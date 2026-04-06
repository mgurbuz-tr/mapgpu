class w {
  _state = "idle";
  _cursor = "crosshair";
  _context = null;
  get state() {
    return this._state;
  }
  get cursor() {
    return this._cursor;
  }
  activate(t) {
    this._context = t, this._state = "active", this._cursor = "crosshair", this.onActivate(t);
  }
  deactivate() {
    (this._state === "drawing" || this._state === "editing") && this.cancel(), this._state = "idle", this._cursor = "default", this.onDeactivate(), this._context = null;
  }
  destroy() {
    this._state !== "idle" && this.deactivate(), this.onDestroy();
  }
  // ─── Hooks for subclasses ───
  onActivate(t) {
  }
  onDeactivate() {
  }
  onDestroy() {
  }
  // ─── Helpers ───
  markDirty() {
    this._context?.markDirty();
  }
}
class L {
  constructor(t, e) {
    this._targetLayer = t, this._feature = e, this.description = `Create ${e.geometry.type} feature`;
  }
  description;
  execute() {
    this._targetLayer.add(this._feature);
  }
  undo() {
    this._targetLayer.remove(this._feature.id);
  }
}
function m(r, t, e, s) {
  const i = r - e, n = t - s;
  return Math.sqrt(i * i + n * n);
}
function T(r, t) {
  return [(r[0] + t[0]) / 2, (r[1] + t[1]) / 2];
}
function Y(r, t, e, s, i = 10) {
  let n = -1, o = 1 / 0;
  for (let c = 0; c < r.length; c++) {
    const a = r[c], _ = s(a[0], a[1]);
    if (!_) continue;
    const h = m(t, e, _[0], _[1]);
    h < o && (o = h, n = c);
  }
  return n >= 0 && o <= i ? { index: n, distance: o } : null;
}
function nt(r, t, e, s, i = 10) {
  let n = -1, o = 1 / 0, c = 0;
  for (let a = 0; a < r.length - 1; a++) {
    const _ = s(r[a][0], r[a][1]), h = s(r[a + 1][0], r[a + 1][1]);
    if (!_ || !h) continue;
    const u = Z(t, e, _[0], _[1], h[0], h[1]);
    u.distance < o && (o = u.distance, n = a, c = u.t);
  }
  return n >= 0 && o <= i ? { edgeIndex: n, t: c, distance: o } : null;
}
function Z(r, t, e, s, i, n) {
  const o = i - e, c = n - s, a = o * o + c * c;
  if (a === 0)
    return { distance: m(r, t, e, s), t: 0 };
  let _ = ((r - e) * o + (t - s) * c) / a;
  _ = Math.max(0, Math.min(1, _));
  const h = e + _ * o, u = s + _ * c;
  return { distance: m(r, t, h, u), t: _ };
}
let ot = 0;
function x() {
  return `tool-feat-${++ot}`;
}
let at = 0;
function ct(r = "preview") {
  return `__${r}-${++at}__`;
}
var d = /* @__PURE__ */ ((r) => (r.EndPoint = "endpoint", r.Point = "point", r.MidPoint = "midpoint", r.Intersection = "intersection", r.Nearest = "nearest", r.AngleGuide = "angle-guide", r))(d || {});
const Q = {
  endpoint: 0,
  point: 5,
  midpoint: 10,
  intersection: 20,
  nearest: 30,
  "angle-guide": 50
}, ht = /* @__PURE__ */ new Set([
  "endpoint",
  "point",
  "midpoint",
  "intersection",
  "nearest"
  /* Nearest */
]);
function _t(r) {
  const t = { ...Q, ...r?.priorityOverrides };
  return {
    enabled: r?.enabled ?? !0,
    enabledTypes: r?.enabledTypes ?? new Set(ht),
    tolerance: r?.tolerance ?? 10,
    angleGuideIntervals: r?.angleGuideIntervals ?? [0, 45, 90, 135],
    angleGuideHoverThreshold: r?.angleGuideHoverThreshold ?? 500,
    priorities: t
  };
}
function lt(r, t) {
  return r.priority !== t.priority ? r.priority - t.priority : r.screenDistance - t.screenDistance;
}
const V = "__snap-indicator__", G = "__snap-guide-line__";
function D(r) {
  return `url("data:image/svg+xml,${encodeURIComponent(r)}") 16 16, crosshair`;
}
const dt = {
  // Endpoint: square rotated 45°
  [d.EndPoint]: D(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><line x1="16" y1="0" x2="16" y2="12" stroke="#fff" stroke-width="1.5" opacity="0.6"/><line x1="16" y1="20" x2="16" y2="32" stroke="#fff" stroke-width="1.5" opacity="0.6"/><line x1="0" y1="16" x2="12" y2="16" stroke="#fff" stroke-width="1.5" opacity="0.6"/><line x1="20" y1="16" x2="32" y2="16" stroke="#fff" stroke-width="1.5" opacity="0.6"/><rect x="11" y="11" width="10" height="10" rx="1" fill="none" stroke="#00e640" stroke-width="2"/></svg>'
  ),
  // Midpoint: triangle
  [d.MidPoint]: D(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><line x1="16" y1="0" x2="16" y2="10" stroke="#fff" stroke-width="1.5" opacity="0.6"/><line x1="16" y1="22" x2="16" y2="32" stroke="#fff" stroke-width="1.5" opacity="0.6"/><line x1="0" y1="16" x2="10" y2="16" stroke="#fff" stroke-width="1.5" opacity="0.6"/><line x1="22" y1="16" x2="32" y2="16" stroke="#fff" stroke-width="1.5" opacity="0.6"/><polygon points="16,10 22,22 10,22" fill="none" stroke="#ffb800" stroke-width="2"/></svg>'
  ),
  // Intersection: X mark
  [d.Intersection]: D(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><line x1="16" y1="0" x2="16" y2="10" stroke="#fff" stroke-width="1.5" opacity="0.6"/><line x1="16" y1="22" x2="16" y2="32" stroke="#fff" stroke-width="1.5" opacity="0.6"/><line x1="0" y1="16" x2="10" y2="16" stroke="#fff" stroke-width="1.5" opacity="0.6"/><line x1="22" y1="16" x2="32" y2="16" stroke="#fff" stroke-width="1.5" opacity="0.6"/><line x1="11" y1="11" x2="21" y2="21" stroke="#ff6d3a" stroke-width="2.5"/><line x1="21" y1="11" x2="11" y2="21" stroke="#ff6d3a" stroke-width="2.5"/></svg>'
  ),
  // Nearest: circle on edge
  [d.Nearest]: D(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><line x1="16" y1="0" x2="16" y2="10" stroke="#fff" stroke-width="1.5" opacity="0.6"/><line x1="16" y1="22" x2="16" y2="32" stroke="#fff" stroke-width="1.5" opacity="0.6"/><line x1="0" y1="16" x2="10" y2="16" stroke="#fff" stroke-width="1.5" opacity="0.6"/><line x1="22" y1="16" x2="32" y2="16" stroke="#fff" stroke-width="1.5" opacity="0.6"/><circle cx="16" cy="16" r="5" fill="none" stroke="#00c8ff" stroke-width="2"/></svg>'
  ),
  // Point: filled circle
  [d.Point]: D(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><line x1="16" y1="0" x2="16" y2="10" stroke="#fff" stroke-width="1.5" opacity="0.6"/><line x1="16" y1="22" x2="16" y2="32" stroke="#fff" stroke-width="1.5" opacity="0.6"/><line x1="0" y1="16" x2="10" y2="16" stroke="#fff" stroke-width="1.5" opacity="0.6"/><line x1="22" y1="16" x2="32" y2="16" stroke="#fff" stroke-width="1.5" opacity="0.6"/><circle cx="16" cy="16" r="4" fill="#00e640" stroke="#fff" stroke-width="1.5"/></svg>'
  ),
  // Angle guide: diamond
  [d.AngleGuide]: D(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><line x1="16" y1="0" x2="16" y2="10" stroke="#fff" stroke-width="1.5" opacity="0.6"/><line x1="16" y1="22" x2="16" y2="32" stroke="#fff" stroke-width="1.5" opacity="0.6"/><line x1="0" y1="16" x2="10" y2="16" stroke="#fff" stroke-width="1.5" opacity="0.6"/><line x1="22" y1="16" x2="32" y2="16" stroke="#fff" stroke-width="1.5" opacity="0.6"/><polygon points="16,10 22,16 16,22 10,16" fill="none" stroke="#b4ff00" stroke-width="2"/></svg>'
  )
};
class C {
  /**
   * Update snap visualization on the preview layer and cursor.
   *
   * - Removes previous indicators.
   * - Adds snap point marker if snap is active.
   * - Adds guide line for angle guide snaps.
   * - Updates cursor to reflect active snap type.
   */
  static render(t, e, s) {
    if (t.remove(V), t.remove(G), !(!e || e.type === "none") && (t.add({
      id: V,
      geometry: { type: "Point", coordinates: e.coords },
      attributes: {
        __preview: !0,
        __type: "snap-indicator",
        __snapType: e.type
      }
    }), e.type === "angle-guide" && s)) {
      const i = e.coords[0] - s[0], n = e.coords[1] - s[1], o = 10;
      t.add({
        id: G,
        geometry: {
          type: "LineString",
          coordinates: [
            [s[0] - i * o, s[1] - n * o],
            [s[0] + i * o, s[1] + n * o]
          ]
        },
        attributes: {
          __preview: !0,
          __type: "angle-guide-line"
        }
      });
    }
  }
  /** Remove all snap indicators. */
  static clear(t) {
    t.remove(V), t.remove(G);
  }
  /** Get the cursor string for a snap result. Returns `null` if no snap. */
  static getCursor(t) {
    return !t || t.type === "none" ? null : dt[t.type] ?? null;
  }
}
class ut extends w {
  id = "draw-point";
  name = "Draw Point";
  _targetLayer;
  _snapEngine;
  _lastSnap = null;
  _cursorPreviewId = ct("cursor-point");
  constructor(t) {
    super(), this._targetLayer = t.targetLayer, this._snapEngine = t.snapEngine ?? null;
  }
  onActivate(t) {
    this._cursor = "crosshair";
  }
  onDeactivate() {
    this._context?.previewLayer.clear();
  }
  onPointerDown(t) {
    return !1;
  }
  _resolveSnap(t) {
    if (!this._snapEngine || !t.mapCoords || !this._context)
      return this._lastSnap = null, this._cursor = "crosshair", t.mapCoords ?? [0, 0];
    const e = this._snapEngine.snap(t.screenX, t.screenY, t.mapCoords, this._context.toScreen);
    return this._lastSnap = e, this._cursor = C.getCursor(e) ?? "crosshair", e.coords;
  }
  onPointerMove(t) {
    if (this._state !== "active" || !t.mapCoords || !this._context) return !1;
    const e = this._resolveSnap(t), s = this._context.previewLayer;
    return s.remove(this._cursorPreviewId), s.add({
      id: this._cursorPreviewId,
      geometry: { type: "Point", coordinates: e },
      attributes: { __preview: !0, __type: "cursor" }
    }), C.render(s, this._lastSnap), this.markDirty(), !1;
  }
  onPointerUp(t) {
    if (this._state !== "active" || !t.mapCoords || !this._context) return !1;
    const e = this._resolveSnap(t), s = {
      id: x(),
      geometry: { type: "Point", coordinates: [...e] },
      attributes: { createdAt: Date.now() }
    }, i = new L(this._targetLayer, s);
    return this._context.commands.execute(i), this._context.emitEvent("draw-start", {
      toolId: this.id,
      geometry: s.geometry
    }), this._context.emitEvent("draw-complete", {
      toolId: this.id,
      feature: s
    }), this.markDirty(), !0;
  }
  onDoubleClick(t) {
    return !1;
  }
  onKeyDown(t) {
    return !1;
  }
  cancel() {
    this._context?.previewLayer.clear(), this.markDirty();
  }
}
class gt extends w {
  id = "draw-polyline";
  name = "Draw Polyline";
  _targetLayer;
  _snapEngine;
  _lastSnap = null;
  _vertices = [];
  _cursorPos = null;
  constructor(t) {
    super(), this._targetLayer = t.targetLayer, this._snapEngine = t.snapEngine ?? null;
  }
  _resolveSnap(t) {
    if (!this._snapEngine || !t.mapCoords || !this._context)
      return this._lastSnap = null, this._cursor = "crosshair", t.mapCoords ?? [0, 0];
    this._snapEngine.activeVertices = this._vertices;
    const e = this._snapEngine.snap(t.screenX, t.screenY, t.mapCoords, this._context.toScreen);
    return this._lastSnap = e, this._cursor = C.getCursor(e) ?? "crosshair", e.coords;
  }
  onActivate(t) {
    this._cursor = "crosshair", this._vertices = [], this._cursorPos = null;
  }
  onDeactivate() {
    this._vertices = [], this._cursorPos = null, this._context?.previewLayer.clear();
  }
  onPointerDown(t) {
    return !1;
  }
  onPointerMove(t) {
    return !t.mapCoords || !this._context || (this._cursorPos = this._resolveSnap(t), this._updatePreview()), !1;
  }
  onPointerUp(t) {
    if (!t.mapCoords || !this._context) return !1;
    const e = this._resolveSnap(t);
    return this._vertices.push([...e]), this._snapEngine && this._snapEngine.angleGuideManager.addOrigin(e), this._vertices.length === 1 && (this._state = "drawing", this._context.emitEvent("draw-start", {
      toolId: this.id,
      geometry: { type: "LineString", coordinates: [...this._vertices] }
    })), this._context.emitEvent("vertex-add", {
      toolId: this.id,
      coords: t.mapCoords,
      vertexIndex: this._vertices.length - 1
    }), this._updatePreview(), !0;
  }
  onDoubleClick(t) {
    return this._state !== "drawing" || !this._context ? !1 : this._finishDrawing();
  }
  onKeyDown(t) {
    if (!this._context) return !1;
    if (t.key === "Enter" && this._state === "drawing")
      return this._finishDrawing();
    if (t.key === "Backspace" && this._state === "drawing" && this._vertices.length > 0) {
      const e = this._vertices.length - 1;
      return this._vertices.pop(), this._context.emitEvent("vertex-remove", {
        toolId: this.id,
        vertexIndex: e
      }), this._vertices.length === 0 && (this._state = "active"), this._updatePreview(), !0;
    }
    return !1;
  }
  cancel() {
    this._state === "drawing" && this._context && this._context.emitEvent("draw-cancel", { toolId: this.id }), this._vertices = [], this._cursorPos = null, this._lastSnap = null, this._state = "active", this._snapEngine && (this._snapEngine.activeVertices = [], this._snapEngine.angleGuideManager.reset()), this._context?.previewLayer.clear(), this.markDirty();
  }
  // ─── Private ───
  _finishDrawing() {
    if (this._vertices.length < 2 || !this._context) return !1;
    const t = {
      id: x(),
      geometry: {
        type: "LineString",
        coordinates: this._vertices.map((s) => [...s])
      },
      attributes: { createdAt: Date.now() }
    }, e = new L(this._targetLayer, t);
    return this._context.commands.execute(e), this._context.emitEvent("draw-complete", {
      toolId: this.id,
      feature: t
    }), this._vertices = [], this._cursorPos = null, this._lastSnap = null, this._state = "active", this._snapEngine && (this._snapEngine.activeVertices = [], this._snapEngine.angleGuideManager.reset()), this._context.previewLayer.clear(), this.markDirty(), !0;
  }
  _updatePreview() {
    if (!this._context) return;
    const t = this._context.previewLayer;
    t.clear();
    for (let e = 0; e < this._vertices.length; e++)
      t.add({
        id: `__polyline-vertex-${e}__`,
        geometry: { type: "Point", coordinates: this._vertices[e] },
        attributes: { __preview: !0, __type: "vertex" }
      });
    if (this._vertices.length > 0) {
      const e = this._vertices.map((s) => [...s]);
      this._cursorPos && e.push([...this._cursorPos]), e.length >= 2 && t.add({
        id: "__polyline-preview__",
        geometry: { type: "LineString", coordinates: e },
        attributes: { __preview: !0, __type: "rubberband" }
      });
    }
    this._cursorPos && t.add({
      id: "__polyline-cursor__",
      geometry: { type: "Point", coordinates: this._cursorPos },
      attributes: { __preview: !0, __type: "cursor" }
    }), C.render(t, this._lastSnap), this.markDirty();
  }
}
class ft extends w {
  id = "draw-polygon";
  name = "Draw Polygon";
  _targetLayer;
  _snapEngine;
  _lastSnap = null;
  _vertices = [];
  _cursorPos = null;
  constructor(t) {
    super(), this._targetLayer = t.targetLayer, this._snapEngine = t.snapEngine ?? null;
  }
  _resolveSnap(t) {
    if (!this._snapEngine || !t.mapCoords || !this._context)
      return this._lastSnap = null, this._cursor = "crosshair", t.mapCoords ?? [0, 0];
    this._snapEngine.activeVertices = this._vertices;
    const e = this._snapEngine.snap(t.screenX, t.screenY, t.mapCoords, this._context.toScreen);
    return this._lastSnap = e, this._cursor = C.getCursor(e) ?? "crosshair", e.coords;
  }
  onActivate(t) {
    this._cursor = "crosshair", this._vertices = [], this._cursorPos = null;
  }
  onDeactivate() {
    this._vertices = [], this._cursorPos = null, this._context?.previewLayer.clear();
  }
  onPointerDown(t) {
    return !1;
  }
  onPointerMove(t) {
    return !t.mapCoords || !this._context || (this._cursorPos = this._resolveSnap(t), this._updatePreview()), !1;
  }
  onPointerUp(t) {
    if (!t.mapCoords || !this._context) return !1;
    const e = this._resolveSnap(t);
    return this._vertices.push([...e]), this._snapEngine && this._snapEngine.angleGuideManager.addOrigin(e), this._vertices.length === 1 && (this._state = "drawing", this._context.emitEvent("draw-start", {
      toolId: this.id,
      geometry: { type: "Polygon", coordinates: [[...this._vertices.map((s) => [...s])]] }
    })), this._context.emitEvent("vertex-add", {
      toolId: this.id,
      coords: t.mapCoords,
      vertexIndex: this._vertices.length - 1
    }), this._updatePreview(), !0;
  }
  onDoubleClick(t) {
    return this._state !== "drawing" || !this._context ? !1 : this._finishDrawing();
  }
  onKeyDown(t) {
    if (!this._context) return !1;
    if (t.key === "Enter" && this._state === "drawing")
      return this._finishDrawing();
    if (t.key === "Backspace" && this._state === "drawing" && this._vertices.length > 0) {
      const e = this._vertices.length - 1;
      return this._vertices.pop(), this._context.emitEvent("vertex-remove", {
        toolId: this.id,
        vertexIndex: e
      }), this._vertices.length === 0 && (this._state = "active"), this._updatePreview(), !0;
    }
    return !1;
  }
  cancel() {
    this._state === "drawing" && this._context && this._context.emitEvent("draw-cancel", { toolId: this.id }), this._vertices = [], this._cursorPos = null, this._lastSnap = null, this._state = "active", this._snapEngine && (this._snapEngine.activeVertices = [], this._snapEngine.angleGuideManager.reset()), this._context?.previewLayer.clear(), this.markDirty();
  }
  // ─── Private ───
  _finishDrawing() {
    if (this._vertices.length < 3 || !this._context) return !1;
    const t = this._vertices.map((i) => [...i]);
    t.push([...t[0]]);
    const e = {
      id: x(),
      geometry: {
        type: "Polygon",
        coordinates: [t]
      },
      attributes: { createdAt: Date.now() }
    }, s = new L(this._targetLayer, e);
    return this._context.commands.execute(s), this._context.emitEvent("draw-complete", {
      toolId: this.id,
      feature: e
    }), this._vertices = [], this._cursorPos = null, this._lastSnap = null, this._state = "active", this._snapEngine && (this._snapEngine.activeVertices = [], this._snapEngine.angleGuideManager.reset()), this._context.previewLayer.clear(), this.markDirty(), !0;
  }
  _updatePreview() {
    if (!this._context) return;
    const t = this._context.previewLayer;
    t.clear();
    for (let e = 0; e < this._vertices.length; e++)
      t.add({
        id: `__polygon-vertex-${e}__`,
        geometry: { type: "Point", coordinates: this._vertices[e] },
        attributes: { __preview: !0, __type: "vertex" }
      });
    if (this._vertices.length >= 2) {
      const e = this._vertices.map((s) => [...s]);
      this._cursorPos && e.push([...this._cursorPos]), e.push([...e[0]]), t.add({
        id: "__polygon-preview__",
        geometry: { type: "Polygon", coordinates: [e] },
        attributes: { __preview: !0, __type: "rubberband" }
      });
    } else this._vertices.length === 1 && this._cursorPos && t.add({
      id: "__polygon-line-preview__",
      geometry: {
        type: "LineString",
        coordinates: [[...this._vertices[0]], [...this._cursorPos]]
      },
      attributes: { __preview: !0, __type: "rubberband" }
    });
    this._cursorPos && t.add({
      id: "__polygon-cursor__",
      geometry: { type: "Point", coordinates: this._cursorPos },
      attributes: { __preview: !0, __type: "cursor" }
    }), C.render(t, this._lastSnap), this.markDirty();
  }
}
class I {
  constructor(t, e, s, i, n) {
    this._layer = t, this._feature = e, this._oldGeom = JSON.stringify(s), this._newGeom = JSON.stringify(i), this.description = n;
  }
  description;
  _oldGeom;
  // JSON snapshot
  _newGeom;
  execute() {
    this._feature.geometry = JSON.parse(this._newGeom), this._layer.add({ ...this._feature, geometry: this._feature.geometry });
  }
  undo() {
    this._feature.geometry = JSON.parse(this._oldGeom), this._layer.add({ ...this._feature, geometry: this._feature.geometry });
  }
}
class pt extends w {
  id = "edit";
  name = "Edit";
  _editableLayers;
  _hitTolerance;
  // Selection state
  _selectedFeature = null;
  _selectedLayerId = null;
  _editableVertices = [];
  // Editable vertices (no duplicate closing vertex)
  _isClosedRing = !1;
  // Whether original geometry has a closed ring
  // Vertex drag state
  _draggingVertexIndex = null;
  _dragGeomSnapshot = null;
  _isDragging = !1;
  // Feature move drag state
  _draggingFeature = !1;
  _dragLastMapCoords = null;
  // Hover state for cursor feedback
  _hoveredVertexIndex = null;
  constructor(t) {
    super(), this._editableLayers = t.editableLayers, this._hitTolerance = t.hitTolerance ?? 12;
  }
  onActivate(t) {
    this._cursor = "pointer", this._clearSelection();
  }
  onDeactivate() {
    this._clearSelection(), this._context?.previewLayer.clear();
  }
  onPointerDown(t) {
    if (!t.mapCoords || !this._context) return !1;
    if (this._state === "editing" && this._selectedFeature) {
      if (this._editableVertices.length > 0) {
        const s = Y(
          this._editableVertices,
          t.screenX,
          t.screenY,
          this._context.toScreen,
          this._hitTolerance
        );
        if (s)
          return this._draggingVertexIndex = s.index, this._dragGeomSnapshot = JSON.parse(JSON.stringify(this._selectedFeature.geometry)), this._isDragging = !1, this._cursor = "move", !0;
      }
      if (this._editableVertices.length >= 2) {
        const s = this._hitTestMidpoints(t.screenX, t.screenY);
        if (s !== null) {
          const i = JSON.parse(JSON.stringify(this._selectedFeature.geometry)), n = s.coords;
          this._editableVertices.splice(s.insertIndex, 0, n), this._writeVerticesToGeometry();
          const o = JSON.parse(JSON.stringify(this._selectedFeature.geometry)), c = this._findLayer(this._selectedLayerId);
          if (c) {
            this._selectedFeature.geometry = JSON.parse(JSON.stringify(i));
            const a = new I(
              c,
              this._selectedFeature,
              i,
              o,
              "Insert vertex at midpoint"
            );
            this._context.commands.execute(a), this._readVerticesFromGeometry();
          }
          return this._draggingVertexIndex = s.insertIndex, this._dragGeomSnapshot = JSON.parse(JSON.stringify(this._selectedFeature.geometry)), this._isDragging = !1, this._cursor = "move", this._updateEditPreview(), !0;
        }
      }
      const e = this._featureScreenDistance(
        this._selectedFeature,
        t.screenX,
        t.screenY,
        this._context.toScreen
      );
      if (e !== null && e <= this._hitTolerance * 2)
        return this._draggingFeature = !0, this._dragLastMapCoords = [...t.mapCoords], this._dragGeomSnapshot = JSON.parse(JSON.stringify(this._selectedFeature.geometry)), this._isDragging = !1, this._cursor = "grab", !0;
    }
    return !1;
  }
  onPointerMove(t) {
    if (!t.mapCoords || !this._context) return !1;
    if (this._draggingVertexIndex !== null && this._dragGeomSnapshot)
      return this._isDragging = !0, this._editableVertices[this._draggingVertexIndex] = [...t.mapCoords], this._writeVerticesToGeometry(), this._updateEditPreview(), this.markDirty(), !0;
    if (this._draggingFeature && this._dragLastMapCoords) {
      this._isDragging = !0;
      const e = t.mapCoords[0] - this._dragLastMapCoords[0], s = t.mapCoords[1] - this._dragLastMapCoords[1];
      this._dragLastMapCoords = [...t.mapCoords];
      for (let i = 0; i < this._editableVertices.length; i++)
        this._editableVertices[i] = [
          this._editableVertices[i][0] + e,
          this._editableVertices[i][1] + s
        ];
      return this._writeVerticesToGeometry(), this._updateEditPreview(), this.markDirty(), !0;
    }
    if (this._state === "editing" && this._editableVertices.length > 0) {
      const e = Y(
        this._editableVertices,
        t.screenX,
        t.screenY,
        this._context.toScreen,
        this._hitTolerance
      );
      if (e)
        this._hoveredVertexIndex = e.index, this._cursor = "move";
      else if (this._selectedFeature) {
        this._hoveredVertexIndex = null;
        const s = this._featureScreenDistance(
          this._selectedFeature,
          t.screenX,
          t.screenY,
          this._context.toScreen
        );
        this._cursor = s !== null && s <= this._hitTolerance * 2 ? "grab" : "pointer";
      } else
        this._hoveredVertexIndex = null, this._cursor = "pointer";
    }
    return !1;
  }
  onPointerUp(t) {
    if (!t.mapCoords || !this._context) return !1;
    if (this._draggingVertexIndex !== null && this._dragGeomSnapshot) {
      if (this._isDragging && this._selectedFeature) {
        this._editableVertices[this._draggingVertexIndex] = [...t.mapCoords], this._writeVerticesToGeometry();
        const s = JSON.parse(JSON.stringify(this._selectedFeature.geometry)), i = this._findLayer(this._selectedLayerId);
        if (i) {
          this._selectedFeature.geometry = JSON.parse(JSON.stringify(this._dragGeomSnapshot));
          const n = new I(
            i,
            this._selectedFeature,
            this._dragGeomSnapshot,
            s,
            `Move vertex ${this._draggingVertexIndex}`
          );
          this._context.commands.execute(n), this._readVerticesFromGeometry(), this._updateEditPreview(), this._context.emitEvent("feature-update", {
            feature: this._selectedFeature,
            layerId: this._selectedLayerId
          });
        }
      }
      return this._draggingVertexIndex = null, this._dragGeomSnapshot = null, this._isDragging = !1, this._cursor = "pointer", this.markDirty(), !0;
    }
    if (this._draggingFeature && this._dragGeomSnapshot) {
      if (this._isDragging && this._selectedFeature) {
        const s = JSON.parse(JSON.stringify(this._selectedFeature.geometry)), i = this._findLayer(this._selectedLayerId);
        if (i) {
          this._selectedFeature.geometry = JSON.parse(JSON.stringify(this._dragGeomSnapshot));
          const n = new I(
            i,
            this._selectedFeature,
            this._dragGeomSnapshot,
            s,
            "Move feature"
          );
          this._context.commands.execute(n), this._readVerticesFromGeometry(), this._updateEditPreview(), this._context.emitEvent("feature-update", {
            feature: this._selectedFeature,
            layerId: this._selectedLayerId
          });
        }
      }
      return this._draggingFeature = !1, this._dragLastMapCoords = null, this._dragGeomSnapshot = null, this._isDragging = !1, this._cursor = "pointer", this.markDirty(), !0;
    }
    const e = this._hitTestFeatures(t.screenX, t.screenY);
    return e ? (this._selectFeature(e.feature, e.layerId), !0) : (this._state === "editing" && (this._clearSelection(), this._context.previewLayer.clear(), this._state = "active", this.markDirty()), !1);
  }
  onDoubleClick(t) {
    if (!this._context || !t.mapCoords) return !1;
    if (this._state === "editing" && this._editableVertices.length >= 2 && this._selectedFeature) {
      const e = nt(
        this._editableVertices,
        t.screenX,
        t.screenY,
        this._context.toScreen,
        this._hitTolerance * 2
      );
      if (e) {
        const s = JSON.parse(JSON.stringify(this._selectedFeature.geometry));
        this._editableVertices.splice(e.edgeIndex + 1, 0, [...t.mapCoords]), this._writeVerticesToGeometry();
        const i = JSON.parse(JSON.stringify(this._selectedFeature.geometry)), n = this._findLayer(this._selectedLayerId);
        if (n) {
          this._selectedFeature.geometry = JSON.parse(JSON.stringify(s));
          const o = new I(
            n,
            this._selectedFeature,
            s,
            i,
            `Insert vertex at edge ${e.edgeIndex}`
          );
          this._context.commands.execute(o), this._readVerticesFromGeometry(), this._updateEditPreview();
        }
        return !0;
      }
    }
    return !1;
  }
  onKeyDown(t) {
    if (!this._context || this._state !== "editing" || !this._selectedFeature) return !1;
    if ((t.key === "Delete" || t.key === "Backspace") && this._hoveredVertexIndex !== null) {
      const e = this._hoveredVertexIndex;
      if (this._editableVertices.length <= this._minVertexCount()) return !1;
      const s = JSON.parse(JSON.stringify(this._selectedFeature.geometry));
      this._editableVertices.splice(e, 1), this._writeVerticesToGeometry();
      const i = JSON.parse(JSON.stringify(this._selectedFeature.geometry)), n = this._findLayer(this._selectedLayerId);
      if (n) {
        this._selectedFeature.geometry = JSON.parse(JSON.stringify(s));
        const o = new I(
          n,
          this._selectedFeature,
          s,
          i,
          `Delete vertex ${e}`
        );
        this._context.commands.execute(o), this._readVerticesFromGeometry(), this._updateEditPreview();
      }
      return this._hoveredVertexIndex = null, !0;
    }
    return !1;
  }
  cancel() {
    this._clearSelection(), this._state = "active", this._cursor = "pointer", this._context?.previewLayer.clear(), this.markDirty();
  }
  // ─── Private: Selection ───
  _selectFeature(t, e) {
    this._selectedFeature = t, this._selectedLayerId = e, this._readVerticesFromGeometry(), this._state = "editing", this._cursor = "pointer", this._context?.emitEvent("feature-select", { feature: t, layerId: e }), this._updateEditPreview();
  }
  _clearSelection() {
    this._selectedFeature = null, this._selectedLayerId = null, this._editableVertices = [], this._isClosedRing = !1, this._draggingVertexIndex = null, this._draggingFeature = !1, this._dragLastMapCoords = null, this._dragGeomSnapshot = null, this._isDragging = !1, this._hoveredVertexIndex = null;
  }
  // ─── Private: Vertex ↔ Geometry Sync ───
  /**
   * Read editable vertices from the selected feature's geometry.
   * For closed polygon rings, the duplicate closing vertex is omitted.
   */
  _readVerticesFromGeometry() {
    if (!this._selectedFeature) {
      this._editableVertices = [];
      return;
    }
    const t = this._selectedFeature.geometry, e = [];
    if (this._flattenCoords(t.coordinates, e), t.type === "Polygon" || t.type === "MultiPolygon") {
      if (this._isClosedRing = !0, e.length >= 2) {
        const s = e[0], i = e[e.length - 1];
        s[0] === i[0] && s[1] === i[1] && e.pop();
      }
    } else
      this._isClosedRing = !1;
    this._editableVertices = e;
  }
  /**
   * Write editable vertices back into the selected feature's geometry.
   * For closed polygon rings, the closing vertex is auto-appended.
   */
  _writeVerticesToGeometry() {
    if (!this._selectedFeature) return;
    const t = this._selectedFeature.geometry, e = [...this._editableVertices];
    switch (this._isClosedRing && e.length >= 1 && e.push([...e[0]]), t.type) {
      case "Point":
        e[0] && (t.coordinates = [...e[0]]);
        break;
      case "MultiPoint":
      case "LineString":
        t.coordinates = e;
        break;
      case "Polygon": {
        t.coordinates = [e];
        break;
      }
      case "MultiLineString":
        t.coordinates = [e];
        break;
      case "MultiPolygon":
        t.coordinates = [[e]];
        break;
    }
    const s = this._findLayer(this._selectedLayerId);
    s && s.add({ ...this._selectedFeature, geometry: t });
  }
  // ─── Private: Hit Testing ───
  /**
   * Hit-test all editable features using vertex proximity + edge proximity.
   * For polygons, also uses point-in-polygon.
   */
  _hitTestFeatures(t, e) {
    if (!this._context) return null;
    const s = this._context.toScreen;
    let i = null;
    for (const n of this._editableLayers) {
      const o = n.getFeatures();
      for (const c of o) {
        const a = this._featureScreenDistance(c, t, e, s);
        a !== null && a <= this._hitTolerance * 2 && (!i || a < i.dist) && (i = { feature: c, layerId: n.id, dist: a });
      }
    }
    return i;
  }
  /**
   * Compute screen distance from a point to a feature.
   * Uses vertex + edge proximity for lines/points.
   * For polygons, also checks point-in-polygon (returns 0 if inside).
   */
  _featureScreenDistance(t, e, s, i) {
    const n = t.geometry.type;
    if (n === "Polygon" || n === "MultiPolygon") {
      const a = this._extractScreenRings(t.geometry, i);
      for (const _ of a)
        if (this._pointInRing(e, s, _))
          return 0;
    }
    const o = [];
    if (this._flattenCoords(t.geometry.coordinates, o), o.length === 0) return null;
    let c = 1 / 0;
    for (const a of o) {
      const _ = i(a[0], a[1]);
      if (!_) continue;
      const h = m(e, s, _[0], _[1]);
      h < c && (c = h);
    }
    if (o.length >= 2)
      for (let a = 0; a < o.length - 1; a++) {
        const _ = i(o[a][0], o[a][1]), h = i(o[a + 1][0], o[a + 1][1]);
        if (!_ || !h) continue;
        const u = this._pointToSegDist(e, s, _[0], _[1], h[0], h[1]);
        u < c && (c = u);
      }
    return isFinite(c) ? c : null;
  }
  /**
   * Extract polygon outer rings as screen-space coordinate arrays.
   */
  _extractScreenRings(t, e) {
    const s = [], i = t.coordinates;
    if (t.type === "Polygon") {
      const n = i;
      if (n[0]) {
        const o = [];
        for (const c of n[0]) {
          const a = e(c[0], c[1]);
          a && o.push(a);
        }
        o.length >= 3 && s.push(o);
      }
    } else if (t.type === "MultiPolygon") {
      const n = i;
      for (const o of n)
        if (o[0]) {
          const c = [];
          for (const a of o[0]) {
            const _ = e(a[0], a[1]);
            _ && c.push(_);
          }
          c.length >= 3 && s.push(c);
        }
    }
    return s;
  }
  /**
   * Ray-casting point-in-polygon test (screen space).
   */
  _pointInRing(t, e, s) {
    let i = !1;
    for (let n = 0, o = s.length - 1; n < s.length; o = n++) {
      const c = s[n][0], a = s[n][1], _ = s[o][0], h = s[o][1];
      a > e != h > e && t < (_ - c) * (e - a) / (h - a) + c && (i = !i);
    }
    return i;
  }
  _pointToSegDist(t, e, s, i, n, o) {
    const c = n - s, a = o - i, _ = c * c + a * a;
    if (_ === 0) return m(t, e, s, i);
    let h = ((t - s) * c + (e - i) * a) / _;
    return h = Math.max(0, Math.min(1, h)), m(t, e, s + h * c, i + h * a);
  }
  // ─── Private: Helpers ───
  /**
   * Hit-test midpoint handles. Returns the insert index and midpoint coords if hit.
   */
  _hitTestMidpoints(t, e) {
    if (!this._context) return null;
    const s = this._context.toScreen;
    for (let i = 0; i < this._editableVertices.length - 1; i++) {
      const n = T(this._editableVertices[i], this._editableVertices[i + 1]), o = s(n[0], n[1]);
      if (!o) continue;
      if (m(t, e, o[0], o[1]) <= this._hitTolerance)
        return { insertIndex: i + 1, coords: n };
    }
    if (this._isClosedRing && this._editableVertices.length >= 3) {
      const i = this._editableVertices[0], n = this._editableVertices[this._editableVertices.length - 1], o = T(n, i), c = s(o[0], o[1]);
      if (c && m(t, e, c[0], c[1]) <= this._hitTolerance)
        return { insertIndex: this._editableVertices.length, coords: o };
    }
    return null;
  }
  _findLayer(t) {
    return t ? this._editableLayers.find((e) => e.id === t) ?? null : null;
  }
  _minVertexCount() {
    if (!this._selectedFeature) return 1;
    switch (this._selectedFeature.geometry.type) {
      case "Point":
        return 1;
      case "LineString":
      case "MultiLineString":
        return 2;
      case "Polygon":
      case "MultiPolygon":
        return 3;
      default:
        return 1;
    }
  }
  _flattenCoords(t, e) {
    if (!(!Array.isArray(t) || t.length === 0)) {
      if (typeof t[0] == "number") {
        e.push([t[0], t[1] ?? 0]);
        return;
      }
      for (const s of t)
        this._flattenCoords(s, e);
    }
  }
  _updateEditPreview() {
    if (!this._context) return;
    const t = this._context.previewLayer;
    t.clear();
    for (let e = 0; e < this._editableVertices.length; e++) {
      const s = this._hoveredVertexIndex === e;
      t.add({
        id: `__edit-vertex-${e}__`,
        geometry: { type: "Point", coordinates: this._editableVertices[e] },
        attributes: {
          __preview: !0,
          __type: s ? "vertex-handle-hover" : "vertex-handle"
        }
      });
    }
    for (let e = 0; e < this._editableVertices.length - 1; e++) {
      const s = T(this._editableVertices[e], this._editableVertices[e + 1]);
      t.add({
        id: `__edit-midpoint-${e}__`,
        geometry: { type: "Point", coordinates: s },
        attributes: { __preview: !0, __type: "midpoint-handle" }
      });
    }
    if (this._isClosedRing && this._editableVertices.length >= 3) {
      const e = this._editableVertices[0], s = this._editableVertices[this._editableVertices.length - 1], i = T(s, e);
      t.add({
        id: "__edit-midpoint-close__",
        geometry: { type: "Point", coordinates: i },
        attributes: { __preview: !0, __type: "midpoint-handle" }
      });
    }
    this.markDirty();
  }
}
const k = Math.PI / 180;
function tt(r, t) {
  return r / (111320 * Math.cos(t * k));
}
function et(r) {
  return r / 110540;
}
function R(r, t, e, s) {
  const i = tt(e, t), n = et(s);
  return [
    [r - i, t - n],
    [r + i, t - n],
    [r + i, t + n],
    [r - i, t + n],
    [r - i, t - n]
    // close
  ];
}
function U(r, t, e, s = 32) {
  const i = [];
  for (let n = 0; n <= s; n++) {
    const o = n / s * Math.PI * 2;
    i.push([
      r + tt(Math.cos(o) * e, t),
      t + et(Math.sin(o) * e)
    ]);
  }
  return i;
}
function B(r, t, e, s) {
  const i = (e - r) * k, n = (s - t) * k, o = Math.sin(n / 2) ** 2 + Math.cos(t * k) * Math.cos(s * k) * Math.sin(i / 2) ** 2;
  return 6371e3 * 2 * Math.atan2(Math.sqrt(o), Math.sqrt(1 - o));
}
class Vt extends w {
  id = "place-geometry";
  name = "Place Geometry";
  _targetLayer;
  _geometryType;
  color;
  _heightSensitivity;
  _phase = "idle";
  _center = null;
  _radiusM = 0;
  _heightM = 0;
  _extrudeAnchorY = 0;
  /** External callback for live 3D preview during extrusion. */
  onExtrusionPreview = null;
  constructor(t) {
    super(), this._targetLayer = t.targetLayer, this._geometryType = t.geometryType ?? "cylinder", this.color = t.color ?? [88, 166, 255, 220], this._heightSensitivity = t.heightSensitivity ?? 2;
  }
  setGeometryType(t) {
    this._geometryType = t;
  }
  setColor(t) {
    this.color = t;
  }
  get geometryType() {
    return this._geometryType;
  }
  get phase() {
    return this._phase;
  }
  get currentRadius() {
    return this._radiusM;
  }
  get currentHeight() {
    return this._heightM;
  }
  onActivate(t) {
    this._cursor = "crosshair", this._reset();
  }
  onDeactivate() {
    this._reset(), this._context?.previewLayer.clear();
  }
  onPointerDown(t) {
    return !t.mapCoords || !this._context ? !1 : this._phase === "idle" ? (this._center = [...t.mapCoords], this._radiusM = 0, this._heightM = 0, this._phase = "sizing", this._state = "drawing", this._cursor = "move", this._updatePreview(), !0) : this._phase === "extruding" ? (this._createFeature(), !0) : !1;
  }
  onPointerMove(t) {
    if (!this._context || !this._center) return !1;
    if (this._phase === "sizing" && t.mapCoords)
      return this._radiusM = Math.max(
        B(this._center[0], this._center[1], t.mapCoords[0], t.mapCoords[1]),
        5
      ), this._updatePreview(), !1;
    if (this._phase === "extruding") {
      const e = this._extrudeAnchorY - t.screenY;
      return this._heightM = Math.max(e * this._heightSensitivity, 1), this._updatePreview(), this.onExtrusionPreview && this._center && this.onExtrusionPreview(this._center, this._radiusM, this._heightM, this._geometryType), !1;
    }
    return !1;
  }
  onPointerUp(t) {
    return this._phase !== "sizing" || !this._center || !this._context ? !1 : (t.mapCoords && (this._radiusM = B(this._center[0], this._center[1], t.mapCoords[0], t.mapCoords[1])), this._radiusM = Math.max(this._radiusM, 10), this._heightM = 1, this._extrudeAnchorY = t.screenY, this._phase = "extruding", this._cursor = "ns-resize", this.onExtrusionPreview && this._center && this.onExtrusionPreview(this._center, this._radiusM, this._heightM, this._geometryType), this._updatePreview(), !0);
  }
  onDoubleClick(t) {
    return this._phase === "extruding" ? (this._createFeature(), !0) : !1;
  }
  onKeyDown(t) {
    return t.key === "Escape" && this._phase !== "idle" ? (this.cancel(), !0) : t.key === "Enter" && this._phase === "extruding" ? (this._createFeature(), !0) : !1;
  }
  cancel() {
    this.onExtrusionPreview && this._center && this.onExtrusionPreview(this._center, 0, 0, this._geometryType), this._reset(), this._context?.previewLayer.clear(), this.markDirty();
  }
  // ─── Private ───
  _reset() {
    this._center = null, this._radiusM = 0, this._heightM = 0, this._extrudeAnchorY = 0, this._phase = "idle", this._state = "active", this._cursor = "crosshair";
  }
  _createFeature() {
    if (!this._center || !this._context) return;
    let t;
    if (this._geometryType === "box" || this._geometryType === "cylinder") {
      const s = this._geometryType === "box" ? R(this._center[0], this._center[1], this._radiusM, this._radiusM) : U(this._center[0], this._center[1], this._radiusM, 32);
      t = {
        id: x(),
        geometry: { type: "Polygon", coordinates: [s] },
        attributes: {
          geometryType: this._geometryType,
          radius: Math.round(this._radiusM),
          height: Math.round(this._heightM),
          minHeight: 0
        }
      };
    } else
      t = {
        id: x(),
        geometry: { type: "Point", coordinates: [this._center[0], this._center[1]] },
        attributes: {
          geometryType: this._geometryType,
          radius: Math.round(this._radiusM),
          height: Math.round(this._heightM)
        }
      };
    const e = new L(this._targetLayer, t);
    this._context.commands.execute(e), this._context.emitEvent("draw-complete", { toolId: this.id, feature: t }), this._reset(), this._context.previewLayer.clear(), this.markDirty();
  }
  _updatePreview() {
    if (!this._context || !this._center) return;
    const t = this._context.previewLayer;
    if (t.clear(), t.add({
      id: "__place-center__",
      geometry: { type: "Point", coordinates: this._center },
      attributes: { __preview: !0, __type: "vertex" }
    }), this._radiusM > 0) {
      const e = this._geometryType === "box" ? R(this._center[0], this._center[1], this._radiusM, this._radiusM) : U(this._center[0], this._center[1], this._radiusM, 32);
      t.add({
        id: "__place-footprint__",
        geometry: { type: "Polygon", coordinates: [e] },
        attributes: { __preview: !0, __type: "rubberband" }
      }), t.add({
        id: "__place-radius__",
        geometry: { type: "LineString", coordinates: [this._center, e[0]] },
        attributes: { __preview: !0, __type: "rubberband" }
      });
    }
    this._phase === "extruding" ? t.add({
      id: "__place-info__",
      geometry: { type: "Point", coordinates: this._center },
      attributes: {
        __preview: !0,
        __type: "cursor",
        label: `r=${Math.round(this._radiusM)}m h=${Math.round(this._heightM)}m`
      }
    }) : this._phase === "sizing" && this._radiusM > 0 && t.add({
      id: "__place-info__",
      geometry: { type: "Point", coordinates: this._center },
      attributes: {
        __preview: !0,
        __type: "cursor",
        label: `r=${Math.round(this._radiusM)}m`
      }
    }), this.markDirty();
  }
}
const F = 1e-10;
function N(r, t, e, s) {
  return r * s - t * e;
}
function yt(r, t, e) {
  return [r[0] + e * (t[0] - r[0]), r[1] + e * (t[1] - r[1])];
}
function mt(r, t) {
  return [(r[0] + t[0]) / 2, (r[1] + t[1]) / 2];
}
function vt(r, t, e, s) {
  const i = t[0] - r[0], n = t[1] - r[1], o = s[0] - e[0], c = s[1] - e[1], a = N(i, n, o, c);
  if (Math.abs(a) < F) return null;
  const _ = e[0] - r[0], h = e[1] - r[1], u = N(_, h, o, c) / a, l = N(_, h, i, n) / a;
  return u < 0 || u > 1 || l < 0 || l > 1 ? null : [r[0] + u * i, r[1] + u * n];
}
function xt(r) {
  const t = [];
  switch (r.type) {
    case "Point":
    case "MultiPoint":
      break;
    case "LineString":
      H(r.coordinates, t);
      break;
    case "MultiLineString":
      for (const e of r.coordinates)
        H(e, t);
      break;
    case "Polygon":
      for (const e of r.coordinates)
        z(e, t);
      break;
    case "MultiPolygon":
      for (const e of r.coordinates)
        for (const s of e)
          z(s, t);
      break;
  }
  return t;
}
function H(r, t) {
  for (let e = 0; e < r.length - 1; e++)
    t.push([
      [r[e][0], r[e][1]],
      [r[e + 1][0], r[e + 1][1]]
    ]);
}
function z(r, t) {
  if (r.length < 2) return;
  for (let i = 0; i < r.length - 1; i++)
    t.push([
      [r[i][0], r[i][1]],
      [r[i + 1][0], r[i + 1][1]]
    ]);
  const e = r[0], s = r[r.length - 1];
  (Math.abs(e[0] - s[0]) > F || Math.abs(e[1] - s[1]) > F) && t.push([
    [s[0], s[1]],
    [e[0], e[1]]
  ]);
}
function bt(r) {
  const t = [];
  return st(r.coordinates, t), t;
}
function st(r, t) {
  if (!(!Array.isArray(r) || r.length === 0)) {
    if (typeof r[0] == "number") {
      t.push([r[0], r[1] ?? 0]);
      return;
    }
    for (const e of r)
      st(e, t);
  }
}
function wt(r, t, e, s, i) {
  const n = i(r[0], r[1]), o = i(t[0], t[1]);
  if (!n || !o) return null;
  const { distance: c, t: a } = Z(e, s, n[0], n[1], o[0], o[1]);
  return { coords: yt(r, t, a), screenDistance: c, t: a };
}
function Pt(r, t) {
  const e = [], s = Math.PI / 180;
  for (const i of r)
    for (const n of t) {
      const o = n * s, c = Math.sin(o), a = Math.cos(o);
      e.push({ origin: i, direction: [c, a], angleDeg: n });
    }
  return e;
}
function Mt(r, t, e, s, i) {
  const o = s(r.origin[0], r.origin[1]);
  if (!o) return null;
  const c = [
    r.origin[0] + r.direction[0] * 0.01,
    r.origin[1] + r.direction[1] * 0.01
  ], a = s(c[0], c[1]);
  if (!a) return null;
  const _ = a[0] - o[0], h = a[1] - o[1], u = _ * _ + h * h;
  if (u < F) return null;
  const l = ((t - o[0]) * _ + (e - o[1]) * h) / u, g = o[0] + l * _, p = o[1] + l * h, P = m(t, e, g, p);
  return P > i ? null : { coords: [
    r.origin[0] + l * 0.01 * r.direction[0],
    r.origin[1] + l * 0.01 * r.direction[1]
  ], screenDistance: P };
}
const St = 5;
class Dt {
  _origins = [];
  _hoverThreshold;
  _hover = null;
  constructor(t = 500) {
    this._hoverThreshold = t;
  }
  /** Explicitly add an origin (e.g., when user places a vertex). */
  addOrigin(t) {
    this._origins.some(
      (s) => Math.abs(s[0] - t[0]) < 1e-6 && Math.abs(s[1] - t[1]) < 1e-6
    ) || (this._origins.push([...t]), this._origins.length > St && this._origins.shift());
  }
  /** Update hover tracking. Call on every pointer move. */
  updateHover(t, e = Date.now()) {
    if (!t) {
      this._hover = null;
      return;
    }
    if (this._hover) {
      const s = Math.abs(this._hover.coords[0] - t[0]), i = Math.abs(this._hover.coords[1] - t[1]);
      if (s < 1e-6 && i < 1e-6) {
        e - this._hover.startTime >= this._hoverThreshold && (this.addOrigin(t), this._hover = null);
        return;
      }
    }
    this._hover = { coords: [...t], startTime: e };
  }
  /**
   * Find the best angle guide snap for the current cursor position.
   * Returns a partial SnapCandidate (coords + screenDistance) or null.
   */
  findGuideSnap(t, e, s, i, n) {
    if (this._origins.length === 0) return null;
    const o = Pt(this._origins, n);
    let c = null;
    for (const a of o) {
      const _ = Mt(a, t, e, s, i);
      _ && (!c || _.screenDistance < c.screenDistance) && (c = _);
    }
    return c;
  }
  /** Get current origins (read-only). */
  get origins() {
    return this._origins;
  }
  /** Clear all origins and hover state. */
  reset() {
    this._origins = [], this._hover = null;
  }
}
let it = class {
  _config;
  _sourceLayers = [];
  angleGuideManager;
  constructor(t) {
    this._config = _t(t), this.angleGuideManager = new Dt(
      this._config.angleGuideHoverThreshold
    );
  }
  /* ── Source layer management ─────────────────────────────────────── */
  addSourceLayer(t) {
    this._sourceLayers.push(t);
  }
  removeSourceLayer(t) {
    this._sourceLayers = this._sourceLayers.filter((e) => e !== t);
  }
  /* ── Configuration ───────────────────────────────────────────────── */
  get config() {
    return this._config;
  }
  setTolerance(t) {
    this._config.tolerance = t;
  }
  setEnabled(t) {
    this._config.enabled = t;
  }
  enableType(t) {
    this._config.enabledTypes.add(t);
  }
  disableType(t) {
    this._config.enabledTypes.delete(t);
  }
  /* ── Main snap method ────────────────────────────────────────────── */
  /**
   * Extra vertices to include in endpoint snapping (e.g. in-progress drawing vertices).
   * Set by drawing tools before calling snap(), cleared after draw-complete.
   */
  activeVertices = [];
  snap(t, e, s, i) {
    const n = { coords: s, type: "none", candidates: [] };
    if (!this._config.enabled) return n;
    const o = [], { enabledTypes: c, tolerance: a, priorities: _ } = this._config, h = (l) => _[l] ?? Q[l], u = [];
    for (const l of this._sourceLayers)
      for (const g of l.getFeatures()) {
        if (g.attributes.__preview) continue;
        const p = g.geometry;
        if (c.has(d.EndPoint)) {
          const v = bt(p);
          for (const y of v) {
            const f = i(y[0], y[1]);
            if (!f) continue;
            const b = m(t, e, f[0], f[1]);
            b <= a && o.push({
              coords: y,
              type: d.EndPoint,
              screenDistance: b,
              sourceFeatureId: g.id,
              priority: h(d.EndPoint)
            });
          }
        }
        if (c.has(d.Point) && p.type === "Point") {
          const v = p.coordinates, y = [v[0], v[1]], f = i(y[0], y[1]);
          if (f) {
            const b = m(t, e, f[0], f[1]);
            b <= a && o.push({
              coords: y,
              type: d.Point,
              screenDistance: b,
              sourceFeatureId: g.id,
              priority: h(d.Point)
            });
          }
        }
        const P = xt(p);
        if (c.has(d.MidPoint))
          for (const [v, y] of P) {
            const f = mt(v, y), b = i(f[0], f[1]);
            if (!b) continue;
            const J = m(t, e, b[0], b[1]);
            J <= a && o.push({
              coords: f,
              type: d.MidPoint,
              screenDistance: J,
              sourceFeatureId: g.id,
              priority: h(d.MidPoint)
            });
          }
        if (c.has(d.Nearest))
          for (const [v, y] of P) {
            const f = wt(v, y, t, e, i);
            f && (f.t < 0.02 || f.t > 0.98 || f.screenDistance <= a && o.push({
              coords: f.coords,
              type: d.Nearest,
              screenDistance: f.screenDistance,
              sourceFeatureId: g.id,
              priority: h(d.Nearest)
            }));
          }
        if (c.has(d.Intersection))
          for (const [v, y] of P)
            u.push({ a: v, b: y, featureId: g.id });
      }
    if (c.has(d.EndPoint) && this.activeVertices.length > 0)
      for (const l of this.activeVertices) {
        const g = i(l[0], l[1]);
        if (!g) continue;
        const p = m(t, e, g[0], g[1]);
        p <= a && o.push({
          coords: l,
          type: d.EndPoint,
          screenDistance: p,
          priority: h(d.EndPoint)
        });
      }
    if (c.has(d.Intersection) && u.length > 1 && this._findIntersections(u, t, e, a, i, h, o), c.has(d.AngleGuide) && o.length === 0) {
      const l = this.angleGuideManager.findGuideSnap(
        t,
        e,
        i,
        a,
        this._config.angleGuideIntervals
      );
      l && o.push({
        ...l,
        type: d.AngleGuide,
        priority: h(d.AngleGuide)
      });
    }
    if (o.sort(lt), o.length > 0) {
      const l = o[0];
      return {
        coords: l.coords,
        type: l.type,
        sourceFeatureId: l.sourceFeatureId,
        candidates: o
      };
    }
    return n;
  }
  /* ── Intersection detection ──────────────────────────────────────── */
  _findIntersections(t, e, s, i, n, o, c) {
    for (let a = 0; a < t.length; a++)
      for (let _ = a + 1; _ < t.length; _++) {
        const h = t[a], u = t[_];
        if (h.featureId === u.featureId) continue;
        const l = vt(h.a, h.b, u.a, u.b);
        if (!l) continue;
        const g = n(l[0], l[1]);
        if (!g) continue;
        const p = m(e, s, g[0], g[1]);
        p <= i && c.push({
          coords: l,
          type: d.Intersection,
          screenDistance: p,
          priority: o(d.Intersection)
        });
      }
  }
};
class Nt {
  _inner;
  constructor(t = {}) {
    const e = /* @__PURE__ */ new Set();
    t.vertex !== !1 && e.add(d.EndPoint), t.edge === !0 && e.add(d.Nearest), this._inner = new it({
      tolerance: t.tolerance ?? 10,
      enabledTypes: e
    });
  }
  addSourceLayer(t) {
    this._inner.addSourceLayer(t);
  }
  removeSourceLayer(t) {
    this._inner.removeSourceLayer(t);
  }
  snap(t, e, s, i) {
    const n = this._inner.snap(t, e, s, i);
    let o = "none";
    return n.type === d.EndPoint || n.type === d.Point ? o = "vertex" : n.type === d.Nearest && (o = "edge"), {
      coords: n.coords,
      type: o,
      sourceFeatureId: n.sourceFeatureId
    };
  }
  get options() {
    const t = this._inner.config;
    return {
      vertex: t.enabledTypes.has(d.EndPoint),
      edge: t.enabledTypes.has(d.Nearest),
      tolerance: t.tolerance
    };
  }
  setTolerance(t) {
    this._inner.setTolerance(t);
  }
}
class At {
  constructor(t, e, s) {
    this._vertices = t, this._coords = e, this._index = s, this.description = `Add vertex at [${e[0].toFixed(4)}, ${e[1].toFixed(4)}]`;
  }
  description;
  execute() {
    this._index !== void 0 ? this._vertices.splice(this._index, 0, this._coords) : this._vertices.push(this._coords);
  }
  undo() {
    const t = this._index ?? this._vertices.length - 1;
    this._vertices.splice(t, 1);
  }
}
class $t {
  constructor(t, e) {
    this._vertices = t, this._index = e, this.description = `Remove vertex at index ${e}`;
  }
  description;
  _removedCoords = null;
  execute() {
    this._removedCoords = this._vertices[this._index] ?? null, this._vertices.splice(this._index, 1);
  }
  undo() {
    this._removedCoords && this._vertices.splice(this._index, 0, this._removedCoords);
  }
}
class Jt {
  constructor(t, e, s) {
    this._vertices = t, this._index = e, this._newCoords = s, this._oldCoords = [...t[e] ?? [0, 0]], this.description = `Move vertex ${e} to [${s[0].toFixed(4)}, ${s[1].toFixed(4)}]`;
  }
  description;
  _oldCoords;
  execute() {
    this._vertices[this._index] = [...this._newCoords];
  }
  undo() {
    this._vertices[this._index] = [...this._oldCoords];
  }
}
class Yt {
  constructor(t, e) {
    this._vertices = t, this._index = e, this.description = `Delete vertex at index ${e}`;
  }
  description;
  _removedCoords = null;
  execute() {
    this._removedCoords = this._vertices[this._index] ?? null, this._vertices.splice(this._index, 1);
  }
  undo() {
    this._removedCoords && this._vertices.splice(this._index, 0, this._removedCoords);
  }
}
class Rt {
  constructor(t, e, s, i) {
    this._targetLayer = t, this._feature = e, this._deltaLon = s, this._deltaLat = i, this._oldGeometry = JSON.parse(JSON.stringify(e.geometry)), this.description = `Move feature ${String(e.id)}`;
  }
  description;
  _oldGeometry;
  execute() {
    this._offsetCoordinates(this._feature.geometry.coordinates, this._deltaLon, this._deltaLat), this._targetLayer.add({ ...this._feature });
  }
  undo() {
    this._feature.geometry = JSON.parse(JSON.stringify(this._oldGeometry)), this._targetLayer.add({ ...this._feature });
  }
  _offsetCoordinates(t, e, s) {
    if (!(!Array.isArray(t) || t.length === 0)) {
      if (typeof t[0] == "number") {
        const i = t;
        i[0] = (i[0] ?? 0) + e, i[1] = (i[1] ?? 0) + s;
        return;
      }
      for (const i of t)
        this._offsetCoordinates(i, e, s);
    }
  }
}
const Ut = {
  type: "simple-marker",
  color: [0, 120, 255, 204],
  size: 8,
  outlineColor: [255, 255, 255, 255],
  outlineWidth: 2
}, Bt = {
  type: "simple-marker",
  color: [255, 255, 255, 255],
  size: 7,
  outlineColor: [0, 120, 255, 255],
  outlineWidth: 2
}, Ht = {
  type: "simple-marker",
  color: [0, 120, 255, 128],
  size: 5,
  outlineColor: [255, 255, 255, 204],
  outlineWidth: 1
}, zt = {
  type: "simple-line",
  color: [0, 120, 255, 204],
  width: 2,
  style: "solid"
}, Wt = {
  type: "simple-fill",
  color: [0, 120, 255, 38],
  outlineColor: [0, 120, 255, 204],
  outlineWidth: 2
}, Kt = {
  type: "simple-marker",
  color: [0, 120, 255, 255],
  size: 8,
  outlineColor: [255, 255, 255, 255],
  outlineWidth: 2
}, jt = {
  type: "simple-line",
  color: [0, 120, 255, 255],
  width: 2,
  style: "solid"
}, qt = {
  type: "simple-fill",
  color: [0, 120, 255, 77],
  outlineColor: [0, 120, 255, 255],
  outlineWidth: 2
}, Xt = {
  type: "simple-line",
  color: [0, 200, 255, 255],
  width: 3,
  style: "solid"
}, Zt = {
  type: "simple-fill",
  color: [0, 200, 255, 51],
  outlineColor: [0, 200, 255, 255],
  outlineWidth: 3
}, Qt = {
  type: "simple-marker",
  color: [0, 230, 64, 255],
  size: 10,
  outlineColor: [255, 255, 255, 255],
  outlineWidth: 2
}, te = {
  type: "simple-line",
  color: [180, 255, 0, 200],
  width: 1,
  style: "dash"
};
class $ extends w {
  _unitManager;
  _labelManager;
  _measurementLayer;
  _completedMeasurements = [];
  _unitsChangeHandler;
  constructor(t) {
    super(), this._unitManager = t.unitManager, this._labelManager = t.labelManager, this._measurementLayer = t.measurementLayer, this._unitsChangeHandler = () => this._onUnitsChange(), this._unitManager.on("units-change", this._unitsChangeHandler);
  }
  onActivate(t) {
    this._cursor = "crosshair";
  }
  onDeactivate() {
    this._labelManager.clearTransient(), this._context?.previewLayer.clear();
  }
  /**
   * Remove the last completed measurement.
   */
  clearLastMeasurement() {
    const t = this._completedMeasurements.pop();
    if (t) {
      for (const e of t.featureIds)
        this._measurementLayer.remove(e);
      for (const e of t.labelIds)
        this._labelManager.removeLabel(e);
      this._context?.emitEvent("measure-clear", { toolId: this.id }), this.markDirty();
    }
  }
  /**
   * Remove all completed measurements.
   */
  clearAllMeasurements() {
    for (const t of this._completedMeasurements) {
      for (const e of t.featureIds)
        this._measurementLayer.remove(e);
      for (const e of t.labelIds)
        this._labelManager.removeLabel(e);
    }
    this._completedMeasurements = [], this._context?.emitEvent("measure-clear", { toolId: this.id }), this.markDirty();
  }
  /**
   * Get all completed measurements.
   */
  getMeasurements() {
    return this._completedMeasurements;
  }
}
let Lt = 0;
class Ct extends $ {
  id = "measure-point";
  name = "Measure Point";
  _cursorPos = null;
  constructor(t) {
    super(t);
  }
  onActivate(t) {
    super.onActivate(t), this._cursorPos = null;
  }
  onDeactivate() {
    this._cursorPos = null, super.onDeactivate();
  }
  onPointerDown(t) {
    return !1;
  }
  onPointerMove(t) {
    return !t.mapCoords || !this._context || (this._cursorPos = t.mapCoords, this._updatePreview()), !1;
  }
  onPointerUp(t) {
    if (!t.mapCoords || !this._context) return !1;
    const [e, s] = t.mapCoords, i = `measure-point-${++Lt}`, n = x(), o = `${i}-label`;
    this._measurementLayer.add({
      id: n,
      geometry: { type: "Point", coordinates: [e, s] },
      attributes: { __measure: !0, __type: "point", __measureId: i }
    });
    const c = this._unitManager.formatCoordinate(e, s);
    this._labelManager.addLabel({
      id: o,
      geoPosition: [e, s],
      text: c,
      type: "coordinate",
      persistent: !0
    });
    const a = {
      id: i,
      type: "point",
      result: {
        coordinates: [e, s],
        vertices: [[e, s]]
      },
      featureIds: [n],
      labelIds: [o]
    };
    return this._completedMeasurements.push(a), this._context.emitEvent("measure-complete", {
      toolId: this.id,
      type: "point",
      result: a.result
    }), this.markDirty(), !0;
  }
  onDoubleClick(t) {
    return !1;
  }
  onKeyDown(t) {
    return !1;
  }
  cancel() {
    this._cursorPos = null, this._context?.previewLayer.clear(), this.markDirty();
  }
  _onUnitsChange() {
    for (const t of this._completedMeasurements)
      if (t.result.coordinates) {
        const [e, s] = t.result.coordinates, i = this._unitManager.formatCoordinate(e, s);
        for (const n of t.labelIds)
          this._labelManager.updateLabel(n, i);
      }
  }
  _updatePreview() {
    if (!this._context) return;
    const t = this._context.previewLayer;
    t.clear(), this._cursorPos && t.add({
      id: "__measure-point-cursor__",
      geometry: { type: "Point", coordinates: this._cursorPos },
      attributes: { __preview: !0, __type: "cursor" }
    }), this.markDirty();
  }
}
const A = 6371e3;
function M(r) {
  return r * Math.PI / 180;
}
function S(r, t, e, s) {
  const i = M(s - t), n = M(e - r), o = Math.sin(i / 2) * Math.sin(i / 2) + Math.cos(M(t)) * Math.cos(M(s)) * Math.sin(n / 2) * Math.sin(n / 2), c = 2 * Math.atan2(Math.sqrt(o), Math.sqrt(1 - o));
  return A * c;
}
function It(r) {
  const t = [];
  for (let e = 1; e < r.length; e++) {
    const s = r[e - 1], i = r[e];
    t.push(S(s[0], s[1], i[0], i[1]));
  }
  return t;
}
function W(r) {
  let t = 0;
  for (let e = 1; e < r.length; e++) {
    const s = r[e - 1], i = r[e];
    t += S(s[0], s[1], i[0], i[1]);
  }
  return t;
}
function K(r) {
  if (r.length < 3) return 0;
  let t = 0;
  const e = r.length;
  for (let i = 0; i < e; i++) {
    const n = (i + 1) % e, o = M(r[i][0]), c = M(r[i][1]), a = M(r[n][0]), _ = M(r[n][1]);
    t += (a - o) * (2 + Math.sin(c) + Math.sin(_));
  }
  return Math.abs(t / 2) * A * A;
}
function j(r) {
  if (r.length < 2) return 0;
  let t = 0;
  for (let e = 0; e < r.length; e++) {
    const s = r[e], i = r[(e + 1) % r.length];
    t += S(s[0], s[1], i[0], i[1]);
  }
  return t;
}
function E(r, t, e, s) {
  return [(r + e) / 2, (t + s) / 2];
}
function q(r) {
  if (r.length === 0) return [0, 0];
  let t = 0, e = 0;
  for (const s of r)
    t += s[0], e += s[1];
  return [t / r.length, e / r.length];
}
let kt = 0;
class Et extends $ {
  id = "measure-line";
  name = "Measure Distance";
  _vertices = [];
  _cursorPos = null;
  constructor(t) {
    super(t);
  }
  onActivate(t) {
    super.onActivate(t), this._vertices = [], this._cursorPos = null;
  }
  onDeactivate() {
    this._vertices = [], this._cursorPos = null, super.onDeactivate();
  }
  onPointerDown(t) {
    return !1;
  }
  onPointerMove(t) {
    return !t.mapCoords || !this._context || (this._cursorPos = t.mapCoords, this._updatePreview()), !1;
  }
  onPointerUp(t) {
    return !t.mapCoords || !this._context ? !1 : (this._vertices.push([...t.mapCoords]), this._vertices.length === 1 && (this._state = "drawing"), this._updatePreview(), !0);
  }
  onDoubleClick(t) {
    return this._state !== "drawing" || !this._context ? !1 : this._finishMeasurement();
  }
  onKeyDown(t) {
    return this._context ? t.key === "Enter" && this._state === "drawing" ? this._finishMeasurement() : t.key === "Backspace" && this._state === "drawing" && this._vertices.length > 0 ? (this._vertices.pop(), this._vertices.length === 0 && (this._state = "active"), this._updatePreview(), !0) : !1 : !1;
  }
  cancel() {
    this._vertices = [], this._cursorPos = null, this._state = "active", this._labelManager.clearTransient(), this._context?.previewLayer.clear(), this.markDirty();
  }
  _onUnitsChange() {
    for (const t of this._completedMeasurements) {
      const e = t.result.vertices, s = t.result.segmentDistances ?? [], i = t.result.totalDistance ?? 0;
      for (let n = 0; n < s.length; n++) {
        const o = `${t.id}-seg-${n}`;
        this._labelManager.updateLabel(o, this._unitManager.formatDistance(s[n]));
      }
      if (e.length >= 2) {
        const n = `${t.id}-total`;
        this._labelManager.updateLabel(n, `Total: ${this._unitManager.formatDistance(i)}`);
      }
    }
    this._state === "drawing" && this._updatePreview();
  }
  // ─── Private ───
  _finishMeasurement() {
    if (this._vertices.length < 2 || !this._context) return !1;
    const t = `measure-line-${++kt}`, e = It(this._vertices), s = W(this._vertices), i = this._vertices.map((h) => [...h]), n = [], o = [], c = x();
    this._measurementLayer.add({
      id: c,
      geometry: { type: "LineString", coordinates: i },
      attributes: { __measure: !0, __type: "line", __measureId: t }
    }), n.push(c);
    for (let h = 0; h < i.length; h++) {
      const u = x();
      this._measurementLayer.add({
        id: u,
        geometry: { type: "Point", coordinates: i[h] },
        attributes: { __measure: !0, __type: "vertex", __measureId: t }
      }), n.push(u);
    }
    for (let h = 0; h < e.length; h++) {
      const u = E(
        i[h][0],
        i[h][1],
        i[h + 1][0],
        i[h + 1][1]
      ), l = `${t}-seg-${h}`;
      this._labelManager.addLabel({
        id: l,
        geoPosition: u,
        text: this._unitManager.formatDistance(e[h]),
        type: "distance",
        persistent: !0
      }), o.push(l);
    }
    const a = `${t}-total`;
    this._labelManager.addLabel({
      id: a,
      geoPosition: i[i.length - 1],
      text: `Total: ${this._unitManager.formatDistance(s)}`,
      type: "total",
      persistent: !0
    }), o.push(a);
    const _ = {
      id: t,
      type: "distance",
      result: {
        totalDistance: s,
        segmentDistances: e,
        vertices: i
      },
      featureIds: n,
      labelIds: o
    };
    return this._completedMeasurements.push(_), this._context.emitEvent("measure-complete", {
      toolId: this.id,
      type: "distance",
      result: _.result
    }), this._vertices = [], this._cursorPos = null, this._state = "active", this._labelManager.clearTransient(), this._context.previewLayer.clear(), this.markDirty(), !0;
  }
  _updatePreview() {
    if (!this._context) return;
    const t = this._context.previewLayer;
    t.clear(), this._labelManager.clearTransient();
    for (let s = 0; s < this._vertices.length; s++)
      t.add({
        id: `__measure-line-vertex-${s}__`,
        geometry: { type: "Point", coordinates: this._vertices[s] },
        attributes: { __preview: !0, __type: "vertex" }
      });
    const e = this._vertices.map((s) => [...s]);
    if (this._cursorPos && e.push([...this._cursorPos]), e.length >= 2) {
      t.add({
        id: "__measure-line-preview__",
        geometry: { type: "LineString", coordinates: e },
        attributes: { __preview: !0, __type: "rubberband" }
      });
      for (let o = 0; o < e.length - 1; o++) {
        const c = e[o], a = e[o + 1], _ = S(c[0], c[1], a[0], a[1]), h = E(c[0], c[1], a[0], a[1]);
        this._labelManager.addLabel({
          id: `__measure-line-seg-${o}__`,
          geoPosition: h,
          text: this._unitManager.formatDistance(_),
          type: "distance",
          persistent: !1
        });
      }
      const s = e, i = W(s), n = s[s.length - 1];
      this._labelManager.addLabel({
        id: "__measure-line-total__",
        geoPosition: n,
        text: `Total: ${this._unitManager.formatDistance(i)}`,
        type: "total",
        persistent: !1
      });
    }
    this._cursorPos && t.add({
      id: "__measure-line-cursor__",
      geometry: { type: "Point", coordinates: this._cursorPos },
      attributes: { __preview: !0, __type: "cursor" }
    }), this.markDirty();
  }
}
let Tt = 0;
class Ot extends $ {
  id = "measure-area";
  name = "Measure Area";
  _vertices = [];
  _cursorPos = null;
  constructor(t) {
    super(t);
  }
  onActivate(t) {
    super.onActivate(t), this._vertices = [], this._cursorPos = null;
  }
  onDeactivate() {
    this._vertices = [], this._cursorPos = null, super.onDeactivate();
  }
  onPointerDown(t) {
    return !1;
  }
  onPointerMove(t) {
    return !t.mapCoords || !this._context || (this._cursorPos = t.mapCoords, this._updatePreview()), !1;
  }
  onPointerUp(t) {
    return !t.mapCoords || !this._context ? !1 : (this._vertices.push([...t.mapCoords]), this._vertices.length === 1 && (this._state = "drawing"), this._updatePreview(), !0);
  }
  onDoubleClick(t) {
    return this._state !== "drawing" || !this._context ? !1 : this._finishMeasurement();
  }
  onKeyDown(t) {
    return this._context ? t.key === "Enter" && this._state === "drawing" ? this._finishMeasurement() : t.key === "Backspace" && this._state === "drawing" && this._vertices.length > 0 ? (this._vertices.pop(), this._vertices.length === 0 && (this._state = "active"), this._updatePreview(), !0) : !1 : !1;
  }
  cancel() {
    this._vertices = [], this._cursorPos = null, this._state = "active", this._labelManager.clearTransient(), this._context?.previewLayer.clear(), this.markDirty();
  }
  _onUnitsChange() {
    for (const t of this._completedMeasurements) {
      const e = t.result.vertices, s = t.result.perimeter ?? 0, i = t.result.area ?? 0;
      for (let o = 0; o < e.length; o++) {
        const c = e[o], a = e[(o + 1) % e.length], _ = S(c[0], c[1], a[0], a[1]), h = `${t.id}-edge-${o}`;
        this._labelManager.updateLabel(h, this._unitManager.formatDistance(_));
      }
      const n = `${t.id}-area`;
      this._labelManager.updateLabel(
        n,
        `${this._unitManager.formatArea(i)}
${this._unitManager.formatDistance(s)}`
      );
    }
    this._state === "drawing" && this._updatePreview();
  }
  // ─── Private ───
  _finishMeasurement() {
    if (this._vertices.length < 3 || !this._context) return !1;
    const t = `measure-polygon-${++Tt}`, e = this._vertices.map((l) => [...l]), s = K(e), i = j(e), n = [], o = [], c = [...e, [...e[0]]], a = x();
    this._measurementLayer.add({
      id: a,
      geometry: { type: "Polygon", coordinates: [c] },
      attributes: { __measure: !0, __type: "polygon", __measureId: t }
    }), n.push(a);
    for (let l = 0; l < e.length; l++) {
      const g = x();
      this._measurementLayer.add({
        id: g,
        geometry: { type: "Point", coordinates: e[l] },
        attributes: { __measure: !0, __type: "vertex", __measureId: t }
      }), n.push(g);
    }
    for (let l = 0; l < e.length; l++) {
      const g = e[l], p = e[(l + 1) % e.length], P = S(g[0], g[1], p[0], p[1]), v = E(g[0], g[1], p[0], p[1]), y = `${t}-edge-${l}`;
      this._labelManager.addLabel({
        id: y,
        geoPosition: v,
        text: this._unitManager.formatDistance(P),
        type: "distance",
        persistent: !0
      }), o.push(y);
    }
    const _ = q(e), h = `${t}-area`;
    this._labelManager.addLabel({
      id: h,
      geoPosition: _,
      text: `${this._unitManager.formatArea(s)}
${this._unitManager.formatDistance(i)}`,
      type: "area",
      persistent: !0
    }), o.push(h);
    const u = {
      id: t,
      type: "area",
      result: {
        area: s,
        perimeter: i,
        vertices: e
      },
      featureIds: n,
      labelIds: o
    };
    return this._completedMeasurements.push(u), this._context.emitEvent("measure-complete", {
      toolId: this.id,
      type: "area",
      result: u.result
    }), this._vertices = [], this._cursorPos = null, this._state = "active", this._labelManager.clearTransient(), this._context.previewLayer.clear(), this.markDirty(), !0;
  }
  _updatePreview() {
    if (!this._context) return;
    const t = this._context.previewLayer;
    t.clear(), this._labelManager.clearTransient();
    for (let s = 0; s < this._vertices.length; s++)
      t.add({
        id: `__measure-poly-vertex-${s}__`,
        geometry: { type: "Point", coordinates: this._vertices[s] },
        attributes: { __preview: !0, __type: "vertex" }
      });
    const e = [...this._vertices.map((s) => [...s])];
    if (this._cursorPos && e.push([...this._cursorPos]), e.length >= 3) {
      const s = [...e, [...e[0]]];
      t.add({
        id: "__measure-poly-preview__",
        geometry: { type: "Polygon", coordinates: [s] },
        attributes: { __preview: !0, __type: "rubberband" }
      });
      for (let c = 0; c < e.length; c++) {
        const a = e[c], _ = e[(c + 1) % e.length], h = S(a[0], a[1], _[0], _[1]), u = E(a[0], a[1], _[0], _[1]);
        this._labelManager.addLabel({
          id: `__measure-poly-edge-${c}__`,
          geoPosition: u,
          text: this._unitManager.formatDistance(h),
          type: "distance",
          persistent: !1
        });
      }
      const i = K(e), n = j(e), o = q(e);
      this._labelManager.addLabel({
        id: "__measure-poly-area__",
        geoPosition: o,
        text: `${this._unitManager.formatArea(i)}
${this._unitManager.formatDistance(n)}`,
        type: "area",
        persistent: !1
      });
    } else if (e.length >= 2) {
      t.add({
        id: "__measure-poly-line-preview__",
        geometry: { type: "LineString", coordinates: e },
        attributes: { __preview: !0, __type: "rubberband" }
      });
      for (let s = 0; s < e.length - 1; s++) {
        const i = e[s], n = e[s + 1], o = S(i[0], i[1], n[0], n[1]), c = E(i[0], i[1], n[0], n[1]);
        this._labelManager.addLabel({
          id: `__measure-poly-seg-${s}__`,
          geoPosition: c,
          text: this._unitManager.formatDistance(o),
          type: "distance",
          persistent: !1
        });
      }
    }
    this._cursorPos && t.add({
      id: "__measure-poly-cursor__",
      geometry: { type: "Point", coordinates: this._cursorPos },
      attributes: { __preview: !0, __type: "cursor" }
    }), this.markDirty();
  }
}
class Ft {
  _container;
  _toScreen;
  _labels = /* @__PURE__ */ new Map();
  _elements = /* @__PURE__ */ new Map();
  constructor(t) {
    this._container = t.container, this._toScreen = t.toScreen;
  }
  addLabel(t) {
    this._labels.has(t.id) && this.removeLabel(t.id), this._labels.set(t.id, { ...t });
    const e = document.createElement("div");
    e.dataset.labelId = t.id, e.style.position = "absolute", e.style.pointerEvents = "none", e.style.zIndex = "5", e.style.transform = "translate(-50%, -100%)", e.style.padding = "2px 6px", e.style.backgroundColor = "rgba(255, 255, 255, 0.9)", e.style.color = "#333", e.style.fontFamily = "monospace", e.style.fontSize = "11px", e.style.borderRadius = "3px", e.style.whiteSpace = "nowrap", e.style.boxShadow = "0 1px 3px rgba(0,0,0,0.2)", e.style.border = "1px solid rgba(255, 87, 34, 0.3)", t.type === "total" ? (e.style.fontWeight = "bold", e.style.backgroundColor = "rgba(255, 87, 34, 0.9)", e.style.color = "#fff") : t.type === "area" && (e.style.fontWeight = "bold", e.style.backgroundColor = "rgba(255, 87, 34, 0.85)", e.style.color = "#fff"), e.textContent = t.text, this._elements.set(t.id, e), this._container.appendChild(e), this._positionElement(t, e);
  }
  removeLabel(t) {
    this._labels.delete(t);
    const e = this._elements.get(t);
    e && (e.parentElement?.removeChild(e), this._elements.delete(t));
  }
  updateLabel(t, e) {
    const s = this._labels.get(t);
    s && (s.text = e);
    const i = this._elements.get(t);
    i && (i.textContent = e);
  }
  /** Remove all non-persistent labels. */
  clearTransient() {
    for (const [t, e] of this._labels)
      e.persistent || this.removeLabel(t);
  }
  /** Remove all labels. */
  clearAll() {
    for (const t of this._elements.values())
      t.parentElement?.removeChild(t);
    this._labels.clear(), this._elements.clear();
  }
  /** Reproject all labels via toScreen. Call on view-change. */
  updatePositions() {
    for (const [t, e] of this._labels) {
      const s = this._elements.get(t);
      s && this._positionElement(e, s);
    }
  }
  /** Get all current labels (readonly). */
  get labels() {
    return this._labels;
  }
  destroy() {
    this.clearAll();
  }
  // ─── Private ───
  _positionElement(t, e) {
    const s = this._toScreen(t.geoPosition[0], t.geoPosition[1]);
    if (!s) {
      e.style.display = "none";
      return;
    }
    e.style.display = "", e.style.left = `${s[0]}px`, e.style.top = `${s[1]}px`;
  }
}
const ee = {
  type: "simple-line",
  color: [255, 87, 34, 230],
  width: 2,
  style: "dash"
}, se = {
  type: "simple-marker",
  color: [255, 255, 255, 255],
  size: 6,
  outlineColor: [255, 87, 34, 255],
  outlineWidth: 2
}, ie = {
  type: "simple-marker",
  color: [255, 87, 34, 180],
  size: 8,
  outlineColor: [255, 255, 255, 255],
  outlineWidth: 2
}, re = {
  type: "simple-fill",
  color: [255, 87, 34, 38],
  outlineColor: [255, 87, 34, 230],
  outlineWidth: 2
}, ne = {
  type: "simple-marker",
  color: [255, 87, 34, 255],
  size: 10,
  outlineColor: [255, 255, 255, 255],
  outlineWidth: 2
};
function oe(r, t) {
  const e = new Ft({
    container: t.labelContainer,
    toScreen: t.toScreen
  }), s = {
    unitManager: t.unitManager,
    labelManager: e,
    measurementLayer: t.measurementLayer
  };
  return r.registerTool(new Ct(s)), r.registerTool(new Et(s)), r.registerTool(new Ot(s)), { labelManager: e };
}
class ae extends w {
  id = "milstd-draw";
  name = "MIL-STD Draw";
  _targetLayer;
  _sidc;
  _mode;
  _minControlPoints;
  _maxControlPoints;
  _vertices = [];
  _cursorPos = null;
  constructor(t) {
    super(), this._targetLayer = t.targetLayer, this._sidc = t.sidc, this._mode = t.mode, this._minControlPoints = t.minControlPoints ?? 2, this._maxControlPoints = t.maxControlPoints ?? -1;
  }
  /** The current SIDC being drawn. */
  get sidc() {
    return this._sidc;
  }
  /** Update the SIDC being drawn (allows switching symbol mid-session). */
  setSidc(t, e, s, i) {
    this._sidc = t, this._mode = e, this._minControlPoints = s ?? 2, this._maxControlPoints = i ?? -1, this._reset();
  }
  onActivate() {
    this._cursor = "crosshair", this._reset();
  }
  onDeactivate() {
    this._vertices = [], this._cursorPos = null;
  }
  onPointerDown(t) {
    return !1;
  }
  onPointerMove(t) {
    return !t.mapCoords || !this._context || (this._cursorPos = t.mapCoords, this._state === "drawing" && this._updatePreview()), !1;
  }
  onPointerUp(t) {
    return t.button !== 0 || !t.mapCoords || !this._context ? !1 : this._mode === "point" ? (this._placePointSymbol(t.mapCoords), !0) : (this._vertices.push([...t.mapCoords]), this._vertices.length === 1 && (this._state = "drawing", this._context.emitEvent("draw-start", {
      toolId: this.id,
      geometry: { type: "Point", coordinates: [...t.mapCoords] }
    })), this._context.emitEvent("vertex-add", {
      toolId: this.id,
      coords: t.mapCoords,
      vertexIndex: this._vertices.length - 1
    }), this._maxControlPoints !== -1 && this._vertices.length >= this._maxControlPoints ? (this._finishTacticalGraphic(), !0) : (this._updatePreview(), !0));
  }
  onDoubleClick(t) {
    return this._mode === "tactical" && this._state === "drawing" ? (this._vertices.length > 0 && this._vertices.pop(), this._finishTacticalGraphic(), !0) : !1;
  }
  onKeyDown(t) {
    if (!this._context) return !1;
    if (t.key === "Escape")
      return this.cancel(), !0;
    if (t.key === "Enter" && this._state === "drawing")
      return this._finishTacticalGraphic(), !0;
    if (t.key === "Backspace" && this._state === "drawing" && this._vertices.length > 0) {
      const e = this._vertices.length - 1;
      return this._vertices.pop(), this._context.emitEvent("vertex-remove", {
        toolId: this.id,
        vertexIndex: e
      }), this._vertices.length === 0 && (this._state = "active"), this._updatePreview(), !0;
    }
    return !1;
  }
  cancel() {
    this._state === "drawing" && this._context && this._context.emitEvent("draw-cancel", { toolId: this.id }), this._reset(), this._state = "active", this.markDirty();
  }
  // ─── Private ───
  _placePointSymbol(t) {
    if (!this._context) return;
    const e = {
      id: x(),
      geometry: { type: "Point", coordinates: [...t] },
      attributes: { sidc: this._sidc }
    }, s = new L(this._targetLayer, e);
    this._context.commands.execute(s), this._context.emitEvent("draw-start", {
      toolId: this.id,
      geometry: e.geometry
    }), this._context.emitEvent("draw-complete", {
      toolId: this.id,
      feature: e
    }), this.markDirty();
  }
  _finishTacticalGraphic() {
    if (!this._context || this._vertices.length < this._minControlPoints)
      return;
    const t = this._vertices.length === 1 ? "Point" : this._vertices.length === 2 ? "LineString" : "Polygon";
    let e;
    if (t === "Point")
      e = [...this._vertices[0]];
    else if (t === "LineString")
      e = this._vertices.map((n) => [...n]);
    else {
      const n = this._vertices.map((o) => [...o]);
      n.push([...this._vertices[0]]), e = [n];
    }
    const s = {
      id: x(),
      geometry: { type: t, coordinates: e },
      attributes: {
        sidc: this._sidc,
        controlPoints: JSON.stringify(this._vertices)
      }
    }, i = new L(this._targetLayer, s);
    this._context.commands.execute(i), this._context.emitEvent("draw-complete", {
      toolId: this.id,
      feature: s
    }), this._reset(), this._state = "active", this.markDirty();
  }
  _updatePreview() {
    if (!this._context) return;
    const t = this._context.previewLayer;
    t.clear();
    for (let e = 0; e < this._vertices.length; e++) {
      const s = this._vertices[e];
      t.add({
        id: `__milstd-cp-${e}__`,
        geometry: { type: "Point", coordinates: s },
        attributes: { __preview: !0, __type: "control-point", __cpIndex: e }
      });
    }
    if (this._vertices.length > 0) {
      const e = this._vertices.map((s) => [...s]);
      this._cursorPos && e.push([...this._cursorPos]), e.length >= 2 && t.add({
        id: "__milstd-rubberband__",
        geometry: { type: "LineString", coordinates: e },
        attributes: { __preview: !0, __type: "rubberband" }
      });
    }
    this._cursorPos && t.add({
      id: "__milstd-cursor__",
      geometry: { type: "Point", coordinates: this._cursorPos },
      attributes: { __preview: !0, __type: "cursor" }
    }), this.markDirty();
  }
  _reset() {
    this._vertices = [], this._cursorPos = null, this._state = "active", this._context && this._context.previewLayer.clear();
  }
}
class ce extends w {
  id = "milstd-edit";
  name = "MIL-STD Edit";
  _tolerance;
  _selectedFeature = null;
  _controlPoints = [];
  _draggingIndex = null;
  constructor(t = {}) {
    super(), this._tolerance = t.tolerance ?? 12;
  }
  /** The currently selected feature, or null. */
  get selectedFeature() {
    return this._selectedFeature;
  }
  /** The current control points (read-only view). */
  get controlPoints() {
    return this._controlPoints;
  }
  /** Select a feature for editing. */
  selectFeature(t) {
    this._selectedFeature = t;
    const e = t.attributes?.controlPoints;
    if (typeof e == "string")
      try {
        this._controlPoints = JSON.parse(e);
      } catch {
        this._controlPoints = [];
      }
    else {
      const s = t.geometry;
      s?.type === "Point" ? this._controlPoints = [s.coordinates] : this._controlPoints = [];
    }
    this._state = "editing", this._showControlPoints();
  }
  /** Deselect current feature. */
  deselectFeature() {
    this._selectedFeature = null, this._controlPoints = [], this._draggingIndex = null, this._state = "active", this._context && this._context.previewLayer.clear(), this.markDirty();
  }
  /** Change the SIDC of the selected feature. */
  changeSidc(t) {
    this._selectedFeature && (this._selectedFeature.attributes = {
      ...this._selectedFeature.attributes,
      sidc: t
    }, this.markDirty());
  }
  onActivate() {
    this._cursor = "default";
  }
  onDeactivate() {
    this._selectedFeature = null, this._controlPoints = [], this._draggingIndex = null;
  }
  onPointerDown(t) {
    if (!this._context || !t.mapCoords || this._state !== "editing" || this._controlPoints.length === 0) return !1;
    for (let e = 0; e < this._controlPoints.length; e++) {
      const s = this._controlPoints[e], i = this._context.toScreen(s[0], s[1]);
      if (i && m(i[0], i[1], t.screenX, t.screenY) <= this._tolerance)
        return this._draggingIndex = e, this._cursor = "move", !0;
    }
    return !1;
  }
  onPointerMove(t) {
    return this._draggingIndex === null || !t.mapCoords ? !1 : (this._controlPoints[this._draggingIndex] = [...t.mapCoords], this._showControlPoints(), this.markDirty(), !0);
  }
  onPointerUp(t) {
    return this._draggingIndex === null ? !1 : (this._draggingIndex = null, this._cursor = "default", this._selectedFeature && (this._selectedFeature.attributes = {
      ...this._selectedFeature.attributes,
      controlPoints: JSON.stringify(this._controlPoints)
    }, this._context && this._context.emitEvent("feature-update", {
      feature: this._selectedFeature,
      layerId: ""
    })), this.markDirty(), !0);
  }
  onDoubleClick(t) {
    return !1;
  }
  onKeyDown(t) {
    return t.key === "Escape" && this._state === "editing" ? (this.deselectFeature(), !0) : !1;
  }
  cancel() {
    this.deselectFeature();
  }
  // ─── Private ───
  _showControlPoints() {
    if (!this._context) return;
    const t = this._context.previewLayer;
    t.clear();
    for (let e = 0; e < this._controlPoints.length; e++)
      t.add({
        id: `__milstd-cp-${e}__`,
        geometry: { type: "Point", coordinates: this._controlPoints[e] },
        attributes: { __preview: !0, __type: "control-point", __cpIndex: e }
      });
    this._controlPoints.length >= 2 && t.add({
      id: "__milstd-cp-line__",
      geometry: { type: "LineString", coordinates: this._controlPoints },
      attributes: { __preview: !0, __type: "control-line" }
    }), this.markDirty();
  }
}
const O = 12;
class he extends w {
  id = "los";
  name = "Line of Sight";
  _analysis;
  _sampleCount;
  _debounceMs;
  _observer = null;
  _target = null;
  _observerOffset = 1.8;
  _targetOffset = 0;
  _result = null;
  _losState = "active";
  _dragTarget = null;
  _isDragging = !1;
  _debounceTimer = null;
  _cursorPos = null;
  _shiftDragStartY = null;
  _shiftDragStartOffset = 0;
  constructor(t) {
    super(), this._analysis = t.analysis, this._sampleCount = t.sampleCount ?? 512, this._debounceMs = t.debounceMs ?? 50;
  }
  // ─── Public API ───
  get observer() {
    return this._observer;
  }
  get target() {
    return this._target;
  }
  get observerOffset() {
    return this._observerOffset;
  }
  get targetOffset() {
    return this._targetOffset;
  }
  get result() {
    return this._result;
  }
  setObserverOffset(t) {
    this._observerOffset = t, this._observer && this._target && this._runLosDebounced();
  }
  setTargetOffset(t) {
    this._targetOffset = t, this._observer && this._target && this._runLosDebounced();
  }
  setObserver(t, e) {
    this._observer = [t, e], this._losState = "observer-placed", this._target ? this._runLos() : this._updatePreview();
  }
  setTarget(t, e) {
    this._target = [t, e], this._observer && this._runLos();
  }
  // ─── Lifecycle ───
  onActivate(t) {
    this._reset();
  }
  onDeactivate() {
    this._clearDebounce(), this._context?.previewLayer.clear();
  }
  // ─── Event Handlers ───
  onPointerDown(t) {
    if (!t.mapCoords || !this._context) return !1;
    if (this._losState === "showing-result") {
      const e = this._hitTestHandle(t.screenX, t.screenY);
      if (e)
        return this._dragTarget = e, this._isDragging = !0, this._cursor = "grab", t.shiftKey && (this._shiftDragStartY = t.screenY, this._shiftDragStartOffset = e === "observer" ? this._observerOffset : this._targetOffset), !0;
    }
    return !1;
  }
  onPointerMove(t) {
    if (!this._context) return !1;
    if (this._isDragging && this._dragTarget && t.mapCoords) {
      if (this._shiftDragStartY !== null) {
        const e = this._shiftDragStartY - t.screenY, s = Math.max(0, this._shiftDragStartOffset + e * 0.1);
        this._dragTarget === "observer" ? this._observerOffset = s : this._targetOffset = s;
      } else
        this._dragTarget === "observer" ? this._observer = t.mapCoords : this._target = t.mapCoords;
      return this._runLosDebounced(), this._updatePreview(), !0;
    }
    if (t.mapCoords) {
      this._cursorPos = t.mapCoords;
      const e = this._hitTestHandle(t.screenX, t.screenY);
      this._cursor = e ? "pointer" : "crosshair";
    }
    return this._losState === "observer-placed" && this._cursorPos && this._updatePreview(), !1;
  }
  onPointerUp(t) {
    return !t.mapCoords || !this._context ? !1 : this._isDragging ? (this._isDragging = !1, this._dragTarget = null, this._shiftDragStartY = null, this._cursor = "crosshair", this._observer && this._target && this._runLos(), !0) : this._losState === "active" ? (this._observer = [...t.mapCoords], this._losState = "observer-placed", this._updatePreview(), !0) : this._losState === "observer-placed" ? (this._target = [...t.mapCoords], this._runLos(), !0) : this._losState === "showing-result" && !this._hitTestHandle(t.screenX, t.screenY) ? (this._reset(), this._observer = [...t.mapCoords], this._losState = "observer-placed", this._updatePreview(), !0) : !1;
  }
  onDoubleClick(t) {
    return !1;
  }
  onKeyDown(t) {
    return t.key === "Escape" ? (this._clearAndEmit(), !0) : !1;
  }
  cancel() {
    this._clearAndEmit();
  }
  // ─── Private ───
  _reset() {
    this._observer = null, this._target = null, this._result = null, this._losState = "active", this._dragTarget = null, this._isDragging = !1, this._cursorPos = null, this._shiftDragStartY = null, this._clearDebounce(), this._context?.previewLayer.clear(), this.markDirty();
  }
  _clearAndEmit() {
    this._reset(), this._context?.emitEvent("los-clear", { toolId: this.id });
  }
  _clearDebounce() {
    this._debounceTimer !== null && (clearTimeout(this._debounceTimer), this._debounceTimer = null);
  }
  _runLosDebounced() {
    this._clearDebounce(), this._debounceTimer = setTimeout(() => {
      this._runLos();
    }, this._debounceMs);
  }
  async _runLos() {
    if (!(!this._observer || !this._target || !this._context))
      try {
        const t = await this._analysis.runLos({
          observer: this._observer,
          target: this._target,
          observerOffset: this._observerOffset,
          targetOffset: this._targetOffset,
          sampleCount: this._sampleCount
        });
        this._result = t, this._losState = "showing-result", this._updatePreview(), this._context.emitEvent("los-update", {
          toolId: this.id,
          observer: this._observer,
          target: this._target,
          observerOffset: this._observerOffset,
          targetOffset: this._targetOffset,
          result: t
        });
      } catch (t) {
        this._isDragging || console.warn("[LosTool] LOS analysis failed:", t);
      }
  }
  _hitTestHandle(t, e) {
    if (!this._context) return null;
    if (this._observer) {
      const s = this._context.toScreen(this._observer[0], this._observer[1]);
      if (s) {
        const i = t - s[0], n = e - s[1];
        if (i * i + n * n < O * O)
          return "observer";
      }
    }
    if (this._target) {
      const s = this._context.toScreen(this._target[0], this._target[1]);
      if (s) {
        const i = t - s[0], n = e - s[1];
        if (i * i + n * n < O * O)
          return "target";
      }
    }
    return null;
  }
  _updatePreview() {
    if (!this._context) return;
    const t = this._context.previewLayer;
    t.clear();
    const e = this._observerOffset, s = this._targetOffset;
    if (this._observer && t.add({
      id: "__los-observer__",
      geometry: { type: "Point", coordinates: [this._observer[0], this._observer[1], e] },
      attributes: { __preview: !0, __type: "los-observer" }
    }), this._target && t.add({
      id: "__los-target__",
      geometry: { type: "Point", coordinates: [this._target[0], this._target[1], s] },
      attributes: { __preview: !0, __type: "los-target" }
    }), this._result && this._observer && this._target) {
      if (this._result.visibleLine.length >= 6) {
        const i = X(this._result.visibleLine, e, s, this._observer, this._target);
        t.add({
          id: "__los-visible-line__",
          geometry: { type: "LineString", coordinates: i },
          attributes: { __preview: !0, __type: "los-visible" }
        });
      }
      if (this._result.blockedLine && this._result.blockedLine.length >= 6) {
        const i = X(this._result.blockedLine, e, s, this._observer, this._target);
        t.add({
          id: "__los-blocked-line__",
          geometry: { type: "LineString", coordinates: i },
          attributes: { __preview: !0, __type: "los-blocked" }
        });
      }
      if (this._result.blockingPoint) {
        const i = this._result.blockingPoint, n = rt(i[0], i[1], this._observer, this._target), o = e + n * (s - e);
        t.add({
          id: "__los-blocking-point__",
          geometry: { type: "Point", coordinates: [i[0], i[1], o] },
          attributes: { __preview: !0, __type: "los-blocking" }
        });
      }
    } else this._losState === "observer-placed" && this._observer && this._cursorPos && t.add({
      id: "__los-rubberband__",
      geometry: {
        type: "LineString",
        coordinates: [
          [this._observer[0], this._observer[1], this._observerOffset],
          [this._cursorPos[0], this._cursorPos[1], this._targetOffset]
        ]
      },
      attributes: { __preview: !0, __type: "rubberband" }
    });
    this.markDirty();
  }
}
function X(r, t, e, s, i) {
  const n = [];
  for (let o = 0; o < r.length; o += 3) {
    const c = r[o], a = r[o + 1], _ = rt(c, a, s, i), h = t + _ * (e - t);
    n.push([c, a, h]);
  }
  return n;
}
function rt(r, t, e, s) {
  const i = s[0] - e[0], n = s[1] - e[1], o = i * i + n * n;
  if (o < 1e-18) return 0;
  const c = r - e[0], a = t - e[1];
  return Math.max(0, Math.min(1, (c * i + a * n) / o));
}
function _e(r, t) {
  const { targetLayer: e, previewLayer: s, snapConfig: i } = t;
  s && r.setPreviewLayer(s);
  let n;
  return i && (n = new it(i), n.addSourceLayer(e)), r.registerTool(new ut({ targetLayer: e, snapEngine: n })), r.registerTool(new gt({ targetLayer: e, snapEngine: n })), r.registerTool(new ft({ targetLayer: e, snapEngine: n })), r.registerTool(new pt({ editableLayers: [e] })), r;
}
export {
  te as ANGLE_GUIDE_LINE_SYMBOL,
  At as AddVertexCommand,
  it as AdvancedSnapEngine,
  Dt as AngleGuideManager,
  Ut as CURSOR_POINT_SYMBOL,
  L as CreateFeatureCommand,
  Yt as DeleteVertexCommand,
  ut as DrawPointTool,
  ft as DrawPolygonTool,
  gt as DrawPolylineTool,
  ht as ENTITY_SNAP_TYPES,
  pt as EditTool,
  A as GEODESIC_EARTH_RADIUS,
  he as LosTool,
  ie as MEASURE_CURSOR_SYMBOL,
  ee as MEASURE_LINE_SYMBOL,
  ne as MEASURE_POINT_SYMBOL,
  re as MEASURE_POLYGON_SYMBOL,
  se as MEASURE_VERTEX_SYMBOL,
  Ht as MIDPOINT_SYMBOL,
  Ft as MeasureLabelManager,
  Et as MeasureLineTool,
  Ct as MeasurePointTool,
  Ot as MeasurePolygonTool,
  $ as MeasureToolBase,
  ae as MilStdDrawTool,
  ce as MilStdEditTool,
  Rt as MoveFeatureCommand,
  Jt as MoveVertexCommand,
  jt as OUTPUT_LINE_SYMBOL,
  Kt as OUTPUT_POINT_SYMBOL,
  qt as OUTPUT_POLYGON_SYMBOL,
  zt as PREVIEW_LINE_SYMBOL,
  Wt as PREVIEW_POLYGON_SYMBOL,
  Vt as PlaceGeometryTool,
  $t as RemoveVertexCommand,
  Xt as SELECTED_LINE_SYMBOL,
  Zt as SELECTED_POLYGON_SYMBOL,
  Qt as SNAP_INDICATOR_SYMBOL,
  Q as SNAP_PRIORITY,
  Nt as SnapEngine,
  d as SnapType,
  C as SnapVisualizer,
  w as ToolBase,
  Bt as VERTEX_SYMBOL,
  lt as compareSnapCandidates,
  N as cross2D,
  B as distanceMeters,
  mt as edgeMidpoint,
  xt as extractEdges,
  bt as extractVertices,
  nt as findNearestEdge,
  Y as findNearestVertex,
  Pt as generateAngleGuides,
  x as generateFeatureId,
  ct as generatePreviewId,
  S as geodesicDistance,
  E as geodesicMidpoint,
  j as geodesicPerimeter,
  It as geodesicSegmentDistances,
  W as geodesicTotalDistance,
  yt as lerpCoords,
  U as makeCircleFootprint,
  R as makeRectFootprint,
  T as midpoint,
  wt as nearestPointOnSegment,
  Z as pointToSegmentDistance,
  q as polygonCentroid,
  _t as resolveSnapConfig,
  m as screenDistance,
  vt as segmentSegmentIntersection,
  _e as setupDrawingTools,
  oe as setupMeasurementTools,
  Mt as snapToAngleGuide,
  K as sphericalPolygonArea
};
