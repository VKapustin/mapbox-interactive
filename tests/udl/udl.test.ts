import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { anySignal, udl, UdlError } from '@/udl/udl';
import { UDL_MAX_RETRY_WAIT_MS, UDL_TIMEOUT_MS } from '@/constant/constant';

const json = (body: unknown, init?: ResponseInit) => Response.json(body, init);
const throttled = (retryAfterSeconds?: number) =>
  new Response('', {
    status: 429,
    headers: retryAfterSeconds === undefined ? undefined : { 'retry-after': String(retryAfterSeconds) },
  });

describe('udl', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getWikipediaSummary', () => {
    it('asks our server route for the encoded title and returns the summary', async () => {
      const summary = { title: 'Main Quad', extract: 'Text.', url: 'https://en.wikipedia.org/wiki/Main_Quad' };
      fetchMock.mockResolvedValue(json(summary));

      expect(await udl.getWikipediaSummary('Main_Quad_(Stanford_University)')).toEqual(summary);
      expect(fetchMock.mock.calls[0][0]).toBe('/api/wikipedia/summary/Main_Quad_(Stanford_University)');
    });

    it('encodes titles that need it', async () => {
      fetchMock.mockResolvedValue(json({}));

      await udl.getWikipediaSummary('Mission_San_Francisco_de_Asís');

      expect(fetchMock.mock.calls[0][0]).toBe('/api/wikipedia/summary/Mission_San_Francisco_de_As%C3%ADs');
    });
  });

  describe('searchPlaces', () => {
    it('asks the Mapbox search proxy with the given parameters', async () => {
      fetchMock.mockResolvedValue(json({ features: [] }));

      expect(await udl.searchPlaces(new URLSearchParams({ q: 'Coit' }))).toEqual({ features: [] });
      expect(fetchMock.mock.calls[0][0]).toBe('/api/mapbox/search/searchbox/v1/forward?q=Coit');
    });
  });

  describe('getLayerClusters', () => {
    it('asks for one tile of a layer\'s clusters', async () => {
      fetchMock.mockResolvedValue(json({ type: 'FeatureCollection', features: [] }));

      expect(await udl.getLayerClusters('france-landmarks', 12, 2074, 1409)).toEqual({ type: 'FeatureCollection', features: [] });
      expect(fetchMock.mock.calls[0][0]).toBe('/api/map/layers/france-landmarks/clusters/12/2074/1409');
    });

    it('adds the area of interest, encoded', async () => {
      fetchMock.mockResolvedValue(json({ type: 'FeatureCollection', features: [] }));
      const aoi = '{"type":"Polygon","coordinates":[[[2,48],[3,48],[2.5,49],[2,48]]]}';

      await udl.getLayerClusters('france-landmarks', 3, 4, 2, aoi);

      expect(fetchMock.mock.calls[0][0]).toBe(`/api/map/layers/france-landmarks/clusters/3/4/2?aoi=${encodeURIComponent(aoi)}`);
    });
  });

  describe('getAoiSummary', () => {
    it('asks for each layer\'s count inside the area of interest', async () => {
      const summary = { layers: { 'france-landmarks': { count: 1, total: 11, extent: [2.29, 48.85, 2.29, 48.85] } } };
      fetchMock.mockResolvedValue(json(summary));
      const aoi = '{"type":"Polygon","coordinates":[[[2,48],[3,48],[2.5,49],[2,48]]]}';

      expect(await udl.getAoiSummary(aoi)).toEqual(summary);
      expect(fetchMock.mock.calls[0][0]).toBe(`/api/map/aoi/summary?aoi=${encodeURIComponent(aoi)}`);
    });
  });

  describe('errors', () => {
    it('throws a UdlError with the status', async () => {
      fetchMock.mockResolvedValue(new Response('', { status: 404 }));

      const error = await udl.getWikipediaSummary('Nope').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(UdlError);
      expect(error).toMatchObject({ name: 'UdlError', status: 404, message: 'Request failed: 404' });
    });

    it('fails fast on 429 with a long Retry-After, and reports it', async () => {
      fetchMock.mockResolvedValue(throttled(60));

      await expect(udl.getWikipediaSummary('Coit_Tower')).rejects.toMatchObject({ status: 429, retryAfterMs: 60_000 });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not retry a 429 without Retry-After', async () => {
      fetchMock.mockResolvedValue(throttled());

      await expect(udl.getWikipediaSummary('Coit_Tower')).rejects.toMatchObject({ status: 429 });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('retry', () => {
    it('waits and retries once on 429 with a short Retry-After', async () => {
      vi.useFakeTimers();
      fetchMock.mockResolvedValueOnce(throttled(1)).mockResolvedValueOnce(json({ title: 'Coit Tower' }));

      const pending = udl.getWikipediaSummary('Coit_Tower');
      await vi.advanceTimersByTimeAsync(999);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);

      expect(await pending).toEqual({ title: 'Coit Tower' });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('retries only once', async () => {
      vi.useFakeTimers();
      fetchMock.mockResolvedValue(throttled(1));

      const pending = udl.getWikipediaSummary('Coit_Tower').catch((e: unknown) => e);
      await vi.advanceTimersByTimeAsync(UDL_MAX_RETRY_WAIT_MS);

      expect(await pending).toMatchObject({ status: 429 });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('stops waiting when the caller aborts', async () => {
      fetchMock.mockResolvedValue(throttled(1));
      const controller = new AbortController();

      const pending = udl.getWikipediaSummary('Coit_Tower', controller.signal);
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      controller.abort();

      await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('signals', () => {
    it('passes a signal that follows the caller\'s', async () => {
      fetchMock.mockResolvedValue(json({}));
      const controller = new AbortController();

      await udl.getWikipediaSummary('Coit_Tower', controller.signal);
      const { signal } = fetchMock.mock.calls[0][1] as RequestInit;
      controller.abort();

      expect(signal!.aborted).toBe(true);
    });

    it('times out requests that take too long', async () => {
      // AbortSignal.timeout runs on the runtime's clock, not fake timers, so stand in for it.
      const timeout = new AbortController();
      const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal);
      fetchMock.mockResolvedValue(json({}));

      await udl.getWikipediaSummary('Coit_Tower', new AbortController().signal);
      const { signal } = fetchMock.mock.calls[0][1] as RequestInit;
      expect(timeoutSpy).toHaveBeenCalledWith(UDL_TIMEOUT_MS);
      expect(signal!.aborted).toBe(false);

      timeout.abort(new DOMException('Timed out', 'TimeoutError'));

      expect(signal!.aborted).toBe(true);
      expect((signal!.reason as Error).name).toBe('TimeoutError');
    });

    it('works in browsers without AbortSignal.any (before Safari 17.4)', async () => {
      vi.spyOn(AbortSignal, 'any').mockImplementation(() => { throw new TypeError('AbortSignal.any is not a function'); });
      fetchMock.mockResolvedValue(json({ features: [] }));
      const controller = new AbortController();

      expect(await udl.searchPlaces(new URLSearchParams({ q: 'Coit' }), controller.signal)).toEqual({ features: [] });
      const { signal } = fetchMock.mock.calls[0][1] as RequestInit;
      controller.abort();
      expect(signal!.aborted).toBe(true);
    });
  });

  describe('anySignal', () => {
    it('aborts when any of the signals does, with that one\'s reason', () => {
      const first = new AbortController();
      const second = new AbortController();
      const combined = anySignal([first.signal, second.signal]);

      expect(combined.aborted).toBe(false);
      second.abort('second');

      expect(combined.aborted).toBe(true);
      expect(combined.reason).toBe('second');
    });

    it('is aborted right away when a signal already is', () => {
      const combined = anySignal([new AbortController().signal, AbortSignal.abort('done')]);

      expect(combined.aborted).toBe(true);
      expect(combined.reason).toBe('done');
    });

    it('stops listening to the others once aborted, so they don\'t keep it alive', () => {
      const first = new AbortController();
      const second = new AbortController();
      const remove = vi.spyOn(second.signal, 'removeEventListener');
      const combined = anySignal([first.signal, second.signal]);

      first.abort();

      expect(combined.aborted).toBe(true);
      expect(remove).toHaveBeenCalledWith('abort', expect.any(Function), expect.anything());
    });
  });
});
