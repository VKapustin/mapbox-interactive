import {getMapConfig} from '@/server/map/mapConfig';

export async function GET() {
  return Response.json(await getMapConfig());
}
