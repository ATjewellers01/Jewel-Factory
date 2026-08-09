'use client';

import { Loader2, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Required } from '@/components/ui/field-mark';
import { Input } from '@/components/ui/input';
import { apiSend } from '@/hooks/use-api';
import { fieldError, toFieldErrors } from '@/lib/field-error';

export default function KioskPinPage() {
  const [isSet, setIsSet] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<unknown>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/store/kiosk-pin', { cache: 'no-store' });
      if (res.status === 401) { window.location.assign('/store/login'); return; }
      const json = (await res.json()) as { data?: { isSet: boolean } };
      setIsSet(json.data?.isSet ?? false);
    })();
  }, []);

  async function savePin() {
    if (pin.length < 4) { setMsg('PIN must be at least 4 characters.'); return; }
    setBusy(true); setMsg(null); setSubmitErr(null);
    try {
      await apiSend('PUT', '/api/store/kiosk-pin', { pin });
      setIsSet(true); setPin(''); setMsg('Kiosk PIN saved. In-store devices will need it to unlock the kiosk.');
    } catch (err) { setMsg('Could not save PIN.'); setSubmitErr(err); } finally { setBusy(false); }
  }

  async function removePin() {
    if (!confirm('Remove the kiosk PIN? The kiosk will then be open to anyone with the URL.')) return;
    setBusy(true); setMsg(null);
    try {
      await apiSend('DELETE', '/api/store/kiosk-pin');
      setIsSet(false); setMsg('Kiosk PIN removed. Kiosk is now open.');
    } catch { setMsg('Could not remove PIN.'); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-5">
      <div className="flex items-center gap-2 text-primary">
        <Lock className="h-5 w-5" />
        <span className="text-xs font-semibold uppercase tracking-widest">Kiosk Security</span>
      </div>
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Kiosk Device PIN</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set a PIN so only your in-store device can open the customer kiosk. Staff enter it
          once (device stays unlocked 8 hours), then hand the device to customers. Owner and
          managers can both set or reset it.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-3">
        {isSet === null ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : (
          <>
            <p className="text-sm">
              Status:{' '}
              {isSet
                ? <span className="font-medium text-green-700">PIN is set — kiosk is protected.</span>
                : <span className="font-medium text-amber-700">No PIN — kiosk is open to anyone with the URL.</span>}
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">{isSet ? 'New PIN' : 'Set PIN'} (min 4)<Required /></label>
                <Input className="mt-1 max-w-[180px]" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="••••" />
                <FieldError errors={toFieldErrors(fieldError(submitErr, 'pin'))} />
              </div>
              <Button onClick={savePin} disabled={busy} className="metal-sheen text-[#17120b] font-semibold">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (isSet ? 'Update PIN' : 'Set PIN')}
              </Button>
              {isSet && (
                <Button onClick={removePin} disabled={busy} variant="outline" className="border-red-200 text-red-700 hover:bg-red-50">
                  Remove PIN
                </Button>
              )}
            </div>
            {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
          </>
        )}
      </div>
    </div>
  );
}
