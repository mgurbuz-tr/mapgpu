import { UnitManager as G } from "@mapgpu/core";
let V = 0;
class g {
  constructor(t, e) {
    this.widgetName = t, this.id = e?.id ?? `mapgpu-widget-${t}-${++V}`, this.position = e?.position ?? "top-right";
  }
  id;
  position;
  _view = null;
  _container = null;
  _root = null;
  _destroyed = !1;
  mount(t) {
    this._destroyed || (this._root && this.unmount(), this._container = t, this._root = document.createElement("div"), this._root.id = this.id, this._root.classList.add("mapgpu-widget", `mapgpu-widget-${this.widgetName}`), this._root.setAttribute("data-widget-position", this.position), this.applyPositionStyles(this._root), this.render(this._root), t.appendChild(this._root));
  }
  unmount() {
    this._root && this._root.parentElement && this._root.parentElement.removeChild(this._root), this._root = null, this._container = null;
  }
  bind(t) {
    this._view = t, this.onViewBound(t);
  }
  destroy() {
    this._destroyed || (this._destroyed = !0, this.onDestroy(), this.unmount(), this._view = null);
  }
  /** Called when a view is bound. Subclasses can override. */
  onViewBound(t) {
  }
  /** Called before destroy. Subclasses can override for cleanup. */
  onDestroy() {
  }
  applyPositionStyles(t) {
    switch (t.style.position = "absolute", t.style.zIndex = "1000", t.style.boxSizing = "border-box", this.position) {
      case "top-left":
        t.style.top = "10px", t.style.left = "10px";
        break;
      case "top-right":
        t.style.top = "10px", t.style.right = "10px";
        break;
      case "bottom-left":
        t.style.bottom = "10px", t.style.left = "10px";
        break;
      case "bottom-right":
        t.style.bottom = "10px", t.style.right = "10px";
        break;
    }
  }
}
class lt extends g {
  _layers = [];
  _listEl = null;
  _layerEventCleanups = [];
  // Event bus for widget-level events
  _listeners = /* @__PURE__ */ new Map();
  constructor(t) {
    super("layerlist", t);
  }
  get layers() {
    return this._layers;
  }
  addLayer(t) {
    this._layers.some((e) => e.id === t.id) || (this._layers.push(t), this._subscribeLayerEvents(t), this.emitEvent("layer-add", t), this._rebuildList());
  }
  removeLayer(t) {
    const e = typeof t == "string" ? t : t.id, s = this._layers.findIndex((n) => n.id === e);
    if (s === -1) return;
    const i = this._layers.splice(s, 1)[0];
    i && this.emitEvent("layer-remove", i), this._rebuildList();
  }
  reorderLayer(t, e) {
    const s = this._layers.findIndex((l) => l.id === t);
    if (s === -1) return;
    const i = Math.max(0, Math.min(e, this._layers.length - 1)), [n] = this._layers.splice(s, 1);
    n && (this._layers.splice(i, 0, n), this.emitEvent("layer-reorder", { layer: n, newIndex: i }), this._rebuildList());
  }
  on(t, e) {
    this._listeners.has(t) || this._listeners.set(t, /* @__PURE__ */ new Set()), this._listeners.get(t).add(e);
  }
  off(t, e) {
    this._listeners.get(t)?.delete(e);
  }
  render(t) {
    t.style.backgroundColor = "rgba(255, 255, 255, 0.95)", t.style.borderRadius = "4px", t.style.padding = "8px", t.style.minWidth = "200px", t.style.fontFamily = "sans-serif", t.style.fontSize = "13px", t.style.boxShadow = "0 1px 4px rgba(0,0,0,0.2)";
    const e = document.createElement("div");
    e.textContent = "Layers", e.style.fontWeight = "bold", e.style.marginBottom = "6px", e.style.fontSize = "14px", t.appendChild(e), this._listEl = document.createElement("ul"), this._listEl.style.listStyle = "none", this._listEl.style.padding = "0", this._listEl.style.margin = "0", t.appendChild(this._listEl), this._rebuildList();
  }
  onViewBound(t) {
    this._root && this._rebuildList();
  }
  onDestroy() {
    for (const t of this._layerEventCleanups)
      t();
    this._layerEventCleanups = [], this._listeners.clear(), this._layers = [], this._listEl = null;
  }
  _subscribeLayerEvents(t) {
    const e = (i) => {
      this._updateLayerItem(t);
    }, s = (i) => {
      this._updateLayerItem(t);
    };
    t.on("visibility-change", e), t.on("opacity-change", s), this._layerEventCleanups.push(() => {
      t.off("visibility-change", e), t.off("opacity-change", s);
    });
  }
  _updateLayerItem(t) {
    if (!this._listEl) return;
    const e = this._listEl.querySelector(`[data-layer-id="${t.id}"]`);
    if (!e) return;
    const s = e.querySelector('input[type="checkbox"]');
    s && (s.checked = t.visible);
    const i = e.querySelector('input[type="range"]');
    i && (i.value = String(Math.round(t.opacity * 100)));
  }
  _rebuildList() {
    if (this._listEl) {
      this._listEl.innerHTML = "";
      for (const t of this._layers) {
        const e = document.createElement("li");
        e.setAttribute("data-layer-id", t.id), e.style.display = "flex", e.style.alignItems = "center", e.style.gap = "6px", e.style.padding = "4px 0", e.style.borderBottom = "1px solid #eee", e.draggable = !0, e.addEventListener("dragstart", (l) => {
          l.dataTransfer?.setData("text/plain", t.id);
        }), e.addEventListener("dragover", (l) => {
          l.preventDefault();
        }), e.addEventListener("drop", (l) => {
          l.preventDefault();
          const a = l.dataTransfer?.getData("text/plain");
          if (a && a !== t.id) {
            const c = this._layers.findIndex((h) => h.id === t.id);
            c !== -1 && this.reorderLayer(a, c);
          }
        });
        const s = document.createElement("input");
        s.type = "checkbox", s.checked = t.visible, s.addEventListener("change", () => {
          t.visible = s.checked;
        }), e.appendChild(s);
        const i = document.createElement("span");
        i.textContent = t.id, i.style.flex = "1", i.style.overflow = "hidden", i.style.textOverflow = "ellipsis", i.style.whiteSpace = "nowrap", e.appendChild(i);
        const n = document.createElement("input");
        n.type = "range", n.min = "0", n.max = "100", n.value = String(Math.round(t.opacity * 100)), n.style.width = "60px", n.addEventListener("input", () => {
          t.opacity = parseInt(n.value, 10) / 100;
        }), e.appendChild(n), this._listEl.appendChild(e);
      }
    }
  }
  emitEvent(t, e) {
    const s = this._listeners.get(t);
    if (s)
      for (const i of s)
        i(e);
  }
}
const A = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1e3, 2e3, 5e3, 1e4, 2e4, 5e4, 1e5, 2e5, 5e5, 1e6], z = 3.28084, F = 5280, N = 40075016686e-3;
class D extends g {
  _unit;
  _maxWidthPx;
  _barEl = null;
  _labelEl = null;
  _groundResolution = 1;
  // meters per pixel
  _viewChangeHandler = null;
  constructor(t) {
    super("scalebar", t), this._unit = t?.unit ?? "metric", this._maxWidthPx = t?.maxWidthPx ?? 150;
  }
  get unit() {
    return this._unit;
  }
  set unit(t) {
    this._unit = t, this._updateDisplay();
  }
  /**
   * Update the scale bar based on ground resolution (meters per pixel).
   * Should be called whenever view changes (zoom, extent, etc.).
   */
  setGroundResolution(t) {
    this._groundResolution = t, this._updateDisplay();
  }
  render(t) {
    t.style.backgroundColor = "rgba(255, 255, 255, 0.85)", t.style.borderRadius = "3px", t.style.padding = "4px 8px", t.style.fontFamily = "sans-serif", t.style.fontSize = "11px", t.style.lineHeight = "1", t.style.display = "inline-block", this._barEl = document.createElement("div"), this._barEl.classList.add("bar"), this._barEl.style.height = "4px", this._barEl.style.backgroundColor = "#333", this._barEl.style.borderLeft = "2px solid #333", this._barEl.style.borderRight = "2px solid #333", this._barEl.style.marginBottom = "2px", t.appendChild(this._barEl), this._labelEl = document.createElement("span"), this._labelEl.classList.add("label"), this._labelEl.style.display = "block", this._labelEl.style.textAlign = "center", this._labelEl.style.color = "#333", t.appendChild(this._labelEl), this._updateDisplay();
  }
  onViewBound(t) {
    this._removeViewListener(), this._viewChangeHandler = (e) => {
      const s = e;
      s.zoom != null && this.setGroundResolution(
        N / 256 / Math.pow(2, s.zoom)
      );
    }, t.on("view-change", this._viewChangeHandler), this._updateDisplay();
  }
  onDestroy() {
    this._removeViewListener(), this._barEl = null, this._labelEl = null;
  }
  _removeViewListener() {
    this._viewChangeHandler && this._view && (this._view.off("view-change", this._viewChangeHandler), this._viewChangeHandler = null);
  }
  _updateDisplay() {
    !this._barEl || !this._labelEl || (this._unit === "imperial" ? this._renderImperial() : this._renderMetric());
  }
  _renderMetric() {
    const t = this._maxWidthPx * this._groundResolution, e = D.findNiceNumber(t), s = e / this._groundResolution;
    this._barEl.style.width = `${Math.round(s)}px`, e >= 1e3 ? this._labelEl.textContent = `${e / 1e3} km` : this._labelEl.textContent = `${e} m`;
  }
  _renderImperial() {
    const e = this._maxWidthPx * this._groundResolution * z, s = D.findNiceNumber(e), n = s / z / this._groundResolution;
    if (this._barEl.style.width = `${Math.round(n)}px`, s >= F) {
      const l = s / F;
      this._labelEl.textContent = `${l} mi`;
    } else
      this._labelEl.textContent = `${s} ft`;
  }
  /**
   * Find the largest "nice" number that is <= maxValue.
   * Exported as static for testability.
   */
  static findNiceNumber(t) {
    let e = A[0];
    for (const s of A)
      if (s <= t)
        e = s;
      else
        break;
    return e;
  }
}
class S extends g {
  _format;
  _spanEl = null;
  _mouseMoveHandler = null;
  _mouseTarget = null;
  /** Current longitude in decimal degrees */
  _lon = 0;
  /** Current latitude in decimal degrees */
  _lat = 0;
  /**
   * Optional function to convert pixel coordinates to map coordinates.
   * If not provided, the widget displays pixel coordinates.
   * Signature: (pixelX, pixelY) => [longitude, latitude]
   */
  screenToMap = null;
  constructor(t) {
    super("coordinates", t), this._format = t?.format ?? "DD";
  }
  get format() {
    return this._format;
  }
  set format(t) {
    this._format = t, this._updateDisplay();
  }
  get longitude() {
    return this._lon;
  }
  get latitude() {
    return this._lat;
  }
  /**
   * Manually set coordinates (useful for programmatic updates).
   */
  setCoordinates(t, e) {
    this._lon = t, this._lat = e, this._updateDisplay();
  }
  /**
   * Start listening to mouse move events on a target element.
   */
  listenTo(t) {
    this._removeMouseListener(), this._mouseTarget = t, this._mouseMoveHandler = (e) => {
      const s = t.getBoundingClientRect(), i = e.clientX - s.left, n = e.clientY - s.top;
      if (this.screenToMap) {
        const [l, a] = this.screenToMap(i, n);
        this._lon = l, this._lat = a;
      } else
        this._lon = i, this._lat = n;
      this._updateDisplay();
    }, t.addEventListener("mousemove", this._mouseMoveHandler);
  }
  render(t) {
    t.style.backgroundColor = "rgba(255, 255, 255, 0.85)", t.style.borderRadius = "3px", t.style.padding = "4px 8px", t.style.fontFamily = "monospace", t.style.fontSize = "12px", t.style.color = "#333", t.style.whiteSpace = "nowrap", this._spanEl = document.createElement("span"), this._spanEl.textContent = this._formatCoordinates(this._lon, this._lat), t.appendChild(this._spanEl);
  }
  onViewBound(t) {
    this.screenToMap = (e, s) => {
      const i = t;
      return i.toMap ? i.toMap(e, s) : [e, s];
    }, this._container && this.listenTo(this._container), this._updateDisplay();
  }
  onDestroy() {
    this._removeMouseListener(), this._spanEl = null;
  }
  _removeMouseListener() {
    this._mouseMoveHandler && this._mouseTarget && this._mouseTarget.removeEventListener("mousemove", this._mouseMoveHandler), this._mouseMoveHandler = null, this._mouseTarget = null;
  }
  _updateDisplay() {
    this._spanEl && (this._spanEl.textContent = this._formatCoordinates(this._lon, this._lat));
  }
  _formatCoordinates(t, e) {
    switch (this._format) {
      case "DD":
        return S.formatDD(t, e);
      case "DMS":
        return S.formatDMS(t, e);
      case "MGRS":
        return S.formatMGRS(t, e);
    }
  }
  /**
   * Format as Decimal Degrees: "28.9784° E, 41.0082° N"
   */
  static formatDD(t, e) {
    const s = t >= 0 ? "E" : "W", i = e >= 0 ? "N" : "S";
    return `${Math.abs(t).toFixed(4)}° ${s}, ${Math.abs(e).toFixed(4)}° ${i}`;
  }
  /**
   * Format as Degrees-Minutes-Seconds: "28° 58' 42.24" E, 41° 0' 29.52" N"
   */
  static formatDMS(t, e) {
    const s = t >= 0 ? "E" : "W", i = e >= 0 ? "N" : "S";
    return `${S._toDMS(Math.abs(t))} ${s}, ${S._toDMS(Math.abs(e))} ${i}`;
  }
  /**
   * Simplified MGRS-like format.
   * Full MGRS requires UTM zone + grid square calculation.
   * This provides a simplified representation for display purposes.
   */
  static formatMGRS(t, e) {
    const s = Math.floor((t + 180) / 6) + 1, i = t >= 0 ? "E" : "W", n = e >= 0 ? "N" : "S";
    return `${s}${n} ${Math.abs(t).toFixed(4)}${i} ${Math.abs(e).toFixed(4)}${n}`;
  }
  static _toDMS(t) {
    const e = Math.floor(t), s = (t - e) * 60, i = Math.floor(s), n = ((s - i) * 60).toFixed(2);
    return `${e}° ${i}' ${n}"`;
  }
}
class at extends g {
  _basemaps;
  _activeBasemapId;
  _galleryEl = null;
  _selectionHandlers = /* @__PURE__ */ new Set();
  constructor(t) {
    super("basemap-gallery", t), this._basemaps = t?.basemaps ?? [], this._activeBasemapId = t?.activeBasemapId ?? this._basemaps[0]?.id ?? null;
  }
  get basemaps() {
    return this._basemaps;
  }
  get activeBasemapId() {
    return this._activeBasemapId;
  }
  setBasemaps(t) {
    this._basemaps = t, t.length > 0 && !t.some((e) => e.id === this._activeBasemapId) && (this._activeBasemapId = t[0]?.id ?? null), this._rebuildGallery();
  }
  selectBasemap(t) {
    const e = this._basemaps.find((s) => s.id === t);
    if (e) {
      this._activeBasemapId = t, this._rebuildGallery();
      for (const s of this._selectionHandlers)
        s(e);
    }
  }
  onSelect(t) {
    this._selectionHandlers.add(t);
  }
  offSelect(t) {
    this._selectionHandlers.delete(t);
  }
  render(t) {
    t.style.backgroundColor = "rgba(255, 255, 255, 0.95)", t.style.borderRadius = "4px", t.style.padding = "8px", t.style.fontFamily = "sans-serif", t.style.fontSize = "12px", t.style.boxShadow = "0 1px 4px rgba(0,0,0,0.2)";
    const e = document.createElement("div");
    e.textContent = "Basemap", e.style.fontWeight = "bold", e.style.marginBottom = "8px", e.style.fontSize = "14px", t.appendChild(e), this._galleryEl = document.createElement("div"), this._galleryEl.style.display = "flex", this._galleryEl.style.flexWrap = "wrap", this._galleryEl.style.gap = "6px", t.appendChild(this._galleryEl), this._rebuildGallery();
  }
  onViewBound(t) {
    this._rebuildGallery();
  }
  onDestroy() {
    this._selectionHandlers.clear(), this._galleryEl = null, this._basemaps = [];
  }
  _rebuildGallery() {
    if (this._galleryEl) {
      this._galleryEl.innerHTML = "";
      for (const t of this._basemaps) {
        const e = document.createElement("div");
        e.classList.add("item"), e.setAttribute("data-basemap-id", t.id), e.style.width = "64px", e.style.cursor = "pointer", e.style.textAlign = "center", e.style.borderRadius = "4px", e.style.overflow = "hidden", e.style.border = t.id === this._activeBasemapId ? "2px solid #007bff" : "2px solid transparent", e.style.padding = "2px";
        const s = document.createElement("div");
        s.style.width = "60px", s.style.height = "40px", s.style.borderRadius = "3px", s.style.marginBottom = "2px", t.thumbnailUrl ? (s.style.backgroundImage = `url(${t.thumbnailUrl})`, s.style.backgroundSize = "cover", s.style.backgroundPosition = "center") : s.style.backgroundColor = "#ddd", e.appendChild(s);
        const i = document.createElement("div");
        i.textContent = t.title, i.style.fontSize = "10px", i.style.overflow = "hidden", i.style.textOverflow = "ellipsis", i.style.whiteSpace = "nowrap", e.appendChild(i), e.addEventListener("click", () => {
          this.selectBasemap(t.id);
        }), this._galleryEl.appendChild(e);
      }
    }
  }
}
class ot extends g {
  _sources;
  _placeholder;
  _inputEl = null;
  _dropdownEl = null;
  _results = [];
  _debounceTimer = null;
  _selectHandlers = /* @__PURE__ */ new Set();
  constructor(t) {
    super("search", t), this._sources = t.sources, this._placeholder = t.placeholder ?? "Search...";
  }
  get results() {
    return this._results;
  }
  onSelect(t) {
    this._selectHandlers.add(t);
  }
  offSelect(t) {
    this._selectHandlers.delete(t);
  }
  /**
   * Programmatically trigger a search.
   */
  async search(t) {
    if (!t.trim())
      return this._results = [], this._renderDropdown(), [];
    const e = [], s = this._sources.map(async (i) => {
      const n = await i.search(t);
      e.push(...n);
    });
    return await Promise.all(s), this._results = e, this._renderDropdown(), e;
  }
  /**
   * Clear search results and input.
   */
  clear() {
    this._results = [], this._inputEl && (this._inputEl.value = ""), this._renderDropdown();
  }
  render(t) {
    t.style.backgroundColor = "rgba(255, 255, 255, 0.95)", t.style.borderRadius = "4px", t.style.padding = "0", t.style.fontFamily = "sans-serif", t.style.fontSize = "13px", t.style.boxShadow = "0 1px 4px rgba(0,0,0,0.2)", t.style.minWidth = "240px", this._inputEl = document.createElement("input"), this._inputEl.type = "text", this._inputEl.placeholder = this._placeholder, this._inputEl.style.width = "100%", this._inputEl.style.padding = "8px 10px", this._inputEl.style.border = "none", this._inputEl.style.borderRadius = "4px", this._inputEl.style.fontSize = "13px", this._inputEl.style.boxSizing = "border-box", this._inputEl.style.outline = "none", this._inputEl.addEventListener("input", () => {
      this._onInput();
    }), t.appendChild(this._inputEl), this._dropdownEl = document.createElement("div"), this._dropdownEl.classList.add("search-dropdown"), this._dropdownEl.style.maxHeight = "200px", this._dropdownEl.style.overflowY = "auto", t.appendChild(this._dropdownEl);
  }
  onViewBound(t) {
  }
  onDestroy() {
    this._debounceTimer !== null && (clearTimeout(this._debounceTimer), this._debounceTimer = null), this._selectHandlers.clear(), this._inputEl = null, this._dropdownEl = null, this._results = [];
  }
  _onInput() {
    this._debounceTimer !== null && clearTimeout(this._debounceTimer), this._debounceTimer = setTimeout(() => {
      const t = this._inputEl?.value ?? "";
      this.search(t);
    }, 300);
  }
  _renderDropdown() {
    if (this._dropdownEl) {
      this._dropdownEl.innerHTML = "";
      for (const t of this._results) {
        const e = document.createElement("div");
        e.classList.add("search-result"), e.textContent = t.text, e.style.padding = "6px 10px", e.style.cursor = "pointer", e.style.borderTop = "1px solid #eee", e.addEventListener("click", () => {
          this._emitSelect(t);
        }), this._dropdownEl.appendChild(e);
      }
    }
  }
  _emitSelect(t) {
    for (const e of this._selectHandlers)
      e(t);
  }
}
const R = 6371e3, j = 3.28084, W = 5280, q = 10.7639, U = 43560;
function E(d) {
  return d * Math.PI / 180;
}
function Y(d, t, e, s) {
  const i = E(s - t), n = E(e - d), l = Math.sin(i / 2) * Math.sin(i / 2) + Math.cos(E(t)) * Math.cos(E(s)) * Math.sin(n / 2) * Math.sin(n / 2), a = 2 * Math.atan2(Math.sqrt(l), Math.sqrt(1 - l));
  return R * a;
}
function Q(d) {
  if (d.length < 3) return 0;
  let t = 0;
  const e = d.length;
  for (let i = 0; i < e; i++) {
    const n = (i + 1) % e, l = E(d[i][0]), a = E(d[i][1]), c = E(d[n][0]), h = E(d[n][1]);
    t += (c - l) * (2 + Math.sin(a) + Math.sin(h));
  }
  return Math.abs(t / 2) * R * R;
}
class rt extends g {
  _mode;
  _unit;
  _points = [];
  _modeLabel = null;
  _resultLabel = null;
  _distBtn = null;
  _areaBtn = null;
  constructor(t) {
    super("measurement", t), this._mode = t?.mode ?? "none", this._unit = t?.unit ?? "metric";
  }
  get mode() {
    return this._mode;
  }
  get unit() {
    return this._unit;
  }
  set unit(t) {
    this._unit = t, this._updateDisplay();
  }
  get points() {
    return this._points;
  }
  setMode(t) {
    this._mode = t, this._points = [], this._updateModeHighlight(), this._updateDisplay();
  }
  addPoint(t, e) {
    this._points.push([t, e]), this._updateDisplay();
  }
  getResult() {
    if (this._mode === "distance") {
      const t = this._calculateTotalDistance();
      if (this._unit === "imperial") {
        const e = t * j;
        return e >= W ? { distance: e / W, unit: "mi" } : { distance: e, unit: "ft" };
      }
      return t >= 1e3 ? { distance: t / 1e3, unit: "km" } : { distance: t, unit: "m" };
    }
    if (this._mode === "area") {
      const t = Q(this._points);
      if (this._unit === "imperial") {
        const e = t * q;
        return e >= U ? { area: e / U, unit: "acres" } : { area: e, unit: "sq ft" };
      }
      return t >= 1e6 ? { area: t / 1e6, unit: "km²" } : { area: t, unit: "m²" };
    }
    return { unit: "" };
  }
  clear() {
    this._points = [], this._updateDisplay();
  }
  render(t) {
    t.style.backgroundColor = "rgba(255, 255, 255, 0.95)", t.style.borderRadius = "4px", t.style.padding = "8px", t.style.fontFamily = "sans-serif", t.style.fontSize = "13px", t.style.boxShadow = "0 1px 4px rgba(0,0,0,0.2)", t.style.minWidth = "180px";
    const e = document.createElement("div");
    e.textContent = "Measurement", e.style.fontWeight = "bold", e.style.marginBottom = "6px", e.style.fontSize = "14px", t.appendChild(e);
    const s = document.createElement("div");
    s.style.display = "flex", s.style.gap = "4px", s.style.marginBottom = "8px", this._distBtn = document.createElement("button"), this._distBtn.textContent = "Distance", this._distBtn.classList.add("mode-btn"), this._distBtn.addEventListener("click", () => this.setMode("distance")), s.appendChild(this._distBtn), this._areaBtn = document.createElement("button"), this._areaBtn.textContent = "Area", this._areaBtn.classList.add("mode-btn"), this._areaBtn.addEventListener("click", () => this.setMode("area")), s.appendChild(this._areaBtn);
    const i = document.createElement("button");
    i.textContent = "Clear", i.classList.add("clear-btn"), i.addEventListener("click", () => {
      this.setMode("none");
    }), s.appendChild(i), t.appendChild(s), this._modeLabel = document.createElement("span"), this._modeLabel.classList.add("mode-label"), this._modeLabel.style.display = "block", this._modeLabel.style.fontSize = "11px", this._modeLabel.style.color = "#666", this._modeLabel.style.marginBottom = "4px", t.appendChild(this._modeLabel), this._resultLabel = document.createElement("span"), this._resultLabel.classList.add("result-label"), this._resultLabel.style.display = "block", this._resultLabel.style.fontWeight = "bold", t.appendChild(this._resultLabel), this._updateModeHighlight(), this._updateDisplay();
  }
  onViewBound(t) {
  }
  onDestroy() {
    this._points = [], this._modeLabel = null, this._resultLabel = null, this._distBtn = null, this._areaBtn = null;
  }
  _calculateTotalDistance() {
    let t = 0;
    for (let e = 1; e < this._points.length; e++) {
      const s = this._points[e - 1], i = this._points[e];
      t += Y(s[0], s[1], i[0], i[1]);
    }
    return t;
  }
  _updateModeHighlight() {
    this._distBtn && (this._distBtn.style.fontWeight = this._mode === "distance" ? "bold" : "normal"), this._areaBtn && (this._areaBtn.style.fontWeight = this._mode === "area" ? "bold" : "normal");
  }
  _updateDisplay() {
    if (!this._modeLabel || !this._resultLabel) return;
    if (this._mode === "none") {
      this._modeLabel.textContent = "Select a measurement mode", this._resultLabel.textContent = "";
      return;
    }
    this._modeLabel.textContent = `Mode: ${this._mode} | Points: ${this._points.length}`;
    const t = this.getResult();
    t.distance !== void 0 ? this._resultLabel.textContent = `${t.distance.toFixed(2)} ${t.unit}` : t.area !== void 0 ? this._resultLabel.textContent = `${t.area.toFixed(2)} ${t.unit}` : this._resultLabel.textContent = "";
  }
}
class dt extends g {
  _min;
  _max;
  _value;
  _step;
  _speed = 1;
  _playing = !1;
  _playTimer = null;
  _sliderEl = null;
  _labelEl = null;
  _playBtn = null;
  _speedLabel = null;
  _timeChangeHandlers = /* @__PURE__ */ new Set();
  constructor(t) {
    super("timeslider", t), this._min = t.min, this._max = t.max, this._value = t.value ?? new Date(t.min.getTime()), this._step = t.step ?? 864e5;
  }
  get min() {
    return this._min;
  }
  get max() {
    return this._max;
  }
  get value() {
    return this._value;
  }
  get speed() {
    return this._speed;
  }
  get playing() {
    return this._playing;
  }
  setValue(t) {
    const e = new Date(
      Math.max(this._min.getTime(), Math.min(t.getTime(), this._max.getTime()))
    );
    this._value = e, this._updateSlider(), this._emitTimeChange();
  }
  setSpeed(t) {
    this._speed = t, this._speedLabel && (this._speedLabel.textContent = `${t}x`), this._playing && (this._stopTimer(), this._startTimer());
  }
  play() {
    this._playing || (this._playing = !0, this._playBtn && (this._playBtn.textContent = "Pause"), this._startTimer());
  }
  pause() {
    this._playing && (this._playing = !1, this._playBtn && (this._playBtn.textContent = "Play"), this._stopTimer());
  }
  stop() {
    this.pause(), this._value = new Date(this._min.getTime()), this._updateSlider(), this._emitTimeChange();
  }
  onTimeChange(t) {
    this._timeChangeHandlers.add(t);
  }
  offTimeChange(t) {
    this._timeChangeHandlers.delete(t);
  }
  render(t) {
    t.style.backgroundColor = "rgba(255, 255, 255, 0.95)", t.style.borderRadius = "4px", t.style.padding = "8px", t.style.fontFamily = "sans-serif", t.style.fontSize = "13px", t.style.boxShadow = "0 1px 4px rgba(0,0,0,0.2)", t.style.minWidth = "260px";
    const e = document.createElement("div");
    e.textContent = "Time Slider", e.style.fontWeight = "bold", e.style.marginBottom = "6px", e.style.fontSize = "14px", t.appendChild(e), this._sliderEl = document.createElement("input"), this._sliderEl.type = "range", this._sliderEl.min = String(this._min.getTime()), this._sliderEl.max = String(this._max.getTime()), this._sliderEl.value = String(this._value.getTime()), this._sliderEl.step = String(this._step), this._sliderEl.style.width = "100%", this._sliderEl.style.marginBottom = "6px", this._sliderEl.addEventListener("input", () => {
      const l = parseInt(this._sliderEl.value, 10);
      this._value = new Date(l), this._updateLabel(), this._emitTimeChange();
    }), t.appendChild(this._sliderEl), this._labelEl = document.createElement("span"), this._labelEl.classList.add("time-label"), this._labelEl.style.display = "block", this._labelEl.style.textAlign = "center", this._labelEl.style.marginBottom = "6px", this._labelEl.style.fontSize = "12px", this._updateLabel(), t.appendChild(this._labelEl);
    const s = document.createElement("div");
    s.style.display = "flex", s.style.gap = "4px", s.style.alignItems = "center", this._playBtn = document.createElement("button"), this._playBtn.textContent = "Play", this._playBtn.classList.add("play-btn"), this._playBtn.addEventListener("click", () => {
      this._playing ? this.pause() : this.play();
    }), s.appendChild(this._playBtn);
    const i = document.createElement("button");
    i.textContent = "Stop", i.classList.add("stop-btn"), i.addEventListener("click", () => this.stop()), s.appendChild(i);
    const n = document.createElement("button");
    n.textContent = "Speed", n.classList.add("speed-btn"), n.addEventListener("click", () => {
      const l = this._speed === 1 ? 2 : this._speed === 2 ? 4 : 1;
      this.setSpeed(l);
    }), s.appendChild(n), this._speedLabel = document.createElement("span"), this._speedLabel.classList.add("speed-label"), this._speedLabel.textContent = `${this._speed}x`, this._speedLabel.style.fontSize = "11px", this._speedLabel.style.color = "#666", s.appendChild(this._speedLabel), t.appendChild(s);
  }
  onViewBound(t) {
  }
  onDestroy() {
    this._stopTimer(), this._timeChangeHandlers.clear(), this._sliderEl = null, this._labelEl = null, this._playBtn = null, this._speedLabel = null;
  }
  _startTimer() {
    const t = 1e3 / this._speed;
    this._playTimer = setInterval(() => {
      this._tick();
    }, t);
  }
  _stopTimer() {
    this._playTimer !== null && (clearInterval(this._playTimer), this._playTimer = null);
  }
  _tick() {
    const t = this._value.getTime() + this._step;
    if (t > this._max.getTime()) {
      this.pause();
      return;
    }
    this._value = new Date(t), this._updateSlider(), this._emitTimeChange();
  }
  _updateSlider() {
    this._sliderEl && (this._sliderEl.value = String(this._value.getTime())), this._updateLabel();
  }
  _updateLabel() {
    this._labelEl && (this._labelEl.textContent = this._value.toISOString().slice(0, 10));
  }
  _emitTimeChange() {
    for (const t of this._timeChangeHandlers)
      t(new Date(this._value.getTime()));
  }
}
const k = 300, B = 130, X = 38, Z = 8, K = 14, J = 22, o = {
  bg: "#161b22",
  surface: "#21262d",
  border: "#30363d",
  text: "#e6edf3",
  muted: "#8b949e",
  green: "#3fb950",
  red: "#f85149",
  blue: "#58a6ff",
  orange: "#d29922",
  accent: "#ff6d3a",
  chartBg: "#0d1117",
  chartGrid: "#21262d",
  terrainFill: "rgba(139,148,158,0.15)",
  terrainStroke: "#484f58"
};
class ht extends g {
  _observer = null;
  _target = null;
  _observerOffset = 1.8;
  _targetOffset = 0;
  _result = null;
  _observerInput = null;
  _targetInput = null;
  _observerOffsetInput = null;
  _targetOffsetInput = null;
  _observerSlider = null;
  _targetSlider = null;
  _resultEl = null;
  _profileCanvas = null;
  _pickBtn = null;
  _runHandlers = /* @__PURE__ */ new Set();
  _boundTool = null;
  _losUpdateHandler = null;
  _losClearHandler = null;
  constructor(t) {
    super("los", t);
  }
  // ─── Public getters ───
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
  // ─── Public setters ───
  setObserver(t, e) {
    this._observer = [t, e], this._observerInput && (this._observerInput.value = `${t.toFixed(4)}, ${e.toFixed(4)}`);
  }
  setTarget(t, e) {
    this._target = [t, e], this._targetInput && (this._targetInput.value = `${t.toFixed(4)}, ${e.toFixed(4)}`);
  }
  setObserverOffset(t) {
    this._observerOffset = t, this._observerOffsetInput && (this._observerOffsetInput.value = t.toFixed(1)), this._observerSlider && (this._observerSlider.value = String(t));
  }
  setTargetOffset(t) {
    this._targetOffset = t, this._targetOffsetInput && (this._targetOffsetInput.value = t.toFixed(1)), this._targetSlider && (this._targetSlider.value = String(t));
  }
  setResult(t) {
    this._result = t, this._renderResult(), this._renderProfile();
  }
  clearResult() {
    this._result = null, this._observer = null, this._target = null, this._observerOffset = 1.8, this._targetOffset = 0, this._observerInput && (this._observerInput.value = ""), this._targetInput && (this._targetInput.value = ""), this._observerOffsetInput && (this._observerOffsetInput.value = "1.8"), this._targetOffsetInput && (this._targetOffsetInput.value = "0"), this._observerSlider && (this._observerSlider.value = "1.8"), this._targetSlider && (this._targetSlider.value = "0"), this._resultEl && (this._resultEl.innerHTML = ""), this._clearProfileCanvas();
  }
  onRunLos(t) {
    this._runHandlers.add(t);
  }
  offRunLos(t) {
    this._runHandlers.delete(t);
  }
  _pickHandlers = /* @__PURE__ */ new Set();
  /** Register a callback for the "Pick Points" button. */
  onPick(t) {
    this._pickHandlers.add(t);
  }
  offPick(t) {
    this._pickHandlers.delete(t);
  }
  bindLosTool(t, e) {
    this._boundTool = t, this._losUpdateHandler = (s) => {
      const i = s;
      this.setObserver(i.observer[0], i.observer[1]), this.setTarget(i.target[0], i.target[1]), this.setObserverOffset(i.observerOffset), this.setTargetOffset(i.targetOffset), this.setResult(i.result);
    }, this._losClearHandler = () => {
      this.clearResult();
    }, e.on("los-update", this._losUpdateHandler), e.on("los-clear", this._losClearHandler);
  }
  // ─── Render ───
  render(t) {
    Object.assign(t.style, {
      backgroundColor: o.bg,
      borderRadius: "8px",
      padding: "0",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontSize: "12px",
      color: o.text,
      boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
      border: `1px solid ${o.border}`,
      minWidth: "310px",
      overflow: "hidden"
    });
    const e = f("div", {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "8px 12px",
      background: o.surface,
      borderBottom: `1px solid ${o.border}`
    }), s = f("span", { fontWeight: "600", fontSize: "13px", color: o.text });
    s.textContent = "Line of Sight", e.appendChild(s), t.appendChild(e);
    const i = f("div", { padding: "10px 12px" });
    i.appendChild(this._createCoordSection("observer", "Observer", o.blue)), i.appendChild(this._createHeightRow("observer", this._observerOffset)), i.appendChild(f("div", { height: "6px" })), i.appendChild(this._createCoordSection("target", "Target", o.red)), i.appendChild(this._createHeightRow("target", this._targetOffset));
    const n = f("div", { display: "flex", gap: "6px", marginTop: "10px" });
    this._pickBtn = I("Pick Points", o.accent, "#fff"), this._pickBtn.classList.add("pick-btn"), this._pickBtn.addEventListener("click", () => {
      for (const c of this._pickHandlers) c();
    }), n.appendChild(this._pickBtn);
    const l = I("Run", o.surface, o.text);
    l.classList.add("run-btn"), l.style.border = `1px solid ${o.border}`, l.addEventListener("click", () => this._emitRun()), n.appendChild(l);
    const a = I("Clear", o.surface, o.muted);
    a.classList.add("clear-btn"), a.style.border = `1px solid ${o.border}`, a.addEventListener("click", () => this.clearResult()), n.appendChild(a), i.appendChild(n), this._resultEl = f("div", { marginTop: "8px" }), this._resultEl.classList.add("los-result"), i.appendChild(this._resultEl), t.appendChild(i), this._profileCanvas = document.createElement("canvas"), this._profileCanvas.classList.add("los-profile"), this._profileCanvas.width = k, this._profileCanvas.height = B, Object.assign(this._profileCanvas.style, {
      width: `${k}px`,
      height: `${B}px`,
      display: "none",
      borderTop: `1px solid ${o.border}`
    }), t.appendChild(this._profileCanvas);
  }
  onViewBound(t) {
  }
  onDestroy() {
    this._runHandlers.clear(), this._pickHandlers.clear(), this._boundTool = null, this._losUpdateHandler = null, this._losClearHandler = null, this._observerInput = null, this._targetInput = null, this._observerOffsetInput = null, this._targetOffsetInput = null, this._observerSlider = null, this._targetSlider = null, this._resultEl = null, this._profileCanvas = null, this._pickBtn = null, this._result = null;
  }
  // ─── UI Builders ───
  _createCoordSection(t, e, s) {
    const i = f("div", { display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }), n = f("span", {
      width: "8px",
      height: "8px",
      borderRadius: "50%",
      background: s,
      flexShrink: "0"
    });
    i.appendChild(n);
    const l = f("span", { color: o.muted, fontSize: "11px", minWidth: "52px" });
    l.textContent = e, i.appendChild(l);
    const a = document.createElement("input");
    return a.type = "text", a.placeholder = "lon, lat", a.readOnly = !0, a.classList.add(`${t}-input`), Object.assign(a.style, {
      flex: "1",
      background: o.surface,
      border: `1px solid ${o.border}`,
      borderRadius: "4px",
      color: o.text,
      padding: "3px 6px",
      fontSize: "11px",
      fontFamily: "var(--font-mono, monospace)",
      outline: "none"
    }), i.appendChild(a), t === "observer" ? this._observerInput = a : this._targetInput = a, i;
  }
  _createHeightRow(t, e) {
    const s = f("div", {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      marginBottom: "4px",
      paddingLeft: "16px"
    }), i = f("span", { color: o.muted, fontSize: "10px", minWidth: "52px" });
    i.textContent = "Height", s.appendChild(i);
    const n = document.createElement("input");
    n.type = "range", n.min = "0", n.max = "200", n.step = "0.5", n.value = String(e), n.classList.add(`${t}-slider`), Object.assign(n.style, {
      flex: "1",
      height: "4px",
      accentColor: t === "observer" ? o.blue : o.red
    }), s.appendChild(n);
    const l = document.createElement("input");
    l.type = "number", l.value = e.toFixed(1), l.min = "0", l.max = "200", l.step = "0.5", l.classList.add(`${t}-offset-input`), Object.assign(l.style, {
      width: "48px",
      background: o.surface,
      border: `1px solid ${o.border}`,
      borderRadius: "4px",
      color: o.text,
      padding: "2px 4px",
      fontSize: "11px",
      textAlign: "right",
      outline: "none"
    }), s.appendChild(l);
    const a = f("span", { color: o.muted, fontSize: "10px" });
    a.textContent = "m", s.appendChild(a), t === "observer" ? (this._observerSlider = n, this._observerOffsetInput = l) : (this._targetSlider = n, this._targetOffsetInput = l);
    const c = (h) => {
      t === "observer" ? this._observerOffset = h : this._targetOffset = h, this._onOffsetChange(t);
    };
    return n.addEventListener("input", () => {
      const h = parseFloat(n.value) || 0;
      l.value = h.toFixed(1), c(h);
    }), l.addEventListener("input", () => {
      const h = parseFloat(l.value) || 0;
      n.value = String(h), c(h);
    }), s;
  }
  _onOffsetChange(t) {
    this._boundTool && (t === "observer" ? this._boundTool.setObserverOffset(this._observerOffset) : this._boundTool.setTargetOffset(this._targetOffset)), this._emitRun();
  }
  // ─── Result Display ───
  _renderResult() {
    if (!this._resultEl || !this._result) return;
    this._resultEl.innerHTML = "";
    const t = f("div", {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      padding: "4px 10px",
      borderRadius: "4px",
      fontSize: "12px",
      fontWeight: "600"
    });
    if (this._result.visible ? (Object.assign(t.style, { background: "rgba(63,185,80,0.15)", color: o.green }), t.innerHTML = `<span style="width:6px;height:6px;border-radius:50%;background:${o.green}"></span> Visible`) : (Object.assign(t.style, { background: "rgba(248,81,73,0.15)", color: o.red }), t.innerHTML = `<span style="width:6px;height:6px;border-radius:50%;background:${o.red}"></span> Blocked`), this._resultEl.appendChild(t), this._result.blockingPoint) {
      const e = this._result.blockingPoint, s = f("div", { fontSize: "11px", color: o.muted, marginTop: "4px" });
      s.classList.add("blocking-info"), s.textContent = `Obstacle: ${e[0].toFixed(4)}, ${e[1].toFixed(4)} (${e[2].toFixed(1)}m)`, this._resultEl.appendChild(s);
    }
  }
  // ─── Profile Chart ───
  _renderProfile() {
    if (!this._profileCanvas || !this._result) return;
    this._profileCanvas.style.display = "block";
    const t = this._profileCanvas.getContext("2d");
    if (!t) return;
    const e = this._result.profile, s = e.length / 2;
    if (s < 2) return;
    const i = k, n = B, l = X, a = Z, c = K, h = J, r = i - l - a, u = n - c - h, m = [], y = [];
    for (let p = 0; p < s; p++)
      m.push(e[p * 2]), y.push(e[p * 2 + 1]);
    const x = m[m.length - 1], H = Math.min(...y), O = Math.max(...y, this._observerOffset, this._targetOffset), P = Math.max(O - H, 1) * 0.12, T = H - P, $ = O + P, w = $ - T;
    t.clearRect(0, 0, i, n), t.fillStyle = o.chartBg, t.fillRect(0, 0, i, n), t.strokeStyle = o.chartGrid, t.lineWidth = 0.5;
    const L = 4;
    for (let p = 0; p <= L; p++) {
      const _ = c + p / L * u;
      t.beginPath(), t.moveTo(l, _), t.lineTo(l + r, _), t.stroke();
    }
    t.beginPath(), t.moveTo(l, c + u);
    for (let p = 0; p < s; p++) {
      const _ = l + (x > 0 ? m[p] / x * r : 0), b = c + u - (y[p] - T) / w * u;
      t.lineTo(_, b);
    }
    t.lineTo(l + r, c + u), t.closePath(), t.fillStyle = o.terrainFill, t.fill(), t.beginPath();
    for (let p = 0; p < s; p++) {
      const _ = l + (x > 0 ? m[p] / x * r : 0), b = c + u - (y[p] - T) / w * u;
      p === 0 ? t.moveTo(_, b) : t.lineTo(_, b);
    }
    t.strokeStyle = o.terrainStroke, t.lineWidth = 1, t.stroke();
    const C = c + u - (this._observerOffset + (y[0] ?? 0) - T) / w * u, M = c + u - (this._targetOffset + (y[s - 1] ?? 0) - T) / w * u;
    if (this._result.visible)
      t.beginPath(), t.moveTo(l, C), t.lineTo(l + r, M), t.strokeStyle = o.green, t.lineWidth = 1.5, t.stroke();
    else if (this._result.blockingPoint) {
      const p = tt(m, y, this._observerOffset, this._targetOffset), _ = l + p * r, b = C + p * (M - C);
      t.beginPath(), t.moveTo(l, C), t.lineTo(_, b), t.strokeStyle = o.green, t.lineWidth = 1.5, t.stroke(), t.beginPath(), t.moveTo(_, b), t.lineTo(l + r, M), t.strokeStyle = o.red, t.lineWidth = 1.5, t.setLineDash([4, 3]), t.stroke(), t.setLineDash([]);
      const v = 4;
      t.beginPath(), t.moveTo(_ - v, b - v), t.lineTo(_ + v, b + v), t.moveTo(_ + v, b - v), t.lineTo(_ - v, b + v), t.strokeStyle = o.orange, t.lineWidth = 2, t.stroke();
    }
    t.beginPath(), t.arc(l, C, 4, 0, Math.PI * 2), t.fillStyle = o.blue, t.fill(), t.beginPath(), t.arc(l + r, M, 4, 0, Math.PI * 2), t.fillStyle = o.red, t.fill(), t.fillStyle = o.muted, t.font = "9px -apple-system, sans-serif", t.textAlign = "right";
    for (let p = 0; p <= L; p++) {
      const _ = $ - p / L * w;
      t.fillText(`${_.toFixed(0)}`, l - 4, c + p / L * u + 3);
    }
    t.textAlign = "center", t.fillText("0", l, n - 5), x > 0 && t.fillText(x > 1 ? `${x.toFixed(1)}km` : `${(x * 1e3).toFixed(0)}m`, l + r, n - 5), t.font = "bold 8px -apple-system, sans-serif", t.fillStyle = o.blue, t.fillText("OBS", l, C - 7), t.fillStyle = o.red, t.fillText("TGT", l + r, M - 7);
  }
  _clearProfileCanvas() {
    if (!this._profileCanvas) return;
    const t = this._profileCanvas.getContext("2d");
    t && t.clearRect(0, 0, k, B), this._profileCanvas.style.display = "none";
  }
  _emitRun() {
    if (!this._observer || !this._target) return;
    const t = {
      observer: this._observer,
      target: this._target,
      observerOffset: this._observerOffset,
      targetOffset: this._targetOffset
    };
    for (const e of this._runHandlers) e(t);
  }
}
function f(d, t) {
  const e = document.createElement(d);
  return Object.assign(e.style, t), e;
}
function I(d, t, e) {
  const s = document.createElement("button");
  return s.textContent = d, Object.assign(s.style, {
    background: t,
    color: e,
    border: "none",
    borderRadius: "4px",
    padding: "5px 12px",
    fontSize: "11px",
    fontWeight: "500",
    cursor: "pointer",
    flex: "1"
  }), s;
}
function tt(d, t, e, s) {
  const i = d.length;
  if (i < 2) return 0.5;
  const n = d[i - 1];
  if (n <= 0) return 0.5;
  const l = (t[0] ?? 0) + e, a = (t[i - 1] ?? 0) + s;
  for (let c = 1; c < i - 1; c++) {
    const h = d[c] / n, r = l + h * (a - l);
    if ((t[c] ?? 0) > r) return h;
  }
  return 0.5;
}
class ct extends g {
  _features = [];
  _pageSize;
  _currentPage = 0;
  _tableEl = null;
  _paginationEl = null;
  _countEl = null;
  _clearHandlers = /* @__PURE__ */ new Set();
  constructor(t) {
    super("selection-inspector", t), this._pageSize = t?.pageSize ?? 10;
  }
  get features() {
    return this._features;
  }
  get currentPage() {
    return this._currentPage;
  }
  get totalPages() {
    return Math.max(1, Math.ceil(this._features.length / this._pageSize));
  }
  get pageSize() {
    return this._pageSize;
  }
  setFeatures(t) {
    this._features = t, this._currentPage = 0, this._rebuild();
  }
  clearSelection() {
    this._features = [], this._currentPage = 0, this._rebuild();
    for (const t of this._clearHandlers)
      t();
  }
  goToPage(t) {
    const e = this.totalPages - 1;
    this._currentPage = Math.max(0, Math.min(t, e)), this._rebuildTable(), this._rebuildPagination();
  }
  nextPage() {
    this.goToPage(this._currentPage + 1);
  }
  prevPage() {
    this.goToPage(this._currentPage - 1);
  }
  onClear(t) {
    this._clearHandlers.add(t);
  }
  offClear(t) {
    this._clearHandlers.delete(t);
  }
  render(t) {
    t.style.backgroundColor = "rgba(255, 255, 255, 0.95)", t.style.borderRadius = "4px", t.style.padding = "8px", t.style.fontFamily = "sans-serif", t.style.fontSize = "13px", t.style.boxShadow = "0 1px 4px rgba(0,0,0,0.2)", t.style.minWidth = "280px", t.style.maxHeight = "400px", t.style.overflowY = "auto";
    const e = document.createElement("div");
    e.style.display = "flex", e.style.justifyContent = "space-between", e.style.alignItems = "center", e.style.marginBottom = "8px";
    const s = document.createElement("span");
    s.textContent = "Selection Inspector", s.style.fontWeight = "bold", s.style.fontSize = "14px", e.appendChild(s), this._countEl = document.createElement("span"), this._countEl.classList.add("feature-count"), this._countEl.style.fontSize = "12px", this._countEl.style.color = "#666", e.appendChild(this._countEl), t.appendChild(e);
    const i = document.createElement("button");
    i.textContent = "Clear Selection", i.classList.add("clear-btn"), i.style.marginBottom = "8px", i.style.fontSize = "12px", i.addEventListener("click", () => this.clearSelection()), t.appendChild(i), this._tableEl = document.createElement("table"), this._tableEl.style.width = "100%", this._tableEl.style.borderCollapse = "collapse", this._tableEl.style.fontSize = "12px", t.appendChild(this._tableEl), this._paginationEl = document.createElement("div"), this._paginationEl.classList.add("pagination"), this._paginationEl.style.display = "flex", this._paginationEl.style.justifyContent = "center", this._paginationEl.style.gap = "4px", this._paginationEl.style.marginTop = "8px", t.appendChild(this._paginationEl), this._rebuild();
  }
  onViewBound(t) {
  }
  onDestroy() {
    this._clearHandlers.clear(), this._features = [], this._tableEl = null, this._paginationEl = null, this._countEl = null;
  }
  _rebuild() {
    this._updateCount(), this._rebuildTable(), this._rebuildPagination();
  }
  _updateCount() {
    this._countEl && (this._countEl.textContent = `${this._features.length} feature${this._features.length !== 1 ? "s" : ""}`);
  }
  _rebuildTable() {
    if (!this._tableEl) return;
    if (this._tableEl.innerHTML = "", this._features.length === 0) {
      const h = document.createElement("tr"), r = document.createElement("td");
      r.textContent = "No features selected", r.style.color = "#999", r.style.padding = "8px", h.appendChild(r), this._tableEl.appendChild(h);
      return;
    }
    const t = this._currentPage * this._pageSize, e = Math.min(t + this._pageSize, this._features.length), s = this._features.slice(t, e), i = /* @__PURE__ */ new Set();
    i.add("id");
    for (const h of s)
      for (const r of Object.keys(h.attributes))
        i.add(r);
    const n = Array.from(i), l = document.createElement("thead"), a = document.createElement("tr");
    for (const h of n) {
      const r = document.createElement("th");
      r.textContent = h, r.style.padding = "4px 6px", r.style.borderBottom = "2px solid #ddd", r.style.textAlign = "left", r.style.fontSize = "11px", r.style.fontWeight = "bold", a.appendChild(r);
    }
    l.appendChild(a), this._tableEl.appendChild(l);
    const c = document.createElement("tbody");
    for (const h of s) {
      const r = document.createElement("tr");
      r.setAttribute("data-feature-id", String(h.id));
      for (const u of n) {
        const m = document.createElement("td");
        if (m.style.padding = "3px 6px", m.style.borderBottom = "1px solid #eee", u === "id")
          m.textContent = String(h.id);
        else {
          const y = h.attributes[u];
          m.textContent = y != null ? String(y) : "";
        }
        r.appendChild(m);
      }
      c.appendChild(r);
    }
    this._tableEl.appendChild(c);
  }
  _rebuildPagination() {
    if (!this._paginationEl) return;
    this._paginationEl.innerHTML = "";
    const t = this.totalPages;
    if (t <= 1) return;
    const e = document.createElement("button");
    e.textContent = "Prev", e.classList.add("prev-btn"), e.disabled = this._currentPage === 0, e.style.fontSize = "11px", e.addEventListener("click", () => this.prevPage()), this._paginationEl.appendChild(e);
    const s = document.createElement("span");
    s.classList.add("page-info"), s.textContent = `${this._currentPage + 1} / ${t}`, s.style.fontSize = "11px", s.style.lineHeight = "24px", this._paginationEl.appendChild(s);
    const i = document.createElement("button");
    i.textContent = "Next", i.classList.add("next-btn"), i.disabled = this._currentPage >= t - 1, i.style.fontSize = "11px", i.addEventListener("click", () => this.nextPage()), this._paginationEl.appendChild(i);
  }
}
class pt extends g {
  _panels = [];
  _collapsed = /* @__PURE__ */ new Set();
  _panelEls = /* @__PURE__ */ new Map();
  _toggleBtns = /* @__PURE__ */ new Map();
  constructor(t) {
    super("dockpanel", t);
  }
  get widgets() {
    return this._panels.map((t) => ({ widget: t.widget, dockPosition: t.dockPosition }));
  }
  addWidget(t, e) {
    if (this._panels.some((i) => i.widget.id === t.id)) return;
    this._panels.push({ widget: t, dockPosition: e });
    const s = this._panelEls.get(e);
    if (s && !this._collapsed.has(e)) {
      const i = document.createElement("div");
      i.setAttribute("data-dock-widget-id", t.id), t.mount(i), s.appendChild(i);
    }
  }
  removeWidget(t) {
    const e = typeof t == "string" ? t : t.id, s = this._panels.findIndex((l) => l.widget.id === e);
    if (s === -1) return;
    const i = this._panels[s];
    i.widget.unmount();
    const n = this._panelEls.get(i.dockPosition);
    if (n) {
      const l = n.querySelector(`[data-dock-widget-id="${e}"]`);
      l && n.removeChild(l);
    }
    this._panels.splice(s, 1);
  }
  isCollapsed(t) {
    return this._collapsed.has(t);
  }
  togglePanel(t) {
    this._collapsed.has(t) ? this.expandPanel(t) : this.collapsePanel(t);
  }
  collapsePanel(t) {
    this._collapsed.add(t);
    const e = this._panelEls.get(t);
    e && (e.style.display = "none"), this._updateToggleBtn(t);
  }
  expandPanel(t) {
    this._collapsed.delete(t);
    const e = this._panelEls.get(t);
    e && (e.style.display = "block", this._rebuildPanelContent(t)), this._updateToggleBtn(t);
  }
  getWidgetsAt(t) {
    return this._panels.filter((e) => e.dockPosition === t).map((e) => e.widget);
  }
  render(t) {
    t.style.position = "relative", t.style.width = "100%", t.style.height = "100%", t.style.display = "grid", t.style.gridTemplateColumns = "auto 1fr auto", t.style.gridTemplateRows = "auto 1fr auto", t.style.fontFamily = "sans-serif", t.style.fontSize = "13px";
    const e = ["top", "left", "right", "bottom"], s = {
      top: "1 / 1 / 2 / 4",
      left: "2 / 1 / 3 / 2",
      right: "2 / 3 / 3 / 4",
      bottom: "3 / 1 / 4 / 4"
    };
    for (const i of e) {
      const n = document.createElement("div");
      n.classList.add(`dock-${i}`), n.style.gridArea = s[i];
      const l = document.createElement("button");
      l.classList.add("toggle-btn"), l.textContent = this._getToggleLabel(i, !1), l.style.fontSize = "10px", l.style.cursor = "pointer", l.addEventListener("click", () => this.togglePanel(i)), n.appendChild(l), this._toggleBtns.set(i, l);
      const a = document.createElement("div");
      a.classList.add("dock-panel-content"), a.style.display = "block", n.appendChild(a), this._panelEls.set(i, a), t.appendChild(n);
    }
  }
  onViewBound(t) {
  }
  onDestroy() {
    for (const t of this._panels)
      t.widget.unmount();
    this._panels = [], this._collapsed.clear(), this._panelEls.clear(), this._toggleBtns.clear();
  }
  _rebuildPanelContent(t) {
    const e = this._panelEls.get(t);
    if (!e) return;
    e.innerHTML = "";
    const s = this._panels.filter((i) => i.dockPosition === t);
    for (const i of s) {
      const n = document.createElement("div");
      n.setAttribute("data-dock-widget-id", i.widget.id), i.widget.mount(n), e.appendChild(n);
    }
  }
  _getToggleLabel(t, e) {
    const s = {
      left: ["◀", "▶"],
      right: ["▶", "◀"],
      top: ["▲", "▼"],
      bottom: ["▼", "▲"]
    }, [i, n] = s[t];
    return e ? i : n;
  }
  _updateToggleBtn(t) {
    const e = this._toggleBtns.get(t);
    e && (e.textContent = this._getToggleLabel(t, this._collapsed.has(t)));
  }
}
const et = [
  { toolId: "draw-point", label: "Point", icon: "●" },
  { toolId: "draw-polyline", label: "Line", icon: "╱" },
  { toolId: "draw-polygon", label: "Polygon", icon: "⬟" },
  { toolId: "edit", label: "Edit", icon: "✎" }
];
class ut extends g {
  _toolManager = null;
  _toolButtons = [];
  _undoBtn = null;
  _redoBtn = null;
  // Event handlers for cleanup
  _onToolActivate = null;
  _onToolDeactivate = null;
  _onHistoryChange = null;
  constructor(t = {}) {
    super("draw-toolbar", t);
  }
  /**
   * Bind the toolbar to a ToolManager instance.
   */
  bindToolManager(t) {
    this._toolManager = t, this._onToolActivate = ({ toolId: e }) => this._updateActiveState(e), this._onToolDeactivate = () => this._updateActiveState(null), this._onHistoryChange = ({ canUndo: e, canRedo: s }) => this._updateUndoRedo(e, s), t.on("tool-activate", this._onToolActivate), t.on("tool-deactivate", this._onToolDeactivate), t.on("history-change", this._onHistoryChange);
  }
  render(t) {
    t.style.background = "rgba(255,255,255,0.95)", t.style.borderRadius = "8px", t.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)", t.style.padding = "6px", t.style.display = "flex", t.style.flexDirection = "column", t.style.gap = "4px", t.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', t.style.userSelect = "none";
    const e = document.createElement("div");
    e.textContent = "Draw", e.style.fontSize = "11px", e.style.fontWeight = "600", e.style.color = "#666", e.style.textAlign = "center", e.style.padding = "2px 0", t.appendChild(e);
    const s = document.createElement("div");
    s.style.display = "flex", s.style.flexDirection = "column", s.style.gap = "2px", this._toolButtons = [];
    for (const l of et) {
      const a = this._createToolButton(l);
      this._toolButtons.push(a), s.appendChild(a);
    }
    t.appendChild(s);
    const i = document.createElement("hr");
    i.style.border = "none", i.style.borderTop = "1px solid #e0e0e0", i.style.margin = "2px 0", t.appendChild(i);
    const n = document.createElement("div");
    n.style.display = "flex", n.style.gap = "2px", this._undoBtn = this._createActionButton("↩", "Undo", () => {
      this._toolManager?.undo();
    }), this._redoBtn = this._createActionButton("↪", "Redo", () => {
      this._toolManager?.redo();
    }), this._undoBtn.disabled = !0, this._redoBtn.disabled = !0, n.appendChild(this._undoBtn), n.appendChild(this._redoBtn), t.appendChild(n);
  }
  onDestroy() {
    this._toolManager && (this._onToolActivate && this._toolManager.off("tool-activate", this._onToolActivate), this._onToolDeactivate && this._toolManager.off("tool-deactivate", this._onToolDeactivate), this._onHistoryChange && this._toolManager.off("history-change", this._onHistoryChange)), this._toolManager = null, this._toolButtons = [], this._undoBtn = null, this._redoBtn = null;
  }
  // ─── Private ───
  _createToolButton(t) {
    const e = document.createElement("button");
    return e.title = t.label, e.textContent = `${t.icon} ${t.label}`, e.dataset.toolId = t.toolId, e.style.display = "flex", e.style.alignItems = "center", e.style.gap = "6px", e.style.padding = "6px 10px", e.style.border = "1px solid #d0d0d0", e.style.borderRadius = "4px", e.style.background = "#fff", e.style.cursor = "pointer", e.style.fontSize = "12px", e.style.color = "#333", e.style.transition = "background 0.15s, border-color 0.15s", e.style.minWidth = "90px", e.style.textAlign = "left", e.addEventListener("mouseenter", () => {
      e.classList.contains("active") || (e.style.background = "#f0f4ff");
    }), e.addEventListener("mouseleave", () => {
      e.classList.contains("active") || (e.style.background = "#fff");
    }), e.addEventListener("click", () => {
      this._toolManager && (this._toolManager.activeTool?.id === t.toolId ? this._toolManager.deactivateTool() : this._toolManager.activateTool(t.toolId));
    }), e;
  }
  _createActionButton(t, e, s) {
    const i = document.createElement("button");
    return i.title = e, i.textContent = t, i.style.flex = "1", i.style.padding = "4px", i.style.border = "1px solid #d0d0d0", i.style.borderRadius = "4px", i.style.background = "#fff", i.style.cursor = "pointer", i.style.fontSize = "14px", i.addEventListener("click", s), i;
  }
  _updateActiveState(t) {
    for (const e of this._toolButtons) {
      const s = e.dataset.toolId === t;
      e.classList.toggle("active", s), e.style.background = s ? "#e3edff" : "#fff", e.style.borderColor = s ? "#4a90d9" : "#d0d0d0", e.style.fontWeight = s ? "600" : "400";
    }
  }
  _updateUndoRedo(t, e) {
    this._undoBtn && (this._undoBtn.disabled = !t, this._undoBtn.style.opacity = t ? "1" : "0.4"), this._redoBtn && (this._redoBtn.disabled = !e, this._redoBtn.style.opacity = e ? "1" : "0.4");
  }
}
const st = [
  { toolId: "measure-point", label: "Point", icon: "○" },
  { toolId: "measure-line", label: "Distance", icon: "╱" },
  { toolId: "measure-area", label: "Area", icon: "⬡" }
];
class _t extends g {
  _toolManager = null;
  _unitManager;
  _ownsUnitManager;
  _toolButtons = [];
  _distUnitSelect = null;
  _coordFormatSelect = null;
  // Event handlers for cleanup
  _onToolActivate = null;
  _onToolDeactivate = null;
  constructor(t = {}) {
    super("measure-toolbar", t), t.unitManager ? (this._unitManager = t.unitManager, this._ownsUnitManager = !1) : (this._unitManager = new G(), this._ownsUnitManager = !0);
  }
  get unitManager() {
    return this._unitManager;
  }
  /**
   * Bind to a ToolManager instance.
   * Listens for tool-activate/deactivate to sync button states.
   */
  bindToolManager(t) {
    this._toolManager = t, this._onToolActivate = ({ toolId: e }) => this._updateActiveState(e), this._onToolDeactivate = () => this._updateActiveState(null), t.on("tool-activate", this._onToolActivate), t.on("tool-deactivate", this._onToolDeactivate);
  }
  render(t) {
    t.style.background = "rgba(255,255,255,0.95)", t.style.borderRadius = "8px", t.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)", t.style.padding = "6px", t.style.display = "flex", t.style.flexDirection = "column", t.style.gap = "4px", t.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', t.style.userSelect = "none", t.style.minWidth = "160px";
    const e = document.createElement("div");
    e.textContent = "Measurement", e.style.fontSize = "11px", e.style.fontWeight = "600", e.style.color = "#666", e.style.textAlign = "center", e.style.padding = "2px 0", t.appendChild(e);
    const s = document.createElement("div");
    s.style.display = "flex", s.style.flexDirection = "column", s.style.gap = "2px", this._toolButtons = [];
    for (const r of st) {
      const u = this._createToolButton(r);
      this._toolButtons.push(u), s.appendChild(u);
    }
    t.appendChild(s), t.appendChild(this._createSeparator());
    const i = document.createElement("div");
    i.style.display = "flex", i.style.flexDirection = "column", i.style.gap = "3px", i.style.padding = "0 2px";
    const n = this._createLabeledRow("Units:");
    this._distUnitSelect = document.createElement("select"), this._distUnitSelect.style.fontSize = "11px", this._distUnitSelect.style.flex = "1";
    for (const r of ["metric", "imperial", "nautical"]) {
      const u = document.createElement("option");
      u.value = r, u.textContent = r.charAt(0).toUpperCase() + r.slice(1), this._distUnitSelect.appendChild(u);
    }
    this._distUnitSelect.value = this._unitManager.distanceUnit, this._distUnitSelect.addEventListener("change", () => {
      this._unitManager.distanceUnit = this._distUnitSelect.value;
    }), n.appendChild(this._distUnitSelect), i.appendChild(n);
    const l = this._createLabeledRow("Coords:");
    this._coordFormatSelect = document.createElement("select"), this._coordFormatSelect.style.fontSize = "11px", this._coordFormatSelect.style.flex = "1";
    for (const r of ["DD", "DMS", "MGRS"]) {
      const u = document.createElement("option");
      u.value = r, u.textContent = r, this._coordFormatSelect.appendChild(u);
    }
    this._coordFormatSelect.value = this._unitManager.coordinateFormat, this._coordFormatSelect.addEventListener("change", () => {
      this._unitManager.coordinateFormat = this._coordFormatSelect.value;
    }), l.appendChild(this._coordFormatSelect), i.appendChild(l), t.appendChild(i), t.appendChild(this._createSeparator());
    const a = document.createElement("div");
    a.style.display = "flex", a.style.gap = "2px";
    const c = this._createActionButton("Clear Last", () => {
      this._clearLast();
    }), h = this._createActionButton("Clear All", () => {
      this._clearAll();
    });
    a.appendChild(c), a.appendChild(h), t.appendChild(a);
  }
  onViewBound(t) {
  }
  onDestroy() {
    this._toolManager && (this._onToolActivate && this._toolManager.off("tool-activate", this._onToolActivate), this._onToolDeactivate && this._toolManager.off("tool-deactivate", this._onToolDeactivate)), this._ownsUnitManager && this._unitManager.destroy(), this._toolManager = null, this._toolButtons = [], this._distUnitSelect = null, this._coordFormatSelect = null;
  }
  // ─── Private ───
  _createToolButton(t) {
    const e = document.createElement("button");
    return e.title = t.label, e.textContent = `${t.icon} ${t.label}`, e.dataset.toolId = t.toolId, e.style.display = "flex", e.style.alignItems = "center", e.style.gap = "6px", e.style.padding = "6px 10px", e.style.border = "1px solid #d0d0d0", e.style.borderRadius = "4px", e.style.background = "#fff", e.style.cursor = "pointer", e.style.fontSize = "12px", e.style.color = "#333", e.style.transition = "background 0.15s, border-color 0.15s", e.style.textAlign = "left", e.addEventListener("mouseenter", () => {
      e.classList.contains("active") || (e.style.background = "#fff5f0");
    }), e.addEventListener("mouseleave", () => {
      e.classList.contains("active") || (e.style.background = "#fff");
    }), e.addEventListener("click", () => {
      this._toolManager && (this._toolManager.activeTool?.id === t.toolId ? this._toolManager.deactivateTool() : this._toolManager.activateTool(t.toolId));
    }), e;
  }
  _createActionButton(t, e) {
    const s = document.createElement("button");
    return s.textContent = t, s.style.flex = "1", s.style.padding = "4px 6px", s.style.border = "1px solid #d0d0d0", s.style.borderRadius = "4px", s.style.background = "#fff", s.style.cursor = "pointer", s.style.fontSize = "11px", s.addEventListener("click", e), s;
  }
  _createLabeledRow(t) {
    const e = document.createElement("div");
    e.style.display = "flex", e.style.alignItems = "center", e.style.gap = "4px";
    const s = document.createElement("span");
    return s.textContent = t, s.style.fontSize = "11px", s.style.color = "#666", s.style.minWidth = "45px", e.appendChild(s), e;
  }
  _createSeparator() {
    const t = document.createElement("hr");
    return t.style.border = "none", t.style.borderTop = "1px solid #e0e0e0", t.style.margin = "2px 0", t;
  }
  _updateActiveState(t) {
    for (const e of this._toolButtons) {
      const s = e.dataset.toolId === t;
      e.classList.toggle("active", s), e.style.background = s ? "#fff0e6" : "#fff", e.style.borderColor = s ? "#ff5722" : "#d0d0d0", e.style.fontWeight = s ? "600" : "400";
    }
  }
  _clearLast() {
    if (this._toolManager)
      for (const t of ["measure-point", "measure-line", "measure-area"]) {
        const e = this._toolManager.getTool(t);
        e && "clearLastMeasurement" in e && e.clearLastMeasurement();
      }
  }
  _clearAll() {
    if (this._toolManager)
      for (const t of ["measure-point", "measure-line", "measure-area"]) {
        const e = this._toolManager.getTool(t);
        e && "clearAllMeasurements" in e && e.clearAllMeasurements();
      }
  }
}
class ft extends g {
  _zoomInTitle;
  _zoomOutTitle;
  _btnIn = null;
  _btnOut = null;
  constructor(t) {
    super(t?.id ?? "zoom-control", t), this._zoomInTitle = t?.zoomInTitle ?? "Zoom in", this._zoomOutTitle = t?.zoomOutTitle ?? "Zoom out", t?.position || (this.position = "top-left");
  }
  render(t) {
    t.style.display = "flex", t.style.flexDirection = "column", t.style.gap = "1px", t.style.borderRadius = "4px", t.style.overflow = "hidden", t.style.boxShadow = "0 1px 5px rgba(0,0,0,0.4)", t.style.userSelect = "none", this._btnIn = this._createButton("+", this._zoomInTitle, () => {
      this._view?.zoomIn?.({ duration: 300 });
    }), this._btnOut = this._createButton("−", this._zoomOutTitle, () => {
      this._view?.zoomOut?.({ duration: 300 });
    }), t.appendChild(this._btnIn), t.appendChild(this._btnOut);
  }
  _createButton(t, e, s) {
    const i = document.createElement("button");
    return i.textContent = t, i.title = e, i.setAttribute("aria-label", e), i.style.cssText = `
      display: flex; align-items: center; justify-content: center;
      width: 30px; height: 30px; border: none; margin: 0;
      background: rgba(22,27,34,0.9); color: #e6edf3;
      font-size: 18px; font-weight: 700; line-height: 1;
      cursor: pointer; font-family: -apple-system, sans-serif;
      transition: background 0.15s;
    `, i.addEventListener("mouseenter", () => {
      i.style.background = "rgba(22,27,34,1)";
    }), i.addEventListener("mouseleave", () => {
      i.style.background = "rgba(22,27,34,0.9)";
    }), i.addEventListener("click", (n) => {
      n.stopPropagation(), s();
    }), i;
  }
  onViewBound(t) {
  }
}
class gt extends g {
  _prefix;
  _attributions = /* @__PURE__ */ new Set();
  _contentEl = null;
  constructor(t) {
    super(t?.id ?? "attribution", t), this._prefix = t?.prefix ?? "MapGPU", t?.position || (this.position = "bottom-right");
  }
  addAttribution(t) {
    return this._attributions.add(t), this._updateContent(), this;
  }
  removeAttribution(t) {
    return this._attributions.delete(t), this._updateContent(), this;
  }
  setPrefix(t) {
    return this._prefix = t, this._updateContent(), this;
  }
  render(t) {
    t.style.background = "rgba(255,255,255,0.75)", t.style.padding = "2px 6px", t.style.borderRadius = "3px", t.style.fontSize = "11px", t.style.fontFamily = "-apple-system, BlinkMacSystemFont, sans-serif", t.style.color = "#333", t.style.lineHeight = "1.4", t.style.pointerEvents = "auto", this._contentEl = document.createElement("div"), t.appendChild(this._contentEl), this._updateContent();
  }
  _updateContent() {
    if (!this._contentEl) return;
    const t = [];
    this._prefix !== !1 && t.push(this._prefix);
    for (const e of this._attributions) t.push(e);
    this._contentEl.innerHTML = t.join(" | ");
  }
  onViewBound(t) {
  }
}
class mt {
  _container;
  _view = null;
  _position = null;
  _offset = [0, -12];
  _isOpen = !1;
  _viewChangeHandler = null;
  constructor() {
    this._container = document.createElement("div"), this._container.className = "mapgpu-popup", this._container.style.cssText = "position:absolute;display:none;z-index:1000;pointer-events:auto;transform:translate(-50%,-100%);";
  }
  /** Whether the popup is currently visible. */
  get isOpen() {
    return this._isOpen;
  }
  /** The popup DOM container element. */
  get container() {
    return this._container;
  }
  /**
   * Attach to a view (IView must have on/off/toScreen).
   * The popup appends itself to the view's container parent.
   */
  attachTo(t) {
    this._view = t;
    const e = t.canvas?.parentElement;
    e && !this._container.parentElement && (e.style.position = "relative", e.appendChild(this._container)), this._viewChangeHandler = () => this._reposition(), t.on("view-change", this._viewChangeHandler);
  }
  /** Open the popup at the given position with content. */
  open(t) {
    this._position = t.position, this._offset = t.offset ?? [0, -12], t.maxWidth && (this._container.style.maxWidth = `${t.maxWidth}px`), typeof t.content == "string" ? this._container.innerHTML = t.content : (this._container.innerHTML = "", this._container.appendChild(t.content)), this._isOpen = !0, this._container.style.display = "", this._reposition();
  }
  /** Close and hide the popup. */
  close() {
    this._isOpen = !1, this._container.style.display = "none", this._position = null;
  }
  /** Clean up DOM and event listeners. */
  destroy() {
    this.close(), this._viewChangeHandler && this._view && this._view.off("view-change", this._viewChangeHandler), this._container.remove(), this._view = null;
  }
  _reposition() {
    if (!this._isOpen || !this._position || !this._view) {
      this._container.style.display = "none";
      return;
    }
    const t = this._view.toScreen(this._position[0], this._position[1]);
    if (!t) {
      this._container.style.display = "none";
      return;
    }
    this._container.style.display = "", this._container.style.left = `${t[0] + this._offset[0]}px`, this._container.style.top = `${t[1] + this._offset[1]}px`;
  }
}
class yt {
  _parent = null;
  _view = null;
  _permanents = /* @__PURE__ */ new Map();
  _stickyEl;
  /** Whether the sticky tooltip is currently visible. */
  stickyVisible = !1;
  _viewChangeHandler = null;
  constructor() {
    this._stickyEl = document.createElement("div"), this._stickyEl.className = "mapgpu-tooltip mapgpu-tooltip--sticky", this._stickyEl.style.cssText = "position:absolute;display:none;z-index:1001;pointer-events:none;white-space:nowrap;";
  }
  /** Attach to a view for coordinate conversion and view-change events. */
  attachTo(t) {
    this._view = t, this._parent = t.canvas?.parentElement ?? null, this._parent && (this._parent.style.position = "relative", this._parent.appendChild(this._stickyEl)), this._viewChangeHandler = () => this._repositionAll(), t.on("view-change", this._viewChangeHandler);
  }
  /** Add a permanent tooltip pinned at a geographic coordinate. */
  addPermanent(t, e, s, i) {
    this.removePermanent(t);
    const n = document.createElement("div");
    n.className = `mapgpu-tooltip mapgpu-tooltip--permanent ${i?.className ?? ""}`.trim(), n.style.cssText = "position:absolute;z-index:1001;pointer-events:none;white-space:nowrap;", n.textContent = e;
    const l = i?.offset ?? [10, 0], a = { id: t, element: n, coordinate: s, offset: l };
    this._permanents.set(t, a), this._parent && this._parent.appendChild(n), this._repositionOne(a);
  }
  /** Remove a permanent tooltip by id. */
  removePermanent(t) {
    const e = this._permanents.get(t);
    e && (e.element.remove(), this._permanents.delete(t));
  }
  /** Show a sticky tooltip at screen coordinates (follows mouse). */
  showSticky(t, e, s) {
    this._stickyEl.textContent = t, this._stickyEl.style.display = "", this._stickyEl.style.left = `${e + 10}px`, this._stickyEl.style.top = `${s}px`, this.stickyVisible = !0;
  }
  /** Hide the sticky tooltip. */
  hideSticky() {
    this._stickyEl.style.display = "none", this.stickyVisible = !1;
  }
  /** Clean up all tooltips and event listeners. */
  destroy() {
    this.hideSticky();
    for (const [t] of this._permanents)
      this.removePermanent(t);
    this._viewChangeHandler && this._view && this._view.off("view-change", this._viewChangeHandler), this._stickyEl.remove(), this._view = null, this._parent = null;
  }
  _repositionAll() {
    for (const t of this._permanents.values())
      this._repositionOne(t);
  }
  _repositionOne(t) {
    if (!this._view) return;
    const e = this._view.toScreen(t.coordinate[0], t.coordinate[1]);
    if (!e) {
      t.element.style.display = "none";
      return;
    }
    t.element.style.display = "", t.element.style.left = `${e[0] + t.offset[0]}px`, t.element.style.top = `${e[1] + t.offset[1]}px`;
  }
}
export {
  gt as AttributionWidget,
  at as BasemapGalleryWidget,
  S as CoordinatesWidget,
  pt as DockPanel,
  ut as DrawToolbarWidget,
  ht as LOSWidget,
  lt as LayerListWidget,
  _t as MeasureToolbarWidget,
  rt as MeasurementWidget,
  mt as PopupWidget,
  D as ScaleBarWidget,
  ot as SearchWidget,
  ct as SelectionInspectorWidget,
  dt as TimeSliderWidget,
  yt as TooltipWidget,
  g as WidgetBase,
  ft as ZoomControlWidget,
  Y as haversineDistance,
  Q as sphericalPolygonArea
};
