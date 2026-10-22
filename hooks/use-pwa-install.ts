'use client';

import { useSyncExternalStore } from 'react';

import { getPwaServerState, getPwaState, subscribePwa } from '@/lib/pwa';

/**
 * Install-App state for menus. The item shows on every browser that isn't
 * already running the installed app: Chrome's own prompt when it has offered
 * one, otherwise manual steps. Chrome withholds `beforeinstallprompt` on a
 * first visit (until the user has tapped and stayed ~30s), after a dismissal,
 * and in Samsung Internet/Firefox/in-app browsers, so gating on it hid the
 * item for most visitors. The server snapshot reports "standalone", so the
 * item never renders during SSR and only appears after hydration.
 */
export function usePwaInstall() {
  const state = useSyncExternalStore(subscribePwa, getPwaState, getPwaServerState);
  const showInstall = !state.isStandalone;
  return { ...state, showInstall };
}
