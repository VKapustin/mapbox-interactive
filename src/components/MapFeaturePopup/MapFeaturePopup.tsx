'use client';

import { FC, useEffect, useId, useRef, useState } from 'react';
import {Box, Link} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Overlay from 'ol/Overlay';
import {
  MapFeaturePopupAnchor,
  MapFeaturePopupBody,
  MapFeaturePopupClose,
  MapFeaturePopupCoordinates,
  MapFeaturePopupCredit,
  MapFeaturePopupDescription,
  MapFeaturePopupFrame,
  MapFeaturePopupMore,
  MapFeaturePopupName,
  MapFeaturePopupPaper,
  MapFeaturePopupPhoto,
} from '@/components/MapFeaturePopup/styles/mapFeaturePopup.styles';
import { formatLonLat } from '@/helpers/mapHelpers';
import { FEATURE_POPUP_OFFSET } from '@/constant/constant';
import { type SelectedFeature, useFeatureSelect, useMap } from '@/hooks/map';
import { useString } from '@/hooks/string';
import { useEscape } from '@/hooks/escape';

type MapFeaturePopupProps = {
  // Opens more information (the details drawer); the popup closes itself.
  onShowMore?: (feature: SelectedFeature) => void;
};

// Details for the clicked data feature (e.g. a landmark), pinned to it on the map.
const MapFeaturePopup: FC<MapFeaturePopupProps> = ({ onShowMore }) => {
  const titleId = useId();
  const { map } = useMap();
  const { selected, clearSelected } = useFeatureSelect();
  const text = useString('featurePopup');
  const generalText = useString('general');
  const elementRef = useRef<HTMLDivElement>(null);
  // A photo that fails to load is left out, along with its credit.
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null);
  const overlayRef = useRef<Overlay | null>(null);

  useEffect(() => {
    if (!map || !elementRef.current) {
      return;
    }

    const overlay = new Overlay({
      element: elementRef.current,
      positioning: 'bottom-center',
      // Leaves room for the arrow, whose tip stops just above the point.
      offset: [0, -FEATURE_POPUP_OFFSET],
      // Pans the map if the popup would open off-screen.
      autoPan: { animation: { duration: 250 }, margin: 20 },
      stopEvent: true,
    });

    map.addOverlay(overlay);
    overlayRef.current = overlay;

    return () => {
      map.removeOverlay(overlay);
      overlayRef.current = null;
    };
  }, [map]);

  // Moves the popup to the selection; undefined hides it.
  useEffect(() => {
    overlayRef.current?.setPosition(selected?.coordinate);
  }, [selected]);

  // Escape closes the popup (before anything opened earlier, such as the details drawer).
  useEscape(!!selected, clearSelected);

  const photo = selected?.image && selected.image.url !== failedPhotoUrl ? selected.image : undefined;

  return (
    <MapFeaturePopupAnchor>
      <Box ref={elementRef}>
        {selected && (
          <MapFeaturePopupFrame>
            <MapFeaturePopupPaper role='dialog' aria-labelledby={titleId}>
              {photo && (
                // Decorative: the name below says what it shows.
                <MapFeaturePopupPhoto
                  src={photo.url}
                  alt=''
                  decoding='async'
                  onError={() => setFailedPhotoUrl(photo.url)}
                />
              )}
              <MapFeaturePopupClose aria-label={generalText.close} size='small' onClick={clearSelected}>
                <CloseIcon fontSize='small' />
              </MapFeaturePopupClose>
              <MapFeaturePopupBody>
                <MapFeaturePopupName id={titleId}>{selected.name}</MapFeaturePopupName>
                {selected.description && (
                  <MapFeaturePopupDescription>{selected.description}</MapFeaturePopupDescription>
                )}
                <MapFeaturePopupCoordinates>{formatLonLat(selected.lonLat)}</MapFeaturePopupCoordinates>
                {onShowMore && (
                  <MapFeaturePopupMore>
                    <Link
                      component='button'
                      onClick={() => {
                        onShowMore(selected);
                        clearSelected();
                      }}
                    >
                      {text.showMore}
                    </Link>
                  </MapFeaturePopupMore>
                )}
                {photo && (
                  <MapFeaturePopupCredit>
                    {`${generalText.photoCredit} `}
                    <a href={photo.sourceUrl} target='_blank' rel='noopener noreferrer'>
                      {photo.author}
                    </a>
                    {', '}
                    <a href={photo.licenseUrl} target='_blank' rel='noopener noreferrer'>
                      {photo.license}
                    </a>
                  </MapFeaturePopupCredit>
                )}
              </MapFeaturePopupBody>
            </MapFeaturePopupPaper>
          </MapFeaturePopupFrame>
        )}
      </Box>
    </MapFeaturePopupAnchor>
  );
}

export default MapFeaturePopup;
