'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type FC,
  type ReactNode,
} from 'react';
import Map from 'ol/Map';
import {defaults as defaultControls} from 'ol/control/defaults';
import {Attribution} from 'ol/control';
import LayerGroup from 'ol/layer/Group';
import type VectorLayer from 'ol/layer/Vector';
import type VectorSource from 'ol/source/Vector';
import {createEmpty, extend, isEmpty, type Extent} from 'ol/extent';
import {unByKey} from 'ol/Observable';
import type {EventsKey} from 'ol/events';
import View from 'ol/View';
import {fromLonLat, transformExtent} from 'ol/proj';
import {applyBasemapStyle, createDataLayer, setDataLayerAoi} from '@/helpers/mapHelpers';
import {getAoiExtent, parseAoi} from '@/helpers/aoiHelpers';
import {udl} from '@/udl/udl';
import {
  BASEMAP_Z_INDEX,
  ZOOM_TO_LAYER_DURATION_MS,
  ZOOM_TO_LAYER_MAX_ZOOM,
  ZOOM_TO_LAYER_PADDING,
} from '@/constant/constant';
import {type AoiLayerSummary, type MapConfig, type MapStatus} from 'MapTypes';

type MapContextValue = {
  // Published once the first style request settles (null before that); attach
  // it to an element with map.setTarget(). Still published if the style fails.
  map: Map | null;
  // 'loading' on start and while switching styles; 'error' if the style failed.
  status: MapStatus;
  config: MapConfig;
  styleId: string;
  // Ignored while a style is loading.
  setStyle: (styleId: string) => void;
  layerVisibility: Record<string, boolean>;
  setLayerVisible: (layerId: string, visible: boolean) => void;
  // The area of interest: a GeoJSON Polygon geometry string in lon/lat
  // (EPSG:4326), or null. While it's set, the data layers show only the
  // features inside it (the server filters them).
  aoi: string | null;
  setAoi: (aoi: string | null) => void;
  // For the current AOI, how many of each layer's features are inside it, by
  // layer id. Null without an AOI, and while it's loading (or if it failed).
  aoiSummary: Record<string, AoiLayerSummary> | null;
  // True when the summary for the current AOI failed to load (e.g. the server
  // rejected the area); the landmark layers' requests likely failed too.
  aoiSummaryFailed: boolean;
  // Fits the view to a data layer's features (only those inside the AOI while
  // there is one), showing the layer first if hidden.
  zoomToLayer: (layerId: string) => void;
  // Shows every data layer and fits the view to all of their features (only
  // those inside the AOI while there is one; the AOI itself if none are).
  zoomToLayers: () => void;
};

type MapState = {
  map: Map | null;
  // Holds the Mapbox style's layers so a style switch can replace just those.
  basemap: LayerGroup | null;
  status: MapStatus;
  styleId: string;
};

const MapContext = createContext<MapContextValue | null>(null);

// Data layers from the map config carry their config id; the basemap and the search marker don't.
const getDataLayers = (map: Map) =>
  map.getLayers().getArray().filter((layer) => layer.get('id') !== undefined) as VectorLayer<VectorSource>[];

// Fits the view to an extent, padded by up to ZOOM_TO_LAYER_PADDING (less on
// small screens, where a fixed padding would leave little room for the map).
const fitView = (map: Map, extent: Extent | null, duration: number) => {
  if (!extent || isEmpty(extent)) {
    return;
  }

  const [width, height] = map.getSize() ?? [0, 0];
  const padding = Math.min(ZOOM_TO_LAYER_PADDING, Math.round(Math.min(width, height) * 0.1));

  map.getView().fit(extent, {
    padding: Array(4).fill(padding),
    maxZoom: ZOOM_TO_LAYER_MAX_ZOOM,
    duration,
  });
};

// Where a layer's features are, in the map's projection. The server puts each
// layer's bounding box in the config, which also covers clustered layers (they
// only ever load what's on screen) and layers that haven't loaded yet. Without
// one, fall back to the features loaded so far. With an AOI summary, only the
// features inside the area count (an empty extent if there are none).
const getLayerExtent = (
  map: Map,
  config: MapConfig,
  layer: VectorLayer<VectorSource>,
  aoiSummary?: Record<string, AoiLayerSummary> | null,
): Extent => {
  const inAoi = aoiSummary?.[layer.get('id')];

  if (inAoi) {
    return inAoi.extent
      ? transformExtent(inAoi.extent, 'EPSG:4326', map.getView().getProjection())
      : createEmpty();
  }

  const extent = config.layers.find((candidate) => candidate.id === layer.get('id'))?.extent;

  return extent
    ? transformExtent(extent, 'EPSG:4326', map.getView().getProjection())
    : layer.getSource()?.getExtent() ?? createEmpty();
};

