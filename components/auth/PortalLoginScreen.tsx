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
import type { ReactNode } from 'react';

import { StaffLoginForm } from '@/components/auth/StaffLoginForm';
import { Wordmark } from '@/components/landing/Wordmark';
import { useDocumentIdentity } from '@/hooks/use-document-identity';

type PortalKind = 'retailer' | 'manager' | 'manufacturer' | 'retailer-registration';

const portalContent = {
  retailer: {
    eyebrow: 'Purchase manager workspace',
    title: 'Run every store from one clear workspace.',
    description: 'Manage approvals, branches, staff, branding, and orders without losing sight of the customer experience.',
    loginTitle: 'Purchase manager sign in',
    loginDescription: 'Access your head-office workspace and connected stores.',
    accessLabel: 'Purchase manager access',
    documentTitle: 'Purchase manager sign in',
    leftFooter: 'Secure, authorized access only',
    rightFooter: 'Your credentials are used only to access this protected workspace.',
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
    documentTitle: 'Store Manager sign in',
    leftFooter: 'Secure, authorized access only',
    rightFooter: 'Your credentials are used only to access this protected workspace.',
    icon: Users,
    features: [
      { icon: Search, text: 'Assist customers with visual discovery' },
      { icon: Gem, text: 'Launch the curated in-store catalog' },
      { icon: Boxes, text: 'Request and track store restocks' },
    ],
  },
  manufacturer: {
    eyebrow: 'Manufacturer workspace',
    title: 'Catalog control, purchase manager approvals, and fulfilment.',
    description: 'A private operational workspace for the Jewel Factory manufacturing team.',
    loginTitle: 'Manufacturer sign in',
    loginDescription: 'Use your Jewel Factory administrator credentials to continue.',
    accessLabel: 'Private access',
    documentTitle: 'Manufacturer sign in',
    leftFooter: 'Secure, authorized access only',
    rightFooter: 'Your credentials are used only to access this protected workspace.',
    icon: Factory,
    features: [
      { icon: Boxes, text: 'Manage the master jewellery catalog' },
      { icon: ClipboardCheck, text: 'Review purchase manager registrations' },
      { icon: Truck, text: 'Track production and fulfilment' },
    ],
  },
  'retailer-registration': {
    eyebrow: 'Purchase manager partnership',
    title: 'Join the Jewel Factory network.',
    description: 'Share your Head Office details and delivery address for review.',
    loginTitle: 'Start your application',
    loginDescription: 'Two short steps. Your progress stays here as you continue.',
    accessLabel: 'Purchase manager application',
    documentTitle: 'Purchase Manager Registration',
    leftFooter: 'Submitted securely for manufacturer review',
    rightFooter: 'Your application details remain private while the manufacturer reviews them.',
    icon: Store,
    features: [
      { icon: Building2, text: 'Share your business and delivery details' },
      { icon: ClipboardCheck, text: 'Submit once for manufacturer review' },
      { icon: Users, text: 'Sign in with your email and mobile number once approved' },
    ],
  },
} as const;

export function PortalLoginScreen({
  portal,
  loginPath,
  redirectTo,
  forgotHref,
  footerLinks = [],
  children,
  backHref = '/',
  backLabel = 'Back to Jewel Factory',
}: {
  portal: PortalKind;
  loginPath?: string;
  redirectTo?: string;
  forgotHref?: string;
  footerLinks?: Array<{ label: string; prompt?: string; href: string }>;
  children?: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  const content = portalContent[portal];
  const PortalIcon = content.icon;

  useDocumentIdentity(content.documentTitle);

  const panelContent = (
    <div className={`w-full ${children ? 'max-w-[640px]' : 'max-w-[440px]'}`}>
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
      <h2 className="mt-5 font-display text-[clamp(1.75rem,3.5vw,2.25rem)] font-medium leading-tight tracking-[-0.015em]">{content.loginTitle}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[#756c63]">{content.loginDescription}</p>

      {children ? (
        <div className="mt-6">{children}</div>
      ) : loginPath && redirectTo ? (
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
      ) : null}

      <p className="mt-6 flex items-start gap-2 text-xs leading-5 text-[#8a8178]">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#aa7d2b]" />
        {content.rightFooter}
      </p>
    </div>
  );

  return (
    <main className="relative h-dvh overflow-hidden bg-[#f4f0e8] px-3 py-3 text-[#28231e] sm:px-5 sm:py-5 lg:px-8 lg:py-7">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(206,166,72,0.18),transparent_30rem),radial-gradient(circle_at_90%_88%,rgba(128,99,49,0.08),transparent_28rem)]" />

      <div className="relative mx-auto grid h-[calc(100dvh-1.5rem)] w-full max-w-[1240px] overflow-hidden rounded-[26px] border border-[#ded6ca] bg-white shadow-[0_28px_90px_rgba(62,48,29,0.12)] sm:h-[calc(100dvh-2.5rem)] md:grid-cols-[0.88fr_1.12fr] lg:h-[calc(100dvh-3.5rem)]">
        <section className="relative hidden h-full min-h-0 flex-col justify-between overflow-hidden border-r border-[#ded6ca] bg-[#211c17] p-8 text-[#faf7f0] md:flex lg:p-12">
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
            <h1 className="mt-4 max-w-[20ch] font-display text-[clamp(1.75rem,2.8vw,2.85rem)] font-medium leading-[1.08] tracking-[-0.02em]">{content.title}</h1>
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
            <ShieldCheck className="h-4 w-4 text-[#d2aa4e]" /> {content.leftFooter}
          </p>
        </section>

        <section className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#fffdf9]">
          <div className="flex shrink-0 items-center justify-between border-b border-[#ebe5dc] px-5 py-4 md:justify-end md:px-8">
            <Wordmark href="/" size="sm" className="md:hidden" />
            <Link href={backHref} className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-xs font-medium text-[#71685f] transition-colors hover:bg-[#f4efe6] hover:text-[#29231e] sm:text-sm">
              <ArrowLeft className="h-4 w-4" /> <span className="hidden min-[360px]:inline">{backLabel}</span><span className="min-[360px]:hidden">Back</span>
            </Link>
          </div>

          {children ? (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
              <div className="flex min-h-full justify-center px-5 py-8 sm:px-9 sm:py-10 lg:px-16 lg:py-12">
                {panelContent}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center px-5 py-9 sm:px-9 sm:py-12 lg:px-16">
              {panelContent}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
