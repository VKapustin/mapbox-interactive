// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getSummary } from '@/app/api/map/aoi/summary/route';
import { GET as getLayer } from '@/app/api/map/layers/[id]/route';
import { GET as getClusters } from '@/app/api/map/layers/[id]/clusters/[z]/[x]/[y]/route';

const SAN_FRANCISCO = JSON.stringify({
  type: 'Polygon',
  coordinates: [[[-122.52, 37.70], [-122.35, 37.70], [-122.35, 37.84], [-122.52, 37.84], [-122.52, 37.70]]],
});
const requestWithAoi = (path: string, aoi: string) => new NextRequest(`http://localhost${path}?aoi=${encodeURIComponent(aoi)}`);

describe('area of interest in the map API', () => {
  describe('GET /api/map/aoi/summary', () => {
    it('returns each layer\'s count inside the area', async () => {
      const res = await getSummary(requestWithAoi('/api/map/aoi/summary', SAN_FRANCISCO));

      expect(res.status).toBe(200);
      const { layers } = await res.json();
      expect(layers['usa-landmarks'].count).toBeGreaterThan(0);
      expect(layers['usa-landmarks'].count).toBeLessThan(layers['usa-landmarks'].total);
      expect(layers['uk-landmarks'].count).toBe(0);
    });

    it('requires an area', async () => {
      expect((await getSummary(new NextRequest('http://localhost/api/map/aoi/summary'))).status).toBe(400);
    });

    it('rejects an area that isn\'t a polygon', async () => {
      expect((await getSummary(requestWithAoi('/api/map/aoi/summary', 'nope'))).status).toBe(400);
    });
  });

  describe('GET /api/map/layers/[id]?aoi=', () => {
    const get = (request: NextRequest) =>
      getLayer(request, { params: Promise.resolve({ id: 'usa-landmarks' }) } as RouteContext<'/api/map/layers/[id]'>);

    it('returns only the features inside the area', async () => {
      const all = await (await get(new NextRequest('http://localhost/api/map/layers/usa-landmarks'))).json();
      const inside = await (await get(requestWithAoi('/api/map/layers/usa-landmarks', SAN_FRANCISCO))).json();

      expect(inside.features.length).toBeGreaterThan(0);
      expect(inside.features.length).toBeLessThan(all.features.length);
    });

    it('rejects an area that isn\'t a polygon', async () => {
      expect((await get(requestWithAoi('/api/map/layers/usa-landmarks', '{"type":"Point"}'))).status).toBe(400);
    });
  });

  describe('GET /api/map/layers/[id]/clusters/[z]/[x]/[y]?aoi=', () => {
    const get = (request: NextRequest) =>
      getClusters(request, {
        params: Promise.resolve({ id: 'usa-landmarks', z: '3', x: '1', y: '3' }),
      } as RouteContext<'/api/map/layers/[id]/clusters/[z]/[x]/[y]'>);

    it('clusters only the features inside the area', async () => {
      const res = await get(requestWithAoi('/api/map/layers/usa-landmarks/clusters/3/1/3', SAN_FRANCISCO));
      const body = await res.json();

      expect(res.status).toBe(200);
      // The tile around San Francisco: without the area, a 16-landmark cluster.
      expect(body.features).toHaveLength(1);
      expect(body.features[0].properties.point_count).toBeLessThan(16);
    });

    it('rejects an area that isn\'t a polygon', async () => {
      expect((await get(requestWithAoi('/api/map/layers/usa-landmarks/clusters/3/1/3', 'nope'))).status).toBe(400);
    });
  });
});
