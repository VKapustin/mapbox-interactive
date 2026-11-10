import 'server-only';
import {UPSTREAM_TIMEOUT_MS} from '@/constant/constant';

// fetch() for our API routes' requests to Mapbox and Wikipedia, giving up if
// the upstream hasn't started answering within UPSTREAM_TIMEOUT_MS. Only the
// wait for the response is timed: once it arrives the timer is cleared, so a
// body streamed on to a slow browser (e.g. a large tile) isn't cut off.
// Pass the incoming request's signal as `init.signal` too: when the browser
// cancels (OpenLayers dropping tiles on zoom, a closed tab), the upstream
// request stops as well, body included.
export const fetchWithTimeout = async (url: string | URL, init?: RequestInit): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException('The upstream took too long to answer.', 'TimeoutError')),
    UPSTREAM_TIMEOUT_MS,
  );

  try {
    const signal = init?.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal;
    return await fetch(url, { ...init, signal });
  } finally {
    clearTimeout(timer);
  }
};

// The response for an upstream that couldn't be fetched: 504 if it took too
// long, 502 if it couldn't be reached.
export const upstreamFailure = (err: unknown): Response => {
  const timedOut = err instanceof Error && err.name === 'TimeoutError';
  return new Response(timedOut ? 'Gateway timeout' : 'Bad gateway', { status: timedOut ? 504 : 502 });
};
