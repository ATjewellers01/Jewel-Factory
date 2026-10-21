'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { IosInstallModal } from './IosInstallModal';
import { ServiceWorkerRegister } from './ServiceWorkerRegister';

// Standard BeforeInstallPromptEvent type for TypeScript
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

type PwaContextType = {
  isStandalone: boolean;
  canInstall: boolean;
  isIos: boolean;
  isAndroid: boolean;
  promptInstall: () => Promise<void>;
  showIosModal: boolean;
  setShowIosModal: (show: boolean) => void;
};

const PwaContext = createContext<PwaContextType>({
  isStandalone: false,
  canInstall: false,
  isIos: false,
  isAndroid: false,
  promptInstall: async () => {},
  showIosModal: false,
  setShowIosModal: () => {},
});

export function usePwa() {
  return useContext(PwaContext);
}

export function PwaProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Detect standalone mode
    const checkStandalone = () => {
      const matchMediaStandalone = window.matchMedia('(display-mode: standalone)').matches;
      // iOS Safari specific standalone flag
      const navigatorStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      const androidAppReferrer = document.referrer.includes('android-app://');
      const standalone = matchMediaStandalone || navigatorStandalone || androidAppReferrer;

      setIsStandalone(standalone);
      if (standalone) {
        setIsInstalled(true);
      }
    };

    checkStandalone();

    // Listen for display-mode changes
    const displayModeQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsStandalone(true);
        setIsInstalled(true);
      }
    };
    displayModeQuery.addEventListener?.('change', handleDisplayModeChange);

    // 2. Detect platform
    const ua = window.navigator.userAgent;
    const isIosDevice =
      /iPad|iPhone|iPod/.test(ua) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    const isAndroidDevice = /Android/i.test(ua);

    setIsIos(isIosDevice);
    setIsAndroid(isAndroidDevice);

    // 3. Listen for Android/Chrome beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // 4. Listen for appinstalled
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsStandalone(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      displayModeQuery.removeEventListener?.('change', handleDisplayModeChange);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async () => {
    // If on iOS: open the step-by-step modal guide
    if (isIos) {
      setShowIosModal(true);
      return;
    }

    // If deferredPrompt is available (Android Chrome, Edge, desktop Chrome)
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.warn('[PWA] prompt error:', err);
      }
      return;
    }

    // Fallback if not standalone: show the modal with guidance
    setShowIosModal(true);
  };

  // Requirement 6: "Show the install option only when applicable, and hide it if the app is already installed."
  const canInstall = !isStandalone && !isInstalled;

  return (
    <PwaContext.Provider
      value={{
        isStandalone,
        canInstall,
        isIos,
        isAndroid,
        promptInstall,
        showIosModal,
        setShowIosModal,
      }}
    >
      <ServiceWorkerRegister />
      {children}
      <IosInstallModal
        isOpen={showIosModal}
        onClose={() => setShowIosModal(false)}
      />
    </PwaContext.Provider>
  );
}
