import Image from 'next/image';
import Link from 'next/link';

/**
 * The Jewel Factory brand lockup: the gold JF monogram (public/JF.avif) + the
 * "JEWEL FACTORY" text wordmark. Single source of truth — used in the landing
 * header/footer, about, register and the login popup so branding never drifts.
 *
 * `tone`:
 *  - 'light' (default) — on light/cream surfaces: "JEWEL" gold + "FACTORY" ink
 *    (gold-and-black), for contrast.
 *  - 'dark'  — on dark surfaces (footer/hero): "JEWEL" gold + "FACTORY" white —
 *    the same two-tone as light, but the ink half becomes light so it stays legible.
 */
export function Wordmark({
  href = '/',
  size = 'md',
  tone = 'light',
  className = '',
}: {
  href?: string | null;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const mark = size === 'lg' ? 'h-10 w-10' : size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  const markPx = size === 'lg' ? 40 : size === 'sm' ? 28 : 32;
  const text = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-lg sm:text-xl';
  const factory = tone === 'dark' ? 'text-white' : 'text-foreground';

  const inner = (
    <span className={`flex items-center gap-1.5 ${className}`}>
      <Image src="/JF.avif" alt="Jewel Factory" width={markPx} height={markPx} className={`${mark} object-contain`} />
      <span className={`font-display font-medium uppercase tracking-[0.12em] ${text}`}>
        <span className="text-[#c9a84c]">Jewel</span> <span className={factory}>Factory</span>
      </span>
    </span>
  );

  if (href === null) return inner;
  return (
    <Link href={href} aria-label="Jewel Factory — home">
      {inner}
    </Link>
  );
}
