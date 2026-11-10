import type { NextRequest } from 'next/server';
import {getAllowedWikipediaTitles, WIKIMEDIA_USER_AGENT} from '@/server/wikipedia/wikipedia';
import {upstreamFailure} from '@/server/upstream';
import {UPSTREAM_TIMEOUT_MS} from '@/constant/constant';

type UpstreamSummary = {
  title: string;
  extract?: string;
  content_urls?: { desktop?: { page?: string } };
};

// Forwards Wikipedia's article summary so visitors' browsers never contact
// Wikipedia directly. The text is CC BY-SA 4.0; the client credits and links it.
export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/wikipedia/summary/[title]'>,
) {
  const { title } = await ctx.params;

  if (!(await getAllowedWikipediaTitles()).has(title)) {
    return new Response('Not found', { status: 404 });
  }

  // One timeout for the whole exchange, body included: this route reads the
  // small JSON body itself (unlike the Mapbox proxy, which streams bodies on
  // and so only times the wait for headers, with fetchWithTimeout). It also
  // stops if the browser cancels the request.
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)]);

  let res: Response;
  try {
    res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { headers: { 'user-agent': WIKIMEDIA_USER_AGENT, accept: 'application/json' }, signal },
    );
  } catch (err) {
    return upstreamFailure(err);
  }

  if (res.status === 429) {
    // Wikimedia is throttling this server: say so, and pass on when to retry.
    const retryAfter = res.headers.get('retry-after');
    return new Response('Too many requests', {
      status: 429,
      headers: retryAfter ? { 'retry-after': retryAfter } : undefined,
    });
  }

  if (!res.ok) {
    return new Response(res.statusText, { status: res.status === 404 ? 404 : 502 });
  }

  let data: UpstreamSummary;
  try {
    data = await res.json() as UpstreamSummary;
  } catch (err) {
    // The body stalled past the timeout (504), or wasn't JSON (502).
    return upstreamFailure(err);
  }

  return Response.json(
    {
      title: data.title,
      extract: data.extract ?? '',
      url: data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    },
    { headers: { 'cache-control': 'public, max-age=300, s-maxage=86400' } },
  );
}
