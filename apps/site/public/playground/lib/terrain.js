import { LayerBase as st } from "@mapgpu/layers";
const _ = -32767;
function P(s, t) {
  return `${s},${t}`;
}
class ot {
  _local = /* @__PURE__ */ new Map();
  _remote = /* @__PURE__ */ new Map();
  _cachedExtent = null;
  _extentDirty = !0;
  constructor() {
    this._local.set("dt0", /* @__PURE__ */ new Map()), this._local.set("dt1", /* @__PURE__ */ new Map()), this._local.set("dt2", /* @__PURE__ */ new Map()), this._remote.set("dt0", /* @__PURE__ */ new Map()), this._remote.set("dt1", /* @__PURE__ */ new Map()), this._remote.set("dt2", /* @__PURE__ */ new Map());
  }
  addLocal(t) {
    this._local.get(t.level)?.set(P(t.origin[0], t.origin[1]), t), this._stitchWithNeighbors(t.level, t.origin[0], t.origin[1]), this._extentDirty = !0;
  }
  addRemote(t, e) {
    const n = e ?? t.level, i = e ? { ...t, level: n } : t;
    this._remote.get(n)?.set(P(t.origin[0], t.origin[1]), i), this._stitchWithNeighbors(n, t.origin[0], t.origin[1]), this._extentDirty = !0;
  }
  hasTile(t, e, n) {
    const i = P(e, n);
    return (this._local.get(t)?.has(i) ?? !1) || (this._remote.get(t)?.has(i) ?? !1);
  }
  getTile(t, e, n) {
    const i = P(e, n);
    return this._local.get(t)?.get(i) ?? this._remote.get(t)?.get(i) ?? null;
  }
  sampleElevation(t, e, n) {
    const i = Math.floor(dt(t)), h = Math.floor(ut(e));
    for (const a of n) {
      const l = this.getTile(a, i, h);
      if (!l) continue;
      const o = ct(l, t, e);
      if (o !== null) return o;
    }
    return null;
  }
  getFullExtent() {
    if (!this._extentDirty) return this._cachedExtent;
    let t = Number.POSITIVE_INFINITY, e = Number.POSITIVE_INFINITY, n = Number.NEGATIVE_INFINITY, i = Number.NEGATIVE_INFINITY;
    const h = (a) => {
      a.extent.minX < t && (t = a.extent.minX), a.extent.minY < e && (e = a.extent.minY), a.extent.maxX > n && (n = a.extent.maxX), a.extent.maxY > i && (i = a.extent.maxY);
    };
    for (const a of this._local.values())
      for (const l of a.values()) h(l);
    for (const a of this._remote.values())
      for (const l of a.values()) h(l);
    return this._cachedExtent = Number.isFinite(t) ? { minX: t, minY: e, maxX: n, maxY: i } : null, this._extentDirty = !1, this._cachedExtent;
  }
  _stitchWithNeighbors(t, e, n) {
    const i = this.getTile(t, e, n);
    if (!i) return;
    const h = this.getTile(t, e - 1, n);
    h && V(h, i, h.width - 1, 0);
    const a = this.getTile(t, e + 1, n);
    a && V(i, a, i.width - 1, 0);
    const l = this.getTile(t, e, n + 1);
    l && W(l, i, l.height - 1, 0);
    const o = this.getTile(t, e, n - 1);
    o && W(i, o, i.height - 1, 0);
  }
}
function ct(s, t, e) {
  const n = s.extent;
  if (t < n.minX || t > n.maxX || e < n.minY || e > n.maxY) return null;
  const i = (t - n.minX) / (n.maxX - n.minX), h = (e - n.minY) / (n.maxY - n.minY), a = i * (s.width - 1), l = (1 - h) * (s.height - 1), o = Math.floor(a), c = Math.floor(l), r = Math.min(o + 1, s.width - 1), u = Math.min(c + 1, s.height - 1), d = a - o, w = l - c, m = s.elevations[c * s.width + o] ?? _, f = s.elevations[c * s.width + r] ?? _, y = s.elevations[u * s.width + o] ?? _, g = s.elevations[u * s.width + r] ?? _;
  return m === _ || f === _ || y === _ || g === _ ? [m, f, y, g].find((z) => z !== _) ?? null : m * (1 - d) * (1 - w) + f * d * (1 - w) + y * (1 - d) * w + g * d * w;
}
function dt(s) {
  let t = s;
  for (; t < -180; ) t += 360;
  for (; t >= 180; ) t -= 360;
  return t;
}
function ut(s) {
  return Math.max(-89.999999, Math.min(89.999999, s));
}
function V(s, t, e, n) {
  const i = Math.max(s.height, t.height);
  if (!(i <= 0) && !(s.width <= 0 || t.width <= 0))
    for (let h = 0; h < i; h++) {
      const a = i === 1 ? 0 : h / (i - 1), l = Math.round(a * (s.height - 1)), o = Math.round(a * (t.height - 1)), c = l * s.width + e, r = o * t.width + n;
      at(s.elevations, c, t.elevations, r);
    }
}
function W(s, t, e, n) {
  const i = Math.max(s.width, t.width);
  if (!(i <= 0) && !(s.height <= 0 || t.height <= 0))
    for (let h = 0; h < i; h++) {
      const a = i === 1 ? 0 : h / (i - 1), l = Math.round(a * (s.width - 1)), o = Math.round(a * (t.width - 1)), c = e * s.width + l, r = n * t.width + o;
      at(s.elevations, c, t.elevations, r);
    }
}
function at(s, t, e, n) {
  const i = s[t] ?? _, h = e[n] ?? _;
  if (i === _ && h === _) return;
  if (i === _) {
    e[n] = h, s[t] = h;
    return;
  }
  if (h === _) {
    s[t] = i, e[n] = i;
    return;
  }
  const a = Math.round((i + h) * 0.5);
  s[t] = a, e[n] = a;
}
const mt = 0, ht = 80, ft = 648, gt = 2700, _t = ht + ft + gt, wt = 170;
function yt(s) {
  const t = new Uint8Array(s, mt, ht), e = String.fromCharCode(t[0] ?? 0, t[1] ?? 0, t[2] ?? 0);
  if (e !== "UHL")
    throw new Error(`Invalid DTED: expected UHL sentinel, got "${e}"`);
  const n = Dt(t, 4), i = xt(t, 12), h = I(t, 20, 4), a = I(t, 24, 4), l = I(t, 47, 4), o = I(t, 51, 4);
  return {
    originLon: n,
    originLat: i,
    lonInterval: h / 10,
    latInterval: a / 10,
    numLonLines: l,
    numLatPoints: o
  };
}
function Dt(s, t) {
  const e = I(s, t, 3), n = I(s, t + 3, 2), i = I(s, t + 5, 2), h = String.fromCharCode(s[t + 7] ?? 69), a = e + n / 60 + i / 3600;
  return h === "W" ? -a : a;
}
function xt(s, t) {
  const e = I(s, t, 2), n = I(s, t + 2, 2), i = I(s, t + 4, 2), h = String.fromCharCode(s[t + 6] ?? 78), a = e + n / 60 + i / 3600;
  return h === "S" ? -a : a;
}
function I(s, t, e) {
  let n = "";
  for (let i = 0; i < e; i++)
    n += String.fromCharCode(s[t + i] ?? 32);
  return parseInt(n.trim(), 10) || 0;
}
function Mt(s, t) {
  const e = s.toLowerCase();
  return e.endsWith(".dt2") ? "dt2" : e.endsWith(".dt1") ? "dt1" : e.endsWith(".dt0") || t.numLonLines <= 121 ? "dt0" : t.numLonLines <= 1201 ? "dt1" : "dt2";
}
function St(s) {
  const t = s.toLowerCase().replace(/\\/g, "/"), e = t.match(/([ew])(\d{3})[/]([ns])(\d{2})/);
  if (e) {
    let h = parseInt(e[2] ?? "0", 10), a = parseInt(e[4] ?? "0", 10);
    return e[1] === "w" && (h = -h), e[3] === "s" && (a = -a), [h, a];
  }
  const n = t.match(/([ns])(\d{2})([ew])(\d{3})/);
  if (n) {
    let h = parseInt(n[2] ?? "0", 10), a = parseInt(n[4] ?? "0", 10);
    return n[1] === "s" && (h = -h), n[3] === "w" && (a = -a), [a, h];
  }
  const i = t.match(/([ew])(\d{3})([ns])(\d{2})/);
  if (i) {
    let h = parseInt(i[2] ?? "0", 10), a = parseInt(i[4] ?? "0", 10);
    return i[1] === "w" && (h = -h), i[3] === "s" && (a = -a), [h, a];
  }
  return null;
}
function G(s, t = {}) {
  const e = t.fileName ?? "", n = yt(s), i = n.numLonLines, h = n.numLatPoints;
  if (i <= 0 || h <= 0)
    throw new Error("Invalid DTED: zero-sized grid");
  const a = Mt(e, n), l = St(e), o = l?.[0] ?? n.originLon, c = l?.[1] ?? n.originLat, r = 8, u = h * 2, w = r + u + 4, m = new DataView(s), f = new Int16Array(i * h);
  let y = Number.POSITIVE_INFINITY, g = Number.NEGATIVE_INFINITY;
  for (let D = 0; D < i; D++) {
    const x = _t + D * w;
    if (x >= s.byteLength)
      throw new Error(`DTED truncated at column ${D}`);
    const H = m.getUint8(x);
    if (H !== wt)
      throw new Error(
        `Invalid DTED record sentinel at column ${D}: expected 0xAA, got 0x${H.toString(16)}`
      );
    const C = x + r;
    for (let b = 0; b < h; b++) {
      const v = m.getInt16(C + b * 2, !1), $ = D * h + b;
      f[$] = v, v !== _ && (v < y && (y = v), v > g && (g = v));
    }
  }
  Number.isFinite(y) || (y = 0), Number.isFinite(g) || (g = 0);
  const T = new Int16Array(i * h);
  for (let D = 0; D < i; D++)
    for (let x = 0; x < h; x++) {
      const H = D * h + x, b = (h - 1 - x) * i + D;
      T[b] = f[H] ?? _;
    }
  const U = c >= 0 ? "n" : "s", z = o >= 0 ? "e" : "w";
  return {
    id: `${U}${String(Math.abs(c)).padStart(2, "0")}${z}${String(Math.abs(o)).padStart(3, "0")}_${a}`,
    level: a,
    origin: [o, c],
    width: i,
    height: h,
    elevations: T,
    minElevation: y,
    maxElevation: g,
    extent: {
      minX: o,
      minY: c,
      maxX: o + 1,
      maxY: c + 1
    }
  };
}
const X = (s, t, e, n, i, h = 315, a = 45) => {
  const l = new Uint8Array(t * e), o = Math.max(1e-3, n), c = Math.max(1e-3, i), r = (360 - h + 90) * Math.PI / 180, u = a * Math.PI / 180, d = Math.sin(u), w = Math.cos(u);
  for (let m = 0; m < e; m++)
    for (let f = 0; f < t; f++) {
      const y = m * t + f, g = s[y] ?? 0;
      if (g === _) {
        l[y] = 0;
        continue;
      }
      const T = L(s, t, e, f - 1, m - 1, g), U = L(s, t, e, f, m - 1, g), z = L(s, t, e, f + 1, m - 1, g), O = L(s, t, e, f - 1, m, g), D = L(s, t, e, f + 1, m, g), x = L(s, t, e, f - 1, m + 1, g), H = L(s, t, e, f, m + 1, g), C = L(s, t, e, f + 1, m + 1, g), b = (z + 2 * D + C - (T + 2 * O + x)) / (8 * o), v = (x + 2 * H + C - (T + 2 * U + z)) / (8 * c), $ = Math.atan(Math.sqrt(b * b + v * v)), rt = Math.atan2(v, -b);
      let B = d * Math.cos($) + w * Math.sin($) * Math.cos(r - rt);
      B = Math.max(0, Math.min(1, B)), l[y] = Math.round(B * 255);
    }
  return l;
};
function L(s, t, e, n, i, h) {
  const a = Math.max(0, Math.min(t - 1, n)), l = Math.max(0, Math.min(e - 1, i)), o = s[l * t + a] ?? h;
  return o === _ ? h : o;
}
function lt(s, t) {
  const e = (s.north + s.south) * 0.5, n = Math.max(1e-9, s.east - s.west), i = Math.max(1e-9, s.north - s.south), h = 111320, a = Math.cos(e * Math.PI / 180) * 111320, l = Math.max(1, t - 1);
  return {
    cellSizeX: Math.max(1e-3, n * a / l),
    cellSizeY: Math.max(1e-3, i * h / l)
  };
}
const J = ["dt2", "dt1", "dt0"], F = {
  enabled: !0,
  opacity: 0.45,
  azimuth: 315,
  altitude: 45,
  softness: 0.25
}, A = {
  enabled: !0,
  sunAzimuth: 315,
  sunAltitude: 45,
  ambient: 0.35,
  diffuse: 0.85,
  shadowStrength: 0.35,
  shadowSoftness: 0.4
}, bt = 64;
function R(s, t, e) {
  return `${s}/${t}/${e}`;
}
function vt(s, t, e) {
  return `${s}/${t}/${e}`;
}
class kt extends st {
  type = "terrain";
  mode;
  levels;
  exaggeration;
  minZoom;
  maxZoom;
  _store = new ot();
  _tileSize;
  _maxReadyTiles;
  _urlForCell;
  _localFiles;
  _hillshade2D;
  _lighting3D;
  _readyHeight = /* @__PURE__ */ new Map();
  _readyHillshade = /* @__PURE__ */ new Map();
  _requestInFlight = /* @__PURE__ */ new Map();
  _remoteCellInFlight = /* @__PURE__ */ new Map();
  _hillshadeFn;
  _wasmInitPromise = null;
  _refreshTimer = null;
  constructor(t = {}) {
    super({
      id: t.id,
      visible: t.visible,
      opacity: t.hillshade2D?.opacity ?? t.opacity ?? F.opacity,
      minScale: t.minScale,
      maxScale: t.maxScale
    }), this.mode = t.mode ?? "hybrid", this.levels = It(t.levels), this.exaggeration = t.exaggeration ?? 1, this.minZoom = t.minZoom ?? 0, this.maxZoom = t.maxZoom ?? 14, this._tileSize = t.tileSize ?? 512, this._maxReadyTiles = t.maxReadyTiles ?? 64, this._urlForCell = t.urlForCell, this._localFiles = [...t.localFiles ?? []], this._hillshade2D = {
      enabled: t.hillshade2D?.enabled ?? F.enabled,
      opacity: t.hillshade2D?.opacity ?? t.opacity ?? F.opacity,
      azimuth: t.hillshade2D?.azimuth ?? F.azimuth,
      altitude: t.hillshade2D?.altitude ?? F.altitude,
      softness: M(t.hillshade2D?.softness ?? F.softness ?? 0.25)
    }, this._lighting3D = {
      enabled: t.lighting3D?.enabled ?? A.enabled,
      sunAzimuth: Q(t.lighting3D?.sunAzimuth ?? A.sunAzimuth),
      sunAltitude: k(t.lighting3D?.sunAltitude ?? A.sunAltitude, 0, 89.9),
      ambient: M(t.lighting3D?.ambient ?? A.ambient),
      diffuse: k(t.lighting3D?.diffuse ?? A.diffuse, 0, 2),
      shadowStrength: M(t.lighting3D?.shadowStrength ?? A.shadowStrength),
      shadowSoftness: M(t.lighting3D?.shadowSoftness ?? A.shadowSoftness)
    }, this._hillshadeFn = t.wasmHillshade ?? X;
  }
  async addLocalFile(t) {
    const e = await q(t);
    this._store.addLocal(e), this._updateFullExtentFromStore(), this._emitDebug("cell-added", {
      level: e.level,
      origin: e.origin,
      extent: e.extent,
      min: e.minElevation,
      max: e.maxElevation,
      size: `${e.width}x${e.height}`
    }), this.loaded && this._scheduleRefresh();
  }
  async addLocalFiles(t) {
    await Promise.all(t.map(async (e) => {
      const n = await q(e);
      this._store.addLocal(n), this._emitDebug("cell-added", {
        level: n.level,
        origin: n.origin,
        extent: n.extent,
        min: n.minElevation,
        max: n.maxElevation,
        size: `${n.width}x${n.height}`
      });
    })), this._updateFullExtentFromStore(), this.loaded && this.refresh();
  }
  async onLoad() {
    this._hillshade2D.enabled && this._hillshadeFn === X && await this._tryInitWasmHillshade();
    for (const t of this._localFiles) {
      const e = await q(t);
      this._store.addLocal(e);
    }
    this._updateFullExtentFromStore();
  }
  refresh() {
    this._readyHeight.clear(), this._readyHillshade.clear(), super.refresh();
  }
  _scheduleRefresh() {
    this._refreshTimer !== null && clearTimeout(this._refreshTimer), this._refreshTimer = setTimeout(() => {
      this._refreshTimer = null, this.refresh();
    }, 150);
  }
  destroy() {
    this._refreshTimer !== null && (clearTimeout(this._refreshTimer), this._refreshTimer = null), this._readyHeight.clear(), this._readyHillshade.clear(), this._requestInFlight.clear(), this._remoteCellInFlight.clear(), super.destroy();
  }
  /** Return diagnostic info about the tile store and ready caches. */
  getStoreInfo() {
    const t = [], e = this._store.getFullExtent();
    for (const n of this.levels) {
      const i = this._store._local?.get(n), h = this._store._remote?.get(n);
      for (const a of i?.values() ?? [])
        t.push({ level: a.level, origin: a.origin, extent: a.extent });
      for (const a of h?.values() ?? [])
        t.push({ level: a.level, origin: a.origin, extent: a.extent });
    }
    return {
      cells: t,
      readyHeightCount: this._readyHeight.size,
      readyHillshadeCount: this._readyHillshade.size,
      fullExtent: e
    };
  }
  _emitDebug(t, e) {
    this.eventBus.emit("debug", { type: t, ...e });
  }
  async requestTile(t, e, n) {
    if (t < this.minZoom || t > this.maxZoom) return;
    const i = this._store.getFullExtent();
    if (i) {
      const o = K(t, e, n);
      if (o.east <= i.minX || o.west >= i.maxX || o.north <= i.minY || o.south >= i.maxY)
        return;
    }
    const h = R(t, e, n);
    if (this._readyHeight.has(h)) return;
    const a = this._requestInFlight.get(h);
    if (a) {
      await a;
      return;
    }
    const l = this._buildReadyTile(t, e, n).catch(() => {
    }).finally(() => {
      this._requestInFlight.delete(h);
    });
    this._requestInFlight.set(h, l), await l;
  }
  get hillshade2D() {
    return { ...this._hillshade2D };
  }
  get lighting3D() {
    return { ...this._lighting3D };
  }
  setHillshade2D(t) {
    const e = {
      ...this._hillshade2D,
      enabled: t.enabled ?? this._hillshade2D.enabled,
      opacity: t.opacity !== void 0 ? M(t.opacity) : this._hillshade2D.opacity,
      azimuth: tt(t.azimuth) ? t.azimuth : this._hillshade2D.azimuth,
      altitude: tt(t.altitude) ? t.altitude : this._hillshade2D.altitude,
      softness: t.softness !== void 0 ? M(t.softness) : M(this._hillshade2D.softness ?? F.softness ?? 0.25)
    };
    (e.enabled !== this._hillshade2D.enabled || e.opacity !== this._hillshade2D.opacity || e.azimuth !== this._hillshade2D.azimuth || e.altitude !== this._hillshade2D.altitude || (e.softness ?? 0) !== (this._hillshade2D.softness ?? 0)) && (this._hillshade2D = e, this.opacity = e.opacity, this.refresh());
  }
  setLighting3D(t) {
    const e = {
      enabled: t.enabled ?? this._lighting3D.enabled,
      sunAzimuth: t.sunAzimuth !== void 0 ? Q(t.sunAzimuth) : this._lighting3D.sunAzimuth,
      sunAltitude: t.sunAltitude !== void 0 ? k(t.sunAltitude, 0, 89.9) : this._lighting3D.sunAltitude,
      ambient: t.ambient !== void 0 ? M(t.ambient) : this._lighting3D.ambient,
      diffuse: t.diffuse !== void 0 ? k(t.diffuse, 0, 2) : this._lighting3D.diffuse,
      shadowStrength: t.shadowStrength !== void 0 ? M(t.shadowStrength) : this._lighting3D.shadowStrength,
      shadowSoftness: t.shadowSoftness !== void 0 ? M(t.shadowSoftness) : this._lighting3D.shadowSoftness
    };
    (e.enabled !== this._lighting3D.enabled || e.sunAzimuth !== this._lighting3D.sunAzimuth || e.sunAltitude !== this._lighting3D.sunAltitude || e.ambient !== this._lighting3D.ambient || e.diffuse !== this._lighting3D.diffuse || e.shadowStrength !== this._lighting3D.shadowStrength || e.shadowSoftness !== this._lighting3D.shadowSoftness) && (this._lighting3D = e, this.redraw());
  }
  getReadyHeightTile(t, e, n) {
    const i = this._readyHeight.get(R(t, e, n));
    return i ? (i.lastUsed = Date.now(), i) : null;
  }
  getReadyHillshadeTile(t, e, n) {
    if (!this._hillshade2D.enabled) return null;
    const i = this._readyHillshade.get(R(t, e, n));
    return i ? (i.lastUsed = Date.now(), i) : null;
  }
  sampleElevation(t, e) {
    return this._store.sampleElevation(t, e, this.levels);
  }
  async _buildReadyTile(t, e, n) {
    const i = K(t, e, n);
    await this._ensureRemoteCoverage(i);
    const h = this._tileSize, a = this._tileSize, l = this._sampleHeightGrid(i, h, a), o = l.data;
    if (this._readyHeight.set(R(t, e, n), {
      z: t,
      x: e,
      y: n,
      width: h,
      height: a,
      data: o,
      lastUsed: Date.now()
    }), this._evictReadyTiles(this._readyHeight), !this._hillshade2D.enabled) return;
    if (l.validCount === 0) {
      this._readyHillshade.delete(R(t, e, n)), this._emitDebug("terrain-tile-empty", { z: t, x: e, y: n, bounds: i, totalPixels: h * a });
      return;
    }
    this._emitDebug("terrain-tile-built", { z: t, x: e, y: n, validCount: l.validCount, totalPixels: h * a });
    const c = Tt(o), r = lt(i, h), u = this._hillshadeFn(
      c,
      h,
      a,
      r.cellSizeX,
      r.cellSizeY,
      this._hillshade2D.azimuth,
      this._hillshade2D.altitude
    ), d = Et(
      u,
      l.mask,
      this._hillshade2D.altitude,
      this._hillshade2D.softness ?? F.softness ?? 0.25
    );
    this._readyHillshade.set(R(t, e, n), {
      z: t,
      x: e,
      y: n,
      width: h,
      height: a,
      data: d,
      lastUsed: Date.now()
    }), this._evictReadyTiles(this._readyHillshade);
  }
  _sampleHeightGrid(t, e, n) {
    const i = new Float32Array(e * n), h = new Uint8Array(e * n);
    let a = 0;
    const l = t.east - t.west, o = t.north - t.south, c = Math.max(1, e - 1), r = Math.max(1, n - 1);
    for (let u = 0; u < n; u++) {
      const d = u / r, w = t.north - d * o;
      for (let m = 0; m < e; m++) {
        const f = m / c, y = Ft(t.west + f * l), g = u * e + m, T = this._store.sampleElevation(y, w, this.levels);
        T === null ? (i[g] = 0, h[g] = 0) : (i[g] = T, h[g] = 255, a += 1);
      }
    }
    return { data: i, mask: h, validCount: a };
  }
  async _ensureRemoteCoverage(t) {
    if ((this.mode === "remote" || this.mode === "hybrid") && typeof this._urlForCell == "function")
      for (const n of this.levels) {
        const i = Lt(t, bt), h = [];
        for (const a of i)
          this._store.hasTile(n, a.lon, a.lat) || h.push(this._ensureRemoteCell(n, a.lon, a.lat));
        h.length > 0 && await Promise.all(h);
      }
  }
  async _ensureRemoteCell(t, e, n) {
    const i = vt(t, e, n), h = this._remoteCellInFlight.get(i);
    if (h) {
      await h;
      return;
    }
    const a = Promise.resolve().then(async () => {
      const l = this._urlForCell?.({ lon: e, lat: n, level: t });
      if (!l) return;
      const o = await fetch(l);
      if (!o.ok) return;
      const c = await o.arrayBuffer(), r = G(c, { fileName: `${l}.${t}` });
      this._store.addRemote(r, t), this._updateFullExtentFromStore();
    }).catch(() => {
    }).finally(() => {
      this._remoteCellInFlight.delete(i);
    });
    this._remoteCellInFlight.set(i, a), await a;
  }
  _evictReadyTiles(t) {
    if (t.size <= this._maxReadyTiles) return;
    const e = [...t.entries()].sort((i, h) => i[1].lastUsed - h[1].lastUsed), n = t.size - this._maxReadyTiles;
    for (let i = 0; i < n; i++) {
      const h = e[i];
      if (!h) break;
      t.delete(h[0]);
    }
  }
  _updateFullExtentFromStore() {
    const t = this._store.getFullExtent();
    t && (this._fullExtent = {
      minX: t.minX,
      minY: t.minY,
      maxX: t.maxX,
      maxY: t.maxY,
      spatialReference: "EPSG:4326"
    });
  }
  async _tryInitWasmHillshade() {
    if (this._wasmInitPromise) {
      await this._wasmInitPromise;
      return;
    }
    this._wasmInitPromise = Promise.resolve().then(async () => {
      try {
        const e = await import("@mapgpu/wasm-core");
        typeof e.default == "function" && await e.default(), typeof e.compute_hillshade == "function" && (this._hillshadeFn = e.compute_hillshade);
      } catch {
      }
    }), await this._wasmInitPromise;
  }
}
function It(s) {
  const t = s && s.length > 0 ? s : J, e = /* @__PURE__ */ new Set();
  for (const n of t)
    (n === "dt0" || n === "dt1" || n === "dt2") && e.add(n);
  return e.size === 0 ? [...J] : [...e];
}
async function q(s) {
  if ("buffer" in s)
    return G(s.buffer, { fileName: s.name });
  const t = await s.arrayBuffer();
  return G(t, { fileName: s.name });
}
function Tt(s) {
  const t = new Int16Array(s.length);
  for (let e = 0; e < s.length; e++) {
    const n = s[e] ?? 0;
    t[e] = Number.isFinite(n) ? Math.round(n) : 0;
  }
  return t;
}
function K(s, t, e) {
  const n = Math.pow(2, s), i = t / n * 360 - 180, h = (t + 1) / n * 360 - 180, a = j(e, n), l = j(e + 1, n);
  return { west: i, east: h, north: a, south: l };
}
function j(s, t) {
  return Math.atan(Math.sinh(Math.PI - 2 * Math.PI * s / t)) * 180 / Math.PI;
}
function Lt(s, t) {
  const e = Math.floor(Math.min(s.west, s.east)), n = Math.ceil(Math.max(s.west, s.east)) - 1, i = Math.floor(Math.min(s.south, s.north)), h = Math.ceil(Math.max(s.south, s.north)) - 1, a = (s.west + s.east) * 0.5, l = (s.north + s.south) * 0.5, o = [];
  for (let c = i; c <= h; c++)
    if (!(c < -90 || c > 89))
      for (let r = e; r <= n; r++) {
        if (r < -180 || r > 179) continue;
        const u = r + 0.5 - a, d = c + 0.5 - l;
        o.push({ lon: r, lat: c, dist: u * u + d * d });
      }
  return o.length <= t ? o.map(({ lon: c, lat: r }) => ({ lon: c, lat: r })) : (o.sort((c, r) => c.dist - r.dist), o.slice(0, t).map(({ lon: c, lat: r }) => ({ lon: c, lat: r })));
}
function Ft(s) {
  let t = s;
  for (; t < -180; ) t += 360;
  for (; t >= 180; ) t -= 360;
  return t;
}
function Et(s, t, e, n) {
  const i = new Uint8Array(s.length * 4), h = e * Math.PI / 180, a = Math.round(Math.max(0, Math.min(255, Math.sin(h) * 255))), l = Math.max(1, a, 255 - a), o = Math.round(M(n) * 16);
  for (let c = 0; c < s.length; c++) {
    const r = c * 4, u = t[c] ?? 0;
    if (u <= 0) {
      i[r] = 0, i[r + 1] = 0, i[r + 2] = 0, i[r + 3] = 0;
      continue;
    }
    const d = s[c] ?? 0, w = Math.abs(d - a);
    if (w <= o) {
      i[r] = 0, i[r + 1] = 0, i[r + 2] = 0, i[r + 3] = 0;
      continue;
    }
    const m = Math.min(1, (w - o) / Math.max(1, l - o)), f = Math.round(u * Math.sqrt(m));
    if (f <= 0) {
      i[r] = 0, i[r + 1] = 0, i[r + 2] = 0, i[r + 3] = 0;
      continue;
    }
    i[r] = d, i[r + 1] = d, i[r + 2] = d, i[r + 3] = f;
  }
  return i;
}
function M(s) {
  return Math.max(0, Math.min(1, s));
}
function k(s, t, e) {
  return Math.max(t, Math.min(e, s));
}
function Q(s) {
  const t = s % 360;
  return t < 0 ? t + 360 : t;
}
function tt(s) {
  return typeof s == "number" && Number.isFinite(s);
}
const E = {
  enabled: !0,
  opacity: 0.45,
  azimuth: 315,
  altitude: 45,
  softness: 0.25
}, p = {
  enabled: !0,
  sunAzimuth: 315,
  sunAltitude: 45,
  ambient: 0.35,
  diffuse: 0.85,
  shadowStrength: 0.35,
  shadowSoftness: 0.4
};
function Y(s, t, e) {
  return `${s}/${t}/${e}`;
}
class Yt extends st {
  type = "terrain";
  exaggeration;
  get minZoom() {
    return this._minZoom;
  }
  get maxZoom() {
    return this._maxZoom;
  }
  _minZoom;
  _maxZoom;
  _minZoomLocked;
  _maxZoomLocked;
  _encodingLocked;
  _tileJsonUrl;
  _fetchInit;
  _maxReadyTiles;
  _hillshade2D;
  _lighting3D;
  _pixelFetcher;
  _tileUrls;
  _encoding;
  _bounds = null;
  _readyHeight = /* @__PURE__ */ new Map();
  _readyHillshade = /* @__PURE__ */ new Map();
  _requestInFlight = /* @__PURE__ */ new Map();
  _hillshadeFn;
  _wasmInitPromise = null;
  constructor(t = {}) {
    if (super({
      id: t.id,
      visible: t.visible,
      opacity: t.hillshade2D?.opacity ?? t.opacity ?? E.opacity,
      minScale: t.minScale,
      maxScale: t.maxScale
    }), this.exaggeration = t.exaggeration ?? 1, this._minZoom = t.minZoom ?? 0, this._maxZoom = t.maxZoom ?? 14, this._minZoomLocked = t.minZoom !== void 0, this._maxZoomLocked = t.maxZoom !== void 0, this._encoding = t.encoding ?? "terrain-rgb", this._encodingLocked = t.encoding !== void 0, this._tileJsonUrl = t.tileJsonUrl ?? null, this._tileUrls = [...t.tileUrls ?? []], this._fetchInit = t.fetchInit, this._maxReadyTiles = t.maxReadyTiles ?? 64, this._hillshade2D = {
      enabled: t.hillshade2D?.enabled ?? E.enabled,
      opacity: t.hillshade2D?.opacity ?? t.opacity ?? E.opacity,
      azimuth: t.hillshade2D?.azimuth ?? E.azimuth,
      altitude: t.hillshade2D?.altitude ?? E.altitude,
      softness: S(t.hillshade2D?.softness ?? E.softness ?? 0.25)
    }, this._lighting3D = {
      enabled: t.lighting3D?.enabled ?? p.enabled,
      sunAzimuth: nt(t.lighting3D?.sunAzimuth ?? p.sunAzimuth),
      sunAltitude: Z(t.lighting3D?.sunAltitude ?? p.sunAltitude, 0, 89.9),
      ambient: S(t.lighting3D?.ambient ?? p.ambient),
      diffuse: Z(t.lighting3D?.diffuse ?? p.diffuse, 0, 2),
      shadowStrength: S(t.lighting3D?.shadowStrength ?? p.shadowStrength),
      shadowSoftness: S(t.lighting3D?.shadowSoftness ?? p.shadowSoftness)
    }, this._hillshadeFn = t.wasmHillshade ?? X, this._pixelFetcher = t.pixelFetcher ?? ((e) => Nt(e, this._fetchInit)), t.tileJson && this._applyTileJson(t.tileJson), !this._tileJsonUrl && this._tileUrls.length === 0)
      throw new Error("TerrainRGBLayer requires tileJsonUrl, tileJson, or tileUrls.");
  }
  async onLoad() {
    if (this._hillshade2D.enabled && this._hillshadeFn === X && await this._tryInitWasmHillshade(), this._tileUrls.length === 0 && this._tileJsonUrl) {
      const t = await this._fetchTileJson(this._tileJsonUrl);
      this._applyTileJson(t);
    }
    if (this._tileUrls.length === 0)
      throw new Error("TerrainRGBLayer has no tile templates after TileJSON load.");
    this._validateTileTemplates();
  }
  refresh() {
    this._readyHeight.clear(), this._readyHillshade.clear(), super.refresh();
  }
  destroy() {
    this._readyHeight.clear(), this._readyHillshade.clear(), this._requestInFlight.clear(), super.destroy();
  }
  async requestTile(t, e, n) {
    if (t < this._minZoom || t > this._maxZoom || !this._intersectsLayerBounds(t, e, n)) return;
    const i = Y(t, e, n);
    if (this._readyHeight.has(i)) return;
    const h = this._requestInFlight.get(i);
    if (h) {
      await h;
      return;
    }
    const a = this._buildReadyTile(t, e, n).catch(() => {
    }).finally(() => {
      this._requestInFlight.delete(i);
    });
    this._requestInFlight.set(i, a), await a;
  }
  get hillshade2D() {
    return { ...this._hillshade2D };
  }
  get lighting3D() {
    return { ...this._lighting3D };
  }
  setHillshade2D(t) {
    const e = {
      ...this._hillshade2D,
      enabled: t.enabled ?? this._hillshade2D.enabled,
      opacity: t.opacity !== void 0 ? S(t.opacity) : this._hillshade2D.opacity,
      azimuth: N(t.azimuth) ? t.azimuth : this._hillshade2D.azimuth,
      altitude: N(t.altitude) ? t.altitude : this._hillshade2D.altitude,
      softness: t.softness !== void 0 ? S(t.softness) : S(this._hillshade2D.softness ?? E.softness ?? 0.25)
    };
    (e.enabled !== this._hillshade2D.enabled || e.opacity !== this._hillshade2D.opacity || e.azimuth !== this._hillshade2D.azimuth || e.altitude !== this._hillshade2D.altitude || (e.softness ?? 0) !== (this._hillshade2D.softness ?? 0)) && (this._hillshade2D = e, this.opacity = e.opacity, this.refresh());
  }
  setLighting3D(t) {
    const e = {
      enabled: t.enabled ?? this._lighting3D.enabled,
      sunAzimuth: t.sunAzimuth !== void 0 ? nt(t.sunAzimuth) : this._lighting3D.sunAzimuth,
      sunAltitude: t.sunAltitude !== void 0 ? Z(t.sunAltitude, 0, 89.9) : this._lighting3D.sunAltitude,
      ambient: t.ambient !== void 0 ? S(t.ambient) : this._lighting3D.ambient,
      diffuse: t.diffuse !== void 0 ? Z(t.diffuse, 0, 2) : this._lighting3D.diffuse,
      shadowStrength: t.shadowStrength !== void 0 ? S(t.shadowStrength) : this._lighting3D.shadowStrength,
      shadowSoftness: t.shadowSoftness !== void 0 ? S(t.shadowSoftness) : this._lighting3D.shadowSoftness
    };
    (e.enabled !== this._lighting3D.enabled || e.sunAzimuth !== this._lighting3D.sunAzimuth || e.sunAltitude !== this._lighting3D.sunAltitude || e.ambient !== this._lighting3D.ambient || e.diffuse !== this._lighting3D.diffuse || e.shadowStrength !== this._lighting3D.shadowStrength || e.shadowSoftness !== this._lighting3D.shadowSoftness) && (this._lighting3D = e, this.redraw());
  }
  getReadyHeightTile(t, e, n) {
    const i = this._readyHeight.get(Y(t, e, n));
    return i ? (i.lastUsed = Date.now(), i) : null;
  }
  getReadyHillshadeTile(t, e, n) {
    if (!this._hillshade2D.enabled) return null;
    const i = this._readyHillshade.get(Y(t, e, n));
    return i ? (i.lastUsed = Date.now(), i) : null;
  }
  async _buildReadyTile(t, e, n) {
    const i = Y(t, e, n), h = this._tileUrls[Math.abs((t * 31 + e * 17 + n) % this._tileUrls.length)];
    if (!h) return;
    const a = At(h, t, e, n), l = await this._pixelFetcher(a);
    if (l.width <= 0 || l.height <= 0) return;
    const o = this._decodeHeightPixels(l);
    if (o.validCount === 0) {
      this._readyHeight.delete(i), this._readyHillshade.delete(i);
      return;
    }
    if (this._readyHeight.set(i, {
      z: t,
      x: e,
      y: n,
      width: l.width,
      height: l.height,
      data: o.heights,
      lastUsed: Date.now()
    }), this._evictReadyTiles(this._readyHeight), !this._hillshade2D.enabled) return;
    const c = et(t, e, n), r = Ut(o.heights), u = lt(c, l.width), d = this._hillshadeFn(
      r,
      l.width,
      l.height,
      u.cellSizeX,
      u.cellSizeY,
      this._hillshade2D.azimuth,
      this._hillshade2D.altitude
    ), w = $t(
      d,
      o.mask,
      this._hillshade2D.altitude,
      this._hillshade2D.softness ?? E.softness ?? 0.25
    );
    this._readyHillshade.set(i, {
      z: t,
      x: e,
      y: n,
      width: l.width,
      height: l.height,
      data: w,
      lastUsed: Date.now()
    }), this._evictReadyTiles(this._readyHillshade);
  }
  _decodeHeightPixels(t) {
    const e = t.width * t.height, n = new Float32Array(e), i = new Uint8Array(e);
    let h = 0;
    for (let a = 0; a < e; a++) {
      const l = a * 4, o = t.data[l] ?? 0, c = t.data[l + 1] ?? 0, r = t.data[l + 2] ?? 0;
      if ((t.data[l + 3] ?? 255) === 0) {
        n[a] = 0, i[a] = 0;
        continue;
      }
      if (o === 0 && c === 0 && r === 0) {
        n[a] = 0, i[a] = 0;
        continue;
      }
      const d = this._encoding === "terrarium" ? Ht(o, c, r) : zt(o, c, r);
      if (!Number.isFinite(d)) {
        n[a] = 0, i[a] = 0;
        continue;
      }
      n[a] = d, i[a] = 255, h += 1;
    }
    return { heights: n, mask: i, validCount: h };
  }
  async _fetchTileJson(t) {
    const e = await fetch(t, {
      mode: "cors",
      ...this._fetchInit ?? {}
    });
    if (!e.ok)
      throw new Error(`Terrain TileJSON fetch failed: ${e.status} ${t}`);
    return await e.json();
  }
  _applyTileJson(t) {
    if (Array.isArray(t.tiles) && t.tiles.length > 0 && (this._tileUrls = t.tiles.filter((e) => typeof e == "string" && e.length > 0)), !this._minZoomLocked && N(t.minzoom) && (this._minZoom = t.minzoom), !this._maxZoomLocked && N(t.maxzoom) && (this._maxZoom = t.maxzoom), !this._encodingLocked && t.encoding) {
      const e = Rt(t.encoding);
      e && (this._encoding = e);
    }
    Ct(t.bounds) && (this._bounds = t.bounds, this._fullExtent = {
      minX: t.bounds[0],
      minY: t.bounds[1],
      maxX: t.bounds[2],
      maxY: t.bounds[3],
      spatialReference: "EPSG:4326"
    });
  }
  _validateTileTemplates() {
    for (const t of this._tileUrls) {
      if (!t.includes("{z}") || !t.includes("{x}"))
        throw new Error("TerrainRGBLayer tile template must include {z} and {x} placeholders.");
      if (!t.includes("{y}") && !t.includes("{-y}"))
        throw new Error("TerrainRGBLayer tile template must include {y} or {-y} placeholder.");
    }
  }
  _intersectsLayerBounds(t, e, n) {
    if (!this._bounds) return !0;
    const i = et(t, e, n);
    return pt(i, this._bounds);
  }
  _evictReadyTiles(t) {
    if (t.size <= this._maxReadyTiles) return;
    const e = [...t.entries()].sort((i, h) => i[1].lastUsed - h[1].lastUsed), n = t.size - this._maxReadyTiles;
    for (let i = 0; i < n; i++) {
      const h = e[i];
      if (!h) break;
      t.delete(h[0]);
    }
  }
  async _tryInitWasmHillshade() {
    if (this._wasmInitPromise) {
      await this._wasmInitPromise;
      return;
    }
    this._wasmInitPromise = Promise.resolve().then(async () => {
      try {
        const e = await import("@mapgpu/wasm-core");
        typeof e.default == "function" && await e.default(), typeof e.compute_hillshade == "function" && (this._hillshadeFn = e.compute_hillshade);
      } catch {
      }
    }), await this._wasmInitPromise;
  }
}
function At(s, t, e, n) {
  const i = (1 << t) - 1 - n;
  return s.replaceAll("{z}", String(t)).replaceAll("{x}", String(e)).replaceAll("{-y}", String(i)).replaceAll("{y}", String(n));
}
function et(s, t, e) {
  const n = Math.pow(2, s), i = t / n * 360 - 180, h = (t + 1) / n * 360 - 180, a = it(e, n), l = it(e + 1, n);
  return { west: i, east: h, north: a, south: l };
}
function it(s, t) {
  return Math.atan(Math.sinh(Math.PI - 2 * Math.PI * s / t)) * 180 / Math.PI;
}
function pt(s, t) {
  const [e, n, i, h] = t;
  return e > i ? !0 : !(s.east <= e || s.west >= i || s.north <= n || s.south >= h);
}
function zt(s, t, e) {
  return -1e4 + (s * 256 * 256 + t * 256 + e) * 0.1;
}
function Ht(s, t, e) {
  return s * 256 + t + e / 256 - 32768;
}
function Rt(s) {
  const t = s.toLowerCase();
  return t === "terrain-rgb" || t === "terrainrgb" || t === "mapbox" ? "terrain-rgb" : t === "terrarium" ? "terrarium" : null;
}
function N(s) {
  return typeof s == "number" && Number.isFinite(s);
}
function Ct(s) {
  if (!Array.isArray(s) || s.length !== 4) return !1;
  const [t, e, n, i] = s;
  return [t, e, n, i].every(N) && e < i && t !== n;
}
async function Nt(s, t) {
  const e = await fetch(s, {
    mode: "cors",
    ...t ?? {}
  });
  if (!e.ok)
    throw new Error(`Terrain tile fetch failed: ${e.status} ${s}`);
  const n = await e.blob(), i = await createImageBitmap(n);
  try {
    if (typeof OffscreenCanvas < "u") {
      const a = new OffscreenCanvas(i.width, i.height).getContext("2d", { willReadFrequently: !0 });
      if (!a) throw new Error("Failed to create 2D context for terrain decode.");
      a.drawImage(i, 0, 0);
      const l = a.getImageData(0, 0, i.width, i.height);
      return { width: i.width, height: i.height, data: l.data };
    }
    if (typeof document < "u") {
      const h = document.createElement("canvas");
      h.width = i.width, h.height = i.height;
      const a = h.getContext("2d", { willReadFrequently: !0 });
      if (!a) throw new Error("Failed to create 2D context for terrain decode.");
      a.drawImage(i, 0, 0);
      const l = a.getImageData(0, 0, i.width, i.height);
      return { width: i.width, height: i.height, data: l.data };
    }
    throw new Error("No canvas implementation available for terrain tile decode.");
  } finally {
    typeof i.close == "function" && i.close();
  }
}
function Ut(s) {
  const t = new Int16Array(s.length);
  for (let e = 0; e < s.length; e++) {
    const n = s[e] ?? 0;
    t[e] = Number.isFinite(n) ? Math.round(n) : 0;
  }
  return t;
}
function $t(s, t, e, n) {
  const i = new Uint8Array(s.length * 4), h = e * Math.PI / 180, a = Math.round(Math.max(0, Math.min(255, Math.sin(h) * 255))), l = Math.max(1, a, 255 - a), o = Math.round(S(n) * 16);
  for (let c = 0; c < s.length; c++) {
    const r = c * 4, u = t[c] ?? 0;
    if (u <= 0) {
      i[r] = 0, i[r + 1] = 0, i[r + 2] = 0, i[r + 3] = 0;
      continue;
    }
    const d = s[c] ?? 0, w = Math.abs(d - a);
    if (w <= o) {
      i[r] = 0, i[r + 1] = 0, i[r + 2] = 0, i[r + 3] = 0;
      continue;
    }
    const m = Math.min(1, (w - o) / Math.max(1, l - o)), f = Math.round(u * Math.sqrt(m));
    if (f <= 0) {
      i[r] = 0, i[r + 1] = 0, i[r + 2] = 0, i[r + 3] = 0;
      continue;
    }
    i[r] = d, i[r + 1] = d, i[r + 2] = d, i[r + 3] = f;
  }
  return i;
}
function S(s) {
  return Math.max(0, Math.min(1, s));
}
function Z(s, t, e) {
  return Math.max(t, Math.min(e, s));
}
function nt(s) {
  const t = s % 360;
  return t < 0 ? t + 360 : t;
}
export {
  kt as DTEDLayer,
  ot as DTEDTileStore,
  Yt as TerrainRGBLayer,
  X as computeHillshadeTS,
  Mt as detectDTEDLevel,
  lt as estimateCellSizeMeters,
  St as extractCoordsFromFilename,
  G as parseDTED
};
