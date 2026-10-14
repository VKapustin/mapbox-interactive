'use client';

import { useEffect, useRef } from 'react';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import VectorLayer from 'ol/layer/Vector';
import { fromLonLat, transformExtent } from 'ol/proj';
import VectorSource from 'ol/source/Vector';
import { useMap } from '@/hooks/map/useMap/useMap';
import { createMarkerStyle } from '@/helpers/mapHelpers';
import { MARKER_Z_INDEX } from '@/constant/constant';
import { type SearchResult } from 'SearchTypes';

type SearchMarker = {
  // Moves the marker to a search result and zooms the view to it.
  showResult: (result: SearchResult) => void;
  // Removes the marker; the view stays where it is.
  clearResult: () => void;
};

// Adds a marker layer to the shared map for search results.
export const useSearchMarker = (): SearchMarker => {
  const { map } = useMap();
  const markerSourceRef = useRef<VectorSource | null>(null);

  useEffect(() => {
    if (!map) {
      return;
    }

    const markerSource = new VectorSource();
    // Keep the marker above the basemap and the data layers.
    const markerLayer = new VectorLayer({ source: markerSource, style: createMarkerStyle(), zIndex: MARKER_Z_INDEX });

    map.addLayer(markerLayer);
    markerSourceRef.current = markerSource;

    return () => {
      map.removeLayer(markerLayer);
      markerSourceRef.current = null;
    };
  }, [map]);

  const showResult = (result: SearchResult): void => {
    const view = map?.getView();

    if (!view) {
      return
    }

    markerSourceRef.current?.clear();
    markerSourceRef.current?.addFeature(new Feature(new Point(fromLonLat(result.center))));

    if (result.bbox) {
      view.fit(transformExtent(result.bbox, 'EPSG:4326', view.getProjection()), {
        maxZoom: 16,
        duration: 800,
        padding: [60, 40, 40, 40],
      });
    } else {
      view.animate({ center: fromLonLat(result.center), zoom: 15, duration: 800 });
    }
  };

  const clearResult = (): void => {
    markerSourceRef.current?.clear();
  };

  return { showResult, clearResult };
}
