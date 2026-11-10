// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/mapbox/[...path]/route';

const TOKEN = 'sk.test-token';
const ORIGIN = 'http://localhost:3000';

const get = (path: string, headers: Record<string, string> = { 'sec-fetch-site': 'same-origin' }) => {
  const url = new URL(`/api/mapbox/${path}`, ORIGIN);
  const segments = url.pathname.replace('/api/mapbox/', '').split('/').map(decodeURIComponent);

  return GET(
    new NextRequest(url, { headers }),
    { params: Promise.resolve({ path: segments }) } as RouteContext<'/api/mapbox/[...path]'>,
  );
};

const upstreamUrl = (fetchMock: ReturnType<typeof vi.fn>) => new URL(fetchMock.mock.calls[0][0]);

describe('GET /api/mapbox/[...path]', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv('MAPBOX_TOKEN', TOKEN);
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'max-age=60', 'x-internal': 'secret' },
    }));
  });

  describe('origin check', () => {
    it('rejects cross-site requests', async () => {
      const res = await get('styles/v1/mapbox/streets-v12', { 'sec-fetch-site': 'cross-site' });

      expect(res.status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects requests without any origin information', async () => {
      const res = await get('styles/v1/mapbox/streets-v12', {});

      expect(res.status).toBe(403);
    });

    it('rejects a foreign Referer', async () => {
      const res = await get('styles/v1/mapbox/streets-v12', { referer: 'https://evil.example/' });

      expect(res.status).toBe(403);
    });

    it('accepts a same-origin Referer when Sec-Fetch-Site is missing', async () => {
      const res = await get('styles/v1/mapbox/streets-v12', { referer: `${ORIGIN}/` });

      expect(res.status).toBe(200);
    });
  });

  describe('path allowlist', () => {
    it.each([
      'tokens/v2',
      'uploads/v1/mapbox',
      'search/geocode/v6/forward',
    ])('rejects %s', async (path) => {
      const res = await get(path);

      expect(res.status).toBe(404);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects path traversal out of an allowed prefix', async () => {
      // Built by hand: new URL() would already resolve the '..' segments, and the
      // route must reject them even if a request arrives with them intact.
      const res = await GET(
        new NextRequest(new URL('/api/mapbox/styles/v1/x', ORIGIN), { headers: { 'sec-fetch-site': 'same-origin' } }),
        {
          params: Promise.resolve({ path: ['styles', 'v1', '..', '..', 'tokens', 'v2'] }),
        } as RouteContext<'/api/mapbox/[...path]'>,
      );

      expect(res.status).toBe(404);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
      'styles/v1/mapbox/streets-v12',
      'v4/mapbox.mapbox-streets-v8/8/40/98.vector.pbf',
      'fonts/v1/mapbox/DIN Pro Medium/0-255.pbf',
      'search/searchbox/v1/forward',
      'styles/v1/mapbox/streets-v12/static/-122.2,37.6,6/32x32@2x',
    ])('forwards %s', async (path) => {
      const res = await get(path);

      expect(res.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledOnce();
    });
  });

  it('returns 500 when the server has no token', async () => {
    vi.stubEnv('MAPBOX_TOKEN', '');

    const res = await get('styles/v1/mapbox/streets-v12');

    expect(res.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('adds the server token and replaces any token sent by the client', async () => {
    await get('styles/v1/mapbox/streets-v12?access_token=client-token&fresh=true');

    const url = upstreamUrl(fetchMock);
    expect(url.origin).toBe('https://api.mapbox.com');
    expect(url.pathname).toBe('/styles/v1/mapbox/streets-v12');
    expect(url.searchParams.getAll('access_token')).toEqual([TOKEN]);
    expect(url.searchParams.get('fresh')).toBe('true');
  });

  it('keeps commas and @ literal in the upstream path', async () => {
    await get('v4/mapbox.mapbox-streets-v8,mapbox.mapbox-terrain-v2/8/40/98.vector.pbf');
    expect(upstreamUrl(fetchMock).pathname)
      .toBe('/v4/mapbox.mapbox-streets-v8,mapbox.mapbox-terrain-v2/8/40/98.vector.pbf');

    fetchMock.mockClear();
    await get('styles/v1/mapbox/streets-v12/sprite@2x.png');
    expect(upstreamUrl(fetchMock).pathname).toBe('/styles/v1/mapbox/streets-v12/sprite@2x.png');
  });

  it('passes through only the allowed response headers', async () => {
    const res = await get('styles/v1/mapbox/streets-v12');

    expect(res.headers.get('content-type')).toBe('application/json');
    expect(res.headers.get('cache-control')).toBe('max-age=60');
    expect(res.headers.get('x-internal')).toBeNull();
  });

  it('sets a default cache-control when upstream sends none', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));

    const res = await get('styles/v1/mapbox/streets-v12');

    expect(res.headers.get('cache-control')).toBe('public, max-age=3600');
  });

  it('does not forward upstream error bodies', async () => {
    fetchMock.mockResolvedValue(new Response(`Invalid token ${TOKEN}`, { status: 401, statusText: 'Unauthorized' }));

    const res = await get('styles/v1/mapbox/streets-v12');

    expect(res.status).toBe(401);
    expect(await res.text()).not.toContain(TOKEN);
  });

  it('stops the Mapbox request when the browser cancels, e.g. a tile no longer needed', async () => {
    const browser = new AbortController();
    const url = new URL('/api/mapbox/v4/mapbox.mapbox-streets-v8/3/1/2.vector.pbf', ORIGIN);

    await GET(
      new NextRequest(url, { headers: { 'sec-fetch-site': 'same-origin' }, signal: browser.signal }),
      { params: Promise.resolve({ path: ['v4', 'mapbox.mapbox-streets-v8', '3', '1', '2.vector.pbf'] }) } as RouteContext<'/api/mapbox/[...path]'>,
    );
    const { signal } = fetchMock.mock.calls[0][1] as RequestInit;
    browser.abort();

    expect(signal!.aborted).toBe(true);
  });

  describe('when Mapbox fails to answer', () => {
    it('gives up after a while with 504', async () => {
      fetchMock.mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError'));

      expect((await get('styles/v1/mapbox/streets-v12')).status).toBe(504);
      expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    });

    it('returns 502 when Mapbox can\'t be reached', async () => {
      fetchMock.mockRejectedValue(new TypeError('fetch failed'));

      expect((await get('styles/v1/mapbox/streets-v12')).status).toBe(502);
    });
  });
});
