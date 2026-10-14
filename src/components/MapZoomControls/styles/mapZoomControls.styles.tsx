import { IconButton, Paper } from '@mui/material'
import {styled} from '@mui/material/styles';
import { MAP_CONTROL_GAP, ZOOM_CONTROLS_BOTTOM } from '@/constant/constant';

// Bottom right, just above the attribution text that OpenLayers draws in the corner.
export const MapZoomControlsWrapper = styled(Paper)(({ theme }) => {
  const { palette } = theme.vars ?? theme;
  return {
    position: 'absolute',
    right: `${MAP_CONTROL_GAP}px`,
    bottom: `${ZOOM_CONTROLS_BOTTOM}px`,
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: palette.background.paper,
    // Dark-mode Paper adds a lightening overlay; keep the plain background.
    backgroundImage: 'none',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
    '& > * + *': {
      borderTop: `1px solid ${palette.divider}`,
    },
  };
});

export const MapZoomButton = styled(IconButton)({
  borderRadius: 0,
  padding: '6px',
});
