import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ManufacturerLoginScreen } from '@/components/auth/ManufacturerLoginScreen';
import { MANUFACTURER_COOKIE, verifyManufacturerCookie } from '@/lib/auth';
import { getServerEnv } from '@/lib/env';

export const metadata: Metadata = { title: 'Manufacturer Sign In' };

export default async function ManufacturerEntryPage() {
  const env = getServerEnv();
  const token = (await cookies()).get(MANUFACTURER_COOKIE)?.value;
  const session = await verifyManufacturerCookie(token, {
    secret: env.MANUFACTURER_SECRET,
    ttlSeconds: env.COOKIE_TTL_SECONDS,
  });

  if (session.valid) redirect('/manufacturer/dashboard');

  return <ManufacturerLoginScreen />;
}
