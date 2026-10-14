import { Box, Checkbox, Collapse, Typography } from '@mui/material'
import { collapseClasses } from '@mui/material/Collapse';
import { checkboxClasses } from '@mui/material/Checkbox';
import {styled} from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

// The whole control. It shrinks to the room left in the top-right panel (the
// panel stops above the drawing tool); the title row and the message keep
// their size, and the list gets the rest and scrolls (LayerList).
export const LandmarksRoot = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  flex: '0 1 auto',
  minHeight: 0,
});

// The collapsible part. It shrinks to the room left in LandmarksRoot. Every
// level down to LayerList is a column that can shrink (MUI's two inner
// wrappers too), so the limit reaches LayerList, which then scrolls.
// (Percentage heights wouldn't work: the control only has a max-height.)
const shrinkingColumn = {
  display: 'flex',
  flexDirection: 'column',
  flex: '0 1 auto',
  minHeight: 0,
} as const;

export const LayerListCollapse = styled(Collapse)({
  ...shrinkingColumn,
  [`& .${collapseClasses.wrapper}, & .${collapseClasses.wrapperInner}`]: shrinkingColumn,
});

// Wraps the layer rows; scrolls when they don't fit.
export const LayerList = styled(Box)({
  flex: '0 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  // Keep scrolling inside the list instead of passing on to the page.
  overscrollBehavior: 'contain',
});

export const LandmarksTitleWrapper = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
});

export const LandmarksTitle = styled(Typography)({
  fontSize: '12px',
  fontWeight: 600,
  opacity: 0.7,
  textTransform: 'uppercase',
});

// The buttons at the end of the title row.
export const LandmarksActions = styled(Box)({
  display: 'flex',
  alignItems: 'center',
});

// The expand / collapse arrow: points down while the list is collapsed, and
// turns to point up while it's open.
export const ExpandIcon = styled(ExpandMoreIcon, {
  shouldForwardProp: (prop) => prop !== 'expanded',
})<{ expanded: boolean }>(({ theme, expanded }) => ({
  transform: expanded ? 'rotate(180deg)' : 'none',
  transition: theme.transitions.create('transform', { duration: theme.transitions.duration.shortest }),
}));

// A note under the title, e.g. that no landmarks are in the drawn area.
export const LandmarksMessage = styled(Typography)({
  fontSize: '12px',
  opacity: 0.7,
  padding: '4px 0',
  '&:empty': {
    padding: 0,
  },
});

// A layer's checkbox, with its "zoom to layer" button at the end of the row.
export const LayerRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '4px',
});

// A layer's show / hide checkbox, drawn like a radio button in the layer's
// color (its points' color on the map): a filled circle while the layer is
// shown, an empty ring while it's hidden. It stays a checkbox, so several
// layers can be shown at once.
export const LayerCheckbox = styled(Checkbox, {
  shouldForwardProp: (prop) => prop !== 'layerColor',
})<{ layerColor: string }>(({ theme, layerColor }) => ({
  color: layerColor,
  [`&.${checkboxClasses.checked}`]: {
    color: layerColor,
  },
  '&:hover': {
    backgroundColor: theme.alpha(layerColor, 0.08),
  },
}));
