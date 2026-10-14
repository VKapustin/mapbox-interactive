import type { Metadata } from 'next';
import Providers from '@/providers/Providers';
import { mulish } from '@/theme/fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'Landmarks Map',
  description: 'Explore landmarks across the USA and Europe on an interactive map, with photos, Wikipedia summaries, place search and filtering by a drawn area.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang='en' className={mulish.variable}>
      <body>
      <Providers>
        <div id='root'>
          {children}
        </div>
      </Providers>
      </body>
    </html>
  );
}
