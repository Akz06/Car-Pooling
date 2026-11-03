/**
 * Sends password-reset codes through Zoho CPaaS — by email to every account,
 * and on WhatsApp too when the account has a mobile number.
 *
 * Zoho CPaaS API (https://www.zoho.com/cpaas/help/api/api-authentication.html):
 * every request carries the Agent's channel API key as
 *   Authorization: Zoho-enczapikey <key>
 * (email and WhatsApp have separate keys: Agent → SMTP/API → API Setup).
 *
 *   Email     POST https://cpaas.zoho.com/v1.1/email
 *             { from: {address, name}, to: [{email_address: {address, name}}], subject, htmlbody, textbody }
 *   WhatsApp  POST https://cpaas.zoho.com/v1.1/whatsapp
 *             { from, to, template_key, merge_info: { <field>: <code> } }
 *
 * Server variables:
 *   ZOHO_CPAAS_EMAIL_KEY      email API key of your Agent
 *   ZOHO_EMAIL_FROM           sender address on your verified domain, e.g. no-reply@yourdomain.com
 *   ZOHO_EMAIL_FROM_NAME      optional sender name (default SeatShare)
 *   ZOHO_CPAAS_API_KEY        WhatsApp API key of your Agent
 *   ZOHO_WHATSAPP_FROM        your WhatsApp Business number, e.g. +919876543210
 *   ZOHO_WHATSAPP_TEMPLATE    template key of an approved Authentication template
 *   ZOHO_WHATSAPP_CODE_FIELD  the template variable holding the code (default otp)
 *   ZOHO_CPAAS_BASE           optional, default https://cpaas.zoho.com/v1.1
 *
 * A channel that isn't configured, or a send that fails, logs the code instead,
 * so the owner can always reset passwords from the server logs.
 */
export interface ResetTarget {
  email: string;
  phone?: string;
  name: string;
  code: string;
}

export interface OtpSender {
  send(target: ResetTarget): Promise<void>;
  readonly channels: { email: boolean; whatsapp: boolean };
}

const maskPhone = (p: string) => p.replace(/^(\+\d{2})\d+(\d{3})$/, '$1•••••$2');
const maskEmail = (e: string) => e.replace(/^(.)[^@]*(@.*)$/, '$1•••$2');
const authHeader = (key: string) => (/^Zoho-enczapikey\s/i.test(key) ? key : `Zoho-enczapikey ${key}`);
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

async function post(url: string, key: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: authHeader(key) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Zoho CPaaS ${res.status}: ${text.slice(0, 400)}`);
}

export function createOtpSender(env: Record<string, string | undefined> = process.env): OtpSender {
  const base = (env.ZOHO_CPAAS_BASE?.trim() || 'https://cpaas.zoho.com/v1.1').replace(/\/$/, '');
  const emailKey = env.ZOHO_CPAAS_EMAIL_KEY?.trim();
  const emailFrom = env.ZOHO_EMAIL_FROM?.trim();
  const fromName = env.ZOHO_EMAIL_FROM_NAME?.trim() || 'SeatShare';
  const waKey = (env.ZOHO_WHATSAPP_API_KEY ?? env.ZOHO_CPAAS_API_KEY)?.trim();
  const waFrom = env.ZOHO_WHATSAPP_FROM?.trim();
  const waTemplate = env.ZOHO_WHATSAPP_TEMPLATE?.trim();
  const waField = env.ZOHO_WHATSAPP_CODE_FIELD?.trim() || 'otp';
  const channels = { email: !!(emailKey && emailFrom), whatsapp: !!(waKey && waFrom && waTemplate) };

  const sendEmail = async ({ email, name, code }: ResetTarget) => {
    if (!channels.email) return console.log(`[password reset] Email not configured yet — code for ${maskEmail(email)}: ${code} (valid 10 minutes)`);
    try {
      await post(`${base}/email`, emailKey!, {
        from: { address: emailFrom, name: fromName },
        to: [{ email_address: { address: email, name } }],
        subject: `${code} is your ${fromName} password reset code`,
        textbody: `Hi ${name},\n\nYour ${fromName} password reset code is ${code}. It expires in 10 minutes.\n\nIf you didn't ask to reset your password, you can ignore this email.`,
        htmlbody: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#111">
<p>Hi ${escapeHtml(name)},</p>
<p>Your ${escapeHtml(fromName)} password reset code is</p>
<p style="font-size:30px;font-weight:700;letter-spacing:6px;margin:12px 0">${code}</p>
<p>It expires in 10 minutes.</p>
<p style="color:#666;font-size:13px">If you didn't ask to reset your password, you can ignore this email.</p></div>`,
        track_opens: false,
        track_clicks: false,
      });
      console.log(`[password reset] Email code sent to ${maskEmail(email)}`);
    } catch (err) {
      console.error(`[password reset] Email send failed (${(err as Error).message}). Code for ${maskEmail(email)}: ${code}`);
    }
  };

  const sendWhatsApp = async ({ phone, code }: ResetTarget) => {
    if (!phone) return;
    if (!channels.whatsapp) return console.log(`[password reset] WhatsApp not configured yet — code for ${maskPhone(phone)}: ${code} (valid 10 minutes)`);
    try {
      await post(`${base}/whatsapp`, waKey!, { from: waFrom, to: phone, template_key: waTemplate, merge_info: { [waField]: code } });
      console.log(`[password reset] WhatsApp code sent to ${maskPhone(phone)}`);
    } catch (err) {
      console.error(`[password reset] WhatsApp send failed (${(err as Error).message}). Code for ${maskPhone(phone)}: ${code}`);
    }
  };

  return {
    channels,
    async send(target) {
      await Promise.all([sendEmail(target), sendWhatsApp(target)]);
    },
  };
}
