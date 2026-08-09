'use client';

import { Loader2, Save } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Optional } from '@/components/ui/field-mark';
import { Input } from '@/components/ui/input';
import { apiSend } from '@/hooks/use-api';
import { fieldError, toFieldErrors } from '@/lib/field-error';

type Store = {
  name: string; email: string | null; city: string | null; phone: string | null;
  addressStreet: string | null; addressCity: string | null; addressState: string | null;
  addressPincode: string | null; addressLandmark: string | null;
  ownerName: string | null; ownerPhone: string | null;
  logoUrl: string | null; tagline: string | null; websiteUrl: string | null;
};

export default function StoreProfilePage() {
  const [store, setStore] = useState<Store | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);
  const [profileErr, setProfileErr] = useState<unknown>(null);
  const [brandErr, setBrandErr] = useState<unknown>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/store/me', { cache: 'no-store' });
      if (res.status === 401) { window.location.assign('/store/login'); return; }
      const json = (await res.json()) as { data?: Store; error?: { message: string } };
      if (json.data) setStore(json.data); else setError(json.error?.message ?? 'Failed to load');
    })();
  }, []);

  function set(k: keyof Store, v: string) { setStore((s) => (s ? { ...s, [k]: v } : s)); }

  async function saveProfile() {
    if (!store) return;
    setSavingProfile(true); setSavedMsg(null); setProfileErr(null);
    try {
      await apiSend('PATCH', '/api/store/profile', {
        name: store.name, email: store.email ?? '', city: store.city, phone: store.phone,
        addressStreet: store.addressStreet, addressCity: store.addressCity, addressState: store.addressState,
        addressPincode: store.addressPincode, addressLandmark: store.addressLandmark,
        ownerName: store.ownerName, ownerPhone: store.ownerPhone,
      });
      setSavedMsg('Profile saved.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); setProfileErr(e); } finally { setSavingProfile(false); }
  }

  async function saveBranding() {
    if (!store) return;
    setSavingBrand(true); setSavedMsg(null); setBrandErr(null);
    try {
      await apiSend('PATCH', '/api/store/branding', { logoUrl: store.logoUrl, tagline: store.tagline, websiteUrl: store.websiteUrl });
      setSavedMsg('Branding saved.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); setBrandErr(e); } finally { setSavingBrand(false); }
  }

  if (error) return <div className="mx-auto max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  if (!store) return <div className="flex items-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <h1 className="text-2xl font-medium tracking-tight">Retailer Admin Profile</h1>
      {savedMsg && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">{savedMsg}</div>}

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Store & Owner</h2>
        <Field label="Store name" value={store.name} onChange={(v) => set('name', v)} error={fieldError(profileErr, 'name')} />
        <Field
          label="Email address"
          value={store.email ?? ''}
          onChange={(v) => set('email', v)}
          hint={store.email
            ? 'Used as your sign-in username.'
            : 'Optional — add one to sign in with your email instead of your mobile number.'}
          error={fieldError(profileErr, 'email')}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="City" value={store.city ?? ''} onChange={(v) => set('city', v)} error={fieldError(profileErr, 'city')} />
          <Field label="Store phone" value={store.phone ?? ''} onChange={(v) => set('phone', v)} error={fieldError(profileErr, 'phone')} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Person name" value={store.ownerName ?? ''} onChange={(v) => set('ownerName', v)} error={fieldError(profileErr, 'ownerName')} />
          <Field label="Mobile number" value={store.ownerPhone ?? ''} onChange={(v) => set('ownerPhone', v)} error={fieldError(profileErr, 'ownerPhone')} />
        </div>
        <h2 className="pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fixed Delivery Address (manufacturer ships here)</h2>
        <Field label="Street" value={store.addressStreet ?? ''} onChange={(v) => set('addressStreet', v)} error={fieldError(profileErr, 'addressStreet')} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="City" value={store.addressCity ?? ''} onChange={(v) => set('addressCity', v)} error={fieldError(profileErr, 'addressCity')} />
          <Field label="State" value={store.addressState ?? ''} onChange={(v) => set('addressState', v)} error={fieldError(profileErr, 'addressState')} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Pincode" value={store.addressPincode ?? ''} onChange={(v) => set('addressPincode', v)} error={fieldError(profileErr, 'addressPincode')} />
          <Field label="Landmark" value={store.addressLandmark ?? ''} onChange={(v) => set('addressLandmark', v)} error={fieldError(profileErr, 'addressLandmark')} />
        </div>
        <Button onClick={saveProfile} disabled={savingProfile} className="metal-sheen text-[#17120b] font-semibold">
          {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-1.5 h-4 w-4" />Save profile</>}
        </Button>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Branding (shown on kiosk)</h2>
        <Field label="Logo URL" value={store.logoUrl ?? ''} onChange={(v) => set('logoUrl', v)} error={fieldError(brandErr, 'logoUrl')} />
        <Field label="Tagline" value={store.tagline ?? ''} onChange={(v) => set('tagline', v)} error={fieldError(brandErr, 'tagline')} />
        <Field label="Website URL" value={store.websiteUrl ?? ''} onChange={(v) => set('websiteUrl', v)} error={fieldError(brandErr, 'websiteUrl')} />
        <Button onClick={saveBranding} disabled={savingBrand} className="metal-sheen text-[#17120b] font-semibold">
          {savingBrand ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-1.5 h-4 w-4" />Save branding</>}
        </Button>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, hint, error }: { label: string; value: string; onChange: (v: string) => void; hint?: string; error?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}<Optional /></label>
      <Input className="mt-1" value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{hint}</p>}
      <FieldError errors={toFieldErrors(error)} />
    </div>
  );
}
