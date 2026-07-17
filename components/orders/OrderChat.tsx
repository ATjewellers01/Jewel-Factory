'use client';

import { Loader2, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Msg = { id: string; sender: 'HO' | 'STORE_MANAGER'; senderName: string | null; body: string; createdAt: string };

/**
 * Per-order chat between HO Manager and Store Manager. Reused on both sides.
 * `basePath` is the API base for messages, e.g.
 *   /api/branch-manager/messages   (Store Manager)
 *   /api/store/messages            (HO Manager)
 * The component appends `/{kind}/{orderId}`.
 */
export function OrderChat({
  basePath,
  kind,
  orderId,
  orderLabel,
  viewer,
  onClose,
}: {
  basePath: string;
  kind: 'kiosk' | 'b2b' | 'custom';
  orderId: string;
  orderLabel: string;
  viewer: 'HO' | 'STORE_MANAGER';
  onClose: () => void;
}) {
  const url = `${basePath}/${kind}/${orderId}`;
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const res = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
      const json = (await res.json()) as { data?: Msg[] };
      setMsgs(json.data ?? []);
    } catch { setMsgs([]); }
  }
  useEffect(() => { void load(); }, [url]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      const res = await fetch(url, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text.trim() }),
      });
      const json = (await res.json()) as { data?: Msg };
      if (json.data) { setMsgs((m) => [...(m ?? []), json.data!]); setText(''); }
    } catch { /* ignore */ } finally { setSending(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-card shadow-xl sm:h-[70vh] sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Messages</p>
            <p className="text-xs text-muted-foreground">{orderLabel} · HO ↔ Store Manager</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto bg-muted/10 px-4 py-3">
          {!msgs && <div className="flex items-center gap-2 py-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
          {msgs && msgs.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No messages yet. Start the conversation.</p>}
          {msgs?.map((m) => {
            const mine = m.sender === viewer;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-primary text-primary-foreground' : 'bg-card ring-1 ring-black/5'}`}>
                  {!mine && <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider opacity-70">{m.senderName ?? (m.sender === 'HO' ? 'Head Office' : 'Store Manager')}</p>}
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className={`mt-0.5 text-[10px] ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{new Date(m.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        <form onSubmit={send} className="flex items-center gap-2 border-t p-3">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" className="flex-1" />
          <Button type="submit" disabled={sending || !text.trim()} className="metal-sheen text-[#17120b] font-semibold">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
