// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/wikipedia/summary/[title]/route';
import { WIKIMEDIA_USER_AGENT } from '@/server/wikipedia/wikipedia';
import { UPSTREAM_TIMEOUT_MS } from '@/constant/constant';

const get = (title: string) =>
  GET(
    new NextRequest(`http://localhost/api/wikipedia/summary/${encodeURIComponent(title)}`),
    { params: Promise.resolve({ title }) } as RouteContext<'/api/wikipedia/summary/[title]'>,
  );

describe('GET /api/wikipedia/summary/[title]', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(Response.json({
      title: 'Coit Tower',
      extract: 'A tower.',
      content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Coit_Tower' } },
      thumbnail: { source: 'https://upload.wikimedia.org/x.jpg' },
    }));
  });

  it('forwards to the Wikipedia REST API with our User-Agent', async () => {
    await get('Main_Quad_(Stanford_University)');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://en.wikipedia.org/api/rest_v1/page/summary/Main_Quad_(Stanford_University)');
    expect(init.headers['user-agent']).toBe(WIKIMEDIA_USER_AGENT);
  });

  it('returns only the title, extract and article URL', async () => {
    const res = await get('Coit_Tower');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      title: 'Coit Tower',
      extract: 'A tower.',
      url: 'https://en.wikipedia.org/wiki/Coit_Tower',
    });
    expect(res.headers.get('cache-control')).toContain('max-age');
  });

  it('refuses titles that aren\'t in the map data', async () => {
    const res = await get('Some_Other_Article');

    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes Wikimedia throttling on as 429 with Retry-After', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 429, headers: { 'retry-after': '2' } }));

    const res = await get('Coit_Tower');

    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('2');
  });

  it('reports a Wikipedia failure as a bad gateway', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 503 }));

    expect((await get('Coit_Tower')).status).toBe(502);
  });

  describe('when Wikipedia fails to answer', () => {
    it('gives up after a while with 504', async () => {
      fetchMock.mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError'));

      expect((await get('Coit_Tower')).status).toBe(504);
      expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    });

    it('gives up with 504 when the body stalls after the headers', async () => {
      // The route's timeout, made controllable (AbortSignal.timeout runs on the real clock).
      const timeout = new AbortController();
      const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal);
      // Headers arrive at once; the body never finishes unless the request is aborted.
      fetchMock.mockImplementation(async (_url: string, init: RequestInit) => new Response(new ReadableStream({
        start(controller) {
          init.signal!.addEventListener('abort', () => controller.error(init.signal!.reason));
        },
      }), { headers: { 'content-type': 'application/json' } }));

      const response = get('Coit_Tower');
      // Let the headers arrive and the body read start, then time out.
      await new Promise((resolve) => setTimeout(resolve, 0));
      timeout.abort(new DOMException('The operation timed out.', 'TimeoutError'));

      expect(timeoutSpy).toHaveBeenCalledWith(UPSTREAM_TIMEOUT_MS);
      expect((await response).status).toBe(504);
    });

    it('returns 502 when Wikipedia sends something that isn\'t JSON', async () => {
      fetchMock.mockResolvedValue(new Response('<html>oops</html>'));

      expect((await get('Coit_Tower')).status).toBe(502);
    });

    it('returns 502 when Wikipedia can\'t be reached', async () => {
      fetchMock.mockRejectedValue(new TypeError('fetch failed'));

      expect((await get('Coit_Tower')).status).toBe(502);
    });
  });
});
