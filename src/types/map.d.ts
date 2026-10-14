declare module 'MapTypes' {
  type LonLat = [number, number];

  type MapViewConfig = {
    center: LonLat;
    zoom: number;
    minZoom?: number;
    maxZoom?: number;
    // Once the visible data layers have loaded, fit the view to all of their
    // features for the screen it opens on; center and zoom apply until then.
    fitToLayers?: boolean;
  };

  type MapStyleOption = {
    id: string;
    label: string;
    // A mapbox://styles/... URL; it is loaded through the /api/mapbox proxy.
    url: string;
    // Thumbnail for the style picker; filled in by getMapConfig().
    imageUrl: string;
  };

  type MapDataLayerStyle = {
    fill?: string;
    stroke?: string;
    width?: number;
    // Radius for point features.
    radius?: number;
  };

  // [west, south, east, north] in longitude / latitude.
  type LonLatExtent = [number, number, number, number];

  type MapDataLayerConfig = {
    id: string;
    label: string;
    type: 'geojson';
    url: string;
    visible: boolean;
    // Load the layer as server-side clusters, tile by tile, instead of all its points.
    cluster?: boolean;
    // Bounding box of the layer's features; filled in by getMapConfig().
    extent?: LonLatExtent;
    attribution?: string;
    style?: MapDataLayerStyle;
  };

  type MapConfig = {
    view: MapViewConfig;
    styles: MapStyleOption[];
    defaultStyleId: string;
    layers: MapDataLayerConfig[];
  };

  // A photo shown in the feature popup, with the credit its license requires.
  type MapFeatureImage = {
    url: string;
    author: string;
    license: string;
    licenseUrl: string;
    // Where the photo comes from, e.g. its Wikimedia Commons page.
    sourceUrl: string;
  };

  type MapStatus = 'loading' | 'ready' | 'error';

  // How much of a layer is inside the area of interest.
  type AoiLayerSummary = {
    // Features inside the area, and in the whole layer.
    count: number;
    total: number;
    // Bounding box of the features inside; null when there are none.
    extent: LonLatExtent | null;
  };

  // GET /api/map/aoi/summary: every layer's AoiLayerSummary, by layer id.
  type AoiSummary = {
    layers: Record<string, AoiLayerSummary>;
  };

  type GeoJSONFeatureCollection = {
    type: 'FeatureCollection';
    features: {
      type: 'Feature';
      geometry: { type: string; coordinates: unknown };
      properties: Record<string, unknown> | null;
    }[];
  };
}
