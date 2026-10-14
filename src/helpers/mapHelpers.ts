import type Map from 'ol/Map';
import GeoJSON from 'ol/format/GeoJSON';
import type LayerGroup from 'ol/layer/Group';
import VectorLayer from 'ol/layer/Vector';
import type { FeatureLike } from 'ol/Feature';
import type Feature from 'ol/Feature';
import { getCenter, getIntersection, isEmpty, type Extent } from 'ol/extent';
import { toLonLat, transformExtent } from 'ol/proj';
import VectorSource from 'ol/source/Vector';
import { Circle, Fill, Stroke, Style, Text } from 'ol/style';
import { createXYZ } from 'ol/tilegrid';
import { apply } from 'ol-mapbox-style';
import {
  API,
  DATA_LAYER_STYLE_DEFAULTS,
  MAP_TILE_SIZE,
  DATA_LAYER_Z_INDEX,
  MAPBOX_ATTRIBUTION,
  MAPBOX_HOSTS,
  MARKER_COLOR,
  PLACEHOLDER_TOKEN,
} from '@/constant/constant';
import {withAoi} from '@/helpers/aoiHelpers';
import {type MapDataLayerConfig, type MapDataLayerStyle} from 'MapTypes';
import {udl} from '@/udl/udl';
import {mulish} from '@/theme/fonts';
import {type SearchResult} from 'SearchTypes';

export const search = async (
  query: string,
  proximity: [number, number] | undefined,
  signal: AbortSignal,
): Promise<SearchResult[]> => {
  const params = new URLSearchParams({ q: query, auto_complete: "true", limit: "5" });
  if (proximity) params.set("proximity", proximity.join(","));

  const { features } = await udl.searchPlaces(params, signal);
  return features.map((f) => ({
    id: f.properties.mapbox_id ?? f.id,
    name: f.properties.name,
    description: f.properties.place_formatted ?? "",
    center: f.geometry.coordinates,
    bbox: f.properties.bbox,
  }));
}

export const toProxyRequest = (url: string, type: string): string | Request | undefined => {
  const parsed = new URL(url, location.href);

  if (!MAPBOX_HOSTS.test(parsed.hostname)) {
    return undefined
  }

  parsed.searchParams.delete('access_token');
  const proxied = `${API.mapboxProxy}${parsed.pathname}${parsed.search}`;

  // ol-mapbox-style ignores plain strings for sprite images; it needs a Request.
  return type === 'SpriteImage' ? new Request(proxied) : proxied;
}

export const createMarkerStyle = (): Style => new Style({
  image: new Circle({
    radius: 8,
    fill: new Fill({ color: MARKER_COLOR }),
    stroke: new Stroke({ color: '#ffffff', width: 3 }),
  }),
});

// Search biases results toward this point. Always send it: without proximity,
// Mapbox falls back to the requester's IP, which behind our proxy is the server's.
export const getMapCenterLonLat = (map: Map | null): [number, number] | undefined => {
  const center = map?.getView().getCenter();
  return center ? (toLonLat(center) as [number, number]) : undefined;
}

// Loads a Mapbox style into a layer group, replacing whatever the group held.
// Keeping the style in its own group lets it be swapped without touching the
// data layers or the search marker.
export const applyBasemapStyle = async (group: LayerGroup, styleUrl: string): Promise<void> => {
  group.getLayers().clear();

  await apply(group, styleUrl, {
    accessToken: PLACEHOLDER_TOKEN,
    transformRequest: toProxyRequest,
  });

  // The style's mapbox:// sources carry no attribution, so add it. The control
  // de-duplicates identical entries.
  for (const layer of group.getLayersArray()) {
    layer.getSource()?.setAttributions(MAPBOX_ATTRIBUTION);
  }
}

// A data layer's point style with the defaults filled in, so the map and the
// layer list's legend always agree.
export const getDataLayerStyle = (style: MapDataLayerStyle = {}): Required<MapDataLayerStyle> => ({
  ...DATA_LAYER_STYLE_DEFAULTS,
  ...style,
});

const createDataLayerStyle = (style?: MapDataLayerStyle): Style => {
  const { fill, stroke, width, radius } = getDataLayerStyle(style);

  return new Style({
    fill: new Fill({ color: fill }),
    stroke: new Stroke({ color: stroke, width }),
    image: new Circle({
      radius,
      fill: new Fill({ color: fill }),
      stroke: new Stroke({ color: stroke, width }),
    }),
  });
}

// A cluster's circle grows a little with its count: up to 9, up to 49, 50+.
const getClusterRadius = (count: number) => (count < 10 ? 12 : count < 50 ? 15 : 18);

