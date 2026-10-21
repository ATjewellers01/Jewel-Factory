'use client';

import { Check, Compass, PlusSquare, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect } from 'react';

type IosInstallModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function IosInstallModal({ isOpen, onClose }: IosInstallModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ios-install-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal / Bottom Sheet */}
      <div className="relative w-full max-w-md rounded-t-3xl bg-[#fcfaf6] p-6 text-[#211c17] shadow-2xl transition-all sm:rounded-3xl border border-[#e8dfcf]">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-[#ebdcc4]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#191511] p-1.5 shadow-md ring-1 ring-[#c9a84c]/40">
              <Image
                src="/icons/apple-touch-icon.png"
                alt="Jewel Factory"
                width={40}
                height={40}
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <h2
                id="ios-install-title"
                className="font-display text-lg font-bold text-[#1f1a14]"
              >
                Install Jewel Factory
              </h2>
              <p className="text-xs text-[#8a7f72]">
                jewelfactory.ai • Add to Home Screen
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#7f7467] hover:bg-black/5 hover:text-[#211c17]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Steps */}
        <div className="mt-5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#9f7d3b]">
            Simple 3-Step Setup
          </p>

          {/* Step 1 */}
          <div className="flex items-start gap-3.5 rounded-2xl bg-white p-3.5 shadow-sm border border-[#f0e8dc]">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fbf6ec] text-[#b48a3c] border border-[#ebdcc4]">
              {/* Apple Share icon (square with upward arrow) */}
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-[#211c17]">
                1. Tap the Share button
              </p>
              <p className="text-xs text-[#73695d] mt-0.5">
                In Safari&apos;s bottom toolbar, tap the{' '}
                <strong className="text-[#211c17]">Share</strong> icon (the box with an upward arrow).
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-3.5 rounded-2xl bg-white p-3.5 shadow-sm border border-[#f0e8dc]">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fbf6ec] text-[#b48a3c] border border-[#ebdcc4]">
              <PlusSquare className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#211c17]">
                2. Select &ldquo;Add to Home Screen&rdquo;
              </p>
              <p className="text-xs text-[#73695d] mt-0.5">
                Scroll down through the share options and tap{' '}
                <strong className="text-[#211c17]">Add to Home Screen</strong>.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-3.5 rounded-2xl bg-white p-3.5 shadow-sm border border-[#f0e8dc]">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fbf6ec] text-[#b48a3c] border border-[#ebdcc4]">
              <Check className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#211c17]">
                3. Tap &ldquo;Add&rdquo; in the top-right
              </p>
              <p className="text-xs text-[#73695d] mt-0.5">
                Tap <strong className="text-[#211c17]">Add</strong> in the top-right corner. Jewel Factory will now open without browser chrome!
              </p>
            </div>
          </div>

          {/* In-app browser tip */}
          <div className="flex items-start gap-2.5 rounded-xl bg-[#f6eee2] p-3 text-[11px] text-[#7f663c] border border-[#edd9be]">
            <Compass className="h-4 w-4 shrink-0 mt-0.5 text-[#b48a3c]" />
            <span>
              <strong>Opening from WhatsApp or Telegram?</strong> Tap the compass icon (🧭) or menu at the bottom right to &ldquo;Open in Safari&rdquo; first.
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl bg-gradient-to-r from-[#d4a843] to-[#b6892e] py-3 text-center text-sm font-bold text-white shadow-md transition-all hover:brightness-105 active:scale-[0.99]"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
