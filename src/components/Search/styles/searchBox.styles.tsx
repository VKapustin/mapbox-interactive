import { Box, Paper, TextField, Typography } from '@mui/material'
import { autocompleteClasses } from '@mui/material/Autocomplete';
import { outlinedInputClasses } from '@mui/material/OutlinedInput';
import {styled} from '@mui/material/styles';

import { SEARCH_BOX_WIDTH } from '@/constant/constant';
import { NARROW_MAP } from '@/components/Map/styles/mapLayout.styles';

const BORDER_COLOR = 'rgba(0, 0, 0, 0.15)';

// Top left of the map (placed by MapTopControls); across the whole top when
// the map is too narrow for it and the panel side by side.
export const SearchBoxWrapper = styled(Box)({
  flexShrink: 0,
  width: `${SEARCH_BOX_WIDTH}px`,
  [NARROW_MAP]: {
    width: 'auto',
  },
});

export const SearchTextField = styled(TextField)(({ theme }) => {
  const { palette } = theme.vars ?? theme;
  return {
    [`& .${outlinedInputClasses.root}`]: {
      backgroundColor: palette.background.paper,
      color: palette.text.primary,
      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
      [`& .${outlinedInputClasses.notchedOutline}, &:hover .${outlinedInputClasses.notchedOutline}`]: {
        borderColor: BORDER_COLOR,
      },
      [`&.${outlinedInputClasses.focused} .${outlinedInputClasses.notchedOutline}`]: {
        borderColor: palette.primary.main,
      },
    },
    [`& .${outlinedInputClasses.input}`]: {
      padding: '2px 0',
    },
  };
});

export const SearchPaper = styled(Paper)(({ theme }) => {
  const { palette } = theme.vars ?? theme;
  return {
    marginTop: '4px',
    backgroundColor: palette.background.paper,
    // Dark-mode Paper adds a lightening overlay; keep the plain background.
    backgroundImage: 'none',
    color: palette.text.primary,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
    [`& .${autocompleteClasses.listbox}`]: {
      padding: 0,
    },
    // Scoped under the listbox to outrank MUI's default option highlight.
    [`& .${autocompleteClasses.listbox} .${autocompleteClasses.option}`]: {
      padding: '8px 12px',
      [`&.${autocompleteClasses.focused}, &[aria-selected="true"], &[aria-selected="true"].${autocompleteClasses.focused}`]: {
        backgroundColor: theme.alpha(palette.primary.main, 0.15),
      },
    },
    [`& .${autocompleteClasses.noOptions}, & .${autocompleteClasses.loading}`]: {
      padding: '8px 12px',
      fontSize: '12px',
      opacity: 0.7,
    },
  };
});

export const OptionText = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  minWidth: 0,
});

export const OptionName = styled(Typography)({
  // Typography sets its own 16px; take the 14px option size from the theme instead.
  fontSize: 'inherit',
  fontWeight: 600,
});

export const OptionDescription = styled(Typography)({
  fontSize: '12px',
  opacity: 0.7,
});
