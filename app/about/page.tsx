import { Gem, ShieldCheck, Sparkles, Building2, Factory, Store, Users, Search, Award, Camera, ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { PublicFooter } from '@/components/landing/PublicFooter';
import { PublicNav } from '@/components/landing/PublicNav';

export const metadata = { title: 'About' };

const ROLES = [
  { icon: Factory, title: 'Manufacturer', desc: 'Owns the gold design catalogue, approves Retailer Admins, and fulfils every order — without ever seeing a customer’s personal details.' },
  { icon: Store, title: 'Retailer Admin (Head Office)', desc: 'A jewellery business that runs many stores. Approves all orders, manages branches & staff, and restocks from the manufacturer.' },
  { icon: Users, title: 'Retailer User', desc: 'Runs one store’s kiosk — helps walk-in customers browse, try on, and place orders that flow up for approval.' },
  { icon: Gem, title: 'Customer', desc: 'Walks into a store, browses the catalogue and tries pieces on with AR. No login, and none of their personal data is stored.' },
];

const PRINCIPLES = [
  { icon: Gem, title: 'No price anywhere', desc: 'Gold rates change daily, so the platform never shows a price. The store quotes the customer directly.' },
  { icon: ShieldCheck, title: 'Customer privacy by design', desc: 'Orders carry only products + an editable remark. Customer name and phone never reach the manufacturer.' },
  { icon: Sparkles, title: 'AR try-on', desc: 'Every eligible design has a transparent asset so it can be tried on live at the store kiosk.' },
  { icon: Search, title: 'Similar-design search', desc: 'Upload a photo at the kiosk to instantly find matching designs in the catalogue by visual similarity.' },
  { icon: Building2, title: 'One Retailer Admin, many stores', desc: 'Approvals, restock and custom orders are tracked across every branch, end to end.' },
];

const STEPS = [
  'A customer browses the store kiosk; the Retailer User builds an order — products, quantity and a remark (no personal data).',
  'The Retailer Admin (Head Office) reviews it, can edit the remark, and approves.',
  'The approved order reaches the Manufacturer — showing the Retailer Admin and branch, never the customer.',
  'The Manufacturer ships to the Retailer Admin’s fixed Head Office address; the Retailer Admin distributes to the branch.',
  'The Retailer User tracks status, chats with Head Office on the order, and marks it Completed when the customer has the piece.',
];

const TRUST = [
  { icon: ShieldCheck, label: 'BIS Hallmarked' },
  { icon: Award, label: 'Certified Jewellers' },
  { icon: Camera, label: 'Virtual Try-On' },
  { icon: Search, label: 'Similar-design search' },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      <PublicNav />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-black/5">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(56rem_36rem_at_12%_-10%,rgba(201,168,76,0.16),transparent_60%)]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/JF.avif" alt="" aria-hidden className="pointer-events-none absolute right-[-3%] top-[8%] -z-10 hidden w-[32rem] max-w-none opacity-[0.05] lg:block" />
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#a0824a]">About</p>
          <h1 className="mt-3 max-w-3xl font-display text-3xl font-normal leading-[1.08] tracking-tight text-balance sm:text-5xl">
            One platform for the whole gold-jewellery chain
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            Jewel Factory is a B2B platform that connects a gold-jewellery
            manufacturer to its purchase manager network and their in-store customers.
            Instead of orders scattered across phone calls and WhatsApp, every
            catalogue design, order, approval and custom request lives in one place —
            with full tracking, and strict rules that keep pricing and customer data
            exactly where they belong.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            {TRUST.map(({ icon: Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-1.5"><Icon className="h-3.5 w-3.5 text-[#b68a3e]" />{label}</span>
            ))}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
        {/* Roles */}
        <section>
          <h2 className="font-display text-2xl font-normal tracking-tight sm:text-3xl">Who uses it</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-4 text-sm font-semibold">{title}</p>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How an order flows */}
        <section className="mt-16">
          <h2 className="font-display text-2xl font-normal tracking-tight sm:text-3xl">How an order flows</h2>
          <ol className="mt-6 space-y-3">
            {STEPS.map((step, i) => (
              <li key={i} className="flex gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
                <span className="metal-sheen flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-[#17120b]">{i + 1}</span>
                <p className="self-center text-sm leading-6 text-muted-foreground">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Principles */}
        <section className="mt-16">
          <h2 className="font-display text-2xl font-normal tracking-tight sm:text-3xl">What makes it different</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PRINCIPLES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-4 text-sm font-semibold">{title}</p>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="relative mt-20 overflow-hidden rounded-3xl border bg-[#fbf9f5]/70 p-8 text-center sm:p-12">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(30rem_14rem_at_50%_-20%,rgba(201,168,76,0.18),transparent_70%)]" />
          <div className="relative">
            <h2 className="font-display text-2xl font-normal tracking-tight sm:text-3xl">Ready to join?</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Register your jewellery business to browse the full gold catalogue and start ordering.
            </p>
            <Link href="/store/register" className="metal-sheen mt-6 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-[#17120b] shadow-sm transition-transform hover:scale-[1.02]">
              Register here <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
