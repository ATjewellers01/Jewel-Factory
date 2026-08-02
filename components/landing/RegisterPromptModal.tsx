'use client';

import { X, ArrowRight, Gem, Camera, Search } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

const SEEN_KEY = 'jf_register_prompt_seen';

const CHIPS = [
  { icon: Gem, label: 'Full gold catalogue' },
  { icon: Camera, label: 'Virtual Try-On' },
  { icon: Search, label: 'Similar-design search' },
];

/**
 * Auto-opening "Register here" prompt on the public landing page. Appears ~5s
 * after load for a logged-out visitor, is dismissible with the X, and shows only
 * once per browser session (sessionStorage) so it isn't annoying.
 */
export function RegisterPromptModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(SEEN_KEY)) return;
    const t = setTimeout(() => setOpen(true), 5000);
    return () => clearTimeout(t);
  }, []);

  function close() {
    setOpen(false);
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex min-h-full items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onClick={close}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        className="relative w-full max-w-md overflow-hidden rounded-3xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gold glow header accent */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(34rem_14rem_at_50%_-45%,rgba(201,168,76,0.28),transparent_70%)]" />

        <button
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 rounded-full bg-black/10 p-1.5 text-foreground/70 transition-colors hover:bg-black/20"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative px-6 pb-6 pt-9 text-center sm:px-8 sm:pt-10">
          {/* Jewel Factory monogram */}
          <span className="mx-auto block h-14 w-14">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/JF.avif" alt="Jewel Factory" className="h-14 w-14 object-contain" />
          </span>

          <p className="mt-4 font-display text-xs font-medium uppercase tracking-[0.2em]">
            <span className="text-[#c9a84c]">Jewel</span> <span className="text-foreground">Factory</span>
          </p>
          <h2 className="mt-1.5 font-display text-2xl font-medium tracking-tight sm:text-[27px]">Become a Retailer Admin</h2>
          <p className="mx-auto mt-2.5 max-w-xs text-sm leading-6 text-muted-foreground">
            Register your jewellery business to browse the full gold catalogue,
            place restock orders, and run your in-store kiosks. Approval is quick.
          </p>

          {/* Benefit chips */}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {CHIPS.map(({ icon: Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-[#8a6a29]">
                <Icon className="h-3.5 w-3.5 text-[#b68a3e]" /> {label}
              </span>
            ))}
          </div>

          <Link
            href="/store/register"
            onClick={close}
            className="metal-sheen mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-[#17120b] shadow-lg shadow-black/10 transition-transform hover:scale-[1.01]"
          >
            Register here <ArrowRight className="h-4 w-4" />
          </Link>
          <button onClick={close} className="mt-3 block w-full text-xs text-muted-foreground transition-colors hover:text-foreground">
            Maybe later
          </button>
        </div>
      </motion.div>
    </div>
  );
}
