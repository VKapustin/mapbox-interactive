import { type ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import theme from '@/theme/theme';
import { StringProvider } from '@/hooks/string';
import { strings } from '@/server/strings/strings';

// Renders with the app's MUI theme and UI strings, like Providers.tsx and page.tsx do in the app.
export const renderWithTheme = (ui: ReactElement, options?: RenderOptions) =>
  render(ui, {
    wrapper: ({ children }) => (
      <ThemeProvider theme={theme}>
        <StringProvider strings={strings}>{children}</StringProvider>
      </ThemeProvider>
    ),
    ...options,
  });
