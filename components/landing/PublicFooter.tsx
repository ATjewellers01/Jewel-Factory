'use client';

import { Award, Building2, Camera, Factory, Mail, Phone, Search, ShieldCheck, Sparkles, Store } from 'lucide-react';
import Link from 'next/link';

import { Wordmark } from '@/components/landing/Wordmark';
import { SUPPORT_EMAIL, SUPPORT_EMAIL_HREF, SUPPORT_PHONE, SUPPORT_PHONE_HREF } from '@/lib/support';

const TRUST = [
  { icon: ShieldCheck, label: 'BIS Hallmarked' },
  { icon: Award, label: 'Certified Jewellers' },
  { icon: Camera, label: 'Virtual Try-On' },
  { icon: Search, label: 'Similar-design search' },
];

/**
 * Shared Jewel Factory (platform) footer — used on every public/platform page
 * (landing, about, 404) so branding stays consistent. Store/retailer surfaces
 * (kiosk, dashboards) have their OWN footer with their own identity instead.
 *
 * `onLogin` (optional) opens the login popup where one is available; otherwise
 * the Login link points at the retailer login page.
 */
export function PublicFooter({ onLogin }: { onLogin?: () => void }) {
  return (
    <footer className="border-t border-white/10 bg-[#191511] text-white/70">
      {/* Trust strip */}
      <div className="grid grid-cols-2 border-b border-white/10 md:grid-cols-4">
        {TRUST.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-3 border-white/10 px-4 py-5 md:border-r md:last:border-r-0 sm:px-6 lg:px-10">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.07]"><Icon className="h-4 w-4 text-[#c9a84c]" /></span>
            <span className="text-xs font-medium text-white/65 sm:text-sm">{label}</span>
          </div>
        ))}
      </div>
      {/* Columns */}
      <div className="mx-auto grid max-w-[1400px] gap-10 px-5 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.1fr] lg:px-10 xl:px-12">
        <div>
          <Wordmark href="/" size="md" tone="dark" />
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/55">
            One connected jewellery network for manufacturers, purchase managers, their branches,
            and assisted in-store discovery.
          </p>
        </div>
        <div>
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Discover</p>
          <ul className="space-y-2.5 text-sm text-white/70">
            <li><Link href="/#showcase" className="transition-colors hover:text-white">Catalog showcase</Link></li>
            <li><Link href="/about" className="transition-colors hover:text-white">How it works</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">For Retailer Admins</p>
          <ul className="space-y-2.5 text-sm text-white/70">
            <li><Link href="/store/register" className="inline-flex items-center gap-2 transition-colors hover:text-white"><Building2 className="h-3.5 w-3.5 text-[#c9a84c]" /> Join the network</Link></li>
            <li><Link href="/store/login" className="inline-flex items-center gap-2 transition-colors hover:text-white"><Store className="h-3.5 w-3.5 text-[#c9a84c]" /> Retailer Admin portal</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Access</p>
          <ul className="space-y-2.5 text-sm text-white/70">
            <li>
              {onLogin ? (
                <button onClick={onLogin} className="transition-colors hover:text-white">Staff login</button>
              ) : (
                <Link href="/store/login" className="transition-colors hover:text-white">Staff login</Link>
              )}
            </li>
            <li><Link href="/about" className="transition-colors hover:text-white">Platform overview</Link></li>
            <li><Link href="/manufacturer" className="inline-flex items-center gap-2 transition-colors hover:text-white"><Factory className="h-3.5 w-3.5 text-[#c9a84c]" /> Manufacturer access</Link></li>
          </ul>
        </div>
        {/* Support — break-all on the email so a long address can't overflow the
            column on narrow screens. */}
        <div>
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Facing an issue?</p>
          <ul className="space-y-2.5 text-sm text-white/70">
            <li>
              <a href={SUPPORT_EMAIL_HREF} className="inline-flex items-start gap-2 transition-colors hover:text-white">
                <Mail className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#c9a84c]" />
                <span className="break-all">{SUPPORT_EMAIL}</span>
              </a>
            </li>
            <li>
              <a href={SUPPORT_PHONE_HREF} className="inline-flex items-center gap-2 transition-colors hover:text-white">
                <Phone className="h-3.5 w-3.5 flex-shrink-0 text-[#c9a84c]" />
                <span>{SUPPORT_PHONE}</span>
              </a>
            </li>
          </ul>
        </div>
      </div>
      {/* Bottom bar */}
      <div className="border-t border-white/10 px-5 py-5 sm:px-6 lg:px-10 xl:px-12">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-3 text-[10px] text-white/35 sm:flex-row">
          <span>© {new Date().getFullYear()} Jewel Factory. All rights reserved.</span>
          <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-[#c9a84c]" /> Powered by Jewel Factory</span>
        </div>
      </div>
    </footer>
  );
}
