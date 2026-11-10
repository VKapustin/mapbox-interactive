import { Paper } from '@mui/material'
import {styled} from '@mui/material/styles';
import { MAP_BUTTON_SIZE, MAP_CONTROL_GAP } from '@/constant/constant';

// A column of square buttons on the right edge of the map (the zoom buttons,
// the drawing tool), with a divider between them. Each stack sets its own
// `bottom` (ZOOM_CONTROLS_BOTTOM, DRAWING_TOOL_BOTTOM).
export const MapButtonStack = styled(Paper)(({ theme }) => {
  const { palette } = theme.vars ?? theme;
  return {
    position: 'absolute',
    right: `${MAP_CONTROL_GAP}px`,
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: palette.background.paper,
    // Dark-mode Paper adds a lightening overlay; keep the plain background.
    backgroundImage: 'none',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
    // A divider between the buttons. && repeats this element's class, so the
    // rule outranks MUI's button reset (border: 0), which comes later in the CSS.
    '&& > * + *': {
      borderTop: `1px solid ${palette.divider}`,
    },
  };
});

// A button in a MapButtonStack: MAP_BUTTON_SIZE square, with its icon centered
// (use fontSize='small'). Sized from the constant, so the layout maths built
// on it (MAP_BUTTON_STACK_HEIGHT, the panel's height cap) can't drift from the
// real size. content-box: the divider's 1px comes on top of the size, as
// MAP_BUTTON_STACK_HEIGHT counts it (globals.css makes everything border-box).
export const mapStackButtonStyle = {
  boxSizing: 'content-box',
  width: `${MAP_BUTTON_SIZE}px`,
  height: `${MAP_BUTTON_SIZE}px`,
  padding: 0,
  borderRadius: 0,
} as const;
