import type { NextRequest } from 'next/server';
import {getLayerFeatures} from '@/server/map/clusters';
import {readAoiParam} from '@/server/map/aoiParam';

// A layer's features as GeoJSON; only those inside the area of interest when
// `?aoi=` is given.
export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/map/layers/[id]'>,
) {
  const { id } = await ctx.params;
  const aoiParam = readAoiParam(request);

  if (!aoiParam.valid) {
    return new Response('Bad aoi', { status: 400 });
  }

  const data = await getLayerFeatures(id, aoiParam.aoi);

  if (!data) {
    return new Response('Not found', { status: 404 });
  }

  return Response.json(data, {
    headers: { 'content-type': 'application/geo+json' },
  });
}
