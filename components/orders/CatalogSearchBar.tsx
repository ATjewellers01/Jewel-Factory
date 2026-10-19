'use client';

import { Camera, Search, X } from 'lucide-react';
import Link from 'next/link';

import { Input } from '@/components/ui/input';

/** The catalogue's single search box: text search (design no., category,
 *  sub-categories, description) plus a camera shortcut to the photo-based
 *  similar-design search — one entry point instead of three separate ones. */
export function CatalogSearchBar({
  value,
  onChange,
  photoSearchHref,
  className = '',
  inputClassName = '',
}: {
  value: string;
  onChange: (value: string) => void;
  photoSearchHref: string;
  className?: string;
  inputClassName?: string;
}) {
  return (
    <div className={`relative w-full ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8d8174]" />
      <Input
        type="search"
        placeholder="Search design no., category, description…"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Search the catalogue"
        className={`pl-9 ${value ? 'pr-20' : 'pr-12'} [&::-webkit-search-cancel-button]:hidden ${inputClassName}`}
      />
      <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
        {value ? (
          <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="flex h-8 w-8 items-center justify-center rounded-md text-[#8d8174] hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        ) : null}
        <Link
          href={photoSearchHref}
          aria-label="Search similar designs by photo"
          title="Search similar designs by photo"
          className="flex h-8 w-8 items-center justify-center rounded-md bg-[#c9a84c]/15 text-[#8a6a2e] transition hover:bg-[#c9a84c]/30 active:scale-95"
        >
          <Camera className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
