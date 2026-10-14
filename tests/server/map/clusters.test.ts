// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { getAoiSummary, getLayerClusters, getLayerExtent, getLayerFeatures, tileToLonLatExtent } from '@/server/map/clusters';
import { parseAoi } from '@/helpers/aoiHelpers';
import { getMapLayerData } from '@/server/map/mapLayers';
import { CLUSTER_MAX_ZOOM } from '@/constant/constant';

// The real layer data, observed: to check which layers get loaded.
vi.mock('@/server/map/mapLayers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/map/mapLayers')>();
  return { ...actual, getMapLayerData: vi.fn(actual.getMapLayerData) };
});

const lonLatToTile = (lon: number, lat: number, z: number) => {
  const n = 2 ** z;
  const latRad = (lat * Math.PI) / 180;
  return [
    Math.floor(((lon + 180) / 360) * n),
    Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n),
  ];
};

describe('tileToLonLatExtent', () => {
  it('covers the whole Web Mercator world at zoom 0', () => {
    const [west, south, east, north] = tileToLonLatExtent(0, 0, 0);

    expect([west, east]).toEqual([-180, 180]);
    expect(south).toBeCloseTo(-85.0511, 3);
    expect(north).toBeCloseTo(85.0511, 3);
  });

  it('splits into quarters at zoom 1, with y counting down from the north', () => {
    const [west, south, east, north] = tileToLonLatExtent(1, 1, 0);

    expect([west, south, east]).toEqual([0, 0, 180]);
    expect(north).toBeCloseTo(85.0511, 3);
  });
});

describe('getLayerClusters', () => {
  it('groups a whole city into one cluster when zoomed far out, with the zoom where it splits', async () => {
    const [x, y] = lonLatToTile(-122.3, 37.6, 3);

    const { features } = (await getLayerClusters('usa-landmarks', 3, x, y))!;
    // The USA layer's 16 Bay Area landmarks, near San Francisco.
    const bayArea = features.find((feature) => {
      const [lon, lat] = feature.geometry.coordinates as [number, number];
      return Math.abs(lon + 122.3) < 1 && Math.abs(lat - 37.6) < 1;
    })!;

    expect(bayArea.properties).toMatchObject({ cluster: true, point_count: 16 });
    expect(bayArea.properties?.expansion_zoom).toBeGreaterThan(3);
    expect(bayArea.properties?.expansion_zoom).toBeLessThanOrEqual(CLUSTER_MAX_ZOOM + 1);
  });

  it('returns every point on its own, with its properties, above the clustering zoom', async () => {
    const z = CLUSTER_MAX_ZOOM + 1;
    const coit = (await getMapLayerData('usa-landmarks'))!.features
      .find((feature) => feature.properties?.name === 'Coit Tower')!;
    const [lon, lat] = coit.geometry.coordinates as [number, number];
    const [x, y] = lonLatToTile(lon, lat, z);

    const { features } = (await getLayerClusters('usa-landmarks', z, x, y))!;

    expect(features).toHaveLength(1);
    expect(features[0].properties).toEqual(coit.properties);
    // supercluster round-trips coordinates through its own projection, so they
    // can differ in the last floating-point digits.
    const [gotLon, gotLat] = features[0].geometry.coordinates as [number, number];
    expect(gotLon).toBeCloseTo(lon, 9);
    expect(gotLat).toBeCloseTo(lat, 9);
  });

  it('returns nothing for a tile away from the layer', async () => {
    const [x, y] = lonLatToTile(0, 0, 3);

    expect((await getLayerClusters('usa-landmarks', 3, x, y))!.features).toEqual([]);
  });

  it('returns undefined for an unknown layer, without loading or caching anything for it', async () => {
    vi.mocked(getMapLayerData).mockClear();

    expect(await getLayerClusters('made-up-layer', 0, 0, 0)).toBeUndefined();
    expect(getMapLayerData).not.toHaveBeenCalledWith('made-up-layer');
  });
});

