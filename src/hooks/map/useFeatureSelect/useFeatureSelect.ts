'use client';

import { useEffect, useState } from 'react';
import type Map from 'ol/Map';
import type { Coordinate } from 'ol/coordinate';
import type { FeatureLike } from 'ol/Feature';
import Point from 'ol/geom/Point';
import type { Layer } from 'ol/layer';
import type MapBrowserEvent from 'ol/MapBrowserEvent';
import { unByKey } from 'ol/Observable';
import { Draw } from 'ol/interaction';
import { getCenter } from 'ol/extent';
import { toLonLat } from 'ol/proj';
import { useMap } from '@/hooks/map/useMap/useMap';
import { isInAoi, parseAoi } from '@/helpers/aoiHelpers';
import { FEATURE_HIT_TOLERANCE, ZOOM_TO_LAYER_DURATION_MS } from '@/constant/constant';
import { type MapFeatureImage } from 'MapTypes';

export type SelectedFeature = {
  layerId: string;
  name: string;
  // Optional: not every data layer has descriptions.
  description?: string;
  image?: MapFeatureImage;
  wikipediaTitle?: string;
  // Map projection; where the overlay is anchored.
  coordinate: Coordinate;
  lonLat: [number, number];
};

type FeatureSelect = {
  // Null when nothing is selected or the selected feature's layer is hidden.
  selected: SelectedFeature | null;
  clearSelected: () => void;
};

// Only data layers from the map config carry an id; the Basemap and the search
// marker don't, so they can't be selected.
const isDataLayer = (layer: Layer) => layer.get('id') !== undefined;

// While the user draws (useDraw), clicks place the shape's corners, so they
// mustn't also select features or zoom into clusters. OpenLayers passes each
// click to map listeners before interactions, so Draw can't stop it for us.
const isDrawing = (map: Map) =>
  map.getInteractions().getArray().some((interaction) => interaction instanceof Draw && interaction.getActive());

const findDataFeature = (map: Map, event: MapBrowserEvent) =>
  map.forEachFeatureAtPixel(
    event.pixel,
    (feature: FeatureLike, layer: Layer) => ({ feature, layer }),
    { layerFilter: isDataLayer, hitTolerance: FEATURE_HIT_TOLERANCE },
  );

const toSelectedFeature = (feature: FeatureLike, layer: Layer): SelectedFeature | null => {
  const geometry = feature.getGeometry();

  if (!geometry) {
    return null;
  }

  // Points anchor at themselves; other shapes at the middle of their extent.
  const coordinate = geometry instanceof Point
    ? geometry.getCoordinates()
    : getCenter(geometry.getExtent());

  return {
    layerId: layer.get('id'),
    name: feature.get('name') ?? 'Unnamed feature',
    description: feature.get('description') || undefined,
    image: feature.get('image')?.url ? feature.get('image') : undefined,
    wikipediaTitle: feature.get('wikipediaTitle') || undefined,
    coordinate,
    lonLat: toLonLat(coordinate) as [number, number],
  };
};

// Zooms to the level where a server-side cluster splits (its `expansion_zoom`).
const zoomIntoCluster = (map: Map, cluster: FeatureLike) => {
  const view = map.getView();
  const geometry = cluster.getGeometry();
  const center = geometry instanceof Point ? geometry.getCoordinates() : getCenter(geometry!.getExtent());
  const expansionZoom = Number(cluster.get('expansion_zoom'));
  const zoom = Number.isFinite(expansionZoom) ? expansionZoom : (view.getZoom() ?? 0) + 2;

  view.animate({ center, zoom: Math.min(zoom, view.getMaxZoom()), duration: ZOOM_TO_LAYER_DURATION_MS });
};

// Selects a data-layer feature (e.g. a landmark) when the map is clicked, or
// zooms into a cluster, and shows a pointer cursor over both. Does neither
// while the user is drawing.
export const useFeatureSelect = (): FeatureSelect => {
  const { map, layerVisibility, aoi } = useMap();
  const [selected, setSelected] = useState<SelectedFeature | null>(null);

  useEffect(() => {
    if (!map) {
      return;
    }

    // singleclick waits out a possible double-click (which zooms) and never fires after a drag.
    const clickKey = map.on('singleclick', (event) => {
      if (isDrawing(map)) {
        return;
      }

      const hit = findDataFeature(map, event);

      // A cluster (clustered layers): zoom in to where it splits apart.
      if (hit?.feature.get('cluster')) {
        zoomIntoCluster(map, hit.feature);
        setSelected(null);
        return;
      }

      // Clicking empty map clears the selection.
      setSelected(hit ? toSelectedFeature(hit.feature, hit.layer) : null);
    });

    const moveKey = map.on('pointermove', (event) => {
      const target = map.getTargetElement();

      if (event.dragging || !target) {
        return;
      }

      // Features can't be clicked while drawing, so don't show the pointer over them.
      if (isDrawing(map)) {
        target.style.cursor = '';
        return;
      }

      const overFeature = map.hasFeatureAtPixel(event.pixel, {
        layerFilter: isDataLayer,
        hitTolerance: FEATURE_HIT_TOLERANCE,
      });

      target.style.cursor = overFeature ? 'pointer' : '';
    });

    return () => {
      unByKey([clickKey, moveKey]);
      map.getTargetElement()?.style.removeProperty('cursor');
    };
  }, [map]);

  // A selection on a layer that has since been hidden, or outside an area of
  // interest drawn since, shouldn't stay on screen.
  const parsedAoi = aoi ? parseAoi(aoi) : null;
  const visibleSelected = selected
    && layerVisibility[selected.layerId]
    && (!parsedAoi || isInAoi(parsedAoi, selected.lonLat))
    ? selected
    : null;

  return {
    selected: visibleSelected,
    clearSelected: () => setSelected(null),
  };
}
