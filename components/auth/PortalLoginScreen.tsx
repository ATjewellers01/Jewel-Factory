'use client';

import {
  ArrowLeft,
  Boxes,
  Building2,
  ClipboardCheck,
  Factory,
  Gem,
  Search,
  ShieldCheck,
  Store,
  Truck,
  Users,
} from 'lucide-react';
import Link from 'next/link';

import { StaffLoginForm } from '@/components/auth/StaffLoginForm';
import { Wordmark } from '@/components/landing/Wordmark';
import { useDocumentIdentity } from '@/hooks/use-document-identity';

type PortalKind = 'retailer' | 'manager' | 'manufacturer';

const portalContent = {
  retailer: {
    eyebrow: 'Retailer workspace',
    title: 'Run every store from one clear workspace.',
    description: 'Manage approvals, branches, staff, branding, and orders without losing sight of the customer experience.',
    loginTitle: 'Retailer sign in',
    loginDescription: 'Access your head-office workspace and connected stores.',
    accessLabel: 'Retailer access',
    icon: Store,
    features: [
      { icon: Building2, text: 'Keep branches and teams connected' },
      { icon: ClipboardCheck, text: 'Review requests and approvals' },
      { icon: Gem, text: 'Source from the manufacturer catalog' },
    ],
  },
  manager: {
    eyebrow: 'Store workspace',
    title: 'Everything your team needs on the shop floor.',
    description: 'Open the customer kiosk, find similar designs, manage try-ons, and place restock requests from one place.',
    loginTitle: 'Store Manager sign in',
    loginDescription: 'Use the account created for your assigned store.',
    accessLabel: 'Store team access',
    icon: Users,
    features: [
      { icon: Search, text: 'Assist customers with visual discovery' },
      { icon: Gem, text: 'Launch the curated in-store catalog' },
      { icon: Boxes, text: 'Request and track store restocks' },
    ],
  },
  manufacturer: {
    eyebrow: 'Manufacturer workspace',
    title: 'Catalog control, retailer approvals, and fulfilment.',
    description: 'A private operational workspace for the Jewel Factory manufacturing team.',
    loginTitle: 'Manufacturer sign in',
    loginDescription: 'Use your Jewel Factory administrator credentials to continue.',
    accessLabel: 'Private access',
    icon: Factory,
    features: [
      { icon: Boxes, text: 'Manage the master jewellery catalog' },
      { icon: ClipboardCheck, text: 'Review retailer registrations' },
      { icon: Truck, text: 'Track production and fulfilment' },
    ],
  },
} as const;

export function PortalLoginScreen({
  portal,
  loginPath,
  redirectTo,
  forgotHref,
  footerLinks = [],
}: {
  portal: PortalKind;
  loginPath: string;
  redirectTo: string;
  forgotHref?: string;
  footerLinks?: Array<{ label: string; prompt?: string; href: string }>;
}) {
  const content = portalContent[portal];
  const PortalIcon = content.icon;

  useDocumentIdentity(content.loginTitle);

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#f4f0e8] px-3 py-3 text-[#28231e] sm:px-5 sm:py-5 lg:px-8 lg:py-7">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(206,166,72,0.18),transparent_30rem),radial-gradient(circle_at_90%_88%,rgba(128,99,49,0.08),transparent_28rem)]" />

      <div className="relative mx-auto grid min-h-[calc(100dvh-1.5rem)] w-full max-w-[1240px] overflow-hidden rounded-[26px] border border-[#ded6ca] bg-white shadow-[0_28px_90px_rgba(62,48,29,0.12)] sm:min-h-[calc(100dvh-2.5rem)] md:grid-cols-[0.88fr_1.12fr] lg:min-h-[calc(100dvh-3.5rem)]">
        <section className="relative hidden min-h-full flex-col justify-between overflow-hidden border-r border-[#ded6ca] bg-[#211c17] p-8 text-[#faf7f0] md:flex lg:p-12">
          <div aria-hidden className="absolute -bottom-20 -right-20 h-80 w-80 rotate-12 border border-[#d0a84e]/15" />
          <div aria-hidden className="absolute -bottom-5 -right-5 h-52 w-52 rotate-12 border border-[#d0a84e]/15" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/JF.avif" alt="" aria-hidden className="pointer-events-none absolute -right-16 top-1/2 w-72 -translate-y-1/2 opacity-[0.045] lg:w-96" />

          <Wordmark href="/" size="md" tone="dark" className="relative z-10" />

          <div className="relative z-10 max-w-md py-12">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d4ad55]/30 bg-[#d1a541] text-[#201b16] shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
              <PortalIcon className="h-5 w-5" />
            </span>
            <p className="mt-7 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d9b764]">{content.eyebrow}</p>
            <h1 className="mt-4 max-w-[18ch] font-display text-[clamp(2rem,3.5vw,3.5rem)] font-medium leading-[1.05] tracking-[-0.025em]">{content.title}</h1>
            <p className="mt-5 max-w-[42ch] text-sm leading-6 text-[#c5bdb3]">{content.description}</p>

            <div className="mt-9 grid gap-4">
              {content.features.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-sm text-[#eee8df]">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-[#d7b456]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="relative z-10 flex items-center gap-2 text-xs text-[#aaa196]">
            <ShieldCheck className="h-4 w-4 text-[#d2aa4e]" /> Secure, authorized access only
          </p>
        </section>

        <section className="relative flex min-h-full flex-col bg-[#fffdf9]">
          <div className="flex items-center justify-between border-b border-[#ebe5dc] px-5 py-4 md:justify-end md:px-8">
            <Wordmark href="/" size="sm" className="md:hidden" />
            <Link href="/" className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-xs font-medium text-[#71685f] transition-colors hover:bg-[#f4efe6] hover:text-[#29231e] sm:text-sm">
              <ArrowLeft className="h-4 w-4" /> <span className="hidden min-[360px]:inline">Back to Jewel Factory</span><span className="min-[360px]:hidden">Home</span>
            </Link>
          </div>

          <div className="flex flex-1 items-center justify-center px-5 py-9 sm:px-9 sm:py-12 lg:px-16">
            <div className="w-full max-w-[440px]">
              <div className="mb-7 flex items-center gap-3 md:hidden">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#cfa33e] text-[#241e17]"><PortalIcon className="h-[18px] w-[18px]" /></span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a2782e]">{content.eyebrow}</p>
                  <p className="mt-0.5 text-xs text-[#81776d]">Secure workspace</p>
                </div>
              </div>

              <span className="inline-flex items-center gap-2 rounded-full border border-[#e4d7be] bg-[#fbf5e8] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-[#916a24]">
                <ShieldCheck className="h-3.5 w-3.5" /> {content.accessLabel}
              </span>
              <h2 className="mt-5 font-display text-[clamp(2rem,5vw,2.75rem)] font-medium leading-tight tracking-[-0.02em]">{content.loginTitle}</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-[#756c63]">{content.loginDescription}</p>

              <div className="mt-7 border-y border-[#e8e0d5] py-6 sm:py-7">
                <StaffLoginForm
                  bare
                  showLabels
                  title=""
                  subtitle=""
                  loginPath={loginPath}
                  redirectTo={redirectTo}
                  forgotHref={forgotHref}
                  footerLinks={footerLinks}
                />
              </div>

              <p className="mt-6 flex items-start gap-2 text-xs leading-5 text-[#8a8178]">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#aa7d2b]" />
                Your credentials are used only to access this protected workspace.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
