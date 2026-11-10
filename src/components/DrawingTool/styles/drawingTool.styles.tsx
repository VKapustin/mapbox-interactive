import {styled} from '@mui/material/styles';
import { DRAWING_TOOL_BOTTOM } from '@/constant/constant';
import { MapButtonStack, mapStackButtonStyle } from '@/components/MapButtonStack/styles/mapButtonStack.styles';
import SoftDisabledIconButton from '@/components/SoftDisabledIconButton/SoftDisabledIconButton';

// Bottom right, 12px above the zoom buttons, and styled like them.
export const DrawingToolContainer = styled(MapButtonStack)({
  bottom: `${DRAWING_TOOL_BOTTOM}px`,
});

// A stack button, highlighted while it's switched on (the draw button while
// drawing). It can be `softDisabled` (the eraser with nothing to clear) and
// still show its tooltip.
export const DrawingToolButton = styled(SoftDisabledIconButton)(({ theme }) => {
  const { palette } = theme.vars ?? theme;
  return {
    ...mapStackButtonStyle,
    '&[aria-pressed="true"]': {
      color: palette.primary.main,
      backgroundColor: theme.alpha(palette.primary.main, 0.15),
    },
  };
});
