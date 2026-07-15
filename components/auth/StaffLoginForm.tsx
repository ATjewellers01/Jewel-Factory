'use client';

import { Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type FooterLink = { label: string; prompt?: string; href: string };

export function StaffLoginForm({
  title,
  subtitle,
  loginPath,
  redirectTo,
  brandWordmark = true,
  footerLinks = [],
  forgotHref,
}: {
  title: string;
  subtitle: string;
  loginPath: string; // e.g. /api/store/login
  redirectTo: string; // e.g. /store/dashboard
  brandWordmark?: boolean;
  footerLinks?: FooterLink[];
  forgotHref?: string;
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
        return;
      }
      // Full-page navigation (not router.push) so the just-set auth cookie is
      // committed and sent on the dashboard's first API call.
      window.location.assign(redirectTo);
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-3 py-10">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-5 rounded-2xl border bg-card p-8 shadow-sm"
      >
        <div className="text-center">
          {brandWordmark && (
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <span className="text-[#C9A84C]">Jewel</span> Factory
            </p>
          )}
          <h1 className="mt-2 text-2xl font-medium tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>

        <div className="space-y-3">
          <Input
            type="email"
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {forgotHref && (
          <div className="text-right">
            <Link href={forgotHref} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
              Forgot password?
            </Link>
          </div>
        )}

        {error && <p className="text-center text-sm text-red-600">{error}</p>}

        <Button type="submit" className="h-11 w-full metal-sheen text-[#17120b] font-semibold" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
        </Button>

        {footerLinks.map((f) => (
          <p key={f.href} className="text-center text-sm text-muted-foreground">
            {f.prompt ? `${f.prompt} ` : ''}
            <Link href={f.href} className="font-medium underline underline-offset-4">
              {f.label}
            </Link>
          </p>
        ))}
      </form>
    </div>
  );
}
