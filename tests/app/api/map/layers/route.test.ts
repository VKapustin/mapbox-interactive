// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/map/layers/[id]/route';

const get = (id: string) =>
  GET(
    new NextRequest(`http://localhost/api/map/layers/${id}`),
    { params: Promise.resolve({ id }) } as RouteContext<'/api/map/layers/[id]'>,
  );

describe('GET /api/map/layers/[id]', () => {
  it('returns the layer GeoJSON', async () => {
    const res = await get('usa-landmarks');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/geo+json');
    expect((await res.json()).type).toBe('FeatureCollection');
  });

  it('returns 404 for an unknown layer', async () => {
    const res = await get('does-not-exist');

    expect(res.status).toBe(404);
  });
});
