import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import Feature from 'ol/Feature';
import Map from 'ol/Map';
import View from 'ol/View';
import Point from 'ol/geom/Point';
import Polygon from 'ol/geom/Polygon';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Draw } from 'ol/interaction';
import { fromLonLat } from 'ol/proj';
import type BaseEvent from 'ol/events/Event';
import type SimpleGeometry from 'ol/geom/SimpleGeometry';
import { useFeatureSelect } from '@/hooks/map/useFeatureSelect/useFeatureSelect';
import { useMap } from '@/hooks/map/useMap/useMap';
import { FEATURE_HIT_TOLERANCE, ZOOM_TO_LAYER_DURATION_MS } from '@/constant/constant';
import { createMapContextValue } from '@tests/support/mapFixtures';

vi.mock('@/hooks/map/useMap/useMap', () => ({ useMap: vi.fn() }));

const createLandmarkLayer = () => {
  const layer = new VectorLayer({ source: new VectorSource() });
  layer.set('id', 'landmarks');
  return layer;
};

const createLandmark = (name: string | undefined, lonLat: [number, number]) =>
  new Feature({ geometry: new Point(fromLonLat(lonLat)), ...(name ? { name } : {}) });

// jsdom can't render the map, so hit detection is stubbed: whatever `hit`
// holds is what the map reports under the pointer.
const stubHitDetection = (map: Map) => {
  const state: { hit: { feature: Feature; layer: VectorLayer } | null } = { hit: null };

  vi.spyOn(map, 'forEachFeatureAtPixel').mockImplementation((_pixel, callback, options) => {
    if (!state.hit || !options?.layerFilter?.(state.hit.layer)) {
      return undefined;
    }
    return callback(state.hit.feature, state.hit.layer, state.hit.feature.getGeometry() as SimpleGeometry);
  });
  vi.spyOn(map, 'hasFeatureAtPixel').mockImplementation((_pixel, options) =>
    !!state.hit && !!options?.layerFilter?.(state.hit.layer));

  return state;
};

const dispatch = (map: Map, type: string, extra: Record<string, unknown> = {}) =>
  act(() => {
    map.dispatchEvent({ type, pixel: [10, 10], dragging: false, ...extra } as unknown as BaseEvent);
  });

