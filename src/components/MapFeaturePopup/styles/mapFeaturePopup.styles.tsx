import { Box, IconButton, Paper, Typography } from '@mui/material'
import {styled} from '@mui/material/styles';
import { FEATURE_POPUP_ARROW_SIZE } from '@/constant/constant';

// React keeps this wrapper in place; OpenLayers moves the popup element inside
// it into the map's overlay container.
export const MapFeaturePopupAnchor = styled(Box)({
  display: 'none',
});

// Holds the popup and draws its arrow; the paper clips its own overflow (for the
// photo's rounded corners), so the arrow can't live on the paper itself.
export const MapFeaturePopupFrame = styled(Box)(({ theme }) => {
  const { palette } = theme.vars ?? theme;
  return {
    position: 'relative',
    // One shadow around the popup and its arrow together.
    filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.2))',
    // Downward triangle centred under the popup, pointing at the feature.
    '&::after': {
      content: '""',
      position: 'absolute',
      left: '50%',
      bottom: `-${FEATURE_POPUP_ARROW_SIZE}px`,
      transform: 'translateX(-50%)',
      borderLeft: `${FEATURE_POPUP_ARROW_SIZE}px solid transparent`,
      borderRight: `${FEATURE_POPUP_ARROW_SIZE}px solid transparent`,
      borderTop: `${FEATURE_POPUP_ARROW_SIZE}px solid ${palette.background.paper}`,
    },
  };
});

export const MapFeaturePopupPaper = styled(Paper)(({ theme }) => {
  const { palette } = theme.vars ?? theme;
  return {
    position: 'relative',
    minWidth: '200px',
    // Long descriptions wrap instead of stretching the popup across the map.
    maxWidth: '280px',
    // Lets the photo run edge to edge inside the rounded corners.
    overflow: 'hidden',
    borderRadius: '8px',
    backgroundColor: palette.background.paper,
    // Dark-mode Paper adds a lightening overlay; keep the plain background.
    backgroundImage: 'none',
    // The frame draws the shadow, so it also covers the arrow.
    boxShadow: 'none',
  };
});

// With a photo, the popup is a fixed width so the photo always fills it.
export const MapFeaturePopupPhoto = styled('img')(({ theme }) => {
  const { palette } = theme.vars ?? theme;
  return {
    display: 'block',
    width: '280px',
    // Fixed so the popup's size is known before the photo loads; the map uses
    // it to keep the popup on screen.
    height: '140px',
    objectFit: 'cover',
    // Placeholder tint while the photo loads.
    backgroundColor: palette.action.hover,
  };
});

export const MapFeaturePopupBody = styled(Box)({
  padding: '12px 36px 12px 12px',
});

export const MapFeaturePopupClose = styled(IconButton)(({ theme }) => {
  const { palette } = theme.vars ?? theme;
  return {
    position: 'absolute',
    top: '4px',
    right: '4px',
    padding: '4px',
    // Stays readable on top of a photo.
    backgroundColor: theme.alpha(palette.background.paper, 0.8),
    '&:hover': {
      backgroundColor: palette.background.paper,
    },
  };
});

export const MapFeaturePopupName = styled(Typography)({
  fontSize: '14px',
  fontWeight: 600,
});

export const MapFeaturePopupDescription = styled(Typography)({
  margin: '4px 0 6px',
  fontSize: '13px',
  lineHeight: 1.4,
});

export const MapFeaturePopupCoordinates = styled(Typography)({
  fontSize: '12px',
  opacity: 0.7,
  // Digits line up when values change.
  fontVariantNumeric: 'tabular-nums',
});

export const MapFeaturePopupMore = styled(Typography)({
  marginTop: '8px',
  fontSize: '13px',
  '& button': {
    font: 'inherit',
    verticalAlign: 'baseline',
  },
});

export const MapFeaturePopupCredit = styled(Typography)({
  marginTop: '6px',
  fontSize: '11px',
  opacity: 0.6,
  '& a': {
    color: 'inherit',
  },
});
