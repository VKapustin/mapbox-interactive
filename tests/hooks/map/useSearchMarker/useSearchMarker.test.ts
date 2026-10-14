import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import Map from 'ol/Map';
import View from 'ol/View';
import VectorLayer from 'ol/layer/Vector';
import type VectorSource from 'ol/source/Vector';
import type Point from 'ol/geom/Point';
import { fromLonLat, toLonLat } from 'ol/proj';
import { useSearchMarker } from '@/hooks/map/useSearchMarker/useSearchMarker';
import { useMap } from '@/hooks/map/useMap/useMap';
import { MARKER_Z_INDEX } from '@/constant/constant';
import { createMapContextValue } from '@tests/support/mapFixtures';
import { type SearchResult } from 'SearchTypes';

vi.mock('@/hooks/map/useMap/useMap', () => ({ useMap: vi.fn() }));

const coitTower: SearchResult = {
  id: 'coit',
  name: 'Coit Tower',
  description: 'San Francisco, California',
  center: [-122.4058, 37.8024],
};

const getMarkerLayer = (map: Map) =>
  map.getLayers().getArray().find((layer) => layer.getZIndex() === MARKER_Z_INDEX) as VectorLayer<VectorSource> | undefined;

describe('useSearchMarker', () => {
  let map: Map;

  beforeEach(() => {
    map = new Map({ view: new View({ center: fromLonLat([-122.2, 37.6]), zoom: 9 }) });
    vi.mocked(useMap).mockReturnValue(createMapContextValue({ map }));
  });

  it('adds a marker layer above the other layers and removes it on unmount', () => {
    const { unmount } = renderHook(() => useSearchMarker());

    expect(getMarkerLayer(map)).toBeInstanceOf(VectorLayer);

    unmount();

    expect(getMarkerLayer(map)).toBeUndefined();
  });

  it('does nothing without a map', () => {
    vi.mocked(useMap).mockReturnValue(createMapContextValue({ map: null }));
    const { result } = renderHook(() => useSearchMarker());

    expect(() => result.current.showResult(coitTower)).not.toThrow();
  });

  it('places the marker on the result and zooms to it', () => {
    const animate = vi.spyOn(map.getView(), 'animate').mockImplementation(() => {});
    const { result } = renderHook(() => useSearchMarker());

    act(() => result.current.showResult(coitTower));

    const features = getMarkerLayer(map)!.getSource()!.getFeatures();
    expect(features).toHaveLength(1);
    const [lon, lat] = toLonLat((features[0].getGeometry() as Point).getCoordinates());
    expect(lon).toBeCloseTo(-122.4058, 6);
    expect(lat).toBeCloseTo(37.8024, 6);
    expect(animate).toHaveBeenCalledWith(expect.objectContaining({ zoom: 15 }));
  });

  it('fits the view to the result bounding box when there is one', () => {
    const fit = vi.spyOn(map.getView(), 'fit').mockImplementation(() => {});
    const { result } = renderHook(() => useSearchMarker());

    act(() => result.current.showResult({ ...coitTower, bbox: [-122.52, 37.70, -122.35, 37.83] }));

    expect(fit).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({ maxZoom: 16 }));
  });

  it('keeps a single marker across results', () => {
    vi.spyOn(map.getView(), 'animate').mockImplementation(() => {});
    const { result } = renderHook(() => useSearchMarker());

    act(() => result.current.showResult(coitTower));
    act(() => result.current.showResult({ ...coitTower, id: 'ggb', center: [-122.4783, 37.8199] }));

    expect(getMarkerLayer(map)!.getSource()!.getFeatures()).toHaveLength(1);
  });

  it('removes the marker on clear', () => {
    vi.spyOn(map.getView(), 'animate').mockImplementation(() => {});
    const { result } = renderHook(() => useSearchMarker());

    act(() => result.current.showResult(coitTower));
    act(() => result.current.clearResult());

    expect(getMarkerLayer(map)!.getSource()!.getFeatures()).toHaveLength(0);
  });
});