describe('useFeatureSelect', () => {
  let map: Map;
  let target: HTMLDivElement;
  let landmarks: VectorLayer;

  beforeEach(() => {
    target = document.createElement('div');
    map = new Map({ target, view: new View({ center: fromLonLat([-122.2, 37.6]), zoom: 10 }) });
    landmarks = createLandmarkLayer();
    vi.mocked(useMap).mockReturnValue(createMapContextValue({ map, layerVisibility: { landmarks: true } }));
  });

  it('starts with nothing selected', () => {
    const { result } = renderHook(() => useFeatureSelect());

    expect(result.current.selected).toBeNull();
  });

  it('selects the clicked landmark with its name and coordinates', () => {
    const hits = stubHitDetection(map);
    const coit = createLandmark('Coit Tower', [-122.4058, 37.8024]);
    hits.hit = { feature: coit, layer: landmarks };
    const { result } = renderHook(() => useFeatureSelect());

    dispatch(map, 'singleclick');

    const selected = result.current.selected!;
    expect(selected.name).toBe('Coit Tower');
    expect(selected.layerId).toBe('landmarks');
    expect(selected.coordinate).toEqual((coit.getGeometry() as Point).getCoordinates());
    expect(selected.lonLat[0]).toBeCloseTo(-122.4058, 6);
    expect(selected.lonLat[1]).toBeCloseTo(37.8024, 6);
  });

  it('zooms into a cluster where it splits, instead of selecting it', () => {
    const hits = stubHitDetection(map);
    const center = fromLonLat([2.33, 48.86]);
    const cluster = new Feature({ geometry: new Point(center), cluster: true, point_count: 10, expansion_zoom: 13 });
    hits.hit = { feature: cluster, layer: landmarks };
    const animate = vi.spyOn(map.getView(), 'animate').mockImplementation(() => {});
    const { result } = renderHook(() => useFeatureSelect());

    dispatch(map, 'singleclick');

    expect(animate).toHaveBeenCalledWith(expect.objectContaining({
      center,
      zoom: 13,
      duration: ZOOM_TO_LAYER_DURATION_MS,
    }));
    expect(result.current.selected).toBeNull();
  });

  it('never zooms into a cluster beyond the view\'s maximum zoom', () => {
    const hits = stubHitDetection(map);
    map.getView().setMaxZoom(12);
    hits.hit = {
      feature: new Feature({ geometry: new Point([0, 0]), cluster: true, point_count: 3, expansion_zoom: 17 }),
      layer: landmarks,
    };
    const animate = vi.spyOn(map.getView(), 'animate').mockImplementation(() => {});
    renderHook(() => useFeatureSelect());

    dispatch(map, 'singleclick');

    expect(animate).toHaveBeenCalledWith(expect.objectContaining({ zoom: 12 }));
  });

  it('closes an open popup when a cluster is clicked', () => {
    const hits = stubHitDetection(map);
    vi.spyOn(map.getView(), 'animate').mockImplementation(() => {});
    hits.hit = { feature: createLandmark('Coit Tower', [-122.4058, 37.8024]), layer: landmarks };
    const { result } = renderHook(() => useFeatureSelect());
    dispatch(map, 'singleclick');
    expect(result.current.selected?.name).toBe('Coit Tower');

    hits.hit = { feature: new Feature({ geometry: new Point([0, 0]), cluster: true, point_count: 2, expansion_zoom: 8 }), layer: landmarks };
    dispatch(map, 'singleclick');

    expect(result.current.selected).toBeNull();
  });

  it('includes the description when the feature has one', () => {
    const hits = stubHitDetection(map);
    const coit = createLandmark('Coit Tower', [-122.4058, 37.8024]);
    coit.set('description', 'Art Deco tower on Telegraph Hill.');
    hits.hit = { feature: coit, layer: landmarks };
    const { result } = renderHook(() => useFeatureSelect());

    dispatch(map, 'singleclick');

    expect(result.current.selected?.description).toBe('Art Deco tower on Telegraph Hill.');
  });

  it('leaves the description out when the feature has none', () => {
    const hits = stubHitDetection(map);
    hits.hit = { feature: createLandmark('Coit Tower', [-122.4058, 37.8024]), layer: landmarks };
    const { result } = renderHook(() => useFeatureSelect());

    dispatch(map, 'singleclick');

    expect(result.current.selected?.description).toBeUndefined();
  });

  it('includes the photo when the feature has one', () => {
    const hits = stubHitDetection(map);
    const image = {
      url: '/landmarks/coit-tower.jpg',
      author: 'Ryan Schwark',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Coit_Tower_1.jpg',
    };
    const coit = createLandmark('Coit Tower', [-122.4058, 37.8024]);
    coit.set('image', image);
    hits.hit = { feature: coit, layer: landmarks };
    const { result } = renderHook(() => useFeatureSelect());

    dispatch(map, 'singleclick');

    expect(result.current.selected?.image).toEqual(image);
  });

  it('includes the Wikipedia article title when the feature has one', () => {
    const hits = stubHitDetection(map);
    const coit = createLandmark('Coit Tower', [-122.4058, 37.8024]);
    coit.set('wikipediaTitle', 'Coit_Tower');
    hits.hit = { feature: coit, layer: landmarks };
    const { result } = renderHook(() => useFeatureSelect());

    dispatch(map, 'singleclick');

    expect(result.current.selected?.wikipediaTitle).toBe('Coit_Tower');
  });

  it('ignores a photo without a URL', () => {
    const hits = stubHitDetection(map);
    const coit = createLandmark('Coit Tower', [-122.4058, 37.8024]);
    coit.set('image', { author: 'Someone' });
    hits.hit = { feature: coit, layer: landmarks };
    const { result } = renderHook(() => useFeatureSelect());

    dispatch(map, 'singleclick');

    expect(result.current.selected?.image).toBeUndefined();
  });

  it('looks for features with a hit tolerance', () => {
    stubHitDetection(map);
    renderHook(() => useFeatureSelect());

    dispatch(map, 'singleclick');

    expect(map.forEachFeatureAtPixel).toHaveBeenCalledWith(
      [10, 10],
      expect.any(Function),
      expect.objectContaining({ hitTolerance: FEATURE_HIT_TOLERANCE }),
    );
  });

  it('ignores features on layers without an id, like the basemap and search marker', () => {
    const hits = stubHitDetection(map);
    hits.hit = { feature: createLandmark('Road', [-122.4, 37.8]), layer: new VectorLayer({ source: new VectorSource() }) };
    const { result } = renderHook(() => useFeatureSelect());

    dispatch(map, 'singleclick');

    expect(result.current.selected).toBeNull();
  });

  it('anchors non-point features at the middle of their extent', () => {
    const hits = stubHitDetection(map);
    const area = new Feature({ geometry: new Polygon([[[0, 0], [100, 0], [100, 50], [0, 50], [0, 0]]]), name: 'Park' });
    hits.hit = { feature: area, layer: landmarks };
    const { result } = renderHook(() => useFeatureSelect());

    dispatch(map, 'singleclick');

    expect(result.current.selected?.coordinate).toEqual([50, 25]);
  });

  it('falls back to a placeholder name', () => {
    const hits = stubHitDetection(map);
    hits.hit = { feature: createLandmark(undefined, [-122.4, 37.8]), layer: landmarks };
    const { result } = renderHook(() => useFeatureSelect());

    dispatch(map, 'singleclick');

    expect(result.current.selected?.name).toBe('Unnamed feature');
  });

  it('clears the selection when empty map is clicked', () => {
    const hits = stubHitDetection(map);
    hits.hit = { feature: createLandmark('Coit Tower', [-122.4058, 37.8024]), layer: landmarks };
    const { result } = renderHook(() => useFeatureSelect());
    dispatch(map, 'singleclick');

    hits.hit = null;
    dispatch(map, 'singleclick');

    expect(result.current.selected).toBeNull();
  });

  it('clears the selection on request', () => {
    const hits = stubHitDetection(map);
    hits.hit = { feature: createLandmark('Coit Tower', [-122.4058, 37.8024]), layer: landmarks };
    const { result } = renderHook(() => useFeatureSelect());
    dispatch(map, 'singleclick');

    act(() => result.current.clearSelected());

    expect(result.current.selected).toBeNull();
  });

  it('hides the selection while its layer is hidden', () => {
    const hits = stubHitDetection(map);
    hits.hit = { feature: createLandmark('Coit Tower', [-122.4058, 37.8024]), layer: landmarks };
    const { result, rerender } = renderHook(() => useFeatureSelect());
    dispatch(map, 'singleclick');

    vi.mocked(useMap).mockReturnValue(createMapContextValue({ map, layerVisibility: { landmarks: false } }));
    rerender();

    expect(result.current.selected).toBeNull();
  });

  it('shows a pointer cursor over selectable features only', () => {
    const hits = stubHitDetection(map);
    renderHook(() => useFeatureSelect());

    hits.hit = { feature: createLandmark('Coit Tower', [-122.4058, 37.8024]), layer: landmarks };
    dispatch(map, 'pointermove');
    expect(target.style.cursor).toBe('pointer');

    hits.hit = null;
    dispatch(map, 'pointermove');
    expect(target.style.cursor).toBe('');
  });

  it('leaves the cursor alone while dragging', () => {
    const hits = stubHitDetection(map);
    renderHook(() => useFeatureSelect());
    hits.hit = { feature: createLandmark('Coit Tower', [-122.4058, 37.8024]), layer: landmarks };

    dispatch(map, 'pointermove', { dragging: true });

    expect(map.hasFeatureAtPixel).not.toHaveBeenCalled();
    expect(target.style.cursor).toBe('');
  });

  it('removes its listeners and the cursor on unmount', () => {
    const hits = stubHitDetection(map);
    const { result, unmount } = renderHook(() => useFeatureSelect());
    hits.hit = { feature: createLandmark('Coit Tower', [-122.4058, 37.8024]), layer: landmarks };
    dispatch(map, 'pointermove');

    unmount();
    dispatch(map, 'singleclick');

    expect(target.style.cursor).toBe('');
    expect(result.current.selected).toBeNull();
    expect(map.forEachFeatureAtPixel).not.toHaveBeenCalled();
  });

  describe('while the user is drawing', () => {
    const startDrawing = () => {
      const draw = new Draw({ type: 'Polygon' });
      map.addInteraction(draw);
      return draw;
    };

    it('doesn\'t select the clicked landmark, since the click places a corner', () => {
      const hits = stubHitDetection(map);
      hits.hit = { feature: createLandmark('Coit Tower', [-122.4058, 37.8024]), layer: landmarks };
      startDrawing();
      const { result } = renderHook(() => useFeatureSelect());

      dispatch(map, 'singleclick');

      expect(result.current.selected).toBeNull();
    });

    it('doesn\'t zoom into a clicked cluster', () => {
      const hits = stubHitDetection(map);
      const animate = vi.spyOn(map.getView(), 'animate');
      hits.hit = { feature: new Feature({ geometry: new Point([0, 0]), cluster: true, point_count: 2, expansion_zoom: 8 }), layer: landmarks };
      startDrawing();
      renderHook(() => useFeatureSelect());

      dispatch(map, 'singleclick');

      expect(animate).not.toHaveBeenCalled();
    });

    it('shows no pointer cursor over landmarks', () => {
      const hits = stubHitDetection(map);
      hits.hit = { feature: createLandmark('Coit Tower', [-122.4058, 37.8024]), layer: landmarks };
      startDrawing();
      renderHook(() => useFeatureSelect());

      dispatch(map, 'pointermove');

      expect(target.style.cursor).toBe('');
    });

    it('selects again once drawing stops', () => {
      const hits = stubHitDetection(map);
      hits.hit = { feature: createLandmark('Coit Tower', [-122.4058, 37.8024]), layer: landmarks };
      const draw = startDrawing();
      const { result } = renderHook(() => useFeatureSelect());

      map.removeInteraction(draw);
      dispatch(map, 'singleclick');

      expect(result.current.selected?.name).toBe('Coit Tower');
    });
  });

  describe('with an area of interest', () => {
    const aoiAround = ([lon, lat]: [number, number]) => JSON.stringify({
      type: 'Polygon',
      coordinates: [[[lon - 0.01, lat - 0.01], [lon + 0.01, lat - 0.01], [lon + 0.01, lat + 0.01], [lon - 0.01, lat + 0.01], [lon - 0.01, lat - 0.01]]],
    });
    const COIT: [number, number] = [-122.4058, 37.8024];

    const selectCoit = (aoi: string | null) => {
      vi.mocked(useMap).mockReturnValue(createMapContextValue({ map, layerVisibility: { landmarks: true }, aoi }));
      const hits = stubHitDetection(map);
      hits.hit = { feature: createLandmark('Coit Tower', COIT), layer: landmarks };
      const hook = renderHook(() => useFeatureSelect());
      dispatch(map, 'singleclick');
      return hook;
    };

    it('keeps a selection inside the area', () => {
      const { result } = selectCoit(aoiAround(COIT));

      expect(result.current.selected?.name).toBe('Coit Tower');
    });

    it('hides a selection once an area that leaves it out is drawn', () => {
      const { result, rerender } = selectCoit(null);

      vi.mocked(useMap).mockReturnValue(createMapContextValue({
        map, layerVisibility: { landmarks: true }, aoi: aoiAround([2.2945, 48.8584]),
      }));
      rerender();

      expect(result.current.selected).toBeNull();
    });
  });
});
