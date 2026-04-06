import { describe, it, expect } from 'vitest';
import { parseGpx, gpxToFeatures } from './GpxParser.js';

const SIMPLE_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <metadata>
    <name>Test Track</name>
    <desc>A test GPX file</desc>
  </metadata>
  <wpt lat="41.0" lon="29.0">
    <ele>150</ele>
    <name>Waypoint 1</name>
    <desc>First waypoint</desc>
  </wpt>
  <wpt lat="42.0" lon="30.0">
    <name>Waypoint 2</name>
  </wpt>
  <trk>
    <name>Track 1</name>
    <trkseg>
      <trkpt lat="41.0" lon="29.0"><ele>100</ele><time>2024-01-01T00:00:00Z</time></trkpt>
      <trkpt lat="41.5" lon="29.5"><ele>200</ele><time>2024-01-01T01:00:00Z</time></trkpt>
      <trkpt lat="42.0" lon="30.0"><ele>150</ele><time>2024-01-01T02:00:00Z</time></trkpt>
    </trkseg>
  </trk>
  <rte>
    <name>Route 1</name>
    <rtept lat="41.0" lon="29.0"><ele>100</ele></rtept>
    <rtept lat="42.0" lon="30.0"><ele>200</ele></rtept>
  </rte>
</gpx>`;

describe('parseGpx', () => {
  it('parses metadata', () => {
    const result = parseGpx(SIMPLE_GPX);
    expect(result.metadata?.name).toBe('Test Track');
    expect(result.metadata?.description).toBe('A test GPX file');
  });

  it('parses 2 waypoints', () => {
    const result = parseGpx(SIMPLE_GPX);
    expect(result.waypoints).toHaveLength(2);
  });

  it('parses waypoint with elevation', () => {
    const result = parseGpx(SIMPLE_GPX);
    const wpt = result.waypoints[0]!;
    expect(wpt.geometry.type).toBe('Point');
    expect(wpt.geometry.coordinates).toEqual([29, 41, 150]);
    expect(wpt.attributes['name']).toBe('Waypoint 1');
  });

  it('parses waypoint without elevation', () => {
    const result = parseGpx(SIMPLE_GPX);
    const wpt = result.waypoints[1]!;
    expect(wpt.geometry.coordinates).toEqual([30, 42]);
  });

  it('parses track as LineString', () => {
    const result = parseGpx(SIMPLE_GPX);
    expect(result.tracks).toHaveLength(1);
    const trk = result.tracks[0]!;
    expect(trk.geometry.type).toBe('LineString');
    const coords = trk.geometry.coordinates as number[][];
    expect(coords).toHaveLength(3);
    // ele + time → [lon, lat, ele, epoch]
    expect(coords[0]!.length).toBe(4);
    expect(coords[0]![0]).toBe(29);
    expect(coords[0]![1]).toBe(41);
    expect(coords[0]![2]).toBe(100);
  });

  it('parses route as LineString', () => {
    const result = parseGpx(SIMPLE_GPX);
    expect(result.routes).toHaveLength(1);
    const rte = result.routes[0]!;
    expect(rte.geometry.type).toBe('LineString');
    const coords = rte.geometry.coordinates as number[][];
    expect(coords).toHaveLength(2);
  });

  it('gpxToFeatures merges all features', () => {
    const result = parseGpx(SIMPLE_GPX);
    const all = gpxToFeatures(result);
    expect(all).toHaveLength(4); // 2 wpt + 1 trk + 1 rte
  });
});
