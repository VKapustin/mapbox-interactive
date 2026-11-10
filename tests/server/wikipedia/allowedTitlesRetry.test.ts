// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { getAllowedWikipediaTitles } from '@/server/wikipedia/wikipedia';
import { getMapLayerData } from '@/server/map/mapLayers';

// The real layer data, except that loading it can be made to fail. (In its own
// file: the allowlist is kept for the life of the module.)
vi.mock('@/server/map/mapLayers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/map/mapLayers')>();
  return { ...actual, getMapLayerData: vi.fn(actual.getMapLayerData) };
});

describe('getAllowedWikipediaTitles after a failure', () => {
  it('tries again on the next call instead of keeping the failure', async () => {
    vi.mocked(getMapLayerData).mockRejectedValueOnce(new Error('database unavailable'));

    await expect(getAllowedWikipediaTitles()).rejects.toThrow('database unavailable');

    expect(await getAllowedWikipediaTitles()).toContain('Coit_Tower');
  });
});
