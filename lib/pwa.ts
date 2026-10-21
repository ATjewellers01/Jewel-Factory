'use client';

// "Install App" state, shared by every menu that shows the install item.
//
// Chrome fires `beforeinstallprompt` once, often before any menu has mounted,
// so the listeners attach at module load (this module is imported by
// PwaRoot in the root layout) and hold the event until a menu asks for it.
// The iOS instructions sheet is open/closed here too, because the menus that
// trigger it unmount as soon as they close.

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export type PwaInstallState = {
  /** Android/desktop Chromium has offered an install prompt we can show. */
  canPrompt: boolean;
  /** Running as the installed app (no browser chrome). */
  isStandalone: boolean;
  /** iPhone/iPad — no prompt API, install is manual via Share. */
  isIos: boolean;
  iosSheetOpen: boolean;
};

const SERVER_STATE: PwaInstallState = { canPrompt: false, isStandalone: false, isIos: false, iosSheetOpen: false };

let deferredPrompt: InstallPromptEvent | null = null;
let state: PwaInstallState = SERVER_STATE;
const listeners = new Set<() => void>();

function setState(patch: Partial<PwaInstallState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function detectStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function detectIos() {
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac; touch support gives it away.
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

if (typeof window !== 'undefined') {
  state = { canPrompt: false, isStandalone: detectStandalone(), isIos: detectIos(), iosSheetOpen: false };

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // keep Chrome's own mini-infobar; our menu item offers it
    deferredPrompt = event as InstallPromptEvent;
    setState({ canPrompt: true });
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    setState({ canPrompt: false });
  });

  window.matchMedia('(display-mode: standalone)').addEventListener('change', () => {
    setState({ isStandalone: detectStandalone() });
  });
}

export function subscribePwa(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getPwaState() {
  return state;
}

export function getPwaServerState() {
  return SERVER_STATE;
}

/** Shows Chrome's install dialog. Resolves true if the user accepted. */
export async function promptInstall() {
  if (!deferredPrompt) return false;
  const event = deferredPrompt;
  deferredPrompt = null; // a prompt event can only be used once
  setState({ canPrompt: false });
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome === 'accepted';
}

export function openIosInstallSheet() {
  setState({ iosSheetOpen: true });
}

export function closeIosInstallSheet() {
  setState({ iosSheetOpen: false });
}
