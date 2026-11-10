'use client';

import { FC, useCallback, useSyncExternalStore } from 'react';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { unByKey } from 'ol/Observable';
import {
  MapZoomButton,
  MapZoomControlsWrapper,
} from '@/components/MapZoomControls/styles/mapZoomControls.styles';
import { useMap } from '@/hooks/map';
import { ZOOM_ANIMATION_MS } from '@/constant/constant';
import { useString } from '@/hooks/string';

// Zoom in / out buttons; replaces the built-in OpenLayers Zoom control.
const MapZoomControls: FC = () => {
  const { map } = useMap();
  const text = useString('zoomControls');
  const view = map?.getView();

  // Follows the view's zoom so the buttons disable at the min / max zoom. The
  // same subscribe function for a view, so React subscribes once, not after
  // every render (each zoom step re-renders).
  const subscribe = useCallback((onChange: () => void) => {
    const key = view?.on('change:resolution', onChange);
    return () => key && unByKey(key);
  }, [view]);

  const zoom = useSyncExternalStore(
    subscribe,
    () => view?.getZoom(),
    () => undefined,
  );

  const zoomBy = (delta: number): void => {
    if (!view) {
      return;
    }

    // Start from the zoom the view is heading to, so repeated clicks add up.
    if (view.getAnimating()) {
      view.cancelAnimations();
    }

    const target = Math.round((view.getZoom() ?? 0) + delta);

    view.animate({
      zoom: Math.min(Math.max(target, view.getMinZoom()), view.getMaxZoom()),
      duration: ZOOM_ANIMATION_MS,
    });
  };

  const canZoomIn = !!view && zoom !== undefined && zoom < view.getMaxZoom();
  const canZoomOut = !!view && zoom !== undefined && zoom > view.getMinZoom();

  return (
    <MapZoomControlsWrapper>
      <MapZoomButton aria-label={text.zoomIn} disabled={!canZoomIn} onClick={() => zoomBy(1)}>
        <AddIcon fontSize='small' />
      </MapZoomButton>
      <MapZoomButton aria-label={text.zoomOut} disabled={!canZoomOut} onClick={() => zoomBy(-1)}>
        <RemoveIcon fontSize='small' />
      </MapZoomButton>
    </MapZoomControlsWrapper>
  );
}

export default MapZoomControls;
