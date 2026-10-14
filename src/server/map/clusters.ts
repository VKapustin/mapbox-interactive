import 'server-only';
import Supercluster, {type ClusterProperties, type PointFeature} from 'supercluster';
import {CLUSTER_MAX_ZOOM, CLUSTER_RADIUS_PX, MAP_TILE_SIZE} from '@/constant/constant';
import {type AoiPolygon, getLonLatExtent, isInAoi} from '@/helpers/aoiHelpers';
import {getMapLayerData, getMapLayerIds} from '@/server/map/mapLayers';
import {type AoiSummary, type GeoJSONFeatureCollection, type LonLat, type LonLatExtent} from 'MapTypes';

type LayerProperties = Record<string, unknown>;
type LayerFeature = GeoJSONFeatureCollection['features'][number];

// Supercluster indexes, built on first use. A layer's full index is kept for
// the life of the server process (the data only changes with a deploy). Indexes
// of a layer filtered to an area of interest are kept for the most recently
// used areas only, since every drawn area is new.
const indexes = new Map<string, Promise<Supercluster<LayerProperties> | undefined>>();
const aoiIndexes = new Map<string, Promise<Supercluster<LayerProperties> | undefined>>();
const MAX_AOI_INDEXES = 100;

const position = (feature: LayerFeature) => feature.geometry.coordinates as LonLat;

// The layer's features, only those inside the AOI when there is one.
const getFeatures = async (layerId: string, aoi?: AoiPolygon): Promise<LayerFeature[] | undefined> => {
  const data = await getMapLayerData(layerId);
  return aoi ? data?.features.filter((feature) => isInAoi(aoi, position(feature))) : data?.features;
};

const buildIndex = async (layerId: string, aoi?: AoiPolygon) => {
  const features = await getFeatures(layerId, aoi);

  if (!features) {
    return undefined;
  }

  // `extent` matches the map's 256px tiles, so the radius is in screen pixels at
  // OpenLayers' zoom levels and the zooms passed in are the map's own.
  return new Supercluster<LayerProperties>({
    radius: CLUSTER_RADIUS_PX,
    extent: MAP_TILE_SIZE,
    maxZoom: CLUSTER_MAX_ZOOM,
  }).load(features as PointFeature<LayerProperties>[]);
};

const getIndex = async (layerId: string, aoi?: AoiPolygon) => {
  // Only real layers get an index, so requests for made-up ids can't fill the
  // caches (the full-layer ones are never emptied).
  if (!(await getMapLayerIds()).includes(layerId)) {
    return undefined;
  }

  if (!aoi) {
    if (!indexes.has(layerId)) {
      indexes.set(layerId, buildIndex(layerId));
    }
    return indexes.get(layerId)!;
  }

  const key = `${layerId}\n${JSON.stringify(aoi)}`;
  const cached = aoiIndexes.get(key);

  if (cached) {
    // Map keeps insertion order: re-inserting marks it as the most recently used.
    aoiIndexes.delete(key);
    aoiIndexes.set(key, cached);
    return cached;
  }

  const index = buildIndex(layerId, aoi);
  aoiIndexes.set(key, index);
  if (aoiIndexes.size > MAX_AOI_INDEXES) {
    aoiIndexes.delete(aoiIndexes.keys().next().value!);
  }
  return index;
};

// The [west, south, east, north] of an XYZ (Web Mercator) tile.
export const tileToLonLatExtent = (z: number, x: number, y: number): LonLatExtent => {
  const n = 2 ** z;
  const lon = (tx: number) => (tx / n) * 360 - 180;
  const lat = (ty: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * ty) / n))) * 180) / Math.PI;

  return [lon(x), lat(y + 1), lon(x + 1), lat(y)];
};

// The clusters and single points whose position falls in one map tile, counting
// only the features inside the AOI when there is one. Each cluster carries
// `point_count` and `expansion_zoom` (the zoom at which it splits); single
// points keep their own properties.
export const getLayerClusters = async (
  layerId: string,
  z: number,
  x: number,
  y: number,
  aoi?: AoiPolygon,
): Promise<GeoJSONFeatureCollection | undefined> => {
  const index = await getIndex(layerId, aoi);

  if (!index) {
    return undefined;
  }

  const features = index.getClusters(tileToLonLatExtent(z, x, y), z).map((feature) => {
    const properties = feature.properties as Partial<ClusterProperties>;

    return properties.cluster
      ? {
        ...feature,
        properties: {
          ...properties,
          expansion_zoom: index.getClusterExpansionZoom(properties.cluster_id!),
        },
      }
      : feature;
  });

  return { type: 'FeatureCollection', features } as GeoJSONFeatureCollection;
};

// The layer's features as GeoJSON, only those inside the AOI when there is one.
export const getLayerFeatures = async (layerId: string, aoi?: AoiPolygon): Promise<GeoJSONFeatureCollection | undefined> => {
  const features = await getFeatures(layerId, aoi);
  return features && { type: 'FeatureCollection', features };
};

const getExtent = (features: LayerFeature[]): LonLatExtent | undefined =>
  getLonLatExtent(features.map(position));

// [west, south, east, north] around all of a layer's points (only those inside
// the AOI when there is one); undefined when there are none.
export const getLayerExtent = async (layerId: string, aoi?: AoiPolygon): Promise<LonLatExtent | undefined> => {
  const features = await getFeatures(layerId, aoi);
  return features && getExtent(features);
};

// For every layer: how many of its features are inside the AOI, out of how
// many, and the bounding box of those inside.
export const getAoiSummary = async (aoi: AoiPolygon): Promise<AoiSummary> => {
  const ids = await getMapLayerIds();
  const entries = await Promise.all(ids.map(async (id) => {
    const all = (await getFeatures(id)) ?? [];
    const inside = (await getFeatures(id, aoi)) ?? [];

    return [id, { count: inside.length, total: all.length, extent: getExtent(inside) ?? null }] as const;
  }));

  return { layers: Object.fromEntries(entries) };
};
