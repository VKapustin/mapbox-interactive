import type { NextRequest } from 'next/server';
import {getAllowedWikipediaTitles, WIKIMEDIA_USER_AGENT} from '@/server/wikipedia/wikipedia';
import {UPSTREAM_TIMEOUT_MS} from '@/constant/constant';

type UpstreamSummary = {
  title: string;
  extract?: string;
  content_urls?: { desktop?: { page?: string } };
};

// Forwards Wikipedia's article summary so visitors' browsers never contact
// Wikipedia directly. The text is CC BY-SA 4.0; the client credits and links it.
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<'/api/wikipedia/summary/[title]'>,
) {
  const { title } = await ctx.params;

  if (!(await getAllowedWikipediaTitles()).has(title)) {
    return new Response('Not found', { status: 404 });
  }

  let res: Response;
  try {
    res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      {
        headers: { 'user-agent': WIKIMEDIA_USER_AGENT, accept: 'application/json' },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      },
    );
  } catch (err) {
    // Wikipedia too slow (504) or unreachable (502).
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    return new Response(timedOut ? 'Gateway timeout' : 'Bad gateway', { status: timedOut ? 504 : 502 });
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

  const data = await res.json() as UpstreamSummary;

  return Response.json(
    {
      title: data.title,
      extract: data.extract ?? '',
      url: data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    },
    { headers: { 'cache-control': 'public, max-age=300, s-maxage=86400' } },
  );
}
