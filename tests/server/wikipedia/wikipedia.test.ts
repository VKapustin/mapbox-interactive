// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getAllowedWikipediaTitles } from '@/server/wikipedia/wikipedia';
import { getMapConfig } from '@/server/map/mapConfig';
import { getMapLayerData } from '@/server/map/mapLayers';

// Across every configured layer.
const landmarkCount = async () => {
  const { layers } = await getMapConfig();
  const collections = await Promise.all(layers.map((layer) => getMapLayerData(layer.id)));
  return collections.reduce((count, collection) => count + collection!.features.length, 0);
};

describe('getAllowedWikipediaTitles', () => {
  it('lists the Wikipedia titles in the map data', async () => {
    const titles = await getAllowedWikipediaTitles();

    expect(titles).toContain('Coit_Tower');
    expect(titles).toContain('Main_Quad_(Stanford_University)');
    expect(titles).toContain("St_Paul's_Cathedral");
    expect(titles).toContain('Panthéon');
    // One per landmark, none shared.
    expect(titles.size).toBe(await landmarkCount());
  });
});
