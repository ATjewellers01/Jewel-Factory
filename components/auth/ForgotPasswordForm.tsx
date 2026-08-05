'use client';

import { ArrowLeft, Loader2, Mail, MailCheck, Phone, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Wordmark } from '@/components/landing/Wordmark';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { toFieldErrors } from '@/lib/field-error';
import { SUPPORT_EMAIL, SUPPORT_EMAIL_HREF, SUPPORT_PHONE, SUPPORT_PHONE_HREF } from '@/lib/support';

export function ForgotPasswordForm({
  title,
  apiPath,
  backHref,
}: {
  title: string;
  apiPath: string; // e.g. /api/store/forgot-password
  backHref: string;
}) {
  const [mobileNumber, setMobileNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [mobileOnly, setMobileOnly] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setBlocked(null);
    setMobileOnly(null);
    setFieldErrors({});
    try {
      const res = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileNumber: mobileNumber.trim() }),
      });
      // A deactivated account is told plainly — a reset link can't restore access.
      if (res.status === 403) {
        const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setBlocked(json?.error?.message ?? 'This account is deactivated.');
        return;
      }
      // Registered with a mobile number only — there's no email to send a link
      // to, and no separate password to reset.
      if (res.status === 400) {
        const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setMobileOnly(json?.error?.message ?? 'This account signs in with your mobile number as both the username and password.');
        return;
      }
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: { message?: string; fields?: Record<string, string> } } | null;
        setFieldErrors(json?.error?.fields ?? {});
        return;
      }
      setSent(true); // otherwise always show success (anti-enumeration)
    } catch {
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(52rem_32rem_at_50%_-10%,rgba(201,168,76,0.16),transparent_60%)]" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/JF.avif" alt="" aria-hidden className="pointer-events-none absolute -right-16 top-10 hidden w-[28rem] max-w-none opacity-[0.04] lg:block" />

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
            {sent && !blocked && !mobileOnly && (
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
                <MailCheck className="h-6 w-6" />
              </div>
            )}
            {(blocked || mobileOnly) && (
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <ShieldAlert className="h-6 w-6" />
              </div>
            )}
            <h1 className="font-display text-2xl font-medium tracking-tight">
              {blocked ? 'Account deactivated' : mobileOnly ? 'No email on this account' : title}
            </h1>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
              {blocked
                ? blocked
                : mobileOnly
                  ? mobileOnly
                  : sent
                    ? 'If an account is registered with this mobile number, a reset link has been sent to the email on file.'
                    : 'Enter your mobile number and, if an email is on file for your account, we will send a reset link there.'}
            </p>
          </div>

          {/* Deactivated: a reset link cannot restore access, so surface the
              support contact instead of a dead-end success message. */}
          {blocked && (
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm">
              <p className="font-medium text-[#7a5a15]">Contact us to reactivate</p>
              <a href={SUPPORT_EMAIL_HREF} className="flex items-center gap-2 text-[#7a5a15] hover:underline">
                <Mail className="h-4 w-4 shrink-0 text-[#b0862f]" />
                <span className="break-all">{SUPPORT_EMAIL}</span>
              </a>
              <a href={SUPPORT_PHONE_HREF} className="flex items-center gap-2 text-[#7a5a15] hover:underline">
                <Phone className="h-4 w-4 shrink-0 text-[#b0862f]" />
                <span>{SUPPORT_PHONE}</span>
              </a>
              <button
                type="button"
                onClick={() => { setBlocked(null); setSent(false); }}
                className="pt-1 text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Try a different mobile number
              </button>
            </div>
          )}

          {/* Mobile-only account: sign in directly, no reset needed. */}
          {mobileOnly && (
            <div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-sm text-blue-900">
              <p>Sign in using your mobile number as both the username and the password.</p>
              <Link href={backHref} className="inline-block font-semibold underline underline-offset-4">
                Back to sign in
              </Link>
            </div>
          )}

          {!sent && !blocked && !mobileOnly && (
            <form onSubmit={submit} className="space-y-4">
              <Input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="10-digit mobile number"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                required
              />
              <FieldError errors={toFieldErrors(fieldErrors.mobileNumber)} />
              <Button type="submit" className="h-11 w-full metal-sheen text-[#17120b] font-semibold" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send reset link'}
              </Button>
            </form>
          )}

          <p className="text-center text-sm text-muted-foreground">
            <Link href={backHref} className="font-medium text-primary underline underline-offset-4">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
