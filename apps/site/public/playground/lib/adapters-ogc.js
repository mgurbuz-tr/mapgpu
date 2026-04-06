function M(r, t) {
  const e = [], o = r.children;
  for (let n = 0; n < o.length; n++) {
    const i = o[n];
    (i.localName === t || i.tagName === t) && e.push(i);
  }
  return e;
}
function V(r, t) {
  const e = r.children;
  for (let o = 0; o < e.length; o++) {
    const n = e[o];
    if (n.localName === t || n.tagName === t)
      return n;
  }
  return null;
}
function P(r, t) {
  return V(r, t)?.textContent?.trim() ?? null;
}
function it(r) {
  const e = new DOMParser().parseFromString(r, "text/xml"), o = e.querySelector("parsererror");
  if (o)
    throw new Error(`Failed to parse WMS capabilities XML: ${o.textContent}`);
  const n = e.documentElement, i = n.getAttribute("version") ?? "1.3.0", s = i.startsWith("1.3"), a = n.querySelector("Service"), u = a ? P(a, "Title") ?? "" : "", c = a ? P(a, "Abstract") : null, m = n.querySelector("Capability"), l = m?.querySelector("Request > GetMap") ?? null, p = l ? M(l, "Format").map((S) => S.textContent?.trim() ?? "") : [], h = m?.querySelector("Request > GetFeatureInfo") ?? null, f = h ? M(h, "Format").map((S) => S.textContent?.trim() ?? "") : [], g = O(l), y = O(h), d = [], b = m ? V(m, "Layer") : null;
  if (b) {
    const S = Z(b, s);
    P(b, "Name") && d.push(L(b, s, []));
    const E = M(b, "Layer");
    for (const U of E)
      d.push(L(U, s, S));
  }
  return {
    version: i,
    title: u,
    abstract: c ?? void 0,
    formats: p,
    featureInfoFormats: f,
    getMapUrl: g ?? void 0,
    getFeatureInfoUrl: y ?? void 0,
    layers: d
  };
}
function L(r, t, e) {
  const o = P(r, "Name") ?? "", n = P(r, "Title") ?? "", i = P(r, "Abstract"), s = r.getAttribute("queryable") === "1", a = Z(r, t), u = lt(e, a), c = st(r), m = at(r), l = ct(r, t), p = M(r, "Layer"), h = [];
  for (const g of p)
    h.push(L(g, t, u));
  const f = {
    name: o,
    title: n,
    abstract: i ?? void 0,
    crs: u,
    boundingBoxes: c,
    styles: m,
    queryable: s,
    timeDimension: l ?? void 0
  };
  return h.length > 0 && (f.layers = h), f;
}
function Z(r, t) {
  return M(r, t ? "CRS" : "SRS").map((o) => o.textContent?.trim() ?? "");
}
function st(r) {
  return M(r, "BoundingBox").map((t) => {
    const e = t.getAttribute("CRS") ?? t.getAttribute("SRS") ?? "", o = parseFloat(t.getAttribute("minx") ?? "0"), n = parseFloat(t.getAttribute("miny") ?? "0"), i = parseFloat(t.getAttribute("maxx") ?? "0"), s = parseFloat(t.getAttribute("maxy") ?? "0");
    return { crs: e, minX: o, minY: n, maxX: i, maxY: s };
  });
}
function at(r) {
  return M(r, "Style").map((t) => {
    const e = P(t, "Name") ?? "", o = P(t, "Title"), n = t.querySelector("LegendURL > OnlineResource"), i = n?.getAttributeNS("http://www.w3.org/1999/xlink", "href") ?? n?.getAttribute("xlink:href") ?? null;
    return {
      name: e,
      title: o ?? void 0,
      legendUrl: i ?? void 0
    };
  });
}
function ct(r, t) {
  if (t) {
    for (const e of M(r, "Dimension"))
      if (e.getAttribute("name") === "time")
        return {
          name: "time",
          units: e.getAttribute("units") ?? "ISO8601",
          default: e.getAttribute("default") ?? void 0,
          values: e.textContent?.trim() ?? ""
        };
  } else {
    let e = !1, o = "ISO8601";
    for (const n of M(r, "Dimension"))
      if (n.getAttribute("name") === "time") {
        e = !0, o = n.getAttribute("units") ?? "ISO8601";
        break;
      }
    if (e) {
      for (const n of M(r, "Extent"))
        if (n.getAttribute("name") === "time")
          return {
            name: "time",
            units: o,
            default: n.getAttribute("default") ?? void 0,
            values: n.textContent?.trim() ?? ""
          };
    }
  }
  return null;
}
function O(r) {
  if (!r) return null;
  const t = r.querySelector("DCPType > HTTP > Get > OnlineResource");
  return t ? t.getAttributeNS("http://www.w3.org/1999/xlink", "href") ?? t.getAttribute("xlink:href") ?? null : null;
}
function lt(r, t) {
  const e = /* @__PURE__ */ new Set([...r, ...t]);
  return Array.from(e);
}
const ut = /* @__PURE__ */ new Set([
  "EPSG:4326",
  "EPSG:4258",
  // ETRS89
  "EPSG:4269"
  // NAD83
]);
function pt(r, t) {
  return r.startsWith("1.3") ? ut.has(t.toUpperCase()) : !1;
}
function H(r, t, e) {
  return pt(t, e) ? `${r.minY},${r.minX},${r.maxY},${r.maxX}` : `${r.minX},${r.minY},${r.maxX},${r.maxY}`;
}
function Q(r) {
  const t = r.trim();
  return t.includes("?") ? t.endsWith("&") || t.endsWith("?") ? t : `${t}&` : `${t}?`;
}
function ft(r) {
  const {
    baseUrl: t,
    version: e,
    layers: o,
    bbox: n,
    width: i,
    height: s,
    crs: a,
    format: u = "image/png",
    transparent: c = !0,
    styles: m,
    time: l,
    vendorParams: p
  } = r, f = e.startsWith("1.3") ? "CRS" : "SRS", g = [
    ["SERVICE", "WMS"],
    ["VERSION", e],
    ["REQUEST", "GetMap"],
    ["LAYERS", o.join(",")],
    ["STYLES", m ? m.join(",") : ""],
    [f, a],
    ["BBOX", H(n, e, a)],
    ["WIDTH", String(i)],
    ["HEIGHT", String(s)],
    ["FORMAT", u],
    ["TRANSPARENT", c ? "TRUE" : "FALSE"]
  ];
  if (l && g.push(["TIME", l]), p)
    for (const [b, S] of Object.entries(p))
      g.push([b, S]);
  const y = Q(t), d = g.map(([b, S]) => `${encodeURIComponent(b)}=${encodeURIComponent(S)}`).join("&");
  return `${y}${d}`;
}
function mt(r) {
  const {
    baseUrl: t,
    version: e,
    layers: o,
    bbox: n,
    width: i,
    height: s,
    x: a,
    y: u,
    crs: c,
    format: m = "application/json",
    featureCount: l = 10,
    vendorParams: p
  } = r, h = e.startsWith("1.3"), f = h ? "CRS" : "SRS", g = h ? "I" : "X", y = h ? "J" : "Y", d = [
    ["SERVICE", "WMS"],
    ["VERSION", e],
    ["REQUEST", "GetFeatureInfo"],
    ["LAYERS", o.join(",")],
    ["QUERY_LAYERS", o.join(",")],
    ["STYLES", ""],
    [f, c],
    ["BBOX", H(n, e, c)],
    ["WIDTH", String(i)],
    ["HEIGHT", String(s)],
    [g, String(a)],
    [y, String(u)],
    ["INFO_FORMAT", m],
    ["FEATURE_COUNT", String(l)]
  ];
  if (p)
    for (const [C, E] of Object.entries(p))
      d.push([C, E]);
  const b = Q(t), S = d.map(([C, E]) => `${encodeURIComponent(C)}=${encodeURIComponent(E)}`).join("&");
  return `${b}${S}`;
}
function ht(r) {
  const t = r.map((e) => e.toUpperCase());
  return t.includes("EPSG:3857") ? "EPSG:3857" : t.includes("EPSG:900913") ? "EPSG:900913" : t.includes("EPSG:4326") ? "EPSG:4326" : r[0] ?? "EPSG:4326";
}
function gt(r) {
  const t = r.boundingBoxes[0];
  return {
    name: r.name,
    title: r.title,
    abstract: r.abstract,
    crs: r.crs,
    extent: t ? [t.minX, t.minY, t.maxX, t.maxY] : void 0,
    styles: r.styles.map((e) => ({
      name: e.name,
      title: e.title,
      legendUrl: e.legendUrl
    })),
    timeExtent: r.timeDimension?.values,
    queryable: r.queryable
  };
}
function J(r) {
  const t = [];
  for (const e of r)
    t.push(gt(e)), e.layers && t.push(...J(e.layers));
  return t;
}
class Dt {
  url;
  version;
  proxyUrl;
  capabilities = null;
  constructor(t) {
    this.url = t.url, this.version = t.version ?? "1.3.0", this.proxyUrl = t.proxyUrl;
  }
  /**
   * Build a fetch-ready URL, optionally routing through a proxy.
   */
  buildFetchUrl(t) {
    return this.proxyUrl ? `${this.proxyUrl}?url=${encodeURIComponent(t)}` : t;
  }
  /**
   * Fetch and parse WMS GetCapabilities.
   */
  async getCapabilities() {
    const t = this.url.includes("?") ? "&" : "?", e = `${this.url}${t}SERVICE=WMS&VERSION=${this.version}&REQUEST=GetCapabilities`, o = this.buildFetchUrl(e), n = await fetch(o);
    if (!n.ok)
      throw new Error(`WMS GetCapabilities failed: HTTP ${n.status}`);
    const i = await n.text();
    this.capabilities = it(i);
    const s = J(this.capabilities.layers);
    return {
      type: "WMS",
      version: this.capabilities.version,
      title: this.capabilities.title,
      abstract: this.capabilities.abstract,
      layers: s,
      formats: this.capabilities.formats
    };
  }
  /**
   * Resolve the base URL for GetMap / GetFeatureInfo requests.
   * Uses the OnlineResource URL from capabilities if available,
   * otherwise falls back to the user-provided URL.
   */
  getBaseUrl(t) {
    if (!this.capabilities) return this.url;
    const e = t === "getMap" ? this.capabilities.getMapUrl : this.capabilities.getFeatureInfoUrl;
    return e ? e.replace(/[?&]$/, "") : this.url;
  }
  /**
   * Build a GetMap URL for the given parameters.
   */
  getMapUrl(t) {
    const e = this.capabilities?.version ?? this.version, o = t.crs ?? this.negotiateCrsForLayers(t.layers), n = this.getBaseUrl("getMap"), i = ft({
      baseUrl: n,
      version: e,
      layers: t.layers,
      bbox: t.bbox,
      width: t.width,
      height: t.height,
      crs: o,
      format: t.format ?? "image/png",
      transparent: t.transparent ?? !0,
      time: t.time,
      vendorParams: t.vendorParams
    });
    return this.buildFetchUrl(i);
  }
  /**
   * Execute a GetFeatureInfo request and return parsed results.
   */
  async getFeatureInfo(t) {
    const e = this.capabilities?.version ?? this.version, o = t.crs ?? this.negotiateCrsForLayers(t.layers), n = this.getBaseUrl("getFeatureInfo"), i = this.negotiateInfoFormat(), s = mt({
      baseUrl: n,
      version: e,
      layers: t.layers,
      bbox: t.bbox,
      width: t.width,
      height: t.height,
      x: t.x,
      y: t.y,
      crs: o,
      format: i,
      featureCount: t.featureCount ?? 10
    }), a = this.buildFetchUrl(s), u = await fetch(a);
    if (!u.ok)
      throw new Error(`WMS GetFeatureInfo failed: HTTP ${u.status}`);
    if ((u.headers.get("content-type") ?? "").includes("json")) {
      const l = await u.json();
      return this.parseJsonFeatureInfo(l, t.layers);
    }
    const m = await u.text();
    return {
      features: t.layers.map((l) => ({
        layerName: l,
        attributes: { raw: m }
      }))
    };
  }
  /**
   * Negotiate CRS for a set of layer names based on cached capabilities.
   */
  negotiateCrsForLayers(t) {
    if (!this.capabilities) return "EPSG:4326";
    for (const e of t) {
      const o = this.findLayer(this.capabilities.layers, e);
      if (o && o.crs.length > 0)
        return ht(o.crs);
    }
    return "EPSG:4326";
  }
  /**
   * Find a layer by name in a (possibly nested) layer tree.
   */
  findLayer(t, e) {
    for (const o of t) {
      if (o.name === e) return o;
      if (o.layers) {
        const n = this.findLayer(o.layers, e);
        if (n) return n;
      }
    }
    return null;
  }
  /**
   * Negotiate the best GetFeatureInfo format from capabilities.
   * Preference: geo+json > json > gml > html > text/plain
   */
  negotiateInfoFormat() {
    const t = this.capabilities?.featureInfoFormats ?? [], e = [
      "application/geo+json",
      "application/json",
      "application/vnd.ogc.gml",
      "text/html",
      "text/plain"
    ];
    for (const o of e)
      if (t.includes(o)) return o;
    return t[0] ?? "application/json";
  }
  /**
   * Parse a JSON GetFeatureInfo response.
   */
  parseJsonFeatureInfo(t, e) {
    return dt(t) ? { features: t.features.map(
      (n) => ({
        layerName: n.id ?? e[0] ?? "unknown",
        attributes: n.properties ?? {}
      })
    ) } : {
      features: [
        {
          layerName: e[0] ?? "unknown",
          attributes: t
        }
      ]
    };
  }
}
function dt(r) {
  return typeof r == "object" && r !== null && "type" in r && r.type === "FeatureCollection" && "features" in r && Array.isArray(r.features);
}
function W(r, t) {
  const e = r.children;
  for (let o = 0; o < e.length; o++) {
    const n = e[o];
    if (n.localName === t || n.tagName === t)
      return n;
  }
  return null;
}
function F(r, t) {
  const e = W(r, t);
  if (e) return e;
  const o = ["wfs", "ows", "fes"];
  for (const n of o) {
    const i = W(r, `${n}:${t}`);
    if (i) return i;
  }
  for (let n = 0; n < r.children.length; n++) {
    const i = r.children[n];
    if (i.localName === t)
      return i;
  }
  return null;
}
function x(r, t) {
  const e = [], o = r.children;
  for (let n = 0; n < o.length; n++) {
    const i = o[n];
    (i.localName === t || i.tagName === t || i.tagName.endsWith(`:${t}`)) && e.push(i);
  }
  return e;
}
function w(r, t) {
  return F(r, t)?.textContent?.trim() ?? null;
}
function yt(r) {
  const e = new DOMParser().parseFromString(r, "text/xml"), o = e.querySelector("parsererror");
  if (o)
    throw new Error(`Failed to parse WFS capabilities XML: ${o.textContent}`);
  const n = e.documentElement, i = n.getAttribute("version") ?? "2.0.0", s = F(n, "ServiceIdentification"), a = s ? w(s, "Title") ?? "" : "", u = s ? w(s, "Abstract") : null, c = j(n, "GetFeature"), m = j(n, "DescribeFeatureType"), l = xt(n), p = Et(n), h = F(n, "FeatureTypeList"), f = [];
  if (h) {
    const g = x(h, "FeatureType");
    for (const y of g)
      f.push(bt(y));
  }
  return {
    version: i,
    title: a,
    abstract: u ?? void 0,
    featureTypes: f,
    outputFormats: p,
    supportsStartIndex: l,
    getFeatureUrl: c ?? void 0,
    describeFeatureTypeUrl: m ?? void 0
  };
}
function bt(r) {
  const t = w(r, "Name") ?? "", e = w(r, "Title") ?? "", o = w(r, "Abstract"), n = w(r, "DefaultCRS") ?? w(r, "DefaultSRS") ?? "EPSG:4326", s = x(r, "OtherCRS").concat(x(r, "OtherSRS")).map((m) => m.textContent?.trim() ?? "").filter(Boolean), a = x(r, "OutputFormats"), u = [];
  for (const m of a) {
    const l = x(m, "Format");
    for (const p of l) {
      const h = p.textContent?.trim();
      h && u.push(h);
    }
  }
  const c = St(r);
  return {
    name: t,
    title: e,
    abstract: o ?? void 0,
    defaultCrs: n,
    otherCrs: s,
    boundingBox: c ?? void 0,
    outputFormats: u
  };
}
function St(r) {
  const t = F(r, "WGS84BoundingBox");
  if (!t) return null;
  const e = t.getAttribute("crs") ?? "EPSG:4326", o = w(t, "LowerCorner"), n = w(t, "UpperCorner");
  if (!o || !n) return null;
  const i = o.split(/\s+/).map(Number), s = n.split(/\s+/).map(Number);
  return i.length < 2 || s.length < 2 ? null : {
    crs: e,
    lowerCorner: [i[0], i[1]],
    upperCorner: [s[0], s[1]]
  };
}
function j(r, t) {
  const e = F(r, "OperationsMetadata");
  if (!e) return null;
  const o = x(e, "Operation");
  for (const n of o)
    if (n.getAttribute("name") === t) {
      const i = F(n, "DCP");
      if (!i) continue;
      const s = F(i, "HTTP");
      if (!s) continue;
      const a = F(s, "Get");
      if (!a) continue;
      return a.getAttributeNS("http://www.w3.org/1999/xlink", "href") ?? a.getAttribute("xlink:href") ?? a.getAttribute("href") ?? null;
    }
  return null;
}
function xt(r) {
  const t = F(r, "OperationsMetadata");
  if (!t) return !1;
  const e = x(t, "Operation");
  for (const o of e)
    if (o.getAttribute("name") === "GetFeature") {
      const n = x(o, "Parameter");
      for (const s of n)
        if (s.getAttribute("name") === "startIndex")
          return !0;
      const i = x(o, "Constraint");
      for (const s of i)
        if (s.getAttribute("name") === "ImplementsResultPaging")
          return w(s, "DefaultValue") === "TRUE";
    }
  return !0;
}
function Et(r) {
  const t = F(r, "OperationsMetadata");
  if (!t) return [];
  const e = x(t, "Operation");
  for (const o of e)
    if (o.getAttribute("name") === "GetFeature") {
      const n = x(o, "Parameter");
      for (const i of n)
        if (i.getAttribute("name") === "outputFormat")
          return x(i, "Value").concat(x(i, "AllowedValues").flatMap((a) => x(a, "Value"))).map((a) => a.textContent?.trim() ?? "").filter(Boolean);
    }
  return [];
}
function K(r) {
  const t = r.trim();
  return t.includes("?") ? t.endsWith("&") || t.endsWith("?") ? t : `${t}&` : `${t}?`;
}
function Tt(r) {
  const {
    baseUrl: t,
    version: e,
    typeName: o,
    outputFormat: n = "application/json",
    srsName: i,
    count: s,
    startIndex: a,
    bbox: u,
    bboxCrs: c,
    filter: m,
    propertyName: l,
    sortBy: p
  } = r, h = e.startsWith("2."), f = [
    ["SERVICE", "WFS"],
    ["VERSION", e],
    ["REQUEST", "GetFeature"],
    [h ? "TYPENAMES" : "TYPENAME", o],
    ["OUTPUTFORMAT", n]
  ];
  if (i && f.push(["SRSNAME", i]), s !== void 0 && f.push([h ? "COUNT" : "MAXFEATURES", String(s)]), a !== void 0 && f.push(["STARTINDEX", String(a)]), u) {
    const d = c ? `${u.join(",")},${c}` : u.join(",");
    f.push(["BBOX", d]);
  }
  m && f.push(["CQL_FILTER", m]), l && l.length > 0 && f.push(["PROPERTYNAME", l.join(",")]), p && f.push(["SORTBY", p]);
  const g = K(t), y = f.map(([d, b]) => `${encodeURIComponent(d)}=${encodeURIComponent(b)}`).join("&");
  return `${g}${y}`;
}
function qt(r, t, e, o) {
  const n = t.startsWith("2."), i = [
    ["SERVICE", "WFS"],
    ["VERSION", t],
    ["REQUEST", "DescribeFeatureType"],
    [n ? "TYPENAMES" : "TYPENAME", e]
  ];
  o && i.push(["OUTPUTFORMAT", o]);
  const s = K(r), a = i.map(([u, c]) => `${encodeURIComponent(u)}=${encodeURIComponent(c)}`).join("&");
  return `${s}${a}`;
}
class Yt {
  url;
  version;
  proxyUrl;
  timeout;
  pageSize;
  fetchFn;
  capabilities = null;
  constructor(t) {
    this.url = t.url, this.version = t.version ?? "2.0.0", this.proxyUrl = t.proxyUrl, this.timeout = t.timeout ?? 3e4, this.pageSize = t.pageSize ?? 1e3, this.fetchFn = t.fetchFn ?? fetch;
  }
  /**
   * Build a fetch-ready URL, optionally routing through a proxy.
   */
  buildFetchUrl(t) {
    return this.proxyUrl ? `${this.proxyUrl}?url=${encodeURIComponent(t)}` : t;
  }
  /**
   * Fetch with timeout and error handling.
   */
  async fetchWithTimeout(t) {
    const e = new AbortController(), o = setTimeout(() => e.abort(), this.timeout);
    try {
      const n = await this.fetchFn(t, { signal: e.signal });
      if (!n.ok)
        throw new Error(`WFS request failed: HTTP ${n.status}`);
      return n;
    } finally {
      clearTimeout(o);
    }
  }
  /**
   * Fetch and parse WFS GetCapabilities.
   */
  async loadCapabilities() {
    if (this.capabilities) return this.capabilities;
    const t = this.url.includes("?") ? "&" : "?", e = `${this.url}${t}SERVICE=WFS&VERSION=${this.version}&REQUEST=GetCapabilities`, o = this.buildFetchUrl(e), i = await (await this.fetchWithTimeout(o)).text();
    return this.capabilities = yt(i), this.capabilities;
  }
  /**
   * Get available feature type collections.
   */
  async getCollections() {
    return (await this.loadCapabilities()).featureTypes.map((e) => {
      const o = e.boundingBox ? [
        e.boundingBox.lowerCorner[0],
        e.boundingBox.lowerCorner[1],
        e.boundingBox.upperCorner[0],
        e.boundingBox.upperCorner[1]
      ] : void 0;
      return {
        id: e.name,
        title: e.title,
        description: e.abstract,
        extent: o,
        crs: [e.defaultCrs, ...e.otherCrs]
      };
    });
  }
  /**
   * Fetch features from a WFS service with automatic pagination.
   * Yields batches of GeoJsonFeature arrays.
   */
  async *getFeatures(t, e) {
    const n = (await this.loadCapabilities()).getFeatureUrl ?? this.url, i = e?.limit, s = i !== void 0 ? Math.min(i, this.pageSize) : this.pageSize;
    let a = e?.offset ?? 0, u = 0;
    for (; ; ) {
      const c = i !== void 0 ? Math.min(s, i - u) : s;
      if (c <= 0) break;
      const m = Tt({
        baseUrl: n,
        version: this.version,
        typeName: t,
        outputFormat: "application/json",
        srsName: "EPSG:4326",
        count: c,
        startIndex: a,
        bbox: e?.bbox,
        bboxCrs: e?.bbox ? "EPSG:4326" : void 0,
        filter: e?.filter,
        propertyName: e?.properties,
        sortBy: e?.sortBy
      }), l = this.buildFetchUrl(m), p = await this.fetchWithTimeout(l), h = p.headers.get("content-type") ?? "";
      let f;
      if (h.includes("json")) {
        const g = await p.json();
        f = Ct(g);
      } else {
        const g = await p.text();
        f = Ut(g);
      }
      if (f.length === 0 || (yield f, u += f.length, i !== void 0 && u >= i) || f.length < c) break;
      a += f.length;
    }
  }
}
function Ct(r) {
  return r.type === "FeatureCollection" && Array.isArray(r.features) ? r.features.map(D) : Array.isArray(r) ? r.map(D) : [];
}
function D(r) {
  return {
    type: "Feature",
    id: r.id,
    geometry: r.geometry,
    properties: r.properties ?? {}
  };
}
function Ut(r) {
  const e = new DOMParser().parseFromString(r, "text/xml"), o = e.querySelector("parsererror");
  if (o)
    throw new Error(`Failed to parse GML: ${o.textContent}`);
  const n = [], i = A(e.documentElement, "member").concat(A(e.documentElement, "featureMember"));
  for (const s of i) {
    const a = s.children[0];
    if (!a) continue;
    const u = wt(a);
    u && n.push(u);
  }
  return n;
}
function wt(r) {
  const t = r.getAttributeNS("http://www.opengis.net/gml/3.2", "id") ?? r.getAttribute("gml:id") ?? r.getAttribute("fid") ?? void 0, e = {};
  let o = null;
  for (let n = 0; n < r.children.length; n++) {
    const i = r.children[n], s = i.localName, a = Ft(i);
    if (a) {
      o = a;
      continue;
    }
    e[s] = i.textContent?.trim() ?? null;
  }
  return o || (o = { type: "Point", coordinates: [] }), {
    type: "Feature",
    id: t ?? void 0,
    geometry: o,
    properties: e
  };
}
function Ft(r) {
  const t = q(r);
  if (t) return t;
  for (let e = 0; e < r.children.length; e++) {
    const o = r.children[e], n = q(o);
    if (n) return n;
  }
  return null;
}
function q(r) {
  switch (r.localName) {
    case "Point":
      return $t(r);
    case "LineString":
      return At(r);
    case "Polygon":
      return tt(r);
    case "MultiPoint":
      return Pt(r);
    case "MultiCurve":
    case "MultiLineString":
      return It(r);
    case "MultiSurface":
    case "MultiPolygon":
      return vt(r);
    default:
      return null;
  }
}
function Y(r) {
  const t = r.trim().split(/\s+/).map(Number), e = [];
  for (let o = 0; o < t.length - 1; o += 2)
    e.push([t[o], t[o + 1]]);
  return e;
}
function Mt(r) {
  return r.trim().split(/\s+/).map((t) => t.split(",").map(Number));
}
function v(r) {
  const t = $(r, "posList");
  if (t?.textContent)
    return Y(t.textContent);
  const e = $(r, "pos");
  if (e?.textContent)
    return Y(e.textContent);
  const o = $(r, "coordinates");
  return o?.textContent ? Mt(o.textContent) : [];
}
function $t(r) {
  return {
    type: "Point",
    coordinates: v(r)[0] ?? []
  };
}
function At(r) {
  return {
    type: "LineString",
    coordinates: v(r)
  };
}
function tt(r) {
  const t = [], e = $(r, "exterior");
  if (e) {
    const n = $(e, "LinearRing");
    n && t.push(v(n));
  }
  const o = A(r, "interior");
  for (const n of o) {
    const i = $(n, "LinearRing");
    i && t.push(v(i));
  }
  return {
    type: "Polygon",
    coordinates: t
  };
}
function Pt(r) {
  const t = [], e = A(r, "pointMember").concat(A(r, "pointMembers"));
  for (const o of e) {
    const n = $(o, "Point");
    if (n) {
      const i = v(n);
      i[0] && t.push(i[0]);
    }
  }
  return {
    type: "MultiPoint",
    coordinates: t
  };
}
function It(r) {
  const t = [], e = A(r, "curveMember").concat(A(r, "lineStringMember"));
  for (const o of e) {
    const n = $(o, "LineString");
    n && t.push(v(n));
  }
  return {
    type: "MultiLineString",
    coordinates: t
  };
}
function vt(r) {
  const t = [], e = A(r, "surfaceMember").concat(A(r, "polygonMember"));
  for (const o of e) {
    const n = $(o, "Polygon");
    if (n) {
      const i = tt(n);
      t.push(i.coordinates);
    }
  }
  return {
    type: "MultiPolygon",
    coordinates: t
  };
}
function $(r, t) {
  const e = r.children;
  for (let o = 0; o < e.length; o++) {
    const n = e[o];
    if (n.localName === t) return n;
  }
  for (let o = 0; o < e.length; o++) {
    const n = e[o];
    for (let i = 0; i < n.children.length; i++) {
      const s = n.children[i];
      if (s.localName === t) return s;
    }
  }
  return null;
}
function A(r, t) {
  const e = [], o = r.children;
  for (let n = 0; n < o.length; n++) {
    const i = o[n];
    i.localName === t && e.push(i);
  }
  return e;
}
class zt {
  url;
  proxyUrl;
  timeout;
  pageSize;
  fetchFn;
  constructor(t) {
    this.url = t.url.replace(/\/+$/, ""), this.proxyUrl = t.proxyUrl, this.timeout = t.timeout ?? 3e4, this.pageSize = t.pageSize ?? 1e3, this.fetchFn = t.fetchFn ?? fetch;
  }
  /**
   * Build a fetch-ready URL, optionally routing through a proxy.
   */
  buildFetchUrl(t) {
    return this.proxyUrl ? `${this.proxyUrl}?url=${encodeURIComponent(t)}` : t;
  }
  /**
   * Fetch with timeout and error handling.
   */
  async fetchWithTimeout(t) {
    const e = new AbortController(), o = setTimeout(() => e.abort(), this.timeout);
    try {
      const n = await this.fetchFn(t, {
        signal: e.signal,
        headers: { Accept: "application/geo+json, application/json" }
      });
      if (!n.ok)
        throw new Error(`OGC API request failed: HTTP ${n.status}`);
      return n;
    } finally {
      clearTimeout(o);
    }
  }
  /**
   * Get available collections from the /collections endpoint.
   */
  async getCollections() {
    const t = this.buildFetchUrl(`${this.url}/collections?f=json`);
    return (await (await this.fetchWithTimeout(t)).json()).collections.map((n) => {
      let i;
      const s = n.extent?.spatial?.bbox;
      if (s && s.length > 0 && s[0] && s[0].length >= 4) {
        const a = s[0];
        i = [a[0], a[1], a[2], a[3]];
      }
      return {
        id: n.id,
        title: n.title ?? n.id,
        description: n.description,
        extent: i,
        crs: n.crs
      };
    });
  }
  /**
   * Fetch features from a collection with automatic pagination.
   * Yields batches of GeoJsonFeature arrays.
   *
   * Pagination strategy:
   * 1. Follow links[rel=next] in the response body
   * 2. Fall back to Link header parsing
   * 3. Fall back to offset-based pagination
   */
  async *getFeatures(t, e) {
    const o = e?.limit, n = o !== void 0 ? Math.min(o, this.pageSize) : this.pageSize;
    let i = 0, s = this.buildItemsUrl(t, e, n);
    for (; s; ) {
      const a = o !== void 0 ? Math.min(n, o - i) : n;
      if (a <= 0) break;
      const u = this.buildFetchUrl(s), c = await this.fetchWithTimeout(u), m = await c.json(), l = (m.features ?? []).map((p) => ({
        type: "Feature",
        id: p.id,
        geometry: p.geometry,
        properties: p.properties ?? {}
      }));
      if (l.length === 0 || (yield l, i += l.length, o !== void 0 && i >= o) || l.length < a) break;
      s = this.findNextUrl(m, c);
    }
  }
  /**
   * Build the initial items URL with query parameters.
   */
  buildItemsUrl(t, e, o) {
    const n = `${this.url}/collections/${encodeURIComponent(t)}/items`, i = [];
    return i.push(`limit=${o}`), e?.offset !== void 0 && i.push(`offset=${e.offset}`), e?.bbox && i.push(`bbox=${e.bbox.join(",")}`), e?.datetime && i.push(`datetime=${encodeURIComponent(e.datetime)}`), e?.filter && (i.push(`filter=${encodeURIComponent(e.filter)}`), i.push("filter-lang=cql2-text")), e?.properties && e.properties.length > 0 && i.push(`properties=${e.properties.join(",")}`), e?.sortBy && i.push(`sortby=${encodeURIComponent(e.sortBy)}`), i.push("f=json"), `${n}?${i.join("&")}`;
  }
  /**
   * Find the next page URL from response body links or Link header.
   */
  findNextUrl(t, e) {
    if (t.links) {
      const n = t.links.find((i) => i.rel === "next");
      if (n?.href)
        return n.href;
    }
    const o = e.headers.get("Link") ?? e.headers.get("link");
    if (o) {
      const n = _t(o);
      if (n) return n;
    }
    return null;
  }
}
function _t(r) {
  const t = r.split(",");
  for (const e of t) {
    const o = e.match(/<([^>]+)>\s*;\s*rel\s*=\s*"?next"?/i);
    if (o?.[1])
      return o[1];
  }
  return null;
}
const Rt = {
  "EPSG:4326": "http://www.opengis.net/def/crs/EPSG/0/4326",
  "EPSG:3857": "http://www.opengis.net/def/crs/EPSG/0/3857",
  CRS84: "http://www.opengis.net/def/crs/OGC/1.3/CRS84",
  "CRS:84": "http://www.opengis.net/def/crs/OGC/1.3/CRS84"
};
class Xt {
  url;
  proxyUrl;
  timeout;
  fetchFn;
  constructor(t) {
    this.url = t.url.replace(/\/+$/, ""), this.proxyUrl = t.proxyUrl, this.timeout = t.timeout ?? 3e4, this.fetchFn = t.fetchFn ?? fetch;
  }
  /**
   * Build a fetch-ready URL, optionally routing through a proxy.
   */
  buildFetchUrl(t) {
    return this.proxyUrl ? `${this.proxyUrl}?url=${encodeURIComponent(t)}` : t;
  }
  /**
   * Fetch with timeout and error handling.
   */
  async fetchWithTimeout(t) {
    const e = new AbortController(), o = setTimeout(() => e.abort(), this.timeout);
    try {
      const n = await this.fetchFn(t, {
        signal: e.signal,
        headers: { Accept: "application/json" }
      });
      if (!n.ok)
        throw new Error(`OGC API Maps request failed: HTTP ${n.status}`);
      return n;
    } finally {
      clearTimeout(o);
    }
  }
  /**
   * Get capabilities by fetching /collections metadata.
   */
  async getCapabilities() {
    const t = this.buildFetchUrl(`${this.url}/collections?f=json`);
    return {
      type: "OGC-API-Maps",
      version: "1.0",
      title: "OGC API Maps Service",
      layers: (await (await this.fetchWithTimeout(t)).json()).collections.map((i) => {
        let s;
        const a = i.extent?.spatial?.bbox;
        if (a && a.length > 0 && a[0] && a[0].length >= 4) {
          const c = a[0];
          s = [c[0], c[1], c[2], c[3]];
        }
        const u = (i.styles ?? []).map((c) => ({
          name: c.id,
          title: c.title
        }));
        return {
          name: i.id,
          title: i.title ?? i.id,
          abstract: i.description,
          crs: i.crs ?? ["CRS:84"],
          extent: s,
          styles: u.length > 0 ? u : [{ name: "default" }],
          queryable: !1
        };
      }),
      formats: ["image/png", "image/jpeg"]
    };
  }
  /**
   * Build a map image URL for the given parameters.
   *
   * URL format: /collections/{collectionId}/map?bbox=...&width=...&height=...
   */
  getMapUrl(t) {
    const e = t.layers[0] ?? "", o = `${this.url}/collections/${encodeURIComponent(e)}/map`, n = [];
    if (n.push(
      `bbox=${t.bbox.minX},${t.bbox.minY},${t.bbox.maxX},${t.bbox.maxY}`
    ), n.push(`width=${t.width}`), n.push(`height=${t.height}`), t.crs) {
      const u = Rt[t.crs] ?? t.crs;
      n.push(`crs=${encodeURIComponent(u)}`);
    }
    const s = (t.format ?? "image/png").replace("image/", "");
    if (n.push(`f=${s}`), t.transparent !== void 0 && n.push(`transparent=${t.transparent}`), t.time && n.push(`datetime=${encodeURIComponent(t.time)}`), t.vendorParams)
      for (const [u, c] of Object.entries(t.vendorParams))
        n.push(`${encodeURIComponent(u)}=${encodeURIComponent(c)}`);
    const a = `${o}?${n.join("&")}`;
    return this.buildFetchUrl(a);
  }
}
class Vt {
  urlTemplate;
  isTms;
  minZoom;
  maxZoom;
  constructor(t) {
    this.urlTemplate = t.urlTemplate, this.isTms = t.urlTemplate.includes("{-y}"), this.minZoom = t.minZoom ?? 0, this.maxZoom = t.maxZoom ?? 22;
  }
  /**
   * Generate the tile URL for the given tile coordinates.
   *
   * @param z - Zoom level
   * @param x - Tile column
   * @param y - Tile row (in standard XYZ / slippy map convention: 0 = top)
   * @returns The resolved tile URL
   */
  getTileUrl(t, e, o) {
    let n = this.urlTemplate;
    if (this.isTms) {
      const i = (1 << t) - 1 - o;
      n = n.replace("{-y}", String(i));
    } else
      n = n.replace("{y}", String(o));
    return n = n.replace("{z}", String(t)), n = n.replace("{x}", String(e)), n;
  }
}
class Zt {
  timeout;
  proxyUrl;
  fetchFn;
  constructor(t) {
    this.timeout = t?.timeout ?? 1e4, this.proxyUrl = t?.proxyUrl, this.fetchFn = t?.fetchFn ?? fetch;
  }
  /**
   * Build a fetch-ready URL, optionally routing through a proxy.
   */
  buildFetchUrl(t) {
    return this.proxyUrl ? `${this.proxyUrl}?url=${encodeURIComponent(t)}` : t;
  }
  /**
   * Fetch text content with timeout. Returns null on failure.
   */
  async tryFetchText(t) {
    const e = new AbortController(), o = setTimeout(() => e.abort(), this.timeout);
    try {
      const n = this.buildFetchUrl(t), i = await this.fetchFn(n, {
        signal: e.signal
      });
      return i.ok ? await i.text() : null;
    } catch {
      return null;
    } finally {
      clearTimeout(o);
    }
  }
  /**
   * Fetch JSON content with timeout. Returns null on failure.
   */
  async tryFetchJson(t) {
    const e = new AbortController(), o = setTimeout(() => e.abort(), this.timeout);
    try {
      const n = this.buildFetchUrl(t), i = await this.fetchFn(n, {
        signal: e.signal,
        headers: { Accept: "application/json" }
      });
      return i.ok ? await i.json() : null;
    } catch {
      return null;
    } finally {
      clearTimeout(o);
    }
  }
  /**
   * Auto-detect service type from a URL.
   */
  async discover(t) {
    const e = Nt(t);
    if (e) return e;
    const o = await this.probeOgcApi(t);
    if (o) return o;
    const n = await this.probeWms(t);
    if (n) return n;
    const i = await this.probeWfs(t);
    return i || { type: "unknown" };
  }
  /**
   * Probe for OGC API (Features or Maps) by fetching landing page.
   */
  async probeOgcApi(t) {
    const e = t.includes("?") ? "&" : "?", o = `${t}${e}f=json`, n = await this.tryFetchJson(o);
    if (!n) return null;
    const i = n.links;
    return !Array.isArray(i) || !i.some(
      (a) => typeof a == "object" && a !== null && a.rel === "conformance"
    ) ? null : this.detectOgcApiType(i);
  }
  /**
   * Determine OGC API sub-type based on links.
   */
  detectOgcApiType(t) {
    const e = t.some(
      (o) => typeof o == "object" && o !== null && o.rel === "data"
    );
    for (const o of t) {
      if (typeof o != "object" || o === null) continue;
      const n = o.href;
      if (typeof n == "string" && n.includes("/map"))
        return { type: "OGC-API-Maps" };
    }
    return e ? { type: "OGC-API-Features" } : { type: "OGC-API-Features" };
  }
  /**
   * Probe for WMS service by sending GetCapabilities request.
   */
  async probeWms(t) {
    const e = t.includes("?") ? "&" : "?", o = `${t}${e}SERVICE=WMS&REQUEST=GetCapabilities`, n = await this.tryFetchText(o);
    return n && (n.includes("WMS_Capabilities") || n.includes("WMT_MS_Capabilities")) ? { type: "WMS", version: n.match(/(?:WMS_Capabilities|WMT_MS_Capabilities)[^>]*version\s*=\s*["']([^"']+)["']/i)?.[1] ?? "1.3.0" } : null;
  }
  /**
   * Probe for WFS service by sending GetCapabilities request.
   */
  async probeWfs(t) {
    const e = t.includes("?") ? "&" : "?", o = `${t}${e}SERVICE=WFS&REQUEST=GetCapabilities`, n = await this.tryFetchText(o);
    return n && n.includes("WFS_Capabilities") ? { type: "WFS", version: n.match(/WFS_Capabilities[^>]*version\s*=\s*["']([^"']+)["']/i)?.[1] ?? "2.0.0" } : null;
  }
}
function Nt(r) {
  const t = r.toLowerCase();
  return /\{z\}.*\{x\}.*\{-?y\}/i.test(r) ? { type: "XYZ" } : /[?&]service=wms/i.test(t) ? { type: "WMS", version: "1.3.0" } : /[?&]service=wfs/i.test(t) ? { type: "WFS", version: "2.0.0" } : /\/wms\/?(\?|$)/i.test(t) ? { type: "WMS", version: "1.3.0" } : /\/wfs\/?(\?|$)/i.test(t) ? { type: "WFS", version: "2.0.0" } : /\/collections(\/|$|\?)/i.test(t) ? { type: "OGC-API-Features" } : null;
}
function Ht(r) {
  const e = new DOMParser().parseFromString(r, "text/xml"), o = e.querySelector("parsererror");
  if (o)
    throw new Error(`KML parse error: ${o.textContent}`);
  const n = Ot(e), i = [], s = e.getElementsByTagName("Placemark");
  let a = 0;
  for (let l = 0; l < s.length; l++) {
    const p = s[l], h = Bt(p);
    if (!h) continue;
    const f = {}, g = I(p, "name");
    g && (f.name = g.textContent?.trim() ?? "");
    const y = I(p, "description");
    y && (f.description = y.textContent?.trim() ?? "");
    const d = I(p, "ExtendedData");
    if (d) {
      const C = d.getElementsByTagName("Data");
      for (let U = 0; U < C.length; U++) {
        const R = C[U], N = R.getAttribute("name") ?? `data_${U}`, ot = R.getElementsByTagName("value")[0];
        f[N] = ot?.textContent?.trim() ?? "";
      }
      const E = d.getElementsByTagName("SimpleData");
      for (let U = 0; U < E.length; U++) {
        const R = E[U], N = R.getAttribute("name") ?? `sdata_${U}`;
        f[N] = R.textContent?.trim() ?? "";
      }
    }
    const b = I(p, "styleUrl");
    b && (f.styleUrl = b.textContent?.trim()?.replace("#", "") ?? "");
    const S = I(p, "Style");
    S && (f._inlineStyle = nt(S)), i.push({
      id: p.getAttribute("id") ?? `kml-${++a}`,
      geometry: h,
      attributes: f
    });
  }
  const u = e.getElementsByTagName("Document")[0], c = u ? I(u, "name")?.textContent?.trim() : void 0, m = u ? I(u, "description")?.textContent?.trim() : void 0;
  return { features: i, styles: n, name: c, description: m };
}
function Bt(r) {
  const t = r.getElementsByTagName("Point")[0];
  if (t) return kt(t);
  const e = r.getElementsByTagName("LineString")[0];
  if (e) return Lt(e);
  const o = r.getElementsByTagName("Polygon")[0];
  if (o) return et(o);
  const n = r.getElementsByTagName("MultiGeometry")[0];
  return n ? Gt(n) : null;
}
function kt(r) {
  return { type: "Point", coordinates: _(r)[0] ?? [0, 0] };
}
function Lt(r) {
  return { type: "LineString", coordinates: _(r) };
}
function et(r) {
  const t = [], e = r.getElementsByTagName("outerBoundaryIs")[0];
  if (e) {
    const n = e.getElementsByTagName("LinearRing")[0];
    n && t.push(_(n));
  }
  const o = r.getElementsByTagName("innerBoundaryIs");
  for (let n = 0; n < o.length; n++) {
    const i = o[n].getElementsByTagName("LinearRing")[0];
    i && t.push(_(i));
  }
  return { type: "Polygon", coordinates: t };
}
function Gt(r) {
  const t = [], e = [], o = [];
  for (let n = 0; n < r.children.length; n++) {
    const i = r.children[n], s = i.tagName;
    if (s === "Point") {
      const a = _(i);
      a[0] && t.push(a[0]);
    } else if (s === "LineString")
      e.push(_(i));
    else if (s === "Polygon") {
      const a = et(i);
      o.push(a.coordinates);
    }
  }
  return o.length > 0 ? { type: "MultiPolygon", coordinates: o } : e.length > 0 ? { type: "MultiLineString", coordinates: e } : t.length > 0 ? { type: "MultiPoint", coordinates: t } : { type: "Point", coordinates: [0, 0] };
}
function _(r) {
  const t = r.getElementsByTagName("coordinates")[0];
  return t ? (t.textContent?.trim() ?? "").split(/\s+/).filter((o) => o.length > 0).map((o) => {
    const n = o.split(",").map(Number);
    return n.length >= 3 ? [n[0], n[1], n[2]] : [n[0], n[1]];
  }) : [];
}
function Ot(r) {
  const t = /* @__PURE__ */ new Map(), e = r.getElementsByTagName("Style");
  for (let n = 0; n < e.length; n++) {
    const i = e[n], s = i.getAttribute("id");
    s && t.set(s, nt(i));
  }
  const o = r.getElementsByTagName("StyleMap");
  for (let n = 0; n < o.length; n++) {
    const i = o[n], s = i.getAttribute("id");
    if (!s) continue;
    const a = i.getElementsByTagName("Pair");
    for (let u = 0; u < a.length; u++)
      if (a[u].getElementsByTagName("key")[0]?.textContent?.trim() === "normal") {
        const l = a[u].getElementsByTagName("styleUrl")[0]?.textContent?.trim()?.replace("#", "");
        l && t.has(l) && t.set(s, t.get(l));
      }
  }
  return t;
}
function nt(r) {
  const t = {}, e = r.getElementsByTagName("LineStyle")[0];
  if (e) {
    const s = e.getElementsByTagName("color")[0];
    s && (t.lineColor = B(s.textContent?.trim() ?? ""));
    const a = e.getElementsByTagName("width")[0];
    a && (t.lineWidth = Number(a.textContent?.trim() ?? "1"));
  }
  const o = r.getElementsByTagName("PolyStyle")[0];
  if (o) {
    const s = o.getElementsByTagName("color")[0];
    s && (t.fillColor = B(s.textContent?.trim() ?? ""));
  }
  const n = r.getElementsByTagName("IconStyle")[0];
  if (n) {
    const s = n.getElementsByTagName("href")[0];
    s && (t.iconUrl = s.textContent?.trim() ?? "");
    const a = n.getElementsByTagName("scale")[0];
    a && (t.iconScale = Number(a.textContent?.trim() ?? "1"));
  }
  const i = r.getElementsByTagName("LabelStyle")[0];
  if (i) {
    const s = i.getElementsByTagName("color")[0];
    s && (t.labelColor = B(s.textContent?.trim() ?? ""));
  }
  return t;
}
function B(r) {
  if (r.length !== 8) return [255, 255, 255, 255];
  const t = parseInt(r.slice(0, 2), 16), e = parseInt(r.slice(2, 4), 16), o = parseInt(r.slice(4, 6), 16);
  return [parseInt(r.slice(6, 8), 16), o, e, t];
}
function I(r, t) {
  for (let e = 0; e < r.children.length; e++)
    if (r.children[e].tagName === t) return r.children[e];
  return null;
}
function Qt(r) {
  const e = new DOMParser().parseFromString(r, "text/xml"), o = e.querySelector("parsererror");
  if (o)
    throw new Error(`GPX parse error: ${o.textContent}`);
  let n = 0;
  const i = e.getElementsByTagName("metadata")[0], s = i ? {
    name: T(i, "name"),
    description: T(i, "desc"),
    author: T(i.getElementsByTagName("author")[0] ?? i, "name"),
    time: T(i, "time")
  } : void 0, a = [], u = e.getElementsByTagName("wpt");
  for (let h = 0; h < u.length; h++) {
    const f = u[h], g = Number(f.getAttribute("lat") ?? "0"), y = Number(f.getAttribute("lon") ?? "0"), d = rt(f, "ele"), b = d !== null ? [y, g, d] : [y, g];
    a.push({
      id: `gpx-wpt-${++n}`,
      geometry: { type: "Point", coordinates: b },
      attributes: k(f)
    });
  }
  const c = [], m = e.getElementsByTagName("trk");
  for (let h = 0; h < m.length; h++) {
    const f = m[h], g = [], y = f.getElementsByTagName("trkseg");
    for (let b = 0; b < y.length; b++) {
      const S = y[b].getElementsByTagName("trkpt"), C = [];
      for (let E = 0; E < S.length; E++)
        C.push(z(S[E]));
      C.length > 0 && g.push(C);
    }
    if (g.length === 0) continue;
    const d = g.length === 1 ? { type: "LineString", coordinates: g[0] } : { type: "MultiLineString", coordinates: g };
    c.push({
      id: `gpx-trk-${++n}`,
      geometry: d,
      attributes: k(f)
    });
  }
  const l = [], p = e.getElementsByTagName("rte");
  for (let h = 0; h < p.length; h++) {
    const f = p[h], g = f.getElementsByTagName("rtept"), y = [];
    for (let d = 0; d < g.length; d++)
      y.push(z(g[d]));
    y.length !== 0 && l.push({
      id: `gpx-rte-${++n}`,
      geometry: { type: "LineString", coordinates: y },
      attributes: k(f)
    });
  }
  return { waypoints: a, tracks: c, routes: l, metadata: s };
}
function Jt(r) {
  return [...r.waypoints, ...r.tracks, ...r.routes];
}
function z(r) {
  const t = Number(r.getAttribute("lat") ?? "0"), e = Number(r.getAttribute("lon") ?? "0"), o = rt(r, "ele"), n = T(r, "time");
  return o !== null && n ? [e, t, o, new Date(n).getTime()] : o !== null ? [e, t, o] : [e, t];
}
function k(r) {
  const t = {}, e = T(r, "name");
  e && (t.name = e);
  const o = T(r, "desc");
  o && (t.description = o);
  const n = T(r, "type");
  n && (t.type = n);
  const i = T(r, "time");
  i && (t.time = i);
  const s = T(r, "cmt");
  s && (t.comment = s);
  const a = T(r, "src");
  return a && (t.source = a), t;
}
function T(r, t) {
  const o = r.getElementsByTagName(t)[0]?.textContent?.trim();
  return o && o.length > 0 ? o : void 0;
}
function rt(r, t) {
  const e = T(r, t);
  if (!e) return null;
  const o = Number(e);
  return isNaN(o) ? null : o;
}
function Kt(r) {
  if (!Array.isArray(r) || r.length === 0)
    throw new Error("CZML must be a non-empty array");
  const t = { features: [] };
  for (const e of r) {
    if (!e || typeof e != "object") continue;
    const o = e;
    if (o.id === "document") {
      if (t.id = o.id, t.name = o.name, t.description = G(o.description), o.clock && typeof o.clock == "object") {
        const i = o.clock;
        t.clock = {
          interval: i.interval ?? "",
          currentTime: i.currentTime ?? "",
          multiplier: i.multiplier ?? 1,
          range: i.range ?? "UNBOUNDED",
          step: i.step ?? "SYSTEM_CLOCK_MULTIPLIER"
        };
      }
      continue;
    }
    const n = Wt(o);
    n && t.features.push(n);
  }
  return t;
}
function Wt(r) {
  const t = r.id ?? `czml-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, e = {};
  r.name && (e.name = r.name), r.description && (e.description = G(r.description)), r.parent && (e.parent = r.parent);
  const o = r.availability, n = r.position;
  let i = null, s;
  if (n) {
    if (n.cartographicDegrees && Array.isArray(n.cartographicDegrees)) {
      const c = n.cartographicDegrees;
      c.length === 3 ? i = { type: "Point", coordinates: [c[0], c[1], c[2]] } : c.length === 4 && typeof c[0] == "number" ? n.epoch ? (s = [{
        epoch: n.epoch,
        cartographicDegrees: c
      }], i = { type: "Point", coordinates: [c[1], c[2], c[3]] }) : i = { type: "Point", coordinates: [c[0], c[1], c[2]] } : c.length > 4 && (s = [{
        epoch: n.epoch ?? "",
        cartographicDegrees: c
      }], i = { type: "Point", coordinates: [c[1], c[2], c[3]] });
    } else if (n.cartesian && Array.isArray(n.cartesian)) {
      const c = n.cartesian;
      if (c.length >= 3) {
        const [m, l, p] = [c[0], c[1], c[2]], h = Math.atan2(l, m) * (180 / Math.PI), f = Math.atan2(p, Math.sqrt(m * m + l * l)) * (180 / Math.PI), g = Math.sqrt(m * m + l * l + p * p) - 6378137;
        i = { type: "Point", coordinates: [h, f, g] };
      }
    }
  }
  const a = r.polyline;
  if (a) {
    const c = a.positions;
    if (c?.cartographicDegrees && Array.isArray(c.cartographicDegrees)) {
      const l = c.cartographicDegrees, p = [];
      for (let h = 0; h + 2 < l.length; h += 3)
        p.push([l[h], l[h + 1], l[h + 2]]);
      p.length >= 2 && (i = { type: "LineString", coordinates: p });
    }
    a.width && (e._lineWidth = a.width);
    const m = a.material;
    if (m?.solidColor) {
      const l = m.solidColor;
      l.color && typeof l.color == "object" && (e._lineColor = l.color);
    }
  }
  const u = r.polygon;
  if (u) {
    const c = u.positions;
    if (c?.cartographicDegrees && Array.isArray(c.cartographicDegrees)) {
      const m = c.cartographicDegrees, l = [];
      for (let p = 0; p + 2 < m.length; p += 3)
        l.push([m[p], m[p + 1], m[p + 2]]);
      l.length >= 3 && (l.push([...l[0]]), i = { type: "Polygon", coordinates: [l] });
    }
  }
  if (r.billboard && !i && (e._billboard = r.billboard), r.label) {
    const c = r.label;
    c.text && (e._labelText = G(c.text));
  }
  return i ? { id: t, geometry: i, attributes: e, availability: o, sampledPositions: s } : null;
}
function G(r) {
  if (typeof r == "string") return r;
  if (r && typeof r == "object" && "string" in r)
    return r.string;
}
class te {
  type = "bing-maps";
  _key;
  _imagerySet;
  _culture;
  _templateUrl = null;
  _subdomains = [];
  constructor(t) {
    this._key = t.key, this._imagerySet = t.imagerySet ?? "Aerial", this._culture = t.culture ?? "en-US";
  }
  async getMetadata() {
    const t = `https://dev.virtualearth.net/REST/v1/Imagery/Metadata/${this._imagerySet}?key=${this._key}&include=ImageryProviders&output=json`, n = (await (await fetch(t)).json()).resourceSets?.[0]?.resources?.[0];
    if (!n) throw new Error("Bing Maps: no resource in metadata response");
    return this._templateUrl = n.imageUrl.replace("{culture}", this._culture), this._subdomains = n.imageUrlSubdomains ?? ["t0", "t1", "t2", "t3"], {
      name: `Bing Maps ${this._imagerySet}`,
      attribution: "© Microsoft Bing Maps",
      minZoom: n.zoomMin ?? 1,
      maxZoom: n.zoomMax ?? 21,
      tileSize: n.imageWidth ?? 256
    };
  }
  getTileUrl(t, e, o) {
    if (!this._templateUrl)
      throw new Error("BingMapsProvider: call getMetadata() first");
    const n = jt(e, o, t), i = this._subdomains[Math.abs(e + o) % this._subdomains.length] ?? "t0";
    return this._templateUrl.replace("{quadkey}", n).replace("{subdomain}", i);
  }
}
function jt(r, t, e) {
  let o = "";
  for (let n = e; n > 0; n--) {
    let i = 0;
    const s = 1 << n - 1;
    (r & s) !== 0 && (i += 1), (t & s) !== 0 && (i += 2), o += i.toString();
  }
  return o;
}
class ee {
  type = "mapbox";
  _token;
  _tilesetId;
  _format;
  _highDpi;
  constructor(t) {
    this._token = t.accessToken, this._tilesetId = t.tilesetId ?? "mapbox.satellite", this._format = t.format ?? "webp", this._highDpi = t.highDpi ?? !0;
  }
  async getMetadata() {
    return {
      name: `Mapbox ${this._tilesetId}`,
      attribution: "© Mapbox © OpenStreetMap contributors",
      minZoom: 0,
      maxZoom: 22,
      tileSize: this._highDpi ? 512 : 256
    };
  }
  getTileUrl(t, e, o) {
    const n = this._highDpi ? "@2x" : "";
    return `https://api.mapbox.com/v4/${this._tilesetId}/${t}/${e}/${o}${n}.${this._format}?access_token=${this._token}`;
  }
}
class ne {
  type = "arcgis";
  _url;
  _token;
  constructor(t) {
    this._url = t?.url ?? "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer", this._token = t?.token ?? "";
  }
  async getMetadata() {
    const t = `${this._url}?f=json${this._token ? `&token=${this._token}` : ""}`;
    try {
      const o = await (await fetch(t)).json();
      return {
        name: o.mapName ?? o.documentInfo?.Title ?? "ArcGIS",
        attribution: o.copyrightText ?? "© Esri",
        minZoom: o.minScale ? X(o.minScale) : 0,
        maxZoom: o.maxScale ? X(o.maxScale) : 19,
        tileSize: o.tileInfo?.rows ?? 256
      };
    } catch {
      return {
        name: "ArcGIS World Imagery",
        attribution: "© Esri",
        minZoom: 0,
        maxZoom: 19,
        tileSize: 256
      };
    }
  }
  getTileUrl(t, e, o) {
    const n = this._token ? `?token=${this._token}` : "";
    return `${this._url}/tile/${t}/${o}/${e}${n}`;
  }
}
function X(r) {
  return Math.round(Math.log2(559082264 / r));
}
class re {
  type = "wmts";
  _url;
  _layer;
  _tileMatrixSet;
  _format;
  _style;
  _encoding;
  _resourceUrl;
  constructor(t) {
    this._url = t.url, this._layer = t.layer, this._tileMatrixSet = t.tileMatrixSet ?? "WebMercatorQuad", this._format = t.format ?? "image/png", this._style = t.style ?? "default", this._encoding = t.encoding ?? "RESTful", this._resourceUrl = t.resourceUrl ?? "/tile/{TileMatrix}/{TileRow}/{TileCol}";
  }
  async getMetadata() {
    return {
      name: `WMTS ${this._layer}`,
      attribution: "",
      minZoom: 0,
      maxZoom: 22,
      tileSize: 256
    };
  }
  getTileUrl(t, e, o) {
    if (this._encoding === "KVP") {
      const n = new URLSearchParams({
        service: "WMTS",
        request: "GetTile",
        version: "1.0.0",
        layer: this._layer,
        style: this._style,
        format: this._format,
        tileMatrixSet: this._tileMatrixSet,
        tileMatrix: String(t),
        tileRow: String(o),
        tileCol: String(e)
      });
      return `${this._url}?${n.toString()}`;
    }
    return this._url + this._resourceUrl.replace("{TileMatrix}", String(t)).replace("{TileRow}", String(o)).replace("{TileCol}", String(e)).replace("{Style}", this._style).replace("{Layer}", this._layer);
  }
}
export {
  ne as ArcGISProvider,
  te as BingMapsProvider,
  ee as MapboxProvider,
  zt as OgcApiFeaturesAdapter,
  Xt as OgcApiMapsAdapter,
  Zt as ServiceDiscovery,
  re as WMTSProvider,
  Yt as WfsAdapter,
  Dt as WmsAdapter,
  Vt as XyzAdapter,
  qt as buildDescribeFeatureTypeUrl,
  mt as buildGetFeatureInfoUrl,
  Tt as buildGetFeatureUrl,
  ft as buildGetMapUrl,
  Nt as detectFromUrlPattern,
  Jt as gpxToFeatures,
  Kt as parseCzml,
  Ut as parseGmlFeatures,
  Qt as parseGpx,
  Ht as parseKml,
  yt as parseWfsCapabilities,
  it as parseWmsCapabilities
};
