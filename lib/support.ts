/**
 * Public support contact, shown on the site footer and in outgoing emails so a
 * user always has a way to report a problem.
 *
 * These are deliberately plain constants rather than server-only env vars: the
 * footer is a client component, and these values are public contact details
 * meant to be visible to everyone. `NEXT_PUBLIC_SUPPORT_*` overrides let a
 * deployment change them without a code edit.
 */
export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'Jforder1957@gmail.com';

export const SUPPORT_PHONE =
  process.env.NEXT_PUBLIC_SUPPORT_PHONE || '7000596858';

/** `tel:` href — strips spaces/dashes so the dialler gets clean digits. */
export const SUPPORT_PHONE_HREF = `tel:${SUPPORT_PHONE.replace(/[^\d+]/g, '')}`;

export const SUPPORT_EMAIL_HREF = `mailto:${SUPPORT_EMAIL}`;
