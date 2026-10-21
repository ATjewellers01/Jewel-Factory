'use client';

import { useSyncExternalStore } from 'react';

import { getPwaServerState, getPwaState, subscribePwa } from '@/lib/pwa';

/**
 * Install-App state for menus. The server snapshot reports "not installable",
 * so the item never renders during SSR and only appears after hydration on a
 * browser that can actually install.
 */
export function usePwaInstall() {
  const state = useSyncExternalStore(subscribePwa, getPwaState, getPwaServerState);
  const showInstall = !state.isStandalone && (state.canPrompt || state.isIos);
  return { ...state, showInstall };
}
