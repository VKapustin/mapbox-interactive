import { beforeEach, describe, expect, it, vi } from 'vitest';
import Map from 'ol/Map';
import View from 'ol/View';
import LayerGroup from 'ol/layer/Group';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { fromLonLat } from 'ol/proj';
import { Circle, type Style } from 'ol/style';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { createXYZ } from 'ol/tilegrid';
import { transformExtent } from 'ol/proj';
import { udl } from '@/udl/udl';
import { type GeoJSONFeatureCollection } from 'MapTypes';
import { apply } from 'ol-mapbox-style';
import {
  applyBasemapStyle,
  createDataLayer,
  createMarkerStyle,
  formatLonLat,
  getDataLayerStyle,
  getMapCenterLonLat,
  search,
  setDataLayerAoi,
  toProxyRequest,
} from '@/helpers/mapHelpers';
import {
  DATA_LAYER_STYLE_DEFAULTS,
  DATA_LAYER_Z_INDEX,
  MAPBOX_ATTRIBUTION,
  MARKER_COLOR,
  PLACEHOLDER_TOKEN,
} from '@/constant/constant';

vi.mock('ol-mapbox-style', () => ({ apply: vi.fn() }));

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('search', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  it('queries the Search Box proxy endpoint with the query and proximity', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ features: [] }));
    const signal = new AbortController().signal;

    await search('Coit Tower', [-122.4, 37.8], signal);

    const [url, init] = fetchMock.mock.calls[0];
    const parsed = new URL(url, 'http://localhost');
    expect(parsed.pathname).toBe('/api/mapbox/search/searchbox/v1/forward');
    expect(parsed.searchParams.get('q')).toBe('Coit Tower');
    expect(parsed.searchParams.get('auto_complete')).toBe('true');
    expect(parsed.searchParams.get('limit')).toBe('5');
    expect(parsed.searchParams.get('proximity')).toBe('-122.4,37.8');
    // udl adds a timeout to the caller's signal, so it passes a combined one.
    const passed = (init as RequestInit).signal!;
    expect(passed).not.toBe(signal);
    expect(passed.aborted).toBe(false);
  });

  it('omits proximity when none is given', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ features: [] }));

    await search('Coit Tower', undefined, new AbortController().signal);

    const parsed = new URL(fetchMock.mock.calls[0][0], 'http://localhost');
    expect(parsed.searchParams.has('proximity')).toBe(false);
  });

  it('maps Search Box features to search results', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      features: [
        {
          id: 'feature-1',
          geometry: { coordinates: [-122.4058, 37.8024] },
          properties: {
            mapbox_id: 'mbx-1',
            name: 'Coit Tower',
            place_formatted: 'San Francisco, California',
            bbox: [-122.41, 37.80, -122.40, 37.81],
          },
        },
        {
          id: 'feature-2',
          geometry: { coordinates: [-122.42, 37.77] },
          properties: { mapbox_id: 'mbx-2', name: 'San Francisco' },
        },
      ],
    }));

    const results = await search('Coit', undefined, new AbortController().signal);

    expect(results).toEqual([
      {
        id: 'mbx-1',
        name: 'Coit Tower',
        description: 'San Francisco, California',
        center: [-122.4058, 37.8024],
        bbox: [-122.41, 37.80, -122.40, 37.81],
      },
      {
        id: 'mbx-2',
        name: 'San Francisco',
        description: '',
        center: [-122.42, 37.77],
        bbox: undefined,
      },
    ]);
  });

  it('throws when the proxy responds with an error', async () => {
    fetchMock.mockResolvedValue(new Response('Forbidden', { status: 403 }));

    await expect(search('Coit', undefined, new AbortController().signal))
      .rejects.toMatchObject({ name: 'UdlError', status: 403 });
  });
});

