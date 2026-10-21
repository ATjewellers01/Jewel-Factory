'use client';

import { Download, Smartphone } from 'lucide-react';
import { usePwa } from './pwa-context';

type InstallMenuItemProps = {
  variant?: 'drawer' | 'public' | 'kiosk' | 'store-manager' | 'portal';
  onAfterClick?: () => void;
  className?: string;
};

export function InstallMenuItem({
  variant = 'drawer',
  onAfterClick,
  className = '',
}: InstallMenuItemProps) {
  const { canInstall, promptInstall, isIos } = usePwa();

  if (!canInstall) return null;

  const handleClick = async () => {
    onAfterClick?.();
    await promptInstall();
  };

  const label = isIos ? 'Add to Home Screen' : 'Install App';

  if (variant === 'public') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-[#544b43] transition-colors hover:bg-black/5 ${className}`}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f1e6ce] text-[#a77d31]">
          <Smartphone className="h-4 w-4" />
        </span>
        <div className="flex flex-col">
          <span>{label}</span>
          <span className="text-[10px] font-normal text-[#9b8d7e]">
            Standalone mobile app
          </span>
        </div>
      </button>
    );
  }

  if (variant === 'kiosk') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`flex w-full items-center gap-3 border-b border-[#eee] px-4 py-3 text-left text-sm text-[#211c17] transition-colors hover:bg-[#f5ede0] ${className}`}
      >
        <Smartphone className="h-4 w-4 text-[#c99d37]" />
        <div>
          <span className="font-medium">{label}</span>
          <span className="block text-[10px] text-[#8e8275]">
            Add to home screen
          </span>
        </div>
      </button>
    );
  }

  if (variant === 'portal') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-[#5f5750] transition-colors hover:bg-[#f3efe8] hover:text-[#26221e] ${className}`}
      >
        <Smartphone className="h-4 w-4 shrink-0 text-[#756d65] group-hover:text-[#a77d31]" />
        <span className="truncate">{label}</span>
        <span className="ml-auto rounded-full bg-[#faedd4] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#987229]">
          PWA
        </span>
      </button>
    );
  }

  if (variant === 'store-manager') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-[#544b43] transition-colors hover:bg-black/5 ${className}`}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eee7da] text-[#a77d31]">
          <Download className="h-4 w-4" />
        </span>
        <div className="flex flex-col">
          <span>{label}</span>
          <span className="text-[10px] font-normal text-[#9b8f83]">
            Fast standalone experience
          </span>
        </div>
      </button>
    );
  }

  // Default 'drawer' (used in StoreLayout)
  return (
    <button
      type="button"
      onClick={handleClick}
      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-[#5f5750] transition-colors hover:bg-[#f3efe8] hover:text-[#26221e] ${className}`}
    >
      <Smartphone className="h-4 w-4 shrink-0 text-[#756d65] group-hover:text-[#a77d31]" />
      <span className="truncate">{label}</span>
      <span className="ml-auto rounded-full bg-[#faedd4] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#987229]">
        App
      </span>
    </button>
  );
}
