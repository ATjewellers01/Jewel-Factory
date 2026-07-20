'use client';

import { ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Wordmark } from '@/components/landing/Wordmark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type FooterLink = { label: string; prompt?: string; href: string };

export function StaffLoginForm({
  title,
  subtitle,
  loginPath,
  redirectTo,
  footerLinks = [],
  forgotHref,
  bare = false,
  showLabels = false,
}: {
  title: string;
  subtitle: string;
  loginPath: string; // e.g. /api/store/login
  redirectTo: string; // e.g. /store/dashboard
  /** @deprecated no longer used — the wordmark now lives in the page top bar. */
  brandWordmark?: boolean;
  footerLinks?: FooterLink[];
  forgotHref?: string;
  // bare = render just the form (no full-screen wrapper/background) so it can be
  // embedded inside a modal (e.g. the landing-page login popup).
  bare?: boolean;
  // Full portal pages use visible labels; the compact landing modal keeps the
  // existing placeholder-led presentation.
  showLabels?: boolean;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(loginPath, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = (await res.json().catch(() => null)) as
        | { error?: { message?: string } }
        | { data?: unknown }
        | null;
      if (!res.ok || (json && 'error' in json && json.error)) {
        setError(
          json && 'error' in json && json.error?.message
            ? json.error.message
            : 'Invalid email or password',
        );
        setLoading(false); // reset so the user can correct credentials and retry
        return;
      }
      // Full-page navigation (not router.push) so the just-set auth cookie is
      // committed and sent on the dashboard's first API call. Keep loading true
      // through the redirect.
      window.location.assign(redirectTo);
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  const form = (
      <form
        onSubmit={submit}
        className={bare ? 'w-full space-y-4' : 'w-full max-w-sm space-y-5 rounded-3xl border bg-card p-6 shadow-xl sm:p-8'}
      >
        {(title || subtitle) && (
          <div className="text-center">
            {title && <h1 className="font-display text-2xl font-medium tracking-tight">{title}</h1>}
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        )}

        <div className="space-y-4">
          <label className="block space-y-2">
            {showLabels && <span className="text-xs font-semibold text-[#4f473f]">Email address</span>}
            <Input
              type="email"
              autoComplete="email"
              placeholder={showLabels ? 'you@company.com' : 'Email'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={showLabels ? 'h-12 rounded-xl border-[#dcd3c6] bg-white px-4 shadow-sm transition-shadow focus-visible:ring-[#b98b31]/35' : undefined}
            />
          </label>
          <label className="block space-y-2">
            {showLabels && <span className="text-xs font-semibold text-[#4f473f]">Password</span>}
            <span className="relative block">
              <Input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={showLabels ? 'h-12 rounded-xl border-[#dcd3c6] bg-white px-4 pr-12 shadow-sm transition-shadow focus-visible:ring-[#b98b31]/35' : 'pr-10'}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[#f5f0e8] hover:text-foreground"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </label>
        </div>

        {forgotHref && (
          <div className="text-right">
            <Link href={forgotHref} className="text-xs font-medium text-[#766b60] underline decoration-[#c3a15c] underline-offset-4 transition-colors hover:text-[#8e6721]">
              Forgot password?
            </Link>
          </div>
        )}

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-center text-sm text-red-700">{error}</p>}

        <Button type="submit" className="h-12 w-full rounded-xl metal-sheen text-[#17120b] font-semibold shadow-[0_8px_20px_rgba(167,119,45,0.18)] transition-transform hover:-translate-y-0.5" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
        </Button>

        {footerLinks.map((f) => (
          <p key={f.href} className="text-center text-sm text-muted-foreground">
            {f.prompt ? `${f.prompt} ` : ''}
            <Link href={f.href} className="font-semibold text-[#6d6258] underline decoration-[#c3a15c] underline-offset-4 transition-colors hover:text-[#8e6721]">
              {f.label}
            </Link>
          </p>
        ))}
      </form>
  );

  if (bare) return form;
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      {/* Soft gold glow backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(52rem_32rem_at_50%_-10%,rgba(201,168,76,0.16),transparent_60%)]" />
      {/* Faint JF monogram watermark */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/JF.avif" alt="" aria-hidden className="pointer-events-none absolute -right-16 top-10 hidden w-[28rem] max-w-none opacity-[0.04] lg:block" />

      {/* Top bar — wordmark + back to Jewel Factory */}
      <div className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-6">
        <Wordmark href="/" size="sm" />
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Back to Jewel Factory</span><span className="sm:hidden">Home</span>
        </Link>
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">{form}</div>
      </div>
    </div>
  );
}
