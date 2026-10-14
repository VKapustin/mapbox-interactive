// Public entry point for the map hooks; import from '@/hooks/map' outside this
// folder. Files inside it import each other directly (e.g. '@/hooks/map/useMap/useMap')
// so they never import this file and create a cycle.
import {useMap, MapProvider} from '@/hooks/map/useMap/useMap';
import {useSearchMarker} from '@/hooks/map/useSearchMarker/useSearchMarker';
import {useFeatureSelect} from '@/hooks/map/useFeatureSelect/useFeatureSelect';

export type {SelectedFeature} from '@/hooks/map/useFeatureSelect/useFeatureSelect';

export {
  MapProvider,
  useMap,
  useSearchMarker,
  useFeatureSelect,
};
