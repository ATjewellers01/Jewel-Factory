import type { MetadataRoute } from 'next';

import { PWA_BACKGROUND, PWA_THEME_COLOR } from '@/lib/pwa-splash';

// Installable-app manifest, served at /manifest.webmanifest. One app for every
// role: it opens on the landing page, which has the login options for each.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Jewel Factory',
    short_name: 'Jewel Factory',
    description: 'Gold jewellery catalogue, ordering and AI design search for retailers.',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: PWA_BACKGROUND,
    theme_color: PWA_THEME_COLOR,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
