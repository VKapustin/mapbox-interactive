// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getMapConfig, getStyleThumbnailUrl, STYLE_THUMBNAIL_VIEW } from '@/server/map/mapConfig';
import { STYLE_THUMBNAIL_SIZE, STYLE_THUMBNAIL_ZOOM_OFFSET } from '@/constant/constant';
import { getMapLayerData } from '@/server/map/mapLayers';

describe('getMapConfig', () => {
  it('has a default style that exists in the style list', async () => {
    const config = await getMapConfig();

    expect(config.styles.map((style) => style.id)).toContain(config.defaultStyleId);
  });

  it('only lists Mapbox style URLs, which the proxy can serve', async () => {
    const config = await getMapConfig();

    for (const style of config.styles) {
      expect(style.url).toMatch(/^mapbox:\/\/styles\//);
    }
  });

  it('gives every style a thumbnail of the fixed thumbnail view', async () => {
    const config = await getMapConfig();

    for (const style of config.styles) {
      expect(style.imageUrl).toBe(getStyleThumbnailUrl(style.url, STYLE_THUMBNAIL_VIEW));
    }
  });

  it('clusters every layer and gives each the bounding box of its points', async () => {
    const { layers } = await getMapConfig();

    for (const layer of layers) {
      expect(layer.cluster, layer.id).toBe(true);
      const [west, south, east, north] = layer.extent!;
      for (const feature of (await getMapLayerData(layer.id))!.features) {
        const [lon, lat] = feature.geometry.coordinates as [number, number];
        expect(lon >= west && lon <= east && lat >= south && lat <= north, `${layer.id}: ${feature.properties?.name}`).toBe(true);
      }
    }
  });

  it('fits the starting view to the layers', async () => {
    const { view } = await getMapConfig();

    expect(view.fitToLayers).toBe(true);
  });

  it('shows every data layer even before the fit, on a typical screen', async () => {
    const { view, layers } = await getMapConfig();

    // The world is 256px wide at zoom 0 and doubles per level, so a 1024px-wide
    // screen spans (1024 / 2) * 360 / (256 * 2^zoom) degrees each side of the center.
    const halfSpan = (1024 / 2) * 360 / (256 * 2 ** view.zoom);
    for (const layer of layers) {
      const data = await getMapLayerData(layer.id);
      for (const feature of data!.features) {
        const [lon] = feature.geometry.coordinates as [number, number];
        expect(Math.abs(lon - view.center[0]), `${layer.id}: ${feature.properties?.name}`).toBeLessThan(halfSpan);
      }
    }
  });

  it('has unique style and layer ids', async () => {
    const config = await getMapConfig();
    const styleIds = config.styles.map((style) => style.id);
    const layerIds = config.layers.map((layer) => layer.id);

    expect(new Set(styleIds).size).toBe(styleIds.length);
    expect(new Set(layerIds).size).toBe(layerIds.length);
  });

  it('has a valid initial view', async () => {
    const { view } = await getMapConfig();
    const [lon, lat] = view.center;

    expect(lon).toBeGreaterThanOrEqual(-180);
    expect(lon).toBeLessThanOrEqual(180);
    expect(lat).toBeGreaterThanOrEqual(-90);
    expect(lat).toBeLessThanOrEqual(90);
    expect(view.zoom).toBeGreaterThanOrEqual(view.minZoom ?? 0);
    expect(view.zoom).toBeLessThanOrEqual(view.maxZoom ?? 24);
  });

  it('has data for every data layer it points to', async () => {
    const config = await getMapConfig();

    for (const layer of config.layers) {
      expect(layer.url).toBe(`/api/map/layers/${layer.id}`);
      expect(await getMapLayerData(layer.id)).toBeDefined();
    }
  });
});

describe('getStyleThumbnailUrl', () => {
  it('builds a Static Images URL through the proxy, zoomed out from the view', () => {
    const url = getStyleThumbnailUrl('mapbox://styles/mapbox/dark-v11', { center: [-122.2, 37.6], zoom: 10 });
    const size = `${STYLE_THUMBNAIL_SIZE}x${STYLE_THUMBNAIL_SIZE}@2x`;

    expect(url).toBe(
      `/api/mapbox/styles/v1/mapbox/dark-v11/static/-122.2,37.6,${10 - STYLE_THUMBNAIL_ZOOM_OFFSET}/${size}?attribution=false&logo=false`,
    );
  });

  it('never zooms below 0', () => {
    const url = getStyleThumbnailUrl('mapbox://styles/mapbox/dark-v11', { center: [0, 0], zoom: 1 });

    expect(url).toContain('/static/0,0,0/');
  });
});
