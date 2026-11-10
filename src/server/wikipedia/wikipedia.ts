import 'server-only';
import {getMapLayerData, getMapLayerIds} from '@/server/map/mapLayers';

// Wikimedia asks server-side clients to identify themselves with contact details:
// https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy
export const WIKIMEDIA_USER_AGENT =
  process.env.WIKIMEDIA_USER_AGENT ?? 'mapbox-interactive/0.1 (server proxy for map feature details)';

const getAllFeatureProperties = async () => {
  const ids = await getMapLayerIds();
  const collections = await Promise.all(ids.map((id) => getMapLayerData(id)));

  return collections.flatMap((collection) =>
    (collection?.features ?? []).map((feature) => feature.properties ?? {}));
};

const buildAllowedTitles = async (): Promise<Set<string>> => {
  const properties = await getAllFeatureProperties();

  return new Set(properties.flatMap((p) => (typeof p.wikipediaTitle === 'string' ? [p.wikipediaTitle] : [])));
};

// Built once and kept for the life of the server process, like the cluster
// indexes: the layer data only changes with a deploy. (Data that can change
// while the app runs would need this rebuilt when it does.)
let allowedTitles: Promise<Set<string>> | undefined;

// The summary route only serves articles the map data links to, so it can't be
// used to fetch arbitrary Wikipedia content through this server.
export const getAllowedWikipediaTitles = (): Promise<Set<string>> => {
  // A failed build isn't kept, so the next request tries again (e.g. after a
  // database hiccup, once the data lives in one).
  allowedTitles ??= buildAllowedTitles().catch((err: unknown) => {
    allowedTitles = undefined;
    throw err;
  });
  return allowedTitles;
};
