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
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'mumbai@atplus.in';

export const SUPPORT_PHONE =
  process.env.NEXT_PUBLIC_SUPPORT_PHONE || '7000596858';

/** `tel:` href — strips spaces/dashes so the dialler gets clean digits. */
export const SUPPORT_PHONE_HREF = `tel:${SUPPORT_PHONE.replace(/[^\d+]/g, '')}`;

export const SUPPORT_EMAIL_HREF = `mailto:${SUPPORT_EMAIL}`;

/**
 * Registered company identity, shown on staff/admin-facing footers (landing,
 * Manufacturer, Retailer Admin, Store Manager) alongside "Powered by Jewel
 * Factory" — deliberately left off customer-facing kiosk surfaces, where only
 * the retailer's own identity should show.
 */
export const COMPANY_NAME = 'A T Plus Jewellers Pvt Ltd, Mumbai';
export const COMPANY_ADDRESS =
  '69/71, Panchshila Bldg., 3rd Floor, Office No.7, Dhanji Street, Zaveri Bazaar, Mumbai, 400003';
