import { Box, Drawer, IconButton, Typography } from '@mui/material'
import { drawerClasses } from '@mui/material/Drawer';
import {styled} from '@mui/material/styles';
import { FEATURE_DRAWER_WIDTH } from '@/constant/constant';

// On wide screens ('persistent') the drawer takes space next to the map, and its
// width animates to 0 when closed so the map grows back. On small screens
// ('temporary') it covers the map instead, leaving a strip of map visible.
export const MapFeatureDrawerRoot = styled(Drawer)(({ theme, open, variant }) => (
  variant === 'persistent'
    ? {
      flexShrink: 0,
      width: open ? `${FEATURE_DRAWER_WIDTH}px` : 0,
      overflow: 'hidden',
      transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: open ? theme.transitions.duration.enteringScreen : theme.transitions.duration.leavingScreen,
      }),
      [`& .${drawerClasses.paper}`]: {
        position: 'relative',
        width: `${FEATURE_DRAWER_WIDTH}px`,
        height: '100%',
        boxSizing: 'border-box',
      },
    }
    : {
      [`& .${drawerClasses.paper}`]: {
        width: `min(${FEATURE_DRAWER_WIDTH}px, calc(100vw - 48px))`,
        boxSizing: 'border-box',
      },
    }
));

export const MapFeatureDrawerHeader = styled(Box)(({ theme }) => {
  const { palette } = theme.vars ?? theme;
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minHeight: '61px',
    padding: '12px 8px 12px 16px',
    borderBottom: `1px solid ${palette.divider}`,
  };
});

export const MapFeatureDrawerTitle = styled(Typography)({
  flex: 1,
  minWidth: 0,
  fontSize: '16px',
  fontWeight: 600,
});

export const MapFeatureDrawerClose = styled(IconButton)({
  padding: '6px',
});

export const MapFeatureDrawerPhoto = styled('img')(({ theme }) => {
  const { palette } = theme.vars ?? theme;
  return {
    display: 'block',
    width: '100%',
    height: '200px',
    objectFit: 'cover',
    // Placeholder tint while the photo loads.
    backgroundColor: palette.action.hover,
  };
});

export const MapFeatureDrawerBody = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  padding: '16px',
  overflowY: 'auto',
});

export const MapFeatureDrawerDescription = styled(Typography)({
  fontSize: '14px',
  fontWeight: 600,
  lineHeight: 1.4,
});

export const MapFeatureDrawerSummary = styled(Typography)({
  fontSize: '14px',
  lineHeight: 1.55,
});

export const MapFeatureDrawerMeta = styled(Typography)({
  fontSize: '12px',
  opacity: 0.7,
  '& a': {
    color: 'inherit',
  },
});

export const MapFeatureDrawerCoordinates = styled(MapFeatureDrawerMeta)({
  fontVariantNumeric: 'tabular-nums',
});
