'use client';

import { useEffect, useState } from 'react';
import { udl } from '@/udl/udl';
import { type WikipediaSummary } from 'WikipediaTypes';

type WikipediaSummaryState =
  | { status: 'idle'; summary: null }
  | { status: 'loading'; summary: null }
  | { status: 'error'; summary: null }
  | { status: 'ready'; summary: WikipediaSummary };

type Result = { title: string } & ({ summary: WikipediaSummary } | { error: true });

// Loads the summary of an English Wikipedia article; 'idle' without a title.
export const useWikipediaSummary = (title: string | undefined): WikipediaSummaryState => {
  // Keyed by title, so a stale result never shows for a different article.
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!title) {
      return;
    }

    const controller = new AbortController();

    udl.getWikipediaSummary(title, controller.signal)
      .then((summary) => setResult({ title, summary }))
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setResult({ title, error: true });
        }
      });

    return () => controller.abort();
  }, [title]);

  if (!title) {
    return { status: 'idle', summary: null };
  }

  if (result?.title !== title) {
    return { status: 'loading', summary: null };
  }

  return 'summary' in result
    ? { status: 'ready', summary: result.summary }
    : { status: 'error', summary: null };
}
