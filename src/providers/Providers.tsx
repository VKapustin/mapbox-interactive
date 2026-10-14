'use client'
import React, { FC } from 'react';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { ThemeProvider } from '@mui/material';
import theme from '@/theme/theme';

const Providers: FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>
        { children }
      </ThemeProvider>
    </AppRouterCacheProvider>
  )
}

export default Providers;