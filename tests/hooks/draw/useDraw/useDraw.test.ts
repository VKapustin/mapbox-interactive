import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import Map from 'ol/Map';
import View from 'ol/View';
import MapBrowserEvent from 'ol/MapBrowserEvent';
import { DoubleClickZoom, Draw } from 'ol/interaction';
import type VectorLayer from 'ol/layer/Vector';
import type VectorSource from 'ol/source/Vector';
import { fromLonLat } from 'ol/proj';
import { useDraw } from '@/hooks/draw';
import { useMap } from '@/hooks/map';
import { DRAW_Z_INDEX } from '@/constant/constant';
import { createMapContextValue } from '@tests/support/mapFixtures';

vi.mock('@/hooks/map', () => ({ useMap: vi.fn() }));

// A small triangle near San Francisco, in lon/lat.
const TRIANGLE: [number, number][] = [[-122.5, 37.7], [-122.3, 37.7], [-122.4, 37.8]];

const getDraw = (map: Map) =>
  map.getInteractions().getArray().find((interaction) => interaction instanceof Draw) as Draw | undefined;

const getAoiLayer = (map: Map) =>
  map.getLayers().getArray().find((layer) => layer.getZIndex() === DRAW_Z_INDEX) as VectorLayer<VectorSource> | undefined;

// Draws a polygon through the corners, the way clicks would, and finishes it.
// Draw leaves the map a moment after finishing (see useDraw), so this waits for that.
const drawPolygon = async (map: Map, corners = TRIANGLE) => {
  act(() => {
    const draw = getDraw(map)!;
    draw.appendCoordinates(corners.map((corner) => fromLonLat(corner)));
    draw.finishDrawing();
  });
  await act(() => new Promise((resolve) => setTimeout(resolve)));
};

