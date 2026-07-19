'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { StaffLoginForm } from '@/components/auth/StaffLoginForm';

/**
 * Manufacturer entry (/manufacturer). Not linked from the public site — the
 * manufacturer just types /manufacturer. If already signed in, go straight to the
 * dashboard; otherwise show the login form as a popup on this page.
 */
export default function ManufacturerEntryPage() {
  const [state, setState] = useState<'checking' | 'login'>('checking');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/manufacturer/me', { cache: 'no-store', credentials: 'same-origin' });
        if (res.ok) { window.location.assign('/manufacturer/dashboard'); return; }
      } catch { /* fall through to login */ }
      setState('login');
    })();
  }, []);

  if (state === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  // Login form shown as a centered popup over the pearl background.
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-3 py-10">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-xl sm:p-8">
        <StaffLoginForm
          bare
          title="Manufacturer Login"
          subtitle="Admin panel — catalog, retailers & orders."
          loginPath="/api/manufacturer/login"
          redirectTo="/manufacturer/dashboard"
        />
      </div>
    </div>
  );
}
