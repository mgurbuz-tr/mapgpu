import { EventBus as J, SimpleRenderer as Y, IncrementalWallBuffer as ee, WorkerPool as te, mercatorToLonLat as H, lonLatToMercator as I } from "@mapgpu/core";
import { gridCluster as ie } from "@mapgpu/render-webgpu";
let z = 0;
function re(s) {
  return z += 1, `${s}-${z}`;
}
class y {
  id;
  _visible;
  _opacity;
  _loaded = !1;
  _destroyed = !1;
  minScale;
  maxScale;
  zIndex;
  interactive;
  blendMode;
  filters;
  _fullExtent;
  eventBus = new J();
  constructor(e = {}) {
    this.id = e.id ?? re("layer"), this._visible = e.visible ?? !0, this._opacity = e.opacity ?? 1, this.minScale = e.minScale, this.maxScale = e.maxScale, this.zIndex = e.zIndex, this.interactive = e.interactive ?? !0, this.blendMode = e.blendMode ?? "normal", this.filters = e.filters;
  }
  // ─── Visible ───
  get visible() {
    return this._visible;
  }
  set visible(e) {
    this._visible !== e && (this._visible = e, this.eventBus.emit("visibility-change", e));
  }
  // ─── Opacity ───
  get opacity() {
    return this._opacity;
  }
  set opacity(e) {
    const t = Math.max(0, Math.min(1, e));
    this._opacity !== t && (this._opacity = t, this.eventBus.emit("opacity-change", t));
  }
  // ─── Loaded state ───
  get loaded() {
    return this._loaded;
  }
  setLoaded(e) {
    this._loaded = e;
  }
  // ─── Full Extent ───
  get fullExtent() {
    return this._fullExtent;
  }
  // ─── Lifecycle ───
  async load() {
    if (!this._loaded) {
      if (this._destroyed)
        throw new Error(`Layer "${this.id}" has been destroyed and cannot be loaded.`);
      try {
        await this.onLoad(), this._loaded = !0, this.eventBus.emit("load", void 0);
      } catch (e) {
        const t = {
          code: "LAYER_LOAD_FAILED",
          message: e instanceof Error ? e.message : String(e),
          cause: e instanceof Error ? e : new Error(String(e))
        };
        throw this.eventBus.emit("error", t), e;
      }
    }
  }
  refresh() {
    this.eventBus.emit("refresh", void 0);
  }
  /**
   * Signal that the layer's visual style has changed (e.g. renderer update)
   * without clearing data or resetting load state.
   *
   * Emits the same 'refresh' event so that any listening render cache
   * (e.g. VectorBufferCache) is invalidated and the map repaints.
   * Unlike {@link refresh}, this does NOT clear features or mark the
   * layer as unloaded.
   */
  redraw() {
    this.eventBus.emit("refresh", void 0);
  }
  destroy() {
    this._destroyed || (this._destroyed = !0, this._loaded = !1, this.eventBus.removeAll());
  }
  // ─── Event delegation ───
  on(e, t) {
    this.eventBus.on(
      e,
      t
    );
  }
  off(e, t) {
    this.eventBus.off(
      e,
      t
    );
  }
}
class Ke extends y {
  type = "wms";
  url;
  layerNames;
  format;
  transparent;
  crs;
  proxyUrl;
  vendorParams;
  adapter;
  capabilities = null;
  layerInfos = [];
  constructor(e) {
    super(e), this.url = e.url, this.layerNames = e.layers, this.format = e.format ?? "image/png", this.transparent = e.transparent ?? !0, this.crs = e.crs, this.proxyUrl = e.proxyUrl, this.vendorParams = e.vendorParams, this.adapter = e.adapter ?? null;
  }
  async onLoad() {
    if (!this.adapter)
      throw new Error(
        "WMSLayer: no adapter provided. Supply an IMapImageryAdapter via the adapter option."
      );
    this.capabilities = await this.adapter.getCapabilities(), this.layerInfos = this.capabilities.layers.filter(
      (e) => this.layerNames.includes(e.name)
    ), this._fullExtent = this.computeExtent();
  }
  /**
   * Compute the combined extent of all configured layer names
   * from capabilities metadata.
   */
  computeExtent() {
    let e = 1 / 0, t = 1 / 0, i = -1 / 0, r = -1 / 0, n = !1;
    for (const a of this.layerInfos)
      a.extent && (n = !0, e = Math.min(e, a.extent[0]), t = Math.min(t, a.extent[1]), i = Math.max(i, a.extent[2]), r = Math.max(r, a.extent[3]));
    if (n)
      return { minX: e, minY: t, maxX: i, maxY: r };
  }
  /**
   * Build a GetMap tile URL for the given extent and pixel dimensions.
   */
  getTileUrl(e, t, i) {
    if (!this.adapter)
      throw new Error("WMSLayer must be loaded before calling getTileUrl().");
    return this.adapter.getMapUrl({
      layers: this.layerNames,
      bbox: {
        minX: e.minX,
        minY: e.minY,
        maxX: e.maxX,
        maxY: e.maxY
      },
      width: t,
      height: i,
      crs: this.crs,
      format: this.format,
      transparent: this.transparent,
      vendorParams: this.vendorParams
    });
  }
  /**
   * Execute a GetFeatureInfo query at the given pixel position.
   */
  async getFeatureInfo(e, t, i, r, n) {
    if (!this.adapter || !this.adapter.getFeatureInfo)
      throw new Error(
        "WMSLayer must be loaded and adapter must support getFeatureInfo()."
      );
    return this.adapter.getFeatureInfo({
      layers: this.layerNames,
      bbox: {
        minX: i.minX,
        minY: i.minY,
        maxX: i.maxX,
        maxY: i.maxY
      },
      width: r,
      height: n,
      x: e,
      y: t,
      crs: this.crs
    });
  }
  /**
   * Get the layer metadata from capabilities.
   */
  getLayerInfos() {
    return this.layerInfos;
  }
}
class Qe extends y {
  type = "geojson";
  /** Optional renderer for feature-level symbology. */
  _renderer;
  get renderer() {
    return this._renderer;
  }
  set renderer(e) {
    this._renderer = e, this.redraw();
  }
  url;
  initialData;
  fetchFn;
  features = [];
  _onEachFeature;
  constructor(e) {
    if (super(e), this.url = e.url, this.initialData = e.data, this.fetchFn = e.fetchFn ?? globalThis.fetch?.bind(globalThis), this._onEachFeature = e.onEachFeature, !e.url && !e.data)
      throw new Error("GeoJSONLayer requires either a url or data option.");
  }
  async onLoad() {
    let e;
    if (this.initialData)
      e = this.initialData;
    else if (this.url) {
      const t = await this.fetchFn(this.url);
      if (!t.ok)
        throw new Error(`GeoJSON fetch failed: HTTP ${t.status}`);
      e = await t.json();
    } else
      throw new Error("No data source configured.");
    if (this.features = this.parseFeatureCollection(e), this._onEachFeature)
      for (const t of this.features) this._onEachFeature(t);
    this._fullExtent = this.computeExtent();
  }
  /**
   * Dynamically add GeoJSON data to the layer (Leaflet L.geoJSON.addData equivalent).
   * Appends features without clearing existing ones.
   */
  addData(e) {
    const t = this.parseFeatureCollection(e);
    if (this._onEachFeature)
      for (const i of t) this._onEachFeature(i);
    this.features.push(...t), this._fullExtent = this.computeExtent(), this.redraw();
  }
  /**
   * Parse a GeoJSON FeatureCollection into internal Feature objects.
   */
  parseFeatureCollection(e) {
    if (e.type !== "FeatureCollection" || !Array.isArray(e.features))
      throw new Error("Invalid GeoJSON: expected FeatureCollection.");
    return e.features.map((t, i) => ({
      id: t.id ?? i,
      geometry: {
        type: t.geometry.type,
        coordinates: t.geometry.coordinates
      },
      attributes: t.properties ?? {}
    }));
  }
  /**
   * Compute the bounding box of all features.
   */
  computeExtent() {
    if (this.features.length === 0) return;
    let e = 1 / 0, t = 1 / 0, i = -1 / 0, r = -1 / 0;
    for (const n of this.features)
      this.expandExtent(n.geometry.coordinates, (a, l) => {
        e = Math.min(e, a), t = Math.min(t, l), i = Math.max(i, a), r = Math.max(r, l);
      });
    if (isFinite(e))
      return { minX: e, minY: t, maxX: i, maxY: r };
  }
  /**
   * Recursively walk nested coordinate arrays and invoke cb for each [x,y].
   */
  expandExtent(e, t) {
    if (!(!Array.isArray(e) || e.length === 0)) {
      if (typeof e[0] == "number") {
        t(e[0], e[1] ?? 0);
        return;
      }
      for (const i of e)
        this.expandExtent(i, t);
    }
  }
  // ─── IQueryableLayer ───
  async queryFeatures(e) {
    let t = this.features;
    if (e.geometry) {
      const i = e.geometry;
      t = t.filter((r) => this.featureIntersectsBbox(r, i));
    }
    if (e.where && (t = this.applyWhereFilter(t, e.where)), e.outFields && e.outFields.length > 0) {
      const i = new Set(e.outFields);
      t = t.map((r) => ({
        ...r,
        attributes: Object.fromEntries(
          Object.entries(r.attributes).filter(([n]) => i.has(n))
        )
      }));
    }
    return e.maxResults !== void 0 && (t = t.slice(0, e.maxResults)), t;
  }
  async queryExtent(e) {
    const t = e ? await this.queryFeatures(e) : this.features;
    let i = 1 / 0, r = 1 / 0, n = -1 / 0, a = -1 / 0;
    for (const l of t)
      this.expandExtent(l.geometry.coordinates, (o, h) => {
        i = Math.min(i, o), r = Math.min(r, h), n = Math.max(n, o), a = Math.max(a, h);
      });
    return { minX: i, minY: r, maxX: n, maxY: a };
  }
  refresh() {
    this.features = [], this.setLoaded(!1), super.refresh(), this.load();
  }
  /**
   * Get all features in memory (after load).
   */
  getFeatures() {
    return this.features;
  }
  // ─── Private helpers ───
  featureIntersectsBbox(e, t) {
    let i = !1;
    return this.expandExtent(e.geometry.coordinates, (r, n) => {
      r >= t.minX && r <= t.maxX && n >= t.minY && n <= t.maxY && (i = !0);
    }), i;
  }
  /**
   * Apply a simple where clause. Supports:
   *   "field = 'value'"
   *   "field = number"
   *   "field > number"
   *   "field < number"
   *   "field >= number"
   *   "field <= number"
   *   "field != 'value'"
   */
  applyWhereFilter(e, t) {
    const i = t.match(
      /^\s*(\w+)\s*(=|!=|>|<|>=|<=)\s*(?:'([^']*)'|(\S+))\s*$/
    );
    if (!i) return e;
    const r = i[1], n = i[2], a = i[3], l = i[4], o = a !== void 0 ? a : Number(l);
    return e.filter((h) => {
      const u = h.attributes[r];
      if (u === void 0) return !1;
      switch (n) {
        case "=":
          return u === o || typeof u == "number" && u === Number(o);
        case "!=":
          return u !== o;
        case ">":
          return typeof u == "number" && u > Number(o);
        case "<":
          return typeof u == "number" && u < Number(o);
        case ">=":
          return typeof u == "number" && u >= Number(o);
        case "<=":
          return typeof u == "number" && u <= Number(o);
        default:
          return !0;
      }
    });
  }
}
class Je extends y {
  type = "raster-tile";
  urlTemplate;
  tms;
  subdomains;
  minZoom;
  maxZoom;
  attribution;
  subdomainIndex = 0;
  constructor(e) {
    if (super(e), !e.urlTemplate)
      throw new Error("RasterTileLayer requires a urlTemplate option.");
    this.urlTemplate = e.urlTemplate, this.tms = e.tms ?? !1, this.subdomains = e.subdomains ?? [], this.minZoom = e.minZoom ?? 0, this.maxZoom = e.maxZoom ?? 22, this.attribution = e.attribution, this._fullExtent = {
      minX: -180,
      minY: -85.0511287798,
      maxX: 180,
      maxY: 85.0511287798
    };
  }
  async onLoad() {
    this.validateTemplate();
  }
  /**
   * Validate that the URL template contains required placeholders.
   */
  validateTemplate() {
    const e = this.urlTemplate.includes("{z}"), t = this.urlTemplate.includes("{x}"), i = this.urlTemplate.includes("{y}");
    if (!e || !t || !i)
      throw new Error(
        "RasterTileLayer urlTemplate must contain {z}, {x}, and {y} placeholders."
      );
    if (this.urlTemplate.includes("{s}") && this.subdomains.length === 0)
      throw new Error(
        "RasterTileLayer urlTemplate contains {s} but no subdomains were provided."
      );
  }
  /**
   * Generate a tile URL for the given tile coordinates.
   *
   * @param z - Zoom level
   * @param x - Tile column
   * @param y - Tile row (standard XYZ convention: 0 = top)
   */
  getTileUrl(e, t, i) {
    let r = this.urlTemplate;
    const n = this.tms ? (1 << e) - 1 - i : i;
    if (r = r.replace("{z}", String(e)), r = r.replace("{x}", String(t)), r = r.replace("{y}", String(n)), this.subdomains.length > 0 && r.includes("{s}")) {
      const a = this.subdomains[this.subdomainIndex % this.subdomains.length];
      this.subdomainIndex = (this.subdomainIndex + 1) % this.subdomains.length, r = r.replace("{s}", a);
    }
    return r;
  }
  /**
   * Check if a zoom level is within the valid range.
   */
  isZoomValid(e) {
    return e >= this.minZoom && e <= this.maxZoom;
  }
  /**
   * Get the full extent as an Extent object.
   */
  get fullExtent() {
    return this._fullExtent;
  }
}
class se extends y {
  type = "graphics";
  /** Optional renderer for feature-level symbology. */
  _renderer;
  get renderer() {
    return this._renderer;
  }
  set renderer(e) {
    this._renderer = e, this.redraw();
  }
  _elevationInfo = { mode: "absolute" };
  get elevationInfo() {
    return this._elevationInfo;
  }
  setElevationInfo(e) {
    this._elevationInfo = e, this.refresh();
  }
  _graphics = [];
  graphicsMap = /* @__PURE__ */ new Map();
  constructor(e = {}) {
    super(e);
  }
  async onLoad() {
  }
  // ─── Feature management ───
  /**
   * Add a feature to the layer.
   */
  add(e) {
    this.graphicsMap.has(e.id) && (this._graphics = this._graphics.filter((t) => t.id !== e.id)), this._graphics.push(e), this.graphicsMap.set(e.id, e), this.updateExtent(), this.refresh();
  }
  /**
   * Add multiple features at once.
   */
  addMany(e) {
    for (const t of e)
      this.add(t);
  }
  /**
   * Replace all features atomically with a single refresh.
   * Much more efficient than clear() + addMany() for animation loops.
   */
  replaceAll(e) {
    this._graphics = [], this.graphicsMap.clear();
    for (const t of e)
      this._graphics.push(t), this.graphicsMap.set(t.id, t);
    this.updateExtent(), this.refresh();
  }
  /**
   * Remove a feature by id.
   * Returns true if the feature was found and removed.
   */
  remove(e) {
    return this.graphicsMap.has(e) ? (this._graphics = this._graphics.filter((t) => t.id !== e), this.graphicsMap.delete(e), this.updateExtent(), this.refresh(), !0) : !1;
  }
  /**
   * Remove all features.
   */
  clear() {
    this._graphics = [], this.graphicsMap.clear(), this._fullExtent = void 0, this.refresh();
  }
  /**
   * Get a readonly view of all current features.
   */
  get graphics() {
    return this._graphics;
  }
  /**
   * Get the number of features.
   */
  get count() {
    return this._graphics.length;
  }
  // ─── IFeatureLayer ───
  /**
   * Get all features in this layer.
   */
  getFeatures() {
    return this._graphics;
  }
  // ─── IQueryableLayer ───
  async queryFeatures(e) {
    let t = this._graphics;
    if (e.geometry) {
      const i = e.geometry;
      t = t.filter((r) => this.featureIntersectsBbox(r, i));
    }
    if (e.where && (t = this.applyWhereFilter(t, e.where)), e.outFields && e.outFields.length > 0) {
      const i = new Set(e.outFields);
      t = t.map((r) => ({
        ...r,
        attributes: Object.fromEntries(
          Object.entries(r.attributes).filter(([n]) => i.has(n))
        )
      }));
    }
    return e.maxResults !== void 0 && (t = t.slice(0, e.maxResults)), t;
  }
  async queryExtent(e) {
    const t = e ? await this.queryFeatures(e) : this._graphics;
    let i = 1 / 0, r = 1 / 0, n = -1 / 0, a = -1 / 0;
    for (const l of t)
      this.expandExtent(l.geometry.coordinates, (o, h) => {
        i = Math.min(i, o), r = Math.min(r, h), n = Math.max(n, o), a = Math.max(a, h);
      });
    return { minX: i, minY: r, maxX: n, maxY: a };
  }
  // ─── Private helpers ───
  updateExtent() {
    if (this._graphics.length === 0) {
      this._fullExtent = void 0;
      return;
    }
    let e = 1 / 0, t = 1 / 0, i = -1 / 0, r = -1 / 0;
    for (const n of this._graphics)
      this.expandExtent(n.geometry.coordinates, (a, l) => {
        e = Math.min(e, a), t = Math.min(t, l), i = Math.max(i, a), r = Math.max(r, l);
      });
    isFinite(e) ? this._fullExtent = { minX: e, minY: t, maxX: i, maxY: r } : this._fullExtent = void 0;
  }
  expandExtent(e, t) {
    if (!(!Array.isArray(e) || e.length === 0)) {
      if (typeof e[0] == "number") {
        t(e[0], e[1] ?? 0);
        return;
      }
      for (const i of e)
        this.expandExtent(i, t);
    }
  }
  featureIntersectsBbox(e, t) {
    let i = !1;
    return this.expandExtent(e.geometry.coordinates, (r, n) => {
      r >= t.minX && r <= t.maxX && n >= t.minY && n <= t.maxY && (i = !0);
    }), i;
  }
  applyWhereFilter(e, t) {
    const i = t.match(
      /^\s*(\w+)\s*(=|!=|>|<|>=|<=)\s*(?:'([^']*)'|(\S+))\s*$/
    );
    if (!i) return e;
    const r = i[1], n = i[2], a = i[3], l = i[4], o = a !== void 0 ? a : Number(l);
    return e.filter((h) => {
      const u = h.attributes[r];
      if (u === void 0) return !1;
      switch (n) {
        case "=":
          return u === o || typeof u == "number" && u === Number(o);
        case "!=":
          return u !== o;
        case ">":
          return typeof u == "number" && u > Number(o);
        case "<":
          return typeof u == "number" && u < Number(o);
        case ">=":
          return typeof u == "number" && u >= Number(o);
        case "<=":
          return typeof u == "number" && u <= Number(o);
        default:
          return !0;
      }
    });
  }
}
class et extends se {
  // @ts-expect-error — WallLayer narrows the type from 'graphics' to 'wall'
  type = "wall";
  _lons = [];
  _lats = [];
  _maxH = [];
  _minH = [];
  /** Incremental GPU buffer — created via bindRenderEngine(). */
  _incrementalBuffer = null;
  /** Whether terrain offset has been applied to the current buffer data. */
  _terrainApplied = !1;
  constructor(e = {}) {
    if (super(e), this.renderer = new Y({
      type: "simple-fill",
      color: e.fillColor ?? [255, 109, 58, 60],
      outlineColor: e.outlineColor ?? [255, 109, 58, 180],
      outlineWidth: e.outlineWidth ?? 1
    }), e.positions && e.heights) {
      const t = Math.min(e.positions.length, e.heights.length);
      for (let i = 0; i < t; i++)
        this._lons.push(e.positions[i][0]), this._lats.push(e.positions[i][1]), this._maxH.push(e.heights[i]), this._minH.push(e.minimumHeights?.[i] ?? 0);
      this._rebuild();
    }
  }
  /** Number of points in the wall. */
  get length() {
    return this._lons.length;
  }
  /** Append a new point — wall grows, geometry auto-updates. */
  append(e, t, i, r = 0) {
    if (this._lons.push(e), this._lats.push(t), this._maxH.push(i), this._minH.push(r), this._incrementalBuffer && this._lons.length >= 2) {
      const n = this._lons.length - 2;
      this._incrementalBuffer.appendSegment(
        this._lons[n],
        this._lats[n],
        this._minH[n],
        this._maxH[n],
        this._lons[n + 1],
        this._lats[n + 1],
        this._minH[n + 1],
        this._maxH[n + 1]
      ), this._terrainApplied = !1, this.redraw();
      return;
    }
    this._rebuild();
  }
  /** Remove all points and clear. */
  clear() {
    this._lons.length = 0, this._lats.length = 0, this._maxH.length = 0, this._minH.length = 0, this._incrementalBuffer?.clear(), this._terrainApplied = !1, super.clear();
  }
  /** Replace all data at once. */
  setPositions(e, t, i) {
    this._lons = e.map((r) => r[0]), this._lats = e.map((r) => r[1]), this._maxH = [...t], this._minH = i ? [...i] : new Array(e.length).fill(0), this._incrementalBuffer && (this._incrementalBuffer.rebuildFromControlPoints(this._lons, this._lats, this._maxH, this._minH), this._terrainApplied = !1), this._rebuild();
  }
  /** Raw wall control points for render paths that generate real curtain meshes. */
  getWallGeometryData() {
    return {
      positions: this._lons.map((e, t) => [e, this._lats[t]]),
      maximumHeights: [...this._maxH],
      minimumHeights: [...this._minH]
    };
  }
  /** Update fill/outline style. */
  setStyle(e) {
    this.renderer = new Y({
      type: "simple-fill",
      color: e.fillColor ?? [255, 109, 58, 60],
      outlineColor: e.outlineColor ?? [255, 109, 58, 180],
      outlineWidth: e.outlineWidth ?? 1
    });
  }
  // ─── Incremental buffer integration ───
  /**
   * Bind a render engine to enable incremental GPU buffer appends.
   * Called by the rendering system when the layer is first rendered.
   */
  bindRenderEngine(e) {
    this._incrementalBuffer || (this._incrementalBuffer = new ee(e), this._lons.length >= 2 && this._incrementalBuffer.rebuildFromControlPoints(this._lons, this._lats, this._maxH, this._minH));
  }
  /** Whether this layer has an active incremental buffer with data. */
  hasIncrementalBuffer() {
    return this._incrementalBuffer !== null && this._incrementalBuffer.segmentCount > 0;
  }
  /** Get the incremental render buffer for direct draw calls. */
  getIncrementalRenderBuffer() {
    return this._incrementalBuffer?.getRenderBuffer() ?? null;
  }
  /** Get the wall fill symbol for rendering. */
  getWallSymbol() {
    const e = this.renderer, t = { id: "__wall__", geometry: { type: "Polygon", coordinates: [] }, attributes: {} }, i = e?.getSymbol?.(t) ?? null;
    return {
      type: "mesh-3d",
      meshType: "box",
      color: i && "color" in i ? i.color : [255, 109, 58, 60],
      ambient: 1,
      shininess: 18,
      specularStrength: 0
    };
  }
  /**
   * Rebuild the incremental buffer with terrain elevation offsets baked in.
   * Called by the render path when elevationInfo.mode !== 'absolute'.
   */
  rebuildWithTerrain(e, t) {
    !this._incrementalBuffer || this._lons.length < 2 || this._terrainApplied || (this._incrementalBuffer.rebuildFromControlPoints(
      this._lons,
      this._lats,
      this._maxH,
      this._minH,
      e,
      t
    ), this._terrainApplied = !0);
  }
  destroy() {
    this._incrementalBuffer?.destroy(), this._incrementalBuffer = null, super.destroy();
  }
  // ─── Internal rebuild ───
  _rebuild() {
    const e = this._lons.length;
    if (e < 2) {
      super.clear();
      return;
    }
    const t = 1e-5, i = [];
    for (let r = 0; r < e - 1; r++) {
      const n = this._lons[r], a = this._lats[r], l = this._lons[r + 1], o = this._lats[r + 1], h = this._minH[r] ?? 0, u = this._minH[r + 1] ?? 0, c = this._maxH[r], m = this._maxH[r + 1], d = l - n, f = o - a, _ = Math.sqrt(d * d + f * f) || 1, p = -f / _ * t, x = d / _ * t;
      i.push({
        id: `__wq${r}`,
        geometry: {
          type: "Polygon",
          coordinates: [[
            [n, a, h],
            [l, o, u],
            [l + p, o + x, m],
            [n + p, a + x, c],
            [n, a, h]
            // close
          ]]
        },
        attributes: {}
      });
    }
    this.replaceAll(i);
  }
}
class tt extends y {
  type = "feature";
  /** Optional renderer for feature-level symbology. */
  _renderer;
  get renderer() {
    return this._renderer;
  }
  set renderer(e) {
    this._renderer = e, this.redraw();
  }
  _elevationInfo = { mode: "absolute" };
  get elevationInfo() {
    return this._elevationInfo;
  }
  setElevationInfo(e) {
    this._elevationInfo = e, this.refresh();
  }
  url;
  collectionId;
  adapter;
  adapterFactory;
  collections = [];
  cachedFeatures = [];
  enableCache;
  constructor(e) {
    if (super(e), !e.url && !e.adapter)
      throw new Error("FeatureLayer requires either a url or adapter option.");
    this.url = e.url, this.collectionId = e.collectionId, this.adapter = e.adapter ?? null, this.adapterFactory = e.adapterFactory, this.enableCache = e.enableCache ?? !1;
  }
  async onLoad() {
    if (!this.adapter)
      if (this.adapterFactory && this.url)
        this.adapter = this.adapterFactory(this.url);
      else
        throw new Error(
          "FeatureLayer: no adapter provided. Supply an adapter instance or an adapterFactory + url."
        );
    this.collections = await this.adapter.getCollections(), !this.collectionId && this.collections.length > 0 && (this.collectionId = this.collections[0].id);
    const e = this.collections.find((t) => t.id === this.collectionId);
    e?.extent && (this._fullExtent = {
      minX: e.extent[0],
      minY: e.extent[1],
      maxX: e.extent[2],
      maxY: e.extent[3]
    });
  }
  // ─── IQueryableLayer ───
  async queryFeatures(e) {
    if (!this.adapter || !this.collectionId)
      throw new Error("FeatureLayer must be loaded before querying.");
    if (this.enableCache && this.cachedFeatures.length > 0)
      return this.filterLocally(this.cachedFeatures, e);
    const t = {};
    e.geometry && (t.bbox = [
      e.geometry.minX,
      e.geometry.minY,
      e.geometry.maxX,
      e.geometry.maxY
    ]), e.maxResults !== void 0 && (t.limit = e.maxResults), e.where && (t.filter = e.where), e.outFields && (t.properties = e.outFields);
    const i = [], r = this.adapter.getFeatures(
      this.collectionId,
      t
    );
    for await (const a of r) {
      for (const l of a)
        i.push(this.toFeature(l));
      if (e.maxResults !== void 0 && i.length >= e.maxResults)
        break;
    }
    const n = e.maxResults !== void 0 ? i.slice(0, e.maxResults) : i;
    return this.enableCache && (this.cachedFeatures = n), n;
  }
  async queryExtent(e) {
    if (this._fullExtent && !e)
      return this._fullExtent;
    const t = e ? await this.queryFeatures(e) : this.cachedFeatures;
    let i = 1 / 0, r = 1 / 0, n = -1 / 0, a = -1 / 0;
    for (const l of t)
      this.expandExtent(l.geometry.coordinates, (o, h) => {
        i = Math.min(i, o), r = Math.min(r, h), n = Math.max(n, o), a = Math.max(a, h);
      });
    return { minX: i, minY: r, maxX: n, maxY: a };
  }
  // ─── IFeatureLayer ───
  /**
   * Get cached features (synchronous, for render-frame consumption).
   * Returns empty array if cache is disabled or no data has been fetched yet.
   */
  getFeatures() {
    return this.cachedFeatures;
  }
  /**
   * Get the available collections (after load).
   */
  getCollections() {
    return this.collections;
  }
  /**
   * Get the active collection id.
   */
  getCollectionId() {
    return this.collectionId;
  }
  refresh() {
    this.cachedFeatures = [], super.refresh();
  }
  destroy() {
    this.cachedFeatures = [], this.collections = [], super.destroy();
  }
  // ─── Private helpers ───
  toFeature(e) {
    return {
      id: e.id ?? 0,
      geometry: {
        type: e.geometry.type,
        coordinates: e.geometry.coordinates
      },
      attributes: e.properties ?? {}
    };
  }
  filterLocally(e, t) {
    let i = e;
    if (t.geometry) {
      const r = t.geometry;
      i = i.filter((n) => {
        let a = !1;
        return this.expandExtent(n.geometry.coordinates, (l, o) => {
          l >= r.minX && l <= r.maxX && o >= r.minY && o <= r.maxY && (a = !0);
        }), a;
      });
    }
    return t.maxResults !== void 0 && (i = i.slice(0, t.maxResults)), i;
  }
  expandExtent(e, t) {
    if (!(!Array.isArray(e) || e.length === 0)) {
      if (typeof e[0] == "number") {
        t(e[0], e[1] ?? 0);
        return;
      }
      for (const i of e)
        this.expandExtent(i, t);
    }
  }
}
const ne = [
  { offset: 0, color: [0, 0, 255, 0] },
  { offset: 0.25, color: [0, 255, 255, 128] },
  { offset: 0.5, color: [0, 255, 0, 178] },
  { offset: 0.75, color: [255, 255, 0, 220] },
  { offset: 1, color: [255, 0, 0, 255] }
];
class it extends y {
  type = "heatmap";
  _source;
  _radius;
  _intensity;
  _gradient;
  _weightField;
  constructor(e) {
    super(e), this._source = e.source, this._radius = e.radius ?? 25, this._intensity = e.intensity ?? 1, this._gradient = e.gradient ?? [...ne], this._weightField = e.weightField;
  }
  // ─── Properties ───
  get radius() {
    return this._radius;
  }
  get intensity() {
    return this._intensity;
  }
  get gradient() {
    return this._gradient;
  }
  get weightField() {
    return this._weightField;
  }
  get source() {
    return this._source;
  }
  // ─── Mutators ───
  setSource(e) {
    this._source = e, this.updateExtent();
  }
  setRadius(e) {
    if (e <= 0)
      throw new Error("Radius must be positive.");
    this._radius = e;
  }
  setIntensity(e) {
    if (e < 0)
      throw new Error("Intensity must be non-negative.");
    this._intensity = e;
  }
  setGradient(e) {
    if (e.length < 2)
      throw new Error("Gradient must have at least 2 stops.");
    this._gradient = [...e];
  }
  // ─── Lifecycle ───
  async onLoad() {
    this.updateExtent();
  }
  refresh() {
    this.setLoaded(!1), super.refresh();
  }
  // ─── Grid Computation ───
  /**
   * Compute heatmap grid data using Gaussian kernel density estimation.
   *
   * The grid dimensions are derived from the source extent with 1-unit cells.
   * Returns a Float32Array of density values (row-major) with metadata encoded
   * in the first 2 elements: [width, height, ...values].
   *
   * Returns null if not loaded or no features.
   */
  getGridData() {
    if (!this.loaded || this._source.length === 0) return null;
    const e = this._fullExtent;
    if (!e) return null;
    const t = Math.min(Math.ceil(e.maxX - e.minX) + 1, 256), i = Math.min(Math.ceil(e.maxY - e.minY) + 1, 256);
    if (t <= 0 || i <= 0) return null;
    const r = new Float32Array(t * i), n = this._radius / 3, a = 2 * n * n;
    for (const l of this._source) {
      const o = this.getPointCoords(l);
      if (!o) continue;
      const h = this.getWeight(l), [u, c] = o, m = u - e.minX, d = c - e.minY, f = Math.ceil(this._radius), _ = Math.max(0, Math.floor(d - f)), p = Math.min(i - 1, Math.ceil(d + f)), x = Math.max(0, Math.floor(m - f)), g = Math.min(t - 1, Math.ceil(m + f));
      for (let w = _; w <= p; w++)
        for (let E = x; E <= g; E++) {
          const B = E - m, D = w - d, A = B * B + D * D;
          if (A <= this._radius * this._radius) {
            const Q = Math.exp(-A / a), X = w * t + E;
            r[X] = (r[X] ?? 0) + Q * h * this._intensity;
          }
        }
    }
    return { width: t, height: i, data: r };
  }
  // ─── Private helpers ───
  getPointCoords(e) {
    if (e.geometry.type !== "Point") return null;
    const t = e.geometry.coordinates;
    return t.length < 2 ? null : [t[0], t[1]];
  }
  getWeight(e) {
    if (!this._weightField) return 1;
    const t = e.attributes[this._weightField];
    return typeof t == "number" && isFinite(t) ? t : 1;
  }
  updateExtent() {
    if (this._source.length === 0) {
      this._fullExtent = void 0;
      return;
    }
    let e = 1 / 0, t = 1 / 0, i = -1 / 0, r = -1 / 0;
    for (const n of this._source) {
      const a = this.getPointCoords(n);
      if (!a) continue;
      const [l, o] = a;
      e = Math.min(e, l), t = Math.min(t, o), i = Math.max(i, l), r = Math.max(r, o);
    }
    isFinite(e) ? this._fullExtent = { minX: e, minY: t, maxX: i, maxY: r } : this._fullExtent = void 0;
  }
}
class rt extends y {
  type = "cluster";
  _source;
  _clusterRadius;
  _clusterMinPoints;
  _fields;
  constructor(e) {
    super(e), this._source = e.source, this._clusterRadius = e.clusterRadius ?? 50, this._clusterMinPoints = e.clusterMinPoints ?? 2, this._fields = e.fields ?? {};
  }
  // ─── Properties ───
  get clusterRadius() {
    return this._clusterRadius;
  }
  set clusterRadius(e) {
    if (e <= 0)
      throw new Error("Cluster radius must be positive.");
    this._clusterRadius = e;
  }
  get clusterMinPoints() {
    return this._clusterMinPoints;
  }
  get source() {
    return this._source;
  }
  get fields() {
    return { ...this._fields };
  }
  // ─── Lifecycle ───
  async onLoad() {
    this.updateExtent();
  }
  refresh() {
    this.setLoaded(!1), super.refresh();
  }
  // ─── Source management ───
  setSource(e) {
    this._source = e, this.updateExtent();
  }
  // ─── Clustering ───
  /**
   * Get clusters and unclustered points for a given extent and zoom level.
   *
   * Uses a simple grid-based clustering approach:
   * 1. Divide space into cells of size = clusterRadius
   * 2. Group points by cell
   * 3. Cells with >= clusterMinPoints become clusters
   * 4. Remaining points returned as singles
   */
  getClusters(e, t) {
    if (!this.loaded) return [];
    const i = this._source.filter((o) => {
      const h = this.getPointCoords(o);
      return h ? h[0] >= e.minX && h[0] <= e.maxX && h[1] >= e.minY && h[1] <= e.maxY : !1;
    }), r = this._clusterRadius, n = /* @__PURE__ */ new Map();
    for (const o of i) {
      const h = this.getPointCoords(o);
      if (!h) continue;
      const u = Math.floor(h[0] / r), c = Math.floor(h[1] / r), m = `${u}:${c}`, d = n.get(m);
      d ? d.push(o) : n.set(m, [o]);
    }
    const a = [];
    let l = -1;
    for (const o of n.values())
      if (o.length >= this._clusterMinPoints) {
        const h = this.computeCentroid(o), u = this.aggregateFields(o);
        u.cluster_count = o.length, a.push({
          id: l--,
          isCluster: !0,
          pointCount: o.length,
          coordinates: h,
          properties: u
        });
      } else
        for (const h of o) {
          const u = this.getPointCoords(h);
          u && a.push({
            id: h.id,
            isCluster: !1,
            pointCount: 1,
            coordinates: u,
            properties: { ...h.attributes }
          });
        }
    return a;
  }
  // ─── IQueryableLayer ───
  async queryFeatures(e) {
    if (!this.loaded) return [];
    const t = e.geometry ?? this._fullExtent;
    if (!t) return [];
    let r = this.getClusters(t, 0).map((n) => ({
      id: n.id,
      geometry: {
        type: "Point",
        coordinates: n.coordinates
      },
      attributes: {
        ...n.properties,
        isCluster: n.isCluster,
        pointCount: n.pointCount
      }
    }));
    if (e.where && (r = this.applyWhereFilter(r, e.where)), e.outFields && e.outFields.length > 0) {
      const n = new Set(e.outFields);
      r = r.map((a) => ({
        ...a,
        attributes: Object.fromEntries(
          Object.entries(a.attributes).filter(([l]) => n.has(l))
        )
      }));
    }
    return e.maxResults !== void 0 && (r = r.slice(0, e.maxResults)), r;
  }
  async queryExtent(e) {
    const t = e ? await this.queryFeatures(e) : this._source.map((l) => l);
    let i = 1 / 0, r = 1 / 0, n = -1 / 0, a = -1 / 0;
    for (const l of t)
      this.expandExtent(l.geometry.coordinates, (o, h) => {
        i = Math.min(i, o), r = Math.min(r, h), n = Math.max(n, o), a = Math.max(a, h);
      });
    return { minX: i, minY: r, maxX: n, maxY: a };
  }
  // ─── Private helpers ───
  getPointCoords(e) {
    if (e.geometry.type !== "Point") return null;
    const t = e.geometry.coordinates;
    return t.length < 2 ? null : [t[0], t[1]];
  }
  computeCentroid(e) {
    let t = 0, i = 0, r = 0;
    for (const n of e) {
      const a = this.getPointCoords(n);
      a && (t += a[0], i += a[1], r++);
    }
    return r === 0 ? [0, 0] : [t / r, i / r];
  }
  aggregateFields(e) {
    const t = {};
    for (const [i, r] of Object.entries(this._fields)) {
      if (!r) continue;
      const n = [];
      for (const a of e) {
        const l = a.attributes[r];
        typeof l == "number" && isFinite(l) && n.push(l);
      }
      if (n.length === 0) {
        t[`${i}_${r}`] = null;
        continue;
      }
      switch (i) {
        case "sum":
          t[`sum_${r}`] = n.reduce((a, l) => a + l, 0);
          break;
        case "avg":
          t[`avg_${r}`] = n.reduce((a, l) => a + l, 0) / n.length;
          break;
        case "min":
          t[`min_${r}`] = Math.min(...n);
          break;
        case "max":
          t[`max_${r}`] = Math.max(...n);
          break;
        case "count":
          t[`count_${r}`] = n.length;
          break;
      }
    }
    return t;
  }
  updateExtent() {
    if (this._source.length === 0) {
      this._fullExtent = void 0;
      return;
    }
    let e = 1 / 0, t = 1 / 0, i = -1 / 0, r = -1 / 0;
    for (const n of this._source) {
      const a = this.getPointCoords(n);
      if (!a) continue;
      const [l, o] = a;
      e = Math.min(e, l), t = Math.min(t, o), i = Math.max(i, l), r = Math.max(r, o);
    }
    isFinite(e) ? this._fullExtent = { minX: e, minY: t, maxX: i, maxY: r } : this._fullExtent = void 0;
  }
  expandExtent(e, t) {
    if (!(!Array.isArray(e) || e.length === 0)) {
      if (typeof e[0] == "number") {
        t(e[0], e[1] ?? 0);
        return;
      }
      for (const i of e)
        this.expandExtent(i, t);
    }
  }
  applyWhereFilter(e, t) {
    const i = t.match(
      /^\s*(\w+)\s*(=|!=|>|<|>=|<=)\s*(?:'([^']*)'|(\S+))\s*$/
    );
    if (!i) return e;
    const r = i[1], n = i[2], a = i[3], l = i[4], o = a !== void 0 ? a : Number(l);
    return e.filter((h) => {
      const u = h.attributes[r];
      if (u === void 0) return !1;
      switch (n) {
        case "=":
          return u === o || typeof u == "number" && u === Number(o);
        case "!=":
          return u !== o;
        case ">":
          return typeof u == "number" && u > Number(o);
        case "<":
          return typeof u == "number" && u < Number(o);
        case ">=":
          return typeof u == "number" && u >= Number(o);
        case "<=":
          return typeof u == "number" && u <= Number(o);
        default:
          return !0;
      }
    });
  }
}
const R = 65536 * 65536, N = 1 / R, ae = 12, q = typeof TextDecoder > "u" ? null : new TextDecoder("utf-8"), L = 0, v = 1, b = 2, P = 5;
class oe {
  /**
   * @param {Uint8Array | ArrayBuffer} [buf]
   */
  constructor(e = new Uint8Array(16)) {
    this.buf = ArrayBuffer.isView(e) ? e : new Uint8Array(e), this.dataView = new DataView(this.buf.buffer), this.pos = 0, this.type = 0, this.length = this.buf.length;
  }
  // === READING =================================================================
  /**
   * @template T
   * @param {(tag: number, result: T, pbf: Pbf) => void} readField
   * @param {T} result
   * @param {number} [end]
   */
  readFields(e, t, i = this.length) {
    for (; this.pos < i; ) {
      const r = this.readVarint(), n = r >> 3, a = this.pos;
      this.type = r & 7, e(n, t, this), this.pos === a && this.skip(r);
    }
    return t;
  }
  /**
   * @template T
   * @param {(tag: number, result: T, pbf: Pbf) => void} readField
   * @param {T} result
   */
  readMessage(e, t) {
    return this.readFields(e, t, this.readVarint() + this.pos);
  }
  readFixed32() {
    const e = this.dataView.getUint32(this.pos, !0);
    return this.pos += 4, e;
  }
  readSFixed32() {
    const e = this.dataView.getInt32(this.pos, !0);
    return this.pos += 4, e;
  }
  // 64-bit int handling is based on github.com/dpw/node-buffer-more-ints (MIT-licensed)
  readFixed64() {
    const e = this.dataView.getUint32(this.pos, !0) + this.dataView.getUint32(this.pos + 4, !0) * R;
    return this.pos += 8, e;
  }
  readSFixed64() {
    const e = this.dataView.getUint32(this.pos, !0) + this.dataView.getInt32(this.pos + 4, !0) * R;
    return this.pos += 8, e;
  }
  readFloat() {
    const e = this.dataView.getFloat32(this.pos, !0);
    return this.pos += 4, e;
  }
  readDouble() {
    const e = this.dataView.getFloat64(this.pos, !0);
    return this.pos += 8, e;
  }
  /**
   * @param {boolean} [isSigned]
   */
  readVarint(e) {
    const t = this.buf;
    let i, r;
    return r = t[this.pos++], i = r & 127, r < 128 || (r = t[this.pos++], i |= (r & 127) << 7, r < 128) || (r = t[this.pos++], i |= (r & 127) << 14, r < 128) || (r = t[this.pos++], i |= (r & 127) << 21, r < 128) ? i : (r = t[this.pos], i |= (r & 15) << 28, le(i, e, this));
  }
  readVarint64() {
    return this.readVarint(!0);
  }
  readSVarint() {
    const e = this.readVarint();
    return e % 2 === 1 ? (e + 1) / -2 : e / 2;
  }
  readBoolean() {
    return !!this.readVarint();
  }
  readString() {
    const e = this.readVarint() + this.pos, t = this.pos;
    return this.pos = e, e - t >= ae && q ? q.decode(this.buf.subarray(t, e)) : Fe(this.buf, t, e);
  }
  readBytes() {
    const e = this.readVarint() + this.pos, t = this.buf.subarray(this.pos, e);
    return this.pos = e, t;
  }
  // verbose for performance reasons; doesn't affect gzipped size
  /**
   * @param {number[]} [arr]
   * @param {boolean} [isSigned]
   */
  readPackedVarint(e = [], t) {
    const i = this.readPackedEnd();
    for (; this.pos < i; ) e.push(this.readVarint(t));
    return e;
  }
  /** @param {number[]} [arr] */
  readPackedSVarint(e = []) {
    const t = this.readPackedEnd();
    for (; this.pos < t; ) e.push(this.readSVarint());
    return e;
  }
  /** @param {boolean[]} [arr] */
  readPackedBoolean(e = []) {
    const t = this.readPackedEnd();
    for (; this.pos < t; ) e.push(this.readBoolean());
    return e;
  }
  /** @param {number[]} [arr] */
  readPackedFloat(e = []) {
    const t = this.readPackedEnd();
    for (; this.pos < t; ) e.push(this.readFloat());
    return e;
  }
  /** @param {number[]} [arr] */
  readPackedDouble(e = []) {
    const t = this.readPackedEnd();
    for (; this.pos < t; ) e.push(this.readDouble());
    return e;
  }
  /** @param {number[]} [arr] */
  readPackedFixed32(e = []) {
    const t = this.readPackedEnd();
    for (; this.pos < t; ) e.push(this.readFixed32());
    return e;
  }
  /** @param {number[]} [arr] */
  readPackedSFixed32(e = []) {
    const t = this.readPackedEnd();
    for (; this.pos < t; ) e.push(this.readSFixed32());
    return e;
  }
  /** @param {number[]} [arr] */
  readPackedFixed64(e = []) {
    const t = this.readPackedEnd();
    for (; this.pos < t; ) e.push(this.readFixed64());
    return e;
  }
  /** @param {number[]} [arr] */
  readPackedSFixed64(e = []) {
    const t = this.readPackedEnd();
    for (; this.pos < t; ) e.push(this.readSFixed64());
    return e;
  }
  readPackedEnd() {
    return this.type === b ? this.readVarint() + this.pos : this.pos + 1;
  }
  /** @param {number} val */
  skip(e) {
    const t = e & 7;
    if (t === L) for (; this.buf[this.pos++] > 127; )
      ;
    else if (t === b) this.pos = this.readVarint() + this.pos;
    else if (t === P) this.pos += 4;
    else if (t === v) this.pos += 8;
    else throw new Error(`Unimplemented type: ${t}`);
  }
  // === WRITING =================================================================
  /**
   * @param {number} tag
   * @param {number} type
   */
  writeTag(e, t) {
    this.writeVarint(e << 3 | t);
  }
  /** @param {number} min */
  realloc(e) {
    let t = this.length || 16;
    for (; t < this.pos + e; ) t *= 2;
    if (t !== this.length) {
      const i = new Uint8Array(t);
      i.set(this.buf), this.buf = i, this.dataView = new DataView(i.buffer), this.length = t;
    }
  }
  finish() {
    return this.length = this.pos, this.pos = 0, this.buf.subarray(0, this.length);
  }
  /** @param {number} val */
  writeFixed32(e) {
    this.realloc(4), this.dataView.setInt32(this.pos, e, !0), this.pos += 4;
  }
  /** @param {number} val */
  writeSFixed32(e) {
    this.realloc(4), this.dataView.setInt32(this.pos, e, !0), this.pos += 4;
  }
  /** @param {number} val */
  writeFixed64(e) {
    this.realloc(8), this.dataView.setInt32(this.pos, e & -1, !0), this.dataView.setInt32(this.pos + 4, Math.floor(e * N), !0), this.pos += 8;
  }
  /** @param {number} val */
  writeSFixed64(e) {
    this.realloc(8), this.dataView.setInt32(this.pos, e & -1, !0), this.dataView.setInt32(this.pos + 4, Math.floor(e * N), !0), this.pos += 8;
  }
  /** @param {number} val */
  writeVarint(e) {
    if (e = +e || 0, e > 268435455 || e < 0) {
      ue(e, this);
      return;
    }
    this.realloc(4), this.buf[this.pos++] = e & 127 | (e > 127 ? 128 : 0), !(e <= 127) && (this.buf[this.pos++] = (e >>>= 7) & 127 | (e > 127 ? 128 : 0), !(e <= 127) && (this.buf[this.pos++] = (e >>>= 7) & 127 | (e > 127 ? 128 : 0), !(e <= 127) && (this.buf[this.pos++] = e >>> 7 & 127)));
  }
  /** @param {number} val */
  writeSVarint(e) {
    this.writeVarint(e < 0 ? -e * 2 - 1 : e * 2);
  }
  /** @param {boolean} val */
  writeBoolean(e) {
    this.writeVarint(+e);
  }
  /** @param {string} str */
  writeString(e) {
    e = String(e), this.realloc(e.length * 4), this.pos++;
    const t = this.pos;
    this.pos = be(this.buf, e, this.pos);
    const i = this.pos - t;
    i >= 128 && W(t, i, this), this.pos = t - 1, this.writeVarint(i), this.pos += i;
  }
  /** @param {number} val */
  writeFloat(e) {
    this.realloc(4), this.dataView.setFloat32(this.pos, e, !0), this.pos += 4;
  }
  /** @param {number} val */
  writeDouble(e) {
    this.realloc(8), this.dataView.setFloat64(this.pos, e, !0), this.pos += 8;
  }
  /** @param {Uint8Array} buffer */
  writeBytes(e) {
    const t = e.length;
    this.writeVarint(t), this.realloc(t);
    for (let i = 0; i < t; i++) this.buf[this.pos++] = e[i];
  }
  /**
   * @template T
   * @param {(obj: T, pbf: Pbf) => void} fn
   * @param {T} obj
   */
  writeRawMessage(e, t) {
    this.pos++;
    const i = this.pos;
    e(t, this);
    const r = this.pos - i;
    r >= 128 && W(i, r, this), this.pos = i - 1, this.writeVarint(r), this.pos += r;
  }
  /**
   * @template T
   * @param {number} tag
   * @param {(obj: T, pbf: Pbf) => void} fn
   * @param {T} obj
   */
  writeMessage(e, t, i) {
    this.writeTag(e, b), this.writeRawMessage(t, i);
  }
  /**
   * @param {number} tag
   * @param {number[]} arr
   */
  writePackedVarint(e, t) {
    t.length && this.writeMessage(e, de, t);
  }
  /**
   * @param {number} tag
   * @param {number[]} arr
   */
  writePackedSVarint(e, t) {
    t.length && this.writeMessage(e, fe, t);
  }
  /**
   * @param {number} tag
   * @param {boolean[]} arr
   */
  writePackedBoolean(e, t) {
    t.length && this.writeMessage(e, ye, t);
  }
  /**
   * @param {number} tag
   * @param {number[]} arr
   */
  writePackedFloat(e, t) {
    t.length && this.writeMessage(e, me, t);
  }
  /**
   * @param {number} tag
   * @param {number[]} arr
   */
  writePackedDouble(e, t) {
    t.length && this.writeMessage(e, _e, t);
  }
  /**
   * @param {number} tag
   * @param {number[]} arr
   */
  writePackedFixed32(e, t) {
    t.length && this.writeMessage(e, xe, t);
  }
  /**
   * @param {number} tag
   * @param {number[]} arr
   */
  writePackedSFixed32(e, t) {
    t.length && this.writeMessage(e, pe, t);
  }
  /**
   * @param {number} tag
   * @param {number[]} arr
   */
  writePackedFixed64(e, t) {
    t.length && this.writeMessage(e, ge, t);
  }
  /**
   * @param {number} tag
   * @param {number[]} arr
   */
  writePackedSFixed64(e, t) {
    t.length && this.writeMessage(e, we, t);
  }
  /**
   * @param {number} tag
   * @param {Uint8Array} buffer
   */
  writeBytesField(e, t) {
    this.writeTag(e, b), this.writeBytes(t);
  }
  /**
   * @param {number} tag
   * @param {number} val
   */
  writeFixed32Field(e, t) {
    this.writeTag(e, P), this.writeFixed32(t);
  }
  /**
   * @param {number} tag
   * @param {number} val
   */
  writeSFixed32Field(e, t) {
    this.writeTag(e, P), this.writeSFixed32(t);
  }
  /**
   * @param {number} tag
   * @param {number} val
   */
  writeFixed64Field(e, t) {
    this.writeTag(e, v), this.writeFixed64(t);
  }
  /**
   * @param {number} tag
   * @param {number} val
   */
  writeSFixed64Field(e, t) {
    this.writeTag(e, v), this.writeSFixed64(t);
  }
  /**
   * @param {number} tag
   * @param {number} val
   */
  writeVarintField(e, t) {
    this.writeTag(e, L), this.writeVarint(t);
  }
  /**
   * @param {number} tag
   * @param {number} val
   */
  writeSVarintField(e, t) {
    this.writeTag(e, L), this.writeSVarint(t);
  }
  /**
   * @param {number} tag
   * @param {string} str
   */
  writeStringField(e, t) {
    this.writeTag(e, b), this.writeString(t);
  }
  /**
   * @param {number} tag
   * @param {number} val
   */
  writeFloatField(e, t) {
    this.writeTag(e, P), this.writeFloat(t);
  }
  /**
   * @param {number} tag
   * @param {number} val
   */
  writeDoubleField(e, t) {
    this.writeTag(e, v), this.writeDouble(t);
  }
  /**
   * @param {number} tag
   * @param {boolean} val
   */
  writeBooleanField(e, t) {
    this.writeVarintField(e, +t);
  }
}
function le(s, e, t) {
  const i = t.buf;
  let r, n;
  if (n = i[t.pos++], r = (n & 112) >> 4, n < 128 || (n = i[t.pos++], r |= (n & 127) << 3, n < 128) || (n = i[t.pos++], r |= (n & 127) << 10, n < 128) || (n = i[t.pos++], r |= (n & 127) << 17, n < 128) || (n = i[t.pos++], r |= (n & 127) << 24, n < 128) || (n = i[t.pos++], r |= (n & 1) << 31, n < 128)) return F(s, r, e);
  throw new Error("Expected varint not more than 10 bytes");
}
function F(s, e, t) {
  return t ? e * 4294967296 + (s >>> 0) : (e >>> 0) * 4294967296 + (s >>> 0);
}
function ue(s, e) {
  let t, i;
  if (s >= 0 ? (t = s % 4294967296 | 0, i = s / 4294967296 | 0) : (t = ~(-s % 4294967296), i = ~(-s / 4294967296), t ^ 4294967295 ? t = t + 1 | 0 : (t = 0, i = i + 1 | 0)), s >= 18446744073709552e3 || s < -18446744073709552e3)
    throw new Error("Given varint doesn't fit into 10 bytes");
  e.realloc(10), he(t, i, e), ce(i, e);
}
function he(s, e, t) {
  t.buf[t.pos++] = s & 127 | 128, s >>>= 7, t.buf[t.pos++] = s & 127 | 128, s >>>= 7, t.buf[t.pos++] = s & 127 | 128, s >>>= 7, t.buf[t.pos++] = s & 127 | 128, s >>>= 7, t.buf[t.pos] = s & 127;
}
function ce(s, e) {
  const t = (s & 7) << 4;
  e.buf[e.pos++] |= t | ((s >>>= 3) ? 128 : 0), s && (e.buf[e.pos++] = s & 127 | ((s >>>= 7) ? 128 : 0), s && (e.buf[e.pos++] = s & 127 | ((s >>>= 7) ? 128 : 0), s && (e.buf[e.pos++] = s & 127 | ((s >>>= 7) ? 128 : 0), s && (e.buf[e.pos++] = s & 127 | ((s >>>= 7) ? 128 : 0), s && (e.buf[e.pos++] = s & 127)))));
}
function W(s, e, t) {
  const i = e <= 16383 ? 1 : e <= 2097151 ? 2 : e <= 268435455 ? 3 : Math.floor(Math.log(e) / (Math.LN2 * 7));
  t.realloc(i);
  for (let r = t.pos - 1; r >= s; r--) t.buf[r + i] = t.buf[r];
}
function de(s, e) {
  for (let t = 0; t < s.length; t++) e.writeVarint(s[t]);
}
function fe(s, e) {
  for (let t = 0; t < s.length; t++) e.writeSVarint(s[t]);
}
function me(s, e) {
  for (let t = 0; t < s.length; t++) e.writeFloat(s[t]);
}
function _e(s, e) {
  for (let t = 0; t < s.length; t++) e.writeDouble(s[t]);
}
function ye(s, e) {
  for (let t = 0; t < s.length; t++) e.writeBoolean(s[t]);
}
function xe(s, e) {
  for (let t = 0; t < s.length; t++) e.writeFixed32(s[t]);
}
function pe(s, e) {
  for (let t = 0; t < s.length; t++) e.writeSFixed32(s[t]);
}
function ge(s, e) {
  for (let t = 0; t < s.length; t++) e.writeFixed64(s[t]);
}
function we(s, e) {
  for (let t = 0; t < s.length; t++) e.writeSFixed64(s[t]);
}
function Fe(s, e, t) {
  let i = "", r = e;
  for (; r < t; ) {
    const n = s[r];
    let a = null, l = n > 239 ? 4 : n > 223 ? 3 : n > 191 ? 2 : 1;
    if (r + l > t) break;
    let o, h, u;
    l === 1 ? n < 128 && (a = n) : l === 2 ? (o = s[r + 1], (o & 192) === 128 && (a = (n & 31) << 6 | o & 63, a <= 127 && (a = null))) : l === 3 ? (o = s[r + 1], h = s[r + 2], (o & 192) === 128 && (h & 192) === 128 && (a = (n & 15) << 12 | (o & 63) << 6 | h & 63, (a <= 2047 || a >= 55296 && a <= 57343) && (a = null))) : l === 4 && (o = s[r + 1], h = s[r + 2], u = s[r + 3], (o & 192) === 128 && (h & 192) === 128 && (u & 192) === 128 && (a = (n & 15) << 18 | (o & 63) << 12 | (h & 63) << 6 | u & 63, (a <= 65535 || a >= 1114112) && (a = null))), a === null ? (a = 65533, l = 1) : a > 65535 && (a -= 65536, i += String.fromCharCode(a >>> 10 & 1023 | 55296), a = 56320 | a & 1023), i += String.fromCharCode(a), r += l;
  }
  return i;
}
function be(s, e, t) {
  for (let i = 0, r, n; i < e.length; i++) {
    if (r = e.charCodeAt(i), r > 55295 && r < 57344)
      if (n)
        if (r < 56320) {
          s[t++] = 239, s[t++] = 191, s[t++] = 189, n = r;
          continue;
        } else
          r = n - 55296 << 10 | r - 56320 | 65536, n = null;
      else {
        r > 56319 || i + 1 === e.length ? (s[t++] = 239, s[t++] = 191, s[t++] = 189) : n = r;
        continue;
      }
    else n && (s[t++] = 239, s[t++] = 191, s[t++] = 189, n = null);
    r < 128 ? s[t++] = r : (r < 2048 ? s[t++] = r >> 6 | 192 : (r < 65536 ? s[t++] = r >> 12 | 224 : (s[t++] = r >> 18 | 240, s[t++] = r >> 12 & 63 | 128), s[t++] = r >> 6 & 63 | 128), s[t++] = r & 63 | 128);
  }
  return t;
}
const Me = 1, Se = 2, Ee = 3;
let ve = 0;
function Pe(s) {
  const e = [];
  return s.readFields((t, i, r) => {
    t === 3 && e.push(ke(r, r.readVarint() + r.pos));
  }, void 0), e;
}
function ke(s, e) {
  const t = { name: "", extent: 4096, keys: [], values: [], features: [] };
  for (; s.pos < e; ) {
    const i = s.readVarint(), r = i >> 3, n = i & 7;
    switch (r) {
      case 1:
        t.name = s.readString();
        break;
      case 2:
        t.features.push(Te(s, s.readVarint() + s.pos));
        break;
      case 3:
        t.keys.push(s.readString());
        break;
      case 4:
        t.values.push(Ie(s, s.readVarint() + s.pos));
        break;
      case 5:
        t.extent = s.readVarint();
        break;
      case 15:
        s.readVarint();
        break;
      default:
        s.skip(n);
        break;
    }
  }
  return t;
}
function Te(s, e) {
  const t = { id: void 0, tags: [], type: 0, geometry: [] };
  for (; s.pos < e; ) {
    const i = s.readVarint(), r = i >> 3, n = i & 7;
    switch (r) {
      case 1:
        t.id = s.readVarint();
        break;
      case 2:
        if (n === 2) {
          const a = s.readVarint() + s.pos;
          for (; s.pos < a; ) t.tags.push(s.readVarint());
        } else
          t.tags.push(s.readVarint());
        break;
      case 3:
        t.type = s.readVarint();
        break;
      case 4:
        if (n === 2) {
          const a = s.readVarint() + s.pos;
          for (; s.pos < a; ) t.geometry.push(s.readVarint());
        } else
          t.geometry.push(s.readVarint());
        break;
      default:
        s.skip(n);
        break;
    }
  }
  return t;
}
function Ie(s, e) {
  let t = null;
  for (; s.pos < e; ) {
    const i = s.readVarint(), r = i >> 3, n = i & 7;
    switch (r) {
      case 1:
        t = s.readString();
        break;
      case 2:
        t = s.readFloat();
        break;
      case 3:
        t = s.readDouble();
        break;
      case 4:
        t = s.readVarint();
        break;
      // int64
      case 5:
        t = s.readVarint();
        break;
      // uint64
      case 6:
        t = s.readSVarint();
        break;
      // sint64
      case 7:
        t = s.readBoolean();
        break;
      default:
        s.skip(n);
        break;
    }
  }
  return t;
}
function Le(s) {
  const e = [];
  let t = [], i = 0, r = 0, n = 0;
  for (; n < s.length; ) {
    const a = s[n], l = a & 7, o = a >> 3;
    if (n++, l === 1)
      for (let h = 0; h < o; h++) {
        t.length > 0 && e.push(t), t = [];
        const u = k(s[n]), c = k(s[n + 1]);
        i += u, r += c, t.push([i, r]), n += 2;
      }
    else if (l === 2)
      for (let h = 0; h < o; h++) {
        const u = k(s[n]), c = k(s[n + 1]);
        i += u, r += c, t.push([i, r]), n += 2;
      }
    else l === 7 && t.length > 0 && t.push([t[0][0], t[0][1]]);
  }
  return t.length > 0 && e.push(t), e;
}
function k(s) {
  return s >>> 1 ^ -(s & 1);
}
const T = 20037508342789244e-9;
function M(s, e, t, i, r, n) {
  const a = 2 * T / Math.pow(2, t), l = -T + (i + s / n) * a, o = T - (r + e / n) * a;
  return [l, o];
}
function Ce(s, e) {
  const t = s / T * 180, i = Math.atan(Math.exp(e / 6378137)) * 360 / Math.PI - 90;
  return [t, i];
}
function Ve(s, e, t, i, r) {
  const n = {};
  for (let o = 0; o < s.tags.length; o += 2) {
    const h = s.tags[o], u = s.tags[o + 1], c = e.keys[h], m = e.values[u];
    c !== void 0 && (n[c] = m);
  }
  const a = Le(s.geometry);
  if (a.length === 0) return null;
  let l;
  switch (s.type) {
    case Me: {
      if (a.length === 1 && a[0].length === 1) {
        const o = a[0][0], [h, u] = M(o[0], o[1], t, i, r, e.extent);
        l = {
          type: "Point",
          coordinates: [h, u],
          spatialReference: "EPSG:3857"
        };
      } else {
        const o = [];
        for (const h of a)
          for (const u of h) {
            const [c, m] = M(u[0], u[1], t, i, r, e.extent);
            o.push([c, m]);
          }
        l = {
          type: "MultiPoint",
          coordinates: o,
          spatialReference: "EPSG:3857"
        };
      }
      break;
    }
    case Se: {
      a.length === 1 ? l = {
        type: "LineString",
        coordinates: a[0].map((h) => {
          const [u, c] = M(h[0], h[1], t, i, r, e.extent);
          return [u, c];
        }),
        spatialReference: "EPSG:3857"
      } : l = {
        type: "MultiLineString",
        coordinates: a.map(
          (h) => h.map((u) => {
            const [c, m] = M(u[0], u[1], t, i, r, e.extent);
            return [c, m];
          })
        ),
        spatialReference: "EPSG:3857"
      };
      break;
    }
    case Ee: {
      const o = [];
      let h = [];
      for (const u of a) {
        const c = u.map((d) => {
          const [f, _] = M(d[0], d[1], t, i, r, e.extent);
          return [f, _];
        });
        Be(u) > 0 ? (h.length > 0 && o.push(h), h = [c]) : h.push(c);
      }
      if (h.length > 0 && o.push(h), o.length === 0) return null;
      o.length === 1 ? l = {
        type: "Polygon",
        coordinates: o[0],
        spatialReference: "EPSG:3857"
      } : l = {
        type: "MultiPolygon",
        coordinates: o,
        spatialReference: "EPSG:3857"
      };
      break;
    }
    default:
      return null;
  }
  return {
    id: s.id !== void 0 ? s.id : 0,
    geometry: l,
    attributes: n
  };
}
function O(s) {
  return {
    id: s.id,
    attributes: s.attributes,
    geometry: Re(s.geometry)
  };
}
function Re(s) {
  const e = (t) => {
    const [i, r] = Ce(t[0], t[1]);
    return t[2] !== void 0 ? [i, r, t[2]] : [i, r];
  };
  switch (s.type) {
    case "Point": {
      const t = s.coordinates;
      return { type: s.type, coordinates: e(t) };
    }
    case "MultiPoint": {
      const t = s.coordinates.map(e);
      return { type: s.type, coordinates: t };
    }
    case "LineString": {
      const t = s.coordinates.map(e);
      return { type: s.type, coordinates: t };
    }
    case "MultiLineString": {
      const t = s.coordinates.map(
        (i) => i.map(e)
      );
      return { type: s.type, coordinates: t };
    }
    case "Polygon": {
      const t = s.coordinates.map(
        (i) => i.map(e)
      );
      return { type: s.type, coordinates: t };
    }
    case "MultiPolygon": {
      const t = s.coordinates.map(
        (i) => i.map(
          (r) => r.map(e)
        )
      );
      return { type: s.type, coordinates: t };
    }
  }
}
function Be(s) {
  let e = 0;
  for (let t = 0, i = s.length, r = i - 1; t < i; r = t++)
    e += (s[r][0] - s[t][0]) * (s[r][1] + s[t][1]);
  return e;
}
function j(s, e, t, i, r) {
  const n = new oe(s), a = Pe(n), l = [];
  for (const o of a)
    if (!(r !== void 0 && o.name !== r))
      for (const h of o.features) {
        const u = Ve(h, o, e, t, i);
        u && l.push(u);
      }
  return {
    key: `${e}/${t}/${i}`,
    z: e,
    x: t,
    y: i,
    sourceLayer: r,
    features: l,
    binaryPayload: null,
    version: ++ve
  };
}
function st(s, e, t, i, r) {
  return j(s, e, t, i, r).features.map(O);
}
function S(s) {
  return typeof s == "object" && s !== null && typeof s.type == "string";
}
const De = {
  id: "__snapshot__",
  attributes: {},
  geometry: { type: "Point", coordinates: [0, 0] }
};
function Ae(s) {
  if (!s) return null;
  if (s.type === "simple") {
    const e = s.getSymbol(De);
    return S(e) ? {
      type: "simple",
      symbol: e,
      zoomSensitive: s.zoomSensitive
    } : null;
  }
  if (s.type === "unique-value") {
    const e = s;
    if (typeof e.field != "string" || !S(e.defaultSymbol) || !Array.isArray(e.uniqueValues))
      return null;
    const t = [];
    for (const i of e.uniqueValues) {
      if (typeof i != "object" || i === null || !Object.prototype.hasOwnProperty.call(i, "value") || !S(i.symbol))
        return null;
      const r = i.value;
      if (typeof r != "string" && typeof r != "number")
        return null;
      t.push({
        value: r,
        symbol: i.symbol
      });
    }
    return {
      type: "unique-value",
      field: e.field,
      defaultSymbol: e.defaultSymbol,
      uniqueValues: t,
      zoomSensitive: s.zoomSensitive
    };
  }
  if (s.type === "class-breaks") {
    const e = s;
    if (typeof e.field != "string" || !S(e.defaultSymbol) || !Array.isArray(e.breaks))
      return null;
    const t = [];
    for (const i of e.breaks) {
      if (typeof i != "object" || i === null || typeof i.min != "number" || typeof i.max != "number" || !S(i.symbol))
        return null;
      t.push({
        min: i.min,
        max: i.max,
        symbol: i.symbol
      });
    }
    return {
      type: "class-breaks",
      field: e.field,
      defaultSymbol: e.defaultSymbol,
      breaks: t,
      zoomSensitive: s.zoomSensitive
    };
  }
  return null;
}
const Xe = "vector-tile:parse-build", Ye = 256, K = 8, He = 12;
class ze {
  _cache = /* @__PURE__ */ new Map();
  _maxEntries = Ye;
  _tileVersion = 0;
  _queue = [];
  _queuedKeys = /* @__PURE__ */ new Set();
  _inFlightKeys = /* @__PURE__ */ new Set();
  _activeTasks = 0;
  _effectiveMaxInFlightTiles = K;
  _visibleKeys = /* @__PURE__ */ new Set();
  _performance;
  _workerPool = null;
  _workerDisabled = !1;
  _warnedFallback = !1;
  /** Whether a microtask-coalesced tile load notification is pending. */
  _notifyScheduled = !1;
  /** Callback fired when a background tile fetch completes. Triggers re-render. */
  onTileLoaded = null;
  constructor(e = {}) {
    this._performance = C(e.performance);
  }
  setPerformance(e) {
    const t = this._performance.workerCount;
    this._performance = C(e), this._workerPool && t !== this._performance.workerCount && (this._workerPool.terminate(), this._workerPool = null);
  }
  /**
   * Get ready parsed tiles for the given tile coordinates.
   *
   * Returns immediately available (cached) tiles. Missing tiles are queued
   * for background fetch/parse and become visible after `onTileLoaded`.
   */
  getReadyTiles(e, t, i, r = {}) {
    const n = r.renderMode ?? "2d", a = C(
      r.performance ?? this._performance
    );
    this._performance = a;
    const l = Ae(r.renderer), o = n === "3d" && l !== null, h = this._shouldUseWorkerPath(
      a.mode,
      n,
      l
    );
    this._effectiveMaxInFlightTiles = this._computeEffectiveMaxInFlight(
      a.maxInFlightTiles,
      n,
      e.length
    ), this._visibleKeys = new Set(e.map((d) => `${d.z}/${d.x}/${d.y}`)), this._pruneQueuedInvisible();
    const u = Date.now(), c = [], m = qe(e);
    for (const d of e) {
      const f = `${d.z}/${d.x}/${d.y}`, _ = this._cache.get(f);
      if (_) {
        _.lastUsed = u, c.push(_.tile);
        continue;
      }
      if (this._inFlightKeys.has(f) || this._queuedKeys.has(f))
        continue;
      const p = t.replace("{z}", String(d.z)).replace("{x}", String(d.x)).replace("{y}", String(d.y)), x = We(d, m), g = {
        key: f,
        coord: d,
        url: p,
        sourceLayer: i,
        useWorker: h,
        includeBinaryPayload: o,
        rendererSnapshot: l,
        zoom: r.zoom,
        minScreenAreaPx: a.minScreenAreaPx,
        priority: x
      };
      this._queue.push(g), this._queuedKeys.add(f);
    }
    return this._queue.length > 1 && this._queue.sort((d, f) => d.priority - f.priority), this._drainQueue(), c;
  }
  /** Clear all cached and queued tiles. */
  clear() {
    this._cache.clear(), this._queue = [], this._queuedKeys.clear(), this._inFlightKeys.clear(), this._activeTasks = 0, this._visibleKeys.clear(), this._notifyScheduled = !1;
  }
  /** Release worker resources permanently for this manager instance. */
  destroy() {
    this.clear(), this._workerPool && (this._workerPool.terminate(), this._workerPool = null);
  }
  _drainQueue() {
    for (; this._activeTasks < this._effectiveMaxInFlightTiles && this._queue.length > 0; ) {
      const e = this._queue.shift();
      if (!e) return;
      this._queuedKeys.delete(e.key), this._inFlightKeys.add(e.key), this._activeTasks += 1, this._processTask(e).catch((t) => {
        console.warn(`[VectorTileManager] task failed for ${e.key}`, t);
      }).finally(() => {
        this._inFlightKeys.delete(e.key), this._activeTasks = Math.max(0, this._activeTasks - 1), this._drainQueue();
      });
    }
  }
  async _processTask(e) {
    let t;
    try {
      const r = await fetch(e.url);
      if (!r.ok)
        throw new Error(`HTTP ${r.status}`);
      t = await r.arrayBuffer();
    } catch (r) {
      console.warn(`[VectorTileManager] fetch failed: ${e.url}`, r);
      return;
    }
    if (t.byteLength === 0)
      return;
    let i = null;
    if (e.useWorker)
      try {
        i = await this._parseTileInWorker(e, t);
      } catch (r) {
        this._disableWorkerPath(r);
      }
    i || (i = j(
      t,
      e.coord.z,
      e.coord.x,
      e.coord.y,
      e.sourceLayer
    ), i.binaryPayload = null), this._visibleKeys.has(e.key) && (i.key = e.key, i.z = e.coord.z, i.x = e.coord.x, i.y = e.coord.y, i.version = ++this._tileVersion, this._cache.set(e.key, {
      tile: i,
      lastUsed: Date.now()
    }), this._evict(), this._debouncedNotify(e.key));
  }
  async _parseTileInWorker(e, t) {
    const i = this._ensureWorkerPool();
    if (!i || !e.rendererSnapshot || !e.includeBinaryPayload)
      return null;
    const r = {
      key: e.key,
      z: e.coord.z,
      x: e.coord.x,
      y: e.coord.y,
      data: t,
      sourceLayer: e.sourceLayer,
      rendererSnapshot: e.rendererSnapshot,
      includeBinaryPayload: e.includeBinaryPayload,
      zoom: e.zoom,
      minScreenAreaPx: e.minScreenAreaPx
    }, n = await i.dispatch(
      Xe,
      r
    );
    return {
      key: n.key,
      z: n.z,
      x: n.x,
      y: n.y,
      sourceLayer: n.sourceLayer,
      features: n.features,
      version: 0,
      binaryPayload: n.binaryPayload
    };
  }
  _shouldUseWorkerPath(e, t, i) {
    return !(e === "legacy" || t !== "3d" || !i || this._workerDisabled || !U());
  }
  _ensureWorkerPool() {
    return this._workerDisabled || !U() ? null : (this._workerPool || (this._workerPool = new te({
      maxWorkers: this._performance.workerCount,
      workerFactory: () => new Worker(
        new URL(
          /* @vite-ignore */
          "/assets/vector-tile.worker-BszedaCQ.js",
          import.meta.url
        ),
        { type: "module" }
      )
    }), this._workerPool.init()), this._workerPool);
  }
  _disableWorkerPath(e) {
    this._workerPool && (this._workerPool.terminate(), this._workerPool = null), this._workerDisabled = !0, this._warnedFallback || (this._warnedFallback = !0, console.warn("[VectorTileManager] worker/WASM pipeline disabled, falling back to legacy path.", e));
  }
  _computeEffectiveMaxInFlight(e, t, i) {
    const r = Math.max(1, Math.floor(e));
    return t !== "3d" ? r : i >= 80 ? Math.max(2, Math.floor(r * 0.5)) : i >= 40 ? Math.max(2, Math.floor(r * 0.75)) : r;
  }
  _pruneQueuedInvisible() {
    if (this._queue.length !== 0) {
      this._queue = this._queue.filter((e) => this._visibleKeys.has(e.key)), this._queuedKeys.clear();
      for (const e of this._queue)
        this._queuedKeys.add(e.key);
    }
  }
  _debouncedNotify(e) {
    this._notifyScheduled || (this._notifyScheduled = !0, queueMicrotask(() => {
      this._notifyScheduled = !1, this.onTileLoaded?.(e);
    }));
  }
  /** LRU eviction: remove oldest entries when cache exceeds max size. */
  _evict() {
    if (this._cache.size <= this._maxEntries) return;
    const e = [...this._cache.entries()].sort(
      (i, r) => i[1].lastUsed - r[1].lastUsed
    ), t = this._cache.size - this._maxEntries;
    for (let i = 0; i < t; i++) {
      const r = e[i];
      r && this._cache.delete(r[0]);
    }
  }
}
function C(s) {
  const e = s?.workerCount ?? Ne(), t = s?.maxInFlightTiles ?? K;
  return {
    mode: s?.mode ?? "auto",
    workerCount: Math.max(1, Math.floor(e)),
    maxInFlightTiles: Math.max(1, Math.floor(t)),
    minScreenAreaPx: s?.minScreenAreaPx ?? He
  };
}
function Ne() {
  const s = typeof navigator < "u" && Number.isFinite(navigator.hardwareConcurrency) ? navigator.hardwareConcurrency : 4;
  return Math.max(1, Math.min(Math.floor(s / 2), 4));
}
function U() {
  return typeof Worker < "u" && typeof URL < "u";
}
function qe(s) {
  if (s.length === 0) return { x: 0, y: 0 };
  let e = 0, t = 0;
  for (const i of s)
    e += i.x, t += i.y;
  return {
    x: e / s.length,
    y: t / s.length
  };
}
function We(s, e) {
  return Math.abs(s.x - e.x) + Math.abs(s.y - e.y);
}
const Ue = 8, $e = 12;
class nt extends y {
  type = "vector-tile";
  _url;
  _sourceLayer;
  _minZoom;
  _maxZoom;
  _style;
  _renderer;
  _performance;
  _vtManager;
  _visibleTiles = [];
  _publicFeatures = [];
  _publicFeaturesDirty = !0;
  /** Set of tile keys for fast skip-if-unchanged comparison. */
  _lastTileCoordSet = null;
  /** Set when a background tile fetch completes — forces re-check even if tile coords unchanged. */
  _tilesDirty = !1;
  constructor(e) {
    if (super(e), !e.url)
      throw new Error("VectorTileLayer requires a url option.");
    this._url = e.url, this._sourceLayer = e.sourceLayer, this._minZoom = e.minZoom ?? 0, this._maxZoom = e.maxZoom ?? 22, this._style = e.style ?? {}, this._renderer = e.renderer, this._performance = $(e.performance), this._vtManager = new ze({ performance: this._performance }), this._fullExtent = {
      minX: -180,
      minY: -85.0511287798,
      maxX: 180,
      maxY: 85.0511287798
    }, this._vtManager.onTileLoaded = () => {
      this._tilesDirty = !0, this._publicFeaturesDirty = !0, this.redraw();
    };
  }
  // ─── Properties ───
  get url() {
    return this._url;
  }
  get sourceLayer() {
    return this._sourceLayer;
  }
  get minZoom() {
    return this._minZoom;
  }
  get maxZoom() {
    return this._maxZoom;
  }
  get style() {
    return { ...this._style };
  }
  set style(e) {
    this._style = { ...e };
  }
  /** IRenderer for data-driven symbology */
  get renderer() {
    return this._renderer;
  }
  set renderer(e) {
    this._renderer = e;
    for (const t of this._visibleTiles)
      t.binaryPayload = null, t.version += 1;
    this._vtManager.clear(), this._lastTileCoordSet = null, this._tilesDirty = !0, this._publicFeaturesDirty = !0, this.redraw();
  }
  get performance() {
    return { ...this._performance };
  }
  set performance(e) {
    this._performance = $(e), this._vtManager.setPerformance(this._performance);
    for (const t of this._visibleTiles)
      t.binaryPayload = null, t.version += 1;
    this._lastTileCoordSet = null, this._tilesDirty = !0, this._publicFeaturesDirty = !0, this.redraw();
  }
  // ─── IFeatureLayer ───
  getFeatures() {
    return this._publicFeaturesDirty && (this._publicFeatures = this._visibleTiles.flatMap(
      (e) => e.features.map(O)
    ), this._publicFeaturesDirty = !1), this._publicFeatures;
  }
  getVisibleRenderTiles() {
    return this._visibleTiles;
  }
  /** Update cached features for the current visible tile coordinates. */
  updateVisibleTiles(e, t = { renderMode: "2d" }) {
    if (!this._tilesDirty && this._lastTileCoordSet !== null && e.length === this._lastTileCoordSet.size) {
      let r = !0;
      for (const n of e)
        if (!this._lastTileCoordSet.has(`${n.z}/${n.x}/${n.y}`)) {
          r = !1;
          break;
        }
      if (r) return;
    }
    const i = /* @__PURE__ */ new Set();
    for (const r of e) i.add(`${r.z}/${r.x}/${r.y}`);
    this._lastTileCoordSet = i, this._tilesDirty = !1, this._visibleTiles = this._vtManager.getReadyTiles(
      e,
      this._url,
      this._sourceLayer,
      {
        renderMode: t.renderMode,
        zoom: t.zoom,
        renderer: this._renderer,
        performance: this._performance
      }
    ), this._publicFeaturesDirty = !0;
  }
  // ─── Lifecycle ───
  async onLoad() {
    this._url.includes("{z}") || await this._resolveTileJson(this._url), this.validateUrl();
  }
  /** Fetch TileJSON and extract the actual tile URL template */
  async _resolveTileJson(e) {
    try {
      const t = await fetch(e);
      if (!t.ok) return;
      const i = await t.json();
      i.tiles && Array.isArray(i.tiles) && i.tiles.length > 0 && (this._url = i.tiles[0]);
    } catch {
    }
  }
  refresh() {
    this._vtManager.clear(), this._visibleTiles = [], this._publicFeatures = [], this._publicFeaturesDirty = !0, this._lastTileCoordSet = null, this._tilesDirty = !1, this.setLoaded(!1), super.refresh();
  }
  destroy() {
    this._vtManager.destroy(), super.destroy();
  }
  // ─── Tile URL generation ───
  getTileUrl(e, t, i) {
    return this._url.replace("{z}", String(e)).replace("{x}", String(t)).replace("{y}", String(i));
  }
  isZoomValid(e) {
    return e >= this._minZoom && e <= this._maxZoom;
  }
  get fullExtent() {
    return this._fullExtent;
  }
  // ─── Private helpers ───
  validateUrl() {
    const e = this._url.includes("{z}"), t = this._url.includes("{x}"), i = this._url.includes("{y}");
    if (!e || !t || !i)
      throw new Error(
        "VectorTileLayer url must contain {z}, {x}, and {y} placeholders."
      );
  }
}
function $(s) {
  const e = typeof navigator < "u" && Number.isFinite(navigator.hardwareConcurrency) ? navigator.hardwareConcurrency : 4;
  return {
    mode: s?.mode ?? "auto",
    workerCount: Math.max(1, Math.floor(s?.workerCount ?? Math.min(Math.floor(e / 2), 4))),
    maxInFlightTiles: Math.max(1, Math.floor(s?.maxInFlightTiles ?? Ue)),
    minScreenAreaPx: Math.max(0, s?.minScreenAreaPx ?? $e)
  };
}
class at extends y {
  type = "animated";
  _source;
  _timeField;
  _speed;
  _currentTime;
  // epoch ms
  _state = "stopped";
  _timeRange = null;
  constructor(e) {
    if (super(e), !e.timeField)
      throw new Error("AnimatedLayer requires a timeField option.");
    this._source = e.source, this._timeField = e.timeField, this._speed = e.speed ?? 1, this._currentTime = 0;
  }
  // ─── Properties ───
  get timeField() {
    return this._timeField;
  }
  get speed() {
    return this._speed;
  }
  get currentTime() {
    return this._currentTime;
  }
  get state() {
    return this._state;
  }
  get source() {
    return this._source;
  }
  get timeRange() {
    return this._timeRange ? { ...this._timeRange } : null;
  }
  // ─── Lifecycle ───
  async onLoad() {
    this.computeTimeRange(), this.updateExtent(), this._timeRange && (this._currentTime = this._timeRange.min);
  }
  refresh() {
    this._state = "stopped", this._timeRange = null, this.setLoaded(!1), super.refresh();
  }
  destroy() {
    this._state = "stopped", super.destroy();
  }
  // ─── Time control ───
  /**
   * Set the current time to a specific value.
   * @param date Date object or epoch milliseconds
   */
  setTime(e) {
    e instanceof Date ? this._currentTime = e.getTime() : this._currentTime = e;
  }
  /**
   * Start playback from the current time.
   */
  play() {
    this.loaded && (this._state = "playing");
  }
  /**
   * Pause playback at the current time.
   */
  pause() {
    this._state === "playing" && (this._state = "paused");
  }
  /**
   * Stop playback and reset to the start time.
   */
  stop() {
    this._state = "stopped", this._timeRange && (this._currentTime = this._timeRange.min);
  }
  /**
   * Set playback speed multiplier.
   * @param multiplier Speed multiplier (1.0 = normal, 2.0 = double speed)
   */
  setSpeed(e) {
    if (e <= 0)
      throw new Error("Speed must be positive.");
    this._speed = e;
  }
  /**
   * Advance the current time by a given delta (in real milliseconds).
   * The actual time advance is delta * speed.
   * Only advances when in 'playing' state.
   */
  tick(e) {
    this._state === "playing" && (this._currentTime += e * this._speed, this._timeRange && this._currentTime > this._timeRange.max && (this._currentTime = this._timeRange.max, this._state = "paused"));
  }
  // ─── Feature access ───
  /**
   * Get features that are active at or before the current time.
   * A feature is active if its time value <= currentTime.
   */
  getCurrentFeatures() {
    return this.loaded ? this._source.filter((e) => {
      const t = this.getFeatureTime(e);
      return t === null ? !1 : t <= this._currentTime;
    }) : [];
  }
  /**
   * Get features within a specific time window.
   */
  getFeaturesInRange(e, t) {
    return this.loaded ? this._source.filter((i) => {
      const r = this.getFeatureTime(i);
      return r === null ? !1 : r >= e && r <= t;
    }) : [];
  }
  /**
   * Set the source features.
   */
  setSource(e) {
    this._source = e, this.computeTimeRange(), this.updateExtent();
  }
  // ─── Private helpers ───
  getFeatureTime(e) {
    const t = e.attributes[this._timeField];
    if (typeof t == "number" && isFinite(t))
      return t;
    if (typeof t == "string") {
      const i = Date.parse(t);
      if (isFinite(i)) return i;
    }
    return null;
  }
  computeTimeRange() {
    let e = 1 / 0, t = -1 / 0;
    for (const i of this._source) {
      const r = this.getFeatureTime(i);
      r !== null && (e = Math.min(e, r), t = Math.max(t, r));
    }
    isFinite(e) && isFinite(t) ? this._timeRange = { min: e, max: t } : this._timeRange = null;
  }
  updateExtent() {
    if (this._source.length === 0) {
      this._fullExtent = void 0;
      return;
    }
    let e = 1 / 0, t = 1 / 0, i = -1 / 0, r = -1 / 0;
    for (const n of this._source)
      this.expandExtent(n.geometry.coordinates, (a, l) => {
        e = Math.min(e, a), t = Math.min(t, l), i = Math.max(i, a), r = Math.max(r, l);
      });
    isFinite(e) ? this._fullExtent = { minX: e, minY: t, maxX: i, maxY: r } : this._fullExtent = void 0;
  }
  expandExtent(e, t) {
    if (!(!Array.isArray(e) || e.length === 0)) {
      if (typeof e[0] == "number") {
        t(e[0], e[1] ?? 0);
        return;
      }
      for (const i of e)
        this.expandExtent(i, t);
    }
  }
}
const G = {
  "ref-dark-cyan": {
    clusterFillSmall: [20, 30, 49, 232],
    clusterFillMedium: [16, 26, 45, 238],
    clusterFillLarge: [12, 22, 41, 244],
    clusterStroke: [52, 205, 255, 225],
    clusterText: [246, 251, 255, 255],
    pointFill: [245, 152, 52, 236],
    pointStroke: [255, 232, 186, 248],
    pointSize: 10,
    pointStrokeWidth: 1.5,
    clusterBaseSize: 24,
    clusterGrowRate: 4,
    clusterStrokeWidth: 2.2
  },
  "legacy-orange": {
    clusterFillSmall: [255, 138, 92, 220],
    clusterFillMedium: [255, 109, 58, 235],
    clusterFillLarge: [210, 115, 28, 245],
    clusterStroke: [255, 255, 255, 190],
    clusterText: [255, 255, 255, 255],
    pointFill: [255, 109, 58, 255],
    pointStroke: [255, 240, 220, 235],
    pointSize: 9,
    pointStrokeWidth: 1.2,
    clusterBaseSize: 22,
    clusterGrowRate: 4,
    clusterStrokeWidth: 1.8
  }
}, V = 20037508342789244e-9, Ge = 18, Z = 64, Ze = 300;
class ot extends y {
  type = "gpu-cluster";
  _sourceLayer;
  _points3857 = null;
  _sourceVersion = 0;
  _removeRefreshListener = null;
  clusterRadius;
  clusterMinPoints;
  clusterMaxZoom;
  _themePreset;
  _clusterStyle;
  _viewCallbacks = null;
  constructor(e) {
    super(e), this._sourceLayer = e.source, this.clusterRadius = e.clusterRadius ?? 60, this.clusterMinPoints = e.clusterMinPoints ?? 2, this.clusterMaxZoom = Number.isFinite(e.clusterMaxZoom) ? Math.max(0, e.clusterMaxZoom) : Ge, this._themePreset = e.themePreset ?? "ref-dark-cyan", this._clusterStyle = {
      ...G[this._themePreset],
      ...e.style
    }, this._bindSourceListener();
  }
  // ─── IClusterLayer ────────────────────────────────────────────────────────
  get sourceLayer() {
    return this._sourceLayer;
  }
  set sourceLayer(e) {
    this.setSource(e);
  }
  setSource(e) {
    this._unbindSourceListener(), this._sourceLayer = e, this._points3857 = null, this._sourceVersion++, this._bindSourceListener(), this.redraw();
  }
  get sourceVersion() {
    return this._sourceVersion;
  }
  get pointCount() {
    const e = this.getSourcePoints3857();
    return e ? e.length / 2 : 0;
  }
  getSourcePoints3857() {
    if (!this._points3857) {
      const e = this._sourceLayer.getFeatures();
      if (e.length === 0) return null;
      this._points3857 = this._convertToMercator(e);
    }
    return this._points3857;
  }
  get clusterStyle() {
    return this._clusterStyle;
  }
  get themePreset() {
    return this._themePreset;
  }
  setThemePreset(e, t) {
    this._themePreset = e, this._clusterStyle = {
      ...G[e],
      ...t ?? {}
    }, this.redraw();
  }
  setStyle(e) {
    this._clusterStyle = {
      ...this._clusterStyle,
      ...e
    }, this.redraw();
  }
  attachView(e) {
    this._viewCallbacks = e;
  }
  handleClusterClick(e, t) {
    if (!this._viewCallbacks) return;
    const i = this.getSourcePoints3857();
    if (!i || i.length === 0) return;
    const r = this._viewCallbacks.getZoom(), n = Math.max(0, Math.floor(r)), a = this._viewCallbacks.getExtent(), l = ie(i, this.clusterRadius, n, a, this.clusterMinPoints), o = this._pickHitCluster(l, e, t, r);
    if (!o) return;
    const h = l.membership[o.entryIndex] ?? [];
    if (h.length === 0 || typeof this._viewCallbacks.goTo != "function") return;
    const u = this._computeFitTarget(i, h);
    if (!u) return;
    const c = this._viewCallbacks.getZoom(), m = { center: u.center, duration: Ze };
    u.zoom > c + 0.01 && (m.zoom = u.zoom), this._viewCallbacks.goTo(m);
  }
  // ─── Lifecycle ────────────────────────────────────────────────────────────
  async onLoad() {
    this._sourceLayer.loaded || await this._sourceLayer.load(), this._points3857 = null, this._sourceVersion++;
  }
  destroy() {
    this._unbindSourceListener(), this._points3857 = null, this._viewCallbacks = null, super.destroy();
  }
  // ─── Private ──────────────────────────────────────────────────────────────
  _clusterHitRadiusPx(e) {
    const t = e >= 100 ? 2 : e >= 10 ? 1 : 0;
    return (this._clusterStyle.clusterBaseSize + this._clusterStyle.clusterGrowRate * t) * 0.5 + 6;
  }
  _pickHitCluster(e, t, i, r) {
    const n = this._pickHitClusterScreen(e, t, i);
    return n || this._pickHitClusterMap(e, t, i, r);
  }
  _pickHitClusterScreen(e, t, i) {
    const r = this._viewCallbacks?.toScreen;
    if (!r) return null;
    let n = -1, a = 1 / 0;
    for (let l = 0; l < e.entries.length; l++) {
      const o = e.entries[l];
      if ((o.flags & 1) === 0) continue;
      const [h, u] = H(o.posX, o.posY), c = r(h, u);
      if (!c) continue;
      const m = c[0] - t, d = c[1] - i, f = m * m + d * d, _ = this._clusterHitRadiusPx(o.count);
      f <= _ * _ && f < a && (a = f, n = l);
    }
    return n < 0 ? null : { entryIndex: n, entry: e.entries[n] };
  }
  _pickHitClusterMap(e, t, i, r) {
    const n = this._viewCallbacks?.toMap(t, i);
    if (!n) return null;
    const [a, l] = n, [o, h] = I(a, l), u = 2 * V / (256 * Math.pow(2, r));
    let c = -1, m = 1 / 0;
    for (let d = 0; d < e.entries.length; d++) {
      const f = e.entries[d];
      if ((f.flags & 1) === 0) continue;
      const _ = f.posX - o, p = f.posY - h, x = _ * _ + p * p, g = this._clusterHitRadiusPx(f.count) * u;
      x <= g * g && x < m && (m = x, c = d);
    }
    return c < 0 ? null : { entryIndex: c, entry: e.entries[c] };
  }
  _computeFitTarget(e, t) {
    const i = this._viewCallbacks?.getViewportSize?.();
    if (!i) return null;
    const r = Math.max(1, i[0] - Z * 2), n = Math.max(1, i[1] - Z * 2);
    let a = 1 / 0, l = 1 / 0, o = -1 / 0, h = -1 / 0;
    for (const x of t) {
      const g = e[x * 2], w = e[x * 2 + 1];
      g === void 0 || w === void 0 || (a = Math.min(a, g), l = Math.min(l, w), o = Math.max(o, g), h = Math.max(h, w));
    }
    if (!isFinite(a) || !isFinite(l) || !isFinite(o) || !isFinite(h))
      return null;
    const u = Math.max(0, o - a), c = Math.max(0, h - l), m = u <= 0 ? this.clusterMaxZoom : Math.log2(2 * V * r / (256 * u)), d = c <= 0 ? this.clusterMaxZoom : Math.log2(2 * V * n / (256 * c)), f = Math.max(0, Math.min(this.clusterMaxZoom, Math.min(m, d))), [_, p] = H((a + o) * 0.5, (l + h) * 0.5);
    return {
      center: [_, p],
      zoom: f
    };
  }
  _convertToMercator(e) {
    const t = [];
    for (const i of e)
      if (i.geometry.type === "Point") {
        const r = i.geometry.coordinates, [n, a] = I(r[0], r[1]);
        t.push(n, a);
      } else if (i.geometry.type === "MultiPoint") {
        const r = i.geometry.coordinates;
        for (const n of r) {
          const [a, l] = I(n[0], n[1]);
          t.push(a, l);
        }
      }
    return new Float32Array(t);
  }
  _bindSourceListener() {
    const e = () => {
      this._points3857 = null, this._sourceVersion++, this.redraw();
    };
    this._sourceLayer.on("refresh", e), this._removeRefreshListener = () => this._sourceLayer.off("refresh", e);
  }
  _unbindSourceListener() {
    this._removeRefreshListener?.(), this._removeRefreshListener = null;
  }
}
class lt extends y {
  type = "custom-shader";
  vertexShader;
  fragmentShader;
  vertexBufferLayouts;
  animated;
  rawMode;
  blendState;
  _vertexBuffers = [];
  _indexBuffer = null;
  _indexFormat = "uint32";
  _customUniforms = null;
  _textures = [];
  _drawParams = {};
  _topology;
  constructor(e) {
    super(e), this.vertexShader = e.vertexShader, this.fragmentShader = e.fragmentShader, this.vertexBufferLayouts = e.vertexBufferLayouts, this.animated = e.animated ?? !1, this.rawMode = e.rawMode ?? !1, this.blendState = e.blendState, this._topology = e.topology ?? "triangle-list";
  }
  // ─── Public API ───
  setVertexBuffer(e, t) {
    this._vertexBuffers[e] = t;
  }
  setIndexBuffer(e, t = "uint32") {
    this._indexBuffer = e, this._indexFormat = t;
  }
  setCustomUniforms(e) {
    this._customUniforms = e instanceof Float32Array ? e.buffer : e;
  }
  setTexture(e, t) {
    this._textures = [{ texture: e, sampler: t }];
  }
  setDrawParams(e) {
    this._drawParams = e;
  }
  requestRender() {
    this.eventBus.emit("refresh", void 0);
  }
  // ─── ICustomShaderLayer ───
  getVertexBuffers() {
    return this._vertexBuffers;
  }
  getIndexBuffer() {
    return this._indexBuffer;
  }
  getCustomUniforms() {
    return this._customUniforms;
  }
  getTextures() {
    return this._textures;
  }
  getDrawCommand() {
    return {
      topology: this._topology,
      vertexCount: this._drawParams.vertexCount,
      instanceCount: this._drawParams.instanceCount,
      indexCount: this._drawParams.indexCount,
      indexFormat: this._indexBuffer ? this._indexFormat : void 0
    };
  }
  // ─── LayerBase ───
  async onLoad() {
  }
}
function ut(s = {}) {
  const e = s.fillColor ?? [66, 133, 244, 255];
  return {
    type: "simple-marker",
    color: s.fillOpacity !== void 0 ? [e[0], e[1], e[2], Math.round(s.fillOpacity * 255)] : e,
    size: s.radius ?? 10,
    outlineColor: s.strokeColor ?? [255, 255, 255, 255],
    outlineWidth: s.strokeWeight ?? 1.5
  };
}
class ht extends y {
  type = "dynamic-point";
  _maxPoints;
  _pointCount = 0;
  _positionBuffer = null;
  _renderEngine = null;
  _pointSymbol;
  constructor(e = {}) {
    super(e), this._maxPoints = e.maxPoints ?? 1e4, this._pointSymbol = e.symbol ?? {
      type: "simple-marker",
      color: [255, 87, 34, 255],
      size: 6
    };
  }
  /** Number of active points. */
  get pointCount() {
    return this._pointCount;
  }
  /** Pre-allocated GPU vertex buffer for positions. */
  get positionBuffer() {
    return this._positionBuffer;
  }
  /** Symbol used for rendering all points. */
  get pointSymbol() {
    return this._pointSymbol;
  }
  set pointSymbol(e) {
    this._pointSymbol = e;
  }
  /** Maximum number of points this layer can hold. */
  get maxPoints() {
    return this._maxPoints;
  }
  /**
   * Attach render engine and allocate the GPU buffer.
   * Must be called before updatePositions().
   */
  attachRenderEngine(e) {
    this._renderEngine = e, this._positionBuffer = e.createBuffer(
      new Float32Array(this._maxPoints * 3),
      40
      // VERTEX | COPY_DST
    );
  }
  /**
   * Bulk-update all positions via writeBuffer (no allocation).
   *
   * @param data - Float32Array of [x, y, z, x, y, z, ...] in EPSG:3857.
   *               Length must be a multiple of 3.
   *               The number of points is data.length / 3.
   */
  updatePositions(e) {
    if (!this._renderEngine || !this._positionBuffer) return;
    const t = Math.min(Math.floor(e.length / 3), this._maxPoints);
    this._pointCount = t, t > 0 && this._renderEngine.writeBuffer(this._positionBuffer, 0, e.subarray(0, t * 3));
  }
  async onLoad() {
  }
  destroy() {
    this._positionBuffer && this._renderEngine && this._renderEngine.releaseBuffer(this._positionBuffer), this._positionBuffer = null, this._renderEngine = null, this._pointCount = 0, super.destroy();
  }
}
class ct extends y {
  type = "image-overlay";
  url;
  bounds;
  _imageData = null;
  constructor(e) {
    super(e), this.url = e.url, this.bounds = e.bounds;
  }
  async onLoad() {
    const t = await (await fetch(this.url)).blob();
    this._imageData = await createImageBitmap(t), this._fullExtent = {
      minX: this.bounds[0],
      minY: this.bounds[1],
      maxX: this.bounds[2],
      maxY: this.bounds[3],
      spatialReference: "EPSG:4326"
    };
  }
  /** Get the loaded image bitmap for rendering. */
  get imageData() {
    return this._imageData;
  }
  /** Get the extent for this overlay. */
  get fullExtent() {
    return this._fullExtent;
  }
  /** Update the image URL and reload. */
  setUrl(e) {
    this.url = e, this.refresh();
  }
  /** Update the geographic bounds. */
  setBounds(e) {
    this.bounds = e, this._fullExtent = {
      minX: e[0],
      minY: e[1],
      maxX: e[2],
      maxY: e[3],
      spatialReference: "EPSG:4326"
    }, this.redraw();
  }
}
class dt extends y {
  type = "video-overlay";
  bounds;
  _video = null;
  _urls;
  _autoplay;
  _loop;
  _muted;
  constructor(e) {
    super(e), this._urls = Array.isArray(e.url) ? e.url : [e.url], this.bounds = e.bounds, this._autoplay = e.autoplay ?? !0, this._loop = e.loop ?? !0, this._muted = e.muted ?? !0;
  }
  async onLoad() {
    const e = document.createElement("video");
    e.crossOrigin = "anonymous", e.playsInline = !0, e.autoplay = this._autoplay, e.loop = this._loop, e.muted = this._muted;
    for (const t of this._urls) {
      const i = document.createElement("source");
      i.src = t, e.appendChild(i);
    }
    await new Promise((t, i) => {
      e.addEventListener("loadeddata", () => t(), { once: !0 }), e.addEventListener("error", () => i(new Error("Video load failed")), { once: !0 }), e.load();
    }), this._video = e, this._fullExtent = {
      minX: this.bounds[0],
      minY: this.bounds[1],
      maxX: this.bounds[2],
      maxY: this.bounds[3],
      spatialReference: "EPSG:4326"
    }, this._autoplay && e.play().catch(() => {
    });
  }
  /** Get the underlying HTMLVideoElement. */
  get videoElement() {
    return this._video;
  }
  /** Play the video. */
  play() {
    this._video?.play();
  }
  /** Pause the video. */
  pause() {
    this._video?.pause();
  }
  get fullExtent() {
    return this._fullExtent;
  }
}
class ft extends y {
  type = "layer-group";
  _layers = [];
  constructor(e) {
    super(e), e?.layers && (this._layers = [...e.layers]);
  }
  async onLoad() {
    await Promise.all(this._layers.map((e) => e.load()));
  }
  /** Add a layer to the group. */
  addLayer(e) {
    return this._layers.includes(e) || this._layers.push(e), this;
  }
  /** Remove a layer from the group. */
  removeLayer(e) {
    const t = typeof e == "string" ? e : e.id;
    return this._layers = this._layers.filter((i) => i.id !== t), this;
  }
  /** Check if a layer is in the group. */
  hasLayer(e) {
    const t = typeof e == "string" ? e : e.id;
    return this._layers.some((i) => i.id === t);
  }
  /** Get a layer by ID. */
  getLayer(e) {
    return this._layers.find((t) => t.id === e);
  }
  /** Get all layers in the group. */
  getLayers() {
    return this._layers;
  }
  /** Number of layers in the group. */
  get count() {
    return this._layers.length;
  }
  /** Cascade visibility to all child layers. */
  set visible(e) {
    super.visible = e;
    for (const t of this._layers)
      t.visible = e, t.refresh();
  }
  get visible() {
    return super.visible;
  }
  /** Cascade opacity to all child layers. */
  set opacity(e) {
    super.opacity = e;
    for (const t of this._layers)
      t.opacity = e, t.refresh();
  }
  get opacity() {
    return super.opacity;
  }
  /** Remove all layers from the group. */
  clearLayers() {
    return this._layers = [], this;
  }
  /** Iterate over all layers. */
  eachLayer(e) {
    for (const t of this._layers) e(t);
    return this;
  }
  destroy() {
    for (const e of this._layers) e.destroy();
    this._layers = [], super.destroy();
  }
}
export {
  at as AnimatedLayer,
  rt as ClusterLayer,
  ht as DynamicPointLayer,
  tt as FeatureLayer,
  Qe as GeoJSONLayer,
  ot as GpuClusterLayer,
  se as GraphicsLayer,
  it as HeatmapLayer,
  ct as ImageOverlay,
  y as LayerBase,
  ft as LayerGroup,
  Je as RasterTileLayer,
  nt as VectorTileLayer,
  dt as VideoOverlay,
  lt as WGSLLayer,
  Ke as WMSLayer,
  et as WallLayer,
  ut as createCircleMarkerSymbol,
  st as parseMvt
};
