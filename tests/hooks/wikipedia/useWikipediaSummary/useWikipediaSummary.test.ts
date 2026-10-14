import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useWikipediaSummary } from '@/hooks/wikipedia/useWikipediaSummary/useWikipediaSummary';
import { udl } from '@/udl/udl';

vi.mock('@/udl/udl', () => ({ udl: { getWikipediaSummary: vi.fn() } }));

const summary = (title: string) => ({ title, extract: `${title} text.`, url: `https://en.wikipedia.org/wiki/${title}` });

describe('useWikipediaSummary', () => {
  beforeEach(() => {
    vi.mocked(udl.getWikipediaSummary).mockImplementation(async (title: string) => summary(title));
  });

  it('is idle without a title and fetches nothing', () => {
    const { result } = renderHook(() => useWikipediaSummary(undefined));

    expect(result.current).toEqual({ status: 'idle', summary: null });
    expect(udl.getWikipediaSummary).not.toHaveBeenCalled();
  });

  it('loads the summary', async () => {
    const { result } = renderHook(() => useWikipediaSummary('Coit_Tower'));

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.summary).toEqual(summary('Coit_Tower'));
  });

  it('reports an error', async () => {
    vi.mocked(udl.getWikipediaSummary).mockRejectedValue(new Error('500'));

    const { result } = renderHook(() => useWikipediaSummary('Coit_Tower'));

    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('shows loading, not the previous article, when the title changes', async () => {
    const { result, rerender } = renderHook(({ title }) => useWikipediaSummary(title), {
      initialProps: { title: 'Coit_Tower' },
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    rerender({ title: 'Sather_Tower' });

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.summary?.title).toBe('Sather_Tower'));
  });

  it('aborts the request on unmount', () => {
    const { unmount } = renderHook(() => useWikipediaSummary('Coit_Tower'));
    const signal = vi.mocked(udl.getWikipediaSummary).mock.calls[0][1]!;

    unmount();

    expect(signal.aborted).toBe(true);
  });
});
