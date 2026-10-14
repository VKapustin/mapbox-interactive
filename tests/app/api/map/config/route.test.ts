// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/map/config/route';
import { getMapConfig } from '@/server/map/mapConfig';

describe('GET /api/map/config', () => {
  it('returns the map config as JSON', async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual(await getMapConfig());
  });

  it('never exposes a Mapbox token', async () => {
    const body = await (await GET()).text();

    expect(body).not.toMatch(/access_token|\b[ps]k\.[A-Za-z0-9]/);
  });
});
