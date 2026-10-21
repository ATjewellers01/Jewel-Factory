'use client';

import { Download } from 'lucide-react';

import { usePwaInstall } from '@/hooks/use-pwa-install';
import { openIosInstallSheet, promptInstall } from '@/lib/pwa';

/**
 * "Install App" row for a navigation menu. Renders nothing when the app is
 * already installed or the browser can't install it. Each menu passes its own
 * row styling so the item matches its neighbours.
 */
export function InstallAppMenuItem({
  className,
  iconWrapClassName,
  iconClassName = 'h-4 w-4',
  onSelect,
}: {
  className: string;
  /** Optional circle/badge around the icon, as some menus use. */
  iconWrapClassName?: string;
  iconClassName?: string;
  /** Called first, e.g. to close the menu. */
  onSelect?: () => void;
}) {
  const { showInstall, canPrompt } = usePwaInstall();
  if (!showInstall) return null;

  const handleClick = () => {
    onSelect?.();
    if (canPrompt) void promptInstall();
    else openIosInstallSheet();
  };

  const icon = <Download className={iconClassName} />;
  return (
    <button type="button" onClick={handleClick} className={className}>
      {iconWrapClassName ? <span className={iconWrapClassName}>{icon}</span> : icon}
      Install App
    </button>
  );
}
