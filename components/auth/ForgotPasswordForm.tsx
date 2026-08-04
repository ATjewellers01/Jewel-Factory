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
  lookupPath,
}: {
  title: string;
  apiPath: string; // e.g. /api/store/forgot-password
  backHref: string;
  /** When set, offers "Forgot your email?" — looks the address up by mobile number. */
  lookupPath?: string;
}) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // "Forgot your email?" — recover the sign-in address from a mobile number.
  const [showLookup, setShowLookup] = useState(false);
  const [mobile, setMobile] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupFieldErrors, setLookupFieldErrors] = useState<Record<string, string>>({});
  const [foundEmail, setFoundEmail] = useState<string | null>(null);
  const [mobileOnly, setMobileOnly] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setBlocked(null);
    setFieldErrors({});
    try {
      const res = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      // A deactivated account is told plainly — a reset link can't restore access.
      if (res.status === 403) {
        const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setBlocked(json?.error?.message ?? 'This account is deactivated.');
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

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setLookupBusy(true);
    setLookupError(null);
    setLookupFieldErrors({});
    setFoundEmail(null);
    setMobileOnly(false);
    try {
      const res = await fetch(lookupPath!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileNumber: mobile.trim() }),
      });
      const json = (await res.json().catch(() => null)) as
        | { data?: { email: string | null; usesMobileLogin: boolean }; error?: { message?: string; fields?: Record<string, string> } }
        | null;
      if (!res.ok || !json?.data) {
        setLookupFieldErrors(json?.error?.fields ?? {});
        setLookupError(json?.error?.message ?? 'Could not look up that mobile number.');
        return;
      }
      if (json.data.usesMobileLogin || !json.data.email) {
        setMobileOnly(true);
        return;
      }
      setFoundEmail(json.data.email);
      setEmail(json.data.email); // pre-fill so they can send the link immediately
    } catch {
      setLookupError('Network error. Please try again.');
    } finally {
      setLookupBusy(false);
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
            {sent && !blocked && (
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
                <MailCheck className="h-6 w-6" />
              </div>
            )}
            {blocked && (
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <ShieldAlert className="h-6 w-6" />
              </div>
            )}
            <h1 className="font-display text-2xl font-medium tracking-tight">
              {blocked ? 'Account deactivated' : title}
            </h1>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
              {blocked
                ? blocked
                : sent
                  ? 'If an account exists, a reset link has been sent to that email.'
                  : 'Enter your email and we will send a reset link.'}
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
                Try a different email
              </button>
            </div>
          )}

          {!sent && !blocked && (
            <form onSubmit={submit} className="space-y-4">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <FieldError errors={toFieldErrors(fieldErrors.email)} />
              <Button type="submit" className="h-11 w-full metal-sheen text-[#17120b] font-semibold" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send reset link'}
              </Button>
            </form>
          )}

          {/* Recover the sign-in email from a mobile number. */}
          {lookupPath && !sent && !blocked && (
            <div className="border-t pt-4">
              {!showLookup ? (
                <button
                  type="button"
                  onClick={() => setShowLookup(true)}
                  className="w-full text-center text-sm font-medium text-primary underline underline-offset-4"
                >
                  Forgot your email?
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs leading-5 text-muted-foreground">
                    Enter the mobile number you registered with and we&apos;ll show the email on your account.
                  </p>
                  <form onSubmit={lookup} className="flex gap-2">
                    <Input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="10-digit mobile number"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      required
                    />
                    <Button type="submit" variant="outline" disabled={lookupBusy} className="shrink-0">
                      {lookupBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Find'}
                    </Button>
                  </form>
                  <FieldError errors={toFieldErrors(lookupFieldErrors.mobileNumber)} />

                  {lookupError && <p className="text-sm text-red-600">{lookupError}</p>}

                  {foundEmail && (
                    <div className="rounded-xl border border-green-200 bg-green-50/70 p-3 text-sm">
                      <p className="text-muted-foreground">Your registered email is</p>
                      <p className="mt-0.5 break-all font-semibold text-green-900">{foundEmail}</p>
                      <p className="mt-1.5 text-xs text-muted-foreground">Filled in above — send the reset link to continue.</p>
                    </div>
                  )}

                  {/* Registered with a mobile number only: there is no email to
                      recover, and the number itself is the password. */}
                  {mobileOnly && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-sm text-blue-900">
                      <p className="font-medium">No email on this account</p>
                      <p className="mt-1 text-xs leading-5">
                        You registered with a mobile number only — sign in using that number as both your
                        username and password. You can add an email later from your profile.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
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
