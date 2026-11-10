// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchWithTimeout, upstreamFailure } from '@/server/upstream';
import { UPSTREAM_TIMEOUT_MS } from '@/constant/constant';

describe('fetchWithTimeout', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('gives up with a TimeoutError when the upstream doesn\'t answer in time', async () => {
    // Never answers; rejects only when aborted, as fetch does.
    fetchMock.mockImplementation((_url, init: RequestInit) => new Promise((_, reject) => {
      init.signal!.addEventListener('abort', () => reject(init.signal!.reason));
    }));

    const result = fetchWithTimeout('https://upstream.test/x').catch((err: unknown) => err);
    await vi.advanceTimersByTimeAsync(UPSTREAM_TIMEOUT_MS);

    expect(await result).toMatchObject({ name: 'TimeoutError' });
  });

  it('stops timing once the response arrives, so a slow body isn\'t cut off', async () => {
    fetchMock.mockResolvedValue(new Response('tile'));

    await fetchWithTimeout('https://upstream.test/x');
    const { signal } = fetchMock.mock.calls[0][1] as RequestInit;
    await vi.advanceTimersByTimeAsync(UPSTREAM_TIMEOUT_MS * 2);

    expect(signal!.aborted).toBe(false);
  });

  it('stops the upstream request when the caller cancels, even after the response arrived', async () => {
    fetchMock.mockResolvedValue(new Response('tile'));
    const browser = new AbortController();

    await fetchWithTimeout('https://upstream.test/x', { signal: browser.signal });
    const { signal } = fetchMock.mock.calls[0][1] as RequestInit;
    expect(signal!.aborted).toBe(false);

    // E.g. OpenLayers dropping a tile it no longer needs, while its body streams.
    browser.abort();

    expect(signal!.aborted).toBe(true);
  });

  it('passes the request options on', async () => {
    fetchMock.mockResolvedValue(new Response(''));

    await fetchWithTimeout('https://upstream.test/x', { headers: { accept: 'application/json' } });

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ headers: { accept: 'application/json' } });
  });
});

describe('upstreamFailure', () => {
  it('is 504 for a timeout and 502 otherwise', () => {
    expect(upstreamFailure(new DOMException('slow', 'TimeoutError')).status).toBe(504);
    expect(upstreamFailure(new TypeError('fetch failed')).status).toBe(502);
  });
});