describe('getLayerExtent', () => {
  it('is the bounding box around all of a layer\'s points', async () => {
    const { features } = (await getMapLayerData('france-landmarks'))!;
    const [west, south, east, north] = (await getLayerExtent('france-landmarks'))!;

    for (const feature of features) {
      const [lon, lat] = feature.geometry.coordinates as [number, number];
      expect(lon).toBeGreaterThanOrEqual(west);
      expect(lon).toBeLessThanOrEqual(east);
      expect(lat).toBeGreaterThanOrEqual(south);
      expect(lat).toBeLessThanOrEqual(north);
    }
    const lons = features.map((feature) => (feature.geometry.coordinates as number[])[0]);
    expect(west).toBe(Math.min(...lons));
    expect(east).toBe(Math.max(...lons));
  });

  it('returns undefined for an unknown layer', async () => {
    expect(await getLayerExtent('nope')).toBeUndefined();
  });
});

describe('with an area of interest', () => {
  // Around San Francisco itself: the Bay Area landmarks north of Daly City and
  // west of the Bay (so not Berkeley, Oakland, Stanford, Muir Woods, …).
  const SAN_FRANCISCO = parseAoi(JSON.stringify({
    type: 'Polygon',
    coordinates: [[[-122.52, 37.70], [-122.35, 37.70], [-122.35, 37.84], [-122.52, 37.84], [-122.52, 37.70]]],
  }))!;
  // In the Atlantic, far from any landmark.
  const OCEAN = parseAoi(JSON.stringify({
    type: 'Polygon',
    coordinates: [[[-40, 30], [-30, 30], [-30, 40], [-40, 40], [-40, 30]]],
  }))!;
  const inSanFrancisco = async () => (await getLayerFeatures('usa-landmarks', SAN_FRANCISCO))!.features;

  it('keeps only the layer\'s features inside it', async () => {
    const names = (await inSanFrancisco()).map((feature) => feature.properties?.name);

    expect(names).toContain('Coit Tower');
    expect(names).toContain('Golden Gate Bridge');
    expect(names).not.toContain('Sather Tower');
    expect(names).not.toContain('Statue of Liberty');
  });

  it('clusters only the features inside it', async () => {
    const [x, y] = lonLatToTile(-122.3, 37.6, 3);

    const { features } = (await getLayerClusters('usa-landmarks', 3, x, y, SAN_FRANCISCO))!;

    // One cluster of the San Francisco landmarks, not the 16 of the Bay Area.
    expect(features).toHaveLength(1);
    expect(features[0].properties?.point_count).toBe((await inSanFrancisco()).length);
    expect(features[0].properties?.point_count).toBeLessThan(16);
  });

  it('returns no clusters when nothing is inside', async () => {
    const [x, y] = lonLatToTile(-122.3, 37.6, 3);

    expect((await getLayerClusters('usa-landmarks', 3, x, y, OCEAN))!.features).toEqual([]);
  });

  it('gives the extent of the features inside, and none when nothing is', async () => {
    const [west, south, east, north] = (await getLayerExtent('usa-landmarks', SAN_FRANCISCO))!;

    expect(west).toBeGreaterThanOrEqual(-122.52);
    expect(east).toBeLessThanOrEqual(-122.35);
    expect(south).toBeGreaterThanOrEqual(37.70);
    expect(north).toBeLessThanOrEqual(37.84);
    expect(await getLayerExtent('usa-landmarks', OCEAN)).toBeUndefined();
  });

  describe('getAoiSummary', () => {
    it('counts each layer\'s features inside, out of all of them', async () => {
      const { layers } = await getAoiSummary(SAN_FRANCISCO);
      const usa = (await getLayerFeatures('usa-landmarks'))!.features;

      expect(layers['usa-landmarks']).toEqual({
        count: (await inSanFrancisco()).length,
        total: usa.length,
        extent: (await getLayerExtent('usa-landmarks', SAN_FRANCISCO))!,
      });
      expect(layers['france-landmarks']).toMatchObject({ count: 0, extent: null });
    });

    it('lists every layer, with nothing inside an empty area', async () => {
      const { layers } = await getAoiSummary(OCEAN);

      expect(Object.keys(layers)).toContain('uk-landmarks');
      expect(Object.values(layers).every((layer) => layer.count === 0 && layer.extent === null)).toBe(true);
    });
  });
});
