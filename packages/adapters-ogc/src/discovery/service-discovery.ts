/**
 * Service Discovery
 *
 * Implements IServiceDiscovery — auto-detects OGC service type from a URL.
 *
 * Strategy:
 * 1. URL pattern analysis (service=WMS, /wfs?, /collections, /{z}/{x}/{y})
 * 2. HEAD request → Content-Type check
 * 3. GetCapabilities probe (WMS/WFS)
 * 4. Landing page probe (OGC API)
 * 5. Fallback: { type: 'unknown' }
 */

import type { IServiceDiscovery, ServiceType } from '../types.js';

export interface ServiceDiscoveryOptions {
  /** Request timeout in milliseconds. Defaults to 10000 (10s). */
  timeout?: number;
  /** Optional proxy URL prefix */
  proxyUrl?: string;
  /** Custom fetch function for dependency injection (testing) */
  fetchFn?: typeof fetch;
}

export class ServiceDiscovery implements IServiceDiscovery {
  private readonly timeout: number;
  private readonly proxyUrl?: string;
  private readonly fetchFn: typeof fetch;

  constructor(options?: ServiceDiscoveryOptions) {
    this.timeout = options?.timeout ?? 10000;
    this.proxyUrl = options?.proxyUrl;
    this.fetchFn = options?.fetchFn ?? fetch;
  }

  /**
   * Build a fetch-ready URL, optionally routing through a proxy.
   */
  private buildFetchUrl(targetUrl: string): string {
    if (this.proxyUrl) {
      return `${this.proxyUrl}?url=${encodeURIComponent(targetUrl)}`;
    }
    return targetUrl;
  }

  /**
   * Fetch text content with timeout. Returns null on failure.
   */
  private async tryFetchText(url: string): Promise<string | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const fetchUrl = this.buildFetchUrl(url);
      const response = await this.fetchFn(fetchUrl, {
        signal: controller.signal,
      });
      if (!response.ok) return null;
      return await response.text();
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Fetch JSON content with timeout. Returns null on failure.
   */
  private async tryFetchJson(url: string): Promise<Record<string, unknown> | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const fetchUrl = this.buildFetchUrl(url);
      const response = await this.fetchFn(fetchUrl, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      if (!response.ok) return null;
      return (await response.json()) as Record<string, unknown>;
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Auto-detect service type from a URL.
   */
  async discover(url: string): Promise<ServiceType> {
    // Step 1: URL pattern analysis
    const patternResult = detectFromUrlPattern(url);
    if (patternResult) return patternResult;

    // Step 2: Try OGC API landing page probe
    const ogcApiResult = await this.probeOgcApi(url);
    if (ogcApiResult) return ogcApiResult;

    // Step 3: Try WMS GetCapabilities probe
    const wmsResult = await this.probeWms(url);
    if (wmsResult) return wmsResult;

    // Step 4: Try WFS GetCapabilities probe
    const wfsResult = await this.probeWfs(url);
    if (wfsResult) return wfsResult;

    // Step 5: Fallback
    return { type: 'unknown' };
  }

  /**
   * Probe for OGC API (Features or Maps) by fetching landing page.
   */
  private async probeOgcApi(url: string): Promise<ServiceType | null> {
    const separator = url.includes('?') ? '&' : '?';
    const landingUrl = `${url}${separator}f=json`;

    const data = await this.tryFetchJson(landingUrl);
    if (!data) return null;

    // Check for conformance link — indicator of OGC API
    const links = data['links'];
    if (!Array.isArray(links)) return null;

    const hasConformance = links.some(
      (l: unknown) =>
        typeof l === 'object' &&
        l !== null &&
        (l as Record<string, unknown>)['rel'] === 'conformance',
    );

    if (!hasConformance) return null;

    // Determine if it's Features or Maps
    return this.detectOgcApiType(links);
  }

  /**
   * Determine OGC API sub-type based on links.
   */
  private detectOgcApiType(
    links: unknown[],
  ): ServiceType {
    const hasData = links.some(
      (l: unknown) =>
        typeof l === 'object' &&
        l !== null &&
        (l as Record<string, unknown>)['rel'] === 'data',
    );

    // 'data' rel typically points to /collections — both Features and Maps have it.
    // We check for hints in link hrefs
    for (const link of links) {
      if (typeof link !== 'object' || link === null) continue;
      const href = (link as Record<string, unknown>)['href'];
      if (typeof href === 'string') {
        if (href.includes('/map')) {
          return { type: 'OGC-API-Maps' };
        }
      }
    }

    // Default to Features if we have data/conformance links
    if (hasData) {
      return { type: 'OGC-API-Features' };
    }

    return { type: 'OGC-API-Features' };
  }

  /**
   * Probe for WMS service by sending GetCapabilities request.
   */
  private async probeWms(url: string): Promise<ServiceType | null> {
    const separator = url.includes('?') ? '&' : '?';
    const capUrl = `${url}${separator}SERVICE=WMS&REQUEST=GetCapabilities`;

    const text = await this.tryFetchText(capUrl);
    if (!text) return null;

    if (
      text.includes('WMS_Capabilities') ||
      text.includes('WMT_MS_Capabilities')
    ) {
      // Match version from the root element, not the XML declaration
      const versionMatch = text.match(/(?:WMS_Capabilities|WMT_MS_Capabilities)[^>]*version\s*=\s*["']([^"']+)["']/i);
      const version = versionMatch?.[1] ?? '1.3.0';
      return { type: 'WMS', version };
    }

    return null;
  }

  /**
   * Probe for WFS service by sending GetCapabilities request.
   */
  private async probeWfs(url: string): Promise<ServiceType | null> {
    const separator = url.includes('?') ? '&' : '?';
    const capUrl = `${url}${separator}SERVICE=WFS&REQUEST=GetCapabilities`;

    const text = await this.tryFetchText(capUrl);
    if (!text) return null;

    if (text.includes('WFS_Capabilities')) {
      // Match version from the root element, not the XML declaration
      const versionMatch = text.match(/WFS_Capabilities[^>]*version\s*=\s*["']([^"']+)["']/i);
      const version = versionMatch?.[1] ?? '2.0.0';
      return { type: 'WFS', version };
    }

    return null;
  }
}

/**
 * Detect service type from URL patterns alone (no network requests).
 */
export function detectFromUrlPattern(url: string): ServiceType | null {
  const lower = url.toLowerCase();

  // XYZ tile pattern: contains {z}/{x}/{y} or {z}/{x}/{-y}
  if (/\{z\}.*\{x\}.*\{-?y\}/i.test(url)) {
    return { type: 'XYZ' };
  }

  // WMS service parameter
  if (/[?&]service=wms/i.test(lower)) {
    return { type: 'WMS', version: '1.3.0' };
  }

  // WFS service parameter
  if (/[?&]service=wfs/i.test(lower)) {
    return { type: 'WFS', version: '2.0.0' };
  }

  // Common WMS endpoint paths
  if (/\/wms\/?(\?|$)/i.test(lower)) {
    return { type: 'WMS', version: '1.3.0' };
  }

  // Common WFS endpoint paths
  if (/\/wfs\/?(\?|$)/i.test(lower)) {
    return { type: 'WFS', version: '2.0.0' };
  }

  // OGC API: /collections path
  if (/\/collections(\/|$|\?)/i.test(lower)) {
    return { type: 'OGC-API-Features' };
  }

  return null;
}
