# Mapbox Interactive

An interactive map of landmarks in the USA and Europe, built with Next.js and
OpenLayers on Mapbox basemaps. The Mapbox access token never reaches the
browser: every Mapbox request goes through this app's server.

Developed by [Viacheslav Kapustin](https://github.com/VKapustin/).

## Features

- **Mapbox basemaps without exposing the token.** Vector styles (Streets,
  Outdoors, Light, Dark, Satellite) are rendered by OpenLayers through
  `ol-mapbox-style`. Styles, tiles, sprites and fonts load through a server
  proxy that adds the token and only allows read-only Mapbox endpoints. The
  style picker shows a thumbnail of each style.
- **Landmark layers by country.** One layer per country (USA, Czechia, France,
  Germany, Greece, Italy, Spain, United Kingdom), each in its own color. The
  map opens fitted to all visible layers.
- **Server-side clustering.** Landmarks are clustered on the server with
  `supercluster` and loaded tile by tile. Clicking a cluster zooms in to where
  it splits.
- **Landmark details.** Clicking a landmark opens a popup with a photo, a short
  description and its coordinates. "Show more info…" opens a side drawer with
  the Wikipedia summary, loaded through the server.
- **Landmarks panel.**
  - Show or hide each country; the checkbox is a circle in the layer's color,
    so it doubles as the legend.
  - Zoom to one country, or show and zoom to all of them.
  - Collapse the list; the browser remembers whether it was open.
  - The panel never grows past the drawing tools; the list scrolls instead.
- **Place search.** Mapbox Search Box suggestions (through the proxy), biased
  toward the map's center. Choosing one adds a marker and zooms to it.
- **Area of interest (AOI).**
  - Draw a polygon (click to add corners, double-click or click the first
    corner to finish, Escape to cancel), and clear it with the eraser.
  - Only landmarks inside the area are shown. The server filters them, so
    cluster counts include only what's inside.
  - Countries with nothing inside can't be zoomed to, and the panel says so
    when the area holds no landmarks at all.
- **Responsive layout.** On a narrow map (a phone, or a desktop with the details
  drawer open) the search box and the panel stack instead of overlapping.
  Light and dark themes follow the system setting.

## Getting started

Requirements: Node.js 20.9 or later, and a [Mapbox access token](https://account.mapbox.com/access-tokens/).

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and set your token in `.env.local`:

   ```bash
   cp .env.example .env.local
   ```

   ```bash
   MAPBOX_TOKEN=pk.your-token-here
   ```

   Keep the token server-only: don't rename it to `NEXT_PUBLIC_…`, or Next.js
   would ship it to the browser.

3. Start the development server and open [http://localhost:3000](http://localhost:3000):

   ```bash
   npm run dev
   ```

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `MAPBOX_TOKEN` | Yes | Mapbox access token, used only by the server proxy. |
| `WIKIMEDIA_USER_AGENT` | No | User-Agent for Wikipedia requests. Wikimedia asks for contact details, e.g. `mapbox-interactive/0.1 (https://example.com; you@example.com)`. |

### Browser support

Safari 16+ (iOS 16+), Chrome and Edge 105+, Firefox 110+. The layout of the
controls over the map uses CSS container queries, and the browser's requests to
this app's API use `AbortSignal.timeout`; older browsers lack both, so the
search box and the panel overlap, and the landmarks, search, the details drawer
and area filtering don't load.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest in watch mode |
| `npm run test:run` | Vitest once (CI) |

## Server API

All routes are Next.js route handlers in `src/app/api/`.

| Route | Purpose |
|---|---|
| `GET /api/mapbox/[...path]` | Proxy to `api.mapbox.com` that adds the token. Allows styles, tiles, fonts and Search Box forward only, and only for same-origin requests. |
| `GET /api/map/config` | Map configuration: view, styles with thumbnails, layers with their extents. |
| `GET /api/map/layers/[id]` | A layer's features as GeoJSON. |
| `GET /api/map/layers/[id]/clusters/[z]/[x]/[y]` | One map tile of a layer's clusters and single points. |
| `GET /api/map/aoi/summary?aoi=` | For an area of interest: each layer's count inside it, its total, and the extent of the landmarks inside. |
| `GET /api/wikipedia/summary/[title]` | Wikipedia article summary. Only serves articles the map data links to. |

The layer and cluster routes also take `?aoi=` (a GeoJSON Polygon geometry in
longitude/latitude) and then return only what's inside it. An invalid area is
rejected with `400`.

## Project structure

```
src/
  app/            Pages and API route handlers
  components/     UI components; styles in styles/*.styles.tsx next to each
  hooks/          React hooks, by area: map, draw, storage, string, wikipedia
  helpers/        Shared helpers (map setup, AOI parsing and point-in-polygon)
  server/         Server-only code: map config, landmark data, clustering,
                  UI strings, Wikipedia
  udl/            The browser's requests to this app's API (timeouts, retries)
  constant/       Shared constants
  theme/          MUI theme (light and dark)
  types/          Shared TypeScript types
public/landmarks/ Landmark photos, one folder per layer
assets/icon/      Icon drawings; `node assets/icon/build-icons.mjs` rebuilds
                  src/app/favicon.ico and src/app/apple-icon.png
tests/            Vitest tests, mirroring src/
  support/        Shared test code (setup, fixtures, render helpers); no src/ counterpart
```

## Adding a landmark layer

1. Add a GeoJSON file in `src/server/map/data/`. Each feature is a point with
   `name`, `description`, `wikipediaTitle` and `image` (`url`, `author`,
   `license`, `licenseUrl`, `sourceUrl`).
2. Put its photos in `public/landmarks/<layer id>/`.
3. Register the file in `src/server/map/mapLayers.ts`, and add the layer, with
   its color, in `src/server/map/mapConfig.ts`.
4. Add its bounding box to `LAYER_BOUNDS` in `tests/server/map/mapLayers.test.ts`.
   The tests check every data file, photo and license.

UI text lives in `src/server/strings/strings.ts`, not in the components.

## Keeping the data in a database

The landmark data is JSON files bundled with the app, which suits a small,
fixed dataset. To edit landmarks without a deploy, or to hold many more, they
can move to a database (e.g. PostgreSQL with PostGIS, or MongoDB) or a CMS. The
browser and the API routes don't need to change: all server code reads the data
through a few functions.

- **Data:** `getMapLayerData(id)` and `getMapLayerIds()` in
  `src/server/map/mapLayers.ts`. Load each layer from the database here, and
  keep returning a GeoJSON FeatureCollection.
- **Layer list:** `getMapConfig()` in `src/server/map/mapConfig.ts` lists the
  layers, with their labels and colors. That list can come from a table too.
- **Caches:** `src/server/map/clusters.ts` builds each layer's cluster index once
  and keeps it for the life of the server process, because the bundled data only
  changes with a deploy. Once the data can change while the app runs, clear or
  rebuild a layer's index when it changes (or give it a time limit). Indexes for
  areas of interest are already kept only for the most recently used areas.
- **AOI filtering (optional):** a spatial database can select the points inside
  an area itself (PostGIS `ST_Within`), so only those reach the server. Filter
  in Web Mercator, the projection the area is drawn in, as `isInAoi` in
  `src/helpers/aoiHelpers.ts` does.
- **Photos:** they're served from `public/landmarks/`. With a database, store
  them in object storage (or keep Wikimedia Commons URLs) and save each photo's
  URL and credit with its landmark.
- **Tests:** `tests/server/map/mapLayers.test.ts` checks the bundled JSON files
  and photos. With a database, run those checks when data is saved instead (or
  against a test database).

## Testing

```bash
npm run test:run
```

Vitest with jsdom and React Testing Library covers the components, hooks,
helpers, server code and API routes. Layout (sizes, scrolling, stacking) can't
be measured in jsdom, so check it in a browser.

## Credits

- Map data and styles © [Mapbox](https://www.mapbox.com/about/maps/) and
  © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
- Landmark photos are from [Wikimedia Commons](https://commons.wikimedia.org/).
  Each photo's author and license (Creative Commons, public domain or the Free
  Art License) are in the layer data and shown with the photo.
- Landmark summaries come from [Wikipedia](https://www.wikipedia.org/), loaded
  live and credited in the drawer with the landmark's details.
