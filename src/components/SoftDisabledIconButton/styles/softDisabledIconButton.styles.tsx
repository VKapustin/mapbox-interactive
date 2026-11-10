import { IconButton } from '@mui/material'
import {styled} from '@mui/material/styles';

// Looks disabled while soft-disabled, without the disabled state's
// pointer-events: none (which would stop its tooltip from showing).
export const SoftDisabledIconButtonRoot = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== 'softDisabled',
})<{ softDisabled: boolean }>(({ theme, softDisabled }) => {
  const { palette } = theme.vars ?? theme;
  return softDisabled
    ? {
      color: palette.action.disabled,
      cursor: 'default',
      '&:hover': {
        backgroundColor: 'transparent',
      },
    }
    : {};
});