describe('toProxyRequest', () => {
  it('rewrites api.mapbox.com URLs to the proxy and drops the access token', () => {
    const result = toProxyRequest(
      'https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=proxy&fresh=true',
      'Style',
    );

    expect(result).toBe('/api/mapbox/styles/v1/mapbox/streets-v12?fresh=true');
  });

  it('rewrites tile subdomain URLs to the proxy', () => {
    const result = toProxyRequest(
      'https://b.tiles.mapbox.com/v4/mapbox.mapbox-streets-v8/8/40/98.vector.pbf?access_token=proxy',
      'Tiles',
    );

    expect(result).toBe('/api/mapbox/v4/mapbox.mapbox-streets-v8/8/40/98.vector.pbf');
  });

  it('leaves non-Mapbox URLs alone', () => {
    expect(toProxyRequest('https://cdn.jsdelivr.net/npm/@fontsource/barlow/500.css', 'Style'))
      .toBeUndefined();
    expect(toProxyRequest('https://api.mapbox.com.evil.example/styles/v1/x', 'Style'))
      .toBeUndefined();
  });

  it('returns a Request for sprite images, which ol-mapbox-style requires', () => {
    // Node's Request rejects relative URLs; browsers resolve them against the page.
    const NodeRequest = Request;
    vi.stubGlobal('Request', class extends NodeRequest {
      constructor(input: string, init?: RequestInit) {
        super(new URL(input, location.href), init);
      }
    });

    const result = toProxyRequest(
      'https://api.mapbox.com/styles/v1/mapbox/streets-v12/sprite@2x.png?access_token=proxy',
      'SpriteImage',
    );

    expect(result).toBeInstanceOf(Request);
    expect(new URL((result as Request).url).pathname)
      .toBe('/api/mapbox/styles/v1/mapbox/streets-v12/sprite@2x.png');
    expect((result as Request).url).not.toContain('access_token');
  });
});

describe('createMarkerStyle', () => {
  it('draws a circle in the marker color', () => {
    const image = createMarkerStyle().getImage();

    expect(image).toBeInstanceOf(Circle);
    expect((image as Circle).getFill()?.getColor()).toBe(MARKER_COLOR);
  });
});

describe('getMapCenterLonLat', () => {
  it('returns undefined without a map', () => {
    expect(getMapCenterLonLat(null)).toBeUndefined();
  });

  it('returns the view center as longitude and latitude', () => {
    const map = new Map({ view: new View({ center: fromLonLat([-122.2, 37.6]), zoom: 9 }) });

    const [lon, lat] = getMapCenterLonLat(map)!;

    expect(lon).toBeCloseTo(-122.2, 6);
    expect(lat).toBeCloseTo(37.6, 6);
  });
});

describe('applyBasemapStyle', () => {
  it('replaces the group contents with the style and adds Mapbox attribution', async () => {
    const group = new LayerGroup({ layers: [new VectorLayer({ source: new VectorSource() })] });
    const styleSource = new VectorSource();
    vi.mocked(apply).mockImplementation(async (target) => {
      (target as LayerGroup).getLayers().push(new VectorLayer({ source: styleSource }));
      return target as LayerGroup;
    });

    await applyBasemapStyle(group, 'mapbox://styles/mapbox/dark-v11');

    expect(apply).toHaveBeenCalledWith(group, 'mapbox://styles/mapbox/dark-v11', expect.objectContaining({
      accessToken: PLACEHOLDER_TOKEN,
      transformRequest: toProxyRequest,
    }));
    expect(group.getLayers().getLength()).toBe(1);
    expect(group.getLayersArray()[0].getSource()).toBe(styleSource);
    const attributions = styleSource.getAttributions();
    expect(attributions?.({} as never)).toEqual(MAPBOX_ATTRIBUTION);
  });

  it('rejects when the style fails to load', async () => {
    vi.mocked(apply).mockRejectedValue(new Error('500'));

    await expect(applyBasemapStyle(new LayerGroup(), 'mapbox://styles/mapbox/dark-v11'))
      .rejects.toThrow('500');
  });
});

describe('getDataLayerStyle', () => {
  it('fills in the defaults', () => {
    expect(getDataLayerStyle()).toEqual(DATA_LAYER_STYLE_DEFAULTS);
  });

  it('keeps what the layer sets', () => {
    expect(getDataLayerStyle({ fill: '#dc2626', radius: 4 })).toEqual({
      ...DATA_LAYER_STYLE_DEFAULTS,
      fill: '#dc2626',
      radius: 4,
    });
  });
});

