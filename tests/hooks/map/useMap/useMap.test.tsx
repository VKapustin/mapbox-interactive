import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import Map from 'ol/Map';
import { Attribution, Zoom } from 'ol/control';
import LayerGroup from 'ol/layer/Group';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { fromLonLat, toLonLat, transformExtent } from 'ol/proj';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { boundingExtent, createEmpty, extend } from 'ol/extent';
import { apply } from 'ol-mapbox-style';
import { MapProvider, useMap } from '@/hooks/map';
import { ZOOM_TO_LAYER_DURATION_MS, ZOOM_TO_LAYER_MAX_ZOOM } from '@/constant/constant';
import { testMapConfig } from '@tests/support/mapFixtures';
import { udl } from '@/udl/udl';
import { type AoiSummary, type LonLatExtent, type MapConfig } from 'MapTypes';

vi.mock('ol-mapbox-style', () => ({ apply: vi.fn() }));

// Stands in for ol-mapbox-style: adds one layer tagged with the style URL.
const applyStyle = async (target: Parameters<typeof apply>[0], styleUrl: Parameters<typeof apply>[1]) => {
  const layer = new VectorLayer({ source: new VectorSource() });
  layer.set('style-url', styleUrl);
  (target as LayerGroup).getLayers().push(layer);
  return target as LayerGroup;
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <MapProvider config={testMapConfig}>{children}</MapProvider>
);

const getBasemap = (map: Map) =>
  map.getLayers().getArray().find((layer): layer is LayerGroup => layer instanceof LayerGroup)!;

const getStyleUrls = (map: Map) =>
  getBasemap(map).getLayersArray().map((layer) => layer.get('style-url'));

const renderReadyMap = async () => {
  const hook = renderHook(() => useMap(), { wrapper });
  await waitFor(() => expect(hook.result.current.status).toBe('ready'));
  return hook;
};

