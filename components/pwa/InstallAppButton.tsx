'use client';

import { Download } from 'lucide-react';

import { usePwaInstall } from '@/hooks/use-pwa-install';
import { openInstallSheet, promptInstall } from '@/lib/pwa';

/**
 * Compact "Install App" pill for a navbar's top-right — unlike
 * InstallAppMenuItem (a full row inside a menu), this is meant to sit in the
 * header itself so a first-time, logged-out visitor sees it without opening
 * any menu. Renders nothing once the app is already running installed; the
 * public navbar it lives in disappears after login, so it also goes away then.
 *
 * Click: Chrome's one-tap prompt where available (Android/desktop), otherwise
 * the manual-steps sheet (iPhone — Apple allows no install button).
 */
export function InstallAppButton({ className }: { className?: string }) {
  const { showInstall, canPrompt } = usePwaInstall();
  if (!showInstall) return null;

  const handleClick = () => {
    if (canPrompt) void promptInstall();
    else openInstallSheet();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Install app"
      className={
        className ??
        'inline-flex items-center gap-1.5 rounded-full border border-[#c9a84c]/60 bg-white/70 px-3 py-2 text-xs font-semibold text-[#8a6d1f] shadow-sm transition-colors hover:border-[#c9a84c] hover:bg-white'
      }
    >
      <Download className="h-4 w-4" />
      Install App
    </button>
  );
}
