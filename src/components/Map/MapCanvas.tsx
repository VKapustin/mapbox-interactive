'use client';

import { useEffect, useRef, FC } from 'react';
import { Alert } from '@mui/material';
import 'ol/ol.css';
import {
  MapCanvasWrapper,
  MapStatusOverlay,
  MapTarget,
} from '@/components/Map/styles/mapCanvas.styles';
import Loading from '@/components/Loading/Loading';
import { useMap } from '@/hooks/map';
import { useString } from '@/hooks/string';

// The element the shared map draws into. Must be rendered inside a MapProvider.
const MapCanvas: FC = () => {
  const targetRef = useRef<HTMLDivElement>(null);
  const { map, status } = useMap();
  const text = useString('map');

  // The target stays mounted while loading, so it's always there to attach to.
  useEffect(() => {
    if (!map || !targetRef.current) {
      return;
    }

    map.setTarget(targetRef.current);

    return () => map.setTarget(undefined);
  }, [map]);

  return (
    <MapCanvasWrapper>
      <MapTarget ref={targetRef} />
      {status !== 'ready' && (
        <MapStatusOverlay>
          {status === 'error' ? (
            <Alert severity='error'>{text.styleError}</Alert>
          ) : (
            <Loading label={text.loading} />
          )}
        </MapStatusOverlay>
      )}
    </MapCanvasWrapper>
  );
}

export default MapCanvas;
