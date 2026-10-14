import 'server-only';
import {STYLE_THUMBNAIL_SIZE, STYLE_THUMBNAIL_ZOOM_OFFSET} from '@/constant/constant';
import {getLayerExtent} from '@/server/map/clusters';
import {type MapConfig, type MapStyleOption, type MapViewConfig} from 'MapTypes';

type MapConfigSource = Omit<MapConfig, 'styles'> & {
  styles: Omit<MapStyleOption, 'imageUrl'>[];
};

// The map's setup. To move it to a database or CMS later, change only getMapConfig().
const MAP_CONFIG: MapConfigSource = {
  view: {
    // Opens fitted to every visible layer (the USA and Europe) for the
    // screen size; this center and zoom only show until the layers have loaded.
    // "Zoom to layer" takes you into one.
    center: [-60, 45],
    zoom: 3,
    // Low enough that a phone can fit San Francisco and Athens side by side.
    minZoom: 1,
    maxZoom: 19,
    fitToLayers: true,
  },
  styles: [
    { id: 'streets', label: 'Streets', url: 'mapbox://styles/mapbox/streets-v12' },
    { id: 'outdoors', label: 'Outdoors', url: 'mapbox://styles/mapbox/outdoors-v12' },
    { id: 'light', label: 'Light', url: 'mapbox://styles/mapbox/light-v11' },
    { id: 'dark', label: 'Dark', url: 'mapbox://styles/mapbox/dark-v11' },
    { id: 'satellite', label: 'Satellite', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
  ],
  defaultStyleId: 'streets',
  // One layer of landmarks per country: the USA first, then Europe A-Z.
  layers: [
    {
      id: 'usa-landmarks',
      label: 'USA',
      type: 'geojson',
      url: '/api/map/layers/usa-landmarks',
      visible: true,
      cluster: true,
      style: { fill: '#f97316', stroke: '#ffffff', width: 2, radius: 6 },
    },
    {
      id: 'czechia-landmarks',
      label: 'Czechia',
      type: 'geojson',
      url: '/api/map/layers/czechia-landmarks',
      visible: true,
      cluster: true,
      style: { fill: '#db2777', stroke: '#ffffff', width: 2, radius: 6 },
    },
    {
      id: 'france-landmarks',
      label: 'France',
      type: 'geojson',
      url: '/api/map/layers/france-landmarks',
      visible: true,
      cluster: true,
      style: { fill: '#7c3aed', stroke: '#ffffff', width: 2, radius: 6 },
    },
    {
      id: 'germany-landmarks',
      label: 'Germany',
      type: 'geojson',
      url: '/api/map/layers/germany-landmarks',
      visible: true,
      cluster: true,
      style: { fill: '#334155', stroke: '#ffffff', width: 2, radius: 6 },
    },
    {
      id: 'greece-landmarks',
      label: 'Greece',
      type: 'geojson',
      url: '/api/map/layers/greece-landmarks',
      visible: true,
      cluster: true,
      style: { fill: '#0891b2', stroke: '#ffffff', width: 2, radius: 6 },
    },
    {
      id: 'italy-landmarks',
      label: 'Italy',
      type: 'geojson',
      url: '/api/map/layers/italy-landmarks',
      visible: true,
      cluster: true,
      style: { fill: '#16a34a', stroke: '#ffffff', width: 2, radius: 6 },
    },
    {
      id: 'spain-landmarks',
      label: 'Spain',
      type: 'geojson',
      url: '/api/map/layers/spain-landmarks',
      visible: true,
      cluster: true,
      style: { fill: '#ca8a04', stroke: '#ffffff', width: 2, radius: 6 },
    },
    {
      id: 'uk-landmarks',
      label: 'United Kingdom',
      type: 'geojson',
      url: '/api/map/layers/uk-landmarks',
      visible: true,
      cluster: true,
      style: { fill: '#dc2626', stroke: '#ffffff', width: 2, radius: 6 },
    },
  ],
};

// Where the style thumbnails look: a fixed Bay Area view, close enough to show
// streets and water. (The starting view is too far out for a 32px picture.)
export const STYLE_THUMBNAIL_VIEW: MapViewConfig = { center: [-122.2, 37.6], zoom: 10 };

// A Static Images API picture of the style around the given view, loaded
// through the /api/mapbox proxy. Mapbox's logo and attribution are left off the
// tiny image because the page already shows both.
export const getStyleThumbnailUrl = (styleUrl: string, view: MapViewConfig): string => {
  const stylePath = styleUrl.replace(/^mapbox:\/\/styles\//, '');
  const [lon, lat] = view.center;
  const zoom = Math.max(view.zoom - STYLE_THUMBNAIL_ZOOM_OFFSET, 0);
  const size = `${STYLE_THUMBNAIL_SIZE}x${STYLE_THUMBNAIL_SIZE}@2x`;

  return `/api/mapbox/styles/v1/${stylePath}/static/${lon},${lat},${zoom}/${size}?attribution=false&logo=false`;
}

export const getMapConfig = async (): Promise<MapConfig> => ({
  ...MAP_CONFIG,
  styles: MAP_CONFIG.styles.map((style) => ({
    ...style,
    imageUrl: getStyleThumbnailUrl(style.url, STYLE_THUMBNAIL_VIEW),
  })),

  // Each layer's bounding box, so the map can fit to layers without loading
  // them first (clustered layers only ever load what's on screen).
  layers: await Promise.all(MAP_CONFIG.layers.map(async (layer) => ({
    ...layer,
    extent: await getLayerExtent(layer.id),
  }))),
});