// Single points look as they always have; a cluster is a bigger circle in the
// layer's color with its count inside. Styles are cached (OpenLayers asks for
// them on every frame).
const createClusterAwareStyle = (style?: MapDataLayerStyle) => {
  const { fill, stroke, width } = getDataLayerStyle(style);
  const pointStyle = createDataLayerStyle(style);
  const clusterStyles: Record<number, Style> = {};

  return (feature: FeatureLike): Style => {
    if (!feature.get('cluster')) {
      return pointStyle;
    }

    const count = feature.get('point_count') as number;
    if (!clusterStyles[count]) {
      clusterStyles[count] = new Style({
        image: new Circle({
          radius: getClusterRadius(count),
          fill: new Fill({ color: fill }),
          stroke: new Stroke({ color: stroke, width }),
        }),
        text: new Text({
          text: String(count),
          // The app's font (see fonts.ts); canvas text can't use CSS variables.
          font: `700 12px ${mulish.style.fontFamily}, sans-serif`,
          fill: new Fill({ color: '#ffffff' }),
        }),
      });
    }
    return clusterStyles[count];
  };
};

// The area of interest a data layer's source loads for (see setDataLayerAoi).
const getSourceAoi = (source: VectorSource): string | null => source.get('aoi') ?? null;

// A source that loads a layer's server-side clusters for the map tiles on
// screen, only of the features inside the area of interest when there is one.
// Clusters depend on the zoom, so when the (whole) zoom level changes the source
// starts over, and replies for an old zoom or an old area are dropped.
const createClusterSource = (config: MapDataLayerConfig): VectorSource => {
  const tileGrid = createXYZ({ tileSize: MAP_TILE_SIZE, maxZoom: 22 });
  const format = new GeoJSON();
  // Only tiles around the layer's features can hold anything (a cluster's
  // position is an average of its points), so skip the rest of the screen.
  // createXYZ grids always have an extent (the whole Web Mercator world).
  const loadableArea = config.extent
    ? transformExtent(config.extent, 'EPSG:4326', 'EPSG:3857')
    : tileGrid.getExtent()!;
  let currentZ: number | undefined;

  const source: VectorSource = new VectorSource({
    attributions: config.attribution,
    strategy: (extent: Extent, resolution: number) => {
      const z = tileGrid.getZForResolution(resolution);

      if (z !== currentZ) {
        // Forget the previous zoom's clusters and which tiles were loaded.
        // (refresh, not clear: clear keeps the record of loaded tiles, so the
        // new zoom's tiles would count as already loaded.)
        if (currentZ !== undefined) {
          source.refresh();
        }
        currentZ = z;
      }

      const toLoad = getIntersection(extent, loadableArea);
      const tileExtents: Extent[] = [];
      if (toLoad && !isEmpty(toLoad)) {
        tileGrid.forEachTileCoord(toLoad, z, (tileCoord) => {
          tileExtents.push(tileGrid.getTileCoordExtent(tileCoord));
        });
      }
      return tileExtents;
    },
    loader: (extent, resolution, projection, success, failure) => {
      const z = tileGrid.getZForResolution(resolution);
      const [, x, y] = tileGrid.getTileCoordForCoordAndZ(getCenter(extent), z);
      const aoi = getSourceAoi(source);

      udl.getLayerClusters(config.id, z, x, y, aoi)
        .then((data) => {
          if (z !== currentZ || aoi !== getSourceAoi(source)) {
            success?.([]);
            return;
          }
          const features = format.readFeatures(data, { featureProjection: projection });
          source.addFeatures(features);
          success?.(features);
        })
        .catch(() => failure?.());
    },
  });

  return source;
};

// Builds the OpenLayers layer for a data layer from the map config. The layer
// carries its config id so it can be found again (see setLayerVisible).
export const createDataLayer = (config: MapDataLayerConfig): VectorLayer => {
  const source: VectorSource = config.cluster
    ? createClusterSource(config)
    : new VectorSource<Feature>({
      // Read on every load, so a refresh after setDataLayerAoi uses the new area.
      url: () => withAoi(config.url, getSourceAoi(source)),
      format: new GeoJSON<Feature>(),
      attributions: config.attribution,
    });
  const layer = new VectorLayer({
    source,
    style: config.cluster ? createClusterAwareStyle(config.style) : createDataLayerStyle(config.style),
    visible: config.visible,
    zIndex: DATA_LAYER_Z_INDEX,
  });

  layer.set('id', config.id);

  return layer;
}

// Shows only the data layer's features inside the area of interest (a GeoJSON
// Polygon string), or all of them for null: the server filters, so the layer
// reloads. Does nothing when the area hasn't changed.
export const setDataLayerAoi = (layer: VectorLayer, aoi: string | null): void => {
  const source = layer.getSource();

  if (!source || getSourceAoi(source) === aoi) {
    return;
  }

  source.set('aoi', aoi);
  source.refresh();
};

// Formats longitude/latitude for display, e.g. "37.80240° N, 122.40580° W".
// Five decimals is roughly one meter.
export const formatLonLat = ([lon, lat]: [number, number]): string => {
  const latitude = `${Math.abs(lat).toFixed(5)}° ${lat < 0 ? 'S' : 'N'}`;
  const longitude = `${Math.abs(lon).toFixed(5)}° ${lon < 0 ? 'W' : 'E'}`;

  return `${latitude}, ${longitude}`;
}
