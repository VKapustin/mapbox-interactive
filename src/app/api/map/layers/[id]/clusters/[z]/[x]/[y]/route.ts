import type { NextRequest } from 'next/server';
import {getLayerClusters} from '@/server/map/clusters';
import {readAoiParam} from '@/server/map/aoiParam';

const MAX_ZOOM = 22;

const parseTile = (z: string, x: string, y: string) => {
  const [zoom, tileX, tileY] = [z, x, y].map((value) => (/^\d+$/.test(value) ? Number(value) : NaN));
  const tiles = 2 ** zoom;

  return zoom <= MAX_ZOOM && tileX < tiles && tileY < tiles ? { zoom, tileX, tileY } : undefined;
};

// One map tile of a clustered layer, counting only the features inside the
// area of interest when `?aoi=` is given. A tile's contents only change with
// the data (and the AOI, which is part of the URL), so browsers and CDNs can cache it.
export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/map/layers/[id]/clusters/[z]/[x]/[y]'>,
) {
  const { id, z, x, y } = await ctx.params;
  const tile = parseTile(z, x, y);

  if (!tile) {
    return new Response('Bad tile', { status: 400 });
  }

  const aoiParam = readAoiParam(request);

  if (!aoiParam.valid) {
    return new Response('Bad aoi', { status: 400 });
  }

  const clusters = await getLayerClusters(id, tile.zoom, tile.tileX, tile.tileY, aoiParam.aoi);

  if (!clusters) {
    return new Response('Not found', { status: 404 });
  }

  return Response.json(clusters, {
    headers: {
      'content-type': 'application/geo+json',
      'cache-control': 'public, max-age=300, s-maxage=86400',
    },
  });
}
