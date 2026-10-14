import { Box, Paper } from '@mui/material'
import {styled} from '@mui/material/styles';
import {
  MAP_CONTROL_GAP,
  MAP_CONTROLS_PANEL_WIDTH,
  MAP_TOP_CONTROLS_BOTTOM,
  MAP_TOP_CONTROLS_STACK_WIDTH,
} from '@/constant/constant';

// A container query for a map area narrower than the search box and the panel
// side by side (see MAP_TOP_CONTROLS_STACK_WIDTH).
export const NARROW_MAP = `@container map-area (max-width: ${MAP_TOP_CONTROLS_STACK_WIDTH - 0.02}px)`;

// The details drawer and the map side by side; the drawer pushes the map over.
export const MapLayoutWrapper = styled(Box)({
  display: 'flex',
  width: '100%',
  height: '100%',
});

// The map and everything layered over it (search, controls, popup, logo).
// Its width is what the overlays adapt to (NARROW_MAP), since the details
// drawer can take part of the screen.
export const MapArea = styled(Box)({
  position: 'relative',
  flex: 1,
  minWidth: 0,
  height: '100%',
  containerType: 'inline-size',
  containerName: 'map-area',
});

// The search box (left) and the panel (right) along the top of the map, down
// to just above the drawing tool. On a narrow map they stack: the search box
// across the top, the panel under it, shrinking to the height that's left.
// Clicks on the empty space between them reach the map.
export const MapTopControls = styled(Box)({
  position: 'absolute',
  top: `${MAP_CONTROL_GAP}px`,
  left: `${MAP_CONTROL_GAP}px`,
  right: `${MAP_CONTROL_GAP}px`,
  bottom: `${MAP_TOP_CONTROLS_BOTTOM}px`,
  zIndex: 1,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: `${MAP_CONTROL_GAP}px`,
  pointerEvents: 'none',
  '& > *': {
    pointerEvents: 'auto',
  },
  [NARROW_MAP]: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
});

export const MapboxLogo = styled('a')({
  position: 'absolute',
  left: '8px',
  bottom: '8px',
  zIndex: 1,
  width: '88px',
  height: '23px',
  background: 'url("/mapbox-logo.svg") no-repeat',
});

// The top-right panel holding the map style picker and the landmark toggles.
// It stops above the drawing tool (the bottom of MapTopControls); when that's
// too short, the landmarks list scrolls (see LandmarksControl).
export const MapControlsPanel = styled(Paper)(({ theme }) => {
  const { palette } = theme.vars ?? theme;
  return {
    flexShrink: 0,
    maxHeight: '100%',
    width: `${MAP_CONTROLS_PANEL_WIDTH}px`,
    // Stacked under the search box: on the right, shrinking to the height left.
    [NARROW_MAP]: {
      alignSelf: 'flex-end',
      flexShrink: 1,
      minHeight: 0,
      maxWidth: '100%',
    },
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    borderRadius: '8px',
    backgroundColor: palette.background.paper,
    // Dark-mode Paper adds a lightening overlay; keep the plain background.
    backgroundImage: 'none',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
  };
});
