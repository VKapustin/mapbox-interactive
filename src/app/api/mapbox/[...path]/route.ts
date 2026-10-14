import type { NextRequest } from 'next/server';
import { UPSTREAM_TIMEOUT_MS } from '@/constant/constant';

const MAPBOX_API = 'https://api.mapbox.com';

// Only the read-only endpoints the map and search need. Anything else (tokens,
// uploads, datasets, ...) is rejected so the proxy can't be used as an open relay.
const ALLOWED_PREFIXES = ['styles/v1/', 'v4/', 'fonts/v1/', 'search/searchbox/v1/forward'];

const PASSTHROUGH_HEADERS = ['content-type', 'cache-control', 'etag', 'last-modified'];

const isSameOrigin = (request: NextRequest): boolean => {
  const fetchSite = request.headers.get('sec-fetch-site');
  
  if (fetchSite) { 
    return fetchSite === 'same-origin';
  }

  const source = request.headers.get('origin') ?? request.headers.get('referer');
  
  if (!source) { 
    return false;
  }
  
  try {
    return new URL(source).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/mapbox/[...path]'>,
) {
  if (!isSameOrigin(request)) {
    return new Response('Forbidden', { status: 403 });
  }

  const { path } = await ctx.params;
  
  // Keep ',' (multi-tileset ids) and '@' (@2x sprites) literal, encode the rest.
  const pathname = path
    .map((s) => encodeURIComponent(s).replace(/%2C/g, ',').replace(/%40/g, '@'))
    .join('/');
  
  if (path.includes('..') || !ALLOWED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return new Response('Not found', { status: 404 });
  }

  const token = process.env.MAPBOX_TOKEN;
  
  if (!token) {
    return new Response('MAPBOX_TOKEN is not configured', { status: 500 });
  }

  const upstream = new URL(`${MAPBOX_API}/${pathname}`);
  
  request.nextUrl.searchParams.forEach((value, key) => {
    if (key !== 'access_token') upstream.searchParams.append(key, value);
  });
  
  upstream.searchParams.set('access_token', token);

  let res: Response;
  try {
    res = await fetch(upstream, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
  } catch (err) {
    // Mapbox too slow (504) or unreachable (502).
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    return new Response(timedOut ? 'Gateway timeout' : 'Bad gateway', { status: timedOut ? 504 : 502 });
  }
  
  if (!res.ok) {
    // Don't forward upstream error bodies; they may echo request details.
    return new Response(res.statusText, { status: res.status });
  }

  const headers = new Headers();
  
  for (const name of PASSTHROUGH_HEADERS) {
    const value = res.headers.get(name);
    
    if (value) {
      headers.set(name, value)
    }
  }
  
  if (!headers.has('cache-control')) {
    headers.set('cache-control', 'public, max-age=3600');
  }

  return new Response(res.body, { status: res.status, headers });
}