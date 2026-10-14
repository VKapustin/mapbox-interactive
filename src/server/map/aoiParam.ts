import 'server-only';
import type { NextRequest } from 'next/server';
import {AOI_PARAM, type AoiPolygon, parseAoi} from '@/helpers/aoiHelpers';

// The `aoi` query parameter (a GeoJSON Polygon geometry in lon/lat): no
// parameter means no area, and a parameter that isn't a valid polygon is an
// error, so the request should be rejected rather than show everything.
export const readAoiParam = (request: NextRequest): { valid: true; aoi?: AoiPolygon } | { valid: false } => {
  const value = request.nextUrl.searchParams.get(AOI_PARAM);

  if (value === null) {
    return { valid: true };
  }

  const aoi = parseAoi(value);
  return aoi ? { valid: true, aoi } : { valid: false };
};
