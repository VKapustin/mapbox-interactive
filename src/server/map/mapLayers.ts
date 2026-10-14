import 'server-only';
import usaLandmarks from '@/server/map/data/usa-landmarks.json';
import czechiaLandmarks from '@/server/map/data/czechia-landmarks.json';
import franceLandmarks from '@/server/map/data/france-landmarks.json';
import germanyLandmarks from '@/server/map/data/germany-landmarks.json';
import greeceLandmarks from '@/server/map/data/greece-landmarks.json';
import italyLandmarks from '@/server/map/data/italy-landmarks.json';
import spainLandmarks from '@/server/map/data/spain-landmarks.json';
import ukLandmarks from '@/server/map/data/uk-landmarks.json';
import {type GeoJSONFeatureCollection} from 'MapTypes';

// GeoJSON for the data layers in mapConfig.ts, keyed by layer id: one layer of
// landmarks per country. Each layer is a file in ./data, so adding a layer means
// adding a file here and an entry in mapConfig.ts. JSON isn't type-checked:
// tests/server/map/mapLayers.test.ts checks every file instead.
//
// All server code reads the data through getMapLayerData() and
// getMapLayerIds(), so moving it to a database or API means changing those two.
// The cluster indexes in clusters.ts are built once per layer and kept, since
// this data only changes with a deploy; data that can change while the app runs
// needs them cleared or rebuilt when it does. (See "Keeping the data in a
// database" in the README.)
//
// Each feature's properties: name, description, wikipediaTitle (English
// Wikipedia article for the details drawer) and image. Photos are 500px
// Wikimedia Commons thumbnails stored in public/landmarks/<layer id>/ and served
// by this app, so viewing them never contacts Wikimedia. Their licenses allow
// this as long as each photo shows its credit (author, license, Commons page).
const MAP_LAYER_DATA: Record<string, GeoJSONFeatureCollection> = {
  'usa-landmarks': usaLandmarks as GeoJSONFeatureCollection,
  'czechia-landmarks': czechiaLandmarks as GeoJSONFeatureCollection,
  'france-landmarks': franceLandmarks as GeoJSONFeatureCollection,
  'germany-landmarks': germanyLandmarks as GeoJSONFeatureCollection,
  'greece-landmarks': greeceLandmarks as GeoJSONFeatureCollection,
  'italy-landmarks': italyLandmarks as GeoJSONFeatureCollection,
  'spain-landmarks': spainLandmarks as GeoJSONFeatureCollection,
  'uk-landmarks': ukLandmarks as GeoJSONFeatureCollection,
};

export const getMapLayerData = async (id: string): Promise<GeoJSONFeatureCollection | undefined> =>
  MAP_LAYER_DATA[id];

// Every layer with data, in the order of MAP_LAYER_DATA.
export const getMapLayerIds = async (): Promise<string[]> => Object.keys(MAP_LAYER_DATA);
