import type { Metadata } from 'next';
import { IBM_Plex_Sans, Source_Sans_3 } from 'next/font/google';
import './globals.css';

const sans = Source_Sans_3({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const display = IBM_Plex_Sans({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'EasyDispatch',
  description: 'AI-first HVAC field service management',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${display.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
