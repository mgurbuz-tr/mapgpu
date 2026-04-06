import { MapGpuError as _ } from "@mapgpu/core";
const D = 512, k = 8192;
function w(a) {
  return Number.isFinite(a) && a >= -180 && a <= 180;
}
function A(a) {
  return Number.isFinite(a) && a >= -90 && a <= 90;
}
class C {
  wasm;
  _elevationProvider = null;
  constructor(t, n) {
    this.wasm = t, n && (this._elevationProvider = n);
  }
  /** Set or replace the elevation provider at runtime. */
  setElevationProvider(t) {
    this._elevationProvider = t;
  }
  async runLos(t) {
    const { observer: n, target: e } = t, s = t.observerOffset ?? 0, o = t.targetOffset ?? 0, i = t.sampleCount ?? D;
    if (!w(n[0]) || !A(n[1]))
      throw new _({ kind: "los-out-of-bounds" });
    if (!w(e[0]) || !A(e[1]))
      throw new _({ kind: "los-out-of-bounds" });
    if (i < 2 || i > k)
      throw new _({ kind: "los-out-of-bounds" });
    const r = new Float64Array([
      n[0],
      n[1],
      n[2] ?? 0
    ]), c = new Float64Array([
      e[0],
      e[1],
      e[2] ?? 0
    ]), l = this.wasm.generateLosSegments(r, c, i), f = l.length / 3;
    let M;
    if (this._elevationProvider) {
      const u = new Float64Array(f * 2);
      for (let g = 0; g < f; g++)
        u[g * 2] = l[g * 3], u[g * 2 + 1] = l[g * 3 + 1];
      const y = this._elevationProvider.sampleElevationBatch(u);
      M = new Float64Array(f);
      for (let g = 0; g < f; g++)
        M[g] = Number.isNaN(y[g]) ? 0 : y[g];
    } else
      M = new Float64Array(f);
    const h = this.wasm.computeLos(l, M, s, o);
    let m, d = null;
    if (h.visible)
      m = new Float64Array(l);
    else {
      const u = h.blockingPoint;
      if (u) {
        const y = H(l, u);
        m = new Float64Array(l.buffer, 0, y * 3), d = new Float64Array(
          l.slice(Math.max(0, y - 1) * 3)
        );
      } else
        m = new Float64Array(0), d = new Float64Array(l);
    }
    return {
      visible: h.visible,
      blockingPoint: h.blockingPoint,
      profile: h.profile,
      visibleLine: m,
      blockedLine: d
    };
  }
}
function H(a, t) {
  let n = 1 / 0, e = 0;
  const s = a.length / 3;
  for (let o = 0; o < s; o++) {
    const i = (a[o * 3] ?? 0) - (t[0] ?? 0), r = (a[o * 3 + 1] ?? 0) - (t[1] ?? 0), c = (a[o * 3 + 2] ?? 0) - (t[2] ?? 0), l = i * i + r * r + c * c;
    l < n && (n = l, e = o);
  }
  return e;
}
function O(a, t) {
  return !Number.isFinite(a) || !Number.isFinite(t) || a < -180 || a > 180 || t < -90 || t > 90 ? NaN : 100 * Math.sin(a * Math.PI / 180) * Math.cos(t * Math.PI / 180) + 200;
}
class U {
  async queryElevation(t) {
    const { points: n } = t, e = n.length / 2, s = new Float64Array(e);
    for (let o = 0; o < e; o++) {
      const i = n[o * 2], r = n[o * 2 + 1];
      i === void 0 || r === void 0 ? s[o] = NaN : s[o] = O(i, r);
    }
    return { elevations: s };
  }
}
const F = 6371e3;
function v(a) {
  return a * Math.PI / 180;
}
function S(a, t, n, e) {
  const s = v(e - t), o = v(n - a), i = v(t), r = v(e), c = Math.sin(s / 2) * Math.sin(s / 2) + Math.cos(i) * Math.cos(r) * Math.sin(o / 2) * Math.sin(o / 2), l = 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
  return F * l;
}
function X(a, t, n, e) {
  const s = e / F, o = v(t), i = v(a), r = Math.sin(o) * Math.cos(s) + Math.cos(o) * Math.sin(s) * Math.cos(n), c = Math.asin(r), l = Math.sin(n) * Math.sin(s) * Math.cos(o), f = Math.cos(s) - Math.sin(o) * r;
  return [(i + Math.atan2(l, f)) * 180 / Math.PI, c * 180 / Math.PI];
}
function j(a, t, n, e, s) {
  const o = v(t), i = v(a), r = v(e), c = v(n), l = S(a, t, n, e) / F;
  if (l < 1e-12)
    return [a, t];
  const f = Math.sin(l), M = Math.sin((1 - s) * l) / f, h = Math.sin(s * l) / f, m = M * Math.cos(o) * Math.cos(i) + h * Math.cos(r) * Math.cos(c), d = M * Math.cos(o) * Math.sin(i) + h * Math.cos(r) * Math.sin(c), u = M * Math.sin(o) + h * Math.sin(r), y = Math.atan2(u, Math.sqrt(m * m + d * d));
  return [Math.atan2(d, m) * 180 / Math.PI, y * 180 / Math.PI];
}
const q = 64;
class z {
  async buffer(t) {
    const { geometry: n, distance: e } = t, s = t.segments ?? q;
    if (n.type === "Point")
      return this.pointBuffer(
        n.coordinates,
        e,
        s
      );
    if (n.type === "Polygon") {
      const i = n.coordinates[0];
      if (!i || i.length === 0)
        throw new Error("Empty polygon ring");
      const r = Q(i);
      return this.pointBuffer(r, e, s);
    }
    if (n.type === "LineString") {
      const o = n.coordinates;
      if (!o || o.length === 0)
        throw new Error("Empty LineString");
      const i = Math.floor(o.length / 2), r = o[i];
      if (!r || r.length < 2)
        throw new Error("Invalid LineString coordinate");
      return this.pointBuffer([r[0], r[1]], e, s);
    }
    throw new Error(`Unsupported geometry type: ${n.type}`);
  }
  pointBuffer(t, n, e) {
    const s = [];
    for (let i = 0; i < e; i++) {
      const r = 2 * Math.PI * i / e, [c, l] = X(t[0], t[1], r, n);
      s.push([c, l]);
    }
    const o = s[0];
    return o && s.push([o[0], o[1]]), {
      geometry: {
        type: "Polygon",
        coordinates: [s]
      }
    };
  }
}
function Q(a) {
  let t = 0, n = 0;
  const e = a.length > 1 && a[0][0] === a[a.length - 1][0] && a[0][1] === a[a.length - 1][1] ? a.length - 1 : a.length;
  for (let s = 0; s < e; s++)
    t += a[s][0], n += a[s][1];
  return [t / e, n / e];
}
function x(a, t) {
  return 100 * Math.sin(a * Math.PI / 180) * Math.cos(t * Math.PI / 180) + 200;
}
class Y {
  async sampleRoute(t) {
    const { route: n, interval: e } = t;
    if (n.length < 4)
      return { samples: new Float64Array(0), totalDistance: 0 };
    const s = n.length / 2, o = [];
    let i = 0;
    for (let u = 0; u < s - 1; u++) {
      const y = n[u * 2], g = n[u * 2 + 1], p = n[(u + 1) * 2], b = n[(u + 1) * 2 + 1], L = S(y, g, p, b);
      o.push(L), i += L;
    }
    if (i === 0 || e <= 0) {
      const u = n[0], y = n[1];
      return {
        samples: new Float64Array([u, y, x(u, y), 0]),
        totalDistance: 0
      };
    }
    const r = [];
    let c = 0, l = 0, f = 0;
    const M = n[0], h = n[1];
    r.push(M, h, x(M, h), 0);
    let m = e;
    for (; m <= i && l < o.length; ) {
      const u = o[l], y = u - f;
      if (m - c - f <= y) {
        const g = f + (m - c - f), p = u > 0 ? g / u : 0, b = n[l * 2], L = n[l * 2 + 1], P = n[(l + 1) * 2], R = n[(l + 1) * 2 + 1], [E, I] = j(b, L, P, R, p), T = x(E, I);
        r.push(E, I, T, m), f = g, m += e;
      } else
        c += u, f = 0, l++;
    }
    const d = r.length >= 4 ? r[r.length - 1] : 0;
    if (Math.abs(d - i) > 0.01) {
      const u = n[(s - 1) * 2], y = n[(s - 1) * 2 + 1];
      r.push(u, y, x(u, y), i);
    }
    return {
      samples: new Float64Array(r),
      totalDistance: i
    };
  }
}
class nt {
  losAnalysis;
  elevationQuery;
  bufferAnalysis;
  routeSampler;
  constructor(t) {
    this.losAnalysis = new C(t), this.elevationQuery = new U(), this.bufferAnalysis = new z(), this.routeSampler = new Y();
  }
  runLos(t) {
    return this.losAnalysis.runLos(t);
  }
  queryElevation(t) {
    return this.elevationQuery.queryElevation(t);
  }
  buffer(t) {
    return this.bufferAnalysis.buffer(t);
  }
  sampleRoute(t) {
    return this.routeSampler.sampleRoute(t);
  }
}
function $(a, t, n) {
  const e = 1 << n, s = Math.floor((a + 180) / 360 * e), o = t * Math.PI / 180, i = Math.floor((1 - Math.log(Math.tan(o) + 1 / Math.cos(o)) / Math.PI) / 2 * e);
  return { x: Math.max(0, Math.min(e - 1, s)), y: Math.max(0, Math.min(e - 1, i)), z: n };
}
function G(a, t, n) {
  const e = 1 << n, s = (a + 180) / 360 * e, o = t * Math.PI / 180, i = (1 - Math.log(Math.tan(o) + 1 / Math.cos(o)) / Math.PI) / 2 * e;
  return { fx: s - Math.floor(s), fy: i - Math.floor(i) };
}
class et {
  _layers;
  constructor(t) {
    this._layers = t;
  }
  sampleElevation(t, n) {
    for (const e of this._layers) {
      const s = Math.min(e.maxZoom, Math.max(e.minZoom, 10)), o = $(t, n, s), i = e.getReadyHeightTile(o.z, o.x, o.y);
      if (!i) continue;
      const { fx: r, fy: c } = G(t, n, s), l = Z(i.data, i.width, i.height, r, c);
      if (Number.isFinite(l)) return l;
    }
    return null;
  }
  sampleElevationBatch(t) {
    const n = t.length / 2, e = new Float64Array(n);
    for (let s = 0; s < n; s++) {
      const o = t[s * 2], i = t[s * 2 + 1], r = this.sampleElevation(o, i);
      e[s] = r ?? NaN;
    }
    return e;
  }
}
function Z(a, t, n, e, s) {
  const o = e * (t - 1), i = s * (n - 1), r = Math.floor(o), c = Math.floor(i), l = Math.min(r + 1, t - 1), f = Math.min(c + 1, n - 1), M = o - r, h = i - c, m = a[c * t + r], d = a[c * t + l], u = a[f * t + r], y = a[f * t + l];
  return m * (1 - M) * (1 - h) + d * M * (1 - h) + u * (1 - M) * h + y * M * h;
}
function N(a, t, n) {
  let e = !1;
  const s = n.length;
  for (let o = 0, i = s - 1; o < s; i = o++) {
    const r = n[o][0], c = n[o][1], l = n[i][0], f = n[i][1];
    c > t != f > t && a < (l - r) * (t - c) / (f - c) + r && (e = !e);
  }
  return e;
}
function B(a, t, n) {
  if (!n[0] || !N(a, t, n[0])) return !1;
  for (let e = 1; e < n.length; e++)
    if (N(a, t, n[e])) return !1;
  return !0;
}
function J(a, t, n, e, s) {
  let o = 1 / 0, i = null;
  const r = s.length;
  for (let c = 0, l = r - 1; c < r; l = c++) {
    const f = s[l][0], M = s[l][1], h = s[c][0], m = s[c][1], d = V(a, t, n, e, f, M, h, m);
    d !== null && d.t < o && (o = d.t, i = d.point);
  }
  return i !== null ? { t: o, point: i } : null;
}
function K(a, t, n, e, s) {
  let o = 1 / 0, i = null;
  for (const r of s) {
    const c = J(a, t, n, e, r);
    c !== null && c.t < o && (o = c.t, i = c.point);
  }
  return i !== null ? { t: o, point: i } : null;
}
function V(a, t, n, e, s, o, i, r) {
  const c = n - a, l = e - t, f = i - s, M = r - o, h = c * M - l * f;
  if (Math.abs(h) < 1e-15) return null;
  const m = s - a, d = o - t, u = (m * M - d * f) / h, y = (m * l - d * c) / h;
  return u >= 0 && u <= 1 && y >= 0 && y <= 1 ? {
    t: u,
    point: [a + u * c, t + u * l]
  } : null;
}
class ot {
  _getFeatures;
  _heightField;
  _minHeightField;
  _baseProvider;
  // Cache to avoid recomputing bbox/rings for each query
  _cachedBuildings = null;
  _cachedFeaturesRef = null;
  constructor(t) {
    this._getFeatures = t.getFeatures, this._heightField = t.heightField, this._minHeightField = t.minHeightField, this._baseProvider = t.baseProvider;
  }
  sampleElevation(t, n) {
    const e = this._getBuildings(), s = this._baseProvider?.sampleElevation(t, n) ?? 0;
    for (const o of e)
      if (!(t < o.minLon || t > o.maxLon || n < o.minLat || n > o.maxLat) && B(t, n, o.rings))
        return s + o.height;
    return null;
  }
  /**
   * Batch elevation query with line-segment intersection.
   *
   * For each consecutive pair of sample points, tests if the segment
   * intersects any building edge. This catches buildings that fall
   * between sample points (narrow buildings, corner clips).
   */
  sampleElevationBatch(t) {
    const n = t.length / 2, e = new Float64Array(n), s = this._getBuildings();
    if (s.length === 0) return e;
    let o = 1 / 0, i = 1 / 0, r = -1 / 0, c = -1 / 0;
    for (let h = 0; h < n; h++) {
      const m = t[h * 2], d = t[h * 2 + 1];
      m < o && (o = m), m > r && (r = m), d < i && (i = d), d > c && (c = d);
    }
    const l = s.filter(
      (h) => h.maxLon >= o && h.minLon <= r && h.maxLat >= i && h.minLat <= c
    );
    let f = 0;
    for (let h = 0; h < n; h++) {
      const m = t[h * 2], d = t[h * 2 + 1], u = this._baseProvider?.sampleElevation(m, d) ?? 0;
      let y = NaN;
      for (const g of l)
        if (!(m < g.minLon || m > g.maxLon || d < g.minLat || d > g.maxLat) && B(m, d, g.rings)) {
          y = u + g.height, f++;
          break;
        }
      e[h] = y;
    }
    let M = 0;
    if (n >= 2) {
      const h = t[0], m = t[1], d = t[(n - 1) * 2], u = t[(n - 1) * 2 + 1];
      for (const y of l) {
        const g = K(h, m, d, u, y.rings);
        if (g) {
          const p = Math.round(g.t * (n - 1)), b = Math.max(0, Math.min(n - 1, p)), P = (this._baseProvider?.sampleElevation(g.point[0], g.point[1]) ?? 0) + y.height;
          (Number.isNaN(e[b]) || P > e[b]) && (e[b] = P, M++);
        }
      }
    }
    return (f > 0 || M > 0) && console.log(`[BuildingObstacle] ${l.length} candidates, PIP: ${f}, segment: ${M} hits`), e;
  }
  /** Lazily build/cache building data from features. */
  _getBuildings() {
    const t = this._getFeatures();
    if (t !== this._cachedFeaturesRef && (this._cachedFeaturesRef = t, this._cachedBuildings = null), !this._cachedBuildings) {
      this._cachedBuildings = [];
      for (const n of t) {
        const e = n.geometry;
        if (e.type !== "Polygon" && e.type !== "MultiPolygon") continue;
        const s = W(n, this._heightField, this._minHeightField);
        if (s <= 0) continue;
        const o = e.type === "Polygon" ? [e.coordinates] : e.coordinates;
        for (const i of o) {
          let r = 1 / 0, c = 1 / 0, l = -1 / 0, f = -1 / 0;
          for (const M of i)
            for (const h of M)
              h[0] < r && (r = h[0]), h[0] > l && (l = h[0]), h[1] < c && (c = h[1]), h[1] > f && (f = h[1]);
          this._cachedBuildings.push({ feature: n, rings: i, minLon: r, minLat: c, maxLon: l, maxLat: f, height: s });
        }
      }
    }
    return this._cachedBuildings;
  }
}
function W(a, t, n) {
  const e = Number(a.attributes[t]) || 0, s = n && Number(a.attributes[n]) || 0;
  return Math.max(0, e - s);
}
class st {
  _providers;
  constructor(t) {
    this._providers = t;
  }
  sampleElevation(t, n) {
    let e = null;
    for (const s of this._providers) {
      const o = s.sampleElevation(t, n);
      o !== null && (e = e === null ? o : Math.max(e, o));
    }
    return e;
  }
  sampleElevationBatch(t) {
    const n = t.length / 2, e = new Float64Array(n).fill(NaN);
    for (const s of this._providers) {
      const o = s.sampleElevationBatch(t);
      for (let i = 0; i < n; i++) {
        const r = o[i];
        Number.isFinite(r) && (e[i] = Number.isNaN(e[i]) ? r : Math.max(e[i], r));
      }
    }
    return e;
  }
}
export {
  nt as AnalysisService,
  z as BufferAnalysis,
  ot as BuildingObstacleProvider,
  st as CompositeElevationProvider,
  F as EARTH_RADIUS,
  U as ElevationQuery,
  C as LosAnalysis,
  Y as RouteSampler,
  et as TerrainElevationProvider,
  X as destinationPoint,
  S as haversineDistance,
  j as interpolateGreatCircle,
  B as pointInPolygon,
  N as pointInRing,
  K as segmentIntersectsPolygon,
  J as segmentIntersectsRing
};