// The combined extent of the given layers (empty if none).
const getLayersExtent = (
  map: Map,
  config: MapConfig,
  layers: VectorLayer<VectorSource>[],
  aoiSummary?: Record<string, AoiLayerSummary> | null,
): Extent =>
  layers.reduce((extent, layer) => extend(extent, getLayerExtent(map, config, layer, aoiSummary)), createEmpty());

// Fits the view to all visible data layers as soon as the map has a size (it
// gets one when MapCanvas attaches it), so the fit suits the screen the map
// opens on. If the user moves the map first, the fit is skipped so it doesn't
// take the map away from them.
const fitToLayersOnStart = (map: Map, config: MapConfig): EventsKey[] => {
  const view = map.getView();
  let userMoved = false;

  // Until the fit, nothing else changes the view, so any change is the user's:
  // dragging, wheel or pinch zoom, the zoom buttons, search, "zoom to layer".
  // (Resizing the map doesn't change the view.)
  const markMoved = () => {
    userMoved = true;
  };
  const moveKeys = [
    view.on('change:center', markMoved),
    view.on('change:resolution', markMoved),
    view.on('change:rotation', markMoved),
  ];

  const sizeKey = map.on('change:size', () => {
    const [width, height] = map.getSize() ?? [0, 0];

    if (width === 0 || height === 0) {
      return;
    }

    unByKey([...moveKeys, sizeKey]);

    if (!userMoved) {
      const visible = getDataLayers(map).filter((layer) => layer.getVisible());
      fitView(map, getLayersExtent(map, config, visible), 0);
    }
  });

  return [...moveKeys, sizeKey];
};

const getStyle = (config: MapConfig, styleId: string) =>
  config.styles.find((style) => style.id === styleId) ?? config.styles[0];

const getInitialState = (config: MapConfig): MapState => ({
  map: null,
  basemap: null,
  status: 'loading',
  styleId: getStyle(config, config.defaultStyleId).id,
});

