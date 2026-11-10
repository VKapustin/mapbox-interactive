import 'server-only';

// Every string the UI shows or reads out (labels, messages, aria-labels), grouped
// by component, with `general` for words several components share. Components
// read them with useString() from the StringProvider in page.tsx, so this module
// stays on the server (e.g. to load another language here later).
//
// Not here: content that comes with the data (style names, layer labels, landmark
// texts), Mapbox's required attribution (constant.ts), and developer-facing text
// (thrown errors, logs, API responses).
export const strings = {
  general: {
    close: 'Close',
    loading: 'Loading',
    // Followed by the author and license, e.g. "Photo: Ryan Schwark, CC0".
    photoCredit: 'Photo:',
  },
  map: {
    loading: 'Loading map',
    styleError: 'The map style couldn\'t be loaded. Try another style or reload the page.',
    mapboxLogo: 'Mapbox',
  },
  search: {
    label: 'Search places',
    placeholder: 'Search places',
    searching: 'Searching…',
    noResults: 'No places found',
    unavailable: 'Search is unavailable right now.',
  },
  developerCredit: {
    // Followed by the developer's name, which links to their GitHub profile.
    developedBy: 'Developed by',
  },
  mapStyleControl: {
    label: 'Map style',
  },
  drawingTool: {
    draw: 'Draw an area of interest',
    stopDrawing: 'Stop drawing',
    clear: 'Clear the area of interest',
    // The eraser's tooltip while there's nothing to clear.
    nothingToClear: 'Nothing to clear: no area drawn yet',
    // When a drawn polygon has more corners than an area can have.
    areaRejected: 'That area has too many corners to use. Draw it again with fewer clicks.',
  },
  landmarksControl: {
    title: 'Landmarks',
    // Followed by the layer name, e.g. "Zoom to France".
    zoomTo: 'Zoom to',
    zoomToAll: 'Show and zoom to all landmarks',
    noneInAoi: 'No landmarks in the selected area.',
    // The tooltip of a country's zoom button when the area holds none of its landmarks.
    zoomToEmpty: 'Nothing to zoom to: no landmarks in the selected area',
    // The zoom buttons' tooltip while a map style is loading (they wait for it).
    zoomWhileLoading: 'Available once the map style has loaded',
    aoiFailed: 'Couldn\'t load the landmarks in the selected area. Try drawing it again.',
    // The expand / collapse button: its name, and its tooltip in each state.
    list: 'Landmark list',
    collapseList: 'Collapse the list',
    expandList: 'Expand the list',
  },
  zoomControls: {
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
  },
  featurePopup: {
    showMore: 'Show more info…',
  },
  featureDrawer: {
    close: 'Close details',
    summaryLoading: 'Loading Wikipedia summary',
    summaryUnavailable: 'More information isn\'t available right now.',
    readMore: 'Read more on Wikipedia',
    // Followed by the license link, e.g. "Text: Wikipedia, CC BY-SA 4.0".
    summaryCredit: 'Text: Wikipedia,',
    summaryLicense: 'CC BY-SA 4.0',
  },
} as const satisfies Record<string, Record<string, string>>;

export type Strings = typeof strings;
export type StringGroup = keyof Strings;
