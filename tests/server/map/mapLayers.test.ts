// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getMapConfig } from '@/server/map/mapConfig';
import { getMapLayerData } from '@/server/map/mapLayers';
import { type MapFeatureImage } from 'MapTypes';

// The layer data is JSON, which TypeScript doesn't check, so these tests do.
// Each layer is one country, and its points must lie within that country's
// bounding box: [west, south, east, north].
const LAYER_BOUNDS: Record<string, [number, number, number, number]> = {
  // The contiguous USA.
  'usa-landmarks': [-125, 24, -66, 50],
  'czechia-landmarks': [12.0, 48.5, 18.9, 51.1],
  'france-landmarks': [-5.2, 41.3, 9.6, 51.1],
  'germany-landmarks': [5.8, 47.2, 15.1, 55.1],
  'greece-landmarks': [19.3, 34.8, 28.3, 41.8],
  'italy-landmarks': [6.6, 36.6, 18.6, 47.1],
  'spain-landmarks': [-9.4, 35.9, 3.4, 43.8],
  'uk-landmarks': [-8.7, 49.8, 1.8, 60.9],
};

const layers = async () => {
  const { layers: configured } = await getMapConfig();
  return Promise.all(configured.map(async ({ id }) => ({ id, data: (await getMapLayerData(id))! })));
};

describe('getMapLayerData', () => {
  it('has data, and an area to check against, for every configured layer', async () => {
    for (const { id, data } of await layers()) {
      expect(data, id).toBeDefined();
      expect(LAYER_BOUNDS[id], `add ${id} to LAYER_BOUNDS`).toBeDefined();
    }
  });

  it('returns a FeatureCollection of named, described points for each layer', async () => {
    for (const { id, data } of await layers()) {
      expect(data.type, id).toBe('FeatureCollection');
      expect(data.features.length, id).toBeGreaterThan(0);

      for (const feature of data.features) {
        const label = `${id}: ${feature.properties?.name}`;
        expect(feature.type, label).toBe('Feature');
        expect(feature.geometry.type, label).toBe('Point');
        expect(feature.properties?.name, label).toEqual(expect.stringMatching(/\S/));
        expect(feature.properties?.description, label).toEqual(expect.stringMatching(/\S/));
        expect(feature.properties?.wikipediaTitle, label).toEqual(expect.stringMatching(/^\S+$/));
      }
    }
  });

  it('keeps each layer\'s points within its area', async () => {
    for (const { id, data } of await layers()) {
      const [west, south, east, north] = LAYER_BOUNDS[id];

      for (const feature of data.features) {
        const [lon, lat] = feature.geometry.coordinates as [number, number];
        const label = `${id}: ${feature.properties?.name} at ${lon}, ${lat}`;
        expect(lon, label).toBeGreaterThanOrEqual(west);
        expect(lon, label).toBeLessThanOrEqual(east);
        expect(lat, label).toBeGreaterThanOrEqual(south);
        expect(lat, label).toBeLessThanOrEqual(north);
      }
    }
  });

  it('has unique names within each layer', async () => {
    for (const { id, data } of await layers()) {
      const names = data.features.map((feature) => feature.properties?.name);
      expect(new Set(names).size, id).toBe(names.length);
    }
  });

  it('gives every landmark a local photo with its Wikimedia Commons credit', async () => {
    for (const { id, data } of await layers()) {
      for (const feature of data.features) {
        const image = feature.properties?.image as MapFeatureImage;
        const label = `${id}: ${feature.properties?.name}`;

        // Served from public/landmarks/<layer id>, so viewing it never contacts Wikimedia.
        expect(image.url, label).toMatch(new RegExp(`^/landmarks/${id}/[a-z0-9-]+\\.jpg$`));
        expect(existsSync(join(process.cwd(), 'public', image.url)), image.url).toBe(true);
        expect(image.sourceUrl, label).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
        expect(image.author, label).toMatch(/\S/);
        // Creative Commons (incl. ported versions such as "CC BY-SA 3.0 de"),
        // public domain, or the Free Art License.
        expect(image.license, label).toMatch(/^(CC0|Public domain|CC BY(-SA)? [\d.]+( [a-z]{2})?|FAL)$/);
        expect(image.licenseUrl, label).toMatch(
          image.license === 'FAL' ? /^https:\/\/artlibre\.org\/licence\/lal\// : /^https:\/\/creativecommons\.org\//,
        );
      }
    }
  });

  it('has a photo file for every landmark in each layer\'s folder, and no unused ones', async () => {
    for (const { id, data } of await layers()) {
      const used = data.features.map((feature) => (feature.properties?.image as MapFeatureImage).url.split('/').pop());
      const files = readdirSync(join(process.cwd(), 'public', 'landmarks', id));

      expect(files.sort(), id).toEqual([...used].sort());
    }
  });

  it('has no photos outside the layer folders', async () => {
    const ids = (await layers()).map(({ id }) => id);

    expect(readdirSync(join(process.cwd(), 'public', 'landmarks')).sort()).toEqual([...ids].sort());
  });

  it('returns undefined for an unknown layer', async () => {
    expect(await getMapLayerData('does-not-exist')).toBeUndefined();
  });
});