describe('useDraw', () => {
  let map: Map;
  // The map context's setAoi, as another component (e.g. a filter) would call it.
  let setAoiFromElsewhere: (aoi: string | null) => void;
  // Every value useDraw passed to setAoi.
  let aoiUpdates: (string | null)[];
  // The AOI in the map context as of the last render (useDraw doesn't return it).
  let contextAoi: string | null;

  beforeEach(() => {
    // Draw works in screen pixels, so the map needs a size and a rendered frame.
    // jsdom has no canvas to draw layers on, so the frames OpenLayers would
    // schedule later are skipped. (Stubbed before the map exists, because the
    // map hands its render method to its layers' change listeners.)
    vi.spyOn(Map.prototype, 'render').mockImplementation(() => {});
    map = new Map({ target: document.createElement('div'), view: new View({ center: fromLonLat([-122.4, 37.75]), zoom: 10 }) });
    map.setSize([800, 600]);
    map.renderSync();
    aoiUpdates = [];
    // The AOI lives in the map context (useMap); keep it in real state here so
    // the hook sees its own updates, as it does under a MapProvider.
    vi.mocked(useMap).mockImplementation(() => {
      const [aoi, setAoi] = useState<string | null>(null);
      setAoiFromElsewhere = setAoi;
      contextAoi = aoi;
      return createMapContextValue({ map, aoi, setAoi: (next) => {
        aoiUpdates.push(next);
        setAoi(next);
      } });
    });
  });

  it('starts with no area and not drawing, and adds its layer above the landmarks', () => {
    const { result } = renderHook(() => useDraw());

    expect(contextAoi).toBeNull();
    expect(result.current.isDrawing).toBe(false);
    expect(getAoiLayer(map)).toBeDefined();
    expect(getDraw(map)).toBeUndefined();
  });

  it('adds a polygon Draw interaction when drawing starts', () => {
    const { result } = renderHook(() => useDraw());

    act(() => result.current.startDrawing());

    expect(result.current.isDrawing).toBe(true);
    expect(getDraw(map)).toBeDefined();
  });

  it('only ever has one Draw interaction', () => {
    const { result } = renderHook(() => useDraw());

    act(() => result.current.startDrawing());
    act(() => result.current.startDrawing());

    expect(map.getInteractions().getArray().filter((interaction) => interaction instanceof Draw)).toHaveLength(1);
  });

  it('gives the finished polygon as lon/lat GeoJSON and stops drawing', async () => {
    const { result } = renderHook(() => useDraw());

    act(() => result.current.startDrawing());
    await drawPolygon(map);

    const aoi = JSON.parse(contextAoi!);
    expect(aoi.type).toBe('Polygon');
    // A closed ring: the corners, then the first one again.
    expect(aoi.coordinates[0]).toEqual([...TRIANGLE, TRIANGLE[0]]);
    expect(result.current.isDrawing).toBe(false);
    expect(getDraw(map)).toBeUndefined();
    expect(getAoiLayer(map)!.getSource()!.getFeatures()).toHaveLength(1);
  });

  it('doesn\'t zoom in on the double-click that finishes the polygon', () => {
    const { result } = renderHook(() => useDraw());
    const doubleClickZoom = map.getInteractions().getArray().find((interaction) => interaction instanceof DoubleClickZoom)!;
    const handleEvent = vi.spyOn(doubleClickZoom, 'handleEvent');

    act(() => result.current.startDrawing());
    act(() => {
      const draw = getDraw(map)!;
      draw.appendCoordinates(TRIANGLE.map((corner) => fromLonLat(corner)));
      draw.finishDrawing();
      // OpenLayers sends the double-click straight after the click that finished it.
      map.handleMapBrowserEvent(new MapBrowserEvent('dblclick', map, new PointerEvent('dblclick')));
    });

    expect(contextAoi).not.toBeNull();
    expect(handleEvent).not.toHaveBeenCalled();
  });

  it('moves an area drawn on a repeated copy of the world back within ±180°', async () => {
    const { result } = renderHook(() => useDraw());

    act(() => result.current.startDrawing());
    // The triangle two worlds to the east, as drawn when zoomed far out.
    await drawPolygon(map, TRIANGLE.map(([lon, lat]) => [lon + 720, lat] as [number, number]));

    const [ring] = JSON.parse(contextAoi!).coordinates;
    expect(ring.map(([lon]: number[]) => Math.round(lon * 1e6) / 1e6)).toEqual([...TRIANGLE, TRIANGLE[0]].map(([lon]) => lon));
  });

  it('doesn\'t use an area the server would reject', async () => {
    const { result } = renderHook(() => useDraw());
    // More corners than AOI_MAX_VERTICES allows.
    const tooMany = Array.from({ length: 400 }, (_, i) => {
      const angle = (i / 400) * 2 * Math.PI;
      return [-122.4 + 0.05 * Math.cos(angle), 37.75 + 0.05 * Math.sin(angle)] as [number, number];
    });

    act(() => result.current.startDrawing());
    await drawPolygon(map, tooMany);

    expect(contextAoi).toBeNull();
    expect(result.current.isDrawing).toBe(false);
    // Reported, so the user knows why the polygon disappeared.
    expect(result.current.areaRejected).toBe(true);

    act(() => result.current.startDrawing());
    expect(result.current.areaRejected).toBe(false);
  });

  it('dismisses the rejection when the area is cleared', async () => {
    const { result } = renderHook(() => useDraw());
    const tooMany = Array.from({ length: 400 }, (_, i) => {
      const angle = (i / 400) * 2 * Math.PI;
      return [-122.4 + 0.05 * Math.cos(angle), 37.75 + 0.05 * Math.sin(angle)] as [number, number];
    });
    // A previous area stays on the map, so the eraser has something to clear.
    act(() => result.current.startDrawing());
    await drawPolygon(map);
    act(() => result.current.startDrawing());
    await drawPolygon(map, tooMany);
    expect(result.current.areaRejected).toBe(true);

    act(() => result.current.clearDrawing());

    expect(result.current.areaRejected).toBe(false);
    expect(contextAoi).toBeNull();
  });

  it('replaces the previous area with a newly finished one', async () => {
    const { result } = renderHook(() => useDraw());

    act(() => result.current.startDrawing());
    await drawPolygon(map);
    act(() => result.current.startDrawing());
    await drawPolygon(map, [[2.29, 48.85], [2.35, 48.85], [2.32, 48.88]]);

    expect(getAoiLayer(map)!.getSource()!.getFeatures()).toHaveLength(1);
    expect(JSON.parse(contextAoi!).coordinates[0][0]).toEqual([2.29, 48.85]);
  });

  it('keeps the finished area when a new drawing is cancelled', async () => {
    const { result } = renderHook(() => useDraw());

    act(() => result.current.startDrawing());
    await drawPolygon(map);
    const aoi = contextAoi;
    act(() => result.current.startDrawing());
    act(() => result.current.stopDrawing());

    expect(contextAoi).toBe(aoi);
    expect(result.current.isDrawing).toBe(false);
    expect(getDraw(map)).toBeUndefined();
    expect(getAoiLayer(map)!.getSource()!.getFeatures()).toHaveLength(1);
  });

  it('cancels drawing on Escape', () => {
    const { result } = renderHook(() => useDraw());

    act(() => result.current.startDrawing());
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(result.current.isDrawing).toBe(false);
    expect(getDraw(map)).toBeUndefined();
  });

  it('marks the Escape it handled', () => {
    const { result } = renderHook(() => useDraw());
    const escape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });

    act(() => result.current.startDrawing());
    act(() => {
      document.dispatchEvent(escape);
    });

    expect(escape.defaultPrevented).toBe(true);
  });

  it('keeps drawing on an Escape a focused control already used (e.g. the search box)', () => {
    const { result } = renderHook(() => useDraw());
    // As MUI's search box does when Escape closes its suggestions.
    const closePopup = (event: KeyboardEvent) => event.preventDefault();
    document.addEventListener('keydown', closePopup, true);

    act(() => result.current.startDrawing());
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    });
    document.removeEventListener('keydown', closePopup, true);

    expect(result.current.isDrawing).toBe(true);
    expect(getDraw(map)).toBeDefined();
  });

  it('draws by clicking only, without Shift+drag freehand (the AOI travels in URLs)', () => {
    const { result } = renderHook(() => useDraw());

    act(() => result.current.startDrawing());

    // Draw keeps its options private; freehandCondition_ decides when a drag draws freehand.
    const draw = getDraw(map) as unknown as { freehandCondition_: (event: unknown) => boolean };
    const shiftDrag = { originalEvent: { shiftKey: true, altKey: false, metaKey: false, ctrlKey: false } };
    expect(draw.freehandCondition_(shiftDrag)).toBe(false);
  });

  it('clears the area and any drawing', async () => {
    const { result } = renderHook(() => useDraw());

    act(() => result.current.startDrawing());
    await drawPolygon(map);
    act(() => result.current.startDrawing());
    act(() => result.current.clearDrawing());

    expect(contextAoi).toBeNull();
    expect(result.current.isDrawing).toBe(false);
    expect(getDraw(map)).toBeUndefined();
    expect(getAoiLayer(map)!.getSource()!.getFeatures()).toHaveLength(0);
  });

  it('removes its layer and interaction on unmount', () => {
    const { result, unmount } = renderHook(() => useDraw());

    act(() => result.current.startDrawing());
    unmount();

    expect(getAoiLayer(map)).toBeUndefined();
    expect(getDraw(map)).toBeUndefined();
  });

  it('does nothing without a map', () => {
    vi.mocked(useMap).mockImplementation(() => createMapContextValue({ map: null }));
    const { result } = renderHook(() => useDraw());

    act(() => result.current.startDrawing());

    expect(result.current.isDrawing).toBe(false);
  });

  describe('with the AOI as the single source of truth', () => {
    const PARIS_AOI = JSON.stringify({
      type: 'Polygon',
      coordinates: [[[2.29, 48.85], [2.35, 48.85], [2.32, 48.88], [2.29, 48.85]]],
    });
    const getPolygons = () => getAoiLayer(map)!.getSource()!.getFeatures();

    it('shows an AOI set elsewhere', () => {
      renderHook(() => useDraw());

      act(() => setAoiFromElsewhere(PARIS_AOI));

      expect(getPolygons()).toHaveLength(1);
    });

    it('removes the polygon when the AOI is cleared elsewhere', async () => {
      const { result } = renderHook(() => useDraw());

      act(() => result.current.startDrawing());
      await drawPolygon(map);
      act(() => setAoiFromElsewhere(null));

      expect(getPolygons()).toHaveLength(0);
    });

    it('shows nothing for an AOI that isn\'t valid GeoJSON', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      renderHook(() => useDraw());

      act(() => setAoiFromElsewhere('not json'));

      expect(getPolygons()).toHaveLength(0);
      expect(console.error).toHaveBeenCalled();
    });

    it('keeps the AOI when the drawing tool unmounts', async () => {
      const { result, unmount } = renderHook(() => useDraw());

      act(() => result.current.startDrawing());
      await drawPolygon(map);
      unmount();

      // It belongs to the map context, so another component can still use it.
      expect(aoiUpdates).toHaveLength(1);
      expect(aoiUpdates[0]).not.toBeNull();
    });
  });
});
