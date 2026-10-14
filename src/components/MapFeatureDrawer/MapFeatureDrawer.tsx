'use client';

import { FC, useEffect, useId, useState } from 'react';
import { Box, Link, Skeleton, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import {
  MapFeatureDrawerBody,
  MapFeatureDrawerClose,
  MapFeatureDrawerCoordinates,
  MapFeatureDrawerDescription,
  MapFeatureDrawerHeader,
  MapFeatureDrawerMeta,
  MapFeatureDrawerPhoto,
  MapFeatureDrawerRoot,
  MapFeatureDrawerSummary,
  MapFeatureDrawerTitle,
} from '@/components/MapFeatureDrawer/styles/mapFeatureDrawer.styles';
import { formatLonLat } from '@/helpers/mapHelpers';
import { useWikipediaSummary } from '@/hooks/wikipedia';
import { type SelectedFeature } from '@/hooks/map';
import { useString } from '@/hooks/string';

type MapFeatureDrawerProps = {
  // Open while a feature is set.
  feature: SelectedFeature | null;
  onClose: () => void;
};

const WikipediaSection: FC<{ title: string }> = ({ title }) => {
  const result = useWikipediaSummary(title);
  const text = useString('featureDrawer');

  if (result.status === 'loading' || result.status === 'idle') {
    return (
      <Box aria-busy='true' aria-label={text.summaryLoading}>
        <Skeleton variant='text' />
        <Skeleton variant='text' />
        <Skeleton variant='text' width='60%' />
      </Box>
    );
  }

  if (result.status === 'error') {
    return <MapFeatureDrawerMeta>{text.summaryUnavailable}</MapFeatureDrawerMeta>;
  }

  const { summary } = result;

  return (
    <>
      <MapFeatureDrawerSummary>{summary.extract}</MapFeatureDrawerSummary>
      <MapFeatureDrawerMeta>
        <Link href={summary.url} target='_blank' rel='noopener noreferrer'>{text.readMore}</Link>
        {` · ${text.summaryCredit} `}
        <Link href='https://creativecommons.org/licenses/by-sa/4.0/' target='_blank' rel='noopener noreferrer'>
          {text.summaryLicense}
        </Link>
      </MapFeatureDrawerMeta>
    </>
  );
};

// More information about a feature (e.g. a landmark), opened from its popup.
const MapFeatureDrawer: FC<MapFeatureDrawerProps> = ({ feature, onClose }) => {
  const titleId = useId();
  const text = useString('featureDrawer');
  const generalText = useString('general');
  // A photo that fails to load is left out, along with its credit.
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null);
  const photo = feature?.image && feature.image.url !== failedPhotoUrl ? feature.image : undefined;
  const theme = useTheme();

  // Small screens don't have room beside the map, so the drawer covers it there.
  const coversMap = useMediaQuery(theme.breakpoints.down('md'));
  const open = !!feature;

  // The covering drawer closes on Escape by itself (it's a modal); the one beside
  // the map needs its own listener. A popup open at the same time handles Escape
  // first and marks it handled, so one press closes one thing.
  useEffect(() => {
    if (!open || coversMap) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        onClose();
      }
    };

    document.addEventListener('keydown', closeOnEscape);

    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open, coversMap, onClose]);

  return (
    <MapFeatureDrawerRoot
      variant={coversMap ? 'temporary' : 'persistent'}
      anchor='left'
      open={open}
      onClose={onClose}
      slotProps={{ paper: { role: 'complementary', 'aria-labelledby': titleId } }}
    >
      {feature && (
        <>
          <MapFeatureDrawerHeader>
            <MapFeatureDrawerTitle id={titleId}>{feature.name}</MapFeatureDrawerTitle>
            <MapFeatureDrawerClose aria-label={text.close} onClick={onClose}>
              <ChevronLeftIcon />
            </MapFeatureDrawerClose>
          </MapFeatureDrawerHeader>
          {photo && (
            // Decorative: the heading says what it shows.
            <MapFeatureDrawerPhoto
              src={photo.url}
              alt=''
              decoding='async'
              onError={() => setFailedPhotoUrl(photo.url)}
            />
          )}
          <MapFeatureDrawerBody>
            {feature.description && (
              <MapFeatureDrawerDescription>{feature.description}</MapFeatureDrawerDescription>
            )}
            {feature.wikipediaTitle && <WikipediaSection title={feature.wikipediaTitle} />}
            <MapFeatureDrawerCoordinates>{formatLonLat(feature.lonLat)}</MapFeatureDrawerCoordinates>
            {photo && (
              <MapFeatureDrawerMeta>
                {`${generalText.photoCredit} `}
                <Link href={photo.sourceUrl} target='_blank' rel='noopener noreferrer'>
                  {photo.author}
                </Link>
                {', '}
                <Link href={photo.licenseUrl} target='_blank' rel='noopener noreferrer'>
                  {photo.license}
                </Link>
              </MapFeatureDrawerMeta>
            )}
          </MapFeatureDrawerBody>
        </>
      )}
    </MapFeatureDrawerRoot>
  );
}

export default MapFeatureDrawer;
