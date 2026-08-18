'use client';

import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Wordmark } from '@/components/landing/Wordmark';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Required } from '@/components/ui/field-mark';
import { Input } from '@/components/ui/input';
import { toFieldErrors } from '@/lib/field-error';

export function ResetPasswordForm({
  title,
  apiPath,
  loginHref,
}: {
  title: string;
  apiPath: string; // e.g. /api/store/reset-password
  loginHref: string;
}) {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!token) return setError('Missing or invalid reset link.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('Passwords do not match.');

    setLoading(true);
    try {
      const res = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: { message?: string; fields?: Record<string, string> } } | null;
        setFieldErrors(json?.error?.fields ?? {});
        return setError(json?.error?.message ?? 'Could not reset password. The link may have expired.');
      }
      setDone(true);
      setTimeout(() => router.push(loginHref), 1500);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Chrome intentionally mirrors ForgotPasswordForm — same glow, watermark, top
  // bar and card treatment — so the two halves of one flow look like one flow.
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(52rem_32rem_at_50%_-10%,rgba(201,168,76,0.16),transparent_60%)]" />
      <Image
        src="/JF.avif"
        alt=""
        aria-hidden
        width={448}
        height={448}
        className="pointer-events-none absolute -right-16 top-10 hidden w-[28rem] max-w-none opacity-[0.04] lg:block"
      />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-6">
        <Wordmark href="/" size="sm" />
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Back to Jewel Factory</span><span className="sm:hidden">Home</span>
        </Link>
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm space-y-5 rounded-3xl border bg-card p-6 shadow-xl sm:p-8">
          <div className="text-center">
            {done && (
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            )}
            <h1 className="font-display text-2xl font-medium tracking-tight">{title}</h1>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
              {done ? 'Password reset. Redirecting to sign in…' : 'Choose a new password for your account.'}
            </p>
          </div>

          {done ? null : (
            <form onSubmit={submit} className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#4f473f]">New password<Required /></span>
                <div className="relative">
                  <Input
                    type={show ? 'text' : 'password'}
                    placeholder="New password (min 6)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
              <FieldError errors={toFieldErrors(fieldErrors.password)} />
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#4f473f]">Confirm password<Required /></span>
                <Input
                  type={show ? 'text' : 'password'}
                  placeholder="Confirm password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </label>
              <FieldError errors={toFieldErrors(fieldErrors.token)} />
              {error && <p className="text-center text-sm text-red-600">{error}</p>}
              <Button type="submit" className="h-11 w-full metal-sheen text-[#17120b] font-semibold" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Set new password'}
              </Button>
            </form>
          )}

          <p className="text-center text-sm text-muted-foreground">
            <Link href={loginHref} className="font-medium text-primary underline underline-offset-4">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
