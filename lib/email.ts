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

/** Build the standard password-reset email HTML. */
export function passwordResetEmail(resetUrl: string): { subject: string; html: string } {
  return {
    subject: 'Reset your Jewel Factory password',
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color:#1F1A14;">Reset your password</h2>
        <p style="color:#4b4b4b;">Click the button below to set a new password. This link expires in 1 hour.</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" style="background:#C29A33;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Reset password</a>
        </p>
        <p style="color:#8a8a8a;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
        <p style="color:#b0b0b0;font-size:11px;">Powered by Jewel Factory</p>
      </div>
    `,
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
}): { subject: string; html: string } {
  const { storeName, storeSlug, ownerEmail, managerEmails, appUrl } = opts;
  const managerRows =
    managerEmails.length > 0
      ? managerEmails
          .map(
            (e) =>
              `<tr><td style="padding:4px 12px 4px 0;color:#6b6b6b;">Manager</td><td style="padding:4px 0;font-weight:600;">${e}</td></tr>`,
          )
          .join('')
      : `<tr><td style="padding:4px 0;color:#6b6b6b;" colspan="2">No manager added yet — add one from Managers in your portal.</td></tr>`;

  return {
    subject: `Your store "${storeName}" is approved — Jewel Factory`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto;">
        <h2 style="color:#1F1A14;">Your store is approved 🎉</h2>
        <p style="color:#4b4b4b;">
          Good news — <strong>${storeName}</strong> has been approved by the manufacturer.
          You now have full access to your store portal.
        </p>

        <h3 style="color:#1F1A14;margin-top:24px;font-size:15px;">Login details</h3>
        <table style="font-size:14px;color:#1F1A14;">
          <tr><td style="padding:4px 12px 4px 0;color:#6b6b6b;">Store Owner</td><td style="padding:4px 0;font-weight:600;">${ownerEmail}</td></tr>
          ${managerRows}
        </table>
        <p style="color:#8a8a8a;font-size:13px;margin-top:8px;">
          Use the password you set during registration. Share the manager login with your store staff.
        </p>

        <h3 style="color:#1F1A14;margin-top:24px;font-size:15px;">Quick links</h3>
        <p style="margin:12px 0;">
          <a href="${appUrl}/store/login" style="background:#C29A33;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;margin:0 8px 8px 0;">Store Owner Login</a>
          <a href="${appUrl}/store/manager/login" style="background:#2E251F;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;margin:0 8px 8px 0;">Manager Login</a>
        </p>
        <p style="color:#4b4b4b;font-size:14px;">
          Your in-store customer kiosk is live at:<br/>
          <a href="${appUrl}/${storeSlug}" style="color:#C29A33;font-weight:600;">${appUrl}/${storeSlug}</a>
        </p>

        <p style="color:#8a8a8a;font-size:13px;margin-top:20px;">
          Forgot a password? Reset it here:
          <a href="${appUrl}/store/forgot-password" style="color:#C29A33;">Owner reset</a> ·
          <a href="${appUrl}/store/manager/forgot-password" style="color:#C29A33;">Manager reset</a>
        </p>
        <p style="color:#b0b0b0;font-size:11px;margin-top:20px;">Powered by Jewel Factory</p>
      </div>
    `,
  };
}
