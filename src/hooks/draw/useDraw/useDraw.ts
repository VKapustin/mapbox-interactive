'use client';

import { type RefObject, useEffect, useRef, useState } from 'react';
import Feature from 'ol/Feature';
import { Draw } from 'ol/interaction';
import { never } from 'ol/events/condition';
import type Map from 'ol/Map';
import GeoJSON from 'ol/format/GeoJSON';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Fill, Stroke, Style } from 'ol/style';
import { useMap } from '@/hooks/map';
import { useEscape } from '@/hooks/escape';
import { AOI_COLOR, AOI_COORDINATE_DECIMALS, DRAW_Z_INDEX } from '@/constant/constant';
import { parseAoi } from '@/helpers/aoiHelpers';
import { getWidth } from 'ol/extent';
import type Polygon from 'ol/geom/Polygon';
import CircleStyle from 'ol/style/Circle';

// The area itself is `aoi` in the map context (useMap), the single source of
// truth; the polygon on the map always shows it, whoever set it.
type DrawState = {
  // True while the user is placing the polygon's corners.
  isDrawing: boolean;
  // Starts drawing a new polygon: click to add corners, double-click (or click
  // the first corner) to finish. The new area replaces the previous one when
  // it's finished; Escape cancels.
  startDrawing: () => void;
  // Cancels the polygon being drawn; a previously finished area stays.
  stopDrawing: () => void;
  // Cancels any drawing and removes the area of interest.
  clearDrawing: () => void;
  // True when the last polygon drawn couldn't be used, so it wasn't set as the
  // area (e.g. more corners than AOI_MAX_VERTICES); until the next drawing.
  areaRejected: boolean;
  dismissAreaRejected: () => void;
};

const aoiFormat = new GeoJSON();

const createAoiStyle = () =>
  new Style({
    image: new CircleStyle({
      radius: 4,
      fill: new Fill({
        color: AOI_COLOR,
      }),
    }),
    stroke: new Stroke({ color: AOI_COLOR, width: 1 }),
    fill: new Fill({ color: `${AOI_COLOR}26` }), // ~15% opacity
  });

// Takes the Draw interaction in `ref` off the map, if there is one.
const removeDraw = (map: Map | null, ref: RefObject<Draw | null>): void => {
  if (map && ref.current) {
    map.removeInteraction(ref.current);
  }
  ref.current = null;
};

// Shows the area of interest on the shared map, and lets the user draw a new
// one (a polygon) or clear it. Drawing only ever calls setAoi(); the polygon on
// the map is redrawn from `aoi`.
export const useDraw = (): DrawState => {
  const {
    map,
    aoi,
    setAoi,
  } = useMap();
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [areaRejected, setAreaRejected] = useState(false);

  const sourceRef = useRef<VectorSource | null>(null);
  const drawRef = useRef<Draw | null>(null);

  const removeDrawInteraction = (): void => removeDraw(map, drawRef);

  // A layer for the area, above the landmarks and below the search marker.
  useEffect(() => {
    if (!map) {
      return;
    }

    const source = new VectorSource();
    const layer = new VectorLayer({ source, style: createAoiStyle(), zIndex: DRAW_Z_INDEX });

    map.addLayer(layer);
    sourceRef.current = source;

    return () => {
      removeDraw(map, drawRef);
      map.removeLayer(layer);
      sourceRef.current = null;
      setIsDrawing(false);
    };
  }, [map]);

  // Draws `aoi` on the layer whenever it changes, or empties the layer when it's null.
  useEffect(() => {
    const source = sourceRef.current;

    if (!map || !source) {
      return;
    }

    source.clear();

    if (!aoi) {
      return;
    }

    try {
      const geometry = aoiFormat.readGeometry(aoi, {
        dataProjection: 'EPSG:4326',
        featureProjection: map.getView().getProjection(),
      });
      if (geometry) {
        source.addFeature(new Feature(geometry));
      }
    } catch (err) {
      console.error('Invalid area of interest', err);
    }
  }, [map, aoi]);

  const stopDrawing = (): void => {
    removeDrawInteraction();
    setIsDrawing(false);
  };

  // Escape cancels the polygon being drawn, like closing a dialog (before
  // anything opened earlier, such as the details drawer).
  useEscape(isDrawing, stopDrawing);

  const startDrawing = (): void => {
    if (!map) {
      return;
    }

    removeDrawInteraction();
    setAreaRejected(false);

    // No source: Draw only reports the finished polygon, and setting it as the
    // AOI puts it on the layer (replacing the previous area).
    // Clicks only: Draw's default Shift+drag freehand mode adds a corner on every
    // pointer move, and the AOI travels in request URLs (see AOI_MAX_LENGTH).
    const draw = new Draw({ type: 'Polygon', style: createAoiStyle(), freehandCondition: never });

    draw.on('drawend', (event) => {
      // Zoomed far out, the map repeats the world side by side, and a shape
      // drawn on a copy has longitudes past ±180°. Move it back by whole worlds
      // so its first corner is within ±180° (the server matches points across
      // one world either side).
      const projection = map.getView().getProjection();
      const geometry = (event.feature.getGeometry() as Polygon).clone();
      const worldWidth = getWidth(projection.getExtent());
      const [firstX] = geometry.getFirstCoordinate();
      geometry.translate(-Math.round(firstX / worldWidth) * worldWidth, 0);

      const aoi = aoiFormat.writeGeometry(geometry, {
        dataProjection: 'EPSG:4326',
        featureProjection: projection,
        decimals: AOI_COORDINATE_DECIMALS,
      });

      // Only an area the server accepts (e.g. at most AOI_MAX_VERTICES corners);
      // anything else would fail every request and empty the landmark layers.
      if (parseAoi(aoi)) {
        setAoi(aoi);
      } else {
        setAreaRejected(true);
      }

      setIsDrawing(false);

      // A double click finishes the polygon on its second click, and OpenLayers
      // then sends the double-click event right away. Draw swallows it; if Draw
      // were already gone, the map would zoom in. So remove Draw just after.
      setTimeout(() => {
        map.removeInteraction(draw);
        if (drawRef.current === draw) {
          drawRef.current = null;
        }
      });
    });

    map.addInteraction(draw);
    drawRef.current = draw;
    setIsDrawing(true);
  };

  const clearDrawing = (): void => {
    stopDrawing();
    setAoi(null);
    // Nothing is left for a "too many corners" warning to refer to.
    setAreaRejected(false);
  };

  return {
    areaRejected,
    dismissAreaRejected: () => setAreaRejected(false),
    isDrawing,
    startDrawing,
    stopDrawing,
    clearDrawing,
  };
}
