'use client';

import { X, ArrowRight, Store } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const SEEN_KEY = 'jf_register_prompt_seen';

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={close}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-card p-6 text-center shadow-xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-full bg-black/10 p-1.5 text-foreground/70 hover:bg-black/20"
        >
          <X className="h-4 w-4" />
        </button>

        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Store className="h-6 w-6" />
        </span>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <span className="text-[#C9A84C]">Jewel</span> Factory
        </p>
        <h2 className="mt-1 font-display text-2xl font-medium">Become a Retailer</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Register your jewellery business to browse the full gold catalog, place
          B2B restock orders, and run your in-store kiosks. Approval is quick.
        </p>

        <Link
          href="/store/register"
          className="metal-sheen mt-5 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-[#17120b]"
        >
          Register here <ArrowRight className="h-4 w-4" />
        </Link>
        <button onClick={close} className="mt-3 block w-full text-xs text-muted-foreground hover:text-foreground">
          Maybe later
        </button>
      </div>
    </div>
  );
}
