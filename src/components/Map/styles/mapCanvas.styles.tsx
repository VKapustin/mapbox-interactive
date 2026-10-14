import { Box } from '@mui/material'
import {styled} from '@mui/material/styles';

export const MapCanvasWrapper = styled(Box)({
  position: 'relative',
  width: '100%',
  height: '100%',
});

export const MapTarget = styled(Box)({
  width: '100%',
  height: '100%',
});

// Sits over the map while the style loads, or after it fails. Clicks pass
// through to the map; only the overlay's content takes them.
export const MapStatusOverlay = styled(Box)({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
  '& > *': {
    pointerEvents: 'auto',
  },
});
