'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Store, Factory, ArrowRight, Users } from 'lucide-react';

const CARDS = [
  {
    href: '/store/login',
    icon: Store,
    title: 'Store Owner Login',
    subtitle: 'Access your store portal & dashboard',
  },
  {
    href: '/store/manager/login',
    icon: Users,
    title: 'Store Manager Login',
    subtitle: 'Approve orders & custom design requests',
  },
  {
    href: '/manufacturer/login',
    icon: Factory,
    title: 'Manufacturer Login',
    subtitle: 'Admin panel — catalog, stores & orders',
  },
];

export default function PortalPage() {
  return (
    <div className="min-h-screen bg-[#0f0d0a] flex flex-col items-center justify-center px-4">
      <div className="mb-10 flex flex-col items-center gap-3">
        <Image
          src="/logo-wordmark.png"
          alt="Jewel Factory"
          width={160}
          height={32}
          className="h-8 w-auto object-contain brightness-0 invert opacity-80"
          priority
        />
        <p className="text-xs tracking-widest text-[#6b5e45] uppercase">Staff Portal</p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        {CARDS.map(({ href, icon: Icon, title, subtitle }) => (
          <Link key={href} href={href}>
            <div className="group flex items-center gap-4 rounded-2xl border border-[#2a2318] bg-[#1a1510] px-5 py-4 transition-all hover:border-[#c9a84c]/40 hover:bg-[#1f1a12] cursor-pointer">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#c9a84c]/10 text-[#c9a84c] transition-colors group-hover:bg-[#c9a84c]/20">
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#f0e6d0]">{title}</p>
                <p className="text-xs text-[#6b5e45] mt-0.5">{subtitle}</p>
              </div>
              <ArrowRight className="h-4 w-4 flex-shrink-0 text-[#4a3f2a] transition-colors group-hover:text-[#c9a84c]" />
            </div>
          </Link>
        ))}
      </div>

      <Link href="/">
        <p className="mt-10 text-xs text-[#3d3320] hover:text-[#6b5e45] transition-colors">
          ← Back to home
        </p>
      </Link>

      <p className="mt-6 text-[10px] text-[#2a2318] tracking-wider">Powered by Jewel Factory</p>
    </div>
  );
}
