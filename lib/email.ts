import nodemailer from 'nodemailer';

import { getServerEnv } from '@/lib/env';

/**
 * Send an email via SMTP. If SMTP is not configured, logs the message instead of
 * throwing — so dev flows (password reset) still work without a mail server.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  const env = getServerEnv();

  if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_USER || !env.SMTP_PASS) {
    console.warn('[email] SMTP not configured — email not sent. Preview:', {
      to: opts.to,
      subject: opts.subject,
      text: opts.text ?? opts.html,
    });
    return;
  }

  const port = Number(env.SMTP_PORT);
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS (secure:false)
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    // Force IPv4 — Render's network can't reach Gmail over IPv6 (ENETUNREACH on
    // the 2607:... address). family:4 makes DNS resolve to an IPv4 host.
    // (Cast: `family` is a valid runtime socket option not in nodemailer's TS type.)
    family: 4,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  } as nodemailer.TransportOptions);

  try {
    const info = await transporter.sendMail({
      from: env.FROM_EMAIL ? `"${env.FROM_NAME}" <${env.FROM_EMAIL}>` : env.SMTP_USER,
      to: opts.to,
      subject: opts.subject,
      text: opts.text ?? opts.html.replace(/<[^>]+>/g, ''),
      html: opts.html,
    });
    console.log(`[email] sent to ${opts.to} — messageId=${info.messageId}`);
  } catch (err) {
    // Surface the real reason in logs (Render "Logs" tab) instead of failing silently.
    console.error('[email] send FAILED:', err instanceof Error ? err.message : err);
    throw err;
  }
}

// ── Shared theme (matches the app's gold/ink jewellery branding) ──────────────

const GOLD = '#C29A33';
const GOLD_DARK = '#a8822a';
const INK = '#1F1A14';
const CREAM = '#FBF7EE';
const BORDER = '#e8dfc9';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/** Normalize deployment values, including accidentally quoted Docker env values. */
function normalizeAppUrl(appUrl: string): string {
  const normalized = appUrl.trim().replace(/^(['"])(.*)\1$/, '$2').replace(/\/+$/, '');
  return new URL(normalized).toString().replace(/\/$/, '');
}

export function buildAppUrl(appUrl: string, path: string): string {
  return new URL(path, `${normalizeAppUrl(appUrl)}/`).toString();
}

/**
 * Text-first lockup: email clients commonly hide remote images until the reader
 * opts in, so the brand and retailer must remain legible without downloaded media.
 */
function emailHeader(opts: { retailerName?: string; kicker?: string }): string {
  const hasRetailer = Boolean(opts.retailerName);
  const retailerName = escapeHtml(opts.retailerName ?? '');
  const kicker = opts.kicker ? escapeHtml(opts.kicker) : '';

  const lockup = hasRetailer
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr>
          <td style="padding:0 14px 0 0;color:#e9dcb8;font-family:Georgia,'Times New Roman',serif;font-size:13px;font-weight:700;letter-spacing:2px;white-space:nowrap;">
            JEWEL FACTORY
          </td>
          <td style="padding:0 14px;color:${BORDER};font-size:20px;font-weight:300;">×</td>
          <td style="padding:0 0 0 14px;color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-size:13px;font-weight:700;letter-spacing:1.5px;white-space:nowrap;">
            ${retailerName}
          </td>
        </tr>
      </table>`
    : `<p style="margin:0;color:#e9dcb8;font-family:Georgia,'Times New Roman',serif;font-size:15px;font-weight:700;letter-spacing:2.5px;">JEWEL FACTORY</p>`;

  return `
    <div style="background:${INK};padding:28px 24px 24px;text-align:center;border-radius:14px 14px 0 0;">
      ${lockup}
      ${kicker ? `<p style="margin:16px 0 0;color:#bfb395;font-size:10px;letter-spacing:2.2px;text-transform:uppercase;font-weight:600;">${kicker}</p>` : ''}
    </div>`;
}

function emailFooter(): string {
  return `
    <div style="padding:20px 28px 4px;text-align:center;">
      <p style="color:#b0a98f;font-size:11px;margin:0;letter-spacing:0.5px;">Powered by Jewel Factory</p>
    </div>`;
}

/** Wraps inner content in the shared card shell (rounded, cream background, gold accents). */
function emailShell(opts: {
  retailerName?: string;
  kicker?: string;
  body: string;
}): string {
  return `
    <div style="background:${CREAM};padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">
      <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${BORDER};box-shadow:0 2px 10px rgba(31,26,20,0.06);">
        ${emailHeader({ retailerName: opts.retailerName, kicker: opts.kicker })}
        <div style="padding:32px 28px 8px;font-family:system-ui,-apple-system,sans-serif;">
          ${opts.body}
        </div>
        ${emailFooter()}
      </div>
    </div>`;
}

/** Build the standard password-reset email HTML. */
export function passwordResetEmail(opts: {
  resetUrl: string;
  appUrl: string;
  retailerLogoUrl?: string | null;
  retailerName?: string;
}): { subject: string; html: string } {
  const resetUrl = escapeHtml(opts.resetUrl);
  const body = `
    <h2 style="color:${INK};font-family:Georgia,serif;font-size:22px;margin:0 0 12px;">Reset your password</h2>
    <p style="color:#5a5347;font-size:14px;line-height:1.6;margin:0 0 24px;">
      Click the button below to set a new password. This link expires in 1 hour.
    </p>
    <p style="margin:0 0 28px;text-align:center;">
      <a href="${resetUrl}" style="background:${GOLD};background:linear-gradient(135deg,${GOLD},${GOLD_DARK});color:#fff;padding:13px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block;letter-spacing:0.3px;">
        Reset Password
      </a>
    </p>
    <p style="color:#9a927e;font-size:12px;line-height:1.5;margin:0;border-top:1px solid ${BORDER};padding-top:16px;">
      If you didn't request this, you can safely ignore this email — your password will remain unchanged.
    </p>`;

  return {
    subject: 'Reset your Jewel Factory password',
    html: emailShell({
      retailerName: opts.retailerName,
      kicker: 'Account security',
      body,
    }),
  };
}

/**
 * Store-approval email — sent to the store OWNER when the manufacturer approves
 * their registration. We do NOT include passwords (they are bcrypt-hashed and
 * were chosen by the owner at registration). We include the login emails, the
 * portal URLs, and a password-reset link in case anyone forgot theirs.
 */
export function storeApprovedEmail(opts: {
  storeName: string;
  storeSlug: string;
  ownerEmail: string;
  managerEmails: string[];
  appUrl: string;
  retailerLogoUrl?: string | null;
}): { subject: string; html: string } {
  // managerEmails kept in the signature for callers, but the HO Manager role was
  // removed — the Retailer/owner logs in and does everything.
  const { appUrl } = opts;
  const safeStoreName = escapeHtml(opts.storeName);
  const ownerEmail = escapeHtml(opts.ownerEmail);
  const retailerLoginUrl = escapeHtml(buildAppUrl(appUrl, '/store/login'));
  const branchesUrl = escapeHtml(buildAppUrl(appUrl, '/store/branches'));
  const forgotPasswordUrl = escapeHtml(buildAppUrl(appUrl, '/store/forgot-password'));

  const body = `
    <h2 style="color:${INK};font-family:Georgia,serif;font-size:22px;margin:0 0 12px;">You're approved 🎉</h2>
    <p style="color:#5a5347;font-size:14px;line-height:1.6;margin:0 0 24px;">
      Good news — <strong style="color:${INK};">${safeStoreName}</strong> has been approved by the manufacturer.
      You now have full access to your Retailer (Head Office) portal.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:${CREAM};border-radius:10px;margin:0 0 24px;">
      <tr>
        <td style="padding:16px 18px;">
          <p style="margin:0 0 4px;color:#9a927e;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Retailer login</p>
          <p style="margin:0;color:${INK};font-size:14px;font-weight:600;">${ownerEmail}</p>
          <p style="margin:8px 0 0;color:#9a927e;font-size:12px;">Use the password you set during registration.</p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 24px;text-align:center;">
      <a href="${retailerLoginUrl}" style="background:linear-gradient(135deg,${GOLD},${GOLD_DARK});color:#fff;padding:13px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block;">
        Go to Retailer Portal
      </a>
    </p>

    <p style="color:#5a5347;font-size:13px;line-height:1.6;margin:0 0 8px;">
      Next, create your Stores and add their Store Managers from the Retailer portal.<br/>
      <a href="${branchesUrl}" style="color:${GOLD_DARK};font-weight:600;text-decoration:none;">Set up your Stores</a>
    </p>

    <p style="color:#9a927e;font-size:12px;line-height:1.5;margin:20px 0 0;border-top:1px solid ${BORDER};padding-top:16px;">
      Forgot your password? <a href="${forgotPasswordUrl}" style="color:${GOLD_DARK};">Reset it here</a>.
    </p>`;

  return {
    subject: `Your retailer account "${opts.storeName}" is approved — Jewel Factory`,
    html: emailShell({ retailerName: opts.storeName, kicker: 'Retailer approved', body }),
  };
}