const useMapHookSource = (config: MapConfig): MapContextValue => {
  const [state, setState] = useState<MapState>(() => getInitialState(config));
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(config.layers.map((layer) => [layer.id, layer.visible])),
  );
  const [ aoi, setAoi ] = useState<string | null>(null);

  // The last AOI summary loaded (or failed to load), with the AOI it's for.
  const [loadedSummary, setLoadedSummary] = useState<
    { aoi: string; layers: Record<string, AoiLayerSummary> } | { aoi: string; failed: true } | null
  >(null);
  const currentSummary = aoi && loadedSummary?.aoi === aoi ? loadedSummary : null;
  const aoiSummary = currentSummary && 'layers' in currentSummary ? currentSummary.layers : null;
  const aoiSummaryFailed = !!currentSummary && 'failed' in currentSummary;

  // The data layers show only the features inside the AOI (all of them without one).
  useEffect(() => {
    if (state.map) {
      getDataLayers(state.map).forEach((layer) => setDataLayerAoi(layer, aoi));
    }
  }, [state.map, aoi]);

  // Loads how much of each layer is inside the AOI.
  useEffect(() => {
    if (!aoi) {
      return;
    }

    const controller = new AbortController();

    udl.getAoiSummary(aoi, controller.signal)
      .then(({ layers }) => setLoadedSummary({ aoi, layers }))
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.error('Failed to load the area of interest summary', err);
          setLoadedSummary({ aoi, failed: true });
        }
      });

    return () => controller.abort();
  }, [aoi]);

  useEffect(() => {
    let cancelled = false;

    const basemap = new LayerGroup({ zIndex: BASEMAP_Z_INDEX });
    const instance = new Map({
      // Zoom buttons come from the MapZoomControls component instead.
      controls: defaultControls({ attribution: false, zoom: false }).extend([
        new Attribution({ collapsible: false }),
      ]),
      view: new View({
        center: fromLonLat(config.view.center),
        zoom: config.view.zoom,
        minZoom: config.view.minZoom,
        maxZoom: config.view.maxZoom,
      }),
      layers: [basemap, ...config.layers.map(createDataLayer)],
    });
    const style = getStyle(config, config.defaultStyleId);
    const fitKeys = config.view.fitToLayers ? fitToLayersOnStart(instance, config) : [];

    applyBasemapStyle(basemap, style.url)
      .then(() => {
        if (!cancelled) {
          setState({ map: instance, basemap, status: 'ready', styleId: style.id });
        }
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }

        console.error('Failed to load map style', err);
        setState({ map: instance, basemap, status: 'error', styleId: style.id });
      });

    return () => {
      cancelled = true;
      unByKey(fitKeys);
      instance.setTarget(undefined);
      instance.dispose();
      setState(getInitialState(config));
    };
  }, [config]);

  const setStyle = (styleId: string): void => {
    const { basemap, status } = state;

    // Waiting for the current load avoids two styles filling the group at once.
    if (!basemap || status === 'loading' || styleId === state.styleId) {
      return;
    }

    const style = getStyle(config, styleId);
    const isCurrent = (current: MapState) => current.basemap === basemap;

    setState((current) => ({ ...current, status: 'loading', styleId: style.id }));

    applyBasemapStyle(basemap, style.url)
      .then(() => {
        setState((current) => (isCurrent(current) ? { ...current, status: 'ready' } : current));
      })
      .catch((err) => {
        console.error('Failed to load map style', err);
        setState((current) => (isCurrent(current) ? { ...current, status: 'error' } : current));
      });
  };

  const setLayerVisible = (layerId: string, visible: boolean): void => {
    state.map?.getLayers().forEach((layer) => {
      if (layer.get('id') === layerId) {
        layer.setVisible(visible);
      }
    });

    setLayerVisibility((current) => ({ ...current, [layerId]: visible }));
  };

  // Fits the view to the drawn area itself; false if there is none.
  const fitToAoi = (map: Map): boolean => {
    const parsedAoi = aoi ? parseAoi(aoi) : null;

    if (parsedAoi) {
      fitView(map, transformExtent(getAoiExtent(parsedAoi), 'EPSG:4326', map.getView().getProjection()), ZOOM_TO_LAYER_DURATION_MS);
    }
    return !!parsedAoi;
  };

  // Shows the layer if it's hidden and fits the view to it, right away: its
  // extent comes from the config (or the AOI summary), so nothing needs to load
  // first. A layer with nothing inside the AOI stays where it is.
  const zoomToLayer = (layerId: string): void => {
    const { map } = state;
    const layer = map && getDataLayers(map).find((candidate) => candidate.get('id') === layerId);

    if (!map || !layer) {
      return;
    }

    if (!layer.getVisible()) {
      setLayerVisible(layerId, true);
    }

    // The area's landmarks couldn't be loaded (the map shows none): show the
    // area the error is about, not the layer's landmarks everywhere.
    if (aoiSummaryFailed && fitToAoi(map)) {
      return;
    }

    fitView(map, getLayerExtent(map, config, layer, aoiSummary), ZOOM_TO_LAYER_DURATION_MS);
  };

  // Shows every data layer and fits the view to all of them, right away.
  const zoomToLayers = (): void => {
    const { map } = state;

    if (!map) {
      return;
    }

    const layers = getDataLayers(map);

    layers
      .filter((layer) => !layer.getVisible())
      .forEach((layer) => setLayerVisible(layer.get('id'), true));

    const extent = getLayersExtent(map, config, layers, aoiSummary);

    // Nothing inside the AOI, or its landmarks couldn't be loaded: show the area itself.
    if ((aoiSummaryFailed || isEmpty(extent)) && fitToAoi(map)) {
      return;
    }

    fitView(map, extent, ZOOM_TO_LAYER_DURATION_MS);
  };

  return {
    map: state.map,
    status: state.status,
    config,
    styleId: state.styleId,
    setStyle,
    layerVisibility,
    setLayerVisible,
    aoi,
    setAoi,
    aoiSummary,
    aoiSummaryFailed,
    zoomToLayer,
    zoomToLayers,
  };
}

export const MapProvider: FC<{ config: MapConfig; children: ReactNode }> = ({ config, children }) => {
  const hookMapInstance = useMapHookSource(config);

  return (
    <MapContext.Provider value={ hookMapInstance }>
      {children}
    </MapContext.Provider>
  )
}

export const useMap = (): MapContextValue => {
  const context = useContext(MapContext);

  if (!context) {
    throw new Error('useMap must be used within a MapProvider');
  }

  return context;
}
