// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/map/layers/[id]/clusters/[z]/[x]/[y]/route';

const get = (id: string, z: string, x: string, y: string) =>
  GET(
    new NextRequest(`http://localhost/api/map/layers/${id}/clusters/${z}/${x}/${y}`),
    { params: Promise.resolve({ id, z, x, y }) } as RouteContext<'/api/map/layers/[id]/clusters/[z]/[x]/[y]'>,
  );

describe('GET /api/map/layers/[id]/clusters/[z]/[x]/[y]', () => {
  it('returns the tile as cacheable GeoJSON', async () => {
    const res = await get('usa-landmarks', '3', '1', '3');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/geo+json');
    expect(res.headers.get('cache-control')).toContain('s-maxage');
    const body = await res.json();
    expect(body.type).toBe('FeatureCollection');
    // The tile around San Francisco holds the 16 Bay Area landmarks as one cluster.
    expect(body.features.map((feature: { properties: { point_count?: number } }) => feature.properties.point_count)).toContain(16);
  });

  it.each([
    ['a non-numeric zoom', 'z', '0', '0'],
    ['a negative coordinate', '3', '-1', '0'],
    ['x outside the zoom level', '3', '8', '0'],
    ['y outside the zoom level', '3', '0', '8'],
    ['a zoom beyond 22', '23', '0', '0'],
    ['a fractional zoom', '3.5', '0', '0'],
  ])('rejects %s', async (_, z, x, y) => {
    expect((await get('usa-landmarks', z, x, y)).status).toBe(400);
  });

  it('returns 404 for an unknown layer', async () => {
    expect((await get('nope', '3', '1', '3')).status).toBe(404);
  });
});
