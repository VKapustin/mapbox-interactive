'use client';
import { createTheme, ThemeOptions } from '@mui/material/styles';
import { mulish } from '@/theme/fonts';

const accent = '#3b82f6';

const themeOptions: ThemeOptions = {
  // CSS variables + a light and a dark scheme: MUI switches between them with
  // `prefers-color-scheme`, matching the --background/--foreground tokens in globals.css.
  cssVariables: true,
  colorSchemes: {
    light: {
      palette: {
        primary: { main: accent },
        background: { default: '#ffffff', paper: '#ffffff' },
        text: { primary: '#171717' },
      },
    },
    dark: {
      palette: {
        primary: { main: accent },
        background: { default: '#0a0a0a', paper: '#0a0a0a' },
        text: { primary: '#ededed' },
      },
    },
  },
  typography: {
    // Mulish, loaded by next/font (see fonts.ts).
    fontFamily: `${mulish.style.fontFamily}, sans-serif`,
  },
  components: {
    // Every outlined TextField (incl. TextField select and the search Autocomplete) uses 14px input text.
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px',
            // Set on the root, not the inner input: MUI derives the line height
            // (1.4375em) from the root, so this keeps every field the same height.
            fontSize: '14px',
          },
        },
      },
    },
    // Every input label uses 14px. Outlined labels normally shrink to 75% when they
    // float on the border; keep them at full size so they also show at 14px.
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontSize: '14px',
          '&.MuiInputLabel-outlined.MuiInputLabel-shrink': {
            transform: 'translate(14px, -10px) scale(1)',
          },
        },
      },
    },
    // The legend sizes the gap in the outline behind a floating label; match the 14px label.
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: {
          '& legend': {
            fontSize: '14px',
          },
        },
      },
    },
    // Menu popups (incl. Select / TextField select dropdowns) match the 8px input corners.
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: '8px',
        },
      },
    },
    // Every checkbox / radio / switch label (e.g. the layer names) uses 14px.
    MuiFormControlLabel: {
      styleOverrides: {
        label: {
          fontSize: '14px',
        },
      },
    },
    // Every menu (Menu, Select / TextField select dropdowns) uses 14px items.
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: '14px',
        },
      },
    },
    // Every Autocomplete suggestion (incl. the search box) uses 14px, like menu items,
    // and its popup matches the 8px corners of inputs and menus.
    MuiAutocomplete: {
      styleOverrides: {
        option: {
          fontSize: '14px',
        },
        paper: {
          borderRadius: '8px',
        },
      },
    },
  },
};


const theme = createTheme(themeOptions);

export default theme;
