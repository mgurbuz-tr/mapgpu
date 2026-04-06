const ni = {
  format: "depth24plus",
  compareFunc: "less",
  clearValue: 1
}, No = {
  format: "depth32float",
  compareFunc: "greater",
  clearValue: 0
};
function be(i) {
  return typeof i.vertexShader == "string" && typeof i.fragmentShader == "string" && typeof i.getVertexBuffers == "function" && typeof i.getDrawCommand == "function";
}
function mn(i) {
  return typeof i.getTileUrl == "function" && "minZoom" in i && "maxZoom" in i;
}
function Ct(i) {
  return typeof i.getFeatures == "function";
}
function we(i) {
  return typeof i.requestTile == "function" && typeof i.getReadyHeightTile == "function" && typeof i.getReadyHillshadeTile == "function" && "minZoom" in i && "maxZoom" in i && "exaggeration" in i;
}
function pn(i) {
  return typeof i.getSourcePoints3857 == "function" && "clusterRadius" in i;
}
function gn(i) {
  return typeof i.updatePositions == "function" && "pointCount" in i;
}
function yn(i) {
  return i.type === "image-overlay" && "imageData" in i;
}
function Xt(i) {
  return i.type === "video-overlay" && "videoElement" in i;
}
function de(i) {
  const t = oi(i?.sky);
  return {
    fog: {
      enabled: i?.fog?.enabled ?? !1,
      density: i?.fog?.density ?? 3e-4,
      color: i?.fog?.color ?? [0.6, 0.7, 0.9, 1],
      startDistance: i?.fog?.startDistance ?? 0,
      equation: i?.fog?.equation ?? "exp"
    },
    nightImagery: {
      enabled: i?.nightImagery?.enabled ?? !1,
      textureUrl: i?.nightImagery?.textureUrl ?? "",
      intensity: i?.nightImagery?.intensity ?? 1,
      transitionWidth: i?.nightImagery?.transitionWidth ?? 0.1
    },
    waterMask: {
      enabled: i?.waterMask?.enabled ?? !1,
      color: i?.waterMask?.color ?? [0, 0.05, 0.15, 1],
      specularPower: i?.waterMask?.specularPower ?? 64,
      fresnelBias: i?.waterMask?.fresnelBias ?? 0.02,
      waveFrequency: i?.waterMask?.waveFrequency ?? 0,
      waveAmplitude: i?.waterMask?.waveAmplitude ?? 0.01
    },
    atmosphere: {
      enabled: i?.atmosphere?.enabled ?? !0,
      colorInner: i?.atmosphere?.colorInner ?? [0.3, 0.5, 1, 0.3],
      colorOuter: i?.atmosphere?.colorOuter ?? [0.1, 0.3, 0.8, 0],
      strength: i?.atmosphere?.strength ?? 1,
      falloff: i?.atmosphere?.falloff ?? 4
    },
    sky: t,
    lighting: {
      enabled: i?.lighting?.enabled ?? !0,
      ambient: i?.lighting?.ambient ?? 0.5,
      diffuse: i?.lighting?.diffuse ?? 0.85,
      shadowStrength: i?.lighting?.shadowStrength ?? 0.2,
      shadowSoftness: i?.lighting?.shadowSoftness ?? 0.4,
      sunAzimuth: i?.lighting?.sunAzimuth ?? 315,
      sunAltitude: i?.lighting?.sunAltitude ?? 45
    },
    poleCaps: {
      enabled: i?.poleCaps?.enabled ?? !0,
      color: i?.poleCaps?.color ?? [0.65, 0.78, 0.88]
    },
    backgroundColor: i?.backgroundColor ?? [0, 0, 0, 1]
  };
}
const ii = {
  "realistic-cinematic": {
    enabled: !0,
    horizonColor: [0.79, 0.88, 1, 1],
    zenithColor: [0.19, 0.46, 0.93, 1],
    spaceColor: [0.015, 0.04, 0.12, 1],
    horizonBlend: 0.18,
    verticalFalloff: 1.6,
    starIntensity: 0.38,
    starDensity: 0.34,
    starSeed: 17,
    syncWithLighting: !0
  },
  stylized: {
    enabled: !0,
    horizonColor: [0.62, 0.83, 1, 1],
    zenithColor: [0.18, 0.36, 0.9, 1],
    spaceColor: [0.03, 0.06, 0.17, 1],
    horizonBlend: 0.26,
    verticalFalloff: 1.15,
    starIntensity: 0.52,
    starDensity: 0.46,
    starSeed: 29,
    syncWithLighting: !0
  },
  neutral: {
    enabled: !0,
    horizonColor: [0.76, 0.84, 0.94, 1],
    zenithColor: [0.29, 0.5, 0.75, 1],
    spaceColor: [0.04, 0.07, 0.15, 1],
    horizonBlend: 0.18,
    verticalFalloff: 1.7,
    starIntensity: 0.26,
    starDensity: 0.24,
    starSeed: 11,
    syncWithLighting: !0
  }
};
function oi(i) {
  const t = i?.preset ?? "realistic-cinematic", e = ii[t === "custom" ? "realistic-cinematic" : t];
  return {
    ...e,
    ...i,
    preset: t,
    enabled: i?.enabled ?? e.enabled,
    horizonBlend: te(i?.horizonBlend ?? e.horizonBlend),
    verticalFalloff: Math.max(0.1, i?.verticalFalloff ?? e.verticalFalloff),
    starIntensity: te(i?.starIntensity ?? e.starIntensity),
    starDensity: te(i?.starDensity ?? e.starDensity),
    starSeed: i?.starSeed ?? e.starSeed,
    syncWithLighting: i?.syncWithLighting ?? e.syncWithLighting
  };
}
function te(i) {
  return Math.max(0, Math.min(1, i));
}
const Ko = (
  /* wgsl */
  `
fn applyFog(
  color: vec3<f32>,
  fogColor: vec3<f32>,
  distance: f32,
  density: f32,
  equation: u32, // 0=linear, 1=exp, 2=exp2
) -> vec3<f32> {
  var fogFactor: f32;
  if equation == 0u {
    fogFactor = clamp(1.0 - distance * density, 0.0, 1.0);
  } else if equation == 1u {
    fogFactor = exp(-distance * density);
  } else {
    fogFactor = exp(-pow(distance * density, 2.0));
  }
  return mix(fogColor, color, fogFactor);
}
`
), jo = (
  /* wgsl */
  `
fn blendNightDay(
  dayColor: vec3<f32>,
  nightColor: vec3<f32>,
  lightFactor: f32,  // dot(normal, sunDir)
  transitionWidth: f32,
  nightIntensity: f32,
) -> vec3<f32> {
  let blend = smoothstep(-transitionWidth, transitionWidth, lightFactor);
  return mix(nightColor * nightIntensity, dayColor, blend);
}
`
), qo = (
  /* wgsl */
  `
fn waterSpecular(
  normal: vec3<f32>,
  viewDir: vec3<f32>,
  lightDir: vec3<f32>,
  specularPower: f32,
  fresnelBias: f32,
) -> f32 {
  let halfVec = normalize(lightDir + viewDir);
  let spec = pow(max(dot(normal, halfVec), 0.0), specularPower);
  let fresnel = fresnelBias + (1.0 - fresnelBias) * pow(1.0 - max(dot(viewDir, normal), 0.0), 5.0);
  return spec * fresnel;
}
`
);
class Qo {
  /** Discriminant identifying this as a simple renderer. Always `'simple'`. */
  type = "simple";
  /**
   * The symbol applied to all features.
   *
   * Set once at construction time and never changes. Can be a
   * {@link PointSymbol}, {@link LineSymbol}, or {@link PolygonSymbol}.
   */
  symbol;
  /**
   * Create a new SimpleRenderer.
   *
   * @param symbol - The symbol to apply to every feature. Must match the
   *   geometry type of the layer (e.g., a PolygonSymbol for polygon layers).
   *
   * @example
   * ```ts
   * const renderer = new SimpleRenderer({
   *   type: 'simple-fill',
   *   color: [100, 149, 237, 200],
   *   outlineColor: [25, 25, 112, 255],
   *   outlineWidth: 1,
   * });
   * ```
   */
  constructor(t) {
    this.symbol = t;
  }
  /**
   * Returns the same symbol for every feature.
   *
   * Both parameters are ignored -- the constructor-provided symbol is
   * always returned. This method never returns `null`, so no features
   * are hidden.
   *
   * @param _feature - The feature to symbolize (ignored).
   * @param _context - Optional render context (ignored).
   * @returns The single symbol assigned to this renderer.
   *
   * @example
   * ```ts
   * const sym = renderer.getSymbol(feature, { zoom: 5, resolution: 4891.97 });
   * // Always returns the same symbol regardless of feature or zoom
   * ```
   */
  getSymbol(t, e) {
    return this.symbol;
  }
}
class Jo {
  /** Discriminant identifying this as a unique-value renderer. Always `'unique-value'`. */
  type = "unique-value";
  /**
   * The attribute field name used for symbol lookup.
   *
   * The renderer reads `feature.attributes[field]` to determine which
   * symbol to return.
   */
  field;
  /**
   * Fallback symbol returned when the feature's attribute value does not
   * match any entry in the value map, or when the attribute is missing.
   */
  defaultSymbol;
  /** Public copy of configured unique-value mapping (serializable). */
  uniqueValues;
  zoomSensitive;
  /**
   * Internal lookup map from attribute value to symbol.
   *
   * Built once at construction time from the provided `uniqueValues` array.
   * @internal
   */
  _map;
  /**
   * Create a new UniqueValueRenderer.
   *
   * @param options - Configuration specifying the field, default symbol,
   *   and the array of value-to-symbol mappings.
   *
   * @example
   * ```ts
   * const renderer = new UniqueValueRenderer({
   *   field: 'category',
   *   defaultSymbol: { type: 'simple-marker', color: [128,128,128,255], size: 6 },
   *   uniqueValues: [
   *     { value: 'A', symbol: { type: 'simple-marker', color: [255,0,0,255], size: 8 } },
   *     { value: 'B', symbol: { type: 'simple-marker', color: [0,0,255,255], size: 8 } },
   *   ],
   * });
   * ```
   */
  constructor(t) {
    this.field = t.field, this.defaultSymbol = t.defaultSymbol, this.uniqueValues = t.uniqueValues.slice(), this.zoomSensitive = t.zoomSensitive, this._map = new Map(
      t.uniqueValues.map((e) => [e.value, e.symbol])
    );
  }
  /**
   * Look up the symbol for a feature based on its attribute value.
   *
   * Reads `feature.attributes[this.field]` and performs an O(1) map
   * lookup. Returns {@link defaultSymbol} when:
   * - The attribute value is `null` or `undefined`
   * - The value is not present in the unique values map
   *
   * This method never returns `null` -- all features are always drawn.
   *
   * @param feature - The feature whose attribute value determines the symbol.
   * @param _context - Optional render context (currently unused by this renderer).
   * @returns The matched symbol, or the default symbol if no match is found.
   *
   * @example
   * ```ts
   * const feature = { id: 42, geometry: geom, attributes: { landuse: 'residential' } };
   * const sym = renderer.getSymbol(feature);
   * // Returns the symbol mapped to 'residential', or defaultSymbol if unmapped
   * ```
   */
  getSymbol(t, e) {
    const n = t.attributes[this.field];
    return n == null ? this.defaultSymbol : this._map.get(n) ?? this.defaultSymbol;
  }
}
class ts {
  /** Discriminant identifying this as a class-breaks renderer. Always `'class-breaks'`. */
  type = "class-breaks";
  /**
   * The numeric attribute field name used for classification.
   *
   * The renderer reads `feature.attributes[field]` and checks whether
   * the value is a number before testing it against breaks.
   */
  field;
  /**
   * Fallback symbol returned when the attribute is non-numeric, missing,
   * or does not fall within any defined break range.
   */
  defaultSymbol;
  /**
   * Immutable array of class breaks, evaluated in order.
   *
   * The first break whose range `[min, max)` contains the attribute
   * value is used. Subsequent breaks are not tested.
   */
  breaks;
  zoomSensitive;
  /**
   * Create a new ClassBreaksRenderer.
   *
   * @param options - Configuration specifying the field, default symbol,
   *   and the ordered array of class breaks.
   *
   * @example
   * ```ts
   * const renderer = new ClassBreaksRenderer({
   *   field: 'magnitude',
   *   defaultSymbol: { type: 'simple-marker', color: [200,200,200,255], size: 4 },
   *   breaks: [
   *     { min: 0, max: 3,        symbol: { type: 'simple-marker', color: [0,200,0,255],   size: 5 } },
   *     { min: 3, max: 5,        symbol: { type: 'simple-marker', color: [255,165,0,255], size: 9 } },
   *     { min: 5, max: Infinity, symbol: { type: 'simple-marker', color: [255,0,0,255],   size: 14 } },
   *   ],
   * });
   * ```
   */
  constructor(t) {
    this.field = t.field, this.defaultSymbol = t.defaultSymbol, this.breaks = t.breaks, this.zoomSensitive = t.zoomSensitive;
  }
  /**
   * Determine the symbol for a feature by classifying its numeric attribute.
   *
   * Reads `feature.attributes[this.field]` and returns:
   * - The symbol from the first break where `min <= value < max`
   * - {@link defaultSymbol} if the value is not a number
   * - {@link defaultSymbol} if no break range matches
   *
   * This method never returns `null` -- all features are always drawn.
   *
   * @param feature - The feature whose numeric attribute is classified.
   * @param _context - Optional render context (currently unused by this renderer).
   * @returns The symbol for the matching class break, or the default symbol.
   *
   * @example
   * ```ts
   * const feature = { id: 7, geometry: geom, attributes: { population: 250000 } };
   * const sym = renderer.getSymbol(feature);
   * // Returns the symbol whose break range contains 250000
   * ```
   */
  getSymbol(t, e) {
    const n = t.attributes[this.field];
    if (typeof n != "number") return this.defaultSymbol;
    for (const o of this.breaks)
      if (n >= o.min && n < o.max)
        return o.symbol;
    return this.defaultSymbol;
  }
}
class es {
  type = "callback";
  _fn;
  constructor(t) {
    this._fn = t;
  }
  getSymbol(t, e) {
    return this._fn(t, e);
  }
}
class ns extends Error {
  error;
  constructor(t) {
    super(si(t)), this.name = "MapGpuError", this.error = t;
  }
}
function si(i) {
  switch (i.kind) {
    case "layer-load-failed":
      return `Layer "${i.layerId}" yüklenemedi: ${i.cause.message}`;
    case "shader-compile-failed":
      return `Shader derleme hatası (${i.pipeline}): ${i.log}`;
    case "wasm-init-failed":
      return `WASM başlatılamadı: ${i.cause.message}`;
    case "webgpu-not-supported":
      return `WebGPU desteklenmiyor: ${i.userAgent}`;
    case "webgpu-device-lost":
      return `GPU device kaybedildi (${i.reason}): ${i.message}`;
    case "service-unavailable":
      return `Servis erişilemez: ${i.url} (${i.status})`;
    case "cors-blocked":
      return `CORS engeli: ${i.url}`;
    case "crs-unsupported":
      return `Desteklenmeyen CRS: ${i.crs}`;
    case "terrain-unavailable":
      return "Terrain verisi mevcut değil";
    case "los-out-of-bounds":
      return "LOS noktaları geçerli aralık dışında";
    case "unknown":
      return `Bilinmeyen hata: ${i.cause.message}`;
  }
}
class ct {
  listeners = /* @__PURE__ */ new Map();
  on(t, e) {
    this.listeners.has(t) || this.listeners.set(t, /* @__PURE__ */ new Set()), this.listeners.get(t).add(e);
  }
  off(t, e) {
    this.listeners.get(t)?.delete(e);
  }
  emit(t, e) {
    const n = this.listeners.get(t);
    if (n)
      for (const o of n)
        try {
          o(e);
        } catch (s) {
          console.error(`Event handler error [${String(t)}]:`, s);
        }
  }
  once(t, e) {
    const n = ((o) => {
      this.off(t, n), e(o);
    });
    this.on(t, n);
  }
  removeAll(t) {
    t ? this.listeners.delete(t) : this.listeners.clear();
  }
}
const ri = 3.28084, Te = 5280, Pe = 1852, ai = 10.7639, Se = 43560;
class dt {
  _distanceUnit;
  _areaUnit;
  _coordinateFormat;
  _events = new ct();
  constructor(t) {
    this._distanceUnit = t?.distanceUnit ?? "metric", this._areaUnit = t?.areaUnit ?? "metric", this._coordinateFormat = t?.coordinateFormat ?? "DD";
  }
  // ─── Getters / Setters ───
  get distanceUnit() {
    return this._distanceUnit;
  }
  set distanceUnit(t) {
    this._distanceUnit !== t && (this._distanceUnit = t, this._emitChange());
  }
  get areaUnit() {
    return this._areaUnit;
  }
  set areaUnit(t) {
    this._areaUnit !== t && (this._areaUnit = t, this._emitChange());
  }
  get coordinateFormat() {
    return this._coordinateFormat;
  }
  set coordinateFormat(t) {
    this._coordinateFormat !== t && (this._coordinateFormat = t, this._emitChange());
  }
  // ─── Formatters ───
  /**
   * Format a distance value in meters to the current distance unit.
   * metric: < 1000m → "X m", >= 1000m → "X.XX km"
   * imperial: < 5280ft → "X ft", >= 5280ft → "X.XX mi"
   * nautical: < 1852m → "X m", >= 1852m → "X.XX nmi"
   */
  formatDistance(t) {
    switch (this._distanceUnit) {
      case "metric":
        return t >= 1e3 ? `${(t / 1e3).toFixed(2)} km` : `${Math.round(t)} m`;
      case "imperial": {
        const e = t * ri;
        return e >= Te ? `${(e / Te).toFixed(2)} mi` : `${Math.round(e)} ft`;
      }
      case "nautical":
        return t >= Pe ? `${(t / Pe).toFixed(2)} nmi` : `${Math.round(t)} m`;
    }
  }
  /**
   * Format an area value in square meters to the current area unit.
   * metric: < 1M m² → "X m²", >= 1M → "X.XX km²"
   * imperial: < 43560 sqft → "X sq ft", >= → "X.XX acres"
   */
  formatArea(t) {
    switch (this._areaUnit) {
      case "metric":
        return t >= 1e6 ? `${(t / 1e6).toFixed(2)} km²` : `${Math.round(t)} m²`;
      case "imperial": {
        const e = t * ai;
        return e >= Se ? `${(e / Se).toFixed(2)} acres` : `${Math.round(e)} sq ft`;
      }
    }
  }
  /**
   * Format a coordinate pair to the current coordinate format.
   * DD: "29.0784° E, 41.0082° N"
   * DMS: "29° 04' 42.24" E, 41° 0' 29.52" N"
   * MGRS: "35T LF 12345 67890" (simplified)
   */
  formatCoordinate(t, e) {
    switch (this._coordinateFormat) {
      case "DD":
        return dt.formatDD(t, e);
      case "DMS":
        return dt.formatDMS(t, e);
      case "MGRS":
        return dt.formatMGRS(t, e);
    }
  }
  // ─── Static Formatters ───
  static formatDD(t, e) {
    const n = t >= 0 ? "E" : "W", o = e >= 0 ? "N" : "S";
    return `${Math.abs(t).toFixed(4)}° ${n}, ${Math.abs(e).toFixed(4)}° ${o}`;
  }
  static formatDMS(t, e) {
    const n = t >= 0 ? "E" : "W", o = e >= 0 ? "N" : "S";
    return `${dt._toDMS(Math.abs(t))} ${n}, ${dt._toDMS(Math.abs(e))} ${o}`;
  }
  static formatMGRS(t, e) {
    const n = Math.floor((t + 180) / 6) + 1, o = e >= 0 ? "N" : "S", s = t >= 0 ? "E" : "W";
    return `${n}${o} ${Math.abs(t).toFixed(4)}${s} ${Math.abs(e).toFixed(4)}${o}`;
  }
  static _toDMS(t) {
    const e = Math.floor(t), n = (t - e) * 60, o = Math.floor(n), s = ((n - o) * 60).toFixed(2);
    return `${e}° ${o}' ${s}"`;
  }
  // ─── Events ───
  on(t, e) {
    this._events.on(t, e);
  }
  off(t, e) {
    this._events.off(t, e);
  }
  destroy() {
    this._events.removeAll();
  }
  // ─── Private ───
  _emitChange() {
    this._events.emit("units-change", {
      distanceUnit: this._distanceUnit,
      areaUnit: this._areaUnit,
      coordinateFormat: this._coordinateFormat
    });
  }
}
const O = 6378137, Ee = 85.0511287798066;
function B(i, t) {
  const e = Math.max(-Ee, Math.min(Ee, t)), n = i * Math.PI * O / 180, o = e * Math.PI / 180, s = Math.log(Math.tan(Math.PI / 4 + o / 2)) * O;
  return [n, s];
}
function _e(i, t) {
  const e = i / O * (180 / Math.PI), n = (Math.atan(Math.exp(t / O)) - Math.PI / 4) * (360 / Math.PI);
  return [e, n];
}
class ci {
  _layers = [];
  _events = new ct();
  /**
   * Read-only view of the layer stack (bottom-to-top draw order).
   */
  get layers() {
    return this._layers;
  }
  /**
   * Add a layer to the top of the layer stack.
   *
   * If the layer is a LayerGroup (`type === 'layer-group'`), its child
   * layers are flattened into the stack so the render system can see them.
   * The group itself is also stored so visibility/opacity cascading works.
   */
  add(t) {
    if (this._layers.some((n) => n.id === t.id)) return;
    if (t.type === "layer-group") {
      const n = t;
      if (n.getLayers)
        for (const o of n.getLayers())
          this.add(o);
      this._layers.push(t), this._events.emit("layer-add", { layer: t, index: this._layers.length - 1 });
      return;
    }
    const e = this._layers.length;
    this._layers.push(t), this._events.emit("layer-add", { layer: t, index: e });
  }
  /**
   * Remove a layer from the stack.
   * Returns the removed layer, or undefined if not found.
   * If the layer is a LayerGroup, its children are also removed.
   */
  remove(t) {
    if (t.type === "layer-group") {
      const o = t;
      if (o.getLayers)
        for (const s of o.getLayers())
          this.remove(s);
    }
    const e = this._layers.findIndex((o) => o.id === t.id);
    if (e === -1) return;
    const [n] = this._layers.splice(e, 1);
    return n && this._events.emit("layer-remove", { layer: n, index: e }), n;
  }
  /**
   * Find a layer by its id.
   */
  findLayerById(t) {
    return this._layers.find((e) => e.id === t);
  }
  /**
   * Reorder a layer to the given index (z-order).
   * Index 0 = bottom (drawn first), length-1 = top (drawn last).
   */
  reorder(t, e) {
    const n = this._layers.findIndex((s) => s.id === t.id);
    if (n === -1) return;
    const o = Math.max(0, Math.min(this._layers.length - 1, e));
    n !== o && (this._layers.splice(n, 1), this._layers.splice(o, 0, t), this._events.emit("layer-reorder", { layer: t, fromIndex: n, toIndex: o }));
  }
  /**
   * Remove all layers.
   */
  removeAll() {
    for (; this._layers.length > 0; ) {
      const t = this._layers.pop();
      t && this._events.emit("layer-remove", { layer: t, index: this._layers.length });
    }
  }
  // ─── Events ───
  on(t, e) {
    this._events.on(t, e);
  }
  off(t, e) {
    this._events.off(t, e);
  }
  // ─── Lifecycle ───
  destroy() {
    this.removeAll(), this._events.removeAll();
  }
}
const hi = 20037508342789244e-9;
class li {
  _center;
  _zoom;
  _rotation;
  _minZoom;
  _maxZoom;
  _viewportWidth;
  _viewportHeight;
  _dirty = !0;
  // Cached matrices
  _viewMatrix = new Float32Array(16);
  _projectionMatrix = new Float32Array(16);
  constructor(t = {}) {
    this._center = t.center ?? [0, 0], this._zoom = t.zoom ?? 0, this._rotation = t.rotation ?? 0, this._minZoom = t.minZoom ?? 0, this._maxZoom = t.maxZoom ?? 24, this._viewportWidth = t.viewportWidth ?? 800, this._viewportHeight = t.viewportHeight ?? 600, this._clampZoom(), this._updateMatrices();
  }
  // ─── Getters ───
  get center() {
    return [this._center[0], this._center[1]];
  }
  get zoom() {
    return this._zoom;
  }
  get rotation() {
    return this._rotation;
  }
  get minZoom() {
    return this._minZoom;
  }
  get maxZoom() {
    return this._maxZoom;
  }
  get viewportWidth() {
    return this._viewportWidth;
  }
  get viewportHeight() {
    return this._viewportHeight;
  }
  get dirty() {
    return this._dirty;
  }
  // ─── Setters / Actions ───
  setCenter(t) {
    this._center = [t[0], t[1]], this._dirty = !0, this._updateMatrices();
  }
  setZoom(t) {
    this._zoom = t, this._clampZoom(), this._dirty = !0, this._updateMatrices();
  }
  setRotation(t) {
    this._rotation = t, this._dirty = !0, this._updateMatrices();
  }
  setViewport(t, e) {
    this._viewportWidth = t, this._viewportHeight = e, this._dirty = !0, this._updateMatrices();
  }
  zoomIn() {
    this.setZoom(this._zoom + 1);
  }
  zoomOut() {
    this.setZoom(this._zoom - 1);
  }
  clearDirty() {
    this._dirty = !1;
  }
  // ─── Matrix Access ───
  get viewMatrix() {
    return this._viewMatrix;
  }
  get projectionMatrix() {
    return this._projectionMatrix;
  }
  // ─── Extent ───
  /**
   * Calculates the visible extent in EPSG:3857 coordinates.
   * Takes into account center, zoom, rotation, and viewport size.
   */
  getExtent() {
    const t = this._getResolution(), e = this._viewportWidth / 2 * t, n = this._viewportHeight / 2 * t;
    if (this._rotation === 0)
      return {
        minX: this._center[0] - e,
        minY: this._center[1] - n,
        maxX: this._center[0] + e,
        maxY: this._center[1] + n,
        spatialReference: "EPSG:3857"
      };
    const o = Math.cos(this._rotation), s = Math.sin(this._rotation), r = [
      [-e, -n],
      [e, -n],
      [e, n],
      [-e, n]
    ];
    let a = 1 / 0, c = 1 / 0, h = -1 / 0, d = -1 / 0;
    for (const [l, u] of r) {
      const f = l * o - u * s + this._center[0], _ = l * s + u * o + this._center[1];
      a = Math.min(a, f), c = Math.min(c, _), h = Math.max(h, f), d = Math.max(d, _);
    }
    return {
      minX: a,
      minY: c,
      maxX: h,
      maxY: d,
      spatialReference: "EPSG:3857"
    };
  }
  // ─── Coordinate Conversions ───
  /**
   * Convert screen coordinates to map coordinates (EPSG:3857).
   */
  screenToMap(t, e) {
    const n = this._getResolution();
    let o = (t - this._viewportWidth / 2) * n, s = (this._viewportHeight / 2 - e) * n;
    if (this._rotation !== 0) {
      const r = Math.cos(-this._rotation), a = Math.sin(-this._rotation), c = o * r - s * a, h = o * a + s * r;
      o = c, s = h;
    }
    return [this._center[0] + o, this._center[1] + s];
  }
  /**
   * Convert map coordinates (EPSG:3857) to screen coordinates.
   */
  mapToScreen(t, e) {
    const n = this._getResolution();
    let o = t - this._center[0], s = e - this._center[1];
    if (this._rotation !== 0) {
      const c = Math.cos(this._rotation), h = Math.sin(this._rotation), d = o * c - s * h, l = o * h + s * c;
      o = d, s = l;
    }
    const r = o / n + this._viewportWidth / 2, a = this._viewportHeight / 2 - s / n;
    return [r, a];
  }
  // ─── Private ───
  /**
   * Meters per pixel at current zoom level.
   * At zoom 0 the entire world (2 * WORLD_HALF meters) fits into 256 pixels.
   */
  _getResolution() {
    return hi * 2 / (256 * Math.pow(2, this._zoom));
  }
  _clampZoom() {
    this._zoom = Math.max(this._minZoom, Math.min(this._maxZoom, this._zoom));
  }
  /**
   * Build orthographic projection and view matrices.
   * Column-major layout (WebGPU/OpenGL convention).
   */
  _updateMatrices() {
    const t = this._getResolution(), e = this._viewportWidth / 2 * t, n = this._viewportHeight / 2 * t, o = this._projectionMatrix;
    o.fill(0), o[0] = 1 / e, o[5] = 1 / n, o[10] = -1, o[15] = 1;
    const s = this._viewMatrix, r = Math.cos(-this._rotation), a = Math.sin(-this._rotation), c = -this._center[0], h = -this._center[1];
    s.fill(0), s[0] = r, s[1] = a, s[4] = -a, s[5] = r, s[10] = 1, s[12] = r * c + -a * h, s[13] = a * c + r * h, s[15] = 1;
  }
}
class ui {
  _layers = /* @__PURE__ */ new Map();
  _events = new ct();
  _currentZoom = 0;
  // ─── Layer Registration ───
  /**
   * Register a layer and begin loading it.
   * If the layer is already registered, this is a no-op.
   */
  async addLayer(t) {
    if (this._layers.has(t.id)) return;
    const e = {
      layer: t,
      loading: !1,
      loadError: null,
      dirty: !0,
      effectivelyVisible: this._isVisibleAtZoom(t, this._currentZoom)
    };
    this._layers.set(t.id, e), await this._loadLayer(e);
  }
  /**
   * Unregister a layer. Calls destroy() on the layer.
   */
  removeLayer(t) {
    const e = this._layers.get(t);
    e && (e.layer.destroy(), this._layers.delete(t));
  }
  /**
   * Remove all layers.
   */
  removeAll() {
    for (const t of this._layers.values())
      t.layer.destroy();
    this._layers.clear();
  }
  /**
   * Get a registered layer by id.
   */
  getLayer(t) {
    return this._layers.get(t)?.layer;
  }
  /**
   * Get all registered layer ids.
   */
  getLayerIds() {
    return Array.from(this._layers.keys());
  }
  // ─── Zoom & Visibility ───
  /**
   * Update the current zoom level and re-evaluate visibility for all layers.
   */
  setCurrentZoom(t) {
    this._currentZoom = t;
    for (const [e, n] of this._layers) {
      const o = n.effectivelyVisible;
      n.effectivelyVisible = this._isVisibleAtZoom(n.layer, t), o !== n.effectivelyVisible && (this._events.emit("layer-visibility-change", {
        layerId: e,
        visible: n.effectivelyVisible
      }), n.dirty = !0);
    }
  }
  /**
   * Check if a layer is effectively visible (considering zoom constraints).
   */
  isLayerVisible(t) {
    const e = this._layers.get(t);
    return e ? e.effectivelyVisible : !1;
  }
  // ─── Dirty Tracking ───
  /**
   * Mark a layer as dirty (needs re-render).
   */
  markDirty(t) {
    const e = this._layers.get(t);
    e && (e.dirty = !0, this._events.emit("layer-dirty", { layerId: t }));
  }
  /**
   * Get all dirty layer ids.
   */
  getDirtyLayers() {
    const t = [];
    for (const [e, n] of this._layers)
      n.dirty && n.effectivelyVisible && t.push(e);
    return t;
  }
  /**
   * Clear dirty flag for a specific layer.
   */
  clearDirty(t) {
    const e = this._layers.get(t);
    e && (e.dirty = !1);
  }
  /**
   * Clear dirty flags for all layers.
   */
  clearAllDirty() {
    for (const t of this._layers.values())
      t.dirty = !1;
  }
  /**
   * Returns true if any registered layer is dirty.
   */
  hasAnyDirty() {
    for (const t of this._layers.values())
      if (t.dirty && t.effectivelyVisible)
        return !0;
    return !1;
  }
  // ─── Events ───
  on(t, e) {
    this._events.on(t, e);
  }
  off(t, e) {
    this._events.off(t, e);
  }
  // ─── Lifecycle ───
  destroy() {
    this.removeAll(), this._events.removeAll();
  }
  // ─── Private ───
  async _loadLayer(t) {
    if (!(t.layer.loaded || t.loading)) {
      t.loading = !0;
      try {
        await t.layer.load(), t.loading = !1, t.dirty = !0, this._events.emit("layer-loaded", { layerId: t.layer.id });
      } catch (e) {
        t.loading = !1;
        const n = {
          kind: "layer-load-failed",
          layerId: t.layer.id,
          cause: e instanceof Error ? e : new Error(String(e))
        };
        t.loadError = n, this._events.emit("layer-load-error", {
          layerId: t.layer.id,
          error: n
        });
      }
    }
  }
  /**
   * Determine visibility based on zoom level and layer min/maxScale.
   *
   * Scale denominator at zoom level z = 559082264.028717 / 2^z.
   * A layer is visible when: minScale >= currentScale >= maxScale.
   * (minScale is a large number = zoomed out, maxScale is small = zoomed in)
   */
  _isVisibleAtZoom(t, e) {
    if (!t.visible) return !1;
    const n = 559082264028717e-6 / Math.pow(2, e);
    return !(t.minScale !== void 0 && t.minScale > 0 && n > t.minScale || t.maxScale !== void 0 && t.maxScale > 0 && n < t.maxScale);
  }
}
const j = 20037508342789244e-9, De = 85.0511287798066;
class fi {
  _maxConcurrent;
  _tileSize;
  constructor(t = {}) {
    this._maxConcurrent = t.maxConcurrent ?? 6, this._tileSize = t.tileSize ?? 256;
  }
  get maxConcurrent() {
    return this._maxConcurrent;
  }
  get tileSize() {
    return this._tileSize;
  }
  /**
   * Get visible tiles for the given extent and zoom level.
   * Returns tiles sorted by priority (center-first).
   *
   * @param extent Visible extent in EPSG:3857
   * @param zoom   Integer zoom level
   */
  getTilesForExtent(t, e) {
    const n = Math.max(0, Math.round(e)), o = Math.pow(2, n), r = j * 2 / o, a = Math.max(0, Math.floor((t.minX + j) / r)), c = Math.min(o - 1, Math.floor((t.maxX + j) / r)), h = Math.max(0, Math.floor((j - t.maxY) / r)), d = Math.min(o - 1, Math.floor((j - t.minY) / r)), l = (t.minX + t.maxX) / 2, u = (t.minY + t.maxY) / 2, f = [];
    for (let _ = h; _ <= d; _++)
      for (let p = a; p <= c; p++) {
        const m = this.tileToExtent(n, p, _), x = (m.minX + m.maxX) / 2, y = (m.minY + m.maxY) / 2, g = x - l, v = y - u, L = g * g + v * v;
        f.push({ z: n, x: p, y: _, priority: L });
      }
    return f.sort((_, p) => _.priority - p.priority), f;
  }
  /**
   * Convert tile coordinate to EPSG:3857 extent.
   */
  tileToExtent(t, e, n) {
    const o = Math.pow(2, t), s = j * 2 / o, r = e * s - j, a = j - n * s, c = r + s, h = a - s;
    return {
      minX: r,
      minY: h,
      maxX: c,
      maxY: a,
      spatialReference: "EPSG:3857"
    };
  }
  /**
   * Convert lon/lat (EPSG:4326) to tile coordinates at the given zoom.
   */
  lonLatToTile(t, e, n) {
    const o = Math.max(0, Math.round(n)), s = Math.pow(2, o), r = Math.max(-De, Math.min(De, e)), a = Math.floor((t + 180) / 360 * s), c = r * Math.PI / 180, h = Math.floor(
      (1 - Math.log(Math.tan(c) + 1 / Math.cos(c)) / Math.PI) / 2 * s
    );
    return {
      z: o,
      x: Math.max(0, Math.min(s - 1, a)),
      y: Math.max(0, Math.min(s - 1, h))
    };
  }
  /**
   * Clip a list of tiles to the max concurrent limit.
   * Tiles should already be sorted by priority.
   */
  clipToConcurrentLimit(t) {
    return t.slice(0, this._maxConcurrent);
  }
}
class di {
  _running = !1;
  _dirty = !0;
  _rafId = null;
  _firstFrame = !0;
  _lastTimestamp = 0;
  _frameNumber = 0;
  _skippedFrames = 0;
  _fps = 0;
  _frameDurationMs = 0;
  _targetFps;
  _minFrameInterval;
  // FPS smoothing
  _fpsAccumulator = 0;
  _fpsFrameCount = 0;
  _fpsLastUpdate = 0;
  _renderEngine = null;
  _cameraStateProvider = null;
  _frameCallbacks = /* @__PURE__ */ new Set();
  _preFrameCallbacks = /* @__PURE__ */ new Set();
  // Allow injecting a custom requestAnimationFrame for testing
  _requestAnimationFrame;
  _cancelAnimationFrame;
  constructor(t = {}, e, n) {
    this._targetFps = t.targetFps ?? 60, this._minFrameInterval = this._targetFps > 0 ? 1e3 / this._targetFps : 0, this._requestAnimationFrame = e ?? ((o) => requestAnimationFrame(o)), this._cancelAnimationFrame = n ?? ((o) => cancelAnimationFrame(o));
  }
  // ─── Configuration ───
  setRenderEngine(t) {
    this._renderEngine = t;
  }
  setCameraStateProvider(t) {
    this._cameraStateProvider = t;
  }
  onFrame(t) {
    this._frameCallbacks.add(t);
  }
  offFrame(t) {
    this._frameCallbacks.delete(t);
  }
  /** Register a pre-frame callback (runs before beginFrame, for tile selection / near-far). */
  onPreFrame(t) {
    this._preFrameCallbacks.add(t);
  }
  offPreFrame(t) {
    this._preFrameCallbacks.delete(t);
  }
  // ─── Dirty State ───
  markDirty() {
    this._dirty = !0;
  }
  get isDirty() {
    return this._dirty;
  }
  // ─── Control ───
  get running() {
    return this._running;
  }
  start() {
    this._running || (this._running = !0, this._firstFrame = !0, this._lastTimestamp = 0, this._fpsLastUpdate = 0, this._scheduleFrame());
  }
  stop() {
    this._running = !1, this._rafId !== null && (this._cancelAnimationFrame(this._rafId), this._rafId = null);
  }
  // ─── Stats ───
  getStats() {
    return {
      fps: this._fps,
      frameDurationMs: this._frameDurationMs,
      totalFrames: this._frameNumber,
      skippedFrames: this._skippedFrames
    };
  }
  // ─── Lifecycle ───
  destroy() {
    this.stop(), this._renderEngine = null, this._cameraStateProvider = null, this._frameCallbacks.clear(), this._preFrameCallbacks.clear();
  }
  // ─── Private ───
  _scheduleFrame() {
    this._running && (this._rafId = this._requestAnimationFrame((t) => {
      this._tick(t);
    }));
  }
  _tick(t) {
    if (!this._running) return;
    if (this._firstFrame) {
      this._firstFrame = !1, this._lastTimestamp = t, this._fpsLastUpdate = t, this._scheduleFrame();
      return;
    }
    const e = t - this._lastTimestamp;
    if (this._minFrameInterval > 0 && e < this._minFrameInterval) {
      this._scheduleFrame();
      return;
    }
    if (this._lastTimestamp = t, !this._dirty) {
      this._skippedFrames++, this._scheduleFrame();
      return;
    }
    this._dirty = !1, this._frameNumber++, this._frameDurationMs = e, this._fpsFrameCount++, this._fpsAccumulator += e, t - this._fpsLastUpdate >= 1e3 && (this._fps = this._fpsAccumulator > 0 ? this._fpsFrameCount / this._fpsAccumulator * 1e3 : 0, this._fpsFrameCount = 0, this._fpsAccumulator = 0, this._fpsLastUpdate = t);
    for (const n of this._preFrameCallbacks)
      try {
        n(e, this._frameNumber);
      } catch (o) {
        console.error("RenderLoop pre-frame callback error:", o);
      }
    if (this._renderEngine && this._cameraStateProvider) {
      const n = this._cameraStateProvider();
      this._renderEngine.beginFrame(n);
    }
    for (const n of this._frameCallbacks)
      try {
        n(e, this._frameNumber);
      } catch (o) {
        console.error("RenderLoop frame callback error:", o);
      }
    this._renderEngine && (this._renderEngine.endFrame(), this._renderEngine.needsContinuousRender && (this._dirty = !0)), this._scheduleFrame();
  }
}
class is {
  _workers = [];
  _maxWorkers;
  _workerFactory;
  _nextTaskId = 0;
  _nextWorkerIndex = 0;
  _pending = /* @__PURE__ */ new Map();
  _initialized = !1;
  constructor(t) {
    this._maxWorkers = t.maxWorkers ?? Math.min(
      (typeof navigator < "u" ? navigator.hardwareConcurrency : 4) / 2,
      4
    ), this._maxWorkers = Math.max(1, Math.floor(this._maxWorkers)), this._workerFactory = t.workerFactory;
  }
  // ─── Lifecycle ───
  /**
   * Initialize the worker pool — creates all worker instances.
   */
  init() {
    if (!this._initialized) {
      for (let t = 0; t < this._maxWorkers; t++) {
        const e = this._workerFactory();
        this._setupWorker(e), this._workers.push(e);
      }
      this._initialized = !0;
    }
  }
  /**
   * Dispatch a task to the next available worker (round-robin).
   */
  dispatch(t, e, n = []) {
    if (!this._initialized || this._workers.length === 0)
      return Promise.reject(new Error("WorkerPool not initialized"));
    const o = this._nextTaskId++, s = this._workers[this._nextWorkerIndex % this._workers.length];
    return this._nextWorkerIndex = (this._nextWorkerIndex + 1) % this._workers.length, new Promise((r, a) => {
      this._pending.set(o, { resolve: r, reject: a });
      const c = { id: o, type: t, data: e };
      s.postMessage(c, n);
    });
  }
  /**
   * Terminate all workers and reject all pending tasks.
   */
  terminate() {
    for (const [, t] of this._pending)
      t.reject(new Error("WorkerPool terminated"));
    this._pending.clear();
    for (const t of this._workers)
      t.onmessage = null, t.onerror = null, t.terminate();
    this._workers = [], this._initialized = !1, this._nextWorkerIndex = 0;
  }
  // ─── Getters ───
  get workerCount() {
    return this._workers.length;
  }
  get pendingCount() {
    return this._pending.size;
  }
  get initialized() {
    return this._initialized;
  }
  // ─── Private ───
  _setupWorker(t) {
    t.onmessage = (e) => {
      const { id: n, result: o, error: s } = e.data, r = this._pending.get(n);
      r && (this._pending.delete(n), s !== void 0 ? r.reject(new Error(s)) : r.resolve(o));
    }, t.onerror = (e) => {
      for (const [n, o] of this._pending)
        o.reject(new Error(`Worker error: ${e.message}`)), this._pending.delete(n);
    };
  }
}
class os {
  _buffers = /* @__PURE__ */ new Map();
  _textures = /* @__PURE__ */ new Map();
  _maxMemoryBytes;
  _now;
  _totalBytes = 0;
  _destroyed = !1;
  /** Callback invoked when a resource is evicted. For testing/monitoring. */
  onEvict = null;
  constructor(t = {}) {
    this._maxMemoryBytes = t.maxMemoryBytes ?? 512 * 1024 * 1024, this._now = t.now ?? (() => Date.now());
  }
  // ─── Buffer Operations ───
  registerBuffer(t, e) {
    if (this._checkDestroyed(), this._buffers.has(t)) return;
    const n = {
      id: t,
      descriptor: e,
      lastAccess: this._now(),
      type: "buffer"
    };
    this._buffers.set(t, n), this._totalBytes += e.byteSize, this._evictIfNeeded();
  }
  releaseBuffer(t) {
    this._checkDestroyed();
    const e = this._buffers.get(t);
    return e ? (this._buffers.delete(t), this._totalBytes -= e.descriptor.byteSize, !0) : !1;
  }
  getBuffer(t) {
    this._checkDestroyed();
    const e = this._buffers.get(t);
    if (e)
      return e.lastAccess = this._now(), e.descriptor;
  }
  // ─── Texture Operations ───
  registerTexture(t, e) {
    if (this._checkDestroyed(), this._textures.has(t)) return;
    const n = {
      id: t,
      descriptor: e,
      lastAccess: this._now(),
      type: "texture"
    };
    this._textures.set(t, n), this._totalBytes += e.byteSize, this._evictIfNeeded();
  }
  releaseTexture(t) {
    this._checkDestroyed();
    const e = this._textures.get(t);
    return e ? (this._textures.delete(t), this._totalBytes -= e.descriptor.byteSize, !0) : !1;
  }
  getTexture(t) {
    this._checkDestroyed();
    const e = this._textures.get(t);
    if (e)
      return e.lastAccess = this._now(), e.descriptor;
  }
  // ─── Memory Info ───
  getMemoryUsage() {
    let t = 0;
    for (const n of this._buffers.values())
      t += n.descriptor.byteSize;
    let e = 0;
    for (const n of this._textures.values())
      e += n.descriptor.byteSize;
    return {
      totalBytes: this._totalBytes,
      bufferBytes: t,
      textureBytes: e,
      bufferCount: this._buffers.size,
      textureCount: this._textures.size
    };
  }
  // ─── Lifecycle ───
  destroy() {
    this._destroyed || (this._buffers.clear(), this._textures.clear(), this._totalBytes = 0, this._destroyed = !0);
  }
  get isDestroyed() {
    return this._destroyed;
  }
  // ─── Private ───
  _checkDestroyed() {
    if (this._destroyed)
      throw new Error("ResourceManager has been destroyed");
  }
  /**
   * Evict oldest (LRU) resources until memory is under the limit.
   */
  _evictIfNeeded() {
    for (; this._totalBytes > this._maxMemoryBytes; ) {
      const t = this._findOldestResource();
      if (!t) break;
      t.type === "buffer" ? this._buffers.delete(t.id) : this._textures.delete(t.id), this._totalBytes -= t.descriptor.byteSize, this.onEvict && this.onEvict(t.id, t.type);
    }
  }
  /**
   * Find the resource with the oldest lastAccess timestamp across all types.
   */
  _findOldestResource() {
    let t = null;
    for (const e of this._buffers.values())
      (!t || e.lastAccess < t.lastAccess) && (t = e);
    for (const e of this._textures.values())
      (!t || e.lastAccess < t.lastAccess) && (t = e);
    return t;
  }
}
const _i = {
  linear: (i) => i,
  easeIn: (i) => i * i,
  easeOut: (i) => i * (2 - i),
  easeInOut: (i) => i < 0.5 ? 2 * i * i : -1 + (4 - 2 * i) * i
};
class ss {
  _animations = /* @__PURE__ */ new Map();
  _nextId = 0;
  /**
   * Start a new animation.
   */
  animate(t) {
    const e = this._nextId++;
    let n;
    typeof t.easing == "function" ? n = t.easing : n = _i[t.easing ?? "linear"];
    const o = {
      id: e,
      from: t.from,
      to: t.to,
      duration: t.duration,
      easing: n,
      onUpdate: t.onUpdate,
      onComplete: t.onComplete,
      startTime: null,
      done: !1
    };
    return this._animations.set(e, o), {
      id: e,
      cancel: () => this.cancel(e),
      get done() {
        return o.done;
      }
    };
  }
  /**
   * Cancel an active animation.
   */
  cancel(t) {
    const e = this._animations.get(t);
    e && (e.done = !0, this._animations.delete(t));
  }
  /**
   * Update all active animations. Called from RenderLoop on each frame.
   * @param timestamp Current time in milliseconds (e.g., performance.now())
   */
  update(t) {
    for (const [e, n] of this._animations) {
      n.startTime === null && (n.startTime = t);
      const o = t - n.startTime, s = n.duration > 0 ? Math.min(o / n.duration, 1) : 1, r = n.easing(s), a = n.from + (n.to - n.from) * r;
      n.onUpdate(a, s), s >= 1 && (n.done = !0, this._animations.delete(e), n.onComplete && n.onComplete());
    }
  }
  /**
   * Cancel all active animations.
   */
  cancelAll() {
    for (const t of this._animations.values())
      t.done = !0;
    this._animations.clear();
  }
  /**
   * Number of currently active animations.
   */
  get activeCount() {
    return this._animations.size;
  }
  /**
   * Clean up all animations.
   */
  destroy() {
    this.cancelAll();
  }
}
class mi {
  _undoStack = [];
  _redoStack = [];
  _maxHistorySize;
  _events = new ct();
  constructor(t = {}) {
    this._maxHistorySize = t.maxHistorySize ?? 50;
  }
  /**
   * Execute a command and push it onto the undo stack.
   * Clears the redo stack (new action invalidates redo history).
   */
  execute(t) {
    for (t.execute(), this._undoStack.push(t), this._redoStack = []; this._undoStack.length > this._maxHistorySize; )
      this._undoStack.shift();
    this._events.emit("command-executed", { command: t });
  }
  /**
   * Undo the last executed command.
   * Returns true if an undo was performed, false if nothing to undo.
   */
  undo() {
    const t = this._undoStack.pop();
    return t ? (t.undo(), this._redoStack.push(t), this._events.emit("command-undone", { command: t }), !0) : !1;
  }
  /**
   * Redo the last undone command.
   * Returns true if a redo was performed, false if nothing to redo.
   */
  redo() {
    const t = this._redoStack.pop();
    return t ? (t.execute(), this._undoStack.push(t), this._events.emit("command-redone", { command: t }), !0) : !1;
  }
  /**
   * Can we undo?
   */
  get canUndo() {
    return this._undoStack.length > 0;
  }
  /**
   * Can we redo?
   */
  get canRedo() {
    return this._redoStack.length > 0;
  }
  /**
   * Number of commands in the undo stack.
   */
  get undoCount() {
    return this._undoStack.length;
  }
  /**
   * Number of commands in the redo stack.
   */
  get redoCount() {
    return this._redoStack.length;
  }
  /**
   * Clear all history.
   */
  clear() {
    this._undoStack = [], this._redoStack = [];
  }
  // ─── Events ───
  on(t, e) {
    this._events.on(t, e);
  }
  off(t, e) {
    this._events.off(t, e);
  }
  // ─── Lifecycle ───
  destroy() {
    this.clear(), this._events.removeAll();
  }
}
class rs {
  _windowSize;
  _droppedFrameThreshold;
  /** Circular buffer for rolling window */
  _frameTimes;
  /** Current write position in the circular buffer */
  _writeIndex = 0;
  /** Number of samples currently in the buffer (up to windowSize) */
  _sampleCount = 0;
  _totalFrames = 0;
  _droppedFrames = 0;
  constructor(t = {}) {
    this._windowSize = t.windowSize ?? 120, this._droppedFrameThreshold = t.droppedFrameThreshold ?? 33.33, this._frameTimes = new Array(this._windowSize).fill(0);
  }
  /**
   * Record a frame duration. Called at the end of each frame.
   * @param frameDurationMs Duration of the frame in milliseconds
   */
  record(t) {
    this._frameTimes[this._writeIndex] = t, this._writeIndex = (this._writeIndex + 1) % this._windowSize, this._sampleCount < this._windowSize && this._sampleCount++, this._totalFrames++, t > this._droppedFrameThreshold && this._droppedFrames++;
  }
  /**
   * Get current diagnostic statistics.
   */
  getStats() {
    if (this._sampleCount === 0)
      return {
        fps: 0,
        avgFrameTime: 0,
        p95FrameTime: 0,
        totalFrames: 0,
        droppedFrames: 0
      };
    const t = this._getActiveSamples();
    let e = 0;
    for (const c of t)
      e += c;
    const n = e / t.length, o = n > 0 ? 1e3 / n : 0, s = t.slice().sort((c, h) => c - h), r = Math.ceil(s.length * 0.95) - 1, a = s[Math.max(0, r)];
    return {
      fps: o,
      avgFrameTime: n,
      p95FrameTime: a,
      totalFrames: this._totalFrames,
      droppedFrames: this._droppedFrames
    };
  }
  /**
   * Reset all statistics and the rolling window.
   */
  reset() {
    this._frameTimes.fill(0), this._writeIndex = 0, this._sampleCount = 0, this._totalFrames = 0, this._droppedFrames = 0;
  }
  // ─── Private ───
  /**
   * Extract the active samples from the circular buffer.
   */
  _getActiveSamples() {
    return this._sampleCount < this._windowSize ? this._frameTimes.slice(0, this._sampleCount) : this._frameTimes.slice();
  }
}
class ee {
  id;
  type;
  _visible;
  _dirty = !0;
  _transform;
  _parent = null;
  _children = [];
  _data;
  constructor(t) {
    this.id = t.id, this.type = t.type, this._visible = t.visible ?? !0, this._transform = {
      position: t.transform?.position ?? [0, 0, 0],
      scale: t.transform?.scale ?? [1, 1, 1],
      rotation: t.transform?.rotation ?? [0, 0, 0, 1]
    }, this._data = t.data ?? {};
  }
  // ─── Getters ───
  get visible() {
    return this._visible;
  }
  get dirty() {
    return this._dirty;
  }
  get transform() {
    return this._transform;
  }
  get parent() {
    return this._parent;
  }
  get children() {
    return this._children;
  }
  get data() {
    return this._data;
  }
  /** Whether this node and all ancestors are visible */
  get effectiveVisible() {
    return this._visible ? this._parent ? this._parent.effectiveVisible : !0 : !1;
  }
  // ─── Setters ───
  setVisible(t) {
    this._visible !== t && (this._visible = t, this._markDirty());
  }
  setTransform(t) {
    t.position && (this._transform.position = [...t.position]), t.scale && (this._transform.scale = [...t.scale]), t.rotation && (this._transform.rotation = [...t.rotation]), this._markDirty();
  }
  setData(t, e) {
    this._data[t] = e;
  }
  // ─── Tree Operations (used by SceneGraph) ───
  /** @internal */
  _setParent(t) {
    this._parent = t;
  }
  /** @internal */
  _addChild(t) {
    this._children.push(t);
  }
  /** @internal */
  _removeChild(t) {
    const e = this._children.findIndex((o) => o.id === t);
    if (e === -1) return;
    const [n] = this._children.splice(e, 1);
    return n;
  }
  // ─── Dirty Tracking ───
  clearDirty() {
    this._dirty = !1;
  }
  _markDirty() {
    this._dirty = !0, this._parent && this._parent._markDirtyFromChild();
  }
  /** @internal — called by child nodes */
  _markDirtyFromChild() {
    this._dirty || (this._dirty = !0, this._parent && this._parent._markDirtyFromChild());
  }
}
class as {
  _root;
  _nodeMap = /* @__PURE__ */ new Map();
  constructor() {
    this._root = new ee({ id: "__root__", type: "root" }), this._nodeMap.set(this._root.id, this._root);
  }
  /** The root node of the scene graph */
  get root() {
    return this._root;
  }
  /** Total number of nodes (including root) */
  get nodeCount() {
    return this._nodeMap.size;
  }
  // ─── Node Operations ───
  /**
   * Add a node as a child of the given parent.
   * If parentId is null, adds to root.
   * Returns the added node, or null if parent not found or duplicate id.
   */
  addNode(t, e) {
    if (this._nodeMap.has(e.id)) return null;
    const n = t ? this._nodeMap.get(t) : this._root;
    if (!n) return null;
    const o = new ee(e);
    return o._setParent(n), n._addChild(o), this._nodeMap.set(o.id, o), o;
  }
  /**
   * Remove a node and all its descendants from the graph.
   * Cannot remove root.
   * Returns true if the node was found and removed.
   */
  removeNode(t) {
    if (t === this._root.id) return !1;
    const e = this._nodeMap.get(t);
    if (!e) return !1;
    this._removeDescendants(e);
    const n = e.parent;
    return n && n._removeChild(t), e._setParent(null), this._nodeMap.delete(t), n && n._markDirtyFromChild(), !0;
  }
  /**
   * Find a node by its id.
   */
  findNode(t) {
    return this._nodeMap.get(t);
  }
  // ─── Traversal ───
  /**
   * Depth-first traversal of the scene graph.
   * Callback receives each node. Return false from callback to skip children.
   */
  traverse(t, e) {
    const n = e ?? this._root;
    this._dfs(n, t);
  }
  /**
   * Collect all visible nodes (nodes where effectiveVisible is true).
   * Does not include the root node.
   */
  getVisibleNodes() {
    const t = [];
    return this.traverse((e) => {
      if (e !== this._root) {
        if (!e.visible) return !1;
        t.push(e);
      }
    }), t;
  }
  /**
   * Collect all dirty nodes.
   */
  getDirtyNodes() {
    const t = [];
    return this.traverse((e) => {
      e.dirty && e !== this._root && t.push(e);
    }), t;
  }
  /**
   * Clear dirty flags on all nodes.
   */
  clearAllDirty() {
    this.traverse((t) => {
      t.clearDirty();
    });
  }
  // ─── Lifecycle ───
  destroy() {
    this._nodeMap.clear(), this._root = new ee({ id: "__root__", type: "root" }), this._nodeMap.set(this._root.id, this._root);
  }
  // ─── Private ───
  _dfs(t, e) {
    if (e(t) !== !1)
      for (const o of t.children)
        this._dfs(o, e);
  }
  _removeDescendants(t) {
    for (const e of [...t.children])
      this._removeDescendants(e), this._nodeMap.delete(e.id);
  }
}
function xn(i) {
  return {
    m0: i[0] ?? 0,
    m1: i[1] ?? 0,
    m2: i[2] ?? 0,
    m3: i[3] ?? 0,
    m4: i[4] ?? 0,
    m5: i[5] ?? 0,
    m6: i[6] ?? 0,
    m7: i[7] ?? 0,
    m8: i[8] ?? 0,
    m9: i[9] ?? 0,
    m10: i[10] ?? 0,
    m11: i[11] ?? 0,
    m12: i[12] ?? 0,
    m13: i[13] ?? 0,
    m14: i[14] ?? 0,
    m15: i[15] ?? 0
  };
}
class cs {
  _planes = [];
  /**
   * Extract the 6 frustum planes from a combined view-projection matrix.
   * Matrix must be column-major (WebGPU/OpenGL convention).
   *
   * The planes point inward (a point is visible if it is on the positive side
   * of all six planes).
   */
  extractPlanes(t) {
    const { m0: e, m1: n, m2: o, m3: s, m4: r, m5: a, m6: c, m7: h, m8: d, m9: l, m10: u, m11: f, m12: _, m13: p, m14: m, m15: x } = xn(t), y = V({
      a: s + e,
      b: h + r,
      c: f + d,
      d: x + _
    }), g = V({
      a: s - e,
      b: h - r,
      c: f - d,
      d: x - _
    }), v = V({
      a: s + n,
      b: h + a,
      c: f + l,
      d: x + p
    }), L = V({
      a: s - n,
      b: h - a,
      c: f - l,
      d: x - p
    }), M = V({
      a: o,
      b: c,
      c: u,
      d: m
    }), b = V({
      a: s - o,
      b: h - c,
      c: f - u,
      d: x - m
    });
    return this._planes = [y, g, v, L, M, b], { left: y, right: g, bottom: v, top: L, near: M, far: b };
  }
  /**
   * Test whether an AABB is visible within the frustum.
   * Returns 'inside', 'outside', or 'intersecting'.
   */
  isBoxVisible(t) {
    return gi(t, this._planes);
  }
  /**
   * Test whether a bounding sphere is visible within the frustum.
   * Returns 'inside', 'outside', or 'intersecting'.
   */
  isSphereVisible(t, e) {
    return yi(t, e, this._planes);
  }
  /**
   * Get the currently cached planes (call extractPlanes first).
   */
  get planes() {
    return this._planes;
  }
}
function pi(i) {
  const { m0: t, m1: e, m2: n, m3: o, m4: s, m5: r, m6: a, m7: c, m8: h, m9: d, m10: l, m11: u, m12: f, m13: _, m14: p, m15: m } = xn(i);
  return [
    // Left:   row3 + row0  (x ≥ -w)
    V({ a: o + t, b: c + s, c: u + h, d: m + f }),
    // Right:  row3 - row0  (x ≤ w)
    V({ a: o - t, b: c - s, c: u - h, d: m - f }),
    // Bottom: row3 + row1  (y ≥ -w)
    V({ a: o + e, b: c + r, c: u + d, d: m + _ }),
    // Top:    row3 - row1  (y ≤ w)
    V({ a: o - e, b: c - r, c: u - d, d: m - _ }),
    // Near:   row2 alone   (z ≥ 0) — WebGPU clip: 0 ≤ z, NOT -w ≤ z
    V({ a: n, b: a, c: l, d: p }),
    // Far:    row3 - row2  (z ≤ w)
    V({ a: o - n, b: c - a, c: u - l, d: m - p })
  ];
}
function gi(i, t) {
  let e = !0;
  for (const n of t) {
    const o = n.a >= 0 ? i.maxX : i.minX, s = n.b >= 0 ? i.maxY : i.minY, r = n.c >= 0 ? i.maxZ : i.minZ, a = n.a >= 0 ? i.minX : i.maxX, c = n.b >= 0 ? i.minY : i.maxY, h = n.c >= 0 ? i.minZ : i.maxZ;
    if (n.a * o + n.b * s + n.c * r + n.d < 0) return "outside";
    n.a * a + n.b * c + n.c * h + n.d < 0 && (e = !1);
  }
  return e ? "inside" : "intersecting";
}
function yi(i, t, e) {
  let n = !0;
  for (const o of e) {
    const s = o.a * i[0] + o.b * i[1] + o.c * i[2] + o.d;
    if (s < -t) return "outside";
    s < t && (n = !1);
  }
  return n ? "inside" : "intersecting";
}
function V(i) {
  const t = Math.sqrt(i.a * i.a + i.b * i.b + i.c * i.c);
  return t < 1e-15 ? i : {
    a: i.a / t,
    b: i.b / t,
    c: i.c / t,
    d: i.d / t
  };
}
const xi = async (i) => {
  const t = await fetch(i, { mode: "cors" });
  if (!t.ok) throw new Error(`Tile fetch failed: ${t.status} ${i}`);
  const e = await t.blob();
  return createImageBitmap(e);
};
class vi {
  _tileScheduler;
  _maxCacheEntries;
  _maxConcurrent;
  _fetcher;
  /** GPU texture cache: key → CacheEntry */
  _cache = /* @__PURE__ */ new Map();
  /** Şu anda devam eden fetch'ler (key → Promise) */
  _inFlight = /* @__PURE__ */ new Map();
  /** Render engine referansı (texture oluşturmak için) */
  _renderEngine = null;
  /** Yeni tile'lar hazır olduğunda çağrılacak callback */
  onDirty = null;
  /** Destroy edildi mi? */
  _destroyed = !1;
  constructor(t) {
    this._tileScheduler = t.tileScheduler, this._maxCacheEntries = t.maxCacheEntries ?? 512, this._maxConcurrent = t.maxConcurrent ?? 6, this._fetcher = t.fetcher ?? xi;
  }
  // ─── Public API ───
  /**
   * Set the render engine used for GPU texture creation.
   */
  setRenderEngine(t) {
    this._renderEngine = t;
  }
  /**
   * Get tiles that are ready (cached) for the given extent, zoom, and sources.
   *
   * Called each frame. For tiles not yet cached, background fetches are started
   * (respecting the concurrency limit). Only already-cached tiles are returned.
   *
   * @param extent - Visible extent in EPSG:3857
   * @param zoom   - Current integer zoom level
   * @param sources - Tile source descriptors
   * @returns Array of ImageryTile objects ready for rendering
   */
  getReadyTiles(t, e, n) {
    if (this._destroyed) return [];
    const o = Date.now(), s = /* @__PURE__ */ new Set(), r = [], a = [];
    for (let c = 0; c < n.length; c++) {
      const h = n[c], d = Math.max(h.minZoom, Math.min(h.maxZoom, Math.round(e))), l = this._tileScheduler.getTilesForExtent(t, d);
      for (const u of l) {
        const f = `${h.sourceId}/${u.z}/${u.x}/${u.y}`, _ = this._cache.get(f);
        if (_)
          _.lastUsed = o, a.push({
            texture: _.texture,
            extent: _.extent,
            opacity: _.opacity,
            filters: h.filters
          });
        else {
          this._startFetch(f, h, u.z, u.x, u.y);
          let p = u.z - 1, m = Math.floor(u.x / 2), x = Math.floor(u.y / 2);
          for (; p >= h.minZoom; ) {
            const y = `${h.sourceId}/${p}/${m}/${x}`, g = this._cache.get(y);
            if (g) {
              s.has(y) || (s.add(y), g.lastUsed = o, r.push({
                texture: g.texture,
                extent: g.extent,
                opacity: g.opacity,
                filters: h.filters
              }));
              break;
            }
            p--, m = Math.floor(m / 2), x = Math.floor(x / 2);
          }
        }
      }
    }
    return this._evictIfNeeded(), [...r, ...a];
  }
  /**
   * Get tiles that are ready for a pre-computed list of tile coordinates.
   *
   * Used by GlobeView where tile selection is done by GlobeTileCovering
   * rather than by TileScheduler.getTilesForExtent().
   *
   * Parent tile fallback: when a tile isn't cached yet, walks up the zoom tree
   * to find a cached ancestor tile. This prevents black flashes during zoom changes.
   */
  getReadyTilesForCoords(t, e) {
    if (this._destroyed) return [];
    const n = Date.now(), o = /* @__PURE__ */ new Set(), s = [], r = [];
    for (let a = 0; a < e.length; a++) {
      const c = e[a];
      for (const h of t) {
        if (Math.max(c.minZoom, Math.min(c.maxZoom, h.z)) !== h.z) continue;
        const l = `${c.sourceId}/${h.z}/${h.x}/${h.y}`, u = this._cache.get(l);
        if (u)
          u.lastUsed = n, r.push({
            texture: u.texture,
            extent: u.extent,
            opacity: u.opacity,
            filters: c.filters
          });
        else {
          this._startFetch(l, c, h.z, h.x, h.y);
          let f = h.z - 1, _ = Math.floor(h.x / 2), p = Math.floor(h.y / 2);
          for (; f >= c.minZoom; ) {
            const m = `${c.sourceId}/${f}/${_}/${p}`, x = this._cache.get(m);
            if (x) {
              o.has(m) || (o.add(m), x.lastUsed = n, s.push({
                texture: x.texture,
                extent: x.extent,
                opacity: x.opacity,
                filters: c.filters,
                depthBias: 2e-3
              }));
              break;
            }
            f--, _ = Math.floor(_ / 2), p = Math.floor(p / 2);
          }
        }
      }
    }
    return this._evictIfNeeded(), [...s, ...r];
  }
  /**
   * Drop all cached tiles and cancel in-flight requests.
   * Useful when render resources are recreated (e.g. depth/pipeline reset).
   */
  invalidateAll() {
    if (!this._destroyed) {
      for (const t of this._cache.values())
        this._renderEngine?.releaseTexture(t.texture);
      this._cache.clear(), this._inFlight.clear();
    }
  }
  /**
   * Invalidate cached tiles and cancel in-flight requests for a specific source.
   *
   * Called when a tile layer is removed from the map. Frees GPU textures
   * and concurrency slots so replacement layers can fetch immediately.
   */
  invalidateSource(t) {
    if (this._destroyed) return;
    const e = `${t}/`;
    for (const [n, o] of this._cache)
      n.startsWith(e) && (this._renderEngine?.releaseTexture(o.texture), this._cache.delete(n));
    for (const n of this._inFlight.keys())
      n.startsWith(e) && this._inFlight.delete(n);
  }
  /**
   * Release all cached textures and cancel pending fetches.
   */
  destroy() {
    this._destroyed = !0;
    for (const t of this._cache.values())
      this._renderEngine && this._renderEngine.releaseTexture(t.texture);
    this._cache.clear(), this._inFlight.clear(), this._renderEngine = null, this.onDirty = null;
  }
  // ─── Getters (test/debug amaçlı) ───
  /** Number of entries currently in the cache */
  get cacheSize() {
    return this._cache.size;
  }
  /** Number of currently in-flight fetch requests */
  get inFlightCount() {
    return this._inFlight.size;
  }
  // ─── Private Methods ───
  /**
   * Belirtilen tile için arka planda fetch başlat.
   * Eşzamanlılık limiti ve tekrarlı fetch'ler kontrol edilir.
   */
  _startFetch(t, e, n, o, s) {
    if (this._inFlight.has(t) || this._inFlight.size >= this._maxConcurrent) return;
    const r = e.getTileUrl(n, o, s), a = this._fetchAndCache(t, r, e, n, o, s);
    this._inFlight.set(t, a), a.finally(() => {
      this._inFlight.delete(t);
    });
  }
  /**
   * Tek bir tile'ı fetch et, texture oluştur ve cache'e ekle.
   */
  async _fetchAndCache(t, e, n, o, s, r) {
    try {
      const a = await this._fetcher(e);
      if (this._destroyed || !this._renderEngine) return;
      const c = this._renderEngine.createTexture(a), h = this._tileScheduler.tileToExtent(o, s, r), d = [
        h.minX,
        h.minY,
        h.maxX,
        h.maxY
      ];
      this._cache.set(t, {
        texture: c,
        extent: d,
        opacity: n.opacity,
        lastUsed: Date.now()
      }), this.onDirty?.();
    } catch {
    }
  }
  /**
   * Cache boyutu maxCacheEntries'i aşıyorsa en az kullanılan girdileri sil.
   */
  _evictIfNeeded() {
    if (this._cache.size <= this._maxCacheEntries) return;
    const t = [...this._cache.entries()].sort(
      (n, o) => n[1].lastUsed - o[1].lastUsed
    ), e = this._cache.size - this._maxCacheEntries;
    for (let n = 0; n < e; n++) {
      const [o, s] = t[n];
      this._renderEngine && this._renderEngine.releaseTexture(s.texture), this._cache.delete(o);
    }
  }
}
class Mi {
  _maxHeightCacheEntries;
  _maxHillshadeCacheEntries;
  _maxConcurrent;
  _heightCache = /* @__PURE__ */ new Map();
  _hillshadeCache = /* @__PURE__ */ new Map();
  _inFlight = /* @__PURE__ */ new Map();
  _renderEngine = null;
  _destroyed = !1;
  _activeLayerId = null;
  _pendingQueue = [];
  _pendingKeys = /* @__PURE__ */ new Set();
  onDirty = null;
  constructor(t = {}) {
    this._maxHeightCacheEntries = t.maxHeightCacheEntries ?? 256, this._maxHillshadeCacheEntries = t.maxHillshadeCacheEntries ?? 256, this._maxConcurrent = t.maxConcurrent ?? 8;
  }
  setRenderEngine(t) {
    this._renderEngine = t;
  }
  setActiveLayer(t) {
    this._activeLayerId !== t && (this._activeLayerId = t, this._pruneCachesForActiveLayer());
  }
  requestTiles(t, e) {
    if (!this._destroyed) {
      this.setActiveLayer(t.id);
      for (const n of e) {
        const o = this._normalizeRequestCoord(t, n);
        if (!o) continue;
        const { z: s, x: r, y: a } = o;
        this._materializeHeightIfReady(t, s, r, a), this._materializeHillshadeIfReady(t, s, r, a), this._startRequest(t, s, r, a);
      }
    }
  }
  getReadyHeightTile(t, e, n, o) {
    if (this._destroyed || e < t.minZoom) return null;
    this.setActiveLayer(t.id);
    let s = e, r = n, a = o;
    if (s > t.maxZoom) {
      const h = 1 << s - t.maxZoom;
      r = Math.floor(r / h), a = Math.floor(a / h), s = t.maxZoom;
    }
    for (; s >= t.minZoom; ) {
      const c = this._getOrMaterializeHeight(t, s, r, a);
      if (c)
        return c.lastUsed = Date.now(), {
          texture: c.texture,
          sourceCoord: c.coord,
          uvOffsetScale: this._computeUvOffsetScale(
            e,
            n,
            o,
            c.coord.z,
            c.coord.x,
            c.coord.y
          )
        };
      s -= 1, r = Math.floor(r / 2), a = Math.floor(a / 2);
    }
    return null;
  }
  getReadyHillshadeTile(t, e, n, o) {
    if (this._destroyed || e < t.minZoom) return null;
    this.setActiveLayer(t.id);
    let s = e, r = n, a = o;
    if (s > t.maxZoom) {
      const h = 1 << s - t.maxZoom;
      r = Math.floor(r / h), a = Math.floor(a / h), s = t.maxZoom;
    }
    for (; s >= t.minZoom; ) {
      const c = this._getOrMaterializeHillshade(t, s, r, a);
      if (c)
        return c.lastUsed = Date.now(), {
          texture: c.texture,
          sourceCoord: c.coord
        };
      s -= 1, r = Math.floor(r / 2), a = Math.floor(a / 2);
    }
    return null;
  }
  invalidateLayer(t) {
    if (!this._destroyed) {
      this._invalidateCachesForLayer(t);
      for (const e of this._inFlight.keys())
        this._layerIdFromKey(e) === t && this._inFlight.delete(e);
      this._clearPendingForLayer(t);
    }
  }
  invalidateAll() {
    this._destroyed || (this._releaseCache(this._heightCache), this._releaseCache(this._hillshadeCache), this._inFlight.clear(), this._pendingQueue.length = 0, this._pendingKeys.clear());
  }
  destroy() {
    this._destroyed || (this._destroyed = !0, this._releaseCache(this._heightCache), this._releaseCache(this._hillshadeCache), this._inFlight.clear(), this._pendingQueue.length = 0, this._pendingKeys.clear(), this._renderEngine = null, this.onDirty = null, this._activeLayerId = null);
  }
  get heightCacheSize() {
    return this._heightCache.size;
  }
  get hillshadeCacheSize() {
    return this._hillshadeCache.size;
  }
  get inFlightCount() {
    return this._inFlight.size;
  }
  _startRequest(t, e, n, o) {
    const s = this._cacheKey(t.id, e, n, o);
    if (!this._inFlight.has(s) && !this._pendingKeys.has(s)) {
      if (this._inFlight.size >= this._maxConcurrent) {
        this._pendingQueue.length < 64 && (this._pendingQueue.push({ layer: t, z: e, x: n, y: o }), this._pendingKeys.add(s));
        return;
      }
      this._executeRequest(t, e, n, o, s);
    }
  }
  _executeRequest(t, e, n, o, s) {
    const r = Promise.resolve().then(async () => {
      if (await t.requestTile(e, n, o), this._destroyed || this._activeLayerId !== t.id) return;
      const a = this._materializeHeightIfReady(t, e, n, o), c = this._materializeHillshadeIfReady(t, e, n, o);
      (a || c) && this.onDirty?.();
    }).catch(() => {
    }).finally(() => {
      this._inFlight.delete(s), this._drainQueue();
    });
    this._inFlight.set(s, r);
  }
  _drainQueue() {
    for (; this._pendingQueue.length > 0 && this._inFlight.size < this._maxConcurrent; ) {
      const t = this._pendingQueue.shift(), e = this._cacheKey(t.layer.id, t.z, t.x, t.y);
      this._pendingKeys.delete(e), !this._inFlight.has(e) && this._activeLayerId === t.layer.id && (this._heightCache.has(e) || this._executeRequest(t.layer, t.z, t.x, t.y, e));
    }
  }
  _normalizeRequestCoord(t, e) {
    if (e.z < t.minZoom) return null;
    if (e.z <= t.maxZoom) return e;
    const o = 1 << e.z - t.maxZoom;
    return {
      z: t.maxZoom,
      x: Math.floor(e.x / o),
      y: Math.floor(e.y / o)
    };
  }
  _cacheKey(t, e, n, o) {
    return `${t}|${e}/${n}/${o}`;
  }
  _layerIdFromKey(t) {
    const e = t.indexOf("|");
    return e < 0 ? t : t.slice(0, e);
  }
  _materializeHeightIfReady(t, e, n, o) {
    return this._getOrMaterializeHeight(t, e, n, o) !== null;
  }
  _materializeHillshadeIfReady(t, e, n, o) {
    return this._getOrMaterializeHillshade(t, e, n, o) !== null;
  }
  _getOrMaterializeHeight(t, e, n, o) {
    const s = this._cacheKey(t.id, e, n, o), r = this._heightCache.get(s);
    if (r) return r;
    if (!this._renderEngine) return null;
    const a = t.getReadyHeightTile(e, n, o);
    if (!a) return null;
    const c = this._createHeightEntry(a);
    return this._heightCache.set(s, c), this._evictIfNeeded(this._heightCache, this._maxHeightCacheEntries), c;
  }
  _getOrMaterializeHillshade(t, e, n, o) {
    const s = this._cacheKey(t.id, e, n, o), r = this._hillshadeCache.get(s);
    if (r) return r;
    if (!this._renderEngine) return null;
    const a = t.getReadyHillshadeTile(e, n, o);
    if (!a) return null;
    const c = this._createHillshadeEntry(a);
    return this._hillshadeCache.set(s, c), this._evictIfNeeded(this._hillshadeCache, this._maxHillshadeCacheEntries), c;
  }
  _createHeightEntry(t) {
    if (!this._renderEngine) throw new Error("TerrainTileManager render engine is not set");
    return {
      texture: this._renderEngine.createFloat32Texture(t.data, t.width, t.height),
      coord: { z: t.z, x: t.x, y: t.y },
      lastUsed: Date.now()
    };
  }
  _createHillshadeEntry(t) {
    if (!this._renderEngine) throw new Error("TerrainTileManager render engine is not set");
    let e = t.data;
    return t.data.length === t.width * t.height && (e = this._expandGrayToRgba(t.data)), {
      texture: this._renderEngine.createRGBA8Texture(e, t.width, t.height),
      coord: { z: t.z, x: t.x, y: t.y },
      lastUsed: Date.now()
    };
  }
  _expandGrayToRgba(t) {
    const e = new Uint8Array(t.length * 4);
    for (let n = 0; n < t.length; n++) {
      const o = t[n] ?? 0, s = n * 4;
      e[s] = o, e[s + 1] = o, e[s + 2] = o, e[s + 3] = 255;
    }
    return e;
  }
  _computeUvOffsetScale(t, e, n, o, s, r) {
    if (o >= t) return [0, 0, 1, 1];
    const c = 1 << t - o, h = 1 / c, d = (e - s * c) * h, l = (n - r * c) * h;
    return [d, l, h, h];
  }
  _evictIfNeeded(t, e) {
    if (!this._renderEngine || t.size <= e) return;
    const n = [...t.entries()].sort((s, r) => s[1].lastUsed - r[1].lastUsed), o = t.size - e;
    for (let s = 0; s < o; s++) {
      const r = n[s];
      if (!r) break;
      t.delete(r[0]), this._renderEngine.releaseTexture(r[1].texture);
    }
  }
  _pruneCachesForActiveLayer() {
    if (this._renderEngine) {
      for (const t of [...this._heightCache.keys()]) {
        if (this._layerIdFromKey(t) === this._activeLayerId) continue;
        const e = this._heightCache.get(t);
        e && (this._heightCache.delete(t), this._renderEngine.releaseTexture(e.texture));
      }
      for (const t of [...this._hillshadeCache.keys()]) {
        if (this._layerIdFromKey(t) === this._activeLayerId) continue;
        const e = this._hillshadeCache.get(t);
        e && (this._hillshadeCache.delete(t), this._renderEngine.releaseTexture(e.texture));
      }
    }
  }
  _clearPendingForLayer(t) {
    for (let e = this._pendingQueue.length - 1; e >= 0; e--) {
      const n = this._pendingQueue[e];
      if (n && n.layer.id === t) {
        const o = this._cacheKey(n.layer.id, n.z, n.x, n.y);
        this._pendingKeys.delete(o), this._pendingQueue.splice(e, 1);
      }
    }
  }
  _invalidateCachesForLayer(t) {
    if (this._renderEngine) {
      for (const e of [...this._heightCache.keys()]) {
        if (this._layerIdFromKey(e) !== t) continue;
        const n = this._heightCache.get(e);
        n && (this._heightCache.delete(e), this._renderEngine.releaseTexture(n.texture));
      }
      for (const e of [...this._hillshadeCache.keys()]) {
        if (this._layerIdFromKey(e) !== t) continue;
        const n = this._hillshadeCache.get(e);
        n && (this._hillshadeCache.delete(e), this._renderEngine.releaseTexture(n.texture));
      }
    }
  }
  _releaseCache(t) {
    if (this._renderEngine)
      for (const e of t.values())
        this._renderEngine.releaseTexture(e.texture);
    t.clear();
  }
}
class bi {
  _element;
  _camera;
  _onDirty;
  _onViewChange;
  // Feature flags
  _panEnabled;
  _zoomEnabled;
  _keyboardEnabled;
  _doubleClickZoom;
  _zoomSpeed;
  _inertiaDuration;
  // Pan state
  _dragging = !1;
  _lastPointerX = 0;
  _lastPointerY = 0;
  _activePointerId = null;
  // Pinch zoom state
  _pointers = /* @__PURE__ */ new Map();
  _lastPinchDist = 0;
  _lastPinchCenterX = 0;
  _lastPinchCenterY = 0;
  // Inertia state
  _velocityX = 0;
  _velocityY = 0;
  _lastMoveTime = 0;
  _inertiaRafId = null;
  // Double-click detection
  _lastClickTime = 0;
  _lastClickX = 0;
  _lastClickY = 0;
  // Bound handlers (for cleanup)
  _onPointerDown;
  _onPointerMove;
  _onPointerUp;
  _onWheel;
  _onKeyDown;
  _onContextMenu;
  _destroyed = !1;
  constructor(t, e, n, o, s = {}) {
    this._element = t, this._camera = e, this._onDirty = n, this._onViewChange = o, this._panEnabled = s.pan ?? !0, this._zoomEnabled = s.zoom ?? !0, this._keyboardEnabled = s.keyboard ?? !0, this._doubleClickZoom = s.doubleClickZoom ?? !0, this._zoomSpeed = s.zoomSpeed ?? 1, this._inertiaDuration = s.inertiaDuration ?? 300, this._onPointerDown = this._handlePointerDown.bind(this), this._onPointerMove = this._handlePointerMove.bind(this), this._onPointerUp = this._handlePointerUp.bind(this), this._onWheel = this._handleWheel.bind(this), this._onKeyDown = this._handleKeyDown.bind(this), this._onContextMenu = (r) => r.preventDefault(), this._attach();
  }
  // ─── Lifecycle ───
  destroy() {
    this._destroyed || (this._destroyed = !0, this._stopInertia(), this._detach());
  }
  // ─── Private: Attach / Detach ───
  _attach() {
    const t = this._element;
    t.addEventListener("pointerdown", this._onPointerDown), t.addEventListener("pointermove", this._onPointerMove), t.addEventListener("pointerup", this._onPointerUp), t.addEventListener("pointercancel", this._onPointerUp), t.addEventListener("wheel", this._onWheel, { passive: !1 }), t.addEventListener("contextmenu", this._onContextMenu), this._keyboardEnabled && (t.getAttribute("tabindex") || t.setAttribute("tabindex", "0"), t.addEventListener("keydown", this._onKeyDown)), t.style.touchAction = "none";
  }
  _detach() {
    const t = this._element;
    t.removeEventListener("pointerdown", this._onPointerDown), t.removeEventListener("pointermove", this._onPointerMove), t.removeEventListener("pointerup", this._onPointerUp), t.removeEventListener("pointercancel", this._onPointerUp), t.removeEventListener("wheel", this._onWheel), t.removeEventListener("contextmenu", this._onContextMenu), t.removeEventListener("keydown", this._onKeyDown);
  }
  // ─── Pointer Handlers ───
  _handlePointerDown(t) {
    if (this._destroyed) return;
    const e = t.target;
    if (!(e && e !== this._element && e.tagName !== "CANVAS"))
      if (this._pointers.set(t.pointerId, { x: t.clientX, y: t.clientY }), this._element.setPointerCapture(t.pointerId), this._stopInertia(), this._pointers.size === 1) {
        if (!this._panEnabled) return;
        if (this._dragging = !0, this._activePointerId = t.pointerId, this._lastPointerX = t.clientX, this._lastPointerY = t.clientY, this._velocityX = 0, this._velocityY = 0, this._lastMoveTime = performance.now(), this._doubleClickZoom) {
          const n = performance.now(), o = n - this._lastClickTime, s = t.clientX - this._lastClickX, r = t.clientY - this._lastClickY;
          if (o < 300 && Math.abs(s) < 5 && Math.abs(r) < 5) {
            this._handleDoubleClick(t.clientX, t.clientY), this._lastClickTime = 0;
            return;
          }
          this._lastClickTime = n, this._lastClickX = t.clientX, this._lastClickY = t.clientY;
        }
      } else this._pointers.size === 2 && (this._dragging = !1, this._initPinch());
  }
  _handlePointerMove(t) {
    if (this._destroyed) return;
    if (this._pointers.has(t.pointerId) && this._pointers.set(t.pointerId, { x: t.clientX, y: t.clientY }), this._pointers.size === 2 && this._zoomEnabled) {
      this._handlePinchMove();
      return;
    }
    if (!this._dragging || t.pointerId !== this._activePointerId) return;
    const e = t.clientX - this._lastPointerX, n = t.clientY - this._lastPointerY;
    if (e === 0 && n === 0) return;
    const o = this._getResolution(), s = -e * o, r = n * o, a = this._camera.rotation;
    let c = s, h = r;
    if (a !== 0) {
      const f = Math.cos(-a), _ = Math.sin(-a);
      c = s * f - r * _, h = s * _ + r * f;
    }
    const d = this._camera.center;
    this._camera.setCenter([d[0] + c, d[1] + h]);
    const l = performance.now(), u = l - this._lastMoveTime;
    u > 0 && (this._velocityX = c / u, this._velocityY = h / u), this._lastMoveTime = l, this._lastPointerX = t.clientX, this._lastPointerY = t.clientY, this._notifyChange();
  }
  _handlePointerUp(t) {
    if (!this._destroyed) {
      this._pointers.delete(t.pointerId);
      try {
        this._element.releasePointerCapture(t.pointerId);
      } catch {
      }
      if (this._pointers.size < 2 && (this._lastPinchDist = 0), this._pointers.size === 1) {
        const [e, n] = [...this._pointers.entries()][0];
        this._dragging = !0, this._activePointerId = e, this._lastPointerX = n.x, this._lastPointerY = n.y;
        return;
      }
      t.pointerId === this._activePointerId && (this._dragging = !1, this._activePointerId = null, this._inertiaDuration > 0 && this._panEnabled && Math.sqrt(
        this._velocityX * this._velocityX + this._velocityY * this._velocityY
      ) > 1e-3 && this._startInertia());
    }
  }
  // ─── Wheel Zoom ───
  _handleWheel(t) {
    if (this._destroyed || !this._zoomEnabled) return;
    t.preventDefault();
    let e = t.deltaY;
    t.deltaMode === 1 && (e *= 16), t.deltaMode === 2 && (e *= 100);
    const n = -e * 2e-3 * this._zoomSpeed, o = this._camera.zoom + n, s = this._element.getBoundingClientRect(), r = t.clientX - s.left, a = t.clientY - s.top;
    this._zoomToPoint(r, a, o), this._notifyChange();
  }
  // ─── Keyboard ───
  _handleKeyDown(t) {
    if (this._destroyed) return;
    const e = t.target;
    if (e.tagName === "INPUT" || e.tagName === "TEXTAREA" || e.tagName === "SELECT")
      return;
    const o = 100 * this._getResolution();
    switch (t.key) {
      case "+":
      case "=":
        if (!this._zoomEnabled) return;
        t.preventDefault(), this._camera.setZoom(this._camera.zoom + 1), this._notifyChange();
        break;
      case "-":
      case "_":
        if (!this._zoomEnabled) return;
        t.preventDefault(), this._camera.setZoom(this._camera.zoom - 1), this._notifyChange();
        break;
      case "ArrowLeft":
        if (!this._panEnabled) return;
        t.preventDefault(), this._camera.setCenter([
          this._camera.center[0] - o,
          this._camera.center[1]
        ]), this._notifyChange();
        break;
      case "ArrowRight":
        if (!this._panEnabled) return;
        t.preventDefault(), this._camera.setCenter([
          this._camera.center[0] + o,
          this._camera.center[1]
        ]), this._notifyChange();
        break;
      case "ArrowUp":
        if (!this._panEnabled) return;
        t.preventDefault(), this._camera.setCenter([
          this._camera.center[0],
          this._camera.center[1] + o
        ]), this._notifyChange();
        break;
      case "ArrowDown":
        if (!this._panEnabled) return;
        t.preventDefault(), this._camera.setCenter([
          this._camera.center[0],
          this._camera.center[1] - o
        ]), this._notifyChange();
        break;
    }
  }
  // ─── Double-click Zoom ───
  _handleDoubleClick(t, e) {
    if (!this._zoomEnabled) return;
    const n = this._element.getBoundingClientRect(), o = t - n.left, s = e - n.top;
    this._zoomToPoint(o, s, this._camera.zoom + 1), this._notifyChange();
  }
  // ─── Pinch Zoom ───
  _initPinch() {
    const t = [...this._pointers.values()];
    if (t.length < 2) return;
    const e = t[0], n = t[1];
    this._lastPinchDist = Math.hypot(n.x - e.x, n.y - e.y), this._lastPinchCenterX = (e.x + n.x) / 2, this._lastPinchCenterY = (e.y + n.y) / 2;
  }
  _handlePinchMove() {
    const t = [...this._pointers.values()];
    if (t.length < 2) return;
    const e = t[0], n = t[1], o = Math.hypot(n.x - e.x, n.y - e.y), s = (e.x + n.x) / 2, r = (e.y + n.y) / 2;
    if (this._lastPinchDist > 0) {
      const a = o / this._lastPinchDist, c = Math.log2(a), h = this._camera.zoom + c, d = this._element.getBoundingClientRect(), l = s - d.left, u = r - d.top;
      if (this._zoomToPoint(l, u, h), this._panEnabled) {
        const f = this._getResolution(), _ = -(s - this._lastPinchCenterX) * f, p = (r - this._lastPinchCenterY) * f, m = this._camera.center;
        this._camera.setCenter([m[0] + _, m[1] + p]);
      }
      this._notifyChange();
    }
    this._lastPinchDist = o, this._lastPinchCenterX = s, this._lastPinchCenterY = r;
  }
  // ─── Inertia ───
  _startInertia() {
    const t = performance.now(), e = this._velocityX, n = this._velocityY, o = this._inertiaDuration, s = () => {
      if (this._destroyed || this._dragging) return;
      const r = performance.now() - t;
      if (r >= o) {
        this._inertiaRafId = null;
        return;
      }
      const a = r / o, c = 1 - a * a, h = 16, d = e * h * c, l = n * h * c, u = this._camera.center;
      this._camera.setCenter([u[0] + d, u[1] + l]), this._notifyChange(), this._inertiaRafId = requestAnimationFrame(s);
    };
    this._inertiaRafId = requestAnimationFrame(s);
  }
  _stopInertia() {
    this._inertiaRafId !== null && (cancelAnimationFrame(this._inertiaRafId), this._inertiaRafId = null);
  }
  // ─── Helpers ───
  /**
   * Zoom to a specific point on screen: the point under the cursor stays fixed.
   */
  _zoomToPoint(t, e, n) {
    const o = this._camera.screenToMap(t, e);
    this._camera.setZoom(n);
    const s = this._camera.screenToMap(t, e), r = this._camera.center;
    this._camera.setCenter([
      r[0] + (o[0] - s[0]),
      r[1] + (o[1] - s[1])
    ]);
  }
  /**
   * Get current camera resolution (meters per pixel).
   */
  _getResolution() {
    return 20037508342789244e-9 * 2 / (256 * Math.pow(2, this._camera.zoom));
  }
  /**
   * Notify render loop + view change event.
   */
  _notifyChange() {
    this._onDirty(), this._onViewChange();
  }
}
function wi(i, t, e = 2) {
  const n = t && t.length, o = n ? t[0] * e : i.length;
  let s = vn(i, 0, o, e, !0);
  const r = [];
  if (!s || s.next === s.prev) return r;
  let a, c, h;
  if (n && (s = Si(i, t, s, e)), i.length > 80 * e) {
    a = i[0], c = i[1];
    let d = a, l = c;
    for (let u = e; u < o; u += e) {
      const f = i[u], _ = i[u + 1];
      f < a && (a = f), _ < c && (c = _), f > d && (d = f), _ > l && (l = _);
    }
    h = Math.max(d - a, l - c), h = h !== 0 ? 32767 / h : 0;
  }
  return Lt(s, r, e, a, c, h, 0), r;
}
function vn(i, t, e, n, o) {
  let s;
  if (o === Hi(i, t, e, n) > 0)
    for (let r = t; r < e; r += n) s = Ie(r / n | 0, i[r], i[r + 1], s);
  else
    for (let r = e - n; r >= t; r -= n) s = Ie(r / n | 0, i[r], i[r + 1], s);
  return s && pt(s, s.next) && (Pt(s), s = s.next), s;
}
function at(i, t) {
  if (!i) return i;
  t || (t = i);
  let e = i, n;
  do
    if (n = !1, !e.steiner && (pt(e, e.next) || R(e.prev, e, e.next) === 0)) {
      if (Pt(e), e = t = e.prev, e === e.next) break;
      n = !0;
    } else
      e = e.next;
  while (n || e !== t);
  return t;
}
function Lt(i, t, e, n, o, s, r) {
  if (!i) return;
  !r && s && Fi(i, n, o, s);
  let a = i;
  for (; i.prev !== i.next; ) {
    const c = i.prev, h = i.next;
    if (s ? Li(i, n, o, s) : Ci(i)) {
      t.push(c.i, i.i, h.i), Pt(i), i = h.next, a = h.next;
      continue;
    }
    if (i = h, i === a) {
      r ? r === 1 ? (i = Ti(at(i), t), Lt(i, t, e, n, o, s, 2)) : r === 2 && Pi(i, t, e, n, o, s) : Lt(at(i), t, e, n, o, s, 1);
      break;
    }
  }
}
function Ci(i) {
  const t = i.prev, e = i, n = i.next;
  if (R(t, e, n) >= 0) return !1;
  const o = t.x, s = e.x, r = n.x, a = t.y, c = e.y, h = n.y, d = Math.min(o, s, r), l = Math.min(a, c, h), u = Math.max(o, s, r), f = Math.max(a, c, h);
  let _ = n.next;
  for (; _ !== t; ) {
    if (_.x >= d && _.x <= u && _.y >= l && _.y <= f && vt(o, a, s, c, r, h, _.x, _.y) && R(_.prev, _, _.next) >= 0) return !1;
    _ = _.next;
  }
  return !0;
}
function Li(i, t, e, n) {
  const o = i.prev, s = i, r = i.next;
  if (R(o, s, r) >= 0) return !1;
  const a = o.x, c = s.x, h = r.x, d = o.y, l = s.y, u = r.y, f = Math.min(a, c, h), _ = Math.min(d, l, u), p = Math.max(a, c, h), m = Math.max(d, l, u), x = me(f, _, t, e, n), y = me(p, m, t, e, n);
  let g = i.prevZ, v = i.nextZ;
  for (; g && g.z >= x && v && v.z <= y; ) {
    if (g.x >= f && g.x <= p && g.y >= _ && g.y <= m && g !== o && g !== r && vt(a, d, c, l, h, u, g.x, g.y) && R(g.prev, g, g.next) >= 0 || (g = g.prevZ, v.x >= f && v.x <= p && v.y >= _ && v.y <= m && v !== o && v !== r && vt(a, d, c, l, h, u, v.x, v.y) && R(v.prev, v, v.next) >= 0)) return !1;
    v = v.nextZ;
  }
  for (; g && g.z >= x; ) {
    if (g.x >= f && g.x <= p && g.y >= _ && g.y <= m && g !== o && g !== r && vt(a, d, c, l, h, u, g.x, g.y) && R(g.prev, g, g.next) >= 0) return !1;
    g = g.prevZ;
  }
  for (; v && v.z <= y; ) {
    if (v.x >= f && v.x <= p && v.y >= _ && v.y <= m && v !== o && v !== r && vt(a, d, c, l, h, u, v.x, v.y) && R(v.prev, v, v.next) >= 0) return !1;
    v = v.nextZ;
  }
  return !0;
}
function Ti(i, t) {
  let e = i;
  do {
    const n = e.prev, o = e.next.next;
    !pt(n, o) && bn(n, e, e.next, o) && Tt(n, o) && Tt(o, n) && (t.push(n.i, e.i, o.i), Pt(e), Pt(e.next), e = i = o), e = e.next;
  } while (e !== i);
  return at(e);
}
function Pi(i, t, e, n, o, s) {
  let r = i;
  do {
    let a = r.next.next;
    for (; a !== r.prev; ) {
      if (r.i !== a.i && Ai(r, a)) {
        let c = wn(r, a);
        r = at(r, r.next), c = at(c, c.next), Lt(r, t, e, n, o, s, 0), Lt(c, t, e, n, o, s, 0);
        return;
      }
      a = a.next;
    }
    r = r.next;
  } while (r !== i);
}
function Si(i, t, e, n) {
  const o = [];
  for (let s = 0, r = t.length; s < r; s++) {
    const a = t[s] * n, c = s < r - 1 ? t[s + 1] * n : i.length, h = vn(i, a, c, n, !1);
    h === h.next && (h.steiner = !0), o.push(Ri(h));
  }
  o.sort(Ei);
  for (let s = 0; s < o.length; s++)
    e = Di(o[s], e);
  return e;
}
function Ei(i, t) {
  let e = i.x - t.x;
  if (e === 0 && (e = i.y - t.y, e === 0)) {
    const n = (i.next.y - i.y) / (i.next.x - i.x), o = (t.next.y - t.y) / (t.next.x - t.x);
    e = n - o;
  }
  return e;
}
function Di(i, t) {
  const e = Ii(i, t);
  if (!e)
    return t;
  const n = wn(e, i);
  return at(n, n.next), at(e, e.next);
}
function Ii(i, t) {
  let e = t;
  const n = i.x, o = i.y;
  let s = -1 / 0, r;
  if (pt(i, e)) return e;
  do {
    if (pt(i, e.next)) return e.next;
    if (o <= e.y && o >= e.next.y && e.next.y !== e.y) {
      const l = e.x + (o - e.y) * (e.next.x - e.x) / (e.next.y - e.y);
      if (l <= n && l > s && (s = l, r = e.x < e.next.x ? e : e.next, l === n))
        return r;
    }
    e = e.next;
  } while (e !== t);
  if (!r) return null;
  const a = r, c = r.x, h = r.y;
  let d = 1 / 0;
  e = r;
  do {
    if (n >= e.x && e.x >= c && n !== e.x && Mn(o < h ? n : s, o, c, h, o < h ? s : n, o, e.x, e.y)) {
      const l = Math.abs(o - e.y) / (n - e.x);
      Tt(e, i) && (l < d || l === d && (e.x > r.x || e.x === r.x && zi(r, e))) && (r = e, d = l);
    }
    e = e.next;
  } while (e !== a);
  return r;
}
function zi(i, t) {
  return R(i.prev, i, t.prev) < 0 && R(t.next, i, i.next) < 0;
}
function Fi(i, t, e, n) {
  let o = i;
  do
    o.z === 0 && (o.z = me(o.x, o.y, t, e, n)), o.prevZ = o.prev, o.nextZ = o.next, o = o.next;
  while (o !== i);
  o.prevZ.nextZ = null, o.prevZ = null, ki(o);
}
function ki(i) {
  let t, e = 1;
  do {
    let n = i, o;
    i = null;
    let s = null;
    for (t = 0; n; ) {
      t++;
      let r = n, a = 0;
      for (let h = 0; h < e && (a++, r = r.nextZ, !!r); h++)
        ;
      let c = e;
      for (; a > 0 || c > 0 && r; )
        a !== 0 && (c === 0 || !r || n.z <= r.z) ? (o = n, n = n.nextZ, a--) : (o = r, r = r.nextZ, c--), s ? s.nextZ = o : i = o, o.prevZ = s, s = o;
      n = r;
    }
    s.nextZ = null, e *= 2;
  } while (t > 1);
  return i;
}
function me(i, t, e, n, o) {
  return i = (i - e) * o | 0, t = (t - n) * o | 0, i = (i | i << 8) & 16711935, i = (i | i << 4) & 252645135, i = (i | i << 2) & 858993459, i = (i | i << 1) & 1431655765, t = (t | t << 8) & 16711935, t = (t | t << 4) & 252645135, t = (t | t << 2) & 858993459, t = (t | t << 1) & 1431655765, i | t << 1;
}
function Ri(i) {
  let t = i, e = i;
  do
    (t.x < e.x || t.x === e.x && t.y < e.y) && (e = t), t = t.next;
  while (t !== i);
  return e;
}
function Mn(i, t, e, n, o, s, r, a) {
  return (o - r) * (t - a) >= (i - r) * (s - a) && (i - r) * (n - a) >= (e - r) * (t - a) && (e - r) * (s - a) >= (o - r) * (n - a);
}
function vt(i, t, e, n, o, s, r, a) {
  return !(i === r && t === a) && Mn(i, t, e, n, o, s, r, a);
}
function Ai(i, t) {
  return i.next.i !== t.i && i.prev.i !== t.i && !Bi(i, t) && // doesn't intersect other edges
  (Tt(i, t) && Tt(t, i) && Zi(i, t) && // locally visible
  (R(i.prev, i, t.prev) || R(i, t.prev, t)) || // does not create opposite-facing sectors
  pt(i, t) && R(i.prev, i, i.next) > 0 && R(t.prev, t, t.next) > 0);
}
function R(i, t, e) {
  return (t.y - i.y) * (e.x - t.x) - (t.x - i.x) * (e.y - t.y);
}
function pt(i, t) {
  return i.x === t.x && i.y === t.y;
}
function bn(i, t, e, n) {
  const o = Dt(R(i, t, e)), s = Dt(R(i, t, n)), r = Dt(R(e, n, i)), a = Dt(R(e, n, t));
  return !!(o !== s && r !== a || o === 0 && Et(i, e, t) || s === 0 && Et(i, n, t) || r === 0 && Et(e, i, n) || a === 0 && Et(e, t, n));
}
function Et(i, t, e) {
  return t.x <= Math.max(i.x, e.x) && t.x >= Math.min(i.x, e.x) && t.y <= Math.max(i.y, e.y) && t.y >= Math.min(i.y, e.y);
}
function Dt(i) {
  return i > 0 ? 1 : i < 0 ? -1 : 0;
}
function Bi(i, t) {
  let e = i;
  do {
    if (e.i !== i.i && e.next.i !== i.i && e.i !== t.i && e.next.i !== t.i && bn(e, e.next, i, t)) return !0;
    e = e.next;
  } while (e !== i);
  return !1;
}
function Tt(i, t) {
  return R(i.prev, i, i.next) < 0 ? R(i, t, i.next) >= 0 && R(i, i.prev, t) >= 0 : R(i, t, i.prev) < 0 || R(i, i.next, t) < 0;
}
function Zi(i, t) {
  let e = i, n = !1;
  const o = (i.x + t.x) / 2, s = (i.y + t.y) / 2;
  do
    e.y > s != e.next.y > s && e.next.y !== e.y && o < (e.next.x - e.x) * (s - e.y) / (e.next.y - e.y) + e.x && (n = !n), e = e.next;
  while (e !== i);
  return n;
}
function wn(i, t) {
  const e = pe(i.i, i.x, i.y), n = pe(t.i, t.x, t.y), o = i.next, s = t.prev;
  return i.next = t, t.prev = i, e.next = o, o.prev = e, n.next = e, e.prev = n, s.next = n, n.prev = s, n;
}
function Ie(i, t, e, n) {
  const o = pe(i, t, e);
  return n ? (o.next = n.next, o.prev = n, n.next.prev = o, n.next = o) : (o.prev = o, o.next = o), o;
}
function Pt(i) {
  i.next.prev = i.prev, i.prev.next = i.next, i.prevZ && (i.prevZ.nextZ = i.nextZ), i.nextZ && (i.nextZ.prevZ = i.prevZ);
}
function pe(i, t, e) {
  return {
    i,
    // vertex index in coordinates array
    x: t,
    y: e,
    // vertex coordinates
    prev: null,
    // previous and next vertex nodes in a polygon ring
    next: null,
    z: 0,
    // z-order curve value
    prevZ: null,
    // previous and next nodes in z-order
    nextZ: null,
    steiner: !1
    // indicates whether this is a steiner point
  };
}
function Hi(i, t, e, n) {
  let o = 0;
  for (let s = t, r = e - n; s < e; s += n)
    o += (i[r] - i[s]) * (i[s + 1] + i[r + 1]), r = s;
  return o;
}
function Cn(i, t, e = 2) {
  return wi(i, t ?? void 0, e);
}
function ze(i, t, e, n) {
  let o = 0;
  for (let s = t, r = e - n; s < e; s += n)
    o += (i[r] - i[s]) * (i[s + 1] + i[r + 1]), r = s;
  return o;
}
function Gi(i, t, e, n) {
  const o = t && t.length > 0, s = o ? t[0] * e : i.length;
  let r = 0;
  for (let c = 0; c < n.length; c += 3) {
    const h = n[c] * e, d = n[c + 1] * e, l = n[c + 2] * e;
    r += Math.abs(
      (i[h] - i[l]) * (i[d + 1] - i[h + 1]) - (i[h] - i[d]) * (i[l + 1] - i[h + 1])
    );
  }
  let a = Math.abs(ze(i, 0, s, e));
  if (o)
    for (let c = 0; c < t.length; c++) {
      const h = t[c] * e, d = c < t.length - 1 ? t[c + 1] * e : i.length;
      a -= Math.abs(ze(i, h, d, e));
    }
  return a === 0 && r === 0 ? 0 : Math.abs((r - a) / a);
}
const Ln = 6378137, Fe = 85.0511287798066;
function ge(i) {
  return i * Math.PI * Ln / 180;
}
function ye(i) {
  const e = Math.max(-Fe, Math.min(Fe, i)) * Math.PI / 180;
  return Math.log(Math.tan(Math.PI / 4 + e / 2)) * Ln;
}
function it(i, t) {
  return t === "EPSG:3857" ? [i[0], i[1], i[2] ?? 0] : [ge(i[0]), ye(i[1]), i[2] ?? 0];
}
class $ {
  /**
   * Extract all Point/MultiPoint geometries from features → vertex data.
   */
  static pointsFromFeatures(t) {
    const e = [];
    for (const o of t)
      $._extractPoints(o.geometry, e);
    if (e.length === 0) return null;
    const n = e.length / 3;
    return {
      vertices: new Float32Array(e),
      count: n
    };
  }
  /**
   * Extract all LineString/MultiLineString geometries → vertex + index data.
   */
  static linesFromFeatures(t) {
    const e = [];
    for (const n of t)
      $._extractLines(n.geometry, e);
    return e.length === 0 ? null : $._buildLineBuffers(e);
  }
  /**
   * Extract all Polygon/MultiPolygon geometries → triangulated vertex + index data.
   */
  static polygonsFromFeatures(t) {
    const e = [], n = [];
    let o = 0;
    for (const s of t)
      $._extractPolygons(
        s.geometry,
        e,
        n,
        o
      ), o = e.length / 3;
    return n.length === 0 ? null : {
      vertices: new Float32Array(e),
      indices: new Uint32Array(n),
      indexCount: n.length
    };
  }
  /**
   * Extract Point/MultiPoint features into model instance data.
   * Per-feature attributes (heading, pitch, roll, scale) override symbol defaults.
   * Instance layout: [mercX, mercY, mercZ, scale, heading, pitch, roll, anchorZ] — 8 floats (32 bytes)
   */
  static modelInstancesFromFeatures(t, e, n, o, s, r) {
    const a = [];
    for (const c of t) {
      const h = c.geometry;
      if (!h) continue;
      const d = c.attributes ?? {}, l = d.scale ?? e, u = n ?? d.heading ?? 0, f = o ?? d.pitch ?? 0, _ = s ?? d.roll ?? 0, p = d.anchorZ ?? r;
      if (h.type === "Point") {
        const m = h.coordinates;
        a.push(
          ge(m[0]),
          ye(m[1]),
          m[2] ?? 0,
          l,
          u,
          f,
          _,
          p
        );
      } else if (h.type === "MultiPoint") {
        const m = h.coordinates;
        for (const x of m)
          a.push(
            ge(x[0]),
            ye(x[1]),
            x[2] ?? 0,
            l,
            u,
            f,
            _,
            p
          );
      }
    }
    return a.length === 0 ? null : {
      instances: new Float32Array(a),
      count: a.length / 8
    };
  }
  // ─── Private: Point extraction ───
  static _extractPoints(t, e) {
    const n = t.coordinates;
    switch (t.type) {
      case "Point": {
        const o = n, [s, r, a] = it(o, t.spatialReference);
        e.push(s, r, a);
        break;
      }
      case "MultiPoint": {
        const o = n;
        for (const s of o) {
          const [r, a, c] = it(s, t.spatialReference);
          e.push(r, a, c);
        }
        break;
      }
    }
  }
  // ─── Private: Line extraction ───
  static _extractLines(t, e) {
    const n = t.coordinates;
    switch (t.type) {
      case "LineString": {
        const o = n, s = [];
        for (const r of o) {
          const [a, c, h] = it(r, t.spatialReference);
          s.push(a, c, h);
        }
        s.length >= 6 && e.push(s);
        break;
      }
      case "MultiLineString": {
        const o = n;
        for (const s of o) {
          const r = [];
          for (const a of s) {
            const [c, h, d] = it(a, t.spatialReference);
            r.push(c, h, d);
          }
          r.length >= 6 && e.push(r);
        }
        break;
      }
      // Also extract polygon outlines as lines
      case "Polygon": {
        const o = n;
        for (const s of o) {
          const r = [];
          for (const a of s) {
            const [c, h, d] = it(a, t.spatialReference);
            r.push(c, h, d);
          }
          r.length >= 6 && e.push(r);
        }
        break;
      }
      case "MultiPolygon": {
        const o = n;
        for (const s of o)
          for (const r of s) {
            const a = [];
            for (const c of r) {
              const [h, d, l] = it(c, t.spatialReference);
              a.push(h, d, l);
            }
            a.length >= 6 && e.push(a);
          }
        break;
      }
    }
  }
  // ─── Private: Polygon extraction + triangulation ───
  static _extractPolygons(t, e, n, o) {
    const s = t.coordinates;
    switch (t.type) {
      case "Polygon": {
        const r = s;
        $._triangulatePolygon(
          r,
          t.spatialReference,
          e,
          n,
          o
        );
        break;
      }
      case "MultiPolygon": {
        const r = s;
        for (const a of r) {
          const c = e.length / 3;
          $._triangulatePolygon(
            a,
            t.spatialReference,
            e,
            n,
            c
          );
        }
        break;
      }
    }
  }
  static _triangulatePolygon(t, e, n, o, s) {
    const r = [], a = [], c = [];
    for (let l = 0; l < t.length; l++) {
      l > 0 && c.push(r.length / 2);
      const u = t[l];
      for (const f of u) {
        const [_, p, m] = it(f, e);
        r.push(_, p), a.push(m);
      }
    }
    const h = Cn(
      r,
      c.length > 0 ? c : void 0,
      2
    ), d = n.length / 3;
    for (let l = 0; l < r.length; l += 2)
      n.push(r[l], r[l + 1], a[l / 2] ?? 0);
    for (const l of h)
      o.push(d + l);
  }
  // ─── Private: Line buffer construction ───
  /**
   * Build line vertex + index buffers from polylines.
   * Each polyline point generates 2 vertices (side=+1 and side=-1).
   * Each segment generates 2 triangles (6 indices).
   * Vertex layout: prev(3) + curr(3) + next(3) + side(1) + cumulDist(1) = 11 floats (44 bytes)
   */
  static _buildLineBuffers(t) {
    let e = 0, n = 0;
    for (const h of t) {
      const d = h.length / 3;
      e += d * 2, n += (d - 1) * 6;
    }
    const o = new Float32Array(e * 11), s = new Uint32Array(n);
    let r = 0, a = 0, c = 0;
    for (const h of t) {
      const d = h.length / 3;
      let l = 0;
      for (let u = 0; u < d; u++) {
        if (u > 0) {
          const m = (u - 1) * 3, x = u * 3, y = h[x] - h[m], g = h[x + 1] - h[m + 1];
          l += Math.sqrt(y * y + g * g);
        }
        const f = Math.max(0, u - 1) * 3, _ = u * 3, p = Math.min(d - 1, u + 1) * 3;
        o[r++] = h[f], o[r++] = h[f + 1], o[r++] = h[f + 2], o[r++] = h[_], o[r++] = h[_ + 1], o[r++] = h[_ + 2], o[r++] = h[p], o[r++] = h[p + 1], o[r++] = h[p + 2], o[r++] = 1, o[r++] = l, o[r++] = h[f], o[r++] = h[f + 1], o[r++] = h[f + 2], o[r++] = h[_], o[r++] = h[_ + 1], o[r++] = h[_ + 2], o[r++] = h[p], o[r++] = h[p + 1], o[r++] = h[p + 2], o[r++] = -1, o[r++] = l;
      }
      for (let u = 0; u < d - 1; u++) {
        const f = c + u * 2, _ = c + u * 2 + 1, p = c + (u + 1) * 2, m = c + (u + 1) * 2 + 1;
        s[a++] = f, s[a++] = _, s[a++] = p, s[a++] = _, s[a++] = m, s[a++] = p;
      }
      c += d * 2;
    }
    return {
      vertices: o,
      indices: s,
      indexCount: n
    };
  }
}
function Wi(i = 1, t = 1, e = 1) {
  const n = i / 2, o = t / 2, s = e / 2, r = new Float32Array([
    // Front (+Z)
    -n,
    -o,
    s,
    n,
    -o,
    s,
    n,
    o,
    s,
    -n,
    o,
    s,
    // Back (-Z)
    n,
    -o,
    -s,
    -n,
    -o,
    -s,
    -n,
    o,
    -s,
    n,
    o,
    -s,
    // Top (+Y)
    -n,
    o,
    s,
    n,
    o,
    s,
    n,
    o,
    -s,
    -n,
    o,
    -s,
    // Bottom (-Y)
    -n,
    -o,
    -s,
    n,
    -o,
    -s,
    n,
    -o,
    s,
    -n,
    -o,
    s,
    // Right (+X)
    n,
    -o,
    s,
    n,
    -o,
    -s,
    n,
    o,
    -s,
    n,
    o,
    s,
    // Left (-X)
    -n,
    -o,
    -s,
    -n,
    -o,
    s,
    -n,
    o,
    s,
    -n,
    o,
    -s
  ]), a = new Float32Array([
    // Front
    0,
    0,
    1,
    0,
    0,
    1,
    0,
    0,
    1,
    0,
    0,
    1,
    // Back
    0,
    0,
    -1,
    0,
    0,
    -1,
    0,
    0,
    -1,
    0,
    0,
    -1,
    // Top
    0,
    1,
    0,
    0,
    1,
    0,
    0,
    1,
    0,
    0,
    1,
    0,
    // Bottom
    0,
    -1,
    0,
    0,
    -1,
    0,
    0,
    -1,
    0,
    0,
    -1,
    0,
    // Right
    1,
    0,
    0,
    1,
    0,
    0,
    1,
    0,
    0,
    1,
    0,
    0,
    // Left
    -1,
    0,
    0,
    -1,
    0,
    0,
    -1,
    0,
    0,
    -1,
    0,
    0
  ]), c = new Uint32Array([
    0,
    1,
    2,
    0,
    2,
    3,
    // Front
    4,
    5,
    6,
    4,
    6,
    7,
    // Back
    8,
    9,
    10,
    8,
    10,
    11,
    // Top
    12,
    13,
    14,
    12,
    14,
    15,
    // Bottom
    16,
    17,
    18,
    16,
    18,
    19,
    // Right
    20,
    21,
    22,
    20,
    22,
    23
    // Left
  ]);
  return { positions: r, normals: a, indices: c, vertexCount: 24 };
}
function ke(i = 0.5, t = 0.5, e = 1, n = 32) {
  const o = e / 2, s = [], r = [], a = [];
  let c = 0;
  for (let l = 0; l <= n; l++) {
    const u = l / n * Math.PI * 2, f = Math.cos(u), _ = Math.sin(u);
    s.push(f * t, -o, _ * t), s.push(f * i, o, _ * i);
    const p = t - i, m = Math.sqrt(p * p + e * e), x = f * e / m, y = p / m, g = _ * e / m;
    if (r.push(x, y, g), r.push(x, y, g), l < n) {
      const v = c;
      a.push(v, v + 1, v + 3), a.push(v, v + 3, v + 2), c += 2;
    }
  }
  c += 2;
  const h = c;
  s.push(0, o, 0), r.push(0, 1, 0), c++;
  for (let l = 0; l < n; l++) {
    const u = l / n * Math.PI * 2;
    s.push(Math.cos(u) * i, o, Math.sin(u) * i), r.push(0, 1, 0), l > 0 && a.push(h, c - 1, c), c++;
  }
  a.push(h, c - 1, h + 1);
  const d = c;
  s.push(0, -o, 0), r.push(0, -1, 0), c++;
  for (let l = 0; l < n; l++) {
    const u = l / n * Math.PI * 2;
    s.push(Math.cos(u) * t, -o, Math.sin(u) * t), r.push(0, -1, 0), l > 0 && a.push(d, c, c - 1), c++;
  }
  return a.push(d, d + 1, c - 1), {
    positions: new Float32Array(s),
    normals: new Float32Array(r),
    indices: new Uint32Array(a),
    vertexCount: s.length / 3
  };
}
function hs(i = 1, t = 32, e = 16) {
  const n = [], o = [], s = [];
  for (let r = 0; r <= e; r++) {
    const a = r / e * Math.PI, c = Math.sin(a), h = Math.cos(a);
    for (let d = 0; d <= t; d++) {
      const l = d / t * Math.PI * 2, u = c * Math.cos(l), f = h, _ = c * Math.sin(l);
      n.push(u * i, f * i, _ * i), o.push(u, f, _);
    }
  }
  for (let r = 0; r < e; r++)
    for (let a = 0; a < t; a++) {
      const c = r * (t + 1) + a, h = c + t + 1;
      s.push(c, h, c + 1), s.push(h, h + 1, c + 1);
    }
  return {
    positions: new Float32Array(n),
    normals: new Float32Array(o),
    indices: new Uint32Array(s),
    vertexCount: n.length / 3
  };
}
function Vi(i = 1, t = 32, e = 12) {
  const n = [], o = [], s = [];
  for (let a = 0; a <= e; a++) {
    const c = a / e * (Math.PI / 2), h = Math.sin(c), d = Math.cos(c);
    for (let l = 0; l <= t; l++) {
      const u = l / t * Math.PI * 2, f = h * Math.cos(u), _ = d, p = h * Math.sin(u);
      n.push(f * i, _ * i, p * i), o.push(f, _, p);
    }
  }
  for (let a = 0; a < e; a++)
    for (let c = 0; c < t; c++) {
      const h = a * (t + 1) + c, d = h + t + 1;
      s.push(h, d, h + 1), s.push(d, d + 1, h + 1);
    }
  const r = n.length / 3;
  n.push(0, 0, 0), o.push(0, -1, 0);
  for (let a = 0; a <= t; a++) {
    const c = a / t * Math.PI * 2;
    n.push(Math.cos(c) * i, 0, Math.sin(c) * i), o.push(0, -1, 0);
  }
  for (let a = 0; a < t; a++)
    s.push(r, r + 1 + a + 1, r + 1 + a);
  return {
    positions: new Float32Array(n),
    normals: new Float32Array(o),
    indices: new Uint32Array(s),
    vertexCount: n.length / 3
  };
}
const Tn = 6378137, Re = 85.0511287798066;
function Ae(i) {
  return i * Math.PI * Tn / 180;
}
function Be(i) {
  const t = Math.max(-Re, Math.min(Re, i));
  return Math.log(Math.tan(Math.PI / 4 + t * Math.PI / 180 / 2)) * Tn;
}
function Pn(i, t, e) {
  if (i.length < 2 || t.length < i.length)
    return { positions: new Float32Array(0), normals: new Float32Array(0), indices: new Uint32Array(0), vertexCount: 0 };
  const n = e ?? new Array(i.length).fill(0), o = [], s = [], r = [];
  for (let a = 0; a < i.length - 1; a++) {
    const [c, h] = i[a], [d, l] = i[a + 1], u = Ae(c), f = Be(h), _ = Ae(d), p = Be(l), m = _ - u, x = p - f, y = Math.sqrt(m * m + x * x) || 1, g = -x / y, v = m / y, L = o.length / 3;
    o.push(u, f, n[a]), o.push(_, p, n[a + 1]), o.push(_, p, t[a + 1]), o.push(u, f, t[a]), s.push(g, v, 0), s.push(g, v, 0), s.push(g, v, 0), s.push(g, v, 0), r.push(L, L + 1, L + 2), r.push(L, L + 2, L + 3);
  }
  return {
    positions: new Float32Array(o),
    normals: new Float32Array(s),
    indices: new Uint32Array(r),
    vertexCount: o.length / 3
  };
}
class ls {
  _lons = [];
  _lats = [];
  _maxH = [];
  _minH = [];
  /** Number of points added so far. */
  get length() {
    return this._lons.length;
  }
  /** Append a new geographic point to the wall. */
  append(t, e, n, o = 0) {
    this._lons.push(t), this._lats.push(e), this._maxH.push(n), this._minH.push(o);
  }
  /** Clear all points. */
  clear() {
    this._lons.length = 0, this._lats.length = 0, this._maxH.length = 0, this._minH.length = 0;
  }
  /** Generate the wall mesh from all appended points. */
  toMesh() {
    const t = this._lons.map((e, n) => [e, this._lats[n]]);
    return Pn(t, this._maxH, this._minH);
  }
}
function us(i, t, e = 0) {
  if (i.length < 2)
    return { positions: new Float32Array(0), normals: new Float32Array(0), indices: new Uint32Array(0), vertexCount: 0 };
  const n = t / 2, o = [], s = [];
  for (let d = 0; d < i.length; d++) {
    const [l, u] = i[d];
    let f, _;
    d === 0 ? (f = i[1][0] - l, _ = i[1][1] - u) : d === i.length - 1 ? (f = l - i[d - 1][0], _ = u - i[d - 1][1]) : (f = i[d + 1][0] - i[d - 1][0], _ = i[d + 1][1] - i[d - 1][1]);
    const p = Math.sqrt(f * f + _ * _) || 1, m = -_ / p, x = f / p;
    o.push([l + m * n, u + x * n]), s.push([l - m * n, u - x * n]);
  }
  const r = [], a = [], c = [], h = e;
  for (let d = 0; d < i.length; d++)
    if (r.push(o[d][0], h, o[d][1]), r.push(s[d][0], h, s[d][1]), a.push(0, 1, 0), a.push(0, 1, 0), d < i.length - 1) {
      const l = d * 2;
      c.push(l, l + 2, l + 1), c.push(l + 1, l + 2, l + 3);
    }
  if (e > 0) {
    const d = i.length * 2;
    for (let l = 0; l < i.length; l++)
      if (r.push(o[l][0], 0, o[l][1]), r.push(s[l][0], 0, s[l][1]), a.push(0, -1, 0), a.push(0, -1, 0), l < i.length - 1) {
        const u = d + l * 2;
        c.push(u, u + 1, u + 2), c.push(u + 1, u + 3, u + 2);
      }
  }
  return {
    positions: new Float32Array(r),
    normals: new Float32Array(a),
    indices: new Uint32Array(c),
    vertexCount: r.length / 3
  };
}
const Mt = O * Math.PI;
function Wt(i, t) {
  const [e, n] = B(i, t);
  return [
    (e + Mt) / (2 * Mt),
    1 - (n + Mt) / (2 * Mt)
  ];
}
function $i(i, t, e) {
  const n = i.length > 1 && i[0][0] === i[i.length - 1][0] && i[0][1] === i[i.length - 1][1] ? i.length - 1 : i.length, [o, s] = Wt(t[0], t[1]), r = [];
  for (let y = 0; y < n; y++)
    r.push(Wt(i[y][0], i[y][1]));
  const a = n + 1 + 1 + n, c = n + n, h = new Float32Array(a * 6), d = new Uint32Array(c * 3);
  let l = 0, u = 0;
  function f(y, g, v, L, M, b) {
    const w = l;
    return h[l * 6 + 0] = y, h[l * 6 + 1] = g, h[l * 6 + 2] = v, h[l * 6 + 3] = L, h[l * 6 + 4] = M, h[l * 6 + 5] = b, l++, w;
  }
  const _ = l;
  for (let y = 0; y < n; y++) {
    const [g, v] = r[y], L = g - o, M = v - s, b = Math.sqrt(L * L + M * M) || 1, w = Math.atan2(e, b * 2 * Mt), C = Math.cos(w), T = Math.sin(w);
    f(g, v, 0, L / b * C, M / b * C, T);
  }
  const p = f(o, s, e, 0, 0, 1);
  for (let y = 0; y < n; y++) {
    const g = (y + 1) % n;
    d[u++] = _ + y, d[u++] = _ + g, d[u++] = p;
  }
  const m = f(o, s, 0, 0, 0, -1), x = l;
  for (let y = 0; y < n; y++) {
    const [g, v] = r[y];
    f(g, v, 0, 0, 0, -1);
  }
  for (let y = 0; y < n; y++) {
    const g = (y + 1) % n;
    d[u++] = m, d[u++] = x + g, d[u++] = x + y;
  }
  return { vertices: h, indices: d, indexCount: u };
}
function Oi(i, t, e, n = 12) {
  const o = i.length > 1 && i[0][0] === i[i.length - 1][0] && i[0][1] === i[i.length - 1][1] ? i.length - 1 : i.length, [s, r] = Wt(t[0], t[1]), a = [];
  for (let M = 0; M < o; M++)
    a.push(Wt(i[M][0], i[M][1]));
  const c = [];
  for (let M = 0; M < o; M++) {
    const b = a[M][0] - s, w = a[M][1] - r, C = Math.sqrt(b * b + w * w) || 1;
    c.push([b / C, w / C, C]);
  }
  const h = (n + 1) * o, d = 1 + o, l = h + d, u = n * o, f = o, _ = u * 2 + f, p = new Float32Array(l * 6), m = new Uint32Array(_ * 3);
  let x = 0, y = 0;
  function g(M, b, w, C, T, E) {
    const P = x;
    return p[x * 6 + 0] = M, p[x * 6 + 1] = b, p[x * 6 + 2] = w, p[x * 6 + 3] = C, p[x * 6 + 4] = T, p[x * 6 + 5] = E, x++, P;
  }
  for (let M = 0; M <= n; M++) {
    const w = M / n * (Math.PI / 2), C = Math.cos(w), T = Math.sin(w) * e;
    for (let E = 0; E < o; E++) {
      const [P, I, D] = c[E], S = s + P * D * C, F = r + I * D * C, z = P * Math.cos(w), A = I * Math.cos(w), H = Math.sin(w), nt = Math.sqrt(z * z + A * A + H * H) || 1;
      g(S, F, T, z / nt, A / nt, H / nt);
    }
  }
  for (let M = 0; M < n; M++) {
    const b = M * o, w = (M + 1) * o;
    for (let C = 0; C < o; C++) {
      const T = (C + 1) % o;
      m[y++] = b + C, m[y++] = b + T, m[y++] = w + C, m[y++] = b + T, m[y++] = w + T, m[y++] = w + C;
    }
  }
  const v = g(s, r, 0, 0, 0, -1), L = x;
  for (let M = 0; M < o; M++)
    g(a[M][0], a[M][1], 0, 0, 0, -1);
  for (let M = 0; M < o; M++) {
    const b = (M + 1) % o;
    m[y++] = v, m[y++] = L + b, m[y++] = L + M;
  }
  return { vertices: p, indices: m, indexCount: y };
}
const lt = O * Math.PI, ne = Math.PI / 180;
function Ui(i, t) {
  const e = t.meshType, n = t.scale?.[0] ?? 50, o = t.scale?.[1] ?? 100;
  if (e === "cone" || e === "sphere")
    return Ni(i, t, n, o);
  const s = Xi(e);
  if (!s) return null;
  const r = t.scale?.[0] ?? 1, a = t.scale?.[1] ?? 1, c = t.scale?.[2] ?? 1, h = (t.heading ?? 0) * ne, d = (t.pitch ?? 0) * ne, l = (t.roll ?? 0) * ne, u = Math.cos(h), f = Math.sin(h), _ = Math.cos(d), p = Math.sin(d), m = Math.cos(l), x = Math.sin(l), y = u * m + f * p * x, g = -u * x + f * p * m, v = f * _, L = _ * x, M = _ * m, b = -p, w = -f * m + u * p * x, C = f * x + u * p * m, T = u * _, E = s.positions, P = s.normals, I = s.indices, D = s.vertexCount, S = I.length, F = D * i.length, z = S * i.length, A = new Float32Array(F * 6), H = new Uint32Array(z);
  let nt = 0, St = 0;
  for (const $n of i) {
    const Yt = $n.geometry;
    if (!Yt || Yt.type !== "Point") continue;
    const Le = Yt.coordinates, On = Le[0], Un = Le[1], [Xn, Yn] = B(On, Un), Nn = (Xn + lt) / (2 * lt), Kn = 1 - (Yn + lt) / (2 * lt);
    for (let Z = 0; Z < D; Z++) {
      const Nt = E[Z * 3] * r, Kt = E[Z * 3 + 1] * a, jt = E[Z * 3 + 2] * c, qn = y * Nt + g * Kt + v * jt, Qn = L * Nt + M * Kt + b * jt, Jn = w * Nt + C * Kt + T * jt, ti = qn / (2 * lt), ei = -Jn / (2 * lt), ht = (nt + Z) * 6;
      A[ht + 0] = Nn + ti, A[ht + 1] = Kn + ei, A[ht + 2] = Qn;
      const qt = P[Z * 3], Qt = P[Z * 3 + 1], Jt = P[Z * 3 + 2];
      A[ht + 3] = y * qt + g * Qt + v * Jt, A[ht + 4] = L * qt + M * Qt + b * Jt, A[ht + 5] = w * qt + C * Qt + T * Jt;
    }
    const jn = nt;
    for (let Z = 0; Z < S; Z++)
      H[St + Z] = jn + I[Z];
    nt += D, St += S;
  }
  return St === 0 ? null : { vertices: A, indices: H, indexCount: St };
}
function Xi(i) {
  switch (i) {
    case "box":
      return ie(Wi(2, 1, 2));
    // XZ [-1,+1], Y [0,1]
    case "cylinder":
      return ie(ke(1, 1, 1, 32));
    // r=1, Y [0,1]
    case "sphere":
      return Vi(1, 32, 12);
    // hemisphere: r=1, Y [0,1] (already ground-based)
    case "cone":
      return ie(ke(0, 1, 1, 32));
    // r=1, Y [0,1]
    default:
      return null;
  }
}
function ie(i) {
  let t = 1 / 0;
  for (let e = 1; e < i.positions.length; e += 3)
    i.positions[e] < t && (t = i.positions[e]);
  if (t !== 0)
    for (let e = 1; e < i.positions.length; e += 3)
      i.positions[e] = i.positions[e] - t;
  return i;
}
function Yi(i, t, e, n = 32) {
  const o = Math.PI / 180, s = (c) => c / (111320 * Math.cos(t * o)), r = (c) => c / 110540, a = [];
  for (let c = 0; c <= n; c++) {
    const h = c / n * Math.PI * 2;
    a.push([
      i + s(Math.cos(h) * e),
      t + r(Math.sin(h) * e)
    ]);
  }
  return a;
}
function Ni(i, t, e, n) {
  const o = [], s = [];
  let r = 0;
  for (const a of i) {
    const c = a.geometry;
    if (!c || c.type !== "Point") continue;
    const h = c.coordinates, d = h[0], l = h[1], u = Yi(d, l, e, 32);
    let f;
    if (t.meshType === "cone" ? f = $i(u, [d, l], n) : f = Oi(u, [d, l], n, 12), !(!f || f.indexCount === 0)) {
      for (let _ = 0; _ < f.vertices.length; _++)
        o.push(f.vertices[_]);
      for (let _ = 0; _ < f.indexCount; _++)
        s.push(f.indices[_] + r);
      r += f.vertices.length / 6;
    }
  }
  return s.length === 0 ? null : {
    vertices: new Float32Array(o),
    indices: new Uint32Array(s),
    indexCount: s.length
  };
}
const Sn = 6378137, Ze = 85.0511287798066, bt = 20037508342789244e-9, He = 1e-7, Ki = 1e-10, ji = 1e-3, qi = 1e6 / (2 * bt);
function Qi(i) {
  return i * Math.PI * Sn / 180;
}
function Ji(i) {
  const e = Math.max(-Ze, Math.min(Ze, i)) * Math.PI / 180;
  return Math.log(Math.tan(Math.PI / 4 + e / 2)) * Sn;
}
function to(i, t) {
  return t === "EPSG:3857" ? [i[0], i[1]] : [Qi(i[0]), Ji(i[1])];
}
function gt(i, t) {
  return [
    (i + bt) / (2 * bt),
    1 - (t + bt) / (2 * bt)
  ];
}
function Ge(i, t, e, n) {
  return Math.abs(i - e) <= He && Math.abs(t - n) <= He;
}
function eo(i, t) {
  const e = [];
  for (const n of i) {
    const [o, s] = to(n, t);
    if (!Number.isFinite(o) || !Number.isFinite(s)) continue;
    const r = e[e.length - 1];
    r && Ge(r[0], r[1], o, s) || e.push([o, s]);
  }
  if (e.length > 1) {
    const n = e[0], o = e[e.length - 1];
    Ge(n[0], n[1], o[0], o[1]) && e.pop();
  }
  return e;
}
function no(i, t, e) {
  const n = [], o = [];
  let s = 0;
  for (const a of i) {
    const c = a.geometry;
    if (!c) continue;
    const h = Number(a.attributes[t]) || 10, d = Number(a.attributes[e]) || 0;
    if (c.type === "Polygon") {
      const l = c.coordinates;
      s = We(
        l,
        c.spatialReference,
        h,
        d,
        n,
        o,
        s
      );
    } else if (c.type === "MultiPolygon") {
      const l = c.coordinates;
      for (const u of l)
        s = We(
          u,
          c.spatialReference,
          h,
          d,
          n,
          o,
          s
        );
    }
  }
  if (o.length === 0) return null;
  const r = io(
    n,
    o,
    qi
  );
  if (r.length === 0) return null;
  if (typeof globalThis < "u" && globalThis.__MAPGPU_EXTRUSION_DEBUG) {
    const a = n.length / 8, c = r.length / 3, h = o.length / 3 - c;
    let d = 1 / 0, l = -1 / 0, u = 1 / 0, f = -1 / 0, _ = 1 / 0, p = -1 / 0;
    for (let m = 0; m < n.length; m += 8) {
      const x = n[m], y = n[m + 1], g = n[m + 2];
      x < d && (d = x), x > l && (l = x), y < u && (u = y), y > f && (f = y), g < _ && (_ = g), g > p && (p = g);
    }
    console.log(
      `[Extrusion] features=${i.length} verts=${a} tris=${c} dropped=${h} xy=[${d.toFixed(6)}..${l.toFixed(6)}, ${u.toFixed(6)}..${f.toFixed(6)}] z=[${_.toFixed(1)}..${p.toFixed(1)}m]`
    );
  }
  return {
    vertices: new Float32Array(n),
    indices: new Uint32Array(r),
    indexCount: r.length
  };
}
function We(i, t, e, n, o, s, r) {
  if (!Number.isFinite(e) || !Number.isFinite(n))
    return r;
  const a = [], c = [], h = [], d = [];
  for (const y of i) {
    const g = eo(y, t);
    g.length >= 3 && d.push(g);
  }
  if (d.length === 0)
    return r;
  for (let y = 0; y < d.length; y++) {
    y > 0 && c.push(a.length / 2);
    const g = d[y], v = [];
    for (const L of g) {
      const M = L[0], b = L[1];
      a.push(M, b), v.push([M, b]);
    }
    h.push(v);
  }
  const l = h[0];
  let u = 0, f = 0;
  for (const y of l) {
    const [g, v] = gt(y[0], y[1]);
    u += g, f += v;
  }
  u /= l.length, f /= l.length;
  const _ = Cn(
    a,
    c.length > 0 ? c : void 0,
    2
  );
  if (_.length > 0) {
    const y = Gi(
      a,
      c.length > 0 ? c : void 0,
      2,
      _
    );
    y > 0.01 && console.warn(`[ExtrusionConverter] High earcut deviation: ${y.toFixed(4)} — polygon may have rendering artifacts`);
  }
  const p = r, m = a.length / 2;
  for (let y = 0; y < a.length; y += 2) {
    const [g, v] = gt(a[y], a[y + 1]);
    o.push(g, v, e), o.push(0, 0, 1), o.push(u, f);
  }
  for (const y of _)
    s.push(p + y);
  r += m;
  const x = e - n > ji;
  if (n > 0 && x) {
    const y = r;
    for (let g = 0; g < a.length; g += 2) {
      const [v, L] = gt(a[g], a[g + 1]);
      o.push(v, L, n), o.push(0, 0, -1), o.push(u, f);
    }
    for (let g = _.length - 1; g >= 0; g--)
      s.push(y + _[g]);
    r += m;
  }
  if (!x)
    return r;
  for (const y of h) {
    const g = y.length;
    for (let v = 0; v < g; v++) {
      const L = y[v][0], M = y[v][1], b = y[(v + 1) % g], w = b[0], C = b[1], T = w - L, E = C - M, P = Math.sqrt(T * T + E * E);
      if (P < Ki) continue;
      const I = E / P, D = -T / P, [S, F] = gt(L, M), [z, A] = gt(w, C), H = r;
      o.push(S, F, n, I, D, 0, u, f), o.push(z, A, n, I, D, 0, u, f), o.push(z, A, e, I, D, 0, u, f), o.push(S, F, e, I, D, 0, u, f), s.push(H, H + 1, H + 2), s.push(H, H + 2, H + 3), r += 4;
    }
  }
  return r;
}
function io(i, t, e) {
  const n = [], o = e * e, s = Math.floor(i.length / 8);
  for (let r = 0; r + 2 < t.length; r += 3) {
    const a = t[r], c = t[r + 1], h = t[r + 2];
    if (a < 0 || c < 0 || h < 0 || a >= s || c >= s || h >= s) continue;
    const d = a * 8, l = c * 8, u = h * 8, f = i[d], _ = i[d + 1], p = i[d + 2], m = i[l], x = i[l + 1], y = i[l + 2], g = i[u], v = i[u + 1], L = i[u + 2];
    if (!Number.isFinite(f) || !Number.isFinite(_) || !Number.isFinite(p) || !Number.isFinite(m) || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(g) || !Number.isFinite(v) || !Number.isFinite(L))
      continue;
    const M = (m - f) * (m - f) + (x - _) * (x - _), b = (g - m) * (g - m) + (v - x) * (v - x), w = (f - g) * (f - g) + (_ - v) * (_ - v);
    M > o || b > o || w > o || n.push(a, c, h);
  }
  return n;
}
const oo = {
  type: "simple-marker",
  color: [66, 133, 244, 255],
  // Google Blue
  size: 8,
  outlineColor: [255, 255, 255, 255],
  outlineWidth: 1.5
}, so = {
  type: "simple-line",
  color: [255, 87, 34, 255],
  // Deep Orange
  width: 2,
  style: "solid"
}, oe = {
  type: "simple-fill",
  color: [66, 133, 244, 80],
  // Semi-transparent blue
  outlineColor: [33, 33, 33, 255],
  outlineWidth: 1
}, G = 40, Y = 24, X = 20037508342789244e-9;
class ro {
  _engine;
  _buffers = /* @__PURE__ */ new Map();
  _tileBuffers = /* @__PURE__ */ new Map();
  _tileSlotToRenderKey = /* @__PURE__ */ new Map();
  _tileScopes = /* @__PURE__ */ new Map();
  /** Track renderer identity per layer for change detection. */
  _rendererKeys = /* @__PURE__ */ new Map();
  /** Track feature count per layer for change detection. */
  _featureCounts = /* @__PURE__ */ new Map();
  /** Track last zoom for zoom-sensitive renderer invalidation. */
  _lastZoomInt = -1;
  /** Layer IDs that use zoom-sensitive renderers. */
  _zoomSensitiveLayers = /* @__PURE__ */ new Set();
  /** Called when a cache entry is invalidated — used to trigger re-render. */
  _onInvalidate = null;
  /** Monotonically increasing terrain version for lazy terrain-relative rebuilds. */
  _terrainVersion = 0;
  /** Track terrain version per layer for change detection. */
  _layerTerrainVersions = /* @__PURE__ */ new Map();
  constructor(t = null) {
    this._engine = t;
  }
  /** Set a callback that fires when cache entries are invalidated. */
  setOnInvalidate(t) {
    this._onInvalidate = t;
  }
  /** Set or update the render engine reference (for late initialization) */
  setRenderEngine(t) {
    this._engine = t;
  }
  /** Mark terrain-relative layer caches stale so they rebuild on the next draw. */
  bumpTerrainVersion() {
    this._terrainVersion++;
  }
  /**
   * Get cached buffers for a layer, or build them from features.
   * When a renderer is provided, features are grouped by resolved symbol
   * so each group gets its own GPU buffer and draw call.
   *
   * When `zoom` is provided and the renderer has `zoomSensitive: true`,
   * cached buffers are invalidated whenever the integer zoom level changes
   * (since the renderer may produce different symbols at different zoom levels).
   *
   * Returns null if no render engine is available.
   */
  getOrBuild(t, e, n, o, s, r = "2d", a, c) {
    if (!this._engine || e.length === 0) return null;
    if (o !== void 0) {
      const m = Math.floor(o);
      if (m !== this._lastZoomInt) {
        this._lastZoomInt = m;
        for (const x of this._zoomSensitiveLayers)
          this.invalidate(x);
      }
    }
    n?.zoomSensitive ? this._zoomSensitiveLayers.add(t) : this._zoomSensitiveLayers.delete(t);
    const h = n ? ae(n) : "", d = this._rendererKeys.get(t), l = this._featureCounts.get(t);
    d !== void 0 && (d !== h || l !== e.length) && this.invalidate(t), this._rendererKeys.set(t, h), this._featureCounts.set(t, e.length);
    const u = a?.mode !== void 0 && a.mode !== "absolute" ? this._terrainVersion : 0, f = this._layerTerrainVersions.get(t);
    f !== void 0 && f !== u && this.invalidate(t), this._layerTerrainVersions.set(t, u);
    let _ = this._buffers.get(t);
    if (_) return _;
    const p = o !== void 0 ? { renderMode: r, zoom: o, resolution: 0 } : void 0;
    return _ = this._build(e, n, p, s, a, c), this._buffers.set(t, _), _;
  }
  getOrBuildTile(t, e) {
    if (!this._engine || e.length === 0) return null;
    const n = t.renderMode ?? (t.globe ? "3d" : "2d"), o = t.renderer ? ae(t.renderer) : "", s = t.renderer?.zoomSensitive && t.zoom !== void 0 ? Math.floor(t.zoom) : -1, r = Ve({
      layerId: t.layerId,
      tileKey: t.tileKey,
      rendererKey: o,
      zoomBucket: s,
      mode: n,
      source: "feature",
      version: t.version
    }), a = re(t.layerId, n, t.tileKey), c = this._tileSlotToRenderKey.get(a);
    c && c !== r && this._invalidateTileEntry(c, !1);
    let h = this._tileBuffers.get(r);
    if (h)
      return this._registerTileSlot(t.layerId, n, a, r), h;
    const d = t.zoom !== void 0 ? { renderMode: n, zoom: t.zoom, resolution: 0 } : void 0;
    return h = this._build(e, t.renderer, d), this._stampExtrusionIds(h, t.tileKey), this._tileBuffers.set(r, h), this._registerTileSlot(t.layerId, n, a, r), h;
  }
  getOrBuildTileBinary(t, e) {
    if (!this._engine || !ao(e)) return null;
    const n = t.renderMode ?? (t.globe ? "3d" : "2d"), o = t.renderer ? ae(t.renderer) : "", s = t.renderer?.zoomSensitive && t.zoom !== void 0 ? Math.floor(t.zoom) : -1, r = Ve({
      layerId: t.layerId,
      tileKey: t.tileKey,
      rendererKey: o,
      zoomBucket: s,
      mode: n,
      source: "binary",
      version: t.version
    }), a = re(t.layerId, n, t.tileKey), c = this._tileSlotToRenderKey.get(a);
    c && c !== r && this._invalidateTileEntry(c, !1);
    let h = this._tileBuffers.get(r);
    return h ? (this._registerTileSlot(t.layerId, n, a, r), h) : (h = this._buildFromBinaryPayload(e), this._stampExtrusionIds(h, t.tileKey), this._tileBuffers.set(r, h), this._registerTileSlot(t.layerId, n, a, r), h);
  }
  /** Check if a layer has cached buffers */
  has(t) {
    return this._buffers.has(t);
  }
  /** Invalidate (release) cached buffers for a specific layer */
  invalidate(t) {
    const e = this._buffers.get(t);
    e && (this._releaseEntry(e), this._buffers.delete(t));
    for (const n of ["2d", "3d"]) {
      const o = se(t, n), s = this._tileScopes.get(o);
      if (s)
        for (const r of [...s]) {
          const a = this._tileSlotToRenderKey.get(r);
          a && this._invalidateTileEntry(a, !1);
        }
    }
    this._rendererKeys.delete(t), this._featureCounts.delete(t), this._layerTerrainVersions.delete(t), this._onInvalidate?.();
  }
  pruneTileEntries(t, e, n) {
    const o = e ? "3d" : "2d", s = se(t, o), r = this._tileScopes.get(s);
    if (!r) return;
    const a = /* @__PURE__ */ new Set();
    for (const c of n)
      a.add(re(t, o, c));
    for (const c of [...r]) {
      if (a.has(c)) continue;
      const h = this._tileSlotToRenderKey.get(c);
      h && this._invalidateTileEntry(h, !1);
    }
  }
  /** Invalidate all cached buffers */
  invalidateAll() {
    for (const t of [...this._buffers.keys()])
      this.invalidate(t);
    for (const t of [...this._tileBuffers.keys()])
      this._invalidateTileEntry(t, !1);
  }
  // ─── Lifecycle ───
  /** Release all cached resources */
  destroy() {
    this.invalidateAll();
    for (const t of [...this._tileBuffers.keys()])
      this._invalidateTileEntry(t, !1);
    this._engine = null;
  }
  // ─── Private ───
  /** Stamp tileKey onto extrusion buffers for stable animation tracking. */
  _stampExtrusionIds(t, e) {
    for (const n of t.extrusionGroups)
      n.buffer.id = e;
  }
  _buildFromBinaryPayload(t) {
    const e = {
      pointGroups: [],
      lineGroups: [],
      polygonGroups: [],
      modelGroups: [],
      extrusionGroups: [],
      mesh3dGroups: []
    };
    for (const n of t.pointGroups) {
      if (n.count <= 0) continue;
      const o = this._engine.createBuffer(n.vertices, G);
      e.pointGroups.push({
        buffer: { vertexBuffer: o, count: n.count },
        symbol: n.symbol
      });
    }
    for (const n of t.lineGroups) {
      if (n.indexCount <= 0) continue;
      const o = this._engine.createBuffer(n.vertices, G), s = this._engine.createBuffer(n.indices, Y);
      e.lineGroups.push({
        buffer: { vertexBuffer: o, indexBuffer: s, indexCount: n.indexCount },
        symbol: n.symbol
      });
    }
    for (const n of t.polygonGroups) {
      if (n.indexCount <= 0) continue;
      const o = this._engine.createBuffer(n.vertices, G), s = this._engine.createBuffer(n.indices, Y);
      e.polygonGroups.push({
        buffer: { vertexBuffer: o, indexBuffer: s, indexCount: n.indexCount },
        symbol: n.symbol
      });
    }
    for (const n of t.modelGroups) {
      if (n.count <= 0) continue;
      const o = this._engine.createBuffer(n.instances, G);
      e.modelGroups.push({
        buffer: { instanceBuffer: o, instanceCount: n.count },
        symbol: n.symbol
      });
    }
    for (const n of t.extrusionGroups) {
      if (n.indexCount <= 0) continue;
      const o = this._engine.createBuffer(n.vertices, G), s = this._engine.createBuffer(n.indices, Y);
      e.extrusionGroups.push({
        buffer: { vertexBuffer: o, indexBuffer: s, indexCount: n.indexCount },
        symbol: n.symbol
      });
    }
    return e;
  }
  _build(t, e, n, o, s, r) {
    const a = { pointGroups: [], lineGroups: [], polygonGroups: [], modelGroups: [], extrusionGroups: [], mesh3dGroups: [] }, c = r ? fo(r) : void 0;
    if (!e || e.type === "simple") {
      const h = e ? e.getSymbol(t[0], n) : null;
      return this._buildSingleGroup(t, a, h, o, s, c), a;
    }
    return this._buildMultiGroup(t, e, a, n, s, c), a;
  }
  /** Fast path: all features share one symbol per geometry type */
  _buildSingleGroup(t, e, n, o, s, r) {
    if (lo(o)) {
      this._buildWallGroup(o, n, e, s, r);
      return;
    }
    if (n && xe(n)) {
      this._buildModelGroup(t, n, e, s, r);
      return;
    }
    if (n && Ke(n)) {
      this._buildExtrusionGroup(t, n, e, s, r);
      return;
    }
    if (n && ho(n)) {
      this._buildMesh3DGroup(t, n, e);
      return;
    }
    const a = n ? Ye(n) ? n : $e(n) : { ...oo }, c = n ? Ne(n) ? n : Oe(n) : { ...so }, h = n ? zt(n) ? n : It(n) : { ...oe };
    this._buildPointGroup(t, a, e, s, r), this._buildLineGroup(t, c, e, s, r), this._buildPolygonGroup(t, h, e, s, r);
  }
  /** Multi-group path: group features by renderer symbol, build separate buffers */
  _buildMultiGroup(t, e, n, o, s, r) {
    const a = /* @__PURE__ */ new Map(), c = /* @__PURE__ */ new Map(), h = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new Map();
    for (const u of t) {
      const f = u.geometry?.type;
      if (!f) continue;
      const _ = e.getSymbol(u, o);
      if (_) {
        if (Ke(_) && Xe(f)) {
          const p = _t(_);
          let m = l.get(p);
          m || (m = { symbol: _, features: [] }, l.set(p, m)), m.features.push(u);
          continue;
        }
        if (xe(_) && Ue(f)) {
          const p = _t(_);
          let m = d.get(p);
          m || (m = { symbol: _, features: [] }, d.set(p, m)), m.features.push(u);
          continue;
        }
        if (Ue(f)) {
          const p = Ye(_) ? _ : $e(_), m = _t(p);
          let x = a.get(m);
          x || (x = { symbol: p, features: [] }, a.set(m, x)), x.features.push(u);
        } else if (co(f)) {
          const p = Ne(_) ? _ : Oe(_), m = _t(p);
          let x = c.get(m);
          x || (x = { symbol: p, features: [] }, c.set(m, x)), x.features.push(u);
        } else if (Xe(f)) {
          const p = zt(_) ? _ : It(_), m = _t(p);
          let x = h.get(m);
          x || (x = { symbol: p, features: [] }, h.set(m, x)), x.features.push(u);
        }
      }
    }
    for (const { symbol: u, features: f } of a.values())
      this._buildPointGroup(f, u, n, s, r);
    for (const { symbol: u, features: f } of c.values())
      this._buildLineGroup(f, u, n, s, r);
    for (const { symbol: u, features: f } of h.values())
      this._buildPolygonGroup(f, u, n, s, r);
    for (const { symbol: u, features: f } of d.values())
      this._buildModelGroup(f, u, n, s, r);
    for (const { symbol: u, features: f } of l.values())
      this._buildExtrusionGroup(f, u, n, s, r);
  }
  /** Build point GPU buffer and push to entry.pointGroups */
  _buildPointGroup(t, e, n, o, s) {
    const r = $.pointsFromFeatures(t);
    if (r && r.count > 0) {
      o && o.mode !== "absolute" && s && yt(r.vertices, 3, 2, o, s);
      const a = this._engine.createBuffer(r.vertices, G);
      n.pointGroups.push({ buffer: { vertexBuffer: a, count: r.count }, symbol: e });
    }
  }
  /** Build line GPU buffer and push to entry.lineGroups */
  _buildLineGroup(t, e, n, o, s) {
    const r = $.linesFromFeatures(t);
    if (r && r.indexCount > 0) {
      o && o.mode !== "absolute" && s && je(r.vertices, 11, o, s);
      const a = this._engine.createBuffer(r.vertices, G), c = this._engine.createBuffer(r.indices, Y);
      n.lineGroups.push({ buffer: { vertexBuffer: a, indexBuffer: c, indexCount: r.indexCount }, symbol: e });
    }
  }
  /** Build polygon GPU buffer and push to entry.polygonGroups + outline to lineGroups */
  _buildPolygonGroup(t, e, n, o, s) {
    const r = $.polygonsFromFeatures(t);
    if (r && r.indexCount > 0) {
      o && o.mode !== "absolute" && s && yt(r.vertices, 3, 2, o, s);
      const a = this._engine.createBuffer(r.vertices, G), c = this._engine.createBuffer(r.indices, Y);
      n.polygonGroups.push({ buffer: { vertexBuffer: a, indexBuffer: c, indexCount: r.indexCount }, symbol: e });
      const h = {
        type: "simple-line",
        color: e.outlineColor,
        width: e.outlineWidth,
        style: "solid",
        glowColor: e.outlineGlowColor,
        glowWidth: e.outlineGlowWidth
      }, d = $.linesFromFeatures(t);
      if (d && d.indexCount > 0) {
        o && o.mode !== "absolute" && s && je(d.vertices, 11, o, s);
        const l = this._engine.createBuffer(d.vertices, G), u = this._engine.createBuffer(d.indices, Y);
        n.lineGroups.push({ buffer: { vertexBuffer: l, indexBuffer: u, indexCount: d.indexCount }, symbol: h });
      }
    }
  }
  /** Build extrusion GPU buffers and push to entry.extrusionGroups */
  _buildExtrusionGroup(t, e, n, o, s) {
    const r = no(t, e.heightField, e.minHeightField ?? "render_min_height");
    if (r && r.indexCount > 0) {
      o && o.mode !== "absolute" && s && yt(r.vertices, 8, 2, o, s, "merc01");
      const a = this._engine.createBuffer(r.vertices, G), c = this._engine.createBuffer(r.indices, Y);
      n.extrusionGroups.push({
        buffer: { vertexBuffer: a, indexBuffer: c, indexCount: r.indexCount },
        symbol: e
      });
    }
  }
  /** Build mesh3D GPU buffers and push to entry.mesh3dGroups */
  _buildMesh3DGroup(t, e, n) {
    const o = Ui(t, e);
    if (o && o.indexCount > 0) {
      const s = this._engine.createBuffer(o.vertices, G), r = this._engine.createBuffer(o.indices, Y);
      n.mesh3dGroups.push({
        buffer: { vertexBuffer: s, indexBuffer: r, indexCount: o.indexCount },
        symbol: e
      });
    }
  }
  /** Build real curtain wall mesh buffers from WallLayer control points. */
  _buildWallGroup(t, e, n, o, s) {
    const r = t.getWallGeometryData();
    if (!("hasIncrementalBuffer" in t && typeof t.hasIncrementalBuffer == "function" && t.hasIncrementalBuffer())) {
      const u = Pn(r.positions, r.maximumHeights, r.minimumHeights);
      if (u.indices.length <= 0) return;
      o && o.mode !== "absolute" && s && yt(u.positions, 3, 2, o, s);
      const f = e ? zt(e) ? e : It(e) : { ...oe }, _ = this._engine.createBuffer(this._interleaveWallMesh(u), G), p = this._engine.createBuffer(u.indices, Y);
      n.mesh3dGroups.push({
        buffer: { vertexBuffer: _, indexBuffer: p, indexCount: u.indices.length },
        symbol: {
          type: "mesh-3d",
          meshType: "box",
          color: [...f.color],
          ambient: 1,
          shininess: 18,
          specularStrength: 0
        }
      });
    }
    const c = e ? zt(e) ? e : It(e) : { ...oe };
    if (c.outlineWidth <= 0 || c.outlineColor[3] <= 0 || r.positions.length < 2) return;
    const h = r.positions.map(([u, f], _) => [u, f, r.maximumHeights[_]]), d = r.positions.map(([u, f], _) => [u, f, r.minimumHeights[_]]), l = [
      {
        id: `${t.id}-wall-top`,
        geometry: { type: "LineString", coordinates: h },
        attributes: {}
      },
      {
        id: `${t.id}-wall-bottom`,
        geometry: { type: "LineString", coordinates: d },
        attributes: {}
      },
      {
        id: `${t.id}-wall-start`,
        geometry: {
          type: "LineString",
          coordinates: [d[0], h[0]]
        },
        attributes: {}
      },
      {
        id: `${t.id}-wall-end`,
        geometry: {
          type: "LineString",
          coordinates: [d[d.length - 1], h[h.length - 1]]
        },
        attributes: {}
      }
    ];
    this._buildLineGroup(l, {
      type: "simple-line",
      color: c.outlineColor,
      width: c.outlineWidth,
      style: "solid"
    }, n, o, s);
  }
  /** Build model instance buffer and push to entry.modelGroups */
  _buildModelGroup(t, e, n, o, s) {
    const r = $.modelInstancesFromFeatures(
      t,
      e.scale ?? 1,
      e.heading,
      e.pitch,
      e.roll,
      e.anchorZ ?? 0
    );
    if (r && r.count > 0) {
      o && o.mode !== "absolute" && s && yt(r.instances, 8, 2, o, s);
      const a = this._engine.createBuffer(r.instances, G);
      n.modelGroups.push({ buffer: { instanceBuffer: a, instanceCount: r.count }, symbol: e });
    }
  }
  _releaseEntry(t) {
    if (this._engine) {
      for (const e of t.pointGroups) this._engine.releaseBuffer(e.buffer.vertexBuffer);
      for (const e of t.lineGroups)
        this._engine.releaseBuffer(e.buffer.vertexBuffer), this._engine.releaseBuffer(e.buffer.indexBuffer);
      for (const e of t.polygonGroups)
        this._engine.releaseBuffer(e.buffer.vertexBuffer), this._engine.releaseBuffer(e.buffer.indexBuffer);
      for (const e of t.modelGroups)
        this._engine.releaseBuffer(e.buffer.instanceBuffer);
      for (const e of t.extrusionGroups)
        this._engine.releaseBuffer(e.buffer.vertexBuffer), this._engine.releaseBuffer(e.buffer.indexBuffer);
      for (const e of t.mesh3dGroups)
        this._engine.releaseBuffer(e.buffer.vertexBuffer), this._engine.releaseBuffer(e.buffer.indexBuffer);
    }
  }
  _interleaveWallMesh(t) {
    const e = new Float32Array(t.vertexCount * 6);
    for (let n = 0; n < t.vertexCount; n++) {
      const o = n * 3, s = n * 6, r = t.positions[o], a = t.positions[o + 1];
      e[s + 0] = (r + X) / (2 * X), e[s + 1] = 1 - (a + X) / (2 * X), e[s + 2] = t.positions[o + 2], e[s + 3] = t.normals[o], e[s + 4] = t.normals[o + 1], e[s + 5] = t.normals[o + 2];
    }
    return e;
  }
  _registerTileSlot(t, e, n, o) {
    this._tileSlotToRenderKey.set(n, o);
    const s = se(t, e);
    let r = this._tileScopes.get(s);
    r || (r = /* @__PURE__ */ new Set(), this._tileScopes.set(s, r)), r.add(n);
  }
  _invalidateTileEntry(t, e) {
    const n = this._tileBuffers.get(t);
    n && (this._releaseEntry(n), this._tileBuffers.delete(t));
    for (const [o, s] of [...this._tileSlotToRenderKey.entries()])
      if (s === t) {
        this._tileSlotToRenderKey.delete(o);
        for (const [r, a] of this._tileScopes)
          if (a.delete(o)) {
            a.size === 0 && this._tileScopes.delete(r);
            break;
          }
      }
    e && this._onInvalidate?.();
  }
}
function se(i, t) {
  return `${i}@@${t}`;
}
function re(i, t, e) {
  return `${i}@@${t}@@${e}`;
}
function Ve(i) {
  return [
    i.layerId,
    i.tileKey,
    i.rendererKey,
    String(i.zoomBucket),
    i.mode,
    i.source,
    String(i.version)
  ].join("::");
}
function ao(i) {
  return i.pointGroups.length > 0 || i.lineGroups.length > 0 || i.polygonGroups.length > 0 || i.modelGroups.length > 0 || i.extrusionGroups.length > 0;
}
function _t(i) {
  if (i.type === "simple-marker") {
    const t = i;
    return `m:${t.color}:${t.size}:${t.outlineColor ?? ""}:${t.outlineWidth ?? 0}:${t.glowColor ?? ""}:${t.glowSize ?? 0}`;
  }
  if (i.type === "icon") {
    const t = i;
    return `i:${t.src ?? ""}:${t.size}:${t.color}:${t.rotation ?? 0}:${t.glowColor ?? ""}:${t.glowSize ?? 0}:${t.backgroundColor ?? ""}:${t.backgroundSize ?? 0}:${t.outlineColor ?? ""}:${t.outlineWidth ?? 0}`;
  }
  if (i.type === "simple-line") {
    const t = i;
    return `l:${t.color}:${t.width}:${t.style}:${t.glowColor ?? ""}:${t.glowWidth ?? 0}`;
  }
  if (i.type === "simple-fill") {
    const t = i;
    return `f:${t.color}:${t.outlineColor}:${t.outlineWidth}:${t.outlineGlowColor ?? ""}:${t.outlineGlowWidth ?? 0}`;
  }
  if (i.type === "model") {
    const t = i;
    return `M:${t.modelId}:${t.scale ?? 1}:${t.heading ?? 0}:${t.pitch ?? 0}:${t.roll ?? 0}:${t.anchorZ ?? 0}:${t.tintColor ?? ""}`;
  }
  if (i.type === "fill-extrusion") {
    const t = i;
    return `E:${t.color}:${t.heightField}:${t.minHeightField ?? ""}:${t.ambient ?? 0.35}:${t.shininess ?? 32}:${t.specularStrength ?? 0.15}`;
  }
  return `?:${JSON.stringify(i)}`;
}
function ae(i) {
  const t = i.getSymbol({ attributes: {}, geometry: { type: "Point", coordinates: [0, 0] }, id: "__fp__" });
  return t ? _t(t) : "";
}
function Ce(i) {
  return "color" in i ? i.color : xe(i) && i.tintColor ? i.tintColor : [128, 128, 128, 255];
}
function $e(i) {
  const t = Ce(i), e = "outlineColor" in i && i.outlineColor ? i.outlineColor : [t[0], t[1], t[2], 255];
  return {
    type: "simple-marker",
    color: t,
    size: "size" in i ? i.size : 10,
    outlineColor: e,
    outlineWidth: "outlineWidth" in i ? i.outlineWidth : 1
  };
}
function Oe(i) {
  const t = Ce(i);
  return {
    type: "simple-line",
    color: [t[0], t[1], t[2], 255],
    width: "width" in i ? i.width : "outlineWidth" in i ? i.outlineWidth + 1 : 2,
    style: "solid"
  };
}
function It(i) {
  const t = Ce(i);
  return {
    type: "simple-fill",
    color: [t[0], t[1], t[2], t[3] < 255 ? t[3] : 100],
    outlineColor: [t[0], t[1], t[2], 255],
    outlineWidth: "outlineWidth" in i ? i.outlineWidth : 1
  };
}
function Ue(i) {
  return i === "Point" || i === "MultiPoint";
}
function co(i) {
  return i === "LineString" || i === "MultiLineString";
}
function Xe(i) {
  return i === "Polygon" || i === "MultiPolygon";
}
function Ye(i) {
  return i.type === "simple-marker" || i.type === "icon" || i.type === "sdf-icon";
}
function Ne(i) {
  return i.type === "simple-line";
}
function zt(i) {
  return i.type === "simple-fill";
}
function xe(i) {
  return i.type === "model";
}
function Ke(i) {
  return i.type === "fill-extrusion";
}
function ho(i) {
  return i.type === "mesh-3d";
}
function lo(i) {
  return !!i && i.type === "wall" && typeof i.getWallGeometryData == "function";
}
function mt(i, t) {
  const e = i / X * 180, o = (2 * Math.atan(Math.exp(t / X * Math.PI)) - Math.PI / 2) * (180 / Math.PI);
  return [e, o];
}
function uo(i, t) {
  const e = i * 2 * X - X, n = (1 - t) * 2 * X - X;
  return mt(e, n);
}
function yt(i, t, e, n, o, s = "epsg3857") {
  const r = n.offset ?? 0, a = Math.floor(i.length / t);
  if (a === 0) return;
  const c = s === "merc01" ? uo : mt;
  if (n.sampling === "centroid") {
    let h = 0, d = 0;
    for (let _ = 0; _ < i.length; _ += t)
      h += i[_], d += i[_ + 1];
    const [l, u] = c(h / a, d / a), f = o.sampleElevation(l, u) ?? 0;
    for (let _ = 0; _ < i.length; _ += t)
      n.mode === "on-the-ground" ? i[_ + e] = f + r : i[_ + e] = i[_ + e] + f + r;
    return;
  }
  for (let h = 0; h < i.length; h += t) {
    const [d, l] = c(i[h], i[h + 1]), u = o.sampleElevation(d, l) ?? 0;
    n.mode === "on-the-ground" ? i[h + e] = u + r : i[h + e] = i[h + e] + u + r;
  }
}
function je(i, t, e, n) {
  const o = e.offset ?? 0, s = Math.floor(i.length / t);
  if (e.sampling === "centroid" && s > 0) {
    let r = 0, a = 0;
    for (let l = 0; l < i.length; l += t)
      r += i[l + 3], a += i[l + 4];
    const [c, h] = mt(r / s, a / s), d = n.sampleElevation(c, h) ?? 0;
    for (let l = 0; l < i.length; l += t)
      e.mode === "on-the-ground" ? (i[l + 2] = d + o, i[l + 5] = d + o, i[l + 8] = d + o) : (i[l + 2] = i[l + 2] + d + o, i[l + 5] = i[l + 5] + d + o, i[l + 8] = i[l + 8] + d + o);
    return;
  }
  for (let r = 0; r < i.length; r += t) {
    const [a, c] = mt(i[r], i[r + 1]), h = n.sampleElevation(a, c) ?? 0, [d, l] = mt(i[r + 3], i[r + 4]), u = n.sampleElevation(d, l) ?? 0, [f, _] = mt(i[r + 6], i[r + 7]), p = n.sampleElevation(f, _) ?? 0;
    e.mode === "on-the-ground" ? (i[r + 2] = h + o, i[r + 5] = u + o, i[r + 8] = p + o) : (i[r + 2] = i[r + 2] + h + o, i[r + 5] = i[r + 5] + u + o, i[r + 8] = i[r + 8] + p + o);
  }
}
function fo(i) {
  const t = /* @__PURE__ */ new Map();
  return {
    sampleElevation(e, n) {
      const o = `${e},${n}`;
      if (t.has(o))
        return t.get(o) ?? null;
      const s = i.sampleElevation(e, n);
      return t.set(o, s), s;
    }
  };
}
const En = 6378137, qe = 85.0511287798066, Vt = 20037508342789244e-9, _o = 256, mo = 2, Qe = 40, Je = 24, q = 4, ot = 6, N = 6;
function Ft(i) {
  return (i * Math.PI * En / 180 + Vt) / (2 * Vt);
}
function kt(i) {
  const t = Math.max(-qe, Math.min(qe, i));
  return 1 - (Math.log(Math.tan(Math.PI / 4 + t * Math.PI / 180 / 2)) * En + Vt) / (2 * Vt);
}
class fs {
  _engine;
  /** CPU-side vertex mirror (merc01 interleaved: pos3+norm3). */
  _cpuVertices;
  /** CPU-side index mirror. */
  _cpuIndices;
  _vertexBuffer;
  _indexBuffer;
  _segmentCount = 0;
  _segmentCapacity;
  /** Set to true after any append; reset when outline rebuild is triggered. */
  outlineDirty = !1;
  constructor(t, e = _o) {
    this._engine = t, this._segmentCapacity = e;
    const n = e * q * ot, o = e * N;
    this._cpuVertices = new Float32Array(n), this._cpuIndices = new Uint32Array(o), this._vertexBuffer = t.createBuffer(
      new Float32Array(n),
      Qe
    ), this._indexBuffer = t.createBuffer(
      new Uint32Array(o),
      Je
    );
  }
  /** Number of wall segments currently stored. */
  get segmentCount() {
    return this._segmentCount;
  }
  /** Total vertex count (4 per segment). */
  get vertexCount() {
    return this._segmentCount * q;
  }
  /** Total index count (6 per segment). */
  get indexCount() {
    return this._segmentCount * N;
  }
  /**
   * Append a single wall segment between two control points.
   *
   * Writes only the new 4 vertices (96 bytes) and 6 indices (24 bytes) to the
   * GPU buffer via sub-range writeBuffer. O(1) per call.
   */
  appendSegment(t, e, n, o, s, r, a, c) {
    this._segmentCount >= this._segmentCapacity && this._grow();
    const h = this._segmentCount, d = h * q, l = d * ot, u = h * N, f = Ft(t), _ = kt(e), p = Ft(s), m = kt(r), x = p - f, y = m - _, g = Math.sqrt(x * x + y * y) || 1e-10, v = -y / g, L = x / g, M = this._cpuVertices;
    M[l] = f, M[l + 1] = _, M[l + 2] = n, M[l + 3] = v, M[l + 4] = L, M[l + 5] = 0, M[l + 6] = p, M[l + 7] = m, M[l + 8] = a, M[l + 9] = v, M[l + 10] = L, M[l + 11] = 0, M[l + 12] = p, M[l + 13] = m, M[l + 14] = c, M[l + 15] = v, M[l + 16] = L, M[l + 17] = 0, M[l + 18] = f, M[l + 19] = _, M[l + 20] = o, M[l + 21] = v, M[l + 22] = L, M[l + 23] = 0;
    const b = this._cpuIndices;
    b[u] = d, b[u + 1] = d + 1, b[u + 2] = d + 2, b[u + 3] = d, b[u + 4] = d + 2, b[u + 5] = d + 3;
    const w = l * 4, C = new Float32Array(M.buffer, w, q * ot);
    this._engine.writeBuffer(this._vertexBuffer, w, C);
    const T = u * 4, E = new Uint32Array(b.buffer, T, N);
    this._engine.writeBuffer(this._indexBuffer, T, E), this._segmentCount++, this.outlineDirty = !0;
  }
  /** Reset segment count without deallocating GPU buffers. */
  clear() {
    this._segmentCount = 0, this.outlineDirty = !0;
  }
  /** Get the render buffer for the Mesh3D draw delegate. */
  getRenderBuffer() {
    return {
      vertexBuffer: this._vertexBuffer,
      indexBuffer: this._indexBuffer,
      indexCount: this._segmentCount * N
    };
  }
  /** Release GPU resources. */
  destroy() {
    this._engine.releaseBuffer(this._vertexBuffer), this._engine.releaseBuffer(this._indexBuffer);
  }
  /**
   * Rebuild the entire buffer from raw control point arrays.
   * Used after setPositions() or full rebuild scenarios.
   */
  rebuildFromControlPoints(t, e, n, o, s, r) {
    const a = t.length;
    if (a < 2) {
      this.clear();
      return;
    }
    const c = a - 1;
    for (; c > this._segmentCapacity; )
      this._growCapacity();
    this._segmentCount = 0;
    const d = s && s.mode !== "absolute" && r ? new Float64Array(a) : null;
    if (d && r) {
      const f = s.offset ?? 0;
      for (let _ = 0; _ < a; _++)
        d[_] = (r.sampleElevation(t[_], e[_]) ?? 0) + f;
    }
    for (let f = 0; f < c; f++) {
      const _ = f, p = _ * q, m = p * ot, x = _ * N, y = Ft(t[f]), g = kt(e[f]), v = Ft(t[f + 1]), L = kt(e[f + 1]), M = v - y, b = L - g, w = Math.sqrt(M * M + b * b) || 1e-10, C = -b / w, T = M / w;
      let E = o[f], P = o[f + 1], I = n[f], D = n[f + 1];
      if (d) {
        const z = d[f], A = d[f + 1];
        s.mode === "on-the-ground" ? (E = z, P = A, I = z, D = A) : (E += z, P += A, I += z, D += A);
      }
      const S = this._cpuVertices;
      S[m] = y, S[m + 1] = g, S[m + 2] = E, S[m + 3] = C, S[m + 4] = T, S[m + 5] = 0, S[m + 6] = v, S[m + 7] = L, S[m + 8] = P, S[m + 9] = C, S[m + 10] = T, S[m + 11] = 0, S[m + 12] = v, S[m + 13] = L, S[m + 14] = D, S[m + 15] = C, S[m + 16] = T, S[m + 17] = 0, S[m + 18] = y, S[m + 19] = g, S[m + 20] = I, S[m + 21] = C, S[m + 22] = T, S[m + 23] = 0;
      const F = this._cpuIndices;
      F[x] = p, F[x + 1] = p + 1, F[x + 2] = p + 2, F[x + 3] = p, F[x + 4] = p + 2, F[x + 5] = p + 3;
    }
    this._segmentCount = c;
    const l = c * q * ot;
    this._engine.writeBuffer(this._vertexBuffer, 0, this._cpuVertices.subarray(0, l));
    const u = c * N;
    this._engine.writeBuffer(this._indexBuffer, 0, this._cpuIndices.subarray(0, u)), this._lastTerrainVersion = r ? Date.now() : -1, this.outlineDirty = !0;
  }
  /** Stored terrain version to detect when terrain offset rebuild is needed. */
  _lastTerrainVersion = -1;
  /** Whether terrain offset needs to be reapplied (e.g., terrain data changed). */
  get terrainVersionStale() {
    return this._lastTerrainVersion === -1;
  }
  // ─── Private ───
  /** Double the buffer capacity (CPU arrays only, GPU buffers reallocated). */
  _grow() {
    this._growCapacity();
  }
  _growCapacity() {
    const t = this._segmentCapacity * mo, e = t * q * ot, n = t * N, o = new Float32Array(e);
    o.set(this._cpuVertices), this._cpuVertices = o;
    const s = new Uint32Array(n);
    s.set(this._cpuIndices), this._cpuIndices = s;
    const r = this._vertexBuffer, a = this._indexBuffer;
    if (this._vertexBuffer = this._engine.createBuffer(
      new Float32Array(e),
      Qe
    ), this._indexBuffer = this._engine.createBuffer(
      new Uint32Array(n),
      Je
    ), this._segmentCount > 0) {
      const c = this._segmentCount * q * ot;
      this._engine.writeBuffer(this._vertexBuffer, 0, this._cpuVertices.subarray(0, c));
      const h = this._segmentCount * N;
      this._engine.writeBuffer(this._indexBuffer, 0, this._cpuIndices.subarray(0, h));
    }
    this._engine.releaseBuffer(r), this._engine.releaseBuffer(a), this._segmentCapacity = t;
  }
}
class po {
  /**
   * The layer collection exposed as the public API surface.
   *
   * Layers are added/removed via `gameMap.add(layer)` and `gameMap.remove(layer)`.
   * The GameMap instance persists across mode switches.
   *
   * @see {@link GameMap}
   */
  map;
  /**
   * The GPU render engine (WebGPU or mock).
   *
   * Set to `null` until {@link initGpu} completes successfully. Once
   * initialized, the engine is shared across all modes and sub-systems.
   *
   * @see {@link IRenderEngine}
   */
  renderEngine = null;
  /**
   * The render loop that drives frame callbacks.
   *
   * Schedules `requestAnimationFrame` ticks, calls `beginFrame()` /
   * `endFrame()` on the render engine, and invokes registered frame
   * callbacks in between.
   *
   * @see {@link RenderLoop}
   */
  renderLoop;
  /**
   * Tile scheduler that computes tile coverage for a given extent and zoom.
   *
   * Determines which tile coordinates (z/x/y) are needed to cover the
   * current viewport. Used by both 2D and 3D modes.
   *
   * @see {@link TileScheduler}
   */
  tileScheduler;
  /**
   * Tile manager responsible for fetching, caching, and uploading tile imagery.
   *
   * Maintains a tile cache, handles network requests, and uploads decoded
   * images to GPU textures via the render engine. Fires a dirty callback
   * when new tiles become ready, triggering a repaint.
   *
   * @see {@link TileManager}
   */
  tileManager;
  /**
   * Terrain tile manager for height/hillshade requests and GPU caching.
   *
   * @see {@link TerrainTileManager}
   */
  terrainManager;
  /**
   * Layer manager that handles visibility, zoom-range filtering, and draw ordering.
   *
   * @see {@link LayerManager}
   */
  layerManager;
  /**
   * GPU buffer cache for vector layer geometry and terrain textures.
   *
   * Caches vertex/index buffers so that vector features are not re-uploaded
   * to the GPU every frame. Also caches terrain elevation textures.
   *
   * @see {@link VectorBufferCache}
   */
  bufferCache;
  /**
   * The `<canvas>` element used for WebGPU rendering.
   *
   * Created by {@link createCanvas} and removed from the DOM by {@link destroy}.
   * May be `null` in headless/test mode or before canvas creation.
   */
  canvas = null;
  /**
   * The DOM container element that hosts the canvas.
   *
   * Set by {@link createCanvas}. Cleared on {@link destroy}.
   */
  container = null;
  /**
   * ResizeObserver watching the container for size changes.
   *
   * Created by {@link setupResizeObserver}. Disconnected and nulled on {@link destroy}.
   */
  resizeObserver = null;
  /**
   * Whether the view has been destroyed via {@link destroy}.
   *
   * Once `true`, all lifecycle methods become no-ops and async operations
   * (such as GPU init) will throw.
   */
  destroyed = !1;
  /**
   * Whether GPU initialization completed successfully.
   *
   * Set to `true` at the end of {@link initGpu}. Checked by MapView before
   * attaching interaction handlers and starting the render loop.
   */
  gpuReady = !1;
  /**
   * Resolved globe effects configuration (lighting, atmosphere, pole caps, etc.).
   * Persists across mode switches. Updated via {@link MapView.setGlobeEffects}.
   */
  globeEffects = de();
  /**
   * Create a new ViewCore instance with all sub-systems initialized.
   *
   * All sub-systems start in a lightweight, unconnected state. The render
   * engine and canvas are wired up later via {@link createCanvas} and
   * {@link initGpu}.
   */
  constructor() {
    this.map = new ci(), this.layerManager = new ui(), this.tileScheduler = new fi(), this.tileManager = new vi({ tileScheduler: this.tileScheduler }), this.terrainManager = new Mi(), this.renderLoop = new di(), this.bufferCache = new ro();
  }
  // ─── Canvas & DOM ───
  /**
   * Create a `<canvas>` element inside the given container, sized to fill it.
   *
   * The canvas is absolutely positioned within the container, covering its
   * full area. The container's CSS `position` is set to `relative` if it is
   * currently `static`, ensuring proper stacking context.
   *
   * The canvas backing store is sized to the container's CSS dimensions
   * multiplied by `devicePixelRatio` for crisp rendering on HiDPI displays.
   * Falls back to 800x600 if the container has no measurable size.
   *
   * This method consolidates the identical canvas creation logic that was
   * previously duplicated in MapView2D, GlobeView, and TerrainView.
   *
   * @param container - The DOM element to host the canvas.
   * @returns The created `<canvas>` element (also stored as {@link canvas}).
   *
   * @see {@link setupResizeObserver} to keep the canvas sized after creation
   */
  createCanvas(t) {
    const e = document.createElement("canvas");
    getComputedStyle(t).position === "static" && (t.style.position = "relative"), e.style.position = "absolute", e.style.top = "0", e.style.left = "0", e.style.width = "100%", e.style.height = "100%", e.style.display = "block";
    const o = typeof devicePixelRatio < "u" ? devicePixelRatio : 1, s = t.clientWidth || 800, r = t.clientHeight || 600;
    return e.width = Math.round(s * o), e.height = Math.round(r * o), t.appendChild(e), this.canvas = e, this.container = t, e;
  }
  /**
   * Observe the container for resize events and keep the canvas sized correctly.
   *
   * Uses `ResizeObserver` (when available) to watch the container. On each
   * resize, the canvas backing store is updated to match the new CSS
   * dimensions times `devicePixelRatio`, and the `onResize` callback is
   * invoked with the new CSS pixel dimensions so the active mode can update
   * its camera/viewport.
   *
   * This method consolidates the identical resize logic that was previously
   * duplicated across three view classes. The only varying part is the
   * `onResize` callback, which each mode supplies to update its own camera.
   *
   * No-ops gracefully if `ResizeObserver` is not available in the environment
   * (e.g., older test runners).
   *
   * @param container - The DOM container being observed for size changes.
   * @param canvas    - The canvas element whose backing store is resized.
   * @param onResize  - Callback invoked with the new CSS pixel dimensions
   *                     (width, height) whenever the container changes size.
   *                     Typically used by the active {@link IViewMode} to call
   *                     {@link IViewMode.setViewport | setViewport()}.
   *
   * @see {@link createCanvas} which should be called before this method
   * @see {@link destroy} which disconnects the observer
   */
  setupResizeObserver(t, e, n) {
    typeof ResizeObserver > "u" || (this.resizeObserver = new ResizeObserver((o) => {
      if (!this.destroyed)
        for (const s of o) {
          const { width: r, height: a } = s.contentRect;
          if (r === 0 || a === 0) continue;
          const c = typeof devicePixelRatio < "u" ? devicePixelRatio : 1, h = Math.round(r * c), d = Math.round(a * c);
          (e.width !== h || e.height !== d) && (e.width = h, e.height = d, n(r, a));
        }
    }), this.resizeObserver.observe(t));
  }
  // ─── GPU Init ───
  /**
   * Initialize the GPU render engine and wire up dependent sub-systems.
   *
   * This is an async operation that:
   * 1. Stores the render engine reference and passes it to the buffer cache,
   *    tile manager, and render loop.
   * 2. Calls `engine.init(canvas)` to request a GPU adapter/device and
   *    configure the swap chain.
   * 3. Sets {@link gpuReady} to `true` on success.
   * 4. Wires the tile manager's dirty callback to the render loop so that
   *    newly loaded tiles automatically trigger a repaint.
   * 5. Logs a warning if the GPU is running in a degraded capability mode
   *    (e.g., software fallback).
   *
   * If the view is {@link destroy | destroyed} while GPU init is in progress,
   * this method throws an error to prevent further setup.
   *
   * @param engine - The render engine implementation (typically WebGPURenderEngine).
   * @param canvas - The canvas element to bind the GPU context to.
   * @returns The detected GPU capabilities (feature tier, max texture size, etc.).
   * @throws Error if the view is destroyed during initialization.
   *
   * @see {@link GpuCapabilities} for the returned capability descriptor
   * @see {@link IRenderEngine.init} for the underlying engine initialization
   * @see {@link createCanvas} which should be called before this method
   */
  async initGpu(t, e, n) {
    this.renderEngine = t, this.bufferCache.setRenderEngine(t), this.tileManager.setRenderEngine(t), this.terrainManager.setRenderEngine(t), this.renderLoop.setRenderEngine(t);
    const o = await t.init(e, n);
    if (this.destroyed) throw new Error("View destroyed during GPU init");
    return this.gpuReady = !0, this.tileManager.onDirty = () => {
      this.renderLoop.markDirty();
    }, this.terrainManager.onDirty = () => {
      this.bufferCache.bumpTerrainVersion(), this.renderLoop.markDirty();
    }, this.bufferCache.setOnInvalidate(() => {
      this.renderLoop.markDirty();
    }), o.mode !== "full-gpu" && console.warn(`[mapgpu] GPU running in degraded mode: ${o.mode}`), o;
  }
  // ─── Lifecycle ───
  /**
   * Release all shared resources and tear down the view infrastructure.
   *
   * This method is idempotent — calling it multiple times is safe.
   * Once called, the ViewCore instance must not be reused.
   *
   * **Teardown sequence:**
   * 1. Sets {@link destroyed} to `true` (prevents further operations).
   * 2. Disconnects the {@link ResizeObserver} (if active).
   * 3. Destroys the buffer cache (releases GPU buffers).
   * 4. Destroys the tile manager (cancels pending fetches, releases textures).
   * 5. Destroys the render loop (stops animation frame scheduling).
   * 6. Destroys the layer manager (clears layer references).
   * 7. Destroys the GameMap (removes all layers).
   * 8. Removes the canvas element from the DOM.
   *
   * @remarks The active {@link IViewMode} should be disposed separately
   * before calling this method. MapView handles this ordering automatically.
   *
   * @see {@link IViewMode.dispose} for mode-specific cleanup
   */
  destroy() {
    this.destroyed || (this.destroyed = !0, this.resizeObserver?.disconnect(), this.resizeObserver = null, this.bufferCache.destroy(), this.tileManager.destroy(), this.terrainManager.destroy(), this.renderLoop.destroy(), this.layerManager.destroy(), this.map.destroy(), this.canvas && this.canvas.parentNode && this.canvas.parentNode.removeChild(this.canvas), this.canvas = null, this.container = null);
  }
}
const go = Math.PI / 180, yo = 180 / Math.PI, tn = 85.051129, en = 2 * Math.PI;
class xo {
  name = "mercator";
  wrapsHorizontally = !0;
  /**
   * lon/lat (derece) → normalized Mercator (0..1).
   * x: 0 = -180°, 0.5 = 0°, 1 = +180°
   * y: 0 = +85.05°, 1 = -85.05° (y aşağı doğru artar — tile convention)
   */
  project(t, e) {
    const n = Math.max(-tn, Math.min(tn, e)), o = (t + 180) / 360, s = n * go, r = 0.5 - Math.log(Math.tan(Math.PI / 4 + s / 2)) / en;
    return [o, r];
  }
  /**
   * Normalized Mercator (0..1) → lon/lat (derece).
   * Inverse: latRad = 2*atan(exp((0.5-y)*2π)) - π/2
   */
  unproject(t, e) {
    const n = t * 360 - 180, s = (2 * Math.atan(Math.exp((0.5 - e) * en)) - Math.PI / 2) * yo;
    return [n, s];
  }
}
class W {
  name = "globe";
  /** Zoom < bu değer → tam globe */
  static TRANSITION_ZOOM_LOW = 5;
  /** Zoom > bu değer → tam mercator */
  static TRANSITION_ZOOM_HIGH = 6;
  _globeness = 1;
  _mercator;
  constructor() {
    this._mercator = new xo();
  }
  /** Mevcut globeness değeri (0=mercator, 1=globe) */
  get globeness() {
    return this._globeness;
  }
  /** Globe modunda horizontal wrap yok */
  get wrapsHorizontally() {
    return this._globeness < 1;
  }
  /**
   * Zoom seviyesinden globeness hesapla.
   * smooth interpolation: low=1, high=0, arada cosine easing.
   */
  static globenessFromZoom(t) {
    if (t <= W.TRANSITION_ZOOM_LOW) return 1;
    if (t >= W.TRANSITION_ZOOM_HIGH) return 0;
    const e = (t - W.TRANSITION_ZOOM_LOW) / (W.TRANSITION_ZOOM_HIGH - W.TRANSITION_ZOOM_LOW);
    return 0.5 * (1 + Math.cos(e * Math.PI));
  }
  /** Globeness değerini doğrudan ayarla (0-1) */
  setGlobeness(t) {
    this._globeness = Math.max(0, Math.min(1, t));
  }
  /** Zoom seviyesinden globeness güncelle */
  updateFromZoom(t) {
    this._globeness = W.globenessFromZoom(t);
  }
  /**
   * lon/lat → normalized Mercator (0..1).
   * Globe modunda da aynı Mercator coordinates — shader'da sphere'e dönüşüm yapılır.
   */
  project(t, e) {
    return this._mercator.project(t, e);
  }
  /**
   * Normalized Mercator (0..1) → lon/lat.
   */
  unproject(t, e) {
    return this._mercator.unproject(t, e);
  }
  /**
   * Mercator (0..1) → Angular coordinates (radians).
   * Shader'daki mercatorToAngular ile aynı:
   * - x → longitude: x * 2π - π → [-π, π] → shifted: x*2π+π (MapLibre convention)
   * - y → latitude: 2*atan(exp(π - y*2π)) - π/2
   */
  static mercatorToAngular(t, e) {
    const n = t * 2 * Math.PI - Math.PI, o = 2 * Math.atan(Math.exp(Math.PI - e * 2 * Math.PI)) - Math.PI / 2;
    return [n, o];
  }
  /**
   * Angular (radians) → unit sphere (3D).
   * Shader'daki angularToSphere ile aynı:
   * - x = cos(lat) * sin(lon)
   * - y = sin(lat)
   * - z = cos(lat) * cos(lon)
   */
  static angularToSphere(t, e) {
    const n = Math.cos(e);
    return [
      n * Math.sin(t),
      Math.sin(e),
      n * Math.cos(t)
    ];
  }
  /**
   * lon/lat (derece) → unit sphere (3D).
   * Convenience: project → angular → sphere.
   */
  static lonLatToSphere(t, e) {
    const n = t * (Math.PI / 180), o = e * (Math.PI / 180);
    return W.angularToSphere(n, o);
  }
}
const k = Math.PI / 180, ce = 180 / Math.PI, vo = 36.87, Mo = 85, nn = 0, Q = 22;
class Dn {
  // ─── Parameters ───
  _center = [0, 0];
  _zoom = 2;
  _pitch = 0;
  _bearing = 0;
  _fov = vo;
  _viewportWidth = 800;
  _viewportHeight = 600;
  _minCameraSurfaceDistanceMeters = 0;
  // ─── Cached matrices (column-major Float32Array) ───
  _viewMatrix = new Float32Array(16);
  _projectionMatrix = new Float32Array(16);
  _viewProjectionMatrix = new Float32Array(16);
  _flatViewProjectionMatrix = new Float32Array(16);
  _cameraPosition = [0, 0, 0];
  _clippingPlane = [0, 0, 1, 0];
  _dirty = !0;
  constructor(t) {
    t && (t.center && (this._center = [...t.center]), t.zoom !== void 0 && (this._zoom = t.zoom), t.pitch !== void 0 && (this._pitch = t.pitch), t.bearing !== void 0 && (this._bearing = t.bearing), t.fov !== void 0 && (this._fov = t.fov), t.viewportWidth !== void 0 && (this._viewportWidth = t.viewportWidth), t.viewportHeight !== void 0 && (this._viewportHeight = t.viewportHeight)), this.updateMatrices();
  }
  // ─── Getters ───
  get center() {
    return [...this._center];
  }
  get zoom() {
    return this._zoom;
  }
  get pitch() {
    return this._pitch;
  }
  get bearing() {
    return this._bearing;
  }
  get fov() {
    return this._fov;
  }
  get viewportWidth() {
    return this._viewportWidth;
  }
  get viewportHeight() {
    return this._viewportHeight;
  }
  get cameraSurfaceDistanceMeters() {
    return this._cameraSurfaceDistanceMetersFor(this._zoom, this._pitch);
  }
  get viewMatrix() {
    return this._ensureClean(), this._viewMatrix;
  }
  get projectionMatrix() {
    return this._ensureClean(), this._projectionMatrix;
  }
  get viewProjectionMatrix() {
    return this._ensureClean(), this._viewProjectionMatrix;
  }
  /** Flat Mercator VP matrix — maps Mercator [0..1] → NDC for zoom >= 6 rendering */
  get flatViewProjectionMatrix() {
    return this._ensureClean(), this._flatViewProjectionMatrix;
  }
  get cameraPosition() {
    return this._ensureClean(), [...this._cameraPosition];
  }
  /**
   * Globe radius in pixels.
   * MapLibre: worldSize / (2π) at equator.
   * worldSize = tileSize * 2^zoom (tileSize=512)
   */
  get globeRadius() {
    return 512 * Math.pow(2, this._zoom) / (2 * Math.PI);
  }
  /**
   * Camera-to-center distance in globe-radius units.
   * Based on zoom/fov: distance = 1 / (2 * tan(fov/2) * globeScale)
   * where globeScale relates zoom to sphere coverage.
   */
  get cameraToCenterDistance() {
    const e = this._fov * k / 2;
    return 0.5 * this._viewportHeight / Math.tan(e) / this.globeRadius;
  }
  /** Camera distance in Mercator [0..1] space — used for flat-path camera position. */
  get mercatorCameraDistance() {
    const t = 512 * Math.pow(2, this._zoom), e = this._fov * k;
    return 0.5 * this._viewportHeight / Math.tan(e / 2) / t;
  }
  // ─── Setters ───
  setCenter(t, e) {
    if (!Number.isFinite(t) || !Number.isFinite(e)) return;
    const n = t >= -180 && t < 180 ? t : (t % 360 + 540) % 360 - 180;
    this._center = [n, Math.max(-85.051129, Math.min(85.051129, e))], this._dirty = !0;
  }
  setZoom(t) {
    this._applyZoom(t);
  }
  setPitch(t) {
    this._pitch = Math.max(0, Math.min(Mo, t)), this._applyZoom(this._zoom), this._dirty = !0;
  }
  setBearing(t) {
    this._bearing = (t % 360 + 360) % 360, this._dirty = !0;
  }
  setViewport(t, e) {
    this._viewportWidth = t, this._viewportHeight = e, this._applyZoom(this._zoom), this._dirty = !0;
  }
  setFov(t) {
    this._fov = Math.max(10, Math.min(90, t)), this._applyZoom(this._zoom), this._dirty = !0;
  }
  setMinCameraSurfaceDistance(t) {
    const e = Number.isFinite(t) ? Math.max(0, t) : 0;
    return Math.abs(e - this._minCameraSurfaceDistanceMeters) < 1e-6 ? !1 : (this._minCameraSurfaceDistanceMeters = e, this._applyZoom(this._zoom));
  }
  // ─── Matrix Computation ───
  _ensureClean() {
    this._dirty && this.updateMatrices();
  }
  _applyZoom(t) {
    const e = this._clampZoom(t), n = Math.abs(e - this._zoom) > 1e-9;
    return this._zoom = e, this._dirty = !0, n;
  }
  _clampZoom(t) {
    const e = Math.max(nn, Math.min(Q, t)), n = this._maxZoomForSurfaceDistance(
      this._pitch,
      this._minCameraSurfaceDistanceMeters
    );
    return Math.min(e, n);
  }
  _cameraSurfaceDistanceMetersFor(t, e) {
    const n = this._cameraToCenterDistanceFor(t), o = e * k, s = Math.sqrt(1 + n * n + 2 * n * Math.cos(o));
    return Math.max(0, (s - 1) * O);
  }
  _cameraToCenterDistanceFor(t) {
    const n = this._fov * k / 2, o = Math.tan(n);
    if (!(this._viewportHeight > 0) || !Number.isFinite(o) || o <= 0) return 0;
    const s = 0.5 * this._viewportHeight / o, r = 512 * Math.pow(2, t);
    return s / (r / (2 * Math.PI));
  }
  _maxZoomForSurfaceDistance(t, e) {
    if (!(e > 0) || !(this._viewportHeight > 0)) return Q;
    const n = this._fov * k, o = Math.tan(n / 2);
    if (!Number.isFinite(o) || o <= 0) return Q;
    const s = e / O, r = Math.cos(t * k), a = -r + Math.sqrt(r * r + 2 * s + s * s);
    if (!(a > 0)) return Q;
    const h = 0.5 * this._viewportHeight / o * (2 * Math.PI / 512);
    if (!(h > 0)) return Q;
    const d = Math.log2(h / a);
    return Number.isFinite(d) ? Math.max(nn, Math.min(Q, d)) : Q;
  }
  updateMatrices() {
    const t = this._fov * k, e = this._pitch * k, n = this._bearing * k, o = this._center[0] * k, s = this._center[1] * k, r = this._viewportWidth / this._viewportHeight, a = this.cameraToCenterDistance, [c, h] = this.computeNearFar();
    on(this._projectionMatrix, t, r, c, h), bo(this._viewMatrix), Rt(this._viewMatrix, 0, 0, -a), he(this._viewMatrix, -e), sn(this._viewMatrix, n), Rt(this._viewMatrix, 0, 0, -1), he(this._viewMatrix, s), wo(this._viewMatrix, -o), Co(this._viewProjectionMatrix, this._projectionMatrix, this._viewMatrix), this._computeCameraPosition(a, e, n, o, s), this._computeClippingPlane(a, e, n, o, s), this._computeFlatViewProjection(), this._dirty = !1;
  }
  /**
   * Near/far hesapla.
   * dist = cameraToCenterDistance = kamera-yüzey mesafesi (unit sphere).
   * Near: en yakın yüzey noktası dist kadar uzak → dist * 0.5 güvenli margin.
   * Far: kamera → globe arkası = dist + 2 (çap).
   */
  computeNearFar() {
    const t = this.cameraToCenterDistance, e = Math.max(1e-3, t * 0.1), n = t + 2;
    return [e, n];
  }
  /**
   * Flat Mercator VP matrix hesapla — perspective + pitch + bearing.
   * Maps Mercator [0..1] input to clip space.
   * Used for zoom >= 6 where the globe VP camera asymptotically stalls.
   *
   * Matrix chain (right-to-left application):
   *   Perspective(fov, aspect, near, far)
   *     × Translate(0, 0, -cameraDist)    // camera distance in merc space
   *     × RotateX(-pitch)                 // tilt view
   *     × Scale(1, -1, 1)                 // flip Y (merc Y↓ → view Y↑)
   *     × RotateZ(bearing)                // compass rotation
   *     × Translate(-cx, -cy, 0)          // center to origin
   *
   * At pitch=0 this reduces to the equivalent orthographic projection:
   *   ndcX = (2 * worldSize / vpWidth) * (mercX - cx)
   *   ndcY = (2 * worldSize / vpHeight) * (cy - mercY)
   */
  _computeFlatViewProjection() {
    const t = this._flatViewProjectionMatrix, e = this._center[1] * k, n = (this._center[0] + 180) / 360, o = (1 - Math.log(Math.tan(e) + 1 / Math.cos(e)) / Math.PI) / 2, s = 512 * Math.pow(2, this._zoom), r = this._fov * k, a = this._pitch * k, c = this._bearing * k, h = this._viewportWidth / this._viewportHeight, l = 0.5 * this._viewportHeight / Math.tan(r / 2) / s, u = l * 0.05, f = l * 200;
    on(t, r, h, u, f), Rt(t, 0, 0, -l), he(t, -a), t[4] = -t[4], t[5] = -t[5], t[6] = -t[6], t[7] = -t[7], sn(t, c), Rt(t, -n, -o, 0);
  }
  /**
   * Camera position hesapla (unit sphere space).
   * Inverse of view transform, starting from (0,0,0) → apply inverse chain.
   */
  _computeCameraPosition(t, e, n, o, s) {
    let r = 0, a = 0, c = t;
    const h = Math.cos(e), d = Math.sin(e), l = a * h - c * d, u = a * d + c * h;
    a = l, c = u;
    const f = Math.cos(-n), _ = Math.sin(-n), p = r * f - a * _, m = r * _ + a * f;
    r = p, a = m, c += 1;
    const x = Math.cos(-s), y = Math.sin(-s), g = a * x - c * y, v = a * y + c * x;
    a = g, c = v;
    const L = Math.cos(o), M = Math.sin(o), b = r * L + c * M, w = -r * M + c * L;
    r = b, c = w, this._cameraPosition = [r, a, c];
  }
  /**
   * Clipping plane hesapla (horizon occlusion).
   * Plane: dot(surfacePoint, normal) + d ≥ 0 → visible.
   */
  _computeClippingPlane(t, e, n, o, s) {
    const a = this._cameraPosition[0], c = this._cameraPosition[1], h = this._cameraPosition[2], d = Math.sqrt(a * a + c * c + h * h);
    if (d <= 1) {
      this._clippingPlane = [0, 0, 0, -1];
      return;
    }
    const l = 1 / d, u = a / d, f = c / d, _ = h / d;
    this._clippingPlane = [u, f, _, -l];
  }
  /**
   * Clipping plane getter (horizon occlusion).
   * [A, B, C, D] where Ax + By + Cz + D ≥ 0 → visible.
   */
  getClippingPlane() {
    return this._ensureClean(), [...this._clippingPlane];
  }
  /**
   * Screen coordinates → lon/lat.
   * Ray-sphere intersection.
   * Returns null if ray misses globe.
   */
  screenToLonLat(t, e) {
    this._ensureClean();
    const n = 2 * t / this._viewportWidth - 1, o = 1 - 2 * e / this._viewportHeight, s = this._fov * k, r = Math.tan(s / 2), a = this._viewportWidth / this._viewportHeight, c = [
      n * r * a,
      o * r,
      -1
    ], h = this._pitch * k, d = this._bearing * k, l = this._center[0] * k, u = this._center[1] * k;
    let f = Math.sqrt(c[0] ** 2 + c[1] ** 2 + c[2] ** 2), _ = c[0] / f, p = c[1] / f, m = c[2] / f;
    {
      const T = Math.cos(h), E = Math.sin(h), P = p * T - m * E, I = p * E + m * T;
      p = P, m = I;
    }
    {
      const T = Math.cos(-d), E = Math.sin(-d), P = _ * T - p * E, I = _ * E + p * T;
      _ = P, p = I;
    }
    {
      const T = Math.cos(-u), E = Math.sin(-u), P = p * T - m * E, I = p * E + m * T;
      p = P, m = I;
    }
    {
      const T = Math.cos(l), E = Math.sin(l), P = _ * T + m * E, I = -_ * E + m * T;
      _ = P, m = I;
    }
    const x = this._cameraPosition[0], y = this._cameraPosition[1], g = this._cameraPosition[2], v = Lo(x, y, g, _, p, m, 1);
    if (v === null) return null;
    const L = x + v * _, M = y + v * p, b = g + v * m, w = Math.asin(Math.max(-1, Math.min(1, M))) * ce;
    return [Math.atan2(L, b) * ce, w];
  }
  /**
   * lon/lat → screen coordinates (globe projection).
   * Returns null if point is on the back side of the globe.
   */
  lonLatToScreen(t, e) {
    this._ensureClean();
    const [n, o, s] = rn(t, e, 0);
    return cn(n, o, s, this._clippingPlane) ? At(
      this._viewProjectionMatrix,
      n,
      o,
      s,
      this._viewportWidth,
      this._viewportHeight
    ) : null;
  }
  /**
   * lon/lat/altitude → screen coordinates (globe projection).
   * Uses the same meter-to-unit-sphere conversion as the globe shaders.
   */
  lonLatToScreenWithAltitude(t, e, n) {
    this._ensureClean();
    const [o, s, r] = rn(t, e, n);
    return cn(o, s, r, this._clippingPlane) ? At(
      this._viewProjectionMatrix,
      o,
      s,
      r,
      this._viewportWidth,
      this._viewportHeight
    ) : null;
  }
  // ─── Flat Mercator Coordinate Conversion ───
  /**
   * lon/lat → screen coordinates using flat Mercator VP matrix.
   * Used when globeness ≈ 0 (high zoom) where the shader renders with flatViewProjection.
   * Maps lon/lat → Mercator [0..1] → flatVP → clip → NDC → screen.
   */
  lonLatToScreenFlat(t, e) {
    this._ensureClean();
    const [n, o] = an(t, e);
    return At(
      this._flatViewProjectionMatrix,
      n,
      o,
      0,
      this._viewportWidth,
      this._viewportHeight
    );
  }
  /**
   * lon/lat/altitude → screen coordinates using flat Mercator VP matrix.
   */
  lonLatToScreenFlatWithAltitude(t, e, n) {
    this._ensureClean();
    const [o, s] = an(t, e);
    return At(
      this._flatViewProjectionMatrix,
      o,
      s,
      n / O,
      this._viewportWidth,
      this._viewportHeight
    );
  }
  /**
   * Screen coordinates → lon/lat using flat Mercator VP matrix inverse.
   * Used when globeness ≈ 0 (high zoom) where the shader renders with flatViewProjection.
   *
   * Solves: flatVP * (mx, my, 0, 1) = (ndcX * w, ndcY * w, _, w)
   * which gives a 2×2 linear system via Cramer's rule.
   */
  screenToLonLatFlat(t, e) {
    this._ensureClean();
    const n = 2 * t / this._viewportWidth - 1, o = 1 - 2 * e / this._viewportHeight, s = this._flatViewProjectionMatrix, r = s[0] - n * s[3], a = s[4] - n * s[7], c = n * s[15] - s[12], h = s[1] - o * s[3], d = s[5] - o * s[7], l = o * s[15] - s[13], u = r * d - a * h;
    if (Math.abs(u) < 1e-12) return null;
    const f = (c * d - l * a) / u, _ = (r * l - h * c) / u, p = f * 360 - 180, x = (Math.atan(Math.exp(Math.PI - _ * 2 * Math.PI)) * 2 - Math.PI / 2) * ce;
    return x < -85.051129 || x > 85.051129 || p < -180 || p > 180 ? null : [p, x];
  }
}
function bo(i) {
  i.fill(0), i[0] = 1, i[5] = 1, i[10] = 1, i[15] = 1;
}
function on(i, t, e, n, o) {
  const s = 1 / Math.tan(t / 2), r = 1 / (n - o);
  i.fill(0), i[0] = s / e, i[5] = s, i[10] = o * r, i[11] = -1, i[14] = n * o * r;
}
function Rt(i, t, e, n) {
  for (let o = 0; o < 4; o++) {
    const s = i[12 + o];
    i[12 + o] = s + i[o] * t + i[4 + o] * e + i[8 + o] * n;
  }
}
function he(i, t) {
  const e = Math.cos(t), n = Math.sin(t);
  for (let o = 0; o < 4; o++) {
    const s = i[4 + o], r = i[8 + o];
    i[4 + o] = s * e + r * n, i[8 + o] = r * e - s * n;
  }
}
function wo(i, t) {
  const e = Math.cos(t), n = Math.sin(t);
  for (let o = 0; o < 4; o++) {
    const s = i[o], r = i[8 + o];
    i[o] = s * e - r * n, i[8 + o] = s * n + r * e;
  }
}
function sn(i, t) {
  const e = Math.cos(t), n = Math.sin(t);
  for (let o = 0; o < 4; o++) {
    const s = i[o], r = i[4 + o];
    i[o] = s * e + r * n, i[4 + o] = r * e - s * n;
  }
}
function Co(i, t, e) {
  for (let n = 0; n < 4; n++)
    for (let o = 0; o < 4; o++) {
      let s = 0;
      for (let r = 0; r < 4; r++)
        s += t[r * 4 + o] * e[n * 4 + r];
      i[n * 4 + o] = s;
    }
}
function Lo(i, t, e, n, o, s, r) {
  const a = 2 * (i * n + t * o + e * s), c = i * i + t * t + e * e - r * r, h = a * a - 4 * c;
  if (h < 0) return null;
  const d = Math.sqrt(h), l = (-a - d) / 2, u = (-a + d) / 2;
  return l > 0 ? l : u > 0 ? u : null;
}
function rn(i, t, e) {
  const n = i * k, o = t * k, s = Math.cos(o), r = 1 + e / O;
  return [
    s * Math.sin(n) * r,
    Math.sin(o) * r,
    s * Math.cos(n) * r
  ];
}
function an(i, t) {
  const e = t * k, n = (i + 180) / 360, o = Math.sin(e), s = Math.max(-0.9999, Math.min(0.9999, o)), r = (1 - Math.log((1 + s) / (1 - s)) / (2 * Math.PI)) / 2;
  return [n, r];
}
function cn(i, t, e, n) {
  return i * n[0] + t * n[1] + e * n[2] + n[3] >= 0;
}
function At(i, t, e, n, o, s) {
  const r = i[0] * t + i[4] * e + i[8] * n + i[12], a = i[1] * t + i[5] * e + i[9] * n + i[13], c = i[3] * t + i[7] * e + i[11] * n + i[15];
  if (c <= 0) return null;
  const h = r / c, d = a / c;
  return [
    (h + 1) * 0.5 * o,
    (1 - d) * 0.5 * s
  ];
}
function To(i) {
  const t = Math.max(1, i.viewportWidth), e = Math.max(1, i.viewportHeight), n = i.tolerancePx ?? 0.5, o = i.maxIterations ?? 8, s = t * 0.5, r = e * 0.5;
  let a = [...i.center];
  for (let c = 0; c < o; c++) {
    const h = zn(i, a, t, e), d = In(h, i.zoom, i.targetCenter, i.targetAltitude);
    if (!d) {
      if (!Bt(a[0], i.targetCenter[0], 1e-9) || !Bt(a[1], i.targetCenter[1], 1e-9)) {
        a = [...i.targetCenter];
        continue;
      }
      return a;
    }
    const l = d[0] - s, u = d[1] - r;
    if (Math.abs(l) <= n && Math.abs(u) <= n)
      return a;
    const f = Po(i, a, t, e);
    if (!f)
      return a;
    const _ = f.dScreenXDLon * f.dScreenYDLat - f.dScreenXDLat * f.dScreenYDLon;
    if (Math.abs(_) < 1e-9)
      return a;
    const p = (l * f.dScreenYDLat - u * f.dScreenXDLat) / _, m = (f.dScreenXDLon * u - f.dScreenYDLon * l) / _, x = [
      Fn(a[0] - Gt(p, -1, 1)),
      Gt(a[1] - Gt(m, -1, 1), -85.051129, 85.051129)
    ];
    if (Bt(a[0], x[0], 1e-9) && Bt(a[1], x[1], 1e-9))
      return a;
    a = x;
  }
  return a;
}
function In(i, t, e, n) {
  const o = W.globenessFromZoom(t), [s, r] = e;
  if (o >= 0.999)
    return i.lonLatToScreenWithAltitude(s, r, n);
  if (o <= 1e-3)
    return i.lonLatToScreenFlatWithAltitude(s, r, n);
  const a = i.lonLatToScreenWithAltitude(s, r, n), c = i.lonLatToScreenFlatWithAltitude(s, r, n);
  return c ? a ? [
    c[0] + (a[0] - c[0]) * o,
    c[1] + (a[1] - c[1]) * o
  ] : c : a;
}
function zn(i, t, e, n) {
  return new Dn({
    center: t,
    zoom: i.zoom,
    pitch: i.pitch,
    bearing: i.bearing,
    viewportWidth: e,
    viewportHeight: n
  });
}
function Po(i, t, e, n) {
  const s = le(i, t, e, n), r = le(
    i,
    [Fn(t[0] + 1e-3), t[1]],
    e,
    n
  ), a = le(
    i,
    [t[0], Gt(t[1] + 1e-3, -85.051129, 85.051129)],
    e,
    n
  );
  return !s || !r || !a ? null : {
    dScreenXDLon: (r[0] - s[0]) / 1e-3,
    dScreenXDLat: (a[0] - s[0]) / 1e-3,
    dScreenYDLon: (r[1] - s[1]) / 1e-3,
    dScreenYDLat: (a[1] - s[1]) / 1e-3
  };
}
function le(i, t, e, n) {
  const o = zn(i, t, e, n);
  return In(o, i.zoom, i.targetCenter, i.targetAltitude);
}
function Fn(i) {
  let t = ((i + 180) % 360 + 360) % 360 - 180;
  return t === -180 && i > 0 && (t = 180), t;
}
function Gt(i, t, e) {
  return Math.max(t, Math.min(e, i));
}
function Bt(i, t, e) {
  return Math.abs(i - t) <= e;
}
function kn(i, t, e) {
  let n = !0, o = null;
  const s = () => {
    n = !1, o !== null && (clearTimeout(o), o = null);
  };
  return { promise: new Promise((a) => {
    const c = Date.now(), h = () => {
      if (!n || !e()) {
        a();
        return;
      }
      const d = Date.now() - c, l = Math.min(1, d / i), u = l < 0.5 ? 2 * l * l : 1 - Math.pow(-2 * l + 2, 2) / 2;
      t(u), l >= 1 ? (n = !1, o = null, a()) : o = setTimeout(h, 16);
    };
    h();
  }), cancel: s };
}
function So(i) {
  return typeof i == "object" && i !== null && i.type === "vector-tile" && typeof i.getVisibleRenderTiles == "function";
}
function Rn(i, t) {
  const e = [], n = [], o = [], s = [], r = [], a = [], c = [], h = [], l = i.getLayerIds().map((u) => ({ id: u, layer: i.getLayer(u) })).filter(({ layer: u }) => u !== void 0).sort((u, f) => (u.layer.zIndex ?? 0) - (f.layer.zIndex ?? 0));
  for (const { id: u, layer: f } of l)
    if (!(!f || !f.visible || !f.loaded)) {
      if (gn(f)) {
        a.push(u);
        continue;
      }
      if (pn(f)) {
        r.push(u);
        continue;
      }
      if (we(f)) {
        n.push(u);
        continue;
      }
      if (yn(f) || Xt(f)) {
        h.push(u);
        continue;
      }
      if (f.type === "vector-tile") {
        const _ = t !== void 0 ? Math.floor(t) : void 0;
        if (_ !== void 0 && _ < f.minZoom)
          continue;
        Ct(f) && c.push(u);
        continue;
      }
      if (mn(f)) {
        if (t !== void 0 && (t < f.minZoom || t > f.maxZoom))
          continue;
        e.push({
          sourceId: u,
          getTileUrl: (_, p, m) => f.getTileUrl(_, p, m),
          opacity: f.opacity,
          minZoom: f.minZoom,
          maxZoom: f.maxZoom,
          filters: f.filters
        });
      }
      Ct(f) && o.push(u), be(f) && s.push(u);
    }
  return { tileSources: e, terrainLayerIds: n, vectorLayerIds: o, customLayerIds: s, clusterLayerIds: r, dynamicPointLayerIds: a, vectorTileLayerIds: c, overlayLayerIds: h };
}
function An(i, t, e, n) {
  const o = e.getLayer(i);
  if (!o || !gn(o) || !o.positionBuffer || o.pointCount === 0) return;
  const s = { vertexBuffer: o.positionBuffer, count: o.pointCount };
  n ? t.drawGlobePoints(s, o.pointSymbol) : t.drawPoints(s, o.pointSymbol);
}
function J(i, t) {
  return t >= 1 ? i : { ...i, color: [i.color[0], i.color[1], i.color[2], i.color[3] * t] };
}
function Eo(i) {
  return !!i && i.type === "wall" && typeof i.bindRenderEngine == "function" && typeof i.hasIncrementalBuffer == "function" && typeof i.rebuildWithTerrain == "function";
}
function Bn(i, t, e, n, o, s, r) {
  const a = e.getLayer(i);
  if (!a || !Ct(a)) return;
  const c = o ? "3d" : "2d";
  if (t.setCurrentLayerId(i), Eo(a)) {
    a.bindRenderEngine(t);
    const f = "elevationInfo" in a ? a.elevationInfo : void 0;
    f && f.mode !== "absolute" && r && a.rebuildWithTerrain(f, r);
    const p = a.getIncrementalRenderBuffer();
    if (p && p.indexCount > 0) {
      const x = a.getWallSymbol();
      o ? t.drawGlobeMesh3D(p, x) : t.drawMesh3D(p, x);
    }
    const m = a.getFeatures();
    if (m.length > 0) {
      const x = n.getOrBuild(i, m, a.renderer, s, a, c, f, r);
      if (x) {
        const y = a.opacity;
        if (o)
          for (const g of x.lineGroups) t.drawGlobeLines(g.buffer, J(g.symbol, y));
        else
          for (const g of x.lineGroups) t.drawLines(g.buffer, J(g.symbol, y));
      }
    }
    return;
  }
  const h = a.getFeatures();
  if (h.length === 0) return;
  const d = "elevationInfo" in a ? a.elevationInfo : void 0, l = n.getOrBuild(i, h, a.renderer, s, a, c, d, r);
  if (!l) return;
  const u = a.opacity;
  if (o) {
    for (const f of l.polygonGroups) t.drawGlobePolygons(f.buffer, J(f.symbol, u));
    for (const f of l.lineGroups) t.drawGlobeLines(f.buffer, J(f.symbol, u));
    for (const f of l.pointGroups) t.drawGlobePoints(f.buffer, J(f.symbol, u));
    for (const f of l.modelGroups) t.drawGlobeModels(f.buffer, f.symbol);
    for (const f of l.extrusionGroups) t.drawGlobeExtrusion(f.buffer, f.symbol);
    for (const f of l.mesh3dGroups) t.drawGlobeMesh3D(f.buffer, f.symbol);
  } else {
    for (const f of l.polygonGroups) t.drawPolygons(f.buffer, J(f.symbol, u));
    for (const f of l.lineGroups) t.drawLines(f.buffer, J(f.symbol, u));
    for (const f of l.pointGroups) t.drawPoints(f.buffer, J(f.symbol, u));
    for (const f of l.modelGroups) t.drawModels(f.buffer, f.symbol);
    for (const f of l.extrusionGroups) t.drawExtrusion(f.buffer, f.symbol);
    for (const f of l.mesh3dGroups) t.drawMesh3D(f.buffer, f.symbol);
  }
}
function Zn(i, t, e, n, o, s) {
  const r = e.getLayer(i);
  if (!r || !So(r)) return;
  const a = o ? "3d" : "2d";
  t.setCurrentLayerId(i);
  const c = r.getVisibleRenderTiles();
  if (c.length === 0) {
    n.pruneTileEntries(i, o, []);
    return;
  }
  const h = /* @__PURE__ */ new Set();
  for (const d of c) {
    h.add(d.key);
    let l = o && d.binaryPayload ? n.getOrBuildTileBinary(
      {
        layerId: i,
        tileKey: d.key,
        version: d.version,
        renderer: r.renderer,
        zoom: s,
        globe: o,
        renderMode: a
      },
      d.binaryPayload
    ) : null;
    if (!l && d.features.length > 0 && (l = n.getOrBuildTile(
      {
        layerId: i,
        tileKey: d.key,
        version: d.version,
        renderer: r.renderer,
        zoom: s,
        globe: o,
        renderMode: a
      },
      d.features
    )), !!l)
      if (o) {
        for (const u of l.polygonGroups) t.drawGlobePolygons(u.buffer, u.symbol);
        for (const u of l.lineGroups) t.drawGlobeLines(u.buffer, u.symbol);
        for (const u of l.pointGroups) t.drawGlobePoints(u.buffer, u.symbol);
        for (const u of l.modelGroups) t.drawGlobeModels(u.buffer, u.symbol);
        for (const u of l.extrusionGroups) t.drawGlobeExtrusion(u.buffer, u.symbol);
      } else {
        for (const u of l.polygonGroups) t.drawPolygons(u.buffer, u.symbol);
        for (const u of l.lineGroups) t.drawLines(u.buffer, u.symbol);
        for (const u of l.pointGroups) t.drawPoints(u.buffer, u.symbol);
        for (const u of l.modelGroups) t.drawModels(u.buffer, u.symbol);
        for (const u of l.extrusionGroups) t.drawExtrusion(u.buffer, u.symbol);
      }
  }
  n.pruneTileEntries(i, o, h);
}
function Hn(i, t, e, n, o) {
  const s = e.getLayer(i);
  if (!s || !be(s)) return;
  const r = s.getDrawCommand(), a = s.getCustomUniforms(), c = s.getTextures(), h = n(s, a, c), d = a !== null, l = c.length > 0, u = `custom:${i}:${s.vertexShader.length}:${s.fragmentShader.length}:${s.vertexBufferLayouts.length}:${String(d)}:${String(l)}${o ? ":globe" : ""}`, f = performance.now() / 1e3, _ = new Float32Array(4);
  _[0] = f, _[1] = 0.016, _[2] = 0, _[3] = s.opacity;
  const p = {
    pipelineKey: u,
    shaderSource: h,
    vertexBufferLayouts: s.vertexBufferLayouts,
    vertexBuffers: s.getVertexBuffers(),
    indexBuffer: s.getIndexBuffer(),
    indexFormat: r.indexFormat,
    frameUniforms: _,
    customUniforms: a,
    textures: c,
    vertexCount: r.vertexCount,
    instanceCount: r.instanceCount,
    indexCount: r.indexCount,
    topology: r.topology,
    blendState: s.blendState,
    ...o ? { useGlobeCamera: !0 } : {}
  };
  t.drawCustom(p);
}
function Gn(i, t, e, n, o, s, r) {
  const a = e.getLayer(i);
  if (!a || !pn(a)) return;
  r && a.attachView(r);
  const c = a.getSourcePoints3857();
  !c || c.length === 0 || (t.setClusterSource(i, c, a.sourceVersion), t.drawClusters(i, a.clusterStyle, a.clusterRadius, a.clusterMinPoints, n, o, s));
}
const tt = 20037508342789244e-9;
function Wn(i, t, e, n, o) {
  const s = e.getLayer(i);
  if (!s) return;
  let r, a;
  if (yn(s)) {
    const f = s.imageData;
    if (!f) return;
    a = s.bounds;
    const _ = n.get(i);
    _ && _.source === f ? r = _.texture : (_ && t.releaseTexture(_.texture), r = t.createTexture(f), n.set(i, { texture: r, source: f, videoWidth: 0, videoHeight: 0 }));
  } else if (Xt(s)) {
    const f = s.videoElement;
    if (!f || f.readyState < 2) return;
    a = s.bounds;
    const _ = n.get(i);
    _ && _.videoWidth === f.videoWidth && _.videoHeight === f.videoHeight ? (t.updateTextureFromVideo(_.texture, f), r = _.texture) : (_ && t.releaseTexture(_.texture), r = t.createTextureFromVideo(f), n.set(i, { texture: r, source: null, videoWidth: f.videoWidth, videoHeight: f.videoHeight }));
  }
  if (!r || !a) return;
  const [c, h, d, l] = a, u = s.opacity;
  if (o) {
    const [f, _] = B(c, h), [p, m] = B(d, l), x = (f + tt) / (2 * tt), y = (p + tt) / (2 * tt), g = 1 - (m + tt) / (2 * tt), v = 1 - (_ + tt) / (2 * tt);
    t.drawGlobeTile({
      texture: r,
      mercatorExtent: [x, g, y, v],
      opacity: u,
      depthBias: 1e-3
    });
  } else {
    const [f, _] = B(c, h), [p, m] = B(d, l);
    t.drawImagery({
      texture: r,
      extent: [f, _, p, m],
      opacity: u
    });
  }
}
class hn {
  /** @see IViewMode.type */
  type = "2d";
  /** Internal 2D camera controller (Mercator coordinates). */
  _camera;
  /** Active interaction handler, or null if not attached. */
  _interaction = null;
  /** Current animation handle, or null if idle. */
  _anim = null;
  /** Whether this mode has been disposed. */
  _destroyed = !1;
  /** Stored markDirty callback for cluster click-triggered goTo. */
  _markDirty = null;
  /** Stored onViewChange callback for cluster-triggered goTo. */
  _onViewChange = null;
  /** Cached GPU textures for image/video overlay layers. */
  _overlayTextureCache = /* @__PURE__ */ new Map();
  /**
   * Create a new Mode2D instance.
   *
   * The provided center [lon, lat] is converted to EPSG:3857 internally.
   * Rotation is converted from degrees to radians for the underlying camera.
   *
   * @param options - Initial view configuration. Defaults to center [0,0], zoom 0.
   */
  constructor(t = {}) {
    const e = t.center ?? [0, 0], [n, o] = B(e[0], e[1]);
    this._camera = new li({
      center: [n, o],
      zoom: t.zoom ?? 0,
      rotation: t.rotation ? t.rotation * Math.PI / 180 : 0,
      minZoom: t.minZoom,
      maxZoom: t.maxZoom,
      viewportWidth: t.viewportWidth ?? 800,
      viewportHeight: t.viewportHeight ?? 600
    });
  }
  // ─── State ───
  /**
   * Apply a partial view state update to the camera.
   *
   * Center coordinates are converted from [lon, lat] to EPSG:3857.
   * Rotation is converted from degrees to radians. Pitch and bearing
   * fields are silently ignored in 2D mode.
   *
   * @param state - Partial view state to apply.
   * @see IViewMode.setState
   */
  setState(t) {
    if (t.center) {
      const [e, n] = B(t.center[0], t.center[1]);
      this._camera.setCenter([e, n]);
    }
    t.zoom !== void 0 && this._camera.setZoom(t.zoom), t.rotation !== void 0 && this._camera.setRotation(t.rotation * Math.PI / 180);
  }
  /**
   * Read the current view state.
   *
   * Returns the center in [lon, lat] (EPSG:4326), the current zoom level,
   * and the rotation in degrees. Pitch and bearing are always 0 in 2D mode.
   *
   * @returns The current serializable view state.
   * @see IViewMode.getState
   */
  getState() {
    const t = this._camera.center, [e, n] = _e(t[0], t[1]);
    return {
      center: [e, n],
      zoom: this._camera.zoom,
      pitch: 0,
      bearing: 0,
      rotation: this._camera.rotation * 180 / Math.PI
    };
  }
  /**
   * Build the CameraState for the render engine's beginFrame() call.
   *
   * Provides the orthographic view/projection matrices, camera position
   * (center in EPSG:3857 at z=0), and viewport dimensions.
   *
   * @returns The camera state suitable for the WebGPU render engine.
   * @see IViewMode.getCameraState
   */
  getCameraState() {
    return {
      viewMatrix: this._camera.viewMatrix,
      projectionMatrix: this._camera.projectionMatrix,
      position: [this._camera.center[0], this._camera.center[1], 0],
      viewportWidth: this._camera.viewportWidth,
      viewportHeight: this._camera.viewportHeight
    };
  }
  /**
   * Update the viewport dimensions (e.g. on canvas resize).
   *
   * Propagates the new size to the underlying camera controller,
   * which recalculates the projection matrix.
   *
   * @param width - New viewport width in pixels.
   * @param height - New viewport height in pixels.
   * @see IViewMode.setViewport
   */
  setViewport(t, e) {
    this._camera.setViewport(t, e);
  }
  /** Expose camera for advanced use (e.g. extent computation) */
  get camera() {
    return this._camera;
  }
  // ─── Navigation ───
  /**
   * Animate the camera to a target view state.
   *
   * Uses ease-in-out (quadratic) interpolation over the specified duration.
   * Interpolates center (in EPSG:3857), zoom, and rotation simultaneously.
   * If duration is 0, the transition is applied immediately without animation.
   *
   * Only center, zoom, and rotation fields from the target are used;
   * pitch and bearing are ignored in 2D mode.
   *
   * Any in-progress animation is cancelled before starting a new one.
   *
   * @param target - The navigation target describing the desired end state.
   * @param markDirty - Callback to flag the view as needing a re-render.
   * @param onViewChange - Callback to notify listeners of a view state change.
   * @returns A promise that resolves when the animation completes or is cancelled.
   * @throws Error if the mode has been disposed.
   * @see IViewMode.goTo
   */
  goTo(t, e, n) {
    if (this._destroyed) return Promise.reject(new Error("Mode disposed"));
    const o = t.duration ?? 500;
    this.cancelAnimation();
    const s = t.center ? B(t.center[0], t.center[1]) : this._camera.center, r = t.zoom ?? this._camera.zoom, a = t.rotation !== void 0 ? t.rotation * Math.PI / 180 : this._camera.rotation;
    if (o <= 0)
      return this._camera.setCenter(s), this._camera.setZoom(r), this._camera.setRotation(a), e(), n(), Promise.resolve();
    const c = this._camera.center, h = this._camera.zoom, d = this._camera.rotation;
    return this._anim = kn(o, (l) => {
      const u = c[0] + (s[0] - c[0]) * l, f = c[1] + (s[1] - c[1]) * l;
      this._camera.setCenter([u, f]), this._camera.setZoom(h + (r - h) * l), this._camera.setRotation(d + (a - d) * l), e(), n();
    }, () => !this._destroyed), this._anim.promise;
  }
  /**
   * Cancel any in-progress goTo animation.
   *
   * Clears the animation flag and cancels the pending setTimeout.
   * The animation promise resolves on the next scheduled step.
   *
   * @see IViewMode.cancelAnimation
   */
  cancelAnimation() {
    this._anim?.cancel(), this._anim = null;
  }
  // ─── Rendering ───
  /**
   * Render a single frame in 2D mode.
   *
   * Performs the following steps:
   * 1. Computes the viewport extent in EPSG:3857 from the camera.
   * 2. Classifies visible layers into tile (raster), feature (vector),
   *    and custom shader categories.
   * 3. Fetches and draws ready raster tiles via TileManager.
   * 4. Draws vector features (polygons, lines, points) via VectorBufferCache.
   * 5. Draws custom WGSL shader layers.
   *
   * Called by the RenderLoop between beginFrame() and endFrame().
   *
   * @param ctx - Shared rendering resources (render engine, managers, caches).
   * @see IViewMode.renderFrame
   */
  renderFrame(t) {
    const {
      renderEngine: e,
      layerManager: n,
      tileManager: o,
      terrainManager: s,
      tileScheduler: r,
      bufferCache: a
    } = t, c = this._camera.getExtent(), h = Math.round(this._camera.zoom), d = Math.max(0, Math.floor(this._camera.zoom)), {
      tileSources: l,
      terrainLayerIds: u,
      vectorLayerIds: f,
      customLayerIds: _,
      clusterLayerIds: p,
      dynamicPointLayerIds: m,
      vectorTileLayerIds: x,
      overlayLayerIds: y
    } = Rn(n, this._camera.zoom), g = this._resolveActiveTerrainLayer(n, u);
    s.setActiveLayer(g?.id ?? null);
    const v = r.getTilesForExtent(c, d).map((b) => ({ z: b.z, x: b.x, y: b.y }));
    g && v.length > 0 && s.requestTiles(g, v);
    let L = [];
    if (l.length > 0) {
      L = o.getReadyTiles(c, h, l);
      for (const b of L)
        e.drawImagery(b);
    }
    if (g) {
      const b = /* @__PURE__ */ new Set(), w = (C, T, E) => {
        const P = s.getReadyHillshadeTile(g, C, T, E);
        if (!P) return;
        const I = P.sourceCoord, D = `${I.z}/${I.x}/${I.y}`;
        b.has(D) || (b.add(D), e.drawImagery({
          texture: P.texture,
          extent: Io(I.z, I.x, I.y),
          opacity: g.opacity
        }));
      };
      for (const C of v)
        w(C.z, C.x, C.y);
    }
    const M = new Set(y);
    for (const [b, w] of this._overlayTextureCache)
      M.has(b) || (e.releaseTexture(w.texture), this._overlayTextureCache.delete(b));
    for (const b of y)
      Wn(b, e, n, this._overlayTextureCache, !1);
    for (const b of y) {
      const w = n.getLayer(b);
      if (w && Xt(w)) {
        const C = w.videoElement;
        if (C && !C.paused && !C.ended) {
          this._markDirty?.();
          break;
        }
      }
    }
    for (const b of x) {
      const w = n.getLayer(b);
      if (!w || !("updateVisibleTiles" in w)) continue;
      const C = w.maxZoom ?? h, T = Math.min(h, C), E = r.getTilesForExtent(c, T).map((P) => ({ z: P.z, x: P.x, y: P.y }));
      w.updateVisibleTiles(E, {
        renderMode: "2d",
        zoom: this._camera.zoom
      });
    }
    for (const b of x)
      Zn(b, e, n, a, !1, this._camera.zoom);
    for (const b of f)
      Bn(b, e, n, a, !1, this._camera.zoom);
    for (const b of _)
      Hn(b, e, n, (w, C, T) => this._buildCustomShaderSource(w, C, T), !1);
    if (p.length > 0) {
      const b = [c.minX, c.minY, c.maxX, c.maxY], w = this._markDirty ? {
        toMap: (C, T) => this.toMap(C, T),
        toScreen: (C, T) => this.toScreen(C, T),
        getZoom: () => this._camera.zoom,
        getExtent: () => [c.minX, c.minY, c.maxX, c.maxY],
        getViewportSize: () => [this._camera.viewportWidth, this._camera.viewportHeight],
        goTo: (C) => this.goTo(
          C,
          this._markDirty,
          this._onViewChange ?? (() => {
          })
        )
      } : void 0;
      for (const C of p)
        Gn(C, e, n, this._camera.zoom, b, !1, w);
    }
    for (const b of m)
      An(b, e, n, !1);
  }
  _resolveActiveTerrainLayer(t, e) {
    for (let n = e.length - 1; n >= 0; n--) {
      const o = e[n];
      if (!o) continue;
      const s = t.getLayer(o);
      if (s && we(s)) return s;
    }
    return null;
  }
  /**
   * Build WGSL shader source with preamble for a custom shader layer.
   */
  _buildCustomShaderSource(t, e, n) {
    if (t.rawMode === !0)
      return t.vertexShader + `
` + t.fragmentShader;
    let o = `struct CameraUniforms {
  viewProjection: mat4x4<f32>,
  viewport: vec2<f32>,
};
@group(0) @binding(0) var<uniform> camera: CameraUniforms;

struct FrameUniforms {
  time: f32,
  deltaTime: f32,
  frameNumber: f32,
  opacity: f32,
};
@group(1) @binding(0) var<uniform> frame: FrameUniforms;

`;
    return e !== null && (o += `@group(2) @binding(0) var<uniform> custom: CustomUniforms;

`), n.length > 0 && (o += `@group(3) @binding(0) var texSampler: sampler;
@group(3) @binding(1) var texInput: texture_2d<f32>;

`), o += `fn projectMercator(pos: vec2<f32>) -> vec4<f32> {
  return camera.viewProjection * vec4<f32>(pos, 0.0, 1.0);
}

`, o + t.vertexShader + `
` + t.fragmentShader;
  }
  // ─── Interaction ───
  /**
   * Attach pointer and keyboard interaction handlers to a DOM container.
   *
   * Creates an {@link InteractionHandler} that translates mouse/touch/keyboard
   * events into camera pan, zoom, and rotation operations. Pass `false` for
   * the options parameter to skip attaching interaction entirely.
   *
   * @param container - The HTML element to listen for input events on.
   * @param markDirty - Callback to flag the view as needing a re-render.
   * @param onViewChange - Callback to notify listeners of a view state change.
   * @param options - Interaction configuration, or `false` to disable.
   * @see IViewMode.attachInteraction
   */
  attachInteraction(t, e, n, o) {
    this._markDirty = e, this._onViewChange = n, o !== !1 && (this._interaction = new bi(
      t,
      this._camera,
      e,
      n,
      o
    ));
  }
  // ─── Coordinate Conversion ───
  /**
   * Convert screen pixel coordinates to geographic [longitude, latitude].
   *
   * Unprojects the screen position through the 2D camera to EPSG:3857,
   * then converts to EPSG:4326 (lon/lat).
   *
   * @param screenX - Horizontal pixel position relative to the canvas.
   * @param screenY - Vertical pixel position relative to the canvas.
   * @returns Geographic coordinates as [longitude, latitude].
   * @see IViewMode.toMap
   */
  toMap(t, e) {
    const [n, o] = this._camera.screenToMap(t, e);
    return _e(n, o);
  }
  /**
   * Convert geographic coordinates to screen pixel position.
   *
   * Projects [longitude, latitude] through EPSG:3857 and the 2D camera
   * to obtain canvas pixel coordinates.
   *
   * @param lon - Longitude in degrees.
   * @param lat - Latitude in degrees.
   * @returns Screen coordinates as [x, y] in pixels.
   * @see IViewMode.toScreen
   */
  toScreen(t, e) {
    const [n, o] = B(t, e);
    return this._camera.mapToScreen(n, o);
  }
  // ─── Lifecycle ───
  /**
   * Dispose of all mode-specific resources.
   *
   * Cancels any in-progress animation, destroys the interaction handler,
   * and marks the mode as destroyed. Subsequent calls are no-ops.
   *
   * @see IViewMode.dispose
   */
  dispose() {
    if (!this._destroyed) {
      this._destroyed = !0, this.cancelAnimation(), this._interaction?.destroy(), this._interaction = null, this._onViewChange = null;
      for (const t of this._overlayTextureCache.values())
        t.texture.destroy();
      this._overlayTextureCache.clear();
    }
  }
}
const ve = 20037508342789244e-9, Do = ve * 2;
function Io(i, t, e) {
  const n = Math.pow(2, i), o = Do / n, s = t * o - ve, r = ve - e * o, a = s + o, c = r - o;
  return [s, c, a, r];
}
class $t {
  /** Bounding planes — inward-pointing normals. Point is inside if dot(n, p) + d ≥ 0 for all planes. */
  planes;
  /** Bounding sphere center (for quick rejection) */
  sphereCenter;
  /** Bounding sphere radius */
  sphereRadius;
  constructor(t, e, n) {
    this.planes = t, this.sphereCenter = e, this.sphereRadius = n;
  }
  /**
   * Tile'ın Mercator koordinatlarından ConvexVolume oluştur.
   *
   * @param z - zoom level
   * @param x - tile column
   * @param y - tile row
   */
  static fromTile(t, e, n) {
    const o = Math.pow(2, t), s = e / o, r = (e + 1) / o, a = n / o, c = (n + 1) / o, h = xt(s, a), d = xt(r, a), l = xt(s, c), u = xt(r, c), f = [(s + r) / 2, (a + c) / 2], _ = xt(f[0], f[1]), p = [
      // Top edge: c00 → c10 (my0 = north boundary)
      Zt(h, d, _),
      // Right edge: c10 → c11
      Zt(d, u, _),
      // Bottom edge: c11 → c01 (my1 = south boundary)
      Zt(u, l, _),
      // Left edge: c01 → c00
      Zt(l, h, _)
    ], m = {
      a: -_[0],
      b: -_[1],
      c: -_[2],
      d: 1
    }, x = [h, d, l, u].map(
      (M) => M[0] * _[0] + M[1] * _[1] + M[2] * _[2]
    ), y = Math.min(...x), g = {
      a: _[0],
      b: _[1],
      c: _[2],
      d: -y
    }, v = [...p, m, g], L = Math.max(
      Ht(_, h),
      Ht(_, d),
      Ht(_, l),
      Ht(_, u)
    );
    return new $t(v, _, L);
  }
  /**
   * Test: ConvexVolume frustum ile kesişiyor mu?
   *
   * Quick sphere test + detailed plane-vertex test.
   * Returns true if potentially visible.
   */
  intersectsFrustum(t) {
    for (const e of t)
      if (e.a * this.sphereCenter[0] + e.b * this.sphereCenter[1] + e.c * this.sphereCenter[2] + e.d < -this.sphereRadius) return !1;
    return !0;
  }
  /**
   * Test: Tile horizon clipping plane ile görünür mü?
   *
   * Clipping plane format: [A, B, C, D] where Ax + By + Cz + D ≥ 0 → visible.
   * Returns true if any part of the tile is on the visible side.
   */
  intersectsClippingPlane(t) {
    return t[0] * this.sphereCenter[0] + t[1] * this.sphereCenter[1] + t[2] * this.sphereCenter[2] + t[3] > -this.sphereRadius;
  }
  /**
   * Combined visibility test: frustum + clipping plane.
   */
  isVisible(t, e) {
    return this.intersectsClippingPlane(e) && this.intersectsFrustum(t);
  }
}
function xt(i, t) {
  const [e, n] = W.mercatorToAngular(i, t);
  return W.angularToSphere(e, n);
}
function Zt(i, t, e) {
  let n = i[1] * t[2] - i[2] * t[1], o = i[2] * t[0] - i[0] * t[2], s = i[0] * t[1] - i[1] * t[0];
  const r = Math.sqrt(n * n + o * o + s * s);
  return r < 1e-15 ? { a: 0, b: 0, c: 0, d: 0 } : (n /= r, o /= r, s /= r, n * e[0] + o * e[1] + s * e[2] < 0 && (n = -n, o = -o, s = -s), { a: n, b: o, c: s, d: 0 });
}
function Ht(i, t) {
  const e = i[0] - t[0], n = i[1] - t[1], o = i[2] - t[2];
  return Math.sqrt(e * e + n * n + o * o);
}
class zo {
  _maxZoom;
  _minZoom;
  constructor(t) {
    this._maxZoom = t?.maxZoom ?? 22, this._minZoom = t?.minZoom ?? 0;
  }
  /**
   * Globe kamerası için gerekli tile'ları hesapla.
   *
   * @param transform - Globe kamerası (VP matris, clipping plane)
   * @param targetZoom - Hedef zoom seviyesi (genellikle floor(transform.zoom))
   * @returns Visible tile koordinatları
   */
  getTilesForGlobe(t, e) {
    const n = Math.max(this._minZoom, Math.min(this._maxZoom, Math.floor(e))), o = pi(t.viewProjectionMatrix), s = t.getClippingPlane(), r = [];
    if (n === 0)
      return $t.fromTile(0, 0, 0).isVisible(o, s) && r.push({ z: 0, x: 0, y: 0 }), r;
    const a = this._minZoom, c = a === 0 ? [{ z: 0, x: 0, y: 0 }] : this._tilesAtZoom(a);
    for (const h of c)
      this._subdivide(h.z, h.x, h.y, n, o, s, r);
    return r;
  }
  /**
   * Recursive subdivision.
   * Tile'ı visible ise ve hedef zoom'a ulaşmadıysa 4 çocuğa böl.
   */
  _subdivide(t, e, n, o, s, r, a) {
    if (!$t.fromTile(t, e, n).isVisible(s, r))
      return;
    if (t >= o) {
      a.push({ z: t, x: e, y: n });
      return;
    }
    const h = t + 1, d = e * 2, l = n * 2;
    this._subdivide(h, d, l, o, s, r, a), this._subdivide(h, d + 1, l, o, s, r, a), this._subdivide(h, d, l + 1, o, s, r, a), this._subdivide(h, d + 1, l + 1, o, s, r, a);
  }
  /**
   * Generate all tiles at a given zoom level.
   */
  _tilesAtZoom(t) {
    const e = Math.pow(2, t), n = [];
    for (let o = 0; o < e; o++)
      for (let s = 0; s < e; s++)
        n.push({ z: t, x: o, y: s });
    return n;
  }
  /**
   * Get the tile coordinate that contains a given lon/lat at the specified zoom.
   */
  static tileForLonLat(t, e, n) {
    const o = Math.floor(n), s = Math.pow(2, o), r = Math.floor((t + 180) / 360 * s), a = e * (Math.PI / 180), c = Math.floor(
      (1 - Math.log(Math.tan(a) + 1 / Math.cos(a)) / Math.PI) / 2 * s
    );
    return {
      z: o,
      x: Math.max(0, Math.min(s - 1, r)),
      y: Math.max(0, Math.min(s - 1, c))
    };
  }
  /**
   * Get the lon/lat bounds of a tile.
   */
  static tileBounds(t, e, n) {
    const o = Math.pow(2, t), s = e / o * 360 - 180, r = (e + 1) / o * 360 - 180, a = ln(n, o), c = ln(n + 1, o);
    return { west: s, east: r, north: a, south: c };
  }
}
function ln(i, t) {
  return Math.atan(Math.sinh(Math.PI - 2 * Math.PI * i / t)) * (180 / Math.PI);
}
class Fo {
  _element;
  _transform;
  _onDirty;
  _onViewChange;
  // Feature flags
  _panEnabled;
  _zoomEnabled;
  _keyboardEnabled;
  _doubleClickZoom;
  _pitchBearingEnabled;
  _zoomSpeed;
  _getGlobeness;
  // Pan state
  _dragging = !1;
  _lastPointerX = 0;
  _lastPointerY = 0;
  _activePointerId = null;
  _dragButton = 0;
  // Pinch zoom state
  _pointers = /* @__PURE__ */ new Map();
  _lastPinchDist = 0;
  // Double-click detection
  _lastClickTime = 0;
  // Bound handlers
  _onPointerDown;
  _onPointerMove;
  _onPointerUp;
  _onWheel;
  _onKeyDown;
  _onContextMenu;
  _destroyed = !1;
  constructor(t, e, n, o, s) {
    this._element = t, this._transform = e, this._onDirty = n, this._onViewChange = o, this._panEnabled = s?.pan ?? !0, this._zoomEnabled = s?.zoom ?? !0, this._keyboardEnabled = s?.keyboard ?? !0, this._doubleClickZoom = s?.doubleClickZoom ?? !0, this._pitchBearingEnabled = s?.pitchBearing ?? !0, this._zoomSpeed = s?.zoomSpeed ?? 1, this._getGlobeness = s?.getGlobeness ?? (() => 1), this._onPointerDown = this._handlePointerDown.bind(this), this._onPointerMove = this._handlePointerMove.bind(this), this._onPointerUp = this._handlePointerUp.bind(this), this._onWheel = this._handleWheel.bind(this), this._onKeyDown = this._handleKeyDown.bind(this), this._onContextMenu = (r) => r.preventDefault(), t.addEventListener("pointerdown", this._onPointerDown), t.addEventListener("pointermove", this._onPointerMove), t.addEventListener("pointerup", this._onPointerUp), t.addEventListener("pointercancel", this._onPointerUp), t.addEventListener("wheel", this._onWheel, { passive: !1 }), t.addEventListener("contextmenu", this._onContextMenu), this._keyboardEnabled && (t.setAttribute("tabindex", "0"), t.addEventListener("keydown", this._onKeyDown));
  }
  // ─── Pointer handlers ───
  _handlePointerDown(t) {
    if (this._destroyed) return;
    const e = t.target;
    if (!(e && e !== this._element && e.tagName !== "CANVAS"))
      if (this._pointers.set(t.pointerId, { x: t.clientX, y: t.clientY }), this._pointers.size === 1) {
        if (this._dragging = !0, this._dragButton = t.button, this._activePointerId = t.pointerId, this._lastPointerX = t.clientX, this._lastPointerY = t.clientY, this._element.setPointerCapture(t.pointerId), this._doubleClickZoom && t.button === 0) {
          const n = Date.now();
          n - this._lastClickTime < 300 && this._handleDoubleClick(t), this._lastClickTime = n;
        }
      } else this._pointers.size === 2 && (this._lastPinchDist = this._getPinchDistance());
  }
  _handlePointerMove(t) {
    if (this._destroyed) return;
    if (this._pointers.set(t.pointerId, { x: t.clientX, y: t.clientY }), this._pointers.size === 2 && this._zoomEnabled) {
      const o = this._getPinchDistance();
      if (this._lastPinchDist > 0) {
        const s = o / this._lastPinchDist, r = Math.log2(s);
        this._transform.setZoom(this._transform.zoom + r), this._onDirty(), this._onViewChange();
      }
      this._lastPinchDist = o;
      return;
    }
    if (!this._dragging || t.pointerId !== this._activePointerId) return;
    const e = t.clientX - this._lastPointerX, n = t.clientY - this._lastPointerY;
    if (this._lastPointerX = t.clientX, this._lastPointerY = t.clientY, this._dragButton === 2 && this._pitchBearingEnabled) {
      const o = e * 0.3, s = -n * 0.3;
      this._transform.setBearing(this._transform.bearing + o), this._transform.setPitch(this._transform.pitch + s), this._onDirty(), this._onViewChange();
    } else this._dragButton === 0 && this._panEnabled && this._handlePan(e, n);
  }
  _handlePointerUp(t) {
    if (!this._destroyed) {
      if (this._pointers.delete(t.pointerId), t.pointerId === this._activePointerId) {
        this._dragging = !1, this._activePointerId = null;
        try {
          this._element.releasePointerCapture(t.pointerId);
        } catch {
        }
      }
      this._pointers.size < 2 && (this._lastPinchDist = 0);
    }
  }
  // ─── Pan ───
  _handlePan(t, e) {
    const n = 180 / (Math.pow(2, this._transform.zoom) * 256), o = this._transform.center, s = this._transform.bearing * (Math.PI / 180), r = Math.cos(s), a = Math.sin(s), c = t * r + e * a, h = -t * a + e * r, d = o[1] * (Math.PI / 180), l = Math.max(0.1, Math.cos(d)), u = o[0] - c * n / l, f = Math.max(-85.051129, Math.min(
      85.051129,
      o[1] + h * n
    ));
    this._transform.setCenter(u, f), this._onDirty(), this._onViewChange();
  }
  // ─── Wheel zoom ───
  _handleWheel(t) {
    if (this._destroyed || !this._zoomEnabled) return;
    t.preventDefault();
    const e = -t.deltaY * 3e-3 * this._zoomSpeed, n = this._transform.zoom, o = n + e, s = typeof this._element.getBoundingClientRect == "function" ? this._element.getBoundingClientRect() : null, r = s ? t.clientX - s.left : this._transform.viewportWidth / 2, a = s ? t.clientY - s.top : this._transform.viewportHeight / 2, c = r - this._transform.viewportWidth / 2, h = a - this._transform.viewportHeight / 2;
    if (this._transform.setZoom(o), this._transform.zoom - n !== 0 && (Math.abs(c) > 0.5 || Math.abs(h) > 0.5)) {
      const u = 1 - this._getGlobeness();
      if (u > 1e-3) {
        const f = this._transform.bearing * (Math.PI / 180), _ = Math.cos(f), p = Math.sin(f), m = c * _ + h * p, x = -c * p + h * _, y = 360 / (Math.pow(2, n) * 512), g = 360 / (Math.pow(2, this._transform.zoom) * 512), v = this._transform.center, L = v[1] * (Math.PI / 180), M = Math.max(0.1, Math.cos(L)), b = m * (y - g) / M * u, w = -x * (y - g) * u;
        this._transform.setCenter(
          v[0] + b,
          Math.max(-85.051129, Math.min(85.051129, v[1] + w))
        );
      }
    }
    this._onDirty(), this._onViewChange();
  }
  // ─── Double-click zoom ───
  _handleDoubleClick(t) {
    this._zoomEnabled && (this._transform.setZoom(this._transform.zoom + 1), this._onDirty(), this._onViewChange());
  }
  // ─── Keyboard ───
  _handleKeyDown(t) {
    if (this._destroyed) return;
    const e = 50, n = 180 / (Math.pow(2, this._transform.zoom) * 256);
    switch (t.key) {
      case "+":
      case "=":
        this._zoomEnabled && (this._transform.setZoom(this._transform.zoom + 0.5), this._onDirty(), this._onViewChange());
        break;
      case "-":
        this._zoomEnabled && (this._transform.setZoom(this._transform.zoom - 0.5), this._onDirty(), this._onViewChange());
        break;
      case "ArrowLeft":
        if (this._panEnabled) {
          const o = this._transform.center;
          this._transform.setCenter(o[0] - e * n, o[1]), this._onDirty(), this._onViewChange();
        }
        break;
      case "ArrowRight":
        if (this._panEnabled) {
          const o = this._transform.center;
          this._transform.setCenter(o[0] + e * n, o[1]), this._onDirty(), this._onViewChange();
        }
        break;
      case "ArrowUp":
        if (this._panEnabled) {
          const o = this._transform.center;
          this._transform.setCenter(o[0], Math.min(85.051129, o[1] + e * n)), this._onDirty(), this._onViewChange();
        }
        break;
      case "ArrowDown":
        if (this._panEnabled) {
          const o = this._transform.center;
          this._transform.setCenter(o[0], Math.max(-85.051129, o[1] - e * n)), this._onDirty(), this._onViewChange();
        }
        break;
    }
  }
  // ─── Helpers ───
  _getPinchDistance() {
    const t = [...this._pointers.values()];
    if (t.length < 2) return 0;
    const e = t[1].x - t[0].x, n = t[1].y - t[0].y;
    return Math.sqrt(e * e + n * n);
  }
  // ─── Lifecycle ───
  destroy() {
    this._destroyed || (this._destroyed = !0, this._element.removeEventListener("pointerdown", this._onPointerDown), this._element.removeEventListener("pointermove", this._onPointerMove), this._element.removeEventListener("pointerup", this._onPointerUp), this._element.removeEventListener("pointercancel", this._onPointerUp), this._element.removeEventListener("wheel", this._onWheel), this._element.removeEventListener("contextmenu", this._onContextMenu), this._element.removeEventListener("keydown", this._onKeyDown));
  }
}
const K = 20037508342789244e-9, ko = 5;
class un {
  /** @see IViewMode.type */
  type = "3d";
  /** Vertical perspective camera transform (manages view/projection matrices). */
  _transform;
  /** Globe projection handling the Mercator-to-globe transition (globeness). */
  _projection;
  /** Computes which tiles are visible on the globe at a given zoom. */
  _tileCovering;
  /** Active globe interaction handler, or null if not attached. */
  _interaction = null;
  /** Current animation handle, or null if idle. */
  _anim = null;
  /** Whether this mode has been disposed. */
  _destroyed = !1;
  /** Stored markDirty callback for cluster click-triggered goTo. */
  _markDirty = null;
  /** Stored onViewChange callback for cluster-triggered goTo. */
  _onViewChange = null;
  /** Cached GPU textures for image/video overlay layers. */
  _overlayTextureCache = /* @__PURE__ */ new Map();
  /** Active terrain layer used for camera collision clamping. */
  _activeTerrainLayer = null;
  // ─── Per-frame tile coverage cache ───
  /** Monotonic frame counter, incremented at the top of each renderFrame(). */
  _frameCounter = 0;
  /** Frame counter value when caches were last populated. */
  _frameCacheId = -1;
  /** Cached globe tile coverage keyed by floored zoom level. */
  _frameTileCache = /* @__PURE__ */ new Map();
  /** Cached flat tile coverage keyed by floored zoom level. */
  _frameFlatCache = /* @__PURE__ */ new Map();
  /**
   * Create a new Mode3D instance.
   *
   * Initializes the vertical perspective transform, globe projection,
   * and tile covering. The projection's globeness is immediately synced
   * to the initial zoom level.
   *
   * @param options - Initial view and terrain configuration.
   */
  constructor(t = {}) {
    this._transform = new Dn({
      center: t.center ?? [0, 0],
      zoom: t.zoom ?? 2,
      pitch: t.pitch ?? 0,
      bearing: t.bearing ?? 0,
      viewportWidth: t.viewportWidth ?? 800,
      viewportHeight: t.viewportHeight ?? 600
    }), this._projection = new W(), this._projection.updateFromZoom(this._transform.zoom), this._tileCovering = new zo();
  }
  /**
   * Expose the underlying vertical perspective transform for advanced use.
   *
   * Useful for computing extents, accessing raw view/projection matrices,
   * or performing custom coordinate transformations.
   */
  get transform() {
    return this._transform;
  }
  /**
   * Expose the underlying globe projection for advanced use.
   *
   * Provides access to the globeness factor and projection transition state.
   */
  get projection() {
    return this._projection;
  }
  // ─── State ───
  /**
   * Apply a partial view state update to the transform and projection.
   *
   * Center coordinates are in [lon, lat] (EPSG:4326). Zoom changes also
   * update the globe projection's globeness factor. Pitch and bearing
   * control the 3D camera orientation. The rotation field is silently
   * ignored in 3D mode.
   *
   * @param state - Partial view state to apply.
   * @see IViewMode.setState
   */
  setState(t) {
    t.center && this._transform.setCenter(t.center[0], t.center[1]), t.zoom !== void 0 && this._transform.setZoom(t.zoom), t.pitch !== void 0 && this._transform.setPitch(t.pitch), t.bearing !== void 0 && this._transform.setBearing(t.bearing), this._syncCameraSurfaceConstraint(), this._projection.updateFromZoom(this._transform.zoom);
  }
  /**
   * Read the current view state.
   *
   * Returns the center in [lon, lat] (EPSG:4326), zoom, pitch, and bearing.
   * Rotation is always 0 in 3D mode.
   *
   * @returns The current serializable view state.
   * @see IViewMode.getState
   */
  getState() {
    return {
      center: this._transform.center,
      zoom: this._transform.zoom,
      pitch: this._transform.pitch,
      bearing: this._transform.bearing,
      rotation: 0
    };
  }
  /**
   * Build the CameraState for the render engine's beginFrame() call.
   *
   * Provides the perspective view/projection matrices, camera position in
   * 3D space, viewport dimensions, and globe-specific uniforms including
   * the projection transition factor (globeness), clipping plane for
   * back-face culling, globe radius (1.0 for unit sphere), and the flat
   * view-projection matrix used for Mercator fallback.
   *
   * @returns The camera state suitable for the WebGPU render engine.
   * @see IViewMode.getCameraState
   */
  getCameraState() {
    const t = this._transform.center, e = t[1] * Math.PI / 180, n = (t[0] + 180) / 360, o = (1 - Math.log(Math.tan(e) + 1 / Math.cos(e)) / Math.PI) / 2;
    return {
      viewMatrix: this._transform.viewMatrix,
      projectionMatrix: this._transform.projectionMatrix,
      position: this._transform.cameraPosition,
      viewportWidth: this._transform.viewportWidth,
      viewportHeight: this._transform.viewportHeight,
      projectionTransition: this._projection.globeness,
      clippingPlane: this._transform.getClippingPlane(),
      globeRadius: 1,
      flatViewProjectionMatrix: this._transform.flatViewProjectionMatrix,
      cameraMerc01: [n, o, this._transform.mercatorCameraDistance]
    };
  }
  /**
   * Update the viewport dimensions (e.g. on canvas resize).
   *
   * Propagates the new size to the underlying vertical perspective
   * transform, which recalculates the projection matrix.
   *
   * @param width - New viewport width in pixels.
   * @param height - New viewport height in pixels.
   * @see IViewMode.setViewport
   */
  setViewport(t, e) {
    this._transform.setViewport(t, e);
  }
  // ─── Navigation ───
  /**
   * Animate the camera to a target view state.
   *
   * Uses ease-in-out (quadratic) interpolation over the specified duration.
   * Interpolates center (lon/lat), zoom, pitch, and bearing simultaneously.
   * The globe projection's globeness is updated on each animation frame
   * to stay in sync with the interpolated zoom level.
   *
   * If duration is 0, the transition is applied immediately without animation.
   * Only center, zoom, pitch, and bearing fields from the target are used;
   * rotation is ignored in 3D mode.
   *
   * Any in-progress animation is cancelled before starting a new one.
   *
   * @param target - The navigation target describing the desired end state.
   * @param markDirty - Callback to flag the view as needing a re-render.
   * @param onViewChange - Callback to notify listeners of a view state change.
   * @returns A promise that resolves when the animation completes or is cancelled.
   * @throws Error if the mode has been disposed.
   * @see IViewMode.goTo
   */
  goTo(t, e, n) {
    if (this._destroyed) return Promise.reject(new Error("Mode disposed"));
    const o = t.duration ?? 500;
    this.cancelAnimation();
    const s = t.center ?? this._transform.center, r = t.zoom ?? this._transform.zoom, a = t.pitch ?? this._transform.pitch, c = t.bearing ?? this._transform.bearing;
    if (o <= 0)
      return this._transform.setCenter(s[0], s[1]), this._transform.setZoom(r), this._transform.setPitch(a), this._transform.setBearing(c), this._syncCameraSurfaceConstraint(), this._projection.updateFromZoom(this._transform.zoom), e(), n(), Promise.resolve();
    const h = this._transform.center, d = this._transform.zoom, l = this._transform.pitch, u = this._transform.bearing;
    return this._anim = kn(o, (f) => {
      this._transform.setCenter(
        h[0] + (s[0] - h[0]) * f,
        h[1] + (s[1] - h[1]) * f
      ), this._transform.setZoom(d + (r - d) * f), this._transform.setPitch(l + (a - l) * f), this._transform.setBearing(u + (c - u) * f), this._syncCameraSurfaceConstraint(), this._projection.updateFromZoom(this._transform.zoom), e(), n();
    }, () => !this._destroyed), this._anim.promise;
  }
  /**
   * Cancel any in-progress goTo animation.
   *
   * Clears the animation flag and cancels the pending setTimeout.
   * The animation promise resolves on the next scheduled step.
   *
   * @see IViewMode.cancelAnimation
   */
  cancelAnimation() {
    this._anim?.cancel(), this._anim = null;
  }
  // ─── Rendering ───
  /**
   * Render a single frame in 3D globe mode.
   *
   * Performs the following steps:
   * 1. Updates the globe projection's globeness from the current zoom.
   * 2. Classifies visible layers into tile (raster) and feature (vector) categories.
   * 3. Computes tile coverage (globe-based or flat-based depending on globeness).
   * 4. Draws atmosphere and pole caps behind tiles when in globe mode.
   * 5. Converts raster tile extents from EPSG:3857 to Mercator [0..1] and
   *    issues drawGlobeTile() calls.
   * 6. Draws vector features (polygons, lines, points) in globe space.
   *
   * Called by the RenderLoop between beginFrame() and endFrame().
   *
   * @param ctx - Shared rendering resources (render engine, managers, caches).
   * @see IViewMode.renderFrame
   */
  renderFrame(t) {
    this._frameCounter++;
    const {
      renderEngine: e,
      layerManager: n,
      tileManager: o,
      terrainManager: s,
      bufferCache: r,
      globeEffects: a
    } = t;
    this._projection.updateFromZoom(this._transform.zoom);
    const c = Math.floor(this._transform.zoom), {
      tileSources: h,
      terrainLayerIds: d,
      vectorLayerIds: l,
      customLayerIds: u,
      clusterLayerIds: f,
      dynamicPointLayerIds: _,
      vectorTileLayerIds: p,
      overlayLayerIds: m
    } = Rn(n, this._transform.zoom), x = this._resolveActiveTerrainLayer(n, d), y = this._syncCameraSurfaceConstraint(x);
    y && this._projection.updateFromZoom(this._transform.zoom), s.setActiveLayer(x?.id ?? null), y && (this._markDirty?.(), this._onViewChange?.());
    const g = this._projection.globeness;
    if (this._drawSkyBackground(e, a), this._drawGlobeShellEffects(e, a, g), h.length === 0 && l.length === 0 && u.length === 0 && f.length === 0 && p.length === 0 && m.length === 0) return;
    if (h.length > 0) {
      const M = this._getCachedTiles(g, c);
      x && s.requestTiles(x, M);
      const b = o.getReadyTilesForCoords(M, h);
      for (const w of b) {
        const C = 20037508342789244e-9, T = (w.extent[0] + C) / (2 * C), E = (w.extent[2] + C) / (2 * C), P = 1 - (w.extent[3] + C) / (2 * C), I = 1 - (w.extent[1] + C) / (2 * C), D = [T, P, E, I], S = Ro(D), F = x && S ? s.getReadyHeightTile(x, S.z, S.x, S.y) : null, z = x !== null;
        e.drawGlobeTile({
          texture: w.texture,
          mercatorExtent: D,
          opacity: w.opacity,
          depthBias: w.depthBias ?? 0,
          filters: w.filters,
          terrainHeightTexture: F?.texture,
          terrainUvOffsetScale: F?.uvOffsetScale ?? [0, 0, 1, 1],
          heightMode: z ? 1 : 0,
          heightExaggeration: z ? x.exaggeration : void 0,
          lighting3D: (z ? x.lighting3D : void 0) ?? {
            enabled: a.lighting.enabled,
            ambient: a.lighting.ambient,
            diffuse: a.lighting.diffuse,
            shadowStrength: a.lighting.shadowStrength,
            shadowSoftness: a.lighting.shadowSoftness,
            sunAzimuth: a.lighting.sunAzimuth,
            sunAltitude: a.lighting.sunAltitude
          }
        });
      }
    }
    const v = new Set(m);
    for (const [M, b] of this._overlayTextureCache)
      v.has(M) || (e.releaseTexture(b.texture), this._overlayTextureCache.delete(M));
    for (const M of m)
      Wn(M, e, n, this._overlayTextureCache, !0);
    for (const M of m) {
      const b = n.getLayer(M);
      if (b && Xt(b)) {
        const w = b.videoElement;
        if (w && !w.paused && !w.ended) {
          this._markDirty?.();
          break;
        }
      }
    }
    for (const M of p) {
      const b = n.getLayer(M);
      if (!b || !("updateVisibleTiles" in b)) continue;
      const w = Math.floor(this._transform.zoom), C = b.maxZoom ?? w, T = Math.min(w, C), E = this._getCachedTiles(g, T);
      b.updateVisibleTiles(E, {
        renderMode: "3d",
        zoom: this._transform.zoom
      });
    }
    for (const M of p)
      Zn(M, e, n, r, !0, this._transform.zoom);
    const L = x && typeof x.sampleElevation == "function" ? x : void 0;
    for (const M of l)
      Bn(M, e, n, r, !0, this._transform.zoom, L);
    for (const M of u)
      Hn(M, e, n, (b, w, C) => this._buildCustomShaderSource(b, w, C), !0);
    if (f.length > 0) {
      const M = this._fallbackClusterExtent3857(this._transform.center), b = this._computeClusterExtent3857() ?? M, w = this._markDirty ? {
        toMap: (C, T) => this.toMap(C, T),
        toScreen: (C, T) => this.toScreen(C, T),
        getZoom: () => this._transform.zoom,
        getExtent: () => this._computeClusterExtent3857() ?? M,
        getViewportSize: () => [this._transform.viewportWidth, this._transform.viewportHeight],
        goTo: (C) => this.goTo(
          C,
          this._markDirty,
          this._onViewChange ?? (() => {
          })
        )
      } : void 0;
      for (const C of f)
        Gn(C, e, n, this._transform.zoom, b, !0, w);
    }
    for (const M of _)
      An(M, e, n, !0);
  }
  _resolveActiveTerrainLayer(t, e) {
    for (let n = e.length - 1; n >= 0; n--) {
      const o = e[n];
      if (!o) continue;
      const s = t.getLayer(o);
      if (s && we(s)) return s;
    }
    return null;
  }
  _computeClusterExtent3857() {
    const t = this._transform.viewportWidth, e = this._transform.viewportHeight;
    if (!(t > 0) || !(e > 0)) return null;
    const n = Math.min(t * 0.08, 64), o = Math.min(e * 0.08, 64), s = n, r = t * 0.5, a = Math.max(s, t - n), c = o, h = e * 0.5, d = Math.max(c, e - o), l = [
      [s, c],
      [r, c],
      [a, c],
      [s, h],
      [r, h],
      [a, h],
      [s, d],
      [r, d],
      [a, d]
    ], u = this.toMap(r, h) ?? this._transform.center;
    let f = 1 / 0, _ = 1 / 0, p = -1 / 0, m = -1 / 0, x = 0;
    for (const [L, M] of l) {
      const b = this.toMap(L, M);
      if (!b) continue;
      const [w, C] = B(b[0], b[1]);
      f = Math.min(f, w), _ = Math.min(_, C), p = Math.max(p, w), m = Math.max(m, C), x++;
    }
    if (x < 3 || !isFinite(f) || !isFinite(_) || !isFinite(p) || !isFinite(m))
      return this._fallbackClusterExtent3857(u);
    const y = p - f, g = m - _;
    if (!(y > 0) || !(g > 0))
      return this._fallbackClusterExtent3857(u);
    const v = Math.max(y, g) * 0.08;
    return [
      Math.max(-K, f - v),
      Math.max(-K, _ - v),
      Math.min(K, p + v),
      Math.min(K, m + v)
    ];
  }
  _fallbackClusterExtent3857(t) {
    const [e, n] = B(t[0], t[1]), o = 2 * K / (256 * Math.pow(2, this._transform.zoom)), s = Math.max(o * this._transform.viewportWidth * 0.6, o * 32), r = Math.max(o * this._transform.viewportHeight * 0.6, o * 32);
    return [
      Math.max(-K, e - s),
      Math.max(-K, n - r),
      Math.min(K, e + s),
      Math.min(K, n + r)
    ];
  }
  /**
   * Build WGSL shader source with globe-aware preamble for a custom shader layer.
   *
   * In 3D mode the preamble uses GlobeCameraUniforms (160 bytes) with both
   * globe VP and flat VP matrices, projectionTransition, clippingPlane, and
   * injects Mercator→sphere projection helper functions. The `projectMercator()`
   * function is available for shaders to project raw EPSG:3857 positions onto
   * the globe/flat surface depending on the current globeness.
   */
  _buildCustomShaderSource(t, e, n) {
    if (t.rawMode === !0)
      return t.vertexShader + `
` + t.fragmentShader;
    let o = (
      // GlobeCameraUniforms — matches globeCameraBuffer (160 bytes)
      `struct CameraUniforms {
  viewProjection: mat4x4<f32>,
  flatViewProjection: mat4x4<f32>,
  viewport: vec2<f32>,
  projectionTransition: f32,
  globeRadius: f32,
  clippingPlane: vec4<f32>,
};
@group(0) @binding(0) var<uniform> camera: CameraUniforms;

struct FrameUniforms {
  time: f32,
  deltaTime: f32,
  frameNumber: f32,
  opacity: f32,
};
@group(1) @binding(0) var<uniform> frame: FrameUniforms;

`
    );
    return e !== null && (o += `@group(2) @binding(0) var<uniform> custom: CustomUniforms;

`), n.length > 0 && (o += `@group(3) @binding(0) var texSampler: sampler;
@group(3) @binding(1) var texInput: texture_2d<f32>;

`), o += `const _PI: f32 = 3.141592653589793;
const _TWO_PI: f32 = 6.283185307179586;
const _HALF_CIRC: f32 = 20037508.342789244;

fn _epsg3857ToMerc01(pos: vec2<f32>) -> vec2<f32> {
  return vec2<f32>(
    (pos.x + _HALF_CIRC) / (2.0 * _HALF_CIRC),
    1.0 - (pos.y + _HALF_CIRC) / (2.0 * _HALF_CIRC)
  );
}

fn _mercToAngular(merc: vec2<f32>) -> vec2<f32> {
  let lon = merc.x * _TWO_PI - _PI;
  let lat = atan(exp(_PI - merc.y * _TWO_PI)) * 2.0 - _PI * 0.5;
  return vec2<f32>(lon, lat);
}

fn _angularToSphere(lon: f32, lat: f32) -> vec3<f32> {
  let cosLat = cos(lat);
  return vec3<f32>(cosLat * sin(lon), sin(lat), cosLat * cos(lon));
}

fn projectMercator(pos: vec2<f32>) -> vec4<f32> {
  let merc01 = _epsg3857ToMerc01(pos);
  let ang = _mercToAngular(merc01);
  let sp = _angularToSphere(ang.x, ang.y);
  var globeClip = camera.viewProjection * vec4<f32>(sp, 1.0);
  let clipZ = 1.0 - (dot(sp, camera.clippingPlane.xyz) + camera.clippingPlane.w);
  globeClip.z = clipZ * globeClip.w;
  if (camera.projectionTransition >= 0.999) { return globeClip; }
  let flatClip = camera.flatViewProjection * vec4<f32>(merc01.x, merc01.y, 0.0, 1.0);
  if (camera.projectionTransition <= 0.001) { return flatClip; }
  return mix(flatClip, globeClip, camera.projectionTransition);
}

`, o + t.vertexShader + `
` + t.fragmentShader;
  }
  /**
   * Return cached globe or flat tile coverage for the current frame.
   *
   * Invalidates the cache when the frame counter changes and stores results
   * keyed by floored zoom so that raster and vector-tile layers at different
   * max-zoom levels can share coverage without redundant computation.
   */
  _getCachedTiles(t, e) {
    this._frameCounter !== this._frameCacheId && (this._frameTileCache.clear(), this._frameFlatCache.clear(), this._frameCacheId = this._frameCounter);
    const n = Math.max(0, Math.min(22, Math.floor(e)));
    if (t >= 0.5) {
      let s = this._frameTileCache.get(n);
      return s || (s = this._tileCovering.getTilesForGlobe(this._transform, n), this._frameTileCache.set(n, s)), s;
    }
    let o = this._frameFlatCache.get(n);
    return o || (o = this._getTilesForFlat(n), this._frameFlatCache.set(n, o)), o;
  }
  /**
   * Compute tile coverage for flat (Mercator) rendering at high zoom levels.
   *
   * Used when globeness < 0.5 (typically zoom >= 6). Calculates which
   * XYZ tiles are visible by projecting the camera center to tile coordinates,
   * then expanding by half the viewport in tile units. The pitch factor
   * extends vertical coverage to account for the tilted perspective.
   *
   * @param targetZoom - The target zoom level (clamped to 0..22).
   * @returns Array of `{ z, x, y }` tile coordinates that cover the viewport.
   */
  _getTilesForFlat(t) {
    const e = Math.max(0, Math.min(22, Math.floor(t))), n = Math.pow(2, e), o = this._transform.center, s = o[1] * Math.PI / 180, r = (Math.floor((o[0] + 180) / 360 * n) % n + n) % n, a = Math.floor(
      (1 - Math.log(Math.tan(s) + 1 / Math.cos(s)) / Math.PI) / 2 * n
    ), c = 1 / Math.max(0.3, Math.cos(this._transform.pitch * Math.PI / 180)), h = Math.ceil(this._transform.viewportWidth / 256 / 2) + 1, d = Math.ceil(this._transform.viewportHeight / 256 / 2 * c) + 1, l = [];
    for (let u = -d; u <= d; u++)
      for (let f = -h; f <= h; f++) {
        const _ = r + f, p = a + u;
        _ >= 0 && _ < n && p >= 0 && p < n && l.push({ z: e, x: _, y: p });
      }
    return l;
  }
  // ─── Interaction ───
  /**
   * Attach orbit-style pointer and keyboard interaction to a DOM container.
   *
   * Creates a {@link GlobeInteraction} handler that translates mouse/touch/keyboard
   * events into camera pan, zoom, pitch, and bearing operations. The onViewChange
   * callback is wrapped to also update the globe projection's globeness on each
   * interaction event. Pass `false` for the options parameter to skip attaching
   * interaction entirely.
   *
   * @param container - The HTML element to listen for input events on.
   * @param markDirty - Callback to flag the view as needing a re-render.
   * @param onViewChange - Callback to notify listeners of a view state change.
   * @param options - Interaction configuration, or `false` to disable.
   * @see IViewMode.attachInteraction
   */
  attachInteraction(t, e, n, o) {
    if (this._markDirty = e, this._onViewChange = n, o === !1) return;
    const s = {
      ...o,
      getGlobeness: () => this._projection.globeness
    };
    this._interaction = new Fo(
      t,
      this._transform,
      e,
      () => {
        this._syncCameraSurfaceConstraint() && e(), this._projection.updateFromZoom(this._transform.zoom), n();
      },
      s
    );
  }
  _syncCameraSurfaceConstraint(t = this._activeTerrainLayer) {
    this._activeTerrainLayer = t;
    const [e, n] = this._transform.center, o = t ? ko : 0, s = t?.sampleElevation?.(e, n) ?? 0, r = t && Number.isFinite(s) && s > 0 ? s * Math.max(0, t?.exaggeration ?? 1) : 0;
    return this._transform.setMinCameraSurfaceDistance(
      o + r
    );
  }
  _drawSkyBackground(t, e) {
    e.sky.enabled && t.drawSky(
      e.sky,
      e.lighting.sunAltitude,
      e.lighting.sunAzimuth
    );
  }
  _drawGlobeShellEffects(t, e, n) {
    if (!(n <= 0.01) && (e.atmosphere.enabled && t.drawAtmosphere(n, e.atmosphere), e.poleCaps.enabled)) {
      const [o, s, r] = e.poleCaps.color;
      t.drawPoleCaps([o, s, r, n]);
    }
  }
  // ─── Coordinate Conversion ───
  /**
   * Convert screen pixel coordinates to geographic [longitude, latitude].
   *
   * Uses the current globeness factor to select the correct unprojection
   * strategy:
   * - globeness ≈ 1 (full globe): ray-sphere intersection via globe VP
   * - globeness ≈ 0 (flat Mercator): inverse of flat VP matrix
   * - in between: blends both results to match the shader's `mix()` blend
   *
   * The transition zone blend ensures that drawn features appear exactly
   * where the user clicks, matching the forward projection used by the
   * shader and by {@link toScreen}.
   *
   * @param screenX - Horizontal pixel position relative to the canvas.
   * @param screenY - Vertical pixel position relative to the canvas.
   * @returns Geographic coordinates as [longitude, latitude], or null if off-map.
   * @see IViewMode.toMap
   */
  toMap(t, e) {
    const n = this._projection.globeness;
    if (n >= 0.999)
      return this._transform.screenToLonLat(t, e);
    if (n <= 1e-3)
      return this._transform.screenToLonLatFlat(t, e);
    const o = this._transform.screenToLonLat(t, e), s = this._transform.screenToLonLatFlat(t, e);
    return s ? o ? [
      s[0] + (o[0] - s[0]) * n,
      s[1] + (o[1] - s[1]) * n
    ] : s : o;
  }
  /**
   * Convert geographic coordinates to screen pixel position.
   *
   * Uses the current globeness factor to select the correct projection:
   * - globeness ≈ 1: globe VP matrix (unit sphere)
   * - globeness ≈ 0: flat Mercator VP matrix
   * - in between: blend both clip-space positions (matching the shader)
   *
   * @param lon - Longitude in degrees.
   * @param lat - Latitude in degrees.
   * @returns Screen coordinates as [x, y] in pixels, or null if not visible.
   * @see IViewMode.toScreen
   */
  toScreen(t, e) {
    const n = this._projection.globeness;
    if (n >= 0.999)
      return this._transform.lonLatToScreen(t, e);
    if (n <= 1e-3)
      return this._transform.lonLatToScreenFlat(t, e);
    const o = this._transform.lonLatToScreen(t, e), s = this._transform.lonLatToScreenFlat(t, e);
    return s ? o ? [
      s[0] + (o[0] - s[0]) * n,
      s[1] + (o[1] - s[1]) * n
    ] : s : o;
  }
  // ─── Lifecycle ───
  /**
   * Dispose of all mode-specific resources.
   *
   * Cancels any in-progress animation, destroys the globe interaction
   * handler, and marks the mode as destroyed. Subsequent calls are no-ops.
   *
   * @see IViewMode.dispose
   */
  dispose() {
    if (!this._destroyed) {
      this._destroyed = !0, this.cancelAnimation(), this._interaction?.destroy(), this._interaction = null, this._onViewChange = null;
      for (const t of this._overlayTextureCache.values())
        t.texture.destroy();
      this._overlayTextureCache.clear();
    }
  }
}
function Ro(i) {
  const t = i[2] - i[0];
  if (!(t > 0)) return null;
  const e = Math.floor(Math.log2(1 / t) + 1e-6);
  if (!Number.isFinite(e) || e < 0) return null;
  const n = Math.pow(2, e);
  if (!(n > 0)) return null;
  const o = Math.max(0, Math.min(n - 1, Math.floor(i[0] * n + 1e-6))), s = Math.max(0, Math.min(n - 1, Math.floor(i[1] * n + 1e-6)));
  return { z: e, x: o, y: s };
}
class Ao {
  _tools = /* @__PURE__ */ new Map();
  _activeTool = null;
  _overlay = null;
  _events = new ct();
  _commands;
  _previewLayer = null;
  _wheelPassthrough;
  _destroyed = !1;
  // View references (set via init)
  _canvas = null;
  _container = null;
  _toMap = null;
  _toScreen = null;
  _getMode = null;
  _getZoom = null;
  _markDirty = null;
  // Double-click detection
  _lastClickTime = 0;
  _lastClickX = 0;
  _lastClickY = 0;
  _dblClickThreshold = 300;
  // ms
  _dblClickDistance = 5;
  // px
  // Bound handlers (for cleanup)
  _boundPointerDown = null;
  _boundPointerMove = null;
  _boundPointerUp = null;
  _boundKeyDown = null;
  _boundWheel = null;
  _boundContextMenu = null;
  constructor(t = {}) {
    this._commands = new mi({ maxHistorySize: t.maxHistorySize ?? 50 }), this._previewLayer = t.previewLayer ?? null, this._wheelPassthrough = t.wheelPassthrough ?? !0, this._commands.on("command-executed", () => this._emitHistoryChange()), this._commands.on("command-undone", () => this._emitHistoryChange()), this._commands.on("command-redone", () => this._emitHistoryChange());
  }
  // ─── Initialization ───
  /**
   * Initialize with view references. Called by MapView's lazy getter.
   */
  init(t) {
    this._canvas = t.canvas, this._container = t.container, this._toMap = t.toMap, this._toScreen = t.toScreen, this._getMode = t.getMode, this._getZoom = t.getZoom, this._markDirty = t.markDirty;
  }
  // ─── Preview Layer ───
  setPreviewLayer(t) {
    this._previewLayer = t;
  }
  get previewLayer() {
    return this._previewLayer;
  }
  // ─── Tool Registry ───
  registerTool(t) {
    if (this._tools.has(t.id))
      throw new Error(`Tool already registered: ${t.id}`);
    this._tools.set(t.id, t);
  }
  unregisterTool(t) {
    const e = this._tools.get(t);
    e && (this._activeTool === e && this.deactivateTool(), e.destroy(), this._tools.delete(t));
  }
  getTool(t) {
    return this._tools.get(t);
  }
  get tools() {
    return this._tools;
  }
  // ─── Activation ───
  activateTool(t) {
    if (this._destroyed) return;
    const e = this._tools.get(t);
    if (!e) throw new Error(`Tool not found: ${t}`);
    if (this._activeTool && this._activeTool !== e && this.deactivateTool(), this._activeTool === e) return;
    this._ensureOverlay();
    const n = this._buildContext();
    if (!n) {
      console.warn("[ToolManager] Cannot activate tool — view not initialized");
      return;
    }
    this._activeTool = e, e.activate(n), this._overlay && (this._overlay.style.pointerEvents = "auto", this._overlay.style.cursor = e.cursor), this._events.emit("tool-activate", { toolId: t });
  }
  deactivateTool() {
    if (!this._activeTool) return;
    const t = this._activeTool.id;
    this._activeTool.deactivate(), this._activeTool = null, this._overlay && (this._overlay.style.pointerEvents = "none", this._overlay.style.cursor = "default"), this._previewLayer?.clear(), this._markDirty?.(), this._events.emit("tool-deactivate", { toolId: t });
  }
  get activeTool() {
    return this._activeTool;
  }
  // ─── Command System ───
  get commands() {
    return this._commands;
  }
  undo() {
    const t = this._commands.undo();
    return t && this._markDirty?.(), t;
  }
  redo() {
    const t = this._commands.redo();
    return t && this._markDirty?.(), t;
  }
  get canUndo() {
    return this._commands.canUndo;
  }
  get canRedo() {
    return this._commands.canRedo;
  }
  // ─── Events ───
  on(t, e) {
    this._events.on(t, e);
  }
  off(t, e) {
    this._events.off(t, e);
  }
  // ─── Lifecycle ───
  destroy() {
    if (!this._destroyed) {
      this._destroyed = !0, this.deactivateTool();
      for (const t of this._tools.values())
        t.destroy();
      this._tools.clear(), this._removeOverlay(), this._commands.destroy(), this._events.removeAll(), this._previewLayer = null, this._canvas = null, this._container = null;
    }
  }
  // ─── Private: Overlay Management ───
  _ensureOverlay() {
    if (this._overlay || !this._container) return;
    const t = document.createElement("div");
    t.style.position = "absolute", t.style.top = "0", t.style.left = "0", t.style.width = "100%", t.style.height = "100%", t.style.pointerEvents = "none", t.style.zIndex = "10", t.style.touchAction = "none", t.setAttribute("data-mapgpu-tool-overlay", "true"), getComputedStyle(this._container).position === "static" && (this._container.style.position = "relative"), this._container.appendChild(t), this._overlay = t, this._boundPointerDown = this._onPointerDown.bind(this), this._boundPointerMove = this._onPointerMove.bind(this), this._boundPointerUp = this._onPointerUp.bind(this), this._boundKeyDown = this._onKeyDown.bind(this), this._boundWheel = this._onWheel.bind(this), this._boundContextMenu = (n) => n.preventDefault(), t.addEventListener("pointerdown", this._boundPointerDown), t.addEventListener("pointermove", this._boundPointerMove), t.addEventListener("pointerup", this._boundPointerUp), t.addEventListener("wheel", this._boundWheel, { passive: !1 }), t.addEventListener("contextmenu", this._boundContextMenu), document.addEventListener("keydown", this._boundKeyDown);
  }
  _removeOverlay() {
    this._overlay && (this._boundPointerDown && this._overlay.removeEventListener("pointerdown", this._boundPointerDown), this._boundPointerMove && this._overlay.removeEventListener("pointermove", this._boundPointerMove), this._boundPointerUp && this._overlay.removeEventListener("pointerup", this._boundPointerUp), this._boundWheel && this._overlay.removeEventListener("wheel", this._boundWheel), this._boundContextMenu && this._overlay.removeEventListener("contextmenu", this._boundContextMenu), this._boundKeyDown && document.removeEventListener("keydown", this._boundKeyDown), this._overlay.parentElement?.removeChild(this._overlay), this._overlay = null);
  }
  // ─── Private: Event Handlers ───
  _onPointerDown(t) {
    if (!this._activeTool || t.button !== 0) return;
    const e = this._buildPointerEvent(t);
    this._activeTool.onPointerDown(e), this._syncCursor();
  }
  _onPointerMove(t) {
    if (!this._activeTool) return;
    const e = this._buildPointerEvent(t);
    this._activeTool.onPointerMove(e), this._events.emit("cursor-move", {
      screenX: e.screenX,
      screenY: e.screenY,
      mapCoords: e.mapCoords
    }), this._syncCursor();
  }
  _onPointerUp(t) {
    if (!this._activeTool || t.button !== 0) return;
    const e = this._buildPointerEvent(t), n = Date.now(), o = Math.abs(e.screenX - this._lastClickX), s = Math.abs(e.screenY - this._lastClickY);
    n - this._lastClickTime < this._dblClickThreshold && o < this._dblClickDistance && s < this._dblClickDistance ? (this._activeTool.onDoubleClick(e), this._lastClickTime = 0) : (this._activeTool.onPointerUp(e), this._lastClickTime = n, this._lastClickX = e.screenX, this._lastClickY = e.screenY), this._syncCursor();
  }
  _onKeyDown(t) {
    if (this._activeTool) {
      if ((t.ctrlKey || t.metaKey) && t.key === "z" && !t.shiftKey) {
        t.preventDefault(), this.undo();
        return;
      }
      if ((t.ctrlKey || t.metaKey) && t.key === "z" && t.shiftKey) {
        t.preventDefault(), this.redo();
        return;
      }
      if ((t.ctrlKey || t.metaKey) && t.key === "y") {
        t.preventDefault(), this.redo();
        return;
      }
      if (t.key === "Escape") {
        t.preventDefault(), this._activeTool.cancel(), this._syncCursor();
        return;
      }
      this._activeTool.onKeyDown(t) && t.preventDefault();
    }
  }
  _onWheel(t) {
    if (!this._wheelPassthrough || !this._container) return;
    const e = new WheelEvent("wheel", {
      deltaX: t.deltaX,
      deltaY: t.deltaY,
      deltaZ: t.deltaZ,
      deltaMode: t.deltaMode,
      clientX: t.clientX,
      clientY: t.clientY,
      screenX: t.screenX,
      screenY: t.screenY,
      ctrlKey: t.ctrlKey,
      shiftKey: t.shiftKey,
      altKey: t.altKey,
      metaKey: t.metaKey,
      bubbles: !0,
      cancelable: !0
    });
    this._overlay && (this._overlay.style.pointerEvents = "none", this._canvas?.dispatchEvent(e), queueMicrotask(() => {
      this._overlay && this._activeTool && (this._overlay.style.pointerEvents = "auto");
    })), t.preventDefault();
  }
  // ─── Private: Helpers ───
  _buildPointerEvent(t) {
    const e = this._canvas?.getBoundingClientRect(), n = e ? t.clientX - e.left : t.offsetX, o = e ? t.clientY - e.top : t.offsetY, s = this._toMap ? this._toMap(n, o) : null;
    return {
      screenX: n,
      screenY: o,
      mapCoords: s,
      originalEvent: t,
      button: t.button,
      shiftKey: t.shiftKey,
      ctrlKey: t.ctrlKey || t.metaKey
    };
  }
  _buildContext() {
    return !this._canvas || !this._toMap || !this._toScreen || !this._getMode || !this._getZoom || !this._previewLayer || !this._markDirty ? null : {
      toMap: this._toMap,
      toScreen: this._toScreen,
      canvas: this._canvas,
      mode: this._getMode(),
      zoom: this._getZoom(),
      previewLayer: this._previewLayer,
      commands: this._commands,
      markDirty: this._markDirty,
      emitEvent: (t, e) => {
        this._events.emit(t, e);
      }
    };
  }
  _syncCursor() {
    this._overlay && this._activeTool && (this._overlay.style.cursor = this._activeTool.cursor);
  }
  _emitHistoryChange() {
    this._events.emit("history-change", {
      canUndo: this._commands.canUndo,
      canRedo: this._commands.canRedo
    });
  }
}
const Bo = {
  format: "depth32float",
  compareFunc: "less",
  clearValue: 1
};
function fn(i) {
  return i === "3d" ? Bo : ni;
}
class ds {
  /**
   * The underlying {@link GameMap} layer collection.
   * Use `map.add(layer)` and `map.remove(layer)` to manage layers.
   *
   * @example
   * ```ts
   * view.map.add(myTileLayer);
   * view.map.remove(myTileLayer);
   * ```
   */
  get map() {
    return this._core.map;
  }
  /** Unique instance identifier (satisfies {@link IView}). */
  id;
  /** Active rendering mode discriminant (satisfies {@link IView}). Alias for {@link mode}. */
  get type() {
    return this._mode.type;
  }
  _core;
  _mode;
  _events = new ct();
  _ready = !1;
  _destroyed = !1;
  _readyResolve = null;
  _readyPromise;
  _interactionOptions;
  _animatedLayerCallbacks = /* @__PURE__ */ new Map();
  _toolManager = null;
  _clickHandler = null;
  _pointerMoveHandler = null;
  _cameraLock = null;
  /**
   * Creates a new MapView instance.
   *
   * The constructor sets up the canvas, creates the initial view mode (2D or 3D),
   * wires layer management events, attaches interaction handlers, and begins
   * asynchronous GPU initialization. Use {@link when} to wait for readiness.
   *
   * @param options - Configuration options for the view.
   * @throws {Error} If `options.container` is a CSS selector that does not match any element.
   *
   * @example
   * ```ts
   * // Basic 2D map
   * const view = new MapView({
   *   container: document.getElementById('map'),
   *   center: [32.85, 39.92],
   *   zoom: 12,
   *   renderEngine: engine,
   * });
   *
   * // 3D globe
   * const globe = new MapView({
   *   container: '#globe',
   *   mode: '3d',
   *   center: [29.0, 41.0],
   *   zoom: 4,
   *   pitch: 45,
   *   bearing: -30,
   *   renderEngine: engine,
   * });
   *
   * // Headless / test mode (no DOM, no GPU)
   * const headless = new MapView({ container: null });
   * ```
   */
  constructor(t) {
    this.id = `mapview-${Date.now()}`, this._core = new po(), this._interactionOptions = t.interaction ?? {}, this._maxBounds = t.maxBounds ?? null;
    let e = null;
    if (typeof t.container == "string") {
      const r = document.querySelector(t.container);
      if (!r || !(r instanceof HTMLElement))
        throw new Error(`Container element not found: ${t.container}`);
      e = r;
    } else
      e = t.container;
    e && typeof document < "u" && this._core.createCanvas(e);
    const n = e?.clientWidth || 800, o = e?.clientHeight || 600, s = t.mode ?? "2d";
    if (s === "3d" ? this._mode = new un({
      center: t.center,
      zoom: t.zoom,
      pitch: t.pitch,
      bearing: t.bearing,
      viewportWidth: n,
      viewportHeight: o
    }) : this._mode = new hn({
      center: t.center,
      zoom: t.zoom,
      rotation: t.rotation,
      minZoom: t.minZoom,
      maxZoom: t.maxZoom,
      viewportWidth: n,
      viewportHeight: o
    }), this._core.layerManager.setCurrentZoom(this._mode.getState().zoom), this._core.map.on("layer-add", ({ layer: r }) => {
      if (this._core.layerManager.addLayer(r), this._core.renderLoop.markDirty(), this._events.emit("layer-add", { layer: r }), r.on("refresh", () => {
        this._core.bufferCache.invalidate(r.id), this._core.terrainManager.invalidateLayer(r.id), this._core.renderLoop.markDirty();
      }), r.on("visibility-change", () => {
        this._core.renderLoop.markDirty();
      }), r.on("opacity-change", () => {
        this._core.renderLoop.markDirty();
      }), be(r) && r.animated) {
        const a = (c, h) => this._core.renderLoop.markDirty();
        this._animatedLayerCallbacks.set(r.id, a), this._core.renderLoop.onPreFrame(a);
      }
    }), this._core.map.on("layer-remove", ({ layer: r }) => {
      this._core.layerManager.removeLayer(r.id), this._core.bufferCache.invalidate(r.id), this._core.terrainManager.invalidateLayer(r.id), mn(r) && this._core.tileManager.invalidateSource(r.id), this._core.renderLoop.markDirty(), this._events.emit("layer-remove", { layer: r });
      const a = this._animatedLayerCallbacks.get(r.id);
      a && (this._core.renderLoop.offPreFrame(a), this._animatedLayerCallbacks.delete(r.id));
    }), t.globeEffects && (this._core.globeEffects = de(t.globeEffects)), t.renderEngine && (this._core.renderEngine = t.renderEngine, this._core.bufferCache.setRenderEngine(t.renderEngine), this._core.tileManager.setRenderEngine(t.renderEngine), this._core.terrainManager.setRenderEngine(t.renderEngine), this._core.renderLoop.setRenderEngine(t.renderEngine), this._core.renderLoop.setCameraStateProvider(() => this._mode.getCameraState()), s === "3d")) {
      const [r, a, c, h] = this._core.globeEffects.backgroundColor;
      t.renderEngine.setClearColor(r, a, c, h);
    }
    if (this._core.renderLoop.onPreFrame((r) => {
      this._applyCameraLock(r);
    }), this._core.renderLoop.onFrame((r, a) => {
      if (!this._core.gpuReady || !this._core.renderEngine) return;
      const c = {
        renderEngine: this._core.renderEngine,
        layerManager: this._core.layerManager,
        tileManager: this._core.tileManager,
        terrainManager: this._core.terrainManager,
        tileScheduler: this._core.tileScheduler,
        bufferCache: this._core.bufferCache,
        globeEffects: this._core.globeEffects
      };
      this._mode.renderFrame(c);
      const h = this._core.renderLoop.getStats();
      this._events.emit("frame", { frameNumber: a, fps: h.fps });
    }), this._core.container && this._core.canvas && this._core.setupResizeObserver(
      this._core.container,
      this._core.canvas,
      (r, a) => {
        this._mode.setViewport(r, a), this._core.layerManager.setCurrentZoom(this._mode.getState().zoom), this._core.renderLoop.markDirty(), this._emitViewChange();
      }
    ), this._core.container && this._interactionOptions !== !1 && this._mode.attachInteraction(
      this._core.container,
      () => this._core.renderLoop.markDirty(),
      () => {
        this._core.layerManager.setCurrentZoom(this._mode.getState().zoom), this._emitViewChange();
      },
      this._interactionOptions
    ), this._core.container) {
      let r = 0, a = 0, c = 0;
      const h = 5, d = 500, l = this._core.container, u = (y) => {
        const g = l.getBoundingClientRect();
        r = y.clientX - g.left, a = y.clientY - g.top, c = Date.now();
      }, f = (y) => {
        const g = l.getBoundingClientRect(), v = y.clientX - g.left, L = y.clientY - g.top, M = v - r, b = L - a, w = Date.now() - c;
        if (Math.sqrt(M * M + b * b) < h && w < d) {
          const C = this._mode.toMap(v, L);
          this._events.emit("click", {
            screenX: v,
            screenY: L,
            mapPoint: C
          });
        }
      }, _ = (y) => {
        const g = l.getBoundingClientRect(), v = y.clientX - g.left, L = y.clientY - g.top;
        this._events.emit("mousedown", {
          screenX: v,
          screenY: L,
          mapPoint: this._mode.toMap(v, L),
          button: y.button
        });
      }, p = (y) => {
        const g = l.getBoundingClientRect(), v = y.clientX - g.left, L = y.clientY - g.top;
        this._events.emit("mouseup", {
          screenX: v,
          screenY: L,
          mapPoint: this._mode.toMap(v, L),
          button: y.button
        });
      }, m = (y) => {
        const g = l.getBoundingClientRect(), v = y.clientX - g.left, L = y.clientY - g.top;
        this._events.emit("dblclick", {
          screenX: v,
          screenY: L,
          mapPoint: this._mode.toMap(v, L)
        });
      }, x = (y) => {
        const g = l.getBoundingClientRect(), v = y.clientX - g.left, L = y.clientY - g.top;
        this._events.emit("contextmenu", {
          screenX: v,
          screenY: L,
          mapPoint: this._mode.toMap(v, L),
          originalEvent: y
        });
      };
      l.addEventListener("pointerdown", u), l.addEventListener("pointerup", f), l.addEventListener("pointerdown", _), l.addEventListener("pointerup", p), l.addEventListener("dblclick", m), l.addEventListener("contextmenu", x), this._clickHandler = () => {
        l.removeEventListener("pointerdown", u), l.removeEventListener("pointerup", f), l.removeEventListener("pointerdown", _), l.removeEventListener("pointerup", p), l.removeEventListener("dblclick", m), l.removeEventListener("contextmenu", x);
      };
    }
    if (this._core.container) {
      let r = !1;
      const a = this._core.container, c = (h) => {
        r || (r = !0, requestAnimationFrame(() => {
          r = !1;
          const d = a.getBoundingClientRect(), l = h.clientX - d.left, u = h.clientY - d.top, f = this._mode.toMap(l, u);
          this._events.emit("pointer-move", { screenX: l, screenY: u, mapPoint: f });
        }));
      };
      a.addEventListener("pointermove", c), this._pointerMoveHandler = () => {
        a.removeEventListener("pointermove", c);
      };
    }
    this._readyPromise = new Promise((r) => {
      this._readyResolve = r;
    }), t.renderEngine && this._core.canvas ? this._core.initGpu(
      t.renderEngine,
      this._core.canvas,
      fn(s)
    ).then(
      () => {
        this._destroyed || (this._ready = !0, this._readyResolve?.(), this._events.emit("ready", void 0), this._core.renderLoop.start());
      },
      (r) => {
        this._destroyed || (console.error("[mapgpu] GPU init failed:", r), this._ready = !0, this._readyResolve?.(), this._events.emit("error", {
          kind: "webgpu-not-supported",
          userAgent: typeof navigator < "u" ? navigator.userAgent : "unknown"
        }), this._events.emit("ready", void 0));
      }
    ) : queueMicrotask(() => {
      this._destroyed || (this._ready = !0, this._readyResolve?.(), this._events.emit("ready", void 0));
    });
  }
  // ─── View State ───
  /** The currently active rendering mode (`'2d'` or `'3d'`). */
  get mode() {
    return this._mode.type;
  }
  /**
   * Current map center as `[longitude, latitude]` in EPSG:4326.
   *
   * @example
   * ```ts
   * const [lon, lat] = view.center;
   * ```
   */
  get center() {
    return this._mode.getState().center;
  }
  /** Current zoom level. */
  get zoom() {
    return this._mode.getState().zoom;
  }
  /** Current pitch (tilt) angle in degrees. Always `0` in 2D mode. */
  get pitch() {
    return this._mode.getState().pitch;
  }
  /** Current bearing (heading) in degrees. Always `0` in 2D mode. */
  get bearing() {
    return this._mode.getState().bearing;
  }
  /** Current map rotation in degrees. Always `0` in 3D mode. */
  get rotation() {
    return this._mode.getState().rotation;
  }
  /**
   * Whether the MapView has completed initialization.
   * This becomes `true` after GPU init succeeds (or after the headless microtask).
   */
  get ready() {
    return this._ready;
  }
  /** Whether camera lock/follow mode is currently active. */
  get cameraLocked() {
    return this._cameraLock !== null;
  }
  /**
   * Whether the WebGPU device and context are fully initialized and available.
   * May be `false` even after {@link ready} is `true` if WebGPU is not supported.
   */
  get gpuReady() {
    return this._core.gpuReady;
  }
  /** The underlying `<canvas>` element, or `null` in headless mode. */
  get canvas() {
    return this._core.canvas;
  }
  /**
   * Returns the full view state as a serializable {@link ViewState} object.
   * Useful for persisting view state or passing it to other components.
   *
   * @returns The current view state including center, zoom, pitch, bearing, and rotation.
   *
   * @example
   * ```ts
   * const state = view.getViewState();
   * localStorage.setItem('mapState', JSON.stringify(state));
   * ```
   */
  getViewState() {
    return this._mode.getState();
  }
  /**
   * Lock the camera to a resolver that returns the current target state.
   *
   * Unlike {@link goTo}, camera locks apply immediately and are intended for
   * object-follow / chase-camera scenarios where the target changes every tick.
   */
  lockCamera(t) {
    if (this._destroyed) throw new Error("View is destroyed");
    this._cameraLock = t, this._mode.cancelAnimation(), this._applyCameraLock(), this._core.renderLoop.markDirty();
  }
  /** Release the active camera lock, if any. */
  unlockCamera() {
    this._cameraLock = null;
  }
  // ─── Tool Manager ───
  /**
   * Lazy-initialized tool manager for drawing/editing tools.
   *
   * The ToolManager provides an overlay-based event interception system,
   * tool registry, undo/redo support via {@link CommandSystem}, and
   * typed event dispatch. It is created on first access.
   *
   * @example
   * ```ts
   * const tm = view.toolManager;
   * tm.registerTool(new DrawPointTool({ targetLayer }));
   * tm.activateTool('draw-point');
   * ```
   */
  get toolManager() {
    return this._toolManager || (this._toolManager = new Ao(), this._core.canvas && this._core.container && this._toolManager.init({
      canvas: this._core.canvas,
      container: this._core.container,
      toMap: (t, e) => this.toMap(t, e),
      toScreen: (t, e) => this.toScreen(t, e),
      getMode: () => this.mode,
      getZoom: () => this.zoom,
      markDirty: () => this._core.renderLoop.markDirty()
    })), this._toolManager;
  }
  // ─── Mode Switching ───
  /**
   * Switch between 2D and 3D rendering modes at runtime.
   *
   * Preserves the current center and zoom across the transition. The previous
   * mode's interaction handler is disposed and a new one is created for the
   * target mode. All vector buffer caches are invalidated since GPU pipelines
   * differ between modes. Emits a `'mode-change'` event on completion.
   *
   * If the view is already in the requested mode, this is a no-op.
   *
   * @param mode - The target rendering mode (`'2d'` or `'3d'`).
   * @returns A promise that resolves when the mode switch is complete.
   * @throws {Error} If the view has been destroyed.
   *
   * @example
   * ```ts
   * // Switch to globe view
   * await view.switchTo('3d');
   *
   * // Switch back to flat map
   * await view.switchTo('2d');
   * ```
   */
  async switchTo(t) {
    if (this._destroyed) throw new Error("View is destroyed");
    if (this._mode.type === t) return;
    const e = this._mode.getState(), n = this._mode.type;
    this._mode.dispose();
    const o = this._core.container?.clientWidth || 800, s = this._core.container?.clientHeight || 600;
    if (t === "3d") {
      this._mode = new un({
        center: e.center,
        zoom: e.zoom,
        pitch: e.pitch || 0,
        bearing: e.bearing || 0,
        viewportWidth: o,
        viewportHeight: s
      });
      const [r, a, c, h] = this._core.globeEffects.backgroundColor;
      this._core.renderEngine?.setClearColor(r, a, c, h);
    } else
      this._mode = new hn({
        center: e.center,
        zoom: e.zoom,
        rotation: e.rotation || 0,
        viewportWidth: o,
        viewportHeight: s
      });
    if (this._core.gpuReady && this._core.renderEngine) {
      const r = this._core.renderLoop.running;
      r && this._core.renderLoop.stop(), this._core.bufferCache.invalidateAll(), this._core.tileManager.invalidateAll(), this._core.terrainManager.invalidateAll(), await this._core.renderEngine.recover(fn(t)), r && this._core.renderLoop.start();
    }
    this._core.renderLoop.setCameraStateProvider(() => this._mode.getCameraState()), this._core.container && this._interactionOptions !== !1 && this._mode.attachInteraction(
      this._core.container,
      () => this._core.renderLoop.markDirty(),
      () => {
        this._core.layerManager.setCurrentZoom(this._mode.getState().zoom), this._emitViewChange();
      },
      this._interactionOptions
    ), this._events.emit("mode-change", { from: n, to: t }), this._core.renderLoop.markDirty(), this._emitViewChange();
  }
  // ─── Navigation ───
  /**
   * Animate the view to a new camera position.
   *
   * Accepts a partial {@link GoToTarget} — only the specified fields are
   * animated; others remain unchanged. The active mode determines which
   * fields are honored (e.g. `rotation` is 2D-only, `pitch`/`bearing` are
   * 3D-only). The returned promise resolves when the animation completes.
   *
   * Calling `goTo` while a previous animation is in progress cancels the
   * previous animation and starts the new one.
   *
   * @param target - The navigation target containing any combination of center,
   *   zoom, pitch, bearing, rotation, and duration.
   * @returns A promise that resolves when the animation finishes.
   * @throws {Error} If the view has been destroyed (returned as a rejected promise).
   *
   * @example
   * ```ts
   * // Fly to Istanbul over 1 second
   * await view.goTo({
   *   center: [29.0, 41.0],
   *   zoom: 12,
   *   duration: 1000,
   * });
   *
   * // Smoothly change only zoom
   * await view.goTo({ zoom: 8 });
   *
   * // Instant jump (no animation)
   * await view.goTo({ center: [0, 0], zoom: 2, duration: 0 });
   * ```
   */
  goTo(t) {
    if (this._destroyed) return Promise.reject(new Error("View is destroyed"));
    const e = this._mode.getState(), n = t.zoom !== void 0 && t.zoom !== e.zoom, o = t.center !== void 0;
    return n && this._events.emit("zoomstart", { zoom: e.zoom }), (o || n) && this._events.emit("movestart", { center: e.center }), this._mode.goTo(
      t,
      () => this._core.renderLoop.markDirty(),
      () => {
        this._core.layerManager.setCurrentZoom(this._mode.getState().zoom), this._clampToMaxBounds(), this._emitViewChange();
      }
    ).then(() => {
      const s = this._mode.getState();
      n && this._events.emit("zoomend", { zoom: s.zoom }), (o || n) && this._events.emit("moveend", { center: s.center });
    });
  }
  // ─── Navigation Helpers ───
  /**
   * Zoom the view to fit the given geographic bounds.
   *
   * Works in both 2D (Mercator) and 3D (Globe) modes.
   *
   * @param bounds - Geographic extent as `[minLon, minLat, maxLon, maxLat]` in EPSG:4326.
   * @param options - Optional padding (px) and animation duration.
   */
  fitBounds(t, e) {
    const [n, o, s, r] = t, a = (n + s) / 2, c = (o + r) / 2, h = this._core.container?.clientWidth ?? 256, d = this._core.container?.clientHeight ?? 256, l = e?.padding ?? 0, u = typeof l == "number" ? l : l.top, f = typeof l == "number" ? l : l.right, _ = typeof l == "number" ? l : l.bottom, p = typeof l == "number" ? l : l.left, m = h - p - f, x = d - u - _, [y, g] = B(n, o), [v, L] = B(s, r), M = Math.abs(v - y), b = Math.abs(L - g);
    if (M === 0 && b === 0)
      return this.goTo({ center: [a, c], duration: e?.duration });
    const w = O * 2 * Math.PI, C = M > 0 ? Math.log2(w * m / (M * 256)) : 22, T = b > 0 ? Math.log2(w * x / (b * 256)) : 22, E = Math.min(C, T, 22);
    return this.goTo({ center: [a, c], zoom: Math.max(0, E), duration: e?.duration });
  }
  /**
   * Pan to the given center coordinate, keeping the current zoom.
   */
  panTo(t, e) {
    return this.goTo({ center: t, duration: e?.duration });
  }
  /**
   * Jump/animate to a specific view state (Leaflet setView equivalent).
   */
  setView(t, e, n) {
    return this.goTo({ center: t, zoom: e, duration: n?.duration });
  }
  /** Zoom in by one level, optionally at a specific point. */
  zoomIn(t) {
    return this.goTo({ zoom: Math.min(this.zoom + 1, 22), duration: t?.duration ?? 300 });
  }
  /** Zoom out by one level. */
  zoomOut(t) {
    return this.goTo({ zoom: Math.max(this.zoom - 1, 0), duration: t?.duration ?? 300 });
  }
  /**
   * Fly to a target with arc animation (zoom out → pan → zoom in).
   * Like goTo but with a more dramatic camera path.
   */
  flyTo(t, e) {
    if (!t.center) return this.goTo({ ...t, duration: e?.duration });
    const n = this.zoom, o = t.zoom ?? n, s = Math.min(n, o) - 2, r = e?.duration ?? 2e3;
    return this.goTo({ center: t.center, zoom: Math.max(0, s), duration: r * 0.5 }).then(() => this.goTo({
      center: t.center,
      zoom: o,
      pitch: t.pitch,
      bearing: t.bearing,
      duration: r * 0.5
    }));
  }
  // ─── Bounds Constraint ───
  _maxBounds = null;
  /**
   * Restrict the map view to the given geographic bounds.
   * Pass `null` to remove the constraint.
   */
  setMaxBounds(t) {
    this._maxBounds = t, t && this._clampToMaxBounds();
  }
  /** Get the current max bounds constraint, or `null` if none. */
  getMaxBounds() {
    return this._maxBounds;
  }
  _clampToMaxBounds() {
    if (!this._maxBounds) return;
    const [t, e, n, o] = this._maxBounds, [s, r] = this.center, a = Math.max(t, Math.min(n, s)), c = Math.max(e, Math.min(o, r));
    (a !== s || c !== r) && this._mode.goTo(
      { center: [a, c], duration: 0 },
      () => this._core.renderLoop.markDirty(),
      () => this._emitViewChange()
    );
  }
  // ─── Coordinate Conversion ───
  /**
   * Convert screen pixel coordinates to geographic coordinates.
   *
   * Returns `null` if the screen position does not intersect the map surface
   * (e.g. clicking on empty space above the horizon in 3D mode).
   *
   * @param screenX - Horizontal pixel coordinate relative to the canvas.
   * @param screenY - Vertical pixel coordinate relative to the canvas.
   * @returns Geographic coordinates as `[longitude, latitude]` in EPSG:4326, or `null`.
   *
   * @example
   * ```ts
   * canvas.addEventListener('click', (e) => {
   *   const coords = view.toMap(e.offsetX, e.offsetY);
   *   if (coords) {
   *     console.log(`Clicked at lon=${coords[0]}, lat=${coords[1]}`);
   *   }
   * });
   * ```
   */
  toMap(t, e) {
    return this._mode.toMap(t, e);
  }
  /**
   * Convert geographic coordinates to screen pixel coordinates.
   *
   * Returns `null` if the geographic point is not visible on screen
   * (e.g. on the far side of the globe in 3D mode).
   *
   * @param lon - Longitude in degrees (EPSG:4326).
   * @param lat - Latitude in degrees (EPSG:4326).
   * @returns Screen pixel coordinates as `[x, y]`, or `null`.
   *
   * @example
   * ```ts
   * const pixel = view.toScreen(29.0, 41.0);
   * if (pixel) {
   *   tooltip.style.left = `${pixel[0]}px`;
   *   tooltip.style.top = `${pixel[1]}px`;
   * }
   * ```
   */
  toScreen(t, e) {
    return this._mode.toScreen(t, e);
  }
  // ─── Events ───
  /**
   * Register an event listener for a specific event type.
   *
   * Event types and their payloads are defined in {@link MapViewEvents}.
   * Multiple listeners can be registered for the same event.
   *
   * @param event - The event name to listen for.
   * @param handler - Callback function invoked with the event payload.
   *
   * @example
   * ```ts
   * view.on('ready', () => {
   *   console.log('Map is ready');
   * });
   *
   * view.on('view-change', ({ center, zoom }) => {
   *   updateURL(center, zoom);
   * });
   *
   * view.on('frame', ({ fps }) => {
   *   fpsCounter.textContent = `${fps.toFixed(0)} FPS`;
   * });
   * ```
   */
  on(t, e) {
    this._events.on(t, e);
  }
  /**
   * Remove a previously registered event listener.
   *
   * The `handler` reference must be the same function passed to {@link on}.
   *
   * @param event - The event name to stop listening for.
   * @param handler - The exact callback reference that was registered.
   *
   * @example
   * ```ts
   * const onViewChange = (e) => console.log(e);
   * view.on('view-change', onViewChange);
   *
   * // Later, remove the listener
   * view.off('view-change', onViewChange);
   * ```
   */
  off(t, e) {
    this._events.off(t, e);
  }
  /**
   * Returns a promise that resolves when the MapView is ready.
   *
   * This is equivalent to listening for the `'ready'` event, but in promise
   * form for convenient `await` usage. If the view is already ready, the
   * promise resolves immediately on the next microtask.
   *
   * @returns A promise that resolves when GPU initialization is complete.
   *
   * @example
   * ```ts
   * const view = new MapView({ container: '#map', renderEngine: engine });
   * await view.when();
   * // Safe to add layers and interact with the map
   * view.map.add(myLayer);
   * ```
   */
  when() {
    return this._readyPromise;
  }
  // ─── Lifecycle ───
  /**
   * Destroy the MapView and release all associated resources.
   *
   * Cancels any in-progress animations, disposes the active mode's interaction
   * handler, tears down the render loop and GPU resources, emits a `'destroy'`
   * event, and removes all event listeners. After calling `destroy()`, the
   * view instance must not be reused.
   *
   * Calling `destroy()` on an already-destroyed view is a safe no-op.
   *
   * @example
   * ```ts
   * // Clean up when component unmounts
   * view.destroy();
   * ```
   */
  destroy() {
    this._destroyed || (this._destroyed = !0, this._mode.cancelAnimation(), this._mode.dispose(), this._toolManager?.destroy(), this._toolManager = null, this._clickHandler?.(), this._clickHandler = null, this._pointerMoveHandler?.(), this._pointerMoveHandler = null, this._core.destroy(), this._events.emit("destroy", void 0), this._events.removeAll(), this._readyResolve?.());
  }
  // ─── Icon Symbology ───
  /**
   * Load an icon image for use with icon point symbols.
   *
   * Fetches the image from a URL (string) or accepts a pre-loaded ImageBitmap,
   * then registers it in the render engine's sprite atlas. The returned `id`
   * can be used as `PointSymbol.src` in renderers.
   *
   * @param id - Unique icon identifier (used as `symbol.src`)
   * @param source - Image URL (string) or pre-loaded ImageBitmap
   *
   * @example
   * ```ts
   * // Load from URL
   * await mapView.loadIcon('hospital', '/icons/hospital.png');
   *
   * // Use in renderer
   * layer.renderer = new SimpleRenderer({
   *   type: 'icon',
   *   src: 'hospital',
   *   size: 32,
   *   color: [255, 255, 255, 255],
   * });
   * ```
   */
  async loadIcon(t, e) {
    let n;
    if (typeof e == "string") {
      const s = await (await fetch(e)).blob();
      n = await createImageBitmap(s);
    } else
      n = e;
    this._core.renderEngine && this._core.renderEngine.loadIcon(t, n);
  }
  /**
   * Load a 3D model into the render engine for use with ModelSymbol.
   * Supports GLB binary, glTF text format (URL), and raw ArrayBuffer.
   *
   * @example
   * ```ts
   * // Load GLB from URL
   * await mapView.loadModel('missile', '/assets/missile.glb');
   *
   * // Load glTF from URL (.gltf + external .bin)
   * await mapView.loadModel('building', '/assets/building.gltf');
   *
   * // Load from ArrayBuffer (GLB)
   * const glb = await fetch('/assets/cube.glb').then(r => r.arrayBuffer());
   * await mapView.loadModel('cube', glb);
   *
   * // Use in renderer
   * layer.renderer = new SimpleRenderer({
   *   type: 'model',
   *   modelId: 'missile',
   *   scale: 100,
   * });
   * ```
   */
  async loadModel(t, e) {
    if (!this._core.renderEngine) return;
    if (e instanceof ArrayBuffer) {
      await this._core.renderEngine.loadModel(t, e);
      return;
    }
    const n = e;
    if (n.endsWith(".gltf") || n.includes(".gltf?")) {
      const o = n.substring(0, n.lastIndexOf("/") + 1), r = await (await fetch(n)).json(), a = r.buffers ?? [], c = await Promise.all(
        a.map(async (h) => {
          if (!h.uri) return new ArrayBuffer(h.byteLength);
          const d = h.uri.startsWith("data:") ? h.uri : o + h.uri;
          return (await fetch(d)).arrayBuffer();
        })
      );
      await this._core.renderEngine.loadModel(t, { json: r, buffers: c });
    } else {
      const s = await (await fetch(n)).arrayBuffer();
      await this._core.renderEngine.loadModel(t, s);
    }
  }
  /**
   * Load a GLTF/GLB model using the V2 renderer (correct depth & lighting).
   * Same API as loadModel but uses the standalone Gltf2Renderer pipeline.
   */
  async loadModelV2(t, e) {
    this._core.renderEngine && (typeof e == "string" ? await this._core.renderEngine.loadModelV2(t, e) : await this._core.renderEngine.loadModelV2(t, e));
  }
  /**
   * Read canonical renderer metadata for a loaded model.
   */
  getModelMetadata(t) {
    return this._core.renderEngine?.getModelMetadata(t) ?? null;
  }
  /**
   * Resolve a placed model instance to world-space bounds in EPSG:4326 + altitude meters.
   */
  resolveModelBounds(t) {
    return this._core.renderEngine?.resolveModelBounds(t) ?? null;
  }
  // ─── Bounds ───
  /**
   * Compute the visible map extent as an AABB in EPSG:4326.
   *
   * Projects the four canvas corners via {@link toMap} and returns the
   * axis-aligned bounding box. Returns `null` in headless mode or if
   * no corners could be projected (e.g. looking at sky in 3D).
   */
  getBounds() {
    const t = this._core.container?.clientWidth ?? 0, e = this._core.container?.clientHeight ?? 0;
    if (t === 0 || e === 0) return null;
    const n = [
      this._mode.toMap(0, 0),
      this._mode.toMap(t, 0),
      this._mode.toMap(t, e),
      this._mode.toMap(0, e)
    ].filter((c) => c !== null);
    if (n.length === 0) return null;
    let o = 1 / 0, s = 1 / 0, r = -1 / 0, a = -1 / 0;
    for (const [c, h] of n)
      c < o && (o = c), c > r && (r = c), h < s && (s = h), h > a && (a = h);
    return { minX: o, minY: s, maxX: r, maxY: a, spatialReference: "EPSG:4326" };
  }
  // ─── Hit Test ───
  /**
   * Query features at a screen position via GPU picking.
   *
   * Returns an array of {@link HitTestResult} sorted by layer draw order
   * (topmost first). Layers with `interactive === false` are skipped.
   *
   * @param screenX - Horizontal pixel coordinate relative to the canvas.
   * @param screenY - Vertical pixel coordinate relative to the canvas.
   */
  async hitTest(t, e) {
    if (!this._core.renderEngine) return [];
    const n = this._mode.toMap(t, e), o = await this._core.renderEngine.pick(t, e);
    if (o) {
      const l = this._core.layerManager.getLayer(o.layerId);
      if (l && l.interactive !== !1) {
        let u;
        return Ct(l) && (u = l.getFeatures().find((_) => _.id === o.featureId)), u || (u = { id: o.featureId, geometry: { type: "Point", coordinates: [] }, attributes: {} }), [{ layer: l, feature: u, mapPoint: n }];
      }
    }
    if (!n) return [];
    const s = this._mode.getState().zoom, c = 16 * (360 / (256 * Math.pow(2, s))), h = [], d = this._core.layerManager.getLayerIds();
    for (const l of d) {
      const u = this._core.layerManager.getLayer(l);
      if (!u || !u.visible || !u.loaded || u.interactive === !1 || !Ct(u)) continue;
      const f = u.getFeatures();
      let _ = c, p;
      for (const m of f) {
        const x = m.geometry;
        if (x) {
          if (x.type === "Point") {
            const y = x.coordinates, g = y[0] - n[0], v = y[1] - n[1], L = Math.sqrt(g * g + v * v);
            L < _ && (_ = L, p = m);
          } else if (x.type === "LineString") {
            const y = x.coordinates;
            for (let g = 0; g < y.length - 1; g++) {
              const v = Zo(
                n[0],
                n[1],
                y[g][0],
                y[g][1],
                y[g + 1][0],
                y[g + 1][1]
              );
              v < _ && (_ = v, p = m);
            }
          }
        }
      }
      p && h.push({ layer: u, feature: p, mapPoint: n });
    }
    return h;
  }
  // ─── SVG Icon ───
  /**
   * Load an SVG icon by rasterizing it to an ImageBitmap and registering
   * it in the sprite atlas. The returned `id` can be used as
   * `PointSymbol.src` in renderers.
   *
   * @param id - Unique icon identifier
   * @param svgMarkup - SVG source markup string
   * @param width - Rasterization width in pixels
   * @param height - Rasterization height in pixels
   */
  async loadSvgIcon(t, e, n, o) {
    let s;
    try {
      const r = new Blob([e], { type: "image/svg+xml" }), a = URL.createObjectURL(r);
      try {
        const c = await new Promise((l, u) => {
          const f = new Image(n, o);
          f.onload = () => l(f), f.onerror = (_) => u(new Error(`SVG image load failed for "${t}": ${_}`)), f.src = a;
        }), h = new OffscreenCanvas(n, o);
        h.getContext("2d").drawImage(c, 0, 0, n, o), s = await createImageBitmap(h);
      } finally {
        URL.revokeObjectURL(a);
      }
    } catch (r) {
      throw console.error(`[mapgpu] loadSvgIcon("${t}") failed to decode SVG:`, r), r;
    }
    await this.loadIcon(t, s);
  }
  // ─── Debug ───
  /**
   * Toggle wireframe debug overlay on raster tiles.
   * When enabled, a cyan wireframe grid is drawn over each tile
   * to visualize the underlying vertex grid.
   */
  set debugTileVertices(t) {
    this._core.renderEngine?.setDebugTileVertices(t), this._core.renderLoop.markDirty();
  }
  get debugTileVertices() {
    return !1;
  }
  /**
   * Toggle extrusion debug mode.
   * When enabled: shader shows clipZ/height/normal as color overlay,
   * and CPU-side ExtrusionConverter logs geometry stats to console.
   */
  set extrusionDebug(t) {
    this._core.renderEngine?.setExtrusionDebug(t), typeof globalThis < "u" && (globalThis.__MAPGPU_EXTRUSION_DEBUG = t), this._core.renderLoop.markDirty();
  }
  get extrusionDebug() {
    return typeof globalThis < "u" && !!globalThis.__MAPGPU_EXTRUSION_DEBUG;
  }
  /**
   * Apply debug height brush at given mercator coordinates.
   * Coordinate system must match the current mode's tile extents:
   * - 2D: EPSG:3857 meters
   * - 3D globe: normalized mercator (0..1)
   */
  applyDebugBrush(t, e, n, o, s) {
    this._core.renderEngine?.applyDebugBrush(t, e, n, o, s), this._core.renderLoop.markDirty();
  }
  /** Clear all debug height brush data */
  clearDebugBrush() {
    this._core.renderEngine?.clearDebugBrush(), this._core.renderLoop.markDirty();
  }
  /** Set height exaggeration factor for debug overlay (default 1.0) */
  setHeightExaggeration(t) {
    this._core.renderEngine?.setHeightExaggeration(t), this._core.renderLoop.markDirty();
  }
  /**
   * Configure globe effects: lighting, atmosphere, pole caps, and background color.
   * Partial updates are merged with existing config.
   *
   * @example
   * ```ts
   * view.setGlobeEffects({ lighting: { ambient: 0.7 } });
   * view.setGlobeEffects({ atmosphere: { enabled: false } });
   * view.setGlobeEffects({ backgroundColor: [0.02, 0.02, 0.08, 1.0] });
   * ```
   */
  setGlobeEffects(t) {
    const e = this._core.globeEffects;
    if (this._core.globeEffects = de({
      fog: t.fog ? { ...e.fog, ...t.fog } : e.fog,
      nightImagery: t.nightImagery ? { ...e.nightImagery, ...t.nightImagery } : e.nightImagery,
      waterMask: t.waterMask ? { ...e.waterMask, ...t.waterMask } : e.waterMask,
      atmosphere: t.atmosphere ? { ...e.atmosphere, ...t.atmosphere } : e.atmosphere,
      sky: t.sky ? { ...e.sky, ...t.sky } : e.sky,
      lighting: t.lighting ? { ...e.lighting, ...t.lighting } : e.lighting,
      poleCaps: t.poleCaps ? { ...e.poleCaps, ...t.poleCaps } : e.poleCaps,
      backgroundColor: t.backgroundColor ?? e.backgroundColor
    }), t.backgroundColor) {
      const [n, o, s, r] = this._core.globeEffects.backgroundColor;
      this._core.renderEngine?.setClearColor(n, o, s, r);
    }
    this._core.renderLoop.markDirty();
  }
  /** Configure scene lighting for extrusion and 3D geometry. */
  setLighting(t) {
    this._core.renderEngine?.setLighting(t), this._core.renderLoop.markDirty();
  }
  // ─── Private ───
  /**
   * Emit a `'view-change'` event with the current view state and mode.
   * Called after any camera/viewport mutation (pan, zoom, resize, goTo, switchTo).
   */
  _emitViewChange() {
    const t = this._mode.getState();
    this._events.emit("view-change", {
      center: t.center,
      zoom: t.zoom,
      pitch: t.pitch,
      bearing: t.bearing,
      rotation: t.rotation,
      mode: this._mode.type
    });
  }
  /** Resolve and apply the current camera-lock target before a frame renders. */
  _applyCameraLock(t = 0) {
    if (!this._cameraLock) return;
    const e = this._cameraLock.getTarget();
    if (!e) return;
    const n = this._mode.getState(), o = this._cameraLock.fields, s = {
      center: et("center", o, e) && e.center ? this._resolveCameraLockCenter(n, o, e) : n.center,
      zoom: et("zoom", o, e) && e.zoom !== void 0 ? e.zoom : n.zoom,
      pitch: et("pitch", o, e) && e.pitch !== void 0 ? e.pitch : n.pitch,
      bearing: et("bearing", o, e) && e.bearing !== void 0 ? e.bearing : n.bearing,
      rotation: et("rotation", o, e) && e.rotation !== void 0 ? e.rotation : n.rotation
    }, { nextState: r, needsMoreSmoothing: a } = Wo(
      n,
      s,
      this._cameraLock.smoothing,
      t
    );
    if (Ho(n, r)) {
      a && this._core.renderLoop.markDirty();
      return;
    }
    this._mode.cancelAnimation(), this._mode.setState(r), this._core.layerManager.setCurrentZoom(this._mode.getState().zoom), this._clampToMaxBounds(), this._emitViewChange(), a && this._core.renderLoop.markDirty();
  }
  _resolveCameraLockCenter(t, e, n) {
    if (!n.center) return t.center;
    if (this._mode.type !== "3d" || n.altitude === void 0)
      return n.center;
    const o = et("zoom", e, n) && n.zoom !== void 0 ? n.zoom : t.zoom, s = et("pitch", e, n) && n.pitch !== void 0 ? n.pitch : t.pitch, r = et("bearing", e, n) && n.bearing !== void 0 ? n.bearing : t.bearing, a = this._core.container?.clientWidth ?? 800, c = this._core.container?.clientHeight ?? 600;
    return To({
      center: t.center,
      zoom: o,
      pitch: s,
      bearing: r,
      viewportWidth: a,
      viewportHeight: c,
      targetCenter: n.center,
      targetAltitude: n.altitude
    });
  }
}
function Zo(i, t, e, n, o, s) {
  const r = o - e, a = s - n, c = r * r + a * a;
  if (c === 0) return Math.sqrt((i - e) ** 2 + (t - n) ** 2);
  const h = Math.max(0, Math.min(1, ((i - e) * r + (t - n) * a) / c)), d = e + h * r, l = n + h * a;
  return Math.sqrt((i - d) ** 2 + (t - l) ** 2);
}
function Ho(i, t) {
  return Go(i.center[0], t.center[0]) && wt(i.center[1], t.center[1]) && wt(i.zoom, t.zoom) && wt(i.pitch, t.pitch) && dn(i.bearing, t.bearing) && dn(i.rotation, t.rotation);
}
function wt(i, t, e = 1e-6) {
  return Math.abs(i - t) <= e;
}
function Go(i, t, e = 1e-6) {
  return Math.abs(Ot(i, t)) <= e;
}
function dn(i, t, e = 1e-6) {
  return Math.abs(Vo(i, t)) <= e;
}
function et(i, t, e) {
  return t && t.length > 0 ? t.includes(i) : e[i] !== void 0;
}
function Wo(i, t, e, n) {
  let o = !1;
  const s = fe(
    i.center[0],
    t.center[0],
    e?.centerHalfLifeMs,
    n,
    $o
  ), r = ue(
    i.center[1],
    t.center[1],
    e?.centerHalfLifeMs,
    n
  ), a = ue(
    i.zoom,
    t.zoom,
    e?.zoomHalfLifeMs,
    n
  ), c = ue(
    i.pitch,
    t.pitch,
    e?.pitchHalfLifeMs,
    n
  ), h = fe(
    i.bearing,
    t.bearing,
    e?.bearingHalfLifeMs,
    n,
    Ut
  ), d = fe(
    i.rotation,
    t.rotation,
    e?.rotationHalfLifeMs,
    n,
    Ut
  );
  return o = s.needsMore || r.needsMore || a.needsMore || c.needsMore || h.needsMore || d.needsMore, {
    nextState: {
      center: [s.value, r.value],
      zoom: a.value,
      pitch: c.value,
      bearing: h.value,
      rotation: d.value
    },
    needsMoreSmoothing: o
  };
}
function ue(i, t, e, n) {
  if (e === void 0)
    return { value: t, needsMore: !1 };
  if (!Number.isFinite(e) || e <= 0)
    return { value: t, needsMore: !1 };
  if (wt(i, t))
    return { value: t, needsMore: !1 };
  if (n <= 0)
    return { value: i, needsMore: !0 };
  const o = Vn(n, e), s = i + (t - i) * o;
  return {
    value: s,
    needsMore: !wt(s, t)
  };
}
function fe(i, t, e, n, o) {
  if (e === void 0)
    return { value: o(t), needsMore: !1 };
  if (!Number.isFinite(e) || e <= 0)
    return { value: o(t), needsMore: !1 };
  const s = Ot(i, t);
  if (Math.abs(s) <= 1e-6)
    return { value: o(t), needsMore: !1 };
  if (n <= 0)
    return { value: o(i), needsMore: !0 };
  const r = Vn(n, e), a = o(i + s * r);
  return {
    value: a,
    needsMore: Math.abs(Ot(a, t)) > 1e-6
  };
}
function Vn(i, t) {
  return 1 - Math.pow(0.5, i / t);
}
function Ot(i, t) {
  const e = Ut(i);
  let o = Ut(t) - e;
  return o > 180 && (o -= 360), o < -180 && (o += 360), o;
}
function Vo(i, t) {
  return Ot(i, t);
}
function Ut(i) {
  const t = i % 360;
  return t < 0 ? t + 360 : t;
}
function $o(i) {
  let t = ((i + 180) % 360 + 360) % 360 - 180;
  return t === -180 && i > 0 && (t = 180), t;
}
function Oo(i, t, e = 64) {
  const [n, o] = i, s = o * Math.PI / 180, r = n * Math.PI / 180, a = t / O, c = [];
  for (let h = 0; h <= e; h++) {
    const d = 2 * Math.PI * h / e, l = Math.asin(
      Math.sin(s) * Math.cos(a) + Math.cos(s) * Math.sin(a) * Math.cos(d)
    ), u = r + Math.atan2(
      Math.sin(d) * Math.sin(a) * Math.cos(s),
      Math.cos(a) - Math.sin(s) * Math.sin(l)
    );
    c.push([u * 180 / Math.PI, l * 180 / Math.PI]);
  }
  return c.length > 0 && (c[c.length - 1] = c[0].slice()), { type: "Polygon", coordinates: [c] };
}
function _s(i, t, e = 64) {
  return t.map((n, o) => ({
    id: `range-ring-${o}`,
    geometry: Oo(i, n, e),
    attributes: { radius: n }
  }));
}
const rt = Math.PI / 180;
function Uo(i, t, e, n, o, s) {
  const r = n * rt, a = o * rt, c = s * rt, h = Math.cos(r), d = Math.sin(r), l = Math.cos(a), u = Math.sin(a), f = Math.cos(c), _ = Math.sin(c);
  return [
    h * l * i + (h * u * _ - d * f) * t + (h * u * f + d * _) * e,
    d * l * i + (d * u * _ + h * f) * t + (d * u * f - h * _) * e,
    -u * i + l * _ * t + l * f * e
  ];
}
function ms(i) {
  const { center: t, heading: e, pitch: n, roll: o, fovH: s, fovV: r, near: a, far: c } = i, [h, d, l] = t, u = a * Math.tan(s / 2 * rt), f = a * Math.tan(r / 2 * rt), _ = c * Math.tan(s / 2 * rt), p = c * Math.tan(r / 2 * rt), m = [
    [-u, -a, -f],
    // 0: near bottom-left
    [u, -a, -f],
    // 1: near bottom-right
    [u, -a, f],
    // 2: near top-right
    [-u, -a, f],
    // 3: near top-left
    [-_, -c, -p],
    // 4: far bottom-left
    [_, -c, -p],
    // 5: far bottom-right
    [_, -c, p],
    // 6: far top-right
    [-_, -c, p]
    // 7: far top-left
  ], [x, y] = B(h, d), g = [], v = [];
  for (const b of m) {
    const [w, C, T] = Uo(b[0], b[1], b[2], e, n, o), E = x + w, P = y + C, I = l + T;
    v.push([E, P, I]);
    const [D, S] = _e(E, P);
    g.push([D, S, I]);
  }
  const L = [
    // Near plane
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    // Far plane
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    // Connectors
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7]
  ], M = Xo(v);
  return { corners: g, edges: L, planes: M, originMerc: [x, y, l] };
}
function ut(i, t, e) {
  const n = t[0] - i[0], o = t[1] - i[1], s = t[2] - i[2], r = e[0] - i[0], a = e[1] - i[1], c = e[2] - i[2];
  let h = o * c - s * a, d = s * r - n * c, l = n * a - o * r;
  const u = Math.sqrt(h * h + d * d + l * l) || 1;
  h /= u, d /= u, l /= u;
  const f = -(h * i[0] + d * i[1] + l * i[2]);
  return { normal: [h, d, l], d: f };
}
function Xo(i) {
  return [
    ut(i[0], i[1], i[2]),
    // near   (0,1,2)
    ut(i[5], i[4], i[7]),
    // far    (5,4,7)
    ut(i[4], i[0], i[3]),
    // left   (4,0,3)
    ut(i[1], i[5], i[6]),
    // right  (1,5,6)
    ut(i[3], i[2], i[6]),
    // top    (3,2,6)
    ut(i[0], i[4], i[5])
    // bottom (0,4,5)
  ];
}
function ps(i, t) {
  const [e, n] = B(i[0], i[1]), o = i[2];
  for (const s of t)
    if (s.normal[0] * e + s.normal[1] * n + s.normal[2] * o + s.d < 0) return !1;
  return !0;
}
function gs(i, t, e, n, o) {
  const [s, r] = B(i[0], i[1]), a = t, c = s - a, h = s + a, d = r - a, l = r + a;
  let u = !0;
  for (const f of o) {
    const { normal: _, d: p } = f, [m, x, y] = _, g = m >= 0 ? h : c, v = x >= 0 ? l : d, L = y >= 0 ? n : e, M = m >= 0 ? c : h, b = x >= 0 ? d : l, w = y >= 0 ? e : n;
    if (m * g + x * v + y * L + p < 0) return "outside";
    m * M + x * b + y * w + p < 0 && (u = !1);
  }
  return u ? "inside" : "intersecting";
}
class st {
  minLon;
  minLat;
  maxLon;
  maxLat;
  constructor(t, e) {
    this.minLon = Math.min(t[0], e[0]), this.minLat = Math.min(t[1], e[1]), this.maxLon = Math.max(t[0], e[0]), this.maxLat = Math.max(t[1], e[1]);
  }
  /** Create from a flat array [minLon, minLat, maxLon, maxLat]. */
  static fromArray(t) {
    return new st([t[0], t[1]], [t[2], t[3]]);
  }
  /** Create bounds that contain all given points. */
  static fromPoints(t) {
    if (t.length === 0) return new st([0, 0], [0, 0]);
    let e = 1 / 0, n = 1 / 0, o = -1 / 0, s = -1 / 0;
    for (const [r, a] of t)
      r < e && (e = r), r > o && (o = r), a < n && (n = a), a > s && (s = a);
    return new st([e, n], [o, s]);
  }
  /** Southwest corner [lon, lat]. */
  get southWest() {
    return [this.minLon, this.minLat];
  }
  /** Northeast corner [lon, lat]. */
  get northEast() {
    return [this.maxLon, this.maxLat];
  }
  /** Center point [lon, lat]. */
  get center() {
    return [(this.minLon + this.maxLon) / 2, (this.minLat + this.maxLat) / 2];
  }
  /** Width in degrees. */
  get width() {
    return this.maxLon - this.minLon;
  }
  /** Height in degrees. */
  get height() {
    return this.maxLat - this.minLat;
  }
  /** Check if bounds are valid (non-zero area). */
  get isValid() {
    return isFinite(this.minLon) && isFinite(this.maxLon) && isFinite(this.minLat) && isFinite(this.maxLat) && this.minLon <= this.maxLon && this.minLat <= this.maxLat;
  }
  /** Check if a point is inside the bounds. */
  contains(t) {
    return t[0] >= this.minLon && t[0] <= this.maxLon && t[1] >= this.minLat && t[1] <= this.maxLat;
  }
  /** Check if another bounds is fully inside this bounds. */
  containsBounds(t) {
    return t.minLon >= this.minLon && t.maxLon <= this.maxLon && t.minLat >= this.minLat && t.maxLat <= this.maxLat;
  }
  /** Check if another bounds intersects this bounds. */
  intersects(t) {
    return t.maxLon >= this.minLon && t.minLon <= this.maxLon && t.maxLat >= this.minLat && t.minLat <= this.maxLat;
  }
  /** Return a new bounds expanded to include the given point. */
  extend(t) {
    return new st(
      [Math.min(this.minLon, t[0]), Math.min(this.minLat, t[1])],
      [Math.max(this.maxLon, t[0]), Math.max(this.maxLat, t[1])]
    );
  }
  /** Return a new bounds that is the union of this and another. */
  union(t) {
    return new st(
      [Math.min(this.minLon, t.minLon), Math.min(this.minLat, t.minLat)],
      [Math.max(this.maxLon, t.maxLon), Math.max(this.maxLat, t.maxLat)]
    );
  }
  /** Return a new bounds padded by a ratio (0.1 = 10% padding). */
  pad(t) {
    const e = this.width * t, n = this.height * t;
    return new st(
      [this.minLon - e, this.minLat - n],
      [this.maxLon + e, this.maxLat + n]
    );
  }
  /** Check equality with another bounds. */
  equals(t) {
    return this.minLon === t.minLon && this.minLat === t.minLat && this.maxLon === t.maxLon && this.maxLat === t.maxLat;
  }
  /** Convert to flat array [minLon, minLat, maxLon, maxLat]. */
  toArray() {
    return [this.minLon, this.minLat, this.maxLon, this.maxLat];
  }
  toString() {
    return `LatLngBounds([${this.minLon}, ${this.minLat}], [${this.maxLon}, ${this.maxLat}])`;
  }
}
function ys(i, t = [1, 1, 1, 1]) {
  const { positions: e, normals: n, indices: o, vertexCount: s } = i, r = o.length, a = 8, c = new Float32Array(s * a);
  for (let D = 0; D < s; D++) {
    const S = D * a, F = D * 3, z = D * 3;
    c[S + 0] = e[F], c[S + 1] = e[F + 1], c[S + 2] = e[F + 2], c[S + 3] = n[z], c[S + 4] = n[z + 1], c[S + 5] = n[z + 2], c[S + 6] = 0, c[S + 7] = 0;
  }
  let h = 1 / 0, d = 1 / 0, l = 1 / 0, u = -1 / 0, f = -1 / 0, _ = -1 / 0;
  for (let D = 0; D < e.length; D += 3) {
    const S = e[D], F = e[D + 1], z = e[D + 2];
    S < h && (h = S), S > u && (u = S), F < d && (d = F), F > f && (f = F), z < l && (l = z), z > _ && (_ = z);
  }
  const p = c.byteLength, m = r * 4, x = (4 - (p + m) % 4) % 4, y = p + m + x, v = JSON.stringify({
    asset: { version: "2.0", generator: "mapgpu-generateGLB" },
    meshes: [{
      primitives: [{
        attributes: {
          POSITION: 0,
          NORMAL: 1,
          TEXCOORD_0: 2
        },
        indices: 3,
        material: 0
      }]
    }],
    accessors: [
      // 0: POSITION (vec3)
      { bufferView: 0, byteOffset: 0, componentType: 5126, count: s, type: "VEC3", min: [h, d, l], max: [u, f, _] },
      // 1: NORMAL (vec3)
      { bufferView: 0, byteOffset: 12, componentType: 5126, count: s, type: "VEC3" },
      // 2: TEXCOORD_0 (vec2)
      { bufferView: 0, byteOffset: 24, componentType: 5126, count: s, type: "VEC2" },
      // 3: indices (uint32)
      { bufferView: 1, byteOffset: 0, componentType: 5125, count: r, type: "SCALAR" }
    ],
    bufferViews: [
      // 0: interleaved vertex buffer
      { buffer: 0, byteOffset: 0, byteLength: p, byteStride: 32, target: 34962 },
      // 1: index buffer
      { buffer: 0, byteOffset: p, byteLength: m, target: 34963 }
    ],
    buffers: [{ byteLength: y }],
    materials: [{
      pbrMetallicRoughness: {
        baseColorFactor: t,
        metallicFactor: 0,
        roughnessFactor: 0.8
      }
    }]
  }), L = new TextEncoder().encode(v), M = (4 - L.length % 4) % 4, b = L.length + M, w = 20 + b + 8 + y, C = new ArrayBuffer(w), T = new DataView(C), E = new Uint8Array(C);
  let P = 0;
  T.setUint32(P, 1179937895, !0), P += 4, T.setUint32(P, 2, !0), P += 4, T.setUint32(P, w, !0), P += 4, T.setUint32(P, b, !0), P += 4, T.setUint32(P, 1313821514, !0), P += 4, E.set(L, P), P += L.length;
  for (let D = 0; D < M; D++) E[P++] = 32;
  return T.setUint32(P, y, !0), P += 4, T.setUint32(P, 5130562, !0), P += 4, E.set(new Uint8Array(c.buffer), P), P += p, new Uint32Array(C, P, r).set(o), P += m, C;
}
const ft = 86400, _n = 24405875e-1;
class U {
  /** Integer Julian day number. */
  dayNumber;
  /** Seconds within the day [0, 86400). */
  secondsOfDay;
  constructor(t = 0, e = 0) {
    const n = Math.floor(e / ft);
    this.dayNumber = t + n, this.secondsOfDay = e - n * ft;
  }
  /** Create from a JavaScript Date. */
  static fromDate(t) {
    const n = t.getTime() / (ft * 1e3), o = _n + n, s = Math.floor(o), r = (o - s) * ft;
    return new U(s, r);
  }
  /** Create from an ISO 8601 string. */
  static fromIso8601(t) {
    return U.fromDate(new Date(t));
  }
  /** Create from epoch milliseconds. */
  static fromEpochMs(t) {
    return U.fromDate(new Date(t));
  }
  /** Current time. */
  static now() {
    return U.fromDate(/* @__PURE__ */ new Date());
  }
  /** Convert to JavaScript Date. */
  toDate() {
    const e = ((this.dayNumber - _n) * ft + this.secondsOfDay) * 1e3;
    return new Date(e);
  }
  /** Convert to ISO 8601 string. */
  toIso8601() {
    return this.toDate().toISOString();
  }
  /** Convert to epoch milliseconds. */
  toEpochMs() {
    return this.toDate().getTime();
  }
  /** Add seconds and return a new JulianDate. */
  addSeconds(t) {
    return new U(this.dayNumber, this.secondsOfDay + t);
  }
  /** Difference in seconds: this - other. */
  secondsDifference(t) {
    return (this.dayNumber - t.dayNumber) * ft + (this.secondsOfDay - t.secondsOfDay);
  }
  /** Compare: -1 if this < other, 0 if equal, 1 if this > other. */
  compare(t) {
    return this.dayNumber < t.dayNumber ? -1 : this.dayNumber > t.dayNumber ? 1 : this.secondsOfDay < t.secondsOfDay ? -1 : this.secondsOfDay > t.secondsOfDay ? 1 : 0;
  }
  /** Check equality. */
  equals(t) {
    return this.dayNumber === t.dayNumber && this.secondsOfDay === t.secondsOfDay;
  }
  /** Linear interpolation between two dates. */
  static lerp(t, e, n) {
    const o = e.secondsDifference(t);
    return t.addSeconds(o * n);
  }
  /** Clone. */
  clone() {
    return new U(this.dayNumber, this.secondsOfDay);
  }
  toString() {
    return this.toIso8601();
  }
}
class xs {
  startTime;
  stopTime;
  currentTime;
  multiplier;
  shouldAnimate;
  clockRange;
  clockStep;
  _events = new ct();
  _rafId = null;
  _lastRealTime = 0;
  constructor(t) {
    const e = U.now();
    this.startTime = t?.startTime ?? e, this.stopTime = t?.stopTime ?? e.addSeconds(86400), this.currentTime = t?.currentTime ?? this.startTime.clone(), this.multiplier = t?.multiplier ?? 1, this.shouldAnimate = t?.shouldAnimate ?? !1, this.clockRange = t?.clockRange ?? "LOOP_STOP", this.clockStep = t?.clockStep ?? "SYSTEM_CLOCK_MULTIPLIER";
  }
  /** Subscribe to clock events. */
  on(t, e) {
    this._events.on(t, e);
  }
  /** Unsubscribe from clock events. */
  off(t, e) {
    this._events.off(t, e);
  }
  /**
   * Advance the clock by the given real-world delta (milliseconds).
   * Call this from the render loop or manually.
   */
  tick(t) {
    if (!this.shouldAnimate) return this.currentTime;
    let e;
    switch (this.clockStep) {
      case "SYSTEM_CLOCK":
        this.currentTime = U.now(), e = t / 1e3;
        break;
      case "TICK_DEPENDENT":
        e = this.multiplier, this.currentTime = this.currentTime.addSeconds(e);
        break;
      case "SYSTEM_CLOCK_MULTIPLIER":
      default:
        e = t / 1e3 * this.multiplier, this.currentTime = this.currentTime.addSeconds(e);
        break;
    }
    return this._applyRange(), this._events.emit("tick", { time: this.currentTime, deltaSeconds: e }), this.currentTime;
  }
  /** Start automatic ticking via requestAnimationFrame. */
  start() {
    this.shouldAnimate = !0, this._lastRealTime = performance.now(), this._events.emit("playback-change", { shouldAnimate: !0 }), this._scheduleFrame();
  }
  /** Stop automatic ticking. */
  stop() {
    this.shouldAnimate = !1, this._rafId !== null && (cancelAnimationFrame(this._rafId), this._rafId = null), this._events.emit("playback-change", { shouldAnimate: !1 });
  }
  /** Reset to start time. */
  reset() {
    this.currentTime = this.startTime.clone();
  }
  /** Set time range from ISO 8601 interval string (e.g., "start/stop"). */
  setInterval(t) {
    const e = t.split("/");
    e.length === 2 && (this.startTime = U.fromIso8601(e[0]), this.stopTime = U.fromIso8601(e[1]), this.currentTime.compare(this.startTime) < 0 && (this.currentTime = this.startTime.clone()));
  }
  /** Progress ratio 0..1 within the time range. */
  get progress() {
    const t = this.stopTime.secondsDifference(this.startTime);
    if (t <= 0) return 0;
    const e = this.currentTime.secondsDifference(this.startTime);
    return Math.max(0, Math.min(1, e / t));
  }
  /** Destroy and stop all animation frames. */
  destroy() {
    this.stop(), this._events.removeAll();
  }
  _applyRange() {
    if (this.clockRange === "UNBOUNDED") return;
    const t = this.currentTime.compare(this.stopTime) >= 0, e = this.currentTime.compare(this.startTime) < 0;
    this.clockRange === "CLAMPED" && (t && (this.currentTime = this.stopTime.clone()), e && (this.currentTime = this.startTime.clone())), this.clockRange === "LOOP_STOP" && (t && (this.currentTime = this.startTime.clone()), e && (this.currentTime = this.stopTime.clone()));
  }
  _scheduleFrame() {
    this.shouldAnimate && (this._rafId = requestAnimationFrame((t) => {
      const e = t - this._lastRealTime;
      this._lastRealTime = t, this.tick(e), this._scheduleFrame();
    }));
  }
}
class vs {
  isConstant = !0;
  _value;
  constructor(t) {
    this._value = t;
  }
  getValue(t) {
    return this._value;
  }
  setValue(t) {
    this._value = t;
  }
}
class Ms {
  isConstant = !1;
  _samples = [];
  _interpolation;
  _dimension;
  /**
   * @param dimension Number of components per value (e.g., 3 for [lon, lat, alt]).
   * @param interpolation Interpolation method between samples.
   */
  constructor(t = 3, e = "linear") {
    this._dimension = t, this._interpolation = e;
  }
  get interpolation() {
    return this._interpolation;
  }
  set interpolation(t) {
    this._interpolation = t;
  }
  /** Number of samples. */
  get length() {
    return this._samples.length;
  }
  /** Add a single sample. Maintains sorted order. */
  addSample(t, e) {
    const n = { time: t, value: e };
    let o = 0, s = this._samples.length;
    for (; o < s; ) {
      const r = o + s >>> 1;
      this._samples[r].time.compare(t) < 0 ? o = r + 1 : s = r;
    }
    this._samples.splice(o, 0, n);
  }
  /**
   * Add samples from a flat array with epoch.
   * Format: [t0, v0_0, v0_1, ..., t1, v1_0, v1_1, ...]
   * where t is seconds since epoch.
   */
  addSamplesFromEpoch(t, e) {
    const n = 1 + this._dimension;
    for (let o = 0; o + n <= e.length; o += n) {
      const s = e[o], r = e.slice(o + 1, o + 1 + this._dimension);
      this.addSample(t.addSeconds(s), r);
    }
  }
  getValue(t) {
    if (this._samples.length === 0)
      return new Array(this._dimension).fill(0);
    if (this._samples.length === 1)
      return [...this._samples[0].value];
    if (t.compare(this._samples[0].time) <= 0)
      return [...this._samples[0].value];
    const e = this._samples[this._samples.length - 1];
    if (t.compare(e.time) >= 0)
      return [...e.value];
    let n = 0, o = this._samples.length - 1;
    for (; n < o - 1; ) {
      const l = n + o >>> 1;
      this._samples[l].time.compare(t) <= 0 ? n = l : o = l;
    }
    const s = this._samples[n], r = this._samples[o], a = r.time.secondsDifference(s.time), c = t.secondsDifference(s.time), h = a > 0 ? c / a : 0;
    if (this._interpolation === "step")
      return [...s.value];
    const d = [];
    for (let l = 0; l < this._dimension; l++)
      d.push(s.value[l] + h * (r.value[l] - s.value[l]));
    return d;
  }
}
class bs {
  isConstant;
  _callback;
  constructor(t, e = !1) {
    this._callback = t, this.isConstant = e;
  }
  getValue(t) {
    return this._callback(t);
  }
  setCallback(t) {
    this._callback = t;
  }
}
class ws {
  isConstant = !1;
  _intervals = [];
  addInterval(t, e, n) {
    this._intervals.push({ start: t, stop: e, value: n }), this._intervals.sort((o, s) => o.start.compare(s.start));
  }
  getValue(t) {
    for (const e of this._intervals)
      if (t.compare(e.start) >= 0 && t.compare(e.stop) <= 0)
        return e.value;
  }
  get intervals() {
    return this._intervals;
  }
}
function Cs(i, t) {
  if (i.length <= 2) return i;
  const e = t * t, n = new Uint8Array(i.length);
  n[0] = 1, n[i.length - 1] = 1, Me(i, n, e, 0, i.length - 1);
  const o = [];
  for (let s = 0; s < i.length; s++)
    n[s] && o.push(i[s]);
  return o;
}
function Me(i, t, e, n, o) {
  let s = 0, r = 0;
  const a = i[n][0], c = i[n][1], h = i[o][0], d = i[o][1];
  for (let l = n + 1; l < o; l++) {
    const u = Yo(i[l][0], i[l][1], a, c, h, d);
    u > s && (s = u, r = l);
  }
  s > e && (t[r] = 1, r - n > 1 && Me(i, t, e, n, r), o - r > 1 && Me(i, t, e, r, o));
}
function Yo(i, t, e, n, o, s) {
  let r = o - e, a = s - n;
  if (r !== 0 || a !== 0) {
    const c = Math.max(0, Math.min(1, ((i - e) * r + (t - n) * a) / (r * r + a * a)));
    e += c * r, n += c * a;
  }
  return r = i - e, a = t - n, r * r + a * a;
}
export {
  ss as AnimationManager,
  bs as CallbackProperty,
  es as CallbackRenderer,
  li as CameraController2D,
  ts as ClassBreaksRenderer,
  xs as Clock,
  mi as CommandSystem,
  vs as ConstantProperty,
  $t as ConvexVolume,
  so as DEFAULT_LINE_SYMBOL,
  oo as DEFAULT_POINT_SYMBOL,
  oe as DEFAULT_POLYGON_SYMBOL,
  No as DEPTH_REVERSED_Z,
  ni as DEPTH_STANDARD,
  rs as Diagnostics,
  O as EARTH_RADIUS,
  _i as Easing,
  ct as EventBus,
  Ko as FOG_WGSL_SNIPPET,
  cs as FrustumCuller,
  ci as GameMap,
  $ as GeometryConverter,
  Fo as GlobeInteraction,
  W as GlobeProjection,
  zo as GlobeTileCovering,
  fs as IncrementalWallBuffer,
  bi as InteractionHandler,
  U as JulianDate,
  st as LatLngBounds,
  ui as LayerManager,
  Ee as MAX_LAT,
  ns as MapGpuError,
  ds as MapView,
  xo as MercatorProjection,
  hn as Mode2D,
  un as Mode3D,
  jo as NIGHT_BLEND_WGSL_SNIPPET,
  di as RenderLoop,
  os as ResourceManager,
  Ms as SampledProperty,
  as as SceneGraph,
  ee as SceneNode,
  Qo as SimpleRenderer,
  Mi as TerrainTileManager,
  vi as TileManager,
  fi as TileScheduler,
  ws as TimeIntervalCollectionProperty,
  Ao as ToolManager,
  Jo as UniqueValueRenderer,
  dt as UnitManager,
  ro as VectorBufferCache,
  Dn as VerticalPerspectiveTransform,
  po as ViewCore,
  qo as WATER_SPECULAR_WGSL_SNIPPET,
  ls as WallGeometryBuilder,
  is as WorkerPool,
  gs as aabbInFrustum,
  Wi as createBoxGeometry,
  Oo as createCircleGeometry,
  us as createCorridorGeometry,
  ke as createCylinderGeometry,
  ms as createFrustumGeo,
  Vi as createHemisphereGeometry,
  _s as createRangeRings,
  hs as createSphereGeometry,
  Pn as createWallGeometry,
  Cn as earcut,
  pi as extractFrustumPlanes,
  ys as generateGLB,
  pn as isClusterLayer,
  be as isCustomShaderLayer,
  Ct as isFeatureLayer,
  we as isTerrainLayer,
  mn as isTileLayer,
  B as lonLatToMercator,
  _e as mercatorToLonLat,
  ps as pointInFrustum,
  de as resolveGlobeEffects,
  Uo as rotateLocalOffset,
  Cs as simplify,
  gi as testAABBFrustum,
  yi as testSphereFrustum
};
