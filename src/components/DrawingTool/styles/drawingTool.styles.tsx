import { IconButton, Paper } from '@mui/material'
import {styled} from '@mui/material/styles';
import { DRAWING_TOOL_BOTTOM, MAP_CONTROL_GAP } from '@/constant/constant';

// Bottom right, 12px above the zoom buttons, and styled like them.
export const DrawingToolContainer = styled(Paper)(({ theme }) => {
  const { palette } = theme.vars ?? theme;
  return {
    position: 'absolute',
    right: `${MAP_CONTROL_GAP}px`,
    bottom: `${DRAWING_TOOL_BOTTOM}px`,
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: palette.background.paper,
    // Dark-mode Paper adds a lightening overlay; keep the plain background.
    backgroundImage: 'none',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
    // The span around the clear button stretches to the button's width.
    '& > span': {
      display: 'flex',
    },
    '& > * + *': {
      borderTop: `1px solid ${palette.divider}`,
    },
  };
});

// 32px square with a 20px icon, like the zoom buttons; highlighted while it's
// switched on (the draw button while drawing).
export const DrawingToolButton = styled(IconButton)(({ theme }) => {
  const { palette } = theme.vars ?? theme;
  return {
    borderRadius: 0,
    padding: '6px',
    '&[aria-pressed="true"]': {
      color: palette.primary.main,
      backgroundColor: theme.alpha(palette.primary.main, 0.15),
    },
  };
});
