import { describe, it, expect } from 'vitest';
import { parseKml } from './KmlParser.js';

const SIMPLE_KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Test Document</name>
    <description>Test description</description>
    <Style id="redLine">
      <LineStyle><color>ff0000ff</color><width>3</width></LineStyle>
    </Style>
    <Style id="bluePoly">
      <PolyStyle><color>7fff0000</color></PolyStyle>
    </Style>
    <Placemark id="pm1">
      <name>Test Point</name>
      <description>A test point</description>
      <styleUrl>#redLine</styleUrl>
      <Point><coordinates>29.0,41.0,100</coordinates></Point>
    </Placemark>
    <Placemark id="pm2">
      <name>Test Line</name>
      <LineString>
        <coordinates>
          29.0,41.0,0
          30.0,42.0,0
          31.0,41.5,0
        </coordinates>
      </LineString>
    </Placemark>
    <Placemark id="pm3">
      <name>Test Polygon</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>29,41 30,41 30,42 29,42 29,41</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;

describe('parseKml', () => {
  it('parses document metadata', () => {
    const result = parseKml(SIMPLE_KML);
    expect(result.name).toBe('Test Document');
    expect(result.description).toBe('Test description');
  });

  it('parses 3 placemarks', () => {
    const result = parseKml(SIMPLE_KML);
    expect(result.features).toHaveLength(3);
  });

  it('parses Point geometry with altitude', () => {
    const result = parseKml(SIMPLE_KML);
    const point = result.features[0]!;
    expect(point.geometry.type).toBe('Point');
    expect(point.geometry.coordinates).toEqual([29, 41, 100]);
    expect(point.attributes['name']).toBe('Test Point');
    expect(point.id).toBe('pm1');
  });

  it('parses LineString geometry', () => {
    const result = parseKml(SIMPLE_KML);
    const line = result.features[1]!;
    expect(line.geometry.type).toBe('LineString');
    expect((line.geometry.coordinates as number[][]).length).toBe(3);
    expect((line.geometry.coordinates as number[][])[0]).toEqual([29, 41, 0]);
  });

  it('parses Polygon geometry', () => {
    const result = parseKml(SIMPLE_KML);
    const poly = result.features[2]!;
    expect(poly.geometry.type).toBe('Polygon');
    const ring = (poly.geometry.coordinates as number[][][])[0]!;
    expect(ring.length).toBe(5); // closed ring
  });

  it('parses styles', () => {
    const result = parseKml(SIMPLE_KML);
    expect(result.styles.size).toBe(2);
    const redLine = result.styles.get('redLine')!;
    expect(redLine.lineColor).toEqual([255, 0, 0, 255]); // aabbggrr → rgba
    expect(redLine.lineWidth).toBe(3);
  });

  it('attaches styleUrl to feature attributes', () => {
    const result = parseKml(SIMPLE_KML);
    expect(result.features[0]!.attributes['styleUrl']).toBe('redLine');
  });

  it('handles ExtendedData', () => {
    const kml = `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2">
      <Placemark><name>ED</name>
        <ExtendedData><Data name="population"><value>1000</value></Data></ExtendedData>
        <Point><coordinates>0,0</coordinates></Point>
      </Placemark></kml>`;
    const result = parseKml(kml);
    expect(result.features[0]!.attributes['population']).toBe('1000');
  });

  it('handles minimal KML without placemarks', () => {
    const result = parseKml('<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document></Document></kml>');
    expect(result.features).toHaveLength(0);
  });
});