describe('useMap', () => {
  beforeEach(() => {
    vi.mocked(apply).mockImplementation(applyStyle);
  });

  it('throws outside a MapProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(() => useMap())).toThrow('useMap must be used within a MapProvider');
  });

  it('starts loading without a map', () => {
    const { result } = renderHook(() => useMap(), { wrapper });

    expect(result.current.status).toBe('loading');
    expect(result.current.map).toBeNull();
    expect(result.current.config).toBe(testMapConfig);
    expect(result.current.styleId).toBe('streets');
  });

  it('publishes the map once the default style has loaded', async () => {
    const { result } = await renderReadyMap();
    const map = result.current.map!;

    expect(map).toBeInstanceOf(Map);
    expect(getStyleUrls(map)).toEqual(['mapbox://styles/mapbox/streets-v12']);
  });

  it('sets up the view from the config', async () => {
    const { result } = await renderReadyMap();
    const view = result.current.map!.getView();
    const [lon, lat] = toLonLat(view.getCenter()!);

    expect(lon).toBeCloseTo(-122.2, 6);
    expect(lat).toBeCloseTo(37.6, 6);
    expect(view.getZoom()).toBe(9);
    expect(view.getMinZoom()).toBe(2);
    expect(view.getMaxZoom()).toBe(19);
  });

  it('uses its own attribution and leaves zooming to MapZoomControls', async () => {
    const { result } = await renderReadyMap();
    const controls = result.current.map!.getControls().getArray();

    expect(controls.some((control) => control instanceof Zoom)).toBe(false);
    expect(controls.filter((control) => control instanceof Attribution)).toHaveLength(1);
  });

  it('adds a layer per configured data layer', async () => {
    const { result } = await renderReadyMap();
    const layer = result.current.map!.getLayers().getArray().find((l) => l.get('id') === 'landmarks');

    expect(layer).toBeDefined();
    expect(layer!.getVisible()).toBe(true);
    expect(result.current.layerVisibility).toEqual({ landmarks: true });
  });

  it('still publishes the map when the style fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(apply).mockRejectedValue(new Error('500'));

    const { result } = renderHook(() => useMap(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.map).toBeInstanceOf(Map);
  });

  it('switches the basemap style and keeps the data layers', async () => {
    const { result } = await renderReadyMap();
    const map = result.current.map!;

    act(() => result.current.setStyle('dark'));

    expect(result.current.status).toBe('loading');
    expect(result.current.styleId).toBe('dark');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(getStyleUrls(map)).toEqual(['mapbox://styles/mapbox/dark-v11']);
    expect(map.getLayers().getArray().some((l) => l.get('id') === 'landmarks')).toBe(true);
  });

  it('reports an error when a style switch fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = await renderReadyMap();
    vi.mocked(apply).mockRejectedValueOnce(new Error('500'));

    act(() => result.current.setStyle('dark'));

    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('ignores style changes while a style is loading', async () => {
    const { result } = renderHook(() => useMap(), { wrapper });

    act(() => result.current.setStyle('dark'));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.styleId).toBe('streets');
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('ignores switching to the current style', async () => {
    const { result } = await renderReadyMap();

    act(() => result.current.setStyle('streets'));

    expect(result.current.status).toBe('ready');
    expect(apply).toHaveBeenCalledTimes(1);
  });

  describe('fitting to layers', () => {
    // The server puts each layer's bounding box in the config; fits use those,
    // so nothing has to load first (clustered layers only load what's on screen).
    const LONDON: LonLatExtent = [-0.142, 51.499, -0.075, 51.519];
    const PARIS: LonLatExtent = [2.295, 48.846, 2.35, 48.874];
    const BAY_AREA: LonLatExtent = [-122.571, 37.252, -121.951, 37.892];
    const fitConfig: MapConfig = {
      ...testMapConfig,
      view: { ...testMapConfig.view, fitToLayers: true },
      layers: [
        { id: 'london', label: 'London', type: 'geojson', url: '/london', visible: true, cluster: true, extent: LONDON },
        { id: 'paris', label: 'Paris', type: 'geojson', url: '/paris', visible: true, cluster: true, extent: PARIS },
        { id: 'hidden', label: 'Hidden', type: 'geojson', url: '/hidden', visible: false, cluster: true, extent: BAY_AREA },
      ],
    };
    const toMap = (...extents: LonLatExtent[]) =>
      extents.reduce((all, extent) => extend(all, transformExtent(extent, 'EPSG:4326', 'EPSG:3857')), createEmpty());

    const renderFittingMap = async (config = fitConfig) => {
      const hook = renderHook(() => useMap(), {
        wrapper: ({ children }: { children: ReactNode }) => <MapProvider config={config}>{children}</MapProvider>,
      });
      await waitFor(() => expect(hook.result.current.status).toBe('ready'));
      const map = hook.result.current.map!;
      const fit = vi.spyOn(map.getView(), 'fit').mockImplementation(() => {});
      // What MapCanvas attaching the map does.
      const attach = (size: [number, number] = [1024, 768]) => map.setSize(size);
      return { ...hook, map, fit, attach };
    };

    describe('on start', () => {
      it('fits to the visible layers\' extents once the map has a size, without animating', async () => {
        const { fit, attach } = await renderFittingMap();
        expect(fit).not.toHaveBeenCalled();

        attach();

        expect(fit).toHaveBeenCalledTimes(1);
        expect(fit).toHaveBeenCalledWith(toMap(LONDON, PARIS), expect.objectContaining({ duration: 0 }));
      });

      it('waits for a real size', async () => {
        const { fit, attach } = await renderFittingMap();

        attach([0, 0]);
        expect(fit).not.toHaveBeenCalled();

        attach();
        expect(fit).toHaveBeenCalledTimes(1);
      });

      it('fits only once', async () => {
        const { fit, attach } = await renderFittingMap();

        attach();
        attach([800, 600]);

        expect(fit).toHaveBeenCalledTimes(1);
      });

      it.each([
        ['panned', (map: Map) => map.getView().setCenter(fromLonLat([10, 10]))],
        ['zoomed', (map: Map) => map.getView().setZoom(5)],
        ['rotated', (map: Map) => map.getView().setRotation(0.5)],
      ])('skips the fit if the user %s the map first', async (_, move) => {
        const { map, fit, attach } = await renderFittingMap();

        move(map);
        attach();

        expect(fit).not.toHaveBeenCalled();
      });

      it('stops watching the view once it has fitted', async () => {
        const { map, attach } = await renderFittingMap();

        attach();

        expect(map.getView().getListeners('change:center')?.length ?? 0).toBe(0);
      });

      it('falls back to loaded features for a layer without a configured extent', async () => {
        const config: MapConfig = { ...fitConfig, layers: [{ ...fitConfig.layers[0], cluster: false, extent: undefined }] };
        const { map, fit, attach } = await renderFittingMap(config);
        const point = fromLonLat([-0.1245, 51.5007]);
        const layer = map.getLayers().getArray().find((candidate) => candidate.get('id') === 'london') as VectorLayer<VectorSource>;
        layer.getSource()!.addFeature(new Feature(new Point(point)));

        attach();

        expect(fit).toHaveBeenCalledWith(boundingExtent([point]), expect.anything());
      });

      it('does nothing without fitToLayers', async () => {
        const { fit, attach } = await renderFittingMap({ ...fitConfig, view: testMapConfig.view });

        attach();

        expect(fit).not.toHaveBeenCalled();
      });

      it('stops listening on unmount', async () => {
        const { fit, attach, unmount } = await renderFittingMap();

        unmount();
        attach();

        expect(fit).not.toHaveBeenCalled();
      });
    });

    describe('zoomToLayers', () => {
      it('shows hidden layers and fits to every layer right away', async () => {
        const { result, map, fit } = await renderFittingMap({ ...fitConfig, view: testMapConfig.view });

        act(() => result.current.zoomToLayers());

        const hidden = map.getLayers().getArray().find((layer) => layer.get('id') === 'hidden')!;
        expect(hidden.getVisible()).toBe(true);
        expect(result.current.layerVisibility).toEqual({ london: true, paris: true, hidden: true });
        expect(fit).toHaveBeenCalledWith(
          toMap(LONDON, PARIS, BAY_AREA),
          expect.objectContaining({ duration: ZOOM_TO_LAYER_DURATION_MS }),
        );
      });

      it('does nothing when no layer has an extent or features', async () => {
        const config: MapConfig = {
          ...fitConfig,
          view: testMapConfig.view,
          layers: fitConfig.layers.map((layer) => ({ ...layer, cluster: false, extent: undefined })),
        };
        const { result, fit } = await renderFittingMap(config);

        act(() => result.current.zoomToLayers());

        expect(fit).not.toHaveBeenCalled();
      });
    });

    describe('zoomToLayer', () => {
      it('fits to the layer\'s configured extent', async () => {
        const { result, fit } = await renderFittingMap({ ...fitConfig, view: testMapConfig.view });

        act(() => result.current.zoomToLayer('paris'));

        expect(fit).toHaveBeenCalledWith(
          toMap(PARIS),
          expect.objectContaining({ maxZoom: ZOOM_TO_LAYER_MAX_ZOOM, duration: ZOOM_TO_LAYER_DURATION_MS }),
        );
      });

      it('shows a hidden layer and fits to it right away', async () => {
        const { result, map, fit } = await renderFittingMap({ ...fitConfig, view: testMapConfig.view });

        act(() => result.current.zoomToLayer('hidden'));

        expect(map.getLayers().getArray().find((layer) => layer.get('id') === 'hidden')!.getVisible()).toBe(true);
        expect(fit).toHaveBeenCalledWith(toMap(BAY_AREA), expect.anything());
      });

      it('falls back to the layer\'s loaded features without a configured extent', async () => {
        const { result } = await renderReadyMap();
        const map = result.current.map!;
        const points = [[-0.1245, 51.5007], [-0.0753, 51.5056]].map((lonLat) => fromLonLat(lonLat));
        const layer = map.getLayers().getArray().find((candidate) => candidate.get('id') === 'landmarks') as VectorLayer<VectorSource>;
        layer.getSource()!.addFeatures(points.map((point) => new Feature(new Point(point))));
        const fit = vi.spyOn(map.getView(), 'fit').mockImplementation(() => {});

        act(() => result.current.zoomToLayer('landmarks'));

        expect(fit).toHaveBeenCalledWith(boundingExtent(points), expect.anything());
      });

      it('ignores unknown layers', async () => {
        const { result, fit } = await renderFittingMap({ ...fitConfig, view: testMapConfig.view });

        act(() => result.current.zoomToLayer('nope'));

        expect(fit).not.toHaveBeenCalled();
      });
    });

    describe('with an area of interest', () => {
      // Around the Eiffel Tower; in the summary, Paris has one landmark inside and London none.
      const AOI = JSON.stringify({ type: 'Polygon', coordinates: [[[2.28, 48.85], [2.31, 48.85], [2.31, 48.87], [2.28, 48.87], [2.28, 48.85]]] });
      const EIFFEL: LonLatExtent = [2.2945, 48.8584, 2.2945, 48.8584];
      const summary: AoiSummary = {
        layers: {
          london: { count: 0, total: 10, extent: null },
          paris: { count: 1, total: 11, extent: EIFFEL },
          hidden: { count: 0, total: 16, extent: null },
        },
      };
      const getSource = (map: Map, id: string) =>
        (map.getLayers().getArray().find((layer) => layer.get('id') === id) as VectorLayer<VectorSource>).getSource()!;

      const renderWithAoi = async (layers = summary.layers) => {
        vi.spyOn(udl, 'getAoiSummary').mockResolvedValue({ layers });
        const hook = await renderFittingMap({ ...fitConfig, view: testMapConfig.view });
        act(() => hook.result.current.setAoi(AOI));
        await waitFor(() => expect(hook.result.current.aoiSummary).not.toBeNull());
        return hook;
      };

      it('has no summary without an area', async () => {
        const { result } = await renderFittingMap();

        expect(result.current.aoiSummary).toBeNull();
      });

      it('makes every data layer load only what\'s inside the area', async () => {
        const { map, result } = await renderWithAoi();

        expect(['london', 'paris', 'hidden'].map((id) => getSource(map, id).get('aoi'))).toEqual([AOI, AOI, AOI]);

        act(() => result.current.setAoi(null));

        expect(getSource(map, 'paris').get('aoi')).toBeNull();
      });

      it('loads how much of each layer is inside, and forgets it when the area is cleared', async () => {
        const { result } = await renderWithAoi();

        expect(udl.getAoiSummary).toHaveBeenCalledWith(AOI, expect.any(AbortSignal));
        expect(result.current.aoiSummary).toEqual(summary.layers);

        act(() => result.current.setAoi(null));

        expect(result.current.aoiSummary).toBeNull();
      });

      it('zooms to a layer\'s landmarks inside the area', async () => {
        const { result, fit } = await renderWithAoi();

        act(() => result.current.zoomToLayer('paris'));

        expect(fit).toHaveBeenCalledWith(toMap(EIFFEL), expect.anything());
      });

      it('doesn\'t move for a layer with nothing inside the area', async () => {
        const { result, fit } = await renderWithAoi();

        act(() => result.current.zoomToLayer('london'));

        expect(fit).not.toHaveBeenCalled();
      });

      it('zooms to all the landmarks inside the area', async () => {
        const { result, fit } = await renderWithAoi();

        act(() => result.current.zoomToLayers());

        expect(fit).toHaveBeenCalledWith(toMap(EIFFEL), expect.anything());
      });

      it('zooms to the area itself when nothing is inside', async () => {
        const { result, fit } = await renderWithAoi({
          london: { count: 0, total: 10, extent: null },
          paris: { count: 0, total: 11, extent: null },
          hidden: { count: 0, total: 16, extent: null },
        });

        act(() => result.current.zoomToLayers());

        expect(fit).toHaveBeenCalledWith(toMap([2.28, 48.85, 2.31, 48.87]), expect.anything());
      });

      it('reports a failed summary, and zooms to the area itself rather than everywhere', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(udl, 'getAoiSummary').mockRejectedValue(new Error('offline'));
        const { result, fit } = await renderFittingMap({ ...fitConfig, view: testMapConfig.view });

        act(() => result.current.setAoi(AOI));
        await waitFor(() => expect(result.current.aoiSummaryFailed).toBe(true));

        expect(console.error).toHaveBeenCalled();
        expect(result.current.aoiSummary).toBeNull();

        // The map shows no landmarks, so both zooms go to the area the error is about.
        const area = toMap([2.28, 48.85, 2.31, 48.87]);
        act(() => result.current.zoomToLayer('paris'));
        expect(fit).toHaveBeenLastCalledWith(area, expect.anything());
        act(() => result.current.zoomToLayers());
        expect(fit).toHaveBeenLastCalledWith(area, expect.anything());
      });

      it('forgets the failure once the area is cleared or redrawn', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(udl, 'getAoiSummary').mockRejectedValueOnce(new Error('offline')).mockResolvedValue(summary);
        const { result } = await renderFittingMap({ ...fitConfig, view: testMapConfig.view });
        act(() => result.current.setAoi(AOI));
        await waitFor(() => expect(result.current.aoiSummaryFailed).toBe(true));

        act(() => result.current.setAoi(null));
        expect(result.current.aoiSummaryFailed).toBe(false);

        const redrawn = AOI.replace('2.28', '2.27');
        act(() => result.current.setAoi(redrawn));
        await waitFor(() => expect(result.current.aoiSummary).toEqual(summary.layers));
        expect(result.current.aoiSummaryFailed).toBe(false);
      });
    });
  });

  it('toggles a data layer', async () => {
    const { result } = await renderReadyMap();
    const layer = result.current.map!.getLayers().getArray().find((l) => l.get('id') === 'landmarks')!;

    act(() => result.current.setLayerVisible('landmarks', false));

    expect(layer.getVisible()).toBe(false);
    expect(result.current.layerVisibility).toEqual({ landmarks: false });
  });

  it('disposes the map on unmount', async () => {
    const { result, unmount } = await renderReadyMap();
    const dispose = vi.spyOn(result.current.map!, 'dispose');

    unmount();

    expect(dispose).toHaveBeenCalled();
  });

  it('shares the area of interest: none at first, then whatever was set', async () => {
    const { result } = await renderReadyMap();
    const aoi = JSON.stringify({ type: 'Polygon', coordinates: [[[-122.5, 37.7], [-122.3, 37.7], [-122.4, 37.8], [-122.5, 37.7]]] });

    expect(result.current.aoi).toBeNull();

    act(() => result.current.setAoi(aoi));
    expect(result.current.aoi).toBe(aoi);

    act(() => result.current.setAoi(null));
    expect(result.current.aoi).toBeNull();
  });
});
