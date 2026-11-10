import {API, UDL_MAX_RETRY_WAIT_MS, UDL_TIMEOUT_MS} from '@/constant/constant';
import {type SearchFeature} from 'SearchTypes';
import {type WikipediaSummary} from 'WikipediaTypes';
import {type AoiSummary, type GeoJSONFeatureCollection} from 'MapTypes';

// UDL ("universal data link"): the single entry point for requests our own
// browser code makes to our API. Each call returns typed data or throws.
//
// Not here: requests OpenLayers makes itself (map styles, tiles and data
// layers, routed by toProxyRequest), server-side requests in the API routes,
// and images.

// A request that reached the server and failed. Aborts and timeouts are thrown
// as the browser's own AbortError / TimeoutError instead.
export class UdlError extends Error {
  constructor(readonly status: number, readonly retryAfterMs?: number) {
    super(`Request failed: ${status}`);
    this.name = 'UdlError';
  }
}

// A signal that aborts as soon as any of `signals` does, with that one's
// reason. Like AbortSignal.any, which this browser code can't rely on: it's
// missing before Safari 17.4 (iOS 17.4), Chrome 116 and Firefox 124.
export const anySignal = (signals: AbortSignal[]): AbortSignal => {
  const controller = new AbortController();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    // Removed once the combined signal aborts, so nothing is kept alive.
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true, signal: controller.signal });
  }

  return controller.signal;
};

// The caller's signal (e.g. a component unmounting), plus a timeout.
const withTimeout = (signal?: AbortSignal): AbortSignal => {
  const timeout = AbortSignal.timeout(UDL_TIMEOUT_MS);
  return signal ? anySignal([signal, timeout]) : timeout;
};

const getRetryAfterMs = (res: Response): number | undefined => {
  const seconds = Number(res.headers.get('retry-after'));
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined;
};

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }

    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });

const request = async <T>(url: string, callerSignal?: AbortSignal): Promise<T> => {
  const signal = withTimeout(callerSignal);
  let res = await fetch(url, { signal });

  // Throttled with a short wait: retry once, as asked. Longer waits fail fast.
  const retryAfterMs = res.status === 429 ? getRetryAfterMs(res) : undefined;
  if (retryAfterMs !== undefined && retryAfterMs <= UDL_MAX_RETRY_WAIT_MS) {
    await res.body?.cancel();
    await wait(retryAfterMs, signal);
    res = await fetch(url, { signal });
  }

  if (!res.ok) {
    throw new UdlError(res.status, getRetryAfterMs(res));
  }

  return res.json() as Promise<T>;
};

export const udl = {
  // Mapbox Search Box suggestions, through our Mapbox proxy.
  searchPlaces: (params: URLSearchParams, signal?: AbortSignal) =>
    request<{ features: SearchFeature[] }>(`${API.search}?${params}`, signal),

  // A Wikipedia article summary, through our server (the browser never contacts Wikipedia).
  getWikipediaSummary: (title: string, signal?: AbortSignal) =>
    request<WikipediaSummary>(API.wikipediaSummary(title), signal),

  // One map tile of a clustered layer (GeoJSON in longitude / latitude); only
  // the features inside the area of interest, if given.
  getLayerClusters: (layerId: string, z: number, x: number, y: number, aoi?: string | null, signal?: AbortSignal) =>
    request<GeoJSONFeatureCollection>(API.layerClusters(layerId, z, x, y, aoi), signal),

  // How many of each layer's features are inside an area of interest.
  getAoiSummary: (aoi: string, signal?: AbortSignal) =>
    request<AoiSummary>(API.aoiSummary(aoi), signal),
};
