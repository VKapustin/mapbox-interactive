import {withAoi} from '@/helpers/aoiHelpers';

// Search
export const SEARCH_DEBOUNCE_MS = 250;
export const SEARCH_MIN_QUERY_LENGTH = 2;

// Map
export const MAPBOX_HOSTS = /^(api|[a-d]\.tiles)\.mapbox\.com$/;

// ol-mapbox-style only expands mapbox:// URLs when it has a token, so it gets a
// placeholder. toProxyRequest then routes every Mapbox request through our
// proxy and drops the placeholder; the real token never leaves the server.
export const PLACEHOLDER_TOKEN = 'proxy';

// Required by the Mapbox terms of service, together with the logo.
export const MAPBOX_ATTRIBUTION = [
  '<a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener">© Mapbox</a>',
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>',
  '<a href="https://apps.mapbox.com/feedback/" target="_blank" rel="noopener"><strong>Improve this map</strong></a>',
];

export const MARKER_COLOR = '#3b82f6';

// How a data layer's points look when its config has no `style` (or leaves
// parts out). Used for the points on the map and for the layer list's legend.
export const DATA_LAYER_STYLE_DEFAULTS = {
  fill: '#f97316',
  stroke: '#ffffff',
  width: 2,
  radius: 6,
};
export const ZOOM_ANIMATION_MS = 250;
// "Zoom to layer": fit the layer's features with this much room around them,
// but no closer than this zoom (a single-feature layer would otherwise fill the screen).
export const ZOOM_TO_LAYER_PADDING = 80;
export const ZOOM_TO_LAYER_MAX_ZOOM = 14;
export const ZOOM_TO_LAYER_DURATION_MS = 600;

// Extra pixels around a data feature that still count as a click on it; the
// landmark points are small, especially on touch screens.
export const FEATURE_HIT_TOLERANCE = 6;

// The feature popup's arrow, and how far above the feature's center the popup
// sits: arrow + landmark point radius with its outline (~7px) + a 2px gap, so the
// arrow's tip stops just above the point.
export const FEATURE_POPUP_ARROW_SIZE = 8;
export const FEATURE_POPUP_OFFSET = FEATURE_POPUP_ARROW_SIZE + 9;

// Width of the feature details drawer on the left.
export const FEATURE_DRAWER_WIDTH = 360;

// Style thumbnails in the map style dropdown: size in CSS pixels, and how many
// zoom levels wider than the starting view they show, so the thumbnail captures
// enough of the area to show the style.
export const STYLE_THUMBNAIL_SIZE = 32;
export const STYLE_THUMBNAIL_ZOOM_OFFSET = 4;

// Who built the app, credited on the map (DeveloperCredit).
export const DEVELOPER = {
  name: 'Viacheslav Kapustin',
  url: 'https://github.com/VKapustin/',
};

// The controls over the map: their distance from its edges and from each
// other. On the right, from the bottom: the zoom buttons (above the
// attribution text OpenLayers draws in the corner) and the drawing tool above
// them; both are two 32px buttons and a divider. Along the top: the search box
// and the panel (style picker, landmarks), which must stop above the drawing tool.
export const MAP_CONTROL_GAP = 12;
export const MAP_BUTTON_SIZE = 32;
export const MAP_BUTTON_STACK_HEIGHT = 2 * MAP_BUTTON_SIZE + 1;
export const ZOOM_CONTROLS_BOTTOM = 36;
export const DRAWING_TOOL_BOTTOM = ZOOM_CONTROLS_BOTTOM + MAP_BUTTON_STACK_HEIGHT + MAP_CONTROL_GAP;
// Where the top controls end: a gap above the drawing tool.
export const MAP_TOP_CONTROLS_BOTTOM = DRAWING_TOOL_BOTTOM + MAP_BUTTON_STACK_HEIGHT + MAP_CONTROL_GAP;
export const SEARCH_BOX_WIDTH = 360;
export const MAP_CONTROLS_PANEL_WIDTH = 300;
// A map narrower than this can't fit the search box and the panel side by side
// (with gaps at the edges and between them), so they stack instead. It's the
// map's width, not the screen's: the details drawer narrows the map.
export const MAP_TOP_CONTROLS_STACK_WIDTH =
  MAP_CONTROL_GAP + SEARCH_BOX_WIDTH + MAP_CONTROL_GAP + MAP_CONTROLS_PANEL_WIDTH + MAP_CONTROL_GAP;

// Stacking order: basemap style < data layers < drawn area < search marker.
export const BASEMAP_Z_INDEX = 0;
export const DATA_LAYER_Z_INDEX = 5;
export const DRAW_Z_INDEX = 8;
export const MARKER_Z_INDEX = 10;

// The area of interest the user draws (useDraw): its outline color (the fill is
// the same at low opacity), and the decimals kept in its lon/lat GeoJSON
// (6 decimals ≈ 10 cm).
export const AOI_COLOR = '#3b82f6';
export const AOI_COORDINATE_DECIMALS = 6;

// API: our own endpoints, as the browser calls them. Requests from our code go
// through `udl` (src/udl/udl.ts); `mapboxProxy` is also where map tiles and
// styles are routed (toProxyRequest).
export const API = {
  mapboxProxy: '/api/mapbox',
  search: '/api/mapbox/search/searchbox/v1/forward',
  wikipediaSummary: (title: string) => `/api/wikipedia/summary/${encodeURIComponent(title)}`,

  // One map tile of a clustered layer: its clusters and single points, as
  // GeoJSON; counting only the features inside the area of interest, if given.
  layerClusters: (layerId: string, z: number, x: number, y: number, aoi?: string | null) =>
    withAoi(`/api/map/layers/${encodeURIComponent(layerId)}/clusters/${z}/${x}/${y}`, aoi),

  // For an area of interest: how many of each layer's features are inside it.
  aoiSummary: (aoi: string) => withAoi('/api/map/aoi/summary', aoi),
};

// UDL: give up on a request after this long, and wait at most this long when
// the server asks us to retry later (429 + Retry-After) before retrying once.
export const UDL_TIMEOUT_MS = 10_000;
// Our API routes give up on Mapbox and Wikipedia after this long (504), so a
// stalled upstream doesn't hold requests open on the server.
export const UPSTREAM_TIMEOUT_MS = 8_000;
export const UDL_MAX_RETRY_WAIT_MS = 5_000;

// Clustering (server-side, with supercluster). Points closer than this many
// screen pixels are grouped; above CLUSTER_MAX_ZOOM every point stands alone.
export const CLUSTER_RADIUS_PX = 40;
export const CLUSTER_MAX_ZOOM = 16;

// Tile size of the map's zoom levels (OpenLayers / Web Mercator XYZ).
export const MAP_TILE_SIZE = 256;

// Keys for what this browser remembers (localStorage), prefixed with the app's name.
export const STORAGE_KEYS = {
  // Whether the Landmarks panel's list of layers is open.
  landmarksListExpanded: 'mapbox-interactive:landmarks-list-expanded',
};
