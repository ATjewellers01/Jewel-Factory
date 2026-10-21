import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';

import { PwaRoot } from '@/components/pwa/PwaRoot';
import { PWA_THEME_COLOR, SPLASH_SCREENS, splashFileName, splashMedia } from '@/lib/pwa-splash';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Jewel Factory',
    template: '%s | Jewel Factory',
  },
  description:
    'Premium jewellery with AI-powered visual search and virtual try-on. Powered by Jewel Factory.',
  icons: {
    icon: '/logo-icon.png',
    shortcut: '/logo-icon.png',
    apple: '/icons/apple-touch-icon-180.png',
  },
  // Installed-app behaviour on iPhone/iPad (Android reads app/manifest.ts).
  // 'default' status bar, not 'black-translucent', so pages don't slide under
  // the notch and sticky headers need no safe-area padding.
  appleWebApp: {
    capable: true,
    title: 'Jewel Factory',
    statusBarStyle: 'default',
    startupImage: SPLASH_SCREENS.map((screen) => ({
      url: `/splash/${splashFileName(screen)}`,
      media: splashMedia(screen),
    })),
  },
  // Next 15 emits only the standard `mobile-web-app-capable`; iOS before
  // 16.4 needs Apple's own tag for standalone mode and splash screens.
  other: {
    'apple-mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: PWA_THEME_COLOR,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body
        className="min-h-screen font-sans antialiased bg-background text-foreground"
        suppressHydrationWarning
      >
        {children}
        <PwaRoot />
      </body>
    </html>
  );
}