describe('createDataLayer', () => {
  it('builds a GeoJSON vector layer from the layer config', () => {
    const layer = createDataLayer({
      id: 'usa-landmarks',
      label: 'USA',
      type: 'geojson',
      url: '/api/map/layers/usa-landmarks',
      visible: false,
      attribution: 'Sample data',
      style: { fill: '#ff0000' },
    });

    expect(layer.get('id')).toBe('usa-landmarks');
    expect(layer.getVisible()).toBe(false);
    expect(layer.getZIndex()).toBe(DATA_LAYER_Z_INDEX);
    expect(layer.getSource()?.getAttributions()?.({} as never)).toEqual(['Sample data']);
  });

  describe('with an area of interest', () => {
    const AOI = JSON.stringify({ type: 'Polygon', coordinates: [[[-123, 37], [-121, 37], [-122, 38], [-123, 37]]] });
    const urlOf = (layer: VectorLayer) =>
      (layer.getSource()!.getUrl() as (...args: never[]) => string)();
    const createLayer = () => createDataLayer({
      id: 'usa-landmarks', label: 'USA', type: 'geojson', url: '/api/map/layers/usa-landmarks', visible: true,
    });

    it('loads the whole layer without one', () => {
      expect(urlOf(createLayer())).toBe('/api/map/layers/usa-landmarks');
    });

    it('asks the server for the features inside it, and reloads', () => {
      const layer = createLayer();
      const refresh = vi.spyOn(layer.getSource()!, 'refresh');

      setDataLayerAoi(layer, AOI);

      expect(urlOf(layer)).toBe(`/api/map/layers/usa-landmarks?aoi=${encodeURIComponent(AOI)}`);
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    it('does not reload when the area is the same', () => {
      const layer = createLayer();
      setDataLayerAoi(layer, AOI);
      const refresh = vi.spyOn(layer.getSource()!, 'refresh');

      setDataLayerAoi(layer, AOI);

      expect(refresh).not.toHaveBeenCalled();
    });

    it('goes back to the whole layer when cleared', () => {
      const layer = createLayer();
      setDataLayerAoi(layer, AOI);

      setDataLayerAoi(layer, null);

      expect(urlOf(layer)).toBe('/api/map/layers/usa-landmarks');
    });
  });
});

describe('formatLonLat', () => {
  it('formats latitude first with hemispheres and five decimals', () => {
    expect(formatLonLat([-122.4058, 37.8024])).toBe('37.80240° N, 122.40580° W');
  });

  it('uses S and E for southern and eastern coordinates', () => {
    expect(formatLonLat([151.2153, -33.8568])).toBe('33.85680° S, 151.21530° E');
  });
});

describe('clustered data layers', () => {
  const grid = createXYZ({ tileSize: 256 });
  const PARIS: [number, number, number, number] = [2.295, 48.846, 2.35, 48.874];
  const config = {
    id: 'paris', label: 'Paris', type: 'geojson' as const, url: '/paris', visible: true, cluster: true, extent: PARIS,
    style: { fill: '#7c3aed' },
  };
  // A view over all of western Europe; only the tiles around Paris hold anything.
  const europe = transformExtent([-10, 40, 20, 55], 'EPSG:4326', 'EPSG:3857');
  const tileOf = (call: unknown[]) => call.slice(1, 4).join('/');
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  const clusterTile = (features: unknown[] = []) =>
    ({ type: 'FeatureCollection', features }) as GeoJSONFeatureCollection;
  const parisCluster = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [2.33, 48.86] },
    properties: { cluster: true, cluster_id: 1, point_count: 10, expansion_zoom: 13 },
  };

  const load = (source: VectorSource, z: number, extent = europe) =>
    source.loadFeatures(extent, grid.getResolution(z), 'EPSG:3857' as never);

  it('loads only the tiles around the layer\'s features, through udl', async () => {
    const getClusters = vi.spyOn(udl, 'getLayerClusters').mockResolvedValue(clusterTile([parisCluster]));
    const source = createDataLayer(config).getSource()!;

    load(source, 3);
    await tick();

    expect(getClusters.mock.calls.map(tileOf)).toEqual(['3/4/2']);
    expect(getClusters.mock.calls[0][0]).toBe('paris');
    expect(source.getFeatures()).toHaveLength(1);
    expect(source.getFeatures()[0].get('point_count')).toBe(10);
  });

  it('does not reload tiles at the same zoom', async () => {
    const getClusters = vi.spyOn(udl, 'getLayerClusters').mockResolvedValue(clusterTile());
    const source = createDataLayer(config).getSource()!;

    load(source, 3);
    load(source, 3);
    await tick();

    expect(getClusters).toHaveBeenCalledTimes(1);
  });

  it('starts over when the zoom level changes', async () => {
    const getClusters = vi.spyOn(udl, 'getLayerClusters').mockResolvedValue(clusterTile([parisCluster]));
    const source = createDataLayer(config).getSource()!;
    load(source, 3);
    await tick();

    getClusters.mockResolvedValue(clusterTile());
    load(source, 7);
    await tick();

    // Paris (≈2.3°E, 48.86°N) is tile x 4 / y 2 at zoom 3, and x 64 / y 44 at zoom 7.
    expect(getClusters.mock.calls.map(tileOf)).toEqual(['3/4/2', '7/64/44']);
    // The zoom-3 cluster is gone; the zoom-7 tile was empty.
    expect(source.getFeatures()).toHaveLength(0);
  });

  it('drops a reply that arrives after the zoom has changed', async () => {
    let answerZoom3!: (tile: GeoJSONFeatureCollection) => void;
    vi.spyOn(udl, 'getLayerClusters')
      .mockImplementationOnce(() => new Promise((resolve) => { answerZoom3 = resolve; }))
      .mockResolvedValue(clusterTile());
    const source = createDataLayer(config).getSource()!;

    load(source, 3);
    load(source, 7);
    answerZoom3(clusterTile([parisCluster]));
    await tick();

    expect(source.getFeatures()).toHaveLength(0);
  });

  it('asks for the tiles of the area of interest, once set', async () => {
    const AOI = JSON.stringify({ type: 'Polygon', coordinates: [[[2.3, 48.85], [2.35, 48.85], [2.32, 48.88], [2.3, 48.85]]] });
    const getClusters = vi.spyOn(udl, 'getLayerClusters').mockResolvedValue(clusterTile());
    const layer = createDataLayer(config);

    load(layer.getSource()!, 3);
    await tick();
    setDataLayerAoi(layer, AOI);
    load(layer.getSource()!, 3);
    await tick();

    // The same tile again (the AOI refresh forgot it was loaded), now with the AOI.
    expect(getClusters.mock.calls.map((call) => [tileOf(call), call[4]])).toEqual([['3/4/2', null], ['3/4/2', AOI]]);
  });

  it('drops a reply for an area of interest that has since changed', async () => {
    let answerOld!: (tile: GeoJSONFeatureCollection) => void;
    vi.spyOn(udl, 'getLayerClusters')
      .mockImplementationOnce(() => new Promise((resolve) => { answerOld = resolve; }))
      .mockResolvedValue(clusterTile());
    const layer = createDataLayer(config);
    const source = layer.getSource()!;

    load(source, 3);
    setDataLayerAoi(layer, JSON.stringify({ type: 'Polygon', coordinates: [[[2, 48], [3, 48], [2.5, 49], [2, 48]]] }));
    answerOld(clusterTile([parisCluster]));
    await tick();

    expect(source.getFeatures()).toHaveLength(0);
  });

  it('loads nothing when the view is away from the layer', async () => {
    const getClusters = vi.spyOn(udl, 'getLayerClusters').mockResolvedValue(clusterTile());
    const source = createDataLayer(config).getSource()!;

    load(source, 5, transformExtent([-125, 30, -110, 45], 'EPSG:4326', 'EPSG:3857'));
    await tick();

    expect(getClusters).not.toHaveBeenCalled();
  });

  describe('style', () => {
    const styleOf = (feature: Feature) =>
      (createDataLayer(config).getStyleFunction()!(feature, 1) as Style);

    it('draws a cluster in the layer\'s color with its count', () => {
      const cluster = new Feature({ geometry: new Point([0, 0]), cluster: true, point_count: 12 });
      const style = styleOf(cluster);

      expect(style.getText()?.getText()).toBe('12');
      expect((style.getImage() as Circle).getFill()?.getColor()).toBe('#7c3aed');
      expect((style.getImage() as Circle).getRadius()).toBeGreaterThan(DATA_LAYER_STYLE_DEFAULTS.radius);
    });

    it('writes the count in the app\'s font (Mulish, from next/font)', () => {
      const style = styleOf(new Feature({ geometry: new Point([0, 0]), cluster: true, point_count: 12 }));

      expect(style.getText()?.getFont()).toBe("700 12px 'Mulish', sans-serif");
    });

    it('grows bigger clusters', () => {
      const radius = (count: number) =>
        (styleOf(new Feature({ geometry: new Point([0, 0]), cluster: true, point_count: count })).getImage() as Circle).getRadius();

      expect(radius(5)).toBeLessThan(radius(20));
      expect(radius(20)).toBeLessThan(radius(80));
    });

    it('draws a single point like an unclustered layer', () => {
      const style = styleOf(new Feature({ geometry: new Point([0, 0]), name: 'Louvre' }));

      expect(style.getText()).toBeNull();
      expect((style.getImage() as Circle).getRadius()).toBe(DATA_LAYER_STYLE_DEFAULTS.radius);
      expect((style.getImage() as Circle).getFill()?.getColor()).toBe('#7c3aed');
    });
  });
});
