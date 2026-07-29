'use client';

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Loader2,
  LockKeyhole,
  MapPin,
  Store,
  Upload,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { PortalLoginScreen } from '@/components/auth/PortalLoginScreen';
import { Wordmark } from '@/components/landing/Wordmark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface FormState {
  name: string;
  personName: string;
  mobileNumber: string;
  email: string;
  logoUrl: string;
  addressPincode: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressLandmark: string;
}

const INITIAL: FormState = {
  name: '', personName: '', mobileNumber: '', email: '', logoUrl: '',
  addressPincode: '', addressStreet: '', addressCity: '', addressState: '', addressLandmark: '',
};

const STEPS = [
  { number: 1, label: 'Business', icon: Store },
  { number: 2, label: 'Address', icon: MapPin },
] as const;

type Step = 1 | 2;

// name: letters + spaces only. mobile: exactly 10 digits. business name: letters,
// numbers, spaces and common punctuation (no validator too strict to reject real names).
const NAME_RE = /^[A-Za-z ]{2,}$/;
const MOBILE_RE = /^[6-9]\d{9}$/;
const BUSINESS_NAME_RE = /^[A-Za-z0-9 &.,'-]{2,}$/;

const fieldClass = 'h-12 rounded-xl border-[#ded5ca] bg-white/85 px-4 text-sm font-normal normal-case tracking-normal text-[#2b2119] shadow-none transition-[border-color,box-shadow,background] placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-[#aaa095] focus-visible:border-[#b98a35] focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-[#c9a84c]/15';
const labelClass = 'grid gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#756b62]';

export default function StoreRegisterPage() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoMode, setLogoMode] = useState<'upload' | 'url'>('upload');
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const [success, setSuccess] = useState(false);
  const [pincodeLookup, setPincodeLookup] = useState<'idle' | 'loading' | 'found' | 'not-found'>('idle');

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  // Auto-fill city/state from the PIN code (India Post API) once 6 digits are entered.
  useEffect(() => {
    const pin = form.addressPincode.trim();
    if (!/^\d{6}$/.test(pin)) { setPincodeLookup('idle'); return; }
    let cancelled = false;
    setPincodeLookup('loading');
    (async () => {
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
        const json = (await res.json()) as Array<{ Status: string; PostOffice: Array<{ District: string; State: string }> | null }>;
        if (cancelled) return;
        const po = json[0]?.PostOffice?.[0];
        if (json[0]?.Status === 'Success' && po) {
          setForm((prev) => ({ ...prev, addressCity: po.District, addressState: po.State }));
          setPincodeLookup('found');
        } else {
          setPincodeLookup('not-found');
        }
      } catch {
        if (!cancelled) setPincodeLookup('not-found');
      }
    })();
    return () => { cancelled = true; };
  }, [form.addressPincode]);

  /**
   * Upload the logo straight to S3 via a presigned PUT. The sign route is public
   * because registration runs before any Store row exists, so there is no session
   * to authenticate against yet.
   */
  async function handleLogoUpload(file: File) {
    setLogoError(null);
    setLogoUploading(true);
    try {
      const signRes = await fetch('/api/store/register/logo-sign', { method: 'POST' });
      const signJson = (await signRes.json()) as {
        data?: { uploadUrl: string; secureUrl: string; maxBytes: number; allowedFormats: string[] };
        error?: { message: string };
      };
      if (!signRes.ok || !signJson.data) {
        setLogoError(signJson.error?.message ?? 'Logo upload is unavailable right now.');
        return;
      }
      const signed = signJson.data;

      if (file.size > signed.maxBytes) {
        setLogoError(`Logo is too large (max ${Math.round(signed.maxBytes / 1024 / 1024)}MB).`);
        return;
      }
      const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (extension && !signed.allowedFormats.includes(extension)) {
        setLogoError(`Use one of: ${signed.allowedFormats.join(', ')}.`);
        return;
      }

      const upload = await fetch(signed.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!upload.ok) {
        setLogoError(`Logo upload failed (${upload.status}).`);
        return;
      }
      setForm((prev) => ({ ...prev, logoUrl: signed.secureUrl }));
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Logo upload failed.');
    } finally {
      setLogoUploading(false);
    }
  }

  function validate(target: Step): string | null {
    if (target === 1) {
      if (!form.name.trim() || !form.personName.trim() || !form.mobileNumber.trim() || !form.email.trim()) {
        return 'Complete all required business details to continue.';
      }
      if (!BUSINESS_NAME_RE.test(form.name.trim())) return 'Business name can only contain letters, numbers, spaces and & . , \' -';
      if (!NAME_RE.test(form.personName.trim())) return 'Person name can only contain letters and spaces.';
      if (!MOBILE_RE.test(form.mobileNumber.trim())) return 'Enter a valid 10-digit mobile number.';
      if (!/^\S+@\S+\.\S+$/.test(form.email)) return 'Enter a valid business email address.';
    }
    if (target === 2 && (!form.addressPincode.trim() || !form.addressStreet.trim() || !form.addressCity.trim() || !form.addressState.trim())) {
      return 'Complete the fixed delivery address to continue.';
    }
    if (target === 2 && !/^\d{6}$/.test(form.addressPincode.trim())) {
      return 'Enter a valid 6-digit PIN code.';
    }
    return null;
  }

  function nextStep() {
    const message = validate(step);
    if (message) return setError(message);
    setError(null);
    setStep((current) => Math.min(2, current + 1) as Step);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (step < 2) return nextStep();
    for (const target of [1, 2] as const) {
      const message = validate(target);
      if (message) {
        setStep(target);
        return setError(message);
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/store/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.status === 409) return setError('Email already registered.');
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        return setError(json?.error?.message ?? 'Registration failed. Please try again.');
      }
      setSuccess(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#f4f0e8] px-3 py-3 text-[#28231e] sm:px-5 sm:py-5">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(206,166,72,0.18),transparent_30rem)]" />
        <div className="relative w-full max-w-xl rounded-[26px] border border-[#ded6ca] bg-[#fffdf9] px-6 py-10 text-center shadow-[0_28px_90px_rgba(62,48,29,0.12)] sm:px-10 sm:py-12">
          <Wordmark href="/" size="sm" className="mx-auto justify-center" />
          <div className="mt-9 space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100 text-green-700">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h2 className="font-display text-[1.75rem] font-medium tracking-tight">Registration submitted</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              You will receive access after the manufacturer reviews and approves your store.
            </p>
            <Link href="/store/login" className="metal-sheen mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-[#17120b]">
              Back to sign in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <PortalLoginScreen
      portal="retailer-registration"
      backHref="/store/login"
      backLabel="Back to sign in"
    >
      <form onSubmit={submit} className="relative w-full">
            <div className="flex justify-end border-b border-[#ded6cb] pb-4">
              <span className="inline-flex items-center gap-1.5 text-xs text-[#8a8178]"><Clock3 className="h-3.5 w-3.5 text-[#ad8438]" /> About 3 minutes</span>
            </div>

            <nav className="my-5 grid grid-cols-2" aria-label="Application progress">
              {STEPS.map(({ number, label, icon: Icon }, index) => {
                const complete = step > number;
                const active = step === number;
                return (
                  <div key={number} className="relative flex flex-col items-center gap-2 text-center">
                    {index > 0 && <span aria-hidden className={`absolute right-1/2 top-4 h-px w-full transition-colors ${step >= number ? 'bg-[#b88c3e]' : 'bg-[#d9d1c6]'}`} />}
                    <button
                      type="button"
                      onClick={() => complete && setStep(number)}
                      disabled={!complete}
                      aria-current={active ? 'step' : undefined}
                      className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border text-xs transition-all ${complete ? 'border-[#b88c3e] bg-[#b88c3e] text-white' : active ? 'border-[#2b2119] bg-[#2b2119] text-white shadow-[0_0_0_4px_rgba(43,33,25,0.08)]' : 'border-[#d3cabe] bg-[#f8f5ef] text-[#9d948a]'}`}
                    >
                      {complete ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                    </button>
                    <span className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${active ? 'text-[#2b2119]' : 'text-[#9a9187]'}`}>{label}</span>
                  </div>
                );
              })}
            </nav>

            <section key={step} className="animate-in fade-in slide-in-from-bottom-2 border-y border-[#e0d8ce] py-6 duration-300 sm:py-7">
              {step === 1 && (
                <fieldset className="space-y-5">
                  <legend className="font-display text-[1.35rem] tracking-tight">Tell us about your business</legend>
                  <p className="-mt-3 text-sm leading-6 text-[#7b7269]">Use the Head Office details you want associated with every branch.</p>
                  <label className={labelClass}>Business name <Input autoFocus autoComplete="organization" placeholder="e.g. Mehta Jewellers" value={form.name} onChange={set('name')} className={fieldClass} /></label>
                  <div className="grid gap-5 lg:grid-cols-2">
                    <label className={labelClass}>Person name <Input autoComplete="name" placeholder="Full name" value={form.personName} onChange={set('personName')} className={fieldClass} /></label>
                    <label className={labelClass}>Mobile number <Input type="tel" autoComplete="tel" inputMode="numeric" maxLength={10} placeholder="10-digit mobile number" value={form.mobileNumber} onChange={set('mobileNumber')} className={fieldClass} /></label>
                  </div>
                  <label className={labelClass}>Business email <Input type="email" autoComplete="email" inputMode="email" placeholder="Used to sign in" value={form.email} onChange={set('email')} className={fieldClass} /></label>
                  <p className="flex items-center gap-2 rounded-xl bg-[#f4f0e8] px-4 py-3 text-xs leading-5 text-[#746b62]"><LockKeyhole className="h-4 w-4 shrink-0 text-[#a77d31]" /> No password to set — after approval, sign in with this email and mobile number.</p>
                  <div className={labelClass}>
                    <span className="flex items-center justify-between">
                      Store logo <span className="font-normal normal-case tracking-normal text-[#a39a91]">Optional</span>
                    </span>

                    <div className="flex gap-1 text-[11px] font-semibold normal-case tracking-normal">
                      {/* Switching mode clears the other mode's value so an uploaded
                          URL can't linger while the user is typing one, or vice-versa. */}
                      <button type="button" onClick={() => { setLogoMode('upload'); setLogoError(null); setForm((prev) => ({ ...prev, logoUrl: '' })); }}
                        className={`rounded-full px-3 py-1 transition-colors ${logoMode === 'upload' ? 'bg-[#2b2119] text-white' : 'text-[#8d8379] hover:bg-[#f2ede5]'}`}>
                        Upload
                      </button>
                      <button type="button" onClick={() => { setLogoMode('url'); setLogoError(null); setForm((prev) => ({ ...prev, logoUrl: '' })); }}
                        className={`rounded-full px-3 py-1 transition-colors ${logoMode === 'url' ? 'bg-[#2b2119] text-white' : 'text-[#8d8379] hover:bg-[#f2ede5]'}`}>
                        Use a URL
                      </button>
                    </div>

                    {form.logoUrl && logoMode === 'upload' ? (
                      <div className="relative inline-block w-fit">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={form.logoUrl} alt="Store logo" className="h-24 w-24 rounded-xl border border-[#ded5ca] bg-white object-contain p-1.5" />
                        <button type="button" onClick={() => setForm((prev) => ({ ...prev, logoUrl: '' }))}
                          className="absolute -right-2 -top-2 rounded-full bg-black/70 p-1 text-white transition-colors hover:bg-black" aria-label="Remove logo">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : logoMode === 'upload' ? (
                      <>
                        <button type="button" onClick={() => logoInput.current?.click()} disabled={logoUploading}
                          className="flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[#ded5ca] bg-white/60 font-normal normal-case tracking-normal text-[#8d8379] transition-colors hover:border-[#b98a35] hover:text-[#b98a35] disabled:opacity-60 sm:w-48">
                          {logoUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                          <span className="text-xs">{logoUploading ? 'Uploading…' : 'Choose an image'}</span>
                        </button>
                        <input ref={logoInput} type="file" accept="image/*" hidden
                          onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleLogoUpload(file); e.target.value = ''; }} />
                      </>
                    ) : (
                      <Input type="url" inputMode="url" placeholder="https://…" value={form.logoUrl} onChange={set('logoUrl')} className={fieldClass} />
                    )}

                    {logoError ? <span className="font-normal normal-case tracking-normal text-[11px] text-red-600">{logoError}</span> : null}
                  </div>
                </fieldset>
              )}

              {step === 2 && (
                <fieldset className="space-y-5">
                  <legend className="font-display text-[1.35rem] tracking-tight">Where should orders arrive?</legend>
                  <p className="-mt-3 text-sm leading-6 text-[#7b7269]">Approved orders are shipped to this fixed Head Office address.</p>
                  <label className={labelClass}>
                    <span className="flex items-center justify-between">
                      Pincode
                      {pincodeLookup === 'loading' && <span className="inline-flex items-center gap-1 font-normal normal-case tracking-normal text-[#a39a91]"><Loader2 className="h-3 w-3 animate-spin" />Looking up…</span>}
                      {pincodeLookup === 'not-found' && <span className="font-normal normal-case tracking-normal text-red-600">PIN not found — enter city/state manually</span>}
                    </span>
                    <Input autoFocus autoComplete="postal-code" inputMode="numeric" maxLength={6} placeholder="6-digit PIN code" value={form.addressPincode} onChange={set('addressPincode')} className={fieldClass} />
                  </label>
                  <div className="grid gap-5 lg:grid-cols-2">
                    <label className={labelClass}>City <Input autoComplete="address-level2" placeholder="City" value={form.addressCity} onChange={set('addressCity')} className={fieldClass} /></label>
                    <label className={labelClass}>State <Input autoComplete="address-level1" placeholder="State" value={form.addressState} onChange={set('addressState')} className={fieldClass} /></label>
                  </div>
                  <label className={labelClass}>Street address <Input autoComplete="street-address" placeholder="Building, street and area" value={form.addressStreet} onChange={set('addressStreet')} className={fieldClass} /></label>
                  <label className={labelClass}><span className="flex items-center justify-between">Landmark <span className="font-normal normal-case tracking-normal text-[#a39a91]">Optional</span></span><Input placeholder="Nearby landmark" value={form.addressLandmark} onChange={set('addressLandmark')} className={fieldClass} /></label>
                </fieldset>
              )}
            </section>

            {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

            <div className="mt-5 flex items-center gap-3">
              {step > 1 && (
                <Button type="button" variant="outline" onClick={() => { setError(null); setStep((current) => (current - 1) as Step); }} className="h-12 rounded-xl border-[#d6cdbf] bg-transparent px-5 text-[#655b51] shadow-none hover:bg-white">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
              )}
              {step < 2 ? (
                <Button key="continue" type="button" onClick={nextStep} className="metal-sheen h-12 flex-1 rounded-xl border-0 font-semibold text-[#17120b] shadow-[0_10px_25px_rgba(166,119,45,0.18)] transition-transform hover:-translate-y-0.5">
                  Continue <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button key="submit" type="submit" className="metal-sheen h-12 flex-1 rounded-xl border-0 font-semibold text-[#17120b] shadow-[0_10px_25px_rgba(166,119,45,0.18)] transition-transform hover:-translate-y-0.5" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Submit application <ArrowRight className="h-4 w-4" /></>}
                </Button>
              )}
            </div>

            <p className="mt-6 text-center text-sm text-[#81776e]">
              Already approved?{' '}
              <Link href="/store/login" className="font-semibold text-[#8a6426] underline decoration-[#c9a84c]/45 underline-offset-4 hover:text-[#5f4319]">Sign in</Link>
            </p>
          </form>
    </PortalLoginScreen>
  );
}
