import { describe, expect, it } from 'vitest';
import { AOI_MAX_LENGTH, AOI_MAX_VERTICES, getAoiExtent, isInAoi, parseAoi, withAoi } from '@/helpers/aoiHelpers';

const polygon = (...rings: [number, number][][]) => JSON.stringify({ type: 'Polygon', coordinates: rings });
// Roughly Paris.
const PARIS: [number, number][] = [[2.25, 48.81], [2.42, 48.81], [2.42, 48.91], [2.25, 48.91], [2.25, 48.81]];

describe('parseAoi', () => {
  it('reads a GeoJSON Polygon geometry into rings of [lon, lat]', () => {
    expect(parseAoi(polygon(PARIS))).toEqual([PARIS]);
  });

  it('keeps only lon and lat when positions carry more', () => {
    expect(parseAoi(polygon(PARIS.map(([lon, lat]) => [lon, lat, 35] as never)))).toEqual([PARIS]);
  });

  it.each([
    ['not JSON', 'nope'],
    ['JSON null', 'null'],
    ['another geometry type', JSON.stringify({ type: 'Point', coordinates: [2.3, 48.8] })],
    ['no rings', polygon()],
    ['a ring with fewer than four positions', polygon(PARIS.slice(0, 3))],
    ['a position that isn\'t numbers', JSON.stringify({ type: 'Polygon', coordinates: [[['a', 1], [2, 3], [4, 5], ['a', 1]]] })],
    ['a latitude past the pole', polygon([[0, 0], [1, 0], [1, 91], [0, 0]])],
  ])('rejects %s', (_, value) => {
    expect(parseAoi(value)).toBeNull();
  });

  it('accepts the largest AOI only if it still fits in a request URL', () => {
    // As many corners as allowed, each with 6 decimals: the biggest a drawn AOI gets.
    const corners = Array.from({ length: AOI_MAX_VERTICES - 1 }, (_, i) => {
      const angle = (i / (AOI_MAX_VERTICES - 1)) * 2 * Math.PI;
      return [Number((2.3 + 0.123456 * Math.cos(angle)).toFixed(6)), Number((48.8 + 0.123456 * Math.sin(angle)).toFixed(6))] as [number, number];
    });
    const value = polygon([...corners, corners[0]]);

    expect(parseAoi(value)).not.toBeNull();
    // Servers reject request headers over ~16 KB (Node's default); leave room for the rest.
    expect(withAoi('/api/map/layers/usa-landmarks/clusters/22/1234567/1234567', value).length).toBeLessThan(13_000);
  });

  it('rejects an AOI that is too long or has too many corners', () => {
    expect(parseAoi(' '.repeat(AOI_MAX_LENGTH + 1))).toBeNull();

    const corners = Array.from({ length: AOI_MAX_VERTICES }, (_, i) => [i / 10000, (i % 2) / 10000] as [number, number]);
    expect(parseAoi(polygon([...corners, corners[0]]))).toBeNull();
  });
});

describe('isInAoi', () => {
  const paris = parseAoi(polygon(PARIS))!;

  it('tells points inside from points outside', () => {
    // The Eiffel Tower, then London.
    expect(isInAoi(paris, [2.2945, 48.8584])).toBe(true);
    expect(isInAoi(paris, [-0.1276, 51.5072])).toBe(false);
  });

  it('leaves out points in a hole', () => {
    const hole: [number, number][] = [[2.28, 48.84], [2.31, 48.84], [2.31, 48.87], [2.28, 48.87], [2.28, 48.84]];
    const withHole = parseAoi(polygon(PARIS, hole))!;

    expect(isInAoi(withHole, [2.2945, 48.8584])).toBe(false);
    expect(isInAoi(withHole, [2.35, 48.86])).toBe(true);
  });

  it('decides near an edge as it looks on the (Web Mercator) map', () => {
    // A long edge from 0°N to 70°N: straight on the map, it runs through
    // [5, 49.1]° (half-way in Mercator y), well north of the lon/lat midpoint 35°N.
    const triangle = parseAoi(polygon([[0, 0], [10, 70], [10, 0], [0, 0]]))!;

    // Just south-east of that edge on the map, so inside; a lon/lat
    // calculation would put the edge at 35°N and this point outside.
    expect(isInAoi(triangle, [5.2, 45])).toBe(true);
  });

  it('handles a shape drawn across the antimeridian', () => {
    // Fiji-ish, drawn from 177°E to 183°E (= 177°W).
    const acrossDateLine = parseAoi(polygon([[177, -19], [183, -19], [183, -15], [177, -15], [177, -19]]))!;

    expect(isInAoi(acrossDateLine, [178.4, -18.1])).toBe(true);
    expect(isInAoi(acrossDateLine, [-178.5, -17])).toBe(true);
    expect(isInAoi(acrossDateLine, [-170, -17])).toBe(false);
  });
});

describe('getAoiExtent', () => {
  it('is the bounding box of the outline', () => {
    expect(getAoiExtent(parseAoi(polygon(PARIS))!)).toEqual([2.25, 48.81, 2.42, 48.91]);
  });
});

describe('withAoi', () => {
  const AOI = polygon(PARIS);

  it('adds the AOI as an encoded query parameter', () => {
    expect(withAoi('/api/map/aoi/summary', AOI)).toBe(`/api/map/aoi/summary?aoi=${encodeURIComponent(AOI)}`);
  });

  it('appends to a URL that already has a query', () => {
    expect(withAoi('/api/x?a=1', AOI)).toBe(`/api/x?a=1&aoi=${encodeURIComponent(AOI)}`);
  });

  it('leaves the URL alone without an AOI', () => {
    expect(withAoi('/api/map/layers/uk-landmarks', null)).toBe('/api/map/layers/uk-landmarks');
    expect(withAoi('/api/map/layers/uk-landmarks')).toBe('/api/map/layers/uk-landmarks');
  });

  it('round-trips through parseAoi', () => {
    const value = new URL(withAoi('/api/map/aoi/summary', AOI), 'http://localhost').searchParams.get('aoi')!;

    expect(parseAoi(value)).toEqual([PARIS]);
  });
});
