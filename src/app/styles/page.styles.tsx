'use client';

import {styled} from '@mui/material/styles';

// 'use client' because styled() reads the theme from React context, which
// Server Components can't; page.tsx itself stays a Server Component.
export const PageWrapper = styled('main')({
  height: '100vh',
  width: '100%',
});
