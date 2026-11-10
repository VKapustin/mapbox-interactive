import { vi } from 'vitest';
import type { useMap } from '@/hooks/map';
import { type MapConfig } from 'MapTypes';

export const testMapConfig: MapConfig = {
  view: { center: [-122.2, 37.6], zoom: 9, minZoom: 2, maxZoom: 19 },
  styles: [
    { id: 'streets', label: 'Streets', url: 'mapbox://styles/mapbox/streets-v12', imageUrl: '/thumbs/streets.png' },
    { id: 'dark', label: 'Dark', url: 'mapbox://styles/mapbox/dark-v11', imageUrl: '/thumbs/dark.png' },
  ],
  defaultStyleId: 'streets',
  layers: [
    {
      id: 'landmarks',
      label: 'Landmarks',
      type: 'geojson',
      url: '/api/map/layers/landmarks',
      visible: true,
    },
  ],
};

type MapContextValue = ReturnType<typeof useMap>;

// A useMap() result for components rendered without a MapProvider.
export const createMapContextValue = (overrides: Partial<MapContextValue> = {}): MapContextValue => ({
  map: null,
  status: 'ready',
  config: testMapConfig,
  styleId: 'streets',
  setStyle: vi.fn(),
  layerVisibility: { landmarks: true },
  setLayerVisible: vi.fn(),
  zoomToLayer: vi.fn(),
  zoomToLayers: vi.fn(),
  aoi: null,
  setAoi: vi.fn(),
  aoiSummary: null,
  aoiSummaryFailed: false,
  ...overrides,
});
