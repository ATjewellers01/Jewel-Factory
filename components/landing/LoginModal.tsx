'use client';

import { Store, Gem, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import { StaffLoginForm } from '@/components/auth/StaffLoginForm';
import { Wordmark } from '@/components/landing/Wordmark';

/**
 * Landing-page login popup. Two columns: Retailer (Head Office) and Store
 * Manager, each with an embedded compact login form (reuses StaffLoginForm in
 * `bare` mode). Manufacturer login is intentionally NOT here — it is reached
 * only by visiting /manufacturer directly.
 */
export function LoginModal({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const [activeRole, setActiveRole] = useState<'retailer' | 'manager'>('retailer');

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="relative max-h-[calc(100dvh-0.75rem)] w-full overflow-y-auto overscroll-contain rounded-t-[1.75rem] bg-card shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-3xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Soft gold glow header accent */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(40rem_16rem_at_50%_-40%,rgba(201,168,76,0.18),transparent_70%)]" />
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/10 text-foreground/70 transition-colors hover:bg-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-9 sm:w-9"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative px-5 pt-7 text-center sm:px-6 sm:pt-8">
          <div className="flex justify-center">
            <Wordmark href={null} size="sm" />
          </div>
          <h2 id={titleId} className="mt-3 font-display text-2xl font-medium sm:mt-4">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">Choose your account type.</p>
        </div>

        <div className="relative mx-5 mt-5 grid grid-cols-2 rounded-xl bg-muted p-1 md:hidden">
          <button
            type="button"
            aria-pressed={activeRole === 'retailer'}
            onClick={() => setActiveRole('retailer')}
            className={`min-h-10 rounded-lg px-3 text-sm font-semibold transition-colors ${activeRole === 'retailer' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
          >
            Retailer Admin
          </button>
          <button
            type="button"
            aria-pressed={activeRole === 'manager'}
            onClick={() => setActiveRole('manager')}
            className={`min-h-10 rounded-lg px-3 text-sm font-semibold transition-colors ${activeRole === 'manager' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
          >
            Retailer User
          </button>
        </div>

        <div className="relative grid gap-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6 md:grid-cols-2 md:gap-5">
          {/* Retailer (Head Office) */}
          <div className={`${activeRole === 'retailer' ? 'block' : 'hidden'} rounded-2xl border bg-card/60 p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5 md:block`}>
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Store className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">Retailer Admin</p>
                <p className="text-xs text-muted-foreground">Head Office — approvals, stores, orders</p>
              </div>
            </div>
            <StaffLoginForm
              bare
              brandWordmark={false}
              title=""
              subtitle=""
              loginPath="/api/store/login"
              redirectTo="/store/manufacturer-catalog"
              forgotHref="/store/forgot-password"
              footerLinks={[{ prompt: 'New Retailer Admin?', label: 'Register here', href: '/store/register' }]}
            />
          </div>

          {/* Retailer User */}
          <div className={`${activeRole === 'manager' ? 'block' : 'hidden'} rounded-2xl border bg-card/60 p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5 md:block`}>
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Gem className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">Retailer User</p>
                <p className="text-xs text-muted-foreground">Run your store — kiosk, try-on, restock</p>
              </div>
            </div>
            <StaffLoginForm
              bare
              brandWordmark={false}
              title=""
              subtitle=""
              loginPath="/api/branch-manager/login"
              redirectTo="/store-manager"
              footerLinks={[{ prompt: 'No account?', label: 'Ask your Retailer Admin to add you', href: '/store/login' }]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
