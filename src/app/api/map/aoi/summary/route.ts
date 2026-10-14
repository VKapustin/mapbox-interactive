import type { NextRequest } from 'next/server';
import {getAoiSummary} from '@/server/map/clusters';
import {readAoiParam} from '@/server/map/aoiParam';

// For the area of interest in `?aoi=` (required): how many of each layer's
// features are inside it, out of how many, and their bounding box.
export async function GET(request: NextRequest) {
  const aoiParam = readAoiParam(request);

  if (!aoiParam.valid || !aoiParam.aoi) {
    return new Response('Bad aoi', { status: 400 });
  }

  return Response.json(await getAoiSummary(aoiParam.aoi), {
    headers: { 'cache-control': 'public, max-age=300, s-maxage=86400' },
  });
}
