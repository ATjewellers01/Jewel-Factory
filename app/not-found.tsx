import { ArrowRight, Home, Search } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { PublicFooter } from '@/components/landing/PublicFooter';
import { PublicNav } from '@/components/landing/PublicNav';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />

      <main className="relative flex flex-1 items-center overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(56rem_36rem_at_50%_-10%,rgba(201,168,76,0.16),transparent_60%)]" />
        <Image src="/JF.avif" alt="" aria-hidden width={544} height={544} className="pointer-events-none absolute right-[-6%] top-1/2 -z-10 hidden w-[34rem] max-w-none -translate-y-1/2 opacity-[0.05] lg:block" />

        <div className="mx-auto w-full max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <p className="font-display text-7xl font-normal tracking-tight text-[#c9a84c] sm:text-8xl">404</p>
          <h1 className="mt-4 font-display text-3xl font-normal tracking-tight sm:text-4xl">
            This page could not be found
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-muted-foreground">
            The link may be broken or the page may have moved. Let’s get you back to
            the collection.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/" className="metal-sheen inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-[#17120b] shadow-sm transition-transform hover:scale-[1.02]">
              <Home className="h-4 w-4" /> Back to home
            </Link>
            <Link href="/#showcase" className="inline-flex items-center gap-2 rounded-full border border-primary/40 px-6 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/5">
              <Search className="h-4 w-4" /> Browse the collection
            </Link>
          </div>
          <div className="mt-8">
            <Link href="/about" className="luxury-link-underline inline-flex items-center gap-1 text-sm font-medium text-primary">
              Learn how Jewel Factory works <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
