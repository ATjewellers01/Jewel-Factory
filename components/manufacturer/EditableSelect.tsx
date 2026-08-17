'use client';

import { Loader2, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';

export type TaxonomyOption = { id: string; name: string };

/**
 * Manufacturer-editable dropdown — same "+ Add new… / inline remove" UX as
 * the Karigar-code picker (components/orders/KarigarAssignPanel.tsx), reused
 * here for the catalog taxonomy (Category, Sub-category 1, Sub-category 2,
 * Purity — all manufacturer-editable per 2026-08-17). A custom dropdown (not
 * a native <select>) so each row can carry an inline "×" remove button.
 *
 * `onAdd` calls the matching POST endpoint and returns the created option;
 * `onRemove` calls the matching DELETE endpoint. A 409 (in-use) surfaces as
 * an inline error rather than removing the row from the list.
 */
export function EditableSelect({
  label,
  placeholder,
  value,
  options,
  disabled,
  onPick,
  onAdd,
  onRemove,
}: {
  label: ReactNode;
  placeholder: string;
  value: string; // selected option id, or '' for none
  options: TaxonomyOption[];
  disabled?: boolean;
  onPick: (option: TaxonomyOption | null) => void;
  onAdd: (name: string) => Promise<TaxonomyOption>;
  onRemove: (option: TaxonomyOption) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setAdding(false);
        setError(null);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  function pick(option: TaxonomyOption) {
    onPick(option);
    setOpen(false);
  }

  async function confirmAdd() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const created = await onAdd(name);
      setAdding(false);
      setNewName('');
      pick(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add');
    } finally {
      setBusy(false);
    }
  }

  async function removeOption(option: TaxonomyOption, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Remove "${option.name}"?`)) return;
    setBusy(true);
    setError(null);
    try {
      const result = await onRemove(option);
      if (!result.ok) { setError(result.error ?? 'Could not remove'); return; }
      if (value === option.id) onPick(null);
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Could not remove');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1" ref={rootRef}>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className="mt-1 flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-sm disabled:opacity-50"
        >
          <span className={selected ? '' : 'text-muted-foreground'}>{selected ? selected.name : placeholder}</span>
          <span className="text-muted-foreground">▾</span>
        </button>

        {open && (
          <div className="absolute left-0 top-full z-20 mt-1 w-full min-w-56 rounded-md border bg-card shadow-lg">
            {adding ? (
              <div className="flex items-center gap-1.5 p-2">
                <input
                  autoFocus
                  type="text"
                  placeholder="New value"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void confirmAdd(); if (e.key === 'Escape') setAdding(false); }}
                  className="h-8 flex-1 rounded-md border border-input bg-white px-2 text-xs"
                />
                <Button type="button" size="sm" className="h-8 px-2 text-xs" disabled={busy || !newName.trim()} onClick={() => void confirmAdd()}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add'}
                </Button>
              </div>
            ) : (
              <>
                <div className="max-h-64 overflow-y-auto py-1">
                  {options.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">Nothing yet — add one below.</p>}
                  {options.map((o) => (
                    <div
                      key={o.id}
                      onClick={() => pick(o)}
                      className={`flex items-center justify-between gap-2 px-3 py-1.5 text-xs hover:bg-muted/50 cursor-pointer ${o.id === value ? 'bg-muted/40 font-medium' : ''}`}
                    >
                      <span className="truncate">{o.name}</span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={(e) => void removeOption(o, e)}
                        aria-label={`Remove ${o.name}`}
                        className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-red-100 hover:text-red-600 disabled:opacity-50"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="border-t py-1">
                  <button type="button" onClick={() => setAdding(true)} className="block w-full px-3 py-1.5 text-left text-xs text-primary hover:bg-muted/50">
                    + Add new…
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </div>
  );
}
