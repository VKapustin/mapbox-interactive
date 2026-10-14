import { Mulish } from 'next/font/google';

// The app's font, self-hosted by Next.js (no requests to Google from the
// browser). Its family name is generated, so use `mulish.style.fontFamily`
// (MUI theme, canvas text on the map) or the `--font-mulish` CSS variable,
// which layout.tsx puts on <html>; never the literal 'Mulish'.
export const mulish = Mulish({
  subsets: ['latin'],
  variable: '--font-mulish',
});
