import { ArrowLeft, Gem, ShieldCheck, Sparkles, Building2, Factory, Store, Users, Search } from 'lucide-react';
import Link from 'next/link';

export const metadata = { title: 'About — Jewel Factory' };

const ROLES = [
  { icon: Factory, title: 'Manufacturer', desc: 'Owns the gold design catalog, approves retailers, and fulfils every order — without ever seeing a customer’s personal details.' },
  { icon: Store, title: 'Retailer (Head Office)', desc: 'A jewellery business that runs many stores. Approves all orders, manages branches & staff, and restocks from the manufacturer.' },
  { icon: Users, title: 'Store Manager', desc: 'Runs one store’s kiosk — helps walk-in customers browse, try on, and place orders that flow up for approval.' },
  { icon: Gem, title: 'Customer', desc: 'Walks into a store, browses the catalog and tries pieces on with AR. No login, and none of their personal data is stored.' },
];

const PRINCIPLES = [
  { icon: Gem, title: 'No price anywhere', desc: 'Gold rates change daily, so the platform never shows a price. The store quotes the customer directly.' },
  { icon: ShieldCheck, title: 'Customer privacy by design', desc: 'Orders carry only products + an editable requirement note. Customer name and phone never reach the manufacturer.' },
  { icon: Sparkles, title: 'AR try-on', desc: 'Every eligible design has a transparent asset so it can be tried on live at the store kiosk.' },
  { icon: Search, title: 'Similar-design search', desc: 'Upload a photo at the kiosk to instantly find matching designs in the catalog by visual similarity.' },
  { icon: Building2, title: 'One retailer, many stores', desc: 'Approvals, restock and custom orders are tracked across every branch, end to end.' },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-black/5 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-wordmark.png" alt="Jewel Factory" className="h-7 w-auto object-contain" />
          </Link>
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        {/* Intro */}
        <p className="text-xs font-semibold uppercase tracking-widest text-[#a0824a]">About</p>
        <h1 className="mt-3 font-display text-3xl font-normal tracking-tight sm:text-5xl">
          One platform for the whole gold-jewellery chain
        </h1>
        <p className="mt-5 max-w-2xl text-base text-muted-foreground">
          Jewel Factory is a B2B platform that connects a gold-jewellery
          manufacturer to its retailer network and their in-store customers.
          Instead of orders scattered across phone calls and WhatsApp, every
          catalog design, order, approval and custom request lives in one place —
          with full tracking, and strict rules that keep pricing and customer data
          exactly where they belong.
        </p>

        {/* Roles */}
        <section className="mt-14">
          <h2 className="font-display text-2xl font-normal tracking-tight">Who uses it</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {ROLES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl border bg-card p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How an order flows */}
        <section className="mt-14">
          <h2 className="font-display text-2xl font-normal tracking-tight">How an order flows</h2>
          <ol className="mt-6 space-y-3">
            {[
              'A customer browses the store kiosk; the Store Manager builds an order — products, quantity and a requirement note (no personal data).',
              'The Retailer (Head Office) reviews it, can edit the note, and approves.',
              'The approved order reaches the Manufacturer — showing the retailer and branch, never the customer.',
              'The Manufacturer ships to the retailer’s fixed Head Office address; the retailer distributes to the branch.',
              'The Store Manager tracks status, chats with Head Office on the order, and marks it Completed when the customer has the piece.',
            ].map((step, i) => (
              <li key={i} className="flex gap-3 rounded-xl border bg-card p-4">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{i + 1}</span>
                <p className="text-sm text-muted-foreground">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Principles */}
        <section className="mt-14">
          <h2 className="font-display text-2xl font-normal tracking-tight">What makes it different</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {PRINCIPLES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl border bg-card p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mt-16 rounded-2xl border bg-[#fbf9f5]/60 p-6 text-center sm:p-8">
          <h2 className="font-display text-2xl font-normal tracking-tight">Ready to join?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Register your jewellery business to browse the full gold catalog and start ordering.
          </p>
          <Link href="/store/register" className="metal-sheen mt-5 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-[#17120b]">
            Register here
          </Link>
        </section>
      </main>

      <footer className="border-t border-black/5 bg-[#fbf9f5]/60">
        <div className="mx-auto max-w-4xl px-4 py-8 text-center text-xs text-muted-foreground sm:px-6">
          Powered by Jewel Factory
        </div>
      </footer>
    </div>
  );
}
