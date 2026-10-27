import { Loader2, Sparkles } from 'lucide-react';

/**
 * Premium "searching" state for the photo similar-design search, shown inside
 * the upload card (over the uploaded preview) so it's visible on every screen
 * size — the old bottom-of-page "Searching…" text fell below the fold on
 * phones, where the card fills the viewport. Gold scan line + pulsing rings +
 * spinner so a fast result still reads as "it searched", not "nothing happened".
 */
export function PhotoSearchOverlay({ preview }: { preview: string | null }) {
  return (
    <div className="flex flex-col items-center py-2">
      <div className="relative h-40 w-40 sm:h-44 sm:w-44">
        {/* Pulsing gold rings radiating out from the photo. */}
        <span aria-hidden className="absolute inset-0 rounded-[1.6rem] ring-2 ring-[#c9a84c]/50 animate-ping" />
        <span aria-hidden className="absolute -inset-3 rounded-[2rem] ring-1 ring-[#c9a84c]/25 animate-pulse" />
        <div className="relative h-full w-full overflow-hidden rounded-[1.6rem] border border-[#c9a84c]/50 shadow-[0_10px_30px_rgba(201,168,76,0.25)]">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- data: URI preview, next/image can't optimize it
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-[#f3ead6]" />
          )}
          {/* Dim + moving gold scan line sweeping over the photo. */}
          <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
          <span aria-hidden className="jf-scan-line absolute inset-x-0 h-[3px] bg-[#f0d079] shadow-[0_0_14px_3px_rgba(201,168,76,0.75)]" />
        </div>
      </div>

      <p className="mt-6 flex items-center gap-2 text-base font-semibold text-[#8a6a24]">
        <Loader2 className="h-4 w-4 animate-spin" /> Analysing your photo…
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-[#c9a84c]" /> Matching against the catalogue
      </p>
    </div>
  );
}
