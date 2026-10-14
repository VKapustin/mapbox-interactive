// The area of interest (AOI): a polygon the user draws on the map (useDraw),
// passed around as a GeoJSON Polygon geometry string in lon/lat. Used by the
// server (to filter landmarks) and the browser, so nothing here is server-only.
import {type LonLat, type LonLatExtent} from 'MapTypes';

// Rings of [lon, lat] positions: the outline first, then any holes.
export type AoiPolygon = LonLat[][];

// The query parameter that carries the AOI in API URLs (see withAoi, and
// readAoiParam on the server).
export const AOI_PARAM = 'aoi';

// Limits for an AOI. It travels in GET URLs (?aoi=), and servers reject request
// headers over about 16 KB (Node's default); URL-encoding grows the JSON by up
// to ~1.5x (brackets and commas become %XX), so 8,000 characters stays well
// under that. A polygon drawn by clicking is far smaller.
export const AOI_MAX_LENGTH = 8_000;
export const AOI_MAX_VERTICES = 300;

// Web Mercator's latitude limit.
const MAX_LAT = 85.0511287798;

const isPosition = (value: unknown): value is LonLat =>
  Array.isArray(value)
  && value.length >= 2
  && value.every((n) => typeof n === 'number' && Number.isFinite(n))
  // Shapes drawn across the antimeridian can go past ±180°.
  && Math.abs(value[0]) <= 540
  && Math.abs(value[1]) <= 90;

// A closed ring with at least three distinct corners.
const isRing = (value: unknown): value is LonLat[] =>
  Array.isArray(value) && value.length >= 4 && value.every(isPosition);

// Reads an AOI string; null when it isn't a valid GeoJSON Polygon geometry.
export const parseAoi = (value: string): AoiPolygon | null => {
  if (value.length > AOI_MAX_LENGTH) {
    return null;
  }

  let geometry: unknown;
  try {
    geometry = JSON.parse(value);
  } catch {
    return null;
  }

  const { type, coordinates } = (geometry ?? {}) as { type?: unknown; coordinates?: unknown };

  if (type !== 'Polygon' || !Array.isArray(coordinates) || coordinates.length === 0 || !coordinates.every(isRing)) {
    return null;
  }

  const rings = coordinates.map((ring) => ring.map(([lon, lat]) => [lon, lat] as LonLat));

  return rings.reduce((total, ring) => total + ring.length, 0) <= AOI_MAX_VERTICES ? rings : null;
};

// Web Mercator, in degrees-like units: the polygon is drawn on a Web Mercator
// map, where its edges are straight lines, so "inside" has to be decided there.
// (In plain lon/lat, a point near an edge could land on the other side.)
const toMercator = ([lon, lat]: LonLat): LonLat => {
  const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  return [lon, (Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360)) * 180) / Math.PI];
};

// The AOI's rings in Web Mercator, worked out once per parsed AOI: filtering
// tests every landmark against the same polygon.
const mercatorRings = new WeakMap<AoiPolygon, LonLat[][]>();

const toMercatorRings = (aoi: AoiPolygon): LonLat[][] => {
  let rings = mercatorRings.get(aoi);
  if (!rings) {
    rings = aoi.map((ring) => ring.map(toMercator));
    mercatorRings.set(aoi, rings);
  }
  return rings;
};

// Even-odd ray casting.
const isInRing = ([x, y]: LonLat, ring: LonLat[]): boolean => {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
};

// Whether a [lon, lat] point is inside the AOI (in its outline, not in a hole).
export const isInAoi = (aoi: AoiPolygon, point: LonLat): boolean => {
  const [outline, ...holes] = toMercatorRings(aoi);
  const [x, y] = toMercator(point);

  // The same place one world to the left or right, for shapes past ±180°.
  return [x, x - 360, x + 360].some((wrappedX) =>
    isInRing([wrappedX, y], outline) && !holes.some((hole) => isInRing([wrappedX, y], hole)));
};

// [west, south, east, north] around [lon, lat] points; undefined for none.
export const getLonLatExtent = (points: LonLat[]): LonLatExtent | undefined => {
  if (points.length === 0) {
    return undefined;
  }

  const lons = points.map(([lon]) => lon);
  const lats = points.map(([, lat]) => lat);

  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
};

// [west, south, east, north] around the AOI's outline.
export const getAoiExtent = (aoi: AoiPolygon): LonLatExtent => getLonLatExtent(aoi[0])!;

// Adds the AOI to an API URL as `?aoi=` (or `&aoi=`); the URL as it is without one.
export const withAoi = (url: string, aoi?: string | null): string =>
  aoi ? `${url}${url.includes('?') ? '&' : '?'}${AOI_PARAM}=${encodeURIComponent(aoi)}` : url;
